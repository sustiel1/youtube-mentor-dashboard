const FINVIZ_SECTOR_QUOTE_BASE = 'https://finviz.com/stock?t=';

const EXACT_SECTOR_ETF_ALIASES = new Map([
  ['טכנולוגיה', 'XLK'],
  ['טכנולוגיית מידע', 'XLK'],
  ['בריאות', 'XLV'],
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
  ['ביוטכנולוגיה', 'XBI'],
  ['ביוטכנולוגיה ותרופות', 'XLV'],
]);

const SECTOR_ETF_ALIASES = Object.freeze([
  { ticker: 'XLV', aliases: ['health care', 'healthcare', 'biotech', 'biotechnology', 'pharma', 'pharmaceuticals', 'ביוטכנולוגיה', 'תרופות', 'בריאות', 'ביומד'] },
  { ticker: 'XLY', aliases: ['consumer discretionary', 'retail', 'home improvement', 'קמעונאות', 'שיפוץ בית', 'צריכה מחזורית'] },
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

function normalizeSectorLabelForMapping(value) {
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

function resolveSectorTableEtfTicker(label) {
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

function buildSectorTableFinvizUrl(ticker) {
  const value = String(ticker || '').trim().toUpperCase();
  return /^[A-Z]{2,5}$/.test(value) ? `${FINVIZ_SECTOR_QUOTE_BASE}${value}` : null;
}

export function resolveSectorTableFinvizLink(label) {
  const ticker = resolveSectorTableEtfTicker(label);
  const url = buildSectorTableFinvizUrl(ticker);
  return ticker && url ? { ticker, url } : null;
}
