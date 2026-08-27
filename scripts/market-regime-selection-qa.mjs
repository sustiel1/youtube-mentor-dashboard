import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const countCheckboxes = (markup) => (markup.match(/type="checkbox"/g) || []).length;

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

try {
  const {
    buildMorningBriefBulkSections,
    formatMorningBriefRegimeText,
    resolveMorningBriefBulkId,
    resolveMorningBriefSectionChildItems,
  } = await server.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const { MarketRegimeSection } = await server.ssrLoadModule('/src/components/dashboard/MorningBriefPanels.jsx');

  const cards = [
    { key: 'summary', label: 'סיכום מצב השוק', value: 'פתיחה חיובית' },
    { key: 'marketBreadth', label: 'רוחב שוק', value: 'marketBreadth: 0.87%' },
    { key: 'generalMood', label: 'מצב רוח כללי', value: 'bullish' },
  ];
  const marketBriefData = { __manualMarketRegimeCards: cards };
  const bulkSections = buildMorningBriefBulkSections({}, marketBriefData);
  const sectionItems = resolveMorningBriefSectionChildItems(bulkSections, 'market-regime');

  assert.equal(formatMorningBriefRegimeText(cards[1]), 'רוחב שוק: 0.87%');
  assert.equal(cards[1].value, 'marketBreadth: 0.87%', 'stored source value must remain unchanged');
  assert.equal(sectionItems.length, 3, 'select-all must include all three market-regime rows');
  assert.deepEqual(sectionItems.map((item) => item.id), [
    'specialized:market-regime:0',
    'specialized:market-regime:1',
    'specialized:market-regime:2',
  ]);
  assert.equal(new Set(sectionItems.map((item) => item.id)).size, 3, 'stable ids must remain unique');

  for (const [index, card] of cards.entries()) {
    assert.equal(
      resolveMorningBriefBulkId(bulkSections, 'market-regime', formatMorningBriefRegimeText(card)),
      `specialized:market-regime:${index}`,
      `${card.label} must resolve its existing stable selection id`,
    );
  }

  const renderSection = (multiSelected = new Map()) => renderToStaticMarkup(React.createElement(MarketRegimeSection, {
    marketBriefData,
    bulkSections,
    bulkSelection: {
      multiSelected,
      onToggle: () => {},
      onSectionSelect: () => {},
      onSectionDeselect: () => {},
    },
  }));

  const markup = renderSection();
  assert.equal(countCheckboxes(markup), 3, 'the section must render exactly three item checkboxes');

  const tableRows = markup.match(/<tr[\s\S]*?<\/tr>/g) || [];
  for (const card of cards) {
    const matchingRows = tableRows.filter((row) => row.includes(card.label));
    assert.equal(matchingRows.length, 1, `${card.label} must render in exactly one row`);
    assert.equal(countCheckboxes(matchingRows[0]), 1, `${card.label} must render exactly one checkbox`);
  }

  const breadthId = 'specialized:market-regime:1';
  const mixedMarkup = renderSection(new Map([[breadthId, sectionItems[1]]]));
  const mixedRows = mixedMarkup.match(/<tr[\s\S]*?<\/tr>/g) || [];
  const breadthRow = mixedRows.find((row) => row.includes('רוחב שוק'));
  assert.ok(breadthRow?.includes('checked=""'), 'individual selection must check only the breadth row');
  assert.equal((mixedMarkup.match(/checked=""/g) || []).length, 1, 'mixed selection must not select another row');
  assert.ok(breadthRow.includes('href="https://finviz.com/"'), 'the breadth title link must remain independent');
  assert.ok(breadthRow.includes('target="_blank"'));
  assert.ok(breadthRow.includes('rel="noopener noreferrer"'));

  console.log('Market-regime selection QA: 25 assertions passed');
} finally {
  await server.close();
}
