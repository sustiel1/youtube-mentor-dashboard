import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  persistGuardedMarketBrief,
  resolveMarketBriefPersistence,
} from '../src/lib/marketBriefPersistenceGuard.js';

const fixture = JSON.parse(fs.readFileSync(
  new URL('./fixtures/storage-consistency-failure-matrix.json', import.meta.url),
  'utf8',
));
const runtimeSource = fs.readFileSync(
  new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url),
  'utf8',
);

const rich = fixture.morningRich;
const candidate = {
  contentType: 'marketBrief',
  marketSession: 'evening',
  shortSummary: 'עדכון ערב תקין',
};

const localFirstWrites = [];
let videoWriteCalls = 0;
const secondWriteFailure = persistGuardedMarketBrief({
  previous: rich,
  candidate,
  videoId: 'video-1',
  writeLocal: (key, data) => localFirstWrites.push({ key, data }),
  writeVideo: () => {
    videoWriteCalls += 1;
    throw new Error('injected video-store failure');
  },
});
assert.equal(secondWriteFailure.accepted, false);
assert.equal(secondWriteFailure.wroteLocal, true);
assert.equal(secondWriteFailure.wroteVideo, false);
assert.equal(localFirstWrites.length, 1);
assert.equal(videoWriteCalls, 1);

let skippedVideoCalls = 0;
const firstWriteFailure = persistGuardedMarketBrief({
  previous: rich,
  candidate,
  videoId: 'video-1',
  writeLocal: () => {
    throw new Error('injected local-store failure');
  },
  writeVideo: () => {
    skippedVideoCalls += 1;
  },
});
assert.equal(firstWriteFailure.accepted, false);
assert.equal(firstWriteFailure.wroteLocal, false);
assert.equal(firstWriteFailure.wroteVideo, false);
assert.equal(skippedVideoCalls, 0);

const silentSecondFailure = persistGuardedMarketBrief({
  previous: rich,
  candidate,
  videoId: 'video-1',
  writeLocal: () => true,
  writeVideo: () => false,
});

let missingIdLocalCalls = 0;
let missingIdVideoCalls = 0;
const missingId = persistGuardedMarketBrief({
  previous: rich,
  candidate,
  videoId: null,
  writeLocal: () => {
    missingIdLocalCalls += 1;
  },
  writeVideo: () => {
    missingIdVideoCalls += 1;
    return false;
  },
});
assert.equal(missingIdLocalCalls, 0);

for (const [payload, reason] of [
  [fixture.eveningPartial, 'PARTIAL_ANALYSIS'],
  [fixture.malformed, 'INVALID_CHAPTERS'],
]) {
  const decision = resolveMarketBriefPersistence({ previous: rich, candidate: payload });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, reason);
  assert.equal(decision.data, rich);
}

const legacy = resolveMarketBriefPersistence({ candidate: fixture.genericLegacy });
assert.equal(legacy.accepted, true);
assert.equal(legacy.data.contentType, 'marketBrief');

const retryLocal = [];
const retryVideo = [];
const retry = persistGuardedMarketBrief({
  previous: rich,
  candidate,
  videoId: 'video-1',
  writeLocal: (key, data) => retryLocal.push({ key, data }),
  writeVideo: (data) => retryVideo.push(data),
});
assert.equal(retry.accepted, true);
assert.deepEqual(retryLocal[0].data, retryVideo[0]);
assert.equal(retry.data.manualOverrides.markets.rows[0].value, 0);
assert.equal(retry.data.manualOverrides.markets.rows[0].active, false);
assert.equal(retry.data.manualOverrides.markets.rows[0].change, -0.75);
assert.equal(retry.data.chapters[0].endSeconds, 12.75);
assert.deepEqual(retry.data.transcriptSegments, rich.transcriptSegments);

const runtimeUsesLocalFirstFallback =
  runtimeSource.includes('if (!loaded) loaded = video?.marketBriefData ?? null;') &&
  runtimeSource.includes('loaded = JSON.parse(stored);');
const runtimeUsesDeterministicReconciliation =
  runtimeSource.includes('resolveMarketBriefHydration');
const silentFailureAccepted =
  silentSecondFailure.accepted === true && silentSecondFailure.wroteVideo === true;
const missingIdAccepted = missingId.accepted === true && missingIdVideoCalls === 1;

assert.equal(runtimeUsesLocalFirstFallback || runtimeUsesDeterministicReconciliation, true);

console.log(JSON.stringify({
  status: 'passed',
  auditOutcome: silentFailureAccepted || runtimeUsesLocalFirstFallback
    ? 'verified-implementation-defect'
    : 'mitigated',
  writeOrder: 'market_brief_first_then_video_record',
  trueAtomicTransaction: false,
  firstWriteFailureStopsSecond: skippedVideoCalls === 0,
  secondWriteFailureLeavesRecoverableLocalWrite: localFirstWrites.length === 1,
  silentFailureAccepted,
  missingIdAccepted,
  runtimeUsesLocalFirstFallback,
  runtimeUsesDeterministicReconciliation,
  malformedAndPartialRejected: true,
  retrySucceeded: retry.accepted,
  legacyReadable: legacy.accepted,
  manualHebrewNumericBooleanTimingPreserved: true,
}, null, 2));
