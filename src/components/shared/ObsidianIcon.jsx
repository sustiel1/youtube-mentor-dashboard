import { cn } from '@/lib/utils';

/** Official Obsidian crystal logo (Simple Icons path, currentColor for theme). */
export function ObsidianIcon({
  className = 'h-3.5 w-3.5',
  title,
  ...props
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden={title ? undefined : true}
      className={cn('shrink-0', className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M12.006 0v7.278l7.095 4.129 2.898-1.614V3.334L12.006 0zm8.993 5.772l-2.898 1.614V18.06l2.898 1.614V5.772zM12.006 24l7.095-4.128V16.74l-2.898 1.614V8.646l-4.197-2.445V24zM3.01 18.06V5.772L.112 4.158V19.88L12.006 24v-2.654L3.01 18.06z"
      />
    </svg>
  );
}

export function ObsidianSaveLabel({
  text = 'שמור ל-Obsidian',
  iconClassName,
  className,
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <ObsidianIcon
        className={cn('h-3.5 w-3.5 text-violet-500 dark:text-violet-400', iconClassName)}
        title="Obsidian"
      />
      <span>{text}</span>
    </span>
  );
}

export function ObsidianFooterLabel({ iconClassName, className }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <ObsidianIcon className={cn('h-3.5 w-3.5', iconClassName)} title="Obsidian" />
      <span>Obsidian</span>
    </span>
  );
}
