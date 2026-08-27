export const MARKET_INSTRUMENT_CLASS = Object.freeze({
  MARKET: 'market',
  STOCK: 'stock',
  UNKNOWN: 'unknown',
});

const BROAD_MARKET_ALIASES = Object.freeze({
  RSP: ['RSP'],
  ETH: ['ETH', 'ETHEREUM', 'ETHUSD'],
  SPX: ['SPX', 'S&P 500', 'S&P500', 'SP500'],
  NASDAQ: ['NASDAQ', 'NASDAQ COMPOSITE', 'IXIC'],
  DOW: ['DOW', 'DOW JONES', 'DJI', 'DJIA'],
  RUSSELL: ['RUSSELL', 'RUSSELL 2000', 'RUT'],
  VIX: ['VIX'],
  OIL: ['OIL', 'WTI', 'USOIL', 'CRUDE OIL'],
  DOLLAR: ['DOLLAR', 'DXY', 'US DOLLAR INDEX', 'DOLLAR INDEX'],
  BITCOIN: ['BITCOIN', 'BTC', 'BTCUSD'],
  BONDS10Y: ['BONDS10Y', 'US10Y', '10Y', 'BONDS', 'TREASURY'],
  GOLD: ['GOLD', 'XAU', 'XAUUSD'],
  ES: ['ES', 'ES1!'],
  NQ: ['NQ', 'NQ1!'],
  SPY: ['SPY'],
  QQQ: ['QQQ'],
  IWM: ['IWM'],
  DIA: ['DIA'],
  GLD: ['GLD'],
  USO: ['USO'],
  TLT: ['TLT'],
  VXX: ['VXX'],
  UVXY: ['UVXY'],
  MOVE: ['MOVE'],
});

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\s+/g, ' ');
}

const BROAD_MARKET_BY_ALIAS = new Map();
for (const [canonicalKey, aliases] of Object.entries(BROAD_MARKET_ALIASES)) {
  for (const alias of aliases) BROAD_MARKET_BY_ALIAS.set(normalizeToken(alias), canonicalKey);
}

const IDENTITY_KEYS = ['asset', 'symbol', 'ticker', 'name', 'index', 'metric', 'stock', 'title'];
const TYPE_KEYS = ['instrumentType', 'assetType', 'securityType', 'type', 'kind', 'category'];

function firstString(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function getMarketInstrumentIdentity(value, fallback = '') {
  if (typeof value === 'string') {
    const separatorIndex = value.indexOf(':');
    return normalizeToken(separatorIndex > 0 ? value.slice(0, separatorIndex) : value);
  }
  if (value && typeof value === 'object') {
    return normalizeToken(firstString(value, IDENTITY_KEYS) || fallback);
  }
  return normalizeToken(fallback);
}

export function getCanonicalBroadMarketKey(value, fallback = '') {
  return BROAD_MARKET_BY_ALIAS.get(getMarketInstrumentIdentity(value, fallback)) || '';
}

function classifyExplicitType(record) {
  if (!record || typeof record !== 'object') return MARKET_INSTRUMENT_CLASS.UNKNOWN;
  const typeText = TYPE_KEYS
    .map((key) => (typeof record[key] === 'string' ? record[key].trim() : ''))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!typeText) return MARKET_INSTRUMENT_CLASS.UNKNOWN;

  if (/\b(stock|equity|company|corporation|share)\b|מניה|חברה/.test(typeText)) {
    return MARKET_INSTRUMENT_CLASS.STOCK;
  }
  if (/\b(index|indices|benchmark|volatility|commodity|crypto|currency|forex|bond|treasury|yield|future|rate|etf|fund)\b|מדד|תנודתיות|סחורה|קריפטו|מטבע|אג[״"']?ח|תשואה|קרן סל/.test(typeText)) {
    return MARKET_INSTRUMENT_CLASS.MARKET;
  }
  return MARKET_INSTRUMENT_CLASS.UNKNOWN;
}

export function classifyMarketInstrument(value, fallback = '') {
  const identity = getMarketInstrumentIdentity(value, fallback);
  if (!identity) return MARKET_INSTRUMENT_CLASS.UNKNOWN;
  if (BROAD_MARKET_BY_ALIAS.has(identity)) return MARKET_INSTRUMENT_CLASS.MARKET;

  const explicitClass = classifyExplicitType(value);
  if (explicitClass !== MARKET_INSTRUMENT_CLASS.UNKNOWN) return explicitClass;

  return /^[A-Z][A-Z0-9.]{0,5}$/.test(identity)
    ? MARKET_INSTRUMENT_CLASS.STOCK
    : MARKET_INSTRUMENT_CLASS.UNKNOWN;
}
