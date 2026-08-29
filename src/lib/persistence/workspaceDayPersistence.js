/**
 * Workspace Day persistence facade.
 *
 * Mirrors the PUBLIC API SHAPE of workspacePersistence.js (createX factory +
 * getX singleton + BroadcastChannel events on success) so a future IndexedDB
 * migration is an internals-only change. v1 has NO IndexedDB path: the backend
 * is localStorage only and `mode` is always normalized to 'localStorage'.
 *
 * All CRUD / invariant logic lives in workspaceDayStore.js; this layer only
 * binds the storage area and publishes a 'record-updated' event after a
 * verified successful write.
 */

import {
  attachItemToWorkspaceDay,
  closeWorkspaceDay,
  createWorkspaceDay,
  deleteWorkspaceDay,
  detachItemFromWorkspaceDay,
  getOpenWorkspaceDay,
  getWorkspaceDayById,
  getWorkspaceDayIdsForItem,
  getWorkspaceDayReadModel,
  getWorkspaceDays,
  reopenWorkspaceDay,
  refreshWorkspaceDayMember,
  WORKSPACE_DAYS_STORAGE_KEY,
} from '@/lib/workspaceDayStore';
import { createPersistenceEvents } from './storageEvents.js';
import { APPLICATION_STORAGE_MODES } from './storageMode.js';

export function createWorkspaceDayPersistence({
  localStorageArea = globalThis.localStorage,
  events = null,
} = {}) {
  // v1: localStorage only. The parameter is kept for interface stability.
  const normalizedMode = APPLICATION_STORAGE_MODES.LOCAL_STORAGE;
  const persistenceEvents = events || createPersistenceEvents();

  function publishIfOk(result) {
    if (result?.ok) {
      persistenceEvents?.publish('record-updated', { storageKey: WORKSPACE_DAYS_STORAGE_KEY });
    }
    return result;
  }

  return {
    mode: normalizedMode,
    storageKey: WORKSPACE_DAYS_STORAGE_KEY,

    // reads
    readDays: () => getWorkspaceDays(localStorageArea),
    getOpenDay: () => getOpenWorkspaceDay({ storage: localStorageArea }),
    getDayById: (id) => getWorkspaceDayById(id, { storage: localStorageArea }),
    getDayIdsForItem: (itemOrRef) => getWorkspaceDayIdsForItem(itemOrRef, { storage: localStorageArea }),
    getDayReadModel: (dayId, options = {}) => getWorkspaceDayReadModel(dayId, { ...options, storage: localStorageArea }),

    // mutations (each returns the store's structured { ok, ... } result)
    createDay: (options = {}) => publishIfOk(createWorkspaceDay({ ...options, storage: localStorageArea })),
    attachItem: (dayId, options = {}) => publishIfOk(attachItemToWorkspaceDay(dayId, { ...options, storage: localStorageArea })),
    detachItem: (dayId, workspaceItemId) => publishIfOk(detachItemFromWorkspaceDay(dayId, workspaceItemId, { storage: localStorageArea })),
    closeDay: (dayId, options = {}) => publishIfOk(closeWorkspaceDay(dayId, { ...options, storage: localStorageArea })),
    reopenDay: (dayId, options = {}) => publishIfOk(reopenWorkspaceDay(dayId, { ...options, storage: localStorageArea })),
    refreshMember: (dayId, workspaceItemId, options = {}) => publishIfOk(
      refreshWorkspaceDayMember(dayId, workspaceItemId, { ...options, storage: localStorageArea }),
    ),
    deleteDay: (dayId) => publishIfOk(deleteWorkspaceDay(dayId, { storage: localStorageArea })),

    subscribe(listener) {
      return persistenceEvents?.subscribe(listener) || (() => {});
    },
    close() {
      persistenceEvents?.close();
    },
  };
}

let defaultPersistence = null;

export function getWorkspaceDayPersistence() {
  if (!defaultPersistence) {
    defaultPersistence = createWorkspaceDayPersistence();
  }
  return defaultPersistence;
}
