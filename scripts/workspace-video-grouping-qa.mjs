#!/usr/bin/env node
import assert from 'node:assert/strict';
import { checksumWorkspaceItemIds, getWorkspaceGroupingReachability, getWorkspaceSectionLabel, groupWorkspaceItemsByVideo, normalizeWorkspaceCollectionId, normalizeWorkspaceVideoUrl, searchWorkspaceItemsForScope, selectCollectionForScope, selectFocusedVideoPresentation, selectGlobalCollections, selectVideoCollections, selectVideoGroups, selectWorkspaceVideoGroups } from '../src/utils/workspaceVideoGrouping.js';

const snapshot = (change = '+1%') => ({ videoId: 'KOom2PCpl6Q', videoTitle: 'Canonical source title', stocks: [{ symbol: 'AAA', change }], markets: [], sentiment: [] });
const records = [
  ...[1, 2, 3, 4].map(number => ({ id: `snap-${number}`, videoId: null, videoUrl: 'https://youtu.be/KOom2PCpl6Q', videoTitle: 'אותו סרטון', itemType: 'structured-snapshot', sourceTab: 'Specialized', savedAt: `2026-01-0${number}`, structuredSnapshot: snapshot() })),
  { id: 'old-version', videoUrl: 'https://www.youtube.com/watch?v=KOom2PCpl6Q&utm_source=x', videoTitle: 'אותו סרטון', itemType: 'structured-snapshot', sourceTab: 'Specialized', savedAt: '2025-12-01', structuredSnapshot: snapshot('+2%') },
  { id: 'insight', videoId: 'KOom2PCpl6Q', videoTitle: 'חדשות — Canonical source title', itemType: 'insight', sourceTab: 'insights', identityPayload: { text: 'insight' } },
  { id: 'knowledge', videoId: 'KOom2PCpl6Q', itemType: 'checklist', sourceTab: 'useful-knowledge', identityPayload: { text: 'rule' } },
  { id: 'app', videoId: 'KOom2PCpl6Q', itemType: 'app', sourceTab: 'app-builder', appPayload: { name: 'app' }, identityPayload: { name: 'app' } },
  { id: 'other-video', videoId: 'abcdefghijk', videoTitle: 'אותו סרטון', itemType: 'insight', notes: 'insight from another video', identityPayload: { text: 'other' } },
  { id: 'no-video', videoTitle: 'אותו סרטון', notes: 'legacy' },
];

const result = groupWorkspaceItemsByVideo(records);
assert.equal(result.videoCount, 2, 'similar titles do not merge different videos');
const group = result.videoGroups.find(entry => entry.videoId === 'KOom2PCpl6Q');
assert.equal(group.items.length, 8);
assert.equal(group.videoTitle, 'Canonical source title', 'parent uses source-video metadata instead of a saved-item display title');
assert.equal(group.collections.specialized.length, 5, 'persisted Snapshots navigate through Targeted Content');
assert.equal(group.collections.insights.length, 1);
assert.equal(group.collections.reusableKnowledge.length, 1);
assert.equal(group.collections.apps.length, 1);
assert.equal(group.collectionUniqueCounts.specialized, 2, 'four exact copies collapse to one logical snapshot plus one historical version inside Targeted Content');
assert.equal(group.exactDuplicateGroups.length, 1);
assert.equal(group.exactDuplicateGroups[0].copyCount, 4);
assert.equal(group.versions.filter(version => version.collection === 'specialized' && version.canonical.itemType === 'structured-snapshot').length, 2);
assert.deepEqual(result.withoutVideo.map(item => item.id), ['no-video']);
assert.deepEqual(getWorkspaceGroupingReachability(result).sort(), records.map(item => item.id).sort());
assert.equal(new Set(getWorkspaceGroupingReachability(result)).size, records.length);
assert.deepEqual(normalizeWorkspaceVideoUrl('https://youtu.be/KOom2PCpl6Q?t=42'), { key: 'video:KOom2PCpl6Q', videoId: 'KOom2PCpl6Q', url: 'https://www.youtube.com/watch?v=KOom2PCpl6Q' });
assert.equal(normalizeWorkspaceVideoUrl('https://example.com/video?b=2&a=1').url, 'https://example.com/video?a=1&b=2', 'non-YouTube fallback retains meaningful query parameters');

const snapshotOnly = groupWorkspaceItemsByVideo(records.filter(item => item.itemType === 'structured-snapshot'));
assert.equal(snapshotOnly.videoCount, 1, 'collection filtering returns one parent');
const matchingChildren = records.filter(item => item.identityPayload?.text === 'insight');
assert.equal(groupWorkspaceItemsByVideo(matchingChildren).videoCount, 1, 'search matches collapse to one parent');
assert.deepEqual(records.map(item => item.id), ['snap-1','snap-2','snap-3','snap-4','old-version','insight','knowledge','app','other-video','no-video'], 'selector does not mutate input');
assert.equal(checksumWorkspaceItemIds(records), checksumWorkspaceItemIds([...records].reverse()), 'ID checksum is order-independent');

const selectedGroups = selectVideoGroups(records);
const globalCollections = selectGlobalCollections(selectedGroups.videoGroups);
const videoCollections = selectVideoCollections(group);
assert.equal(globalCollections.specialized.uniqueCount, 2, 'global Targeted Content count includes logical Snapshot versions');
assert.equal(globalCollections.specialized.recordCount, 5, 'Targeted Content preserves every physical Snapshot save');
assert.equal(globalCollections.insights.uniqueCount, 2, 'similar collection types remain attributable to separate videos');
assert.deepEqual(new Set(globalCollections.insights.entries.map(entry => entry.videoGroup.videoKey)), new Set(['video:KOom2PCpl6Q', 'video:abcdefghijk']), 'global entries preserve their source-video attribution');
assert.equal(videoCollections.insights.uniqueCount, 1, 'focused counts include only the selected video');
assert.equal(videoCollections.knowledge.uniqueCount, 1);
assert.equal(videoCollections.apps.uniqueCount, 1);
assert.equal(selectCollectionForScope({ videoGroups: selectedGroups.videoGroups, focusedVideoKey: null, collectionType: 'insights' }).scope, 'global');
assert.equal(selectCollectionForScope({ videoGroups: selectedGroups.videoGroups, focusedVideoKey: 'KOom2PCpl6Q', collectionType: 'specialized' }).collection.recordCount, 5);
assert.equal(selectCollectionForScope({ videoGroups: selectedGroups.videoGroups, focusedVideoKey: 'missing', collectionType: 'specialized' }).scope, 'global', 'invalid focus safely falls back globally');
assert.deepEqual(globalCollections.specialized.entries.flatMap(entry => entry.records).map(item => item.id).sort(), ['old-version','snap-1','snap-2','snap-3','snap-4']);
assert.deepEqual(searchWorkspaceItemsForScope({ videoGroups: selectedGroups.videoGroups, query: 'insight' }).map(item => item.id).sort(), ['insight','other-video']);
assert.deepEqual(searchWorkspaceItemsForScope({ videoGroups: selectedGroups.videoGroups, focusedVideoKey: 'KOom2PCpl6Q', query: 'insight' }).map(item => item.id), ['insight']);
assert.deepEqual(searchWorkspaceItemsForScope({ videoGroups: selectedGroups.videoGroups, withoutVideo: selectedGroups.withoutVideo, query: 'legacy' }).map(item => item.id), ['no-video']);
const focusedPresentation = selectFocusedVideoPresentation(group);
assert.equal(focusedPresentation.recordCount, 8);
assert.equal(focusedPresentation.snapshotUniqueCount, 2, 'identical Snapshot records collapse while a different hash remains historical');
assert.equal(focusedPresentation.savedSectionCount, 3, 'saved-section summary excludes Snapshot records');
assert.deepEqual(focusedPresentation.exactDuplicateRemovalIds.sort(), ['snap-1', 'snap-2', 'snap-3'], 'cleanup proposes only redundant exact copies and preserves the newest canonical record');
assert.equal(getWorkspaceSectionLabel(records.find(item => item.id === 'insight'), 'insights'), 'חדשות', 'human section label is derived without exposing a record ID');
assert.equal(focusedPresentation.sections.filter(section => section.collection === 'specialized').flatMap(section => section.versions).filter(version => version.canonical.itemType === 'structured-snapshot').length, 2, 'different Snapshot hashes remain visible as two Targeted Content versions');
const interactionState = { focusedVideoKey: 'KOom2PCpl6Q', selectedIds: new Set() };
interactionState.selectedIds.add('snap-1');
assert.equal(interactionState.focusedVideoKey, 'KOom2PCpl6Q', 'bulk selection does not change video focus');
assert.deepEqual([...interactionState.selectedIds], ['snap-1'], 'video focus and bulk selection remain independent state');

const scopedRecords = [
  { id: 'v1-insight', videoId: 'video-one', videoTitle: 'סרטון ראשון', topicId: 'wt-markets', subTopicId: 'brief', itemType: 'insight', sourceTabId: 'insights', semanticTags: ['stocks'], notes: 'Nvidia result', identityPayload: { text: 'same insight' } },
  { id: 'v1-insight-copy', videoId: 'video-one', videoTitle: 'סרטון ראשון', topicId: 'wt-markets', subTopicId: 'brief', itemType: 'insight', sourceTabId: 'insights', semanticTags: ['stocks'], notes: 'Nvidia result', identityPayload: { text: 'same insight' } },
  { id: 'v1-snapshot', videoId: 'video-one', videoTitle: 'סרטון ראשון', topicId: 'wt-markets', subTopicId: 'brief', itemType: 'structured-snapshot', semanticTags: ['stocks'], structuredSnapshot: { videoId: 'video-one', videoTitle: 'סרטון ראשון', stocks: [], markets: [], sentiment: [] } },
  { id: 'v2-summary', videoId: 'video-two', videoTitle: 'סרטון שני', topicId: 'wt-markets', subTopicId: 'brief', itemType: 'summary', sourceTabId: 'summary', semanticTags: ['macro'], notes: 'Dollar overview' },
  { id: 'v3-other-topic', videoId: 'video-three', videoTitle: 'סרטון שלישי', topicId: 'wt-ai', itemType: 'insight', sourceTabId: 'insights', notes: 'Nvidia AI' },
  { id: 'legacy-no-video', topicId: 'wt-markets', subTopicId: 'brief', itemType: 'summary', sourceTabId: 'summary', notes: 'Dollar legacy' },
];
const allCollectionGroups = selectWorkspaceVideoGroups({
  items: scopedRecords,
  topicId: 'wt-markets',
  subtopicId: 'brief',
  collectionId: 'all',
});
assert.equal(allCollectionGroups.collectionId, 'all', 'all is normalized as no collection restriction');
assert.equal(allCollectionGroups.videoCount, 2, 'all returns every matching source-video parent');
assert.equal(allCollectionGroups.persistedCount, 5, 'all keeps every matching underlying record');
assert.deepEqual(allCollectionGroups.videoGroups.map(entry => entry.videoId).sort(), ['video-one', 'video-two']);
assert.equal(allCollectionGroups.videoGroups.find(entry => entry.videoId === 'video-one').items.length, 3, 'several children attach to one parent');
assert.equal(allCollectionGroups.videoGroups.find(entry => entry.videoId === 'video-one').uniqueContentCount, 2, 'exact duplicates collapse logically inside the parent');
assert.deepEqual(allCollectionGroups.withoutVideo.map(item => item.id), ['legacy-no-video'], 'unreliable video records remain reachable in fallback');
assert.deepEqual(new Set(allCollectionGroups.reachableItemIds), new Set(['v1-insight', 'v1-insight-copy', 'v1-snapshot', 'v2-summary', 'legacy-no-video']), 'every matching underlying ID remains reachable');
assert.equal(allCollectionGroups.allUniqueContentCount, 4, 'all count uses logical content from the same matching scope');
assert.equal(allCollectionGroups.collectionCounts.insights.uniqueCount, 1, 'collection counts deduplicate exact child copies');
assert.equal(allCollectionGroups.collectionCounts.specialized.uniqueCount, 1, 'Snapshot contributes to the Targeted Content card');
assert.equal(allCollectionGroups.collectionCounts.summary.uniqueCount, 2, 'collection counts include grouped and fallback content');
assert.deepEqual(allCollectionGroups.collectionCounts.all, { uniqueCount: 4, recordCount: 5, videoCount: 2 }, 'the large all-collections tile is derived from the same scoped records');
assert.equal(allCollectionGroups.collectionCounts.insights.videoCount, 1, 'collection tiles count distinct source videos in the active scope');

const insightGroups = selectWorkspaceVideoGroups({ items: scopedRecords, topicId: 'wt-markets', subtopicId: 'brief', collectionId: 'insights' });
assert.equal(insightGroups.videoCount, 1, 'specific collection keeps only parents containing that collection');
assert.equal(insightGroups.videoGroups[0].videoId, 'video-one');
assert.equal(insightGroups.persistedCount, 2, 'specific collection preserves duplicate records under the single parent');
assert.equal(normalizeWorkspaceCollectionId('not-a-collection'), 'all', 'invalid collection safely falls back to all');
assert.equal(normalizeWorkspaceCollectionId('snapshots'), 'specialized', 'legacy Snapshot collection normalizes to Targeted Content');
assert.equal(selectWorkspaceVideoGroups({ items: scopedRecords, topicId: 'wt-markets', subtopicId: 'brief', collectionId: 'not-a-collection' }).videoCount, 2, 'invalid collection never searches for a child collection with that name');
assert.equal(selectWorkspaceVideoGroups({ items: scopedRecords, topicId: 'wt-markets', subtopicId: 'brief', collectionId: 'all', semanticTags: ['stocks'], searchQuery: 'Nvidia' }).videoCount, 1, 'topic, subtopic, semantic and search filters intersect');
assert.equal(selectWorkspaceVideoGroups({ items: scopedRecords, topicId: 'wt-markets', subtopicId: 'brief', collectionId: 'all', semanticTags: ['stocks'], searchQuery: 'Dollar' }).videoCount, 0, 'search does not bypass semantic filtering');
const focusedScopeCounts = selectWorkspaceVideoGroups({
  items: scopedRecords.filter(item => item.videoId === 'video-one'),
  topicId: 'wt-markets',
  subtopicId: 'brief',
  collectionId: 'all',
}).collectionCounts;
assert.deepEqual(focusedScopeCounts.all, { uniqueCount: 2, recordCount: 3, videoCount: 1 }, 'focused-video tiles are limited to the focused persisted records');
assert.equal(focusedScopeCounts.summary.recordCount, 0, 'focused-video empty collections remain honest');
assert.deepEqual(scopedRecords.map(item => item.id), ['v1-insight', 'v1-insight-copy', 'v1-snapshot', 'v2-summary', 'v3-other-topic', 'legacy-no-video'], 'canonical selector never mutates persisted input');

const saveOrderRecords = [
  { id: 'order-a', videoId: 'video-a', videoTitle: 'בבב', itemType: 'insight', sourceTab: 'insights', savedAt: '2026-01-01', updatedAt: '2026-06-01', identityPayload: { text: 'order-a' } },
  { id: 'order-b', videoId: 'video-b', videoTitle: 'גגג', itemType: 'insight', sourceTab: 'insights', savedAt: '2026-03-01', identityPayload: { text: 'order-b' } },
  { id: 'order-c', videoId: 'video-c', videoTitle: 'אאא', itemType: 'insight', sourceTab: 'insights', savedAt: '2026-06-01', identityPayload: { text: 'order-c' } },
];
const saveOrderResult = groupWorkspaceItemsByVideo(saveOrderRecords);
const reSavedGroup = saveOrderResult.videoGroups.find(entry => entry.videoId === 'video-a');
assert.equal(reSavedGroup.latestSaveDate, '2026-06-01', 'a re-save that only bumps updatedAt (never savedAt) is still reflected in latestSaveDate');
assert.deepEqual(saveOrderResult.videoGroups.map(entry => entry.videoId), ['video-c', 'video-a', 'video-b'], 'groups are ordered by latestSaveDate desc, ties broken by videoTitle asc');

console.log('Workspace video grouping QA: 68 assertions passed');
