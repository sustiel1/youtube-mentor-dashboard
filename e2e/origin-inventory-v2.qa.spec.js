import { expect, test } from '@playwright/test';

const ORIGINS = ['http://localhost:5184', 'http://127.0.0.1:5184'];

async function seedDisposableIndexedDbWithIndex(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('yt_mentor_app_data_v1', 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('meta', { keyPath: 'key' });
      const transcripts = database.createObjectStore('transcripts', {
        keyPath: ['generationId', 'id'],
      });
      transcripts.createIndex('generationId', 'generationId');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  }));
}

for (const origin of ORIGINS) {
  test(`inventory remains inert after explicit click on ${origin}`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${origin}/ytmdb-origin-inventory-v2.html`);
      await expect(page.locator('[data-inventory-status]')).toContainText('ממתין');
      await expect(page.locator('[data-inventory-output]')).toHaveText('');
      await seedDisposableIndexedDbWithIndex(page);

      const requestsAfterClick = [];
      const downloadsAfterClick = [];
      page.on('request', (request) => requestsAfterClick.push(request.url()));
      page.on('download', (download) => downloadsAfterClick.push(download.suggestedFilename()));
      await page.locator('[data-run-inventory]').click();
      await expect(page.locator('[data-inventory-status]')).toHaveAttribute('data-state', 'success');

      const result = JSON.parse(await page.locator('[data-inventory-output]').textContent());
      expect(result.origin).toBe(origin);
      expect(result.proof).toEqual({
        localStorageUnchanged: true,
        indexedDbUnchanged: true,
        pointerSnapshotUnchanged: true,
        readwriteTransactions: 0,
        upgradeAttempts: 0,
        storageWrites: 0,
        networkRequests: 0,
      });
      expect(result.indexedDb.applicationDatabase.version).toBe(2);
      expect(result.indexedDb.applicationDatabase.stores.map((store) => store.name)).toEqual([
        'meta',
        'transcripts',
      ]);
      expect(result.indexedDb.applicationDatabase.stores.find((store) => store.name === 'transcripts').indexes).toEqual([
        { name: 'generationId', keyPath: 'generationId', multiEntry: false, unique: false },
      ]);
      expect(result.localStorage.keyCount).toBe(0);
      expect(requestsAfterClick).toEqual([]);
      expect(downloadsAfterClick).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test('shows complete safe details for DOMException code 11', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        databases: async () => {
          throw new DOMException(
            'A request was placed against a transaction which is currently not active.',
            'InvalidStateError',
          );
        },
      },
    });
  });
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:5184/ytmdb-origin-inventory-v2.html');
    const requestsAfterClick = [];
    const downloadsAfterClick = [];
    page.on('request', (request) => requestsAfterClick.push(request.url()));
    page.on('download', (download) => downloadsAfterClick.push(download.suggestedFilename()));
    await page.locator('[data-run-inventory]').click();

    await expect(page.locator('[data-inventory-status]')).toHaveAttribute('data-state', 'error');
    await expect(page.locator('[data-inventory-status]')).toContainText('InvalidStateError');
    await expect(page.locator('[data-inventory-error]')).toBeVisible();
    await expect(page.locator('[data-inventory-error-name]')).toHaveText('InvalidStateError');
    await expect(page.locator('[data-inventory-error-code]')).toHaveText('11');
    await expect(page.locator('[data-inventory-error-message]')).toHaveText(
      'A request was placed against a transaction which is currently not active.',
    );
    await expect(page.locator('[data-inventory-error-operation]')).toHaveText('collect-origin-inventory');
    await expect(page.locator('[data-inventory-error-safe-stopping-point]')).toHaveText(
      'stopped-before-any-storage-write',
    );
    expect(requestsAfterClick).toEqual([]);
    expect(downloadsAfterClick).toEqual([]);
  } finally {
    await context.close();
  }
});
