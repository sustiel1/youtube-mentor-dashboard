import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeAiAnalysisResult } from '../src/services/videoAnalytics.js';
import { normalizeGeneralResult } from '../src/ai/gemini/validators/validateGeneral.js';
import { normalizeMarketResult } from '../src/ai/gemini/validators/validateMarket.js';

const timed = {
  text: 'פריט מתוזמן אמיתי',
  estimatedStartSeconds: 0,
  estimatedEndSeconds: 8,
  timestampKind: 'estimated',
  timestampSource: 'youtube-transcript-segment',
  timestampConfidence: 'high',
  sourceQuote: 'ציטוט אמיתי',
};

for (const normalized of [
  normalizeGeneralResult({ keyPoints: [timed, 'ללא זמן'], keyInsights: [timed], actionItems: [timed] }),
  normalizeMarketResult({ keyPoints: [timed, 'ללא זמן'], keyInsights: [timed], usefulKnowledge: [timed] }),
]) {
  assert.deepEqual(normalized.keyPoints[0], timed);
  assert.equal(normalized.keyPoints[1], 'ללא זמן');
}

const production = normalizeAiAnalysisResult({
  shortSummary: 'סיכום בדיקה',
  fullSummary: 'סיכום מלא לבדיקה',
  keyPoints: [timed, 'ללא זמן'],
  keyInsights: [timed],
  actionItems: [timed],
  rules: [timed],
  usefulKnowledge: [timed],
});

assert.deepEqual(production.keyPoints[0], timed);
assert.equal(production.keyPoints[1], 'ללא זמן');
assert.deepEqual(production.keyInsights[0], timed);
assert.deepEqual(production.actionItems[0], timed);
assert.deepEqual(production.rules[0], timed);
assert.deepEqual(production.usefulKnowledge[0], timed);

// WORK-ID YMD-ONDEMAND-ROW-TIMES: normal/automatic analysis must never
// request or auto-generate row timestamps anymore — that moved to a
// separate, explicit, per-video opt-in operation
// (generate-row-timestamps.function.js). Assert the automatic prompt no
// longer asks for them, and that the removed instruction text is gone.
const backendSource = readFileSync(new URL('../backend/analyze-video.function.js', import.meta.url), 'utf8');
assert.doesNotMatch(backendSource, /STATIC NARRATIVE TIMES/, 'normal analysis prompt must not request row timestamps');
assert.doesNotMatch(backendSource, /הערך זמנים לפי התקדמות הטקסט/);
assert.doesNotMatch(backendSource, /חלוקת הסרטון לחלונות שווים[^']*מותר/);
// The gate is still applied in the automatic handler, but fail-closed with
// an empty segment list — defense in depth so nothing can survive even if a
// model ignores the (now-removed) instruction.
assert.match(backendSource, /applyTimedNarrativeEvidenceGateToAnalysis\(parsed, \[\]\)/, 'automatic handler must gate with an empty segment list');

console.log('Static video ingestion QA: PASS');
