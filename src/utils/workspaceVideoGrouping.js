import { createWorkspaceLibraryPresentation, getWorkspaceCollectionId } from './workspaceLibraryPresentation.js';
import { getWorkspaceItemIdentity, getWorkspaceSourceVideoId } from './workspaceItemIdentity.js';
import {
  WORKSPACE_COLLECTION_HEADINGS,
  WORKSPACE_COLLECTION_IDS,
  WORKSPACE_FALLBACK_COLLECTION,
  normalizeWorkspaceNavigationCollection,
} from '../config/workspaceHeadingRegistry.js';
import {
  countUniqueWorkspaceContents,
  selectWorkspaceCollectionCounts,
  selectWorkspaceDimensionItems,
} from './workspaceMarketDimensions.js';

export function normalizeWorkspaceVideoUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId = null;
    if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v');
      else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/live/')) videoId = url.pathname.split('/')[2] || null;
    }
    if (videoId && /^[\w-]{6,}$/.test(videoId)) return { key: `video:${videoId}`, videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = ''; url.hostname = host; url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    url.searchParams.sort();
    return { key: `url:${url.toString()}`, videoId: null, url: url.toString() };
  } catch { return null; }
}

export function getWorkspaceVideoIdentity(item) {
  const stableId = getWorkspaceSourceVideoId(item);
  if (stableId) return { key: `video:${stableId}`, videoId: stableId, url: item?.videoUrl || null };
  return normalizeWorkspaceVideoUrl(item?.videoUrl || item?.sourceUrl);
}

export function extractYoutubeIdFromUrl(url) {
  return normalizeWorkspaceVideoUrl(url)?.videoId ?? null;
}

// Resolves a saved workspace item's source video against the live `videos`
// list. Tries the id/videoId/youtubeId triple-check first; if that misses,
// falls back to matching the YouTube id embedded in each side's URL — this
// covers items saved before real video records ever populated youtubeId/
// videoId (their group key is derived from the URL and can't match those
// fields), without inventing a match when there genuinely isn't one.
export function findVideoByIdOrUrl(videos, { targetId = null, targetUrl = null } = {}) {
  if (!Array.isArray(videos)) return null;
  const byId = targetId
    ? videos.find((v) => v.videoId === targetId || v.id === targetId || v.youtubeId === targetId)
    : null;
  if (byId) return byId;
  const targetYoutubeId = targetUrl ? extractYoutubeIdFromUrl(targetUrl) : null;
  if (!targetYoutubeId) return null;
  return videos.find((v) => extractYoutubeIdFromUrl(v.url) === targetYoutubeId) || null;
}

function logicalContentKey(item) {
  const identity = getWorkspaceItemIdentity(item);
  return identity?.key || (item?.contentHash ? `${item.itemType || item.sourceTab || 'legacy'}|${item.contentHash}` : `record:${item.id}`);
}

function collectionForItem(item) {
  return getWorkspaceCollectionId(item) || 'unclassified';
}

function sourceVideoTitle(item) {
  return item?.structuredSnapshot?.videoTitle || item?.sourceVideoTitle || item?.sourceTitle || item?.videoTitle || '';
}

export function groupWorkspaceItemsByVideo(items = []) {
  const groups = new Map();
  const withoutVideo = [];
  for (const item of items) {
    const videoIdentity = getWorkspaceVideoIdentity(item);
    if (!videoIdentity) { withoutVideo.push(item); continue; }
    let group = groups.get(videoIdentity.key);
    if (!group) {
      group = {
        videoKey: videoIdentity.key, videoId: videoIdentity.videoId, videoTitle: sourceVideoTitle(item),
        videoUrl: videoIdentity.url || item.videoUrl || null, thumbnail: item.thumbnail || null,
        channel: item.channelName || item.channel || '', topicId: item.topicId || null, subTopicId: item.subTopicId || null,
        originalVideoDate: item.videoPublishedAt || item.publishedAt || null, items: [],
        collections: Object.fromEntries([...WORKSPACE_COLLECTION_IDS, 'unclassified'].map(id => [id, []])),
        versions: [], exactDuplicateGroups: [],
      };
      // Read-only compatibility alias for callers created before the canonical registry.
      group.collections.reusableKnowledge = group.collections.knowledge;
      groups.set(videoIdentity.key, group);
    }
    group.items.push(item);
    group.collections[collectionForItem(item)].push(item);
    if (!group.thumbnail && item.thumbnail) group.thumbnail = item.thumbnail;
    if (!group.videoTitle && sourceVideoTitle(item)) group.videoTitle = sourceVideoTitle(item);
  }

  for (const group of groups.values()) {
    const logical = new Map();
    for (const item of group.items) {
      const key = logicalContentKey(item);
      const records = logical.get(key) || [];
      records.push(item);
      logical.set(key, records);
    }
    group.versions = [...logical.entries()].map(([contentKey, records]) => ({
      contentKey, records: [...records].sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || ''))),
      canonical: [...records].sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))[0],
      copyCount: records.length, collection: collectionForItem(records[0]),
    })).sort((a, b) => String(b.canonical.savedAt || '').localeCompare(String(a.canonical.savedAt || '')));
    group.exactDuplicateGroups = group.versions.filter(version => version.copyCount > 1);
    group.uniqueContentCount = group.versions.length;
    group.collectionUniqueCounts = Object.fromEntries(
      [...WORKSPACE_COLLECTION_IDS, 'unclassified'].map(key => [key, group.versions.filter(version => version.collection === key).length]),
    );
    group.collectionUniqueCounts.reusableKnowledge = group.collectionUniqueCounts.knowledge;
    group.latestSaveDate = group.items.reduce((latest, item) => String(item.savedAt || '') > latest ? String(item.savedAt || '') : latest, '');
  }

  return { videoGroups: [...groups.values()], withoutVideo, persistedCount: items.length, videoCount: groups.size };
}

export const WORKSPACE_SCOPE_COLLECTIONS = [
  ...WORKSPACE_COLLECTION_IDS,
  WORKSPACE_FALLBACK_COLLECTION.id,
];

function emptyScopeCollections() {
  return Object.fromEntries(WORKSPACE_SCOPE_COLLECTIONS.map(type => [type, {
    type,
    entries: [],
    uniqueCount: 0,
    recordCount: 0,
  }]));
}

export function selectVideoGroups(items = []) {
  return groupWorkspaceItemsByVideo(items);
}

const SELECTABLE_COLLECTION_IDS = new Set([
  ...WORKSPACE_COLLECTION_IDS,
  WORKSPACE_FALLBACK_COLLECTION.id,
]);

export function normalizeWorkspaceCollectionId(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized === 'all') return 'all';
  const navigationCollection = normalizeWorkspaceNavigationCollection(normalized);
  return navigationCollection && SELECTABLE_COLLECTION_IDS.has(navigationCollection) ? navigationCollection : 'all';
}

function selectCollectionTileCounts(items) {
  const collectionCounts = selectWorkspaceCollectionCounts(items, [...SELECTABLE_COLLECTION_IDS]);
  const countsWithVideoScope = Object.fromEntries([...SELECTABLE_COLLECTION_IDS].map(collectionId => {
    const collectionItems = selectWorkspaceDimensionItems(items, { collectionId });
    return [collectionId, {
      ...collectionCounts[collectionId],
      videoCount: groupWorkspaceItemsByVideo(collectionItems).videoCount,
    }];
  }));
  return {
    all: {
      uniqueCount: countUniqueWorkspaceContents(items),
      recordCount: items.length,
      videoCount: groupWorkspaceItemsByVideo(items).videoCount,
    },
    ...countsWithVideoScope,
  };
}

function navigationNode(node, id) {
  if (node) return node;
  const normalized = String(id ?? '').trim();
  return normalized ? { realTopicIds: [normalized] } : null;
}

function applyWorkspaceStatusFilters(items, filters = {}) {
  let result = [...items];
  const archived = filters.archived === 'archived' || filters.archived === true;
  if (archived) result = result.filter(item => !!item.archivedAt);
  if (filters.favorite) result = result.filter(item => !!item.flags?.isFavorite);
  if (filters.important) result = result.filter(item => !!item.flags?.isImportant);
  if (filters.mustWatch) result = result.filter(item => !!item.flags?.mustWatchAgain);
  if (filters.marketStatus) result = result.filter(item => (item.marketStatus || '') === filters.marketStatus);
  if (filters.sourceTab) result = result.filter(item => (item.sourceTab || null) === filters.sourceTab);
  const tags = Array.isArray(filters.tags) ? filters.tags.filter(Boolean) : [];
  if (tags.length > 0) result = result.filter(item => tags.some(tag => (item.tags || []).includes(tag)));
  return result;
}

function sortWorkspaceItems(items, sortBy = 'newest') {
  const result = [...items];
  if (sortBy === 'oldest') result.sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt));
  else if (sortBy === 'title') result.sort((a, b) => (a.videoTitle || '').localeCompare(b.videoTitle || '', 'he'));
  else if (sortBy === 'priority') {
    const score = item => (item.flags?.isImportant ? 4 : 0) + (item.flags?.isFavorite ? 2 : 0) + (item.flags?.mustWatchAgain ? 1 : 0);
    result.sort((a, b) => score(b) - score(a) || new Date(b.savedAt) - new Date(a.savedAt));
  } else result.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  return result;
}

/**
 * Canonical read-only pipeline for the global Workspace video-parent list.
 * `all` means no collection restriction; it is never looked up as a child collection.
 */
export function selectWorkspaceVideoGroups({
  items = [],
  topicId = null,
  subtopicId = null,
  mainTopic = null,
  subtopic = null,
  collectionId = 'all',
  semanticTags = [],
  searchQuery = '',
  statusFilters = {},
  sortBy = 'newest',
} = {}) {
  const statusVisibleItems = applyWorkspaceStatusFilters(Array.isArray(items) ? items.filter(Boolean) : [], statusFilters);
  const matchingItems = selectWorkspaceDimensionItems(statusVisibleItems, {
    mainTopic: navigationNode(mainTopic, topicId),
    subtopic: navigationNode(subtopic, subtopicId),
    semanticTags,
    searchText: searchQuery,
  });
  const normalizedCollectionId = normalizeWorkspaceCollectionId(collectionId);
  const collectionItems = normalizedCollectionId === 'all'
    ? matchingItems
    : selectWorkspaceDimensionItems(matchingItems, { collectionId: normalizedCollectionId });
  const visibleItems = sortWorkspaceItems(collectionItems, sortBy);
  const grouping = groupWorkspaceItemsByVideo(visibleItems);
  return {
    ...grouping,
    items: visibleItems,
    matchingItems,
    collectionId: normalizedCollectionId,
    allUniqueContentCount: countUniqueWorkspaceContents(matchingItems),
    collectionCounts: selectCollectionTileCounts(matchingItems),
    reachableItemIds: getWorkspaceGroupingReachability(grouping),
  };
}

export function selectVideoCollections(videoGroup) {
  const collections = emptyScopeCollections();
  if (!videoGroup) return collections;
  for (const type of WORKSPACE_SCOPE_COLLECTIONS) {
    const entries = videoGroup.versions
      .filter(version => version.collection === type)
      .map(version => ({ ...version, videoGroup }));
    collections[type] = {
      type,
      entries,
      uniqueCount: entries.length,
      recordCount: entries.reduce((sum, entry) => sum + entry.records.length, 0),
    };
  }
  return collections;
}

const SECTION_LABEL_FALLBACKS = Object.fromEntries([
  ...WORKSPACE_COLLECTION_HEADINGS.map(definition => [definition.id, definition.label]),
  ['unclassified', 'פריטים נוספים'],
]);

export function getWorkspaceSectionLabel(item, collection = 'other') {
  if (item?.itemType === 'structured-snapshot' && item?.structuredSnapshot) return 'תמונת מצב';
  const explicit = [item?.sourceHeading, item?.sourceSection, item?.sectionLabel, item?.savedSectionTitle]
    .map(value => String(value || '').trim())
    .find(Boolean);
  if (explicit) return explicit;
  const title = String(item?.savedTitle || item?.videoTitle || item?.title || '').trim();
  const titlePrefix = title.split(/\s+[—–-]\s+/)[0]?.trim();
  if (titlePrefix && titlePrefix !== title) return titlePrefix;
  return SECTION_LABEL_FALLBACKS[collection] || SECTION_LABEL_FALLBACKS.unclassified;
}

export function selectFocusedVideoPresentation(videoGroup) {
  if (!videoGroup) return null;
  const sectionMap = new Map();
  for (const version of videoGroup.versions) {
    const sectionLabel = getWorkspaceSectionLabel(version.canonical, version.collection);
    const sectionKey = `${version.collection}|${sectionLabel}`;
    const section = sectionMap.get(sectionKey) || { sectionKey, label: sectionLabel, collection: version.collection, versions: [] };
    section.versions.push(version);
    sectionMap.set(sectionKey, section);
  }
  const snapshotRecords = videoGroup.items.filter(item => item?.itemType === 'structured-snapshot' && item?.structuredSnapshot).length;
  const snapshotUniqueCount = videoGroup.versions.filter(version => (
    version.canonical?.itemType === 'structured-snapshot' && version.canonical?.structuredSnapshot
  )).length;
  return {
    recordCount: videoGroup.items.length,
    snapshotUniqueCount,
    savedSectionCount: Math.max(0, videoGroup.items.length - snapshotRecords),
    latestSaveDate: videoGroup.latestSaveDate,
    sections: [...sectionMap.values()],
    exactDuplicateRemovalIds: videoGroup.exactDuplicateGroups.flatMap(version => version.records.slice(1).map(item => item.id)),
  };
}

export function selectGlobalCollections(videoGroups = [], withoutVideo = []) {
  const collections = emptyScopeCollections();
  for (const videoGroup of videoGroups) {
    const videoCollections = selectVideoCollections(videoGroup);
    for (const type of WORKSPACE_SCOPE_COLLECTIONS) {
      collections[type].entries.push(...videoCollections[type].entries);
      collections[type].uniqueCount += videoCollections[type].uniqueCount;
      collections[type].recordCount += videoCollections[type].recordCount;
    }
  }
  const ungroupedVersions = new Map();
  for (const item of withoutVideo) {
    const collection = collectionForItem(item);
    const contentKey = logicalContentKey(item);
    const records = ungroupedVersions.get(contentKey) || [];
    records.push(item);
    ungroupedVersions.set(contentKey, records);
    if (!collections[collection]) continue;
  }
  for (const [contentKey, records] of ungroupedVersions) {
    const collection = collectionForItem(records[0]);
    if (!collections[collection]) continue;
    const sorted = [...records].sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
    collections[collection].entries.push({
      contentKey,
      records: sorted,
      canonical: sorted[0],
      copyCount: sorted.length,
      collection,
      videoGroup: null,
    });
    collections[collection].uniqueCount += 1;
    collections[collection].recordCount += sorted.length;
  }
  return collections;
}

export function resolveFocusedVideoGroup(videoGroups = [], focusedVideoKey = null) {
  if (!focusedVideoKey) return null;
  const value = String(focusedVideoKey);
  return videoGroups.find(group => group.videoKey === value || group.videoId === value) || null;
}

export function selectCollectionForScope({ videoGroups = [], withoutVideo = [], focusedVideoKey = null, collectionType = null } = {}) {
  const focusedVideoGroup = resolveFocusedVideoGroup(videoGroups, focusedVideoKey);
  const collections = focusedVideoGroup ? selectVideoCollections(focusedVideoGroup) : selectGlobalCollections(videoGroups, withoutVideo);
  return {
    scope: focusedVideoGroup ? 'video' : 'global',
    focusedVideoGroup,
    collections,
    collection: collectionType && collections[collectionType] ? collections[collectionType] : null,
  };
}

export function searchWorkspaceItemsForScope({ videoGroups = [], withoutVideo = [], focusedVideoKey = null, query = '' } = {}) {
  const focusedVideoGroup = resolveFocusedVideoGroup(videoGroups, focusedVideoKey);
  const scopeItems = focusedVideoGroup ? focusedVideoGroup.items : [...videoGroups.flatMap(group => group.items), ...withoutVideo];
  return createWorkspaceLibraryPresentation(scopeItems).search(query, scopeItems);
}

export function getWorkspaceGroupingReachability(result) {
  return [...result.videoGroups.flatMap(group => group.items), ...result.withoutVideo].map(item => item.id);
}

export function checksumWorkspaceItemIds(items = []) {
  const input = items.map(item => String(item?.id || '')).sort().join('\n');
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
