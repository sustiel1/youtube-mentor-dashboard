import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createTranscriptCanonicalStore,
  getCanonicalTranscriptRecordId,
} from '../src/lib/persistence/transcriptCanonicalStore.js';
import {
  APPLICATION_STORAGE_MODES,
  getApplicationStorageMode,
  getApplicationStorageModeDecision,
} from '../src/lib/persistence/storageMode.js';
import { getTranscriptLookupVideoIds } from '../src/lib/videoTranscriptUtils.js';

function createMemoryRepository({
  failWrites = false,
  activeGeneration = { key: 'activeGeneration', generationId: 'active-generation', state: 'active' },
} = {}) {
  const records = new Map([
    ['active-generation\u0000unrelated', { generationId: 'active-generation', id: 'unrelated', payload: { preserved: true } }],
  ]);
  const keyOf = ([generationId, id]) => `${generationId}\u0000${id}`;
  return {
    records,
    async readMeta(key) {
      return key === 'activeGeneration' ? activeGeneration : null;
    },
    async writeBatch(_storeName, nextRecords) {
      if (failWrites) {
        const error = new Error('simulated transcript write failure');
        error.name = 'AbortError';
        throw error;
      }
      nextRecords.forEach((record) => records.set(
        keyOf([record.generationId, record.id]),
        structuredClone(record),
      ));
    },
    async readRecords(_storeName, keys) {
      return keys.map((key) => records.get(keyOf(key)) || null);
    },
    async deleteRecords(_storeName, keys) {
      keys.forEach((key) => records.delete(keyOf(key)));
    },
  };
}

const payload = {
  body: 'תמלול בדיקה מלא עם יותר מארבעים תווים כדי לוודא שמירה קנונית וקריאה חוזרת.',
  segments: [
    { text: 'תמלול בדיקה מלא', startSeconds: 0, durationSeconds: 2 },
    { text: 'עם שמירה קנונית', startSeconds: 2, durationSeconds: 2 },
    { text: 'וקריאה חוזרת', startSeconds: 4, durationSeconds: 2 },
  ],
  source: 'youtube-timedtext',
  language: 'he',
  status: 'youtube',
  quality: 'medium',
  importedAt: '2026-08-26T12:00:00.000Z',
};

const repository = createMemoryRepository();
const store = createTranscriptCanonicalStore({ repository });
const firstWrite = await store.write('video-transcript-test', payload);
assert.equal(firstWrite.ok, true);
assert.equal(firstWrite.objectStore, 'transcripts');
assert.equal(firstWrite.id, getCanonicalTranscriptRecordId('video-transcript-test'));
const recordCount = repository.records.size;
const secondWrite = await store.write('video-transcript-test', payload);
assert.equal(secondWrite.ok, true);
assert.equal(repository.records.size, recordCount, 'same transcript key must be replaced, not duplicated');
assert.deepEqual(repository.records.get('active-generation\u0000unrelated').payload, { preserved: true });

const missingGenerationRepository = createMemoryRepository({ activeGeneration: null });
const missingGenerationStore = createTranscriptCanonicalStore({ repository: missingGenerationRepository });
const missingGenerationCount = missingGenerationRepository.records.size;
const missingGenerationWrite = await missingGenerationStore.write('video-transcript-test', payload);
assert.equal(missingGenerationWrite.ok, false);
assert.equal(missingGenerationWrite.code, 'indexeddb-active-generation-missing');
assert.equal(missingGenerationRepository.records.size, missingGenerationCount);
assert.deepEqual(
  missingGenerationRepository.records.get('active-generation\u0000unrelated').payload,
  { preserved: true },
);

const aliasDecision = getApplicationStorageModeDecision({
  env: { VITE_YTMDB_STORAGE_MODE: 'indexedDB' },
  location: { origin: 'http://127.0.0.1:5184' },
});
assert.equal(aliasDecision.requestedMode, APPLICATION_STORAGE_MODES.INDEXED_DB);
assert.equal(aliasDecision.mode, APPLICATION_STORAGE_MODES.INDEXED_DB);
assert.equal(aliasDecision.reason, 'indexeddb-origin-not-authorized');
assert.equal(getApplicationStorageMode({
  env: { VITE_YTMDB_STORAGE_MODE: 'indexedDB' },
  location: { origin: 'http://localhost:5184' },
}), APPLICATION_STORAGE_MODES.INDEXED_DB);
assert.equal(getApplicationStorageMode({
  env: { VITE_YTMDB_STORAGE_MODE: 'indexedDB' },
  location: { origin: 'http://127.0.0.1:5184' },
}), APPLICATION_STORAGE_MODES.INDEXED_DB);
assert.deepEqual(
  getTranscriptLookupVideoIds({ videoId: '', url: 'https://www.youtube.com/watch?v=o632g7k52c4', id: 'local-video-record' }),
  ['o632g7k52c4', 'local-video-record'],
);

const reopened = await store.read('video-transcript-test');
assert.equal(reopened.storage, 'indexedDB');
assert.deepEqual(reopened.data, payload);
const deleted = await store.remove('video-transcript-test');
assert.equal(deleted.ok, true);
assert.equal(await store.read('video-transcript-test'), null);
assert.deepEqual(repository.records.get('active-generation\u0000unrelated').payload, { preserved: true });

const failingRepository = createMemoryRepository({ failWrites: true });
const failingStore = createTranscriptCanonicalStore({ repository: failingRepository });
const failedWrite = await failingStore.write('video-transcript-test', payload);
assert.equal(failedWrite.ok, false);
assert.match(failedWrite.code, /^indexeddb-/);
assert.deepEqual(failingRepository.records.get('active-generation\u0000unrelated').payload, { preserved: true });

const panelSource = fs.readFileSync(
  new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url),
  'utf8',
);
const dashboardSource = fs.readFileSync(
  new URL('../src/pages/Dashboard.jsx', import.meta.url),
  'utf8',
);
assert.match(panelSource, /await writeCanonicalTranscript\(/);
assert.match(panelSource, /if \(!persistenceResult\.ok\)/);
assert.match(panelSource, /getApplicationStorageModeDecision\(\)/);
assert.match(panelSource, /indexeddb-origin-not-authorized/);
assert.match(panelSource, /שמירתו ב-IndexedDB אינה מורשית בכתובת זו/);
assert.match(panelSource, /הורדת התמלול הצליחה, אך שמירתו ב-IndexedDB נכשלה/);
assert.match(panelSource, /readCanonicalTranscript\(currentGemsVideoId\)/);
assert.match(panelSource, /await deleteCanonicalTranscript\(currentGemsVideoId\)/);
assert.match(dashboardSource, /queryClient\.setQueryData\(\['videos'\]/);
assert.match(dashboardSource, /onVideoPatch=\{handleVideoPatch\}/);
assert.match(panelSource, /hasStoredTranscript \? 'תמלול YouTube נשמר' : 'נסה תמלול YouTube'/);

console.log('YouTube transcript persistence QA passed: canonical IndexedDB save, no cross-origin fallback, missing-generation safety, read-back, cache refresh, reopen, no duplicates, explicit failure, and explicit delete.');
