/**
 * Minimal in-memory localStorage polyfill for Node test scripts that import
 * real src/ modules (videoStorage.js, videoFreshImport.js, ...) which call
 * the browser localStorage API directly.
 */
class MemoryLocalStorage {
  constructor() {
    this._map = new Map();
  }

  getItem(key) {
    return this._map.has(key) ? this._map.get(key) : null;
  }

  setItem(key, value) {
    this._map.set(String(key), String(value));
  }

  removeItem(key) {
    this._map.delete(key);
  }

  clear() {
    this._map.clear();
  }

  key(index) {
    return Array.from(this._map.keys())[index] ?? null;
  }

  get length() {
    return this._map.size;
  }
}

export function installMemoryLocalStorage() {
  const storage = new MemoryLocalStorage();
  globalThis.localStorage = storage;
  return storage;
}
