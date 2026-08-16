import {
  VIDEO_ANALYSIS_HEADINGS,
  getWorkspaceNavigationCollectionForItem,
  getWorkspaceHeadingBySourceTab,
} from '../config/workspaceHeadingRegistry.js';
import {
  getWorkspaceItemIdentity,
  getWorkspaceSourceVideoId,
} from './workspaceItemIdentity.js';

export const CONTENT_ROUTING_VERSION = 1;

const clean = value => String(value ?? '').trim();

function extractYoutubeVideoId(value) {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return clean(url.pathname.split('/').filter(Boolean)[0]) || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return clean(url.searchParams.get('v')) || null;
      if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/live/')) {
        return clean(url.pathname.split('/')[2]) || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function sourceVideoIdForItem(item = {}) {
  return getWorkspaceSourceVideoId(item)
    || extractYoutubeVideoId(item.videoUrl || item.sourceUrl || item.youtubeUrl);
}

function latestIso(values = []) {
  return values.map(clean).filter(Boolean).sort().at(-1) || null;
}

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function collectionLogicalKey(item, index) {
  return getWorkspaceItemIdentity(item)?.key
    || item?.contentHash
    || item?.id
    || `legacy-record-${index}`;
}

function findTopic(topics, id) {
  const normalized = clean(id);
  return normalized ? topics.find(topic => clean(topic?.id) === normalized) || null : null;
}

export function createContentRoutingMetadata(item = {}) {
  const heading = getWorkspaceHeadingBySourceTab(item.sourceTabId || item.sourceTab)
    || VIDEO_ANALYSIS_HEADINGS.find(definition => definition.workspaceCollection === item.workspaceCollection)
    || null;
  const sourceVideoId = sourceVideoIdForItem(item);
  if (!heading || !sourceVideoId) return null;

  return {
    version: CONTENT_ROUTING_VERSION,
    sourceVideoId,
    primaryTopicId: clean(item.topicId) || null,
    organizationalSubtopicId: clean(item.subTopicId || item.subtopicId) || null,
    sourceTabId: heading.sourceTabId,
    sourceSectionId: clean(item.sourceSectionId) || 'unsectioned',
    sourceHeading: clean(item.sourceHeading) || heading.label,
    collectionKey: getWorkspaceNavigationCollectionForItem(item, heading.workspaceCollection),
    savedAt: clean(item.savedAt || item.createdAt || item.updatedAt) || null,
  };
}

export function attachContentRoutingMetadata(item = {}) {
  const metadata = createContentRoutingMetadata(item);
  return metadata ? { ...item, contentRouting: metadata } : { ...item };
}

export function readContentRoutingMetadata(item = {}) {
  const persisted = item?.contentRouting;
  if (
    persisted
    && Number(persisted.version) === CONTENT_ROUTING_VERSION
    && clean(persisted.sourceVideoId)
    && getWorkspaceHeadingBySourceTab(persisted.sourceTabId)
  ) {
    return {
      version: CONTENT_ROUTING_VERSION,
      sourceVideoId: clean(persisted.sourceVideoId),
      primaryTopicId: clean(persisted.primaryTopicId) || null,
      organizationalSubtopicId: clean(persisted.organizationalSubtopicId) || null,
      sourceTabId: getWorkspaceHeadingBySourceTab(persisted.sourceTabId).sourceTabId,
      sourceSectionId: clean(persisted.sourceSectionId) || 'unsectioned',
      sourceHeading: clean(persisted.sourceHeading) || getWorkspaceHeadingBySourceTab(persisted.sourceTabId).label,
      collectionKey: clean(persisted.collectionKey)
        || getWorkspaceNavigationCollectionForItem(item, getWorkspaceHeadingBySourceTab(persisted.sourceTabId).workspaceCollection),
      savedAt: clean(persisted.savedAt) || null,
      legacy: false,
    };
  }

  const legacy = createContentRoutingMetadata(item);
  return legacy ? { ...legacy, legacy: true } : null;
}

export function isJsonSafeContentRouting(value) {
  try {
    const serialized = JSON.stringify(value);
    return Boolean(serialized) && JSON.stringify(JSON.parse(serialized)) === serialized;
  } catch {
    return false;
  }
}

export function selectObsidianCollectionStatuses(entries = []) {
  const grouped = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const heading = getWorkspaceHeadingBySourceTab(entry?.tabKey);
    if (!heading) continue;
    const key = heading.workspaceCollection;
    const bucket = grouped.get(key) || [];
    bucket.push(entry);
    grouped.set(key, bucket);
  }

  return Object.fromEntries(VIDEO_ANALYSIS_HEADINGS.map(definition => {
    const entriesForCollection = grouped.get(definition.workspaceCollection) || [];
    const logicalExports = new Set(entriesForCollection.map(entry => (
      `${clean(entry?.textHash)}@${clean(entry?.destinationPath)}`
    )));
    const newest = [...entriesForCollection].sort((a, b) => clean(b?.savedAt).localeCompare(clean(a?.savedAt)))[0] || null;
    return [definition.workspaceCollection, {
      exported: entriesForCollection.length > 0,
      logicalCount: logicalExports.size,
      exportedAt: newest?.savedAt || null,
      destinationPath: newest?.destinationPath || null,
    }];
  }));
}

export function selectContentRoutingState({
  source = {},
  persistedSource = {},
  items = [],
  topics = [],
  availabilityByCollection = {},
  obsidianByCollection = {},
  classification = {},
  obsidian = {},
  persistedOnly = false,
} = {}) {
  const sourceItems = Array.isArray(items) ? items : [];
  const metadata = sourceItems.map(readContentRoutingMetadata).filter(Boolean);
  const persistedVideoIds = unique(metadata.map(entry => entry.sourceVideoId));
  const sourceVideoId = persistedOnly
    ? persistedVideoIds[0] || null
    : clean(source.sourceVideoId) || persistedVideoIds[0] || null;
  const relevantItems = persistedOnly
    ? sourceItems
    : sourceVideoId
      ? sourceItems.filter(item => sourceVideoIdForItem(item) === sourceVideoId)
      : sourceItems;
  const relevantMetadata = metadata.filter(entry => !sourceVideoId || entry.sourceVideoId === sourceVideoId);

  const persistedTopicIds = unique(relevantMetadata.map(entry => entry.primaryTopicId));
  const persistedSubtopicIds = unique(relevantMetadata.map(entry => entry.organizationalSubtopicId));
  const primaryTopicId = persistedOnly
    ? persistedTopicIds[0] || null
    : clean(classification.primaryTopicId) || persistedTopicIds[0] || null;
  const organizationalSubtopicId = persistedOnly
    ? persistedSubtopicIds[0] || null
    : clean(classification.organizationalSubtopicId) || persistedSubtopicIds[0] || null;
  const primaryTopic = findTopic(topics, primaryTopicId);
  const organizationalSubtopic = findTopic(topics, organizationalSubtopicId);
  const parentId = clean(organizationalSubtopic?.parentId || organizationalSubtopic?.parentTopicId);
  const classificationValid = Boolean(
    primaryTopic
    && !clean(primaryTopic.parentId || primaryTopic.parentTopicId)
    && (!organizationalSubtopicId || (organizationalSubtopic && parentId === primaryTopicId))
    && persistedTopicIds.length <= 1
    && persistedSubtopicIds.length <= 1
  );

  const collections = VIDEO_ANALYSIS_HEADINGS.map(definition => {
    const records = relevantItems.filter(item => getWorkspaceNavigationCollectionForItem(item) === definition.workspaceCollection);
    const logicalKeys = new Set(records.map(collectionLogicalKey));
    const externalAvailability = availabilityByCollection[definition.workspaceCollection] || {};
    const obsidianStatus = obsidianByCollection[definition.workspaceCollection] || {};
    const logicalItemCount = persistedOnly
      ? logicalKeys.size
      : Number.isFinite(externalAvailability.logicalItemCount)
        ? externalAvailability.logicalItemCount
        : logicalKeys.size;
    return {
      sourceTabId: definition.sourceTabId,
      collectionKey: definition.workspaceCollection,
      label: definition.label,
      icon: definition.icon,
      available: persistedOnly ? records.length > 0 : Boolean(externalAvailability.available ?? logicalItemCount > 0),
      logicalItemCount,
      workspaceSaved: records.length > 0,
      workspaceLogicalCount: logicalKeys.size,
      workspaceSavedAt: latestIso(records.map(item => item.savedAt || item.createdAt || item.updatedAt)),
      obsidianExported: Boolean(obsidianStatus.exported),
      obsidianLogicalCount: Number(obsidianStatus.logicalCount || 0),
      obsidianExportedAt: obsidianStatus.exportedAt || null,
      validation: 'valid',
    };
  });

  const firstItem = relevantItems[0] || {};
  const sourceFields = persistedOnly ? persistedSource : source;
  const sourceSnapshot = {
    videoId: sourceVideoId,
    title: clean(sourceFields.title || firstItem.sourceVideoTitle || firstItem.videoTitle) || 'סרטון ללא כותרת',
    channel: clean(sourceFields.channel || firstItem.channelName) || 'ערוץ לא ידוע',
    thumbnail: clean(sourceFields.thumbnail || firstItem.thumbnail) || null,
    analysisStatus: persistedOnly ? 'נתוני ניתוב שמורים' : clean(source.analysisStatus) || 'ניתוח זמין',
    availableCollectionCount: collections.filter(collection => collection.available).length,
  };

  const result = {
    version: CONTENT_ROUTING_VERSION,
    persistedOnly: Boolean(persistedOnly),
    source: sourceSnapshot,
    classification: {
      primaryTopicId,
      primaryTopicName: primaryTopic?.name || (!persistedOnly ? classification.primaryTopicName : null) || null,
      organizationalSubtopicId,
      organizationalSubtopicName: organizationalSubtopic?.name || (!persistedOnly ? classification.organizationalSubtopicName : null) || null,
      recommended: persistedOnly ? null : (classification.recommended || null),
      confidence: persistedOnly ? null : (classification.confidence ?? null),
      valid: classificationValid,
      error: classificationValid ? null : 'canonical-taxonomy-destination-invalid',
    },
    collections,
    workspace: {
      saved: relevantItems.length > 0,
      logicalItemCount: new Set(relevantItems.map(collectionLogicalKey)).size,
      recordCount: relevantItems.length,
      lastSavedAt: latestIso(relevantItems.map(item => item.savedAt || item.createdAt || item.updatedAt)),
    },
    obsidian: {
      vaultName: clean(obsidian.vaultName) || null,
      folderPath: clean(obsidian.folderPath) || null,
      filePath: clean(obsidian.filePath) || null,
      exportedPath: clean(obsidian.exportedPath) || null,
      exportedAt: clean(obsidian.exportedAt) || latestIso(collections.map(collection => collection.obsidianExportedAt)),
      exported: Boolean(clean(obsidian.exportedPath) || collections.some(collection => collection.obsidianExported)),
      openUrl: clean(obsidian.openUrl) || null,
    },
    provenance: {
      persistedRecordIds: relevantItems.map(item => item?.id).filter(Boolean),
      metadataRecordCount: relevantMetadata.length,
      legacyMetadataCount: relevantMetadata.filter(entry => entry.legacy).length,
    },
  };

  return result;
}
