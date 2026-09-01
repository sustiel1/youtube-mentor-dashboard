import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const countCheckboxes = (markup) => (markup.match(/type="checkbox"/g) || []).length;
const countChecked = (markup) => (markup.match(/checked=""/g) || []).length;
const encodeHtmlText = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const news = [
  {
    title: 'מורגן סטנלי מעלה יעד ל-S&P 500',
    description: 'הבנק צופה המשך עליות במדד בחודשים הקרובים.',
    sentiment: 'positive',
    impact: 'תמיכה בנכסי סיכון',
    symbols: ['SPY'],
    links: [{ url: 'https://example.com/morgan', label: 'Morgan Stanley' }],
    source: 'Reuters',
    sourceUrl: 'https://example.com/morgan',
    publishedAt: '2026-08-31T06:00:00Z',
  },
  {
    headline: 'INTC מגייסת 15 מיליארד דולר',
    summary: 'החברה מבצעת גיוס הון כדי להרחיב את הייצור.',
    sentiment: 'negative',
    impact: 'דילול לבעלי המניות',
    tickers: ['INTC'],
    articleUrl: 'https://example.com/intc',
    publisher: 'Example Wire',
  },
  {
    title: 'ברקשייר חוזרת לרכישות נטו',
    description: 'החברה חזרה לרכוש מניות והשקיעה בגוגל.',
    sentiment: 'neutral',
    impact: 'איתות אמון סלקטיבי',
    relatedTickers: ['GOOGL'],
    url: 'https://example.com/brk',
    author: 'Market Desk',
  },
  {
    title: 'חדשות מורחבות על שוק האגח',
    description: 'הפריט הרביעי מוסתר עד לחיצה על הצג עוד חדשות.',
    sentiment: 'positive',
    impact: 'ירידת תשואות תומכת במניות צמיחה',
    assets: ['TLT', 'QQQ'],
    sourceLinks: ['https://example.com/bonds'],
    sourceName: 'Global Markets',
  },
];

const marketBriefData = {
  contentType: 'marketBrief',
  rawData: { marketNews: news },
  universalTabs: { specialized: { marketNews: [] } },
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

try {
  const { extractVideoTabItems } = await server.ssrLoadModule('/src/config/videoTabsConfig.js');
  const {
    buildMorningBriefBulkSections,
    resolveMorningBriefBulkId,
    resolveMorningBriefSectionChildItems,
  } = await server.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const { normalizeNewsItems } = await server.ssrLoadModule('/src/lib/morningBriefNewsNormalize.js');
  const { buildBulkItemsFromSections } = await server.ssrLoadModule('/src/lib/universalTabBulkItems.js');
  const { buildWorkspaceSelectionDraft } = await server.ssrLoadModule('/src/lib/workspaceSelectionDraft.js');
  const { buildWorkspaceNewsFields } = await server.ssrLoadModule('/src/lib/newsSelectionMetadata.js');
  const { getWorkspaceItems, saveWorkspaceItem } = await server.ssrLoadModule('/src/lib/workspaceLibraryStore.js');
  const {
    MorningBriefNewsCard,
    MorningBriefNewsSection,
  } = await server.ssrLoadModule('/src/components/dashboard/MorningBriefNewsSection.jsx');
  const { WorkspaceSavedAnalysisContent } = await server.ssrLoadModule(
    '/src/components/workspace/WorkspaceFocusedVideoCard.jsx',
  );

  const extracted = extractVideoTabItems({}, 'market-news', marketBriefData);
  const normalized = normalizeNewsItems(extracted);
  const bulkSections = buildMorningBriefBulkSections({}, marketBriefData);
  const newsSection = bulkSections.find((section) => section.key === 'news');

  assert.equal(normalized.length, 4, 'all four distinct news rows remain available');
  assert.equal(newsSection?.items.length, 4, 'selection model uses the same four news rows as the renderer');

  const childItems = resolveMorningBriefSectionChildItems(bulkSections, 'news');
  assert.equal(childItems.length, 4, 'section select-all contains every news row, including the collapsed fourth row');
  assert.deepEqual(childItems.map((item) => item.id), [
    'specialized:news:0',
    'specialized:news:1',
    'specialized:news:2',
    'specialized:news:3',
  ]);
  assert.equal(new Set(childItems.map((item) => item.id)).size, 4, 'each news row has one stable id');

  normalized.forEach((item, index) => {
    assert.equal(
      resolveMorningBriefBulkId(bulkSections, 'news', item.saveText),
      `specialized:news:${index}`,
      `news row ${index + 1} resolves to its own checkbox id`,
    );
    const markup = renderToStaticMarkup(React.createElement(MorningBriefNewsCard, {
      item,
      bulkSections,
      bulkSelection: { multiSelected: new Map(), onToggle: () => {} },
    }));
    assert.equal(countCheckboxes(markup), 1, `news row ${index + 1} renders one checkbox`);
  });

  const collapsedMarkup = renderToStaticMarkup(React.createElement(MorningBriefNewsSection, {
    items: extracted,
    bulkSections,
    bulkSelection: { multiSelected: new Map(), onToggle: () => {} },
  }));
  assert.equal(countCheckboxes(collapsedMarkup), 3, 'collapsed view renders the first three row checkboxes');
  assert.match(collapsedMarkup, /data-news-expand-toggle/, 'collapsed view exposes the expand control');
  assert.equal(childItems[3].text, normalized[3].saveText, 'expanded fourth row keeps its selectable save text');

  const selectedAll = new Map(childItems.map((item) => [item.id, item]));
  assert.equal(selectedAll.size, 4, 'select all produces a counter value of four');
  selectedAll.delete(childItems[1].id);
  assert.equal(selectedAll.size, 3, 'deselecting one produces a counter value of three');

  const registered = buildBulkItemsFromSections(bulkSections, 'specialized');
  const registeredNews = registered.filter((item) => item.sectionKey === 'news');
  assert.equal(registeredNews.length, 4, 'global tab select-all registers each news row once');
  assert.ok(registeredNews.every((item) => item.newsMetadata?.title), 'select-all retains per-row structured metadata');

  const selectedEntries = childItems.map((item) => [item.id, item]);
  const drafts = buildWorkspaceSelectionDraft(selectedEntries, 'specialized');
  assert.equal(drafts.length, 4, 'four selected news rows create four Workspace drafts');
  assert.equal(buildWorkspaceSelectionDraft([selectedEntries[2]], 'specialized').length, 1, 'one selected news row creates one Workspace draft');

  const duplicateAlias = ['specialized:card:news', { ...childItems[0] }];
  const dedupedDrafts = buildWorkspaceSelectionDraft([...selectedEntries, duplicateAlias], 'specialized');
  assert.equal(dedupedDrafts.length, 4, 'one logical news row represented by two ids is saved only once');

  const persisted = drafts.map((draft) => buildWorkspaceNewsFields(draft));
  assert.deepEqual(persisted.map((item) => item.newsTitle), news.map((item) => item.title || item.headline));
  assert.deepEqual(persisted.map((item) => item.sentiment), news.map((item) => item.sentiment));
  assert.deepEqual(persisted.map((item) => item.impact), news.map((item) => item.impact));
  assert.deepEqual(persisted[0].symbols, ['SPY']);
  assert.deepEqual(persisted[1].symbols, ['INTC']);
  assert.deepEqual(persisted[2].symbols, ['GOOGL']);
  assert.deepEqual(persisted[3].symbols, ['TLT', 'QQQ']);
  assert.equal(persisted[0].links[0].url, 'https://example.com/morgan');
  assert.equal(persisted[3].links[0], 'https://example.com/bonds');
  assert.equal(persisted[0].sourceMetadata.source, 'Reuters');
  assert.equal(persisted[1].sourceMetadata.publisher, 'Example Wire');
  assert.equal(persisted[2].sourceMetadata.author, 'Market Desk');
  assert.equal(persisted[3].sourceMetadata.sourceName, 'Global Markets');
  assert.equal(new Set(persisted.map((item) => item.identityPayload.text)).size, 4, 'saved records keep four distinct bodies instead of repeating the first');

  const storageBacking = new Map();
  const createMemoryStorage = () => ({
    getItem: (key) => storageBacking.get(key) ?? null,
    setItem: (key, value) => storageBacking.set(key, String(value)),
    removeItem: (key) => storageBacking.delete(key),
  });
  const saveStorage = createMemoryStorage();

  drafts.forEach((draft, index) => {
    const newsFields = buildWorkspaceNewsFields(draft);
    const result = saveWorkspaceItem({
      id: `workspace:news-test:${index}`,
      videoId: null,
      sourceVideoId: 'news-test-video',
      sourceVideoTitle: 'Morning Brief QA',
      videoTitle: newsFields.newsTitle,
      sourceTabId: draft.tabScope,
      sourceSectionId: draft.sourceSectionId,
      sourceHeading: draft.sectionLabel,
      itemType: 'snippet',
      originalItemType: draft.type,
      notes: draft.text,
      savedAt: `2026-08-31T06:0${index}:00Z`,
      ...newsFields,
    }, { storage: saveStorage });
    assert.equal(result.ok, true, `news row ${index + 1} persists successfully`);
  });

  const reloadedItems = getWorkspaceItems(createMemoryStorage());
  assert.equal(reloadedItems.length, 4, 'reload returns exactly four persisted Workspace entries');
  assert.equal(new Set(reloadedItems.map((item) => item.id)).size, 4, 'reloaded Workspace entries contain no duplicate ids');
  assert.equal(new Set(reloadedItems.map((item) => item.notes)).size, 4, 'reloaded Workspace entries retain four distinct news bodies');
  news.forEach((sourceNews) => {
    const expectedTitle = sourceNews.title || sourceNews.headline;
    const saved = reloadedItems.find((item) => item.newsTitle === expectedTitle);
    assert.ok(saved, `reload retains the news entry titled ${expectedTitle}`);
    assert.equal(saved.sentiment, sourceNews.sentiment, 'reload retains the row sentiment');
    assert.equal(saved.impact, sourceNews.impact, 'reload retains the row impact');
  });

  const reloadedMarkup = renderToStaticMarkup(React.createElement(WorkspaceSavedAnalysisContent, {
    group: { items: reloadedItems, versions: [], videoUrl: null },
    activeCollection: null,
    selectedIds: new Set(),
    onToggleGroup: () => {},
  }));
  assert.equal((reloadedMarkup.match(/data-news-style-row/g) || []).length, 4, 'reload renders four distinct readable news rows');
  news.forEach((sourceNews) => {
    const expectedTitle = sourceNews.title || sourceNews.headline;
    const expectedDescription = sourceNews.description || sourceNews.summary;
    assert.ok(reloadedMarkup.includes(encodeHtmlText(expectedTitle)), 'renderer shows each persisted headline');
    assert.ok(reloadedMarkup.includes(encodeHtmlText(expectedDescription)), 'renderer shows each persisted description');
  });
  assert.match(reloadedMarkup, /סנטימנט:<\/span> חיובי/, 'positive sentiment is supporting Hebrew metadata');
  assert.match(reloadedMarkup, /סנטימנט:<\/span> ניטרלי/, 'neutral sentiment is supporting Hebrew metadata');
  assert.match(reloadedMarkup, /סנטימנט:<\/span> שלילי/, 'negative sentiment is supporting Hebrew metadata');

  const oneSelectedMarkup = renderToStaticMarkup(React.createElement(MorningBriefNewsCard, {
    item: normalized[2],
    bulkSections,
    bulkSelection: {
      multiSelected: new Map([[childItems[2].id, childItems[2]]]),
      onToggle: () => {},
    },
  }));
  assert.equal(countChecked(oneSelectedMarkup), 1, 'an individual news row reflects its own selected state');

  console.log('News Workspace multiselect QA passed, including isolated save and reload');
} finally {
  await server.close();
}
