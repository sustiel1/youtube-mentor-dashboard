const FINVIZ_BASE = 'https://finviz.com/quote.ashx?t=';

// Named index expressions → ETF proxy (stored lowercase for case-insensitive lookup)
const _INDEX_MAP = new Map([
  // NASDAQ
  ['nasdaq', 'QQQ'], ['nasdaq 100', 'QQQ'], ['nasdaq composite', 'QQQ'], ['ndx', 'QQQ'],
  // S&P 500
  ['s&p 500', 'SPY'], ['s&p500', 'SPY'], ['sp500', 'SPY'], ['spx', 'SPY'],
  // Dow Jones
  ['dow jones', 'DIA'], ['dow', 'DIA'], ['djia', 'DIA'],
  // Russell
  ['russell 2000', 'IWM'], ['russell', 'IWM'], ['rty', 'IWM'],
  // Commodities
  ['gold', 'GLD'], ['silver', 'SLV'], ['oil', 'XLE'],
  ['bonds', 'TLT'], ['treasuries', 'TLT'],
  // Common aliases
  ['big tech', 'QQQ'], ['defense', 'ITA'],
  // Hebrew
  ['זהב', 'GLD'], ['כסף', 'SLV'], ['נפט', 'USO'],
]);

// Central sector/market name → { etf, he? } mapping.
// English entries are looked up case-insensitively.
// Hebrew entries are matched by exact trimmed string.
const _SECTOR_ENTRIES = [
  // ── English GICS sectors + common aliases ──────────────────────────────────
  ['Materials',                               { etf: 'XLB',  he: 'חומרי גלם' }],
  ['Basic Materials',                         { etf: 'XLB',  he: 'חומרי גלם' }],
  ['Consumer Staples',                        { etf: 'XLP',  he: 'צריכה בסיסית' }],
  ['Consumer Defensive',                      { etf: 'XLP',  he: 'צריכה בסיסית' }],
  ['Staples',                                 { etf: 'XLP',  he: 'צריכה בסיסית' }],
  ['Technology',                              { etf: 'XLK',  he: 'טכנולוגיה' }],
  ['Tech',                                    { etf: 'XLK',  he: 'טכנולוגיה' }],
  ['Technology / Mega Caps',                  { etf: 'QQQ',  he: 'טכנולוגיה / מניות ענק' }],
  ['Software',                                { etf: 'IGV',  he: 'תוכנה' }],
  ['Semiconductors',                          { etf: 'SMH',  he: 'מוליכים למחצה' }],
  ['Semiconductors (SMH)',                    { etf: 'SMH',  he: 'מוליכים למחצה' }],
  ['Chips',                                   { etf: 'SMH',  he: 'מוליכים למחצה' }],
  ['Retail',                                  { etf: 'XRT',  he: 'קמעונאות' }],
  ['Airlines',                                { etf: 'JETS', he: 'חברות תעופה' }],
  ['Airlines (JETS)',                         { etf: 'JETS', he: 'חברות תעופה' }],
  ['Energy',                                  { etf: 'XLE',  he: 'אנרגיה' }],
  ['Oil & Gas',                               { etf: 'XLE',  he: 'נפט וגז' }],
  ['Oil and Gas',                             { etf: 'XLE',  he: 'נפט וגז' }],
  ['Solar',                                   { etf: 'TAN',  he: 'אנרגיה סולארית' }],
  ['Financials',                              { etf: 'XLF',  he: 'פיננסים' }],
  ['Finance',                                 { etf: 'XLF',  he: 'פיננסים' }],
  ['Financial',                               { etf: 'XLF',  he: 'פיננסים' }],
  ['Banks',                                   { etf: 'KRE',  he: 'בנקים אזוריים' }],
  ['Regional Banks',                          { etf: 'KRE',  he: 'בנקים אזוריים' }],
  ['Homebuilders',                            { etf: 'XHB',  he: 'קבלני בתים' }],
  ['REITs',                                   { etf: 'VNQ',  he: 'ריטים' }],
  ['Healthcare',                              { etf: 'XLV',  he: 'בריאות' }],
  ['Health Care',                             { etf: 'XLV',  he: 'בריאות' }],
  ['Biotech',                                 { etf: 'XBI',  he: 'ביוטק' }],
  ['Biotechnology',                           { etf: 'XBI',  he: 'ביוטק' }],
  ['Industrials',                             { etf: 'XLI',  he: 'תעשייה' }],
  ['Utilities',                               { etf: 'XLU',  he: 'תשתיות' }],
  ['Real Estate',                             { etf: 'XLRE', he: 'נדל"ן' }],
  ['Communication Services',                  { etf: 'XLC',  he: 'תקשורת' }],
  ['Communications',                          { etf: 'XLC',  he: 'תקשורת' }],
  ['Consumer Discretionary',                  { etf: 'XLY',  he: 'צריכה מחזורית' }],
  ['Discretionary',                           { etf: 'XLY',  he: 'צריכה מחזורית' }],
  ['Regional Banks / Homebuilders / REITs',   { etf: 'KRE',  he: 'בנקים אזוריים / קבלני בתים / ריטים' }],
  // ── Hebrew sector names ────────────────────────────────────────────────────
  ['פיננסים',           { etf: 'XLF'  }],
  ['פיננסיים',          { etf: 'XLF'  }],
  ['בנקים',             { etf: 'KRE'  }],
  ['בנקים אזוריים',     { etf: 'KRE'  }],
  ['טכנולוגיה',         { etf: 'XLK'  }],
  ['שבבים',             { etf: 'SMH'  }],
  ['סמיקונדקטורים',     { etf: 'SMH'  }],
  ['מוליכים למחצה',     { etf: 'SMH'  }],
  ['ביוטק',             { etf: 'XBI'  }],
  ['בריאות',            { etf: 'XLV'  }],
  ['אנרגיה',            { etf: 'XLE'  }],
  ['נפט וגז',           { etf: 'XLE'  }],
  ['תעשייה',            { etf: 'XLI'  }],
  ['חומרים',            { etf: 'XLB'  }],
  ['חומרי גלם',         { etf: 'XLB'  }],
  ['תשתיות',            { etf: 'XLU'  }],
  ['צרכנות מחזורית',    { etf: 'XLY'  }],
  ['צריכה מחזורית',     { etf: 'XLY'  }],
  ['צרכנות בסיסית',     { etf: 'XLP'  }],
  ['צריכה בסיסית',      { etf: 'XLP'  }],
  ['נדלן',              { etf: 'XLRE' }],
  ['נדל"ן',             { etf: 'XLRE' }],
  ['נדל״ן',        { etf: 'XLRE' }],
  ['תקשורת',            { etf: 'XLC'  }],
  ['קמעונאות',          { etf: 'XRT'  }],
  ['ריטים',             { etf: 'VNQ'  }],
  ['קבלני בתים',        { etf: 'XHB'  }],
  ['תוכנה',             { etf: 'IGV'  }],
  ['חברות תעופה',       { etf: 'JETS' }],
  ['אנרגיה סולארית',    { etf: 'TAN'  }],
];

const _HE_CHAR = /[֐-׿יִ-ﭏ]/;

function _norm(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Pre-built lookup maps
const _EN_MAP = new Map();
const _HE_MAP = new Map();

for (const [key, val] of _SECTOR_ENTRIES) {
  if (_HE_CHAR.test(key)) {
    _HE_MAP.set(key.trim(), val);
  } else {
    _EN_MAP.set(_norm(key), val);
  }
}

function _lookupByName(raw) {
  return _EN_MAP.get(_norm(raw)) || _HE_MAP.get(raw.trim()) || null;
}

/**
 * Resolves any market symbol / sector name to a Finviz-compatible ticker.
 * Returns the ticker string or null if no Finviz equivalent is known.
 *
 * Handles:
 *   Pure tickers           "AVGO", "SPY", "XLF"
 *   Ticker + description   "XBI (Biotech)" → "XBI"
 *   English sector names   "Consumer Discretionary" → "XLY"
 *   Hebrew sector names    "טכנולוגיה" → "XLK"
 *   Mixed "X / Y"          "Real Estate / הנדל״ן" → "XLRE"
 *   Unknown / Israeli      returns null
 */
export function resolveFinvizTicker(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  // Israeli indices have no Finviz page — exclude explicitly
  const upper = raw.toUpperCase();
  if (/^TA[-\s]/.test(upper) || upper === 'TA35' || upper === 'TA125') return null;

  // 1. Pure US ticker: 1–6 uppercase letters only (no hyphens, digits, spaces)
  if (/^[A-Z]{1,6}$/.test(raw)) return raw;

  // 2. Starts with ticker optionally followed by label in parens:
  //    "XBI (Biotech)", "XLF (Financials)", "XBI (BIOTECH)" after toUpperCase
  const headMatch = raw.match(/^([A-Z]{2,6})\s*\(.*\)$/);
  if (headMatch) return headMatch[1];

  // 3. Ticker in parens anywhere: "Biotech (XBI)", "Financials (XLF)"
  const parenMatch = raw.match(/\(([A-Z]{2,6})\)/);
  if (parenMatch) return parenMatch[1];

  // 4. "English / Hebrew" or "English / English" — try left side, then right
  const slashIdx = raw.indexOf(' / ');
  if (slashIdx > -1) {
    const left = raw.slice(0, slashIdx).trim();
    const right = raw.slice(slashIdx + 3).trim();
    const leftMeta = _lookupByName(left) || (/^[A-Z]{1,6}$/.test(left) ? { etf: left } : null);
    if (leftMeta) return leftMeta.etf;
    const rightMeta = _lookupByName(right);
    if (rightMeta) return rightMeta.etf;
  }

  // 5. Named index (NASDAQ, S&P 500, Dow Jones, Russell 2000, etc.)
  const indexTicker = _INDEX_MAP.get(_norm(raw));
  if (indexTicker) return indexTicker;

  // 6. Sector name lookup (English case-insensitive or Hebrew exact)
  const meta = _lookupByName(raw);
  if (meta) return meta.etf;

  return null;
}

/** Returns the full Finviz URL for the input, or null if not linkable. */
export function getFinvizUrl(input) {
  const ticker = resolveFinvizTicker(input);
  return ticker ? `${FINVIZ_BASE}${encodeURIComponent(ticker)}` : null;
}

// Fallback URLs for symbols not supported by Finviz (DXY, crypto, etc.)
const _FALLBACK_URL_MAP = new Map([
  ['dxy',               'https://www.tradingview.com/chart/?symbol=TVC:DXY'],
  ['usdx',              'https://www.tradingview.com/chart/?symbol=TVC:DXY'],
  ['us dollar index',   'https://www.tradingview.com/chart/?symbol=TVC:DXY'],
  ['dollar index',      'https://www.tradingview.com/chart/?symbol=TVC:DXY'],
  ['מדד הדולר',         'https://www.tradingview.com/chart/?symbol=TVC:DXY'],
  ['btc',               'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT'],
  ['bitcoin',           'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT'],
  ['btcusd',            'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT'],
  ['ביטקוין',           'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT'],
  ['eth',               'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT'],
  ['ethereum',          'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT'],
  ['אתריום',            'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT'],
  ['vix',               'https://www.tradingview.com/chart/?symbol=TVC:VIX'],
  ['fear & greed',      'https://edition.cnn.com/markets/fear-and-greed'],
  ['fear and greed',    'https://edition.cnn.com/markets/fear-and-greed'],
]);

/**
 * Resolves any market symbol to an external research URL.
 * Tries Finviz first; falls back to TradingView / CNN for DXY, VIX, crypto.
 * Returns null if no URL is known — never returns a broken link.
 */
export function getExternalSymbolUrl(input) {
  const finvizUrl = getFinvizUrl(input);
  if (finvizUrl) return finvizUrl;
  const key = _norm(input);
  return _FALLBACK_URL_MAP.get(key) ?? null;
}

/** Returns true if the input resolves to a known Finviz-linkable symbol. */
export function isFinvizLinkable(input) {
  return resolveFinvizTicker(input) !== null;
}

/** Semantic alias for resolveFinvizTicker. */
export function normalizeMarketSymbol(input) {
  return resolveFinvizTicker(input);
}

/** Returns a generic TradingView chart URL for any symbol string. Never returns null. */
export function buildTradingViewUrl(symbol) {
  const s = String(symbol || '').trim();
  if (!s) return 'https://www.tradingview.com/chart/';
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(s)}`;
}

// Personal TradingView chart base URL (user's saved chart layout)
const _TV_CHART_BASE = 'https://il.tradingview.com/chart/54fxnDLz/';

// Exchange map: ticker → exchange prefix used by TradingView
// TradingView uses AMEX for NYSE Arca-listed ETFs.
const _TV_EXCHANGE_MAP = new Map([
  // ── NASDAQ large caps ──────────────────────────────────────────────
  ['MSFT', 'NASDAQ'], ['AAPL', 'NASDAQ'], ['NVDA', 'NASDAQ'], ['TSLA', 'NASDAQ'],
  ['GOOGL', 'NASDAQ'], ['GOOG', 'NASDAQ'], ['META', 'NASDAQ'], ['AMZN', 'NASDAQ'],
  ['NFLX', 'NASDAQ'], ['COST', 'NASDAQ'], ['AVGO', 'NASDAQ'], ['AMD', 'NASDAQ'],
  ['INTC', 'NASDAQ'], ['QCOM', 'NASDAQ'], ['TXN', 'NASDAQ'], ['AMAT', 'NASDAQ'],
  ['LRCX', 'NASDAQ'], ['KLAC', 'NASDAQ'], ['ADI', 'NASDAQ'], ['MU', 'NASDAQ'],
  ['ASML', 'NASDAQ'], ['MRVL', 'NASDAQ'], ['MCHP', 'NASDAQ'], ['MPWR', 'NASDAQ'],
  ['PANW', 'NASDAQ'], ['CRWD', 'NASDAQ'], ['ZS', 'NASDAQ'], ['NET', 'NASDAQ'],
  ['DDOG', 'NASDAQ'], ['SNOW', 'NASDAQ'], ['OKTA', 'NASDAQ'], ['FTNT', 'NASDAQ'],
  ['CRM', 'NASDAQ'], ['ADBE', 'NASDAQ'], ['NOW', 'NASDAQ'], ['INTU', 'NASDAQ'],
  ['ADP', 'NASDAQ'], ['ISRG', 'NASDAQ'], ['GILD', 'NASDAQ'], ['BIIB', 'NASDAQ'],
  ['REGN', 'NASDAQ'], ['MELI', 'NASDAQ'], ['PYPL', 'NASDAQ'], ['CSCO', 'NASDAQ'],
  ['SMH', 'NASDAQ'], ['QQQ', 'NASDAQ'], ['TLT', 'NASDAQ'],
  // ── NYSE large caps ────────────────────────────────────────────────
  ['JPM', 'NYSE'], ['BAC', 'NYSE'], ['GS', 'NYSE'], ['MS', 'NYSE'],
  ['WFC', 'NYSE'], ['C', 'NYSE'], ['BLK', 'NYSE'], ['AXP', 'NYSE'],
  ['V', 'NYSE'], ['MA', 'NYSE'], ['BRK.B', 'NYSE'], ['BRK.A', 'NYSE'],
  ['XOM', 'NYSE'], ['CVX', 'NYSE'], ['COP', 'NYSE'], ['EOG', 'NYSE'],
  ['WMT', 'NYSE'], ['PG', 'NYSE'], ['KO', 'NYSE'], ['PEP', 'NYSE'],
  ['MCD', 'NYSE'], ['NKE', 'NYSE'], ['SBUX', 'NYSE'], ['HD', 'NYSE'],
  ['JNJ', 'NYSE'], ['LLY', 'NYSE'], ['PFE', 'NYSE'], ['MRK', 'NYSE'],
  ['ABT', 'NYSE'], ['UNH', 'NYSE'], ['MDT', 'NYSE'], ['BMY', 'NYSE'],
  ['BA', 'NYSE'], ['CAT', 'NYSE'], ['GE', 'NYSE'], ['RTX', 'NYSE'],
  ['HON', 'NYSE'], ['MMM', 'NYSE'], ['IBM', 'NYSE'], ['ORCL', 'NYSE'],
  ['DELL', 'NYSE'], ['BABA', 'NYSE'], ['FDX', 'NYSE'], ['GIS', 'NYSE'],
  ['PGR', 'NYSE'], ['ALL', 'NYSE'], ['CB', 'NYSE'], ['TRV', 'NYSE'],
  // ── NYSE Arca ETFs (TradingView: AMEX) ─────────────────────────────
  ['SPY', 'AMEX'], ['IWM', 'AMEX'], ['DIA', 'AMEX'],
  ['GLD', 'AMEX'], ['SLV', 'AMEX'], ['USO', 'AMEX'],
  ['XLK', 'AMEX'], ['XLF', 'AMEX'], ['XLE', 'AMEX'], ['XLV', 'AMEX'],
  ['XLI', 'AMEX'], ['XLB', 'AMEX'], ['XLU', 'AMEX'], ['XLY', 'AMEX'],
  ['XLP', 'AMEX'], ['XLC', 'AMEX'], ['XLRE', 'AMEX'],
  ['XBI', 'AMEX'], ['XRT', 'AMEX'], ['XHB', 'AMEX'],
  ['VNQ', 'AMEX'], ['JETS', 'AMEX'], ['TAN', 'AMEX'], ['ITA', 'AMEX'],
  ['KRE', 'AMEX'], ['IGV', 'AMEX'],
]);

// Normalize a raw symbol/name for TradingView alias lookup.
// Trims, uppercases (English only — Hebrew is unchanged by toUpperCase),
// normalizes internal whitespace, and standardizes slash spacing.
function _normTv(s) {
  return String(s || '').trim().toUpperCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ');
}

// Unified alias map: crypto, macro, commodities, indices, sector ETF proxies.
// English keys: UPPERCASE. Hebrew keys: exact (toUpperCase is a no-op on Hebrew).
// All lookups go through _normTv() so slash / space variants are normalized.
const _TV_ALIAS_MAP = new Map([
  // ── Crypto ───────────────────────────────────────────────────────────────
  ['BTC',                    'BITSTAMP:BTCUSD'],
  ['BITCOIN',                'BITSTAMP:BTCUSD'],
  ['BTCUSD',                 'BITSTAMP:BTCUSD'],
  ['CRYPTO',                 'BITSTAMP:BTCUSD'],
  ['ביטקוין',                'BITSTAMP:BTCUSD'],
  ['ETH',                    'BITSTAMP:ETHUSD'],
  ['ETHEREUM',               'BITSTAMP:ETHUSD'],
  ['ETHUSD',                 'BITSTAMP:ETHUSD'],
  ['אתריום',                 'BITSTAMP:ETHUSD'],
  // ── DXY / Dollar ─────────────────────────────────────────────────────────
  ['DXY',                    'TVC:DXY'],
  ['USDX',                   'TVC:DXY'],
  ['US DOLLAR',              'TVC:DXY'],
  ['US DOLLAR INDEX',        'TVC:DXY'],
  ['DOLLAR INDEX',           'TVC:DXY'],
  ['מדד הדולר',              'TVC:DXY'],
  // ── VIX / Risk-off ───────────────────────────────────────────────────────
  ['VIX',                    'TVC:VIX'],
  ['RISK-OFF',               'TVC:VIX'],
  // ── Yields / Macro rates ─────────────────────────────────────────────────
  ['US10Y',                  'TVC:US10Y'],
  ['10Y',                    'TVC:US10Y'],
  ['10 YEAR',                'TVC:US10Y'],
  ['YIELDS',                 'TVC:US10Y'],
  ['INTEREST RATES',         'TVC:US10Y'],
  ['FED FUNDS',              'TVC:US10Y'],
  ['INFLATION',              'TVC:US10Y'],
  ['PCE',                    'TVC:US10Y'],
  ['PCE INFLATION',          'TVC:US10Y'],
  ['אינפלציה',               'TVC:US10Y'],
  ['אינפלציית PCE',          'TVC:US10Y'],
  // ── Gold ─────────────────────────────────────────────────────────────────
  ['GOLD',                   'TVC:GOLD'],
  ['XAUUSD',                 'TVC:GOLD'],
  ['זהב',                    'TVC:GOLD'],
  // ── Silver ───────────────────────────────────────────────────────────────
  ['SILVER',                 'TVC:SILVER'],
  ['XAGUSD',                 'TVC:SILVER'],
  ['כסף',                    'TVC:SILVER'],
  // ── Crude Oil ────────────────────────────────────────────────────────────
  ['OIL',                    'TVC:USOIL'],
  ['WTI',                    'TVC:USOIL'],
  ['USOIL',                  'TVC:USOIL'],
  ['CRUDE OIL',              'TVC:USOIL'],
  ['CRUDE',                  'TVC:USOIL'],
  ['FUEL',                   'TVC:USOIL'],
  ['CRUDE OIL / FUEL',       'TVC:USOIL'],
  ['נפט',                    'TVC:USOIL'],
  ['נפט גולמי',              'TVC:USOIL'],
  ['נפט גולמי / דלק',       'TVC:USOIL'],
  ['דלק',                    'TVC:USOIL'],
  // ── Brent ────────────────────────────────────────────────────────────────
  ['BRENT',                  'TVC:UKOIL'],
  ['BRENT OIL',              'TVC:UKOIL'],
  // ── Natural Gas ──────────────────────────────────────────────────────────
  ['NATURAL GAS',            'TVC:NATGAS'],
  ['NATGAS',                 'TVC:NATGAS'],
  ['גז טבעי',                'TVC:NATGAS'],
  // ── Copper ───────────────────────────────────────────────────────────────
  ['COPPER',                 'COMEX:HG1!'],
  ['נחושת',                  'COMEX:HG1!'],
  // ── US Indices ───────────────────────────────────────────────────────────
  ['NASDAQ',                 'NASDAQ:IXIC'],
  ['NASDAQ COMPOSITE',       'NASDAQ:IXIC'],
  ['NASDAQ 100',             'NASDAQ:NDX'],
  ['NDX',                    'NASDAQ:NDX'],
  ['S&P 500',                'SP:SPX'],
  ['S&P500',                 'SP:SPX'],
  ['SP500',                  'SP:SPX'],
  ['SPX',                    'SP:SPX'],
  ['DOW JONES',              'DJ:DJI'],
  ['DOW',                    'DJ:DJI'],
  ['DJIA',                   'DJ:DJI'],
  ['RUSSELL 2000',           'TVC:RUT'],
  ['RUSSELL',                'TVC:RUT'],
  ['RTY',                    'TVC:RUT'],
  // ── Global Indices ───────────────────────────────────────────────────────
  ['KOSPI',                  'KRX:KOSPI'],
  ['SOUTH KOREAN KOSPI',     'KRX:KOSPI'],
  ['NIKKEI',                 'TVC:NI225'],
  ['NIKKEI 225',             'TVC:NI225'],
  ['HANG SENG',              'TVC:HSI'],
  ['DAX',                    'XETR:DAX'],
  ['FTSE',                   'TVC:UKX'],
  ['FTSE 100',               'TVC:UKX'],
  // ── Sector ETF proxies (AMEX = NYSE Arca) ────────────────────────────────
  ['TECHNOLOGY',             'AMEX:XLK'],
  ['TECH',                   'AMEX:XLK'],
  ['טכנולוגיה',              'AMEX:XLK'],
  ['HEALTHCARE',             'AMEX:XLV'],
  ['HEALTH CARE',            'AMEX:XLV'],
  ['בריאות',                 'AMEX:XLV'],
  ['FINANCIALS',             'AMEX:XLF'],
  ['FINANCE',                'AMEX:XLF'],
  ['פיננסים',                'AMEX:XLF'],
  ['ENERGY',                 'AMEX:XLE'],
  ['אנרגיה',                 'AMEX:XLE'],
  ['UTILITIES',              'AMEX:XLU'],
  ['תשתיות',                 'AMEX:XLU'],
  ['תשתיות / חשמל',          'AMEX:XLU'],
  ['REAL ESTATE',            'AMEX:XLRE'],
  ['REAL ESTATE SECTOR',     'AMEX:XLRE'],
  ['נדל"ן',                  'AMEX:XLRE'],
  ['נדלן',                   'AMEX:XLRE'],
  ['HOUSING',                'AMEX:XHB'],
  ['US HOUSING MARKET',      'AMEX:XLRE'],
  ['שוק הדיור בארה"ב',      'AMEX:XLRE'],
  ['SEMICONDUCTORS',         'NASDAQ:SMH'],
  ['CHIPS',                  'NASDAQ:SMH'],
  ['שבבים',                  'NASDAQ:SMH'],
  ['מוליכים למחצה',          'NASDAQ:SMH'],
  ['BIOTECH',                'AMEX:XBI'],
  ['BIOTECHNOLOGY',          'AMEX:XBI'],
  ['ביוטק',                  'AMEX:XBI'],
  ['SMALL CAPS',             'AMEX:IWM'],
  ['SMALL CAP',              'AMEX:IWM'],
  ['מניות קטנות',             'AMEX:IWM'],
  ['INDUSTRIALS',            'AMEX:XLI'],
  ['תעשייה',                 'AMEX:XLI'],
  ['CONSUMER DISCRETIONARY', 'AMEX:XLY'],
  ['צריכה מחזורית',          'AMEX:XLY'],
  ['CONSUMER STAPLES',       'AMEX:XLP'],
  ['צריכה בסיסית',           'AMEX:XLP'],
  ['MATERIALS',              'AMEX:XLB'],
  ['חומרי גלם',              'AMEX:XLB'],
  // ── Sentiment proxies ────────────────────────────────────────────────────
  ['MARKET SENTIMENT',       'SP:SPX'],
  ['סנטימנט כללי',           'SP:SPX'],
  ['RISK-ON',                'SP:SPX'],
  // ── Big Tech ─────────────────────────────────────────────────────────────
  ['BIG TECH',               'NASDAQ:QQQ'],
]);

/**
 * Resolves a market name/symbol to a TradingView qualified symbol string.
 * Returns the resolved symbol (e.g. "TVC:USOIL") or null if unknown.
 * Use this to check if a name is resolvable before building a URL.
 */
export function lookupTradingViewSymbol(name) {
  if (!name) return null;
  return _TV_ALIAS_MAP.get(_normTv(name)) || null;
}

/**
 * Builds a TradingView chart URL using the user's personal chart layout.
 * Lookup order: alias map (indices/crypto/commodities/macro/sectors/Hebrew) →
 *               exchange map (known stocks/ETFs) → NASDAQ fallback for short tickers.
 * Returns the base chart URL if no symbol provided.
 */
export function buildTradingViewChartUrl(symbol) {
  if (!symbol) return _TV_CHART_BASE;
  const s = _normTv(symbol);
  if (!s) return _TV_CHART_BASE;

  // 1. Named aliases: indices, crypto, commodities, macro proxies, sectors, Hebrew
  const alias = _TV_ALIAS_MAP.get(s);
  if (alias) return `${_TV_CHART_BASE}?symbol=${encodeURIComponent(alias)}`;

  // 2. Stock/ETF ticker with known exchange
  const exchange = _TV_EXCHANGE_MAP.get(s);
  if (exchange) return `${_TV_CHART_BASE}?symbol=${encodeURIComponent(`${exchange}:${s}`)}`;

  // 3. Unknown short ticker — assume NASDAQ (only for pure A-Z, 1-6 chars)
  return `${_TV_CHART_BASE}?symbol=${encodeURIComponent(`NASDAQ:${s}`)}`;
}

/**
 * Resolves a sector / market name to display metadata: { etf, he, finvizUrl }.
 * Used by getSectorMeta in MorningBriefVisualPrimitives.
 * Returns null if no mapping is found.
 */
export function resolveSectorMeta(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;

  function _build(etf, he) {
    return { etf, he: he ?? null, finvizUrl: `${FINVIZ_BASE}${encodeURIComponent(etf)}` };
  }

  // Direct lookup (English or Hebrew)
  const direct = _lookupByName(raw);
  if (direct) return _build(direct.etf, direct.he);

  // Starts with ticker + optional label: "XBI (Biotech)", "XLF (Financials)"
  const headMatch = raw.match(/^([A-Z]{2,5})\s*\(.*\)$/);
  if (headMatch) {
    const etf = headMatch[1];
    const baseName = raw.replace(/\s*\(.*\)\s*/g, '').trim();
    const base = _lookupByName(baseName);
    return _build(etf, base?.he);
  }

  // Ticker in parens: "Biotech (XBI)"
  const parenMatch = raw.match(/\(([A-Z]{2,5})\)/);
  if (parenMatch) {
    const etf = parenMatch[1];
    const baseName = raw.replace(/\s*\([^)]+\)\s*/g, '').trim();
    const base = _lookupByName(baseName);
    return _build(etf, base?.he);
  }

  // "English / Hebrew" — try left side
  const slashIdx = raw.indexOf(' / ');
  if (slashIdx > -1) {
    const left = raw.slice(0, slashIdx).trim();
    const leftMeta = _lookupByName(left);
    if (leftMeta) return _build(leftMeta.etf, leftMeta.he);
  }

  return null;
}

/** Perplexity deep-link: top-10 ETF holdings analysis for a sector ETF ticker. */
export function buildPerplexityEtfHoldingsUrl(symbol) {
  if (!symbol) return null;
  const q = `נתח את קרן ${symbol}.\n\nהצג:\n1. 10 האחזקות הגדולות ביותר לפי משקל\n2. שם החברה\n3. סימבול\n4. משקל בקרן באחוזים\n5. אילו מניות מובילות את ביצועי הקרן\n6. אילו מניות מהוות סיכון לקרן\n7. האם הקרן במומנטום חיובי, ניטרלי או שלילי\n8. סיכום קצר למשקיע סווינג\n\nענה בעברית ובטבלה מסודרת.`;
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`;
}

/**
 * Resolves a sector label to { ticker, url } for Finviz + holdings links.
 * Handles bare tickers, "ETF (Name)", English/Hebrew sector names.
 */
export function resolveSectorFinvizLink(sectorStr) {
  const str = String(sectorStr || '').trim();
  if (!str) return null;

  const headTicker = str.match(/^([A-Z]{2,6})(?:\s*\(.*\))?$/)?.[1];
  if (headTicker) {
    const url = getFinvizUrl(headTicker);
    return url ? { ticker: headTicker, url } : null;
  }

  const ticker = resolveFinvizTicker(str);
  if (ticker) {
    const url = getFinvizUrl(ticker);
    return url ? { ticker, url } : null;
  }

  return null;
}
