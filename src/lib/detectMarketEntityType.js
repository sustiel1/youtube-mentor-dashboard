/**
 * Detects the market entity type of a selected bulk item.
 * Supports: 'stock' | 'index' | 'macro' | 'sentiment' | 'unknown'.
 */

import { resolveFinvizTicker } from '@/utils/finvizLinks';

const TICKER_RE = /^[A-Z]{1,6}$/;

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
 * 'stock' — Morning Brief stocks-mentioned rows
 * 'index' — Morning Brief שווקים (indices) rows
 * 'unknown' — everything else
 */
export function detectMarketEntityType(item) {
  if (!item) return 'unknown';

  const type = String(item.type || '').toLowerCase();
  const sectionLabel = String(item.sectionLabel || '').toLowerCase();

  // Explicit stock section type
  if (type === 'stocks-mentioned') return 'stock';
  if (sectionLabel.includes('מניות')) return 'stock';

  // Explicit market index section type (שווקים tab)
  if (type === 'indices') return 'index';
  if (sectionLabel.includes('שווקים')) return 'index';

  // Macro events tab
  if (type === 'brief-macro') return 'macro';
  if (sectionLabel.includes('מאקרו')) return 'macro';

  // Sentiment tab
  if (type === 'brief-sentiment') return 'sentiment';
  if (sectionLabel.includes('סנטימנט')) return 'sentiment';

  // Try to detect ticker in text
  const ticker = extractTickerFromItem(item);
  if (ticker && resolveFinvizTicker(ticker)) return 'stock';

  return 'unknown';
}
