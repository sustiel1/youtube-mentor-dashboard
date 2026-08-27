import { expect, test } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5184';
const MODULE_PATH = '/src/lib/persistence/transcriptLocalStorageStore.js';
const TARGET_VIDEO_ID = 'o632g7k52c4';

async function openModuleDocument(page) {
  const response = await page.goto(`${BASE_URL}${MODULE_PATH}`, { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
}

async function readTarget(page) {
  return page.evaluate(async ({ modulePath, videoId }) => {
    const store = await import(modulePath);
    const transcript = store.readTranscriptLocalCache(videoId);
    const cache = JSON.parse(localStorage.getItem(store.TRANSCRIPT_LOCAL_STORAGE_KEY) || '{}');
    return {
      transcript,
      cacheEntryCount: Object.keys(cache).length,
      localStorageKeyCount: localStorage.length,
    };
  }, { modulePath: MODULE_PATH, videoId: TARGET_VIDEO_ID });
}

test('127 localStorage transcript survives close/reopen and full reload without duplicates', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openModuleDocument(page);

  const diagnostics = await page.evaluate(async () => {
    const transcriptService = await import('/src/services/youtubeTranscript.js');
    return transcriptService.getTranscriptStorageDiagnostics();
  });
  expect(diagnostics).toEqual({
    backend: 'localStorage',
    origin: BASE_URL,
    requestedBackend: 'indexedDB',
    policy: 'authorized-transcript-localstorage-origin',
    fallback: false,
  });

  const firstWrite = await page.evaluate(async ({ modulePath, videoId }) => {
    const store = await import(modulePath);
    const payload = {
      body: 'א'.repeat(8615),
      lang: 'iw',
      segments: Array.from({ length: 237 }, (_, index) => ({
        text: `מקטע ${index + 1}`,
        startSeconds: index * 3,
        durationSeconds: 3,
      })),
      fetchedAt: '2026-08-27T08:15:00.000Z',
    };
    const first = store.writeTranscriptLocalCache(videoId, payload);
    const repeated = store.writeTranscriptLocalCache(videoId, payload);
    return { first, repeated };
  }, { modulePath: MODULE_PATH, videoId: TARGET_VIDEO_ID });

  expect(firstWrite.first.ok).toBe(true);
  expect(firstWrite.first.storage).toBe('localStorage');
  expect(firstWrite.repeated.entryCount).toBe(1);

  const beforeClose = await readTarget(page);
  expect(beforeClose.transcript.lang).toBe('iw');
  expect(beforeClose.transcript.segments).toHaveLength(237);
  expect(beforeClose.transcript.body).toHaveLength(8615);
  expect(beforeClose.cacheEntryCount).toBe(1);
  expect(beforeClose.localStorageKeyCount).toBe(1);

  await page.close();
  const reopenedPage = await context.newPage();
  await openModuleDocument(reopenedPage);
  const afterReopen = await readTarget(reopenedPage);
  expect(afterReopen).toEqual(beforeClose);

  await reopenedPage.reload({ waitUntil: 'domcontentloaded' });
  const afterReload = await readTarget(reopenedPage);
  expect(afterReload).toEqual(beforeClose);

  await context.close();
});
