/**
 * Focused, isolated (no network) QA for the narrow Claude JSON repair
 * introduced after the full-coverage pilot's parse failure
 * ("Expected double-quoted property name in JSON at position 11442").
 *
 * Proves: valid JSON is never mutated, the one narrow repair fixes exactly
 * the class of defect it targets (a bare quote embedded mid-word/mid-
 * sentence), everything else still fails closed with a diagnostic, and the
 * repaired text reaches the Evidence Gate with the values a reader would
 * expect.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  stripMarkdownFences,
  repairUnescapedMidWordQuotes,
  parseModelJsonSafely,
} from '../src/lib/claudeJsonRepair.js';
import {
  parseTimedTranscriptSegments,
  applyTimedNarrativeEvidenceGateToAnalysis,
} from '../src/lib/timedNarrativeEvidenceGate.js';

// ── 1. Valid JSON parses without mutation ───────────────────────────────────
{
  const input = '{"a":"שלום","b":1,"c":[1,2,3],"d":null,"e":true,"f":"hello world"}';
  const { value, repaired } = parseModelJsonSafely(input);
  assert.deepEqual(value, JSON.parse(input));
  assert.equal(repaired, false);
}

// ── 2. Hebrew text with an unescaped ASCII quote mid-string is repaired ────
// only because BOTH neighbors are word/Hebrew characters, proving context,
// not guesswork.
{
  const input = '{"text":"עו"ד כהן אמר שלום"}';
  const { value, repaired } = parseModelJsonSafely(input);
  assert.equal(repaired, true);
  assert.equal(value.text, 'עו"ד כהן אמר שלום');
}

// ── 3. Hebrew gershayim (real Unicode punctuation, U+05F4) is untouched ────
// and never needs repair — it isn't an ASCII quote at all.
{
  const input = '{"text":"ראש הממשלה ז״ל אמר דברים חשובים"}';
  const { value, repaired } = parseModelJsonSafely(input);
  assert.equal(repaired, false);
  assert.equal(value.text, 'ראש הממשלה ז״ל אמר דברים חשובים');
  assert.ok(value.text.includes('ז״ל'), 'gershayim character must survive unchanged');
}

// ── 4. Correctly escaped quotes remain unchanged (already valid JSON) ──────
{
  const input = '{"text":"הוא אמר \\"שלום\\" לי"}';
  const { value, repaired } = parseModelJsonSafely(input);
  assert.equal(repaired, false);
  assert.equal(value.text, 'הוא אמר "שלום" לי');
}

// ── 5. Structural property-name and delimiter quotes remain unchanged ──────
{
  const input = JSON.stringify({
    shortSummary: 'תקציר', fullSummary: 'תקציר מלא', keyPoints: [{ text: 'נקודה' }],
    chapters: [{ title: 'פרק 1', startSeconds: 0 }], mainLesson: 'לקח',
  });
  const { value, repaired } = parseModelJsonSafely(input);
  assert.equal(repaired, false);
  assert.deepEqual(value, JSON.parse(input));
}

// ── 6. URLs, numbers, booleans and null remain unchanged ───────────────────
{
  const input = '{"url":"https://example.com/path?q=1&x=2","num":42.5,"neg":-3,"bool":true,"nil":null}';
  const { value, repaired } = parseModelJsonSafely(input);
  assert.equal(repaired, false);
  assert.deepEqual(value, JSON.parse(input));
}

// ── 7. Nested arrays/objects remain unchanged, including elsewhere in a
// document that DOES need one localized repair ─────────────────────────────
{
  const input = '{"outer":{"list":[{"a":1},{"b":[1,2,{"c":"שלום"}]}]},"broken":"עו"ד כהן"}';
  const { value, repaired } = parseModelJsonSafely(input);
  assert.equal(repaired, true);
  assert.deepEqual(value.outer, { list: [{ a: 1 }, { b: [1, 2, { c: 'שלום' }] }] });
  assert.equal(value.broken, 'עו"ד כהן');
}

// ── 8. Markdown code fences are handled ─────────────────────────────────────
{
  const input = '```json\n{"a":1}\n```';
  assert.equal(stripMarkdownFences(input), '{"a":1}');
  const { value, repaired } = parseModelJsonSafely(input);
  assert.deepEqual(value, { a: 1 });
  assert.equal(repaired, false);
}

// ── 9. Unrelated malformed JSON (missing comma) is still rejected ──────────
{
  const input = '{"a":"שלום" "b":1}'; // missing comma — not a quote-context defect
  assert.equal(repairUnescapedMidWordQuotes(input), input, 'repair must not touch text with no mid-word quote');
  assert.throws(() => parseModelJsonSafely(input), /MODEL_INVALID_JSON|Model returned invalid JSON/);
}

// ── 10. Truncated JSON is still rejected ────────────────────────────────────
{
  const input = '{"a":"שלום","b":[1,2,3';
  assert.throws(() => parseModelJsonSafely(input), /MODEL_INVALID_JSON|Model returned invalid JSON/);
}

// ── 11. Duplicate or missing delimiters are never invented by the repair ───
{
  const input = '{"a":"שלום" "b":"עוד משהו"}'; // missing comma, no quote-context issue at all
  const before = input;
  const after = repairUnescapedMidWordQuotes(input);
  assert.equal(after, before, 'repair must never insert commas/braces — text must be byte-identical when there is no mid-word quote');
  assert.throws(() => parseModelJsonSafely(input));
}

// ── 12. sourceQuote/timestamps/evidence fields reach the Evidence Gate with
// the intended (repaired, correctly-decoded) values ─────────────────────────
{
  const transcript = [
    '[0] שלום וברוכים הבאים',
    '[15] הכלל של עו"ד כהן הוא לשמור על סיכון מבוקר',
    '[30] בואו נמשיך',
  ].join('\n');
  const segments = parseTimedTranscriptSegments(transcript);
  // Same defect class as the real pilot failure: an embedded, unescaped
  // quote inside a Hebrew sourceQuote value, exactly as Claude would emit
  // it raw (JSON.stringify would have escaped it correctly, so this is
  // hand-built to simulate the actual defect).
  const rawWithDefect = '{"keyPoints":[{"text":"ניהול סיכונים","estimatedStartSeconds":15,"sourceQuote":"הכלל של עו"ד כהן הוא לשמור על סיכון מבוקר"}]}';
  const { value, repaired } = parseModelJsonSafely(rawWithDefect);
  assert.equal(repaired, true);
  const gated = applyTimedNarrativeEvidenceGateToAnalysis(value, segments);
  assert.equal(gated.keyPoints[0].estimatedStartSeconds, 15, 'time claim must survive the gate');
  assert.equal(gated.keyPoints[0].sourceQuote, 'הכלל של עו"ד כהן הוא לשמור על סיכון מבוקר', 'sourceQuote must reach the gate with its intended (unescaped) text');
}

console.log('Claude JSON repair QA (canonical module): PASS');

// ── 13. Parity: the embedded backend copy behaves identically ──────────────
const backendSource = readFileSync(new URL('../backend/analyze-video.function.js', import.meta.url), 'utf8');
const backendModule = { exports: {} };
new Function('module', 'exports', 'require', backendSource)(backendModule, backendModule.exports, () => {
  throw new Error('Unexpected require in production handler');
});
const backendGate = backendModule.exports;
assert.equal(typeof backendGate.parseClaudeJson, 'function');
assert.equal(typeof backendGate.repairUnescapedMidWordQuotes, 'function');

const repairFixtures = [
  'עו"ד כהן אמר שלום',
  'ראש הממשלה ז״ל אמר',
  'הוא אמר \\"שלום\\" לי',
  '{"outer":{"list":[{"a":1}]},"broken":"עו"ד כהן"}',
  'https://example.com/path?q=1',
  '',
];
for (const fixture of repairFixtures) {
  assert.equal(backendGate.repairUnescapedMidWordQuotes(fixture), repairUnescapedMidWordQuotes(fixture), `Parity mismatch for: ${fixture}`);
}

const claudeStyleFixtures = [
  '```json\n{"a":1}\n```',
  '{"a":"שלום","b":1}',
  '{"text":"עו"ד כהן אמר שלום"}',
  '{"a":"שלום" "b":1}', // must fail on both
];
for (const fixture of claudeStyleFixtures) {
  let sharedResult, sharedThrew = false;
  try { sharedResult = parseModelJsonSafely(fixture).value; } catch { sharedThrew = true; }
  let backendResult, backendThrew = false;
  try { backendResult = backendGate.parseClaudeJson(fixture); } catch { backendThrew = true; }
  assert.equal(backendThrew, sharedThrew, `Parity mismatch (throw behavior) for: ${fixture}`);
  if (!sharedThrew) assert.deepEqual(backendResult, sharedResult, `Parity mismatch (value) for: ${fixture}`);
}

console.log('Claude JSON repair QA (Claude canonical/embedded parity): PASS');
