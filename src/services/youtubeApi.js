// ─── YouTube Data API v3 (client, on-demand only) ─────────────────────────────
// Called manually from the UI. Restrict the key in Google Cloud (HTTP referrers).

async function fetchViaDevProxy(videoId) {
  const res = await fetch(`/api/youtube-video-metadata?v=${encodeURIComponent(videoId)}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data && typeof data === "object" ? data : null;
}

async function fetchViaYouTubeDataApi(videoId) {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const item = data?.items?.[0];
  if (!item) return null;

  return {
    ...(item.snippet?.description ? { description: item.snippet.description } : {}),
    ...(item.contentDetails?.duration ? { duration: item.contentDetails.duration } : {}),
    ...(item.statistics?.viewCount ? { viewCount: Number(item.statistics.viewCount) } : {}),
    ...(item.snippet?.channelId ? { channelId: item.snippet.channelId } : {}),
    ...(item.snippet?.channelTitle ? { channelTitle: item.snippet.channelTitle } : {}),
    ...(item.snippet?.channelId ? { channelUrl: `https://www.youtube.com/channel/${item.snippet.channelId}` } : {}),
  };
}

export async function fetchVideoMetadata(videoId) {
  if (!videoId) return null;

  try {
    const proxyData = await fetchViaDevProxy(videoId);
    if (proxyData) return proxyData;
  } catch {
    // fall through to optional client API key path
  }

  try {
    return await fetchViaYouTubeDataApi(videoId);
  } catch {
    return null;
  }
}

/**
 * @param {string} videoId
 * @returns {Promise<string | null>} full snippet description, or null if unavailable
 */
export async function fetchVideoDescription(videoId) {
  const metadata = await fetchVideoMetadata(videoId);
  return metadata?.description || null;
}
