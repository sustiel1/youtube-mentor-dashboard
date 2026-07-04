import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { TEMPLATE_LABELS } from '@/lib/perplexityQuestionBank';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Modal panel showing contextual Perplexity questions for selected market brief items.
 * Questions are selectable; user can copy individual questions or all at once.
 */
export function PerplexityQuestionPanel({ isOpen, onClose, questions = [] }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (isOpen) setSelectedIds(new Set());
  }, [isOpen]);

  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const _writeClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleCopyOne = useCallback(async (q) => {
    const ok = await _writeClipboard(q.text);
    setCopiedId(q.id);
    setTimeout(() => setCopiedId(null), 1500);
    if (ok) {
      toast.success('שאלה הועתקה — הדבק ב-Perplexity 💬', { duration: 3000 });
    } else {
      toast.error('לא הצלחנו להעתיק — העתק ידנית');
    }
  }, [_writeClipboard]);

  const handleCopySelected = useCallback(async () => {
    const selected = questions.filter((q) => selectedIds.has(q.id));
    if (!selected.length) return;
    const text = selected.map((q, i) => `${i + 1}. ${q.text}`).join('\n\n');
    const ok = await _writeClipboard(text);
    if (ok) {
      toast.success(`${selected.length} שאלות הועתקו — הדבק ב-Perplexity 💬`, { duration: 3000 });
    } else {
      toast.error('לא הצלחנו להעתיק — העתק ידנית');
    }
  }, [questions, selectedIds, _writeClipboard]);

  const handleCopyAll = useCallback(async () => {
    if (!questions.length) return;
    const text = questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n\n');
    const ok = await _writeClipboard(text);
    if (ok) {
      toast.success(`${questions.length} שאלות הועתקו 💬`, { duration: 3000 });
    } else {
      toast.error('לא הצלחנו להעתיק — העתק ידנית');
    }
  }, [questions, _writeClipboard]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        dir="rtl"
        className="max-w-xl z-[210] bg-zinc-950 border-zinc-800 text-white"
      >
        <DialogHeader>
          <DialogTitle className="text-white text-right text-base">
            💬 שאלות חכמות ל-Perplexity
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-right text-sm">
            {questions.length} שאלות — בחר ולחץ &ldquo;העתק&rdquo; כדי להדביק ב-Perplexity
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[26rem] pl-1">
          <div className="flex flex-col gap-2 py-1 pr-1">
            {questions.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-8">
                לא נמצאו שאלות לפריטים הנבחרים
              </p>
            )}
            {questions.map((q) => {
              const isSelected = selectedIds.has(q.id);
              const isCopied = copiedId === q.id;
              return (
                <div
                  key={q.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSelected(q.id)}
                  onKeyDown={(e) => e.key === 'Enter' && toggleSelected(q.id)}
                  className={[
                    'group w-full text-right rounded-xl border px-4 py-3 cursor-pointer transition-all outline-none',
                    isSelected
                      ? 'border-teal-500 bg-teal-950/40 ring-1 ring-teal-500'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div
                      className={[
                        'mt-1 flex-shrink-0 w-4 h-4 rounded border-2 transition-colors flex items-center justify-center',
                        isSelected
                          ? 'border-teal-400 bg-teal-400'
                          : 'border-zinc-600 group-hover:border-zinc-400',
                      ].join(' ')}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-zinc-950" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    {/* Question text */}
                    <p className="flex-1 text-sm leading-relaxed text-zinc-100 select-text">
                      {q.text}
                    </p>

                    {/* Per-question copy button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleCopyOne(q); }}
                      className={[
                        'flex-shrink-0 mt-0.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap',
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200',
                      ].join(' ')}
                    >
                      {isCopied ? '✓' : '📋'}
                    </button>
                  </div>

                  {/* Template type badge */}
                  {q.templateType && TEMPLATE_LABELS[q.templateType] && (
                    <div className="mt-2 mr-7">
                      <span className="text-xs text-zinc-500 font-medium">
                        {TEMPLATE_LABELS[q.templateType]}
                      </span>
                    </div>
                  )}
                </div>
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
              href="https://www.perplexity.ai"
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
              onClick={handleCopyAll}
              disabled={!questions.length}
              className="rounded-xl bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              📋 העתק הכל
            </button>
            <button
              type="button"
              onClick={handleCopySelected}
              disabled={selectedIds.size === 0}
              className="rounded-xl bg-teal-600 hover:bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              📋 העתק נבחרות ({selectedIds.size})
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
