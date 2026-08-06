import { useMemo, useCallback } from "react";
import { findDuplicateGroups } from "@/lib/workspaceLibraryStore";

/**
 * Computes duplicate/archived cleanup targets for a given item scope and
 * wires deletion through the caller's deleteItems mutator. Scope-agnostic —
 * pass the full library for a workspace-wide cleanup, or an already-filtered
 * subset (e.g. StockWatchlistView's stock-only items) to scope cleanup to
 * that view. Never touches KnowledgeItem/Brain storage — deleteItems is the
 * caller's workspace_library_v1 mutator (from useWorkspaceItems).
 */
export function useWorkspaceDangerZone(items, deleteItems) {
  const duplicateGroups = useMemo(() => findDuplicateGroups(items), [items]);

  const duplicateRemoveIds = useMemo(
    () => duplicateGroups.flatMap(g => g.remove.map(i => i.id)),
    [duplicateGroups],
  );

  const archivedItems = useMemo(() => items.filter(i => !!i.archivedAt), [items]);

  const deleteDuplicates = useCallback(() => {
    if (!duplicateRemoveIds.length) return 0;
    deleteItems(duplicateRemoveIds);
    return duplicateRemoveIds.length;
  }, [duplicateRemoveIds, deleteItems]);

  const deleteArchived = useCallback(() => {
    const ids = archivedItems.map(i => i.id);
    if (!ids.length) return 0;
    deleteItems(ids);
    return ids.length;
  }, [archivedItems, deleteItems]);

  return {
    duplicateGroups,
    duplicateCount: duplicateRemoveIds.length,
    archivedCount: archivedItems.length,
    deleteDuplicates,
    deleteArchived,
  };
}
