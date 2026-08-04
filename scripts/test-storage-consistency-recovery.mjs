import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

import { installMemoryLocalStorage } from './lib/memoryLocalStorage.mjs';

const fixture = JSON.parse(fs.readFileSync(
  new URL('./fixtures/storage-consistency-failure-matrix.json', import.meta.url),
  'utf8',
));
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    persistGuardedMarketBrief,
    resolveMarketBriefHydration,
    resolveMarketBriefPersistence,
  } = await vite.ssrLoadModule('/src/lib/marketBriefPersistenceGuard.js');
  const { updateStoredVideo } = await vite.ssrLoadModule('/src/services/videoStorage.js');

  const rich = fixture.morningRich;
  const olderLocal = {
    contentType: 'marketBrief',
    shortSummary: 'עותק מקומי ישן ודל',
    manualOverrides: {
      markets: {
        source: 'manual',
        updatedAt: '2026-08-03T10:00:00.000Z',
        rows: [{ asset: 'VIX', value: -2.5, active: false }],
      },
      sectors: {
        source: 'manual',
        updatedAt: '2026-08-04T09:00:00.000Z',
        rows: [{ sector: 'טכנולוגיה', direction: 'neutral' }],
      },
    },
  };

  const reconciled = resolveMarketBriefHydration({
    localCandidates: [
      { source: 'market_brief_video-1', data: olderLocal },
      { source: 'market_brief_alias', data: 'invalid-json' },
    ],
    videoData: rich,
  });
  assert.equal(reconciled.source, 'video.marketBriefData');
  assert.equal(reconciled.reconciled, true);
  assert.deepEqual(reconciled.data.universalTabs, rich.universalTabs);
  assert.equal(reconciled.data.manualOverrides.markets.rows[0].value, 0);
  assert.equal(reconciled.data.manualOverrides.markets.rows[0].active, false);
  assert.equal(reconciled.data.manualOverrides.markets.rows[0].change, -0.75);
  assert.equal(reconciled.data.manualOverrides.sectors.rows[0].sector, 'טכנולוגיה');
  assert.equal(reconciled.data.chapters[0].startSeconds, 0);
  assert.equal(reconciled.data.chapters[0].endSeconds, 12.75);
  assert.deepEqual(reconciled.data.transcriptSegments, rich.transcriptSegments);
  assert.equal(reconciled.diagnostic.rejectedSources[0].reason, 'INVALID_OBJECT');
  assert.deepEqual(
    resolveMarketBriefHydration({
      localCandidates: [{ source: 'market_brief_video-1', data: reconciled.data }],
      videoData: rich,
    }).data,
    reconciled.data,
  );

  const legacy = resolveMarketBriefHydration({
    localCandidates: [{ source: 'market_brief_legacy', data: fixture.genericLegacy }],
  });
  assert.equal(legacy.data.contentType, 'marketBrief');

  const evening = resolveMarketBriefPersistence({
    previous: rich,
    candidate: {
      contentType: 'marketBrief',
      marketSession: 'evening',
      shortSummary: 'סיכום ערב תקין',
      universalTabs: { summary: [{ text: 'ערב' }] },
    },
  });
  assert.equal(evening.accepted, true);
  assert.equal(evening.data.marketSession, 'evening');
  assert.equal(evening.data.manualOverrides.markets.rows[0].active, false);
  assert.equal(evening.data.chapters[0].endSeconds, 12.75);

  assert.equal(resolveMarketBriefHydration({
    localCandidates: [{ source: 'partial', data: fixture.eveningPartial }],
    videoData: fixture.malformed,
  }).data, null);

  const candidate = {
    contentType: 'marketBrief',
    shortSummary: 'candidate',
    universalTabs: { summary: [{ text: 'new' }] },
  };
  let durableLocal = null;
  const secondThrows = persistGuardedMarketBrief({
    previous: rich,
    candidate,
    videoId: 'video-1',
    writeLocal: (key, data) => {
      durableLocal = { key, data };
    },
    writeVideo: () => {
      throw new Error('injected video failure');
    },
  });
  assert.equal(secondThrows.accepted, false);
  assert.equal(secondThrows.reason, 'PARTIAL_PERSISTENCE');
  assert.equal(secondThrows.partialWrite, true);
  assert.equal(secondThrows.consistent, false);
  assert.equal(secondThrows.wroteLocal, true);
  assert.equal(secondThrows.wroteVideo, false);
  assert.deepEqual(secondThrows.recoveryData, durableLocal.data);
  assert.equal(secondThrows.previousDataPreserved, false);

  const silentSecond = persistGuardedMarketBrief({
    previous: rich,
    candidate,
    videoId: 'video-1',
    writeLocal: () => true,
    writeVideo: () => null,
  });
  assert.equal(silentSecond.accepted, false);
  assert.equal(silentSecond.reason, 'PARTIAL_PERSISTENCE');
  assert.equal(silentSecond.wroteVideo, false);
  assert.ok(silentSecond.recoveryData);

  let firstFailureVideoCalls = 0;
  const firstThrows = persistGuardedMarketBrief({
    previous: rich,
    candidate,
    videoId: 'video-1',
    writeLocal: () => {
      throw new Error('injected local failure');
    },
    writeVideo: () => {
      firstFailureVideoCalls += 1;
    },
  });
  assert.equal(firstThrows.reason, 'PERSISTENCE_WRITE_FAILED');
  assert.equal(firstThrows.partialWrite, false);
  assert.equal(firstThrows.previousDataPreserved, true);
  assert.equal(firstFailureVideoCalls, 0);

  let missingIdWrites = 0;
  const missingId = persistGuardedMarketBrief({
    previous: rich,
    candidate,
    writeLocal: () => { missingIdWrites += 1; },
    writeVideo: () => { missingIdWrites += 1; },
  });
  assert.equal(missingId.reason, 'MISSING_VIDEO_ID');
  assert.equal(missingIdWrites, 0);

  const missingWriter = persistGuardedMarketBrief({
    previous: rich,
    candidate,
    videoId: 'video-1',
    writeLocal: () => true,
  });
  assert.equal(missingWriter.reason, 'PERSISTENCE_WRITER_MISSING');
  assert.equal(missingWriter.wroteLocal, false);
  assert.equal(missingWriter.wroteVideo, false);

  const retryLocal = [];
  const retryVideo = [];
  const retry = persistGuardedMarketBrief({
    previous: secondThrows.recoveryData,
    candidate: secondThrows.recoveryData,
    videoId: 'video-1',
    writeLocal: (key, data) => retryLocal.push({ key, data }),
    writeVideo: (data) => retryVideo.push(data),
  });
  assert.equal(retry.accepted, true);
  assert.equal(retry.consistent, true);
  assert.deepEqual(retryLocal[0].data, retryVideo[0]);

  const memoryStorage = installMemoryLocalStorage();
  memoryStorage.setItem('yt_mentor_videos_v2', JSON.stringify([
    { id: 'video-1', title: 'בדיקת כשל כתיבה', marketBriefData: rich },
  ]));
  const originalSetItem = memoryStorage.setItem.bind(memoryStorage);
  memoryStorage.setItem = (key, value) => {
    if (key === 'yt_mentor_videos_v2') throw new Error('injected quota failure');
    return originalSetItem(key, value);
  };
  assert.equal(updateStoredVideo('video-1', { marketBriefData: candidate }), null);

  const runtimeSource = fs.readFileSync(
    new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url),
    'utf8',
  );
  assert.match(runtimeSource, /resolveMarketBriefHydration\(\{/);
  assert.doesNotMatch(runtimeSource, /if \(!loaded\) loaded = video\?\.marketBriefData/);
  assert.match(runtimeSource, /partialWrite && result\.recoveryData/);
  assert.match(runtimeSource, /persistence\.partialWrite \|\| !persistence\.recoveryData/);
  assert.match(runtimeSource, /try \{ localStorage\.setItem\(`gems-applied-/);

  console.log(JSON.stringify({
    status: 'passed',
    canonicalOwnerReused: true,
    deterministicHydration: true,
    invalidSourcesRejected: true,
    richerPayloadPreserved: true,
    manualOverridesReconciled: true,
    partialWriteRecoverable: true,
    silentVideoFailureDetected: true,
    firstWriteFailureStopsSecond: true,
    missingIdRejected: true,
    missingWriterRejected: true,
    retryIdempotent: true,
    videoStoreFailurePropagated: true,
    morningGenericEveningCompatible: true,
    hebrewZeroFalseNegativeDecimalTimingPreserved: true,
  }, null, 2));
} finally {
  await vite.close();
}
