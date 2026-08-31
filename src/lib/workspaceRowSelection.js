/**
 * Shared row-selection wiring for the six saved-rows renderers (AnalysisList,
 * SavedMarketRowsTable, SavedStockRowsTable, SavedSectorRowsTable,
 * SavedOpportunityRowsTable, SavedNewsRows).
 *
 * Each renderer already receives `entries` built by buildTextSections()
 * (workspaceSavedAnalysis.js), where every entry carries `recordIds` — the
 * underlying persisted workspace item id(s) that produced that visual row.
 * Selection itself is keyed by those persisted record ids (the SAME
 * `selectedIds`/`onToggleGroup` pair WorkspaceFocusedVideoCard.jsx already
 * uses for the section-level "select all" checkbox), not by row index — so
 * this is a thin adapter, not a second selection model.
 *
 * One deliberate consequence: when a single saved item's text splits into
 * several visual lines (multiple bullet entries sharing the same
 * `recordIds`), every one of those rows shares the same checked state and
 * toggling any one of them toggles all of them together — they are, after
 * all, the same underlying record. This is intentional, not a bug to guard
 * against: it keeps "select a row" meaning "select the record behind it",
 * consistently, everywhere a record happens to render as more than one row.
 */

/**
 * @param {object} params
 * @param {string|string[]|null|undefined} params.recordIds - the entry's own recordIds (or a single id)
 * @param {Set<string>} [params.selectedIds] - current selection, from the section
 * @param {(ids: string[], selected: boolean) => void} [params.onToggleGroup] - toggles the given ids together
 * @param {string} [params.ariaLabel]
 * @returns {{checked: boolean, onChange: () => void, 'aria-label': string} | null}
 *   null when selection isn't wired for this render (no selectedIds/onToggleGroup)
 *   or the entry has no recordIds to select — callers should render no checkbox in that case.
 */
export function rowSelectionProps({ recordIds, selectedIds, onToggleGroup, ariaLabel = 'בחר שורה' }) {
  if (!selectedIds || typeof onToggleGroup !== 'function') return null;
  const ids = (Array.isArray(recordIds) ? recordIds : [recordIds]).filter(Boolean);
  if (ids.length === 0) return null;
  const checked = ids.every((id) => selectedIds.has(id));
  return {
    checked,
    onChange: () => onToggleGroup(ids, !checked),
    'aria-label': ariaLabel,
  };
}
