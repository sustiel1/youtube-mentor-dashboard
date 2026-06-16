import { LearningTabContent } from './LearningTabContent';
import { TabBulkItemsRegistrar } from './TabBulkItemsRegistrar';
import {
  buildBulkItemsFromSections,
  buildCardBulkItemsFromSections,
  formatCardBulkText,
  mergeBulkSelection,
} from '@/lib/universalTabBulkItems';
import { SelectableSummaryCardHeader } from '@/components/shared/SelectableSummaryCardHeader';
import { UniversalTabSectionLabelRow } from '@/components/shared/UniversalTabSectionLabelRow';

/**
 * Renders universal tab sections: title → bullet items (existing card styling).
 */
export function UniversalTabSectionBlocks({
  sections = [],
  tabKey = 'summary',
  onSaveToBrain,
  isSaved,
  cardClassName = 'rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2',
  labelClassName = 'text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 px-1 text-right',
  bulkSelection = null,
  skipBulkRegister = false,
}) {
  const populated = sections.filter((s) => Array.isArray(s.items) && s.items.length > 0);
  if (populated.length === 0) return null;

  const sectionDefs = populated.map((s) => ({ ...s, tabKey }));
  const rowBulkItems = bulkSelection && !skipBulkRegister
    ? buildBulkItemsFromSections(sectionDefs, tabKey)
    : [];
  const cardBulkItems = bulkSelection && !skipBulkRegister
    ? buildCardBulkItemsFromSections(sectionDefs, tabKey)
    : [];
  const bulkItems = [...cardBulkItems, ...rowBulkItems];

  return (
    <div className="space-y-3" dir="rtl">
      {!skipBulkRegister && bulkItems.length > 0 && (
        <TabBulkItemsRegistrar tab={tabKey} items={bulkItems} />
      )}
      {populated.map(({ key, label, items }) => {
        const cardText = formatCardBulkText(label, items);
        const hasCardBulk = bulkSelection && key && cardText;
        return (
          <div key={key || label} className={`${cardClassName}${hasCardBulk ? ' group/card' : ''}`}>
            {hasCardBulk ? (
              <SelectableSummaryCardHeader
                title={label}
                cardId={key || label}
                cardText={cardText}
                bulkSelection={bulkSelection}
                tabScope={tabKey}
                type={tabKey}
                sectionLabel={label || ''}
                titleClassName={labelClassName.replace(' mb-1.5', '').replace(' mb-2', '')}
                headerRowClassName="pt-0 pb-1.5 mb-1.5 px-1 border-b border-slate-200/50 dark:border-zinc-700/50"
              />
            ) : label ? (
              <UniversalTabSectionLabelRow
                label={label}
                items={items}
                bulkSelection={bulkSelection}
                tabScope={tabKey}
                type={tabKey}
                sectionKey={key || label}
              labelClassName={labelClassName}
            />
            ) : null}
            <LearningTabContent
              items={items}
              emptyLabel=""
              onSaveToBrain={onSaveToBrain ? (text) => onSaveToBrain(text, tabKey, label || '') : undefined}
              isSaved={isSaved ? (text) => isSaved(text, tabKey) : undefined}
              bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
                idPrefix: `${tabKey}:${key || label}`,
                sectionLabel: label || '',
                type: tabKey,
                tabScope: tabKey,
              }) : null}
            />
          </div>
        );
      })}
    </div>
  );
}
