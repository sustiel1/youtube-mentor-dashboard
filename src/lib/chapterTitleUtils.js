/**
 * Phase-1 chapter title helpers — transcript noise / fragment detection.
 * Used by local transcript-chunk generation and display sanitization only.
 */

const NOISE_MARKER_RE = /\[(music|applause|laughter|silence)\]/gi;
const LEADING_FILLER_RE = /^(and|we|so)\b/i;

/** Legacy + current sources for local transcript-chunk chapters (not Claude/Gemini AI). */
export const TRANSCRIPT_CHUNK_CHAPTER_SOURCES = new Set([
  'ai_transcript',               // legacy label — kept for backward compatibility
  'transcript_heuristic',        // equal-chunk fallback — low quality
  'transcript_topic_heuristic',  // topic-boundary heuristic — medium quality
]);

/** Saved analysis chapters from Claude / Gemini / manual AI (preferred over local heuristic). */
export const AI_ANALYSIS_CHAPTER_SOURCES = new Set([
  'transcript',
  'gemini',
  'gemini_url',
  'gem',
  'ai_generated',
  'manual_transcript',
  'saved',
  'gems_analysis',
]);

export function isTranscriptChunkChapterSource(source) {
  return TRANSCRIPT_CHUNK_CHAPTER_SOURCES.has(source);
}

export function isAiAnalysisChapterSource(source) {
  return AI_ANALYSIS_CHAPTER_SOURCES.has(source);
}

export function isHeuristicChapterSource(source) {
  return isTranscriptChunkChapterSource(source);
}

export function stripTranscriptNoiseMarkers(text) {
  return String(text || '')
    .replace(NOISE_MARKER_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isObviousTranscriptFragmentTitle(title) {
  const t = String(title || '').trim();
  if (!t) return true;

  if (/^\[(music|applause|laughter|silence)\]/i.test(t)) return true;

  const bracketless = t.replace(/^\[+|\]+$/g, '').trim();
  if (/^(music|applause|laughter|silence)$/i.test(bracketless)) return true;

  const firstWord = (t.match(/^[^a-zA-Z]*([a-zA-Z]+)/)?.[1] || '').toLowerCase();
  if (['and', 'we', 'so'].includes(firstWord)) return true;

  return false;
}

/**
 * Build a display-safe title from a transcript text chunk (local heuristic only).
 */
export function buildTranscriptChunkTitle(blob, idx, videoTitle) {
  const cleaned = stripTranscriptNoiseMarkers(blob);
  const words = cleaned.split(/\s+/).filter(Boolean);

  let startIdx = 0;
  while (startIdx < words.length && LEADING_FILLER_RE.test(words[startIdx])) {
    startIdx += 1;
  }

  let title = words.slice(startIdx, startIdx + 8).join(' ');

  if (isObviousTranscriptFragmentTitle(title) || title.length < 4) {
    title = videoTitle
      ? `חלק ${idx + 1} — ${String(videoTitle).slice(0, 40)}`
      : `חלק ${idx + 1}`;
  }

  if (title.length > 56) title = `${title.slice(0, 53)}…`;
  return title;
}

/** Last-resort display cleanup — never promote fragments to the UI. */
export function sanitizeChaptersForDisplay(chapters) {
  return (Array.isArray(chapters) ? chapters : []).map((chapter, index) => {
    const title = String(chapter?.title || '').trim();
    if (!isObviousTranscriptFragmentTitle(title)) return chapter;
    return { ...chapter, title: `חלק ${index + 1}` };
  });
}
