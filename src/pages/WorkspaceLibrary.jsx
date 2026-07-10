import { useState, useMemo } from "react";
import { Star, X, Trash2, Edit2, Plus, Search, Settings } from "lucide-react";
import { VIRTUAL_TAXONOMY } from "@/utils/workspaceVirtualTaxonomy";
import {
  getWorkspaceTabPreferences,
  saveWorkspaceTabPreferences,
  resetWorkspaceTabPreferences,
  getVisibleMainTabs,
  getAllMergedTabs,
  addCustomMainTab,
  removeCustomMainTab,
} from "@/utils/workspaceTabPreferences";
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

export default function WorkspaceLibrary({ navigateTo, isDark, toggleTheme }) {
  const { items, reload: reloadItems, deleteItem } = useWorkspaceItems();
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
  const [sortBy, setSortBy] = useState('newest');

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [manageTopicsOpen, setManageTopicsOpen] = useState(false);

  // Tab preferences (shared with WorkspaceSaveReviewOverlay via workspace_tab_preferences_v1)
  const [tabPrefs,         setTabPrefs]         = useState(() => getWorkspaceTabPreferences());
  const [showManageTabs,   setShowManageTabs]   = useState(false);
  const [editingTabId,     setEditingTabId]     = useState(null);
  const [editingTabLabel,  setEditingTabLabel]  = useState('');
  const [showAddTab,       setShowAddTab]       = useState(false);
  const [newTabName,       setNewTabName]       = useState('');
  const [newTabEmoji,      setNewTabEmoji]      = useState('');

  const allMainTabs = useMemo(
    () => getAllMergedTabs(VIRTUAL_TAXONOMY, tabPrefs),
    [tabPrefs],
  );

  const visibleMainTabs = useMemo(
    () => getVisibleMainTabs(allMainTabs, tabPrefs),
    [allMainTabs, tabPrefs],
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
    const def = { hiddenTabIds: [], labelOverrides: {}, customMainTabs: [] };
    setTabPrefs(def);
    resetWorkspaceTabPreferences();
  }

  function handleAddCustomTab() {
    const name = newTabName.trim();
    if (!name) return;
    const emoji = newTabEmoji.trim() || '📌';
    const newTopic = addTopic({ name, emoji });
    const newPrefs = addCustomMainTab(tabPrefs, { name, emoji, topicId: newTopic.id });
    setTabPrefs(newPrefs);
    saveWorkspaceTabPreferences(newPrefs);
    setNewTabName('');
    setNewTabEmoji('');
    setShowAddTab(false);
    toast.success(`הטאב "${name}" נוסף`);
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
    [allMainTabs, filterVirtTopicId]
  );

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
        (i.sourceTab || '').toLowerCase().includes(q)
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
    }
    if (filterFavorite) result = result.filter(i => i.flags?.isFavorite);
    if (filterImportant) result = result.filter(i => i.flags?.isImportant);
    if (filterMustWatch) result = result.filter(i => i.flags?.mustWatchAgain);
    if (filterTags.length > 0) {
      result = result.filter(i => {
        const itemTags = i.tags || [];
        return filterTags.some(tag => itemTags.includes(tag));
      });
    }
    if (filterSourceTab) result = result.filter(i => (i.sourceTab || null) === filterSourceTab);

    if (sortBy === 'newest') result.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    else if (sortBy === 'oldest') result.sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt));
    else if (sortBy === 'title') result.sort((a, b) => (a.videoTitle || '').localeCompare(b.videoTitle || '', 'he'));
    else if (sortBy === 'priority') {
      const score = item =>
        (item.flags?.isImportant ? 4 : 0) +
        (item.flags?.isFavorite  ? 2 : 0) +
        (item.flags?.mustWatchAgain ? 1 : 0);
      result.sort((a, b) => score(b) - score(a) || new Date(b.savedAt) - new Date(a.savedAt));
    }

    return result;
  }, [items, search, filterVirtTopicId, filterVirtSubtopic, activeVirtTopic, filterFavorite, filterImportant, filterMustWatch, filterTags, filterSourceTab, sortBy]);

  const handleDeleteTopic = (id) => {
    const result = deleteTopic(id);
    if (!result?.ok) {
      toast.error(`לא ניתן למחוק — ${result.count} פריטים שמורים תחת נושא זה`);
    }
  };

  const handleVideoClick = (item) => {
    const fullVideo = videos.find(v => v.id === item.videoId || v.videoId === item.videoId);
    if (fullVideo) {
      setSelectedVideo(fullVideo);
      setPanelOpen(true);
    } else {
      window.open(item.videoUrl, '_blank', 'noopener');
    }
  };

  const handleDelete = (item) => {
    deleteItem(item.id);
    toast.success('הסרטון הוסר מ-Workspace Library');
  };

  const selectedMentorName = useMemo(
    () => mentors.find(m => m.id === selectedVideo?.mentorId)?.name || '',
    [selectedVideo, mentors]
  );

  return (
    <div className="min-h-screen bg-slate-50/40 dark:bg-zinc-950" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 border-b border-slate-100 dark:bg-zinc-950/95 dark:border-zinc-800 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigateTo?.('Workspace')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
            title="חזור ל-Workspace"
          >
            <X className="h-4 w-4" />
          </button>
          <Star className="h-5 w-5 text-amber-500 fill-amber-400 shrink-0" />
          <h1 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Workspace Library</h1>
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-3 py-1 dark:bg-zinc-800 dark:text-zinc-500">
            {items.length} סרטונים
          </span>
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
          </div>
        </div>
      </header>

      <main className="px-6 py-5 max-w-7xl mx-auto space-y-5">
        {/* Virtual topic tabs — row 1: broad domains */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => { setFilterVirtTopicId(''); setFilterVirtSubtopic(''); }}
              className={cn(
                'rounded-xl border px-4 py-2 text-sm font-semibold transition-all',
                !filterVirtTopicId
                  ? 'border-slate-800 bg-slate-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-400'
              )}
            >
              הכל{items.length > 0 ? ` (${items.length})` : ''}
            </button>
            {visibleMainTabs.map(vt => (
              <button
                key={vt.id}
                type="button"
                onClick={() => { setFilterVirtTopicId(vt.id); setFilterVirtSubtopic(''); }}
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-semibold transition-all',
                  filterVirtTopicId === vt.id
                    ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-zinc-900 shadow-sm'
                    : virtTopicCount[vt.id]
                      ? 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-400'
                      : 'border-slate-100 text-slate-400 hover:bg-slate-50 hover:border-slate-200 dark:border-zinc-800 dark:text-zinc-600 dark:hover:bg-zinc-900'
                )}
              >
                {vt.emoji} {vt.displayName}{virtTopicCount[vt.id] ? ` (${virtTopicCount[vt.id]})` : ''}
              </button>
            ))}
            {/* Add custom tab */}
            {showAddTab ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={newTabEmoji}
                  onChange={e => setNewTabEmoji(e.target.value)}
                  placeholder="📌"
                  maxLength={2}
                  className="w-12 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <input
                  type="text"
                  value={newTabName}
                  onChange={e => setNewTabName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddCustomTab();
                    if (e.key === 'Escape') { setShowAddTab(false); setNewTabName(''); setNewTabEmoji(''); }
                  }}
                  placeholder="שם הטאב..."
                  dir="rtl"
                  className="w-36 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTab}
                  disabled={!newTabName.trim()}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40 whitespace-nowrap"
                >
                  הוסף
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddTab(false); setNewTabName(''); setNewTabEmoji(''); }}
                  className="rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddTab(true)}
                className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-amber-400 hover:text-amber-600 dark:text-zinc-500 dark:hover:text-amber-400 transition-all whitespace-nowrap"
              >
                + הוסף נושא
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowManageTabs(p => !p)}
              title="ערוך טאבים"
              className={cn(
                'mr-auto rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all',
                showManageTabs
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
                  : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800'
              )}
            >
              ⚙ ערוך טאבים
            </button>
          </div>

            {/* Manage tabs panel */}
            {showManageTabs && (
              <div className="rounded-2xl border border-amber-200 dark:border-zinc-700 bg-amber-50/70 dark:bg-zinc-900/80 px-4 py-3" dir="rtl">
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

            {/* Row 2: subtopics for the selected main domain */}
            {activeVirtTopic && activeVirtTopic.subtopics.length > 0 && (
              <div className="flex flex-wrap gap-2 pr-1">
                <button
                  type="button"
                  onClick={() => setFilterVirtSubtopic('')}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                    !filterVirtSubtopic
                      ? 'border-slate-700 bg-slate-700 text-white dark:border-zinc-300 dark:bg-zinc-300 dark:text-zinc-900 shadow-sm'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-400'
                  )}
                >
                  כולם{virtTopicCount[filterVirtTopicId] ? ` (${virtTopicCount[filterVirtTopicId]})` : ''}
                </button>
                {activeVirtTopic.subtopics.map(vs => (
                  <button
                    key={vs.id}
                    type="button"
                    onClick={() => setFilterVirtSubtopic(prev => prev === vs.id ? '' : vs.id)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                      filterVirtSubtopic === vs.id
                        ? 'border-violet-500 bg-violet-500 text-white shadow-sm'
                        : virtSubtopicCount[vs.id]
                          ? 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                          : 'border-slate-100 text-slate-400 hover:bg-slate-50 hover:border-slate-200 dark:border-zinc-800 dark:text-zinc-600 dark:hover:bg-zinc-900'
                    )}
                  >
                    {vs.name}{virtSubtopicCount[vs.id] ? ` (${virtSubtopicCount[vs.id]})` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

        {/* Manage topics panel */}
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

        {/* Filters + search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש לפי כותרת, ערוץ, נושא, הערות..."
              dir="rtl"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-3 text-sm text-right placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </div>

          {[
            { key: 'favorite', label: '⭐ מועדפים', active: filterFavorite, set: () => setFilterFavorite(p => !p) },
            { key: 'important', label: '🔴 חשוב', active: filterImportant, set: () => setFilterImportant(p => !p) },
            { key: 'mustwatch', label: '🔁 לצפות שוב', active: filterMustWatch, set: () => setFilterMustWatch(p => !p) },
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

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 mr-auto"
          >
            <option value="newest">חדשים ראשון</option>
            <option value="oldest">ישנים ראשון</option>
            <option value="title">לפי כותרת</option>
            <option value="priority">לפי עדיפות</option>
          </select>
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center" dir="rtl">
            <span className="text-[11px] text-slate-400 dark:text-zinc-600 ml-1">תגיות:</span>
            {allTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setFilterTags(prev =>
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  )
                }
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

        {/* SourceTab filter */}
        {allSourceTabs.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center" dir="rtl">
            <span className="text-[11px] text-slate-400 dark:text-zinc-600">מקור:</span>
            <button
              type="button"
              onClick={() => setFilterSourceTab('')}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                !filterSourceTab
                  ? 'border-slate-700 bg-slate-700 text-white dark:border-zinc-300 dark:bg-zinc-300 dark:text-zinc-900'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-400'
              )}
            >
              הכל
            </button>
            {allSourceTabs.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterSourceTab(prev => prev === tab ? '' : tab)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                  filterSourceTab === tab
                    ? 'border-violet-500 bg-violet-500 text-white'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Video grid */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400 dark:text-zinc-600">
            <Star className="h-12 w-12 opacity-25" />
            <p className="text-sm font-medium text-center">
              {items.length === 0
                ? 'לא נשמרו עדיין סרטונים ל-Workspace Library'
                : 'לא נמצאו תוצאות לפי הסינון הנוכחי'}
            </p>
            {items.length === 0 && (
              <p className="text-xs text-center text-slate-400 dark:text-zinc-600">
                פתח סרטון ולחץ על ⭐ Workspace כדי לשמור
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <WorkspaceVideoCard
                key={item.id}
                item={item}
                topics={topics}
                onOpen={() => handleVideoClick(item)}
                onDelete={() => handleDelete(item)}
                onEdit={() => setEditItem(item)}
              />
            ))}
          </div>
        )}
      </main>

      {/* VideoDetailPanel */}
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

      {/* Edit existing workspace item */}
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

// ─── WorkspaceVideoCard ───────────────────────────────────────────────────────

function WorkspaceVideoCard({ item, topics, onOpen, onDelete, onEdit }) {
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
    <div className="group relative rounded-2xl border border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden hover:border-amber-200 dark:hover:border-amber-800/50 transition-all hover:shadow-md">
      {/* Thumbnail */}
      <div
        className="relative aspect-video bg-slate-100 dark:bg-zinc-800 cursor-pointer"
        onClick={onOpen}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl text-slate-300 dark:text-zinc-600">▶</span>
          </div>
        )}

        {/* Flag badges */}
        {(item.flags?.isFavorite || item.flags?.isImportant || item.flags?.mustWatchAgain) && (
          <div className="absolute top-1.5 right-1.5 flex gap-0.5">
            {item.flags?.isFavorite && <span className="text-sm leading-none drop-shadow">⭐</span>}
            {item.flags?.isImportant && <span className="text-sm leading-none drop-shadow">🔴</span>}
            {item.flags?.mustWatchAgain && <span className="text-sm leading-none drop-shadow">🔁</span>}
          </div>
        )}

        {/* Hover action overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white shadow-sm"
            title="ערוך"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg bg-white/90 text-red-500 hover:bg-white shadow-sm"
            title="מחק"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="p-3 space-y-2">
        <h3
          className="text-sm font-semibold text-slate-900 dark:text-zinc-100 line-clamp-2 text-right cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          onClick={onOpen}
        >
          {item.videoTitle || 'ללא כותרת'}
        </h3>

        {item.channelName && (
          <p className="text-xs text-slate-500 dark:text-zinc-400 text-right">{item.channelName}</p>
        )}

        {/* Topic chips */}
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

        {/* Notes preview */}
        {item.notes && (
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 text-right line-clamp-2 bg-amber-50/60 dark:bg-amber-950/10 rounded-lg px-2 py-1 border border-amber-100 dark:border-amber-900/20">
            📝 {item.notes}
          </p>
        )}

        {/* Tags */}
        {(item.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {(item.tags || []).map(tag => (
              <span
                key={tag}
                className="rounded-full border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-600 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-zinc-800">
          <span className="text-[10px] text-slate-400 dark:text-zinc-600">{savedDate}</span>
          {item.sourceTab && (
            <span className="text-[9px] rounded-md border border-slate-100 dark:border-zinc-800 px-1.5 py-0.5 text-slate-400 dark:text-zinc-600">
              {item.sourceTab}
            </span>
          )}
        </div>
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
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800"
        >
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
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="text-xs text-slate-400 w-4 shrink-0"
                >
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
                    {subs.length > 0 && (
                      <span className="mr-1 text-xs text-slate-400 font-normal">({subs.length})</span>
                    )}
                  </span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setEditingId(t.id); setEditName(t.name); }}
                    className="p-1 rounded text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                    title="שנה שם"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTopic(t.id)}
                    className="p-1 rounded text-slate-300 hover:text-red-500"
                    title="מחק נושא"
                  >
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

      {/* Add main topic */}
      <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
        <input
          value={newMainName}
          onChange={e => setNewMainName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddMain()}
          placeholder="הוסף נושא ראשי חדש..."
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-right placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        />
        <button
          type="button"
          onClick={handleAddMain}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
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
      <button
        type="button"
        onClick={() => { setEditing(true); setName(sub.name); }}
        className="p-0.5 rounded text-slate-300 hover:text-indigo-500"
      >
        <Edit2 className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => deleteTopic(sub.id)}
        className="p-0.5 rounded text-slate-300 hover:text-red-500"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
