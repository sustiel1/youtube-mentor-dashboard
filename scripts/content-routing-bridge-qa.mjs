#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  VIDEO_ANALYSIS_HEADINGS,
  createWorkspaceProvenance,
} from '../src/config/workspaceHeadingRegistry.js';
import {
  CONTENT_ROUTING_VERSION,
  createContentRoutingMetadata,
  isJsonSafeContentRouting,
  readContentRoutingMetadata,
  selectContentRoutingState,
  selectObsidianCollectionStatuses,
} from '../src/utils/contentRouting.js';
import {
  CANONICAL_MARKET_TOPIC_ID,
  CANONICAL_MORNING_EVENING_BRIEF_SUBTOPIC_NAME,
  TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
  prepareWorkspaceItemForSave,
  resolveCanonicalBriefDestination,
} from '../src/utils/workspaceBriefRouting.js';
import { getWorkspaceLibraryUrl, resolveWorkspaceLibraryLocation } from '../src/lib/workspaceLibraryRoute.js';
import { getVirtualNavigationPathForCanonicalDestination } from '../src/utils/workspaceVirtualTaxonomy.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();

const subtopicId = 'wt-brief-real-id-fixture';
const topics = [
  { id: CANONICAL_MARKET_TOPIC_ID, name: 'שוק ההון', parentId: null },
  { id: subtopicId, name: CANONICAL_MORNING_EVENING_BRIEF_SUBTOPIC_NAME, parentId: CANONICAL_MARKET_TOPIC_ID },
];
localStorage.setItem('workspace_topics_v1', JSON.stringify(topics));
localStorage.setItem('workspace_library_v1', '[]');

assert.equal(VIDEO_ANALYSIS_HEADINGS.length, 7);
assert.equal(new Set(VIDEO_ANALYSIS_HEADINGS.map(item => item.sourceTabId)).size, 7);
assert.equal(new Set(VIDEO_ANALYSIS_HEADINGS.map(item => item.workspaceCollection)).size, 7);

const destination = resolveCanonicalBriefDestination(topics);
assert.equal(destination.valid, true);
assert.equal(destination.topicId, CANONICAL_MARKET_TOPIC_ID);
assert.equal(destination.subTopicId, subtopicId);
assert.deepEqual(
  getVirtualNavigationPathForCanonicalDestination(destination.topicId, destination.subTopicId, topics),
  { topicId: 'vt-markets', subtopicId: `cts-${subtopicId}` },
);

const provenance = createWorkspaceProvenance({
  sourceVideoId: TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
  sourceTabId: 'summary',
  sourceSectionId: 'thirty-second-summary',
  sourceHeading: 'סיכום ב־30 שניות',
  workspaceCollection: 'summary',
});
const item = {
  id: 'routing-fixture-summary',
  itemType: 'snippet',
  identityPayload: { text: 'תוכן שמור בלבד' },
  notes: 'תוכן שמור בלבד',
  sourceVideoTitle: 'לייב פתיחה - הבוקר של הדלק המיצר ואנבידיה',
  channelName: 'Micha.Stocks',
  topicId: CANONICAL_MARKET_TOPIC_ID,
  subTopicId: subtopicId,
  sourceVideoType: 'morningBrief',
  savedAt: '2026-08-11T12:00:00.000Z',
  ...provenance,
};

const prepared = prepareWorkspaceItemForSave(item, topics);
assert.equal(prepared.ok, true);
assert.equal(prepared.item.contentRouting.version, CONTENT_ROUTING_VERSION);
assert.equal(prepared.item.contentRouting.collectionKey, 'summary');
assert.equal(prepared.item.contentRouting.primaryTopicId, CANONICAL_MARKET_TOPIC_ID);
assert.equal(prepared.item.contentRouting.organizationalSubtopicId, subtopicId);
assert.equal('workspaceSaved' in prepared.item.contentRouting, false, 'pre-save metadata must not claim persistence success');
assert.equal('obsidianExported' in prepared.item.contentRouting, false, 'Workspace metadata must not claim Obsidian success');
assert.equal(isJsonSafeContentRouting(prepared.item.contentRouting), true);
assert.deepEqual(JSON.parse(JSON.stringify(prepared.item.contentRouting)), prepared.item.contentRouting);

const legacyMetadata = readContentRoutingMetadata(item);
assert.equal(legacyMetadata.legacy, true);
assert.equal(legacyMetadata.sourceVideoId, TARGET_MORNING_EVENING_BRIEF_VIDEO_ID);
assert.equal(createContentRoutingMetadata({ title: 'ambiguous Hebrew only' }), null);

const availability = Object.fromEntries(VIDEO_ANALYSIS_HEADINGS.map((definition, index) => [
  definition.workspaceCollection,
  { available: index < 3, logicalItemCount: index < 3 ? index + 1 : 0 },
]));
const liveState = selectContentRoutingState({
  source: {
    sourceVideoId: TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
    title: item.sourceVideoTitle,
    channel: item.channelName,
    analysisStatus: 'ניתוח מלא זמין',
  },
  items: [prepared.item],
  topics,
  availabilityByCollection: availability,
  classification: {
    primaryTopicId: destination.topicId,
    organizationalSubtopicId: destination.subTopicId,
    confidence: 99,
  },
});
assert.equal(liveState.collections.length, 7);
assert.equal(liveState.collections.find(row => row.collectionKey === 'summary').workspaceSaved, true);
assert.equal(liveState.collections.find(row => row.collectionKey === 'chapters').workspaceSaved, false);
assert.equal(liveState.obsidian.exported, false);

const scopedLegacyUrlItem = {
  id: 'legacy-url-only-summary',
  itemType: 'snippet',
  identityPayload: { text: 'legacy URL-only saved content' },
  sourceTab: 'summary',
  workspaceCollection: 'summary',
  videoUrl: `https://www.youtube.com/watch?v=${TARGET_MORNING_EVENING_BRIEF_VIDEO_ID}`,
  topicId: CANONICAL_MARKET_TOPIC_ID,
  subTopicId: subtopicId,
  savedAt: '2026-08-11T11:00:00.000Z',
};
assert.equal(readContentRoutingMetadata(scopedLegacyUrlItem).sourceVideoId, TARGET_MORNING_EVENING_BRIEF_VIDEO_ID);
const liveStateWithLegacyUrl = selectContentRoutingState({
  source: { sourceVideoId: TARGET_MORNING_EVENING_BRIEF_VIDEO_ID },
  items: [prepared.item, scopedLegacyUrlItem],
  topics,
  classification: { primaryTopicId: CANONICAL_MARKET_TOPIC_ID, organizationalSubtopicId: subtopicId },
});
assert.equal(liveStateWithLegacyUrl.collections.find(row => row.collectionKey === 'summary').workspaceLogicalCount, 2);
const workspaceOnly = selectContentRoutingState({
  source: { title: 'UNSAVED LIVE ANALYSIS MUST NOT RENDER', sourceVideoId: 'wrong-live-id' },
  persistedSource: { title: item.sourceVideoTitle, channel: item.channelName },
  items: [prepared.item, scopedLegacyUrlItem],
  topics,
  availabilityByCollection: Object.fromEntries(VIDEO_ANALYSIS_HEADINGS.map(definition => [definition.workspaceCollection, { available: true, logicalItemCount: 999 }])),
  classification: { primaryTopicId: 'wrong-live-topic' },
  persistedOnly: true,
});
assert.equal(workspaceOnly.source.videoId, TARGET_MORNING_EVENING_BRIEF_VIDEO_ID);
assert.equal(workspaceOnly.source.title, item.sourceVideoTitle);
assert.equal(workspaceOnly.source.title.includes('UNSAVED'), false);
assert.equal(workspaceOnly.classification.primaryTopicId, CANONICAL_MARKET_TOPIC_ID);
assert.equal(workspaceOnly.collections.find(row => row.collectionKey === 'chapters').available, false);
assert.equal(workspaceOnly.collections.find(row => row.collectionKey === 'summary').workspaceLogicalCount, 2);
assert.deepEqual(workspaceOnly.provenance.persistedRecordIds, [item.id, scopedLegacyUrlItem.id]);

const noExport = selectObsidianCollectionStatuses([]);
assert.equal(noExport.summary.exported, false);
const verifiedExportEntries = [{
  videoId: TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
  tabKey: 'summary',
  sectionKey: 'thirty-second-summary',
  textHash: 'abc',
  destinationPath: 'שוק ההון/מבזק בוקר-ערב/video.md',
  savedAt: '2026-08-11T13:00:00.000Z',
}];
const exportStatus = selectObsidianCollectionStatuses(verifiedExportEntries);
assert.equal(exportStatus.summary.exported, true);
assert.equal(exportStatus.insights.exported, false);
const obsidianState = selectContentRoutingState({
  items: [prepared.item], topics, persistedOnly: true,
  obsidianByCollection: exportStatus,
  obsidian: {
    vaultName: 'Verified Vault',
    exportedPath: verifiedExportEntries[0].destinationPath,
    exportedAt: verifiedExportEntries[0].savedAt,
  },
});
assert.equal(obsidianState.obsidian.exported, true);
assert.equal(obsidianState.workspace.saved, true);
assert.equal(obsidianState.collections.find(row => row.collectionKey === 'summary').obsidianExported, true);
assert.equal(obsidianState.collections.find(row => row.collectionKey === 'summary').workspaceSaved, true);
assert.equal(selectContentRoutingState({ items: [prepared.item], topics, persistedOnly: true }).obsidian.filePath, null, 'invalid or absent Obsidian paths are not invented');

const canonicalUrl = getWorkspaceLibraryUrl({
  video: TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
  topicId: CANONICAL_MARKET_TOPIC_ID,
  subtopicId,
  collection: 'topics',
});
assert.match(canonicalUrl, /^\/workspace-library\?/);
assert.equal(canonicalUrl.includes('/null'), false);
assert.equal(resolveWorkspaceLibraryLocation('/null', '').canonicalUrl, '/workspace-library');

const { saveWorkspaceItem, getWorkspaceItems } = await import('../src/lib/workspaceLibraryStore.js');
const firstSave = saveWorkspaceItem(item);
assert.equal(firstSave.ok, true);
assert.equal(firstSave.item.contentRouting.version, CONTENT_ROUTING_VERSION);
assert.equal(getWorkspaceItems().length, 1);
const duplicateSave = saveWorkspaceItem({ ...item, id: 'routing-fixture-duplicate' });
assert.equal(duplicateSave.status, 'already_exists');
assert.equal(getWorkspaceItems().length, 1);

console.log('Content routing bridge QA: 48 assertions passed');
