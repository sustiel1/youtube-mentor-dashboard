/**
 * Workspace Day store — CRUD against the localStorage key `workspace_days_v1`.
 *
 * v1 backend is localStorage ONLY (no IndexedDB, no DB-version bump). The write
 * contract mirrors workspaceLibraryStore.js exactly:
 *   serialize → read previous raw → setItem → read-back → verify shape →
 *   verify intended/absent ids → on ANY failure restore the previous raw and
 *   return a structured { ok:false, error:{ code, ... } } (never a false success).
 *
 * Invariants enforced at this persistence boundary:
 *   - At most ONE day with status 'open' (Stage brief #2). A second open create
 *     fails cleanly BEFORE any write (verified rollback is trivial).
 *   - Close is atomic: every member frozen + contentSnapshot + identity
 *     reaffirmed + day.closeSnapshot + status 'closed' + closedAt, in one write.
 *   - Reopen is audited: reopenCount++ / reopenedAt; members stay frozen.
 *   - refreshMember is the ONLY op that updates a member's contentSnapshot /
 *     itemIdentityKey / refreshedAt.
 *   - Delete works on open AND closed days (no "close before delete").
 */

import {
  buildDayCloseSnapshot,
  buildWorkspaceDayMember,
  computeWorkspaceDayAgeInDays,
  createWorkspaceDayRecord,
  detectWorkspaceDayMemberDrift,
  freezeWorkspaceDayMember,
  getWorkspaceDayItemDedupKey,
  getWorkspaceDayMemberDedupKey,
  refreshWorkspaceDayMemberFromSource,
  WORKSPACE_DAY_ENTRY_MODES,
} from '@/lib/workspaceDayModel';

export const WORKSPACE_DAYS_STORAGE_KEY = 'workspace_days_v1';

export const WORKSPACE_DAY_PERSISTENCE_ERROR_CODES = Object.freeze({
  SERIALIZATION_FAILED: 'serialization-failed',
  STORAGE_READ_FAILED: 'storage-read-failed',
  STORAGE_WRITE_FAILED: 'storage-write-failed',
  QUOTA_EXCEEDED: 'quota-exceeded',
  READ_BACK_MISMATCH: 'read-back-mismatch',
  INVALID_READ_BACK: 'invalid-read-back',
  INTENDED_DAY_MISSING: 'intended-day-missing',
  DAY_STILL_PRESENT: 'day-still-present',
  DAY_NOT_FOUND: 'day-not-found',
  OPEN_DAY_EXISTS: 'open-day-exists',
  INVALID_ENTRY_MODE: 'invalid-entry-mode',
  DAY_NOT_OPEN: 'day-not-open',
  DAY_NOT_CLOSED: 'day-not-closed',
  MEMBER_NOT_FOUND: 'member-not-found',
  MEMBER_ITEM_MISSING: 'member-item-missing',
});

const GENERIC_ERROR_MESSAGE = 'שמירת יום העבודה נכשלה. הנתונים הקיימים נשמרו ללא שינוי.';
const QUOTA_ERROR_MESSAGE = 'אין מספיק מקום באחסון המקומי. יום העבודה לא נשמר והנתונים הקיימים נשארו ללא שינוי.';
const OPEN_DAY_EXISTS_MESSAGE = 'כבר קיים יום עבודה פתוח. יש לסגור אותו לפני פתיחת יום חדש. לא בוצע שינוי.';

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

function userMessageFor(code) {
  if (code === WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.QUOTA_EXCEEDED) return QUOTA_ERROR_MESSAGE;
  if (code === WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.OPEN_DAY_EXISTS) return OPEN_DAY_EXISTS_MESSAGE;
  return GENERIC_ERROR_MESSAGE;
}

function persistenceFailure({ code, operation, cause = null, attemptedSize = null, rollbackVerified = true, extra = null }) {
  const failure = {
    ok: false,
    error: {
      code,
      operation,
      keyName: WORKSPACE_DAYS_STORAGE_KEY,
      exceptionName: cause?.name || null,
      exceptionCode: cause?.code ?? null,
      attemptedSize,
      rollbackVerified,
      userMessage: userMessageFor(code),
    },
  };
  if (extra && typeof extra === 'object') Object.assign(failure, extra);
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error('[WorkspaceDay persistence]', {
      operation,
      code,
      exceptionName: failure.error.exceptionName,
      exceptionCode: failure.error.exceptionCode,
      attemptedSize,
      rollbackVerified,
    });
  }
  return failure;
}

export function getWorkspaceDayPersistenceErrorMessage(result) {
  return result?.error?.userMessage || GENERIC_ERROR_MESSAGE;
}

// ── low-level read / write ───────────────────────────────────────────────────

export function getWorkspaceDays(storage = localStorage) {
  try {
    const raw = storage.getItem(WORKSPACE_DAYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadWorkspaceDaysForWrite(operation, storage) {
  let raw;
  try {
    raw = storage.getItem(WORKSPACE_DAYS_STORAGE_KEY);
  } catch (cause) {
    return persistenceFailure({
      code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.STORAGE_READ_FAILED,
      operation,
      cause,
    });
  }
  if (!raw) return { ok: true, days: [], raw: null };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError('workspace_days_v1 value is not an array');
    return { ok: true, days: parsed, raw };
  } catch (cause) {
    return persistenceFailure({
      code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.INVALID_READ_BACK,
      operation,
      cause,
    });
  }
}

function restorePreviousRaw(storage, previousRaw, serialized) {
  try {
    const currentRaw = storage.getItem(WORKSPACE_DAYS_STORAGE_KEY);
    if (currentRaw !== serialized) return currentRaw === previousRaw;
    if (previousRaw === null) storage.removeItem(WORKSPACE_DAYS_STORAGE_KEY);
    else storage.setItem(WORKSPACE_DAYS_STORAGE_KEY, previousRaw);
    return storage.getItem(WORKSPACE_DAYS_STORAGE_KEY) === previousRaw;
  } catch {
    return false;
  }
}

/**
 * Persists the complete WorkspaceDay array and verifies the exact write.
 * Exported for isolated tests; production callers use the operation wrappers.
 */
export function persistWorkspaceDays(days, {
  operation = 'save-days',
  intendedDayIds = [],
  absentDayIds = [],
  previousRaw,
  storage = localStorage,
} = {}) {
  let serialized;
  try {
    serialized = JSON.stringify(days);
  } catch (cause) {
    return persistenceFailure({
      code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.SERIALIZATION_FAILED,
      operation,
      cause,
    });
  }

  const attemptedSize = estimateSerializedBytes(serialized);
  let originalRaw = previousRaw;
  if (originalRaw === undefined) {
    try {
      originalRaw = storage.getItem(WORKSPACE_DAYS_STORAGE_KEY);
    } catch (cause) {
      return persistenceFailure({
        code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.STORAGE_READ_FAILED,
        operation,
        cause,
        attemptedSize,
      });
    }
  }

  try {
    storage.setItem(WORKSPACE_DAYS_STORAGE_KEY, serialized);
  } catch (cause) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: isQuotaExceededError(cause)
        ? WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.QUOTA_EXCEEDED
        : WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.STORAGE_WRITE_FAILED,
      operation,
      cause,
      attemptedSize,
      rollbackVerified,
    });
  }

  let readBackRaw;
  try {
    readBackRaw = storage.getItem(WORKSPACE_DAYS_STORAGE_KEY);
  } catch (cause) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.STORAGE_READ_FAILED,
      operation,
      cause,
      attemptedSize,
      rollbackVerified,
    });
  }

  if (readBackRaw !== serialized) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.READ_BACK_MISMATCH,
      operation,
      attemptedSize,
      rollbackVerified,
    });
  }

  let persistedDays;
  try {
    persistedDays = JSON.parse(readBackRaw);
    if (!Array.isArray(persistedDays)) throw new TypeError('workspace_days_v1 value is not an array');
  } catch (cause) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.INVALID_READ_BACK,
      operation,
      cause,
      attemptedSize,
      rollbackVerified,
    });
  }

  const persistedIds = new Set(persistedDays.map((day) => day?.id).filter(Boolean));
  if (intendedDayIds.some((id) => !persistedIds.has(id))) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.INTENDED_DAY_MISSING,
      operation,
      attemptedSize,
      rollbackVerified,
    });
  }
  if (absentDayIds.some((id) => persistedIds.has(id))) {
    const rollbackVerified = restorePreviousRaw(storage, originalRaw, serialized);
    return persistenceFailure({
      code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.DAY_STILL_PRESENT,
      operation,
      attemptedSize,
      rollbackVerified,
    });
  }

  return { ok: true, operation, persistedDays, persistedCount: persistedDays.length, attemptedSize };
}

// ── query helpers ───────────────────────────────────────────────────────────

export function getWorkspaceDayById(id, { storage = localStorage } = {}) {
  return getWorkspaceDays(storage).find((day) => day?.id === id) || null;
}

/** The single open day, or null. Also the guard the single-open invariant reads. */
export function getOpenWorkspaceDay({ storage = localStorage } = {}) {
  return getWorkspaceDays(storage).find((day) => day?.status === 'open') || null;
}

/** Given an item/ref, every day id it is currently attached to (dedup-key match). */
export function getWorkspaceDayIdsForItem(itemOrRef, { storage = localStorage } = {}) {
  const targetKey = getWorkspaceDayItemDedupKey(itemOrRef);
  return getWorkspaceDays(storage)
    .filter((day) => Array.isArray(day?.members)
      && day.members.some((member) => getWorkspaceDayMemberDedupKey(member) === targetKey))
    .map((day) => day.id);
}

/**
 * Read model for viewing a (closed or open) day: per-member drift flags +
 * informational age. Pure read — never mutates contentSnapshot (Stage brief #7).
 */
export function getWorkspaceDayReadModel(dayId, { liveItemsById = {}, now = new Date(), storage = localStorage } = {}) {
  const day = getWorkspaceDayById(dayId, { storage });
  if (!day) {
    return { ok: false, code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.DAY_NOT_FOUND, dayId };
  }
  const members = (Array.isArray(day.members) ? day.members : []).map((member) => {
    const liveItem = liveItemsById?.[member.workspaceItemId] || null;
    return {
      ...member,
      dedupKey: getWorkspaceDayMemberDedupKey(member),
      ...detectWorkspaceDayMemberDrift(member, liveItem),
    };
  });
  return {
    ok: true,
    day,
    members,
    isOpen: day.status === 'open',
    ageInDays: computeWorkspaceDayAgeInDays(day, now),
    driftedCount: members.filter((member) => member.drifted).length,
  };
}

// ── mutations ───────────────────────────────────────────────────────────────

/** Explicit manual create. Fails cleanly if an open day already exists. */
export function createWorkspaceDay({ entryMode = 'manual', now = new Date(), idSuffix, storage = localStorage } = {}) {
  const operation = 'create-day';
  if (!WORKSPACE_DAY_ENTRY_MODES.includes(entryMode)) {
    return persistenceFailure({ code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.INVALID_ENTRY_MODE, operation });
  }
  const loaded = loadWorkspaceDaysForWrite(operation, storage);
  if (!loaded.ok) return loaded;

  const openDay = loaded.days.find((day) => day?.status === 'open');
  if (openDay) {
    // Single-open invariant: fail BEFORE any write. Nothing changed → rollback trivially verified.
    return persistenceFailure({
      code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.OPEN_DAY_EXISTS,
      operation,
      rollbackVerified: true,
      extra: { openDayId: openDay.id },
    });
  }

  const record = createWorkspaceDayRecord({ now, entryMode, idSuffix });
  const days = [record, ...loaded.days];
  const result = persistWorkspaceDays(days, {
    operation,
    intendedDayIds: [record.id],
    previousRaw: loaded.raw,
    storage,
  });
  return result.ok
    ? { ...result, status: 'created', day: result.persistedDays.find((day) => day.id === record.id) }
    : { ...result, status: 'failed' };
}

function writeDay(operation, storage, dayId, mutateDay, { intendedDayIds, absentDayIds } = {}) {
  const loaded = loadWorkspaceDaysForWrite(operation, storage);
  if (!loaded.ok) return loaded;
  const index = loaded.days.findIndex((day) => day?.id === dayId);
  if (index === -1) {
    return persistenceFailure({ code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.DAY_NOT_FOUND, operation });
  }
  const mutation = mutateDay(loaded.days[index], loaded.days);
  if (mutation && mutation.ok === false) return mutation;
  const nextDay = mutation?.day ?? mutation;
  const nextDays = loaded.days.slice();
  nextDays[index] = { ...nextDay, updatedAt: new Date().toISOString() };
  const result = persistWorkspaceDays(nextDays, {
    operation,
    intendedDayIds: intendedDayIds ?? [dayId],
    absentDayIds: absentDayIds ?? [],
    previousRaw: loaded.raw,
    storage,
  });
  if (!result.ok) return { ...result, status: 'failed' };
  return {
    ...result,
    status: mutation?.status || 'updated',
    day: result.persistedDays.find((day) => day.id === dayId),
    meta: mutation?.meta || {},
  };
}

/** Attach an item to an OPEN day. In-day dedup by dedupKey; cross-day allowed. */
export function attachItemToWorkspaceDay(dayId, { item, video = null, entryMode = 'manual', now = new Date(), storage = localStorage } = {}) {
  const operation = 'attach-item';
  if (!item || !item.id) {
    return persistenceFailure({ code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.MEMBER_ITEM_MISSING, operation });
  }
  return writeDay(operation, storage, dayId, (day) => {
    if (day.status !== 'open') {
      return persistenceFailure({ code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.DAY_NOT_OPEN, operation });
    }
    const members = Array.isArray(day.members) ? day.members.slice() : [];
    const newMember = buildWorkspaceDayMember({ item, video, entryMode, now });
    const dedupKey = getWorkspaceDayMemberDedupKey(newMember);
    const existing = members.find((member) => getWorkspaceDayMemberDedupKey(member) === dedupKey);
    if (existing) {
      return { day, status: 'already_attached', meta: { member: existing, deduped: true } };
    }
    members.push(newMember);
    return { day: { ...day, members }, status: 'attached', meta: { member: newMember, deduped: false } };
  });
}

/** Remove a member from a day (open or closed). */
export function detachItemFromWorkspaceDay(dayId, workspaceItemId, { storage = localStorage } = {}) {
  const operation = 'detach-item';
  return writeDay(operation, storage, dayId, (day) => {
    const members = Array.isArray(day.members) ? day.members : [];
    const nextMembers = members.filter((member) => String(member?.workspaceItemId) !== String(workspaceItemId));
    if (nextMembers.length === members.length) {
      return persistenceFailure({ code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.MEMBER_NOT_FOUND, operation });
    }
    return { day: { ...day, members: nextMembers }, status: 'detached' };
  });
}

/**
 * Atomic close. Every member frozen + contentSnapshot + identity reaffirmed
 * from the live item (liveItemsById[workspaceItemId]); day.closeSnapshot built;
 * status → 'closed'; closedAt set — all in one verified write.
 */
export function closeWorkspaceDay(dayId, { liveItemsById = {}, now = new Date(), storage = localStorage } = {}) {
  const operation = 'close-day';
  const iso = (now instanceof Date ? now : new Date(now)).toISOString();
  return writeDay(operation, storage, dayId, (day) => {
    if (day.status !== 'open') {
      return persistenceFailure({ code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.DAY_NOT_OPEN, operation });
    }
    const members = (Array.isArray(day.members) ? day.members : []).map((member) => (
      freezeWorkspaceDayMember(member, liveItemsById?.[member.workspaceItemId] || null, { now })
    ));
    const frozenDay = { ...day, members, status: 'closed', closedAt: iso };
    const closeSnapshot = buildDayCloseSnapshot(frozenDay, members, { now });
    return {
      day: { ...frozenDay, closeSnapshot },
      status: 'closed',
      meta: { closeSnapshot, frozenCount: closeSnapshot.frozenCount },
    };
  });
}

/**
 * Audited reopen. reopenCount++ / reopenedAt; closedAt cleared. Existing members
 * stay frozen:true. The last closeSnapshot is retained for reference.
 */
export function reopenWorkspaceDay(dayId, { now = new Date(), storage = localStorage } = {}) {
  const operation = 'reopen-day';
  const iso = (now instanceof Date ? now : new Date(now)).toISOString();
  return writeDay(operation, storage, dayId, (day, allDays) => {
    if (day.status !== 'closed') {
      return persistenceFailure({ code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.DAY_NOT_CLOSED, operation });
    }
    // Single-open invariant (same guard createWorkspaceDay enforces): fail cleanly
    // BEFORE any write if some OTHER day is already open. Reopening is still allowed
    // when no other day is open.
    const otherOpenDay = (Array.isArray(allDays) ? allDays : []).find(
      (candidate) => candidate?.id !== dayId && candidate?.status === 'open',
    );
    if (otherOpenDay) {
      return persistenceFailure({
        code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.OPEN_DAY_EXISTS,
        operation,
        rollbackVerified: true,
        extra: { openDayId: otherOpenDay.id },
      });
    }
    return {
      day: {
        ...day,
        status: 'open',
        closedAt: null,
        reopenCount: Number(day.reopenCount || 0) + 1,
        reopenedAt: iso,
      },
      status: 'reopened',
      meta: { reopenCount: Number(day.reopenCount || 0) + 1 },
    };
  });
}

/**
 * The ONLY operation that updates a member's contentSnapshot + itemIdentityKey
 * and sets refreshedAt. Requires the live item.
 */
export function refreshWorkspaceDayMember(dayId, workspaceItemId, { liveItem = null, video = null, now = new Date(), storage = localStorage } = {}) {
  const operation = 'refresh-member';
  if (!liveItem) {
    return persistenceFailure({ code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.MEMBER_ITEM_MISSING, operation });
  }
  return writeDay(operation, storage, dayId, (day) => {
    const members = Array.isArray(day.members) ? day.members : [];
    const memberIndex = members.findIndex((member) => String(member?.workspaceItemId) === String(workspaceItemId));
    if (memberIndex === -1) {
      return persistenceFailure({ code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.MEMBER_NOT_FOUND, operation });
    }
    const nextMembers = members.slice();
    nextMembers[memberIndex] = refreshWorkspaceDayMemberFromSource(members[memberIndex], liveItem, { video, now });
    return {
      day: { ...day, members: nextMembers },
      status: 'refreshed',
      meta: { member: nextMembers[memberIndex] },
    };
  });
}

/** Delete a day — works on BOTH open and closed days (no restriction). */
export function deleteWorkspaceDay(dayId, { storage = localStorage } = {}) {
  const operation = 'delete-day';
  const loaded = loadWorkspaceDaysForWrite(operation, storage);
  if (!loaded.ok) return loaded;
  if (!loaded.days.some((day) => day?.id === dayId)) {
    return persistenceFailure({ code: WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.DAY_NOT_FOUND, operation });
  }
  const result = persistWorkspaceDays(loaded.days.filter((day) => day?.id !== dayId), {
    operation,
    absentDayIds: [dayId],
    previousRaw: loaded.raw,
    storage,
  });
  return result.ok ? { ...result, status: 'deleted' } : { ...result, status: 'failed' };
}
