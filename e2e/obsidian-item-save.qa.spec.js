/**
 * QA: Per-item Obsidian save state (not video/file level).
 * Run: npx playwright test e2e/obsidian-item-save.qa.spec.js
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'e2e/screenshots/obsidian-item-qa';
const STORAGE_KEY = 'yt_obsidian_item_saves_v1';

async function openFirstVideoPanel(page) {
  const thumb = page.locator('main img[alt]').first();
  await expect(thumb).toBeVisible({ timeout: 20000 });
  await thumb.click({ force: true });
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20000 });
}

async function switchTab(page, label) {
  const tab = page.getByRole('tab', { name: new RegExp(label, 'i') }).first();
  if (await tab.count()) {
    await tab.click();
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

async function openContentTab(page) {
  return (
    (await switchTab(page, 'תובנות'))
    || (await switchTab(page, 'סיכום'))
    || (await switchTab(page, 'ידע שימושי'))
    || (await switchTab(page, 'Insights'))
  );
}

/** Rows with checkbox + quick-save in the video detail dialog */
function contentRows(page) {
  return page.locator('[role="dialog"] .group').filter({
    has: page.locator('[role="dialog"] input[type="checkbox"]'),
  });
}

async function readRowText(row) {
  const text = await row.locator('p, span, li, td').first().textContent();
  return String(text || '').trim();
}

async function clickRowObsidianQuickSave(row) {
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  const btn = row.locator('button[title*="Obsidian"], button[title*="obsidian"]').first();
  await expect(btn).toBeVisible({ timeout: 8000 });
  await btn.click();
}

async function confirmObsidianPicker(page) {
  const picker = page.getByRole('dialog').filter({ hasText: /Obsidian|שמור ל-Obsidian|נשמר ל-Obsidian/i });
  await expect(picker).toBeVisible({ timeout: 10000 });
  const action = picker.getByRole('button', { name: /שמור ל-Obsidian|פתח ב-Obsidian|שמור פריטים שלא נשמרו/i }).last();
  await action.click();
  await page.waitForTimeout(1500);
}

async function readItemSaveStore(page) {
  return page.evaluate((key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  }, STORAGE_KEY);
}

async function screenshot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

test.describe('Per-item Obsidian save tracking QA', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/write', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          verified: true,
          savedPath: body.path,
          obsidianUri: `obsidian://open?vault=qa-test&file=${encodeURIComponent(body.path || 'note.md')}`,
        }),
      });
    });
  });

  test('Scenario 1 — same item shows saved state on reopen', async ({ page }) => {
    await page.goto('/');
    await openFirstVideoPanel(page);
    const tabOk = await openContentTab(page);
    if (!tabOk) test.skip(true, 'No content tab with selectable rows');

    const rows = contentRows(page);
    const count = await rows.count();
    if (count < 1) test.skip(true, 'No selectable content rows');

    const row = rows.first();
    await clickRowObsidianQuickSave(row);
    await expect(page.getByRole('heading', { name: 'שמור ל-Obsidian' })).toBeVisible();
    await screenshot(page, 'scenario-1-before-save');

    let vaultWrites = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/vault/write') && req.method() === 'POST') vaultWrites++;
    });

    await confirmObsidianPicker(page);
    expect(vaultWrites, 'First save should write to vault').toBeGreaterThan(0);

    const store = await readItemSaveStore(page);
    const keys = Object.keys(store);
    expect(keys.length, 'Item store should have at least one entry').toBeGreaterThan(0);
    expect(keys.some((k) => k.startsWith('obsidian-item:') && k.includes('@')),
      `Key format should be obsidian-item:...@{path}, got: ${keys[0]}`).toBe(true);

    await clickRowObsidianQuickSave(row);
    await expect(page.getByRole('heading', { name: '✓ נשמר ל-Obsidian' })).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: 'פתח ב-Obsidian' }).last(),
    ).toBeVisible();
    await screenshot(page, 'scenario-1-saved-reopen');

    test.info().annotations.push({ type: 'storeKeys', description: keys.join(' | ') });
  });

  test('Scenario 2 — different item same path is NOT marked saved', async ({ page }) => {
    await page.goto('/');
    await openFirstVideoPanel(page);
    const tabOk = await openContentTab(page);
    if (!tabOk) test.skip(true, 'No content tab');

    const rows = contentRows(page);
    if (await rows.count() < 2) test.skip(true, 'Need at least 2 rows');

    const rowA = rows.nth(0);
    const rowB = rows.nth(1);

    await clickRowObsidianQuickSave(rowA);
    await confirmObsidianPicker(page);

    await clickRowObsidianQuickSave(rowB);
    await expect(page.getByRole('heading', { name: 'שמור ל-Obsidian' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '✓ נשמר ל-Obsidian' })).toHaveCount(0);

    const helper = page.getByText('קיים קובץ בנתיב הזה, אבל הפריט הזה עדיין לא נשמר.');
    if (await helper.count()) {
      await expect(helper).toBeVisible();
    }

    await expect(page.getByRole('button', { name: 'שמור ל-Obsidian' }).last()).toBeVisible();
    await screenshot(page, 'scenario-2-different-item-unsaved');
  });

  test('Scenario 3 — mixed bulk selection saves only unsaved items', async ({ page }) => {
    await page.goto('/');
    await openFirstVideoPanel(page);
    const tabOk = await openContentTab(page);
    if (!tabOk) test.skip(true, 'No content tab');

    const rows = contentRows(page);
    if (await rows.count() < 2) test.skip(true, 'Need at least 2 rows');

    // Save first item only via quick save
    await clickRowObsidianQuickSave(rows.nth(0));
    await confirmObsidianPicker(page);

    // Bulk-select first two rows
    const boxes = page.locator('[role="dialog"] input[type="checkbox"]');
    await boxes.nth(0).check({ force: true });
    await boxes.nth(1).check({ force: true });

    const footerObsidian = page.locator('[role="dialog"]').getByRole('button').filter({ hasText: /Obsidian/i }).last();
    await footerObsidian.click();

    await expect(page.getByRole('heading', { name: 'חלק מהפריטים כבר נשמרו' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('כבר נשמר:')).toBeVisible();
    await expect(page.getByText('עדיין לא נשמר:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'שמור פריטים שלא נשמרו' }).last()).toBeVisible();
    await screenshot(page, 'scenario-3-mixed-selection');

    let postBody = null;
    page.once('request', async (req) => {
      if (req.url().includes('/api/vault/write') && req.method() === 'POST') {
        postBody = req.postData();
      }
    });

    await page.getByRole('button', { name: 'שמור פריטים שלא נשמרו' }).last().click();
    await page.waitForTimeout(2000);

    expect(postBody, 'Bulk save should POST to vault').toBeTruthy();
    const content = JSON.parse(postBody).content || '';
    const rowBText = await readRowText(rows.nth(1));
    expect(content).toContain(rowBText.slice(0, 20));
    await screenshot(page, 'scenario-3-after-partial-save');
  });

  test('Scenario 4 — duplicate save prevented (open, no second write)', async ({ page }) => {
    await page.goto('/');
    await openFirstVideoPanel(page);
    const tabOk = await openContentTab(page);
    if (!tabOk) test.skip(true, 'No content tab');

    const rows = contentRows(page);
    if (await rows.count() < 1) test.skip(true, 'No rows');

    const row = rows.first();
    await clickRowObsidianQuickSave(row);
    await confirmObsidianPicker(page);

    let writeCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/vault/write') && req.method() === 'POST') writeCount++;
    });

    await clickRowObsidianQuickSave(row);
    await expect(page.getByRole('button', { name: 'פתח ב-Obsidian' }).last()).toBeVisible();

    const before = writeCount;
    await page.getByRole('button', { name: 'פתח ב-Obsidian' }).last().click();
    await page.waitForTimeout(1000);

    expect(writeCount, 'Re-save should not POST again').toBe(before);
    await screenshot(page, 'scenario-4-no-duplicate-write');
  });

  test('Save key format — item-level, not video-level', async ({ page }) => {
    await page.goto('/');
    await openFirstVideoPanel(page);
    await openContentTab(page);

    const rows = contentRows(page);
    if (await rows.count() < 1) test.skip(true, 'No rows');

    await clickRowObsidianQuickSave(rows.first());
    await confirmObsidianPicker(page);

    const store = await readItemSaveStore(page);
    const key = Object.keys(store)[0] || '';

    expect(key).toMatch(/^obsidian-item:/);
    expect(key).toContain('@');
    expect(key).not.toMatch(/^video:/);
    expect(key).not.toContain('obsidianSavedStatus');

    const entry = store[key];
    expect(entry.videoId).toBeTruthy();
    expect(entry.tabKey).toBeTruthy();
    expect(entry.destinationPath).toBeTruthy();
    expect(entry.textPreview).toBeTruthy();

    test.info().annotations.push({ type: 'dedupeKey', description: key });
  });
});
