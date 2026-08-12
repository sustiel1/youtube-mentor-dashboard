import { DEFAULT_WORKSPACE_TOPICS } from '@/config/workspaceTaxonomy';
import { getWorkspaceItemIdentity } from '@/utils/workspaceItemIdentity';
import { WORKSPACE_TOPIC_TYPES, getWorkspaceTopicType, validateWorkspaceTopicDraft } from '@/utils/workspaceTopicHierarchy';
import {
  checksumWorkspacePayloadsExcludingTopicAssignment,
  getWorkspaceTopicAssignment,
  prepareWorkspaceItemForSave,
  selectTargetedWorkspaceVideoRoutingPreview,
} from '@/utils/workspaceBriefRouting';

const ITEMS_KEY = 'workspace_library_v1';
const TOPICS_KEY = 'workspace_topics_v1';

export const WORKSPACE_PERSISTENCE_ERROR_CODES = {
  SERIALIZATION_FAILED: 'serialization-failed',
  STORAGE_READ_FAILED: 'storage-read-failed',
  STORAGE_WRITE_FAILED: 'storage-write-failed',
  QUOTA_EXCEEDED: 'quota-exceeded',
  READ_BACK_MISMATCH: 'read-back-mismatch',
  INVALID_READ_BACK: 'invalid-read-back',
  INTENDED_ITEM_MISSING: 'intended-item-missing',
  ITEM_STILL_PRESENT: 'item-still-present',
  ITEM_NOT_FOUND: 'item-not-found',
  INVALID_BRIEF_DESTINATION: 'invalid-brief-destination',
  INVALID_TARGETED_ROUTING: 'invalid-targeted-routing',
  TARGETED_ROUTING_ITEMS_MISMATCH: 'targeted-routing-items-mismatch',
  TARGETED_ROUTING_VERIFICATION_FAILED: 'targeted-routing-verification-failed',
};

const GENERIC_STORAGE_ERROR_MESSAGE = 'השמירה ל-Workspace נכשלה. הנתונים הקיימים נשמרו ללא שינוי.';
const QUOTA_STORAGE_ERROR_MESSAGE = 'אין מספיק מקום באחסון המקומי. הפריט לא נשמר והנתונים הקיימים נשארו ללא שינוי.';
const INVALID_BRIEF_DESTINATION_MESSAGE = 'יעד מבזק בוקר/ערב אינו זמין. הפריט לא נשמר והנתונים הקיימים נשארו ללא שינוי.';

function estimateSerializedBytes(serialized) {
  try {
    return new TextEncoder().encode(serialized).byteLength;
  } catch {
    return serialized.length * 2;
  }
}

function isQuotaExceededError(error) {
  return error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014;
}

function logPersistenceFailure(error) {
  console.error('[Workspace persistence]', {
    operation: error.operation,
    keyName: error.keyName,
    code: error.code,
    exceptionName: error.exceptionName,
    exceptionCode: error.exceptionCode,
    attemptedSize: error.attemptedSize,
    rollbackVerified: error.rollbackVerified,
  });
}

function persistenceFailure({ code, operation, cause = null, attemptedSize = null, rollbackVerified = true }) {
  const failure = {
    ok: false,
    error: {
      code,
      operation,
      keyName: ITEMS_KEY,
      exceptionName: cause?.name || null,
      exceptionCode: cause?.code ?? null,
      attemptedSize,
      rollbackVerified,
      userMessage: code === WORKSPACE_PERSISTENCE_ERROR_CODES.QUOTA_EXCEEDED
        ? QUOTA_STORAGE_ERROR_MESSAGE
        : code === WORKSPACE_PERSISTENCE_ERROR_CODES.INVALID_BRIEF_DESTINATION
          ? INVALID_BRIEF_DESTINATION_MESSAGE
          : GENERIC_STORAGE_ERROR_MESSAGE,
    },
  };
  logPersistenceFailure(failure.error);
  return failure;
}

export function getWorkspacePersistenceErrorMessage(result) {
  return result?.error?.userMessage || GENERIC_STORAGE_ERROR_MESSAGE;
}

function loadWorkspaceItemsForWrite(operation, storage = localStorage) {
  let raw;
  try {
    raw = storage.getItem(ITEMS_KEY);
  } catch (cause) {
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.STORAGE_READ_FAILED,
      operation,
      cause,
    });
  }

  if (!raw) return { ok: true, items: [], raw: null };

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError('Workspace storage value is not an array');
    return { ok: true, items: parsed, raw };
  } catch (cause) {
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.INVALID_READ_BACK,
      operation,
      cause,
    });
  }
}

function restorePreviousRaw(storage, previousRaw, serialized) {
  try {
    const currentRaw = storage.getItem(ITEMS_KEY);
    if (currentRaw !== serialized) return currentRaw === previousRaw;
    if (previousRaw === null) storage.removeItem(ITEMS_KEY);
    else storage.setItem(ITEMS_KEY, previousRaw);
    return storage.getItem(ITEMS_KEY) === previousRaw;
  } catch {
    return false;
  }
}

/**
 * Persists the complete Workspace item array and verifies the exact write.
 * Exported for isolated tests; production callers use the operation wrappers below.
 */
export function persistWorkspaceItems(items, {
  operation = 'save-items',
  intendedItemIds = [],
  absentItemIds = [],
  previousRaw,
  storage = localStorage,
} = {}) {
  let serialized;
  try {
    serialized = JSON.stringify(items);
  } catch (cause) {
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.SERIALIZATION_FAILED,
      operation,
      cause,
    });
  }

  const attemptedSize = estimateSerializedBytes(serialized);
  let originalRaw = previousRaw;
  if (originalRaw === undefined) {
    try {
      originalRaw = storage.getItem(ITEMS_KEY);
    } catch (cause) {
      return persistenceFailure({
        code: WORKSPACE_PERSISTENCE_ERROR_CODES.STORAGE_READ_FAILED,
        operation,
        cause,
        attemptedSize,
      });
    }
  }

  try {
    storage.setItem(ITEMS_KEY, serialized);
  } catch (cause) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: isQuotaExceededError(cause)
        ? WORKSPACE_PERSISTENCE_ERROR_CODES.QUOTA_EXCEEDED
        : WORKSPACE_PERSISTENCE_ERROR_CODES.STORAGE_WRITE_FAILED,
      operation,
      cause,
      attemptedSize,
      rollbackVerified,
    });
  }

  let readBackRaw;
  try {
    readBackRaw = storage.getItem(ITEMS_KEY);
  } catch (cause) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.STORAGE_READ_FAILED,
      operation,
      cause,
      attemptedSize,
      rollbackVerified,
    });
  }

  if (readBackRaw !== serialized) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.READ_BACK_MISMATCH,
      operation,
      attemptedSize,
      rollbackVerified,
    });
  }

  let persistedItems;
  try {
    persistedItems = JSON.parse(readBackRaw);
    if (!Array.isArray(persistedItems)) throw new TypeError('Workspace storage value is not an array');
  } catch (cause) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.INVALID_READ_BACK,
      operation,
      cause,
      attemptedSize,
      rollbackVerified,
    });
  }

  const persistedIds = new Set(persistedItems.map(item => item?.id).filter(Boolean));
  if (intendedItemIds.some(id => !persistedIds.has(id))) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.INTENDED_ITEM_MISSING,
      operation,
      attemptedSize,
      rollbackVerified,
    });
  }
  if (absentItemIds.some(id => persistedIds.has(id))) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.ITEM_STILL_PRESENT,
      operation,
      attemptedSize,
      rollbackVerified,
    });
  }

  return { ok: true, operation, persistedItems, persistedCount: persistedItems.length, attemptedSize };
}

// ─── Topics ───────────────────────────────────────────────────────────────────

export function getWorkspaceTopics() {
  try {
    const raw = localStorage.getItem(TOPICS_KEY);
    if (!raw) return [...DEFAULT_WORKSPACE_TOPICS];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_WORKSPACE_TOPICS];
  } catch {
    return [...DEFAULT_WORKSPACE_TOPICS];
  }
}

export function saveWorkspaceTopics(topics) {
  let previousRaw = null;
  try {
    previousRaw = localStorage.getItem(TOPICS_KEY);
    const serialized = JSON.stringify(topics);
    localStorage.setItem(TOPICS_KEY, serialized);
    if (localStorage.getItem(TOPICS_KEY) === serialized) return true;
    if (previousRaw === null) localStorage.removeItem(TOPICS_KEY);
    else localStorage.setItem(TOPICS_KEY, previousRaw);
    return false;
  } catch {
    try {
      if (previousRaw === null) localStorage.removeItem(TOPICS_KEY);
      else localStorage.setItem(TOPICS_KEY, previousRaw);
    } catch {}
    return false;
  }
}

export function addWorkspaceTopic({ name, parentId = null, emoji = null, displayOrder = 0, type = null }) {
  const topics = getWorkspaceTopics();
  const resolvedType = type || (parentId ? WORKSPACE_TOPIC_TYPES.SUBTOPIC : WORKSPACE_TOPIC_TYPES.MAIN);
  const validation = validateWorkspaceTopicDraft({ type: resolvedType, parentId, topics });
  if (!validation.ok) return { ok: false, errors: validation.errors };
  const newTopic = {
    id: `wt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(name || '').trim(),
    parentId: validation.parentId,
    emoji: emoji || null,
    displayOrder: Number.isFinite(Number(displayOrder)) ? Number(displayOrder) : 0,
    createdAt: new Date().toISOString(),
  };
  topics.push(newTopic);
  if (!saveWorkspaceTopics(topics)) return { ok: false, errors: ['שמירת הנושא נכשלה; הנתונים הקיימים לא שונו.'] };
  return { ...newTopic, ok: true, topic: newTopic };
}

export function updateWorkspaceTopic(id, updates) {
  const topics = getWorkspaceTopics();
  const idx = topics.findIndex(t => t.id === id);
  if (idx === -1) return { ok: false, errors: ['הנושא לא נמצא.'] };
  const nextTopic = { ...topics[idx], ...updates };
  const type = updates.type || getWorkspaceTopicType(nextTopic);
  const validation = validateWorkspaceTopicDraft({ topicId: id, type, parentId: nextTopic.parentId, topics });
  if (!validation.ok) return { ok: false, errors: validation.errors };
  delete nextTopic.type;
  nextTopic.parentId = validation.parentId;
  nextTopic.displayOrder = Number.isFinite(Number(nextTopic.displayOrder)) ? Number(nextTopic.displayOrder) : 0;
  topics[idx] = nextTopic;
  if (!saveWorkspaceTopics(topics)) return { ok: false, errors: ['שמירת הנושא נכשלה; הנתונים הקיימים לא שונו.'] };
  return { ok: true, topic: nextTopic };
}

/**
 * Returns { ok: true } on success.
 * Returns { ok: false, count: N } if saved items reference this topic (or its sub-topics),
 * in which case nothing is deleted.
 */
export function deleteWorkspaceTopic(id) {
  const allTopics = getWorkspaceTopics();
  const items = getWorkspaceItems();

  const idsToDelete = new Set([
    id,
    ...allTopics.filter(t => t.parentId === id).map(t => t.id),
  ]);

  const affectedCount = items.filter(
    i => idsToDelete.has(i.topicId) || idsToDelete.has(i.subTopicId)
  ).length;

  if (affectedCount > 0) {
    return { ok: false, count: affectedCount };
  }

  saveWorkspaceTopics(allTopics.filter(t => !idsToDelete.has(t.id)));
  return { ok: true, count: 0 };
}

// ─── Items ────────────────────────────────────────────────────────────────────

export function getWorkspaceItems() {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWorkspaceItem(item) {
  const prepared = prepareWorkspaceItemForSave(item, getWorkspaceTopics());
  if (!prepared.ok) {
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.INVALID_BRIEF_DESTINATION,
      operation: 'save-item',
    });
  }
  const preparedItem = prepared.item;
  const loaded = loadWorkspaceItemsForWrite('save-item');
  if (!loaded.ok) return loaded;
  const items = loaded.items;
  const identity = getWorkspaceItemIdentity(preparedItem);
  if (identity) {
    const existing = items.find(candidate => getWorkspaceItemIdentity(candidate)?.key === identity.key);
    if (existing) {
      return {
        ok: true,
        status: 'already_exists',
        item: existing,
        existingItemId: existing.id,
        identity,
        persistedItems: items,
        persistedCount: items.length,
      };
    }
  }
  const videoId = preparedItem.videoId;
  const idx = videoId ? items.findIndex(i => i.videoId === videoId) : -1;
  let intendedId;

  if (idx !== -1) {
    items[idx] = {
      ...items[idx],
      ...preparedItem,
      id: preparedItem.id || items[idx].id || `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      updatedAt: new Date().toISOString(),
    };
    intendedId = items[idx].id;
  } else {
    const nextItem = {
      ...preparedItem,
      id: preparedItem.id || `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      savedAt: preparedItem.savedAt || new Date().toISOString(),
    };
    items.unshift(nextItem);
    intendedId = nextItem.id;
  }
  const result = persistWorkspaceItems(items, {
    operation: 'save-item',
    intendedItemIds: [intendedId],
    previousRaw: loaded.raw,
  });
  return result.ok
    ? { ...result, status: idx !== -1 ? 'updated' : 'created', identity, item: result.persistedItems.find(saved => saved.id === intendedId) }
    : { ...result, status: 'failed' };
}

/** §22 Bulk save — writes all items in one pass. */
export function saveWorkspaceItemsBulk(items = []) {
  if (!items.length) return { ok: true, saved: 0, failed: 0 };
  const topics = getWorkspaceTopics();
  const preparedItems = [];
  for (const item of items) {
    if (!item) {
      preparedItems.push(item);
      continue;
    }
    const prepared = prepareWorkspaceItemForSave(item, topics);
    if (!prepared.ok) {
      return {
        ...persistenceFailure({
          code: WORKSPACE_PERSISTENCE_ERROR_CODES.INVALID_BRIEF_DESTINATION,
          operation: 'save-items-bulk',
        }),
        saved: 0,
        failed: items.length,
      };
    }
    preparedItems.push(prepared.item);
  }
  const loaded = loadWorkspaceItemsForWrite('save-items-bulk');
  if (!loaded.ok) return { ...loaded, saved: 0, failed: items.length };
  const existing = loaded.items;
  let saved = 0;
  let failed = 0;
  const next = [...existing];
  const intendedItemIds = [];
  const knownIdentities = new Map(existing.map(item => [getWorkspaceItemIdentity(item)?.key, item]).filter(([key]) => key));
  const alreadyExisting = [];
  const now = new Date().toISOString();
  preparedItems.forEach((item) => {
    if (!item) { failed++; return; }
    const identity = getWorkspaceItemIdentity(item);
    if (identity && knownIdentities.has(identity.key)) {
      alreadyExisting.push(knownIdentities.get(identity.key).id);
      return;
    }
    const videoId = item.videoId;
    const idx = videoId ? next.findIndex(i => i.videoId === videoId) : -1;
    if (idx !== -1) {
      next[idx] = {
        ...next[idx],
        ...item,
        id: item.id || next[idx].id || `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        updatedAt: now,
      };
      intendedItemIds.push(next[idx].id);
    } else {
      const nextItem = {
        ...item,
        id: item.id || `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        savedAt: item.savedAt || now,
      };
      next.unshift(nextItem);
      intendedItemIds.push(nextItem.id);
      if (identity) knownIdentities.set(identity.key, nextItem);
    }
    saved++;
  });
  if (saved === 0) {
    return { ok: true, status: 'already_exists', saved: 0, failed, alreadyExisting, persistedItems: existing, persistedCount: existing.length };
  }
  const result = persistWorkspaceItems(next, {
    operation: 'save-items-bulk',
    intendedItemIds,
    previousRaw: loaded.raw,
  });
  return result.ok
    ? { ...result, status: saved > 0 ? 'created' : 'already_exists', saved, failed, alreadyExisting }
    : { ...result, status: 'failed', saved: 0, failed: items.length };
}

export function updateWorkspaceItem(id, updates) {
  const loaded = loadWorkspaceItemsForWrite('update-item');
  if (!loaded.ok) return loaded;
  const items = loaded.items;
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return persistenceFailure({ code: WORKSPACE_PERSISTENCE_ERROR_CODES.ITEM_NOT_FOUND, operation: 'update-item' });
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
  return persistWorkspaceItems(items, { operation: 'update-item', intendedItemIds: [items[idx].id], previousRaw: loaded.raw });
}

export function deleteWorkspaceItem(id) {
  const loaded = loadWorkspaceItemsForWrite('delete-item');
  if (!loaded.ok) return loaded;
  return persistWorkspaceItems(loaded.items.filter(i => i.id !== id), {
    operation: 'delete-item',
    absentItemIds: [id],
    previousRaw: loaded.raw,
  });
}

/** Bulk delete — removes all items whose id is in `ids`. */
export function deleteWorkspaceItems(ids = []) {
  const loaded = loadWorkspaceItemsForWrite('delete-items-bulk');
  if (!loaded.ok) return loaded;
  const idSet = new Set(ids);
  return persistWorkspaceItems(loaded.items.filter(i => !idSet.has(i.id)), {
    operation: 'delete-items-bulk',
    absentItemIds: ids,
    previousRaw: loaded.raw,
  });
}

/** Deletes every Workspace item. Does not touch topics, Brain, or KnowledgeItems. */
export function deleteAllWorkspaceItems() {
  const loaded = loadWorkspaceItemsForWrite('delete-all-items');
  if (!loaded.ok) return loaded;
  return persistWorkspaceItems([], {
    operation: 'delete-all-items',
    absentItemIds: loaded.items.map(item => item.id).filter(Boolean),
    previousRaw: loaded.raw,
  });
}

/** Bulk field update — applies the same `updates` to every item in `ids`. */
export function updateWorkspaceItemsBulk(ids = [], updates = {}) {
  const loaded = loadWorkspaceItemsForWrite('update-items-bulk');
  if (!loaded.ok) return loaded;
  const idSet = new Set(ids);
  const now = new Date().toISOString();
  const items = loaded.items;
  const next = items.map(i => idSet.has(i.id) ? { ...i, ...updates, updatedAt: now } : i);
  const intendedItemIds = next.filter(item => idSet.has(item.id)).map(item => item.id);
  return persistWorkspaceItems(next, {
    operation: 'update-items-bulk',
    intendedItemIds,
    previousRaw: loaded.raw,
  });
}

/**
 * Reassigns one exact persisted source-video group while preserving every
 * record ID, payload field and timestamp outside the approved topic metadata.
 */
export function reassignWorkspaceVideoGroupTopic({
  sourceVideoId,
  expectedItemIds = [],
  topics = null,
  storage = localStorage,
} = {}) {
  const operation = 'reassign-video-group-topic';
  const loaded = loadWorkspaceItemsForWrite(operation, storage);
  if (!loaded.ok) return loaded;

  const resolvedTopics = Array.isArray(topics) ? topics : getWorkspaceTopics();
  const preview = selectTargetedWorkspaceVideoRoutingPreview({
    items: loaded.items,
    topics: resolvedTopics,
    sourceVideoId,
  });
  if (!preview.safe) {
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.INVALID_TARGETED_ROUTING,
      operation,
    });
  }

  const actualIds = [...preview.recordIds].sort();
  const expectedIds = [...new Set(expectedItemIds)].sort();
  if (
    expectedIds.length !== actualIds.length
    || expectedIds.some((id, index) => id !== actualIds[index])
  ) {
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.TARGETED_ROUTING_ITEMS_MISMATCH,
      operation,
    });
  }

  const targetIds = new Set(actualIds);
  const beforeIds = loaded.items.map(item => item?.id || null);
  const beforePayloadChecksum = checksumWorkspacePayloadsExcludingTopicAssignment(loaded.items);
  const assignment = getWorkspaceTopicAssignment(preview.destination);
  const next = loaded.items.map(item => targetIds.has(item?.id) ? { ...item, ...assignment } : item);
  const result = persistWorkspaceItems(next, {
    operation,
    intendedItemIds: actualIds,
    previousRaw: loaded.raw,
    storage,
  });
  if (!result.ok) return result;

  const afterIds = result.persistedItems.map(item => item?.id || null);
  const afterPayloadChecksum = checksumWorkspacePayloadsExcludingTopicAssignment(result.persistedItems);
  const targetVerified = result.persistedItems
    .filter(item => targetIds.has(item?.id))
    .every(item => (
      item.topicId === preview.destination.topicId
      && item.subTopicId === preview.destination.subTopicId
      && item.subtopicId === preview.destination.subTopicId
    ));
  const verified = (
    beforeIds.length === afterIds.length
    && beforeIds.every((id, index) => id === afterIds[index])
    && beforePayloadChecksum === afterPayloadChecksum
    && targetVerified
  );
  if (!verified) {
    const rollbackVerified = restorePreviousRaw(storage, loaded.raw, JSON.stringify(next));
    return persistenceFailure({
      code: WORKSPACE_PERSISTENCE_ERROR_CODES.TARGETED_ROUTING_VERIFICATION_FAILED,
      operation,
      rollbackVerified,
    });
  }

  return {
    ...result,
    sourceVideoId: preview.sourceVideoId,
    affectedItemIds: actualIds,
    affectedCount: actualIds.length,
    destination: preview.destination,
    beforePayloadChecksum,
    afterPayloadChecksum,
    recordIdsUnchanged: true,
  };
}

/**
 * Sets/clears `archivedAt` for the given items. Additive field — items
 * without it are treated as active, no migration needed.
 */
export function archiveWorkspaceItems(ids = [], archived = true) {
  return updateWorkspaceItemsBulk(ids, { archivedAt: archived ? new Date().toISOString() : null });
}

export function isVideoInWorkspaceLibrary(videoId) {
  if (!videoId) return false;
  try {
    return getWorkspaceItems().some(i => i.videoId === videoId);
  } catch {
    return false;
  }
}

export function getWorkspaceItemByVideoId(videoId) {
  if (!videoId) return null;
  try {
    return getWorkspaceItems().find(i => i.videoId === videoId) || null;
  } catch {
    return null;
  }
}

/**
 * Finds an existing item with the same contentHash anywhere in the library.
 * Used to prevent duplicate snippet saves (independent of the videoId-based upsert
 * in saveWorkspaceItem). Items saved before contentHash existed simply won't match
 * (contentHash is undefined), so backward compatibility is unaffected.
 *
 * Deliberately NOT scoped to topicId/subTopicId: those are the save dialog's
 * current UI selection, not a stable property of the item, so scoping by them
 * made the check fail whenever the selected topic differed from the topic the
 * item was originally saved under (e.g. after a page reload resets the dialog's
 * topic dropdown to blank) — every re-save then looked "new" and duplicated the
 * whole batch instead of being skipped.
 */
export function findWorkspaceItemByContentHash(contentHash) {
  if (!contentHash) return null;
  try {
    return getWorkspaceItems().find((i) => i.contentHash === contentHash) || null;
  } catch {
    return null;
  }
}

export function updateWorkspaceItemByVideoId(videoId, updates) {
  if (!videoId) return persistenceFailure({ code: WORKSPACE_PERSISTENCE_ERROR_CODES.ITEM_NOT_FOUND, operation: 'update-item-by-video-id' });
  const loaded = loadWorkspaceItemsForWrite('update-item-by-video-id');
  if (!loaded.ok) return loaded;
  const items = loaded.items;
  const idx = items.findIndex(i => i.videoId === videoId);
  if (idx === -1) return persistenceFailure({ code: WORKSPACE_PERSISTENCE_ERROR_CODES.ITEM_NOT_FOUND, operation: 'update-item-by-video-id' });
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
  return persistWorkspaceItems(items, {
    operation: 'update-item-by-video-id',
    intendedItemIds: [items[idx].id],
    previousRaw: loaded.raw,
  });
}
