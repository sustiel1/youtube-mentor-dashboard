/**
 * Shared Morning Brief table layout — fixed columns, RTL-safe, horizontal scroll on narrow viewports.
 * Macro Gem dashboard tables are the visual reference (MCOL percentages).
 */

export const BRIEF_TABLE_MIN_WIDTH_CLS = 'min-w-[980px]';

export const BRIEF_TABLE_WRAPPER_CLS = 'w-full overflow-x-auto';

export const BRIEF_TABLE_CLS = `w-full ${BRIEF_TABLE_MIN_WIDTH_CLS} text-right border-collapse table-fixed`;

export const BRIEF_TABLE_HEAD_ROW_CLS = 'border-b-2 border-slate-200/80 dark:border-zinc-700/70';

/**
 * Column widths — all tables share the same alignment anchor:
 *   checkbox(2.5%) + [pre-sentiment cols summing to 38%] = 40.5% → sentiment always starts here.
 *
 * 3-col sections (label | sentiment | notes):   primaryLabel(38%)
 * 4-col sections (ind + val | sentiment | notes): indicator(24%) + macroValue(14%) = 38%
 * 4-col sections (asset | sentiment | change | notes): asset(38%)
 * 5-col sections (sym + sector | sentiment | change | notes): symbol(20%) + sector(18%) = 38%
 */
export const BRIEF_COL = {
  checkbox: '2.5%',
  save: '5%',
  sentiment: '15.5%',
  asset: '27%',
  change: '11%',
  symbol: '20%',       // was 11% — stocks: symbol(20) + sector(18) = 38 → aligns sentiment
  sector: '18%',       // was 14% — stocks: symbol(20) + sector(18) = 38 → aligns sentiment
  type: '18%',
  indicator: '24%',    // was 22% — macro: indicator(24) + macroValue(14) = 38 → aligns sentiment
  macroValue: '14%',
  links: '12%',
  /** Standard primary-label column — all single-label sections use this. */
  primaryLabel: '38%',
};

export const BRIEF_MARKETS_COL = {
  asset: '38%',        // was 11% — aligns with primaryLabel so sentiment starts at 40.5%
  sentiment: '15.5%',
  change: '11%',
};

export const BRIEF_CELL = {
  checkbox: 'py-2 pr-2 pl-0 align-middle',
  save: 'py-2 pl-1 pr-0 align-middle opacity-0 group-hover:opacity-100 transition-opacity',
  short: 'px-2 py-2 align-middle whitespace-nowrap overflow-hidden',
  sentiment: 'px-2 py-2 align-middle whitespace-nowrap overflow-hidden',
  change: 'px-2 py-2 align-middle whitespace-nowrap overflow-hidden text-right',
  notes: 'px-2 py-2 align-middle min-w-0 overflow-hidden',
  links: 'px-2 py-2 align-middle whitespace-nowrap overflow-hidden',
};

export const BRIEF_NOTES_TEXT_CLS =
  'text-[15px] font-semibold text-slate-900 dark:text-zinc-100 leading-[1.45] whitespace-normal break-words [overflow-wrap:anywhere]';

export const BRIEF_SENTIMENT_INLINE_CLS =
  'text-sm font-medium text-slate-900 dark:text-zinc-50 shrink-0';

export function BriefTableWrapper({ children, className = '' }) {
  return (
    <div className={`${BRIEF_TABLE_WRAPPER_CLS} ${className}`.trim()} dir="rtl">
      {children}
    </div>
  );
}
