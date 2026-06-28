/**
 * Presentation-only visual tokens for Morning Brief dashboard.
 * No extraction / schema changes — tolerates partial or missing fields.
 */

export const TONE = { BULLISH: 'bullish', BEARISH: 'bearish', NEUTRAL: 'neutral' };

/** Finer-grained direction for stock / opportunity cards. */
export const DIRECTION = {
  POSITIVE: 'positive',
  BREAKOUT: 'breakout',
  NEGATIVE: 'negative',
  RISK: 'risk',
  WATCH: 'watch',
  NEUTRAL: 'neutral',
};

const BULLISH_TOKENS = [
  'up', 'bullish', 'positive', 'strong', 'expansion', 'risk on', 'risk-on', 'riskon',
  'leading', 'outperform', 'green', 'buy', 'long', 'rally', 'gain', 'breakout',
  'עולה', 'עלייה', 'שורי', 'חיובי', 'חזק', 'חזקה', 'ירוק', 'התרחבות', 'נרכשת', 'טסה',
];
const BEARISH_TOKENS = [
  'down', 'bearish', 'negative', 'weak', 'contraction', 'risk off', 'risk-off', 'riskoff',
  'lagging', 'underperform', 'red', 'sell', 'short', 'drop', 'loss', 'crash', 'dilution',
  'יורדת', 'ירידה', 'דובי', 'שלילי', 'חלש', 'חלשה', 'אדום', 'אדומה', 'קורסת', 'דילול', 'פגיעה',
  'התכווצות', 'risk off',
];
const NEUTRAL_TOKENS = ['neutral', 'flat', 'mixed', 'sideways', 'range', 'ניטרלי', 'שטוח', 'מעורב', 'hold'];

/** Strong bullish / breakout signals (checked before generic positive). */
const BREAKOUT_WORDS = [
  { tok: 'פריצה', label: 'פריצה' },
  { tok: 'breakout', label: 'פריצה' },
  { tok: 'קופצת', label: 'קופצת' },
  { tok: 'מזנקת', label: 'מזנקת' },
  { tok: 'טסה', label: 'טסה' },
  { tok: 'bullish_pump', label: 'עלייה חזקה' },
  { tok: 'breakout_long', label: 'פריצה לונג' },
];

/** Positive direction words with display labels. */
const POSITIVE_WORDS = [
  { tok: 'עולה', label: 'עולה' },
  { tok: 'חיובי', label: 'חיובי' },
  { tok: 'חזקה', label: 'חזקה' },
  { tok: 'חזק', label: 'חזק' },
  { tok: 'נרכשת', label: 'נרכשת' },
  { tok: 'bullish', label: 'שורי' },
  { tok: 'up', label: 'עולה' },
  { tok: 'holding_high', label: 'שומר גבוה' },
  { tok: 'buyout_up', label: 'עלייה' },
];

/** Negative direction words with display labels. */
const NEGATIVE_WORDS = [
  { tok: 'יורדת', label: 'יורדת' },
  { tok: 'אדומה', label: 'אדומה' },
  { tok: 'קורסת', label: 'קורסת' },
  { tok: 'דילול', label: 'דילול' },
  { tok: 'פגיעה', label: 'פגיעה' },
  { tok: 'שלילי', label: 'שלילי' },
  { tok: 'חלשה', label: 'חלשה' },
  { tok: 'crash', label: 'קריסה' },
  { tok: 'down', label: 'ירידה' },
  { tok: 'bearish', label: 'דובי' },
  { tok: 'dilution', label: 'דילול' },
  { tok: 'earnings_crash', label: 'קריסת דוח' },
  { tok: 'dilution_drop', label: 'ירידה+דילול' },
];

const WATCH_WORDS = [
  { tok: 'מעקב', label: 'מעקב' },
  { tok: 'watch', label: 'Watch' },
  { tok: 'watchlist', label: 'מעקב' },
  { tok: 'holding', label: 'החזקה' },
];

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

/** Classify free-text market tokens into bullish / bearish / neutral. */
export function resolveTone(text) {
  const t = norm(text);
  if (!t) return TONE.NEUTRAL;
  if (BULLISH_TOKENS.some((tok) => t.includes(tok))) return TONE.BULLISH;
  if (BEARISH_TOKENS.some((tok) => t.includes(tok))) return TONE.BEARISH;
  if (NEUTRAL_TOKENS.some((tok) => t.includes(tok))) return TONE.NEUTRAL;
  if (/^\+|▲|↑/.test(t) || /\+\d/.test(t)) return TONE.BULLISH;
  if (/^-|▼|↓/.test(t) || /-\d/.test(t)) return TONE.BEARISH;
  return TONE.NEUTRAL;
}

export const TONE_STYLES = {
  bullish: {
    border: 'border-emerald-300/80 dark:border-emerald-700/50',
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-300',
    chip: '🟢',
    arrow: '▲',
  },
  bearish: {
    border: 'border-red-300/80 dark:border-red-800/50',
    bg: 'bg-red-50/50 dark:bg-red-950/20',
    badge: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    text: 'text-red-700 dark:text-red-300',
    chip: '🔴',
    arrow: '▼',
  },
  neutral: {
    border: 'border-amber-200/80 dark:border-amber-800/40',
    bg: 'bg-amber-50/30 dark:bg-amber-950/10',
    badge: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400',
    text: 'text-amber-700 dark:text-amber-400',
    chip: '🟡',
    arrow: '●',
  },
};

/** Direction-specific card styles (stocks, opportunities, risks). */
export const DIRECTION_STYLES = {
  [DIRECTION.BREAKOUT]: {
    border: 'border-emerald-400 dark:border-emerald-600',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/30',
    badge: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200',
    text: 'text-emerald-800 dark:text-emerald-200',
    arrow: '↑',
    icon: '🚀',
  },
  [DIRECTION.POSITIVE]: {
    border: 'border-emerald-300/90 dark:border-emerald-700/60',
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/25',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-300',
    arrow: '↑',
    icon: '🟢',
  },
  [DIRECTION.NEGATIVE]: {
    border: 'border-red-300/90 dark:border-red-800/60',
    bg: 'bg-red-50/60 dark:bg-red-950/25',
    badge: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    text: 'text-red-700 dark:text-red-300',
    arrow: '↓',
    icon: '🔴',
  },
  [DIRECTION.RISK]: {
    border: 'border-red-400 dark:border-red-700',
    bg: 'bg-red-50/70 dark:bg-red-950/30',
    badge: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
    text: 'text-red-800 dark:text-red-200',
    arrow: '↓',
    icon: '⚠️',
  },
  [DIRECTION.WATCH]: {
    border: 'border-sky-200/90 dark:border-sky-800/50',
    bg: 'bg-sky-50/50 dark:bg-sky-950/20',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
    text: 'text-sky-700 dark:text-sky-300',
    arrow: '👀',
    icon: '👀',
  },
  [DIRECTION.NEUTRAL]: {
    border: 'border-slate-200 dark:border-zinc-700',
    bg: 'bg-slate-50/50 dark:bg-zinc-900/40',
    badge: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400',
    text: 'text-slate-600 dark:text-zinc-400',
    arrow: '●',
    icon: '📰',
  },
};

export function toneStyles(tone) {
  return TONE_STYLES[tone] || TONE_STYLES.neutral;
}

/** CRITICAL / HIGH / MEDIUM / LOW importance badge classes. */
export function importanceStyles(level) {
  const l = norm(level).replace(/\s+/g, '');
  if (l.includes('critical') || l.includes('קריטי')) {
    return { label: 'CRITICAL', cls: 'bg-red-950 text-red-100 dark:bg-red-950 dark:text-red-200 border border-red-800' };
  }
  if (l === 'high' || l.includes('גבוה') || l === 'highimportance') {
    return { label: 'HIGH', cls: 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800' };
  }
  if (l === 'medium' || l.includes('בינוני') || l === 'med') {
    return { label: 'MEDIUM', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200 dark:border-orange-800' };
  }
  if (l === 'low' || l.includes('נמוך')) {
    return { label: 'LOW', cls: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-500 border border-slate-200 dark:border-zinc-700' };
  }
  if (level) {
    return { label: String(level).toUpperCase().slice(0, 12), cls: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400' };
  }
  return null;
}

const IMPORTANCE_TEXT_CLS = {
  CRITICAL: 'text-red-950 dark:text-red-300',
  HIGH: 'text-red-700 dark:text-red-400',
  MEDIUM: 'text-orange-700 dark:text-orange-400',
  LOW: 'text-slate-500 dark:text-zinc-500',
};

/** Text-only severity styles for calendar / dashboard rows (no pill background). */
export function importanceTextStyles(level) {
  const meta = importanceStyles(level);
  if (!meta) return null;
  return {
    label: meta.label,
    textCls: IMPORTANCE_TEXT_CLS[meta.label] || 'text-slate-600 dark:text-zinc-400',
  };
}

/** Direction chip label + emoji for market regime / trend tokens. */
export function directionChip(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const tone = resolveTone(raw);
  const styles = toneStyles(tone);
  const known = {
    bullish: 'שורי', bearish: 'דובי', neutral: 'ניטרלי',
    up: 'עולה', down: 'יורד',
    'risk on': 'אופטימיות בשוק', 'risk off': 'חשש בשוק',
    strong: 'חזק', weak: 'חלש',
    expansion: 'התרחבות', contraction: 'התכווצות',
  };
  const lower = raw.toLowerCase();
  const label = known[lower] || raw;
  return { label, tone, emoji: styles.chip, cls: styles.badge, textCls: styles.text };
}

/** Parse change for display — numeric path only; no legacy ▲/raw-number fallbacks. */
export function parseChangeDisplay(value, contextText = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const ctx = [contextText, raw].filter(Boolean).join(' ');
  const numeric = formatMarketChange(raw, ctx);
  if (numeric) return numeric;

  if (/^[+-]?\d+(?:\.\d+)?\s*%?$/.test(raw)) return null;

  if (isDuplicateDirectionLabel(raw)) return null;

  const tone = resolveTone(raw);
  const styles = toneStyles(tone);
  return { kind: 'text', text: raw, tone, arrow: '', cls: `font-semibold ${styles.text}` };
}

const NUMERIC_CHANGE_ARROW_UP = '↑';
const NUMERIC_CHANGE_ARROW_DOWN = '↓';

const BEARISH_PERCENT_CTX = /יורד|יריד|שליל|אדום|down|bearish|drop|crash|דילול|loss|sell|weak|חלש/i;
const BULLISH_PERCENT_CTX = /עול|עלי|חיוב|ירוק|up|bullish|rally|gain|פריצ|טסה|strong|חזק/i;

const TRAILING_DIRECTION_SUFFIX_RE =
  /\s*(עליה|עלייה|עולה|ירידה|יורדת|יורד|חיובי|שלילי|up|down|bullish|bearish|positive|negative)\s*$/i;

function formatChangeNumberValue(num) {
  const abs = Math.abs(num);
  return Number.isInteger(abs) ? String(abs) : String(parseFloat(abs.toFixed(2)));
}

function buildNumericChangeResult(num, { includePercent = true } = {}) {
  if (Number.isNaN(num)) return null;

  if (num === 0) {
    return {
      kind: 'neutral',
      text: '—',
      tone: TONE.NEUTRAL,
      arrow: '',
      cls: 'text-base font-semibold tabular-nums text-slate-400 dark:text-zinc-500',
    };
  }

  const tone = num > 0 ? TONE.BULLISH : TONE.BEARISH;
  const styles = toneStyles(tone);
  const arrow = num > 0 ? NUMERIC_CHANGE_ARROW_UP : NUMERIC_CHANGE_ARROW_DOWN;
  const suffix = includePercent ? '%' : '';

  return {
    kind: 'percent',
    text: `${formatChangeNumberValue(num)}${suffix}`,
    tone,
    arrow,
    cls: `text-base font-bold tabular-nums ${styles.text}`,
  };
}

function inferSignedNumber(unsignedNum, contextText) {
  const ctx = String(contextText || '');
  const bullish = BULLISH_PERCENT_CTX.test(ctx);
  const bearish = BEARISH_PERCENT_CTX.test(ctx);
  if (bullish && !bearish) return Math.abs(unsignedNum);
  if (bearish && !bullish) return -Math.abs(unsignedNum);
  const tone = resolveTone(ctx);
  if (tone === TONE.BULLISH) return Math.abs(unsignedNum);
  if (tone === TONE.BEARISH) return -Math.abs(unsignedNum);
  return null;
}

function applyMarketChangeSign(num, { hasExplicitSign, hadArrowPrefix, original, ctx }) {
  if (hasExplicitSign || num === 0) return num;
  if (hadArrowPrefix) {
    return /^[↑▲]/.test(original) ? Math.abs(num) : -Math.abs(num);
  }
  const signed = inferSignedNumber(num, ctx);
  if (signed != null) return signed;
  // Market convention: unsigned values are positive change (0.6% → ↑ 0.6%)
  return Math.abs(num);
}

/**
 * Canonical formatter for market % change fields.
 * value > 0 → green ↑ X% | value < 0 → red ↓ X% | 0 / null → gray —
 */
export function formatMarketChange(value, contextText = '') {
  const original = String(value ?? '').trim();
  if (!original) return null;

  const hadArrowPrefix = /^[↑↓▲▼]/.test(original);
  const raw = original
    .replace(/^[↑↓▲▼]\s*/, '')
    .replace(TRAILING_DIRECTION_SUFFIX_RE, '')
    .trim();
  if (!raw) return null;

  const ctx = [contextText, original].filter(Boolean).join(' ');

  const wholeMatch = raw.match(/^([+-]?\d+(?:\.\d+)?)\s*%?$/);
  if (wholeMatch) {
    let num = parseFloat(wholeMatch[1]);
    if (Number.isNaN(num)) return null;
    const hasExplicitSign = wholeMatch[1].startsWith('-') || wholeMatch[1].startsWith('+');
    num = applyMarketChangeSign(num, { hasExplicitSign, hadArrowPrefix, original, ctx });
    const includePercent = /%/.test(raw) || !/[a-zA-Zא-ת]/.test(raw);
    return buildNumericChangeResult(num, { includePercent });
  }

  const embeddedMatch = raw.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (!embeddedMatch) return null;

  let num = parseFloat(embeddedMatch[1]);
  if (Number.isNaN(num)) return null;
  const hasExplicitSign = embeddedMatch[1].startsWith('-') || embeddedMatch[1].startsWith('+');
  num = applyMarketChangeSign(num, { hasExplicitSign, hadArrowPrefix, original, ctx });
  return buildNumericChangeResult(num, { includePercent: true });
}

/** @deprecated alias — prefer formatMarketChange */
export function parseNumericChangeDisplay(value, contextText = '') {
  return formatMarketChange(value, contextText);
}

/** Percent / numeric change display with arrow + color (presentation only). */
export function parsePercentChangeDisplay(value, contextText = '') {
  return formatMarketChange(value, contextText);
}

/** Duplicate direction words — hidden when % / color already conveys direction. */
const DUPLICATE_DIRECTION_LABELS = new Set([
  'עולה', 'עול', 'עלייה', 'עליה', 'יורד', 'יורדת', 'ירידה', 'חיובי', 'שלילי',
  'up', 'down', 'bullish', 'bearish', 'positive', 'negative',
  'neutral', 'flat',
]);

const STRENGTH_INDICATOR_LABELS = new Set([
  'strong', 'weak', 'חזק', 'חלש', 'חזקה', 'חלשה',
]);

/** Redundant direction label (עולה, חיובי, …) — not strength (strong/weak). */
export function isDuplicateDirectionLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return true;
  if (/\d/.test(raw) || /%/.test(raw)) return false;
  return DUPLICATE_DIRECTION_LABELS.has(raw.toLowerCase());
}

/** @deprecated alias — use isDuplicateDirectionLabel */
export function isDirectionOnlyLabel(value) {
  return isDuplicateDirectionLabel(value);
}

export function isStrengthIndicatorLabel(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  return STRENGTH_INDICATOR_LABELS.has(raw);
}

/**
 * Parts for Markets "שינוי / חוזק" cell: percent first, then strong/weak etc.
 * Skips duplicate direction words (עולה, חיובי, …).
 */
function marketRowContext(row) {
  return [row?.trend, row?.strength, row?.comment].filter(Boolean).join(' ');
}

export function getMarketChangeStrengthParts(row) {
  const parts = [];
  const seen = new Set();
  const contextBlob = marketRowContext(row);

  const strengthVal = String(row?.strength ?? '').trim();
  const trendVal = String(row?.trend ?? '').trim();
  const pct = formatMarketChange(strengthVal, contextBlob)
    || formatMarketChange(trendVal, contextBlob);
  if (pct) {
    parts.push({ ...pct });
    seen.add(pct.text.toLowerCase());
  }

  for (const val of [row?.strength, row?.trend]) {
    const raw = String(val ?? '').trim();
    if (!raw || formatMarketChange(raw, contextBlob)) continue;
    if (isDuplicateDirectionLabel(raw)) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push({ kind: 'indicator', text: raw, tone: resolveTone(raw) });
  }

  return parts;
}

const MACRO_DIRECTION_POSITIVE_KW = [
  'מומנטום חיובי', 'התחזקות', 'התחממות', 'עלייה', 'חיובי', 'שורי', 'breakout', 'strong',
  'bullish', 'positive', 'rally', 'gain', 'עולה', 'חזק', 'חזקה', 'שיפור', 'עול',
];
const MACRO_DIRECTION_NEGATIVE_KW = [
  'מומנטום שלילי', 'לחץ מכירות', 'ירידה', 'נחלש', 'חולשה', 'שלילי', 'bearish', 'weak',
  'warning', 'risk', 'סיכון', 'יורד', 'חלש', 'לחץ', 'יריד', 'מכירות', 'אזהרה',
];
const MACRO_DIRECTION_NEUTRAL_KW = [
  'ללא שינוי', 'במעקב', 'ניטרלי', 'neutral', 'flat', 'unchanged', 'mixed', 'sideways', 'המתנה',
];

const MACRO_DIRECTION_CLS = {
  [TONE.BULLISH]: 'text-base font-bold text-emerald-700 dark:text-emerald-300',
  [TONE.BEARISH]: 'text-base font-bold text-red-700 dark:text-red-300',
  [TONE.NEUTRAL]: 'text-base font-bold text-slate-500 dark:text-zinc-400',
};

/** Infer macro sentiment from descriptive text (keyword scan). */
export function inferMacroDirectionTone(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return TONE.NEUTRAL;

  if (/^[↑▲+]/.test(raw)) return TONE.BULLISH;
  if (/^[↓▼-]/.test(raw)) return TONE.BEARISH;

  const lower = raw.toLowerCase();

  for (const kw of MACRO_DIRECTION_NEUTRAL_KW) {
    if (lower.includes(kw.toLowerCase())) return TONE.NEUTRAL;
  }
  for (const kw of MACRO_DIRECTION_NEGATIVE_KW) {
    if (lower.includes(kw.toLowerCase())) return TONE.BEARISH;
  }
  for (const kw of MACRO_DIRECTION_POSITIVE_KW) {
    if (lower.includes(kw.toLowerCase())) return TONE.BULLISH;
  }

  return resolveTone(raw);
}

/**
 * Canonical formatter for macro descriptive direction / sentiment text.
 * ↑ green (bullish) | ↓ red (bearish) | • gray (neutral)
 */
export function formatMacroDirection(text, structuredTone = null) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;

  const displayText = raw.replace(/^[↑↓▲▼•]\s*/, '').trim();
  if (!displayText) return null;

  const tone = structuredTone && structuredTone !== TONE.NEUTRAL
    ? structuredTone
    : inferMacroDirectionTone(raw);

  const arrow = tone === TONE.BULLISH ? '↑' : tone === TONE.BEARISH ? '↓' : '•';

  return {
    kind: 'direction',
    text: displayText,
    tone,
    arrow,
    cls: MACRO_DIRECTION_CLS[tone] || MACRO_DIRECTION_CLS[TONE.NEUTRAL],
  };
}

/** Macro change cell: percent, or directional descriptive text. */
export function getMacroChangeDisplay(change, contextText = '') {
  const original = String(change ?? '').trim();
  if (!original) return null;

  const ctx = [contextText, original].filter(Boolean).join(' ');
  const numeric = formatMarketChange(original, ctx);
  if (numeric) return numeric;

  if (/^[+-]?\d+(?:\.\d+)?\s*%?$/.test(original)) return null;

  const ctxTone = inferMacroDirectionTone(ctx);
  const structured = ctxTone !== TONE.NEUTRAL && ctxTone !== inferMacroDirectionTone(original)
    ? ctxTone
    : null;

  return formatMacroDirection(original, structured);
}

/** Format any macro sentiment field (change, impact, description). */
export function getMacroFieldDisplay(text, row = null) {
  const original = String(text ?? '').trim();
  if (!original) return null;

  const ctx = row
    ? [row.impact, row.change, row.description, row.indicator].filter(Boolean).join(' ')
    : '';
  const ctxTone = inferMacroDirectionTone(ctx);

  const numeric = formatMarketChange(original, ctx);
  if (numeric) return numeric;

  if (/^[+-]?\d+(?:\.\d+)?\s*%?$/.test(original)) return null;

  const selfTone = inferMacroDirectionTone(original);
  const structured = selfTone !== TONE.NEUTRAL ? selfTone : (ctxTone !== TONE.NEUTRAL ? ctxTone : null);

  return formatMacroDirection(original, structured);
}

function formatStockMovePercentValue(num) {
  return Number.isInteger(num) ? String(num) : String(parseFloat(num.toFixed(2)));
}

/**
 * Extract move % from stock mention text for display-only row header (presentation only).
 * Returns { display: '↑ 5%', tone, percent } or null when unknown/neutral.
 */
export function parseStockMovePercentFromText(textParts, fallbackTone = null) {
  const blob = (Array.isArray(textParts) ? textParts : [textParts])
    .filter(Boolean)
    .map((t) => String(t).trim())
    .filter(Boolean)
    .join(' ');
  if (!blob) return null;

  // Hebrew "ב-5%" / "ב 5%" = magnitude only (not a negative sign)
  const hebrewByMatch = blob.match(/ב[-\s]?(\d+(?:\.\d+)?)\s*%/);
  const signedMatch = !hebrewByMatch
    ? blob.match(/(?<![א-תA-Za-z])([+-]\d+(?:\.\d+)?)\s*%/)
    : null;
  const plainMatch = !hebrewByMatch && !signedMatch
    ? blob.match(/(\d+(?:\.\d+)?)\s*%/)
    : null;

  const match = hebrewByMatch || signedMatch || plainMatch;
  if (!match) return null;

  let num = parseFloat(match[1]);
  if (Number.isNaN(num)) return null;

  const matchIdx = blob.indexOf(match[0]);
  const window = blob.slice(Math.max(0, matchIdx - 48), matchIdx + match[0].length + 8);

  let tone = TONE.NEUTRAL;
  if (hebrewByMatch) {
    num = Math.abs(num);
    if (BEARISH_PERCENT_CTX.test(window) && !BULLISH_PERCENT_CTX.test(window)) {
      tone = TONE.BEARISH;
    } else if (BULLISH_PERCENT_CTX.test(window) && !BEARISH_PERCENT_CTX.test(window)) {
      tone = TONE.BULLISH;
    } else if (fallbackTone === TONE.BULLISH || fallbackTone === TONE.BEARISH) {
      tone = fallbackTone;
    }
  } else if (signedMatch && (match[1].startsWith('-') || num < 0)) {
    tone = TONE.BEARISH;
    num = Math.abs(num);
  } else if (signedMatch && match[1].startsWith('+')) {
    tone = TONE.BULLISH;
  } else if (BEARISH_PERCENT_CTX.test(window) && !BULLISH_PERCENT_CTX.test(window)) {
    tone = TONE.BEARISH;
  } else if (BULLISH_PERCENT_CTX.test(window) && !BEARISH_PERCENT_CTX.test(window)) {
    tone = TONE.BULLISH;
  } else if (fallbackTone === TONE.BULLISH || fallbackTone === TONE.BEARISH) {
    tone = fallbackTone;
  }

  if (tone === TONE.NEUTRAL) return null;

  const valueStr = formatStockMovePercentValue(num);
  const arrow = tone === TONE.BULLISH ? '↑' : '↓';

  return {
    percent: num,
    tone,
    display: `${arrow} ${valueStr}%`,
    arrow,
    valueStr,
  };
}

/** Stock category badge metadata. */
export const STOCK_CATEGORY_BADGES = {
  opportunity: { emoji: '🚀', label: 'הזדמנות', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' },
  watchlist: { emoji: '👀', label: 'מעקב', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300' },
  risk: { emoji: '⚠️', label: 'סיכון', cls: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300' },
  general: { emoji: '📰', label: 'אזכור', cls: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400' },
};

export function stockCategoryBadge(category) {
  return STOCK_CATEGORY_BADGES[category] || STOCK_CATEGORY_BADGES.general;
}

/** Sentiment label → tone for stock cards. */
export function sentimentTone(sentiment) {
  const s = norm(sentiment);
  if (['חיובי', 'positive', 'bullish', 'buy'].some((t) => s.includes(t))) return TONE.BULLISH;
  if (['שלילי', 'negative', 'bearish', 'sell', 'risk'].some((t) => s.includes(t))) return TONE.BEARISH;
  return TONE.NEUTRAL;
}

function findWordMatch(text, wordList) {
  const t = norm(text);
  if (!t) return null;
  for (const { tok, label } of wordList) {
    if (t.includes(norm(tok))) return { tok, label };
  }
  return null;
}

function combineFieldText(...parts) {
  return parts
    .filter((p) => p != null && String(p).trim())
    .map((p) => String(p).trim())
    .join(' ');
}

/**
 * Detect direction from free text (status, context, notes, etc.).
 * @returns {{ direction: string, label: string, tone: string }}
 */
export function getDirectionFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { direction: DIRECTION.NEUTRAL, label: '', tone: TONE.NEUTRAL };
  }

  const breakout = findWordMatch(raw, BREAKOUT_WORDS);
  if (breakout) {
    return { direction: DIRECTION.BREAKOUT, label: breakout.label, tone: TONE.BULLISH };
  }

  const negative = findWordMatch(raw, NEGATIVE_WORDS);
  if (negative) {
    return { direction: DIRECTION.NEGATIVE, label: negative.label, tone: TONE.BEARISH };
  }

  const positive = findWordMatch(raw, POSITIVE_WORDS);
  if (positive) {
    return { direction: DIRECTION.POSITIVE, label: positive.label, tone: TONE.BULLISH };
  }

  const watch = findWordMatch(raw, WATCH_WORDS);
  if (watch) {
    return { direction: DIRECTION.WATCH, label: watch.label, tone: TONE.NEUTRAL };
  }

  const tone = resolveTone(raw);
  if (tone === TONE.BULLISH) {
    return { direction: DIRECTION.POSITIVE, label: raw.slice(0, 24), tone };
  }
  if (tone === TONE.BEARISH) {
    return { direction: DIRECTION.NEGATIVE, label: raw.slice(0, 24), tone };
  }

  return { direction: DIRECTION.NEUTRAL, label: '', tone: TONE.NEUTRAL };
}

/**
 * Detect direction from stock / opportunity fields (presentation only).
 * Accepts: status, action, sentiment, category, context, notes, strategy, actionability
 */
export function getDirectionFromFields(fields = {}) {
  const {
    status, action, sentiment, category, context, notes, strategy, actionability, title, detail,
  } = fields;

  const blob = combineFieldText(
    status, action, sentiment, context, notes, strategy, actionability, title, detail,
  );

  const fromText = getDirectionFromText(blob);

  if (fromText.direction !== DIRECTION.NEUTRAL) {
    if (category === 'risk' && fromText.direction === DIRECTION.POSITIVE) {
      return { ...fromText, direction: DIRECTION.RISK, label: fromText.label || 'סיכון' };
    }
    return fromText;
  }

  if (category === 'risk') {
    return { direction: DIRECTION.RISK, label: 'סיכון', tone: TONE.BEARISH };
  }
  if (category === 'opportunity') {
    return { direction: DIRECTION.BREAKOUT, label: 'הזדמנות', tone: TONE.BULLISH };
  }
  if (category === 'watchlist') {
    return { direction: DIRECTION.WATCH, label: 'מעקב', tone: TONE.NEUTRAL };
  }

  if (sentiment) {
    const s = norm(sentiment);
    if (['חיובי', 'positive', 'bullish'].some((t) => s.includes(t))) {
      return { direction: DIRECTION.POSITIVE, label: sentiment, tone: TONE.BULLISH };
    }
    if (['שלילי', 'negative', 'bearish'].some((t) => s.includes(t))) {
      return { direction: DIRECTION.NEGATIVE, label: sentiment, tone: TONE.BEARISH };
    }
  }

  return { direction: DIRECTION.NEUTRAL, label: '', tone: TONE.NEUTRAL };
}

/** Tailwind class bundle for a direction key. */
export function getDirectionClassName(direction) {
  return DIRECTION_STYLES[direction] || DIRECTION_STYLES[DIRECTION.NEUTRAL];
}

/**
 * Badge metadata for rendering near ticker.
 * @returns {{ direction, label, tone, arrow, icon, cls, border, bg, text }}
 */
export function getDirectionBadge(fieldsOrText) {
  const result = typeof fieldsOrText === 'string'
    ? getDirectionFromText(fieldsOrText)
    : getDirectionFromFields(fieldsOrText);
  const styles = getDirectionClassName(result.direction);
  const label = result.label || (
    result.direction === DIRECTION.BREAKOUT ? 'פריצה'
      : result.direction === DIRECTION.RISK ? 'סיכון'
        : result.direction === DIRECTION.WATCH ? 'מעקב'
          : result.direction === DIRECTION.POSITIVE ? 'עולה'
            : result.direction === DIRECTION.NEGATIVE ? 'יורדת'
              : ''
  );
  return {
    ...result,
    ...styles,
    cls: styles.badge,
  };
}

const TICKER_RE = /\b[A-Z]{1,5}\b/g;

/** Extract tickers from risk/opportunity text for inline badges. */
export function tickersInDisplayText(text) {
  const matches = String(text || '').match(TICKER_RE);
  return matches ? [...new Set(matches)] : [];
}
