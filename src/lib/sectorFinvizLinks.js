const FINVIZ_SECTOR_QUOTE_BASE = 'https://finviz.com/stock?t=';

const EXACT_SECTOR_ETF_ALIASES = new Map([
  ['טכנולוגיה', 'XLK'],
  ['טכנולוגיית מידע', 'XLK'],
  ['תוכנה', 'IGV'],
  ['בריאות', 'XLV'],
  ['פארמה ובריאות', 'XLV'],
  ['פיננסים', 'XLF'],
  ['צריכה מחזורית', 'XLY'],
  ['צריכה מחזורית מחזורית', 'XLY'],
  ['צריכה בסיסית', 'XLP'],
  ['צריכה הגנתית', 'XLP'],
  ['תעשייה', 'XLI'],
  ['תעשיות', 'XLI'],
  ['אנרגיה', 'XLE'],
  ['חומרי גלם', 'XLB'],
  ['חומרים', 'XLB'],
  ['נדלן', 'XLRE'],
  ['שירותים ציבוריים', 'XLU'],
  ['תקשורת', 'XLC'],
  ['שירותי תקשורת', 'XLC'],
  ['מוליכים למחצה', 'SMH'],
  ['שבבים', 'SMH'],
  ['שבבים וחומרה', 'SMH'],
  ['שבבים וסמיקונדקטורס', 'SMH'],
  ['שבבים ותשתיות ai', 'SMH'],
  ['שבבים ומוליכים למחצה', 'SMH'],
  ['סייבר', 'CIBR'],
  ['ביטחון ותעופה', 'ITA'],
  ['תשתיות מחשוב וענן', 'SKYY'],
  ['תשתיות מחשוב וענן data centers ai', 'SKYY'],
  ['סולאר ואנרגיה נקייה', 'TAN'],
  ['פרסום וצריכה רגישה', 'XLY'],
  ['ביוטכנולוגיה', 'XBI'],
  ['ביוטכנולוגיה ותרופות', 'XLV'],
  // TRADINGBRAIN-STOCKS-SECTOR-ENRICHMENT round 2: AI-extracted automotive labels.
  // Finviz files auto manufacturers under Consumer Cyclical (XLY) -- one of the
  // 11 canonical sector ETFs, not a dedicated auto fund (no CARZ).
  ['רכב', 'XLY'],
  ['רכב חשמלי', 'XLY'],
  ['יצרניות רכב', 'XLY'],
]);

const EXACT_COMPOUND_SECTOR_ETF_LINKS = new Map([
  ['שבבים ותשתיות ai', Object.freeze([
    Object.freeze({ label: 'שבבים', ticker: 'SMH' }),
    Object.freeze({ label: 'תשתיות AI', ticker: 'BOTZ' }),
  ])],
  ['תשתיות מחשוב וענן data centers ai', Object.freeze([
    Object.freeze({ label: 'תשתיות מחשוב וענן', ticker: 'SKYY' }),
    Object.freeze({ label: 'AI', ticker: 'BOTZ' }),
  ])],
]);

const SECTOR_ETF_ALIASES = Object.freeze([
  { ticker: 'XLV', aliases: ['health care', 'healthcare', 'biotech', 'biotechnology', 'pharma', 'pharmaceuticals', 'ביוטכנולוגיה', 'תרופות', 'בריאות', 'פארמה', 'ביומד'] },
  { ticker: 'IGV', aliases: ['software', 'software services', 'תוכנה'] },
  { ticker: 'XLY', aliases: ['consumer discretionary', 'retail', 'home improvement', 'קמעונאות', 'שיפוץ בית', 'צריכה מחזורית', 'צריכה רגישה'] },
  { ticker: 'TAN', aliases: ['solar', 'סולאר'] },
  { ticker: 'SMH', aliases: ['semiconductors', 'chips', 'מוליכים למחצה', 'סמיקונדקטורס', 'שבבים'] },
  { ticker: 'CIBR', aliases: ['cybersecurity', 'cyber', 'סייבר'] },
  { ticker: 'ITA', aliases: ['aerospace defense', 'defense aerospace', 'defense', 'ביטחון'] },
  { ticker: 'SKYY', aliases: ['cloud computing', 'cloud', 'ענן'] },
  { ticker: 'BOTZ', aliases: ['artificial intelligence', 'ai', 'בינה מלאכותית', 'הבינה המלאכותית', 'רובוטיקה'] },
  { ticker: 'XLK', aliases: ['technology', 'tech', 'טכנולוגיה'] },
  { ticker: 'XLF', aliases: ['financials', 'finance', 'פיננסים'] },
  { ticker: 'XLE', aliases: ['energy', 'אנרגיה'] },
  { ticker: 'XLI', aliases: ['industrials', 'industry', 'תעשייה'] },
  { ticker: 'XLRE', aliases: ['real estate', 'נדל״ן'] },
  { ticker: 'XLU', aliases: ['utilities', 'שירותים ציבוריים'] },
  { ticker: 'XLB', aliases: ['materials', 'basic materials', 'חומרי גלם'] },
  { ticker: 'XLP', aliases: ['consumer staples', 'צריכה בסיסית'] },
  { ticker: 'XLC', aliases: ['communication services', 'communications', 'תקשורת'] },
]);

export function normalizeSectorLabelForMapping(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/["'׳״“”‘’`]/g, '')
    .replace(/[\u05be\u2010-\u2015/_.,:;()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAlias(normalizedLabel, rawAlias) {
  const normalizedAlias = normalizeSectorLabelForMapping(rawAlias);
  if (!normalizedAlias) return false;

  const paddedLabel = ` ${normalizedLabel} `;
  if (paddedLabel.includes(` ${normalizedAlias} `)) return true;

  const startsInHebrew = /^[\u0590-\u05FF]/.test(normalizedAlias);
  return startsInHebrew && paddedLabel.includes(` ה${normalizedAlias} `);
}

export function resolveSectorTableEtfTicker(label) {
  const normalizedLabel = normalizeSectorLabelForMapping(label);
  if (!normalizedLabel) return null;

  const exactTicker = EXACT_SECTOR_ETF_ALIASES.get(normalizedLabel);
  if (exactTicker) return exactTicker;

  const matches = new Set();
  for (const group of SECTOR_ETF_ALIASES) {
    if (group.aliases.some((alias) => containsAlias(normalizedLabel, alias))) {
      matches.add(group.ticker);
    }
  }

  return matches.size === 1 ? [...matches][0] : null;
}

export function buildSectorTableFinvizUrl(ticker) {
  const value = String(ticker || '').trim().toUpperCase();
  return /^[A-Z]{2,5}$/.test(value) ? `${FINVIZ_SECTOR_QUOTE_BASE}${value}` : null;
}

export function resolveSectorTableFinvizLink(label) {
  const ticker = resolveSectorTableEtfTicker(label);
  const url = buildSectorTableFinvizUrl(ticker);
  return ticker && url ? { ticker, url } : null;
}

export function resolveSectorTableFinvizLinks(label) {
  const normalizedLabel = normalizeSectorLabelForMapping(label);
  const compoundLinks = EXACT_COMPOUND_SECTOR_ETF_LINKS.get(normalizedLabel);

  if (compoundLinks) {
    return compoundLinks.map(({ label: linkLabel, ticker }) => ({
      label: linkLabel,
      ticker,
      url: buildSectorTableFinvizUrl(ticker),
    }));
  }

  const link = resolveSectorTableFinvizLink(label);
  return link ? [{ label: String(label || '').trim(), ...link }] : [];
}
