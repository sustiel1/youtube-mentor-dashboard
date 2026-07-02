import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  formatCardBulkText,
  formatSectionCopyText,
  mergeBulkSelection,
  formatBulkItemText,
} from '@/lib/universalTabBulkItems';
import { UniversalTabSectionHeaderActions } from '@/components/shared/UniversalTabSectionHeaderActions';
import { TAB_SECTION_LABEL_CLS } from '@/lib/summaryCardStyles';

/**
 * Indeterminate-aware checkbox for section select-all.
 * checked=true → all children selected; indeterminate=true → some selected.
 */
function SectionCheckbox({ childItems, bulkSelection, className }) {
  const ref = useRef(null);
  const ids = childItems.map((i) => i.id);
  const selectedCount = ids.filter((id) => bulkSelection?.multiSelected?.has(id)).length;
  const allSelected = ids.length > 0 && selectedCount === ids.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);

  const handleChange = () => {
    if (allSelected) {
      bulkSelection.onSectionDeselect?.(ids);
    } else {
      bulkSelection.onSectionSelect?.(childItems);
    }
  };

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected}
      onChange={handleChange}
      aria-label="בחר כל פריטי הסעיף"
      className={cn('h-4 w-4 rounded cursor-pointer accent-indigo-600 shrink-0', className)}
    />
  );
}

/**
 * Section label row with header quick actions (Copy / Brain / Obsidian / Workspace).
 * Optional `sectionChildItems` enables a select-all checkbox for children.
 */
export function UniversalTabSectionLabelRow({
  label,
  items = [],
  saveText: saveTextProp,
  copyText: copyTextProp,
  bulkSelection = null,
  tabScope,
  type,
  sectionLabel,
  sectionKey,
  idPrefix,
  labelClassName = TAB_SECTION_LABEL_CLS,
  brainSaved,
  copyGroups = null,
  sectionChildItems = null,
}) {
  if (!label) return null;

  const merged = bulkSelection ? mergeBulkSelection(bulkSelection, {
    idPrefix: idPrefix || `${tabScope}:${sectionKey || label}`,
    sectionLabel: sectionLabel || label,
    type: type || tabScope,
    tabScope,
  }) : null;

  const saveText = saveTextProp || formatCardBulkText(label, items);
  const copyText = copyTextProp || formatSectionCopyText(label, items, { groups: copyGroups });
  const saved = brainSaved ?? (merged?.isBrainSaved?.(saveText, type || tabScope));

  const hasCheckbox = sectionChildItems && sectionChildItems.length > 0
    && bulkSelection?.onSectionSelect && bulkSelection?.onSectionDeselect;

  return (
    <div className="flex items-start justify-between gap-2 mb-1.5 px-1" dir="rtl">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {hasCheckbox && (
          <SectionCheckbox
            childItems={sectionChildItems}
            bulkSelection={bulkSelection}
          />
        )}
        <p className={cn(labelClassName, 'mb-0 min-w-0 text-right')}>{label}</p>
      </div>
      {(saveText || copyText) && (
        <UniversalTabSectionHeaderActions
          text={saveText}
          copyText={copyText}
          bulkSelection={merged}
          sectionLabel={sectionLabel || label}
          type={type || tabScope}
          tabScope={tabScope}
          brainSaved={saved}
        />
      )}
    </div>
  );
}

/**
 * Helper: build sectionChildItems from items array + idPrefix + section metadata.
 * Use this at call sites to pass the correct child data to UniversalTabSectionLabelRow.
 */
export function buildSectionChildItems(items, idPrefix, { sectionLabel = '', type = '', tabScope = '' } = {}) {
  return items.map((item, i) => ({
    id: `${idPrefix}:${i}`,
    text: formatBulkItemText(item),
    sectionLabel,
    type,
    tabScope,
  }));
}
