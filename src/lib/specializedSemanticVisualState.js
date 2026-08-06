/** Presentation-only semantic state. Never inspects titles, company names or tickers. */
export const SEMANTIC_VISUAL_STATE = Object.freeze({
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  WARNING: 'warning',
  NEUTRAL: 'neutral',
  INFORMATIONAL: 'informational',
});

const POSITIVE = new Set(['positive', 'bullish', 'up', 'gain', 'gaining', 'into', 'buy', 'opportunity', '↑', 'חיובי', 'שורי', 'עולה']);
const NEGATIVE = new Set(['negative', 'bearish', 'down', 'loss', 'losing', 'out', 'sell', 'risk', '↓', 'שלילי', 'דובי', 'יורד']);
const WARNING = new Set(['warning', 'caution', 'important', 'high', 'critical', 'watch', 'avoid', 'אזהרה', 'חשוב', 'גבוה', 'קריטי']);
const INFORMATIONAL = new Set(['informational', 'info', 'scheduled', 'event', 'data', 'מידע', 'מתוזמן']);
const NEUTRAL = new Set(['neutral', 'mixed', 'flat', 'unknown', 'none', 'ניטרלי', 'מעורב', 'לא ידוע']);

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function classifyValue(value) {
  if (typeof value === 'number') {
    if (value > 0) return SEMANTIC_VISUAL_STATE.POSITIVE;
    if (value < 0) return SEMANTIC_VISUAL_STATE.NEGATIVE;
    return SEMANTIC_VISUAL_STATE.NEUTRAL;
  }
  const token = normalize(value);
  if (!token) return null;
  if (POSITIVE.has(token)) return SEMANTIC_VISUAL_STATE.POSITIVE;
  if (NEGATIVE.has(token)) return SEMANTIC_VISUAL_STATE.NEGATIVE;
  if (WARNING.has(token)) return SEMANTIC_VISUAL_STATE.WARNING;
  if (INFORMATIONAL.has(token)) return SEMANTIC_VISUAL_STATE.INFORMATIONAL;
  if (NEUTRAL.has(token)) return SEMANTIC_VISUAL_STATE.NEUTRAL;
  if (/^[+\u2191]\s*\d/.test(token)) return SEMANTIC_VISUAL_STATE.POSITIVE;
  if (/^\u2193\s*\d/.test(token)) return SEMANTIC_VISUAL_STATE.NEGATIVE;
  if (/^[+]​?\s*\d/.test(token)) return SEMANTIC_VISUAL_STATE.POSITIVE;
  if (/^-\s*\d/.test(token)) return SEMANTIC_VISUAL_STATE.NEGATIVE;
  return null;
}

export function resolveSemanticVisualState(evidence = {}, fallback = SEMANTIC_VISUAL_STATE.NEUTRAL) {
  if (typeof evidence !== 'object' || evidence === null) return fallback;
  const fields = ['sentiment', 'tone', 'direction', 'change', 'changePercent', 'status', 'impact', 'severity', 'importance'];
  for (const field of fields) {
    const state = classifyValue(evidence[field]);
    if (state) return state;
  }
  return fallback;
}

export const SEMANTIC_ROW_CLASS = Object.freeze({
  positive: 'bg-emerald-50/60 hover:bg-emerald-50/90 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30',
  negative: 'bg-red-50/60 hover:bg-red-50/90 dark:bg-red-950/20 dark:hover:bg-red-950/30',
  warning: 'bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/30',
  neutral: 'bg-slate-50/80 hover:bg-slate-100/80 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/60',
  informational: 'bg-sky-50/60 hover:bg-sky-50/90 dark:bg-sky-950/20 dark:hover:bg-sky-950/30',
});

export function semanticRowClass(evidence, fallback) {
  return SEMANTIC_ROW_CLASS[resolveSemanticVisualState(evidence, fallback)] || SEMANTIC_ROW_CLASS.neutral;
}
