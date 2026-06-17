/**
 * QA — per-row Obsidian opens full routing modal + vault write.
 * Run: node scripts/per-row-obsidian-qa.mjs  (dev server on :5184)
 */
import { chromium, devices } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHOT_DIR = join(ROOT, 'e2e/screenshots/per-row-obsidian-qa');
const BASE_URL = 'http://localhost:5184';

const env = loadEnv('development', ROOT, '');
const VAULT_PATH = String(env.OBSIDIAN_VAULT_PATH || env.VITE_OBSIDIAN_VAULT_PATH || 'C:\\Users\\11\\Desktop\\Workspace\\Knowledge-Base').trim();

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'));
const VIDEO_ID = 'per-row-obsidian-qa';
const VIDEO_TITLE = 'Per Row Obsidian QA Fixture';

const videoFixture = {
  id: VIDEO_ID,
  youtubeId: VIDEO_ID,
  url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  title: VIDEO_TITLE,
  category: 'שוק ההון',
  subCategory: 'רשימות מעקב',
  confirmedSubCategory: 'morning-brief',
  userConfirmedSubCategory: true,
  fetchedAt: new Date().toISOString(),
  publishedAt: '2026-06-10T08:00:00.000Z',
};

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } })).newPage();

  const vaultWrites = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/vault/write') && req.method() === 'POST') {
      vaultWrites.push({ postData: req.postData() });
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/vault/write') && res.request().method() === 'POST') {
      const json = await res.json().catch(() => ({}));
      if (vaultWrites.length) vaultWrites[vaultWrites.length - 1].response = json;
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ videoFixture, fixture, VIDEO_ID }) => {
    localStorage.setItem('yt_mentor_videos_v2', JSON.stringify([videoFixture]));
    localStorage.setItem(`market_brief_${VIDEO_ID}`, JSON.stringify(fixture));
    localStorage.removeItem('obsidian_settings_v1');
  }, { videoFixture, fixture, VIDEO_ID });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.locator('div').filter({ hasText: VIDEO_TITLE }).last().click();
  await page.waitForSelector('[role="tablist"]');
  await page.getByRole('tab', { name: /ידע שימושי/ }).first().click();
  await page.waitForTimeout(800);

  // Before: row Obsidian icon (unsaved)
  await page.screenshot({ path: join(SHOT_DIR, '01-before-row-obsidian-icon.png'), fullPage: false });

  const rowObsBtn = page.locator('[role="tabpanel"][data-state="active"]')
    .getByRole('button', { name: /שמור ל-Obsidian/i }).first();
  await rowObsBtn.click();
  await page.waitForTimeout(800);

  const pickerOpen = await page.getByRole('heading', { name: 'שמור ל-Obsidian' }).isVisible();
  console.log(`[${pickerOpen ? 'PASS' : 'FAIL'}] row-opens-obsidian-modal: ${pickerOpen}`);
  await page.screenshot({ path: join(SHOT_DIR, '02-row-obsidian-modal.png'), fullPage: false });

  await page.getByRole('button', { name: /שמור ל-Obsidian/i }).last().click();
  await page.waitForTimeout(3500);

  const wrote = vaultWrites.length > 0;
  const resp = wrote ? (vaultWrites[0].response || {}) : {};
  const savedPath = resp.savedPath || '';
  const fileOk = savedPath && existsSync(join(VAULT_PATH, savedPath));
  const toastOk = await page.locator('[data-sonner-toast]').filter({ hasText: /נשמר ל-Obsidian/i }).first().isVisible().catch(() => false);

  console.log(`[${wrote ? 'PASS' : 'FAIL'}] row-vault-api: POST /api/vault/write`);
  console.log(`[${resp.ok && resp.verified ? 'PASS' : 'FAIL'}] row-vault-write-ok: saved=${savedPath}`);
  console.log(`[${fileOk ? 'PASS' : 'FAIL'}] row-file-on-disk: ${join(VAULT_PATH, savedPath)}`);
  console.log(`[${toastOk ? 'PASS' : 'FAIL'}] row-success-toast`);
  await page.screenshot({ path: join(SHOT_DIR, '03-after-row-save-toast.png'), fullPage: false });

  await browser.close();

  if (!pickerOpen || !wrote || !resp.ok || !fileOk) process.exit(1);
  console.log('All per-row Obsidian checks passed.');
}

main().catch((err) => { console.error(err); process.exit(1); });
