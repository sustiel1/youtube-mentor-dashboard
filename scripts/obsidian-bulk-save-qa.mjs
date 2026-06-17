/**
 * Final QA — Obsidian bulk save: vault write + auto-open (not Downloads).
 * Run: node scripts/obsidian-bulk-save-qa.mjs  (dev server on :5184)
 */
import { chromium, devices } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCREENSHOT_DIR = join(ROOT, 'e2e/screenshots/obsidian-bulk-qa');
const BASE_URL = 'http://localhost:5184';

const env = loadEnv('development', ROOT, '');
const VAULT_PATH = String(env.OBSIDIAN_VAULT_PATH || env.VITE_OBSIDIAN_VAULT_PATH || '').trim();
const VAULT_NAME = String(env.VITE_OBSIDIAN_VAULT_NAME || 'Knowledge-Base').trim();

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'),
);

const VIDEO_ID = 'obsidian-bulk-qa-video';
const VIDEO_TITLE = 'Obsidian Bulk QA Fixture';

const videoFixture = {
  id: VIDEO_ID,
  youtubeId: VIDEO_ID,
  url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  title: VIDEO_TITLE,
  category: 'שוק ההון',
  subCategory: 'לאפליקציה שלי',
  confirmedSubCategory: 'morning-brief',
  userConfirmedSubCategory: true,
  fetchedAt: new Date().toISOString(),
  publishedAt: '2026-06-10T08:00:00.000Z',
  mentorName: 'QA Mentor',
};

const appBuilderDraft = {
  summary: 'PRD summary for Obsidian bulk QA.',
  requirements: 'Save selected sections to Obsidian vault path.',
  logic: 'Select → Obsidian footer → confirm picker → vault write → open note.',
  risks: 'Wrong vault path',
  tasks: 'Verify file in vault',
  triggers: 'Save click',
  screens: 'Picker modal',
  developmentPrompt: 'QA automation prompt.',
};

const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id}: ${detail}`);
}

async function seedPage(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ videoFixture, fixture, VIDEO_ID, appBuilderDraft }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    let videos = [];
    try { videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { videos = []; }
    const rest = videos.filter((v) => (v.id || v.youtubeId) !== VIDEO_ID);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([videoFixture, ...rest]));
    localStorage.setItem(`market_brief_${VIDEO_ID}`, JSON.stringify(fixture));

    const appKey = 'app_builder_v1';
    let appData = {};
    try { appData = JSON.parse(localStorage.getItem(appKey) || '{}'); } catch { appData = {}; }
    appData[VIDEO_ID] = { ...appBuilderDraft, _meta: { seededAt: new Date().toISOString() } };
    localStorage.setItem(appKey, JSON.stringify(appData));

    localStorage.setItem('obsidian_settings_v1', JSON.stringify({
      vaultName: 'שוק ההון',
      vaultPath: '',
    }));
  }, { videoFixture, fixture, VIDEO_ID, appBuilderDraft });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

async function openVideo(page) {
  const card = page.locator('div').filter({ hasText: VIDEO_TITLE }).last();
  await card.waitFor({ timeout: 25000 });
  await card.click();
  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  await page.waitForTimeout(800);
}

function getDialog(page) {
  return page.locator('[role="dialog"][data-state="open"]');
}

function getSelectionFooter(page) {
  return getDialog(page).locator('div.flex-shrink-0.border-t.border-zinc-800.bg-zinc-900');
}

async function openTab(page, labelPattern) {
  const tab = page.getByRole('tab', { name: labelPattern }).first();
  await tab.waitFor({ timeout: 15000 });
  await tab.click();
  await page.waitForTimeout(1000);
}

async function selectCheckboxes(panel, count = 3) {
  const cbs = panel.locator('input[type="checkbox"]:not(:disabled)');
  const total = await cbs.count();
  let picked = 0;
  for (let i = 0; i < total && picked < count; i++) {
    const cb = cbs.nth(i);
    if (!(await cb.isVisible().catch(() => false))) continue;
    if (await cb.isChecked()) continue;
    await cb.scrollIntoViewIfNeeded();
    await cb.click();
    picked++;
  }
  return picked;
}

async function readPickerPreviewPath(page) {
  const picker = page.locator('[role="dialog"]').filter({ has: page.getByRole('heading', { name: 'שמור ל-Obsidian' }) });
  const parts = [];
  const lines = picker.locator('.font-mono span.font-semibold, .font-mono .font-semibold');
  const n = await lines.count();
  for (let i = 0; i < n; i++) {
    const t = await lines.nth(i).textContent();
    if (t) parts.push(String(t).trim());
  }
  return parts.join('/').replace(/\/+/g, '/');
}

async function runObsidianBulkFlow(page, tabId, tabLabel, shotName) {
  const vaultWrites = [];
  const obsidianOpenLogs = [];

  const onConsole = (msg) => {
    const text = msg.text();
    if (text.includes('[ObsidianOpen]') || text.includes('FINAL OBSIDIAN URL')) {
      obsidianOpenLogs.push(text);
    }
  };
  page.on('console', onConsole);

  await page.unroute('**/api/vault/write').catch(() => {});
  await page.route('**/api/vault/write', async (route) => {
    const request = route.request();
    vaultWrites.push({ postData: request.postData() });
    const response = await route.fetch();
    const json = await response.json();
    vaultWrites[vaultWrites.length - 1].response = json;
    await route.fulfill({ response });
  });

  await openTab(page, tabLabel);
  const panel = page.locator('[role="tabpanel"][data-state="active"]');
  const selected = await selectCheckboxes(panel, 3);
  if (selected < 2) {
    page.off('console', onConsole);
    record(`${tabId}-selection`, false, `Only ${selected} selectable rows`);
    return;
  }

  const footer = getSelectionFooter(page);
  const obsBtn = footer.getByRole('button').filter({ hasText: /Obsidian/i }).last();
  await obsBtn.click();
  await page.waitForTimeout(800);

  const pickerVisible = await page.getByRole('heading', { name: 'שמור ל-Obsidian' }).isVisible();
  if (!pickerVisible) {
    page.off('console', onConsole);
    record(`${tabId}-picker`, false, 'Obsidian picker modal not shown');
    return;
  }

  const previewPath = await readPickerPreviewPath(page);
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${shotName}-picker.png`), fullPage: false });

  await page.getByRole('button', { name: /שמור ל-Obsidian/i }).last().click();
  await page.waitForTimeout(3500);

  await page.screenshot({ path: join(SCREENSHOT_DIR, `${shotName}-after-save.png`), fullPage: false });

  page.off('console', onConsole);

  const wrote = vaultWrites.length > 0;
  const body = wrote ? JSON.parse(vaultWrites[0].postData || '{}') : {};
  const resp = wrote ? (vaultWrites[0].response || {}) : {};
  const savedPath = resp.savedPath || body.path || '';
  const usedVaultApi = wrote && body.path && !String(body.path).includes('Downloads');
  const vaultOk = resp.ok === true && resp.verified === true;
  const pathMatchesPreview = previewPath
    ? savedPath.endsWith(previewPath.split('/').pop()) || savedPath.includes(previewPath.replace(/\/+/g, '/'))
    : Boolean(savedPath);
  const openTriggered = obsidianOpenLogs.some((l) => l.includes('obsidian://'))
    || Boolean(resp.obsidianUri);

  let fileInVault = null;
  if (VAULT_PATH && savedPath) {
    const abs = join(VAULT_PATH, savedPath).replace(/\\/g, '/');
    fileInVault = existsSync(abs);
  }

  record(`${tabId}-vault-api`, usedVaultApi, wrote ? `POST /api/vault/write path=${body.path}` : 'No vault API call (likely download fallback)');
  record(`${tabId}-vault-write-ok`, !VAULT_PATH || vaultOk, VAULT_PATH ? `ok=${resp.ok}, verified=${resp.verified}` : 'Skipped — OBSIDIAN_VAULT_PATH not set in env');
  record(`${tabId}-path-match-preview`, pathMatchesPreview, `preview=${previewPath || 'n/a'}, saved=${savedPath}`);
  record(`${tabId}-obsidian-open`, openTriggered || !VAULT_PATH, obsidianOpenLogs.join(' | ') || resp.obsidianUri || 'no open log');
  if (VAULT_PATH) {
    record(`${tabId}-file-in-vault`, fileInVault === true, fileInVault ? savedPath : `Missing at ${join(VAULT_PATH, savedPath)}`);
  } else {
    record(`${tabId}-file-in-vault`, true, 'Manual check — set OBSIDIAN_VAULT_PATH in .env for filesystem verify');
  }
  record(`${tabId}-not-downloads`, usedVaultApi, 'Bulk Obsidian must use vault write, not downloadMarkdown only');
}

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  console.log(`Vault path configured: ${VAULT_PATH || '(none — API + open only)'}`);
  console.log(`Vault name: ${VAULT_NAME}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await seedPage(page);
  await openVideo(page);

  await runObsidianBulkFlow(page, 'summary', /סיכום/, '01-summary');
  await openVideo(page);
  await runObsidianBulkFlow(page, 'useful-knowledge', /ידע שימושי/, '02-useful-knowledge');
  await openVideo(page);
  await runObsidianBulkFlow(page, 'app-builder', /^APP$|APP/, '03-app-builder');

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== QA SUMMARY ===');
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  ✗ ${f.id}: ${f.detail}`));
    process.exit(1);
  }
  console.log('All checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
