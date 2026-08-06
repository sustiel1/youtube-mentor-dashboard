import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    formatMarketRowText,
    getMarketRowSelection,
    resolveMorningBriefBulkId,
  } = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const { buildBulkItemsFromSections } = await vite.ssrLoadModule('/src/lib/universalTabBulkItems.js');

  const rows = [
    { asset: 'SPX', trend: 'down', strength: '0.16%', comment: 'weak open' },
    { asset: 'OIL', trend: 'flat', comment: 'geopolitical pressure' },
    { asset: 'BONDS10Y', trend: 'flat', comment: 'Fed decision ahead' },
    { asset: 'VIX', trend: 'up', level: '17.3', strength: '5%', comment: 'volatility rising' },
    { asset: 'DOLLAR', trend: 'up', level: '101.1', comment: 'dollar strengthens' },
    { asset: 'BITCOIN', trend: 'down', level: '65,500', comment: 'crypto weakens' },
  ];

  const selections = rows.map(getMarketRowSelection);
  assert.deepEqual(
    selections.map((item) => item.id),
    ['markets:SPX', 'markets:OIL', 'markets:BONDS10Y', 'markets:VIX', 'markets:DOLLAR', 'markets:BITCOIN'],
  );

  for (const [alias, expected] of [
    ['BTC', 'markets:BITCOIN'],
    ['BTCUSD', 'markets:BITCOIN'],
    ['DXY', 'markets:DOLLAR'],
    ['USD INDEX', 'markets:DOLLAR'],
    ['CBOE VIX', 'markets:VIX'],
  ]) {
    assert.equal(getMarketRowSelection({ asset: alias, comment: 'meaningful' })?.id, expected);
  }
  assert.equal(getMarketRowSelection({ asset: 'UNKNOWN', comment: 'meaningful' }), null);
  assert.equal(getMarketRowSelection({ asset: 'VIX' })?.id, 'markets:VIX');

  const marketSection = {
    key: 'markets',
    label: 'Markets',
    items: rows.map(formatMarketRowText),
    itemIds: selections.map((item) => item.id),
    tabKey: 'indices',
  };
  const bulkItems = buildBulkItemsFromSections([marketSection], 'specialized');
  assert.equal(bulkItems.length, 6);
  assert.equal(new Set(bulkItems.map((item) => item.id)).size, 6);
  assert.equal(resolveMorningBriefBulkId([marketSection], 'markets', formatMarketRowText(rows[3])), 'markets:VIX');
  assert.equal(resolveMorningBriefBulkId([marketSection], 'markets', formatMarketRowText(rows[4])), 'markets:DOLLAR');
  assert.equal(resolveMorningBriefBulkId([marketSection], 'markets', formatMarketRowText(rows[5])), 'markets:BITCOIN');

  const aliasItems = [
    getMarketRowSelection({ asset: 'BTC', comment: 'first' }),
    getMarketRowSelection({ asset: 'BTCUSD', comment: 'second' }),
  ];
  const selected = new Map(aliasItems.map((item) => [item.id, item]));
  assert.equal(selected.size, 1);

  const filtered = buildBulkItemsFromSections([{
    key: 'markets',
    items: ['VIX · valid', 'UNKNOWN · invalid'],
    itemIds: ['markets:VIX', null],
  }], 'specialized');
  assert.deepEqual(filtered.map((item) => item.id), ['markets:VIX']);

  console.log(JSON.stringify({
    status: 'passed',
    selectableRows: bulkItems.length,
    aliasesVerified: 5,
    stableIds: true,
    unknownAssetsSelectable: false,
  }, null, 2));
} finally {
  await vite.close();
}
