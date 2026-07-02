import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  SectionHeaderTitle,
} from '@/components/dashboard/MorningBriefVisualPrimitives';
import {
  UniversalTabSelectRow,
} from '@/components/shared/UniversalTabSelectRow';
import { UniversalTabSectionHeaderActions } from '@/components/shared/UniversalTabSectionHeaderActions';
import { mergeBulkSelection, formatSectionCopyFromCardText } from '@/lib/universalTabBulkItems';

/**
 * Indeterminate-aware checkbox for section select-all (card header variant).
 * When sectionChildItems is provided, the checkbox selects/deselects all children.
 * Without sectionChildItems, falls back to single-card toggle (legacy behavior).
 */
function CardSectionCheckbox({ sectionChildItems, bulkSelection, bulkId, meta }) {
  const ref = useRef(null);

  const ids = sectionChildItems ? sectionChildItems.map((i) => i.id) : null;
  const selectedCount = ids
    ? ids.filter((id) => bulkSelection?.multiSelected?.has(id)).length
    : (bulkSelection?.multiSelected?.has(bulkId) ? 1 : 0);
  const totalCount = ids ? ids.length : 1;
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);

  const handleChange = () => {
    if (ids) {
      if (allSelected) {
        bulkSelection.onSectionDeselect?.(ids);
      } else {
        bulkSelection.onSectionSelect?.(sectionChildItems);
      }
    } else {
      bulkSelection.onToggle?.(bulkId, meta);
    }
  };

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected}
      onChange={handleChange}
      aria-label={`בחר כרטיס: ${meta?.sectionLabel || ''}`}
      className="h-4 w-4 rounded cursor-pointer accent-indigo-600"
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
