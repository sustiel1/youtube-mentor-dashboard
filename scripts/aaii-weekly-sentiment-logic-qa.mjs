import assert from 'node:assert/strict';
import {
  AAII_FRESHNESS_STATES,
  AAII_SPREAD_NOT_FORECAST_TEXT,
  AAII_WEEKLY_SENTIMENT_TOTAL_TOLERANCE,
  AAII_WEEKLY_SENTIMENT_SPREAD_TOLERANCE,
  buildAaiiWeeklyRecord,
  classifyAaiiSpread,
  createEmptyAaiiWeeklyStore,
  formatAaiiSpread,
  formatDisplayDate,
  formatLocalDateOnly,
  formatWeeklyPeriodLabel,
  getLatestApplicableAaiiWeeklyRecord,
  getAaiiSpreadInterpretation,
  getWeeklyPeriod,
  listAaiiWeeklyRecordsDescending,
  normalizeAaiiPercentInput,
  parseAaiiResultsLine,
  resolveAaiiDisplaySpread,
  resolveAaiiFreshness,
  resolveWeeklyWednesday,
  toLocalDateOnly,
  upsertAaiiWeeklyRecord,
  validateAaiiWeeklyDraft,
} from '../src/lib/aaiiWeeklySentiment.js';

const VALID_AAII_LINE = 'Bullish 35.5% Avg 37.5% Neutral 24.6% Avg 31.0% Bearish 39.9% Avg 31.5% ▼ Bull–Bear Spread: -4.4 pp';

// --- complete copied-line parsing ---
const parsedLine = parseAaiiResultsLine(VALID_AAII_LINE);
assert.equal(parsedLine.valid, true);
assert.deepEqual(
  {
    bullish: parsedLine.bullish,
    bullishAverage: parsedLine.bullishAverage,
    neutral: parsedLine.neutral,
    neutralAverage: parsedLine.neutralAverage,
    bearish: parsedLine.bearish,
    bearishAverage: parsedLine.bearishAverage,
    bullBearSpread: parsedLine.bullBearSpread,
    sentiment: parsedLine.sentiment,
  },
  {
    bullish: 35.5,
    bullishAverage: 37.5,
    neutral: 24.6,
    neutralAverage: 31,
    bearish: 39.9,
    bearishAverage: 31.5,
    bullBearSpread: -4.4,
    sentiment: 'bearish',
  },
);

const whitespaceLine = `\n  Bullish   35.5 %\n Avg 37.5%  Neutral 24.6%\nAvg 31.0% Bearish 39.9% Avg 31.5%\n▼ Bull–Bear Spread: -4.4 pp  \n`;
assert.equal(parseAaiiResultsLine(whitespaceLine).valid, true);

const unicodeMinusLine = VALID_AAII_LINE.replace('-4.4', '−4.4');
assert.equal(parseAaiiResultsLine(unicodeMinusLine).bullBearSpread, -4.4);

const missingFieldLine = 'Bullish 35.5% Avg 37.5% Neutral 24.6% Bearish 39.9% Avg 31.5% ▼ Bull–Bear Spread: -4.4 pp';
const missingField = parseAaiiResultsLine(missingFieldLine);
assert.equal(missingField.valid, false);
assert.match(missingField.error, /שבעת השדות/);

const invalidTotalLine = 'Bullish 50.0% Avg 37.5% Neutral 30.0% Avg 31.0% Bearish 30.0% Avg 31.5% ▼ Bull–Bear Spread: 20.0 pp';
const invalidTotal = parseAaiiResultsLine(invalidTotalLine);
assert.equal(invalidTotal.valid, false);
assert.match(invalidTotal.error, /100/);

const spreadMismatchLine = VALID_AAII_LINE.replace('-4.4 pp', '-3.4 pp');
const spreadMismatch = parseAaiiResultsLine(spreadMismatchLine);
assert.equal(spreadMismatch.valid, false);
assert.match(spreadMismatch.error, /אינו תואם/);
assert.equal(AAII_WEEKLY_SENTIMENT_SPREAD_TOLERANCE, 0.1);

// Classification delegates to the application's existing signed-value tone rules.
assert.equal(classifyAaiiSpread(-4.4), 'bearish');
assert.equal(classifyAaiiSpread(4.4), 'bullish');
assert.equal(classifyAaiiSpread(0), 'neutral');

// Intensity is additive to the canonical signed direction classification.
const expectedInterpretations = [
  [-11, 'bearish', 'strong', 'דובי חזק', 'הרבה יותר משקיעים מצפים לירידות מאשר לעליות.'],
  [-10, 'bearish', 'moderate', 'דובי מתון', 'יש בבירור יותר משקיעים שמצפים לירידות מאשר לעליות.'],
  [-5, 'bearish', 'light', 'דובי קל', 'יש מעט יותר משקיעים שמצפים לירידות מאשר לעליות.'],
  [-2, 'neutral', 'neutral', 'ניטרלי', 'שיעור המשקיעים שמצפים לעליות ולירידות כמעט מאוזן.'],
  [0, 'neutral', 'neutral', 'ניטרלי', 'שיעור המשקיעים שמצפים לעליות ולירידות כמעט מאוזן.'],
  [2, 'neutral', 'neutral', 'ניטרלי', 'שיעור המשקיעים שמצפים לעליות ולירידות כמעט מאוזן.'],
  [5, 'bullish', 'light', 'שורי קל', 'יש מעט יותר משקיעים שמצפים לעליות מאשר לירידות.'],
  [10, 'bullish', 'moderate', 'שורי מתון', 'יש בבירור יותר משקיעים שמצפים לעליות מאשר לירידות.'],
  [11, 'bullish', 'strong', 'שורי חזק', 'הרבה יותר משקיעים מצפים לעליות מאשר לירידות.'],
];
for (const [spread, tone, intensity, label, explanation] of expectedInterpretations) {
  assert.deepEqual(getAaiiSpreadInterpretation(spread), {
    spread,
    tone,
    intensity,
    label,
    explanation,
  });
}
assert.equal(getAaiiSpreadInterpretation(-5.1).intensity, 'moderate');
assert.equal(getAaiiSpreadInterpretation(5.1).intensity, 'moderate');
assert.equal(getAaiiSpreadInterpretation(-10.1).intensity, 'strong');
assert.equal(getAaiiSpreadInterpretation(10.1).intensity, 'strong');
assert.equal(getAaiiSpreadInterpretation(null), null);

// Prefer a valid persisted spread; derive it for legacy or inconsistent records.
assert.equal(resolveAaiiDisplaySpread({ bullish: 35.5, bearish: 39.9 }), 35.5 - 39.9);
assert.equal(resolveAaiiDisplaySpread({ bullish: 35.5, bearish: 39.9, bullBearSpread: -4.35 }), -4.35);
assert.equal(resolveAaiiDisplaySpread({ bullish: 35.5, bearish: 39.9, bullBearSpread: -3.4 }), 35.5 - 39.9);
assert.equal(formatAaiiSpread(4.4), '+4.4');
assert.equal(formatAaiiSpread(-4.4), '-4.4');
assert.equal(formatAaiiSpread(0), '0.0');
assert.match(AAII_SPREAD_NOT_FORECAST_TEXT, /לא תחזית/);

// A rejected parse remains a separate result and cannot mutate or partially replace existing values.
const existingValues = Object.freeze({ bullish: '49.5', neutral: '22.3', bearish: '28.2' });
const valuesAfterRejectedParse = spreadMismatch.valid ? { ...existingValues, ...spreadMismatch } : existingValues;
assert.strictEqual(valuesAfterRejectedParse, existingValues);
assert.deepEqual(valuesAfterRejectedParse, { bullish: '49.5', neutral: '22.3', bearish: '28.2' });

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

// --- AAII Thursday-to-Wednesday schedule and local-calendar freshness ---
const localDateTime = (year, month, day, hours = 12, minutes = 0) => (
  new Date(year, month - 1, day, hours, minutes)
);

const currentWednesday = resolveAaiiFreshness('2026-08-26', {
  now: localDateTime(2026, 8, 26, 23, 59),
});
assert.deepEqual(currentWednesday, {
  state: AAII_FRESHNESS_STATES.CURRENT,
  statusLabel: 'מעודכן',
  validUntil: '2026-08-26',
  nextExpectedDate: '2026-08-27',
});

const thursdayGrace = resolveAaiiFreshness('2026-08-26', {
  now: localDateTime(2026, 8, 27, 23, 59),
});
assert.equal(thursdayGrace.state, AAII_FRESHNESS_STATES.EXPECTED_TODAY);
assert.equal(thursdayGrace.statusLabel, 'עדכון צפוי היום');

const fridayDue = resolveAaiiFreshness('2026-08-26', {
  now: localDateTime(2026, 8, 28, 0, 0),
});
assert.equal(fridayDue.state, AAII_FRESHNESS_STATES.UPDATE_DUE);
assert.equal(fridayDue.statusLabel, 'נדרש עדכון');

const newlySavedThursday = resolveAaiiFreshness('2026-09-02', {
  now: localDateTime(2026, 8, 27),
});
assert.equal(newlySavedThursday.state, AAII_FRESHNESS_STATES.CURRENT);

const monthBoundary = resolveAaiiFreshness('2026-04-29', {
  now: localDateTime(2026, 4, 30),
});
assert.equal(monthBoundary.state, AAII_FRESHNESS_STATES.EXPECTED_TODAY);
assert.equal(monthBoundary.nextExpectedDate, '2026-04-30');
assert.equal(
  resolveAaiiFreshness('2026-04-29', { now: localDateTime(2026, 5, 1, 0, 0) }).state,
  AAII_FRESHNESS_STATES.UPDATE_DUE,
);

const yearBoundary = resolveAaiiFreshness('2026-12-30', {
  now: localDateTime(2026, 12, 31),
});
assert.equal(yearBoundary.state, AAII_FRESHNESS_STATES.EXPECTED_TODAY);
assert.equal(yearBoundary.nextExpectedDate, '2026-12-31');
assert.equal(
  resolveAaiiFreshness('2026-12-30', { now: localDateTime(2027, 1, 1, 0, 0) }).state,
  AAII_FRESHNESS_STATES.UPDATE_DUE,
);

// Local calendar boundaries remain stable across the Israeli daylight-saving transition.
assert.equal(
  resolveAaiiFreshness('2026-03-25', { now: localDateTime(2026, 3, 26, 23, 59) }).state,
  AAII_FRESHNESS_STATES.EXPECTED_TODAY,
);
assert.equal(
  resolveAaiiFreshness('2026-03-25', { now: localDateTime(2026, 3, 27, 0, 0) }).state,
  AAII_FRESHNESS_STATES.UPDATE_DUE,
);

for (const invalidWeekEnd of [null, undefined, '', 'not-a-date', '2026-02-31']) {
  const uncertain = resolveAaiiFreshness(invalidWeekEnd, { now: localDateTime(2026, 8, 22) });
  assert.equal(uncertain.state, AAII_FRESHNESS_STATES.UNCERTAIN);
  assert.equal(uncertain.statusLabel, 'בדיקת עדכון');
  assert.equal(uncertain.validUntil, null);
  assert.equal(uncertain.nextExpectedDate, null);
}

// Manual-save timestamps are intentionally outside the freshness contract.
assert.deepEqual(
  resolveAaiiFreshness('2026-08-26', {
    now: localDateTime(2026, 8, 28),
    updatedAt: '2099-01-01T00:00:00.000Z',
  }),
  fridayDue,
);

// --- record building ---
const built = buildAaiiWeeklyRecord({ bullish: 49.5, neutral: 22.3, bearish: 28.2 }, '2026-02-19', {
  now: new Date(2026, 1, 19, 9, 30),
});
assert.equal(built.valid, true);
assert.equal(built.record.weekStart, '2026-02-18');
assert.equal(built.record.weekEnd, '2026-02-25');
assert.equal(built.record.publicationDate, '2026-02-19');
assert.equal(built.record.bullish, 49.5);

const builtFromPaste = buildAaiiWeeklyRecord(parsedLine, '2026-08-19', {
  now: new Date('2026-08-20T09:30:00.000Z'),
});
assert.equal(builtFromPaste.valid, true);
assert.equal(builtFromPaste.record.bullishAverage, 37.5);
assert.equal(builtFromPaste.record.neutralAverage, 31);
assert.equal(builtFromPaste.record.bearishAverage, 31.5);
assert.equal(builtFromPaste.record.bullBearSpread, -4.4);
assert.equal(builtFromPaste.record.sentiment, 'bearish');
const parsedStoreRoundTrip = JSON.parse(JSON.stringify(upsertAaiiWeeklyRecord(createEmptyAaiiWeeklyStore(), builtFromPaste.record)));
const persistedParsedRecord = parsedStoreRoundTrip.records[builtFromPaste.record.weekStart];
assert.equal(persistedParsedRecord.bullishAverage, 37.5);
assert.equal(persistedParsedRecord.neutralAverage, 31);
assert.equal(persistedParsedRecord.bearishAverage, 31.5);
assert.equal(persistedParsedRecord.bullBearSpread, -4.4);
assert.equal(persistedParsedRecord.sentiment, 'bearish');

const legacyBuilt = buildAaiiWeeklyRecord({ bullish: 49.5, neutral: 22.3, bearish: 28.2 }, '2026-02-19');
assert.equal(legacyBuilt.valid, true);
assert.equal('bullishAverage' in legacyBuilt.record, false, 'legacy manual records keep their existing shape');

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
