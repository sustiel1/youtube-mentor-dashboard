/**
 * Presentation-only semantic state for Market Brief and Specialized content.
 * Only explicit structured fields are considered; narrative text is never classified.
 */
export const SEMANTIC_VISUAL_STATE = Object.freeze({
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
  WARNING: 'warning',
});

const POSITIVE = new Set([
  'positive', 'bullish', 'up', 'rising', 'gain', 'gaining', 'buy', 'long',
  'חיובי', 'שורי', 'עולה', 'עלייה', '↑',
]);
const NEGATIVE = new Set([
  'negative', 'bearish', 'down', 'falling', 'loss', 'losing', 'sell', 'short',
  'שלילי', 'דובי', 'יורד', 'ירידה', '↓',
]);
const WARNING = new Set([
  'warning', 'caution', 'critical', 'high risk', 'high-risk', 'risk',
  'אזהרה', 'זהירות', 'קריטי', 'סיכון גבוה',
]);
const NEUTRAL = new Set([
  'neutral', 'mixed', 'flat', 'unchanged', 'unknown', 'unverified', 'none',
  'ניטרלי', 'מעורב', 'ללא שינוי', 'לא ידוע', 'לא אומת',
]);

function normalizeToken(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function classifyExplicitToken(value) {
  const token = normalizeToken(value);
  if (!token) return null;
  if (POSITIVE.has(token)) return SEMANTIC_VISUAL_STATE.POSITIVE;
  if (NEGATIVE.has(token)) return SEMANTIC_VISUAL_STATE.NEGATIVE;
  if (WARNING.has(token)) return SEMANTIC_VISUAL_STATE.WARNING;
  if (NEUTRAL.has(token)) return SEMANTIC_VISUAL_STATE.NEUTRAL;
  return null;
}

function classifyExplicitChange(value) {
  if (typeof value === 'number') {
    if (value > 0) return SEMANTIC_VISUAL_STATE.POSITIVE;
    if (value < 0) return SEMANTIC_VISUAL_STATE.NEGATIVE;
    return SEMANTIC_VISUAL_STATE.NEUTRAL;
  }
  const token = normalizeToken(value).replace(/,/g, '');
  if (!token) return null;
  if (/^(?:\+|↑|▲)\s*\d/.test(token)) return SEMANTIC_VISUAL_STATE.POSITIVE;
  if (/^(?:-|−|↓|▼)\s*\d/.test(token)) return SEMANTIC_VISUAL_STATE.NEGATIVE;
  if (/^0(?:\.0+)?\s*%?$/.test(token)) return SEMANTIC_VISUAL_STATE.NEUTRAL;
  return null;
}

export function resolveSemanticVisualState(evidence = {}, fallback = SEMANTIC_VISUAL_STATE.NEUTRAL) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return fallback;

  for (const field of ['direction', 'sentimentDirection', 'sentiment', 'trend', 'tone', 'status']) {
    const state = classifyExplicitToken(evidence[field]);
    if (state) return state;
  }

  for (const field of ['severity', 'riskLevel']) {
    const state = classifyExplicitToken(evidence[field]);
    if (state === SEMANTIC_VISUAL_STATE.WARNING) return state;
  }

  for (const field of ['changePercent', 'priceChange', 'change']) {
    const state = classifyExplicitChange(evidence[field]);
    if (state) return state;
  }

  return fallback;
}

export const SEMANTIC_SURFACE_CLASS = Object.freeze({
  positive: 'bg-emerald-50/60 hover:bg-emerald-50/90 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30',
  negative: 'bg-red-50/60 hover:bg-red-50/90 dark:bg-red-950/20 dark:hover:bg-red-950/30',
  neutral: 'bg-slate-50/80 hover:bg-slate-100/80 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/60',
  warning: 'bg-orange-50/70 hover:bg-orange-100/70 dark:bg-orange-950/20 dark:hover:bg-orange-950/30',
});

export const SEMANTIC_TEXT_CLASS = Object.freeze({
  positive: 'text-emerald-700 dark:text-emerald-300',
  negative: 'text-red-700 dark:text-red-300',
  neutral: 'text-slate-700 dark:text-zinc-200',
  warning: 'text-orange-700 dark:text-orange-300',
});

export const SEMANTIC_DOT_CLASS = Object.freeze({
  positive: 'bg-emerald-500',
  negative: 'bg-red-500',
  neutral: 'bg-slate-400',
  warning: 'bg-orange-500',
});

export function semanticSurfaceClass(evidence, fallback) {
  const state = resolveSemanticVisualState(evidence, fallback);
  return SEMANTIC_SURFACE_CLASS[state] || SEMANTIC_SURFACE_CLASS.neutral;
}
