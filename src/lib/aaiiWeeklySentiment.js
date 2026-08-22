import { resolveTone } from './morningBriefVisuals.js';

export const AAII_WEEKLY_SENTIMENT_TOTAL_TOLERANCE = 0.5;
export const AAII_WEEKLY_SENTIMENT_SPREAD_TOLERANCE = 0.1;
export const AAII_SPREAD_NOT_FORECAST_TEXT = 'זהו מדד לסנטימנט המשקיעים ולא תחזית לשיעור העלייה או הירידה של השוק.';
export const AAII_FRESHNESS_STATES = Object.freeze({
  CURRENT: 'current',
  EXPECTED_TODAY: 'expected_today',
  UPDATE_DUE: 'update_due',
  UNCERTAIN: 'uncertain',
});
export const AAII_FRESHNESS_LABELS = Object.freeze({
  [AAII_FRESHNESS_STATES.CURRENT]: 'מעודכן',
  [AAII_FRESHNESS_STATES.EXPECTED_TODAY]: 'עדכון צפוי היום',
  [AAII_FRESHNESS_STATES.UPDATE_DUE]: 'נדרש עדכון',
  [AAII_FRESHNESS_STATES.UNCERTAIN]: 'בדיקת עדכון',
});
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const AAII_RESULTS_LINE_PATTERN = /^\s*Bullish\s+(\d+(?:\.\d+)?)\s*%\s*Avg\s+(\d+(?:\.\d+)?)\s*%\s*Neutral\s+(\d+(?:\.\d+)?)\s*%\s*Avg\s+(\d+(?:\.\d+)?)\s*%\s*Bearish\s+(\d+(?:\.\d+)?)\s*%\s*Avg\s+(\d+(?:\.\d+)?)\s*%\s*(?:[▼▽]\s*)?Bull\s*[‐‑‒–—−-]\s*Bear\s+Spread\s*:\s*([+\-−]?\d+(?:\.\d+)?)\s*pp\s*$/iu;

// Parses a 'YYYY-MM-DD' string (or Date) into a local-midnight Date. Deliberately
// avoids `new Date('YYYY-MM-DD')` / `toISOString()`, both of which operate in UTC
// and silently shift the calendar day for users west of UTC.
export function toLocalDateOnly(dateInput) {
  if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) return null;
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }
  const match = DATE_ONLY_PATTERN.exec(String(dateInput || '').trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateOnlyStr) {
  const date = toLocalDateOnly(dateOnlyStr);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

// Most recent Wednesday on/before `dateInput` (local calendar day).
export function resolveWeeklyWednesday(dateInput) {
  const date = toLocalDateOnly(dateInput);
  if (!date) return null;
  const day = date.getDay(); // 0 Sun .. 3 Wed .. 6 Sat
  const daysSinceWednesday = (day - 3 + 7) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceWednesday);
}

// { weekStart, weekEnd } as 'YYYY-MM-DD', weekEnd = weekStart + 7 days (the following Wednesday).
export function getWeeklyPeriod(dateInput) {
  const start = resolveWeeklyWednesday(dateInput);
  if (!start) return null;
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { weekStart: formatLocalDateOnly(start), weekEnd: formatLocalDateOnly(end) };
}

export function formatWeeklyPeriodLabel(weekStart, weekEnd) {
  return `בתוקף מ־${formatDisplayDate(weekStart)} עד ${formatDisplayDate(weekEnd)}`;
}

function parseStrictLocalDateOnly(dateInput) {
  const parsed = toLocalDateOnly(dateInput);
  if (!parsed) return null;
  if (
    typeof dateInput === 'string'
    && formatLocalDateOnly(parsed) !== dateInput.trim()
  ) {
    return null;
  }
  return parsed;
}

export function resolveAaiiFreshness(weekEndingDate, { now = new Date() } = {}) {
  const validUntilDate = parseStrictLocalDateOnly(weekEndingDate);
  const today = parseStrictLocalDateOnly(now);
  if (!validUntilDate || !today) {
    return {
      state: AAII_FRESHNESS_STATES.UNCERTAIN,
      statusLabel: AAII_FRESHNESS_LABELS[AAII_FRESHNESS_STATES.UNCERTAIN],
      validUntil: null,
      nextExpectedDate: null,
    };
  }

  const nextExpected = new Date(
    validUntilDate.getFullYear(),
    validUntilDate.getMonth(),
    validUntilDate.getDate() + 1,
  );
  const validUntil = formatLocalDateOnly(validUntilDate);
  const nextExpectedDate = formatLocalDateOnly(nextExpected);
  const todayTime = today.getTime();
  const validUntilTime = validUntilDate.getTime();
  const nextExpectedTime = nextExpected.getTime();
  const state = todayTime <= validUntilTime
    ? AAII_FRESHNESS_STATES.CURRENT
    : todayTime === nextExpectedTime
      ? AAII_FRESHNESS_STATES.EXPECTED_TODAY
      : AAII_FRESHNESS_STATES.UPDATE_DUE;

  return {
    state,
    statusLabel: AAII_FRESHNESS_LABELS[state],
    validUntil,
    nextExpectedDate,
  };
}

export function normalizeAaiiPercentInput(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num >= 0 && num <= 100 ? num : null;
}

function parseAaiiDecimal(value) {
  return Number(String(value).replace('−', '-'));
}

export function normalizeAaiiSpreadInput(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numericSpread = typeof value === 'number' ? value : parseAaiiDecimal(value);
  return Number.isFinite(numericSpread) ? numericSpread : null;
}

export function classifyAaiiSpread(spread) {
  const numericSpread = normalizeAaiiSpreadInput(spread);
  if (numericSpread == null) return null;
  return resolveTone(numericSpread > 0 ? `+${numericSpread}` : String(numericSpread));
}

const AAII_SPREAD_INTERPRETATIONS = Object.freeze({
  bullish: Object.freeze({
    light: Object.freeze({
      label: 'שורי קל',
      explanation: 'יש מעט יותר משקיעים שמצפים לעליות מאשר לירידות.',
    }),
    moderate: Object.freeze({
      label: 'שורי מתון',
      explanation: 'יש בבירור יותר משקיעים שמצפים לעליות מאשר לירידות.',
    }),
    strong: Object.freeze({
      label: 'שורי חזק',
      explanation: 'הרבה יותר משקיעים מצפים לעליות מאשר לירידות.',
    }),
  }),
  bearish: Object.freeze({
    light: Object.freeze({
      label: 'דובי קל',
      explanation: 'יש מעט יותר משקיעים שמצפים לירידות מאשר לעליות.',
    }),
    moderate: Object.freeze({
      label: 'דובי מתון',
      explanation: 'יש בבירור יותר משקיעים שמצפים לירידות מאשר לעליות.',
    }),
    strong: Object.freeze({
      label: 'דובי חזק',
      explanation: 'הרבה יותר משקיעים מצפים לירידות מאשר לעליות.',
    }),
  }),
  neutral: Object.freeze({
    label: 'ניטרלי',
    explanation: 'שיעור המשקיעים שמצפים לעליות ולירידות כמעט מאוזן.',
  }),
});

export function getAaiiSpreadInterpretation(spread) {
  const numericSpread = normalizeAaiiSpreadInput(spread);
  if (numericSpread == null) return null;

  const absoluteSpread = Math.abs(numericSpread);
  if (absoluteSpread <= 2) {
    return {
      spread: numericSpread,
      tone: 'neutral',
      intensity: 'neutral',
      ...AAII_SPREAD_INTERPRETATIONS.neutral,
    };
  }

  const tone = classifyAaiiSpread(numericSpread);
  const intensity = absoluteSpread <= 5
    ? 'light'
    : absoluteSpread <= 10
      ? 'moderate'
      : 'strong';
  return {
    spread: numericSpread,
    tone,
    intensity,
    ...AAII_SPREAD_INTERPRETATIONS[tone][intensity],
  };
}

export function resolveAaiiDisplaySpread({ bullish, bearish, bullBearSpread } = {}) {
  const normalizedBullish = normalizeAaiiPercentInput(bullish);
  const normalizedBearish = normalizeAaiiPercentInput(bearish);
  if (normalizedBullish == null || normalizedBearish == null) return null;

  const derivedSpread = normalizedBullish - normalizedBearish;
  const persistedSpread = normalizeAaiiSpreadInput(bullBearSpread);
  if (
    persistedSpread != null
    && Math.abs(persistedSpread - derivedSpread) <= AAII_WEEKLY_SENTIMENT_SPREAD_TOLERANCE
  ) {
    return persistedSpread;
  }
  return derivedSpread;
}

export function formatAaiiSpread(spread) {
  const numericSpread = normalizeAaiiSpreadInput(spread);
  if (numericSpread == null) return null;
  return `${numericSpread > 0 ? '+' : ''}${numericSpread.toFixed(1)}`;
}

export function validateAaiiParsedValues({
  bullish,
  bullishAverage,
  neutral,
  neutralAverage,
  bearish,
  bearishAverage,
  bullBearSpread,
} = {}) {
  const base = validateAaiiWeeklyDraft({ bullish, neutral, bearish });
  if (!base.valid) return base;

  const averages = [bullishAverage, neutralAverage, bearishAverage].map(normalizeAaiiPercentInput);
  if (averages.some((value) => value == null)) {
    return { valid: false, error: 'ממוצעי AAII חייבים להיות מספרים בין 0 ל־100.' };
  }

  const spread = normalizeAaiiSpreadInput(bullBearSpread);
  if (spread == null) {
    return { valid: false, error: 'מרווח השוריים–דוביים חייב להיות מספר תקין.' };
  }

  const expectedSpread = base.bullish - base.bearish;
  if (Math.abs(spread - expectedSpread) > AAII_WEEKLY_SENTIMENT_SPREAD_TOLERANCE) {
    return {
      valid: false,
      error: `המרווח שהודבק (${spread.toFixed(1)}) אינו תואם לשוריים פחות דוביים (${expectedSpread.toFixed(1)}).`,
    };
  }

  return {
    ...base,
    bullishAverage: averages[0],
    neutralAverage: averages[1],
    bearishAverage: averages[2],
    bullBearSpread: spread,
    sentiment: classifyAaiiSpread(spread),
  };
}

export function parseAaiiResultsLine(input) {
  const match = AAII_RESULTS_LINE_PATTERN.exec(String(input || ''));
  if (!match) {
    return {
      valid: false,
      error: 'לא ניתן לזהות את שורת AAII. ודא שכל שבעת השדות קיימים ובסדר הנכון.',
    };
  }

  return validateAaiiParsedValues({
    bullish: parseAaiiDecimal(match[1]),
    bullishAverage: parseAaiiDecimal(match[2]),
    neutral: parseAaiiDecimal(match[3]),
    neutralAverage: parseAaiiDecimal(match[4]),
    bearish: parseAaiiDecimal(match[5]),
    bearishAverage: parseAaiiDecimal(match[6]),
    bullBearSpread: parseAaiiDecimal(match[7]),
  });
}

// Validates a draft { bullish, neutral, bearish }. Never infers or fabricates a
// missing/invalid value — all three must be present and finite 0-100, and the
// sum must land within AAII_WEEKLY_SENTIMENT_TOTAL_TOLERANCE of 100.
export function validateAaiiWeeklyDraft({ bullish, neutral, bearish } = {}) {
  const b = normalizeAaiiPercentInput(bullish);
  const n = normalizeAaiiPercentInput(neutral);
  const be = normalizeAaiiPercentInput(bearish);

  if (b == null || n == null || be == null) {
    return { valid: false, error: 'כל שלושת הערכים חייבים להיות מספרים בין 0 ל-100' };
  }

  const total = b + n + be;
  if (Math.abs(total - 100) > AAII_WEEKLY_SENTIMENT_TOTAL_TOLERANCE) {
    return { valid: false, error: `הסכום (${total.toFixed(1)}%) חייב להיות קרוב ל-100%` };
  }

  return { valid: true, bullish: b, neutral: n, bearish: be, total };
}

// Builds a full weekly record from a validated draft + the user-selected publication date.
export function buildAaiiWeeklyRecord(draft, publicationDateInput, { now = new Date() } = {}) {
  const validated = validateAaiiWeeklyDraft(draft);
  if (!validated.valid) return validated;

  const hasParsedDetails = [
    'bullishAverage',
    'neutralAverage',
    'bearishAverage',
    'bullBearSpread',
  ].some((key) => Object.prototype.hasOwnProperty.call(draft || {}, key));
  const parsedDetails = hasParsedDetails ? validateAaiiParsedValues(draft) : null;
  if (parsedDetails && !parsedDetails.valid) return parsedDetails;

  const period = getWeeklyPeriod(publicationDateInput);
  if (!period) return { valid: false, error: 'תאריך פרסום לא תקין' };

  const publicationDate = toLocalDateOnly(publicationDateInput);
  return {
    valid: true,
    record: {
      weekStart: period.weekStart,
      weekEnd: period.weekEnd,
      bullish: validated.bullish,
      neutral: validated.neutral,
      bearish: validated.bearish,
      ...(parsedDetails ? {
        bullishAverage: parsedDetails.bullishAverage,
        neutralAverage: parsedDetails.neutralAverage,
        bearishAverage: parsedDetails.bearishAverage,
        bullBearSpread: parsedDetails.bullBearSpread,
        sentiment: parsedDetails.sentiment,
      } : {}),
      publicationDate: formatLocalDateOnly(publicationDate),
      updatedAt: now.toISOString(),
    },
  };
}

export function createEmptyAaiiWeeklyStore() {
  return { version: 1, records: {} };
}

// Same-Wednesday saves overwrite that week's record; other weeks are preserved.
export function upsertAaiiWeeklyRecord(store, record) {
  const records = { ...(store?.records || {}) };
  records[record.weekStart] = record;
  return { version: 1, records };
}

export function listAaiiWeeklyRecordsDescending(store) {
  return Object.values(store?.records || {}).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

// Latest saved record whose weekStart is not in the future relative to `now`.
export function getLatestApplicableAaiiWeeklyRecord(store, { now = new Date() } = {}) {
  const today = formatLocalDateOnly(toLocalDateOnly(now) || now);
  const applicable = listAaiiWeeklyRecordsDescending(store).filter((r) => r.weekStart <= today);
  return applicable[0] || null;
}
