#!/usr/bin/env node
/**
 * Isolated Phase 0 QA for verified Workspace persistence.
 * Uses in-memory storage doubles only; never reads or writes browser storage.
 *
 * Run:
 *   node --import ./scripts/register-src-aliases.mjs scripts/workspace-persistence-qa.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.setFailure = null;
    this.mismatchReads = 0;
  }

  getItem(key) {
    const value = this.values.has(key) ? this.values.get(key) : null;
    if (this.mismatchReads > 0) {
      this.mismatchReads--;
      return value === null ? '[] ' : `${value} `;
    }
    return value;
  }

  setItem(key, value) {
    if (this.setFailure) {
      const error = this.setFailure;
      this.setFailure = null;
      throw error;
    }
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;

const {
  WORKSPACE_PERSISTENCE_ERROR_CODES,
  findWorkspaceItemByContentHash,
  getWorkspaceItems,
  getWorkspacePersistenceErrorMessage,
  persistWorkspaceItems,
  saveWorkspaceItemsBulk,
  saveWorkspaceItem,
} = await import('../src/lib/workspaceLibraryStore.js');

const ITEMS_KEY = 'workspace_library_v1';
let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (error) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${error.message}`);
    failed++;
  }
}

function reset(items = []) {
  storage.values = new Map([[ITEMS_KEY, JSON.stringify(items)]]);
  storage.setFailure = null;
  storage.mismatchReads = 0;
}

function captureSafeDiagnostics(fn) {
  const original = console.error;
  const captured = [];
  console.error = (...args) => captured.push(args);
  try {
    return { result: fn(), captured };
  } finally {
    console.error = original;
  }
}

check('successful save is verified and returns the persisted item', () => {
  reset([{ id: 'legacy-1', videoTitle: 'ישן' }]);
  const result = saveWorkspaceItem({ id: 'new-1', videoId: null, videoTitle: 'חדש' });
  assert.equal(result.ok, true);
  assert.equal(result.item.id, 'new-1');
  assert.equal(result.persistedItems.length, 2);
  assert.equal(getWorkspaceItems().some(item => item.id === 'new-1'), true);
});

check('serialization failure returns a structured failure and preserves JSON', () => {
  reset([{ id: 'legacy-1' }]);
  const before = storage.getItem(ITEMS_KEY);
  const cyclic = { id: 'cyclic' };
  cyclic.self = cyclic;
  const { result } = captureSafeDiagnostics(() => saveWorkspaceItem(cyclic));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, WORKSPACE_PERSISTENCE_ERROR_CODES.SERIALIZATION_FAILED);
  assert.equal(storage.getItem(ITEMS_KEY), before);
});

check('generic setItem failure returns failure, keeps count and preserves JSON', () => {
  reset([{ id: 'legacy-1' }]);
  const before = storage.getItem(ITEMS_KEY);
  storage.setFailure = Object.assign(new Error('private value must not be logged'), { name: 'UnknownError', code: 9 });
  const { result, captured } = captureSafeDiagnostics(() => saveWorkspaceItem({ id: 'new-1' }));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, WORKSPACE_PERSISTENCE_ERROR_CODES.STORAGE_WRITE_FAILED);
  assert.equal(storage.getItem(ITEMS_KEY), before);
  assert.equal(getWorkspaceItems().length, 1);
  assert.match(getWorkspacePersistenceErrorMessage(result), /השמירה ל-Workspace נכשלה/);
  assert.equal(JSON.stringify(captured).includes('private value'), false);
});

check('QuotaExceededError produces the quota-specific Hebrew message', () => {
  reset([{ id: 'legacy-1' }]);
  const quotaError = Object.assign(new Error('quota'), { name: 'QuotaExceededError', code: 22 });
  storage.setFailure = quotaError;
  const { result } = captureSafeDiagnostics(() => saveWorkspaceItem({ id: 'new-1' }));
  assert.equal(result.error.code, WORKSPACE_PERSISTENCE_ERROR_CODES.QUOTA_EXCEEDED);
  assert.match(getWorkspacePersistenceErrorMessage(result), /אין מספיק מקום/);
  assert.equal(getWorkspaceItems().length, 1);
});

check('read-after-write mismatch is rejected and rolled back exactly', () => {
  reset([{ id: 'legacy-1', notes: 'keep' }]);
  const before = storage.getItem(ITEMS_KEY);
  storage.mismatchReads = 1;
  const { result } = captureSafeDiagnostics(() => persistWorkspaceItems(
    [{ id: 'new-1' }],
    { intendedItemIds: ['new-1'], previousRaw: before, storage },
  ));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, WORKSPACE_PERSISTENCE_ERROR_CODES.READ_BACK_MISMATCH);
  assert.equal(result.error.rollbackVerified, true);
  assert.equal(storage.getItem(ITEMS_KEY), before);
});

check('missing intended item after read-back is rejected and rolled back', () => {
  reset([{ id: 'legacy-1' }]);
  const before = storage.getItem(ITEMS_KEY);
  const { result } = captureSafeDiagnostics(() => persistWorkspaceItems(
    [{ id: 'other-item' }],
    { intendedItemIds: ['expected-item'], previousRaw: before, storage },
  ));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, WORKSPACE_PERSISTENCE_ERROR_CODES.INTENDED_ITEM_MISSING);
  assert.equal(storage.getItem(ITEMS_KEY), before);
});

check('legacy non-Snapshot records remain readable and video callers still upsert', () => {
  reset([{ id: 'legacy-video', videoId: 'video-1', notes: 'old', flags: { isFavorite: true } }]);
  const result = saveWorkspaceItem({ videoId: 'video-1', notes: 'updated' });
  assert.equal(result.ok, true);
  assert.equal(result.persistedItems.length, 1);
  assert.equal(result.item.id, 'legacy-video');
  assert.equal(result.item.notes, 'updated');
  assert.deepEqual(result.item.flags, { isFavorite: true });
});

check('existing exact-hash duplicate lookup remains compatible', () => {
  reset([{ id: 'hash-1', contentHash: 'sha256:same' }]);
  assert.equal(findWorkspaceItemByContentHash('sha256:same')?.id, 'hash-1');
});

check('bulk saves are one verified write and remain atomic on failure', () => {
  reset([{ id: 'legacy-1' }]);
  const success = saveWorkspaceItemsBulk([{ id: 'bulk-1' }, { id: 'bulk-2' }]);
  assert.equal(success.ok, true);
  assert.equal(success.saved, 2);
  assert.equal(success.persistedItems.length, 3);

  const beforeFailure = storage.getItem(ITEMS_KEY);
  storage.setFailure = Object.assign(new Error('write failed'), { name: 'UnknownError' });
  const { result: failure } = captureSafeDiagnostics(() => saveWorkspaceItemsBulk([{ id: 'bulk-3' }]));
  assert.equal(failure.ok, false);
  assert.equal(failure.saved, 0);
  assert.equal(storage.getItem(ITEMS_KEY), beforeFailure);
  assert.equal(getWorkspaceItems().length, 3);
});

check('hook state updates only after a verified write result', () => {
  const hook = readFileSync(new URL('../src/hooks/useWorkspaceLibrary.js', import.meta.url), 'utf8');
  assert.match(hook, /resolved\?\.ok && Array\.isArray\(resolved\.persistedItems\)/);
  assert.equal(hook.includes('setItems(getWorkspaceItems());'), false);
});

check('save UI gates success and secondary metadata on verified persistence', () => {
  const dialog = readFileSync(new URL('../src/components/workspace/SaveToWorkspaceDialog.jsx', import.meta.url), 'utf8');
  const save = dialog.indexOf('const saveResult = await saveItem');
  const failureGate = dialog.indexOf('if (!saveResult.ok)', save);
  const videoMetadata = dialog.indexOf('updateLocalVideo(videoId', save);
  const knowledgeMetadata = dialog.indexOf('updateKnowledgeItemsForVideo(videoId', save);
  const onSaved = dialog.indexOf('onSaved?.(', save);
  assert.ok(save >= 0 && failureGate > save);
  assert.ok(videoMetadata > failureGate && knowledgeMetadata > failureGate && onSaved > failureGate);
});

check('Snapshot UI gates success toast and retains duplicate-click protection', () => {
  const panel = readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
  const handler = panel.indexOf('const handleSaveStructuredSnapshot');
  const inFlightGuard = panel.indexOf('if (structuredSnapshotSaveInFlightRef.current) return', handler);
  const save = panel.indexOf('const saveResult = await persistWorkspaceItem', handler);
  const failureGate = panel.indexOf('if (!saveResult.ok)', save);
  const successToast = panel.indexOf("toast.success('תמונת מצב נשמרה ל-Workspace Library')", save);
  const reset = panel.indexOf('structuredSnapshotSaveInFlightRef.current = false', save);
  assert.ok(handler >= 0 && inFlightGuard > handler);
  assert.ok(save > inFlightGuard && failureGate > save && successToast > failureGate);
  assert.ok(reset > successToast);
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
