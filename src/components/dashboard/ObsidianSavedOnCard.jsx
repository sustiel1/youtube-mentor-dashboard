import { useState } from "react";
import { ExternalLink, Trash2, RefreshCw, Pencil, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { openObsidianUrl } from "@/lib/obsidianExport";
import { hasObsidianSavedStatus } from "@/lib/obsidianSavedStatus";
import { cn } from "@/lib/utils";

const LABEL_OPTIONS = [
  { value: "📚 ידע",             label: "📚 ידע" },
  { value: "🏗️ לאפליקציה שלי", label: "🏗️ לאפליקציה שלי" },
  { value: "💡 תובנות",         label: "💡 תובנות" },
  { value: "✅ כללים",           label: "✅ כללים" },
  { value: "⚠️ אזהרות",         label: "⚠️ אזהרות" },
  { value: "📖 מושגים",         label: "📖 מושגים" },
  { value: "🎤 prompt",         label: "🎤 prompt" },
  { value: "הכל",               label: "הכל" },
  { value: "__custom__",        label: "מותאם אישית..." },
];

const PRESET_VALUES = new Set(LABEL_OPTIONS.map((o) => o.value).filter((v) => v !== "__custom__"));

function sanitizePath(raw) {
  return raw.replace(/[*?"<>|]/g, "").replace(/\0/g, "").trim();
}

/** Derive a default display label from save type. */
function defaultLabelForType(type) {
  return type === "appbuilder" ? "🏗️ אפליקציה" : "📚 ידע";
}

/**
 * Merge legacy fields + new brainSaves[] into one flat list (newest first).
 * Deduplicates by savedPath so old and new saves don't double-show.
 */
export function resolveBrainSaves(video) {
  const seenPaths = new Set();
  const all = [];

  if (Array.isArray(video?.brainSaves)) {
    for (const s of [...video.brainSaves].reverse()) {
      if (s?.savedPath && !seenPaths.has(s.savedPath)) {
        seenPaths.add(s.savedPath);
        all.push(s);
      }
    }
  }

  // Legacy knowledge save
  if (hasObsidianSavedStatus(video)) {
    const s = video.obsidianSavedStatus;
    if (!seenPaths.has(s.savedPath)) {
      seenPaths.add(s.savedPath);
      all.push({
        id: "__legacy_knowledge__",
        type: "knowledge",
        savedPath: s.savedPath,
        obsidianUrl: s.obsidianUrl || null,
        displayLabel: s.displayLabel || null,
        savedAt: s.savedAt || null,
      });
    }
  }

  // Legacy app-builder save
  if (video?.appBuilderObsidianPath && !seenPaths.has(video.appBuilderObsidianPath)) {
    all.push({
      id: "__legacy_appbuilder__",
      type: "appbuilder",
      savedPath: video.appBuilderObsidianPath,
      obsidianUrl: video.appBuilderObsidianUrl || null,
      displayLabel: video.appBuilderDisplayLabel || null,
      savedAt: null,
    });
  }

  return all;
}

// ─── SaveEntry ────────────────────────────────────────────────────────────────

function SaveEntry({ save, onDelete, onRename, onResave, compact = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draftPath, setDraftPath] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const shownLabel = save.displayLabel || defaultLabelForType(save.type);
  const isAppBuilder = save.type === "appbuilder";

  const labelColor = isAppBuilder
    ? "text-indigo-700 dark:text-indigo-300"
    : "text-emerald-700 dark:text-emerald-300";
  const containerCls = isAppBuilder
    ? "border-indigo-200/80 bg-indigo-50/90 dark:border-indigo-900/60 dark:bg-indigo-950/40"
    : "border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-900/60 dark:bg-emerald-950/40";

  const handleEditStart = (e) => {
    e.stopPropagation();
    const current = save.displayLabel || defaultLabelForType(save.type);
    setDraftPath(save.savedPath || "");
    setDraftLabel(current);
    setIsCustom(!PRESET_VALUES.has(current));
    setIsEditing(true);
  };

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__") {
      setIsCustom(true);
      setDraftLabel("");
    } else {
      setIsCustom(false);
      setDraftLabel(val);
    }
  };

  const handleEditSave = (e) => {
    e.stopPropagation();
    const cleanPath = sanitizePath(draftPath);
    const cleanLabel = draftLabel.trim();
    if (cleanPath) onRename?.({ path: cleanPath, displayLabel: cleanLabel });
    setIsEditing(false);
  };

  const handleEditCancel = (e) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  const selectValue = isCustom ? "__custom__" : (PRESET_VALUES.has(draftLabel) ? draftLabel : "__custom__");

  // Compact row (for older saves)
  if (compact && !isEditing) {
    return (
      <div
        dir="rtl"
        className={cn("rounded-xl border px-2.5 py-1.5", containerCls)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn("text-[13px] font-semibold shrink-0", labelColor)}>{shownLabel}</span>
            <span
              className="truncate text-[11px] font-medium text-slate-600 dark:text-zinc-300 min-w-0"
              title={save.savedPath}
              dir="ltr"
            >
              {save.savedPath}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onRename && (
              <button type="button" title="ערוך" onClick={handleEditStart}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 transition-colors">
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {onResave && (
              <button type="button" title="שמור שוב" onClick={(e) => { e.stopPropagation(); onResave(); }}
                className="rounded p-0.5 text-slate-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/40 dark:hover:text-blue-400 transition-colors">
                <RefreshCw className="h-3 w-3" />
              </button>
            )}
            {save.obsidianUrl && (
              <button type="button" title="פתח ב-Obsidian"
                onClick={(e) => { e.stopPropagation(); openObsidianUrl(save.obsidianUrl); }}
                className="rounded p-0.5 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-400 transition-colors">
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
            {onDelete && (
              <button type="button" title="הסר" onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="rounded p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full card (for newest save or while editing)
  return (
    <div dir="rtl" className={cn("rounded-xl border px-2.5 py-2", containerCls)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">✓ נשמר למוח</p>
        <div className="flex items-center gap-1">
          {onRename && !isEditing && (
            <button type="button" title="שנה כותרת/נתיב" onClick={handleEditStart}
              className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300">
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onResave && (
            <button type="button" title="עדכן שמירה" onClick={(e) => { e.stopPropagation(); onResave(); }}
              className="rounded p-0.5 text-slate-400 transition-colors hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/40 dark:hover:text-blue-400">
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button type="button" title="הסר מהתצוגה" onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded p-0.5 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="mt-1.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <div>
            <p className="mb-0.5 text-[10px] text-slate-500 dark:text-zinc-400">קטגוריה</p>
            <select dir="rtl" value={selectValue} onChange={handleSelectChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
              {LABEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {isCustom && (
            <div>
              <p className="mb-0.5 text-[10px] text-slate-500 dark:text-zinc-400">כותרת מותאמת</p>
              <input autoFocus dir="rtl" value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") handleEditCancel(e); }}
                placeholder="הכנס כותרת..."
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200" />
            </div>
          )}
          <div>
            <p className="mb-0.5 text-[10px] text-slate-500 dark:text-zinc-400">נתיב קובץ</p>
            <input dir="ltr" value={draftPath} onChange={(e) => setDraftPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(e); if (e.key === "Escape") handleEditCancel(e); }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              placeholder="folder/file.md" />
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={handleEditSave}
              className="inline-flex items-center gap-0.5 rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-700">
              <Check className="h-2.5 w-2.5" /> שמור
            </button>
            <button type="button" onClick={handleEditCancel}
              className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800">
              <X className="h-2.5 w-2.5" /> ביטול
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={cn("mt-0.5 text-[18px] font-semibold leading-tight", labelColor)}>{shownLabel}</p>
          {save.savedPath && (
            <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-slate-700 dark:text-zinc-200"
              title={save.savedPath} dir="ltr">
              {save.savedPath}
            </p>
          )}
        </>
      )}

      {!isEditing && save.obsidianUrl && (
        <button type="button"
          onClick={(e) => { e.stopPropagation(); openObsidianUrl(save.obsidianUrl); }}
          className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-emerald-300/80 bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900/60">
          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          פתח ב־Obsidian
        </button>
      )}
    </div>
  );
}

// ─── ObsidianSavedOnCard ───────────────────────────────────────────────────────

export function ObsidianSavedOnCard({
  video,
  className,
  onDeleteSave,        // (id) => void
  onRenameSave,        // (id, { path, displayLabel }) => void
  onResaveKnowledge,   // () => void
  onResaveAppBuilder,  // () => void
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const saves = resolveBrainSaves(video);
  if (saves.length === 0) return null;

  const newest = saves[0];
  const older = saves.slice(1);

  const resaveFor = (save) =>
    save.type === "appbuilder" ? onResaveAppBuilder : onResaveKnowledge;

  return (
    <div className={cn("space-y-1.5", className)} onClick={(e) => e.stopPropagation()}>
      {/* Newest save — full card */}
      <SaveEntry
        save={newest}
        onDelete={onDeleteSave ? () => onDeleteSave(newest.id) : undefined}
        onRename={onRenameSave ? (upd) => onRenameSave(newest.id, upd) : undefined}
        onResave={resaveFor(newest)}
      />

      {/* Older saves — collapsible history */}
      {older.length > 0 && (
        <div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setHistoryOpen((v) => !v); }}
            className="flex w-full items-center justify-end gap-1 py-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            dir="rtl"
          >
            {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {historyOpen ? "הסתר היסטוריה" : `${older.length} שמירות נוספות`}
          </button>
          {historyOpen && (
            <div className="space-y-1">
              {older.map((save) => (
                <SaveEntry
                  key={save.id}
                  save={save}
                  compact
                  onDelete={onDeleteSave ? () => onDeleteSave(save.id) : undefined}
                  onRename={onRenameSave ? (upd) => onRenameSave(save.id, upd) : undefined}
                  onResave={resaveFor(save)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
