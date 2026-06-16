import { useState, useEffect, useCallback, useMemo } from "react";
import { Trash2, ExternalLink, ClipboardList } from "lucide-react";
import { TabBulkItemsRegistrar } from "@/components/dashboard/TabBulkItemsRegistrar";
import { extractAppIdeas, flattenAppIdeasBrain } from "@/lib/extractAppIdeas";
import { formatBrainItemForDisplay } from "@/lib/appIdeasBrainHumanization";
import {
  AppIdeaHeroSection,
  DevelopmentPromptSection,
  LogicFlowSection,
  RisksCardsSection,
  TasksChecklistSection,
  TriggersCardsSection,
} from "@/components/dashboard/AppBuilderWorkspaceSections";
import { toast } from "sonner";
import {
  APP_BUILDER_SECTIONS,
  getAppBuilderDraft,
  saveAppBuilderDraft,
  clearAppBuilderDraft,
  markExportedToObsidian,
  getExportStatus,
  mapUniversalAppBuilderToSections,
} from "@/lib/appBuilderStore";
import { getAppIdeasPath, buildAppIdeasNote } from "@/lib/obsidianExport";
import { getObsidianVaultRequestFields } from "@/lib/obsidianVaultConfig";
import { upsertKnowledgeItem } from "@/lib/localKnowledgeItemStore";
import { getGemUrl, openGeminiGemUrl } from "@/lib/gemsConfig";
import { AppBuilderGemDialog } from "@/components/dashboard/AppBuilderGemDialog";
import { AppBuilderPromptFallbackDialog } from "@/components/dashboard/AppBuilderPromptFallbackDialog";
import { getVideoTranscriptText } from "@/lib/videoTranscriptUtils";
import { splitTriggersAndRisks } from "@/lib/appBuilderDisplay";
import { AppIdeasBrainPanel } from "@/components/dashboard/AppIdeasBrainPanel";
import { ObsidianIcon } from "@/components/shared/ObsidianIcon";
import { UniversalTabSectionHeaderActions } from "@/components/shared/UniversalTabSectionHeaderActions";
import { formatSectionCopyText, mergeBulkSelection } from "@/lib/universalTabBulkItems";

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
export function AppBuilderTab({
  video,
  topicName = '',
  gemAppData = null,
  marketBriefData = null,
  bulkSelection = null,
  onBulkHandlersRef = null,
}) {
  const videoId = video?.videoId || video?.id || '';

  const [sections, setSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastExported, setLastExported] = useState(null);
  const [gemDialogOpen, setGemDialogOpen] = useState(false);
  const [promptFallback, setPromptFallback] = useState({ open: false, text: "" });

  // Load draft on video change. Existing localStorage draft wins; if empty, seed from universalTabs.app/appBuilder.
  useEffect(() => {
    if (!videoId) return;
    const draft = getAppBuilderDraft(videoId);
    const hasDraft = APP_BUILDER_SECTIONS.some(({ key }) => Boolean(draft[key]?.trim()));
    if (hasDraft) {
      setSections(draft);
    } else if (gemAppData) {
      const hydrated = mapUniversalAppBuilderToSections(gemAppData);
      setSections(hydrated);
    } else {
      setSections(draft);
    }
    setLastExported(getExportStatus(videoId).lastExported);
  }, [videoId, gemAppData]);

  const filledSections = APP_BUILDER_SECTIONS.filter(({ key }) => sections[key]?.trim());
  const hasDraft = filledSections.length > 0;

  const builderBulkItems = useMemo(() => filledSections.map(({ key, label }) => ({
    id: `app-builder:${key}`,
    text: sections[key]?.trim() || '',
    sectionLabel: label || key,
    type: 'app-builder',
    tabScope: 'app-builder',
    sectionKey: key,
  })), [filledSections, sections]);

  const brainBulkItems = useMemo(() => {
    const extracted = extractAppIdeas(video, marketBriefData);
    return flattenAppIdeasBrain(extracted).map((item) => {
      const { displayTitle } = formatBrainItemForDisplay(item);
      return {
        id: `app-ideas-brain:${item.id}`,
        text: displayTitle || item.title || item.content || '',
        sectionLabel: 'מוח רעיונות לאפליקציות',
        type: 'app-ideas-brain',
        tabScope: 'app-builder',
        rawItem: item,
      };
    });
  }, [video, marketBriefData]);

  const appTabBulkItems = useMemo(
    () => [...brainBulkItems, ...builderBulkItems],
    [brainBulkItems, builderBulkItems],
  );

  const isSelected = useCallback((key) => (
    bulkSelection?.multiSelected?.has(`app-builder:${key}`) ?? false
  ), [bulkSelection?.multiSelected]);

  const toggle = useCallback((key) => {
    const entry = builderBulkItems.find((b) => b.sectionKey === key);
    if (!entry || !bulkSelection?.onToggle) return;
    bulkSelection.onToggle(entry.id, entry);
  }, [builderBulkItems, bulkSelection]);

  const clearAll = useCallback(() => {
    bulkSelection?.onClear?.();
  }, [bulkSelection]);

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
    const { vaultPath, vaultName } = getObsidianVaultRequestFields();

    setSaving(true);
    try {
      const res = await fetch('/api/vault/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          content: markdown,
          vaultPath,
          vaultName,
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

  const selectedSectionKeys = useMemo(
    () => builderBulkItems.filter((b) => bulkSelection?.multiSelected?.has(b.id)).map((b) => b.sectionKey),
    [builderBulkItems, bulkSelection?.multiSelected],
  );

  // ── Save to Brain ───────────────────────────────────────────────────────────
  const handleSaveToBrain = useCallback((selectedKeys = null) => {
    const keysToSave = selectedKeys ?? selectedSectionKeys;
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
  }, [sections, selectedSectionKeys, video, topicName, clearAll]);

  useEffect(() => {
    if (!onBulkHandlersRef) return;
    onBulkHandlersRef.current = {
      saveBrain: () => handleSaveToBrain(selectedSectionKeys),
      saveObsidian: () => handleSaveToObsidian(selectedSectionKeys),
    };
  }, [onBulkHandlersRef, handleSaveToBrain, handleSaveToObsidian, selectedSectionKeys]);

  const toggleGroupSelect = useCallback((keys) => {
    const filled = keys.filter((k) => sections[k]?.trim());
    if (!filled.length) return;
    const allSelected = filled.every((k) => isSelected(k));
    filled.forEach((k) => {
      if (allSelected && isSelected(k)) toggle(k);
      if (!allSelected && !isSelected(k)) toggle(k);
    });
  }, [sections, isSelected, toggle]);

  const groupSelected = useCallback((keys) => {
    const filled = keys.filter((k) => sections[k]?.trim());
    return filled.length > 0 && filled.every((k) => isSelected(k));
  }, [sections, isSelected]);

  const copyGroup = useCallback((keys) => {
    const text = keys.map((k) => sections[k]).filter(Boolean).join('\n\n');
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => toast.success('הועתק'));
  }, [sections]);

  const copyRisksOnly = useCallback(() => {
    const { risks } = splitTriggersAndRisks(sections.risks ?? '');
    const text = risks.filter(Boolean).join('\n');
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => toast.success('הועתק'));
  }, [sections]);

  const copyTriggersOnly = useCallback(() => {
    const { triggers } = splitTriggersAndRisks(sections.risks ?? '');
    const text = triggers.filter(Boolean).join('\n');
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => toast.success('הועתק'));
  }, [sections]);

  const makeSectionHeaderActions = useCallback((title, saveText, copyText) => {
    const text = String(saveText || '').trim();
    if (!bulkSelection || !text) return null;
    return (
      <UniversalTabSectionHeaderActions
        text={text}
        copyText={copyText || formatSectionCopyText(title, [text])}
        bulkSelection={mergeBulkSelection(bulkSelection, {
          sectionLabel: title,
          type: 'app-builder',
          tabScope: 'app-builder',
        })}
        sectionLabel={title}
        type="app-builder"
        tabScope="app-builder"
      />
    );
  }, [bulkSelection]);

  const heroSectionText = ['summary', 'requirements', 'screens']
    .map((k) => sections[k]?.trim())
    .filter(Boolean)
    .join('\n\n');

  return (
    <div dir="rtl" className="space-y-2 pb-4">
      <TabBulkItemsRegistrar tab="app-builder" items={appTabBulkItems} />

      {/* ── App Ideas Brain (extracted from existing AI output) ── */}
      <AppIdeasBrainPanel
        video={video}
        marketBriefData={marketBriefData}
        topicName={topicName}
        bulkSelection={bulkSelection}
      />

      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 shrink-0">🏗️ APP Builder</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
      </div>

      {/* ── Header card ── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 px-4 py-3 space-y-2.5">

        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col text-right gap-0.5">
            <span className="text-base font-bold text-slate-800 dark:text-zinc-100">🚀 Product Builder</span>
            <span className="text-sm text-slate-500 dark:text-zinc-400">
              סביבת PRD — ערוך, בחר סעיפים ושמור ל-Obsidian / מוח
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
                <ObsidianIcon className="h-3 w-3" />
                יוצא ל-Obsidian: {formatExportDate(lastExported)}
              </span>
            )}
          </div>
        )}

      </div>

      {/* ── PRD workspace sections (presentation only — same storage keys) ── */}
      <div className="space-y-3" data-app-builder-workspace>
        <AppIdeaHeroSection
          summary={sections.summary ?? ''}
          requirements={sections.requirements ?? ''}
          screens={sections.screens ?? ''}
          onChangeSummary={(v) => handleChange('summary', v)}
          onChangeRequirements={(v) => handleChange('requirements', v)}
          isSelected={groupSelected(['summary', 'requirements'])}
          onToggleSelect={() => toggleGroupSelect(['summary', 'requirements'])}
          onCopy={() => copyGroup(['summary', 'requirements', 'screens'])}
          headerActions={makeSectionHeaderActions('🚀 רעיון לאפליקציה', heroSectionText)}
        />

        <LogicFlowSection
          value={sections.logic ?? ''}
          onChange={(v) => handleChange('logic', v)}
          isSelected={isSelected('logic')}
          onToggleSelect={() => sections.logic?.trim() && toggle('logic')}
          onCopy={() => handleCopySection('logic')}
          headerActions={makeSectionHeaderActions('🧠 לוגיקה עסקית', sections.logic?.trim())}
        />

        <RisksCardsSection
          risksText={sections.risks ?? ''}
          onChangeRisksBlob={(v) => handleChange('risks', v)}
          isSelected={isSelected('risks')}
          onToggleSelect={() => sections.risks?.trim() && toggle('risks')}
          onCopy={copyRisksOnly}
          headerActions={makeSectionHeaderActions('⚠️ סיכונים', splitTriggersAndRisks(sections.risks ?? '').risks.filter(Boolean).join('\n'))}
        />

        <TasksChecklistSection
          value={sections.tasks ?? ''}
          onChange={(v) => handleChange('tasks', v)}
          isSelected={isSelected('tasks')}
          onToggleSelect={() => sections.tasks?.trim() && toggle('tasks')}
          onCopy={() => handleCopySection('tasks')}
          headerActions={makeSectionHeaderActions('✅ משימות', sections.tasks?.trim())}
        />

        <TriggersCardsSection
          risksText={sections.risks ?? ''}
          onChangeRisksBlob={(v) => handleChange('risks', v)}
          isSelected={isSelected('risks')}
          onToggleSelect={() => sections.risks?.trim() && toggle('risks')}
          onCopy={copyTriggersOnly}
          headerActions={makeSectionHeaderActions('⚡ טריגרים', splitTriggersAndRisks(sections.risks ?? '').triggers.filter(Boolean).join('\n'))}
        />

        <DevelopmentPromptSection
          value={sections.prompt ?? ''}
          onChange={(v) => handleChange('prompt', v)}
          isSelected={isSelected('prompt')}
          onToggleSelect={() => sections.prompt?.trim() && toggle('prompt')}
          onCopy={() => handleCopySection('prompt')}
          headerActions={makeSectionHeaderActions('💻 פרומפט פיתוח', sections.prompt?.trim())}
          onInsertTemplate={handleInsertTemplate}
        />
      </div>

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
