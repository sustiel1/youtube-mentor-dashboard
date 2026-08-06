import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const { formatSummaryMarketItem } = await vite.ssrLoadModule('/src/lib/summaryItemDisplay.js');
  const { valueToDisplayItems } = await vite.ssrLoadModule('/src/lib/universalTabSections.js');
  const { formatBulkItemText } = await vite.ssrLoadModule('/src/lib/universalTabBulkItems.js');

  const sp = { symbol: 'S&P 500', changePercent: 0.26, note: 'נפתח בעלייה קלה של 0.1%' };
  const nasdaq = { symbol: 'Nasdaq', changePercent: '0.94%', note: 'הוביל את העליות בפתיחה' };
  assert.equal(formatSummaryMarketItem(sp), 'S&P 500 עלה ב־0.26% — נפתח בעלייה קלה של 0.1%');
  assert.equal(formatSummaryMarketItem(nasdaq), 'Nasdaq עלה ב־0.94% — הוביל את העליות בפתיחה');
  for (const forbidden of ['symbol:', 'changePercent:', 'note:', ' | ']) assert.doesNotMatch(formatSummaryMarketItem(sp), new RegExp(forbidden.replace('|', '\\|')));
  assert.equal(formatSummaryMarketItem({ asset: 'DXY', changePercent: -0.4 }), 'DXY ירד ב־-0.4%');
  assert.equal(formatSummaryMarketItem({ ticker: 'DOW', changePercent: 0 }), 'DOW ללא שינוי (0%)');
  assert.equal(formatSummaryMarketItem({ symbol: 'VIX', change: '17.2', note: 'רמה נוכחית' }), 'VIX 17.2 — רמה נוכחית');
  assert.equal(formatSummaryMarketItem({ symbol: 'SPX', changePercent: '0.26%', note: 'עלה ב־0.26%' }), 'SPX — עלה ב־0.26%');
  assert.equal(formatSummaryMarketItem({ symbol: 'SPX', direction: 'flat' }), 'SPX ללא שינוי');
  assert.equal(formatSummaryMarketItem({ symbol: 'SPX', note: 'טקסט מקור' }), 'SPX — טקסט מקור');
  assert.equal(formatSummaryMarketItem({ unknown: 'secret' }), '');
  assert.equal(formatSummaryMarketItem({}), '');
  assert.deepEqual(valueToDisplayItems('טקסט ישן'), ['טקסט ישן']);
  assert.deepEqual(valueToDisplayItems({}), []);
  const formattedSummaryItems = valueToDisplayItems(sp, 'summary');
  assert.equal(formattedSummaryItems.length, 1);
  assert.equal(formatBulkItemText(formattedSummaryItems[0]), formatSummaryMarketItem(sp));

  console.log(JSON.stringify({ status: 'passed', assertions: 18, countPreserved: true, uiExportParity: true }, null, 2));
} finally {
  await vite.close();
}
