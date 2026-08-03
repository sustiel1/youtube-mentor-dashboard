const CONTENT_FIELDS = Object.freeze([
  'shortSummary', 'fullSummary', 'mainLesson', 'chapters', 'marketOverview',
  'sectorRotation', 'tradingOpportunities', 'stocksMentioned', 'catalysts',
  'macroFactors', 'indices', 'keyLevels', 'watchlistLevels', 'top5Insights',
  'learningInsights', 'risks', 'allPoints', 'keyPoints', 'tags',
]);

function isMeaningful(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value === 0 || value === false;
}

export function validatePersistableMarketBrief(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, reason: 'INVALID_OBJECT' };
  }
  if (!['marketBrief', 'market'].includes(payload.contentType)) {
    return { valid: false, reason: 'INVALID_CONTENT_TYPE' };
  }
  if (payload.extractionMeta?.partial === true) {
    return { valid: false, reason: 'PARTIAL_ANALYSIS' };
  }
  if (payload.chapters != null && !Array.isArray(payload.chapters)) {
    return { valid: false, reason: 'INVALID_CHAPTERS' };
  }
  if (!CONTENT_FIELDS.some((field) => isMeaningful(payload[field]))) {
    return { valid: false, reason: 'EMPTY_ANALYSIS' };
  }
  return { valid: true, reason: null };
}

export function assertPersistableMarketBrief(payload) {
  const validation = validatePersistableMarketBrief(payload);
  if (!validation.valid) {
    throw Object.assign(new Error(`Market Brief persistence rejected: ${validation.reason}`), {
      code: validation.reason,
    });
  }
  return payload;
}

export function resolveMarketBriefPersistence({ previous = null, candidate } = {}) {
  const validation = validatePersistableMarketBrief(candidate);
  if (!validation.valid) {
    return {
      accepted: false,
      reason: validation.reason,
      data: previous,
      previousDataPreserved: previous != null,
    };
  }
  return {
    accepted: true,
    reason: null,
    data: candidate,
    previousDataPreserved: false,
  };
}

export const MARKET_BRIEF_PERSISTENCE_CONTENT_FIELDS = CONTENT_FIELDS;
