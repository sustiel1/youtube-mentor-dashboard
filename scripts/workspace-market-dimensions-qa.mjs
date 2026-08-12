#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORKSPACE_LIBRARY_COLLECTIONS, createWorkspaceProvenance } from '../src/config/workspaceHeadingRegistry.js';
import { VIRTUAL_TAXONOMY } from '../src/utils/workspaceVirtualTaxonomy.js';
import {
  MARKET_SEMANTIC_FALLBACK,
  MARKET_SEMANTIC_FILTERS,
  buildWorkspaceMarketDimensionPreview,
  countUniqueWorkspaceContents,
  getMarketOrganizationalSubtopics,
  getWorkspaceItemSemanticTags,
  selectWorkspaceCollectionCounts,
  selectWorkspaceDimensionItems,
  selectWorkspaceSemanticFilterCounts,
} from '../src/utils/workspaceMarketDimensions.js';

const market = VIRTUAL_TAXONOMY.find(topic => topic.id === 'vt-markets');
const topics = [
  { id: 'wt-markets', name: 'שוק ההון', parentId: null },
  { id: 'wt-1786386593067-u1zlo', name: 'מבזק בוקר/ערב', parentId: 'wt-markets' },
  { id: 'wt-markets-events', name: 'אירועי השבוע', parentId: 'wt-markets' },
  { id: 'wt-markets-opportunities', name: 'הזדמנויות', parentId: 'wt-markets' },
  { id: 'wt-markets-risks', name: 'סיכונים', parentId: 'wt-markets' },
];

const organizational = getMarketOrganizationalSubtopics(market, topics);
assert.deepEqual(organizational.map(topic => topic.name), ['מבזק בוקר/ערב', 'פונדמנטלי', 'טכני'], 'market subtopic row contains only organizational subtopics');
assert.deepEqual(organizational.map(topic => topic.id), ['cts-wt-1786386593067-u1zlo', 'vts-fundamental', 'vts-technical'], 'stable compatibility IDs are preserved');
assert.equal(organizational[0].migrationRequired, false, 'the repaired brief node needs no migration');
assert.equal(organizational[1].migrationRequired, true, 'legacy fundamental remains a UI adapter pending approval');
assert.equal(organizational[2].migrationRequired, true, 'legacy technical remains a UI adapter pending approval');

assert.deepEqual(MARKET_SEMANTIC_FILTERS.map(filter => filter.label), [
  'מניות', 'סקטורים', 'מאקרו', 'ניהול סיכונים', 'מדדים / ETF', 'קריפטו',
  'סקירת שוק יומית', 'סנטימנט שוק', 'אירועי השבוע', 'הזדמנויות', 'סיכונים',
], 'semantic filters are the approved separate dimension');
assert.equal(new Set(MARKET_SEMANTIC_FILTERS.map(filter => filter.id)).size, MARKET_SEMANTIC_FILTERS.length, 'semantic filter IDs are unique');
assert.equal(MARKET_SEMANTIC_FALLBACK.label, 'ללא סיווג', 'ambiguous semantic content stays reachable');
assert.deepEqual(WORKSPACE_LIBRARY_COLLECTIONS.map(collection => collection.label), [
  'סיכום', 'פרקים', 'תובנות', 'ידע שימושי', 'APP', 'נושאים ותתי־נושאים', 'תוכן ייעודי', 'פריטים נוספים',
], 'collection row comes from the canonical heading registry');

function savedItem(overrides) {
  return {
    id: 'item', sourceVideoId: 'KOom2PCpl6Q', videoTitle: 'סרטון בדיקה', itemType: 'snippet',
    topicId: 'wt-markets', subTopicId: 'wt-1786386593067-u1zlo', sourceTabId: 'insights',
    workspaceCollection: 'insights', sourceSectionId: 'unsectioned', identityPayload: { text: 'תוכן' },
    savedAt: '2026-08-11T00:00:00.000Z', ...overrides,
  };
}

const stockInsight = savedItem({ id: 'stock-insight', sourceSectionId: 'stocks-mentioned', identityPayload: { text: 'NVDA' } });
const stockInsightCopy = { ...stockInsight, id: 'stock-insight-copy', savedAt: '2026-08-11T01:00:00.000Z' };
const riskInsight = savedItem({ id: 'risk-insight', sourceSectionId: 'risks', identityPayload: { text: 'סיכון' } });
const fundamentalSummary = savedItem({ id: 'fundamental-summary', topicId: 'wt-fundamental', subTopicId: null, sourceTabId: 'summary', workspaceCollection: 'summary', sourceSectionId: 'fundamental', identityPayload: { text: 'דוחות' } });
const technicalKnowledge = savedItem({ id: 'technical-knowledge', topicId: 'wt-technical', subTopicId: null, sourceTabId: 'useful-knowledge', workspaceCollection: 'knowledge', sourceSectionId: 'technical', identityPayload: { text: 'רמה' } });
const snapshot = savedItem({
  id: 'snapshot', itemType: 'structured-snapshot', sourceTabId: 'structured-snapshot', workspaceCollection: 'snapshots',
  sourceSectionId: 'structured-snapshot', semanticTags: ['stocks', 'indices-etf', 'market-sentiment'], identityPayload: undefined,
  structuredSnapshot: { videoId: 'KOom2PCpl6Q', stocksTable: [{ ticker: 'NVDA' }], marketsTable: [], sentimentTable: [] },
});
const ambiguous = savedItem({ id: 'ambiguous', topicId: null, subTopicId: null, sourceTabId: null, workspaceCollection: null, sourceSectionId: null, itemType: 'legacy', identityPayload: undefined });
const items = [stockInsight, stockInsightCopy, riskInsight, fundamentalSummary, technicalKnowledge, snapshot, ambiguous];
const before = JSON.stringify(items);

assert.deepEqual(getWorkspaceItemSemanticTags(stockInsight), ['stocks'], 'stable stocks section maps to the stocks filter');
assert.deepEqual(getWorkspaceItemSemanticTags(riskInsight), ['risks'], 'stable risks section maps to risks, not the risk-management subtopic');
assert.deepEqual(getWorkspaceItemSemanticTags(snapshot), ['stocks', 'indices-etf', 'market-sentiment'], 'explicit structured semantic tags remain independent');

const brief = organizational[0];
const combined = selectWorkspaceDimensionItems(items, {
  mainTopic: market,
  subtopic: brief,
  collectionId: 'insights',
  semanticTags: ['stocks'],
  searchText: 'NVDA',
});
assert.deepEqual(combined.map(item => item.id), ['stock-insight', 'stock-insight-copy'], 'topic AND subtopic AND collection AND semantic filter AND search use one selector');
assert.equal(countUniqueWorkspaceContents(combined), 1, 'exact duplicate records count as one logical content');
assert.deepEqual(selectWorkspaceDimensionItems(items, { mainTopic: market, subtopic: brief, collectionId: 'insights' }).map(item => item.id), ['stock-insight', 'stock-insight-copy', 'risk-insight'], 'clearing semantic filters restores the prior topic/subtopic/collection scope');

const semanticCounts = selectWorkspaceSemanticFilterCounts(items);
assert.equal(semanticCounts.stocks, 2, 'semantic counts use unique logical contents');
assert.equal(semanticCounts.risks, 1, 'risk content count matches the matching logical list');
assert.equal(semanticCounts.unclassified, 3, 'content without stable semantic metadata remains reachable');
const collectionCounts = selectWorkspaceCollectionCounts(items, WORKSPACE_LIBRARY_COLLECTIONS.map(collection => collection.id));
assert.deepEqual(collectionCounts.insights, { uniqueCount: 2, recordCount: 3 }, 'collection count distinguishes logical contents from persisted records');
assert.deepEqual(collectionCounts.specialized, { uniqueCount: 1, recordCount: 1 }, 'Snapshot is counted inside Targeted Content without rewriting its persisted type');
assert.equal(collectionCounts.unclassified.recordCount, 1, 'ambiguous legacy records remain in the fallback collection');

const preview = buildWorkspaceMarketDimensionPreview(items);
assert.equal(preview.itemCount, items.length, 'preview covers every persisted record');
assert.equal(preview.confirmedCount + preview.ambiguousCount, items.length, 'preview partitions every record exactly once');
assert.ok(preview.rows.filter(row => row.confidence === 'ambiguous').every(row => row.reason === 'no-stable-semantic-metadata'), 'ambiguous records explain why no semantic mapping is safe');
assert.equal(JSON.stringify(items), before, 'all market dimension selectors are read-only');

const provenance = createWorkspaceProvenance({
  sourceVideoId: 'KOom2PCpl6Q', sourceTabId: 'insights', sourceSectionId: 'stocks-mentioned',
  sourceHeading: 'מניות שהוזכרו', semanticTags: ['stocks', 'stocks'],
});
assert.deepEqual(JSON.parse(JSON.stringify(provenance)).semanticTags, ['stocks'], 'semantic tags survive JSON round-trip without replacing topic ownership');

const librarySource = readFileSync(new URL('../src/pages/WorkspaceLibrary.jsx', import.meta.url), 'utf8');
const semanticSource = readFileSync(new URL('../src/components/workspace/WorkspaceSemanticFilters.jsx', import.meta.url), 'utf8');
const tabRowSource = readFileSync(new URL('../src/components/workspace/WorkspaceTabRow.jsx', import.meta.url), 'utf8');
const collectionTilesSource = readFileSync(new URL('../src/components/workspace/WorkspaceCollectionTiles.jsx', import.meta.url), 'utf8');
const focusedVideoSource = readFileSync(new URL('../src/components/workspace/WorkspaceFocusedVideoCard.jsx', import.meta.url), 'utf8');
assert.match(librarySource, /getMarketOrganizationalSubtopics/, 'Workspace renders the pure organizational-subtopic adapter');
assert.match(collectionTilesSource, /WORKSPACE_COLLECTION_HEADINGS[\s\S]*WORKSPACE_FALLBACK_COLLECTION[\s\S]*@\/config\/workspaceHeadingRegistry/, 'the canonical large collection tiles use the heading registry directly');
assert.match(collectionTilesSource, /<details[\s\S]*WORKSPACE_FALLBACK_COLLECTION/, 'legacy and unmapped records remain in collapsed overflow');
assert.match(librarySource, /WorkspaceSemanticFilters/, 'semantic categories render in a separate control');
assert.match(focusedVideoSource, /<WorkspaceCollectionTiles/, 'the focused viewer reuses the canonical large collection navigation');
assert.match(semanticSource, /aria-pressed=\{active\}/, 'semantic filters expose keyboard-accessible pressed state');
assert.match(tabRowSource, /aria-pressed=\{activeValue === tab\.value\}/, 'topic, subtopic, and collection tabs expose their selected state');
assert.equal((tabRowSource.match(/aria-pressed=\{activeValue === tab\.value\}/g) || []).length, 1, 'the shared tab button declares selected state exactly once');
assert.match(semanticSource, /נקה סינון/, 'semantic filter clearing is visible');

console.log('Workspace market dimensions QA: 38 assertions passed');
