// ─── YouTube Metadata Service ─────────────────────────────────────────────────
// Utilities for extracting and building YouTube metadata.
// Works from RSS / stored description text. Full descriptions may be merged via
// manual YouTube Data API fetch in the UI (see youtubeApi + youtubeChapterCache).
//
// API:
//   extractTimestampsFromDescription(description) → Chapter[] | []
//   getVideoIdFromUrl(url)                        → string | null
//   buildTimestampUrl(videoUrl, seconds)          → string

/**
 * Parse real timestamps from a YouTube video description (same conventions as YouTube chapters).
 *
 * Recognizes lines that begin (after optional indent / bullets) with:
 *   0:00 פתיחה   00:00 פתיחה   10:25 ניתוח   01:02:33 פרק
 * Optional separator between time and title: space, tab, or ASCII/en-dash.
 *
 * Returns [] when fewer than 2 matches — a lone timestamp is usually noise.
 *
 * @param {string|null} description
 * @returns {{ timestamp: string, startSeconds: number, title: string, timeSource: "real" }[]}
 */
export function extractTimestampsFromDescription(description) {
  if (!description || typeof description !== 'string') return [];

  // Line start: optional BOM/RTL marks, spaces, then optional list marker (* • -) or "1."
  const linePrefix = /^[\s\uFEFF\u200E\u200F]*(?:[*•\-]\s*|\d{1,2}\.\s*)?/;

  const timeRe = String.raw`(\d{1,2}:\d{2}(?::\d{2})?)`;
  // Time then at least one whitespace (or dash surrounded by spaces) before title — avoids matching durations inside prose
  const pattern = new RegExp(
    `${linePrefix.source}${timeRe}(?:\\s*[-–—]\\s*|\\s+)\\s*(.+)`,
    'gm',
  );

  const chapters = [];
  let match;

  while ((match = pattern.exec(description)) !== null) {
    const tsStr = match[1].trim();
    const title = (match[2] || '').trim();
    if (!title) continue;

    const parts = tsStr.split(':').map(Number);
    if (parts.some((n) => Number.isNaN(n))) continue;

    let startSeconds;
    if (parts.length === 3) {
      const [h, m, s] = parts;
      if (m > 59 || s > 59) continue;
      startSeconds = h * 3600 + m * 60 + s;
    } else {
      const [mm, ss] = parts;
      if (ss > 59) continue;
      startSeconds = mm * 60 + ss;
    }

    chapters.push({
      timestamp:    tsStr,
      startSeconds,
      title,
      timeSource:   'real',
    });
  }

  if (chapters.length < 2) return [];

  return chapters
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .map((chapter, index, arr) => {
      const next = arr[index + 1];
      return {
        ...chapter,
        summary: '',
        description: '',
        source: 'description_timestamp',
        chapterSource: 'description_timestamp',
        endSeconds: next ? next.startSeconds : null,
      };
    });
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
