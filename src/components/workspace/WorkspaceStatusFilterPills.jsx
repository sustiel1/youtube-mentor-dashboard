import { cn } from '@/lib/utils';

// Additive multi-select status filters (favorite/important/must-watch-again).
// Styled to match WorkspaceContentSectionTabs' pill-capsule redesign (same
// container + active/inactive classes), but implemented as its own
// role="group" of toggle buttons rather than injected into that component's
// role="tablist" — that tablist is single-select by design (aria-selected on
// one tab), while these three filters must combine additively (AND), so
// reusing its exact visual language without its selection semantics keeps
// both correct.
const STATUS_PILL_DEFS = [
  { key: 'favorite',  field: 'isFavorite',     icon: '⭐', label: 'מועדפים' },
  { key: 'important', field: 'isImportant',    icon: '🔴', label: 'חשוב' },
  { key: 'mustWatch', field: 'mustWatchAgain', icon: '🔁', label: 'לצפות שוב' },
];

export function WorkspaceStatusFilterPills({ active, counts, onToggle }) {
  return (
    <div
      role="group"
      aria-label="סינון לפי סטטוס"
      dir="rtl"
      className="flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-100/60 p-1.5 dark:border-zinc-700/60 dark:bg-zinc-800/50"
    >
      {STATUS_PILL_DEFS.map(({ key, icon, label }) => {
        const isActive = !!active?.[key];
        const count = counts?.[key] ?? 0;
        const isEmpty = count === 0;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            disabled={isEmpty}
            title={label}
            onClick={() => onToggle(key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 focus-visible:rounded-full',
              isActive
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
              isEmpty && 'opacity-40 cursor-not-allowed pointer-events-none',
            )}
          >
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none',
                isActive
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
