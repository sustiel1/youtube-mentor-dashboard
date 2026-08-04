import assert from 'node:assert/strict';
import {
  persistGuardedMarketBrief,
  resolveMarketBriefPersistence,
} from '../src/lib/marketBriefPersistenceGuard.js';

const previous = {
  contentType: 'marketBrief',
  shortSummary: 'סיכום תקין קודם',
  universalTabs: { insights: [{ text: 'תובנה קודמת' }] },
  chapters: [{
    title: 'פתיחה',
    startSeconds: 0.56,
    endSeconds: 12.75,
    timestampSource: 'youtube-timedtext',
  }],
  transcriptSegments: [{ text: 'שלום עולם', startSeconds: 0.56, durationSeconds: 2.25 }],
  manualOverrides: { markets: { source: 'manual', rows: [{ value: 0, active: false }] } },
};

const localWrites = [];
const videoWrites = [];
const valid = persistGuardedMarketBrief({
  previous,
  candidate: { contentType: 'marketBrief', shortSummary: 'סיכום חדש בעברית', keyPoints: ['נקודה חדשה'] },
  videoId: 'video-1',
  writeLocal: (key, data) => localWrites.push({ key, data }),
  writeVideo: (data) => videoWrites.push(data),
});
assert.equal(valid.accepted, true);
assert.deepEqual(localWrites[0].data, videoWrites[0]);
assert.equal(valid.data.manualOverrides.markets.rows[0].value, 0);
assert.equal(valid.data.manualOverrides.markets.rows[0].active, false);
assert.equal(valid.data.chapters[0].startSeconds, 0.56);
assert.deepEqual(valid.data.transcriptSegments, previous.transcriptSegments);

for (const candidate of [
  null,
  { contentType: 'marketBrief' },
  { contentType: 'marketBrief', extractionMeta: { partial: true }, shortSummary: 'חלקי' },
  { contentType: 'marketBrief', chapters: 'bad', shortSummary: 'שגוי' },
]) {
  const beforeLocal = localWrites.length;
  const beforeVideo = videoWrites.length;
  const rejected = persistGuardedMarketBrief({
    previous,
    candidate,
    videoId: 'video-1',
    writeLocal: (key, data) => localWrites.push({ key, data }),
    writeVideo: (data) => videoWrites.push(data),
  });
  assert.equal(rejected.accepted, false);
  assert.deepEqual(rejected.data, previous);
  assert.equal(localWrites.length, beforeLocal);
  assert.equal(videoWrites.length, beforeVideo);
}

const legacy = resolveMarketBriefPersistence({
  candidate: { shortSummary: 'וידאו ישן ללא contentType', keyPoints: ['תואם legacy'] },
});
assert.equal(legacy.accepted, true);
assert.equal(legacy.data.contentType, 'marketBrief');

console.log(JSON.stringify({
  status: 'passed',
  synchronizedDestinations: true,
  rejectedWrites: 0,
  manualOverridePreserved: true,
  zeroAndFalsePreserved: true,
  decimalTimingPreserved: true,
  transcriptSegmentsPreserved: true,
  legacyCompatible: true,
}, null, 2));
