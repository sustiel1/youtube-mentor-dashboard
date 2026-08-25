import { useEffect, useId, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { FEAR_GREED_ZONES, getFearGreedHebrewRating } from './FearGreedScoreCard';
import {
  FEAR_GREED_RATING_STYLES,
  FEAR_GREED_ZONE_INTERPRETATION_HE,
  FEAR_GREED_DISCLAIMER_HE,
  ratingKeyForScore,
} from '@/lib/fearGreed';

// Same open/escape/focus-return pattern as IndicatorInfoTooltip in
// FearGreedIndicatorsGrid.jsx, kept as its own component (not shared)
// because this one renders the 5-zone score table instead of a single
// indicator's explanation text. Reuses FEAR_GREED_ZONES from
// FearGreedScoreCard.jsx rather than a third copy of the zone boundaries.
export function FearGreedScoreInfoTooltip({ score = null }) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const triggerRef = useRef(null);
  const hasScore = typeof score === 'number' && Number.isFinite(score);
  const ratingKey = hasScore ? ratingKeyForScore(score) : null;
  const ratingLabel = hasScore ? getFearGreedHebrewRating(score) : null;
  const interpretation = ratingKey ? FEAR_GREED_ZONE_INTERPRETATION_HE[ratingKey] : null;

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

  // Always opens (never toggles) so a real click doesn't race the browser's
  // own mousedown-triggered focus event: mousedown fires focus first (which
  // opens via onFocus below), then click fires — a toggle there would flip
  // it straight back to closed. Closing happens via Escape, outside click,
  // or blur (Radix's onOpenChange, wired to setOpen on the Root below).
  const openTooltip = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <TooltipPrimitive.Provider delayDuration={180} skipDelayDuration={80}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild>
          <span
            ref={triggerRef}
            role="button"
            tabIndex={0}
            aria-label={`מידע על מדד הפחד והתאווה${ratingLabel ? ` — מצב נוכחי: ${ratingLabel}` : ''}`}
            aria-describedby={descriptionId}
            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-indigo-300"
            onFocus={() => setOpen(true)}
            onClick={openTooltip}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              openTooltip(event);
            }}
            data-fear-greed-score-info
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </TooltipPrimitive.Trigger>
        <span id={descriptionId} className="sr-only">
          {hasScore ? `ציון ${score} מתוך 100. ${interpretation || ''}` : 'אין ציון זמין כרגע.'} {FEAR_GREED_DISCLAIMER_HE}
        </span>
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
            className="z-[100] w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-right text-[11px] font-normal leading-relaxed text-slate-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            data-fear-greed-score-tooltip
          >
            <p className="font-bold text-slate-900 dark:text-zinc-100">
              מדד פחד ותאווה{hasScore ? ` — ${score}/100` : ''}
            </p>
            {ratingLabel && (
              <p className="mt-0.5 font-semibold text-slate-600 dark:text-zinc-300">מצב נוכחי: {ratingLabel}</p>
            )}
            {interpretation && <p className="mt-1">{interpretation}</p>}
            <ul className="mt-2 space-y-0.5" data-fear-greed-score-zones>
              {FEAR_GREED_ZONES.map((zone) => {
                const zoneRatingKey = ratingKeyForScore(zone.min);
                const isCurrent = hasScore && score >= zone.min && score <= zone.max;
                const textCls = zoneRatingKey ? FEAR_GREED_RATING_STYLES[zoneRatingKey]?.textCls : '';
                return (
                  <li
                    key={zone.label}
                    className={`flex items-center justify-between gap-2 rounded px-1 py-0.5 ${isCurrent ? 'bg-slate-100 dark:bg-zinc-800' : ''}`}
                    data-fear-greed-score-zone-current={isCurrent ? 'true' : undefined}
                  >
                    <span className={`font-semibold ${textCls}`}>{zone.label}</span>
                    <bdi dir="ltr" className="tabular-nums text-slate-500 dark:text-zinc-400">{zone.min}–{zone.max}</bdi>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
              {FEAR_GREED_DISCLAIMER_HE}
            </p>
            <TooltipPrimitive.Arrow className="fill-white dark:fill-zinc-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
