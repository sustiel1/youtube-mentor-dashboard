/**
 * Sentiment source link resolver.
 * Maps a sentiment row's label/type to an external reference URL.
 * Matching is alias-based (case-insensitive, trimmed).
 */

export const SENTIMENT_SOURCE_LINKS = [
  {
    id: 'general_market_sentiment',
    labelHe: 'סנטימנט כללי',
    url: 'https://www.cnn.com/markets/fear-and-greed',
    aliases: [
      'general sentiment', 'market sentiment', 'fear and greed', 'risk on', 'risk off',
      'סנטימנט כללי', 'סנטימנט שוק', 'פחד ותאווה', 'ריסק און', 'ריסק אוף',
      'overall sentiment', 'general mood', 'אווירה כללית', 'מצב רוח כללי',
      'fear & greed', 'פחד וחמדנות',
    ],
  },
  {
    id: 'crypto_sentiment',
    labelHe: 'קריפטו',
    url: 'https://alternative.me/crypto/fear-and-greed-index/',
    aliases: [
      'crypto', 'bitcoin sentiment', 'crypto fear and greed', 'btc sentiment',
      'קריפטו', 'ביטקוין', 'סנטימנט קריפטו',
    ],
  },
  {
    id: 'retail_sentiment',
    labelHe: 'סנטימנט קמעונאי',
    url: 'https://www.aaii.com/sentimentsurvey',
    aliases: [
      'retail sentiment', 'retail investors', 'aaii', 'individual investors', 'small investors',
      'סנטימנט קמעונאי', 'משקיעים פרטיים', 'משקיעי ריטייל', 'retail',
    ],
  },
  {
    id: 'institutional_sentiment',
    labelHe: 'סנטימנט מוסדי',
    url: 'https://www.naaim.org/programs/naaim-exposure-index/',
    aliases: [
      'institutional sentiment', 'institutional exposure', 'fund managers', 'naaim', 'professional investors',
      'סנטימנט מוסדי', 'חשיפה מוסדית', 'מנהלי השקעות', 'institutional',
    ],
  },
  {
    id: 'options_sentiment',
    labelHe: 'אופציות / Put Call',
    url: 'https://www.cboe.com/markets/us/options/market-statistics/daily/',
    aliases: [
      'options sentiment', 'put call', 'put/call', 'equity put call', 'index put call', 'cboe',
      'אופציות', 'פוט קול', 'יחס פוט קול',
    ],
  },
  {
    id: 'volatility_sentiment',
    labelHe: 'תנודתיות / VIX',
    url: 'https://www.cboe.com/tradable_products/vix/',
    aliases: [
      'vix', 'volatility', 'volatility sentiment', 'fear index',
      'מדד הפחד', 'תנודתיות', 'סנטימנט תנודתיות',
    ],
  },
  {
    id: 'smart_money_positioning',
    labelHe: 'Smart Money / COT',
    url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
    aliases: [
      'cot', 'commitments of traders', 'smart money', 'positioning', 'futures positioning',
      'managed money', 'commercials',
      'סמארט מאני', 'פוזיציות', 'חוזים עתידיים', 'סוחרים גדולים',
    ],
  },
  {
    id: 'sector_rotation',
    labelHe: 'רוטציה סקטוריאלית',
    url: 'https://stockcharts.com/freecharts/rrg/',
    aliases: [
      'sector rotation', 'rrg', 'relative rotation', 'sector sentiment',
      'value rotation', 'growth rotation', 'small caps rotation',
      'רוטציה סקטוריאלית', 'סקטורים', 'רוטציה בין סקטורים',
      'רוטציה לערך', 'רוטציה לצמיחה', 'מניות קטנות',
    ],
  },
  {
    id: 'sector_heatmap',
    labelHe: 'סקטורים / Heatmap',
    url: 'https://finviz.com/groups.ashx',
    aliases: [
      'sector heatmap', 'sector performance', 'groups', 'finviz groups', 'heatmap',
      'מפת חום', 'ביצועי סקטורים', 'סקטורים פינוויז',
    ],
  },
  {
    id: 'market_breadth',
    labelHe: 'רוחב שוק',
    url: 'https://www.barchart.com/stocks/market-performance/percent-change/advances-declines',
    aliases: [
      'market breadth', 'breadth', 'advance decline', 'advancers decliners', 'new highs new lows',
      'רוחב שוק', 'עולות יורדות', 'שיאים ושפלים',
    ],
  },
  {
    id: 'credit_stress',
    labelHe: 'אשראי / Credit Stress',
    url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
    aliases: [
      'credit stress', 'credit spreads', 'high yield spreads', 'junk spreads', 'corporate spreads',
      'מרווחי אשראי', 'סטרס אשראי', 'אגח זבל', 'מרווחי אגח',
    ],
  },
  {
    id: 'rates_bonds_sentiment',
    labelHe: 'אג״ח / ריביות',
    url: 'https://www.investing.com/rates-bonds/u.s.-10-year-bond-yield',
    aliases: [
      'rates', 'bonds', 'treasury yields', '10 year yield', 'bond sentiment', 'yields',
      'אגח', 'ריביות', 'תשואות', 'תשואת 10 שנים',
    ],
  },
  {
    id: 'dollar_sentiment',
    labelHe: 'דולר / DXY',
    url: 'https://www.investing.com/indices/usdollar',
    aliases: [
      'dxy', 'dollar', 'usd', 'dollar sentiment', 'us dollar index',
      'דולר', 'מדד הדולר', 'סנטימנט דולר',
    ],
  },
  {
    id: 'gold_sentiment',
    labelHe: 'זהב',
    url: 'https://www.investing.com/commodities/gold',
    aliases: [
      'gold', 'gold sentiment', 'safe haven', 'precious metals',
      'זהב', 'מתכות יקרות', 'חוף מבטחים',
    ],
  },
  {
    id: 'oil_energy_sentiment',
    labelHe: 'נפט / אנרגיה',
    url: 'https://www.investing.com/commodities/crude-oil',
    aliases: [
      'oil', 'crude oil', 'wti', 'energy sentiment', 'oil sentiment',
      'נפט', 'אנרגיה', 'מחיר נפט',
    ],
  },
  {
    id: 'consumer_sentiment',
    labelHe: 'סנטימנט צרכנים',
    url: 'https://fred.stlouisfed.org/series/UMCSENT',
    aliases: [
      'consumer sentiment', 'michigan sentiment', 'consumer confidence',
      'סנטימנט צרכנים', 'אמון צרכנים', 'מדד מישיגן',
    ],
  },
  {
    id: 'news_sentiment',
    labelHe: 'חדשות / News Sentiment',
    url: 'https://finviz.com/news.ashx',
    aliases: [
      'news sentiment', 'headline sentiment', 'media sentiment', 'market news',
      'חדשות', 'סנטימנט חדשות', 'כותרות',
    ],
  },
  {
    id: 'analyst_sentiment',
    labelHe: 'אנליסטים',
    url: 'https://finviz.com/screener.ashx?v=340',
    aliases: [
      'analyst sentiment', 'analyst ratings', 'upgrades', 'downgrades', 'price targets',
      'אנליסטים', 'המלצות אנליסטים', 'שדרוגים', 'הורדות דירוג',
    ],
  },
  {
    id: 'insider_sentiment',
    labelHe: 'Insiders',
    url: 'https://finviz.com/insidertrading.ashx',
    aliases: [
      'insider sentiment', 'insider buying', 'insider selling', 'insiders',
      'בעלי עניין', 'קניות בעלי עניין', 'מכירות בעלי עניין',
    ],
  },
];

function normalizeForMatch(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function matchesAny(candidates, aliases) {
  for (const c of candidates) {
    if (!c) continue;
    const norm = normalizeForMatch(c);
    if (!norm) continue;
    for (const alias of aliases) {
      if (norm === alias || norm.includes(alias) || alias.includes(norm)) return true;
    }
  }
  return false;
}

/**
 * Returns matching source link entry or null.
 * Checks label/type/category/title first; falls back to note/description.
 */
export function getSentimentSourceLink(row) {
  if (!row) return null;

  const primaryCandidates = [
    row.label, row.type, row.category, row.title, row.name,
  ].filter(Boolean).map(normalizeForMatch);

  const fallbackCandidates = [
    row.note, row.description,
  ].filter(Boolean).map(normalizeForMatch);

  // Pre-normalize all aliases once per entry lookup
  for (const entry of SENTIMENT_SOURCE_LINKS) {
    const normalizedAliases = entry.aliases.map(normalizeForMatch);
    if (matchesAny(primaryCandidates, normalizedAliases)) return entry;
  }

  for (const entry of SENTIMENT_SOURCE_LINKS) {
    const normalizedAliases = entry.aliases.map(normalizeForMatch);
    if (matchesAny(fallbackCandidates, normalizedAliases)) return entry;
  }

  return null;
}
