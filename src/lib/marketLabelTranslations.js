/**
 * Hebrew-first label formatting for market dashboard UI.
 *
 * Rule: if a visible label is English, display it as "Hebrew (English)".
 * If already Hebrew — return unchanged.
 * If unknown English — return unchanged (safe fallback, no broken UI).
 *
 * Do NOT use for tickers (AAPL, TSLA, etc.), URLs, IDs, CSS, or DB keys.
 */

const _HE = /[֐-׿]/;

function _norm(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── Day names ────────────────────────────────────────────────────────────────
const DAY_MAP = {
  monday:    'שני',
  tuesday:   'שלישי',
  wednesday: 'רביעי',
  thursday:  'חמישי',
  friday:    'שישי',
  saturday:  'שבת',
  sunday:    'ראשון',
};

// ── Importance level overrides (for values not caught by importanceStyles) ───
export const IMPORTANCE_LEVEL_LABELS = {
  CRITICAL:     'קריטי',
  HIGH:         'גבוהה',
  'MEDIUM-HIGH':'בינונית-גבוהה',
  MEDIUM:       'בינונית',
  'MEDIUM-LOW': 'בינונית-נמוכה',
  LOW:          'נמוכה',
};

// ── Main label map ────────────────────────────────────────────────────────────
// Key: normalized lowercase English.  Value: Hebrew translation (no parens — added by formatter).
// Keep keys sorted by specificity (longer / more specific first) so we match "non-farm payrolls" before "payrolls".
const MARKET_LABEL_ENTRIES = [
  // ── Macro / Economic Indicators ──────────────────────────────────────────
  ['pce inflation',                          'אינפלציית PCE'],
  ['pce price index',                        'מדד PCE'],
  ['core pce',                               'PCE ליבה'],
  ['pce',                                    'PCE'],
  ['core cpi',                               'CPI ליבה'],
  ['cpi inflation',                          'אינפלציית CPI'],
  ['consumer price index',                   'מדד המחירים לצרכן'],
  ['cpi',                                    'CPI'],
  ['ppi',                                    'מחירי יצרן (PPI)'],
  ['producer price index',                   'מדד מחירי יצרן'],
  ['gross domestic product',                 'תוצר מקומי גולמי'],
  ['gdp growth',                             'צמיחת תוצר'],
  ['gdp',                                    'תוצר (GDP)'],
  ['non-farm payrolls (nfp)',                'משרות מחוץ לחקלאות (NFP)'],
  ['non-farm payrolls',                      'משרות מחוץ לחקלאות'],
  ['nonfarm payrolls',                       'משרות מחוץ לחקלאות'],
  ['nfp report',                             'דוח תעסוקה NFP'],
  ['nfp',                                    'דוח תעסוקה NFP'],
  ['jobs report',                            'דוח תעסוקה'],
  ['unemployment rate',                      'שיעור אבטלה'],
  ['unemployment',                           'אבטלה'],
  ['initial jobless claims',                 'תביעות אבטלה ראשוניות'],
  ['jobless claims',                         'תביעות אבטלה'],
  ['labor market',                           'שוק העבודה'],
  ['labour market',                          'שוק העבודה'],
  ['fed funds rate',                         'ריבית הפד'],
  ['federal funds rate',                     'ריבית פדרלית'],
  ['fomc meeting',                           'ישיבת FOMC'],
  ['fomc',                                   'החלטת ריבית FOMC'],
  ['rate decision',                          'החלטת ריבית'],
  ['interest rate',                          'ריבית'],
  ['monetary policy',                        'מדיניות מוניטרית'],
  ['10 year yield',                          'תשואת 10 שנים'],
  ['10yr yield',                             'תשואת 10 שנים'],
  ['10y yield',                              'תשואת 10 שנים'],
  ['treasury yield',                         'תשואת אג"ח אמריקאי'],
  ['treasury yields',                        'תשואות אג"ח'],
  ['yield curve',                            'עקום התשואות'],
  ['us housing market',                      'שוק הדיור בארה"ב'],
  ['housing market',                         'שוק הדיור'],
  ['housing starts',                         'התחלות בנייה'],
  ['home sales',                             'מכירות בתים'],
  ['existing home sales',                    'מכירות בתים קיימים'],
  ['new home sales',                         'מכירות בתים חדשים'],
  ['building permits',                       'היתרי בנייה'],
  ['case-shiller',                           'מדד קייס-שילר'],
  ['ism manufacturing',                      'ISM ייצוראי'],
  ['ism services',                           'ISM שירותים'],
  ['ism',                                    'מדד ISM'],
  ['pmi manufacturing',                      'PMI ייצורי'],
  ['pmi services',                           'PMI שירותים'],
  ['pmi',                                    'מדד PMI'],
  ['durable goods orders',                   'הזמנות מוצרי יסוד'],
  ['durable goods',                          'מוצרי יסוד'],
  ['retail sales',                           'מכירות קמעונאיות'],
  ['consumer confidence',                    'אמון צרכנים'],
  ['michigan sentiment',                     'מדד מישיגן'],
  ['consumer sentiment',                     'סנטימנט צרכנים'],
  ['trade balance',                          'מאזן סחר'],
  ['trade deficit',                          'גרעון סחר'],
  ['trade surplus',                          'עודף סחר'],
  ['credit spreads',                         'מרווחי אשראי'],
  ['high yield spreads',                     'מרווחי אג"ח זבל'],
  // ── Commodities / Assets ──────────────────────────────────────────────────
  ['crude oil / fuel',                       'נפט גולמי / דלק'],
  ['crude oil',                              'נפט גולמי'],
  ['oil & gas',                              'נפט וגז'],
  ['oil / fuel',                             'נפט / דלק'],
  ['natural gas',                            'גז טבעי'],
  ['gold',                                   'זהב'],
  ['silver',                                 'כסף'],
  ['bitcoin',                                'ביטקוין'],
  ['ethereum',                               'את\'ריום'],
  ['crypto',                                 'קריפטו'],
  ['us dollar index',                        'מדד הדולר האמריקאי'],
  ['dollar index',                           'מדד הדולר'],
  ['dxy',                                    'מדד הדולר DXY'],
  ['vix',                                    'מדד הפחד VIX'],
  // ── Indices ──────────────────────────────────────────────────────────────
  ['nasdaq 100',                             'נאסד"ק 100'],
  ['nasdaq',                                 'נאסד"ק'],
  ['s&p 500',                                'S&P 500'],
  ['dow jones',                              'דאו ג\'ונס'],
  ['russell 2000',                           'ראסל 2000'],
  ['small caps',                             'מניות קטנות'],
  ['large caps',                             'מניות גדולות'],
  ['mega caps',                              'מניות ענק'],
  ['mid caps',                               'מניות בינוניות'],
  ['growth stocks',                          'מניות צמיחה'],
  ['value stocks',                           'מניות ערך'],
  // ── Sectors ───────────────────────────────────────────────────────────────
  ['memory semiconductor stocks',            'מניות שבבי זיכרון'],
  ['semiconductor stocks',                   'מניות מוליכים למחצה'],
  ['technology',                             'טכנולוגיה'],
  ['semiconductors',                         'מוליכים למחצה'],
  ['financials',                             'פיננסים'],
  ['healthcare',                             'בריאות'],
  ['energy',                                 'אנרגיה'],
  ['consumer discretionary',                 'צריכה מחזורית'],
  ['consumer staples',                       'צריכה בסיסית'],
  ['industrials',                            'תעשייה'],
  ['utilities',                              'תשתיות'],
  ['real estate',                            'נדל"ן'],
  ['communication services',                 'תקשורת'],
  ['materials',                              'חומרי גלם'],
  ['biotech',                                'ביוטק'],
  ['airlines',                               'חברות תעופה'],
  ['homebuilders',                           'קבלני בתים'],
  ['regional banks',                         'בנקים אזוריים'],
  ['banks',                                  'בנקים'],
  ['software',                               'תוכנה'],
  ['retail',                                 'קמעונאות'],
  ['technology / semiconductors',             'טכנולוגיה / שבבים'],
  ['small caps (russell)',                    'חברות קטנות'],
  ['small cap (russell)',                     'חברות קטנות'],
  ['consumer cyclical',                       'צריכה מחזורית'],
  ['cybersecurity',                           'סייבר'],
  ['cloud computing',                         'ענן'],
  ['ai / robotics',                           'AI / רובוטיקה'],
  ['gold miners',                             'כורי זהב'],
  ['long treasury bonds',                     'אג"ח ארה"ב ארוך'],
  ['long bonds',                              'אג"ח ארה"ב ארוך'],
  ['us dollar',                               'דולר'],
  ['software (igv)',                          'תוכנה'],
  ['semiconductors (smh)',                    'מוליכים למחצה'],
  // ── Calendar / Company Events ────────────────────────────────────────────
  ['tesla deliveries',                       'מסירות טסלה'],
  ['apple earnings',                         'דוחות אפל'],
  ['earnings season',                        'עונת דוחות'],
  ['earnings report',                        'דוח רווחים'],
  ['earnings',                               'דוחות'],
  ['q1 earnings',                            'דוחות רבעון 1'],
  ['q2 earnings',                            'דוחות רבעון 2'],
  ['q3 earnings',                            'דוחות רבעון 3'],
  ['q4 earnings',                            'דוחות רבעון 4'],
  ['economic data',                          'נתונים כלכליים'],
  ['market open',                            'פתיחת שוק'],
  ['market close',                           'סגירת שוק'],
  ['fed speech',                             'נאום הפד'],
  ['powell speech',                          'נאום פאוול'],
  ['ecb meeting',                            'ישיבת ECB'],
  ['bank of japan',                          'בנק יפן'],
  ['opec meeting',                           'ישיבת OPEC'],
  // ── UI / General terms ───────────────────────────────────────────────────
  ['global market',                          'שוק גלובלי'],
  ['global',                                 'גלובלי'],
  ['general condition',                      'מצב כללי'],
  ['market regime',                          'משטר שוק'],
  ['regime',                                 'משטר שוק'],
  ['theme',                                  'נושא'],
  ['trend',                                  'מגמה'],
  ['breakout above resistance and descending trend lines', 'פריצת התנגדות ומעבר מעל קווי מגמה יורדים'],
  ['breakout above resistance',              'פריצת התנגדות'],
  ['resistance breakout',                    'פריצת התנגדות'],
  ['descending trend lines',                 'קווי מגמה יורדים'],
  ['strategic mega-acquisition',             'רכישת ענק אסטרטגית'],
  ['mega-acquisition',                       'רכישת ענק'],
  ['strategic acquisition',                  'רכישה אסטרטגית'],
  ['momentum',                               'מומנטום'],
  ['rotation',                               'רוטציה'],
  ['sector rotation',                        'רוטציה סקטוריאלית'],
  ['market breadth',                         'רוחב שוק'],
  ['breadth',                                'רוחב שוק'],
  ['risk on',                                'נכונות לסיכון'],
  ['risk off',                               'הימנעות מסיכון'],
  ['risk-on',                                'נכונות לסיכון'],
  ['risk-off',                               'הימנעות מסיכון'],
  ['safe haven',                             'חוף מבטחים'],
  ['catalyst',                               'קטליזטור'],
  ['catalysts',                              'קטליזטורים'],
  ['upcoming events',                        'אירועים קרובים'],
];

// Pre-build the lookup map
const _LABEL_MAP = new Map(
  MARKET_LABEL_ENTRIES.map(([k, v]) => [_norm(k), v])
);

/**
 * Returns "Hebrew (Original)" if a translation exists,
 * original text if already Hebrew, or original text if no match.
 *
 * Safe: never throws, never returns empty for non-empty input.
 */
export function translateMarketLabel(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return raw;

  // Already Hebrew → leave unchanged
  if (_HE.test(raw)) return raw;

  const key = _norm(raw);

  // Exact match
  const exact = _LABEL_MAP.get(key);
  if (exact) return `${exact} (${raw})`;

  // Day name (Monday–Sunday)
  const day = DAY_MAP[key];
  if (day) return `${day} (${raw})`;

  // Partial / substring match — try each map entry
  for (const [mapKey, mapVal] of _LABEL_MAP) {
    if (key === mapKey) continue; // already checked above
    if (key.includes(mapKey) || mapKey.includes(key)) {
      return `${mapVal} (${raw})`;
    }
  }

  // No match — return unchanged (safe fallback)
  return raw;
}

/** Alias for translateMarketLabel — unified entry point for Hebrew-first display labels. */
export const getHebrewDisplayLabel = translateMarketLabel;

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function translateMarketTextInline(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return raw;

  let out = raw;
  const sortedEntries = [..._LABEL_MAP.entries()].sort((a, b) => b[0].length - a[0].length);

  for (const [englishKey, hebrewLabel] of sortedEntries) {
    const pattern = escapeRegex(englishKey).replace(/ /g, '\\s+');
    out = out.replace(new RegExp(pattern, 'gi'), hebrewLabel);
  }

  return out;
}

/**
 * Translates an importance level string to Hebrew.
 * Returns null if unrecognized.
 * Used by CALENDAR_IMPORTANCE_LABEL overrides.
 */
export function translateImportanceLevel(level) {
  if (!level) return null;
  const upper = String(level).trim().toUpperCase();
  return IMPORTANCE_LEVEL_LABELS[upper] ?? null;
}
