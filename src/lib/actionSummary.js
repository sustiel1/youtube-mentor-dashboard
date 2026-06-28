// ── Action Summary Utility ─────────────────────────────────────────────────
// Derives actionType + actionSummary from existing item fields.
// Reads item.actionSummary / item.actionType if already present (from AI JSON),
// otherwise falls back to rule-based derivation.

export const ACTION = {
  WATCH:     { key: 'WATCH',     label: 'מעקב',   emoji: '👁',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  BUY:       { key: 'BUY',       label: 'כניסה',  emoji: '🟢',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  RISK:      { key: 'RISK',      label: 'סיכון',  emoji: '⚠️',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  EVENT:     { key: 'EVENT',     label: 'אירוע',  emoji: '📅',  cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  TODO:      { key: 'TODO',      label: 'לביצוע', emoji: '✅',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};

const SECTION_DEFAULT_ACTION = {
  opportunities:  ACTION.WATCH,
  risks:          ACTION.RISK,
  'macro-events': ACTION.EVENT,
  warnings:       ACTION.TODO,
  highlights:     ACTION.WATCH,
  sectors:        ACTION.WATCH,
  watchlist:      ACTION.WATCH,
};

/** Derive ACTION type from item data + section context. */
export function deriveActionType(item, sectionKey) {
  if (item?.actionType && ACTION[item.actionType]) return ACTION[item.actionType];
  if (sectionKey === 'opportunities') {
    const c = String((item?.title || '') + ' ' + (item?.details || '')).toLowerCase();
    if (/strong|breakout|buy|לונג|חזק|פריצה/.test(c)) return ACTION.BUY;
  }
  return SECTION_DEFAULT_ACTION[sectionKey] || ACTION.WATCH;
}

/** Derive a short action summary (max ~7 words) from item data. */
export function deriveActionSummary(item, sectionKey) {
  if (item?.actionSummary) return item.actionSummary;
  const raw = typeof item === 'string' ? item
    : (item?.actionTitle || item?.title || item?.name || item?.event || item?.warning || '');
  const text = String(raw || '').trim();
  if (!text) return null;
  const words = text.split(/\s+/);
  return words.slice(0, 7).join(' ') + (words.length > 7 ? '...' : '');
}

// ── Decision Status (opportunities only) ──────────────────────────────────

export const DECISION = {
  strong:     { label: 'Strong',     he: 'חזק',    emoji: '🟢', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  watch:      { label: 'Watch',      he: 'מעקב',   emoji: '🟡', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  accumulate: { label: 'Accumulate', he: 'צבירה',  emoji: '🔵', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  wait:       { label: 'Wait',       he: 'המתן',   emoji: '🟠', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  avoid:      { label: 'Avoid',      he: 'הימנע',  emoji: '🔴', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

/** Derive decision status for an opportunity item. */
export function deriveDecisionStatus(item) {
  if (typeof item === 'string') return null;
  const raw = String(item?.decisionStatus || item?.recommendation || item?.conviction || item?.status || '').toLowerCase();
  if (!raw) return null;
  if (/strong|חזק|buy|פריצה|breakout|לונג/.test(raw)) return DECISION.strong;
  if (/accumulate|צבור|צבירה/.test(raw)) return DECISION.accumulate;
  if (/wait|המתן|caution|זהירות|negotiate|לנהל משא|wait.*neg/.test(raw)) return DECISION.wait;
  if (/avoid|הימנע|sell|מכור|short/.test(raw)) return DECISION.avoid;
  if (/watch|מעקב|monitor|עקוב/.test(raw)) return DECISION.watch;
  return null;
}

// ── Warnings: short action title heuristic ────────────────────────────────

const WARNING_ICON_MAP = [
  { test: /נפט|oil|opec|אנרגיה|energy/i,              icon: '🛢' },
  { test: /ריבית|fed|fomc|rate|הלוואה|בנק|bank/i,     icon: '🏦' },
  { test: /קבלן|נדל"ן|real.*estate|housing|דירה/i,    icon: '🏗' },
  { test: /מניות|stocks|support|תמיכה|mega.*cap/i,     icon: '📈' },
  { test: /אינפלציה|inflation|cpi|מחירים|prices/i,    icon: '📊' },
  { test: /מטבע|dollar|שקל|currency|forex/i,          icon: '💱' },
  { test: /אג"ח|bonds|treasury|yields/i,              icon: '🏛' },
  { test: /סחר|trade|tariff|מכס/i,                    icon: '🔄' },
];

/** Pick a contextual icon for a warning/action item. */
export function warningIcon(text) {
  const t = String(text || '').toLowerCase();
  for (const { test, icon } of WARNING_ICON_MAP) {
    if (test.test(t)) return icon;
  }
  return '🎯';
}
