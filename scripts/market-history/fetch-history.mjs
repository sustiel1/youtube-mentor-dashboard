#!/usr/bin/env node
// Re-runnable historical market/macro data fetcher. Node built-ins only (global fetch, fs, path).
// Run: node scripts/market-history/fetch-history.mjs
//
// Output: scripts/market-history/data/market-history.json (gitignored — see ./.gitignore)
// A second run adds only new days per series (reads the existing manifest's last date and
// requests forward from there) instead of re-pulling full history.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT_PATH = path.join(DATA_DIR, 'market-history.json');
const TMP_PATH = path.join(DATA_DIR, '.market-history.json.tmp');

const UA = 'Mozilla/5.0';
const EARLIEST_FALLBACK = '1990-01-01'; // used only when there is no prior run to resume from

// --- source configs -------------------------------------------------------

// Equities/ETFs: fetch both raw close and dividend-adjusted close from Yahoo.
const EQUITY_TICKERS = [
  'SPY', 'QQQ', 'TLT', 'IEF',
  'XLK', 'XLC', 'XLY', 'XLF', 'XLI', 'XLV', 'XLP', 'XLB', 'XLRE', 'XLU', 'XLE',
];

// Index levels: no dividends, only a level value.
const INDEX_TICKERS = { VIX: '^VIX', VIX9D: '^VIX9D', VIX3M: '^VIX3M' };

// FRED series (fredgraph.csv, no API key). Verified reachable in the Phase 1 probe.
const FRED_SERIES = {
  DGS10: { label: '10-year Treasury yield' },
  DGS2: { label: '2-year Treasury yield' },
  DFEDTARU: { label: 'Fed funds target rate — upper bound (from Dec 2008; pre-2008 not covered by this series, see agent notes for DFEDTAR/FEDFUNDS alternatives)' },
  CPILFESL: { label: 'Core CPI (CPI less food & energy), monthly, reference date = 1st of month' },
  UNRATE: { label: 'Unemployment rate, monthly' },
  ICSA: { label: 'Initial jobless claims, weekly' },
  UMCSENT: { label: 'U. Michigan consumer sentiment, monthly' },
  DTWEXBGS: { label: 'Trade-weighted US dollar index (broad, goods & services)' },
  BAMLH0A0HYM2: { label: 'ICE BofA US High Yield OAS spread — FRED history restarts 2023-09-05 after an ICE licensing gap; NOT 10+ years, flagged in validation' },
  BAA10Y: { label: 'PROXY, NOT HIGH-YIELD — Moody\'s Baa (investment-grade, lowest IG tier) corporate bond yield minus 10-year Treasury. Used as a long-history (1986+) credit-stress proxy because no free genuine junk/high-yield spread series has usable history (BAMLH0A0HYM2/EY both restart 2023-09-05, ICE licensing gap). Kept alongside BAMLH0A0HYM2 deliberately so the two can be compared where they overlap (2023-09-05+) to gauge how well this proxy tracks real HY stress. Any consumer/display of this series must label it "proxy" and never present it as a high-yield spread.' },
};

// ALFRED release-calendar pages (HTML scrape, no key). Release IDs verified via each page's <h1>
// during the Phase 1 probe — do not add an ID here without the same verification.
const ALFRED_RELEASES = {
  CPI: { rid: 10, expectedTitle: 'Consumer Price Index' },
  EMPLOYMENT_SITUATION: { rid: 50, expectedTitle: 'Employment Situation' },
  INITIAL_CLAIMS: { rid: 180, expectedTitle: 'Unemployment Insurance Weekly Claims Report' },
  // University of Michigan Consumer Sentiment release ID was NOT identified with confidence in
  // the Phase 1 probe (a guessed ID landed on the wrong report). Left out rather than guessed.
};

const FOMC_CALENDAR_URL = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';

// --- helpers ----------------------------------------------------------------

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function dateToEpoch(isoDate) {
  return Math.floor(new Date(`${isoDate}T00:00:00Z`).getTime() / 1000);
}

async function fetchText(url, { ua } = {}) {
  const headers = ua ? { 'User-Agent': ua } : {};
  const res = await fetch(url, { headers });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

async function fetchJson(url, opts) {
  const { ok, status, body } = await fetchText(url, opts);
  if (!ok) return { ok: false, status, error: `HTTP ${status}` };
  try {
    return { ok: true, status, data: JSON.parse(body) };
  } catch (e) {
    return { ok: false, status, error: `bad JSON: ${e.message}` };
  }
}

function parseFredCsv(csvText, seriesId) {
  const lines = csvText.trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, raw] = lines[i].split(',');
    if (!date || raw === undefined || raw === '.' || raw === '') continue;
    const value = Number(raw);
    if (Number.isNaN(value)) continue;
    rows.push({ date, value });
  }
  return rows;
}

// --- fetchers -----------------------------------------------------------

async function fetchYahooDaily(symbol, { period1, period2 }) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=div,splits`;
  const result = await fetchJson(url, { ua: UA });
  if (!result.ok) return { ok: false, error: result.error };
  const chartResult = result.data?.chart?.result?.[0];
  if (!chartResult) return { ok: false, error: 'empty chart.result' };
  const granularity = chartResult.meta?.dataGranularity;
  if (granularity !== '1d') {
    return { ok: false, error: `unexpected dataGranularity "${granularity}" (expected "1d" — Yahoo downgrades resolution for very large ranges)` };
  }
  const ts = chartResult.timestamp || [];
  const quote = chartResult.indicators?.quote?.[0] || {};
  const adj = chartResult.indicators?.adjclose?.[0]?.adjclose;
  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    const date = toISODate(new Date(ts[i] * 1000));
    const close = quote.close?.[i];
    if (close == null) continue; // non-trading / no bar — omit rather than zero-fill
    rows.push({
      date,
      close,
      adjclose: adj ? adj[i] : null,
      volume: quote.volume?.[i] ?? null,
    });
  }
  return { ok: true, rows, meta: chartResult.meta };
}

async function fetchFredSeries(seriesId, { cosd }) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}${cosd ? `&cosd=${cosd}` : ''}`;
  const { ok, status, body } = await fetchText(url); // no custom UA — see agent notes
  if (!ok) return { ok: false, error: `HTTP ${status}` };
  const rows = parseFredCsv(body, seriesId);
  return { ok: true, rows };
}

async function fetchAlfredReleaseDates(rid, expectedTitle) {
  const { ok, status, body } = await fetchText(`https://alfred.stlouisfed.org/release?rid=${rid}`, { ua: UA });
  if (!ok) return { ok: false, error: `HTTP ${status}` };
  const titleMatch = body.match(/<h1>([^<]*)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  if (!title || !title.toLowerCase().includes(expectedTitle.toLowerCase())) {
    return { ok: false, error: `release id ${rid} title mismatch — got "${title}", expected to contain "${expectedTitle}"` };
  }
  const dates = [...new Set([...body.matchAll(/release-date="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]))].sort();
  return { ok: true, title, dates };
}

// The Fed's site uses three different URL schemes for a meeting's decision-date press
// release across eras — verified against real pages, not assumed:
//   2011-present : monetaryYYYYMMDDa.htm            (bare, on the rolling calendar page)
//   2006-2010    : newsevents/press/monetary/YYYYMMDDa.htm
//   2002-2005    : boarddocs/press/monetary/YYYY/YYYYMMDD/ (no "a.htm" suffix)
// Before 2002 the FOMC did not consistently issue a same-day statement with this URL
// shape (statements after every meeting only became standard practice in 1999, and the
// pre-2002 archive pages use a different, unverified structure) — not scraped here.
const FOMC_ARCHIVE_EARLIEST_YEAR = 2002;

function extractMonetaryDates(html) {
  const modernOrMid = [...html.matchAll(/monetary\/?(\d{8})[ab]?\.htm/g)].map((m) => m[1]);
  const boarddocs = [...html.matchAll(/boarddocs\/press\/monetary\/\d{4}\/(\d{8})/g)].map((m) => m[1]);
  return [...modernOrMid, ...boarddocs];
}

async function fetchFomcMeetingDates() {
  const { ok, status, body } = await fetchText(FOMC_CALENDAR_URL, { ua: UA });
  if (!ok) return { ok: false, error: `HTTP ${status}` };
  const years = [...body.matchAll(/<a id="\d+">(\d{4}) FOMC Meetings<\/a>/g)].map((m) => m[1]);
  const currentPageEarliestYear = Math.min(...years.map(Number));

  const rawDatesSet = new Set(extractMonetaryDates(body));
  const archiveErrors = [];
  for (let y = FOMC_ARCHIVE_EARLIEST_YEAR; y < currentPageEarliestYear; y++) {
    const res = await fetchText(`https://www.federalreserve.gov/monetarypolicy/fomchistorical${y}.htm`, { ua: UA });
    if (!res.ok) { archiveErrors.push(`${y}: HTTP ${res.status}`); continue; }
    for (const d of extractMonetaryDates(res.body)) rawDatesSet.add(d);
  }

  const dates = [...rawDatesSet]
    .map((d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`)
    .sort();
  return {
    ok: true,
    years: [...new Set(years)].sort(),
    dates,
    archiveEarliestYear: FOMC_ARCHIVE_EARLIEST_YEAR,
    archiveErrors,
  };
}

// --- manifest / incremental resume ---------------------------------------

async function loadExisting() {
  try {
    const raw = await fs.readFile(OUTPUT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// The persisted file has exactly one shape (rows aligned on trading dates — see the
// "one file, one shape" requirement). To resume incrementally on the next run we rebuild
// each series' flat array from those rows rather than persisting a second, redundant shape.
function deriveSeriesDataFromRows(existing) {
  const seriesData = {};
  if (!existing?.rows) return seriesData;
  const dates = Object.keys(existing.rows).sort();
  for (const date of dates) {
    const row = existing.rows[date];
    for (const [key, val] of Object.entries(row)) {
      if (!seriesData[key]) seriesData[key] = [];
      if (val && typeof val === 'object') {
        seriesData[key].push({ date, close: val.close, adjclose: val.adjclose, volume: val.volume });
      } else {
        seriesData[key].push({ date, value: val });
      }
    }
  }
  return seriesData;
}

// --- main -----------------------------------------------------------------

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const existing = await loadExisting();
  const now = new Date();
  const nowEpoch = Math.floor(now.getTime() / 1000);
  const runLog = { series: {}, errors: [] };

  const seriesData = deriveSeriesDataFromRows(existing);
  const seriesMeta = existing?.manifest?.series ? { ...existing.manifest.series } : {};

  // --- equities ---
  for (const symbol of EQUITY_TICKERS) {
    const prior = seriesData[symbol];
    const period1 = prior?.length
      ? dateToEpoch(prior[prior.length - 1].date) + 86400
      : dateToEpoch(EARLIEST_FALLBACK);
    if (period1 >= nowEpoch) { runLog.series[symbol] = 'up to date'; continue; }
    const res = await fetchYahooDaily(symbol, { period1, period2: nowEpoch });
    if (!res.ok) { runLog.errors.push(`${symbol}: ${res.error}`); continue; }
    const merged = prior ? [...prior, ...res.rows] : res.rows;
    seriesData[symbol] = merged;
    seriesMeta[symbol] = {
      source: 'Yahoo Finance chart API (query1.finance.yahoo.com)',
      fetched_at: now.toISOString(),
      first_date: merged[0]?.date ?? null,
      last_date: merged[merged.length - 1]?.date ?? null,
      count: merged.length,
      adjustment: 'both stored — "close" is raw unadjusted, "adjclose" is dividend-adjusted',
    };
    runLog.series[symbol] = `+${res.rows.length} rows`;
  }

  // --- index levels ---
  for (const [key, symbol] of Object.entries(INDEX_TICKERS)) {
    const prior = seriesData[key];
    const period1 = prior?.length
      ? dateToEpoch(prior[prior.length - 1].date) + 86400
      : dateToEpoch(EARLIEST_FALLBACK);
    if (period1 >= nowEpoch) { runLog.series[key] = 'up to date'; continue; }
    const res = await fetchYahooDaily(symbol, { period1, period2: nowEpoch });
    if (!res.ok) { runLog.errors.push(`${key}: ${res.error}`); continue; }
    const merged = prior ? [...prior, ...res.rows] : res.rows;
    seriesData[key] = merged;
    seriesMeta[key] = {
      source: `Yahoo Finance chart API (symbol ${symbol})`,
      fetched_at: now.toISOString(),
      first_date: merged[0]?.date ?? null,
      last_date: merged[merged.length - 1]?.date ?? null,
      count: merged.length,
      adjustment: 'index level, not a price — no dividend adjustment concept',
    };
    runLog.series[key] = `+${res.rows.length} rows`;
  }

  // --- FRED macro series ---
  for (const [seriesId, cfg] of Object.entries(FRED_SERIES)) {
    const res = await fetchFredSeries(seriesId, {});
    if (!res.ok) { runLog.errors.push(`${seriesId}: ${res.error}`); continue; }
    seriesData[seriesId] = res.rows;
    seriesMeta[seriesId] = {
      source: 'FRED fredgraph.csv (fred.stlouisfed.org), no API key',
      fetched_at: now.toISOString(),
      first_date: res.rows[0]?.date ?? null,
      last_date: res.rows[res.rows.length - 1]?.date ?? null,
      count: res.rows.length,
      label: cfg.label,
      date_semantics: 'observation_date as published by FRED (reference period), NOT a verified publication/release date',
    };
    runLog.series[seriesId] = `${res.rows.length} rows (full re-pull — FRED CSV has no incremental range API used here)`;
  }

  // --- ALFRED release dates (best-effort, verified release IDs only) ---
  const alfredReleaseDates = {};
  for (const [key, cfg] of Object.entries(ALFRED_RELEASES)) {
    const res = await fetchAlfredReleaseDates(cfg.rid, cfg.expectedTitle);
    if (!res.ok) { runLog.errors.push(`ALFRED ${key}: ${res.error}`); continue; }
    alfredReleaseDates[key] = { rid: cfg.rid, title: res.title, dates: res.dates };
    runLog.series[`ALFRED_${key}`] = `${res.dates.length} release dates`;
  }

  // --- FOMC meeting dates ---
  const fomc = await fetchFomcMeetingDates();
  if (!fomc.ok) runLog.errors.push(`FOMC: ${fomc.error}`);

  // --- assemble output ---
  const tradingDates = [...new Set((seriesData.SPY || []).map((r) => r.date))].sort();

  const output = {
    manifest: {
      generated_at: now.toISOString(),
      trading_date_axis: 'union of SPY trading dates (Yahoo)',
      alignment_rule:
        'rows are keyed by SPY trading dates — the file has exactly one shape (no separate raw-series block). ' +
        'Daily price/index series (equities, VIX family) attach to their own date via exact match. FRED macro series ' +
        'report on their own calendar (month-start, week-ending Saturday, etc.) that rarely lands on an exact trading ' +
        'date, so each observation is attached to the FIRST trading date on/after its own reference date (never ' +
        'looked back — a value never appears before its own reference date), one assignment per observation, no ' +
        'carry-forward/forward-fill afterward. IMPORTANT: this uses the FRED reference date, NOT a verified publication ' +
        'date — a value can therefore appear on the row several days before the figure was actually released, which ' +
        'is a look-ahead risk for any backtest. alfred_release_dates carries the real scraped publication dates for ' +
        'CPI/Employment/Claims separately (not yet cross-joined into rows in this P0). fomc_meeting_dates is a ' +
        'separate event list, also not merged into rows.',
      series: seriesMeta,
      alfred_release_dates_note: 'HTML-scraped from alfred.stlouisfed.org, no API key. University of Michigan Consumer Sentiment release ID was not identified with confidence and is omitted.',
      fomc_note: fomc.ok
        ? `HTML-scraped from ${FOMC_CALENDAR_URL} (rolling years: ${fomc.years.join(', ')}) plus the per-year archive fomchistorical<YYYY>.htm for ${fomc.archiveEarliestYear}-${Math.min(...fomc.years.map(Number)) - 1} (three URL eras handled: bare monetaryYYYYMMDDa.htm 2011+, newsevents/press/monetary/YYYYMMDDa.htm 2006-2010, boarddocs/press/monetary/YYYY/YYYYMMDD/ 2002-2005). Pre-2002 not scraped — the FOMC did not consistently issue a same-day statement under a verified URL pattern before then.${fomc.archiveErrors.length ? ` Archive fetch errors: ${fomc.archiveErrors.join('; ')}` : ''}`
        : `fetch failed: ${fomc.error}`,
    },
    trading_dates: tradingDates,
    rows: buildRows(tradingDates, seriesData),
    alfred_release_dates: alfredReleaseDates,
    fomc_meeting_dates: fomc.ok ? fomc.dates : [],
  };

  await fs.writeFile(TMP_PATH, JSON.stringify(output, null, 2), 'utf8');
  await fs.rename(TMP_PATH, OUTPUT_PATH); // atomic replace — never leaves a half-written output file

  console.log('=== fetch-history run summary ===');
  for (const [k, v] of Object.entries(runLog.series)) console.log(`  ${k}: ${v}`);
  if (runLog.errors.length) {
    console.log('--- errors (per-series, did not abort the run) ---');
    for (const e of runLog.errors) console.log(`  ${e}`);
  }
  const stat = await fs.stat(OUTPUT_PATH);
  console.log(`\nOutput: ${OUTPUT_PATH}`);
  console.log(`Size: ${stat.size} bytes`);
}

function buildRows(tradingDates, seriesData) {
  const rows = {};
  for (const date of tradingDates) rows[date] = {};
  if (tradingDates.length === 0) return rows;
  const windowStart = tradingDates[0];

  for (const [key, arr] of Object.entries(seriesData)) {
    const isPriceSeries = arr.length > 0 && 'close' in arr[0];
    if (isPriceSeries) {
      // Daily price/index series already live on the same trading calendar — exact match only.
      const tradingSet = new Set(tradingDates);
      for (const rec of arr) {
        if (!tradingSet.has(rec.date)) continue;
        rows[rec.date][key] = { close: rec.close, adjclose: rec.adjclose, volume: rec.volume };
      }
    } else {
      // FRED macro series report on their own calendar (month-start, week-ending Saturday, etc.)
      // that rarely lands on an exact trading date. Attach each observation to the FIRST trading
      // date on/after its own reference date (never look back, to avoid predating the value before
      // it existed) — one assignment per observation, no forward-fill/carry-forward across days.
      let ptr = 0;
      for (const rec of arr) {
        if (rec.date < windowStart) continue; // outside the trading-date window, not represented
        while (ptr < tradingDates.length && tradingDates[ptr] < rec.date) ptr++;
        if (ptr >= tradingDates.length) break;
        rows[tradingDates[ptr]][key] = rec.value;
      }
    }
  }
  return rows;
}

main().catch((err) => {
  console.error('fetch-history run failed:', err);
  process.exitCode = 1;
});
