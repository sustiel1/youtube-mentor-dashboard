import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { canonicalizeMarketAsset } = require('../shared/marketAssetIdentity.cjs');
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const { getMarketAssetDestination } = await vite.ssrLoadModule('/src/lib/marketAssetDestinations.js');
  const expected = {
    SPX: 'https://finviz.com/stock?t=SPY', NASDAQ: 'https://finviz.com/stock?t=QQQ',
    DOW: 'https://finviz.com/stock?t=DIA', RUSSELL: 'https://finviz.com/stock?t=IWM',
    VIX: 'https://finviz.com/futures?p=d&t=VX', OIL: 'https://finviz.com/futures?p=d&t=CL',
    DOLLAR: 'https://finviz.com/futures?p=d&t=DX', BITCOIN: 'https://finviz.com/crypto?t=BTCUSD',
    BONDS10Y: 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield',
  };
  for (const [asset, url] of Object.entries(expected)) assert.equal(getMarketAssetDestination(asset)?.url, url, asset);
  const aliases = {
    SPX: ['SP500', 'S&P500', 'S&P 500', 'SNP'], NASDAQ: ['NASDAQ100', 'NASDAQ 100', 'NDX'],
    DOW: ['DJIA', 'DJI', 'DOW JONES'], RUSSELL: ['RUSSELL2000', 'RUSSELL 2000', 'RUT'],
    VIX: ['CBOE VIX'], OIL: ['CRUDE', 'CRUDEOIL', 'CRUDE OIL', 'WTI'],
    DOLLAR: ['DXY', 'USD INDEX', 'DOLLAR INDEX'], BITCOIN: ['BTC', 'BTCUSD', 'BTC/USD'],
    BONDS10Y: ['BOND10Y', 'US10Y', '10Y', 'TNX', 'US 10Y', 'U.S. 10Y', 'US TREASURY 10Y'],
  };
  for (const [canonical, values] of Object.entries(aliases)) for (const alias of values) {
    assert.equal(canonicalizeMarketAsset(alias), canonical);
    assert.equal(getMarketAssetDestination(alias)?.canonicalAsset, canonical);
  }
  assert.equal(getMarketAssetDestination('UNKNOWN_ASSET'), null);
  assert.equal(canonicalizeMarketAsset('UNKNOWN_ASSET'), 'UNKNOWN_ASSET');
  const bondUrl = getMarketAssetDestination('BONDS10Y').url;
  for (const forbidden of ['finviz', 'tradingview', 'TLT', 'IEF', 'ZN']) assert.ok(!bondUrl.includes(forbidden));
  console.log(JSON.stringify({ status: 'passed', destinations: 9, aliases: 35, uiWiring: false }, null, 2));
} finally {
  await vite.close();
}
