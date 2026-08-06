import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const moduleUrl = pathToFileURL(path.join(root, 'src/lib/tradingViewDestinations.js')).href;
const { getTradingViewPublicDestination, resolveStockTradingViewIdentity } = await import(moduleUrl);

const expected = {
  SPX: 'SP:SPX',
  NASDAQ: 'NASDAQ:IXIC',
  DOW: 'TVC:DJI',
  RUSSELL: 'TVC:RUT',
  VIX: 'CBOE:VIX',
  OIL: 'TVC:USOIL',
  DOLLAR: 'TVC:DXY',
  BITCOIN: 'COINBASE:BTCUSD',
  BONDS10Y: 'TVC:US10Y',
};

for (const [asset, symbol] of Object.entries(expected)) {
  const destination = getTradingViewPublicDestination(asset);
  assert.equal(destination?.tradingViewSymbol, symbol, asset);
  assert.equal(destination?.url, `https://il.tradingview.com/symbols/${symbol.replace(':', '-')}/`);
}

assert.equal(getTradingViewPublicDestination('SPX')?.url.includes('SPY'), false);
assert.equal(getTradingViewPublicDestination('NASDAQ')?.url.includes('QQQ'), false);
assert.equal(getTradingViewPublicDestination('DOW')?.url.includes('DIA'), false);
assert.equal(getTradingViewPublicDestination('RUSSELL')?.url.includes('IWM'), false);
assert.equal(getTradingViewPublicDestination('VIX')?.url.includes('VX'), false);
for (const alias of ['OIL', 'WTI', 'USOIL', 'CRUDE OIL', 'WTI CRUDE', 'WTI CRUDE OIL']) {
  const oil = getTradingViewPublicDestination(alias);
  assert.equal(oil?.canonicalAsset, 'OIL', alias);
  assert.equal(oil?.tradingViewSymbol, 'TVC:USOIL', alias);
  assert.equal(oil?.url, 'https://il.tradingview.com/symbols/TVC-USOIL/', alias);
  assert.equal(oil?.url.includes('NYSE-WTI'), false, alias);
  assert.equal(oil?.url.includes('chart/'), false, alias);
  assert.match(oil?.tooltipHe || '', /WTI.*TradingView/, alias);
  assert.match(oil?.ariaLabelHe || '', /WTI.*TradingView/, alias);
}

assert.equal(getTradingViewPublicDestination('AAPL')?.tradingViewSymbol, 'NASDAQ:AAPL');
assert.equal(getTradingViewPublicDestination('V')?.tradingViewSymbol, 'NYSE:V');
assert.equal(getTradingViewPublicDestination('GOOG')?.tradingViewSymbol, 'NASDAQ:GOOG');
assert.equal(getTradingViewPublicDestination('GOOGL')?.tradingViewSymbol, 'NASDAQ:GOOGL');
assert.equal(getTradingViewPublicDestination('BRK.A')?.tradingViewSymbol, 'NYSE:BRK.A');
assert.equal(getTradingViewPublicDestination('BRK.B')?.tradingViewSymbol, 'NYSE:BRK.B');
const verifiedCurrentVideoStocks = {
  ARM: 'NASDAQ',
  FTNT: 'NASDAQ',
  HOOD: 'NASDAQ',
  LRCX: 'NASDAQ',
  SBUX: 'NASDAQ',
  META: 'NASDAQ',
  QCOM: 'NASDAQ',
  CVNA: 'NYSE',
  LMND: 'NYSE',
  CVX: 'NYSE',
  NVO: 'NYSE',
  PLTR: 'NASDAQ',
  RBLX: 'NYSE',
  RDDT: 'NYSE',
};
for (const [ticker, exchange] of Object.entries(verifiedCurrentVideoStocks)) {
  const destination = getTradingViewPublicDestination(ticker);
  assert.equal(destination?.canonicalAsset, ticker, ticker);
  assert.equal(destination?.tradingViewSymbol, `${exchange}:${ticker}`, ticker);
  assert.equal(
    destination?.url,
    `https://il.tradingview.com/symbols/${exchange}-${ticker}/`,
    ticker,
  );
}
assert.equal(getTradingViewPublicDestination('ZZZZZ'), null);
for (const [ticker, exchange] of Object.entries({
  AMZN: 'NASDAQ',
  GOOGL: 'NASDAQ',
  AAPL: 'NASDAQ',
  MU: 'NASDAQ',
})) {
  assert.equal(getTradingViewPublicDestination(ticker)?.tradingViewSymbol, `${exchange}:${ticker}`);
}
assert.equal(getTradingViewPublicDestination('SOXX')?.instrumentType, 'etf');
assert.equal(getTradingViewPublicDestination('IGV')?.instrumentType, 'etf');
assert.equal(getTradingViewPublicDestination('XLE')?.instrumentType, 'etf');
assert.equal(getTradingViewPublicDestination('UNKNOWN'), null);
assert.equal(getTradingViewPublicDestination('MIXED'), null);
assert.equal(getTradingViewPublicDestination('INTEREST RATES'), null);

for (const [ticker, exchange] of Object.entries({
  AMD: 'NASDAQ', HOOD: 'NASDAQ', JOBY: 'NYSE', RDDT: 'NYSE', SMCI: 'NASDAQ',
  T: 'NYSE', GV: 'NASDAQ', MNDY: 'NASDAQ', GOOGL: 'NASDAQ', INTC: 'NASDAQ', TSLA: 'NASDAQ',
})) {
  const identity = resolveStockTradingViewIdentity(ticker);
  assert.equal(identity.status, 'resolved-from-verified-registry', ticker);
  assert.equal(identity.tradingViewSymbol, `${exchange}:${ticker}`, ticker);
  assert.equal(identity.tradingViewUrl, `https://il.tradingview.com/symbols/${exchange}-${ticker}/`, ticker);
}
assert.equal(resolveStockTradingViewIdentity({ ticker: 'SRCN', exchange: 'NASDAQ' }).status, 'resolved-from-source-exchange');
assert.equal(resolveStockTradingViewIdentity({ ticker: 'SRCY', exchange: 'NYSE' }).tradingViewSymbol, 'NYSE:SRCY');
assert.equal(resolveStockTradingViewIdentity('ZZZZZ').status, 'missing-exchange');
assert.equal(resolveStockTradingViewIdentity('BRK').status, 'ambiguous-ticker');
assert.equal(resolveStockTradingViewIdentity('INTEREST RATES').status, 'invalid-ticker');
assert.equal(resolveStockTradingViewIdentity('SPX').status, 'unsupported-security-type');
assert.equal(getTradingViewPublicDestination({ ticker: 'SRCN', exchange: 'NASDAQ' })?.tradingViewSymbol, 'NASDAQ:SRCN');
assert.equal(getTradingViewPublicDestination('ZZZZZ'), null);
assert.doesNotMatch(getTradingViewPublicDestination('AMD')?.url || '', /\/chart\//);

const componentSource = fs.readFileSync(
  path.join(root, 'src/components/shared/TradingViewSymbolAction.jsx'),
  'utf8',
);
const marketsSource = fs.readFileSync(
  path.join(root, 'src/components/dashboard/MorningBriefMarketsTable.jsx'),
  'utf8',
);
assert.match(componentSource, /target="_blank"/);
assert.match(componentSource, /rel="noopener noreferrer"/);
assert.match(componentSource, /event\.key === ' '/);
assert.match(componentSource, /stopPropagation/);
assert.match(componentSource, /event\.currentTarget\.click\(\)/);
assert.match(marketsSource, /data-market-actions-cell/);
assert.match(marketsSource, /TradingViewSymbolAction[\s\S]*asset=\{row\.asset\}/);
assert.match(marketsSource, /ExternalSymbolLink[\s\S]*\{row\.asset \|\|/);

console.log('TradingView public destinations: OIL aliases and existing destinations passed');
