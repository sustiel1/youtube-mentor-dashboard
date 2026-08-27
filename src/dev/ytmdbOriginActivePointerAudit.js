import {
  APP_DATA_DB_VERSION,
  APP_DATA_STORES,
} from '../lib/persistence/storageManifest.js';
import {
  canonicalSha256,
  checksumWorkspaceItemIds,
  checksumWorkspacePayloadsExcludingTopicAssignment,
  fnv1a,
  sha256Text,
  verifyWorkspaceRaw,
} from '../lib/persistence/storageIntegrity.js';
import {
  verifyWorkspaceChangeJournalEntry,
} from '../lib/persistence/workspaceChangeJournal.js';
import { buildWorkspaceProjectionRecords } from '../lib/persistence/workspaceProjection.js';
import { countUniqueWorkspaceContents } from '../utils/workspaceMarketDimensions.js';
import {
  getStructuredSnapshotContent,
  getWorkspaceItemIdentity,
} from '../utils/workspaceItemIdentity.js';

export const ACTIVE_POINTER_AUDIT_DB = 'yt_mentor_app_data_v1';
export const ACTIVE_POINTER_AUDIT_PATH = '/ytmdb-origin-active-pointer-audit.html';
export const EXPECTED_ACTIVE_GENERATION = 'generation-1786981030945-zrx0g2ry';
export const EXPECTED_ACTIVE_WORKSPACE_GENERATION = 'workspace-e5d13fa5-ca1e-456a-8891-32f52e814f2c';

const META_STORE = 'meta';
const WORKSPACE_SOURCE_KEY = 'workspace_library_v1';
const EXPORT_PAYLOAD_OMITTED_FIELDS = Object.freeze([
  'topicId',
  'subTopicId',
  'subtopicId',
  'topicName',
  'subTopicName',
  'subtopicName',
  'category',
  'subCategory',
]);
const POINTER_KEYS = Object.freeze([
  'activeGeneration',
  'activeWorkspaceGeneration',
]);

const EXPECTED_LOGICAL_WORKSPACE = Object.freeze({
  uniqueItemCount: 142,
  activeCount: 127,
  archivedCount: 15,
  idChecksum: '9a3333fb',
  payloadChecksum: '23a8ea3b',
  migrationChecksum: 'a010a29b',
});

const IDENTITY_VOLATILE_KEYS = new Set([
  'id',
  'savedAt',
  'updatedAt',
  'createdAt',
  'archivedAt',
  'uiState',
  'selected',
  'isSelected',
  'sortIndex',
  'displayOrder',
]);

const SAFE_ITEM_TYPES = new Set([
  'structured-snapshot',
  'summary',
  'chapters',
  'insights',
  'useful-knowledge',
  'app-builder',
  'topics-subtopics',
  'specialized',
]);

function fail(message) {
  throw new Error(message);
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  });
}

function projectSafePointer(record) {
  if (!record || typeof record !== 'object') return null;
  return Object.freeze({
    key: typeof record.key === 'string' ? record.key : null,
    generationId: typeof record.generationId === 'string' ? record.generationId : null,
    state: typeof record.state === 'string' ? record.state : null,
  });
}

function checksumExportPayload(items) {
  return fnv1a(JSON.stringify(items.map((item) => {
    const copy = { ...item };
    EXPORT_PAYLOAD_OMITTED_FIELDS.forEach((field) => delete copy[field]);
    return copy;
  })));
}

function normalizeIdentityJson(value) {
  if (Array.isArray(value)) return value.map(normalizeIdentityJson);
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? value.trim() : value;
  }
  return Object.keys(value).sort().reduce((result, key) => {
    if (!IDENTITY_VOLATILE_KEYS.has(key) && value[key] !== undefined) {
      result[key] = normalizeIdentityJson(value[key]);
    }
    return result;
  }, {});
}

function logicalIdentityDescriptor(item) {
  const identity = getWorkspaceItemIdentity(item);
  const recordId = String(item?.id || '');
  const key = identity?.key || `record:${recordId}`;
  const identityPayload = item?.itemType === 'structured-snapshot'
    ? getStructuredSnapshotContent(item)
    : item?.identityPayload
      ? normalizeIdentityJson(item.identityPayload)
      : null;
  return {
    key,
    contentHash: identity?.contentHash || null,
    identityPayload,
  };
}

function safeTimestamp(value) {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(text) ? text : null;
}

async function describePhysicalWorkspaceItems(items, generationId, cryptoProvider) {
  const occurrences = new Map();
  const descriptions = [];
  for (let sourceIndex = 0; sourceIndex < items.length; sourceIndex += 1) {
    const item = items[sourceIndex];
    const recordId = String(item?.id || '');
    const occurrence = occurrences.get(recordId) || 0;
    occurrences.set(recordId, occurrence + 1);
    const recordKey = `${recordId}\u0000${occurrence}`;
    const projectionId = `${WORKSPACE_SOURCE_KEY}:${sourceIndex}:${recordId}`;
    const identity = logicalIdentityDescriptor(item);
    const normalizedRecord = normalizeIdentityJson(item);
    const serialized = JSON.stringify(item);
    const [
      logicalIdentitySha256,
      physicalRecordIdSha256,
      physicalRecordKeySha256,
      itemSha256,
      normalizedRecordSha256,
      identityPayloadSha256,
    ] = await Promise.all([
      sha256Text(identity.key, cryptoProvider),
      sha256Text(recordId, cryptoProvider),
      sha256Text(recordKey, cryptoProvider),
      canonicalSha256(item, cryptoProvider),
      canonicalSha256(normalizedRecord, cryptoProvider),
      canonicalSha256(identity.identityPayload, cryptoProvider),
    ]);
    descriptions.push({
      item,
      recordId,
      recordKey,
      logicalKey: identity.key,
      sourceIndex,
      savedAt: String(item?.savedAt || ''),
      safe: {
        logicalIdentitySha256,
        physicalRecordIdSha256,
        physicalRecordKeySha256,
        projectionIdSha256: await sha256Text(projectionId, cryptoProvider),
        generationId,
        sourceIndex,
        createdAt: safeTimestamp(item?.createdAt || item?.savedAt),
        updatedAt: safeTimestamp(item?.updatedAt),
        archived: Boolean(item?.archivedAt),
        itemType: SAFE_ITEM_TYPES.has(String(item?.itemType || '')) ? String(item.itemType) : null,
        contentHash: identity.contentHash,
        byteLength: new TextEncoder().encode(serialized).byteLength,
        itemSha256,
        normalizedRecordSha256,
        identityPayloadSha256,
      },
    });
  }
  return descriptions;
}

function sortProjectionRecords(records) {
  return [...records].sort((left, right) => (
    Number(left?.sourceIndex ?? Number.MAX_SAFE_INTEGER)
      - Number(right?.sourceIndex ?? Number.MAX_SAFE_INTEGER)
    || String(left?.id || '').localeCompare(String(right?.id || ''))
  ));
}

function safeOperationCounts(entries) {
  const operations = {};
  const changes = { created: 0, updated: 0, archived: 0, restored: 0, deleted: 0 };
  let tombstoneCount = 0;
  for (const entry of entries) {
    operations[entry.operation] = (operations[entry.operation] || 0) + 1;
    for (const key of Object.keys(changes)) {
      changes[key] += Array.isArray(entry.changeSet?.[key]) ? entry.changeSet[key].length : 0;
    }
    tombstoneCount += Array.isArray(entry.tombstones) ? entry.tombstones.length : 0;
  }
  return {
    operations: Object.fromEntries(Object.entries(operations).sort(([left], [right]) => left.localeCompare(right))),
    changes,
    tombstoneCount,
  };
}

function assertJournalTombstones(entry) {
  const deleted = Array.isArray(entry?.changeSet?.deleted) ? entry.changeSet.deleted : [];
  const tombstones = Array.isArray(entry?.tombstones) ? entry.tombstones : [];
  if (JSON.stringify(deleted) !== JSON.stringify(tombstones)) {
    fail('Workspace journal tombstones do not match deleted records');
  }
}

function checksumWorkspaceSet(items) {
  return {
    recordCount: items.length,
    idChecksum: checksumWorkspaceItemIds(items),
    payloadChecksum: checksumExportPayload(items),
    migrationChecksum: checksumWorkspacePayloadsExcludingTopicAssignment(items),
  };
}

function sameWorkspaceChecksums(left, right) {
  return left.recordCount === right.recordCount
    && left.idChecksum === right.idChecksum
    && left.payloadChecksum === right.payloadChecksum
    && left.migrationChecksum === right.migrationChecksum;
}

async function buildSafeDuplicateAudit({
  anchorItems,
  currentItems,
  chain,
  cryptoProvider,
}) {
  const [anchorRecords, currentRecords] = await Promise.all([
    describePhysicalWorkspaceItems(anchorItems, EXPECTED_ACTIVE_GENERATION, cryptoProvider),
    describePhysicalWorkspaceItems(currentItems, EXPECTED_ACTIVE_WORKSPACE_GENERATION, cryptoProvider),
  ]);
  const anchorByRecordKey = new Map(anchorRecords.map((record) => [record.recordKey, record]));
  const currentByRecordKey = new Map(currentRecords.map((record) => [record.recordKey, record]));
  const journalEvents = new Map();
  const tombstonedRecordKeys = new Set();
  chain.forEach((entry, index) => {
    const sequence = index + 1;
    for (const changeType of ['created', 'updated', 'archived', 'restored', 'deleted']) {
      const changes = Array.isArray(entry.changeSet?.[changeType]) ? entry.changeSet[changeType] : [];
      changes.forEach((change) => {
        const events = journalEvents.get(change.recordKey) || [];
        events.push({ sequence, operation: entry.operation, changeType });
        journalEvents.set(change.recordKey, events);
      });
    }
    const tombstones = Array.isArray(entry.tombstones) ? entry.tombstones : [];
    tombstones.forEach((tombstone) => tombstonedRecordKeys.add(tombstone.recordKey));
  });

  const netAdded = currentRecords.filter((record) => !anchorByRecordKey.has(record.recordKey));
  const netRemoved = anchorRecords.filter((record) => !currentByRecordKey.has(record.recordKey));
  const currentGroups = new Map();
  currentRecords.forEach((record) => {
    const group = currentGroups.get(record.logicalKey) || [];
    group.push(record);
    currentGroups.set(record.logicalKey, group);
  });
  const duplicateGroups = [...currentGroups.values()].filter((group) => group.length > 1);
  const physicalDuplicateCount = duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0);

  const safeDuplicateGroups = [];
  for (const group of duplicateGroups) {
    const uiSorted = [...group].sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    const previewSorted = [...group].sort((left, right) => (
      left.savedAt.localeCompare(right.savedAt) || left.recordId.localeCompare(right.recordId)
    ));
    const safeRecords = group.map((record) => {
      const events = journalEvents.get(record.recordKey) || [];
      return {
        ...record.safe,
        presentInAnchor: anchorByRecordKey.has(record.recordKey),
        presentInActive: true,
        sourceGenerations: anchorByRecordKey.has(record.recordKey)
          ? [EXPECTED_ACTIVE_GENERATION, EXPECTED_ACTIVE_WORKSPACE_GENERATION]
          : [EXPECTED_ACTIVE_WORKSPACE_GENERATION],
        journalSequence: events.at(-1)?.sequence || null,
        operationType: events.at(-1)?.operation || 'migration-anchor',
        changeType: events.at(-1)?.changeType || null,
        referencedByTombstone: tombstonedRecordKeys.has(record.recordKey),
      };
    }).sort((left, right) => left.sourceIndex - right.sourceIndex);
    safeDuplicateGroups.push({
      logicalIdentitySha256: group[0].safe.logicalIdentitySha256,
      contentHash: group[0].safe.contentHash,
      physicalRecordCount: group.length,
      uiCanonicalPhysicalIdSha256: uiSorted[0].safe.physicalRecordIdSha256,
      duplicatePreviewCanonicalPhysicalIdSha256: previewSorted[0].safe.physicalRecordIdSha256,
      canonicalRulesSelectSameRecord:
        uiSorted[0].recordKey === previewSorted[0].recordKey,
      records: safeRecords,
    });
  }
  safeDuplicateGroups.sort((left, right) => (
    left.logicalIdentitySha256.localeCompare(right.logicalIdentitySha256)
  ));

  const duplicateClassifications = [];
  for (const group of duplicateGroups) {
    const uiCanonical = [...group].sort((left, right) => (
      right.savedAt.localeCompare(left.savedAt)
    ))[0];
    for (const duplicate of group.filter((record) => record.recordKey !== uiCanonical.recordKey)) {
      const journalMatches = journalEvents.get(duplicate.recordKey) || [];
      let classification = 'unknown';
      const sameStrongIdentity =
        duplicate.safe.identityPayloadSha256 === uiCanonical.safe.identityPayloadSha256;
      const uniqueMetadataVersusUiCanonical =
        duplicate.safe.normalizedRecordSha256 !== uiCanonical.safe.normalizedRecordSha256;
      if (!sameStrongIdentity) {
        classification = 'identity-key collision';
      } else if (duplicate.safe.archived !== uiCanonical.safe.archived) {
        classification = 'archive/restore representation';
      } else if (!uniqueMetadataVersusUiCanonical) {
        classification = 'expected repeated save safely collapsed by UI';
      } else {
        classification = 'same logical item with newer valid revision';
      }
      duplicateClassifications.push({
        logicalIdentitySha256: duplicate.safe.logicalIdentitySha256,
        physicalRecordIdSha256: duplicate.safe.physicalRecordIdSha256,
        uiCanonicalPhysicalRecordIdSha256: uiCanonical.safe.physicalRecordIdSha256,
        classification,
        uniqueMetadataVersusUiCanonical,
        presentInAnchor: anchorByRecordKey.has(duplicate.recordKey),
        journalSequence: journalMatches.at(-1)?.sequence || null,
        operationType: journalMatches.at(-1)?.operation || 'migration-anchor',
      });
    }
  }
  duplicateClassifications.sort((left, right) => (
    left.physicalRecordIdSha256.localeCompare(right.physicalRecordIdSha256)
  ));

  const anchorChecksums = checksumWorkspaceSet(anchorItems);
  const anchorPreservingItems = anchorRecords.map((anchorRecord) => (
    currentByRecordKey.get(anchorRecord.recordKey)?.item
  )).filter(Boolean);
  const anchorPreservingChecksums = checksumWorkspaceSet(anchorPreservingItems);
  const uiCanonicalItems = [...currentGroups.values()].map((group) => (
    [...group].sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0]
  )).sort((left, right) => left.sourceIndex - right.sourceIndex).map((record) => record.item);
  const uiCanonicalChecksums = checksumWorkspaceSet(uiCanonicalItems);
  const activeLogicalCount = countUniqueWorkspaceContents(
    currentItems.filter((item) => !item?.archivedAt),
  );
  const archivedLogicalCount = countUniqueWorkspaceContents(
    currentItems.filter((item) => Boolean(item?.archivedAt)),
  );
  const activeIdentities = new Set(currentRecords.filter((record) => !record.safe.archived).map((record) => record.logicalKey));
  const archivedIdentities = new Set(currentRecords.filter((record) => record.safe.archived).map((record) => record.logicalKey));
  const crossStatusIdentityCount = [...activeIdentities].filter((key) => archivedIdentities.has(key)).length;
  const anchorLogicalKeys = new Set(anchorRecords.map((record) => record.logicalKey));
  const currentLogicalKeys = new Set(currentRecords.map((record) => record.logicalKey));
  const anchorLogicalIdentityCount = anchorLogicalKeys.size;
  const netAddedLogicalIdentityCount = [...currentLogicalKeys].filter((key) => !anchorLogicalKeys.has(key)).length;
  const netRemovedLogicalIdentityCount = [...anchorLogicalKeys].filter((key) => !currentLogicalKeys.has(key)).length;
  const duplicateGroupPredatesMigration = duplicateGroups.every((group) => (
    group.every((record) => anchorByRecordKey.has(record.recordKey))
  ));
  const netAddedAllJournalCreated = netAdded.every((record) => (
    (journalEvents.get(record.recordKey) || []).some((event) => event.changeType === 'created')
  ));
  const netRemovedAllTombstoned = netRemoved.every((record) => (
    tombstonedRecordKeys.has(record.recordKey)
  ));

  const expectedChecksums = {
    recordCount: EXPECTED_LOGICAL_WORKSPACE.uniqueItemCount,
    idChecksum: EXPECTED_LOGICAL_WORKSPACE.idChecksum,
    payloadChecksum: EXPECTED_LOGICAL_WORKSPACE.payloadChecksum,
    migrationChecksum: EXPECTED_LOGICAL_WORKSPACE.migrationChecksum,
  };
  const baselineChecks = {
    anchorRecordCount: anchorRecords.length === 142,
    activeRecordCount: currentRecords.length === 145,
    journalNetDelta: netAdded.length - netRemoved.length === 3,
    journalPhysicalDelta: netAdded.length === 8 && netRemoved.length === 5,
    journalLogicalDelta:
      netAddedLogicalIdentityCount === 8 && netRemovedLogicalIdentityCount === 5,
    physicalDuplicateCount: physicalDuplicateCount === 3,
    logicalIdentityCount: currentGroups.size === 142,
    duplicateGroupPredatesMigration,
    classificationsKnown:
      duplicateClassifications.every((entry) => entry.classification !== 'unknown'),
    activeLogicalCount: activeLogicalCount === 128,
    archivedLogicalCount: archivedLogicalCount === EXPECTED_LOGICAL_WORKSPACE.archivedCount,
    crossStatusIdentityCount: crossStatusIdentityCount === 1,
    netAddedAllJournalCreated,
    netRemovedAllTombstoned,
    anchorChecksums: sameWorkspaceChecksums(anchorChecksums, expectedChecksums),
  };
  const historicalExpectationChecks = {
    activeLogicalCount127: activeLogicalCount === EXPECTED_LOGICAL_WORKSPACE.activeCount,
    noCrossStatusIdentity: crossStatusIdentityCount === 0,
    anchorPreservingChecksums:
      sameWorkspaceChecksums(anchorPreservingChecksums, expectedChecksums),
  };

  const report = {
    anchorRecordCount: anchorRecords.length,
    activeRecordCount: currentRecords.length,
    netAddedRecordCount: netAdded.length,
    netRemovedRecordCount: netRemoved.length,
    anchorLogicalIdentityCount,
    netAddedLogicalIdentityCount,
    netRemovedLogicalIdentityCount,
    logicalIdentityCount: currentGroups.size,
    duplicateGroupCount: duplicateGroups.length,
    physicalDuplicateCount,
    activeLogicalCount,
    archivedLogicalCount,
    crossStatusIdentityCount,
    anchorChecksums,
    anchorPreservingChecksums,
    uiCanonicalChecksums,
    anchorPreservingReproducesApprovedChecksums:
      sameWorkspaceChecksums(anchorPreservingChecksums, expectedChecksums),
    uiCanonicalReproducesApprovedChecksums:
      sameWorkspaceChecksums(uiCanonicalChecksums, expectedChecksums),
    duplicateClassifications,
    duplicateGroups: safeDuplicateGroups,
    uniqueMetadataVersusUiCanonicalCount:
      duplicateClassifications.filter((entry) => entry.uniqueMetadataVersusUiCanonical).length,
    canonicalSelectionRule:
      'count-only identity grouping; UI latest savedAt; duplicate preview earliest savedAt then record ID',
    deterministicForPersistedOrder: true,
    baselineChecks,
    historicalExpectationChecks,
    baselineMatches: Object.values(baselineChecks).every(Boolean),
  };
  return {
    ...report,
    duplicateGroupsSha256: await canonicalSha256(safeDuplicateGroups, cryptoProvider),
    safeDuplicateReportSha256: await canonicalSha256(report, cryptoProvider),
  };
}

export function buildWorkspaceLineageChain({
  anchorGenerationId,
  activeWorkspaceGenerationId,
  activeWorkspaceJournalOperationId,
  entries,
}) {
  if (!anchorGenerationId || !activeWorkspaceGenerationId || !Array.isArray(entries)) {
    fail('Complete Workspace lineage metadata is required');
  }
  const byPrevious = new Map();
  const nextGenerationIds = new Set();
  for (const entry of entries) {
    if (
      !entry?.operationId
      || !entry.previousGenerationId
      || !entry.nextGenerationId
      || entry.anchorGenerationId !== anchorGenerationId
    ) {
      fail('Workspace journal contains an invalid or orphaned entry');
    }
    if (nextGenerationIds.has(entry.nextGenerationId)) {
      fail('Workspace journal contains a duplicate next-generation sequence');
    }
    nextGenerationIds.add(entry.nextGenerationId);
    const bucket = byPrevious.get(entry.previousGenerationId) || [];
    bucket.push(entry);
    byPrevious.set(entry.previousGenerationId, bucket);
    assertJournalTombstones(entry);
  }
  for (const start of new Set(entries.flatMap((entry) => [entry.previousGenerationId, entry.nextGenerationId]))) {
    const seen = new Set();
    let current = start;
    while (byPrevious.has(current)) {
      if (seen.has(current)) fail('Workspace journal contains a generation cycle');
      seen.add(current);
      const candidates = byPrevious.get(current);
      if (candidates.length !== 1) fail('Workspace journal contains a branched recovery chain');
      current = candidates[0].nextGenerationId;
    }
  }

  const consumed = new Set();
  const chain = [];
  let currentGenerationId = anchorGenerationId;
  while (currentGenerationId !== activeWorkspaceGenerationId) {
    const candidates = byPrevious.get(currentGenerationId) || [];
    if (candidates.length === 0) fail('Workspace journal is missing a required generation link');
    if (candidates.length !== 1) fail('Workspace journal contains a branched recovery chain');
    const entry = candidates[0];
    if (consumed.has(entry.operationId)) fail('Workspace journal contains a generation cycle');
    consumed.add(entry.operationId);
    chain.push(entry);
    currentGenerationId = entry.nextGenerationId;
  }
  if (consumed.size !== entries.length) {
    fail('Workspace journal contains disconnected or orphaned entries');
  }
  const last = chain.at(-1) || null;
  if (
    activeWorkspaceGenerationId !== anchorGenerationId
    && last?.operationId !== activeWorkspaceJournalOperationId
  ) {
    fail('Active Workspace pointer references a missing or competing journal operation');
  }
  return chain;
}

export function assertApprovedAuditLocation(locationLike = globalThis.location) {
  if (
    locationLike?.protocol !== 'http:'
    || locationLike.hostname !== 'localhost'
    || locationLike.port !== '5184'
    || locationLike.pathname !== ACTIVE_POINTER_AUDIT_PATH
    || locationLike.search !== ''
    || locationLike.hash !== ''
  ) {
    fail('Active-pointer audit is restricted to the approved local origin and exact pathname');
  }
}

export function validateActivePointerRecords({
  activeGeneration,
  activeWorkspaceGeneration,
  expectedGenerationId = EXPECTED_ACTIVE_GENERATION,
}) {
  if (!activeGeneration || activeGeneration.key !== POINTER_KEYS[0]) {
    fail('activeGeneration pointer is missing or invalid');
  }
  if (!activeWorkspaceGeneration || activeWorkspaceGeneration.key !== POINTER_KEYS[1]) {
    fail('activeWorkspaceGeneration pointer is missing or invalid');
  }
  if (
    activeGeneration.generationId !== expectedGenerationId
    || activeWorkspaceGeneration.generationId !== expectedGenerationId
    || activeGeneration.generationId !== activeWorkspaceGeneration.generationId
  ) {
    fail('Active generation pointers are missing, stale, or mismatched');
  }
  if (activeGeneration.state !== 'active' || activeWorkspaceGeneration.state !== 'active') {
    fail('Referenced generation is not active');
  }
  return Object.freeze({
    activeGenerationId: activeGeneration.generationId,
    activeWorkspaceGenerationId: activeWorkspaceGeneration.generationId,
    pointersEqual: true,
    generationState: 'active',
  });
}

export function openExistingActivePointerDatabase({
  indexedDBFactory = globalThis.indexedDB,
  counters,
} = {}) {
  if (!indexedDBFactory?.open) fail('IndexedDB is unavailable');
  counters.openCalls += 1;
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDBFactory.open(ACTIVE_POINTER_AUDIT_DB);
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    request.onupgradeneeded = () => {
      counters.upgradeAttempts += 1;
      try { request.transaction?.abort(); } catch {}
      try { request.result?.close(); } catch {}
      rejectOnce(new Error('Database open attempted an upgrade; audit stopped'));
    };
    request.onblocked = () => rejectOnce(new Error('Database open was blocked'));
    request.onerror = () => rejectOnce(request.error || new Error('Database open failed'));
    request.onsuccess = () => {
      if (settled) {
        try { request.result?.close(); } catch {}
        return;
      }
      settled = true;
      const database = request.result;
      const expectedStores = Object.values(APP_DATA_STORES).sort();
      const actualStores = [...database.objectStoreNames].sort();
      if (
        database.name !== ACTIVE_POINTER_AUDIT_DB
        || database.version !== APP_DATA_DB_VERSION
        || JSON.stringify(actualStores) !== JSON.stringify(expectedStores)
      ) {
        database.close();
        reject(new Error('Unexpected database identity or schema'));
        return;
      }
      resolve(database);
    };
  });
}

async function readWorkspaceLineageSnapshot({
  indexedDBFactory = globalThis.indexedDB,
  cryptoProvider = globalThis.crypto,
} = {}) {
  const counters = {
    openCalls: 0,
    readonlyTransactions: 0,
    metadataReads: 0,
    journalAggregateReads: 0,
    journalCountOperations: 0,
    sourceEntryReads: 0,
    projectionAggregateReads: 0,
    readwriteTransactions: 0,
    writeCount: 0,
    upgradeAttempts: 0,
  };
  const database = await openExistingActivePointerDatabase({ indexedDBFactory, counters });
  try {
    const metaTransaction = database.transaction(APP_DATA_STORES.META, 'readonly');
    if (metaTransaction.mode !== 'readonly') fail('Non-readonly transaction rejected');
    counters.readonlyTransactions += 1;
    const metaDone = transactionComplete(metaTransaction);
    const metaStore = metaTransaction.objectStore(APP_DATA_STORES.META);
    const metaKeys = [
      'activeGeneration',
      'activeWorkspaceGeneration',
      'workspaceRecoveryAnchor',
      'migration',
    ];
    counters.metadataReads += metaKeys.length;
    const [activeGeneration, activeWorkspaceGeneration, recoveryAnchor, migration] = await Promise.all(
      metaKeys.map((key) => requestResult(metaStore.get(key))),
    );
    await metaDone;
    if (
      activeGeneration?.key !== 'activeGeneration'
      || activeGeneration.state !== 'active'
      || activeGeneration.generationId !== EXPECTED_ACTIVE_GENERATION
      || activeWorkspaceGeneration?.key !== 'activeWorkspaceGeneration'
      || activeWorkspaceGeneration.state !== 'active'
      || activeWorkspaceGeneration.generationId !== EXPECTED_ACTIVE_WORKSPACE_GENERATION
      || recoveryAnchor?.key !== 'workspaceRecoveryAnchor'
      || recoveryAnchor.state !== 'anchored'
      || recoveryAnchor.generationId !== EXPECTED_ACTIVE_GENERATION
      || migration?.key !== 'migration'
      || migration.state !== 'active'
      || migration.generationId !== EXPECTED_ACTIVE_GENERATION
    ) {
      fail('Active generation or recovery-anchor metadata is invalid');
    }

    const journalTransaction = database.transaction(APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL, 'readonly');
    if (journalTransaction.mode !== 'readonly') fail('Non-readonly transaction rejected');
    counters.readonlyTransactions += 1;
    const journalDone = transactionComplete(journalTransaction);
    const journalStore = journalTransaction.objectStore(APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL);
    counters.journalAggregateReads += 1;
    const journalEntries = await requestResult(
      journalStore.index('anchorGenerationId').getAll(EXPECTED_ACTIVE_GENERATION),
    );
    await journalDone;
    const chain = buildWorkspaceLineageChain({
      anchorGenerationId: EXPECTED_ACTIVE_GENERATION,
      activeWorkspaceGenerationId: EXPECTED_ACTIVE_WORKSPACE_GENERATION,
      activeWorkspaceJournalOperationId: activeWorkspaceGeneration.journalOperationId,
      entries: journalEntries,
    });

    const generationIds = [...new Set([
      EXPECTED_ACTIVE_GENERATION,
      ...chain.flatMap((entry) => [entry.previousGenerationId, entry.nextGenerationId]),
    ])];
    const dataTransaction = database.transaction([
      APP_DATA_STORES.SOURCE_ENTRIES,
      APP_DATA_STORES.WORKSPACE_ITEMS,
      APP_DATA_STORES.SNAPSHOTS,
    ], 'readonly');
    if (dataTransaction.mode !== 'readonly') fail('Non-readonly transaction rejected');
    counters.readonlyTransactions += 1;
    const dataDone = transactionComplete(dataTransaction);
    const sourceStore = dataTransaction.objectStore(APP_DATA_STORES.SOURCE_ENTRIES);
    const workspaceStore = dataTransaction.objectStore(APP_DATA_STORES.WORKSPACE_ITEMS);
    const snapshotStore = dataTransaction.objectStore(APP_DATA_STORES.SNAPSHOTS);
    counters.sourceEntryReads += generationIds.length;
    counters.projectionAggregateReads += 3;
    const [sourceEntries, anchorWorkspaceRecords, workspaceRecords, snapshotRecords] = await Promise.all([
      Promise.all(generationIds.map((generationId) => requestResult(
        sourceStore.get([generationId, WORKSPACE_SOURCE_KEY]),
      ))),
      requestResult(workspaceStore.index('generationId').getAll(EXPECTED_ACTIVE_GENERATION)),
      requestResult(workspaceStore.index('generationId').getAll(EXPECTED_ACTIVE_WORKSPACE_GENERATION)),
      requestResult(snapshotStore.index('generationId').getAll(EXPECTED_ACTIVE_WORKSPACE_GENERATION)),
    ]);
    await dataDone;

    const sourceByGeneration = new Map();
    generationIds.forEach((generationId, index) => {
      const entry = sourceEntries[index];
      if (
        !entry
        || entry.generationId !== generationId
        || entry.storageKey !== WORKSPACE_SOURCE_KEY
        || typeof entry.rawValue !== 'string'
      ) {
        fail('Workspace lineage references a missing source generation');
      }
      sourceByGeneration.set(generationId, entry);
    });
    const anchorSource = sourceByGeneration.get(EXPECTED_ACTIVE_GENERATION);
    if (
      await sha256Text(anchorSource.rawValue, cryptoProvider) !== recoveryAnchor.workspaceSourceHash
      || anchorSource.valueSha256 !== recoveryAnchor.workspaceSourceHash
    ) {
      fail('Migration recovery anchor source was modified');
    }
    const anchor = verifyWorkspaceRaw(anchorSource.rawValue);
    const expectedAnchorProjection = buildWorkspaceProjectionRecords(
      anchor.items,
      EXPECTED_ACTIVE_GENERATION,
    );
    const [anchorProjectionSha256, expectedAnchorProjectionSha256] = await Promise.all([
      canonicalSha256(sortProjectionRecords(anchorWorkspaceRecords), cryptoProvider),
      canonicalSha256(
        sortProjectionRecords(expectedAnchorProjection[APP_DATA_STORES.WORKSPACE_ITEMS]),
        cryptoProvider,
      ),
    ]);
    if (anchorProjectionSha256 !== expectedAnchorProjectionSha256) {
      fail('Migration-anchor Workspace projection is missing, orphaned or corrupt');
    }

    for (const entry of chain) {
      if (
        entry.anchorGenerationId !== recoveryAnchor.generationId
        || entry.anchorSourceHash !== recoveryAnchor.workspaceSourceHash
      ) {
        fail('Workspace journal entry references an unexpected recovery anchor');
      }
      await verifyWorkspaceChangeJournalEntry(entry, {
        previousRaw: sourceByGeneration.get(entry.previousGenerationId).rawValue,
        nextRaw: sourceByGeneration.get(entry.nextGenerationId).rawValue,
        cryptoProvider,
      });
    }

    const currentSource = sourceByGeneration.get(EXPECTED_ACTIVE_WORKSPACE_GENERATION);
    if (
      await sha256Text(currentSource.rawValue, cryptoProvider) !== activeWorkspaceGeneration.sourceHash
      || currentSource.valueSha256 !== activeWorkspaceGeneration.sourceHash
    ) {
      fail('Active Workspace source does not match its pointer');
    }
    const current = verifyWorkspaceRaw(currentSource.rawValue);
    const expectedProjection = buildWorkspaceProjectionRecords(
      current.items,
      EXPECTED_ACTIVE_WORKSPACE_GENERATION,
    );
    const sortedWorkspaceRecords = sortProjectionRecords(workspaceRecords);
    const sortedExpectedWorkspace = sortProjectionRecords(
      expectedProjection[APP_DATA_STORES.WORKSPACE_ITEMS],
    );
    const sortedSnapshotRecords = sortProjectionRecords(snapshotRecords);
    const sortedExpectedSnapshots = sortProjectionRecords(
      expectedProjection[APP_DATA_STORES.SNAPSHOTS],
    );
    const [workspaceProjectionSha256, expectedWorkspaceProjectionSha256, snapshotProjectionSha256, expectedSnapshotProjectionSha256] = await Promise.all([
      canonicalSha256(sortedWorkspaceRecords, cryptoProvider),
      canonicalSha256(sortedExpectedWorkspace, cryptoProvider),
      canonicalSha256(sortedSnapshotRecords, cryptoProvider),
      canonicalSha256(sortedExpectedSnapshots, cryptoProvider),
    ]);
    if (
      workspaceProjectionSha256 !== expectedWorkspaceProjectionSha256
      || snapshotProjectionSha256 !== expectedSnapshotProjectionSha256
      || workspaceRecords.length !== Number(activeWorkspaceGeneration.counts?.workspaceItems)
      || snapshotRecords.length !== Number(activeWorkspaceGeneration.counts?.snapshots)
    ) {
      fail('Active Workspace projection is missing, orphaned or corrupt');
    }

    const uniqueItemCount = countUniqueWorkspaceContents(current.items);
    const duplicateAudit = await buildSafeDuplicateAudit({
      anchorItems: anchor.items,
      currentItems: current.items,
      chain,
      cryptoProvider,
    });
    const operationSummary = safeOperationCounts(chain);
    const journalSha256 = await canonicalSha256(chain, cryptoProvider);
    const firstCreatedAt = chain[0]?.createdAt || null;
    const lastCreatedAt = chain.at(-1)?.createdAt || null;
    const result = {
      databaseName: database.name,
      databaseVersion: database.version,
      migrationAnchorGenerationId: activeGeneration.generationId,
      activeWorkspaceGenerationId: activeWorkspaceGeneration.generationId,
      migrationState: activeGeneration.state,
      workspaceState: activeWorkspaceGeneration.state,
      recoveryAnchorState: recoveryAnchor.state,
      lineageModel: 'linked-generation-v1',
      lineageValid: true,
      recoverable: true,
      competingPointerCount: 0,
      cycleCount: 0,
      orphanedJournalCount: 0,
      missingJournalCount: 0,
      duplicateNextGenerationCount: 0,
      replayOrderValid: true,
      journalEntryCount: chain.length,
      operationCounts: operationSummary.operations,
      changeCounts: operationSummary.changes,
      tombstoneCount: operationSummary.tombstoneCount,
      firstCreatedAt,
      lastCreatedAt,
      journalSha256,
      anchorProjectionSha256,
      workspaceProjectionSha256,
      snapshotProjectionSha256,
      expectedWorkspaceRecordCount: Number(activeWorkspaceGeneration.counts?.workspaceItems),
      actualWorkspaceRecordCount: workspaceRecords.length,
      expectedSnapshotRecordCount: Number(activeWorkspaceGeneration.counts?.snapshots),
      actualSnapshotRecordCount: snapshotRecords.length,
      saveCount: current.items.length,
      uniqueItemCount,
      duplicateLogicalSaveCount: current.items.length - uniqueItemCount,
      activeCount: duplicateAudit.activeLogicalCount,
      archivedCount: duplicateAudit.archivedLogicalCount,
      idChecksum: duplicateAudit.anchorChecksums.idChecksum,
      payloadChecksum: duplicateAudit.anchorChecksums.payloadChecksum,
      migrationChecksum: duplicateAudit.anchorChecksums.migrationChecksum,
      rawIdChecksum: current.integrity.idChecksum,
      rawPayloadChecksum: checksumExportPayload(current.items),
      rawMigrationChecksum: current.integrity.payloadChecksum,
      anchorSourceSha256: recoveryAnchor.workspaceSourceHash,
      currentSourceSha256: activeWorkspaceGeneration.sourceHash,
      duplicateAudit,
      counters,
    };
    return Object.freeze({
      ...result,
      safeReportSha256: await canonicalSha256(result, cryptoProvider),
    });
  } finally {
    database.close();
  }
}

export async function collectStableWorkspaceLineageAudit(options = {}) {
  const first = await readWorkspaceLineageSnapshot(options);
  const second = await readWorkspaceLineageSnapshot(options);
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    fail('Independent Workspace lineage audits were not identical');
  }
  const counters = Object.fromEntries(Object.keys(first.counters).map((key) => [
    key,
    first.counters[key] + second.counters[key],
  ]));
  return Object.freeze({ ...first, stableReads: 2, counters: Object.freeze(counters) });
}

export async function readActivePointerSnapshot({
  indexedDBFactory = globalThis.indexedDB,
  expectedGenerationId = EXPECTED_ACTIVE_GENERATION,
} = {}) {
  const counters = {
    openCalls: 0,
    readonlyTransactions: 0,
    metadataReads: 0,
    writeCount: 0,
    upgradeAttempts: 0,
  };
  const database = await openExistingActivePointerDatabase({ indexedDBFactory, counters });
  try {
    const transaction = database.transaction(META_STORE, 'readonly');
    if (transaction.mode !== 'readonly') {
      try { transaction.abort(); } catch {}
      fail('Non-readonly transaction rejected');
    }
    counters.readonlyTransactions += 1;
    const done = transactionComplete(transaction);
    const store = transaction.objectStore(META_STORE);
    counters.metadataReads += 2;
    const [activeGeneration, activeWorkspaceGeneration] = await Promise.all([
      requestResult(store.get(POINTER_KEYS[0])),
      requestResult(store.get(POINTER_KEYS[1])),
    ]);
    await done;
    return Object.freeze({
      databaseName: database.name,
      databaseVersion: database.version,
      activeGeneration: projectSafePointer(activeGeneration),
      activeWorkspaceGeneration: projectSafePointer(activeWorkspaceGeneration),
      expectedGenerationId,
      counters: Object.freeze({ ...counters }),
    });
  } finally {
    database.close();
  }
}

export async function collectStableActivePointerAudit(options = {}) {
  const first = await readActivePointerSnapshot(options);
  const second = await readActivePointerSnapshot(options);
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    fail('Independent pointer reads were not identical');
  }
  const counters = Object.freeze({
    openCalls: first.counters.openCalls + second.counters.openCalls,
    readonlyTransactions:
      first.counters.readonlyTransactions + second.counters.readonlyTransactions,
    metadataReads: first.counters.metadataReads + second.counters.metadataReads,
    writeCount: first.counters.writeCount + second.counters.writeCount,
    upgradeAttempts: first.counters.upgradeAttempts + second.counters.upgradeAttempts,
  });
  const evidence = Object.freeze({
    databaseName: first.databaseName,
    databaseVersion: first.databaseVersion,
    activeGeneration: first.activeGeneration,
    activeWorkspaceGeneration: first.activeWorkspaceGeneration,
    stableReads: 2,
    counters,
  });
  let validated;
  try {
    validated = validateActivePointerRecords({
      activeGeneration: first.activeGeneration,
      activeWorkspaceGeneration: first.activeWorkspaceGeneration,
      expectedGenerationId: first.expectedGenerationId,
    });
  } catch (error) {
    Object.defineProperty(error, 'auditEvidence', { value: evidence });
    throw error;
  }
  return Object.freeze({
    databaseName: first.databaseName,
    databaseVersion: first.databaseVersion,
    ...validated,
    stableReads: 2,
    counters,
  });
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

function renderResult(result) {
  setText('audit-database', `${result.databaseName} · v${result.databaseVersion}`);
  setText('audit-active-generation', result.activeGenerationId);
  setText('audit-workspace-generation', result.activeWorkspaceGenerationId);
  setText('audit-equality', result.pointersEqual ? 'זהים' : 'אינם זהים');
  setText('audit-generation-state', result.generationState);
  setText('audit-stable-reads', result.stableReads);
  setText('audit-readonly-transactions', result.counters.readonlyTransactions);
  setText('audit-metadata-reads', result.counters.metadataReads);
  setText('audit-write-count', result.counters.writeCount);
}

function renderFailureEvidence(evidence) {
  if (!evidence) return;
  const activeGenerationId = evidence.activeGeneration?.generationId || '—';
  const activeWorkspaceGenerationId = evidence.activeWorkspaceGeneration?.generationId || '—';
  const states = [
    evidence.activeGeneration?.state,
    evidence.activeWorkspaceGeneration?.state,
  ].filter(Boolean);
  setText('audit-database', `${evidence.databaseName} · v${evidence.databaseVersion}`);
  setText('audit-active-generation', activeGenerationId);
  setText('audit-workspace-generation', activeWorkspaceGenerationId);
  setText(
    'audit-equality',
    activeGenerationId !== '—' && activeGenerationId === activeWorkspaceGenerationId
      ? 'זהים'
      : 'אינם זהים',
  );
  setText(
    'audit-generation-state',
    states.length === 2 && states[0] === states[1] ? states[0] : 'mismatch',
  );
  setText('audit-stable-reads', evidence.stableReads);
  setText('audit-readonly-transactions', evidence.counters.readonlyTransactions);
  setText('audit-metadata-reads', evidence.counters.metadataReads);
  setText('audit-write-count', evidence.counters.writeCount);
}

function renderLineageResult(result) {
  setText('audit-database', `${result.databaseName} · v${result.databaseVersion}`);
  setText('audit-active-generation', result.migrationAnchorGenerationId);
  setText('audit-workspace-generation', result.activeWorkspaceGenerationId);
  setText('audit-equality', 'שושלת מאומתת');
  setText('audit-generation-state', `${result.migrationState} / ${result.workspaceState}`);
  setText('audit-stable-reads', result.stableReads);
  setText('audit-open-count', result.counters.openCalls);
  setText('audit-readonly-transactions', result.counters.readonlyTransactions);
  setText('audit-readwrite-transactions', result.counters.readwriteTransactions);
  setText('audit-metadata-reads', result.counters.metadataReads);
  setText('audit-journal-aggregate-reads', result.counters.journalAggregateReads);
  setText('audit-journal-count-operations', result.counters.journalCountOperations);
  setText('audit-source-entry-reads', result.counters.sourceEntryReads);
  setText('audit-projection-aggregate-reads', result.counters.projectionAggregateReads);
  setText('audit-write-count', result.counters.writeCount);
  setText('audit-lineage-model', result.lineageModel);
  setText('audit-journal-count', result.journalEntryCount);
  setText('audit-operation-counts', JSON.stringify(result.operationCounts));
  setText('audit-change-counts', JSON.stringify(result.changeCounts));
  setText('audit-tombstone-count', result.tombstoneCount);
  setText('audit-journal-range', `${result.firstCreatedAt || '—'} → ${result.lastCreatedAt || '—'}`);
  setText('audit-journal-hash', result.journalSha256);
  setText('audit-projection-hash', result.workspaceProjectionSha256);
  setText('audit-record-counts', `${result.saveCount} saves · ${result.uniqueItemCount} unique · ${result.duplicateLogicalSaveCount} duplicates · ${result.activeCount} active · ${result.archivedCount} archived`);
  setText('audit-checksums', `${result.idChecksum} · ${result.payloadChecksum} · ${result.migrationChecksum}`);
  setText('audit-raw-checksums', `${result.rawIdChecksum} · ${result.rawPayloadChecksum} · ${result.rawMigrationChecksum}`);
  setText('audit-anchor-comparison', `${result.duplicateAudit.anchorRecordCount} anchor · ${result.duplicateAudit.activeRecordCount} active · +${result.duplicateAudit.netAddedRecordCount} / -${result.duplicateAudit.netRemovedRecordCount} · ${result.duplicateAudit.duplicateGroupCount} groups`);
  setText('audit-baseline-checks', JSON.stringify(result.duplicateAudit.baselineChecks, null, 2));
  setText('audit-historical-checks', JSON.stringify(result.duplicateAudit.historicalExpectationChecks, null, 2));
  setText('audit-canonical-rule', result.duplicateAudit.canonicalSelectionRule);
  setText('audit-ui-canonical-checksums', `${result.duplicateAudit.uiCanonicalChecksums.idChecksum} · ${result.duplicateAudit.uiCanonicalChecksums.payloadChecksum} · ${result.duplicateAudit.uiCanonicalChecksums.migrationChecksum} · approved ${result.duplicateAudit.uiCanonicalReproducesApprovedChecksums}`);
  setText('audit-duplicate-classifications', JSON.stringify(result.duplicateAudit.duplicateClassifications, null, 2));
  setText('audit-duplicate-groups', JSON.stringify(result.duplicateAudit.duplicateGroups, null, 2));
  setText('audit-duplicate-report-hash', result.duplicateAudit.safeDuplicateReportSha256);
  setText('audit-integrity-status', `orphans ${result.orphanedJournalCount} · missing ${result.missingJournalCount} · cycles ${result.cycleCount} · competing ${result.competingPointerCount}`);
  setText('audit-report-hash', result.safeReportSha256);
}

function installAuditButton() {
  const button = document.getElementById('run-active-pointer-audit');
  const status = document.getElementById('audit-status');
  if (!button || !status) return;
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.dataset.state = 'idle';
    status.textContent = 'מבצע שתי קריאות עצמאיות בקריאה בלבד…';
    try {
      assertApprovedAuditLocation();
      const result = await collectStableWorkspaceLineageAudit();
      renderLineageResult(result);
      status.dataset.state = result.duplicateAudit.baselineMatches ? 'success' : 'error';
      status.textContent = result.duplicateAudit.baselineMatches
        ? 'הביקורת הושלמה: שושלת דור ה-Workspace והיומן תקינים, ומספר הכתיבות אפס.'
        : 'הביקורת הושלמה במצב fail-closed: נתוני הכפילויות אינם תואמים לכל שערי ה-baseline.';
    } catch (error) {
      renderFailureEvidence(error.auditEvidence);
      status.dataset.state = 'error';
      status.textContent = `הביקורת נעצרה בבטחה: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  }, { once: true });
}

if (typeof document !== 'undefined') installAuditButton();
