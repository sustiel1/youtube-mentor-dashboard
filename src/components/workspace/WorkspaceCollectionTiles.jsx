import { useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  WORKSPACE_COLLECTION_HEADINGS,
  WORKSPACE_FALLBACK_COLLECTION,
} from '@/config/workspaceHeadingRegistry';
import { toggleWorkspaceCollectionSelection } from '@/lib/workspaceLibraryRoute';

export function WorkspaceCollectionTiles({ counts, activeCollection, onSelect, scopeLabel }) {
  const tabRefs = useRef([]);
  const collections = WORKSPACE_COLLECTION_HEADINGS;
  const primaryIds = new Set(collections.map(collection => collection.id));
  const selectedId = activeCollection && primaryIds.has(activeCollection) ? activeCollection : null;
  const fallbackCount = counts?.[WORKSPACE_FALLBACK_COLLECTION.id] || {};

  const selectCollection = collectionId => onSelect(toggleWorkspaceCollectionSelection(selectedId, collectionId));
  const handleKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === 'ArrowLeft') nextIndex = (index + 1) % collections.length;
    if (event.key === 'ArrowRight') nextIndex = (index - 1 + collections.length) % collections.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = collections.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    tabRefs.current[nextIndex]?.focus();
    selectCollection(collections[nextIndex].id);
  };

  return (
    <section aria-labelledby="workspace-collections-heading" className="space-y-3">
      <div>
        <h2 id="workspace-collections-heading" className="text-xl font-extrabold text-slate-900 dark:text-zinc-100">אוספים</h2>
        {scopeLabel && <p className="text-sm text-slate-500 dark:text-zinc-400">{scopeLabel}</p>}
      </div>
      <div
        role="tablist"
        aria-label={`אוספי תוכן שמור · ${scopeLabel || 'הספרייה'}`}
        className="grid grid-flow-col auto-cols-[minmax(220px,1fr)] gap-3 overflow-x-auto pb-2 sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 xl:grid-cols-5"
      >
        {collections.map((collection, index) => {
          const selected = selectedId === collection.id;
          const count = counts?.[collection.id] || {};
          return (
            <button
              key={collection.id}
              ref={element => { tabRefs.current[index] = element; }}
              role="tab"
              type="button"
              tabIndex={selected || (!selectedId && index === 0) ? 0 : -1}
              aria-selected={selected}
              aria-label={`הצג ${collection.label} · ${scopeLabel || 'הספרייה'}`}
              onClick={() => selectCollection(collection.id)}
              onKeyDown={event => handleKeyDown(event, index)}
              className={cn(
                'min-h-36 rounded-2xl border p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950',
                selected
                  ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/30'
                  : 'border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
              )}
            >
              <span className="text-3xl" aria-hidden="true">{collection.emoji}</span>
              <span className="mt-3 block text-lg font-extrabold text-slate-900 dark:text-zinc-100">{collection.label}</span>
              <span className="mt-1 block text-sm text-slate-500 dark:text-zinc-400">
                {count.uniqueCount || 0} ייחודיים · {count.recordCount || 0} שמירות
                {count.videoCount ? ` · ${count.videoCount === 1 ? 'סרטון אחד' : `${count.videoCount} סרטונים`}` : ''}
              </span>
              <span className="mt-1 block text-xs text-slate-400 dark:text-zinc-500">{collection.description}</span>
            </button>
          );
        })}
      </div>
      {(fallbackCount.recordCount > 0 || activeCollection === WORKSPACE_FALLBACK_COLLECTION.id) && (
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900" open={activeCollection === WORKSPACE_FALLBACK_COLLECTION.id}>
          <summary className="cursor-pointer text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-200">
            {WORKSPACE_FALLBACK_COLLECTION.emoji} {WORKSPACE_FALLBACK_COLLECTION.label} ({fallbackCount.uniqueCount || 0})
          </summary>
          <button
            type="button"
            aria-pressed={activeCollection === WORKSPACE_FALLBACK_COLLECTION.id}
            aria-label={`הצג ${WORKSPACE_FALLBACK_COLLECTION.label} · ${scopeLabel || 'הספרייה'}`}
            onClick={() => onSelect(toggleWorkspaceCollectionSelection(activeCollection, WORKSPACE_FALLBACK_COLLECTION.id))}
            className="mt-3 w-full rounded-lg border border-slate-200 px-4 py-3 text-right text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {WORKSPACE_FALLBACK_COLLECTION.description} · {fallbackCount.recordCount || 0} שמירות
          </button>
        </details>
      )}
    </section>
  );
}
