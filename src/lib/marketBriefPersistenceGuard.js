const CONTENT_FIELDS = Object.freeze([
  'shortSummary', 'fullSummary', 'mainLesson', 'chapters', 'marketOverview',
  'sectorRotation', 'tradingOpportunities', 'stocksMentioned', 'catalysts',
  'macroFactors', 'indices', 'keyLevels', 'watchlistLevels', 'top5Insights',
  'learningInsights', 'risks', 'allPoints', 'keyPoints', 'tags',
  'universalTabs', 'rawData',
]);

const PRESERVED_FIELDS = Object.freeze([
  ...CONTENT_FIELDS,
  'manualOverrides', 'transcriptSegments', 'storedTranscriptSegments',
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

export function normalizePersistableMarketBrief(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (!payload.contentType && CONTENT_FIELDS.some((field) => isMeaningful(payload[field]))) {
    return { ...payload, contentType: 'marketBrief' };
  }
  return payload;
}

function preserveRicherFields(previous, candidate) {
  if (!previous || typeof previous !== 'object') return candidate;
  const previousScore = CONTENT_FIELDS.filter((field) => isMeaningful(previous[field])).length;
  const candidateScore = CONTENT_FIELDS.filter((field) => isMeaningful(candidate[field])).length;
  const fields = candidateScore < previousScore
    ? PRESERVED_FIELDS
    : ['manualOverrides', 'transcriptSegments', 'storedTranscriptSegments'];
  if (!fields.some((field) => !isMeaningful(candidate[field]) && isMeaningful(previous[field]))) return candidate;
  const merged = { ...candidate };
  for (const field of fields) {
    if (!isMeaningful(merged[field]) && isMeaningful(previous[field])) merged[field] = previous[field];
  }
  return merged;
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
  const normalizedPrevious = normalizePersistableMarketBrief(previous);
  const normalizedCandidate = normalizePersistableMarketBrief(candidate);
  const validation = validatePersistableMarketBrief(normalizedCandidate);
  if (!validation.valid) {
    return {
      accepted: false,
      reason: validation.reason,
      data: previous,
      previousDataPreserved: previous != null,
      diagnostic: { code: validation.reason, previousDataPreserved: previous != null },
    };
  }
  const data = preserveRicherFields(normalizedPrevious, normalizedCandidate);
  return {
    accepted: true,
    reason: null,
    data,
    previousDataPreserved: false,
    diagnostic: { code: 'ACCEPTED', previousDataPreserved: false },
  };
}

export function persistGuardedMarketBrief({
  previous = null,
  candidate,
  videoId = null,
  writeLocal = null,
  writeVideo = null,
} = {}) {
  const resolved = resolveMarketBriefPersistence({ previous, candidate });
  if (!resolved.accepted) return { ...resolved, wroteLocal: false, wroteVideo: false };

  let wroteLocal = false;
  let wroteVideo = false;
  try {
    if (videoId && typeof writeLocal === 'function') {
      writeLocal(`market_brief_${videoId}`, resolved.data);
      wroteLocal = true;
    }
    if (typeof writeVideo === 'function') {
      writeVideo(resolved.data);
      wroteVideo = true;
    }
  } catch {
    return {
      accepted: false,
      reason: 'PERSISTENCE_WRITE_FAILED',
      data: previous,
      previousDataPreserved: previous != null,
      wroteLocal,
      wroteVideo,
      diagnostic: { code: 'PERSISTENCE_WRITE_FAILED', previousDataPreserved: previous != null },
    };
  }
  return { ...resolved, wroteLocal, wroteVideo };
}

export const MARKET_BRIEF_PERSISTENCE_CONTENT_FIELDS = CONTENT_FIELDS;
