// Resolves a video's channel to a known mentor and their saved category.
// Priority: channelId → channelUrl → normalized name → null (AI fallback).

import { MENTORS } from '@/data/mockData';
import { getLocalCustomMentors } from '@/lib/localCustomMentorsStore';

const CATEGORY_CODE_TO_LABEL = {
  Markets: 'שוק ההון',
  AI: 'בינה מלאכותית ואוטומציה',
  Dev: 'פיתוח תוכנה',
};

function normalizeChannelId(v) {
  const id = String(v || '').trim();
  return id.startsWith('UC') && id.length === 24 ? id : '';
}

function normalizeUrl(v) {
  return String(v || '').trim().replace(/\/$/, '').toLowerCase();
}

function normalizeName(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Matches video channel fields against all known mentors (mock + custom).
 * Returns { mentor, matchType, categoryCode, categoryLabel, topicIds } or null.
 */
export function resolveChannelToMentor(video) {
  if (!video) return null;

  const allMentors = [...MENTORS, ...getLocalCustomMentors()];
  const videoChannelId  = normalizeChannelId(video.channelId);
  const videoChannelUrl = normalizeUrl(video.channelUrl || '');
  const videoChannelName = normalizeName(
    video.channelTitle || video.channelName || video.channel || ''
  );

  console.log('[ChannelResolver] checking video channel:', {
    channelId:   videoChannelId  || '(none)',
    channelUrl:  videoChannelUrl || '(none)',
    channelName: videoChannelName || '(none)',
    totalMentors: allMentors.length,
  });

  let matched = null;
  let matchType = null;

  // 1. Exact YouTube channel ID (UC... 24 chars)
  if (videoChannelId) {
    matched = allMentors.find(
      m => normalizeChannelId(m.youtubeChannelId || m.channelId) === videoChannelId
    );
    if (matched) matchType = 'channelId';
  }

  // 2. Exact channel URL
  if (!matched && videoChannelUrl) {
    matched = allMentors.find(m => {
      const url = normalizeUrl(m.youtubePageUrl || m.channelUrl || m.youtubeUrl || '');
      return url && url === videoChannelUrl;
    });
    if (matched) matchType = 'channelUrl';
  }

  // 3. Normalized display name
  if (!matched && videoChannelName) {
    matched = allMentors.find(m => normalizeName(m.name) === videoChannelName);
    if (matched) matchType = 'name';
  }

  if (!matched) {
    console.log('[ChannelResolver] no mentor match — fallback to AI classification');
    return null;
  }

  const categoryCode  = matched.category || null;
  const categoryLabel = CATEGORY_CODE_TO_LABEL[categoryCode] ?? categoryCode ?? null;
  const topicIds      = Array.isArray(matched.topicIds) ? matched.topicIds : [];

  console.log('[ChannelResolver] resolved mentor:', {
    mentorName: matched.name,
    matchType,
    categoryCode,
    categoryLabel,
    topicIds,
  });

  return { mentor: matched, matchType, categoryCode, categoryLabel, topicIds };
}
