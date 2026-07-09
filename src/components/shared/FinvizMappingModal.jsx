import { useState } from 'react';
import { saveManualFinvizMapping } from '@/utils/manualFinvizMappings';

const FINVIZ_BASE = 'https://finviz.com/quote.ashx?t=';
const TICKER_RE = /^[A-Z0-9]{1,6}([.\-][A-Z0-9]{1,4})?$/;

/**
 * Modal for manually connecting an unrecognized stock/company name to a Finviz ticker.
 * Props:
 *   originalName  — the raw text that was not auto-resolved (e.g. "Micron")
 *   onSaved(name, ticker) — called after saving, so the parent can refresh its URL map
 *   onClose       — called to dismiss the modal
 */
export function FinvizMappingModal({ originalName, onSaved, onClose }) {
  const [ticker, setTicker] = useState('');
  const [displayName, setDisplayName] = useState(originalName || '');
  const [error, setError] = useState('');

  const tickerUpper = ticker.trim().toUpperCase();
  const isValid = TICKER_RE.test(tickerUpper);
  const previewUrl = tickerUpper ? `${FINVIZ_BASE}${encodeURIComponent(tickerUpper)}&p=d` : '';

  function handleSave() {
    if (!isValid) {
      setError('טיקר לא תקין — אותיות ומספרים בלבד (לדוגמה: MU, NVDA, BRK.B)');
      return;
    }
    saveManualFinvizMapping(originalName, tickerUpper, displayName);
    onSaved?.(originalName, tickerUpper);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 border border-slate-200 dark:border-zinc-700"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 mb-4">
          🔗 חיבור מניה לפינביז
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 dark:text-zinc-400 block mb-1">שם מזוהה</label>
            <div className="text-sm font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 rounded px-3 py-2">
              {originalName}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-zinc-400 block mb-1">
              טיקר / סימול <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => { setTicker(e.target.value.toUpperCase()); setError(''); }}
              placeholder="לדוגמה: MU"
              maxLength={10}
              dir="ltr"
              autoFocus
              className="w-full text-sm border border-slate-300 dark:border-zinc-600 rounded px-3 py-2 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-left"
            />
            {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-zinc-400 block mb-1">שם תצוגה (אופציונלי)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={originalName}
              className="w-full text-sm border border-slate-300 dark:border-zinc-600 rounded px-3 py-2 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {previewUrl && (
            <div>
              <label className="text-xs text-slate-500 dark:text-zinc-400 block mb-1">תצוגה מקדימה</label>
              <code className="text-xs text-indigo-600 dark:text-indigo-400 break-all leading-relaxed block bg-slate-50 dark:bg-zinc-800 rounded px-2 py-1.5">
                {previewUrl}
              </code>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            שמור
          </button>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors"
              title="פתח לבדיקה בפינביז"
            >
              🔍
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors"
          >
            בטל
          </button>
        </div>
      </div>
    </div>
  );
}
