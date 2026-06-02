/**
 * Global Obsidian export metadata header — presentation only.
 */

import { formatVideoDuration } from "./videoDuration";

const ANALYSIS_TYPE_BY_CONTENT = {
  political: "Political Analysis",
  fundamental: "Fundamental Analysis",
  technical: "Technical Analysis",
  market: "Market / Trading Analysis",
  general: "General Analysis",
};

const ANALYSIS_TYPE_BY_SAVE = {
  political: "Political Analysis",
  fundamental: "Fundamental Analysis",
  bulk: "Useful Knowledge",
  single: "Useful Knowledge",
  summary: "Summary",
  notes: "Notes",
  gemini: "Gemini Export",
  technical: "Technical Analysis",
  learning: "Learning Export",
  session: "Session Export",
  atomic: "Atomic Knowledge",
};

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function formatExportedAt(iso) {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso || "—");
  }
}

function resolveVideoUrl(video = {}) {
  const raw = video.url || video.link || video.videoUrl;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const id = video.videoId || video.id;
  if (id && /^[a-zA-Z0-9_-]{11}$/.test(String(id))) {
    return `https://www.youtube.com/watch?v=${id}`;
  }
  return "";
}

function resolveCurrentPlaybackLabel(video = {}) {
  const sec = Number(
    video.currentPlaybackSeconds ??
      video.playbackPositionSeconds ??
      video.playbackPosition ??
      video.currentTime
  );
  if (!Number.isFinite(sec) || sec < 0) return null;
  const total = Math.floor(sec);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function countTranscriptWords(video = {}) {
  const candidates = [
    video.transcript,
    video.manualTranscript,
    video.whisperTranscript,
    video.fullTranscriptText,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.trim().split(/\s+/).filter(Boolean).length;
    }
  }
  const segments =
    video.transcriptSegments ||
    video.segments ||
    video.storedTranscriptSegments ||
    (Array.isArray(video.transcript_segments) ? video.transcript_segments : null);
  if (Array.isArray(segments) && segments.length > 0) {
    const joined = segments
      .map((s) => (typeof s === "string" ? s : s?.text || s?.content || ""))
      .join(" ");
    const n = joined.trim().split(/\s+/).filter(Boolean).length;
    return n > 0 ? n : null;
  }
  return null;
}

function countTranscriptSegments(video = {}) {
  const segments =
    video.transcriptSegments ||
    video.segments ||
    video.storedTranscriptSegments ||
    (Array.isArray(video.transcript_segments) ? video.transcript_segments : null);
  if (Array.isArray(segments)) return segments.length;
  return null;
}

export function resolveObsidianAnalysisTypeLabel(video = {}, options = {}) {
  if (options.analysisType) return String(options.analysisType).trim();
  if (options.saveType && ANALYSIS_TYPE_BY_SAVE[options.saveType]) {
    return ANALYSIS_TYPE_BY_SAVE[options.saveType];
  }
  const ct = String(video.contentType || "").trim().toLowerCase();
  if (ANALYSIS_TYPE_BY_CONTENT[ct]) return ANALYSIS_TYPE_BY_CONTENT[ct];
  if (video.analysisMode === "gemini-basic-summary") return "Gemini Summary";
  if (video.analysisMode) return `Analysis (${video.analysisMode})`;
  return "General Analysis";
}

/**
 * @returns {{
 *   title: string,
 *   videoUrl: string,
 *   currentTime: string|null,
 *   duration: string|null,
 *   wordCount: number|null,
 *   segmentCount: number|null,
 *   exportedAt: string,
 *   analysisType: string,
 * }}
 */
export function buildObsidianExportMetadataContext(video = {}, options = {}) {
  const v = video || {};
  const title = String(options.title || v.title || "Untitled").trim() || "Untitled";
  const duration = formatVideoDuration(
    options.duration ??
      v.duration ??
      v.durationSeconds ??
      v.videoDuration ??
      v.metadata?.duration
  );

  return {
    title,
    channelTitle: String(options.channelTitle || v.channelTitle || v.channel || v.channelName || "").trim(),
    videoUrl: String(options.videoUrl || resolveVideoUrl(v) || "").trim(),
    currentTime:
      options.currentTime !== undefined
        ? options.currentTime
        : resolveCurrentPlaybackLabel(v),
    duration: duration || null,
    wordCount:
      options.wordCount !== undefined ? options.wordCount : countTranscriptWords(v),
    segmentCount:
      options.segmentCount !== undefined ? options.segmentCount : countTranscriptSegments(v),
    exportedAt: options.exportedAt || new Date().toISOString(),
    analysisType: resolveObsidianAnalysisTypeLabel(v, options),
  };
}

/** Full metadata block for standalone markdown files. */
export function buildObsidianExportMetadataHeader(ctx) {
  const lines = [`# ${ctx.title}`, ""];

  if (ctx.videoUrl) {
    lines.push(`[▶ Open Video](${ctx.videoUrl})`, "");
  }

  lines.push(
    `- Current Time: ${displayValue(ctx.currentTime)}`,
    `- Duration: ${displayValue(ctx.duration)}`,
    `- Channel: ${displayValue(ctx.channelTitle)}`,
    `- Words: ${displayValue(ctx.wordCount)}`,
    `- Segments: ${displayValue(ctx.segmentCount)}`,
    `- Exported At: ${formatExportedAt(ctx.exportedAt)}`,
    `- Analysis Type: ${displayValue(ctx.analysisType)}`,
    "",
    "---",
    ""
  );

  return lines.join("\n");
}

/** Compact metadata block for vault append sections (after ### title). */
export function buildObsidianAppendSectionMetadata(video = {}, options = {}) {
  const ctx = buildObsidianExportMetadataContext(video, options);
  const lines = [];

  if (ctx.videoUrl) {
    lines.push(`🎬 [צפה בסרטון](${ctx.videoUrl})`);
  }
  if (ctx.channelTitle) {
    lines.push(`📺 ${ctx.channelTitle}`);
  }
  if (ctx.duration) {
    lines.push(`⏱️ ${ctx.duration}`);
  }
  if (ctx.videoUrl || ctx.channelTitle || ctx.duration) {
    lines.push("");
  }

  lines.push("---", "");

  return lines.join("\n");
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripDuplicateLeadingTitle(body, title) {
  if (!body || !title) return body;
  const escaped = escapeRegex(title.trim());
  return body.replace(new RegExp(`^#\\s+${escaped}\\s*\\n+`, "i"), "");
}

/**
 * Prepends (after YAML frontmatter if present) the global metadata header.
 */
export function applyObsidianExportMetadata(content, video = {}, options = {}) {
  if (options?.skipMetadata) return String(content || "");

  const ctx = buildObsidianExportMetadataContext(video, options);
  const header = buildObsidianExportMetadataHeader(ctx);
  const raw = String(content || "");

  const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n?/);
  if (fmMatch) {
    const fm = fmMatch[0];
    let body = raw.slice(fm.length).trimStart();
    body = stripDuplicateLeadingTitle(body, ctx.title);
    return `${fm}${header}${body}`.trimEnd() + "\n";
  }

  let body = raw.trimStart();
  body = stripDuplicateLeadingTitle(body, ctx.title);
  return `${header}${body}`.trimEnd() + "\n";
}

/** Payload fields for vault API routes. */
export function buildVaultExportMetadataPayload(video = {}, options = {}) {
  const ctx = buildObsidianExportMetadataContext(video, options);
  return {
    videoUrl: ctx.videoUrl || null,
    channelTitle: ctx.channelTitle || null,
    duration: ctx.duration,
    currentTime: ctx.currentTime,
    wordCount: ctx.wordCount,
    segmentCount: ctx.segmentCount,
    exportedAt: ctx.exportedAt,
    analysisType: ctx.analysisType,
  };
}
