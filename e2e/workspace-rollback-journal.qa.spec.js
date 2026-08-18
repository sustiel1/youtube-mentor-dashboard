import { expect, test } from '@playwright/test';

test('Workspace change journal survives reload and replays from the untouched fallback', async ({ page }) => {
  await page.goto('/index.html');

  const firstPass = await page.evaluate(async () => {
    const [dbModule, migration, modeModule, persistenceModule, journalModule, integrity] = await Promise.all([
      import('/src/lib/persistence/appDataDb.js'),
      import('/src/lib/persistence/storageMigration.js'),
      import('/src/lib/persistence/storageMode.js'),
      import('/src/lib/persistence/workspacePersistence.js'),
      import('/src/lib/persistence/workspaceChangeJournal.js'),
      import('/src/lib/persistence/storageIntegrity.js'),
    ]);
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('yt_mentor_app_data_v1');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('synthetic database cleanup blocked'));
    });
    const originalItems = [
      { id: 'legacy', itemType: 'snippet', notes: 'original' },
      {
        id: 'partial-snapshot',
        itemType: 'structured-snapshot',
        structuredSnapshot: { version: 0, stocksTable: [], sentiment: [{ legacy: true }] },
      },
    ];
    const originalRaw = JSON.stringify(originalItems);
    localStorage.setItem('workspace_library_v1', originalRaw);
    localStorage.setItem('yt_thumb_cache_v1', JSON.stringify({ synthetic: { quality: 'hqdefault' } }));
    localStorage.setItem('base44_access_token', 'synthetic-secret-must-not-migrate');
    const database = await dbModule.openAppDataDb();
    const repository = dbModule.createAppDataRepository(database);
    const ready = await migration.migrateLocalStorageToIndexedDb({
      storage: localStorage,
      repository,
      expectedWorkspaceIntegrity: integrity.verifyWorkspaceRaw(originalRaw).integrity,
      generationIdFactory: () => 'browser-cutover-generation',
    });
    localStorage.setItem('yt_thumb_cache_v1', JSON.stringify({ synthetic: { quality: 'sddefault' } }));
    const currentSource = await migration.captureStableLocalStorage(localStorage);
    const common = {
      workspaceSourceHash: ready.workspaceSourceHash,
      workspaceIntegrity: ready.integrity,
    };
    await migration.activateReadyGeneration(repository, {
      activationEvidence: {
        backup: {
          verified: true,
          encryptedFileSha256: 'a'.repeat(64),
          ...common,
        },
        preflight: {
          verified: true,
          stableReadCount: 2,
          storageMode: 'localStorage',
          activeGenerationAbsent: true,
          sourceHash: currentSource.sourceHash,
          activationCriticalSourceHash: currentSource.activationCriticalSourceHash,
          activationCriticalIntegrity: currentSource.activationCriticalIntegrity,
          ...common,
        },
        integrity: {
          verified: true,
          generationId: ready.generationId,
          sourceHash: ready.sourceHash,
          activationCriticalSourceHash: ready.activationCriticalSourceHash,
          activationCriticalIntegrity: ready.activationCriticalIntegrity,
          ...common,
        },
      },
    });
    const persistence = persistenceModule.createWorkspacePersistence({
      mode: modeModule.APPLICATION_STORAGE_MODES.INDEXED_DB,
      localStorageArea: localStorage,
      repositoryFactory: async () => repository,
    });
    await persistence.saveItem({ id: 'test-item', notes: 'one' });
    await persistence.updateItem('test-item', { notes: 'two' });
    await persistence.archiveItems(['test-item'], true);
    await persistence.archiveItems(['test-item'], false);
    await persistence.saveItem({ id: 'survivor', notes: 'kept' });
    await persistence.deleteItem('test-item');
    const replay = await journalModule.replayWorkspaceChangeJournal({ repository, fallbackRaw: originalRaw });
    const active = await repository.readMeta('activeWorkspaceGeneration');
    const secret = await repository.readSourceEntry(ready.generationId, 'base44_access_token');
    const result = {
      originalRaw,
      fallbackUnchanged: localStorage.getItem('workspace_library_v1') === originalRaw,
      recordCount: replay.integrity.recordCount,
      idChecksum: replay.integrity.idChecksum,
      payloadChecksum: replay.integrity.payloadChecksum,
      operationCount: replay.operationCount,
      generationId: replay.generationId,
      activeGenerationId: active.generationId,
      survivorPresent: replay.items.some((item) => item.id === 'survivor'),
      deletedAbsent: !replay.items.some((item) => item.id === 'test-item'),
      partialSnapshotPreserved: replay.items.find((item) => item.id === 'partial-snapshot')
        ?.structuredSnapshot?.sentiment?.[0]?.legacy === true,
      fullSourceMismatch: currentSource.sourceHash !== ready.sourceHash,
      activationCriticalMatch: currentSource.activationCriticalSourceHash
        === ready.activationCriticalSourceHash,
      secretExcluded: secret === null,
      databaseVersion: database.version,
      stores: [...database.objectStoreNames],
    };
    persistence.close();
    repository.close();
    return result;
  });

  expect(firstPass.fallbackUnchanged).toBe(true);
  expect(firstPass.operationCount).toBe(6);
  expect(firstPass.generationId).toBe(firstPass.activeGenerationId);
  expect(firstPass.survivorPresent).toBe(true);
  expect(firstPass.deletedAbsent).toBe(true);
  expect(firstPass.partialSnapshotPreserved).toBe(true);
  expect(firstPass.fullSourceMismatch).toBe(true);
  expect(firstPass.activationCriticalMatch).toBe(true);
  expect(firstPass.secretExcluded).toBe(true);
  expect(firstPass.databaseVersion).toBe(2);
  expect(firstPass.stores).toContain('workspaceChangeJournal');

  await page.reload();
  const afterReload = await page.evaluate(async (originalRaw) => {
    const [dbModule, journalModule] = await Promise.all([
      import('/src/lib/persistence/appDataDb.js'),
      import('/src/lib/persistence/workspaceChangeJournal.js'),
    ]);
    const database = await dbModule.openAppDataDb();
    const repository = dbModule.createAppDataRepository(database);
    const replay = await journalModule.replayWorkspaceChangeJournal({ repository, fallbackRaw: originalRaw });
    const result = {
      recordCount: replay.integrity.recordCount,
      idChecksum: replay.integrity.idChecksum,
      payloadChecksum: replay.integrity.payloadChecksum,
      operationCount: replay.operationCount,
      fallbackUnchanged: localStorage.getItem('workspace_library_v1') === originalRaw,
    };
    repository.close();
    return result;
  }, firstPass.originalRaw);
  expect(afterReload).toEqual({
    recordCount: firstPass.recordCount,
    idChecksum: firstPass.idChecksum,
    payloadChecksum: firstPass.payloadChecksum,
    operationCount: firstPass.operationCount,
    fallbackUnchanged: true,
  });

  const secondPage = await page.context().newPage();
  await secondPage.goto('/index.html');
  const secondPageRead = await secondPage.evaluate(async (originalRaw) => {
    const [dbModule, journalModule] = await Promise.all([
      import('/src/lib/persistence/appDataDb.js'),
      import('/src/lib/persistence/workspaceChangeJournal.js'),
    ]);
    const database = await dbModule.openAppDataDb();
    const repository = dbModule.createAppDataRepository(database);
    const replay = await journalModule.replayWorkspaceChangeJournal({ repository, fallbackRaw: originalRaw });
    repository.close();
    return {
      recordCount: replay.integrity.recordCount,
      operationCount: replay.operationCount,
      fallbackUnchanged: localStorage.getItem('workspace_library_v1') === originalRaw,
    };
  }, firstPass.originalRaw);
  expect(secondPageRead).toEqual({
    recordCount: firstPass.recordCount,
    operationCount: firstPass.operationCount,
    fallbackUnchanged: true,
  });
});

test('generation activation commits both pointers atomically and fails closed', async ({ page }) => {
  await page.goto('/index.html');

  const result = await page.evaluate(async () => {
    const [dbModule, migration, integrity] = await Promise.all([
      import('/src/lib/persistence/appDataDb.js'),
      import('/src/lib/persistence/storageMigration.js'),
      import('/src/lib/persistence/storageIntegrity.js'),
    ]);
    const databaseName = 'yt_mentor_app_data_v1';
    const workspaceRaw = JSON.stringify([
      { id: 'atomic-item', itemType: 'knowledge-item', notes: 'synthetic' },
    ]);

    async function deleteDatabase() {
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('synthetic database cleanup blocked'));
      });
    }

    function activationEvidence(ready) {
      const common = {
        workspaceSourceHash: ready.workspaceSourceHash,
        workspaceIntegrity: ready.integrity,
      };
      return {
        backup: {
          verified: true,
          encryptedFileSha256: 'a'.repeat(64),
          ...common,
        },
        preflight: {
          verified: true,
          stableReadCount: 2,
          storageMode: 'localStorage',
          activeGenerationAbsent: true,
          sourceHash: ready.sourceHash,
          activationCriticalSourceHash: ready.activationCriticalSourceHash,
          activationCriticalIntegrity: ready.activationCriticalIntegrity,
          ...common,
        },
        integrity: {
          verified: true,
          generationId: ready.generationId,
          sourceHash: ready.sourceHash,
          activationCriticalSourceHash: ready.activationCriticalSourceHash,
          activationCriticalIntegrity: ready.activationCriticalIntegrity,
          ...common,
        },
      };
    }

    async function prepare(generationId) {
      await deleteDatabase();
      localStorage.clear();
      localStorage.setItem('workspace_library_v1', workspaceRaw);
      const database = await dbModule.openAppDataDb();
      const repository = dbModule.createAppDataRepository(database);
      const ready = await migration.migrateLocalStorageToIndexedDb({
        storage: localStorage,
        repository,
        expectedWorkspaceIntegrity: integrity.verifyWorkspaceRaw(workspaceRaw).integrity,
        generationIdFactory: () => generationId,
      });
      repository.close();
      return ready;
    }

    function wrapDatabase(database, { abortAtPut = 0, quotaAtPut = 0 } = {}) {
      return {
        transaction(storeNames, mode) {
          const transaction = database.transaction(storeNames, mode);
          if (mode !== 'readwrite' || storeNames !== 'meta') return transaction;
          let putCount = 0;
          return new Proxy(transaction, {
            get(target, property) {
              if (property === 'objectStore') {
                return (storeName) => {
                  const store = target.objectStore(storeName);
                  if (storeName !== 'meta') return store;
                  return new Proxy(store, {
                    get(storeTarget, storeProperty) {
                      if (storeProperty === 'put') {
                        return (record) => {
                          putCount += 1;
                          if (putCount === quotaAtPut) {
                            throw new DOMException('synthetic activation quota', 'QuotaExceededError');
                          }
                          const request = storeTarget.put(record);
                          if (putCount === abortAtPut) {
                            queueMicrotask(() => {
                              try { target.abort(); } catch {}
                            });
                          }
                          return request;
                        };
                      }
                      const value = storeTarget[storeProperty];
                      return typeof value === 'function' ? value.bind(storeTarget) : value;
                    },
                  });
                };
              }
              const value = target[property];
              return typeof value === 'function' ? value.bind(target) : value;
            },
            set(target, property, value) {
              target[property] = value;
              return true;
            },
          });
        },
        close: () => database.close(),
      };
    }

    async function readActivationState() {
      const database = await dbModule.openAppDataDb();
      const repository = dbModule.createAppDataRepository(database);
      const state = {
        migration: await repository.readMeta('migration'),
        activeGeneration: await repository.readMeta('activeGeneration'),
        activeWorkspaceGeneration: await repository.readMeta('activeWorkspaceGeneration'),
        recoveryAnchor: await repository.readMeta('workspaceRecoveryAnchor'),
      };
      repository.close();
      return state;
    }

    async function runFault(name, fault) {
      const ready = await prepare(`generation-${name}`);
      const database = await dbModule.openAppDataDb();
      const repository = dbModule.createAppDataRepository(wrapDatabase(database, fault));
      let rejected = false;
      try {
        await migration.activateReadyGeneration(repository, {
          activationEvidence: activationEvidence(ready),
        });
      } catch {
        rejected = true;
      } finally {
        database.close();
      }
      const state = await readActivationState();
      return {
        rejected,
        pointersAbsent: !state.activeGeneration && !state.activeWorkspaceGeneration,
        migrationReady: state.migration?.state === 'ready',
        anchorAbsent: !state.recoveryAnchor,
      };
    }

    const ready = await prepare('generation-success');
    {
      const database = await dbModule.openAppDataDb();
      const repository = dbModule.createAppDataRepository(database);
      await migration.activateReadyGeneration(repository, {
        activationEvidence: activationEvidence(ready),
      });
      repository.close();
    }
    const success = await readActivationState();

    const beforeFirstPointer = await runFault('before-first', { quotaAtPut: 1 });
    const betweenPointers = await runFault('between-pointers', { quotaAtPut: 2 });
    const afterBothPointers = await runFault('after-pointers', { abortAtPut: 4 });

    const conflictReady = await prepare('generation-conflict');
    {
      const database = await dbModule.openAppDataDb();
      const repository = dbModule.createAppDataRepository(database);
      await repository.writeMeta({
        key: 'activeGeneration',
        generationId: 'generation-existing',
        state: 'active',
      });
      let rejected = false;
      try {
        await migration.activateReadyGeneration(repository, {
          activationEvidence: activationEvidence(conflictReady),
        });
      } catch {
        rejected = true;
      }
      repository.close();
      const conflict = await readActivationState();
      success.conflictRejected = rejected;
      success.conflictPreserved = conflict.activeGeneration?.generationId === 'generation-existing'
        && !conflict.activeWorkspaceGeneration
        && conflict.migration?.state === 'ready';
    }

    const nonReady = await prepare('generation-non-ready');
    {
      const database = await dbModule.openAppDataDb();
      const repository = dbModule.createAppDataRepository(database);
      await repository.writeMeta({ ...(await repository.readMeta('migration')), state: 'copying' });
      let rejected = false;
      try {
        await migration.activateReadyGeneration(repository, {
          activationEvidence: activationEvidence(nonReady),
        });
      } catch {
        rejected = true;
      }
      repository.close();
      const state = await readActivationState();
      success.nonReadyRejected = rejected;
      success.nonReadyPointersAbsent = !state.activeGeneration && !state.activeWorkspaceGeneration;
    }

    const staleReady = await prepare('generation-stale');
    {
      const database = await dbModule.openAppDataDb();
      const baseRepository = dbModule.createAppDataRepository(database);
      const staleRepository = {
        readMeta: (key) => baseRepository.readMeta(key),
        listByGeneration: (...args) => baseRepository.listByGeneration(...args),
        activateGeneration: async (payload) => {
          const current = await baseRepository.readMeta('migration');
          await baseRepository.writeMeta({ ...current, sourceLogicalBytes: current.sourceLogicalBytes + 2 });
          return baseRepository.activateGeneration(payload);
        },
      };
      let rejected = false;
      try {
        await migration.activateReadyGeneration(staleRepository, {
          activationEvidence: activationEvidence(staleReady),
        });
      } catch {
        rejected = true;
      }
      baseRepository.close();
      const state = await readActivationState();
      success.staleRejected = rejected;
      success.stalePointersAbsent = !state.activeGeneration && !state.activeWorkspaceGeneration;
    }

    await deleteDatabase();
    localStorage.clear();
    return {
      success: {
        bothPointersActive: success.activeGeneration?.state === 'active'
          && success.activeWorkspaceGeneration?.state === 'active',
        pointersMatch: success.activeGeneration?.generationId === 'generation-success'
          && success.activeWorkspaceGeneration?.generationId === 'generation-success',
        generationCommitted: success.migration?.state === 'active'
          && success.migration?.generationId === 'generation-success',
        anchorCommitted: success.recoveryAnchor?.state === 'anchored'
          && success.recoveryAnchor?.generationId === 'generation-success',
        conflictRejected: success.conflictRejected,
        conflictPreserved: success.conflictPreserved,
        nonReadyRejected: success.nonReadyRejected,
        nonReadyPointersAbsent: success.nonReadyPointersAbsent,
        staleRejected: success.staleRejected,
        stalePointersAbsent: success.stalePointersAbsent,
      },
      beforeFirstPointer,
      betweenPointers,
      afterBothPointers,
    };
  });

  expect(result.success).toEqual({
    bothPointersActive: true,
    pointersMatch: true,
    generationCommitted: true,
    anchorCommitted: true,
    conflictRejected: true,
    conflictPreserved: true,
    nonReadyRejected: true,
    nonReadyPointersAbsent: true,
    staleRejected: true,
    stalePointersAbsent: true,
  });
  for (const failure of [result.beforeFirstPointer, result.betweenPointers, result.afterBothPointers]) {
    expect(failure).toEqual({
      rejected: true,
      pointersAbsent: true,
      migrationReady: true,
      anchorAbsent: true,
    });
  }
});
