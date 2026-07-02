import { useState, useEffect, useRef } from "react";
import { Sparkles, Copy, Search, StickyNote, ChevronDown, ChevronUp } from "lucide-react";
import { renderLinkedMarketText } from '@/components/shared/LinkedMarketText';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";
import {
  getSentenceNote,
  upsertSentenceNote,
  deleteSentenceNote as deleteSentenceNoteFromStore,
} from "@/lib/localSentenceNoteStore";
import { cn } from "@/lib/utils";
import { getBrainSaveButtonEnabledClass, getBrainSaveButtonLabel } from "@/lib/obsidianSavedStatus";
import {
  getKnowledgeCategoryTheme,
} from "@/lib/knowledgeCategoryTheme";
import { KNOWLEDGE_TYPES, getKnowledgeTypeConfig } from "@/lib/knowledgeTypes";
import { appendToLibraryAndVault, getLibraryPathForItem, isInLibraryAtPath, openInObsidian, getKBSettings, setKBSettings, resolveLibraryRoute } from "@/lib/knowledgeLibrary";
import { buildObsidianOpenUrl, getConfiguredObsidianVaultName } from "@/lib/obsidianVaultConfig";
import { openObsidianUrl } from "@/lib/obsidianExport";

function KnowledgeTypeBadge({ typeId }) {
  const cfg = getKnowledgeTypeConfig(typeId);
  if (!cfg) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5 px-0.5 text-[10px] font-medium leading-snug", cfg.badge)}>
      <span aria-hidden>{cfg.emoji}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

export function KnowledgeTypeButton({ allItems, selectedTypes, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const typeCounts = {};
  let noTypeCnt = 0;
  allItems.forEach(item => {
    const types = Array.isArray(item.knowledgeTypes) ? item.knowledgeTypes : [];
    if (types.length === 0) noTypeCnt++;
    types.forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
  });
  const visibleTypes = KNOWLEDGE_TYPES.filter(t => typeCounts[t.id] > 0);
  if (visibleTypes.length === 0 && noTypeCnt === 0) return null;

  const hasSelection = selectedTypes.size > 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all",
          hasSelection
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
            : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
        )}
      >
        <span>📚</span>
        <span>סוגי ידע</span>
        {hasSelection && (
          <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[9px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {selectedTypes.size}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 w-[300px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-2.5 flex items-center justify-between" dir="rtl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">סנן לפי סוג ידע</span>
            {hasSelection && (
              <button type="button" onClick={() => { onClear(); setOpen(false); }}
                className="text-[10px] font-medium text-indigo-500 hover:text-indigo-700 dark:text-indigo-400">
                נקה הכל
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5" dir="rtl">
            {visibleTypes.map(t => {
              const isActive = selectedTypes.has(t.id);
              return (
                <button key={t.id} type="button" onClick={() => onToggle(t.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all",
                    isActive ? t.filterActive : t.filterIdle
                  )}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                  <span className={cn(
                    "rounded-full px-1 py-px text-[9px] tabular-nums leading-none",
                    isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400"
                  )}>
                    {typeCounts[t.id]}
                  </span>
                </button>
              );
            })}
            {noTypeCnt > 0 && (
              <button type="button" onClick={() => onToggle('__none__')}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all",
                  selectedTypes.has('__none__')
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700"
                )}
              >
                ללא סיווג
                <span className="rounded-full bg-slate-100 px-1 py-px text-[9px] tabular-nums text-slate-500 dark:bg-zinc-700 dark:text-zinc-400">
                  {noTypeCnt}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function KnowledgeTypeActiveBadges({ selectedTypes, onToggle, onClear }) {
  if (!selectedTypes || selectedTypes.size === 0) return null;
  const activeTypes = KNOWLEDGE_TYPES.filter(t => selectedTypes.has(t.id));
  const hasNone = selectedTypes.has('__none__');
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-0.5" dir="rtl">
      {activeTypes.map(t => (
        <span key={t.id} className={cn("inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold", t.badge)}>
          <span>{t.emoji}</span>
          <span>{t.label}</span>
          <button type="button" onClick={() => onToggle(t.id)} className="mr-0.5 opacity-60 hover:opacity-100 leading-none" aria-label={`הסר ${t.label}`}>×</button>
        </span>
      ))}
      {hasNone && (
        <span className="inline-flex items-center gap-0.5 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          ללא סיווג
          <button type="button" onClick={() => onToggle('__none__')} className="mr-0.5 opacity-60 hover:opacity-100 leading-none">×</button>
        </span>
      )}
      <button type="button" onClick={onClear}
        className="text-[10px] font-medium text-slate-400 underline underline-offset-2 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300">
        נקה סינון
      </button>
    </div>
  );
}

export { KnowledgeTypeButton as KnowledgeTypeFilterBar };

async function writeToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

/** RTL checkbox row — shared by political / fundamental / general lists */
export function KnowledgeCheckboxRow({
  checked,
  onToggle,
  children,
  className,
  categoryKey = null,
  note: externalNote,
  onNoteChange,
  videoId,
  rowKey,
  videoTitle,
  knowledgeTypes,
  targetPath = null,
  onSaveToLibrary,
  librarySavedPath = null,
  libraryVaultWritten = null,
  onAfterLibrarySave,
}) {
  const theme = getKnowledgeCategoryTheme(categoryKey);
  const text = typeof children === "string" ? children : "";

  const [note, setNote] = useState(externalNote || "");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const hasNote = Boolean(note.trim());

  // Load persisted note from store when videoId+rowKey are available
  useEffect(() => {
    if (!videoId || !rowKey) return;
    const stored = getSentenceNote(videoId, rowKey);
    if (stored?.note) setNote(stored.note);
  }, [videoId, rowKey]);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!text) return;
    writeToClipboard(text).then(() => toast.success("המשפט הועתק"));
  };

  const handleResearch = (e) => {
    e.stopPropagation();
    if (!text) return;
    const prompt = `Research this insight in depth:\n\n"${text}"\n\nExplain:\n- beginner explanation\n- advanced explanation\n- examples\n- risks\n- practical investing usage`;
    writeToClipboard(prompt).then(() => toast.success("פרומפט מחקר הועתק"));
  };

  const handleNoteOpen = (e) => {
    e.stopPropagation();
    setDraftNote(note);
    setIsEditingNote(true);
  };

  const handleNoteSave = (e) => {
    e.stopPropagation();
    const trimmed = draftNote.trim();
    setNote(trimmed);
    onNoteChange?.(trimmed);
    setIsEditingNote(false);
    if (videoId && rowKey) {
      if (trimmed) {
        upsertSentenceNote({ videoId, rowKey, sentence: text, note: trimmed, category: categoryKey, videoTitle });
      } else {
        deleteSentenceNoteFromStore(videoId, rowKey);
      }
    }
    toast.success(trimmed ? "הערה נשמרה" : "הערה נמחקה");
  };

  const handleNoteDelete = (e) => {
    e.stopPropagation();
    setNote("");
    onNoteChange?.("");
    setIsEditingNote(false);
    if (videoId && rowKey) deleteSentenceNoteFromStore(videoId, rowKey);
    toast.success("הערה נמחקה");
  };

  const handleNoteCancel = (e) => {
    e.stopPropagation();
    setIsEditingNote(false);
  };

  const handleOpenObsidian = (e) => {
    e.stopPropagation();
    const savedPath = librarySavedPath;
    if (!savedPath) {
      toast.error("לא נמצא נתיב שמירה לפריט הזה");
      return;
    }
    const vault = getConfiguredObsidianVaultName();
    const url = buildObsidianOpenUrl(savedPath, vault);
    console.log("[KnowledgeLibrary] open Obsidian", { rowKey, savedPath, vault, url });
    openObsidianUrl(url, { bypassDedupe: true });
  };

  const handleSaveToLibrary = (e) => {
    e.stopPropagation();
    if (!onSaveToLibrary) return;
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!onSaveToLibrary) return;
    setIsSaving(true);
    try {
      const result = await onSaveToLibrary(note.trim() || null);
      if (!result) return;
      setConfirmOpen(false);
      if (onAfterLibrarySave) {
        onAfterLibrarySave(result);
      } else {
        if (result.verified) {
          toast.success(`✓ נשמר למאגר`, { description: result.path, icon: "🧠" });
        } else if (result.isDuplicate) {
          toast.info("כבר קיים במאגר", { description: result.path });
        } else {
          toast.warning("✓ נשמר באפליקציה / ⚠ עדיין לא נכתב לקובץ Obsidian", { description: result.path });
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "group flex w-full flex-col rounded-lg border text-right text-sm transition-colors",
        checked
          ? theme.rowChecked
          : cn("border-transparent bg-transparent text-slate-700 dark:text-zinc-300", theme.rowHover),
        className
      )}
      dir="rtl"
    >
      {/* Main row */}
      <div className="flex w-full flex-row-reverse items-start gap-2.5 px-3 py-1.5">
        {/* Checkbox — only this triggers toggle */}
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={checked}
          className="mt-0.5 shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded border-2 text-[9px] font-bold",
              checked ? cn(theme.checkboxChecked, "text-white") : cn(theme.checkboxIdle, "text-transparent")
            )}
          >
            ✓
          </span>
        </button>

        {/* Selectable text */}
        <span className="min-w-0 flex-1 cursor-text select-text text-right leading-relaxed">
          {children}
          {Array.isArray(knowledgeTypes) && knowledgeTypes.length > 0 && (
            <span className="inline-flex flex-wrap items-baseline gap-1.5 ms-1.5" onClick={e => e.stopPropagation()}>
              {knowledgeTypes.map(t => <KnowledgeTypeBadge key={t} typeId={t} />)}
            </span>
          )}
          {librarySavedPath && (
            <span className="mt-1 flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
              <span className="flex items-center gap-1.5 flex-wrap">
                {libraryVaultWritten === false ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400">
                    ✓ נשמר באפליקציה
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-400">
                    ✓ נשמר למאגר
                  </span>
                )}
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-[220px]" title={librarySavedPath}>
                  📂 {librarySavedPath}
                </span>
              </span>
              {libraryVaultWritten === false && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ נשמר באפליקציה בלבד — לא נכתב לקובץ Obsidian
                </span>
              )}
            </span>
          )}
          {hasNote && !isEditingNote && (
            <span
              className="mr-2 inline-flex cursor-pointer items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
              onClick={handleNoteOpen}
              title="לחץ לעריכת ההערה"
            >
              📝 הערה
            </span>
          )}
        </span>

        {/* Hover actions — copy + research + note */}
        <div className="flex shrink-0 items-center gap-0.5 self-center opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={handleCopy}
            title="העתק משפט"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={handleResearch}
            title="העתק פרומפט מחקר"
            className="rounded p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400"
          >
            <Search className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={handleNoteOpen}
            title={hasNote ? "ערוך הערה" : "הוסף הערה"}
            className={cn(
              "rounded p-1 transition-colors",
              hasNote
                ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/40"
                : "text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40 dark:hover:text-amber-400"
            )}
          >
            <StickyNote className="h-3 w-3" />
          </button>
          {librarySavedPath ? (
            <button
              type="button"
              onClick={handleOpenObsidian}
              title="פתח ב-Obsidian"
              className="rounded p-1 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            >
              <span className="text-[11px] leading-none select-none font-bold">↗</span>
            </button>
          ) : onSaveToLibrary && (
            <button
              type="button"
              onClick={handleSaveToLibrary}
              title="שמור למאגר הידע"
              className="rounded p-1 text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-colors dark:hover:bg-violet-950/40 dark:hover:text-violet-400"
            >
              <span className="text-[11px] leading-none select-none">🧠➕</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline note editor */}
      {isEditingNote && (
        <div
          className="border-t border-amber-100 bg-amber-50/60 px-3 pb-2.5 pt-2 dark:border-amber-900/30 dark:bg-amber-900/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            הערה אישית:
          </div>
          <textarea
            autoFocus
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") handleNoteCancel(e); if (e.key === "Enter" && e.ctrlKey) handleNoteSave(e); }}
            placeholder="הוסף הערה, תובנה או שאלה..."
            rows={2}
            className="w-full resize-none rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-right text-xs text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500"
            dir="rtl"
          />
          <div className="mt-1.5 flex flex-row-reverse gap-1.5">
            <button
              type="button"
              onClick={handleNoteSave}
              className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-600"
            >
              שמור
            </button>
            {hasNote && (
              <button
                type="button"
                onClick={handleNoteDelete}
                className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                מחק
              </button>
            )}
            <button
              type="button"
              onClick={handleNoteCancel}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              ביטול
            </button>
            <span className="mr-auto self-center text-[10px] text-slate-400 dark:text-zinc-500">Ctrl+Enter לשמירה</span>
          </div>
        </div>
      )}

      {/* Saved note display */}
      {hasNote && !isEditingNote && (
        <div
          className="cursor-pointer border-t border-amber-100/80 bg-amber-50/40 px-3 py-1.5 hover:bg-amber-50/70 dark:border-amber-900/20 dark:bg-amber-900/10 dark:hover:bg-amber-900/20"
          onClick={handleNoteOpen}
          title="לחץ לעריכת ההערה"
        >
          <p className="text-right text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
            {note}
          </p>
        </div>
      )}

      {/* Confirmation modal before vault save */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!isSaving) setConfirmOpen(open); }}>
        <DialogContent className="max-w-md p-0" dir="rtl">
          <div className="px-5 pt-5 pb-2 border-b border-slate-100 dark:border-zinc-800">
            <div className="text-base font-bold text-slate-900 dark:text-white text-right">אתה עומד לשמור למאגר</div>
          </div>
          <div className="px-5 py-4 space-y-3 text-right" dir="rtl">
            {/* Knowledge type */}
            {Array.isArray(knowledgeTypes) && knowledgeTypes.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">סוג ידע</span>
                <div className="flex flex-wrap gap-1">
                  {knowledgeTypes.map(t => <KnowledgeTypeBadge key={t} typeId={t} />)}
                </div>
              </div>
            )}
            {/* Target path */}
            {targetPath && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">מסלול שמירה</span>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 break-all text-right" dir="ltr">
                  {targetPath}
                </div>
              </div>
            )}
            {/* Text preview */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">טקסט</span>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 leading-relaxed line-clamp-4">
                {text}
              </div>
            </div>
            {/* Note */}
            {hasNote && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide">הערה אישית</span>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300 leading-relaxed">
                  {note}
                </div>
              </div>
            )}
            {/* Duplicate warning */}
            {targetPath && isInLibraryAtPath(text, targetPath) && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-950/30">
                <span className="mt-0.5 text-sm">⚠️</span>
                <span className="text-xs text-amber-700 dark:text-amber-400">ייתכן שהפריט כבר קיים במאגר</span>
              </div>
            )}
            {/* Vault write note */}
            <div className="text-[10px] text-slate-400 dark:text-zinc-500">
              📂 הפריט יישמר גם לקובץ Obsidian פיזי אם הכלי פועל
            </div>
          </div>
          <div className="flex flex-row-reverse gap-2 px-5 pb-5 pt-1 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleConfirmSave}
              disabled={isSaving}
              className="flex-1 h-9 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-60 transition-colors"
            >
              {isSaving ? "שומר..." : "אשר ושמור למאגר"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={isSaving}
              className="h-9 px-4 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              בטל
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function truncateWords(text, count = 10) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  return words.length <= count ? text : words.slice(0, count).join(" ") + "...";
}

/** Single sentence-note card with expand/collapse */
function SentenceNoteCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const dateStr = item.updatedAt
    ? format(new Date(item.updatedAt), "dd/MM/yyyy", { locale: he })
    : "";
  return (
    <div
      className="cursor-pointer rounded-xl border border-amber-100 bg-amber-50/40 p-3 transition-colors hover:bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10 dark:hover:bg-amber-900/20"
      onClick={() => setExpanded((v) => !v)}
      dir="rtl"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
            {expanded ? item.sentence : truncateWords(item.sentence)}
          </p>
          <p className="text-xs font-medium leading-relaxed text-amber-700 dark:text-amber-400">
            {expanded ? item.note : truncateWords(item.note)}
          </p>
          {expanded && item.videoTitle && (
            <p className="text-[10px] text-slate-400 dark:text-zinc-500">
              מקור: {item.videoTitle}
            </p>
          )}
          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-zinc-500">
            {item.category && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 dark:bg-zinc-800">
                {item.category}
              </span>
            )}
            <span>{dateStr}</span>
          </div>
        </div>
        <span className="shrink-0 text-slate-400 dark:text-zinc-500">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </div>
    </div>
  );
}

/** Sentence notes list — shown in the Notes tab */
export function SentenceNotesSection({ notes }) {
  if (!notes || notes.length === 0) return null;
  return (
    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-zinc-800" dir="rtl">
      <div className="mb-2 flex items-center gap-2">
        <StickyNote className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
          הערות על משפטים ({notes.length})
        </span>
      </div>
      <div className="space-y-2">
        {notes.map((n) => (
          <SentenceNoteCard key={n.id} item={n} />
        ))}
      </div>
    </div>
  );
}

/** Category filter pills — floating pill container, unified neutral style. */
export function KnowledgeFilterTabs({ tabs, activeId, onSelect, className, endSlot }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/70 bg-white/95 px-2.5 py-2",
        "shadow-[0_4px_20px_-4px_rgba(15,23,42,0.10),0_2px_6px_-2px_rgba(15,23,42,0.06)]",
        "backdrop-blur-sm",
        "dark:border-zinc-800/70 dark:bg-zinc-900/95",
        "dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.38),0_2px_8px_-2px_rgba(0,0,0,0.22)]",
        className
      )}
      dir="rtl"
    >
      {tabs.map((tab) => {
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-pressed={isActive}
            className={cn(
              "group relative inline-flex cursor-pointer select-none items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium",
              "transition-all duration-200 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 active:scale-[0.97]",
              isActive
                ? [
                    "font-semibold text-slate-900 dark:text-zinc-50",
                    "bg-white dark:bg-zinc-800",
                    "ring-1 ring-slate-200/80 dark:ring-zinc-700/70",
                    "shadow-[0_2px_8px_-2px_rgba(15,23,42,0.14),0_1px_2px_-1px_rgba(15,23,42,0.10)]",
                    "dark:shadow-[0_2px_12px_-2px_rgba(0,0,0,0.50)]",
                  ].join(" ")
                : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
            )}
          >
            {tab.emoji ? (
              <span
                className={cn(
                  "text-[15px] leading-none transition-transform duration-200",
                  isActive ? "scale-110" : "opacity-80 group-hover:scale-105 group-hover:opacity-100"
                )}
                aria-hidden
              >
                {tab.emoji}
              </span>
            ) : null}
            <span className="leading-none">{tab.label}</span>
            <span
              className={cn(
                "min-w-[1.4rem] rounded-full px-1.5 py-px text-center text-[10px] font-bold tabular-nums leading-tight transition-colors",
                tab.selectedCount > 0
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                  : isActive
                  ? "bg-slate-100/90 text-slate-600 dark:bg-zinc-700/80 dark:text-zinc-300"
                  : "bg-slate-100/80 text-slate-400 group-hover:bg-slate-200/70 group-hover:text-slate-600 dark:bg-zinc-800/90 dark:text-zinc-500 dark:group-hover:bg-zinc-700/70 dark:group-hover:text-zinc-300"
              )}
            >
              {tab.selectedCount > 0 ? `${tab.selectedCount}/${tab.count}` : tab.count}
            </span>
          </button>
        );
      })}
      {endSlot && (
        <div className="ms-auto shrink-0 border-r border-slate-200/80 pr-2.5 dark:border-zinc-700/60">
          {endSlot}
        </div>
      )}
    </div>
  );
}

/** Reusable large section title for knowledge category headers (Notion/Bloomberg style). */
export function SectionTitle({ emoji, title, className }) {
  return (
    <h3 className={cn("text-2xl md:text-4xl font-extrabold tracking-tight leading-tight", className)}>
      {emoji ? `${emoji} ` : ""}
      {title}
    </h3>
  );
}

/** Themed section wrapper — flat rows inside, subtle tint + accent rail (RTL). */
export function KnowledgeCategorySection({ categoryKey, title, emoji, children, className }) {
  const theme = getKnowledgeCategoryTheme(categoryKey);
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border",
        theme.sectionBorder,
        theme.sectionBg,
        className
      )}
      dir="rtl"
    >
      <div className={cn("px-4 pt-5 pb-4", theme.headerBg)}>
        <SectionTitle emoji={emoji} title={title} className={theme.header} />
      </div>
      <div className={cn("border-r-2 pt-1", theme.accentRail)}>
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">{children}</div>
      </div>
    </section>
  );
}

export function BrainSaveToolbar({
  video,
  selectedCount,
  totalCount,
  emptyHint = "סמן פריטים ואז לחץ שמור למוח",
  selectedHint,
  onClear,
  onClearAll,
  onSelectAll,
  onSave,
  saveLabel,
  extraControls = null,
  disabled = false,
}) {
  return (
    <div className="rounded-xl border border-violet-200/80 bg-white/95 px-3 py-2.5 dark:border-violet-800/40 dark:bg-zinc-950/95">
      <div className="flex flex-wrap items-center justify-between gap-3" dir="rtl">
        <div className="text-right min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">בחר חלקים לשמירה</div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            {selectedCount > 0
              ? (selectedHint ?? `סומנו ${selectedCount} פריטים מתוך ${totalCount}`)
              : emptyHint}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extraControls}
          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              נקה הכל
            </button>
          )}
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            נקה
          </button>
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
          >
            בחר הכל
          </button>
          <button
            type="button"
            disabled={disabled || selectedCount === 0}
            onClick={onSave}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
              selectedCount > 0
                ? getBrainSaveButtonEnabledClass(video, { variant: "violet" })
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            {saveLabel ?? getBrainSaveButtonLabel(video, { count: selectedCount })}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PoliticalKnowledgePanel({
  video,
  politicalSelectableFields,
  politicalObsidianSelections,
  setPoliticalObsidianSelections,
  totalPoliticalSelectedItems,
  totalPoliticalSelectableItems,
  allPoliticalSelectionKeys,
  buildPoliticalSelectionState,
  onSaveSelected,
  onSaveSlogans,
  isPoliticalOpponentView,
  setIsPoliticalOpponentView,
  showToolbar = true,
  videoId,
  videoTitle,
}) {
  const toggleSel = (key) =>
    setPoliticalObsidianSelections((prev) => ({ ...prev, [key]: prev[key] !== true }));

  const renderListSection = (categoryKey, title, items, fieldKey) => {
    if (!items?.length) return null;
    return (
      <KnowledgeCategorySection categoryKey={categoryKey} title={title}>
        {items.map((item, i) => {
          const k = `${fieldKey}_${i}`;
          const checked = politicalObsidianSelections[k] === true;
          return (
            <KnowledgeCheckboxRow
              key={k}
              categoryKey={categoryKey}
              checked={checked}
              onToggle={() => toggleSel(k)}
              className="rounded-none border-0"
              videoId={videoId}
              rowKey={k}
              videoTitle={videoTitle}
            >
              {item}
            </KnowledgeCheckboxRow>
          );
        })}
      </KnowledgeCategorySection>
    );
  };

  const renderSingleSection = (categoryKey, title, item) => {
    if (!item) return null;
    const checked = politicalObsidianSelections[item.key] === true;
    return (
      <KnowledgeCategorySection categoryKey={categoryKey} title={title}>
        <KnowledgeCheckboxRow
          categoryKey={categoryKey}
          checked={checked}
          onToggle={() => toggleSel(item.key)}
          className="rounded-none border-0"
          videoId={videoId}
          rowKey={item.key}
          videoTitle={videoTitle}
        >
          {item.text}
        </KnowledgeCheckboxRow>
      </KnowledgeCategorySection>
    );
  };

  const pArgs = Array.isArray(video.politicalArguments)
    ? video.politicalArguments.filter(Boolean).map(String)
    : [];
  const pWeak = Array.isArray(video.weakPoints) ? video.weakPoints.filter(Boolean).map(String) : [];
  const pCounter = Array.isArray(video.counterArguments)
    ? video.counterArguments.filter(Boolean).map(String)
    : [];
  const pSocial = Array.isArray(video.socialMediaReplies)
    ? video.socialMediaReplies.filter(Boolean).map(String)
    : [];
  const pKeyPoints = Array.isArray(video.keyPoints) ? video.keyPoints.filter(Boolean).map(String) : [];
  const pSlogans = Array.isArray(video.networkSlogans)
    ? video.networkSlogans.filter((s) => s?.text)
    : [];

  if (politicalSelectableFields.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
        אין עדיין ידע פוליטי מובנה מהסרטון
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      {showToolbar && (
        <BrainSaveToolbar
          video={video}
          selectedCount={totalPoliticalSelectedItems}
          totalCount={totalPoliticalSelectableItems}
          onClear={() => setPoliticalObsidianSelections(buildPoliticalSelectionState([]))}
          onSelectAll={() => setPoliticalObsidianSelections(buildPoliticalSelectionState())}
          onSave={onSaveSelected}
          extraControls={
            <label className="inline-flex flex-row-reverse items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-300">
              <input
                type="checkbox"
                checked={isPoliticalOpponentView}
                onChange={(e) => setIsPoliticalOpponentView(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-rose-300 accent-rose-600"
              />
              דעת האויב
            </label>
          }
        />
      )}
      {renderSingleSection(
        "mainClaim",
        "הטענה המרכזית",
        video.mainClaim ? { key: "mainClaim", text: String(video.mainClaim) } : null
      )}
      {renderSingleSection(
        "speakerPosition",
        "עמדת הדובר",
        video.speakerPosition ? { key: "speakerPosition", text: String(video.speakerPosition) } : null
      )}
      {renderListSection("politicalArguments", "טיעונים תומכים", pArgs, "politicalArguments")}
      {renderListSection("weakPoints", "חולשות בטיעון", pWeak, "weakPoints")}
      {renderListSection("counterArguments", "טיעוני נגד", pCounter, "counterArguments")}
      {renderListSection("socialMediaReplies", "תגובות לרשתות", pSocial, "socialMediaReplies")}
      {renderListSection("keyPoints", "ידע שימושי", pKeyPoints, "keyPoints")}
      {pSlogans.length > 0 && (
        <NetworkSlogansSection
          slogans={pSlogans}
          onSaveSlogans={onSaveSlogans}
          videoId={videoId}
        />
      )}
    </div>
  );
}

function NetworkSlogansSection({ slogans, onSaveSlogans, videoId }) {
  const [selected, setSelected] = useState({});
  const selectedSlogans = slogans.filter((_, i) => selected[i]);
  const allSelected = slogans.length > 0 && slogans.every((_, i) => selected[i]);

  const toggle = (i) => setSelected((prev) => ({ ...prev, [i]: !prev[i] }));
  const selectAll = () => {
    const next = {};
    slogans.forEach((_, i) => { next[i] = true; });
    setSelected(next);
  };
  const clearAll = () => setSelected({});

  const copySlogan = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('הועתק');
    } catch {
      toast.error('לא ניתן להעתיק');
    }
  };

  const copyAllSlogans = async () => {
    const text = slogans.map((s) => s.text).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${slogans.length} סיסמאות הועתקו`);
    } catch {
      toast.error('לא ניתן להעתיק');
    }
  };

  const TONE_COLORS = {
    'חד': 'bg-red-50 text-red-700 border-red-200',
    'אירוני': 'bg-purple-50 text-purple-700 border-purple-200',
    'רגשי': 'bg-pink-50 text-pink-700 border-pink-200',
    'ענייני': 'bg-blue-50 text-blue-700 border-blue-200',
    'מחאתי': 'bg-orange-50 text-orange-700 border-orange-200',
  };
  const toneColor = (tone) => TONE_COLORS[tone] || 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <KnowledgeCategorySection categoryKey="networkSlogans" title="סיסמאות ותגובות לרשת" emoji="✊">
      <div className="px-3 pb-3 pt-1 space-y-2" dir="rtl">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allSelected ? clearAll : selectAll}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {allSelected ? 'בטל הכל' : 'בחר הכל'}
            </button>
            <button
              type="button"
              onClick={copyAllSlogans}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              <Copy className="h-3 w-3" />
              העתק הכל
            </button>
          </div>
          {onSaveSlogans && (
            <button
              type="button"
              disabled={selectedSlogans.length === 0}
              onClick={() => onSaveSlogans(selectedSlogans)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                selectedSlogans.length > 0
                  ? 'bg-violet-600 text-white hover:bg-violet-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
            >
              <Sparkles className="h-3 w-3" />
              שמור נבחרים ל-Obsidian{selectedSlogans.length > 0 ? ` (${selectedSlogans.length})` : ''}
            </button>
          )}
        </div>

        {/* Slogan cards */}
        {slogans.map((s, i) => {
          const isSelected = !!selected[i];
          return (
            <div
              key={`slogan-${videoId}-${i}`}
              className={cn(
                'rounded-xl border p-3 text-right transition-colors',
                isSelected
                  ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-600/40 dark:bg-indigo-950/20'
                  : 'border-slate-100 bg-white hover:border-slate-200 dark:border-zinc-800 dark:bg-zinc-950/30'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                {/* Checkbox + text */}
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center text-[9px] font-bold transition-colors',
                      isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 bg-white text-transparent'
                    )}
                  >
                    ✓
                  </button>
                  <span className="text-sm font-medium text-slate-900 dark:text-zinc-100 leading-snug flex-1">
                    {s.text}
                  </span>
                </div>
                {/* Copy button */}
                <button
                  type="button"
                  onClick={() => copySlogan(s.text)}
                  className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:border-zinc-700 dark:hover:bg-zinc-800"
                  title="העתק"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Badges row */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {s.tone && (
                  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', toneColor(s.tone))}>
                    {s.tone}
                  </span>
                )}
                {s.useCase && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                    {s.useCase}
                  </span>
                )}
                {s.sourceIdea && (
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight">
                    {s.sourceIdea}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </KnowledgeCategorySection>
  );
}

const SLOGAN_TONE_COLORS = {
  'חד': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800/40',
  'אירוני': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-800/40',
  'רגשי': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/20 dark:text-pink-300 dark:border-pink-800/40',
  'ענייני': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-800/40',
  'מחאתי': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-800/40',
};
const sloganToneColor = (tone) => SLOGAN_TONE_COLORS[tone] || 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700';

function SloganCard({ text, tone, confidence, sourceIdea, useCase, onCopy }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 text-right dark:border-zinc-800 dark:bg-zinc-950/30">
      <div className="flex items-start justify-between gap-2">
        <span className="flex-1 text-sm font-medium leading-snug text-slate-900 dark:text-zinc-100">{renderLinkedMarketText(text)}</span>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:border-zinc-700 dark:hover:bg-zinc-800"
          title="העתק"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tone && (
          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', sloganToneColor(tone))}>
            {tone}
          </span>
        )}
        {useCase && (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            {useCase}
          </span>
        )}
        {confidence > 0 && (
          <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400">⭐ {confidence}/100</span>
        )}
        {sourceIdea && (
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight">{sourceIdea}</span>
        )}
      </div>
    </div>
  );
}

function SloganSection({ emoji, title, count, children }) {
  if (count === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
        <span className="text-base">{emoji}</span>
        <span className="font-semibold text-sm text-slate-800 dark:text-zinc-100">{title}</span>
        <span className="inline-flex items-center justify-center rounded-full bg-slate-200 dark:bg-zinc-700 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-zinc-300 min-w-[20px]">{count}</span>
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

const SUB_TABS = [
  { key: 'slogans',  emoji: '📢', label: 'סיסמאות',          colorActive: 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' },
  { key: 'quotes',   emoji: '🔥', label: 'ציטוטים',          colorActive: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
  { key: 'social',   emoji: '💬', label: 'תגובות לרשת',      colorActive: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' },
  { key: 'debate',   emoji: '⚔️', label: 'תגובות לוויכוחים', colorActive: 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300' },
];

export function PoliticalSlogansPanel({ video, videoId }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [activeSubTab, setActiveSubTab] = useState('slogans');

  const slogans = Array.isArray(video?.politicalSlogans) ? video.politicalSlogans.filter((s) => s?.text) : [];
  const quotes = Array.isArray(video?.viralQuotes) ? video.viralQuotes.filter(Boolean).map(String) : [];
  const socialItems = [
    ...(Array.isArray(video?.networkSlogans)
      ? video.networkSlogans.filter((s) => s?.text).map((s) => ({ text: s.text, tone: s.tone || '', useCase: s.useCase || '', sourceIdea: s.sourceIdea || '' }))
      : []),
    ...(Array.isArray(video?.socialMediaReplies)
      ? video.socialMediaReplies.filter(Boolean).map((s) => ({ text: String(s), tone: '', useCase: '', sourceIdea: '' }))
      : []),
    ...(Array.isArray(video?.commentBank)
      ? video.commentBank.filter(Boolean).map((s) => ({ text: String(s), tone: '', useCase: '', sourceIdea: '' }))
      : []),
  ];
  const debateReplies = [
    ...(Array.isArray(video?.debateResponses) ? video.debateResponses.filter(Boolean).map(String) : []),
    ...(Array.isArray(video?.counterArguments) ? video.counterArguments.filter(Boolean).map(String) : []),
  ];

  const countsByTab = {
    slogans: slogans.length,
    quotes:  quotes.length,
    social:  socialItems.length,
    debate:  debateReplies.length,
  };
  const total = slogans.length + quotes.length + socialItems.length + debateReplies.length;

  const matches = (text) => !search || String(text).toLowerCase().includes(search.toLowerCase());

  const filteredSlogans = slogans.filter((s) => matches(s.text));
  const filteredQuotes  = quotes.filter(matches);
  const filteredSocial  = socialItems.filter((s) => matches(s.text));
  const filteredDebate  = debateReplies.filter(matches);

  // Items visible in active tab (for copy/select scope)
  const activeItems = {
    slogans: filteredSlogans.map((s, i) => ({ key: `ps-${i}`, text: s.text })),
    quotes:  filteredQuotes.map((q, i)  => ({ key: `vq-${i}`, text: q })),
    social:  filteredSocial.map((s, i)  => ({ key: `sr-${i}`, text: s.text })),
    debate:  filteredDebate.map((d, i)  => ({ key: `dr-${i}`, text: d })),
  };

  const toggleSelect = (key) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // Reset selection + search when switching tabs
  const switchTab = (tab) => {
    setActiveSubTab(tab);
    setSearch('');
    setSelected(new Set());
  };

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success('הועתק'); }
    catch { toast.error('לא ניתן להעתיק'); }
  };

  const saveToBrain = async (text) => {
    try {
      await appendToLibraryAndVault({
        text,
        categoryKey: 'political',
        videoTitle: video?.title || '',
        channel: video?.channelTitle || '',
        date: video?.publishedAt || '',
        url: video?.url || video?.link || '',
      });
      toast.success('נשמר במוח');
    } catch { toast.error('שגיאה בשמירה למוח'); }
  };

  // Copy only the active tab's visible items
  const copyActiveTab = async () => {
    const texts = activeItems[activeSubTab].map((x) => x.text);
    if (!texts.length) { toast.info('אין פריטים בכרטיסייה זו'); return; }
    try { await navigator.clipboard.writeText(texts.join('\n')); toast.success(`${texts.length} פריטים הועתקו`); }
    catch { toast.error('לא ניתן להעתיק'); }
  };

  const saveSelected = async () => {
    const texts = activeItems[activeSubTab]
      .filter((x) => selected.has(x.key))
      .map((x) => x.text);
    if (texts.length === 0) { toast.error('לא נבחרו פריטים'); return; }
    let saved = 0;
    for (const text of texts) {
      try {
        await appendToLibraryAndVault({
          text, categoryKey: 'political',
          videoTitle: video?.title || '', channel: video?.channelTitle || '',
          date: video?.publishedAt || '', url: video?.url || video?.link || '',
        });
        saved++;
      } catch {}
    }
    toast.success(`${saved} פריטים נשמרו במוח`);
    setSelected(new Set());
  };

  const copyCampaignKit = async () => {
    const top = (arr, n = 10) => arr.slice(0, n);
    const lines = [
      '# סיסמאות', ...top(slogans.map((s) => s.text)).map((t, i) => `${i + 1}. ${t}`),
      '', '# ציטוטים', ...top(quotes).map((t, i) => `${i + 1}. ${t}`),
      '', '# תגובות לרשת', ...top(socialItems.map((s) => s.text)).map((t, i) => `${i + 1}. ${t}`),
      '', '# תגובות לויכוחים', ...top(debateReplies).map((t, i) => `${i + 1}. ${t}`),
    ].join('\n');
    try { await navigator.clipboard.writeText(lines); toast.success('✅ חבילת קמפיין הועתקה'); }
    catch { toast.error('לא ניתן להעתיק'); }
  };

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
        אין עדיין סיסמאות וציטוטים. נסה לנתח מחדש עם ניתוח פוליטי מלא.
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── Sub-tab buttons ── */}
      <div className="flex flex-wrap items-center gap-2">
        {SUB_TABS.map(({ key, emoji, label, colorActive }) => {
          const count = countsByTab[key];
          if (count === 0) return null;
          const isActive = activeSubTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? colorActive + ' shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500'
              }`}
            >
              {emoji} {label}
              <span className={`inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px] ${
                isActive ? 'bg-current/20 opacity-90' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search + actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={`חפש ב${SUB_TABS.find(t => t.key === activeSubTab)?.label ?? ''}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            dir="rtl"
          />
        </div>
        <button
          type="button"
          onClick={copyActiveTab}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
        >
          <Copy className="h-3.5 w-3.5" />
          העתק כרטיסייה
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={saveSelected}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors"
          >
            🧠 שמור נבחרים ({selected.size})
          </button>
        )}
        <button
          type="button"
          onClick={copyCampaignKit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 shadow-sm transition-opacity"
        >
          📋 חבילת קמפיין
        </button>
      </div>

      {/* ── Active tab content ── */}
      {activeSubTab === 'slogans' && (
        <SloganSection emoji="📢" title="סיסמאות מרכזיות" count={filteredSlogans.length}>
          {filteredSlogans.map((s, i) => (
            <div key={`ps-${videoId}-${i}`} className="flex items-start gap-2">
              <input type="checkbox" checked={selected.has(`ps-${i}`)} onChange={() => toggleSelect(`ps-${i}`)} className="mt-1 shrink-0 rounded accent-indigo-600" />
              <div className="flex-1">
                <SloganCard text={s.text} tone={s.tone} confidence={s.confidence} sourceIdea={s.sourceIdea} onCopy={() => copyText(s.text)} />
              </div>
              <button type="button" onClick={() => saveToBrain(s.text)} className="mt-1 shrink-0 rounded-lg border border-emerald-200 p-1.5 text-emerald-500 hover:bg-emerald-50 transition-colors dark:border-emerald-800 dark:hover:bg-emerald-950/30" title="שמור במוח">🧠</button>
            </div>
          ))}
        </SloganSection>
      )}

      {activeSubTab === 'quotes' && (
        <SloganSection emoji="🔥" title="ציטוטים ויראליים" count={filteredQuotes.length}>
          {filteredQuotes.map((q, i) => (
            <div key={`vq-${videoId}-${i}`} className="flex items-start gap-2">
              <input type="checkbox" checked={selected.has(`vq-${i}`)} onChange={() => toggleSelect(`vq-${i}`)} className="mt-1 shrink-0 rounded accent-indigo-600" />
              <div className="flex flex-1 items-start justify-between gap-2 rounded-xl border border-slate-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                <span className="flex-1 text-sm leading-snug text-slate-800 dark:text-zinc-100 font-medium text-right">{q}</span>
                <button type="button" onClick={() => copyText(q)} className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:border-zinc-700 dark:hover:bg-zinc-800" title="העתק"><Copy className="h-3.5 w-3.5" /></button>
              </div>
              <button type="button" onClick={() => saveToBrain(q)} className="mt-1 shrink-0 rounded-lg border border-emerald-200 p-1.5 text-emerald-500 hover:bg-emerald-50 transition-colors dark:border-emerald-800 dark:hover:bg-emerald-950/30" title="שמור במוח">🧠</button>
            </div>
          ))}
        </SloganSection>
      )}

      {activeSubTab === 'social' && (
        <SloganSection emoji="💬" title="תגובות לרשת" count={filteredSocial.length}>
          {filteredSocial.map((s, i) => (
            <div key={`sr-${videoId}-${i}`} className="flex items-start gap-2">
              <input type="checkbox" checked={selected.has(`sr-${i}`)} onChange={() => toggleSelect(`sr-${i}`)} className="mt-1 shrink-0 rounded accent-indigo-600" />
              <div className="flex-1">
                <SloganCard text={s.text} tone={s.tone} useCase={s.useCase} sourceIdea={s.sourceIdea} confidence={0} onCopy={() => copyText(s.text)} />
              </div>
              <button type="button" onClick={() => saveToBrain(s.text)} className="mt-1 shrink-0 rounded-lg border border-emerald-200 p-1.5 text-emerald-500 hover:bg-emerald-50 transition-colors dark:border-emerald-800 dark:hover:bg-emerald-950/30" title="שמור במוח">🧠</button>
            </div>
          ))}
        </SloganSection>
      )}

      {activeSubTab === 'debate' && (
        <SloganSection emoji="⚔️" title="תגובות לוויכוחים" count={filteredDebate.length}>
          {filteredDebate.map((d, i) => (
            <div key={`dr-${videoId}-${i}`} className="flex items-start gap-2">
              <input type="checkbox" checked={selected.has(`dr-${i}`)} onChange={() => toggleSelect(`dr-${i}`)} className="mt-1 shrink-0 rounded accent-indigo-600" />
              <div className="flex flex-1 items-start justify-between gap-2 rounded-xl border border-slate-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                <span className="flex-1 text-sm leading-snug text-rose-800 dark:text-rose-200 text-right">{d}</span>
                <button type="button" onClick={() => copyText(d)} className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:border-zinc-700 dark:hover:bg-zinc-800" title="העתק"><Copy className="h-3.5 w-3.5" /></button>
              </div>
              <button type="button" onClick={() => saveToBrain(d)} className="mt-1 shrink-0 rounded-lg border border-emerald-200 p-1.5 text-emerald-500 hover:bg-emerald-50 transition-colors dark:border-emerald-800 dark:hover:bg-emerald-950/30" title="שמור במוח">🧠</button>
            </div>
          ))}
        </SloganSection>
      )}
    </div>
  );
}

export function FundamentalKnowledgePanel({
  video,
  fundamentalSelectableFields,
  politicalObsidianSelections,
  setPoliticalObsidianSelections,
  totalFundamentalSelectedItems,
  allFundamentalSelectionKeys,
  fundamentalKbFilter,
  setFundamentalKbFilter,
  knowledgeTypeFilter,
  setKnowledgeTypeFilter,
  onSaveSelected,
  showToolbar = true,
  videoId,
  videoTitle,
}) {
  const toggleFSel = (key) =>
    setPoliticalObsidianSelections((prev) => ({ ...prev, [key]: prev[key] !== true }));

  // Metadata for Knowledge Library save
  const libVideoMeta = {
    videoTitle: video?.title || "",
    channel: video?.channelTitle || video?.channel || "",
    date: video?.publishedAt || video?.analyzedAt || "",
    url: video?.url || (video?.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : ""),
  };

  // Persistent saved-state: item.key → path
  const [librarySavedPaths, setLibrarySavedPaths] = useState({});
  // item.key → true if vault write confirmed, false if vault write failed (null=unknown/pre-existing)
  const [libraryVaultStatus, setLibraryVaultStatus] = useState({});

  useEffect(() => {
    const result = {};
    for (const section of fundamentalSelectableFields) {
      for (const item of section.items) {
        const p = getLibraryPathForItem({
          sectionKey: section.key,
          knowledgeTypes: item.knowledgeTypes ?? [],
          text: item.text,
          itemKey: item.key,
        });
        if (p && isInLibraryAtPath(item.text, p)) result[item.key] = p;
      }
    }
    setLibrarySavedPaths(result);
    setLibraryVaultStatus({}); // vault status unknown for pre-existing saves
  }, [videoId]);

  // Auto-open Obsidian setting
  const [autoOpenObsidian, setAutoOpenObsidian] = useState(() => getKBSettings().autoOpenObsidian);
  const handleAutoOpenToggle = (checked) => {
    setAutoOpenObsidian(checked);
    setKBSettings({ autoOpenObsidian: checked });
  };

  // Called by KnowledgeCheckboxRow after a library save attempt
  const makeAfterLibrarySave = (itemKey) => (result) => {
    if (result.saved || result.isDuplicate) {
      setLibrarySavedPaths(prev => ({ ...prev, [itemKey]: result.path }));
      setLibraryVaultStatus(prev => ({ ...prev, [itemKey]: result.verified === true }));
    }

    if (result.verified) {
      if (autoOpenObsidian && result.obsidianUrl) {
        console.log("[KnowledgeLibrary] open url", result.obsidianUrl);
        openObsidianUrl(result.obsidianUrl, { bypassDedupe: true });
        toast.success("נשמר למאגר הידע", {
          description: `📂 ${result.path}\n🚀 Obsidian נפתח אוטומטית`,
          icon: "✅",
          duration: 4000,
        });
      } else {
        toast.success("נשמר למאגר הידע", { description: `📂 ${result.path}`, icon: "✅", duration: 3000 });
      }
    } else if (result.isDuplicate) {
      toast.info("כבר קיים במאגר", { description: `📂 ${result.path}` });
    } else {
      toast.warning("לא הצלחתי ליצור או לעדכן את קובץ Obsidian", {
        description: result.vaultError ? `📂 ${result.path}\n${result.vaultError}` : `📂 ${result.path}`,
        duration: 5000,
      });
    }
  };

  const filterTabs = [
    { id: "all", label: "הכל", emoji: "" },
    ...fundamentalSelectableFields.map((f) => ({ id: f.key, label: f.label, emoji: f.emoji })),
  ];
  const sectionFilteredSections =
    fundamentalKbFilter === "all"
      ? fundamentalSelectableFields
      : fundamentalSelectableFields.filter((f) => f.key === fundamentalKbFilter);

  const activeKtFilter = knowledgeTypeFilter instanceof Set ? knowledgeTypeFilter : new Set();
  const filterItemsByType = (items) => {
    if (activeKtFilter.size === 0) return items;
    return items.filter(item => {
      const types = Array.isArray(item.knowledgeTypes) ? item.knowledgeTypes : [];
      if (activeKtFilter.has('__none__') && types.length === 0) return true;
      return types.some(t => activeKtFilter.has(t));
    });
  };
  const filteredSections = sectionFilteredSections
    .map(s => ({ ...s, items: filterItemsByType(s.items) }))
    .filter(s => s.items.length > 0);

  const allVisibleItems = sectionFilteredSections.flatMap(s => s.items);
  const hasFData = fundamentalSelectableFields.some((f) => f.items.length > 0);

  if (!hasFData) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
        אין עדיין ידע מובנה מהסרטון
      </div>
    );
  }

  const visibleKeys = filteredSections.flatMap((f) => f.items.map((item) => item.key));

  // Per-section selected counts (for tab badges)
  const selectedCountBySectionKey = Object.fromEntries(
    fundamentalSelectableFields.map((f) => [
      f.key,
      f.items.filter((item) => politicalObsidianSelections[item.key] === true).length,
    ])
  );
  const categoriesWithSelection = fundamentalSelectableFields.filter(
    (f) => f.items.some((item) => politicalObsidianSelections[item.key] === true)
  ).length;

  const filterTabItems = filterTabs.map((tab) => ({
    ...tab,
    count:
      tab.id === "all"
        ? fundamentalSelectableFields.reduce((s, f) => s + f.items.length, 0)
        : fundamentalSelectableFields.find((f) => f.key === tab.id)?.items.length ?? 0,
    selectedCount:
      tab.id === "all"
        ? totalFundamentalSelectedItems
        : (selectedCountBySectionKey[tab.id] ?? 0),
  }));

  const selectedHint =
    totalFundamentalSelectedItems > 0 && categoriesWithSelection > 1
      ? `נבחרו ${totalFundamentalSelectedItems} פריטים מ-${categoriesWithSelection} קטגוריות`
      : undefined;

  const ktHandlers = setKnowledgeTypeFilter ? {
    onToggle: (id) => {
      const next = new Set(activeKtFilter);
      if (next.has(id)) next.delete(id); else next.add(id);
      setKnowledgeTypeFilter(next);
    },
    onClear: () => setKnowledgeTypeFilter(new Set()),
  } : null;

  return (
    <div className="space-y-3" dir="rtl">
      <KnowledgeFilterTabs
        tabs={filterTabItems}
        activeId={fundamentalKbFilter}
        onSelect={setFundamentalKbFilter}
        endSlot={ktHandlers && (
          <KnowledgeTypeButton
            allItems={allVisibleItems}
            selectedTypes={activeKtFilter}
            onToggle={ktHandlers.onToggle}
            onClear={ktHandlers.onClear}
          />
        )}
      />

      {ktHandlers && (
        <KnowledgeTypeActiveBadges
          selectedTypes={activeKtFilter}
          onToggle={ktHandlers.onToggle}
          onClear={ktHandlers.onClear}
        />
      )}

      {/* Knowledge Library auto-open setting */}
      <div className="flex items-center rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-1.5 dark:border-zinc-800/60 dark:bg-zinc-900/40" dir="rtl">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 select-none">
          <input
            type="checkbox"
            checked={autoOpenObsidian}
            onChange={(e) => handleAutoOpenToggle(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 accent-violet-600"
          />
          <span>🧠 פתח אוטומטית ב-Obsidian לאחר שמירת פריט למאגר הידע</span>
        </label>
      </div>

      {showToolbar && (
        <BrainSaveToolbar
          video={video}
          selectedCount={totalFundamentalSelectedItems}
          totalCount={allFundamentalSelectionKeys.length}
          selectedHint={selectedHint}
          onClear={() =>
            setPoliticalObsidianSelections((prev) => {
              const n = { ...prev };
              visibleKeys.forEach((k) => { n[k] = false; });
              return n;
            })
          }
          onClearAll={() =>
            setPoliticalObsidianSelections((prev) => {
              const n = { ...prev };
              allFundamentalSelectionKeys.forEach((k) => { n[k] = false; });
              return n;
            })
          }
          onSelectAll={() =>
            setPoliticalObsidianSelections((prev) => {
              const n = { ...prev };
              visibleKeys.forEach((k) => { n[k] = true; });
              return n;
            })
          }
          onSave={onSaveSelected}
        />
      )}

      <div className="space-y-3">
        {filteredSections.map((section) => (
            <KnowledgeCategorySection
              key={section.key}
              categoryKey={section.key}
              title={section.label}
              emoji={section.emoji}
            >
              {section.items.map((item) => {
                const isSel = politicalObsidianSelections[item.key] === true;
                const route = resolveLibraryRoute({
                  sectionKey: section.key,
                  knowledgeTypes: item.knowledgeTypes ?? [],
                  text: item.text,
                  itemKey: item.key,
                });
                const libPath = route.targetPath;
                return (
                  <KnowledgeCheckboxRow
                    key={item.key}
                    categoryKey={section.key}
                    checked={isSel}
                    onToggle={() => toggleFSel(item.key)}
                    className="rounded-none border-0"
                    videoId={videoId}
                    rowKey={item.key}
                    videoTitle={videoTitle}
                    knowledgeTypes={item.knowledgeTypes}
                    targetPath={libPath || null}
                    onSaveToLibrary={libPath
                      ? (userNote) => {
                          console.log("[KnowledgeLibrary] resolved route", route);
                          const textToSave = userNote
                            ? `${item.text}\n\nהערה אישית: ${userNote}`
                            : item.text;
                          return appendToLibraryAndVault({ text: textToSave, path: libPath, ...libVideoMeta });
                        }
                      : undefined}
                    librarySavedPath={librarySavedPaths[item.key] ?? null}
                    libraryVaultWritten={libraryVaultStatus[item.key] ?? null}
                    onAfterLibrarySave={libPath ? makeAfterLibrarySave(item.key) : undefined}
                  >
                    {item.text}
                  </KnowledgeCheckboxRow>
                );
              })}
            </KnowledgeCategorySection>
          ))}
      </div>
    </div>
  );
}

export function GeneralUsefulKnowledgePanel({
  video,
  brainHighlights,
  selectedItems,
  persistSelectedItems,
  totalSelectedKnowledgeItems,
  onOpenBulkSave,
  showToolbar = true,
  showPerItemActions = false,
  renderItemActions = null,
  videoId,
  videoTitle,
}) {
  const keyPoints = Array.isArray(video.keyPoints) ? video.keyPoints.filter(Boolean) : [];
  const hasKeyPoints = keyPoints.length > 0;
  const hasBrainHighlights = brainHighlights.length > 0;

  if (!hasKeyPoints && !hasBrainHighlights) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
        אין עדיין ידע שימושי מובנה מהסרטון
      </div>
    );
  }

  const toggleItem = (itemKey) => {
    const isSelected = !!selectedItems[itemKey];
    persistSelectedItems({ ...selectedItems, [itemKey]: !isSelected });
  };

  const totalSelectable = brainHighlights.length + keyPoints.length;

  return (
    <div className="space-y-4" dir="rtl">
      {showToolbar && (
        <BrainSaveToolbar
          video={video}
          selectedCount={totalSelectedKnowledgeItems}
          totalCount={totalSelectable}
          onClear={() => persistSelectedItems({})}
          onSelectAll={() => {
            const next = {};
            brainHighlights.forEach((_, i) => {
              next[`brainHighlights:${i}`] = true;
            });
            keyPoints.forEach((_, i) => {
              next[`keyPoints:${i}`] = true;
            });
            persistSelectedItems(next);
          }}
          onSave={onOpenBulkSave}
        />
      )}

      {hasBrainHighlights && (
        <KnowledgeCategorySection categoryKey="insight" title="תובנות מרכזיות" emoji="⚡">
          {brainHighlights.map((point, i) => {
            const itemKey = `brainHighlights:${i}`;
            return (
              <KnowledgeCheckboxRow
                key={itemKey}
                categoryKey="insight"
                checked={!!selectedItems[itemKey]}
                onToggle={() => toggleItem(itemKey)}
                className="rounded-none border-0"
                videoId={videoId}
                rowKey={itemKey}
                videoTitle={videoTitle}
              >
                {point}
              </KnowledgeCheckboxRow>
            );
          })}
        </KnowledgeCategorySection>
      )}

      {hasKeyPoints && (
        <KnowledgeCategorySection categoryKey="keyPoints" title="ידע שימושי" emoji="📌">
          {keyPoints.map((point, i) => {
            const itemKey = `keyPoints:${i}`;
            const statement = String(point ?? "").trim();
            return (
              <div key={itemKey} className="group">
                <KnowledgeCheckboxRow
                  categoryKey="keyPoints"
                  checked={!!selectedItems[itemKey]}
                  onToggle={() => toggleItem(itemKey)}
                  className="rounded-none border-0"
                  videoId={videoId}
                  rowKey={itemKey}
                  videoTitle={videoTitle}
                >
                  {statement}
                </KnowledgeCheckboxRow>
                {showPerItemActions && renderItemActions?.({ itemKey, statement, index: i })}
              </div>
            );
          })}
        </KnowledgeCategorySection>
      )}
    </div>
  );
}

// ─── MarketBrief App Building ──────────────────────────────────────────────────

const MB_EXISTING_INDICATORS = ["SPX", "Nasdaq", "VIX", "Dollar", "Bitcoin", "Dow", "Russell"];

function MarketBriefAppBuildingSection({ analysis, onSaveAppItems }) {
  const newIndicators = analysis?.appBuilding?.newIndicators || [];
  const dashboardIdeas = analysis?.appBuilding?.dashboardIdeas || [];
  const existingIndicators = Array.isArray(analysis?.appBuilding?.existingIndicators)
    ? analysis.appBuilding.existingIndicators
    : MB_EXISTING_INDICATORS;

  const [selectedInds, setSelectedInds] = useState(() => new Set());
  const [selectedIdeas, setSelectedIdeas] = useState(() => new Set());

  const toggleInd = (i) => setSelectedInds((prev) => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });
  const toggleIdea = (i) => setSelectedIdeas((prev) => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });

  const totalSelected = selectedInds.size + selectedIdeas.size;

  const buildPrompt = (ind) =>
    ind.claudeCodePrompt ||
    `Build a React component named ${ind.componentSuggestion || "NewIndicatorCard"} ` +
    `that displays ${ind.name}${ind.ticker ? ` (${ind.ticker})` : ""} with RTL Hebrew UI.\n` +
    `Data source: ${ind.source || "API"}, updates: ${ind.updateFrequency || "realtime"}.\n` +
    `Purpose: ${ind.whyUseful || ""}`;

  const copyPrompt = async (ind) => {
    try { await navigator.clipboard.writeText(buildPrompt(ind)); toast.success("פרומפט הועתק"); }
    catch { toast.error("לא ניתן להעתיק"); }
  };

  const handleSave = () => {
    if (!onSaveAppItems || totalSelected === 0) { toast.info("לא נבחרו פריטים"); return; }
    const items = [
      ...[...selectedInds].map((i) => ({ _type: "indicator", ...newIndicators[i] })),
      ...[...selectedIdeas].map((i) => ({ _type: "dashboardIdea", ...dashboardIdeas[i] })),
    ];
    onSaveAppItems(items);
  };

  const CB = "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer";

  return (
    <div className="space-y-3" dir="rtl">
      {/* New indicators */}
      <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/60 px-4 py-4 dark:border-indigo-800/40 dark:bg-indigo-950/30">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-indigo-800 dark:text-indigo-200">
          <span>✨</span> מדדים חדשים לאפליקציה
        </h4>
        {newIndicators.length > 0 ? (
          <div className="space-y-2">
            {newIndicators.map((ind, i) => (
              <label key={i} className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-white/80 px-3 py-3 cursor-pointer hover:bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-zinc-900/60 dark:hover:bg-indigo-950/30">
                <input type="checkbox" checked={selectedInds.has(i)} onChange={() => toggleInd(i)} className={CB} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    {ind.ticker && <span className="font-bold text-indigo-700 dark:text-indigo-300">{ind.ticker}</span>}
                    {ind.name && ind.name !== ind.ticker && <span className="mr-1 text-slate-700 dark:text-zinc-300"> — {ind.name}</span>}
                    {ind.value && <span className="mr-1.5 text-xs text-emerald-600 dark:text-emerald-400">{ind.value}</span>}
                  </p>
                  {ind.whyUseful && <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">💡 {ind.whyUseful}</p>}
                  {ind.componentSuggestion && (
                    <p className="mt-0.5 text-[11px] text-indigo-500 dark:text-indigo-400">
                      קומפוננטה: <span className="font-mono">{ind.componentSuggestion}</span>
                    </p>
                  )}
                  {(ind.source || ind.updateFrequency) && (
                    <p className="mt-0.5 text-[10px] text-slate-400 dark:text-zinc-500">
                      {[ind.source, ind.updateFrequency].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); copyPrompt(ind); }}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                >
                  📋
                </button>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-zinc-500">⚪ אין מדדים חדשים בסרטון זה</p>
        )}
      </div>

      {/* Dashboard ideas */}
      {dashboardIdeas.length > 0 && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 px-4 py-4 dark:border-amber-800/40 dark:bg-amber-950/20">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-200">
            <span>💡</span> רעיונות לדשבורד
          </h4>
          <div className="space-y-2">
            {dashboardIdeas.map((idea, i) => (
              <label key={i} className="flex items-start gap-2 rounded-lg border border-amber-100 bg-white/80 px-3 py-3 cursor-pointer hover:bg-amber-50/60 dark:border-amber-900/40 dark:bg-zinc-900/60">
                <input type="checkbox" checked={selectedIdeas.has(i)} onChange={() => toggleIdea(i)} className={CB} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{idea.component}</p>
                  {idea.idea && <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">{idea.idea}</p>}
                  {idea.whyUseful && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">{idea.whyUseful}</p>}
                </div>
                {idea.claudeCodePrompt && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(idea.claudeCodePrompt).catch(() => {}); toast.success("פרומפט הועתק"); }}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                  >
                    📋
                  </button>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      {(newIndicators.length > 0 || dashboardIdeas.length > 0) && (
        <button
          type="button"
          onClick={handleSave}
          disabled={totalSelected === 0}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            totalSelected > 0
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
          )}
        >
          💾 שמור נבחרים למוח{totalSelected > 0 ? ` (${totalSelected})` : ""}
        </button>
      )}

      {/* Existing indicators */}
      <div className="rounded-xl border border-slate-200 bg-white/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950/30">
        <h4 className="mb-2 text-xs font-semibold text-slate-500 dark:text-zinc-400">✅ כבר בדשבורד</h4>
        <div className="flex flex-wrap gap-1.5">
          {existingIndicators.map((name) => (
            <span
              key={name}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              ✅ {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MarketBriefKnowledgeTab({
  video,
  marketBriefSelectableFields,
  politicalObsidianSelections,
  setPoliticalObsidianSelections,
  totalMarketBriefSelectedItems,
  allMarketBriefSelectionKeys,
  marketBriefKbFilter,
  setMarketBriefKbFilter,
  onSaveSelected,
  onSaveAppItems,
  videoId,
  videoTitle,
}) {
  const analysis = video?.analysis || {};
  const newIndicators = analysis?.appBuilding?.newIndicators || [];

  const isAppTab = marketBriefKbFilter === "mb_app";

  const filteredSections =
    marketBriefKbFilter === "all" || isAppTab
      ? marketBriefSelectableFields
      : marketBriefSelectableFields.filter((f) => f.key === marketBriefKbFilter);

  const selectedCountBySectionKey = Object.fromEntries(
    marketBriefSelectableFields.map((f) => [
      f.key,
      f.items.filter((item) => politicalObsidianSelections[item.key] === true).length,
    ])
  );
  const categoriesWithSelection = marketBriefSelectableFields.filter((f) =>
    f.items.some((item) => politicalObsidianSelections[item.key] === true)
  ).length;

  const visibleKeys = (marketBriefKbFilter === "all" || isAppTab
    ? marketBriefSelectableFields
    : marketBriefSelectableFields.filter((f) => f.key === marketBriefKbFilter)
  ).flatMap((f) => f.items.map((item) => item.key));

  const filterTabItems = [
    { id: "all",    label: "הכל",         emoji: "",    count: marketBriefSelectableFields.reduce((s, f) => s + f.items.length, 0), selectedCount: totalMarketBriefSelectedItems },
    ...marketBriefSelectableFields.map((f) => ({
      id: f.key, label: f.label, emoji: f.emoji,
      count: f.items.length,
      selectedCount: selectedCountBySectionKey[f.key] ?? 0,
    })),
    { id: "mb_app", label: "לאפליקציה", emoji: "🏗️", count: newIndicators.length, selectedCount: 0 },
  ];

  const selectedHint =
    totalMarketBriefSelectedItems > 0 && categoriesWithSelection > 1
      ? `נבחרו ${totalMarketBriefSelectedItems} פריטים מ-${categoriesWithSelection} קטגוריות`
      : undefined;

  return (
    <div className="space-y-3" dir="rtl">
      <KnowledgeFilterTabs
        tabs={filterTabItems}
        activeId={marketBriefKbFilter}
        onSelect={setMarketBriefKbFilter}
      />

      {!isAppTab && (
        <BrainSaveToolbar
          video={video}
          selectedCount={totalMarketBriefSelectedItems}
          totalCount={allMarketBriefSelectionKeys.length}
          selectedHint={selectedHint}
          onClear={() =>
            setPoliticalObsidianSelections((prev) => {
              const n = { ...prev };
              visibleKeys.forEach((k) => { n[k] = false; });
              return n;
            })
          }
          onClearAll={() =>
            setPoliticalObsidianSelections((prev) => {
              const n = { ...prev };
              allMarketBriefSelectionKeys.forEach((k) => { n[k] = false; });
              return n;
            })
          }
          onSelectAll={() =>
            setPoliticalObsidianSelections((prev) => {
              const n = { ...prev };
              visibleKeys.forEach((k) => { n[k] = true; });
              return n;
            })
          }
          onSave={onSaveSelected}
        />
      )}

      {isAppTab ? (
        <MarketBriefAppBuildingSection analysis={analysis} onSaveAppItems={onSaveAppItems} />
      ) : (
        <div className="space-y-3">
          {(marketBriefKbFilter === "all" ? marketBriefSelectableFields : filteredSections).map((section) => (
            <KnowledgeCategorySection
              key={section.key}
              categoryKey={section.key}
              title={section.label}
              emoji={section.emoji}
            >
              {section.items.map((item) => {
                const isSel = politicalObsidianSelections[item.key] === true;
                return (
                  <KnowledgeCheckboxRow
                    key={item.key}
                    categoryKey={section.key}
                    checked={isSel}
                    onToggle={() =>
                      setPoliticalObsidianSelections((prev) => ({
                        ...prev,
                        [item.key]: prev[item.key] !== true,
                      }))
                    }
                    className="rounded-none border-0"
                    videoId={videoId}
                    rowKey={item.key}
                    videoTitle={videoTitle}
                  >
                    {item.text}
                  </KnowledgeCheckboxRow>
                );
              })}
            </KnowledgeCategorySection>
          ))}
        </div>
      )}
    </div>
  );
}
