import { cn } from '@/lib/utils';
import {
  UniversalTabCheckbox,
  UniversalTabSelectRow,
} from '@/components/shared/UniversalTabSelectRow';
import { UniversalTabSectionHeaderActions } from '@/components/shared/UniversalTabSectionHeaderActions';
import { mergeBulkSelection, formatSectionCopyFromCardText } from '@/lib/universalTabBulkItems';

/**
 * Selectable card header — checkbox top-right (RTL), quick save actions, preserves title row.
 */
export function SelectableSummaryCardHeader({
  title,
  cardId,
  cardText,
  bulkSelection = null,
  tabScope = 'summary',
  type,
  sectionLabel,
  disabled = false,
  headerPills = null,
  headerActions = null,
  count = null,
  showCount = false,
  countTextCls = '',
  titleClassName,
  headerRowClassName,
}) {
  const titleEl = (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 min-w-0">
      <h2 className={cn('text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight leading-snug shrink-0', titleClassName)}>
        {title}
      </h2>
      {headerPills}
      {showCount && count != null && count > 0 && (
        <span className={cn('text-base font-bold tabular-nums shrink-0', countTextCls)}>
          {count}
        </span>
      )}
    </div>
  );

  const canSelect = bulkSelection?.onToggle && cardId && cardText && !disabled;
  const bulkId = canSelect ? `${tabScope}:card:${cardId}` : null;
  const meta = {
    text: cardText,
    sectionLabel: sectionLabel || title,
    type: type || tabScope,
    tabScope,
  };

  return (
    <div
      className={cn(
        'group/card flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5 pt-1 pb-3 mb-3 px-0.5 text-right border-b border-slate-200/80 dark:border-zinc-700/70',
        headerRowClassName,
      )}
      dir="rtl"
      data-section-header
      data-summary-card={cardId || undefined}
    >
      {canSelect ? (
        <UniversalTabSelectRow
          className="min-w-0 flex-1 items-center"
          checkbox={(
            <UniversalTabCheckbox
              checked={bulkSelection.multiSelected?.has(bulkId) ?? false}
              onChange={() => bulkSelection.onToggle(bulkId, meta)}
              aria-label={`בחר כרטיס: ${title}`}
            />
          )}
          actions={(
            <UniversalTabSectionHeaderActions
              text={cardText}
              copyText={formatSectionCopyFromCardText(sectionLabel || title, cardText)}
              bulkSelection={mergeBulkSelection(bulkSelection, {
                sectionLabel: meta.sectionLabel,
                type: meta.type,
                tabScope: meta.tabScope,
              })}
              sectionLabel={meta.sectionLabel}
              type={meta.type}
              tabScope={meta.tabScope}
              brainSaved={bulkSelection.isBrainSaved?.(cardText, meta.type)}
            />
          )}
        >
          {titleEl}
        </UniversalTabSelectRow>
      ) : (
        <div className="min-w-0 flex-1">{titleEl}</div>
      )}
      {headerActions ? (
        <div className="shrink-0 flex items-center gap-1">{headerActions}</div>
      ) : null}
    </div>
  );
}
