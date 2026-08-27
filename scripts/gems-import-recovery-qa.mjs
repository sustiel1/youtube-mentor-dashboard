/**
 * Focused regression QA for WORK-ID YMD-GEMS-IMPORT-RECOVERY.
 * Run: node --import ./scripts/register-src-aliases.mjs scripts/gems-import-recovery-qa.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getBriefDisplayClassification } from '../src/config/videoTabsConfig.js';
import {
  canonicalizeGemsPayloadForPersistence,
  parseAndValidateGemsJson,
  repairGemsJsonDeterministically,
} from '../src/lib/gemsJsonRepair.js';
import {
  GemsLocalPersistenceError,
  GEMS_DRAFT_QUOTA_WARNING,
  getGemsDraftPersistenceWarning,
  persistCommittedMarketBrief,
  persistVerifiedLocalValue,
} from '../src/lib/gemsLocalPersistence.js';
import {
  selectNewestMarketBriefCandidate,
  stampMarketBriefSource,
} from '../src/lib/marketBriefSourceSelection.js';
import {
  createMarketBriefCanonicalStore,
  getMarketBriefStorageKey,
} from '../src/lib/persistence/marketBriefCanonicalStore.js';

const fixture = JSON.parse(fs.readFileSync(
  new URL('./fixtures/gems-import-recovery.fixture.json', import.meta.url),
  'utf8',
));

function createMemoryStorage(entries = []) {
  const values = new Map(entries);
  let writes = 0;
  return {
    get writes() { return writes; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { writes += 1; values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function importBrief({ video, payload }, storage) {
  const parsed = parseAndValidateGemsJson(JSON.stringify(payload));
  assert.equal(parsed.ok, true, `${video.id} must pass the compatible schema gate`);
  const canonical = canonicalizeGemsPayloadForPersistence(parsed.value);
  const savedAt = video.id.endsWith('morning')
    ? '2026-08-26T06:00:00.000Z'
    : '2026-08-26T18:00:00.000Z';
  const marketBriefData = stampMarketBriefSource(canonical, { savedAt });
  const previousRaw = storage.getItem('yt_mentor_videos_v2');
  const videos = previousRaw ? JSON.parse(previousRaw) : [];
  const index = videos.findIndex((candidate) => candidate.id === video.id);
  if (index < 0) videos.push(video);

  return persistCommittedMarketBrief({
    videoId: video.id,
    marketBriefData,
    storage,
    commitVideo: () => {
      const nextVideos = JSON.parse(JSON.stringify(videos));
      const nextIndex = nextVideos.findIndex((candidate) => candidate.id === video.id);
      nextVideos[nextIndex] = {
        ...nextVideos[nextIndex],
        marketBriefData,
        marketBriefSavedAt: savedAt,
        analysisProvider: 'gems',
        analysisStatus: 'analyzed',
      };
      storage.setItem('yt_mentor_videos_v2', JSON.stringify(nextVideos));
      assert.equal(storage.getItem('yt_mentor_videos_v2'), JSON.stringify(nextVideos));
      return nextVideos[nextIndex];
    },
  });
}

const storage = createMemoryStorage();
const morningResult = importBrief(fixture.morning, storage);
const eveningResult = importBrief(fixture.evening, storage);
assert.equal(morningResult.sidecarPersisted, true);
assert.equal(eveningResult.sidecarPersisted, true);

const reloadedVideos = JSON.parse(storage.getItem('yt_mentor_videos_v2'));
assert.equal(reloadedVideos.length, 2);
for (const [key, expectedSlug] of [['morning', 'morning-brief'], ['evening', 'evening-brief']]) {
  const expected = fixture[key];
  const reloaded = reloadedVideos.find((video) => video.id === expected.video.id);
  assert.equal(getBriefDisplayClassification(reloaded)?.slug, expectedSlug);
  const selected = selectNewestMarketBriefCandidate([
    { data: JSON.parse(storage.getItem(`market_brief_${reloaded.id}`)), fallbackOrder: 0 },
    { data: reloaded.marketBriefData, explicitTimestamp: reloaded.marketBriefSavedAt, fallbackOrder: 1 },
  ]);
  assert.deepEqual(selected.data, reloaded.marketBriefData);
  assert.deepEqual(
    canonicalizeGemsPayloadForPersistence(selected.data),
    selected.data,
    `${key} reload must not duplicate or change content`,
  );
}

const previousVideoRaw = storage.getItem('yt_mentor_videos_v2');
const previousMorningSidecar = storage.getItem('market_brief_fixture-morning');
const invalid = '{"contentType":"marketBrief","universalTabs":{"specialized":';
assert.equal(parseAndValidateGemsJson(invalid).ok, false);
assert.equal(repairGemsJsonDeterministically(invalid).status, 'regeneration-required');
assert.equal(storage.getItem('yt_mentor_videos_v2'), previousVideoRaw);
assert.equal(storage.getItem('market_brief_fixture-morning'), previousMorningSidecar);

const draftQuotaStorage = createMemoryStorage();
draftQuotaStorage.setItem = () => {
  const error = new Error('quota');
  error.name = 'QuotaExceededError';
  throw error;
};
let draftWarning = null;
try {
  persistVerifiedLocalValue('gems-paste-fixture', JSON.stringify(fixture.morning.payload), draftQuotaStorage);
} catch (error) {
  draftWarning = getGemsDraftPersistenceWarning(error);
}
assert.equal(draftWarning, GEMS_DRAFT_QUOTA_WARNING);
assert.equal(parseAndValidateGemsJson(JSON.stringify(fixture.morning.payload)).ok, true);

const finalFailureStorage = createMemoryStorage([
  ['market_brief_fixture-morning', previousMorningSidecar],
  ['yt_mentor_videos_v2', previousVideoRaw],
]);
assert.throws(
  () => persistCommittedMarketBrief({
    videoId: 'fixture-morning',
    marketBriefData: { replacement: true },
    storage: finalFailureStorage,
    commitVideo: () => {
      throw new GemsLocalPersistenceError('final write failed', {
        classification: 'storage-operation-failed',
      });
    },
  }),
  (error) => error?.name === 'GemsLocalPersistenceError',
);
assert.equal(finalFailureStorage.getItem('yt_mentor_videos_v2'), previousVideoRaw);
assert.equal(finalFailureStorage.getItem('market_brief_fixture-morning'), previousMorningSidecar);

const sidecarQuotaStorage = createMemoryStorage([
  ['market_brief_fixture-morning', previousMorningSidecar],
]);
const originalSetItem = sidecarQuotaStorage.setItem.bind(sidecarQuotaStorage);
sidecarQuotaStorage.setItem = (key, value) => {
  if (key.startsWith('market_brief_')) {
    const error = new Error('quota');
    error.name = 'QuotaExceededError';
    throw error;
  }
  originalSetItem(key, value);
};
const sidecarWarningResult = persistCommittedMarketBrief({
  videoId: 'fixture-morning',
  marketBriefData: { replacement: true },
  storage: sidecarQuotaStorage,
  commitVideo: () => ({ id: 'fixture-morning', marketBriefData: { replacement: true } }),
});
assert.equal(sidecarWarningResult.sidecarPersisted, false);
assert.match(sidecarWarningResult.sidecarWarning, /Market Brief/);
assert.equal(sidecarQuotaStorage.getItem('market_brief_fixture-morning'), previousMorningSidecar);

const readOnlyStorage = createMemoryStorage();
const writesBeforeLegacyRead = readOnlyStorage.writes;
const legacyDisplay = getBriefDisplayClassification({
  title: 'סקירת שוק יומית',
  contentType: 'marketBrief',
});
assert.equal(legacyDisplay?.slug, 'morning-brief');
assert.equal(readOnlyStorage.writes, writesBeforeLegacyRead);

assert.equal(parseAndValidateGemsJson(JSON.stringify({ allPoints: ['generic analysis'] })).ok, true);
assert.equal(parseAndValidateGemsJson(JSON.stringify({ universalTabs: { appBuilder: {} } })).ok, true);

function createMemoryRepository({ failWrites = false } = {}) {
  const records = new Map([
    ['active-generation\u0000unrelated_key', { generationId: 'active-generation', storageKey: 'unrelated_key', rawValue: 'unchanged' }],
  ]);
  const compositeKey = ([generationId, storageKey]) => `${generationId}\u0000${storageKey}`;
  return {
    records,
    async readMeta(key) {
      return key === 'activeGeneration'
        ? { key, generationId: 'active-generation', state: 'active' }
        : null;
    },
    async writeBatch(_storeName, nextRecords) {
      if (failWrites) {
        const error = new Error('simulated IndexedDB transaction failure');
        error.name = 'AbortError';
        throw error;
      }
      nextRecords.forEach((record) => {
        records.set(compositeKey([record.generationId, record.storageKey]), structuredClone(record));
      });
    },
    async readRecords(_storeName, keys) {
      return keys.map((key) => records.get(compositeKey(key)) || null);
    },
    async readSourceEntry(generationId, storageKey) {
      return records.get(compositeKey([generationId, storageKey])) || null;
    },
  };
}

const quotaStorage = createMemoryStorage();
quotaStorage.setItem = () => {
  const error = new Error("Setting the value exceeded the quota");
  error.name = 'QuotaExceededError';
  throw error;
};
const repository = createMemoryRepository();
const indexedDbStore = createMarketBriefCanonicalStore({
  mode: 'indexedDB',
  repository,
  localStorageArea: quotaStorage,
  cryptoProvider: globalThis.crypto,
});
const morningCanonicalWrite = await indexedDbStore.write('fixture-morning', morningResult.savedVideo.marketBriefData);
assert.equal(morningCanonicalWrite.ok, true);
assert.equal(morningCanonicalWrite.storage, 'indexedDB');
assert.equal(quotaStorage.writes, 0, 'canonical IndexedDB save must not touch quota-full localStorage');
const firstRecordCount = repository.records.size;
const repeatedMorningWrite = await indexedDbStore.write('fixture-morning', morningResult.savedVideo.marketBriefData);
assert.equal(repeatedMorningWrite.ok, true);
assert.equal(repository.records.size, firstRecordCount, 'same composite key must be replaced, not duplicated');
const eveningCanonicalWrite = await indexedDbStore.write('fixture-evening', eveningResult.savedVideo.marketBriefData);
assert.equal(eveningCanonicalWrite.ok, true);
assert.equal(repository.records.size, firstRecordCount + 1);
assert.equal(repository.records.get('active-generation\u0000unrelated_key').rawValue, 'unchanged');

for (const [videoId, expected] of [
  ['fixture-morning', morningResult.savedVideo.marketBriefData],
  ['fixture-evening', eveningResult.savedVideo.marketBriefData],
]) {
  const reopened = await indexedDbStore.read(videoId);
  assert.equal(reopened.storageKey, getMarketBriefStorageKey(videoId));
  assert.deepEqual(reopened.data, expected);
}

const failingRepository = createMemoryRepository({ failWrites: true });
const failingIndexedDbStore = createMarketBriefCanonicalStore({
  mode: 'indexedDB',
  repository: failingRepository,
  localStorageArea: quotaStorage,
  cryptoProvider: globalThis.crypto,
});
const mandatoryFailure = await failingIndexedDbStore.write('fixture-morning', { replacement: true });
assert.equal(mandatoryFailure.ok, false);
assert.match(mandatoryFailure.code, /^indexeddb-/);
assert.equal(quotaStorage.writes, 0, 'failed mandatory IndexedDB write must not fall back to localStorage');

console.log('GEMS import recovery QA passed: Morning, Evening, reload, invalid/EOF, draft quota, final failure, sidecar warning, legacy routing, and canonical IndexedDB persistence under localStorage quota.');
