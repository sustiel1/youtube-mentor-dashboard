import { useState } from "react";
import { Eye, EyeOff, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function SavePreviewModal({
  open,
  onOpenChange,
  video,
  category,
  subCategory,
  path,
  fullContent,
  selectedContent,
  onSaveFull,
  onSaveSelected,
}) {
  const [mode, setMode] = useState("full");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const hasSelected = (selectedContent?.totalItems ?? 0) > 0;
  const current = mode === "full" ? fullContent : selectedContent;

  async function handleConfirm() {
    setSaving(true);
    try {
      if (mode === "full") await onSaveFull?.();
      else await onSaveSelected?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-lg p-0 border-violet-100 dark:border-violet-900/40"
        aria-describedby={undefined}
      >
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-zinc-800 px-6 py-5">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-zinc-50">
            🧠 שמור למוח
          </DialogTitle>
          {video?.title && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400 truncate" dir="auto">
              {video.title}
            </p>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ── Mode toggle ── */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("full")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition-all",
                mode === "full"
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-sm"
                  : "border-slate-200 dark:border-zinc-700 hover:border-violet-200 dark:hover:border-violet-800"
              )}
            >
              <span className="text-2xl">📄</span>
              <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                שמור כסרטון מלא
              </span>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                {fullContent?.totalItems ?? 0} פריטים
              </span>
            </button>

            <button
              type="button"
              onClick={() => hasSelected && setMode("selected")}
              disabled={!hasSelected}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition-all",
                !hasSelected && "opacity-40 cursor-not-allowed",
                mode === "selected"
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm"
                  : "border-slate-200 dark:border-zinc-700 hover:border-emerald-200 dark:hover:border-emerald-800"
              )}
            >
              <span className="text-2xl">🧠</span>
              <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                שמור רק נבחרים
              </span>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                {hasSelected ? `${selectedContent.totalItems} נבחרו` : "אין פריטים נבחרים"}
              </span>
            </button>
          </div>

          {/* ── Path info ── */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-violet-500" />
              <span className="font-mono text-xs text-slate-600 dark:text-zinc-400 truncate break-all">
                {path ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-700 dark:text-zinc-200 font-medium">{category}</span>
              {subCategory && subCategory !== "כללי" && (
                <>
                  <span className="text-slate-400 dark:text-zinc-600">/</span>
                  <span className="text-violet-600 dark:text-violet-400 font-medium">{subCategory}</span>
                </>
              )}
            </div>
          </div>

          {/* ── Content stats ── */}
          {current && Object.keys(current.stats || {}).length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 space-y-1.5">
              {Object.entries(current.stats)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        mode === "full"
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {count}
                    </span>
                    <span className="text-slate-600 dark:text-zinc-400">{key}</span>
                  </div>
                ))}
              <div className="border-t border-slate-200 dark:border-zinc-700 pt-2 flex justify-between text-sm font-bold">
                <span className="text-slate-900 dark:text-zinc-100">{current.totalItems}</span>
                <span className="text-slate-400 dark:text-zinc-500">סה״כ פריטים</span>
              </div>
            </div>
          )}

          {/* ── Preview toggle ── */}
          {current?.markdown && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowPreview((p) => !p)}
                className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 hover:underline"
              >
                {showPreview ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {showPreview ? "הסתר תצוגה מקדימה" : "הצג תצוגה מקדימה (Markdown)"}
              </button>
              {showPreview && (
                <pre className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 p-3 text-xs text-slate-600 dark:text-zinc-400 font-mono whitespace-pre-wrap text-right leading-relaxed">
                  {current.markdown.slice(0, 1500)}
                  {current.markdown.length > 1500 ? "\n\n…" : ""}
                </pre>
              )}
            </div>
          )}

          {/* ── Confirmation hint ── */}
          <p className="rounded-lg bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs text-slate-500 dark:text-zinc-400">
            {mode === "full"
              ? "יישמר כל הניתוח של הסרטון לקובץ אחד ב-Obsidian"
              : "יישמרו רק הפריטים שסימנת"}
          </p>

          {/* ── Actions ── */}
          <div className="flex gap-3 border-t border-slate-200 dark:border-zinc-800 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl border border-slate-200 dark:border-zinc-700 py-2.5 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || !current || (current.totalItems === 0)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-40",
                mode === "full"
                  ? "bg-violet-600 hover:bg-violet-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {saving
                ? "שומר..."
                : mode === "full"
                ? `📄 שמור כסרטון מלא (${current?.totalItems ?? 0})`
                : `🧠 שמור רק נבחרים (${current?.totalItems ?? 0})`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
