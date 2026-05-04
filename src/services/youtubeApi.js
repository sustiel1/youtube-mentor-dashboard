// ─── YouTube Data API v3 (client, on-demand only) ─────────────────────────────
// Called manually from the UI. Restrict the key in Google Cloud (HTTP referrers).

/**
 * @param {string} videoId
 * @returns {Promise<string | null>} full snippet description, or null if unavailable
 */
export async function fetchVideoDescription(videoId) {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;

  if (!apiKey) return null;

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`,
  );

  if (!res.ok) return null;

  const data = await res.json();
  const item = data.items?.[0];

  return item?.snippet?.description || null;
}
