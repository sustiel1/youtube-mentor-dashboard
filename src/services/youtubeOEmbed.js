// Fetches public video metadata via YouTube's oEmbed endpoint.
// No API key required. Returns title, channelTitle, thumbnail.
//
// oEmbed spec: https://oembed.com / YouTube implementation:
//   https://www.youtube.com/oembed?url=<watchUrl>&format=json

import { buildYouTubeUrl } from '@/lib/youtubeUrlParser';
import { fetchVideoMetadata } from '@/services/youtubeApi';
import { resolveChannelToMentor } from '@/lib/channelMentorResolver';

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
  let publishedAt = null;
  let duration = null;
  let viewCount = null;

  console.log('[buildExternalVideo] start — videoId:', videoId);

  try {
    const meta = await fetchYouTubeMeta(videoId);
    title = meta.title;
    channelTitle = meta.channelTitle;
    console.log('[buildExternalVideo] oEmbed — title:', title || '(none)', '| channelTitle:', channelTitle || '(none)');
  } catch {
    // oEmbed unavailable — title stays empty, thumbnail still works via direct URL
  }

  try {
    const metadata = await fetchVideoMetadata(videoId);
    console.log('[buildExternalVideo] metadata result:', {
      channelId: metadata?.channelId || '(none)',
      channelTitle: metadata?.channelTitle || '(none)',
      viewCount: metadata?.viewCount ?? '(none)',
      duration: metadata?.duration || '(none)',
      publishedAt: metadata?.publishedAt || '(none)',
    });
    if (metadata?.channelTitle) channelTitle = metadata.channelTitle;
    if (metadata?.channelId) channelId = String(metadata.channelId).trim();
    if (metadata?.channelUrl) channelUrl = String(metadata.channelUrl).trim();
    if (metadata?.channelThumbnail) channelThumbnail = String(metadata.channelThumbnail).trim();
    if (metadata?.publishedAt) publishedAt = String(metadata.publishedAt);
    if (metadata?.duration) duration = String(metadata.duration);
    if (metadata?.viewCount != null) viewCount = Number(metadata.viewCount);
  } catch {
    // keep external add lightweight even if extended metadata fails
  }

  // Auto-match channel → existing mentor (channelId > channelUrl > name)
  // Only runs when user did not explicitly pick a mentor in the add dialog.
  let resolvedMentorId = mentorId;
  let resolvedTopicIds = Array.isArray(topicIds) ? [...topicIds] : [];
  let resolvedCategory = null;

  if (!resolvedMentorId) {
    const partial = { channelId: channelId || null, channelUrl: channelUrl || null, channelTitle };
    const match = resolveChannelToMentor(partial);
    console.log('[buildExternalVideo] mentor match:', match ? `"${match.mentor.name}" via ${match.matchType}` : 'none');
    if (match) {
      resolvedMentorId = match.mentor.id;
      resolvedCategory = match.categoryCode || null;
      // Inherit mentor's topics only when user didn't pick any topic explicitly
      if (resolvedTopicIds.length === 0 && Array.isArray(match.topicIds) && match.topicIds.length > 0) {
        resolvedTopicIds = [...match.topicIds];
        console.log('[buildExternalVideo] inherited topicIds from mentor:', resolvedTopicIds);
      }
    }
  }

  const overrideTitle =
    typeof titleOverride === 'string' && titleOverride.trim() ? titleOverride.trim() : '';

  const now = new Date().toISOString();
  const safeTopicIds = resolvedTopicIds.map((id) => String(id).trim()).filter(Boolean);

  const videoObj = {
    id: `ext_${videoId}`,
    videoId,
    youtubeId: videoId,
    url: buildYouTubeUrl(videoId),
    title: overrideTitle || title || 'סרטון YouTube',
    thumbnail: getMaxResThumbnailUrl(videoId),
    channelTitle,
    channelId: channelId || null,
    channelUrl: channelUrl || (channelId ? `https://www.youtube.com/channel/${channelId}` : null),
    channelThumbnail: channelThumbnail || null,
    mentorId: resolvedMentorId && String(resolvedMentorId).trim() ? resolvedMentorId : null,
    ...(resolvedCategory ? { category: resolvedCategory } : {}),
    source,
    publishedAt: publishedAt || now,
    fetchedAt: now,
    addedManually: true,
    addedAt: now,
    status: 'new',
    analysisStatus: 'not_analyzed',
    learningStatus: 'not_started',
    isSaved: false,
    topicIds: safeTopicIds,
    ...(duration ? { duration } : {}),
    ...(viewCount != null ? { viewCount } : {}),
    tags: [],
    aiChapters: [],
    chapters: [],
    keyPoints: [],
  };

  console.log('[buildExternalVideo] final:', {
    videoId: videoObj.videoId,
    title: videoObj.title,
    channelTitle: videoObj.channelTitle || '(none)',
    channelId: videoObj.channelId || '(none)',
    mentorId: videoObj.mentorId || '(none)',
    category: videoObj.category || '(none)',
    topicIds: videoObj.topicIds,
    publishedAt: videoObj.publishedAt,
    duration: videoObj.duration || '(none)',
    viewCount: videoObj.viewCount ?? '(none)',
  });

  return videoObj;
}
