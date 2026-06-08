// Resolves a video's channel to a known mentor and their saved category.
// Priority: channelId → channelUrl → normalized name → null (AI fallback).

import { MENTORS } from '@/data/mockData';
import { getLocalCustomMentors } from '@/lib/localCustomMentorsStore';
import { applyTopicOverridesToMentors } from '@/lib/mentorTopicOverrides';
import { loadTopics } from '@/services/topicStorage';
import { getMainTopicForTopic } from '@/lib/topicFilters';

const CATEGORY_CODE_TO_LABEL = {
  Markets: 'שוק ההון',
  AI: 'בינה מלאכותית ואוטומציה',
  Dev: 'פיתוח תוכנה',
  Politics: 'פוליטיקה',
  Health: 'בריאות ותזונה',
  Music: 'מוזיקה',
  Food: 'אוכל ובישול',
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
function deriveCategoryLabel(mentor) {
  const code = mentor.category || null;
  if (code && CATEGORY_CODE_TO_LABEL[code]) return CATEGORY_CODE_TO_LABEL[code];
  // Fallback: derive from topicIds (mentor topic overrides store topicIds, not always category)
  const topicIds = Array.isArray(mentor.topicIds) ? mentor.topicIds : [];
  if (!topicIds.length) return code ?? null;
  const topics = loadTopics();
  const leafId = topicIds[0];
  const main = getMainTopicForTopic(leafId, topics);
  if (main) return CATEGORY_CODE_TO_LABEL[main.category ?? ''] ?? main.name ?? null;
  return code ?? null;
}

export function resolveChannelToMentor(video) {
  if (!video) return null;

  const allMentors = applyTopicOverridesToMentors([...MENTORS, ...getLocalCustomMentors()]);
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
  const categoryLabel = deriveCategoryLabel(matched);
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

/**
 * Looks up a mentor by display name (for cases where video has no channel metadata
 * but the parent component knows the mentor name via props).
 * Uses the same normalization as resolveChannelToMentor step 3.
 */
export function resolveMentorByName(displayName) {
  if (!displayName) return null;
  const allMentors = applyTopicOverridesToMentors([...MENTORS, ...getLocalCustomMentors()]);
  const normalized = normalizeName(displayName);
  const matched = allMentors.find(m => normalizeName(m.name) === normalized);
  if (!matched) return null;
  const categoryCode  = matched.category || null;
  const categoryLabel = deriveCategoryLabel(matched);
  const topicIds      = Array.isArray(matched.topicIds) ? matched.topicIds : [];
  console.log('[ChannelResolver] resolved mentor by name prop:', { displayName, categoryCode, categoryLabel });
  return { mentor: matched, matchType: 'nameByProp', categoryCode, categoryLabel, topicIds };
}
