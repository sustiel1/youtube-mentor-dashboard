import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import { toast } from "sonner";

/**
 * Shown when navigator.clipboard.writeText fails in handleOpenGem.
 * Displays the full GEM prompt in a readonly textarea so the user can copy manually.
 */
export function AppBuilderPromptFallbackDialog({ open, onOpenChange, promptText }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      toast.success("הפרומפט הועתק");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Select all text in the textarea as last resort
      const ta = document.getElementById("app-builder-prompt-fallback-textarea");
      ta?.select();
      toast.info("בחר הכל (Ctrl+A) והעתק ידנית");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[360] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          onPointerDownOutside={(e) => e.preventDefault()}
          className="fixed left-[50%] top-[50%] z-[370] w-full max-w-[620px] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="text-right text-base font-semibold text-slate-900 dark:text-zinc-100">
            העתקה אוטומטית נכשלה — העתק ידנית
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-0.5 text-right text-xs text-slate-500 dark:text-zinc-400">
            הדפדפן חסם גישה ללוח. לחץ על כפתור ההעתקה למטה, או בחר הכל (Ctrl+A) והעתק ידנית. לאחר ההעתקה הדבק ב-GEM.
          </DialogPrimitive.Description>

          <textarea
            id="app-builder-prompt-fallback-textarea"
            dir="ltr"
            readOnly
            rows={16}
            value={promptText}
            onClick={(e) => e.target.select()}
            className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-[11px] text-slate-800 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500">
              {promptText?.length?.toLocaleString()} תווים
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                סגור
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "הועתק!" : "העתק פרומפט"}
              </button>
            </div>
          </div>

          <DialogPrimitive.Close className="absolute left-4 top-4 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
            <span className="sr-only">סגור</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
