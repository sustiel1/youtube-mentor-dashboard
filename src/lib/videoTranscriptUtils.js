/**
 * Resolves the best available transcript text from a video object.
 * Priority order (matches the pattern used in obsidianExportMetadata.js):
 *   1. video.transcriptText
 *   2. video.transcript
 *   3. video.fullTranscript / video.fullTranscriptText
 *   4. video.manualTranscript
 *   5. video.whisperTranscript
 *   6. Segment arrays (transcriptSegments, segments, storedTranscriptSegments, transcript_segments)
 *   7. localStorage segment store (yt_transcript_segs_v1)
 *
 * Returns a plain string, or null if no usable transcript is found.
 * Minimum usable length: 40 characters.
 */

import { getSegments } from "@/lib/localSegmentStore";
import { parseTranscript } from "@/services/youtubeTranscript";

const MIN_CHARS = 40;

function resolveYouTubeSegmentKey(video) {
  const explicit = video?.videoId || video?.youtubeId;
  if (explicit) return explicit;
  const url = String(video?.url || video?.videoUrl || video?.youtubeUrl || '');
  return url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([A-Za-z0-9_-]{11})/)?.[1] || video?.id || null;
}

function joinSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const text = segments
    .map((s) =>
      typeof s === "string" ? s : (s?.text || s?.content || "")
    )
    .map((t) => String(t).trim())
    .filter(Boolean)
    .join(" ");
  return text.length >= MIN_CHARS ? text : null;
}

export function getVideoTranscriptText(video) {
  if (!video) return null;

  // 1–5: Direct string fields in priority order
  const directFields = [
    "transcriptText",
    "transcript",
    "fullTranscript",
    "fullTranscriptText",
    "manualTranscript",
    "whisperTranscript",
  ];
  for (const field of directFields) {
    const val = video[field];
    if (typeof val === "string" && val.trim().length >= MIN_CHARS) {
      return val.trim();
    }
  }

  // 6: Segment arrays on the video object
  const segArrayCandidates = [
    video.transcriptSegments,
    video.segments,
    video.storedTranscriptSegments,
    Array.isArray(video.transcript_segments) ? video.transcript_segments : null,
  ];
  for (const segs of segArrayCandidates) {
    const joined = joinSegments(segs);
    if (joined) return joined;
  }

  // 7: localStorage segment store (fetched transcript stored by youtubeTranscript.js)
  const videoId = resolveYouTubeSegmentKey(video);
  if (videoId) {
    const storedSegs = getSegments(videoId);
    const joined = joinSegments(storedSegs);
    if (joined) return joined;
  }

  return null;
}

function normalizeSegmentList(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return [];
  return segments
    .map((s) => {
      if (typeof s === "string") return null;
      const text = String(s?.text || s?.content || "").trim();
      if (!text) return null;
      const startSeconds = Number(s?.startSeconds ?? s?.start);
      if (!Number.isFinite(startSeconds) || startSeconds < 0) return null;
      const duration = Number(s?.durationSeconds ?? s?.duration ?? s?.dur);
      return {
        text,
        startSeconds,
        start: startSeconds,
        durationSeconds: Number.isFinite(duration) && duration >= 0 ? duration : 0,
      };
    })
    .filter(Boolean);
}

function segmentsToLines(segments) {
  return normalizeSegmentList(segments).map((s) => ({
    text: s.text,
    start: s.startSeconds,
    startSeconds: s.startSeconds,
  }));
}

/** Split plain transcript text into timed pseudo-lines for chapter generation. */
function parseStringTranscript(raw) {
  const text = String(raw || "").trim();
  if (!text) return { lines: [], source: null };

  const parsed = parseTranscript(text);
  if (parsed?.lines?.length >= 10) {
    return {
      lines: parsed.lines.map((line) => ({
        text: line.text,
        start: line.start ?? line.startSeconds ?? 0,
        startSeconds: line.startSeconds ?? line.start ?? 0,
      })),
      source: "parsed_transcript",
    };
  }

  return { lines: [], source: null };
}

/**
 * Resolve transcript lines + segments from all known sources for chapter generation.
 * @returns {{ segments: object[], lines: { text: string, start: number }[], source: string|null, hasUsableText: boolean }}
 */
export function resolveTranscriptForChapters(video, savedAnalysis = null, durationSeconds = null) {
  const empty = { segments: [], lines: [], source: null, hasUsableText: false };
  if (!video && !savedAnalysis) return empty;

  const sources = [];

  const pushSegments = (segments, source) => {
    const normalized = normalizeSegmentList(segments);
    if (normalized.length > 0) sources.push({ segments: normalized, source });
  };

  const pushString = (raw, source) => {
    const parsed = parseStringTranscript(raw);
    if (parsed.lines.length > 0) {
      sources.push({
        segments: parsed.lines.map((line) => ({
          text: line.text,
          startSeconds: line.start,
          start: line.start,
        })),
        lines: parsed.lines,
        source: `${source}:${parsed.source}`,
      });
    }
  };

  const videoId = resolveYouTubeSegmentKey(video);

  pushSegments(video?.transcriptSegments, "video.transcriptSegments");
  pushSegments(video?.storedTranscriptSegments, "video.storedTranscriptSegments");
  pushSegments(video?.segments, "video.segments");
  if (Array.isArray(video?.transcript_segments)) {
    pushSegments(video.transcript_segments, "video.transcript_segments");
  }

  for (const field of [
    "transcriptText",
    "transcript",
    "fullTranscript",
    "fullTranscriptText",
    "manualTranscript",
    "whisperTranscript",
  ]) {
    if (typeof video?.[field] === "string" && video[field].trim().length >= MIN_CHARS) {
      pushString(video[field], `video.${field}`);
    }
  }

  if (savedAnalysis) {
    pushSegments(savedAnalysis.transcriptSegments, "savedAnalysis.transcriptSegments");
    if (typeof savedAnalysis.transcript === "string" && savedAnalysis.transcript.trim().length >= MIN_CHARS) {
      pushString(savedAnalysis.transcript, "savedAnalysis.transcript");
    }
    if (typeof savedAnalysis.manualTranscript === "string" && savedAnalysis.manualTranscript.trim().length >= MIN_CHARS) {
      pushString(savedAnalysis.manualTranscript, "savedAnalysis.manualTranscript");
    }
  }

  if (videoId) {
    pushSegments(getSegments(videoId), "localSegmentStore");
  }

  if (sources.length === 0) return empty;

  const best = sources.reduce((winner, candidate) => {
    const winnerChars = winner.segments.map((s) => s.text).join(" ").length;
    const candidateChars = candidate.segments.map((s) => s.text).join(" ").length;
    return candidateChars > winnerChars ? candidate : winner;
  });

  const lines =
    best.lines ||
    segmentsToLines(best.segments);

  const textLen = lines.map((l) => l.text).join(" ").length;
  return {
    segments: best.segments,
    lines,
    source: best.source,
    hasUsableText: textLen >= MIN_CHARS,
  };
}
