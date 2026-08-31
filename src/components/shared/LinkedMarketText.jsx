import { buildFinvizQuoteUrl, getExternalSymbolUrl, HE_CARD_COMPANY_ALIASES } from '@/utils/finvizLinks';

// Pure business/finance jargon abbreviations — NOT a market instrument on
// their own (no ticker, no index, no macro indicator), so they must never
// get a link at all. Kept deliberately small: everything NOT in this list
// is treated as a candidate market entity and resolved via
// getExternalSymbolUrl (Finviz for equities, il.investing.com for indices/
// macro/commodities/FX — see ".claude/agents/frontend-rtl-developer.md" →
// "Asset link resolution — provider fallback rule"), never left unlinked.
//
// USD/ILS are kept here (not treated as linkable entities) deliberately —
// they appear constantly as part of other terms (e.g. "USD/ILS") and were
// already excluded before this fix; turning every bare "USD" mention into a
// link would be a new, noisier behavior this task wasn't asked to add.
const _NON_ENTITY_TERMS = new Set([
  'ETF', 'ETFS', 'AI', 'EPS',
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
 * Renders market text with inline links for known tickers, Hebrew company
 * aliases, and market/macro entities.
 * Hebrew alias → displays as an English ticker link to Finviz (e.g. מטה → META).
 * English [A-Z]{2,6} word → resolved via getExternalSymbolUrl (Finviz for
 * equities, il.investing.com for indices/macro/commodities/FX — never left
 * unlinked), unless it's pure jargon in _NON_ENTITY_TERMS (not a market
 * instrument at all, e.g. "CEO", "ROI").
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
      const url = _NON_ENTITY_TERMS.has(m[2]) ? null : getExternalSymbolUrl(m[2]);
      nodes.push(url
        ? <a key={`en-${m.index}`} href={url} target="_blank"
             rel="noopener noreferrer" dir="ltr"
             title={`Open ${m[2]}`}
             className="font-semibold underline decoration-dotted hover:decoration-solid"
             onClick={(e) => e.stopPropagation()}>{m[2]}</a>
        : m[2]
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  if (nodes.every((n) => typeof n === 'string')) return text;
  return nodes;
}
