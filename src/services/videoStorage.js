// ─── Video Storage Service ──────────────────────────────────────────────────
// localStorage persistence with 30-day TTL and automatic cleanup.
//
// Key: "yt_mentor_videos_v2"
// Each video must have: url (dedup), fetchedAt (TTL)
//
// API:
//   loadVideos()               → cleanup + migrations + return all stored videos
//   saveVideos(videos)         → overwrite entire store
//   cleanupOldVideos(videos, days) → filter out expired videos
//   upsertVideos(newVideos)    → merge in new, skip duplicates, stamp fetchedAt
//   getVideoCount()            → raw count (no migrations)

import { analyzeVideo, ensureChaptersHaveNavigation, hasNonEmptyChapters } from './videoAnalytics';
import { extractTimestampsFromDescription } from './youtubeMetadata';

const STORAGE_KEY = "yt_mentor_videos_v2";
const CLEARED_MARK_KEY = "yt_mentor_videos_cleared_v1";
const DELETED_IDS_KEY = "yt_mentor_deleted_video_ids_v1";
const DELETED_ARCHIVE_KEY = "yt_mentor_deleted_videos_archive_v1";
const DEFAULT_TTL_DAYS = 30;
const LEGACY_VIDEO_KEYS = [
  "videos",
  "localVideos",
  "youtubeMentorVideos",
  "yt_mentor_videos_v1",
];
const TRANSCRIPT_CACHE_KEY = "yt_mentor_transcript_cache_v1";
const YT_CHAPTER_CACHE_KEY = "yt_mentor_youtube_chapter_cache_v1";

function extractVideoId(url) {
  return url?.match(/[?&]v=([^&]+)/)?.[1] ?? null;
}

// Raw read: JSON.parse only — no cleanup, no migrations.
// Used internally by write operations that don't need the full pipeline.
function loadVideosRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Remove ai_analysis_ and analysis: cache entries whose savedAt is older than `days` days.
// Only removes entries that have a savedAt timestamp — entries without it are left alone.
function cleanExpiredAnalysisCaches(days = DEFAULT_TTL_DAYS) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith('ai_analysis_') && !k.startsWith('analysis:')) continue;
      try {
        const raw = localStorage.getItem(k);
        if (!raw) { toRemove.push(k); continue; }
        const parsed = JSON.parse(raw);
        const savedAt = parsed?.savedAt;
        if (savedAt && new Date(savedAt).getTime() < cutoff) toRemove.push(k);
      } catch {
        toRemove.push(k); // corrupt entry
      }
    }
    for (const k of toRemove) {
      try { localStorage.removeItem(k); } catch {}
    }
  } catch {}
}

// Load all videos from localStorage, auto-removing expired ones on read.
// One-time migrations:
// - If aiChapters already exist but miss navigation → add navigation without inventing new analysis
export function loadVideos() {
  try {
    cleanExpiredAnalysisCaches();
    const all = loadVideosRaw();
    let videos = cleanupOldVideos(all);

    let changed = videos.length !== all.length;

    // Keep imported videos in "not analyzed" state until the user runs manual analysis.
    if (videos.some((v) => !v.analysisStatus)) {
      videos = videos.map((v) => ({
        ...v,
        analysisStatus: v.analyzedAt || hasNonEmptyChapters(v.aiChapters) || v.shortSummary || v.fullSummary
          ? "analyzed"
          : "not_analyzed",
      }));
      changed = true;
    }

    // Never invent chapters on load. Only preserve/improve navigation for already stored chapters.
    if (videos.some((v) =>
      Array.isArray(v.aiChapters) &&
      v.aiChapters.length > 0 &&
      v.aiChapters.some((chapter) => !Number.isFinite(chapter?.startSeconds))
    )) {
      let fixedCount = 0;
      videos = videos.map((v) => {
        const hasStored = Array.isArray(v.aiChapters) && v.aiChapters.length > 0;
        if (!hasStored) return v;
        const upgraded = ensureChaptersHaveNavigation(v.aiChapters, v);
        const gainedNavigation =
          upgraded.length === v.aiChapters.length &&
          upgraded.some((chapter) => Number.isFinite(chapter?.startSeconds)) &&
          v.aiChapters.some((chapter) => !Number.isFinite(chapter?.startSeconds));
        if (!gainedNavigation) return v;
        fixedCount += 1;
        return {
          ...v,
          aiChapters: upgraded,
          updatedAt: new Date().toISOString(),
          chapterStatus: "fixed_navigation",
        };
      });
      if (fixedCount > 0) changed = true;
    }

    // Strip [MOCK] prefix from legacy AI summary fields
    if (videos.some(v => [v.aiSummary, v.aiSummaryShort, v.aiSummaryLong].some(s => s?.includes('[MOCK]')))) {
      videos = videos.map(v => ({
        ...v,
        ...(v.aiSummary?.includes('[MOCK]')      && { aiSummary:      v.aiSummary.replace(/\[MOCK\]\s*/g, '') }),
        ...(v.aiSummaryShort?.includes('[MOCK]') && { aiSummaryShort: v.aiSummaryShort.replace(/\[MOCK\]\s*/g, '') }),
        ...(v.aiSummaryLong?.includes('[MOCK]')  && { aiSummaryLong:  v.aiSummaryLong.replace(/\[MOCK\]\s*/g, '') }),
      }));
      changed = true;
    }

    if (changed) saveVideos(videos);
    return videos;
  } catch {
    return [];
  }
}

export function wereLocalVideosCleared() {
  try {
    return localStorage.getItem(CLEARED_MARK_KEY) === "1";
  } catch {
    return false;
  }
}

export function hasLocalVideoStoreSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

// Overwrite the entire store
export function saveVideos(videos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
    // If we successfully wrote videos, the store is no longer in "cleared" state.
    localStorage.removeItem(CLEARED_MARK_KEY);
  } catch (e) {
    console.warn("[videoStorage] write failed:", e.message);
  }
}

// Remove videos after `days` days.
// Manual videos expire by `addedAt`; scanned/imported videos expire by `fetchedAt`.
export function cleanupOldVideos(videos, days = DEFAULT_TTL_DAYS) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return videos.filter((v) => {
    if (v.isPermanent) return true;
    // Keep for 30 days after unpinning so removal feels non-destructive
    if (v.unpinnedAt && new Date(v.unpinnedAt).getTime() > cutoff) return true;
    const retentionAnchor =
      v.addedManually && v.addedAt
        ? v.addedAt
        : v.fetchedAt;
    if (!retentionAnchor) return true;
    return new Date(retentionAnchor).getTime() > cutoff;
  });
}

// Merge new videos into the store:
//   - dedup by URL and by YouTube video ID (v= param)
//   - skip videos that were explicitly deleted by the user
//   - stamp fetchedAt on each new record
//   - generate a local id if none provided
// Returns only the newly added records.
export function upsertVideos(newVideos) {
  const existing = loadVideosRaw();
  const now = new Date().toISOString();

  const existingUrls  = new Set(existing.map((v) => v.url));
  const existingYtIds = new Set(
    existing.map((v) => extractVideoId(v.url)).filter(Boolean)
  );

  const deleted = loadDeletedIds();
  const deletedUrls  = new Set(deleted.urls);
  const deletedYtIds = new Set(deleted.ytIds);

  const toAdd = newVideos
    .filter((v) => {
      const ytId = extractVideoId(v.url);
      // Skip if already in store
      if (existingUrls.has(v.url) || (ytId && existingYtIds.has(ytId))) return false;
      // Skip if user explicitly deleted this video
      if (deletedUrls.has(v.url) || (ytId && deletedYtIds.has(ytId))) return false;
      return true;
    })
    .map((v) => ({
      ...v,
      fetchedAt: v.fetchedAt ?? now,
      id: v.id ?? `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      analysisStatus:
        v.analysisStatus ||
        (v.analyzedAt || hasNonEmptyChapters(v.aiChapters) || v.shortSummary || v.fullSummary
          ? "analyzed"
          : "not_analyzed"),
    }));

  if (toAdd.length > 0) {
    saveVideos([...existing, ...toAdd]);
  }
  return toAdd;
}

// Update fields on a single stored video by id.
// Returns updated record, or null if not found.
export function updateStoredVideo(id, updates) {
  const videos = loadVideosRaw();
  const idx = videos.findIndex((v) => v.id === id);
  if (idx === -1) return null;
  // Migrate analysisStatus on this record only if not already set.
  if (!videos[idx].analysisStatus) {
    const v = videos[idx];
    videos[idx] = {
      ...v,
      analysisStatus:
        v.analyzedAt || hasNonEmptyChapters(v.aiChapters) || v.shortSummary || v.fullSummary
          ? "analyzed"
          : "not_analyzed",
    };
  }
  const safeUpdates = { ...updates };
  if (!hasNonEmptyChapters(safeUpdates.aiChapters)) {
    delete safeUpdates.aiChapters;
  }
  if (!hasNonEmptyChapters(safeUpdates.chapters)) {
    delete safeUpdates.chapters;
  }
  if (!hasNonEmptyChapters(safeUpdates.descriptionChapters)) {
    delete safeUpdates.descriptionChapters;
  }
  if (safeUpdates.aiChapters) {
    safeUpdates.aiChapters = ensureChaptersHaveNavigation(safeUpdates.aiChapters, {
      ...videos[idx],
      ...safeUpdates,
    });
  }
  if (
    !safeUpdates.analysisStatus &&
    (
      safeUpdates.analyzedAt ||
      hasNonEmptyChapters(safeUpdates.aiChapters) ||
      safeUpdates.shortSummary ||
      safeUpdates.fullSummary ||
      safeUpdates.aiSummaryShort ||
      safeUpdates.aiSummaryLong
    )
  ) {
    safeUpdates.analysisStatus = "analyzed";
  }
  const updated = { ...videos[idx], ...safeUpdates };
  videos[idx] = updated;
  saveVideos(videos);

  // Auto-strip heavy fields from localStorage after analysis is saved.
  // Transcript text is kept intentionally — user deletes it explicitly via "מחק תמלול".
  // Only description (rarely needed post-analysis) and raw segments (re-derivable) are stripped.
  const AUTO_STRIP_FIELDS = ['description', 'transcriptSegments'];
  if (updated.analysisStatus === 'analyzed') {
    const needsStrip = AUTO_STRIP_FIELDS.some(
      (f) => f in updated && updated[f] != null && updated[f] !== ''
    );
    if (needsStrip) {
      const stripped = { ...updated };
      for (const f of AUTO_STRIP_FIELDS) delete stripped[f];

      // Before losing description: extract chapters if not already saved elsewhere.
      // Covers the case where chapters were only derivable from video.description.
      if (
        !hasNonEmptyChapters(stripped.descriptionChapters) &&
        !hasNonEmptyChapters(stripped.chapters) &&
        typeof updated.description === 'string' &&
        updated.description.length > 0
      ) {
        const fromDesc = extractTimestampsFromDescription(updated.description);
        if (fromDesc.length > 0) {
          stripped.descriptionChapters = fromDesc.map((c) => ({
            ...c,
            timeSource: 'real',
            chapterSource: 'description_timestamp',
          }));
          if (!stripped.chapterSource) {
            stripped.chapterSource = 'description_timestamp';
          }
        }
      }

      videos[idx] = stripped;
      saveVideos(videos);
    }
  }

  return updated;
}

function loadDeletedIds() {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    return raw ? JSON.parse(raw) : { ids: [], urls: [], ytIds: [] };
  } catch {
    return { ids: [], urls: [], ytIds: [] };
  }
}

function saveDeletedIds(data) {
  try {
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(data));
  } catch {}
}

function loadDeletedArchive() {
  try {
    const raw = localStorage.getItem(DELETED_ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDeletedArchive(archive) {
  try {
    localStorage.setItem(DELETED_ARCHIVE_KEY, JSON.stringify(archive || {}));
  } catch {}
}

function archiveKeyForVideo(video) {
  if (!video) return null;
  const ytId =
    video.videoId ||
    video.youtubeId ||
    (video.url ? extractVideoId(video.url) : null) ||
    (video._videoId ? String(video._videoId).trim() : null);
  return ytId || video.id || null;
}

/** Keep a full snapshot so manual re-add can restore metadata without duplicates. */
export function archiveDeletedVideo(video) {
  const key = archiveKeyForVideo(video);
  if (!key || !video) return;
  const archive = loadDeletedArchive();
  archive[key] = {
    ...video,
    deletedAt: new Date().toISOString(),
  };
  saveDeletedArchive(archive);
}

/**
 * @returns {object | null} archived video snapshot, if any
 */
export function findArchivedDeletedVideo(ytId, url) {
  const archive = loadDeletedArchive();
  const keys = [ytId, url ? extractVideoId(url) : null].filter(Boolean);
  for (const key of keys) {
    if (archive[key]) return archive[key];
  }
  for (const entry of Object.values(archive)) {
    if (!entry || typeof entry !== 'object') continue;
    const entryYt =
      entry.videoId ||
      entry.youtubeId ||
      (entry.url ? extractVideoId(entry.url) : null);
    if (ytId && entryYt === ytId) return entry;
    if (url && entry.url === url) return entry;
  }
  return null;
}

export function isYoutubeIdDeleted(ytId) {
  if (!ytId) return false;
  const deleted = loadDeletedIds();
  return deleted.ytIds.includes(ytId);
}

/**
 * True when the video is only in deleted/blacklist state (not in the active store).
 */
export function isVideoDeletedOnly(ytId, url) {
  const fullUrl = url || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : null);
  const blacklisted =
    (fullUrl && isVideoDeleted(fullUrl)) || isYoutubeIdDeleted(ytId);
  if (!blacklisted) return false;
  const videos = loadVideosRaw();
  const inActive = videos.some((v) => {
    const vYt =
      v.videoId ||
      v.youtubeId ||
      (v.url ? extractVideoId(v.url) : null);
    return (ytId && vYt === ytId) || (fullUrl && v.url === fullUrl);
  });
  return !inActive;
}

export function getDeletedVideoRestoreInfo(ytId, url) {
  if (!ytId && !url) return null;
  const archived = findArchivedDeletedVideo(ytId, url);
  const deletedOnly = isVideoDeletedOnly(ytId, url);
  if (!deletedOnly && !archived) return null;
  const fullUrl = url || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : null);
  return {
    ytId,
    url: fullUrl,
    archived,
    previousId: archived?.id ?? null,
  };
}

function removeFromDeletedBlacklist({ id, url, ytId }) {
  const deleted = loadDeletedIds();
  if (id) deleted.ids = deleted.ids.filter((x) => x !== id);
  if (url) deleted.urls = deleted.urls.filter((x) => x !== url);
  if (ytId) deleted.ytIds = deleted.ytIds.filter((x) => x !== ytId);
  saveDeletedIds(deleted);
}

/**
 * Restore a previously deleted video to the active list (no duplicate).
 * @param {object} options
 * @param {string} options.ytId
 * @param {string} [options.url]
 * @param {object} [options.patch] — mentor/topic/metadata overrides from the add dialog
 * @returns {object | null} restored video record
 */
export function restoreDeletedVideo({ ytId, url, patch = {} }) {
  const fullUrl = url || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : null);
  const archived = findArchivedDeletedVideo(ytId, fullUrl);
  const archiveKey = archiveKeyForVideo(archived) || ytId;

  removeFromDeletedBlacklist({
    id: archived?.id,
    url: archived?.url || fullUrl,
    ytId: ytId || (fullUrl ? extractVideoId(fullUrl) : null),
  });

  const now = new Date().toISOString();
  const record = {
    ...(archived || {}),
    ...patch,
    url: fullUrl || archived?.url,
    videoId: ytId || archived?.videoId || archived?.youtubeId,
    youtubeId: ytId || archived?.youtubeId || archived?.videoId,
    id: archived?.id || patch.id || `ext_${ytId}`,
    deleted: false,
    isDeleted: false,
    deletedAt: null,
    restoredAt: now,
    fetchedAt: archived?.fetchedAt || now,
    addedManually: true,
    addedAt: archived?.addedAt || now,
  };

  const restored = forceUpsertVideo(record);

  if (archiveKey) {
    const archive = loadDeletedArchive();
    delete archive[archiveKey];
    saveDeletedArchive(archive);
  }

  return restored;
}

/** Remove one video by id from local store. Returns true if a row was removed. */
export function deleteStoredVideo(id) {
  const videos = loadVideosRaw();
  const target = videos.find((v) => v.id === id);
  const next = videos.filter((v) => v.id !== id);
  if (next.length === videos.length) return false;

  if (target) {
    archiveDeletedVideo(target);
  }

  saveVideos(next);

  // Persist to deleted-IDs blacklist so re-sync won't re-add it
  const deleted = loadDeletedIds();
  if (!deleted.ids.includes(id)) deleted.ids.push(id);
  if (target?.url && !deleted.urls.includes(target.url)) deleted.urls.push(target.url);
  const ytId =
    target?.videoId ||
    target?.youtubeId ||
    (target?.url ? extractVideoId(target.url) : null);
  if (ytId && !deleted.ytIds.includes(ytId)) deleted.ytIds.push(ytId);
  saveDeletedIds(deleted);

  // Keep analysis:{id} / ai_analysis_{id} so restore can recover saved Brain data.
  return true;
}

/** Check if a video (by url or ytId) has been explicitly deleted by the user. */
export function isVideoDeleted(url) {
  const deleted = loadDeletedIds();
  if (deleted.urls.includes(url)) return true;
  const ytId = url ? extractVideoId(url) : null;
  return ytId ? deleted.ytIds.includes(ytId) : false;
}

// Save or merge a video into localStorage regardless of whether it was stored before.
// Used as last-resort fallback when Base44 is unavailable and the video isn't in localStorage.
// Deduplicates by id → URL → YouTube video-id (in that priority order).
// Returns the saved record.
export function forceUpsertVideo(video) {
  if (!video?.id) return null;
  const videos = loadVideosRaw();
  const url = video.url;
  const ytId = url ? extractVideoId(url) : null;

  const idx = videos.findIndex(
    (v) =>
      v.id === video.id ||
      (url && v.url === url) ||
      (ytId && extractVideoId(v.url) === ytId)
  );

  const record = {
    ...video,
    fetchedAt: video.fetchedAt ?? new Date().toISOString(),
    id: video.id,
  };

  if (idx !== -1) {
    videos[idx] = { ...videos[idx], ...record };
  } else {
    videos.push(record);
  }

  saveVideos(videos);
  return idx !== -1 ? videos[idx] : record;
}

// Force re-analyze every stored video (useful after improving the analyzer).
// Returns the number of videos that were re-analyzed.
export function reanalyzeVideos() {
  const videos = loadVideos();
  if (!videos.length) return 0;
  const reanalyzed = videos.map((v) => analyzeVideo(v, { force: true }));
  saveVideos(reanalyzed);
  return reanalyzed.length;
}

export function getVideoCount() {
  return loadVideosRaw().length;
}

/**
 * Returns a breakdown of localStorage usage by category (MB).
 * Categories: transcripts, analyses, videos, other
 */
export function getStorageBreakdown() {
  const keyMB = (k) => {
    try {
      const v = localStorage.getItem(k);
      if (v == null) return 0;
      return ((k.length + v.length) * 2) / (1024 * 1024);
    } catch { return 0; }
  };

  let transcriptsMB = 0;
  let analysesMB = 0;
  let videosMB = 0;
  let otherMB = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const mb = keyMB(k);
      if (k === TRANSCRIPT_CACHE_KEY || k === YT_CHAPTER_CACHE_KEY) {
        transcriptsMB += mb;
      } else if (k.startsWith('ai_analysis_') || k.startsWith('analysis:')) {
        analysesMB += mb;
      } else if (k === STORAGE_KEY || LEGACY_VIDEO_KEYS.includes(k) || k === CLEARED_MARK_KEY) {
        videosMB += mb;
      } else {
        otherMB += mb;
      }
    }
  } catch {}

  return {
    transcriptsMB: parseFloat(transcriptsMB.toFixed(2)),
    analysesMB:    parseFloat(analysesMB.toFixed(2)),
    videosMB:      parseFloat(videosMB.toFixed(2)),
    otherMB:       parseFloat(otherMB.toFixed(2)),
  };
}

/** Returns total localStorage usage in MB (UTF-16: 2 bytes per char). */
export function getLocalStorageUsageMB() {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      total += (key?.length || 0) + (localStorage.getItem(key)?.length || 0);
    }
    return parseFloat(((total * 2) / (1024 * 1024)).toFixed(2));
  } catch {
    return 0;
  }
}

/**
 * Clean analysis caches and transcript caches WITHOUT deleting videos/notes/topics.
 * Removes: ai_analysis_*, analysis:*, transcript cache, chapter cache.
 * Returns { removedKeys, freedMB }
 */
export function cleanStorageCaches() {
  const before = getLocalStorageUsageMB();
  let removedKeys = 0;

  const cachesToRemove = [TRANSCRIPT_CACHE_KEY, YT_CHAPTER_CACHE_KEY];
  for (const key of cachesToRemove) {
    try { if (localStorage.getItem(key)) { localStorage.removeItem(key); removedKeys++; } } catch {}
  }

  try {
    const dynamicKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('ai_analysis_') || k.startsWith('analysis:'))) dynamicKeys.push(k);
    }
    for (const k of dynamicKeys) {
      try { localStorage.removeItem(k); removedKeys++; } catch {}
    }
  } catch {}

  const after = getLocalStorageUsageMB();
  return { removedKeys, freedMB: parseFloat((before - after).toFixed(2)) };
}

/**
 * The LARGE_VIDEO_FIELDS list: fields stored directly on each video object
 * that can be very large (50-500 KB per video) and are available elsewhere:
 * - transcript / manualTranscript / whisperTranscript → also in yt_mentor_transcript_cache_v1
 * - transcriptSegments → also in yt_transcript_segs_v1
 * - description → YouTube description, rarely needed after analysis
 *
 * Stripping these fields frees most of the "video data" MB.
 * Trade-off: re-analysis of a video after strip requires re-fetching the transcript.
 */
const LARGE_VIDEO_FIELDS = [
  'transcript',
  'manualTranscript',
  'whisperTranscript',
  'transcriptSegments',
  'description',
];

/**
 * Returns an estimate (MB) of transcript/description data embedded inside
 * the video records in yt_mentor_videos_v2.
 */
export function estimateEmbeddedTranscriptMB() {
  try {
    const videos = loadVideosRaw();
    let chars = 0;
    for (const v of videos) {
      for (const f of LARGE_VIDEO_FIELDS) {
        const val = v[f];
        if (typeof val === 'string') chars += val.length;
        else if (Array.isArray(val)) chars += JSON.stringify(val).length;
      }
    }
    return parseFloat(((chars * 2) / (1024 * 1024)).toFixed(2));
  } catch { return 0; }
}

/**
 * Remove transcript and description blobs from all stored video records.
 * Preserves all analysis results (keyPoints, summaries, chapters, etc.).
 * Returns { stripped: number, freedMB: number }.
 */
export function stripEmbeddedTranscripts() {
  const before = getLocalStorageUsageMB();
  const videos = loadVideosRaw();
  let stripped = 0;
  const cleaned = videos.map((v) => {
    const hasLargeField = LARGE_VIDEO_FIELDS.some((f) => f in v && v[f] != null && v[f] !== '');
    if (!hasLargeField) return v;
    stripped++;
    const next = { ...v };
    for (const f of LARGE_VIDEO_FIELDS) delete next[f];
    return next;
  });
  saveVideos(cleaned);
  const after = getLocalStorageUsageMB();
  return { stripped, freedMB: parseFloat((before - after).toFixed(2)) };
}

export function clearAllVideos() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Mark cleared so local-first mode won't fall back to mock data.
    localStorage.setItem(CLEARED_MARK_KEY, "1");
  } catch {}
}

/**
 * Safe local reset: removes ONLY video-related localStorage keys (videos + analysis caches).
 * Does NOT touch topics, mentors, categories, settings.
 *
 * @returns {number} how many keys were removed (best-effort)
 */
export function clearLocalVideoData() {
  let removed = 0;
  try {
    if (localStorage.getItem(STORAGE_KEY) != null) removed += 1;
    localStorage.removeItem(STORAGE_KEY);
  } catch {}

  for (const k of LEGACY_VIDEO_KEYS) {
    try {
      if (localStorage.getItem(k) != null) removed += 1;
      localStorage.removeItem(k);
    } catch {}
  }

  // AI analysis cache uses per-video keys: ai_analysis_${videoId}
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("ai_analysis_")) toRemove.push(k);
    }
    for (const k of toRemove) {
      try {
        localStorage.removeItem(k);
        removed += 1;
      } catch {}
    }
  } catch {}

  // Related caches (still video-related)
  try {
    if (localStorage.getItem(TRANSCRIPT_CACHE_KEY) != null) removed += 1;
    localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
  } catch {}
  try {
    if (localStorage.getItem(YT_CHAPTER_CACHE_KEY) != null) removed += 1;
    localStorage.removeItem(YT_CHAPTER_CACHE_KEY);
  } catch {}

  try {
    localStorage.setItem(CLEARED_MARK_KEY, "1");
  } catch {}

  return removed;
}
