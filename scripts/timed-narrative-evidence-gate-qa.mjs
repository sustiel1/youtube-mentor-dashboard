import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseTimedTranscriptSegments,
  locateLiteralQuoteWindow,
  verifyTimedNarrativeEvidence,
  applyTimedNarrativeEvidenceGate,
  applyTimedNarrativeEvidenceGateToAnalysis,
  computeTranscriptCoverage,
} from '../src/lib/timedNarrativeEvidenceGate.js';
import { normalizeTimedNarrativeItem } from '../src/ai/gemini/validators/timedNarrative.js';
import { resolveStaticVideoTimestamp, buildStaticYouTubeTimestampLink } from '../src/lib/staticVideoTimestamp.js';

const TRANSCRIPT = [
  '[0] שלום וברוכים הבאים לשידור',
  '[8] היום נדבר על ניתוח טכני',
  '[15] הכלל הראשון הוא לשמור על סיכון מבוקר',
  '[30] בואו נמשיך לנושא הבא',
].join('\n');

const segments = parseTimedTranscriptSegments(TRANSCRIPT);
assert.equal(segments.length, 4);
assert.deepEqual(segments[0], { startSeconds: 0, text: 'שלום וברוכים הבאים לשידור' });
assert.deepEqual(segments[2], { startSeconds: 15, text: 'הכלל הראשון הוא לשמור על סיכון מבוקר' });

// ── 1. Valid quote + valid time → verified, kept ────────────────────────────
{
  const item = {
    text: 'שמור על סיכון מבוקר',
    estimatedStartSeconds: 15,
    timestampKind: 'estimated',
    timestampSource: 'youtube-transcript-segment',
    sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר',
  };
  const evidence = verifyTimedNarrativeEvidence(item, segments);
  assert.equal(evidence.verified, true);
  const gated = applyTimedNarrativeEvidenceGate(item, segments);
  assert.deepEqual(gated, item);
  const link = resolveStaticVideoTimestamp(normalizeTimedNarrativeItem(gated));
  assert.equal(link.seconds, 15);
  assert.equal(link.estimated, true);
}

// ── 2. Quote does not exist in transcript → time fields stripped ───────────
{
  const item = {
    text: 'תוכן שלא קיים',
    estimatedStartSeconds: 15,
    timestampKind: 'estimated',
    sourceQuote: 'משפט שלא קיים בתמלול בכלל',
  };
  const evidence = verifyTimedNarrativeEvidence(item, segments);
  assert.equal(evidence.verified, false);
  assert.equal(evidence.reason, 'quote-not-found');
  const gated = applyTimedNarrativeEvidenceGate(item, segments);
  assert.equal(gated.text, 'תוכן שלא קיים');
  assert.equal('estimatedStartSeconds' in gated, false);
  assert.equal('sourceQuote' in gated, false);
  assert.equal('timestampKind' in gated, false);
  const link = resolveStaticVideoTimestamp(normalizeTimedNarrativeItem(gated));
  assert.equal(link, null);
}

// ── 3. Time outside the verified quote window → stripped ───────────────────
{
  const item = {
    text: 'ניהול סיכונים',
    estimatedStartSeconds: 45,
    sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר',
  };
  const evidence = verifyTimedNarrativeEvidence(item, segments);
  assert.equal(evidence.verified, false);
  assert.equal(evidence.reason, 'time-outside-window');
  const gated = applyTimedNarrativeEvidenceGate(item, segments);
  assert.equal(gated.text, 'ניהול סיכונים');
  assert.equal('estimatedStartSeconds' in gated, false);
}

// ── 4. Time = 0 must be supported (not treated as falsy/missing) ───────────
{
  const item = {
    text: 'פתיחה',
    estimatedStartSeconds: 0,
    sourceQuote: 'שלום וברוכים הבאים לשידור',
  };
  const evidence = verifyTimedNarrativeEvidence(item, segments);
  assert.equal(evidence.verified, true);
  const gated = applyTimedNarrativeEvidenceGate(item, segments);
  assert.equal(gated.estimatedStartSeconds, 0);
  const link = resolveStaticVideoTimestamp(normalizeTimedNarrativeItem(gated));
  assert.equal(link.seconds, 0);
  assert.equal(link.label, '00:00');
  const fullLink = buildStaticYouTubeTimestampLink('fixtureVid1', normalizeTimedNarrativeItem(gated));
  assert.equal(fullLink.href, 'https://www.youtube.com/watch?v=fixtureVid1&t=0s');
}

// ── 4b. Boundary: exactly at the next segment's start is still inside ──────
{
  const item = { text: 'גבול', estimatedStartSeconds: 8, sourceQuote: 'שלום וברוכים הבאים לשידור' };
  assert.equal(verifyTimedNarrativeEvidence(item, segments).verified, true);
}
{
  const item = { text: 'מעבר לגבול', estimatedStartSeconds: 9, sourceQuote: 'שלום וברוכים הבאים לשידור' };
  assert.equal(verifyTimedNarrativeEvidence(item, segments).verified, false);
}

// ── 5. Missing / malformed fields never crash and never produce a link ─────
{
  const missingQuote = applyTimedNarrativeEvidenceGate(
    { text: 'בלי ציטוט', estimatedStartSeconds: 10 }, segments,
  );
  assert.equal(missingQuote.text, 'בלי ציטוט');
  assert.equal('estimatedStartSeconds' in missingQuote, false);

  const stringTime = applyTimedNarrativeEvidenceGate(
    { text: 'זמן כמחרוזת', estimatedStartSeconds: '15', sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר' },
    segments,
  );
  assert.equal('estimatedStartSeconds' in stringTime, false);

  const negativeTime = applyTimedNarrativeEvidenceGate(
    { text: 'זמן שלילי', estimatedStartSeconds: -5, sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר' },
    segments,
  );
  assert.equal('estimatedStartSeconds' in negativeTime, false);

  const nanTime = applyTimedNarrativeEvidenceGate(
    { text: 'זמן לא תקין', estimatedStartSeconds: NaN, sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר' },
    segments,
  );
  assert.equal('estimatedStartSeconds' in nanTime, false);

  assert.equal(applyTimedNarrativeEvidenceGate(null, segments), null);
  assert.equal(applyTimedNarrativeEvidenceGate('פשוט מחרוזת', segments), 'פשוט מחרוזת');
  assert.equal(applyTimedNarrativeEvidenceGate(undefined, segments), undefined);
  assert.equal(locateLiteralQuoteWindow(segments, ''), null);
  assert.equal(locateLiteralQuoteWindow([], 'משהו'), null);
  assert.equal(verifyTimedNarrativeEvidence({ text: 'בלי שום תביעת זמן' }, segments).hasClaim, false);
}

// ── 6. Content item is preserved after its time claim fails verification ───
{
  const item = {
    text: 'עצם התוכן חייב להישאר',
    keepMe: 'שדה נוסף שלא קשור לזמן',
    estimatedStartSeconds: 15,
    sourceQuote: 'ציטוט שלא קיים בתמלול',
  };
  const gated = applyTimedNarrativeEvidenceGate(item, segments);
  assert.equal(gated.text, 'עצם התוכן חייב להישאר');
  assert.equal(gated.keepMe, 'שדה נוסף שלא קשור לזמן');
}

// ── applyTimedNarrativeEvidenceGateToAnalysis: full raw-analysis wiring ────
{
  const rawAnalysis = {
    shortSummary: 'תקציר',
    keyPoints: [
      { text: 'א', estimatedStartSeconds: 15, sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר' },
      { text: 'ב', estimatedStartSeconds: 15, sourceQuote: 'ציטוט מומצא' },
      'מחרוזת פשוטה',
    ],
    chapters: [{ title: 'פרק', startSeconds: 0, endSeconds: 120 }],
  };
  const gated = applyTimedNarrativeEvidenceGateToAnalysis(rawAnalysis, segments);
  assert.equal(gated.keyPoints[0].estimatedStartSeconds, 15);
  assert.equal('estimatedStartSeconds' in gated.keyPoints[1], false);
  assert.equal(gated.keyPoints[2], 'מחרוזת פשוטה');
  // Chapters are a separate, committed mechanism — must never be touched.
  assert.deepEqual(gated.chapters, rawAnalysis.chapters);
  assert.equal(gated.chapters, rawAnalysis.chapters); // same reference, not even copied
}

console.log('Timed narrative evidence gate QA (shared module): PASS');

// ── Parity: the inlined backend copy must behave identically ───────────────
const backendSource = readFileSync(new URL('../backend/analyze-video.function.js', import.meta.url), 'utf8');
const backendModule = { exports: {} };
new Function('module', 'exports', 'require', backendSource)(backendModule, backendModule.exports, () => {
  throw new Error('Unexpected require in production handler');
});
const backendGate = backendModule.exports;
assert.equal(typeof backendGate.parseTimedTranscriptSegments, 'function');
assert.equal(typeof backendGate.applyTimedNarrativeEvidenceGateToAnalysis, 'function');

const backendSegments = backendGate.parseTimedTranscriptSegments(TRANSCRIPT);
assert.deepEqual(backendSegments, segments);

// ── computeTranscriptCoverage parity + behavior ─────────────────────────────
assert.equal(typeof backendGate.computeTranscriptCoverage, 'function');
{
  // Full coverage: analyzed set === full set.
  const shared = computeTranscriptCoverage(segments, segments, TRANSCRIPT.length, TRANSCRIPT.length);
  const backend = backendGate.computeTranscriptCoverage(backendSegments, backendSegments, TRANSCRIPT.length, TRANSCRIPT.length);
  assert.deepEqual(backend, shared);
  assert.equal(shared.status, 'full');
  assert.equal(shared.skippedSegments, 0);
  assert.equal(shared.coveragePercent, 100);
  assert.equal(shared.chunkCount, 1);
  assert.equal(shared.transcriptStartSeconds, 0);
  assert.equal(shared.transcriptEndSeconds, 30);
  assert.equal(shared.analyzedStartSeconds, 0);
  assert.equal(shared.analyzedEndSeconds, 30);
}
{
  // Partial coverage: only the first 2 of 4 segments were actually analyzed
  // (simulates a transcript that exceeded the input-size limit) — must be
  // reported as partial, never silently upgraded to full.
  const analyzed = segments.slice(0, 2);
  const shared = computeTranscriptCoverage(segments, analyzed, TRANSCRIPT.length, 50);
  assert.equal(shared.status, 'partial');
  assert.equal(shared.skippedSegments, 2);
  assert.equal(shared.analyzedSegments, 2);
  assert.equal(shared.totalSegments, 4);
  assert.equal(shared.coveragePercent, 50);
  assert.equal(shared.analyzedEndSeconds, 8);
  assert.equal(shared.transcriptEndSeconds, 30);
}
{
  // No transcript at all: reported as 'unknown', not 'full' or 'partial'.
  const shared = computeTranscriptCoverage([], [], 0, 0);
  assert.equal(shared.status, 'unknown');
  assert.equal(shared.totalSegments, 0);
  assert.equal(shared.coveragePercent, 0);
}

console.log('Timed narrative evidence gate QA (transcript coverage parity): PASS');

const parityFixtures = [
  { text: 'תקין', estimatedStartSeconds: 15, sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר' },
  { text: 'ציטוט חסר', estimatedStartSeconds: 15, sourceQuote: 'לא קיים' },
  { text: 'זמן חורג', estimatedStartSeconds: 45, sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר' },
  { text: 'אפס', estimatedStartSeconds: 0, sourceQuote: 'שלום וברוכים הבאים לשידור' },
  { text: 'בלי תביעת זמן בכלל' },
];
for (const fixture of parityFixtures) {
  const sharedResult = applyTimedNarrativeEvidenceGate(fixture, segments);
  // Backend only exposes the analysis-level wrapper (item-level helper is
  // internal to that file) — drive it through the same wrapper shape.
  const backendAnalysisResult = backendGate.applyTimedNarrativeEvidenceGateToAnalysis(
    { keyPoints: [{ ...fixture }] }, backendSegments,
  ).keyPoints[0];
  assert.deepEqual(backendAnalysisResult, sharedResult, `Parity mismatch for: ${fixture.text}`);
}

console.log('Timed narrative evidence gate QA (Claude/Gemini parity): PASS');
