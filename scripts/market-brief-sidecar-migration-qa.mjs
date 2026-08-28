import assert from 'node:assert/strict';

import { migrateMarketBriefSidecars } from '../src/lib/persistence/marketBriefSidecarMigration.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries));
  }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(String(k), String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const brief = (n) => ({ contentType: 'marketBrief', sectors: [{ sector: `S${n}` }] });

// ── 1. non-IndexedDB mode is a no-op ────────────────────────────────────────
{
  const storage = new MemoryStorage({ 'market_brief_ext_a': JSON.stringify(brief(1)) });
  const r = await migrateMarketBriefSidecars({
    storage,
    mode: 'localStorage',
    readCanonical: async () => { throw new Error('must not be called'); },
    writeCanonical: async () => { throw new Error('must not be called'); },
  });
  assert.equal(r.skippedReason, 'not-indexeddb-mode');
  assert.equal(r.scanned, 0);
  assert.equal(storage.getItem('market_brief_ext_a'), JSON.stringify(brief(1)), 'sidecar retained');
}

// ── 2. happy path: write + verify → migrate and drop sidecars ───────────────
{
  const storage = new MemoryStorage({
    'market_brief_ext_a': JSON.stringify(brief(1)),
    'market_brief_local_b': JSON.stringify(brief(2)),
    'unrelated_key': 'keep-me',
  });
  const canon = new Map();
  const r = await migrateMarketBriefSidecars({
    storage,
    mode: 'indexedDB',
    readCanonical: async (id) => (canon.has(id) ? { storage: 'indexedDB', data: canon.get(id) } : null),
    writeCanonical: async (id, data) => { canon.set(id, data); return { ok: true }; },
  });
  assert.equal(r.scanned, 2);
  assert.equal(r.migrated, 2);
  assert.equal(r.removed, 2);
  assert.deepEqual(r.failed, []);
  assert.deepEqual(r.skipped, []);
  assert.equal(storage.getItem('market_brief_ext_a'), null);
  assert.equal(storage.getItem('market_brief_local_b'), null);
  assert.equal(storage.getItem('unrelated_key'), 'keep-me', 'non-sidecar key untouched');
  assert.deepEqual(canon.get('ext_a'), brief(1));
}

// ── 3. already in canonical → drop sidecar without re-writing ───────────────
{
  const storage = new MemoryStorage({ 'market_brief_ext_a': JSON.stringify(brief(9)) });
  let wrote = false;
  const r = await migrateMarketBriefSidecars({
    storage,
    mode: 'indexedDB',
    readCanonical: async () => ({ storage: 'indexedDB', data: brief(9) }),
    writeCanonical: async () => { wrote = true; return { ok: true }; },
  });
  assert.equal(wrote, false, 'no re-write when canonical already present');
  assert.equal(r.migrated, 1);
  assert.equal(r.removed, 1);
  assert.equal(storage.getItem('market_brief_ext_a'), null);
}

// ── 4. invalid JSON → skipped, key retained ────────────────────────────────
{
  const storage = new MemoryStorage({ 'market_brief_bad': '{not json' });
  const r = await migrateMarketBriefSidecars({
    storage,
    mode: 'indexedDB',
    readCanonical: async () => null,
    writeCanonical: async () => { throw new Error('must not be called'); },
  });
  assert.equal(r.migrated, 0);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].reason, 'invalid-json');
  assert.equal(storage.getItem('market_brief_bad'), '{not json', 'retained');
}

// ── 5. non-object payload → skipped ───────────────────────────────────────
{
  const storage = new MemoryStorage({
    'market_brief_arr': JSON.stringify([1, 2]),
    'market_brief_num': JSON.stringify(42),
  });
  const r = await migrateMarketBriefSidecars({
    storage,
    mode: 'indexedDB',
    readCanonical: async () => null,
    writeCanonical: async () => { throw new Error('must not be called'); },
  });
  assert.equal(r.migrated, 0);
  assert.equal(r.skipped.length, 2);
  assert.ok(r.skipped.every((s) => s.reason === 'not-an-object'));
  assert.equal(storage.length, 2, 'both retained');
}

// ── 6. write not ok (no active generation) → failed, sidecar retained ──────
{
  const storage = new MemoryStorage({ 'market_brief_ext_a': JSON.stringify(brief(1)) });
  const r = await migrateMarketBriefSidecars({
    storage,
    mode: 'indexedDB',
    readCanonical: async () => null,
    writeCanonical: async () => ({ ok: false, code: 'indexeddb-active-generation-missing' }),
  });
  assert.equal(r.migrated, 0);
  assert.equal(r.removed, 0);
  assert.equal(r.failed.length, 1);
  assert.equal(r.failed[0].reason, 'indexeddb-active-generation-missing');
  assert.equal(storage.getItem('market_brief_ext_a'), JSON.stringify(brief(1)), 'no data loss');
}

// ── 7. write ok but verify read-back fails → failed, sidecar retained ──────
{
  const storage = new MemoryStorage({ 'market_brief_ext_a': JSON.stringify(brief(1)) });
  const r = await migrateMarketBriefSidecars({
    storage,
    mode: 'indexedDB',
    readCanonical: async () => null, // never confirms
    writeCanonical: async () => ({ ok: true }),
  });
  assert.equal(r.migrated, 0);
  assert.equal(r.failed.length, 1);
  assert.equal(r.failed[0].reason, 'verify-readback-failed');
  assert.equal(storage.getItem('market_brief_ext_a'), JSON.stringify(brief(1)), 'no data loss');
}

// ── 8. dryRun → counts, removes nothing ──────────────────────────────────
{
  const storage = new MemoryStorage({ 'market_brief_ext_a': JSON.stringify(brief(1)) });
  const r = await migrateMarketBriefSidecars({
    storage,
    mode: 'indexedDB',
    dryRun: true,
    readCanonical: async () => null,
    writeCanonical: async () => { throw new Error('must not be called in dryRun'); },
  });
  assert.equal(r.migrated, 1);
  assert.equal(r.removed, 0);
  assert.equal(storage.getItem('market_brief_ext_a'), JSON.stringify(brief(1)), 'retained in dryRun');
}

console.log('market-brief-sidecar-migration-qa: PASS (mode gate, happy path, already-canonical, invalid json, non-object, write-fail no-loss, verify-fail no-loss, dryRun, unrelated keys untouched)');
