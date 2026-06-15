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
const MIN_CHAPTER_CHARS = 400;

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
  const videoId = video.videoId || video.id;
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
    .map((s, index) => {
      if (typeof s === "string") {
        const text = s.trim();
        return text ? { text, startSeconds: index * 5, start: index * 5 } : null;
      }
      const text = String(s?.text || s?.content || "").trim();
      if (!text) return null;
      const startSeconds = Number(s?.startSeconds ?? s?.start ?? index * 5);
      const start = Number.isFinite(startSeconds) ? startSeconds : index * 5;
      return { text, startSeconds: start, start };
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
function plainTextToEstimatedLines(text, durationSeconds) {
  const raw = String(text || "").trim();
  if (raw.length < MIN_CHAPTER_CHARS) return [];

  const paragraphs = raw
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
  const blocks =
    paragraphs.length > 0
      ? paragraphs
      : raw.split(/\n+/g).map((p) => p.trim()).filter(Boolean);

  const joined = blocks.join("\n\n");
  const totalChars = joined.length || 1;
  const desired =
    totalChars < 1200 ? 3 :
    totalChars < 2600 ? 4 :
    totalChars < 5200 ? 5 :
    totalChars < 9000 ? 6 : 7;
  const targetChars = Math.max(400, Math.floor(totalChars / desired));

  const chunks = [];
  let acc = "";
  for (const block of blocks) {
    if (!acc) acc = block;
    else if (acc.length + block.length < targetChars) acc = `${acc}\n\n${block}`;
    else {
      chunks.push(acc);
      acc = block;
    }
  }
  if (acc) chunks.push(acc);

  const dur =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : Math.max(chunks.length * 60, 600);

  return chunks.map((chunk, index) => {
    const start = Math.floor((index / chunks.length) * dur);
    return { text: chunk, start, startSeconds: start };
  });
}

function parseStringTranscript(raw, durationSeconds) {
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

  const estimated = plainTextToEstimatedLines(text, durationSeconds);
  if (estimated.length >= 2) {
    return { lines: estimated, source: "plain_text_estimated" };
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
    const parsed = parseStringTranscript(raw, durationSeconds);
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

  const videoId = video?.videoId || video?.id;

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
