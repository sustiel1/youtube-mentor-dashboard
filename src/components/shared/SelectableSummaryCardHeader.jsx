import { cn } from '@/lib/utils';
import {
  SectionHeaderTitle,
} from '@/components/dashboard/MorningBriefVisualPrimitives';
import {
  UniversalTabSelectRow,
} from '@/components/shared/UniversalTabSelectRow';
import { UniversalTabSectionHeaderActions } from '@/components/shared/UniversalTabSectionHeaderActions';
import { mergeBulkSelection, formatSectionCopyFromCardText } from '@/lib/universalTabBulkItems';
import { SectionBulkSelectControl } from '@/components/shared/SectionBulkSelectControl';

/**
 * Indeterminate-aware checkbox for section select-all (card header variant).
 * When sectionChildItems is provided, the checkbox selects/deselects all children.
 * Without sectionChildItems, falls back to single-card toggle (legacy behavior).
 */
function CardSectionCheckbox({ sectionChildItems, bulkSelection, bulkId, meta }) {
  if (sectionChildItems?.length) {
    return (
      <SectionBulkSelectControl
        items={sectionChildItems}
        bulkSelection={bulkSelection}
        sectionLabel={meta?.sectionLabel || ''}
        className="min-h-7"
      />
    );
  }

  const checked = bulkSelection?.multiSelected?.has(bulkId) ?? false;
  return (
    <input
      type="checkbox"
      checked={checked}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        bulkSelection.onToggle?.(bulkId, meta);
      }}
      aria-label={`בחר כרטיס: ${meta?.sectionLabel || ''}`}
      className="h-4 w-4 rounded cursor-pointer accent-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    />
  );
}

/**
 * Selectable card header — checkbox top-right (RTL), quick save actions, preserves title row.
 * Pass sectionChildItems to enable section-select-all behavior (selects each child individually).
 * Without sectionChildItems, falls back to single-item toggle (legacy).
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
  sectionChildItems = null,
}) {
  const titleEl = (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 min-w-0">
      <SectionHeaderTitle title={title} count={showCount ? count : undefined} titleClassName={titleClassName} />
      {headerPills}
    </div>
  );

  const hasChildren = sectionChildItems && sectionChildItems.length > 0;
  const canSelect = bulkSelection?.onToggle && cardId && cardText && !disabled;
  const canSectionSelect = hasChildren && bulkSelection?.onSectionSelect && bulkSelection?.onSectionDeselect && !disabled;
  const bulkId = canSelect ? `${tabScope}:card:${cardId}` : null;
  const meta = {
    text: cardText,
    sectionLabel: sectionLabel || title,
    type: type || tabScope,
    tabScope,
  };

  const showCheckbox = canSectionSelect || canSelect;

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
      {showCheckbox ? (
        <UniversalTabSelectRow
          className="min-w-0 flex-1 items-center"
          checkbox={(
            <CardSectionCheckbox
              sectionChildItems={canSectionSelect ? sectionChildItems : null}
              bulkSelection={bulkSelection}
              bulkId={bulkId}
              meta={meta}
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
