import { parseStockFromText, inferSentimentFromText } from '@/utils/workspaceStockItems';

/**
 * Best-effort parser for individually-saved "מניות שהוזכרו" rows.
 *
 * Saved text shape (from MacroGemDashboard.jsx's MacroStocksSection):
 *   "SYMBOL · Company · sentiment · reason"
 * where `reason` often embeds Gemini-authored labeled tags of the form
 * "פעולה: watch · עדכון: מיידי · טווח: בינונית · עדיפות: בינונית · למעקב: לא"
 * inline with free prose — NOT a separate structured field anywhere upstream.
 *
 * This module layers on top of the existing, conservative `parseStockFromText`
 * (symbol / companyName / sentiment / percentChange) and additionally extracts
 * the "פעולה" (activity) tag when present, stripping recognised label:value
 * pairs out of the remaining notes so the notes cell isn't a near-duplicate of
 * the activity pill. Never drops data: anything not recognised as a tag stays
 * in `notes` verbatim. Returns null under the exact same conditions as
 * `parseStockFromText` (unparseable / non-stock text), so callers can fall
 * back to rendering the full raw line — same contract as marketRowText.js.
 */

// Exact-match sentiment tokens these saved rows carry as their OWN dedicated
// segment (MacroGemDashboard.jsx's rowText = [symbol, company, sentiment, reason]
// — `sent` there comes straight from item.sentiment/direction/tone, i.e. it is
// already a clean label, not free prose).
const EXPLICIT_SENTIMENT_MAP = {
  'חיובי': 'positive', 'bullish': 'positive', 'positive': 'positive', 'long': 'positive', 'buy': 'positive',
  'שלילי': 'negative', 'bearish': 'negative', 'negative': 'negative', 'short': 'negative', 'sell': 'negative',
  'ניטרלי': 'neutral', 'ניטרלית': 'neutral', 'neutral': 'neutral',
};

/**
 * Scans `text`'s ' · ' segments for an exact (not substring) match to a known
 * sentiment token and returns the mapped value, or null if none is found.
 *
 * This exists because `parseStockFromText`'s own sentiment inference
 * (`inferSentimentFromText`) is keyword-substring based and unreliable for
 * this data source specifically: every row here carries a "פעולה: ..."
 * activity tag, and "עולה" (bullish keyword) is a literal substring of
 * "פעולה" — so rows with no real bullish content still register as
 * positive purely because they mention the activity tag's label. Preferring
 * an exact match against the row's own explicit sentiment segment (when
 * present) sidesteps that false-positive entirely and is more faithful to
 * what was actually saved. When no explicit segment is present, the caller
 * re-runs `inferSentimentFromText` on the *tag-stripped* notes instead of
 * trusting `parseStockFromText`'s own inference — that inference runs before
 * tags are stripped, so it is exposed to the same "פעולה" collision.
 */
function extractExplicitSentiment(text) {
  const parts = String(text || '').split('·').map((segment) => segment.trim()).filter(Boolean);
  for (const part of parts) {
    const mapped = EXPLICIT_SENTIMENT_MAP[part] || EXPLICIT_SENTIMENT_MAP[part.toLowerCase()];
    if (mapped) return mapped;
  }
  return null;
}

// Known labeled tags seen in Gemini-authored stock-row reason text.
// Only "activity" (פעולה) is surfaced as its own table column today; the
// others are still stripped from `notes` so they don't show up twice, and
// are exposed on the parsed result for any future column additions.
const TAG_LABELS = ['פעולה', 'עדיפות', 'טווח', 'עדכון', 'למעקב'];

// A tag's value side is a single token (no whitespace/·/: inside it) —
// every observed value so far (watch, buy, avoid, מיידי, בינונית, לא...)
// is one word. Matching a single token (rather than "rest of segment")
// means a tag glued directly onto trailing prose with no ' · ' separator
// (e.g. "...805M$). watch :פעולה") still isolates just the tag, leaving
// the prose untouched.
const TAG_VALUE = '[^\\s·:]+';
const TAG_RE = new RegExp(
  `(?:(${TAG_LABELS.join('|')})\\s*:\\s*(${TAG_VALUE})|(${TAG_VALUE})\\s*:\\s*(${TAG_LABELS.join('|')}))`,
  'g',
);

/**
 * Finds every "LABEL: value" or "value :LABEL" tag pair anywhere in `text`
 * and removes it, returning the recognised tags plus the untouched leftover
 * prose. Tolerant of both colon-side orders — bidi rendering of mixed
 * Hebrew/English text can visually reverse a pair without changing which
 * side of the colon holds the actual label in the underlying string, and
 * this repo's saved-row text has not been confirmed to always author them
 * the same way.
 */
function extractTags(text) {
  const source = String(text || '');
  const tags = {};

  const stripped = source.replace(TAG_RE, (_full, labelA, valueA, valueB, labelB) => {
    const label = labelA || labelB;
    const value = labelA ? valueA : valueB;
    if (label && value) tags[label] = value;
    return ' ';
  });

  const rest = stripped
    .split('·')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(' · ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { tags, rest };
}

/**
 * Parse a saved "מניות שהוזכרו" row into display fields.
 * Returns null when the text isn't stock-row shaped (mirrors parseStockFromText).
 */
export function parseStockRowFromText(text) {
  const base = parseStockFromText(text);
  if (!base) return null;

  const { tags, rest } = extractTags(base.notes || '');

  // Prefer the row's own explicit sentiment segment when present. Otherwise
  // re-infer from the notes with every tag-LABEL word blanked out first — not
  // just the "LABEL: value" pairs extractTags already removed, but any bare
  // mention of a label word too (e.g. "...ללא תיוג פעולה", no colon). Needed
  // because "עולה" (bullish keyword) is a literal substring of "פעולה" and
  // inferSentimentFromText matches plain substrings with no word boundaries
  // (Hebrew has no \w-based \b) — so any mention of the word "פעולה" anywhere,
  // tagged or not, would otherwise register as false-positive bullish. Also
  // NOT base.sentiment: that was computed by parseStockFromText on the
  // original, un-blanked notes and is exposed to the exact same collision.
  const sentimentSafeText = rest.replace(new RegExp(TAG_LABELS.join('|'), 'g'), ' ');
  const sentiment = extractExplicitSentiment(text) || inferSentimentFromText(sentimentSafeText);

  return {
    symbol: base.symbol,
    companyName: base.companyName,
    sentiment,
    percentChange: base.percentChange,
    activity: tags['פעולה'] || null,
    priority: tags['עדיפות'] || null,
    timeframe: tags['טווח'] || null,
    updateRecency: tags['עדכון'] || null,
    followUp: tags['למעקב'] || null,
    notes: rest || null,
  };
}
