import { useState } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";
import { useWorkspaceDangerZone } from "@/hooks/useWorkspaceDangerZone";

/**
 * Shared "פעולות נוספות" danger-zone menu — delete-all-visible,
 * delete-all-workspace, delete-duplicates, delete-archived.
 *
 * visibleItems/deleteAllItems are optional: pass them to enable the
 * corresponding action, omit them to leave it out entirely. This lets a
 * scoped view (StockWatchlistView) opt into only the two cleanup actions
 * without exposing a workspace-wide "delete everything" button that would
 * be misleading given it only ever sees a filtered item subset.
 *
 * duplicateCount/archivedCount are always computed over `allItems` — pass
 * the true full library there for a workspace-wide cleanup, or an
 * already-scoped subset to scope cleanup to that view.
 */
export function DangerZoneMenu({
  allItems,
  visibleItems = null,
  deleteItems,
  deleteAllItems = null,
  onAfterDelete = () => {},
  triggerClassName,
}) {
  const [open, setOpen] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmWorkspace, setConfirmWorkspace] = useState(false);
  const [confirmDuplicates, setConfirmDuplicates] = useState(false);
  const [confirmArchived, setConfirmArchived] = useState(false);

  const { duplicateCount, archivedCount, deleteDuplicates, deleteArchived } =
    useWorkspaceDangerZone(allItems, deleteItems);

  function handleConfirmVisible() {
    const ids = visibleItems.map(i => i.id);
    if (!ids.length) return;
    deleteItems(ids);
    toast.success(`נמחקו ${ids.length} פריטים מה-Workspace`);
    onAfterDelete();
  }

  function handleConfirmWorkspace() {
    const count = allItems.length;
    if (!count) return;
    deleteAllItems();
    toast.success(`נמחקו ${count} פריטים מה-Workspace`);
    onAfterDelete();
  }

  function handleConfirmDuplicates() {
    const count = deleteDuplicates();
    if (count) toast.success(`נמחקו ${count} פריטים כפולים מה-Workspace`);
    onAfterDelete();
  }

  function handleConfirmArchived() {
    const count = deleteArchived();
    if (count) toast.success(`נמחקו ${count} פריטים בארכיון מה-Workspace`);
    onAfterDelete();
  }

  const hasUpperActions = !!visibleItems || !!deleteAllItems;

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          title="פעולות נוספות"
          className={
            triggerClassName ||
            "rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1.5 text-slate-400 hover:text-slate-600 hover:border-slate-300 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
          }
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {open && (
          <div
            className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 z-50"
            dir="rtl"
            onMouseLeave={() => setOpen(false)}
          >
            {visibleItems && (
              <button
                type="button"
                disabled={visibleItems.length === 0}
                onClick={() => { setOpen(false); setConfirmVisible(true); }}
                className="w-full text-right px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Trash2 className="h-3.5 w-3.5" />
                מחק הכל בתצוגה הנוכחית ({visibleItems.length})
              </button>
            )}
            {deleteAllItems && (
              <button
                type="button"
                disabled={allItems.length === 0}
                onClick={() => { setOpen(false); setConfirmWorkspace(true); }}
                className="w-full text-right px-3 py-2 text-xs text-red-700 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Trash2 className="h-3.5 w-3.5" />
                מחק את כל ה-Workspace ({allItems.length})
              </button>
            )}
            {hasUpperActions && <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />}
            <button
              type="button"
              disabled={duplicateCount === 0}
              onClick={() => { setOpen(false); setConfirmDuplicates(true); }}
              className="w-full text-right px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחק כפולים ({duplicateCount})
            </button>
            <button
              type="button"
              disabled={archivedCount === 0}
              onClick={() => { setOpen(false); setConfirmArchived(true); }}
              className="w-full text-right px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחק פריטים בארכיון ({archivedCount})
            </button>
          </div>
        )}
      </div>

      {visibleItems && (
        <ConfirmDialog
          open={confirmVisible}
          onOpenChange={setConfirmVisible}
          title="מחיקת כל הפריטים בתצוגה"
          description={`אתה עומד למחוק ${visibleItems.length} פריטים שמוצגים כרגע מה-Workspace בלבד. פריטים שלא מופיעים בסינון הנוכחי לא יימחקו. להמשיך?`}
          confirmLabel={`מחק ${visibleItems.length} פריטים`}
          danger
          onConfirm={handleConfirmVisible}
        />
      )}

      {deleteAllItems && (
        <ConfirmDialog
          open={confirmWorkspace}
          onOpenChange={setConfirmWorkspace}
          title="⚠️ מחיקת כל ה-Workspace"
          description={`פעולה זו תמחק את כל ${allItems.length} פריטי ה-Workspace בלבד. היא לא תמחק Brain, KnowledgeItems או סרטונים מקוריים. כדי להמשיך הקלד: מחק הכל`}
          confirmLabel="מחק את כל ה-Workspace"
          danger
          requireTypedWord="מחק הכל"
          onConfirm={handleConfirmWorkspace}
        />
      )}

      <ConfirmDialog
        open={confirmDuplicates}
        onOpenChange={setConfirmDuplicates}
        title={`למחוק ${duplicateCount} פריטים כפולים?`}
        description="פריטים עם תוכן זהה שנשמרו יותר מפעם אחת. מכל קבוצת כפילויות יישמר רק העותק הישן ביותר (הראשון שנשמר) — שאר העותקים יימחקו מה-Workspace בלבד. Brain / KnowledgeItems לא יושפעו."
        confirmLabel={`מחק ${duplicateCount} כפולים`}
        danger
        onConfirm={handleConfirmDuplicates}
      />

      <ConfirmDialog
        open={confirmArchived}
        onOpenChange={setConfirmArchived}
        title={`למחוק ${archivedCount} פריטים מהארכיון?`}
        description="כל הפריטים שהועברו לארכיון יימחקו לצמיתות מה-Workspace בלבד. Brain / KnowledgeItems לא יושפעו. הפעולה בלתי הפיכה."
        confirmLabel={`מחק ${archivedCount} פריטים`}
        danger
        onConfirm={handleConfirmArchived}
      />
    </>
  );
}
