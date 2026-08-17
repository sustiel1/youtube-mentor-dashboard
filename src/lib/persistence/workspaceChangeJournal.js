import {
  canonicalSha256,
  sha256Text,
  verifyWorkspaceRaw,
} from './storageIntegrity.js';

const WORKSPACE_SOURCE_KEY = 'workspace_library_v1';
const JOURNAL_FORMAT = 'ytmdb-workspace-change-journal-v1';
const RECOVERY_FORMAT = 'ytmdb-workspace-recovery-bundle-v1';

export const WORKSPACE_JOURNAL_OPERATIONS = Object.freeze([
  'save-item',
  'save-items-bulk',
  'update-item',
  'delete-item',
  'delete-items-bulk',
  'delete-all-items',
  'update-items-bulk',
  'archive-items',
  'restore-items',
  'reassign-video-group-topic',
  'update-item-by-video-id',
]);

function assertSupportedOperation(operation) {
  if (!WORKSPACE_JOURNAL_OPERATIONS.includes(operation)) {
    throw new Error('Unsupported Workspace journal operation');
  }
}

async function describeItems(items, cryptoProvider) {
  const occurrences = new Map();
  const described = [];
  for (const item of items) {
    const recordId = String(item?.id || '');
    const occurrence = occurrences.get(recordId) || 0;
    occurrences.set(recordId, occurrence + 1);
    described.push({
      recordKey: `${recordId}\u0000${occurrence}`,
      recordId,
      archived: Boolean(item?.archivedAt),
      itemSha256: await canonicalSha256(item, cryptoProvider),
    });
  }
  return described;
}

function sortChanges(changes) {
  return [...changes].sort((left, right) => left.recordKey.localeCompare(right.recordKey));
}

async function buildChangeSet(previousItems, nextItems, cryptoProvider) {
  const previous = await describeItems(previousItems, cryptoProvider);
  const next = await describeItems(nextItems, cryptoProvider);
  const previousByKey = new Map(previous.map((record) => [record.recordKey, record]));
  const nextByKey = new Map(next.map((record) => [record.recordKey, record]));
  const created = [];
  const updated = [];
  const archived = [];
  const restored = [];
  const deleted = [];

  for (const record of next) {
    const prior = previousByKey.get(record.recordKey);
    if (!prior) {
      created.push(record);
    } else if (prior.itemSha256 !== record.itemSha256) {
      const change = {
        recordKey: record.recordKey,
        recordId: record.recordId,
        previousItemSha256: prior.itemSha256,
        nextItemSha256: record.itemSha256,
      };
      if (!prior.archived && record.archived) archived.push(change);
      else if (prior.archived && !record.archived) restored.push(change);
      else updated.push(change);
    }
  }

  for (const record of previous) {
    if (!nextByKey.has(record.recordKey)) {
      deleted.push({
        recordKey: record.recordKey,
        recordId: record.recordId,
        previousItemSha256: record.itemSha256,
      });
    }
  }

  return {
    created: sortChanges(created),
    updated: sortChanges(updated),
    archived: sortChanges(archived),
    restored: sortChanges(restored),
    deleted: sortChanges(deleted),
  };
}

function withoutJournalHash(entry) {
  const { journalSha256, ...unsigned } = entry;
  return unsigned;
}

export async function createWorkspaceChangeJournalEntry({
  operation,
  previousGenerationId,
  nextGenerationId,
  anchorGenerationId,
  anchorSourceHash,
  previousRaw,
  nextRaw,
  cryptoProvider = globalThis.crypto,
  createdAt = new Date().toISOString(),
} = {}) {
  assertSupportedOperation(operation);
  if (!previousGenerationId || !nextGenerationId || !anchorGenerationId || !anchorSourceHash) {
    throw new Error('Complete Workspace journal generation metadata is required');
  }
  const previous = verifyWorkspaceRaw(previousRaw);
  const next = verifyWorkspaceRaw(nextRaw);
  const previousSourceHash = await sha256Text(previousRaw, cryptoProvider);
  const nextSourceHash = await sha256Text(nextRaw, cryptoProvider);
  const changeSet = await buildChangeSet(previous.items, next.items, cryptoProvider);
  const operationId = await canonicalSha256({
    format: JOURNAL_FORMAT,
    operation,
    previousGenerationId,
    nextGenerationId,
    anchorGenerationId,
    anchorSourceHash,
    previousSourceHash,
    nextSourceHash,
    changeSet,
  }, cryptoProvider);
  const entry = {
    format: JOURNAL_FORMAT,
    operationId,
    operation,
    previousGenerationId,
    nextGenerationId,
    anchorGenerationId,
    anchorSourceHash,
    previousSourceHash,
    nextSourceHash,
    previousIntegrity: previous.integrity,
    nextIntegrity: next.integrity,
    changeSet,
    tombstones: changeSet.deleted,
    createdAt,
  };
  return {
    ...entry,
    journalSha256: await canonicalSha256(entry, cryptoProvider),
  };
}

export async function verifyWorkspaceChangeJournalEntry(
  entry,
  { previousRaw, nextRaw, cryptoProvider = globalThis.crypto } = {},
) {
  if (entry?.format !== JOURNAL_FORMAT) throw new Error('Unsupported Workspace journal format');
  assertSupportedOperation(entry.operation);
  const expected = await createWorkspaceChangeJournalEntry({
    operation: entry.operation,
    previousGenerationId: entry.previousGenerationId,
    nextGenerationId: entry.nextGenerationId,
    anchorGenerationId: entry.anchorGenerationId,
    anchorSourceHash: entry.anchorSourceHash,
    previousRaw,
    nextRaw,
    cryptoProvider,
    createdAt: entry.createdAt,
  });
  if (
    expected.operationId !== entry.operationId
    || expected.journalSha256 !== entry.journalSha256
    || await canonicalSha256(withoutJournalHash(entry), cryptoProvider)
      !== await canonicalSha256(withoutJournalHash(expected), cryptoProvider)
  ) {
    throw new Error('Workspace journal integrity verification failed');
  }
  return expected;
}

export async function replayWorkspaceChangeJournal({
  repository,
  fallbackRaw,
  cryptoProvider = globalThis.crypto,
} = {}) {
  if (!repository || typeof fallbackRaw !== 'string') {
    throw new Error('Repository and original localStorage payload are required');
  }
  const anchor = await repository.readMeta('workspaceRecoveryAnchor');
  if (anchor?.state !== 'anchored' || !anchor.generationId || !anchor.workspaceSourceHash) {
    throw new Error('Workspace recovery anchor is unavailable');
  }
  const fallback = verifyWorkspaceRaw(fallbackRaw);
  const fallbackHash = await sha256Text(fallbackRaw, cryptoProvider);
  if (
    fallbackHash !== anchor.workspaceSourceHash
    || await canonicalSha256(fallback.integrity, cryptoProvider)
      !== await canonicalSha256(anchor.integrity, cryptoProvider)
  ) {
    throw new Error('Original localStorage payload no longer matches the recovery anchor');
  }

  const entries = await repository.listWorkspaceChangeJournal(anchor.generationId);
  const consumed = new Set();
  let currentGenerationId = anchor.generationId;
  let currentRaw = fallbackRaw;
  let currentHash = fallbackHash;

  while (true) {
    const candidates = entries.filter((entry) => (
      !consumed.has(entry.operationId)
      && entry.previousGenerationId === currentGenerationId
      && entry.previousSourceHash === currentHash
    ));
    if (candidates.length === 0) break;
    if (candidates.length !== 1) throw new Error('Workspace journal contains a branched recovery chain');
    const entry = candidates[0];
    const source = await repository.readSourceEntry(entry.nextGenerationId, WORKSPACE_SOURCE_KEY);
    if (!source || typeof source.rawValue !== 'string') {
      throw new Error('Workspace journal references a missing generation');
    }
    await verifyWorkspaceChangeJournalEntry(entry, {
      previousRaw: currentRaw,
      nextRaw: source.rawValue,
      cryptoProvider,
    });
    consumed.add(entry.operationId);
    currentGenerationId = entry.nextGenerationId;
    currentRaw = source.rawValue;
    currentHash = entry.nextSourceHash;
  }

  if (consumed.size !== entries.length) {
    throw new Error('Workspace journal contains disconnected or corrupt entries');
  }
  const final = verifyWorkspaceRaw(currentRaw);
  return {
    rawValue: currentRaw,
    items: final.items,
    integrity: final.integrity,
    sourceHash: currentHash,
    generationId: currentGenerationId,
    operationCount: consumed.size,
    idempotent: true,
  };
}

export async function buildWorkspaceRecoveryBundle(options = {}) {
  const replay = await replayWorkspaceChangeJournal(options);
  const anchor = await options.repository.readMeta('workspaceRecoveryAnchor');
  const journal = await options.repository.listWorkspaceChangeJournal(anchor.generationId);
  const bundle = {
    format: RECOVERY_FORMAT,
    anchor,
    journal,
    finalSource: {
      generationId: replay.generationId,
      sourceHash: replay.sourceHash,
      rawValue: replay.rawValue,
      integrity: replay.integrity,
    },
  };
  return {
    bundle,
    bundleSha256: await canonicalSha256(bundle, options.cryptoProvider || globalThis.crypto),
  };
}
