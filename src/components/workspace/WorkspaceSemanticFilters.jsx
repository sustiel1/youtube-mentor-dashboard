import { cn } from '@/lib/utils';
import { MARKET_SEMANTIC_FALLBACK, MARKET_SEMANTIC_FILTERS } from '@/utils/workspaceMarketDimensions';

export function WorkspaceSemanticFilters({ counts = {}, selected = [], onToggle, onClear }) {
  const definitions = [...MARKET_SEMANTIC_FILTERS, MARKET_SEMANTIC_FALLBACK];
  return (
    <details className="border-t border-slate-100 bg-slate-50/30 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-800/10">
      <summary className="cursor-pointer text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-200">
        סינון לפי תוכן{selected.length > 0 ? ` (${selected.length} פעילים)` : ''}
      </summary>
      <div className="mt-3 space-y-3" aria-label="מסנני תוכן סמנטיים">
        <p className="text-xs text-slate-500 dark:text-zinc-400">המסננים אינם משנים בעלות על נושא או תת־נושא. בחירה מרובה מציגה התאמה לאחד המסננים.</p>
        <div className="flex flex-wrap gap-2">
          {definitions.map(definition => {
            const active = selected.includes(definition.id);
            const count = counts[definition.id] || 0;
            return (
              <button
                key={definition.id}
                type="button"
                aria-pressed={active}
                aria-label={`סנן לפי ${definition.label}, ${count} תכנים ייחודיים`}
                onClick={() => onToggle(definition.id)}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  active
                    ? 'border-teal-600 bg-teal-600 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-zinc-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
                )}
              >
                {definition.label} ({count})
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <button type="button" onClick={onClear} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            נקה סינון
          </button>
        )}
      </div>
    </details>
  );
}
