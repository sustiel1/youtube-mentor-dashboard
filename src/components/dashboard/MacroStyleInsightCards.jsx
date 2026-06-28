import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
} from './MorningBriefVisualPrimitives';
import { ResearchDropdown } from '@/components/shared/ResearchDropdown';

export const INSIGHT_GRID_SLOT_COUNT = 3;

/** Pad to fixed slot count for stable 3-column grids. */
export function padInsightSlots(items, slotCount = INSIGHT_GRID_SLOT_COUNT, emptyValue = null) {
  const safe = Array.isArray(items) ? items : [];
  const slice = safe.slice(0, slotCount);
  const padLen = Math.max(0, slotCount - slice.length);
  return [...slice, ...Array(padLen).fill(emptyValue)];
}

export function getMacroOppStyle(type, assets) {
  const t = `${type || ''} ${assets || ''}`.toLowerCase();
  if (t.includes('real estate') || t.includes('reit') || t.includes('נדל'))
    return { bg: 'bg-teal-50 dark:bg-teal-950/20', border: 'border-teal-200 dark:border-teal-800', badge: 'text-teal-700 dark:text-teal-300 border border-teal-400/60 dark:border-teal-600/50', icon: '🏠' };
  if (t.includes('swing') || t.includes('trading') || t.includes('momentum') || t.includes('short') || t.includes('סווינג') || t.includes('מומנטום'))
    return { bg: 'bg-violet-50 dark:bg-violet-950/20', border: 'border-violet-200 dark:border-violet-800', badge: 'text-violet-700 dark:text-violet-300 border border-violet-400/60 dark:border-violet-600/50', icon: '📊' };
  if (t.includes('bond') || t.includes('fixed') || t.includes('treasury') || t.includes('אג"ח') || t.includes('ריבית'))
    return { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800', badge: 'text-blue-700 dark:text-blue-300 border border-blue-400/60 dark:border-blue-600/50', icon: '🏛️' };
  if (t.includes('long') || t.includes('equity') || t.includes('growth') || t.includes('לונג'))
    return { bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-800', badge: 'text-orange-700 dark:text-orange-300 border border-orange-400/60 dark:border-orange-600/50', icon: '🚀' };
  if (t.includes('bio') || t.includes('health') || t.includes('pharma') || t.includes('בריאות') || t.includes('ביוטק'))
    return { bg: 'bg-pink-50 dark:bg-pink-950/20', border: 'border-pink-200 dark:border-pink-800', badge: 'text-pink-700 dark:text-pink-300 border border-pink-400/60 dark:border-pink-600/50', icon: '🧬' };
  return { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800', badge: 'text-emerald-700 dark:text-emerald-300 border border-emerald-400/60 dark:border-emerald-600/50', icon: '💡' };
}

export function getMacroRiskStyle(severity) {
  const sl = String(severity || '').toLowerCase();
  if (sl.includes('קריטי') || sl.includes('critical'))
    return { bg: 'bg-red-100 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-700', badge: 'text-red-800 dark:text-red-300 border border-red-500/60 dark:border-red-600/50', icon: '🔴' };
  if (sl.includes('גבוהה') || sl.includes('high') || sl.includes('גבוה'))
    return { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-800', badge: 'text-red-700 dark:text-red-300 border border-red-400/60 dark:border-red-600/50', icon: '🔴' };
  if (sl.includes('בינונית') || sl.includes('medium') || sl.includes('בינוני'))
    return { bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-800', badge: 'text-orange-700 dark:text-orange-300 border border-orange-400/60 dark:border-orange-600/50', icon: '🟠' };
  return { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', badge: 'text-amber-700 dark:text-amber-300 border border-amber-400/60 dark:border-amber-600/50', icon: '⚠️' };
}

const EMPTY_CARD_BASE = 'flex flex-col rounded-xl border border-dashed p-4 shadow-sm min-h-[168px]';

const EMPTY_CARD_VARIANT_CLS = {
  opportunity: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-800/40',
  risk: 'bg-red-50/50 dark:bg-red-950/20 border-red-200/70 dark:border-red-800/40',
};

export function MacroStyleEmptyInsightCard({ variant = 'opportunity', slotIndex = 0 }) {
  const variantCls = EMPTY_CARD_VARIANT_CLS[variant] ?? EMPTY_CARD_VARIANT_CLS.opportunity;
  return (
    <div
      className={`${EMPTY_CARD_BASE} ${variantCls}`}
      data-empty-insight-slot
      data-insight-variant={variant}
      data-slot-index={slotIndex}
      aria-hidden
    />
  );
}

function MacroStyleInsightCardShell({
  style,
  title,
  pillLabel,
  details,
  assets,
  catalyst,
  pxUrl,
  researchTone = 'emerald',
  checkbox = null,
  saveActions = null,
  dataAttrs = {},
}) {
  const researchCls = researchTone === 'red'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-emerald-600 hover:bg-emerald-700';

  return (
    <div
      className={`group flex flex-col rounded-xl border ${style.border} ${style.bg} p-4 shadow-sm hover:shadow-md transition-shadow`}
      {...dataAttrs}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-white/70 dark:bg-zinc-900/50 shadow-sm text-xl">
          {style.icon}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-baseline gap-2 flex-wrap" dir="rtl">
            <p className={`text-sm font-bold leading-snug flex-1 min-w-0 ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} break-words [overflow-wrap:anywhere]`}>
              {title || '—'}
            </p>
            {pillLabel ? (
              <span className={`shrink-0 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold leading-none ${style.badge}`}>
                {pillLabel}
              </span>
            ) : null}
          </div>
        </div>
        {checkbox ? <div className="shrink-0">{checkbox}</div> : null}
      </div>
      {details ? (
        <p className={`text-xs ${DASHBOARD_TABLE_CELL_BODY_CLS} mb-1 leading-relaxed line-clamp-3 break-words`}>
          {details}
        </p>
      ) : null}
      {catalyst ? (
        <p className={`text-xs italic ${DASHBOARD_TABLE_CELL_BODY_CLS} opacity-75 mb-1`}>{catalyst}</p>
      ) : null}
      {assets ? (
        <p className="text-[10px] font-mono font-semibold text-slate-500 dark:text-zinc-400 mb-2" dir="ltr">
          {assets}
        </p>
      ) : null}
      {(pxUrl || saveActions) ? (
        <div className="flex items-center gap-1.5 mt-auto pt-2 flex-wrap">
          {pxUrl ? <ResearchDropdown pxUrl={pxUrl} /> : null}
          {saveActions ? <div className="mr-auto">{saveActions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function MacroStyleOpportunityCard(props) {
  return <MacroStyleInsightCardShell researchTone="emerald" {...props} />;
}

export function MacroStyleRiskCard(props) {
  return <MacroStyleInsightCardShell researchTone="red" {...props} />;
}
