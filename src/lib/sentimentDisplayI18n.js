/**
 * Presentation-only Hebrew display layer for sentiment labels and values.
 * Does not modify stored data, extraction, or GEM outputs.
 */

/** Sentiment value translations — longest phrases first at lookup time. */
export const SENTIMENT_VALUE_TRANSLATIONS = {
  'very cautious': 'זהירות גבוהה',
  'extreme fear': 'פחד קיצוני',
  'extreme greed': 'חמדנות קיצונית',
  'strong bullish': 'שורי מאוד',
  'strong bearish': 'דובי מאוד',
  'risk on': 'נכונות לקחת סיכון',
  'risk-on': 'נכונות לקחת סיכון',
  'riskon': 'נכונות לקחת סיכון',
  'risk off': 'הימנעות מסיכון',
  'risk-off': 'הימנעות מסיכון',
  'riskoff': 'הימנעות מסיכון',
  'fear and greed': 'פחד וחמדנות',
  'fear & greed': 'פחד וחמדנות',
  'cautious': 'זהירות',
  'bullish': 'שורי',
  'bearish': 'דובי',
  'neutral': 'ניטרלי',
  'fear': 'פחד',
  'greed': 'חמדנות',
  'fomo': 'פחד מהחמצה (FOMO)',
  'optimistic': 'אופטימי',
  'pessimistic': 'פסימי',
  'mixed': 'מעורב',
  'uncertain': 'חוסר ודאות',
  'uncertainty': 'חוסר ודאות',
  'positive': 'חיובי',
  'negative': 'שלילי',
  'up': 'עולה',
  'down': 'יורד',
  'strong': 'חזק',
  'weak': 'חלש',
  'watch': 'מעקב',
  'hold': 'החזקה',
};

/** English label → Hebrew display label. */
export const SENTIMENT_LABEL_TRANSLATIONS = {
  'institutional sentiment': 'סנטימנט מוסדי',
  'retail sentiment': 'סנטימנט קמעונאי',
  'fear & greed': 'פחד וחמדנות',
  'fear and greed': 'פחד וחמדנות',
  'general mood': 'מצב רוח כללי',
  'market mood': 'מצב השוק',
  'market psychology': 'פסיכולוגיית שוק',
  'retail traders': 'משקיעים פרטיים',
  'institutional investors': 'משקיעים מוסדיים',
  'overall sentiment': 'סנטימנט כללי',
  'market sentiment': 'סנטימנט שוק',
  'sentiment': 'סנטימנט',
};

const VALUE_KEYS_BY_LENGTH = Object.keys(SENTIMENT_VALUE_TRANSLATIONS)
  .sort((a, b) => b.length - a.length);

const LABEL_KEYS_BY_LENGTH = Object.keys(SENTIMENT_LABEL_TRANSLATIONS)
  .sort((a, b) => b.length - a.length);

export function normalizeSentimentLookupKey(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-');
}

function normalizeSentimentLabelKey(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Translate a sentiment value for display; returns original if unrecognized. */
export function translateSentimentValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return raw;
  if (/[\u0590-\u05FF]/.test(raw)) return raw;

  const compact = normalizeSentimentLookupKey(raw);
  if (SENTIMENT_VALUE_TRANSLATIONS[compact]) return SENTIMENT_VALUE_TRANSLATIONS[compact];

  const spaced = compact.replace(/-/g, ' ');
  if (SENTIMENT_VALUE_TRANSLATIONS[spaced]) return SENTIMENT_VALUE_TRANSLATIONS[spaced];

  for (const key of VALUE_KEYS_BY_LENGTH) {
    const keySpaced = key.replace(/-/g, ' ');
    if (compact === key || spaced === keySpaced) {
      return SENTIMENT_VALUE_TRANSLATIONS[key];
    }
  }

  return raw;
}

/** Translate a sentiment section label for display; returns original if unrecognized. */
export function translateSentimentLabel(label) {
  const raw = String(label ?? '').trim();
  if (!raw) return raw;
  if (/[\u0590-\u05FF]/.test(raw)) return raw;

  const key = normalizeSentimentLabelKey(raw);
  if (SENTIMENT_LABEL_TRANSLATIONS[key]) return SENTIMENT_LABEL_TRANSLATIONS[key];

  for (const mapKey of LABEL_KEYS_BY_LENGTH) {
    if (key === mapKey || key.includes(mapKey)) {
      return SENTIMENT_LABEL_TRANSLATIONS[mapKey];
    }
  }

  return raw;
}
