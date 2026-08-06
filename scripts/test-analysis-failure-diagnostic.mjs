import assert from 'node:assert/strict';
import {
  ANALYSIS_FAILURE_CATEGORIES,
  buildAnalysisFailureFingerprint,
  buildCodexRepairPrompt,
  buildPayloadProcessingTrace,
  classifyAnalysisFailure,
  detectManualGemsInputKind,
  extractSafeFailureContext,
  redactDiagnosticText,
  resolveFailureLocation,
} from '../src/lib/analysisFailureDiagnostic.js';

const malformed = '{"summary":"השוק בתהליך ה"ריסט" לאחר דו"חות","value":0,"flag":false,"time":0.56}';
const quotePosition = malformed.indexOf('ריסט');
const malformedDiagnostic = classifyAnalysisFailure({
  code: 'MALFORMED_MARKET_JSON',
  message: "Expected ',' or '}' after property value in JSON",
  raw: malformed,
  position: quotePosition,
  stage: 'gemini-response-parse',
});
assert.equal(malformedDiagnostic.category, 'json-unescaped-quote');
assert.equal(malformedDiagnostic.currentPayloadRepairable, true);
assert.equal(malformedDiagnostic.previousDataPreserved, true);

const reportedFailure = classifyAnalysisFailure({
  code: 'MALFORMED_MARKET_JSON',
  message: "Expected ',' or '}' after property value in JSON at position 30 (line 1 column 31)",
  raw: malformed,
});
assert.equal(reportedFailure.category, 'json-unescaped-quote');
assert.equal(reportedFailure.line, 1);
assert.equal(reportedFailure.column, 31);
assert.ok(reportedFailure.safeContext.includes('ריסט'));
assert.deepEqual(
  resolveFailureLocation('Unexpected token at position 105 (line 3 column 74)', 'a\nb\n' + 'c'.repeat(200)),
  { position: 105, line: 3, column: 74, computedLine: 3, computedColumn: 102, disagreement: true },
);

const capturedPattern = `${'a'.repeat(2200)}ה"ריסט"${'x'.repeat(4)}מ${'z'.repeat(400)}`;
const capturedDiagnostic = classifyAnalysisFailure({
  code: 'MALFORMED_MARKET_JSON',
  message: "Expected ',' or '}' after property value in JSON at position 2211 (line 7 column 580)",
  raw: capturedPattern,
});
assert.equal(capturedDiagnostic.category, 'json-unescaped-quote');
assert.equal(capturedDiagnostic.offset, 2211);
assert.equal(capturedDiagnostic.offendingCharacter, 'מ');
assert.ok(capturedDiagnostic.safeContext.includes('⟦OFFSET 2211 · CHAR "מ"⟧'));
assert.equal(capturedDiagnostic.locationDisagreement, true);

const identicalTrace = buildPayloadProcessingTrace({
  rawProviderOutput: capturedPattern,
  parserInput: capturedPattern,
  position: 2211,
});
assert.equal(identicalTrace.relation, 'identical');
assert.equal(identicalTrace.rawHash, identicalTrace.parserInputHash);
assert.ok(identicalTrace.rawExcerpt.includes('⟦OFFSET 2211'));
assert.ok(identicalTrace.parserInputExcerpt.includes('CHAR "מ"'));
const changedTrace = buildPayloadProcessingTrace({ rawProviderOutput: '```json\n{}\n```', parserInput: '{}', position: 1 });
assert.equal(changedTrace.relation, 'changed-before-parse');
assert.notEqual(changedTrace.rawHash, changedTrace.parserInputHash);

assert.equal(classifyAnalysisFailure({ code: 'TRANSCRIPT_FETCH_FAILED' }).category, 'transcript-fetch-failed');
assert.equal(classifyAnalysisFailure({ code: 'INVALID_MARKET_SCHEMA' }).category, 'schema-invalid');
assert.equal(classifyAnalysisFailure({ code: 'TRUNCATED_MARKET_JSON' }).category, 'provider-truncated-response');
assert.equal(classifyAnalysisFailure({ code: 'EMPTY_PROVIDER_RESPONSE' }).category, 'provider-empty-response');
assert.equal(ANALYSIS_FAILURE_CATEGORIES.length, 15);

const pastedTranscriptContext = `VIDEO TITLE:
מבזק פתיחה

VIDEO URL:
https://www.youtube.com/watch?v=example

BRIEF SESSION:
morning

TRANSCRIPT:
טקסט עברי עם 0, false וזמן 0.56`;
assert.equal(detectManualGemsInputKind(pastedTranscriptContext), 'transcript-context');
assert.equal(detectManualGemsInputKind('{"contentType":"marketBrief"}'), 'json-candidate');
const wrongManualInput = classifyAnalysisFailure({
  code: 'MANUAL_GEMS_INPUT_NOT_JSON',
  message: `Unexpected token 'V', "VIDEO TITL"... is not valid JSON`,
  raw: pastedTranscriptContext,
  stage: 'זיהוי קלט GEMS ידני',
});
assert.equal(wrongManualInput.category, 'manual-input-not-json');
assert.equal(wrongManualInput.offset, 0);
assert.equal(wrongManualInput.offendingCharacter, 'V');
assert.equal(wrongManualInput.currentPayloadRepairable, false);
assert.ok(wrongManualInput.safeContext.includes('OFFSET 0'));
assert.match(wrongManualInput.recommendedUserActionHe, /תשובת ה־JSON בלבד/);
assert.equal(pastedTranscriptContext.includes('0, false'), true);
assert.equal(pastedTranscriptContext.includes('0.56'), true);

const longRaw = `${'a'.repeat(500)}AIza123456789012345678901234567890${'b'.repeat(500)}`;
const safeContext = extractSafeFailureContext(longRaw, 520);
assert.ok(safeContext.length <= 640, 'safe context remains bounded after redaction');
assert.ok(!safeContext.includes('AIza123456789012345678901234567890'));

const prompt = buildCodexRepairPrompt(capturedDiagnostic, {
  route: '/api/gemini-video-content · VideoDetailPanel/GEMS JSON',
  provider: 'Gemini',
  model: 'gemini-2.0-flash',
  responseMimeType: 'application/json',
  schemaMode: 'responseSchema',
  directParseResult: 'failed',
  repairAttemptCount: 0,
  repairEligible: false,
  repairEligibilityReason: 'Manual paste requires explicit user action.',
  payloadTrace: identicalTrace,
});
assert.match(prompt, /Failure category:\njson-unescaped-quote/);
assert.match(prompt, /Line 7, column 580/);
assert.match(prompt, /\[FULL TRANSCRIPT REDACTED\]/);
assert.match(prompt, /Offending character: "מ"/);
assert.match(prompt, /Relationship: identical/);
assert.match(prompt, /Automatic repair eligible: false/);
assert.match(prompt, /Manual paste requires explicit user action/);
assert.match(prompt, /0, false, Unicode and decimal timestamps/);
assert.ok(!prompt.includes('AIza'));
assert.ok(!/fetch\(|XMLHttpRequest|axios|ChatGPT|codex\.open/i.test(buildCodexRepairPrompt.toString()));

const secretText = 'Authorization: Bearer abc.def Cookie: session=secret "apiKey":"topsecret"';
const redacted = redactDiagnosticText(secretText);
assert.ok(!redacted.includes('abc.def'));
assert.ok(!redacted.includes('session=secret'));
assert.ok(!redacted.includes('topsecret'));

const fp1 = buildAnalysisFailureFingerprint(malformedDiagnostic, { route: '/api/gemini-video-content', schemaVersion: '1' });
const fp2 = buildAnalysisFailureFingerprint({ ...malformedDiagnostic, technicalMessage: `${malformedDiagnostic.technicalMessage} at 123` }, { route: '/api/gemini-video-content', schemaVersion: '1' });
assert.equal(fp1, fp2);
assert.ok(!fp1.includes(malformed));

const panelSource = await (await import('node:fs/promises')).readFile(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
for (const text of ['העתק דוח תיקון ל־Codex', 'הנתונים הקודמים נשמרו', 'פרטים טכניים', 'ניתן להתחיל ניתוח']) {
  assert.ok(panelSource.includes(text), `UI contains ${text}`);
}
assert.match(panelSource, /disabled={!currentGemsJsonValidation\.isValid}/);
assert.match(panelSource, /navigator\.clipboard\.writeText\(report\)/);
assert.match(panelSource, /CLIPBOARD_TIMEOUT/);
assert.match(panelSource, /currentAnalysisFailure\?\.category === 'manual-input-not-json'/);
assert.match(panelSource, /detectManualGemsInputKind\(raw\) === 'transcript-context'/);
assert.ok(!panelSource.includes('createGeminiJsonDebugReport({'));

console.log(JSON.stringify({
  status: 'passed',
  categories: ANALYSIS_FAILURE_CATEGORIES.length,
  classification: malformedDiagnostic.category,
  contextChars: safeContext.length,
  fingerprint: fp1,
  externalRequests: 0,
  paidCalls: 0,
}, null, 2));
