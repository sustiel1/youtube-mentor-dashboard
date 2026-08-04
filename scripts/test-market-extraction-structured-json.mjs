import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const {
  CONTRACT_VERSION,
  MARKET_BRIEF_RESPONSE_SCHEMA,
  parseStructuredMarketResponse,
  runMarketExtraction,
  validateMarketBriefPayload,
} = require('../shared/marketExtractionContract.cjs');

const validPayload = {
  contentType: 'marketBrief',
  shortSummary: 'Market opened higher',
  chapters: [{ title: 'Open', startSeconds: 0, endSeconds: 0.56 }],
  stocksMentioned: [{ ticker: 'AMD', isNewToWatch: false }],
  sentiment: [{
    label: 'AAII',
    direction: 'neutral',
    score: 0,
    source: 'video',
    evidence: 'Explicit transcript evidence',
    confidence: 0,
    verificationState: 'video-unverified',
    verified: false,
  }],
  risks: [],
};

assert.equal(CONTRACT_VERSION, 2);
assert.ok(MARKET_BRIEF_RESPONSE_SCHEMA?.properties?.chapters);
assert.equal(MARKET_BRIEF_RESPONSE_SCHEMA.properties.keyPoints.items.type, 'STRING');
assert.equal(MARKET_BRIEF_RESPONSE_SCHEMA.properties.tags.items.type, 'STRING');
assert.equal('marketNews' in MARKET_BRIEF_RESPONSE_SCHEMA.properties, false);
assert.ok(MARKET_BRIEF_RESPONSE_SCHEMA.properties.sentiment);
assert.deepEqual(MARKET_BRIEF_RESPONSE_SCHEMA.properties.sentiment.items.properties.direction.enum, [
  'bullish', 'bearish', 'neutral', 'unverified',
]);
assert.deepEqual(parseStructuredMarketResponse(validPayload, { normalize: false }), validPayload);
const normalizedPayload = parseStructuredMarketResponse(JSON.stringify(validPayload));
assert.equal(normalizedPayload.chapters[0].startSeconds, 0);
assert.equal(normalizedPayload.sentiment[0].score, 0);
assert.equal(normalizedPayload.sentiment[0].verified, false);
assert.throws(() => validateMarketBriefPayload([]), { code: 'INVALID_MARKET_SCHEMA' });
assert.throws(() => parseStructuredMarketResponse(''), { code: 'EMPTY_PROVIDER_RESPONSE' });
assert.throws(() => parseStructuredMarketResponse('{"contentType":"marketBrief","chapters":['), { code: 'TRUNCATED_MARKET_JSON' });
assert.throws(() => parseStructuredMarketResponse('{"contentType":"general","chapters":[]}'), { code: 'INVALID_MARKET_SCHEMA' });
assert.throws(() => parseStructuredMarketResponse('{"contentType":"marketBrief","chapters":{}}'), { code: 'INVALID_MARKET_SCHEMA' });

let repairCalls = 0;
const repaired = await runMarketExtraction({
  title: 'Strict JSON fixture',
  transcript: 'market transcript '.repeat(80),
  callProvider: async () => '{"contentType":"marketBrief","chapters":[',
  repairProvider: async () => {
    repairCalls += 1;
    return JSON.stringify(validPayload);
  },
});
assert.equal(repairCalls, 1);
assert.deepEqual(repaired.marketBriefData.extractionMeta.parseOutcomes, [{ index: 0, status: 'repaired-once' }]);

let failedError;
try {
  await runMarketExtraction({
    title: 'Failed repair fixture',
    transcript: 'market transcript '.repeat(80),
    callProvider: async () => '{"contentType":"marketBrief","chapters":[',
    repairProvider: async () => '{"contentType":"marketBrief","chapters":[',
  });
} catch (error) {
  failedError = error;
}
assert.equal(failedError?.code, 'MARKET_EXTRACTION_FAILED');
assert.equal(failedError?.failedChunks?.[0]?.repairAttemptCount, 1);
assert.equal(failedError?.failedChunks?.[0]?.repairEligible, true);
assert.equal(typeof failedError?.failedChunks?.[0]?.diagnostics?.rawHash, 'string');
assert.equal(JSON.stringify(failedError).includes('market transcript'), false);

const viteSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../src/services/geminiVideoContent.js', import.meta.url), 'utf8');
assert.match(viteSource, /responseMimeType:\s*'application\/json'/);
assert.match(viteSource, /responseSchema:\s*MARKET_BRIEF_RESPONSE_SCHEMA/);
assert.match(viteSource, /contentType === 'market' \|\| contentType === 'marketBrief'/);
assert.match(clientSource, /contentType = "general"/);
assert.match(clientSource, /contentType,\s*\r?\n\s*videoId/);

console.log(JSON.stringify({
  status: 'passed',
  contractVersion: CONTRACT_VERSION,
  oneRepairAttempt: repairCalls,
  structuredMime: true,
  responseSchema: true,
  paidCalls: 0,
}, null, 2));
