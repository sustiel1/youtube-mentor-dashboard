// Fetches public video metadata via YouTube's oEmbed endpoint.
// No API key required. Returns title, channelTitle, thumbnail.
//
// oEmbed spec: https://oembed.com / YouTube implementation:
//   https://www.youtube.com/oembed?url=<watchUrl>&format=json

import { buildYouTubeUrl } from '@/lib/youtubeUrlParser';
import { fetchVideoMetadata } from '@/services/youtubeApi';

// Thumbnail quality ladder — maxresdefault (1280px) first, hqdefault (480px) as fallback.
// VideoCard/VideoDetailPanel handle the onError chain down to hqdefault via the img element.
export function getMaxResThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

export function getHqThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Fetch title + channel name for a YouTube video ID via oEmbed.
 * Throws on network error or non-2xx response.
 * Note: oEmbed thumbnail_url is only hqdefault — we prefer maxresdefault instead.
 */
export async function fetchYouTubeMeta(videoId) {
  const watchUrl = buildYouTubeUrl(videoId);
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`oEmbed request failed (${res.status})`);

  const data = await res.json();
  return {
    title: data.title || '',
    channelTitle: data.author_name || '',
  };
}

/**
 * Build a ready-to-store manual / pasted-URL video object (dashboard “add by link”).
 * Uses `thumbnail` (not `thumbnailUrl`) to match the existing Video entity schema
 * read by VideoCard and VideoDetailPanel.
 *
 * @param {string} videoId — 11-char YouTube id
 * @param {{ titleOverride?: string, mentorId?: string | null, topicIds?: string[], source?: string }} [options]
 */
export async function buildExternalVideoObject(videoId, options = {}) {
  const {
    titleOverride,
    mentorId = null,
    topicIds = [],
    source = 'manual',
  } = options;

  let title = '';
  let channelTitle = '';
  let channelId = '';
  let channelUrl = '';
  let channelThumbnail = '';

  try {
    const meta = await fetchYouTubeMeta(videoId);
    title = meta.title;
    channelTitle = meta.channelTitle;
  } catch {
    // oEmbed unavailable — title stays empty, thumbnail still works via direct URL
  }

  try {
    const metadata = await fetchVideoMetadata(videoId);
    if (metadata?.channelTitle) channelTitle = metadata.channelTitle;
    if (metadata?.channelId) channelId = String(metadata.channelId).trim();
    if (metadata?.channelUrl) channelUrl = String(metadata.channelUrl).trim();
    if (metadata?.channelThumbnail) channelThumbnail = String(metadata.channelThumbnail).trim();
  } catch {
    // keep external add lightweight even if extended metadata fails
  }

  const overrideTitle =
    typeof titleOverride === 'string' && titleOverride.trim() ? titleOverride.trim() : '';

  const now = new Date().toISOString();
  const safeTopicIds = Array.isArray(topicIds)
    ? topicIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  return {
    id: `ext_${videoId}`,
    videoId,
    youtubeId: videoId,
    url: buildYouTubeUrl(videoId),
    title: overrideTitle || title || 'סרטון YouTube',
    thumbnail: getMaxResThumbnailUrl(videoId),   // matches video.thumbnail used by VideoCard + VideoDetailPanel
    channelTitle,
    channelId: channelId || null,
    channelUrl: channelUrl || (channelId ? `https://www.youtube.com/channel/${channelId}` : null),
    channelThumbnail: channelThumbnail || null,
    mentorId: mentorId && String(mentorId).trim() ? mentorId : null,
    source,
    publishedAt: now,
    fetchedAt: now,
    addedManually: true,
    addedAt: now,
    status: 'new',
    analysisStatus: 'not_analyzed',
    learningStatus: 'not_started',
    isSaved: false,
    topicIds: safeTopicIds,
    tags: [],
    aiChapters: [],
    chapters: [],
    keyPoints: [],
  };
}
