import { translateKnownIndicatorEnumValue } from './indicatorEnumDisplay.js';
import { translateSentimentValue } from './sentimentDisplayI18n.js';

const FIELD_LABELS_HE = Object.freeze({
  action: 'פעולה',
  asset: 'נכס',
  category: 'קטגוריה',
  change: 'שינוי',
  company: 'חברה',
  context: 'הקשר',
  currentvalue: 'ערך נוכחי',
  description: 'תיאור',
  direction: 'מגמה',
  impact: 'השפעה',
  importance: 'חשיבות',
  label: 'סוג',
  level: 'רמה',
  marketbreadth: 'רוחב שוק',
  marketmood: 'מצב השוק',
  markettrend: 'מגמת שוק',
  name: 'שם',
  note: 'הערה',
  notes: 'הערות',
  price: 'מחיר',
  priority: 'עדיפות',
  reason: 'סיבה',
  relativestrength: 'חוזק יחסי',
  sentiment: 'סנטימנט',
  source: 'מקור',
  status: 'מצב',
  strength: 'חוזק',
  summary: 'סיכום',
  symbol: 'סימול',
  ticker: 'סימול',
  timeframe: 'טווח זמן',
  title: 'כותרת',
  trend: 'מגמה',
  type: 'סוג',
  value: 'ערך',
});

const EXACT_VALUE_TRANSLATIONS = Object.freeze({
  'energy sector': 'סקטור האנרגיה',
  'financial sector': 'הסקטור הפיננסי',
  'general market': 'השוק הכללי',
  'healthcare sector': 'סקטור הבריאות',
  'technology sector': 'סקטור הטכנולוגיה',
});

function normalizeFieldKey(value) {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\s/g, '');
}

function translateStructuredValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const exact = EXACT_VALUE_TRANSLATIONS[raw.toLowerCase()];
  if (exact) return exact;
  const indicatorValue = translateKnownIndicatorEnumValue(raw);
  if (indicatorValue !== raw) return indicatorValue;
  return translateSentimentValue(raw);
}

function localizeSegment(segment, { structured }) {
  const raw = String(segment || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const orphanKey = normalizeFieldKey(raw);
  if (structured && FIELD_LABELS_HE[orphanKey]) return '';

  const fieldMatch = raw.match(/^([A-Za-z][A-Za-z0-9 _-]*)\s*:\s*(.*)$/s);
  if (!fieldMatch) return translateStructuredValue(raw);

  const [, rawKey, rawValue] = fieldMatch;
  const value = translateStructuredValue(rawValue);
  if (!value) return '';

  const label = FIELD_LABELS_HE[normalizeFieldKey(rawKey)];
  if (label) return `${label}: ${value}`;

  // In a pipe-delimited structured row, an unknown ASCII key is internal
  // schema metadata. Keep its useful value without exposing the raw key.
  return structured ? value : raw;
}

/**
 * Presentation-only cleanup for GEM-derived text.
 * Replaces technical pipe separators, translates known field names and enum
 * values, removes empty/orphan schema fields, and leaves stored data untouched.
 */
export function localizeStructuredDisplayText(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const structured = raw.includes('|');
  const segments = structured ? raw.split(/\s*\|\s*/) : [raw];
  return segments
    .map((segment) => localizeSegment(segment, { structured }))
    .filter(Boolean)
    .join(' · ');
}
