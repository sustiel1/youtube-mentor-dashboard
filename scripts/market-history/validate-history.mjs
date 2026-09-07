#!/usr/bin/env node
// Validation pass over scripts/market-history/data/market-history.json.
// Reports raw numbers — does not repair anything. Run after fetch-history.mjs:
//   node scripts/market-history/validate-history.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, 'data', 'market-history.json');

// --- simple US market holiday approximation (fixed federal holidays + Good Friday) ---
// This models the standard annual NYSE holiday schedule only. It does NOT model one-off
// irregular closures (e.g. 9/11/2001, Hurricane Sandy 2012, a day of mourning) — those will
// show up as extra "missing trading days" below, which is correct: they are real closures,
// not data bugs, and are reported rather than silently filtered out.

function nthWeekdayOfMonth(year, month, weekday, n) {
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (true) {
    if (d.getUTCDay() === weekday) { count++; if (count === n) return new Date(d); }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}
function lastWeekdayOfMonth(year, month, weekday) {
  const d = new Date(Date.UTC(year, month + 1, 0));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
function easterSunday(year) {
  // Anonymous Gregorian algorithm
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
}
function toISO(d) { return d.toISOString().slice(0, 10); }
function observedIfWeekend(d) {
  const day = d.getUTCDay();
  if (day === 6) { const x = new Date(d); x.setUTCDate(x.getUTCDate() - 1); return x; } // Sat -> Fri
  if (day === 0) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + 1); return x; } // Sun -> Mon
  return d;
}

function usMarketHolidays(year) {
  const list = [
    observedIfWeekend(new Date(Date.UTC(year, 0, 1))),           // New Year's Day
    nthWeekdayOfMonth(year, 0, 1, 3),                             // MLK Day
    nthWeekdayOfMonth(year, 1, 1, 3),                             // Presidents Day
    (() => { const e = easterSunday(year); const gf = new Date(e); gf.setUTCDate(e.getUTCDate() - 2); return gf; })(), // Good Friday
    lastWeekdayOfMonth(year, 4, 1),                               // Memorial Day
    observedIfWeekend(new Date(Date.UTC(year, 5, 19))),           // Juneteenth (obs. since 2022)
    observedIfWeekend(new Date(Date.UTC(year, 6, 4))),            // Independence Day
    nthWeekdayOfMonth(year, 8, 1, 1),                             // Labor Day
    nthWeekdayOfMonth(year, 10, 4, 4),                            // Thanksgiving
    observedIfWeekend(new Date(Date.UTC(year, 11, 25))),          // Christmas
  ];
  return new Set(list.map(toISO).filter((iso) => {
    // Juneteenth wasn't a market holiday before 2022 — drop it for earlier years.
    if (iso.slice(5) === '06-19' && year < 2022) return false;
    return true;
  }));
}

function isWeekend(dateStr) {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function addDaysISO(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

// --- main -------------------------------------------------------------

async function main() {
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  const report = { missing_trading_days: [], duplicate_dates: {}, suspicious_moves: [], start_date_mismatches: [], short_series: [] };

  const tradingDates = data.trading_dates;
  const tradingSet = new Set(tradingDates);

  // 1. Missing trading days vs. US calendar (approximate holiday schedule above).
  if (tradingDates.length) {
    const startYear = Number(tradingDates[0].slice(0, 4));
    const endYear = Number(tradingDates[tradingDates.length - 1].slice(0, 4));
    const holidaySet = new Set();
    for (let y = startYear; y <= endYear; y++) for (const h of usMarketHolidays(y)) holidaySet.add(h);
    let cursor = tradingDates[0];
    const last = tradingDates[tradingDates.length - 1];
    while (cursor <= last) {
      if (!isWeekend(cursor) && !holidaySet.has(cursor) && !tradingSet.has(cursor)) {
        report.missing_trading_days.push(cursor);
      }
      cursor = addDaysISO(cursor, 1);
    }
  }

  // 2. Duplicate dates within each raw fetched series (reconstruct from rows).
  const seenPerSeries = {};
  for (const date of tradingDates) {
    for (const key of Object.keys(data.rows[date])) {
      seenPerSeries[key] = seenPerSeries[key] || new Set();
    }
  }
  // rows are keyed uniquely by trading date already (object keys can't duplicate), so true
  // duplicate-date detection has to happen against the manifest's raw counts vs. unique dates
  // implied by first/last date span; report any series where manifest.count looks internally
  // inconsistent with a monotonic date range (a cheap smell test, not a full re-scan).
  for (const [key, meta] of Object.entries(data.manifest.series)) {
    if (!meta.first_date || !meta.last_date) continue;
    const spanDays = (new Date(meta.last_date) - new Date(meta.first_date)) / 86400000 + 1;
    if (meta.count > spanDays) {
      report.duplicate_dates[key] = { count: meta.count, span_days: Math.round(spanDays), note: 'count exceeds calendar days in range — likely duplicate observation dates' };
    }
  }

  // 3. Suspicious single-day moves (price/index series only).
  const PRICE_MOVE_THRESHOLD = 0.15; // 15% for equities/ETFs
  const VIX_MOVE_THRESHOLD = 0.5;    // 50% for VIX family (naturally spiky)
  const priceKeys = Object.keys(data.manifest.series).filter((k) => data.manifest.series[k].adjustment && data.manifest.series[k].adjustment.includes('adjusted') || data.manifest.series[k].adjustment === 'index level, not a price — no dividend adjustment concept');
  let prevByKey = {};
  for (const date of tradingDates) {
    const row = data.rows[date];
    for (const key of priceKeys) {
      const rec = row[key];
      if (!rec || rec.close == null) continue;
      const prev = prevByKey[key];
      if (prev != null && prev > 0) {
        const pct = (rec.close - prev) / prev;
        const threshold = key.startsWith('VIX') ? VIX_MOVE_THRESHOLD : PRICE_MOVE_THRESHOLD;
        if (Math.abs(pct) > threshold) {
          report.suspicious_moves.push({ series: key, date, pct: Number((pct * 100).toFixed(2)) });
        }
      }
      prevByKey[key] = rec.close;
    }
  }

  // 4. Start-date mismatches among the equity/ETF universe (relative to SPY).
  const spyStart = data.manifest.series.SPY?.first_date;
  for (const [key, meta] of Object.entries(data.manifest.series)) {
    if (!meta.first_date || key === 'SPY') continue;
    if (!meta.adjustment) continue; // only price/index series carry "adjustment"
    const gapYears = (new Date(meta.first_date) - new Date(spyStart)) / (365.25 * 86400000);
    if (gapYears > 1) {
      report.start_date_mismatches.push({ series: key, first_date: meta.first_date, years_after_spy: Number(gapYears.toFixed(1)) });
    }
  }

  // 5. Series shorter than 10 years.
  for (const [key, meta] of Object.entries(data.manifest.series)) {
    if (!meta.first_date || !meta.last_date) continue;
    const years = (new Date(meta.last_date) - new Date(meta.first_date)) / (365.25 * 86400000);
    if (years < 10) {
      report.short_series.push({ series: key, first_date: meta.first_date, last_date: meta.last_date, years: Number(years.toFixed(1)) });
    }
  }

  console.log(JSON.stringify(report, null, 2));

  console.log('\n=== summary ===');
  console.log(`missing_trading_days: ${report.missing_trading_days.length}`);
  console.log(`duplicate_dates flags: ${Object.keys(report.duplicate_dates).length}`);
  console.log(`suspicious_moves: ${report.suspicious_moves.length}`);
  console.log(`start_date_mismatches: ${report.start_date_mismatches.length}`);
  console.log(`short_series (<10y): ${report.short_series.length}`);
}

main().catch((err) => {
  console.error('validate-history run failed:', err);
  process.exitCode = 1;
});
