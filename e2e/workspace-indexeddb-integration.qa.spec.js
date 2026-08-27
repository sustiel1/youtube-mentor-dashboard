import { expect, test } from '@playwright/test';

test('Workspace IndexedDB reader/writer survives reload and a second page in an isolated context', async ({ page }) => {
  await page.goto('/ytmdb-origin-export.html');

  const firstPass = await page.evaluate(async () => {
    const [{ openAppDataDb, createAppDataRepository }, { createWorkspacePersistence }, integrity] = await Promise.all([
      import('/src/lib/persistence/appDataDb.js'),
      import('/src/lib/persistence/workspacePersistence.js'),
      import('/src/lib/persistence/storageIntegrity.js'),
    ]);
    const items = Array.from({ length: 80 }, (_, index) => ({
      id: `isolated-${String(index).padStart(3, '0')}`,
      videoId: `video-${index % 8}`,
      itemType: index === 7 ? 'structured-snapshot' : 'snippet',
      notes: `synthetic-${index}`,
      structuredSnapshot: index === 7
        ? { version: 0, stocksTable: [], sentiment: [{ legacy: true }] }
        : undefined,
    }));
    const originalRaw = JSON.stringify(items);
    localStorage.setItem('workspace_library_v1', originalRaw);
    localStorage.setItem('workspace_topics_v1', '[]');
    localStorage.setItem('base44_access_token', 'synthetic-secret');
    localStorage.setItem('unrelated_key', 'synthetic-unknown');

    const database = await openAppDataDb();
    const repository = createAppDataRepository(database);
    const persistence = createWorkspacePersistence({
      mode: 'indexedDB',
      localStorageArea: localStorage,
      repositoryFactory: async () => repository,
    });
    const fallback = await persistence.readItems();
    const saved = await persistence.saveItem({ id: 'isolated-new', notes: 'new' });
    const active = await repository.readMeta('activeWorkspaceGeneration');
    const source = await repository.readSourceEntry(active.generationId, 'workspace_library_v1');
    const projections = await repository.listByGeneration('workspaceItems', active.generationId);
    const snapshots = await repository.listByGeneration('snapshots', active.generationId);
    const secret = await repository.readSourceEntry(active.generationId, 'base44_access_token');
    const unknown = await repository.readSourceEntry(active.generationId, 'unrelated_key');
    repository.close();

    return {
      originalRaw,
      fallbackCount: fallback.length,
      savedOk: saved.ok,
      savedCount: saved.persistedItems.length,
      generationId: active.generationId,
      sourceCount: JSON.parse(source.rawValue).length,
      projectionCount: projections.length,
      snapshotCount: snapshots.length,
      localStorageUnchanged: localStorage.getItem('workspace_library_v1') === originalRaw,
      secretExcluded: secret === null,
      unknownExcluded: unknown === null,
      idChecksum: integrity.checksumWorkspaceItemIds(saved.persistedItems),
      payloadChecksum: integrity.checksumWorkspacePayloadsExcludingTopicAssignment(saved.persistedItems),
    };
  });

  expect(firstPass.fallbackCount).toBe(80);
  expect(firstPass.savedOk).toBe(true);
  expect(firstPass.savedCount).toBe(81);
  expect(firstPass.sourceCount).toBe(81);
  expect(firstPass.projectionCount).toBe(81);
  expect(firstPass.snapshotCount).toBe(1);
  expect(firstPass.localStorageUnchanged).toBe(true);
  expect(firstPass.secretExcluded).toBe(true);
  expect(firstPass.unknownExcluded).toBe(true);

  await page.reload();

  const afterReload = await page.evaluate(async (firstGenerationId) => {
    const [{ openAppDataDb, createAppDataRepository }, { createWorkspacePersistence }, integrity] = await Promise.all([
      import('/src/lib/persistence/appDataDb.js'),
      import('/src/lib/persistence/workspacePersistence.js'),
      import('/src/lib/persistence/storageIntegrity.js'),
    ]);
    const database = await openAppDataDb();
    const repository = createAppDataRepository(database);
    const persistence = createWorkspacePersistence({
      mode: 'indexedDB',
      localStorageArea: localStorage,
      repositoryFactory: async () => repository,
    });
    const items = await persistence.readItems();
    const updated = await persistence.updateItem('isolated-new', { notes: 'updated-after-reload' });
    const active = await repository.readMeta('activeWorkspaceGeneration');
    const oldSource = await repository.readSourceEntry(firstGenerationId, 'workspace_library_v1');
    repository.close();
    return {
      readCount: items.length,
      updatedOk: updated.ok,
      updatedValue: updated.persistedItems.find(item => item.id === 'isolated-new')?.notes,
      generationId: active.generationId,
      oldGenerationRetained: oldSource !== null,
      idChecksum: integrity.checksumWorkspaceItemIds(items),
      payloadChecksum: integrity.checksumWorkspacePayloadsExcludingTopicAssignment(items),
    };
  }, firstPass.generationId);

  expect(afterReload.readCount).toBe(81);
  expect(afterReload.updatedOk).toBe(true);
  expect(afterReload.updatedValue).toBe('updated-after-reload');
  expect(afterReload.generationId).not.toBe(firstPass.generationId);
  expect(afterReload.oldGenerationRetained).toBe(true);
  expect(afterReload.idChecksum).toBe(firstPass.idChecksum);
  expect(afterReload.payloadChecksum).toBe(firstPass.payloadChecksum);

  const secondPage = await page.context().newPage();
  await secondPage.goto('/ytmdb-origin-export.html');
  const secondPageRead = await secondPage.evaluate(async () => {
    const [{ openAppDataDb, createAppDataRepository }, { createWorkspacePersistence }] = await Promise.all([
      import('/src/lib/persistence/appDataDb.js'),
      import('/src/lib/persistence/workspacePersistence.js'),
    ]);
    const database = await openAppDataDb();
    const repository = createAppDataRepository(database);
    const persistence = createWorkspacePersistence({
      mode: 'indexedDB',
      localStorageArea: localStorage,
      repositoryFactory: async () => repository,
    });
    const items = await persistence.readItems();
    repository.close();
    return {
      count: items.length,
      updatedValue: items.find(item => item.id === 'isolated-new')?.notes,
    };
  });

  expect(secondPageRead).toEqual({
    count: 81,
    updatedValue: 'updated-after-reload',
  });
});
