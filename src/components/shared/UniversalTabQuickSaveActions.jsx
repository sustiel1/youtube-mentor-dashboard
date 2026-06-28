/**
 * Per-row quick save actions — Brain / Obsidian / Workspace / Copy.
 * Compact mode uses a React portal dropdown (fixed position) so it is never
 * clipped by parent cards that use overflow:hidden.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { extractQueryFromPxUrl, openGoogleFinance } from '@/components/shared/ResearchDropdown';

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

// Estimated height used only for up/down auto-detection.
// Actual value: ~30px × rows + 16px overhead, max ~160px.
const MENU_HEIGHT_ESTIMATE = 168;

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

// ── Portal dropdown — escapes overflow:hidden parent cards ───────────

function CompactSaveMenu({
  payload,
  onBrain,
  onObsidian,
  onWorkspace,
  brainSaved,
  obsidianSaved,
  workspaceSaved,
  pxUrl,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const menuRef    = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setCoords(null);
  }, []);

  const fire = useCallback((handler) => {
    close();
    if (handler) handler(payload);
  }, [close, payload]);

  const handleCopy = useCallback(() => {
    close();
    const lines = [];
    if (payload.sectionLabel) lines.push(`## ${payload.sectionLabel}`);
    lines.push(payload.text);
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  }, [close, payload]);

  // Calculate fixed position from trigger bounding rect when opening
  useEffect(() => {
    if (!open || !triggerRef.current) { setCoords(null); return; }
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < MENU_HEIGHT_ESTIMATE && rect.top >= MENU_HEIGHT_ESTIMATE;

    // Left-align menu with trigger left edge; clamp so it stays on-screen
    const menuWidth = 168;
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (left < 8) left = 8;

    setCoords({
      left,
      top: openUp ? rect.top - MENU_HEIGHT_ESTIMATE - 4 : rect.bottom + 4,
    });
  }, [open]);

  // Close on outside mousedown and on any scroll
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        close();
      }
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', onDown);
    // capture:true catches scroll on any scrollable ancestor, not just window
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, close]);

  return (
    <div className={`relative shrink-0 ${VISIBILITY_CLS} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${BTN_CLS} text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer select-none`}
        aria-label="פעולות"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        ⋯
      </button>

      {open && coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            dir="rtl"
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="z-[9999] min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            {onBrain && (
              <button
                type="button"
                role="menuitem"
                onClick={() => fire(onBrain)}
                className="block w-full px-3 py-1.5 text-right text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200"
              >
                {brainSaved ? '✓🧠 פתח במוח' : '🧠 שמור למוח'}
              </button>
            )}
            {onObsidian && (
              <button
                type="button"
                role="menuitem"
                onClick={() => fire(onObsidian)}
                className="block w-full px-3 py-1.5 text-right text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200"
              >
                {obsidianSaved ? '✅ נשמר ל-Obsidian' : '🟣 שמור ל-Obsidian'}
              </button>
            )}
            {onWorkspace && (
              <button
                type="button"
                role="menuitem"
                onClick={() => fire(onWorkspace)}
                className="block w-full px-3 py-1.5 text-right text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200"
              >
                {workspaceSaved ? '✓⭐ פתח ב-Workspace' : '⭐ שמור ל-Workspace'}
              </button>
            )}
            <div className="my-0.5 border-t border-slate-100 dark:border-zinc-800" />
            <button
              type="button"
              role="menuitem"
              onClick={handleCopy}
              className="block w-full px-3 py-1.5 text-right text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400"
            >
              📋 העתק
            </button>
            {pxUrl && (
              <>
                <div className="my-0.5 border-t border-slate-100 dark:border-zinc-800" />
                <a
                  href={pxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  onClick={() => close()}
                  className="block w-full px-3 py-1.5 text-right text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                >
                  🔍 מחקר AI — פרפלקסיטי
                </a>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { close(); openGoogleFinance(extractQueryFromPxUrl(pxUrl)); }}
                  className="block w-full px-3 py-1.5 text-right text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                >
                  📊 מחקר AI — Google Finance
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────

export function UniversalTabQuickSaveActions({
  meta,
  onBrain,
  onObsidian,
  onWorkspace,
  brainSaved = false,
  obsidianSaved = false,
  workspaceSaved = false,
  pxUrl,
  className = '',
  compact = false,
}) {
  const payload = buildQuickSaveMeta(meta);
  if (!payload.text) return null;
  if (!onBrain && !onObsidian && !onWorkspace && !pxUrl) return null;

  if (compact) {
    return (
      <CompactSaveMenu
        payload={payload}
        onBrain={onBrain}
        onObsidian={onObsidian}
        onWorkspace={onWorkspace}
        brainSaved={brainSaved}
        obsidianSaved={obsidianSaved}
        workspaceSaved={workspaceSaved}
        pxUrl={pxUrl}
        className={className}
      />
    );
  }

  // Non-compact: inline icon buttons (no dropdown needed)
  return (
    <div className={`flex items-center gap-0.5 shrink-0 ${VISIBILITY_CLS} ${className}`}>
      {onBrain ? (
        <button
          type="button"
          onClick={() => onBrain && onBrain(payload)}
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
          onClick={() => onObsidian && onObsidian(payload)}
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
          onClick={() => onWorkspace && onWorkspace(payload)}
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
  pxUrl,
  compact = true,
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
  const savedBrain     = brainSaved     ?? bulkSelection.isBrainSaved?.(meta.text, tabKey);
  const savedObsidian  = obsidianSaved  ?? bulkSelection.isObsidianSaved?.(meta.text, tabKey, meta.sectionLabel);
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
      pxUrl={pxUrl}
      compact={compact}
      className={className}
    />
  );
}
