import { useEffect, useRef } from "react";
import ReactDOM from "react-dom";

export function SummaryTextSaveMenu({ coords, text, sectionLabel, isPolitical, onSave, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const safeTop = Math.max(60, (coords.y || 0) - 8);
  const safeLeft = Math.min((coords.x || 0), window.innerWidth - 210);

  const menu = (
    <div
      ref={ref}
      dir="rtl"
      style={{ position: "fixed", top: safeTop, left: safeLeft, zIndex: 9999, transform: "translateY(-100%)" }}
      className="rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden min-w-[170px] dark:border-zinc-700 dark:bg-zinc-950"
    >
      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-zinc-800">
        <p className="text-[10px] text-slate-400 dark:text-zinc-500 text-right truncate max-w-[180px]">
          &quot;{text.length > 45 ? text.slice(0, 45) + "…" : text}&quot;
        </p>
      </div>
      <button
        type="button"
        onClick={() => onSave("brain")}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-right text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-900 transition-colors"
      >
        <span className="shrink-0 text-sm">🧠</span>
        <span>שמור למוח</span>
      </button>
      <button
        type="button"
        onClick={() => onSave("obsidian")}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-right text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-900 transition-colors"
      >
        <span className="shrink-0 text-sm">📁</span>
        <span>שמור ל-Obsidian</span>
      </button>
      <button
        type="button"
        onClick={() => onSave("workspace")}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-right text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-900 transition-colors"
      >
        <span className="shrink-0 text-sm">⭐</span>
        <span>שמור ל-Workspace</span>
      </button>
      {isPolitical && (
        <button
          type="button"
          onClick={() => onSave("opponent")}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-right text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 border-t border-slate-100 dark:border-zinc-800 transition-colors"
        >
          <span className="shrink-0 text-sm">⚔️</span>
          <span>שמור כדעת האויב</span>
        </button>
      )}
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
}
