// YouTube thumbnail fallback chain and localStorage cache

export const THUMBNAIL_CHAIN = ['maxresdefault', 'hqdefault', 'sddefault', 'mqdefault', 'default'];

export function getThumbnailUrl(videoId, quality) {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

// YouTube returns a 120×90 gray placeholder for maxresdefault when the HD version doesn't exist.
// Detect it by checking naturalWidth/naturalHeight after load.
export function isYouTubePlaceholder(imgEl) {
  return (
    imgEl.naturalWidth > 0 &&
    imgEl.naturalWidth <= 120 &&
    imgEl.naturalHeight <= 90
  );
}

// ── localStorage cache ────────────────────────────────────────────────────────
const CACHE_KEY = 'yt_thumb_cache_v1';
const CACHE_MAX = 500;

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function writeCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
  catch {}
}

export function getCachedThumbnail(videoId) {
  if (!videoId) return null;
  return readCache()[videoId] || null;
}

export function setCachedThumbnail(videoId, quality) {
  if (!videoId || !quality) return;
  const cache = readCache();
  cache[videoId] = { quality, url: getThumbnailUrl(videoId, quality), at: Date.now() };
  // Evict oldest entries when cache grows too large
  const keys = Object.keys(cache);
  if (keys.length > CACHE_MAX) {
    keys.sort((a, b) => (cache[a].at || 0) - (cache[b].at || 0))
        .slice(0, 50)
        .forEach((k) => delete cache[k]);
  }
  writeCache(cache);
}

export function clearCachedThumbnail(videoId) {
  if (!videoId) return;
  const cache = readCache();
  delete cache[videoId];
  writeCache(cache);
}
