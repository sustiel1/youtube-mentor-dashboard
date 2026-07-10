import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { X, Trash2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import {
  normalizeStockWorkspaceItem,
  getStockDisplayNotes,
  getStockTimeline,
  SENTIMENT_DOT,
  SENTIMENT_LABEL,
} from '@/utils/workspaceStockItems';

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
  if (!sentiment) return null;
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

// ─── Single mention card ──────────────────────────────────────────────────────

function MentionCard({ item, isLatest, onDelete }) {
  const [showRaw, setShowRaw] = useState(false);

  const stock = normalizeStockWorkspaceItem(item);
  const notes = getStockDisplayNotes(stock);
  const hasRaw = stock.rawSourceText &&
    stock.rawSourceText !== notes &&
    stock.rawSourceText !== stock.fullNotes;

  const savedDate = (() => {
    try { return format(new Date(item.savedAt), "d בMMM yyyy, HH:mm", { locale: he }); }
    catch { return item.savedAt || ''; }
  })();

  const sourceText = [stock.sourceSection, stock.sourceTitle, item.sourceTab]
    .filter(Boolean).join(' · ');

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-2.5 relative group',
      isLatest
        ? 'border-teal-200 bg-teal-50/30 dark:border-teal-800/40 dark:bg-teal-950/10'
        : 'border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900/50',
    )}>

      {/* Top row: badges + date + delete */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {isLatest && (
          <span className="text-[9px] rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 border border-teal-200 dark:border-teal-800/50 px-2 py-0.5 font-bold leading-none">
            אחרון
          </span>
        )}
        <SentimentChip sentiment={stock.sentiment} />
        {stock.percentChange && (
          <span
            className={cn(
              'text-xs font-mono font-bold',
              stock.sentiment === 'negative' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
            )}
            dir="ltr"
          >
            {stock.percentChange}
          </span>
        )}
        <span className="mr-auto inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-600 shrink-0">
          <Clock className="h-3 w-3" />
          {savedDate}
        </span>
        <button
          type="button"
          onClick={() => onDelete?.(item)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:text-zinc-700 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-all"
          title="מחק אזכור זה"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Source line */}
      {sourceText && (
        <p className="text-[11px] text-slate-400 dark:text-zinc-600 leading-tight">
          {sourceText}
        </p>
      )}

      {/* Full notes */}
      {notes && (
        <p className="text-sm text-slate-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
          {notes}
        </p>
      )}

      {/* Raw source text — collapsible */}
      {hasRaw && (
        <div>
          <button
            type="button"
            onClick={() => setShowRaw(p => !p)}
            className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-slate-600 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          >
            {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            טקסט מקורי
          </button>
          {showRaw && (
            <p
              className="mt-1 text-[10px] font-mono text-slate-400 dark:text-zinc-600 bg-slate-50 dark:bg-zinc-950/60 rounded-lg px-2.5 py-2 break-all leading-relaxed"
              dir="ltr"
            >
              {stock.rawSourceText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export function StockDetailDrawer({ symbol, groupItems = [], onClose, onStatusChange, onDelete }) {
  const timeline = getStockTimeline(groupItems);
  const latestItem = timeline[0];
  const latestStock = latestItem ? normalizeStockWorkspaceItem(latestItem) : {};

  const companyName =
    latestStock.companyName ||
    groupItems.find(i => i.companyName)?.companyName ||
    null;

  const sector =
    latestStock.sector ||
    groupItems.find(i => i.sector)?.sector ||
    groupItems.find(i => i.category)?.category ||
    null;

  const latestStatus = timeline.find(i => i.marketStatus)?.marketStatus || null;

  // Escape key to close
  useEffect(() => {
    const handle = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose]);

  // Auto-close when all mentions deleted
  useEffect(() => {
    if (groupItems.length === 0) onClose?.();
  }, [groupItems.length, onClose]);

  const handleGroupStatusChange = e => {
    const newStatus = e.target.value || null;
    groupItems.forEach(item => onStatusChange?.(item.id, newStatus));
  };

  return (
    <div className="fixed inset-0 z-50" dir="rtl">

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel — fixed on visual right side */}
      <div className="absolute top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-zinc-900 shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 dark:border-zinc-800">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/60">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <span className="font-mono text-xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight" dir="ltr">
            {symbol}
          </span>

          {companyName && (
            <span className="text-sm text-slate-500 dark:text-zinc-400 truncate max-w-[160px]">
              {companyName}
            </span>
          )}

          {sector && (
            <span className="shrink-0 text-[10px] rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-0.5 text-slate-400 dark:text-zinc-500">
              {sector}
            </span>
          )}

          <span className="mr-auto shrink-0 text-xs text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 rounded-full px-2.5 py-0.5 font-medium whitespace-nowrap">
            {groupItems.length} אזכורים
          </span>
        </div>

        {/* Status editor row */}
        <div className="shrink-0 flex items-center gap-2.5 px-5 py-2.5 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/80">
          <span className="text-[11px] text-slate-400 dark:text-zinc-600 font-medium whitespace-nowrap">סטטוס:</span>
          {latestStatus && (
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', MARKET_STATUS_COLORS[latestStatus])}>
              {MARKET_STATUS_LABELS[latestStatus]}
            </span>
          )}
          <select
            value={latestStatus || ''}
            onChange={handleGroupStatusChange}
            className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-300 cursor-pointer"
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
              מחיל על כל {groupItems.length} הפריטים
            </span>
          )}
        </div>

        {/* Section label */}
        <div className="shrink-0 px-5 py-2 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/30">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-600 tracking-wider">
            ציר זמן — {timeline.length} {timeline.length === 1 ? 'אזכור' : 'אזכורים'}
          </span>
        </div>

        {/* Timeline scroll area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {timeline.map((item, idx) => (
            <MentionCard
              key={item.id}
              item={item}
              isLatest={idx === 0}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
