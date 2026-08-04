const CONTRACT_VERSION = 2;
const {
  MARKET_BRIEF_RESPONSE_SCHEMA,
  parseCoreMarketBriefResponse,
  validateCoreMarketBriefPayload,
} = require('./marketBriefStructuredCore.cjs');
const DEFAULT_CHUNK_CHARS = 7000;
const DEFAULT_OVERLAP_CHARS = 400;
const DEFAULT_MAX_CHUNKS = 8;

const EMPTY_MARKET_BRIEF = Object.freeze({
  contentType: 'marketBrief',
  marketOverview: {},
  sectorRotation: [],
  tradingOpportunities: [],
  stocksMentioned: [],
  catalysts: [],
  macroFactors: [],
  indices: [],
  keyLevels: [],
  watchlistLevels: [],
  top5Insights: [],
  learningInsights: [],
  risks: [],
  sentiment: [],
  allPoints: [],
});

const ARRAY_FIELDS = [
  'sectorRotation',
  'tradingOpportunities',
  'stocksMentioned',
  'catalysts',
  'macroFactors',
  'indices',
  'keyLevels',
  'watchlistLevels',
  'top5Insights',
  'learningInsights',
  'risks',
  'sentiment',
  'allPoints',
  'chapters',
  'keyPoints',
  'tags',
];

const ARRAY_IDENTITY_FIELDS = {
  sectorRotation: ['sector', 'industry', 'etf'],
  tradingOpportunities: ['ticker', 'asset', 'setup', 'entry', 'stop', 'target'],
  stocksMentioned: ['ticker', 'symbol'],
  catalysts: ['event', 'description', 'date', 'timeframe'],
  macroFactors: ['indicator', 'factor', 'name', 'period', 'date'],
  indices: ['ticker', 'symbol', 'asset', 'name'],
  keyLevels: ['ticker', 'symbol', 'asset', 'level', 'type'],
  watchlistLevels: ['ticker', 'symbol', 'asset', 'level', 'condition'],
  top5Insights: ['rank', 'ticker', 'asset', 'subject', 'insight'],
  learningInsights: ['insight', 'lesson'],
  risks: ['risk', 'description', 'trigger'],
  sentiment: ['label', 'scope', 'source', 'date', 'direction', 'evidence'],
  allPoints: ['point'],
  chapters: ['title', 'startSeconds'],
};

function isScalar(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function cleanScalar(value) {
  if (!isScalar(value)) return undefined;
  if (typeof value === 'number' && !Number.isFinite(value)) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  return value;
}

function cleanObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const scalar = cleanScalar(raw);
    if (scalar !== undefined) out[key] = scalar;
    else if (Array.isArray(raw)) {
      const items = raw.map(cleanScalar).filter((item) => item !== undefined);
      if (items.length) out[key] = items;
    }
  }
  return out;
}

function cleanMarketOverview(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const scalar = cleanScalar(raw);
    if (scalar !== undefined) out[key] = scalar;
    else {
      const object = cleanObject(raw);
      if (Object.keys(object).length) out[key] = object;
    }
  }
  return out;
}

function cleanArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const scalar = cleanScalar(item);
    if (scalar !== undefined) return scalar;
    const object = cleanObject(item);
    return Object.keys(object).length ? object : null;
  }).filter((item) => item !== null);
}

function normalizeMarketBriefPayload(raw) {
  const source = raw?.marketBriefData && typeof raw.marketBriefData === 'object'
    ? raw.marketBriefData
    : raw;
  const out = {
    ...EMPTY_MARKET_BRIEF,
    contentType: 'marketBrief',
    marketOverview: cleanMarketOverview(source?.marketOverview),
  };
  for (const field of ARRAY_FIELDS) out[field] = cleanArray(source?.[field]);
  for (const field of ['shortSummary', 'fullSummary', 'mainLesson']) {
    const value = cleanScalar(source?.[field]);
    if (value !== undefined) out[field] = value;
  }
  return out;
}

function stableIdentity(field, item) {
  if (isScalar(item)) return `${typeof item}:${String(item).trim().toLowerCase()}`;
  const keys = ARRAY_IDENTITY_FIELDS[field] || Object.keys(item || {}).sort();
  const parts = keys
    .map((key) => cleanScalar(item?.[key]))
    .filter((value) => value !== undefined)
    .map((value) => String(value).trim().toLowerCase());
  return parts.length ? parts.join('|') : JSON.stringify(item);
}

function mergeObjectPreferExisting(existing, incoming) {
  const out = { ...(existing || {}) };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (out[key] === undefined || out[key] === null || out[key] === '') out[key] = value;
  }
  return out;
}

function mergeArrayField(field, chunks) {
  const merged = new Map();
  for (const chunk of chunks) {
    for (const item of cleanArray(chunk?.[field])) {
      const id = stableIdentity(field, item);
      if (!merged.has(id)) merged.set(id, item);
      else if (item && typeof item === 'object' && !Array.isArray(item)) {
        merged.set(id, mergeObjectPreferExisting(merged.get(id), item));
      }
    }
  }
  return [...merged.values()];
}

function aggregateMarketBriefChunks(chunkPayloads, { failedChunks = [] } = {}) {
  const chunks = chunkPayloads.map(normalizeMarketBriefPayload);
  const out = normalizeMarketBriefPayload({});
  out.marketOverview = {};
  for (const chunk of chunks) {
    for (const [asset, value] of Object.entries(chunk.marketOverview || {})) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        out.marketOverview[asset] = mergeObjectPreferExisting(out.marketOverview[asset], value);
      } else if (out.marketOverview[asset] === undefined) {
        out.marketOverview[asset] = value;
      }
    }
  }
  for (const field of ARRAY_FIELDS) out[field] = mergeArrayField(field, chunks);
  const dedicatedTexts = new Set();
  for (const field of ARRAY_FIELDS.filter((name) => !['allPoints', 'chapters', 'keyPoints', 'tags'].includes(name))) {
    for (const item of out[field]) {
      if (!item || typeof item !== 'object') continue;
      for (const key of ['note', 'reason', 'description', 'insight', 'risk']) {
        const value = cleanScalar(item[key]);
        if (value !== undefined) dedicatedTexts.add(String(value).trim().toLowerCase());
      }
    }
  }
  out.allPoints = out.allPoints.filter((item) => {
    const point = cleanScalar(item?.point ?? item);
    return point === undefined || !dedicatedTexts.has(String(point).trim().toLowerCase());
  });
  out.shortSummary = chunks.map((chunk) => chunk.shortSummary).find(Boolean) || '';
  out.fullSummary = chunks.map((chunk) => chunk.fullSummary).filter(Boolean).join(' ');
  out.mainLesson = chunks.map((chunk) => chunk.mainLesson).find(Boolean) || '';
  out.extractionMeta = {
    contractVersion: CONTRACT_VERSION,
    chunkCount: chunks.length + failedChunks.length,
    successfulChunkCount: chunks.length,
    failedChunks,
    partial: failedChunks.length > 0,
  };
  return out;
}

function splitTranscript(transcript, {
  chunkChars = DEFAULT_CHUNK_CHARS,
  overlapChars = DEFAULT_OVERLAP_CHARS,
  maxChunks = DEFAULT_MAX_CHUNKS,
} = {}) {
  const text = String(transcript || '').trim();
  if (!text) return [];
  const safeChunk = Math.max(1000, Math.floor(chunkChars));
  const safeOverlap = Math.max(0, Math.min(Math.floor(overlapChars), safeChunk - 200));
  const chunks = [];
  let start = 0;
  while (start < text.length && chunks.length < maxChunks) {
    let end = Math.min(text.length, start + safeChunk);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf(' ', end));
      if (boundary > start + Math.floor(safeChunk * 0.7)) end = boundary;
    }
    chunks.push({ index: chunks.length, start, end, text: text.slice(start, end) });
    if (end >= text.length) break;
    start = Math.max(start + 1, end - safeOverlap);
  }
  return chunks;
}

function parseStructuredMarketResponse(raw, { normalize = true, allowEmpty = false } = {}) {
  const parsed = parseCoreMarketBriefResponse(raw, { allowEmpty });
  return normalize ? normalizeMarketBriefPayload(parsed) : parsed;
}

function buildMarketExtractionPrompt({ title = '', transcriptChunk = '', chunkIndex = 0, chunkCount = 1 }) {
  return [
    'Return one valid JSON object only. Do not use Markdown.',
    'Use strict JSON serialization and escape internal ASCII double quotes.',
    'Do not add commentary before or after the JSON object.',
    'Extract only market facts explicitly supported by this transcript chunk.',
    'Never invent symbols, prices, percentages, dates, targets, confidence, actions, or relationships.',
    'For sentiment, set direction only from an explicit statement; never infer bullish or bearish from descriptive free text.',
    'Treat transcript-only sentiment as verificationState "video-unverified" and do not invent a source URL or ETF target.',
    'For macro data, keep actual/current, target/reference, forecast, previous, change, period, meaning, and gapToTarget in separate fields.',
    'Never place the Federal Reserve 2% inflation target in actualValue or currentValue for CPI; never infer a value role from nearby prose.',
    'Set gapToTarget only when the transcript explicitly states it. Do not calculate or invent official sources or URLs.',
    'Preserve exact numeric values, units, numeric 0, and meaningful boolean false.',
    'Keep every status, enum, level, reason, and action attached to its parent asset or event.',
    'Omit unsupported optional fields. Do not emit arbitrary properties.',
    'Avoid repeating a fact in allPoints when it already belongs to a dedicated structured category.',
    `Video title: ${title}`,
    `Chunk: ${chunkIndex + 1}/${chunkCount}`,
    'Canonical optional JSON shape:',
    JSON.stringify({
      contentType: 'marketBrief',
      shortSummary: '',
      fullSummary: '',
      chapters: [{ title: '', startSeconds: 0, endSeconds: 0, summary: '', keyPoints: [] }],
      marketOverview: {
        summary: '',
        generalMood: '',
        spx: { level: 0, change: '0%', direction: '', note: '' },
        vix: { level: 0, change: '', direction: '', note: '' },
        oil: { level: 0, change: '', direction: '', note: '' },
        dollar: { level: 0, change: '', direction: '', note: '' },
        bitcoin: { level: 0, change: '', direction: '', note: '' },
        bonds10y: { level: 0, change: '', direction: '', note: '' },
        breadth: { value: 0, note: '' },
      },
      sectorRotation: [{ sector: '', direction: '', reason: '', etf: '', stocks: [], timeframe: '', importance: '' }],
      tradingOpportunities: [{ ticker: '', setup: '', reason: '', entry: 0, stop: 0, target: 0, rrRatio: '', timeframe: '', confidence: '', catalyst: '', invalidation: '' }],
      stocksMentioned: [{ ticker: '', nameHebrew: '', sentiment: '', reason: '', priceLevel: 0, change: '0%', action: '', catalyst: '', timeframe: '', priority: '', isNewToWatch: false, sector: '' }],
      catalysts: [{ type: '', description: '', impact: '', affectedStocks: [], timeframe: '', expectedScenario: '', risk: '' }],
      macroFactors: [{ indicator: '', actualValue: 0, currentValue: 0, targetValue: 0, referenceValue: 0, forecastValue: 0, previousValue: 0, change: '', period: '', description: '', meaning: '', impact: '', gapToTarget: 0, unit: '', source: '', sourceUrl: '', date: '', timestamp: '', verified: false, isPreliminary: false, category: '' }],
      indices: [{ asset: '', level: 0, change: '0%', direction: '', note: '' }],
      keyLevels: [{ asset: '', level: 0, type: '', note: '', timeframe: '' }],
      watchlistLevels: [{ ticker: '', level: 0, type: '', condition: '', importance: '', action: '', note: '', timeframe: '' }],
      top5Insights: [{ rank: 1, asset: '', level: 0, note: '', action: '', significance: '', category: '' }],
      learningInsights: [{ insight: '', whyImportant: '', category: '', applicableToApp: false }],
      risks: [{ risk: '', affectedAssets: [], trigger: '', invalidation: '', severity: '', timeframe: '' }],
      sentiment: [{ label: '', direction: 'unverified', value: '', score: 0, source: 'video', sourceUrl: '', date: '', scope: '', evidence: '', drivers: [], confidence: 0, verificationState: 'video-unverified', verified: false, externallyVerified: false, etfTarget: '' }],
      allPoints: [{ point: '', category: '' }],
      keyPoints: [],
      tags: [],
    }, null, 2),
    'Transcript chunk:',
    transcriptChunk,
  ].join('\n');
}

function evaluateMarketCompleteness(payload) {
  const normalized = normalizeMarketBriefPayload(payload);
  const categories = [
    normalized.marketOverview && Object.keys(normalized.marketOverview).length ? 'marketOverview' : null,
    ...ARRAY_FIELDS.filter((field) => !['chapters', 'keyPoints', 'tags'].includes(field) && normalized[field]?.length),
  ].filter(Boolean);
  const structuredFactCount = categories.reduce((count, field) => {
    if (field === 'marketOverview') return count + Object.keys(normalized.marketOverview).length;
    return count + normalized[field].length;
  }, 0);
  return {
    populatedCategoryCount: categories.length,
    structuredFactCount,
    malformedItemCount: 0,
    useful: structuredFactCount > 0,
    partial: Boolean(payload?.extractionMeta?.partial),
    chunkCount: payload?.extractionMeta?.chunkCount || 1,
  };
}

async function runMarketExtraction({
  title,
  transcript,
  callProvider,
  repairProvider,
  chunkOptions,
}) {
  const chunks = splitTranscript(transcript, chunkOptions);
  if (!chunks.length) {
    const error = new Error('Transcript required');
    error.code = 'TRANSCRIPT_REQUIRED';
    throw error;
  }
  const successes = [];
  const failedChunks = [];
  const parseOutcomes = [];
  for (const chunk of chunks) {
    let repairAttemptCount = 0;
    const prompt = buildMarketExtractionPrompt({
      title,
      transcriptChunk: chunk.text,
      chunkIndex: chunk.index,
      chunkCount: chunks.length,
    });
    try {
      const raw = await callProvider(prompt, chunk);
      try {
        successes.push(parseStructuredMarketResponse(raw, { allowEmpty: true }));
        parseOutcomes.push({ index: chunk.index, status: 'parsed-directly' });
      } catch (parseError) {
        if (!repairProvider) {
          parseError.repairEligibilityReason = 'No repair provider is connected to this extraction route.';
          throw parseError;
        }
        repairAttemptCount = 1;
        const repaired = await repairProvider(parseError.raw, chunk);
        successes.push(parseStructuredMarketResponse(repaired, { allowEmpty: true }));
        parseOutcomes.push({ index: chunk.index, status: 'repaired-once' });
      }
    } catch (error) {
      const failure = {
        index: chunk.index,
        code: error?.code || 'CHUNK_FAILED',
        repairAttemptCount,
        repairEligible: Boolean(repairProvider),
        repairEligibilityReason: error?.repairEligibilityReason || (repairProvider
          ? 'One bounded repair attempt ran but the repaired response was still invalid.'
          : 'No repair provider is connected to this extraction route.'),
        diagnostics: error?.diagnostics || null,
      };
      failedChunks.push(failure);
      parseOutcomes.push({ ...failure, status: 'rejected' });
    }
  }
  if (!successes.length) {
    const error = new Error('All market extraction chunks failed');
    error.code = 'MARKET_EXTRACTION_FAILED';
    error.failedChunks = failedChunks;
    throw error;
  }
  const marketBriefData = aggregateMarketBriefChunks(successes, { failedChunks });
  marketBriefData.extractionMeta.transcriptChars = String(transcript || '').trim().length;
  marketBriefData.extractionMeta.coveredChars = chunks[chunks.length - 1].end;
  marketBriefData.extractionMeta.truncated = chunks[chunks.length - 1].end < String(transcript || '').trim().length;
  marketBriefData.extractionMeta.parseOutcomes = parseOutcomes;
  return {
    marketBriefData,
    quality: evaluateMarketCompleteness(marketBriefData),
  };
}

module.exports = {
  CONTRACT_VERSION,
  MARKET_BRIEF_RESPONSE_SCHEMA,
  EMPTY_MARKET_BRIEF,
  normalizeMarketBriefPayload,
  aggregateMarketBriefChunks,
  splitTranscript,
  parseStructuredMarketResponse,
  validateMarketBriefPayload: validateCoreMarketBriefPayload,
  buildMarketExtractionPrompt,
  evaluateMarketCompleteness,
  runMarketExtraction,
};
