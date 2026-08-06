/**
 * Macro indicator link resolver — il.investing.com primary.
 *
 * Approved destinations come from INVESTING_IL_MAP or the structured
 * rate-concept resolver. Unknown concepts remain unlinked.
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
const FED_RATE_MONITOR_URL = `${IL}/central-banks/fed-rate-monitor`;
const US_RATE_DECISION_URL = `${IL}/economic-calendar/interest-rate-decision-168`;
const US_10Y_YIELD_URL = `${IL}/rates-bonds/u.s.-10-year-bond-yield`;

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
    url: US_10Y_YIELD_URL,
    aliases: [
      'bonds10y', 'tnx', 'us yields', 'us10y', '10y', '10 year yield', '10yr yield',
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

// ── Exported helpers ─────────────────────────────────────────────────────────

/**
 * Builds an il.investing.com search URL for any label.
 * Used as the fallback for unknown indicators.
 */
export function buildInvestingSearchUrl(input) {
  const clean = _clean(input);
  return `${IL}/search/?q=${encodeURIComponent(clean)}`;
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
        // Short exchange aliases such as "ES" must never fuzzy-match ordinary
        // words (for example, "interest rates").
        if (alias.length >= 3 && candidate.includes(alias)) return entry.url;
      }
    }
  }
  return null;
}

/**
 * Resolves an indicator name only when it has a known Investing Israel page.
 * Unknown indicators return null.
 */
export function resolveMacroIndicatorInvestingUrl(input) {
  return _resolveKnown(input);
}

function _resolveKnownExact(input) {
  if (!input) return null;
  const raw = _norm(input);
  if (!raw) return null;
  const candidates = [raw, _stripParens(raw), _parenContent(raw)].filter(Boolean);
  for (const entry of _IL_NORMALIZED) {
    if (entry._aliases.some((alias) => candidates.includes(alias))) return entry.url;
  }
  return null;
}

import { resolveCanonicalMacroIndicator } from '@/lib/macroIndicatorRegistry';

/**
 * Deterministic destination resolver for structured macro rows.
 * Unsupported or ambiguous concepts intentionally return null.
 */
export function getMacroIndicatorDestination(input) {
  const row = input && typeof input === 'object' ? input : { indicator: input };
  const canonicalDestination = resolveCanonicalMacroIndicator(row);
  if (canonicalDestination) return canonicalDestination;
  const indicator = _norm(row.indicator);
  if (!indicator) return null;
  const context = _norm([
    row.value,
    row.change,
    row.frequency,
    row.description,
    row.impact,
    row.sourceContext,
  ].filter(Boolean).join(' '));

  const isRateDecision = [
    'interest rate decision',
    'fed decision',
    'fomc decision',
    'החלטת הריבית',
    'החלטת הפד',
    'החלטת הריבית של הפד',
  ].some((phrase) => indicator.includes(phrase));
  if (isRateDecision) {
    return {
      url: US_RATE_DECISION_URL,
      provider: 'investing-israel',
      destinationType: 'investing-economic-event',
      labelHe: 'החלטת הריבית בארצות הברית',
      tooltipHe: 'פתח את אירוע החלטת הריבית בארצות הברית ב־Investing ישראל',
    };
  }

  const isTenYearYield = [
    'bonds10y',
    'us10y',
    'tnx',
    '10-year treasury yield',
    '10 year treasury yield',
    'תשואת אג"ח ל-10 שנים',
    'תשואת אג״ח ל־10 שנים',
  ].some((phrase) => indicator.includes(phrase));
  if (isTenYearYield) {
    return {
      url: US_10Y_YIELD_URL,
      provider: 'investing-israel',
      destinationType: 'investing-yield',
      labelHe: 'תשואת אג״ח ארצות הברית ל־10 שנים',
      tooltipHe: 'פתח את תשואת אג״ח ארצות הברית ל־10 שנים ב־Investing ישראל',
    };
  }

  const explicitFedRate = [
    'fed rate',
    'federal funds rate',
    'interest-rate expectations',
    'ציפיות ריבית',
    'ריבית הפד',
    'ריבית בארה"ב',
    'ריבית בארה״ב',
  ].some((phrase) => indicator.includes(phrase));
  const generalInterestRates = indicator === 'interest rates'
    || indicator === 'ריבית (interest rates)';
  const confirmsUsFedContext = [
    'fed',
    'fomc',
    'federal reserve',
    'united states',
    'u.s.',
    'us monetary',
    'הפד',
    'ארה"ב',
    'ארה״ב',
  ].some((phrase) => context.includes(phrase));
  if (explicitFedRate || (generalInterestRates && confirmsUsFedContext)) {
    return {
      url: FED_RATE_MONITOR_URL,
      provider: 'investing-israel',
      destinationType: 'macro-monitor',
      canonicalKey: 'FED_RATE_MONITOR',
      labelHe: 'כלי ניטור ריבית הפד',
      tooltipHe: 'פתח את כלי ניטור ריבית הפד ב־Investing ישראל',
      ariaLabelHe: 'פתח מידע וניתוח על ציפיות ריבית הפד באתר Investing ישראל',
    };
  }

  if (generalInterestRates || indicator === 'rates' || indicator === 'interest' || indicator === 'ריבית') {
    return null;
  }

  const knownUrl = _resolveKnownExact(row.indicator);
  return knownUrl ? {
    url: knownUrl,
    provider: 'investing-israel',
    destinationType: 'investing-market-page',
    labelHe: 'מקור נתוני מאקרו',
    tooltipHe: 'פתח מקור נתוני מאקרו ב־Investing ישראל',
  } : null;
}

export function getMacroIndicatorUrl(input) {
  return getMacroIndicatorDestination(input)?.url || null;
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
