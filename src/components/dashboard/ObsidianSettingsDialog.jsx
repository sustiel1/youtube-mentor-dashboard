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
  getObsidianVaultRequestFields,
  saveObsidianSettings,
  useObsidianSettingsState,
} from "@/lib/obsidianVaultConfig";

function DiagnosticRow({ ok, successLabel, errorLabel }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950/70">
      <span className="font-medium text-slate-700 dark:text-zinc-200">{ok ? successLabel : errorLabel}</span>
      <span className={ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
        {ok ? "✅" : "❌"}
      </span>
    </div>
  );
}

export function ObsidianSettingsDialog({
  open,
  onOpenChange,
  filePath = "",
  onSaved,
}) {
  const activeSettings = useObsidianSettingsState();
  const [vaultName, setVaultName] = useState("");
  const [vaultPath, setVaultPath] = useState("");
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVaultName(activeSettings.vaultName);
    setVaultPath(activeSettings.vaultPath);
  }, [activeSettings.vaultName, activeSettings.vaultPath, open]);

  const effectiveVaultName = useMemo(
    () => String(vaultName || activeSettings.vaultName || "").trim(),
    [activeSettings.vaultName, vaultName]
  );
  const effectiveVaultPath = useMemo(
    () => String(vaultPath || activeSettings.vaultPath || "").trim(),
    [activeSettings.vaultPath, vaultPath]
  );
  const savedFileUrl = buildObsidianOpenUrl(filePath, effectiveVaultName);
  const vaultRootUrl = buildObsidianVaultRootUrl(effectiveVaultName);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    const fetchDiagnostics = async () => {
      setDiagnosticsLoading(true);
      try {
        const { vaultName: settingsVaultName, vaultPath: settingsVaultPath } = getObsidianVaultRequestFields();
        const res = await fetch("/api/vault/diagnostics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vaultName: effectiveVaultName || settingsVaultName,
            vaultPath: effectiveVaultPath || settingsVaultPath,
            filePath,
            createFolder: false,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setDiagnostics(data);
      } catch (error) {
        if (!cancelled) {
          setDiagnostics({
            ok: false,
            error: error?.message || "diagnostics failed",
          });
        }
      } finally {
        if (!cancelled) setDiagnosticsLoading(false);
      }
    };

    fetchDiagnostics();
    return () => {
      cancelled = true;
    };
  }, [effectiveVaultName, effectiveVaultPath, filePath, open]);

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

  const vaultDetected = Boolean(diagnostics?.vaultExists);
  const folderResolved = Boolean(diagnostics?.resolvedFolder);
  const folderDetected = Boolean(diagnostics?.folderExists || diagnostics?.folderResolved);
  const filePathValid = Boolean(diagnostics?.filePathValid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>הגדרות Obsidian</DialogTitle>
          <DialogDescription>
            כאן נקבע ה־vault הפעיל וכל מסלולי השמירה/פתיחה באפליקציה משתמשים באותו מקור אמת.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 text-sm dark:border-violet-800/40 dark:bg-violet-950/20">
            <div className="font-semibold text-violet-900 dark:text-violet-100">Active vault</div>
            <div className="mt-1 text-violet-800 dark:text-violet-200">{activeSettings.vaultName}</div>
            <div className="mt-1 text-xs text-violet-700 dark:text-violet-300">
              מקור: {activeSettings.source || "default"}
            </div>
            {activeSettings.vaultPath ? (
              <div className="mt-1 break-all text-xs text-violet-700 dark:text-violet-300">
                {activeSettings.vaultPath}
              </div>
            ) : null}
          </div>

          {activeSettings.migrated && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
              הגדרות ישנות (Knowledge-Base) זוהו ועודכנו אוטומטית.
              ה-vault הפעיל הוא: <span className="font-mono font-semibold">Obsidian-Brain-Structure-2026-05-17</span>.
              לחץ &quot;שמור הגדרות&quot; כדי לשמור לצמיתות.
            </div>
          )}

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
            <label className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Vault Path</label>
            <input
              type="text"
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              placeholder="למשל: C:\\Users\\11\\Workspace\\Obsidian-Brain-Structure-2026-05-17"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              הנתיב המקומי משמש לאימות ולשמירה בפועל. קישור ה־obsidian:// משתמש בשם ה־vault.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="font-semibold text-slate-900 dark:text-zinc-100">Vault diagnostics</div>
            <div className="mt-3 grid gap-2">
              <DiagnosticRow
                ok={vaultDetected}
                successLabel="Vault detected"
                errorLabel="Missing vault"
              />
              <DiagnosticRow
                ok={folderResolved && folderDetected}
                successLabel="Folder resolved"
                errorLabel="Missing folder"
              />
              <DiagnosticRow
                ok={filePathValid}
                successLabel="File path valid"
                errorLabel="Invalid path"
              />
            </div>

            <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-zinc-300">
              <div><span className="font-semibold">Resolved folder:</span> {diagnostics?.resolvedFolder || "—"}</div>
              <div><span className="font-semibold">Final file path:</span> {diagnostics?.finalFilePath || filePath || "—"}</div>
              <div className="break-all"><span className="font-semibold">Absolute path:</span> {diagnostics?.absoluteFilePath || "—"}</div>
              <div className="break-all"><span className="font-semibold">obsidian:// URL:</span> {diagnostics?.obsidianUrl || savedFileUrl || "—"}</div>
              {diagnosticsLoading ? <div>בודק אבחונים...</div> : null}
              {diagnostics?.error ? (
                <div className="text-red-600 dark:text-red-400">{diagnostics.error}</div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
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
