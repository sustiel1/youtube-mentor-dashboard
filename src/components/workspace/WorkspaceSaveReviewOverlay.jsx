import { useState, useMemo, useCallback } from "react";
import { Star, Check } from "lucide-react";
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

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function WorkspaceSaveReviewOverlay({
  open,
  onOpenChange,
  draftItems = [],      // [{ id, text, sectionLabel, type }]
  videoContext = {},    // { videoTitle, channelName, thumbnail, videoUrl, sourceTab }
  onSaved,
}) {
  const { mainTopics, getSubTopics, addTopic } = useWorkspaceTopics();
  const { items: libraryItems, reload } = useWorkspaceItems();

  // Bulk controls state
  const [topicId, setTopicId] = useState('');
  const [subTopicId, setSubTopicId] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [flags, setFlags] = useState({ isFavorite: false, isImportant: false, mustWatchAgain: false });
  const [notes, setNotes] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [showNewTopic, setShowNewTopic] = useState(false);

  // View state
  const [activeView, setActiveView] = useState('draft');
  const [recentlySavedIds, setRecentlySavedIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const subTopics = useMemo(() => getSubTopics(topicId), [getSubTopics, topicId]);
  const selectedMainTopic = useMemo(() => mainTopics.find(t => t.id === topicId), [mainTopics, topicId]);
  const selectedSubTopic  = useMemo(() => subTopics.find(t => t.id === subTopicId), [subTopics, subTopicId]);

  const allTopics = useMemo(
    () => [...mainTopics, ...mainTopics.flatMap(t => getSubTopics(t.id))],
    [mainTopics, getSubTopics],
  );

  function handleOpenChange(isOpen) {
    if (!isOpen) {
      setTopicId('');
      setSubTopicId('');
      setTags([]);
      setTagInput('');
      setFlags({ isFavorite: false, isImportant: false, mustWatchAgain: false });
      setNotes('');
      setActiveView('draft');
      setRecentlySavedIds([]);
      setShowNewTopic(false);
      setNewTopicName('');
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

  const handleSaveAll = useCallback(() => {
    if (draftItems.length === 0) return;
    setIsSaving(true);
    const savedIds = [];
    const now = new Date().toISOString();
    const topicName    = selectedMainTopic?.name || '';
    const subTopicName = selectedSubTopic?.name  || '';

    draftItems.forEach((item) => {
      const id = `ws-snippet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const titlePart = item.sectionLabel
        ? `${item.sectionLabel} — ${(videoContext.videoTitle || '').slice(0, 40)}`
        : (videoContext.videoTitle || '').slice(0, 60) || 'קטע נבחר';
      const combinedNotes = [item.text, notes].filter(Boolean).join('\n\n');

      saveWorkspaceItem({
        id,
        videoId: null,
        videoUrl: videoContext.videoUrl || null,
        videoTitle: titlePart.slice(0, 80),
        channelName: videoContext.channelName || '',
        thumbnail: videoContext.thumbnail || null,
        topicId: topicId || null,
        subTopicId: subTopicId || null,
        topicName,
        subTopicName,
        notes: combinedNotes,
        flags,
        tags,
        sourceTab: videoContext.sourceTab || 'Manual',
        category: topicName || null,
        subCategory: subTopicName || null,
        savedAt: now,
      });
      savedIds.push(id);
    });

    reload();
    setRecentlySavedIds(savedIds);
    setActiveView('recent');
    setIsSaving(false);
    toast.success(`⭐ ${savedIds.length} פריטים נשמרו ל-Workspace Library`);
    onSaved?.({ count: savedIds.length });
  }, [draftItems, topicId, subTopicId, flags, tags, notes, videoContext, selectedMainTopic, selectedSubTopic, reload, onSaved]);

  // Computed list views
  const recentItems = useMemo(
    () => recentlySavedIds.length > 0 ? libraryItems.filter(i => recentlySavedIds.includes(i.id)) : [],
    [libraryItems, recentlySavedIds],
  );

  const itemsByTopic = useMemo(() => {
    const groups = {};
    libraryItems.forEach(item => {
      const key = item.topicId || '__none__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [libraryItems]);

  const itemsByDate = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now - 86400000).toDateString();
    const weekAgo   = new Date(now - 7  * 86400000);
    const monthAgo  = new Date(now - 30 * 86400000);
    const groups = { today: [], yesterday: [], thisWeek: [], thisMonth: [], older: [] };
    libraryItems.forEach(item => {
      const d  = new Date(item.savedAt);
      const ds = d.toDateString();
      if      (ds === today)     groups.today.push(item);
      else if (ds === yesterday) groups.yesterday.push(item);
      else if (d >= weekAgo)     groups.thisWeek.push(item);
      else if (d >= monthAgo)    groups.thisMonth.push(item);
      else                       groups.older.push(item);
    });
    return groups;
  }, [libraryItems]);

  const pinnedItems = useMemo(
    () => libraryItems.filter(i => i.flags?.isFavorite || i.flags?.isImportant),
    [libraryItems],
  );

  const VIEWS = [
    { key: 'draft',  label: `טיוטה (${draftItems.length})` },
    { key: 'recent', label: recentlySavedIds.length > 0 ? `נשמרו עכשיו (${recentlySavedIds.length})` : 'נשמרו עכשיו' },
    { key: 'topics', label: 'לפי נושאים' },
    { key: 'dates',  label: 'לפי תאריכים' },
    { key: 'pinned', label: 'מועדפים/חשובים' },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex flex-col w-[min(96vw,860px)] max-h-[88vh] p-0 gap-0 border-amber-200 dark:border-amber-900/40"
      >
        <DialogHeader className="shrink-0 border-b border-slate-200 dark:border-zinc-800 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-right text-base font-bold text-slate-900 dark:text-zinc-100">
            ⭐ Workspace Library
            <span className="text-xs font-normal text-slate-400 dark:text-zinc-500">
              — {libraryItems.length} פריטים שמורים
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* View tabs */}
        <div
          dir="rtl"
          className="shrink-0 flex gap-0.5 border-b border-slate-200 dark:border-zinc-800 px-4 pt-2 bg-white dark:bg-zinc-950 overflow-x-auto"
        >
          {VIEWS.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => setActiveView(v.key)}
              className={cn(
                'px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-colors border-b-2 -mb-px',
                activeView === v.key
                  ? 'border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20'
                  : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto" dir="rtl">

          {/* ── Draft view ─────────────────────────────────────────── */}
          {activeView === 'draft' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                  טיוטת שמירה — {draftItems.length} פריטים נבחרו
                </h3>
                {videoContext.videoTitle && (
                  <span className="text-xs text-slate-400 dark:text-zinc-600 truncate max-w-xs">
                    מתוך: {videoContext.videoTitle.slice(0, 55)}
                  </span>
                )}
              </div>

              {/* Selected snippets list */}
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {draftItems.map(item => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3 py-2"
                  >
                    {item.sectionLabel && (
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-500 mb-0.5">
                        {item.sectionLabel}
                      </p>
                    )}
                    <p className="text-xs text-slate-700 dark:text-zinc-300 line-clamp-2">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bulk controls */}
              <div className="grid grid-cols-2 gap-3">
                {/* Topic */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">נושא ראשי</label>
                  <select
                    value={topicId}
                    onChange={e => { setTopicId(e.target.value); setSubTopicId(''); }}
                    className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="">בחר נושא...</option>
                    {mainTopics.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.emoji ? `${t.emoji} ` : ''}{t.name}
                      </option>
                    ))}
                  </select>
                  {showNewTopic ? (
                    <div className="flex gap-1 mt-1">
                      <input
                        autoFocus
                        value={newTopicName}
                        onChange={e => setNewTopicName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddTopic()}
                        placeholder="שם נושא חדש..."
                        className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1 text-xs text-right focus:outline-none dark:bg-zinc-900 dark:text-zinc-200"
                      />
                      <button type="button" onClick={handleAddTopic} className="rounded-lg bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-600">הוסף</button>
                      <button type="button" onClick={() => setShowNewTopic(false)} className="rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1 text-xs text-slate-500">✕</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowNewTopic(true)} className="text-[11px] text-amber-500 hover:underline">
                      + נושא חדש
                    </button>
                  )}
                </div>

                {/* Sub-topic */}
                <div className="space-y-1">
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
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                  תגיות <span className="font-normal text-slate-400">(Enter או פסיק להפרדה)</span>
                </label>
                <div
                  className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-2 min-h-[38px] cursor-text"
                  onClick={() => document.getElementById('ws-draft-tag-input')?.focus()}
                >
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setTags(p => p.filter(t => t !== tag)); }}
                        className="text-indigo-400 hover:text-indigo-700 leading-none"
                      >
                        ×
                      </button>
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
                    className="flex-1 min-w-[80px] bg-transparent text-xs text-slate-700 dark:text-zinc-300 placeholder:text-slate-300 dark:placeholder:text-zinc-600 outline-none"
                  />
                </div>
              </div>

              {/* Flags */}
              <div className="space-y-1">
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
                        'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
                        flags[key]
                          ? active
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                  הערות נוספות <span className="font-normal">(אופציונלי — תצורפנה לכל הפריטים)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  dir="rtl"
                  placeholder="הוסף הערה אישית..."
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-right placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving || draftItems.length === 0}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
              >
                {isSaving ? 'שומר...' : `⭐ שמור הכל ל-Workspace (${draftItems.length} פריטים)`}
              </button>
            </div>
          )}

          {/* ── Recently saved view ─────────────────────────────────── */}
          {activeView === 'recent' && (
            <div className="p-5">
              {recentItems.length === 0 ? (
                <EmptyState label="שמור פריטים כדי לראות אותם כאן" icon={<Check className="h-10 w-10 opacity-25" />} />
              ) : (
                <>
                  <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    נשמרו עכשיו — {recentItems.length} פריטים
                  </h3>
                  <div className="space-y-2">
                    {recentItems.map(item => (
                      <MiniItemCard key={item.id} item={item} allTopics={allTopics} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── By topic view ───────────────────────────────────────── */}
          {activeView === 'topics' && (
            <div className="p-5 space-y-4">
              {libraryItems.length === 0 && <EmptyState label="אין פריטים שמורים עדיין" />}
              {mainTopics
                .filter(t => itemsByTopic[t.id]?.length > 0)
                .map(topic => (
                  <div key={topic.id}>
                    <h3 className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                      {topic.emoji} {topic.name}
                      <span className="mr-1 text-slate-400 font-normal">({itemsByTopic[topic.id].length})</span>
                    </h3>
                    <div className="space-y-1.5 pr-2">
                      {itemsByTopic[topic.id].map(item => (
                        <MiniItemCard key={item.id} item={item} allTopics={allTopics} compact />
                      ))}
                    </div>
                  </div>
                ))}
              {itemsByTopic['__none__']?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-600 mb-2">
                    📁 ללא נושא <span className="font-normal">({itemsByTopic['__none__'].length})</span>
                  </h3>
                  <div className="space-y-1.5 pr-2">
                    {itemsByTopic['__none__'].map(item => (
                      <MiniItemCard key={item.id} item={item} allTopics={[]} compact />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── By date view ────────────────────────────────────────── */}
          {activeView === 'dates' && (
            <div className="p-5 space-y-4">
              {libraryItems.length === 0 && <EmptyState label="אין פריטים שמורים עדיין" />}
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
                    <h3 className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                      {label}{' '}
                      <span className="text-slate-400 font-normal">({itemsByDate[key].length})</span>
                    </h3>
                    <div className="space-y-1.5 pr-2">
                      {itemsByDate[key].map(item => (
                        <MiniItemCard key={item.id} item={item} allTopics={allTopics} compact showDate />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ── Pinned / favorites view ─────────────────────────────── */}
          {activeView === 'pinned' && (
            <div className="p-5 space-y-2">
              {pinnedItems.length === 0 ? (
                <EmptyState label="אין פריטים מועדפים / חשובים עדיין" />
              ) : (
                <>
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-3">
                    {pinnedItems.length} פריטים מועדפים / חשובים
                  </h3>
                  {pinnedItems.map(item => (
                    <MiniItemCard key={item.id} item={item} allTopics={allTopics} />
                  ))}
                </>
              )}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mini item card ───────────────────────────────────────────────────────────

function MiniItemCard({ item, allTopics, compact = false, showDate = false }) {
  const mainTopic = allTopics.find(t => t.id === item.topicId && !t.parentId);
  const subTopic  = allTopics.find(t => t.id === item.subTopicId);
  const savedDate = (() => {
    try { return format(new Date(item.savedAt), "d בMMM", { locale: he }); } catch { return ''; }
  })();

  return (
    <div className={cn(
      'rounded-xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3',
      compact ? 'py-1.5' : 'py-2.5',
    )}>
      <div className="flex items-start gap-2 justify-between">
        <div className="flex-1 min-w-0">
          <p className={cn('font-semibold text-slate-800 dark:text-zinc-200 truncate', compact ? 'text-[11px]' : 'text-xs')}>
            {item.videoTitle || 'ללא כותרת'}
          </p>
          {!compact && item.notes && (
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 line-clamp-1 mt-0.5">
              {item.notes.slice(0, 90)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.flags?.isFavorite  && <span className="text-xs">⭐</span>}
          {item.flags?.isImportant && <span className="text-xs">🔴</span>}
          {showDate && savedDate && (
            <span className="text-[9px] text-slate-400 dark:text-zinc-600">{savedDate}</span>
          )}
        </div>
      </div>
      {!compact && (mainTopic || subTopic || (item.tags || []).length > 0) && (
        <div className="flex flex-wrap gap-1 mt-1.5 justify-end">
          {mainTopic && (
            <span className="rounded-full border border-indigo-100 bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/30 px-1.5 py-0.5 text-[9px] font-medium text-indigo-700 dark:text-indigo-400">
              {mainTopic.emoji} {mainTopic.name}
            </span>
          )}
          {subTopic && (
            <span className="rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] text-slate-600 dark:text-zinc-400">
              {subTopic.name}
            </span>
          )}
          {(item.tags || []).slice(0, 3).map(tag => (
            <span
              key={tag}
              className="rounded-full border border-indigo-100 bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/30 px-1.5 py-0.5 text-[9px] text-indigo-600 dark:text-indigo-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ label, icon }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-slate-400 dark:text-zinc-600">
      {icon || <Star className="h-10 w-10 opacity-25" />}
      <p className="text-sm">{label}</p>
    </div>
  );
}
