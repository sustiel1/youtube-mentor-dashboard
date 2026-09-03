import { expect, test } from '@playwright/test';

// TRADINGBRAIN-WORKSPACE-TILES-PLACEMENT — Part 1 (DEFECT 1 re-diagnosis with
// realistic seeded data) + Part 2 (new "כל הסרטונים" / "סרטון אחרון" scope
// tiles). Seeds ~70 synthetic items across many videos via the inert
// /ytmdb-origin-export.html route + IndexedDB (mirrors the seeding recipe
// already used by workspace-indexeddb-integration.qa.spec.js), matching the
// app's real storage mode (VITE_YTMDB_STORAGE_MODE=indexedDB, see
// .env.development.local) — a plain-localStorage seed would silently miss
// the real read path. This is a fresh, isolated Playwright browser profile;
// it never touches the developer's real browser data.

const SOURCE_TABS = ['specialized', 'summary', 'insights', 'chapters', 'useful-knowledge', 'topics-subtopics', 'app-builder'];
const HEADINGS = {
  specialized: 'תוכן ייעודי',
  summary: 'סיכום',
  insights: 'תובנות',
  chapters: 'פרקים',
  'useful-knowledge': 'ידע שימושי',
  'topics-subtopics': 'נושאים ותתי־נושאים',
  'app-builder': 'APP',
};

function buildSeedItems() {
  const items = [];
  const videoCount = 12;
  let n = 0;
  for (let v = 0; v < videoCount; v += 1) {
    const videoId = `seedvid${String(v).padStart(2, '0')}xy`;
    const itemsForVideo = 5 + (v % 3); // 5-7 items per video → ~70 total
    for (let k = 0; k < itemsForVideo; k += 1) {
      const sourceTabId = SOURCE_TABS[n % SOURCE_TABS.length];
      // Later-built videos get later timestamps → video index 11 (last) is
      // deterministically the most-recently-saved video.
      const dayOffset = v;
      items.push({
        id: `wl-seed-${String(n).padStart(3, '0')}`,
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoTitle: `סרטון בדיקה מספר ${v + 1}`,
        channelName: `ערוץ ${(v % 4) + 1}`,
        sourceTabId,
        sourceTab: sourceTabId,
        sourceHeading: HEADINGS[sourceTabId],
        itemType: 'snippet',
        identityPayload: { text: `תוכן שמור מספר ${n}`, marker: n },
        savedAt: new Date(Date.UTC(2026, 7, 1 + dayOffset, 8, k, 0)).toISOString(),
      });
      n += 1;
    }
  }
  return items;
}

test('workspace collection tiles react to real seeded data (~70 items, many videos)', async ({ page }) => {
  // Two pre-existing, unrelated dev-only noise sources are filtered out here
  // (confirmed present even with zero app changes): the Vite HMR client
  // connects over `ws://localhost:...` while CSP only allows `127.0.0.1:*`
  // (a dev-server host-vs-CSP mismatch, not a Workspace bug), and a CSP
  // inline-script warning from the same HMR client injection. Anything else
  // still fails the test.
  const isKnownDevNoise = text => (
    /Content Security Policy/.test(text)
    && (/localhost:\d+\/\?token=/.test(text) || /Executing inline script/.test(text))
  );
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && !isKnownDevNoise(message.text())) consoleErrors.push(`console.error: ${message.text()}`);
  });

  const seedItems = buildSeedItems();
  expect(seedItems.length).toBeGreaterThanOrEqual(70);

  // ── Seed via the inert export route + real IndexedDB migration path ──
  await page.goto('/ytmdb-origin-export.html');
  const seedResult = await page.evaluate(async (items) => {
    const [{ openAppDataDb, createAppDataRepository }, { createWorkspacePersistence }] = await Promise.all([
      import('/src/lib/persistence/appDataDb.js'),
      import('/src/lib/persistence/workspacePersistence.js'),
    ]);
    localStorage.setItem('workspace_library_v1', JSON.stringify(items));
    const database = await openAppDataDb();
    const repository = createAppDataRepository(database);
    const persistence = createWorkspacePersistence({
      mode: 'indexedDB',
      localStorageArea: localStorage,
      repositoryFactory: async () => repository,
    });
    const readBack = await persistence.readItems();
    repository.close();
    return { readBackCount: readBack.length };
  }, seedItems);
  expect(seedResult.readBackCount).toBe(seedItems.length);

  // ── Load the real page, then hard-reload (matches the reported symptom) ──
  await page.goto('/workspace-library');
  await expect(page.getByRole('heading', { name: 'Workspace Library' })).toBeVisible();
  await expect(page.getByText(`${seedItems.length} פריטים שמורים`)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Workspace Library' })).toBeVisible();
  await expect(page.getByText(`${seedItems.length} פריטים שמורים`)).toBeVisible();

  const matchingSection = page.locator('section[aria-labelledby="workspace-matching-videos-heading"]');
  const initialSectionText = await matchingSection.innerText();

  // ── PART 1 / criterion (a)+(b)+(c): click an existing content-type tile ──
  const specializedTab = page.getByRole('tab', { name: /הצג תוכן ייעודי/ });
  await expect(specializedTab).toBeVisible();
  await expect(specializedTab).toHaveAttribute('aria-selected', 'false');
  await specializedTab.click();

  // (a) active/selected visual state
  await expect(specializedTab).toHaveAttribute('aria-selected', 'true');
  // (b) URL
  await expect(page).toHaveURL(/collection=specialized/);
  // (c) content below actually changes: source-video group cards swap to the
  // collection-scoped renderer (data-workspace-source-video), and the
  // "X סרטונים תואמים" summary text changes from the unfiltered baseline.
  await expect(page.locator('[data-workspace-source-video]').first()).toBeVisible();
  const afterClickSectionText = await matchingSection.innerText();
  expect(afterClickSectionText).not.toBe(initialSectionText);

  // Deselect: click the same tile again → restores the default view.
  await specializedTab.click();
  await expect(specializedTab).toHaveAttribute('aria-selected', 'false');
  await expect(page).not.toHaveURL(/collection=specialized/);
  await expect(async () => {
    expect(await matchingSection.innerText()).toBe(initialSectionText);
  }).toPass({ timeout: 5000 });

  // ── PART 2: new scope tiles exist, are first in RTL order, real counts ──
  const allVideosTab = page.getByRole('tab', { name: /הצג כל הסרטונים/ });
  const recentVideoTab = page.getByRole('tab', { name: /הצג סרטון אחרון/ });
  await expect(allVideosTab).toBeVisible();
  await expect(recentVideoTab).toBeVisible();
  await expect(allVideosTab).toHaveAttribute('aria-selected', 'true'); // default view = all-videos scope
  await expect(recentVideoTab).toHaveAttribute('aria-selected', 'false');

  const tabOrder = await page.locator('[role="tablist"] [role="tab"]').allTextContents();
  expect(tabOrder[0]).toContain('כל הסרטונים');
  expect(tabOrder[1]).toContain('סרטון אחרון');

  // Counts are derived, not hardcoded: "כל הסרטונים" must show the real total.
  await expect(allVideosTab).toContainText(`${seedItems.length} שמירות`);

  // ── click "סרטון אחרון" → scopes the view to the most-recently-saved video ──
  await recentVideoTab.click();
  await expect(page).toHaveURL(/video=seedvid11xy/);
  await expect(page.getByText('תוכן שנשמר מהסרטון', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'סרטון בדיקה מספר 12' })).toBeVisible();

  // Return to the default view via the existing "חזרה לכל הסרטונים" control.
  await page.getByRole('button', { name: 'חזרה לכל הסרטונים' }).click();
  await expect(page).not.toHaveURL(/video=/);
  await expect(allVideosTab).toHaveAttribute('aria-selected', 'true');
  await expect(recentVideoTab).toHaveAttribute('aria-selected', 'false');

  expect(consoleErrors, `console/page errors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
});
