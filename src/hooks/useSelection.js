import { useState, useCallback } from "react";

/**
 * Shared selection hook — §22 Universal Bulk Selection & Save System.
 * Returns a Set-based selection state with toggle, selectAll, clearAll helpers.
 *
 * @param {Array} items - array of items; each item must have a unique `id` field
 */
export function useSelection(items = []) {
  const [selected, setSelected] = useState(new Set());

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(items.map((item) => item.id)));
  }, [items]);

  const clearAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback((id) => selected.has(id), [selected]);

  return {
    selected,
    toggle,
    selectAll,
    clearAll,
    isSelected,
    count: selected.size,
  };
}
