const CORE_ARRAY_FIELDS = Object.freeze([
  'sectorRotation', 'tradingOpportunities', 'stocksMentioned', 'catalysts',
  'macroFactors', 'indices', 'keyLevels', 'watchlistLevels', 'top5Insights',
  'learningInsights', 'risks', 'allPoints', 'chapters', 'keyPoints', 'tags',
]);

const CORE_FIELDS = new Set([
  'contentType', 'shortSummary', 'fullSummary', 'mainLesson', 'marketOverview',
  ...CORE_ARRAY_FIELDS,
]);

const string = (nullable = true) => ({ type: 'STRING', ...(nullable ? { nullable: true } : {}) });
const number = { type: 'NUMBER', nullable: true };
const boolean = { type: 'BOOLEAN', nullable: true };
const strings = { type: 'ARRAY', items: { type: 'STRING' } };
const objects = (properties) => ({ type: 'ARRAY', items: { type: 'OBJECT', properties } });

const MARKET_BRIEF_RESPONSE_SCHEMA = Object.freeze({
  type: 'OBJECT',
  properties: {
    contentType: { type: 'STRING', enum: ['marketBrief'] },
    shortSummary: string(),
    fullSummary: string(),
    mainLesson: string(),
    marketOverview: {
      type: 'OBJECT', nullable: true,
      properties: { summary: string(), generalMood: string() },
    },
    chapters: objects({ title: string(false), startSeconds: number, endSeconds: number, summary: string(), keyPoints: strings }),
    sectorRotation: objects({ sector: string(), direction: string(), reason: string(), etf: string(), timeframe: string(), importance: string() }),
    tradingOpportunities: objects({ ticker: string(), setup: string(), reason: string(), entry: number, stop: number, target: number, rrRatio: string(), timeframe: string(), confidence: string(), catalyst: string(), invalidation: string() }),
    stocksMentioned: objects({ ticker: string(), nameHebrew: string(), sentiment: string(), reason: string(), priceLevel: number, change: string(), action: string(), catalyst: string(), timeframe: string(), priority: string(), isNewToWatch: boolean, sector: string() }),
    catalysts: objects({ type: string(), description: string(), impact: string(), affectedStocks: strings, timeframe: string(), expectedScenario: string(), risk: string() }),
    macroFactors: objects({ factor: string(), status: string(), impact: string(), note: string(), category: string() }),
    indices: objects({ asset: string(), level: number, change: string(), direction: string(), note: string() }),
    keyLevels: objects({ asset: string(), level: number, type: string(), note: string(), timeframe: string() }),
    watchlistLevels: objects({ ticker: string(), level: number, type: string(), condition: string(), importance: string(), action: string(), note: string(), timeframe: string() }),
    top5Insights: objects({ rank: number, asset: string(), level: number, note: string(), action: string(), significance: string(), category: string() }),
    learningInsights: objects({ insight: string(), whyImportant: string(), category: string(), applicableToApp: boolean }),
    risks: objects({ risk: string(), affectedAssets: strings, trigger: string(), invalidation: string(), severity: string(), timeframe: string() }),
    allPoints: objects({ point: string(), category: string() }),
    keyPoints: strings,
    tags: strings,
  },
  required: ['contentType'],
});

function compactHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function parserPosition(message) {
  const match = String(message || '').match(/position\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function sanitizedParserMetadata(raw, parserInput, message) {
  const position = parserPosition(message);
  return {
    responseLength: String(raw || '').length,
    parserInputLength: String(parserInput || '').length,
    rawHash: compactHash(raw),
    parserInputHash: compactHash(parserInput),
    relation: String(raw || '') === String(parserInput || '') ? 'identical' : 'changed-before-parse',
    position,
  };
}

function looksTruncated(value) {
  const text = String(value || '');
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
    else if (stack.at(-1) === char) stack.pop();
  }
  return inString || stack.length > 0;
}

function meaningful(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value === 0 || value === false;
}

function validateCoreMarketBriefPayload(payload, { allowEmpty = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw Object.assign(new Error('Provider market response must be a JSON object'), { code: 'INVALID_MARKET_SCHEMA' });
  }
  if (payload.contentType != null && !['marketBrief', 'market'].includes(payload.contentType)) {
    throw Object.assign(new Error('Provider response contentType is not Market Brief'), { code: 'INVALID_MARKET_SCHEMA' });
  }
  for (const field of CORE_ARRAY_FIELDS) {
    if (payload[field] != null && !Array.isArray(payload[field])) {
      throw Object.assign(new Error(`Market Brief field ${field} must be an array`), { code: 'INVALID_MARKET_SCHEMA', field });
    }
  }
  if (payload.marketOverview != null && (typeof payload.marketOverview !== 'object' || Array.isArray(payload.marketOverview))) {
    throw Object.assign(new Error('Market Brief marketOverview must be an object'), { code: 'INVALID_MARKET_SCHEMA', field: 'marketOverview' });
  }
  const recognized = Object.keys(payload).filter((key) => CORE_FIELDS.has(key) && key !== 'contentType');
  if (!recognized.length || (!allowEmpty && !recognized.some((key) => meaningful(payload[key])))) {
    throw Object.assign(new Error('Provider market response has no recognized Market Brief content'), { code: 'INVALID_MARKET_SCHEMA' });
  }
  return payload;
}

function parseCoreMarketBriefResponse(raw, { allowEmpty = false } = {}) {
  if (raw && typeof raw === 'object') return validateCoreMarketBriefPayload(raw, { allowEmpty });
  const parserInput = String(raw || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  if (!parserInput) {
    throw Object.assign(new Error('Provider returned an empty market response'), { code: 'EMPTY_PROVIDER_RESPONSE', raw: parserInput });
  }
  try {
    return validateCoreMarketBriefPayload(JSON.parse(parserInput), { allowEmpty });
  } catch (cause) {
    if (cause?.code === 'INVALID_MARKET_SCHEMA') throw cause;
    const code = looksTruncated(parserInput) ? 'TRUNCATED_MARKET_JSON' : 'MALFORMED_MARKET_JSON';
    const error = Object.assign(new Error('Provider returned invalid market JSON'), {
      code,
      cause,
      raw: parserInput,
      diagnostics: sanitizedParserMetadata(raw, parserInput, cause?.message),
    });
    throw error;
  }
}

module.exports = {
  CORE_ARRAY_FIELDS,
  MARKET_BRIEF_RESPONSE_SCHEMA,
  parseCoreMarketBriefResponse,
  validateCoreMarketBriefPayload,
};
