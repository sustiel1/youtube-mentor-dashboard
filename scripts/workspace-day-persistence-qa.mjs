#!/usr/bin/env node
/**
 * Logic-only QA for the Workspace Day persistence layer (Stage 1).
 * No browser / dev-server needed — an in-memory Storage shim stands in for
 * localStorage, and "page reload" is simulated by rehydrating a fresh shim
 * from the persisted raw string after every mutation.
 *
 * Run:
 *   node --import ./scripts/register-src-aliases.mjs scripts/workspace-day-persistence-qa.mjs
 */
import assert from 'node:assert/strict';

import { createWorkspaceDayPersistence } from '../src/lib/persistence/workspaceDayPersistence.js';
import {
  WORKSPACE_DAYS_STORAGE_KEY,
  WORKSPACE_DAY_PERSISTENCE_ERROR_CODES as CODES,
  getWorkspaceDays,
} from '../src/lib/workspaceDayStore.js';
import {
  buildDayCloseSnapshot,
  resolveWorkspaceDayCategory,
} from '../src/lib/workspaceDayModel.js';

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${error.message}`);
    failed += 1;
  }
}

class MemoryStorage {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries));
  }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
}

/** Simulate a full page reload: rebuild storage from its persisted raw string. */
function reload(storage) {
  const raw = storage.getItem(WORKSPACE_DAYS_STORAGE_KEY);
  const fresh = new MemoryStorage();
  if (raw != null) fresh.setItem(WORKSPACE_DAYS_STORAGE_KEY, raw);
  return fresh;
}

function makeItem(id, {
  videoId = 'vidA',
  itemType = 'insight',
  text = 'base-payload',
  topicId = null,
  topicName = '',
  provenance = null,
  sourceTab = 'insights',
} = {}) {
  return {
    id,
    itemType,
    sourceVideoId: videoId,
    sourceTab,
    identityPayload: { text },
    topicId,
    topicName,
    ...(provenance ? { provenance } : {}),
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

const FIXED_NOW = new Date('2026-08-28T09:00:00.000Z');

// ── resolveWorkspaceDayCategory — PURE priority order (#11) ──────────────────
check('resolveWorkspaceDayCategory: virtual-taxonomy stocks → stocks', () => {
  assert.equal(resolveWorkspaceDayCategory({ topicId: 'wt-stocks' }, null), 'stocks');
});
check('resolveWorkspaceDayCategory: virtual-taxonomy AI → ai (first-class)', () => {
  assert.equal(resolveWorkspaceDayCategory({ topicId: 'wt-ai-claudecode' }, null), 'ai');
});
check('resolveWorkspaceDayCategory: gem contentType macro wins', () => {
  assert.equal(
    resolveWorkspaceDayCategory({}, { metadata: { contentClassification: { contentType: 'macro' } } }),
    'macro',
  );
});
check('resolveWorkspaceDayCategory: political ONLY when US-politics ∩ markets', () => {
  const marketVideo = { metadata: { contentClassification: { contentType: 'marketBrief' } } };
  assert.equal(resolveWorkspaceDayCategory({ topicName: 'פוליטיקה' }, marketVideo), 'political');
  // political topic but no market classification → NOT political (Obsidian-only coexistence)
  assert.equal(resolveWorkspaceDayCategory({ topicName: 'פוליטיקה' }, null), 'general');
});
check('resolveWorkspaceDayCategory: fallback general', () => {
  assert.equal(resolveWorkspaceDayCategory(null, null), 'general');
});

// ── 1. create → attach → close → reopen round-trip + reload after each op ────
check('round-trip: create/attach/close/reopen survives reload at every step', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });

  const created = p.createDay({ now: FIXED_NOW, idSuffix: 'rt1' });
  assert.equal(created.ok, true);
  assert.equal(created.status, 'created');
  assert.equal(created.day.status, 'open');
  assert.equal(created.day.entryMode, 'manual');
  assert.equal(created.day.reopenCount, 0);
  const dayId = created.day.id;

  let afterReload = getWorkspaceDays(reload(storage));
  assert.equal(afterReload.length, 1);
  assert.equal(afterReload[0].id, dayId);
  assert.equal(afterReload[0].status, 'open');

  const itemA = makeItem('wl-A', { topicId: 'wt-stocks', text: 'A' });
  const attachA = p.attachItem(dayId, { item: itemA, now: FIXED_NOW });
  assert.equal(attachA.ok, true);
  assert.equal(attachA.status, 'attached');
  assert.equal(attachA.meta.member.frozen, false);
  assert.equal(attachA.meta.member.category, 'stocks');

  const itemB = makeItem('wl-B', { topicId: 'wt-ai-claudecode', text: 'B' });
  assert.equal(p.attachItem(dayId, { item: itemB, now: FIXED_NOW }).ok, true);

  afterReload = getWorkspaceDays(reload(storage));
  assert.equal(afterReload[0].members.length, 2);
  assert.equal(afterReload[0].members.every((m) => m.frozen === false), true);

  const closed = p.closeDay(dayId, {
    liveItemsById: { 'wl-A': itemA, 'wl-B': itemB },
    now: FIXED_NOW,
  });
  assert.equal(closed.ok, true);
  assert.equal(closed.day.status, 'closed');
  assert.ok(closed.day.closedAt, 'closedAt set');
  assert.equal(closed.day.members.every((m) => m.frozen === true), true);
  assert.equal(closed.day.members.every((m) => m.contentSnapshot != null), true);
  assert.ok(closed.day.closeSnapshot, 'closeSnapshot built');
  assert.equal(closed.day.closeSnapshot.frozenCount, 2);
  assert.equal(closed.day.closeSnapshot.obsidianHandoff.status, 'stub');

  afterReload = getWorkspaceDays(reload(storage));
  assert.equal(afterReload[0].status, 'closed');
  assert.equal(afterReload[0].members.every((m) => m.frozen === true), true);

  const reopened = p.reopenDay(dayId, { now: FIXED_NOW });
  assert.equal(reopened.ok, true);
  assert.equal(reopened.day.status, 'open');
  assert.equal(reopened.day.reopenCount, 1);
  assert.ok(reopened.day.reopenedAt, 'reopenedAt set');
  assert.equal(reopened.day.closedAt, null);
  assert.equal(reopened.day.members.every((m) => m.frozen === true), true, 'existing members stay frozen after reopen');

  afterReload = getWorkspaceDays(reload(storage));
  assert.equal(afterReload[0].status, 'open');
  assert.equal(afterReload[0].reopenCount, 1);
});

// ── 2. single-open-day invariant ───────────────────────────────────────────
check('single-open invariant: second open create fails cleanly, nothing written', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });
  const first = p.createDay({ now: FIXED_NOW, idSuffix: 'inv1' });
  assert.equal(first.ok, true);
  const rawBefore = storage.getItem(WORKSPACE_DAYS_STORAGE_KEY);

  const second = p.createDay({ now: FIXED_NOW, idSuffix: 'inv2' });
  assert.equal(second.ok, false);
  assert.equal(second.error.code, CODES.OPEN_DAY_EXISTS);
  assert.equal(second.error.rollbackVerified, true);
  assert.equal(second.openDayId, first.day.id);

  assert.equal(storage.getItem(WORKSPACE_DAYS_STORAGE_KEY), rawBefore, 'storage unchanged after failed create');
  const days = getWorkspaceDays(reload(storage));
  assert.equal(days.length, 1);
  assert.equal(days[0].status, 'open');
});

// ── 3. dedup within a day ──────────────────────────────────────────────────
check('dedup within a day: same item attached twice → one member', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });
  const dayId = p.createDay({ now: FIXED_NOW, idSuffix: 'dd1' }).day.id;
  const itemA = makeItem('wl-A', { text: 'dupe' });

  assert.equal(p.attachItem(dayId, { item: itemA, now: FIXED_NOW }).status, 'attached');
  const second = p.attachItem(dayId, { item: itemA, now: FIXED_NOW });
  assert.equal(second.ok, true);
  assert.equal(second.status, 'already_attached');
  assert.equal(second.meta.deduped, true);

  // a different record id but identical identity also collapses
  const itemAClone = makeItem('wl-A-clone', { text: 'dupe' });
  assert.equal(p.attachItem(dayId, { item: itemAClone, now: FIXED_NOW }).status, 'already_attached');

  const day = getWorkspaceDays(reload(storage))[0];
  assert.equal(day.members.length, 1, 'exactly one member after duplicate attaches');
});

// ── 4. cross-day attach + "attached to N days" helper ──────────────────────
check('cross-day membership: same item in two days + helper reports N days', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });
  const itemA = makeItem('wl-A', { text: 'shared' });

  const day1 = p.createDay({ now: FIXED_NOW, idSuffix: 'xd1' }).day.id;
  assert.equal(p.attachItem(day1, { item: itemA, now: FIXED_NOW }).status, 'attached');
  assert.equal(p.closeDay(day1, { liveItemsById: { 'wl-A': itemA }, now: FIXED_NOW }).ok, true);

  const day2 = p.createDay({ now: FIXED_NOW, idSuffix: 'xd2' }).day.id;
  const secondAttach = p.attachItem(day2, { item: itemA, now: FIXED_NOW });
  assert.equal(secondAttach.ok, true);
  assert.equal(secondAttach.status, 'attached', 'second attachment is NOT blocked');

  const dayIds = p.getDayIdsForItem(itemA);
  assert.equal(dayIds.length, 2);
  assert.deepEqual([...dayIds].sort(), [day1, day2].sort());

  // survives reload
  const p2 = createWorkspaceDayPersistence({ localStorageArea: reload(storage) });
  assert.equal(p2.getDayIdsForItem(itemA).length, 2);
});

// ── 5. close atomicity + reproducible checksum ─────────────────────────────
check('close atomicity: all members frozen + snapshot present + checksum reproducible', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });
  const dayId = p.createDay({ now: FIXED_NOW, idSuffix: 'ca1' }).day.id;
  const itemA = makeItem('wl-A', { topicId: 'wt-stocks', text: 'A' });
  const itemB = makeItem('wl-B', { topicId: 'wt-macro', text: 'B' });
  p.attachItem(dayId, { item: itemA, now: FIXED_NOW });
  p.attachItem(dayId, { item: itemB, now: FIXED_NOW });

  const closed = p.closeDay(dayId, { liveItemsById: { 'wl-A': itemA, 'wl-B': itemB }, now: FIXED_NOW });
  const snap = closed.day.closeSnapshot;
  assert.equal(snap.memberCount, 2);
  assert.equal(snap.frozenCount, 2);
  assert.equal(
    Object.values(snap.categoryBreakdown).reduce((a, b) => a + b, 0),
    2,
    'category breakdown counts sum to memberCount',
  );
  assert.equal(snap.checksumAlgorithm, 'fnv1a');
  assert.match(snap.checksum, /^[0-9a-f]{8}$/);

  // rebuild the snapshot from the RELOADED day's frozen members → same checksum
  const reloadedDay = getWorkspaceDays(reload(storage))[0];
  const rebuilt = buildDayCloseSnapshot(reloadedDay, reloadedDay.members, { now: FIXED_NOW });
  assert.equal(rebuilt.checksum, snap.checksum, 'checksum is reproducible from persisted members');
});

// ── 6. reopen audit + post-reopen members are live ────────────────────────
check('reopen: reopenCount increments, old members frozen, new members live', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });
  const dayId = p.createDay({ now: FIXED_NOW, idSuffix: 'ro1' }).day.id;
  const itemA = makeItem('wl-A', { text: 'A' });
  p.attachItem(dayId, { item: itemA, now: FIXED_NOW });
  p.closeDay(dayId, { liveItemsById: { 'wl-A': itemA }, now: FIXED_NOW });
  p.reopenDay(dayId, { now: FIXED_NOW });

  const itemB = makeItem('wl-B', { text: 'B' });
  const attachB = p.attachItem(dayId, { item: itemB, now: FIXED_NOW });
  assert.equal(attachB.ok, true);
  assert.equal(attachB.meta.member.frozen, false, 'post-reopen member is live');

  const day = getWorkspaceDays(reload(storage))[0];
  assert.equal(day.reopenCount, 1);
  const memberA = day.members.find((m) => m.workspaceItemId === 'wl-A');
  const memberB = day.members.find((m) => m.workspaceItemId === 'wl-B');
  assert.equal(memberA.frozen, true, 'existing member still frozen after reopen');
  assert.equal(memberB.frozen, false, 'new member live');
});

// ── 7. delete works on open AND closed days ────────────────────────────────
check('delete: open and closed days deletable directly, no restriction', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });

  const openId = p.createDay({ now: FIXED_NOW, idSuffix: 'del-open' }).day.id;
  const delOpen = p.deleteDay(openId);
  assert.equal(delOpen.ok, true);
  assert.equal(delOpen.status, 'deleted');
  assert.equal(getWorkspaceDays(reload(storage)).length, 0);

  const closedId = p.createDay({ now: FIXED_NOW, idSuffix: 'del-closed' }).day.id;
  p.closeDay(closedId, { now: FIXED_NOW });
  const delClosed = p.deleteDay(closedId);
  assert.equal(delClosed.ok, true);
  assert.equal(getWorkspaceDays(reload(storage)).length, 0);

  const missing = p.deleteDay('wd-nope');
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, CODES.DAY_NOT_FOUND);
});

// ── 8. drift detection is read-only (#7) ──────────────────────────────────
check('drift: surfaced on read model, contentSnapshot never auto-updated', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });
  const dayId = p.createDay({ now: FIXED_NOW, idSuffix: 'drift1' }).day.id;
  const itemA = makeItem('wl-A', { text: 'original' });
  p.attachItem(dayId, { item: itemA, now: FIXED_NOW });
  p.closeDay(dayId, { liveItemsById: { 'wl-A': itemA }, now: FIXED_NOW });

  const changedItem = makeItem('wl-A', { text: 'CHANGED' });
  const drifted = p.getDayReadModel(dayId, { liveItemsById: { 'wl-A': changedItem } });
  assert.equal(drifted.members[0].drifted, true);
  assert.equal(drifted.members[0].driftReason, 'identity-changed');

  const gone = p.getDayReadModel(dayId, { liveItemsById: {} });
  assert.equal(gone.members[0].drifted, true);
  assert.equal(gone.members[0].driftReason, 'item-missing');

  const stable = p.getDayReadModel(dayId, { liveItemsById: { 'wl-A': itemA } });
  assert.equal(stable.members[0].drifted, false);

  // viewing did NOT mutate the stored snapshot
  const stored = getWorkspaceDays(reload(storage))[0].members[0];
  assert.deepEqual(stored.contentSnapshot.identityPayload, { text: 'original' });
  assert.equal(stored.refreshedAt, null);
});

// ── 9. refreshMember is the ONLY snapshot/identity updater ────────────────
check('refreshMember: updates contentSnapshot + itemIdentityKey + refreshedAt, stays frozen', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });
  const dayId = p.createDay({ now: FIXED_NOW, idSuffix: 'rf1' }).day.id;
  const itemA = makeItem('wl-A', { text: 'original' });
  p.attachItem(dayId, { item: itemA, now: FIXED_NOW });
  p.closeDay(dayId, { liveItemsById: { 'wl-A': itemA }, now: FIXED_NOW });

  const before = getWorkspaceDays(reload(storage))[0].members[0];
  const changedItem = makeItem('wl-A', { text: 'CHANGED' });
  const refreshed = p.refreshMember(dayId, 'wl-A', { liveItem: changedItem, now: FIXED_NOW });
  assert.equal(refreshed.ok, true);

  const after = getWorkspaceDays(reload(storage))[0].members[0];
  assert.deepEqual(after.contentSnapshot.identityPayload, { text: 'CHANGED' });
  assert.notEqual(after.itemIdentityKey, before.itemIdentityKey);
  assert.ok(after.refreshedAt, 'refreshedAt set');
  assert.equal(after.frozen, true, 'refreshed member stays frozen');

  // refresh without a live item fails cleanly
  const bad = p.refreshMember(dayId, 'wl-A', {});
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, CODES.MEMBER_ITEM_MISSING);
});

// ── 10. attach guards ────────────────────────────────────────────────────
check('attach: rejects item without id, rejects attach to a closed day', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });
  const dayId = p.createDay({ now: FIXED_NOW, idSuffix: 'g1' }).day.id;

  const noId = p.attachItem(dayId, { item: { itemType: 'insight' }, now: FIXED_NOW });
  assert.equal(noId.ok, false);
  assert.equal(noId.error.code, CODES.MEMBER_ITEM_MISSING);

  p.closeDay(dayId, { now: FIXED_NOW });
  const onClosed = p.attachItem(dayId, { item: makeItem('wl-X'), now: FIXED_NOW });
  assert.equal(onClosed.ok, false);
  assert.equal(onClosed.error.code, CODES.DAY_NOT_OPEN);
});

// ── 11. reopen single-open invariant ─────────────────────────────────────
check('reopen invariant: reopen A while B is open fails cleanly, nothing written', () => {
  const storage = new MemoryStorage();
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });

  const dayA = p.createDay({ now: FIXED_NOW, idSuffix: 'ri-A' }).day.id;
  assert.equal(p.closeDay(dayA, { now: FIXED_NOW }).ok, true);
  const dayB = p.createDay({ now: FIXED_NOW, idSuffix: 'ri-B' }).day.id;
  const rawBefore = storage.getItem(WORKSPACE_DAYS_STORAGE_KEY);

  const reopened = p.reopenDay(dayA, { now: FIXED_NOW });
  assert.equal(reopened.ok, false);
  assert.equal(reopened.error.code, CODES.OPEN_DAY_EXISTS);
  assert.equal(reopened.error.rollbackVerified, true);
  assert.equal(reopened.openDayId, dayB);

  assert.equal(storage.getItem(WORKSPACE_DAYS_STORAGE_KEY), rawBefore, 'storage unchanged after failed reopen');
  const days = getWorkspaceDays(reload(storage));
  assert.equal(days.find((d) => d.id === dayA).status, 'closed', 'A stays closed');
  assert.equal(days.find((d) => d.id === dayB).status, 'open', 'B stays open');

  // reopen still works once the blocking open day is gone
  assert.equal(p.deleteDay(dayB).ok, true);
  const reopenedNow = p.reopenDay(dayA, { now: FIXED_NOW });
  assert.equal(reopenedNow.ok, true);
  assert.equal(reopenedNow.day.status, 'open');
  assert.equal(reopenedNow.day.reopenCount, 1);
});

// ── 12. write path: QUOTA_EXCEEDED + previous raw restored ───────────────
check('quota: setItem QuotaExceededError → QUOTA_EXCEEDED, previous raw restored', () => {
  const seedStorage = new MemoryStorage();
  const seedP = createWorkspaceDayPersistence({ localStorageArea: seedStorage });
  const dayId = seedP.createDay({ now: FIXED_NOW, idSuffix: 'quota1' }).day.id;
  const seededRaw = seedStorage.getItem(WORKSPACE_DAYS_STORAGE_KEY);

  class QuotaStorage extends MemoryStorage {
    setItem() {
      const error = new Error('mock quota');
      error.name = 'QuotaExceededError';
      error.code = 22;
      throw error;
    }
  }
  const storage = new QuotaStorage({ [WORKSPACE_DAYS_STORAGE_KEY]: seededRaw });
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });

  const closed = p.closeDay(dayId, { now: FIXED_NOW });
  assert.equal(closed.ok, false);
  assert.equal(closed.error.code, CODES.QUOTA_EXCEEDED);
  assert.equal(closed.error.rollbackVerified, true);
  assert.equal(storage.getItem(WORKSPACE_DAYS_STORAGE_KEY), seededRaw, 'previous raw intact after quota failure');
});

// ── 13. write path: READ_BACK_MISMATCH + restorePreviousRaw ─────────────
check('read-back mismatch: verified read differs from write → READ_BACK_MISMATCH, previous raw restored', () => {
  const seedStorage = new MemoryStorage();
  const seedP = createWorkspaceDayPersistence({ localStorageArea: seedStorage });
  const dayId = seedP.createDay({ now: FIXED_NOW, idSuffix: 'rbm1' }).day.id;
  const seededRaw = seedStorage.getItem(WORKSPACE_DAYS_STORAGE_KEY);

  // setItem stores the real value, but the FIRST getItem after it returns a
  // poisoned one-shot value — a read-back that disagrees with the write. The
  // subsequent restorePreviousRaw reads/writes are left intact.
  class ReadBackMismatchStorage extends MemoryStorage {
    constructor(entries) {
      super(entries);
      this._armed = false;
      this._poisonUsed = false;
    }
    setItem(key, value) {
      super.setItem(key, value);
      if (!this._poisonUsed) this._armed = true;
    }
    getItem(key) {
      if (this._armed && !this._poisonUsed) {
        this._armed = false;
        this._poisonUsed = true;
        return '["poisoned-read-back-value"]';
      }
      return super.getItem(key);
    }
  }
  const storage = new ReadBackMismatchStorage({ [WORKSPACE_DAYS_STORAGE_KEY]: seededRaw });
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });

  const closed = p.closeDay(dayId, { now: FIXED_NOW });
  assert.equal(closed.ok, false);
  assert.equal(closed.error.code, CODES.READ_BACK_MISMATCH);
  assert.equal(closed.error.rollbackVerified, true);
  assert.equal(storage.getItem(WORKSPACE_DAYS_STORAGE_KEY), seededRaw, 'previous raw restored after read-back mismatch');
});

// ── 14. write path: INVALID_READ_BACK (non-array stored value) ──────────
check('invalid read-back: stored value is valid JSON but not an array → INVALID_READ_BACK, no write', () => {
  const NON_ARRAY_RAW = '{"not":"an array"}';
  const storage = new MemoryStorage({ [WORKSPACE_DAYS_STORAGE_KEY]: NON_ARRAY_RAW });
  const p = createWorkspaceDayPersistence({ localStorageArea: storage });

  const result = p.createDay({ now: FIXED_NOW, idSuffix: 'irb1' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, CODES.INVALID_READ_BACK);
  assert.equal(storage.getItem(WORKSPACE_DAYS_STORAGE_KEY), NON_ARRAY_RAW, 'malformed stored value left untouched');
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
