/**
 * Full-video transcript ingestion coverage QA.
 *
 * Context: the production Claude handler (backend/analyze-video.function.js)
 * used to truncate every transcript to the first 8,000 characters before
 * calling Claude — a pre-existing production limit, not a pilot-only
 * artifact (see docs/session-closures for the audit). For the 40:03 /
 * 789-segment pilot video that meant only the first ~11 minutes of the video
 * were ever analyzed. The transcript itself is tiny (29,508 chars for a
 * 40-minute video, ~12.3 chars/sec) relative to Claude's context window, and
 * the model's output size is bounded by the fixed per-field item caps in
 * buildPrompt() rather than by transcript length — so a single request
 * safely covers any realistic video. TRANSCRIPT_CHAR_LIMIT was raised to
 * 200,000 chars (~4.5 hours at this density) instead of building multi-call
 * chunking, which nothing in this codebase currently needs.
 *
 * This script proves the resulting coverage math and the honesty guarantee:
 * a transcript that DOES exceed the limit must report itself as partial,
 * never silently upgraded to full.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseTimedTranscriptSegments,
  applyTimedNarrativeEvidenceGateToAnalysis,
  computeTranscriptCoverage,
} from '../src/lib/timedNarrativeEvidenceGate.js';

const backendSource = readFileSync(new URL('../backend/analyze-video.function.js', import.meta.url), 'utf8');
const backendModule = { exports: {} };
new Function('module', 'exports', 'require', backendSource)(backendModule, backendModule.exports, () => {
  throw new Error('Unexpected require in production handler');
});
const backendGate = backendModule.exports;

// ── Build a synthetic 40:03 / 789-segment fixture matching the pilot ───────
// video's measured density (~12.3 chars/sec), so the sizing math is real
// even though the transcript content itself is synthetic (no captured real
// content is duplicated into the repo by this test).
const SEGMENT_COUNT = 789;
const VIDEO_DURATION_SECONDS = 2403; // 40:03
const step = VIDEO_DURATION_SECONDS / SEGMENT_COUNT;
function buildFixtureTranscript(segmentCount, spacingSeconds, textLength) {
  const lines = [];
  for (let i = 0; i < segmentCount; i += 1) {
    const seconds = Math.floor(i * spacingSeconds);
    const text = `קטע מספר ${i} ` + 'א'.repeat(Math.max(0, textLength - 12));
    lines.push(`[${seconds}] ${text}`);
  }
  return lines.join('\n');
}
const fullVideoTranscript = buildFixtureTranscript(SEGMENT_COUNT, step, 37);

// ── 1 & 7. Full 40-minute/789-segment video is entirely covered by one
// request — no gaps, first and final segments both included ───────────────
{
  const rawTranscriptText = fullVideoTranscript;
  const transcriptText = rawTranscriptText.slice(0, backendGate.TRANSCRIPT_CHAR_LIMIT);
  assert.equal(transcriptText.length, rawTranscriptText.length, 'fixture must fit entirely under TRANSCRIPT_CHAR_LIMIT');

  const fullSegments = parseTimedTranscriptSegments(rawTranscriptText);
  const analyzedSegments = parseTimedTranscriptSegments(transcriptText);
  assert.equal(fullSegments.length, SEGMENT_COUNT);
  assert.equal(analyzedSegments.length, SEGMENT_COUNT);

  const coverage = computeTranscriptCoverage(fullSegments, analyzedSegments, rawTranscriptText.length, transcriptText.length);
  const backendCoverage = backendGate.computeTranscriptCoverage(fullSegments, analyzedSegments, rawTranscriptText.length, transcriptText.length);
  assert.deepEqual(backendCoverage, coverage);

  assert.equal(coverage.status, 'full');
  assert.equal(coverage.skippedSegments, 0);
  assert.equal(coverage.chunkCount, 1);
  assert.equal(coverage.coveragePercent, 100);
  assert.equal(coverage.totalSegments, SEGMENT_COUNT);
  assert.equal(coverage.analyzedSegments, SEGMENT_COUNT);
  // First transcript cue (segment 0, ~0s) and final cue (segment 788) are
  // both inside the analyzed range.
  assert.equal(coverage.transcriptStartSeconds, fullSegments[0].startSeconds);
  assert.equal(coverage.analyzedStartSeconds, fullSegments[0].startSeconds);
  assert.equal(coverage.transcriptEndSeconds, fullSegments[SEGMENT_COUNT - 1].startSeconds);
  assert.equal(coverage.analyzedEndSeconds, fullSegments[SEGMENT_COUNT - 1].startSeconds);
  assert.ok(coverage.analyzedEndSeconds >= 2390, `expected coverage to reach near the end of the video, got ${coverage.analyzedEndSeconds}`);
}

// ── 8 & 6. An oversized transcript (beyond TRANSCRIPT_CHAR_LIMIT) must
// report itself as partial, and evidence outside the analyzed portion must
// be rejected — never silently claimed as covered ──────────────────────────
{
  // ~4,000 segments at ~55 chars each ≈ 220,000 chars — deliberately over
  // the 200,000-char limit.
  const oversized = buildFixtureTranscript(4000, 3, 55);
  const rawTranscriptText = oversized;
  assert.ok(rawTranscriptText.length > backendGate.TRANSCRIPT_CHAR_LIMIT, 'fixture must actually exceed the limit to test this path');
  const transcriptText = rawTranscriptText.slice(0, backendGate.TRANSCRIPT_CHAR_LIMIT);

  const fullSegments = parseTimedTranscriptSegments(rawTranscriptText);
  const analyzedSegments = parseTimedTranscriptSegments(transcriptText);
  assert.ok(analyzedSegments.length < fullSegments.length);

  const coverage = computeTranscriptCoverage(fullSegments, analyzedSegments, rawTranscriptText.length, transcriptText.length);
  assert.equal(coverage.status, 'partial');
  assert.ok(coverage.skippedSegments > 0);
  assert.ok(coverage.coveragePercent < 100);

  // A claim quoting text that only exists in the skipped tail must be
  // rejected by the evidence gate (the model was never shown that text).
  const lastSkippedSegment = fullSegments[fullSegments.length - 1];
  const rawAnalysis = {
    keyPoints: [
      {
        text: 'טענה מהזנב שנחתך',
        estimatedStartSeconds: lastSkippedSegment.startSeconds,
        sourceQuote: lastSkippedSegment.text,
      },
    ],
  };
  const gated = applyTimedNarrativeEvidenceGateToAnalysis(rawAnalysis, analyzedSegments);
  assert.equal('estimatedStartSeconds' in gated.keyPoints[0], false, 'a claim about the truncated tail must not survive the gate');
  assert.equal(gated.keyPoints[0].text, 'טענה מהזנב שנחתך', 'content itself must still be preserved');
}

// ── No transcript at all → 'unknown', never mistaken for 'full' ────────────
{
  const coverage = computeTranscriptCoverage([], [], 0, 0);
  assert.equal(coverage.status, 'unknown');
}

// ── 10. Retry does not duplicate rows: the gate is a pure function with no
// cross-call state, so calling it twice on identical input is idempotent ──
{
  const rawAnalysis = {
    keyPoints: [
      { text: 'א', estimatedStartSeconds: 0, sourceQuote: 'קטע מספר 0' },
    ],
  };
  const segments = parseTimedTranscriptSegments(fullVideoTranscript.slice(0, 200));
  const first = applyTimedNarrativeEvidenceGateToAnalysis(rawAnalysis, segments);
  const second = applyTimedNarrativeEvidenceGateToAnalysis(rawAnalysis, segments);
  assert.deepEqual(first, second);
  assert.equal(first.keyPoints.length, 1);
  assert.equal(second.keyPoints.length, 1);
}

// ── 11. 0 remains a valid start second for a full-length video too ─────────
{
  const segments = parseTimedTranscriptSegments(fullVideoTranscript);
  const item = { text: 'פתיחה', estimatedStartSeconds: 0, sourceQuote: segments[0].text };
  const gated = applyTimedNarrativeEvidenceGateToAnalysis({ keyPoints: [item] }, segments);
  assert.equal(gated.keyPoints[0].estimatedStartSeconds, 0);
}

console.log('Static video full-coverage QA: PASS');
