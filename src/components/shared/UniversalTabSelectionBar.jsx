/**
 * Dialog-level bulk action bar — matches Chapters tab footer (dark sticky).
 */
import { ObsidianFooterLabel } from '@/components/shared/ObsidianIcon';
export function UniversalTabSelectionBar({
  count = 0,
  onBrain,
  onObsidian,
  onWorkspace,
  onCopy,
  onClear,
  onAiAnalyze,
  onPerplexity,
  onPerplexityQuestions,
  onFixedQuestions,
  onCsvExport,
  disabled = false,
}) {
  if (count === 0) return null;

  return (
    <div
      dir="rtl"
      className="flex-shrink-0 flex items-center gap-2 justify-between border-t border-zinc-800 bg-zinc-900 px-4 py-3 flex-wrap"
    >
      <button
        type="button"
        onClick={onClear}
        disabled={disabled}
        className="flex items-center gap-1 rounded-xl bg-zinc-700 hover:bg-zinc-600 px-2.5 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 disabled:opacity-50"
      >
        ✕ נקה
      </button>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-white whitespace-nowrap">
          נבחרו {count} פריטים
        </span>
        <div className="w-px h-5 bg-white/20 shrink-0" />
        {onBrain && (
          <button
            type="button"
            disabled={disabled}
            onClick={onBrain}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            🧠 שמור למוח
          </button>
        )}
        {onObsidian && (
          <button
            type="button"
            disabled={disabled}
            onClick={onObsidian}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            <ObsidianFooterLabel iconClassName="text-white" />
          </button>
        )}
        {onWorkspace && (
          <button
            type="button"
            disabled={disabled}
            onClick={onWorkspace}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            ⭐ Workspace
          </button>
        )}
        {onCopy && (
          <button
            type="button"
            disabled={disabled}
            onClick={onCopy}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-600 hover:bg-zinc-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            📋 העתק
          </button>
        )}
        {onCsvExport && (
          <button
            type="button"
            disabled={disabled}
            onClick={onCsvExport}
            className="flex items-center gap-1.5 rounded-xl bg-green-700 hover:bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            📊 ייצוא CSV
          </button>
        )}
        {onAiAnalyze && (
          <button
            type="button"
            disabled={disabled}
            onClick={onAiAnalyze}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            📈 TradingView
          </button>
        )}
        {onFixedQuestions && (
          <button
            type="button"
            disabled={disabled}
            onClick={onFixedQuestions}
            title="שאלות לפי כותרת הסקציה, כולל העתקת הפריט"
            className="flex items-center gap-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            🤖 שאלות ל-AI
          </button>
        )}
      </div>
    </div>
  );
}
