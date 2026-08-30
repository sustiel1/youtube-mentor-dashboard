/**
 * Tone and topic classification for individually-saved "📰 חדשות" rows
 * (SavedNewsRows) and the Layer-2 opportunity-row fallback (see
 * opportunityRowText.js) that reuses the same row layout.
 *
 * Deliberately NOT built on `inferSentimentFromText` (workspaceStockItems.js),
 * `resolveTone`/`BULLISH_PERCENT_CTX` (morningBriefVisuals.js — also used
 * transitively by morningBriefNewsNormalize.js's normalizeNewsSentiment), or
 * `getMarketTrendTone` (marketRowVisuals.js). All three run an unanchored
 * substring regex containing `עולה`/`עול`, which also matches inside the
 * unrelated word `פעולה` ("action" — a common tag label in saved GEM rows),
 * so any of them would misclassify a neutral row that merely mentions that
 * word as bullish/positive. See stockRowText.js's extractExplicitSentiment
 * for the first fix of this exact collision, and the 2026-08-30 lessons.md
 * entry recording it across three files.
 *
 * This module avoids the whole bug class structurally: it tokenizes on
 * whitespace/punctuation and does exact Set membership checks per token,
 * never a substring/regex test against the raw string. "פעולה" tokenizes to
 * itself and is not a member of any keyword set, so it can never match.
 *
 * Keyword coverage is necessarily approximate (e.g. "הפגת חששות" — easing of
 * concerns — still counts the token "חששות" as bearish, even though the
 * phrase as a whole reads mildly positive); this is the same class of
 * known, documented limitation as stockRowText.js's and sectorRowVisuals.js's
 * keyword-based fallbacks, not something this module claims to solve.
 */

const BULLISH_TOKENS = new Set([
  'עולה', 'עולות', 'עלייה', 'עליות', 'עלה', 'עלתה', 'עלו',
  'זינק', 'זינקה', 'קפץ', 'קפצה', 'טיפס', 'טיפסה',
  'התחזק', 'התחזקה', 'חיובי', 'חיובית', 'שורי', 'שורית',
  'פריצה', 'ראלי', 'גאות', 'שיא',
  'bullish', 'positive', 'rally', 'surge', 'gain', 'gains', 'breakout',
]);

const BEARISH_TOKENS = new Set([
  'יורד', 'יורדת', 'ירידה', 'ירידות', 'ירד', 'ירדה', 'ירדו',
  'נפילה', 'נפל', 'נפלה', 'צנח', 'צנחה', 'התרסק', 'התרסקה',
  'נחלש', 'נחלשה', 'שלילי', 'שלילית', 'דובי', 'דובית', 'משבר',
  'bearish', 'negative', 'crash', 'drop', 'decline', 'sell-off', 'selloff',
]);

function tokenize(text) {
  return String(text || '')
    .replace(/[.,;:!?()"'״׳—־]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Exact-token tone classifier. Returns 'positive' | 'negative' | 'neutral'. */
export function deriveNewsTone(text) {
  let bull = 0;
  let bear = 0;
  for (const token of tokenize(text)) {
    if (BULLISH_TOKENS.has(token)) bull += 1;
    if (BEARISH_TOKENS.has(token)) bear += 1;
  }
  if (bull > 0 && bear === 0) return 'positive';
  if (bear > 0 && bull === 0) return 'negative';
  if (bear > 0 && bear >= bull) return 'negative';
  if (bull > 0) return 'positive';
  return 'neutral';
}

// Physical `border-r-*` on purpose, not the logical `border-e-*` — this app
// is RTL-only (dir="rtl" fixed at the root, no LTR variant), and "right
// edge" in RTL is the inline-*start* side, not inline-end. Matches the exact
// convention already shipping in MorningBriefNewsCard's NEWS_CARD_SENTIMENT
// (border-r-4 + border-r-<color>).
export const NEWS_TONE_META = {
  positive: { label: 'חיובי', borderClass: 'border-r-emerald-500 dark:border-r-emerald-400' },
  negative: { label: 'שלילי', borderClass: 'border-r-red-500 dark:border-r-red-400' },
  neutral: { label: 'ניטרלי', borderClass: 'border-r-slate-300 dark:border-r-zinc-600' },
};

const DEAL_TOKENS = new Set([
  'מיזוג', 'מיזוגים', 'השתלטות', 'עסקת', 'רכישת', 'מכירת',
  'merger', 'acquisition', 'buyout', 'takeover',
]);

const MACRO_TOKENS_HE = new Set([
  'מאקרו', 'ריבית', 'אינפלציה', 'פדרל', 'פד', 'תעסוקה', 'תוצר',
  'אבטלה', 'מדד', 'שכר', 'צמיחה', 'גירעון', 'תקציב',
]);
const MACRO_TOKENS_EN = new Set([
  'CPI', 'PPI', 'PCE', 'NFP', 'GDP', 'FOMC', 'FED', 'VIX', 'DXY',
]);

export const NEWS_TOPIC_LABELS = ['מאקרו', 'מניה', 'עסקה', 'כללי'];

/**
 * 4-bucket topic classifier: עסקה (M&A/deal keyword) beats מאקרו (macro
 * keyword) beats מניה (a Finviz-resolvable equity ticker was identified in
 * the row) beats the כללי fallback. `entityLinks` is the output of
 * findMarketEntityLinksInText(text) — passed in so callers that already
 * extracted it once don't pay for a second scan.
 */
export function deriveNewsTopic(text, entityLinks = []) {
  const tokens = tokenize(text);
  for (const token of tokens) {
    if (DEAL_TOKENS.has(token) || DEAL_TOKENS.has(token.toLowerCase())) return 'עסקה';
  }
  for (const token of tokens) {
    if (MACRO_TOKENS_HE.has(token) || MACRO_TOKENS_EN.has(token.toUpperCase())) return 'מאקרו';
  }
  if (entityLinks.some((link) => link.provider === 'finviz')) return 'מניה';
  return 'כללי';
}
