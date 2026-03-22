// ─── RSS Ingestion Service ─────────────────────────────────────────────────────
// מושך סרטונים מ-YouTube RSS feeds ויוצר רשומות Video
//
// Flow:
//   fetchChannelRSS(mentorId) → raw XML from /api/rss proxy
//   parseYouTubeXML(xml)      → array of raw entries
//   buildVideoRecord(entry, cfg) → Video object ready for Base44

import { CHANNEL_CONFIG } from "@/config/channelConfig";
import { base44 } from "@/api/base44Client";

// ── Config ────────────────────────────────────────────────────────────────────
// כמה סרטונים אחרונים למשוך לכל ערוץ (YouTube RSS מחזיר עד 15)
export const RSS_FETCH_LIMIT = 5;

// ── Validation ────────────────────────────────────────────────────────────────
function validateChannelId(channelId, channelName) {
  if (!channelId) {
    throw new Error(`Channel ID חסר עבור "${channelName}" — עדכן channelConfig.js`);
  }
  if (!channelId.startsWith("UC") || channelId.length !== 24) {
    throw new Error(
      `Channel ID לא תקין עבור "${channelName}": "${channelId}" — חייב להתחיל ב-"UC" ולהיות 24 תווים`
    );
  }
}

// ── XML Parser ────────────────────────────────────────────────────────────────
// YouTube RSS namespace: http://www.youtube.com/xml/schemas/2015
const YT_NS = "http://www.youtube.com/xml/schemas/2015";

function parseYouTubeXML(xmlText, limit = RSS_FETCH_LIMIT) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("XML parse error: " + parseError.textContent.slice(0, 200));

  const entries = [...doc.querySelectorAll("entry")];

  return entries
    .slice(0, limit) // ← מגביל לסרטונים האחרונים לפי RSS_FETCH_LIMIT
    .map((entry) => {
      const videoId =
        entry.getElementsByTagNameNS(YT_NS, "videoId")[0]?.textContent?.trim() ?? null;

      const title = entry.querySelector("title")?.textContent?.trim() ?? null;
      const published = entry.querySelector("published")?.textContent?.trim() ?? null;
      const channelName = entry.querySelector("author > name")?.textContent?.trim() ?? null;

      const thumbnail = videoId
        ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        : null;

      return { videoId, title, published, channelName, thumbnail };
    })
    .filter((e) => e.videoId && e.title); // skip malformed entries
}

// ── Build a Video record from RSS entry ───────────────────────────────────────
function buildVideoRecord(entry, mentorId, channelCfg) {
  return {
    mentorId,
    sourceId: null,
    title: entry.title,
    url: `https://www.youtube.com/watch?v=${entry.videoId}`,
    thumbnail: entry.thumbnail,
    publishedAt: entry.published ?? new Date().toISOString(),
    category: channelCfg.category,
    transcript: null,
    shortSummary: null,
    fullSummary: null,
    keyPoints: null,
    tags: null,
    status: "new",
    errorMessage: null,
    isSaved: false,
    learningStatus: "not_started",
    topicIds: channelCfg.topicIds ?? [],
    subCategory: channelCfg.subCategory ?? "",
    // ── YouTube Data API v3 fields (not available from RSS) ──────────────────
    // TODO: after fetching https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id={entry.videoId}&key={API_KEY}
    //   duration:  item.contentDetails.duration  → convert ISO 8601 (PT4M13S) to seconds or "mm:ss" string
    //   viewCount: Number(item.statistics.viewCount)
    // ────────────────────────────────────────────────────────────────────────
    // Internal dedup keys (stripped before saving to Base44)
    _videoId: entry.videoId,
    _channelName: entry.channelName ?? channelCfg.name,
  };
}

// ── Fetch RSS XML ────────────────────────────────────────────────────────────
// Priority: Base44 backend function → Vite dev proxy (fallback)
async function fetchRssXml(channelId, channelName) {
  // 1. Try Base44 backend function (works in both dev and production)
  try {
    const result = await base44.functions.FetchRSS({ channelId });
    if (result?.xml) {
      console.info(`[RSS] ${channelName}: fetched via Base44 backend`);
      return result.xml;
    }
  } catch (e) {
    console.warn(`[RSS] ${channelName}: Base44 FetchRSS unavailable — falling back to dev proxy`, e.message);
  }

  // 2. Fallback: Vite dev server proxy (only works in development)
  const proxyUrl = `/api/rss?channelId=${encodeURIComponent(channelId)}`;
  const res = await fetch(proxyUrl);

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.message ?? `HTTP ${res.status}`;
    const hint = res.status === 404
      ? `Channel ID "${channelId}" לא נמצא ב-YouTube. בדוק את ה-ID או הרץ "זהה" מחדש.`
      : detail;
    throw new Error(`שגיאת RSS עבור "${channelName}": ${hint}`);
  }

  console.info(`[RSS] ${channelName}: fetched via dev proxy`);
  return res.text();
}

// ── Fetch one channel's RSS ───────────────────────────────────────────────────
// Returns up to RSS_FETCH_LIMIT video records
export async function fetchChannelRSS(mentorId, limit = RSS_FETCH_LIMIT) {
  const cfg = CHANNEL_CONFIG[mentorId];
  if (!cfg) throw new Error(`ערוץ לא מוגדר: ${mentorId}`);

  // Validate channel ID format before making any request
  validateChannelId(cfg.channelId, cfg.name);

  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${cfg.channelId}`;
  console.info(`[RSS] Fetching ${cfg.name}\n  source: ${rssUrl}`);

  const xml = await fetchRssXml(cfg.channelId, cfg.name);

  // Sanity check — a valid YouTube RSS feed always contains <feed>
  if (!xml.includes("<feed")) {
    throw new Error(`תגובה לא תקינה מ-YouTube עבור "${cfg.name}". ייתכן שה-Channel ID שגוי.`);
  }

  const entries = parseYouTubeXML(xml, limit);

  console.info(`[RSS] ${cfg.name}: ${entries.length} סרטונים (מגבלה: ${limit})`);

  return entries.map((e) => buildVideoRecord(e, mentorId, cfg));
}

// ── Deduplication helper ──────────────────────────────────────────────────────
// Checks both full URL and extracted videoId to avoid duplicates
// even if URL format differs slightly between sources
function extractVideoId(url) {
  return url?.match(/[?&]v=([^&]+)/)?.[1] ?? null;
}

export function filterNewVideos(incoming, existingVideos) {
  const existingUrls = new Set(existingVideos.map((v) => v.url));
  const existingVideoIds = new Set(
    existingVideos.map((v) => extractVideoId(v.url)).filter(Boolean)
  );
  return incoming.filter(
    (v) => !existingUrls.has(v.url) && !existingVideoIds.has(v._videoId)
  );
}

// ── Ingest one channel: fetch → deduplicate → save ────────────────────────────
export async function ingestChannel({ mentorId, existingVideos = [], saveVideo, limit = RSS_FETCH_LIMIT }) {
  const incoming = await fetchChannelRSS(mentorId, limit);
  const toSave = filterNewVideos(incoming, existingVideos);

  const saved = [];
  for (const record of toSave) {
    const { _videoId, _channelName, ...videoData } = record;
    await saveVideo(videoData);
    saved.push(record);
  }

  return {
    saved: saved.length,
    skipped: incoming.length - toSave.length,
    videos: saved,
  };
}

// ── Ingest multiple channels ──────────────────────────────────────────────────
export async function ingestChannels({ mentorIds, existingVideos = [], saveVideo, onProgress, limit = RSS_FETCH_LIMIT }) {
  const results = {};

  for (const mentorId of mentorIds) {
    const cfg = CHANNEL_CONFIG[mentorId];
    const channelName = cfg?.name ?? mentorId;

    try {
      onProgress?.({ mentorId, channelName, status: "loading" });
      const result = await ingestChannel({ mentorId, existingVideos, saveVideo, limit });
      results[mentorId] = { status: "success", ...result, channelName };
      onProgress?.({ mentorId, channelName, status: "success", ...result });
    } catch (err) {
      results[mentorId] = { status: "error", error: err.message, channelName };
      onProgress?.({ mentorId, channelName, status: "error", error: err.message });
    }
  }

  return results;
}
