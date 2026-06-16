import { toast } from 'sonner';
import { UniversalTabQuickSaveFromBulk } from '@/components/shared/UniversalTabQuickSaveActions';

const BTN_CLS =
  'p-1 rounded text-sm leading-none transition-colors';

export function copySectionToClipboard(text) {
  const payload = String(text || '').trim();
  if (!payload) return;
  navigator.clipboard.writeText(payload)
    .then(() => toast.success('הועתק ✓'))
    .catch(() => toast.error('שגיאה בהעתקה'));
}

/**
 * Section/card header actions — Copy + Brain / Obsidian / Workspace.
 * Always visible (not hover-only like row actions).
 */
export function UniversalTabSectionHeaderActions({
  text = '',
  copyText,
  bulkSelection = null,
  sectionLabel,
  type,
  tabScope,
  brainSaved,
  className = '',
}) {
  const saveText = String(text || '').trim();
  const clipboardPayload = String(copyText ?? saveText ?? '').trim();
  const hasQuick = bulkSelection?.onQuickSaveBrain
    || bulkSelection?.onQuickSaveObsidian
    || bulkSelection?.onQuickSaveWorkspace;

  if (!clipboardPayload && !hasQuick) return null;

  return (
    <div className={`flex items-center gap-0.5 shrink-0 ${className}`}>
      {clipboardPayload ? (
        <button
          type="button"
          onClick={() => copySectionToClipboard(clipboardPayload)}
          title="העתק סעיף"
          className={`${BTN_CLS} text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-700`}
        >
          📋
        </button>
      ) : null}
      {hasQuick && saveText ? (
        <UniversalTabQuickSaveFromBulk
          bulkSelection={bulkSelection}
          text={saveText}
          sectionLabel={sectionLabel}
          type={type}
          tabScope={tabScope}
          brainSaved={brainSaved}
          className="opacity-100 max-md:opacity-90"
        />
      ) : null}
    </div>
  );
}
