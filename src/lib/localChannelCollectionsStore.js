const STORAGE_KEY = "ym_channel_collections_v1";
export const CHANNEL_COLLECTIONS_UPDATED_EVENT = "channel-collections-updated";

function newId() {
  return `coll_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeString(value) {
  const text = String(value || "").trim();
  return text || null;
}

/** Collapse whitespace; lowercase ASCII for stable name matching (Hebrew unchanged). */
function normalizeChannelNameKey(value) {
  const text = normalizeString(value);
  if (!text) return null;
  const collapsed = text.replace(/\s+/g, " ");
  return collapsed
    .split("")
    .map((ch) => (/[A-Za-z]/.test(ch) ? ch.toLowerCase() : ch))
    .join("");
}

/** Stable comparison for YouTube channel / page URLs (ignores trailing slash, www, query). */
function normalizeYoutubeChannelUrl(input) {
  const raw = normalizeString(input);
  if (!raw) return null;
  try {
    const withProto = raw.includes("://") ? raw : `https://${raw}`;
    const u = new URL(withProto);
    const host = (u.hostname || "").replace(/^www\./i, "").toLowerCase();
    u.hostname = host;
    u.hash = "";
    u.search = "";
    const path = (u.pathname || "").replace(/\/+$/, "") || "";
    u.pathname = path;
    return `${u.protocol}//${u.host}${path}`.toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").trim().toLowerCase();
  }
}

function collectNormalizedRowChannelUrls(row) {
  const out = new Set();
  const primary = normalizeYoutubeChannelUrl(row?.channelUrl);
  if (primary) out.add(primary);
  const list = Array.isArray(row?.channelUrls) ? row.channelUrls : [];
  for (const item of list) {
    const n = normalizeYoutubeChannelUrl(item);
    if (n) out.add(n);
  }
  return out;
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeChannelId(value) {
  const text = String(value || "").trim();
  return /^UC[a-zA-Z0-9_-]{22}$/.test(text) ? text : null;
}

function normalizeTopicIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function getVideoChannelIdentifiers(video) {
  const channelId = normalizeChannelId(video?.channelId || video?.youtubeChannelId);
  const channelUrl = normalizeString(video?.channelUrl);
  const channelName = normalizeString(video?.channelTitle || video?._channelName || video?.channelName);
  return { channelId, channelUrl, channelName };
}

function buildMatchKey(payload) {
  const channelId = normalizeString(payload?.channelId);
  const videoId = normalizeString(payload?.videoId);
  const channelUrl = normalizeString(payload?.channelUrl);
  const videoUrl = normalizeString(payload?.videoUrl);

  if (channelId) return `channel:${channelId}`;
  if (videoId) return `video:${videoId}`;
  if (channelUrl) return `channelUrl:${channelUrl}`;
  if (videoUrl) return `videoUrl:${videoUrl}`;
  return null;
}

function normalizeRow(payload, now, existing = null) {
  const channelUrls = normalizeStringList(payload?.channelUrls);
  const topicId = normalizeString(payload?.topicId ?? payload?.mainTopicId);
  const topic = normalizeString(payload?.topic ?? payload?.mainTopic);
  const subTopicId = normalizeString(payload?.subTopicId);
  const subTopic = normalizeString(payload?.subTopic ?? payload?.subtitle) || "כללי";
  const title = normalizeString(payload?.title ?? payload?.collectionName);
  const id = normalizeString(existing?.id) || normalizeString(payload?.id) || newId();
  const createdAt = normalizeString(existing?.createdAt) || normalizeString(payload?.createdAt) || now;

  const row = {
    id,
    matchKey: buildMatchKey(payload) || normalizeString(existing?.matchKey) || id,
    title,
    collectionName: title,
    topicId,
    mainTopicId: topicId,
    topic,
    mainTopic: topic,
    subTopicId,
    subTopic,
    subtitle: subTopic,
    description: normalizeString(payload?.description),
    tags: normalizeStringList(payload?.tags),
    topicIds: normalizeTopicIds([topicId, subTopicId]),
    channelUrls,
    channelId: normalizeChannelId(payload?.channelId),
    channelName: normalizeString(payload?.channelName),
    channelTitle: normalizeString(payload?.channelName) || normalizeString(payload?.channelTitle),
    channelUrl: normalizeString(payload?.channelUrl) || channelUrls[0] || null,
    channelThumbnail: normalizeString(payload?.channelThumbnail),
    videoId: normalizeString(payload?.videoId),
    videoTitle: normalizeString(payload?.videoTitle),
    videoUrl: normalizeString(payload?.videoUrl),
    isOpponentView: payload?.isOpponentView === true || existing?.isOpponentView === true,
    createdAt,
    updatedAt: now,
  };

  if (!row.title) throw new Error("חסר שם לאוסף");
  if (!row.topicId && !row.mainTopicId) throw new Error("חסר נושא ראשי");

  return row;
}

export function getChannelCollections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function notifyCollectionsUpdated(list) {
  try {
    window.dispatchEvent(new CustomEvent(CHANNEL_COLLECTIONS_UPDATED_EVENT, { detail: list }));
  } catch {
    // ignore event issues
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    notifyCollectionsUpdated(list);
  } catch (e) {
    throw new Error(`לא ניתן לשמור אוסף ערוצים: ${e?.message || "שגיאה לא ידועה"}`);
  }
}

/**
 * Resolves a saved channel collection for inheritance (main topic at channel level).
 * Priority: channelId → channelUrl (row channelUrl or channelUrls) → normalized channel name.
 * Does not use videoId/videoUrl — main topic is channel-scoped.
 * @returns {{ row: object | null, source: 'channelId' | 'channelUrl' | 'channelName' | 'none' }}
 */
export function resolveChannelCollectionMatch(payload) {
  const list = getChannelCollections();
  const channelId = normalizeChannelId(payload?.channelId);
  const urlNorm = normalizeYoutubeChannelUrl(payload?.channelUrl);
  const nameKey = normalizeChannelNameKey(payload?.channelName);

  if (channelId) {
    const row = list.find((r) => normalizeChannelId(r?.channelId) === channelId) ?? null;
    if (row) return { row, source: "channelId" };
  }
  if (urlNorm) {
    const row = list.find((r) => collectNormalizedRowChannelUrls(r).has(urlNorm)) ?? null;
    if (row) return { row, source: "channelUrl" };
  }
  if (nameKey) {
    const row = list.find((r) => {
      const rn = normalizeChannelNameKey(r?.channelName || r?.channelTitle);
      return rn && rn === nameKey;
    }) ?? null;
    if (row) return { row, source: "channelName" };
  }
  return { row: null, source: "none" };
}

/** Merge / dedupe lookup: channel-first resolve, then legacy keys (matchKey, videoId, …). */
export function findChannelCollectionMatch(payload) {
  const resolved = resolveChannelCollectionMatch(payload);
  if (resolved.row) return resolved.row;

  const matchKey = buildMatchKey(payload);
  const channelId = normalizeChannelId(payload?.channelId);
  const channelUrl = normalizeString(payload?.channelUrl);
  const channelName = normalizeString(payload?.channelName);
  const videoId = normalizeString(payload?.videoId);
  const videoUrl = normalizeString(payload?.videoUrl);
  if (!matchKey && !channelName && !channelUrl && !channelId && !videoId && !videoUrl) return null;
  return getChannelCollections().find((row) => (
    (matchKey && row?.matchKey === matchKey)
    || (channelId && row?.channelId === channelId)
    || (channelUrl && row?.channelUrl === channelUrl)
    || (channelName && row?.channelName === channelName)
    || (videoId && row?.videoId === videoId)
    || (videoUrl && row?.videoUrl === videoUrl)
  )) ?? null;
}

export function appendChannelCollection(payload) {
  const now = new Date().toISOString();
  const current = getChannelCollections();
  const existing = findChannelCollectionMatch(payload);
  const row = normalizeRow(payload, now, existing);

  const next = existing
    ? current.map((item) => (item.id === existing.id ? { ...existing, ...row } : item))
    : [...current, row];

  writeAll(next);
  return row;
}

/**
 * Update the channel collection whose channelId matches, propagating a new topic.
 * Returns the updated row, or null if no matching collection found.
 */
export function updateChannelCollectionByChannelId(channelId, updates) {
  const normId = normalizeChannelId(channelId);
  if (!normId) return null;
  const list = getChannelCollections();
  const idx = list.findIndex((r) => normalizeChannelId(r.channelId) === normId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  const existing = list[idx];
  const topicId = normalizeString(updates?.topicId ?? updates?.mainTopicId ?? existing.topicId);
  const topic = normalizeString(updates?.topic ?? updates?.mainTopic ?? existing.topic);
  const subTopicId = normalizeString(updates?.subTopicId ?? existing.subTopicId);
  const subTopic = normalizeString(updates?.subTopic ?? existing.subTopic) || "כללי";
  const updated = {
    ...existing,
    topicId,
    mainTopicId: topicId,
    topic,
    mainTopic: topic,
    subTopicId,
    subTopic,
    subtitle: subTopic,
    topicIds: normalizeTopicIds([topicId, subTopicId]),
    updatedAt: now,
  };
  const next = [...list];
  next[idx] = updated;
  writeAll(next);
  return updated;
}

/**
 * Update collection by channel name (fallback when channelId unavailable).
 */
export function updateChannelCollectionByChannelName(channelName, updates) {
  const nameKey = normalizeChannelNameKey(channelName);
  if (!nameKey) return null;
  const list = getChannelCollections();
  const idx = list.findIndex((r) => {
    const rn = normalizeChannelNameKey(r?.channelName || r?.channelTitle);
    return rn && rn === nameKey;
  });
  if (idx === -1) return null;
  return updateChannelCollectionByChannelId(list[idx].channelId, updates);
}

export function getChannelCollectionForVideo(video) {
  const { channelId, channelUrl, channelName } = getVideoChannelIdentifiers(video);
  return resolveChannelCollectionMatch({
    channelId,
    channelUrl,
    channelName,
  }).row;
}

export function applyChannelCollectionsToVideos(videos = []) {
  return (Array.isArray(videos) ? videos : []).map((video) => {
    const collection = getChannelCollectionForVideo(video);
    if (!collection) return video;

    const existingTopicIds = normalizeTopicIds(video?.topicIds);
    const inheritedTopicIds = normalizeTopicIds([collection.mainTopicId, collection.subTopicId]);
    const mergedTopicIds = [...new Set([...existingTopicIds, ...inheritedTopicIds])];
    const hasManualSubTopic = Boolean(normalizeString(video?.subTopicId) || normalizeString(video?.subCategory));

    return {
      ...video,
      topicIds: mergedTopicIds,
      category: normalizeString(video?.category) || collection.mainTopic || video?.category || null,
      inheritedMainTopicId: collection.mainTopicId || null,
      inheritedMainTopic: collection.mainTopic || null,
      inheritedSubTopicId: collection.subTopicId || null,
      inheritedSubTopic: collection.subTopic || "כללי",
      subTopicId: normalizeString(video?.subTopicId) || collection.subTopicId || null,
      subTopic: normalizeString(video?.subTopic) || normalizeString(video?.subCategory) || collection.subTopic || "כללי",
      subCategory: normalizeString(video?.subCategory) || (hasManualSubTopic ? normalizeString(video?.subCategory) : collection.subTopic || "כללי"),
      savedToMyChannels: video?.savedToMyChannels || Boolean(collection.id),
      savedChannelCollectionId: video?.savedChannelCollectionId || collection.id,
    };
  });
}
