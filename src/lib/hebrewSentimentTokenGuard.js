/**
 * Shared guard against the "פעולה"/"עולה" false-positive collision recorded
 * in lessons.md (2026-08-30, "Reuse the corrected word-boundary sentiment
 * pattern instead of re-copying the substring bug"): Hebrew has no reliable
 * `\b` word boundary in JavaScript regex (`\w` only covers [A-Za-z0-9_], so
 * `\b` around a Hebrew keyword silently never matches), so a plain substring
 * match for the bullish keyword "עולה"/"עול" also fires inside the unrelated
 * word "פעולה" ("action" — a common activity-tag label in saved GEM rows,
 * e.g. "פעולה: watch"). That can even flip an explicit sentiment label
 * (e.g. an explicit "שלילי" row whose free-text reason also happens to
 * mention "פעולה") into the wrong tone.
 *
 * Reused by workspaceStockItems.js, morningBriefVisuals.js, and
 * marketRowVisuals.js instead of each maintaining its own ad-hoc guard —
 * per the lesson's prevention rule ("extend the corrected pattern instead
 * of writing a fifth independent regex").
 *
 * This is deliberately NOT a general Hebrew word-boundary regex fix (e.g. a
 * negative lookbehind excluding any preceding Hebrew letter). Several of
 * these modules intentionally rely on plain substring matching to catch
 * legitimately prefixed inflections — "שעולה" ("and rising"), "לירידה"
 * ("to a decline") — and a blanket "no Hebrew letter before/after" boundary
 * would silently break that. Instead, this strips only a small, explicit set
 * of known false-positive WHOLE words (exact token match) before the caller
 * runs its own substring/regex tone inference on what remains — narrow and
 * additive, not a general parsing change.
 */

// Confirmed false-positive collisions (investigated 2026-08-30): "פעולה"
// contains "עולה" as a substring. No other saved-row tag word (עדיפות,
// טווח, עדכון, למעקב) collides with any bullish/bearish keyword list in the
// three files that use this guard — verified by direct inspection of each
// list. Extend this set (not the individual regexes) if a new collision is
// found.
const FALSE_POSITIVE_TOKENS = new Set(['פעולה']);

/**
 * Removes known false-positive whole words from `text`, exact-token match
 * only. Returns the input unchanged (as a string) when there is nothing to
 * strip. Safe to run before ANY substring/regex `.test()` — it never removes
 * partial words, so prefixed inflections elsewhere in the text are untouched.
 */
export function stripSentimentFalsePositiveTokens(text) {
  const raw = String(text || '');
  if (!raw) return raw;

  const normalized = raw.replace(/[.,;:!?()"'״׳—־]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.some((token) => FALSE_POSITIVE_TOKENS.has(token))) return raw;

  return tokens.filter((token) => !FALSE_POSITIVE_TOKENS.has(token)).join(' ');
}
