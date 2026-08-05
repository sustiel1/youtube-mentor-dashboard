import { useState, useMemo, useEffect } from "react";
import { Star, X, Trash2, Edit2, Plus, Search, Settings, Archive, ArchiveRestore, MoreVertical, Copy, FileDown } from "lucide-react";
import { ConfirmDialog } from "@/components/workspace/ConfirmDialog";
import { VIRTUAL_TAXONOMY } from "@/utils/workspaceVirtualTaxonomy";
import {
  getWorkspaceTabPreferences,
  saveWorkspaceTabPreferences,
  resetWorkspaceTabPreferences,
  getVisibleMainTabs,
  getAllMergedTabs,
  addCustomMainTab,
  removeCustomMainTab,
  addCustomSubtopic,
  getCustomSubtopics,
  addCustomWorkflowTab,
  getCustomWorkflowTabs,
} from "@/utils/workspaceTabPreferences";
import { WorkspaceTabRow } from "@/components/workspace/WorkspaceTabRow";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWorkspaceItems, useWorkspaceTopics } from "@/hooks/useWorkspaceLibrary";
import { useVideos } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import { useTopics } from "@/hooks/useTopics";
import { VideoDetailPanel } from "@/components/dashboard/VideoDetailPanel";
import { SaveToWorkspaceDialog } from "@/components/workspace/SaveToWorkspaceDialog";
import { StockWatchlistView } from "@/components/workspace/StockWatchlistView";
import { WorkspaceBulkActionBar, formatWorkspaceItemsForCopy, exportWorkspaceItemsToCsv } from "@/components/workspace/WorkspaceBulkActionBar";

// ─── Market status workflow ────────────────────────────────────────────────────
const MARKET_STATUS_TABS = [
  { value: '',                label: 'הכל' },
  { value: 'watchlist',       label: '⭐ למעקב' },
  { value: 'candidate',       label: '🎯 מועמדות' },
  { value: 'before_earnings', label: '📋 לפני דוחות' },
  { value: 'risk',            label: '⚠️ בסיכון' },
  { value: 'archive',         label: '📦 ארכיון' },
];
const MARKET_STATUS_LABELS = {
  watchlist:       '⭐ למעקב',
  candidate:       '🎯 מועמד',
  before_earnings: '📋 לפני דוחות',
  risk:            '⚠️ בסיכון',
  archive:         '📦 ארכיון',
};
const MARKET_STATUS_COLORS = {
  watchlist:       'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50',
  candidate:       'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50',
  before_earnings: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800/50',
  risk:            'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/50',
  archive:         'bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700',
};

export default function WorkspaceLibrary({ navigateTo, isDark, toggleTheme }) {
  const { items, reload: reloadItems, deleteItem, updateItem, deleteItems, deleteAllItems, updateItemsBulk, archiveItems } = useWorkspaceItems();
  const { topics, mainTopics, getSubTopics, addTopic, updateTopic, deleteTopic } = useWorkspaceTopics();
  const { data: videos = [] } = useVideos();
  const { data: mentors = [] } = useMentors();
  const { data: systemTopics = [] } = useTopics();

  const [search, setSearch] = useState('');
  const [filterVirtTopicId, setFilterVirtTopicId] = useState('');
  const [filterVirtSubtopic, setFilterVirtSubtopic] = useState('');
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [filterImportant, setFilterImportant] = useState(false);
  const [filterMustWatch, setFilterMustWatch] = useState(false);
  const [filterTags, setFilterTags] = useState([]);
  const [filterSourceTab, setFilterSourceTab] = useState('');
  const [filterMarketStatus, setFilterMarketStatus] = useState('');
  const [showAddWorkflowStatus, setShowAddWorkflowStatus] = useState(false);
  const [newWorkflowStatusName, setNewWorkflowStatusName] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [manageTopicsOpen, setManageTopicsOpen] = useState(false);

  const [showArchivedCards, setShowArchivedCards] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState(() => new Set());
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmDeleteAllVisible, setConfirmDeleteAllVisible] = useState(false);
  const [confirmDeleteAllWorkspace, setConfirmDeleteAllWorkspace] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);

  const [tabPrefs,        setTabPrefs]        = useState(() => getWorkspaceTabPreferences());
  const [showManageTabs,  setShowManageTabs]  = useState(false);
  const [editingTabId,    setEditingTabId]    = useState(null);
  const [editingTabLabel, setEditingTabLabel] = useState('');

  const allMainTabs = useMemo(() => getAllMergedTabs(VIRTUAL_TAXONOMY, tabPrefs), [tabPrefs]);
  const visibleMainTabs = useMemo(() => getVisibleMainTabs(allMainTabs, tabPrefs), [allMainTabs, tabPrefs]);

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
    const def = { hiddenTabIds: [], labelOverrides: {}, customMainTabs: [] };
    setTabPrefs(def);
    resetWorkspaceTabPreferences();
  }

  function handleAddCustomTab(name, emoji) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const finalEmoji = emoji?.trim() || '📌';
    const newTopic = addTopic({ name: trimmedName, emoji: finalEmoji });
    const newPrefs = addCustomMainTab(tabPrefs, { name: trimmedName, emoji: finalEmoji, topicId: newTopic.id });
    setTabPrefs(newPrefs);
    saveWorkspaceTabPreferences(newPrefs);
    toast.success(`הטאב "${trimmedName}" נוסף`);
  }

  function handleRemoveCustomTab(tabId) {
    const newPrefs = removeCustomMainTab(tabPrefs, tabId);
    setTabPrefs(newPrefs);
    saveWorkspaceTabPreferences(newPrefs);
    if (filterVirtTopicId === tabId) { setFilterVirtTopicId(''); setFilterVirtSubtopic(''); }
  }

  const virtTopicCount = useMemo(() => {
    const counts = {};
    for (const item of items) {
      for (const vt of allMainTabs) {
        if (
          vt.realTopicIds.includes(item.topicId) ||
          vt.realTopicIds.includes(item.subTopicId) ||
          (vt.legacyNames || []).includes(item.topicName)
        ) {
          counts[vt.id] = (counts[vt.id] || 0) + 1;
          break;
        }
      }
    }
    return counts;
  }, [items, allMainTabs]);

  const activeVirtTopic = useMemo(
    () => allMainTabs.find(v => v.id === filterVirtTopicId) || null,
    [allMainTabs, filterVirtTopicId],
  );

  const isStocksView = filterVirtTopicId === 'vt-markets' && filterVirtSubtopic === 'vts-stocks';

  useEffect(() => { setFilterMarketStatus(''); }, [filterVirtTopicId, filterVirtSubtopic]);

  const virtSubtopicCount = useMemo(() => {
    if (!activeVirtTopic) return {};
    const counts = {};
    for (const item of items) {
      for (const vs of activeVirtTopic.subtopics) {
        if (vs.realTopicIds.includes(item.topicId) || vs.realTopicIds.includes(item.subTopicId)) {
          counts[vs.id] = (counts[vs.id] || 0) + 1;
          break;
        }
      }
    }
    return counts;
  }, [items, activeVirtTopic]);

  const allTags = useMemo(() => {
    const tagSet = new Set();
    items.forEach(i => (i.tags || []).forEach(t => tagSet.add(t)));
    return [...tagSet].sort();
  }, [items]);

  const allSourceTabs = useMemo(() => {
    const tabSet = new Set();
    items.forEach(i => { if (i.sourceTab) tabSet.add(i.sourceTab); });
    return [...tabSet].sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        (i.videoTitle || '').toLowerCase().includes(q) ||
        (i.channelName || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q) ||
        (i.topicName || '').toLowerCase().includes(q) ||
        (i.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
        (i.sourceTab || '').toLowerCase().includes(q) ||
        (i.symbol || '').toLowerCase().includes(q) ||
        (i.companyName || '').toLowerCase().includes(q) ||
        (i.fullNotes || '').toLowerCase().includes(q)
      );
    }

    if (filterVirtTopicId) {
      const vt = allMainTabs.find(v => v.id === filterVirtTopicId);
      if (vt) {
        const idSet   = new Set(vt.realTopicIds);
        const nameSet = new Set(vt.legacyNames || []);
        result = result.filter(i =>
          idSet.has(i.topicId) || idSet.has(i.subTopicId) || nameSet.has(i.topicName)
        );
      }
    }
    if (filterVirtSubtopic && activeVirtTopic) {
      const vs = activeVirtTopic.subtopics.find(s => s.id === filterVirtSubtopic);
      if (vs) {
        const subIdSet = new Set(vs.realTopicIds);
        result = result.filter(i => subIdSet.has(i.topicId) || subIdSet.has(i.subTopicId));
      }
      // Custom subtopics have no realTopicIds — they act as labels and show 0 results
    }
    if (isStocksView && filterMarketStatus) {
      result = result.filter(i => (i.marketStatus || '') === filterMarketStatus);
    }

    if (filterFavorite)  result = result.filter(i => i.flags?.isFavorite);
    if (filterImportant) result = result.filter(i => i.flags?.isImportant);
    if (filterMustWatch) result = result.filter(i => i.flags?.mustWatchAgain);
    if (filterTags.length > 0) {
      result = result.filter(i => filterTags.some(tag => (i.tags || []).includes(tag)));
    }
    if (filterSourceTab) result = result.filter(i => (i.sourceTab || null) === filterSourceTab);

    if (sortBy === 'newest')   result.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    else if (sortBy === 'oldest') result.sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt));
    else if (sortBy === 'title')  result.sort((a, b) => (a.videoTitle || '').localeCompare(b.videoTitle || '', 'he'));
    else if (sortBy === 'priority') {
      const score = item =>
        (item.flags?.isImportant ? 4 : 0) +
        (item.flags?.isFavorite  ? 2 : 0) +
        (item.flags?.mustWatchAgain ? 1 : 0);
      result.sort((a, b) => score(b) - score(a) || new Date(b.savedAt) - new Date(a.savedAt));
    }

    return result;
  }, [items, search, filterVirtTopicId, filterVirtSubtopic, activeVirtTopic, isStocksView,
      filterMarketStatus, filterFavorite, filterImportant, filterMustWatch, filterTags, filterSourceTab, sortBy]);

  // Active *filters* only — topic/subtopic navigation (tabs) is intentionally excluded,
  // this only covers the filter-bar controls (search/flags/status/source/tags).
  const hasActiveWorkspaceFilters = !!(
    search || filterFavorite || filterImportant || filterMustWatch ||
    (isStocksView && filterMarketStatus) || filterSourceTab || filterTags.length > 0
  );

  function clearAllWorkspaceFilters() {
    setSearch('');
    setFilterFavorite(false);
    setFilterImportant(false);
    setFilterMustWatch(false);
    setFilterMarketStatus('');
    setFilterSourceTab('');
    setFilterTags([]);
  }

  const handleDeleteTopic = (id) => {
    const result = deleteTopic(id);
    if (!result?.ok) toast.error(`לא ניתן למחוק — ${result.count} פריטים שמורים תחת נושא זה`);
  };

  const handleVideoClick = (item) => {
    const fullVideo = videos.find(v => v.id === item.videoId || v.videoId === item.videoId);
    if (fullVideo) { setSelectedVideo(fullVideo); setPanelOpen(true); }
    else window.open(item.videoUrl, '_blank', 'noopener');
  };

  const handleDelete = (item) => {
    deleteItem(item.id);
    toast.success('הפריט הוסר מ-Workspace Library');
  };

  const requestDeleteCard  = (item) => setConfirmDeleteItem(item);

  const handleConfirmDeleteCard = () => {
    if (!confirmDeleteItem) return;
    deleteItem(confirmDeleteItem.id);
    toast.success('הפריט הוסר מ-Workspace Library');
    setSelectedCardIds(prev => { const next = new Set(prev); next.delete(confirmDeleteItem.id); return next; });
  };

  const handleStatusChange = (id, newStatus) => updateItem(id, { marketStatus: newStatus || null });

  const toggleCardSelect = (id) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearCardSelection = () => setSelectedCardIds(new Set());

  const handleCopySelected = () => {
    const selected = items.filter(i => selectedCardIds.has(i.id));
    const text = formatWorkspaceItemsForCopy(selected);
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`הועתקו ${selected.length} פריטים ללוח`))
      .catch(() => toast.error('לא ניתן להעתיק'));
  };

  const handleExportCsvSelected = () => {
    const selected = items.filter(i => selectedCardIds.has(i.id));
    if (!selected.length) return;
    exportWorkspaceItemsToCsv(selected);
    toast.success(`ייוצאו ${selected.length} פריטים ל-CSV`);
  };

  const handleArchiveCards = (ids, archived = true) => {
    archiveItems(ids, archived);
    toast.success(archived ? `${ids.length > 1 ? `${ids.length} פריטים הועברו` : 'הפריט הועבר'} לארכיון` : 'הפריט שוחזר מהארכיון');
    setSelectedCardIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
  };

  const handleConfirmBulkDeleteCards = () => {
    const ids = [...selectedCardIds];
    if (!ids.length) return;
    deleteItems(ids);
    toast.success(`${ids.length} פריטים נמחקו מ-Workspace`);
    clearCardSelection();
  };

  // Mirrors the exact filter used to render the grid below, so the count/delete
  // target always matches what's actually on screen (never the hidden archived/active set).
  const deletableVisibleItems = useMemo(
    () => filteredItems.filter(i => (showArchivedCards ? !!i.archivedAt : !i.archivedAt)),
    [filteredItems, showArchivedCards],
  );

  const handleConfirmDeleteAllVisible = () => {
    const ids = deletableVisibleItems.map(i => i.id);
    if (!ids.length) return;
    deleteItems(ids);
    toast.success(`נמחקו ${ids.length} פריטים מה-Workspace`);
    clearCardSelection();
    setMoreActionsOpen(false);
  };

  const handleConfirmDeleteAllWorkspace = () => {
    const count = items.length;
    if (!count) return;
    deleteAllItems();
    toast.success(`נמחקו ${count} פריטים מה-Workspace`);
    clearCardSelection();
    setMoreActionsOpen(false);
  };

  const selectedMentorName = useMemo(
    () => mentors.find(m => m.id === selectedVideo?.mentorId)?.name || '',
    [selectedVideo, mentors],
  );

  // ── Custom subtopics (Row 2) ──────────────────────────────────────────────────
  const customSubtopicsForActive = useMemo(
    () => filterVirtTopicId ? getCustomSubtopics(tabPrefs, filterVirtTopicId) : [],
    [tabPrefs, filterVirtTopicId],
  );

  function handleAddCustomSubtopic(name) {
    if (!filterVirtTopicId || !name.trim()) return;
    const newPrefs = addCustomSubtopic(tabPrefs, filterVirtTopicId, name.trim());
    setTabPrefs(newPrefs);
    saveWorkspaceTabPreferences(newPrefs);
    toast.success(`תת-נושא "${name.trim()}" נוסף`);
  }

  // ── Custom workflow/status tabs (Row 3) ───────────────────────────────────────
  const allWorkflowTabs = useMemo(
    () => [...MARKET_STATUS_TABS, ...getCustomWorkflowTabs(tabPrefs)],
    [tabPrefs],
  );

  function handleAddCustomWorkflowTab(name) {
    if (!name.trim()) return;
    const newPrefs = addCustomWorkflowTab(tabPrefs, name.trim());
    setTabPrefs(newPrefs);
    saveWorkspaceTabPreferences(newPrefs);
    toast.success(`סטטוס "${name.trim()}" נוסף`);
  }

  // ─── Active subtopics rows (built-in + custom) ────────────────────────────────
  const hasSubtopicRow = activeVirtTopic && (
    activeVirtTopic.subtopics.length > 0 || customSubtopicsForActive.length > 0
  );

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:bg-zinc-950" dir="rtl">

      {/* ══════════════════════ HEADER ══════════════════════ */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-slate-100 dark:border-zinc-800 shadow-sm">
        <div className="px-5 py-3 max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigateTo?.('Workspace')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            title="חזור ל-Workspace"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <Star className="h-5 w-5 text-amber-500 fill-amber-400 shrink-0" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Workspace Library
            </h1>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 rounded-full px-3 py-1">
              {items.length} פריטים שמורים
            </span>
          </div>

          <div className="mr-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManageTopicsOpen(p => !p)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
                manageTopicsOpen
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              ניהול נושאים
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreActionsOpen(p => !p)}
                title="פעולות נוספות"
                className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:text-zinc-600 dark:hover:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {moreActionsOpen && (
                <div
                  className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 z-50"
                  dir="rtl"
                  onMouseLeave={() => setMoreActionsOpen(false)}
                >
                  {/* Hidden in the stocks view: StockWatchlistView owns its own archived
                      toggle internally, so this page can't know what's actually rendered
                      there — it already has its own correctly-scoped "מחק מסומנים" action. */}
                  {!isStocksView && (
                    <button
                      type="button"
                      disabled={deletableVisibleItems.length === 0}
                      onClick={() => { setMoreActionsOpen(false); setConfirmDeleteAllVisible(true); }}
                      className="w-full text-right px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      מחק הכל בתצוגה הנוכחית ({deletableVisibleItems.length})
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={items.length === 0}
                    onClick={() => { setMoreActionsOpen(false); setConfirmDeleteAllWorkspace(true); }}
                    className="w-full text-right px-3 py-2 text-xs text-red-700 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    מחק את כל ה-Workspace ({items.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={cn("px-4 sm:px-6 py-5 max-w-7xl mx-auto space-y-4", selectedCardIds.size > 0 && "pb-20")}>

        {/* ══════════════════════ NAVIGATION CARD ══════════════════════ */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">

          {/* ── Row 1: Main topics (LARGE) ─────────────────────────── */}
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <WorkspaceTabRow
                  tabs={[
                    { value: '', label: `הכל${items.length > 0 ? ` (${items.length})` : ''}` },
                    ...visibleMainTabs.map(vt => ({
                      value: vt.id,
                      label: `${vt.emoji} ${vt.displayName}`,
                      count: virtTopicCount[vt.id] || 0,
                      empty: !virtTopicCount[vt.id],
                    })),
                  ]}
                  activeValue={filterVirtTopicId}
                  onSelect={v => { setFilterVirtTopicId(v); setFilterVirtSubtopic(''); }}
                  onAddTab={handleAddCustomTab}
                  size="lg"
                  accentColor="indigo"
                  addLabel="+ נושא"
                  withEmoji
                />
              </div>

              {/* Manage tabs toggle — pushed to left */}
              <button
                type="button"
                onClick={() => setShowManageTabs(p => !p)}
                title="ערוך טאבים"
                className={cn(
                  'shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all',
                  showManageTabs
                    ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
                    : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800'
                )}
              >
                ⚙ ערוך טאבים
              </button>
            </div>
          </div>

          {/* Manage tabs panel */}
          {showManageTabs && (
            <div className="border-t border-amber-100 dark:border-zinc-700 px-5 py-3.5 bg-amber-50/60 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between mb-3">
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
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {allMainTabs.map(vt => {
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
                          : vt.isCustom
                            ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20'
                            : 'border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900',
                      )}
                    >
                      {vt.isCustom ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomTab(vt.id)}
                          title="מחק טאב מותאם"
                          className="shrink-0 text-base leading-none select-none text-slate-400 hover:text-red-500"
                        >
                          🗑
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleTabVisibility(vt.id)}
                          title={isHidden ? 'הצג טאב' : 'הסתר טאב'}
                          className="shrink-0 text-base leading-none select-none"
                        >
                          {isHidden ? '🚫' : '👁'}
                        </button>
                      )}
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
                          <span className={cn('text-sm flex-1 text-right', isHidden && 'line-through')}>
                            {displayName}
                            {vt.isCustom && <span className="mr-1 text-[10px] text-amber-500 font-normal">מותאם</span>}
                          </span>
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

          {/* ── Row 2: Subtopics (MEDIUM) — only when a main topic is selected ── */}
          {hasSubtopicRow && (
            <div className="border-t border-slate-100 dark:border-zinc-800 px-5 py-3 bg-slate-50/40 dark:bg-zinc-800/20">
              <WorkspaceTabRow
                tabs={[
                  ...(activeVirtTopic?.subtopics || []).map(vs => ({
                    value: vs.id,
                    label: vs.name,
                    count: virtSubtopicCount[vs.id] || 0,
                    empty: !virtSubtopicCount[vs.id],
                  })),
                  ...customSubtopicsForActive.map(cs => ({
                    value: cs.id,
                    label: cs.name,
                    empty: true,
                  })),
                  {
                    value: '',
                    label: `כולם${virtTopicCount[filterVirtTopicId] ? ` (${virtTopicCount[filterVirtTopicId]})` : ''}`,
                  },
                ]}
                activeValue={filterVirtSubtopic}
                onSelect={v => setFilterVirtSubtopic(prev => prev === v ? '' : v)}
                onAddTab={handleAddCustomSubtopic}
                size="md"
                accentColor="violet"
                addLabel="+ תת-נושא"
              />
            </div>
          )}

          {/* ── Row 3: Workflow/Status — compact control, not a tab row — only under שוק ההון > מניות ── */}
          {isStocksView && (
            <div className="border-t border-teal-100/60 dark:border-zinc-800 px-5 py-2 bg-teal-50/20 dark:bg-zinc-800/30">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 shrink-0">
                  סטטוס:
                </span>
                <select
                  value={filterMarketStatus}
                  onChange={e => setFilterMarketStatus(e.target.value)}
                  className="rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-teal-800 dark:text-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer"
                >
                  {allWorkflowTabs.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {showAddWorkflowStatus ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={newWorkflowStatusName}
                      onChange={e => setNewWorkflowStatusName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleAddCustomWorkflowTab(newWorkflowStatusName);
                          setNewWorkflowStatusName('');
                          setShowAddWorkflowStatus(false);
                        }
                        if (e.key === 'Escape') { setShowAddWorkflowStatus(false); setNewWorkflowStatusName(''); }
                      }}
                      placeholder="שם סטטוס..."
                      dir="rtl"
                      className="w-28 rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200"
                    />
                    <button
                      type="button"
                      onClick={() => { handleAddCustomWorkflowTab(newWorkflowStatusName); setNewWorkflowStatusName(''); setShowAddWorkflowStatus(false); }}
                      disabled={!newWorkflowStatusName.trim()}
                      className="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40"
                    >
                      הוסף
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddWorkflowStatus(false); setNewWorkflowStatusName(''); }}
                      className="rounded-lg border border-teal-200 dark:border-teal-800 px-2 py-1 text-xs text-teal-500 hover:text-teal-700"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddWorkflowStatus(true)}
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline shrink-0"
                  >
                    + סטטוס
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════ MANAGE TOPICS PANEL ══════════════════════ */}
        {manageTopicsOpen && (
          <ManageTopicsPanel
            topics={topics}
            mainTopics={mainTopics}
            getSubTopics={getSubTopics}
            addTopic={addTopic}
            updateTopic={updateTopic}
            deleteTopic={handleDeleteTopic}
            onClose={() => setManageTopicsOpen(false)}
          />
        )}

        {/* ══════════════════════ FILTER CARD ══════════════════════ */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm px-4 py-3 space-y-3">
          {/* Primary filter row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חפש לפי כותרת, ערוץ, נושא, הערות..."
                dir="rtl"
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 pr-9 pl-3 text-sm text-right placeholder:text-slate-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:text-zinc-200"
              />
            </div>

            {[
              { key: 'favorite',  label: '⭐ מועדפים',   active: filterFavorite,  set: () => setFilterFavorite(p => !p)  },
              { key: 'important', label: '🔴 חשוב',       active: filterImportant, set: () => setFilterImportant(p => !p) },
              { key: 'mustwatch', label: '🔁 לצפות שוב',  active: filterMustWatch, set: () => setFilterMustWatch(p => !p) },
            ].map(({ key, label, active, set }) => (
              <button
                key={key}
                type="button"
                onClick={set}
                className={cn(
                  'rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                  active
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
                )}
              >
                {label}
              </button>
            ))}

            {!isStocksView && items.some(i => i.archivedAt) && (
              <button
                type="button"
                onClick={() => { setShowArchivedCards(p => !p); clearCardSelection(); }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                  showArchivedCards
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
                )}
              >
                {showArchivedCards ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {showArchivedCards ? 'חזרה לפעילים' : 'ארכיון'}
              </button>
            )}

            {allSourceTabs.length > 0 && (
              <select
                value={filterSourceTab}
                onChange={e => setFilterSourceTab(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:text-zinc-200"
              >
                <option value="">כל המקורות</option>
                {allSourceTabs.map(tab => (
                  <option key={tab} value={tab}>{tab}</option>
                ))}
              </select>
            )}

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="mr-auto rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:text-zinc-200"
            >
              <option value="newest">חדשים ראשון</option>
              <option value="oldest">ישנים ראשון</option>
              <option value="title">לפי כותרת</option>
              <option value="priority">לפי עדיפות</option>
            </select>

            {hasActiveWorkspaceFilters && (
              <button
                type="button"
                onClick={clearAllWorkspaceFilters}
                className="rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-red-500 hover:border-red-300 dark:text-zinc-500 dark:hover:text-red-400 transition-colors whitespace-nowrap"
              >
                ✕ נקה הכל
              </button>
            )}
          </div>

          {/* Active filter chips — only the filters currently applied */}
          {hasActiveWorkspaceFilters && (
            <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t border-slate-100 dark:border-zinc-800">
              {search && (
                <FilterChip label={`חיפוש: "${search}"`} onRemove={() => setSearch('')} />
              )}
              {filterFavorite && <FilterChip label="⭐ מועדפים" onRemove={() => setFilterFavorite(false)} />}
              {filterImportant && <FilterChip label="🔴 חשוב" onRemove={() => setFilterImportant(false)} />}
              {filterMustWatch && <FilterChip label="🔁 לצפות שוב" onRemove={() => setFilterMustWatch(false)} />}
              {isStocksView && filterMarketStatus && (
                <FilterChip
                  label={`סטטוס: ${allWorkflowTabs.find(t => t.value === filterMarketStatus)?.label || filterMarketStatus}`}
                  onRemove={() => setFilterMarketStatus('')}
                />
              )}
              {filterSourceTab && <FilterChip label={`מקור: ${filterSourceTab}`} onRemove={() => setFilterSourceTab('')} />}
              {filterTags.map(tag => (
                <FilterChip key={tag} label={`#${tag}`} onRemove={() => setFilterTags(prev => prev.filter(t => t !== tag))} />
              ))}
              <button
                type="button"
                onClick={clearAllWorkspaceFilters}
                className="text-[11px] text-slate-400 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 underline mr-1"
              >
                נקה הכל
              </button>
            </div>
          )}

          {/* Tags row */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t border-slate-100 dark:border-zinc-800">
              <span className="text-[11px] text-slate-400 dark:text-zinc-600 ml-1">תגיות:</span>
              {allTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                    filterTags.includes(tag)
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  )}
                >
                  #{tag}
                </button>
              ))}
              {filterTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterTags([])}
                  className="text-[11px] text-slate-400 hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400 underline mr-1"
                >
                  נקה תגיות
                </button>
              )}
            </div>
          )}

        </div>

        {/* ══════════════════════ CONTENT ══════════════════════ */}
        {filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center py-24 gap-4 text-slate-400 dark:text-zinc-600">
            <Star className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium text-center">
              {items.length === 0
                ? 'לא נשמרו עדיין פריטים ל-Workspace Library'
                : isStocksView && filterMarketStatus
                  ? 'אין עדיין מניות בטאב הזה'
                  : 'לא נמצאו תוצאות לפי הסינון הנוכחי'}
            </p>
            {items.length === 0 && (
              <p className="text-xs text-center text-slate-400 dark:text-zinc-600">
                פתח סרטון ולחץ על ⭐ Workspace כדי לשמור
              </p>
            )}
          </div>
        ) : isStocksView ? (
          <StockWatchlistView
            items={filteredItems}
            filterMarketStatus={filterMarketStatus}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onUpdateItem={updateItem}
            onDeleteItems={deleteItems}
            onArchiveItems={archiveItems}
            onUpdateItemsBulk={updateItemsBulk}
          />
        ) : (
          <div className="space-y-3">
            {/* WorkspaceBulkActionBar renders as a fixed-bottom bar when selection is active */}
            <WorkspaceBulkActionBar
              count={selectedCardIds.size}
              onCopy={handleCopySelected}
              onArchive={() => handleArchiveCards([...selectedCardIds], true)}
              onDelete={() => setConfirmBulkDelete(true)}
              onClearSelection={clearCardSelection}
              onExportCsv={handleExportCsvSelected}
              fixed
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems
                .filter(i => (showArchivedCards ? !!i.archivedAt : !i.archivedAt))
                .map(item => (
                  <WorkspaceVideoCard
                    key={item.id}
                    item={item}
                    topics={topics}
                    onOpen={() => handleVideoClick(item)}
                    onDelete={() => requestDeleteCard(item)}
                    onEdit={() => setEditItem(item)}
                    onArchive={() => handleArchiveCards([item.id], !item.archivedAt)}
                    showMarketStatus={isStocksView}
                    onStatusChange={handleStatusChange}
                    selected={selectedCardIds.has(item.id)}
                    onToggleSelect={() => toggleCardSelect(item.id)}
                  />
                ))}
            </div>
          </div>
        )}
      </main>

      {/* ══════════════════════ DIALOGS ══════════════════════ */}

      <ConfirmDialog
        open={!!confirmDeleteItem}
        onOpenChange={open => !open && setConfirmDeleteItem(null)}
        title="למחוק את הפריט הזה מה-Workspace?"
        description="הפריט יימחק מ-Workspace בלבד. Brain / KnowledgeItems והסרטון המקורי לא יושפעו."
        confirmLabel="מחק"
        danger
        onConfirm={handleConfirmDeleteCard}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        title={`למחוק ${selectedCardIds.size} פריטים מסומנים מה-Workspace?`}
        description="הפעולה לא משפיעה על Brain / KnowledgeItems — היא מוחקת רק מה-Workspace."
        confirmLabel="מחק מסומנים"
        danger
        onConfirm={handleConfirmBulkDeleteCards}
      />

      <ConfirmDialog
        open={confirmDeleteAllVisible}
        onOpenChange={setConfirmDeleteAllVisible}
        title="מחיקת כל הפריטים בתצוגה"
        description={`אתה עומד למחוק ${deletableVisibleItems.length} פריטים שמוצגים כרגע מה-Workspace בלבד. פריטים שלא מופיעים בסינון הנוכחי לא יימחקו. להמשיך?`}
        confirmLabel={`מחק ${deletableVisibleItems.length} פריטים`}
        danger
        onConfirm={handleConfirmDeleteAllVisible}
      />

      <ConfirmDialog
        open={confirmDeleteAllWorkspace}
        onOpenChange={setConfirmDeleteAllWorkspace}
        title="⚠️ מחיקת כל ה-Workspace"
        description={`פעולה זו תמחק את כל ${items.length} פריטי ה-Workspace בלבד. היא לא תמחק Brain, KnowledgeItems או סרטונים מקוריים. כדי להמשיך הקלד: מחק הכל`}
        confirmLabel="מחק את כל ה-Workspace"
        danger
        requireTypedWord="מחק הכל"
        onConfirm={handleConfirmDeleteAllWorkspace}
      />

      <VideoDetailPanel
        video={selectedVideo}
        mentorName={selectedMentorName}
        mentors={mentors.filter(m => m.active !== false)}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        topics={systemTopics}
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigateTo={navigateTo}
        onVideoPatch={(patch) => setSelectedVideo(prev => prev ? { ...prev, ...patch } : null)}
      />

      {editItem && (
        <SaveToWorkspaceDialog
          open={!!editItem}
          onOpenChange={open => !open && setEditItem(null)}
          video={{
            id: editItem.videoId,
            title: editItem.videoTitle,
            channelTitle: editItem.channelName,
            thumbnail: editItem.thumbnail,
            category: editItem.category,
            subCategory: editItem.subCategory,
          }}
          sourceTab={editItem.sourceTab || null}
          onSaved={() => {
            setEditItem(null);
            reloadItems();
            toast.success('הסרטון עודכן ב-Workspace Library');
          }}
        />
      )}
    </div>
  );
}

// ─── FilterChip ───────────────────────────────────────────────────────────────
// One removable active-filter chip — shows what's applied, click ✕ to clear just that one.

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 leading-none"
        title="הסר סינון זה"
      >
        ✕
      </button>
    </span>
  );
}

// ─── WorkspaceVideoCard ───────────────────────────────────────────────────────

function WorkspaceVideoCard({ item, topics, onOpen, onDelete, onEdit, onArchive, showMarketStatus = false, onStatusChange, selected = false, onToggleSelect }) {
  const mainTopic = topics.find(t => t.id === item.topicId);
  const subTopic = topics.find(t => t.id === item.subTopicId);

  const savedDate = (() => {
    try {
      return format(new Date(item.savedAt), "d בMMM yyyy", { locale: he });
    } catch {
      return '';
    }
  })();

  return (
    <div className={cn(
      'group relative rounded-2xl border bg-white dark:bg-zinc-900 overflow-hidden transition-all hover:shadow-md',
      item.archivedAt
        ? 'border-amber-100 dark:border-amber-900/30 opacity-70'
        : 'border-slate-100 dark:border-zinc-800 hover:border-amber-200 dark:hover:border-amber-800/50',
    )}>
      {onToggleSelect && (
        <label className="absolute top-1.5 left-1.5 z-10 flex items-center justify-center h-5 w-5 rounded-md bg-white/90 dark:bg-zinc-900/90 shadow-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-400 cursor-pointer"
          />
        </label>
      )}

      <div className="relative aspect-video bg-slate-100 dark:bg-zinc-800 cursor-pointer" onClick={onOpen}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl text-slate-300 dark:text-zinc-600">▶</span>
          </div>
        )}

        {(item.flags?.isFavorite || item.flags?.isImportant || item.flags?.mustWatchAgain) && (
          <div className="absolute top-1.5 right-1.5 flex gap-0.5">
            {item.flags?.isFavorite    && <span className="text-sm leading-none drop-shadow">⭐</span>}
            {item.flags?.isImportant   && <span className="text-sm leading-none drop-shadow">🔴</span>}
            {item.flags?.mustWatchAgain && <span className="text-sm leading-none drop-shadow">🔁</span>}
          </div>
        )}

        {showMarketStatus && item.marketStatus && MARKET_STATUS_LABELS[item.marketStatus] && (
          <div className="absolute bottom-1.5 right-1.5">
            <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold leading-none', MARKET_STATUS_COLORS[item.marketStatus])}>
              {MARKET_STATUS_LABELS[item.marketStatus]}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white shadow-sm" title="ערוך">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {onArchive && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onArchive(); }} className="p-1.5 rounded-lg bg-white/90 text-amber-600 hover:bg-white shadow-sm" title={item.archivedAt ? 'שחזר מהארכיון' : 'ארכיון'}>
              {item.archivedAt ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            </button>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg bg-white/90 text-red-500 hover:bg-white shadow-sm" title="מחק">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 line-clamp-2 text-right cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors" onClick={onOpen}>
          {item.videoTitle || 'ללא כותרת'}
        </h3>

        {item.channelName && (
          <p className="text-xs text-slate-500 dark:text-zinc-400 text-right">{item.channelName}</p>
        )}

        {(mainTopic || subTopic) && (
          <div className="flex flex-wrap gap-1 justify-end">
            {mainTopic && (
              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:text-indigo-300">
                {mainTopic.emoji ? `${mainTopic.emoji} ` : ''}{mainTopic.name}
              </span>
            )}
            {subTopic && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                {subTopic.name}
              </span>
            )}
          </div>
        )}

        {item.notes && (
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 text-right line-clamp-2 bg-amber-50/60 dark:bg-amber-950/10 rounded-lg px-2 py-1 border border-amber-100 dark:border-amber-900/20">
            📝 {item.notes}
          </p>
        )}

        {(item.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {(item.tags || []).map(tag => (
              <span key={tag} className="rounded-full border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-600 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-400">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-zinc-800">
          <span className="text-[10px] text-slate-400 dark:text-zinc-600">{savedDate}</span>
          {item.sourceTab && (
            <span className="text-[9px] rounded-md border border-slate-100 dark:border-zinc-800 px-1.5 py-0.5 text-slate-400 dark:text-zinc-600">
              {item.sourceTab}
            </span>
          )}
        </div>

        {showMarketStatus && (
          <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-zinc-800">
            <select
              value={item.marketStatus || ''}
              onChange={e => onStatusChange?.(item.id, e.target.value || null)}
              onClick={e => e.stopPropagation()}
              className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-300"
            >
              <option value="">ללא סטטוס</option>
              <option value="watchlist">⭐ למעקב</option>
              <option value="candidate">🎯 מועמדות לכניסה</option>
              <option value="before_earnings">📋 לפני דוחות</option>
              <option value="risk">⚠️ בסיכון</option>
              <option value="archive">📦 ארכיון</option>
            </select>
          </div>
        )}
      </div>

      {/* ── Visible action strip ── */}
      <div
        className="flex items-center justify-end gap-0.5 border-t border-slate-100 dark:border-zinc-800 px-2 py-1"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:text-zinc-500 dark:hover:text-teal-400 dark:hover:bg-teal-950/20 transition-colors"
          title="ערוך"
        >
          <Edit2 className="h-3 w-3" />
          <span>ערוך</span>
        </button>
        {onArchive && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:text-zinc-600 dark:hover:text-amber-400 dark:hover:bg-amber-950/20 transition-colors"
            title={item.archivedAt ? 'שחזר מהארכיון' : 'ארכיון'}
          >
            {item.archivedAt ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:text-red-600 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-colors"
          title="מחק"
        >
          <Trash2 className="h-3 w-3" />
          <span>מחק</span>
        </button>
      </div>
    </div>
  );
}

// ─── ManageTopicsPanel ────────────────────────────────────────────────────────

function ManageTopicsPanel({ topics, mainTopics, getSubTopics, addTopic, updateTopic, deleteTopic, onClose }) {
  const [newMainName, setNewMainName] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newSubNames, setNewSubNames] = useState({});

  const handleAddMain = () => {
    if (!newMainName.trim()) return;
    addTopic({ name: newMainName.trim() });
    setNewMainName('');
  };

  const handleSaveEdit = (id) => {
    if (editName.trim()) updateTopic(id, { name: editName.trim() });
    setEditingId(null);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
          <Settings className="h-4 w-4 text-indigo-500" />
          ניהול נושאים
        </h2>
        <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {mainTopics.map(t => {
          const subs = getSubTopics(t.id);
          const isExpanded = expandedId === t.id;
          return (
            <div key={t.id} className="rounded-xl border border-slate-100 dark:border-zinc-800 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/50 dark:bg-zinc-800/40">
                <button type="button" onClick={() => setExpandedId(isExpanded ? null : t.id)} className="text-xs text-slate-400 w-4 shrink-0">
                  {isExpanded ? '▾' : '▸'}
                </button>
                {editingId === t.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEdit(t.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleSaveEdit(t.id)}
                    className="flex-1 rounded border border-indigo-300 px-2 py-0.5 text-sm text-right focus:outline-none dark:border-indigo-700 dark:bg-zinc-900 dark:text-zinc-200"
                  />
                ) : (
                  <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-zinc-200 text-right">
                    {t.emoji ? `${t.emoji} ` : ''}{t.name}
                    {subs.length > 0 && <span className="mr-1 text-xs text-slate-400 font-normal">({subs.length})</span>}
                  </span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => { setEditingId(t.id); setEditName(t.name); }} className="p-1 rounded text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400" title="שנה שם">
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => deleteTopic(t.id)} className="p-1 rounded text-slate-300 hover:text-red-500" title="מחק נושא">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-8 py-2 space-y-1 border-t border-slate-100 dark:border-zinc-800">
                  {subs.map(s => (
                    <SubTopicRow key={s.id} sub={s} updateTopic={updateTopic} deleteTopic={deleteTopic} />
                  ))}
                  <div className="flex gap-2 mt-2">
                    <input
                      value={newSubNames[t.id] || ''}
                      onChange={e => setNewSubNames(p => ({ ...p, [t.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (newSubNames[t.id] || '').trim()) {
                          addTopic({ name: newSubNames[t.id].trim(), parentId: t.id });
                          setNewSubNames(p => ({ ...p, [t.id]: '' }));
                        }
                      }}
                      placeholder="+ הוסף תת-נושא..."
                      className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-right placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if ((newSubNames[t.id] || '').trim()) {
                          addTopic({ name: newSubNames[t.id].trim(), parentId: t.id });
                          setNewSubNames(p => ({ ...p, [t.id]: '' }));
                        }
                      }}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      הוסף
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
        <input
          value={newMainName}
          onChange={e => setNewMainName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddMain()}
          placeholder="הוסף נושא ראשי חדש..."
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-right placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        />
        <button type="button" onClick={handleAddMain} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          <Plus className="h-3.5 w-3.5" />
          הוסף
        </button>
      </div>
    </div>
  );
}

function SubTopicRow({ sub, updateTopic, deleteTopic }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sub.name);

  const save = () => {
    if (name.trim()) updateTopic(sub.id, { name: name.trim() });
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 py-0.5">
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={save}
          className="flex-1 rounded border border-indigo-200 px-2 py-0.5 text-xs text-right focus:outline-none dark:border-indigo-800 dark:bg-zinc-900 dark:text-zinc-200"
        />
      ) : (
        <span className="flex-1 text-xs text-slate-600 dark:text-zinc-400 text-right">• {sub.name}</span>
      )}
      <button type="button" onClick={() => { setEditing(true); setName(sub.name); }} className="p-0.5 rounded text-slate-300 hover:text-indigo-500">
        <Edit2 className="h-3 w-3" />
      </button>
      <button type="button" onClick={() => deleteTopic(sub.id)} className="p-0.5 rounded text-slate-300 hover:text-red-500">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
