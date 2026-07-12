// ─── Workspace Stock Items — parse / detect / normalize ───────────────────────
// Used by StockWatchlistView (display) and WorkspaceSaveReviewOverlay (save).
// All parsing is conservative: returns null when uncertain.
// Never modifies stored data — only fills display gaps.

const TICKER_RE = /^[A-Z]{1,6}(?:\.[A-Z]{1,2})?$/;

export function isTickerLike(s) {
  return TICKER_RE.test(String(s || '').trim().toUpperCase());
}

const STOCK_SECTION_KEYWORDS = ['מניות', 'stocks', 'stocks-mentioned', 'stocks_mentioned'];

export function looksLikeStockSection(label) {
  if (!label) return false;
  const lc = String(label).toLowerCase();
  return STOCK_SECTION_KEYWORDS.some(kw => lc.includes(kw.toLowerCase()));
}

// Shared sentiment keyword lists — used both by the eager parse below and by
// the display-only fallback in normalizeStockWorkspaceItem. Kept in one place
// so the two never drift apart.
//
// IMPORTANT: no \b word-boundary assertions here. \w in JS regex only covers
// [A-Za-z0-9_], so Hebrew letters never count as "word characters" — \b
// around a Hebrew keyword silently never matches (verified: /\bעולה\b/.test
// ('...עולה...') is always false). Plain substring matching is used instead,
// which also has the benefit of catching prefixed Hebrew inflections
// (e.g. "שעולה", "לירידה").
const BEARISH_RE = /(יורד|יורדת|ירידה|נפילה|שלילי|שורט|מכירה|לחץ|הורדת דירוג|כישלון|סיכון|bearish)/i;
const BULLISH_RE = /(עולה|עלייה|חיובי|לונג|קנייה|חזק|פריצה|breakout|momentum|bullish|דוחות טובים|גאות)/i;

/** Best-effort sentiment guess from free text. Returns null when unclear. */
export function inferSentimentFromText(text) {
  if (!text) return null;
  const lc = String(text).toLowerCase();
  if (BEARISH_RE.test(lc)) return 'negative';
  if (BULLISH_RE.test(lc)) return 'positive';
  return null;
}

/**
 * Parse structured fields from the flat "TICKER · Company · notes · sentiment"
 * format produced by formatStockRowText.
 * Returns null when the text does not match the expected pattern.
 * NEVER modifies stored data — only used for display fallback and new saves.
 */
export function parseStockFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const parts = text.split(' · ').map(s => s.trim()).filter(Boolean);
  if (parts.length < 1) return null;

  const firstUpper = parts[0].trim().toUpperCase();
  if (!isTickerLike(firstUpper)) return null;

  const symbol = firstUpper;

  // A distinct company-name segment only exists when there are 3+ parts
  // (ticker + company + notes[+ sentiment]). With exactly 2 parts, the
  // remainder is the note/context itself — treating it as "company name"
  // would duplicate the note as a fake subtitle under the symbol.
  let companyName = '';
  let noteStart = 1;
  if (parts.length > 2 && !isTickerLike(parts[1].trim().toUpperCase())) {
    companyName = parts[1].trim();
    noteStart = 2;
  }

  const notes = parts.slice(noteStart).join(' · ');

  // Sentiment detection from notes + company text
  const sentiment = inferSentimentFromText(notes + ' ' + companyName);

  // Percent change
  const pctMatch = notes.match(/(\d+(?:\.\d+)?)\s*%/);
  const percentChange = pctMatch ? `${pctMatch[1]}%` : null;

  return {
    symbol,
    companyName: companyName || null,
    notes,
    fullNotes: notes,
    rawSourceText: text,
    sentiment,
    percentChange,
  };
}

/**
 * Returns true if the workspace item is a stock item — either by stored
 * structured fields or by inspecting sourceSection / notes text.
 */
export function isStockWorkspaceItem(item) {
  if (!item) return false;
  if (item.itemType === 'stock') return true;
  if (item.symbol) return true;
  if (looksLikeStockSection(item.sourceSection)) return true;
  const text = item.rawSourceText || item.fullNotes || item.notes;
  if (text) return parseStockFromText(text) != null;
  return false;
}

/**
 * Merges stored structured fields with fallback-parsed values for display.
 * Stored fields ALWAYS win. Parsed values only fill gaps.
 * Never writes back to localStorage.
 */
export function normalizeStockWorkspaceItem(item) {
  if (!item) return item;
  if (item.symbol) {
    // Already has structured fields — but sentiment specifically may have
    // been saved as null (e.g. the source text used a word form the parser
    // didn't catch at save time). Backfill a display-only guess from the
    // note text without touching anything else, and never overwrite an
    // existing stored sentiment.
    if (item.sentiment) return item;
    const text = item.fullNotes || item.notes || item.rawSourceText;
    const inferred = inferSentimentFromText(text);
    return inferred ? { ...item, sentiment: inferred, _sentimentInferred: true } : item;
  }
  const text = item.rawSourceText || item.fullNotes || item.notes;
  if (!text) return item;
  const parsed = parseStockFromText(text);
  if (!parsed) return item;
  // Spread parsed first so stored fields always override
  return {
    ...parsed,
    ...item,
    sentiment: item.sentiment ?? parsed.sentiment ?? inferSentimentFromText(text),
    _parsedFallback: true, // marker for debugging
  };
}

/**
 * Display-only sentiment for a whole symbol group: the sentiment of the most
 * recent mention that actually resolves to one (stored or inferred) — not
 * just the single latest mention, which may itself be silent on sentiment
 * while an earlier one in the same group isn't.
 */
export function getGroupDisplaySentiment(groupItems) {
  for (const item of getStockTimeline(groupItems)) {
    const sentiment = normalizeStockWorkspaceItem(item)?.sentiment;
    if (sentiment) return sentiment;
  }
  return null;
}

/**
 * Priority chain for the notes column in StockWatchlistView.
 * Prefers richest stored value; falls back to parsed text.
 */
export function getStockDisplayNotes(item) {
  return item.fullNotes || item.notes || item.trigger || item.riskNote || item.rawSourceText || null;
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

/**
 * Returns a normalized uppercase symbol, or null if input is empty/invalid.
 */
export function normalizeSymbol(symbol) {
  if (!symbol) return null;
  return String(symbol).trim().toUpperCase();
}

/**
 * Groups workspace stock items by their normalized symbol.
 * Items that cannot be resolved to a symbol go into `unsymbolized`.
 * Does NOT modify or merge stored data — grouping is display-only.
 */
export function groupStockItemsBySymbol(items) {
  const groups = new Map(); // normalizedSymbol → Item[]
  const unsymbolized = [];

  for (const rawItem of items) {
    const item = normalizeStockWorkspaceItem(rawItem);
    const sym = normalizeSymbol(item.symbol);
    if (!sym) {
      unsymbolized.push(rawItem);
    } else {
      if (!groups.has(sym)) groups.set(sym, []);
      groups.get(sym).push(rawItem);
    }
  }

  return { groups, unsymbolized };
}

/**
 * Returns the item with the newest savedAt from a group.
 */
export function getLatestStockMention(groupItems) {
  if (!groupItems?.length) return null;
  return [...groupItems].sort(
    (a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0),
  )[0];
}

/**
 * Returns group items sorted newest-first (timeline order).
 */
export function getStockTimeline(groupItems) {
  return [...groupItems].sort(
    (a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0),
  );
}

// ─── Sentiment visuals ────────────────────────────────────────────────────────

export const SENTIMENT_DOT = {
  positive: '🟢',
  negative: '🔴',
  neutral: '⚪',
};

export const SENTIMENT_LABEL = {
  positive: 'חיובי',
  negative: 'שלילי',
  neutral: 'ניטרלי',
};

export const SENTIMENT_COLOR = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
  neutral: 'text-slate-500 dark:text-zinc-400',
};
