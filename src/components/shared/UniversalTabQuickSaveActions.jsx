/**
 * Per-row quick save actions — Brain / Obsidian / Workspace.
 * Obsidian: persistent text badge (separate from bulk checkbox selection).
 * Saved → click opens destination; unsaved → click saves.
 */

import { cn } from '@/lib/utils';

export const OBSIDIAN_ROW_SAVE_LABEL = '🔮 שמור ל-Obsidian';
export const OBSIDIAN_ROW_SAVED_LABEL = '✅ נשמר ל-Obsidian';

const VISIBILITY_CLS =
  'opacity-100 max-md:opacity-90 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity';

const BTN_CLS =
  'p-1 rounded text-sm leading-none transition-colors';

const SAVED_BTN_CLS =
  'text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/30';

const OBSIDIAN_BADGE_BASE =
  'shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold leading-tight whitespace-nowrap transition-colors';

const OBSIDIAN_BADGE_SAVED_CLS =
  'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/50 dark:hover:bg-emerald-950/70';

const OBSIDIAN_BADGE_UNSAVED_CLS =
  'text-violet-700 bg-violet-50 hover:bg-violet-100 dark:text-violet-300 dark:bg-violet-950/40 dark:hover:bg-violet-950/60';

/**
 * @param {{ text, sectionLabel?, type?, tabScope?, timestamp? }} meta
 */
export function buildQuickSaveMeta(meta = {}) {
  return {
    text: String(meta.text ?? '').trim(),
    sectionLabel: meta.sectionLabel || '',
    type: meta.type || meta.tabScope || 'multi',
    tabScope: meta.tabScope || meta.type || 'multi',
    timestamp: meta.timestamp || '',
  };
}

export function UniversalTabQuickSaveActions({
  meta,
  onBrain,
  onObsidian,
  onWorkspace,
  brainSaved = false,
  obsidianSaved = false,
  workspaceSaved = false,
  className = '',
  compact = false,
}) {
  const payload = buildQuickSaveMeta(meta);
  if (!payload.text) return null;
  if (!onBrain && !onObsidian && !onWorkspace) return null;

  const fire = (handler) => {
    if (!handler) return;
    handler(payload);
  };

  if (compact) {
    return (
      <details className={`relative shrink-0 ${VISIBILITY_CLS} ${className}`}>
        <summary
          className={`${BTN_CLS} text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 list-none cursor-pointer [&::-webkit-details-marker]:hidden`}
          aria-label="פעולות שמירה"
        >
          ⋯
        </summary>
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[148px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {onBrain && (
            <button
              type="button"
              onClick={() => fire(onBrain)}
              title={brainSaved ? 'פתח פריט במוח' : 'שמור למוח'}
              className="block w-full px-3 py-1.5 text-right text-xs hover:bg-slate-50 dark:hover:bg-zinc-800"
            >
              {brainSaved ? '✓🧠 פתח במוח' : '🧠 שמור למוח'}
            </button>
          )}
          {onObsidian && (
            <button
              type="button"
              onClick={() => fire(onObsidian)}
              title={obsidianSaved ? 'פתח ב-Obsidian' : 'שמור ל-Obsidian'}
              className="flex w-full items-center px-3 py-1.5 text-right text-xs hover:bg-slate-50 dark:hover:bg-zinc-800"
            >
              {obsidianSaved ? OBSIDIAN_ROW_SAVED_LABEL : OBSIDIAN_ROW_SAVE_LABEL}
            </button>
          )}
          {onWorkspace && (
            <button
              type="button"
              onClick={() => fire(onWorkspace)}
              title={workspaceSaved ? 'פתח ב-Workspace' : 'שמור ל-Workspace'}
              className="block w-full px-3 py-1.5 text-right text-xs hover:bg-slate-50 dark:hover:bg-zinc-800"
            >
              {workspaceSaved ? '✓⭐ פתח ב-Workspace' : '⭐ שמור ל-Workspace'}
            </button>
          )}
        </div>
      </details>
    );
  }

  return (
    <div className={`flex items-center gap-0.5 shrink-0 ${VISIBILITY_CLS} ${className}`}>
      {onBrain ? (
        <button
          type="button"
          onClick={() => fire(onBrain)}
          title={brainSaved ? 'פתח פריט במוח' : 'שמור למוח'}
          className={`${BTN_CLS} ${
            brainSaved
              ? SAVED_BTN_CLS
              : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
          }`}
        >
          {brainSaved ? '✓🧠' : '🧠'}
        </button>
      ) : null}
      {onObsidian ? (
        <button
          type="button"
          onClick={() => fire(onObsidian)}
          title={obsidianSaved ? 'פתח ב-Obsidian' : 'שמור ל-Obsidian'}
          aria-label={obsidianSaved ? OBSIDIAN_ROW_SAVED_LABEL : OBSIDIAN_ROW_SAVE_LABEL}
          className={cn(
            OBSIDIAN_BADGE_BASE,
            obsidianSaved ? OBSIDIAN_BADGE_SAVED_CLS : OBSIDIAN_BADGE_UNSAVED_CLS,
          )}
        >
          {obsidianSaved ? OBSIDIAN_ROW_SAVED_LABEL : OBSIDIAN_ROW_SAVE_LABEL}
        </button>
      ) : null}
      {onWorkspace ? (
        <button
          type="button"
          onClick={() => fire(onWorkspace)}
          title={workspaceSaved ? 'פתח ב-Workspace' : 'שמור ל-Workspace'}
          className={`${BTN_CLS} ${
            workspaceSaved
              ? SAVED_BTN_CLS
              : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30'
          }`}
        >
          {workspaceSaved ? '✓⭐' : '⭐'}
        </button>
      ) : null}
    </div>
  );
}

/** Render quick save from bulkSelection context + row text. */
export function UniversalTabQuickSaveFromBulk({
  bulkSelection,
  text,
  sectionLabel,
  type,
  tabScope,
  timestamp,
  brainSaved,
  obsidianSaved,
  workspaceSaved,
  compact = false,
  className = '',
}) {
  if (!bulkSelection?.onQuickSaveBrain && !bulkSelection?.onQuickSaveObsidian && !bulkSelection?.onQuickSaveWorkspace) {
    return null;
  }
  const meta = buildQuickSaveMeta({
    text,
    sectionLabel: sectionLabel ?? bulkSelection.sectionLabel,
    type: type ?? bulkSelection.type,
    tabScope: tabScope ?? bulkSelection.tabScope,
    timestamp,
  });
  const tabKey = meta.type || meta.tabScope || 'multi';
  // Revision bumps after localStorage item saves — forces fresh read of per-row Obsidian state.
  void bulkSelection?.obsidianItemSaveRevision;
  const savedBrain = brainSaved ?? bulkSelection.isBrainSaved?.(meta.text, tabKey);
  const savedObsidian = obsidianSaved ?? bulkSelection.isObsidianSaved?.(meta.text, tabKey, meta.sectionLabel);
  const savedWorkspace = workspaceSaved ?? bulkSelection.isWorkspaceSaved?.(meta.text, tabKey);

  return (
    <UniversalTabQuickSaveActions
      meta={meta}
      onBrain={bulkSelection.onQuickSaveBrain}
      onObsidian={bulkSelection.onQuickSaveObsidian}
      onWorkspace={bulkSelection.onQuickSaveWorkspace}
      brainSaved={!!savedBrain}
      obsidianSaved={!!savedObsidian}
      workspaceSaved={!!savedWorkspace}
      compact={compact}
      className={className}
    />
  );
}
