#!/usr/bin/env node
import assert from 'node:assert/strict';

import { APP_DATA_STORES } from '../src/lib/persistence/storageManifest.js';
import {
  APPLICATION_STORAGE_MODES,
  getApplicationStorageMode,
} from '../src/lib/persistence/storageMode.js';
import { createWorkspacePersistence } from '../src/lib/persistence/workspacePersistence.js';
import {
  checksumWorkspaceItemIds,
  checksumWorkspacePayloadsExcludingTopicAssignment,
  sha256Text,
} from '../src/lib/persistence/storageIntegrity.js';

const WORKSPACE_KEY = 'workspace_library_v1';
const NOOP_EVENTS = Object.freeze({
  publish: () => {},
  subscribe: () => () => {},
  close: () => {},
});

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
    this.readKeys = [];
    this.writeCount = 0;
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
    this.writeCount += 1;
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.writeCount += 1;
    this.values.delete(key);
  }
}

class MemoryRepository {
  constructor() {
    this.meta = new Map();
    this.sources = new Map();
    this.workspaceItems = new Map();
    this.snapshots = new Map();
    this.changeJournal = new Map();
    this.writeCount = 0;
    this.activationCount = 0;
    this.failWrite = null;
    this.corruptReadBack = false;
  }

  sourceKey(generationId, storageKey) {
    return JSON.stringify([generationId, storageKey]);
  }

  recordKey(record) {
    return JSON.stringify([record.generationId, record.id]);
  }

  async readMeta(key) {
    return structuredClone(this.meta.get(key) || null);
  }

  async readSourceEntry(generationId, storageKey) {
    const source = this.sources.get(this.sourceKey(generationId, storageKey));
    if (!source) return null;
    const copy = structuredClone(source);
    if (this.corruptReadBack) copy.rawValue = `${copy.rawValue} `;
    return copy;
  }

  async writeWorkspaceGeneration({ sourceEntry, workspaceItems, snapshots }) {
    this.writeCount += 1;
    if (this.failWrite) throw this.failWrite;

    const nextSources = new Map(this.sources);
    const nextWorkspaceItems = new Map(this.workspaceItems);
    const nextSnapshots = new Map(this.snapshots);
    nextSources.set(this.sourceKey(sourceEntry.generationId, sourceEntry.storageKey), structuredClone(sourceEntry));
    workspaceItems.forEach(record => nextWorkspaceItems.set(this.recordKey(record), structuredClone(record)));
    snapshots.forEach(record => nextSnapshots.set(this.recordKey(record), structuredClone(record)));
    this.sources = nextSources;
    this.workspaceItems = nextWorkspaceItems;
    this.snapshots = nextSnapshots;
  }

  async commitWorkspaceMutation({ sourceEntry, workspaceItems, snapshots, journalEntry, activation }) {
    this.writeCount += 1;
    if (this.failWrite) throw this.failWrite;
    const current = this.meta.get('activeWorkspaceGeneration') || this.meta.get('activeGeneration');
    const anchor = this.meta.get('workspaceRecoveryAnchor');
    if (
      current?.generationId !== activation.expectedPreviousGenerationId
      || anchor?.generationId !== journalEntry.anchorGenerationId
      || anchor?.workspaceSourceHash !== journalEntry.anchorSourceHash
    ) {
      throw Object.assign(new Error('synthetic concurrency failure'), { name: 'WorkspaceConcurrencyError' });
    }
    const nextSources = new Map(this.sources);
    const nextWorkspaceItems = new Map(this.workspaceItems);
    const nextSnapshots = new Map(this.snapshots);
    const nextJournal = new Map(this.changeJournal);
    if (nextJournal.has(journalEntry.operationId)) throw new Error('duplicate journal operation');
    nextSources.set(this.sourceKey(sourceEntry.generationId, sourceEntry.storageKey), structuredClone(sourceEntry));
    workspaceItems.forEach(record => nextWorkspaceItems.set(this.recordKey(record), structuredClone(record)));
    snapshots.forEach(record => nextSnapshots.set(this.recordKey(record), structuredClone(record)));
    nextJournal.set(journalEntry.operationId, structuredClone(journalEntry));
    this.sources = nextSources;
    this.workspaceItems = nextWorkspaceItems;
    this.snapshots = nextSnapshots;
    this.changeJournal = nextJournal;
    this.meta.set('activeWorkspaceGeneration', {
      key: 'activeWorkspaceGeneration',
      state: 'active',
      generationId: activation.generationId,
      sourceHash: activation.sourceHash,
      integrity: structuredClone(activation.integrity),
      counts: structuredClone(activation.counts),
      journalOperationId: journalEntry.operationId,
    });
    this.activationCount += 1;
  }

  async readWorkspaceChangeJournal(operationId) {
    return structuredClone(this.changeJournal.get(operationId) || null);
  }

  async listWorkspaceChangeJournal(anchorGenerationId) {
    return [...this.changeJournal.values()]
      .filter(record => record.anchorGenerationId === anchorGenerationId)
      .map(record => structuredClone(record));
  }

  async listByGeneration(storeName, generationId) {
    const source = storeName === APP_DATA_STORES.WORKSPACE_ITEMS
      ? this.workspaceItems
      : this.snapshots;
    return [...source.values()]
      .filter(record => record.generationId === generationId)
      .map(record => structuredClone(record));
  }

  async activateWorkspaceGeneration(payload) {
    this.activationCount += 1;
    const record = {
      key: 'activeWorkspaceGeneration',
      state: 'active',
      ...structuredClone(payload),
    };
    this.meta.set(record.key, record);
    return structuredClone(record);
  }
}

function workspaceItems(count = 3) {
  return Array.from({ length: count }, (_, index) => ({
    id: `workspace-${index}`,
    videoId: `video-${index}`,
    itemType: index === 1 ? 'structured-snapshot' : 'snippet',
    notes: `synthetic-${index}`,
    structuredSnapshot: index === 1
      ? { version: 0, stocksTable: [], sentiment: [{ legacy: true }] }
      : undefined,
  }));
}

function fixture(count = 3) {
  const items = workspaceItems(count);
  const storage = new MemoryStorage({
    [WORKSPACE_KEY]: JSON.stringify(items),
    workspace_topics_v1: '[]',
    base44_access_token: 'synthetic-secret-that-must-not-be-read',
    unrelated_key: 'synthetic-unknown-that-must-not-be-read',
  });
  globalThis.localStorage = storage;
  return { items, storage };
}

async function activateFixture(repository, storage) {
  const rawValue = storage.getItem(WORKSPACE_KEY);
  const sourceHash = await sha256Text(rawValue);
  const generationId = 'synthetic-activated-base';
  repository.sources.set(repository.sourceKey(generationId, WORKSPACE_KEY), {
    generationId,
    storageKey: WORKSPACE_KEY,
    rawValue,
    valueSha256: sourceHash,
  });
  repository.meta.set('activeGeneration', {
    key: 'activeGeneration',
    state: 'active',
    generationId,
    sourceHash,
  });
  repository.meta.set('workspaceRecoveryAnchor', {
    key: 'workspaceRecoveryAnchor',
    state: 'anchored',
    generationId,
    workspaceSourceHash: sourceHash,
    integrity: {
      recordCount: JSON.parse(rawValue).length,
      idChecksum: checksumWorkspaceItemIds(JSON.parse(rawValue)),
      payloadChecksum: checksumWorkspacePayloadsExcludingTopicAssignment(JSON.parse(rawValue)),
    },
  });
}

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log(`  ok  ${name}`);
}

await check('feature mode is disabled unless indexedDB is explicit', async () => {
  assert.equal(getApplicationStorageMode({ env: {} }), APPLICATION_STORAGE_MODES.LOCAL_STORAGE);
  assert.equal(getApplicationStorageMode({ env: { VITE_YTMDB_STORAGE_MODE: 'indexedDB' } }), APPLICATION_STORAGE_MODES.INDEXED_DB);
  assert.equal(getApplicationStorageMode({ env: { VITE_YTMDB_STORAGE_MODE: 'unexpected' } }), APPLICATION_STORAGE_MODES.LOCAL_STORAGE);
});

await check('disabled mode preserves synchronous localStorage behavior and never opens IndexedDB', async () => {
  const { storage } = fixture();
  let repositoryOpened = false;
  const events = [];
  const persistence = createWorkspacePersistence({
    localStorageArea: storage,
    repositoryFactory: async () => {
      repositoryOpened = true;
      throw new Error('must not open');
    },
    events: {
      publish: type => events.push(type),
      subscribe: () => () => {},
      close: () => {},
    },
  });
  const result = persistence.saveItem({ id: 'local-only', notes: 'local' });
  assert.equal(result.ok, true);
  assert.equal(result.persistedItems.length, 4);
  assert.equal(repositoryOpened, false);
  assert.equal(JSON.parse(storage.getItem(WORKSPACE_KEY)).length, 4);
  assert.deepEqual(events, ['record-updated']);
});

await check('enabled reads fall back to localStorage without mutating it', async () => {
  const { storage } = fixture();
  const before = storage.getItem(WORKSPACE_KEY);
  const serializedItems = JSON.parse(before);
  const repository = new MemoryRepository();
  const persistence = createWorkspacePersistence({
    mode: APPLICATION_STORAGE_MODES.INDEXED_DB,
    localStorageArea: storage,
    repositoryFactory: async () => repository,
    events: NOOP_EVENTS,
  });
  assert.deepEqual(await persistence.readItems(), serializedItems);
  assert.equal(storage.getItem(WORKSPACE_KEY), before);
  assert.equal(storage.writeCount, 0);
});

await check('enabled writes require a separately verified activation', async () => {
  const { storage } = fixture();
  const repository = new MemoryRepository();
  const persistence = createWorkspacePersistence({
    mode: APPLICATION_STORAGE_MODES.INDEXED_DB,
    localStorageArea: storage,
    repositoryFactory: async () => repository,
    events: NOOP_EVENTS,
  });
  const result = await persistence.saveItem({ id: 'must-not-cut-over' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'indexeddb-activation-required');
  assert.equal(repository.changeJournal.size, 0);
});

await check('enabled write verifies and activates one immutable Workspace generation', async () => {
  const { items, storage } = fixture();
  const before = storage.getItem(WORKSPACE_KEY);
  const repository = new MemoryRepository();
  await activateFixture(repository, storage);
  const events = [];
  const persistence = createWorkspacePersistence({
    mode: APPLICATION_STORAGE_MODES.INDEXED_DB,
    localStorageArea: storage,
    repositoryFactory: async () => repository,
    events: {
      publish: (type, metadata) => events.push({ type, metadata }),
      subscribe: () => () => {},
      close: () => {},
    },
  });
  const result = await persistence.saveItem({ id: 'indexed-item', notes: 'indexed' });
  assert.equal(result.ok, true);
  assert.equal(result.storage, 'indexedDB');
  assert.equal(result.persistedItems.length, items.length + 1);
  assert.equal(storage.getItem(WORKSPACE_KEY), before);
  assert.equal(storage.writeCount, 0);
  const active = await repository.readMeta('activeWorkspaceGeneration');
  assert.equal(active.state, 'active');
  assert.equal(repository.activationCount, 1);
  assert.equal((await repository.listByGeneration(APP_DATA_STORES.WORKSPACE_ITEMS, active.generationId)).length, 4);
  assert.equal((await repository.listByGeneration(APP_DATA_STORES.SNAPSHOTS, active.generationId)).length, 1);
  assert.deepEqual(events.map(event => event.type), ['record-updated']);

  const readBack = await persistence.readItems();
  assert.equal(checksumWorkspaceItemIds(readBack), checksumWorkspaceItemIds(result.persistedItems));
  assert.equal(
    checksumWorkspacePayloadsExcludingTopicAssignment(readBack),
    checksumWorkspacePayloadsExcludingTopicAssignment(result.persistedItems),
  );
});

await check('subsequent writes read IndexedDB first and leave the fallback untouched', async () => {
  const { storage } = fixture();
  const fallback = storage.getItem(WORKSPACE_KEY);
  const repository = new MemoryRepository();
  await activateFixture(repository, storage);
  const persistence = createWorkspacePersistence({
    mode: APPLICATION_STORAGE_MODES.INDEXED_DB,
    localStorageArea: storage,
    repositoryFactory: async () => repository,
    events: NOOP_EVENTS,
  });
  const first = await persistence.saveItem({ id: 'first-indexed', notes: 'one' });
  const second = await persistence.updateItem('first-indexed', { notes: 'two' });
  assert.equal(second.ok, true);
  assert.notEqual(second.generationId, first.generationId);
  assert.equal(second.persistedItems.find(item => item.id === 'first-indexed').notes, 'two');
  assert.equal(storage.getItem(WORKSPACE_KEY), fallback);
});

await check('transaction and quota failures preserve the previous pointer and fallback', async () => {
  const { storage } = fixture();
  const fallback = storage.getItem(WORKSPACE_KEY);
  const repository = new MemoryRepository();
  await activateFixture(repository, storage);
  const persistence = createWorkspacePersistence({
    mode: APPLICATION_STORAGE_MODES.INDEXED_DB,
    localStorageArea: storage,
    repositoryFactory: async () => repository,
    events: NOOP_EVENTS,
  });
  const first = await persistence.saveItem({ id: 'stable', notes: 'stable' });
  const activeBefore = await repository.readMeta('activeWorkspaceGeneration');
  assert.equal(activeBefore.generationId, first.generationId);

  repository.failWrite = new DOMException('synthetic quota', 'QuotaExceededError');
  const failed = await persistence.saveItem({ id: 'must-not-activate', notes: 'failure' });
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, 'quota-exceeded');
  assert.equal((await repository.readMeta('activeWorkspaceGeneration')).generationId, activeBefore.generationId);
  assert.equal(storage.getItem(WORKSPACE_KEY), fallback);
  assert.equal((await persistence.readItems()).some(item => item.id === 'must-not-activate'), false);
});

await check('corrupt read-back is reported while the atomic journal remains recoverable', async () => {
  const { storage } = fixture();
  const repository = new MemoryRepository();
  await activateFixture(repository, storage);
  repository.corruptReadBack = true;
  const persistence = createWorkspacePersistence({
    mode: APPLICATION_STORAGE_MODES.INDEXED_DB,
    localStorageArea: storage,
    repositoryFactory: async () => repository,
    events: NOOP_EVENTS,
  });
  const failed = await persistence.saveItem({ id: 'corrupt', notes: 'corrupt' });
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, 'indexeddb-verification-failed');
  const active = await repository.readMeta('activeWorkspaceGeneration');
  assert.equal(active.state, 'active');
  assert.equal(repository.changeJournal.has(active.journalOperationId), true);
});

await check('blocked or unavailable IndexedDB reads use the valid local fallback', async () => {
  const { storage } = fixture();
  const serializedItems = JSON.parse(storage.getItem(WORKSPACE_KEY));
  const persistence = createWorkspacePersistence({
    mode: APPLICATION_STORAGE_MODES.INDEXED_DB,
    localStorageArea: storage,
    repositoryFactory: async () => {
      throw Object.assign(new Error('synthetic blocked database'), { name: 'InvalidStateError' });
    },
    events: NOOP_EVENTS,
  });
  assert.deepEqual(await persistence.readItems(), serializedItems);
  const failedWrite = await persistence.saveItem({ id: 'blocked-write' });
  assert.equal(failedWrite.ok, false);
  assert.equal(failedWrite.error.code, 'indexeddb-unavailable');
  assert.equal(JSON.parse(storage.getItem(WORKSPACE_KEY)).length, serializedItems.length);
});

await check('the integration reads no authentication or unknown keys', async () => {
  const { storage } = fixture();
  const repository = new MemoryRepository();
  await activateFixture(repository, storage);
  const persistence = createWorkspacePersistence({
    mode: APPLICATION_STORAGE_MODES.INDEXED_DB,
    localStorageArea: storage,
    repositoryFactory: async () => repository,
    events: NOOP_EVENTS,
  });
  await persistence.saveItem({ id: 'safe-only', notes: 'safe' });
  assert.equal(storage.readKeys.includes('base44_access_token'), false);
  assert.equal(storage.readKeys.includes('unrelated_key'), false);
  const persisted = JSON.stringify([
    ...repository.sources.values(),
    ...repository.workspaceItems.values(),
    ...repository.snapshots.values(),
  ]);
  assert.equal(persisted.includes('synthetic-secret-that-must-not-be-read'), false);
  assert.equal(persisted.includes('synthetic-unknown-that-must-not-be-read'), false);
});

console.log(`\nWorkspace IndexedDB integration QA passed: ${passed} checks`);
