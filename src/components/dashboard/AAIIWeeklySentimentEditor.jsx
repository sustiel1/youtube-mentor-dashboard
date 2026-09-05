import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  formatLocalDateOnly,
  formatWeeklyPeriodLabel,
  getAaiiSpreadInterpretation,
  getWeeklyPeriod,
  hasAaiiWeeklyAverages,
  normalizeAaiiPercentInput,
  parseAaiiResultsLine,
  validateAaiiWeeklyDraft,
} from '@/lib/aaiiWeeklySentiment';

const FIELD_CLS = 'w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:text-zinc-200';
const LABEL_CLS = 'block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1';

function todayLocalDateOnly() {
  return formatLocalDateOnly(new Date());
}

// Carries the three long-run averages forward from the stored record so a plain
// re-save (no fresh paste) does not silently erase them — bullBearSpread is
// deliberately NOT carried forward here; it is always recomputed from bullish/bearish.
function buildDraft(currentRecord) {
  return {
    bullish: currentRecord ? String(currentRecord.bullish) : '',
    neutral: currentRecord ? String(currentRecord.neutral) : '',
    bearish: currentRecord ? String(currentRecord.bearish) : '',
    ...(currentRecord && hasAaiiWeeklyAverages(currentRecord) ? {
      bullishAverage: currentRecord.bullishAverage,
      neutralAverage: currentRecord.neutralAverage,
      bearishAverage: currentRecord.bearishAverage,
    } : {}),
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
  const [pasteText, setPasteText] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft(buildDraft(currentRecord));
      setError(null);
      setHistoryOpen(false);
      setPasteText('');
      setParsedPreview(null);
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
  const previewInterpretation = useMemo(
    () => getAaiiSpreadInterpretation(parsedPreview?.bullBearSpread),
    [parsedPreview?.bullBearSpread],
  );

  const handleField = (field) => (event) => {
    setDraft((prev) => ({ ...prev, [field]: event.target.value }));
    if (field !== 'publicationDate') setParsedPreview(null);
  };

  const handleParse = () => {
    const parsed = parseAaiiResultsLine(pasteText);
    if (!parsed.valid) {
      setParsedPreview(null);
      setError(parsed.error);
      return;
    }
    setParsedPreview(parsed);
    if (parsed.weekEndingDate) {
      setDraft((prev) => ({ ...prev, publicationDate: parsed.weekEndingDate }));
    }
    setError(null);
  };

  const handleSave = async () => {
    const saveDraft = parsedPreview ? { ...draft, ...parsedPreview } : draft;
    const validation = validateAaiiWeeklyDraft(saveDraft);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    if (!period) {
      setError('תאריך פרסום לא תקין');
      return;
    }
    try {
      await onSave?.(saveDraft);
      onOpenChange(false);
    } catch {
      setError('שמירת נתוני AAII נכשלה. הנתונים הקיימים לא שונו.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-right" dir="rtl" data-aaii-editor>
        <DialogHeader>
          <DialogTitle>עדכון סנטימנט שבועי AAII</DialogTitle>
          <DialogDescription>הזנה ידנית של תוצאות סקר הסנטימנט השבועי (Bullish / Neutral / Bearish)</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
            <label className={LABEL_CLS} htmlFor="aaii-editor-paste">הדבקת שורת תוצאות AAII</label>
            <textarea
              id="aaii-editor-paste"
              rows={2}
              dir="ltr"
              value={pasteText}
              onChange={(event) => {
                setPasteText(event.target.value);
                setParsedPreview(null);
                setError(null);
              }}
              placeholder="Bullish … Avg … Neutral … Bearish … Bull–Bear Spread …"
              className={`${FIELD_CLS} min-h-14 resize-y text-left`}
              data-aaii-editor-paste
            />
            <button
              type="button"
              onClick={handleParse}
              className="mt-2 h-8 rounded-lg border border-indigo-200 bg-white px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800"
              data-aaii-editor-parse
            >
              פענוח ותצוגה מקדימה
            </button>

            {parsedPreview && (
              <div className="mt-3 rounded-md border border-emerald-200 bg-white p-2 text-xs text-slate-700 dark:border-emerald-800 dark:bg-zinc-900 dark:text-zinc-200" data-aaii-editor-preview>
                <p className="mb-1 font-bold text-emerald-700 dark:text-emerald-400">תצוגה מקדימה לפני שמירה</p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div><dt className="inline text-slate-500">שוריים: </dt><dd className="inline font-semibold">{parsedPreview.bullish.toFixed(1)}%</dd></div>
                  <div><dt className="inline text-slate-500">ממוצע שוריים: </dt><dd className="inline font-semibold">{parsedPreview.bullishAverage.toFixed(1)}%</dd></div>
                  <div><dt className="inline text-slate-500">ניטרליים: </dt><dd className="inline font-semibold">{parsedPreview.neutral.toFixed(1)}%</dd></div>
                  <div><dt className="inline text-slate-500">ממוצע ניטרליים: </dt><dd className="inline font-semibold">{parsedPreview.neutralAverage.toFixed(1)}%</dd></div>
                  <div><dt className="inline text-slate-500">דוביים: </dt><dd className="inline font-semibold">{parsedPreview.bearish.toFixed(1)}%</dd></div>
                  <div><dt className="inline text-slate-500">ממוצע דוביים: </dt><dd className="inline font-semibold">{parsedPreview.bearishAverage.toFixed(1)}%</dd></div>
                  <div><dt className="inline text-slate-500">מרווח: </dt><dd className="inline font-semibold">{parsedPreview.bullBearSpread.toFixed(1)} נק׳ אחוז</dd></div>
                  <div><dt className="inline text-slate-500">סנטימנט: </dt><dd className="inline font-semibold">{previewInterpretation?.label}</dd></div>
                </dl>
              </div>
            )}
          </div>

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
            {parsedPreview ? 'אישור ושמירה' : 'שמירה'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
