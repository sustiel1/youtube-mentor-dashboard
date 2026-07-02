import { buildFinvizQuoteUrl, HE_CARD_COMPANY_ALIASES } from '@/utils/finvizLinks';

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
export function renderLinkedMarketText(text) {
  if (!text) return text;
  const nodes = [];
  let last = 0;
  _RENDER_RE.lastIndex = 0;
  let m;
  while ((m = _RENDER_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      const ticker = _HE_LOOKUP.get(m[1]);
      nodes.push(ticker
        ? <a key={`he-${m.index}`} href={buildFinvizQuoteUrl(ticker)} target="_blank"
             rel="noopener noreferrer" dir="ltr"
             title={`Open ${ticker} on Finviz`}
             className="font-semibold underline decoration-dotted hover:decoration-solid"
             onClick={(e) => e.stopPropagation()}>{ticker}</a>
        : m[1]
      );
    } else if (m[2]) {
      if (_DENYLIST.has(m[2])) {
        nodes.push(m[2]);
      } else {
        nodes.push(
          <a key={`en-${m.index}`} href={buildFinvizQuoteUrl(m[2])} target="_blank"
             rel="noopener noreferrer" dir="ltr"
             title={`Open ${m[2]} on Finviz`}
             className="font-semibold underline decoration-dotted hover:decoration-solid"
             onClick={(e) => e.stopPropagation()}>{m[2]}</a>
        );
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  if (nodes.every((n) => typeof n === 'string')) return text;
  return nodes;
}
