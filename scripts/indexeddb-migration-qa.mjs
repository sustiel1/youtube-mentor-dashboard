#!/usr/bin/env node
import assert from 'node:assert/strict';

import { APP_DATA_STORES } from '../src/lib/persistence/storageManifest.js';
import {
  checksumWorkspaceItemIds,
  checksumWorkspacePayloadsExcludingTopicAssignment,
} from '../src/lib/persistence/storageIntegrity.js';
import { createStorageFacade } from '../src/lib/persistence/storageFacade.js';
import {
  MIGRATION_STATES,
  activateReadyGeneration,
  migrateLocalStorageToIndexedDb,
} from '../src/lib/persistence/storageMigration.js';

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
    this.readKeys = [];
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    this.readKeys.push(key);
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  snapshot() {
    return JSON.stringify([...this.values.entries()]);
  }
}

function mapKey(key) {
  return JSON.stringify(key);
}

class MemoryRepository {
  constructor() {
    this.meta = new Map();
    this.stores = new Map();
    this.journal = new Map();
    this.writeCalls = 0;
    this.failWriteCall = null;
    this.failWriteError = null;
    this.activationCount = 0;
  }

  store(name) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    return this.stores.get(name);
  }

  async readMeta(key) {
    return structuredClone(this.meta.get(key) || null);
  }

  async writeMeta(record) {
    this.meta.set(record.key, structuredClone(record));
  }

  async writeBatch(storeName, records) {
    this.writeCalls += 1;
    if (this.writeCalls === this.failWriteCall) {
      throw this.failWriteError || new Error('synthetic transaction failure');
    }
    const store = this.store(storeName);
    for (const record of records) {
      const key = storeName === APP_DATA_STORES.SOURCE_ENTRIES
        ? [record.generationId, record.storageKey]
        : [record.generationId, record.id];
      store.set(mapKey(key), structuredClone(record));
    }
  }

  async readRecords(storeName, keys) {
    const store = this.store(storeName);
    return keys.map((key) => structuredClone(store.get(mapKey(key)) || null));
  }

  async writeJournal(record) {
    const key = [record.generationId, record.storeName, record.batchNumber];
    this.journal.set(mapKey(key), structuredClone(record));
  }

  async listJournal(generationId) {
    return [...this.journal.values()]
      .filter((record) => record.generationId === generationId)
      .map((record) => structuredClone(record));
  }

  async listByGeneration(storeName, generationId) {
    return [...this.store(storeName).values()]
      .filter((record) => record.generationId === generationId)
      .map((record) => structuredClone(record));
  }

  async readSourceEntry(generationId, storageKey) {
    const [record] = await this.readRecords(
      APP_DATA_STORES.SOURCE_ENTRIES,
      [[generationId, storageKey]],
    );
    return record;
  }

  async activateGeneration(payload) {
    this.activationCount += 1;
    this.meta.set('activeGeneration', { key: 'activeGeneration', state: 'active', ...structuredClone(payload) });
    this.meta.set('migration', { key: 'migration', state: 'active', ...structuredClone(payload) });
  }
}

function makeWorkspaceItems(count = 80) {
  return Array.from({ length: count }, (_, index) => ({
    id: `workspace-${String(index).padStart(3, '0')}`,
    videoId: `video-${index % 8}`,
    itemType: index === 2 ? 'structured-snapshot' : 'knowledge-item',
    topicId: index % 2 ? 'topic-b' : 'topic-a',
    structuredSnapshot: index === 2
      ? { videoId: 'video-2', stocksTable: [], sentiment: [{ legacy: true }] }
      : undefined,
    payload: { index, text: `synthetic-${index}` },
  }));
}

function expectedWorkspace(items) {
  return {
    recordCount: items.length,
    idChecksum: checksumWorkspaceItemIds(items),
    payloadChecksum: checksumWorkspacePayloadsExcludingTopicAssignment(items),
  };
}

function createFixture() {
  const workspaceItems = makeWorkspaceItems();
  const storage = new MemoryStorage({
    workspace_library_v1: JSON.stringify(workspaceItems),
    yt_mentor_videos_v2: JSON.stringify([
      { id: 'duplicate', youtubeId: 'video-a', title: 'A' },
      { id: 'duplicate', youtubeId: 'video-b', title: 'B' },
    ]),
    'analysis:video-a': JSON.stringify({ savedAt: '2026-08-16T00:00:00.000Z', summary: 'synthetic' }),
    yt_mentor_transcript_cache_v1: JSON.stringify({ 'video-a': 'synthetic transcript' }),
    yt_thumb_cache_v1: JSON.stringify({ 'video-a': 'data:image/png;base64,c3ludGhldGlj' }),
    base44_access_token: 'must-never-be-read-or-copied',
    token: 'must-never-be-read-or-copied',
    unrelated_origin_key: 'must-never-be-copied',
  });
  return { storage, workspaceItems, expected: expectedWorkspace(workspaceItems) };
}

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

await check('copies a stable generation without changing localStorage', async () => {
  const { storage, expected } = createFixture();
  const before = storage.snapshot();
  const repository = new MemoryRepository();
  const result = await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    generationIdFactory: () => 'generation-stable',
  });
  assert.equal(result.state, MIGRATION_STATES.READY);
  assert.equal(result.counts.workspaceItems, 80);
  assert.equal(result.counts.videos, 2);
  assert.equal(result.counts.snapshots, 1);
  assert.equal(repository.meta.has('activeGeneration'), false);
  assert.equal(storage.snapshot(), before);
});

await check('never reads or stores authentication keys and excludes unknown keys', async () => {
  const { storage, expected } = createFixture();
  const repository = new MemoryRepository();
  await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    generationIdFactory: () => 'generation-secrets',
  });
  assert.equal(storage.readKeys.includes('base44_access_token'), false);
  assert.equal(storage.readKeys.includes('token'), false);
  const serialized = JSON.stringify([...repository.stores.values()].flatMap((store) => [...store.values()]));
  assert.equal(serialized.includes('must-never-be-read-or-copied'), false);
  assert.equal(serialized.includes('unrelated_origin_key'), false);
});

await check('resumes after a failed batch and activates only after verification', async () => {
  const { storage, expected } = createFixture();
  const repository = new MemoryRepository();
  repository.failWriteCall = 3;
  await assert.rejects(() => migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    batchSize: 10,
    activate: true,
    generationIdFactory: () => 'generation-resume',
  }), /synthetic transaction failure/);
  assert.equal(repository.meta.has('activeGeneration'), false);
  assert.equal((await repository.readMeta('migration')).state, MIGRATION_STATES.FAILED);

  repository.failWriteCall = null;
  const result = await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    batchSize: 10,
    activate: true,
    generationIdFactory: () => 'must-not-replace-generation',
  });
  assert.equal(result.state, MIGRATION_STATES.ACTIVE);
  assert.equal(result.generationId, 'generation-resume');
  assert.equal(repository.activationCount, 1);
});

await check('is idempotent after activation', async () => {
  const { storage, expected } = createFixture();
  const repository = new MemoryRepository();
  await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    activate: true,
    generationIdFactory: () => 'generation-idempotent',
  });
  const writeCalls = repository.writeCalls;
  const result = await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    activate: true,
  });
  assert.equal(result.idempotent, true);
  assert.equal(repository.writeCalls, writeCalls);
  assert.equal(repository.activationCount, 1);
});

await check('preserves duplicate video IDs and partial legacy snapshots', async () => {
  const { storage, expected } = createFixture();
  const repository = new MemoryRepository();
  const result = await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    generationIdFactory: () => 'generation-legacy',
  });
  const videos = await repository.listByGeneration(APP_DATA_STORES.VIDEOS, result.generationId);
  const snapshots = await repository.listByGeneration(APP_DATA_STORES.SNAPSHOTS, result.generationId);
  assert.equal(videos.length, 2);
  assert.notEqual(videos[0].id, videos[1].id);
  assert.equal(snapshots[0].schemaVersion, 'legacy');
  assert.deepEqual(snapshots[0].value.sentiment, [{ legacy: true }]);
});

await check('rejects corrupted Workspace data without activation', async () => {
  const storage = new MemoryStorage({ workspace_library_v1: '{invalid' });
  const repository = new MemoryRepository();
  await assert.rejects(() => migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: { recordCount: 80, idChecksum: 'x', payloadChecksum: 'y' },
  }), /Workspace payload is not valid JSON/);
  assert.equal(repository.meta.has('activeGeneration'), false);
});

await check('uses localStorage fallback when IndexedDB reads are unavailable', async () => {
  const storage = new MemoryStorage({ workspace_library_v1: '[{"id":"fallback"}]' });
  const facade = createStorageFacade({
    localStorageArea: storage,
    repository: { readMeta: async () => { throw new Error('IndexedDB unavailable'); } },
  });
  assert.equal(await facade.getRaw('workspace_library_v1'), '[{"id":"fallback"}]');
});

await check('classifies quota failure without changing localStorage or activating data', async () => {
  const { storage, expected } = createFixture();
  const before = storage.snapshot();
  const repository = new MemoryRepository();
  repository.failWriteCall = 1;
  repository.failWriteError = new DOMException('synthetic quota failure', 'QuotaExceededError');
  await assert.rejects(() => migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    activate: true,
    generationIdFactory: () => 'generation-quota',
  }), /synthetic quota failure/);
  assert.equal((await repository.readMeta('migration')).errorCode, 'quota-exceeded');
  assert.equal(repository.meta.has('activeGeneration'), false);
  assert.equal(storage.snapshot(), before);
});

await check('requires an explicitly ready generation before atomic activation', async () => {
  const { storage, expected } = createFixture();
  const repository = new MemoryRepository();
  await assert.rejects(() => activateReadyGeneration(repository), /No verified generation/);
  const ready = await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    generationIdFactory: () => 'generation-manual-cutover',
  });
  assert.equal(ready.state, MIGRATION_STATES.READY);
  const active = await activateReadyGeneration(repository);
  assert.equal(active.state, MIGRATION_STATES.ACTIVE);
  assert.equal(repository.activationCount, 1);
});

console.log(`\nIndexedDB migration QA passed: ${passed} checks`);
