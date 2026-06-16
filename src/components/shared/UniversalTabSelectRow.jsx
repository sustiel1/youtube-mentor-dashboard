import { cn } from '@/lib/utils';

/** Fixed-width checkbox column — always on the far right in RTL rows. */
export const UNIVERSAL_TAB_CHECKBOX_COL_CLASS =
  'flex w-8 shrink-0 items-start justify-start pt-0.5';

/** Table cell variant — checkbox column on the far right in RTL tables. */
export const UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS =
  'w-8 shrink-0 px-2 py-2.5 align-top text-center';

export const UNIVERSAL_TAB_CHECKBOX_INPUT_CLASS =
  'h-4 w-4 rounded cursor-pointer accent-indigo-600';

export const UNIVERSAL_TAB_ROW_CLASS =
  'flex w-full items-start gap-3';

export const UNIVERSAL_TAB_CONTENT_CLASS =
  'min-w-0 flex-1 text-right leading-[1.7]';

export const UNIVERSAL_TAB_ACTIONS_CLASS =
  'flex shrink-0 items-center gap-1 self-center';

/**
 * RTL bulk-select row shell.
 * DOM order: [checkbox col][content][actions] → visual RTL: checkbox right, content full width, actions far left.
 */
export function UniversalTabSelectRow({
  children,
  checkbox = null,
  actions = null,
  className,
  contentClassName,
  actionsClassName,
  ...rest
}) {
  return (
    <div dir="rtl" className={cn(UNIVERSAL_TAB_ROW_CLASS, className)} {...rest}>
      {checkbox != null ? (
        <div className={UNIVERSAL_TAB_CHECKBOX_COL_CLASS}>{checkbox}</div>
      ) : null}
      <div className={cn(UNIVERSAL_TAB_CONTENT_CLASS, contentClassName)}>{children}</div>
      {actions ? (
        <div className={cn(UNIVERSAL_TAB_ACTIONS_CLASS, actionsClassName)}>{actions}</div>
      ) : null}
    </div>
  );
}

export function UniversalTabCheckbox({
  checked,
  onChange,
  disabled = false,
  className,
  'aria-label': ariaLabel = 'בחר פריט',
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        UNIVERSAL_TAB_CHECKBOX_INPUT_CLASS,
        disabled && 'cursor-not-allowed opacity-30',
        className,
      )}
    />
  );
}
