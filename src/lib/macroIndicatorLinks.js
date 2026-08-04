/**
 * Macro indicator link resolver — explicit official sources first, then the
 * approved Investing Israel destinations for known market instruments.
 *
 * Priority chain:
 *   1. OFFICIAL_SOURCE_MAP — exact approved BLS / Federal Reserve destinations
 *   2. INVESTING_IL_MAP — exact approved market-instrument destinations
 *   3. Unknown labels remain plain text (no generated search URL)
 *
 * Legacy FRED/MACRO_INDICATOR_LINKS retained below for reference only.
 */

// ── Noise-stripping ──────────────────────────────────────────────────────────

/** Strip leading/trailing arrows, bullets, and whitespace from AI output. */
function _clean(text) {
  return String(text || '')
    .replace(/[↑↓→←⬆⬇▲▼•~↑↓]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _norm(text) {
  return _clean(text).toLowerCase();
}

/** Extract parenthetical content: "מדד הפחד (VIX)" → "vix" */
function _parenContent(text) {
  const m = _norm(text).match(/\(([^)]+)\)/);
  return m ? m[1].trim() : null;
}

/** Strip parenthetical from normalized text: "vix (vix)" → "vix" */
function _stripParens(norm) {
  return norm.replace(/\s*\([^)]*\)/g, '').trim();
}

// ── il.investing.com URL map ─────────────────────────────────────────────────

const IL = 'https://il.investing.com';

const OFFICIAL_SOURCE_MAP = [
  {
    kind: 'bls',
    label: 'BLS',
    url: 'https://www.bls.gov/cpi/',
    aliases: ['cpi', 'us cpi', 'consumer price index', 'מדד המחירים לצרכן', 'cpi ליבה', 'core cpi'],
  },
  {
    kind: 'bls',
    label: 'BLS',
    url: 'https://www.bls.gov/ppi/',
    aliases: ['ppi', 'us ppi', 'producer price index', 'מדד המחירים ליצרן'],
  },
  {
    kind: 'bls',
    label: 'BLS',
    url: 'https://www.bls.gov/news.release/empsit.htm',
    aliases: ['nfp', 'nonfarm payrolls', 'jobs report', 'employment situation', 'unemployment rate', 'דוח התעסוקה', 'שיעור האבטלה'],
  },
  {
    kind: 'federal-reserve',
    label: 'Federal Reserve',
    url: 'https://www.federalreserve.gov/monetarypolicy/fomc.htm',
    aliases: ['fed', 'fomc', 'federal reserve', 'fed policy', 'fed rate decision', 'הפד', 'ריבית הפד', 'החלטת הריבית של הפד'],
  },
  {
    kind: 'federal-reserve',
    label: 'Federal Reserve',
    url: 'https://www.federalreserve.gov/monetarypolicy.htm',
    aliases: ['federal reserve inflation target', 'fed inflation target', 'יעד האינפלציה של הפד'],
  },
];

const INVESTING_IL_MAP = [
  // ── Volatility / Fear ──────────────────────────────────────────────────
  {
    url: `${IL}/indices/volatility-s-p-500`,
    aliases: [
      'vix', 'volatility', 'fear index', 'fear & greed index', 'cboe vix',
      'מדד הפחד', 'פחד', 'תנודתיות',
    ],
  },
  // ── Dollar ─────────────────────────────────────────────────────────────
  {
    url: `${IL}/indices/usdollar`,
    aliases: [
      'dxy', 'usdx', 'dollar index', 'us dollar index', 'dollar',
      'מדד הדולר', 'הדולר', 'דולר',
    ],
  },
  // ── US Equity Indices ──────────────────────────────────────────────────
  {
    url: `${IL}/indices/us-spx-500`,
    aliases: [
      's&p 500', 'spx', 'sp500', 's&p500', 'spy', 'us 500', 'us500',
      's&p', 'es', 'snp',
    ],
  },
  {
    url: `${IL}/indices/nq-100`,
    aliases: [
      'nasdaq 100', 'ndx', 'qqq', 'nq-100', 'nq100', 'nasdaq100',
      'נאסד"ק 100', 'נאסדק 100',
    ],
  },
  {
    url: `${IL}/indices/nasdaq-composite`,
    aliases: [
      'nasdaq', 'nasdaq composite', 'ixic', 'comp',
      'נאסד"ק', 'נאסדק',
    ],
  },
  {
    url: `${IL}/indices/us-30`,
    aliases: [
      'dow jones', 'dow', 'djia', 'us 30', 'us30', 'dia',
      'דאו ג\'ונס', 'דאו',
    ],
  },
  {
    url: `${IL}/indices/smallcap-2000`,
    aliases: [
      'russell 2000', 'rut', 'small cap 2000', 'smallcap 2000', 'iwm',
      'ראסל 2000', 'ראסל',
    ],
  },
  // ── Crypto ─────────────────────────────────────────────────────────────
  {
    url: `${IL}/crypto/bitcoin/btc`,
    aliases: [
      'bitcoin', 'btc', 'btcusd', 'btc/usd', 'xbt',
      'ביטקוין', 'ביטקויין',
    ],
  },
  {
    url: `${IL}/crypto/ethereum/eth-usd`,
    aliases: [
      'ethereum', 'eth', 'ethusd', 'eth/usd',
      'אתריום', 'אתר',
    ],
  },
  // ── Energy / Oil ───────────────────────────────────────────────────────
  {
    url: `${IL}/commodities/crude-oil`,
    aliases: [
      'crude oil', 'crude oil / fuel', 'oil / fuel', 'oil & gas',
      'wti', 'wti crude', 'oil', 'crude', 'fuel', 'energy prices',
      'נפט גולמי', 'נפט', 'אנרגיה',
    ],
  },
  {
    url: `${IL}/commodities/brent-oil`,
    aliases: [
      'brent', 'brent oil', 'brent crude', 'brn', 'ukbrent',
    ],
  },
  {
    url: `${IL}/commodities/natural-gas`,
    aliases: [
      'natural gas', 'nat gas', 'natgas', 'ng',
      'גז טבעי', 'גז',
    ],
  },
  // ── Precious Metals ────────────────────────────────────────────────────
  {
    url: `${IL}/commodities/gold`,
    aliases: [
      'gold', 'xau', 'xau/usd', 'xauusd', 'gld',
      'זהב',
    ],
  },
  {
    url: `${IL}/commodities/silver`,
    aliases: [
      'silver', 'xag', 'xag/usd', 'xagusd', 'slv',
      'כסף',
    ],
  },
  {
    url: `${IL}/commodities/copper`,
    aliases: [
      'copper', 'hg', 'copper futures',
      'נחושת',
    ],
  },
  // ── Bonds / Yields ─────────────────────────────────────────────────────
  {
    url: `${IL}/rates-bonds/u.s.-10-year-bond-yield`,
    aliases: [
      'us yields', 'us10y', '10y', '10 year yield', '10yr yield',
      '10yr', 'ten year yield', 'us 10 year', '10 year treasury',
      'treasury yield', 'treasury yields', 'yields', 'bond yields',
      'bonds yield', 'us treasury', 'us treasury yields', 'tlt',
      'תשואות', 'תשואת 10 שנים', 'אג"ח 10 שנים', 'אגח 10 שנים',
      'תשואות ארה"ב', 'אגח', 'אג"ח',
    ],
  },
  {
    url: `${IL}/rates-bonds/u.s.-2-year-bond-yield`,
    aliases: [
      'us2y', '2y', '2 year yield', '2yr yield', '2yr', 'us 2 year',
      'תשואת 2 שנים', 'אג"ח 2 שנים',
    ],
  },
  {
    url: `${IL}/rates-bonds/u.s.-5-year-bond-yield`,
    aliases: [
      'us5y', '5y', '5 year yield', '5yr yield', '5yr', 'us 5 year',
      'תשואת 5 שנים',
    ],
  },
  {
    url: `${IL}/rates-bonds/u.s.-30-year-bond-yield`,
    aliases: [
      'us30y', '30y', '30 year yield', '30yr yield', '30yr', 'us 30 year',
      'תשואת 30 שנים',
    ],
  },
  // ── Currencies ─────────────────────────────────────────────────────────
  {
    url: `${IL}/currencies/eur-usd`,
    aliases: [
      'eur/usd', 'eurusd', 'euro dollar', 'euro', 'eur',
      'אירו',
    ],
  },
  {
    url: `${IL}/currencies/usd-ils`,
    aliases: [
      'usd/ils', 'usdils', 'dollar shekel', 'dollar/shekel',
      'דולר שקל', 'שקל דולר',
    ],
  },
  {
    url: `${IL}/currencies/usd-jpy`,
    aliases: [
      'usd/jpy', 'usdjpy', 'dollar yen', 'yen',
      'יין', 'יין יפני',
    ],
  },
];

// Pre-normalize all aliases at module init
const _IL_NORMALIZED = INVESTING_IL_MAP.map((entry) => ({
  ...entry,
  _aliases: entry.aliases.map((a) => String(a).trim().toLowerCase()),
}));

const _OFFICIAL_NORMALIZED = OFFICIAL_SOURCE_MAP.map((entry) => ({
  ...entry,
  _aliases: entry.aliases.map((alias) => _norm(alias)),
}));

const APPROVED_SOURCE_HOSTS = new Set([
  'www.bls.gov',
  'bls.gov',
  'www.federalreserve.gov',
  'federalreserve.gov',
  'il.investing.com',
]);

// ── Exported helpers ─────────────────────────────────────────────────────────

/**
 * Legacy utility for callers that explicitly request an Investing search URL.
 * The Macro renderer and canonical destination resolver never use it as a fallback.
 */
export function buildInvestingSearchUrl(input) {
  const clean = _clean(input);
  return `${IL}/search/?q=${encodeURIComponent(clean)}`;
}

/** Only explicit approved source URLs may be retained from payload data. */
export function sanitizeMacroSourceUrl(input) {
  const raw = String(input || '').trim();
  if (!/^https:\/\//i.test(raw)) return '';
  try {
    const parsed = new URL(raw);
    if (!APPROVED_SOURCE_HOSTS.has(parsed.hostname.toLowerCase())) return '';
    if (parsed.username || parsed.password) return '';
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/token|secret|password|auth|api.?key/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Tries to match indicator text to a known il.investing.com page.
 * Returns the specific URL or null (no fallback here).
 */
export function hasKnownMacroIndicatorLink(input) {
  return _resolveKnown(input) !== null;
}

function _resolveKnown(input) {
  if (!input) return null;
  const raw = _norm(input);
  if (!raw) return null;

  const stripped = _stripParens(raw);
  const paren = _parenContent(raw);

  const candidates = [raw, stripped];
  if (paren) candidates.push(paren);

  for (const entry of _IL_NORMALIZED) {
    for (const alias of entry._aliases) {
      for (const candidate of candidates) {
        if (candidate === alias) return entry.url;
      }
    }
  }
  return null;
}

/**
 * Resolves an explicit known market indicator to its approved Investing Israel URL.
 * Unknown labels remain unlinked.
 */
export function resolveMacroIndicatorInvestingUrl(input) {
  return _resolveKnown(input);
}

export function getMacroIndicatorDestination(indicator) {
  const normalized = _norm(indicator);
  const stripped = _stripParens(normalized);
  const parenthetical = _parenContent(normalized);
  const candidates = [normalized, stripped, parenthetical].filter(Boolean);
  for (const entry of _OFFICIAL_NORMALIZED) {
    if (entry._aliases.some((alias) => candidates.includes(alias))) {
      return { url: entry.url, label: entry.label, kind: entry.kind };
    }
  }
  const investingUrl = _resolveKnown(indicator);
  return investingUrl ? { url: investingUrl, label: 'Investing Israel', kind: 'investing-israel' } : null;
}

/**
 * Primary entry point used by MacroSection rendering.
 * Returns null for unknown labels instead of inventing a destination.
 */
export function getMacroIndicatorUrl(indicator) {
  if (!indicator) return null;
  return getMacroIndicatorDestination(indicator)?.url || null;
}

// ── Legacy FRED reference map (not used for links, kept for documentation) ───
// These were the original FRED data source URLs; retained for reference.
const _FRED = 'https://fred.stlouisfed.org/series/';
export const MACRO_INDICATOR_FRED_REFS = {
  pce:           `${_FRED}PCEPI`,
  cpi:           `${_FRED}CPIAUCSL`,
  core_cpi:      `${_FRED}CPILFESL`,
  ppi:           `${_FRED}PPIACO`,
  gdp:           `${_FRED}GDP`,
  nfp:           `${_FRED}PAYEMS`,
  unemployment:  `${_FRED}UNRATE`,
  jobless:       `${_FRED}ICSA`,
  fed_funds:     `${_FRED}FEDFUNDS`,
  treasury_10y:  `${_FRED}DGS10`,
  treasury_2y:   `${_FRED}DGS2`,
  yield_curve:   `${_FRED}T10Y2Y`,
  housing:       `${_FRED}HOUST`,
  retail_sales:  `${_FRED}RSXFS`,
  consumer_conf: `${_FRED}UMCSENT`,
  trade_balance: `${_FRED}BOPGSTB`,
  credit_spreads:`${_FRED}BAMLH0A0HYM2`,
};
