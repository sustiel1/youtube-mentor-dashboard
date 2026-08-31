/**
 * Best-effort Layer-1 parser for individually-saved "🎯 הזדמנויות" rows.
 *
 * Two independent producers write the same `originalItemType:
 * 'brief-opportunities'` with genuinely different text shapes:
 *
 *   1. formatMorningBriefOpportunityText (src/lib/morningBriefBulkSections.js,
 *      used by MorningBriefPanels.jsx — the dominant morning/evening/weekly/
 *      earnings-brief producer): one line, ' · '-joined, optional leading
 *      TICKER, then free-text title/detail segments, then zero or more
 *      labeled trade-plan segments ("כניסה: 100", "סטופ: 95", "יעד: 110",
 *      "יחס סיכון/סיכוי: 1:2", "טווח: swing", "ביטחון: medium") — any subset,
 *      in any order, may be missing.
 *
 *   2. formatOpportunityItem (MacroGemDashboard.jsx): multi-line (`\n`),
 *      "סוג:"/"פרטים:"/"נכסים:"/"קטליסט:" labels — no entry/stop/target/
 *      timeframe concept at all.
 *
 * This module ONLY parses shape 1. A `\n` anywhere in the text is one
 * signal that it is NOT shape 1 (shape 1 never contains a literal newline).
 *
 * That signal alone is not enough, though: the saved-rows pipeline
 * (workspaceSavedAnalysis.js's textLines()) splits any `\n`-joined saved
 * text into SEPARATE entries — one per line — before this module ever sees
 * it. So a single MacroGemDashboard-shaped save arrives here not as one
 * `\n`-joined blob but as up to five independent single-line entries:
 * "<title>", "סוג: X", "פרטים: Y", "נכסים: Z", "קטליסט: W". None of those
 * contain a literal `\n` any more, so the `\n` check alone would let the
 * four labeled fragments slip through as (trivially, mostly-empty) "valid"
 * Layer-1 rows — exactly the all-"—" garbage rows this parser exists to
 * avoid. The second check below rejects any segment carrying one of those
 * four foreign labels, which formatMorningBriefOpportunityText (Layer 1)
 * never produces — its own labels are always כניסה/סטופ/יעד/טווח/ביטחון/
 * יחס סיכון/סיכוי. A bare, label-free single-segment fragment (e.g. just
 * "רוטציה לטכנולוגיה", the title line with nothing else) is structurally
 * identical to a legitimate no-ticker Layer-1 row and is accepted as such —
 * that ambiguity is irreducible from text shape alone and is already the
 * approved behavior for a genuine no-trade-plan Layer-1 row.
 *
 * KNOWN OPEN FINDING (found in live QA, NOT fixed here — see the
 * 2026-08-31 fix-pass report): a THIRD producer path reaches this module
 * with a bare, field-free single segment that LOOKS identical to the
 * legitimate no-ticker case above, but isn't one. SpecializedContentRenderer
 * .jsx's evening-brief flow saves raw `universalTabs.specialized
 * .opportunities` objects (the same {ticker, title, detail, entry, stop,
 * target, rrRatio, timeframe, confidence} shape formatMorningBriefOpportunityText
 * formats) through `formatBulkItemText` (universalTabBulkItems.js) instead —
 * a generic one-field-wins formatter whose priority list (text/title/
 * content/summary/.../setup/pattern) does not include entry/stop/target/
 * timeframe/ticker at all. The result is a bare fragment (just the idea's
 * title, with entry/stop/target/ticker silently discarded before this
 * module ever sees the text) that this module cannot tell apart from a
 * genuine, intentional no-trade-plan Layer-1 row (case 1 above with no
 * ticker and no trade-plan fields) — both are, by the time they reach here,
 * one bare segment with no ticker and no field labels. Rejecting every bare
 * single segment to force it into the Layer-2 raw-text fallback would also
 * misclassify every genuine no-trade-plan row that way, which is not an
 * improvement — it trades one cosmetic issue (sparse "—" columns on a row
 * that legitimately has no trade plan) for a real regression (a real,
 * already-approved simple table row losing its table formatting). Recovering
 * the discarded fields isn't possible from text shape alone either way — the
 * data loss happens upstream in formatBulkItemText, outside this file. Left
 * unresolved pending an explicit decision on which upstream file to change.
 */
import { isTickerLike } from '@/utils/workspaceStockItems';

const FIELD_LABELS = ['כניסה', 'סטופ', 'יעד', 'יחס סיכון/סיכוי', 'טווח', 'ביטחון'];
const FIELD_RE = new RegExp(`^(${FIELD_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})\\s*:\\s*(.+)$`);

// Labels formatOpportunityItem (MacroGemDashboard.jsx) uses — never produced
// by formatMorningBriefOpportunityText. Any segment carrying one of these
// means this text (or, after textLines() fragmentation, this line) came
// from the other producer, not the " · "+trade-plan-prefix shape.
const FOREIGN_LABEL_RE = /^(סוג|פרטים|נכסים|קטליסט)\s*:/;

/**
 * @param {string} text
 * @returns {{ ticker: string|null, setup: string|null, entry: string|null,
 *   stop: string|null, target: string|null, rrRatio: string|null,
 *   timeframe: string|null, confidence: string|null } | null}
 */
export function parseOpportunityRowLayer1(text) {
  if (!text || typeof text !== 'string') return null;
  if (text.includes('\n')) return null;

  const parts = text.split(' · ').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some((part) => FOREIGN_LABEL_RE.test(part))) return null;

  let ticker = null;
  let startIdx = 0;
  if (isTickerLike(parts[0].toUpperCase())) {
    ticker = parts[0].toUpperCase();
    startIdx = 1;
  }

  const fields = {};
  const setupParts = [];
  for (let i = startIdx; i < parts.length; i += 1) {
    const match = parts[i].match(FIELD_RE);
    if (match) fields[match[1]] = match[2].trim();
    else setupParts.push(parts[i]);
  }

  return {
    ticker,
    setup: setupParts.join(' · ') || null,
    entry: fields['כניסה'] || null,
    stop: fields['סטופ'] || null,
    target: fields['יעד'] || null,
    rrRatio: fields['יחס סיכון/סיכוי'] || null,
    timeframe: fields['טווח'] || null,
    confidence: fields['ביטחון'] || null,
  };
}
