import {
  APP_DATA_STORES,
  classifyStorageKey,
  listOwnedStorageKeys,
} from './storageManifest.js';
import {
  canonicalSha256,
  classifyStorageError,
  logicalUtf16Bytes,
  sha256Text,
  verifyWorkspaceRaw,
} from './storageIntegrity.js';

export const MIGRATION_STATES = Object.freeze({
  COPYING: 'copying',
  VERIFYING: 'verifying',
  READY: 'ready',
  ACTIVE: 'active',
  FAILED: 'failed',
});

function parseJson(rawValue) {
  try {
    return { ok: true, value: JSON.parse(rawValue) };
  } catch {
    return { ok: false, value: null };
  }
}

function extractVideoId(record = {}) {
  const direct = String(record.youtubeId || record.videoId || '').trim();
  if (direct) return direct;
  return String(record.url || '').match(/[?&]v=([^&]+)/)?.[1] || null;
}

function stableRecordId(sourceKey, index, recordId) {
  return `${sourceKey}:${index}:${String(recordId || '')}`;
}

async function captureSnapshot(storage, cryptoProvider) {
  const keys = listOwnedStorageKeys(storage);
  const entries = [];
  for (const storageKey of keys) {
    const rawValue = storage.getItem(storageKey);
    if (rawValue === null) continue;
    entries.push({
      storageKey,
      domain: classifyStorageKey(storageKey),
      rawValue,
      valueCodeUnits: rawValue.length,
      logicalBytes: logicalUtf16Bytes(storageKey, rawValue),
      valueSha256: await sha256Text(rawValue, cryptoProvider),
    });
  }
  const sourceHash = await canonicalSha256(entries, cryptoProvider);
  return {
    entries,
    sourceHash,
    logicalBytes: entries.reduce((sum, entry) => sum + entry.logicalBytes, 0),
  };
}

export async function captureStableLocalStorage(storage, cryptoProvider = globalThis.crypto) {
  const first = await captureSnapshot(storage, cryptoProvider);
  const second = await captureSnapshot(storage, cryptoProvider);
  if (first.sourceHash !== second.sourceHash) {
    throw new Error('localStorage changed between the two migration reads');
  }
  return second;
}

function buildProjections(snapshot, generationId, expectedWorkspaceIntegrity) {
  const records = {
    [APP_DATA_STORES.SOURCE_ENTRIES]: snapshot.entries.map((entry) => ({ generationId, ...entry })),
    [APP_DATA_STORES.VIDEOS]: [],
    [APP_DATA_STORES.ANALYSES]: [],
    [APP_DATA_STORES.TRANSCRIPTS]: [],
    [APP_DATA_STORES.WORKSPACE_ITEMS]: [],
    [APP_DATA_STORES.SNAPSHOTS]: [],
    [APP_DATA_STORES.MEDIA_BLOBS]: [],
  };
  let workspaceIntegrity = null;

  for (const entry of snapshot.entries) {
    const parsed = parseJson(entry.rawValue);

    if (entry.storageKey === 'workspace_library_v1') {
      const verified = verifyWorkspaceRaw(entry.rawValue, expectedWorkspaceIntegrity);
      workspaceIntegrity = verified.integrity;
      verified.items.forEach((item, index) => {
        const recordId = String(item?.id || '');
        const id = stableRecordId(entry.storageKey, index, recordId);
        const videoId = String(item?.videoId || item?.sourceVideoId || item?.structuredSnapshot?.videoId || '') || null;
        records[APP_DATA_STORES.WORKSPACE_ITEMS].push({
          generationId,
          id,
          recordId,
          sourceIndex: index,
          videoId,
          itemType: item?.itemType || null,
          topicId: item?.topicId || null,
          subTopicId: item?.subTopicId || item?.subtopicId || null,
          value: item,
        });
        if (item?.itemType === 'structured-snapshot' && item?.structuredSnapshot) {
          records[APP_DATA_STORES.SNAPSHOTS].push({
            generationId,
            id,
            workspaceItemId: recordId || null,
            videoId,
            schemaVersion: String(item.structuredSnapshot.schemaVersion || item.structuredSnapshot.version || 'legacy'),
            value: item.structuredSnapshot,
          });
        }
      });
      continue;
    }

    if (entry.domain === 'videos' && parsed.ok && Array.isArray(parsed.value)) {
      parsed.value.forEach((video, index) => {
        records[APP_DATA_STORES.VIDEOS].push({
          generationId,
          id: stableRecordId(entry.storageKey, index, video?.id),
          recordId: String(video?.id || ''),
          sourceKey: entry.storageKey,
          sourceIndex: index,
          videoId: extractVideoId(video),
          channelId: video?.channelId || null,
          value: video,
        });
      });
      continue;
    }

    if (entry.domain === 'analyses') {
      records[APP_DATA_STORES.ANALYSES].push({
        generationId,
        id: entry.storageKey,
        videoId: entry.storageKey.split(/:|_/).at(-1) || null,
        kind: entry.storageKey.split(/[:_-]/)[0] || 'analysis',
        rawValue: entry.rawValue,
        parsedValue: parsed.ok ? parsed.value : null,
        parsed: parsed.ok,
      });
      continue;
    }

    if (entry.domain === 'transcripts') {
      records[APP_DATA_STORES.TRANSCRIPTS].push({
        generationId,
        id: entry.storageKey,
        videoId: null,
        kind: entry.storageKey,
        rawValue: entry.rawValue,
        parsedValue: parsed.ok ? parsed.value : null,
        parsed: parsed.ok,
      });
      continue;
    }

    if (entry.domain === 'media') {
      records[APP_DATA_STORES.MEDIA_BLOBS].push({
        generationId,
        id: entry.storageKey,
        videoId: null,
        kind: 'thumbnail-cache',
        sha256: entry.valueSha256,
        rawValue: entry.rawValue,
      });
    }
  }

  if (!workspaceIntegrity && expectedWorkspaceIntegrity) {
    throw new Error('The required Workspace source key is missing');
  }

  return { records, workspaceIntegrity };
}

function createBatchPlan(recordsByStore, batchSize) {
  const plan = [];
  for (const [storeName, records] of Object.entries(recordsByStore)) {
    for (let offset = 0, batchNumber = 0; offset < records.length; offset += batchSize, batchNumber += 1) {
      plan.push({ storeName, batchNumber, records: records.slice(offset, offset + batchSize) });
    }
  }
  return plan;
}

function recordKey(storeName, record) {
  if (storeName === APP_DATA_STORES.SOURCE_ENTRIES) {
    return [record.generationId, record.storageKey];
  }
  return [record.generationId, record.id];
}

async function verifyBatch(repository, batch, cryptoProvider) {
  const keys = batch.records.map((record) => recordKey(batch.storeName, record));
  const readBack = await repository.readRecords(batch.storeName, keys);
  if (readBack.some((record) => !record)) throw new Error('IndexedDB batch read-back is incomplete');
  const expectedHash = await canonicalSha256(batch.records, cryptoProvider);
  const actualHash = await canonicalSha256(readBack, cryptoProvider);
  if (expectedHash !== actualHash) throw new Error('IndexedDB batch read-back hash mismatch');
  return expectedHash;
}

function safeCounts(recordsByStore) {
  return Object.fromEntries(
    Object.entries(recordsByStore).map(([storeName, records]) => [storeName, records.length]),
  );
}

function sortRecordsForStore(storeName, records) {
  return [...records].sort((left, right) => {
    const leftKey = JSON.stringify(recordKey(storeName, left));
    const rightKey = JSON.stringify(recordKey(storeName, right));
    return leftKey.localeCompare(rightKey);
  });
}

export async function migrateLocalStorageToIndexedDb({
  storage,
  repository,
  expectedWorkspaceIntegrity,
  cryptoProvider = globalThis.crypto,
  batchSize = 25,
  activate = false,
  generationIdFactory = () => `generation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
} = {}) {
  if (!storage || !repository) throw new Error('Storage and repository are required');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error('Migration batch size must be between 1 and 100');
  }

  const snapshot = await captureStableLocalStorage(storage, cryptoProvider);
  const prior = await repository.readMeta('migration');
  if (prior?.sourceHash === snapshot.sourceHash && prior.state === MIGRATION_STATES.ACTIVE) {
    return { ...prior, idempotent: true };
  }

  const generationId = prior?.sourceHash === snapshot.sourceHash && prior?.generationId
    ? prior.generationId
    : generationIdFactory();
  const { records, workspaceIntegrity } = buildProjections(
    snapshot,
    generationId,
    expectedWorkspaceIntegrity,
  );
  const counts = safeCounts(records);

  await repository.writeMeta({
    key: 'migration',
    generationId,
    sourceHash: snapshot.sourceHash,
    state: MIGRATION_STATES.COPYING,
    counts,
    integrity: workspaceIntegrity,
  });

  try {
    const completed = new Set(
      (await repository.listJournal(generationId)).map((item) => `${item.storeName}:${item.batchNumber}`),
    );
    const plan = createBatchPlan(records, batchSize);

    for (const batch of plan) {
      const journalKey = `${batch.storeName}:${batch.batchNumber}`;
      if (completed.has(journalKey)) {
        await verifyBatch(repository, batch, cryptoProvider);
        continue;
      }
      await repository.writeBatch(batch.storeName, batch.records);
      const batchHash = await verifyBatch(repository, batch, cryptoProvider);
      await repository.writeJournal({
        generationId,
        storeName: batch.storeName,
        batchNumber: batch.batchNumber,
        recordCount: batch.records.length,
        batchHash,
      });
    }

    await repository.writeMeta({
      key: 'migration',
      generationId,
      sourceHash: snapshot.sourceHash,
      state: MIGRATION_STATES.VERIFYING,
      counts,
      integrity: workspaceIntegrity,
    });

    for (const [storeName, expectedRecords] of Object.entries(records)) {
      const actualRecords = await repository.listByGeneration(storeName, generationId);
      if (actualRecords.length !== expectedRecords.length) {
        throw new Error(`IndexedDB generation count mismatch for ${storeName}`);
      }
      if (
        await canonicalSha256(sortRecordsForStore(storeName, actualRecords), cryptoProvider)
        !== await canonicalSha256(sortRecordsForStore(storeName, expectedRecords), cryptoProvider)
      ) {
        throw new Error(`IndexedDB generation hash mismatch for ${storeName}`);
      }
    }

    const ready = {
      key: 'migration',
      generationId,
      sourceHash: snapshot.sourceHash,
      sourceLogicalBytes: snapshot.logicalBytes,
      state: MIGRATION_STATES.READY,
      counts,
      integrity: workspaceIntegrity,
    };
    await repository.writeMeta(ready);

    if (!activate) return { ...ready, idempotent: false };

    await repository.activateGeneration({
      generationId,
      sourceHash: snapshot.sourceHash,
      integrity: workspaceIntegrity,
      counts,
    });
    return { ...ready, state: MIGRATION_STATES.ACTIVE, idempotent: false };
  } catch (error) {
    try {
      await repository.writeMeta({
        key: 'migration',
        generationId,
        sourceHash: snapshot.sourceHash,
        state: MIGRATION_STATES.FAILED,
        counts,
        integrity: workspaceIntegrity,
        errorCode: classifyStorageError(error),
      });
    } catch {
      // The incomplete generation remains inactive even if failure metadata cannot be written.
    }
    throw error;
  }
}

export async function activateReadyGeneration(repository) {
  const migration = await repository.readMeta('migration');
  if (!migration || migration.state !== MIGRATION_STATES.READY) {
    throw new Error('No verified generation is ready for activation');
  }
  await repository.activateGeneration(migration);
  return { ...migration, state: MIGRATION_STATES.ACTIVE };
}
