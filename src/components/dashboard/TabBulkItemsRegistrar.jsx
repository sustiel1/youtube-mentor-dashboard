import { useLayoutEffect, useMemo } from 'react';
import { useUniversalTabBulk } from '@/context/UniversalTabBulkContext';

/**
 * Registers bulk-selectable items for a universal tab (consumed by panel-level header).
 */
export function TabBulkItemsRegistrar({ tab, items = [] }) {
  const ctx = useUniversalTabBulk();
  const itemsKey = useMemo(
    () => (Array.isArray(items) ? items.map((i) => i.id).join('\0') : ''),
    [items],
  );

  useLayoutEffect(() => {
    ctx?.registerTabBulkItems?.(tab, items);
  }, [tab, itemsKey, items, ctx]);

  return null;
}
