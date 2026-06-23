/**
 * Morning Brief section source badge — AI vs Manual.
 * Single rendering path for all Hebrew Content / Morning Brief section headers.
 */

/** Set to false to hide AI/Manual source badges across all Morning Brief sections. */
export const MORNING_BRIEF_SHOW_AI_SOURCE_BADGE = true;

const BADGE_BASE_CLS =
  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold shrink-0';

const VARIANT_STYLE = {
  ai: 'text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800/60',
  manual: 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40',
};

const VARIANT_META = {
  ai: {
    icon: '🤖',
    label: 'AI',
    title: 'תוכן שנוצר או נשמר מניתוח AI',
  },
  manual: {
    icon: '✏️',
    label: 'Manual',
    title: 'תוכן שעודכן ידנית',
  },
};

/**
 * @param {'ai' | 'manual'} [source]
 * @param {boolean} [showAiBadge] — overrides MORNING_BRIEF_SHOW_AI_SOURCE_BADGE when set
 * @param {string} [label] — override label text
 * @param {string} [icon] — override icon
 * @param {string} [title] — tooltip
 */
export function AiSourceBadge({
  source = 'ai',
  showAiBadge,
  label,
  icon,
  title,
  className = '',
  dataManualSource,
}) {
  const visible = showAiBadge ?? MORNING_BRIEF_SHOW_AI_SOURCE_BADGE;
  if (!visible) return null;

  const variant = source === 'manual' ? 'manual' : 'ai';
  const meta = VARIANT_META[variant];
  const displayIcon = icon ?? meta.icon;
  const displayLabel = label ?? meta.label;
  const displayTitle = title ?? meta.title;

  return (
    <span
      className={`${BADGE_BASE_CLS} ${VARIANT_STYLE[variant]} ${className}`.trim()}
      title={displayTitle}
      data-manual-source={dataManualSource ?? source}
      dir="rtl"
    >
      {displayIcon && <span aria-hidden>{displayIcon}</span>}
      <span>{displayLabel}</span>
    </span>
  );
}

/** @deprecated Use AiSourceBadge — kept for imports that reference ManualSourceBadge by name. */
export const SectionAiBadge = AiSourceBadge;
