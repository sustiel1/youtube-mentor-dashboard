import { useState } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  normalizeStockWorkspaceItem,
  getStockDisplayNotes,
  SENTIMENT_DOT,
  SENTIMENT_LABEL,
  SENTIMENT_COLOR,
} from '@/utils/workspaceStockItems';

// ─── Shared status constants (mirrors WorkspaceLibrary.jsx) ──────────────────
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

// ─── Single stock row ─────────────────────────────────────────────────────────

function StockRow({ item, onStatusChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  // Merge stored structured fields with fallback-parsed values (never modifies state)
  const stock = normalizeStockWorkspaceItem(item);
  const notes = getStockDisplayNotes(stock);
  const sentiment = stock.sentiment || null;
  const dotClass = SENTIMENT_COLOR[sentiment] || 'text-slate-400 dark:text-zinc-500';
  const dot = SENTIMENT_DOT[sentiment] || '⚪';
  const notesPreviewIsTruncatable = notes && notes.length > 100;

  const savedDate = (() => {
    try { return format(new Date(item.savedAt), "d בMMM", { locale: he }); } catch { return ''; }
  })();

  return (
    <>
      <tr className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-900/40 transition-colors group">

        {/* סימול / חברה */}
        <td className="py-3 px-3 text-right align-top whitespace-nowrap" dir="ltr">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-zinc-100">
              {stock.symbol || '—'}
            </span>
            {stock.companyName && (
              <span className="text-[10px] font-normal text-slate-500 dark:text-zinc-500 max-w-[100px] truncate" dir="rtl">
                {stock.companyName}
              </span>
            )}
          </div>
        </td>

        {/* סנטימנט */}
        <td className="py-3 px-3 text-right align-top whitespace-nowrap">
          {sentiment ? (
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium', dotClass)}>
              <span>{dot}</span>
              <span>{SENTIMENT_LABEL[sentiment]}</span>
            </span>
          ) : (
            <span className="text-slate-300 dark:text-zinc-700 text-xs">—</span>
          )}
        </td>

        {/* סטטוס (editable) */}
        <td className="py-3 px-3 text-right align-top">
          {item.marketStatus ? (
            <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none mb-1', MARKET_STATUS_COLORS[item.marketStatus])}>
              {MARKET_STATUS_LABELS[item.marketStatus]}
            </span>
          ) : null}
          <select
            value={item.marketStatus || ''}
            onChange={e => onStatusChange?.(item.id, e.target.value || null)}
            className="block w-full mt-0.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-[10px] text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-300 min-w-[100px]"
          >
            <option value="">ללא סטטוס</option>
            <option value="watchlist">⭐ למעקב</option>
            <option value="candidate">🎯 מועמדות</option>
            <option value="before_earnings">📋 לפני דוחות</option>
            <option value="risk">⚠️ בסיכון</option>
            <option value="archive">📦 ארכיון</option>
          </select>
        </td>

        {/* שינוי % */}
        <td className="py-3 px-3 text-right align-top whitespace-nowrap" dir="ltr">
          {stock.percentChange ? (
            <span className={cn(
              'text-xs font-mono font-semibold',
              sentiment === 'negative'
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400',
            )}>
              {stock.percentChange}
            </span>
          ) : (
            <span className="text-slate-300 dark:text-zinc-700 text-xs">—</span>
          )}
        </td>

        {/* הערות — line-clamp-2 preview + expand button */}
        <td className="py-3 px-3 text-right align-top max-w-[280px]">
          {notes ? (
            <div dir="rtl">
              <p className={cn(
                'text-sm text-slate-700 dark:text-zinc-300 leading-snug break-words',
                !expanded && 'line-clamp-2',
              )}>
                {notes}
              </p>
              {notesPreviewIsTruncatable && (
                <button
                  type="button"
                  onClick={() => setExpanded(p => !p)}
                  className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-teal-600 dark:text-teal-400 hover:underline"
                >
                  {expanded
                    ? <><ChevronUp className="h-2.5 w-2.5" />סגור</>
                    : <><ChevronDown className="h-2.5 w-2.5" />הרחב</>
                  }
                </button>
              )}
            </div>
          ) : (
            <span className="text-slate-300 dark:text-zinc-700 text-xs">—</span>
          )}
        </td>

        {/* מקור / תאריך */}
        <td className="py-3 px-3 text-right align-top min-w-[100px]">
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

        {/* פעולות */}
        <td className="py-3 px-2 text-right align-top">
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

      {/* Expanded full-note row — full rawSourceText shown */}
      {expanded && (
        <tr className="bg-amber-50/40 dark:bg-amber-950/10 border-b border-amber-100 dark:border-amber-900/20">
          <td colSpan={7} className="px-5 py-3 text-right" dir="rtl">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-500">הערה מלאה</p>
              <p className="text-sm text-slate-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {stock.fullNotes || notes}
              </p>
              {(stock.sourceTitle || stock.sourceSection) && (
                <p className="text-[10px] text-slate-400 dark:text-zinc-600 pt-1 border-t border-amber-100 dark:border-amber-900/20">
                  מקור: {[stock.sourceSection, stock.sourceTitle].filter(Boolean).join(' | ')}
                </p>
              )}
              {stock.rawSourceText && stock.rawSourceText !== (stock.fullNotes || notes) && (
                <p className="text-[10px] text-slate-400 dark:text-zinc-600 font-mono break-all" dir="ltr">
                  {stock.rawSourceText}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main table component ─────────────────────────────────────────────────────

export function StockWatchlistView({ items = [], filterMarketStatus, onStatusChange, onDelete }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 dark:text-zinc-600" dir="rtl">
        <span className="text-5xl opacity-25">📈</span>
        <p className="text-sm font-medium">
          {filterMarketStatus ? 'אין עדיין מניות בטאב הזה' : 'לא נמצאו מניות בנושא הנוכחי'}
        </p>
        <p className="text-xs text-center text-slate-400 dark:text-zinc-600">
          שמור שורות מניות מ"מניות שהוזכרו" כדי לראות אותן כאן
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900" dir="rtl">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-900/80">
            <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-500 whitespace-nowrap">
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
          {items.map(item => (
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
  );
}
