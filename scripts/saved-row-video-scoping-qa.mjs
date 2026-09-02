// QA for video-scoped matching in the "already saved to Workspace" per-row
// indicator (workspaceSavedRowLookup.js / useSavedRowIndex.js). Pure module,
// no '@/' aliases used anywhere in its own import chain, so no alias-loader
// bootstrap is required to run this script.
//
// Extends the original round-1/round-4 reproduction that first proved the
// unscoped-matching limitation (two saved items with identical
// category+text falsely both counting as "saved" for any video, and a
// delete not clearing the badge when a colliding duplicate survives). This
// round adds video scoping at index-build time: an item participates in a
// given video's index only if it resolves to that same video, or has no
// resolvable video identity at all (legacy fallback).
//
// Covers TWO real save-time conventions for the "same real video" that
// were found to disagree while writing this suite (not assumed correct
// up front — the first draft of this fix used only the id-based
// convention and this exact test caught the mismatch):
//   - post-fix (commit 8b073512d) saves: sourceVideoId falls back to the
//     video's own internal `id` when no youtubeId/videoId is populated.
//   - pre-fix legacy saves: sourceVideoId was never set at all, so
//     resolveVideoScope() falls through to extracting the youtube id from
//     `videoUrl` instead.
// Both must be treated as "the current video" — see buildSavedRowIndex()'s
// doc comment in workspaceSavedRowLookup.js for the full explanation.
//
//   node scripts/saved-row-video-scoping-qa.mjs

import assert from 'node:assert/strict';

import {
  buildSavedRowIndex,
  isRowAlreadySaved,
  resolveVideoScope,
} from '../src/utils/workspaceSavedRowLookup.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

const TEXT = 'מדד S&P 500 מוסיף שווה בהודים ומועיד עד הולשת רחב יותר';
const CATEGORY = 'indices';

/** Mirrors useSavedRowIndex.js's own two-candidate resolution exactly. */
function scopesOf(video) {
  const idCandidate = video?.youtubeId || video?.videoId || video?.id || null;
  const urlCandidate = video?.url || null;
  const idScope = idCandidate ? resolveVideoScope({ sourceVideoId: idCandidate }) : null;
  const urlScope = urlCandidate ? resolveVideoScope({ videoUrl: urlCandidate }) : null;
  return [idScope, urlScope].filter(Boolean);
}

// Two real videos, shaped like real records in this app: no youtubeId/videoId,
// only an internal `id` plus a `url` that embeds the real YouTube id.
const video1 = { id: 'internal-1', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' };
const video2 = { id: 'internal-2', url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' };
const video3NoIdentity = {}; // no id, no url — unresolvable, mirrors a real edge case

// A saved item produced by the POST-FIX save path for video1: sourceVideoId
// falls back to the video's own internal id (youtubeId/videoId are null in
// this app's real records).
const itemA_postFix = { id: 'ws-A', itemType: 'indices', sourceVideoId: 'internal-1', rawSourceText: TEXT };
const itemA2_postFix = { id: 'ws-A2', itemType: 'indices', sourceVideoId: 'internal-1', rawSourceText: TEXT }; // genuine duplicate save, same video
const itemB_postFix = { id: 'ws-B', itemType: 'indices', sourceVideoId: 'internal-2', rawSourceText: TEXT };

// A saved item produced by the PRE-FIX (legacy) save path for video1:
// sourceVideoId was never set; only videoUrl was populated.
const itemA_preFix = { id: 'ws-A-legacy', itemType: 'indices', videoUrl: video1.url, rawSourceText: TEXT };

// A truly unresolvable item — neither sourceVideoId nor videoUrl (e.g. a
// manually-entered snippet with no video context at all).
const trulyUnresolvable = { id: 'ws-unresolvable', itemType: 'indices', rawSourceText: TEXT };

// ── baseline: original unscoped behavior preserved when no video is open ──
check('no currentVideoScopes passed: an unresolvable saved item still matches (backward compatible)', () => {
  const index = buildSavedRowIndex([trulyUnresolvable]);
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), true);
});

// ── two conventions for "the same real video" both recognized ──
check('post-fix item (sourceVideoId = internal id) matches when viewing that same video', () => {
  const index = buildSavedRowIndex([itemA_postFix], scopesOf(video1));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), true);
});
check('pre-fix legacy item (videoUrl only, no sourceVideoId) ALSO matches when viewing that same video', () => {
  const index = buildSavedRowIndex([itemA_preFix], scopesOf(video1));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), true);
});
check('REGRESSION GUARD: single-candidate scoping (id-only) would have missed the pre-fix legacy item — confirm the fix needs both candidates, not just one', () => {
  const idOnlyScope = resolveVideoScope({ sourceVideoId: video1.id }); // what a naive id-only implementation would have used
  const index = buildSavedRowIndex([itemA_preFix], [idOnlyScope]);
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), false, 'if this ever passes, the two-candidate design was dropped and pre-fix legacy items will silently stop tagging');
});

// ── cross-video: item does not leak into an unrelated video's index ──
check('item A (video1) does not appear as saved when viewing the unrelated video2', () => {
  const index = buildSavedRowIndex([itemA_postFix], scopesOf(video2));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), false);
});
check('item B (video2) does not appear as saved when viewing video1', () => {
  const index = buildSavedRowIndex([itemB_postFix], scopesOf(video1));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), false);
});
check('two items, same text, different videos: video1 sees only its own item as saved', () => {
  const index = buildSavedRowIndex([itemA_postFix, itemB_postFix], scopesOf(video1));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), true); // via A
});
check('same fixture, a third unrelated resolvable video sees no match at all', () => {
  const video4 = { id: 'internal-4', url: 'https://www.youtube.com/watch?v=ccccccccccc' };
  const index = buildSavedRowIndex([itemA_postFix, itemB_postFix], scopesOf(video4));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), false);
});

// ── delete one of two duplicates WITHIN the same video — tag correctly persists ──
check('video1 has two saved duplicates (A, A2); deleting A leaves A2 — tag persists (correct)', () => {
  const index = buildSavedRowIndex([itemA2_postFix], scopesOf(video1)); // A deleted, A2 remains
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), true);
});

// ── delete the LAST matching item for a video — tag clears ──
check('video1 has zero remaining saved items after both A and A2 are deleted — tag clears', () => {
  const index = buildSavedRowIndex([], scopesOf(video1));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), false);
});

// ── FALLBACK RULE CHANGE (WORK-ID TRADINGBRAIN-ANALYSIS-SAVEDROW-INDICATOR,
// "כלל ההתאמה" round): an unscoped/unresolvable saved item now tags a row
// ONLY when the CURRENTLY OPEN video itself cannot be resolved. Once the
// open video resolves to at least one scope, unscoped items are excluded —
// this is the fix for the reported bug (legacy unscoped items kept tagging
// rows for a video whose own matching rows had already been deleted). ──
check('truly unresolvable item does NOT tag a row when viewing video1 (video1 resolves)', () => {
  const index = buildSavedRowIndex([trulyUnresolvable], scopesOf(video1));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), false);
});
check('same unresolvable item does NOT tag a row when viewing a completely different video2 (video2 resolves)', () => {
  const index = buildSavedRowIndex([trulyUnresolvable], scopesOf(video2));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), false);
});
check('same unresolvable item STILL tags when the CURRENT video itself has no resolvable identity (fallback preserved)', () => {
  const index = buildSavedRowIndex([trulyUnresolvable], scopesOf(video3NoIdentity));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), true);
});
check('same unresolvable item STILL tags when no currentVideoScopes is passed at all (null, fallback preserved)', () => {
  const index = buildSavedRowIndex([trulyUnresolvable], null);
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), true);
});

// ── mixed: a video's own resolvable save is what tags it now, not the unscoped item ──
check('video1 sees its own resolvable item as saved; the unrelated unresolvable item no longer contributes', () => {
  const index = buildSavedRowIndex([itemA_postFix, trulyUnresolvable], scopesOf(video1));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), true); // via itemA_postFix only now
});
check('video2 (no own save) does NOT see the unresolvable item tag item A\'s text — fixes the reported bug', () => {
  const index = buildSavedRowIndex([itemA_postFix, trulyUnresolvable], scopesOf(video2));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, index), false);
});

// ── exact reported-bug reproduction: deleting the last SCOPED item for a video
// now correctly clears the tag, even though unrelated unscoped legacy items
// for OTHER videos remain in storage (previously these kept the tag alive). ──
check('reported-bug repro: after deleting video1\'s own saved items, the tag clears even though unscoped legacy items from elsewhere still exist in storage', () => {
  const unrelatedLegacyItem1 = { id: 'ws-legacy-1', itemType: CATEGORY, rawSourceText: TEXT };
  const unrelatedLegacyItem2 = { id: 'ws-legacy-2', itemType: CATEGORY, rawSourceText: TEXT };
  // Before delete: video1's own item + 2 unscoped legacy items sharing the same text.
  const beforeDelete = buildSavedRowIndex([itemA_postFix, unrelatedLegacyItem1, unrelatedLegacyItem2], scopesOf(video1));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, beforeDelete), true);
  // After deleting ONLY itemA_postFix (video1's own row) — the 2 unscoped legacy
  // items remain in storage untouched, but must no longer keep the tag alive.
  const afterDelete = buildSavedRowIndex([unrelatedLegacyItem1, unrelatedLegacyItem2], scopesOf(video1));
  assert.equal(isRowAlreadySaved(TEXT, CATEGORY, afterDelete), false);
});

// ── structured-snapshot items never collide with any live row category (requirement 3 finding) ──
check('a structured-snapshot item with identical text never satisfies a live "indices" row check', () => {
  const snapshotItem = {
    id: 'ws-snapshot-1',
    itemType: 'structured-snapshot',
    sourceVideoId: 'internal-1',
    notes: TEXT, // persistedText() falls through to notes for snapshot items
  };
  const index = buildSavedRowIndex([snapshotItem], scopesOf(video1));
  // The snapshot item DOES occupy its own 'structured-snapshot' key (expected —
  // that's just how the Set works), but no live row renderer ever passes that
  // category to isRowAlreadySaved(), so it can never be reached from a real row.
  // The only claim that matters is that it never satisfies a REAL row category:
  assert.equal(isRowAlreadySaved(TEXT, 'indices', index), false);
});

// ── resolveVideoScope() itself ──
check('resolveVideoScope prefers a direct sourceVideoId over URL extraction when both are given', () => {
  const scope = resolveVideoScope({ sourceVideoId: 'zzzzzzzzzzz', videoUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' });
  assert.equal(scope, 'video:zzzzzzzzzzz');
});
check('resolveVideoScope falls back to URL-extracted id when sourceVideoId is absent', () => {
  const scope = resolveVideoScope({ sourceVideoId: null, videoUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' });
  assert.equal(scope, 'video:aaaaaaaaaaa');
});
check('resolveVideoScope returns null when neither sourceVideoId nor a parseable URL is present', () => {
  assert.equal(resolveVideoScope({}), null);
  assert.equal(resolveVideoScope({ videoUrl: 'not a url' }), null);
});

console.log(`\nsaved-row video-scoping QA: ${count} checks passed`);
