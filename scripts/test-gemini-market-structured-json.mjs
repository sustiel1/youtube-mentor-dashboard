import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const {
  MARKET_BRIEF_RESPONSE_SCHEMA,
  buildMarketParserTrace,
  parseStructuredMarketResponse,
  runMarketExtraction,
} = require('../shared/marketExtractionContract.cjs');

const richPayload = {
  contentType: 'marketBrief',
  shortSummary: 'דו"חות עו"ד ו-"risk" בשווי 440$\nעברית English \\ נתיב',
  chapters: [
    { title: 'פתיחה', startSeconds: 0, endSeconds: 0.56, keyPoints: [] },
  ],
  stocksMentioned: [{ ticker: 'AMD', isNewToWatch: false }],
  risks: [],
  marketOverview: null,
};

const serialized = JSON.stringify(richPayload);
const direct = parseStructuredMarketResponse(serialized, { normalize: false });
assert.equal(direct.shortSummary, richPayload.shortSummary);
assert.equal(direct.chapters[0].startSeconds, 0);
assert.equal(direct.chapters[0].endSeconds, 0.56);
assert.equal(direct.stocksMentioned[0].isNewToWatch, false);
assert.deepEqual(direct.risks, []);
assert.equal(direct.marketOverview, null);
assert.deepEqual(parseStructuredMarketResponse(richPayload, { normalize: false }), richPayload);
assert.deepEqual(
  parseStructuredMarketResponse(`\n\`\`\`json\n${serialized}\n\`\`\`\n`, { normalize: false }),
  richPayload,
);

const malformedQuotes = '{"contentType":"marketBrief","shortSummary":"דו"חות עו"ד ו-"risk"","chapters":[]}';
let malformedError;
try { parseStructuredMarketResponse(malformedQuotes, { normalize: false }); } catch (error) { malformedError = error; }
assert.equal(malformedError?.code, 'MALFORMED_MARKET_JSON');
assert.equal(malformedError?.diagnostics?.payloadTrace?.relation, 'identical');
assert.equal(malformedError?.diagnostics?.payloadTrace?.rawHash, malformedError?.diagnostics?.payloadTrace?.parserInputHash);
assert.match(malformedError?.diagnostics?.payloadTrace?.parserInputExcerpt || '', /⟦OFFSET \d+ · CHAR/);
const fenceTrace = buildMarketParserTrace('```json\n' + serialized + '\n```', serialized, '');
assert.equal(fenceTrace.relation, 'changed-before-parse');
assert.notEqual(fenceTrace.rawHash, fenceTrace.parserInputHash);
assert.throws(
  () => parseStructuredMarketResponse('{"contentType":"marketBrief","chapters":[', { normalize: false }),
  { code: 'TRUNCATED_MARKET_JSON' },
);
assert.throws(() => parseStructuredMarketResponse('   '), { code: 'EMPTY_PROVIDER_RESPONSE' });
assert.throws(
  () => parseStructuredMarketResponse('{"contentType":"marketBrief","chapters":[]}', { normalize: false }),
  { code: 'INVALID_MARKET_SCHEMA' },
);
assert.throws(() => parseStructuredMarketResponse([]), { code: 'INVALID_MARKET_SCHEMA' });
assert.throws(
  () => parseStructuredMarketResponse('{"contentType":"marketBrief","chapters":{}}', { normalize: false }),
  { code: 'INVALID_MARKET_SCHEMA' },
);

const normalized = parseStructuredMarketResponse(JSON.stringify({ ...richPayload, unsupportedSecret: 'drop-me' }));
assert.equal(normalized.unsupportedSecret, undefined);

let repairCalls = 0;
const repairedRun = await runMarketExtraction({
  title: 'fixture',
  transcript: 'timed transcript '.repeat(80),
  callProvider: async () => malformedQuotes,
  repairProvider: async () => {
    repairCalls += 1;
    return serialized;
  },
});
assert.equal(repairCalls, 1);
assert.deepEqual(repairedRun.marketBriefData.extractionMeta.parseOutcomes, [{ index: 0, status: 'repaired-once' }]);
assert.equal(repairedRun.marketBriefData.chapters[0].startSeconds, 0);
assert.equal(repairedRun.marketBriefData.chapters[0].endSeconds, 0.56);

let failedRepairCalls = 0;
const previousValid = { contentType: 'marketBrief', shortSummary: 'קודם', chapters: [] };
let persisted = previousValid;
let failedRepairError;
try {
  const result = await runMarketExtraction({
    title: 'fixture',
    transcript: 'timed transcript '.repeat(80),
    callProvider: async () => malformedQuotes,
    repairProvider: async () => {
      failedRepairCalls += 1;
      return malformedQuotes;
    },
  });
  persisted = result.marketBriefData;
} catch (error) { failedRepairError = error; }
assert.equal(failedRepairError?.code, 'MARKET_EXTRACTION_FAILED');
assert.equal(failedRepairError?.failedChunks?.[0]?.repairAttemptCount, 1);
assert.equal(failedRepairError?.failedChunks?.[0]?.repairEligible, true);
assert.match(failedRepairError?.failedChunks?.[0]?.repairEligibilityReason || '', /repair attempt ran/);
assert.equal(failedRepairCalls, 1);
assert.deepEqual(persisted, previousValid);

let unavailableRepairError;
try {
  await runMarketExtraction({
    title: 'fixture',
    transcript: 'timed transcript '.repeat(80),
    callProvider: async () => malformedQuotes,
  });
} catch (error) { unavailableRepairError = error; }
assert.equal(unavailableRepairError?.failedChunks?.[0]?.repairAttemptCount, 0);
assert.equal(unavailableRepairError?.failedChunks?.[0]?.repairEligible, false);
assert.match(unavailableRepairError?.failedChunks?.[0]?.repairEligibilityReason || '', /No repair provider/);

const viteSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../src/services/geminiVideoContent.js', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
assert.match(viteSource, /responseMimeType:\s*'application\/json'/);
assert.match(viteSource, /responseSchema:\s*MARKET_BRIEF_RESPONSE_SCHEMA/);
assert.match(viteSource, /contentType === 'market' \|\| contentType === 'marketBrief'/);
assert.ok(MARKET_BRIEF_RESPONSE_SCHEMA?.properties?.chapters);
assert.match(clientSource, /contentType = "general"/);
assert.match(clientSource, /contentType,\s*\n\s*videoId/);
assert.match(panelSource, /assertPersistableMarketBrief\(result\.marketBriefData\)/);
assert.match(panelSource, /הנתונים הקודמים נשמרו ולא נדרסו/);
assert.match(panelSource, /if \(isMarketBriefCandidate\) assertPersistableMarketBrief\(parsed\)/);
assert.doesNotMatch(JSON.stringify(repairedRun), /GEMINI_API_KEY|transcript transcript transcript/);

console.log(JSON.stringify({
  status: 'passed',
  directParse: true,
  objectInput: true,
  oneRepairAttempt: repairCalls,
  failedRepairAttempts: failedRepairCalls,
  previousPayloadPreserved: persisted === previousValid,
  structuredMime: true,
  responseSchema: true,
  paidCalls: 0,
}, null, 2));
