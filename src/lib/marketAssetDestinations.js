import assetAliases from '../../shared/marketAssetAliases.json';
import { getStockSectorMeta } from './stockSectorMap';
import { getVerifiedMarketSecurityExchange } from '@/utils/finvizLinks';

const DESTINATIONS = Object.freeze({
  SPX: ['finviz', 'finviz-etf', 'SPY', 'https://finviz.com/stock?t=SPY'],
  NASDAQ: ['finviz', 'finviz-etf', 'QQQ', 'https://finviz.com/stock?t=QQQ'],
  DOW: ['finviz', 'finviz-etf', 'DIA', 'https://finviz.com/stock?t=DIA'],
  RUSSELL: ['finviz', 'finviz-etf', 'IWM', 'https://finviz.com/stock?t=IWM'],
  VIX: ['finviz', 'finviz-futures', 'VX', 'https://finviz.com/futures?p=d&t=VX'],
  OIL: ['finviz', 'finviz-futures', 'CL', 'https://finviz.com/futures?p=d&t=CL'],
  DOLLAR: ['finviz', 'finviz-futures', 'DX', 'https://finviz.com/futures?p=d&t=DX'],
  BITCOIN: ['finviz', 'finviz-crypto', 'BTCUSD', 'https://finviz.com/crypto?t=BTCUSD'],
  BONDS10Y: ['investing-israel', 'investing-yield', 'US10Y', 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield'],
});

const VERIFIED_ETF_EXCHANGES = Object.freeze({
  SPY: 'AMEX', QQQ: 'NASDAQ', DIA: 'AMEX', IWM: 'AMEX',
  XLK: 'AMEX', XLC: 'AMEX', XLY: 'AMEX', XLP: 'AMEX',
  XLE: 'AMEX', XLF: 'AMEX', XLV: 'AMEX', XLI: 'AMEX',
  XLB: 'AMEX', XLRE: 'AMEX', XLU: 'AMEX',
  SMH: 'NASDAQ', SOXX: 'NASDAQ', IGV: 'AMEX', XBI: 'AMEX',
  GLD: 'AMEX', SLV: 'AMEX', TLT: 'NASDAQ', UUP: 'AMEX', USO: 'AMEX',
});
const AMBIGUOUS_SECURITY_TICKERS = new Set(['BRK']);

function normalizeSecurityTicker(value) {
  const ticker = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{1,6}(?:\.[AB])?$/.test(ticker) ? ticker : '';
}

export function getVerifiedSecurityIdentity(value) {
  const ticker = normalizeSecurityTicker(value);
  if (!ticker || AMBIGUOUS_SECURITY_TICKERS.has(ticker)) return null;

  const exchange = VERIFIED_ETF_EXCHANGES[ticker];
  if (exchange) return { ticker, exchange, instrumentType: 'etf' };
  const verifiedExchange = getVerifiedMarketSecurityExchange(ticker);
  if (verifiedExchange || getStockSectorMeta(ticker)) {
    return {
      ticker,
      exchange: verifiedExchange || 'verified-us-listing',
      instrumentType: 'stock',
    };
  }
  return null;
}

export function canonicalizeExternalMarketAsset(value) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  return normalized ? (assetAliases[normalized] || '') : '';
}

export function getMarketAssetDestination(value) {
  const canonicalAsset = canonicalizeExternalMarketAsset(value);
  const destination = DESTINATIONS[canonicalAsset];
  if (destination) {
    const [provider, destinationType, destinationSymbol, url] = destination;
    return { canonicalAsset, provider, destinationType, destinationSymbol, url };
  }

  const security = getVerifiedSecurityIdentity(value);
  if (!security) return null;
  return {
    canonicalAsset: security.ticker,
    provider: 'finviz',
    destinationType: `finviz-${security.instrumentType}`,
    destinationSymbol: security.ticker,
    exchange: security.exchange,
    url: `https://finviz.com/quote.ashx?t=${encodeURIComponent(security.ticker)}&p=d`,
  };
}

export const MARKET_ASSET_DESTINATIONS = DESTINATIONS;
export const VERIFIED_MARKET_ETF_EXCHANGES = VERIFIED_ETF_EXCHANGES;
