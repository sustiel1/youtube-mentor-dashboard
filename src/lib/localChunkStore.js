import { extractExcerpt } from './localSegmentStore';

const STORAGE_KEY = 'yt_chunks_v1';
const META_KEY    = 'yt_chunk_meta_v1';

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

function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMeta(data) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function getChunkMeta(videoId) {
  if (!videoId) return null;
  return loadMeta()[videoId] ?? null;
}

export function saveChunkMeta(videoId, meta) {
  if (!videoId || !meta) return false;
  const all = loadMeta();
  all[videoId] = meta;
  return saveMeta(all);
}

/** Returns true when stored chunks were generated from the same analysis as video.analyzedAt. */
export function isChunkFresh(videoId, video) {
  if (!video?.analyzedAt) return false;
  const meta = getChunkMeta(videoId);
  return meta?.analyzedAt === video.analyzedAt;
}

export function getChunks(videoId) {
  if (!videoId) return [];
  const all = loadAll();
  return Array.isArray(all[videoId]) ? all[videoId] : [];
}

export function hasChunks(videoId) {
  return getChunks(videoId).length > 0;
}

export function saveChunks(videoId, chunks) {
  if (!videoId || !Array.isArray(chunks)) return false;
  const all = loadAll();
  all[videoId] = chunks;
  return saveAll(all);
}

export function deleteChunks(videoId) {
  if (!videoId) return false;
  const all = loadAll();
  delete all[videoId];
  const ok = saveAll(all);
  const meta = loadMeta();
  delete meta[videoId];
  saveMeta(meta);
  return ok;
}

export function getAllChunks() {
  const all = loadAll();
  return Object.values(all).flat().filter(Boolean);
}

export function getAllChunkCounts() {
  const all = loadAll();
  const counts = {};
  for (const [id, chunks] of Object.entries(all)) {
    counts[id] = Array.isArray(chunks) ? chunks.length : 0;
  }
  return counts;
}

/**
 * Fill transcriptExcerpt on chunks that still have null, using persisted segments.
 * Skips chunks that already have an excerpt. Returns true if any chunk was updated.
 */
export function enrichChunksWithExcerpts(videoId, segments) {
  if (!videoId || !Array.isArray(segments) || segments.length === 0) return false;
  const chunks = getChunks(videoId);
  if (chunks.length === 0) return false;
  if (!chunks.some((c) => c.transcriptExcerpt === null)) return false;

  const enriched = chunks.map((c) => ({
    ...c,
    transcriptExcerpt: c.transcriptExcerpt !== null
      ? c.transcriptExcerpt
      : extractExcerpt(segments, c.startSeconds, c.endSeconds),
  }));
  return saveChunks(videoId, enriched);
}
