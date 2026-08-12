import { useState } from 'react';
import { ChevronDown, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SUMMARY_CARD_CLASS } from '@/lib/summaryCardStyles';
import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  SectionHeaderTitle,
} from '@/components/dashboard/MorningBriefVisualPrimitives';
import { renderLinkedMarketText } from '@/components/shared/LinkedMarketText';
import { buildPersistedYouTubeTimestampUrl } from '@/utils/analysisTickerLinks';

export const ANALYSIS_SECTION_CARD_CLASS = SUMMARY_CARD_CLASS;
export const ANALYSIS_BODY_TEXT_CLASS = DASHBOARD_TABLE_CELL_BODY_CLS;
export const ANALYSIS_METADATA_TEXT_CLASS = DASHBOARD_TABLE_CELL_MUTED_CLS;

export function AnalysisSectionCard({
  title,
  icon,
  count,
  metadata,
  checkbox,
  children,
  defaultExpanded = true,
  className,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <section
      aria-label={title}
      className={cn(ANALYSIS_SECTION_CARD_CLASS, 'bg-white dark:bg-zinc-900', className)}
      data-analysis-presentation="section"
    >
      <div className="mb-3 flex items-start gap-3 border-b border-slate-200/80 pb-3 dark:border-zinc-700/70">
        {checkbox}
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'כווץ' : 'הרחב'} את ${title}`}
          className="min-w-0 flex-1 rounded-lg text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span className="flex items-center justify-between gap-3">
            <SectionHeaderTitle title={`${icon ? `${icon} ` : ''}${title}`} count={count} />
            <ChevronDown aria-hidden="true" className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')} />
          </span>
          {metadata && <span className={cn('mt-1 block', ANALYSIS_METADATA_TEXT_CLASS)}>{metadata}</span>}
        </button>
      </div>
      {expanded && <div data-analysis-section-content>{children}</div>}
    </section>
  );
}

export function AnalysisList({ entries = [] }) {
  if (entries.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-right" dir="rtl">
      {entries.map((entry, index) => {
        const text = typeof entry === 'string' ? entry : entry.text;
        const rank = typeof entry === 'object' ? entry.rank : null;
        return (
          <li key={`${text}-${index}`} className="flex items-start justify-end gap-2 rounded-lg px-2 py-2 hover:bg-slate-50/80 dark:hover:bg-zinc-800/60">
            <span className={cn('min-w-0 flex-1 whitespace-pre-wrap break-words text-right', ANALYSIS_BODY_TEXT_CLASS)}>
              {renderLinkedMarketText(text)}
            </span>
            <span aria-hidden="true" className={cn('shrink-0 text-indigo-500', rank != null ? 'min-w-7 font-mono text-xs font-bold' : 'pt-1')}>
              {rank != null ? `#${rank}` : '•'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AnalysisFieldGrid({ fields = [] }) {
  if (fields.length === 0) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map(field => (
        <div key={`${field.label}|${field.value}`} className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 dark:border-zinc-700/70 dark:bg-zinc-900">
          <dt className="text-base font-bold text-slate-800 dark:text-zinc-100">{field.label}</dt>
          <dd className={cn('mt-1 whitespace-pre-wrap', ANALYSIS_BODY_TEXT_CLASS)}>{renderLinkedMarketText(field.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AnalysisTimestampLink({ videoUrl, timestamp }) {
  const href = buildPersistedYouTubeTimestampUrl(videoUrl, timestamp);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
      aria-label={`פתח את סרטון המקור בזמן ${Math.floor(Number(timestamp))} שניות`}
    >
      <Clock3 aria-hidden="true" className="h-4 w-4" />
      פתח במקור
    </a>
  );
}
