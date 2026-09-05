import { useState, useMemo, useEffect, useRef } from "react";
import { Star, X, Trash2, Edit2, Plus, Search, Settings, Archive, ArchiveRestore, MoreVertical, Copy, FileDown } from "lucide-react";
import { ConfirmDialog } from "@/components/workspace/ConfirmDialog";
import { VIRTUAL_TAXONOMY } from "@/utils/workspaceVirtualTaxonomy";
import {
  getWorkspaceTabPreferences,
  saveWorkspaceTabPreferences,
  resetWorkspaceTabPreferences,
  getVisibleMainTabs,
  getAllMergedTabs,
  getCanonicalSubtopicsForVirtualTopic,
  addCustomMainTab,
  removeCustomMainTab,
  addCustomSubtopic,
  getCustomSubtopics,
  addCustomWorkflowTab,
  getCustomWorkflowTabs,
} from "@/utils/workspaceTabPreferences";
import { WorkspaceTabRow } from "@/components/workspace/WorkspaceTabRow";
import { WorkspaceContentSectionTabs } from "@/components/workspace/WorkspaceContentSectionTabs";
import { WorkspaceStatusFilterPills } from "@/components/workspace/WorkspaceStatusFilterPills";
import { WorkspaceItemFlagToggles } from "@/components/workspace/WorkspaceItemFlagToggles";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWorkspaceItems, useWorkspaceTopics } from "@/hooks/useWorkspaceLibrary";
import { useWorkspaceDays } from "@/hooks/useWorkspaceDays";
import { useVideos } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import { useTopics } from "@/hooks/useTopics";
import { VideoDetailPanel } from "@/components/dashboard/VideoDetailPanel";
import { SaveToWorkspaceDialog } from "@/components/workspace/SaveToWorkspaceDialog";
import { WorkspaceDay } from "@/components/workspace/WorkspaceDay";
import { WorkspaceBulkActionBar, formatWorkspaceItemsForCopy, exportWorkspaceItemsToCsv } from "@/components/workspace/WorkspaceBulkActionBar";
import { getWorkspacePersistenceErrorMessage } from "@/lib/workspaceLibraryStore";
import { WorkspaceCollectionTiles } from "@/components/workspace/WorkspaceCollectionTiles";
import { WorkspaceScopeTiles } from "@/components/workspace/WorkspaceScopeTiles";
import { StructuredSnapshotView } from "@/components/workspace/StructuredSnapshotView";
import { WorkspaceDuplicatePreview } from "@/components/workspace/WorkspaceDuplicatePreview";
import { checksumWorkspaceItemIds, resolveWorkspaceContentSectionSelection, selectCollectionForScope, selectGlobalCollections, selectVideoCollections, selectVideoGroups, selectWorkspaceContentSectionPresentation, selectWorkspaceContentSectionTabs, selectWorkspaceVideoGroups, findVideoByIdOrUrl } from "@/utils/workspaceVideoGrouping";
import { buildVideoPublishedAtLookup } from "@/utils/workspaceSavedAnalysis";
import { WorkspaceVideoGroupCard } from "@/components/workspace/WorkspaceVideoGroupCard";
import { WorkspaceFocusedVideoCard, WorkspaceGlobalSavedAnalysisGroup } from "@/components/workspace/WorkspaceFocusedVideoCard";
import { WorkspaceTopicManager } from "@/components/workspace/WorkspaceTopicManager";
import { WorkspaceBriefRoutingPreview } from "@/components/workspace/WorkspaceBriefRoutingPreview";
import { WorkspaceSemanticFilters } from "@/components/workspace/WorkspaceSemanticFilters";
import {
  WORKSPACE_COLLECTION_IDS,
  WORKSPACE_FALLBACK_COLLECTION,
  getWorkspaceHeadingByCollection,
} from "@/config/workspaceHeadingRegistry";
import {
  MARKET_SEMANTIC_FALLBACK,
  MARKET_SEMANTIC_FILTERS,
  MARKET_VIRTUAL_TOPIC_ID,
  countUniqueWorkspaceContents,
  getMarketOrganizationalSubtopics,
  selectWorkspaceSemanticFilterCounts,
} from "@/utils/workspaceMarketDimensions";
import { checksumWorkspacePayloadsExcludingTopicAssignment } from "@/utils/workspaceBriefRouting";
import { WorkspaceRecordRevealProvider } from "@/context/WorkspaceRecordRevealContext";

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

function reportWorkspaceWriteFailure(result) {
  if (result?.ok) return false;
  toast.error(getWorkspacePersistenceErrorMessage(result));
  return true;
}

export default function WorkspaceLibrary({ navigateTo, pageParams = {}, isDark, toggleTheme }) {
  const { items, reload: reloadItems, deleteItem, updateItem, deleteItems, deleteAllItems, updateItemsBulk, archiveItems, reassignVideoGroupTopic } = useWorkspaceItems();
  const { topics, addTopic, updateTopic, deleteTopic } = useWorkspaceTopics();
  const { data: videos = [] } = useVideos();
  const { data: mentors = [] } = useMentors();
  const { data: systemTopics = [] } = useTopics();
  const videoLookup = useMemo(() => buildVideoPublishedAtLookup(videos), [videos]);

  const [search, setSearch] = useState('');
  const [filterVirtTopicId, setFilterVirtTopicId] = useState('');
  const [filterVirtSubtopic, setFilterVirtSubtopic] = useState('');
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [filterImportant, setFilterImportant] = useState(false);
  const [filterMustWatch, setFilterMustWatch] = useState(false);
  const [filterTags, setFilterTags] = useState([]);
  const [filterSemanticTags, setFilterSemanticTags] = useState([]);
  const [filterSourceTab, setFilterSourceTab] = useState('');
  const [filterMarketStatus, setFilterMarketStatus] = useState('');
  const [showAddWorkflowStatus, setShowAddWorkflowStatus] = useState(false);
  const [newWorkflowStatusName, setNewWorkflowStatusName] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [activeCollection, setActiveCollection] = useState(null);
  const [pinnedCollection, setPinnedCollection] = useState(null);
  const [activeContentSectionId, setActiveContentSectionId] = useState('');
  const [pinnedContentSectionId, setPinnedContentSectionId] = useState('');
  const [openSnapshotItem, setOpenSnapshotItem] = useState(null);
  const [duplicatePreviewOpen, setDuplicatePreviewOpen] = useState(false);
  const [briefRoutingPreviewOpen, setBriefRoutingPreviewOpen] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState(null);
  const [handledRouteKey, setHandledRouteKey] = useState('');
  const [revealedRecordIds, setRevealedRecordIds] = useState([]);
  const [revealedRecordCount, setRevealedRecordCount] = useState(0);
  const handledRevealTokenRef = useRef('');
  // Absolute close deadline (Date.now() + 7000 at open time) for the reveal highlight.
  // Kept in a ref (source of truth) + mirrored to state so a dedicated effect can
  // schedule the close timer independently of `items` re-renders (see below).
  const closeDeadlineRef = useRef(0);
  const [revealCloseAt, setRevealCloseAt] = useState(0);
  const scrolledRevealTokenRef = useRef('');

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [manageTopicsOpen, setManageTopicsOpen] = useState(false);

  const [showArchivedCards, setShowArchivedCards] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState(() => new Set());
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmDuplicateCleanupIds, setConfirmDuplicateCleanupIds] = useState([]);
  const [confirmDeleteAllVisible, setConfirmDeleteAllVisible] = useState(false);
  const [confirmDeleteAllWorkspace, setConfirmDeleteAllWorkspace] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);

  const [tabPrefs,        setTabPrefs]        = useState(() => getWorkspaceTabPreferences());
  const [showManageTabs,  setShowManageTabs]  = useState(false);
  const [editingTabId,    setEditingTabId]    = useState(null);
  const [editingTabLabel, setEditingTabLabel] = useState('');

  const allMainTabs = useMemo(() => getAllMergedTabs(VIRTUAL_TAXONOMY, tabPrefs, topics).map(baseTopic => {
    const canonicalSubtopics = getCanonicalSubtopicsForVirtualTopic(baseTopic, topics);
    return {
      ...baseTopic,
      realTopicIds: [...new Set([...(baseTopic.realTopicIds || []), ...canonicalSubtopics.flatMap(topic => topic.realTopicIds)])],
      subtopics: [...(baseTopic.subtopics || []), ...canonicalSubtopics],
    };
  }), [tabPrefs, topics]);
  const visibleMainTabs = useMemo(() => getVisibleMainTabs(allMainTabs, tabPrefs), [allMainTabs, tabPrefs]);
  const validSemanticFilterIds = useMemo(() => new Set([
    ...MARKET_SEMANTIC_FILTERS.map(filter => filter.id),
    MARKET_SEMANTIC_FALLBACK.id,
  ]), []);

  useEffect(() => {
    const routeKey = JSON.stringify(pageParams || {});
    if (routeKey === handledRouteKey) return;
    if (pageParams.routeNotice === 'invalid-route') toast.info('הנתיב הישן הוחלף בספריית Workspace התקינה');
    if (pageParams.routeNotice === 'malformed-params') toast.info('פרמטרים לא תקינים הוסרו מהכתובת');

    const validCollections = new Set(['all', ...WORKSPACE_COLLECTION_IDS, WORKSPACE_FALLBACK_COLLECTION.id]);
    if (pageParams.collection && !validCollections.has(pageParams.collection)) toast.info('האוסף המבוקש לא נמצא; מוצגים כל הפריטים');
    setActiveCollection(validCollections.has(pageParams.collection) && pageParams.collection !== 'all' ? pageParams.collection : null);
    let nextTopicId = '';
    if (pageParams.topicId) {
      const topicExists = allMainTabs.some(topic => topic.id === pageParams.topicId);
      if (topicExists) nextTopicId = pageParams.topicId;
      else toast.info('הנושא המבוקש לא נמצא; מוצגים כל הנושאים');
    }
    setFilterVirtTopicId(nextTopicId);
    let nextSubtopicId = '';
    if (pageParams.subtopicId) {
      const selectedTopic = allMainTabs.find(topic => topic.id === nextTopicId);
      const organizational = selectedTopic?.id === MARKET_VIRTUAL_TOPIC_ID
        ? getMarketOrganizationalSubtopics(selectedTopic, topics)
        : (selectedTopic?.subtopics || []);
      const subtopicExists = organizational.some(subtopic => subtopic.id === pageParams.subtopicId);
      if (subtopicExists) nextSubtopicId = pageParams.subtopicId;
      else toast.info('תת־הנושא המבוקש לא נמצא; מוצגים כל תתי־הנושאים');
    }
    setFilterVirtSubtopic(nextSubtopicId);
    const requestedSemanticFilters = String(pageParams.semantic || '').split(',').map(value => value.trim()).filter(Boolean);
    const nextSemanticFilters = requestedSemanticFilters.filter(value => validSemanticFilterIds.has(value));
    if (requestedSemanticFilters.length !== nextSemanticFilters.length) toast.info('מסנני תוכן לא תקינים הוסרו מהתצוגה');
    setFilterSemanticTags(nextTopicId === MARKET_VIRTUAL_TOPIC_ID ? [...new Set(nextSemanticFilters)] : []);
    if (pageParams.itemId) {
      const requestedItem = items.find(item => item.id === pageParams.itemId);
      if (!requestedItem) toast.info('הפריט המבוקש לא נמצא; הספרייה נפתחה ללא שינוי בנתונים');
      else if (requestedItem.itemType === 'structured-snapshot' && requestedItem.structuredSnapshot) setOpenSnapshotItem(requestedItem);
      else setFocusedItemId(requestedItem.id);
    }
    setHandledRouteKey(routeKey);
  }, [allMainTabs, handledRouteKey, items, pageParams, topics, validSemanticFilterIds]);

  useEffect(() => {
    const revealIds = [...new Set((Array.isArray(pageParams.revealRecordIds) ? pageParams.revealRecordIds : [])
      .map(value => String(value || '').trim())
      .filter(id => items.some(item => String(item?.id) === id)))];
    const revealToken = String(pageParams.revealToken || '');
    if (!revealToken || handledRevealTokenRef.current === revealToken || revealIds.length === 0) return undefined;
    handledRevealTokenRef.current = revealToken;
    setRevealedRecordIds(revealIds);
    setRevealedRecordCount(Number(pageParams.revealCount) || revealIds.length);
    // Fix the close deadline once, at open time, so later `items` changes (which
    // re-run this effect's dependency check) cannot postpone or drop the close.
    closeDeadlineRef.current = Date.now() + 7000;
    setRevealCloseAt(closeDeadlineRef.current);
    return undefined;
  }, [items, pageParams.revealCount, pageParams.revealRecordIds, pageParams.revealToken]);

  // Owns the actual close timer. Depends only on `revealCloseAt`, NOT on `items`,
  // so an unrelated items reload during the 7s window cannot tear down and drop
  // this timer without rescheduling it. A new reveal token produces a new
  // `revealCloseAt` value above, which correctly supersedes the previous timer.
  useEffect(() => {
    if (!revealCloseAt) return undefined;
    const delay = Math.max(0, revealCloseAt - Date.now());
    const timeoutId = window.setTimeout(() => {
      setRevealedRecordIds([]);
      setRevealedRecordCount(0);
    }, delay);
    return () => window.clearTimeout(timeoutId);
  }, [revealCloseAt]);

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
    const result = addTopic({ name: trimmedName, emoji: finalEmoji });
    if (!result?.ok) {
      toast.error((result?.errors || ['לא ניתן היה ליצור את הנושא.']).join(' '));
      return;
    }
    const newPrefs = addCustomMainTab(tabPrefs, { name: trimmedName, emoji: finalEmoji, topicId: result.topic.id });
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

  const allVideoGrouping = useMemo(() => selectVideoGroups(items), [items]);
  const scopeSelection = useMemo(() => selectCollectionForScope({
    videoGroups: allVideoGrouping.videoGroups,
    withoutVideo: allVideoGrouping.withoutVideo,
    focusedVideoKey: pageParams.video || null,
    collectionType: activeCollection,
  }), [activeCollection, allVideoGrouping.videoGroups, allVideoGrouping.withoutVideo, pageParams.video]);
  const focusedVideoGroup = scopeSelection.focusedVideoGroup;
  const scopeItems = focusedVideoGroup ? focusedVideoGroup.items : items;

  // Pin the most recently saved-from video above the "כל הסרטונים" list when
  // nothing is explicitly focused via the `video` URL param — derived from
  // each group's existing latestSaveDate, no new persistence.
  const pinnedRecentGroup = useMemo(() => {
    if (focusedVideoGroup) return null;
    return allVideoGrouping.videoGroups.reduce((latest, group) => (
      !latest || String(group.latestSaveDate || '') > String(latest.latestSaveDate || '') ? group : latest
    ), null);
  }, [focusedVideoGroup, allVideoGrouping.videoGroups]);
  const pinnedRecentCollectionCounts = useMemo(
    () => pinnedRecentGroup ? selectVideoCollections(pinnedRecentGroup) : null,
    [pinnedRecentGroup],
  );
  // Unlike pinnedRecentGroup (which nulls itself once a video is focused via
  // the URL), this stays available regardless of focus — the "סרטון אחרון"
  // scope tile needs it to know its own target/selected state either way.
  const mostRecentVideoGroup = useMemo(() => (
    allVideoGrouping.videoGroups.reduce((latest, group) => (
      !latest || String(group.latestSaveDate || '') > String(latest.latestSaveDate || '') ? group : latest
    ), null)
  ), [allVideoGrouping.videoGroups]);
  const globalUniqueContentCount = useMemo(() => countUniqueWorkspaceContents(items), [items]);
  // Per-collection unique counts across ALL videos, used only to decide
  // whether switching the scope tile would leave the active category empty
  // (see scopeTiles below) — reuses the same selector selectCollectionForScope
  // already calls for the unfocused case, instead of writing a parallel count.
  const globalCollectionCounts = useMemo(
    () => selectGlobalCollections(allVideoGrouping.videoGroups, allVideoGrouping.withoutVideo),
    [allVideoGrouping.videoGroups, allVideoGrouping.withoutVideo],
  );
  const pinnedCollectionItems = useMemo(() => {
    if (!pinnedRecentGroup || !pinnedCollection) return pinnedRecentGroup?.items || [];
    return selectWorkspaceVideoGroups({
      items: pinnedRecentGroup.items,
      collectionId: pinnedCollection,
    }).items;
  }, [pinnedCollection, pinnedRecentGroup]);
  const pinnedContentSectionNavigation = useMemo(
    () => selectWorkspaceContentSectionTabs(pinnedCollectionItems, { collectionId: pinnedCollection }),
    [pinnedCollection, pinnedCollectionItems],
  );
  const effectivePinnedContentSectionId = resolveWorkspaceContentSectionSelection(
    pinnedContentSectionId,
    pinnedContentSectionNavigation,
  );
  const pinnedVisibleGroup = useMemo(() => {
    if (!pinnedRecentGroup) return null;
    const selection = selectWorkspaceContentSectionPresentation(
      { items: pinnedCollectionItems },
      effectivePinnedContentSectionId,
    );
    return selection.videoGroups.find(group => group.videoKey === pinnedRecentGroup.videoKey) || {
      ...pinnedRecentGroup,
      items: [],
      versions: [],
      exactDuplicateGroups: [],
      uniqueContentCount: 0,
    };
  }, [effectivePinnedContentSectionId, pinnedCollectionItems, pinnedRecentGroup]);

  useEffect(() => { setPinnedContentSectionId(''); }, [pinnedCollection, pinnedRecentGroup?.videoKey]);
  useEffect(() => {
    if (pinnedContentSectionId !== effectivePinnedContentSectionId) setPinnedContentSectionId(effectivePinnedContentSectionId);
  }, [effectivePinnedContentSectionId, pinnedContentSectionId]);

  const virtTopicCount = useMemo(() => {
    return Object.fromEntries(allMainTabs.map(vt => {
      const idSet = new Set(vt.realTopicIds || []);
      const nameSet = new Set(vt.legacyNames || []);
      const matching = scopeItems.filter(item => (
        idSet.has(item.topicId) || idSet.has(item.subTopicId) || idSet.has(item.subtopicId) || nameSet.has(item.topicName)
      ));
      return [vt.id, countUniqueWorkspaceContents(matching)];
    }));
  }, [scopeItems, allMainTabs]);
  const allUniqueContentCount = useMemo(() => countUniqueWorkspaceContents(scopeItems), [scopeItems]);

  const activeVirtTopic = useMemo(
    () => allMainTabs.find(v => v.id === filterVirtTopicId) || null,
    [allMainTabs, filterVirtTopicId],
  );

  const activeVirtTopicVideoCount = useMemo(() => {
    if (!activeVirtTopic) return 0;
    const idSet = new Set(activeVirtTopic.realTopicIds || []);
    const nameSet = new Set(activeVirtTopic.legacyNames || []);
    const matching = scopeItems.filter(item => (
      idSet.has(item.topicId) || idSet.has(item.subTopicId) || idSet.has(item.subtopicId) || nameSet.has(item.topicName)
    ));
    return selectVideoGroups(matching).videoCount;
  }, [activeVirtTopic, scopeItems]);

  const activeOrganizationalSubtopics = useMemo(() => {
    if (!activeVirtTopic) return [];
    if (activeVirtTopic.id === MARKET_VIRTUAL_TOPIC_ID) return getMarketOrganizationalSubtopics(activeVirtTopic, topics);
    return activeVirtTopic.subtopics || [];
  }, [activeVirtTopic, topics]);

  const isStocksView = filterVirtTopicId === MARKET_VIRTUAL_TOPIC_ID && filterSemanticTags.includes('stocks');

  useEffect(() => { setFilterMarketStatus(''); }, [filterVirtTopicId, filterVirtSubtopic, isStocksView]);

  const virtSubtopicCount = useMemo(() => {
    if (!activeVirtTopic) return {};
    return Object.fromEntries(activeOrganizationalSubtopics.map(subtopic => {
      const ids = new Set(subtopic.realTopicIds || []);
      const matching = scopeItems.filter(item => ids.has(item.topicId) || ids.has(item.subTopicId) || ids.has(item.subtopicId));
      return [subtopic.id, selectVideoGroups(matching).videoCount];
    }));
  }, [scopeItems, activeVirtTopic, activeOrganizationalSubtopics]);

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

  const routeNoticeText = useMemo(() => {
    if (pageParams.itemId && !items.some(item => item.id === pageParams.itemId)) return 'הפריט המבוקש לא נמצא; הספרייה נפתחה ללא שינוי בנתונים';
    if (pageParams.video && !focusedVideoGroup) return 'הסרטון המבוקש לא נמצא; מוצג תוכן מכל הסרטונים';
    if (pageParams.routeNotice === 'invalid-route') return 'הנתיב הישן הוחלף בספריית Workspace התקינה';
    if (pageParams.routeNotice === 'malformed-params') return 'פרמטרים לא תקינים הוסרו מהכתובת';
    return '';
  }, [focusedVideoGroup, items, pageParams]);

  const activeOrganizationalSubtopic = useMemo(
    () => activeOrganizationalSubtopics.find(subtopic => subtopic.id === filterVirtSubtopic) || null,
    [activeOrganizationalSubtopics, filterVirtSubtopic],
  );

  const statusFilters = useMemo(() => ({
    archived: showArchivedCards ? 'archived' : 'all',
    favorite: filterFavorite,
    important: filterImportant,
    mustWatch: filterMustWatch,
    marketStatus: isStocksView ? filterMarketStatus : '',
    sourceTab: filterSourceTab,
    tags: filterTags,
  }), [filterFavorite, filterImportant, filterMarketStatus, filterMustWatch, filterSourceTab, filterTags, isStocksView, showArchivedCards]);

  // Status-pill active state for the pill-row filters, and the shared toggle
  // handler for both filtering and marking. Live counts (statusPillCounts)
  // are computed further below, once the rest of the filtering pipeline
  // (activeCollection/effectiveContentSectionId) exists to reuse.
  const statusPillActive = useMemo(() => ({
    favorite: filterFavorite,
    important: filterImportant,
    mustWatch: filterMustWatch,
  }), [filterFavorite, filterImportant, filterMustWatch]);

  const toggleStatusPillFilter = (key) => {
    if (key === 'favorite') setFilterFavorite(p => !p);
    else if (key === 'important') setFilterImportant(p => !p);
    else if (key === 'mustWatch') setFilterMustWatch(p => !p);
  };

  const STATUS_FLAG_FIELD = { favorite: 'isFavorite', important: 'isImportant', mustWatch: 'mustWatchAgain' };

  // Row-level single-item toggle: flags are stored/replaced as a whole object
  // per updateWorkspaceItem's shallow-merge semantics (workspaceLibraryStore.js),
  // so every toggle sends the full merged flags object, same as
  // EditWorkspaceItemModal's existing save path.
  const handleToggleItemFlag = (item, key) => {
    const field = STATUS_FLAG_FIELD[key];
    if (!field) return;
    updateItem(item.id, { flags: { ...(item.flags || {}), [field]: !item.flags?.[field] } });
  };

  // Bulk mark: always SETS the flag true for every selected item (mirrors the
  // existing bulk-archive action, which also hardcodes `true` rather than
  // toggling per item). Runs sequentially (not Promise.all) so each
  // load-modify-persist write completes before the next starts — updateItem
  // reads the full item list from storage on every call, so concurrent writes
  // could otherwise race and drop an earlier item's change.
  const handleBulkSetItemFlag = async (key) => {
    const field = STATUS_FLAG_FIELD[key];
    if (!field) return;
    const ids = [...selectedCardIds];
    for (const id of ids) {
      const current = items.find(i => i.id === id);
      if (!current) continue;
      // eslint-disable-next-line no-await-in-loop
      await updateItem(id, { flags: { ...(current.flags || {}), [field]: true } });
    }
  };

  // Per-row status-badge removal (saved-analysis content rows — AnalysisList):
  // badges only render for an ACTIVE status, so a click always removes it
  // rather than toggling; recordIds is the row's own entry.recordIds (in
  // practice always one id — see resolveRowStatus's own note).
  const handleRemoveRowFlag = async (recordIds, key) => {
    const field = STATUS_FLAG_FIELD[key];
    if (!field) return;
    const ids = Array.isArray(recordIds) ? recordIds : [recordIds];
    for (const id of ids) {
      const current = items.find(i => i.id === id);
      if (!current?.flags?.[field]) continue;
      // eslint-disable-next-line no-await-in-loop
      await updateItem(id, { flags: { ...current.flags, [field]: false } });
    }
  };

  const allCollectionsSelection = useMemo(() => selectWorkspaceVideoGroups({
    items: scopeItems,
    mainTopic: activeVirtTopic,
    subtopic: activeOrganizationalSubtopic,
    collectionId: 'all',
    semanticTags: filterSemanticTags,
    searchQuery: search,
    statusFilters,
    sortBy,
  }), [activeOrganizationalSubtopic, activeVirtTopic, filterSemanticTags, scopeItems, search, sortBy, statusFilters]);

  const visibleVideoSelection = useMemo(() => selectWorkspaceVideoGroups({
    items: scopeItems,
    mainTopic: activeVirtTopic,
    subtopic: activeOrganizationalSubtopic,
    collectionId: activeCollection || 'all',
    semanticTags: filterSemanticTags,
    searchQuery: search,
    statusFilters,
    sortBy,
  }), [activeCollection, activeOrganizationalSubtopic, activeVirtTopic, filterSemanticTags, scopeItems, search, sortBy, statusFilters]);

  const semanticCountSelection = useMemo(() => selectWorkspaceVideoGroups({
    items: scopeItems,
    mainTopic: activeVirtTopic,
    subtopic: activeOrganizationalSubtopic,
    collectionId: activeCollection || 'all',
    searchQuery: search,
    statusFilters,
  }), [activeCollection, activeOrganizationalSubtopic, activeVirtTopic, scopeItems, search, statusFilters]);

  const semanticFilterCounts = useMemo(
    () => selectWorkspaceSemanticFilterCounts(semanticCountSelection.items),
    [semanticCountSelection.items],
  );

  const collectionCounts = allCollectionsSelection.collectionCounts;
  const contentSectionNavigation = useMemo(
    () => selectWorkspaceContentSectionTabs(visibleVideoSelection.items, { collectionId: activeCollection }),
    [activeCollection, visibleVideoSelection.items],
  );
  const effectiveContentSectionId = resolveWorkspaceContentSectionSelection(
    activeContentSectionId,
    contentSectionNavigation,
  );
  const groupedPresentation = useMemo(
    () => selectWorkspaceContentSectionPresentation(visibleVideoSelection, effectiveContentSectionId),
    [effectiveContentSectionId, visibleVideoSelection],
  );
  const filteredItems = groupedPresentation.items;

  // Status-pill facet counts (root cause of the reported bug: the previous
  // version counted from `scopeItems` — scope-tile only — ignoring the
  // collection tile, section tab and search). Reuses the exact same
  // selectWorkspaceVideoGroups + selectWorkspaceContentSectionPresentation
  // pipeline as visibleVideoSelection/groupedPresentation above (same args),
  // with only favorite/important/mustWatch forced off — every non-status
  // filter (scope, collection, section, search, archived, marketStatus,
  // sourceTab, tags) stays applied. Facet semantics: each pill's count
  // ignores ALL THREE status filters (including its own), so activating one
  // status never changes what the others report — they always answer "how
  // many items in the current (non-status) view carry this status".
  const statusFiltersForCounts = useMemo(() => ({
    ...statusFilters,
    favorite: false,
    important: false,
    mustWatch: false,
  }), [statusFilters]);
  const countsBaseSelection = useMemo(() => selectWorkspaceVideoGroups({
    items: scopeItems,
    mainTopic: activeVirtTopic,
    subtopic: activeOrganizationalSubtopic,
    collectionId: activeCollection || 'all',
    semanticTags: filterSemanticTags,
    searchQuery: search,
    statusFilters: statusFiltersForCounts,
    sortBy,
  }), [activeCollection, activeOrganizationalSubtopic, activeVirtTopic, filterSemanticTags, scopeItems, search, sortBy, statusFiltersForCounts]);
  const countsBasePresentation = useMemo(
    () => selectWorkspaceContentSectionPresentation(countsBaseSelection, effectiveContentSectionId),
    [countsBaseSelection, effectiveContentSectionId],
  );
  const statusPillCounts = useMemo(() => ({
    favorite: countsBasePresentation.items.filter(item => !!item.flags?.isFavorite).length,
    important: countsBasePresentation.items.filter(item => !!item.flags?.isImportant).length,
    mustWatch: countsBasePresentation.items.filter(item => !!item.flags?.mustWatchAgain).length,
  }), [countsBasePresentation.items]);

  // If the scope/collection/section/search changed under an already-active
  // status filter and its facet count dropped to 0, clear it automatically
  // so the user is never stuck looking at an empty result with no way back.
  useEffect(() => {
    if (filterFavorite && statusPillCounts.favorite === 0) setFilterFavorite(false);
    if (filterImportant && statusPillCounts.important === 0) setFilterImportant(false);
    if (filterMustWatch && statusPillCounts.mustWatch === 0) setFilterMustWatch(false);
  }, [statusPillCounts, filterFavorite, filterImportant, filterMustWatch]);

  useEffect(() => { setActiveContentSectionId(''); }, [
    activeCollection,
    filterVirtTopicId,
    filterVirtSubtopic,
    filterSemanticTags,
    search,
    statusFilters,
    pageParams.video,
  ]);
  useEffect(() => {
    if (activeContentSectionId !== effectiveContentSectionId) setActiveContentSectionId(effectiveContentSectionId);
  }, [activeContentSectionId, effectiveContentSectionId]);

  // Active *filters* only — topic/subtopic navigation (tabs) is intentionally excluded,
  // this only covers the filter-bar controls (search/flags/status/source/tags).
  const hasActiveWorkspaceFilters = !!(
    search || filterFavorite || filterImportant || filterMustWatch ||
    (isStocksView && filterMarketStatus) || filterSourceTab || filterTags.length > 0 || filterSemanticTags.length > 0
  );

  function clearAllWorkspaceFilters() {
    setSearch('');
    setFilterFavorite(false);
    setFilterImportant(false);
    setFilterMustWatch(false);
    setFilterMarketStatus('');
    setFilterSourceTab('');
    setFilterTags([]);
    if (filterSemanticTags.length > 0) handleSemanticFilterClear();
  }

  const handleDeleteTopic = (id) => {
    const result = deleteTopic(id);
    if (!result?.ok) toast.error(`לא ניתן למחוק — ${result.count} פריטים שמורים תחת נושא זה`);
  };

  const handleVideoClick = (item) => {
    if (item.itemType === 'structured-snapshot' && item.structuredSnapshot) {
      setOpenSnapshotItem(item);
      return;
    }
    const fullVideo = videos.find(v => v.id === item.videoId || v.videoId === item.videoId);
    if (fullVideo) { setSelectedVideo(fullVideo); setPanelOpen(true); }
    else if (item.videoUrl) window.open(item.videoUrl, '_blank', 'noopener');
    else toast.info('לפריט הזה אין קישור תקין לסרטון מקור');
  };

  const handleDelete = async (item) => {
    const result = await deleteItem(item.id);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success('הפריט הוסר מ-Workspace Library');
  };

  const requestDeleteCard  = (item) => setConfirmDeleteItem(item);

  const handleConfirmDeleteCard = async () => {
    if (!confirmDeleteItem) return;
    const result = await deleteItem(confirmDeleteItem.id);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success('הפריט הוסר מ-Workspace Library');
    setSelectedCardIds(prev => { const next = new Set(prev); next.delete(confirmDeleteItem.id); return next; });
  };

  const handleStatusChange = async (id, newStatus) => {
    const result = await updateItem(id, { marketStatus: newStatus || null });
    reportWorkspaceWriteFailure(result);
  };

  const toggleCardSelect = (id) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearCardSelection = () => setSelectedCardIds(new Set());

  // Single shared useWorkspaceDays() instance for this whole page — passed
  // down as props to <WorkspaceDay /> instead of letting it call the hook
  // again internally. See WorkspaceDay.jsx's own comment: two independent
  // instances of this hook don't share live state (no event bus in the
  // Stage 1 store), so opening a day there would never be seen by this
  // page's "הוסף ליום העבודה" button, and attaching an item from here would
  // never show up in the day widget without a page reload.
  const {
    openDay,
    closedDays: workspaceDays,
    reload: reloadWorkspaceDays,
    createDay: createWorkspaceDay,
    attachItem,
    detachItem: detachWorkspaceDayItem,
    closeDay: closeWorkspaceDay,
    reopenDay: reopenWorkspaceDay,
    refreshMember: refreshWorkspaceDayMember,
    deleteDay: deleteWorkspaceDay,
  } = useWorkspaceDays();

  /**
   * Loops the current selection through the existing attachItemToWorkspaceDay
   * mutation (one call per item — the store's own dedup key already prevents
   * double-attaching the same item to the same day).
   */
  const handleAddSelectedToWorkspaceDay = () => {
    if (!openDay) return;
    const selected = items.filter(i => selectedCardIds.has(i.id));
    if (!selected.length) return;
    let attached = 0;
    let deduped = 0;
    let failed = 0;
    for (const item of selected) {
      const result = attachItem(openDay.id, { item });
      if (!result?.ok) { failed += 1; continue; }
      if (result.status === 'already_attached') deduped += 1; else attached += 1;
    }
    if (failed > 0) {
      toast.error(`${attached + deduped} מתוך ${selected.length} נוספו ליום העבודה; ${failed} נכשלו`);
    } else if (attached === 0) {
      toast.info(deduped > 0 ? 'כל הפריטים המסומנים כבר נמצאים ביום העבודה הפתוח' : 'לא נוספו פריטים');
    } else {
      toast.success(deduped > 0
        ? `${attached} פריטים נוספו ליום העבודה (${deduped} כבר היו בו)`
        : `${attached} פריטים נוספו ליום העבודה`);
    }
    clearCardSelection();
  };

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

  const handleArchiveCards = async (ids, archived = true) => {
    const result = await archiveItems(ids, archived);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success(archived ? `${ids.length > 1 ? `${ids.length} פריטים הועברו` : 'הפריט הועבר'} לארכיון` : 'הפריט שוחזר מהארכיון');
    setSelectedCardIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
  };

  const handleTargetedBriefRouting = async ({ sourceVideoId, expectedItemIds }) => {
    const result = await reassignVideoGroupTopic({ sourceVideoId, expectedItemIds });
    if (reportWorkspaceWriteFailure(result)) return result;
    toast.success(`השיוך למבזק בוקר/ערב הוחל ואומת עבור ${result.affectedCount} רשומות.`);
    return result;
  };

  const handleConfirmBulkDeleteCards = async () => {
    const ids = [...selectedCardIds];
    if (!ids.length) return;
    const result = await deleteItems(ids);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success(`${ids.length} פריטים נמחקו מ-Workspace`);
    clearCardSelection();
  };

  const handleConfirmDuplicateCleanup = async () => {
    const existingIds = confirmDuplicateCleanupIds.filter(id => items.some(item => item.id === id));
    if (!existingIds.length) return;
    const result = await deleteItems(existingIds);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success(`${existingIds.length} עותקים זהים הוסרו; כל הגרסאות השונות נשמרו`);
    setConfirmDuplicateCleanupIds([]);
    clearCardSelection();
  };

  // Mirrors the exact filter used to render the grid below, so the count/delete
  // target always matches what's actually on screen (never the hidden archived/active set).
  const deletableVisibleItems = filteredItems;
  const workspaceIdChecksum = useMemo(() => checksumWorkspaceItemIds(items), [items]);
  const workspacePayloadChecksum = useMemo(
    () => checksumWorkspacePayloadsExcludingTopicAssignment(items),
    [items],
  );
  const focusedVisibleGroup = useMemo(() => {
    if (!focusedVideoGroup) return null;
    const visible = selectVideoGroups(filteredItems).videoGroups.find(group => group.videoKey === focusedVideoGroup.videoKey);
    return visible || {
      ...focusedVideoGroup,
      items: [],
      versions: [],
      exactDuplicateGroups: [],
      uniqueContentCount: 0,
      latestSaveDate: focusedVideoGroup.latestSaveDate,
    };
  }, [filteredItems, focusedVideoGroup]);

  useEffect(() => {
    const firstId = revealedRecordIds[0];
    const revealToken = String(pageParams.revealToken || '');
    if (!firstId || !revealToken || scrolledRevealTokenRef.current === revealToken) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      const target = [...document.querySelectorAll('[data-workspace-record-highlight="true"]')]
        .find(element => String(element.getAttribute('data-workspace-record-ids') || '').split(/\s+/).includes(firstId));
      if (!target) return;
      scrolledRevealTokenRef.current = revealToken;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeCollection, focusedVisibleGroup, pageParams.revealToken, revealedRecordIds]);

  const toggleGroupSelection = (ids, selected) => {
    setSelectedCardIds(previous => {
      const next = new Set(previous);
      ids.forEach(id => selected ? next.add(id) : next.delete(id));
      return next;
    });
  };

  const handleSourceVideoClick = (group) => {
    const fullVideo = findVideoByIdOrUrl(videos, { targetId: group.videoId, targetUrl: group.videoUrl });
    if (fullVideo) { setSelectedVideo(fullVideo); setPanelOpen(true); return; }
    if (group.videoUrl) window.open(group.videoUrl, '_blank', 'noopener');
  };

  // Merged "open video" action for the focused card (2026-09-03,
  // TRADINGBRAIN-WORKSPACE-CARD-BUTTON-DEDUPE): the card used to render this
  // handler AND handleSourceVideoClick as two separate buttons that both
  // tried to "open the video" but disagreed on where a resolved video landed
  // (in-place VideoDetailPanel vs. the Dashboard route) and, more
  // importantly, on what happened when findVideoByIdOrUrl couldn't resolve a
  // match: handleSourceVideoClick opened YouTube externally, while this
  // handler used to navigate to Dashboard anyway with a fallback stub object
  // that lacks analysis fields — producing an empty "לא בוצע ניתוח" panel.
  // Per explicit user decision, the single surviving button keeps THIS
  // handler's target (Dashboard's fully analyzed screen) but adopts
  // handleSourceVideoClick's external-tab failure path instead of the stub;
  // the stub-fallback branch must never be reintroduced.
  //
  // Guard (restored 2026-09-04): only the `navigateTo` half of the original
  // early-return guard survives. If `navigateTo` isn't available, do nothing
  // at all — do NOT fall through to the external-tab fallback either, since
  // that fallback exists specifically to compensate for an unresolvable
  // VIDEO, not for a missing navigation capability. The `group.videoId`
  // half stays removed on purpose: a video resolvable only via URL (no
  // videoId) must still work, and a genuinely unresolvable one must still
  // fall through to the external YouTube tab.
  const handleReturnToAnalysis = (group) => {
    if (!navigateTo) return;
    const fullVideo = findVideoByIdOrUrl(videos, { targetId: group.videoId, targetUrl: group.videoUrl });
    if (fullVideo) {
      // Prefer the resolved record's own canonical id over group.videoId: the
      // group key can be sourced from any of a saved item's id/videoId/youtubeId
      // fields (see the triple-check above), while Dashboard's deep-link effect
      // and usePersistedVideo() key their own lookups off the real video's `id`
      // — passing a mismatched id string reopens the panel without its analysis.
      navigateTo('Dashboard', { openVideoId: fullVideo.id || group.videoId, openVideoMeta: fullVideo });
      return;
    }
    if (group.videoUrl) window.open(group.videoUrl, '_blank', 'noopener');
  };

  // `dropCollection` lets a caller switch scope without carrying the active
  // category along when that category would land empty in the new scope
  // (see scopeTiles below) — every other call site omits it and keeps the
  // original always-preserve-collection behavior.
  const handleFocusVideo = (group, { dropCollection = false } = {}) => {
    navigateTo?.('WorkspaceLibrary', {
      video: group.videoId || group.videoKey,
      ...(filterVirtTopicId ? { topicId: filterVirtTopicId } : {}),
      ...(filterVirtSubtopic ? { subtopicId: filterVirtSubtopic } : {}),
      ...(!dropCollection && activeCollection ? { collection: activeCollection } : {}),
      ...(filterSemanticTags.length > 0 ? { semantic: filterSemanticTags.join(',') } : {}),
    });
  };

  const handleClearVideoFocus = ({ dropCollection = false } = {}) => {
    navigateTo?.('WorkspaceLibrary', {
      ...(filterVirtTopicId ? { topicId: filterVirtTopicId } : {}),
      ...(filterVirtSubtopic ? { subtopicId: filterVirtSubtopic } : {}),
      ...(!dropCollection && activeCollection ? { collection: activeCollection } : {}),
      ...(filterSemanticTags.length > 0 ? { semantic: filterSemanticTags.join(',') } : {}),
    });
  };

  // The two scope tiles reuse the existing video-focus mechanism (the `video`
  // URL param via handleFocusVideo/handleClearVideoFocus) — no new state.
  // Exactly one is always selected and clicking the already-active tile is a
  // no-op (no deselect), unlike the category tiles below. Switching scope
  // keeps the active category selected by default; the one exception is when
  // the target scope has zero content in that category, in which case the
  // category resets to "all categories" for the new scope (dropCollection)
  // rather than showing an empty grid under a category tab that doesn't apply.
  const scopeTiles = useMemo(() => {
    const allVideosSelected = !focusedVideoGroup;
    const allVideosCategoryEmpty = !!activeCollection && (globalCollectionCounts[activeCollection]?.uniqueCount || 0) === 0;
    const tiles = [{
      id: 'all-videos',
      emoji: '🎬',
      label: 'כל הסרטונים',
      description: 'כל התוכן השמור מכל הסרטונים בספרייה',
      count: { uniqueCount: globalUniqueContentCount, recordCount: items.length, videoCount: allVideoGrouping.videoCount },
      selected: allVideosSelected,
      onSelect: () => { if (focusedVideoGroup) handleClearVideoFocus({ dropCollection: allVideosCategoryEmpty }); },
    }];
    if (mostRecentVideoGroup) {
      const recentSelected = focusedVideoGroup?.videoKey === mostRecentVideoGroup.videoKey;
      const recentCategoryEmpty = !!activeCollection && (mostRecentVideoGroup.collectionUniqueCounts?.[activeCollection] || 0) === 0;
      tiles.push({
        id: 'recent-video',
        emoji: '🕐',
        label: 'סרטון אחרון',
        description: 'התוכן שנשמר מהסרטון האחרון ששמרת ממנו',
        count: {
          uniqueCount: mostRecentVideoGroup.uniqueContentCount || 0,
          recordCount: mostRecentVideoGroup.items.length,
          videoCount: 1,
        },
        selected: recentSelected,
        onSelect: () => { if (!recentSelected) handleFocusVideo(mostRecentVideoGroup, { dropCollection: recentCategoryEmpty }); },
      });
    }
    return tiles;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleFocusVideo/handleClearVideoFocus are stable per-render closures over already-listed values
  }, [activeCollection, focusedVideoGroup, globalCollectionCounts, globalUniqueContentCount, items.length, allVideoGrouping.videoCount, mostRecentVideoGroup]);

  const handleCollectionSelect = (collection) => {
    navigateTo?.('WorkspaceLibrary', {
      ...(focusedVideoGroup ? { video: focusedVideoGroup.videoId || focusedVideoGroup.videoKey } : {}),
      ...(filterVirtTopicId ? { topicId: filterVirtTopicId } : {}),
      ...(filterVirtSubtopic ? { subtopicId: filterVirtSubtopic } : {}),
      ...(collection ? { collection } : {}),
      ...(filterSemanticTags.length > 0 ? { semantic: filterSemanticTags.join(',') } : {}),
    });
  };

  function handleMainTopicSelect(topicId) {
    navigateTo?.('WorkspaceLibrary', {
      ...(focusedVideoGroup ? { video: focusedVideoGroup.videoId || focusedVideoGroup.videoKey } : {}),
      ...(topicId ? { topicId } : {}),
      ...(activeCollection ? { collection: activeCollection } : {}),
    });
  }

  function handleSubtopicSelect(subtopicId) {
    const nextSubtopic = filterVirtSubtopic === subtopicId ? '' : subtopicId;
    navigateTo?.('WorkspaceLibrary', {
      ...(focusedVideoGroup ? { video: focusedVideoGroup.videoId || focusedVideoGroup.videoKey } : {}),
      ...(filterVirtTopicId ? { topicId: filterVirtTopicId } : {}),
      ...(nextSubtopic ? { subtopicId: nextSubtopic } : {}),
      ...(nextSubtopic && activeCollection ? { collection: activeCollection } : {}),
      ...(filterSemanticTags.length > 0 ? { semantic: filterSemanticTags.join(',') } : {}),
    });
  }

  function handleSemanticFilterToggle(filterId) {
    const next = filterSemanticTags.includes(filterId)
      ? filterSemanticTags.filter(value => value !== filterId)
      : [...filterSemanticTags, filterId];
    navigateTo?.('WorkspaceLibrary', {
      ...(focusedVideoGroup ? { video: focusedVideoGroup.videoId || focusedVideoGroup.videoKey } : {}),
      topicId: MARKET_VIRTUAL_TOPIC_ID,
      ...(filterVirtSubtopic ? { subtopicId: filterVirtSubtopic } : {}),
      ...(activeCollection ? { collection: activeCollection } : {}),
      ...(next.length > 0 ? { semantic: next.join(',') } : {}),
    });
  }

  function handleSemanticFilterClear() {
    navigateTo?.('WorkspaceLibrary', {
      ...(focusedVideoGroup ? { video: focusedVideoGroup.videoId || focusedVideoGroup.videoKey } : {}),
      ...(filterVirtTopicId ? { topicId: filterVirtTopicId } : {}),
      ...(filterVirtSubtopic ? { subtopicId: filterVirtSubtopic } : {}),
      ...(activeCollection ? { collection: activeCollection } : {}),
    });
  }

  const handleConfirmDeleteAllVisible = async () => {
    const ids = deletableVisibleItems.map(i => i.id);
    if (!ids.length) return;
    const result = await deleteItems(ids);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success(`נמחקו ${ids.length} פריטים מה-Workspace`);
    clearCardSelection();
    setMoreActionsOpen(false);
  };

  const handleConfirmDeleteAllWorkspace = async () => {
    const count = items.length;
    if (!count) return;
    const result = await deleteAllItems();
    if (reportWorkspaceWriteFailure(result)) return;
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
    () => filterVirtTopicId && filterVirtTopicId !== MARKET_VIRTUAL_TOPIC_ID ? getCustomSubtopics(tabPrefs, filterVirtTopicId) : [],
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
    activeOrganizationalSubtopics.length > 0 || customSubtopicsForActive.length > 0
  );

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <WorkspaceRecordRevealProvider recordIds={revealedRecordIds}>
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:bg-zinc-950" dir="rtl">

      {/* ══════════════════════ HEADER ══════════════════════ */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-slate-100 dark:border-zinc-800 shadow-sm">
        <div className="px-5 py-3 max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigateTo?.('Dashboard')}
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
            <button type="button" onClick={() => setBriefRoutingPreviewOpen(true)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">תצוגה מקדימה לניתוב מבזקים</button>
            <button type="button" onClick={() => setDuplicatePreviewOpen(true)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">איתור כפילויות</button>
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

        {/* ══════════════════════ WORKSPACE DAY (Stage 2) ══════════════════════ */}
        <WorkspaceDay
          openDay={openDay}
          closedDays={workspaceDays}
          reload={reloadWorkspaceDays}
          createDay={createWorkspaceDay}
          detachItem={detachWorkspaceDayItem}
          closeDay={closeWorkspaceDay}
          reopenDay={reopenWorkspaceDay}
          refreshMember={refreshWorkspaceDayMember}
          deleteDay={deleteWorkspaceDay}
        />

        {/* ══════════════════════ NAVIGATION CARD ══════════════════════ */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">

          {/* ── Row 1: Main topics (LARGE) ─────────────────────────── */}
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <WorkspaceTabRow
                  tabs={[
                    { value: '', label: 'כל הנושאים', count: allUniqueContentCount },
                    ...visibleMainTabs.map(vt => ({
                      value: vt.id,
                      label: `${vt.emoji} ${vt.displayName}`,
                      count: virtTopicCount[vt.id] || 0,
                      empty: !virtTopicCount[vt.id],
                    })),
                  ]}
                  activeValue={filterVirtTopicId}
                  onSelect={handleMainTopicSelect}
                  onAddTab={handleAddCustomTab}
                  size="lg"
                  accentColor="indigo"
                  addLabel="+ נושא"
                  withEmoji
                />
                <p className="mt-2 text-[11px] text-slate-400 dark:text-zinc-600">הספירה מציגה תכנים שמורים ייחודיים</p>
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
                  {
                    value: '',
                    label: 'הכל',
                    count: activeVirtTopicVideoCount,
                  },
                  ...activeOrganizationalSubtopics.map(vs => ({
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
                ]}
                activeValue={filterVirtSubtopic}
                onSelect={handleSubtopicSelect}
                onAddTab={filterVirtTopicId === MARKET_VIRTUAL_TOPIC_ID ? null : handleAddCustomSubtopic}
                size="md"
                accentColor="violet"
                addLabel="+ תת-נושא"
              />
            </div>
          )}

          {filterVirtTopicId === MARKET_VIRTUAL_TOPIC_ID && (
            <WorkspaceSemanticFilters
              counts={semanticFilterCounts}
              selected={filterSemanticTags}
              onToggle={handleSemanticFilterToggle}
              onClear={handleSemanticFilterClear}
            />
          )}

          {/* ── Optional workflow/status filter for stock contents ───── */}
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

          {/* ══════════════════════ FILTER CARD ══════════════════════ */}
          {!focusedVideoGroup && <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm px-4 py-3 space-y-3">
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
                  {showArchivedCards ? 'כל הפריטים' : 'ארכיון'}
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
          </div>}
        </div>

        <WorkspaceScopeTiles tiles={scopeTiles} />

        {!focusedVideoGroup && (
          <>
            <WorkspaceCollectionTiles counts={collectionCounts} activeCollection={activeCollection} scopeLabel="כל הסרטונים" onSelect={value => { handleCollectionSelect(value); clearCardSelection(); }} />
            <div className="mt-4">
              <WorkspaceContentSectionTabs
                navigation={contentSectionNavigation}
                activeValue={effectiveContentSectionId}
                onSelect={setActiveContentSectionId}
              />
            </div>
            <div className="mt-2">
              <WorkspaceStatusFilterPills active={statusPillActive} counts={statusPillCounts} onToggle={toggleStatusPillFilter} />
            </div>
          </>
        )}

        {/* ══════════════════════ MANAGE TOPICS PANEL ══════════════════════ */}
        {manageTopicsOpen && (
          <WorkspaceTopicManager
            topics={topics}
            items={items}
            addTopic={addTopic}
            updateTopic={updateTopic}
            deleteTopic={handleDeleteTopic}
            onClose={() => setManageTopicsOpen(false)}
          />
        )}

        {routeNoticeText && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {routeNoticeText}
          </div>
        )}

        {revealedRecordCount > 0 && (
          <div
            role="status"
            data-workspace-saved-count={revealedRecordCount}
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {revealedRecordCount === 1
              ? 'הפריט שנשמר מסומן ומוצג כעת'
              : `${revealedRecordCount} הפריטים שנשמרו מסומנים ומוצגים כעת`}
          </div>
        )}

        {focusedVideoGroup ? (
          <>
            <WorkspaceCollectionTiles
              counts={collectionCounts}
              activeCollection={activeCollection}
              scopeLabel={`התוכן שנשמר מהסרטון: ${focusedVideoGroup.videoTitle || 'ללא כותרת'}`}
              onSelect={value => { handleCollectionSelect(value); clearCardSelection(); }}
            />
            <div className="mt-4">
              <WorkspaceContentSectionTabs
                navigation={contentSectionNavigation}
                activeValue={effectiveContentSectionId}
                onSelect={setActiveContentSectionId}
              />
            </div>
            <div className="mt-2">
              <WorkspaceStatusFilterPills active={statusPillActive} counts={statusPillCounts} onToggle={toggleStatusPillFilter} />
            </div>
            <WorkspaceFocusedVideoCard
              group={focusedVideoGroup}
              visibleGroup={focusedVisibleGroup}
              activeCollection={activeCollection}
              selectedIds={selectedCardIds}
              onCollectionSelect={value => { handleCollectionSelect(value); clearCardSelection(); }}
              onClearFocus={handleClearVideoFocus}
              onOpenVideo={() => handleSourceVideoClick(focusedVideoGroup)}
              onReturnToAnalysis={() => handleReturnToAnalysis(focusedVideoGroup)}
              onToggleGroup={toggleGroupSelection}
              onRequestDuplicateCleanup={setConfirmDuplicateCleanupIds}
              collectionCounts={collectionCounts}
              contentSectionNavigation={contentSectionNavigation}
              activeContentSectionId={effectiveContentSectionId}
              onContentSectionSelect={setActiveContentSectionId}
              topics={topics}
              videoLookup={videoLookup}
              hideOwnCollectionNav
              onToggleRowFlag={handleRemoveRowFlag}
            />
            {/* Same bar/handlers as the all-videos view below — the row/section
                checkboxes inside WorkspaceFocusedVideoCard write to the same
                selectedCardIds set, so it needs to be reachable here too. */}
            <WorkspaceBulkActionBar
              count={selectedCardIds.size}
              onCopy={handleCopySelected}
              onArchive={() => handleArchiveCards([...selectedCardIds], true)}
              onDelete={() => setConfirmBulkDelete(true)}
              onClearSelection={clearCardSelection}
              onExportCsv={handleExportCsvSelected}
              onAddToWorkspaceDay={openDay ? handleAddSelectedToWorkspaceDay : undefined}
              onMarkFavorite={() => handleBulkSetItemFlag('favorite')}
              onMarkImportant={() => handleBulkSetItemFlag('important')}
              onMarkMustWatch={() => handleBulkSetItemFlag('mustWatch')}
              fixed
            />
          </>
        ) : <>
          {/* The pinned-recent-video detail card (WorkspaceFocusedVideoCard for
              pinnedRecentGroup) was intentionally removed from this all-videos
              (!focusedVideoGroup) branch: it duplicated the same expanded
              single-video detail (checkboxes, סיכומים, סיכום ב-30 שניות) that
              "סרטון אחרון" already shows via the focusedVideoGroup TRUE branch
              above, and this branch should render ONLY the video-cards list
              below it. pinnedRecentGroup/pinnedCollection/pinnedContentSectionId/
              pinnedRecentCollectionCounts/pinnedContentSectionNavigation/
              effectivePinnedContentSectionId/pinnedCollectionItems/
              pinnedVisibleGroup are intentionally left defined but unused here
              — see WORK-ID TRADINGBRAIN-WORKSPACE-TILES-PLACEMENT. */}
          <section data-workspace-scope="global">
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">כל הסרטונים</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">תוכן שנשמר מכל הסרטונים בספרייה</p>
          </section>
        </>}

        {/* ══════════════════════ CONTENT ══════════════════════ */}
        {!focusedVideoGroup && (filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center py-24 gap-4 text-slate-400 dark:text-zinc-600">
            <Star className="h-12 w-12 opacity-20" />
            <p role="status" className="text-sm font-medium text-center">
              {items.length === 0
                ? 'לא נשמרו עדיין פריטים ל-Workspace Library'
                : activeCollection
                  ? `לא נשמרו עדיין ${getWorkspaceHeadingByCollection(activeCollection)?.label || 'תכנים'} מהסרטונים בטווח שנבחר`
                : isStocksView && filterMarketStatus
                  ? 'אין עדיין מניות בטאב הזה'
                  : 'לא נמצאו תוצאות לפי הסינון הנוכחי'}
            </p>
            {activeCollection && items.length > 0 && (
              <button
                type="button"
                onClick={() => { handleCollectionSelect(null); clearCardSelection(); }}
                className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-800 dark:text-indigo-300"
              >
                חזרה לכל הסרטונים
              </button>
            )}
            {items.length === 0 && (
              <p className="text-xs text-center text-slate-400 dark:text-zinc-600">
                פתח סרטון ולחץ על ⭐ Workspace כדי לשמור
              </p>
            )}
          </div>
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
              onAddToWorkspaceDay={openDay ? handleAddSelectedToWorkspaceDay : undefined}
              onMarkFavorite={() => handleBulkSetItemFlag('favorite')}
              onMarkImportant={() => handleBulkSetItemFlag('important')}
              onMarkMustWatch={() => handleBulkSetItemFlag('mustWatch')}
              fixed
            />

            <section aria-labelledby="workspace-matching-videos-heading" data-workspace-record-count={items.length} data-workspace-id-checksum={workspaceIdChecksum} data-workspace-payload-checksum={workspacePayloadChecksum} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 id="workspace-matching-videos-heading" className="text-lg font-bold text-slate-900 dark:text-zinc-100">כל הסרטונים</h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">{groupedPresentation.videoCount} סרטונים תואמים</p>
                </div>
                <span className="text-sm text-slate-500 dark:text-zinc-400">{groupedPresentation.persistedCount} שמירות · {countUniqueWorkspaceContents(groupedPresentation.items)} תכנים ייחודיים</span>
              </div>
            </section>
            <div className="space-y-4">
              {groupedPresentation.videoGroups.map(group => activeCollection ? (
                <WorkspaceGlobalSavedAnalysisGroup
                  key={group.videoKey}
                  group={group}
                  activeCollection={activeCollection}
                  selectedIds={selectedCardIds}
                  onToggleGroup={toggleGroupSelection}
                  onFocusVideo={() => handleFocusVideo(group)}
                  videoLookup={videoLookup}
                  onToggleRowFlag={handleRemoveRowFlag}
                />
              ) : (
                <WorkspaceVideoGroupCard
                  key={group.videoKey}
                  group={group}
                  topics={topics}
                  selectedIds={selectedCardIds}
                  onToggleItem={toggleCardSelect}
                  onToggleGroup={toggleGroupSelection}
                  onOpenVideo={() => handleSourceVideoClick(group)}
                  onOpenItem={handleVideoClick}
                  onEditItem={setEditItem}
                  onArchiveItem={item => handleArchiveCards([item.id], !item.archivedAt)}
                  onDeleteItem={requestDeleteCard}
                  onToggleItemFlag={handleToggleItemFlag}
                  focusItemId={focusedItemId}
                  onFocusVideo={() => handleFocusVideo(group)}
                  isFocused={focusedVideoGroup?.videoKey === group.videoKey}
                  videoLookup={videoLookup}
                />
              ))}
            </div>
            {groupedPresentation.withoutVideo.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-bold">פריטים ללא סרטון ({groupedPresentation.withoutVideo.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {groupedPresentation.withoutVideo.map(item => (
                    <WorkspaceVideoCard key={item.id} item={item} topics={topics} onOpen={() => handleVideoClick(item)} onDelete={() => requestDeleteCard(item)} onEdit={() => setEditItem(item)} onArchive={() => handleArchiveCards([item.id], !item.archivedAt)} selected={selectedCardIds.has(item.id)} onToggleSelect={() => toggleCardSelect(item.id)} onToggleFlag={key => handleToggleItemFlag(item, key)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ))}
      </main>

      <StructuredSnapshotView
        open={!!openSnapshotItem}
        onOpenChange={open => !open && setOpenSnapshotItem(null)}
        snapshot={openSnapshotItem?.structuredSnapshot}
        itemTitle={openSnapshotItem?.videoTitle || openSnapshotItem?.title}
      />
      <WorkspaceDuplicatePreview open={duplicatePreviewOpen} onOpenChange={setDuplicatePreviewOpen} items={items} />
      <WorkspaceBriefRoutingPreview
        open={briefRoutingPreviewOpen}
        onOpenChange={setBriefRoutingPreviewOpen}
        items={items}
        topics={topics}
        onApply={handleTargetedBriefRouting}
      />

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
        open={confirmDuplicateCleanupIds.length > 0}
        onOpenChange={open => !open && setConfirmDuplicateCleanupIds([])}
        title="לנקות שמירות כפולות זהות?"
        description={`יימחקו רק ${confirmDuplicateCleanupIds.length} עותקים בעלי hash זהה בסרטון הנבחר. עותק אחד מכל תוכן וכל הגרסאות ההיסטוריות השונות יישמרו.`}
        confirmLabel="נקה כפילויות זהות"
        danger
        onConfirm={handleConfirmDuplicateCleanup}
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
    </WorkspaceRecordRevealProvider>
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

function WorkspaceVideoCard({ item, topics, onOpen, onDelete, onEdit, onArchive, showMarketStatus = false, onStatusChange, selected = false, onToggleSelect, onToggleFlag }) {
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
              {getWorkspaceHeadingLabel(item.sourceTabId || item.sourceTab, item.sourceTab)}
            </span>
          )}
        </div>

        {onToggleFlag && (
          <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-zinc-800">
            <WorkspaceItemFlagToggles flags={item.flags} onToggle={key => onToggleFlag(key)} />
          </div>
        )}

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
