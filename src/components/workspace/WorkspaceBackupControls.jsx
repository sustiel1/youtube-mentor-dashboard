import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";
import { getWorkspaceTopics } from "@/lib/workspaceLibraryStore";
import {
  exportWorkspaceBackup,
  parseWorkspaceBackupFile,
  applyWorkspaceBackup,
  getLastWorkspaceBackupInfo,
} from "@/lib/workspaceBackup";

// Soft reminder thresholds — no real scheduling exists (local-only app), so
// this is a status read on render rather than a push notification.
const WARN_AFTER_DAYS = 14;
const WARN_AFTER_NEW_ITEMS = 20;

function formatBackupBadge(lastBackupInfo, currentItemCount) {
  if (!lastBackupInfo) {
    return { text: '⚠ לא גובה מעולם', warn: true };
  }
  const daysSince = Math.floor((Date.now() - new Date(lastBackupInfo.at).getTime()) / 86_400_000);
  const newItemsSince = Math.max(0, currentItemCount - (lastBackupInfo.itemCount || 0));
  const warn = daysSince >= WARN_AFTER_DAYS || newItemsSince >= WARN_AFTER_NEW_ITEMS;
  if (newItemsSince > 0) {
    return { text: `${warn ? '⚠ ' : ''}גובה לפני ${daysSince} ימים · ${newItemsSince} פריטים חדשים`, warn };
  }
  return { text: `${warn ? '⚠ ' : ''}גובה לפני ${daysSince} ימים`, warn };
}

/**
 * Manual JSON export/import for the Workspace Library (items + topics + tab
 * preferences). No Drive/OAuth — local file download/upload only, matching
 * the app's local-first design. `onImported` is called after a successful
 * restore so the parent can reload items/topics/tab-prefs state.
 */
export function WorkspaceBackupControls({ items, onImported }) {
  const fileInputRef = useRef(null);
  const [lastBackupInfo, setLastBackupInfo] = useState(() => getLastWorkspaceBackupInfo());
  const [pendingImport, setPendingImport] = useState(null); // { parsed, currentItemCount, currentTopicCount } | null

  const badge = formatBackupBadge(lastBackupInfo, items.length);

  function handleExport() {
    const payload = exportWorkspaceBackup();
    setLastBackupInfo(getLastWorkspaceBackupInfo());
    toast.success(`גיבוי הורד — ${payload.items.length} פריטים`);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;
    try {
      const parsed = await parseWorkspaceBackupFile(file);
      setPendingImport({
        parsed,
        currentItemCount: items.length,
        currentTopicCount: getWorkspaceTopics().length,
      });
    } catch (err) {
      toast.error(err.message || 'ייבוא הגיבוי נכשל');
    }
  }

  function handleConfirmImport() {
    if (!pendingImport) return;
    const { parsed } = pendingImport;
    applyWorkspaceBackup(parsed);
    onImported?.();
    toast.success(`שוחזרו ${parsed.items.length} פריטים מהגיבוי`);
    setPendingImport(null);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={badge.warn
            ? 'text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap'
            : 'text-[11px] text-slate-400 dark:text-zinc-500 whitespace-nowrap'}
        >
          {badge.text}
        </span>
        <button
          type="button"
          onClick={handleExport}
          title="הורד גיבוי JSON של כל ה-Workspace"
          className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:text-zinc-600 dark:hover:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          title="ייבא גיבוי JSON — יחליף את הספרייה הנוכחית"
          className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:text-zinc-600 dark:hover:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
        >
          <Upload className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileSelected}
          className="hidden"
        />
      </div>

      <ConfirmDialog
        open={!!pendingImport}
        onOpenChange={open => !open && setPendingImport(null)}
        title="לשחזר גיבוי?"
        description={
          pendingImport
            ? `הפעולה תחליף את הספרייה הנוכחית (${pendingImport.currentItemCount} פריטים, ${pendingImport.currentTopicCount} נושאים) בתוכן הגיבוי שנטען (${pendingImport.parsed.items.length} פריטים${pendingImport.parsed.topics ? `, ${pendingImport.parsed.topics.length} נושאים` : ''}${pendingImport.parsed.exportedAt ? `, יוצא בתאריך ${new Date(pendingImport.parsed.exportedAt).toLocaleDateString('he-IL')}` : ''}). הפעולה בלתי הפיכה אלא אם יש לך גיבוי נוסף.`
            : ''
        }
        confirmLabel="שחזר גיבוי"
        danger
        requireTypedWord="שחזר"
        onConfirm={handleConfirmImport}
      />
    </>
  );
}
