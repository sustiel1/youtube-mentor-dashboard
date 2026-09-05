// Pure helpers for the "structured-snapshot" Workspace Library item type.
// The shared classifier keeps legacy snapshots aligned with current routing.

import {
  MARKET_INSTRUMENT_CLASS,
  classifyMarketInstrument,
  getMarketInstrumentIdentity,
} from '../lib/marketInstrumentClassification.js';

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
    // Existing stored sector value, if the source ever provided one — kept
    // as-is (never overwritten by the static ticker→sector fallback map).
    // See src/lib/stockSectorEnrichment.js's resolveStockSectorDisplay().
    sector:        s.sector || '',
    category:      s.category || '',
    actionability: s.actionability || '',
    notes:         s.notes || '',
    changePercent: s.changePercent || '',
    timeframe:     s.timeframe || '',
    priority:      s.priority || '',
    isNewToWatch:  typeof s.isNewToWatch === 'boolean' ? s.isNewToWatch : null,
    source:         s.source || '',
    sourceVideoId:  s.sourceVideoId || '',
    videoId:        s.videoId || '',
    links:          s.links || null,
    url:            s.url || '',
    tradingViewUrl: s.tradingViewUrl || '',
    investingUrl:   s.investingUrl || '',
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

function mergeText(left, right) {
  return [...new Set([left, right].map((value) => String(value || '').trim()).filter(Boolean))].join(' · ');
}

function mergeRows(previous, incoming, textFields = []) {
  if (!previous) return { ...incoming };
  const merged = { ...previous };
  for (const [key, value] of Object.entries(incoming)) {
    if (textFields.includes(key)) merged[key] = mergeText(previous[key], value);
    else if (merged[key] === '' || merged[key] === null || merged[key] === undefined) merged[key] = value;
  }
  return merged;
}

function marketRowFromStock(row) {
  return normalizeMarketRow({
    asset: row.asset || row.ticker,
    trend: row.trend || row.sentiment,
    strength: row.strength || row.changePercent,
    comment: mergeText(row.comment || row.context, row.notes),
  });
}

function stockRowFromMarket(row) {
  const strength = String(row.changePercent || row.strength || '').trim();
  return normalizeStockRow({
    ...row,
    ticker: row.ticker || row.asset,
    context: row.context || row.comment,
    sentiment: row.sentiment || row.trend,
    changePercent: /[%％]/.test(strength) ? strength : '',
  });
}

/**
 * Read-time compatibility layer for legacy snapshots and incorrectly routed
 * records. It never mutates or rewrites the stored snapshot.
 */
export function normalizeStructuredSnapshotCollections(snapshot = {}) {
  const stockRows = new Map();
  const marketRows = new Map();
  let anonymousStockIndex = 0;
  let anonymousMarketIndex = 0;

  const addStock = (row) => {
    const normalized = normalizeStockRow(row);
    const identity = getMarketInstrumentIdentity(normalized);
    const key = identity || `__stock_${anonymousStockIndex++}`;
    stockRows.set(key, mergeRows(stockRows.get(key), normalized, ['context', 'notes']));
  };
  const addMarket = (row) => {
    const normalized = normalizeMarketRow(row);
    const identity = getMarketInstrumentIdentity(normalized);
    const key = identity || `__market_${anonymousMarketIndex++}`;
    marketRows.set(key, mergeRows(marketRows.get(key), normalized, ['comment']));
  };

  for (const row of Array.isArray(snapshot.stocksTable) ? snapshot.stocksTable : []) {
    if (classifyMarketInstrument(row) === MARKET_INSTRUMENT_CLASS.MARKET) addMarket(marketRowFromStock(row));
    else addStock(row);
  }
  for (const row of Array.isArray(snapshot.marketsTable) ? snapshot.marketsTable : []) {
    if (classifyMarketInstrument(row) === MARKET_INSTRUMENT_CLASS.STOCK) addStock(stockRowFromMarket(row));
    else addMarket(row);
  }

  return {
    ...snapshot,
    stocksTable: [...stockRows.values()],
    marketsTable: [...marketRows.values()],
    sentimentTable: (Array.isArray(snapshot.sentimentTable) ? snapshot.sentimentTable : []).map(normalizeSentimentRow),
  };
}

// Builds the immutable snapshot stored on the workspace item. Call this
// exactly once, at save time, with the raw arrays already produced by the
// existing pure extraction functions (extractUnifiedStocks /
// extractMarketDashboardRows / extractSentimentItems) — never re-derive
// later from live video/marketBriefData.
export function buildStructuredSnapshot({ videoId = null, videoTitle = '', savedAt, rawStocks = [], rawMarkets = [], rawSentiment = [] }) {
  return normalizeStructuredSnapshotCollections({
    version: STRUCTURED_SNAPSHOT_VERSION,
    savedAt: savedAt || new Date().toISOString(),
    videoId: videoId || null,
    videoTitle: videoTitle || '',
    stocksTable: rawStocks,
    marketsTable: rawMarkets,
    sentimentTable: rawSentiment.map(normalizeSentimentRow),
  });
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
