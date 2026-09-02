#!/usr/bin/env node
// Guards Step 2 of TRADINGBRAIN-WORKSPACE-RETURNTOVIDEO: pinning the video
// with the most recent latestSaveDate above "כל הסרטונים" in the default
// (no `video` URL param) view, without touching the focused-via-URL path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('../src/pages/WorkspaceLibrary.jsx', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('../src/components/workspace/WorkspaceFocusedVideoCard.jsx', import.meta.url), 'utf8');

// ── 1. Structural guards ────────────────────────────────────────────────
assert.match(pageSource, /const pinnedRecentGroup = useMemo\(\(\) => \{\s*\n\s*if \(focusedVideoGroup\) return null;/, 'pinnedRecentGroup is only computed when nothing is focused via the URL');
assert.match(pageSource, /showClearFocus=\{false\}/, 'the pinned card instance suppresses "חזרה לכל הסרטונים" (meaningless when already on the all-videos view)');
assert.match(pageSource, /collectionCounts=\{pinnedRecentGroup\.collectionUniqueCounts\}/, 'the pinned card uses its own per-video collection counts, not the global scope\'s counts');
assert.match(cardSource, /showClearFocus\s*=\s*true,?\s*\n\}\) \{/, 'showClearFocus defaults to true — existing focused-via-URL callers are unaffected');
assert.match(cardSource, /\{showClearFocus && <button type="button" onClick=\{onClearFocus\}/, '"חזרה לכל הסרטונים" is conditionally rendered, not unconditionally removed');

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

console.log('pinned-recent-video-card QA: 8 assertions passed');
