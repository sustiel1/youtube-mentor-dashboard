// ─── YouTube Metadata Service ─────────────────────────────────────────────────
// Utilities for extracting and building YouTube metadata.
// Currently works from RSS description text only — no YouTube Data API calls.
//
// Future: connect to YouTube Data API v3 to fetch full video descriptions
// (RSS often returns truncated descriptions that may be missing timestamps).
//
// API:
//   extractTimestampsFromDescription(description) → Chapter[] | []
//   getVideoIdFromUrl(url)                        → string | null
//   buildTimestampUrl(videoUrl, seconds)          → string

/**
 * Parse real timestamps from a YouTube video description.
 *
 * Recognizes formats: 0:00  00:00  10:25  1:02:33
 * Lines must start with a timestamp (optional dash/dash separator after).
 *
 * Returns [] when fewer than 2 chapters found — single entries are usually
 * not meaningful chapter lists.
 *
 * @param {string|null} description
 * @returns {{ timestamp: string, startSeconds: number, title: string, timeSource: "real" }[]}
 */
export function extractTimestampsFromDescription(description) {
  if (!description) return [];

  const pattern = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+)/gm;
  const chapters = [];
  let match;

  while ((match = pattern.exec(description)) !== null) {
    const tsStr = match[1].trim();
    const title = match[2].trim();
    if (!title) continue;

    const parts = tsStr.split(':').map(Number);
    const startSeconds = parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];

    chapters.push({
      timestamp:    tsStr,
      startSeconds,
      title,
      timeSource:   'real',
    });
  }

  return chapters.length >= 2 ? chapters : [];
}

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
  return `${videoUrl}${sep}t=${seconds}s`;
}
