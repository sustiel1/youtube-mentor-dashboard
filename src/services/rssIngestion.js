// ─── RSS Ingestion Service ─────────────────────────────────────────────────────
// מושך סרטונים מ-YouTube RSS feeds ויוצר רשומות Video
//
// Flow (DB-driven, preferred):
//   fetchChannelRSSFromSource(mentor, source, topics) → uses real DB entities
//
// Flow (legacy, channelConfig-based):
//   fetchChannelRSS(mentorId) → looks up CHANNEL_CONFIG by hardcoded ID

import { CHANNEL_CONFIG } from "@/config/channelConfig";
import { CATEGORY_TO_NAME } from "@/config/topicConfig";
import { base44 } from "@/api/base44Client";
import { isBase44Enabled } from "@/config/base44Flags";
import { fetchVideoMetadata } from "@/services/youtubeApi";
import {
  extractChannelIdFromUrl,
  extractHandleFromUrl,
} from "@/lib/mentorSourceUrl";

export { extractChannelIdFromUrl, extractHandleFromUrl };

// Best-effort: fetch duration + viewCount from YouTube watch page (no API key needed).
// Returns the record unchanged if the fetch fails or times out.
async function enrichWithYouTubeMetadata(record) {
  const videoId = record._videoId;
  if (!videoId) return record;
  try {
    const meta = await fetchVideoMetadata(videoId);
    if (!meta) return record;
    return {
      ...record,
      ...(meta.duration != null ? { duration: meta.duration } : {}),
      ...(Number.isFinite(meta.viewCount) ? { viewCount: meta.viewCount } : {}),
    };
  } catch {
    return record;
  }
}

// ── Config ────────────────────────────────────────────────────────────────────
// כמה סרטונים אחרונים למשוך לכל ערוץ (YouTube RSS מחזיר עד 15)
export const RSS_FETCH_LIMIT = 5;

// ── Validation ────────────────────────────────────────────────────────────────
export function validateChannelId(channelId, channelName) {
  if (!channelId) {
    throw new Error(`Channel ID חסר עבור "${channelName}"`);
  }
  const id = String(channelId).trim();
  if (id.includes('...') || id.includes('…')) {
    throw new Error(`Channel ID מקוצר עבור "${channelName}": "${id}" — נא להזין את ה-ID המלא`);
  }
  if (/\s/.test(id)) {
    throw new Error(`Channel ID מכיל רווחים עבור "${channelName}": "${id}"`);
  }
  if (!id.startsWith('UC')) {
    throw new Error(`Channel ID לא תקין עבור "${channelName}": "${id}" — חייב להתחיל ב-"UC"`);
  }
  if (id.length < 20 || id.length > 30) {
    throw new Error(
      `Channel ID באורך לא תקין עבור "${channelName}": "${id}" (${id.length} תווים, צפוי 20–30)`
    );
  }
}

// ── XML Parser ────────────────────────────────────────────────────────────────
// YouTube RSS namespace: http://www.youtube.com/xml/schemas/2015
const YT_NS = "http://www.youtube.com/xml/schemas/2015";
const MEDIA_NS = "http://search.yahoo.com/mrss/";
const ATOM_NS = "http://www.w3.org/2005/Atom";

/** Plain-text description from feed entry (for chapter timestamps). May be truncated in RSS. */
function getEntryDescription(entry) {
  const fromMedia = entry.getElementsByTagNameNS(MEDIA_NS, "description")[0]?.textContent?.trim();
  if (fromMedia) return fromMedia;
  const group = entry.getElementsByTagNameNS(MEDIA_NS, "group")[0];
  if (group) {
    const g = group.getElementsByTagNameNS(MEDIA_NS, "description")[0]?.textContent?.trim();
    if (g) return g;
  }
  const summary = entry.getElementsByTagNameNS(ATOM_NS, "summary")[0]?.textContent?.trim();
  return summary || null;
}

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

      const description = getEntryDescription(entry);

      return { videoId, title, published, channelName, thumbnail, description };
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
    publishedAt: entry.published || null,
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
    analysisStatus: "not_analyzed",
    topicIds: channelCfg.topicIds ?? [],
    subCategory: channelCfg.subCategory ?? "",
    description: entry.description ?? null,
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
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  console.log('[rss] fetching', { channelName, channelId, rssUrl });

  if (isBase44Enabled() && base44) {
    try {
      const result = await base44.functions.FetchRss({ channelId });
      if (result?.xml) {
        console.log('[rss] success (Base44)', { channelName, channelId });
        return result.xml;
      }
    } catch (e) {
      console.warn(`[rss] Base44 FetchRSS unavailable — falling back to dev proxy`, { channelName, error: e.message });
    }
  }

  // Local-first / fallback: Vite dev server proxy
  const proxyUrl = `/api/rss?channelId=${encodeURIComponent(channelId)}`;
  const res = await fetch(proxyUrl);

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.message ?? `HTTP ${res.status}`;
    const hint =
      res.status === 404
        ? `Channel ID "${channelId}" לא נמצא ב-YouTube — בדוק שה-ID נכון.`
        : res.status === 500
        ? `YouTube החזיר 500 — ייתכן שה-Channel ID שגוי או שיש תקלה זמנית. נסה שוב בעוד כמה דקות.`
        : detail;
    console.error('[rss] failed', { channelName, channelId, status: res.status, error: hint });
    throw new Error(`שגיאת RSS עבור "${channelName}": ${hint}`);
  }

  const xml = await res.text();
  console.log('[rss] success (proxy)', { channelName, channelId });
  return xml;
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
    const enriched = await enrichWithYouTubeMetadata(record);
    const { _videoId, _channelName, ...videoData } = enriched;
    await saveVideo(videoData);
    saved.push(enriched);
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

// ── DB-driven helpers ─────────────────────────────────────────────────────────
// extractChannelIdFromUrl / extractHandleFromUrl → @/lib/mentorSourceUrl

// Derive topicIds for a mentor using real DB topics.
// Uses mentor.topicIds if already set; otherwise maps mentor.category → Topic by name.
export function getTopicIdsForMentor(mentor, topics = []) {
  if (mentor.topicIds?.length) return mentor.topicIds;
  if (!mentor.category) return [];
  const topicName = CATEGORY_TO_NAME[mentor.category];
  if (!topicName) return [];
  const matched = topics.find(
    (t) => t.name && (
      t.name === topicName ||
      t.name.toLowerCase().includes(topicName.toLowerCase()) ||
      topicName.toLowerCase().includes(t.name.toLowerCase())
    )
  );
  return matched ? [matched.id] : [];
}

// ── DB-driven fetch (preferred over fetchChannelRSS) ──────────────────────────
// Uses real Mentor.id, real Source.sourceUrl, real Topic IDs from DB.
// source.sourceUrl should be:
//   - https://www.youtube.com/channel/UCxxxxxx  (has channelId → fetch directly)
//   - https://www.youtube.com/@handle           (needs resolve → then save channel URL)
export async function fetchChannelRSSFromSource(mentor, source, topics = [], limit = RSS_FETCH_LIMIT) {
  const fromSource = extractChannelIdFromUrl(source?.sourceUrl);
  const channelId = fromSource || mentor.youtubeChannelId || null;

  console.log('[rss-source] channelId resolution', {
    mentorName:      mentor.name,
    fromSourceUrl:   fromSource || '—',
    fromMentorField: mentor.youtubeChannelId || mentor.channelId || '—',
    resolved:        channelId || '—',
    sourceUrl:       source?.sourceUrl || '—',
  });

  if (!channelId) {
    throw new Error(`Channel ID חסר עבור "${mentor.name}"`);
  }

  validateChannelId(channelId, mentor.name);

  const xml = await fetchRssXml(channelId, mentor.name);
  if (!xml.includes("<feed")) {
    throw new Error(`תגובה לא תקינה מ-YouTube עבור "${mentor.name}"`);
  }

  const entries = parseYouTubeXML(xml, limit);
  const topicIds = getTopicIdsForMentor(mentor, topics);

  console.log('[rss] success', { mentorName: mentor.name, videosCount: entries.length, topicIds });

  return Promise.all(entries.map(async (e) => {
    const record = {
    mentorId:       mentor.id,
    sourceId:       source?.id ?? null,
    title:          e.title,
    url:            `https://www.youtube.com/watch?v=${e.videoId}`,
    thumbnail:      e.thumbnail,
    publishedAt:    e.published || null,
    category:       mentor.category ?? null,
    transcript:     null,
    shortSummary:   null,
    fullSummary:    null,
    keyPoints:      null,
    tags:           null,
    status:         "new",
    errorMessage:   null,
    isSaved:        false,
    learningStatus: "not_started",
    analysisStatus: "not_analyzed",
    topicIds,
    subCategory:    "",
    description:    e.description ?? null,
    _videoId:       e.videoId,
    _channelName:   e.channelName ?? mentor.name,
    };

    return enrichWithYouTubeMetadata(record);
  }));
}
