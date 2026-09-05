import { Star, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Inline per-row status indicator for saved-analysis content rows (bullet
// entries etc.): rendered as the trailing child inside the row's own text
// span (not a separate column) so it flows with the sentence and wraps
// naturally. Small tinted chips (icon + Hebrew label) — same tint language
// as WorkspaceItemFlagToggles.jsx's active state (amber/red/blue) and the
// same icon set as WorkspaceBulkActionBar.jsx (Star/AlertCircle/RotateCcw),
// just scaled down and carrying a label so it reads as a tag, not a button.
// Renders ONLY active statuses — no placeholders — unlike
// WorkspaceItemFlagToggles which always shows all 3, muted when inactive.
const BADGE_DEFS = {
  favorite: {
    Icon: Star,
    label: 'מועדפים',
    chipClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
  important: {
    Icon: AlertCircle,
    label: 'חשוב',
    chipClass: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  },
  mustWatch: {
    Icon: RotateCcw,
    label: 'לצפות שוב',
    chipClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  },
};

export function WorkspaceRowStatusBadges({ activeKeys = [], onRemove, className }) {
  if (!activeKeys.length) return null;
  return (
    <span
      dir="rtl"
      className={cn('ms-1.5 inline-flex flex-wrap items-center gap-1 align-middle', className)}
    >
      {activeKeys.map((key) => {
        const def = BADGE_DEFS[key];
        if (!def) return null;
        const { Icon, label, chipClass } = def;
        return (
          <button
            key={key}
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove?.(key); }}
            title={`מסומן כ${label} — לחץ להסרה`}
            aria-label={`מסומן כ${label} — לחץ להסרה`}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap transition-opacity hover:opacity-75',
              chipClass,
            )}
          >
            <Icon className="h-2.5 w-2.5 shrink-0" fill="currentColor" aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </span>
  );
}
