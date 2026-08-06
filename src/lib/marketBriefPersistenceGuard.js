const MARKET_BRIEF_CONTENT_FIELDS = [
  'shortSummary', 'fullSummary', 'mainLesson', 'chapters', 'marketOverview',
  'sectorRotation', 'tradingOpportunities', 'stocksMentioned', 'catalysts',
  'macroFactors', 'indices', 'keyLevels', 'watchlistLevels', 'top5Insights',
  'learningInsights', 'risks', 'allPoints', 'keyPoints', 'tags', 'universalTabs',
  'rawData', 'economicCalendar', 'sentiment',
];

function isMeaningful(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value === 0 || value === false;
}

export function assertPersistableMarketBrief(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Market Brief חייב להיות אובייקט JSON');
  }
  if (!['marketBrief', 'market'].includes(payload.contentType)) {
    throw new Error('contentType אינו Market Brief');
  }
  if (!MARKET_BRIEF_CONTENT_FIELDS.some((field) => isMeaningful(payload[field]))) {
    throw new Error('Market Brief אינו מכיל תוכן מובנה שניתן לשמור');
  }
  if (payload.chapters != null && !Array.isArray(payload.chapters)) {
    throw new Error('chapters חייב להיות מערך');
  }
  if (payload.universalTabs != null && (typeof payload.universalTabs !== 'object' || Array.isArray(payload.universalTabs))) {
    throw new Error('universalTabs חייב להיות אובייקט');
  }
  return payload;
}
