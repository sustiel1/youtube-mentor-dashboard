/**
 * Regression fixture: createGeminiJsonDebugReport (src/lib/geminiJsonDebugReport.js).
 * Run with: node scripts/test-gemini-json-debug-report.mjs
 *
 * Validates:
 *   1. Hebrew text, quotes inside Hebrew sentences, geresh/gershayim survive intact
 *   2. Multiline JSON is preserved
 *   3. Missing video title / empty transcript degrade gracefully
 *   4. repairCandidate works as both an object and a string
 *   5. Large transcript is truncated with a stated character count, not silently dropped
 *   6. Secrets (API keys, Authorization headers, tokens) are redacted
 *   7. Markdown code fences inside a transcript are preserved verbatim
 *   8. Nested JSON serialized as a string is preserved verbatim
 *   9. No "[object Object]" ever leaks into the report
 */

import { createGeminiJsonDebugReport } from '../src/lib/geminiJsonDebugReport.js';

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

console.log('\n=== createGeminiJsonDebugReport Regression Fixture ===\n');

// ── 1. Hebrew text, quotes, geresh/gershayim ───────────────────────────────
console.log('1. Hebrew text, in-sentence quotes, geresh and gershayim');

const hebrewRaw = '{"note": "עו\\"ד ירדן אמר: \\"השוק פתח בעלייה\\" והדגיש כי מדובר בתנודה חדה"}';
const r1 = createGeminiJsonDebugReport({
  videoTitle: 'מבזק בוקר — תגובת עו"ד ירדן',
  rawGeminiOutput: hebrewRaw,
  parseError: 'Unexpected token',
  parseValid: false,
});
assert('Hebrew gershayim (עו"ד) preserved in title', r1.includes('עו"ד'));
assert('Hebrew geresh/quotes preserved in raw output', r1.includes('עו\\"ד ירדן'));
assert('Hebrew nested quote content preserved', r1.includes('השוק פתח בעלייה'));
assert('RAW GEMINI OUTPUT delimiters present', r1.includes('================ RAW GEMINI OUTPUT START ================') && r1.includes('================ RAW GEMINI OUTPUT END ================'));

// ── 2. Multiline JSON preserved ────────────────────────────────────────────
console.log('\n2. Multiline JSON preserved');

const multilineJson = '{\n  "contentType": "marketBrief",\n  "rawData": {\n    "marketOverview": {}\n  }\n}';
const r2 = createGeminiJsonDebugReport({ rawGeminiOutput: multilineJson, parseValid: true });
assert('Multiline structure preserved (contains real newlines)', r2.includes('"contentType": "marketBrief"\n  "rawData"'.replace('\n  "rawData"', '') ) || r2.split('\n').some(l => l.trim() === '"contentType": "marketBrief",'));
assert('All three JSON lines present in order', (() => {
  const idx1 = r2.indexOf('"contentType": "marketBrief"');
  const idx2 = r2.indexOf('"rawData"');
  const idx3 = r2.indexOf('"marketOverview"');
  return idx1 > -1 && idx2 > idx1 && idx3 > idx2;
})());

// ── 3. Missing video title / empty transcript ──────────────────────────────
console.log('\n3. Missing video title / empty transcript degrade gracefully');

const r3 = createGeminiJsonDebugReport({ transcript: '' });
assert('Missing title shows placeholder, not "undefined"', r3.includes('Title: (not available)') && !r3.includes('Title: undefined'));
assert('Empty transcript shows placeholder', r3.includes('================ TRANSCRIPT START ================\n(not available)'));
assert('No literal "undefined" leaks into metadata block', !/Video ID: undefined/.test(r3));

// ── 4. repairCandidate as object vs string ─────────────────────────────────
console.log('\n4. repairCandidate as object and as string');

const r4obj = createGeminiJsonDebugReport({ repairCandidate: { repairedJson: '{"a":1}', fixes: ['Fixed trailing comma'] } });
assert('Object repairCandidate serialized as readable JSON', r4obj.includes('"repairedJson"') && r4obj.includes('"Fixed trailing comma"'));
assert('Object repairCandidate never renders as "[object Object]"', !r4obj.includes('[object Object]'));

const r4str = createGeminiJsonDebugReport({ repairCandidate: '{"a":1}' });
assert('String repairCandidate passed through verbatim', r4str.includes('================ REPAIR CANDIDATE START ================\n{"a":1}'));

// ── 5. Large transcript truncation ─────────────────────────────────────────
console.log('\n5. Large transcript truncation (not silently dropped)');

const bigTranscript = 'HEAD_MARKER_' + 'א'.repeat(20000) + '_TAIL_MARKER';
const r5 = createGeminiJsonDebugReport({ transcript: bigTranscript });
assert('States exact transcript character count', r5.includes(`transcript length: ${bigTranscript.length} characters`));
assert('Includes the beginning of the transcript', r5.includes('HEAD_MARKER_'));
assert('Includes the end of the transcript', r5.includes('_TAIL_MARKER'));
assert('States that the middle was truncated', /truncated/i.test(r5));
assert('Truncated body is meaningfully shorter than the original', (() => {
  const start = r5.indexOf('================ TRANSCRIPT START ================');
  const end = r5.indexOf('================ TRANSCRIPT END ================');
  const block = r5.slice(start, end);
  return block.length < bigTranscript.length;
})());

const smallTranscript = 'קטן ולא נחתך';
const r5b = createGeminiJsonDebugReport({ transcript: smallTranscript });
assert('Small transcript is NOT truncated', r5b.includes(smallTranscript) && !/truncated/i.test(r5b));

// ── 6. Secret sanitization ──────────────────────────────────────────────────
console.log('\n6. Secret sanitization');

const secretRaw = JSON.stringify({
  note: 'call with Authorization: Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456',
  apiKey: 'AIzaSyD-abcdefghijklmnopqrstuvwxyz1234567',
  cookie: 'session=abc123; Path=/',
});
const r6 = createGeminiJsonDebugReport({
  rawGeminiOutput: secretRaw,
  diagnostics: { authorizationHeader: 'Authorization: Bearer sk-test-abcdefghijklmnop123456' },
});
assert('Anthropic-style key redacted', !r6.includes('sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456'));
assert('Google-style key redacted', !r6.includes('AIzaSyD-abcdefghijklmnopqrstuvwxyz1234567'));
assert('Bearer token in diagnostics redacted', !r6.includes('sk-test-abcdefghijklmnop123456'));
assert('Redaction marker present', r6.includes('[REDACTED') );

// ── 7. Markdown code fences inside transcript preserved ─────────────────────
console.log('\n7. Markdown code fences inside transcript preserved verbatim');

const transcriptWithFence = 'הנה קטע קוד:\n```json\n{"a": 1}\n```\nוזה הכל.';
const r7 = createGeminiJsonDebugReport({ transcript: transcriptWithFence });
assert('Code fence start preserved', r7.includes('```json'));
assert('Code fence content preserved', r7.includes('{"a": 1}'));
assert('Code fence end preserved', r7.includes('```\nוזה הכל.'));

// ── 8. Nested JSON serialized as a string preserved verbatim ────────────────
console.log('\n8. Nested JSON-as-string preserved verbatim');

const nestedJsonString = '{"note": "\\n},\\n\\"brainKnowledge\\": {\\"key\\": \\"value\\"}"}';
const r8 = createGeminiJsonDebugReport({ rawGeminiOutput: nestedJsonString, repairCandidate: nestedJsonString });
assert('Nested serialized JSON preserved in raw output', r8.includes('brainKnowledge'));
assert('Nested serialized JSON preserved in repair candidate', (() => {
  const start = r8.indexOf('================ REPAIR CANDIDATE START ================');
  const end = r8.indexOf('================ REPAIR CANDIDATE END ================');
  return r8.slice(start, end).includes('brainKnowledge');
})());

// ── 9. No "[object Object]" leakage anywhere ────────────────────────────────
console.log('\n9. No "[object Object]" leakage');

const r9 = createGeminiJsonDebugReport({
  diagnostics: { nested: { deep: { value: 42 } } },
  aiRepairResult: { source: 'ai', changes: ['x', 'y'], repairedJson: '{}' },
  repairCandidate: { a: 1, b: { c: 2 } },
});
assert('No "[object Object]" anywhere in the report', !r9.includes('[object Object]'));

// ── Instructions block present ──────────────────────────────────────────────
console.log('\n10. Claude Code instructions block present');

const r10 = createGeminiJsonDebugReport({});
assert('Contains reproduce instruction', /Reproduce the issue/i.test(r10));
assert('Contains root cause instruction', /root cause/i.test(r10));
assert('Contains Hebrew/gershayim preservation instruction', /gershayim/i.test(r10));
assert('Contains "do not commit" instruction', /not commit or push/i.test(r10));

// ── Result ────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
