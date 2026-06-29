/**
 * Detects the market entity type of a selected bulk item.
 * Supports: 'stock' | 'etf' | 'index' | 'commodity' | 'crypto' | 'macro' | 'sector' | 'sentiment' | 'unknown'.
 */

import { resolveFinvizTicker, lookupTradingViewSymbol } from '@/utils/finvizLinks';

const TICKER_RE = /^[A-Z]{1,6}$/;

// Known ETF tickers — sub-classifies stock-section rows as 'etf' instead of 'stock'
const _ETF_TICKERS = new Set([
  'SPY','IWM','DIA','GLD','SLV','USO','QQQ','TLT','SMH',
  'XLK','XLF','XLE','XLV','XLI','XLB','XLU','XLY','XLP','XLC','XLRE',
  'XBI','XRT','XHB','VNQ','JETS','TAN','ITA','KRE','IGV',
]);

// TradingView symbol sets used to sub-classify index/שווקים rows
const _COMMODITY_TV = new Set([
  'TVC:USOIL','TVC:UKOIL','TVC:NATGAS','TVC:GOLD','TVC:SILVER','COMEX:HG1!',
]);
const _MACRO_TV = new Set(['TVC:US10Y','TVC:DXY','TVC:VIX']);
const _SECTOR_TV = new Set([
  'AMEX:XLK','AMEX:XLV','AMEX:XLF','AMEX:XLE','AMEX:XLU','AMEX:XLRE',
  'AMEX:XHB','AMEX:XBI','AMEX:XLI','AMEX:XLB','AMEX:XLY','AMEX:XLP',
  'AMEX:XLC','AMEX:IWM','NASDAQ:SMH','NASDAQ:QQQ','AMEX:VNQ','AMEX:KRE',
  'AMEX:XRT','AMEX:TAN','AMEX:JETS','AMEX:IGV',
]);

// Maps a resolved TradingView symbol to a sub-type for index/שווקים rows.
function _classifyByTvSymbol(tvSymbol) {
  if (!tvSymbol) return null;
  if (tvSymbol.startsWith('BITSTAMP:')) return 'crypto';
  if (_COMMODITY_TV.has(tvSymbol)) return 'commodity';
  if (_MACRO_TV.has(tvSymbol)) return 'macro';
  if (_SECTOR_TV.has(tvSymbol)) return 'sector';
  return null;
}

/**
 * Extracts a US stock ticker from an item's text field.
 * Morning Brief stock rows have text like: "AAPL · Apple Inc. · context · sentiment"
 * Returns the ticker string (uppercase) or null.
 */
export function extractTickerFromItem(item) {
  if (!item) return null;
  const text = String(item.text || '').trim();
  if (!text) return null;

  // Try first segment split by ' · ' (Morning Brief stock format)
  const firstSegment = text.split(' · ')[0].trim();
  if (TICKER_RE.test(firstSegment)) return firstSegment;

  // Fallback: first whitespace-delimited word
  const firstWord = text.split(/[\s·:—\-]/)[0].trim().toUpperCase();
  if (TICKER_RE.test(firstWord) && resolveFinvizTicker(firstWord)) return firstWord;

  return null;
}

/**
 * Extracts a market/index name from a selected bulk item.
 * Tries structured fields first, then falls back to the first segment of text.
 * Morning Brief market rows store the asset name as the first text segment:
 *   e.g. "NASDAQ · bullish · strong · [comment]" → "NASDAQ"
 *        "S&P 500 · bearish · [comment]"         → "S&P 500"
 */
export function extractIndexNameFromItem(item) {
  if (!item) return null;
  // Try dedicated fields first (defensive: different data sources may use different keys)
  const fieldOrder = ['symbol', 'ticker', 'name', 'title', 'label', 'asset', 'index', 'market'];
  for (const field of fieldOrder) {
    const val = String(item[field] || '').trim();
    if (val) return val;
  }
  // Fallback: first segment of text (Morning Brief format: "ASSET · trend · strength · comment")
  const text = String(item.text || '').trim();
  if (!text) return null;
  return text.split(' · ')[0].trim() || null;
}

/**
 * Returns the entity type for a selected bulk item.
 * 'stock'     — Morning Brief stocks-mentioned rows (non-ETF tickers)
 * 'etf'       — Known ETF tickers from stocks section (SPY, QQQ, XLK, etc.)
 * 'index'     — Market indices (NASDAQ, S&P 500, DOW JONES, KOSPI, etc.)
 * 'commodity' — Commodities (Gold, Oil, Gas, Silver, Copper)
 * 'crypto'    — Crypto assets (BTC, ETH, CRYPTO)
 * 'macro'     — Macro drivers (PCE Inflation, DXY, VIX, Interest Rates)
 * 'sector'    — Sector ETF proxies (Technology, Healthcare, Financials, etc.)
 * 'sentiment' — Market sentiment signals
 * 'unknown'   — Unrecognized item
 */
export function detectMarketEntityType(item) {
  if (!item) return 'unknown';

  const type = String(item.type || '').toLowerCase();
  const sectionLabel = String(item.sectionLabel || '').toLowerCase();

  // ── Stocks section — check for ETF sub-type ───────────────────────────────
  if (type === 'stocks-mentioned' || sectionLabel.includes('מניות')) {
    const ticker = extractTickerFromItem(item);
    if (ticker && _ETF_TICKERS.has(ticker)) return 'etf';
    return 'stock';
  }

  // ── Macro events tab ──────────────────────────────────────────────────────
  if (type === 'brief-macro' || sectionLabel.includes('מאקרו')) return 'macro';

  // ── Sentiment tab ─────────────────────────────────────────────────────────
  if (type === 'brief-sentiment' || sectionLabel.includes('סנטימנט')) return 'sentiment';

  // ── Markets / indices tab — sub-classify by resolved TV symbol ────────────
  if (type === 'indices' || sectionLabel.includes('שווקים')) {
    const name = extractIndexNameFromItem(item);
    const tvSym = lookupTradingViewSymbol(name);
    const sub = _classifyByTvSymbol(tvSym);
    if (sub) return sub;
    return 'index';
  }

  // ── Fallback: try to detect ticker in text ────────────────────────────────
  const ticker = extractTickerFromItem(item);
  if (ticker) {
    if (_ETF_TICKERS.has(ticker)) return 'etf';
    if (resolveFinvizTicker(ticker)) return 'stock';
  }

  return 'unknown';
}
