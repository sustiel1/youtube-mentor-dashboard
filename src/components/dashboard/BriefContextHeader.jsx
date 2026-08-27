import {
  formatBriefPublishDatePlain,
  getBriefContextDisplay,
} from '@/lib/briefContextDisplay';
import { COMPARISON_SECTION_BORDER, COMPARISON_SURFACE_BG } from './MorningBriefVisualPrimitives';

const BRIEF_TITLE_CLS =
  'text-2xl sm:text-[28px] font-extrabold text-slate-900 dark:text-zinc-50 leading-tight tracking-tight';

const BRIEF_CONTEXT_CLS =
  'text-sm sm:text-base font-semibold text-slate-600 dark:text-zinc-400 leading-snug';

/**
 * Shared subject + publish-date heading for the universal content tabs.
 */
export function BriefContextHeader({ slug, subCategory, subject, publishedAt, layout = 'stacked', showSourceCaption = true, action = null }) {
  const meta = getBriefContextDisplay(slug, subCategory);
  const subjectTitle = meta?.title || String(subject || '').trim();
  if (!subjectTitle) return null;
  const datePlain = formatBriefPublishDatePlain(publishedAt);
  const title = datePlain ? `${subjectTitle} — ${datePlain}` : subjectTitle;

  if (layout === 'inline') {
    const parts = [title, showSourceCaption ? meta?.context : null].filter(Boolean);
    return (
      <div
        dir="rtl"
        className={`mb-3 rounded-xl border ${COMPARISON_SECTION_BORDER} ${COMPARISON_SURFACE_BG} px-3 py-3 text-right`}
        data-brief-context-header
        data-shared-content-heading
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <p className={`${BRIEF_TITLE_CLS} min-w-0 leading-snug`}>
            {parts.join(' | ')}
          </p>
          {action && <div data-shared-heading-action className="max-w-full shrink-0">{action}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={`mb-3 rounded-xl border ${COMPARISON_SECTION_BORDER} ${COMPARISON_SURFACE_BG} px-3 py-3 text-right`}
      data-brief-context-header
      data-shared-content-heading
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <h1 className={`${BRIEF_TITLE_CLS} min-w-0`}>{title}</h1>
        {action && <div data-shared-heading-action className="max-w-full shrink-0">{action}</div>}
      </div>
      {showSourceCaption && meta?.context && (
        <p className={`${BRIEF_CONTEXT_CLS} mt-1`}>{meta.context}</p>
      )}
    </div>
  );
}
