import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Star, Check, Maximize2, Minimize2, BookOpen, Trash2, Archive, Edit2, Search } from "lucide-react";
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
import { saveWorkspaceItem, findWorkspaceItemByContentHash } from "@/lib/workspaceLibraryStore";
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
  getRealChildCounts,
  filterByRealSubSubtopic,
} from "@/utils/workspaceVirtualTaxonomy";
import {
  getWorkspaceTabPreferences,
  saveWorkspaceTabPreferences,
  resetWorkspaceTabPreferences,
  getVisibleMainTabs,
  getAllMergedTabs,
  addCustomMainTab,
  removeCustomMainTab,
  getPromotedTopicIds,
  addPromotedTopicId,
} from "@/utils/workspaceTabPreferences";
import { parseStockFromText, looksLikeStockSection, normalizeStockWorkspaceItem } from "@/utils/workspaceStockItems";
import { WorkspaceBulkActionBar, formatWorkspaceItemsForCopy } from "@/components/workspace/WorkspaceBulkActionBar";
import { StockWatchlistView } from "./StockWatchlistView";
import { WorkspaceContentCard } from "./WorkspaceContentCard";
import { WorkspaceTabRow } from "./WorkspaceTabRow";
import { DangerZoneMenu } from "./DangerZoneMenu";

// Virtual subtopic tabs hidden entirely from Row 2 (top filter row) — display
// only, underlying real topics/items are untouched and still reachable via
// "כולם" or the save-target dropdown. Unlike other locked (non-renameable)
// subtopics such as "מניות" (which gates the Stock view and must stay
// visible as a tab), "n8n / Automation" has no functional role beyond
// filtering, so it's hidden to avoid an inconsistent-feeling tab that can't
// be renamed/deleted like its siblings. Reverting = removing an id here.
const HIDDEN_VIRTUAL_SUBTOPIC_IDS = new Set(['vts-ai-n8n']);

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
  const { topics, mainTopics, getSubTopics, addTopic, updateTopic, deleteTopic } = useWorkspaceTopics();
  const { items: libraryItems, reload, deleteItem, updateItem, deleteItems, deleteAllItems, archiveItems, updateItemsBulk } = useWorkspaceItems();

  // ── Draft / save controls ────────────────────────────────────────────────────
  const [topicId,       setTopicId]       = useState('');
  const [subTopicId,    setSubTopicId]    = useState('');
  const [subSubTopicId, setSubSubTopicId] = useState('');
  const [tags,         setTags]         = useState([]);
  const [tagInput,     setTagInput]     = useState('');
  const [flags,        setFlags]        = useState({ isFavorite: false, isImportant: false, mustWatchAgain: false });
  const [notes,        setNotes]        = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newSubTopicName, setNewSubTopicName] = useState('');
  const [showNewSubTopic, setShowNewSubTopic] = useState(false);
  const [newSubSubTopicName, setNewSubSubTopicName] = useState('');
  const [showNewSubSubTopic, setShowNewSubSubTopic] = useState(false);

  // ── Row-2 (subtopic) edit-tabs panel ─────────────────────────────────────────
  const [showManageSubtopics, setShowManageSubtopics] = useState(false);
  const [editingSubtopicId,    setEditingSubtopicId]    = useState(null);
  const [editingSubtopicLabel, setEditingSubtopicLabel] = useState('');
  const [confirmDeleteSubtopic, setConfirmDeleteSubtopic] = useState(null); // { id, name, affectedCount } | null

  // ── Row-3 (sub-subtopic) edit-tabs panel ─────────────────────────────────────
  const [showManageSubSubtopics, setShowManageSubSubtopics] = useState(false);
  const [editingSubSubtopicId,    setEditingSubSubtopicId]    = useState(null);
  const [editingSubSubtopicLabel, setEditingSubSubtopicLabel] = useState('');
  const [confirmDeleteSubSubtopic, setConfirmDeleteSubSubtopic] = useState(null); // { id, name, affectedCount } | null

  // ── Promote subtopic/sub-subtopic → independent main topic ───────────────────
  const [confirmPromote, setConfirmPromote] = useState(null); // { id, name, affectedCount } | null

  // ── 3rd-level (sub-subtopic) navigation accordion — collapsed by default ────
  const [subSubAccordionOpen, setSubSubAccordionOpen] = useState(false);
  const [filterVirtSubSubtopic, setFilterVirtSubSubtopic] = useState('');

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
  const [filterMarketStatus, setFilterMarketStatus] = useState('');

  // ── Compact filter bar (Phase 4) ─────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterSourceTab, setFilterSourceTab] = useState('');

  // ── Global search (searches the whole library — libraryItems — regardless of
  // the active topic/subtopic/sub-subtopic tab; independent of `search` above,
  // which stays scoped to the current tab's filtered items). Debounced so large
  // libraries don't re-filter on every keystroke.
  const [globalSearch, setGlobalSearch] = useState('');
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedGlobalSearch(globalSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [globalSearch]);
  const [confirmDeleteSingleItem,   setConfirmDeleteSingleItem]   = useState(null);
  const [selectedOverlayIds,        setSelectedOverlayIds]        = useState(() => new Set());
  const [confirmBulkDeleteOverlay,  setConfirmBulkDeleteOverlay]  = useState(false);

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
  const canonicalSaveTarget = useMemo(() => {
    const raw = getCanonicalSaveTargetForVirtualPath(filterVirtTopicId, filterVirtSubtopic, topics);
    if (!raw || !filterVirtSubtopic) return raw;
    // getCanonicalSaveTargetForVirtualPath's rule #2 "promotes" a curated
    // subtopic to a standalone topicId when its real topic has no parentId in
    // storage (e.g. "סקטורים" → wt-sectors, parentId: null) — by design, for
    // resolving a save target. But for pre-filling the draft form's own
    // "נושא ראשי / תת-נושא" selects, that promotion is wrong: it overwrites
    // נושא ראשי with the subtopic's name instead of the active top tab's name.
    // Detect the promotion (subtopic click resolved to a DIFFERENT topicId
    // than the main tab alone would, with no subTopicId) and re-nest it under
    // the actual active main topic instead.
    const mainOnly = getCanonicalSaveTargetForVirtualPath(filterVirtTopicId, null, topics);
    if (mainOnly && !raw.subTopicId && raw.topicId !== mainOnly.topicId) {
      const promoted = topics.find(t => t.id === raw.topicId);
      return {
        topicId: mainOnly.topicId,
        subTopicId: raw.topicId,
        topicName: mainOnly.topicName,
        subTopicName: promoted?.name || raw.topicName,
      };
    }
    return raw;
  }, [filterVirtTopicId, filterVirtSubtopic, topics]);
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
        setSubSubTopicId('');
      }
      lastAutoTopicRef.current = { topicId: canonicalSaveTarget.topicId, subTopicId: nextSubTopicId };
    } else if (last.topicId) {
      // Previously auto-filled but the new nav path has no safe target — clear it.
      setTopicId('');
      setSubTopicId('');
      setSubSubTopicId('');
      lastAutoTopicRef.current = { topicId: '', subTopicId: '' };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalSaveTarget]);

  // Real children of topicId, PLUS any curated subtopic that resolves to its
  // own standalone real topic (see the canonicalSaveTarget promotion-fix above)
  // — without this, a promoted subtopic like "סקטורים" would have no matching
  // <option>, so the select couldn't actually display it even though
  // canonicalSaveTarget now points subTopicId at it.
  const subTopics = useMemo(() => {
    const real = getSubTopics(topicId);
    if (!topicId) return real;
    const vt = VIRTUAL_TAXONOMY.find(v => getCanonicalSaveTargetForVirtualPath(v.id, null, topics)?.topicId === topicId);
    if (!vt) return real;
    // Same promotion test as canonicalSaveTarget above: a curated subtopic
    // whose resolution lands on a DIFFERENT standalone topicId (not nested)
    // needs to appear here as a selectable option, or the sync fix above sets
    // subTopicId to a value with no matching <option>.
    const extraIds = [...new Set(
      vt.subtopics
        .map(vs => getCanonicalSaveTargetForVirtualPath(vt.id, vs.id, topics))
        .filter(r => r && !r.subTopicId && r.topicId !== topicId)
        .map(r => r.topicId)
    )].filter(id => !real.some(t => t.id === id));
    return [...real, ...extraIds.map(id => topics.find(t => t.id === id)).filter(Boolean)];
  }, [getSubTopics, topicId, topics]);
  const subSubTopics       = useMemo(() => getSubTopics(subTopicId), [getSubTopics, subTopicId]);
  const selectedMainTopic  = useMemo(() => mainTopics.find(t => t.id === topicId),      [mainTopics, topicId]);
  const selectedSubTopic   = useMemo(() => subTopics.find(t => t.id === subTopicId),    [subTopics,  subTopicId]);
  const selectedSubSubTopic = useMemo(() => subSubTopics.find(t => t.id === subSubTopicId), [subSubTopics, subSubTopicId]);

  const allTopics = useMemo(
    () => [...mainTopics, ...mainTopics.flatMap(t => getSubTopics(t.id))],
    [mainTopics, getSubTopics],
  );

  // ── Virtual taxonomy computed ────────────────────────────────────────────────

  const promotedTopicIds = useMemo(() => getPromotedTopicIds(tabPrefs), [tabPrefs]);

  const virtTopicCountBase = useMemo(
    () => getVirtTopicCounts(libraryItems, topics, promotedTopicIds),
    [libraryItems, topics, promotedTopicIds],
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
    // Custom tabs: filter by the single real topic ID they map to
    const customTab = (tabPrefs.customMainTabs || []).find(ct => ct.id === filterVirtTopicId);
    if (customTab) {
      return customTab.realTopicId
        ? libraryItems.filter(i => i.topicId === customTab.realTopicId)
        : [];
    }
    return filterByVirtTopic(libraryItems, filterVirtTopicId, topics, promotedTopicIds);
  }, [libraryItems, filterVirtTopicId, tabPrefs.customMainTabs, topics, promotedTopicIds]);

  const virtSubtopicCount = useMemo(
    () => getVirtSubtopicCounts(mainFilteredItems, filterVirtTopicId, topics),
    [mainFilteredItems, filterVirtTopicId, topics],
  );

  // Final filtered list: main topic + optional subtopic
  const filteredLibraryItems = useMemo(
    () => filterByVirtSubtopic(mainFilteredItems, filterVirtTopicId, filterVirtSubtopic, topics),
    [mainFilteredItems, filterVirtTopicId, filterVirtSubtopic, topics],
  );

  // ── 3rd-level (sub-subtopic) navigation — real-topic-tree based, not curated ─
  // Real topic id the active main tab resolves to (used as parentId when adding
  // a subtopic from Row 2's "+").
  const activeRealTopicId = useMemo(
    () => getCanonicalSaveTargetForVirtualPath(filterVirtTopicId, null, topics)?.topicId || null,
    [filterVirtTopicId, topics],
  );

  // Real topic id the active Row-2 selection resolves to. filterVirtSubtopic is
  // either a curated 'vts-*' id (resolve via the canonical mapping) or already
  // a raw real id (dynamically-created subtopics are rendered with their real
  // id as the tab value — see extraSubtopicTabs below).
  const activeRealSubTopicId = useMemo(() => {
    if (!filterVirtSubtopic) return null;
    if (topics.some(t => t.id === filterVirtSubtopic)) return filterVirtSubtopic;
    return getCanonicalSaveTargetForVirtualPath(filterVirtTopicId, filterVirtSubtopic, topics)?.subTopicId || null;
  }, [filterVirtSubtopic, filterVirtTopicId, topics]);

  // Extra Row-2 tabs for real subtopics that exist under the active topic but
  // aren't referenced by any curated vs.realTopicIds (e.g. just created via +).
  const extraSubtopicTabs = useMemo(() => {
    if (!activeVirtTopic || !activeRealTopicId) return [];
    const covered = new Set(activeVirtTopic.subtopics.flatMap(vs => vs.realTopicIds));
    return getSubTopics(activeRealTopicId).filter(t => !covered.has(t.id));
  }, [activeVirtTopic, activeRealTopicId, getSubTopics]);

  // Real sub-subtopics under the active Row-2 selection, for the accordion.
  const realSubSubtopics = useMemo(
    () => activeRealSubTopicId ? getSubTopics(activeRealSubTopicId) : [],
    [activeRealSubTopicId, getSubTopics],
  );

  const subSubtopicCounts = useMemo(() => getRealChildCounts(filteredLibraryItems), [filteredLibraryItems]);

  // Collapse the accordion and clear its filter whenever the active subtopic changes.
  useEffect(() => {
    setSubSubAccordionOpen(false);
    setFilterVirtSubSubtopic('');
  }, [filterVirtSubtopic]);

  function handleAddCustomSubTopic(name) {
    if (!activeRealTopicId) { toast.error('בחר קודם נושא ראשי'); return; }
    const t = addTopic({ name: name.trim(), parentId: activeRealTopicId });
    setFilterVirtSubtopic(t.id);
    toast.success(`תת-הנושא "${name.trim()}" נוסף`);
  }

  function handleAddSubSubtopicNav(name) {
    if (!activeRealSubTopicId) { toast.error('בחר קודם תת-נושא'); return; }
    const t = addTopic({ name: name.trim(), parentId: activeRealSubTopicId });
    setFilterVirtSubSubtopic(t.id);
    setSubSubAccordionOpen(true);
    toast.success(`תת-תת-הנושא "${name.trim()}" נוסף`);
  }

  // ── Row-2 edit (rename/delete) ────────────────────────────────────────────────
  // A curated vs entry is editable when:
  //  - it resolves to exactly one existing real topic (always unambiguous,
  //    regardless of whether that one topic itself is nested — e.g. "ETF /
  //    מדדים" → wt-markets-etf, which has its own parentId), OR
  //  - it resolves to several real topics that form ONE tree with exactly one
  //    root (parentId:null) and every other candidate is an actual descendant
  //    of that root — e.g. "כלים" → wt-tools + its 6 real children: one root,
  //    safe to rename/delete via that root.
  // A group with two+ INDEPENDENT top-level candidates (e.g. "n8n / Automation"
  // → wt-ai-n8n and wt-ai-automation, siblings under wt-ai, neither a
  // descendant of the other) or with an outlier that isn't under the root
  // (e.g. "מניות" → wt-stocks plus wt-markets-stocks, which is actually a
  // child of the UNRELATED wt-markets) has no single entity to act on and
  // stays locked. Dynamically-created subtopics (extraSubtopicTabs) are always
  // 1:1 real topics and are always editable.
  function isDescendantOf(topic, ancestorId, allTopics) {
    let cur = topic;
    let depth = 0;
    while (cur?.parentId && depth < 12) {
      if (cur.parentId === ancestorId) return true;
      cur = allTopics.find(t => t.id === cur.parentId);
      depth++;
    }
    return false;
  }

  function resolveEditableRealId(vs) {
    const candidates = vs.realTopicIds.map(id => topics.find(t => t.id === id)).filter(Boolean);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].id;
    const roots = candidates.filter(t => !t.parentId);
    if (roots.length !== 1) return null;
    const root = roots[0];
    const allUnderRoot = candidates.every(t => t.id === root.id || isDescendantOf(t, root.id, topics));
    return allUnderRoot ? root.id : null;
  }

  // Row-2 tabs annotated with { editableRealId, displayName } — curated single-id
  // subtopics show the REAL topic's current name (so a rename is reflected here),
  // falling back to the curated label if the real topic is somehow missing.
  const editableSubtopicRows = useMemo(() => {
    if (!activeVirtTopic) return [];
    const curated = activeVirtTopic.subtopics.map(vs => {
      const realId = resolveEditableRealId(vs);
      const realTopic = realId ? topics.find(t => t.id === realId) : null;
      return { id: vs.id, name: realTopic?.name || vs.name, editableRealId: realId };
    });
    const extra = extraSubtopicTabs.map(t => ({ id: t.id, name: t.name, editableRealId: t.id }));
    return [...curated, ...extra];
  }, [activeVirtTopic, extraSubtopicTabs, topics]);

  function collectDescendantIdsClient(id) {
    const ids = new Set([id]);
    let frontier = [id];
    while (frontier.length > 0) {
      const children = topics.filter(t => frontier.includes(t.parentId)).map(t => t.id);
      frontier = children.filter(cid => !ids.has(cid));
      frontier.forEach(cid => ids.add(cid));
    }
    return ids;
  }

  function countItemsUnderTopic(id) {
    const idSet = collectDescendantIdsClient(id);
    return libraryItems.filter(i => idSet.has(i.topicId) || idSet.has(i.subTopicId) || idSet.has(i.subSubTopicId)).length;
  }

  function handleRenameSubtopic(realId, newName) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    updateTopic(realId, { name: trimmed });
    const affectedIds = libraryItems.filter(i => i.subTopicId === realId).map(i => i.id);
    if (affectedIds.length > 0) {
      updateItemsBulk(affectedIds, { subTopicName: trimmed, subCategory: trimmed });
    }
    setEditingSubtopicId(null);
    setEditingSubtopicLabel('');
    toast.success(`תת-הנושא עודכן ל-"${trimmed}"`);
  }

  function handleRequestDeleteSubtopic(row) {
    setConfirmDeleteSubtopic({ ...row, affectedCount: countItemsUnderTopic(row.editableRealId) });
  }

  function handleConfirmDeleteSubtopic() {
    if (!confirmDeleteSubtopic) return;
    if (confirmDeleteSubtopic.affectedCount > 0) {
      // Purely informational at this point — deletion is blocked, nothing to do.
      setConfirmDeleteSubtopic(null);
      return;
    }
    const result = deleteTopic(confirmDeleteSubtopic.editableRealId);
    if (result.ok) {
      toast.success(`תת-הנושא "${confirmDeleteSubtopic.name}" נמחק`);
      if (filterVirtSubtopic === confirmDeleteSubtopic.id || filterVirtSubtopic === confirmDeleteSubtopic.editableRealId) {
        setFilterVirtSubtopic('');
      }
    } else {
      // Race with a concurrent save — re-report the up-to-date block reason.
      toast.error(`לא ניתן למחוק — ${result.count} פריטים עדיין משויכים`);
    }
    setConfirmDeleteSubtopic(null);
  }

  // ── Row-3 edit (rename/delete) — sub-subtopics are always real, single ids;
  // no curated/ambiguous case exists at this level, unlike Row 2.
  function handleRenameSubSubtopic(id, newName) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    updateTopic(id, { name: trimmed });
    const affectedIds = libraryItems.filter(i => i.subSubTopicId === id).map(i => i.id);
    if (affectedIds.length > 0) {
      updateItemsBulk(affectedIds, { subSubTopicName: trimmed });
    }
    setEditingSubSubtopicId(null);
    setEditingSubSubtopicLabel('');
    toast.success(`תת-תת-הנושא עודכן ל-"${trimmed}"`);
  }

  function handleRequestDeleteSubSubtopic(subSubtopic) {
    setConfirmDeleteSubSubtopic({ ...subSubtopic, affectedCount: countItemsUnderTopic(subSubtopic.id) });
  }

  function handleConfirmDeleteSubSubtopic() {
    if (!confirmDeleteSubSubtopic) return;
    if (confirmDeleteSubSubtopic.affectedCount > 0) {
      setConfirmDeleteSubSubtopic(null);
      return;
    }
    const result = deleteTopic(confirmDeleteSubSubtopic.id);
    if (result.ok) {
      toast.success(`תת-תת-הנושא "${confirmDeleteSubSubtopic.name}" נמחק`);
      if (filterVirtSubSubtopic === confirmDeleteSubSubtopic.id) setFilterVirtSubSubtopic('');
    } else {
      toast.error(`לא ניתן למחוק — ${result.count} פריטים עדיין משויכים`);
    }
    setConfirmDeleteSubSubtopic(null);
  }

  // ── Promote a subtopic OR sub-subtopic to an independent top-level topic ─────
  function handleRequestPromote(row) {
    setConfirmPromote({ id: row.editableRealId || row.id, name: row.name, affectedCount: countItemsUnderTopic(row.editableRealId || row.id) });
  }

  function handleConfirmPromote() {
    if (!confirmPromote) return;
    const { id, name } = confirmPromote;

    // 1. Re-parent to root — its own children (if any) keep pointing at `id`,
    //    so they automatically become its subtopics one level up; nothing to
    //    do there.
    updateTopic(id, { parentId: null });

    // 2. Items tagged directly at this level shift up one level: whatever was
    //    the deeper tag (if any) becomes the new subtopic; there is no level
    //    below subSubTopicId, so that field is always cleared.
    const affected = libraryItems.filter(i => i.subTopicId === id || i.subSubTopicId === id);
    for (const item of affected) {
      if (item.subTopicId === id) {
        updateItem(item.id, {
          topicId: id,
          subTopicId: item.subSubTopicId || null,
          subSubTopicId: null,
          topicName: name,
          subTopicName: item.subSubTopicName || null,
          subSubTopicName: null,
          category: name,
          subCategory: item.subSubTopicName || null,
        });
      } else if (item.subSubTopicId === id) {
        updateItem(item.id, {
          topicId: id,
          subTopicId: null,
          subSubTopicId: null,
          topicName: name,
          subTopicName: null,
          subSubTopicName: null,
          category: name,
          subCategory: null,
        });
      }
    }

    // 3. Give it its own Row-1 tab, and mark it excluded from matching its old
    //    curated grouping (VIRTUAL_TAXONOMY is static — can't remove the
    //    dangling reference there, so the exclusion list is the only way to
    //    stop it from also still showing under the old parent's tab).
    let newPrefs = addCustomMainTab(tabPrefs, { name, emoji: '📌', topicId: id });
    newPrefs = addPromotedTopicId(newPrefs, id);
    setTabPrefs(newPrefs);
    saveWorkspaceTabPreferences(newPrefs);

    // 4. Clear any nav filter that pointed at the now-promoted id — it no
    //    longer exists as a subtopic/sub-subtopic to filter by.
    if (filterVirtSubtopic === id) setFilterVirtSubtopic('');
    if (filterVirtSubSubtopic === id) setFilterVirtSubSubtopic('');
    if (topicId === id) { setTopicId(''); setSubTopicId(''); setSubSubTopicId(''); }
    if (subTopicId === id) { setSubTopicId(''); setSubSubTopicId(''); }
    if (subSubTopicId === id) setSubSubTopicId('');

    reload();
    toast.success(`"${name}" הפך לנושא ראשי עצמאי — ${affected.length} פריטים עברו יחד איתו`);
    setConfirmPromote(null);
    setShowManageSubtopics(false);
    setShowManageSubSubtopics(false);
  }

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
    if (filterVirtSubSubtopic) result = filterByRealSubSubtopic(result, filterVirtSubSubtopic);
    return result;
  }, [filteredLibraryItems, isStocksView, filterMarketStatus, search, filterSourceTab, filterVirtSubSubtopic]);

  const allSourceTabs = useMemo(() => {
    const set = new Set();
    libraryItems.forEach(i => { if (i.sourceTab) set.add(i.sourceTab); });
    return [...set].sort();
  }, [libraryItems]);

  // Global search results — matches against the ENTIRE library (libraryItems),
  // ignoring the active topic/subtopic/sub-subtopic filter. Overrides the topic
  // view entirely while active (results can span multiple topics — see the
  // per-result topic/subtopic badge already built into LibraryItemCard).
  const globalSearchResults = useMemo(() => {
    if (!debouncedGlobalSearch) return null;
    const q = debouncedGlobalSearch.toLowerCase();
    return libraryItems.filter(i =>
      (i.videoTitle || '').toLowerCase().includes(q) ||
      (i.channelName || '').toLowerCase().includes(q) ||
      (i.notes || '').toLowerCase().includes(q) ||
      (i.fullNotes || '').toLowerCase().includes(q) ||
      (i.rawSourceText || '').toLowerCase().includes(q) ||
      (i.topicName || '').toLowerCase().includes(q) ||
      (i.subTopicName || '').toLowerCase().includes(q) ||
      (i.subSubTopicName || '').toLowerCase().includes(q) ||
      (i.sourceTab || '').toLowerCase().includes(q) ||
      (i.symbol || '').toLowerCase().includes(q) ||
      (i.companyName || '').toLowerCase().includes(q) ||
      (i.tags || []).some(tag => tag.toLowerCase().includes(q))
    );
  }, [libraryItems, debouncedGlobalSearch]);

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
    () => groupItemsByVirtTopic(displayItems, topics, promotedTopicIds),
    [displayItems, topics, promotedTopicIds],
  );

  const itemsByVirtSubtopic = useMemo(
    () => filterVirtTopicId ? groupItemsByVirtSubtopic(displayItems, filterVirtTopicId, topics) : {},
    [displayItems, filterVirtTopicId, topics],
  );

  const itemsByDate = useMemo(() => {
    const now       = new Date();
    const today     = now.toDateString();
    const yesterday = new Date(now - 86400000).toDateString();
    const weekAgo   = new Date(now - 7  * 86400000);
    const monthAgo  = new Date(now - 30 * 86400000);
    const groups    = { today: [], yesterday: [], thisWeek: [], thisMonth: [], older: [] };
    displayItems.forEach(item => {
      const d  = new Date(item.savedAt);
      const ds = d.toDateString();
      if      (ds === today)     groups.today.push(item);
      else if (ds === yesterday) groups.yesterday.push(item);
      else if (d >= weekAgo)     groups.thisWeek.push(item);
      else if (d >= monthAgo)    groups.thisMonth.push(item);
      else                       groups.older.push(item);
    });
    return groups;
  }, [displayItems]);

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
    setSubSubTopicId('');
    setNewTopicName('');
    setShowNewTopic(false);
  }

  // Save-form "+" flows for the 2nd/3rd levels — same addTopic({name, parentId})
  // pattern as handleAddTopic above and as SaveToWorkspaceDialog.jsx's handleAddSub.
  function handleAddSubTopicForm() {
    if (!newSubTopicName.trim() || !topicId) return;
    const t = addTopic({ name: newSubTopicName.trim(), parentId: topicId });
    setSubTopicId(t.id);
    setSubSubTopicId('');
    setNewSubTopicName('');
    setShowNewSubTopic(false);
  }

  function handleAddSubSubTopicForm() {
    if (!newSubSubTopicName.trim() || !subTopicId) return;
    const t = addTopic({ name: newSubSubTopicName.trim(), parentId: subTopicId });
    setSubSubTopicId(t.id);
    setNewSubSubTopicName('');
    setShowNewSubSubTopic(false);
  }

  function handleLoadCurrentAnalysis() {
    setLoadedDraftItems(currentAnalysisDraftItems);
    setActiveView('draft');
  }

  function handleSelectVirtTopic(vtId) {
    setFilterVirtTopicId(vtId);
    setFilterVirtSubtopic('');
  }

  function handleDeleteSingleItem(item) {
    setConfirmDeleteSingleItem(item);
  }

  function handleConfirmDeleteSingleItem() {
    if (!confirmDeleteSingleItem) return;
    deleteItem(confirmDeleteSingleItem.id);
    toast.success('הפריט נמחק מ-Workspace');
    reload();
    setConfirmDeleteSingleItem(null);
  }

  function handleArchiveSingleItem(item) {
    archiveItems([item.id], true);
    toast.success('הפריט הועבר לארכיון');
    reload();
  }

  // ── Stock table adapter (שוק ההון > מניות) ───────────────────────────────────
  // StockWatchlistView owns its own selection state, bulk bar, delete/bulk-delete
  // confirmations, and edit modal — mirrors exactly how WorkspaceLibrary.jsx wires it.
  const handleStatusChange = (id, newStatus) => updateItem(id, { marketStatus: newStatus || null });

  const handleDeleteStockItem = (item) => {
    deleteItem(item.id);
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

  function handleCopyOverlaySelected() {
    const selected = libraryItems.filter(i => selectedOverlayIds.has(i.id));
    const text = formatWorkspaceItemsForCopy(selected);
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`הועתקו ${selected.length} פריטים ללוח`))
      .catch(() => toast.error('לא ניתן להעתיק'));
  }

  function handleArchiveOverlaySelected() {
    const ids = [...selectedOverlayIds];
    archiveItems(ids, true);
    toast.success(`${ids.length} פריטים הועברו לארכיון`);
    clearOverlaySelection();
    reload();
  }

  function handleConfirmBulkDeleteOverlay() {
    const ids = [...selectedOverlayIds];
    deleteItems(ids);
    toast.success(`${ids.length} פריטים נמחקו מ-Workspace`);
    clearOverlaySelection();
    reload();
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
    if (effectiveDraftItems.length === 0) return;
    setIsSaving(true);
    const savedIds    = [];
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
        findWorkspaceItemByContentHash(contentHash)
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
      } else {
        titlePart = item.sectionLabel
          ? `${item.sectionLabel} — ${(videoContext.videoTitle || '').slice(0, 40)}`
          : (videoContext.videoTitle || '').slice(0, 60) || 'קטע נבחר';
      }

      // For stock items: item.text already IS the complete note; user notes appended
      const combinedNotes = [item.text, notes].filter(Boolean).join('\n\n');

      saveWorkspaceItem({
        id,
        videoId:      null,
        videoUrl:     videoContext.videoUrl    || null,
        videoTitle:   titlePart.slice(0, 80),
        channelName:  videoContext.channelName || '',
        thumbnail:    videoContext.thumbnail   || null,
        topicId:       topicId       || null,
        subTopicId:    subTopicId    || null,
        subSubTopicId: subSubTopicId || null,
        topicName,
        subTopicName,
        subSubTopicName: selectedSubSubTopic?.name || null,
        notes:        combinedNotes,
        flags,
        tags,
        sourceTab:    videoContext.sourceTab || 'Manual',
        category:     topicName    || null,
        subCategory:  subTopicName || null,
        savedAt:      now,
        contentHash,
        ...stockExtraFields, // additive: only present on stock items
      });
      savedIds.push(id);
    }

    reload();
    setRecentlySavedIds(savedIds);
    setActiveView('recent');
    setIsSaving(false);
    if (skippedCount > 0) {
      toast.success(`⭐ ${savedIds.length} פריטים נשמרו, ${skippedCount} כבר נשמרו קודם ולא נוספו שוב`);
    } else {
      toast.success(`⭐ ${savedIds.length} פריטים נשמרו ל-Workspace Library`);
    }
    onSaved?.({ count: savedIds.length, skipped: skippedCount });
  }, [effectiveDraftItems, topicId, subTopicId, subSubTopicId, flags, tags, notes, videoContext, selectedMainTopic, selectedSubTopic, selectedSubSubTopic, reload, onSaved]);

  // ── View tabs ─────────────────────────────────────────────────────────────────

  const VIEWS = [
    ...(effectiveDraftItems.length > 0 || currentAnalysisDraftItems.length > 0
      ? [{ key: 'draft', label: effectiveDraftItems.length > 0 ? `טיוטה (${effectiveDraftItems.length})` : 'טיוטה' }]
      : []),
    { key: 'recent', label: recentlySavedIds.length > 0 ? `נשמרו עכשיו (${recentlySavedIds.length})` : 'נשמרו עכשיו' },
    { key: 'topics', label: isStocksView ? 'טבלת מניות' : 'לפי נושאים' },
    { key: 'dates',  label: 'לפי תאריכים' },
    { key: 'pinned', label: 'מועדפים/חשובים' },
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
        {/* pl-10 reserves room for the Dialog primitive's own close "✕", which
            is always absolutely positioned at the physical left-4/top-4
            regardless of dir="rtl" — without this, the RTL header's trailing
            (visually left) button group (⋮ / מסך מלא) collides with it. */}
        <DialogHeader className="shrink-0 border-b border-slate-200 dark:border-zinc-800 px-5 py-3 pl-10">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-right text-base font-bold text-slate-900 dark:text-zinc-100">
              ⭐ Workspace Library
              <span className="text-xs font-normal text-slate-400 dark:text-zinc-500">
                — {libraryItems.length} פריטים שמורים
              </span>
            </DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              <DangerZoneMenu
                allItems={libraryItems}
                visibleItems={displayItems}
                deleteItems={deleteItems}
                deleteAllItems={deleteAllItems}
              />
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

        {/* ── Global search — searches ALL libraryItems, independent of the
              active topic/subtopic/sub-subtopic tab below. Distinct from the
              per-tab "search" field further down (which stays scoped to the
              currently filtered view). ─────────────────────────────────────── */}
        <div className="shrink-0 bg-white dark:bg-zinc-950 px-4 pt-2.5 pb-2 border-b border-slate-100 dark:border-zinc-800/60" dir="rtl">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder={`חיפוש גלובלי בכל ${libraryItems.length} הפריטים — בכל הנושאים...`}
              className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 pr-9 pl-9 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:text-zinc-200"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                aria-label="נקה חיפוש"
              >
                ✕
              </button>
            )}
          </div>
        </div>

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
              aria-label="ערוך טאבים"
              className={cn(
                'mr-auto shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all',
                showManageTabs
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
                  : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800',
              )}
            >
              ⚙
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
        {activeVirtTopic && (
          <div className="shrink-0 bg-slate-50/80 dark:bg-zinc-900/60 px-4 py-2.5 overflow-x-auto border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 min-w-max">
              <div className="min-w-0">
                <WorkspaceTabRow
                  tabs={[
                    ...editableSubtopicRows.filter(row => !HIDDEN_VIRTUAL_SUBTOPIC_IDS.has(row.id)).map(row => ({
                      value: row.id,
                      label: row.name,
                      count: virtSubtopicCount[row.id] || virtSubtopicCount[row.editableRealId] || 0,
                      empty: !(virtSubtopicCount[row.id] || virtSubtopicCount[row.editableRealId]),
                    })),
                    { value: '', label: `כולם${mainFilteredItems.length > 0 ? ` (${mainFilteredItems.length})` : ''}` },
                  ]}
                  activeValue={filterVirtSubtopic}
                  onSelect={v => setFilterVirtSubtopic(prev => prev === v ? '' : v)}
                  onAddTab={handleAddCustomSubTopic}
                  addLabel="+ תת-נושא"
                  size="md"
                  accentColor="violet"
                  className="min-w-max"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowManageSubtopics(p => !p)}
                title="ערוך תתי-נושאים"
                aria-label="ערוך טאבים"
                className={cn(
                  'mr-auto shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all',
                  showManageSubtopics
                    ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-950/30 dark:text-violet-400'
                    : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800',
                )}
              >
                ⚙
              </button>
            </div>
          </div>
        )}

        {/* ── Manage subtopics panel ────────────────────────────────────── */}
        {showManageSubtopics && activeVirtTopic && (
          <div className="shrink-0 bg-violet-50/70 dark:bg-zinc-900/80 border-b border-violet-200 dark:border-zinc-700 px-4 py-3" dir="rtl">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">ניהול תתי-נושאים</span>
              <button
                type="button"
                onClick={() => { setShowManageSubtopics(false); setEditingSubtopicId(null); setEditingSubtopicLabel(''); }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                ✕ סגור
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {editableSubtopicRows.filter(row => !!row.editableRealId).map(row => {
                const isEditing = editingSubtopicId === row.id;
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 px-3 py-2 transition-colors"
                  >
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={editingSubtopicLabel}
                          onChange={e => setEditingSubtopicLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  handleRenameSubtopic(row.editableRealId, editingSubtopicLabel);
                            if (e.key === 'Escape') { setEditingSubtopicId(null); setEditingSubtopicLabel(''); }
                          }}
                          className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-0.5 text-sm text-right dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
                        />
                        <button type="button" onClick={() => handleRenameSubtopic(row.editableRealId, editingSubtopicLabel)} className="shrink-0 text-xs font-semibold text-green-600 hover:underline">שמור</button>
                        <button type="button" onClick={() => { setEditingSubtopicId(null); setEditingSubtopicLabel(''); }} className="shrink-0 text-xs text-slate-400 hover:underline">ביטול</button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm flex-1 text-right">{row.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRequestPromote(row)}
                          title="הפוך לנושא ראשי"
                          className="shrink-0 text-xs text-slate-400 hover:text-indigo-600 dark:text-zinc-600 dark:hover:text-indigo-400"
                        >
                          ⬆
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingSubtopicId(row.id); setEditingSubtopicLabel(row.name); }}
                          title="שנה שם"
                          className="shrink-0 text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-600 dark:hover:text-zinc-400"
                        >
                          ✏
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestDeleteSubtopic(row)}
                          title="מחק תת-נושא"
                          className="shrink-0 text-base leading-none select-none text-slate-400 hover:text-red-500"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Row 3: Sub-subtopic accordion — collapsed by default ────────── */}
        {activeRealSubTopicId && (
          <div className="shrink-0 bg-slate-50/50 dark:bg-zinc-900/40 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSubSubAccordionOpen(o => !o)}
                className="flex-1 flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400"
              >
                <span className={cn('inline-block transition-transform', subSubAccordionOpen && 'rotate-90')}>›</span>
                תתי-נושא ({realSubSubtopics.length})
              </button>
              {subSubAccordionOpen && realSubSubtopics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowManageSubSubtopics(p => !p)}
                  title="ערוך טאבים"
                  aria-label="ערוך טאבים"
                  className={cn(
                    'shrink-0 rounded-lg border px-2 py-1 mx-2 text-[11px] font-semibold whitespace-nowrap transition-all',
                    showManageSubSubtopics
                      ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-950/30 dark:text-violet-400'
                      : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800',
                  )}
                >
                  ⚙
                </button>
              )}
            </div>
            {subSubAccordionOpen && (
              <div className="px-4 pb-2.5 overflow-x-auto">
                <WorkspaceTabRow
                  tabs={[
                    ...realSubSubtopics.map(t => ({
                      value: t.id,
                      label: t.name,
                      count: subSubtopicCounts[t.id] || 0,
                      empty: !subSubtopicCounts[t.id],
                    })),
                    { value: '', label: `הכל${filteredLibraryItems.length > 0 ? ` (${filteredLibraryItems.length})` : ''}` },
                  ]}
                  activeValue={filterVirtSubSubtopic}
                  onSelect={v => setFilterVirtSubSubtopic(prev => prev === v ? '' : v)}
                  onAddTab={handleAddSubSubtopicNav}
                  addLabel="+ תת-תת-נושא"
                  size="sm"
                  accentColor="violet"
                  className="min-w-max"
                />
              </div>
            )}

            {/* ── Manage sub-subtopics panel ─────────────────────────────── */}
            {subSubAccordionOpen && showManageSubSubtopics && (
              <div className="bg-violet-50/70 dark:bg-zinc-900/80 border-t border-violet-200 dark:border-zinc-700 px-4 py-3" dir="rtl">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">ניהול תתי-תת-נושאים</span>
                  <button
                    type="button"
                    onClick={() => { setShowManageSubSubtopics(false); setEditingSubSubtopicId(null); setEditingSubSubtopicLabel(''); }}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    ✕ סגור
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {realSubSubtopics.map(t => {
                    const isEditing = editingSubSubtopicId === t.id;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 px-3 py-2"
                      >
                        {isEditing ? (
                          <>
                            <input
                              autoFocus
                              value={editingSubSubtopicLabel}
                              onChange={e => setEditingSubSubtopicLabel(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  handleRenameSubSubtopic(t.id, editingSubSubtopicLabel);
                                if (e.key === 'Escape') { setEditingSubSubtopicId(null); setEditingSubSubtopicLabel(''); }
                              }}
                              className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-0.5 text-sm text-right dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
                            />
                            <button type="button" onClick={() => handleRenameSubSubtopic(t.id, editingSubSubtopicLabel)} className="shrink-0 text-xs font-semibold text-green-600 hover:underline">שמור</button>
                            <button type="button" onClick={() => { setEditingSubSubtopicId(null); setEditingSubSubtopicLabel(''); }} className="shrink-0 text-xs text-slate-400 hover:underline">ביטול</button>
                          </>
                        ) : (
                          <>
                            <span className="text-sm flex-1 text-right">{t.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRequestPromote(t)}
                              title="הפוך לנושא ראשי"
                              className="shrink-0 text-xs text-slate-400 hover:text-indigo-600 dark:text-zinc-600 dark:hover:text-indigo-400"
                            >
                              ⬆
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingSubSubtopicId(t.id); setEditingSubSubtopicLabel(t.name); }}
                              title="שנה שם"
                              className="shrink-0 text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-600 dark:hover:text-zinc-400"
                            >
                              ✏
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteSubSubtopic(t)}
                              title="מחק תת-תת-נושא"
                              className="shrink-0 text-base leading-none select-none text-slate-400 hover:text-red-500"
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                      <option key={tab} value={tab}>{tab}</option>
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
                <OverlayFilterChip label={`מקור: ${filterSourceTab}`} onRemove={() => setFilterSourceTab('')} />
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

          {globalSearchResults !== null ? (
            // Global search overrides the topic/subtopic/sub-subtopic view entirely
            // while active — results can span multiple topics, hence the per-item
            // topic/subtopic badge already built into LibraryItemCard.
            <div className={cn('p-5 space-y-3', isFullscreen && 'max-w-3xl mx-auto')}>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-zinc-400">
                {globalSearchResults.length > 0
                  ? `${globalSearchResults.length} תוצאות עבור "${debouncedGlobalSearch}" — בכל הנושאים`
                  : `אין תוצאות עבור "${debouncedGlobalSearch}"`}
              </h3>
              {globalSearchResults.length === 0 ? (
                <EmptyState label="נסה מונח חיפוש אחר, או נקה את החיפוש כדי לחזור לתצוגה הרגילה" />
              ) : (
                globalSearchResults.map(item => (
                  <LibraryItemCard key={item.id} item={item} allTopics={allTopics} onDelete={handleDeleteSingleItem} onArchive={handleArchiveSingleItem} selected={selectedOverlayIds.has(item.id)} onToggleSelect={toggleOverlaySelect} />
                ))
              )}
            </div>
          ) : (
          <>
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
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">נושא ראשי</label>
                      <select
                        value={topicId}
                        onChange={e => { setTopicId(e.target.value); setSubTopicId(''); setSubSubTopicId(''); }}
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
                        onChange={e => { setSubTopicId(e.target.value === '__none__' ? '' : e.target.value); setSubSubTopicId(''); }}
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
                      {showNewSubTopic ? (
                        <div className="flex gap-1">
                          <input
                            autoFocus
                            value={newSubTopicName}
                            onChange={e => setNewSubTopicName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddSubTopicForm()}
                            placeholder="שם תת-נושא..."
                            className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1.5 text-sm text-right focus:outline-none dark:bg-zinc-900 dark:text-zinc-200"
                          />
                          <button type="button" onClick={handleAddSubTopicForm} className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">הוסף</button>
                          <button type="button" onClick={() => setShowNewSubTopic(false)} className="rounded-lg border border-slate-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-slate-500">✕</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowNewSubTopic(true)}
                          disabled={!topicId}
                          className="text-xs text-amber-500 hover:underline disabled:opacity-40 disabled:pointer-events-none"
                        >
                          + תת-נושא חדש
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">תת-תת-נושא</label>
                      <select
                        value={subSubTopicId}
                        onChange={e => setSubSubTopicId(e.target.value === '__none__' ? '' : e.target.value)}
                        disabled={!subTopicId || subSubTopics.length === 0}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
                      >
                        <option value="__none__">
                          {!subTopicId ? 'בחר תת-נושא תחילה' : subSubTopics.length === 0 ? 'אין תת-תת-נושאים' : 'ללא'}
                        </option>
                        {subSubTopics.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {showNewSubSubTopic ? (
                        <div className="flex gap-1">
                          <input
                            autoFocus
                            value={newSubSubTopicName}
                            onChange={e => setNewSubSubTopicName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddSubSubTopicForm()}
                            placeholder="שם תת-תת-נושא..."
                            className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1.5 text-sm text-right focus:outline-none dark:bg-zinc-900 dark:text-zinc-200"
                          />
                          <button type="button" onClick={handleAddSubSubTopicForm} className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">הוסף</button>
                          <button type="button" onClick={() => setShowNewSubSubTopic(false)} className="rounded-lg border border-slate-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-slate-500">✕</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowNewSubSubTopic(true)}
                          disabled={!subTopicId}
                          className="text-xs text-amber-500 hover:underline disabled:opacity-40 disabled:pointer-events-none"
                        >
                          + תת-תת-נושא חדש
                        </button>
                      )}
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
                      <LibraryItemCard key={item.id} item={item} allTopics={allTopics} onDelete={handleDeleteSingleItem} onArchive={handleArchiveSingleItem} selected={selectedOverlayIds.has(item.id)} onToggleSelect={toggleOverlaySelect} />
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
                        <LibraryItemCard key={item.id} item={item} allTopics={allTopics} compact onDelete={handleDeleteSingleItem} onArchive={handleArchiveSingleItem} selected={selectedOverlayIds.has(item.id)} onToggleSelect={toggleOverlaySelect} />
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
                            onDelete={handleDeleteSingleItem}
                            onArchive={handleArchiveSingleItem}
                            selectedIds={selectedOverlayIds}
                            onToggleSelect={toggleOverlaySelect}
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
                          onDelete={handleDeleteSingleItem}
                          onArchive={handleArchiveSingleItem}
                          selectedIds={selectedOverlayIds}
                          onToggleSelect={toggleOverlaySelect}
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
                        onDelete={handleDeleteSingleItem}
                        onArchive={handleArchiveSingleItem}
                        selectedIds={selectedOverlayIds}
                        onToggleSelect={toggleOverlaySelect}
                      />
                    ))}
                  {itemsByVirtTopic['__none__']?.length > 0 && (
                    <FolderGroup
                      label="📁 ללא נושא"
                      count={itemsByVirtTopic['__none__'].length}
                      items={itemsByVirtTopic['__none__']}
                      allTopics={allTopics}
                      muted
                      onDelete={handleDeleteSingleItem}
                      onArchive={handleArchiveSingleItem}
                      selectedIds={selectedOverlayIds}
                      onToggleSelect={toggleOverlaySelect}
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
              {displayItems.length === 0 && <EmptyState label={filterMarketStatus ? 'אין עדיין מניות בטאב הזה' : 'אין פריטים בנושא הנוכחי'} />}
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
                        <LibraryItemCard key={item.id} item={item} allTopics={allTopics} compact showDate onDelete={handleDeleteSingleItem} onArchive={handleArchiveSingleItem} selected={selectedOverlayIds.has(item.id)} onToggleSelect={toggleOverlaySelect} />
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
                      <LibraryItemCard key={item.id} item={item} allTopics={allTopics} onDelete={handleDeleteSingleItem} onArchive={handleArchiveSingleItem} selected={selectedOverlayIds.has(item.id)} onToggleSelect={toggleOverlaySelect} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          </>
          )}

        </div>

        {/* Bulk selection bar — sits at bottom of the flex-col DialogContent */}
        <WorkspaceBulkActionBar
          count={selectedOverlayIds.size}
          onCopy={handleCopyOverlaySelected}
          onArchive={handleArchiveOverlaySelected}
          onDelete={() => setConfirmBulkDeleteOverlay(true)}
          onClearSelection={clearOverlaySelection}
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
      open={confirmBulkDeleteOverlay}
      onOpenChange={setConfirmBulkDeleteOverlay}
      title={`למחוק ${selectedOverlayIds.size} פריטים מסומנים מה-Workspace?`}
      description="הפעולה לא משפיעה על Brain / KnowledgeItems — היא מוחקת רק מה-Workspace."
      confirmLabel="מחק מסומנים"
      danger
      onConfirm={handleConfirmBulkDeleteOverlay}
    />

    <ConfirmDialog
      open={!!confirmDeleteSubtopic}
      onOpenChange={open => !open && setConfirmDeleteSubtopic(null)}
      title={
        confirmDeleteSubtopic?.affectedCount > 0
          ? `לא ניתן למחוק את "${confirmDeleteSubtopic?.name}"`
          : `למחוק את תת-הנושא "${confirmDeleteSubtopic?.name}"?`
      }
      description={
        confirmDeleteSubtopic?.affectedCount > 0
          ? `${confirmDeleteSubtopic.affectedCount} פריטים מתויגים תחת תת-נושא זה (או תתי-הנושאים שלו). הזז או מחק אותם קודם.`
          : 'תת-הנושא ריק ואין תתי-נושאים תחתיו. הפעולה בלתי הפיכה.'
      }
      confirmLabel={confirmDeleteSubtopic?.affectedCount > 0 ? 'הבנתי' : 'מחק'}
      cancelLabel={confirmDeleteSubtopic?.affectedCount > 0 ? 'סגור' : 'ביטול'}
      danger
      onConfirm={handleConfirmDeleteSubtopic}
    />

    <ConfirmDialog
      open={!!confirmDeleteSubSubtopic}
      onOpenChange={open => !open && setConfirmDeleteSubSubtopic(null)}
      title={
        confirmDeleteSubSubtopic?.affectedCount > 0
          ? `לא ניתן למחוק את "${confirmDeleteSubSubtopic?.name}"`
          : `למחוק את תת-תת-הנושא "${confirmDeleteSubSubtopic?.name}"?`
      }
      description={
        confirmDeleteSubSubtopic?.affectedCount > 0
          ? `${confirmDeleteSubSubtopic.affectedCount} פריטים מתויגים תחת תת-תת-נושא זה. הזז או מחק אותם קודם.`
          : 'הפעולה בלתי הפיכה.'
      }
      confirmLabel={confirmDeleteSubSubtopic?.affectedCount > 0 ? 'הבנתי' : 'מחק'}
      cancelLabel={confirmDeleteSubSubtopic?.affectedCount > 0 ? 'סגור' : 'ביטול'}
      danger
      onConfirm={handleConfirmDeleteSubSubtopic}
    />

    <ConfirmDialog
      open={!!confirmPromote}
      onOpenChange={open => !open && setConfirmPromote(null)}
      title={`להפוך את "${confirmPromote?.name}" לנושא ראשי עצמאי?`}
      description={
        confirmPromote?.affectedCount > 0
          ? `${confirmPromote.affectedCount} פריטים (ותתי-נושאים, אם יש) יעברו יחד איתו. הוא יקבל טאב נושא ראשי משלו בשורה העליונה, ולא יופיע יותר תחת הנושא הקודם.`
          : 'הוא יקבל טאב נושא ראשי משלו בשורה העליונה, ולא יופיע יותר תחת הנושא הקודם.'
      }
      confirmLabel="הפוך לנושא ראשי"
      danger={false}
      onConfirm={handleConfirmPromote}
    />
    </>
  );
}

// ─── Folder group ─────────────────────────────────────────────────────────────

function FolderGroup({ label, count, items, allTopics, indent = false, muted = false, onDelete, onArchive, selectedIds, onToggleSelect }) {
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
            <LibraryItemCard key={item.id} item={item} allTopics={allTopics} compact
              onDelete={onDelete} onArchive={onArchive}
              selected={selectedIds?.has(item.id)}
              onToggleSelect={onToggleSelect}
            />
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

function LibraryItemCard({ item, allTopics, compact = false, showDate = false, onDelete, onArchive, selected = false, onToggleSelect }) {
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
            checked={selected}
            onChange={e => { e.stopPropagation(); onToggleSelect(item.id); }}
            onClick={e => e.stopPropagation()}
            className="shrink-0 h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-600 text-indigo-600 cursor-pointer"
          />
        )}
        <p className="flex-1 min-w-0 text-sm font-medium text-slate-800 dark:text-zinc-200 truncate leading-snug">
          {item.videoTitle || 'ללא כותרת'}
        </p>
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
            checked={selected}
            onChange={e => { e.stopPropagation(); onToggleSelect(item.id); }}
            onClick={e => e.stopPropagation()}
            className="mt-1 shrink-0 h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-600 text-indigo-600 cursor-pointer"
          />
        )}
        <p className="flex-1 min-w-0 text-base font-bold text-slate-900 dark:text-zinc-100 leading-snug">
          {item.videoTitle || 'ללא כותרת'}
        </p>
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
              {item.sourceTab}
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
