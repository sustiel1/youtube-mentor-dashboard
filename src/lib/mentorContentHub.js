import { resolveMentorChannelUrl } from "./mentorSourceUrl.js";

const TAB_DEFINITIONS = {
  home: { labelHe: "דף הבית", suffix: "" },
  videos: { labelHe: "סרטונים", suffix: "/videos" },
  live: { labelHe: "שידורים חיים", suffix: "/streams" },
  courses: { labelHe: "קורסים", suffix: "/courses" },
  playlists: { labelHe: "פלייליסטים", suffix: "/playlists" },
  shorts: { labelHe: "Shorts", suffix: "/shorts" },
  community: { labelHe: "קהילה", suffix: "/community" },
  search: { labelHe: "חיפוש בערוץ", suffix: "/search" },
};

const VALID_CHANNEL_ID = /^UC[\w-]{22}$/;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveCanonicalMentorIdentity(mentor, fallback = null) {
  const source = mentor || fallback || {};
  const channelId = cleanString(source.youtubeChannelId || source.channelId);
  const handle = cleanString(source.handle || source.channelHandle).replace(/^@/, "");
  const resolvedUrl = resolveMentorChannelUrl(source);
  const canonicalChannelUrl = VALID_CHANNEL_ID.test(channelId)
    ? `https://www.youtube.com/channel/${channelId}`
    : resolvedUrl;

  if (!canonicalChannelUrl) return null;
  return {
    channelId: VALID_CHANNEL_ID.test(channelId) ? channelId : "",
    handle,
    channelTitle: cleanString(source.name || source.channelTitle || source.channelName),
    canonicalChannelUrl,
    thumbnailUrl: cleanString(source.avatarUrl || source.thumbnailUrl),
    identitySource: VALID_CHANNEL_ID.test(channelId) ? "existing-data" : "manual",
    verifiedAt: cleanString(source.channelIdResolvedAt || source.verifiedAt),
  };
}

function safeExternalUrl(value) {
  try {
    const url = new URL(cleanString(value));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function canonicalTabUrl(identity, key) {
  const definition = TAB_DEFINITIONS[key];
  if (!definition || !identity?.canonicalChannelUrl) return "";
  return `${identity.canonicalChannelUrl.replace(/\/$/, "")}${definition.suffix}`;
}

export function resolveMentorContentHub(mentor, { videos = [], fallback = null } = {}) {
  const identity = resolveCanonicalMentorIdentity(mentor, fallback);
  if (!identity) {
    return { identity: null, tabs: [], playlists: [], curatedLinks: [], status: "unavailable", updatedAt: "" };
  }

  const configured = mentor?.contentHub && typeof mentor.contentHub === "object" ? mentor.contentHub : {};
  const configuredTabs = Array.isArray(configured.tabs) ? configured.tabs : [];
  const configuredByKey = new Map(configuredTabs.map((tab) => [tab?.key, tab]));
  const relevantVideos = videos.filter((video) => !mentor?.id || video?.mentorId === mentor.id);
  const evidence = {
    videos: relevantVideos.length > 0,
    live: relevantVideos.some((video) => video?.isLive || video?.videoType === "live" || /\/live(?:[/?]|$)/i.test(video?.url || "")),
    shorts: relevantVideos.some((video) => /\/shorts\//i.test(video?.url || "")),
  };

  const keys = ["home", "videos", "live", "courses", "playlists", "shorts", "community", "search"];
  const tabs = keys.flatMap((key) => {
    const configuredTab = configuredByKey.get(key);
    const alwaysDerived = key === "home" || key === "search" || (key === "videos" && evidence.videos);
    const evidenceDerived = Boolean(evidence[key]);
    const available = configuredTab?.availability === "verified" || configuredTab?.availability === "derived" || alwaysDerived || evidenceDerived;
    if (!available || configuredTab?.availability === "unavailable") return [];
    const url = safeExternalUrl(configuredTab?.url) || canonicalTabUrl(identity, key);
    if (!url) return [];
    return [{
      key,
      labelHe: cleanString(configuredTab?.labelHe) || TAB_DEFINITIONS[key].labelHe,
      url,
      availability: configuredTab?.availability || "derived",
      source: configuredTab?.source === "manual" ? "manual" : "youtube",
    }];
  });

  const playlists = (Array.isArray(configured.playlists) ? configured.playlists : []).flatMap((playlist) => {
    const playlistId = cleanString(playlist?.playlistId);
    if (!playlistId || playlist?.isPublic === false) return [];
    return [{
      ...playlist,
      playlistId,
      title: cleanString(playlist.title),
      url: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
      itemCount: Number.isFinite(playlist.itemCount) ? playlist.itemCount : null,
      source: "youtube",
    }];
  });

  const curatedLinks = (Array.isArray(configured.curatedLinks) ? configured.curatedLinks : []).flatMap((link) => {
    const url = safeExternalUrl(link?.url);
    return url ? [{ ...link, url, source: "manual" }] : [];
  });

  return {
    identity,
    tabs,
    playlists,
    curatedLinks,
    updatedAt: cleanString(configured.updatedAt),
    status: configured.status || (tabs.length > 2 || playlists.length || curatedLinks.length ? "ready" : "partial"),
  };
}

export const MENTOR_CONTENT_TAB_KEYS = Object.freeze(Object.keys(TAB_DEFINITIONS));
