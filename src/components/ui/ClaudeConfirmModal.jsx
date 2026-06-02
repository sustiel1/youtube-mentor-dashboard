import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CostBadge } from "@/components/ui/CostBadge";

function getTranscriptMeta(length = 0) {
  if (length < 3000)  return { label: "קצר",   costVariant: "free",   icon: "🟢", costRange: "~$0.002–0.01"  };
  if (length < 12000) return { label: "בינוני", costVariant: "gemini", icon: "🟡", costRange: "~$0.01–0.05"  };
  return                     { label: "ארוך",   costVariant: "claude", icon: "🔴", costRange: "~$0.05–0.15"  };
}

export function ClaudeConfirmModal({
  open,
  onOpenChange,
  transcriptLength = 0,
  modelName = "claude-sonnet-4-6",
  onConfirm,
  onCancel,
}) {
  const meta = getTranscriptMeta(transcriptLength);
  const estimatedTokens = transcriptLength > 0 ? Math.round(transcriptLength / 4).toLocaleString() : "לא ידוע";

  const handleCancel = () => {
    console.log('[ClaudeAPI] confirmation cancelled by user');
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span>⚠️</span>
            אישור הפעלת Claude API
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
          <p>
            פעולה זו משתמשת ב-<strong>Anthropic API</strong> ועלולה לעלות כסף לפי כמות הטוקנים.
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            אם אתה עובד עם Gemini/GEMS בהדבקה ידנית — אין צורך ללחוץ כאן.
          </p>

          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">מודל</span>
              <span className="font-semibold font-mono text-slate-700 dark:text-zinc-200">{modelName}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">אורך תמלול</span>
              <span className="font-semibold">{transcriptLength > 0 ? `${transcriptLength.toLocaleString()} תווים` : "לא ידוע"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">טוקנים משוערים</span>
              <span className="font-semibold">~{estimatedTokens}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">גודל תמלול</span>
              <span className="font-semibold flex items-center gap-1">{meta.icon} {meta.label}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">עלות משוערת</span>
              <span className="font-semibold text-slate-600 dark:text-zinc-300">{meta.costRange}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">ספק</span>
              <CostBadge variant="claude" />
            </div>
          </div>

          <p className="text-xs text-slate-400 dark:text-zinc-500">
            עלות מדויקת תופיע ב-{" "}
            <a
              href="https://console.anthropic.com/settings/usage"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-800"
            >
              Anthropic Console
            </a>
            .
          </p>
        </div>

        <DialogFooter className="flex gap-2 flex-row-reverse justify-start sm:justify-start">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-9 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            המשך בכל זאת
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
