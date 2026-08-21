import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MARKET_ASSET_PROVIDER_PRIORITY,
  resolveMarketAssetProviderLinks,
  selectPreferredMarketAssetLink,
} from '../src/lib/marketAssetProviderLinks.js';

const expectedAssets = Object.freeze([
  ['RSP', 'finviz', ['finviz'], 'https://finviz.com/stock?t=RSP'],
  ['ETH', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/crypto/ethereum'],
  ['SPX', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/indices/us-spx-500'],
  ['NASDAQ', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/indices/nasdaq-composite'],
  ['DOW', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/indices/us-30'],
  ['RUSSELL', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/indices/smallcap-2000'],
  ['VIX', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/indices/volatility-s-p-500'],
  ['OIL', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/commodities/crude-oil'],
  ['DOLLAR', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/indices/usdollar'],
  ['BITCOIN', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/crypto/bitcoin'],
  ['BONDS10Y', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield'],
]);

assert.deepEqual(MARKET_ASSET_PROVIDER_PRIORITY, ['finviz', 'investing', 'tradingView']);

for (const [asset, preferredProvider, providers, preferredUrl] of expectedAssets) {
  const resolved = resolveMarketAssetProviderLinks(asset);
  assert.equal(resolved?.rawValue, asset, `${asset} preserves its raw value`);
  assert.equal(resolved?.preferred?.provider, preferredProvider, `${asset} preferred provider`);
  assert.equal(resolved?.preferred?.url, preferredUrl, `${asset} preferred URL`);
  assert.deepEqual(resolved?.links.map((link) => link.provider), providers, `${asset} provider order`);
  assert.ok(resolved?.links.every((link) => !link.url.includes('utm_')), `${asset} contains no tracking parameter`);
}

const exactTradingViewUrls = Object.freeze({
  ETH: 'https://www.tradingview.com/chart/?symbol=BITSTAMP%3AETHUSD',
  SPX: 'https://www.tradingview.com/chart/?symbol=SP%3ASPX',
  NASDAQ: 'https://www.tradingview.com/chart/?symbol=NASDAQ%3AIXIC',
  DOW: 'https://www.tradingview.com/chart/?symbol=DJ%3ADJI',
  RUSSELL: 'https://www.tradingview.com/chart/?symbol=TVC%3ARUT',
  VIX: 'https://www.tradingview.com/chart/?symbol=CBOE%3AVIX',
  OIL: 'https://www.tradingview.com/chart/?symbol=TVC%3AUSOIL',
  DOLLAR: 'https://www.tradingview.com/chart/?symbol=TVC%3ADXY',
  BITCOIN: 'https://www.tradingview.com/chart/?symbol=BITSTAMP%3ABTCUSD',
  BONDS10Y: 'https://www.tradingview.com/chart/?symbol=TVC%3AUS10Y',
});

for (const [asset, expectedUrl] of Object.entries(exactTradingViewUrls)) {
  const tradingView = resolveMarketAssetProviderLinks(asset)?.links
    .find((link) => link.provider === 'tradingView');
  assert.equal(tradingView?.url, expectedUrl, `${asset} exact TradingView fallback`);
}

for (const [alias, canonicalKey] of Object.entries({
  ' rsp ': 'RSP',
  ethereum: 'ETH',
  'S&P500': 'SPX',
  ixic: 'NASDAQ',
  djia: 'DOW',
  rut: 'RUSSELL',
  wti: 'OIL',
  dxy: 'DOLLAR',
  btc: 'BITCOIN',
  us10y: 'BONDS10Y',
})) {
  assert.equal(resolveMarketAssetProviderLinks(alias)?.canonicalKey, canonicalKey, `${alias} verified alias`);
}

assert.equal(resolveMarketAssetProviderLinks('ETH')?.links.some((link) => link.provider === 'finviz'), false);
assert.equal(resolveMarketAssetProviderLinks('SPX')?.links.some((link) => link.url.includes('finviz.com/stock?t=SPX')), false);

for (const unsupported of [
  'NASDAQ 100',
  'RUSSELL 1000',
  'OIL / BRENT',
  'UNKNOWN-ASSET',
  '',
  '   ',
  null,
  undefined,
]) {
  assert.equal(resolveMarketAssetProviderLinks(unsupported), null, `${String(unsupported)} remains unlinked`);
}

const tradingViewOnly = Object.freeze({
  provider: 'tradingView',
  url: 'https://www.tradingview.com/chart/?symbol=TVC%3ATEST',
});
assert.equal(selectPreferredMarketAssetLink({ tradingView: tradingViewOnly }), tradingViewOnly);
assert.equal(
  selectPreferredMarketAssetLink({ investing: { provider: 'investing' }, tradingView: tradingViewOnly })?.provider,
  'investing',
);
assert.equal(
  selectPreferredMarketAssetLink({ finviz: { provider: 'finviz' }, investing: { provider: 'investing' } })?.provider,
  'finviz',
);

const oldSnapshot = Object.freeze({
  marketsTable: Object.freeze(
    expectedAssets.map(([asset]) => Object.freeze({ asset, trend: 'legacy', strength: '', comment: '' })),
  ),
});
const oldSnapshotBefore = JSON.stringify(oldSnapshot);
oldSnapshot.marketsTable.forEach((row) => resolveMarketAssetProviderLinks(row.asset));
assert.equal(JSON.stringify(oldSnapshot), oldSnapshotBefore, 'render-time resolution does not mutate old snapshots');

const resolverSource = readFileSync(
  new URL('../src/lib/marketAssetProviderLinks.js', import.meta.url),
  'utf8',
);
const componentSource = readFileSync(
  new URL('../src/components/shared/MarketAssetProviderLinks.jsx', import.meta.url),
  'utf8',
);
const combinedSource = `${resolverSource}\n${componentSource}`;

assert.ok(resolverSource.includes("finviz: 'https://finviz.com/stock?t=RSP'"));
assert.equal(resolverSource.match(/finviz\.com\/stock\?t=/g)?.length, 1);
assert.equal(resolverSource.includes('finviz.com/stock?t=${'), false);
assert.ok(componentSource.includes('<a'));
assert.ok(componentSource.includes('target="_blank"'));
assert.ok(componentSource.includes('rel="noopener noreferrer"'));
assert.ok(componentSource.includes('title="פתיחת הנכס במקור המועדף"'));
assert.ok(componentSource.includes('onClick={(event) => event.stopPropagation()}'));
assert.ok(componentSource.includes('focus-visible:ring-2'));
assert.ok(componentSource.includes('aria-label={resolution.preferred.ariaLabel}'));
assert.ok(componentSource.includes('aria-label={link.ariaLabel}'));
assert.ok(componentSource.includes('<svg'));
assert.ok(componentSource.includes('w-full min-w-0 flex-wrap'));

assert.equal(/fetch\s*\(|indexedDB|localStorage|sessionStorage|setTimeout\s*\(|setInterval\s*\(/.test(combinedSource), false);
assert.equal(/MorningBriefMarketsTable|StructuredSnapshotView|briefTableLayout|MorningBriefPanels/.test(combinedSource), false);

console.log(`market asset provider foundation QA passed for ${expectedAssets.length} verified assets`);
