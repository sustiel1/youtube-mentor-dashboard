import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Trash2, Search, X as XIcon, ExternalLink, Edit2, Archive, ArchiveRestore } from 'lucide-react';
import {
  normalizeStockWorkspaceItem,
  getStockDisplayNotes,
  getStockTimeline,
  groupStockItemsBySymbol,
  SENTIMENT_DOT,
  SENTIMENT_LABEL,
} from '@/utils/workspaceStockItems';
import {
  getAvailableSectors,
  itemMatchesSector,
  itemMatchesDate,
} from '@/utils/workspaceAdvancedFilters';
import { getExternalSymbolUrl } from '@/utils/finvizLinks';
import { getManualFinvizUrl } from '@/utils/manualFinvizMappings';
import { StockDetailDrawer } from './StockDetailDrawer';
import { ConfirmDialog } from './ConfirmDialog';
import { EditWorkspaceItemModal } from './EditWorkspaceItemModal';

// ─── Finviz link resolution ───────────────────────────────────────────────────

function resolveSymbolFinvizUrl(symbol) {
  if (!symbol) return null;
  return getManualFinvizUrl(symbol) || getExternalSymbolUrl(symbol) || null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MARKET_STATUS_LABELS = {
  watchlist:       '⭐ למעקב',
  candidate:       '🎯 מועמדות',
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

const SENTIMENT_CHIP_STYLES = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50',
  negative: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50',
  neutral:  'bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
};

// ─── Sentiment chip ───────────────────────────────────────────────────────────

function SentimentChip({ sentiment }) {
  if (!sentiment) return <span className="text-slate-300 dark:text-zinc-700 text-xs">—</span>;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
      SENTIMENT_CHIP_STYLES[sentiment] || SENTIMENT_CHIP_STYLES.neutral,
    )}>
      <span className="text-[10px]">{SENTIMENT_DOT[sentiment] || '⚪'}</span>
      <span>{SENTIMENT_LABEL[sentiment] || sentiment}</span>
    </span>
  );
}

// ─── Inline mention card for symbol history view ──────────────────────────────

function HistoryMentionCard({ item, isLatest, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const stock = normalizeStockWorkspaceItem(item);
  const notes = getStockDisplayNotes(stock);

  const savedDate = (() => {
    try { return format(new Date(item.savedAt), "d בMMM yyyy, HH:mm", { locale: he }); }
    catch { return item.savedAt || ''; }
  })();

  const sourceText = [stock.sourceSection, stock.sourceTitle, item.sourceTab]
    .filter(Boolean).join(' · ');

  const notePreview = notes && !expanded ? notes.slice(0, 200) : notes;
  const hasMore = notes && notes.length > 200;

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-2 relative group',
      isLatest
        ? 'border-teal-200 bg-teal-50/30 dark:border-teal-800/40 dark:bg-teal-950/10'
        : 'border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900/50',
    )}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {isLatest && (
          <span className="text-[9px] rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 border border-teal-200 dark:border-teal-800/50 px-2 py-0.5 font-bold leading-none">
            אחרון
          </span>
        )}
        <SentimentChip sentiment={stock.sentiment} />
        {stock.marketStatus && MARKET_STATUS_COLORS[stock.marketStatus] && (
          <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap', MARKET_STATUS_COLORS[stock.marketStatus])}>
            {MARKET_STATUS_LABELS[stock.marketStatus]}
          </span>
        )}
        <span className="mr-auto text-[10px] text-slate-400 dark:text-zinc-600">{savedDate}</span>
        <button
          type="button"
          onClick={() => onDelete?.(item)}
          className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:text-zinc-600 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-all"
          title="מחק אזכור"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {sourceText && (
        <p className="text-[11px] text-slate-400 dark:text-zinc-600 leading-tight">{sourceText}</p>
      )}
      {notes && (
        <div>
          <p className="text-sm text-slate-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {notePreview}{hasMore && !expanded ? '…' : ''}
          </p>
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(p => !p)}
              className="mt-1 text-[11px] text-teal-600 dark:text-teal-400 hover:underline"
            >
              {expanded ? '↑ הצג פחות' : '↓ הצג עוד'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inline symbol history view ───────────────────────────────────────────────

function SymbolHistoryInlineView({ symbol, groupItems, onStatusChange, onBack, onDelete }) {
  const timeline = getStockTimeline(groupItems);
  const latestItem = timeline[0];
  const latestStock = latestItem ? normalizeStockWorkspaceItem(latestItem) : {};

  const companyName =
    latestStock.companyName ||
    groupItems.find(i => i.companyName)?.companyName ||
    null;

  const latestStatus = timeline.find(i => i.marketStatus)?.marketStatus || null;

  const handleGroupStatusChange = e => {
    const newStatus = e.target.value || null;
    groupItems.forEach(item => onStatusChange?.(item.id, newStatus));
  };

  return (
    <div className="space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors whitespace-nowrap"
        >
          → חזרה לטבלה
        </button>
        <span className="font-mono text-xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight" dir="ltr">
          {symbol}
        </span>
        {companyName && (
          <span className="text-sm text-slate-500 dark:text-zinc-400 truncate max-w-[180px]">{companyName}</span>
        )}
        <span className="text-[11px] text-slate-400 dark:text-zinc-600 bg-slate-100 dark:bg-zinc-800 rounded-full px-3 py-1 whitespace-nowrap">
          היסטוריה — {timeline.length} {timeline.length === 1 ? 'שמירה' : 'שמירות'}
        </span>
        <div className="flex items-center gap-2 mr-auto flex-wrap">
          <span className="text-[11px] text-slate-400 dark:text-zinc-600 whitespace-nowrap">סטטוס:</span>
          <select
            value={latestStatus || ''}
            onChange={handleGroupStatusChange}
            className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-300 cursor-pointer"
          >
            <option value="">ללא סטטוס</option>
            <option value="watchlist">⭐ למעקב</option>
            <option value="candidate">🎯 מועמדות</option>
            <option value="before_earnings">📋 לפני דוחות</option>
            <option value="risk">⚠️ בסיכון</option>
            <option value="archive">📦 ארכיון</option>
          </select>
          {groupItems.length > 1 && (
            <span className="text-[10px] text-slate-300 dark:text-zinc-700 whitespace-nowrap">
              מחיל על {groupItems.length} פריטים
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {timeline.map((item, idx) => (
          <HistoryMentionCard
            key={item.id}
            item={item}
            isLatest={idx === 0}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Aggregated row (one per symbol) ─────────────────────────────────────────

function AggregatedStockRow({
  symbol, groupItems, onStatusChange, onOpenDrawer,
  selected, onToggleSelect, onRequestEdit, onRequestDelete, onArchiveItems,
}) {
  const timeline = useMemo(() => getStockTimeline(groupItems), [groupItems]);
  const latest = timeline[0];
  const latestStock = useMemo(
    () => (latest ? normalizeStockWorkspaceItem(latest) : {}),
    [latest],
  );

  const companyName =
    latestStock.companyName ||
    groupItems.find(i => i.companyName)?.companyName ||
    null;

  const sector =
    latestStock.sector ||
    groupItems.find(i => i.sector)?.sector ||
    groupItems.find(i => i.category)?.category ||
    null;

  const latestStatus   = timeline.find(i => i.marketStatus)?.marketStatus || null;
  const latestNote     = getStockDisplayNotes(latestStock);
  const mentionCount   = groupItems.length;
  const finvizUrl      = resolveSymbolFinvizUrl(symbol);

  const latestSource =
    latestStock.sourceTitle ||
    latestStock.sourceSection ||
    latest?.sourceTab ||
    null;

  const savedDate = (() => {
    try { return format(new Date(latest?.savedAt), "d בMMM", { locale: he }); }
    catch { return ''; }
  })();

  const singleItem = groupItems.length === 1 ? groupItems[0] : null;

  const handleRowClick = () => onOpenDrawer(symbol);

  const handleStatusChange = e => {
    e.stopPropagation();
    const newStatus = e.target.value || null;
    groupItems.forEach(item => onStatusChange?.(item.id, newStatus));
  };

  return (
    <tr
      className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-900/40 transition-colors group cursor-pointer"
      onClick={handleRowClick}
    >
      {/* Col 0 — Select (only unambiguous for single-mention groups) */}
      <td className="py-3 px-2 align-top" onClick={e => e.stopPropagation()}>
        {singleItem ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(singleItem.id)}
            className="h-4 w-4 rounded border-slate-300 dark:border-zinc-600 text-teal-600 focus:ring-teal-400 cursor-pointer"
          />
        ) : (
          <span title="פתח כדי לבחור אזכורים בודדים" className="block h-4 w-4 rounded border border-dashed border-slate-200 dark:border-zinc-700" />
        )}
      </td>

      {/* Col 1 — Symbol / Company / Sector */}
      <td className="py-3 px-4 align-top whitespace-nowrap" dir="ltr">
        <div className="flex flex-col items-start gap-0.5">
          {finvizUrl ? (
            <a
              href={finvizUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title={`פתח ${symbol} ב-Finviz`}
              className="inline-flex items-center gap-0.5 font-mono text-[15px] font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight leading-none hover:text-teal-600 dark:hover:text-teal-400 hover:underline underline-offset-2 transition-colors"
            >
              {symbol}
              <ExternalLink className="h-3 w-3 opacity-40" />
            </a>
          ) : (
            <span className="font-mono text-[15px] font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight leading-none">
              {symbol}
            </span>
          )}
          {companyName && (
            <span className="text-[11px] text-slate-500 dark:text-zinc-500 max-w-[130px] truncate mt-0.5 leading-tight" dir="rtl" title={companyName}>
              {companyName}
            </span>
          )}
          {sector && (
            <span className="mt-1 text-[9px] rounded-md border border-slate-200 dark:border-zinc-700 px-1.5 py-0.5 text-slate-400 dark:text-zinc-500 font-medium" dir="rtl">
              {sector}
            </span>
          )}
        </div>
      </td>

      {/* Col 2 — Latest sentiment */}
      <td className="py-3 px-3 align-top text-right whitespace-nowrap">
        <SentimentChip sentiment={latestStock.sentiment} />
      </td>

      {/* Col 3 — Status */}
      <td className="py-3 px-3 align-top text-right" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-end gap-1">
          {latestStatus && (
            <span className={cn(
              'inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap',
              MARKET_STATUS_COLORS[latestStatus],
            )}>
              {MARKET_STATUS_LABELS[latestStatus]}
            </span>
          )}
          <select
            value={latestStatus || ''}
            onChange={handleStatusChange}
            className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-[10px] text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-300 min-w-[92px] cursor-pointer"
          >
            <option value="">ללא סטטוס</option>
            <option value="watchlist">⭐ למעקב</option>
            <option value="candidate">🎯 מועמדות</option>
            <option value="before_earnings">📋 לפני דוחות</option>
            <option value="risk">⚠️ בסיכון</option>
            <option value="archive">📦 ארכיון</option>
          </select>
        </div>
      </td>

      {/* Col 4 — Mention count */}
      <td className="py-3 px-3 align-top text-center whitespace-nowrap">
        <span className={cn(
          'inline-flex items-center justify-center rounded-full text-xs font-bold px-2 py-0.5 min-w-[28px] border',
          mentionCount > 1
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50'
            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700',
        )}>
          {mentionCount}
        </span>
        {mentionCount > 1 && (
          <span className="block text-[9px] text-slate-400 dark:text-zinc-600 mt-0.5 text-center">
            אזכורים
          </span>
        )}
      </td>

      {/* Col 5 — Latest note preview */}
      <td className="py-3 px-3 align-top max-w-[280px] text-right">
        {latestNote ? (
          <p className="text-sm text-slate-700 dark:text-zinc-300 leading-snug break-words line-clamp-2" dir="rtl">
            {latestNote}
          </p>
        ) : (
          <span className="text-slate-300 dark:text-zinc-700 text-xs">—</span>
        )}
      </td>

      {/* Col 6 — Source / Date */}
      <td className="py-3 px-3 align-top min-w-[110px] text-right">
        <div className="flex flex-col gap-0.5 items-end">
          {latestSource && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-600 max-w-[130px] truncate" title={latestSource} dir="rtl">
              {latestSource}
            </span>
          )}
          {savedDate && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-600">{savedDate}</span>
          )}
        </div>
      </td>

      {/* Col 7 — Actions */}
      <td className="py-3 px-2 align-top text-right" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1 transition-opacity">
          {singleItem && (
            <button
              type="button"
              onClick={() => onRequestEdit(singleItem)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:text-zinc-600 dark:hover:text-teal-400 dark:hover:bg-teal-950/20 transition-colors"
              title="ערוך"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onArchiveItems(groupItems.map(i => i.id), true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:text-zinc-600 dark:hover:text-amber-400 dark:hover:bg-amber-950/20 transition-colors"
            title="ארכיון"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
          {singleItem && (
            <button
              type="button"
              onClick={() => onRequestDelete(singleItem)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:text-zinc-600 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-colors"
              title="מחק"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleRowClick}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:border-teal-400 hover:text-teal-600 dark:hover:border-teal-600 dark:hover:text-teal-400 transition-all whitespace-nowrap"
          >
            <ExternalLink className="h-3 w-3" />
            פתח
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Fallback row for items with no resolvable symbol ────────────────────────

function FallbackStockRow({ item, selected, onToggleSelect, onRequestEdit, onRequestDelete, onArchiveItems }) {
  const stock = normalizeStockWorkspaceItem(item);
  const notes = getStockDisplayNotes(stock);

  const savedDate = (() => {
    try { return format(new Date(item.savedAt), "d בMMM", { locale: he }); }
    catch { return ''; }
  })();

  const preview = notes
    ? notes.slice(0, 90) + (notes.length > 90 ? '…' : '')
    : item.videoTitle?.slice(0, 90) || '—';

  return (
    <tr className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/40 dark:hover:bg-zinc-900/30 transition-colors group">
      <td className="py-2.5 px-2 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(item.id)}
          className="h-4 w-4 rounded border-slate-300 dark:border-zinc-600 text-teal-600 focus:ring-teal-400 cursor-pointer"
        />
      </td>
      <td className="py-2.5 px-4 align-middle" colSpan={6} dir="rtl">
        <span className="text-sm text-slate-600 dark:text-zinc-400 break-words">
          {preview}
        </span>
        {savedDate && (
          <span className="mr-3 text-[10px] text-slate-400 dark:text-zinc-600">{savedDate}</span>
        )}
      </td>
      <td className="py-2.5 px-2 align-middle text-right">
        <div className="flex items-center justify-end gap-1 transition-opacity">
          <button
            type="button"
            onClick={() => onRequestEdit(item)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-teal-600 hover:bg-teal-50 dark:text-zinc-700 dark:hover:text-teal-400 dark:hover:bg-teal-950/20 transition-all"
            title="ערוך"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onArchiveItems([item.id], true)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:text-zinc-700 dark:hover:text-amber-400 dark:hover:bg-amber-950/20 transition-all"
            title="ארכיון"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRequestDelete(item)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:text-zinc-700 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-all"
            title="מחק"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function StockWatchlistView({
  items = [], filterMarketStatus, onStatusChange, onDelete,
  onUpdateItem, onDeleteItems, onArchiveItems, onUpdateItemsBulk,
}) {
  const [stockSearch,      setStockSearch]      = useState('');
  const [filterSentiment,  setFilterSentiment]  = useState('');
  const [filterSource,     setFilterSource]     = useState('');
  const [drawerSymbol,     setDrawerSymbol]     = useState(null);
  const [showArchived,     setShowArchived]     = useState(false);
  const [selectedIds,      setSelectedIds]      = useState(() => new Set());
  const [editingItem,      setEditingItem]      = useState(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkStatusValue,  setBulkStatusValue]  = useState('');
  const [filterSector,    setFilterSector]    = useState('');
  const [filterDateRange, setFilterDateRange] = useState('');

  // Archived items are hidden from the active view by default — additive
  // field, items without archivedAt are treated as active.
  const visibleItems = useMemo(
    () => items.filter(i => (showArchived ? !!i.archivedAt : !i.archivedAt)),
    [items, showArchived],
  );
  const archivedCount = useMemo(() => items.filter(i => !!i.archivedAt).length, [items]);

  // Group items by symbol (pure display-level — no data modification)
  const { groups, unsymbolized } = useMemo(
    () => groupStockItemsBySymbol(visibleItems),
    [visibleItems],
  );

  // Drawer items react to item changes (e.g. after deletion)
  const drawerItems = useMemo(
    () => (drawerSymbol ? groups.get(drawerSymbol) || [] : []),
    [drawerSymbol, groups],
  );

  // Auto-close drawer if its group becomes empty
  useEffect(() => {
    if (drawerSymbol && drawerItems.length === 0) setDrawerSymbol(null);
  }, [drawerItems.length, drawerSymbol]);

  // Available sources across all items
  const availableSources = useMemo(() => {
    const seen = new Set();
    visibleItems.forEach(item => {
      const stock = normalizeStockWorkspaceItem(item);
      const src = stock.sourceTitle || stock.sourceSection;
      if (src) seen.add(src);
    });
    return [...seen].sort();
  }, [visibleItems]);

  const availableSectors = useMemo(() => getAvailableSectors(visibleItems), [visibleItems]);

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const clearSelection = () => setSelectedIds(new Set());

  function handleArchive(ids, archived = true) {
    onArchiveItems?.(ids, archived);
    toast.success(archived ? `${ids.length > 1 ? `${ids.length} פריטים הועברו` : 'הפריט הועבר'} לארכיון` : 'הפריט שוחזר מהארכיון');
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  }

  function handleConfirmSingleDelete() {
    if (!confirmDeleteItem) return;
    onDelete?.(confirmDeleteItem);
    toast.success('הפריט נמחק מ-Workspace');
    setSelectedIds(prev => { const next = new Set(prev); next.delete(confirmDeleteItem.id); return next; });
  }

  function handleConfirmBulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    onDeleteItems?.(ids);
    toast.success(`${ids.length} פריטים נמחקו מ-Workspace`);
    clearSelection();
  }

  function applyBulkStatus() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    onUpdateItemsBulk?.(ids, { marketStatus: bulkStatusValue || null });
    toast.success(`סטטוס עודכן ל-${ids.length} פריטים`);
    setBulkStatusValue('');
  }

  // Filtered + sorted symbol groups
  const filteredGroups = useMemo(() => {
    const result = [];

    for (const [sym, groupItems] of groups) {
      const timeline = getStockTimeline(groupItems);
      const latest = timeline[0];
      if (!latest) continue;
      const latestStock = normalizeStockWorkspaceItem(latest);

      // Text search across symbol, company, and every note in the group
      if (stockSearch) {
        const q = stockSearch.toLowerCase();
        const anyMatch = groupItems.some(item => {
          const s = normalizeStockWorkspaceItem(item);
          return [sym, s.companyName, s.notes, s.fullNotes, s.rawSourceText]
            .filter(Boolean)
            .some(v => v.toLowerCase().includes(q));
        });
        if (!anyMatch) continue;
      }

      // Sentiment filter on the latest mention
      if (filterSentiment) {
        const s = latestStock.sentiment || null;
        if (filterSentiment === 'neutral') {
          if (s && s !== 'neutral') continue;
        } else if (s !== filterSentiment) {
          continue;
        }
      }

      // Source filter across any mention in the group
      if (filterSource) {
        const anySourceMatch = groupItems.some(item => {
          const st = normalizeStockWorkspaceItem(item);
          return (st.sourceTitle || st.sourceSection || '').includes(filterSource);
        });
        if (!anySourceMatch) continue;
      }

      // Sector filter across any mention in the group
      if (filterSector) {
        const anySectorMatch = groupItems.some(item => itemMatchesSector(item, filterSector));
        if (!anySectorMatch) continue;
      }

      // Date filter — any mention within range qualifies the group
      if (filterDateRange) {
        const anyDateMatch = groupItems.some(item => itemMatchesDate(item, filterDateRange));
        if (!anyDateMatch) continue;
      }

      result.push({ symbol: sym, groupItems, latest });
    }

    // Sort by newest savedAt
    result.sort((a, b) => new Date(b.latest?.savedAt || 0) - new Date(a.latest?.savedAt || 0));
    return result;
  }, [groups, stockSearch, filterSentiment, filterSource, filterSector, filterDateRange]);

  const hasActiveFilters = !!(stockSearch || filterSentiment || filterSource || filterSector || filterDateRange);
  const totalStocks      = groups.size;
  const shownStocks      = filteredGroups.length;

  const clearFilters = () => {
    setStockSearch('');
    setFilterSentiment('');
    setFilterSource('');
    setFilterSector('');
    setFilterDateRange('');
  };

  // Show inline history timeline when search narrows to exactly one matching symbol
  const isSymbolHistoryMode =
    filteredGroups.length === 1 &&
    stockSearch.trim() !== '' &&
    filteredGroups[0].symbol.toLowerCase().startsWith(stockSearch.trim().toLowerCase());

  return (
    <div className="space-y-3" dir="rtl">

      {/* ─── Filters bar ─── */}
      <div className="flex flex-wrap items-center gap-2">

        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-600 pointer-events-none" />
          <input
            value={stockSearch}
            onChange={e => setStockSearch(e.target.value)}
            placeholder="סימול / חברה / הערות..."
            dir="rtl"
            className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pr-8 pl-3 py-1.5 text-xs text-right placeholder:text-slate-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200 min-w-[190px]"
          />
        </div>

        <select
          value={filterSentiment}
          onChange={e => setFilterSentiment(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-300 cursor-pointer"
        >
          <option value="">כל הסנטימנטים</option>
          <option value="positive">🟢 חיובי</option>
          <option value="negative">🔴 שלילי</option>
          <option value="neutral">⚪ ניטרלי</option>
        </select>

        {availableSources.length > 1 && (
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-300 max-w-[200px] cursor-pointer"
          >
            <option value="">כל המקורות</option>
            {availableSources.map(src => (
              <option key={src} value={src}>{src}</option>
            ))}
          </select>
        )}

        {availableSectors.length > 1 && (
          <select
            value={filterSector}
            onChange={e => setFilterSector(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-300 max-w-[160px] cursor-pointer"
          >
            <option value="">כל הסקטורים</option>
            {availableSectors.map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
        )}

        <select
          value={filterDateRange}
          onChange={e => setFilterDateRange(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-300 cursor-pointer"
        >
          <option value="">כל התאריכים</option>
          <option value="today">היום</option>
          <option value="week">השבוע</option>
          <option value="month">החודש</option>
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
          >
            <XIcon className="h-3 w-3" />
            נקה סינון
          </button>
        )}

        {archivedCount > 0 && (
          <button
            type="button"
            onClick={() => { setShowArchived(p => !p); clearSelection(); }}
            className={cn(
              'inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors',
              showArchived
                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                : 'border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-amber-600 dark:text-zinc-500 dark:hover:text-amber-400',
            )}
          >
            {showArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
            {showArchived ? 'חזרה לפעילים' : `ארכיון (${archivedCount})`}
          </button>
        )}

        <span className="mr-auto text-[11px] text-slate-400 dark:text-zinc-600 whitespace-nowrap">
          {shownStocks === totalStocks
            ? `${totalStocks} ${totalStocks === 1 ? 'מניה' : 'מניות'}`
            : `${shownStocks} מתוך ${totalStocks}`}
          {unsymbolized.length > 0 && (
            <span className="mr-1 opacity-60">+ {unsymbolized.length} ללא סימול</span>
          )}
        </span>
      </div>

      {/* ─── Active filter chips ─── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 items-center" dir="rtl">
          <span className="text-[10px] text-slate-400 dark:text-zinc-600 font-medium shrink-0 ml-1">פעיל:</span>
          {stockSearch && (
            <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 dark:border-teal-800/50 dark:bg-teal-950/20 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
              🔍 {stockSearch}
              <button type="button" onClick={() => setStockSearch('')} className="text-teal-500 hover:text-teal-700 dark:text-teal-400 leading-none ml-0.5">×</button>
            </span>
          )}
          {filterSentiment && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
              {filterSentiment === 'positive' ? '🟢 חיובי' : filterSentiment === 'negative' ? '🔴 שלילי' : '⚪ ניטרלי'}
              <button type="button" onClick={() => setFilterSentiment('')} className="text-slate-400 hover:text-red-500 dark:text-zinc-600 leading-none ml-0.5">×</button>
            </span>
          )}
          {filterSector && (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 dark:border-violet-800/50 dark:bg-violet-950/20 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
              סקטור: {filterSector}
              <button type="button" onClick={() => setFilterSector('')} className="text-violet-500 hover:text-violet-700 dark:text-violet-400 leading-none ml-0.5">×</button>
            </span>
          )}
          {filterSource && (
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 dark:border-indigo-800/50 dark:bg-indigo-950/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
              מקור: {filterSource}
              <button type="button" onClick={() => setFilterSource('')} className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 leading-none ml-0.5">×</button>
            </span>
          )}
          {filterDateRange && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {filterDateRange === 'today' ? 'היום' : filterDateRange === 'week' ? 'השבוע' : 'החודש'}
              <button type="button" onClick={() => setFilterDateRange('')} className="text-amber-500 hover:text-amber-700 dark:text-amber-400 leading-none ml-0.5">×</button>
            </span>
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] text-slate-400 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 hover:underline mr-1"
          >
            נקה הכל
          </button>
        </div>
      )}

      {/* ─── Bulk actions bar ─── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-200 dark:border-teal-800/50 bg-teal-50/70 dark:bg-teal-950/20 px-3 py-2" dir="rtl">
          <span className="text-xs font-bold text-teal-800 dark:text-teal-300">
            נבחרו {selectedIds.size} פריטים
          </span>

          <div className="flex items-center gap-1.5">
            <select
              value={bulkStatusValue}
              onChange={e => setBulkStatusValue(e.target.value)}
              className="rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200"
            >
              <option value="">ערוך מסומנים — קבע סטטוס...</option>
              <option value="watchlist">⭐ למעקב</option>
              <option value="candidate">🎯 מועמדות</option>
              <option value="before_earnings">📋 לפני דוחות</option>
              <option value="risk">⚠️ בסיכון</option>
            </select>
            <button
              type="button"
              onClick={applyBulkStatus}
              disabled={!bulkStatusValue}
              className="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              החל
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleArchive([...selectedIds], true)}
            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/40"
          >
            <Archive className="h-3 w-3" />
            ארכיון מסומנים
          </button>

          <button
            type="button"
            onClick={() => setConfirmBulkDelete(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3 w-3" />
            מחק מסומנים
          </button>

          <button
            type="button"
            onClick={clearSelection}
            className="mr-auto text-xs text-teal-600 dark:text-teal-400 hover:underline"
          >
            נקה בחירה
          </button>
        </div>
      )}

      {/* ─── Empty state ─── */}
      {filteredGroups.length === 0 && unsymbolized.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-zinc-600">
          <span className="text-4xl opacity-20">📈</span>
          <p className="text-sm font-medium">
            {hasActiveFilters
              ? 'לא נמצאו שמירות לפי הסינון הזה'
              : filterMarketStatus
                ? 'אין עדיין מניות בטאב הזה'
                : 'לא נמצאו מניות בנושא הנוכחי'}
          </p>
          {hasActiveFilters ? (
            <div className="flex flex-col items-center gap-1.5">
              <button type="button" onClick={clearFilters} className="text-xs text-teal-600 dark:text-teal-400 hover:underline">
                נקה סינון
              </button>
            </div>
          ) : (
            <p className="text-xs text-center max-w-xs">
              שמור שורות מניות מ"מניות שהוזכרו" כדי לראות אותן כאן
            </p>
          )}
        </div>
      ) : isSymbolHistoryMode ? (
        <SymbolHistoryInlineView
          symbol={filteredGroups[0].symbol}
          groupItems={filteredGroups[0].groupItems}
          onStatusChange={onStatusChange}
          onBack={() => setStockSearch('')}
          onDelete={item => setConfirmDeleteItem(item)}
        />
      ) : (

        /* ─── Table ─── */
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900" dir="rtl">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-900/80">
                <th className="py-2.5 px-2 w-8" />
                <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                  סימול / חברה
                </th>
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                  סנטימנט
                </th>
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                  סטטוס
                </th>
                <th className="py-2.5 px-3 text-center text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                  אזכורים
                </th>
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500">
                  הערה אחרונה
                </th>
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                  מקור / תאריך
                </th>
                <th className="py-2.5 px-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map(({ symbol, groupItems }) => (
                <AggregatedStockRow
                  key={symbol}
                  symbol={symbol}
                  groupItems={groupItems}
                  onStatusChange={onStatusChange}
                  onOpenDrawer={setDrawerSymbol}
                  selected={groupItems.length === 1 && selectedIds.has(groupItems[0].id)}
                  onToggleSelect={toggleSelect}
                  onRequestEdit={setEditingItem}
                  onRequestDelete={setConfirmDeleteItem}
                  onArchiveItems={handleArchive}
                />
              ))}

              {/* Unsymbolized fallback section */}
              {unsymbolized.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={8}
                      className="py-2 px-4 text-[10px] font-semibold text-slate-400 dark:text-zinc-600 bg-slate-50/60 dark:bg-zinc-900/60 border-y border-slate-100 dark:border-zinc-800 tracking-wider"
                    >
                      ללא סימול — {unsymbolized.length} {unsymbolized.length === 1 ? 'פריט' : 'פריטים'}
                    </td>
                  </tr>
                  {unsymbolized.map(item => (
                    <FallbackStockRow
                      key={item.id}
                      item={item}
                      selected={selectedIds.has(item.id)}
                      onToggleSelect={toggleSelect}
                      onRequestEdit={setEditingItem}
                      onRequestDelete={setConfirmDeleteItem}
                      onArchiveItems={handleArchive}
                    />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Stock detail drawer ─── */}
      {drawerSymbol && (
        <StockDetailDrawer
          symbol={drawerSymbol}
          groupItems={drawerItems}
          onClose={() => setDrawerSymbol(null)}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          onUpdateItem={onUpdateItem}
          onArchiveItems={handleArchive}
        />
      )}

      {/* ─── Single-item delete confirmation ─── */}
      <ConfirmDialog
        open={!!confirmDeleteItem}
        onOpenChange={open => !open && setConfirmDeleteItem(null)}
        title="למחוק את הפריט הזה מה-Workspace?"
        description="הפריט יימחק מ-Workspace בלבד. Brain / KnowledgeItems והסרטון המקורי לא יושפעו."
        confirmLabel="מחק"
        danger
        onConfirm={handleConfirmSingleDelete}
      />

      {/* ─── Bulk delete confirmation ─── */}
      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        title={`למחוק ${selectedIds.size} פריטים מסומנים מה-Workspace?`}
        description="הפעולה לא משפיעה על Brain / KnowledgeItems — היא מוחקת רק מה-Workspace."
        confirmLabel="מחק מסומנים"
        danger
        onConfirm={handleConfirmBulkDelete}
      />

      {/* ─── Edit modal ─── */}
      <EditWorkspaceItemModal
        item={editingItem}
        onOpenChange={open => !open && setEditingItem(null)}
        onSave={(id, updates) => {
          onUpdateItem?.(id, updates);
          toast.success('הפריט עודכן');
          setEditingItem(null);
        }}
      />
    </div>
  );
}
