import { buildSafeFinvizTickerUrl, normalizeAnalysisTicker } from '@/utils/analysisTickerLinks';

export function AnalysisTickerLink({ ticker, children, className = '' }) {
  const normalized = normalizeAnalysisTicker(ticker);
  const href = buildSafeFinvizTickerUrl(normalized);
  const display = children ?? normalized ?? ticker;
  if (!href) return <span className={className}>{display}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      dir="ltr"
      aria-label={`פתח את ${normalized} ב־Finviz`}
      onClick={event => event.stopPropagation()}
      className={`font-bold text-indigo-700 underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300 ${className}`}
    >
      {display}
    </a>
  );
}
