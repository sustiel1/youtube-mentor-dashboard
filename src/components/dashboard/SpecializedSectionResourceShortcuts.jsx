import { getSpecializedSectionResources } from '@/lib/specializedSectionResources';

export function SpecializedSectionResourceShortcuts({ sectionKey }) {
  const resources = getSpecializedSectionResources(sectionKey);
  if (resources.length === 0) return null;

  const renderResource = (resource) => {
    const controlClass = 'inline-flex h-7 max-w-full items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 no-underline shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800';
    if (resource.kind === 'info') {
      return (
        <details key={resource.key} className="relative" data-section-resource={resource.key}>
          <summary
            className={`${controlClass} cursor-pointer list-none`}
            title={resource.tooltipHe}
            aria-label={resource.ariaLabelHe || resource.tooltipHe}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="truncate">{resource.labelHe}</span>
            <span aria-hidden className="shrink-0 text-[10px] opacity-60">ⓘ</span>
          </summary>
          <p className="absolute left-0 top-8 z-30 w-72 max-w-[80vw] rounded-lg border border-slate-200 bg-white p-2 text-right text-xs leading-5 text-slate-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {resource.detailHe}
          </p>
        </details>
      );
    }

    return (
      <a
        key={resource.key}
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        title={resource.tooltipHe}
        aria-label={resource.ariaLabelHe || resource.tooltipHe}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === ' ') {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
        className={controlClass}
        data-section-resource={resource.key}
      >
        <span className="truncate">{resource.labelHe}</span>
        <span aria-hidden className="shrink-0 text-[10px] opacity-60">↗</span>
      </a>
    );
  };

  const groups = sectionKey === 'sectors'
    ? [
        ['research', 'כלי מחקר'],
        ['performance', 'תקופות וניתוח'],
      ]
    : null;

  return (
    <nav
      aria-label="קישורי משאבים חיצוניים"
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      data-section-resources={sectionKey}
    >
      {groups
        ? groups.map(([groupKey, groupLabel]) => (
            <span key={groupKey} className="inline-flex min-w-0 flex-wrap items-center gap-1" data-resource-group={groupKey}>
              <span className="px-1 text-[10px] font-medium text-slate-500 dark:text-zinc-400">{groupLabel}</span>
              {resources.filter((resource) => resource.group === groupKey).map(renderResource)}
            </span>
          ))
        : resources.map(renderResource)}
    </nav>
  );
}
