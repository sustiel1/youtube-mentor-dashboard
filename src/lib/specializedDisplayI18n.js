/**
 * Presentation-only Hebrew labels for Specialized Content / Morning Brief UI.
 * Does not modify stored data, extraction, schemas, or GEM outputs.
 */

/** Visible UI label translations (English → Hebrew). Keys are normalized lowercase. */
export const DISPLAY_LABEL_MAP = {
  'positive market regime': 'מצב שוק חיובי',
  'negative market regime': 'מצב שוק שלילי',
  'neutral / general market regime': 'מצב שוק ניטרלי',
  'neutral market regime': 'מצב שוק ניטרלי',
  'market regime': 'מצב שוק',
  'global events': 'אירועים גלובליים',
  'general mood': 'מצב רוח כללי',
  status: 'סטטוס',
  'positive news': 'חדשות חיוביות',
  'negative news': 'חדשות שליליות',
  'neutral / general news': 'חדשות כלליות',
  'neutral news': 'חדשות כלליות',
  news: 'חדשות',
  'positive sectors': 'סקטורים חיוביים',
  'negative sectors': 'סקטורים שליליים',
  'neutral sectors': 'סקטורים ניטרליים',
  sectors: 'סקטורים',
  'positive signals': 'איתותים חיוביים',
  'negative signals': 'איתותים שליליים',
  opportunities: 'הזדמנויות',
  risks: 'סיכונים',
  markets: 'שווקים',
  'economic calendar': 'לוח כלכלי',
  macro: 'מאקרו',
  sentiment: 'סנטימנט',
  positive: 'חיובי',
  negative: 'שלילי',
  neutral: 'ניטרלי',
  'positive / bullish': 'חיובי',
  'negative / bearish': 'שלילי',
  'neutral / watchlist': 'ניטרלי',
  indicator: 'אינדיקטור',
  'current value': 'ערך נוכחי',
  change: 'שינוי',
  'update frequency': 'תדירות עדכון',
  description: 'תיאור',
  impact: 'השפעה',
  globalevents: 'אירועים גלובליים',
  generalmood: 'מצב רוח כללי',
  marketbreadth: 'רוחב שוק',
  marketmood: 'מצב השוק',
};

export const DISPLAY_SECTION_TITLES = {
  markets: '📈 שווקים',
  macro: '🌍 מאקרו',
  sentiment: '🧠 סנטימנט',
  economicCalendar: '📅 לוח כלכלי',
  news: '📰 חדשות',
  marketRegime: '📊 מצב שוק',
  sectors: '🏭 סקטורים',
  opportunitiesRisks: '🎯 הזדמנויות וסיכונים',
  opportunities: '🎯 הזדמנויות',
  risks: '⚠️ סיכונים',
  stocksMentioned: '⭐ מניות שהוזכרו',
};

export const DISPLAY_COLUMN_TITLES = {
  news: {
    positive: '🟢 חדשות חיוביות',
    neutral: '🟡 חדשות כלליות',
    negative: '🔴 חדשות שליליות',
  },
  regime: {
    positive: '🟢 מצב שוק חיובי',
    neutral: '🟡 מצב שוק ניטרלי',
    negative: '🔴 מצב שוק שלילי',
  },
  sectors: {
    positive: '🟢 סקטורים חיוביים',
    neutral: '🟡 סקטורים ניטרליים',
    negative: '🔴 סקטורים שליליים',
  },
  signals: {
    positive: '🟢 איתותים חיוביים',
    negative: '🔴 איתותים שליליים',
  },
  opportunities: '🎯 הזדמנויות',
  risks: '⚠️ סיכונים',
  stocks: {
    bullish: '🟢 חיובי',
    bearish: '🔴 שלילי',
    neutral: '🔵 ניטרלי',
  },
};

export const TONE_DISPLAY_LABELS = {
  positive: 'חיובי',
  negative: 'שלילי',
  neutral: 'ניטרלי',
};

function normalizeLabelKey(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ');
}

/** Translate a visible UI label for display; returns original if unrecognized. */
export function translateDisplayLabel(label) {
  const raw = String(label ?? '').trim();
  if (!raw) return raw;
  if (/[\u0590-\u05FF]/.test(raw)) return raw;

  const withoutEmoji = raw.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();
  const keys = [normalizeLabelKey(raw), normalizeLabelKey(withoutEmoji)];
  for (const key of keys) {
    if (DISPLAY_LABEL_MAP[key]) return DISPLAY_LABEL_MAP[key];
    const compact = key.replace(/\s+/g, '');
    if (DISPLAY_LABEL_MAP[compact]) return DISPLAY_LABEL_MAP[compact];
  }
  return raw;
}
