const LINK_DEFINITIONS = Object.freeze([
  Object.freeze({ key: 'home', labelHe: 'דף הערוץ', icon: '📺', suffixes: ['', 'featured'] }),
  Object.freeze({ key: 'videos', labelHe: 'סרטונים', icon: '🎬', suffixes: ['videos'] }),
  Object.freeze({ key: 'live', labelHe: 'שידורים חיים', icon: '🔴', suffixes: ['streams', 'live'] }),
  Object.freeze({ key: 'courses', labelHe: 'קורסים', icon: '🎓', suffixes: ['courses'] }),
  Object.freeze({ key: 'playlists', labelHe: 'פלייליסטים', icon: '📚', suffixes: ['playlists'] }),
  Object.freeze({ key: 'posts', labelHe: 'פוסטים', icon: '💬', suffixes: ['posts', 'community'] }),
]);

const LINK_KEYS = new Set(LINK_DEFINITIONS.map((definition) => definition.key));
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const SENSITIVE_QUERY_KEY = /token|secret|api[_-]?key|password|credential/i;

const LEGACY_FIELDS = Object.freeze({
  home: ['channelHomeUrl', 'youtubeChannelUrl', 'channelUrl', 'youtubeUrl', 'youtubePageUrl'],
  videos: ['channelVideosUrl', 'youtubeVideosUrl', 'videosUrl'],
  live: ['channelLiveUrl', 'youtubeLiveUrl', 'streamsUrl', 'liveStreamsUrl', 'liveUrl'],
  courses: ['channelCoursesUrl', 'youtubeCoursesUrl', 'coursesUrl'],
  playlists: ['channelPlaylistsUrl', 'youtubePlaylistsUrl', 'playlistsUrl'],
  posts: ['channelPostsUrl', 'youtubePostsUrl', 'communityUrl', 'postsUrl'],
});

function clean(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}

function normalizeChannelId(value) {
  const channelId = clean(value);
  return /^UC[a-zA-Z0-9_-]{22}$/.test(channelId) ? channelId : '';
}

function normalizeHandle(value) {
  const raw = clean(value);
  if (!raw) return '';
  const fromUrl = raw.match(/youtube\.com\/@([^/?#]+)/i)?.[1];
  const handle = (fromUrl || raw).replace(/^@/, '');
  return /^[\p{L}\p{N}._-]+$/u.test(handle) ? handle : '';
}

function getChannelPathParts(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (!parts.length) return null;
  if (parts[0].startsWith('@') && parts[0].length > 1) return { suffix: parts[1] || '' };
  if (['channel', 'c', 'user'].includes(parts[0]) && parts[1]) return { suffix: parts[2] || '' };
  return null;
}

export function sanitizeMentorChannelUrl(value, destinationKey = 'home') {
  const raw = clean(value);
  if (!raw || !LINK_KEYS.has(destinationKey)) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return '';
    if ([...parsed.searchParams.keys()].some((key) => SENSITIVE_QUERY_KEY.test(key))) return '';
    const channelPath = getChannelPathParts(parsed.pathname);
    if (!channelPath) return '';
    const definition = LINK_DEFINITIONS.find((item) => item.key === destinationKey);
    if (!definition.suffixes.includes(channelPath.suffix.toLowerCase())) return '';
    parsed.hostname = 'www.youtube.com';
    parsed.protocol = 'https:';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function getLegacyResourceUrl(mentor, key) {
  const resources = [
    ...(Array.isArray(mentor?.channelResources) ? mentor.channelResources : []),
    ...(Array.isArray(mentor?.contentHub?.tabs) ? mentor.contentHub.tabs : []),
  ];
  const match = resources.find((resource) => {
    const resourceKey = clean(resource?.key || resource?.type).toLowerCase();
    return resourceKey === key && clean(resource?.url);
  });
  return clean(match?.url);
}

function getCandidate(mentor, key) {
  const explicit = mentor?.channelLinks;
  if (explicit && typeof explicit === 'object' && !Array.isArray(explicit) &&
      Object.prototype.hasOwnProperty.call(explicit, key)) {
    return { value: clean(explicit[key]), explicit: true, source: 'channelLinks' };
  }

  for (const field of LEGACY_FIELDS[key]) {
    const value = clean(mentor?.[field]);
    if (value) return { value, explicit: false, source: field };
  }

  const resourceUrl = getLegacyResourceUrl(mentor, key);
  if (resourceUrl) return { value: resourceUrl, explicit: false, source: 'legacy-resources' };

  if (key === 'home') {
    const channelId = normalizeChannelId(mentor?.youtubeChannelId || mentor?.channelId);
    if (channelId) {
      return {
        value: `https://www.youtube.com/channel/${channelId}`,
        explicit: false,
        source: 'channel-id',
      };
    }
    const handle = normalizeHandle(mentor?.handle || mentor?.channelHandle);
    if (handle) {
      return {
        value: `https://www.youtube.com/@${handle}`,
        explicit: false,
        source: 'handle',
      };
    }
  }

  return { value: '', explicit: false, source: 'missing' };
}

export function resolveMentorChannelLinks(mentor) {
  if (!mentor || typeof mentor !== 'object' || Array.isArray(mentor)) {
    return { links: [], values: Object.fromEntries(LINK_DEFINITIONS.map(({ key }) => [key, ''])), diagnostics: [] };
  }

  const seenUrls = new Set();
  const diagnostics = [];
  const values = {};
  const links = [];

  for (const definition of LINK_DEFINITIONS) {
    const candidate = getCandidate(mentor, definition.key);
    if (!candidate.value) {
      values[definition.key] = '';
      continue;
    }
    const url = sanitizeMentorChannelUrl(candidate.value, definition.key);
    if (!url) {
      values[definition.key] = '';
      diagnostics.push({ key: definition.key, reason: 'invalid-url', source: candidate.source });
      continue;
    }
    const dedupeKey = url.toLowerCase().replace(/\/$/, '');
    if (seenUrls.has(dedupeKey)) {
      values[definition.key] = '';
      diagnostics.push({ key: definition.key, reason: 'duplicate-url', source: candidate.source });
      continue;
    }
    seenUrls.add(dedupeKey);
    values[definition.key] = url;
    links.push({ ...definition, url, source: candidate.source });
  }

  return { links, values, diagnostics };
}

export function normalizeMentorRecord(mentor) {
  if (!mentor || typeof mentor !== 'object' || Array.isArray(mentor)) return null;
  const id = clean(mentor.id || mentor.mentorId || mentor.youtubeChannelId || mentor.channelId);
  const name = clean(mentor.name || mentor.channelName || mentor.channelTitle);
  const channel = resolveMentorChannelLinks(mentor);
  return {
    ...mentor,
    id,
    name,
    channelLinks: channel.values,
    channelLinkDiagnostics: channel.diagnostics,
  };
}

export function normalizeMentorRecords(mentors) {
  if (!Array.isArray(mentors)) return [];
  return mentors.map(normalizeMentorRecord).filter(Boolean);
}

export function resolveMentorChannelCenter(mentor) {
  const normalizedMentor = normalizeMentorRecord(mentor);
  if (!normalizedMentor) return null;
  const channel = resolveMentorChannelLinks(normalizedMentor);
  return {
    mentorId: normalizedMentor.id,
    mentorName: normalizedMentor.name,
    links: channel.links,
    status: channel.links.length ? 'available' : 'unavailable',
    diagnostics: channel.diagnostics,
  };
}

export function getMentorChannelLinkDraft(mentor) {
  return { ...resolveMentorChannelLinks(normalizeMentorRecord(mentor)).values };
}

export function validateMentorChannelLinks(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const channelLinks = {};
  const errors = [];
  const seenUrls = new Map();

  for (const definition of LINK_DEFINITIONS) {
    const raw = clean(source[definition.key]);
    if (!raw) {
      channelLinks[definition.key] = '';
      continue;
    }
    const url = sanitizeMentorChannelUrl(raw, definition.key);
    if (!url) {
      channelLinks[definition.key] = raw;
      errors.push({ key: definition.key, message: `הקישור עבור ${definition.labelHe} אינו כתובת YouTube מאובטחת ומתאימה` });
      continue;
    }
    const dedupeKey = url.toLowerCase().replace(/\/$/, '');
    if (seenUrls.has(dedupeKey)) {
      channelLinks[definition.key] = url;
      errors.push({ key: definition.key, message: `הקישור עבור ${definition.labelHe} כפול לקישור ${seenUrls.get(dedupeKey)}` });
      continue;
    }
    seenUrls.set(dedupeKey, definition.labelHe);
    channelLinks[definition.key] = url;
  }

  return { valid: errors.length === 0, channelLinks, errors };
}

export function mergeMentorChannelLinkPatch(mentor, patch) {
  const current = getMentorChannelLinkDraft(mentor);
  const updates = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  for (const key of LINK_KEYS) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) current[key] = updates[key];
  }
  return validateMentorChannelLinks(current);
}

export function getMentorChannelHomeUrl(mentor) {
  return resolveMentorChannelCenter(mentor)?.links.find((link) => link.key === 'home')?.url || null;
}

export const MENTOR_CHANNEL_DESTINATIONS = LINK_DEFINITIONS;
