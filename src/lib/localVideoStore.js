// ─── Local Video Store ──────────────────────────────────────────────────────
// Thin adapter over videoStorage — keeps existing imports working unchanged.
// All persistence logic (TTL, cleanup, dedup) lives in videoStorage.js.

import {
  loadVideos,
  saveVideos,
  upsertVideos,
  updateStoredVideo,
  getVideoCount,
  clearAllVideos,
} from '@/services/videoStorage';

export function getLocalVideos() {
  return loadVideos();
}

export function hasLocalVideos() {
  return loadVideos().length > 0;
}

// Save one video; returns the saved record or null if it was a duplicate
export function saveLocalVideo(videoData) {
  const added = upsertVideos([videoData]);
  return added[0] ?? null;
}

// Update fields on an existing local video by id
export function updateLocalVideo(id, updates) {
  return updateStoredVideo(id, updates);
}

export function clearLocalVideos() {
  clearAllVideos();
}

export function getLocalVideoCount() {
  return getVideoCount();
}
