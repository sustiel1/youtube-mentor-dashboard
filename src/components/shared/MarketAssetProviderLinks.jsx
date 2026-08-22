import {
  filterMarketAssetProviderLinks,
  resolveMarketAssetProviderLinks,
} from '@/lib/marketAssetProviderLinks';

const PROVIDER_LINK_CLASS = 'inline-flex min-h-7 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold leading-none text-indigo-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:border-indigo-700 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:border-violet-600 dark:hover:bg-violet-950/30 dark:hover:text-violet-200 dark:focus-visible:ring-offset-zinc-900';
const FUTURES_LINK_CLASS = 'inline-flex min-h-7 min-w-12 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold leading-none text-amber-800 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:border-amber-700 dark:hover:bg-amber-950/50 dark:focus-visible:ring-offset-zinc-900';

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3H3.75A1.75 1.75 0 0 0 2 4.75v7.5C2 13.22 2.78 14 3.75 14h7.5A1.75 1.75 0 0 0 13 12.25V10" />
      <path d="M9 2h5v5M14 2 7.5 8.5" />
    </svg>
  );
}

function getAssetDisplayValue(asset) {
  if (!asset || typeof asset !== 'object') return asset;
  return asset.symbol ?? asset.ticker ?? asset.asset ?? asset.name ?? asset.label ?? '—';
}

export function MarketAssetPreferredLink({
  asset,
  className = '',
  children,
  descriptionId,
  focusableWhenUnlinked = false,
  showQualifier = true,
}) {
  const resolution = resolveMarketAssetProviderLinks(asset);
  const display = children ?? getAssetDisplayValue(asset) ?? '—';
  if (!resolution?.preferred) {
    return (
      <span
        className={className}
        tabIndex={focusableWhenUnlinked ? 0 : undefined}
        aria-describedby={descriptionId}
      >
        {display}
      </span>
    );
  }

  return (
    <a
      href={resolution.preferred.url}
      target="_blank"
      rel="noopener noreferrer"
      title={resolution.preferred.qualifier || 'פתיחת הנכס במקור המועדף'}
      aria-label={resolution.preferred.ariaLabel}
      aria-describedby={descriptionId}
      onClick={(event) => event.stopPropagation()}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900 ${className}`.trim()}
      data-market-asset-preferred-link={resolution.preferred.provider}
      dir="ltr"
    >
      <span>{display}</span>
      {showQualifier && resolution.qualifier ? (
        <span className="rounded border border-indigo-200 px-1 py-0.5 text-[9px] font-semibold leading-none text-indigo-600 dark:border-indigo-700 dark:text-indigo-300">
          {resolution.qualifier}
        </span>
      ) : null}
      <ExternalLinkIcon />
    </a>
  );
}

export function MarketAssetFuturesLink({ asset }) {
  const futures = resolveMarketAssetProviderLinks(asset)?.futures;
  if (!futures) {
    return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  }

  return (
    <a
      href={futures.url}
      target="_blank"
      rel="noopener noreferrer"
      title={futures.tooltip}
      aria-label={futures.ariaLabel}
      onClick={(event) => event.stopPropagation()}
      className={FUTURES_LINK_CLASS}
      data-market-asset-futures-link={futures.symbol}
      dir="ltr"
    >
      <span>{futures.symbol}</span>
      <ExternalLinkIcon />
    </a>
  );
}

export function MarketAssetProviderLinks({ asset, hiddenProviders = [] }) {
  const resolution = resolveMarketAssetProviderLinks(asset);
  const visibleLinks = filterMarketAssetProviderLinks(resolution?.links, hiddenProviders);
  if (!visibleLinks.length) {
    return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  }

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5" dir="ltr" data-market-asset-provider-links>
      {visibleLinks.map((link) => (
        <a
          key={link.provider}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title={link.tooltip}
          aria-label={link.ariaLabel}
          onClick={(event) => event.stopPropagation()}
          className={PROVIDER_LINK_CLASS}
          data-market-provider={link.provider}
        >
          <span>{link.label}</span>
          {link.qualifier ? <span className="text-[9px] opacity-80">· {link.qualifier}</span> : null}
          <ExternalLinkIcon />
        </a>
      ))}
    </div>
  );
}
