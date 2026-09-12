import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { buildStaticYouTubeTimestampLink, formatStaticVideoTimestamp, resolveStaticVideoTimestamp } from '@/lib/staticVideoTimestamp';
import { rowTextOf } from '@/lib/rowExtraction';
import { deleteManualRowTimestamp, getManualRowTimestamp, parseManualTimestampInput, setManualRowTimestamp } from '@/lib/manualRowTimestamp';

const SUPPORTED_ROW_TIMESTAMP_TABS = new Set(['summary', 'insights', 'useful-knowledge', 'specialized']);
const RowTimestampContext = createContext(null);

export function StaticVideoTimestampProvider({ youtubeId = null, videoId = null, activeTab, resolver = null, children }) {
  const canonicalYoutubeId = youtubeId || videoId;
  return (
    <RowTimestampContext.Provider value={{ youtubeId: canonicalYoutubeId, activeTab, resolver }}>
      {children}
    </RowTimestampContext.Provider>
  );
}

function withSidecarTimestamp(videoId, items, context, identity = {}) {
  const candidates = (Array.isArray(items) ? items : [items]).filter(Boolean);
  const youtubeId = videoId || context?.youtubeId || null;
  const fallbackItem = candidates.length === 1 ? candidates[0] : null;
  if (!context || !youtubeId || context.youtubeId !== youtubeId || !SUPPORTED_ROW_TIMESTAMP_TABS.has(context.activeTab)) {
    return { item: fallbackItem, youtubeId, mapped: false };
  }

  const matches = candidates.map((item, index) => {
    const canonicalSourceText = candidates.length === 1 && identity.canonicalSourceText
      ? identity.canonicalSourceText
      : rowTextOf(item).trim();
    if (!canonicalSourceText) return null;
    const resolved = context.resolver?.resolve({
      tab: context.activeTab,
      section: identity.section,
      productionRowId: identity.productionRowId ? `${identity.productionRowId}${candidates.length > 1 ? `:${index}` : ''}` : null,
      legacyRowPath: identity.legacyRowPath,
      sourceItem: item,
      canonicalSourceText,
      displayText: identity.displayText || rowTextOf(item).trim(),
    });
    return resolved ? { item, ...resolved } : null;
  }).filter(Boolean);
  const uniqueMatches = [...new Map(matches.map((match) => [match.descriptor.legacyRowPath, match])).values()];
  if (uniqueMatches.length !== 1) return { item: fallbackItem, youtubeId, mapped: false };

  const [{ item, annotation }] = uniqueMatches;
  const source = typeof item === 'string' ? { text: item } : { ...item };
  return {
    item: {
      ...source,
      estimatedStartSeconds: annotation.estimatedStartSeconds,
      estimatedEndSeconds: annotation.estimatedEndSeconds ?? null,
      timestampKind: 'estimated',
      timestampSource: 'row-timestamp-opt-in',
      timestampConfidence: annotation.timestampConfidence ?? null,
      sourceQuote: annotation.sourceQuote,
    },
    youtubeId,
    mapped: true,
  };
}

/**
 * Resolves everything one row needs to render its timestamp pill + edit
 * affordance: the AI/opt-in-mapped link (existing behavior, unchanged) and
 * any manual override for the same (youtubeId, row text) — which, when
 * present, wins over the AI-estimated value. Plain function (no hooks) so
 * it's safe to call from either exported component below.
 */
function resolveManualTimestamp(videoId, item, items, identity, context) {
  const resolved = withSidecarTimestamp(videoId, items || item, context, identity);
  const candidates = (Array.isArray(items || item) ? (items || item) : [items || item]).filter(Boolean);
  const fallbackItem = candidates.length === 1 ? candidates[0] : null;
  const manualText = (identity.displayText || (fallbackItem ? rowTextOf(fallbackItem) : '')).trim();
  const youtubeId = resolved.youtubeId;
  const manual = youtubeId && manualText ? getManualRowTimestamp(youtubeId, manualText) : null;
  const effectiveItem = manual ? { exactStartSeconds: manual.seconds } : resolved.item;
  const link = buildStaticYouTubeTimestampLink(youtubeId, effectiveItem);
  return { resolved, youtubeId, manualText, manual, link };
}

function TimestampAnchor({ link, mapped = false }) {
  return (
    <a
      href={link.href}
      target={link.target}
      rel={link.rel}
      aria-label={link.ariaLabel}
      title={link.ariaLabel}
      data-static-video-time={link.estimated ? 'estimated' : 'exact'}
      data-row-timestamp-mapped={mapped ? 'true' : undefined}
      dir="ltr"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex min-h-9 max-w-full shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-semibold leading-none text-slate-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
    >
      {mapped ? `✓ ${link.visibleLabel}` : link.visibleLabel}
    </a>
  );
}

/** Small inline "MM:SS" editor popover — add or correct one row's manual timestamp. */
function ManualTimestampEditor({ initialSeconds, onSave, onDelete, onCancel }) {
  const [value, setValue] = useState(initialSeconds != null ? formatStaticVideoTimestamp(initialSeconds) : '');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) onCancel();
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onCancel]);

  const submit = () => {
    const seconds = parseManualTimestampInput(value);
    if (seconds === null) {
      setError('פורמט לא תקין. הזן MM:SS (למשל 06:25)');
      return;
    }
    onSave(seconds);
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="הזנת זמן ידני"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      dir="rtl"
      className="absolute top-full right-0 z-20 mt-1 flex w-36 flex-col gap-1.5 rounded-md border border-slate-200 bg-white p-2 text-right shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="MM:SS"
        dir="ltr"
        value={value}
        onChange={(event) => { setValue(event.target.value); setError(null); }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
          if (event.key === 'Escape') onCancel();
        }}
        className="w-full rounded border border-slate-300 px-2 py-1 text-center font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
      />
      {error && <span className="text-[10px] leading-snug text-red-600 dark:text-red-400">{error}</span>}
      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <button type="button" onClick={submit} className="rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-indigo-700">
            שמור
          </button>
          <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-2 py-0.5 text-[11px] dark:border-zinc-600 dark:text-zinc-300">
            ביטול
          </button>
        </div>
        {onDelete && (
          <button type="button" onClick={onDelete} className="text-[11px] text-red-600 hover:underline dark:text-red-400">
            מחק
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the pill (if any) plus the add/edit affordance for one row.
 * Purely presentational — `isEditing` lives in the caller (StaticVideoTimestampLink /
 * StaticVideoTimestampActions) so that saving/deleting also re-renders the
 * part of the tree that reads localStorage via resolveManualTimestamp();
 * owning the open/close state locally here would close the popover without
 * ever re-resolving the just-written value, leaving the pill stale.
 */
function TimestampWithEdit({
  youtubeId, manualText, manual, underlyingItem, link, mapped,
  isEditing, onOpenEdit, onToggleEdit, onSaveEdit, onDeleteEdit, onCancelEdit,
}) {
  if (!youtubeId || !manualText) {
    return link ? <TimestampAnchor link={link} mapped={mapped} /> : null;
  }

  const prefillSeconds = manual?.seconds ?? resolveStaticVideoTimestamp(underlyingItem)?.seconds ?? null;
  const revealCls = 'opacity-100 max-md:opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity';

  return (
    <span className="relative inline-flex items-center gap-0.5">
      {link ? (
        <>
          <TimestampAnchor link={link} mapped={mapped} />
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onToggleEdit(); }}
            title="ערוך זמן"
            aria-label="ערוך את זמן הסרטון של השורה"
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 ${revealCls}`}
          >
            ✎
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onOpenEdit(); }}
          title="הוסף זמן בסרטון"
          aria-label="הוסף זמן בסרטון לשורה זו"
          className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 px-1 text-[11px] text-slate-400 hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-indigo-700 dark:hover:text-indigo-300 ${revealCls}`}
        >
          🕐
        </button>
      )}
      {isEditing && (
        <ManualTimestampEditor
          initialSeconds={prefillSeconds}
          onSave={onSaveEdit}
          onDelete={manual ? onDeleteEdit : null}
          onCancel={onCancelEdit}
        />
      )}
    </span>
  );
}

/** Shared open/save/delete state + handlers for the two exported components below. */
function useManualTimestampEditing(youtubeId, manualText) {
  const [isEditing, setIsEditing] = useState(false);
  return {
    isEditing,
    onOpenEdit: () => setIsEditing(true),
    onToggleEdit: () => setIsEditing((v) => !v),
    onCancelEdit: () => setIsEditing(false),
    onSaveEdit: (seconds) => {
      setManualRowTimestamp(youtubeId, manualText, seconds);
      setIsEditing(false);
    },
    onDeleteEdit: () => {
      deleteManualRowTimestamp(youtubeId, manualText);
      setIsEditing(false);
    },
  };
}

export function StaticVideoTimestampLink({ videoId = null, item = null, items = null, ...identity }) {
  const context = useContext(RowTimestampContext);
  const { resolved, youtubeId, manualText, manual, link } = resolveManualTimestamp(videoId, item, items, identity, context);
  const editing = useManualTimestampEditing(youtubeId, manualText);
  if (!link && !(youtubeId && manualText)) return null;
  return (
    <TimestampWithEdit
      youtubeId={youtubeId}
      manualText={manualText}
      manual={manual}
      underlyingItem={resolved.item}
      link={link}
      mapped={manual ? false : resolved.mapped}
      {...editing}
    />
  );
}

export function StaticVideoTimestampActions({ videoId = null, item = null, items = null, children = null, ...identity }) {
  const context = useContext(RowTimestampContext);
  const { resolved, youtubeId, manualText, manual, link } = resolveManualTimestamp(videoId, item, items, identity, context);
  const editing = useManualTimestampEditing(youtubeId, manualText);
  const canEdit = Boolean(youtubeId && manualText);
  if (!link && !canEdit && !children) return null;

  return (
    <div className="flex items-center gap-1">
      <TimestampWithEdit
        youtubeId={youtubeId}
        manualText={manualText}
        manual={manual}
        underlyingItem={resolved.item}
        link={link}
        mapped={manual ? false : resolved.mapped}
        {...editing}
      />
      {children}
    </div>
  );
}
