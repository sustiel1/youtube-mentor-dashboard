import {
  WORKSPACE_PERSISTENCE_ERROR_CODES,
  archiveWorkspaceItems,
  createWorkspacePersistenceFailure,
  deleteAllWorkspaceItems,
  deleteWorkspaceItem,
  deleteWorkspaceItems,
  getWorkspaceItems,
  reassignWorkspaceVideoGroupTopic,
  saveWorkspaceItem,
  saveWorkspaceItemsBulk,
  updateWorkspaceItem,
  updateWorkspaceItemByVideoId,
  updateWorkspaceItemsBulk,
} from '@/lib/workspaceLibraryStore';
import { createAppDataRepository, openAppDataDb } from './appDataDb.js';
import { createPersistenceEvents } from './storageEvents.js';
import {
  canonicalSha256,
  classifyStorageError,
  logicalUtf16Bytes,
  sha256Text,
  verifyWorkspaceRaw,
} from './storageIntegrity.js';
import { APP_DATA_STORES, classifyStorageKey } from './storageManifest.js';
import { APPLICATION_STORAGE_MODES, getApplicationStorageMode } from './storageMode.js';
import { buildWorkspaceProjectionRecords } from './workspaceProjection.js';
import {
  createWorkspaceChangeJournalEntry,
  verifyWorkspaceChangeJournalEntry,
} from './workspaceChangeJournal.js';

const WORKSPACE_SOURCE_KEY = 'workspace_library_v1';

class WorkspaceMemoryStorage {
  constructor(rawValue) {
    this.rawValue = rawValue;
  }

  getItem(key) {
    return key === WORKSPACE_SOURCE_KEY ? this.rawValue : null;
  }

  setItem(key, value) {
    if (key === WORKSPACE_SOURCE_KEY) this.rawValue = String(value);
  }

  removeItem(key) {
    if (key === WORKSPACE_SOURCE_KEY) this.rawValue = null;
  }
}

function createGenerationId(cryptoProvider) {
  const suffix = typeof cryptoProvider?.randomUUID === 'function'
    ? cryptoProvider.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `workspace-${suffix}`;
}

function sortProjectionRecords(records) {
  return [...records].sort((left, right) => {
    const leftKey = JSON.stringify([left.generationId, left.id]);
    const rightKey = JSON.stringify([right.generationId, right.id]);
    return leftKey.localeCompare(rightKey);
  });
}

function verificationError() {
  const error = new Error('Workspace IndexedDB read-back verification failed');
  error.name = 'WorkspaceVerificationError';
  return error;
}

function workspaceFailure(error, operation, attemptedSize = null) {
  const classified = classifyStorageError(error);
  const code = classified === 'quota-exceeded'
    ? WORKSPACE_PERSISTENCE_ERROR_CODES.QUOTA_EXCEEDED
    : error?.name === 'WorkspaceVerificationError'
      ? WORKSPACE_PERSISTENCE_ERROR_CODES.INDEXEDDB_VERIFICATION_FAILED
      : classified === 'storage-unavailable'
        ? WORKSPACE_PERSISTENCE_ERROR_CODES.INDEXEDDB_UNAVAILABLE
        : WORKSPACE_PERSISTENCE_ERROR_CODES.INDEXEDDB_WRITE_FAILED;
  return createWorkspacePersistenceFailure({
    code,
    operation,
    cause: error,
    attemptedSize,
    rollbackVerified: true,
  });
}

function activationRequiredFailure(operation) {
  return createWorkspacePersistenceFailure({
    code: 'indexeddb-activation-required',
    operation,
    cause: new Error('A verified IndexedDB generation must be activated before Workspace writes'),
    rollbackVerified: true,
  });
}

export function createWorkspacePersistence({
  mode = APPLICATION_STORAGE_MODES.LOCAL_STORAGE,
  localStorageArea = globalThis.localStorage,
  cryptoProvider = globalThis.crypto,
  repositoryFactory,
  events = null,
} = {}) {
  const normalizedMode = mode === APPLICATION_STORAGE_MODES.INDEXED_DB
    ? APPLICATION_STORAGE_MODES.INDEXED_DB
    : APPLICATION_STORAGE_MODES.LOCAL_STORAGE;
  const persistenceEvents = events || createPersistenceEvents();
  let cachedItems = null;

  async function getRepository() {
    if (typeof repositoryFactory !== 'function') {
      throw Object.assign(new Error('IndexedDB repository is unavailable'), { name: 'InvalidStateError' });
    }
    return repositoryFactory();
  }

  function readLocalSource() {
    try {
      const rawValue = localStorageArea?.getItem?.(WORKSPACE_SOURCE_KEY) ?? null;
      const items = rawValue ? JSON.parse(rawValue) : [];
      if (!Array.isArray(items)) throw new TypeError('Workspace local fallback is not an array');
      return { rawValue, items, source: 'localStorage' };
    } catch {
      return { rawValue: null, items: [], source: 'localStorage' };
    }
  }

  async function readIndexedDbSource(repository) {
    const workspaceActive = await repository.readMeta('activeWorkspaceGeneration');
    const migrationActive = workspaceActive?.state === 'active'
      ? workspaceActive
      : await repository.readMeta('activeGeneration');
    if (!migrationActive || migrationActive.state !== 'active') return null;
    const entry = await repository.readSourceEntry(
      migrationActive.generationId,
      WORKSPACE_SOURCE_KEY,
    );
    if (!entry || typeof entry.rawValue !== 'string') return null;
    const verified = verifyWorkspaceRaw(entry.rawValue);
    return {
      rawValue: entry.rawValue,
      items: verified.items,
      source: 'indexedDB',
      generationId: migrationActive.generationId,
    };
  }

  async function readSource() {
    if (normalizedMode !== APPLICATION_STORAGE_MODES.INDEXED_DB) return readLocalSource();
    try {
      const repository = await getRepository();
      const indexedDbSource = await readIndexedDbSource(repository);
      if (indexedDbSource) return indexedDbSource;
    } catch {
      persistenceEvents?.publish('fallback-active', { storageKey: WORKSPACE_SOURCE_KEY });
      return { ...readLocalSource(), fallbackReason: 'indexeddb-unavailable' };
    }
    return readLocalSource();
  }

  function readItemsSnapshot() {
    if (cachedItems) return cachedItems;
    const local = getWorkspaceItems(localStorageArea);
    cachedItems = local;
    return local;
  }

  function readItems() {
    if (normalizedMode !== APPLICATION_STORAGE_MODES.INDEXED_DB) {
      const local = getWorkspaceItems(localStorageArea);
      cachedItems = local;
      return local;
    }
    return readSource().then((source) => {
      cachedItems = source.items;
      return source.items;
    });
  }

  async function verifyGeneration(repository, sourceEntry, projection) {
    const sourceReadBack = await repository.readSourceEntry(
      sourceEntry.generationId,
      sourceEntry.storageKey,
    );
    if (
      !sourceReadBack
      || await canonicalSha256(sourceReadBack, cryptoProvider)
        !== await canonicalSha256(sourceEntry, cryptoProvider)
    ) {
      throw verificationError();
    }

    for (const storeName of [APP_DATA_STORES.WORKSPACE_ITEMS, APP_DATA_STORES.SNAPSHOTS]) {
      const expected = sortProjectionRecords(projection[storeName]);
      const actual = sortProjectionRecords(
        await repository.listByGeneration(storeName, sourceEntry.generationId),
      );
      if (
        actual.length !== expected.length
        || await canonicalSha256(actual, cryptoProvider) !== await canonicalSha256(expected, cryptoProvider)
      ) {
        throw verificationError();
      }
    }
  }

  async function verifyCommittedMutation(repository, sourceEntry, projection, journalEntry) {
    await verifyGeneration(repository, sourceEntry, projection);
    const [active, storedJournal] = await Promise.all([
      repository.readMeta('activeWorkspaceGeneration'),
      repository.readWorkspaceChangeJournal(journalEntry.operationId),
    ]);
    if (
      active?.state !== 'active'
      || active.generationId !== sourceEntry.generationId
      || active.journalOperationId !== journalEntry.operationId
      || !storedJournal
      || await canonicalSha256(storedJournal, cryptoProvider)
        !== await canonicalSha256(journalEntry, cryptoProvider)
    ) {
      throw verificationError();
    }
    const previousSource = await repository.readSourceEntry(
      journalEntry.previousGenerationId,
      WORKSPACE_SOURCE_KEY,
    );
    if (!previousSource || typeof previousSource.rawValue !== 'string') throw verificationError();
    await verifyWorkspaceChangeJournalEntry(storedJournal, {
      previousRaw: previousSource.rawValue,
      nextRaw: sourceEntry.rawValue,
      cryptoProvider,
    });
  }

  async function executeIndexedDbWrite(operation, legacyOperation) {
    const current = await readSource();
    if (current.source !== 'indexedDB' || !current.generationId) {
      if (current.fallbackReason === 'indexeddb-unavailable') {
        const unavailable = Object.assign(new Error('IndexedDB is unavailable'), { name: 'InvalidStateError' });
        return workspaceFailure(unavailable, operation);
      }
      return activationRequiredFailure(operation);
    }
    const memoryStorage = new WorkspaceMemoryStorage(current.rawValue);
    const result = legacyOperation(memoryStorage);
    if (!result?.ok) return result;

    const rawValue = memoryStorage.getItem(WORKSPACE_SOURCE_KEY) ?? '[]';
    if (rawValue === current.rawValue) {
      cachedItems = result.persistedItems || current.items;
      return { ...result, storage: current.source, idempotent: true };
    }

    const attemptedSize = new TextEncoder().encode(rawValue).byteLength;
    try {
      const repository = await getRepository();
      const recoveryAnchor = await repository.readMeta('workspaceRecoveryAnchor');
      const fallbackRaw = localStorageArea?.getItem?.(WORKSPACE_SOURCE_KEY) ?? null;
      if (
        recoveryAnchor?.state !== 'anchored'
        || typeof fallbackRaw !== 'string'
        || await sha256Text(fallbackRaw, cryptoProvider) !== recoveryAnchor.workspaceSourceHash
      ) {
        return activationRequiredFailure(operation);
      }
      const verified = verifyWorkspaceRaw(rawValue);
      const generationId = createGenerationId(cryptoProvider);
      const projection = buildWorkspaceProjectionRecords(verified.items, generationId);
      const valueSha256 = await sha256Text(rawValue, cryptoProvider);
      const sourceEntry = {
        generationId,
        storageKey: WORKSPACE_SOURCE_KEY,
        domain: classifyStorageKey(WORKSPACE_SOURCE_KEY),
        rawValue,
        valueCodeUnits: rawValue.length,
        logicalBytes: logicalUtf16Bytes(WORKSPACE_SOURCE_KEY, rawValue),
        valueSha256,
      };
      const journalEntry = await createWorkspaceChangeJournalEntry({
        operation,
        previousGenerationId: current.generationId,
        nextGenerationId: generationId,
        anchorGenerationId: recoveryAnchor.generationId,
        anchorSourceHash: recoveryAnchor.workspaceSourceHash,
        previousRaw: current.rawValue,
        nextRaw: rawValue,
        cryptoProvider,
      });

      await repository.commitWorkspaceMutation({
        sourceEntry,
        workspaceItems: projection[APP_DATA_STORES.WORKSPACE_ITEMS],
        snapshots: projection[APP_DATA_STORES.SNAPSHOTS],
        journalEntry,
        activation: {
          expectedPreviousGenerationId: current.generationId,
          generationId,
          sourceHash: valueSha256,
          integrity: verified.integrity,
          counts: {
            workspaceItems: projection[APP_DATA_STORES.WORKSPACE_ITEMS].length,
            snapshots: projection[APP_DATA_STORES.SNAPSHOTS].length,
          },
        },
      });
      await verifyCommittedMutation(repository, sourceEntry, projection, journalEntry);

      cachedItems = result.persistedItems;
      persistenceEvents?.publish('record-updated', { generationId, storageKey: WORKSPACE_SOURCE_KEY });
      return {
        ...result,
        storage: 'indexedDB',
        generationId,
        journalOperationId: journalEntry.operationId,
        recoverable: true,
        idempotent: false,
      };
    } catch (error) {
      return workspaceFailure(error, operation, attemptedSize);
    }
  }

  function execute(operation, legacyOperation) {
    if (normalizedMode !== APPLICATION_STORAGE_MODES.INDEXED_DB) {
      const result = legacyOperation(localStorageArea);
      if (result?.ok && result.persistedItems) {
        cachedItems = result.persistedItems;
        persistenceEvents.publish('record-updated', { storageKey: WORKSPACE_SOURCE_KEY });
      }
      return result;
    }
    return executeIndexedDbWrite(operation, legacyOperation);
  }

  return {
    mode: normalizedMode,
    readItems,
    readItemsSnapshot,
    saveItem: (item) => execute('save-item', (storage) => saveWorkspaceItem(item, { storage })),
    saveItemsBulk: (items) => execute('save-items-bulk', (storage) => saveWorkspaceItemsBulk(items, { storage })),
    updateItem: (id, updates) => execute('update-item', (storage) => updateWorkspaceItem(id, updates, { storage })),
    deleteItem: (id) => execute('delete-item', (storage) => deleteWorkspaceItem(id, { storage })),
    deleteItems: (ids) => execute('delete-items-bulk', (storage) => deleteWorkspaceItems(ids, { storage })),
    deleteAllItems: () => execute('delete-all-items', (storage) => deleteAllWorkspaceItems({ storage })),
    updateItemsBulk: (ids, updates) => execute(
      'update-items-bulk',
      (storage) => updateWorkspaceItemsBulk(ids, updates, { storage }),
    ),
    archiveItems: (ids, archived = true) => execute(
      archived ? 'archive-items' : 'restore-items',
      (storage) => archiveWorkspaceItems(ids, archived, { storage }),
    ),
    reassignVideoGroupTopic: (params) => execute(
      'reassign-video-group-topic',
      (storage) => reassignWorkspaceVideoGroupTopic({ ...params, storage }),
    ),
    updateItemByVideoId: (videoId, updates) => execute(
      'update-item-by-video-id',
      (storage) => updateWorkspaceItemByVideoId(videoId, updates, { storage }),
    ),
    subscribe(listener) {
      return persistenceEvents?.subscribe(listener) || (() => {});
    },
    close() {
      persistenceEvents?.close();
    },
  };
}

let defaultRepositoryPromise = null;
let defaultPersistence = null;

function createDefaultRepository() {
  if (!defaultRepositoryPromise) {
    defaultRepositoryPromise = openAppDataDb()
      .then(createAppDataRepository)
      .catch((error) => {
        defaultRepositoryPromise = null;
        throw error;
      });
  }
  return defaultRepositoryPromise;
}

export function getWorkspacePersistence() {
  if (!defaultPersistence) {
    const mode = getApplicationStorageMode();
    defaultPersistence = createWorkspacePersistence({
      mode,
      repositoryFactory: mode === APPLICATION_STORAGE_MODES.INDEXED_DB
        ? createDefaultRepository
        : null,
    });
  }
  return defaultPersistence;
}

export function getWorkspaceItemsSnapshot() {
  return getWorkspacePersistence().readItemsSnapshot();
}
