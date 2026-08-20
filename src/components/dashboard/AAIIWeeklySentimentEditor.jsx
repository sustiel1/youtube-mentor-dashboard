import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  formatLocalDateOnly,
  formatWeeklyPeriodLabel,
  getWeeklyPeriod,
  normalizeAaiiPercentInput,
  validateAaiiWeeklyDraft,
} from '@/lib/aaiiWeeklySentiment';

const FIELD_CLS = 'w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:text-zinc-200';
const LABEL_CLS = 'block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1';

function todayLocalDateOnly() {
  return formatLocalDateOnly(new Date());
}

function buildDraft(currentRecord) {
  return {
    bullish: currentRecord ? String(currentRecord.bullish) : '',
    neutral: currentRecord ? String(currentRecord.neutral) : '',
    bearish: currentRecord ? String(currentRecord.bearish) : '',
    publicationDate: currentRecord?.publicationDate || todayLocalDateOnly(),
  };
}

export function AAIIWeeklySentimentEditor({
  open,
  onOpenChange,
  currentRecord = null,
  history = [],
  onSave,
}) {
  const [draft, setDraft] = useState(() => buildDraft(currentRecord));
  const [error, setError] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(buildDraft(currentRecord));
      setError(null);
      setHistoryOpen(false);
    }
  }, [open, currentRecord]);

  const total = useMemo(() => {
    const b = normalizeAaiiPercentInput(draft.bullish);
    const n = normalizeAaiiPercentInput(draft.neutral);
    const be = normalizeAaiiPercentInput(draft.bearish);
    if (b == null || n == null || be == null) return null;
    return b + n + be;
  }, [draft.bullish, draft.neutral, draft.bearish]);

  const period = useMemo(() => getWeeklyPeriod(draft.publicationDate), [draft.publicationDate]);

  const handleField = (field) => (event) => {
    setDraft((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSave = () => {
    const validation = validateAaiiWeeklyDraft(draft);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    if (!period) {
      setError('תאריך פרסום לא תקין');
      return;
    }
    onSave?.(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-right" dir="rtl" data-aaii-editor>
        <DialogHeader>
          <DialogTitle>עדכון סנטימנט שבועי AAII</DialogTitle>
          <DialogDescription>הזנה ידנית של תוצאות סקר הסנטימנט השבועי (Bullish / Neutral / Bearish)</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <div>
            <label className={LABEL_CLS} htmlFor="aaii-editor-bullish">שוריים (%)</label>
            <input
              id="aaii-editor-bullish"
              type="number"
              inputMode="decimal"
              step="0.1"
              dir="rtl"
              value={draft.bullish}
              onChange={handleField('bullish')}
              className={FIELD_CLS}
              data-aaii-editor-field="bullish"
            />
          </div>
          <div>
            <label className={LABEL_CLS} htmlFor="aaii-editor-neutral">ניטרליים (%)</label>
            <input
              id="aaii-editor-neutral"
              type="number"
              inputMode="decimal"
              step="0.1"
              dir="rtl"
              value={draft.neutral}
              onChange={handleField('neutral')}
              className={FIELD_CLS}
              data-aaii-editor-field="neutral"
            />
          </div>
          <div>
            <label className={LABEL_CLS} htmlFor="aaii-editor-bearish">דוביים (%)</label>
            <input
              id="aaii-editor-bearish"
              type="number"
              inputMode="decimal"
              step="0.1"
              dir="rtl"
              value={draft.bearish}
              onChange={handleField('bearish')}
              className={FIELD_CLS}
              data-aaii-editor-field="bearish"
            />
          </div>
          <div>
            <label className={LABEL_CLS} htmlFor="aaii-editor-date">תאריך פרסום הסקר</label>
            <input
              id="aaii-editor-date"
              type="date"
              dir="rtl"
              value={draft.publicationDate}
              onChange={handleField('publicationDate')}
              className={FIELD_CLS}
              data-aaii-editor-field="publicationDate"
            />
          </div>

          <div className="text-xs text-slate-500 dark:text-zinc-400" data-aaii-editor-total>
            סה"כ: {total == null ? '—' : `${total.toFixed(1)}%`}
          </div>

          {period && (
            <div className="text-xs text-slate-500 dark:text-zinc-400" data-aaii-editor-period>
              {formatWeeklyPeriodLabel(period.weekStart, period.weekEnd)}
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400" role="alert" data-aaii-editor-error>
              {error}
            </p>
          )}

          {history.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                data-aaii-editor-history-toggle
              >
                {historyOpen ? 'הסתר היסטוריה' : `היסטוריה (${history.length})`}
              </button>
              {historyOpen && (
                <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-zinc-400 max-h-32 overflow-y-auto" data-aaii-editor-history-list>
                  {history.map((r) => (
                    <li key={r.weekStart} data-aaii-editor-history-item={r.weekStart}>
                      {formatWeeklyPeriodLabel(r.weekStart, r.weekEnd)} — שוריים {r.bullish.toFixed(1)}% · ניטרליים {r.neutral.toFixed(1)}% · דוביים {r.bearish.toFixed(1)}%
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 flex-row-reverse justify-start">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            data-aaii-editor-cancel
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 h-9 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            data-aaii-editor-save
          >
            שמירה
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
