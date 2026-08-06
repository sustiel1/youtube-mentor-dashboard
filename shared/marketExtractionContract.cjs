const CONTRACT_VERSION = 2;
const { canonicalizeMarketAsset } = require('./marketAssetIdentity.cjs');
const DEFAULT_CHUNK_CHARS = 7000;
const DEFAULT_OVERLAP_CHARS = 400;
const DEFAULT_MAX_CHUNKS = 8;

const MARKET_BRIEF_RESPONSE_SCHEMA = Object.freeze({
  type: 'OBJECT',
  properties: {
    contentType: { type: 'STRING', enum: ['marketBrief'] },
    briefType: { type: 'STRING', enum: ['morning', 'evening', 'unknown'], nullable: true },
    marketSession: { type: 'STRING', enum: ['before-market', 'after-market', 'unknown'], nullable: true },
    shortSummary: { type: 'STRING', nullable: true },
    fullSummary: { type: 'STRING', nullable: true },
    mainLesson: { type: 'STRING', nullable: true },
    marketOverview: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        summary: { type: 'STRING', nullable: true },
        generalMood: { type: 'STRING', nullable: true },
      },
    },
    chapters: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          startSeconds: { type: 'NUMBER', nullable: true },
          endSeconds: { type: 'NUMBER', nullable: true },
          summary: { type: 'STRING', nullable: true },
          keyPoints: { type: 'ARRAY', items: { type: 'STRING' } },
        },
      },
    },
    top5Insights: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: {
        insight: { type: 'STRING' }, whyImportant: { type: 'STRING', nullable: true },
        startSeconds: { type: 'NUMBER', nullable: true }, endSeconds: { type: 'NUMBER', nullable: true },
        timestampSource: { type: 'STRING', enum: ['youtube-timedtext', 'explicit-input', 'official-youtube-chapter', 'timed-transcript-alignment', 'unavailable'] },
        timestampConfidence: { type: 'NUMBER', nullable: true },
      }, required: ['insight'] },
    },
    learningInsights: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: {
        lesson: { type: 'STRING' }, whyImportant: { type: 'STRING', nullable: true },
        category: { type: 'STRING', nullable: true }, applicableToApp: { type: 'BOOLEAN', nullable: true },
        startSeconds: { type: 'NUMBER', nullable: true }, endSeconds: { type: 'NUMBER', nullable: true },
        timestampSource: { type: 'STRING', enum: ['youtube-timedtext', 'explicit-input', 'official-youtube-chapter', 'timed-transcript-alignment', 'unavailable'] },
        timestampConfidence: { type: 'NUMBER', nullable: true },
      }, required: ['lesson'] },
    },
    stocksMentioned: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ticker: { type: 'STRING' },
          exchange: { type: 'STRING', nullable: true },
          reason: { type: 'STRING', nullable: true },
          sentiment: { type: 'STRING', nullable: true },
          change: { type: 'STRING', nullable: true },
        },
      },
    },
    marketNews: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          summary: { type: 'STRING', nullable: true },
          impact: { type: 'STRING', nullable: true },
          sentiment: { type: 'STRING', enum: ['positive', 'negative', 'neutral', 'mixed', 'unknown'] },
          sentimentReason: { type: 'STRING', nullable: true },
          sentimentConfidence: { type: 'NUMBER', nullable: true },
          sourceEvidence: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['title', 'sentiment'],
      },
    },
    indices: { type: 'ARRAY', items: { type: 'OBJECT', properties: { asset: { type: 'STRING' }, change: { type: 'STRING', nullable: true }, direction: { type: 'STRING', nullable: true }, note: { type: 'STRING', nullable: true } } } },
    macroFactors: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      factor: { type: 'STRING' }, canonicalKey: { type: 'STRING', nullable: true },
      actualValue: { type: 'NUMBER', nullable: true }, unit: { type: 'STRING', nullable: true },
      period: { type: 'STRING', nullable: true }, asOf: { type: 'STRING', nullable: true },
      targetValue: { type: 'NUMBER', nullable: true }, referenceValue: { type: 'NUMBER', nullable: true },
      referenceType: { type: 'STRING', nullable: true }, gapValue: { type: 'NUMBER', nullable: true },
      trend: { type: 'STRING', nullable: true }, description: { type: 'STRING', nullable: true },
      marketMeaning: { type: 'STRING', nullable: true }, sourceName: { type: 'STRING', nullable: true },
      sourceUrl: { type: 'STRING', nullable: true }, sourceType: { type: 'STRING', nullable: true },
      verificationStatus: { type: 'STRING', nullable: true }, status: { type: 'STRING', nullable: true },
      impact: { type: 'STRING', nullable: true }, note: { type: 'STRING', nullable: true },
    } } },
    sentiment: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      label: { type: 'STRING' }, scope: { type: 'STRING', nullable: true }, subject: { type: 'STRING', nullable: true },
      value: { type: 'NUMBER', nullable: true }, unit: { type: 'STRING', nullable: true }, sentiment: { type: 'STRING', nullable: true },
      reason: { type: 'STRING', nullable: true }, drivers: { type: 'ARRAY', items: { type: 'STRING' } },
      evidence: { type: 'ARRAY', items: { type: 'STRING' } }, timeframe: { type: 'STRING', nullable: true },
      asOf: { type: 'STRING', nullable: true }, sourceName: { type: 'STRING', nullable: true },
      sourceType: { type: 'STRING', nullable: true }, sourceUrl: { type: 'STRING', nullable: true },
      confidence: { type: 'NUMBER', nullable: true }, verificationStatus: { type: 'STRING', nullable: true },
    } } },
    sectorRotation: { type: 'ARRAY', items: { type: 'OBJECT', properties: { sector: { type: 'STRING' }, direction: { type: 'STRING', nullable: true }, reason: { type: 'STRING', nullable: true }, etf: { type: 'STRING', nullable: true } } } },
    tradingOpportunities: { type: 'ARRAY', items: { type: 'OBJECT', properties: { ticker: { type: 'STRING', nullable: true }, setup: { type: 'STRING', nullable: true }, reason: { type: 'STRING', nullable: true } } } },
    catalysts: { type: 'ARRAY', items: { type: 'OBJECT', properties: { type: { type: 'STRING', nullable: true }, description: { type: 'STRING' }, impact: { type: 'STRING', nullable: true } } } },
    risks: { type: 'ARRAY', items: { type: 'OBJECT', properties: { risk: { type: 'STRING' }, severity: { type: 'STRING', nullable: true }, timeframe: { type: 'STRING', nullable: true } } } },
    keyPoints: { type: 'ARRAY', items: { type: 'STRING' } },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['contentType'],
});

const EMPTY_MARKET_BRIEF = Object.freeze({
  contentType: 'marketBrief',
  marketOverview: {},
  sectorRotation: [],
  tradingOpportunities: [],
  stocksMentioned: [],
  marketNews: [],
  catalysts: [],
  macroFactors: [],
  sentiment: [],
  indices: [],
  keyLevels: [],
  watchlistLevels: [],
  top5Insights: [],
  learningInsights: [],
  risks: [],
  allPoints: [],
});

const ARRAY_FIELDS = [
  'sectorRotation',
  'tradingOpportunities',
  'stocksMentioned',
  'marketNews',
  'catalysts',
  'macroFactors',
  'sentiment',
  'indices',
  'keyLevels',
  'watchlistLevels',
  'top5Insights',
  'learningInsights',
  'risks',
  'allPoints',
  'chapters',
  'keyPoints',
  'tags',
];

const ARRAY_IDENTITY_FIELDS = {
  sectorRotation: ['sector', 'industry', 'etf'],
  tradingOpportunities: ['ticker', 'asset', 'setup', 'entry', 'stop', 'target'],
  stocksMentioned: ['ticker', 'symbol'],
  marketNews: ['title', 'headline', 'event'],
  catalysts: ['event', 'description', 'date', 'timeframe'],
  macroFactors: ['factor', 'indicator', 'name'],
  sentiment: ['label', 'scope', 'subject'],
  indices: ['ticker', 'symbol', 'asset', 'name'],
  keyLevels: ['ticker', 'symbol', 'asset', 'level', 'type'],
  watchlistLevels: ['ticker', 'symbol', 'asset', 'level', 'condition'],
  top5Insights: ['rank', 'ticker', 'asset', 'subject', 'insight'],
  learningInsights: ['insight', 'lesson'],
  risks: ['risk', 'description', 'trigger'],
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

const TIMESTAMP_SOURCES = new Set([
  'youtube-timedtext',
  'explicit-input',
  'official-youtube-chapter',
  'timed-transcript-alignment',
  'unavailable',
]);
const TIMED_INSIGHT_GROUPS = [
  'top5Insights', 'learningInsights', 'marketLessons', 'tradingInsights', 'conclusions',
];

function cleanTimedItem(value) {
  if (typeof value === 'string') return cleanScalar(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = cleanObject(value);
  for (const field of ['startSeconds', 'endSeconds', 'timestampConfidence']) {
    if (value[field] === null) out[field] = null;
    else if (typeof value[field] === 'number' && Number.isFinite(value[field])) out[field] = value[field];
  }
  if (typeof value.timestampSource === 'string') out.timestampSource = value.timestampSource.trim();
  return Object.keys(out).length ? out : undefined;
}

function cleanTimedArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanTimedItem).filter((item) => item !== undefined);
}

function cleanUsefulKnowledgeNode(value) {
  if (Array.isArray(value)) return cleanTimedArray(value);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cleanUsefulKnowledgeNode(child)]));
}

function normalizeUniversalTabs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = cleanObject(value);
  const insights = value.insights;
  if (insights && typeof insights === 'object' && !Array.isArray(insights)) {
    out.insights = { ...cleanObject(insights) };
    for (const group of TIMED_INSIGHT_GROUPS) {
      if (Array.isArray(insights[group])) out.insights[group] = cleanTimedArray(insights[group]);
    }
  }
  if (value.usefulKnowledge && typeof value.usefulKnowledge === 'object') {
    out.usefulKnowledge = cleanUsefulKnowledgeNode(value.usefulKnowledge);
  }
  return out;
}

function validateTimedItem(item, field) {
  if (typeof item === 'string') return;
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw Object.assign(new Error(`${field} item must be a string or object`), { code: 'INVALID_MARKET_SCHEMA', field });
  const { startSeconds, endSeconds, timestampConfidence, timestampSource } = item;
  for (const [name, number] of Object.entries({ startSeconds, endSeconds, timestampConfidence })) {
    if (number !== undefined && number !== null && (typeof number !== 'number' || !Number.isFinite(number))) {
      throw Object.assign(new Error(`${field}.${name} must be a finite number or null`), { code: 'INVALID_MARKET_SCHEMA', field });
    }
  }
  if (startSeconds != null && startSeconds < 0) throw Object.assign(new Error(`${field}.startSeconds must not be negative`), { code: 'INVALID_MARKET_SCHEMA', field });
  if (endSeconds != null && (endSeconds < 0 || startSeconds == null || endSeconds <= startSeconds)) throw Object.assign(new Error(`${field}.endSeconds must be greater than startSeconds`), { code: 'INVALID_MARKET_SCHEMA', field });
  if (timestampConfidence != null && (timestampConfidence < 0 || timestampConfidence > 1)) throw Object.assign(new Error(`${field}.timestampConfidence must be between 0 and 1`), { code: 'INVALID_MARKET_SCHEMA', field });
  if (timestampSource != null && !TIMESTAMP_SOURCES.has(timestampSource)) throw Object.assign(new Error(`${field}.timestampSource is unsupported`), { code: 'INVALID_MARKET_SCHEMA', field });
}

function visitUsefulKnowledgeLeaves(value, field, visit) {
  if (Array.isArray(value)) value.forEach((item) => visit(item, field));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => visitUsefulKnowledgeLeaves(child, `${field}.${key}`, visit));
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
  for (const field of ['indices', 'keyLevels', 'watchlistLevels']) {
    out[field] = out[field].map((item) => {
      if (!item || typeof item !== 'object') return item;
      const identityKey = ['asset', 'ticker', 'symbol', 'name'].find((key) => item[key]);
      if (!identityKey) return item;
      return { ...item, [identityKey]: canonicalizeMarketAsset(item[identityKey]) };
    });
  }
  for (const field of ['shortSummary', 'fullSummary', 'mainLesson', 'briefType', 'marketSession']) {
    const value = cleanScalar(source?.[field]);
    if (value !== undefined) out[field] = value;
  }
  const universalTabs = normalizeUniversalTabs(source?.universalTabs);
  if (universalTabs) out.universalTabs = universalTabs;
  if (out.universalTabs?.insights) {
    if (Array.isArray(out.universalTabs.insights.top5Insights)) out.top5Insights = out.universalTabs.insights.top5Insights;
    else if (out.top5Insights.length) out.universalTabs.insights.top5Insights = out.top5Insights;
    if (Array.isArray(out.universalTabs.insights.learningInsights)) out.learningInsights = out.universalTabs.insights.learningInsights;
    else if (out.learningInsights.length) out.universalTabs.insights.learningInsights = out.learningInsights;
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
  out.briefType = chunks.map((chunk) => chunk.briefType).find(Boolean) || undefined;
  out.marketSession = chunks.map((chunk) => chunk.marketSession).find(Boolean) || undefined;
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

function stripJsonFence(raw) {
  const text = String(raw || '').trim();
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : text;
}

function diagnosticHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `mp-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function redactParserExcerpt(value) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._=\-]+/gi, 'Bearer [REDACTED]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_GOOGLE_KEY]')
    .replace(/\bsk-(?:ant-)?[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_API_KEY]');
}

function parserPositionFromMessage(message) {
  const match = String(message || '').match(/\bposition\s+(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function boundedParserExcerpt(value, position) {
  if (!Number.isFinite(position)) return '';
  const text = String(value || '');
  const safePosition = Math.max(0, Math.min(position, text.length));
  const before = redactParserExcerpt(text.slice(Math.max(0, safePosition - 300), safePosition));
  const character = redactParserExcerpt(text.slice(safePosition, safePosition + 1)) || '[END OF INPUT]';
  const after = redactParserExcerpt(text.slice(safePosition + 1, safePosition + 301));
  return `${before}⟦OFFSET ${safePosition} · CHAR ${JSON.stringify(character)}⟧${after}`;
}

function buildMarketParserTrace(rawProviderOutput, parserInput, parseMessage = '') {
  const raw = String(rawProviderOutput || '').trim();
  const parsed = String(parserInput || '');
  const position = parserPositionFromMessage(parseMessage);
  return {
    rawLength: raw.length,
    parserInputLength: parsed.length,
    rawHash: diagnosticHash(raw),
    parserInputHash: diagnosticHash(parsed),
    relation: raw === parsed ? 'identical' : 'changed-before-parse',
    rawExcerpt: boundedParserExcerpt(raw, position),
    parserInputExcerpt: boundedParserExcerpt(parsed, position),
  };
}

const MARKET_BRIEF_FIELDS = new Set([
  'contentType', 'briefType', 'marketSession', 'shortSummary', 'fullSummary', 'mainLesson', 'chapters',
  'marketOverview', 'marketNews', 'sectorRotation', 'tradingOpportunities', 'stocksMentioned',
  'catalysts', 'macroFactors', 'indices', 'keyLevels', 'watchlistLevels',
  'top5Insights', 'learningInsights', 'risks', 'allPoints', 'keyPoints', 'tags',
  'universalTabs', 'rawData', 'economicCalendar', 'sentiment',
]);

function marketJsonLooksTruncated(text) {
  let inString = false;
  let escaped = false;
  const stack = [];
  for (const char of text) {
    if (escaped) { escaped = false; continue; }
    if (inString && char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if ((char === '}' || char === ']') && stack[stack.length - 1] === char) stack.pop();
  }
  return inString || stack.length > 0;
}

function validateMarketBriefPayload(parsed, { allowEmpty = false } = {}) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const error = new Error('Provider market response must be a JSON object');
    error.code = 'INVALID_MARKET_SCHEMA';
    throw error;
  }
  const recognized = Object.keys(parsed).filter((key) => MARKET_BRIEF_FIELDS.has(key) && key !== 'contentType');
  const hasMeaningfulValue = recognized.some((key) => {
    const value = parsed[key];
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return value === 0 || value === false;
  });
  if (!recognized.length || (!allowEmpty && !hasMeaningfulValue)) {
    const error = new Error('Provider market response has no recognized Market Brief fields');
    error.code = 'INVALID_MARKET_SCHEMA';
    throw error;
  }
  if (parsed.contentType != null && !['marketBrief', 'market'].includes(parsed.contentType)) {
    const error = new Error('Provider response contentType is not Market Brief');
    error.code = 'INVALID_MARKET_SCHEMA';
    throw error;
  }
  for (const field of ARRAY_FIELDS) {
    if (parsed[field] != null && !Array.isArray(parsed[field])) {
      const error = new Error(`Market Brief field ${field} must be an array`);
      error.code = 'INVALID_MARKET_SCHEMA';
      error.field = field;
      throw error;
    }
  }
  if (parsed.universalTabs != null && (typeof parsed.universalTabs !== 'object' || Array.isArray(parsed.universalTabs))) {
    const error = new Error('Market Brief universalTabs must be an object');
    error.code = 'INVALID_MARKET_SCHEMA';
    error.field = 'universalTabs';
    throw error;
  }
  for (const field of ['top5Insights', 'learningInsights']) {
    if (Array.isArray(parsed[field])) parsed[field].forEach((item) => validateTimedItem(item, field));
  }
  const insights = parsed.universalTabs?.insights;
  if (insights != null && (typeof insights !== 'object' || Array.isArray(insights))) {
    throw Object.assign(new Error('Market Brief universalTabs.insights must be an object'), { code: 'INVALID_MARKET_SCHEMA', field: 'universalTabs.insights' });
  }
  for (const group of TIMED_INSIGHT_GROUPS) {
    if (insights?.[group] != null && !Array.isArray(insights[group])) throw Object.assign(new Error(`universalTabs.insights.${group} must be an array`), { code: 'INVALID_MARKET_SCHEMA', field: group });
    insights?.[group]?.forEach((item) => validateTimedItem(item, `universalTabs.insights.${group}`));
  }
  visitUsefulKnowledgeLeaves(parsed.universalTabs?.usefulKnowledge, 'universalTabs.usefulKnowledge', validateTimedItem);
  return parsed;
}

function parseStructuredMarketResponse(raw, { normalize = true, allowEmpty = false } = {}) {
  if (raw && typeof raw === 'object') {
    const validated = validateMarketBriefPayload(raw, { allowEmpty });
    return normalize ? normalizeMarketBriefPayload(validated) : validated;
  }
  const cleaned = stripJsonFence(raw);
  if (!cleaned) {
    const error = new Error('Provider returned an empty market response');
    error.code = 'EMPTY_PROVIDER_RESPONSE';
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (cause) {
    const error = new Error('Provider returned invalid market JSON');
    error.code = marketJsonLooksTruncated(cleaned) ? 'TRUNCATED_MARKET_JSON' : 'MALFORMED_MARKET_JSON';
    error.cause = cause;
    error.raw = cleaned;
    const parseMessage = String(cause?.message || '');
    error.diagnostics = {
      responseLength: cleaned.length,
      parseMessage,
      payloadTrace: buildMarketParserTrace(raw, cleaned, parseMessage),
    };
    throw error;
  }
  const validated = validateMarketBriefPayload(parsed, { allowEmpty });
  return normalize ? normalizeMarketBriefPayload(validated) : validated;
}

function buildMarketExtractionPrompt({ title = '', transcriptChunk = '', transcriptSegments = [], chunkIndex = 0, chunkCount = 1 }) {
  return [
    'Return one valid JSON object only. Do not use Markdown.',
    'All string values must be JSON-safe; escape internal ASCII double quotes through standard JSON serialization.',
    'Do not add commentary before or after the JSON object.',
    'Preserve supported numeric 0, boolean false, empty arrays, and valid null values.',
    'Do not fabricate timestamps; preserve real transcript timing evidence exactly.',
    'Extract only market facts explicitly supported by this transcript chunk.',
    'Never invent symbols, prices, percentages, dates, targets, confidence, actions, or relationships.',
    'Preserve exact numeric values, units, numeric 0, and meaningful boolean false.',
    'Keep every status, enum, level, reason, and action attached to its parent asset or event.',
    'For asset identity, use BITCOIN as the canonical identity for BTC/BITCOIN.',
    'When evidence identifies a value role, use currentValue, dailyLow, support, or resistance; do not overload level.',
    'For events, preserve sourceRelativeText and provide eventDate/eventTime/timezone only when explicitly supported.',
    'If timing evidence conflicts, set timingStatus to conflicting and do not choose an authoritative date.',
    'Omit unsupported optional fields. Do not emit arbitrary properties.',
    'Avoid repeating a fact in allPoints when it already belongs to a dedicated structured category.',
    'Extract up to three distinct tradingOpportunities and up to three distinct risks, using only explicit transcript evidence; empty arrays are valid.',
    'For every marketNews item, emit sentiment as exactly positive, negative, neutral, mixed, or unknown relative to an explicit company, sector, broad-market, or macro scope.',
    'Use positive/negative only with directional evidence such as actual-versus-forecast, guidance, revenue/profit change, regulation, supply/demand impact, or explicit market reaction. Use mixed for material conflicting effects, neutral for verified non-directional facts, and unknown when evidence is insufficient. Never infer sentiment from importance or category.',
    'Never duplicate or invent an item to reach a count. A structured opportunity needs an identifiable asset or theme plus an explicit rationale; distinguish a complete setup from a general theme to monitor.',
    'A structured risk needs an identifiable condition plus an affected asset/theme or explicit consequence.',
    `Video title: ${title}`,
    `Chunk: ${chunkIndex + 1}/${chunkCount}`,
    'Timed transcript input (segments are absolute full-video timing; an empty segments array means timing is unavailable):',
    JSON.stringify({ text: transcriptChunk, segments: transcriptSegments }),
    'Canonical optional JSON shape:',
    JSON.stringify({
      contentType: 'marketBrief',
      briefType: 'unknown',
      marketSession: 'unknown',
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
        bitcoin: { currentValue: 0, dailyLow: 0, support: 0, resistance: 0, level: 0, change: '', direction: '', note: '' },
        bonds10y: { level: 0, change: '', direction: '', note: '' },
        breadth: { value: 0, note: '' },
      },
      sectorRotation: [{ sector: '', direction: '', reason: '', etf: '', stocks: [], timeframe: '', importance: '' }],
      tradingOpportunities: [{ ticker: '', setup: '', reason: '', entry: 0, stop: 0, target: 0, rrRatio: '', timeframe: '', confidence: '', catalyst: '', invalidation: '' }],
      stocksMentioned: [{ ticker: '', exchange: '', nameHebrew: '', sentiment: '', reason: '', priceLevel: 0, change: '0%', action: '', catalyst: '', timeframe: '', priority: '', isNewToWatch: false, sector: '' }],
      marketNews: [{ title: '', summary: '', impact: '', sentiment: 'unknown', sentimentReason: '', sentimentConfidence: 0, sourceEvidence: [] }],
      catalysts: [{ type: '', description: '', impact: '', affectedStocks: [], timeframe: '', eventDate: '', eventTime: '', timezone: '', sourceRelativeText: '', timingStatus: '', expectedScenario: '', risk: '' }],
      macroFactors: [{ factor: '', canonicalKey: '', actualValue: 0, unit: '', period: '', asOf: '', targetValue: 0, referenceValue: 0, referenceType: 'none', gapValue: 0, trend: 'unknown', description: '', marketMeaning: '', sourceName: '', sourceUrl: '', sourceType: 'video-claim', verificationStatus: 'unverified', status: '', impact: '', note: '', category: '' }],
      sentiment: [{ label: '', scope: 'broad-market', subject: '', value: 0, unit: '', sentiment: 'mixed', reason: '', drivers: [], evidence: [], timeframe: '', asOf: '', sourceName: '', sourceType: 'video-claim', sourceUrl: '', confidence: 0, verificationStatus: 'unverified' }],
      indices: [{ asset: '', currentValue: 0, dailyLow: 0, level: 0, change: '0%', direction: '', note: '' }],
      keyLevels: [{ asset: '', level: 0, support: 0, resistance: 0, valueRole: '', type: '', note: '', timeframe: '' }],
      watchlistLevels: [{ ticker: '', level: 0, dailyLow: 0, support: 0, resistance: 0, valueRole: '', type: '', condition: '', importance: '', action: '', note: '', timeframe: '' }],
      top5Insights: [{ rank: 1, asset: '', level: 0, note: '', action: '', significance: '', category: '' }],
      learningInsights: [{ insight: '', whyImportant: '', category: '', applicableToApp: false }],
      risks: [{ risk: '', affectedAssets: [], trigger: '', invalidation: '', severity: '', timeframe: '' }],
      allPoints: [{ point: '', category: '' }],
      keyPoints: [],
      tags: [],
    }, null, 2),
    'Transcript chunk:',
    transcriptChunk,
  ].join('\n');
}

function parseIsoDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : text;
}

function relativeTimingKind(value) {
  const text = String(value || '').toLowerCase();
  if (/\btomorrow\b|מחר/.test(text)) return 'tomorrow';
  if (/\btoday\b|היום/.test(text)) return 'today';
  return '';
}

function addUtcDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveEventTimingEvidence(evidence = []) {
  const cleaned = (Array.isArray(evidence) ? evidence : [evidence])
    .map(cleanObject)
    .filter((item) => Object.keys(item).length);
  const relativeKinds = new Set(cleaned.map((item) =>
    relativeTimingKind(item.sourceRelativeText || item.timeframe)
  ).filter(Boolean));
  const sourceRelativeText = [...new Set(cleaned
    .map((item) => cleanScalar(item.sourceRelativeText || item.timeframe))
    .filter((item) => item !== undefined))];

  if (relativeKinds.size > 1 || cleaned.some((item) => item.timingStatus === 'conflicting')) {
    return {
      eventDate: '',
      eventTime: '',
      timezone: '',
      sourceRelativeText,
      timingStatus: 'conflicting',
      displayLabel: 'מועד לא מאומת',
    };
  }

  const absolute = cleaned.find((item) => item.eventDate || item.eventTime);
  if (absolute) {
    const timezone = cleanScalar(absolute.timezone) || '';
    return {
      eventDate: cleanScalar(absolute.eventDate) || '',
      eventTime: cleanScalar(absolute.eventTime) || '',
      timezone,
      sourceRelativeText,
      timingStatus: timezone ? 'verified' : 'unverified',
      displayLabel: timezone ? '' : 'מועד לא מאומת',
    };
  }

  const relativeKind = [...relativeKinds][0];
  if (relativeKind) {
    const source = cleaned.find((item) => relativeTimingKind(item.sourceRelativeText || item.timeframe));
    const sourceDate = parseIsoDate(source?.sourceDate);
    const timezone = cleanScalar(source?.timezone) || '';
    if (sourceDate && timezone) {
      return {
        eventDate: relativeKind === 'tomorrow' ? addUtcDays(sourceDate, 1) : sourceDate,
        eventTime: '',
        timezone,
        sourceRelativeText,
        timingStatus: 'verified',
        displayLabel: '',
      };
    }
    return {
      eventDate: '',
      eventTime: '',
      timezone,
      sourceRelativeText,
      timingStatus: 'unverified',
      displayLabel: 'מועד לא מאומת',
    };
  }

  return {
    eventDate: '',
    eventTime: '',
    timezone: '',
    sourceRelativeText,
    timingStatus: 'missing',
    displayLabel: '',
  };
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
  transcriptSegments = [],
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
      transcriptSegments: (Array.isArray(transcriptSegments) ? transcriptSegments : [])
        .map((segment) => ({
          startSeconds: Number(segment?.startSeconds ?? segment?.start),
          durationSeconds: Number(segment?.durationSeconds ?? segment?.duration),
          text: String(segment?.text || segment?.content || '').trim(),
        }))
        .filter((segment) => Number.isFinite(segment.startSeconds) && segment.startSeconds >= 0 && segment.text && chunk.text.includes(segment.text))
        .map((segment) => ({
          startSeconds: segment.startSeconds,
          ...(Number.isFinite(segment.durationSeconds) && segment.durationSeconds >= 0 ? { durationSeconds: segment.durationSeconds } : {}),
          text: segment.text,
        })),
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
  const finalQuality = evaluateMarketCompleteness(marketBriefData);
  const hasNarrative = Boolean(
    String(marketBriefData.shortSummary || '').trim()
    || String(marketBriefData.fullSummary || '').trim()
    || marketBriefData.chapters?.length,
  );
  if (!finalQuality.useful && !hasNarrative) {
    const error = new Error('Gemini Market Brief response contained no meaningful analysis data');
    error.code = 'INVALID_MARKET_SCHEMA';
    throw error;
  }
  return {
    marketBriefData,
    quality: finalQuality,
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
  buildMarketParserTrace,
  validateMarketBriefPayload,
  buildMarketExtractionPrompt,
  evaluateMarketCompleteness,
  resolveEventTimingEvidence,
  runMarketExtraction,
};
