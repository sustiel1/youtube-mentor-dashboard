import { test, expect } from '@playwright/test';

const SIDECAR_PREFIX = 'yt_mentor_row_timestamps_v1::';
const REAL_NAVIGATION_VIDEO_ID = '9su_tZfRYrI';
const PLACEHOLDER_VIDEO_IDS = new Set(['fixtureVid1', 'test-video']);

function isRealYouTubeNavigationId(videoId) {
  return typeof videoId === 'string'
    && /^[A-Za-z0-9_-]{11}$/.test(videoId)
    && !PLACEHOLDER_VIDEO_IDS.has(videoId);
}

async function sidecarEntryCount(page) {
  return page.evaluate((prefix) => {
    let count = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      if (localStorage.key(index)?.startsWith(prefix)) count += 1;
    }
    return count;
  }, SIDECAR_PREFIX);
}

async function openConfirmation(page) {
  await page.getByTestId('row-timestamp-trigger').click();
  await expect(page.getByTestId('row-timestamp-confirm')).toBeVisible();
}

async function verifyRealYouTubeClick(page, seconds) {
  const expectedUrl = `https://www.youtube.com/watch?v=${REAL_NAVIGATION_VIDEO_ID}&t=${seconds}s`;
  const link = page.locator(`a[href="${expectedUrl}"]`);
  await expect(link).toHaveCount(1);
  const startedAt = Date.now();
  const [youtubePage, navigationRequest] = await Promise.all([
    page.waitForEvent('popup'),
    page.context().waitForEvent('request', (request) => request.url() === expectedUrl),
    link.click(),
  ]);
  await youtubePage.waitForLoadState('domcontentloaded');
  expect(navigationRequest.url()).toBe(expectedUrl);
  if (youtubePage.url() !== 'chrome-error://chromewebdata/') {
    expect(youtubePage.url()).toBe(expectedUrl);
    await expect(youtubePage).toHaveTitle(/לייב פתיחה לתאריך 21\.8\.26/);
  }
  console.log(`real YouTube click ${seconds}s: ${Date.now() - startedAt}ms`);
  await youtubePage.close();
}

test.describe('Opt-in row timestamps (synthetic, no paid API)', () => {
  test('blocks duplicate requests, approves only gated rows and survives reload', async ({ page }) => {
    const generationRequests = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.pathname === '/api/generate-row-timestamps'
        || url.hostname === 'api.anthropic.com'
        || url.hostname === 'generativelanguage.googleapis.com'
      ) generationRequests.push(request.url());
    });
    await page.goto('/row-timestamp-ondemand-qa.html?persist=1');
    expect(await page.evaluate(() => window.__rowTimestampFixtureCalls || 0)).toBe(0);
    expect(await page.evaluate(() => window.__rowTimestampTranscriptCalls || 0)).toBe(0);
    expect(generationRequests).toEqual([]);
    await expect(page.getByTestId('row-timestamp-trigger')).toHaveText('🕒 צור זמנים לשורות');
    await expect(page.locator('[data-shared-content-heading] [data-testid="row-timestamp-generator"]')).toHaveCount(1);
    await openConfirmation(page);

    await page.getByTestId('row-timestamp-confirm-yes').evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(page.getByTestId('row-timestamp-preview')).toBeVisible();
    expect(await page.evaluate(() => window.__rowTimestampFixtureCalls)).toBe(1);
    expect(await page.evaluate(() => Object.keys(window.__rowTimestampLastPayload).sort())).toEqual([
      'durationSeconds',
      'rows',
      'transcript',
    ]);
    expect(await page.evaluate(() => window.__rowTimestampLastPayload.rows.every(
      (row) => Object.keys(row).sort().join(',') === 'rowPath,text',
    ))).toBe(true);

    await expect(page.getByTestId('row-timestamp-preview-item')).toHaveCount(3);
    await page.getByTestId('row-timestamp-save').click();
    await expect(page.locator('[data-static-video-time="estimated"]')).toHaveCount(3);
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('a[data-static-video-time="estimated"]'))
      .map((link) => ({ href: link.href, target: link.target, rel: link.rel }))))
      .toEqual([
        { href: `https://www.youtube.com/watch?v=${REAL_NAVIGATION_VIDEO_ID}&t=120s`, target: '_blank', rel: 'noopener noreferrer' },
        { href: `https://www.youtube.com/watch?v=${REAL_NAVIGATION_VIDEO_ID}&t=300s`, target: '_blank', rel: 'noopener noreferrer' },
        { href: `https://www.youtube.com/watch?v=${REAL_NAVIGATION_VIDEO_ID}&t=45s`, target: '_blank', rel: 'noopener noreferrer' },
      ]);
    expect(generationRequests).toEqual([]);
    expect(await sidecarEntryCount(page)).toBe(3);

    await page.reload();
    await expect(page.getByTestId('row-timestamp-trigger')).toHaveText('צור מחדש');
    await expect(page.locator('[data-static-video-time="estimated"]')).toHaveCount(3);
    expect(await sidecarEntryCount(page)).toBe(3);

    await verifyRealYouTubeClick(page, 45);
    await verifyRealYouTubeClick(page, 120);
    await verifyRealYouTubeClick(page, 300);
  });

  test('real YouTube navigation QA rejects placeholder or malformed video IDs', () => {
    expect(isRealYouTubeNavigationId(REAL_NAVIGATION_VIDEO_ID)).toBe(true);
    for (const invalidId of ['fixtureVid1', 'test-video', '', 'short', 'contains spaces', null]) {
      expect(isRealYouTubeNavigationId(invalidId)).toBe(false);
    }
  });

  test('separates record and YouTube identities and exposes existing results without regeneration', async ({ page, context }) => {
    const forbiddenRequests = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.pathname === '/api/youtube-transcript'
        || url.pathname === '/api/generate-row-timestamps'
        || url.hostname === 'api.anthropic.com'
        || url.hostname === 'generativelanguage.googleapis.com'
        || url.hostname.endsWith('.base44.app')
      ) forbiddenRequests.push(request.url());
    });
    await context.route('https://www.youtube.com/**', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<title>isolated YouTube navigation fixture</title>',
    }));

    await page.goto('/row-timestamp-ondemand-qa.html?seed=existing');
    await expect(page.getByTestId('row-timestamp-trigger')).toHaveText('צור מחדש');
    await expect(page.getByTestId('row-timestamp-association-summary')).toHaveText('שויכו 1 מתוך 6 · נותרו 5');
    await expect(page.getByTestId('row-timestamp-results-trigger')).toHaveText('הצג זמנים · 1/6');
    expect(await page.evaluate(() => window.__rowTimestampFixtureCalls || 0)).toBe(0);
    expect(await page.evaluate(() => window.__rowTimestampTranscriptCalls || 0)).toBe(0);
    expect(forbiddenRequests).toEqual([]);

    const resultsTrigger = page.getByTestId('row-timestamp-results-trigger');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(resultsTrigger).toBeFocused();
    await page.keyboard.press('Enter');
    const dialog = page.getByTestId('row-timestamp-results-dialog');
    await expect(dialog).toBeVisible();
    const closeButton = page.getByTestId('row-timestamp-results-close');
    await expect(closeButton).toBeFocused();
    expect(await closeButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.boxShadow !== 'none' || (style.outlineStyle !== 'none' && style.outlineWidth !== '0px');
    })).toBe(true);
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(closeButton).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(resultsTrigger).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('row-timestamp-result-row')).toHaveCount(6);
    await expect(page.locator('[data-row-timestamp-status="mapped"]')).toHaveCount(1);
    await expect(page.locator('[data-row-timestamp-status="stale"]')).toHaveCount(1);
    await expect(page.locator('[data-row-timestamp-status="unmatched"]')).toHaveCount(4);
    await expect(page.locator('[data-row-timestamp-status="stale"]')).toContainText('הטקסט השתנה');
    await expect(page.locator('[data-row-timestamp-status="stale"] a')).toHaveCount(0);
    await expect(page.locator('[data-row-timestamp-status="unmatched"]').first()).toContainText('לא נמצא זמן אמין');
    await expect(page.locator('[data-row-timestamp-status="unmatched"] a')).toHaveCount(0);
    await expect(page.getByTestId('row-timestamp-result-row').filter({ hasText: 'למה זה חשוב' })).toHaveCount(1);

    const resultLink = page.getByTestId('row-timestamp-result-link');
    await expect(resultLink).toHaveAttribute('href', 'https://www.youtube.com/watch?v=9su_tZfRYrI&t=320s');
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      resultLink.click(),
    ]);
    await popup.waitForLoadState('domcontentloaded');
    await popup.close();
    expect(forbiddenRequests).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(resultsTrigger).toBeFocused();

    for (const tab of ['summary', 'insights', 'useful-knowledge', 'specialized']) {
      await page.getByTestId(`qa-tab-${tab}`).click();
      await expect(page.getByTestId('row-timestamp-trigger')).toHaveCount(1);
      await expect(page.getByTestId('row-timestamp-results-trigger')).toHaveCount(1);
    }
    expect(forbiddenRequests).toEqual([]);

    await page.reload();
    await expect(page.getByTestId('row-timestamp-results-trigger')).toHaveText('הצג זמנים · 1/6');
    await expect(page.locator('[data-row-timestamp-mapped="true"]')).toHaveCount(1);
    expect(forbiddenRequests).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('row-timestamp-results-trigger').click();
    await expect(page.getByTestId('row-timestamp-results-dialog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.getByTestId('row-timestamp-results-dialog').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    expect(await page.getByTestId('row-timestamp-results-dialog').evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    expect(forbiddenRequests).toEqual([]);
  });

  test('eligibility supports GEMS and saved analysis, stays single and never auto-generates', async ({ page }) => {
    const generationRequests = [];
    page.on('request', (request) => {
      if (/generate-row-timestamps|api\.anthropic\.com|generativelanguage\.googleapis\.com/.test(request.url())) {
        generationRequests.push(request.url());
      }
    });

    for (const source of ['gems', 'saved-analysis']) {
      await page.goto(`/row-timestamp-ondemand-qa.html?source=${source}`);
      await expect(page.getByTestId('row-timestamp-generator')).toHaveCount(1);
      await expect(page.getByTestId('row-timestamp-trigger')).toBeEnabled();
      await expect(page.locator('[data-shared-content-heading] [data-testid="row-timestamp-generator"]')).toHaveCount(1);
      expect(await page.evaluate(() => window.__rowTimestampFixtureCalls || 0)).toBe(0);
      expect(await page.evaluate(() => window.__rowTimestampTranscriptCalls || 0)).toBe(0);
      for (const tab of ['summary', 'insights', 'chapters', 'useful-knowledge', 'specialized']) {
        await page.getByTestId(`qa-tab-${tab}`).click();
        await expect(page.getByTestId('qa-active-tab')).toHaveText(tab);
        await expect(page.getByTestId('row-timestamp-generator')).toHaveCount(1);
      }
      expect(await page.evaluate(() => window.__rowTimestampFixtureCalls || 0)).toBe(0);
      expect(await page.evaluate(() => window.__rowTimestampTranscriptCalls || 0)).toBe(0);
      await page.reload();
      await expect(page.getByTestId('row-timestamp-generator')).toHaveCount(1);
      expect(await page.evaluate(() => window.__rowTimestampFixtureCalls || 0)).toBe(0);
      expect(await page.evaluate(() => window.__rowTimestampTranscriptCalls || 0)).toBe(0);
    }

    await page.goto('/row-timestamp-ondemand-qa.html?source=no-rows');
    await expect(page.getByTestId('row-timestamp-generator')).toHaveCount(0);

    await page.goto('/row-timestamp-ondemand-qa.html?source=gems&transcript=missing');
    await expect(page.getByTestId('row-timestamp-generator')).toHaveCount(1);
    await expect(page.getByTestId('row-timestamp-trigger')).toBeEnabled();
    expect(await page.evaluate(() => window.__rowTimestampTranscriptCalls || 0)).toBe(0);
    await openConfirmation(page);
    await page.getByTestId('row-timestamp-confirm-yes').click();
    await expect(page.getByTestId('row-timestamp-trigger')).toHaveText('טוען תמלול…');
    await expect(page.getByTestId('row-timestamp-preview')).toBeVisible();
    expect(await page.evaluate(() => window.__rowTimestampTranscriptCalls)).toBe(1);
    expect(await page.evaluate(() => window.__rowTimestampTranscriptYoutubeId)).toBe(REAL_NAVIGATION_VIDEO_ID);
    expect(generationRequests).toEqual([]);
  });

  test('transcript failures do not generate, cancellation is retryable, and mobile focus is visible', async ({ page }) => {
    for (const transcriptMode of ['404', 'invalid']) {
      await page.goto(`/row-timestamp-ondemand-qa.html?source=gems&transcript=${transcriptMode}`);
      await openConfirmation(page);
      await page.getByTestId('row-timestamp-confirm-yes').click();
      await expect(page.getByTestId('row-timestamp-error')).toBeVisible();
      await expect(page.getByTestId('row-timestamp-retry')).toHaveText('נסה שוב');
      expect(await page.evaluate(() => window.__rowTimestampFixtureCalls || 0)).toBe(0);
    }

    await page.goto('/row-timestamp-ondemand-qa.html?source=gems&transcript=missing');
    await openConfirmation(page);
    await page.getByTestId('row-timestamp-confirm-yes').click();
    await expect(page.getByTestId('row-timestamp-cancel-operation')).toBeVisible();
    await page.getByTestId('row-timestamp-cancel-operation').click();
    await expect(page.getByTestId('row-timestamp-error')).toContainText('בוטלה');
    expect(await page.evaluate(() => window.__rowTimestampFixtureCalls || 0)).toBe(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/row-timestamp-ondemand-qa.html?source=gems');
    const header = page.locator('[data-shared-content-heading]');
    await expect(header.locator('[data-testid="row-timestamp-generator"]')).toHaveCount(1);
    expect(await header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const trigger = page.getByTestId('row-timestamp-trigger');
    await trigger.focus();
    expect(await trigger.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.boxShadow !== 'none' || (style.outlineStyle !== 'none' && style.outlineWidth !== '0px');
    })).toBe(true);
  });

  test('no-evidence and failure states are retryable and persist nothing', async ({ page }) => {
    await page.goto('/row-timestamp-ondemand-qa.html?mode=no-evidence&persist=1');
    await openConfirmation(page);
    await page.getByTestId('row-timestamp-confirm-yes').click();
    await expect(page.getByTestId('row-timestamp-no-evidence')).toHaveText('לא נמצאו זמנים אמינים מספיק');
    await expect(page.getByTestId('row-timestamp-no-evidence-retry')).toHaveText('נסה שוב');
    expect(await sidecarEntryCount(page)).toBe(0);

    await page.goto('/row-timestamp-ondemand-qa.html?mode=failure&persist=1');
    await openConfirmation(page);
    await page.getByTestId('row-timestamp-confirm-yes').click();
    await expect(page.getByTestId('row-timestamp-error')).toContainText('כשל בדיקה צפוי');
    await expect(page.getByTestId('row-timestamp-retry')).toHaveText('נסה שוב');
    expect(await sidecarEntryCount(page)).toBe(0);
  });

  test('local route rejects safe invalid requests before any provider call', async ({ request }) => {
    const getResponse = await request.get('/api/generate-row-timestamps');
    expect(getResponse.status()).toBe(405);
    expect(await getResponse.json()).toMatchObject({ error: 'METHOD_NOT_ALLOWED' });

    const invalidPost = await request.post('/api/generate-row-timestamps', { data: {} });
    expect(invalidPost.status()).toBe(400);
    expect(await invalidPost.json()).toMatchObject({ error: 'INVALID_INPUT' });
  });
});
