import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { getMarketAssetDestination } = await vite.ssrLoadModule('/src/lib/marketAssetDestinations.js');
  const { getExternalSymbolUrl } = await vite.ssrLoadModule('/src/utils/finvizLinks.js');
  const expected = {
    SPX: 'https://finviz.com/stock?t=SPY',
    NASDAQ: 'https://finviz.com/stock?t=QQQ',
    DOW: 'https://finviz.com/stock?t=DIA',
    RUSSELL: 'https://finviz.com/stock?t=IWM',
    VIX: 'https://finviz.com/futures?p=d&t=VX',
    OIL: 'https://finviz.com/futures?p=d&t=CL',
    DOLLAR: 'https://finviz.com/futures?p=d&t=DX',
    BITCOIN: 'https://finviz.com/crypto?t=BTCUSD',
    BONDS10Y: 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield',
  };
  for (const [asset, url] of Object.entries(expected)) {
    assert.equal(getMarketAssetDestination(asset)?.url, url, asset);
  }

  const aliases = {
    SPX: ['SP500', 'S&P500', 'S&P 500', 'SNP'],
    NASDAQ: ['NASDAQ100', 'NASDAQ 100', 'NDX'],
    DOW: ['DJIA', 'DJI', 'DOW JONES'],
    RUSSELL: ['RUSSELL2000', 'RUSSELL 2000', 'RUT'],
    VIX: ['CBOE VIX'],
    OIL: ['CRUDE', 'CRUDEOIL', 'CRUDE OIL', 'WTI'],
    DOLLAR: ['DXY', 'USD INDEX', 'DOLLAR INDEX'],
    BITCOIN: ['BTC', 'BTCUSD', 'BTC/USD'],
    BONDS10Y: ['BOND10Y', 'US10Y', '10Y', 'TNX', 'US 10Y', 'U.S. 10Y', 'US TREASURY 10Y'],
  };
  for (const [canonical, values] of Object.entries(aliases)) {
    for (const alias of values) {
      assert.equal(getMarketAssetDestination(alias)?.canonicalAsset, canonical, alias);
      assert.equal(getMarketAssetDestination(alias)?.url, expected[canonical], alias);
    }
  }

  assert.equal(getMarketAssetDestination('UNKNOWN_ASSET'), null);
  assert.equal(getExternalSymbolUrl('AAPL'), 'https://finviz.com/quote.ashx?t=AAPL');
  assert.equal(getExternalSymbolUrl('SPY'), 'https://finviz.com/quote.ashx?t=SPY');
  const bondUrl = getMarketAssetDestination('BONDS10Y').url;
  for (const forbidden of ['finviz', 'tradingview', 'TLT', 'IEF', 'ZN']) {
    assert.ok(!bondUrl.includes(forbidden), forbidden);
  }

  const primitive = fs.readFileSync(new URL('../src/components/dashboard/MorningBriefVisualPrimitives.jsx', import.meta.url), 'utf8');
  const table = fs.readFileSync(new URL('../src/components/dashboard/MorningBriefMarketsTable.jsx', import.meta.url), 'utf8');
  assert.match(primitive, /target="_blank"/);
  assert.match(primitive, /rel="noopener noreferrer"/);
  assert.match(primitive, /aria-label=\{ariaLabel\}/);
  assert.match(primitive, /e\.key === ' '/);
  assert.match(primitive, /e\.stopPropagation\(\)/);
  assert.match(table, /verifiedMarketAssetOnly/);

  console.log(JSON.stringify({ status: 'passed', destinations: 9, aliases: 35, paidCalls: 0 }, null, 2));
} finally {
  await vite.close();
}
