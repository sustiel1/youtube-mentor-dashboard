import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FolderOpen, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { openObsidianUrl } from "@/lib/obsidianExport";
import {
  buildObsidianOpenUrl,
  buildObsidianVaultRootUrl,
  clearObsidianSettings,
  getObsidianSettings,
  saveObsidianSettings,
} from "@/lib/obsidianVaultConfig";

export function ObsidianSettingsDialog({
  open,
  onOpenChange,
  filePath = "",
  onSaved,
}) {
  const [vaultName, setVaultName] = useState("");
  const [vaultPath, setVaultPath] = useState("");

  useEffect(() => {
    if (!open) return;
    const settings = getObsidianSettings();
    setVaultName(settings.vaultName);
    setVaultPath(settings.vaultPath);
  }, [open]);

  const activeSettings = useMemo(() => getObsidianSettings(), [open, vaultName, vaultPath]);
  const savedFileUrl = buildObsidianOpenUrl(filePath, vaultName || activeSettings.vaultName);
  const vaultRootUrl = buildObsidianVaultRootUrl(vaultName || activeSettings.vaultName);

  const handleSave = () => {
    const saved = saveObsidianSettings({ vaultName, vaultPath });
    setVaultName(saved.vaultName);
    setVaultPath(saved.vaultPath);
    onSaved?.(saved);
    toast.success(`הגדרות Obsidian נשמרו (${saved.vaultName})`);
  };

  const handleReset = () => {
    const reset = clearObsidianSettings();
    setVaultName(reset.vaultName);
    setVaultPath(reset.vaultPath);
    onSaved?.(reset);
    toast.success("הגדרות Obsidian אופסו לברירת המחדל");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Obsidian Settings</DialogTitle>
          <DialogDescription>
            הגדר כאן פעם אחת את ה-vault האמיתי של Obsidian. כל Save/Open flow ישתמש בהגדרות האלה.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 text-sm dark:border-violet-800/40 dark:bg-violet-950/20">
            <div className="font-semibold text-violet-900 dark:text-violet-100">Active vault</div>
            <div className="mt-1 text-violet-800 dark:text-violet-200">{activeSettings.vaultName}</div>
            {activeSettings.vaultPath ? (
              <div className="mt-1 text-xs text-violet-700 dark:text-violet-300">{activeSettings.vaultPath}</div>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Vault Name</label>
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder="למשל: Knowledge-Base"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Optional Vault Path</label>
            <input
              type="text"
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              placeholder="למשל: C:\\Users\\11\\Documents\\Knowledge-Base"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              הנתיב המקומי לא נכנס ל-`obsidian://`, אבל עוזר לבדוק ידנית שה-vault הרשום ב-Obsidian תואם לתיקייה הנכונה.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="font-semibold text-slate-900 dark:text-zinc-100">Connection QA</div>
            <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-zinc-300">
              <div><span className="font-semibold">Vault root URL:</span> {vaultRootUrl}</div>
              {filePath ? <div><span className="font-semibold">Saved file URL:</span> {savedFileUrl}</div> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const result = openObsidianUrl(vaultRootUrl, { bypassDedupe: true });
                  console.log("[ObsidianSettings][TestConnection]", { vaultRootUrl, result });
                  toast.info("Test Obsidian Connection", { description: vaultRootUrl });
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                <ExternalLink className="h-4 w-4" />
                Test Obsidian Connection
              </button>
              <button
                type="button"
                onClick={() => {
                  const result = openObsidianUrl(vaultRootUrl, { bypassDedupe: true });
                  console.log("[ObsidianSettings][OpenVaultRoot]", { vaultRootUrl, result });
                  toast.info("Open Vault Root", { description: vaultRootUrl });
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/30"
              >
                <FolderOpen className="h-4 w-4" />
                Open Vault Root
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            אפס לברירת מחדל
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <Save className="h-4 w-4" />
            שמור הגדרות
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
