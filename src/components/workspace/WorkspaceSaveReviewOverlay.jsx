import { useState, useMemo, useCallback, useEffect } from "react";
import { Star, Check, Maximize2, Minimize2, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useWorkspaceTopics, useWorkspaceItems } from "@/hooks/useWorkspaceLibrary";
import { saveWorkspaceItem } from "@/lib/workspaceLibraryStore";
import {
  VIRTUAL_TAXONOMY,
  getVirtTopicCounts,
  getVirtSubtopicCounts,
  filterByVirtTopic,
  filterByVirtSubtopic,
  groupItemsByVirtTopic,
  groupItemsByVirtSubtopic,
} from "@/utils/workspaceVirtualTaxonomy";
import {
  getWorkspaceTabPreferences,
  saveWorkspaceTabPreferences,
  resetWorkspaceTabPreferences,
  getVisibleMainTabs,
} from "@/utils/workspaceTabPreferences";

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function WorkspaceSaveReviewOverlay({
  open,
  onOpenChange,
  draftItems = [],                // [{ id, text, sectionLabel, type }] — from selection bar
  currentAnalysisDraftItems = [], // [{ id, text, sectionLabel, type }] — from top Workspace button
  defaultView = 'draft',          // which tab opens first
  videoContext = {},              // { videoTitle, channelName, thumbnail, videoUrl, sourceTab }
  onSaved,
}) {
  const { mainTopics, getSubTopics, addTopic } = useWorkspaceTopics();
  const { items: libraryItems, reload } = useWorkspaceItems();

  // ── Draft / save controls ────────────────────────────────────────────────────
  const [topicId,      setTopicId]      = useState('');
  const [subTopicId,   setSubTopicId]   = useState('');
  const [tags,         setTags]         = useState([]);
  const [tagInput,     setTagInput]     = useState('');
  const [flags,        setFlags]        = useState({ isFavorite: false, isImportant: false, mustWatchAgain: false });
  const [notes,        setNotes]        = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [showNewTopic, setShowNewTopic] = useState(false);

  // ── View / layout state ──────────────────────────────────────────────────────
  const [activeView,       setActiveView]       = useState(defaultView);
  const [recentlySavedIds, setRecentlySavedIds] = useState([]);
  const [isSaving,         setIsSaving]         = useState(false);
  const [isFullscreen,     setIsFullscreen]     = useState(false);

  // ── Virtual taxonomy navigation ──────────────────────────────────────────────
  const [filterVirtTopicId,  setFilterVirtTopicId]  = useState('');
  const [filterVirtSubtopic, setFilterVirtSubtopic] = useState('');

  // ── Tab preferences (UI-only, stored in workspace_tab_preferences_v1) ────────
  const [tabPrefs,        setTabPrefs]        = useState(() => getWorkspaceTabPreferences());
  const [showManageTabs,  setShowManageTabs]  = useState(false);
  const [editingTabId,    setEditingTabId]    = useState(null);
  const [editingTabLabel, setEditingTabLabel] = useState('');

  // loadedDraftItems: null = use prop draftItems; set by "load current analysis" action
  const [loadedDraftItems, setLoadedDraftItems] = useState(null);
  const effectiveDraftItems = loadedDraftItems ?? draftItems;

  // Reset on open
  useEffect(() => {
    if (open) {
      setActiveView(defaultView);
      setLoadedDraftItems(null);
      setFilterVirtTopicId('');
      setFilterVirtSubtopic('');
      setShowManageTabs(false);
      setEditingTabId(null);
      setEditingTabLabel('');
    }
  }, [open, defaultView]);

  const subTopics         = useMemo(() => getSubTopics(topicId), [getSubTopics, topicId]);
  const selectedMainTopic = useMemo(() => mainTopics.find(t => t.id === topicId),   [mainTopics, topicId]);
  const selectedSubTopic  = useMemo(() => subTopics.find(t => t.id === subTopicId), [subTopics,  subTopicId]);

  const allTopics = useMemo(
    () => [...mainTopics, ...mainTopics.flatMap(t => getSubTopics(t.id))],
    [mainTopics, getSubTopics],
  );

  // ── Virtual taxonomy computed ────────────────────────────────────────────────

  const virtTopicCount = useMemo(
    () => getVirtTopicCounts(libraryItems),
    [libraryItems],
  );

  const activeVirtTopic = useMemo(
    () => VIRTUAL_TAXONOMY.find(v => v.id === filterVirtTopicId) || null,
    [filterVirtTopicId],
  );

  // Items within the selected main virtual topic (not yet subtopic-filtered)
  const mainFilteredItems = useMemo(
    () => filterByVirtTopic(libraryItems, filterVirtTopicId),
    [libraryItems, filterVirtTopicId],
  );

  const virtSubtopicCount = useMemo(
    () => getVirtSubtopicCounts(mainFilteredItems, filterVirtTopicId),
    [mainFilteredItems, filterVirtTopicId],
  );

  // Final filtered list: main topic + optional subtopic
  const filteredLibraryItems = useMemo(
    () => filterByVirtSubtopic(mainFilteredItems, filterVirtTopicId, filterVirtSubtopic),
    [mainFilteredItems, filterVirtTopicId, filterVirtSubtopic],
  );

  const hasSubtopicFilter = !!filterVirtSubtopic;
  const hasTopicFilter    = !!filterVirtTopicId;

  // ── List views ───────────────────────────────────────────────────────────────

  // recentItems always from unfiltered list (user needs to see what they just saved)
  const recentItems = useMemo(
    () => recentlySavedIds.length > 0 ? libraryItems.filter(i => recentlySavedIds.includes(i.id)) : [],
    [libraryItems, recentlySavedIds],
  );

  // Topics view grouping
  const itemsByVirtTopic = useMemo(
    () => groupItemsByVirtTopic(filteredLibraryItems),
    [filteredLibraryItems],
  );

  const itemsByVirtSubtopic = useMemo(
    () => filterVirtTopicId ? groupItemsByVirtSubtopic(filteredLibraryItems, filterVirtTopicId) : {},
    [filteredLibraryItems, filterVirtTopicId],
  );

  const itemsByDate = useMemo(() => {
    const now       = new Date();
    const today     = now.toDateString();
    const yesterday = new Date(now - 86400000).toDateString();
    const weekAgo   = new Date(now - 7  * 86400000);
    const monthAgo  = new Date(now - 30 * 86400000);
    const groups    = { today: [], yesterday: [], thisWeek: [], thisMonth: [], older: [] };
    filteredLibraryItems.forEach(item => {
      const d  = new Date(item.savedAt);
      const ds = d.toDateString();
      if      (ds === today)     groups.today.push(item);
      else if (ds === yesterday) groups.yesterday.push(item);
      else if (d >= weekAgo)     groups.thisWeek.push(item);
      else if (d >= monthAgo)    groups.thisMonth.push(item);
      else                       groups.older.push(item);
    });
    return groups;
  }, [filteredLibraryItems]);

  const pinnedItems = useMemo(
    () => filteredLibraryItems.filter(i => i.flags?.isFavorite || i.flags?.isImportant),
    [filteredLibraryItems],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleOpenChange(isOpen) {
    if (!isOpen) {
      setTopicId('');
      setSubTopicId('');
      setTags([]);
      setTagInput('');
      setFlags({ isFavorite: false, isImportant: false, mustWatchAgain: false });
      setNotes('');
      setActiveView(defaultView);
      setRecentlySavedIds([]);
      setShowNewTopic(false);
      setNewTopicName('');
      setIsFullscreen(false);
      setLoadedDraftItems(null);
      setFilterVirtTopicId('');
      setFilterVirtSubtopic('');
    }
    onOpenChange(isOpen);
  }

  function commitTag(raw) {
    const t = raw.trim().toLowerCase().replace(/^#/, '');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTag(tagInput); }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) setTags(prev => prev.slice(0, -1));
  }

  function handleAddTopic() {
    if (!newTopicName.trim()) return;
    const t = addTopic({ name: newTopicName.trim() });
    setTopicId(t.id);
    setSubTopicId('');
    setNewTopicName('');
    setShowNewTopic(false);
  }

  function handleLoadCurrentAnalysis() {
    setLoadedDraftItems(currentAnalysisDraftItems);
    setActiveView('draft');
  }

  function handleSelectVirtTopic(vtId) {
    setFilterVirtTopicId(vtId);
    setFilterVirtSubtopic('');
  }

  // ── Tab preference handlers ────────────────────────────────────────────────
  const visibleMainTabs = useMemo(
    () => getVisibleMainTabs(VIRTUAL_TAXONOMY, tabPrefs),
    [tabPrefs],
  );

  function toggleTabVisibility(vtId) {
    const newPrefs = {
      ...tabPrefs,
      hiddenTabIds: tabPrefs.hiddenTabIds.includes(vtId)
        ? tabPrefs.hiddenTabIds.filter(id => id !== vtId)
        : [...tabPrefs.hiddenTabIds, vtId],
    };
    setTabPrefs(newPrefs);
    saveWorkspaceTabPreferences(newPrefs);
  }

  function saveTabLabel(vtId, label) {
    const overrides = { ...tabPrefs.labelOverrides };
    if (label.trim()) overrides[vtId] = label.trim();
    else delete overrides[vtId];
    const newPrefs = { ...tabPrefs, labelOverrides: overrides };
    setTabPrefs(newPrefs);
    saveWorkspaceTabPreferences(newPrefs);
    setEditingTabId(null);
    setEditingTabLabel('');
  }

  function handleResetTabPrefs() {
    const def = { hiddenTabIds: [], labelOverrides: {} };
    setTabPrefs(def);
    resetWorkspaceTabPreferences();
  }

  const handleSaveAll = useCallback(() => {
    if (effectiveDraftItems.length === 0) return;
    setIsSaving(true);
    const savedIds    = [];
    const now         = new Date().toISOString();
    const topicName    = selectedMainTopic?.name || '';
    const subTopicName = selectedSubTopic?.name  || '';

    effectiveDraftItems.forEach((item) => {
      const id = `ws-snippet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const titlePart = item.sectionLabel
        ? `${item.sectionLabel} — ${(videoContext.videoTitle || '').slice(0, 40)}`
        : (videoContext.videoTitle || '').slice(0, 60) || 'קטע נבחר';
      const combinedNotes = [item.text, notes].filter(Boolean).join('\n\n');

      saveWorkspaceItem({
        id,
        videoId:      null,
        videoUrl:     videoContext.videoUrl    || null,
        videoTitle:   titlePart.slice(0, 80),
        channelName:  videoContext.channelName || '',
        thumbnail:    videoContext.thumbnail   || null,
        topicId:      topicId    || null,
        subTopicId:   subTopicId || null,
        topicName,
        subTopicName,
        notes:        combinedNotes,
        flags,
        tags,
        sourceTab:    videoContext.sourceTab || 'Manual',
        category:     topicName    || null,
        subCategory:  subTopicName || null,
        savedAt:      now,
      });
      savedIds.push(id);
    });

    reload();
    setRecentlySavedIds(savedIds);
    setActiveView('recent');
    setIsSaving(false);
    toast.success(`⭐ ${savedIds.length} פריטים נשמרו ל-Workspace Library`);
    onSaved?.({ count: savedIds.length });
  }, [effectiveDraftItems, topicId, subTopicId, flags, tags, notes, videoContext, selectedMainTopic, selectedSubTopic, reload, onSaved]);

  // ── View tabs ─────────────────────────────────────────────────────────────────

  const VIEWS = [
    ...(effectiveDraftItems.length > 0 || currentAnalysisDraftItems.length > 0
      ? [{ key: 'draft', label: effectiveDraftItems.length > 0 ? `טיוטה (${effectiveDraftItems.length})` : 'טיוטה' }]
      : []),
    { key: 'recent', label: recentlySavedIds.length > 0 ? `נשמרו עכשיו (${recentlySavedIds.length})` : 'נשמרו עכשיו' },
    { key: 'topics', label: 'לפי נושאים' },
    { key: 'dates',  label: 'לפי תאריכים' },
    { key: 'pinned', label: 'מועדפים/חשובים' },
  ];

  const showAnalysisBanner = currentAnalysisDraftItems.length > 0 && loadedDraftItems === null && activeView !== 'draft';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        dir="rtl"
        className={cn(
          'flex flex-col p-0 gap-0 border-amber-200 dark:border-amber-900/40 transition-all duration-200',
          isFullscreen
            ? 'w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh]'
            : 'w-[min(96vw,900px)] max-h-[90vh]',
        )}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <DialogHeader className="shrink-0 border-b border-slate-200 dark:border-zinc-800 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-right text-base font-bold text-slate-900 dark:text-zinc-100">
              ⭐ Workspace Library
              <span className="text-xs font-normal text-slate-400 dark:text-zinc-500">
                — {libraryItems.length} פריטים שמורים
              </span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsFullscreen(f => !f)}
              title={isFullscreen ? 'צא ממסך מלא' : 'מסך מלא'}
              className="shrink-0 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5"
            >
              {isFullscreen
                ? <><Minimize2 className="h-3.5 w-3.5" /><span>צמצם</span></>
                : <><Maximize2 className="h-3.5 w-3.5" /><span>מסך מלא</span></>
              }
            </button>
          </div>
        </DialogHeader>

        {/* ── Row 1: Main domain tabs ───────────────────────────────────── */}
        {libraryItems.length > 0 && (
          <div className="shrink-0 bg-white dark:bg-zinc-950 px-4 pt-3 pb-0 border-b border-slate-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-2 overflow-x-auto pb-3 min-w-max">
              <button
                type="button"
                onClick={() => handleSelectVirtTopic('')}
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all',
                  !filterVirtTopicId
                    ? 'border-slate-800 bg-slate-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800',
                )}
              >
                הכל ({libraryItems.length})
              </button>
              {visibleMainTabs.filter(vt => virtTopicCount[vt.id]).map(vt => (
                <button
                  key={vt.id}
                  type="button"
                  onClick={() => handleSelectVirtTopic(vt.id)}
                  className={cn(
                    'rounded-xl border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all',
                    filterVirtTopicId === vt.id
                      ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-zinc-900 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800',
                  )}
                >
                  {vt.emoji} {vt.displayName} ({virtTopicCount[vt.id]})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowManageTabs(p => !p)}
                title="ערוך טאבים"
                className={cn(
                  'mr-auto shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all',
                  showManageTabs
                    ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
                    : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800',
                )}
              >
                ⚙ ערוך טאבים
              </button>
            </div>
          </div>
        )}

        {/* ── Manage tabs panel ─────────────────────────────────────────── */}
        {showManageTabs && (
          <div className="shrink-0 bg-amber-50/70 dark:bg-zinc-900/80 border-b border-amber-200 dark:border-zinc-700 px-4 py-3" dir="rtl">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">ניהול טאבים</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetTabPrefs}
                  className="text-xs text-slate-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:underline"
                >
                  ↺ איפוס לברירת מחדל
                </button>
                <button
                  type="button"
                  onClick={() => { setShowManageTabs(false); setEditingTabId(null); setEditingTabLabel(''); }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  ✕ סגור
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {VIRTUAL_TAXONOMY.map(vt => {
                const isHidden    = tabPrefs.hiddenTabIds.includes(vt.id);
                const isEditing   = editingTabId === vt.id;
                const displayName = tabPrefs.labelOverrides[vt.id] || vt.name;
                return (
                  <div
                    key={vt.id}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors',
                      isHidden
                        ? 'border-slate-200 bg-white/60 dark:border-zinc-800 dark:bg-zinc-950/40 opacity-55'
                        : 'border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTabVisibility(vt.id)}
                      title={isHidden ? 'הצג טאב' : 'הסתר טאב'}
                      className="shrink-0 text-base leading-none select-none"
                    >
                      {isHidden ? '🚫' : '👁'}
                    </button>
                    <span className="shrink-0 text-sm select-none">{vt.emoji}</span>
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={editingTabLabel}
                          onChange={e => setEditingTabLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  saveTabLabel(vt.id, editingTabLabel);
                            if (e.key === 'Escape') { setEditingTabId(null); setEditingTabLabel(''); }
                          }}
                          className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-0.5 text-sm text-right dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        <button type="button" onClick={() => saveTabLabel(vt.id, editingTabLabel)} className="shrink-0 text-xs font-semibold text-green-600 hover:underline">שמור</button>
                        <button type="button" onClick={() => { setEditingTabId(null); setEditingTabLabel(''); }} className="shrink-0 text-xs text-slate-400 hover:underline">ביטול</button>
                      </>
                    ) : (
                      <>
                        <span className={cn('text-sm flex-1 text-right', isHidden && 'line-through')}>{displayName}</span>
                        <button
                          type="button"
                          onClick={() => { setEditingTabId(vt.id); setEditingTabLabel(displayName); }}
                          title="ערוך שם טאב"
                          className="shrink-0 text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-600 dark:hover:text-zinc-400"
                        >
                          ✏
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Row 2: Subtopic tabs ──────────────────────────────────────── */}
        {activeVirtTopic && activeVirtTopic.subtopics.some(vs => virtSubtopicCount[vs.id] > 0) && (
          <div className="shrink-0 bg-slate-50/80 dark:bg-zinc-900/60 px-4 py-2.5 overflow-x-auto border-b border-slate-100 dark:border-zinc-800">
            <div className="flex gap-2 min-w-max">
              <button
                type="button"
                onClick={() => setFilterVirtSubtopic('')}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all',
                  !filterVirtSubtopic
                    ? 'border-slate-700 bg-slate-700 text-white dark:border-zinc-300 dark:bg-zinc-300 dark:text-zinc-900 shadow-sm'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800',
                )}
              >
                כולם ({mainFilteredItems.length})
              </button>
              {activeVirtTopic.subtopics
                .filter(vs => virtSubtopicCount[vs.id] > 0)
                .map(vs => (
                  <button
                    key={vs.id}
                    type="button"
                    onClick={() => setFilterVirtSubtopic(prev => prev === vs.id ? '' : vs.id)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all',
                      filterVirtSubtopic === vs.id
                        ? 'border-violet-500 bg-violet-500 text-white shadow-sm'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800',
                    )}
                  >
                    {vs.name} ({virtSubtopicCount[vs.id]})
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* ── Row 3: View mode tabs ─────────────────────────────────────── */}
        <div
          dir="rtl"
          className="shrink-0 flex items-center gap-0.5 border-b border-slate-200 dark:border-zinc-800 px-4 pt-1 bg-white dark:bg-zinc-950 overflow-x-auto"
        >
          {VIEWS.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => setActiveView(v.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-semibold rounded-t-lg whitespace-nowrap transition-colors border-b-2 -mb-px',
                activeView === v.key
                  ? 'border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20'
                  : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300',
              )}
            >
              {v.label}
            </button>
          ))}
          {(hasTopicFilter || hasSubtopicFilter) && (
            <button
              type="button"
              onClick={() => { setFilterVirtTopicId(''); setFilterVirtSubtopic(''); }}
              className="mr-auto mb-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:border-red-300 hover:text-red-500 dark:hover:text-red-400 transition-colors whitespace-nowrap"
            >
              ✕ נקה סינון
            </button>
          )}
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto" dir="rtl">

          {/* Draft view */}
          {activeView === 'draft' && (
            <div className={cn('p-5 space-y-4', isFullscreen && 'max-w-3xl mx-auto')}>
              {effectiveDraftItems.length === 0 ? (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-5 py-6 text-center space-y-3">
                  <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">הניתוח הנוכחי</p>
                  {currentAnalysisDraftItems.length > 0 ? (
                    <>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">
                        {currentAnalysisDraftItems.length} פריטים זמינים מהניתוח הנוכחי
                      </p>
                      <button
                        type="button"
                        onClick={handleLoadCurrentAnalysis}
                        className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
                      >
                        ✨ טען ניתוח נוכחי לטיוטה ({currentAnalysisDraftItems.length} פריטים)
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-indigo-500">אין תוכן ניתוח זמין לשמירה</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                      טיוטת שמירה — {effectiveDraftItems.length} פריטים נבחרו
                    </h3>
                    {videoContext.videoTitle && (
                      <span className="text-xs text-slate-400 dark:text-zinc-500 truncate max-w-xs">
                        מתוך: {videoContext.videoTitle.slice(0, 60)}
                      </span>
                    )}
                    {loadedDraftItems !== null && (
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-400">
                        ✨ ניתוח נוכחי
                      </span>
                    )}
                  </div>

                  {/* Selected snippets */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pl-1">
                    {effectiveDraftItems.map(item => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-4 py-3"
                      >
                        {item.sectionLabel && (
                          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-500 mb-1">{item.sectionLabel}</p>
                        )}
                        <p className="text-sm text-slate-800 dark:text-zinc-200 leading-relaxed line-clamp-3">{item.text}</p>
                      </div>
                    ))}
                  </div>

                  {/* Bulk controls */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">נושא ראשי</label>
                      <select
                        value={topicId}
                        onChange={e => { setTopicId(e.target.value); setSubTopicId(''); }}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
                      >
                        <option value="">בחר נושא...</option>
                        {mainTopics.map(t => (
                          <option key={t.id} value={t.id}>{t.emoji ? `${t.emoji} ` : ''}{t.name}</option>
                        ))}
                      </select>
                      {showNewTopic ? (
                        <div className="flex gap-1">
                          <input
                            autoFocus
                            value={newTopicName}
                            onChange={e => setNewTopicName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTopic()}
                            placeholder="שם נושא חדש..."
                            className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1.5 text-sm text-right focus:outline-none dark:bg-zinc-900 dark:text-zinc-200"
                          />
                          <button type="button" onClick={handleAddTopic} className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">הוסף</button>
                          <button type="button" onClick={() => setShowNewTopic(false)} className="rounded-lg border border-slate-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-slate-500">✕</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setShowNewTopic(true)} className="text-xs text-amber-500 hover:underline">
                          + נושא חדש
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">תת-נושא</label>
                      <select
                        value={subTopicId}
                        onChange={e => setSubTopicId(e.target.value === '__none__' ? '' : e.target.value)}
                        disabled={!topicId || subTopics.length === 0}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
                      >
                        <option value="__none__">
                          {!topicId ? 'בחר נושא תחילה' : subTopics.length === 0 ? 'אין תת-נושאים' : 'ללא תת-נושא'}
                        </option>
                        {subTopics.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                      תגיות <span className="font-normal text-slate-400">(Enter או פסיק להפרדה)</span>
                    </label>
                    <div
                      className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 min-h-[42px] cursor-text"
                      onClick={() => document.getElementById('ws-draft-tag-input')?.focus()}
                    >
                      {tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setTags(p => p.filter(t => t !== tag)); }}
                            className="text-indigo-400 hover:text-indigo-700 leading-none"
                          >×</button>
                        </span>
                      ))}
                      <input
                        id="ws-draft-tag-input"
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        onBlur={() => { if (tagInput.trim()) commitTag(tagInput); }}
                        placeholder={tags.length === 0 ? 'nvda, ריבית...' : ''}
                        dir="ltr"
                        className="flex-1 min-w-[80px] bg-transparent text-sm text-slate-700 dark:text-zinc-300 placeholder:text-slate-300 dark:placeholder:text-zinc-600 outline-none"
                      />
                    </div>
                  </div>

                  {/* Flags */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">סמן כ...</label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { key: 'isFavorite',     label: '⭐ מועדף',     active: 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-600 dark:text-amber-300' },
                        { key: 'isImportant',    label: '🔴 חשוב',      active: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-600 dark:text-red-300' },
                        { key: 'mustWatchAgain', label: '🔁 לצפות שוב', active: 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-950/40 dark:border-blue-600 dark:text-blue-300' },
                      ].map(({ key, label, active }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFlags(f => ({ ...f, [key]: !f[key] }))}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-sm font-semibold transition-all',
                            flags[key]
                              ? active
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Extra notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                      הערות נוספות <span className="font-normal">(אופציונלי — תצורפנה לכל הפריטים)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      dir="rtl"
                      placeholder="הוסף הערה אישית..."
                      className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-right placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none leading-relaxed"
                    />
                  </div>

                  {/* No-topic warning */}
                  {!topicId && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      ⚠️ לא נבחר נושא — הפריטים יישמרו ללא שיוך נושא
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveAll}
                    disabled={isSaving || effectiveDraftItems.length === 0}
                    className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
                  >
                    {isSaving ? 'שומר...' : `⭐ שמור הכל ל-Workspace (${effectiveDraftItems.length} פריטים)`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Recently saved view */}
          {activeView === 'recent' && (
            <div className={cn('p-5', isFullscreen && 'max-w-3xl mx-auto')}>
              <AnalysisBanner show={showAnalysisBanner} count={currentAnalysisDraftItems.length} onLoad={handleLoadCurrentAnalysis} />
              {recentItems.length === 0 ? (
                <EmptyState label="שמור פריטים כדי לראות אותם כאן" icon={<Check className="h-10 w-10 opacity-25" />} />
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-1.5">
                    <Check className="h-4 w-4" />
                    נשמרו עכשיו — {recentItems.length} פריטים
                  </h3>
                  <div className="space-y-3">
                    {recentItems.map(item => (
                      <LibraryItemCard key={item.id} item={item} allTopics={allTopics} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* By topic view — folder-like grouping */}
          {activeView === 'topics' && (
            <div className={cn('p-5 space-y-5', isFullscreen && 'max-w-3xl mx-auto')}>
              <AnalysisBanner show={showAnalysisBanner} count={currentAnalysisDraftItems.length} onLoad={handleLoadCurrentAnalysis} />
              {filteredLibraryItems.length === 0 && <EmptyState label="אין פריטים בנושא הנוכחי" />}

              {hasTopicFilter && activeVirtTopic ? (
                // ── Subtopic groups within the selected main topic ──────────
                <>
                  {/* Main topic header */}
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-zinc-800">
                    <span className="text-base">{activeVirtTopic.emoji}</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{activeVirtTopic.name}</span>
                    <span className="text-xs text-slate-400 dark:text-zinc-600">({filteredLibraryItems.length})</span>
                    {hasSubtopicFilter && activeVirtTopic.subtopics.find(vs => vs.id === filterVirtSubtopic) && (
                      <span className="rounded-full border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-400">
                        › {activeVirtTopic.subtopics.find(vs => vs.id === filterVirtSubtopic)?.name}
                      </span>
                    )}
                  </div>

                  {hasSubtopicFilter ? (
                    // flat list when subtopic filter is active
                    <div className="space-y-2">
                      {filteredLibraryItems.map(item => (
                        <LibraryItemCard key={item.id} item={item} allTopics={allTopics} compact />
                      ))}
                    </div>
                  ) : (
                    // subtopic groups
                    <>
                      {activeVirtTopic.subtopics
                        .filter(vs => itemsByVirtSubtopic[vs.id]?.length > 0)
                        .map(vs => (
                          <FolderGroup
                            key={vs.id}
                            label={vs.name}
                            count={itemsByVirtSubtopic[vs.id].length}
                            items={itemsByVirtSubtopic[vs.id]}
                            allTopics={allTopics}
                            indent
                          />
                        ))}
                      {itemsByVirtSubtopic['__other__']?.length > 0 && (
                        <FolderGroup
                          label={`${activeVirtTopic.name} — כללי`}
                          count={itemsByVirtSubtopic['__other__'].length}
                          items={itemsByVirtSubtopic['__other__']}
                          allTopics={allTopics}
                          indent
                          muted
                        />
                      )}
                    </>
                  )}
                </>
              ) : (
                // ── Main topic groups (no filter) ──────────────────────────
                <>
                  {VIRTUAL_TAXONOMY
                    .filter(vt => itemsByVirtTopic[vt.id]?.length > 0)
                    .map(vt => (
                      <FolderGroup
                        key={vt.id}
                        label={`${vt.emoji} ${vt.name}`}
                        count={itemsByVirtTopic[vt.id].length}
                        items={itemsByVirtTopic[vt.id]}
                        allTopics={allTopics}
                      />
                    ))}
                  {itemsByVirtTopic['__none__']?.length > 0 && (
                    <FolderGroup
                      label="📁 ללא נושא"
                      count={itemsByVirtTopic['__none__'].length}
                      items={itemsByVirtTopic['__none__']}
                      allTopics={allTopics}
                      muted
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* By date view */}
          {activeView === 'dates' && (
            <div className={cn('p-5 space-y-5', isFullscreen && 'max-w-3xl mx-auto')}>
              <AnalysisBanner show={showAnalysisBanner} count={currentAnalysisDraftItems.length} onLoad={handleLoadCurrentAnalysis} />
              {filteredLibraryItems.length === 0 && <EmptyState label="אין פריטים בנושא הנוכחי" />}
              {[
                { key: 'today',     label: 'היום' },
                { key: 'yesterday', label: 'אתמול' },
                { key: 'thisWeek',  label: 'השבוע' },
                { key: 'thisMonth', label: 'החודש' },
                { key: 'older',     label: 'ישן יותר' },
              ]
                .filter(({ key }) => itemsByDate[key]?.length > 0)
                .map(({ key, label }) => (
                  <div key={key}>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2.5">
                      {label}
                      <span className="text-slate-400 dark:text-zinc-600 font-normal text-xs mr-1">({itemsByDate[key].length})</span>
                    </h3>
                    <div className="space-y-2 pr-2 border-r-2 border-slate-100 dark:border-zinc-800">
                      {itemsByDate[key].map(item => (
                        <LibraryItemCard key={item.id} item={item} allTopics={allTopics} compact showDate />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Pinned / favorites view */}
          {activeView === 'pinned' && (
            <div className={cn('p-5', isFullscreen && 'max-w-3xl mx-auto')}>
              <AnalysisBanner show={showAnalysisBanner} count={currentAnalysisDraftItems.length} onLoad={handleLoadCurrentAnalysis} />
              {pinnedItems.length === 0 ? (
                <EmptyState label="אין פריטים מועדפים / חשובים בנושא הנוכחי" />
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-4">
                    {pinnedItems.length} פריטים מועדפים / חשובים
                  </h3>
                  <div className="space-y-3">
                    {pinnedItems.map(item => (
                      <LibraryItemCard key={item.id} item={item} allTopics={allTopics} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Folder group ─────────────────────────────────────────────────────────────

function FolderGroup({ label, count, items, allTopics, indent = false, muted = false }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed(p => !p)}
        className={cn(
          'flex items-center gap-1.5 mb-2 w-full text-right',
          muted ? 'text-slate-400 dark:text-zinc-600' : 'text-slate-700 dark:text-zinc-300',
        )}
      >
        <span className="text-[10px] text-slate-300 dark:text-zinc-600 select-none">{collapsed ? '▸' : '▾'}</span>
        <span className={cn('text-sm font-bold', indent && 'mr-1')}>{label}</span>
        <span className={cn('text-xs font-normal', muted ? 'text-slate-300 dark:text-zinc-700' : 'text-slate-400 dark:text-zinc-600')}>
          ({count})
        </span>
      </button>
      {!collapsed && (
        <div className={cn('space-y-2', indent ? 'pr-3 border-r-2 border-slate-100 dark:border-zinc-800' : 'pr-2 border-r-2 border-slate-100 dark:border-zinc-800')}>
          {items.map(item => (
            <LibraryItemCard key={item.id} item={item} allTopics={allTopics} compact />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Current analysis banner ──────────────────────────────────────────────────

function AnalysisBanner({ show, count, onLoad }) {
  if (!show || count === 0) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
        <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">הניתוח הנוכחי</span>
        <span className="text-xs text-indigo-600 dark:text-indigo-400">— {count} פריטים זמינים לשמירה</span>
      </div>
      <button
        type="button"
        onClick={onLoad}
        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
      >
        שמור ניתוח נוכחי ←
      </button>
    </div>
  );
}

// ─── Library item card ────────────────────────────────────────────────────────

function LibraryItemCard({ item, allTopics, compact = false, showDate = false }) {
  const mainTopic = allTopics.find(t => t.id === item.topicId && !t.parentId);
  const subTopic  = allTopics.find(t => t.id === item.subTopicId);
  const itemTags  = item.tags || [];
  const savedDate = (() => {
    try { return format(new Date(item.savedAt), "d בMMM", { locale: he }); } catch { return ''; }
  })();

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 px-3 py-2 flex items-center gap-2 justify-between">
        <p className="flex-1 min-w-0 text-sm font-medium text-slate-800 dark:text-zinc-200 truncate leading-snug">
          {item.videoTitle || 'ללא כותרת'}
        </p>
        <div className="flex items-center gap-1.5 shrink-0 text-sm">
          {item.flags?.isImportant    && <span title="חשוב">🔴</span>}
          {item.flags?.isFavorite     && <span title="מועדף">⭐</span>}
          {item.flags?.mustWatchAgain && <span title="לצפות שוב">🔁</span>}
          {showDate && savedDate && (
            <span className="text-xs text-slate-400 dark:text-zinc-600 mr-1">{savedDate}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 space-y-1.5">
      <div className="flex items-start gap-2 justify-between">
        <p className="flex-1 min-w-0 text-base font-bold text-slate-900 dark:text-zinc-100 leading-snug">
          {item.videoTitle || 'ללא כותרת'}
        </p>
        <div className="flex items-center gap-1 shrink-0 text-base pt-0.5">
          {item.flags?.isImportant    && <span title="חשוב">🔴</span>}
          {item.flags?.isFavorite     && <span title="מועדף">⭐</span>}
          {item.flags?.mustWatchAgain && <span title="לצפות שוב">🔁</span>}
        </div>
      </div>
      {item.notes && (
        <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed line-clamp-3">{item.notes}</p>
      )}
      {(mainTopic || subTopic) && (
        <p className="text-xs text-slate-500 dark:text-zinc-500 flex items-center gap-1">
          {mainTopic && <span className="font-medium">{mainTopic.emoji && `${mainTopic.emoji} `}{mainTopic.name}</span>}
          {mainTopic && subTopic && <span className="text-slate-300 dark:text-zinc-700">›</span>}
          {subTopic && <span>{subTopic.name}</span>}
        </p>
      )}
      {(itemTags.length > 0 || item.sourceTab || savedDate) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {itemTags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="rounded-full border border-indigo-100 bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/30 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400"
            >
              #{tag}
            </span>
          ))}
          {item.sourceTab && (
            <span className="rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-2 py-0.5 text-xs text-slate-500 dark:text-zinc-400">
              {item.sourceTab}
            </span>
          )}
          {savedDate && (
            <span className="mr-auto text-xs text-slate-400 dark:text-zinc-600">{savedDate}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ label, icon }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-slate-400 dark:text-zinc-600">
      {icon || <Star className="h-10 w-10 opacity-25" />}
      <p className="text-sm">{label}</p>
    </div>
  );
}
