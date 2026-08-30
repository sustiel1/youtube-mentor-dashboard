// QA for the shared "פעולה"/"עולה" false-positive fix (lessons.md, 2026-08-30)
// applied to the three PRODUCTION/shared locations that each ran their own
// unanchored Hebrew bullish-keyword regex:
//   1. src/utils/workspaceStockItems.js       — inferSentimentFromText (BULLISH_RE)
//   2. src/lib/morningBriefVisuals.js         — BULLISH_PERCENT_CTX (via parseStockMovePercentFromText)
//   3. src/lib/marketRowVisuals.js            — getMarketTrendTone
// plus the shared src/lib/hebrewSentimentTokenGuard.js helper they all now use.
//
// This is distinct from scripts/saved-stock-rows-qa.mjs's regression tests,
// which cover stockRowText.js's own (already-correct, local) workaround —
// this script covers the shared functions those workarounds sat on top of,
// which real production code (WorkspaceSaveReviewOverlay.jsx's save-time
// parseStockFromText call, MorningBriefPanels.jsx's live percent display,
// SavedMarketRowsTable's trend pill) calls directly.
//
//   node --import ./scripts/register-src-aliases.mjs scripts/hebrew-sentiment-token-guard-qa.mjs

import assert from 'node:assert/strict';

import { stripSentimentFalsePositiveTokens } from '../src/lib/hebrewSentimentTokenGuard.js';
import { inferSentimentFromText } from '../src/utils/workspaceStockItems.js';
import { getMarketTrendTone } from '../src/lib/marketRowVisuals.js';
import { parseStockMovePercentFromText } from '../src/lib/morningBriefVisuals.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

// ── stripSentimentFalsePositiveTokens (the shared guard) ─────────────────────
check('strips a bare "פעולה" token, leaves everything else untouched', () => {
  assert.equal(stripSentimentFalsePositiveTokens('הערה כללית ללא תיוג פעולה'), 'הערה כללית ללא תיוג');
});

check('strips "פעולה" even glued to punctuation (e.g. "פעולה:")', () => {
  assert.ok(!stripSentimentFalsePositiveTokens('פעולה: watch').includes('פעולה'));
});

check('does not touch a string with no false-positive token (returns input unchanged, not reformatted)', () => {
  const text = 'עלייה חדה של 3%  עם רווחח';
  assert.equal(stripSentimentFalsePositiveTokens(text), text);
});

check('does not strip partial matches — only the exact whole word "פעולה"', () => {
  // "פעולות" (actions, plural) is a different word and must survive.
  assert.ok(stripSentimentFalsePositiveTokens('כמה פעולות בוצעו').includes('פעולות'));
});

check('empty / non-string input is handled without throwing', () => {
  assert.equal(stripSentimentFalsePositiveTokens(''), '');
  assert.equal(stripSentimentFalsePositiveTokens(null), '');
  assert.equal(stripSentimentFalsePositiveTokens(undefined), '');
});

// ── File 1: workspaceStockItems.js — inferSentimentFromText ──────────────────
check('REGRESSION (File 1): bare "פעולה" with no other signal is neutral, not positive', () => {
  assert.equal(inferSentimentFromText('הערה כללית ללא תיוג פעולה'), null);
});

check('REGRESSION (File 1): "פעולה" tag glued to prose does not flip an unrelated bearish context to positive', () => {
  // "ירידה" (bearish) is present; "פעולה" must not introduce a false bullish
  // signal that could otherwise contest/dilute the correct bearish read.
  assert.equal(inferSentimentFromText('ירידה חדה במניה. פעולה: watch'), 'negative');
});

check('File 1: real bullish text is still detected (fix did not over-correct)', () => {
  assert.equal(inferSentimentFromText('עלייה חדה במניה'), 'positive');
});

check('File 1: real bearish text is still detected (fix did not over-correct)', () => {
  assert.equal(inferSentimentFromText('ירידה חדה במניה'), 'negative');
});

check('File 1: intentional prefixed-inflection matching is preserved ("שעולה", "לירידה")', () => {
  // The original design deliberately uses substring matching (not \b) to
  // catch these — the fix must not regress that documented behavior.
  assert.equal(inferSentimentFromText('שעולה כעת'), 'positive');
  assert.equal(inferSentimentFromText('לירידה חדה'), 'negative');
});

check('File 1: no unrelated tag word (עדיפות/טווח/עדכון/למעקב) accidentally collides with either keyword list', () => {
  // Investigation finding: only "פעולה" collides. Documented here as a
  // standing regression guard, not just a one-time note.
  for (const word of ['עדיפות', 'טווח', 'עדכון', 'למעקב']) {
    assert.equal(inferSentimentFromText(`הערה כללית. ${word}: משהו`), null, word);
  }
});

// ── File 2: morningBriefVisuals.js — BULLISH_PERCENT_CTX ─────────────────────
check('REGRESSION (File 2): "פעולה" near an unsigned percent must not flip its sign to positive', () => {
  // This is the more severe variant of the bug: a wrong tone here doesn't
  // just mis-color a pill, it flips the actual returned percent's sign.
  const result = parseStockMovePercentFromText('פעולה: watch, שינוי של 3%');
  assert.equal(result, null, 'no real bullish/bearish context word present → neutral → null, not a signed +3%');
});

check('File 2: real bullish context still resolves the percent as positive', () => {
  const result = parseStockMovePercentFromText('עלייה חדה של 3%');
  assert.equal(result?.tone, 'bullish');
  assert.equal(result?.percent, 3);
});

check('File 2: real bearish context still resolves the percent as negative (magnitude + bearish tone)', () => {
  const result = parseStockMovePercentFromText('ירידה חדה של 3%');
  assert.equal(result?.tone, 'bearish');
  assert.equal(result?.percent, 3);
});

// ── File 3: marketRowVisuals.js — getMarketTrendTone ─────────────────────────
check('REGRESSION (File 3): bare "פעולה" as a trend value gets the neutral/unknown tone, not bullish', () => {
  assert.match(getMarketTrendTone('פעולה').className, /slate/);
});

check('File 3: real trend words are still classified correctly (fix did not over-correct)', () => {
  assert.match(getMarketTrendTone('עולה').className, /emerald/);
  assert.match(getMarketTrendTone('יורד').className, /red/);
  assert.match(getMarketTrendTone('דשדוש').className, /amber/);
});

console.log(`\nhebrew sentiment token guard QA: ${count} checks passed`);
