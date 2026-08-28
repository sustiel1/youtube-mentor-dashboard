/**
 * One-time migration: move the legacy `market_brief_<videoId>` localStorage
 * sidecars into the canonical IndexedDB store, then drop the localStorage copy.
 *
 * Runs only in IndexedDB storage mode. Every sidecar is verified with a
 * read-back from IndexedDB before its localStorage key is removed, so a failed
 * or partial write never loses data. Intended to be triggered from a DEV button
 * in the Admin storage panel, not on app start.
 */

import { APPLICATION_STORAGE_MODES, getApplicationStorageMode } from './storageMode.js';
import {
  readCanonicalMarketBrief,
  writeCanonicalMarketBrief,
} from './marketBriefCanonicalStore.js';

export const MARKET_BRIEF_SIDECAR_PREFIX = 'market_brief_';

function listSidecarKeys(storage) {
  const keys = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(MARKET_BRIEF_SIDECAR_PREFIX)) keys.push(key);
  }
  return keys;
}

/**
 * @param {object}   [options]
 * @param {Storage}  [options.storage]       localStorage-like area (default: window.localStorage)
 * @param {string}   [options.mode]          storage mode (default: resolved from env)
 * @param {Function} [options.readCanonical] async (videoId) => canonical record | null
 * @param {Function} [options.writeCanonical] async (videoId, data) => { ok, code }
 * @param {boolean}  [options.dryRun]        report what would happen; write/remove nothing
 * @returns {Promise<{mode,scanned,migrated,removed,skipped:Array,failed:Array,skippedReason?:string}>}
 */
export async function migrateMarketBriefSidecars({
  storage = globalThis.localStorage,
  mode = getApplicationStorageMode(),
  readCanonical = readCanonicalMarketBrief,
  writeCanonical = writeCanonicalMarketBrief,
  dryRun = false,
} = {}) {
  const result = { mode, scanned: 0, migrated: 0, removed: 0, skipped: [], failed: [] };

  if (mode !== APPLICATION_STORAGE_MODES.INDEXED_DB) {
    result.skippedReason = 'not-indexeddb-mode';
    return result;
  }
  if (!storage) {
    result.skippedReason = 'no-storage';
    return result;
  }

  const keys = listSidecarKeys(storage);
  result.scanned = keys.length;

  for (const key of keys) {
    const videoId = key.slice(MARKET_BRIEF_SIDECAR_PREFIX.length);
    if (!videoId) {
      result.skipped.push({ key, reason: 'empty-video-id' });
      continue;
    }

    let data;
    try {
      data = JSON.parse(storage.getItem(key));
    } catch {
      result.skipped.push({ key, reason: 'invalid-json' });
      continue;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      result.skipped.push({ key, reason: 'not-an-object' });
      continue;
    }

    // Already present in canonical IndexedDB — just retire the sidecar.
    let canonical = await readCanonical(videoId).catch(() => null);
    if (canonical?.storage === 'indexedDB' && canonical?.data) {
      if (!dryRun) {
        storage.removeItem(key);
        result.removed += 1;
      }
      result.migrated += 1;
      continue;
    }

    if (dryRun) {
      result.migrated += 1;
      continue;
    }

    let writeResult;
    try {
      writeResult = await writeCanonical(videoId, data);
    } catch (error) {
      result.failed.push({ key, reason: `write-threw:${error?.name || 'Error'}` });
      continue;
    }
    if (!writeResult?.ok) {
      result.failed.push({ key, reason: writeResult?.code || 'write-not-ok' });
      continue;
    }

    // Verify the canonical read-back before removing the localStorage copy.
    canonical = await readCanonical(videoId).catch(() => null);
    if (canonical?.storage === 'indexedDB' && canonical?.data) {
      storage.removeItem(key);
      result.migrated += 1;
      result.removed += 1;
    } else {
      result.failed.push({ key, reason: 'verify-readback-failed' });
    }
  }

  return result;
}
