import { UniversalTabBulkHeader } from './UniversalTabBulkHeader';
import { useUniversalTabBulk } from '@/context/UniversalTabBulkContext';

const UNIVERSAL_TAB_VALUES = new Set([
  'summary',
  'chapters',
  'insights',
  'useful-knowledge',
  'app-builder',
  'topics-subtopics',
  'specialized',
]);

/**
 * Single shared "בחר הכל" row — fixed below tab navigation for all universal tabs.
 */
export function UniversalTabBulkToolbar() {
  const {
    activeTab,
    activeTabBulkItems,
    multiSelected,
    multiSelectAll,
    multiSelectClear,
  } = useUniversalTabBulk() ?? {};

  if (!UNIVERSAL_TAB_VALUES.has(activeTab)) return null;

  const selectedCount = activeTabBulkItems.filter((i) => multiSelected?.has(i.id)).length;

  return (
    <div className="mt-3 mb-2 px-1 min-h-[2rem]" dir="rtl" data-universal-tab-bulk-toolbar>
      <UniversalTabBulkHeader
        totalCount={activeTabBulkItems.length}
        selectedCount={selectedCount}
        onSelectAll={() => multiSelectAll?.(activeTabBulkItems)}
        onClear={multiSelectClear}
      />
    </div>
  );
}
