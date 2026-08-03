import assert from 'node:assert/strict';
import {
  ANALYSIS_FAILURE_CATEGORIES,
  buildAnalysisFailureFingerprint,
  buildPayloadProcessingTrace,
  classifyAnalysisFailure,
  detectManualGemsInputKind,
  redactDiagnosticText,
  resolveFailureLocation,
} from '../src/lib/analysisFailureDiagnostic.js';

const malformed = '{"summary":"market \"risk\" text","value":0,"flag":false}';
const diagnostic = classifyAnalysisFailure({ code: 'MALFORMED_MARKET_JSON', message: 'Unexpected token at position 20', raw: malformed });
assert.ok(['json-malformed', 'json-unescaped-quote'].includes(diagnostic.category));
assert.equal(diagnostic.previousDataPreserved, true);
assert.equal(ANALYSIS_FAILURE_CATEGORIES.length, 15);
assert.equal(classifyAnalysisFailure({ code: 'TRUNCATED_MARKET_JSON' }).category, 'provider-truncated-response');
assert.equal(classifyAnalysisFailure({ code: 'INVALID_MARKET_SCHEMA' }).category, 'schema-invalid');
assert.equal(detectManualGemsInputKind('VIDEO TITLE:\nx\nTRANSCRIPT:\ny'), 'transcript-context');

assert.deepEqual(resolveFailureLocation('at position 5 (line 1 column 6)', 'abcdef'), {
  position: 5, line: 1, column: 6, computedLine: 1, computedColumn: 6, disagreement: false,
});
const trace = buildPayloadProcessingTrace({ rawProviderOutput: '```json\n{}\n```', parserInput: '{}', position: 1 });
assert.equal(trace.relation, 'changed-before-parse');
assert.notEqual(trace.rawHash, trace.parserInputHash);

const secret = 'Authorization: Bearer abc.def\n"apiKey":"topsecret" AIza123456789012345678901234567890';
const redacted = redactDiagnosticText(secret);
assert.ok(!redacted.includes('abc.def'));
assert.ok(!redacted.includes('topsecret'));
assert.ok(!redacted.includes('AIza123'));
assert.ok(diagnostic.safeContext.length < 500);
assert.ok(!JSON.stringify(diagnostic).includes('FULL TRANSCRIPT'));

const fp1 = buildAnalysisFailureFingerprint(diagnostic, { route: '/api/gemini-video-content', schemaVersion: '2' });
const fp2 = buildAnalysisFailureFingerprint({ ...diagnostic, technicalMessage: 'Unexpected token at position 99' }, { route: '/api/gemini-video-content', schemaVersion: '2' });
assert.equal(fp1, fp2);

console.log(JSON.stringify({ status: 'passed', categories: 15, redaction: true, payloadIncluded: false, uiWiring: false }, null, 2));
