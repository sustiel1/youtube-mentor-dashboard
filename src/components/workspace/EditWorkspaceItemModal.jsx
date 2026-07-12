import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { normalizeStockWorkspaceItem, isStockWorkspaceItem } from '@/utils/workspaceStockItems';

const MARKET_STATUS_OPTIONS = [
  ['', 'ללא סטטוס'],
  ['watchlist', '⭐ למעקב'],
  ['candidate', '🎯 מועמדות'],
  ['before_earnings', '📋 לפני דוחות'],
  ['risk', '⚠️ בסיכון'],
  ['archive', '📦 ארכיון'],
];

const SENTIMENT_OPTIONS = [
  ['', 'ללא'],
  ['positive', '🟢 חיובי'],
  ['negative', '🔴 שלילי'],
  ['neutral', '⚪ ניטרלי'],
];

/**
 * Direct field-level edit for a Workspace item. Separate from
 * SaveToWorkspaceDialog (which handles topic assignment for video items) —
 * this modal edits notes/tags/flags plus stock-specific fields in place.
 * rawSourceText is shown read-only and is never included in the update.
 */
export function EditWorkspaceItemModal({ item, onOpenChange, onSave }) {
  const isStock = item ? isStockWorkspaceItem(item) : false;
  const stock = item && isStock ? normalizeStockWorkspaceItem(item) : null;

  const [notes, setNotes] = useState('');
  const [fullNotes, setFullNotes] = useState('');
  const [marketStatus, setMarketStatus] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [flags, setFlags] = useState({ isFavorite: false, isImportant: false, mustWatchAgain: false });
  const [symbol, setSymbol] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [sector, setSector] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [percentChange, setPercentChange] = useState('');
  const [trigger, setTrigger] = useState('');
  const [riskNote, setRiskNote] = useState('');

  useEffect(() => {
    if (!item) return;
    setNotes(item.notes || '');
    setFullNotes(item.fullNotes || '');
    setMarketStatus(item.marketStatus || '');
    setTags(item.tags || []);
    setTagInput('');
    setFlags(item.flags || { isFavorite: false, isImportant: false, mustWatchAgain: false });
    setSymbol(stock?.symbol || '');
    setCompanyName(stock?.companyName || '');
    setSector(stock?.sector || '');
    setSentiment(stock?.sentiment || '');
    setPercentChange(stock?.percentChange || '');
    setTrigger(stock?.trigger || '');
    setRiskNote(stock?.riskNote || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) return null;

  function commitTag(raw) {
    const t = raw.trim().toLowerCase().replace(/^#/, '');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag(tagInput);
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  }

  function handleSave() {
    const updates = { notes, tags, flags };
    if (isStock) {
      updates.fullNotes = fullNotes;
      updates.marketStatus = marketStatus || null;
      updates.symbol = symbol.trim().toUpperCase();
      updates.companyName = companyName.trim() || null;
      updates.sector = sector.trim() || null;
      updates.sentiment = sentiment || null;
      updates.percentChange = percentChange.trim() || null;
      updates.trigger = trigger.trim() || null;
      updates.riskNote = riskNote.trim() || null;
    }
    onSave(item.id, updates);
  }

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex flex-col w-[min(92vw,540px)] max-h-[90vh] p-0 border-teal-100 bg-white dark:border-teal-900/30 dark:bg-zinc-950"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-right">
            <span>✏️</span>
            <span>עריכת פריט</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4" dir="rtl">
          {isStock && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">סימול</label>
                <input
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">שם חברה</label>
                <input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  dir="rtl"
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">סקטור</label>
                <input
                  value={sector}
                  onChange={e => setSector(e.target.value)}
                  dir="rtl"
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">% שינוי</label>
                <input
                  value={percentChange}
                  onChange={e => setPercentChange(e.target.value)}
                  dir="ltr"
                  placeholder="12%"
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">סנטימנט</label>
                <select
                  value={sentiment}
                  onChange={e => setSentiment(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200"
                >
                  {SENTIMENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">סטטוס</label>
                <select
                  value={marketStatus}
                  onChange={e => setMarketStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200"
                >
                  {MARKET_STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">טריגר</label>
                <input
                  value={trigger}
                  onChange={e => setTrigger(e.target.value)}
                  dir="rtl"
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">הערת סיכון</label>
                <input
                  value={riskNote}
                  onChange={e => setRiskNote(e.target.value)}
                  dir="rtl"
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">הערה מלאה (fullNotes)</label>
                <textarea
                  value={fullNotes}
                  onChange={e => setFullNotes(e.target.value)}
                  rows={3}
                  dir="rtl"
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200 resize-none"
                />
              </div>
            </div>
          )}

          {/* Notes — always editable */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">הערות</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              dir="rtl"
              className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-teal-400 dark:text-zinc-200 resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
              תגיות <span className="font-normal text-slate-400 dark:text-zinc-500">(הפרד בפסיק או Enter)</span>
            </label>
            <div
              className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-2 min-h-[40px] cursor-text"
              onClick={() => document.getElementById('ws-edit-tag-input')?.focus()}
            >
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 dark:bg-teal-950/40 dark:border-teal-800 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setTags(prev => prev.filter(t => t !== tag)); }}
                    className="text-teal-400 hover:text-teal-700 dark:hover:text-teal-200 leading-none"
                    aria-label={`הסר תגית ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                id="ws-edit-tag-input"
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { if (tagInput.trim()) commitTag(tagInput); }}
                dir="ltr"
                className="flex-1 min-w-[80px] bg-transparent text-xs text-slate-700 dark:text-zinc-300 outline-none"
              />
            </div>
          </div>

          {/* Flags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">סמן כ...</label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'isFavorite', label: '⭐ מועדף', active: 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-600 dark:text-amber-300' },
                { key: 'isImportant', label: '🔴 חשוב', active: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-600 dark:text-red-300' },
                { key: 'mustWatchAgain', label: '🔁 לצפות שוב', active: 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-950/40 dark:border-blue-600 dark:text-blue-300' },
              ].map(({ key, label, active }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFlags(f => ({ ...f, [key]: !f[key] }))}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                    flags[key] ? active : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Raw source — read only, never edited here */}
          {item.rawSourceText && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">טקסט מקורי (לקריאה בלבד)</label>
              <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-900/80 rounded-lg border border-slate-100 dark:border-zinc-800 px-3 py-2 break-all" dir="ltr">
                {item.rawSourceText}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            שמור שינויים
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
