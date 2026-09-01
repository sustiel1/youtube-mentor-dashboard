import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Star, Check, Maximize2, Minimize2, BookOpen, MoreVertical, Trash2, Archive, Edit2, Search } from "lucide-react";
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
import { getWorkspacePersistenceErrorMessage } from "@/lib/workspaceLibraryStore";
import { computeContentHash } from "@/lib/contentHash";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  VIRTUAL_TAXONOMY,
  getVirtTopicCounts,
  getVirtSubtopicCounts,
  filterByVirtTopic,
  filterByVirtSubtopic,
  groupItemsByVirtTopic,
  groupItemsByVirtSubtopic,
  getCanonicalSaveTargetForVirtualPath,
} from "@/utils/workspaceVirtualTaxonomy";
import {
  getWorkspaceTabPreferences,
  saveWorkspaceTabPreferences,
  resetWorkspaceTabPreferences,
  getVisibleMainTabs,
  getAllMergedTabs,
  addCustomMainTab,
  removeCustomMainTab,
} from "@/utils/workspaceTabPreferences";
import { parseStockFromText, looksLikeStockSection, normalizeStockWorkspaceItem } from "@/utils/workspaceStockItems";
import { WorkspaceBulkActionBar, formatWorkspaceItemsForCopy } from "@/components/workspace/WorkspaceBulkActionBar";
import { StockWatchlistView } from "./StockWatchlistView";
import { WorkspaceContentCard } from "./WorkspaceContentCard";
import { WorkspaceTabRow } from "./WorkspaceTabRow";
import { StructuredSnapshotView } from "./StructuredSnapshotView";
import {
  createWorkspaceProvenance,
  getWorkspaceHeadingLabel,
} from "@/config/workspaceHeadingRegistry";
import { getWorkspaceItemSemanticTags } from "@/utils/workspaceMarketDimensions";
import { buildWorkspaceNewsFields } from "@/lib/newsSelectionMetadata";

// ─── Market status workflow constants ─────────────────────────────────────────
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

// ─── Date bucketing (shared by the "לפי תאריכים" view and date sub-groups) ────
const DATE_BUCKETS = [
  { key: 'today',     label: 'היום' },
  { key: 'yesterday', label: 'אתמול' },
  { key: 'thisWeek',  label: 'השבוע' },
  { key: 'thisMonth', label: 'החודש' },
  { key: 'older',     label: 'ישן יותר' },
];

function groupItemsByDateBucket(items) {
  const now       = new Date();
  const today     = now.toDateString();
  const yesterday = new Date(now - 86400000).toDateString();
  const weekAgo   = new Date(now - 7  * 86400000);
  const monthAgo  = new Date(now - 30 * 86400000);
  const groups    = { today: [], yesterday: [], thisWeek: [], thisMonth: [], older: [] };
  items.forEach(item => {
    const d  = new Date(item.savedAt);
    const ds = d.toDateString();
    if      (ds === today)     groups.today.push(item);
    else if (ds === yesterday) groups.yesterday.push(item);
    else if (d >= weekAgo)     groups.thisWeek.push(item);
    else if (d >= monthAgo)    groups.thisMonth.push(item);
    else                       groups.older.push(item);
  });
  return groups;
}

// FolderGroup switches a group of items from a flat list to nested date
// sub-groups once it crosses this size — small groups stay exactly as before.
const DATE_SUBGROUP_THRESHOLD = 8;

// Splits one topic/subtopic group into the card descriptors the grid renders —
// one card per date bucket once the group crosses the threshold, otherwise a
// single card for the whole group. virtTopicId/virtSubtopicId are carried
// through unchanged so "שמור מאוחד" can resolve a canonical real topic later.
function buildGroupCards(keyPrefix, label, items, virtTopicId = null, virtSubtopicId = null, muted = false) {
  if (items.length > DATE_SUBGROUP_THRESHOLD) {
    const dateGroups = groupItemsByDateBucket(items);
    return DATE_BUCKETS
      .filter(({ key }) => dateGroups[key]?.length > 0)
      .map(({ key, label: bucketLabel }) => ({
        key: `${keyPrefix}__${key}`,
        label: `${label} · ${bucketLabel}`,
        items: dateGroups[key],
        virtTopicId,
        virtSubtopicId,
        muted,
      }));
  }
  return [{ key: keyPrefix, label, items, virtTopicId, virtSubtopicId, muted }];
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function WorkspaceSaveReviewOverlay({
  open,
  onOpenChange,
  draftItems = [],                // [{ id, text, sectionLabel, type }] — from selection bar
  currentAnalysisDraftItems = [], // [{ id, text, sectionLabel, type }] — from top Workspace button
  defaultView = 'draft',          // which tab opens first
  videoContext = {},              // { videoTitle, channelName, thumbnail, videoUrl, sourceTab }
  onSaved,
  onOpenLibrary,
}) {
  const { topics, mainTopics, getSubTopics, addTopic } = useWorkspaceTopics();
  const {
    items: libraryItems,
    reload,
    saveItem,
    saveItemsBulk,
    findByContentHash,
    deleteItem,
    updateItem,
    deleteItems,
    deleteAllItems,
    archiveItems,
    updateItemsBulk,
  } = useWorkspaceItems();

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
  const [moreActionsOpen,          setMoreActionsOpen]          = useState(false);
  const [confirmDeleteAllVisible,  setConfirmDeleteAllVisible]  = useState(false);
  const [confirmDeleteAllWorkspace, setConfirmDeleteAllWorkspace] = useState(false);

  // ── Virtual taxonomy navigation ──────────────────────────────────────────────
  const [filterVirtTopicId,  setFilterVirtTopicId]  = useState('');
  const [filterVirtSubtopic, setFilterVirtSubtopic] = useState('');

  // ── Tab preferences (UI-only, stored in workspace_tab_preferences_v1) ────────
  const [tabPrefs,        setTabPrefs]        = useState(() => getWorkspaceTabPreferences());
  const [showManageTabs,  setShowManageTabs]  = useState(false);
  const [editingTabId,    setEditingTabId]    = useState(null);
  const [editingTabLabel, setEditingTabLabel] = useState('');
  const [filterMarketStatus, setFilterMarketStatus] = useState('');

  // ── Compact filter bar (Phase 4) ─────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterSourceTab, setFilterSourceTab] = useState('');
  const [confirmDeleteSingleItem,   setConfirmDeleteSingleItem]   = useState(null);
  const [selectedOverlayIds,        setSelectedOverlayIds]        = useState(() => new Set());
  const [confirmBulkDeleteOverlay,  setConfirmBulkDeleteOverlay]  = useState(false);
  const [openSnapshotItem,          setOpenSnapshotItem]          = useState(null);

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
      setFilterMarketStatus('');
      setShowManageTabs(false);
      setEditingTabId(null);
      setEditingTabLabel('');
      setSelectedOverlayIds(new Set());
      lastAutoTopicRef.current = { topicId: '', subTopicId: '' };
    }
  }, [open, defaultView]);

  // ── Canonical save-target auto-default (draft form) ──────────────────────────
  // When the user navigates the top virtual tabs (e.g. שוק ההון > מניות), default
  // the draft's own "נושא ראשי / תת-נושא" selects to the matching real topic —
  // but only while the user hasn't manually picked something else themselves.
  const canonicalSaveTarget = useMemo(
    () => getCanonicalSaveTargetForVirtualPath(filterVirtTopicId, filterVirtSubtopic, topics),
    [filterVirtTopicId, filterVirtSubtopic, topics],
  );
  const lastAutoTopicRef = useRef({ topicId: '', subTopicId: '' });

  useEffect(() => {
    const last = lastAutoTopicRef.current;
    const isUntouchedSinceLastAutoFill =
      topicId === '' || (topicId === last.topicId && subTopicId === last.subTopicId);
    if (!isUntouchedSinceLastAutoFill) return; // user picked their own topic — never override it

    if (canonicalSaveTarget) {
      const nextSubTopicId = canonicalSaveTarget.subTopicId || '';
      if (topicId !== canonicalSaveTarget.topicId || subTopicId !== nextSubTopicId) {
        setTopicId(canonicalSaveTarget.topicId);
        setSubTopicId(nextSubTopicId);
      }
      lastAutoTopicRef.current = { topicId: canonicalSaveTarget.topicId, subTopicId: nextSubTopicId };
    } else if (last.topicId) {
      // Previously auto-filled but the new nav path has no safe target — clear it.
      setTopicId('');
      setSubTopicId('');
      lastAutoTopicRef.current = { topicId: '', subTopicId: '' };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalSaveTarget]);

  const subTopics         = useMemo(() => getSubTopics(topicId), [getSubTopics, topicId]);
  const selectedMainTopic = useMemo(() => mainTopics.find(t => t.id === topicId),   [mainTopics, topicId]);
  const selectedSubTopic  = useMemo(() => subTopics.find(t => t.id === subTopicId), [subTopics,  subTopicId]);

  const allTopics = useMemo(
    () => [...mainTopics, ...mainTopics.flatMap(t => getSubTopics(t.id))],
    [mainTopics, getSubTopics],
  );

  // ── Virtual taxonomy computed ────────────────────────────────────────────────

  const virtTopicCountBase = useMemo(
    () => getVirtTopicCounts(libraryItems),
    [libraryItems],
  );

  const customTabCounts = useMemo(() => {
    const counts = {};
    for (const ct of (tabPrefs.customMainTabs || [])) {
      if (!ct.realTopicId) continue;
      counts[ct.id] = libraryItems.filter(i => i.topicId === ct.realTopicId).length;
    }
    return counts;
  }, [libraryItems, tabPrefs.customMainTabs]);

  const virtTopicCount = useMemo(
    () => ({ ...virtTopicCountBase, ...customTabCounts }),
    [virtTopicCountBase, customTabCounts],
  );

  // Items that match no VIRTUAL_TAXONOMY entry (e.g. topicId: null,
  // topicName: '') — surfaced as their own "ללא סיווג" tab so they aren't
  // silently missing from every topic count.
  const unclassifiedItems = useMemo(
    () => groupItemsByVirtTopic(libraryItems).__none__ || [],
    [libraryItems],
  );

  // All tabs = built-in VIRTUAL_TAXONOMY + user-created custom tabs
  const allMainTabs = useMemo(
    () => getAllMergedTabs(VIRTUAL_TAXONOMY, tabPrefs),
    [tabPrefs],
  );

  const activeVirtTopic = useMemo(
    () => allMainTabs.find(v => v.id === filterVirtTopicId) || null,
    [allMainTabs, filterVirtTopicId],
  );

  // True only when navigated to שוק ההון → מניות — enables Row 3 workflow tabs
  const isStocksView = filterVirtTopicId === 'vt-markets' && filterVirtSubtopic === 'vts-stocks';

  // Reset workflow status filter whenever the navigation path changes
  useEffect(() => { setFilterMarketStatus(''); }, [filterVirtTopicId, filterVirtSubtopic]);

  // Selection is scoped to whatever topic/subtopic is currently shown — clear
  // it on every switch so a bulk action can never silently apply to items the
  // user selected under a different tab.
  useEffect(() => { setSelectedOverlayIds(new Set()); }, [filterVirtTopicId, filterVirtSubtopic]);

  // Default to the stock table ("topics" view) the moment the user enters
  // שוק ההון → מניות, so they land on the table instead of whichever view
  // (draft/recent/dates) happened to be active before. Only fires on the
  // false→true transition so a manual switch to "לפי תאריכים" afterwards sticks.
  const wasStocksViewRef = useRef(false);
  useEffect(() => {
    if (isStocksView && !wasStocksViewRef.current) setActiveView('topics');
    wasStocksViewRef.current = isStocksView;
  }, [isStocksView]);

  // Items within the selected main virtual topic (not yet subtopic-filtered)
  const mainFilteredItems = useMemo(() => {
    if (!filterVirtTopicId) return libraryItems;
    if (filterVirtTopicId === '__none__') return unclassifiedItems;
    // Custom tabs: filter by the single real topic ID they map to
    const customTab = (tabPrefs.customMainTabs || []).find(ct => ct.id === filterVirtTopicId);
    if (customTab) {
      return customTab.realTopicId
        ? libraryItems.filter(i => i.topicId === customTab.realTopicId)
        : [];
    }
    return filterByVirtTopic(libraryItems, filterVirtTopicId);
  }, [libraryItems, filterVirtTopicId, tabPrefs.customMainTabs, unclassifiedItems]);

  const virtSubtopicCount = useMemo(
    () => getVirtSubtopicCounts(mainFilteredItems, filterVirtTopicId),
    [mainFilteredItems, filterVirtTopicId],
  );

  // Final filtered list: main topic + optional subtopic
  const filteredLibraryItems = useMemo(
    () => filterByVirtSubtopic(mainFilteredItems, filterVirtTopicId, filterVirtSubtopic),
    [mainFilteredItems, filterVirtTopicId, filterVirtSubtopic],
  );

  // Applies the optional workflow status layer, then the compact filter bar
  // (search + source) on top of the topic/subtopic filter. Items without
  // marketStatus are untouched — they always appear when filterMarketStatus=''.
  // Feeds topics/dates/pinned views uniformly; "recent" intentionally stays
  // untouched (it's a fixed "what did I just save" list, not a browse view).
  const displayItems = useMemo(() => {
    let result = filteredLibraryItems;
    if (isStocksView && filterMarketStatus) {
      result = result.filter(i => (i.marketStatus || '') === filterMarketStatus);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        (i.videoTitle || '').toLowerCase().includes(q) ||
        (i.channelName || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q) ||
        (i.topicName || '').toLowerCase().includes(q) ||
        (i.sourceTab || '').toLowerCase().includes(q) ||
        (i.symbol || '').toLowerCase().includes(q) ||
        (i.companyName || '').toLowerCase().includes(q) ||
        (i.fullNotes || '').toLowerCase().includes(q)
      );
    }
    if (filterSourceTab) result = result.filter(i => (i.sourceTab || null) === filterSourceTab);
    return result;
  }, [filteredLibraryItems, isStocksView, filterMarketStatus, search, filterSourceTab]);

  const allSourceTabs = useMemo(() => {
    const set = new Set();
    libraryItems.forEach(i => { if (i.sourceTab) set.add(i.sourceTab); });
    return [...set].sort();
  }, [libraryItems]);

  const hasActiveOverlayFilters = !!(search || filterSourceTab || (isStocksView && filterMarketStatus));

  function clearAllOverlayFilters() {
    setSearch('');
    setFilterSourceTab('');
    setFilterMarketStatus('');
  }

  const hasSubtopicFilter = !!filterVirtSubtopic;
  const hasTopicFilter    = !!filterVirtTopicId;

  // ── List views ───────────────────────────────────────────────────────────────

  // recentItems always from unfiltered list (user needs to see what they just saved)
  const recentItems = useMemo(
    () => recentlySavedIds.length > 0 ? libraryItems.filter(i => recentlySavedIds.includes(i.id)) : [],
    [libraryItems, recentlySavedIds],
  );

  // Topics view grouping — use displayItems so workflow status filter propagates
  const itemsByVirtTopic = useMemo(
    () => groupItemsByVirtTopic(displayItems),
    [displayItems],
  );

  const itemsByVirtSubtopic = useMemo(
    () => filterVirtTopicId ? groupItemsByVirtSubtopic(displayItems, filterVirtTopicId) : {},
    [displayItems, filterVirtTopicId],
  );

  const itemsByDate = useMemo(() => groupItemsByDateBucket(displayItems), [displayItems]);

  const pinnedItems = useMemo(
    () => displayItems.filter(i => i.flags?.isFavorite || i.flags?.isImportant),
    [displayItems],
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
    // Selecting an actual topic (not "הכל") should show its items immediately,
    // without an extra click on the "לפי נושאים" display-mode toggle.
    if (vtId) setActiveView('topics');
  }

  async function handleConfirmDeleteAllVisible() {
    const ids = displayItems.map(i => i.id);
    if (!ids.length) return;
    const result = await deleteItems(ids);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success(`נמחקו ${ids.length} פריטים מה-Workspace`);
    setMoreActionsOpen(false);
  }

  async function handleConfirmDeleteAllWorkspace() {
    const count = libraryItems.length;
    if (!count) return;
    const result = await deleteAllItems();
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success(`נמחקו ${count} פריטים מה-Workspace`);
    setMoreActionsOpen(false);
  }

  function handleDeleteSingleItem(item) {
    setConfirmDeleteSingleItem(item);
  }

  async function handleConfirmDeleteSingleItem() {
    if (!confirmDeleteSingleItem) return;
    const result = await deleteItem(confirmDeleteSingleItem.id);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success('הפריט נמחק מ-Workspace');
    await reload();
    setConfirmDeleteSingleItem(null);
  }

  async function handleArchiveSingleItem(item) {
    const result = await archiveItems([item.id], true);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success('הפריט הועבר לארכיון');
    await reload();
  }

  // ── Stock table adapter (שוק ההון > מניות) ───────────────────────────────────
  // StockWatchlistView owns its own selection state, bulk bar, delete/bulk-delete
  // confirmations, and edit modal — mirrors exactly how WorkspaceLibrary.jsx wires it.
  const handleStatusChange = async (id, newStatus) => {
    const result = await updateItem(id, { marketStatus: newStatus || null });
    reportWorkspaceWriteFailure(result);
  };

  const handleDeleteStockItem = async (item) => {
    const result = await deleteItem(item.id);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success('הפריט הוסר מ-Workspace Library');
  };

  // ── Overlay bulk selection ───────────────────────────────────────────────────
  const toggleOverlaySelect = useCallback((id) => {
    setSelectedOverlayIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearOverlaySelection = useCallback(() => setSelectedOverlayIds(new Set()), []);

  // Adds every id in the given group to the existing selection (union, not
  // replace) — used by each FolderGroup's own "בחר הכל" so selections from
  // different topic/date sub-groups accumulate instead of overwriting.
  const handleSelectAllInGroup = useCallback((groupItems) => {
    setSelectedOverlayIds(prev => {
      const next = new Set(prev);
      groupItems.forEach(i => next.add(i.id));
      return next;
    });
  }, []);

  // Opens the read-only structured-snapshot viewer — separate from
  // toggleOverlaySelect so checkbox clicks and title clicks never conflict.
  const handleOpenSnapshot = useCallback((item) => {
    setOpenSnapshotItem(item);
  }, []);

  function handleCopyOverlaySelected() {
    const selected = libraryItems.filter(i => selectedOverlayIds.has(i.id));
    const text = formatWorkspaceItemsForCopy(selected);
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`הועתקו ${selected.length} פריטים ללוח`))
      .catch(() => toast.error('לא ניתן להעתיק'));
  }

  async function handleArchiveOverlaySelected() {
    const ids = [...selectedOverlayIds];
    const result = await archiveItems(ids, true);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success(`${ids.length} פריטים הועברו לארכיון`);
    clearOverlaySelection();
    await reload();
  }

  async function handleConfirmBulkDeleteOverlay() {
    const ids = [...selectedOverlayIds];
    const result = await deleteItems(ids);
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success(`${ids.length} פריטים נמחקו מ-Workspace`);
    clearOverlaySelection();
    await reload();
  }

  async function handleReassignSelected(targetTopicId) {
    const targetTopic = mainTopics.find(t => t.id === targetTopicId);
    if (!targetTopic) return;
    const ids = [...selectedOverlayIds];
    const result = await updateItemsBulk(ids, { topicId: targetTopic.id, topicName: targetTopic.name, subTopicId: null, subTopicName: null });
    if (reportWorkspaceWriteFailure(result)) return;
    toast.success(`${ids.length} פריטים שויכו ל"${targetTopic.name}"`);
    clearOverlaySelection();
    await reload();
  }

  // Concatenates the notes of every item in a grid card into ONE new saved
  // entry — additive only, never touches/deletes the source items. Reuses
  // saveItem (the same single-item create path used everywhere
  // else) and the existing content-hash dedup check, not new save logic.
  async function handleSaveMerged({ label, items, virtTopicId, virtSubtopicId }) {
    if (!items || items.length === 0) return;

    const mergedNotes = items.map(item => {
      const dateLabel = (() => {
        try { return format(new Date(item.savedAt), "d בMMM yyyy", { locale: he }); } catch { return ''; }
      })();
      const header = [item.videoTitle || 'ללא כותרת', dateLabel].filter(Boolean).join(' — ');
      return `── ${header} ──\n${item.notes || ''}`;
    }).join('\n\n');

    const contentHash = await computeContentHash(mergedNotes);
    if (contentHash && findByContentHash(contentHash)) {
      toast.info('פריט ממוזג זהה כבר קיים ב-Workspace');
      return;
    }

    // "ללא נושא" cards carry no virtTopicId — the merged entry stays
    // genuinely unclassified rather than guessing a topic for it.
    const target = virtTopicId ? getCanonicalSaveTargetForVirtualPath(virtTopicId, virtSubtopicId, topics) : null;

    const saveResult = await saveItem({
      id:           `ws-merged-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      videoId:      null,
      videoUrl:     null,
      videoTitle:   `${label} — ${items.length} פריטים ממוזגים`,
      channelName:  '',
      thumbnail:    null,
      topicId:      target?.topicId    || null,
      subTopicId:   target?.subTopicId || null,
      topicName:    target?.topicName    || '',
      subTopicName: target?.subTopicName || null,
      notes:        mergedNotes,
      flags:        {},
      tags:         [],
      sourceTab:    'Merged',
      category:     target?.topicName    || null,
      subCategory:  target?.subTopicName || null,
      savedAt:      new Date().toISOString(),
      contentHash,
    });
    if (reportWorkspaceWriteFailure(saveResult)) return;
    toast.success(`נוצר פריט ממוזג מ-${items.length} פריטים`);
    await reload();
  }

  // ── Tab preference handlers ────────────────────────────────────────────────
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
    if (filterVirtTopicId === tabId) setFilterVirtTopicId('');
  }

  const handleSaveAll = useCallback(async () => {
    if (effectiveDraftItems.length === 0 || isSaving) return;
    setIsSaving(true);
    const savedIds    = [];
    const pendingItems = [];
    let   skippedCount = 0;
    const now         = new Date().toISOString();
    const topicName    = selectedMainTopic?.name || '';
    const subTopicName = selectedSubTopic?.name  || '';
    // Tracks hashes saved earlier in this same batch, so saving the same
    // snippet twice in one click doesn't slip past the store-level check.
    const seenHashesThisRun = new Set();

    for (const item of effectiveDraftItems) {
      const id = `ws-snippet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const contentHash = await computeContentHash(item.text);

      if (contentHash && (
        seenHashesThisRun.has(contentHash) ||
        findByContentHash(contentHash)
      )) {
        skippedCount++;
        continue;
      }
      if (contentHash) seenHashesThisRun.add(contentHash);

      // ── Detect stock rows and preserve structured fields ──────────────────
      // Stock rows come from "מניות שהוזכרו" sections with type 'stocks-mentioned'.
      // We parse the flat text back into structured fields and set the item title
      // to "SYMBOL · Company" instead of repeating the generic session title.
      const isStockRow = item.type === 'stocks-mentioned' ||
        looksLikeStockSection(item.sectionLabel) ||
        looksLikeStockSection(item.type);

      let titlePart;
      let stockExtraFields = {};
      const newsExtraFields = buildWorkspaceNewsFields(item);

      if (isStockRow) {
        const parsed = parseStockFromText(item.text);
        if (parsed?.symbol) {
          // Use "AMAT · Applied Materials" as the visible item title
          titlePart = [parsed.symbol, parsed.companyName].filter(Boolean).join(' · ');
          stockExtraFields = {
            itemType:      'stock',
            symbol:        parsed.symbol,
            companyName:   parsed.companyName   || null,
            sentiment:     parsed.sentiment     || null,
            percentChange: parsed.percentChange || null,
            fullNotes:     item.text,              // complete original text — never truncated
            rawSourceText: item.text,              // verbatim row text
            sourceSection: item.sectionLabel || null,
            sourceTitle:   videoContext.videoTitle || null,
          };
        } else {
          // Couldn't parse ticker — still mark as stock and preserve raw text
          titlePart = item.text.slice(0, 60) || item.sectionLabel || 'מניה';
          stockExtraFields = {
            itemType:      'stock',
            fullNotes:     item.text,
            rawSourceText: item.text,
            sourceSection: item.sectionLabel || null,
            sourceTitle:   videoContext.videoTitle || null,
          };
        }
      } else if (newsExtraFields.newsTitle) {
        titlePart = newsExtraFields.newsTitle;
      } else {
        titlePart = item.sectionLabel
          ? `${item.sectionLabel} — ${(videoContext.videoTitle || '').slice(0, 40)}`
          : (videoContext.videoTitle || '').slice(0, 60) || 'קטע נבחר';
      }

      // For stock items: item.text already IS the complete note; user notes appended
      const combinedNotes = [item.text, notes].filter(Boolean).join('\n\n');
      const provenance = createWorkspaceProvenance({
        sourceVideoId: videoContext.sourceVideoId,
        sourceTabId: item.tabScope || videoContext.sourceTabId || videoContext.sourceTab,
        sourceSectionId: item.sourceSectionId || item.sectionKey || item.type || 'unsectioned',
        sourceHeading: item.sectionLabel,
        semanticTags: getWorkspaceItemSemanticTags({
          sourceSectionId: item.sourceSectionId || item.sectionKey || item.type || 'unsectioned',
          sourceTabId: item.tabScope || videoContext.sourceTabId || videoContext.sourceTab,
          originalItemType: item.type,
          itemType: item.type,
          tags,
        }),
      });

      pendingItems.push({
        id,
        videoId:      null,
        videoUrl:     videoContext.videoUrl    || null,
        videoTitle:   titlePart.slice(0, 80),
        sourceVideoTitle: videoContext.videoTitle || '',
        channelName:  videoContext.channelName || '',
        thumbnail:    videoContext.thumbnail   || null,
        topicId:      topicId    || null,
        subTopicId:   subTopicId || null,
        topicName,
        subTopicName,
        notes:        combinedNotes,
        flags,
        tags,
        sourceTab:    provenance?.sourceTabId || videoContext.sourceTab || 'Manual',
        category:     topicName    || null,
        subCategory:  subTopicName || null,
        savedAt:      now,
        contentHash,
        itemType:      item.type || 'snippet',
        originalItemType: item.type || 'snippet',
        identityPayload: { text: item.text },
        sourceTimestamp: item.timestamp ?? null,
        sourceVideoType: videoContext.sourceVideoType || null,
        sourceBriefSlug: videoContext.sourceBriefSlug || null,
        ...(provenance || {}),
        ...newsExtraFields,
        ...stockExtraFields, // additive: only present on stock items
      });
      savedIds.push(id);
    }

    let persistenceResult = {
      ok: true,
      status: 'already_exists',
      saved: 0,
      failed: 0,
      persistedItems: libraryItems,
    };
    if (pendingItems.length > 0) {
      const saveResult = await saveItemsBulk(pendingItems);
      if (reportWorkspaceWriteFailure(saveResult)) {
        setIsSaving(false);
        return;
      }
      persistenceResult = saveResult;
    }

    await reload();
    const persistedIds = new Set((persistenceResult.persistedItems || []).map(item => item?.id).filter(Boolean));
    const confirmedSavedIds = savedIds.filter(id => persistedIds.has(id));
    setRecentlySavedIds(confirmedSavedIds);
    setActiveView('recent');
    setIsSaving(false);
    if (persistenceResult.failed > 0) {
      toast.warning(`נשמרו ${confirmedSavedIds.length} פריטים; ${persistenceResult.failed} פריטים לא נשמרו`);
    } else if (skippedCount > 0 && confirmedSavedIds.length > 0) {
      toast.success(`⭐ ${confirmedSavedIds.length} פריטים נשמרו, ${skippedCount} כבר נשמרו קודם ולא נוספו שוב`);
    } else if (confirmedSavedIds.length === 0 && skippedCount > 0) {
      toast.info(`${skippedCount} פריטים כבר שמורים ולא נוספו שוב`);
    } else {
      toast.success(`⭐ ${confirmedSavedIds.length} פריטים נשמרו ל-Workspace Library`);
    }
    onSaved?.({
      count: confirmedSavedIds.length,
      skipped: skippedCount,
      failed: persistenceResult.failed || 0,
      recordIds: confirmedSavedIds,
      persistenceResult,
    });
  }, [effectiveDraftItems, topicId, subTopicId, flags, tags, notes, videoContext, selectedMainTopic, selectedSubTopic, findByContentHash, isSaving, libraryItems, saveItemsBulk, reload, onSaved]);

  // ── View tabs ─────────────────────────────────────────────────────────────────

  const VIEWS = [
    ...(effectiveDraftItems.length > 0 || currentAnalysisDraftItems.length > 0
      ? [{ key: 'draft', label: effectiveDraftItems.length > 0 ? `טיוטה (${effectiveDraftItems.length})` : 'טיוטה' }]
      : []),
    { key: 'recent', label: recentlySavedIds.length > 0 ? `נשמרו עכשיו (${recentlySavedIds.length})` : 'נשמרו עכשיו' },
  ];

  const showAnalysisBanner = currentAnalysisDraftItems.length > 0 && loadedDraftItems === null && activeView !== 'draft';

  // Shared "topic + subtopic chip" header used above the topics-view content —
  // hoisted so the stock branch can render it inside WorkspaceContentCard
  // without duplicating the JSX.
  const topicHeaderNode = activeVirtTopic ? (
    <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-zinc-800">
      <span className="text-base">{activeVirtTopic.emoji}</span>
      <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{activeVirtTopic.name}</span>
      <span className="text-xs text-slate-400 dark:text-zinc-600">({displayItems.length})</span>
      {hasSubtopicFilter && activeVirtTopic.subtopics.find(vs => vs.id === filterVirtSubtopic) && (
        <span className="rounded-full border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-400">
          › {activeVirtTopic.subtopics.find(vs => vs.id === filterVirtSubtopic)?.name}
        </span>
      )}
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        dir="rtl"
        className={cn(
          'flex flex-col p-0 gap-0 border-amber-200 dark:border-amber-900/40 transition-all duration-200',
          isFullscreen
            ? 'w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh]'
            : 'w-[min(96vw,900px)] h-[min(90vh,700px)]',
        )}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <DialogHeader className="shrink-0 border-b border-slate-200 dark:border-zinc-800 px-5 py-3">
          <div className="flex items-center justify-between gap-3 pl-10">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-right text-base font-bold text-slate-900 dark:text-zinc-100">
                ⭐ Workspace Library
                <span className="text-xs font-normal text-slate-400 dark:text-zinc-500">
                  — {libraryItems.length} פריטים שמורים
                </span>
              </DialogTitle>
              {unclassifiedItems.length > 0 && (
                <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                  מסווגים: {libraryItems.length - unclassifiedItems.length} · ללא סיווג: {unclassifiedItems.length}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onOpenLibrary && (
                <button
                  type="button"
                  onClick={onOpenLibrary}
                  className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
                >
                  פתח בספרייה
                </button>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoreActionsOpen(p => !p)}
                  title="פעולות נוספות"
                  className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1.5 text-slate-400 hover:text-slate-600 hover:border-slate-300 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {moreActionsOpen && (
                  <div
                    className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 z-50"
                    dir="rtl"
                    onMouseLeave={() => setMoreActionsOpen(false)}
                  >
                    <button
                      type="button"
                      disabled={displayItems.length === 0}
                      onClick={() => { setMoreActionsOpen(false); setConfirmDeleteAllVisible(true); }}
                      className="w-full text-right px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      מחק הכל בתצוגה הנוכחית ({displayItems.length})
                    </button>
                    <button
                      type="button"
                      disabled={libraryItems.length === 0}
                      onClick={() => { setMoreActionsOpen(false); setConfirmDeleteAllWorkspace(true); }}
                      className="w-full text-right px-3 py-2 text-xs text-red-700 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      מחק את כל ה-Workspace ({libraryItems.length})
                    </button>
                  </div>
                )}
              </div>
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
          </div>
        </DialogHeader>

        {/* ── Row 1: Main domain tabs ───────────────────────────────────── */}
        <div className="shrink-0 bg-white dark:bg-zinc-950 px-4 pt-3 pb-3 border-b border-slate-100 dark:border-zinc-800/60 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            <div className="min-w-0">
              <WorkspaceTabRow
                tabs={[
                  { value: '', label: `הכל${libraryItems.length > 0 ? ` (${libraryItems.length})` : ''}` },
                  ...visibleMainTabs.map(vt => ({
                    value: vt.id,
                    label: `${vt.emoji} ${vt.displayName}`,
                    count: virtTopicCount[vt.id] || 0,
                    empty: !virtTopicCount[vt.id],
                  })),
                  ...(unclassifiedItems.length > 0 || filterVirtTopicId === '__none__'
                    ? [{
                        value: '__none__',
                        label: '📁 ללא סיווג',
                        count: unclassifiedItems.length,
                        empty: unclassifiedItems.length === 0,
                      }]
                    : []),
                ]}
                activeValue={filterVirtTopicId}
                onSelect={handleSelectVirtTopic}
                onAddTab={handleAddCustomTab}
                size="lg"
                accentColor="indigo"
                addLabel="+ הוסף נושא"
                withEmoji
              />
            </div>
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

        {/* ── Row 2: Subtopic tabs ──────────────────────────────────────── */}
        {activeVirtTopic && activeVirtTopic.subtopics.length > 0 && (
          <div className="shrink-0 bg-slate-50/80 dark:bg-zinc-900/60 px-4 py-2.5 overflow-x-auto border-b border-slate-100 dark:border-zinc-800">
            <WorkspaceTabRow
              tabs={[
                ...activeVirtTopic.subtopics.map(vs => ({
                  value: vs.id,
                  label: vs.name,
                  count: virtSubtopicCount[vs.id] || 0,
                  empty: !virtSubtopicCount[vs.id],
                })),
                { value: '', label: `כולם${mainFilteredItems.length > 0 ? ` (${mainFilteredItems.length})` : ''}` },
              ]}
              activeValue={filterVirtSubtopic}
              onSelect={v => setFilterVirtSubtopic(prev => prev === v ? '' : v)}
              size="md"
              accentColor="violet"
              className="min-w-max"
            />
          </div>
        )}

        {/* ── Filter bar — one unified control area (status / view mode / search /
              source / clear), not stacked separately-bordered strips. ───────── */}
        <div dir="rtl" className="shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-2 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {isStocksView && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">סטטוס:</span>
                <select
                  value={filterMarketStatus}
                  onChange={e => setFilterMarketStatus(e.target.value)}
                  className="rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-teal-800 dark:text-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer"
                >
                  {MARKET_STATUS_TABS.map(tab => (
                    <option key={tab.value} value={tab.value}>{tab.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">תצוגה:</span>
              <select
                value={activeView}
                onChange={e => setActiveView(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
              >
                {VIEWS.map(v => (
                  <option key={v.key} value={v.key}>{v.label}</option>
                ))}
              </select>
            </div>

            {['topics', 'dates', 'pinned'].includes(activeView) && (
              <>
                <div className="relative min-w-[180px] flex-1 max-w-xs">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-600 pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="חפש לפי כותרת, סימול, נושא, הערות..."
                    dir="rtl"
                    className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pr-8 pl-2.5 py-1 text-xs text-right placeholder:text-slate-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:text-zinc-200"
                  />
                </div>

                {allSourceTabs.length > 0 && (
                  <select
                    value={filterSourceTab}
                    onChange={e => setFilterSourceTab(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:text-zinc-200 cursor-pointer"
                  >
                    <option value="">כל המקורות</option>
                    {allSourceTabs.map(tab => (
                      <option key={tab} value={tab}>{getWorkspaceHeadingLabel(tab, tab)}</option>
                    ))}
                  </select>
                )}
              </>
            )}

            <div className="mr-auto flex items-center gap-2 shrink-0">
              {hasActiveOverlayFilters && (
                <button
                  type="button"
                  onClick={clearAllOverlayFilters}
                  className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:border-red-300 hover:text-red-500 dark:hover:text-red-400 transition-colors whitespace-nowrap"
                >
                  ✕ נקה הכל
                </button>
              )}
              {(hasTopicFilter || hasSubtopicFilter) && (
                <button
                  type="button"
                  onClick={() => { setFilterVirtTopicId(''); setFilterVirtSubtopic(''); }}
                  className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:border-red-300 hover:text-red-500 dark:hover:text-red-400 transition-colors whitespace-nowrap"
                >
                  ✕ נקה סינון
                </button>
              )}
            </div>
          </div>

          {/* Active filter chips — only what's actually applied */}
          {hasActiveOverlayFilters && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {search && (
                <OverlayFilterChip label={`חיפוש: "${search}"`} onRemove={() => setSearch('')} />
              )}
              {isStocksView && filterMarketStatus && (
                <OverlayFilterChip
                  label={`סטטוס: ${MARKET_STATUS_TABS.find(t => t.value === filterMarketStatus)?.label || filterMarketStatus}`}
                  onRemove={() => setFilterMarketStatus('')}
                />
              )}
              {filterSourceTab && (
                <OverlayFilterChip label={`מקור: ${getWorkspaceHeadingLabel(filterSourceTab, filterSourceTab)}`} onRemove={() => setFilterSourceTab('')} />
              )}
              <button
                type="button"
                onClick={clearAllOverlayFilters}
                className="text-[11px] text-slate-400 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 underline"
              >
                נקה הכל
              </button>
            </div>
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

                  {/* Canonical save-target helper text — reflects the top nav path */}
                  {filterVirtTopicId && (
                    canonicalSaveTarget ? (
                      <p className="text-xs text-indigo-500 dark:text-indigo-400">
                        ברירת מחדל לפי הטאב הנוכחי: {VIRTUAL_TAXONOMY.find(v => v.id === filterVirtTopicId)?.name}
                        {filterVirtSubtopic && ` / ${VIRTUAL_TAXONOMY.find(v => v.id === filterVirtTopicId)?.subtopics.find(s => s.id === filterVirtSubtopic)?.name || ''}`}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-500 dark:text-amber-400">
                        לא נמצאה ברירת מחדל בטוחה לטאב הזה — בחר נושא ידנית
                      </p>
                    )
                  )}

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
                      <LibraryItemCard key={item.id} item={item} allTopics={allTopics} onDelete={handleDeleteSingleItem} onArchive={handleArchiveSingleItem} selected={selectedOverlayIds.has(item.id)} onToggleSelect={toggleOverlaySelect} onOpenSnapshot={handleOpenSnapshot} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* By topic view — folder-like grouping */}
          {activeView === 'topics' && (
            <div className={cn('p-5 space-y-5', isFullscreen && !isStocksView && 'max-w-3xl mx-auto')}>
              <AnalysisBanner show={showAnalysisBanner} count={currentAnalysisDraftItems.length} onLoad={handleLoadCurrentAnalysis} />
              {/* StockWatchlistView renders its own empty state — skip the generic one here to avoid a duplicate message */}
              {displayItems.length === 0 && !isStocksView && (
                <EmptyState label={filterMarketStatus ? 'אין עדיין מניות בטאב הזה' : 'אין פריטים בנושא הנוכחי'} />
              )}

              {hasTopicFilter && activeVirtTopic ? (
                // ── Subtopic groups within the selected main topic ──────────
                <>
                  {!isStocksView && topicHeaderNode}

                  {isStocksView ? (
                    // Reuse the same table used on the WorkspaceLibrary page for
                    // שוק ההון > מניות — same component, same behavior, no fork.
                    // Wrapped in the shared content-card shell so it gets the
                    // full overlay width instead of the narrow reading column.
                    <WorkspaceContentCard className="p-4 space-y-3">
                      {topicHeaderNode}
                      <StockWatchlistView
                        items={displayItems}
                        filterMarketStatus={filterMarketStatus}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDeleteStockItem}
                        onUpdateItem={updateItem}
                        onDeleteItems={deleteItems}
                        onArchiveItems={archiveItems}
                        onUpdateItemsBulk={updateItemsBulk}
                      />
                    </WorkspaceContentCard>
                  ) : hasSubtopicFilter ? (
                    // flat list when subtopic filter is active
                    <div className="space-y-2">
                      {displayItems.map(item => (
                        <LibraryItemCard key={item.id} item={item} allTopics={allTopics} compact onDelete={handleDeleteSingleItem} onArchive={handleArchiveSingleItem} selected={selectedOverlayIds.has(item.id)} onToggleSelect={toggleOverlaySelect} onOpenSnapshot={handleOpenSnapshot} />
                      ))}
                    </div>
                  ) : (
                    // subtopic groups — flattened into one card grid
                    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', isFullscreen && 'lg:grid-cols-3')}>
                      {[
                        ...activeVirtTopic.subtopics
                          .filter(vs => itemsByVirtSubtopic[vs.id]?.length > 0)
                          .flatMap(vs => buildGroupCards(vs.id, vs.name, itemsByVirtSubtopic[vs.id], filterVirtTopicId, vs.id)),
                        ...(itemsByVirtSubtopic['__other__']?.length > 0
                          ? buildGroupCards('__other__', `${activeVirtTopic.name} — כללי`, itemsByVirtSubtopic['__other__'], filterVirtTopicId, null, true)
                          : []),
                      ].map(({ key, ...card }) => (
                        <GroupCard
                          key={key}
                          {...card}
                          selectedIds={selectedOverlayIds}
                          onToggleSelect={toggleOverlaySelect}
                          onSelectAll={handleSelectAllInGroup}
                          onSaveMerged={handleSaveMerged}
                          onOpenSnapshot={handleOpenSnapshot}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // ── Main topic groups (no filter) — flattened into one card grid ──
                <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', isFullscreen && 'lg:grid-cols-3')}>
                  {[
                    ...VIRTUAL_TAXONOMY
                      .filter(vt => itemsByVirtTopic[vt.id]?.length > 0)
                      .flatMap(vt => buildGroupCards(vt.id, `${vt.emoji} ${vt.name}`, itemsByVirtTopic[vt.id], vt.id, null)),
                    ...(itemsByVirtTopic['__none__']?.length > 0
                      ? buildGroupCards('__none__', '📁 ללא נושא', itemsByVirtTopic['__none__'], null, null, true)
                      : []),
                  ].map(({ key, ...card }) => (
                    <GroupCard
                      key={key}
                      {...card}
                      selectedIds={selectedOverlayIds}
                      onToggleSelect={toggleOverlaySelect}
                      onSelectAll={handleSelectAllInGroup}
                      onSaveMerged={handleSaveMerged}
                      onOpenSnapshot={handleOpenSnapshot}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* By date view */}
          {activeView === 'dates' && (
            <div className={cn('p-5 space-y-5', isFullscreen && 'max-w-3xl mx-auto')}>
              <AnalysisBanner show={showAnalysisBanner} count={currentAnalysisDraftItems.length} onLoad={handleLoadCurrentAnalysis} />
              {displayItems.length === 0 && <EmptyState label={filterMarketStatus ? 'אין עדיין מניות בטאב הזה' : 'אין פריטים בנושא הנוכחי'} />}
              {DATE_BUCKETS
                .filter(({ key }) => itemsByDate[key]?.length > 0)
                .map(({ key, label }) => (
                  <div key={key}>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2.5">
                      {label}
                      <span className="text-slate-400 dark:text-zinc-600 font-normal text-xs mr-1">({itemsByDate[key].length})</span>
                    </h3>
                    <div className="space-y-2 pr-2 border-r-2 border-slate-100 dark:border-zinc-800">
                      {itemsByDate[key].map(item => (
                        <LibraryItemCard key={item.id} item={item} allTopics={allTopics} compact showDate onDelete={handleDeleteSingleItem} onArchive={handleArchiveSingleItem} selected={selectedOverlayIds.has(item.id)} onToggleSelect={toggleOverlaySelect} onOpenSnapshot={handleOpenSnapshot} />
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
                      <LibraryItemCard key={item.id} item={item} allTopics={allTopics} onDelete={handleDeleteSingleItem} onArchive={handleArchiveSingleItem} selected={selectedOverlayIds.has(item.id)} onToggleSelect={toggleOverlaySelect} onOpenSnapshot={handleOpenSnapshot} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* Bulk selection bar — sits at bottom of the flex-col DialogContent */}
        <WorkspaceBulkActionBar
          count={selectedOverlayIds.size}
          onCopy={handleCopyOverlaySelected}
          onArchive={handleArchiveOverlaySelected}
          onDelete={() => setConfirmBulkDeleteOverlay(true)}
          onClearSelection={clearOverlaySelection}
          reassignTopics={mainTopics}
          onReassign={handleReassignSelected}
        />
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={!!confirmDeleteSingleItem}
      onOpenChange={open => !open && setConfirmDeleteSingleItem(null)}
      title="למחוק את הפריט הזה מה-Workspace?"
      description="הפריט יימחק מ-Workspace בלבד. Brain / KnowledgeItems לא יושפעו."
      confirmLabel="מחק"
      danger
      onConfirm={handleConfirmDeleteSingleItem}
    />

    <ConfirmDialog
      open={confirmDeleteAllVisible}
      onOpenChange={setConfirmDeleteAllVisible}
      title="מחיקת כל הפריטים בתצוגה"
      description={`אתה עומד למחוק ${displayItems.length} פריטים שמוצגים כרגע מה-Workspace בלבד. פריטים שלא מופיעים בסינון הנוכחי לא יימחקו. להמשיך?`}
      confirmLabel={`מחק ${displayItems.length} פריטים`}
      danger
      onConfirm={handleConfirmDeleteAllVisible}
    />

    <ConfirmDialog
      open={confirmDeleteAllWorkspace}
      onOpenChange={setConfirmDeleteAllWorkspace}
      title="⚠️ מחיקת כל ה-Workspace"
      description={`פעולה זו תמחק את כל ${libraryItems.length} פריטי ה-Workspace בלבד. היא לא תמחק Brain, KnowledgeItems או סרטונים מקוריים. כדי להמשיך הקלד: מחק הכל`}
      confirmLabel="מחק את כל ה-Workspace"
      danger
      requireTypedWord="מחק הכל"
      onConfirm={handleConfirmDeleteAllWorkspace}
    />

    <ConfirmDialog
      open={confirmBulkDeleteOverlay}
      onOpenChange={setConfirmBulkDeleteOverlay}
      title={`למחוק ${selectedOverlayIds.size} פריטים מסומנים מה-Workspace?`}
      description="הפעולה לא משפיעה על Brain / KnowledgeItems — היא מוחקת רק מה-Workspace."
      confirmLabel="מחק מסומנים"
      danger
      onConfirm={handleConfirmBulkDeleteOverlay}
    />

    <StructuredSnapshotView
      open={!!openSnapshotItem}
      onOpenChange={open => !open && setOpenSnapshotItem(null)}
      snapshot={openSnapshotItem?.structuredSnapshot}
      itemTitle={openSnapshotItem?.videoTitle}
    />
    </>
  );
}

// ─── Folder group ─────────────────────────────────────────────────────────────

// One topic (or topic+date-bucket) card in the "לפי נושאים" grid. Deliberately
// no per-item delete/archive here — those stay available via checkbox +
// the WorkspaceBulkActionBar below, exactly as before. Preview truncates at
// 5 items; "שמור מאוחד" merges the card's own items (not just the preview).
const GROUP_CARD_PREVIEW_LIMIT = 5;

function GroupCard({ label, items, muted = false, virtTopicId = null, virtSubtopicId = null, selectedIds, onToggleSelect, onSelectAll, onSaveMerged, onOpenSnapshot }) {
  const previewItems = items.slice(0, GROUP_CARD_PREVIEW_LIMIT);
  const remaining = items.length - previewItems.length;
  // Guards against a double-click firing two overlapping saves before the
  // first one's content-hash dedup check has anything to find yet.
  const [saving, setSaving] = useState(false);
  async function handleSaveMergedClick() {
    setSaving(true);
    try { await onSaveMerged({ label, items, virtTopicId, virtSubtopicId }); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('min-w-0 truncate text-sm font-bold', muted ? 'text-slate-400 dark:text-zinc-600' : 'text-slate-700 dark:text-zinc-300')}>
          {label}
          <span className={cn('mr-1 text-xs font-normal', muted ? 'text-slate-300 dark:text-zinc-700' : 'text-slate-400 dark:text-zinc-600')}>
            ({items.length})
          </span>
        </span>
        <button
          type="button"
          onClick={() => onSelectAll(items)}
          className="shrink-0 text-[11px] font-medium text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          בחר הכל
        </button>
      </div>

      <div className="space-y-1">
        {previewItems.map(item => {
          const isSnapshot = item.itemType === 'structured-snapshot' && !!onOpenSnapshot;
          return (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`בחר ${item.videoTitle || 'פריט'}`}
                checked={selectedIds?.has(item.id)}
                onChange={() => onToggleSelect(item.id)}
                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 dark:border-zinc-600 text-indigo-600 cursor-pointer"
              />
              {isSnapshot ? (
                <button
                  type="button"
                  onClick={() => onOpenSnapshot(item)}
                  title="פתח תמונת מצב"
                  className="min-w-0 flex-1 truncate text-right text-xs text-indigo-700 dark:text-indigo-400 hover:underline"
                >
                  {item.videoTitle || 'ללא כותרת'}
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-zinc-300">
                  {item.videoTitle || 'ללא כותרת'}
                </span>
              )}
            </div>
          );
        })}
        {remaining > 0 && (
          <div className="pr-[22px] text-[11px] text-slate-400 dark:text-zinc-600">+{remaining} עוד</div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSaveMergedClick}
        disabled={saving}
        className="mt-auto self-start rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50"
      >
        📎 {saving ? 'שומר...' : 'שמור מאוחד'}
      </button>
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

function LibraryItemCard({ item, allTopics, compact = false, showDate = false, onDelete, onArchive, selected = false, onToggleSelect, onOpenSnapshot }) {
  const isSnapshot = item.itemType === 'structured-snapshot' && !!onOpenSnapshot;
  const mainTopic = allTopics.find(t => t.id === item.topicId && !t.parentId);
  const subTopic  = allTopics.find(t => t.id === item.subTopicId);
  const itemTags  = item.tags || [];
  const savedDate = (() => {
    try { return format(new Date(item.savedAt), "d בMMM", { locale: he }); } catch { return ''; }
  })();

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 px-3 py-2 flex items-center gap-2 justify-between">
        {onToggleSelect && (
          <input
            type="checkbox"
            aria-label={`בחר ${item.videoTitle || 'פריט'}`}
            checked={selected}
            onChange={e => { e.stopPropagation(); onToggleSelect(item.id); }}
            onClick={e => e.stopPropagation()}
            className="shrink-0 h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-600 text-indigo-600 cursor-pointer"
          />
        )}
        {isSnapshot ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onOpenSnapshot(item); }}
            title="פתח תמונת מצב"
            className="flex-1 min-w-0 text-right text-sm font-medium text-indigo-700 dark:text-indigo-400 hover:underline truncate leading-snug"
          >
            {item.videoTitle || 'ללא כותרת'}
          </button>
        ) : (
          <p className="flex-1 min-w-0 text-sm font-medium text-slate-800 dark:text-zinc-200 truncate leading-snug">
            {item.videoTitle || 'ללא כותרת'}
          </p>
        )}
        <div className="flex items-center gap-1.5 shrink-0 text-sm">
          {item.marketStatus && MARKET_STATUS_LABELS[item.marketStatus] && (
            <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold leading-none', MARKET_STATUS_COLORS[item.marketStatus])}>
              {MARKET_STATUS_LABELS[item.marketStatus]}
            </span>
          )}
          {item.flags?.isImportant    && <span title="חשוב">🔴</span>}
          {item.flags?.isFavorite     && <span title="מועדף">⭐</span>}
          {item.flags?.mustWatchAgain && <span title="לצפות שוב">🔁</span>}
          {showDate && savedDate && (
            <span className="text-xs text-slate-400 dark:text-zinc-600 mr-1">{savedDate}</span>
          )}
          {onArchive && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onArchive(item); }}
              className="p-1 rounded text-slate-300 hover:text-amber-500 hover:bg-amber-50 dark:text-zinc-700 dark:hover:text-amber-400 dark:hover:bg-amber-950/20 transition-colors"
              title="ארכיון"
            >
              <Archive className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDelete(item); }}
              className="p-1 rounded text-red-300 hover:text-red-500 hover:bg-red-50 dark:text-red-700 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-colors"
              title="מחק"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 space-y-1.5">
      <div className="flex items-start gap-2 justify-between">
        {onToggleSelect && (
          <input
            type="checkbox"
            aria-label={`בחר ${item.videoTitle || 'פריט'}`}
            checked={selected}
            onChange={e => { e.stopPropagation(); onToggleSelect(item.id); }}
            onClick={e => e.stopPropagation()}
            className="mt-1 shrink-0 h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-600 text-indigo-600 cursor-pointer"
          />
        )}
        {isSnapshot ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onOpenSnapshot(item); }}
            title="פתח תמונת מצב"
            className="flex-1 min-w-0 text-right text-base font-bold text-indigo-700 dark:text-indigo-400 hover:underline leading-snug"
          >
            {item.videoTitle || 'ללא כותרת'}
          </button>
        ) : (
          <p className="flex-1 min-w-0 text-base font-bold text-slate-900 dark:text-zinc-100 leading-snug">
            {item.videoTitle || 'ללא כותרת'}
          </p>
        )}
        <div className="flex items-center gap-1 shrink-0 text-base pt-0.5">
          {item.flags?.isImportant    && <span title="חשוב">🔴</span>}
          {item.flags?.isFavorite     && <span title="מועדף">⭐</span>}
          {item.flags?.mustWatchAgain && <span title="לצפות שוב">🔁</span>}
        </div>
      </div>
      {item.marketStatus && MARKET_STATUS_LABELS[item.marketStatus] && (
        <span className={cn('self-start rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none', MARKET_STATUS_COLORS[item.marketStatus])}>
          {MARKET_STATUS_LABELS[item.marketStatus]}
        </span>
      )}
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
              {getWorkspaceHeadingLabel(item.sourceTabId || item.sourceTab, item.sourceTab)}
            </span>
          )}
          {savedDate && (
            <span className="mr-auto text-xs text-slate-400 dark:text-zinc-600">{savedDate}</span>
          )}
        </div>
      )}
      {(onArchive || onDelete) && (
        <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100 dark:border-zinc-800">
          {onArchive && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onArchive(item); }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:text-zinc-600 dark:hover:text-amber-400 dark:hover:bg-amber-950/20 transition-colors"
              title="ארכיון"
            >
              <Archive className="h-3 w-3" />
              <span>ארכיון</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDelete(item); }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:text-red-600 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-colors"
              title="מחק"
            >
              <Trash2 className="h-3 w-3" />
              <span>מחק</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Overlay filter chip ──────────────────────────────────────────────────────
// One removable active-filter chip in the compact filter bar — click ✕ to
// clear just that one filter, independent of the others.

function OverlayFilterChip({ label, onRemove }) {
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

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ label, icon }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-slate-400 dark:text-zinc-600">
      {icon || <Star className="h-10 w-10 opacity-25" />}
      <p className="text-sm">{label}</p>
    </div>
  );
}
