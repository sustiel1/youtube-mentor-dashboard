export const MARKET_BRIEF_SOURCE_META_KEY = '__marketBriefSource';

function parseReliableTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getMarketBriefCandidateTimestamp(candidate) {
  const data = candidate?.data;
  const values = [
    candidate?.explicitTimestamp,
    data?.[MARKET_BRIEF_SOURCE_META_KEY]?.savedAt,
    data?.marketBriefSavedAt,
    data?.marketBriefUpdatedAt,
  ];

  for (const value of values) {
    const timestamp = parseReliableTimestamp(value);
    if (timestamp != null) return timestamp;
  }
  return null;
}

export function stampMarketBriefSource(data, { source = 'paste-video', savedAt } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const normalizedSavedAt = typeof savedAt === 'string' && parseReliableTimestamp(savedAt) != null
    ? savedAt
    : new Date().toISOString();

  return {
    ...data,
    [MARKET_BRIEF_SOURCE_META_KEY]: {
      source,
      savedAt: normalizedSavedAt,
    },
  };
}

export function selectNewestMarketBriefCandidate(candidates) {
  const valid = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate?.data && typeof candidate.data === 'object')
    .map((candidate, index) => ({
      ...candidate,
      fallbackOrder: Number.isFinite(candidate.fallbackOrder) ? candidate.fallbackOrder : index,
      resolvedTimestamp: getMarketBriefCandidateTimestamp(candidate),
    }));

  if (!valid.length) return null;

  valid.sort((left, right) => {
    const leftTimestamped = left.resolvedTimestamp != null;
    const rightTimestamped = right.resolvedTimestamp != null;
    if (leftTimestamped !== rightTimestamped) return leftTimestamped ? -1 : 1;
    if (leftTimestamped && left.resolvedTimestamp !== right.resolvedTimestamp) {
      return right.resolvedTimestamp - left.resolvedTimestamp;
    }
    return left.fallbackOrder - right.fallbackOrder;
  });

  return valid[0];
}
