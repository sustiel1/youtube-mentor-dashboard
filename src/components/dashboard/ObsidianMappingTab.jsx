/**
 * Obsidian mapping tab — end-user Hebrew workflow (draft only, no silent save).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { resolveVideoObsidianRoute } from '@/lib/obsidianRouting';

const TECH_ID_RE = /^t\d+$/i;

function normalizePill(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object') {
    return String(item.path || item.name || item.label || item.text || item.title || '').trim();
  }
  return String(item).trim();
}

function uniqueMerge(existing = [], incoming = []) {
  const out = [...existing.map(normalizePill).filter(Boolean)];
  const seen = new Set(out.map((s) => s.toLowerCase()));
  for (const item of incoming) {
    const n = normalizePill(item);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function cloneDraft(draft) {
  return {
    subCategory: draft.subCategory || '',
    obsidianTopics: [...(draft.obsidianTopics || [])],
    tags: [...(draft.tags || [])],
    relatedTopics: [...(draft.relatedTopics || [])],
    obsidianPath: draft.obsidianPath || '',
  };
}

function resolveTopicLabel(item, topicsById) {
  if (item && typeof item === 'object') {
    const name = normalizePill(item.name || item.label || item.title);
    if (name) return name;
  }
  const raw = normalizePill(item);
  if (!raw) return '';
  const topic = topicsById.get(raw);
  if (topic?.name) return String(topic.name).trim();
  if (TECH_ID_RE.test(raw)) return '';
  return raw;
}

function resolveTopicLabels(items = [], topics = []) {
  const topicsById = new Map((Array.isArray(topics) ? topics : []).map((t) => [t.id, t]));
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const label = resolveTopicLabel(item, topicsById);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** Route GEM section keys to display buckets (display only). */
function bucketGemSections(gemSections = []) {
  const buckets = {
    primaryCategory: [],
    suggestedSubCategory: [],
    obsidianTopics: [],
    tags: [],
    relatedTopics: [],
  };

  for (const section of gemSections) {
    const key = (section.key || '').toLowerCase();
    const items = Array.isArray(section.items) ? section.items : [];
    if (key === 'tags') buckets.tags.push(...items);
    else if (key === 'obsidiantopics' || key === 'obsidian_topics') buckets.obsidianTopics.push(...items);
    else if (key === 'relatedtopics' || key === 'related_topics') buckets.relatedTopics.push(...items);
    else if (key === 'suggestedsubtopics' || key === 'suggested_sub_topics' || key === 'subtopics') {
      buckets.suggestedSubCategory.push(...items);
    } else if (key === 'category' || key === 'primarycategory') buckets.primaryCategory.push(...items);
    else buckets.relatedTopics.push(...items);
  }

  return buckets;
}

function buildAiRecommendations({
  gemSections = [],
  gemFlat = [],
  aiSubCategoryRec = null,
  gemRecommendedSubCategory = '',
  topics = [],
}) {
  const gemBuckets = bucketGemSections(gemSections);
  const subFromGem = gemBuckets.suggestedSubCategory.map(normalizePill).filter(Boolean)[0] || '';
  const subCategory =
    aiSubCategoryRec?.recommended ||
    subFromGem ||
    normalizePill(gemRecommendedSubCategory) ||
    '';

  const rawRelated = uniqueMerge(
    gemBuckets.relatedTopics.map(normalizePill).filter(Boolean),
    gemFlat.map(normalizePill).filter(Boolean),
  );

  return {
    subCategory,
    obsidianTopics: gemBuckets.obsidianTopics.map(normalizePill).filter(Boolean),
    tags: gemBuckets.tags.map(normalizePill).filter(Boolean),
    relatedTopics: resolveTopicLabels(rawRelated, topics),
    confidence: aiSubCategoryRec?.confidence ?? null,
    source: aiSubCategoryRec?.source || aiSubCategoryRec?.reason || null,
  };
}

function confidenceMeta(pct) {
  const n = typeof pct === 'number' ? (pct <= 1 ? Math.round(pct * 100) : Math.round(pct)) : null;
  if (n == null || Number.isNaN(n)) return null;
  if (n >= 90) {
    return {
      label: `🟢 ביטחון גבוה (${n}%)`,
      short: '🟢 ביטחון גבוה',
      cls: 'text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    };
  }
  if (n >= 70) {
    return {
      label: `🟡 ביטחון בינוני (${n}%)`,
      short: '🟡 ביטחון בינוני',
      cls: 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    };
  }
  return {
    label: `🔴 ביטחון נמוך (${n}%)`,
    short: '🔴 ביטחון נמוך',
    cls: 'text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
  };
}

function formatTagLabel(tag) {
  const t = normalizePill(tag);
  if (!t) return '';
  return t.startsWith('#') ? t : `#${t}`;
}

function ConfidenceBadge({ pct }) {
  const meta = confidenceMeta(pct);
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function Chip({ children, variant = 'default' }) {
  const cls = {
    default: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700',
    category: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700 text-sm font-bold px-4 py-2',
    sub: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
    obsidian: 'bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-800',
    tag: 'bg-slate-50 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 text-[11px]',
    related: 'bg-teal-50 dark:bg-teal-950/25 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cls[variant] || cls.default}`}>
      {children}
    </span>
  );
}

function ChipRow({ items = [], variant = 'default', formatItem = (x) => x }) {
  const pills = items.map(formatItem).filter(Boolean);
  if (pills.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 justify-end">
      {pills.map((pill, i) => (
        <Chip key={`${pill}-${i}`} variant={variant}>{pill}</Chip>
      ))}
    </div>
  );
}

function SectionBlock({ title, count, children, className = '' }) {
  if (!children) return null;
  const countSuffix = count != null && count > 0 ? ` (${count})` : '';
  return (
    <section className={`rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 px-4 py-3 ${className}`}>
      <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-200 mb-2.5 text-right">
        {title}{countSuffix}
      </h3>
      {children}
    </section>
  );
}

function buildPathTree({ category, subCategory, fileName }) {
  const lines = [];
  const cat = normalizePill(category);
  const sub = normalizePill(subCategory);
  const file = normalizePill(fileName);
  if (cat) lines.push({ indent: 0, prefix: '', text: cat });
  if (sub) lines.push({ indent: 1, prefix: '└── ', text: sub });
  if (file) lines.push({ indent: 2, prefix: sub ? '    └── ' : '└── ', text: file });
  return lines;
}

function recommendationSourceLabel(aiRec, aiSubCategoryRec) {
  if (aiSubCategoryRec?.reason) return aiSubCategoryRec.reason;
  if (aiRec.source) return `מקור: ניתוח GEM (${aiRec.source})`;
  return 'מקור: המלצת AI מהניתוח';
}

export function ObsidianMappingTab({
  category = '',
  subCategory = '',
  tags = [],
  obsidianTopics = [],
  obsidianPath = '',
  suggestedSubTopics = [],
  relatedTopicIds = [],
  topics = [],
  gemSections = [],
  gemFlat = [],
  aiSubCategoryRec = null,
  gemConfidencePct = null,
  videoTitle = '',
  videoId = '',
  onDraftChange,
  onConfirmRecommendation,
  onConfirmAndSaveToObsidian,
  onRequestObsidianSave,
  obsidianAlreadySaved = false,
  savedObsidianPath = '',
  onOpenSavedObsidian,
}) {
  const initialDraft = useMemo(() => ({
    subCategory: normalizePill(subCategory) || normalizePill(suggestedSubTopics[0]) || '',
    obsidianTopics: uniqueMerge(obsidianPath ? [obsidianPath] : [], obsidianTopics),
    tags: tags.map(normalizePill).filter(Boolean),
    relatedTopics: resolveTopicLabels(relatedTopicIds, topics),
    obsidianPath: normalizePill(obsidianPath),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [draft, setDraft] = useState(initialDraft);
  const [baseline, setBaseline] = useState(initialDraft);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const [applied, setApplied] = useState(false);
  const [appliedFields, setAppliedFields] = useState(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recDismissed, setRecDismissed] = useState(false);
  const [isEditingSub, setIsEditingSub] = useState(false);
  const [subEditDraft, setSubEditDraft] = useState('');
  // 'idle' | 'saving' | 'success' | 'error'
  const [confirmState, setConfirmState] = useState('idle');
  // Combined confirm + vault save flow
  const [obsState, setObsState] = useState('idle');
  const [obsSavedPath, setObsSavedPath] = useState('');
  const skipPropSyncRef = useRef(false);
  const obsSuccessTimerRef = useRef(null);

  // Reset confirm feedback only when switching videos (not on every prop sync)
  useEffect(() => {
    setConfirmState('idle');
    setObsState('idle');
    setObsSavedPath('');
  }, [videoId]);

  useEffect(() => () => {
    if (obsSuccessTimerRef.current) clearTimeout(obsSuccessTimerRef.current);
  }, []);

  const aiRec = useMemo(
    () => buildAiRecommendations({
      gemSections,
      gemFlat,
      aiSubCategoryRec,
      gemRecommendedSubCategory: '',
      topics,
    }),
    [gemSections, gemFlat, aiSubCategoryRec, topics],
  );

  const confidencePct = useMemo(() => {
    const c = aiRec.confidence ?? (gemConfidencePct != null ? gemConfidencePct / 100 : null);
    if (c == null) return gemConfidencePct;
    return c <= 1 ? Math.round(c * 100) : Math.round(c);
  }, [aiRec.confidence, gemConfidencePct]);

  const hasAiRecommendations =
    !!aiRec.subCategory ||
    aiRec.obsidianTopics.length > 0 ||
    aiRec.tags.length > 0 ||
    aiRec.relatedTopics.length > 0;

  const displayRelatedTopics = useMemo(
    () => resolveTopicLabels(draft.relatedTopics, topics),
    [draft.relatedTopics, topics],
  );

  useEffect(() => {
    if (skipPropSyncRef.current) {
      skipPropSyncRef.current = false;
      return;
    }
    const next = {
      subCategory: normalizePill(subCategory) || normalizePill(suggestedSubTopics[0]) || '',
      obsidianTopics: uniqueMerge(obsidianPath ? [obsidianPath] : [], obsidianTopics),
      tags: tags.map(normalizePill).filter(Boolean),
      relatedTopics: resolveTopicLabels(relatedTopicIds, topics),
      obsidianPath: normalizePill(obsidianPath),
    };
    setDraft(next);
    setBaseline(next);
    setUndoSnapshot(null);
    setApplied(false);
    setAppliedFields(new Set());
    setRecDismissed(false);
    setIsEditingSub(false);
  }, [videoId, subCategory, obsidianPath, obsidianTopics, tags, relatedTopicIds, suggestedSubTopics, topics]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  const obsidianRoute = useMemo(
    () => resolveVideoObsidianRoute({ category, subCategory: draft.subCategory, title: videoTitle }),
    [category, draft.subCategory, videoTitle],
  );

  const displayFileName = useMemo(() => {
    const title = normalizePill(videoTitle);
    if (title) {
      const safe = title.replace(/[\\/:*?"<>|]/g, '').slice(0, 72);
      return `${safe}.md`;
    }
    return obsidianRoute.fileName || '';
  }, [videoTitle, obsidianRoute.fileName]);

  const pathTree = useMemo(
    () => buildPathTree({ category, subCategory: draft.subCategory, fileName: displayFileName }),
    [category, draft.subCategory, displayFileName],
  );

  const isFieldManual = useCallback((field) => {
    if (field === 'subCategory') return draft.subCategory !== baseline.subCategory;
    if (field === 'obsidianTopics') return JSON.stringify(draft.obsidianTopics) !== JSON.stringify(baseline.obsidianTopics);
    if (field === 'tags') return JSON.stringify(draft.tags) !== JSON.stringify(baseline.tags);
    if (field === 'relatedTopics') return JSON.stringify(draft.relatedTopics) !== JSON.stringify(baseline.relatedTopics);
    return false;
  }, [draft, baseline]);

  const hasManualEdits = useMemo(
    () => !applied && ['subCategory', 'obsidianTopics', 'tags', 'relatedTopics'].some((f) => isFieldManual(f)),
    [applied, isFieldManual],
  );

  const applyRecommendations = useCallback(() => {
    setUndoSnapshot(cloneDraft(draft));
    const next = cloneDraft(draft);
    if (aiRec.subCategory) next.subCategory = aiRec.subCategory;
    next.obsidianTopics = uniqueMerge(next.obsidianTopics, aiRec.obsidianTopics);
    next.tags = uniqueMerge(next.tags, aiRec.tags);
    next.relatedTopics = uniqueMerge(
      resolveTopicLabels(next.relatedTopics, topics),
      aiRec.relatedTopics,
    );
    if (aiRec.obsidianTopics[0]) next.obsidianPath = aiRec.obsidianTopics[0];
    skipPropSyncRef.current = true;
    setDraft(next);
    setApplied(true);
    setAppliedFields(new Set(['subCategory', 'obsidianTopics', 'tags', 'relatedTopics']));
    setRecDismissed(false);
    setIsEditingSub(false);
    setConfirmOpen(false);
  }, [aiRec, draft, topics]);

  const actionsBusy = confirmState === 'saving' || obsState === 'saving';

  // Shared local apply after a successful confirm (draft, path preview, badges)
  const applyConfirmedSubLocally = useCallback(() => {
    setUndoSnapshot((prev) => prev || cloneDraft(draft));
    skipPropSyncRef.current = true;
    setDraft((prev) => ({ ...prev, subCategory: aiRec.subCategory }));
    setAppliedFields((prev) => new Set([...prev, 'subCategory']));
    setRecDismissed(false);
    setIsEditingSub(false);
  }, [aiRec.subCategory, draft]);

  const handleConfirmAndSaveObsidian = useCallback(() => {
    if (!aiRec.subCategory || actionsBusy) return;
    if (obsidianAlreadySaved && onOpenSavedObsidian) {
      onOpenSavedObsidian();
      return;
    }
    if (onRequestObsidianSave) {
      onRequestObsidianSave(aiRec.subCategory);
      return;
    }
    if (onConfirmAndSaveToObsidian) {
      setObsState('saving');
      onConfirmAndSaveToObsidian(aiRec.subCategory)
        .then((result) => {
          applyConfirmedSubLocally();
          setObsSavedPath(result?.savedPath || '');
          setObsState('success');
          toast.success('ההמלצה אושרה ונשמרה ב-Obsidian');
        })
        .catch(() => {
          setObsState('error');
          toast.error('שמירת ההמלצה ל-Obsidian נכשלה — נסה שוב');
        });
    }
  }, [
    aiRec.subCategory,
    actionsBusy,
    applyConfirmedSubLocally,
    obsidianAlreadySaved,
    onConfirmAndSaveToObsidian,
    onOpenSavedObsidian,
    onRequestObsidianSave,
  ]);

  const handleConfirmRec = useCallback(async () => {
    if (!aiRec.subCategory || confirmState === 'saving') return;
    setConfirmState('saving');
    try {
      if (onConfirmRecommendation) {
        await onConfirmRecommendation(aiRec.subCategory);
      }
      // Immediate visual update: draft, path preview, status badges
      setUndoSnapshot((prev) => prev || cloneDraft(draft));
      skipPropSyncRef.current = true;
      setDraft((prev) => ({ ...prev, subCategory: aiRec.subCategory }));
      setAppliedFields((prev) => new Set([...prev, 'subCategory']));
      setRecDismissed(false);
      setIsEditingSub(false);
      setConfirmState('success');
      toast.success('המלצת ה-AI נשמרה בהצלחה');
    } catch (err) {
      console.warn('[ObsidianMapping] confirm save failed:', err?.message);
      setConfirmState('error');
      toast.error('שמירת ההמלצה נכשלה — נסה שוב');
    }
  }, [aiRec.subCategory, confirmState, draft, onConfirmRecommendation]);

  const handleApplyClick = () => {
    if (!hasAiRecommendations) return;
    if (hasManualEdits) {
      setConfirmOpen(true);
      return;
    }
    applyRecommendations();
  };

  const handleUndo = () => {
    if (!undoSnapshot) return;
    skipPropSyncRef.current = true;
    setDraft(cloneDraft(undoSnapshot));
    setUndoSnapshot(null);
    setApplied(false);
    setAppliedFields(new Set());
    setRecDismissed(false);
    setIsEditingSub(false);
  };

  const handleRejectRec = () => {
    setRecDismissed(true);
    setIsEditingSub(false);
  };

  const handleStartManualEdit = () => {
    setSubEditDraft(draft.subCategory || aiRec.subCategory || '');
    setIsEditingSub(true);
  };

  const handleSaveManualSub = () => {
    const trimmed = subEditDraft.trim();
    if (!trimmed) return;
    setUndoSnapshot((prev) => prev || cloneDraft(draft));
    skipPropSyncRef.current = true;
    setDraft((prev) => ({ ...prev, subCategory: trimmed }));
    setIsEditingSub(false);
    setRecDismissed(false);
  };

  const primaryCategory = normalizePill(category);
  const showSubRec = Boolean(aiRec.subCategory) && !recDismissed
    && normalizePill(draft.subCategory).toLowerCase() !== normalizePill(aiRec.subCategory).toLowerCase()
    && !appliedFields.has('subCategory');

  const subCategoryStatus = appliedFields.has('subCategory')
    ? 'הוחל'
    : isFieldManual('subCategory')
      ? 'נערך ידנית'
      : showSubRec
        ? 'המלצת AI'
        : null;

  const hasContent =
    primaryCategory ||
    draft.subCategory ||
    showSubRec ||
    draft.obsidianTopics.length > 0 ||
    draft.tags.length > 0 ||
    displayRelatedTopics.length > 0 ||
    hasAiRecommendations;

  if (!hasContent && !primaryCategory) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-zinc-500" dir="rtl">
        <span className="text-3xl mb-2 opacity-30">🗂️</span>
        <p className="text-sm font-medium">אין עדיין מיפוי לסרטון זה</p>
        <p className="text-xs mt-1 text-slate-400">הרץ ניתוח AI או הגדר נושא ידנית כדי להתחיל</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      {/* ── פעולה ראשית ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 px-3 py-2.5">
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          {applied ? 'המלצות הוחלו לטיוטה — עדיין לא נשמרו' : 'סקור את המיפוי והחל המלצות לפני שמירה'}
        </p>
        <div className="flex flex-wrap gap-2">
          {undoSnapshot && (
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
            >
              ↩ בטל החלה אחרונה
            </button>
          )}
          <button
            type="button"
            onClick={handleApplyClick}
            disabled={!hasAiRecommendations}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            🤖 קבל המלצות AI
          </button>
        </div>
      </div>

      {/* ── 1. נושא ראשי ── */}
      {primaryCategory && (
        <SectionBlock title="📂 נושא ראשי">
          <div className="flex justify-end">
            <Chip variant="category">{primaryCategory}</Chip>
          </div>
        </SectionBlock>
      )}

      {/* ── 2. תת נושא מומלץ ── */}
      {(draft.subCategory || showSubRec || isEditingSub) && (
        <SectionBlock title="🧠 תת נושא מומלץ">
          <div className="space-y-2.5 text-right">
            {subCategoryStatus && (
              <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">{subCategoryStatus}</p>
            )}

            {isEditingSub ? (
              <div className="flex flex-col gap-2 items-stretch">
                <input
                  type="text"
                  value={subEditDraft}
                  onChange={(e) => setSubEditDraft(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="הקלד תת נושא..."
                  dir="rtl"
                />
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleSaveManualSub}
                    disabled={!subEditDraft.trim()}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    שמור
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingSub(false)}
                    className="rounded-lg border border-slate-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-base font-bold text-slate-800 dark:text-zinc-100">
                  {draft.subCategory || aiRec.subCategory}
                </p>

                {confidencePct != null && (showSubRec || !draft.subCategory) && (
                  <div className="flex justify-end">
                    <ConfidenceBadge pct={confidencePct} />
                  </div>
                )}

                {showSubRec && (
                  <div className="flex items-center min-h-[64px] rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/25 px-4 py-3">
                    <p className="w-full max-w-prose mr-0 ml-auto text-[15px] leading-7 font-medium text-slate-800 dark:text-zinc-100 text-right">
                      💡 {recommendationSourceLabel(aiRec, aiSubCategoryRec)}
                    </p>
                  </div>
                )}

                {showSubRec && (
                  <div className="flex flex-wrap items-center gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleConfirmRec}
                      disabled={actionsBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
                    >
                      {confirmState === 'saving' ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          שומר...
                        </>
                      ) : (
                        '✅ אשר המלצה'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleRejectRec}
                      disabled={actionsBusy}
                      className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/40 disabled:opacity-50 transition-colors"
                    >
                      ❌ דחה
                    </button>
                    <button
                      type="button"
                      onClick={handleStartManualEdit}
                      disabled={actionsBusy}
                      className="rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                    >
                      ✏️ ערוך ידנית
                    </button>
                    {obsidianAlreadySaved ? (
                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          ✓ נשמר ל-Obsidian
                        </span>
                        <button
                          type="button"
                          onClick={handleConfirmAndSaveObsidian}
                          disabled={actionsBusy}
                          className="inline-flex items-center gap-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-4 py-2 text-sm font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/50 disabled:opacity-60 transition-colors"
                        >
                          📂 פתח ב-Obsidian
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConfirmAndSaveObsidian}
                        disabled={actionsBusy}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
                      >
                        {obsState === 'saving' ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            ⏳ שומר...
                          </>
                        ) : (
                          '✨ אשר ושמור ל-Obsidian'
                        )}
                      </button>
                    )}
                  </div>
                )}

                {showSubRec && confirmState === 'error' && (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 text-right">
                    ❌ שמירת ההמלצה נכשלה — נסה שוב
                  </p>
                )}

                {showSubRec && obsState === 'error' && (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 text-right">
                    ❌ שמירת ההמלצה נכשלה
                  </p>
                )}

                {confirmState === 'success' && (
                  <div className="flex justify-end pt-1">
                    <span className="animate-in zoom-in-50 fade-in duration-300 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      ✅ ההמלצה נשמרה
                    </span>
                  </div>
                )}

                {(obsState === 'success' || (obsidianAlreadySaved && savedObsidianPath)) && (
                  <div className="animate-in zoom-in-50 fade-in duration-300 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-right space-y-1">
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      ✅ ההמלצה אושרה ונשמרה ב-Obsidian
                    </p>
                    {(obsSavedPath || savedObsidianPath) && (
                      <p className="text-[11px] font-mono text-emerald-600/80 dark:text-emerald-400/80 truncate" dir="ltr">
                        📁 {obsSavedPath || savedObsidianPath}
                      </p>
                    )}
                  </div>
                )}

                {!showSubRec && draft.subCategory && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleStartManualEdit}
                      className="rounded-lg border border-slate-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                      ✏️ ערוך ידנית
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </SectionBlock>
      )}

      {/* ── 3. נתיב Obsidian — תמיד גלוי ── */}
      <section className="rounded-xl border-2 border-violet-200/80 dark:border-violet-800/50 bg-violet-50/30 dark:bg-violet-950/15 px-4 py-3">
        <h3 className="text-sm font-bold text-violet-800 dark:text-violet-200 mb-2.5 text-right">
          📁 נתיב השמירה ב-Obsidian
        </h3>
        {pathTree.length > 0 ? (
          <div className="font-mono text-sm text-right space-y-0.5" dir="rtl">
            {pathTree.map((line, i) => (
              <p
                key={`${line.text}-${i}`}
                className={`${i === 0 ? 'font-bold text-violet-900 dark:text-violet-100' : 'text-violet-700 dark:text-violet-300'}`}
                style={{ paddingRight: `${line.indent * 16}px` }}
              >
                {line.prefix}{line.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-right">בחר תת נושא כדי לראות את יעד השמירה</p>
        )}
      </section>

      {/* ── 4. נושאי Obsidian ── */}
      {draft.obsidianTopics.length > 0 && (
        <SectionBlock title="📚 נושאי Obsidian" count={draft.obsidianTopics.length}>
          <ChipRow items={draft.obsidianTopics} variant="obsidian" />
        </SectionBlock>
      )}

      {/* ── 5. תגיות ── */}
      {draft.tags.length > 0 && (
        <SectionBlock title="🏷️ תגיות" count={draft.tags.length}>
          <ChipRow items={draft.tags} variant="tag" formatItem={formatTagLabel} />
        </SectionBlock>
      )}

      {/* ── 6. נושאים קשורים ── */}
      {displayRelatedTopics.length > 0 && (
        <SectionBlock title="🔗 נושאים קשורים" count={displayRelatedTopics.length}>
          <ChipRow items={displayRelatedTopics} variant="related" />
        </SectionBlock>
      )}

      <p className="text-[10px] text-slate-400 dark:text-zinc-500 text-center px-2 pb-1">
        השינויים בטיוטה מקומית בלבד — שמור ניתוח או תת-נושא כדי לשמור לצמיתות.
      </p>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent dir="rtl" className="text-right">
          <DialogHeader>
            <DialogTitle>להחליף ערכים שעודכנו ידנית?</DialogTitle>
            <DialogDescription className="text-right">
              זיהינו עריכה ידנית במיפוי. קבלת המלצות AI תמזג ערכים חדשים ועלולה לדרוס שינויים שביצעת.
              האם להמשיך?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
            <button
              type="button"
              onClick={applyRecommendations}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              כן, קבל המלצות
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300"
            >
              ביטול
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
