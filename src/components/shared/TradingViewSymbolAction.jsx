import { getTradingViewPublicDestination } from '@/lib/tradingViewDestinations';

export function TradingViewSymbolAction({
  asset,
  exchange,
  sourceContext,
  className = '',
}) {
  const destination = getTradingViewPublicDestination(asset, { exchange, sourceContext });
  if (!destination) return null;

  return (
    <a
      href={destination.url}
      target="_blank"
      rel="noopener noreferrer"
      title={destination.tooltipHe}
      aria-label={destination.ariaLabelHe}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === ' ') {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
      className={`inline-flex shrink-0 items-center rounded-md border border-blue-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-zinc-800 ${className}`.trim()}
      data-tradingview-action
      data-tradingview-symbol={destination.tradingViewSymbol}
    >
      📈 TV
    </a>
  );
}

