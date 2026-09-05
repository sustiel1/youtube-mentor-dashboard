import { Star, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Always-visible one-click icon toggles for a single saved item's status
// flags (isFavorite / isImportant / mustWatchAgain). No menu, no hover
// requirement — mirrors the same three flags already readable/writable via
// EditWorkspaceItemModal's flags editor and the search-row status filters,
// just exposed inline on the row itself.
const FLAG_DEFS = [
  {
    key: 'favorite',
    field: 'isFavorite',
    Icon: Star,
    label: 'מועדפים',
    activeClass: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40',
  },
  {
    key: 'important',
    field: 'isImportant',
    Icon: AlertCircle,
    label: 'חשוב',
    activeClass: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/40',
  },
  {
    key: 'mustWatch',
    field: 'mustWatchAgain',
    Icon: RotateCcw,
    label: 'לצפות שוב',
    activeClass: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40',
  },
];

export function WorkspaceItemFlagToggles({ flags, onToggle, className }) {
  return (
    <div dir="rtl" className={cn('flex items-center gap-0.5', className)}>
      {FLAG_DEFS.map(({ key, field, Icon, label, activeClass }) => {
        const isActive = !!flags?.[field];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            aria-label={isActive ? `הסר מ${label}` : `סמן כ${label}`}
            title={label}
            onClick={(e) => { e.stopPropagation(); onToggle(key); }}
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
              isActive
                ? activeClass
                : 'text-slate-300 hover:text-slate-500 dark:text-zinc-600 dark:hover:text-zinc-400',
            )}
          >
            <Icon className="h-3.5 w-3.5" fill={isActive ? 'currentColor' : 'none'} />
          </button>
        );
      })}
    </div>
  );
}
