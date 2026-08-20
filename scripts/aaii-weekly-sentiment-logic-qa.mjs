import assert from 'node:assert/strict';
import {
  AAII_WEEKLY_SENTIMENT_TOTAL_TOLERANCE,
  buildAaiiWeeklyRecord,
  createEmptyAaiiWeeklyStore,
  formatDisplayDate,
  formatLocalDateOnly,
  formatWeeklyPeriodLabel,
  getLatestApplicableAaiiWeeklyRecord,
  getWeeklyPeriod,
  listAaiiWeeklyRecordsDescending,
  normalizeAaiiPercentInput,
  resolveWeeklyWednesday,
  toLocalDateOnly,
  upsertAaiiWeeklyRecord,
  validateAaiiWeeklyDraft,
} from '../src/lib/aaiiWeeklySentiment.js';

// --- percentage validation ---
assert.equal(normalizeAaiiPercentInput(0), 0);
assert.equal(normalizeAaiiPercentInput(100), 100);
assert.equal(normalizeAaiiPercentInput('49.5'), 49.5);
for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, 101, null, undefined, '']) {
  assert.equal(normalizeAaiiPercentInput(bad), null);
}

const ok = validateAaiiWeeklyDraft({ bullish: 49.5, neutral: 22.3, bearish: 28.2 });
assert.equal(ok.valid, true);
assert.equal(ok.total, 100);

const okTolerance = validateAaiiWeeklyDraft({ bullish: 49.7, neutral: 22.1, bearish: 28.3 });
assert.equal(okTolerance.valid, true);
assert.ok(Math.abs(okTolerance.total - 100.1) < 1e-9);
assert.ok(Math.abs(okTolerance.total - 100) <= AAII_WEEKLY_SENTIMENT_TOTAL_TOLERANCE);

const badTotal = validateAaiiWeeklyDraft({ bullish: 60, neutral: 30, bearish: 30 });
assert.equal(badTotal.valid, false);
assert.match(badTotal.error, /100/);

// missing/invalid values are never inferred or fabricated
for (const draft of [
  { bullish: 49.5, neutral: 22.3 }, // missing bearish
  { bullish: 49.5, neutral: 22.3, bearish: '' },
  { bullish: Number.NaN, neutral: 22.3, bearish: 28.2 },
  { bullish: -1, neutral: 22.3, bearish: 78.7 },
  { bullish: 49.5, neutral: 22.3, bearish: 101 },
]) {
  const result = validateAaiiWeeklyDraft(draft);
  assert.equal(result.valid, false);
}

// boundary 0/100
assert.equal(validateAaiiWeeklyDraft({ bullish: 0, neutral: 0, bearish: 100 }).valid, true);
assert.equal(validateAaiiWeeklyDraft({ bullish: 100, neutral: 0, bearish: 0 }).valid, true);

// --- local-date parsing avoids UTC drift ---
const parsed = toLocalDateOnly('2026-02-18');
assert.equal(parsed.getFullYear(), 2026);
assert.equal(parsed.getMonth(), 1); // February, 0-indexed
assert.equal(parsed.getDate(), 18);
assert.equal(formatLocalDateOnly(parsed), '2026-02-18');
assert.equal(toLocalDateOnly('not-a-date'), null);
assert.equal(formatDisplayDate('2026-02-18'), '18/02/2026');

// --- Wednesday boundary calculation (dates before/after Wednesday) ---
// 2026-02-18 is a Wednesday.
const wedCases = [
  ['2026-02-15', '2026-02-11'], // Sunday -> previous Wednesday (2026-02-11)
  ['2026-02-16', '2026-02-11'], // Monday
  ['2026-02-17', '2026-02-11'], // Tuesday
  ['2026-02-18', '2026-02-18'], // Wednesday itself -> same date
  ['2026-02-19', '2026-02-18'], // Thursday -> that week's Wednesday
  ['2026-02-21', '2026-02-18'], // Saturday -> that week's Wednesday
];
for (const [input, expectedWednesday] of wedCases) {
  const resolved = resolveWeeklyWednesday(input);
  assert.equal(formatLocalDateOnly(resolved), expectedWednesday, `input=${input}`);
}

const period = getWeeklyPeriod('2026-02-19'); // Thursday
assert.deepEqual(period, { weekStart: '2026-02-18', weekEnd: '2026-02-25' });
assert.equal(formatWeeklyPeriodLabel(period.weekStart, period.weekEnd), 'בתוקף מ־18/02/2026 עד 25/02/2026');

// --- record building ---
const built = buildAaiiWeeklyRecord({ bullish: 49.5, neutral: 22.3, bearish: 28.2 }, '2026-02-19', {
  now: new Date(2026, 1, 19, 9, 30),
});
assert.equal(built.valid, true);
assert.equal(built.record.weekStart, '2026-02-18');
assert.equal(built.record.weekEnd, '2026-02-25');
assert.equal(built.record.publicationDate, '2026-02-19');
assert.equal(built.record.bullish, 49.5);

const builtInvalid = buildAaiiWeeklyRecord({ bullish: 60, neutral: 30, bearish: 30 }, '2026-02-19');
assert.equal(builtInvalid.valid, false);

// --- same-week update without duplication vs. new-week record creation ---
let store = createEmptyAaiiWeeklyStore();
const week1 = buildAaiiWeeklyRecord({ bullish: 49.5, neutral: 22.3, bearish: 28.2 }, '2026-02-18', { now: new Date(2026, 1, 18) }).record;
store = upsertAaiiWeeklyRecord(store, week1);
assert.equal(Object.keys(store.records).length, 1);

// Save again for the SAME Wednesday (e.g. corrected later that day) -> must update, not duplicate.
const week1Updated = buildAaiiWeeklyRecord({ bullish: 50, neutral: 20, bearish: 30 }, '2026-02-18', { now: new Date(2026, 1, 18, 12) }).record;
store = upsertAaiiWeeklyRecord(store, week1Updated);
assert.equal(Object.keys(store.records).length, 1, 'same Wednesday must update, not duplicate');
assert.equal(store.records['2026-02-18'].bullish, 50);

// Save for a LATER Wednesday -> must create a new record and keep the earlier one.
const week2 = buildAaiiWeeklyRecord({ bullish: 40, neutral: 30, bearish: 30 }, '2026-02-25', { now: new Date(2026, 1, 25) }).record;
store = upsertAaiiWeeklyRecord(store, week2);
assert.equal(Object.keys(store.records).length, 2, 'a new Wednesday must create a new record');
assert.equal(store.records['2026-02-18'].bullish, 50, 'earlier week must be preserved');

// --- descending order + latest-applicable-not-in-future ---
const descending = listAaiiWeeklyRecordsDescending(store);
assert.deepEqual(descending.map((r) => r.weekStart), ['2026-02-25', '2026-02-18']);

const latestOnWeek1 = getLatestApplicableAaiiWeeklyRecord(store, { now: new Date(2026, 1, 20) });
assert.equal(latestOnWeek1.weekStart, '2026-02-18', 'future week2 must not be applicable yet');

const latestOnWeek2 = getLatestApplicableAaiiWeeklyRecord(store, { now: new Date(2026, 1, 26) });
assert.equal(latestOnWeek2.weekStart, '2026-02-25');

const emptyStoreLatest = getLatestApplicableAaiiWeeklyRecord(createEmptyAaiiWeeklyStore());
assert.equal(emptyStoreLatest, null);

console.log('AAII weekly sentiment logic QA: PASS');
