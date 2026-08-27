/**
 * ISOLATED, ONE-TIME authorized pilot: sends the complete 789-segment /
 * 40:03 transcript of 9su_tZfRYrI to the production Claude handler's exact
 * pipeline (prompt build -> call -> parse -> evidence gate -> coverage),
 * calling each exported production sub-function directly (not a
 * reimplementation) so the result is provably production-equivalent.
 *
 * Payload restriction (explicitly authorized): the outbound prompt carries
 * ONLY the transcript + fixed analysis instructions/schema. No title,
 * mentor, category, channel, local record id, or videoId. This is asserted
 * automatically below BEFORE the network call — the script aborts if any
 * forbidden value is present.
 *
 * Zero genuine storage: no entities object is even constructed here: this
 * script never calls anything resembling entities.Video.update. There is no
 * write path to hit.
 */
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadEnv } from 'vite';
import { normalizeAiAnalysisResult } from '../src/services/videoAnalytics.js';
import { verifyTimedNarrativeEvidence } from '../src/lib/timedNarrativeEvidenceGate.js';

const VIDEO_ID = '9su_tZfRYrI';
const RECORD_ID_FOR_REFERENCE_ONLY = 'local_1787391349973_v4gll'; // never sent to Claude
const REAL_TITLE_FOR_REFERENCE_ONLY = 'לייב פתיחה לתאריך 21.8.26'; // never sent to Claude
const DURATION_SECONDS = 2403; // 40:03 — a timing fact, not identity metadata
const TRANSCRIPT_URL = `http://127.0.0.1:5184/api/youtube-transcript?v=${VIDEO_ID}&diagnostics=1`;

// Diagnostic output is written OUTSIDE the repository — never git-tracked,
// never staged, retained/deleted only per explicit approval. Only the raw
// model text + usage/stop_reason are ever written — never request headers,
// the API key, or any other environment/secret value.
const DIAG_DIR = path.join(tmpdir(), 'ymd-full-coverage-pilot');
mkdirSync(DIAG_DIR, { recursive: true });
function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
function writeDiagFile(name, content) {
  const filePath = path.join(DIAG_DIR, name);
  writeFileSync(filePath, content, 'utf8');
  return { path: filePath, sha256: sha256(content), bytes: Buffer.byteLength(content, 'utf8') };
}

const env = loadEnv('development', process.cwd(), '');
process.env.ANTHROPIC_API_KEY ||= env.ANTHROPIC_API_KEY;
process.env.VITE_ANTHROPIC_API_KEY ||= env.VITE_ANTHROPIC_API_KEY;
if (!process.env.ANTHROPIC_API_KEY && !process.env.VITE_ANTHROPIC_API_KEY) {
  throw new Error('Anthropic key is unavailable for the isolated full-coverage pilot');
}

const transcriptResponse = await fetch(TRANSCRIPT_URL);
if (!transcriptResponse.ok) throw new Error(`Transcript fetch failed: ${transcriptResponse.status}`);
const transcriptPayload = await transcriptResponse.json();
const segments = Array.isArray(transcriptPayload.segments) ? transcriptPayload.segments : [];
if (segments.length === 0) throw new Error('Timestamped transcript is empty');

const timestampedTranscript = segments.map((segment) => {
  const seconds = Math.floor(Number(segment.startSeconds ?? segment.start));
  return `[${seconds}] ${String(segment.text || '').trim()}`;
}).join('\n');

const backendSource = readFileSync(new URL('../backend/analyze-video.function.js', import.meta.url), 'utf8');
const backendModule = { exports: {} };
new Function('module', 'exports', 'require', backendSource)(backendModule, backendModule.exports, () => {
  throw new Error('Unexpected require in production handler');
});
const be = backendModule.exports;
for (const fn of ['buildPrompt', 'callClaude', 'parseClaudeJson', 'parseTimedTranscriptSegments', 'applyTimedNarrativeEvidenceGateToAnalysis', 'computeTranscriptCoverage']) {
  assert.equal(typeof be[fn], 'function', `production export missing: ${fn}`);
}

// ── Sanitized call params: strictly no record metadata ──────────────────────
const callParams = {
  title: '',
  transcript: timestampedTranscript,
  durationSeconds: DURATION_SECONDS,
  mentor: null,
  category: null,
};

const rawTranscriptText = String(callParams.transcript).trim();
const transcriptText = rawTranscriptText.slice(0, be.TRANSCRIPT_CHAR_LIMIT);
const chaptersTarget = DURATION_SECONDS > 0
  ? (DURATION_SECONDS <= 14 * 60 ? 5 : DURATION_SECONDS <= 22 * 60 ? 7 : 8)
  : 6;

const outboundPrompt = be.buildPrompt({
  title: callParams.title,
  transcript: transcriptText,
  durationSeconds: callParams.durationSeconds,
  mentor: callParams.mentor,
  category: callParams.category,
  chaptersTarget,
});

// ══════════════════════════════════════════════════════════════════════════
// PRE-FLIGHT ASSERTIONS — the script aborts before any network call if any
// of these fail.
// ══════════════════════════════════════════════════════════════════════════

// 1. Forbidden metadata must be absent from the exact outbound prompt.
const forbiddenValues = [
  REAL_TITLE_FOR_REFERENCE_ONLY,
  VIDEO_ID,
  RECORD_ID_FOR_REFERENCE_ONLY,
  'מנטור:',
  'קטגוריה:',
];
const violations = forbiddenValues.filter((value) => outboundPrompt.includes(value));
assert.deepEqual(violations, [], `ABORT: forbidden metadata found in outbound prompt: ${JSON.stringify(violations)}`);

// 2. Transcript must not be truncated.
assert.equal(transcriptText.length, rawTranscriptText.length, 'ABORT: transcript would be truncated by TRANSCRIPT_CHAR_LIMIT');
assert.ok(transcriptText.length <= be.TRANSCRIPT_CHAR_LIMIT);

// 3. Predicted coverage must be full, 789/789, 0 skipped, 100%.
const fullSegmentsPreCall = be.parseTimedTranscriptSegments(rawTranscriptText);
const analyzedSegmentsPreCall = be.parseTimedTranscriptSegments(transcriptText);
const predictedCoverage = be.computeTranscriptCoverage(
  fullSegmentsPreCall, analyzedSegmentsPreCall, rawTranscriptText.length, transcriptText.length
);
assert.equal(predictedCoverage.totalSegments, 789, `ABORT: expected 789 total segments, got ${predictedCoverage.totalSegments}`);
assert.equal(predictedCoverage.analyzedSegments, 789, `ABORT: expected 789 analyzed segments, got ${predictedCoverage.analyzedSegments}`);
assert.equal(predictedCoverage.skippedSegments, 0, `ABORT: expected 0 skipped segments, got ${predictedCoverage.skippedSegments}`);
assert.equal(predictedCoverage.coveragePercent, 100, `ABORT: expected 100% coverage, got ${predictedCoverage.coveragePercent}`);
assert.equal(predictedCoverage.status, 'full', `ABORT: expected status 'full', got ${predictedCoverage.status}`);

// 4. videoId is never a parameter of buildPrompt at all (structural guarantee,
// not just a string-absence check) — confirmed by construction: callParams
// passed to buildPrompt above contains no videoId field.
assert.equal('videoId' in callParams, false, 'ABORT: videoId must not be part of the prompt-building params');

// 5. realStorageWrites: this script never constructs an entities object and
// never calls anything resembling entities.Video.update — asserted here as
// a documented invariant of the script itself, verified by code review.
const realStorageWrites = 0;

const charCount = outboundPrompt.length;
const estTokensLow = Math.ceil(charCount / 4);
const estTokensHigh = Math.ceil(charCount / 2.5);

const precallAudit = {
  charCount,
  estTokensLow,
  estTokensHigh,
  transcriptTruncated: false,
  predictedCoverage,
  forbiddenMetadataCheckPassed: true,
  realStorageWrites,
};
console.log(`PRECALL_AUDIT=${JSON.stringify(precallAudit)}`);
console.log('All pre-flight assertions passed.');

if (process.env.DRY_RUN === '1') {
  console.log('DRY_RUN=1 set — stopping before the network call, as requested.');
  process.exit(0);
}
console.log('Proceeding with the single authorized Claude call...');

// ══════════════════════════════════════════════════════════════════════════
// THE ONE AUTHORIZED CALL
// ══════════════════════════════════════════════════════════════════════════
const selectedModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const callStartedAt = Date.now();
const result = await be.callClaude({
  model: selectedModel,
  max_tokens: be.CLAUDE_MAX_TOKENS,
  temperature: 0.1,
  system: be.CLAUDE_SYSTEM_PROMPT,
  messages: [{ role: 'user', content: outboundPrompt }],
});
const callDurationMs = Date.now() - callStartedAt;

const text = Array.isArray(result?.content)
  ? result.content.filter((item) => item?.type === 'text').map((item) => item.text || '').join('\n')
  : '';

// Persist the raw response + usage BEFORE attempting to parse it, so a
// parse failure never loses the diagnostic evidence (it did, the first time
// this script ran, because the process crashed before anything was written).
// Written OUTSIDE the repo (see DIAG_DIR above) — never git-tracked.
const rawResponseContent = JSON.stringify(
  { usage: result?.usage || null, stopReason: result?.stop_reason || null, rawTextLength: text.length, rawText: text },
  null, 2
);
const rawResponseFile = writeDiagFile(`raw-response-${Date.now()}.json`, rawResponseContent);
console.log(`RAW_RESPONSE_CAPTURED path=${rawResponseFile.path} sha256=${rawResponseFile.sha256} bytes=${rawResponseFile.bytes} usage=${JSON.stringify(result?.usage || null)} stopReason=${result?.stop_reason || null}`);

const parsed = be.parseClaudeJson(text);
const fullSegments = be.parseTimedTranscriptSegments(rawTranscriptText);
const analyzedSegments = be.parseTimedTranscriptSegments(transcriptText);
const gatedAnalysis = be.applyTimedNarrativeEvidenceGateToAnalysis(parsed, analyzedSegments);
const staticTimeCoverage = be.computeTranscriptCoverage(
  fullSegments, analyzedSegments, rawTranscriptText.length, transcriptText.length
);

assert.equal(staticTimeCoverage.status, 'full', 'POST-CALL: coverage regressed from full');
assert.equal(staticTimeCoverage.analyzedSegments, 789, 'POST-CALL: analyzed segment count regressed from 789');
assert.equal(staticTimeCoverage.skippedSegments, 0, 'POST-CALL: skipped segments regressed from 0');

const normalized = normalizeAiAnalysisResult({ ...gatedAnalysis, provider: 'claude', model: selectedModel, isFallback: false, staticTimeCoverage });

// ── Rejection-reason reporting: re-verify every PRE-gate item against the
// same analyzedSegments to recover *why* items without surviving time
// fields were rejected (the gate itself only strips fields, it doesn't
// report reasons in its return value). ──────────────────────────────────
const fieldTabs = [
  ['summary', 'keyPoints'],
  ['insights', 'keyInsights'],
  ['useful-knowledge', 'rules'],
  ['useful-knowledge', 'actionItems'],
  ['specialized', 'mistakesToAvoid'],
];
const rows = [];
for (const [tab, field] of fieldTabs) {
  const preGateItems = Array.isArray(parsed?.[field]) ? parsed[field] : [];
  const postGateItems = Array.isArray(gatedAnalysis?.[field]) ? gatedAnalysis[field] : [];
  for (let i = 0; i < preGateItems.length; i += 1) {
    const preItem = preGateItems[i];
    const postItem = postGateItems[i];
    const evidence = preItem && typeof preItem === 'object'
      ? verifyTimedNarrativeEvidence(preItem, analyzedSegments)
      : { hasClaim: false, verified: false };
    rows.push({
      tab,
      field,
      text: typeof preItem === 'string' ? preItem : String(preItem?.text || ''),
      accepted: Boolean(evidence.verified),
      rejectionReason: evidence.verified ? null : (evidence.hasClaim ? evidence.reason : 'no-time-claim'),
      claimedSeconds: preItem?.estimatedStartSeconds ?? null,
      sourceQuote: preItem?.sourceQuote ?? null,
      evidenceWindow: evidence.window ?? null,
      postGateItem: postItem,
    });
  }
}

const accepted = rows.filter((row) => row.accepted);
const rejected = rows.filter((row) => !row.accepted && row.rejectionReason && row.rejectionReason !== 'no-time-claim');
const untimed = rows.filter((row) => row.rejectionReason === 'no-time-claim');

// ── Distribution across the four requested QA duration ranges ──────────────
const RANGES = [
  { label: '0:00-10:00', start: 0, end: 600 },
  { label: '10:00-20:00', start: 600, end: 1200 },
  { label: '20:00-30:00', start: 1200, end: 1800 },
  { label: '30:00-40:03', start: 1800, end: 2403 },
];
function rangeOf(seconds) {
  if (!Number.isFinite(seconds)) return null;
  return RANGES.find((r) => seconds >= r.start && seconds < r.end + (r.end === 2403 ? 1 : 0)) || null;
}
const distribution = RANGES.map((r) => {
  const segsInRange = fullSegments.filter((s) => s.startSeconds >= r.start && s.startSeconds < r.end + (r.end === 2403 ? 1 : 0));
  const acceptedInRange = accepted.filter((row) => {
    const rg = rangeOf(row.claimedSeconds);
    return rg && rg.label === r.label;
  });
  const rejectedInRange = rejected.filter((row) => {
    // rejected items may have no reliable claimedSeconds (that's often *why*
    // they were rejected) — bucket by claimedSeconds when present, otherwise
    // report separately as "unlocated".
    const rg = rangeOf(row.claimedSeconds);
    return rg && rg.label === r.label;
  });
  return {
    range: r.label,
    segmentsAnalyzed: segsInRange.length,
    acceptedCount: acceptedInRange.length,
    rejectedCount: rejectedInRange.length,
    earliestAccepted: acceptedInRange.length ? Math.min(...acceptedInRange.map((x) => x.claimedSeconds)) : null,
    latestAccepted: acceptedInRange.length ? Math.max(...acceptedInRange.map((x) => x.claimedSeconds)) : null,
    tabsSupported: [...new Set(acceptedInRange.map((x) => x.tab))],
  };
});

const rangesWithAccepted = distribution.filter((d) => d.acceptedCount > 0).length;
const productResultClassification = (rangesWithAccepted <= 1 && accepted.length > 0) ? 'PARTIAL' : (accepted.length === 0 ? 'NO_ACCEPTED_ITEMS' : 'OK');

const report = {
  pipeline: {
    buildPrompt: 'backend/analyze-video.function.js#buildPrompt',
    callClaude: 'backend/analyze-video.function.js#callClaude',
    evidenceGate: 'backend/analyze-video.function.js#applyTimedNarrativeEvidenceGateToAnalysis',
    normalizer: 'src/services/videoAnalytics.js#normalizeAiAnalysisResult',
    provider: 'claude',
    model: selectedModel,
    callDurationMs,
    realStorageWrites: 0,
  },
  precallAudit,
  usage: result?.usage || null,
  staticTimeCoverage,
  acceptedCount: accepted.length,
  rejectedCount: rejected.length,
  untimedCount: untimed.length,
  rows,
  distribution,
  productResultClassification,
  normalized,
};

const reportFile = writeDiagFile(`pilot-report-${Date.now()}.json`, JSON.stringify(report, null, 2));
console.log(`REPORT_FILE path=${reportFile.path} sha256=${reportFile.sha256} bytes=${reportFile.bytes}`);
console.log(`PILOT_REPORT=${JSON.stringify(report)}`);
