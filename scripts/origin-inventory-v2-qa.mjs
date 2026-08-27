import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';

import {
  collectOriginExportV2,
  collectOriginInventoryV2,
  deserializeDeterministically,
  decryptOriginExportV2,
  encryptOriginExportV2,
  formatInventoryError,
  serializeDeterministically,
} from '../src/dev/ytmdbOriginInventoryV2.js';

const moduleSource = fs.readFileSync(new URL('../src/dev/ytmdbOriginInventoryV2.js', import.meta.url), 'utf8');
const htmlSource = fs.readFileSync(new URL('../ytmdb-origin-inventory-v2.html', import.meta.url), 'utf8');
assert.match(moduleSource, /indexedDBFactory\.open\(databaseInfo\.name\)/);
assert.doesNotMatch(moduleSource, /indexedDBFactory\.open\(databaseInfo\.name\s*,/);
assert.doesNotMatch(moduleSource, /localStorageArea\.(?:setItem|removeItem|clear)\s*\(/);
assert.doesNotMatch(moduleSource, /indexedDBFactory\.(?:deleteDatabase|cmp)\s*\(/);
assert.doesNotMatch(moduleSource, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
assert.doesNotMatch(moduleSource, /(?:migrateLocalStorageToIndexedDb|activateReadyGeneration|openAppDataDb)/);
assert.doesNotMatch(htmlSource, /download|data-run-export/i);

function createStorage(entries) {
  const values = new Map(entries);
  const mutations = { set: 0, remove: 0, clear: 0 };
  return {
    mutations,
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { mutations.set += 1; values.set(key, String(value)); },
    removeItem(key) { mutations.remove += 1; values.delete(key); },
    clear() { mutations.clear += 1; values.clear(); },
    snapshot() { return JSON.stringify([...values.entries()].sort(([left], [right]) => left.localeCompare(right))); },
  };
}

function requestFor(value, onSettled) {
  const request = { result: undefined, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => {
    request.result = structuredClone(value);
    request.onsuccess?.();
    onSettled();
  });
  return request;
}

function createFakeIndexedDb({ name = 'yt_mentor_app_data_v1', version = 2, stores, extraDatabases = [] }) {
  const proof = {
    openArgumentCounts: [],
    openNames: [],
    transactionModes: [],
    mutations: 0,
    postCompletionSchemaReads: 0,
  };
  const database = {
    name,
    version,
    objectStoreNames: Object.keys(stores).sort(),
    onversionchange: null,
    close() {},
    transaction(storeName, mode) {
      proof.transactionModes.push(mode);
      if (mode !== 'readonly') throw new Error('readwrite transaction attempted');
      let active = true;
      let pending = 0;
      let requestsStarted = false;
      const transaction = {
        mode,
        error: null,
        oncomplete: null,
        onabort: null,
        onerror: null,
        abort() { proof.mutations += 1; transaction.onabort?.(); },
        objectStore(name) {
          const definition = stores[name];
          if (!definition) throw new Error(`missing store ${name}`);
          const settle = () => {
            pending -= 1;
            if (requestsStarted && pending === 0) queueMicrotask(() => {
              active = false;
              transaction.oncomplete?.();
            });
          };
          const makeRequest = (value) => {
            pending += 1;
            const request = requestFor(value, settle);
            requestsStarted = true;
            return request;
          };
          return {
            keyPath: definition.keyPath,
            autoIncrement: false,
            indexNames: (definition.indexes || []).map((index) => index.name),
            index(indexName) {
              if (!active) {
                proof.postCompletionSchemaReads += 1;
                throw new DOMException(
                  'A request was placed against a transaction which is currently not active.',
                  'InvalidStateError',
                );
              }
              const index = (definition.indexes || []).find((candidate) => candidate.name === indexName);
              if (!index) throw new Error(`missing index ${indexName}`);
              return index;
            },
            getAllKeys() { return makeRequest(definition.records.map((record) => record.key)); },
            getAll() { return makeRequest(definition.records.map((record) => record.value)); },
            add() { proof.mutations += 1; throw new Error('add refused'); },
            put() { proof.mutations += 1; throw new Error('put refused'); },
            delete() { proof.mutations += 1; throw new Error('delete refused'); },
            clear() { proof.mutations += 1; throw new Error('clear refused'); },
          };
        },
      };
      return transaction;
    },
  };
  return {
    proof,
    async databases() { return [{ name: database.name, version }, ...extraDatabases]; },
    open(...args) {
      proof.openArgumentCounts.push(args.length);
      proof.openNames.push(args[0]);
      const request = {
        result: database,
        error: null,
        transaction: null,
        onupgradeneeded: null,
        onblocked: null,
        onerror: null,
        onsuccess: null,
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
}

const targetText = 'א'.repeat(8615);
const targetSegments = Array.from({ length: 237 }, (_, index) => ({
  text: `מקטע ${index + 1}`,
  startSeconds: index * 4,
}));
const videos = Array.from({ length: 74 }, (_, index) => ({
  id: index === 0 ? 'o632g7k52c4' : `video-${index}`,
  youtubeId: index === 0 ? 'o632g7k52c4' : `youtube-${index}`,
  archivedAt: index === 73 ? '2026-08-01T00:00:00.000Z' : null,
}));
const storage = createStorage([
  ['yt_mentor_videos_v2', JSON.stringify(videos)],
  ['yt_mentor_deleted_videos_archive_v1', JSON.stringify({ deleted1: { id: 'deleted1' } })],
  ['yt_mentor_deleted_video_ids_v1', JSON.stringify(['deleted1'])],
  ['workspace_library_v1', JSON.stringify([{ id: 'w1' }, { id: 'w2', archivedAt: '2026-08-01T00:00:00.000Z' }])],
  ['market_brief_o632g7k52c4', JSON.stringify({ summary: 'fixture' })],
  ['gems-paste-o632g7k52c4', JSON.stringify({ summary: 'fixture' })],
  ['analysis:o632g7k52c4', JSON.stringify({ summary: 'fixture' })],
  ['yt_mentor_transcript_cache_v1', JSON.stringify({
    o632g7k52c4: { language: 'iw', text: targetText, segments: targetSegments },
  })],
  ['base44_access_token', 'must-not-be-read-or-exported'],
  ['unrelated_key', 'must-not-be-read-or-exported'],
]);
const pointerRecords = [
  { key: 'migration', generationId: 'generation-ready', state: 'ready', sourceHash: 'source-hash' },
  { key: 'activeGeneration', generationId: 'generation-active', state: 'active', sourceHash: 'active-hash' },
  { key: 'activeWorkspaceGeneration', generationId: 'workspace-active', state: 'active', sourceHash: 'workspace-hash' },
  { key: 'workspaceRecoveryAnchor', generationId: 'generation-active', state: 'anchored', evidenceHash: 'evidence-hash' },
];
const indexedDBFactory = createFakeIndexedDb({
  extraDatabases: [{ name: 'unrelated_database', version: 7 }],
  stores: {
    meta: { keyPath: 'key', records: pointerRecords.map((value) => ({ key: value.key, value })) },
    transcripts: {
      keyPath: ['generationId', 'id'],
      indexes: [{ name: 'generationId', keyPath: 'generationId', multiEntry: false, unique: false }],
      records: [{
        key: ['generation-active', 'youtube_transcript_o632g7k52c4'],
        value: {
          generationId: 'generation-active',
          id: 'youtube_transcript_o632g7k52c4',
          videoId: 'o632g7k52c4',
          language: 'iw',
          text: targetText,
          segments: targetSegments,
        },
      }],
    },
    analyses: {
      keyPath: ['generationId', 'id'],
      records: [{ key: ['generation-active', 'analysis-1'], value: { generationId: 'generation-active', id: 'analysis-1' } }],
    },
  },
});
const locationLike = {
  protocol: 'http:',
  hostname: 'localhost',
  port: '5184',
  pathname: '/ytmdb-origin-inventory-v2.html',
  search: '',
  hash: '',
  origin: 'http://localhost:5184',
};
const beforeStorage = storage.snapshot();
const beforePointers = JSON.stringify(pointerRecords);
let networkRequests = 0;
globalThis.fetch = async () => {
  networkRequests += 1;
  throw new Error('network refused');
};

const first = await collectOriginInventoryV2({
  locationLike,
  localStorageArea: storage,
  indexedDBFactory,
  cryptoProvider: webcrypto,
});
const second = await collectOriginInventoryV2({
  locationLike,
  localStorageArea: storage,
  indexedDBFactory,
  cryptoProvider: webcrypto,
});

assert.equal(first.origin, 'http://localhost:5184');
assert.equal(first.localStorage.counts.videos, 74);
assert.equal(first.localStorage.counts.activeVideos, 73);
assert.equal(first.localStorage.counts.archivedVideos, 1);
assert.equal(first.localStorage.counts.deletedArchive, 1);
assert.equal(first.localStorage.counts.workspace, 2);
assert.equal(first.localStorage.counts.workspaceArchived, 1);
assert.equal(first.localStorage.counts.marketBriefs, 1);
assert.equal(first.localStorage.counts.gems, 1);
assert.equal(first.localStorage.counts.analyses, 1);
assert.equal(first.targetTranscript.language, 'iw');
assert.equal(first.targetTranscript.segmentCount, 237);
assert.equal(first.targetTranscript.characterCount, 8615);
assert.equal(first.indexedDb.applicationDatabase.version, 2);
assert.deepEqual(first.indexedDb.unknownDatabases, [{ name: 'unrelated_database', version: 7 }]);
assert.equal(first.indexedDb.applicationDatabase.domainCounts.videos, 0);
assert.equal(first.indexedDb.applicationDatabase.domainCounts.analyses, 1);
assert.equal(first.indexedDb.applicationDatabase.domainCounts.transcripts, 1);
assert.deepEqual(first.indexedDb.applicationDatabase.generations, ['generation-active', 'generation-ready', 'workspace-active']);
assert.equal(first.indexedDb.applicationDatabase.pointers.activeGeneration.generationId, 'generation-active');
assert.equal(first.localStorage.hash, second.localStorage.hash);
assert.equal(first.indexedDb.applicationDatabase.hash, second.indexedDb.applicationDatabase.hash);
assert.equal(first.proof.localStorageUnchanged, true);
assert.equal(first.proof.indexedDbUnchanged, true);
assert.equal(first.proof.pointerSnapshotUnchanged, true);
assert.equal(first.proof.readwriteTransactions, 0);
assert.equal(first.proof.upgradeAttempts, 0);
assert.equal(storage.snapshot(), beforeStorage);
assert.equal(JSON.stringify(pointerRecords), beforePointers);
assert.deepEqual(storage.mutations, { set: 0, remove: 0, clear: 0 });
assert.ok(indexedDBFactory.proof.openArgumentCounts.every((count) => count === 1));
assert.equal(indexedDBFactory.proof.openNames.includes('unrelated_database'), false);
assert.ok(indexedDBFactory.proof.transactionModes.every((mode) => mode === 'readonly'));
assert.equal(indexedDBFactory.proof.mutations, 0);
assert.equal(indexedDBFactory.proof.postCompletionSchemaReads, 0);
assert.equal(networkRequests, 0);
assert.equal(first.localStorage.keys.some((entry) => entry.key === 'base44_access_token'), false);
assert.equal(first.localStorage.keys.some((entry) => entry.key === 'unrelated_key'), false);

const legacyIndexedDbFactory = createFakeIndexedDb({
  name: 'yt_mentor_db_v1',
  version: 1,
  stores: {
    attachments: {
      keyPath: 'id',
      records: [{
        key: 'attachment-1',
        value: { id: 'attachment-1', videoId: 'o632g7k52c4', dataUrl: 'data:image/png;base64,AA==' },
      }],
    },
  },
});
const legacyInventory = await collectOriginInventoryV2({
  locationLike: { ...locationLike, hostname: '127.0.0.1', origin: 'http://127.0.0.1:5184' },
  localStorageArea: createStorage([]),
  indexedDBFactory: legacyIndexedDbFactory,
  cryptoProvider: webcrypto,
});
assert.equal(legacyInventory.indexedDb.applicationDatabase, null);
assert.equal(legacyInventory.indexedDb.legacyDatabases.length, 1);
assert.equal(legacyInventory.indexedDb.legacyDatabases[0].name, 'yt_mentor_db_v1');
assert.equal(legacyInventory.indexedDb.legacyDatabases[0].stores[0].recordCount, 1);
assert.ok(legacyIndexedDbFactory.proof.openArgumentCounts.every((count) => count === 1));
assert.ok(legacyIndexedDbFactory.proof.transactionModes.every((mode) => mode === 'readonly'));
assert.equal(legacyIndexedDbFactory.proof.mutations, 0);
assert.equal(legacyIndexedDbFactory.proof.postCompletionSchemaReads, 0);

const inactiveTransactionError = new DOMException(
  'A request was placed against a transaction which is currently not active.',
  'InvalidStateError',
);
assert.equal(inactiveTransactionError.code, 11);
assert.deepEqual(
  formatInventoryError(inactiveTransactionError, {
    operation: 'read-indexeddb-store:transcripts',
    safeStoppingPoint: 'stopped-after-readonly-open-before-hash-and-without-storage-write',
  }),
  {
    name: 'InvalidStateError',
    message: 'A request was placed against a transaction which is currently not active.',
    code: 11,
    operation: 'read-indexeddb-store:transcripts',
    safeStoppingPoint: 'stopped-after-readonly-open-before-hash-and-without-storage-write',
  },
);

const exported = await collectOriginExportV2({
  locationLike,
  localStorageArea: storage,
  indexedDBFactory,
  cryptoProvider: webcrypto,
  exportedAt: '2026-08-27T08:00:00.000Z',
});
assert.equal(exported.payload.format, 'ytmdb-origin-export-v2');
assert.equal(exported.payload.origin, 'http://localhost:5184');
assert.equal(exported.verification.deterministicReadBack, true);
assert.equal(exported.verification.localStorageRecordCount, 8);
assert.equal(exported.verification.indexedDbRecordCount, 6);
assert.equal(await serializeDeterministically(exported.payload), exported.serialized);
assert.match(exported.sha256, /^[a-f0-9]{64}$/);
assert.equal(exported.serialized.includes('must-not-be-read-or-exported'), false);

const envelope = await encryptOriginExportV2(exported.serialized, 'fixture-passphrase', {
  cryptoProvider: webcrypto,
  iterations: 1_000,
  salt: Uint8Array.from({ length: 16 }, (_, index) => index),
  iv: Uint8Array.from({ length: 12 }, (_, index) => 20 + index),
});
const decrypted = await decryptOriginExportV2(envelope, 'fixture-passphrase', webcrypto);
assert.equal(decrypted, exported.serialized);
const corrupted = structuredClone(envelope);
corrupted.cipher.ciphertext = `${corrupted.cipher.ciphertext.slice(0, -2)}AA`;
await assert.rejects(
  () => decryptOriginExportV2(corrupted, 'fixture-passphrase', webcrypto),
  /operation|decrypt|authentic|data/i,
);

const cloneFixture = {
  arrayBuffer: Uint8Array.from([1, 2, 3]).buffer,
  bigint: 42n,
  blob: new Blob([Uint8Array.from([4, 5, 6])], { type: 'application/octet-stream' }),
  date: new Date('2026-08-27T08:00:00.000Z'),
  typedArray: Uint16Array.from([7, 8, 9]),
  undefinedValue: undefined,
};
const cloneSerialized = await serializeDeterministically(cloneFixture);
const cloneReadBack = deserializeDeterministically(cloneSerialized);
assert.equal(await serializeDeterministically(cloneReadBack), cloneSerialized);

const upgradeProof = { openArgumentCounts: [], aborts: 0, closes: 0 };
const upgradeFactory = {
  async databases() { return [{ name: 'yt_mentor_app_data_v1', version: 2 }]; },
  open(...args) {
    upgradeProof.openArgumentCounts.push(args.length);
    const request = {
      result: { close() { upgradeProof.closes += 1; } },
      error: null,
      transaction: { abort() { upgradeProof.aborts += 1; } },
      onupgradeneeded: null,
      onblocked: null,
      onerror: null,
      onsuccess: null,
    };
    queueMicrotask(() => request.onupgradeneeded?.());
    return request;
  },
};
await assert.rejects(
  () => collectOriginInventoryV2({
    locationLike,
    localStorageArea: createStorage([]),
    indexedDBFactory: upgradeFactory,
    cryptoProvider: webcrypto,
  }),
  /indexeddb-upgrade-refused/,
);
assert.deepEqual(upgradeProof.openArgumentCounts, [1]);
assert.equal(upgradeProof.aborts, 1);
assert.equal(upgradeProof.closes, 1);

const refusedStorage = createStorage([]);
await assert.rejects(
  () => collectOriginInventoryV2({
    locationLike: { ...locationLike, pathname: '/' },
    localStorageArea: refusedStorage,
    indexedDBFactory,
    cryptoProvider: webcrypto,
  }),
  /inventory-origin-not-approved/,
);
assert.deepEqual(refusedStorage.mutations, { set: 0, remove: 0, clear: 0 });

console.log('origin-inventory-v2-qa: PASS');
console.log(JSON.stringify({
  assertions: 70,
  localStorageMutations: storage.mutations,
  indexedDbOpenArgumentCounts: indexedDBFactory.proof.openArgumentCounts,
  indexedDbOpenNames: indexedDBFactory.proof.openNames,
  indexedDbTransactionModes: indexedDBFactory.proof.transactionModes,
  indexedDbMutations: indexedDBFactory.proof.mutations,
  postCompletionSchemaReads: indexedDBFactory.proof.postCompletionSchemaReads,
  networkRequests,
  transcript: first.targetTranscript,
  exportSha256: exported.sha256,
}));
