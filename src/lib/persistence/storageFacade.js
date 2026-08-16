import {
  APP_DATA_STORES,
  classifyStorageKey,
  isApplicationOwnedStorageKey,
  isSensitiveStorageKey,
} from './storageManifest.js';
import {
  canonicalSha256,
  classifyStorageError,
  logicalUtf16Bytes,
  sha256Text,
} from './storageIntegrity.js';

function safeLocalRead(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

export function createStorageFacade({
  repository = null,
  localStorageArea = globalThis.localStorage,
  cryptoProvider = globalThis.crypto,
  allowLocalStorageWriteFallback = false,
} = {}) {
  async function getActiveGeneration() {
    if (!repository) return null;
    try {
      const active = await repository.readMeta('activeGeneration');
      return active?.state === 'active' ? active.generationId : null;
    } catch {
      return null;
    }
  }

  async function getRaw(storageKey) {
    if (isSensitiveStorageKey(storageKey) || !isApplicationOwnedStorageKey(storageKey)) {
      return safeLocalRead(localStorageArea, storageKey);
    }

    const generationId = await getActiveGeneration();
    if (generationId && repository) {
      try {
        const entry = await repository.readSourceEntry(generationId, storageKey);
        if (entry && typeof entry.rawValue === 'string') return entry.rawValue;
      } catch {
        // Read compatibility is deliberately localStorage-first after an IDB failure.
      }
    }
    return safeLocalRead(localStorageArea, storageKey);
  }

  async function getJson(storageKey, fallback = null) {
    const rawValue = await getRaw(storageKey);
    if (rawValue === null) return fallback;
    try {
      return JSON.parse(rawValue);
    } catch {
      return fallback;
    }
  }

  async function setRaw(storageKey, rawValue) {
    if (isSensitiveStorageKey(storageKey)) {
      return { ok: false, code: 'sensitive-key-rejected', fallbackUsed: false };
    }
    if (!isApplicationOwnedStorageKey(storageKey)) {
      return { ok: false, code: 'unknown-key-rejected', fallbackUsed: false };
    }

    const normalizedValue = String(rawValue);
    const generationId = await getActiveGeneration();
    if (!generationId || !repository) {
      try {
        localStorageArea.setItem(storageKey, normalizedValue);
        return { ok: true, storage: 'localStorage', fallbackUsed: true };
      } catch {
        return { ok: false, code: 'local-storage-write-failed', fallbackUsed: true };
      }
    }

    const record = {
      generationId,
      storageKey,
      domain: classifyStorageKey(storageKey),
      rawValue: normalizedValue,
      valueCodeUnits: normalizedValue.length,
      logicalBytes: logicalUtf16Bytes(storageKey, normalizedValue),
      valueSha256: await sha256Text(normalizedValue, cryptoProvider),
    };

    try {
      await repository.writeBatch(APP_DATA_STORES.SOURCE_ENTRIES, [record]);
      const [readBack] = await repository.readRecords(
        APP_DATA_STORES.SOURCE_ENTRIES,
        [[generationId, storageKey]],
      );
      if (!readBack || await canonicalSha256(readBack, cryptoProvider) !== await canonicalSha256(record, cryptoProvider)) {
        throw new Error('IndexedDB read-after-write mismatch');
      }
      return { ok: true, storage: 'indexedDB', fallbackUsed: false };
    } catch (error) {
      if (!allowLocalStorageWriteFallback) {
        return {
          ok: false,
          code: `indexeddb-${classifyStorageError(error)}`,
          fallbackUsed: false,
        };
      }
      try {
        localStorageArea.setItem(storageKey, normalizedValue);
        return { ok: true, storage: 'localStorage', fallbackUsed: true };
      } catch {
        return { ok: false, code: 'all-storage-writes-failed', fallbackUsed: true };
      }
    }
  }

  return {
    getActiveGeneration,
    getRaw,
    getJson,
    setRaw,
  };
}
