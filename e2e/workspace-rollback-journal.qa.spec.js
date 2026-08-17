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
    localStorage.setItem('base44_access_token', 'synthetic-secret-must-not-migrate');
    const database = await dbModule.openAppDataDb();
    const repository = dbModule.createAppDataRepository(database);
    const ready = await migration.migrateLocalStorageToIndexedDb({
      storage: localStorage,
      repository,
      expectedWorkspaceIntegrity: integrity.verifyWorkspaceRaw(originalRaw).integrity,
      generationIdFactory: () => 'browser-cutover-generation',
    });
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
          ...common,
        },
        integrity: {
          verified: true,
          generationId: ready.generationId,
          sourceHash: ready.sourceHash,
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
