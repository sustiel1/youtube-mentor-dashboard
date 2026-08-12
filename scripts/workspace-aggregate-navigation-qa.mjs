#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORKSPACE_COLLECTION_IDS } from '../src/config/workspaceHeadingRegistry.js';
import {
  getWorkspaceLibraryUrl,
  resolveWorkspaceLibraryLocation,
  toggleWorkspaceCollectionSelection,
} from '../src/lib/workspaceLibraryRoute.js';
import { selectWorkspaceVideoGroups } from '../src/utils/workspaceVideoGrouping.js';

const topicId = 'wt-markets';
const subtopicId = 'brief';
const item = (id, sourceVideoId, sourceTabId, text, savedAt) => ({
  id,
  sourceVideoId,
  videoTitle: `Video ${sourceVideoId}`,
  channel: `Channel ${sourceVideoId}`,
  thumbnail: `https://img.example/${sourceVideoId}.jpg`,
  topicId,
  subTopicId: subtopicId,
  sourceTabId,
  itemType: sourceTabId === 'app-builder' ? 'app' : sourceTabId,
  identityPayload: { text },
  savedAt,
});

const records = [
  item('v1-insight', 'video-one', 'insights', 'Persisted insight A', '2026-08-10T09:00:00.000Z'),
  item('v1-insight-copy', 'video-one', 'insights', 'Persisted insight A', '2026-08-09T09:00:00.000Z'),
  item('v1-summary', 'video-one', 'summary', 'Persisted summary A', '2026-08-08T09:00:00.000Z'),
  item('v2-insight', 'video-two', 'insights', 'Persisted insight B', '2026-08-09T12:00:00.000Z'),
  item('v2-chapter', 'video-two', 'chapters', 'Persisted chapter B', '2026-08-11T09:00:00.000Z'),
  item('v3-knowledge', 'video-three', 'useful-knowledge', 'Persisted knowledge C', '2026-08-07T09:00:00.000Z'),
  item('v3-insight', 'video-three', 'insights', 'Persisted insight C', '2026-08-06T09:00:00.000Z'),
];

const defaultLocation = resolveWorkspaceLibraryLocation('/workspace-library', '?topicId=wt-markets');
assert.equal(defaultLocation.params.collection, undefined, 'missing collection preserves the default video-list mode');
assert.equal(defaultLocation.canonicalUrl, '/workspace-library?topicId=wt-markets');
assert.equal(getWorkspaceLibraryUrl({ topicId, collection: 'all' }), '/workspace-library?topicId=wt-markets', 'collection=all is never serialized');

const defaultView = selectWorkspaceVideoGroups({ items: records, topicId, subtopicId, collectionId: null });
assert.equal(defaultView.collectionId, 'all');
assert.equal(defaultView.videoCount, 3, 'the fixture contains three matching logical videos');
assert.equal(defaultView.persistedCount, 7);
assert.deepEqual(defaultView.videoGroups.map(group => group.videoId), ['video-two', 'video-one', 'video-three'], 'default video groups are newest first');
assert.equal(new Set(defaultView.videoGroups.map(group => group.videoKey)).size, 3, 'each source video renders once');
assert.deepEqual(defaultView.videoGroups.map(group => group.uniqueContentCount), [2, 2, 2], 'exact duplicate children count once logically');
assert.deepEqual(records.map(record => record.id), ['v1-insight', 'v1-insight-copy', 'v1-summary', 'v2-insight', 'v2-chapter', 'v3-knowledge', 'v3-insight'], 'selectors do not mutate persisted records');

for (const collectionId of WORKSPACE_COLLECTION_IDS) {
  assert.equal(toggleWorkspaceCollectionSelection(null, collectionId), collectionId, `${collectionId} becomes the only selected collection`);
}
assert.equal(WORKSPACE_COLLECTION_IDS.length, 7);
assert.equal(toggleWorkspaceCollectionSelection('insights', 'insights'), null, 'clicking the selected card returns to default mode');

const aggregateInsights = selectWorkspaceVideoGroups({ items: records, topicId, subtopicId, collectionId: 'insights' });
assert.equal(aggregateInsights.collectionId, 'insights');
assert.equal(aggregateInsights.videoCount, 3, 'selected content aggregates across matching videos');
assert.deepEqual(aggregateInsights.videoGroups.map(group => group.videoId), ['video-one', 'video-two', 'video-three']);
assert.ok(aggregateInsights.videoGroups.every(group => group.items.every(record => record.sourceVideoId === group.videoId)), 'content cannot leak across source-video boundaries');
assert.deepEqual(aggregateInsights.videoGroups.map(group => group.uniqueContentCount), [1, 1, 1]);

const focusedInsights = selectWorkspaceVideoGroups({
  items: records.filter(record => record.sourceVideoId === 'video-one'),
  topicId,
  subtopicId,
  collectionId: 'insights',
});
assert.equal(focusedInsights.videoCount, 1);
assert.equal(focusedInsights.collectionCounts.insights.uniqueCount, 1);
assert.equal(focusedInsights.collectionCounts.summary.uniqueCount, 1);
assert.equal(focusedInsights.collectionCounts.knowledge.uniqueCount, 0, 'focused counts remain scoped to persisted content from that video');

const emptyApps = selectWorkspaceVideoGroups({ items: records, topicId, subtopicId, collectionId: 'apps' });
assert.equal(emptyApps.collectionId, 'apps', 'an empty selected collection remains selected');
assert.equal(emptyApps.items.length, 0);
assert.equal(emptyApps.videoCount, 0);

const focusedUrl = getWorkspaceLibraryUrl({ video: 'video-one', topicId, subtopicId, collection: 'insights' });
const aggregateUrl = getWorkspaceLibraryUrl({ topicId, subtopicId, collection: 'insights' });
assert.equal(focusedUrl, '/workspace-library?video=video-one&topicId=wt-markets&subtopicId=brief&collection=insights');
assert.equal(aggregateUrl, '/workspace-library?topicId=wt-markets&subtopicId=brief&collection=insights', 'clearing focus restores the aggregate collection state');
assert.equal(resolveWorkspaceLibraryLocation('/workspace-library', `?${focusedUrl.split('?')[1]}`).params.video, 'video-one', 'focused state survives reload');
assert.equal(resolveWorkspaceLibraryLocation('/workspace-library', '?topicId=wt-markets&collection=snapshots').canonicalUrl, '/workspace-library?topicId=wt-markets&collection=specialized');

const pageSource = readFileSync(new URL('../src/pages/WorkspaceLibrary.jsx', import.meta.url), 'utf8');
const tileSource = readFileSync(new URL('../src/components/workspace/WorkspaceCollectionTiles.jsx', import.meta.url), 'utf8');
const focusedSource = readFileSync(new URL('../src/components/workspace/WorkspaceFocusedVideoCard.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
assert.match(pageSource, /activeCollection\s*\?\s*`לא נשמרו עדיין/ , 'empty collection renders an honest collection-specific state');
assert.match(pageSource, /handleCollectionSelect\(null\)/, 'empty collection offers a return to the default video list');
assert.match(pageSource, /groupedPresentation\.videoGroups\.map\(group => activeCollection/, 'aggregate collection content is rendered with a source-video boundary');
assert.match(pageSource, /onToggleGroup=\{toggleGroupSelection\}/, 'checkbox selection remains a separate bulk-selection action');
assert.match(tileSource, /aria-selected=\{selected\}/, 'collection cards expose selected state');
assert.match(tileSource, /toggleWorkspaceCollectionSelection\(selectedId, collectionId\)/, 'collection cards use canonical toggle behavior');
assert.match(focusedSource, /נשמר לאחרונה \{dateText\(group\.latestSaveDate\)\}/, 'aggregate video groups show their saved date');
assert.match(focusedSource, /logicalItemCount/, 'aggregate video groups show logical item counts');
assert.match(appSource, /addEventListener\('popstate'/, 'Back and Forward restore URL-derived state');

console.log('Workspace aggregate navigation QA: 44 assertions passed');
