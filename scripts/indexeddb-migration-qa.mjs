#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  APP_DATA_STORES,
  isVolatileCacheStorageKey,
} from '../src/lib/persistence/storageManifest.js';
import {
  calculateSourceIntegrity,
  checksumWorkspaceItemIds,
  checksumWorkspacePayloadsExcludingTopicAssignment,
} from '../src/lib/persistence/storageIntegrity.js';
import { createStorageFacade } from '../src/lib/persistence/storageFacade.js';
import {
  MIGRATION_STATES,
  activateReadyGeneration,
  calculateGenerationSourceIntegrityReadOnly,
  captureStableLocalStorage,
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
    this.meta.set('activeGeneration', { key: 'activeGeneration', ...structuredClone(payload), state: 'active' });
    this.meta.set('migration', { key: 'migration', ...structuredClone(payload), state: 'active' });
    this.meta.set('workspaceRecoveryAnchor', {
      key: 'workspaceRecoveryAnchor',
      state: 'anchored',
      generationId: payload.generationId,
      workspaceSourceHash: payload.workspaceSourceHash,
      integrity: structuredClone(payload.integrity),
      evidenceHash: payload.activationEvidence.evidenceHash,
    });
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

function activationEvidence(ready, current = ready) {
  const common = {
    workspaceSourceHash: ready.workspaceSourceHash,
    workspaceIntegrity: ready.integrity,
  };
  return {
    backup: {
      verified: true,
      encryptedFileSha256: 'a'.repeat(64),
      ...common,
    },
    preflight: {
      verified: true,
      stableReadCount: 2,
      storageMode: 'localStorage',
      activeGenerationAbsent: true,
      sourceHash: current.sourceHash,
      activationCriticalSourceHash: current.activationCriticalSourceHash,
      activationCriticalIntegrity: current.activationCriticalIntegrity,
      ...common,
    },
    integrity: {
      verified: true,
      generationId: ready.generationId,
      sourceHash: ready.sourceHash,
      activationCriticalSourceHash: ready.activationCriticalSourceHash,
      activationCriticalIntegrity: ready.activationCriticalIntegrity,
      ...common,
    },
  };
}

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

async function captureFixtureValues(overrides = {}) {
  const baseWorkspace = makeWorkspaceItems();
  return captureStableLocalStorage(new MemoryStorage({
    workspace_library_v1: JSON.stringify(baseWorkspace),
    yt_mentor_videos_v2: JSON.stringify([{ id: 'video-a', title: 'A' }]),
    'analysis:video-a': JSON.stringify({ summary: 'analysis-a' }),
    yt_mentor_transcript_cache_v1: JSON.stringify({ 'video-a': 'transcript-a' }),
    yt_thumb_cache_v1: JSON.stringify({
      'video-a': { quality: 'hqdefault', url: 'https://img.youtube.com/a.jpg', at: 1 },
    }),
    ...overrides,
  }));
}

await check('defines exactly one volatile cache key without wildcard matching', async () => {
  assert.equal(isVolatileCacheStorageKey('yt_thumb_cache_v1'), true);
  assert.equal(isVolatileCacheStorageKey('yt_thumb_cache_v1_copy'), false);
  assert.equal(isVolatileCacheStorageKey('yt_other_cache_v1'), false);
  assert.equal(isVolatileCacheStorageKey('prefix_yt_thumb_cache_v1'), false);
});

await check('identical full source passes both full and activation-critical integrity', async () => {
  const first = await captureFixtureValues();
  const second = await captureFixtureValues();
  assert.equal(first.sourceHash, second.sourceHash);
  assert.equal(first.activationCriticalSourceHash, second.activationCriticalSourceHash);
  assert.deepEqual(first.activationCriticalIntegrity, {
    keyCount: 5,
    volatileCacheKeys: ['yt_thumb_cache_v1'],
  });
});

await check('thumbnail cache value drift changes full hash but preserves critical integrity', async () => {
  const first = await captureFixtureValues();
  const second = await captureFixtureValues({
    yt_thumb_cache_v1: JSON.stringify({
      'video-a': { quality: 'sddefault', url: 'https://img.youtube.com/b.jpg', at: 2 },
    }),
  });
  assert.notEqual(first.sourceHash, second.sourceHash);
  assert.equal(first.activationCriticalSourceHash, second.activationCriticalSourceHash);
});

await check('cache-only drift activates with an explicit full-source warning', async () => {
  const { storage, expected } = createFixture();
  const repository = new MemoryRepository();
  const ready = await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    generationIdFactory: () => 'generation-cache-warning',
  });
  storage.setItem('yt_thumb_cache_v1', JSON.stringify({ 'video-a': 'changed-cache-only' }));
  const current = await captureStableLocalStorage(storage);
  assert.notEqual(current.sourceHash, ready.sourceHash);
  assert.equal(current.activationCriticalSourceHash, ready.activationCriticalSourceHash);
  await activateReadyGeneration(repository, {
    activationEvidence: activationEvidence(ready, current),
  });
  const active = await repository.readMeta('activeGeneration');
  assert.equal(active.activationEvidence.fullSourceMismatchWarning, true);
});

await check('business-source drift fails activation closed', async () => {
  const { storage, expected } = createFixture();
  const repository = new MemoryRepository();
  const ready = await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    generationIdFactory: () => 'generation-business-drift',
  });
  storage.setItem('analysis:video-a', JSON.stringify({ summary: 'changed-business-data' }));
  const current = await captureStableLocalStorage(storage);
  await assert.rejects(
    () => activateReadyGeneration(repository, {
      activationEvidence: activationEvidence(ready, current),
    }),
    /different generation/,
  );
  assert.equal(repository.activationCount, 0);
});

await check('adding or removing the exact cache key fails activation-critical identity parity', async () => {
  const withCache = await captureFixtureValues();
  const withoutCacheStorage = new MemoryStorage({
    workspace_library_v1: JSON.stringify(makeWorkspaceItems()),
    yt_mentor_videos_v2: JSON.stringify([{ id: 'video-a', title: 'A' }]),
    'analysis:video-a': JSON.stringify({ summary: 'analysis-a' }),
    yt_mentor_transcript_cache_v1: JSON.stringify({ 'video-a': 'transcript-a' }),
  });
  const withoutCache = await captureStableLocalStorage(withoutCacheStorage);
  assert.notEqual(withCache.activationCriticalSourceHash, withoutCache.activationCriticalSourceHash);
  assert.equal(withCache.activationCriticalIntegrity.keyCount, 5);
  assert.equal(withoutCache.activationCriticalIntegrity.keyCount, 4);
});

await check('one-byte business-source changes fail activation-critical parity', async () => {
  const baseline = await captureFixtureValues();
  for (const [key, value] of Object.entries({
    yt_mentor_videos_v2: JSON.stringify([{ id: 'video-a', title: 'B' }]),
    'analysis:video-a': JSON.stringify({ summary: 'analysis-b' }),
    yt_mentor_transcript_cache_v1: JSON.stringify({ 'video-a': 'transcript-b' }),
  })) {
    const changed = await captureFixtureValues({ [key]: value });
    assert.notEqual(baseline.activationCriticalSourceHash, changed.activationCriticalSourceHash, key);
  }
});

await check('Workspace count, content, archive and Snapshot drift fail critical parity', async () => {
  const baselineItems = makeWorkspaceItems();
  const baseline = await captureFixtureValues();
  const variants = [
    [...baselineItems, { id: 'workspace-added', itemType: 'knowledge-item' }],
    baselineItems.map((item, index) => index === 0 ? { ...item, payload: { changed: true } } : item),
    baselineItems.map((item, index) => index === 1 ? { ...item, archivedAt: '2026-08-18T00:00:00.000Z' } : item),
    baselineItems.map((item, index) => index === 2
      ? { ...item, structuredSnapshot: { ...item.structuredSnapshot, sentiment: [{ changed: true }] } }
      : item),
  ];
  for (const items of variants) {
    const changed = await captureFixtureValues({ workspace_library_v1: JSON.stringify(items) });
    assert.notEqual(baseline.activationCriticalSourceHash, changed.activationCriticalSourceHash);
  }
});

await check('sensitive keys stay excluded from both integrity results', async () => {
  const first = await captureStableLocalStorage(new MemoryStorage({
    workspace_library_v1: JSON.stringify(makeWorkspaceItems()),
    base44_access_token: 'synthetic-secret-a',
    token: 'synthetic-secret-b',
  }));
  const second = await captureStableLocalStorage(new MemoryStorage({
    workspace_library_v1: JSON.stringify(makeWorkspaceItems()),
    base44_access_token: 'different-secret-a',
    token: 'different-secret-b',
  }));
  assert.deepEqual(first.entries.map((entry) => entry.storageKey), ['workspace_library_v1']);
  assert.equal(first.sourceHash, second.sourceHash);
  assert.equal(first.activationCriticalSourceHash, second.activationCriticalSourceHash);
});

await check('similar cache names remain fully activation-critical', async () => {
  const common = [{ storageKey: 'workspace_library_v1', domain: 'workspace', rawValue: '[]' }];
  const first = await calculateSourceIntegrity([
    ...common,
    { storageKey: 'yt_thumb_cache_v1_copy', domain: 'media', rawValue: 'a' },
  ], { isVolatileCacheStorageKey });
  const second = await calculateSourceIntegrity([
    ...common,
    { storageKey: 'yt_thumb_cache_v1_copy', domain: 'media', rawValue: 'b' },
  ], { isVolatileCacheStorageKey });
  assert.notEqual(first.activationCriticalSourceHash, second.activationCriticalSourceHash);
});

await check('legacy READY critical integrity is deterministic and verification is read-only', async () => {
  const { storage, expected } = createFixture();
  const repository = new MemoryRepository();
  const ready = await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    generationIdFactory: () => 'generation-legacy-critical',
  });
  const legacyMeta = await repository.readMeta('migration');
  delete legacyMeta.activationCriticalSourceHash;
  delete legacyMeta.activationCriticalIntegrity;
  repository.meta.set('migration', structuredClone(legacyMeta));
  const before = JSON.stringify({
    meta: [...repository.meta],
    stores: [...repository.stores].map(([name, records]) => [name, [...records]]),
  });
  const first = await calculateGenerationSourceIntegrityReadOnly(repository, ready.generationId);
  const second = await calculateGenerationSourceIntegrityReadOnly(repository, ready.generationId);
  const after = JSON.stringify({
    meta: [...repository.meta],
    stores: [...repository.stores].map(([name, records]) => [name, [...records]]),
  });
  assert.deepEqual(first, second);
  assert.equal(first.fullSourceHash, ready.sourceHash);
  assert.equal(first.activationCriticalSourceHash, ready.activationCriticalSourceHash);
  assert.equal(after, before);
});

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
    generationIdFactory: () => 'must-not-replace-generation',
  });
  const active = await activateReadyGeneration(repository, {
    activationEvidence: activationEvidence(result),
  });
  assert.equal(active.state, MIGRATION_STATES.ACTIVE);
  assert.equal(result.generationId, 'generation-resume');
  assert.equal(repository.activationCount, 1);
});

await check('is idempotent after activation', async () => {
  const { storage, expected } = createFixture();
  const repository = new MemoryRepository();
  const ready = await migrateLocalStorageToIndexedDb({
    storage,
    repository,
    expectedWorkspaceIntegrity: expected,
    generationIdFactory: () => 'generation-idempotent',
  });
  await activateReadyGeneration(repository, {
    activationEvidence: activationEvidence(ready),
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
    generationIdFactory: () => 'generation-quota',
  }), /synthetic quota failure/);
  assert.equal((await repository.readMeta('migration')).errorCode, 'quota-exceeded');
  assert.equal(repository.meta.has('activeGeneration'), false);
  assert.equal(storage.snapshot(), before);
});

await check('requires ready state plus verified backup, preflight and integrity evidence', async () => {
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
  await assert.rejects(
    () => activateReadyGeneration(repository),
    /Verified backup, preflight and generation integrity evidence/,
  );
  const active = await activateReadyGeneration(repository, {
    activationEvidence: activationEvidence(ready),
  });
  assert.equal(active.state, MIGRATION_STATES.ACTIVE);
  assert.equal(repository.activationCount, 1);
});

console.log(`\nIndexedDB migration QA passed: ${passed} checks`);
