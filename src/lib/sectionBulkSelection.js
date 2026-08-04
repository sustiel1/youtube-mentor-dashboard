export function getSectionBulkSelectionState(items = [], multiSelected = new Map()) {
  const selectableItems = Array.isArray(items)
    ? items.filter((item) => item?.id && item?.text !== '' && item?.text != null)
    : [];
  const selectedCount = selectableItems.reduce(
    (count, item) => count + (multiSelected?.has?.(item.id) ? 1 : 0),
    0,
  );
  const totalCount = selectableItems.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const partiallySelected = selectedCount > 0 && !allSelected;

  return {
    selectableItems,
    selectedCount,
    totalCount,
    allSelected,
    partiallySelected,
    ariaChecked: allSelected ? true : (partiallySelected ? 'mixed' : false),
    label: allSelected
      ? 'בטל בחירה'
      : `בחר הכול${partiallySelected ? ` (${selectedCount}/${totalCount})` : ''}`,
  };
}
