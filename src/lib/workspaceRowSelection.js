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

/**
 * Per-row status-flag adapter (TRADINGBRAIN-WORKSPACE-STATUS-FLAGS-PLACEMENT
 * follow-up): resolves which of a row's underlying persisted item(s) carry an
 * active status flag, using the SAME `entry.recordIds` contract as
 * rowSelectionProps above (in practice always exactly one id per row —
 * buildTextSections() in workspaceSavedAnalysis.js always emits
 * `recordIds: [item.id]` — but this stays defensive/plural like its sibling
 * in case a future producer ever merges rows).
 *
 * `itemsById` is a plain Map<id, item> built by the caller from the same
 * `group.items` the row's content was rendered from (always the live,
 * up-to-date item objects, since group is a memoized derivation of the
 * WorkspaceLibrary `items` state) — not threaded from further up, so no new
 * prop chain is needed just to read flags.
 */
const STATUS_FLAG_FIELD = { favorite: 'isFavorite', important: 'isImportant', mustWatch: 'mustWatchAgain' };
const STATUS_DISPLAY_ORDER = ['favorite', 'important', 'mustWatch'];
const STATUS_PRIORITY_ORDER = ['important', 'mustWatch', 'favorite'];
const STATUS_ACCENT_CLASS = {
  important: 'border-r-red-500 dark:border-r-red-500',
  mustWatch: 'border-r-blue-500 dark:border-r-blue-500',
  favorite: 'border-r-amber-500 dark:border-r-amber-500',
};

export function resolveRowStatus({ recordIds, itemsById }) {
  const ids = (Array.isArray(recordIds) ? recordIds : [recordIds]).filter(Boolean);
  const active = new Set();
  if (itemsById && ids.length > 0) {
    for (const id of ids) {
      const flags = itemsById.get(id)?.flags;
      if (!flags) continue;
      for (const key of STATUS_DISPLAY_ORDER) {
        if (flags[STATUS_FLAG_FIELD[key]]) active.add(key);
      }
    }
  }
  const priorityKey = STATUS_PRIORITY_ORDER.find((key) => active.has(key)) || null;
  return {
    ids,
    activeKeys: STATUS_DISPLAY_ORDER.filter((key) => active.has(key)),
    accentClass: priorityKey ? STATUS_ACCENT_CLASS[priorityKey] : '',
  };
}

/** Builds the `itemsById` map `resolveRowStatus` consumes, from a group's items. */
export function buildItemsById(items = []) {
  return new Map((items || []).filter(Boolean).map((item) => [item.id, item]));
}
