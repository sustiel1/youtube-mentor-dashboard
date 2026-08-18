import assert from 'node:assert/strict';
import {
  INDEXED_DB_WARNING_THRESHOLD,
  buildStorageMeterModel,
  calculateStorageUtilization,
  collectStorageMeterSnapshot,
  formatStorageBytes,
  getLocalStorageUsageBytes,
  shortGenerationId,
} from '../src/lib/persistence/storageMeter.js';

function createStorage(entries) {
  const values = new Map(entries);
  let writes = 0;
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem() { writes += 1; },
    removeItem() { writes += 1; },
    get writes() { return writes; },
  };
}

const storage = createStorage([['abc', '12345'], ['x', 'yz']]);
assert.equal(getLocalStorageUsageBytes(storage), 22);
assert.equal(storage.writes, 0);
assert.equal(calculateStorageUtilization(25, 100), 0.25);
assert.equal(calculateStorageUtilization(120, 100), 1);
assert.equal(calculateStorageUtilization(10, 0), null);
assert.equal(formatStorageBytes(5.5 * 1024 * 1024), '5.50 MB');
assert.equal(shortGenerationId('generation-1786981030945-zrx0g2ry'), 'generation-1786…zrx0g2ry');

const healthy = buildStorageMeterModel({
  mode: 'indexedDB',
  localStorageBytes: 5.5 * 1024 * 1024,
  estimate: { usage: 20 * 1024 * 1024, quota: 2 * 1024 ** 3 },
  persisted: false,
  database: { available: true, version: 2 },
});
assert.equal(healthy.health, 'healthy');
assert.equal(healthy.warningCode, null);
assert.equal(healthy.localStorageBytes, 5.5 * 1024 * 1024);

const warning = buildStorageMeterModel({
  mode: 'indexedDB',
  localStorageBytes: 0,
  estimate: { usage: INDEXED_DB_WARNING_THRESHOLD * 1000, quota: 1000 },
  database: { available: true, version: 2 },
});
assert.equal(warning.health, 'warning');
assert.equal(warning.warningCode, 'quota-warning');

const unavailable = buildStorageMeterModel({
  mode: 'indexedDB',
  localStorageBytes: 0,
  database: { available: true, version: 2 },
});
assert.equal(unavailable.warningCode, 'quota-unavailable');
assert.equal(unavailable.quotaBytes, null);

const missingDb = buildStorageMeterModel({
  mode: 'indexedDB',
  localStorageBytes: 0,
  estimate: { usage: 1, quota: 100 },
  database: { available: false },
});
assert.equal(missingDb.health, 'danger');
assert.equal(missingDb.warningCode, 'indexeddb-unavailable');

let storageApiCalls = 0;
let databaseCalls = 0;
const legacy = await collectStorageMeterSnapshot({
  mode: 'localStorage',
  localStorageArea: storage,
  navigatorObject: { storage: { estimate() { storageApiCalls += 1; } } },
  indexedDBFactory: { databases() { databaseCalls += 1; } },
});
assert.equal(legacy.mode, 'localStorage');
assert.equal(legacy.localStorageBytes, 22);
assert.equal(storageApiCalls, 0);
assert.equal(databaseCalls, 0);
assert.equal(storage.writes, 0);

const unavailableApis = await collectStorageMeterSnapshot({
  mode: 'indexedDB',
  localStorageArea: storage,
  navigatorObject: {},
  indexedDBFactory: {},
});
assert.equal(unavailableApis.warningCode, 'indexeddb-unavailable');
assert.equal(unavailableApis.quotaBytes, null);
assert.equal(storage.writes, 0);

console.log('storage meter QA: 23/23 assertions passed');
