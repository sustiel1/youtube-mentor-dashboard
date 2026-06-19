/**
 * Static sector mapping for major US stocks.
 * Used for UI enrichment only — does not affect GEM schema or analysis generation.
 */

const STOCK_SECTOR_MAP = {
  // ── Technology ──────────────────────────────────────────────────────────────
  AAPL:  { company: 'Apple',              sector: 'Technology',              sectorHe: 'טכנולוגיה',       sectorEtf: 'XLK'  },
  MSFT:  { company: 'Microsoft',          sector: 'Technology',              sectorHe: 'טכנולוגיה',       sectorEtf: 'XLK'  },
  AAON:  { company: 'AAON',               sector: 'Industrials',             sectorHe: 'תעשייה',          sectorEtf: 'XLI'  },

  // ── Communication Services ───────────────────────────────────────────────────
  GOOGL: { company: 'Alphabet (A)',        sector: 'Communication Services',  sectorHe: 'תקשורת',          sectorEtf: 'XLC'  },
  GOOG:  { company: 'Alphabet (C)',        sector: 'Communication Services',  sectorHe: 'תקשורת',          sectorEtf: 'XLC'  },
  META:  { company: 'Meta',               sector: 'Communication Services',  sectorHe: 'תקשורת',          sectorEtf: 'XLC'  },
  NFLX:  { company: 'Netflix',            sector: 'Communication Services',  sectorHe: 'תקשורת',          sectorEtf: 'XLC'  },
  DIS:   { company: 'Disney',             sector: 'Communication Services',  sectorHe: 'תקשורת',          sectorEtf: 'XLC'  },
  T:     { company: 'AT&T',               sector: 'Communication Services',  sectorHe: 'תקשורת',          sectorEtf: 'XLC'  },
  VZ:    { company: 'Verizon',            sector: 'Communication Services',  sectorHe: 'תקשורת',          sectorEtf: 'XLC'  },

  // ── Consumer Discretionary ───────────────────────────────────────────────────
  AMZN:  { company: 'Amazon',             sector: 'Consumer Discretionary',  sectorHe: 'צריכה מחזורית',   sectorEtf: 'XLY'  },
  TSLA:  { company: 'Tesla',              sector: 'Consumer Discretionary',  sectorHe: 'צריכה מחזורית',   sectorEtf: 'XLY'  },
  TGT:   { company: 'Target',             sector: 'Consumer Discretionary',  sectorHe: 'צריכה מחזורית',   sectorEtf: 'XLY'  },
  HD:    { company: 'Home Depot',         sector: 'Consumer Discretionary',  sectorHe: 'צריכה מחזורית',   sectorEtf: 'XLY'  },
  MCD:   { company: "McDonald's",         sector: 'Consumer Discretionary',  sectorHe: 'צריכה מחזורית',   sectorEtf: 'XLY'  },
  NKE:   { company: 'Nike',               sector: 'Consumer Discretionary',  sectorHe: 'צריכה מחזורית',   sectorEtf: 'XLY'  },
  SBUX:  { company: 'Starbucks',          sector: 'Consumer Discretionary',  sectorHe: 'צריכה מחזורית',   sectorEtf: 'XLY'  },

  // ── Consumer Staples ─────────────────────────────────────────────────────────
  WMT:   { company: 'Walmart',            sector: 'Consumer Staples',        sectorHe: 'צריכה בסיסית',    sectorEtf: 'XLP'  },
  COST:  { company: 'Costco',             sector: 'Consumer Staples',        sectorHe: 'צריכה בסיסית',    sectorEtf: 'XLP'  },
  KO:    { company: 'Coca-Cola',          sector: 'Consumer Staples',        sectorHe: 'צריכה בסיסית',    sectorEtf: 'XLP'  },
  PEP:   { company: 'PepsiCo',            sector: 'Consumer Staples',        sectorHe: 'צריכה בסיסית',    sectorEtf: 'XLP'  },
  PG:    { company: 'Procter & Gamble',   sector: 'Consumer Staples',        sectorHe: 'צריכה בסיסית',    sectorEtf: 'XLP'  },
  PM:    { company: 'Philip Morris',      sector: 'Consumer Staples',        sectorHe: 'צריכה בסיסית',    sectorEtf: 'XLP'  },
  CL:    { company: 'Colgate-Palmolive',  sector: 'Consumer Staples',        sectorHe: 'צריכה בסיסית',    sectorEtf: 'XLP'  },

  // ── Semiconductors ───────────────────────────────────────────────────────────
  NVDA:  { company: 'NVIDIA',             sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  AMD:   { company: 'AMD',                sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  INTC:  { company: 'Intel',              sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  AVGO:  { company: 'Broadcom',           sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  QCOM:  { company: 'Qualcomm',           sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  MU:    { company: 'Micron',             sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  TSM:   { company: 'TSMC',               sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  AMAT:  { company: 'Applied Materials',  sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  LRCX:  { company: 'Lam Research',       sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  KLAC:  { company: 'KLA',                sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  MRVL:  { company: 'Marvell',            sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },
  ARM:   { company: 'Arm Holdings',       sector: 'Semiconductors',          sectorHe: 'מוליכים למחצה',   sectorEtf: 'SMH'  },

  // ── Software ─────────────────────────────────────────────────────────────────
  ADBE:  { company: 'Adobe',              sector: 'Software',                sectorHe: 'תוכנה',            sectorEtf: 'IGV'  },
  CRM:   { company: 'Salesforce',         sector: 'Software',                sectorHe: 'תוכנה',            sectorEtf: 'IGV'  },
  ORCL:  { company: 'Oracle',             sector: 'Software',                sectorHe: 'תוכנה',            sectorEtf: 'IGV'  },
  PLTR:  { company: 'Palantir',           sector: 'Software',                sectorHe: 'תוכנה',            sectorEtf: 'IGV'  },
  NOW:   { company: 'ServiceNow',         sector: 'Software',                sectorHe: 'תוכנה',            sectorEtf: 'IGV'  },
  SNOW:  { company: 'Snowflake',          sector: 'Software',                sectorHe: 'תוכנה',            sectorEtf: 'IGV'  },
  UBER:  { company: 'Uber',               sector: 'Software',                sectorHe: 'תוכנה',            sectorEtf: 'IGV'  },

  // ── Financials ───────────────────────────────────────────────────────────────
  JPM:   { company: 'JPMorgan Chase',     sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },
  BAC:   { company: 'Bank of America',    sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },
  C:     { company: 'Citigroup',          sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },
  WFC:   { company: 'Wells Fargo',        sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },
  GS:    { company: 'Goldman Sachs',      sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },
  MS:    { company: 'Morgan Stanley',     sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },
  AXP:   { company: 'American Express',   sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },
  BRK:   { company: 'Berkshire Hathaway', sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },
  V:     { company: 'Visa',               sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },
  MA:    { company: 'Mastercard',         sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },
  SCHW:  { company: 'Charles Schwab',     sector: 'Financials',              sectorHe: 'פיננסים',          sectorEtf: 'XLF'  },

  // ── Energy ───────────────────────────────────────────────────────────────────
  XOM:   { company: 'ExxonMobil',         sector: 'Energy',                  sectorHe: 'אנרגיה',           sectorEtf: 'XLE'  },
  CVX:   { company: 'Chevron',            sector: 'Energy',                  sectorHe: 'אנרגיה',           sectorEtf: 'XLE'  },
  COP:   { company: 'ConocoPhillips',     sector: 'Energy',                  sectorHe: 'אנרגיה',           sectorEtf: 'XLE'  },
  OXY:   { company: 'Occidental',         sector: 'Energy',                  sectorHe: 'אנרגיה',           sectorEtf: 'XLE'  },
  SLB:   { company: 'Schlumberger',       sector: 'Energy',                  sectorHe: 'אנרגיה',           sectorEtf: 'XLE'  },

  // ── Industrials ──────────────────────────────────────────────────────────────
  CAT:   { company: 'Caterpillar',        sector: 'Industrials',             sectorHe: 'תעשייה',            sectorEtf: 'XLI'  },
  DE:    { company: 'Deere',              sector: 'Industrials',             sectorHe: 'תעשייה',            sectorEtf: 'XLI'  },
  BA:    { company: 'Boeing',             sector: 'Industrials',             sectorHe: 'תעשייה',            sectorEtf: 'XLI'  },
  GE:    { company: 'GE Aerospace',       sector: 'Industrials',             sectorHe: 'תעשייה',            sectorEtf: 'XLI'  },
  RTX:   { company: 'RTX',                sector: 'Industrials',             sectorHe: 'תעשייה',            sectorEtf: 'XLI'  },
  LMT:   { company: 'Lockheed Martin',    sector: 'Industrials',             sectorHe: 'תעשייה',            sectorEtf: 'XLI'  },
  UPS:   { company: 'UPS',                sector: 'Industrials',             sectorHe: 'תעשייה',            sectorEtf: 'XLI'  },
  FDX:   { company: 'FedEx',              sector: 'Industrials',             sectorHe: 'תעשייה',            sectorEtf: 'XLI'  },

  // ── Healthcare ───────────────────────────────────────────────────────────────
  UNH:   { company: 'UnitedHealth',       sector: 'Healthcare',              sectorHe: 'בריאות',            sectorEtf: 'XLV'  },
  JNJ:   { company: 'Johnson & Johnson',  sector: 'Healthcare',              sectorHe: 'בריאות',            sectorEtf: 'XLV'  },
  LLY:   { company: 'Eli Lilly',          sector: 'Healthcare',              sectorHe: 'בריאות',            sectorEtf: 'XLV'  },
  PFE:   { company: 'Pfizer',             sector: 'Healthcare',              sectorHe: 'בריאות',            sectorEtf: 'XLV'  },
  MRK:   { company: 'Merck',              sector: 'Healthcare',              sectorHe: 'בריאות',            sectorEtf: 'XLV'  },
  ABBV:  { company: 'AbbVie',             sector: 'Healthcare',              sectorHe: 'בריאות',            sectorEtf: 'XLV'  },
  BMY:   { company: 'Bristol-Myers',      sector: 'Healthcare',              sectorHe: 'בריאות',            sectorEtf: 'XLV'  },
  AMGN:  { company: 'Amgen',              sector: 'Healthcare',              sectorHe: 'בריאות',            sectorEtf: 'XLV'  },

  // ── Materials ────────────────────────────────────────────────────────────────
  LIN:   { company: 'Linde',              sector: 'Materials',               sectorHe: 'חומרי גלם',        sectorEtf: 'XLB'  },
  NEM:   { company: 'Newmont',            sector: 'Materials',               sectorHe: 'חומרי גלם',        sectorEtf: 'XLB'  },
  FCX:   { company: 'Freeport-McMoRan',   sector: 'Materials',               sectorHe: 'חומרי גלם',        sectorEtf: 'XLB'  },

  // ── Utilities ────────────────────────────────────────────────────────────────
  NEE:   { company: 'NextEra Energy',     sector: 'Utilities',               sectorHe: 'תשתיות',            sectorEtf: 'XLU'  },
  DUK:   { company: 'Duke Energy',        sector: 'Utilities',               sectorHe: 'תשתיות',            sectorEtf: 'XLU'  },

  // ── Real Estate ──────────────────────────────────────────────────────────────
  AMT:   { company: 'American Tower',     sector: 'Real Estate',             sectorHe: 'נדל"ן',             sectorEtf: 'XLRE' },
  PLD:   { company: 'Prologis',           sector: 'Real Estate',             sectorHe: 'נדל"ן',             sectorEtf: 'XLRE' },
  SPG:   { company: 'Simon Property',     sector: 'Real Estate',             sectorHe: 'נדל"ן',             sectorEtf: 'XLRE' },
};

/**
 * Returns sector metadata for a given ticker symbol.
 * Returns null if the ticker is not in the static map.
 */
export function getStockSectorMeta(ticker) {
  if (!ticker) return null;
  return STOCK_SECTOR_MAP[String(ticker).trim().toUpperCase()] ?? null;
}
