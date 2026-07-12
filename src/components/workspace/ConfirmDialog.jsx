import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Generic RTL confirmation dialog. Pass `requireTypedWord` to force the user
 * to type that exact word before the confirm button becomes active — used
 * for the dangerous "delete all visible" action.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'אישור',
  cancelLabel = 'ביטול',
  danger = false,
  requireTypedWord = null,
  onConfirm,
}) {
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (open) setTypedValue('');
  }, [open]);

  const isBlocked = requireTypedWord && typedValue.trim() !== requireTypedWord;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {danger && <span>⚠️</span>}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3 text-sm text-slate-700 dark:text-zinc-300">
          {description && <p className="whitespace-pre-wrap">{description}</p>}

          {requireTypedWord && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                הקלד "{requireTypedWord}" כדי לאשר
              </label>
              <input
                autoFocus
                value={typedValue}
                onChange={e => setTypedValue(e.target.value)}
                dir="rtl"
                className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-red-400 dark:text-zinc-200"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 flex-row-reverse justify-start sm:justify-start">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isBlocked}
            onClick={() => { onConfirm?.(); onOpenChange(false); }}
            className={cn(
              'flex-1 h-9 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              danger
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700',
            )}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
