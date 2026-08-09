#!/usr/bin/env node
/**
 * Logic-only QA for Workspace Library topic counts — no browser/dev-server
 * needed. Covers the confirmed root cause (topicId: null / topicName: ''
 * items falling into the __none__ bucket) and the badge-visibility fix.
 *
 * Run:
 *   node scripts/workspace-library-counts-qa.mjs
 */
import assert from 'assert';
import {
  VIRTUAL_TAXONOMY,
  getVirtTopicCounts,
  getVirtSubtopicCounts,
  filterByVirtTopic,
  groupItemsByVirtTopic,
} from '../src/utils/workspaceVirtualTaxonomy.js';
import { getCountBadgeSuffix } from '../src/utils/workspaceTabDisplay.js';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
    failed++;
  }
}

// ── Fixture ──────────────────────────────────────────────────────────────
// Mirrors the confirmed production shape: some items cleanly classified,
// some genuinely unclassified (topicId: null, topicName: ''), some with an
// unknown/legacy topicId that matches no taxonomy entry, plus edge fields
// (0/false, duplicate id) that must not affect matching.
const items = [
  { id: '1', topicId: 'wt-stocks',        subTopicId: null,      topicName: 'מניות' },
  { id: '2', topicId: 'wt-markets-macro', subTopicId: null,      topicName: 'מאקרו' },
  { id: '3', topicId: 'wt-ai-claudecode', subTopicId: null,      topicName: 'Claude Code' },
  { id: '4', topicId: null,               subTopicId: null,      topicName: '' },
  { id: '5', topicId: null,               subTopicId: null,      topicName: '' },
  { id: '6', topicId: 'wt-legacy-unknown', subTopicId: null,     topicName: 'נושא ישן שלא קיים' },
  { id: '7', topicId: 'wt-stocks',        subTopicId: null,      topicName: 'מניות', flags: { isFavorite: false }, marketStatus: 0 },
  { id: '8', topicId: null,               subTopicId: null,      topicName: '', videoTitle: false },
];

check('global unique total counts every item once', () => {
  assert.strictEqual(items.length, 8);
});

check('getVirtTopicCounts matches classified items, ignores unclassified', () => {
  const counts = getVirtTopicCounts(items);
  assert.strictEqual(counts['vt-markets'], 3, 'items 1, 2, 7 → vt-markets');
  assert.strictEqual(counts['vt-ai'], 1, 'item 3 → vt-ai');
  assert.strictEqual(counts['__none__'], undefined, 'getVirtTopicCounts never buckets unmatched items');
});

check('groupItemsByVirtTopic buckets null-topic and unknown-legacy-topicId items under __none__', () => {
  const groups = groupItemsByVirtTopic(items);
  const noneIds = (groups.__none__ || []).map(i => i.id).sort();
  // 4, 5, 8 = topicId: null / topicName: ''; 6 = topicId not in any taxonomy list
  assert.deepStrictEqual(noneIds, ['4', '5', '6', '8']);
});

check('classified + unclassified adds back up to the global total', () => {
  const groups = groupItemsByVirtTopic(items);
  const classified = VIRTUAL_TAXONOMY.reduce((sum, vt) => sum + (groups[vt.id]?.length || 0), 0);
  const unclassified = (groups.__none__ || []).length;
  assert.strictEqual(classified + unclassified, items.length);
});

check('filterByVirtTopic returns only items matching the given topic', () => {
  const stocks = filterByVirtTopic(items, 'vt-markets');
  assert.deepStrictEqual(stocks.map(i => i.id).sort(), ['1', '2', '7']);
});

check('getVirtSubtopicCounts scopes correctly within a pre-filtered topic', () => {
  const marketsItems = filterByVirtTopic(items, 'vt-markets');
  const subCounts = getVirtSubtopicCounts(marketsItems, 'vt-markets');
  assert.strictEqual(subCounts['vts-stocks'], 2, 'items 1, 7 → vts-stocks');
  assert.strictEqual(subCounts['vts-macro'], 1, 'item 2 → vts-macro');
});

check('0/false fields on an item do not break matching (item 7)', () => {
  const groups = groupItemsByVirtTopic(items);
  assert.ok((groups['vt-markets'] || []).some(i => i.id === '7'));
});

// ── Badge-visibility fix (the confirmed WorkspaceTabRow.jsx:81 bug) ───────
check('getCountBadgeSuffix shows "(0)" instead of hiding the badge', () => {
  assert.strictEqual(getCountBadgeSuffix(0), ' (0)');
});

check('getCountBadgeSuffix shows non-zero counts', () => {
  assert.strictEqual(getCountBadgeSuffix(5), ' (5)');
});

check('getCountBadgeSuffix renders nothing when count is not a number (e.g. "הכל" tab with no count prop)', () => {
  assert.strictEqual(getCountBadgeSuffix(undefined), '');
  assert.strictEqual(getCountBadgeSuffix(null), '');
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
