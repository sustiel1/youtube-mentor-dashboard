import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const UniversalTabBulkContext = createContext(null);

function bulkItemsSignature(items = []) {
  return items.map((i) => i.id).join('\0');
}

export function UniversalTabBulkProvider({
  activeTab,
  multiSelected,
  toggleMultiSelect,
  multiSelectAll,
  multiSelectClear,
  bulkSelectionShare,
  children,
}) {
  const [bulkItemsByTab, setBulkItemsByTab] = useState({});

  const registerTabBulkItems = useCallback((tab, items = []) => {
    const safe = Array.isArray(items) ? items : [];
    setBulkItemsByTab((prev) => {
      const sig = bulkItemsSignature(safe);
      if (prev[`${tab}__sig`] === sig) return prev;
      return { ...prev, [tab]: safe, [`${tab}__sig`]: sig };
    });
  }, []);

  const activeTabBulkItems = bulkItemsByTab[activeTab] ?? [];

  const value = useMemo(() => ({
    activeTab,
    multiSelected,
    toggleMultiSelect,
    multiSelectAll,
    multiSelectClear,
    bulkSelectionShare,
    registerTabBulkItems,
    activeTabBulkItems,
  }), [
    activeTab,
    multiSelected,
    toggleMultiSelect,
    multiSelectAll,
    multiSelectClear,
    bulkSelectionShare,
    registerTabBulkItems,
    activeTabBulkItems,
  ]);

  return (
    <UniversalTabBulkContext.Provider value={value}>
      {children}
    </UniversalTabBulkContext.Provider>
  );
}

export function useUniversalTabBulk() {
  return useContext(UniversalTabBulkContext);
}
