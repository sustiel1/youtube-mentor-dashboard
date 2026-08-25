import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogPortal } from '@/components/ui/dialog';
import { X, ExternalLink } from 'lucide-react';
import {
  FEAR_GREED_ZONES,
  getFearGreedHebrewRating,
  normalizeFearGreedScore,
} from './FearGreedScoreCard';
import {
  FEAR_GREED_INDICATOR_IDS,
  FEAR_GREED_INDICATOR_LABELS_HE,
  FEAR_GREED_INDICATOR_TOOLTIPS_HE,
  FEAR_GREED_RATING_STYLES,
  FEAR_GREED_ZONE_INTERPRETATION_HE,
  FEAR_GREED_OVERALL_EXPLANATION_HE,
  FEAR_GREED_DISCLAIMER_HE,
  formatFearGreedUpdatedAt,
  ratingKeyForScore,
} from '@/lib/fearGreed';
import { FEAR_GREED_RELATED_SOURCES } from '@/lib/fearGreedRelatedSources';

// Compact chip beside an indicator's own title — never a full "open the
// graph" button competing with the state badge. Provider + purpose live in
// aria-label/title (both set from the same audited phrase), matching the
// "פתח גרף VIX באתר CBOE" pattern; the visible label stays a short symbol.
function GraphChip({ source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={source.ariaLabel}
      title={source.ariaLabel}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
      data-fear-greed-fullscreen-graph-chip
      data-fear-greed-fullscreen-graph-provider={source.provider}
    >
      <bdi>{source.shortLabel}</bdi>
      <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
    </a>
  );
}

function ComparisonRow({ label, value }) {
  if (value == null) return null;
  return (
    <div className="flex min-w-[5.5rem] flex-col items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
      <span className="text-[11px] text-slate-500 dark:text-zinc-400">{label}</span>
      <bdi dir="ltr" className="text-lg font-bold tabular-nums text-slate-800 dark:text-zinc-100">{value}</bdi>
    </div>
  );
}

function OverallGauge({ score }) {
  const clampedLeft = Math.min(100, Math.max(0, score));
  return (
    <div className="w-full" dir="ltr">
      <div className="relative h-4 w-full overflow-visible rounded-full">
        <div className="flex h-full w-full overflow-hidden rounded-full">
          {FEAR_GREED_ZONES.map((zone) => (
            <div
              key={zone.label}
              className={zone.color}
              style={{ width: `${zone.max - zone.min + 1}%` }}
              title={zone.label}
            />
          ))}
        </div>
        <div
          className="absolute -top-1.5 h-7 w-0.5 -translate-x-1/2 bg-slate-900 dark:bg-white"
          style={{ left: `${clampedLeft}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-zinc-500">
        <span>0</span>
        <span>25</span>
        <span>45</span>
        <span>56</span>
        <span>76</span>
        <span>100</span>
      </div>
    </div>
  );
}

function IndicatorSection({ id, entry }) {
  const label = FEAR_GREED_INDICATOR_LABELS_HE[id];
  const style = entry ? FEAR_GREED_RATING_STYLES[entry.ratingKey] : null;
  const stateLabel = style?.labelHe || null;
  const formattedUpdatedAt = entry ? formatFearGreedUpdatedAt(entry.updatedAt) : null;
  const sources = FEAR_GREED_RELATED_SOURCES[id] || [];

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
      dir="rtl"
      data-fear-greed-fullscreen-indicator={id}
      data-fear-greed-fullscreen-indicator-state={entry?.ratingKey || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">{label}</span>
          {entry && (
            <bdi dir="ltr" className={`text-xl font-extrabold tabular-nums ${style?.textCls || ''}`}>
              {entry.score}
            </bdi>
          )}
          {sources.map((source) => (
            <GraphChip key={source.url} source={source} />
          ))}
        </div>
        {stateLabel ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${style.textCls}`}>
            {stateLabel}
          </span>
        ) : (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-slate-400 dark:text-zinc-500">
            אין נתונים
          </span>
        )}
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800" dir="ltr">
        {entry && (
          <div
            className={`h-full rounded-full ${style?.dotCls || 'bg-slate-300'}`}
            style={{ width: `${entry.score}%` }}
          />
        )}
      </div>

      <div className="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
        {entry ? (
          formattedUpdatedAt && <span>עודכן ב-CNN: {formattedUpdatedAt}</span>
        ) : (
          <span>אין נתון מספרי זמין כרגע</span>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
        <span className="font-semibold text-slate-700 dark:text-zinc-200">מה זה מודד: </span>
        {FEAR_GREED_INDICATOR_TOOLTIPS_HE[id]}
      </p>
    </div>
  );
}

// record: the same normalized shape as FearGreedScoreCardContainer's
// activeRecord — { score, updatedAt, indicators, previousClose/Week/Month/Year }.
// Read-only presentation; no fetch/state of its own.
export function FearGreedFullScreenModal({ open, onOpenChange, record, sourceUrl }) {
  const validScore = normalizeFearGreedScore(record?.score ?? null);
  const hasScore = validScore != null;
  const ratingKey = hasScore ? ratingKeyForScore(validScore) : null;
  const ratingLabel = hasScore ? getFearGreedHebrewRating(validScore) : null;
  const interpretation = ratingKey ? FEAR_GREED_ZONE_INTERPRETATION_HE[ratingKey] : null;
  const updatedAtLabel = formatFearGreedUpdatedAt(record?.updatedAt);
  const indicators = record?.indicators || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[400] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          className="fixed inset-0 z-[410] flex h-screen w-screen flex-col bg-slate-50 dark:bg-zinc-950 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          data-fear-greed-fullscreen
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
            <div>
              <DialogPrimitive.Title className="text-base font-bold text-slate-900 dark:text-zinc-100">
                מדד הפחד והתאווה — תצוגה מלאה
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                תצוגה מלאה של מדד הפחד והתאווה של CNN, כולל הציון הכללי ושבעת האינדיקטורים המרכיבים אותו
              </DialogPrimitive.Description>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block text-xs font-semibold text-slate-500 hover:text-indigo-700 hover:underline dark:text-zinc-400 dark:hover:text-indigo-300"
              >
                CNN ↗
              </a>
            </div>
            <DialogPrimitive.Close
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="סגירת תצוגה מלאה"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6" dir="rtl">
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Overall section */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900" data-fear-greed-fullscreen-overall>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">ציון כללי</p>
                    <p className="mt-0.5">
                      <bdi dir="ltr" className="text-4xl font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                        {hasScore ? validScore : '—'}
                      </bdi>
                      <span className="mr-1 text-sm text-slate-400 dark:text-zinc-500">/ 100</span>
                    </p>
                    <p className="mt-0.5 text-base font-bold text-slate-800 dark:text-zinc-100">
                      {ratingLabel || 'אין נתון זמין'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {updatedAtLabel ? `עודכן ב-CNN: ${updatedAtLabel}` : 'לא זמין'}
                  </p>
                </div>

                {hasScore && (
                  <div className="mt-4">
                    <OverallGauge score={validScore} />
                  </div>
                )}

                {(record?.previousClose != null || record?.previousWeek != null || record?.previousMonth != null || record?.previousYear != null) && (
                  <div className="mt-4 flex flex-wrap gap-2" data-fear-greed-fullscreen-comparisons>
                    <ComparisonRow label="סגירה קודמת" value={record?.previousClose} />
                    <ComparisonRow label="לפני שבוע" value={record?.previousWeek} />
                    <ComparisonRow label="לפני חודש" value={record?.previousMonth} />
                    <ComparisonRow label="לפני שנה" value={record?.previousYear} />
                  </div>
                )}

                <p className="mt-4 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                  {FEAR_GREED_OVERALL_EXPLANATION_HE}
                  {interpretation && <> {interpretation}</>}
                </p>

                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" data-fear-greed-disclaimer>
                  {FEAR_GREED_DISCLAIMER_HE}
                </p>
              </section>

              {/* 7 indicator sections */}
              <section className="space-y-3" data-fear-greed-fullscreen-indicators>
                <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-200">7 האינדיקטורים</h3>
                {indicators ? (
                  FEAR_GREED_INDICATOR_IDS.map((id) => (
                    <IndicatorSection key={id} id={id} entry={indicators[id] || null} />
                  ))
                ) : (
                  <p className="text-xs text-slate-500 dark:text-zinc-400">אין נתוני אינדיקטורים זמינים כרגע.</p>
                )}
              </section>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
