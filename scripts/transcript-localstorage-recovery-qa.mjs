import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  getTranscriptPersistenceDecision,
  readTranscriptLocalCache,
  TRANSCRIPT_LOCAL_STORAGE_KEY,
  writeTranscriptLocalCache,
} from '../src/lib/persistence/transcriptLocalStorageStore.js';
import { getTranscriptLookupVideoIds } from '../src/lib/videoTranscriptUtils.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.records = new Map(Object.entries(entries));
    this.writeCount = 0;
  }

  getItem(key) {
    return this.records.has(key) ? this.records.get(key) : null;
  }

  setItem(key, value) {
    this.writeCount += 1;
    this.records.set(String(key), String(value));
  }
}

const loopbackDecision = getTranscriptPersistenceDecision({
  requestedBackend: 'indexedDB',
  location: { origin: 'http://127.0.0.1:5184' },
});
assert.equal(loopbackDecision.requestedBackend, 'indexedDB');
assert.equal(loopbackDecision.backend, 'localStorage');
assert.equal(loopbackDecision.policy, 'authorized-transcript-localstorage-origin');
assert.equal(loopbackDecision.fallback, false);

const localhostDecision = getTranscriptPersistenceDecision({
  requestedBackend: 'indexedDB',
  location: { origin: 'http://localhost:5184' },
});
assert.equal(localhostDecision.requestedBackend, 'indexedDB');
assert.equal(localhostDecision.backend, 'localStorage');
assert.equal(localhostDecision.policy, 'authorized-transcript-localstorage-origin');
assert.equal(localhostDecision.fallback, false);

const unauthorizedOriginDecision = getTranscriptPersistenceDecision({
  requestedBackend: 'indexedDB',
  location: { origin: 'https://youtube-mentor-dashboard.base44.app' },
});
assert.equal(unauthorizedOriginDecision.requestedBackend, 'indexedDB');
assert.equal(unauthorizedOriginDecision.backend, 'indexedDB');
assert.equal(unauthorizedOriginDecision.policy, 'requested-transcript-backend');
assert.equal(unauthorizedOriginDecision.fallback, false);

const targetVideoId = 'o632g7k52c4';
const payload = {
  body: 'א'.repeat(8615),
  lang: 'iw',
  segments: Array.from({ length: 237 }, (_, index) => ({
    text: `מקטע ${index + 1}`,
    startSeconds: index * 3,
    durationSeconds: 3,
  })),
  fetchedAt: '2026-08-27T08:15:00.000Z',
  source: 'youtube-timedtext',
  status: 'youtube',
  quality: 'high',
};

const storage = new MemoryStorage();
const firstWrite = writeTranscriptLocalCache(targetVideoId, payload, { storage });
assert.equal(firstWrite.ok, true);
assert.equal(firstWrite.storage, 'localStorage');
assert.equal(firstWrite.entryCount, 1);
assert.equal(storage.writeCount, 1);

const firstRead = readTranscriptLocalCache(targetVideoId, { storage });
assert.equal(firstRead.lang, 'iw');
assert.equal(firstRead.segments.length, 237);
assert.equal(firstRead.body.length, 8615);

const secondWrite = writeTranscriptLocalCache(targetVideoId, payload, { storage });
assert.equal(secondWrite.entryCount, 1, 'same videoId must replace the cache record');
assert.equal(Object.keys(JSON.parse(storage.getItem(TRANSCRIPT_LOCAL_STORAGE_KEY))).length, 1);

const reopenedStorageView = new MemoryStorage(Object.fromEntries(storage.records));
const reopenedRead = readTranscriptLocalCache(targetVideoId, { storage: reopenedStorageView });
assert.deepEqual(reopenedRead, firstRead, 'close/reopen must preserve the cached transcript');
const fullReloadRead = readTranscriptLocalCache(targetVideoId, { storage: reopenedStorageView });
assert.deepEqual(fullReloadRead, firstRead, 'full reload must read the same durable record');

assert.deepEqual(
  getTranscriptLookupVideoIds({
    videoId: '',
    youtubeId: '',
    url: `https://www.youtube.com/watch?v=${targetVideoId}`,
    id: 'local-video-record',
  }),
  [targetVideoId, 'local-video-record'],
);

const quotaStorage = new MemoryStorage();
quotaStorage.setItem = () => {
  const error = new Error('synthetic quota');
  error.name = 'QuotaExceededError';
  throw error;
};
assert.throws(
  () => writeTranscriptLocalCache(targetVideoId, payload, { storage: quotaStorage }),
  (error) => {
    assert.equal(error.name, 'TranscriptLocalStoragePersistenceError');
    assert.equal(error.code, 'localstorage-quota-exceeded');
    assert.match(error.message, /localStorage מלא/);
    assert.match(error.message, /לא דווחה הצלחה/);
    return true;
  },
);

const invalidRaw = '{not-valid-json';
const invalidStorage = new MemoryStorage({ [TRANSCRIPT_LOCAL_STORAGE_KEY]: invalidRaw });
assert.throws(
  () => writeTranscriptLocalCache(targetVideoId, payload, { storage: invalidStorage }),
  (error) => error.code === 'localstorage-cache-invalid',
);
assert.equal(invalidStorage.getItem(TRANSCRIPT_LOCAL_STORAGE_KEY), invalidRaw);
assert.equal(invalidStorage.writeCount, 0, 'invalid existing cache must remain unchanged');

const panelSource = fs.readFileSync(
  new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url),
  'utf8',
);
const transcriptServiceSource = fs.readFileSync(
  new URL('../src/services/youtubeTranscript.js', import.meta.url),
  'utf8',
);
const dashboardSource = fs.readFileSync(
  new URL('../src/pages/Dashboard.jsx', import.meta.url),
  'utf8',
);

assert.doesNotMatch(panelSource, /transcriptCanonicalStore|writeCanonicalTranscript|readCanonicalTranscript/);
assert.match(panelSource, /transcriptBackend:/);
assert.match(panelSource, /transcriptOrigin:/);
assert.match(panelSource, /transcriptPolicy:/);
assert.match(panelSource, /getTranscriptLookupVideoIds\(video\)/);
assert.match(panelSource, /readTranscriptLocalCache\(videoId\)/);
assert.match(panelSource, /localStorage נכשל כי שטח האחסון מלא/);

const handlerStart = panelSource.indexOf('const handleYtApiTranscript = async () =>');
const handlerEnd = panelSource.indexOf('const handleDeleteTranscript =', handlerStart);
const handlerSource = panelSource.slice(handlerStart, handlerEnd);
const backendCheckAt = handlerSource.indexOf('storageDiagnostics.backend !== APPLICATION_STORAGE_MODES.LOCAL_STORAGE');
const fetchAt = handlerSource.indexOf('await fetchTranscriptPayload(ytId)');
const durableProofAt = handlerSource.indexOf("payload.persistence.storage !== 'localStorage'");
const videoWriteAt = handlerSource.indexOf('updateLocalVideo(video?.id || video?.youtubeId, patch)');
const reactQueryPatchAt = handlerSource.indexOf('onVideoPatch?.(saved)');
assert.ok(backendCheckAt >= 0 && backendCheckAt < fetchAt, 'backend policy must be checked before download/cache access');
assert.ok(fetchAt < durableProofAt && durableProofAt < videoWriteAt, 'cache durability must be proven before video update');
assert.ok(videoWriteAt < reactQueryPatchAt, 'video record must persist before React Query synchronization');

const localCacheWriteAt = transcriptServiceSource.indexOf('writeTranscriptLocalCache(videoId, payload)');
const payloadReturnAt = transcriptServiceSource.indexOf('return { ...payload, persistence }', localCacheWriteAt);
assert.ok(localCacheWriteAt >= 0 && localCacheWriteAt < payloadReturnAt);
assert.match(dashboardSource, /queryClient\.setQueryData\(\['videos'\]/);
assert.match(dashboardSource, /onVideoPatch=\{handleVideoPatch\}/);

console.log('Transcript localStorage recovery QA passed: authorized loopback origin policy (127.0.0.1 + localhost), unauthorized-origin pass-through, durable cache read-back, URL/local-ID lookup, no duplicates, quota failure, close/reopen, reload, video ordering, and React Query synchronization.');
