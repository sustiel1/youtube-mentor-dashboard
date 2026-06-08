import { Brain, BookOpen, Circle, X } from "lucide-react";

/**
 * §22 BulkSelectionBar — sticky bottom bar shown when items are selected.
 * Design: "נבחרו X פריטים" + Save to Brain + Save to Workspace + Save to Obsidian + Clear.
 *
 * Props:
 *   count        {number}   — number of selected items
 *   onBrain      {function} — save selected to Brain
 *   onWorkspace  {function} — save selected to Workspace
 *   onObsidian   {function} — save selected to Obsidian
 *   onClear      {function} — clear selection
 *   disabled     {boolean}  — disable all actions (e.g. while saving)
 */
export function BulkSelectionBar({ count = 0, onBrain, onWorkspace, onObsidian, onClear, disabled = false }) {
  if (count === 0) return null;

  return (
    <div
      dir="rtl"
      className="sticky bottom-0 z-40 mt-3 flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-sm dark:border-indigo-800/50 dark:bg-zinc-900/95"
    >
      <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
        נבחרו {count} פריטים
      </span>

      <div className="flex items-center gap-1.5">
        {onBrain && (
          <button
            type="button"
            disabled={disabled}
            onClick={onBrain}
            title="שמור ל-Brain"
            className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60 transition-colors"
          >
            <Brain className="h-3.5 w-3.5" />
            <span>🧠 Brain</span>
          </button>
        )}

        {onWorkspace && (
          <button
            type="button"
            disabled={disabled}
            onClick={onWorkspace}
            title="שמור ל-Workspace"
            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>📚 Workspace</span>
          </button>
        )}

        {onObsidian && (
          <button
            type="button"
            disabled={disabled}
            onClick={onObsidian}
            title="שמור ל-Obsidian"
            className="flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/60 transition-colors"
          >
            <Circle className="h-3.5 w-3.5" />
            <span>🟣 Obsidian</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClear}
          title="נקה בחירה"
          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          <span>נקה</span>
        </button>
      </div>
    </div>
  );
}
