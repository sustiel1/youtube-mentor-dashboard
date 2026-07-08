import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { getFixedQuestionsForItems, buildFixedCopyText } from '@/lib/fixedQuestionBank';
import { MARKET_BRIEF_SPACE_URL } from '@/lib/perplexitySpaces';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export function FixedQuestionsPanel({ isOpen, onClose, selectedItems = [] }) {
  const [selectedQIds, setSelectedQIds] = useState(new Set());
  // Snapshot items at open-time so they don't disappear if parent state clears
  const [frozenItems, setFrozenItems] = useState([]);

  const questions = useMemo(() => getFixedQuestionsForItems(frozenItems), [frozenItems]);

  useEffect(() => {
    if (isOpen) {
      setSelectedQIds(new Set());
      if (selectedItems.length > 0) setFrozenItems(selectedItems);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleQ = useCallback((id) => {
    setSelectedQIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedQIds(new Set(questions.map((q) => q.id)));
  }, [questions]);

  const clearAll = useCallback(() => setSelectedQIds(new Set()), []);

  const _writeClipboard = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { return false; }
  }, []);

  const handleCopyRowOnly = useCallback(async () => {
    const text = frozenItems.map((i) => i.text).join('\n\n');
    const ok = await _writeClipboard(text);
    if (ok) toast.success('הועתק — אפשר להדביק ב-Perplexity או ChatGPT', { duration: 3000 });
    else toast.error('לא הצלחנו להעתיק — העתק ידנית');
  }, [frozenItems, _writeClipboard]);

  const handleCopyWithQuestions = useCallback(async () => {
    const text = buildFixedCopyText(frozenItems, selectedQIds, questions);
    const ok = await _writeClipboard(text);
    if (ok) toast.success('הועתק — אפשר להדביק ב-Perplexity או ChatGPT', { duration: 3000 });
    else toast.error('לא הצלחנו להעתיק — העתק ידנית');
  }, [frozenItems, selectedQIds, questions, _writeClipboard]);

  const sectionLabel = frozenItems[0]?.sectionLabel || '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        dir="rtl"
        className="max-w-xl z-[210] bg-zinc-950 border-zinc-800 text-white"
      >
        <DialogHeader>
          <DialogTitle className="text-white text-right text-base">
            📋 שאלות לפי כותרת
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-right text-sm">
            {sectionLabel
              ? `סקציה: ${sectionLabel}`
              : `${frozenItems.length} פריטים נבחרו`}
          </DialogDescription>
        </DialogHeader>

        {/* Selected items preview */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 max-h-28 overflow-y-auto">
          {frozenItems.map((item, i) => (
            <p key={i} className="text-sm text-zinc-200 leading-relaxed mb-1 last:mb-0">
              {frozenItems.length > 1 && (
                <span className="text-zinc-500 ml-2">{i + 1}.</span>
              )}
              {item.text}
            </p>
          ))}
        </div>

        {/* Select all / clear */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {selectedQIds.size > 0 ? `${selectedQIds.size} שאלות נבחרו` : 'בחר שאלות'}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              בחר הכל
            </button>
            <span className="text-zinc-700">|</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              נקה בחירה
            </button>
          </div>
        </div>

        <ScrollArea className="max-h-64 pl-1">
          <div className="flex flex-col gap-2 pr-1">
            {questions.map((q) => {
              const checked = selectedQIds.has(q.id);
              return (
                <label
                  key={q.id}
                  className={[
                    'flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all',
                    checked
                      ? 'border-emerald-600 bg-emerald-950/30'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleQ(q.id)}
                    className="mt-0.5 flex-shrink-0 w-4 h-4 cursor-pointer accent-emerald-500"
                  />
                  <span className="flex-1 text-sm leading-relaxed text-zinc-100 select-text text-right">
                    {q.text}
                  </span>
                </label>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div
          dir="rtl"
          className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-800"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors"
            >
              סגור
            </button>
            <a
              href={MARKET_BRIEF_SPACE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors whitespace-nowrap"
            >
              🔗 Perplexity
            </a>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyRowOnly}
              className="rounded-xl bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-sm font-semibold text-white transition-colors whitespace-nowrap"
            >
              📋 העתק רק את השורה
            </button>
            <button
              type="button"
              onClick={handleCopyWithQuestions}
              disabled={selectedQIds.size === 0}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              ✓ העתק שורה + שאלות
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
