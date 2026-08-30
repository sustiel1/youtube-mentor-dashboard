import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ExternalLink, Link2 } from 'lucide-react';

import {
  filterMarketAssetProviderLinks,
  resolveMarketAssetProviderLinks,
} from '@/lib/marketAssetProviderLinks';

/**
 * Compact per-row provider-links affordance for market tables.
 *
 * Replaces a row of 2-3 repeated pill buttons (Finviz / Investing / TradingView)
 * with a single icon trigger that opens a Radix Popover listing the same links.
 * Reuses `resolveMarketAssetProviderLinks` — no new link sources.
 *
 * Radix Popover gives real menu semantics: aria-haspopup/aria-expanded on the
 * trigger, focus management, Escape-to-close and click-outside.
 */

// Same visual language as MarketAssetProviderLinks' pill buttons.
const TRIGGER_CLASS =
  'inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold leading-none text-indigo-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 data-[state=open]:border-violet-300 data-[state=open]:bg-indigo-50 data-[state=open]:text-violet-700 dark:border-indigo-700 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:border-violet-600 dark:hover:bg-violet-950/30 dark:hover:text-violet-200 dark:data-[state=open]:border-violet-600 dark:data-[state=open]:bg-violet-950/30 dark:focus-visible:ring-offset-zinc-900';

const CONTENT_CLASS =
  'z-[80] min-w-[11rem] max-w-[min(16rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white p-1 text-right shadow-lg dark:border-zinc-700 dark:bg-zinc-900';

const LINK_CLASS =
  'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-semibold leading-none text-indigo-700 transition-colors hover:bg-indigo-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:text-indigo-300 dark:hover:bg-violet-950/30 dark:hover:text-violet-200 dark:focus-visible:ring-offset-zinc-900';

export function MarketAssetLinksMenu({ asset, hiddenProviders = [] }) {
  const resolution = resolveMarketAssetProviderLinks(asset);
  const visibleLinks = filterMarketAssetProviderLinks(resolution?.links, hiddenProviders);

  if (!visibleLinks.length) {
    return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  }

  const assetName = String(asset || '').trim() || 'הנכס';

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={TRIGGER_CLASS}
          aria-label={`קישורים חיצוניים ל־${assetName}`}
          onClick={(event) => event.stopPropagation()}
          data-market-asset-links-menu-trigger
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{visibleLinks.length}</span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          dir="rtl"
          side="bottom"
          align="center"
          sideOffset={6}
          collisionPadding={12}
          className={CONTENT_CLASS}
          onClick={(event) => event.stopPropagation()}
          data-market-asset-links-menu
        >
          <ul className="flex flex-col gap-0.5">
            {visibleLinks.map((link) => (
              <li key={link.provider}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.tooltip}
                  aria-label={link.ariaLabel}
                  onClick={(event) => event.stopPropagation()}
                  className={LINK_CLASS}
                  data-market-provider={link.provider}
                  dir="ltr"
                >
                  <span>{link.label}</span>
                  {link.qualifier ? (
                    <span className="text-[10px] font-medium opacity-70">· {link.qualifier}</span>
                  ) : null}
                  <ExternalLink className="ms-auto h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <PopoverPrimitive.Arrow className="fill-white dark:fill-zinc-900" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
