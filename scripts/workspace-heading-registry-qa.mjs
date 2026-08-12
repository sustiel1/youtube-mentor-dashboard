#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  VIDEO_ANALYSIS_HEADINGS,
  WORKSPACE_COLLECTION_HEADINGS,
  WORKSPACE_COLLECTION_IDS,
  WORKSPACE_FALLBACK_COLLECTION,
  WORKSPACE_HEADING_REGISTRY,
  classifyWorkspaceItemHeading,
  createWorkspaceProvenance,
  getWorkspaceCollectionForItem,
} from '../src/config/workspaceHeadingRegistry.js';
import { UNIVERSAL_TABS } from '../src/config/videoTabsConfig.js';
import { createWorkspaceLibraryPresentation } from '../src/utils/workspaceLibraryPresentation.js';
import {
  groupWorkspaceItemsByVideo,
  selectGlobalCollections,
  selectVideoCollections,
} from '../src/utils/workspaceVideoGrouping.js';
import { selectSavedAnalysisViewer } from '../src/utils/workspaceSavedAnalysis.js';

const expectedRegistry = [
  ['summary', 'סיכום', 'summary'],
  ['chapters', 'פרקים', 'chapters'],
  ['insights', 'תובנות', 'insights'],
  ['useful-knowledge', 'ידע שימושי', 'knowledge'],
  ['app-builder', 'APP', 'apps'],
  ['topics-subtopics', 'נושאים ותתי־נושאים', 'topics'],
  ['specialized', 'תוכן ייעודי', 'specialized'],
  ['structured-snapshot', 'תמונת מצב', 'snapshots'],
];
const expectedPrimary = expectedRegistry.slice(0, 7);

assert.deepEqual(
  Object.values(WORKSPACE_HEADING_REGISTRY).map(item => [item.sourceTabId, item.label, item.workspaceCollection]),
  expectedRegistry,
  'the registry exposes the approved one-to-one mapping',
);
assert.equal(new Set(expectedRegistry.map(([id]) => id)).size, expectedRegistry.length, 'registry source-tab IDs are unique');
assert.equal(WORKSPACE_COLLECTION_IDS.length, 7, 'Workspace exposes exactly seven primary collection IDs');
assert.equal(new Set(WORKSPACE_COLLECTION_IDS).size, expectedPrimary.length, 'Workspace primary collection IDs are unique');
assert.equal(WORKSPACE_FALLBACK_COLLECTION.label, 'פריטים נוספים', 'ambiguous records have an explicit auxiliary destination');
assert.deepEqual(
  UNIVERSAL_TABS,
  VIDEO_ANALYSIS_HEADINGS.map(item => ({ value: item.sourceTabId, label: item.label, emoji: item.icon })),
  'Video Analysis labels are derived from the canonical registry',
);
assert.deepEqual(
  WORKSPACE_COLLECTION_HEADINGS.map(item => [item.sourceTabId, item.label, item.id]),
  expectedPrimary,
  'Workspace tabs are derived from the same registry',
);

const sourceVideoId = 'KOom2PCpl6Q';
const persisted = expectedRegistry.map(([sourceTabId, label, workspaceCollection], index) => {
  const provenance = createWorkspaceProvenance({
    sourceVideoId,
    sourceTabId,
    sourceSectionId: `${sourceTabId}-section`,
    sourceHeading: `${label} — סעיף שמור`,
  });
  const item = {
    id: `saved-${index}`,
    videoId: sourceVideoId,
    videoTitle: 'סרטון בדיקה',
    savedAt: `2026-08-${String(index + 1).padStart(2, '0')}T08:00:00Z`,
    notes: `תוכן שמור ${index}`,
    itemType: sourceTabId === 'structured-snapshot' ? 'structured-snapshot' : 'snippet',
    ...(sourceTabId === 'structured-snapshot'
      ? { structuredSnapshot: { videoId: sourceVideoId, stocksTable: [], marketsTable: [], sentimentTable: [] } }
      : { identityPayload: { text: `תוכן שמור ${index}` } }),
    ...provenance,
  };
  assert.deepEqual(JSON.parse(JSON.stringify(item)).sourceTabId, sourceTabId, 'provenance survives JSON round-trip');
  assert.equal(getWorkspaceCollectionForItem(item), workspaceCollection, `${sourceTabId} saves to its matching Workspace tab`);
  return item;
});

const legacy = [
  { id: 'legacy-insight', videoId: sourceVideoId, sourceTab: 'Insights', itemType: 'snippet', notes: 'legacy insight' },
  { id: 'legacy-checklist', videoId: sourceVideoId, itemType: 'checklist', notes: 'legacy checklist' },
  { id: 'legacy-ambiguous', videoId: sourceVideoId, title: 'תובנות שנראות כמו כותרת', notes: 'ambiguous' },
  { id: 'legacy-without-video', title: 'ללא מקור יציב', notes: 'ungrouped ambiguous' },
];
assert.equal(getWorkspaceCollectionForItem(legacy[0]), 'insights', 'explicit legacy source-tab alias remains reachable');
assert.equal(getWorkspaceCollectionForItem(legacy[1]), 'knowledge', 'explicit legacy item type remains reachable');
assert.equal(getWorkspaceCollectionForItem(legacy[2]), 'unclassified', 'Hebrew title text never classifies an ambiguous item');

const topicIndependent = {
  ...persisted.find(item => item.sourceTabId === 'insights'),
  id: 'topic-independent',
  topicId: 'main-market',
  subTopicId: 'morning-brief',
};
assert.equal(classifyWorkspaceItemHeading(topicIndependent).sourceTabId, 'insights', 'topic hierarchy does not change content-tab classification');

const duplicate = { ...persisted[0], id: 'saved-summary-copy', savedAt: '2026-08-09T08:00:00Z' };
const allItems = [...persisted, ...legacy, topicIndependent, duplicate];
const originalJson = JSON.stringify(allItems);
const presentation = createWorkspaceLibraryPresentation(allItems);
assert.equal(presentation.counts.all, allItems.length, 'global presentation preserves every persisted record');
assert.equal(presentation.counts.unclassified, 2, 'ambiguous legacy items remain in the fallback collection');

const grouped = groupWorkspaceItemsByVideo(allItems);
const group = grouped.videoGroups[0];
group.marketBriefData = { summary: 'UNSAVED_ANALYSIS_MUST_NOT_RENDER' };
const globalCollections = selectGlobalCollections(grouped.videoGroups, grouped.withoutVideo);
const focusedCollections = selectVideoCollections(group);
for (const [, , collection] of expectedPrimary) {
  assert.equal(globalCollections[collection].uniqueCount, focusedCollections[collection].uniqueCount, `${collection} global/focused counts agree for one video`);
}
assert.equal(globalCollections.unclassified.recordCount, 2, 'global fallback collection includes ambiguous records with and without video identity');
assert.equal(focusedCollections.unclassified.recordCount, 1, 'focused fallback collection keeps ambiguous legacy content reachable');
assert.equal(focusedCollections.summary.recordCount, 2, 'exact duplicate records remain persisted');
assert.equal(focusedCollections.summary.uniqueCount, 1, 'exact duplicate content renders once logically');

const viewer = selectSavedAnalysisViewer(group);
for (const [sourceTabId, label, collection] of expectedPrimary) {
  assert.ok(viewer.tabs.some(tab => tab.id === collection && tab.label === label), `${sourceTabId} has the canonical Workspace tab`);
  assert.ok(viewer.byTab[collection].length >= 1, `${sourceTabId} persisted content is reachable`);
}
const snapshotSections = viewer.byTab.specialized.filter(section => section.snapshot);
assert.equal(snapshotSections.length, 1, 'Structured Snapshot is rendered inside Targeted Content');
assert.equal(snapshotSections[0].snapshot.videoId, sourceVideoId, 'Snapshot reads only its persisted structured payload');
assert.equal(viewer.byTab.unclassified.length, 1, 'ambiguous persisted content remains reachable under fallback');
assert.doesNotMatch(JSON.stringify(viewer), /UNSAVED_ANALYSIS_MUST_NOT_RENDER/, 'unsaved source analysis is never rendered');
const persistedIds = new Set(allItems.map(item => item.id));
for (const section of Object.values(viewer.byTab).flat()) {
  assert.ok(section.provenance.length > 0, `rendered block ${section.id} has persisted provenance`);
  assert.ok(section.provenance.every(entry => persistedIds.has(entry.recordId)), `rendered block ${section.id} maps to persisted Workspace records`);
}
assert.equal(JSON.stringify(allItems), originalJson, 'all selectors are read-only');

console.log('Workspace heading registry QA: 52 assertions passed');
