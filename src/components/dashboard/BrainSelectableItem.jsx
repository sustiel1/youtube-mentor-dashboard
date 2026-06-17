import { useState } from "react";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { UniversalTabSelectRow } from "@/components/shared/UniversalTabSelectRow";

export function BrainSelectableItem({
  id,
  text,
  isSelected,
  onToggle,
  onSaveSingle,
  onCopy,
  // saved state — show ✓ instead of 🧠 when already saved to Brain
  isSaved = false,
  // opponent-view props (political only)
  isPolitical = false,
  isOpponent = false,
  onToggleOpponent,
  opponentResponse = null,
  onSaveResponse,
}) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [responseDraft, setResponseDraft] = useState(opponentResponse || "");

  const handleSaveWithNote = () => {
    onSaveSingle?.(note);
    setShowNote(false);
    setNote("");
  };

  const handleSaveResponse = () => {
    onSaveResponse?.(id, responseDraft);
    setShowResponse(false);
  };

  const checkboxButton = (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded border-2 text-[9px] font-bold transition-all",
        "opacity-100 md:opacity-0 md:group-hover:opacity-100",
        isSelected && "!opacity-100 border-indigo-500 bg-indigo-500 text-white",
        !isSelected && "border-slate-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
      )}
    >
      {isSelected ? "✓" : ""}
    </button>
  );

  const hoverActions = (
    <>
      {isPolitical && (
        <button
          type="button"
          onClick={() => onToggleOpponent?.()}
          title={isOpponent ? "הסר סימון דעת האויב" : "סמן כדעת האויב"}
          className={cn(
            "p-1 rounded-lg text-sm leading-none transition-colors",
            isOpponent
              ? "text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/40 !opacity-100"
              : "text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          )}
        >
          ⚔️
        </button>
      )}
      {isOpponent && (
        <button
          type="button"
          onClick={() => { setShowResponse(p => !p); setResponseDraft(opponentResponse || ""); }}
          title="הוסף תשובה"
          className="p-1 rounded-lg text-rose-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-sm leading-none !opacity-100"
        >
          💬
        </button>
      )}
      {isSaved ? (
        <span
          title="נשמר למוח"
          className="px-1 py-0.5 rounded text-emerald-600 dark:text-emerald-400 text-xs font-medium leading-none whitespace-nowrap"
        >
          ✓ נשמר
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onSaveSingle?.("")}
          title="שמור למוח"
          className="p-1 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors text-sm leading-none"
        >
          🧠
        </button>
      )}
      <button
        type="button"
        onClick={() => setShowNote(p => !p)}
        title="הוסף הערה"
        className="p-1 rounded-lg text-slate-300 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-sm leading-none"
      >
        📝
      </button>
      <button
        type="button"
        onClick={() => onCopy?.()}
        title="העתק"
        className="p-1 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <Copy className="h-3 w-3" />
      </button>
    </>
  );

  return (
    <div className="group relative">
      <UniversalTabSelectRow
        className={cn(
          "rounded-xl px-2 py-2 transition-all",
          isOpponent
            ? "border border-rose-300 bg-rose-50/70 dark:border-rose-800/60 dark:bg-rose-950/20"
            : isSelected
              ? "border border-indigo-300 bg-indigo-50/80 dark:border-indigo-700 dark:bg-indigo-950/40"
              : "border border-transparent hover:border-slate-200 hover:bg-slate-50/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/40"
        )}
        checkbox={checkboxButton}
        actions={(
          <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {hoverActions}
          </div>
        )}
      >
        <span
          className={cn(
            "block text-sm leading-relaxed",
            isOpponent
              ? "text-rose-800 dark:text-rose-300"
              : isSelected
                ? "text-indigo-700 dark:text-indigo-300"
                : "text-slate-700 dark:text-zinc-300"
          )}
        >
          {isOpponent && <span className="text-rose-400 mr-1 text-xs">⚔️</span>}
          {text}
        </span>
      </UniversalTabSelectRow>

      {/* Inline note input */}
      {showNote && (
        <div className="mt-1 flex items-start gap-2 pr-6 pb-2" dir="rtl">
          <textarea
            autoFocus
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="הוסף הערה לפריט..."
            rows={2}
            dir="rtl"
            className="flex-1 rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-xs text-right placeholder:text-amber-300 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={handleSaveWithNote}
              className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600 whitespace-nowrap"
            >
              שמור + הערה
            </button>
            <button
              type="button"
              onClick={() => { setShowNote(false); setNote(""); }}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Inline counter-response input (opponent view) */}
      {showResponse && isOpponent && (
        <div className="mt-1 flex items-start gap-2 pr-6 pb-2" dir="rtl">
          <textarea
            autoFocus
            value={responseDraft}
            onChange={e => setResponseDraft(e.target.value)}
            placeholder="כתוב תשובה אפשרית מהזווית שלי..."
            rows={2}
            dir="rtl"
            className="flex-1 rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-1.5 text-xs text-right placeholder:text-rose-300 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-300 resize-none"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={handleSaveResponse}
              className="rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-600 whitespace-nowrap"
            >
              שמור תשובה
            </button>
            <button
              type="button"
              onClick={() => setShowResponse(false)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Saved response preview */}
      {!showResponse && isOpponent && opponentResponse && (
        <div className="mt-1 pr-6 pb-1" dir="rtl">
          <div className="rounded-lg border border-rose-100 bg-white/80 px-2.5 py-1.5 dark:border-rose-900/40 dark:bg-zinc-900/60">
            <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-400">💬 תשובה: </span>
            <span className="text-[11px] text-slate-700 dark:text-zinc-300">{opponentResponse}</span>
          </div>
        </div>
      )}
    </div>
  );
}
