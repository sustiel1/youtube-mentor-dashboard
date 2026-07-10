import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Trash2, ChevronDown, ChevronUp, Search, X as XIcon } from 'lucide-react';
import {
  normalizeStockWorkspaceItem,
  getStockDisplayNotes,
  SENTIMENT_DOT,
  SENTIMENT_LABEL,
} from '@/utils/workspaceStockItems';

// ─── Status constants ─────────────────────────────────────────────────────────

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

// ─── Sentiment chip ───────────────────────────────────────────────────────────

function SentimentChip({ sentiment }) {
  if (!sentiment) return <span className="text-slate-300 dark:text-zinc-700 text-xs">—</span>;
  const styles = {
    positive: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50',
    negative: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50',
    neutral:  'bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
      styles[sentiment] || styles.neutral,
    )}>
      <span className="text-[10px]">{SENTIMENT_DOT[sentiment] || '⚪'}</span>
      <span>{SENTIMENT_LABEL[sentiment] || sentiment}</span>
    </span>
  );
}

// ─── Expanded detail panel ────────────────────────────────────────────────────

function ExpandedDetail({ stock, item }) {
  const savedAtFormatted = (() => {
    try { return format(new Date(item.savedAt), "d בMMM yyyy, HH:mm", { locale: he }); }
    catch { return item.savedAt || '—'; }
  })();

  const sector = stock.sector || item.category || item.subCategory || null;

  const metaFields = [
    ['מקור — קטע',  stock.sourceSection],
    ['מקור — כותרת', stock.sourceTitle],
    ['טאב מקור',    item.sourceTab],
    ['נשמר ב',      savedAtFormatted],
    ['סטטוס',       item.marketStatus ? MARKET_STATUS_LABELS[item.marketStatus] : null],
    ['סקטור',       sector],
  ].filter(([, v]) => v);

  return (
    <div className="space-y-3" dir="rtl">
      {/* Symbol header */}
      <div className="flex flex-wrap items-center gap-2">
        {stock.symbol && (
          <span className="font-mono text-lg font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight" dir="ltr">
            {stock.symbol}
          </span>
        )}
        {stock.companyName && (
          <span className="text-sm text-slate-600 dark:text-zinc-400">{stock.companyName}</span>
        )}
        {sector && (
          <span className="rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2 py-0.5 text-[10px] text-slate-500 dark:text-zinc-400">
            {sector}
          </span>
        )}
        <SentimentChip sentiment={stock.sentiment} />
        {item.marketStatus && (
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', MARKET_STATUS_COLORS[item.marketStatus])}>
            {MARKET_STATUS_LABELS[item.marketStatus]}
          </span>
        )}
        {stock.percentChange && (
          <span className={cn(
            'font-mono text-sm font-bold',
            stock.sentiment === 'negative' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
          )} dir="ltr">
            {stock.percentChange}
          </span>
        )}
      </div>

      {/* Full notes */}
      {(stock.fullNotes || stock.notes) && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 mb-1.5">הערה מלאה</p>
          <p className="text-sm text-slate-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap bg-white dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800 px-3 py-2.5">
            {stock.fullNotes || stock.notes}
          </p>
        </div>
      )}

      {/* Raw source text if meaningfully different */}
      {stock.rawSourceText &&
        stock.rawSourceText !== stock.fullNotes &&
        stock.rawSourceText !== stock.notes && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 mb-1">טקסט מקורי</p>
          <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-900/80 rounded-lg border border-slate-100 dark:border-zinc-800 px-3 py-2 break-all" dir="ltr">
            {stock.rawSourceText}
          </p>
        </div>
      )}

      {/* Metadata grid */}
      {metaFields.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
          {metaFields.map(([label, value]) => (
            <div key={label} className="text-[11px]">
              <span className="text-slate-400 dark:text-zinc-600 ml-1">{label}:</span>
              <span className="text-slate-700 dark:text-zinc-300">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single stock row ─────────────────────────────────────────────────────────

function StockRow({ item, onStatusChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const stock = normalizeStockWorkspaceItem(item);
  const notes = getStockDisplayNotes(stock);
  const sector = stock.sector || item.category || item.subCategory || null;
  const notesIsLong = notes && notes.length > 80;

  const savedDate = (() => {
    try { return format(new Date(item.savedAt), "d בMMM", { locale: he }); }
    catch { return ''; }
  })();

  return (
    <>
      <tr className={cn(
        'border-b border-slate-100 dark:border-zinc-800 transition-colors group',
        expanded
          ? 'bg-slate-50/80 dark:bg-zinc-900/60'
          : 'hover:bg-slate-50/60 dark:hover:bg-zinc-900/40',
      )}>

        {/* Col 1 — Symbol / Company / Sector */}
        <td className="py-3 px-4 align-top whitespace-nowrap" dir="ltr">
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-mono text-[15px] font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight leading-none">
              {stock.symbol || '—'}
            </span>
            {stock.companyName && (
              <span
                className="text-[11px] text-slate-500 dark:text-zinc-500 max-w-[130px] truncate leading-tight mt-0.5"
                dir="rtl"
                title={stock.companyName}
              >
                {stock.companyName}
              </span>
            )}
            {sector && (
              <span
                className="mt-1 text-[9px] rounded-md border border-slate-200 dark:border-zinc-700 px-1.5 py-0.5 text-slate-400 dark:text-zinc-500 font-medium leading-none"
                dir="rtl"
              >
                {sector}
              </span>
            )}
          </div>
        </td>

        {/* Col 2 — Sentiment */}
        <td className="py-3 px-3 align-top text-right whitespace-nowrap">
          <SentimentChip sentiment={stock.sentiment} />
        </td>

        {/* Col 3 — Status (chip + select) */}
        <td className="py-3 px-3 align-top text-right">
          <div className="flex flex-col items-end gap-1">
            {item.marketStatus && (
              <span className={cn(
                'inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap',
                MARKET_STATUS_COLORS[item.marketStatus],
              )}>
                {MARKET_STATUS_LABELS[item.marketStatus]}
              </span>
            )}
            <select
              value={item.marketStatus || ''}
              onChange={e => onStatusChange?.(item.id, e.target.value || null)}
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

        {/* Col 4 — % Change */}
        <td className="py-3 px-3 align-top whitespace-nowrap text-right" dir="ltr">
          {stock.percentChange ? (
            <span className={cn(
              'text-sm font-mono font-bold',
              stock.sentiment === 'negative' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
            )}>
              {stock.percentChange}
            </span>
          ) : (
            <span className="text-slate-300 dark:text-zinc-700 text-xs">—</span>
          )}
        </td>

        {/* Col 5 — Notes */}
        <td className="py-3 px-3 align-top max-w-[300px] text-right">
          {notes ? (
            <div dir="rtl">
              <p className={cn(
                'text-sm text-slate-700 dark:text-zinc-300 leading-snug break-words',
                !expanded && 'line-clamp-3',
              )}>
                {notes}
              </p>
              {notesIsLong && (
                <button
                  type="button"
                  onClick={() => setExpanded(p => !p)}
                  className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-teal-600 dark:text-teal-400 hover:underline"
                >
                  {expanded
                    ? <><ChevronUp className="h-3 w-3" />סגור</>
                    : <><ChevronDown className="h-3 w-3" />פתח פרטים</>
                  }
                </button>
              )}
            </div>
          ) : (
            <span className="text-slate-300 dark:text-zinc-700 text-xs">—</span>
          )}
        </td>

        {/* Col 6 — Source / Date */}
        <td className="py-3 px-3 align-top min-w-[110px] text-right">
          <div className="flex flex-col gap-0.5 items-end">
            {stock.sourceTitle && (
              <span
                className="text-[10px] text-slate-400 dark:text-zinc-600 max-w-[130px] truncate"
                title={stock.sourceTitle}
                dir="rtl"
              >
                {stock.sourceTitle}
              </span>
            )}
            {savedDate && (
              <span className="text-[10px] text-slate-400 dark:text-zinc-600">{savedDate}</span>
            )}
            {item.sourceTab && (
              <span className="text-[9px] rounded border border-slate-100 dark:border-zinc-800 px-1 py-0.5 text-slate-400 dark:text-zinc-600">
                {item.sourceTab}
              </span>
            )}
          </div>
        </td>

        {/* Col 7 — Delete */}
        <td className="py-3 px-2 align-top">
          <button
            type="button"
            onClick={() => onDelete?.(item)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:text-zinc-700 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-all"
            title="מחק"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-slate-50/60 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-700">
          <td colSpan={7} className="px-6 py-4">
            <ExpandedDetail stock={stock} item={item} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function StockWatchlistView({ items = [], filterMarketStatus, onStatusChange, onDelete }) {
  const [stockSearch, setStockSearch] = useState('');
  const [filterSentiment, setFilterSentiment] = useState('');
  const [filterSource, setFilterSource] = useState('');

  // Collect available sources from the items
  const availableSources = useMemo(() => {
    const seen = new Set();
    items.forEach(item => {
      const stock = normalizeStockWorkspaceItem(item);
      const src = stock.sourceTitle || stock.sourceSection;
      if (src) seen.add(src);
    });
    return [...seen].sort();
  }, [items]);

  // Local filtering (stacked on top of parent's marketStatus filter)
  const filteredStocks = useMemo(() => {
    if (!stockSearch && !filterSentiment && !filterSource) return items;
    return items.filter(item => {
      const stock = normalizeStockWorkspaceItem(item);
      if (stockSearch) {
        const q = stockSearch.toLowerCase();
        const searchable = [
          stock.symbol,
          stock.companyName,
          stock.notes,
          stock.fullNotes,
          stock.rawSourceText,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filterSentiment) {
        const s = stock.sentiment || null;
        if (filterSentiment === 'neutral') {
          if (s && s !== 'neutral') return false;
        } else if (s !== filterSentiment) {
          return false;
        }
      }
      if (filterSource) {
        const stock2 = normalizeStockWorkspaceItem(item);
        const src = stock2.sourceTitle || stock2.sourceSection || '';
        if (!src.includes(filterSource)) return false;
      }
      return true;
    });
  }, [items, stockSearch, filterSentiment, filterSource]);

  const hasActiveFilters = !!(stockSearch || filterSentiment || filterSource);

  const clearFilters = () => {
    setStockSearch('');
    setFilterSentiment('');
    setFilterSource('');
  };

  return (
    <div className="space-y-3" dir="rtl">

      {/* ─── Stock-specific filters bar ─── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Symbol/notes search */}
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

        {/* Sentiment filter */}
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

        {/* Source filter — only when multiple sources exist */}
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

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
          >
            <XIcon className="h-3 w-3" />
            נקה
          </button>
        )}

        {/* Results count */}
        <span className="mr-auto text-[11px] text-slate-400 dark:text-zinc-600 whitespace-nowrap">
          {filteredStocks.length === items.length
            ? `${items.length} מניות`
            : `${filteredStocks.length} מתוך ${items.length}`}
        </span>
      </div>

      {/* ─── Empty state ─── */}
      {filteredStocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-zinc-600">
          <span className="text-4xl opacity-20">📈</span>
          <p className="text-sm font-medium">
            {hasActiveFilters
              ? 'אין מניות התואמות את הסינון'
              : filterMarketStatus
                ? 'אין עדיין מניות בטאב הזה'
                : 'לא נמצאו מניות בנושא הנוכחי'}
          </p>
          {hasActiveFilters ? (
            <button type="button" onClick={clearFilters} className="text-xs text-teal-600 dark:text-teal-400 hover:underline">
              נקה סינונים
            </button>
          ) : (
            <p className="text-xs text-center max-w-xs">
              שמור שורות מניות מ"מניות שהוזכרו" כדי לראות אותן כאן
            </p>
          )}
        </div>
      ) : (

        /* ─── Table ─── */
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900" dir="rtl">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-900/80">
                <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                  סימול / חברה
                </th>
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                  סנטימנט
                </th>
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                  סטטוס
                </th>
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                  שינוי %
                </th>
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500">
                  הערות
                </th>
                <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
                  מקור / תאריך
                </th>
                <th className="py-2.5 px-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map(item => (
                <StockRow
                  key={item.id}
                  item={item}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
