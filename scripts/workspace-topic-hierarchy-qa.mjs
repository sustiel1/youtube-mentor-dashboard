#!/usr/bin/env node
import assert from 'node:assert/strict';
import { VIRTUAL_TAXONOMY } from '../src/utils/workspaceVirtualTaxonomy.js';
import { getAllMergedTabs, getCanonicalSubtopicsForVirtualTopic } from '../src/utils/workspaceTabPreferences.js';
import {
  WORKSPACE_TOPIC_TYPES,
  buildWorkspaceTaxonomyRepairBackup,
  buildWorkspaceTopicChangePreview,
  getWorkspaceMainTopics,
  getWorkspaceSubtopics,
  itemMatchesCanonicalTopic,
  validateWorkspaceTopicDraft,
} from '../src/utils/workspaceTopicHierarchy.js';

const topics = [
  { id: 'wt-markets', name: 'שוק ההון', parentId: null, displayOrder: 1 },
  { id: 'wt-fundamental', name: 'פונדמנטלי', parentId: 'wt-markets', displayOrder: 20 },
  { id: 'wt-technical', name: 'טכני', parentId: 'wt-markets', displayOrder: 30 },
  { id: 'wt-morning-evening', name: 'מבזק בוקר/ערב', parentId: null, displayOrder: 10 },
];
const preferences = {
  hiddenTabIds: [],
  labelOverrides: {},
  customMainTabs: [{ id: 'cvt-wt-morning-evening', name: 'מבזק בוקר/ערב', emoji: '📌', realTopicId: 'wt-morning-evening', isCustom: true }],
};
const items = [
  { id: 'legacy-1', topicId: 'wt-morning-evening', itemType: 'insight' },
  { id: 'snapshot-1', topicId: 'wt-markets', subTopicId: 'wt-morning-evening', itemType: 'structured-snapshot' },
  { id: 'other-1', topicId: 'wt-markets', itemType: 'insight' },
];

assert.deepEqual(getWorkspaceMainTopics(topics).map(topic => topic.id), ['wt-markets', 'wt-morning-evening'], 'main topics have no parent');
assert.equal(validateWorkspaceTopicDraft({ type: WORKSPACE_TOPIC_TYPES.SUBTOPIC, parentId: '', topics }).ok, false, 'subtopic requires a parent');
assert.equal(validateWorkspaceTopicDraft({ topicId: 'wt-morning-evening', type: WORKSPACE_TOPIC_TYPES.SUBTOPIC, parentId: 'wt-morning-evening', topics }).ok, false, 'topic cannot parent itself');
assert.equal(validateWorkspaceTopicDraft({ topicId: 'wt-morning-evening', type: WORKSPACE_TOPIC_TYPES.SUBTOPIC, parentId: 'missing', topics }).ok, false, 'deleted or invalid parent is rejected');
assert.equal(validateWorkspaceTopicDraft({ topicId: 'wt-morning-evening', type: WORKSPACE_TOPIC_TYPES.SUBTOPIC, parentId: 'wt-fundamental', topics }).ok, false, 'third hierarchy level is rejected');

const preview = buildWorkspaceTopicChangePreview({
  topic: topics.find(topic => topic.id === 'wt-morning-evening'),
  draft: { type: WORKSPACE_TOPIC_TYPES.SUBTOPIC, parentId: 'wt-markets' },
  topics,
  items,
});
assert.equal(preview.validation.ok, true);
assert.equal(preview.topicId, 'wt-morning-evening');
assert.equal(preview.proposedParentId, 'wt-markets');
assert.deepEqual(preview.affectedItemIds, ['legacy-1', 'snapshot-1']);
assert.equal(preview.canPreserveTopicId, true);

const backup = buildWorkspaceTaxonomyRepairBackup({
  topics,
  items: [...items, { id: 'lowercase-subtopic-1', subtopicId: 'wt-morning-evening' }],
  topicId: 'wt-morning-evening',
  createdAt: '2026-08-11T00:00:00.000Z',
});
const parsedBackup = JSON.parse(backup.serialized);
assert.equal(parsedBackup.topic.id, 'wt-morning-evening', 'backup preserves the existing topic ID');
assert.equal(parsedBackup.taxonomy.length, topics.length, 'backup contains the complete taxonomy');
assert.deepEqual(parsedBackup.referencedItems.map(item => item.id), ['legacy-1', 'snapshot-1', 'lowercase-subtopic-1'], 'backup contains every directly referenced item across both subtopic field spellings');
assert.deepEqual(parsedBackup.workspaceItemIds, [...items.map(item => item.id), 'lowercase-subtopic-1'], 'backup records all Workspace item IDs for integrity checks');

const movedTopics = topics.map(topic => topic.id === 'wt-morning-evening' ? { ...topic, parentId: 'wt-markets' } : topic);
const mergedBefore = getAllMergedTabs(VIRTUAL_TAXONOMY, preferences, topics);
const mergedAfter = getAllMergedTabs(VIRTUAL_TAXONOMY, preferences, movedTopics);
assert.equal(mergedBefore.some(topic => topic.id === 'cvt-wt-morning-evening'), true, 'unparented custom topic appears in main row');
assert.equal(mergedAfter.some(topic => topic.id === 'cvt-wt-morning-evening'), false, 'reparented topic disappears from main row');

const marketTab = mergedAfter.find(topic => topic.id === 'vt-markets');
const canonicalSubtopics = getCanonicalSubtopicsForVirtualTopic(marketTab, movedTopics);
const marketSubtopicNames = new Set([...(marketTab.subtopics || []).map(topic => topic.name), ...canonicalSubtopics.map(topic => topic.name)]);
assert.equal(marketSubtopicNames.has('מבזק בוקר/ערב'), true, 'morning/evening appears under markets');
assert.equal(marketSubtopicNames.has('פונדמנטלי'), true, 'fundamental appears under markets');
assert.equal(marketSubtopicNames.has('טכני'), true, 'technical appears under markets');
assert.deepEqual(getWorkspaceSubtopics(movedTopics, 'wt-markets').map(topic => topic.id), ['wt-morning-evening', 'wt-fundamental', 'wt-technical']);

const itemIdsBefore = items.map(item => item.id);
const marketFilteredIds = items.filter(item => itemMatchesCanonicalTopic(item, 'wt-markets', movedTopics)).map(item => item.id);
const morningFilteredIds = items.filter(item => itemMatchesCanonicalTopic(item, 'wt-morning-evening', movedTopics)).map(item => item.id);
assert.deepEqual(marketFilteredIds, ['legacy-1', 'snapshot-1', 'other-1'], 'parent filter reaches existing child items');
assert.deepEqual(morningFilteredIds, ['legacy-1', 'snapshot-1'], 'child filter reaches the same persisted records');
assert.equal(new Set(marketFilteredIds).size, marketFilteredIds.length, 'filtering creates no duplicates');
assert.deepEqual(items.map(item => item.id), itemIdsBefore, 'selectors do not mutate attached item IDs');
assert.equal(items.find(item => item.id === 'snapshot-1').itemType, 'structured-snapshot', 'Structured Snapshot remains reachable');

const reloadedTopics = JSON.parse(JSON.stringify(movedTopics));
assert.equal(reloadedTopics.find(topic => topic.id === 'wt-morning-evening').parentId, 'wt-markets', 'reload preserves hierarchy');

console.log('Workspace topic hierarchy QA: 26 assertions passed');
