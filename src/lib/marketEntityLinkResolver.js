/**
 * Finviz-first / il.investing.com-fallback link resolver for individual
 * equities, indices, macro indicators, commodities and FX — the convention
 * documented in `.claude/agents/frontend-rtl-developer.md` under
 * "Asset link resolution — provider fallback rule".
 *
 * Deliberately NOT built on top of `LinkedMarketText.jsx` /
 * `renderLinkedMarketText` — that module is Finviz-only (via
 * `AnalysisTickerLink`/`isSafeAnalysisTicker`) and already ships in the live
 * news cards and `SavedSectorRowsTable`; changing its fallback behavior would
 * change those surfaces too. This module reuses the same underlying pieces
 * (`isSafeAnalysisTicker`, `buildSafeFinvizTickerUrl`, the Hebrew company
 * alias list) but adds the missing il.investing.com fallback tier, entirely
 * additively, for the new saved-rows renderers only.
 */
import { isSafeAnalysisTicker, buildSafeFinvizTickerUrl } from '@/utils/analysisTickerLinks';
import { resolveMacroIndicatorInvestingUrl } from '@/lib/macroIndicatorLinks';
import { HE_CARD_COMPANY_ALIASES } from '@/utils/finvizLinks';

/**
 * Business/finance jargon abbreviations that are not, on their own, a
 * linkable market entity (no ticker, no index, no macro indicator). Kept
 * deliberately small and explicit — everything NOT in this list is treated
 * as a candidate entity and always resolves to a link (Finviz or
 * il.investing.com, specific page or search — see resolveMarketEntityLink).
 */
const NON_ENTITY_TERMS = new Set([
  'CEO', 'CFO', 'CTO', 'COO', 'EPS', 'YOY', 'QOQ', 'MOM', 'IPO', 'YTD',
  'ROI', 'ROE', 'ROA', 'DCF', 'PE', 'PB', 'ETF', 'ETFS', 'AI',
  'US', 'EU', 'UK', 'EM', 'DJ', 'VC', 'TA',
]);

/**
 * Resolves one ticker/asset term to a link. Finviz first (individual
 * US-listed equities); anything Finviz can't serve falls back to
 * il.investing.com, via `resolveMacroIndicatorInvestingUrl` — a specific
 * page when the term is in its curated slug map, otherwise the site-search
 * URL. That function never returns null, so this resolver never returns
 * null for non-empty, non-jargon input — never an unlinked symbol.
 * Returns null only for empty input or a term in NON_ENTITY_TERMS.
 */
export function resolveMarketEntityLink(term) {
  const raw = String(term || '').trim();
  if (!raw) return null;
  if (NON_ENTITY_TERMS.has(raw.toUpperCase())) return null;

  if (isSafeAnalysisTicker(raw)) {
    const url = buildSafeFinvizTickerUrl(raw);
    if (url) return { display: raw.toUpperCase(), url, provider: 'finviz' };
  }

  const url = resolveMacroIndicatorInvestingUrl(raw);
  return { display: raw, url, provider: 'investing' };
}

const _HE_LOOKUP = new Map(HE_CARD_COMPANY_ALIASES);
const _TERM_RE = new RegExp(
  `(${HE_CARD_COMPANY_ALIASES.map(([n]) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})|\\b([A-Z]{2,6})\\b`,
  'g',
);

/**
 * Scans free text for tickers, Hebrew company aliases, and macro/index
 * codes, resolving each identified term to a link via
 * resolveMarketEntityLink. Deduplicates by display term. Returns [] for
 * text with no identifiable entities — never throws, never returns partial
 * garbage.
 */
export function findMarketEntityLinksInText(text) {
  const raw = String(text || '');
  if (!raw) return [];
  const seen = new Set();
  const out = [];
  let match;
  _TERM_RE.lastIndex = 0;
  while ((match = _TERM_RE.exec(raw)) !== null) {
    const term = match[1] ? (_HE_LOOKUP.get(match[1]) || match[1]) : match[2];
    if (!term || seen.has(term)) continue;
    seen.add(term);
    const link = resolveMarketEntityLink(term);
    if (link) out.push(link);
  }
  return out;
}
