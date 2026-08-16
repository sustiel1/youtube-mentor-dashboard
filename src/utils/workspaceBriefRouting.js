import { detectVideoType, normalizeSubCategory } from '../config/videoTabsConfig.js';
import {
  getWorkspaceCollectionForItem,
  getWorkspaceNavigationCollectionForItem,
} from '../config/workspaceHeadingRegistry.js';
import { getWorkspaceItemIdentity, getWorkspaceSourceVideoId } from './workspaceItemIdentity.js';
import { attachContentRoutingMetadata } from './contentRouting.js';

export const CANONICAL_MARKET_TOPIC_ID = 'wt-markets';
export const CANONICAL_MORNING_EVENING_BRIEF_SUBTOPIC_NAME = 'מבזק בוקר/ערב';
export const TARGET_MORNING_EVENING_BRIEF_VIDEO_ID = 'KOom2PCpl6Q';

export const WORKSPACE_TOPIC_ASSIGNMENT_FIELDS = Object.freeze([
  'topicId',
  'subTopicId',
  'subtopicId',
  'topicName',
  'subTopicName',
  'subtopicName',
  'category',
  'subCategory',
]);

const CONFIRMED_BRIEF_TYPES = new Set(['morningBrief', 'eveningBrief']);
const CONFIRMED_BRIEF_SLUGS = new Map([
  ['morning-brief', 'morningBrief'],
  ['evening-brief', 'eveningBrief'],
]);

function clean(value) {
  return String(value ?? '').trim();
}

function extractYoutubeVideoId(value) {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return clean(url.pathname.split('/').filter(Boolean)[0]) || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return clean(url.searchParams.get('v')) || null;
      if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/live/')) return clean(url.pathname.split('/')[2]) || null;
    }
  } catch { /* invalid URL — not a reliable video identity */ }
  return null;
}

function sourceVideoIdForItem(item = {}) {
  return getWorkspaceSourceVideoId(item)
    || extractYoutubeVideoId(item.videoUrl || item.sourceUrl || item.youtubeUrl);
}

function getVideoContentType(video = {}) {
  return clean(video.contentType || video.analysis?.contentType || video.marketBriefData?.contentType);
}

/**
 * Uses the application's existing brief classifier. Structured fields are
 * recorded as evidence; the classifier's audited aliases remain the final
 * compatibility fallback.
 */
export function classifyCanonicalWorkspaceBrief({ video = {}, item = {} } = {}) {
  const persistedType = clean(item.sourceVideoType || item.briefType);
  if (CONFIRMED_BRIEF_TYPES.has(persistedType)) {
    return { confirmed: true, type: persistedType, evidence: [`sourceVideoType:${persistedType}`] };
  }

  const persistedSlug = normalizeSubCategory(item.sourceBriefSlug || item.briefSlug);
  if (CONFIRMED_BRIEF_SLUGS.has(persistedSlug)) {
    return { confirmed: true, type: CONFIRMED_BRIEF_SLUGS.get(persistedSlug), evidence: [`sourceBriefSlug:${persistedSlug}`] };
  }

  const confirmedSubCategory = normalizeSubCategory(video.confirmedSubCategory);
  if (CONFIRMED_BRIEF_SLUGS.has(confirmedSubCategory)) {
    return { confirmed: true, type: CONFIRMED_BRIEF_SLUGS.get(confirmedSubCategory), evidence: [`confirmedSubCategory:${confirmedSubCategory}`] };
  }

  const subCategory = normalizeSubCategory(video.subCategory || video.subTopic);
  if (CONFIRMED_BRIEF_SLUGS.has(subCategory)) {
    return { confirmed: true, type: CONFIRMED_BRIEF_SLUGS.get(subCategory), evidence: [`subCategory:${subCategory}`] };
  }

  const detectedType = detectVideoType(video);
  if (!CONFIRMED_BRIEF_TYPES.has(detectedType)) {
    return { confirmed: false, type: detectedType || 'general', evidence: ['canonicalClassifier:non-brief'] };
  }

  const contentType = getVideoContentType(video);
  const evidence = [];
  if (contentType) evidence.push(`contentType:${contentType}`);
  evidence.push(`canonicalClassifier:${detectedType}`);
  return { confirmed: true, type: detectedType, evidence };
}

export function resolveCanonicalBriefDestination(topics = []) {
  const marketMatches = topics.filter(topic => topic?.id === CANONICAL_MARKET_TOPIC_ID);
  const briefMatches = topics.filter(topic => (
    clean(topic?.name).replace(/\s+/g, ' ') === CANONICAL_MORNING_EVENING_BRIEF_SUBTOPIC_NAME
    && (topic?.parentId || topic?.parentTopicId || null) === CANONICAL_MARKET_TOPIC_ID
  ));
  const market = marketMatches.length === 1 ? marketMatches[0] : null;
  const brief = briefMatches.length === 1 ? briefMatches[0] : null;
  const valid = Boolean(
    market && !(market.parentId || market.parentTopicId) &&
    brief && (brief.parentId || brief.parentTopicId) === CANONICAL_MARKET_TOPIC_ID &&
    brief.id !== market.id
  );
  return {
    valid,
    topicId: valid ? market.id : null,
    subTopicId: valid ? brief.id : null,
    topicName: valid ? market.name : null,
    subTopicName: valid ? brief.name : null,
    error: valid ? null : (
      marketMatches.length !== 1
        ? 'canonical-market-topic-not-unique'
        : briefMatches.length !== 1
          ? 'canonical-brief-subtopic-not-unique'
          : 'canonical-brief-destination-unavailable'
    ),
  };
}

export function getWorkspaceTopicAssignment(destination) {
  return {
    topicId: destination.topicId,
    subTopicId: destination.subTopicId,
    subtopicId: destination.subTopicId,
    topicName: destination.topicName,
    subTopicName: destination.subTopicName,
    subtopicName: destination.subTopicName,
    category: destination.topicName,
    subCategory: destination.subTopicName,
  };
}

function stripWorkspaceTopicAssignment(item = {}) {
  const copy = { ...item };
  WORKSPACE_TOPIC_ASSIGNMENT_FIELDS.forEach(field => delete copy[field]);
  return copy;
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function checksumWorkspacePayloadsExcludingTopicAssignment(items = []) {
  return fnv1a(JSON.stringify((Array.isArray(items) ? items : []).map(stripWorkspaceTopicAssignment)));
}

export function selectTargetedWorkspaceVideoRoutingPreview({
  items = [],
  topics = [],
  sourceVideoId = TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
} = {}) {
  const source = Array.isArray(items) ? items : [];
  const normalizedSourceVideoId = clean(sourceVideoId);
  const destination = resolveCanonicalBriefDestination(topics);
  const targetItems = source.filter(item => sourceVideoIdForItem(item) === normalizedSourceVideoId);
  const logicalVideoKeys = [...new Set(targetItems.map(sourceVideoIdForItem).filter(Boolean))];
  const collectionGroupsById = new Map();
  targetItems.forEach(item => {
    const collection = getWorkspaceNavigationCollectionForItem(item);
    const current = collectionGroupsById.get(collection) || {
      collection,
      recordIds: [],
      logicalContentKeys: new Set(),
    };
    current.recordIds.push(item?.id || null);
    current.logicalContentKeys.add(getWorkspaceItemIdentity(item)?.key || `record:${item?.id || current.recordIds.length}`);
    collectionGroupsById.set(collection, current);
  });
  const collectionGroups = [...collectionGroupsById.values()].map(group => ({
    collection: group.collection,
    physicalRecordCount: group.recordIds.length,
    uniqueLogicalContentCount: group.logicalContentKeys.size,
    recordIds: group.recordIds,
  }));
  const rows = targetItems.map(item => ({
    itemId: item?.id || null,
    sourceVideoId: sourceVideoIdForItem(item),
    videoTitle: item?.sourceVideoTitle || item?.sourceTitle || item?.videoTitle || item?.title || '',
    existingTopicId: item?.topicId || null,
    existingSubtopicId: item?.subTopicId || item?.subtopicId || null,
    proposedTopicId: destination.valid ? destination.topicId : null,
    proposedSubtopicId: destination.valid ? destination.subTopicId : null,
    wouldChange: Boolean(destination.valid && (
      item?.topicId !== destination.topicId
      || (item?.subTopicId || item?.subtopicId || null) !== destination.subTopicId
    )),
  }));
  const safe = Boolean(
    normalizedSourceVideoId
    && destination.valid
    && logicalVideoKeys.length === 1
    && logicalVideoKeys[0] === normalizedSourceVideoId
    && rows.length > 0
    && rows.every(row => row.itemId)
  );

  return {
    sourceVideoId: normalizedSourceVideoId,
    rows,
    collectionGroups,
    recordIds: rows.map(row => row.itemId),
    physicalRecordCount: rows.length,
    logicalVideoCount: logicalVideoKeys.length,
    proposedChangeCount: rows.filter(row => row.wouldChange).length,
    destination,
    payloadChecksum: checksumWorkspacePayloadsExcludingTopicAssignment(source),
    safe,
    error: safe ? null : destination.error || 'target-video-group-not-unique',
  };
}

export function buildWorkspaceVideoRoutingBackup({
  topics = [],
  items = [],
  sourceVideoId = TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
  createdAt = new Date().toISOString(),
} = {}) {
  const preview = selectTargetedWorkspaceVideoRoutingPreview({ items, topics, sourceVideoId });
  if (!preview.safe) throw new Error(`Targeted Workspace routing backup is unsafe: ${preview.error}`);
  const payload = {
    schemaVersion: 1,
    createdAt,
    operation: 'targeted-workspace-video-topic-reassignment',
    sourceVideoId: preview.sourceVideoId,
    workspaceItemCount: items.length,
    workspaceItemIds: items.map(item => item?.id).filter(Boolean),
    payloadChecksum: preview.payloadChecksum,
    taxonomy: topics,
    destination: preview.destination,
    targetRecordIds: preview.recordIds,
    targetRecords: items.filter(item => preview.recordIds.includes(item?.id)),
  };
  const serialized = JSON.stringify(payload, null, 2);
  const parsed = JSON.parse(serialized);
  if (
    parsed.sourceVideoId !== preview.sourceVideoId
    || parsed.workspaceItemCount !== items.length
    || parsed.targetRecords.length !== preview.physicalRecordCount
    || parsed.targetRecordIds.some((id, index) => id !== preview.recordIds[index])
    || !Array.isArray(parsed.taxonomy)
  ) {
    throw new Error('The targeted Workspace routing backup could not be verified.');
  }
  const safeTimestamp = String(createdAt).replace(/[:.]/g, '-');
  return {
    filename: `workspace-video-routing-backup-${preview.sourceVideoId}-${safeTimestamp}.json`,
    payload: parsed,
    serialized,
  };
}

/** Pure preparation step used by the Workspace persistence boundary. */
export function prepareWorkspaceItemForSave(item = {}, topics = []) {
  const classification = classifyCanonicalWorkspaceBrief({ item });
  if (!classification.confirmed) {
    return {
      ok: true,
      item: attachContentRoutingMetadata(item),
      routed: false,
      classification,
    };
  }

  const destination = resolveCanonicalBriefDestination(topics);
  if (!destination.valid) return { ok: false, item: { ...item }, routed: false, classification, destination };

  const routedItem = {
    ...item,
    ...getWorkspaceTopicAssignment(destination),
    sourceVideoType: classification.type,
    briefRoutingEvidence: [...classification.evidence],
  };
  return {
    ok: true,
    routed: true,
    classification,
    destination,
    item: attachContentRoutingMetadata(routedItem),
  };
}

function buildVideoLookup(videos = []) {
  const lookup = new Map();
  for (const video of videos) {
    for (const candidate of [
      video?.youtubeId,
      video?.videoId,
      video?._videoId,
      video?.youtube_id,
      extractYoutubeVideoId(video?.url || video?.youtubeUrl),
      video?.id,
    ]) {
      const id = clean(candidate);
      if (id && !lookup.has(id)) lookup.set(id, video);
    }
  }
  return lookup;
}

/**
 * Read-only preview for existing records. Ambiguous heading classifications are
 * deliberately left unchanged even when their source video is a brief.
 */
export function selectWorkspaceBriefRoutingPreview(items = [], videos = [], topics = []) {
  const source = Array.isArray(items) ? items : [];
  const before = JSON.stringify(source);
  const videoLookup = buildVideoLookup(videos);
  const destination = resolveCanonicalBriefDestination(topics);
  const rows = source.map(item => {
    const sourceVideoId = sourceVideoIdForItem(item);
    const video = sourceVideoId ? videoLookup.get(sourceVideoId) || {} : {};
    const classification = classifyCanonicalWorkspaceBrief({ video, item });
    const workspaceCollection = getWorkspaceCollectionForItem(item, 'unclassified');
    const headingConfirmed = workspaceCollection !== 'unclassified';
    const confirmed = classification.confirmed && headingConfirmed && destination.valid;
    return {
      itemId: item?.id || null,
      sourceVideoId,
      videoTitle: video?.title || item?.sourceVideoTitle || item?.sourceTitle || item?.videoTitle || '',
      confirmedBriefType: classification.confirmed ? classification.type : null,
      existingTopicId: item?.topicId || null,
      existingSubtopicId: item?.subTopicId || item?.subtopicId || null,
      proposedTopicId: confirmed ? destination.topicId : (item?.topicId || null),
      proposedSubtopicId: confirmed ? destination.subTopicId : (item?.subTopicId || item?.subtopicId || null),
      existingSourceTabId: item?.sourceTabId || item?.sourceTab || null,
      existingSourceSectionId: item?.sourceSectionId || null,
      proposedWorkspaceCollection: workspaceCollection,
      evidence: [...classification.evidence, headingConfirmed ? `workspaceCollection:${workspaceCollection}` : 'workspaceCollection:ambiguous'],
      confidence: confirmed ? 'confirmed' : 'ambiguous',
      wouldChange: Boolean(confirmed && (
        item?.topicId !== destination.topicId ||
        (item?.subTopicId || item?.subtopicId || null) !== destination.subTopicId
      )),
    };
  });

  return {
    rows,
    itemCount: rows.length,
    confirmedCount: rows.filter(row => row.confidence === 'confirmed').length,
    ambiguousCount: rows.filter(row => row.confidence === 'ambiguous').length,
    proposedChangeCount: rows.filter(row => row.wouldChange).length,
    destination,
    sourceUnchanged: JSON.stringify(source) === before,
  };
}
