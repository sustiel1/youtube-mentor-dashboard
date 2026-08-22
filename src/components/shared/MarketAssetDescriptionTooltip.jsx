import { useEffect, useId, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';

import {
  UNKNOWN_MARKET_ASSET_DESCRIPTION,
  getMarketAssetDescription,
} from '@/lib/marketAssetDescriptions';
import { MarketAssetPreferredLink } from './MarketAssetProviderLinks';

export function MarketAssetDescriptionTooltip({
  asset,
  children,
  showInfoButton = true,
  showQualifier = true,
}) {
  const assetName = String(asset || '').trim();
  const description = getMarketAssetDescription(assetName);
  const hasDescription = Boolean(description && description !== UNKNOWN_MARKET_ASSET_DESCRIPTION);
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const lastFocusedElementRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(false);
      lastFocusedElementRef.current?.focus?.();
    };

    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [open]);

  if (!hasDescription || !showInfoButton) {
    return (
      <MarketAssetPreferredLink asset={asset} showQualifier={showQualifier}>
        {children}
      </MarketAssetPreferredLink>
    );
  }

  return (
    <TooltipPrimitive.Provider delayDuration={180} skipDelayDuration={80}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild>
          <span
            className="inline-flex items-center gap-1"
            dir="ltr"
            onFocusCapture={(event) => {
              lastFocusedElementRef.current = event.target;
              setOpen(true);
            }}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
            data-market-asset-description-trigger
          >
            <MarketAssetPreferredLink
              asset={asset}
              descriptionId={descriptionId}
              focusableWhenUnlinked
              showQualifier={showQualifier}
            >
              {children}
            </MarketAssetPreferredLink>
            <button
              type="button"
              aria-label={`מידע על ${assetName}`}
              aria-describedby={descriptionId}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:text-zinc-500 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(true);
              }}
              data-market-asset-description-info
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span id={descriptionId} className="sr-only">{description}</span>
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            dir="rtl"
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            sticky="always"
            className="z-[80] max-w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-xs font-normal leading-relaxed text-slate-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            data-market-asset-description-tooltip
          >
            {description}
            <TooltipPrimitive.Arrow className="fill-white dark:fill-zinc-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
