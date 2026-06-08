import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, Save, Trash2, Copy, CheckSquare, Square, ExternalLink, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import {
  APP_BUILDER_SECTIONS,
  getAppBuilderDraft,
  saveAppBuilderDraft,
  clearAppBuilderDraft,
  markExportedToObsidian,
  getExportStatus,
} from "@/lib/appBuilderStore";
import { getAppIdeasPath, buildAppIdeasNote } from "@/lib/obsidianExport";
import { getActiveObsidianVaultConfig } from "@/lib/obsidianVaultConfig";
import { BulkSelectionBar } from "@/components/shared/BulkSelectionBar";
import { useSelection } from "@/hooks/useSelection";
import { upsertKnowledgeItem } from "@/lib/localKnowledgeItemStore";
import { getGemUrl, openGeminiGemUrl } from "@/lib/gemsConfig";
import { AppBuilderGemDialog } from "@/components/dashboard/AppBuilderGemDialog";
import { AppBuilderPromptFallbackDialog } from "@/components/dashboard/AppBuilderPromptFallbackDialog";
import { getVideoTranscriptText } from "@/lib/videoTranscriptUtils";

// ── Development Prompt quick-fill templates ───────────────────────────────────
const PROMPT_TEMPLATES = {
  claude: (videoTitle, topicName) =>
`# Claude Code Prompt

בנה עבורי אפליקציה בהתאם לרעיונות מהסרטון "${videoTitle}".
נושא: ${topicName}

## דרישות
[העתק כאן את תוכן סעיף הדרישות]

## מסכים
[העתק כאן את תוכן סעיף המסכים]

## לוגיקה עסקית
[העתק כאן את תוכן סעיף הלוגיקה]

## הנחיות פיתוח
- ממשק בעברית RTL
- React + Tailwind CSS
- פרק ל-components קטנים
- הוסף comments לכל function חשוב`,

  codex: (videoTitle, topicName) =>
`// App: ${videoTitle}
// Topic: ${topicName}
//
// Build the following application based on the video analysis.
//
// === Requirements ===
// [paste from Requirements section]
//
// === Screens ===
// [paste from Screens section]
//
// === Business Logic ===
// [paste from Logic section]
//
// Tech Stack: React, TypeScript, Tailwind CSS`,

  base44: (videoTitle, topicName) =>
`# Base44 Implementation Prompt

צור אפליקציה Base44 עבור: ${videoTitle}
נושא: ${topicName}

## Entities נדרשים
[תאר כאן את ה-entities הנדרשים]

## Backend Functions
[תאר כאן את ה-functions הנדרשים]

## Pages & Components
[תאר כאן את ה-pages וה-components הנדרשים]

## Stack
- Platform: Base44
- Frontend: React
- Style: Tailwind CSS + Hebrew RTL`,
};

function formatVideoDuration(video) {
  const d = video?.duration;
  if (typeof d === "string" && d.includes(":")) return d;
  const secs = Number(video?.durationSeconds || d);
  if (!Number.isFinite(secs) || secs <= 0) return null;
  return `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
}

/** Builds the full GEM prompt including video metadata and actual transcript text. */
function buildAppBuilderGemPrompt(video, topicName, transcriptText) {
  const title = video?.title || "הסרטון";
  const vId = video?.videoId || video?.id || "";
  const url = vId ? `https://www.youtube.com/watch?v=${encodeURIComponent(vId)}` : null;
  const channel = (video?.channelTitle || video?.channelName || video?.channel || "").trim() || null;
  const duration = formatVideoDuration(video);

  const metaLines = [
    "## Video Metadata",
    url      ? `URL: ${url}`         : null,
    channel  ? `Channel: ${channel}` : null,
    `Title: ${title}`,
    duration ? `Duration: ${duration}` : null,
    topicName ? `Topic: ${topicName}` : null,
  ].filter((l) => l !== null);

  const lines = [
    "# APP Builder Analysis",
    "",
    ...metaLines,
    "",
    "## Transcript",
    '"""',
    transcriptText,
    '"""',
    "",
    "## Instructions",
    "Analyze the transcript above and return a JSON object in EXACTLY this format.",
    "Return ONLY the JSON — no markdown, no code blocks, no explanation:",
    "",
    '{',
    '  "contentType": "appBuilder",',
    '  "summary": "What app can be built based on this video content",',
    '  "requirements": ["User requirement 1", "User requirement 2"],',
    '  "screens": ["Screen/page 1", "Screen/page 2"],',
    '  "logic": ["Business rule 1", "Automation rule 2"],',
    '  "risks": ["Technical risk 1", "UX risk 2"],',
    '  "tasks": ["MVP task 1", "Development task 2"],',
    '  "developmentPrompt": {',
    '    "claudeCode": "Ready-to-use Claude Code prompt in Hebrew",',
    '    "codex": "Ready-to-use Codex comment prompt in English",',
    '    "base44": "Ready-to-use Base44 implementation prompt in Hebrew"',
    '  }',
    '}',
  ];

  return lines.join("\n").trim();
}

function formatExportDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return null;
  }
}

/**
 * §26 APP Builder tab.
 * Paste-back flow per section + Development Prompt templates.
 * Saves to: localStorage (draft) + Brain + Obsidian vault (App Ideas/{topic}/).
 */
export function AppBuilderTab({ video, topicName = '' }) {
  const videoId = video?.videoId || video?.id || '';

  const [sections, setSections] = useState({});
  const [openSections, setOpenSections] = useState({ summary: true });
  const [saving, setSaving] = useState(false);
  const [lastExported, setLastExported] = useState(null);
  const [gemDialogOpen, setGemDialogOpen] = useState(false);
  const [promptFallback, setPromptFallback] = useState({ open: false, text: "" });

  // Load draft and export status whenever the video changes
  useEffect(() => {
    if (videoId) {
      setSections(getAppBuilderDraft(videoId));
      setLastExported(getExportStatus(videoId).lastExported);
    }
  }, [videoId]);

  const filledSections = APP_BUILDER_SECTIONS.filter(({ key }) => sections[key]?.trim());
  const hasDraft = filledSections.length > 0;

  const { selected, toggle, selectAll, clearAll, isSelected, count } = useSelection(
    filledSections.map(({ key }) => ({ id: key }))
  );

  const toggleSection = (key) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleChange = useCallback((key, value) => {
    setSections((prev) => {
      const next = { ...prev, [key]: value };
      saveAppBuilderDraft(videoId, { [key]: value });
      return next;
    });
  }, [videoId]);

  const handleClear = useCallback(() => {
    if (!videoId) return;
    clearAppBuilderDraft(videoId);
    setSections({});
    setLastExported(null);
    clearAll();
    toast.success('הטיוטה נמחקה');
  }, [videoId, clearAll]);

  const handleCopySection = useCallback((key) => {
    const text = sections[key];
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => toast.success('הועתק'));
  }, [sections]);

  // Insert a quick-fill template into the Development Prompt section
  const handleInsertTemplate = useCallback((templateKey) => {
    const videoTitle = video?.title || 'הסרטון';
    const template = PROMPT_TEMPLATES[templateKey]?.(videoTitle, topicName || 'כללי');
    if (template) {
      handleChange('prompt', template);
      setOpenSections((prev) => ({ ...prev, prompt: true }));
    }
  }, [video?.title, topicName, handleChange]);

  // ── Open GEM + copy full prompt (with transcript) ─────────────────────────
  const handleOpenGem = useCallback(async () => {
    // 1. Require transcript — do not open GEM without it
    const transcriptText = getVideoTranscriptText(video);
    if (!transcriptText) {
      toast.error("אין תמלול זמין לסרטון הזה. יש להדביק או לטעון תמלול לפני פתיחת ה-GEM");
      return;
    }

    if (import.meta.env.DEV) {
      console.debug("[AppBuilder GEM] transcript length:", transcriptText.length);
    }

    // 2. Build full prompt including transcript
    const prompt = buildAppBuilderGemPrompt(video, topicName, transcriptText);

    if (import.meta.env.DEV) {
      console.debug("[AppBuilder GEM] prompt length:", prompt.length);
    }

    // 3. Copy to clipboard; on failure show fallback dialog for manual copy
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("הפרומפט עם התמלול הועתק. הדבק אותו ב-GEM", { duration: 5000 });
    } catch {
      setPromptFallback({ open: true, text: prompt });
      // Continue — GEM still opens below
    }

    // 4. Open GEM URL
    const gemUrl = getGemUrl("appBuilder");
    if (!gemUrl) {
      toast.error("GEM לבונה אפליקציות לא מוגדר", { description: "הגדר URL ב-⚙ ניהול GEMS" });
      return;
    }
    if (!openGeminiGemUrl(gemUrl)) {
      toast.info("הפופ-אפ נחסם — פתח את ה-GEM ידנית בדפדפן");
    }
  }, [video, topicName]);

  // ── Apply JSON from GEM dialog ─────────────────────────────────────────────
  const handleApplyGemJson = useCallback((newSections, filledCount) => {
    setSections((prev) => {
      const merged = { ...prev, ...newSections };
      saveAppBuilderDraft(videoId, newSections);
      return merged;
    });
    // Open all newly filled sections
    setOpenSections((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.keys(newSections).map((k) => [k, true])),
    }));
    toast.success(`✅ ${filledCount} סעיפים הועתקו מ-GEM`, { duration: 4000 });
  }, [videoId]);

  // ── Save to Obsidian ────────────────────────────────────────────────────────
  const handleSaveToObsidian = useCallback(async (selectedKeys = null) => {
    const keysToSave = selectedKeys ?? Object.keys(sections).filter(k => sections[k]?.trim());
    if (!keysToSave.length) {
      toast.error('אין תוכן לשמירה');
      return;
    }
    const partialSections = Object.fromEntries(keysToSave.map(k => [k, sections[k]]));
    const markdown = buildAppIdeasNote(video, partialSections, topicName);
    const path = getAppIdeasPath(topicName, video?.title);
    const vaultConfig = getActiveObsidianVaultConfig();

    setSaving(true);
    try {
      const res = await fetch('/api/vault/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          content: markdown,
          vaultPath: vaultConfig.vaultPath,
          vaultName: vaultConfig.vaultName,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const now = new Date().toISOString();
        markExportedToObsidian(videoId);
        setLastExported(now);
        toast.success('✅ נשמר ל-Obsidian', { description: `נתיב: ${path}`, duration: 5000 });
        clearAll();
      } else {
        toast.error('שגיאה בשמירה ל-Obsidian', { description: data.error || 'בדוק חיבור Vault' });
      }
    } catch (err) {
      toast.error('שגיאה בשמירה ל-Obsidian', { description: err?.message });
    } finally {
      setSaving(false);
    }
  }, [sections, video, topicName, videoId, clearAll]);

  // ── Save to Brain ───────────────────────────────────────────────────────────
  const handleSaveToBrain = useCallback((selectedKeys = null) => {
    const keysToSave = selectedKeys ?? [...selected];
    if (!keysToSave.length) return;
    const vId = video?.videoId || video?.id;
    const videoUrl = vId ? `https://www.youtube.com/watch?v=${encodeURIComponent(vId)}` : null;
    const now = new Date().toISOString();
    let saved = 0;

    keysToSave.forEach((key) => {
      const text = sections[key]?.trim();
      if (!text) return;
      const sectionDef = APP_BUILDER_SECTIONS.find(s => s.key === key);
      const label = sectionDef?.label || key;
      upsertKnowledgeItem({
        id: `app-builder:${vId}:${key}`,
        title: `${label} — ${(video?.title || 'בונה אפליקציות').slice(0, 60)}`,
        topicId: video?.topicIds?.[0] || null,
        sourceType: 'youtube',
        sourceId: vId || '',
        kind: 'learning',
        markdown: [
          `# ${label} — ${video?.title || 'בונה אפליקציות'}`,
          '',
          text,
          videoUrl ? `\n---\nמקור: [${video?.title || ''}](${videoUrl})` : null,
        ].filter(v => v !== null).join('\n'),
        workspacePath: `App Ideas/${topicName || 'Future Projects'}/${key}.md`,
        createdAt: now,
        updatedAt: now,
        metadata: {
          videoId: vId || null,
          videoTitle: video?.title || null,
          videoUrl,
          sourceTab: 'app-builder',
          tabLabel: 'בונה אפליקציות',
          category: topicName || null,
          savedAt: now,
          contentRole: 'my_position',
          perspective: 'self',
          userPosition: 'endorsed',
        },
      });
      saved++;
    });

    if (saved > 0) {
      toast.success(`✅ נשמר למוח — ${saved} סעיפים`);
      clearAll();
    }
  }, [sections, selected, video, topicName, clearAll]);

  // Bulk handlers for BulkSelectionBar
  const handleBulkObsidian = useCallback(() => handleSaveToObsidian([...selected]), [selected, handleSaveToObsidian]);
  const handleBulkBrain    = useCallback(() => handleSaveToBrain([...selected]),    [selected, handleSaveToBrain]);

  return (
    <div dir="rtl" className="space-y-2 pb-4">

      {/* ── Header card ── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 px-4 py-3 space-y-2.5">

        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col text-right gap-0.5">
            <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">🏗️ בונה אפליקציות</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              הדבק תוצאות GEM לכל סעיף — שמור ל-Obsidian תחת App Ideas/{topicName || '...'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleClear}
              disabled={!hasDraft}
              title="מחק טיוטה"
              className="rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-100 disabled:opacity-40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* GEM action buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          <button
            type="button"
            onClick={handleOpenGem}
            className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/60 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            פתח GEM לבונה אפליקציות
          </button>
          <button
            type="button"
            onClick={() => setGemDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60 transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            הדבק JSON מ-GEM
          </button>
        </div>

        {/* Status badges */}
        {(hasDraft || lastExported) && (
          <div className="flex items-center gap-2 flex-wrap">
            {hasDraft && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                טיוטה מקומית ({filledSections.length} סעיפים)
              </span>
            )}
            {lastExported && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                🟣 יוצא ל-Obsidian: {formatExportDate(lastExported)}
              </span>
            )}
          </div>
        )}

        {/* Select All / Clear row */}
        {hasDraft && (
          <div className="flex items-center gap-3 pt-0.5">
            <button
              type="button"
              onClick={selectAll}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 transition-colors"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              בחר הכל
            </button>
            {count > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
              >
                <Square className="h-3.5 w-3.5" />
                בטל בחירה ({count})
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Section accordions ── */}
      {APP_BUILDER_SECTIONS.map(({ key, label, hint }) => {
        const isOpen   = !!openSections[key];
        const hasContent = !!sections[key]?.trim();
        const isSel    = isSelected(key);
        const isPrompt = key === 'prompt';

        return (
          <div
            key={key}
            className={`rounded-xl border transition-colors ${
              isSel
                ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/20'
                : 'border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50'
            }`}
          >
            {/* Section header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <input
                type="checkbox"
                checked={isSel}
                disabled={!hasContent}
                onChange={() => toggle(key)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 cursor-pointer disabled:opacity-30 shrink-0"
              />

              <button
                type="button"
                onClick={() => toggleSection(key)}
                className="flex flex-1 items-center justify-between gap-2 text-right"
              >
                <div className="flex flex-col items-start gap-0.5 text-right">
                  <span className={`text-sm font-medium flex items-center gap-1.5 ${hasContent ? 'text-slate-800 dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-500'}`}>
                    {label}
                    {hasContent && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />}
                  </span>
                  {hint && (
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight">
                      {hint}
                    </span>
                  )}
                </div>
                {isOpen
                  ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                }
              </button>

              {hasContent && (
                <button
                  type="button"
                  onClick={() => handleCopySection(key)}
                  title="העתק"
                  className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Section body */}
            {isOpen && (
              <div className="px-3 pb-3 space-y-2">

                {/* Development Prompt quick-fill templates */}
                {isPrompt && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">תבנית מהירה:</span>
                    {[
                      { id: 'claude', label: '⚡ Claude Code' },
                      { id: 'codex',  label: '🔵 Codex' },
                      { id: 'base44', label: '🟣 Base44' },
                    ].map(({ id, label: tLabel }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleInsertTemplate(id)}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300 transition-colors"
                      >
                        {tLabel}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  dir="rtl"
                  rows={isPrompt ? 10 : 5}
                  value={sections[key] ?? ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={hint ? `${hint}...` : `הדבק כאן תוכן עבור ${label}...`}
                  className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-right text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 font-sans leading-7 tracking-normal"
                />
              </div>
            )}
          </div>
        );
      })}

      {/* ── Bulk selection bar — Brain + Obsidian ── */}
      <BulkSelectionBar
        count={count}
        onBrain={handleBulkBrain}
        onObsidian={handleBulkObsidian}
        onClear={clearAll}
        disabled={saving}
      />

      {/* ── Clipboard fallback — shown when navigator.clipboard is blocked ── */}
      <AppBuilderPromptFallbackDialog
        open={promptFallback.open}
        onOpenChange={(v) => setPromptFallback((p) => ({ ...p, open: v }))}
        promptText={promptFallback.text}
      />

      {/* ── GEM paste-back dialog ── */}
      <AppBuilderGemDialog
        open={gemDialogOpen}
        onOpenChange={setGemDialogOpen}
        videoId={videoId}
        onApply={handleApplyGemJson}
      />
    </div>
  );
}
