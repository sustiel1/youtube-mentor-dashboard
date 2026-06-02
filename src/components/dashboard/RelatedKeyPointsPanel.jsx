import { useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Link2 } from "lucide-react";
import { loadVideos } from "@/services/videoStorage";

function normalizeTags(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((t) => String(t || "").trim().toLowerCase())
    .filter(Boolean);
}

function computeRelated(currentVideoId, currentTags) {
  if (!currentTags.length) return [];
  const allVideos = loadVideos();
  const results = [];

  for (const v of allVideos) {
    if (v.id === currentVideoId) continue;
    const vTags = normalizeTags([...(v.tags || []), ...(v.aiTags || [])]);
    const shared = vTags.filter((t) => currentTags.includes(t));
    if (!shared.length) continue;

    const kps = Array.isArray(v.keyPoints) ? v.keyPoints : [];
    for (const kp of kps) {
      const text = String(kp ?? "").trim();
      if (!text) continue;
      results.push({
        id: `${v.id}::${text.slice(0, 40)}`,
        text,
        videoTitle: String(v.title || "").trim() || "סרטון ללא כותרת",
        sharedTags: shared,
        sharedCount: shared.length,
      });
    }
  }

  results.sort((a, b) => b.sharedCount - a.sharedCount || a.videoTitle.localeCompare(b.videoTitle, "he"));
  return results;
}

export default function RelatedKeyPointsPanel({ open, onClose, currentVideoId, currentTags, currentKeyPoint }) {
  const normalizedTags = useMemo(() => normalizeTags(currentTags), [currentTags]);

  const results = useMemo(
    () => (open ? computeRelated(currentVideoId, normalizedTags) : []),
    [open, currentVideoId, normalizedTags]
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-start justify-end"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-[1] h-full w-full max-w-xl bg-white dark:bg-zinc-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-zinc-700 bg-indigo-50 dark:bg-indigo-950/30">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="h-4 w-4 text-indigo-600 shrink-0" />
              <h2 className="text-base font-semibold text-indigo-900 dark:text-indigo-100">ידע קשור</h2>
              <span className="text-xs text-indigo-500 dark:text-indigo-400">
                {results.length} תוצאות
              </span>
            </div>
            {currentKeyPoint && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                "{currentKeyPoint}"
              </p>
            )}
            {normalizedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {normalizedTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
              <Link2 className="h-8 w-8 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                לא נמצא ידע קשור בהתבסס על ה-tags
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                הוסף tags לסרטון כדי לגלות קשרים
              </p>
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-800/60 px-4 py-3 space-y-2"
              >
                <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {item.text}
                </p>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[60%]" title={item.videoTitle}>
                    {item.videoTitle}
                  </span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {item.sharedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-5 py-2.5 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-400 dark:text-slate-500 text-center">
            ממוין לפי מספר tags משותפים — {results.length} פריטים
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
