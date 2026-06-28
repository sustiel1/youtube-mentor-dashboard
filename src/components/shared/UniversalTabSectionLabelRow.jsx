import { cn } from '@/lib/utils';
import {
  formatCardBulkText,
  formatSectionCopyText,
  mergeBulkSelection,
} from '@/lib/universalTabBulkItems';
import { UniversalTabSectionHeaderActions } from '@/components/shared/UniversalTabSectionHeaderActions';
import { TAB_SECTION_LABEL_CLS } from '@/lib/summaryCardStyles';

/**
 * Section label row with header quick actions (Copy / Brain / Obsidian / Workspace).
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

  return (
    <div className="flex items-start justify-between gap-2 mb-1.5 px-1" dir="rtl">
      <p className={cn(labelClassName, 'mb-0 flex-1 min-w-0 text-right')}>{label}</p>
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
