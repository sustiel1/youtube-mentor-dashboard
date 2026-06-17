import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ObsidianIcon } from '@/components/shared/ObsidianIcon';
import { openInObsidian } from '@/lib/knowledgeLibrary';
import { resolveSaveStatusForTarget } from '@/lib/saveStatusResolver';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const TARGET_META = {
  brain: { icon: '🧠', title: 'Brain', locationLabel: 'מיקום' },
  obsidian: { icon: null, title: 'Obsidian', locationLabel: 'נתיב' },
  workspace: { icon: '⭐', title: 'Workspace', locationLabel: 'מיקום' },
};

function useIsMobile() {
  const [mobile, setMobile] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false
  ));
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

function StatusBody({
  target,
  status,
  previewText,
  onSave,
  onOpen,
  onClose,
}) {
  const meta = TARGET_META[target] || TARGET_META.brain;
  const saved = !!status?.saved;
  const location = status?.path || status?.location || null;
  const canOpen = saved && (target === 'obsidian' ? !!status?.openPath : !!onOpen);

  return (
    <div dir="rtl" className="space-y-3 text-right">
      <div className="flex items-center gap-2">
        {meta.icon ? <span className="text-lg">{meta.icon}</span> : <ObsidianIcon className="h-5 w-5 text-violet-500" />}
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{meta.title}</p>
      </div>

      {previewText ? (
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate" title={previewText}>
          &quot;{previewText.length > 48 ? `${previewText.slice(0, 48)}…` : previewText}&quot;
        </p>
      ) : null}

      <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 space-y-1.5 dark:border-zinc-800 dark:bg-zinc-900/60">
        <p className="text-xs text-slate-600 dark:text-zinc-300">
          <span className="font-medium text-slate-500 dark:text-zinc-400">סטטוס: </span>
          {saved ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ נשמר</span>
          ) : (
            <span className="text-slate-500 dark:text-zinc-400">לא נשמר</span>
          )}
        </p>
        {location ? (
          <p className="text-xs text-slate-600 dark:text-zinc-300 break-all">
            <span className="font-medium text-slate-500 dark:text-zinc-400">{meta.locationLabel}: </span>
            {location}
          </p>
        ) : !saved && status?.hint ? (
          <p className="text-[11px] text-slate-400 dark:text-zinc-500">{status.hint}</p>
        ) : null}
        {status?.savedAt ? (
          <p className="text-[11px] text-slate-400 dark:text-zinc-500">
            נשמר: {status.savedAt}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!saved && onSave ? (
          <button
            type="button"
            onClick={() => { onSave(); onClose(); }}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            שמור עכשיו
          </button>
        ) : null}
        {canOpen ? (
          <button
            type="button"
            onClick={() => {
              if (target === 'obsidian' && status.openPath) {
                openInObsidian(status.openPath);
              } else if (onOpen) {
                onOpen(status);
              }
              onClose();
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            פתח
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
        >
          סגור
        </button>
      </div>
    </div>
  );
}

/**
 * Lightweight save-status popover (desktop) or bottom sheet (mobile).
 */
export function SaveStatusPopover({
  open,
  target,
  anchorRect,
  videoId,
  tabKey,
  text,
  onSave,
  onOpenBrain,
  onOpenWorkspace,
  onClose,
}) {
  const ref = useRef(null);
  const isMobile = useIsMobile();
  const previewText = String(text || '').trim();
  const status = open && target
    ? resolveSaveStatusForTarget(target, { videoId, tabKey, text: previewText })
    : null;

  useEffect(() => {
    if (!open) return undefined;
    function handleDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open || !target || !status) return null;

  const handleOpen = (resolved) => {
    if (target === 'brain' && onOpenBrain) onOpenBrain(resolved);
    if (target === 'workspace' && onOpenWorkspace) onOpenWorkspace(resolved);
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-4" dir="rtl">
          <SheetHeader className="text-right mb-2">
            <SheetTitle className="text-base">סטטוס שמירה</SheetTitle>
          </SheetHeader>
          <StatusBody
            target={target}
            status={status}
            previewText={previewText}
            onSave={onSave}
            onOpen={handleOpen}
            onClose={onClose}
          />
        </SheetContent>
      </Sheet>
    );
  }

  const top = Math.max(12, (anchorRect?.top ?? 120) - 8);
  const left = Math.min(
    Math.max(12, (anchorRect?.left ?? 200) - 160),
    window.innerWidth - 280,
  );

  const popover = (
    <div
      ref={ref}
      dir="rtl"
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 100000,
        transform: 'translateY(-100%)',
        width: 'min(260px, calc(100vw - 24px))',
      }}
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
      data-save-status-popover
    >
      <StatusBody
        target={target}
        status={status}
        previewText={previewText}
        onSave={onSave}
        onOpen={handleOpen}
        onClose={onClose}
      />
    </div>
  );

  return ReactDOM.createPortal(popover, document.body);
}
