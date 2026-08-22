import { Pencil } from 'lucide-react';
import { formatWeeklyPeriodLabel } from '@/lib/aaiiWeeklySentiment';

export const AAII_SENTIMENT_SURVEY_URL = 'https://www.aaii.com/sentimentsurvey';

const TOTAL_TOLERANCE = 0.5;

const STATUS_LABELS = Object.freeze({
  idle: 'ממתין להזנת נתון שבועי',
  loading: 'טוען נתון שבועי…',
  ready: 'הנתון התקבל',
  stale: 'הנתון אינו עדכני',
  unavailable: 'הנתון השבועי אינו זמין',
});

const ROWS = Object.freeze([
  { key: 'bullish', label: 'שוריים', colorCls: 'text-green-600 dark:text-green-400' },
  { key: 'neutral', label: 'ניטרליים', colorCls: 'text-amber-600 dark:text-amber-400' },
  { key: 'bearish', label: 'דוביים', colorCls: 'text-red-600 dark:text-red-400' },
]);

const NEUTRAL_VALUE_CLS = 'text-slate-400 dark:text-zinc-500';

export function normalizeAAIIPercent(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function formatUpdatedAt(updatedAt) {
  if (typeof updatedAt !== 'string' || !updatedAt.trim()) return null;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return updatedAt;
  }
}

export function AAIIWeeklySentimentCard({
  bullish = null,
  neutral = null,
  bearish = null,
  weekStart = null,
  weekEnd = null,
  updatedAt = null,
  status = 'idle',
  sourceUrl = AAII_SENTIMENT_SURVEY_URL,
  onEdit = null,
}) {
  const normalized = {
    bullish: normalizeAAIIPercent(bullish),
    neutral: normalizeAAIIPercent(neutral),
    bearish: normalizeAAIIPercent(bearish),
  };
  const hasAllThree = normalized.bullish != null && normalized.neutral != null && normalized.bearish != null;
  const total = hasAllThree ? normalized.bullish + normalized.neutral + normalized.bearish : null;
  const totalValid = hasAllThree && Math.abs(total - 100) <= TOTAL_TOLERANCE;
  const hasValidData = hasAllThree && totalValid;

  const safeStatus = Object.hasOwn(STATUS_LABELS, status) ? status : 'idle';
  const effectiveStatus = (safeStatus === 'ready' || safeStatus === 'stale') && !hasValidData
    ? 'unavailable'
    : safeStatus;

  const periodLabel = hasValidData && weekStart && weekEnd
    ? formatWeeklyPeriodLabel(weekStart, weekEnd)
    : null;
  const updatedLabel = hasValidData ? formatUpdatedAt(updatedAt) : null;

  return (
    <div
      className="h-full w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm transition-colors dark:border-zinc-700 dark:bg-zinc-900"
      dir="rtl"
      data-aaii-weekly-sentiment-card
      data-status={effectiveStatus}
      data-total-valid={hasValidData ? 'true' : undefined}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-bold text-slate-900 dark:text-zinc-100">
          סנטימנט שבועי AAII
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="פתיחת סקר הסנטימנט השבועי של AAII"
            title="פתיחת סקר הסנטימנט השבועי של AAII"
            className="rounded-sm text-[11px] font-semibold text-slate-500 hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900"
          >
            AAII ↗
          </a>
          <button
            type="button"
            onClick={onEdit}
            aria-label="עריכת נתוני הסנטימנט השבועי של AAII"
            title="עריכת נתוני הסנטימנט השבועי של AAII"
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900"
            data-aaii-edit-button
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      </div>

      <span className="mt-0.5 block truncate text-xs font-medium text-slate-600 dark:text-zinc-300" data-aaii-status>
        {STATUS_LABELS[effectiveStatus]}
      </span>

      <span className="mt-2 grid grid-cols-3 gap-1.5" data-aaii-rows>
        {ROWS.map((row) => (
          <span key={row.key} className="text-center" data-aaii-row={row.key}>
            <span className="block text-[10px] text-slate-500 dark:text-zinc-400">{row.label}</span>
            <span className={`block text-xs font-bold tabular-nums ${hasValidData ? row.colorCls : NEUTRAL_VALUE_CLS}`}>
              {hasValidData ? `${normalized[row.key].toFixed(1)}%` : '—'}
            </span>
          </span>
        ))}
      </span>

      {periodLabel && (
        <span className="mt-2 block text-[10px] text-slate-400 dark:text-zinc-500" data-aaii-period>
          {periodLabel}
        </span>
      )}
      {updatedLabel && (
        <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-zinc-500" data-aaii-updated-at>
          עודכן לאחרונה: {updatedLabel}
        </span>
      )}
    </div>
  );
}
