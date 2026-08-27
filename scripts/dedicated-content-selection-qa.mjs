import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const countCheckboxes = (markup) => (markup.match(/type="checkbox"/g) || []).length;

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

try {
  const bulk = await server.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const { MorningBriefBulkCheckbox } = await server.ssrLoadModule('/src/components/dashboard/MorningBriefBulkCheckbox.jsx');
  const {
    MacroStyleEmptyInsightCard,
    MacroStyleOpportunityCard,
    MacroStyleRiskCard,
    getMacroOppStyle,
    getMacroRiskStyle,
  } = await server.ssrLoadModule('/src/components/dashboard/MacroStyleInsightCards.jsx');
  const { LearningTabContent } = await server.ssrLoadModule('/src/components/dashboard/LearningTabContent.jsx');

  const opportunity = {
    ticker: 'MRVL',
    title: 'מומנטום חיובי בעקבות הרחבת שיתוף פעולה',
    detail: 'תזה עשירה ששומרת על כל פרטי ההזדמנות',
    entry: '75',
    stop: '70',
    target: '88',
    rrRatio: '1:2.6',
    timeframe: 'swing',
    confidence: 'high',
  };
  const sector = {
    sector: 'ביוטכנולוגיה ותרופות',
    direction: 'into',
    relativeStrength: 'high',
    reason: 'חדשות חיוביות',
    etf: 'XLV',
    stocks: ['MRK', 'MRNA'],
  };
  const stock = {
    ticker: 'MRVL',
    company: 'Marvell',
    context: 'שותפות חדשה',
    sentiment: 'positive',
    changePercent: '13.5%',
    actionability: 'watch',
    notes: 'מעקב',
    timeframe: 'swing',
    priority: 'high',
    isNewToWatch: false,
  };
  const calendar = {
    event: 'החלטת ריבית',
    date: '2026-08-21',
    importance: 'high',
    impact: 'תנודתיות צפויה',
    timeframe: 'today',
    affectedStocks: ['SPY'],
  };
  const macro = {
    indicator: 'CPI',
    value: '2.8%',
    change: 'down',
    frequency: 'monthly',
    description: 'אינפלציה',
    impact: 'positive',
  };
  const market = { asset: 'SPY', trend: 'up', strength: '0.4%', comment: 'פתיחה חיובית' };

  const cases = [
    ['news', 'חדשות בדיקה'],
    ['market-regime', 'סיכום מצב השוק: חיובי'],
    ['sectors', bulk.formatMorningBriefSectorText(sector)],
    ['opportunities', bulk.formatMorningBriefOpportunityText(opportunity)],
    ['risks', 'סיכון בדיקה'],
    ['stocks-mentioned', bulk.formatMorningBriefStockText(stock)],
    ['economic-calendar', bulk.formatMorningBriefCalendarText(calendar)],
    ['macro', bulk.formatMorningBriefMacroText(macro)],
    ['sentiment', 'פתיחת מסחר: חיובי'],
    ['markets', bulk.formatMorningBriefMarketText(market)],
    ['top-insights', 'תובנה מובילה'],
    ['learning-insights', 'לקח שימושי'],
    ['all-points', 'נקודה נוספת'],
  ];
  const sections = cases.map(([key, text]) => ({ key, label: key, tabKey: key, items: [text] }));
  const selection = { multiSelected: new Map(), onToggle: () => {} };

  for (const [sectionKey, text] of cases) {
    const id = bulk.resolveMorningBriefBulkId(sections, sectionKey, text);
    assert.equal(id, `specialized:${sectionKey}:0`, `${sectionKey} must resolve its stable item id`);
    const markup = renderToStaticMarkup(React.createElement(MorningBriefBulkCheckbox, {
      bulkSections: sections,
      sectionKey,
      text,
      sectionLabel: sectionKey,
      tabKey: sectionKey,
      bulkSelection: selection,
    }));
    assert.equal(countCheckboxes(markup), 1, `${sectionKey} must render exactly one item checkbox`);
  }

  for (const section of sections) {
    const childItems = bulk.resolveMorningBriefSectionChildItems(sections, section.key);
    assert.equal(childItems.length, 1, `${section.key} select-all must contain every selectable item`);
    assert.equal(childItems[0].id, `specialized:${section.key}:0`);
    assert.equal(childItems[0].text, section.items[0]);
  }
  const allIds = sections.flatMap((section) => bulk.resolveMorningBriefSectionChildItems(sections, section.key).map((item) => item.id));
  assert.equal(new Set(allIds).size, allIds.length, 'stable selection ids must not create duplicate saved records');

  const opportunityCheckbox = React.createElement(MorningBriefBulkCheckbox, {
    bulkSections: sections,
    sectionKey: 'opportunities',
    text: bulk.formatMorningBriefOpportunityText(opportunity),
    bulkSelection: selection,
  });
  const opportunityMarkup = renderToStaticMarkup(React.createElement(MacroStyleOpportunityCard, {
    title: opportunity.title,
    details: opportunity.detail,
    style: getMacroOppStyle('', opportunity.title),
    checkbox: opportunityCheckbox,
  }));
  assert.equal(countCheckboxes(opportunityMarkup), 1, 'the opportunity card must render one working checkbox');

  const riskCheckbox = React.createElement(MorningBriefBulkCheckbox, {
    bulkSections: sections,
    sectionKey: 'risks',
    text: 'סיכון בדיקה',
    bulkSelection: selection,
  });
  const riskMarkup = renderToStaticMarkup(React.createElement(MacroStyleRiskCard, {
    title: 'סיכון בדיקה',
    style: getMacroRiskStyle('high'),
    checkbox: riskCheckbox,
  }));
  assert.equal(countCheckboxes(riskMarkup), 1, 'risk cards must not receive duplicate checkboxes');
  assert.equal(countCheckboxes(renderToStaticMarkup(React.createElement(MacroStyleEmptyInsightCard))), 0, 'empty placeholder cards must not render a checkbox');

  const genericBulk = {
    idPrefix: 'specialized:recommendations',
    sectionLabel: 'המלצות',
    type: 'recommendations',
    tabScope: 'specialized',
    multiSelected: new Map(),
    onToggle: () => {},
  };
  const genericMarkup = renderToStaticMarkup(React.createElement(LearningTabContent, {
    items: ['המלצה', 'תובנה', 'פריט ייעודי נוסף'],
    bulkSelection: genericBulk,
  }));
  assert.equal(countCheckboxes(genericMarkup), 3, 'generic dedicated-content items must render exactly one checkbox each');
  assert.equal(countCheckboxes(renderToStaticMarkup(React.createElement(LearningTabContent, {
    items: [null, undefined, '', {}],
    bulkSelection: genericBulk,
  }))), 0, 'generic empty content must not render checkboxes');

  const panelsSource = await readFile(new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url), 'utf8');
  const marketsSource = await readFile(new URL('../src/components/dashboard/MorningBriefMarketsTable.jsx', import.meta.url), 'utf8');
  const sectionLabelSource = await readFile(new URL('../src/components/shared/UniversalTabSectionLabelRow.jsx', import.meta.url), 'utf8');
  assert.equal((panelsSource.match(/text=\{selectionText\}/g) || []).length, 3, 'opportunity variants and stocks must use canonical selection text');
  assert.match(panelsSource, /text=\{calendarBulkText\}/, 'calendar rows must use canonical selection text');
  assert.match(panelsSource, /text=\{formatMorningBriefSectorText\(row\)\}/, 'sector rows must use canonical selection text');
  const marketRowSource = marketsSource.slice(marketsSource.indexOf('data-market-item'), marketsSource.indexOf('</tr>', marketsSource.indexOf('data-market-item')));
  assert.equal((marketRowSource.match(/<MorningBriefBulkCheckbox/g) || []).length, 1, 'market rows must render one checkbox');
  assert.ok(marketRowSource.indexOf('<MorningBriefBulkCheckbox') < marketRowSource.indexOf('<MarketAssetDescriptionTooltip'), 'market checkbox must remain beside the asset title');
  assert.match(sectionLabelSource, /ref\.current\.indeterminate\s*=\s*someSelected/, 'mixed section selection must preserve the existing indeterminate state');

  console.log(`Dedicated-content selection QA: ${cases.length} structured types and generic renderer passed`);
} finally {
  await server.close();
}
