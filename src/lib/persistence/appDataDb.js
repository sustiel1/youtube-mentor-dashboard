import {
  APP_DATA_DB_NAME,
  APP_DATA_DB_VERSION,
  APP_DATA_STORES,
} from './storageManifest.js';
import { canonicalize } from './storageIntegrity.js';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  });
}

function canonicalValuesEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function ensureIndex(store, name, keyPath, options = {}) {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, options);
}

function createSchema(database) {
  if (!database.objectStoreNames.contains(APP_DATA_STORES.META)) {
    database.createObjectStore(APP_DATA_STORES.META, { keyPath: 'key' });
  }

  if (!database.objectStoreNames.contains(APP_DATA_STORES.SOURCE_ENTRIES)) {
    const store = database.createObjectStore(APP_DATA_STORES.SOURCE_ENTRIES, {
      keyPath: ['generationId', 'storageKey'],
    });
    ensureIndex(store, 'generationId', 'generationId');
    ensureIndex(store, 'domain', 'domain');
  }

  const generationStores = [
    APP_DATA_STORES.VIDEOS,
    APP_DATA_STORES.ANALYSES,
    APP_DATA_STORES.TRANSCRIPTS,
    APP_DATA_STORES.WORKSPACE_ITEMS,
    APP_DATA_STORES.SNAPSHOTS,
    APP_DATA_STORES.MEDIA_BLOBS,
  ];

  for (const storeName of generationStores) {
    if (database.objectStoreNames.contains(storeName)) continue;
    const store = database.createObjectStore(storeName, { keyPath: ['generationId', 'id'] });
    ensureIndex(store, 'generationId', 'generationId');
    ensureIndex(store, 'videoId', 'videoId');
    if (storeName === APP_DATA_STORES.WORKSPACE_ITEMS) {
      ensureIndex(store, 'recordId', 'recordId');
      ensureIndex(store, 'itemType', 'itemType');
      ensureIndex(store, 'topicId', 'topicId');
      ensureIndex(store, 'subTopicId', 'subTopicId');
    }
    if (storeName === APP_DATA_STORES.SNAPSHOTS) {
      ensureIndex(store, 'workspaceItemId', 'workspaceItemId');
      ensureIndex(store, 'schemaVersion', 'schemaVersion');
    }
    if (storeName === APP_DATA_STORES.ANALYSES || storeName === APP_DATA_STORES.TRANSCRIPTS) {
      ensureIndex(store, 'kind', 'kind');
    }
    if (storeName === APP_DATA_STORES.MEDIA_BLOBS) {
      ensureIndex(store, 'sha256', 'sha256');
    }
  }

  if (!database.objectStoreNames.contains(APP_DATA_STORES.MIGRATION_JOURNAL)) {
    const store = database.createObjectStore(APP_DATA_STORES.MIGRATION_JOURNAL, {
      keyPath: ['generationId', 'storeName', 'batchNumber'],
    });
    ensureIndex(store, 'generationId', 'generationId');
  }

  if (!database.objectStoreNames.contains(APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL)) {
    const store = database.createObjectStore(APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL, {
      keyPath: 'operationId',
    });
    ensureIndex(store, 'previousGenerationId', 'previousGenerationId');
    ensureIndex(store, 'nextGenerationId', 'nextGenerationId', { unique: true });
    ensureIndex(store, 'anchorGenerationId', 'anchorGenerationId');
  }
}

export function openAppDataDb({ indexedDBFactory = globalThis.indexedDB } = {}) {
  if (!indexedDBFactory?.open) {
    return Promise.reject(new Error('IndexedDB is unavailable'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(APP_DATA_DB_NAME, APP_DATA_DB_VERSION);
    let settled = false;

    request.onupgradeneeded = () => createSchema(request.result);
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error('IndexedDB open is blocked by another tab'));
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error || new Error('IndexedDB open failed'));
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

export function createAppDataRepository(database) {
  if (!database?.transaction) throw new Error('An open IndexedDB database is required');

  async function readMeta(key) {
    const transaction = database.transaction(APP_DATA_STORES.META, 'readonly');
    const done = transactionDone(transaction);
    const result = await requestResult(transaction.objectStore(APP_DATA_STORES.META).get(key));
    await done;
    return result || null;
  }

  async function writeMeta(record) {
    const transaction = database.transaction(APP_DATA_STORES.META, 'readwrite');
    const done = transactionDone(transaction);
    await requestResult(transaction.objectStore(APP_DATA_STORES.META).put(record));
    await done;
    return record;
  }

  async function writeBatch(storeName, records) {
    const transaction = database.transaction(storeName, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(storeName);
    await Promise.all(records.map((record) => requestResult(store.put(record))));
    await done;
  }

  async function readRecords(storeName, keys) {
    const transaction = database.transaction(storeName, 'readonly');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(storeName);
    const records = await Promise.all(keys.map((key) => requestResult(store.get(key))));
    await done;
    return records;
  }

  async function deleteRecords(storeName, keys) {
    const transaction = database.transaction(storeName, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(storeName);
    await Promise.all(keys.map((key) => requestResult(store.delete(key))));
    await done;
  }

  async function writeJournal(record) {
    const transaction = database.transaction(APP_DATA_STORES.MIGRATION_JOURNAL, 'readwrite');
    const done = transactionDone(transaction);
    await requestResult(transaction.objectStore(APP_DATA_STORES.MIGRATION_JOURNAL).put(record));
    await done;
  }

  async function listJournal(generationId) {
    const transaction = database.transaction(APP_DATA_STORES.MIGRATION_JOURNAL, 'readonly');
    const done = transactionDone(transaction);
    const index = transaction.objectStore(APP_DATA_STORES.MIGRATION_JOURNAL).index('generationId');
    const records = await requestResult(index.getAll(generationId));
    await done;
    return records || [];
  }

  async function listByGeneration(storeName, generationId) {
    const transaction = database.transaction(storeName, 'readonly');
    const done = transactionDone(transaction);
    const index = transaction.objectStore(storeName).index('generationId');
    const records = await requestResult(index.getAll(generationId));
    await done;
    return records || [];
  }

  async function readSourceEntry(generationId, storageKey) {
    const records = await readRecords(APP_DATA_STORES.SOURCE_ENTRIES, [[generationId, storageKey]]);
    return records[0] || null;
  }

  async function readWorkspaceChangeJournal(operationId) {
    const transaction = database.transaction(APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL, 'readonly');
    const done = transactionDone(transaction);
    const result = await requestResult(
      transaction.objectStore(APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL).get(operationId),
    );
    await done;
    return result || null;
  }

  async function listWorkspaceChangeJournal(anchorGenerationId) {
    const transaction = database.transaction(APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL, 'readonly');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL);
    const records = anchorGenerationId
      ? await requestResult(store.index('anchorGenerationId').getAll(anchorGenerationId))
      : await requestResult(store.getAll());
    await done;
    return records || [];
  }

  async function writeWorkspaceGeneration({ sourceEntry, workspaceItems, snapshots }) {
    const transaction = database.transaction([
      APP_DATA_STORES.SOURCE_ENTRIES,
      APP_DATA_STORES.WORKSPACE_ITEMS,
      APP_DATA_STORES.SNAPSHOTS,
    ], 'readwrite');
    const done = transactionDone(transaction);
    const sourceStore = transaction.objectStore(APP_DATA_STORES.SOURCE_ENTRIES);
    const workspaceStore = transaction.objectStore(APP_DATA_STORES.WORKSPACE_ITEMS);
    const snapshotStore = transaction.objectStore(APP_DATA_STORES.SNAPSHOTS);
    await Promise.all([
      requestResult(sourceStore.put(sourceEntry)),
      ...workspaceItems.map((record) => requestResult(workspaceStore.put(record))),
      ...snapshots.map((record) => requestResult(snapshotStore.put(record))),
    ]);
    await done;
  }

  async function commitWorkspaceMutation({
    sourceEntry,
    workspaceItems,
    snapshots,
    journalEntry,
    activation,
  }) {
    const transaction = database.transaction([
      APP_DATA_STORES.META,
      APP_DATA_STORES.SOURCE_ENTRIES,
      APP_DATA_STORES.WORKSPACE_ITEMS,
      APP_DATA_STORES.SNAPSHOTS,
      APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL,
    ], 'readwrite');
    const done = transactionDone(transaction);
    const metaStore = transaction.objectStore(APP_DATA_STORES.META);
    const [workspaceActive, migrationActive, recoveryAnchor] = await Promise.all([
      requestResult(metaStore.get('activeWorkspaceGeneration')),
      requestResult(metaStore.get('activeGeneration')),
      requestResult(metaStore.get('workspaceRecoveryAnchor')),
    ]);
    const currentActive = workspaceActive?.state === 'active' ? workspaceActive : migrationActive;
    if (
      currentActive?.state !== 'active'
      || currentActive.generationId !== activation.expectedPreviousGenerationId
      || recoveryAnchor?.state !== 'anchored'
      || recoveryAnchor.generationId !== journalEntry.anchorGenerationId
      || recoveryAnchor.workspaceSourceHash !== journalEntry.anchorSourceHash
    ) {
      transaction.abort();
      try { await done; } catch {}
      const error = new Error('Workspace generation changed or recovery anchor is unavailable');
      error.name = 'WorkspaceConcurrencyError';
      throw error;
    }

    const sourceStore = transaction.objectStore(APP_DATA_STORES.SOURCE_ENTRIES);
    const workspaceStore = transaction.objectStore(APP_DATA_STORES.WORKSPACE_ITEMS);
    const snapshotStore = transaction.objectStore(APP_DATA_STORES.SNAPSHOTS);
    const journalStore = transaction.objectStore(APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL);
    await Promise.all([
      requestResult(sourceStore.put(sourceEntry)),
      ...workspaceItems.map((record) => requestResult(workspaceStore.put(record))),
      ...snapshots.map((record) => requestResult(snapshotStore.put(record))),
      requestResult(journalStore.add(journalEntry)),
      requestResult(metaStore.put({
        key: 'activeWorkspaceGeneration',
        generationId: activation.generationId,
        sourceHash: activation.sourceHash,
        integrity: activation.integrity,
        counts: activation.counts,
        journalOperationId: journalEntry.operationId,
        state: 'active',
      })),
    ]);
    await done;
  }

  async function activateWorkspaceGeneration({ generationId, sourceHash, integrity, counts }) {
    return writeMeta({
      key: 'activeWorkspaceGeneration',
      generationId,
      sourceHash,
      integrity,
      counts,
      state: 'active',
    });
  }

  async function activateGeneration({
    generationId,
    sourceHash,
    activationCriticalSourceHash,
    activationCriticalIntegrity,
    workspaceSourceHash,
    integrity,
    counts,
    activationEvidence,
    expectedMigration,
  }) {
    if (
      activationEvidence?.verified !== true
      || !workspaceSourceHash
      || expectedMigration?.state !== 'ready'
      || expectedMigration.generationId !== generationId
    ) {
      throw new Error('Verified backup, preflight and integrity evidence are required for activation');
    }
    const transaction = database.transaction(APP_DATA_STORES.META, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(APP_DATA_STORES.META);
    const [currentMigration, currentActiveGeneration, currentActiveWorkspaceGeneration] = await Promise.all([
      requestResult(store.get('migration')),
      requestResult(store.get('activeGeneration')),
      requestResult(store.get('activeWorkspaceGeneration')),
    ]);
    if (
      !currentMigration
      || currentMigration.state !== 'ready'
      || currentMigration.generationId !== generationId
      || currentMigration.sourceHash !== sourceHash
      || (
        currentMigration.activationCriticalSourceHash
        && currentMigration.activationCriticalSourceHash !== activationCriticalSourceHash
      )
      || (
        currentMigration.activationCriticalIntegrity
        && !canonicalValuesEqual(
          currentMigration.activationCriticalIntegrity,
          activationCriticalIntegrity,
        )
      )
      || currentMigration.workspaceSourceHash !== workspaceSourceHash
      || !canonicalValuesEqual(currentMigration.integrity, integrity)
      || !canonicalValuesEqual(currentMigration.counts, counts)
      || !canonicalValuesEqual(currentMigration, expectedMigration)
      || currentActiveGeneration
      || currentActiveWorkspaceGeneration
    ) {
      transaction.abort();
      try { await done; } catch {}
      const error = new Error('Ready generation changed or an active generation already exists');
      error.name = 'GenerationActivationConflictError';
      throw error;
    }
    try {
      await requestResult(store.put({
        key: 'activeGeneration',
        generationId,
        sourceHash,
        activationCriticalSourceHash,
        activationCriticalIntegrity,
        integrity,
        counts,
        state: 'active',
      }));
      await requestResult(store.put({
        key: 'activeWorkspaceGeneration',
        generationId,
        sourceHash: workspaceSourceHash,
        integrity,
        counts,
        state: 'active',
      }));
      await requestResult(store.put({
        key: 'workspaceRecoveryAnchor',
        generationId,
        workspaceSourceHash,
        integrity,
        evidenceHash: activationEvidence.evidenceHash,
        state: 'anchored',
      }));
      await requestResult(store.put({
        ...currentMigration,
        activationCriticalSourceHash,
        activationCriticalIntegrity,
        state: 'active',
      }));
    } catch (error) {
      try { transaction.abort(); } catch {}
      try { await done; } catch {}
      throw error;
    }
    await done;
  }

  return {
    readMeta,
    writeMeta,
    writeBatch,
    readRecords,
    deleteRecords,
    writeJournal,
    listJournal,
    listByGeneration,
    readSourceEntry,
    readWorkspaceChangeJournal,
    listWorkspaceChangeJournal,
    writeWorkspaceGeneration,
    commitWorkspaceMutation,
    activateWorkspaceGeneration,
    activateGeneration,
    close: () => database.close(),
  };
}
