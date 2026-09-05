/**
 * Ticker → sector enrichment for stock rows (TRADINGBRAIN-STOCKS-SECTOR-ENRICHMENT).
 *
 * Root cause this module addresses: a stock row's "סקטור" value is normally
 * AI-extracted from the analyzed video's own text, so it is empty whenever the
 * video never named a sector for that ticker. This is missing SOURCE data, not
 * a rendering bug — this module adds a static local fallback map only. No API,
 * no network call, no new dependency.
 *
 * Sector taxonomy: EXACTLY Finviz's own 11 top-level sectors (not GICS). Do
 * not add, rename, or remove a key here — every consumer keys off this exact
 * set. Each sector's Hebrew label is reused verbatim from the labels already
 * used elsewhere in this codebase (see src/lib/marketLabelTranslations.js and
 * src/lib/stockSectorMap.js) — nothing here is an invented label.
 *
 * Link building reuses the existing sector→Finviz-ETF URL helper in
 * src/lib/sectorFinvizLinks.js (buildSectorTableFinvizUrl /
 * resolveSectorTableFinvizLink) — the same helper already wired into every
 * sector-cell render site in this app (MarketSectorTable.jsx,
 * SavedStockRowsTable.jsx, StructuredSnapshotView.jsx, MorningBriefPanels.jsx).
 * This module intentionally does not add a second URL builder.
 */

import { buildSectorTableFinvizUrl, resolveSectorTableFinvizLink } from './sectorFinvizLinks.js';

/** Canonical Finviz sector keys → { labelHe, etf }. EXACT set — invent no others. */
export const FINVIZ_SECTOR_META = Object.freeze({
  Technology:               Object.freeze({ labelHe: 'טכנולוגיה',      etf: 'XLK'  }),
  'Communication Services': Object.freeze({ labelHe: 'תקשורת',         etf: 'XLC'  }),
  'Consumer Cyclical':      Object.freeze({ labelHe: 'צריכה מחזורית',  etf: 'XLY'  }),
  'Consumer Defensive':     Object.freeze({ labelHe: 'צריכה בסיסית',   etf: 'XLP'  }),
  Healthcare:               Object.freeze({ labelHe: 'בריאות',         etf: 'XLV'  }),
  Financial:                Object.freeze({ labelHe: 'פיננסים',        etf: 'XLF'  }),
  Industrials:              Object.freeze({ labelHe: 'תעשייה',         etf: 'XLI'  }),
  Energy:                   Object.freeze({ labelHe: 'אנרגיה',         etf: 'XLE'  }),
  'Basic Materials':        Object.freeze({ labelHe: 'חומרי גלם',      etf: 'XLB'  }),
  'Real Estate':            Object.freeze({ labelHe: 'נדל"ן',          etf: 'XLRE' }),
  Utilities:                Object.freeze({ labelHe: 'תשתיות',         etf: 'XLU'  }),
});

export const FINVIZ_SECTOR_KEYS = Object.freeze(Object.keys(FINVIZ_SECTOR_META));

/**
 * Ticker (uppercase) → canonical Finviz sector key. A curated, high-confidence
 * subset of S&P 500 + Nasdaq 100 + commonly-discussed US tickers — not every
 * constituent (no live data source is available to verify the full universe
 * offline). Every ticker explicitly required by TRADINGBRAIN-STOCKS-SECTOR-
 * ENRICHMENT's acceptance criteria is present. Coverage against real stored
 * data is measured and reported separately, not assumed from this list's size.
 *
 * UBER is deliberately Technology (Finviz's own classification — Software /
 * Application), not Industrials/Consumer Cyclical as a GICS-style "ground
 * transportation" read might suggest. Do not "correct" it.
 */
const TICKER_SECTOR_KEY = {
  // ── Technology ──────────────────────────────────────────────────────────
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', AVGO: 'Technology',
  ORCL: 'Technology', CRM: 'Technology', ADBE: 'Technology', AMD: 'Technology',
  INTC: 'Technology', MU: 'Technology', SMCI: 'Technology', ARM: 'Technology',
  PLTR: 'Technology', SNOW: 'Technology', DDOG: 'Technology', NET: 'Technology',
  CRWD: 'Technology', ZS: 'Technology', OKTA: 'Technology', DELL: 'Technology',
  HPQ: 'Technology', MDB: 'Technology', GTLB: 'Technology', CRDO: 'Technology',
  PANW: 'Technology', UBER: 'Technology', IBM: 'Technology', CSCO: 'Technology',
  TXN: 'Technology', QCOM: 'Technology', NOW: 'Technology', INTU: 'Technology',
  ADI: 'Technology', LRCX: 'Technology', KLAC: 'Technology', AMAT: 'Technology',
  MRVL: 'Technology', ON: 'Technology', MPWR: 'Technology', FTNT: 'Technology',
  TEAM: 'Technology', WDAY: 'Technology', SNPS: 'Technology', CDNS: 'Technology',
  ANSS: 'Technology', ROP: 'Technology', HPE: 'Technology', JNPR: 'Technology',
  NTAP: 'Technology', STX: 'Technology', WDC: 'Technology', GLW: 'Technology',
  TER: 'Technology', SWKS: 'Technology', QRVO: 'Technology', ENPH: 'Technology',
  FSLR: 'Technology', MSI: 'Technology', ANET: 'Technology', ZM: 'Technology',
  DOCU: 'Technology', TWLO: 'Technology', SHOP: 'Technology', ADSK: 'Technology',
  VRSN: 'Technology', AKAM: 'Technology', CDW: 'Technology', FICO: 'Technology',
  GRMN: 'Technology', APH: 'Technology', TEL: 'Technology', KEYS: 'Technology',
  TRMB: 'Technology', TYL: 'Technology', PTC: 'Technology', CTSH: 'Technology',
  ACN: 'Technology', IT: 'Technology',

  // ── Communication Services ─────────────────────────────────────────────
  GOOGL: 'Communication Services', GOOG: 'Communication Services', META: 'Communication Services',
  NFLX: 'Communication Services', DIS: 'Communication Services', T: 'Communication Services',
  VZ: 'Communication Services', CMCSA: 'Communication Services', CHTR: 'Communication Services',
  TMUS: 'Communication Services', WBD: 'Communication Services', EA: 'Communication Services',
  TTWO: 'Communication Services', MTCH: 'Communication Services', PARA: 'Communication Services',
  LYV: 'Communication Services', OMC: 'Communication Services', IPG: 'Communication Services',
  FOXA: 'Communication Services', NWSA: 'Communication Services', PINS: 'Communication Services',
  SNAP: 'Communication Services', SPOT: 'Communication Services',

  // ── Consumer Cyclical ───────────────────────────────────────────────────
  AMZN: 'Consumer Cyclical', TSLA: 'Consumer Cyclical', HD: 'Consumer Cyclical',
  MCD: 'Consumer Cyclical', NKE: 'Consumer Cyclical', SBUX: 'Consumer Cyclical',
  TGT: 'Consumer Cyclical', LOW: 'Consumer Cyclical', BKNG: 'Consumer Cyclical',
  CMG: 'Consumer Cyclical', MAR: 'Consumer Cyclical', GM: 'Consumer Cyclical',
  F: 'Consumer Cyclical', RCL: 'Consumer Cyclical', CCL: 'Consumer Cyclical',
  NCLH: 'Consumer Cyclical', YUM: 'Consumer Cyclical', DHI: 'Consumer Cyclical',
  LEN: 'Consumer Cyclical', NVR: 'Consumer Cyclical', ORLY: 'Consumer Cyclical',
  AZO: 'Consumer Cyclical', ROST: 'Consumer Cyclical', TJX: 'Consumer Cyclical',
  ULTA: 'Consumer Cyclical', EBAY: 'Consumer Cyclical', ETSY: 'Consumer Cyclical',
  APTV: 'Consumer Cyclical', BBY: 'Consumer Cyclical', DPZ: 'Consumer Cyclical',
  DRI: 'Consumer Cyclical', EXPE: 'Consumer Cyclical', HLT: 'Consumer Cyclical',
  MGM: 'Consumer Cyclical', WYNN: 'Consumer Cyclical', LVS: 'Consumer Cyclical',
  RL: 'Consumer Cyclical', TPR: 'Consumer Cyclical',

  // ── Consumer Defensive ──────────────────────────────────────────────────
  WMT: 'Consumer Defensive', COST: 'Consumer Defensive', KO: 'Consumer Defensive',
  PEP: 'Consumer Defensive', PG: 'Consumer Defensive', PM: 'Consumer Defensive',
  MO: 'Consumer Defensive', CL: 'Consumer Defensive', KMB: 'Consumer Defensive',
  GIS: 'Consumer Defensive', K: 'Consumer Defensive', HSY: 'Consumer Defensive',
  STZ: 'Consumer Defensive', MDLZ: 'Consumer Defensive', KHC: 'Consumer Defensive',
  SYY: 'Consumer Defensive', KR: 'Consumer Defensive', TSN: 'Consumer Defensive',
  CHD: 'Consumer Defensive', CLX: 'Consumer Defensive', EL: 'Consumer Defensive',
  ADM: 'Consumer Defensive', KDP: 'Consumer Defensive', MKC: 'Consumer Defensive',
  TAP: 'Consumer Defensive', DG: 'Consumer Defensive', DLTR: 'Consumer Defensive',

  // ── Healthcare ──────────────────────────────────────────────────────────
  UNH: 'Healthcare', JNJ: 'Healthcare', LLY: 'Healthcare', PFE: 'Healthcare',
  MRK: 'Healthcare', ABBV: 'Healthcare', TMO: 'Healthcare', ABT: 'Healthcare',
  DHR: 'Healthcare', BMY: 'Healthcare', AMGN: 'Healthcare', GILD: 'Healthcare',
  ISRG: 'Healthcare', VRTX: 'Healthcare', REGN: 'Healthcare', MDT: 'Healthcare',
  CVS: 'Healthcare', CI: 'Healthcare', ELV: 'Healthcare', HUM: 'Healthcare',
  SYK: 'Healthcare', BSX: 'Healthcare', ZTS: 'Healthcare', BDX: 'Healthcare',
  HCA: 'Healthcare', MRNA: 'Healthcare', BIIB: 'Healthcare', IDXX: 'Healthcare',
  IQV: 'Healthcare', A: 'Healthcare', MTD: 'Healthcare', WST: 'Healthcare',
  DXCM: 'Healthcare', ALGN: 'Healthcare',

  // ── Financial ───────────────────────────────────────────────────────────
  JPM: 'Financial', BAC: 'Financial', GS: 'Financial', MS: 'Financial',
  WFC: 'Financial', C: 'Financial', AXP: 'Financial', V: 'Financial',
  MA: 'Financial', SCHW: 'Financial', BLK: 'Financial', SPGI: 'Financial',
  CME: 'Financial', ICE: 'Financial', PGR: 'Financial', CB: 'Financial',
  MMC: 'Financial', AON: 'Financial', TRV: 'Financial', AIG: 'Financial',
  MET: 'Financial', PRU: 'Financial', ALL: 'Financial', USB: 'Financial',
  PNC: 'Financial', TFC: 'Financial', COF: 'Financial', BK: 'Financial',
  STT: 'Financial', PYPL: 'Financial', FIS: 'Financial', FI: 'Financial',
  GPN: 'Financial', 'BRK.B': 'Financial', 'BRK-B': 'Financial',

  // ── Industrials ─────────────────────────────────────────────────────────
  CAT: 'Industrials', BA: 'Industrials', GE: 'Industrials', DE: 'Industrials',
  RTX: 'Industrials', LMT: 'Industrials', UPS: 'Industrials', FDX: 'Industrials',
  HON: 'Industrials', UNP: 'Industrials', CSX: 'Industrials', NSC: 'Industrials',
  MMM: 'Industrials', EMR: 'Industrials', ETN: 'Industrials', ITW: 'Industrials',
  PH: 'Industrials', NOC: 'Industrials', GD: 'Industrials', TDG: 'Industrials',
  CARR: 'Industrials', OTIS: 'Industrials', WM: 'Industrials', RSG: 'Industrials',
  CMI: 'Industrials', PCAR: 'Industrials', VRT: 'Industrials', JCI: 'Industrials',
  IR: 'Industrials', DOV: 'Industrials', XYL: 'Industrials', ROK: 'Industrials',
  FAST: 'Industrials', URI: 'Industrials', GWW: 'Industrials', LHX: 'Industrials',
  TXT: 'Industrials', AME: 'Industrials',

  // ── Energy ──────────────────────────────────────────────────────────────
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy', EOG: 'Energy',
  MPC: 'Energy', PSX: 'Energy', VLO: 'Energy', OXY: 'Energy', WMB: 'Energy',
  KMI: 'Energy', HAL: 'Energy', BKR: 'Energy', DVN: 'Energy', HES: 'Energy',
  FANG: 'Energy', TRGP: 'Energy', CTRA: 'Energy',

  // ── Basic Materials ─────────────────────────────────────────────────────
  LIN: 'Basic Materials', APD: 'Basic Materials', SHW: 'Basic Materials',
  ECL: 'Basic Materials', FCX: 'Basic Materials', NEM: 'Basic Materials',
  DOW: 'Basic Materials', DD: 'Basic Materials', PPG: 'Basic Materials',
  NUE: 'Basic Materials', VMC: 'Basic Materials', MLM: 'Basic Materials',
  ALB: 'Basic Materials', CTVA: 'Basic Materials', IFF: 'Basic Materials',
  LYB: 'Basic Materials',

  // ── Real Estate ─────────────────────────────────────────────────────────
  AMT: 'Real Estate', PLD: 'Real Estate', O: 'Real Estate', EQIX: 'Real Estate',
  CCI: 'Real Estate', SPG: 'Real Estate', PSA: 'Real Estate', DLR: 'Real Estate',
  WELL: 'Real Estate', AVB: 'Real Estate', EQR: 'Real Estate', VTR: 'Real Estate',
  ARE: 'Real Estate', INVH: 'Real Estate', MAA: 'Real Estate', ESS: 'Real Estate',
  EXR: 'Real Estate', IRM: 'Real Estate', UDR: 'Real Estate', CPT: 'Real Estate',

  // ── Utilities ───────────────────────────────────────────────────────────
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities', D: 'Utilities',
  AEP: 'Utilities', EXC: 'Utilities', SRE: 'Utilities', XEL: 'Utilities',
  ED: 'Utilities', PEG: 'Utilities', WEC: 'Utilities', ES: 'Utilities',
  FE: 'Utilities', AEE: 'Utilities', PPL: 'Utilities', CMS: 'Utilities',
  DTE: 'Utilities', ATO: 'Utilities', NI: 'Utilities', CNP: 'Utilities',
  LNT: 'Utilities',
};

export const TICKER_SECTOR_MAP = Object.freeze({ ...TICKER_SECTOR_KEY });

/** Returns the canonical Finviz sector key for a ticker, or null if unmapped. */
export function getTickerSectorKey(ticker) {
  if (!ticker) return null;
  const key = TICKER_SECTOR_KEY[String(ticker).trim().toUpperCase()];
  return key || null;
}

/**
 * Round 3 (TRADINGBRAIN-STOCKS-SECTOR-ENRICHMENT): on the 18 tickers where
 * the pre-existing, finer-grained src/lib/stockSectorMap.js disagrees with
 * this module's 11-key Finviz classification, the OLD map's ETF wins for
 * the LINK target only -- the sectorKey (and therefore the synthesized
 * Hebrew label, when there is no stored label) is left untouched, per
 * explicit instruction not to change any displayed label. Semiconductor
 * names get SMH (not XLK), software names get IGV (not XLK). Round 4
 * removed the earlier UBER exception (Consumer Cyclical -> XLY): the user
 * decided a ticker's link must agree with its own displayed label, and
 * UBER's synthesized label is "טכנולוגיה" -- so UBER now falls through to
 * its plain Technology sectorKey ETF (XLK) like any other unlisted tech
 * ticker, via no override at all.
 */
export const TICKER_ETF_OVERRIDE = Object.freeze({
  NVDA: 'SMH', AMD: 'SMH', INTC: 'SMH', AVGO: 'SMH', QCOM: 'SMH', MU: 'SMH',
  AMAT: 'SMH', LRCX: 'SMH', KLAC: 'SMH', MRVL: 'SMH', ARM: 'SMH',
  ADBE: 'IGV', CRM: 'IGV', ORCL: 'IGV', PLTR: 'IGV', NOW: 'IGV', SNOW: 'IGV',
});

/** Resolves the ETF to LINK to for a ticker: the round-3 override if one exists, else the ticker's canonical sector ETF. */
function tickerEtf(ticker, sectorKey) {
  const override = TICKER_ETF_OVERRIDE[String(ticker || '').trim().toUpperCase()];
  if (override) return override;
  return sectorKey ? FINVIZ_SECTOR_META[sectorKey].etf : null;
}

function tickerMapLink(ticker) {
  const sectorKey = getTickerSectorKey(ticker);
  if (!sectorKey) return null;
  const etf = tickerEtf(ticker, sectorKey);
  return { ticker: etf, url: buildSectorTableFinvizUrl(etf) };
}

/**
 * A stored sector label can be a compound phrase (e.g. "רכב וטכנולוגיה") that
 * the alias table in sectorFinvizLinks.js does not recognize as a whole
 * string. Split on whitespace, strip a leading vav-conjunction ("ו") from
 * each token, and return the link for the FIRST token that resolves via the
 * existing alias resolver -- never used to alter the displayed text.
 */
function firstResolvableComponentLink(label) {
  const tokens = String(label || '').trim().split(/\s+/).filter(Boolean);
  for (const rawToken of tokens) {
    const token = rawToken.replace(/^ו/, '');
    if (!token) continue;
    const link = resolveSectorTableFinvizLink(token);
    if (link) return link;
  }
  return null;
}

/**
 * Shared pure resolver for a stock row's sector cell — the single source of
 * truth every render site should call instead of re-deriving sector display
 * locally.
 *
 * Resolution order (never overwrites a real stored value -- the displayed
 * text is always the stored label verbatim once one exists; only the LINK
 * target can fall through further steps):
 *   1. `storedSector` — an existing sector value already on the row. The
 *      label is kept as-is, always. For the link: try the existing
 *      resolveSectorTableFinvizLink() alias resolver first (round 1); if
 *      that finds nothing (round 2 -- e.g. "רכב", or a compound label like
 *      "רכב וטכנולוגיה" that the alias table doesn't know as a whole
 *      string), fall back to the ticker map's sector/ETF; if the ticker is
 *      also unknown, fall back to the FIRST whitespace-separated component
 *      of the label that resolves via the alias resolver. If none of these
 *      resolve, the label still renders, just with no link (no guessed
 *      slug).
 *   2. no stored value: the local ticker → sector map (this module).
 *   3. null — render site shows "—", no link, no console noise.
 *
 * @param {{ ticker?: string, storedSector?: string }} row
 * @returns {{ label: string, etf: string|null, url: string|null, source: 'stored'|'map', sectorKey?: string }|null}
 */
export function resolveStockSectorDisplay({ ticker, storedSector } = {}) {
  const stored = String(storedSector || '').trim();
  if (stored) {
    const link = resolveSectorTableFinvizLink(stored) || tickerMapLink(ticker) || firstResolvableComponentLink(stored);
    return {
      label: stored,
      etf: link?.ticker || null,
      url: link?.url || null,
      source: 'stored',
    };
  }

  const sectorKey = getTickerSectorKey(ticker);
  if (!sectorKey) return null;

  const meta = FINVIZ_SECTOR_META[sectorKey];
  const etf = tickerEtf(ticker, sectorKey);
  return {
    label: meta.labelHe,
    etf,
    url: buildSectorTableFinvizUrl(etf),
    source: 'map',
    sectorKey,
  };
}
