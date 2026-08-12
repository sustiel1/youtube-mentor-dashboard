#!/usr/bin/env node
import assert from 'node:assert/strict';
import { detectVideoType } from '../src/config/videoTabsConfig.js';
import { VIDEO_ANALYSIS_HEADINGS, createWorkspaceProvenance, getWorkspaceCollectionForItem } from '../src/config/workspaceHeadingRegistry.js';
import {
  CANONICAL_MARKET_TOPIC_ID,
  CANONICAL_MORNING_EVENING_BRIEF_SUBTOPIC_NAME,
  TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
  buildWorkspaceVideoRoutingBackup,
  checksumWorkspacePayloadsExcludingTopicAssignment,
  classifyCanonicalWorkspaceBrief,
  prepareWorkspaceItemForSave,
  resolveCanonicalBriefDestination,
  selectTargetedWorkspaceVideoRoutingPreview,
  selectWorkspaceBriefRoutingPreview,
} from '../src/utils/workspaceBriefRouting.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();

const {
  WORKSPACE_PERSISTENCE_ERROR_CODES,
  getWorkspaceItems,
  reassignWorkspaceVideoGroupTopic,
  saveWorkspaceItem,
} = await import('../src/lib/workspaceLibraryStore.js');

const BRIEF_SUBTOPIC_ID = 'cts-wt-brief-fixture';

const topics = [
  { id: CANONICAL_MARKET_TOPIC_ID, name: 'שוק ההון', parentId: null },
  { id: BRIEF_SUBTOPIC_ID, name: CANONICAL_MORNING_EVENING_BRIEF_SUBTOPIC_NAME, parentId: CANONICAL_MARKET_TOPIC_ID },
  { id: 'wt-general', name: 'כללי', parentId: null },
];
localStorage.setItem('workspace_topics_v1', JSON.stringify(topics));
localStorage.setItem('workspace_library_v1', '[]');

assert.equal(detectVideoType({ title: 'Late Night closing bell' }), 'eveningBrief');
assert.equal(detectVideoType({ title: 'לייט נייט דיווחים' }), 'eveningBrief');
assert.equal(detectVideoType({ confirmedSubCategory: 'מבזק ערב', contentType: 'marketBrief' }), 'eveningBrief');
assert.equal(detectVideoType({ title: 'מבזק לייב פתיחה לתאריך 11.8.26' }), 'morningBrief');

const destination = resolveCanonicalBriefDestination(topics);
assert.equal(destination.valid, true);
assert.equal(destination.topicId, CANONICAL_MARKET_TOPIC_ID);
assert.equal(destination.subTopicId, BRIEF_SUBTOPIC_ID);

function savedSnippet({ id, videoId, sourceTabId, sectionId, heading, text, sourceVideoType, topicId = 'wt-general' }) {
  return {
    id,
    videoId: null,
    sourceVideoTitle: `וידאו ${videoId}`,
    videoTitle: `${heading} — וידאו ${videoId}`,
    topicId,
    subTopicId: null,
    notes: text,
    itemType: 'snippet',
    identityPayload: { text },
    savedAt: '2026-08-11T08:00:00.000Z',
    sourceTab: sourceTabId,
    sourceVideoType,
    ...createWorkspaceProvenance({
      sourceVideoId: videoId,
      sourceTabId,
      sourceSectionId: sectionId,
      sourceHeading: heading,
    }),
  };
}

const morning = savedSnippet({
  id: 'morning-1', videoId: 'morning-video', sourceTabId: 'summary',
  sectionId: 'thirty-second-summary', heading: 'סיכום ב־30 שניות', text: 'תוכן בוקר שמור', sourceVideoType: 'morningBrief',
});
assert.equal(getWorkspaceCollectionForItem(morning), 'summary');
assert.equal(JSON.parse(JSON.stringify(morning)).sourceSectionId, 'thirty-second-summary');

const morningResult = saveWorkspaceItem(morning);
assert.equal(morningResult.ok, true);
assert.equal(morningResult.item.topicId, CANONICAL_MARKET_TOPIC_ID);
assert.equal(morningResult.item.subTopicId, BRIEF_SUBTOPIC_ID);
assert.equal(morningResult.item.sourceTabId, 'summary');
assert.equal(morningResult.item.sourceSectionId, 'thirty-second-summary');

const duplicateResult = saveWorkspaceItem({ ...morning, id: 'morning-copy', savedAt: '2026-08-11T09:00:00.000Z' });
assert.equal(duplicateResult.status, 'already_exists');
assert.equal(getWorkspaceItems().length, 1);

const evening = savedSnippet({
  id: 'evening-1', videoId: 'evening-video', sourceTabId: 'insights',
  sectionId: 'key-insights', heading: 'תובנות מרכזיות', text: 'תוכן ערב שמור', sourceVideoType: 'eveningBrief',
});
const eveningResult = saveWorkspaceItem(evening);
assert.equal(eveningResult.item.topicId, CANONICAL_MARKET_TOPIC_ID);
assert.equal(eveningResult.item.subTopicId, BRIEF_SUBTOPIC_ID);
assert.equal(eveningResult.item.workspaceCollection, 'insights');

const ordinary = savedSnippet({
  id: 'ordinary-1', videoId: 'ordinary-video', sourceTabId: 'useful-knowledge',
  sectionId: 'checklist', heading: 'צ׳קליסט פעולה', text: 'תוכן רגיל שמור', sourceVideoType: 'learning',
});
const ordinaryResult = saveWorkspaceItem(ordinary);
assert.equal(ordinaryResult.item.topicId, 'wt-general');
assert.equal(ordinaryResult.item.subTopicId, null);
assert.equal(ordinaryResult.item.workspaceCollection, 'knowledge');

const independent = prepareWorkspaceItemForSave({
  ...evening,
  topicId: 'old-topic',
  subTopicId: 'old-subtopic',
  sourceTabId: 'insights',
  sourceSectionId: 'key-insights',
  workspaceCollection: 'insights',
}, topics);
assert.equal(independent.item.topicId, CANONICAL_MARKET_TOPIC_ID);
assert.equal(independent.item.subTopicId, BRIEF_SUBTOPIC_ID);
assert.equal(independent.item.sourceTabId, 'insights');
assert.equal(independent.item.sourceSectionId, 'key-insights');
assert.equal(independent.item.workspaceCollection, 'insights');

const beforePreviewItems = [
  { ...morning, id: 'legacy-brief', topicId: 'wt-general', subTopicId: null, sourceVideoType: null },
  { id: 'ambiguous', videoId: null, videoTitle: 'מבזק בוקר לפי כותרת בלבד', notes: 'נגיש אך עמום' },
  {
    id: 'url-brief', videoId: null, videoUrl: 'https://www.youtube.com/watch?v=urlBrief123',
    sourceTab: 'insights', itemType: 'snippet', notes: 'תוכן עם URL יציב', topicId: 'wt-general',
  },
];
const beforePreviewJson = JSON.stringify(beforePreviewItems);
const preview = selectWorkspaceBriefRoutingPreview(beforePreviewItems, [
  { id: 'morning-video', contentType: 'marketBrief', title: 'סרטון מבזק מאומת' },
  { id: 'local-url-record', url: 'https://youtu.be/urlBrief123', contentType: 'marketBrief', title: 'סרטון מאומת לפי URL' },
], topics);
assert.equal(preview.itemCount, 3);
assert.equal(preview.confirmedCount, 2);
assert.equal(preview.ambiguousCount, 1);
assert.equal(preview.proposedChangeCount, 2);
assert.equal(preview.rows[0].proposedWorkspaceCollection, 'summary');
assert.equal(preview.rows[0].proposedTopicId, CANONICAL_MARKET_TOPIC_ID);
assert.equal(preview.rows[1].proposedWorkspaceCollection, 'unclassified');
assert.equal(preview.rows[2].sourceVideoId, 'urlBrief123');
assert.equal(preview.rows[2].confidence, 'confirmed');
assert.equal(preview.sourceUnchanged, true);
assert.equal(JSON.stringify(beforePreviewItems), beforePreviewJson);

const targetedItems = [
  savedSnippet({
    id: 'target-summary', videoId: TARGET_MORNING_EVENING_BRIEF_VIDEO_ID, sourceTabId: 'summary',
    sectionId: 'thirty-second-summary', heading: 'סיכום ב־30 שניות', text: 'תוכן יעד שמור', sourceVideoType: null,
  }),
  { ...morning, id: 'other-video-record', sourceVideoId: 'other-video', topicId: 'wt-general', subTopicId: null },
];
const targetedPreview = selectTargetedWorkspaceVideoRoutingPreview({ items: targetedItems, topics });
assert.equal(targetedPreview.safe, true);
assert.equal(targetedPreview.logicalVideoCount, 1);
assert.equal(targetedPreview.physicalRecordCount, 1);
assert.deepEqual(targetedPreview.recordIds, ['target-summary']);
assert.deepEqual(targetedPreview.collectionGroups, [{
  collection: 'summary',
  physicalRecordCount: 1,
  uniqueLogicalContentCount: 1,
  recordIds: ['target-summary'],
}]);
assert.equal(targetedPreview.destination.subTopicId, BRIEF_SUBTOPIC_ID);
const targetedBackup = buildWorkspaceVideoRoutingBackup({ items: targetedItems, topics, createdAt: '2026-08-11T10:00:00.000Z' });
assert.equal(JSON.parse(targetedBackup.serialized).targetRecords.length, 1);
assert.deepEqual(JSON.parse(targetedBackup.serialized).targetRecordIds, ['target-summary']);

localStorage.setItem('workspace_library_v1', JSON.stringify(targetedItems));
const targetedChecksumBefore = checksumWorkspacePayloadsExcludingTopicAssignment(targetedItems);
const targetedResult = reassignWorkspaceVideoGroupTopic({
  sourceVideoId: TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
  expectedItemIds: targetedPreview.recordIds,
  topics,
  storage: localStorage,
});
assert.equal(targetedResult.ok, true);
assert.equal(targetedResult.affectedCount, 1);
assert.equal(targetedResult.persistedItems.length, targetedItems.length);
assert.equal(targetedResult.persistedItems[0].id, 'target-summary');
assert.equal(targetedResult.persistedItems[0].subTopicId, BRIEF_SUBTOPIC_ID);
assert.equal(targetedResult.persistedItems[1].topicId, 'wt-general');
assert.equal(targetedResult.beforePayloadChecksum, targetedChecksumBefore);
assert.equal(targetedResult.afterPayloadChecksum, targetedChecksumBefore);
assert.equal(targetedResult.persistedItems[0].savedAt, targetedItems[0].savedAt);
const mismatchRaw = localStorage.getItem('workspace_library_v1');
const mismatchResult = reassignWorkspaceVideoGroupTopic({
  sourceVideoId: TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
  expectedItemIds: ['wrong-record'],
  topics,
  storage: localStorage,
});
assert.equal(mismatchResult.ok, false);
assert.equal(mismatchResult.error.code, WORKSPACE_PERSISTENCE_ERROR_CODES.TARGETED_ROUTING_ITEMS_MISMATCH);
assert.equal(localStorage.getItem('workspace_library_v1'), mismatchRaw);

assert.equal(classifyCanonicalWorkspaceBrief({ video: { title: 'סרטון רגיל' } }).confirmed, false);

const beforeTabFixtures = getWorkspaceItems().length;
for (const definition of VIDEO_ANALYSIS_HEADINGS) {
  const fixture = savedSnippet({
    id: `fixture-${definition.sourceTabId}`,
    videoId: `fixture-video-${definition.sourceTabId}`,
    sourceTabId: definition.sourceTabId,
    sectionId: `${definition.sourceTabId}-section`,
    heading: `${definition.label} — סעיף שמור`,
    text: `תוכן נבחר יחיד עבור ${definition.sourceTabId}`,
    sourceVideoType: 'learning',
  });
  const result = saveWorkspaceItem(fixture);
  assert.equal(result.ok, true, `${definition.sourceTabId} persists successfully`);
  assert.equal(result.item.workspaceCollection, definition.workspaceCollection, `${definition.sourceTabId} routes one-to-one`);
  assert.equal(result.item.sourceSectionId, `${definition.sourceTabId}-section`, `${definition.sourceTabId} preserves its internal heading`);
}
const reloadedFixtures = getWorkspaceItems();
assert.equal(reloadedFixtures.length, beforeTabFixtures + VIDEO_ANALYSIS_HEADINGS.length);
assert.equal(reloadedFixtures.filter(item => String(item.id).startsWith('fixture-')).length, VIDEO_ANALYSIS_HEADINGS.length);

const beforeInvalid = localStorage.getItem('workspace_library_v1');
localStorage.setItem('workspace_topics_v1', JSON.stringify(topics.filter(topic => topic.id !== BRIEF_SUBTOPIC_ID)));
const invalidResult = saveWorkspaceItem(savedSnippet({
  id: 'blocked-brief', videoId: 'blocked-video', sourceTabId: 'chapters',
  sectionId: 'chapters', heading: 'פרקים', text: 'אסור לשמור ללא יעד', sourceVideoType: 'morningBrief',
}));
assert.equal(invalidResult.ok, false);
assert.equal(invalidResult.error.code, WORKSPACE_PERSISTENCE_ERROR_CODES.INVALID_BRIEF_DESTINATION);
assert.equal(localStorage.getItem('workspace_library_v1'), beforeInvalid);

console.log('Workspace brief routing QA: 67 assertions passed');
