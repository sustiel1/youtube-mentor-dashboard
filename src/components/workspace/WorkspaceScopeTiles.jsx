import { useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * The "כל הסרטונים" / "סרטון אחרון" scope row — sits above the category
 * tiles (WorkspaceCollectionTiles) and controls which video's content those
 * category tiles are scoped to. Deliberately not merged into
 * WorkspaceCollectionTiles: that grid's tabs deselect on a repeat click,
 * while exactly one scope tile must always stay active (its onSelect is
 * expected to already be a no-op for the already-active tile — see
 * WorkspaceLibrary.jsx's `scopeTiles` memo). Visual/tile styling and the
 * roving-tabindex arrow-key pattern are copied from WorkspaceCollectionTiles'
 * tab buttons so the two rows read and behave as one family, just at a
 * smaller scale for a 2-item row.
 */
export function WorkspaceScopeTiles({ tiles }) {
  const tabRefs = useRef([]);
  if (!tiles?.length) return null;

  const handleKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === 'ArrowLeft') nextIndex = (index + 1) % tiles.length;
    if (event.key === 'ArrowRight') nextIndex = (index - 1 + tiles.length) % tiles.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tiles.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    tabRefs.current[nextIndex]?.focus();
    tiles[nextIndex].onSelect?.();
  };

  return (
    <div role="tablist" aria-label="טווח הצגה" className="grid grid-cols-2 gap-3 sm:max-w-md">
      {tiles.map((tile, index) => (
        <button
          key={tile.id}
          ref={element => { tabRefs.current[index] = element; }}
          type="button"
          role="tab"
          tabIndex={tile.selected ? 0 : -1}
          aria-selected={tile.selected}
          aria-label={`הצג ${tile.label}`}
          onClick={tile.onSelect}
          onKeyDown={event => handleKeyDown(event, index)}
          className={cn(
            'min-h-24 rounded-2xl border p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950',
            tile.selected
              ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/30'
              : 'border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
          )}
        >
          <span className="text-2xl" aria-hidden="true">{tile.emoji}</span>
          <span className="mt-1 block text-base font-extrabold text-slate-900 dark:text-zinc-100">{tile.label}</span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-zinc-400">
            {tile.count?.uniqueCount || 0} ייחודיים · {tile.count?.recordCount || 0} שמירות
            {tile.count?.videoCount ? ` · ${tile.count.videoCount === 1 ? 'סרטון אחד' : `${tile.count.videoCount} סרטונים`}` : ''}
          </span>
        </button>
      ))}
    </div>
  );
}
