// ─── Video Storage Service ──────────────────────────────────────────────────
// localStorage persistence with 30-day TTL and automatic cleanup.
//
// Key: "yt_mentor_videos_v2"
// Each video must have: url (dedup), fetchedAt (TTL)
//
// API:
//   loadVideos()               → cleanup + return all stored videos
//   saveVideos(videos)         → overwrite entire store
//   cleanupOldVideos(videos, days) → filter out expired videos
//   upsertVideos(newVideos)    → merge in new, skip duplicates, stamp fetchedAt
//   getVideoCount()            → count after cleanup

import { analyzeVideo } from './videoAnalytics';

const STORAGE_KEY = "yt_mentor_videos_v2";
const DEFAULT_TTL_DAYS = 30;

function extractVideoId(url) {
  return url?.match(/[?&]v=([^&]+)/)?.[1] ?? null;
}

// Load all videos from localStorage, auto-removing expired ones on read.
// One-time migration: analyze any videos that don't yet have analyzedAt.
export function loadVideos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : [];
    let videos = cleanupOldVideos(all);

    let changed = videos.length !== all.length;

    if (videos.some((v) => !v.analyzedAt)) {
      videos = videos.map(analyzeVideo);
      changed = true;
    }

    if (changed) saveVideos(videos);
    return videos;
  } catch {
    return [];
  }
}

// Overwrite the entire store
export function saveVideos(videos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  } catch (e) {
    console.warn("[videoStorage] write failed:", e.message);
  }
}

// Remove videos whose fetchedAt is older than `days` days.
// Videos without fetchedAt are kept (backwards-compat with pre-TTL records).
export function cleanupOldVideos(videos, days = DEFAULT_TTL_DAYS) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return videos.filter((v) => {
    if (!v.fetchedAt) return true;
    return new Date(v.fetchedAt).getTime() > cutoff;
  });
}

// Merge new videos into the store:
//   - dedup by URL and by YouTube video ID (v= param)
//   - stamp fetchedAt on each new record
//   - generate a local id if none provided
// Returns only the newly added records.
export function upsertVideos(newVideos) {
  const existing = loadVideos();
  const now = new Date().toISOString();

  const existingUrls  = new Set(existing.map((v) => v.url));
  const existingYtIds = new Set(
    existing.map((v) => extractVideoId(v.url)).filter(Boolean)
  );

  const toAdd = newVideos
    .filter((v) => {
      const ytId = extractVideoId(v.url);
      return !existingUrls.has(v.url) && (!ytId || !existingYtIds.has(ytId));
    })
    .map((v) => ({
      ...v,
      fetchedAt: v.fetchedAt ?? now,
      id: v.id ?? `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    }))
    .map(analyzeVideo);

  if (toAdd.length > 0) {
    saveVideos([...existing, ...toAdd]);
  }
  return toAdd;
}

// Update fields on a single stored video by id.
// Returns updated record, or null if not found.
export function updateStoredVideo(id, updates) {
  const videos = loadVideos();
  const idx = videos.findIndex((v) => v.id === id);
  if (idx === -1) return null;
  const updated = { ...videos[idx], ...updates };
  videos[idx] = updated;
  saveVideos(videos);
  return updated;
}

export function getVideoCount() {
  return loadVideos().length;
}

export function clearAllVideos() {
  localStorage.removeItem(STORAGE_KEY);
}
