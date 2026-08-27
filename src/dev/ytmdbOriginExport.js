import {
  APPROVED_GIT_CONTEXT,
  APPROVED_ORIGIN,
  CACHE_STORAGE_ALLOWLIST,
  EXPECTED_WORKSPACE_INTEGRITY,
  EXPORT_PAGE_PATH,
  INDEXED_DB_ALLOWLIST,
  LOCAL_STORAGE_DYNAMIC_PREFIXES,
  LOCAL_STORAGE_FIXED_KEYS,
  SESSION_STORAGE_DYNAMIC_PREFIXES,
  SESSION_STORAGE_FIXED_KEYS,
  UNSUPPORTED_APPLICATION_DATABASES,
} from './ytmdbOriginStorageManifest.js';

const SNAPSHOT_FORMAT = 'ytmdb-origin-memory-snapshot-v1';
const STRUCTURED_CLONE_FORMAT = 'ytmdb-structured-clone-v1';
const WORKSPACE_ITEMS_KEY = 'workspace_library_v1';
const APPROVED_RUNTIME_PATHNAMES = Object.freeze([
  EXPORT_PAGE_PATH,
  '/ytmdb-origin-migration.html',
]);
const WORKSPACE_TOPIC_ASSIGNMENT_FIELDS = Object.freeze([
  'topicId',
  'subTopicId',
  'subtopicId',
  'topicName',
  'subTopicName',
  'subtopicName',
  'category',
  'subCategory',
]);
const MIGRATION_TOPIC_ASSIGNMENT_FIELDS = Object.freeze([
  'topicId',
  'topicName',
  'subTopicId',
  'subtopicId',
  'subTopicName',
  'subtopicName',
]);
const BACKUP_PROTOCOL = 'YTMDBAK-LOOPBACK-v1';
const BACKUP_KDF_ITERATIONS = 600_000;
const BACKUP_TAG_BYTES = 16;

let collectedPayloadInMemory = null;
let collectedMetadataInMemory = null;

export class CollectorError extends Error {
  constructor(code, safeMessage) {
    super(safeMessage);
    this.name = 'CollectorError';
    this.code = code;
    this.safeMessage = safeMessage;
  }
}

function fail(code, safeMessage) {
  throw new CollectorError(code, safeMessage);
}

export function stringToUtf16CodeUnits(value) {
  const source = String(value);
  const codeUnits = new Array(source.length);
  for (let index = 0; index < source.length; index += 1) {
    codeUnits[index] = source.charCodeAt(index);
  }
  return codeUnits;
}

export function utf16CodeUnitsToString(codeUnits) {
  if (!Array.isArray(codeUnits)) fail('invalid-utf16', 'נתוני UTF-16 פנימיים אינם תקינים.');
  const chunks = [];
  const chunkSize = 8192;
  for (let offset = 0; offset < codeUnits.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...codeUnits.slice(offset, offset + chunkSize)));
  }
  return chunks.join('');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function canonicalSha256(value) {
  if (!globalThis.crypto?.subtle) fail('crypto-unavailable', 'Web Crypto אינו זמין בדף זה.');
  const canonical = JSON.stringify(canonicalize(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToBase64(bytes) {
  const source = new Uint8Array(bytes);
  let binary = '';
  for (let offset = 0; offset < source.length; offset += 8192) {
    binary += String.fromCharCode(...source.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    fail('backup-protocol-invalid', 'ה־helper המקומי החזיר תשובה לא תקינה.');
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function joinBytes(...parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function canonicalBytes(value) {
  return new TextEncoder().encode(JSON.stringify(canonicalize(value)));
}

async function readSafeLoopbackResponse(response) {
  let parsed;
  try {
    parsed = await response.json();
  } catch {
    fail('backup-helper-invalid', 'ה־helper המקומי החזיר תשובה לא תקינה.');
  }
  if (!response.ok || parsed?.ok !== true) {
    fail('backup-helper-rejected', 'ה־helper המקומי דחה את הבקשה בבטחה. יש להפעיל session חדש.');
  }
  return parsed;
}

async function postLoopbackJson(url, payload) {
  return readSafeLoopbackResponse(await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(payload),
  }));
}

async function encryptCollectedPayloadToLoopback(port, payload, metadata) {
  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort < 1024 || numericPort > 65535) {
    fail('backup-port-invalid', 'יש להזין פורט loopback תקין שהוצג על־ידי ה־helper המקומי.');
  }
  assertApprovedRuntimeLocation();
  const helperOrigin = `http://127.0.0.1:${numericPort}`;
  const session = await readSafeLoopbackResponse(await fetch(`${helperOrigin}/v1/session`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  }));
  if (session.protocol !== BACKUP_PROTOCOL) {
    fail('backup-protocol-mismatch', 'גרסת פרוטוקול ה־helper אינה תואמת.');
  }

  const payloadBytes = canonicalBytes(payload);
  const transportKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  let finalKeyBytes = null;
  try {
    const publicKey = await crypto.subtle.importKey(
      'spki',
      base64ToBytes(session.publicKeySpki),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
    const wrappedTransportKey = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      transportKeyBytes,
    ));
    const keyParcel = await postLoopbackJson(`${helperOrigin}/v1/key`, {
      sessionId: session.sessionId,
      capability: session.capability,
      wrappedTransportKey: bytesToBase64(wrappedTransportKey),
    });
    const transportKey = await crypto.subtle.importKey(
      'raw',
      transportKeyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );
    finalKeyBytes = new Uint8Array(await crypto.subtle.decrypt({
      name: 'AES-GCM',
      iv: base64ToBytes(keyParcel.nonce),
      additionalData: canonicalBytes({ format: 'YTMDBAK-key-parcel-v1', sessionId: session.sessionId }),
      tagLength: 128,
    }, transportKey, joinBytes(base64ToBytes(keyParcel.ciphertext), base64ToBytes(keyParcel.tag))));
    if (finalKeyBytes.length !== 32) fail('backup-key-invalid', 'ה־helper המקומי החזיר מפתח לא תקין.');

    const payloadSha256 = await canonicalSha256(payload);
    const header = {
      format: 'YTMDBAK',
      version: 1,
      cipher: 'AES-256-GCM',
      kdf: {
        name: 'PBKDF2-HMAC-SHA256',
        iterations: BACKUP_KDF_ITERATIONS,
        salt: session.salt,
        passphraseEncoding: 'UTF-8',
      },
      nonce: session.finalNonce,
      tagBytes: BACKUP_TAG_BYTES,
      payload: {
        canonicalization: 'JSON-key-sort-v1',
        byteLength: payloadBytes.length,
        sha256: payloadSha256,
      },
      metadata: canonicalize(metadata),
      createdAt: new Date().toISOString(),
    };
    const headerBytes = canonicalBytes(header);
    const finalKey = await crypto.subtle.importKey(
      'raw', finalKeyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'],
    );
    const encryptedWithTag = new Uint8Array(await crypto.subtle.encrypt({
      name: 'AES-GCM',
      iv: base64ToBytes(session.finalNonce),
      additionalData: headerBytes,
      tagLength: 128,
    }, finalKey, payloadBytes));
    const verifiedPlaintext = new Uint8Array(await crypto.subtle.decrypt({
      name: 'AES-GCM',
      iv: base64ToBytes(session.finalNonce),
      additionalData: headerBytes,
      tagLength: 128,
    }, finalKey, encryptedWithTag));
    try {
      if (
        verifiedPlaintext.length !== payloadBytes.length
        || await canonicalSha256(JSON.parse(new TextDecoder().decode(verifiedPlaintext))) !== payloadSha256
      ) {
        fail('backup-verification-failed', 'אימות ההצפנה בזיכרון נכשל. לא נשלח קובץ.');
      }
    } catch (error) {
      if (error instanceof CollectorError) throw error;
      fail('backup-verification-failed', 'אימות ההצפנה בזיכרון נכשל. לא נשלח קובץ.');
    } finally {
      verifiedPlaintext.fill(0);
    }
    const ciphertext = encryptedWithTag.subarray(0, encryptedWithTag.length - BACKUP_TAG_BYTES);
    const tag = encryptedWithTag.subarray(encryptedWithTag.length - BACKUP_TAG_BYTES);
    const result = await postLoopbackJson(`${helperOrigin}/v1/archive`, {
      sessionId: session.sessionId,
      capability: session.capability,
      header: bytesToBase64(headerBytes),
      ciphertext: bytesToBase64(ciphertext),
      tag: bytesToBase64(tag),
    });
    return {
      fileName: result.fileName,
      byteLength: result.byteLength,
      sha256: result.sha256,
      payloadSha256,
    };
  } finally {
    payloadBytes.fill(0);
    transportKeyBytes.fill(0);
    finalKeyBytes?.fill(0);
  }
}

function encodeNumber(value) {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return 'Infinity';
  if (value === -Infinity) return '-Infinity';
  if (Object.is(value, -0)) return '-0';
  return String(value);
}

function encodeBinaryBytes(buffer, byteOffset = 0, byteLength = buffer.byteLength) {
  return Array.from(new Uint8Array(buffer, byteOffset, byteLength));
}

function assertFixedBuffer(buffer) {
  if (buffer?.resizable === true || buffer?.growable === true) {
    fail('unsupported-structured-clone-type', 'נמצא טיפוס IndexedDB שאינו נתמך באופן lossless.');
  }
}

function createSerializationContext() {
  return {
    seen: new WeakMap(),
    nextReferenceId: 1,
  };
}

function beginReference(value, context) {
  const existing = context.seen.get(value);
  if (existing) return { existing };
  const id = context.nextReferenceId;
  context.nextReferenceId += 1;
  context.seen.set(value, id);
  return { id };
}

function utf16String(value) {
  return {
    type: 'string',
    encoding: 'utf-16-code-units',
    codeUnits: stringToUtf16CodeUnits(value),
  };
}

async function serializeCloneNode(value, context) {
  if (value === null) return { type: 'null' };
  if (value === undefined) return { type: 'undefined' };

  const primitiveType = typeof value;
  if (primitiveType === 'string') return utf16String(value);
  if (primitiveType === 'boolean') return { type: 'boolean', value };
  if (primitiveType === 'number') return { type: 'number', value: encodeNumber(value) };
  if (primitiveType === 'bigint') return { type: 'bigint', value: value.toString(10) };
  if (primitiveType === 'symbol' || primitiveType === 'function') {
    fail('unsupported-structured-clone-type', 'נמצא טיפוס IndexedDB שאינו נתמך באופן lossless.');
  }

  const reference = beginReference(value, context);
  if (reference.existing) return { type: 'reference', id: reference.existing };
  const { id } = reference;

  if (typeof File !== 'undefined' && value instanceof File) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    return {
      type: 'file',
      id,
      name: utf16String(value.name),
      mimeType: utf16String(value.type),
      lastModified: encodeNumber(value.lastModified),
      bytes: Array.from(bytes),
    };
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    return {
      type: 'blob',
      id,
      mimeType: utf16String(value.type),
      bytes: Array.from(bytes),
    };
  }

  if (value instanceof ArrayBuffer) {
    assertFixedBuffer(value);
    return { type: 'array-buffer', id, bytes: encodeBinaryBytes(value) };
  }

  if (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer) {
    assertFixedBuffer(value);
    return { type: 'shared-array-buffer', id, bytes: encodeBinaryBytes(value) };
  }

  if (ArrayBuffer.isView(value)) {
    assertFixedBuffer(value.buffer);
    if (value instanceof DataView) {
      return {
        type: 'data-view',
        id,
        byteOffset: value.byteOffset,
        byteLength: value.byteLength,
        buffer: await serializeCloneNode(value.buffer, context),
      };
    }
    const constructorName = value.constructor?.name;
    const supportedConstructors = new Set([
      'Int8Array',
      'Uint8Array',
      'Uint8ClampedArray',
      'Int16Array',
      'Uint16Array',
      'Int32Array',
      'Uint32Array',
      'Float32Array',
      'Float64Array',
      'BigInt64Array',
      'BigUint64Array',
    ]);
    if (!supportedConstructors.has(constructorName)) {
      fail('unsupported-structured-clone-type', 'נמצא טיפוס IndexedDB שאינו נתמך באופן lossless.');
    }
    return {
      type: 'typed-array',
      id,
      constructorName,
      byteOffset: value.byteOffset,
      length: value.length,
      buffer: await serializeCloneNode(value.buffer, context),
    };
  }

  if (value instanceof Date) {
    return { type: 'date', id, milliseconds: encodeNumber(value.getTime()) };
  }

  if (value instanceof RegExp) {
    return {
      type: 'regexp',
      id,
      source: utf16String(value.source),
      flags: utf16String(value.flags),
      lastIndex: value.lastIndex,
    };
  }

  if (value instanceof Map) {
    const entries = [];
    for (const [entryKey, entryValue] of value.entries()) {
      entries.push([
        await serializeCloneNode(entryKey, context),
        await serializeCloneNode(entryValue, context),
      ]);
    }
    return { type: 'map', id, entries };
  }

  if (value instanceof Set) {
    const entries = [];
    for (const entry of value.values()) {
      entries.push(await serializeCloneNode(entry, context));
    }
    return { type: 'set', id, entries };
  }

  const symbolKeys = Object.getOwnPropertySymbols(value);
  if (symbolKeys.length > 0) {
    fail('unsupported-structured-clone-type', 'נמצא טיפוס IndexedDB שאינו נתמך באופן lossless.');
  }

  if (Array.isArray(value)) {
    const nonEnumerableNames = Object.getOwnPropertyNames(value)
      .filter((key) => key !== 'length' && !Object.prototype.propertyIsEnumerable.call(value, key));
    if (nonEnumerableNames.length > 0) {
      fail('unsupported-structured-clone-type', 'נמצא טיפוס IndexedDB שאינו נתמך באופן lossless.');
    }
    const entries = [];
    for (const key of Object.keys(value)) {
      entries.push({
        key: utf16String(key),
        value: await serializeCloneNode(value[key], context),
      });
    }
    return { type: 'array', id, length: value.length, entries };
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail('unsupported-structured-clone-type', 'נמצא טיפוס IndexedDB שאינו נתמך באופן lossless.');
  }

  const nonEnumerableNames = Object.getOwnPropertyNames(value)
    .filter((key) => !Object.prototype.propertyIsEnumerable.call(value, key));
  if (nonEnumerableNames.length > 0) {
    fail('unsupported-structured-clone-type', 'נמצא טיפוס IndexedDB שאינו נתמך באופן lossless.');
  }

  const properties = [];
  for (const key of Object.keys(value)) {
    properties.push({
      key: utf16String(key),
      value: await serializeCloneNode(value[key], context),
    });
  }
  return {
    type: 'object',
    id,
    prototype: prototype === null ? 'null' : 'object',
    properties,
  };
}

export async function serializeStructuredCloneValue(value) {
  return {
    format: STRUCTURED_CLONE_FORMAT,
    root: await serializeCloneNode(value, createSerializationContext()),
  };
}

export function isAllowlistedStorageKey(key, fixedKeys, dynamicPrefixes) {
  return fixedKeys.includes(key) || dynamicPrefixes.some((prefix) => key.startsWith(prefix));
}

function selectAllowlistedStorageKeys(storage, fixedKeys, dynamicPrefixes) {
  const selected = new Set(fixedKeys);
  // Web Storage has no prefix lookup. Only key names are enumerated here; a value
  // is read only after its key passes the code-defined allowlist.
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && dynamicPrefixes.some((prefix) => key.startsWith(prefix))) selected.add(key);
  }
  return [...selected].sort();
}

async function readAllowlistedWebStorage(storage, fixedKeys, dynamicPrefixes, areaName) {
  const entries = [];
  const keys = selectAllowlistedStorageKeys(storage, fixedKeys, dynamicPrefixes);

  for (const key of keys) {
    if (!isAllowlistedStorageKey(key, fixedKeys, dynamicPrefixes)) {
      fail('allowlist-violation', 'בדיקת ה־allowlist נכשלה.');
    }
    const rawValue = storage.getItem(key);
    if (rawValue === null) continue;
    const valueCodeUnits = stringToUtf16CodeUnits(rawValue);
    const entry = {
      key,
      encoding: 'utf-16-code-units',
      valueCodeUnits,
      keyCodeUnitCount: key.length,
      valueCodeUnitCount: valueCodeUnits.length,
      logicalByteCount: (key.length + valueCodeUnits.length) * 2,
    };
    entry.sha256 = await canonicalSha256({
      key: entry.key,
      encoding: entry.encoding,
      valueCodeUnits: entry.valueCodeUnits,
    });
    entries.push(entry);
  }

  return {
    areaName,
    entries,
    keyCount: entries.length,
    keyCodeUnitCount: entries.reduce((sum, entry) => sum + entry.keyCodeUnitCount, 0),
    valueCodeUnitCount: entries.reduce((sum, entry) => sum + entry.valueCodeUnitCount, 0),
    logicalByteCount: entries.reduce((sum, entry) => sum + entry.logicalByteCount, 0),
  };
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new CollectorError('indexeddb-read-failed', 'קריאת IndexedDB נכשלה.'));
    transaction.onabort = () => reject(new CollectorError('indexeddb-read-aborted', 'קריאת IndexedDB הופסקה.'));
  });
}

function sameKeyPath(actual, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && actual.length === expected.length
      && actual.every((value, index) => value === expected[index]);
  }
  return actual === expected;
}

function assertExactNames(actualNames, expectedNames, errorCode) {
  const actual = [...actualNames].sort();
  const expected = [...expectedNames].sort();
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    fail(errorCode, 'סכמת IndexedDB אינה תואמת ל־allowlist המאושר.');
  }
}

async function openExistingAllowlistedDatabase() {
  if (typeof globalThis.indexedDB?.databases !== 'function') {
    fail('indexeddb-databases-unavailable', 'הדפדפן אינו תומך באימות בטוח של מסדי IndexedDB קיימים.');
  }

  const databases = await globalThis.indexedDB.databases();
  const databaseInfo = databases.find((entry) => entry.name === INDEXED_DB_ALLOWLIST.name);
  if (!databaseInfo) return null;
  if (databaseInfo.version !== INDEXED_DB_ALLOWLIST.version) {
    fail('indexeddb-version-mismatch', 'גרסת IndexedDB אינה תואמת ל־allowlist המאושר.');
  }

  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(INDEXED_DB_ALLOWLIST.name);
    request.onupgradeneeded = () => {
      try {
        request.transaction?.abort();
      } catch {}
      reject(new CollectorError('indexeddb-upgrade-blocked', 'ה־collector סירב ליצור או לשדרג IndexedDB.'));
    };
    request.onerror = () => reject(new CollectorError('indexeddb-open-failed', 'פתיחת IndexedDB לקריאה נכשלה.'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function readAllowlistedIndexedDb() {
  const database = await openExistingAllowlistedDatabase();
  if (!database) {
    return {
      databaseName: INDEXED_DB_ALLOWLIST.name,
      present: false,
      version: null,
      stores: [],
      storeCount: 0,
      recordCount: 0,
      logicalByteCount: 0,
    };
  }

  try {
    if (database.version !== INDEXED_DB_ALLOWLIST.version) {
      fail('indexeddb-version-mismatch', 'גרסת IndexedDB אינה תואמת ל־allowlist המאושר.');
    }

    const allowedStoreNames = Object.keys(INDEXED_DB_ALLOWLIST.stores);
    assertExactNames(database.objectStoreNames, allowedStoreNames, 'indexeddb-store-mismatch');
    const stores = [];

    for (const storeName of allowedStoreNames) {
      const expectedStore = INDEXED_DB_ALLOWLIST.stores[storeName];
      const transaction = database.transaction(storeName, 'readonly');
      if (transaction.mode !== 'readonly') {
        try { transaction.abort(); } catch {}
        fail('indexeddb-mode-violation', 'עסקת IndexedDB אינה read-only.');
      }
      const store = transaction.objectStore(storeName);
      if (!sameKeyPath(store.keyPath, expectedStore.keyPath) || store.autoIncrement !== expectedStore.autoIncrement) {
        try { transaction.abort(); } catch {}
        fail('indexeddb-store-schema-mismatch', 'סכמת IndexedDB אינה תואמת ל־allowlist המאושר.');
      }

      const allowedIndexNames = Object.keys(expectedStore.indexes);
      assertExactNames(store.indexNames, allowedIndexNames, 'indexeddb-index-mismatch');
      const rawIndexes = [];
      for (const indexName of allowedIndexNames) {
        const expectedIndex = expectedStore.indexes[indexName];
        const index = store.index(indexName);
        if (
          !sameKeyPath(index.keyPath, expectedIndex.keyPath)
          || index.unique !== expectedIndex.unique
          || index.multiEntry !== expectedIndex.multiEntry
        ) {
          try { transaction.abort(); } catch {}
          fail('indexeddb-index-schema-mismatch', 'סכמת IndexedDB אינה תואמת ל־allowlist המאושר.');
        }
        rawIndexes.push({
          name: indexName,
          keyPath: index.keyPath,
          unique: index.unique,
          multiEntry: index.multiEntry,
        });
      }

      const rawRecords = [];
      const cursorRequest = store.openCursor();
      const cursorPromise = new Promise((resolve, reject) => {
        cursorRequest.onerror = () => reject(new CollectorError('indexeddb-cursor-failed', 'קריאת IndexedDB נכשלה.'));
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            resolve();
            return;
          }
          rawRecords.push({
            primaryKey: cursor.primaryKey,
            key: cursor.key,
            value: cursor.value,
          });
          cursor.continue();
        };
      });

      await Promise.all([cursorPromise, transactionComplete(transaction)]);
      const indexes = [];
      for (const rawIndex of rawIndexes) {
        indexes.push({
          ...rawIndex,
          keyPath: await serializeStructuredCloneValue(rawIndex.keyPath),
        });
      }
      const records = [];
      for (const rawRecord of rawRecords) {
        const record = {
          primaryKey: await serializeStructuredCloneValue(rawRecord.primaryKey),
          key: await serializeStructuredCloneValue(rawRecord.key),
          value: await serializeStructuredCloneValue(rawRecord.value),
        };
        record.sha256 = await canonicalSha256(record);
        records.push(record);
      }

      stores.push({
        name: storeName,
        keyPath: await serializeStructuredCloneValue(store.keyPath),
        autoIncrement: store.autoIncrement,
        indexes,
        records,
        recordCount: records.length,
      });
    }

    const logicalByteCount = new TextEncoder().encode(JSON.stringify(canonicalize(stores))).byteLength;
    return {
      databaseName: INDEXED_DB_ALLOWLIST.name,
      present: true,
      version: database.version,
      stores,
      storeCount: stores.length,
      recordCount: stores.reduce((sum, store) => sum + store.recordCount, 0),
      logicalByteCount,
    };
  } finally {
    database.close();
  }
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function checksumWorkspaceItemIds(items = []) {
  return fnv1a(items.map((item) => String(item?.id || '')).sort().join('\n'));
}

function stripWorkspaceTopicAssignment(item = {}) {
  const copy = { ...item };
  WORKSPACE_TOPIC_ASSIGNMENT_FIELDS.forEach((field) => delete copy[field]);
  return copy;
}

export function checksumWorkspacePayloadsExcludingTopicAssignment(items = []) {
  const source = Array.isArray(items) ? items : [];
  return fnv1a(JSON.stringify(source.map(stripWorkspaceTopicAssignment)));
}

function checksumWorkspacePayloadsForMigration(items = []) {
  const source = Array.isArray(items) ? items : [];
  return fnv1a(JSON.stringify(source.map((item) => {
    const copy = { ...item };
    MIGRATION_TOPIC_ASSIGNMENT_FIELDS.forEach((field) => delete copy[field]);
    return copy;
  })));
}

function verifyWorkspaceIntegrity(localStorageSnapshot) {
  const entry = localStorageSnapshot.entries.find((candidate) => candidate.key === WORKSPACE_ITEMS_KEY);
  if (!entry) fail('workspace-storage-missing', 'מפתח ה־Workspace המאושר אינו קיים.');

  let items;
  try {
    const rawValue = utf16CodeUnitsToString(entry.valueCodeUnits);
    items = JSON.parse(rawValue);
  } catch {
    fail('workspace-storage-invalid', 'נתוני ה־Workspace אינם JSON תקין.');
  }
  if (!Array.isArray(items)) fail('workspace-storage-invalid', 'נתוני ה־Workspace אינם מערך תקין.');

  const integrity = {
    recordCount: items.length,
    activeCount: items.filter((item) => !item?.archivedAt).length,
    archivedCount: items.filter((item) => Boolean(item?.archivedAt)).length,
    idChecksum: checksumWorkspaceItemIds(items),
    payloadChecksum: checksumWorkspacePayloadsExcludingTopicAssignment(items),
    migrationPayloadChecksum: checksumWorkspacePayloadsForMigration(items),
  };

  if (
    integrity.recordCount !== EXPECTED_WORKSPACE_INTEGRITY.recordCount
    || integrity.idChecksum !== EXPECTED_WORKSPACE_INTEGRITY.idChecksum
    || integrity.payloadChecksum !== EXPECTED_WORKSPACE_INTEGRITY.payloadChecksum
  ) {
    fail(
      'workspace-integrity-mismatch',
      `Workspace mismatch: ${integrity.recordCount} records · ${integrity.idChecksum} · ${integrity.payloadChecksum}`,
    );
  }
  return integrity;
}

export function isApprovedRuntimeLocation(candidateLocation) {
  return candidateLocation?.origin === APPROVED_ORIGIN
    && APPROVED_RUNTIME_PATHNAMES.includes(candidateLocation.pathname)
    && !candidateLocation.search;
}

function assertApprovedRuntimeLocation() {
  if (!isApprovedRuntimeLocation(location)) {
    fail('origin-mismatch', 'יש לפתוח את ה־collector בכתובת המקומית המדויקת וללא query parameters.');
  }
}

async function readCompleteSnapshot() {
  assertApprovedRuntimeLocation();
  if (typeof globalThis.indexedDB?.databases !== 'function') {
    fail('indexeddb-databases-unavailable', 'The browser cannot verify existing IndexedDB databases safely.');
  }
  const discoveredDatabases = await globalThis.indexedDB.databases();
  if (discoveredDatabases.some((entry) => UNSUPPORTED_APPLICATION_DATABASES.includes(entry.name))) {
    fail('unsupported-application-database', 'A newer application database exists and is not covered by this backup format.');
  }
  const localStorageSnapshot = await readAllowlistedWebStorage(
    localStorage,
    LOCAL_STORAGE_FIXED_KEYS,
    LOCAL_STORAGE_DYNAMIC_PREFIXES,
    'localStorage',
  );
  const sessionStorageSnapshot = await readAllowlistedWebStorage(
    sessionStorage,
    SESSION_STORAGE_FIXED_KEYS,
    SESSION_STORAGE_DYNAMIC_PREFIXES,
    'sessionStorage',
  );
  const indexedDbSnapshot = await readAllowlistedIndexedDb();
  const workspaceIntegrity = verifyWorkspaceIntegrity(localStorageSnapshot);

  const snapshot = {
    format: SNAPSHOT_FORMAT,
    origin: location.origin,
    localStorage: localStorageSnapshot,
    sessionStorage: sessionStorageSnapshot,
    indexedDB: indexedDbSnapshot,
    cacheStorage: {
      allowlistedNames: [...CACHE_STORAGE_ALLOWLIST],
      cacheCount: 0,
      entryCount: 0,
      entries: [],
    },
    workspaceIntegrity,
  };
  const snapshotSha256 = await canonicalSha256(snapshot);
  return { snapshot, snapshotSha256 };
}

export async function collectStableOriginSnapshot() {
  collectedPayloadInMemory = null;
  collectedMetadataInMemory = null;
  const firstRead = await readCompleteSnapshot();
  const secondRead = await readCompleteSnapshot();

  if (firstRead.snapshotSha256 !== secondRead.snapshotSha256) {
    fail('snapshot-unstable', 'שתי קריאות האחסון אינן זהות; לא נשמר payload בזיכרון.');
  }

  const storageEstimate = await navigator.storage.estimate();
  const persisted = await navigator.storage.persisted();

  collectedPayloadInMemory = {
    format: SNAPSHOT_FORMAT,
    collectedAt: new Date().toISOString(),
    stableReadCount: 2,
    snapshotSha256: secondRead.snapshotSha256,
    snapshot: secondRead.snapshot,
  };

  collectedMetadataInMemory = {
    origin: secondRead.snapshot.origin,
    snapshotSha256: secondRead.snapshotSha256,
    stableReadCount: 2,
    localStorage: {
      keyCount: secondRead.snapshot.localStorage.keyCount,
      codeUnitCount:
        secondRead.snapshot.localStorage.keyCodeUnitCount
        + secondRead.snapshot.localStorage.valueCodeUnitCount,
      logicalByteCount: secondRead.snapshot.localStorage.logicalByteCount,
    },
    sessionStorage: {
      keyCount: secondRead.snapshot.sessionStorage.keyCount,
      codeUnitCount:
        secondRead.snapshot.sessionStorage.keyCodeUnitCount
        + secondRead.snapshot.sessionStorage.valueCodeUnitCount,
      logicalByteCount: secondRead.snapshot.sessionStorage.logicalByteCount,
    },
    indexedDB: {
      databaseCount: secondRead.snapshot.indexedDB.present ? 1 : 0,
      storeCount: secondRead.snapshot.indexedDB.storeCount,
      recordCount: secondRead.snapshot.indexedDB.recordCount,
      logicalByteCount: secondRead.snapshot.indexedDB.logicalByteCount,
    },
    cacheStorage: {
      cacheCount: 0,
      entryCount: 0,
    },
    workspaceIntegrity: secondRead.snapshot.workspaceIntegrity,
    storageEstimate: {
      usage: storageEstimate.usage ?? null,
      quota: storageEstimate.quota ?? null,
      available:
        storageEstimate.usage != null && storageEstimate.quota != null
          ? storageEstimate.quota - storageEstimate.usage
          : null,
      persisted,
    },
  };
  return collectedMetadataInMemory;
}

function formatNumber(value) {
  return new Intl.NumberFormat('he-IL').format(value);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setStatus(state, value) {
  const element = document.getElementById('collector-status');
  if (!element) return;
  element.dataset.state = state;
  element.textContent = value;
}

function renderSafeMetadata(metadata) {
  setText('meta-origin', metadata.origin);
  setText(
    'meta-local',
    `${formatNumber(metadata.localStorage.keyCount)} מפתחות · ${formatNumber(metadata.localStorage.codeUnitCount)} code units · ${formatNumber(metadata.localStorage.logicalByteCount)} bytes`,
  );
  setText(
    'meta-session',
    `${formatNumber(metadata.sessionStorage.keyCount)} מפתחות · ${formatNumber(metadata.sessionStorage.codeUnitCount)} code units · ${formatNumber(metadata.sessionStorage.logicalByteCount)} bytes`,
  );
  setText(
    'meta-indexeddb',
    `${metadata.indexedDB.databaseCount} DB · ${metadata.indexedDB.storeCount} stores · ${metadata.indexedDB.recordCount} records · ${formatNumber(metadata.indexedDB.logicalByteCount)} bytes`,
  );
  setText('meta-cache', `${metadata.cacheStorage.cacheCount} caches · ${metadata.cacheStorage.entryCount} entries`);
  setText(
    'meta-workspace',
    `${metadata.workspaceIntegrity.recordCount} records (${metadata.workspaceIntegrity.activeCount} active / ${metadata.workspaceIntegrity.archivedCount} archived) · ${metadata.workspaceIntegrity.idChecksum} · ${metadata.workspaceIntegrity.payloadChecksum} · migration ${metadata.workspaceIntegrity.migrationPayloadChecksum}`,
  );
  setText(
    'meta-quota',
    `${formatNumber(metadata.storageEstimate.usage ?? 0)} used · ${formatNumber(metadata.storageEstimate.quota ?? 0)} quota · persisted ${metadata.storageEstimate.persisted ? 'yes' : 'no'}`,
  );
  setText('meta-hash', metadata.snapshotSha256);
}

function initializeCollectorPage() {
  const button = document.getElementById('run-collector');
  const backupButton = document.getElementById('run-encrypted-backup');
  const helperPort = document.getElementById('helper-port');
  if (!(button instanceof HTMLButtonElement)) return;

  setText('meta-origin', location.origin);
  const locationApproved = location.origin === APPROVED_ORIGIN
    && location.pathname === EXPORT_PAGE_PATH
    && !location.search;
  if (!locationApproved) {
    button.disabled = true;
    setStatus('error', 'הכתובת אינה תואמת ל־origin ולנתיב המאושרים.');
    return;
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    setStatus('running', 'מבצע שתי קריאות read-only ומשווה hashes…');
    try {
      const metadata = await collectStableOriginSnapshot();
      renderSafeMetadata(metadata);
      if (backupButton instanceof HTMLButtonElement) backupButton.disabled = false;
      setStatus('success', 'ה־snapshot יציב ונשמר בזיכרון בלבד. לא נוצר קובץ ולא שודר מידע.');
    } catch (error) {
      collectedPayloadInMemory = null;
      collectedMetadataInMemory = null;
      if (backupButton instanceof HTMLButtonElement) backupButton.disabled = true;
      const safeMessage = error instanceof CollectorError
        ? error.safeMessage
        : 'ה־collector נעצר בבטחה ללא payload שמור.';
      setStatus('error', safeMessage);
    } finally {
      button.disabled = false;
    }
  });

  if (backupButton instanceof HTMLButtonElement && helperPort instanceof HTMLInputElement) {
    backupButton.addEventListener('click', async () => {
      backupButton.disabled = true;
      setText('backup-status', 'מצפין בזיכרון ושולח ל־helper המקומי ciphertext בלבד…');
      try {
        if (!collectedPayloadInMemory || !collectedMetadataInMemory) {
          fail('backup-snapshot-missing', 'אין snapshot יציב בזיכרון. לא נוצר גיבוי.');
        }
        const metadata = {
          origin: APPROVED_ORIGIN,
          url: `${APPROVED_ORIGIN}${EXPORT_PAGE_PATH}`,
          branch: APPROVED_GIT_CONTEXT.branch,
          head: APPROVED_GIT_CONTEXT.head,
          exportTimestamp: collectedPayloadInMemory.collectedAt,
          snapshotSha256: collectedMetadataInMemory.snapshotSha256,
          localStorageKeys: collectedMetadataInMemory.localStorage.keyCount,
          sessionStorageKeys: collectedMetadataInMemory.sessionStorage.keyCount,
          indexedDbDatabases: collectedMetadataInMemory.indexedDB.databaseCount,
          indexedDbStores: collectedMetadataInMemory.indexedDB.storeCount,
          indexedDbRecords: collectedMetadataInMemory.indexedDB.recordCount,
          cacheEntries: collectedMetadataInMemory.cacheStorage.entryCount,
          logicalBytes:
            collectedMetadataInMemory.localStorage.logicalByteCount
            + collectedMetadataInMemory.sessionStorage.logicalByteCount
            + collectedMetadataInMemory.indexedDB.logicalByteCount,
          workspaceRecords: collectedMetadataInMemory.workspaceIntegrity.recordCount,
          workspaceActiveRecords: collectedMetadataInMemory.workspaceIntegrity.activeCount,
          workspaceArchivedRecords: collectedMetadataInMemory.workspaceIntegrity.archivedCount,
          workspaceIdChecksum: collectedMetadataInMemory.workspaceIntegrity.idChecksum,
          workspacePayloadChecksum: collectedMetadataInMemory.workspaceIntegrity.payloadChecksum,
          workspaceMigrationPayloadChecksum:
            collectedMetadataInMemory.workspaceIntegrity.migrationPayloadChecksum,
          storageUsageBytes: collectedMetadataInMemory.storageEstimate.usage,
          storageQuotaBytes: collectedMetadataInMemory.storageEstimate.quota,
          storageAvailableBytes: collectedMetadataInMemory.storageEstimate.available,
          storagePersisted: collectedMetadataInMemory.storageEstimate.persisted ? 1 : 0,
        };
        const result = await encryptCollectedPayloadToLoopback(helperPort.value.trim(), collectedPayloadInMemory, metadata);
        setText(
          'backup-status',
          `הגיבוי המוצפן נכתב ואומת: ${result.fileName} · ${formatNumber(result.byteLength)} bytes · SHA-256 ${result.sha256}`,
        );
      } catch (error) {
        const safeMessage = error instanceof CollectorError
          ? error.safeMessage
          : 'תהליך הגיבוי נעצר בבטחה. לא נוצר plaintext fallback.';
        setText('backup-status', safeMessage);
      }
    });
  }
}

if (typeof document !== 'undefined') initializeCollectorPage();
