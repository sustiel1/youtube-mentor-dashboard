import { HE_CARD_COMPANY_ALIASES } from '@/utils/finvizLinks';
import { AnalysisTickerLink } from '@/components/shared/AnalysisTickerLink';
import { isSafeAnalysisTicker } from '@/utils/analysisTickerLinks';

// Macro/economic abbreviations + currency codes that must not be mistaken for stock tickers.
const _DENYLIST = new Set([
  'CPI', 'PCE', 'GDP', 'NFP', 'FOMC', 'FED', 'ETF', 'ETFS', 'AI', 'EPS',
  'YOY', 'QOQ', 'MOM', 'IPO', 'CEO', 'CFO', 'CTO', 'COO',
  'YTD', 'ROI', 'ROE', 'ROA', 'DCF', 'PE', 'PB',
  'US', 'EU', 'UK', 'EM', 'FX', 'DJ', 'VC', 'TA',
  'USD', 'ILS',
]);

// Module-level lookup and regex — built once per module load.
const _HE_LOOKUP = new Map(HE_CARD_COMPANY_ALIASES);
const _RENDER_RE = new RegExp(
  '(' + HE_CARD_COMPANY_ALIASES.map(([n]) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')' +
  '|\\b([A-Z]{2,6})\\b',
  'g'
);

/**
 * Renders market text with inline Finviz links for known tickers and Hebrew company aliases.
 * Hebrew alias → displays as English ticker link (e.g. מטה → META).
 * English [A-Z]{2,6} word → linked, unless in _DENYLIST.
 * All other text is preserved exactly as-is.
 * Returns the original string unchanged when no matches are found.
 */
function contextualTextNode(text, key, contextualLink) {
  if (!contextualLink || !String(text || '').trim()) return text;
  return (
    <a
      key={key}
      href={contextualLink.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={contextualLink.ariaLabel}
      title={contextualLink.ariaLabel}
      onClick={(event) => event.stopPropagation()}
      className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      data-contextual-sector-link={contextualLink.ticker}
    >
      {text}
    </a>
  );
}

export function renderLinkedMarketText(text, { contextualLink = null } = {}) {
  if (!text) return text;
  const nodes = [];
  let last = 0;
  _RENDER_RE.lastIndex = 0;
  let m;
  while ((m = _RENDER_RE.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(contextualTextNode(text.slice(last, m.index), `context-${last}`, contextualLink));
    }
    if (m[1]) {
      const ticker = _HE_LOOKUP.get(m[1]);
      nodes.push(ticker && isSafeAnalysisTicker(ticker)
        ? <AnalysisTickerLink key={`he-${m.index}`} ticker={ticker}>{ticker}</AnalysisTickerLink>
        : contextualTextNode(m[1], `context-he-${m.index}`, contextualLink)
      );
    } else if (m[2]) {
      if (_DENYLIST.has(m[2]) || !isSafeAnalysisTicker(m[2])) {
        nodes.push(contextualTextNode(m[2], `context-en-${m.index}`, contextualLink));
      } else {
        nodes.push(
          <AnalysisTickerLink key={`en-${m.index}`} ticker={m[2]}>{m[2]}</AnalysisTickerLink>
        );
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    nodes.push(contextualTextNode(text.slice(last), `context-${last}`, contextualLink));
  }
  if (nodes.length === 0 && contextualLink) {
    return contextualTextNode(text, 'context-all', contextualLink);
  }
  if (nodes.every((n) => typeof n === 'string')) return text;
  return nodes;
}
