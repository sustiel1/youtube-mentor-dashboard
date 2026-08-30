/**
 * Sector-row sentiment pill tone for SavedSectorRowsTable.
 *
 * Built directly on `resolveSectorSentimentPresentation`
 * (src/lib/sectorTablePresentation.js) — the SAME exact-match resolver
 * already used by the live sector table's SectorSentimentCell
 * (src/components/dashboard/MarketSectorTable.jsx). Reused, not duplicated:
 * it does plain equality checks against a fixed enum (into/out/positive/up/
 * negative/down), so — unlike stockRowText.js's sentiment handling — there is
 * no substring-collision risk to work around here.
 *
 * Deliberately does NOT chase SectorSentimentCell's own secondary fallback
 * (BriefSentimentCell, which re-infers tone from Hebrew/English keyword
 * substrings when the exact-match misses). That fallback's substring
 * matching carries its own collision risk profile — the same class of issue
 * fixed in stockRowText.js for "פעולה"/"עולה" — and re-implementing it here
 * would import that risk into a table that doesn't otherwise have it. When
 * the exact match misses, this returns null and the caller shows the plain
 * translated label with no color, rather than guessing a tone.
 */
import { resolveSectorSentimentPresentation } from './sectorTablePresentation.js';

export function getSectorRowSentimentTone(rawValue) {
  const presentation = resolveSectorSentimentPresentation(rawValue);
  if (!presentation.tone) return null;

  if (presentation.tone === 'positive') {
    return {
      label: presentation.displayValue,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      dotClassName: 'bg-emerald-500',
    };
  }
  return {
    label: presentation.displayValue,
    className: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    dotClassName: 'bg-orange-500',
  };
}

/** Plain translated label for display when no exact-match tone applies (still shown — never dropped). */
export function getSectorRowSentimentLabel(rawValue) {
  return resolveSectorSentimentPresentation(rawValue).displayValue;
}
