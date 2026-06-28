// ─── YouTube Metadata Service ─────────────────────────────────────────────────
// Utilities for extracting and building YouTube metadata.
// Works from RSS / stored description text. Full descriptions may be merged via
// manual YouTube Data API fetch in the UI (see youtubeApi + youtubeChapterCache).
//
// API:
//   extractTimestampsFromDescription(description, options?) → Chapter[] | []
//   getVideoIdFromUrl(url)                                  → string | null
//   buildTimestampUrl(videoUrl, seconds)                    → string
//
// extractTimestampsFromDescription options:
//   sourceField?: 'youtube_description' | 'full_text' (default: 'youtube_description')
//
// The returned array carries a non-enumerable `_parseDebug` property with stats.

// ─── Disclaimer / non-chapter line filter ─────────────────────────────────────
// Conservative — only rejects lines that are obviously not YouTube chapters.
// Does NOT reject Hebrew chapter titles that happen to contain common words.
const NON_CHAPTER_LINE_PATTERNS = [
  /^https?:\/\//i,                                          // bare URL
  /^www\.\w+/i,                                             // bare domain
  /t\.me\//,                                                // Telegram link
  /wa\.me\//,                                               // WhatsApp link
  /bit\.ly\//i,                                             // shortlink
  /linktr\.ee\//i,                                          // linktree
  /אין\s+(?:לראות\s+באמור|זו\s+המלצה|ייעוץ\s+פיננסי)/,   // Hebrew legal disclaimer
  /לא\s+(?:ייעוץ|המלצה)\s+פיננסי/,                        // Hebrew legal disclaimer
  /not\s+financial\s+advice/i,                              // English disclaimer
  /\bdisclaimer\b/i,                                        // English disclaimer
];

function isNonChapterLine(line) {
  if (!line || line.length < 2) return true;
  return NON_CHAPTER_LINE_PATTERNS.some((re) => re.test(line));
}

// ─── Timestamp parser helpers ──────────────────────────────────────────────────

function parseTimestampToSeconds(tsStr) {
  const parts = tsStr.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m > 59 || s > 59) return null;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [mm, ss] = parts;
    if (ss > 59) return null;
    return mm * 60 + ss;
  }
  return null;
}

// Primary format: <optional prefix> <timestamp> <separator?> <title>
// Handles: "0:00 Title", "- 0:00 Title", "• 0:00 Title", "0:00 - Title", "1:23:45 Title"
function parsePrimaryFormat(text, debug) {
  const linePrefix = /^[\s﻿‎‏]*(?:[*•\-–]\s*|\d{1,2}\.\s*)?/;
  const timeRe = String.raw`(\d{1,2}:\d{2}(?::\d{2})?)`;
  const pattern = new RegExp(
    `${linePrefix.source}${timeRe}(?:\\s*[-–—]\\s*|\\s+)\\s*(.+)`,
    'gm',
  );

  const chapters = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    debug.candidates++;
    const tsStr = match[1].trim();
    // Strip any trailing URL that the (.+) might swallow
    const rawTitle = (match[2] || '').trim().replace(/\s+https?:\/\/\S+$/, '').trim();
    if (!rawTitle) {
      debug.rejected++;
      debug.rejectionReasons.emptyTitle = (debug.rejectionReasons.emptyTitle ?? 0) + 1;
      continue;
    }
    const startSeconds = parseTimestampToSeconds(tsStr);
    if (startSeconds === null) {
      debug.rejected++;
      debug.rejectionReasons.invalidTimestamp = (debug.rejectionReasons.invalidTimestamp ?? 0) + 1;
      continue;
    }
    chapters.push({ timestamp: tsStr, startSeconds, title: rawTitle });
  }
  return chapters;
}

// Secondary format: <title> <separator> <timestamp> at end of line
// Handles: "Title - 0:00", "Title 0:00", "Title — 0:22"
// Only tried when the primary format yields < 2 results.
function parseSecondaryFormat(lines, debug) {
  const trailingTs = /(\d{1,2}:\d{2}(?::\d{2})?)\s*$/;
  const chapters = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const tsMatch = trimmed.match(trailingTs);
    if (!tsMatch) continue;

    const tsStr = tsMatch[1];
    // Everything before the timestamp, stripping trailing separator chars
    let rawTitle = trimmed.slice(0, tsMatch.index).replace(/[\s\-–—]+$/, '').trim();
    if (!rawTitle) continue;

    debug.candidates++;
    const startSeconds = parseTimestampToSeconds(tsStr);
    if (startSeconds === null) {
      debug.rejected++;
      continue;
    }
    chapters.push({ timestamp: tsStr, startSeconds, title: rawTitle });
  }
  return chapters;
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse real timestamps from a YouTube video description.
 *
 * Supported formats (timestamp-first):
 *   0:00 Title  |  00:00 Title  |  1:23:45 Title
 *   - 0:00 Title  |  • 0:00 Title  |  0:00 - Title
 *
 * Supported formats (title-first, secondary pass only):
 *   Title - 0:00  |  Title — 0:00  |  Title 0:00
 *
 * Returns [] when fewer than 2 valid chapters found.
 * The returned array carries a non-enumerable `_parseDebug` property.
 *
 * @param {string|null} description
 * @param {{ sourceField?: string }} [options]
 * @returns {{ timestamp: string, startSeconds: number, title: string, chapterSource: string, timestampSource: string, titleSource: string, isEstimated: boolean, timeSource: "real" }[]}
 */
export function extractTimestampsFromDescription(description, options = {}) {
  if (!description || typeof description !== 'string') return [];

  const isFullText = options.sourceField === 'full_text';
  const chapterSource    = isFullText ? 'description_block'            : 'youtube_description';
  const timestampSource  = isFullText ? 'full_text_description_block'  : 'youtube_description';

  const debug = {
    descriptionLength: description.length,
    // shortDescription from YouTube HTML may be truncated around 4800-5000 chars
    maybeTruncated: description.length >= 4800,
    sourceField: options.sourceField ?? 'youtube_description',
    candidates: 0,
    valid: 0,
    rejected: 0,
    rejectionReasons: {},
  };

  // Pre-filter: remove obvious non-chapter lines
  const allLines = description.split('\n');
  const chapterLines = allLines.filter((l) => !isNonChapterLine(l.trim()));
  const filteredText = chapterLines.join('\n');

  // Primary pass: timestamp-first (most common YouTube format)
  let chapters = parsePrimaryFormat(filteredText, debug);

  // Secondary pass: title-first (fallback only)
  if (chapters.length < 2) {
    chapters = parseSecondaryFormat(chapterLines, debug);
  }

  if (chapters.length < 2) {
    debug.rejectionReasons.tooFewChapters = `found ${chapters.length}, need ≥2`;
    const empty = [];
    empty._parseDebug = debug;
    return empty;
  }

  // Deduplicate by startSeconds (keep first occurrence)
  const seen = new Set();
  chapters = chapters.filter((c) => {
    if (seen.has(c.startSeconds)) return false;
    seen.add(c.startSeconds);
    return true;
  });

  if (chapters.length < 2) {
    debug.rejectionReasons.tooFewChapters = 'after dedup: < 2';
    const empty = [];
    empty._parseDebug = debug;
    return empty;
  }

  // Sort ascending
  chapters.sort((a, b) => a.startSeconds - b.startSeconds);
  debug.valid = chapters.length;

  const result = chapters.map((chapter, index, arr) => {
    const next = arr[index + 1];
    return {
      timestamp:      chapter.timestamp,
      startSeconds:   chapter.startSeconds,
      title:          chapter.title,
      timeSource:     'real',
      summary:        '',
      description:    '',
      source:         'description_timestamp',   // kept for badge-resolver backward compat
      chapterSource,
      timestampSource,
      titleSource:    'creator_description',
      isEstimated:    false,
      endSeconds:     next ? next.startSeconds : null,
    };
  });

  // Attach debug as non-enumerable so spread/iteration is unaffected
  Object.defineProperty(result, '_parseDebug', { value: debug, enumerable: false, writable: true });
  return result;
}

export const extractChaptersFromDescription = extractTimestampsFromDescription;

/**
 * Extract a YouTube video ID from various URL formats.
 * Handles: watch?v=  youtu.be/  /embed/  /shorts/
 *
 * @param {string|null} url
 * @returns {string|null}
 */
export function getVideoIdFromUrl(url) {
  if (!url) return null;

  const patterns = [
    /[?&]v=([^&#]+)/,        // https://www.youtube.com/watch?v=ID
    /youtu\.be\/([^?&#]+)/,  // https://youtu.be/ID
    /\/embed\/([^?&#]+)/,    // https://www.youtube.com/embed/ID
    /\/shorts\/([^?&#]+)/,   // https://www.youtube.com/shorts/ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

/**
 * Append a timestamp parameter to a YouTube video URL.
 * Produces ?t=Xs when the URL has no query string, &t=Xs otherwise.
 *
 * @param {string|null} videoUrl
 * @param {number|null} seconds
 * @returns {string|null}
 */
export function buildTimestampUrl(videoUrl, seconds) {
  if (!videoUrl || seconds == null) return videoUrl ?? null;
  const sep = videoUrl.includes('?') ? '&' : '?';
  return `${videoUrl}${sep}t=${Math.max(0, Math.floor(Number(seconds) || 0))}`;
}
