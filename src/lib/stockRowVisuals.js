/**
 * Shared stock-row presentation helpers for individually-saved
 * "מניות שהוזכרו" rows (SavedStockRowsTable).
 *
 * Pure JS / no JSX — kept separate from SectorPill (which lives directly in
 * SavedStockRowsTable.jsx, its only consumer) so this module can be unit
 * tested with plain node, the same split already used for marketRowVisuals.js
 * vs. MarketAssetLinksMenu.jsx.
 *
 * `SECTOR_TONE` / `SECTOR_TONE_FALLBACK` / `getSectorTone` / `PILL_CLS` /
 * `SECTOR_PILL_CLS` / `CATEGORY_META` / `CATEGORY_ORDER` / `getActivityTone`
 * are verbatim copies of the private helpers in
 * `src/components/workspace/StructuredSnapshotView.jsx` (committed with the
 * snapshot Stocks table redesign). Duplicated here — not imported — so this
 * module can be reused without editing the structured-snapshot file. A future
 * cleanup can make StructuredSnapshotView import from here instead.
 *
 * `getSavedStockSentimentTone` and `deriveSyntheticStockCategory` are NEW,
 * not copies — the saved-row data shape differs from the structured-snapshot
 * one (see each function's doc comment).
 */

export const PILL_CLS = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold';
export const SECTOR_PILL_CLS = `${PILL_CLS} max-w-full whitespace-nowrap`;

// Sector ETF → pill tone. Verbatim copy of StructuredSnapshotView's SECTOR_TONE.
const SECTOR_TONE = {
  XLK:  'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300',
  IGV:  'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
  SMH:  'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  XLC:  'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  XLY:  'border-pink-200 bg-pink-50 text-pink-800 dark:border-pink-800 dark:bg-pink-950/40 dark:text-pink-300',
  XLP:  'border-lime-200 bg-lime-50 text-lime-800 dark:border-lime-800 dark:bg-lime-950/40 dark:text-lime-300',
  XLF:  'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  XLE:  'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  XLI:  'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  XLV:  'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  XLB:  'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
  XLU:  'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  XLRE: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300',
};
const SECTOR_TONE_FALLBACK = 'border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

export function getSectorTone(etf) {
  return SECTOR_TONE[String(etf || '').toUpperCase()] || SECTOR_TONE_FALLBACK;
}

// Stock category → { key, label, tone }. Verbatim copy of StructuredSnapshotView's CATEGORY_META.
export const CATEGORY_META = {
  watchlist:   { label: 'Watchlist', tone: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' },
  risk:        { label: 'סיכון',      tone: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300' },
  opportunity: { label: 'הזדמנות',    tone: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300' },
  general:     { label: 'אזכור',      tone: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
};
export const CATEGORY_ORDER = ['watchlist', 'risk', 'opportunity', 'general'];

/**
 * Saved rows carry no real "category" field — the concept only exists in the
 * structured-snapshot data model. This derives a synthetic stand-in from the
 * (weaker) positive/negative/null sentiment parseStockFromText already infers,
 * purely so the category filter-chip UX visually matches the committed
 * StocksTable. Mapping (per explicit decision, 2026-08-30):
 *   positive → opportunity (הזדמנות)
 *   negative → risk        (סיכון)
 *   null     → general     (אזכור) — no signal either way, just a mention.
 * "watchlist" is intentionally never produced here: nothing in the saved data
 * indicates an explicit follow/track intent, and mislabeling a plain mention
 * as "Watchlist" would overstate what's actually known about the row.
 */
export function deriveSyntheticStockCategory(sentiment) {
  if (sentiment === 'positive') return 'opportunity';
  if (sentiment === 'negative') return 'risk';
  return 'general';
}

/** "avoid" activity gets a red-tinted tag; everything else is a neutral tag. Verbatim copy. */
export function getActivityTone(value) {
  return /avoid|הימנע|הימנעות|להימנע/i.test(String(value || ''))
    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

/**
 * Sentiment pill tone for stockRowText.js's positive/negative/neutral/null
 * output. NOT a copy of StructuredSnapshotView's getSentimentTone — that
 * function matches free Hebrew sentiment text (חיובי/שלילי/מתוח...) via
 * substring regex; saved rows carry a clean explicit enum instead (see
 * extractExplicitSentiment in stockRowText.js), so a direct switch is more
 * honest than reusing a regex built for a different input domain. `null`
 * (no pill, shown as "—") means no sentiment segment was present at all —
 * distinct from an explicit "neutral" label.
 */
export function getSavedStockSentimentTone(sentiment) {
  if (sentiment === 'positive') {
    return {
      label: 'חיובי',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      dotClassName: 'bg-emerald-500',
    };
  }
  if (sentiment === 'negative') {
    return {
      label: 'שלילי',
      className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
      dotClassName: 'bg-red-500',
    };
  }
  if (sentiment === 'neutral') {
    return {
      label: 'ניטרלי',
      className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      dotClassName: 'bg-amber-500',
    };
  }
  return null;
}
