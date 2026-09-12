import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

import {
  filterMarketAssetProviderLinks,
  MARKET_ASSET_PROVIDER_PRIORITY,
  resolveMarketAssetProviderLinks,
  selectPreferredMarketAssetLink,
} from '../src/lib/marketAssetProviderLinks.js';

const expected = [
  ['RSP', 'finviz', ['finviz'], 'https://finviz.com/stock?t=RSP'],
  ['ETH', 'investing', ['investing', 'tradingView'], 'https://il.investing.com/crypto/ethereum'],
  ['SPX', 'finviz', ['finviz', 'investing', 'tradingView'], 'https://finviz.com/stock?t=SPY'],
  ['NASDAQ', 'finviz', ['finviz', 'investing', 'tradingView'], 'https://finviz.com/stock?t=QQQ'],
  ['DOW', 'finviz', ['finviz', 'investing', 'tradingView'], 'https://finviz.com/stock?t=DIA'],
  ['RUSSELL', 'finviz', ['finviz', 'investing', 'tradingView'], 'https://finviz.com/stock?t=IWM'],
  ['VIX', 'finviz', ['finviz', 'investing', 'tradingView'], 'https://finviz.com/stock?t=VIXY'],
  ['OIL', 'finviz', ['finviz', 'investing', 'tradingView'], 'https://finviz.com/stock?t=USO'],
  ['DOLLAR', 'finviz', ['finviz', 'investing', 'tradingView'], 'https://finviz.com/stock?t=UUP'],
  ['BITCOIN', 'finviz', ['finviz', 'investing', 'tradingView'], 'https://finviz.com/crypto?t=BTCUSD'],
  ['BONDS10Y', 'finviz', ['finviz', 'investing', 'tradingView'], 'https://finviz.com/stock?t=IEF'],
];

const verifiedFinvizUrls = new Map([
  ['RSP', 'https://finviz.com/stock?t=RSP'],
  ['SPX', 'https://finviz.com/stock?t=SPY'],
  ['NASDAQ', 'https://finviz.com/stock?t=QQQ'],
  ['DOW', 'https://finviz.com/stock?t=DIA'],
  ['RUSSELL', 'https://finviz.com/stock?t=IWM'],
  ['VIX', 'https://finviz.com/stock?t=VIXY'],
  ['OIL', 'https://finviz.com/stock?t=USO'],
  ['DOLLAR', 'https://finviz.com/stock?t=UUP'],
  ['BITCOIN', 'https://finviz.com/crypto?t=BTCUSD'],
  ['BONDS10Y', 'https://finviz.com/stock?t=IEF'],
]);

const approvedFinvizRepresentativeAssets = new Set([
  'SPX', 'NASDAQ', 'DOW', 'RUSSELL', 'VIX', 'OIL', 'DOLLAR', 'BONDS10Y',
]);

const expectedFinvizQualifiers = new Map([
  ['SPX', 'נציג S&P 500 · ETF SPY'],
  ['NASDAQ', 'נציג Nasdaq 100 · ETF QQQ'],
  ['DOW', 'נציג Dow Jones · ETF DIA'],
  ['RUSSELL', 'נציג Russell 2000 · ETF IWM'],
  ['VIX', 'נציג חוזי VIX קצרים, לא מדד VIX המזומן · ETF VIXY'],
  ['OIL', 'קרן נציגת WTI המבוססת על חוזים · USO'],
  ['DOLLAR', 'קרן נציגת מדד דולר שורית · UUP'],
  ['BONDS10Y', 'קרן אג״ח ארה״ב ל־7–10 שנים; מחיר, לא תשואת US10Y · IEF'],
]);

const expectedFutures = new Map([
  ['SPX', ['ES', 'https://finviz.com/futures?t=ES']],
  ['NASDAQ', ['NQ', 'https://finviz.com/futures?t=NQ']],
  ['DOW', ['YM', 'https://finviz.com/futures?t=YM']],
  ['RUSSELL', ['ER2', 'https://finviz.com/futures?t=ER2']],
  ['VIX', ['VX', 'https://finviz.com/futures?t=VX']],
  ['OIL', ['CL', 'https://finviz.com/futures?t=CL']],
  ['DOLLAR', ['DX', 'https://finviz.com/futures?p=d&t=DX']],
  ['BONDS10Y', ['ZN', 'https://finviz.com/futures?t=ZN']],
]);

const expectedPrimaryUrls = new Map(expected.map(([asset, , , url]) => [asset, url]));

const expectedInvestingUrls = new Map([
  ['ETH', 'https://il.investing.com/crypto/ethereum'],
  ['SPX', 'https://il.investing.com/indices/us-spx-500'],
  ['NASDAQ', 'https://il.investing.com/indices/nasdaq-composite'],
  ['DOW', 'https://il.investing.com/indices/us-30'],
  ['RUSSELL', 'https://il.investing.com/indices/smallcap-2000'],
  ['VIX', 'https://il.investing.com/indices/volatility-s-p-500'],
  ['OIL', 'https://il.investing.com/commodities/crude-oil'],
  ['DOLLAR', 'https://il.investing.com/indices/usdollar'],
  ['BITCOIN', 'https://il.investing.com/crypto/bitcoin'],
  ['BONDS10Y', 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield'],
]);

assert.deepEqual(MARKET_ASSET_PROVIDER_PRIORITY, ['finviz', 'investing', 'tradingView']);

for (const [asset, preferredProvider, providers, preferredUrl] of expected) {
  const resolved = resolveMarketAssetProviderLinks(asset);
  assert.equal(resolved?.rawValue, asset, `${asset} raw value`);
  assert.equal(resolved?.preferred?.provider, preferredProvider, `${asset} preferred provider`);
  assert.equal(resolved?.preferred?.url, preferredUrl, `${asset} preferred URL`);
  assert.deepEqual(resolved?.links.map((link) => link.provider), providers, `${asset} provider order`);
  const finvizLink = resolved?.links.find((link) => link.provider === 'finviz');
  if (verifiedFinvizUrls.has(asset)) {
    assert.equal(finvizLink?.url, verifiedFinvizUrls.get(asset), `${asset} keeps its exact Finviz provider URL`);
    assert.equal(finvizLink?.primaryEligible, true, `${asset} Finviz primary eligibility`);
    if (approvedFinvizRepresentativeAssets.has(asset)) {
      assert.equal(finvizLink?.relation, 'proxy', `${asset} Finviz relation`);
      assert.equal(finvizLink?.qualifier, expectedFinvizQualifiers.get(asset), `${asset} Finviz qualifier`);
      assert.equal(resolved?.relation, 'proxy', `${asset} preferred relation`);
      assert.equal(resolved?.qualifier, expectedFinvizQualifiers.get(asset), `${asset} preferred qualifier`);
      assert.ok(finvizLink?.ariaLabel.includes(expectedFinvizQualifiers.get(asset)), `${asset} accessible proxy label`);
    }
  }
  if (expectedFutures.has(asset)) {
    const [symbol, url] = expectedFutures.get(asset);
    assert.equal(resolved?.futures?.symbol, symbol, `${asset} futures symbol`);
    assert.equal(resolved?.futures?.url, url, `${asset} futures URL`);
    assert.equal(resolved?.futures?.relation, 'futures', `${asset} futures relation`);
    assert.ok(resolved?.futures?.ariaLabel.includes(symbol), `${asset} accessible futures label`);
  } else {
    assert.equal(resolved?.futures, null, `${asset} has no futures control`);
  }
  assert.ok(resolved?.links.every((link) => !link.url.includes('utm_')), `${asset} has no tracking parameters`);
  if (expectedInvestingUrls.has(asset)) {
    const investingLink = resolved?.links.find((link) => link.provider === 'investing');
    assert.equal(
      investingLink?.url,
      expectedInvestingUrls.get(asset),
      `${asset} keeps its exact Investing Israel chip`,
    );
    assert.equal(investingLink?.relation, 'direct', `${asset} Investing relation stays direct`);
    assert.equal(investingLink?.qualifier, null, `${asset} Investing has no Finviz proxy qualifier`);
  }
}

for (const asset of approvedFinvizRepresentativeAssets) {
  const visibleLinks = filterMarketAssetProviderLinks(
    resolveMarketAssetProviderLinks(asset)?.links,
    ['finviz'],
  );
  assert.deepEqual(
    visibleLinks.map((link) => link.provider),
    ['investing', 'tradingView'],
    `${asset} markets-table visible provider order`,
  );
}

assert.equal(resolveMarketAssetProviderLinks('ETH')?.links.some((link) => link.provider === 'finviz'), false);
assert.equal(resolveMarketAssetProviderLinks('SPX')?.links.some((link) => link.url.includes('finviz.com/stock?t=SPX')), false);
assert.equal(resolveMarketAssetProviderLinks('BITCOIN')?.futures, null);
assert.equal(resolveMarketAssetProviderLinks('MSFT')?.futures, null);
const expectedTradingViewUrls = new Map([
  ['ETH', 'https://www.tradingview.com/chart/?symbol=BITSTAMP%3AETHUSD'],
  ['SPX', 'https://www.tradingview.com/chart/?symbol=SP%3ASPX'],
  ['NASDAQ', 'https://www.tradingview.com/chart/?symbol=NASDAQ%3AIXIC'],
  ['DOW', 'https://www.tradingview.com/chart/?symbol=DJ%3ADJI'],
  ['RUSSELL', 'https://www.tradingview.com/chart/?symbol=TVC%3ARUT'],
  ['VIX', 'https://www.tradingview.com/chart/?symbol=CBOE%3AVIX'],
  ['OIL', 'https://www.tradingview.com/chart/?symbol=TVC%3AUSOIL'],
  ['DOLLAR', 'https://www.tradingview.com/chart/?symbol=TVC%3ADXY'],
  ['BITCOIN', 'https://www.tradingview.com/chart/?symbol=BITSTAMP%3ABTCUSD'],
  ['BONDS10Y', 'https://www.tradingview.com/chart/?symbol=TVC%3AUS10Y'],
]);
for (const [asset, expectedUrl] of expectedTradingViewUrls) {
  assert.equal(
    resolveMarketAssetProviderLinks(asset)?.links.find((link) => link.provider === 'tradingView')?.url,
    expectedUrl,
    `${asset} exact TradingView URL`,
  );
}

for (const [alias, canonicalKey] of new Map([
  ['S&P500', 'SPX'],
  ['NASDAQ 100', 'NASDAQ'],
  ['NASDAQ100', 'NASDAQ'],
  ['NDX', 'NASDAQ'],
  ['IXIC', 'NASDAQ'],
  ['DJIA', 'DOW'],
  ['RUT', 'RUSSELL'],
  ['WTI', 'OIL'],
  ['DXY', 'DOLLAR'],
  ['BTC', 'BITCOIN'],
  ['US10Y', 'BONDS10Y'],
])) {
  const resolved = resolveMarketAssetProviderLinks(alias);
  assert.equal(resolved?.canonicalKey, canonicalKey, `${alias} canonical mapping`);
  assert.equal(resolved?.preferred?.url, expectedPrimaryUrls.get(canonicalKey), `${alias} verified primary destination`);
  if (expectedFutures.has(canonicalKey)) {
    assert.equal(resolved?.futures?.url, expectedFutures.get(canonicalKey)[1], `${alias} verified futures destination`);
  }
}

assert.equal(resolveMarketAssetProviderLinks('RUSSELL 1000'), null);
assert.equal(resolveMarketAssetProviderLinks('OIL / BRENT'), null);
assert.equal(resolveMarketAssetProviderLinks('UNKNOWN-ASSET'), null);
assert.equal(resolveMarketAssetProviderLinks(''), null);

const tradingViewOnly = Object.freeze({ provider: 'tradingView', url: 'https://www.tradingview.com/chart/?symbol=TVC%3ATEST' });
assert.equal(selectPreferredMarketAssetLink({ tradingView: tradingViewOnly }), tradingViewOnly);
assert.equal(selectPreferredMarketAssetLink({ investing: { provider: 'investing' }, tradingView: tradingViewOnly })?.provider, 'investing');
assert.equal(selectPreferredMarketAssetLink({ finviz: { provider: 'finviz' }, investing: { provider: 'investing' } })?.provider, 'finviz');
assert.equal(selectPreferredMarketAssetLink({
  finviz: { provider: 'finviz', primaryEligible: false },
  investing: { provider: 'investing' },
  tradingView: tradingViewOnly,
})?.provider, 'investing');
assert.equal(selectPreferredMarketAssetLink({
  finviz: { provider: 'finviz', primaryEligible: false },
  tradingView: tradingViewOnly,
})?.provider, 'tradingView');
assert.equal(selectPreferredMarketAssetLink({ finviz: { provider: 'finviz', primaryEligible: false } }), null);

assert.equal(resolveMarketAssetProviderLinks('MSFT')?.preferred?.provider, 'finviz');
assert.equal(resolveMarketAssetProviderLinks('KOSPI')?.preferred?.provider, 'tradingView');
const unrelatedFinvizUrl = 'https://finviz.com/stock?t=WRONG';
for (const provenanceField of ['sourceUrl', 'liveDataUrl', 'url']) {
  const resolved = resolveMarketAssetProviderLinks({ symbol: 'SPX', [provenanceField]: unrelatedFinvizUrl });
  assert.equal(resolved?.preferred?.provider, 'finviz', `${provenanceField} does not override the primary destination`);
  assert.equal(resolved?.links.some((link) => link.url === unrelatedFinvizUrl), false, `${provenanceField} stays outside provider navigation`);
}
assert.equal(
  resolveMarketAssetProviderLinks({ symbol: 'MSFT', finvizUrl: 'https://finviz.com/stock?t=MSFT' })?.preferred?.url,
  'https://finviz.com/stock?t=MSFT',
  'matching legacy explicit Finviz URL is preserved',
);
assert.equal(
  resolveMarketAssetProviderLinks({
    symbol: 'MSFT',
    verifiedProviderUrls: { finviz: 'https://finviz.com/stock?t=MSFT' },
  })?.preferred?.url,
  'https://finviz.com/stock?t=MSFT',
  'verified explicit Finviz URL is preserved',
);

const oldSnapshot = {
  marketsTable: expected.map(([asset]) => ({ asset, trend: 'legacy', strength: '', comment: '' })),
};
const before = JSON.stringify(oldSnapshot);
oldSnapshot.marketsTable.forEach((row) => resolveMarketAssetProviderLinks(row.asset));
assert.equal(JSON.stringify(oldSnapshot), before);

const sharedSource = readFileSync(
  new URL('../src/components/shared/MarketAssetProviderLinks.jsx', import.meta.url),
  'utf8',
);
const resolverSource = readFileSync(
  new URL('../src/lib/marketAssetProviderLinks.js', import.meta.url),
  'utf8',
);
assert.ok(resolverSource.includes("finviz: 'https://finviz.com/stock?t=RSP'"));
for (const verifiedUrl of verifiedFinvizUrls.values()) {
  assert.ok(resolverSource.includes(`finviz: '${verifiedUrl}'`), `${verifiedUrl} is explicit`);
}
for (const [, futuresUrl] of expectedFutures.values()) {
  assert.ok(resolverSource.includes(`finvizFuturesUrl: '${futuresUrl}'`), `${futuresUrl} is explicit`);
}
assert.ok(sharedSource.includes('target="_blank"'));
assert.ok(sharedSource.includes('rel="noopener noreferrer"'));
assert.ok(sharedSource.includes("title={resolution.preferred.qualifier || 'פתיחת הנכס במקור המועדף'}"));
assert.ok(sharedSource.includes('onClick={(event) => event.stopPropagation()}'));
assert.ok(sharedSource.includes('focus-visible:ring-2'));
assert.ok(sharedSource.includes('<svg'));
assert.equal(sharedSource.includes('>↗</span>'), false);
assert.ok(sharedSource.includes('rounded-md border border-indigo-200'));
assert.ok(sharedSource.includes('justify-center gap-1.5'));
assert.ok(sharedSource.includes('w-full min-w-0 flex-wrap'));
assert.equal(sharedSource.match(/onClick=\{\(event\) => event\.stopPropagation\(\)\}/g)?.length, 3);

const marketsTableSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefMarketsTable.jsx', import.meta.url),
  'utf8',
);
const requiredHeadings = ['>נכס</th>', '>גרף חוזים</th>', '>קישורים</th>', '>סנטימנט</th>', '>שינוי %</th>', '>הערה</th>', '>פעולות</th>'];
const headingPositions = requiredHeadings.map((heading) => marketsTableSource.indexOf(heading));
assert.ok(headingPositions.every((position, index) => position >= 0 && (index === 0 || position > headingPositions[index - 1])));
assert.ok(marketsTableSource.includes('BRIEF_MARKETS_COL.actions'));
assert.ok(marketsTableSource.includes('BRIEF_MARKETS_CELL.futures'));
assert.ok(marketsTableSource.includes('BRIEF_MARKETS_CELL.links'));
assert.ok(marketsTableSource.includes('<MorningBriefBulkCheckbox'));
assert.ok(marketsTableSource.includes("MARKETS_TABLE_HIDDEN_PROVIDERS = Object.freeze(['finviz'])"));
assert.ok(marketsTableSource.includes('hiddenProviders={MARKETS_TABLE_HIDDEN_PROVIDERS}'));
assert.ok(marketsTableSource.includes('showInfoButton={false}'));
assert.ok(marketsTableSource.includes('showQualifier={false}'));
assert.ok(marketsTableSource.includes('<MarketAssetFuturesLink'));

const layoutSource = readFileSync(
  new URL('../src/components/dashboard/briefTableLayout.jsx', import.meta.url),
  'utf8',
);
assert.ok(['100px', '110px', '230px', '130px', '70px'].every((width) => layoutSource.includes(`'${width}'`)));
assert.ok(layoutSource.includes("futures: 'px-2 py-2 align-middle text-center'"));
assert.ok(['links', 'sentiment', 'change', 'actions'].every((column) => layoutSource.includes(`${column}: 'px-3 py-2 align-middle text-center'`)));
assert.ok(layoutSource.includes("BRIEF_TABLE_WRAPPER_CLS = 'w-full overflow-x-auto'"));

const descriptionTooltipSource = readFileSync(
  new URL('../src/components/shared/MarketAssetDescriptionTooltip.jsx', import.meta.url),
  'utf8',
);
assert.ok(descriptionTooltipSource.includes('<MarketAssetPreferredLink'));

for (const componentPath of [
  '../src/components/dashboard/MorningBriefMarketsTable.jsx',
  '../src/components/workspace/StructuredSnapshotView.jsx',
]) {
  const source = readFileSync(new URL(componentPath, import.meta.url), 'utf8');
  const assetHeading = source.indexOf('>נכס</th>');
  const linksHeading = source.indexOf('>קישורים</th>');
  assert.ok(assetHeading >= 0 && linksHeading > assetHeading, `${componentPath} links column follows asset`);
  assert.ok(source.includes('<MarketAssetDescriptionTooltip'));
  if (componentPath.includes('MorningBriefMarketsTable')) {
    // Live table: same compact links-chip menu as the saved snapshot table (parity change), Finviz hidden.
    assert.ok(source.includes('<MarketAssetLinksMenu'), `${componentPath} consolidates provider links into the compact menu`);
    assert.ok(source.includes('hiddenProviders={MARKETS_TABLE_HIDDEN_PROVIDERS}'));
  } else {
    // Saved snapshot: same links consolidated into one compact popover menu, Finviz hidden for parity.
    assert.ok(source.includes('<MarketAssetLinksMenu'), `${componentPath} consolidates provider links into the compact menu`);
    assert.ok(source.includes('hiddenProviders={SNAPSHOT_MARKETS_HIDDEN_PROVIDERS}'), `${componentPath} hides Finviz for parity with the live table`);
  }
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
try {
  const {
    MarketAssetFuturesLink,
    MarketAssetPreferredLink,
    MarketAssetProviderLinks,
  } = await server.ssrLoadModule(
    '/src/components/shared/MarketAssetProviderLinks.jsx',
  );
  const spxProvidersMarkup = renderToStaticMarkup(React.createElement(MarketAssetProviderLinks, {
    asset: 'SPX',
    hiddenProviders: ['finviz'],
  }));
  assert.equal(spxProvidersMarkup.includes('data-market-provider="finviz"'), false);
  assert.ok(spxProvidersMarkup.includes('data-market-provider="investing"'));
  assert.ok(spxProvidersMarkup.includes('href="https://il.investing.com/indices/us-spx-500"'));
  assert.ok(spxProvidersMarkup.includes('data-market-provider="tradingView"'));
  assert.ok(spxProvidersMarkup.indexOf('data-market-provider="investing"') < spxProvidersMarkup.indexOf('data-market-provider="tradingView"'));

  const spxPreferredMarkup = renderToStaticMarkup(React.createElement(
    MarketAssetPreferredLink,
    { asset: 'SPX', showQualifier: false },
    'SPX',
  ));
  assert.ok(spxPreferredMarkup.includes('data-market-asset-preferred-link="finviz"'));
  assert.ok(spxPreferredMarkup.includes('href="https://finviz.com/stock?t=SPY"'));
  assert.ok(spxPreferredMarkup.includes('aria-label="פתיחת SPX באתר Finviz באמצעות נציג S&amp;P 500 · ETF SPY"'));
  assert.equal(spxPreferredMarkup.includes('>נציג S&amp;P 500 · ETF SPY</span>'), false);

  const spxFuturesMarkup = renderToStaticMarkup(React.createElement(MarketAssetFuturesLink, { asset: 'SPX' }));
  assert.ok(spxFuturesMarkup.includes('data-market-asset-futures-link="ES"'));
  assert.ok(spxFuturesMarkup.includes('href="https://finviz.com/futures?t=ES"'));
  assert.ok(spxFuturesMarkup.includes('aria-label="פתיחת גרף חוזה S&amp;P 500 ב־Finviz, סימול חוזה ES"'));

  const bitcoinFuturesMarkup = renderToStaticMarkup(React.createElement(MarketAssetFuturesLink, { asset: 'BITCOIN' }));
  assert.equal(bitcoinFuturesMarkup.includes('<a'), false);

  const msftPreferredMarkup = renderToStaticMarkup(React.createElement(MarketAssetPreferredLink, { asset: 'MSFT' }, 'MSFT'));
  assert.ok(msftPreferredMarkup.includes('data-market-asset-preferred-link="finviz"'));
  assert.ok(msftPreferredMarkup.includes('href="https://finviz.com/stock?t=MSFT"'));
} finally {
  await server.close();
}

console.log('market asset provider links QA passed');
