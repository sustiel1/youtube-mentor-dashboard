export const INDICATOR_ENUM_UNKNOWN_LABEL = 'לא ידוע';

const INDICATOR_ENUM_LABELS = Object.freeze({
  unknown: INDICATOR_ENUM_UNKNOWN_LABEL,
  positive: 'חיובי',
  negative: 'שלילי',
  neutral: 'ניטרלי',
  up: 'עלייה',
  down: 'ירידה',
  into: 'כניסה לסקטור',
  out: 'יציאה מהסקטור',
  bullish: 'שורי',
  bearish: 'דובי',
});

function normalizeIndicatorEnumValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

/** Strict enum/status display: missing and unrecognized values are always safe Hebrew. */
export function translateIndicatorEnumValue(value) {
  const key = normalizeIndicatorEnumValue(value);
  return INDICATOR_ENUM_LABELS[key] || INDICATOR_ENUM_UNKNOWN_LABEL;
}

/** Translate only known enums when a cell may also contain a legitimate number or free text. */
export function translateKnownIndicatorEnumValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return raw;
  return INDICATOR_ENUM_LABELS[normalizeIndicatorEnumValue(raw)] || raw;
}

/** Translate a standalone enum with an optional trailing direction glyph. */
export function translateIndicatorStatusDisplay(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return raw;
  const match = raw.match(/^(unknown|positive|negative|neutral|up|down|into|out|bullish|bearish)(\s*[↑↓▲▼•]*)$/i);
  if (!match) return translateKnownIndicatorEnumValue(raw);
  return `${INDICATOR_ENUM_LABELS[match[1].toLowerCase()]}${match[2]}`;
}
