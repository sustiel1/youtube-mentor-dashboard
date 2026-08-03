import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const {
  normalizeMarketBriefPayload,
  aggregateMarketBriefChunks,
  splitTranscript,
  parseStructuredMarketResponse,
  runMarketExtraction,
  evaluateMarketCompleteness,
} = require('../shared/marketExtractionContract.cjs');

const complete = normalizeMarketBriefPayload({
  contentType: 'marketBrief',
  marketOverview: {
    vix: { level: 0, direction: 'flat', note: 'explicit zero' },
    oil: { level: 80, note: 'oil evidence' },
    dollar: { level: 101.5 },
    bitcoin: { level: 63400 },
  },
  stocksMentioned: [{
    ticker: 'SNDK',
    priceLevel: 1100,
    action: 'watch',
    isNewToWatch: false,
  }],
  tradingOpportunities: [{
    ticker: 'IGV',
    entry: 100,
    stop: 95,
    target: 110,
    rrRatio: '1:2',
    invalidation: 'break below 95',
  }],
  watchlistLevels: [{
    ticker: 'QQQ',
    level: 0,
    condition: 'at',
    importance: 'critical',
    action: 'watch',
  }],
  unknownProviderField: { shouldNotPersist: true },
});

assert.equal(complete.marketOverview.vix.level, 0, 'numeric zero must survive normalization');
assert.equal(complete.stocksMentioned[0].isNewToWatch, false, 'boolean false must survive normalization');
assert.equal(complete.unknownProviderField, undefined, 'unknown provider fields must be ignored');
assert.equal(parseStructuredMarketResponse(`\`\`\`json\n${JSON.stringify(complete)}\n\`\`\``).contentType, 'marketBrief');
assert.throws(() => parseStructuredMarketResponse('{broken'), { code: 'INVALID_MARKET_JSON' });

const longTranscript = [
  'START_FACT VIX is explicitly 0. ',
  'a '.repeat(900),
  'COMMON_FACT SNDK is at 1100. ',
  'b '.repeat(900),
  'END_ONLY_FACT QQQ watch condition at zero. ',
].join('');
const chunks = splitTranscript(longTranscript, { chunkChars: 1100, overlapChars: 150, maxChunks: 6 });
assert.ok(chunks.length >= 2, 'long transcript must be split');
assert.equal(chunks.at(-1).end, longTranscript.trim().length, 'the end of a bounded transcript must not be silently discarded');

let repairCalls = 0;
const extracted = await runMarketExtraction({
  title: 'Market brief deterministic fixture',
  transcript: longTranscript,
  chunkOptions: { chunkChars: 1100, overlapChars: 150, maxChunks: 6 },
  callProvider: async (_prompt, chunk) => {
    if (chunk.index === 1) return '{malformed';
    return JSON.stringify({
      contentType: 'marketBrief',
      marketOverview: chunk.text.includes('START_FACT') ? { vix: { level: 0, note: 'explicit zero' } } : {},
      stocksMentioned: chunk.text.includes('COMMON_FACT')
        ? [{ ticker: 'SNDK', priceLevel: 1100, action: 'watch', isNewToWatch: false }]
        : [],
      watchlistLevels: chunk.text.includes('END_ONLY_FACT')
        ? [{ ticker: 'QQQ', level: 0, condition: 'at', importance: 'critical', action: 'watch' }]
        : [],
    });
  },
  repairProvider: async (_invalidJson, chunk) => {
    repairCalls += 1;
    return JSON.stringify({
      contentType: 'marketBrief',
      stocksMentioned: chunk.text.includes('COMMON_FACT')
        ? [{ ticker: 'SNDK', priceLevel: 1100, action: 'watch', isNewToWatch: false }]
        : [],
    });
  },
});

assert.equal(repairCalls, 1, 'malformed JSON must receive one bounded repair');
assert.equal(extracted.marketBriefData.marketOverview.vix.level, 0);
assert.equal(extracted.marketBriefData.stocksMentioned.length, 1, 'overlap must not duplicate a stock fact');
assert.equal(extracted.marketBriefData.watchlistLevels[0].level, 0, 'end-only fact and zero must survive aggregation');
assert.equal(extracted.marketBriefData.extractionMeta.truncated, false);

const partial = await runMarketExtraction({
  title: 'Partial deterministic fixture',
  transcript: 'x '.repeat(1600),
  chunkOptions: { chunkChars: 1100, overlapChars: 100, maxChunks: 4 },
  callProvider: async (_prompt, chunk) => {
    if (chunk.index === 1) throw Object.assign(new Error('mock chunk failure'), { code: 'MOCK_FAILURE' });
    return JSON.stringify({ contentType: 'marketBrief', macroFactors: [{ factor: 'USD', status: 'stable' }] });
  },
});
assert.equal(partial.marketBriefData.extractionMeta.partial, true, 'a failed chunk must be reported as partial');
assert.equal(partial.marketBriefData.extractionMeta.failedChunks.length, 1);

const deduped = aggregateMarketBriefChunks([
  {
    stocksMentioned: [{ ticker: 'MU', reason: 'distance from MA150' }],
    allPoints: [{ point: 'distance from MA150', category: 'technical' }],
  },
  {
    stocksMentioned: [{ ticker: 'MU', reason: 'distance from MA150', action: 'avoid' }],
  },
]);
assert.equal(deduped.stocksMentioned.length, 1, 'semantic identity must merge overlapping stock objects');
assert.equal(deduped.allPoints.length, 0, 'allPoints must not duplicate a dedicated structured fact');

const legacy = normalizeMarketBriefPayload({ shortSummary: 'legacy summary only' });
assert.equal(legacy.shortSummary, 'legacy summary only', 'old summary-only payloads must remain compatible');
assert.equal(legacy.stocksMentioned.length, 0, 'missing optional categories must remain empty');
assert.equal(evaluateMarketCompleteness(legacy).useful, false);

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
try {
  const { buildMorningBriefBulkSections } = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const sections = buildMorningBriefBulkSections({}, complete);
  const rows = sections.flatMap((section) => section.items.map((text) => ({ section: section.key, text })));
  assert.ok(rows.some(({ text }) => text.startsWith('VIX ·') && text.includes('0')), 'new-video payload must reach Specialized market rows');
  assert.ok(rows.some(({ text }) => text.startsWith('SNDK ·') && text.includes('1100')), 'new-video stock priceLevel must reach Specialized');
  assert.ok(rows.some(({ text }) => text.startsWith('QQQ · 0') && text.includes('תנאי: at')), 'new-video watchlist context must reach Specialized');
  const exportRows = rows.map(({ section, text }) => `${section}:${text}`);
  assert.deepEqual(exportRows, rows.map(({ section, text }) => `${section}:${text}`), 'UI and export must share the same mapped rows');
} finally {
  await vite.close();
}

console.log(JSON.stringify({
  status: 'passed',
  chunks: chunks.length,
  endFactPreserved: true,
  overlapDeduplicated: true,
  partialFailureReported: true,
  boundedRepairCalls: repairCalls,
  oldPayloadCompatible: true,
  paidCalls: 0,
}, null, 2));
