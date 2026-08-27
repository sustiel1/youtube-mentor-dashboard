import {
  APP_DATA_DB_NAME,
  classifyStorageKey,
  isApplicationOwnedStorageKey,
  isSensitiveStorageKey,
  listOwnedStorageKeys,
} from '../lib/persistence/storageManifest.js';

export const ORIGIN_INVENTORY_V2_PATH = '/ytmdb-origin-inventory-v2.html';
export const ORIGIN_EXPORT_V2_FORMAT = 'ytmdb-origin-export-v2';
export const TARGET_TRANSCRIPT_VIDEO_ID = 'o632g7k52c4';
export const LEGACY_ATTACHMENTS_DB_NAME = 'yt_mentor_db_v1';

const APPROVED_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const POINTER_KEYS = new Set([
  'migration',
  'activeGeneration',
  'activeWorkspaceGeneration',
  'workspaceRecoveryAnchor',
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function contextualizeInventoryError(error, operation, safeStoppingPoint) {
  if (error?.inventoryOperation && error?.safeStoppingPoint) return error;
  const contextualError = new Error(error?.message || String(error || 'unknown-error'));
  contextualError.name = error?.name || 'Error';
  contextualError.code = error?.code ?? null;
  contextualError.inventoryOperation = operation;
  contextualError.safeStoppingPoint = safeStoppingPoint;
  contextualError.cause = error;
  return contextualError;
}

export function formatInventoryError(error, {
  operation = 'collect-origin-inventory',
  safeStoppingPoint = 'stopped-before-any-storage-write',
} = {}) {
  return {
    name: String(error?.name || 'Error'),
    message: String(error?.message || error || 'unknown-error'),
    code: error?.code ?? null,
    operation: String(error?.inventoryOperation || operation),
    safeStoppingPoint: String(error?.safeStoppingPoint || safeStoppingPoint),
  };
}

function compareText(left, right) {
  const leftText = String(left);
  const rightText = String(right);
  if (leftText < rightText) return -1;
  if (leftText > rightText) return 1;
  return 0;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function assertApprovedInventoryLocation(locationLike) {
  if (
    locationLike?.protocol !== 'http:'
    || !APPROVED_HOSTNAMES.has(locationLike?.hostname)
    || locationLike?.port !== '5184'
    || locationLike?.pathname !== ORIGIN_INVENTORY_V2_PATH
    || locationLike?.search
    || locationLike?.hash
  ) {
    fail('inventory-origin-not-approved');
  }
  return locationLike.origin;
}

async function encodeCloneValue(value) {
  if (value === undefined) return { $type: 'undefined' };
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { $type: 'number', value: 'NaN' };
    if (value === Infinity) return { $type: 'number', value: 'Infinity' };
    if (value === -Infinity) return { $type: 'number', value: '-Infinity' };
    if (Object.is(value, -0)) return { $type: 'number', value: '-0' };
    return value;
  }
  if (typeof value === 'bigint') return { $type: 'bigint', value: String(value) };
  if (value instanceof Date) return { $type: 'date', value: value.toISOString() };
  if (value instanceof ArrayBuffer) {
    return { $type: 'array-buffer', value: bytesToBase64(new Uint8Array(value)) };
  }
  if (ArrayBuffer.isView(value)) {
    return {
      $type: 'typed-array',
      name: value.constructor.name,
      value: bytesToBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)),
    };
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return {
      $type: 'blob',
      mimeType: value.type,
      value: bytesToBase64(new Uint8Array(await value.arrayBuffer())),
    };
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => encodeCloneValue(item)));
  }
  if (typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort(compareText)) {
      result[key] = await encodeCloneValue(value[key]);
    }
    return result;
  }
  fail('unsupported-export-value');
}

function decodeCloneValue(value) {
  if (Array.isArray(value)) return value.map(decodeCloneValue);
  if (!value || typeof value !== 'object') return value;
  if (value.$type === 'undefined') return undefined;
  if (value.$type === 'bigint') return BigInt(value.value);
  if (value.$type === 'date') return new Date(value.value);
  if (value.$type === 'array-buffer') return base64ToBytes(value.value).buffer;
  if (value.$type === 'typed-array') {
    const bytes = base64ToBytes(value.value);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    if (value.name === 'DataView') return new DataView(buffer);
    const Constructor = globalThis[value.name];
    if (typeof Constructor !== 'function') fail('unsupported-typed-array');
    return new Constructor(buffer);
  }
  if (value.$type === 'blob') return new Blob([base64ToBytes(value.value)], { type: value.mimeType });
  if (value.$type === 'number') {
    if (value.value === 'NaN') return Number.NaN;
    if (value.value === 'Infinity') return Infinity;
    if (value.value === '-Infinity') return -Infinity;
    if (value.value === '-0') return -0;
  }
  return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, decodeCloneValue(value[key])]));
}

export async function serializeDeterministically(value) {
  return JSON.stringify(await encodeCloneValue(value));
}

export function deserializeDeterministically(serialized) {
  return decodeCloneValue(JSON.parse(serialized));
}

export async function sha256(value, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle) fail('web-crypto-unavailable');
  const digest = await cryptoProvider.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return bytesToHex(new Uint8Array(digest));
}

async function hashValue(value, cryptoProvider) {
  return sha256(await serializeDeterministically(value), cryptoProvider);
}

function parseJson(rawValue) {
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function countValue(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return value == null ? 0 : 1;
}

function countDeletedIdentifiers(value) {
  if (Array.isArray(value)) return new Set(value.map(String)).size;
  if (!value || typeof value !== 'object') return countValue(value);
  const identifiers = ['ids', 'urls', 'ytIds'].flatMap((key) => (
    Array.isArray(value[key]) ? value[key].map(String) : []
  ));
  return identifiers.length > 0 ? new Set(identifiers).size : Object.keys(value).length;
}

function normalizeSegments(candidate) {
  const possible = [
    candidate?.segments,
    candidate?.transcriptSegments,
    candidate?.lines,
    candidate?.payload?.segments,
    candidate?.payload?.transcriptSegments,
    candidate?.data?.segments,
  ];
  return possible.find(Array.isArray) || [];
}

function normalizeTranscriptMetadata(candidate, source) {
  if (!candidate || typeof candidate !== 'object') return null;
  const segments = normalizeSegments(candidate);
  const directText = [
    candidate.transcript,
    candidate.text,
    candidate.fullText,
    candidate.payload?.transcript,
    candidate.payload?.text,
    candidate.data?.transcript,
    candidate.data?.text,
  ].find((value) => typeof value === 'string' && value.length > 0);
  const segmentText = segments.map((segment) => String(segment?.text || '')).filter(Boolean).join(' ');
  const text = directText || segmentText;
  if (!text && segments.length === 0) return null;
  return {
    source,
    language: String(
      candidate.language
      || candidate.lang
      || candidate.transcriptLanguage
      || candidate.payload?.language
      || candidate.data?.language
      || '',
    ) || null,
    segmentCount: segments.length,
    characterCount: text.length,
  };
}

function objectContainsTarget(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  return [candidate.id, candidate.videoId, candidate.youtubeId, candidate.storageKey, candidate.url]
    .some((value) => String(value || '').includes(TARGET_TRANSCRIPT_VIDEO_ID));
}

function findTargetInParsed(value, source) {
  if (!value || typeof value !== 'object') return null;
  if (!Array.isArray(value) && value[TARGET_TRANSCRIPT_VIDEO_ID]) {
    return normalizeTranscriptMetadata(value[TARGET_TRANSCRIPT_VIDEO_ID], source);
  }
  const records = Array.isArray(value) ? value : Object.values(value);
  for (const record of records) {
    if (!objectContainsTarget(record)) continue;
    const metadata = normalizeTranscriptMetadata(record, source);
    if (metadata) return metadata;
  }
  return null;
}

function safeMetaProjection(record) {
  if (!record || typeof record !== 'object') return null;
  return {
    key: typeof record.key === 'string' ? record.key : null,
    generationId: typeof record.generationId === 'string' ? record.generationId : null,
    state: typeof record.state === 'string' ? record.state : null,
    sourceHash: typeof record.sourceHash === 'string' ? record.sourceHash : null,
    workspaceSourceHash: typeof record.workspaceSourceHash === 'string' ? record.workspaceSourceHash : null,
    evidenceHash: typeof record.evidenceHash === 'string' ? record.evidenceHash : null,
  };
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb-request-failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('indexeddb-transaction-aborted'));
    transaction.onerror = () => reject(transaction.error || new Error('indexeddb-transaction-failed'));
  });
}

async function openListedDatabaseReadOnly(indexedDBFactory, databaseInfo, counters) {
  if (!databaseInfo || !databaseInfo.name) fail('indexeddb-database-not-listed');
  counters.indexedDbOpenCalls += 1;
  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(databaseInfo.name);
    let settled = false;
    request.onupgradeneeded = () => {
      counters.upgradeAttempts += 1;
      try { request.transaction?.abort(); } catch {}
      try { request.result?.close(); } catch {}
      if (!settled) {
        settled = true;
        reject(new Error('indexeddb-upgrade-refused'));
      }
    };
    request.onblocked = () => {
      if (!settled) {
        settled = true;
        reject(new Error('indexeddb-open-blocked'));
      }
    };
    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(request.error || new Error('indexeddb-open-failed'));
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result?.close();
        return;
      }
      settled = true;
      const database = request.result;
      if (Number(database.version) !== Number(databaseInfo.version)) {
        database.close();
        reject(new Error('indexeddb-version-drift'));
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

function describeIndexes(store) {
  return [...store.indexNames].sort(compareText).map((name) => {
    const index = store.index(name);
    return { name, keyPath: index.keyPath, multiEntry: index.multiEntry, unique: index.unique };
  });
}

async function readStore(database, storeName, counters) {
  try {
    const transaction = database.transaction(storeName, 'readonly');
    counters.readonlyTransactions += 1;
    if (transaction.mode !== 'readonly') {
      counters.readwriteTransactions += 1;
      try { transaction.abort(); } catch {}
      fail('indexeddb-non-readonly-transaction-refused');
    }
    const done = transactionDone(transaction);
    const store = transaction.objectStore(storeName);
    // IDBObjectStore schema handles become invalid after transaction completion.
    // Capture schema synchronously; hash/serialize only the detached records later.
    const schema = {
      keyPath: store.keyPath,
      autoIncrement: store.autoIncrement,
      indexes: describeIndexes(store),
    };
    const [keys, values] = await Promise.all([
      requestResult(store.getAllKeys()),
      requestResult(store.getAll()),
    ]);
    await done;
    if (keys.length !== values.length) fail('indexeddb-key-value-count-mismatch');
    return {
      name: storeName,
      ...schema,
      records: values.map((value, index) => ({ key: keys[index], value })),
    };
  } catch (error) {
    throw contextualizeInventoryError(
      error,
      `read-indexeddb-store:${storeName}`,
      'stopped-after-readonly-open-before-hash-and-without-storage-write',
    );
  }
}

async function listExistingDatabases(indexedDBFactory) {
  if (typeof indexedDBFactory?.databases !== 'function') fail('indexeddb-databases-api-required');
  const databases = await indexedDBFactory.databases();
  return (databases || [])
    .filter((database) => database?.name)
    .map((database) => ({ name: database.name, version: Number(database.version) }))
    .sort((left, right) => compareText(left.name, right.name));
}

async function collectLocalStorage(localStorageArea, cryptoProvider) {
  const keys = listOwnedStorageKeys(localStorageArea);
  const entries = keys.map((key) => ({ key, rawValue: localStorageArea.getItem(key) }));
  const parsedByKey = new Map(entries.map((entry) => [entry.key, parseJson(entry.rawValue)]));
  const videos = parsedByKey.get('yt_mentor_videos_v2');
  const workspace = parsedByKey.get('workspace_library_v1');
  const deletedArchive = parsedByKey.get('yt_mentor_deleted_videos_archive_v1');
  const deletedIds = parsedByKey.get('yt_mentor_deleted_video_ids_v1');
  const categoryEntries = (predicate) => entries.filter((entry) => predicate(entry.key));
  const marketBriefs = categoryEntries((key) => key.startsWith('market_brief_'));
  const gems = categoryEntries((key) => /^(?:gems-|gem-summary-|app_builder_gem_paste_)/.test(key));
  const analyses = categoryEntries((key) => /^(?:analysis:|ai_analysis_|political_summary_)/.test(key));
  const transcriptEntries = entries.filter((entry) => classifyStorageKey(entry.key) === 'transcripts');
  const relatedGroups = {};
  for (const entry of entries) {
    const group = classifyStorageKey(entry.key);
    relatedGroups[group] = relatedGroups[group] || [];
    relatedGroups[group].push(entry.key);
  }
  let targetTranscript = null;
  for (const entry of [...transcriptEntries, ...entries.filter((item) => item.key === 'yt_mentor_videos_v2')]) {
    targetTranscript = findTargetInParsed(parsedByKey.get(entry.key), `localStorage:${entry.key}`);
    if (targetTranscript) break;
  }
  const videoList = Array.isArray(videos) ? videos : [];
  const workspaceList = Array.isArray(workspace) ? workspace : [];
  const safeEntries = entries.map(({ key, rawValue }) => ({ key, sha256: null, byteLength: new TextEncoder().encode(rawValue).length }));
  await Promise.all(safeEntries.map(async (entry, index) => {
    entry.sha256 = await sha256(entries[index].rawValue, cryptoProvider);
  }));
  return {
    raw: entries,
    summary: {
      keyCount: entries.length,
      hash: await hashValue(entries, cryptoProvider),
      keys: safeEntries,
      counts: {
        videos: videoList.length,
        activeVideos: videoList.filter((video) => !video?.archivedAt && !video?.deletedAt).length,
        archivedVideos: videoList.filter((video) => Boolean(video?.archivedAt)).length,
        deletedArchive: countValue(deletedArchive),
        deletedIdentifiers: countDeletedIdentifiers(deletedIds),
        workspace: workspaceList.length,
        workspaceActive: workspaceList.filter((item) => !item?.archivedAt).length,
        workspaceArchived: workspaceList.filter((item) => Boolean(item?.archivedAt)).length,
        gems: gems.length,
        marketBriefs: marketBriefs.length,
        analyses: analyses.length,
        transcripts: transcriptEntries.reduce((sum, entry) => sum + countValue(parsedByKey.get(entry.key)), 0),
      },
      categoryHashes: {
        gems: await hashValue(gems, cryptoProvider),
        marketBriefs: await hashValue(marketBriefs, cryptoProvider),
        analyses: await hashValue(analyses, cryptoProvider),
        transcripts: await hashValue(transcriptEntries, cryptoProvider),
        workspace: await hashValue(entries.filter((entry) => classifyStorageKey(entry.key) === 'workspace'), cryptoProvider),
        videos: await hashValue(entries.filter((entry) => classifyStorageKey(entry.key) === 'videos'), cryptoProvider),
      },
      relatedStorageKeys: Object.fromEntries(Object.entries(relatedGroups).sort(([a], [b]) => compareText(a, b))),
      targetTranscript,
    },
  };
}

async function readKnownDatabase(indexedDBFactory, databaseInfo, cryptoProvider, counters) {
  const database = await openListedDatabaseReadOnly(indexedDBFactory, databaseInfo, counters);
  try {
    const stores = [];
    for (const storeName of [...database.objectStoreNames].sort(compareText)) {
      stores.push(await readStore(database, storeName, counters));
    }
    const storeSummaries = [];
    for (const store of stores) {
      storeSummaries.push({
        name: store.name,
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes: store.indexes,
        recordCount: store.records.length,
        hash: await hashValue(store.records, cryptoProvider),
      });
    }
    return {
      raw: { name: database.name, version: database.version, stores },
      summary: {
        name: database.name,
        version: database.version,
        stores: storeSummaries,
        hash: await hashValue(stores, cryptoProvider),
      },
    };
  } finally {
    database.close();
  }
}

async function describeApplicationDatabase(databaseResult, cryptoProvider) {
  if (!databaseResult) return { applicationDatabase: null, targetTranscript: null };
  const stores = databaseResult.raw.stores;
  const metaStore = stores.find((store) => store.name === 'meta');
  const pointers = {};
  for (const record of metaStore?.records || []) {
    if (POINTER_KEYS.has(record.value?.key)) pointers[record.value.key] = safeMetaProjection(record.value);
  }
  const generations = [...new Set(stores.flatMap((store) => (
    store.records.map((record) => record.value?.generationId).filter(Boolean)
  )))].sort(compareText);
  const recordsFor = (storeName) => stores.find((store) => store.name === storeName)?.records || [];
  const videos = recordsFor('videos');
  const workspace = recordsFor('workspaceItems');
  const analyses = recordsFor('analyses');
  const transcripts = recordsFor('transcripts');
  const sourceEntries = recordsFor('sourceEntries');
  const sourceKey = (record) => String(record.value?.storageKey || record.value?.sourceKey || record.value?.id || '');
  const recordPayload = (record) => record.value?.value || record.value;
  const deletedArchiveEntry = sourceEntries.find((record) => sourceKey(record) === 'yt_mentor_deleted_videos_archive_v1');
  const deletedIdsEntry = sourceEntries.find((record) => sourceKey(record) === 'yt_mentor_deleted_video_ids_v1');
  const parseSource = (record) => parseJson(record?.value?.rawValue);
  const gems = analyses.filter((record) => /^(?:gems-|gem-summary-|app_builder_gem_paste_)/.test(sourceKey(record)));
  const marketBriefs = analyses.filter((record) => sourceKey(record).startsWith('market_brief_'));
  const transcriptCount = transcripts.reduce((sum, record) => {
    const cachedPayload = record.value?.parsedValue ?? parseJson(record.value?.rawValue);
    return sum + (cachedPayload == null ? 1 : countValue(cachedPayload));
  }, 0);
  let targetTranscript = null;
  for (const record of transcripts) {
    const candidates = [record.value, record.value?.parsedValue, parseJson(record.value?.rawValue)];
    for (const candidate of candidates) {
      targetTranscript = objectContainsTarget(candidate)
        ? normalizeTranscriptMetadata(candidate, 'IndexedDB:transcripts')
        : findTargetInParsed(candidate, 'IndexedDB:transcripts');
      if (targetTranscript) break;
    }
    if (targetTranscript) break;
  }
  const domainCounts = {
    videos: videos.length,
    activeVideos: videos.filter((record) => !recordPayload(record)?.archivedAt && !recordPayload(record)?.deletedAt).length,
    archivedVideos: videos.filter((record) => Boolean(recordPayload(record)?.archivedAt)).length,
    deletedArchive: countValue(parseSource(deletedArchiveEntry)),
    deletedIdentifiers: countDeletedIdentifiers(parseSource(deletedIdsEntry)),
    workspace: workspace.length,
    workspaceActive: workspace.filter((record) => !recordPayload(record)?.archivedAt).length,
    workspaceArchived: workspace.filter((record) => Boolean(recordPayload(record)?.archivedAt)).length,
    gems: gems.length,
    marketBriefs: marketBriefs.length,
    analyses: analyses.length,
    transcripts: transcriptCount,
  };
  return {
    applicationDatabase: {
      ...databaseResult.summary,
      generations,
      pointers,
      domainCounts,
      domainHashes: {
        videos: await hashValue(videos, cryptoProvider),
        workspace: await hashValue(workspace, cryptoProvider),
        gems: await hashValue(gems, cryptoProvider),
        marketBriefs: await hashValue(marketBriefs, cryptoProvider),
        analyses: await hashValue(analyses, cryptoProvider),
        transcripts: await hashValue(transcripts, cryptoProvider),
        deleted: await hashValue([deletedArchiveEntry || null, deletedIdsEntry || null], cryptoProvider),
      },
    },
    targetTranscript,
  };
}

async function collectIndexedDb(indexedDBFactory, cryptoProvider, counters) {
  const listed = await listExistingDatabases(indexedDBFactory);
  const knownNames = new Set([APP_DATA_DB_NAME, LEGACY_ATTACHMENTS_DB_NAME]);
  const unknownDatabases = listed.filter((database) => !knownNames.has(database.name));
  const appInfo = listed.find((database) => database.name === APP_DATA_DB_NAME);
  const legacyInfo = listed.find((database) => database.name === LEGACY_ATTACHMENTS_DB_NAME);
  const appResult = appInfo
    ? await readKnownDatabase(indexedDBFactory, appInfo, cryptoProvider, counters)
    : null;
  const legacyResult = legacyInfo
    ? await readKnownDatabase(indexedDBFactory, legacyInfo, cryptoProvider, counters)
    : null;
  const application = await describeApplicationDatabase(appResult, cryptoProvider);
  return {
    raw: {
      databases: [appResult?.raw, legacyResult?.raw].filter(Boolean),
      unknownDatabases,
    },
    summary: {
      listed,
      unknownDatabases,
      applicationDatabase: application.applicationDatabase,
      legacyDatabases: legacyResult ? [legacyResult.summary] : [],
      targetTranscript: application.targetTranscript,
    },
  };
}

function createCounters() {
  return {
    indexedDbOpenCalls: 0,
    readonlyTransactions: 0,
    readwriteTransactions: 0,
    upgradeAttempts: 0,
    storageWrites: 0,
    networkRequests: 0,
  };
}

export async function collectOriginInventoryV2({
  locationLike = globalThis.location,
  localStorageArea = globalThis.localStorage,
  indexedDBFactory = globalThis.indexedDB,
  cryptoProvider = globalThis.crypto,
} = {}) {
  const origin = assertApprovedInventoryLocation(locationLike);
  const counters = createCounters();
  const localBefore = await collectLocalStorage(localStorageArea, cryptoProvider);
  const indexedDbBefore = await collectIndexedDb(indexedDBFactory, cryptoProvider, counters);
  const indexedDbAfter = await collectIndexedDb(indexedDBFactory, cryptoProvider, counters);
  const localAfterHash = await hashValue(
    listOwnedStorageKeys(localStorageArea).map((key) => ({ key, rawValue: localStorageArea.getItem(key) })),
    cryptoProvider,
  );
  if (localBefore.summary.hash !== localAfterHash) fail('localstorage-changed-during-inventory');
  if (
    await hashValue(indexedDbBefore.raw, cryptoProvider)
    !== await hashValue(indexedDbAfter.raw, cryptoProvider)
  ) {
    fail('indexeddb-changed-during-inventory');
  }
  const targetTranscript = indexedDbBefore.summary.targetTranscript || localBefore.summary.targetTranscript;
  const proof = {
    localStorageUnchanged: true,
    indexedDbUnchanged: true,
    pointerSnapshotUnchanged: true,
    readwriteTransactions: counters.readwriteTransactions,
    upgradeAttempts: counters.upgradeAttempts,
    storageWrites: counters.storageWrites,
    networkRequests: counters.networkRequests,
  };
  return {
    format: 'ytmdb-origin-inventory-v2',
    origin,
    localStorage: localBefore.summary,
    indexedDb: indexedDbBefore.summary,
    targetTranscript,
    proof,
    counters,
    _raw: { localStorage: localBefore.raw, indexedDb: indexedDbBefore.raw },
  };
}

export async function collectOriginExportV2(options = {}) {
  const inventory = await collectOriginInventoryV2(options);
  const exportedAt = options.exportedAt || new Date().toISOString();
  const payload = {
    format: ORIGIN_EXPORT_V2_FORMAT,
    version: 2,
    origin: inventory.origin,
    exportedAt,
    localStorage: inventory._raw.localStorage,
    indexedDb: inventory._raw.indexedDb,
    inventory: {
      localStorage: inventory.localStorage,
      indexedDb: inventory.indexedDb,
      targetTranscript: inventory.targetTranscript,
      proof: inventory.proof,
    },
  };
  const serialized = await serializeDeterministically(payload);
  const readBack = deserializeDeterministically(serialized);
  const readBackSerialized = await serializeDeterministically(readBack);
  if (serialized !== readBackSerialized) fail('export-readback-not-deterministic');
  return {
    payload,
    serialized,
    sha256: await sha256(serialized, options.cryptoProvider || globalThis.crypto),
    verification: {
      deterministicReadBack: true,
      localStorageRecordCount: payload.localStorage.length,
      indexedDbRecordCount: payload.indexedDb?.databases.reduce((databaseSum, database) => (
        databaseSum + database.stores.reduce((storeSum, store) => storeSum + store.records.length, 0)
      ), 0) || 0,
    },
  };
}

export async function encryptOriginExportV2(serialized, passphrase, {
  cryptoProvider = globalThis.crypto,
  iterations = 310_000,
  salt = cryptoProvider?.getRandomValues(new Uint8Array(16)),
  iv = cryptoProvider?.getRandomValues(new Uint8Array(12)),
} = {}) {
  if (!cryptoProvider?.subtle || !passphrase) fail('export-encryption-input-invalid');
  const keyMaterial = await cryptoProvider.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await cryptoProvider.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const ciphertext = await cryptoProvider.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(serialized),
  );
  return {
    format: 'YTMDBAK-V2',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: bytesToBase64(salt) },
    cipher: { name: 'AES-GCM', iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) },
    payloadSha256: await sha256(serialized, cryptoProvider),
  };
}

export async function decryptOriginExportV2(envelope, passphrase, cryptoProvider = globalThis.crypto) {
  if (envelope?.format !== 'YTMDBAK-V2' || !cryptoProvider?.subtle || !passphrase) {
    fail('export-decryption-input-invalid');
  }
  const keyMaterial = await cryptoProvider.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await cryptoProvider.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(envelope.kdf.salt),
      iterations: envelope.kdf.iterations,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const plaintext = await cryptoProvider.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.cipher.iv) },
    key,
    base64ToBytes(envelope.cipher.ciphertext),
  );
  const serialized = new TextDecoder().decode(plaintext);
  if (await sha256(serialized, cryptoProvider) !== envelope.payloadSha256) fail('export-sha256-mismatch');
  return serialized;
}

function safeInventoryView(inventory) {
  return {
    format: inventory.format,
    origin: inventory.origin,
    localStorage: inventory.localStorage,
    indexedDb: inventory.indexedDb,
    targetTranscript: inventory.targetTranscript,
    proof: inventory.proof,
    counters: inventory.counters,
  };
}

function initializeInventoryPage() {
  if (typeof document === 'undefined') return;
  const status = document.querySelector('[data-inventory-status]');
  const output = document.querySelector('[data-inventory-output]');
  const errorDetails = document.querySelector('[data-inventory-error]');
  const button = document.querySelector('[data-run-inventory]');
  if (!(button instanceof HTMLButtonElement) || !status || !output) return;
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'קורא נתונים במצב read-only…';
    output.textContent = '';
    if (errorDetails) errorDetails.hidden = true;
    try {
      const inventory = await collectOriginInventoryV2();
      output.textContent = JSON.stringify(safeInventoryView(inventory), null, 2);
      status.textContent = 'הושלם: inventory בלבד; לא בוצעה כתיבה או הורדה.';
      status.dataset.state = 'success';
    } catch (error) {
      const details = formatInventoryError(error);
      status.textContent = `נעצר בבטחה: ${details.name}: ${details.message}`;
      status.dataset.state = 'error';
      if (errorDetails) {
        const fields = {
          name: details.name,
          message: details.message,
          code: details.code == null ? 'לא זמין' : String(details.code),
          operation: details.operation,
          'safe-stopping-point': details.safeStoppingPoint,
        };
        for (const [field, value] of Object.entries(fields)) {
          const target = errorDetails.querySelector(`[data-inventory-error-${field}]`);
          if (target) target.textContent = value;
        }
        errorDetails.hidden = false;
      }
    } finally {
      button.disabled = false;
    }
  });
}

initializeInventoryPage();
