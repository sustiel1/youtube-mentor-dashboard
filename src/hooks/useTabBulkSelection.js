import { useState, useCallback, useEffect, useMemo } from 'react';

/**
 * Tab-scoped bulk selection — clears when activeTab changes.
 * Items: Map<id, { text, sectionLabel, type, tabScope, timestamp?, rawItem? }>
 */
export function useTabBulkSelection(activeTab) {
  const [multiSelected, setMultiSelected] = useState(() => new Map());
  const [selectionTab, setSelectionTab] = useState(null);

  useEffect(() => {
    setMultiSelected(new Map());
    setSelectionTab(null);
  }, [activeTab]);

  const toggleMultiSelect = useCallback((id, payload) => {
    setSelectionTab(activeTab);
    setMultiSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, { ...payload, tabScope: payload?.tabScope || activeTab });
      return next;
    });
  }, [activeTab]);

  const multiSelectAll = useCallback((items = []) => {
    if (!items.length) return;
    setSelectionTab(activeTab);
    setMultiSelected(() => {
      const next = new Map();
      items.forEach(({ id, ...rest }) => {
        next.set(id, { ...rest, tabScope: rest.tabScope || activeTab });
      });
      return next;
    });
  }, [activeTab]);

  const multiSelectClear = useCallback(() => {
    setMultiSelected(new Map());
    setSelectionTab(null);
  }, []);

  const count = useMemo(() => {
    if (selectionTab !== activeTab) return 0;
    return multiSelected.size;
  }, [multiSelected, selectionTab, activeTab]);

  const entriesForActiveTab = useMemo(() => {
    if (selectionTab !== activeTab) return [];
    return [...multiSelected.entries()].map(([id, data]) => ({ id, ...data }));
  }, [multiSelected, selectionTab, activeTab]);

  return {
    multiSelected,
    selectionTab,
    toggleMultiSelect,
    multiSelectAll,
    multiSelectClear,
    count,
    entriesForActiveTab,
  };
}
