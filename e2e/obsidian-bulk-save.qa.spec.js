/**
 * QA: Obsidian bulk save — vault write + auto-open (not Downloads).
 * Run: npx playwright test e2e/obsidian-bulk-save.qa.spec.js
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';

async function openFirstVideoPanel(page) {
  const thumb = page.locator('main img[alt]').first();
  await expect(thumb).toBeVisible({ timeout: 15000 });
  await thumb.click({ force: true });
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
}

async function switchTab(page, label) {
  const tab = page.getByRole('tab', { name: new RegExp(label, 'i') }).first();
  if (await tab.count()) {
    await tab.click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

async function selectFirstCheckboxes(page, count = 3) {
  const boxes = page.locator('[role="dialog"] input[type="checkbox"]');
  const total = await boxes.count();
  let picked = 0;
  for (let i = 0; i < total && picked < count; i++) {
    const box = boxes.nth(i);
    if (!(await box.isVisible())) continue;
    if (await box.isChecked()) continue;
    await box.check({ force: true });
    picked++;
  }
  return picked;
}

async function runObsidianBulkSave(page) {
  const vaultWrites = [];
  const obsidianOpenLogs = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[ObsidianOpen]') || text.includes('FINAL OBSIDIAN URL')) {
      obsidianOpenLogs.push(text);
    }
  });

  await page.route('**/api/vault/write', async (route) => {
    const request = route.request();
    vaultWrites.push({ postData: request.postData() });
    const response = await route.fetch();
    const json = await response.json();
    vaultWrites[vaultWrites.length - 1].response = json;
    await route.fulfill({ response });
  });

  const footerObsidian = page.locator('[role="dialog"]').getByRole('button').filter({ hasText: /Obsidian/i }).last();
  await expect(footerObsidian).toBeVisible({ timeout: 10000 });
  await footerObsidian.click();

  await expect(page.getByRole('heading', { name: 'שמור ל-Obsidian' })).toBeVisible();

  const pathLines = page.locator('[role="dialog"]').locator('.font-mono .font-semibold, [role="dialog"] .font-mono span.font-semibold');
  const previewParts = [];
  const lineCount = await pathLines.count();
  for (let i = 0; i < lineCount; i++) {
    const t = await pathLines.nth(i).textContent();
    if (t) previewParts.push(String(t).trim());
  }
  const previewPath = previewParts.join('/').replace(/\/+/g, '/');

  const saveBtn = page.getByRole('button', { name: /שמור ל-Obsidian/i }).last();
  await saveBtn.click();
  await page.waitForTimeout(3000);

  return { vaultWrites, obsidianOpenLogs, previewPath };
}

test.describe('Obsidian bulk save QA', () => {
  test('Summary tab — vault write, not download', async ({ page }) => {
    await page.goto('/');
    await openFirstVideoPanel(page);
    await switchTab(page, 'סיכום');

    const selected = await selectFirstCheckboxes(page, 3);
    test.info().annotations.push({ type: 'selected', description: String(selected) });

    if (selected < 2) {
      test.skip(true, 'Not enough selectable summary rows in this video');
    }

    const { vaultWrites, obsidianOpenLogs, previewPath } = await runObsidianBulkSave(page);

    expect(vaultWrites.length, 'Should POST /api/vault/write (not browser download)').toBeGreaterThan(0);

    const body = JSON.parse(vaultWrites[0].postData || '{}');
    const resp = vaultWrites[0].response || {};

    expect(body.path, 'Request path must be set').toBeTruthy();
    expect(body.content, 'Markdown content must be sent').toContain('פריטים נבחרים');
    expect(resp.ok, 'Vault write should succeed').toBe(true);
    expect(resp.verified, 'Vault write should be verified').toBe(true);

    const savedPath = resp.savedPath || body.path;
    expect(savedPath, 'savedPath from API').toBeTruthy();

    if (previewPath) {
      const previewFile = previewPath.split('/').filter(Boolean).pop();
      expect(savedPath.endsWith(previewFile) || savedPath.includes(previewFile.replace('.md', '')),
        `Saved path "${savedPath}" should match preview "${previewPath}"`).toBe(true);
    }

    expect(resp.obsidianUri || obsidianOpenLogs.some((l) => l.includes('obsidian://')),
      'Obsidian open should be triggered').toBeTruthy();

    if (body.path && process.env.OBSIDIAN_VAULT_PATH) {
      const abs = `${process.env.OBSIDIAN_VAULT_PATH.replace(/\\/g, '/')}/${savedPath}`.replace(/\/+/g, '/');
      expect(fs.existsSync(abs), `File should exist in vault: ${abs}`).toBe(true);
    }

    test.info().annotations.push({ type: 'savedPath', description: savedPath });
    test.info().annotations.push({ type: 'previewPath', description: previewPath || 'n/a' });
    test.info().annotations.push({ type: 'obsidianUri', description: resp.obsidianUri || obsidianOpenLogs.join(' | ') });
  });

  test('Useful Knowledge tab — vault write path', async ({ page }) => {
    await page.goto('/');
    await openFirstVideoPanel(page);
    const opened = await switchTab(page, 'ידע שימושי') || await switchTab(page, 'Useful');
    if (!opened) test.skip(true, 'Useful Knowledge tab not available');

    const selected = await selectFirstCheckboxes(page, 2);
    if (selected < 2) test.skip(true, 'Not enough rows in Useful Knowledge');

    const { vaultWrites, previewPath } = await runObsidianBulkSave(page);
    expect(vaultWrites.length).toBeGreaterThan(0);
    const body = JSON.parse(vaultWrites[0].postData || '{}');
    expect(body.path).toBeTruthy();
    test.info().annotations.push({ type: 'tab', description: 'useful-knowledge' });
    test.info().annotations.push({ type: 'savedPath', description: body.path });
    test.info().annotations.push({ type: 'previewPath', description: previewPath || 'n/a' });
  });

  test('APP Builder tab — vault write path', async ({ page }) => {
    await page.goto('/');
    await openFirstVideoPanel(page);
    const opened = await switchTab(page, 'App Builder') || await switchTab(page, 'APP');
    if (!opened) test.skip(true, 'App Builder tab not available');

    const selected = await selectFirstCheckboxes(page, 2);
    if (selected < 2) test.skip(true, 'Not enough rows in App Builder');

    const { vaultWrites } = await runObsidianBulkSave(page);
    expect(vaultWrites.length).toBeGreaterThan(0);
    const body = JSON.parse(vaultWrites[0].postData || '{}');
    expect(body.path).toBeTruthy();
    test.info().annotations.push({ type: 'tab', description: 'app-builder' });
    test.info().annotations.push({ type: 'savedPath', description: body.path });
  });
});
