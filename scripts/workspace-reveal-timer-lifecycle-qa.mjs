// QA for the WorkspaceLibrary.jsx reveal-highlight close-timer lifecycle.
//
// Why this shape: this repo has no vitest/jest and no `@testing-library/react`
// dependency (checked package.json), so there is no fake-timer harness to
// mount the real component and fast-forward its `useEffect`s. The fixed logic
// also lives inline inside a large page component and is not cleanly
// separable into a standalone hook without a larger refactor than this
// surgical fix authorizes. Per this script's own testing contract, the
// fallback is to re-implement the exact open/close-deadline algorithm from
// src/pages/WorkspaceLibrary.jsx as a plain-object harness and exercise it
// with real, scaled-down timers (a few hundred ms) instead of the production
// 7000ms default. Source-text assertions at the bottom tie this harness back
// to the actual implementation so the two cannot silently drift apart.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const TEST_DURATION_MS = 300; // scaled-down stand-in for the production 7000ms default

// Faithful re-implementation of the two-effect split in WorkspaceLibrary.jsx:
//  - "open" effect: fires on (items, revealToken, revealRecordIds, revealCount) changes;
//    opens once per token (guarded by handledRevealTokenRef) and stamps a fixed deadline.
//  - "close" effect: fires only when the stamped deadline (revealCloseAt) changes;
//    schedules a single setTimeout for the remaining time until that deadline.
function createRevealTimerHarness(durationMs) {
  let handledToken = '';
  let closeDeadlineRef = 0;
  let revealCloseAt = 0;
  let revealedIds = [];
  let closeTimeoutId = null;
  let unmounted = false;
  let postUnmountStateUpdate = false;

  function runCloseEffect() {
    if (closeTimeoutId) clearTimeout(closeTimeoutId);
    closeTimeoutId = null;
    if (!revealCloseAt) return;
    const delay = Math.max(0, revealCloseAt - Date.now());
    const openedDeadline = revealCloseAt;
    closeTimeoutId = setTimeout(() => {
      if (unmounted) {
        postUnmountStateUpdate = true;
        return;
      }
      // Only the timer scheduled for the currently active deadline may close it
      // (mirrors how a stale effect closure would still target the right state
      // update in React; a superseded deadline's effect cleanup already ran).
      if (revealCloseAt === openedDeadline) revealedIds = [];
    }, delay);
  }

  return {
    // Simulates a re-run of the "open" detection effect, e.g. triggered by an
    // unrelated `items` array identity change (same token) or a genuinely new
    // reveal token (from a fresh save action).
    runOpenEffect({ revealToken, revealIds }) {
      if (unmounted) return;
      if (!revealToken || handledToken === revealToken || revealIds.length === 0) return;
      handledToken = revealToken;
      revealedIds = revealIds;
      closeDeadlineRef = Date.now() + durationMs;
      if (closeDeadlineRef !== revealCloseAt) {
        revealCloseAt = closeDeadlineRef;
        runCloseEffect();
      }
    },
    unmount() {
      unmounted = true;
      if (closeTimeoutId) clearTimeout(closeTimeoutId);
      closeTimeoutId = null;
    },
    getState: () => ({ revealedIds, revealCloseAt, hasPendingTimer: closeTimeoutId !== null }),
    hadPostUnmountStateUpdate: () => postUnmountStateUpdate,
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testUnrelatedItemsUpdateDoesNotExtendDeadline() {
  const harness = createRevealTimerHarness(TEST_DURATION_MS);
  const openedAt = Date.now();
  harness.runOpenEffect({ revealToken: 'token-a', revealIds: ['r1'] });
  assert.deepEqual(harness.getState().revealedIds, ['r1'], 'reveal opens immediately');

  // Simulate an unrelated `items` reload firing partway through the window.
  await wait(Math.round(TEST_DURATION_MS * 0.5));
  harness.runOpenEffect({ revealToken: 'token-a', revealIds: ['r1', 'r2'] }); // same token, new items
  assert.deepEqual(harness.getState().revealedIds, ['r1'], 'same-token re-run does not re-open or reset the reveal');

  // Still within the original window: must still be revealed.
  assert.deepEqual(harness.getState().revealedIds, ['r1'], 'highlight remains visible mid-window after an unrelated update');

  // Wait past the ORIGINAL deadline (not extended by the mid-window update).
  await wait(TEST_DURATION_MS * 0.5 + 120);
  const elapsed = Date.now() - openedAt;
  assert.deepEqual(harness.getState().revealedIds, [], `highlight cleared by original deadline (elapsed ${elapsed}ms, expected ~${TEST_DURATION_MS}ms, not extended)`);
  assert.ok(elapsed < TEST_DURATION_MS + 250, 'clear happened close to the original open+duration, not delayed further');
}

async function testDeadlineNotExtendedByLastUpdateTime() {
  const harness = createRevealTimerHarness(TEST_DURATION_MS);
  harness.runOpenEffect({ revealToken: 'token-b', revealIds: ['r1'] });

  // Fire several unrelated updates right up near the deadline.
  await wait(Math.round(TEST_DURATION_MS * 0.8));
  const lastUpdateAt = Date.now();
  harness.runOpenEffect({ revealToken: 'token-b', revealIds: ['r1'] }); // same token, no-op

  // If the bug were present (deadline recomputed from "last update"), the
  // highlight would still be visible at lastUpdateAt + duration (that would
  // require waiting ~TEST_DURATION_MS more from here). Assert it is NOT, i.e.
  // it already cleared shortly after the original open + duration.
  await wait(Math.round(TEST_DURATION_MS * 0.3));
  assert.deepEqual(harness.getState().revealedIds, [], 'highlight is cleared before "last update + full duration" would have elapsed');
  const sinceLastUpdate = Date.now() - lastUpdateAt;
  assert.ok(sinceLastUpdate < TEST_DURATION_MS * 0.6, 'clear time is anchored to the original open, not the last unrelated update');
}

async function testNewTokenGetsFreshFullDurationLifecycle() {
  const harness = createRevealTimerHarness(TEST_DURATION_MS);
  harness.runOpenEffect({ revealToken: 'token-c', revealIds: ['r1'] });

  // A brand-new token arrives while the previous reveal is still active.
  await wait(Math.round(TEST_DURATION_MS * 0.5));
  const secondOpenAt = Date.now();
  harness.runOpenEffect({ revealToken: 'token-d', revealIds: ['r2'] });
  assert.deepEqual(harness.getState().revealedIds, ['r2'], 'a new token supersedes the previous reveal immediately');

  // Before the second token's own full duration elapses, it must still be visible
  // (proves the old timer was canceled, not stacked, and the new one got a fresh window).
  await wait(Math.round(TEST_DURATION_MS * 0.7));
  assert.deepEqual(harness.getState().revealedIds, ['r2'], 'second reveal still visible before its own fresh deadline');

  await wait(Math.round(TEST_DURATION_MS * 0.5));
  const elapsedSinceSecondOpen = Date.now() - secondOpenAt;
  assert.deepEqual(harness.getState().revealedIds, [], `second reveal clears at its own full duration (elapsed ${elapsedSinceSecondOpen}ms since its own open)`);
}

async function testUnmountClearsTimerWithoutPostUnmountStateUpdate() {
  const harness = createRevealTimerHarness(TEST_DURATION_MS);
  harness.runOpenEffect({ revealToken: 'token-e', revealIds: ['r1'] });
  assert.equal(harness.getState().hasPendingTimer, true, 'a close timer is pending after opening');

  harness.unmount();
  assert.equal(harness.getState().hasPendingTimer, false, 'unmount clears the pending timer handle');

  // Wait past what would have been the close deadline; confirm no state update happened.
  await wait(TEST_DURATION_MS + 100);
  assert.equal(harness.hadPostUnmountStateUpdate(), false, 'no state update occurs after unmount (no leaked timer firing)');
}

const results = [];
for (const [name, fn] of Object.entries({
  testUnrelatedItemsUpdateDoesNotExtendDeadline,
  testDeadlineNotExtendedByLastUpdateTime,
  testNewTokenGetsFreshFullDurationLifecycle,
  testUnmountClearsTimerWithoutPostUnmountStateUpdate,
})) {
  await fn();
  results.push(name);
}

// Tie the harness back to the real implementation so the two cannot silently drift.
const librarySource = readFileSync(new URL('../src/pages/WorkspaceLibrary.jsx', import.meta.url), 'utf8');
assert.match(librarySource, /closeDeadlineRef\.current = Date\.now\(\) \+ 7000;/, 'production stamps an absolute close deadline at open time (not a relative re-armed timer)');
assert.match(librarySource, /setRevealCloseAt\(closeDeadlineRef\.current\);/, 'production mirrors the deadline into state to drive the dedicated close effect');
assert.match(librarySource, /useEffect\(\(\) => \{\s*if \(!revealCloseAt\) return undefined;\s*const delay = Math\.max\(0, revealCloseAt - Date\.now\(\)\);/, 'production close effect computes remaining delay from the stamped deadline');
assert.match(librarySource, /\}, \[revealCloseAt\]\);/, 'production close effect depends only on revealCloseAt, not on items');

console.log(`Workspace reveal timer lifecycle QA passed (${results.length} scenarios): ${results.join(', ')}`);
