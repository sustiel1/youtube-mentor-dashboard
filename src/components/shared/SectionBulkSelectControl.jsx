import { getSectionBulkSelectionState } from '@/lib/sectionBulkSelection';

export function SectionBulkSelectControl({
  items,
  bulkSelection,
  sectionLabel = '',
  className = '',
}) {
  const state = getSectionBulkSelectionState(items, bulkSelection?.multiSelected);
  if (
    state.totalCount === 0
    || !bulkSelection?.onSectionSelect
    || !bulkSelection?.onSectionDeselect
  ) {
    return null;
  }

  const accessibleLabel = state.allSelected
    ? `בטל את בחירת כל הפריטים ב${sectionLabel}`
    : state.partiallySelected
      ? `נבחרו ${state.selectedCount} מתוך ${state.totalCount} פריטים ב${sectionLabel}`
      : `בחר את כל הפריטים ב${sectionLabel}`;

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.allSelected) {
      bulkSelection.onSectionDeselect(state.selectableItems.map((item) => item.id));
    } else {
      bulkSelection.onSectionSelect(state.selectableItems);
    }
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state.ariaChecked}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onClick={handleClick}
      onKeyDown={(event) => event.stopPropagation()}
      className={`inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 ${className}`.trim()}
      data-section-select-all
    >
      <span aria-hidden="true">{state.allSelected ? '☑' : (state.partiallySelected ? '◩' : '☐')}</span>
      <span>{state.label}</span>
    </button>
  );
}
