import { fetchChannelRSSFromSource, RSS_FETCH_LIMIT } from "./rssIngestion";
import { loadVideos, upsertVideos } from "./videoStorage";

export const CHANNEL_SCAN_INTERVAL_MS = 8 * 60 * 60 * 1000;

const LAST_SCAN_KEY = "lastChannelScanAt";
const LAST_SCAN_SUMMARY_KEY = "lastChannelScanSummary";
const NEXT_SCAN_KEY = "nextChannelScanAt";
const CHANNEL_SCAN_EVENT = "yt-channel-scan-updated";

let inFlightScanPromise = null;
const SCAN_DEBUG = false;

function isScanDebugEnabled() {
  if (SCAN_DEBUG) return true;
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("youtubeMentorScanDebug");
    return raw === "true" || raw === "1";
  } catch {
    return false;
  }
}

function scanDebugLog(message, payload) {
  if (!isScanDebugEnabled()) return;
  if (payload === undefined) {
    console.log(message);
    return;
  }
  console.log(message, payload);
}

function extractVideoId(url) {
  return url?.match(/[?&]v=([^&]+)/)?.[1] ?? null;
}

function getDuplicateReason(candidate, existingVideos) {
  const url = candidate?.url || null;
  const ytId = candidate?._videoId || extractVideoId(url);
  const duplicate = (existingVideos || []).find(
    (video) =>
      (url && video.url === url) ||
      (ytId && extractVideoId(video.url) === ytId)
  );
  if (!duplicate) return null;
  return {
    reason: "duplicate",
    duplicateId: duplicate.id,
    duplicateTitle: duplicate.title || null,
  };
}

function getSkipReason(candidate, existingVideos) {
  if (candidate?.hidden || candidate?.isHidden) return { reason: "hidden" };
  if (candidate?.deletedAt || candidate?.isDeleted) return { reason: "deleted" };
  return getDuplicateReason(candidate, existingVideos);
}

function summarizeLatestItems(videos) {
  return (videos || []).slice(0, 5).map((video) => ({
    videoId: video._videoId || extractVideoId(video.url),
    title: video.title,
    publishedAt: video.publishedAt,
  }));
}

function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function readIso(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeIso(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function emitChannelScanUpdate(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANNEL_SCAN_EVENT, { detail }));
}

function stripInternalVideoFields(video) {
  const { _videoId, _channelName, ...rest } = video || {};
  return rest;
}

function isMentorScannable(mentor) {
  const channelId = String(mentor?.youtubeChannelId || "").trim();
  return mentor && mentor.active !== false && channelId.startsWith("UC") && channelId.length === 24;
}

export function getLastChannelScanAt() {
  return readIso(LAST_SCAN_KEY);
}

export function getNextChannelScanAt() {
  return readIso(NEXT_SCAN_KEY);
}

export function getLastChannelScanSummary() {
  return readJson(LAST_SCAN_SUMMARY_KEY, null);
}

export function getChannelScanState() {
  return {
    lastChannelScanAt: getLastChannelScanAt(),
    nextChannelScanAt: getNextChannelScanAt(),
    lastChannelScanSummary: getLastChannelScanSummary(),
  };
}

export function shouldAutoChannelScan() {
  const last = getLastChannelScanAt();
  if (!last) return true;
  const lastTs = new Date(last).getTime();
  if (!Number.isFinite(lastTs)) return true;
  return Date.now() - lastTs >= CHANNEL_SCAN_INTERVAL_MS;
}

export function subscribeToChannelScanUpdates(listener) {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => listener(event?.detail || null);
  window.addEventListener(CHANNEL_SCAN_EVENT, handler);
  return () => window.removeEventListener(CHANNEL_SCAN_EVENT, handler);
}

export async function runChannelScan(
  mentors,
  { reason = "manual", force = false, onProgress } = {}
) {
  if (inFlightScanPromise) return inFlightScanPromise;

  if (reason === "auto" && !force && !shouldAutoChannelScan()) {
    const state = getChannelScanState();
    return {
      skipped: true,
      reason: "interval_not_elapsed",
      ...state,
    };
  }

  const allMentors = Array.isArray(mentors) ? mentors : [];
  const eligibleMentors = allMentors.filter(isMentorScannable);
  const skippedInactiveMentors = allMentors.filter((mentor) => mentor && !isMentorScannable(mentor));

  skippedInactiveMentors.forEach((mentor) => {
    scanDebugLog("[Mentor scan] skipped mentor inactive", {
      mentorId: mentor.id,
      mentorName: mentor.name,
      youtubeChannelId: mentor.youtubeChannelId || null,
      active: mentor.active,
    });
  });

  const runPromise = (async () => {
    const startedAt = new Date();
    emitChannelScanUpdate({
      state: "scanning",
      startedAt: startedAt.toISOString(),
      reason,
    });

    let scannedChannels = 0;
    let addedCount = 0;
    let existingCount = 0;
    let failedCount = 0;
    const failures = [];

    for (const mentor of eligibleMentors) {
      scannedChannels += 1;
      onProgress?.({ mentorId: mentor.id, mentorName: mentor.name, state: "loading" });
      try {
        const existingBefore = loadVideos();
        const fetched = await fetchChannelRSSFromSource(mentor, null, [], RSS_FETCH_LIMIT);
        const channelId = String(mentor?.youtubeChannelId || "").trim();
        const rssUrl = channelId
          ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
          : null;

        scanDebugLog("[Mentor scan] mentorName", mentor.name);
        scanDebugLog("[Mentor scan] RSS URL", rssUrl);
        scanDebugLog("[Mentor scan] fetched item count", fetched.length);
        scanDebugLog("[Mentor scan] latest 5 items", summarizeLatestItems(fetched));

        const debugSummary = {
          mentorId: mentor.id,
          mentorName: mentor.name,
          fetched: fetched.length,
          added: 0,
          skipped: 0,
          skipReasons: {},
        };

        fetched.forEach((candidate) => {
          const decision = getSkipReason(candidate, existingBefore);
          const payload = {
            videoId: candidate._videoId || extractVideoId(candidate.url),
            title: candidate.title,
            publishedAt: candidate.publishedAt,
          };

          if (decision) {
            debugSummary.skipped += 1;
            debugSummary.skipReasons[decision.reason] = (debugSummary.skipReasons[decision.reason] || 0) + 1;
            scanDebugLog(`[Mentor scan] skipped reason=${decision.reason}`, {
              ...payload,
              ...decision,
            });
            return;
          }

          debugSummary.added += 1;
          scanDebugLog("[Mentor scan] added candidate", payload);
        });

        const added = upsertVideos(fetched.map(stripInternalVideoFields));
        const addedForMentor = added.length;
        const existingForMentor = fetched.length - addedForMentor;

        addedCount += addedForMentor;
        existingCount += existingForMentor;

        scanDebugLog("[Mentor scan] summary", {
          ...debugSummary,
          addedActual: addedForMentor,
          skippedActual: existingForMentor,
        });

        onProgress?.({
          mentorId: mentor.id,
          mentorName: mentor.name,
          state: "success",
          fetchedCount: fetched.length,
          addedCount: addedForMentor,
          existingCount: existingForMentor,
        });
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
        failures.push({
          mentorId: mentor.id,
          mentorName: mentor.name,
          error: message,
        });
        onProgress?.({
          mentorId: mentor.id,
          mentorName: mentor.name,
          state: "error",
          error: message,
        });
      }
    }

    const finishedAt = new Date();
    const nextAt = new Date(finishedAt.getTime() + CHANNEL_SCAN_INTERVAL_MS);
    const summary = {
      scannedChannels,
      addedCount,
      existingCount,
      failedCount,
      failures,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      reason,
    };

    writeIso(LAST_SCAN_KEY, finishedAt.toISOString());
    writeIso(NEXT_SCAN_KEY, nextAt.toISOString());
    writeJson(LAST_SCAN_SUMMARY_KEY, summary);

    emitChannelScanUpdate({
      state: "completed",
      lastChannelScanAt: finishedAt.toISOString(),
      nextChannelScanAt: nextAt.toISOString(),
      lastChannelScanSummary: summary,
    });

    return {
      skipped: false,
      lastChannelScanAt: finishedAt.toISOString(),
      nextChannelScanAt: nextAt.toISOString(),
      lastChannelScanSummary: summary,
    };
  })();

  inFlightScanPromise = runPromise.finally(() => {
    inFlightScanPromise = null;
  });

  return inFlightScanPromise;
}
