const CONTENT_FIELDS = Object.freeze([
  'shortSummary', 'fullSummary', 'mainLesson', 'chapters', 'marketOverview',
  'sectorRotation', 'tradingOpportunities', 'stocksMentioned', 'catalysts',
  'macroFactors', 'macro', 'macroEvents', 'macroHighlights',
  'indices', 'keyLevels', 'watchlistLevels', 'top5Insights',
  'learningInsights', 'risks', 'sentiment', 'allPoints', 'keyPoints', 'tags',
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
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'boolean';
}

function getPayloadRichness(payload) {
  if (!payload || typeof payload !== 'object') return -1;
  const contentFields = CONTENT_FIELDS.filter((field) => isMeaningful(payload[field])).length;
  const manualSections = payload.manualOverrides && typeof payload.manualOverrides === 'object'
    ? Object.keys(payload.manualOverrides).length
    : 0;
  const transcriptSegments = Array.isArray(payload.transcriptSegments)
    ? payload.transcriptSegments.length
    : 0;
  return (contentFields * 1000) + (manualSections * 10) + Math.min(transcriptSegments, 9);
}

function getOverrideTimestamp(value) {
  const timestamp = Date.parse(value?.updatedAt || '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

function mergeManualOverrides(primary, secondary) {
  const primaryOverrides = primary?.manualOverrides;
  const secondaryOverrides = secondary?.manualOverrides;
  if (!primaryOverrides || typeof primaryOverrides !== 'object') return secondaryOverrides;
  if (!secondaryOverrides || typeof secondaryOverrides !== 'object') return primaryOverrides;

  const merged = { ...secondaryOverrides, ...primaryOverrides };
  for (const key of new Set([...Object.keys(secondaryOverrides), ...Object.keys(primaryOverrides)])) {
    const primaryValue = primaryOverrides[key];
    const secondaryValue = secondaryOverrides[key];
    if (!primaryValue) merged[key] = secondaryValue;
    else if (!secondaryValue) merged[key] = primaryValue;
    else {
      const primaryTime = getOverrideTimestamp(primaryValue);
      const secondaryTime = getOverrideTimestamp(secondaryValue);
      merged[key] = secondaryTime != null && (primaryTime == null || secondaryTime > primaryTime)
        ? secondaryValue
        : primaryValue;
    }
  }
  return merged;
}

function mergeMissingHydrationFields(primary, secondary) {
  const merged = { ...primary };
  for (const field of PRESERVED_FIELDS) {
    if (!isMeaningful(merged[field]) && isMeaningful(secondary?.[field])) {
      merged[field] = secondary[field];
    }
  }
  const manualOverrides = mergeManualOverrides(primary, secondary);
  if (manualOverrides && Object.keys(manualOverrides).length > 0) {
    merged.manualOverrides = manualOverrides;
  }
  return merged;
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

export function resolveMarketBriefHydration({ localCandidates = [], videoData = null } = {}) {
  const entries = [
    ...(Array.isArray(localCandidates) ? localCandidates : []),
    { source: 'video.marketBriefData', data: videoData },
  ];
  const valid = [];
  const rejectedSources = [];

  for (const entry of entries) {
    const normalized = normalizePersistableMarketBrief(entry?.data);
    const validation = validatePersistableMarketBrief(normalized);
    if (!validation.valid) {
      if (entry?.data != null) rejectedSources.push({
        source: String(entry?.source || 'unknown'),
        reason: validation.reason,
      });
      continue;
    }
    valid.push({
      source: String(entry?.source || 'unknown'),
      data: normalized,
      richness: getPayloadRichness(normalized),
    });
  }

  if (valid.length === 0) {
    return {
      data: null,
      source: null,
      reconciled: false,
      diagnostic: { code: 'NO_VALID_MARKET_BRIEF', rejectedSources },
    };
  }

  const ranked = valid
    .map((entry, index) => ({ ...entry, index }))
    .sort((left, right) => (right.richness - left.richness) || (left.index - right.index));
  const primary = ranked[0];
  const data = ranked.slice(1).reduce(
    (merged, entry) => mergeMissingHydrationFields(merged, entry.data),
    primary.data,
  );

  return {
    data,
    source: primary.source,
    reconciled: ranked.length > 1,
    diagnostic: {
      code: ranked.length > 1 ? 'RECONCILED' : 'SELECTED',
      validSources: ranked.map((entry) => entry.source),
      rejectedSources,
    },
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
  if (!videoId) {
    return {
      accepted: false,
      reason: 'MISSING_VIDEO_ID',
      data: previous,
      previousDataPreserved: previous != null,
      wroteLocal: false,
      wroteVideo: false,
      partialWrite: false,
      consistent: true,
      diagnostic: { code: 'MISSING_VIDEO_ID', previousDataPreserved: previous != null },
    };
  }
  if (typeof writeLocal !== 'function' || typeof writeVideo !== 'function') {
    return {
      accepted: false,
      reason: 'PERSISTENCE_WRITER_MISSING',
      data: previous,
      previousDataPreserved: previous != null,
      wroteLocal: false,
      wroteVideo: false,
      partialWrite: false,
      consistent: true,
      diagnostic: { code: 'PERSISTENCE_WRITER_MISSING', previousDataPreserved: previous != null },
    };
  }

  let wroteLocal = false;
  let wroteVideo = false;
  try {
    const localResult = writeLocal(`market_brief_${videoId}`, resolved.data);
    if (localResult === false || localResult === null) throw new Error('LOCAL_WRITE_REJECTED');
    wroteLocal = true;
    const videoResult = writeVideo(resolved.data);
    if (videoResult === false || videoResult === null) throw new Error('VIDEO_WRITE_REJECTED');
    wroteVideo = true;
  } catch {
    const partialWrite = wroteLocal !== wroteVideo;
    return {
      accepted: false,
      reason: partialWrite ? 'PARTIAL_PERSISTENCE' : 'PERSISTENCE_WRITE_FAILED',
      data: previous,
      recoveryData: partialWrite ? resolved.data : null,
      previousDataPreserved: previous != null && !partialWrite,
      wroteLocal,
      wroteVideo,
      partialWrite,
      consistent: !partialWrite,
      diagnostic: {
        code: partialWrite ? 'PARTIAL_PERSISTENCE' : 'PERSISTENCE_WRITE_FAILED',
        previousDataPreserved: previous != null && !partialWrite,
      },
    };
  }
  return { ...resolved, wroteLocal, wroteVideo, partialWrite: false, consistent: true };
}

export const MARKET_BRIEF_PERSISTENCE_CONTENT_FIELDS = CONTENT_FIELDS;
