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

  // Additively add section items without replacing existing selections
  const multiSelectSection = useCallback((items = []) => {
    if (!items.length) return;
    setSelectionTab(activeTab);
    setMultiSelected((prev) => {
      const next = new Map(prev);
      items.forEach(({ id, ...rest }) => {
        next.set(id, { ...rest, tabScope: rest.tabScope || activeTab });
      });
      return next;
    });
  }, [activeTab]);

  // Remove specific item ids without clearing unrelated selections
  const multiDeselectSection = useCallback((ids = []) => {
    if (!ids.length) return;
    setMultiSelected((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const next = new Map(prev);
      ids.forEach((id) => next.delete(id));
      if (next.size === 0) setSelectionTab(null);
      return next;
    });
  }, []);

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
    multiSelectSection,
    multiDeselectSection,
    multiSelectClear,
    count,
    entriesForActiveTab,
  };
}
