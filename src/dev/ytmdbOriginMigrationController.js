const CONTROLLER_ORIGIN = 'http://localhost:5184';
const CONTROLLER_PATH = '/ytmdb-origin-migration.html';
const PREPARE_CONFIRMATION = 'PREPARE 142 READ ONLY';
const ACTIVATE_CONFIRMATION = 'ACTIVATE VERIFIED GENERATION';
const OPERATION_LOCK = 'ytmdb-origin-migration-controller-v1';
const EXPECTED_READY_GENERATION_ID = 'generation-1786981030945-zrx0g2ry';
const EXPECTED_READY_SOURCE_SHA256 = 'fb8af6ca40c17ce3ce4345f3c6f940f601e0cc729f634ee69b23b03356ce52d3';
const EXPECTED_READY_VERIFICATION_SHA256 = '3e24a91bd787fd22621867bb7aa33de1fdd3b646c1cff7f882beb857bae61d70';
const PREPARE_ACTION_ENABLED = false;
const VERIFY_ACTION_ENABLED = true;
const ACTIVATE_ACTION_ENABLED = false;

const VERIFIED_BASELINE = Object.freeze({
  recordCount: 142,
  activeCount: 127,
  archivedCount: 15,
  idChecksum: '9a3333fb',
  payloadChecksum: '23a8ea3b',
  migrationChecksum: 'a010a29b',
  approvedKeyCount: 196,
  logicalBytes: 5791814,
  snapshotSha256: '74c1a1500c3b37f35642993f0ab8dc8d1adff321d99c23879cbd6e2ae17dd6a1',
});

const VERIFIED_BACKUP = Object.freeze({
  byteLength: 11719820,
  encryptedFileSha256: '69e40a2dfc9e483afbb7e1c2b5c723cb50e7224a798fa3d1d313f5556293f5ed',
  verified: true,
});

const LEGACY_DATABASE = Object.freeze({
  name: 'yt_mentor_db_v1',
  version: 1,
  stores: Object.freeze(['attachments']),
  recordCount: 0,
});

const IGNORED_EXTERNAL_DATABASE = Object.freeze({
  name: 'storageDB',
  version: 10,
  stores: Object.freeze([Object.freeze({
    name: 'main',
    count: 0,
    keyPath: 'key',
    autoIncrement: false,
    indexes: Object.freeze([]),
  })]),
});

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

const GENERATION_STORE_KEYS = Object.freeze([
  'SOURCE_ENTRIES',
  'VIDEOS',
  'ANALYSES',
  'TRANSCRIPTS',
  'WORKSPACE_ITEMS',
  'SNAPSHOTS',
  'MEDIA_BLOBS',
]);

let busy = false;
let preflightProof = null;
let readyProof = null;
let loadedModulesPromise = null;
let lastSafeGate = 'idle';

function element(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const target = element(id);
  if (target) target.textContent = String(value);
}

function setStatus(state, message) {
  const target = element('controller-status');
  if (!target) return;
  target.dataset.state = state;
  target.textContent = message;
}

function formatNumber(value) {
  return new Intl.NumberFormat('he-IL').format(Number(value));
}

function constantTimeTextEqual(left, right) {
  const first = String(left || '');
  const second = String(right || '');
  const length = Math.max(first.length, second.length);
  let difference = first.length ^ second.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (first.charCodeAt(index) || 0) ^ (second.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function safeErrorMessage(error) {
  if (String(error?.code || '').startsWith('metadata-')) return error.message;
  if (String(error?.code || '').startsWith('delta-')) {
    return `Source delta audit stopped safely at ${error.code}. No payload values were displayed.`;
  }
  if (error?.name === 'QuotaExceededError') return 'המיגרציה נעצרה: מכסת האחסון אינה מספיקה.';
  if (error?.name === 'AbortError') return 'המיגרציה נעצרה: טרנזקציית IndexedDB בוטלה.';
  if (error?.name === 'InvalidStateError' || error?.name === 'NotFoundError') {
    return 'המיגרציה נעצרה: IndexedDB אינו זמין במצב הצפוי.';
  }
  if (error?.code === 'baseline-drift') {
    return `הפעולה נעצרה: baseline האחסון השתנה בשער ${lastSafeGate}.`;
  }
  if (error?.code === 'concurrent-generation') return 'הפעולה נעצרה: קיים דור אחר או תהליך מקביל.';
  if (error?.code === 'ready-parity-failed') return 'הפעולה נעצרה: דור READY נכשל באימות parity.';
  if (error?.code === 'backup-evidence-failed') return 'הפעולה נעצרה: ראיות הגיבוי אינן תואמות.';
  return 'הפעולה נעצרה בבטחה. לא מוצגים פרטי payload או ערכים רגישים.';
}

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function updateControls() {
  const prepareInput = element('prepare-confirmation');
  const activationInput = element('activation-confirmation');
  const generationInput = element('activation-generation-id');
  const prepareButton = element('prepare-migration');
  const verifyButton = element('verify-ready');
  const activateButton = element('activate-generation');
  const preflightButton = element('run-preflight');
  const abortButton = element('abort-controller');
  const inspectButton = element('inspect-unexpected-database');
  const deltaButton = element('inspect-source-delta');

  const canPrepare = Boolean(
    PREPARE_ACTION_ENABLED
    && preflightProof?.applicationDatabaseAbsent
    && preflightProof?.migrationState === 'absent'
    && constantTimeTextEqual(prepareInput?.value, PREPARE_CONFIRMATION),
  );
  const canVerify = Boolean(
    VERIFY_ACTION_ENABLED
    && preflightProof?.migrationState === 'ready'
    && preflightProof?.generationId === EXPECTED_READY_GENERATION_ID,
  );
  const canActivate = Boolean(
    ACTIVATE_ACTION_ENABLED
    && readyProof?.verified
    && constantTimeTextEqual(activationInput?.value, ACTIVATE_CONFIRMATION)
    && constantTimeTextEqual(generationInput?.value, readyProof?.generationId),
  );

  if (preflightButton) preflightButton.disabled = busy;
  if (abortButton) abortButton.disabled = busy;
  if (inspectButton) inspectButton.disabled = busy;
  if (deltaButton) deltaButton.disabled = busy;
  if (prepareButton) prepareButton.disabled = busy || !canPrepare;
  if (verifyButton) verifyButton.disabled = busy || !canVerify;
  if (activateButton) activateButton.disabled = busy || !canActivate;
}

async function withExclusiveOperation(label, operation) {
  if (busy) fail('concurrent-generation');
  if (!navigator.locks?.request) fail('concurrent-generation');
  busy = true;
  if (label === 'preflight' || label === 'prepare') readyProof = null;
  updateControls();
  try {
    return await navigator.locks.request(OPERATION_LOCK, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) fail('concurrent-generation');
      return operation();
    });
  } finally {
    busy = false;
    updateControls();
  }
}

async function loadModules() {
  if (!loadedModulesPromise) {
    loadedModulesPromise = Promise.all([
      import('./ytmdbOriginStorageManifest.js'),
      import('./ytmdbOriginExport.js'),
      import('../lib/persistence/storageManifest.js'),
      import('../lib/persistence/storageIntegrity.js'),
      import('../lib/persistence/storageMigration.js'),
      import('../lib/persistence/appDataDb.js'),
      import('../lib/persistence/storageMode.js'),
      import('../lib/persistence/workspaceProjection.js'),
    ]).then(([
      exportManifest,
      originExporter,
      storageManifest,
      integrity,
      migration,
      appDataDb,
      storageMode,
      workspaceProjection,
    ]) => ({
      exportManifest,
      originExporter,
      storageManifest,
      integrity,
      migration,
      appDataDb,
      storageMode,
      workspaceProjection,
    }));
  }
  return loadedModulesPromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  });
}

function metadataInspectionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeMetadataKeyPath(keyPath) {
  if (keyPath === null || typeof keyPath === 'string') return keyPath;
  if (Array.isArray(keyPath) && keyPath.every((part) => typeof part === 'string')) {
    return [...keyPath];
  }
  throw metadataInspectionError(
    'metadata-schema-unsupported',
    'IndexedDB metadata inspection stopped: unsupported keyPath metadata.',
  );
}

export async function discoverSingleUnexpectedDatabase(
  indexedDBFactory,
  allowedDatabaseNames,
) {
  if (typeof indexedDBFactory?.databases !== 'function') {
    throw metadataInspectionError(
      'metadata-discovery-unavailable',
      'IndexedDB metadata inspection is unavailable.',
    );
  }
  const allowed = new Set(allowedDatabaseNames);
  const discovered = await indexedDBFactory.databases();
  const unexpected = discovered.filter((entry) => !allowed.has(entry?.name));
  if (unexpected.length !== 1) {
    throw metadataInspectionError(
      'metadata-unexpected-count',
      'IndexedDB metadata inspection stopped: expected exactly one unexpected database.',
    );
  }
  const databaseName = unexpected[0]?.name;
  if (
    typeof databaseName !== 'string'
    || databaseName.length === 0
    || databaseName.length > 256
    || /[\u0000-\u001f\u007f]/.test(databaseName)
  ) {
    throw metadataInspectionError(
      'metadata-name-unsupported',
      'IndexedDB metadata inspection stopped: unsafe database-name metadata.',
    );
  }
  return databaseName;
}

export function openExistingDatabaseForMetadataInspection(indexedDBFactory, databaseName) {
  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(databaseName);
    let settled = false;
    let upgradeAttempted = false;

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const closeResult = () => {
      try {
        request.result?.close();
      } catch {
        // The request may not expose a database handle after an aborted upgrade.
      }
    };

    request.onupgradeneeded = () => {
      upgradeAttempted = true;
      try {
        request.transaction?.abort();
      } finally {
        closeResult();
        rejectOnce(metadataInspectionError(
          'metadata-upgrade-attempt',
          'IndexedDB metadata inspection hard-stopped: opening would create or upgrade a database.',
        ));
      }
    };
    request.onblocked = () => rejectOnce(metadataInspectionError(
      'metadata-open-blocked',
      'IndexedDB metadata inspection stopped: the read-only open was blocked.',
    ));
    request.onerror = () => rejectOnce(
      upgradeAttempted
        ? metadataInspectionError(
          'metadata-upgrade-attempt',
          'IndexedDB metadata inspection hard-stopped: opening would create or upgrade a database.',
        )
        : metadataInspectionError(
          'metadata-open-failed',
          'IndexedDB metadata inspection stopped: the read-only open failed.',
        ),
    );
    request.onsuccess = () => {
      if (upgradeAttempted || settled) {
        closeResult();
        return;
      }
      settled = true;
      resolve(request.result);
    };
  });
}

export async function inspectOpenDatabaseMetadata(database) {
  const storeNames = [...database.objectStoreNames].sort();
  if (storeNames.length === 0) {
    return {
      name: database.name,
      version: database.version,
      stores: [],
    };
  }

  const transaction = database.transaction(storeNames, 'readonly');
  if (transaction.mode !== 'readonly') {
    transaction.abort();
    throw metadataInspectionError(
      'metadata-transaction-mode',
      'IndexedDB metadata inspection stopped: a non-readonly transaction was returned.',
    );
  }
  const done = transactionDone(transaction);
  const stores = await Promise.all(storeNames.map(async (storeName) => {
    const store = transaction.objectStore(storeName);
    const indexNames = [...store.indexNames].sort();
    const indexes = indexNames.map((indexName) => {
      const index = store.index(indexName);
      return {
        name: index.name,
        keyPath: normalizeMetadataKeyPath(index.keyPath),
        unique: Boolean(index.unique),
        multiEntry: Boolean(index.multiEntry),
      };
    });
    return {
      name: store.name,
      count: await requestResult(store.count()),
      keyPath: normalizeMetadataKeyPath(store.keyPath),
      autoIncrement: Boolean(store.autoIncrement),
      indexes,
    };
  }));
  await done;
  return {
    name: database.name,
    version: database.version,
    stores,
  };
}

export function assertIgnoredExternalDatabaseMetadata(metadata) {
  if (JSON.stringify(metadata) !== JSON.stringify(IGNORED_EXTERNAL_DATABASE)) {
    throw metadataInspectionError(
      'metadata-schema-mismatch',
      'IndexedDB preflight stopped: ignored external database metadata changed.',
    );
  }
  return metadata;
}

export async function inspectSingleUnexpectedDatabaseMetadata({
  indexedDBFactory,
  allowedDatabaseNames,
}) {
  const databaseName = await discoverSingleUnexpectedDatabase(
    indexedDBFactory,
    allowedDatabaseNames,
  );
  const database = await openExistingDatabaseForMetadataInspection(
    indexedDBFactory,
    databaseName,
  );
  try {
    if (database.name !== databaseName) {
      throw metadataInspectionError(
        'metadata-name-mismatch',
        'IndexedDB metadata inspection stopped: database identity changed.',
      );
    }
    return await inspectOpenDatabaseMetadata(database);
  } finally {
    database.close();
  }
}

function openExistingDatabase(databaseName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    let creationAttempted = false;
    request.onupgradeneeded = () => {
      creationAttempted = true;
      request.transaction?.abort();
    };
    request.onblocked = () => reject(new Error('IndexedDB read-only open was blocked'));
    request.onerror = () => reject(request.error || new Error('IndexedDB read-only open failed'));
    request.onsuccess = () => {
      if (creationAttempted) {
        request.result.close();
        reject(new Error('IndexedDB changed during read-only discovery'));
        return;
      }
      resolve(request.result);
    };
  });
}

async function readDatabase(databaseName, includeMeta = false) {
  const database = await openExistingDatabase(databaseName);
  try {
    const storeNames = [...database.objectStoreNames].sort();
    const transaction = database.transaction(storeNames, 'readonly');
    const done = transactionDone(transaction);
    const counts = Object.fromEntries(await Promise.all(storeNames.map(async (storeName) => [
      storeName,
      await requestResult(transaction.objectStore(storeName).count()),
    ])));
    let meta = null;
    if (includeMeta && storeNames.includes('meta')) {
      const store = transaction.objectStore('meta');
      const [migration, activeGeneration, activeWorkspaceGeneration] = await Promise.all([
        requestResult(store.get('migration')),
        requestResult(store.get('activeGeneration')),
        requestResult(store.get('activeWorkspaceGeneration')),
      ]);
      meta = {
        migration: migration || null,
        activeGeneration: activeGeneration || null,
        activeWorkspaceGeneration: activeWorkspaceGeneration || null,
      };
    }
    await done;
    return {
      name: databaseName,
      version: database.version,
      storeNames,
      counts,
      recordCount: Object.values(counts).reduce((sum, count) => sum + count, 0),
      meta,
    };
  } finally {
    database.close();
  }
}

function sameStrings(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

async function readIndexedDbInventory(storageManifest) {
  if (typeof indexedDB?.databases !== 'function') fail('baseline-drift');
  const discovered = await indexedDB.databases();
  const allowedNames = new Set([LEGACY_DATABASE.name, storageManifest.APP_DATA_DB_NAME]);
  const unexpected = discovered.filter((entry) => !allowedNames.has(entry.name));
  lastSafeGate = `indexeddb-discovery-${discovered.length}-${unexpected.length}`;
  if (
    unexpected.length !== 1
    || unexpected[0]?.name !== IGNORED_EXTERNAL_DATABASE.name
  ) {
    fail('baseline-drift');
  }
  lastSafeGate = 'indexeddb-ignored-external-schema';
  const ignoredExternalDatabase = assertIgnoredExternalDatabaseMetadata(
    await inspectSingleUnexpectedDatabaseMetadata({
      indexedDBFactory: indexedDB,
      allowedDatabaseNames: [...allowedNames],
    }),
  );

  const legacyInfo = discovered.find((entry) => entry.name === LEGACY_DATABASE.name);
  lastSafeGate = 'indexeddb-legacy-presence';
  if (!legacyInfo) fail('baseline-drift');
  const legacy = await readDatabase(LEGACY_DATABASE.name);
  lastSafeGate = 'indexeddb-legacy-version';
  if (legacy.version !== LEGACY_DATABASE.version) fail('baseline-drift');
  lastSafeGate = 'indexeddb-legacy-schema';
  if (!sameStrings(legacy.storeNames, LEGACY_DATABASE.stores)) fail('baseline-drift');
  lastSafeGate = 'indexeddb-legacy-count';
  if (legacy.recordCount !== LEGACY_DATABASE.recordCount) fail('baseline-drift');

  const appInfo = discovered.find((entry) => entry.name === storageManifest.APP_DATA_DB_NAME);
  let application = null;
  if (appInfo) {
    application = await readDatabase(storageManifest.APP_DATA_DB_NAME, true);
    const expectedStores = Object.values(storageManifest.APP_DATA_STORES);
    lastSafeGate = 'indexeddb-application-version';
    if (application.version !== storageManifest.APP_DATA_DB_VERSION) fail('baseline-drift');
    lastSafeGate = 'indexeddb-application-schema';
    if (!sameStrings(application.storeNames, expectedStores)) fail('baseline-drift');
  }

  return {
    databaseCount: discovered.length,
    legacy,
    application,
    ignoredExternalDatabase,
  };
}

function checksumExportPayload(items, fnv1a) {
  return fnv1a(JSON.stringify(items.map((item) => {
    const copy = { ...item };
    EXPORT_PAYLOAD_OMITTED_FIELDS.forEach((field) => delete copy[field]);
    return copy;
  })));
}

function summarizeWorkspaceItems(items, integrity) {
  const verified = integrity.verifyWorkspaceRaw(JSON.stringify(items));
  return {
    items: verified.items,
    recordCount: verified.items.length,
    activeCount: verified.items.filter((item) => !item?.archivedAt).length,
    archivedCount: verified.items.filter((item) => Boolean(item?.archivedAt)).length,
    idChecksum: verified.integrity.idChecksum,
    payloadChecksum: checksumExportPayload(verified.items, integrity.fnv1a),
    migrationChecksum: verified.integrity.payloadChecksum,
  };
}

async function workspaceItemProofs(items, integrity) {
  const seenIds = new Set();
  const proofs = [];
  for (const item of items) {
    const id = String(item?.id || '');
    if (seenIds.has(id)) fail('delta-duplicate-workspace-id');
    seenIds.add(id);
    proofs.push({
      idHash: await integrity.sha256Text(id, crypto),
      contentHash: await integrity.canonicalSha256(item, crypto),
      archived: Boolean(item?.archivedAt),
    });
  }
  return proofs.sort((left, right) => left.idHash.localeCompare(right.idHash));
}

function safeWorkspaceSummary(summary) {
  return {
    recordCount: summary.recordCount,
    activeCount: summary.activeCount,
    archivedCount: summary.archivedCount,
    idChecksum: summary.idChecksum,
    payloadChecksum: summary.payloadChecksum,
    migrationChecksum: summary.migrationChecksum,
  };
}

function compareUtf16CodeUnits(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

async function compareWorkspaceSources(currentRawValue, readyRawValue, integrity) {
  const parse = (rawValue) => {
    let items;
    try {
      items = JSON.parse(rawValue);
    } catch {
      fail('delta-workspace-invalid');
    }
    if (!Array.isArray(items)) fail('delta-workspace-invalid');
    return summarizeWorkspaceItems(items, integrity);
  };
  const current = parse(currentRawValue);
  const ready = parse(readyRawValue);
  const currentProofs = await workspaceItemProofs(current.items, integrity);
  const readyProofs = await workspaceItemProofs(ready.items, integrity);
  const currentById = new Map(currentProofs.map((proof) => [proof.idHash, proof]));
  const readyById = new Map(readyProofs.map((proof) => [proof.idHash, proof]));
  const added = [];
  const removed = [];
  const changed = [];
  let archivedStateChangeCount = 0;

  for (const [idHash, currentProof] of currentById) {
    const readyProof = readyById.get(idHash);
    if (!readyProof) {
      added.push({
        idHash,
        contentHash: currentProof.contentHash,
        archived: currentProof.archived,
      });
      continue;
    }
    if (readyProof.contentHash !== currentProof.contentHash) {
      const archivedStateChanged = readyProof.archived !== currentProof.archived;
      if (archivedStateChanged) archivedStateChangeCount += 1;
      changed.push({
        idHash,
        oldContentHash: readyProof.contentHash,
        newContentHash: currentProof.contentHash,
        archivedStateChanged,
      });
    }
  }
  for (const [idHash, readyProof] of readyById) {
    if (!currentById.has(idHash)) {
      removed.push({
        idHash,
        contentHash: readyProof.contentHash,
        archived: readyProof.archived,
      });
    }
  }

  return {
    current: safeWorkspaceSummary(current),
    ready: safeWorkspaceSummary(ready),
    delta: {
      added,
      removed,
      changed,
      archivedStateChangeCount,
    },
  };
}

function assertApprovedSourceEntry(entry, storageManifest) {
  if (
    !entry
    || typeof entry.storageKey !== 'string'
    || typeof entry.rawValue !== 'string'
    || !storageManifest.isApplicationOwnedStorageKey(entry.storageKey)
    || storageManifest.isSensitiveStorageKey(entry.storageKey)
  ) {
    fail('delta-source-allowlist-violation');
  }
}

function classifyDeltaRootCause(report, storageManifest) {
  const workspaceDelta = report.workspace.delta;
  const workspaceChanged = workspaceDelta.added.length > 0
    || workspaceDelta.removed.length > 0
    || workspaceDelta.changed.length > 0
    || JSON.stringify(report.workspace.current) !== JSON.stringify(report.workspace.ready);
  if (workspaceChanged) return 'legitimate user-data changes after Prepare';

  const keyDelta = report.keyDelta;
  const changedKeys = [
    ...keyDelta.added.map((entry) => entry.storageKey),
    ...keyDelta.removed.map((entry) => entry.storageKey),
    ...keyDelta.changed.map((entry) => entry.storageKey),
  ];
  if (
    changedKeys.length > 0
    && changedKeys.every((key) => storageManifest.isVolatileCacheStorageKey(key))
  ) {
    return 'volatile non-business metadata';
  }
  if (changedKeys.length > 0) return 'legitimate user-data changes after Prepare';
  if (report.current.sourceSha256 !== report.ready.sourceSha256) {
    return 'deterministic serialization/ordering defect';
  }
  return 'identical';
}

export async function buildSafeSourceDeltaReport({
  currentSnapshot,
  readySnapshot,
  storageManifest,
  integrity,
}) {
  const currentEntries = [...currentSnapshot.entries].sort((left, right) => (
    compareUtf16CodeUnits(left.storageKey, right.storageKey)
  ));
  const readyEntries = [...readySnapshot.entries].sort((left, right) => (
    compareUtf16CodeUnits(left.storageKey, right.storageKey)
  ));
  currentEntries.forEach((entry) => assertApprovedSourceEntry(entry, storageManifest));
  readyEntries.forEach((entry) => assertApprovedSourceEntry(entry, storageManifest));

  const currentByKey = new Map(currentEntries.map((entry) => [entry.storageKey, entry]));
  const readyByKey = new Map(readyEntries.map((entry) => [entry.storageKey, entry]));
  if (currentByKey.size !== currentEntries.length || readyByKey.size !== readyEntries.length) {
    fail('delta-duplicate-source-key');
  }

  const added = [];
  const removed = [];
  const changed = [];
  for (const [storageKey, currentEntry] of currentByKey) {
    const readyEntry = readyByKey.get(storageKey);
    if (!readyEntry) {
      added.push({
        storageKey,
        category: currentEntry.domain,
        newValueBytes: currentEntry.valueCodeUnits * 2,
        newLogicalBytes: currentEntry.logicalBytes,
        newSha256: currentEntry.valueSha256,
      });
      continue;
    }
    if (
      currentEntry.valueSha256 !== readyEntry.valueSha256
      || currentEntry.valueCodeUnits !== readyEntry.valueCodeUnits
      || currentEntry.logicalBytes !== readyEntry.logicalBytes
      || currentEntry.domain !== readyEntry.domain
    ) {
      changed.push({
        storageKey,
        category: currentEntry.domain,
        oldValueBytes: readyEntry.valueCodeUnits * 2,
        newValueBytes: currentEntry.valueCodeUnits * 2,
        oldLogicalBytes: readyEntry.logicalBytes,
        newLogicalBytes: currentEntry.logicalBytes,
        byteDelta: currentEntry.logicalBytes - readyEntry.logicalBytes,
        oldSha256: readyEntry.valueSha256,
        newSha256: currentEntry.valueSha256,
      });
    }
  }
  for (const [storageKey, readyEntry] of readyByKey) {
    if (!currentByKey.has(storageKey)) {
      removed.push({
        storageKey,
        category: readyEntry.domain,
        oldValueBytes: readyEntry.valueCodeUnits * 2,
        oldLogicalBytes: readyEntry.logicalBytes,
        oldSha256: readyEntry.valueSha256,
      });
    }
  }

  const currentWorkspace = currentByKey.get('workspace_library_v1');
  const readyWorkspace = readyByKey.get('workspace_library_v1');
  if (!currentWorkspace || !readyWorkspace) fail('delta-workspace-missing');
  const workspace = await compareWorkspaceSources(
    currentWorkspace.rawValue,
    readyWorkspace.rawValue,
    integrity,
  );
  const readyLogicalBytes = readyEntries.reduce((sum, entry) => sum + entry.logicalBytes, 0);
  const fullSourceMatches = currentSnapshot.sourceHash === readySnapshot.sourceHash;
  const activationCriticalMatches = currentSnapshot.activationCriticalSourceHash
    === readySnapshot.activationCriticalSourceHash;
  const report = {
    current: {
      keyCount: currentEntries.length,
      logicalBytes: currentSnapshot.logicalBytes,
      sourceSha256: currentSnapshot.sourceHash,
      activationCriticalSourceSha256: currentSnapshot.activationCriticalSourceHash,
      activationCriticalIntegrity: currentSnapshot.activationCriticalIntegrity,
    },
    ready: {
      generationId: readySnapshot.generationId,
      state: readySnapshot.state,
      keyCount: readyEntries.length,
      logicalBytes: readyLogicalBytes,
      sourceSha256: readySnapshot.sourceHash,
      recomputedSourceSha256: readySnapshot.recomputedSourceHash,
      activationCriticalSourceSha256: readySnapshot.activationCriticalSourceHash,
      activationCriticalIntegrity: readySnapshot.activationCriticalIntegrity,
      legacyActivationCriticalMetadata: readySnapshot.legacyActivationCriticalMetadata,
    },
    pointers: readySnapshot.pointers,
    workspace,
    keyDelta: {
      added,
      removed,
      changed,
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      currentMinusReadyLogicalBytes: currentSnapshot.logicalBytes - readyLogicalBytes,
    },
    transactionModes: [...readySnapshot.transactionModes],
    allTransactionsReadonly: readySnapshot.transactionModes.every((mode) => mode === 'readonly'),
    writeOperationCount: 0,
    sourceIntegrity: {
      fullSourceMatches,
      activationCriticalMatches,
      warning: !fullSourceMatches && activationCriticalMatches
        ? 'volatile-cache-content-mismatch'
        : null,
    },
  };
  return {
    ...report,
    rootCause: classifyDeltaRootCause(report, storageManifest),
  };
}

export async function collectReadySourceSnapshotReadOnly({
  database,
  generationId,
  storageManifest,
  integrity,
}) {
  const transactionModes = [];
  const metaTransaction = database.transaction(storageManifest.APP_DATA_STORES.META, 'readonly');
  transactionModes.push(metaTransaction.mode);
  const metaStore = metaTransaction.objectStore(storageManifest.APP_DATA_STORES.META);
  const [migrationMeta, activeGeneration, activeWorkspaceGeneration] = await Promise.all([
    requestResult(metaStore.get('migration')),
    requestResult(metaStore.get('activeGeneration')),
    requestResult(metaStore.get('activeWorkspaceGeneration')),
  ]);
  await transactionDone(metaTransaction);
  if (
    migrationMeta?.generationId !== generationId
    || migrationMeta?.state !== 'ready'
    || migrationMeta?.sourceHash !== EXPECTED_READY_SOURCE_SHA256
    || activeGeneration
    || activeWorkspaceGeneration
  ) {
    fail('delta-ready-state-mismatch');
  }

  const keysTransaction = database.transaction(storageManifest.APP_DATA_STORES.SOURCE_ENTRIES, 'readonly');
  transactionModes.push(keysTransaction.mode);
  const keysStore = keysTransaction.objectStore(storageManifest.APP_DATA_STORES.SOURCE_ENTRIES);
  const primaryKeys = await requestResult(keysStore.index('generationId').getAllKeys(generationId));
  await transactionDone(keysTransaction);
  const approvedStorageKeys = primaryKeys.map((key) => {
    if (
      !Array.isArray(key)
      || key.length !== 2
      || key[0] !== generationId
      || typeof key[1] !== 'string'
      || !storageManifest.isApplicationOwnedStorageKey(key[1])
      || storageManifest.isSensitiveStorageKey(key[1])
    ) {
      fail('delta-source-allowlist-violation');
    }
    return key[1];
  }).sort(compareUtf16CodeUnits);
  if (new Set(approvedStorageKeys).size !== approvedStorageKeys.length) {
    fail('delta-duplicate-source-key');
  }

  const recordsTransaction = database.transaction(storageManifest.APP_DATA_STORES.SOURCE_ENTRIES, 'readonly');
  transactionModes.push(recordsTransaction.mode);
  const recordsStore = recordsTransaction.objectStore(storageManifest.APP_DATA_STORES.SOURCE_ENTRIES);
  const records = await Promise.all(approvedStorageKeys.map((storageKey) => (
    requestResult(recordsStore.get([generationId, storageKey]))
  )));
  await transactionDone(recordsTransaction);

  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const storageKey = approvedStorageKeys[index];
    assertApprovedSourceEntry(record, storageManifest);
    if (record.generationId !== generationId || record.storageKey !== storageKey) {
      fail('delta-source-record-mismatch');
    }
    const valueSha256 = await integrity.sha256Text(record.rawValue, crypto);
    const valueCodeUnits = record.rawValue.length;
    const logicalBytes = integrity.logicalUtf16Bytes(storageKey, record.rawValue);
    if (
      valueSha256 !== record.valueSha256
      || valueCodeUnits !== record.valueCodeUnits
      || logicalBytes !== record.logicalBytes
    ) {
      fail('delta-ready-corruption');
    }
    entries.push({
      storageKey,
      domain: record.domain,
      rawValue: record.rawValue,
      valueCodeUnits,
      logicalBytes,
      valueSha256,
    });
  }
  entries.sort((left, right) => compareUtf16CodeUnits(left.storageKey, right.storageKey));
  const sourceIntegrity = await integrity.calculateSourceIntegrity(entries, {
    cryptoProvider: crypto,
    isVolatileCacheStorageKey: storageManifest.isVolatileCacheStorageKey,
  });
  const recomputedSourceHash = sourceIntegrity.fullSourceHash;
  if (recomputedSourceHash !== migrationMeta.sourceHash) fail('delta-ready-corruption');
  if (
    migrationMeta.activationCriticalSourceHash
    && migrationMeta.activationCriticalSourceHash
      !== sourceIntegrity.activationCriticalSourceHash
  ) {
    fail('delta-ready-corruption');
  }
  if (
    migrationMeta.activationCriticalIntegrity
    && JSON.stringify(migrationMeta.activationCriticalIntegrity)
      !== JSON.stringify(sourceIntegrity.activationCritical)
  ) {
    fail('delta-ready-corruption');
  }
  return {
    generationId,
    state: migrationMeta.state,
    sourceHash: migrationMeta.sourceHash,
    recomputedSourceHash,
    activationCriticalSourceHash: sourceIntegrity.activationCriticalSourceHash,
    activationCriticalIntegrity: sourceIntegrity.activationCritical,
    legacyActivationCriticalMetadata: !migrationMeta.activationCriticalSourceHash,
    entries,
    transactionModes,
    pointers: {
      activeGenerationAbsent: !activeGeneration,
      activeWorkspaceGenerationAbsent: !activeWorkspaceGeneration,
    },
  };
}

function verifyWorkspaceSnapshot(snapshot, integrity) {
  if (
    snapshot.entries.length !== VERIFIED_BASELINE.approvedKeyCount
    || snapshot.entries.some((entry) => integrity.isSensitiveStorageKey?.(entry.storageKey))
  ) {
    fail('baseline-drift');
  }
  const workspaceEntry = snapshot.entries.find((entry) => entry.storageKey === 'workspace_library_v1');
  if (!workspaceEntry) fail('baseline-drift');
  const verified = integrity.verifyWorkspaceRaw(workspaceEntry.rawValue, {
    recordCount: VERIFIED_BASELINE.recordCount,
    idChecksum: VERIFIED_BASELINE.idChecksum,
    payloadChecksum: VERIFIED_BASELINE.migrationChecksum,
  });
  const activeCount = verified.items.filter((item) => !item?.archivedAt).length;
  const archivedCount = verified.items.filter((item) => Boolean(item?.archivedAt)).length;
  const payloadChecksum = checksumExportPayload(verified.items, integrity.fnv1a);
  if (
    activeCount !== VERIFIED_BASELINE.activeCount
    || archivedCount !== VERIFIED_BASELINE.archivedCount
    || payloadChecksum !== VERIFIED_BASELINE.payloadChecksum
    || verified.integrity.payloadChecksum !== VERIFIED_BASELINE.migrationChecksum
  ) {
    fail('baseline-drift');
  }
  return {
    items: verified.items,
    workspaceSourceHash: workspaceEntry.valueSha256,
    migrationIntegrity: verified.integrity,
    displayIntegrity: {
      recordCount: verified.items.length,
      activeCount,
      archivedCount,
      idChecksum: verified.integrity.idChecksum,
      payloadChecksum,
      migrationChecksum: verified.integrity.payloadChecksum,
    },
  };
}

function assertVerifiedManifest(exportManifest) {
  const git = exportManifest.APPROVED_GIT_CONTEXT;
  const workspace = exportManifest.EXPECTED_WORKSPACE_INTEGRITY;
  if (
    exportManifest.APPROVED_ORIGIN !== CONTROLLER_ORIGIN
    || git?.branch !== 'docs/markdown-governance-cleanup'
    || git?.head !== '14684c4f1d899e55012badd290949c9e5585ca71'
    || workspace?.recordCount !== VERIFIED_BASELINE.recordCount
    || workspace?.idChecksum !== VERIFIED_BASELINE.idChecksum
    || workspace?.payloadChecksum !== VERIFIED_BASELINE.payloadChecksum
  ) {
    fail('baseline-drift');
  }
  return git;
}

function assertBackupEvidence() {
  if (
    VERIFIED_BACKUP.verified !== true
    || VERIFIED_BACKUP.byteLength !== 11719820
    || !/^[a-f0-9]{64}$/.test(VERIFIED_BACKUP.encryptedFileSha256)
  ) {
    fail('backup-evidence-failed');
  }
}

function renderPreflight(proof) {
  const inventory = proof.inventory;
  const application = inventory.application;
  const migration = application?.meta?.migration;
  setText('meta-origin', proof.origin);
  setText('meta-git', `${proof.git.branch} · ${proof.git.head}`);
  setText('meta-mode', proof.storageMode);
  setText(
    'meta-workspace',
    `${proof.workspace.recordCount} total · ${proof.workspace.activeCount} active · ${proof.workspace.archivedCount} archived · ${proof.workspace.idChecksum} · ${proof.workspace.payloadChecksum} · migration ${proof.workspace.migrationChecksum}`,
  );
  setText(
    'meta-source',
    `${proof.sourceEntryCount} approved keys · ${formatNumber(proof.sourceLogicalBytes)} bytes · two stable reads`,
  );
  setText(
    'meta-indexeddb',
    application
      ? `${inventory.databaseCount} DB · app schema v${application.version} · ${application.storeNames.length} stores`
      : `${inventory.databaseCount} DB · legacy store only · application DB absent`,
  );
  setText(
    'meta-backup',
    `${formatNumber(VERIFIED_BACKUP.byteLength)} encrypted bytes · SHA-256 ${VERIFIED_BACKUP.encryptedFileSha256}`,
  );
  setText(
    'meta-migration',
    migration ? `${migration.state} · ${migration.generationId}` : 'absent · no active generation',
  );
  setText('meta-source-hash', proof.sourceHash);
  setText(
    'meta-indexeddb',
    application
      ? `${inventory.databaseCount} DB; application schema v${application.version}; ${Object.entries(application.counts).sort(([left], [right]) => left.localeCompare(right)).map(([storeName, count]) => `${storeName}=${count}`).join(', ')}`
      : `${inventory.databaseCount} DB; legacy application store + ignored empty external ${inventory.ignoredExternalDatabase.name}; application data DB absent`,
  );
}

async function collectPreflight({ requireApplicationDatabaseAbsent = false } = {}) {
  lastSafeGate = 'location';
  if (
    location.origin !== CONTROLLER_ORIGIN
    || location.pathname !== CONTROLLER_PATH
    || location.search
    || location.hash
  ) {
    fail('baseline-drift');
  }
  lastSafeGate = 'modules';
  const modules = await loadModules();
  lastSafeGate = 'manifest';
  const git = assertVerifiedManifest(modules.exportManifest);
  lastSafeGate = 'backup';
  assertBackupEvidence();
  lastSafeGate = 'mode';
  const storageMode = modules.storageMode.getApplicationStorageMode({ env: import.meta.env || {} });
  if (storageMode !== 'localStorage') fail('baseline-drift');

  lastSafeGate = 'indexeddb';
  const inventory = await readIndexedDbInventory(modules.storageManifest);
  if (requireApplicationDatabaseAbsent && inventory.application) fail('concurrent-generation');
  const migrationMeta = inventory.application?.meta?.migration || null;
  const activeMeta = inventory.application?.meta?.activeGeneration || null;
  if (activeMeta?.state === 'active' && migrationMeta?.state !== 'active') fail('baseline-drift');

  lastSafeGate = 'source';
  const snapshot = await modules.migration.captureStableLocalStorage(localStorage, crypto);
  lastSafeGate = 'workspace';
  const workspace = verifyWorkspaceSnapshot(snapshot, {
    ...modules.integrity,
    isSensitiveStorageKey: modules.storageManifest.isSensitiveStorageKey,
  });

  let snapshotSha256 = null;
  if (!inventory.application) {
    lastSafeGate = 'exporter';
    const exporterMetadata = await modules.originExporter.collectStableOriginSnapshot();
    if (
      exporterMetadata.snapshotSha256 !== VERIFIED_BASELINE.snapshotSha256
      || exporterMetadata.stableReadCount !== 2
      || exporterMetadata.localStorage.keyCount !== VERIFIED_BASELINE.approvedKeyCount
      || exporterMetadata.localStorage.logicalByteCount !== VERIFIED_BASELINE.logicalBytes
      || exporterMetadata.workspaceIntegrity.recordCount !== VERIFIED_BASELINE.recordCount
      || exporterMetadata.workspaceIntegrity.activeCount !== VERIFIED_BASELINE.activeCount
      || exporterMetadata.workspaceIntegrity.archivedCount !== VERIFIED_BASELINE.archivedCount
      || exporterMetadata.workspaceIntegrity.idChecksum !== VERIFIED_BASELINE.idChecksum
      || exporterMetadata.workspaceIntegrity.payloadChecksum !== VERIFIED_BASELINE.payloadChecksum
      || exporterMetadata.workspaceIntegrity.migrationPayloadChecksum !== VERIFIED_BASELINE.migrationChecksum
    ) {
      fail('baseline-drift');
    }
    snapshotSha256 = exporterMetadata.snapshotSha256;
  } else if (
    !migrationMeta
    || !['copying', 'verifying', 'ready', 'active', 'failed'].includes(migrationMeta.state)
  ) {
    fail('baseline-drift');
  }

  lastSafeGate = 'complete';
  const proof = {
    verified: true,
    origin: location.origin,
    git,
    storageMode,
    inventory,
    applicationDatabaseAbsent: !inventory.application,
    activeGenerationAbsent: !activeMeta
      && !inventory.application?.meta?.activeWorkspaceGeneration
      && migrationMeta?.state !== 'active',
    migrationState: migrationMeta?.state || 'absent',
    generationId: migrationMeta?.generationId || null,
    sourceHash: snapshot.sourceHash,
    activationCriticalSourceHash: snapshot.activationCriticalSourceHash,
    activationCriticalIntegrity: snapshot.activationCriticalIntegrity,
    sourceLogicalBytes: snapshot.logicalBytes,
    sourceEntryCount: snapshot.entries.length,
    snapshotSha256,
    workspaceSourceHash: workspace.workspaceSourceHash,
    workspaceIntegrity: workspace.migrationIntegrity,
    workspace: workspace.displayIntegrity,
    snapshot,
    workspaceItems: workspace.items,
    stableReadCount: 2,
  };
  renderPreflight(proof);
  return proof;
}

function preflightComparisonView(proof) {
  const application = proof.inventory.application;
  const migration = application?.meta?.migration;
  return {
    origin: proof.origin,
    git: proof.git,
    storageMode: proof.storageMode,
    workspace: proof.workspace,
    sourceHash: proof.sourceHash,
    activationCriticalSourceHash: proof.activationCriticalSourceHash,
    activationCriticalIntegrity: proof.activationCriticalIntegrity,
    sourceLogicalBytes: proof.sourceLogicalBytes,
    sourceEntryCount: proof.sourceEntryCount,
    snapshotSha256: proof.snapshotSha256,
    workspaceSourceHash: proof.workspaceSourceHash,
    workspaceIntegrity: proof.workspaceIntegrity,
    stableReadCount: proof.stableReadCount,
    applicationDatabaseAbsent: proof.applicationDatabaseAbsent,
    activeGenerationAbsent: proof.activeGenerationAbsent,
    migrationState: proof.migrationState,
    databaseCount: proof.inventory.databaseCount,
    legacyDatabase: proof.inventory.legacy,
    ignoredExternalDatabase: proof.inventory.ignoredExternalDatabase,
    applicationDatabase: application ? {
      name: application.name,
      version: application.version,
      storeNames: application.storeNames,
      counts: application.counts,
      recordCount: application.recordCount,
      migration: migration ? {
        generationId: migration.generationId,
        state: migration.state,
        sourceHash: migration.sourceHash,
        activationCriticalSourceHash: migration.activationCriticalSourceHash || null,
        activationCriticalIntegrity: migration.activationCriticalIntegrity || null,
        workspaceSourceHash: migration.workspaceSourceHash,
        sourceLogicalBytes: migration.sourceLogicalBytes,
        counts: migration.counts,
        integrity: migration.integrity,
      } : null,
      activeGenerationPresent: Boolean(application.meta?.activeGeneration),
      activeWorkspaceGenerationPresent: Boolean(application.meta?.activeWorkspaceGeneration),
    } : null,
  };
}

export async function collectIdenticalReadOnlyPreflights(collector) {
  const first = await collector();
  const second = await collector();
  if (JSON.stringify(preflightComparisonView(first)) !== JSON.stringify(preflightComparisonView(second))) {
    throw metadataInspectionError(
      'metadata-preflight-mismatch',
      'IndexedDB preflight stopped: the two complete read-only results differed.',
    );
  }
  return second;
}

function sortByRecordKey(records) {
  return [...records].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function activationCriticalStoreRecords(storeName, records, modules) {
  if (storeName !== modules.storageManifest.APP_DATA_STORES.MEDIA_BLOBS) {
    return sortByRecordKey(records);
  }
  return sortByRecordKey(records.map((record) => (
    modules.storageManifest.isVolatileCacheStorageKey(record?.id)
      ? {
        generationId: record.generationId,
        id: record.id,
        videoId: record.videoId,
        kind: record.kind,
        integrityPolicy: 'volatile-cache-identity-only',
      }
      : record
  )));
}

async function verifyReadyInternal() {
  const modules = await loadModules();
  const current = await collectPreflight();
  const application = current.inventory.application;
  const migrationMeta = application?.meta?.migration;
  if (
    !application
    || migrationMeta?.state !== modules.migration.MIGRATION_STATES.READY
    || migrationMeta.generationId !== EXPECTED_READY_GENERATION_ID
    || !current.activeGenerationAbsent
    || application.meta?.activeWorkspaceGeneration
    || migrationMeta.workspaceSourceHash !== current.workspaceSourceHash
    || !/^[a-f0-9]{64}$/.test(String(current.activationCriticalSourceHash || ''))
    || migrationMeta.counts?.sourceEntries !== VERIFIED_BASELINE.approvedKeyCount
    || migrationMeta.counts?.workspaceItems !== VERIFIED_BASELINE.recordCount
    || JSON.stringify(migrationMeta.integrity) !== JSON.stringify(current.workspaceIntegrity)
  ) {
    fail('ready-parity-failed');
  }

  const database = await openExistingDatabase(modules.storageManifest.APP_DATA_DB_NAME);
  const repository = modules.appDataDb.createAppDataRepository(database);
  try {
    const generationId = migrationMeta.generationId;
    const actualByStore = {};
    const generationStoreHashes = {};
    for (const storeKey of GENERATION_STORE_KEYS) {
      const storeName = modules.storageManifest.APP_DATA_STORES[storeKey];
      const records = await repository.listByGeneration(storeName, generationId);
      actualByStore[storeName] = records;
      if (records.length !== migrationMeta.counts?.[storeName]) fail('ready-parity-failed');
      if (application.counts?.[storeName] !== records.length) fail('ready-parity-failed');
      generationStoreHashes[storeName] = await modules.integrity.canonicalSha256(sortByRecordKey(records));
    }

    const expectedSources = current.snapshot.entries.map((entry) => ({ generationId, ...entry }));
    const actualSourceHash = await modules.integrity.canonicalSha256(
      sortByRecordKey(actualByStore[modules.storageManifest.APP_DATA_STORES.SOURCE_ENTRIES]),
    );
    const expectedSourceHash = await modules.integrity.canonicalSha256(sortByRecordKey(expectedSources));
    const readySourceIntegrity = await modules.integrity.calculateSourceIntegrity(
      actualByStore[modules.storageManifest.APP_DATA_STORES.SOURCE_ENTRIES].map((record) => {
        const { generationId: recordGenerationId, ...entry } = record;
        if (recordGenerationId !== generationId) fail('ready-parity-failed');
        return entry;
      }),
      {
        cryptoProvider: crypto,
        isVolatileCacheStorageKey: modules.storageManifest.isVolatileCacheStorageKey,
      },
    );
    if (
      readySourceIntegrity.fullSourceHash !== migrationMeta.sourceHash
      || readySourceIntegrity.activationCriticalSourceHash
        !== current.activationCriticalSourceHash
      || (
        migrationMeta.activationCriticalSourceHash
        && migrationMeta.activationCriticalSourceHash
          !== readySourceIntegrity.activationCriticalSourceHash
      )
      || (
        migrationMeta.activationCriticalIntegrity
        && JSON.stringify(migrationMeta.activationCriticalIntegrity)
          !== JSON.stringify(readySourceIntegrity.activationCritical)
      )
    ) {
      fail('ready-parity-failed');
    }

    const expectedProjection = modules.migration.buildMigrationProjectionRecords(
      current.snapshot,
      generationId,
      current.workspaceIntegrity,
    );
    const projectionHashes = {};
    for (const storeName of Object.keys(expectedProjection.records)) {
      if (storeName === modules.storageManifest.APP_DATA_STORES.SOURCE_ENTRIES) continue;
      const actualHash = await modules.integrity.canonicalSha256(
        activationCriticalStoreRecords(storeName, actualByStore[storeName], modules),
      );
      const expectedHash = await modules.integrity.canonicalSha256(
        activationCriticalStoreRecords(storeName, expectedProjection.records[storeName], modules),
      );
      if (actualHash !== expectedHash) fail('ready-parity-failed');
      projectionHashes[storeName] = actualHash;
    }

    const journal = await repository.listJournal(generationId);
    const journalKeys = new Set();
    const journalCounts = {};
    for (const entry of journal) {
      const key = `${entry.storeName}:${entry.batchNumber}`;
      if (
        journalKeys.has(key)
        || !Number.isInteger(entry.recordCount)
        || entry.recordCount < 1
        || !/^[a-f0-9]{64}$/.test(String(entry.batchHash || ''))
      ) {
        fail('ready-parity-failed');
      }
      journalKeys.add(key);
      journalCounts[entry.storeName] = (journalCounts[entry.storeName] || 0) + entry.recordCount;
    }
    for (const [storeName, count] of Object.entries(migrationMeta.counts)) {
      if (count > 0 && journalCounts[storeName] !== count) fail('ready-parity-failed');
      if (count === 0 && (journalCounts[storeName] || 0) !== 0) fail('ready-parity-failed');
    }

    const workspaceChangeJournal = await repository.listWorkspaceChangeJournal(generationId);
    const tombstoneCount = workspaceChangeJournal.reduce(
      (sum, entry) => sum + (Array.isArray(entry?.tombstones) ? entry.tombstones.length : 0),
      0,
    );
    if (
      application.counts?.[modules.storageManifest.APP_DATA_STORES.META] !== 1
      || application.counts?.[modules.storageManifest.APP_DATA_STORES.MIGRATION_JOURNAL] !== journal.length
      || application.counts?.[modules.storageManifest.APP_DATA_STORES.WORKSPACE_CHANGE_JOURNAL] !== workspaceChangeJournal.length
    ) {
      fail('ready-parity-failed');
    }

    const journalHash = await modules.integrity.canonicalSha256(sortByRecordKey(journal));
    const workspaceChangeJournalHash = await modules.integrity.canonicalSha256(
      sortByRecordKey(workspaceChangeJournal),
    );

    const safeVerification = {
      generationId,
      sourceHash: migrationMeta.sourceHash,
      workspaceSourceHash: migrationMeta.workspaceSourceHash,
      integrity: migrationMeta.integrity,
      counts: migrationMeta.counts,
      sourceRecordsHash: actualSourceHash,
      stableReadCount: current.stableReadCount,
    };
    const activationCriticalVerification = {
      generationId,
      activationCriticalSourceHash: readySourceIntegrity.activationCriticalSourceHash,
      activationCriticalIntegrity: readySourceIntegrity.activationCritical,
      projectionHashes,
      fullSourceMismatchWarning: current.sourceHash !== migrationMeta.sourceHash,
    };
    return {
      verified: true,
      generationId,
      sourceHash: migrationMeta.sourceHash,
      currentSourceHash: current.sourceHash,
      activationCriticalSourceHash: readySourceIntegrity.activationCriticalSourceHash,
      activationCriticalIntegrity: readySourceIntegrity.activationCritical,
      fullSourceMismatchWarning: current.sourceHash !== migrationMeta.sourceHash,
      workspaceSourceHash: migrationMeta.workspaceSourceHash,
      workspaceIntegrity: migrationMeta.integrity,
      counts: migrationMeta.counts,
      verificationHash: await modules.integrity.canonicalSha256(safeVerification),
      activationCriticalVerificationHash: await modules.integrity.canonicalSha256(
        activationCriticalVerification,
      ),
      database: {
        name: application.name,
        version: application.version,
        storeCounts: application.counts,
      },
      generationState: migrationMeta.state,
      activePointers: {
        activeGeneration: false,
        activeWorkspaceGeneration: false,
      },
      generationCounts: Object.fromEntries(
        Object.entries(actualByStore).map(([storeName, records]) => [storeName, records.length]),
      ),
      projectionCounts: {
        workspaceItems: actualByStore[modules.storageManifest.APP_DATA_STORES.WORKSPACE_ITEMS].length,
        snapshots: actualByStore[modules.storageManifest.APP_DATA_STORES.SNAPSHOTS].length,
      },
      journalCounts: {
        migrationJournalEntries: journal.length,
        migratedRecordsByStore: journalCounts,
        workspaceChangeJournalEntries: workspaceChangeJournal.length,
        tombstones: tombstoneCount,
      },
      hashes: {
        sourceHash: migrationMeta.sourceHash,
        currentSourceHash: current.sourceHash,
        expectedCurrentSourceRecordsHash: expectedSourceHash,
        activationCriticalSourceHash: readySourceIntegrity.activationCriticalSourceHash,
        workspaceSourceHash: migrationMeta.workspaceSourceHash,
        sourceRecordsHash: actualSourceHash,
        generationStores: generationStoreHashes,
        projections: projectionHashes,
        migrationJournal: journalHash,
        workspaceChangeJournal: workspaceChangeJournalHash,
      },
      current,
    };
  } finally {
    repository.close();
  }
}

async function runPreflight() {
  setStatus('running', 'מבצע שתי קריאות יציבות ובדיקות read-only…');
  preflightProof = await collectIdenticalReadOnlyPreflights(
    () => collectPreflight(),
  );
  if (
    preflightProof.storageMode !== 'localStorage'
    || preflightProof.applicationDatabaseAbsent
    || !preflightProof.activeGenerationAbsent
    || preflightProof.migrationState !== 'ready'
    || preflightProof.generationId !== EXPECTED_READY_GENERATION_ID
  ) {
    fail('baseline-drift');
  }
  readyProof = null;
  setText('meta-verification-hash', '—');
  setStatus('success', 'שתי בדיקות baseline קריאה בלבד זהות. Verify READY זמין; Prepare ו-Activate חסומים.');
}

async function inspectUnexpectedDatabase() {
  setStatus('running', 'Inspecting unexpected IndexedDB metadata with readonly count() requests only...');
  preflightProof = null;
  readyProof = null;
  const modules = await loadModules();
  const metadata = assertIgnoredExternalDatabaseMetadata(await inspectSingleUnexpectedDatabaseMetadata({
    indexedDBFactory: indexedDB,
    allowedDatabaseNames: [LEGACY_DATABASE.name, modules.storageManifest.APP_DATA_DB_NAME],
  }));
  setText('unexpected-db-metadata', JSON.stringify(metadata, null, 2));
  setStatus('success', 'Unexpected IndexedDB metadata inspection completed read-only. Migration actions remain blocked.');
}

async function collectSourceDeltaOnce() {
  lastSafeGate = 'delta-location';
  if (
    location.origin !== CONTROLLER_ORIGIN
    || location.pathname !== CONTROLLER_PATH
    || location.search
    || location.hash
  ) {
    fail('baseline-drift');
  }
  const modules = await loadModules();
  if (modules.storageMode.getApplicationStorageMode({ env: import.meta.env || {} }) !== 'localStorage') {
    fail('baseline-drift');
  }
  const currentSnapshot = await modules.migration.captureStableLocalStorage(localStorage, crypto);
  const currentWorkspace = verifyWorkspaceSnapshot(currentSnapshot, {
    ...modules.integrity,
    isSensitiveStorageKey: modules.storageManifest.isSensitiveStorageKey,
  });
  const database = await openExistingDatabase(modules.storageManifest.APP_DATA_DB_NAME);
  try {
    if (database.version !== modules.storageManifest.APP_DATA_DB_VERSION) {
      fail('delta-ready-state-mismatch');
    }
    const expectedStores = Object.values(modules.storageManifest.APP_DATA_STORES).sort();
    if (!sameStrings([...database.objectStoreNames], expectedStores)) {
      fail('delta-ready-state-mismatch');
    }
    const readySnapshot = await collectReadySourceSnapshotReadOnly({
      database,
      generationId: EXPECTED_READY_GENERATION_ID,
      storageManifest: modules.storageManifest,
      integrity: modules.integrity,
    });
    const report = await buildSafeSourceDeltaReport({
      currentSnapshot,
      readySnapshot,
      storageManifest: modules.storageManifest,
      integrity: modules.integrity,
    });
    return {
      ...report,
      current: {
        ...report.current,
        workspace: currentWorkspace.displayIntegrity,
      },
    };
  } finally {
    database.close();
  }
}

async function inspectSourceDelta() {
  setStatus('running', 'Comparing the approved localStorage source with READY using readonly transactions only…');
  preflightProof = null;
  readyProof = null;
  const first = await collectSourceDeltaOnce();
  const second = await collectSourceDeltaOnce();
  const firstJson = JSON.stringify(first);
  const secondJson = JSON.stringify(second);
  if (firstJson !== secondJson) fail('delta-report-unstable');
  if (
    !first.allTransactionsReadonly
    || first.writeOperationCount !== 0
    || first.sourceIntegrity.activationCriticalMatches !== true
    || first.rootCause === 'corruption'
    || first.rootCause === 'unresolved'
  ) {
    fail('delta-audit-failed');
  }
  setText('source-delta-report', JSON.stringify({
    stableSnapshotCount: 2,
    stableDeltaReportCount: 2,
    reportSha256: await (await loadModules()).integrity.sha256Text(firstJson, crypto),
    ...first,
  }, null, 2));
  setStatus('success', 'Source delta audit completed twice with identical safe metadata. Prepare, Verify and Activate remain blocked.');
}

async function prepareMigration() {
  if (!constantTimeTextEqual(element('prepare-confirmation')?.value, PREPARE_CONFIRMATION)) {
    fail('baseline-drift');
  }
  setStatus('running', 'מאמת baseline מחדש ומכין דור IndexedDB לא פעיל…');
  const current = await collectPreflight({ requireApplicationDatabaseAbsent: true });
  if (
    !preflightProof?.verified
    || current.sourceHash !== preflightProof.sourceHash
    || current.snapshotSha256 !== VERIFIED_BASELINE.snapshotSha256
  ) {
    fail('baseline-drift');
  }

  const modules = await loadModules();
  const database = await modules.appDataDb.openAppDataDb();
  const repository = modules.appDataDb.createAppDataRepository(database);
  try {
    if (
      await repository.readMeta('migration')
      || await repository.readMeta('activeGeneration')
      || await repository.readMeta('activeWorkspaceGeneration')
    ) {
      fail('concurrent-generation');
    }
    const result = await modules.migration.migrateLocalStorageToIndexedDb({
      storage: localStorage,
      repository,
      expectedWorkspaceIntegrity: {
        recordCount: VERIFIED_BASELINE.recordCount,
        idChecksum: VERIFIED_BASELINE.idChecksum,
        payloadChecksum: VERIFIED_BASELINE.migrationChecksum,
      },
      activate: false,
    });
    if (
      result.state !== modules.migration.MIGRATION_STATES.READY
      || result.counts?.sourceEntries !== VERIFIED_BASELINE.approvedKeyCount
      || result.counts?.workspaceItems !== VERIFIED_BASELINE.recordCount
      || result.sourceHash !== current.sourceHash
      || result.activationCriticalSourceHash !== current.activationCriticalSourceHash
      || result.workspaceSourceHash !== current.workspaceSourceHash
    ) {
      fail('ready-parity-failed');
    }
    const firstReadyVerification = await verifyReadyInternal();
    const secondReadyVerification = await verifyReadyInternal();
    if (
      firstReadyVerification.verificationHash !== secondReadyVerification.verificationHash
      || firstReadyVerification.generationId !== result.generationId
      || secondReadyVerification.generationId !== result.generationId
    ) {
      fail('ready-parity-failed');
    }
    readyProof = secondReadyVerification;
    preflightProof = {
      ...secondReadyVerification.current,
      applicationDatabaseAbsent: false,
      migrationState: 'ready',
      generationId: result.generationId,
    };
    setText('meta-migration', `ready · ${result.generationId}`);
    setText('meta-verification-hash', secondReadyVerification.verificationHash);
    setStatus('success', 'דור READY נוצר ואומת פעמיים. Activation נשאר חסום.');
  } finally {
    repository.close();
  }
}

async function verifyReady() {
  setStatus('running', 'קורא מחדש את דור READY ומאמת ספירות ו־hashes…');
  const firstReadyProof = await verifyReadyInternal();
  const secondReadyProof = await verifyReadyInternal();
  const safeView = proof => ({
    verified: proof.verified,
    generationId: proof.generationId,
    generationState: proof.generationState,
    sourceHash: proof.sourceHash,
    currentSourceHash: proof.currentSourceHash,
    activationCriticalSourceHash: proof.activationCriticalSourceHash,
    activationCriticalIntegrity: proof.activationCriticalIntegrity,
    fullSourceMismatchWarning: proof.fullSourceMismatchWarning,
    workspaceSourceHash: proof.workspaceSourceHash,
    workspaceIntegrity: proof.workspaceIntegrity,
    counts: proof.counts,
    verificationHash: proof.verificationHash,
    activationCriticalVerificationHash: proof.activationCriticalVerificationHash,
    database: proof.database,
    activePointers: proof.activePointers,
    generationCounts: proof.generationCounts,
    projectionCounts: proof.projectionCounts,
    journalCounts: proof.journalCounts,
    hashes: proof.hashes,
  });
  const firstSafeView = safeView(firstReadyProof);
  const secondSafeView = safeView(secondReadyProof);
  if (
    JSON.stringify(firstSafeView) !== JSON.stringify(secondSafeView)
    || secondReadyProof.verificationHash !== EXPECTED_READY_VERIFICATION_SHA256
  ) {
    fail('ready-parity-failed');
  }
  readyProof = secondReadyProof;
  preflightProof = {
    ...readyProof.current,
    migrationState: 'ready',
    generationId: readyProof.generationId,
  };
  setText('unexpected-db-metadata', JSON.stringify({
    verificationPassesIdentical: true,
    ...secondSafeView,
  }, null, 2));
  setText('meta-verification-hash', readyProof.verificationHash);
  setStatus('success', 'דור READY עבר שתי בדיקות readonly זהות. Prepare ו-Activate נשארו חסומים.');
}

async function activateGeneration() {
  if (
    !readyProof?.verified
    || !constantTimeTextEqual(element('activation-confirmation')?.value, ACTIVATE_CONFIRMATION)
    || !constantTimeTextEqual(element('activation-generation-id')?.value, readyProof.generationId)
  ) {
    fail('ready-parity-failed');
  }
  setStatus('running', 'מאמת READY ומקור localStorage פעם נוספת לפני activation…');
  const verifiedAgain = await verifyReadyInternal();
  if (
    verifiedAgain.generationId !== readyProof.generationId
    || verifiedAgain.sourceHash !== readyProof.sourceHash
    || verifiedAgain.verificationHash !== readyProof.verificationHash
    || verifiedAgain.activationCriticalVerificationHash
      !== readyProof.activationCriticalVerificationHash
  ) {
    fail('ready-parity-failed');
  }

  const modules = await loadModules();
  const database = await openExistingDatabase(modules.storageManifest.APP_DATA_DB_NAME);
  const repository = modules.appDataDb.createAppDataRepository(database);
  try {
    const activationEvidence = {
      backup: {
        verified: VERIFIED_BACKUP.verified,
        encryptedFileSha256: VERIFIED_BACKUP.encryptedFileSha256,
        workspaceSourceHash: verifiedAgain.workspaceSourceHash,
        workspaceIntegrity: verifiedAgain.workspaceIntegrity,
      },
      preflight: {
        verified: true,
        workspaceSourceHash: verifiedAgain.workspaceSourceHash,
        workspaceIntegrity: verifiedAgain.workspaceIntegrity,
        stableReadCount: verifiedAgain.current.stableReadCount,
        storageMode: verifiedAgain.current.storageMode,
        activeGenerationAbsent: verifiedAgain.current.activeGenerationAbsent,
        sourceHash: verifiedAgain.current.sourceHash,
        activationCriticalSourceHash: verifiedAgain.activationCriticalSourceHash,
        activationCriticalIntegrity: verifiedAgain.activationCriticalIntegrity,
      },
      integrity: {
        verified: true,
        generationId: verifiedAgain.generationId,
        sourceHash: verifiedAgain.sourceHash,
        activationCriticalSourceHash: verifiedAgain.activationCriticalSourceHash,
        activationCriticalIntegrity: verifiedAgain.activationCriticalIntegrity,
        workspaceSourceHash: verifiedAgain.workspaceSourceHash,
        workspaceIntegrity: verifiedAgain.workspaceIntegrity,
      },
    };
    const activated = await modules.migration.activateReadyGeneration(repository, {
      activationEvidence,
    });
    const [activeMeta, activeWorkspaceMeta] = await Promise.all([
      repository.readMeta('activeGeneration'),
      repository.readMeta('activeWorkspaceGeneration'),
    ]);
    const sourceAfter = await modules.migration.captureStableLocalStorage(localStorage, crypto);
    if (
      activated.state !== modules.migration.MIGRATION_STATES.ACTIVE
      || sourceAfter.activationCriticalSourceHash
        !== verifiedAgain.activationCriticalSourceHash
    ) {
      fail('ready-parity-failed');
    }
    try {
      modules.migration.assertMatchingActiveGenerationPointers({
        activeGeneration: activeMeta,
        activeWorkspaceGeneration: activeWorkspaceMeta,
        expectedGenerationId: verifiedAgain.generationId,
      });
    } catch {
      fail('ready-parity-failed');
    }
    readyProof = null;
    preflightProof = {
      ...verifiedAgain.current,
      migrationState: 'active',
      generationId: verifiedAgain.generationId,
      activeGenerationAbsent: false,
    };
    setText('meta-migration', `active · ${verifiedAgain.generationId} · runtime flag unchanged`);
    setStatus('success', 'הדור הופעל אטומית. דגל ה־runtime נשאר localStorage; שינוי דגל ו־restart דורשים אישור נפרד.');
  } finally {
    repository.close();
  }
}

function abortController() {
  preflightProof = null;
  readyProof = null;
  loadedModulesPromise = null;
  setText('unexpected-db-metadata', 'Not inspected.');
  for (const id of ['prepare-confirmation', 'activation-confirmation', 'activation-generation-id']) {
    const input = element(id);
    if (input instanceof HTMLInputElement) input.value = '';
  }
  setStatus('idle', 'הבקר בוטל בזיכרון בלבד. לא בוצע cleanup ולא נמחק storage. אפשר לסגור את הטאב.');
  updateControls();
  window.close();
}

function bindAction(buttonId, label, action) {
  const button = element(buttonId);
  if (!(button instanceof HTMLButtonElement)) return;
  button.addEventListener('click', async () => {
    try {
      await withExclusiveOperation(label, action);
    } catch (error) {
      readyProof = null;
      setStatus('error', safeErrorMessage(error));
    } finally {
      updateControls();
    }
  });
}

function initializeController() {
  setText('meta-origin', location.origin);
  bindAction('run-preflight', 'preflight', runPreflight);
  bindAction('inspect-unexpected-database', 'inspect', inspectUnexpectedDatabase);
  bindAction('inspect-source-delta', 'delta', inspectSourceDelta);
  bindAction('prepare-migration', 'prepare', prepareMigration);
  bindAction('verify-ready', 'verify', verifyReady);
  bindAction('activate-generation', 'activate', activateGeneration);
  element('abort-controller')?.addEventListener('click', abortController);
  for (const id of ['prepare-confirmation', 'activation-confirmation', 'activation-generation-id']) {
    element(id)?.addEventListener('input', updateControls);
  }
  updateControls();
}

if (typeof document !== 'undefined') initializeController();
