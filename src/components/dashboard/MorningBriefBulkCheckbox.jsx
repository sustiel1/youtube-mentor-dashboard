import { resolveMorningBriefBulkId } from '@/lib/morningBriefBulkSections';
import { UNIVERSAL_TAB_CHECKBOX_INPUT_CLASS } from '@/components/shared/UniversalTabSelectRow';

/**
 * Checkbox wired to universal tab bulk selection for Morning Brief rows.
 */
export function MorningBriefBulkCheckbox({
  bulkSections = [],
  sectionKey,
  text,
  sectionLabel = '',
  tabKey = 'specialized',
  bulkSelection = null,
  className = UNIVERSAL_TAB_CHECKBOX_INPUT_CLASS,
}) {
  if (!bulkSelection?.onToggle || !text || !sectionKey) return null;

  const id = resolveMorningBriefBulkId(bulkSections, sectionKey, text);
  if (!id) return null;

  const checked = bulkSelection.multiSelected?.has(id) ?? false;

  return (
    <input
      type="checkbox"
      checked={checked}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        bulkSelection.onToggle(id, {
          text: String(text).trim(),
          sectionLabel: sectionLabel || sectionKey,
          type: tabKey,
          tabScope: 'specialized',
        });
      }}
      className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`.trim()}
      aria-label="בחר פריט"
    />
  );
}
