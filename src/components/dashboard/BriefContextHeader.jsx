import {
  formatBriefPublishDate,
  formatBriefPublishDatePlain,
  getBriefContextDisplay,
} from '@/lib/briefContextDisplay';
import { COMPARISON_SECTION_BORDER, COMPARISON_SURFACE_BG } from './MorningBriefVisualPrimitives';

const BRIEF_TITLE_CLS =
  'text-2xl sm:text-[28px] font-extrabold text-slate-900 dark:text-zinc-50 leading-tight tracking-tight';

const BRIEF_CONTEXT_CLS =
  'text-sm sm:text-base font-semibold text-slate-600 dark:text-zinc-400 leading-snug';

const BRIEF_DATE_CLS =
  'text-xs font-medium text-slate-500 dark:text-zinc-500 tabular-nums';

/**
 * Brief type + timing context above Specialized Content (presentation only).
 */
export function BriefContextHeader({ slug, subCategory, publishedAt, layout = 'stacked' }) {
  const meta = getBriefContextDisplay(slug, subCategory);
  if (!meta) return null;

  const datePlain = formatBriefPublishDatePlain(publishedAt);

  if (layout === 'inline') {
    const dateWithEmoji = formatBriefPublishDate(publishedAt);
    const parts = [meta.title, meta.context, dateWithEmoji].filter(Boolean);
    return (
      <div
        dir="rtl"
        className={`mb-3 rounded-xl border ${COMPARISON_SECTION_BORDER} ${COMPARISON_SURFACE_BG} px-3 py-3 text-right`}
        data-brief-context-header
      >
        <p className={`${BRIEF_TITLE_CLS} leading-snug`}>
          {parts.join(' | ')}
        </p>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={`mb-3 rounded-xl border ${COMPARISON_SECTION_BORDER} ${COMPARISON_SURFACE_BG} px-3 py-3 text-right`}
      data-brief-context-header
    >
      <h1 className={BRIEF_TITLE_CLS}>{meta.title}</h1>
      <p className={`${BRIEF_CONTEXT_CLS} mt-1`}>{meta.context}</p>
      {datePlain && (
        <p className={`${BRIEF_DATE_CLS} mt-0.5`}>{datePlain}</p>
      )}
    </div>
  );
}
