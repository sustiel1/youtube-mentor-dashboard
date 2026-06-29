/**
 * Detects the market entity type of a selected bulk item.
 * Currently supports: 'stock' | 'unknown'.
 * Future: etf | index | sector | commodity | macro | sentiment | opportunity | risk
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
 * Returns the entity type for a selected bulk item.
 * Only 'stock' is fully implemented in this first step.
 * Returns 'unknown' for everything else.
 */
export function detectMarketEntityType(item) {
  if (!item) return 'unknown';

  const type = String(item.type || '').toLowerCase();
  const sectionLabel = String(item.sectionLabel || '').toLowerCase();

  // Explicit stock section type
  if (type === 'stocks-mentioned') return 'stock';
  if (sectionLabel.includes('מניות')) return 'stock';

  // Try to detect ticker in text
  const ticker = extractTickerFromItem(item);
  if (ticker && resolveFinvizTicker(ticker)) return 'stock';

  return 'unknown';
}
