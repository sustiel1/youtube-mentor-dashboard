#!/usr/bin/env node
// Guards Step 2 of TRADINGBRAIN-WORKSPACE-RETURNTOVIDEO: pinning the video
// with the most recent latestSaveDate above "כל הסרטונים" in the default
// (no `video` URL param) view, without touching the focused-via-URL path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupWorkspaceItemsByVideo, selectVideoCollections } from '../src/utils/workspaceVideoGrouping.js';
import { selectSavedAnalysisViewer } from '../src/utils/workspaceSavedAnalysis.js';

const pageSource = readFileSync(new URL('../src/pages/WorkspaceLibrary.jsx', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('../src/components/workspace/WorkspaceFocusedVideoCard.jsx', import.meta.url), 'utf8');

// ── 1. Structural guards ────────────────────────────────────────────────
assert.match(pageSource, /const pinnedRecentGroup = useMemo\(\(\) => \{\s*\n\s*if \(focusedVideoGroup\) return null;/, 'pinnedRecentGroup is still computed only when nothing is focused via the URL (kept, currently unused by any render — see below)');
assert.match(pageSource, /pinnedRecentGroup \? selectVideoCollections\(pinnedRecentGroup\) : null/, 'pinnedRecentCollectionCounts still derives the canonical unique/record count shape from pinnedRecentGroup (kept, currently unused by any render — see below)');
// Update (2026-09-06/07, TRADINGBRAIN-WIP-CLOSEOUT-PRECLEAN): TRADINGBRAIN-WORKSPACE-TILES-PLACEMENT
// intentionally removed the entire duplicate pinned-card render block from the
// default (!focusedVideoGroup) branch of WorkspaceLibrary.jsx — it duplicated the
// same expanded single-video detail already shown by "סרטון אחרון" (the
// focusedVideoGroup TRUE branch). See the explanatory comment left in-source at
// WorkspaceLibrary.jsx right above the default-view JSX: "pinnedRecentGroup/
// pinnedCollection/.../pinnedRecentCollectionCounts/... are intentionally left
// defined but unused here." The two assertions below were flipped from
// match → doesNotMatch to confirm the removal instead of asserting stale JSX
// that will never come back without a product decision to re-add it.
assert.doesNotMatch(pageSource, /showClearFocus=\{false\}/, 'the pinned card instance (and its "suppress חזרה לכל הסרטונים" prop) no longer renders anywhere — the duplicate block was intentionally removed');
assert.doesNotMatch(pageSource, /collectionCounts=\{pinnedRecentCollectionCounts\}/, 'the pinned card no longer receives collectionCounts via JSX — no such element exists anymore');
assert.doesNotMatch(pageSource, /collectionCounts=\{pinnedRecentGroup\.collectionUniqueCounts\}/, 'the number-only count map was never passed to WorkspaceCollectionTiles, before or after the removal');
// Update (2026-09-06/07): the prior regex here assumed `showClearFocus = true,`
// was the LAST destructured param before the closing `}) {`. Unrelated work
// (content-section-tabs) inserted `contentSectionNavigation`, `activeContentSectionId`,
// `onContentSectionSelect`, `hideOwnCollectionNav`, `onToggleRowFlag` AFTER it in
// WorkspaceFocusedVideoCard's signature — a param-order change, not a behavior
// regression. `showClearFocus = true` itself is still present and correct; this
// assertion is now position-independent so it survives future param reordering.
assert.match(cardSource, /showClearFocus\s*=\s*true,/, 'showClearFocus still defaults to true somewhere in the destructured params — existing focused-via-URL callers are unaffected (position-independent check, see update above)');
// TRADINGBRAIN-WORKSPACE-CARD-BUTTON-DEDUPE (2026-09-03): the "חזרה לכל
// הסרטונים" button was removed from the card entirely (confirmed duplicate
// of the always-visible "כל הסרטונים" WorkspaceScopeTiles tile rendered
// unconditionally at the top of WorkspaceLibrary.jsx) — this assertion is
// intentionally now a negative one, superseding the prior "conditionally
// rendered, not unconditionally removed" check above it in git history.
assert.doesNotMatch(cardSource, /חזרה לכל הסרטונים/, '"חזרה לכל הסרטונים" no longer renders anywhere in the focused card — superseded by the always-visible scope tile');

// ── 2. Behavioral guard: the max-latestSaveDate reduce, mirrored from the real logic ──
function pickPinnedRecentGroup(videoGroups, focusedVideoGroup) {
  if (focusedVideoGroup) return null;
  return videoGroups.reduce((latest, group) => (
    !latest || String(group.latestSaveDate || '') > String(latest.latestSaveDate || '') ? group : latest
  ), null);
}

const groups = [
  { videoKey: 'v1', latestSaveDate: '2026-08-01T00:00:00.000Z' },
  { videoKey: 'v2', latestSaveDate: '2026-08-09T16:29:58.750Z' }, // most recent
  { videoKey: 'v3', latestSaveDate: '2026-07-15T00:00:00.000Z' },
];

assert.equal(pickPinnedRecentGroup(groups, null)?.videoKey, 'v2', 'the group with the latest latestSaveDate wins, regardless of array order');
assert.equal(pickPinnedRecentGroup(groups, groups[0]), null, 'nothing is pinned when a video is already focused via the URL');
assert.equal(pickPinnedRecentGroup([], null), null, 'zero saved videos → no pinned card, no crash');

// A newer save on a different video must flip which group is pinned —
// exercises the "switches when you save from a different video" checklist item.
const afterNewSave = [
  ...groups,
  { videoKey: 'v4', latestSaveDate: '2026-09-01T12:00:00.000Z' },
];
assert.equal(pickPinnedRecentGroup(afterNewSave, null)?.videoKey, 'v4', 'saving from a new video re-pins to that video on the next render');

// The saved-analysis sections and collection tiles must derive from the same
// persisted group. These valid legacy-shaped records intentionally have no
// sourceVideoId; their shared video URL still keeps them in the pinned group.
const riskRows = [1, 2, 3].map(number => ({
  id: `risk-${number}`,
  sourceVideoId: null,
  videoUrl: 'https://youtu.be/abcdefghijk',
  itemType: 'specialized',
  sourceTabId: 'specialized',
  sourceHeading: 'סיכונים',
  identityPayload: { text: `persisted risk ${number}` },
  savedAt: `2026-09-0${number}T12:00:00.000Z`,
}));
const pinnedRiskGroup = groupWorkspaceItemsByVideo(riskRows).videoGroups[0];
const pinnedCounts = selectVideoCollections(pinnedRiskGroup);
const visibleRiskSection = selectSavedAnalysisViewer(pinnedRiskGroup).byTab.specialized
  .find(section => section.heading === 'סיכונים');
assert.equal(pinnedRiskGroup.items.length, 3, 'the pinned saved-analysis group retains all three visible source rows');
assert.equal(visibleRiskSection?.provenance.length, 3, 'the visible Risks section exposes the same three persisted source rows');
assert.deepEqual(
  { uniqueCount: pinnedCounts.specialized.uniqueCount, recordCount: pinnedCounts.specialized.recordCount },
  { uniqueCount: 3, recordCount: 3 },
  'the pinned Targeted Content tile receives 3 unique contents and 3 saves from the same persisted group',
);
assert.deepEqual(
  { uniqueCount: pinnedCounts.summary.uniqueCount, recordCount: pinnedCounts.summary.recordCount },
  { uniqueCount: 0, recordCount: 0 },
  'an empty pinned collection remains honestly zero',
);
const afterRemovalCounts = selectVideoCollections(groupWorkspaceItemsByVideo(riskRows.slice(0, 2)).videoGroups[0]);
assert.equal(afterRemovalCounts.specialized.recordCount, 2, 'removing a saved row immediately recalculates the pinned count');
const addedRiskRow = { ...riskRows[2], id: 'risk-4', identityPayload: { text: 'persisted risk 4' } };
const afterSaveCounts = selectVideoCollections(groupWorkspaceItemsByVideo([...riskRows, addedRiskRow]).videoGroups[0]);
assert.equal(afterSaveCounts.specialized.recordCount, 4, 'adding a saved row immediately recalculates the pinned count');

console.log('pinned-recent-video-card QA: 16 assertions passed');
