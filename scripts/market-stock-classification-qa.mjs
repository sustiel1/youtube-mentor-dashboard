import assert from 'node:assert/strict';

import {
  extractMarketDashboardRows,
  extractUnifiedStocks,
  getSpecializedSrc,
} from '../src/lib/morningBriefDisplay.js';
import {
  MARKET_INSTRUMENT_CLASS,
  classifyMarketInstrument,
} from '../src/lib/marketInstrumentClassification.js';
import {
  buildStructuredSnapshot,
  normalizeStructuredSnapshotCollections,
} from '../src/utils/structuredSnapshot.js';

const broadSymbols = ['SPX', 'NASDAQ', 'DOW', 'RUSSELL', 'VIX', 'OIL', 'BITCOIN'];
const stockSymbols = ['EBAY', 'AMZN', 'RDDT', 'AVGO'];

const marketBriefData = {
  indices: [
    ...broadSymbols.map((asset) => ({ asset, trend: 'positive', comment: `${asset} market context` })),
    {
      asset: 'EBAY',
      trend: 'positive',
      strength: '0.39%',
      comment: 'EBAY complete context',
      links: { tradingView: 'https://example.test/ebay' },
      source: 'video-analysis',
      sourceVideoId: 'source-video-1',
      videoId: 'video-1',
    },
    { asset: 'AMZN', trend: 'negative', strength: '-1.2%', comment: 'AMZN context' },
    { asset: 'RDDT', trend: 'positive', comment: 'RDDT context' },
    { asset: 'AVGO', trend: 'negative', comment: 'AVGO context' },
    { asset: 'COPPER', assetType: 'commodity', comment: 'semantic commodity metadata' },
  ],
  stocksMentioned: [
    { ticker: 'SPY', instrumentType: 'etf', context: 'broad proxy supplied as stock' },
    { ticker: 'EBAY', company: 'eBay', notes: 'preserved stock note' },
  ],
};

const source = getSpecializedSrc(marketBriefData);
const markets = extractMarketDashboardRows(source);
const stocks = extractUnifiedStocks(marketBriefData);
const marketAssets = markets.map((row) => row.asset);
const stockTickers = stocks.map((row) => row.ticker);

for (const symbol of broadSymbols) {
  assert.equal(marketAssets.filter((asset) => asset === symbol).length, 1, `${symbol} remains once in Markets`);
  assert.equal(stockTickers.includes(symbol), false, `${symbol} is absent from Stocks`);
}
for (const symbol of stockSymbols) {
  assert.equal(stockTickers.filter((ticker) => ticker === symbol).length, 1, `${symbol} moves once to Stocks`);
  assert.equal(marketAssets.includes(symbol), false, `${symbol} is absent from Markets`);
}
assert.equal(marketAssets.includes('SPY'), true, 'an index proxy supplied to Stocks routes to Markets');
assert.equal(marketAssets.includes('COPPER'), true, 'semantic commodity metadata routes an unknown symbol to Markets');
assert.deepEqual(
  marketAssets.filter((asset) => stockTickers.includes(asset)),
  [],
  'no symbol is duplicated across the two collections',
);

const ebay = stocks.find((row) => row.ticker === 'EBAY');
assert.equal(ebay.company, 'eBay');
assert.equal(ebay.context, 'EBAY complete context');
assert.equal(ebay.sentiment, 'חיובי');
assert.equal(ebay.changePercent, '0.39%');
assert.equal(ebay.notes, 'preserved stock note');
assert.equal(ebay.source, 'video-analysis');
assert.equal(ebay.sourceVideoId, 'source-video-1');
assert.equal(ebay.videoId, 'video-1');
assert.deepEqual(ebay.links, { tradingView: 'https://example.test/ebay' });

assert.equal(classifyMarketInstrument({ ticker: 'ACME', securityType: 'equity' }), MARKET_INSTRUMENT_CLASS.STOCK);
assert.equal(classifyMarketInstrument({ ticker: 'COPPER', assetType: 'commodity' }), MARKET_INSTRUMENT_CLASS.MARKET);

const manualData = {
  indices: [{ asset: 'SPX' }],
  manualOverrides: {
    markets: {
      source: 'manual',
      rows: [
        { asset: 'RDDT', trend: 'positive', strength: '2%', comment: 'manual market stock' },
        { asset: 'VIX', trend: 'neutral', comment: 'manual broad instrument' },
      ],
    },
    stocksMentioned: {
      source: 'manual',
      rows: [
        { ticker: 'AVGO', sentiment: 'positive', context: 'manual stock' },
        { ticker: 'BITCOIN', sentiment: 'neutral', context: 'manual broad instrument' },
      ],
    },
  },
};
const manualMarkets = extractMarketDashboardRows(getSpecializedSrc(manualData)).map((row) => row.asset);
const manualStocks = extractUnifiedStocks(manualData).map((row) => row.ticker);
assert.deepEqual(manualMarkets.sort(), ['BITCOIN', 'VIX']);
assert.deepEqual(manualStocks.sort(), ['AVGO', 'RDDT']);

const legacySnapshot = Object.freeze({
  version: 1,
  stocksTable: Object.freeze([
    Object.freeze({ ticker: 'AMZN', company: 'Amazon', context: 'saved stock' }),
    Object.freeze({ ticker: 'BITCOIN', sentiment: 'neutral', context: 'saved broad instrument' }),
  ]),
  marketsTable: Object.freeze([
    Object.freeze({ asset: 'SPX', trend: 'positive', comment: 'saved index' }),
    Object.freeze({ asset: 'EBAY', trend: 'negative', strength: '-0.8%', comment: 'saved misplaced stock' }),
  ]),
  sentimentTable: Object.freeze([]),
});
const legacyBefore = JSON.stringify(legacySnapshot);
const normalizedLegacy = normalizeStructuredSnapshotCollections(legacySnapshot);
assert.equal(JSON.stringify(legacySnapshot), legacyBefore, 'legacy stored data is not mutated');
assert.deepEqual(normalizedLegacy.stocksTable.map((row) => row.ticker).sort(), ['AMZN', 'EBAY']);
assert.deepEqual(normalizedLegacy.marketsTable.map((row) => row.asset).sort(), ['BITCOIN', 'SPX']);
assert.equal(normalizedLegacy.stocksTable.find((row) => row.ticker === 'EBAY').changePercent, '-0.8%');

const builtSnapshot = buildStructuredSnapshot({
  videoId: 'video-2',
  rawStocks: [{ ticker: 'AVGO', source: 'analysis', sourceVideoId: 'video-2' }, { ticker: 'VIX' }],
  rawMarkets: [{ asset: 'RDDT', comment: 'misplaced at save time' }, { asset: 'NASDAQ' }],
});
assert.deepEqual(builtSnapshot.stocksTable.map((row) => row.ticker).sort(), ['AVGO', 'RDDT']);
assert.deepEqual(builtSnapshot.marketsTable.map((row) => row.asset).sort(), ['NASDAQ', 'VIX']);
assert.equal(builtSnapshot.stocksTable.find((row) => row.ticker === 'AVGO').sourceVideoId, 'video-2');

console.log('market/stock classification QA passed');
