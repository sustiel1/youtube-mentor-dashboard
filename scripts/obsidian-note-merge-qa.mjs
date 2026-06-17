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

console.log(`\nMerge QA: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
