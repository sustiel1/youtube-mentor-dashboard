// QA for the Round-8/9 "empty currentVideoScopes array" hypothesis
// (workspaceSavedRowLookup.js buildSavedRowIndex). Proves, with real calls
// against the real module (not a reimplementation), what buildSavedRowIndex
// actually returns when passed scopes = null vs scopes = ['video:X'] vs
// scopes = [] against the SAME synthetic item set — no browser needed.
//
// Updated after the "כלל ההתאמה" round (same WORK-ID): the fallback rule
// itself changed — an unscoped item now matches ONLY when the current video
// resolves to NO scope at all (null or [], proven equivalent below), not
// whenever the current video is unresolved-OR-resolved-but-item-is-legacy.
// The null/[] equivalence proved here is unaffected by that rule change;
// only the ['video:video-x'] (non-empty) assertions were updated to match.
//
//   node scripts/saved-row-empty-scope-qa.mjs

import assert from 'node:assert/strict';

import { buildSavedRowIndex, isRowAlreadySaved } from '../src/utils/workspaceSavedRowLookup.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

const CATEGORY = 'indices';
const TEXT_A = 'מדד תל אביב 35 עולה בפתיחת המסחר';
const TEXT_B = 'מדד הנאסד״ק יורד בעקבות נתוני אינפלציה';

// One item resolves to video X, one to video Y, one has no resolvable scope at all.
const itemScopedToX = { id: 'ws-1', itemType: CATEGORY, sourceVideoId: 'video-x', rawSourceText: TEXT_A };
const itemScopedToY = { id: 'ws-2', itemType: CATEGORY, sourceVideoId: 'video-y', rawSourceText: TEXT_B };
const itemUnscoped = { id: 'ws-3', itemType: CATEGORY, rawSourceText: 'משפט שלישי ללא זיהוי וידאו כלל' };

const items = [itemScopedToX, itemScopedToY, itemUnscoped];

// --- scopes = null (documented "fully open" call shape) ---
const indexNull = buildSavedRowIndex(items, null);
check('null: scoped-to-X item does NOT match (excluded)', () => {
  assert.equal(isRowAlreadySaved(TEXT_A, CATEGORY, indexNull), false);
});
check('null: scoped-to-Y item does NOT match (excluded)', () => {
  assert.equal(isRowAlreadySaved(TEXT_B, CATEGORY, indexNull), false);
});
check('null: unscoped item DOES match (legacy fallback)', () => {
  assert.equal(isRowAlreadySaved('משפט שלישי ללא זיהוי וידאו כלל', CATEGORY, indexNull), true);
});

// --- scopes = ['video:video-x'] (real single-video case) ---
const indexX = buildSavedRowIndex(items, ['video:video-x']);
check("['video:video-x']: scoped-to-X item DOES match", () => {
  assert.equal(isRowAlreadySaved(TEXT_A, CATEGORY, indexX), true);
});
check("['video:video-x']: scoped-to-Y item does NOT match", () => {
  assert.equal(isRowAlreadySaved(TEXT_B, CATEGORY, indexX), false);
});
check("['video:video-x']: unscoped item does NOT match (post-rule-change: current video resolves, so legacy fallback no longer applies)", () => {
  assert.equal(isRowAlreadySaved('משפט שלישי ללא זיהוי וידאו כלל', CATEGORY, indexX), false);
});

// --- scopes = [] (the Round-8 hypothesis under test) ---
const indexEmpty = buildSavedRowIndex(items, []);
check('[]: scoped-to-X item does NOT match', () => {
  assert.equal(isRowAlreadySaved(TEXT_A, CATEGORY, indexEmpty), false);
});
check('[]: scoped-to-Y item does NOT match', () => {
  assert.equal(isRowAlreadySaved(TEXT_B, CATEGORY, indexEmpty), false);
});
check('[]: unscoped item DOES match (same as null)', () => {
  assert.equal(isRowAlreadySaved('משפט שלישי ללא זיהוי וידאו כלל', CATEGORY, indexEmpty), true);
});

// --- Direct equivalence proof: null and [] produce byte-identical index sets ---
check('[] produces the exact same Set contents as null (same size, same members)', () => {
  assert.equal(indexEmpty.size, indexNull.size);
  assert.deepEqual([...indexEmpty].sort(), [...indexNull].sort());
});

console.log(`\n${count} checks passed.`);
console.log('\nANSWER: with scopes = [], the result is byte-identical to scopes = null.');
console.log('Both mean "the current video itself could not be resolved" — the ONLY');
console.log('condition (post rule-change) under which an unscoped/legacy item still');
console.log('matches. Whenever scopes is non-empty (the current video DID resolve),');
console.log('unscoped items are excluded, same as any other non-matching item.');
