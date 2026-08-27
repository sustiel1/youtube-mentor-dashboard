/**
 * Narrow, fail-closed JSON repair for a model's raw text response.
 *
 * Deliberately much narrower than vite.config.js#sanitizeJsonGershayim's
 * two-pass approach:
 *
 *  - Pass 1 of that function (a regex requiring a Hebrew/word character on
 *    BOTH sides of a bare quote) is ported here as
 *    repairUnescapedMidWordQuotes — it is context-anchored and provably
 *    narrow (see the function doc below).
 *
 *  - Pass 2 of that function is NOT ported. It iteratively re-parses and
 *    blindly escapes whatever character JSON.parse's reported error
 *    position happens to land on, up to 20 times. That heuristic can't
 *    distinguish "this quote is genuinely the defect" from "a different,
 *    earlier defect made the parser's error position land here by
 *    coincidence" — it isn't narrowly safe, so this module never applies
 *    more than one targeted repair attempt before failing closed.
 *
 * Must stay in sync with the inlined copy in backend/analyze-video.function.js
 * (deployed standalone by Base44, cannot import project modules). See
 * scripts/claude-json-repair-qa.mjs for the parity test between the two.
 */

const MARKDOWN_FENCE_START_RE = /^```json?\s*/i;
const MARKDOWN_FENCE_END_RE = /\s*```$/;

/**
 * Matches a bare ASCII double-quote (U+0022) with a Hebrew letter/point
 * (U+05B0-U+05FF) or ASCII word character on BOTH sides, e.g. the Hebrew
 * abbreviation pattern עו"ד, or a quotation mark left un-escaped mid
 * sentence.
 *
 * Why this is narrow:
 *  - A genuine JSON string boundary is always adjacent to structural syntax
 *    (`{ } [ ] , :` or whitespace) on at least one side — two consecutive
 *    JSON values are never separated by a bare letter, so this can only
 *    ever fire on a quote embedded mid-word/mid-sentence, never on a real
 *    opening/closing string quote.
 *  - Real Hebrew punctuation (גרשיים ״ U+05F4, גרש ׳ U+05F0) is a different
 *    Unicode codepoint from ASCII " (U+0022) and is never matched — this
 *    never touches legitimate Hebrew punctuation.
 *  - An already-escaped quote (\") is never matched either: the character
 *    immediately before the quote is `\`, which fails the word/Hebrew-char
 *    check on the left side.
 *  - It only ever inserts a single backslash immediately before an
 *    already-present quote character — it never inserts, removes, or
 *    reorders any other character (no invented commas/braces/brackets), and
 *    never touches characters outside the matched 3-character window.
 */
const UNESCAPED_QUOTE_MID_WORD_RE = /([ְ-׿\w])"([ְ-׿\w])/g;

export function stripMarkdownFences(text) {
  return String(text || '').replace(MARKDOWN_FENCE_START_RE, '').replace(MARKDOWN_FENCE_END_RE, '').trim();
}

export function repairUnescapedMidWordQuotes(text) {
  return String(text || '').replace(UNESCAPED_QUOTE_MID_WORD_RE, '$1\\"$2');
}

export function extractJsonParseDiagnostics(text, error) {
  const message = String(error?.message || '');
  const match = message.match(/position\s+(\d+)/i);
  const position = match ? Number(match[1]) : null;
  const windowStart = Number.isFinite(position) ? Math.max(0, position - 120) : 0;
  const windowEnd = Number.isFinite(position) ? Math.min(text.length, position + 120) : Math.min(text.length, 240);
  return {
    parseError: message,
    parseErrorPosition: Number.isFinite(position) ? position : null,
    parseErrorSnippet: text.slice(windowStart, windowEnd),
  };
}

/**
 * Required sequence, exactly:
 *   1. Strip markdown fences.
 *   2. Attempt strict JSON.parse().
 *   3. Only on failure, apply the one narrow repair, once.
 *   4. Attempt JSON.parse() once more.
 *   5. Still failing -> throw with diagnostics. Never returns a guess, never
 *      returns partially-parsed content, never invents structure.
 */
export function parseModelJsonSafely(rawText) {
  const cleaned = stripMarkdownFences(rawText);
  try {
    return { value: JSON.parse(cleaned), repaired: false };
  } catch (firstError) {
    const repaired = repairUnescapedMidWordQuotes(cleaned);
    if (repaired === cleaned) {
      // Nothing this narrow repair could touch — the failure is a
      // different class of defect (missing delimiter, truncation, etc.).
      // Fail closed with the original diagnostic rather than guessing.
      const error = new Error('Model returned invalid JSON.');
      error.code = 'MODEL_INVALID_JSON';
      error.diagnostics = extractJsonParseDiagnostics(cleaned, firstError);
      throw error;
    }
    try {
      return { value: JSON.parse(repaired), repaired: true };
    } catch (secondError) {
      const error = new Error('Model returned invalid JSON.');
      error.code = 'MODEL_INVALID_JSON';
      error.diagnostics = extractJsonParseDiagnostics(repaired, secondError);
      throw error;
    }
  }
}
