import { cn } from "@/lib/utils";

/**
 * Reusable rounded content shell for Workspace screens — full-width card with
 * a subtle border/shadow, used to frame table/list content consistently.
 */
export function WorkspaceContentCard({ children, className = '' }) {
  return (
    <div className={cn(
      'w-full rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden',
      className,
    )}>
      {children}
    </div>
  );
}
