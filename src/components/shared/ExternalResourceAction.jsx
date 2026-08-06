export function ExternalResourceAction({
  href,
  label,
  title,
  ariaLabel = title,
  className = '',
  dataAttributes = {},
}) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={ariaLabel}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === ' ') {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
      className={`inline-flex shrink-0 items-center rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 no-underline hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 ${className}`.trim()}
      {...dataAttributes}
    >
      {label}
    </a>
  );
}
