/**
 * Shared Summary tab card shell — visual consistency only (no layout/logic).
 */
export const SUMMARY_CARD_CLASS =
  'rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-4 py-3';

/**
 * Single source of truth for ALL tab section label typography.
 * Matches SECTION_HEADER_TITLE_CLS (MorningBriefVisualPrimitives) — the reference is "אירועי מאקרו".
 * Used by UniversalTabSectionLabelRow, SummaryBriefingView, AppBuilder, and any
 * component that renders a top-level group/section label within tab content.
 */
export const TAB_SECTION_LABEL_CLS =
  'text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight leading-snug text-right mb-1.5';

/** Alias kept for callers that already import SUMMARY_CARD_TITLE_CLASS. */
export const SUMMARY_CARD_TITLE_CLASS = TAB_SECTION_LABEL_CLS;

/** Lead typography for the primary takeaway — no extra background or card shell. */
export const SUMMARY_LEAD_CLASS =
  'text-base sm:text-[1.05rem] font-medium leading-relaxed text-slate-900 dark:text-zinc-100 border-r-2 border-slate-300 dark:border-zinc-600 pr-3 text-right';
