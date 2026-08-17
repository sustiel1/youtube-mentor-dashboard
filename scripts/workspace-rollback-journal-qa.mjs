#!/usr/bin/env node
import assert from 'node:assert/strict';

import { APP_DATA_STORES } from '../src/lib/persistence/storageManifest.js';
import {
  canonicalSha256,
  checksumWorkspaceItemIds,
  checksumWorkspacePayloadsExcludingTopicAssignment,
  sha256Text,
  verifyWorkspaceRaw,
} from '../src/lib/persistence/storageIntegrity.js';
import { APPLICATION_STORAGE_MODES } from '../src/lib/persistence/storageMode.js';
import { createWorkspacePersistence } from '../src/lib/persistence/workspacePersistence.js';
import {
  buildWorkspaceRecoveryBundle,
  replayWorkspaceChangeJournal,
} from '../src/lib/persistence/workspaceChangeJournal.js';

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
    this.journal = new Map();
    this.failNextCommit = null;
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
    return structuredClone(this.sources.get(this.sourceKey(generationId, storageKey)) || null);
  }

  async listByGeneration(storeName, generationId) {
    const source = storeName === APP_DATA_STORES.WORKSPACE_ITEMS
      ? this.workspaceItems
      : this.snapshots;
    return [...source.values()]
      .filter((record) => record.generationId === generationId)
      .map((record) => structuredClone(record));
  }

  async readWorkspaceChangeJournal(operationId) {
    return structuredClone(this.journal.get(operationId) || null);
  }

  async listWorkspaceChangeJournal(anchorGenerationId) {
    return [...this.journal.values()]
      .filter((record) => record.anchorGenerationId === anchorGenerationId)
      .map((record) => structuredClone(record));
  }

  async commitWorkspaceMutation({ sourceEntry, workspaceItems, snapshots, journalEntry, activation }) {
    if (this.failNextCommit) {
      const error = this.failNextCommit;
      this.failNextCommit = null;
      throw error;
    }
    const active = this.meta.get('activeWorkspaceGeneration') || this.meta.get('activeGeneration');
    const anchor = this.meta.get('workspaceRecoveryAnchor');
    if (
      active?.generationId !== activation.expectedPreviousGenerationId
      || anchor?.generationId !== journalEntry.anchorGenerationId
      || anchor?.workspaceSourceHash !== journalEntry.anchorSourceHash
      || this.journal.has(journalEntry.operationId)
    ) {
      throw Object.assign(new Error('synthetic atomic guard rejected the commit'), {
        name: 'WorkspaceConcurrencyError',
      });
    }

    const nextSources = new Map(this.sources);
    const nextWorkspaceItems = new Map(this.workspaceItems);
    const nextSnapshots = new Map(this.snapshots);
    const nextJournal = new Map(this.journal);
    nextSources.set(this.sourceKey(sourceEntry.generationId, sourceEntry.storageKey), structuredClone(sourceEntry));
    workspaceItems.forEach((record) => nextWorkspaceItems.set(this.recordKey(record), structuredClone(record)));
    snapshots.forEach((record) => nextSnapshots.set(this.recordKey(record), structuredClone(record)));
    nextJournal.set(journalEntry.operationId, structuredClone(journalEntry));

    this.sources = nextSources;
    this.workspaceItems = nextWorkspaceItems;
    this.snapshots = nextSnapshots;
    this.journal = nextJournal;
    this.meta.set('activeWorkspaceGeneration', {
      key: 'activeWorkspaceGeneration',
      generationId: activation.generationId,
      sourceHash: activation.sourceHash,
      integrity: structuredClone(activation.integrity),
      counts: structuredClone(activation.counts),
      journalOperationId: journalEntry.operationId,
      state: 'active',
    });
  }
}

function baseItems() {
  return [
    { id: 'legacy', itemType: 'snippet', notes: 'original' },
    {
      id: 'partial-snapshot',
      itemType: 'structured-snapshot',
      structuredSnapshot: { version: 0, stocksTable: [], sentiment: [{ legacy: true }] },
    },
  ];
}

async function fixture() {
  const items = baseItems();
  const rawValue = JSON.stringify(items);
  const sourceHash = await sha256Text(rawValue);
  const generationId = 'generation-cutover';
  const storage = new MemoryStorage({
    [WORKSPACE_KEY]: rawValue,
    base44_access_token: 'must-never-be-read',
    unrelated_key: 'must-never-be-read',
  });
  const repository = new MemoryRepository();
  repository.sources.set(repository.sourceKey(generationId, WORKSPACE_KEY), {
    generationId,
    storageKey: WORKSPACE_KEY,
    rawValue,
    valueSha256: sourceHash,
  });
  const integrity = verifyWorkspaceRaw(rawValue).integrity;
  repository.meta.set('activeGeneration', {
    key: 'activeGeneration',
    generationId,
    sourceHash,
    integrity,
    state: 'active',
  });
  repository.meta.set('workspaceRecoveryAnchor', {
    key: 'workspaceRecoveryAnchor',
    generationId,
    workspaceSourceHash: sourceHash,
    integrity,
    evidenceHash: 'synthetic-evidence',
    state: 'anchored',
  });
  const persistence = createWorkspacePersistence({
    mode: APPLICATION_STORAGE_MODES.INDEXED_DB,
    localStorageArea: storage,
    repositoryFactory: async () => repository,
    events: NOOP_EVENTS,
  });
  return { items, rawValue, storage, repository, persistence };
}

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log(`  ok  ${name}`);
}

await check('create, update, archive, restore and delete form one verified recovery chain', async () => {
  const { rawValue, storage, repository, persistence } = await fixture();
  assert.equal((await persistence.saveItem({ id: 'test-item', notes: 'one' })).ok, true);
  assert.equal((await persistence.updateItem('test-item', { notes: 'two' })).ok, true);
  assert.equal((await persistence.archiveItems(['test-item'], true)).ok, true);
  assert.equal((await persistence.archiveItems(['test-item'], false)).ok, true);
  assert.equal((await persistence.saveItem({ id: 'survivor', notes: 'kept' })).ok, true);
  assert.equal((await persistence.deleteItem('test-item')).ok, true);

  const activeItems = await persistence.readItems();
  const replay = await replayWorkspaceChangeJournal({ repository, fallbackRaw: rawValue });
  assert.deepEqual(replay.items, activeItems);
  assert.equal(replay.operationCount, 6);
  assert.equal(replay.items.some((item) => item.id === 'test-item'), false);
  assert.equal(replay.items.some((item) => item.id === 'survivor'), true);
  assert.equal(replay.items.find((item) => item.id === 'partial-snapshot').structuredSnapshot.sentiment[0].legacy, true);
  assert.equal(storage.getItem(WORKSPACE_KEY), rawValue);
  assert.equal(storage.writeCount, 0);
  assert.equal(storage.readKeys.includes('base44_access_token'), false);
  assert.equal(storage.readKeys.includes('unrelated_key'), false);
  assert.equal([...repository.journal.values()].some((entry) => entry.tombstones.length === 1), true);
});

await check('replay and in-memory recovery export are deterministic and idempotent', async () => {
  const { rawValue, repository, persistence } = await fixture();
  await persistence.saveItem({ id: 'survivor', notes: 'kept' });
  await persistence.updateItem('legacy', { notes: 'updated' });
  const first = await replayWorkspaceChangeJournal({ repository, fallbackRaw: rawValue });
  const second = await replayWorkspaceChangeJournal({ repository, fallbackRaw: rawValue });
  assert.equal(await canonicalSha256(first), await canonicalSha256(second));
  const firstBundle = await buildWorkspaceRecoveryBundle({ repository, fallbackRaw: rawValue });
  const secondBundle = await buildWorkspaceRecoveryBundle({ repository, fallbackRaw: rawValue });
  assert.equal(firstBundle.bundleSha256, secondBundle.bundleSha256);
  assert.equal(firstBundle.bundle.finalSource.rawValue, first.rawValue);
});

await check('transaction abort and quota failure leave pointer, journal and fallback unchanged', async () => {
  const { rawValue, storage, repository, persistence } = await fixture();
  const beforePointer = await repository.readMeta('activeGeneration');
  repository.failNextCommit = new DOMException('synthetic abort', 'AbortError');
  const aborted = await persistence.saveItem({ id: 'aborted' });
  assert.equal(aborted.ok, false);
  assert.equal(repository.journal.size, 0);
  assert.deepEqual(await repository.readMeta('activeGeneration'), beforePointer);
  assert.equal(storage.getItem(WORKSPACE_KEY), rawValue);

  repository.failNextCommit = new DOMException('synthetic quota', 'QuotaExceededError');
  const quota = await persistence.saveItem({ id: 'quota' });
  assert.equal(quota.ok, false);
  assert.equal(quota.error.code, 'quota-exceeded');
  assert.equal(repository.journal.size, 0);
  assert.equal(storage.getItem(WORKSPACE_KEY), rawValue);
});

await check('stale concurrent commits cannot branch the recovery chain', async () => {
  const { repository, persistence } = await fixture();
  const first = await persistence.saveItem({ id: 'first' });
  assert.equal(first.ok, true);
  repository.meta.set('activeWorkspaceGeneration', {
    ...(await repository.readMeta('activeWorkspaceGeneration')),
    generationId: 'synthetic-concurrent-generation',
  });
  const stale = await persistence.saveItem({ id: 'stale' });
  assert.equal(stale.ok, false);
  assert.equal(repository.journal.size, 1);
});

await check('fallback drift and journal corruption stop replay without rewriting either store', async () => {
  const { rawValue, storage, repository, persistence } = await fixture();
  await persistence.saveItem({ id: 'safe' });
  await assert.rejects(
    () => replayWorkspaceChangeJournal({ repository, fallbackRaw: `${rawValue} ` }),
    /recovery anchor/,
  );
  const [entry] = repository.journal.values();
  repository.journal.set(entry.operationId, { ...entry, nextSourceHash: '0'.repeat(64) });
  await assert.rejects(
    () => replayWorkspaceChangeJournal({ repository, fallbackRaw: rawValue }),
    /integrity verification/,
  );
  assert.equal(storage.getItem(WORKSPACE_KEY), rawValue);
  assert.equal(storage.writeCount, 0);
});

await check('Workspace checksums remain exact across recovery', async () => {
  const { rawValue, repository, persistence } = await fixture();
  await persistence.saveItemsBulk([
    { id: 'a', notes: 'A' },
    { id: 'b', notes: 'B' },
  ]);
  const replay = await replayWorkspaceChangeJournal({ repository, fallbackRaw: rawValue });
  assert.equal(replay.integrity.recordCount, replay.items.length);
  assert.equal(replay.integrity.idChecksum, checksumWorkspaceItemIds(replay.items));
  assert.equal(
    replay.integrity.payloadChecksum,
    checksumWorkspacePayloadsExcludingTopicAssignment(replay.items),
  );
});

console.log(`\nWorkspace rollback journal QA passed: ${passed} checks`);
