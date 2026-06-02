import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ObsidianResaveConfirmDialog({ open, onOpenChange, onCancel, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm" aria-describedby="obsidian-resave-desc">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <span>⚠️</span>
            <span>כבר נשמר</span>
          </DialogTitle>
          <DialogDescription id="obsidian-resave-desc" className="text-sm text-slate-600 dark:text-zinc-300 mt-1">
            הקובץ כבר נשמר ב‑Obsidian.
            <br />
            רוצה לשמור שוב?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row-reverse gap-2 sm:justify-start mt-2">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            שמור שוב
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            ביטול
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
