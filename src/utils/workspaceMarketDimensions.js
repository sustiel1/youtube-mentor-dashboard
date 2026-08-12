import { getWorkspaceNavigationCollectionForItem } from '../config/workspaceHeadingRegistry.js';
import { getWorkspaceItemIdentity } from './workspaceItemIdentity.js';
import { CANONICAL_MORNING_EVENING_BRIEF_SUBTOPIC_NAME } from './workspaceBriefRouting.js';

export const MARKET_VIRTUAL_TOPIC_ID = 'vt-markets';

const ORGANIZATIONAL_VIRTUAL_IDS = ['vts-fundamental', 'vts-technical'];

export const MARKET_SEMANTIC_FILTERS = Object.freeze([
  { id: 'stocks', label: 'מניות', virtualSubtopicId: 'vts-stocks', topicIds: ['wt-stocks', 'wt-stocks-quick', 'wt-stocks-watchlist', 'wt-stocks-chips', 'wt-stocks-ai', 'wt-stocks-energy', 'wt-stocks-banks', 'wt-stocks-realestate', 'wt-stocks-earnings', 'wt-markets-stocks', 'wt-markets-mentioned'], sourceIds: ['stocks-mentioned'], itemTypes: ['stock'] },
  { id: 'sectors', label: 'סקטורים', virtualSubtopicId: 'vts-sectors', topicIds: ['wt-sectors', 'wt-sectors-tech', 'wt-sectors-energy', 'wt-sectors-financials', 'wt-sectors-health', 'wt-sectors-realestate', 'wt-sectors-consumer', 'wt-sectors-industrial', 'wt-markets-sectors'], sourceIds: ['sectors', 'brief-sectors'] },
  { id: 'macro', label: 'מאקרו', virtualSubtopicId: 'vts-macro', topicIds: ['wt-macro', 'wt-macro-rates', 'wt-macro-inflation', 'wt-macro-bonds', 'wt-macro-dollar', 'wt-macro-jobs', 'wt-macro-events', 'wt-markets-macro'], sourceIds: ['macro', 'brief-macro'] },
  { id: 'risk-management', label: 'ניהול סיכונים', virtualSubtopicId: 'vts-risk', topicIds: ['wt-risk', 'wt-risk-sizing', 'wt-risk-stoploss', 'wt-risk-diversification', 'wt-risk-drawdown', 'wt-risk-hedging', 'wt-risk-scenarios', 'wt-markets-risk'], sourceIds: ['risk-management'] },
  { id: 'indices-etf', label: 'מדדים / ETF', virtualSubtopicId: 'vts-etf', topicIds: ['wt-markets-etf'], sourceIds: ['indices', 'etf', 'markets'] },
  { id: 'crypto', label: 'קריפטו', virtualSubtopicId: 'vts-crypto', topicIds: ['wt-crypto', 'wt-crypto-btc', 'wt-crypto-eth', 'wt-crypto-alts', 'wt-crypto-defi', 'wt-crypto-macro', 'wt-markets-crypto'], sourceIds: ['crypto'] },
  { id: 'daily-review', label: 'סקירת שוק יומית', virtualSubtopicId: 'vts-daily', topicIds: ['wt-markets-daily'], sourceIds: ['daily-review', 'market-review'] },
  { id: 'market-sentiment', label: 'סנטימנט שוק', virtualSubtopicId: 'vts-sentiment', topicIds: ['wt-markets-sentiment'], sourceIds: ['sentiment', 'brief-sentiment'] },
  { id: 'weekly-events', label: 'אירועי השבוע', canonicalTopicId: 'wt-markets-events', topicIds: ['wt-markets-events'], sourceIds: ['economic-calendar', 'brief-calendar', 'weekly-events'] },
  { id: 'opportunities', label: 'הזדמנויות', canonicalTopicId: 'wt-markets-opportunities', topicIds: ['wt-markets-opportunities'], sourceIds: ['opportunities', 'brief-opportunities'] },
  { id: 'risks', label: 'סיכונים', canonicalTopicId: 'wt-markets-risks', topicIds: ['wt-markets-risks'], sourceIds: ['risks', 'brief-risks'] },
].map(definition => Object.freeze(definition)));

export const MARKET_SEMANTIC_FALLBACK = Object.freeze({ id: 'unclassified', label: 'ללא סיווג' });

const SEMANTIC_BY_ID = new Map(MARKET_SEMANTIC_FILTERS.map(definition => [definition.id, definition]));
const SEMANTIC_BY_SOURCE_ID = new Map(MARKET_SEMANTIC_FILTERS.flatMap(definition => (
  definition.sourceIds.map(sourceId => [sourceId, definition.id])
)));
const SEMANTIC_BY_ITEM_TYPE = new Map(MARKET_SEMANTIC_FILTERS.flatMap(definition => (
  (definition.itemTypes || []).map(itemType => [itemType, definition.id])
)));

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

function itemTopicIds(item = {}) {
  return [item.topicId, item.subTopicId, item.subtopicId].map(clean).filter(Boolean);
}

export function getMarketOrganizationalSubtopics(marketVirtualTopic, topics = []) {
  if (!marketVirtualTopic || marketVirtualTopic.id !== MARKET_VIRTUAL_TOPIC_ID) return [];
  const canonicalBriefMatches = topics.filter(topic => (
    String(topic?.name || '').trim().replace(/\s+/g, ' ') === CANONICAL_MORNING_EVENING_BRIEF_SUBTOPIC_NAME
    && topic?.parentId === 'wt-markets'
  ));
  const canonicalBrief = canonicalBriefMatches.length === 1 ? canonicalBriefMatches[0] : null;
  const virtualById = new Map((marketVirtualTopic.subtopics || []).map(subtopic => [subtopic.id, subtopic]));
  return [
    ...(canonicalBrief ? [{
      id: `cts-${canonicalBrief.id}`,
      name: canonicalBrief.name,
      realTopicIds: [canonicalBrief.id],
      canonicalTopicId: canonicalBrief.id,
      isCanonical: true,
      migrationRequired: false,
    }] : []),
    ...ORGANIZATIONAL_VIRTUAL_IDS.flatMap(id => {
      const subtopic = virtualById.get(id);
      return subtopic ? [{ ...subtopic, isCompatibilityAdapter: true, migrationRequired: true }] : [];
    }),
  ];
}

export function getWorkspaceItemSemanticTags(item = {}) {
  const result = new Set();
  const explicit = [
    ...(Array.isArray(item.semanticTags) ? item.semanticTags : []),
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].map(clean);
  explicit.forEach(tag => { if (SEMANTIC_BY_ID.has(tag)) result.add(tag); });

  const structuredSources = [
    item.sourceSectionId,
    item.sourceTabId,
    item.sourceTab,
    item.savedSectionType,
    item.sectionType,
    item.originalItemType,
  ].map(clean).filter(Boolean);
  structuredSources.forEach(sourceId => {
    const tag = SEMANTIC_BY_SOURCE_ID.get(sourceId);
    if (tag) result.add(tag);
  });

  const itemTypeTag = SEMANTIC_BY_ITEM_TYPE.get(clean(item.itemType));
  if (itemTypeTag) result.add(itemTypeTag);

  const topicIds = itemTopicIds(item);
  for (const definition of MARKET_SEMANTIC_FILTERS) {
    if (definition.topicIds.some(topicId => topicIds.includes(topicId))) result.add(definition.id);
  }
  return [...result];
}

export function normalizeWorkspaceSemanticTags(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(value => SEMANTIC_BY_ID.has(value)))];
}

function logicalContentKey(item) {
  return getWorkspaceItemIdentity(item)?.key || `record:${String(item?.id || '')}`;
}

export function countUniqueWorkspaceContents(items = []) {
  return new Set((Array.isArray(items) ? items : []).filter(Boolean).map(logicalContentKey)).size;
}

export function filterWorkspaceItemsBySemanticTags(items = [], selectedTags = []) {
  const selected = normalizeWorkspaceSemanticTags(selectedTags);
  const includeUnclassified = (Array.isArray(selectedTags) ? selectedTags : []).map(clean).includes(MARKET_SEMANTIC_FALLBACK.id);
  if (selected.length === 0 && !includeUnclassified) return [...items];
  return items.filter(item => {
    const tags = getWorkspaceItemSemanticTags(item);
    return (includeUnclassified && tags.length === 0) || selected.some(tag => tags.includes(tag));
  });
}

function itemMatchesNavigationNode(item, node) {
  if (!node) return true;
  const topicIds = new Set(node.realTopicIds || []);
  const legacyNames = new Set(node.legacyNames || []);
  return topicIds.has(item?.topicId)
    || topicIds.has(item?.subTopicId)
    || topicIds.has(item?.subtopicId)
    || legacyNames.has(item?.topicName);
}

function itemSearchText(item = {}) {
  const snapshot = item.itemType === 'structured-snapshot' ? item.structuredSnapshot : null;
  return [
    item.videoTitle, item.sourceVideoTitle, item.title, item.savedTitle, item.notes, item.fullNotes,
    item.rawSourceText, item.symbol, item.ticker, item.asset, item.companyName, item.channelName,
    item.source, item.sourceTab, ...(Array.isArray(item.tags) ? item.tags : []),
    item.identityPayload ? JSON.stringify(item.identityPayload) : '',
    snapshot ? JSON.stringify(snapshot) : '',
  ].filter(Boolean).join(' ').toLocaleLowerCase('he');
}

export function selectWorkspaceDimensionItems(items = [], {
  mainTopic = null,
  subtopic = null,
  collectionId = null,
  semanticTags = [],
  searchText = '',
} = {}) {
  const needle = String(searchText || '').trim().toLocaleLowerCase('he');
  let result = (Array.isArray(items) ? items : []).filter(item => (
    itemMatchesNavigationNode(item, mainTopic)
    && itemMatchesNavigationNode(item, subtopic)
    && (!collectionId || getWorkspaceNavigationCollectionForItem(item, 'unclassified') === collectionId)
    && (!needle || itemSearchText(item).includes(needle))
  ));
  result = filterWorkspaceItemsBySemanticTags(result, semanticTags);
  return result;
}

export function selectWorkspaceSemanticFilterCounts(items = []) {
  const counts = Object.fromEntries(MARKET_SEMANTIC_FILTERS.map(definition => [
    definition.id,
    countUniqueWorkspaceContents(items.filter(item => getWorkspaceItemSemanticTags(item).includes(definition.id))),
  ]));
  counts[MARKET_SEMANTIC_FALLBACK.id] = countUniqueWorkspaceContents(
    items.filter(item => getWorkspaceItemSemanticTags(item).length === 0),
  );
  return counts;
}

export function selectWorkspaceCollectionCounts(items = [], collectionIds = []) {
  return Object.fromEntries(collectionIds.map(collectionId => {
    const records = items.filter(item => getWorkspaceNavigationCollectionForItem(item, 'unclassified') === collectionId);
    return [collectionId, { uniqueCount: countUniqueWorkspaceContents(records), recordCount: records.length }];
  }));
}

export function buildWorkspaceMarketDimensionPreview(items = []) {
  const rows = items.map(item => {
    const semanticTags = getWorkspaceItemSemanticTags(item);
    return {
      itemId: item?.id || null,
      workspaceCollection: getWorkspaceNavigationCollectionForItem(item, 'unclassified'),
      semanticTags,
      confidence: semanticTags.length > 0 ? 'confirmed' : 'ambiguous',
      reason: semanticTags.length > 0 ? null : 'no-stable-semantic-metadata',
    };
  });
  return {
    rows,
    itemCount: rows.length,
    confirmedCount: rows.filter(row => row.confidence === 'confirmed').length,
    ambiguousCount: rows.filter(row => row.confidence === 'ambiguous').length,
    sourceUnchanged: true,
  };
}
