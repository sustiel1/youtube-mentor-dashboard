#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildWorkspaceDuplicatePreview, getWorkspaceItemIdentity } from '../src/utils/workspaceItemIdentity.js';
import { saveWorkspaceItem } from '../src/lib/workspaceLibraryStore.js';

class MemoryStorage {
  constructor(items = []) { this.raw = JSON.stringify(items); this.writes = 0; }
  getItem(key) { return key === 'workspace_library_v1' ? this.raw : null; }
  setItem(key, value) { if (key === 'workspace_library_v1') { this.raw = value; this.writes += 1; } }
  removeItem() { this.raw = null; }
}

const originalStorage = globalThis.localStorage;
const snapshot = (change = '+1%') => ({ videoId: 'video-1', schemaVersion: 1, savedAt: 'volatile', stocks: [{ symbol: 'AAA', change }], markets: [], sentiment: [] });
const item = (id, savedAt, change = '+1%') => ({ id, videoId: null, videoTitle: 'same title', itemType: 'structured-snapshot', sourceTab: 'Specialized', savedAt, structuredSnapshot: snapshot(change) });

const first = item('one', '2026-01-01');
const duplicate = item('two', '2026-02-01');
assert.equal(getWorkspaceItemIdentity(first).key, getWorkspaceItemIdentity(duplicate).key, 'volatile timestamps excluded');
assert.notEqual(getWorkspaceItemIdentity(first).contentHash, getWorkspaceItemIdentity(item('three', '2026-03-01', '+2%')).contentHash, 'meaningful data changes hash');
assert.equal(getWorkspaceItemIdentity({ ...first, itemType: 'insight' }), null, 'different legacy item type is not conflated');

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
const created = saveWorkspaceItem(first);
const already = saveWorkspaceItem(duplicate);
assert.equal(created.status, 'created');
assert.equal(already.status, 'already_exists');
assert.equal(JSON.parse(storage.raw).length, 1);
assert.equal(storage.writes, 1);

const changed = saveWorkspaceItem(item('three', '2026-03-01', '+2%'));
assert.equal(changed.status, 'created');
assert.equal(JSON.parse(storage.raw).length, 2);

const before = JSON.parse(storage.raw);
const preview = buildWorkspaceDuplicatePreview([first, duplicate, item('three', '2026-03-01', '+2%')]);
assert.equal(preview.exactDuplicates.length, 1);
assert.deepEqual(preview.exactDuplicates[0].proposedRemovalIds, ['two']);
assert.equal(preview.historicalVersions.length, 1);
assert.deepEqual(JSON.parse(storage.raw), before, 'preview is read-only');

const concurrentStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: concurrentStorage, configurable: true });
const concurrentResults = await Promise.all([Promise.resolve().then(() => saveWorkspaceItem(first)), Promise.resolve().then(() => saveWorkspaceItem(duplicate))]);
assert.deepEqual(concurrentResults.map(result => result.status), ['created', 'already_exists']);
assert.equal(JSON.parse(concurrentStorage.raw).length, 1);

const failingStorage = new MemoryStorage();
failingStorage.setItem = () => { throw new Error('write failed'); };
Object.defineProperty(globalThis, 'localStorage', { value: failingStorage, configurable: true });
assert.equal(saveWorkspaceItem(first).status, 'failed');
assert.deepEqual(JSON.parse(failingStorage.raw), [], 'failed persistence preserves existing records');

const legacy = { id: 'legacy', videoTitle: 'ישן', savedAt: '2020-01-01' };
assert.equal(getWorkspaceItemIdentity(legacy), null);
assert.deepEqual(buildWorkspaceDuplicatePreview([legacy]), { exactDuplicates: [], historicalVersions: [] });

if (originalStorage === undefined) delete globalThis.localStorage;
else Object.defineProperty(globalThis, 'localStorage', { value: originalStorage, configurable: true });
console.log('Workspace deduplication QA: 19 assertions passed');
