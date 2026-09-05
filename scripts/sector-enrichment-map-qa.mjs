// QA for TRADINGBRAIN-STOCKS-SECTOR-ENRICHMENT: the ticker->sector static map
// and its shared pure resolver (src/lib/stockSectorEnrichment.js).
//
//   node scripts/sector-enrichment-map-qa.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FINVIZ_SECTOR_META,
  FINVIZ_SECTOR_KEYS,
  TICKER_SECTOR_MAP,
  TICKER_ETF_OVERRIDE,
  getTickerSectorKey,
  resolveStockSectorDisplay,
} from '../src/lib/stockSectorEnrichment.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

// -- 1. No duplicate ticker keys in the source object literal ---------------
// (a plain JS object literal silently keeps only the LAST duplicate key with
// no error -- so this must be checked against the raw source text, not the
// already-deduplicated runtime object.)
check('no duplicate ticker keys in the raw source object literal', () => {
  const source = readFileSync(new URL('../src/lib/stockSectorEnrichment.js', import.meta.url), 'utf8');
  const bodyMatch = source.match(/const TICKER_SECTOR_KEY = \{([\s\S]*?)\n\};/);
  assert.ok(bodyMatch, 'TICKER_SECTOR_KEY object literal not found');
  const body = bodyMatch[1];
  // Matches bare identifiers (AAPL:) and quoted keys ('BRK.B':) followed by a colon.
  const keyPattern = /(?:^|[\s,{])(?:'([A-Z.\-]+)'|([A-Z][A-Z0-9]*))\s*:/g;
  const seen = new Map();
  const dupes = [];
  let m;
  while ((m = keyPattern.exec(body))) {
    const key = m[1] || m[2];
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  for (const [key, n] of seen) if (n > 1) dupes.push(key);
  assert.deepEqual(dupes, [], `duplicate ticker keys found: ${dupes.join(', ')}`);
  assert.ok(seen.size > 100, `expected a substantial ticker map, got ${seen.size} entries`);
});

// -- 2. Every sector key is one of the 11 canonical Finviz sectors ----------
const EXPECTED_SECTOR_KEYS = [
  'Technology', 'Communication Services', 'Consumer Cyclical', 'Consumer Defensive',
  'Healthcare', 'Financial', 'Industrials', 'Energy', 'Basic Materials',
  'Real Estate', 'Utilities',
];

check('FINVIZ_SECTOR_META has exactly the 11 canonical Finviz sector keys', () => {
  assert.deepEqual([...FINVIZ_SECTOR_KEYS].sort(), [...EXPECTED_SECTOR_KEYS].sort());
});

check('every TICKER_SECTOR_MAP value is one of the 11 canonical sector keys', () => {
  const invalid = Object.entries(TICKER_SECTOR_MAP).filter(([, key]) => !EXPECTED_SECTOR_KEYS.includes(key));
  assert.deepEqual(invalid, [], `tickers with an invalid sector key: ${JSON.stringify(invalid)}`);
});

// -- 3. Every sector maps to its correct, exact ETF (per the approved table) -
const EXPECTED_ETF_BY_KEY = {
  Technology: 'XLK',
  'Communication Services': 'XLC',
  'Consumer Cyclical': 'XLY',
  'Consumer Defensive': 'XLP',
  Healthcare: 'XLV',
  Financial: 'XLF',
  Industrials: 'XLI',
  Energy: 'XLE',
  'Basic Materials': 'XLB',
  'Real Estate': 'XLRE',
  Utilities: 'XLU',
};

check('each sector key maps to its exact approved ETF', () => {
  for (const [key, etf] of Object.entries(EXPECTED_ETF_BY_KEY)) {
    assert.equal(FINVIZ_SECTOR_META[key]?.etf, etf, `${key} -> expected ${etf}`);
  }
});

check('each sector key has a non-empty Hebrew label', () => {
  for (const key of FINVIZ_SECTOR_KEYS) {
    assert.ok(String(FINVIZ_SECTOR_META[key]?.labelHe || '').trim(), `${key} missing labelHe`);
  }
});

// -- 4. Resolver: stored value always wins over the map, never overwritten --
check('resolver honours stored-value-first order (keeps stored label even if ticker also maps)', () => {
  const storedLabel = 'Technology (custom stored value)';
  const r = resolveStockSectorDisplay({ ticker: 'AAPL', storedSector: storedLabel });
  assert.equal(r.source, 'stored');
  assert.equal(r.label, storedLabel);
});

check('resolver falls back to the ticker map when no stored value is present', () => {
  const r = resolveStockSectorDisplay({ ticker: 'AAPL' });
  assert.equal(r.source, 'map');
  assert.equal(r.sectorKey, 'Technology');
  assert.equal(r.etf, 'XLK');
  assert.ok(r.url && r.url.includes('XLK'));
});

check('resolver returns a stored value with no link when neither the label nor the ticker resolve (no guessed slug)', () => {
  const storedLabel = 'sector-with-no-known-etf-alias';
  const r = resolveStockSectorDisplay({ ticker: 'ZZZZNOPE', storedSector: storedLabel });
  assert.equal(r.source, 'stored');
  assert.equal(r.label, storedLabel);
  assert.equal(r.url, null);
  assert.equal(r.etf, null);
});

// -- 5. Unknown ticker returns null (renders "-", no link, no console error) -
check('unknown ticker returns null from getTickerSectorKey', () => {
  assert.equal(getTickerSectorKey('ZZZZNOPE'), null);
});

check('unknown ticker + no stored value -> resolver returns null', () => {
  assert.equal(resolveStockSectorDisplay({ ticker: 'ZZZZNOPE' }), null);
});

check('empty/missing ticker -> resolver returns null, no throw', () => {
  assert.equal(resolveStockSectorDisplay({}), null);
  assert.equal(resolveStockSectorDisplay({ ticker: '' }), null);
  assert.equal(resolveStockSectorDisplay(undefined), null);
});

// -- 6. The 8 acceptance-criteria tickers all resolve to their expected sector -
const ACCEPTANCE_TICKERS = {
  DELL: 'Technology',
  GTLB: 'Technology',
  HPQ:  'Technology',
  MDB:  'Technology',
  VRT:  'Industrials',
  CRDO: 'Technology',
  PANW: 'Technology',
  UBER: 'Technology', // Finviz classification; round 4 removed the earlier XLY override -- link now agrees with the label (XLK).
};

check('all 8 acceptance-criteria tickers resolve to their expected sector + link', () => {
  for (const [ticker, expectedKey] of Object.entries(ACCEPTANCE_TICKERS)) {
    const r = resolveStockSectorDisplay({ ticker });
    assert.ok(r, `${ticker} did not resolve at all`);
    assert.equal(r.sectorKey, expectedKey, `${ticker} -> expected ${expectedKey}, got ${r.sectorKey}`);
    assert.equal(r.etf, EXPECTED_ETF_BY_KEY[expectedKey], `${ticker} -> wrong ETF`);
    assert.ok(r.url && r.url.includes(r.etf), `${ticker} -> missing/invalid Finviz URL`);
    assert.ok(r.label && r.label.trim(), `${ticker} -> missing Hebrew label`);
  }
});

// -- 7. Ticker lookup is case-insensitive and trims whitespace --------------
check('getTickerSectorKey is case-insensitive and trims whitespace', () => {
  assert.equal(getTickerSectorKey('aapl'), 'Technology');
  assert.equal(getTickerSectorKey('  AAPL  '), 'Technology');
});

// -- 8. Round 2 (TRADINGBRAIN-STOCKS-SECTOR-ENRICHMENT): automotive alias +
//    ticker-map / first-component link fallback for otherwise-unlinkable
//    stored labels (e.g. "רכב", "רכב וטכנולוגיה"). The label displayed must
//    never change; only the link target may fall through to the ticker map.
const CANONICAL_ETFS = new Set(Object.values(EXPECTED_ETF_BY_KEY));

check('stored label "רכב" resolves to XLY via the extended alias table', () => {
  const r = resolveStockSectorDisplay({ ticker: 'F', storedSector: 'רכב' });
  assert.equal(r.source, 'stored');
  assert.equal(r.label, 'רכב');
  assert.equal(r.etf, 'XLY');
  assert.ok(r.url && r.url.includes('XLY'));
});

check('compound stored label "רכב וטכנולוגיה" resolves to XLY (ticker-map fallback, label unchanged)', () => {
  const r = resolveStockSectorDisplay({ ticker: 'TSLA', storedSector: 'רכב וטכנולוגיה' });
  assert.equal(r.source, 'stored');
  assert.equal(r.label, 'רכב וטכנולוגיה', 'displayed label must stay exactly as stored, never split/altered');
  assert.equal(r.etf, 'XLY');
  assert.ok(r.url && r.url.includes('XLY'));
});

check('F, GM and TSLA all link to XLY for their real stored automotive labels', () => {
  const cases = [
    { ticker: 'F', storedSector: 'רכב' },
    { ticker: 'GM', storedSector: 'רכב' },
    { ticker: 'TSLA', storedSector: 'רכב וטכנולוגיה' },
  ];
  for (const { ticker, storedSector } of cases) {
    const r = resolveStockSectorDisplay({ ticker, storedSector });
    assert.equal(r.etf, 'XLY', `${ticker} (${storedSector}) -> expected XLY, got ${r.etf}`);
    assert.equal(r.label, storedSector, `${ticker} -> displayed label must equal stored text`);
  }
});

check('compound label falls back to the ticker map, not naive component-splitting, when both could apply', () => {
  // TSLA's own ticker-map sector must be what decides the link, not a lucky
  // partial-word alias match -- assert via the ticker map directly.
  assert.equal(getTickerSectorKey('TSLA'), 'Consumer Cyclical');
  assert.equal(getTickerSectorKey('F'), 'Consumer Cyclical');
  assert.equal(getTickerSectorKey('GM'), 'Consumer Cyclical');
});

check('an unknown stored label with an unknown ticker still renders plain text (no link)', () => {
  const r = resolveStockSectorDisplay({ ticker: 'ZZZZNOPE', storedSector: 'מגזר שלא קיים בשום מקום' });
  assert.equal(r.source, 'stored');
  assert.equal(r.label, 'מגזר שלא קיים בשום מקום');
  assert.equal(r.etf, null);
  assert.equal(r.url, null);
});

check('the 3 newly added automotive aliases (רכב / רכב חשמלי / יצרניות רכב) all resolve to one of the 11 canonical sector ETFs', () => {
  for (const label of ['רכב', 'רכב חשמלי', 'יצרניות רכב']) {
    const r = resolveStockSectorDisplay({ ticker: 'ZZZZNOPE', storedSector: label });
    assert.ok(CANONICAL_ETFS.has(r.etf), `${label} -> etf ${r.etf} is not one of the 11 canonical sector ETFs`);
    assert.equal(r.etf, 'XLY', `${label} -> expected XLY`);
  }
});

// -- 9. Round 3 (TRADINGBRAIN-STOCKS-SECTOR-ENRICHMENT): merge the old,
//    finer-grained src/lib/stockSectorMap.js granularity into the resolver.
//    Rule: the more specific label decides the link -- "שבבים" links SMH,
//    generic "טכנולוגיה" still links XLK. On the 17 ticker/ETF disagreements
//    between the old and new maps, the OLD map's ETF wins (SMH/IGV). Round 4
//    removed an earlier UBER exception -> XLY: the user decided a ticker's
//    link must agree with its own displayed label, and UBER's label is
//    "טכנולוגיה", so UBER now falls through to plain XLK like any other
//    unlisted Technology ticker. The displayed label must never change.
check('stored label "שבבים" (Semiconductors) links to SMH, not XLK', () => {
  const r = resolveStockSectorDisplay({ storedSector: 'שבבים' });
  assert.equal(r.label, 'שבבים');
  assert.equal(r.etf, 'SMH');
});

check('stored label "תוכנה" (Software) links to IGV, not XLK', () => {
  const r = resolveStockSectorDisplay({ storedSector: 'תוכנה' });
  assert.equal(r.label, 'תוכנה');
  assert.equal(r.etf, 'IGV');
});

check('stored label "טכנולוגיה" (generic Technology) still links to XLK', () => {
  const r = resolveStockSectorDisplay({ storedSector: 'טכנולוגיה' });
  assert.equal(r.label, 'טכנולוגיה');
  assert.equal(r.etf, 'XLK');
});

check('NVDA, AVGO, AMD resolve to SMH via the ticker-map override (label unchanged)', () => {
  for (const ticker of ['NVDA', 'AVGO', 'AMD']) {
    const r = resolveStockSectorDisplay({ ticker });
    assert.equal(r.etf, 'SMH', `${ticker} -> expected SMH`);
    assert.equal(r.sectorKey, 'Technology', `${ticker} -> sectorKey must stay Technology`);
    assert.equal(r.label, FINVIZ_SECTOR_META.Technology.labelHe, `${ticker} -> synthesized label must stay unchanged`);
  }
});

check('SNOW, ADBE, CRM, ORCL resolve to IGV via the ticker-map override (label unchanged)', () => {
  for (const ticker of ['SNOW', 'ADBE', 'CRM', 'ORCL']) {
    const r = resolveStockSectorDisplay({ ticker });
    assert.equal(r.etf, 'IGV', `${ticker} -> expected IGV`);
    assert.equal(r.sectorKey, 'Technology', `${ticker} -> sectorKey must stay Technology`);
    assert.equal(r.label, FINVIZ_SECTOR_META.Technology.labelHe, `${ticker} -> synthesized label must stay unchanged`);
  }
});

check('UBER resolves to XLK (round 4: no override -- link agrees with its own Technology label)', () => {
  const r = resolveStockSectorDisplay({ ticker: 'UBER' });
  assert.equal(r.etf, 'XLK');
  assert.equal(r.sectorKey, 'Technology');
  assert.equal(r.label, FINVIZ_SECTOR_META.Technology.labelHe);
  assert.equal(TICKER_ETF_OVERRIDE.UBER, undefined, 'UBER must not appear in TICKER_ETF_OVERRIDE');
});

check('stored label "רכב" still links to XLY (round 2, re-asserted here per round-3 request)', () => {
  const r = resolveStockSectorDisplay({ ticker: 'F', storedSector: 'רכב' });
  assert.equal(r.label, 'רכב');
  assert.equal(r.etf, 'XLY');
});

check('TICKER_ETF_OVERRIDE has exactly the 17 named tickers, each -> SMH or IGV only (round 4: no UBER/XLY entry)', () => {
  const allowedEtfs = new Set(['SMH', 'IGV']);
  const entries = Object.entries(TICKER_ETF_OVERRIDE);
  assert.equal(entries.length, 17, `expected exactly 17 override entries, got ${entries.length}`);
  for (const [ticker, etf] of entries) {
    assert.ok(allowedEtfs.has(etf), `${ticker} -> ${etf} is not one of SMH/IGV`);
  }
  const smhTickers = ['NVDA', 'AMD', 'INTC', 'AVGO', 'QCOM', 'MU', 'AMAT', 'LRCX', 'KLAC', 'MRVL', 'ARM'];
  const igvTickers = ['ADBE', 'CRM', 'ORCL', 'PLTR', 'NOW', 'SNOW'];
  for (const t of smhTickers) assert.equal(TICKER_ETF_OVERRIDE[t], 'SMH', `${t} -> expected SMH`);
  for (const t of igvTickers) assert.equal(TICKER_ETF_OVERRIDE[t], 'IGV', `${t} -> expected IGV`);
  assert.ok(!('UBER' in TICKER_ETF_OVERRIDE), 'UBER must not be in TICKER_ETF_OVERRIDE');
});

// -- 10. Round-2 QA gap closed: direct unit test for firstResolvableComponentLink
//    (only reachable when the full stored label AND the ticker both fail to
//    resolve, so the resolver must split the label and try each component).
check('firstResolvableComponentLink is exercised directly: an unresolvable compound label with an unknown ticker still finds "רכב" as its first resolvable component', () => {
  const storedLabel = 'רכב מפואר בלתי ידוע';
  const r = resolveStockSectorDisplay({ ticker: 'ZZZZNOPE', storedSector: storedLabel });
  assert.equal(r.source, 'stored');
  assert.equal(r.label, storedLabel, 'displayed label must stay exactly as stored, never split/altered');
  assert.equal(r.etf, 'XLY', 'must fall through to the first resolvable component ("רכב")');
  assert.ok(r.url && r.url.includes('XLY'));
});

check('firstResolvableComponentLink is skipped when the label has no resolvable component at all (falls through to plain text)', () => {
  const storedLabel = 'מגזר דמיוני לגמרי לא קיים בשום מקום';
  const r = resolveStockSectorDisplay({ ticker: 'ZZZZNOPE', storedSector: storedLabel });
  assert.equal(r.label, storedLabel);
  assert.equal(r.etf, null);
  assert.equal(r.url, null);
});

console.log(`\n${count}/${count} sector-enrichment-map-qa checks passed`);
