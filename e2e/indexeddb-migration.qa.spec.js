import { expect, test } from '@playwright/test';

const EXPECTED_STORES = [
  'analyses',
  'mediaBlobs',
  'meta',
  'migrationJournal',
  'snapshots',
  'sourceEntries',
  'transcripts',
  'videos',
  'workspaceItems',
];

test('persists a verified inactive generation across reload before explicit cutover', async ({ page }) => {
  await page.goto('/ytmdb-origin-export.html');

  const firstPass = await page.evaluate(async () => {
    const [{ openAppDataDb, createAppDataRepository }, integrity, migration] = await Promise.all([
      import('/src/lib/persistence/appDataDb.js'),
      import('/src/lib/persistence/storageIntegrity.js'),
      import('/src/lib/persistence/storageMigration.js'),
    ]);

    const workspaceItems = Array.from({ length: 80 }, (_, index) => ({
      id: `isolated-workspace-${String(index).padStart(3, '0')}`,
      videoId: `isolated-video-${index % 5}`,
      itemType: index === 4 ? 'structured-snapshot' : 'knowledge-item',
      structuredSnapshot: index === 4
        ? { videoId: 'isolated-video-4', stocksTable: [], sentiment: [{ legacy: true }] }
        : undefined,
      payload: { index, text: `isolated-${index}` },
    }));
    const workspaceRaw = JSON.stringify(workspaceItems);
    localStorage.setItem('workspace_library_v1', workspaceRaw);
    localStorage.setItem('yt_mentor_videos_v2', JSON.stringify([
      { id: 'duplicate', youtubeId: 'isolated-video-a' },
      { id: 'duplicate', youtubeId: 'isolated-video-b' },
    ]));
    localStorage.setItem('analysis:isolated-video-a', JSON.stringify({ summary: 'synthetic' }));
    localStorage.setItem('base44_access_token', 'synthetic-sensitive-value');
    localStorage.setItem('unrelated_key', 'synthetic-unknown-value');

    const before = JSON.stringify(
      Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]),
    );
    const expectedWorkspaceIntegrity = {
      recordCount: workspaceItems.length,
      idChecksum: integrity.checksumWorkspaceItemIds(workspaceItems),
      payloadChecksum: integrity.checksumWorkspacePayloadsExcludingTopicAssignment(workspaceItems),
    };
    const database = await openAppDataDb();
    const stores = [...database.objectStoreNames].sort();
    const repository = createAppDataRepository(database);
    const result = await migration.migrateLocalStorageToIndexedDb({
      storage: localStorage,
      repository,
      expectedWorkspaceIntegrity,
      batchSize: 10,
      generationIdFactory: () => 'isolated-generation-v1',
    });
    const after = JSON.stringify(
      Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]),
    );
    const sensitiveEntry = await repository.readSourceEntry(
      result.generationId,
      'base44_access_token',
    );
    const unknownEntry = await repository.readSourceEntry(result.generationId, 'unrelated_key');
    repository.close();

    return {
      state: result.state,
      generationId: result.generationId,
      workspaceCount: result.integrity.recordCount,
      stores,
      localStorageUnchanged: before === after,
      sensitiveExcluded: sensitiveEntry === null,
      unknownExcluded: unknownEntry === null,
      workspaceRaw,
    };
  });

  expect(firstPass.state).toBe('ready');
  expect(firstPass.generationId).toBe('isolated-generation-v1');
  expect(firstPass.workspaceCount).toBe(80);
  expect(firstPass.stores).toEqual(EXPECTED_STORES);
  expect(firstPass.localStorageUnchanged).toBe(true);
  expect(firstPass.sensitiveExcluded).toBe(true);
  expect(firstPass.unknownExcluded).toBe(true);

  await page.reload();

  const afterReload = await page.evaluate(async () => {
    const [databaseModule, migrationModule, facadeModule] = await Promise.all([
      import('/src/lib/persistence/appDataDb.js'),
      import('/src/lib/persistence/storageMigration.js'),
      import('/src/lib/persistence/storageFacade.js'),
    ]);
    const database = await databaseModule.openAppDataDb();
    const repository = databaseModule.createAppDataRepository(database);
    const ready = await repository.readMeta('migration');
    const workspaceRecords = await repository.listByGeneration('workspaceItems', ready.generationId);
    const snapshots = await repository.listByGeneration('snapshots', ready.generationId);
    const active = await migrationModule.activateReadyGeneration(repository);
    const facade = facadeModule.createStorageFacade({ repository, localStorageArea: localStorage });
    const rawWorkspace = await facade.getRaw('workspace_library_v1');
    repository.close();
    return {
      readyState: ready.state,
      activeState: active.state,
      workspaceCount: workspaceRecords.length,
      snapshotCount: snapshots.length,
      activeReadMatchesLocalStorage: rawWorkspace === localStorage.getItem('workspace_library_v1'),
    };
  });

  expect(afterReload).toEqual({
    readyState: 'ready',
    activeState: 'active',
    workspaceCount: 80,
    snapshotCount: 1,
    activeReadMatchesLocalStorage: true,
  });

  await page.reload();

  const persistedAfterSecondReload = await page.evaluate(async () => {
    const { openAppDataDb, createAppDataRepository } = await import('/src/lib/persistence/appDataDb.js');
    const database = await openAppDataDb();
    const repository = createAppDataRepository(database);
    const active = await repository.readMeta('activeGeneration');
    const source = await repository.readSourceEntry(active.generationId, 'workspace_library_v1');
    repository.close();
    return {
      activeState: active.state,
      generationId: active.generationId,
      sourceMatchesLocalStorage: source.rawValue === localStorage.getItem('workspace_library_v1'),
    };
  });

  expect(persistedAfterSecondReload).toEqual({
    activeState: 'active',
    generationId: 'isolated-generation-v1',
    sourceMatchesLocalStorage: true,
  });
});
