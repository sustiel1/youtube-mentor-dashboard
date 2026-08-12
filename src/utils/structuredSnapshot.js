// Pure helpers for the "structured-snapshot" Workspace Library item type.
// No imports — kept import-free on purpose so this file (and its tests) run
// under plain `node`, and so the shape stays obviously JSON-safe.

export const STRUCTURED_SNAPSHOT_VERSION = 1;

const UNCLASSIFIED_SNAPSHOT_TOPIC = Object.freeze({
  topicId: null,
  topicName: '',
  category: null,
});

/**
 * Resolves the source video's already-canonical category to an existing
 * top-level Workspace topic. This mirrors the exact category-name matching
 * used by the existing whole-video Workspace save flow. Missing, stale, or
 * nested-only matches stay unclassified; no topic is inferred from content.
 */
export function resolveStructuredSnapshotTopic(video = {}, workspaceTopics = []) {
  const sourceTopicName = String(video?.category || '').trim().toLowerCase();
  if (!sourceTopicName) return { ...UNCLASSIFIED_SNAPSHOT_TOPIC };

  const topic = (Array.isArray(workspaceTopics) ? workspaceTopics : []).find((candidate) => (
    candidate?.id
    && !candidate.parentId
    && String(candidate.name || '').trim().toLowerCase() === sourceTopicName
  ));

  if (!topic) return { ...UNCLASSIFIED_SNAPSHOT_TOPIC };
  return {
    topicId: topic.id,
    topicName: topic.name,
    category: topic.name,
  };
}

export function normalizeStockRow(s = {}) {
  return {
    ticker:        s.ticker || '',
    company:       s.company || '',
    context:       s.context || '',
    sentiment:     s.sentiment || '',
    category:      s.category || '',
    actionability: s.actionability || '',
    notes:         s.notes || '',
  };
}

export function normalizeMarketRow(m = {}) {
  return {
    asset:    m.asset || '',
    trend:    m.trend || '',
    strength: m.strength || '',
    comment:  m.comment || '',
  };
}

export function normalizeSentimentRow(s = {}) {
  return {
    label: s.label || '',
    value: s.value || '',
  };
}

// Builds the immutable snapshot stored on the workspace item. Call this
// exactly once, at save time, with the raw arrays already produced by the
// existing pure extraction functions (extractUnifiedStocks /
// extractMarketDashboardRows / extractSentimentItems) — never re-derive
// later from live video/marketBriefData.
export function buildStructuredSnapshot({ videoId = null, videoTitle = '', savedAt, rawStocks = [], rawMarkets = [], rawSentiment = [] }) {
  return {
    version: STRUCTURED_SNAPSHOT_VERSION,
    savedAt: savedAt || new Date().toISOString(),
    videoId: videoId || null,
    videoTitle: videoTitle || '',
    stocksTable: rawStocks.map(normalizeStockRow),
    marketsTable: rawMarkets.map(normalizeMarketRow),
    sentimentTable: rawSentiment.map(normalizeSentimentRow),
  };
}

// Short human-readable summary — this is what the existing Workspace Library
// search/filter bar actually matches against (it only reads item.notes).
export function buildSnapshotNotes(snapshot) {
  const title = snapshot.videoTitle || 'ללא כותרת';
  const lines = [`תמונת מצב שוק — ${title}`];
  if (snapshot.stocksTable.length) {
    lines.push(`מניות: ${snapshot.stocksTable.map(s => s.ticker).filter(Boolean).join(', ')}`);
  }
  if (snapshot.marketsTable.length) {
    lines.push(`שווקים: ${snapshot.marketsTable.map(m => m.asset).filter(Boolean).join(', ')}`);
  }
  if (snapshot.sentimentTable.length) {
    lines.push(`סנטימנט: ${snapshot.sentimentTable.length} פריטים`);
  }
  return lines.join('\n');
}
