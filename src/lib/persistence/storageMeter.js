import {
  APP_DATA_DB_NAME,
  APP_DATA_DB_VERSION,
  APP_DATA_STORES,
} from './storageManifest.js';
import { APPLICATION_STORAGE_MODES } from './storageMode.js';

export const INDEXED_DB_WARNING_THRESHOLD = 0.8;
export const INDEXED_DB_DANGER_THRESHOLD = 0.95;

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function getLocalStorageUsageBytes(storage = globalThis.localStorage) {
  try {
    let codeUnits = 0;
    for (let index = 0; index < Number(storage?.length || 0); index += 1) {
      const key = storage.key(index);
      if (key == null) continue;
      const value = storage.getItem(key);
      codeUnits += key.length + (value?.length || 0);
    }
    return codeUnits * 2;
  } catch {
    return null;
  }
}

export function calculateStorageUtilization(usageBytes, quotaBytes) {
  const usage = finiteNonNegative(usageBytes);
  const quota = finiteNonNegative(quotaBytes);
  if (usage == null || quota == null || quota === 0) return null;
  return Math.min(1, usage / quota);
}

export function formatStorageBytes(bytes) {
  const value = finiteNonNegative(bytes);
  if (value == null) return null;
  const units = [
    ['GB', 1024 ** 3],
    ['MB', 1024 ** 2],
    ['KB', 1024],
  ];
  const [unit, divisor] = units.find(([, size]) => value >= size) || ['B', 1];
  const scaled = value / divisor;
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${unit}`;
}

export function shortGenerationId(generationId) {
  const normalized = String(generationId || '');
  if (!normalized) return null;
  if (normalized.length <= 24) return normalized;
  return `${normalized.slice(0, 15)}…${normalized.slice(-8)}`;
}

export function buildStorageMeterModel({
  mode,
  localStorageBytes,
  estimate = null,
  persisted = null,
  persistenceError = null,
  database = null,
} = {}) {
  const normalizedMode = mode === APPLICATION_STORAGE_MODES.INDEXED_DB
    ? APPLICATION_STORAGE_MODES.INDEXED_DB
    : APPLICATION_STORAGE_MODES.LOCAL_STORAGE;
  const usageBytes = finiteNonNegative(estimate?.usage);
  const quotaBytes = finiteNonNegative(estimate?.quota);
  const utilization = calculateStorageUtilization(usageBytes, quotaBytes);
  const headroomBytes = usageBytes != null && quotaBytes != null
    ? Math.max(0, quotaBytes - usageBytes)
    : null;

  if (normalizedMode === APPLICATION_STORAGE_MODES.LOCAL_STORAGE) {
    return {
      mode: normalizedMode,
      health: 'legacy',
      warningCode: null,
      localStorageBytes: finiteNonNegative(localStorageBytes),
      usageBytes: null,
      quotaBytes: null,
      headroomBytes: null,
      utilization: null,
      utilizationPercent: null,
      persisted: null,
      database: null,
    };
  }

  let health = 'healthy';
  let warningCode = null;
  if (!database?.available) {
    health = 'danger';
    warningCode = 'indexeddb-unavailable';
  } else if (persistenceError) {
    health = 'warning';
    warningCode = 'persistence-unavailable';
  } else if (utilization == null) {
    health = 'warning';
    warningCode = 'quota-unavailable';
  } else if (utilization >= INDEXED_DB_DANGER_THRESHOLD) {
    health = 'danger';
    warningCode = 'quota-critical';
  } else if (utilization >= INDEXED_DB_WARNING_THRESHOLD) {
    health = 'warning';
    warningCode = 'quota-warning';
  }

  return {
    mode: normalizedMode,
    health,
    warningCode,
    localStorageBytes: finiteNonNegative(localStorageBytes),
    usageBytes,
    quotaBytes,
    headroomBytes,
    utilization,
    utilizationPercent: utilization == null ? null : Number((utilization * 100).toFixed(2)),
    persisted: typeof persisted === 'boolean' ? persisted : null,
    database,
  };
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

async function inspectExistingAppDataDatabase(indexedDBFactory) {
  if (!indexedDBFactory || typeof indexedDBFactory.databases !== 'function') {
    return { available: false, reason: 'discovery-unavailable' };
  }

  const databases = await indexedDBFactory.databases();
  const existing = databases.find((entry) => entry?.name === APP_DATA_DB_NAME);
  if (!existing) return { available: false, reason: 'database-missing' };

  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(APP_DATA_DB_NAME);
    let upgradeAttempted = false;

    request.onupgradeneeded = (event) => {
      upgradeAttempted = true;
      event.target.transaction?.abort();
    };
    request.onerror = () => reject(
      upgradeAttempted
        ? new Error('Storage meter refused an IndexedDB upgrade')
        : request.error || new Error('Unable to inspect IndexedDB'),
    );
    request.onsuccess = async () => {
      const database = request.result;
      try {
        if (upgradeAttempted || database.version !== APP_DATA_DB_VERSION) {
          throw new Error('Unexpected IndexedDB version');
        }
        if (!database.objectStoreNames.contains(APP_DATA_STORES.META)) {
          throw new Error('IndexedDB metadata store is unavailable');
        }
        const transaction = database.transaction(APP_DATA_STORES.META, 'readonly');
        const store = transaction.objectStore(APP_DATA_STORES.META);
        const [workspacePointer, applicationPointer] = await Promise.all([
          requestResult(store.get('activeWorkspaceGeneration')),
          requestResult(store.get('activeGeneration')),
        ]);
        const active = workspacePointer?.state === 'active' ? workspacePointer : applicationPointer;
        resolve({
          available: true,
          name: database.name,
          version: database.version,
          activeGenerationId: active?.generationId || null,
          workspaceRecordCount: finiteNonNegative(active?.counts?.workspaceItems),
        });
      } catch (error) {
        reject(error);
      } finally {
        database.close();
      }
    };
  });
}

export async function collectStorageMeterSnapshot({
  mode,
  navigatorObject = globalThis.navigator,
  localStorageArea = globalThis.localStorage,
  indexedDBFactory = globalThis.indexedDB,
} = {}) {
  const localStorageBytes = getLocalStorageUsageBytes(localStorageArea);
  if (mode !== APPLICATION_STORAGE_MODES.INDEXED_DB) {
    return buildStorageMeterModel({ mode, localStorageBytes });
  }

  let estimate = null;
  let persisted = null;
  let persistenceError = null;
  let database = null;

  try {
    if (typeof navigatorObject?.storage?.estimate === 'function') {
      estimate = await navigatorObject.storage.estimate();
    }
  } catch {
    persistenceError = 'estimate-failed';
  }

  try {
    if (typeof navigatorObject?.storage?.persisted === 'function') {
      persisted = await navigatorObject.storage.persisted();
    }
  } catch {
    persistenceError ||= 'persisted-failed';
  }

  try {
    database = await inspectExistingAppDataDatabase(indexedDBFactory);
  } catch {
    database = { available: false, reason: 'inspection-failed' };
  }

  return buildStorageMeterModel({
    mode,
    localStorageBytes,
    estimate,
    persisted,
    persistenceError,
    database,
  });
}
