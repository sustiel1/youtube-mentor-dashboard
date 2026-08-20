export const AAII_WEEKLY_SENTIMENT_TOTAL_TOLERANCE = 0.5;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function normalizeAaiiPercentInput(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num >= 0 && num <= 100 ? num : null;
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
