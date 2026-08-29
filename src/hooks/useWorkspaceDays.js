import { useState, useCallback } from "react";
import {
  getWorkspaceDays,
  createWorkspaceDay,
  attachItemToWorkspaceDay,
  detachItemFromWorkspaceDay,
  closeWorkspaceDay,
  reopenWorkspaceDay,
  refreshWorkspaceDayMember,
  deleteWorkspaceDay,
} from "@/lib/workspaceDayStore";

/**
 * React hook wrapping the Stage 1 Workspace Day store.
 *
 * Mirrors the useWorkspaceLibrary pattern exactly: a `useState` seed from a
 * synchronous store read, plus a `reload()` that re-reads after any store call
 * that returns `{ ok: true }`. Every wrapped mutation returns the raw
 * `{ ok }`-shaped store result untouched so callers can surface
 * `getWorkspaceDayPersistenceErrorMessage(result)` on failure.
 */
export function useWorkspaceDays() {
  const [days, setDays] = useState(() => getWorkspaceDays());

  const reload = useCallback(() => setDays(getWorkspaceDays()), []);

  const createDay = useCallback((options) => {
    const result = createWorkspaceDay(options);
    if (result?.ok) setDays(getWorkspaceDays());
    return result;
  }, []);

  const attachItem = useCallback((dayId, params) => {
    const result = attachItemToWorkspaceDay(dayId, params);
    if (result?.ok) setDays(getWorkspaceDays());
    return result;
  }, []);

  const detachItem = useCallback((dayId, workspaceItemId) => {
    const result = detachItemFromWorkspaceDay(dayId, workspaceItemId);
    if (result?.ok) setDays(getWorkspaceDays());
    return result;
  }, []);

  const closeDay = useCallback((dayId, options) => {
    const result = closeWorkspaceDay(dayId, options);
    if (result?.ok) setDays(getWorkspaceDays());
    return result;
  }, []);

  const reopenDay = useCallback((dayId, options) => {
    const result = reopenWorkspaceDay(dayId, options);
    if (result?.ok) setDays(getWorkspaceDays());
    return result;
  }, []);

  const refreshMember = useCallback((dayId, workspaceItemId, options) => {
    const result = refreshWorkspaceDayMember(dayId, workspaceItemId, options);
    if (result?.ok) setDays(getWorkspaceDays());
    return result;
  }, []);

  const deleteDay = useCallback((dayId) => {
    const result = deleteWorkspaceDay(dayId);
    if (result?.ok) setDays(getWorkspaceDays());
    return result;
  }, []);

  const openDay = days.find((day) => day?.status === "open") || null;
  const closedDays = days.filter((day) => day?.status === "closed");

  return {
    days,
    openDay,
    closedDays,
    reload,
    createDay,
    attachItem,
    detachItem,
    closeDay,
    reopenDay,
    refreshMember,
    deleteDay,
  };
}
