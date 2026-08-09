import { useState } from 'react';
import { Archive, Trash2, Copy, X, FileDown, FolderInput } from 'lucide-react';
import { normalizeStockWorkspaceItem } from '@/utils/workspaceStockItems';
import { cn } from '@/lib/utils';

// ─── Copy / CSV helpers ───────────────────────────────────────────────────────

export function formatWorkspaceItemsForCopy(items) {
  return items.map(item => {
    const s = normalizeStockWorkspaceItem(item);
    if (s.symbol) {
      return [
        `📈 ${s.symbol}${s.companyName ? ' — ' + s.companyName : ''}`,
        s.sector        && `סקטור: ${s.sector}`,
        s.sentiment     && `סנטימנט: ${s.sentiment}`,
        item.marketStatus && `סטטוס שוק: ${item.marketStatus}`,
        (s.notes || s.fullNotes) && `הערות: ${s.notes || s.fullNotes}`,
        (s.sourceTitle || item.sourceTitle) && `מקור: ${s.sourceTitle || item.sourceTitle}`,
        item.savedAt && `נשמר: ${new Date(item.savedAt).toLocaleDateString('he-IL')}`,
      ].filter(Boolean).join('\n');
    }
    return [
      `📹 ${item.videoTitle || item.title || 'פריט ללא כותרת'}`,
      item.sourceTab  && `נושא: ${item.sourceTab}`,
      item.tags?.length && `תגיות: ${item.tags.join(', ')}`,
      item.sourceTitle && `מקור: ${item.sourceTitle}`,
      item.notes      && `הערות: ${item.notes}`,
      item.savedAt && `נשמר: ${new Date(item.savedAt).toLocaleDateString('he-IL')}`,
    ].filter(Boolean).join('\n');
  }).join('\n---\n');
}

export function exportWorkspaceItemsToCsv(items, filename = 'workspace-export.csv') {
  const headers = ['symbol', 'companyName', 'sector', 'sentiment', 'marketStatus', 'sourceTitle', 'notes', 'savedAt'];
  const rows = items.map(item => {
    const s = normalizeStockWorkspaceItem(item);
    const row = s.symbol
      ? {
          symbol:       s.symbol || '',
          companyName:  s.companyName || '',
          sector:       s.sector || '',
          sentiment:    s.sentiment || '',
          marketStatus: item.marketStatus || '',
          sourceTitle:  s.sourceTitle || item.sourceTitle || '',
          notes:        (s.notes || s.fullNotes || '').replace(/[\n\r]+/g, ' '),
          savedAt:      item.savedAt ? new Date(item.savedAt).toLocaleDateString('he-IL') : '',
        }
      : {
          symbol:       '',
          companyName:  item.videoTitle || item.title || '',
          sector:       '',
          sentiment:    '',
          marketStatus: '',
          sourceTitle:  item.sourceTitle || '',
          notes:        (item.notes || '').replace(/[\n\r]+/g, ' '),
          savedAt:      item.savedAt ? new Date(item.savedAt).toLocaleDateString('he-IL') : '',
        };
    return headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Bar component ────────────────────────────────────────────────────────────

/**
 * Dark bulk action bar for Workspace item management.
 *
 * Props:
 *   count            {number}   — number of selected items; bar hidden when 0
 *   onCopy           {function} — copy selected to clipboard
 *   onArchive        {function} — archive selected
 *   onDelete         {function} — open delete confirmation
 *   onClearSelection {function} — clear selection
 *   onExportCsv      {function} — optional CSV export; button hidden if absent
 *   reassignTopics   {array}    — real top-level topics [{id, name}]; enables the reassign dropdown when present with onReassign
 *   onReassign       {function} — (topicId) => void; called when the user picks a target topic and confirms
 *   disabled         {boolean}  — disable all buttons
 *   fixed            {boolean}  — fixed to viewport bottom (full-page); default flows naturally (dialog use)
 */
export function WorkspaceBulkActionBar({
  count = 0,
  onCopy,
  onArchive,
  onDelete,
  onClearSelection,
  onExportCsv,
  reassignTopics,
  onReassign,
  disabled = false,
  fixed = false,
}) {
  const [reassignTarget, setReassignTarget] = useState('');

  if (count === 0) return null;

  const canReassign = !!(reassignTopics?.length && onReassign);

  return (
    <div
      dir="rtl"
      className={cn(
        'z-50 flex items-center gap-2 justify-between border-t border-zinc-800 bg-zinc-900 px-4 py-3 flex-wrap',
        fixed ? 'fixed bottom-0 left-0 right-0' : 'flex-shrink-0',
      )}
    >
      <button
        type="button"
        onClick={onClearSelection}
        disabled={disabled}
        className="flex items-center gap-1 rounded-xl bg-zinc-700 hover:bg-zinc-600 px-2.5 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
        נקה
      </button>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-white whitespace-nowrap">
          נבחרו {count} פריטים
        </span>
        <div className="w-px h-5 bg-white/20 shrink-0" />

        {onCopy && (
          <button
            type="button"
            disabled={disabled}
            onClick={onCopy}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-600 hover:bg-zinc-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            העתק
          </button>
        )}

        {canReassign && (
          <div className="flex items-center gap-1">
            <select
              value={reassignTarget}
              onChange={e => setReassignTarget(e.target.value)}
              disabled={disabled}
              dir="rtl"
              className="rounded-xl border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <option value="">שייך לנושא...</option>
              {reassignTopics.map(t => (
                <option key={t.id} value={t.id}>{t.emoji ? `${t.emoji} ${t.name}` : t.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={disabled || !reassignTarget}
              onClick={() => { onReassign(reassignTarget); setReassignTarget(''); }}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
            >
              <FolderInput className="h-3.5 w-3.5" />
              שייך
            </button>
          </div>
        )}

        {onArchive && (
          <button
            type="button"
            disabled={disabled}
            onClick={onArchive}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" />
            ארכיון מסומנים
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            disabled={disabled}
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-xl bg-red-700 hover:bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            מחק מסומנים
          </button>
        )}

        {onExportCsv && (
          <button
            type="button"
            disabled={disabled}
            onClick={onExportCsv}
            className="flex items-center gap-1.5 rounded-xl bg-green-700 hover:bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors active:scale-95 whitespace-nowrap disabled:opacity-50"
          >
            <FileDown className="h-3.5 w-3.5" />
            ייצוא CSV
          </button>
        )}
      </div>
    </div>
  );
}
