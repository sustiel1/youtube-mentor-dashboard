import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { parseTranscript } = await vite.ssrLoadModule('/src/services/youtubeTranscript.js');
  const { resolveTranscriptForChapters } = await vite.ssrLoadModule('/src/lib/videoTranscriptUtils.js');
  const { buildAnalysisTranscript } = await vite.ssrLoadModule('/src/lib/canonicalAnalysisRouting.js');
  const { matchChaptersToTranscript } = await vite.ssrLoadModule('/src/services/videoAnalytics.js');

  const parsed = parseTranscript({
    segments: [
      { text: 'later', startSeconds: 3, durationSeconds: 1 },
      { text: 'first real segment', startSeconds: 0.56, durationSeconds: 4.2 },
      { text: 'zero is valid', startSeconds: 0, durationSeconds: 1 },
      { text: 'invalid negative', startSeconds: -1 },
    ],
  });
  assert.deepEqual(parsed.segments.map((s) => s.startSeconds), [0, 0.56, 3]);

  const resolved = resolveTranscriptForChapters({
    transcriptText: 'x'.repeat(800),
    transcriptSegments: parsed.segments,
  });
  assert.equal(resolved.lines[1].startSeconds, 0.56);
  assert.equal(resolveTranscriptForChapters({ transcriptText: 'x'.repeat(800) }).lines.length, 0);

  const bounded = buildAnalysisTranscript('legacy fallback', parsed.segments);
  assert.ok(bounded.includes('[0.56] first real segment'));
  assert.ok(!bounded.includes('invalid negative'));
  assert.equal(buildAnalysisTranscript('legacy fallback', [{ text: 'bad', startSeconds: -1 }]), 'legacy fallback');

  const lines = Array.from({ length: 10 }, (_, index) => ({
    start: index * 10 + 0.56,
    text: index === 2 ? 'Federal Reserve interest rate decision and inflation outlook' : `unrelated filler ${index}`,
  }));
  const strong = matchChaptersToTranscript(
    [{ title: 'Federal Reserve decision', summary: 'interest rate and inflation outlook' }],
    { lines },
  );
  assert.equal(strong[0].startSeconds, 20.56);
  assert.equal(strong[0].timestampSource, 'youtube-timedtext');
  const weak = matchChaptersToTranscript([{ title: 'Completely absent subject' }], { lines });
  assert.equal(weak, null);

  const playerHook = fs.readFileSync(new URL('../src/hooks/useYouTubePlayer.js', import.meta.url), 'utf8');
  const panel = fs.readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
  const chapter = fs.readFileSync(new URL('../src/components/dashboard/ChapterItem.jsx', import.meta.url), 'utf8');
  assert.match(playerHook, /autoplay:\s*0/);
  assert.match(playerHook, /destroy/);
  assert.match(playerHook, /cueVideoById/);
  assert.match(panel, /playerRef=\{videoPlayerRef\}/);
  assert.match(panel, /ref=\{videoPlayerContainerRef\}/);
  assert.match(chapter, /אין זמן זמין/);
  assert.match(chapter, /aria-label=/);

  console.log(JSON.stringify({ status: 'passed', tests: 18, paidCalls: 0 }, null, 2));
} finally {
  await vite.close();
}
