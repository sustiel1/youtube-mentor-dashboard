import { fetchChannelRSSFromSource } from "./rssIngestion";
import { upsertVideos } from "./videoStorage";
import { repairChannelId, buildCanonicalChannelUrl } from "./channelResolver";

function stripInternalVideoFields(video) {
  const { _videoId, _channelName, ...rest } = video || {};
  return rest;
}

function isWithinLastDays(iso, days, now = Date.now()) {
  if (!iso) return false;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return d.getTime() >= cutoff;
}

function resolveMentorChannelInput(mentor, sourceUrl) {
  const fromSource = String(sourceUrl || "").trim();
  if (fromSource) return fromSource;
  const direct =
    mentor?.youtubePageUrl ||
    mentor?.channelUrl ||
    mentor?.youtubeUrl ||
    null;
  if (direct) return String(direct).trim();
  const id = String(mentor?.youtubeChannelId || mentor?.channelId || "").trim();
  if (id) return buildCanonicalChannelUrl(id) || id;
  return "";
}

/**
 * Fetch a single mentor's RSS feed, import only videos published in the last N days,
 * and dedupe via videoStorage.upsertVideos (by URL and v=videoId).
 *
 * @returns {{ fetchedCount:number, recentCount:number, addedCount:number, existingCount:number, channelId:string|null }}
 */
export async function refreshMentorLastNDays({
  mentor,
  sourceUrl = null,
  topics = [],
  days = 30,
  limit = 15,
}) {
  if (!mentor?.id) throw new Error("מנטור לא תקין");

  const input = resolveMentorChannelInput(mentor, sourceUrl);
  if (!input) {
    throw new Error("לא נמצא קישור ערוץ תקין למנטור");
  }

  // Ensure we have a channelId for RSS. This supports /@handle, /c/, /user/ and /channel/ URLs.
  const repaired = await repairChannelId({
    mentor,
    channelUrl: input,
    handle: null,
    forceRepair: false,
  });

  if (!repaired?.success || !repaired.channelId) {
    throw new Error(repaired?.error || "לא ניתן לזהות ערוץ YouTube");
  }

  const canonicalUrl = repaired.channelUrl || buildCanonicalChannelUrl(repaired.channelId);
  if (!canonicalUrl) throw new Error("לא ניתן לזהות ערוץ YouTube");

  const fetched = await fetchChannelRSSFromSource(
    mentor,
    { id: `src_${mentor.id}`, mentorId: mentor.id, sourceType: "youtube", sourceUrl: canonicalUrl, active: true },
    topics,
    limit
  );

  const fetchedCount = Array.isArray(fetched) ? fetched.length : 0;
  const recent = (Array.isArray(fetched) ? fetched : []).filter((v) => isWithinLastDays(v?.publishedAt, days));
  const recentCount = recent.length;

  const added = upsertVideos(recent.map(stripInternalVideoFields));
  const addedCount = Array.isArray(added) ? added.length : 0;
  const existingCount = recentCount - addedCount;

  return {
    fetchedCount,
    recentCount,
    addedCount,
    existingCount,
    channelId: repaired.channelId,
  };
}

