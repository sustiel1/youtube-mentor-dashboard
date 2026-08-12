#!/usr/bin/env node
/**
 * Logic-only QA for the "structured-snapshot" Workspace Library item type —
 * no browser/dev-server needed. Covers payload construction, JSON safety,
 * empty/partial tables, and backward compatibility with existing item
 * types and the existing taxonomy/counting functions.
 *
 * Run:
 *   node scripts/structured-snapshot-qa.mjs
 */
import assert from 'assert';
import {
  STRUCTURED_SNAPSHOT_VERSION,
  buildStructuredSnapshot,
  buildSnapshotNotes,
  resolveStructuredSnapshotTopic,
} from '../src/utils/structuredSnapshot.js';
import {
  getVirtTopicCounts,
  groupItemsByVirtTopic,
} from '../src/utils/workspaceVirtualTaxonomy.js';

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

// ── Payload construction ────────────────────────────────────────────────
const rawStocks = [
  { ticker: 'AAPL', company: 'Apple', context: 'רבעון חזק', sentiment: 'חיובי', category: 'watchlist', actionability: 'למעקב', notes: 'הערה' },
  { ticker: 'TSLA' }, // missing optional fields on purpose
];
const rawMarkets = [
  { asset: 'SPX', trend: 'up', strength: 'strong', comment: 'שיא חדש' },
];
const rawSentiment = [
  { label: 'סנטימנט שוק', value: 'חיובי מתון' },
];

const snapshot = buildStructuredSnapshot({
  videoId: 'vid123',
  videoTitle: 'סקירת שוק',
  savedAt: '2026-01-01T00:00:00.000Z',
  rawStocks,
  rawMarkets,
  rawSentiment,
});

check('snapshot has the expected top-level shape', () => {
  assert.strictEqual(snapshot.version, STRUCTURED_SNAPSHOT_VERSION);
  assert.strictEqual(snapshot.savedAt, '2026-01-01T00:00:00.000Z');
  assert.strictEqual(snapshot.videoId, 'vid123');
  assert.strictEqual(snapshot.videoTitle, 'סקירת שוק');
  assert.ok(Array.isArray(snapshot.stocksTable));
  assert.ok(Array.isArray(snapshot.marketsTable));
  assert.ok(Array.isArray(snapshot.sentimentTable));
});

check('stock rows keep provided fields and fill missing ones with "" (not undefined)', () => {
  assert.deepStrictEqual(snapshot.stocksTable[0], {
    ticker: 'AAPL', company: 'Apple', context: 'רבעון חזק', sentiment: 'חיובי',
    category: 'watchlist', actionability: 'למעקב', notes: 'הערה',
  });
  assert.deepStrictEqual(snapshot.stocksTable[1], {
    ticker: 'TSLA', company: '', context: '', sentiment: '', category: '', actionability: '', notes: '',
  });
});

check('market and sentiment rows normalize the same way', () => {
  assert.deepStrictEqual(snapshot.marketsTable[0], { asset: 'SPX', trend: 'up', strength: 'strong', comment: 'שיא חדש' });
  assert.deepStrictEqual(snapshot.sentimentTable[0], { label: 'סנטימנט שוק', value: 'חיובי מתון' });
});

check('no synthetic Markets change% is invented', () => {
  assert.ok(!('changePct' in snapshot.marketsTable[0]));
  assert.ok(!('change' in snapshot.marketsTable[0]));
});

check('snapshot is JSON-safe and round-trips exactly (no functions, no undefined, no cycles)', () => {
  const roundTripped = JSON.parse(JSON.stringify(snapshot));
  assert.deepStrictEqual(roundTripped, snapshot);
});

// ── Empty / partial tables ──────────────────────────────────────────────
check('empty raw arrays produce empty (not missing) tables', () => {
  const empty = buildStructuredSnapshot({ videoTitle: 'ריק', savedAt: '2026-01-01T00:00:00.000Z' });
  assert.deepStrictEqual(empty.stocksTable, []);
  assert.deepStrictEqual(empty.marketsTable, []);
  assert.deepStrictEqual(empty.sentimentTable, []);
});

check('partial input (only markets) leaves the other two tables empty, not broken', () => {
  const partial = buildStructuredSnapshot({ videoTitle: 'רק שווקים', savedAt: '2026-01-01T00:00:00.000Z', rawMarkets });
  assert.strictEqual(partial.stocksTable.length, 0);
  assert.strictEqual(partial.marketsTable.length, 1);
  assert.strictEqual(partial.sentimentTable.length, 0);
});

// ── Searchability via notes ─────────────────────────────────────────────
check('buildSnapshotNotes produces text containing the tickers/assets (what search matches against)', () => {
  const notes = buildSnapshotNotes(snapshot);
  assert.ok(notes.includes('AAPL'));
  assert.ok(notes.includes('TSLA'));
  assert.ok(notes.includes('SPX'));
  assert.ok(notes.includes('סקירת שוק'));
});

check('buildSnapshotNotes on an all-empty snapshot still returns a non-empty title line', () => {
  const empty = buildStructuredSnapshot({ videoTitle: 'ריק', savedAt: '2026-01-01T00:00:00.000Z' });
  const notes = buildSnapshotNotes(empty);
  assert.ok(notes.length > 0);
  assert.ok(notes.includes('ריק'));
});

// ── Backward compatibility with existing item types / taxonomy ─────────
const workspaceTopics = [
  { id: 'wt-markets', name: 'שוק ההון', parentId: null },
  { id: 'wt-markets-daily', name: 'סקירת שוק יומית', parentId: 'wt-markets' },
  { id: 'wt-general', name: 'כללי', parentId: null },
];

check('snapshot inherits a valid existing top-level Workspace topic by canonical source category', () => {
  assert.deepStrictEqual(
    resolveStructuredSnapshotTopic({ category: ' שוק ההון ' }, workspaceTopics),
    { topicId: 'wt-markets', topicName: 'שוק ההון', category: 'שוק ההון' },
  );
});

check('missing source topic remains safely unclassified', () => {
  assert.deepStrictEqual(
    resolveStructuredSnapshotTopic({}, workspaceTopics),
    { topicId: null, topicName: '', category: null },
  );
});

check('invalid or deleted source topic remains safely unclassified', () => {
  assert.deepStrictEqual(
    resolveStructuredSnapshotTopic({ category: 'נושא שאינו קיים' }, workspaceTopics),
    { topicId: null, topicName: '', category: null },
  );
});

check('snapshot never infers a topic from its title or a nested topic name', () => {
  assert.deepStrictEqual(
    resolveStructuredSnapshotTopic({ title: 'שוק ההון', category: 'סקירת שוק יומית' }, workspaceTopics),
    { topicId: null, topicName: '', category: null },
  );
});

const mixedItems = [
  { id: '1', topicId: 'wt-stocks', subTopicId: null, topicName: 'מניות' },                          // plain item
  { id: '2', topicId: 'wt-ai-claudecode', subTopicId: null, topicName: 'Claude Code', itemType: 'stock', symbol: 'X' }, // existing 'stock' itemType
  { id: '3', topicId: 'wt-markets', subTopicId: null, topicName: 'שוק ההון', itemType: 'structured-snapshot', structuredSnapshot: snapshot },
];

check('a structured-snapshot item does not break existing counting/grouping functions', () => {
  const counts = getVirtTopicCounts(mixedItems);
  assert.strictEqual(counts['vt-markets'], 2, 'items 1 and 3 both map to vt-markets');
  assert.strictEqual(counts['vt-ai'], 1);
  const groups = groupItemsByVirtTopic(mixedItems);
  assert.ok(groups['vt-markets'].some(i => i.id === '3'), 'the snapshot item is grouped like any other item');
});

check('non-snapshot items are untouched by the new fields (no itemType/structuredSnapshot leak)', () => {
  assert.strictEqual(mixedItems[0].itemType, undefined);
  assert.strictEqual(mixedItems[0].structuredSnapshot, undefined);
  assert.strictEqual(mixedItems[1].itemType, 'stock');
  assert.strictEqual(mixedItems[1].structuredSnapshot, undefined);
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
