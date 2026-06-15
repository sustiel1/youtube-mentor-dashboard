import { getRelatedGemTemplates } from "@/lib/gemRecommender";
import { cn } from "@/lib/utils";

/**
 * Post-transcript GEM recommendation card.
 * Visual density follows confidencePct thresholds from classifyVideoForGem().
 */
export function GemRecommendationCard({
  recommendation,
  onOpenRecommended,
  onChooseAnother,
  onDismiss,
  opening = false,
}) {
  if (!recommendation?.gemKey) return null;

  const confidencePct = Number(recommendation.confidencePct) || 0;
  const isHigh = confidencePct >= 85;
  const isLow = confidencePct < 70;
  const isVeryLow = confidencePct < 50;
  const relatedTemplates = getRelatedGemTemplates(recommendation.gemKey);

  const shellClass = isHigh
    ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-800/40 dark:bg-emerald-950/25"
    : isLow
      ? "border-amber-200 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-950/25"
      : "border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/40 dark:bg-indigo-950/20";

  return (
    <div
      dir="rtl"
      className={cn("rounded-xl border px-3 py-3 space-y-2.5", shellClass)}
      role="region"
      aria-label="המלצת GEM"
    >
      <div className={cn("flex items-start justify-between gap-2", isHigh && "items-center")}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none shrink-0">{recommendation.gemIcon || "✨"}</span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">🤖 GEM מומלץ</div>
            <div className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">
              {recommendation.gemLabel || recommendation.gemKey}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-left">
          <div className="text-[10px] text-slate-500 dark:text-zinc-400">ביטחון</div>
          <div
            className={cn(
              "text-sm font-bold tabular-nums",
              isHigh && "text-emerald-700 dark:text-emerald-300",
              isLow && !isHigh && "text-amber-700 dark:text-amber-300",
              !isHigh && !isLow && "text-indigo-700 dark:text-indigo-300"
            )}
          >
            {confidencePct}%
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          title="סגור המלצה"
        >
          ✕
        </button>
      </div>

      {!isHigh && recommendation.reason && (
        <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300 text-right">
          {recommendation.reason}
        </p>
      )}

      {isHigh && recommendation.reason && (
        <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 line-clamp-1 text-right">
          {recommendation.reason}
        </p>
      )}

      {!isHigh && relatedTemplates.length > 0 && (
        <div className="text-right">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">תבניות קשורות</div>
          <div className="flex flex-wrap gap-1 justify-end">
            {relatedTemplates.map((label) => (
              <span
                key={label}
                className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {isVeryLow && (
        <div className="rounded-lg border border-amber-300/80 bg-amber-100/60 px-2.5 py-2 text-[11px] font-medium text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200 text-right">
          לא זוהתה תבנית מתאימה בוודאות — מומלץ לבחור GEM ידנית לפני הניתוח.
        </div>
      )}

      {isLow && !isVeryLow && (
        <div className="text-[11px] text-amber-800 dark:text-amber-200 text-right">
          הביטחון נמוך — כדאי לוודא את בחירת ה-GEM לפני המשך העבודה.
        </div>
      )}

      <div className={cn("flex flex-wrap gap-2 justify-end", isHigh && "gap-1.5")}>
        <button
          type="button"
          onClick={onOpenRecommended}
          disabled={opening}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold text-white transition-colors disabled:opacity-50",
            isHigh ? "bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[11px]" : "bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-xs flex-1 sm:flex-none"
          )}
        >
          {opening ? "פותח…" : "פתח GEM מומלץ"}
        </button>
        <button
          type="button"
          onClick={onChooseAnother}
          className={cn(
            "inline-flex items-center justify-center gap-1 rounded-lg border bg-white font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors",
            isHigh ? "border-emerald-200 px-2.5 py-1.5 text-[11px]" : "border-slate-200 px-3 py-2 text-xs"
          )}
        >
          בחר GEM אחר
        </button>
        {!isHigh && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center justify-center rounded-lg border border-transparent px-2 py-2 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            סגור
          </button>
        )}
      </div>
    </div>
  );
}
