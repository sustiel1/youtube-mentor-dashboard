export const APPLICATION_STORAGE_MODES = Object.freeze({
  LOCAL_STORAGE: 'localStorage',
  INDEXED_DB: 'indexedDB',
});

export function normalizeApplicationStorageMode(value) {
  return String(value || '').trim().toLowerCase() === 'indexeddb'
    ? APPLICATION_STORAGE_MODES.INDEXED_DB
    : APPLICATION_STORAGE_MODES.LOCAL_STORAGE;
}

export function getApplicationStorageMode({ env = import.meta.env } = {}) {
  return normalizeApplicationStorageMode(env?.VITE_YTMDB_STORAGE_MODE);
}
