import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const event = await vite.ssrLoadModule('/src/lib/eventTiming.js');
  const evidence = await vite.ssrLoadModule('/src/lib/evidenceTimestamp.js');

  assert.equal(event.resolveDisplayEventTiming({ eventDate: '2026-08-05', eventTime: '08:30', timezone: 'America/New_York' }).timingStatus, 'verified');
  assert.equal(event.resolveDisplayEventTiming({ sourceRelativeText: 'today' }).timingStatus, 'unverified');
  assert.equal(event.resolveDisplayEventTiming([{ sourceRelativeText: 'today' }, { sourceRelativeText: 'tomorrow' }]).timingStatus, 'conflicting');
  assert.equal(event.resolveDisplayEventTiming({}).timingStatus, 'missing');

  assert.deepEqual(evidence.normalizeEvidenceTime({ startSeconds: 0, endSeconds: 4.5, timestampSource: 'youtube-timedtext', timestampConfidence: 1 }), {
    startSeconds: 0, endSeconds: 4.5, timestampSource: 'youtube-timedtext', timestampConfidence: 1,
  });
  assert.equal(evidence.normalizeEvidenceTime({ startSeconds: 4, timestampSource: 'explicit-input', timestampBasis: 'chunk-relative' }), null);
  assert.equal(evidence.normalizeEvidenceTime({ startSeconds: 10, timestampSource: 'explicit-input', timestampConfidence: 0.71 }), null);
  assert.equal(evidence.formatEvidenceTimestamp(522.4), '08:42');
  assert.equal(evidence.formatEvidenceTimestamp(3858.9), '1:04:18');

  const aligned = evidence.alignItemToTimedSegments(
    'CrowdStrike beat revenue and profit expectations after market close',
    [
      { text: 'CrowdStrike beat revenue and profit expectations', startSeconds: 522.4, durationSeconds: 4 },
      { text: 'after market close', startSeconds: 526.4, durationSeconds: 3 },
      { text: 'unrelated broad market discussion', startSeconds: 900 },
    ],
  );
  assert.equal(aligned.startSeconds, 522.4);
  assert.equal(aligned.timestampSource, 'timed-transcript-alignment');
  assert.equal(evidence.alignItemToTimedSegments('unsupported short text', []), null);

  console.log(JSON.stringify({ status: 'passed', eventTiming: true, evidenceTimestamp: true, uiWiring: false }, null, 2));
} finally {
  await vite.close();
}
