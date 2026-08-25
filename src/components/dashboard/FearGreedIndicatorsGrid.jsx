import { useEffect, useId, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { ChevronDown, Info } from 'lucide-react';
import { CNN_FEAR_GREED_URL } from '@/lib/sentimentSourceLinks';
import {
  FEAR_GREED_INDICATOR_IDS,
  FEAR_GREED_INDICATOR_LABELS_HE,
  FEAR_GREED_INDICATOR_TOOLTIPS_HE,
  FEAR_GREED_RATING_STYLES,
  formatFearGreedUpdatedAt,
} from '@/lib/fearGreed';

// CNN's per-indicator chart sections use a UUID generated fresh on every
// page load (verified 2026-08-25: the same section's DOM id changed between
// two consecutive loads), so there is no stable, linkable anchor for any of
// the 7 indicators — only the general Fear & Greed page is a verified,
// durable destination. Do not replace this with a per-indicator "#anchor"
// without re-verifying it is stable across repeated loads.
const FEAR_GREED_GENERAL_PAGE_LABEL = 'פתח את עמוד המדד ב־CNN';

// Same open/escape/focus-return pattern as AAIIHelpTooltip in
// AAIIWeeklySentimentCard.jsx — the project's existing tooltip convention,
// just with one trigger per indicator instead of a single help icon.
//
// The trigger is a <span role="button"> rather than a native <button>: it
// sits inside the row's own role="button" toggle (see IndicatorRow below),
// and a <button> nested inside another <button>-like control is invalid
// HTML content-model-wise. A span with role="button"/tabIndex is valid
// there and gets identical keyboard behavior via the onKeyDown handler.
function IndicatorInfoTooltip({ label, stateLabel, explanation }) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const triggerRef = useRef(null);

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

  const toggleOpen = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen((value) => !value);
  };

  return (
    <TooltipPrimitive.Provider delayDuration={180} skipDelayDuration={80}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild>
          <span
            ref={triggerRef}
            role="button"
            tabIndex={0}
            aria-label={`מידע על ${label}${stateLabel ? ` — מצב נוכחי: ${stateLabel}` : ''}`}
            aria-describedby={descriptionId}
            className="inline-flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:text-zinc-500 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900"
            onFocus={() => setOpen(true)}
            onClick={toggleOpen}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              toggleOpen(event);
            }}
            data-fear-greed-indicator-info
          >
            <Info className="h-3 w-3" aria-hidden="true" />
          </span>
        </TooltipPrimitive.Trigger>
        <span id={descriptionId} className="sr-only">{explanation}</span>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            dir="rtl"
            side="top"
            align="center"
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
            className="z-[100] max-w-[min(16rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-[11px] font-normal leading-relaxed text-slate-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            data-fear-greed-indicator-tooltip
          >
            <p className="font-bold text-slate-900 dark:text-zinc-100">{label}</p>
            {stateLabel && (
              <p className="mt-0.5 font-semibold text-slate-600 dark:text-zinc-300">מצב נוכחי: {stateLabel}</p>
            )}
            <p className="mt-1">{explanation}</p>
            <TooltipPrimitive.Arrow className="fill-white dark:fill-zinc-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

function IndicatorRow({ id, label, entry, isExpanded, onToggle }) {
  const panelId = useId();
  const style = entry ? FEAR_GREED_RATING_STYLES[entry.ratingKey] : null;
  const stateLabel = style?.labelHe || null;
  const formattedUpdatedAt = entry ? formatFearGreedUpdatedAt(entry.updatedAt) : null;

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onToggle(id);
  };

  return (
    <div
      className={isExpanded ? 'col-span-2 min-w-0' : 'min-w-0'}
      data-fear-greed-indicator={id}
      data-fear-greed-indicator-state={entry?.ratingKey || undefined}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
        onKeyDown={handleKeyDown}
        className="flex min-w-0 cursor-pointer items-center gap-1 rounded px-0.5 py-0.5 -mx-0.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 dark:hover:bg-zinc-800"
        data-fear-greed-indicator-toggle
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${style ? style.dotCls : 'bg-slate-300 dark:bg-zinc-600'}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700 dark:text-zinc-300" title={label}>
          {label}
        </span>
        <span className={`shrink-0 text-[10px] font-bold ${style ? style.textCls : 'text-slate-400 dark:text-zinc-500'}`}>
          {stateLabel || '—'}
        </span>
        <IndicatorInfoTooltip
          label={label}
          stateLabel={stateLabel}
          explanation={FEAR_GREED_INDICATOR_TOOLTIPS_HE[id]}
        />
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-slate-400 transition-transform dark:text-zinc-500 ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </div>

      {isExpanded && (
        <div
          id={panelId}
          className="mt-1 min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] leading-relaxed text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
          data-fear-greed-indicator-panel
        >
          {entry ? (
            <>
              <p>ציון מנורמל (0–100): <bdi dir="ltr" className="font-semibold tabular-nums">{entry.score}</bdi></p>
              <p className="mt-0.5">מצב: <span className={`font-semibold ${style?.textCls || ''}`}>{stateLabel}</span></p>
              <p className="mt-0.5">עודכן ב-CNN: {formattedUpdatedAt || 'לא זמין'}</p>
            </>
          ) : (
            <p>אין נתונים זמינים כרגע עבור אינדיקטור זה.</p>
          )}
          <a
            href={CNN_FEAR_GREED_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
            data-fear-greed-graph-link
          >
            {FEAR_GREED_GENERAL_PAGE_LABEL} ↗
          </a>
        </div>
      )}
    </div>
  );
}

// indicators: { [id]: { score, ratingKey, updatedAt } | null } — from
// normalizeCnnFearGreedPayload. A null entry means CNN didn't provide that
// indicator this time; it renders as an explicit unavailable state, never a
// guessed value. Clicking a row expands its detail (only one open at a
// time); the expand toggle, info tooltip and graph link are independent
// controls that don't interfere with each other's clicks.
export function FearGreedIndicatorsGrid({ indicators }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!indicators) return null;

  const toggle = (id) => setExpandedId((current) => (current === id ? null : id));

  return (
    <div
      className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-1"
      dir="rtl"
      data-fear-greed-indicators
    >
      {FEAR_GREED_INDICATOR_IDS.map((id) => (
        <IndicatorRow
          key={id}
          id={id}
          label={FEAR_GREED_INDICATOR_LABELS_HE[id]}
          entry={indicators[id] || null}
          isExpanded={expandedId === id}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}
