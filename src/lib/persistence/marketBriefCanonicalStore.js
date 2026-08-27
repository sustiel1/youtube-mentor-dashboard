import { createAppDataRepository, openAppDataDb } from './appDataDb.js';
import { createStorageFacade } from './storageFacade.js';
import { APPLICATION_STORAGE_MODES, getApplicationStorageMode } from './storageMode.js';

let repositoryPromise = null;
let databasePromise = null;

export function getMarketBriefStorageKey(videoId) {
  const normalized = String(videoId || '').trim();
  if (!normalized) throw new TypeError('videoId is required');
  return `market_brief_${normalized}`;
}

async function resolveRuntimeRepository(mode) {
  if (mode !== APPLICATION_STORAGE_MODES.INDEXED_DB) return null;
  if (!databasePromise) {
    databasePromise = openAppDataDb().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  if (!repositoryPromise) {
    repositoryPromise = databasePromise
      .then(createAppDataRepository)
      .catch((error) => {
        repositoryPromise = null;
        throw error;
      });
  }
  return repositoryPromise;
}

export function createMarketBriefCanonicalStore({
  mode,
  repository = null,
  localStorageArea = globalThis.localStorage,
  cryptoProvider = globalThis.crypto,
} = {}) {
  const storageMode = mode || APPLICATION_STORAGE_MODES.LOCAL_STORAGE;
  const facade = createStorageFacade({
    repository,
    localStorageArea,
    cryptoProvider,
    allowLocalStorageWriteFallback: false,
  });

  async function read(videoId) {
    const storageKey = getMarketBriefStorageKey(videoId);
    if (storageMode === APPLICATION_STORAGE_MODES.INDEXED_DB) {
      if (!repository) return null;
      const generationId = await facade.getActiveGeneration();
      if (!generationId) return null;
      const entry = await repository.readSourceEntry(generationId, storageKey);
      if (!entry || typeof entry.rawValue !== 'string') return null;
      try {
        return {
          data: JSON.parse(entry.rawValue),
          storage: 'indexedDB',
          storageKey,
          generationId,
          payloadCodeUnits: entry.rawValue.length,
          approximatePayloadBytes: entry.rawValue.length * 2,
        };
      } catch {
        return null;
      }
    }

    const rawValue = await facade.getRaw(storageKey);
    if (typeof rawValue !== 'string') return null;
    try {
      return {
        data: JSON.parse(rawValue),
        storage: 'localStorage',
        storageKey,
        generationId: null,
        payloadCodeUnits: rawValue.length,
        approximatePayloadBytes: rawValue.length * 2,
      };
    } catch {
      return null;
    }
  }

  async function write(videoId, marketBriefData) {
    const storageKey = getMarketBriefStorageKey(videoId);
    const rawValue = JSON.stringify(marketBriefData);
    if (storageMode === APPLICATION_STORAGE_MODES.INDEXED_DB) {
      if (!repository) {
        return {
          ok: false,
          code: 'indexeddb-repository-unavailable',
          storage: 'indexedDB',
          storageKey,
          payloadCodeUnits: rawValue.length,
          approximatePayloadBytes: rawValue.length * 2,
        };
      }
      const generationId = await facade.getActiveGeneration();
      if (!generationId) {
        return {
          ok: false,
          code: 'indexeddb-active-generation-missing',
          storage: 'indexedDB',
          storageKey,
          payloadCodeUnits: rawValue.length,
          approximatePayloadBytes: rawValue.length * 2,
        };
      }
    }

    const result = await facade.setRaw(storageKey, rawValue);
    return {
      ...result,
      storageKey,
      payloadCodeUnits: rawValue.length,
      approximatePayloadBytes: rawValue.length * 2,
    };
  }

  return { read, write };
}

async function getRuntimeStore() {
  const mode = getApplicationStorageMode();
  const repository = await resolveRuntimeRepository(mode);
  return createMarketBriefCanonicalStore({ mode, repository });
}

export async function readCanonicalMarketBrief(videoId) {
  try {
    const store = await getRuntimeStore();
    const result = await store.read(videoId);
    if (import.meta.env.DEV && result) {
      console.log('[MarketBriefPersistence] canonical read', JSON.stringify({
        storage: result.storage,
        storageKey: result.storageKey,
        generationId: result.generationId,
        payloadCodeUnits: result.payloadCodeUnits,
        approximatePayloadBytes: result.approximatePayloadBytes,
      }));
    }
    return result;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[MarketBriefPersistence] canonical read failed', {
        storageLayer: 'indexedDB',
        storageKey: videoId ? getMarketBriefStorageKey(videoId) : null,
        exceptionName: error?.name || 'Error',
        exceptionMessage: error?.message || String(error),
      });
    }
    return null;
  }
}

export async function writeCanonicalMarketBrief(videoId, marketBriefData) {
  const store = await getRuntimeStore();
  const result = await store.write(videoId, marketBriefData);
  if (import.meta.env.DEV) {
    const method = result.ok ? 'log' : 'warn';
    console[method]('[MarketBriefPersistence] canonical write', JSON.stringify(result));
  }
  return result;
}
