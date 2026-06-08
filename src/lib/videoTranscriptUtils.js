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

const MIN_CHARS = 40;

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
