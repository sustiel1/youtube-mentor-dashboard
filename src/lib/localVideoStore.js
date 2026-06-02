// ─── Local Video Store ──────────────────────────────────────────────────────
// Thin adapter over videoStorage — keeps existing imports working unchanged.
// All persistence logic (TTL, cleanup, dedup) lives in videoStorage.js.

import {
  loadVideos,
  saveVideos,
  upsertVideos,
  updateStoredVideo,
  deleteStoredVideo,
  forceUpsertVideo,
  getVideoCount,
  clearAllVideos,
  isVideoDeleted,
  getDeletedVideoRestoreInfo,
  restoreDeletedVideo,
  findArchivedDeletedVideo,
  isVideoDeletedOnly,
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

export function deleteLocalVideo(id) {
  return deleteStoredVideo(id);
}

export {
  isVideoDeleted,
  getDeletedVideoRestoreInfo,
  restoreDeletedVideo,
  findArchivedDeletedVideo,
  isVideoDeletedOnly,
};

export function clearLocalVideos() {
  clearAllVideos();
}

export function getLocalVideoCount() {
  return getVideoCount();
}

// Save or merge a video by id/url — fallback when Base44 is unavailable
export function forceUpsertLocalVideo(videoData) {
  return forceUpsertVideo(videoData);
}
