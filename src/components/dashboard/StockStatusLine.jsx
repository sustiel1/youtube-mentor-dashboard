/**
 * Visual stock/status row — presentation only (RTL).
 * Layout: [dot] [ticker] [arrow] [status] — checkbox lives in UniversalTabSelectRow.
 */
export function StockStatusLine({ visual }) {
  if (!visual?.ticker) return null;

  const { ticker, arrow, label, movePct, tone, rowClass, dot, emphasis } = visual;
  const colorCls = rowClass || visual.textClass || '';
  const weightCls = emphasis ? 'font-extrabold' : 'font-bold';
  const ariaLabel = [ticker, movePct, label].filter(Boolean).join(', ');

  return (
    <span
      dir="rtl"
      className={`inline-flex w-full items-center justify-start gap-2 text-sm leading-relaxed ${colorCls}`}
      data-stock-status-line
      data-stock-tone={tone}
      data-stock-emphasis={emphasis ? 'true' : undefined}
      aria-label={ariaLabel}
    >
      {dot ? (
        <span className="shrink-0 text-[11px] leading-none select-none" aria-hidden>
          {dot}
        </span>
      ) : null}
      <span className={`shrink-0 text-[15px] tracking-wide ${weightCls} ${colorCls}`}>
        {ticker}
      </span>
      {arrow ? (
        <span
          className={`shrink-0 text-[17px] ${weightCls} leading-none tabular-nums ${colorCls}`}
          aria-hidden
        >
          {arrow}
        </span>
      ) : null}
      {movePct ? (
        <span className={`shrink-0 text-[15px] ${weightCls} tabular-nums ${colorCls}`}>
          {movePct}
        </span>
      ) : null}
      {label ? (
        <span className={`font-semibold ${colorCls}`}>{label}</span>
      ) : null}
    </span>
  );
}
