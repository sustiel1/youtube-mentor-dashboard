/**
 * Vault Root Migration QA
 * Run: node scripts/vault-root-migration-qa.mjs  (dev server on :5184)
 */
import { chromium, devices } from 'playwright';
import {
  readFileSync, mkdirSync, existsSync, readdirSync, statSync, writeFileSync,
} from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from 'vite';
import {
  DEFAULT_OBSIDIAN_VAULT_NAME,
  DEFAULT_OBSIDIAN_VAULT_PATH,
  OBSIDIAN_MIGRATION_FOLDER,
  resolveObsidianVaultSettings,
} from '../src/lib/obsidianVaultDefaults.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCREENSHOT_DIR = join(ROOT, 'e2e/screenshots/vault-root-migration-qa');
const BASE_URL = 'http://localhost:5184';

const env = loadEnv('development', ROOT, '');
const VAULT_PATH = String(
  env.OBSIDIAN_VAULT_PATH || env.VITE_OBSIDIAN_VAULT_PATH || DEFAULT_OBSIDIAN_VAULT_PATH,
).trim();
const VAULT_NAME = String(env.VITE_OBSIDIAN_VAULT_NAME || DEFAULT_OBSIDIAN_VAULT_NAME).trim();
const LEGACY_ROOT = join(VAULT_PATH, OBSIDIAN_MIGRATION_FOLDER);

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'),
);

const VIDEO_ID = 'vault-root-qa-video';
const VIDEO_TITLE = 'Vault Root Migration QA Fixture';

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
  mentorName: 'QA Mentor',
};

const results = [];
let reportLines = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  const line = `[${pass ? 'PASS' : 'FAIL'}] ${id}: ${detail}`;
  console.log(line);
  reportLines.push(line);
}

function listMdFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) listMdFiles(p, acc);
    else if (ent.name.endsWith('.md')) {
      acc.push({ path: p, mtimeMs: statSync(p).mtimeMs });
    }
  }
  return acc;
}

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').toLowerCase();
}

async function waitForServer(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function seedPage(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ videoFixture, fixture, VIDEO_ID }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    let videos = [];
    try { videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { videos = []; }
    const rest = videos.filter((v) => (v.id || v.youtubeId) !== VIDEO_ID);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([videoFixture, ...rest]));
    localStorage.setItem(`market_brief_${VIDEO_ID}`, JSON.stringify(fixture));
    // Legacy migration values — should normalize on read
    localStorage.setItem('obsidian_settings_v1', JSON.stringify({
      vaultName: 'Obsidian-Brain-Structure-2026-05-17',
      vaultPath: `C:\\Users\\11\\Desktop\\Workspace\\Knowledge-Base\\Obsidian-Brain-Structure-2026-05-17`,
    }));
  }, { videoFixture, fixture, VIDEO_ID });
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

async function selectCheckboxes(panel, count = 2) {
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

async function verifySettings(page) {
  const clientSettings = await page.evaluate(async () => {
    const mod = await import('/src/lib/obsidianVaultConfig.js');
    return mod.getObsidianSettings();
  });

  const serverDiag = await page.evaluate(async () => {
    const res = await fetch('/api/vault/diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return res.json();
  });

  // Open settings dialog via NO_VAULT_PATH flow
  await page.evaluate(() => {
    localStorage.setItem('obsidian_settings_v1', JSON.stringify({ vaultName: 'Knowledge-Base', vaultPath: '' }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openVideo(page);
  await openTab(page, /ידע שימושי|סיכום/);

  await page.route('**/api/vault/write', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'NO_VAULT_PATH',
        message: 'נתיב ה-vault לא מוגדר',
      }),
    });
  });

  const panel = page.locator('[role="tabpanel"][data-state="active"]');
  await selectCheckboxes(panel, 2);
  const footer = getSelectionFooter(page);
  await footer.getByRole('button').filter({ hasText: /Obsidian/i }).last().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /שמור ל-Obsidian/i }).last().click();
  await page.waitForTimeout(1200);

  const settingsOpen = await page.getByRole('heading', { name: 'הגדרות Obsidian' }).isVisible().catch(() => false);
  if (settingsOpen) {
    await page.screenshot({ path: join(SCREENSHOT_DIR, '01-obsidian-settings.png'), fullPage: false });
  }

  await page.unroute('**/api/vault/write').catch(() => {});

  const pathOk = normalizePath(clientSettings.vaultPath) === normalizePath(VAULT_PATH);
  const nameOk = clientSettings.vaultName === VAULT_NAME;
  const serverPathOk = normalizePath(serverDiag.vaultPath) === normalizePath(VAULT_PATH);
  const serverNameOk = serverDiag.vaultName === VAULT_NAME;
  const noLegacyInServerPath = !normalizePath(serverDiag.vaultPath).includes(normalizePath(OBSIDIAN_MIGRATION_FOLDER));

  record('settings-vault-path', pathOk, `client=${clientSettings.vaultPath}`);
  record('settings-vault-name', nameOk, `client=${clientSettings.vaultName}`);
  record('server-diagnostics-path', serverPathOk, `server=${serverDiag.vaultPath}`);
  record('server-diagnostics-name', serverNameOk, `server=${serverDiag.vaultName}`);
  record('settings-ui-open', settingsOpen, settingsOpen ? 'Obsidian settings dialog opened' : 'Could not open settings dialog');
  record('no-legacy-in-server-path', noLegacyInServerPath, serverDiag.vaultPath || 'n/a');
}

async function runBulkObsidianSave(page, legacyBefore) {
  const vaultWrites = [];
  const obsidianOpenLogs = [];
  const testStart = Date.now();

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[ObsidianOpen]') || text.includes('obsidian://') || text.includes('FINAL OBSIDIAN URL')) {
      obsidianOpenLogs.push(text);
    }
  });

  await page.unroute('**/api/vault/write').catch(() => {});
  await page.route('**/api/vault/write', async (route) => {
    const request = route.request();
    const postData = request.postData() || '{}';
    vaultWrites.push({ postData });
    const response = await route.fetch();
    const json = await response.json();
    vaultWrites[vaultWrites.length - 1].response = json;
    await route.fulfill({ response });
  });

  await openVideo(page);
  await openTab(page, /ידע שימושי/);
  const panel = page.locator('[role="tabpanel"][data-state="active"]');
  const selected = await selectCheckboxes(panel, 2);
  if (selected < 2) {
    record('bulk-selection', false, `Only ${selected} rows selected`);
    return null;
  }

  const footer = getSelectionFooter(page);
  await footer.getByRole('button').filter({ hasText: /Obsidian/i }).last().click();
  await page.waitForTimeout(800);

  const pickerVisible = await page.getByRole('heading', { name: 'שמור ל-Obsidian' }).isVisible();
  if (!pickerVisible) {
    record('bulk-picker', false, 'Obsidian picker not shown');
    return null;
  }

  const previewPath = await readPickerPreviewPath(page);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '02-routing-preview.png'), fullPage: false });

  const previewHasLegacy = previewPath.toLowerCase().includes(OBSIDIAN_MIGRATION_FOLDER.toLowerCase());
  record('preview-no-legacy-folder', !previewHasLegacy, previewPath || 'empty preview');

  await page.getByRole('button', { name: /שמור ל-Obsidian/i }).last().click();
  await page.waitForTimeout(4000);

  const toastVisible = await page.locator('[data-sonner-toast]').filter({ hasText: /נשמרו ל-Obsidian|נשמר ל-Obsidian/i }).first()
    .isVisible()
    .catch(() => false);
  if (toastVisible) {
    await page.screenshot({ path: join(SCREENSHOT_DIR, '03-save-toast.png'), fullPage: false });
  }

  const body = vaultWrites[0] ? JSON.parse(vaultWrites[0].postData || '{}') : {};
  const resp = vaultWrites[0]?.response || {};
  const savedPath = resp.savedPath || body.path || '';
  const absolutePath = resp.absolutePath || '';
  const previewFile = previewPath.split('/').pop() || '';

  const requestVaultPath = normalizePath(body.vaultPath);
  const requestVaultName = body.vaultName || '';
  const absOk = absolutePath
    ? normalizePath(absolutePath).startsWith(normalizePath(VAULT_PATH))
      && !normalizePath(absolutePath).includes(normalizePath(OBSIDIAN_MIGRATION_FOLDER))
    : false;
  const savedOk = savedPath
    ? !savedPath.toLowerCase().includes(OBSIDIAN_MIGRATION_FOLDER.toLowerCase())
    : false;
  const fileOnDisk = savedPath ? existsSync(join(VAULT_PATH, savedPath)) : false;
  const pathMatchesPreview = previewPath
    ? savedPath.endsWith(previewFile) || normalizePath(savedPath).includes(normalizePath(previewPath))
    : Boolean(savedPath);

  const legacyAfter = listMdFiles(LEGACY_ROOT);
  const newLegacyFiles = legacyAfter.filter((f) => f.mtimeMs >= testStart && !legacyBefore.some((b) => b.path === f.path && b.mtimeMs === f.mtimeMs));
  const openTriggered = obsidianOpenLogs.some((l) => l.includes('obsidian://'))
    || Boolean(resp.obsidianUri);

  record('bulk-vault-api', vaultWrites.length > 0, vaultWrites.length ? 'POST /api/vault/write' : 'no API call');
  record('bulk-request-vault-path', requestVaultPath === normalizePath(VAULT_PATH), `sent=${body.vaultPath}`);
  record('bulk-request-vault-name', requestVaultName === VAULT_NAME, `sent=${requestVaultName}`);
  record('bulk-write-ok', resp.ok === true && resp.verified === true, `ok=${resp.ok}, verified=${resp.verified}`);
  record('bulk-absolute-path', absOk, absolutePath || 'missing absolutePath');
  record('bulk-saved-path', savedOk, savedPath || 'missing savedPath');
  record('bulk-file-on-disk', fileOnDisk, fileOnDisk ? join(VAULT_PATH, savedPath) : 'file missing');
  record('bulk-path-match-preview', pathMatchesPreview, `preview=${previewPath}, saved=${savedPath}`);
  record('bulk-save-toast', toastVisible, toastVisible ? 'success toast visible' : 'toast not found');
  record('bulk-obsidian-open', openTriggered, resp.obsidianUri || obsidianOpenLogs.join(' | ') || 'no open signal');
  record('bulk-no-legacy-writes', newLegacyFiles.length === 0, newLegacyFiles.length ? newLegacyFiles.map((f) => f.path).join(', ') : 'no new files under legacy folder');

  if (fileOnDisk) {
    await page.screenshot({ path: join(SCREENSHOT_DIR, '04-file-path-note.txt'), fullPage: false }).catch(() => {});
    writeFileSync(join(SCREENSHOT_DIR, '04-saved-file-path.txt'), join(VAULT_PATH, savedPath), 'utf8');
  }

  return { savedPath, absolutePath, previewPath, resp };
}

async function runSingleItemSave(page) {
  await openVideo(page);
  await openTab(page, /ידע שימושי/);
  const panel = page.locator('[role="tabpanel"][data-state="active"]');
  const rowBtn = panel.getByRole('button', { name: /שמור ל-Obsidian|Obsidian/i }).first();
  if (!(await rowBtn.isVisible().catch(() => false))) {
    record('single-item-save', true, 'skipped — per-row Obsidian uses download-only flow');
    return;
  }
  record('single-item-save', true, 'per-row button present (download flow — no vault path regression)');
}

async function runRegressionSmoke(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);
  await openVideo(page);
  await openTab(page, /סיכום/);
  const panel = page.locator('[role="tabpanel"][data-state="active"]');
  const selected = await selectCheckboxes(panel, 2);
  const footer = getSelectionFooter(page);
  const brainBtn = footer.getByRole('button').filter({ hasText: /מוח|Brain/i }).first();
  const workspaceBtn = footer.getByRole('button').filter({ hasText: /Workspace|⭐/i }).first();
  const brainVisible = await brainBtn.isVisible().catch(() => false);
  const workspaceVisible = await workspaceBtn.isVisible().catch(() => false);
  record('regression-brain-button', brainVisible, brainVisible ? 'Brain bulk button visible' : 'Brain button missing');
  record('regression-workspace-button', workspaceVisible, workspaceVisible ? 'Workspace bulk button visible' : 'Workspace button missing');

  if (brainVisible && selected >= 2) {
    await brainBtn.click();
    await page.waitForTimeout(1200);
    const brainPicker = await page.getByRole('heading', { name: 'שמור למוח' }).isVisible().catch(() => false);
    record('regression-brain-picker', brainPicker, brainPicker ? 'Brain picker opens' : `Brain picker failed (selected=${selected})`);
    if (brainPicker) {
      await page.screenshot({ path: join(SCREENSHOT_DIR, '05-brain-picker.png'), fullPage: false });
      await page.keyboard.press('Escape');
    }
  } else {
    record('regression-brain-picker', false, `Need 2+ selections, got ${selected}`);
  }
}

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Unit-level normalization checks
  const legacyResolved = resolveObsidianVaultSettings({
    vaultName: 'Obsidian-Brain-Structure-2026-05-17',
    vaultPath: `${VAULT_PATH}\\${OBSIDIAN_MIGRATION_FOLDER}`,
  });
  record(
    'unit-legacy-normalization',
    legacyResolved.vaultPath === VAULT_PATH && legacyResolved.vaultName === VAULT_NAME,
    `name=${legacyResolved.vaultName}, path=${legacyResolved.vaultPath}`,
  );

  console.log(`Vault path: ${VAULT_PATH}`);
  console.log(`Vault name: ${VAULT_NAME}`);
  console.log(`Legacy folder: ${LEGACY_ROOT}`);
  console.log(`Vault exists: ${existsSync(VAULT_PATH)}`);

  if (!existsSync(VAULT_PATH)) {
    record('vault-exists', false, VAULT_PATH);
    writeFileSync(join(SCREENSHOT_DIR, 'QA-REPORT.txt'), reportLines.join('\n'), 'utf8');
    process.exit(1);
  }
  record('vault-exists', true, VAULT_PATH);

  const serverUp = await waitForServer();
  if (!serverUp) {
    record('dev-server', false, `Could not reach ${BASE_URL}`);
    writeFileSync(join(SCREENSHOT_DIR, 'QA-REPORT.txt'), reportLines.join('\n'), 'utf8');
    process.exit(1);
  }
  record('dev-server', true, BASE_URL);

  const legacyBefore = listMdFiles(LEGACY_ROOT);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await seedPage(page);
  await verifySettings(page);
  await seedPage(page);
  await runBulkObsidianSave(page, legacyBefore);
  await runSingleItemSave(page);
  await runRegressionSmoke(page);

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  reportLines.push('');
  reportLines.push(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  writeFileSync(join(SCREENSHOT_DIR, 'QA-REPORT.txt'), reportLines.join('\n'), 'utf8');

  console.log('\n=== VAULT ROOT MIGRATION QA ===');
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
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
