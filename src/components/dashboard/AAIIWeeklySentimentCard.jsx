import { useEffect, useId, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Info, Pencil } from 'lucide-react';
import {
  AAII_FRESHNESS_STATES,
  AAII_SPREAD_NOT_FORECAST_TEXT,
  formatAaiiSpread,
  formatDisplayDate,
  formatWeeklyPeriodLabel,
  getAaiiSpreadInterpretation,
  resolveAaiiDisplaySpread,
  resolveAaiiFreshness,
  toLocalDateOnly,
} from '@/lib/aaiiWeeklySentiment';

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
const INTERPRETATION_TONE_CLS = Object.freeze({
  bullish: 'text-emerald-700 dark:text-emerald-400',
  bearish: 'text-red-700 dark:text-red-400',
  neutral: 'text-slate-600 dark:text-zinc-300',
});

const FRESHNESS_BORDER_CLS = Object.freeze({
  [AAII_FRESHNESS_STATES.CURRENT]: 'border-emerald-400 dark:border-emerald-600',
  [AAII_FRESHNESS_STATES.EXPECTED_TODAY]: 'border-amber-400 dark:border-amber-500',
  [AAII_FRESHNESS_STATES.UPDATE_DUE]: 'border-red-400 dark:border-red-600',
  [AAII_FRESHNESS_STATES.UNCERTAIN]: 'border-amber-400 dark:border-amber-500',
});

const FRESHNESS_TEXT_CLS = Object.freeze({
  [AAII_FRESHNESS_STATES.CURRENT]: 'text-emerald-700 dark:text-emerald-400',
  [AAII_FRESHNESS_STATES.EXPECTED_TODAY]: 'text-amber-700 dark:text-amber-300',
  [AAII_FRESHNESS_STATES.UPDATE_DUE]: 'text-red-700 dark:text-red-400',
  [AAII_FRESHNESS_STATES.UNCERTAIN]: 'text-amber-700 dark:text-amber-300',
});

const COMPACT_INTERPRETATION_TEXT = Object.freeze({
  'שורי קל': 'מעט יותר משקיעים צופים עליות',
  'שורי מתון': 'יותר משקיעים צופים עליות',
  'שורי חזק': 'הרבה יותר משקיעים צופים עליות',
  ניטרלי: 'הציפיות לעליות ולירידות מאוזנות',
  'דובי קל': 'מעט יותר משקיעים צופים ירידות',
  'דובי מתון': 'יותר משקיעים צופים ירידות',
  'דובי חזק': 'הרבה יותר משקיעים צופים ירידות',
});

export function normalizeAAIIPercent(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function getUpdatedAtParts(updatedAt) {
  if (typeof updatedAt !== 'string' || !updatedAt.trim()) return null;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return { day, month, year, time: `${hours}:${minutes}` };
}

function formatShortDateOnly(dateOnly) {
  const date = toLocalDateOnly(dateOnly);
  if (!date) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

export function formatCompactAaiiFreshnessLine(freshness) {
  if (!freshness) return null;
  const validUntil = formatShortDateOnly(freshness.validUntil);
  const nextExpected = formatShortDateOnly(freshness.nextExpectedDate);
  if (freshness.state === AAII_FRESHNESS_STATES.CURRENT && validUntil && nextExpected) {
    return `נתוני השבוע · בתוקף עד ${validUntil} · עדכון הבא ${nextExpected}`;
  }
  if (freshness.state === AAII_FRESHNESS_STATES.EXPECTED_TODAY) {
    return 'עדכון AAII צפוי היום';
  }
  if (freshness.state === AAII_FRESHNESS_STATES.UPDATE_DUE) {
    return 'נדרש עדכון · נתונים חדשים צפויים מ־AAII';
  }
  return 'לא ניתן לקבוע אם הנתונים מעודכנים';
}

export function millisecondsUntilNextLocalDay(now = new Date()) {
  if (!now || typeof now.getTime !== 'function' || Number.isNaN(now.getTime())) return null;
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1, nextDay.getTime() - now.getTime());
}

function useAaiiFreshnessClock(nowOverride) {
  const [clockNow, setClockNow] = useState(() => new Date());

  useEffect(() => {
    if (nowOverride != null) return undefined;
    let timerId;
    const scheduleNextDay = () => {
      const now = new Date();
      const delay = millisecondsUntilNextLocalDay(now);
      timerId = window.setTimeout(() => {
        setClockNow(new Date());
        scheduleNextDay();
      }, delay || 60_000);
    };
    scheduleNextDay();
    return () => window.clearTimeout(timerId);
  }, [nowOverride]);

  return nowOverride ?? clockNow;
}

function formatFullUpdatedAt(updatedAt) {
  const updated = getUpdatedAtParts(updatedAt);
  return updated
    ? `${updated.day}/${updated.month}/${updated.year}, ${updated.time}`
    : null;
}

export function getCompactAaiiExplanation(interpretation) {
  return interpretation ? COMPACT_INTERPRETATION_TEXT[interpretation.label] || null : null;
}

function formatHistoricalAverage(value) {
  const normalized = normalizeAAIIPercent(value);
  return normalized == null ? 'לא זמין' : `${normalized.toFixed(1)}%`;
}

function AAIIHelpTooltip({
  bullishAverage,
  neutralAverage,
  bearishAverage,
  spread,
  fullPeriodLabel,
  fullUpdatedLabel,
  freshness,
}) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const triggerRef = useRef(null);
  const absoluteSpread = Math.abs(spread || 0).toFixed(1);
  const marketDirection = spread < 0 ? 'ירד' : spread > 0 ? 'יעלה' : 'ינוע';
  const accessibleClarification = spread == null
    ? AAII_SPREAD_NOT_FORECAST_TEXT
    : `זהו מדד לסנטימנט המשקיעים, ולא תחזית לכך שהשוק ${marketDirection} ב־${absoluteSpread}%.`;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(false);
      triggerRef.current?.focus?.();
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [open]);

  return (
    <TooltipPrimitive.Provider delayDuration={180} skipDelayDuration={80}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            aria-label="מידע והסבר על נתוני הסנטימנט השבועי של AAII"
            aria-describedby={descriptionId}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:text-zinc-500 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900"
            onFocus={() => setOpen(true)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(true);
            }}
            data-aaii-help-trigger
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipPrimitive.Trigger>
        <span id={descriptionId} className="sr-only">{accessibleClarification}</span>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            dir="rtl"
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            sticky="always"
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.nativeEvent?.stopImmediatePropagation?.();
              setOpen(false);
              triggerRef.current?.focus?.();
            }}
            className="z-[100] max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-right text-xs font-normal leading-relaxed text-slate-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            data-aaii-help-tooltip
          >
            <p className="font-bold text-slate-900 dark:text-zinc-100">כיצד לקרוא את הנתונים?</p>
            <div className="mt-1.5 space-y-0.5" data-aaii-full-dates>
              <p>תקופת הנתונים השמורה: {fullPeriodLabel || 'לא זמין'}</p>
              <p>עודכן באפליקציה: {fullUpdatedLabel || 'לא זמין'}</p>
            </div>
            <p className="mt-2 font-bold text-slate-900 dark:text-zinc-100">כיצד נקבע מועד העדכון?</p>
            <p className="mt-0.5">נתוני AAII נאספים מדי שבוע מיום חמישי ועד יום רביעי. תוצאות השבוע הבא צפויות בדרך כלל ביום חמישי.</p>
            <div className="mt-1 space-y-0.5 tabular-nums" data-aaii-update-schedule>
              <p>מועד סיום הנתונים: {freshness?.validUntil ? formatDisplayDate(freshness.validUntil) : 'לא זמין'}</p>
              <p>העדכון הבא צפוי: {freshness?.nextExpectedDate ? formatDisplayDate(freshness.nextExpectedDate) : 'לא זמין'}</p>
            </div>
            <div className="mt-1.5 space-y-0.5 tabular-nums" data-aaii-historical-averages>
              <p>ממוצע היסטורי – שוריים: {formatHistoricalAverage(bullishAverage)}</p>
              <p>ממוצע היסטורי – ניטרליים: {formatHistoricalAverage(neutralAverage)}</p>
              <p>ממוצע היסטורי – דוביים: {formatHistoricalAverage(bearishAverage)}</p>
            </div>
            <p className="mt-2">מרווח שוריים–דוביים מחושב כך: אחוז השוריים פחות אחוז הדוביים, והוא נמדד בנקודות אחוז.</p>
            <p className="mt-1">מרווח חיובי מצביע על יותר משקיעים שוריים; מרווח שלילי מצביע על יותר משקיעים דוביים; מרווח הקרוב לאפס מצביע על איזון יחסי.</p>
            <p className="mt-1 font-medium">{AAII_SPREAD_NOT_FORECAST_TEXT}</p>
            <TooltipPrimitive.Arrow className="fill-white dark:fill-zinc-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export function AAIIWeeklySentimentCard({
  bullish = null,
  neutral = null,
  bearish = null,
  bullishAverage = null,
  neutralAverage = null,
  bearishAverage = null,
  bullBearSpread = null,
  weekStart = null,
  weekEnd = null,
  updatedAt = null,
  status = 'idle',
  sourceUrl = AAII_SENTIMENT_SURVEY_URL,
  onEdit = null,
  now = null,
}) {
  const freshnessNow = useAaiiFreshnessClock(now);
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
  const updatedLabel = formatFullUpdatedAt(updatedAt);
  const shouldShowFreshness = hasValidData && (safeStatus === 'ready' || safeStatus === 'stale');
  const freshness = shouldShowFreshness
    ? resolveAaiiFreshness(weekEnd, { now: freshnessNow })
    : null;
  const compactMetaLabel = formatCompactAaiiFreshnessLine(freshness);
  const resolvedSpread = hasValidData
    ? resolveAaiiDisplaySpread({
      bullish: normalized.bullish,
      bearish: normalized.bearish,
      bullBearSpread,
    })
    : null;
  const interpretation = getAaiiSpreadInterpretation(resolvedSpread);
  const formattedSpread = formatAaiiSpread(resolvedSpread);
  const interpretationToneCls = interpretation
    ? INTERPRETATION_TONE_CLS[interpretation.tone]
    : NEUTRAL_VALUE_CLS;
  const compactExplanation = getCompactAaiiExplanation(interpretation);
  const borderCls = freshness
    ? FRESHNESS_BORDER_CLS[freshness.state]
    : 'border-slate-200 dark:border-zinc-700';
  const statusTextCls = freshness
    ? FRESHNESS_TEXT_CLS[freshness.state]
    : 'text-slate-600 dark:text-zinc-300';
  const displayedStatusLabel = freshness?.statusLabel || STATUS_LABELS[effectiveStatus];
  const freshnessAriaLabel = freshness
    ? `${freshness.statusLabel}. מועד סיום הנתונים: ${freshness.validUntil ? formatDisplayDate(freshness.validUntil) : 'לא זמין'}. העדכון הבא צפוי: ${freshness.nextExpectedDate ? formatDisplayDate(freshness.nextExpectedDate) : 'לא זמין'}. עודכן באפליקציה: ${updatedLabel || 'לא זמין'}.`
    : null;

  return (
    <div
      className={`h-full w-full min-w-0 rounded-xl border bg-white px-3 py-2.5 text-right shadow-sm transition-colors dark:bg-zinc-900 ${borderCls}`}
      dir="rtl"
      data-aaii-weekly-sentiment-card
      data-status={effectiveStatus}
      data-total-valid={hasValidData ? 'true' : undefined}
      data-aaii-freshness={freshness?.state}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-bold text-slate-900 dark:text-zinc-100">
          סנטימנט שבועי AAII
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <AAIIHelpTooltip
            bullishAverage={bullishAverage}
            neutralAverage={neutralAverage}
            bearishAverage={bearishAverage}
            spread={resolvedSpread}
            fullPeriodLabel={periodLabel}
            fullUpdatedLabel={updatedLabel}
            freshness={freshness}
          />
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

      <span className={`mt-0.5 block truncate text-[11px] font-semibold ${statusTextCls}`} data-aaii-status data-aaii-freshness-status>
        {displayedStatusLabel}
      </span>

      {compactMetaLabel && freshness && (
        <span
          className="mt-0.5 block min-w-0 text-[10px] font-medium leading-4 tabular-nums text-slate-600 dark:text-zinc-300"
          aria-label={freshnessAriaLabel}
          data-aaii-compact-meta
        >
          {compactMetaLabel}
        </span>
      )}

      <span className="mt-2 grid grid-cols-3 gap-1.5" data-aaii-rows>
        {ROWS.map((row) => (
          <span key={row.key} className="text-center" data-aaii-row={row.key}>
            <span className="block text-[10px] text-slate-600 dark:text-zinc-300">{row.label}</span>
            <span className={`block text-xs font-bold tabular-nums ${hasValidData ? row.colorCls : NEUTRAL_VALUE_CLS}`}>
              {hasValidData ? `${normalized[row.key].toFixed(1)}%` : '—'}
            </span>
          </span>
        ))}
      </span>

      {interpretation && formattedSpread && compactExplanation && (
        <div
          className="mt-2 min-w-0 border-t border-slate-100 pt-1.5 text-[11px] leading-snug dark:border-zinc-800"
          data-aaii-interpretation
          data-aaii-tone={interpretation.tone}
          data-aaii-intensity={interpretation.intensity}
        >
          <p className={`truncate font-semibold ${interpretationToneCls}`} data-aaii-compact-summary>
            מרווח <bdi dir="ltr" className="tabular-nums">{formattedSpread}</bdi> · {interpretation.label}
          </p>
          <p className="truncate text-slate-600 dark:text-zinc-300" data-aaii-compact-explanation>
            {compactExplanation}
          </p>
        </div>
      )}
    </div>
  );
}
