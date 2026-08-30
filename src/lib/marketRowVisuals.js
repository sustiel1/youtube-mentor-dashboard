/**
 * Shared market-row presentation helpers.
 *
 * `getMarketTrendTone` is a verbatim copy of the private `getTrendTone` in
 * `src/components/workspace/StructuredSnapshotView.jsx` (committed with the
 * snapshot Markets table redesign). It is duplicated here — not imported — so
 * this module can be reused by the saved-rows Markets table without editing the
 * structured-snapshot file (still true and untouched here — StructuredSnapshotView.jsx
 * is out of scope for this fix; its own copy of the regex is unaffected). A
 * future cleanup can make StructuredSnapshotView import from here and delete
 * its local copy — at which point it would inherit this fix too.
 *
 * The bullish branch's "עול"/"עלי" substrings also match inside the unrelated
 * word "פעולה" ("action" — a common activity-tag label in saved GEM rows),
 * per lessons.md (2026-08-30). `getMarketTrendTone` strips that known
 * false-positive whole word before testing — see hebrewSentimentTokenGuard.js.
 */
import { stripSentimentFalsePositiveTokens } from '@/lib/hebrewSentimentTokenGuard';

const PILL_TONE_SLATE = {
  className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  dotClassName: 'bg-slate-400',
};

/** Market trend → pill tone (עולה / יורד / דשדוש). */
export function getMarketTrendTone(value) {
  const text = stripSentimentFalsePositiveTokens(String(value || '').trim()).toLowerCase();
  if (/דשדוש|מדשדש|צידי|יציב|ללא שינוי|שטוח|מעורב|ניטרל/.test(text)) {
    return {
      className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      dotClassName: 'bg-amber-500',
    };
  }
  if (/יור[דת]|יריד|נפיל|צונ|דוב|שליל|נחלש|אדום|מתמת/.test(text)) {
    return {
      className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
      dotClassName: 'bg-red-500',
    };
  }
  if (/עול|עלי|טיפוס|מזנק|שור|ראלי|ירוק|חיוב/.test(text)) {
    return {
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      dotClassName: 'bg-emerald-500',
    };
  }
  return PILL_TONE_SLATE;
}

/** Shared pill container class — matches the snapshot Markets/Sentiment pills. */
export const MARKET_PILL_CLS =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold';
