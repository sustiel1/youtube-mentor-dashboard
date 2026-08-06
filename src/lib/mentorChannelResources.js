const MICHA_CHANNEL_ID = 'UCSxjNbPriyBh9RNl_QNSAtw';

export const MENTOR_CHANNEL_RESOURCE_TYPES = Object.freeze([
  'home', 'videos', 'live', 'courses', 'playlists', 'posts', 'shorts',
  'playlist', 'course', 'topic-playlist', 'topic-course', 'topic', 'custom',
]);

const STANDARD_TYPES = new Set(['home', 'videos', 'live', 'courses', 'playlists', 'posts', 'shorts', 'youtube-channel-tab']);

const MICHA_RESOURCES = Object.freeze([
  Object.freeze({ key: 'home', labelHe: 'דף הבית', descriptionHe: 'דף הבית והתוכן המומלץ של הערוץ', url: 'https://www.youtube.com/@Micha.Stocks/featured', icon: '🏠', type: 'youtube-channel-tab', verified: true }),
  Object.freeze({ key: 'videos', labelHe: 'סרטונים', descriptionHe: 'כל הסרטונים שהועלו לערוץ', url: 'https://www.youtube.com/@Micha.Stocks/videos', icon: '🎬', type: 'youtube-channel-tab', verified: true }),
  Object.freeze({ key: 'live', labelHe: 'בשידור חי', descriptionHe: 'שידורים חיים ושידורים קודמים של הערוץ', url: 'https://www.youtube.com/@Micha.Stocks/streams', icon: '🔴', type: 'youtube-channel-tab', verified: true }),
  Object.freeze({ key: 'courses', labelHe: 'קורסים', descriptionHe: 'קורסים וסדרות לימוד מסודרות', url: 'https://www.youtube.com/@Micha.Stocks/courses', icon: '🎓', type: 'youtube-channel-tab', verified: true }),
  Object.freeze({ key: 'playlists', labelHe: 'פלייליסטים', descriptionHe: 'סרטונים המחולקים לפי סדרות ונושאי לימוד', url: 'https://www.youtube.com/@Micha.Stocks/playlists', icon: '📚', type: 'youtube-channel-tab', verified: true }),
  Object.freeze({ key: 'posts', labelHe: 'פוסטים', descriptionHe: 'עדכונים ופוסטים שפורסמו בקהילת הערוץ', url: 'https://www.youtube.com/@Micha.Stocks/posts', icon: '💬', type: 'youtube-channel-tab', verified: true }),
]);

const MENTOR_CHANNEL_RESOURCE_REGISTRY = Object.freeze([
  Object.freeze({
    mentorId: 'm1',
    channelIdentity: Object.freeze({
      channelId: MICHA_CHANNEL_ID,
      handle: '@Micha.Stocks',
      canonicalUrl: 'https://www.youtube.com/@Micha.Stocks/featured',
      legacyNames: Object.freeze(['Micha.Stocks']),
    }),
    resources: MICHA_RESOURCES,
  }),
]);

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeHandle(value) {
  const raw = clean(value);
  if (!raw) return '';
  const fromUrl = raw.match(/youtube\.com\/@([^/?#]+)/i)?.[1];
  return (fromUrl || raw).replace(/^@/, '').toLowerCase();
}

function isSafeYouTubeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['youtube.com', 'www.youtube.com'].includes(url.hostname);
  } catch {
    return false;
  }
}

function isSafeHttpsUrl(value) {
  try {
    const url = new URL(value);
    const sensitive = [...url.searchParams.keys()].some((key) => /token|secret|api[_-]?key|password/i.test(key));
    return url.protocol === 'https:' && !url.username && !url.password && !sensitive;
  } catch { return false; }
}

function isValidResourceUrl(resource) {
  if (!isSafeHttpsUrl(resource.url)) return false;
  if (STANDARD_TYPES.has(resource.type)) return isSafeYouTubeUrl(resource.url);
  if (resource.type === 'playlist' || resource.type === 'topic-playlist') {
    try {
      const url = new URL(resource.url);
      return isSafeYouTubeUrl(resource.url) && (url.pathname === '/playlist' || url.searchParams.has('list'));
    } catch { return false; }
  }
  return true;
}

export function normalizeMentorChannelResources(resources) {
  if (!Array.isArray(resources)) return [];
  const seenIds = new Set();
  const seenUrls = new Set();
  return resources.flatMap((resource, index) => {
    if (!resource || typeof resource !== 'object') return [];
    const id = clean(resource.id || resource.key);
    const url = clean(resource.url);
    const type = clean(resource.type) || 'custom';
    if (!id || seenIds.has(id) || seenUrls.has(url.toLowerCase())) return [];
    const normalized = {
      id,
      key: id,
      type,
      labelHe: clean(resource.labelHe),
      descriptionHe: clean(resource.descriptionHe),
      url,
      icon: clean(resource.icon) || '🔗',
      enabled: resource.enabled !== false,
      order: Number.isFinite(Number(resource.order)) ? Number(resource.order) : index,
      verified: resource.verified === true,
      source: clean(resource.source) || 'manual',
    };
    if (!normalized.labelHe || normalized.descriptionHe.length > 240 || !MENTOR_CHANNEL_RESOURCE_TYPES.includes(type) && type !== 'youtube-channel-tab' || !isValidResourceUrl(normalized)) return [];
    seenIds.add(id);
    seenUrls.add(url.toLowerCase());
    return [normalized];
  }).sort((a, b) => a.order - b.order);
}

export function validateMentorChannelResources(resources) {
  if (!Array.isArray(resources)) return { valid: false, error: 'רשימת הקישורים אינה תקינה' };
  const normalized = normalizeMentorChannelResources(resources);
  if (normalized.length !== resources.length) return { valid: false, error: 'יש קישור חסר, כפול או לא תקין. קישורי ערוץ חייבים להיות כתובות HTTPS מאושרות.' };
  return { valid: true, resources: normalized };
}

export function resolveMentorChannelResourceSet(mentor) {
  if (!mentor || typeof mentor !== 'object') return null;
  const channelId = clean(mentor.youtubeChannelId || mentor.channelId);
  const mentorId = clean(mentor.id);
  const handle = normalizeHandle(mentor.handle || mentor.channelHandle || mentor.youtubeUrl || mentor.channelUrl || mentor.youtubePageUrl);
  const name = clean(mentor.name || mentor.channelTitle);

  const entry = MENTOR_CHANNEL_RESOURCE_REGISTRY.find((candidate) => {
    const identity = candidate.channelIdentity;
    if (channelId && channelId === identity.channelId) return true;
    if (!channelId && mentorId && mentorId === candidate.mentorId) return true;
    if (!channelId && !mentorId && handle && handle === normalizeHandle(identity.handle)) return true;
    return !channelId && !mentorId && !handle && identity.legacyNames.includes(name);
  });
  const hasPersistedResources = Array.isArray(mentor.channelResources);
  const explicitUrl = clean(mentor.youtubePageUrl || mentor.youtubeUrl || mentor.channelUrl);
  const safeExplicitUrl = isSafeYouTubeUrl(explicitUrl) ? explicitUrl : '';
  if (!entry && !hasPersistedResources && !safeExplicitUrl) return null;

  const sourceResources = hasPersistedResources ? mentor.channelResources : (entry?.resources || []);
  const resources = normalizeMentorChannelResources(sourceResources).filter((resource) => resource.enabled && (hasPersistedResources || resource.verified));
  const canonicalUrl = entry?.channelIdentity.canonicalUrl || safeExplicitUrl;
  if (!resources.length && !canonicalUrl) return null;
  const channelIdentity = entry?.channelIdentity || {
    channelId,
    handle: clean(mentor.handle || mentor.channelHandle),
    canonicalUrl,
    legacyNames: [],
  };
  return { mentorId: mentorId || entry?.mentorId, channelIdentity, resources, source: hasPersistedResources ? 'mentor' : 'legacy-fallback' };
}

export function getMentorChannelResources(mentor) {
  return resolveMentorChannelResourceSet(mentor)?.resources || [];
}

export const MENTOR_CHANNEL_RESOURCES = MENTOR_CHANNEL_RESOURCE_REGISTRY;
