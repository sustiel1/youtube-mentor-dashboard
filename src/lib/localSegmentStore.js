const STORAGE_KEY = 'yt_transcript_segs_v1';
const MAX_EXCERPT_CHARS = 600;

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function getSegments(videoId) {
  if (!videoId) return [];
  const all = loadAll();
  const entry = all[videoId];
  return Array.isArray(entry?.segments) ? entry.segments : [];
}

export function hasSegments(videoId) {
  return getSegments(videoId).length > 0;
}

export function clearSegments(videoId) {
  if (!videoId) return false;
  const all = loadAll();
  if (!(videoId in all)) return false;
  delete all[videoId];
  return saveAll(all);
}

export function saveSegments(videoId, segments) {
  if (!videoId || !Array.isArray(segments) || segments.length === 0) return false;
  const all = loadAll();
  all[videoId] = {
    segments: segments.map((s) => ({
      text: String(s.text || '').trim(),
      startSeconds: Number(s.startSeconds ?? s.start ?? 0),
      durationSeconds: Number(s.durationSeconds ?? s.duration ?? s.dur ?? 0),
    })).filter((s) => s.text && Number.isFinite(s.startSeconds)),
    savedAt: new Date().toISOString(),
  };
  return saveAll(all);
}

/**
 * Extract transcript text for a chapter time window.
 * Returns null if no segments cover the range or segments is empty.
 */
export function extractExcerpt(segments, startSeconds, endSeconds, maxChars = MAX_EXCERPT_CHARS) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const start = Number.isFinite(startSeconds) ? startSeconds : 0;
  const end   = Number.isFinite(endSeconds)   ? endSeconds   : Infinity;
  const window = segments.filter((s) => {
    const t = Number(s.startSeconds ?? s.start);
    return Number.isFinite(t) && t >= start && t < end;
  });
  if (window.length === 0) return null;
  const text = window.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > maxChars ? text.slice(0, maxChars) + '…' : text;
}
