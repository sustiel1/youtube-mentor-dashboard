// ─── YouTube snippet cache (localStorage) ────────────────────────────────────
// Caches Data API snippet.description + parsed chapters. Refetch only after TTL.
// Separate key from main video list (videoStorage) — does not change RSS / sync structure.

const CACHE_KEY = 'yt_mentor_youtube_chapter_cache_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

function readAll() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * @param {string} videoId
 * @returns {{ description: string, chapters: object[], duration?: string, viewCount?: number, lastFetchedAt: string } | null}
 */
export function getCachedVideoMetadata(videoId) {
  if (!videoId) return null;
  const entry = readAll()[videoId];
  if (!entry || typeof entry !== 'object') return null;
  return entry;
}

/**
 * @param {string} videoId
 * @param {{ description: string, chapters: object[], duration?: string, viewCount?: number }} data
 */
export function setCachedVideoMetadata(videoId, data) {
  if (!videoId) return;
  const all = readAll();
  all[videoId] = {
    description:   data.description ?? '',
    chapters:      Array.isArray(data.chapters) ? data.chapters : [],
    ...(data.duration ? { duration: data.duration } : {}),
    ...(Number.isFinite(data.viewCount) ? { viewCount: data.viewCount } : {}),
    lastFetchedAt: new Date().toISOString(),
  };
  writeAll(all);
}

/**
 * @param {string} videoId
 * @returns {boolean} true when there is no fresh cache (older than 24h or missing)
 */
export function shouldFetchVideoMetadata(videoId) {
  if (!videoId) return true;
  const e = getCachedVideoMetadata(videoId);
  if (!e?.lastFetchedAt) return true;
  if (!e.duration) return true;
  const age = Date.now() - new Date(e.lastFetchedAt).getTime();
  return age > TTL_MS;
}
