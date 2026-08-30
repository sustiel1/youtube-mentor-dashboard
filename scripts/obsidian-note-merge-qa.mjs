/**
 * Unit QA for obsidian note merge (append, dedupe, preserve manual edits).
 * Run: node scripts/obsidian-note-merge-qa.mjs
 */
import {
  mergeItemsIntoObsidianNote,
  noteContainsItemMarker,
  buildObsidianItemMarker,
} from '../src/lib/obsidianNoteMerge.js';

let passed = 0;
let failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${name}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const keyA = 'obsidian-item:vid1:insights:hello:general';
const keyB = 'obsidian-item:vid1:insights:world:general';
const keyC = 'obsidian-item:vid1:insights:third:general';

// 1. First item creates structured note
const first = mergeItemsIntoObsidianNote({
  videoTitle: 'מבזק לייב',
  items: [{ text: 'sentence A', sectionLabel: 'תובנות מרכזיות', identityKey: keyA }],
  footerLines: ['מקור: test'],
});
assert('creates title and section', first.content.includes('# מבזק לייב'));
assert('adds bullet A', first.content.includes('* sentence A'));
assert('adds marker A', noteContainsItemMarker(first.content, keyA));

// 2. Second item appends, does not replace
const second = mergeItemsIntoObsidianNote({
  existingContent: first.content,
  items: [{ text: 'sentence B', sectionLabel: 'תובנות מרכזיות', identityKey: keyB }],
});
assert('preserves A after B', second.content.includes('* sentence A'));
assert('adds B', second.content.includes('* sentence B'));
assert('both markers present', noteContainsItemMarker(second.content, keyA) && noteContainsItemMarker(second.content, keyB));

// 3. Third item
const third = mergeItemsIntoObsidianNote({
  existingContent: second.content,
  items: [{ text: 'sentence C', sectionLabel: 'תובנות מרכזיות', identityKey: keyC }],
});
assert('all three sentences exist', ['A', 'B', 'C'].every((s) => third.content.includes(`sentence ${s}`)));

// 4. Duplicate B skipped
const dup = mergeItemsIntoObsidianNote({
  existingContent: third.content,
  items: [{ text: 'sentence B', sectionLabel: 'תובנות מרכזיות', identityKey: keyB }],
});
assert('duplicate skipped', dup.skipped === 1 && dup.added === 0);
assert('content unchanged on dup', dup.content === third.content);

// 5. Manual edit preserved
const manualLine = 'שורה ידנית שהמשתמש הוסיף';
const withManual = `${third.content}\n${manualLine}\n`;
const fourth = mergeItemsIntoObsidianNote({
  existingContent: withManual,
  items: [{ text: 'sentence D', sectionLabel: 'תובנות מרכזיות', identityKey: 'obsidian-item:vid1:insights:fourth:general' }],
});
assert('manual line preserved', fourth.content.includes(manualLine));
assert('sentence D added', fourth.content.includes('* sentence D'));

// 6. ymd-meta (Phase 2, YMD-BRIEF-PERMANENCE-SPLIT) — omitted when no fields supplied
const noMeta = mergeItemsIntoObsidianNote({
  videoTitle: 'no meta',
  items: [{ text: 'plain item', sectionLabel: 'תובנות מרכזיות', identityKey: 'obsidian-item:vid1:insights:plain:general' }],
});
assert('no ymd-meta line when no fields supplied', !noMeta.content.includes('ymd-meta'));

// 7. ymd-meta emitted, exact field order, encodeURIComponent + '-' for missing
const metaKey = 'obsidian-item:vid1:insights:withmeta:general';
const withMeta = mergeItemsIntoObsidianNote({
  videoTitle: 'with meta',
  items: [{
    text: 'meta item',
    sectionLabel: 'תובנות מרכזיות',
    identityKey: metaKey,
    meta: {
      briefSectionKey: 'risks',
      permanence: 'permanent',
      date: '2026-08-30',
      // expiry intentionally omitted -> '-'
      ticker: undefined, // -> '-'
      sourceChannel: 'ערוץ',
    },
  }],
});
const expectedMetaLine = '<!-- ymd-meta:v1 briefSectionKey=risks permanence=permanent date=2026-08-30 expiry=- ticker=- sourceChannel=%D7%A2%D7%A8%D7%95%D7%A5 -->';
assert('ymd-meta line present with exact field order + encoding', withMeta.content.includes(expectedMetaLine), withMeta.content);

// meta line must sit immediately after the identity marker, as one atomic block
const markerLine = buildObsidianItemMarker(metaKey);
assert(
  'ymd-meta line follows identity marker directly',
  withMeta.content.includes(`${markerLine}\n${expectedMetaLine}`),
);

// 8. Duplicate with an existing identity marker: skipped entirely, no backfill of ymd-meta
const dupNoBackfill = mergeItemsIntoObsidianNote({
  existingContent: noMeta.content, // note has 'plain item' with NO ymd-meta
  items: [{
    text: 'plain item',
    sectionLabel: 'תובנות מרכזיות',
    identityKey: 'obsidian-item:vid1:insights:plain:general',
    meta: { briefSectionKey: 'risks', permanence: 'daily', date: '2026-08-30' },
  }],
});
assert('duplicate with meta is skipped (no insert)', dupNoBackfill.skipped === 1 && dupNoBackfill.added === 0);
assert('content unchanged — no backfill of ymd-meta onto existing bullet', dupNoBackfill.content === noMeta.content);
assert('no ymd-meta line was backfilled anywhere', !dupNoBackfill.content.includes('ymd-meta'));

console.log(`\nMerge QA: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
