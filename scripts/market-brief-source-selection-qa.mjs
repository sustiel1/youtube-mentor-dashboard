import assert from 'node:assert/strict';

import {
  MARKET_BRIEF_SOURCE_META_KEY,
  selectNewestMarketBriefCandidate,
  stampMarketBriefSource,
} from '../src/lib/marketBriefSourceSelection.js';

const older = stampMarketBriefSource(
  { contentType: 'marketBrief', marker: 'older', manualOverrides: { macro: { source: 'manual', rows: [] } } },
  { source: 'paste-video', savedAt: '2026-08-21T08:00:00.000Z' },
);
const newer = stampMarketBriefSource(
  { contentType: 'marketBrief', marker: 'newer' },
  { source: 'paste-video', savedAt: '2026-08-22T08:00:00.000Z' },
);

assert.equal(older.manualOverrides.macro.source, 'manual', 'stamping preserves the separate manual layer');
assert.deepEqual(older[MARKET_BRIEF_SOURCE_META_KEY], {
  source: 'paste-video',
  savedAt: '2026-08-21T08:00:00.000Z',
});

const selectedNewer = selectNewestMarketBriefCandidate([
  { data: older, origin: 'local-id', fallbackOrder: 0 },
  { data: newer, origin: 'video-record', fallbackOrder: 2 },
]);
assert.equal(selectedNewer.data.marker, 'newer', 'newest reliable timestamp wins');
assert.equal(selectedNewer.origin, 'video-record');

const legacySelection = selectNewestMarketBriefCandidate([
  { data: { marker: 'canonical-id-legacy' }, origin: 'local-id', fallbackOrder: 0 },
  { data: { marker: 'youtube-id-legacy' }, origin: 'local-youtube-id', fallbackOrder: 1 },
  { data: { marker: 'video-legacy' }, origin: 'video-record', fallbackOrder: 2 },
]);
assert.equal(
  legacySelection.data.marker,
  'canonical-id-legacy',
  'legacy records without timestamps retain deterministic canonical-key priority',
);

const explicitCandidateTimestamp = selectNewestMarketBriefCandidate([
  { data: { marker: 'legacy-cache' }, origin: 'local-id', fallbackOrder: 0 },
  {
    data: { marker: 'persisted-newer' },
    origin: 'video-record',
    explicitTimestamp: '2026-08-22T09:00:00.000Z',
    fallbackOrder: 2,
  },
]);
assert.equal(explicitCandidateTimestamp.data.marker, 'persisted-newer');

const selectedAfterReload = selectNewestMarketBriefCandidate([
  { data: JSON.parse(JSON.stringify(older)), origin: 'local-id', fallbackOrder: 0 },
  { data: JSON.parse(JSON.stringify(newer)), origin: 'video-record', fallbackOrder: 2 },
]);
assert.equal(selectedAfterReload.data.marker, 'newer', 'selection survives storage serialization and reload');

const invalidTimestampFallback = selectNewestMarketBriefCandidate([
  {
    data: { marker: 'invalid-date' },
    origin: 'local-id',
    explicitTimestamp: 'not-a-date',
    fallbackOrder: 0,
  },
  { data: { marker: 'legacy-second' }, origin: 'video-record', fallbackOrder: 1 },
]);
assert.equal(invalidTimestampFallback.data.marker, 'invalid-date');

assert.equal(selectNewestMarketBriefCandidate([]), null);

console.log('market brief source selection QA passed');
