import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openGeminiGemUrl } from "@/lib/gemsConfig";

/**
 * Shown when clipboard copy fails before opening a Gemini Gem shortcut.
 */
export function TranscriptGemFallbackDialog({ open, onOpenChange, transcriptText = "", gemUrl }) {
  const handleCopy = async () => {
    if (!transcriptText) {
      toast.error("אין תמלול להעתקה");
      return;
    }
    try {
      await navigator.clipboard.writeText(transcriptText);
      toast.success("התמלול הועתק ללוח");
    } catch {
      toast.error("לא ניתן להעתיק — בחר והעתק ידנית מהתיבה");
    }
  };

  const handleOpenGem = () => {
    if (!openGeminiGemUrl(gemUrl)) {
      toast.info("הפופ-אפ נחסם — פתח את הג׳ם ידנית בדפדפן");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl z-[220]" aria-describedby="transcript-gem-fallback-desc">
        <DialogHeader>
          <DialogTitle>העתקת תמלול לג׳מיני</DialogTitle>
          <DialogDescription id="transcript-gem-fallback-desc">
            לא ניתן היה להעתיק אוטומטית. העתק את התמלול והדבק בג׳ם הפוליטי.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900">
          <pre className="whitespace-pre-wrap break-words px-4 py-3 text-sm leading-7 text-slate-800 dark:text-zinc-100">
            {transcriptText || "אין תמלול"}
          </pre>
        </div>

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-start">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            העתק תמלול
          </button>
          <button
            type="button"
            onClick={handleOpenGem}
            className="rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40 transition-colors"
          >
            פתח ג׳ם פוליטי
          </button>
          <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            סגור
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
