// Small popup for attaching a note (+screenshots) to one specific list/checklist
// row. Just a Dialog shell around the existing NoteEditor, scoped by rowId —
// all the actual text/image/paste logic lives in NoteEditor, reused as-is.
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoteEditor } from "./NoteEditor";

export function RowNoteModal({ open, onOpenChange, videoId, rowId, rowLabel }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">הערה לשורה</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-4 space-y-3">
          {rowLabel && (
            <p className="text-xs text-slate-500 dark:text-zinc-400 text-right leading-snug line-clamp-2">
              {rowLabel}
            </p>
          )}
          <NoteEditor videoId={videoId} rowId={rowId} rowLabel={rowLabel} hideEmptyState />
        </div>
      </DialogContent>
    </Dialog>
  );
}
