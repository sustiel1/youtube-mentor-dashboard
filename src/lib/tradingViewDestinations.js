const PUBLIC_SYMBOL_BASE = 'https://il.tradingview.com/symbols/';

const CANONICAL_MARKET_SYMBOLS = Object.freeze({
  SPX: ['SPX', 'SP:SPX', 'index', 'Standard and Poor’s Indices'],
  NASDAQ: ['NASDAQ', 'NASDAQ:IXIC', 'index', 'Nasdaq Stock Market'],
  DOW: ['DOW', 'TVC:DJI', 'index', 'TradingView'],
  RUSSELL: ['RUSSELL', 'TVC:RUT', 'index', 'TradingView'],
  VIX: ['VIX', 'CBOE:VIX', 'volatility-index', 'CBOE'],
  OIL: [
    'OIL',
    'TVC:USOIL',
    'commodity-spot',
    'TradingView',
    {
      tooltipHe: 'פתח גרף נפט WTI ב־TradingView',
      ariaLabelHe: 'פתח את גרף הנפט הגולמי WTI באתר TradingView',
    },
  ],
  DOLLAR: ['DOLLAR', 'TVC:DXY', 'currency-index', 'TradingView'],
  BITCOIN: ['BITCOIN', 'COINBASE:BTCUSD', 'crypto-spot', 'Coinbase'],
  BONDS10Y: ['BONDS10Y', 'TVC:US10Y', 'government-bond-yield', 'TradingView'],
});

const MARKET_ALIASES = new Map([
  ['SPX', 'SPX'], ['SP500', 'SPX'], ['S&P500', 'SPX'], ['S&P 500', 'SPX'],
  ['NASDAQ', 'NASDAQ'], ['NASDAQ COMPOSITE', 'NASDAQ'], ['IXIC', 'NASDAQ'],
  ['DOW', 'DOW'], ['DOW JONES', 'DOW'], ['DJIA', 'DOW'], ['DJI', 'DOW'],
  ['RUSSELL', 'RUSSELL'], ['RUSSELL 2000', 'RUSSELL'], ['RUT', 'RUSSELL'],
  ['VIX', 'VIX'], ['CBOE VIX', 'VIX'],
  ['OIL', 'OIL'], ['WTI', 'OIL'], ['USOIL', 'OIL'], ['CRUDE OIL', 'OIL'],
  ['WTI CRUDE', 'OIL'], ['WTI CRUDE OIL', 'OIL'],
  ['DOLLAR', 'DOLLAR'], ['DXY', 'DOLLAR'], ['DOLLAR INDEX', 'DOLLAR'],
  ['BITCOIN', 'BITCOIN'], ['BTC', 'BITCOIN'], ['BTCUSD', 'BITCOIN'], ['BTC/USD', 'BITCOIN'],
  ['BONDS10Y', 'BONDS10Y'], ['US10Y', 'BONDS10Y'], ['10Y', 'BONDS10Y'], ['TNX', 'BONDS10Y'],
]);

const VERIFIED_EXCHANGE_BY_SYMBOL = new Map([
  ['AAPL', 'NASDAQ'], ['AMD', 'NASDAQ'], ['AMZN', 'NASDAQ'], ['ARM', 'NASDAQ'], ['AVGO', 'NASDAQ'],
  ['FTNT', 'NASDAQ'], ['GV', 'NASDAQ'], ['HOOD', 'NASDAQ'], ['INTC', 'NASDAQ'],
  ['LRCX', 'NASDAQ'], ['MNDY', 'NASDAQ'], ['SMCI', 'NASDAQ'], ['SBUX', 'NASDAQ'],
  ['CVNA', 'NYSE'], ['CVX', 'NYSE'], ['LMND', 'NYSE'], ['NVO', 'NYSE'],
  ['JOBY', 'NYSE'], ['PLTR', 'NASDAQ'], ['RBLX', 'NYSE'], ['RDDT', 'NYSE'], ['T', 'NYSE'],
  ['GOOG', 'NASDAQ'], ['GOOGL', 'NASDAQ'], ['GRMN', 'NYSE'], ['META', 'NASDAQ'],
  ['MSFT', 'NASDAQ'], ['MU', 'NASDAQ'], ['NVDA', 'NASDAQ'], ['QCOM', 'NASDAQ'],
  ['SOFI', 'NASDAQ'], ['TSLA', 'NASDAQ'], ['VRT', 'NYSE'], ['GEHC', 'NASDAQ'],
  ['PG', 'NYSE'], ['V', 'NYSE'], ['KO', 'NYSE'], ['UPS', 'NYSE'], ['ORCL', 'NYSE'],
  ['BRK.A', 'NYSE'], ['BRK.B', 'NYSE'],
  ['SPY', 'AMEX'], ['QQQ', 'NASDAQ'], ['SOXX', 'NASDAQ'], ['SMH', 'NASDAQ'],
  ['IGV', 'AMEX'], ['XLE', 'AMEX'], ['XLK', 'AMEX'], ['XLF', 'AMEX'],
  ['XLV', 'AMEX'], ['XLI', 'AMEX'], ['XLB', 'AMEX'], ['XLU', 'AMEX'],
  ['XLY', 'AMEX'], ['XLP', 'AMEX'], ['XLC', 'AMEX'], ['XLRE', 'AMEX'],
  ['XBI', 'AMEX'], ['IWM', 'AMEX'],
]);

const VERIFIED_ETFS = new Set([
  'SPY', 'QQQ', 'SOXX', 'SMH', 'IGV', 'XLE', 'XLK', 'XLF', 'XLV', 'XLI',
  'XLB', 'XLU', 'XLY', 'XLP', 'XLC', 'XLRE', 'XBI', 'IWM',
]);

const SUPPORTED_STOCK_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'AMEX']);
const AMBIGUOUS_STOCK_SYMBOLS = new Set(['BRK']);
const STOCK_TICKER_PATTERN = /^[A-Z]{1,6}(?:\.[AB])?$/;

const SECTOR_ETF_BY_NAME = new Map([
  ['TECHNOLOGY', 'XLK'], ['טכנולוגיה', 'XLK'],
  ['SEMICONDUCTORS', 'SOXX'], ['SEMICONDUCTORS / AI', 'SOXX'], ['מוליכים למחצה', 'SOXX'],
  ['SOFTWARE', 'IGV'], ['תוכנה', 'IGV'],
  ['ENERGY', 'XLE'], ['אנרגיה', 'XLE'],
  ['FINANCIALS', 'XLF'], ['פיננסים', 'XLF'],
  ['HEALTHCARE', 'XLV'], ['בריאות', 'XLV'],
  ['INDUSTRIALS', 'XLI'], ['תעשייה', 'XLI'],
  ['UTILITIES', 'XLU'], ['תשתיות', 'XLU'],
  ['REAL ESTATE', 'XLRE'], ['נדל"ן', 'XLRE'],
  ['CONSUMER STAPLES', 'XLP'], ['צריכה בסיסית', 'XLP'],
  ['CONSUMER DISCRETIONARY', 'XLY'], ['צריכה מחזורית', 'XLY'],
  ['COMMUNICATION SERVICES', 'XLC'], ['תקשורת', 'XLC'],
  ['MATERIALS', 'XLB'], ['חומרי גלם', 'XLB'],
  ['BIOTECH', 'XBI'], ['ביוטק', 'XBI'],
]);

function normalize(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function toPublicSymbolUrl(qualifiedSymbol) {
  return `${PUBLIC_SYMBOL_BASE}${qualifiedSymbol.replace(':', '-')}/`;
}

function buildDestination({
  canonicalAsset,
  tradingViewSymbol,
  exchange,
  instrumentType,
  provider,
  resolutionStatus,
  displayAsset,
  tooltipHe,
  ariaLabelHe,
}) {
  const label = displayAsset || canonicalAsset;
  return {
    canonicalAsset,
    tradingViewSymbol,
    provider: 'TradingView',
    exchange: exchange || provider,
    instrumentType,
    url: toPublicSymbolUrl(tradingViewSymbol),
    tooltipHe: tooltipHe || `פתח את הגרף של ${label} ב־TradingView`,
    ariaLabelHe: ariaLabelHe || `פתח גרף ונתוני שוק עבור ${label} באתר TradingView`,
    resolutionStatus,
  };
}

function unresolvedStockIdentity(ticker, status, reasonHe) {
  return {
    ticker,
    exchange: '',
    tradingViewSymbol: '',
    tradingViewUrl: '',
    identitySource: 'unavailable',
    confidence: 'unavailable',
    status,
    reasonHe,
  };
}

/**
 * Resolves a stock ticker to an exchange-qualified public TradingView identity.
 * Source exchange wins, followed by the verified registry. No exchange is guessed.
 */
export function resolveStockTradingViewIdentity(input, options = {}) {
  const source = typeof input === 'object' && input ? input : {};
  const ticker = normalize(
    typeof input === 'object' && input
      ? input.ticker || input.symbol || input.stock || ''
      : input,
  );
  const sourceExchange = normalize(
    options.exchange || source.exchange || source.listingExchange || '',
  );

  if (!ticker || !STOCK_TICKER_PATTERN.test(ticker)) {
    return unresolvedStockIdentity(ticker, 'invalid-ticker', 'הסימול אינו תקין');
  }
  if (MARKET_ALIASES.has(ticker) || SECTOR_ETF_BY_NAME.has(ticker) || VERIFIED_ETFS.has(ticker)) {
    return unresolvedStockIdentity(ticker, 'unsupported-security-type', 'הזהות אינה מניה רגילה');
  }
  if (AMBIGUOUS_STOCK_SYMBOLS.has(ticker)) {
    return unresolvedStockIdentity(ticker, 'ambiguous-ticker', 'הסימול דורש מחלקת מניה מפורשת');
  }
  if (sourceExchange && !SUPPORTED_STOCK_EXCHANGES.has(sourceExchange)) {
    return unresolvedStockIdentity(ticker, 'missing-exchange', 'קוד הבורסה שסופק אינו נתמך');
  }

  const exchange = sourceExchange || VERIFIED_EXCHANGE_BY_SYMBOL.get(ticker) || '';
  if (!exchange) {
    return unresolvedStockIdentity(ticker, 'missing-exchange', 'לא ניתן לאמת את הבורסה עבור הסימול');
  }

  const tradingViewSymbol = `${exchange}:${ticker}`;
  return {
    ticker,
    exchange,
    tradingViewSymbol,
    tradingViewUrl: toPublicSymbolUrl(tradingViewSymbol),
    identitySource: sourceExchange ? 'source-exchange' : 'verified-registry',
    confidence: 'verified',
    status: sourceExchange
      ? 'resolved-from-source-exchange'
      : 'resolved-from-verified-registry',
    reasonHe: '',
  };
}

export function getTradingViewPublicDestination(input, options = {}) {
  const raw = typeof input === 'object' && input
    ? input.symbol || input.asset || input.ticker || ''
    : input;
  const normalized = normalize(raw);
  if (!normalized) return null;

  const qualified = normalized.match(/^([A-Z]+):([A-Z0-9.!]+)$/);
  if (qualified) {
    const [, exchange, symbol] = qualified;
    if (!['NASDAQ', 'NYSE', 'AMEX', 'SP', 'TVC', 'CBOE', 'COINBASE', 'NYMEX'].includes(exchange)) {
      return null;
    }
    return buildDestination({
      canonicalAsset: symbol,
      tradingViewSymbol: `${exchange}:${symbol}`,
      exchange,
      instrumentType: options.instrumentType || 'market-instrument',
      provider: exchange,
      resolutionStatus: 'exact',
      displayAsset: raw,
    });
  }

  const canonicalMarket = MARKET_ALIASES.get(normalized);
  if (canonicalMarket) {
    const [canonicalAsset, tradingViewSymbol, instrumentType, provider, accessibility = {}] =
      CANONICAL_MARKET_SYMBOLS[canonicalMarket];
    return buildDestination({
      canonicalAsset,
      tradingViewSymbol,
      exchange: tradingViewSymbol.split(':')[0],
      instrumentType,
      provider,
      resolutionStatus: normalized === canonicalAsset ? 'exact' : 'canonical-alias',
      displayAsset: raw,
      ...accessibility,
    });
  }

  const sectorEtf = SECTOR_ETF_BY_NAME.get(normalized);
  if (!sectorEtf && !VERIFIED_ETFS.has(normalized)) {
    const stockIdentity = resolveStockTradingViewIdentity(input, options);
    if (stockIdentity.confidence !== 'verified') return null;
    return buildDestination({
      canonicalAsset: stockIdentity.ticker,
      tradingViewSymbol: stockIdentity.tradingViewSymbol,
      exchange: stockIdentity.exchange,
      instrumentType: 'stock',
      provider: stockIdentity.exchange,
      resolutionStatus: stockIdentity.status,
      displayAsset: stockIdentity.ticker,
      tooltipHe: `פתח את גרף ${stockIdentity.ticker} ב־TradingView`,
      ariaLabelHe: `פתח את גרף המניה ${stockIdentity.ticker} באתר TradingView`,
    });
  }
  const symbol = sectorEtf || normalized;
  const exchange = options.exchange
    ? normalize(options.exchange)
    : VERIFIED_EXCHANGE_BY_SYMBOL.get(symbol);
  if (!exchange || !/^[A-Z]{1,6}(?:\.[AB])?$/.test(symbol)) return null;

  return buildDestination({
    canonicalAsset: symbol,
    tradingViewSymbol: `${exchange}:${symbol}`,
    exchange,
    instrumentType: sectorEtf || VERIFIED_ETFS.has(symbol) ? 'etf' : 'stock',
    provider: exchange,
    resolutionStatus: sectorEtf ? 'canonical-alias' : 'exact',
    displayAsset: raw,
  });
}

export const TRADING_VIEW_PUBLIC_MARKET_SYMBOLS = CANONICAL_MARKET_SYMBOLS;
