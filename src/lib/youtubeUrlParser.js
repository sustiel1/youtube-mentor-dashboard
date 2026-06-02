// Parses any common YouTube URL format and returns the 11-char video ID.
// Returns null if the input is not a recognizable YouTube URL or bare ID.
//
// Supported formats:
//   https://www.youtube.com/watch?v=VIDEO_ID
//   https://youtu.be/VIDEO_ID
//   https://www.youtube.com/shorts/VIDEO_ID
//   https://www.youtube.com/embed/VIDEO_ID
//   VIDEO_ID  (bare 11-char alphanumeric)
export function parseYouTubeVideoId(input) {
  const str = String(input || '').trim();
  let videoId = null;

  try {
    const url = new URL(str);
    if (url.hostname.includes('youtu.be')) {
      videoId = url.pathname.slice(1).split('/')[0];
    } else if (url.hostname.includes('youtube.com')) {
      videoId =
        url.searchParams.get('v') ||
        url.pathname.match(/\/(shorts|embed|v)\/([A-Za-z0-9_-]{11})/)?.[2] ||
        null;
    }
  } catch {
    // Not a URL — try as a bare video ID
    if (/^[A-Za-z0-9_-]{11}$/.test(str)) videoId = str;
  }

  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return videoId;
}

// Returns true if the input resolves to a valid YouTube video ID.
export function isValidYouTubeUrl(input) {
  return parseYouTubeVideoId(input) !== null;
}

// Builds a canonical watch URL from a video ID.
export function buildYouTubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
