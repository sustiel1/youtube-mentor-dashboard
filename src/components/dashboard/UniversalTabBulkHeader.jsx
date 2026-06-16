/**
 * "בחר הכל" row for universal tabs — matches Chapters tab pattern.
 */
export function UniversalTabBulkHeader({
  totalCount = 0,
  selectedCount = 0,
  onSelectAll,
  onClear,
  className = '',
}) {
  if (totalCount === 0) return null;

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 ${className}`}
      dir="rtl"
      data-universal-tab-bulk-header
    >
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors whitespace-nowrap"
        >
          בחר הכל
        </button>
        {selectedCount > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors whitespace-nowrap"
          >
            נקה בחירה ({selectedCount})
          </button>
        )}
      </div>
      <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums whitespace-nowrap">
        {totalCount} פריטים
      </span>
    </div>
  );
}
