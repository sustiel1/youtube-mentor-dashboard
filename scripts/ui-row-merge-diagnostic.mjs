/**
 * UI row-save merge diagnostic — real Playwright flow, disk reads, network capture.
 * Run: node scripts/ui-row-merge-diagnostic.mjs  (dev server on :5184)
 */
import { chromium, devices } from 'playwright';
import { readFileSync, mkdirSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5184';
const TEMP_VAULT = join(ROOT, 'e2e', '.tmp-ui-row-merge-vault');
const REL_PATH = 'QA/ui-row-merge-diag/test-note.md';
const VIDEO_ID = 'ui-row-merge-diag';
const ROW_A = 'UI-MERGE-DIAG row A — check economic calendar before open';
const ROW_B = 'UI-MERGE-DIAG row B — review overnight futures gap';

const env = loadEnv('development', ROOT, '');

function readDisk(vaultPath, relPath) {
  const abs = join(vaultPath, ...relPath.split('/'));
  if (!existsSync(abs)) return { abs, content: null };
  return { abs, content: readFileSync(abs, 'utf-8') };
}

async function main() {
  mkdirSync(TEMP_VAULT, { recursive: true });
  mkdirSync(join(TEMP_VAULT, 'QA', 'ui-row-merge-diag'), { recursive: true });
  const absFile = join(TEMP_VAULT, ...REL_PATH.split('/'));
  if (existsSync(absFile)) unlinkSync(absFile);

  const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'));
  fixture.universalTabs.usefulKnowledge = {
    ...fixture.universalTabs.usefulKnowledge,
    actionChecklist: [ROW_A, ROW_B],
  };

  const videoFixture = {
    id: VIDEO_ID,
    youtubeId: VIDEO_ID,
    url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    title: 'UI Row Merge Diagnostic',
    category: 'שוק ההון',
    subCategory: 'רשימות מעקב',
    confirmedSubCategory: 'morning-brief',
    userConfirmedSubCategory: true,
    fetchedAt: new Date().toISOString(),
    publishedAt: '2026-06-10T08:00:00.000Z',
  };

  const networkLog = [];

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } })).newPage();

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/vault/read') || url.includes('/api/vault/write')) {
      networkLog.push({
        type: 'request',
        method: req.method(),
        url,
        postData: req.postData() || null,
      });
    }
  });
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/vault/read') || url.includes('/api/vault/write')) {
      const json = await res.json().catch(() => ({}));
      networkLog.push({
        type: 'response',
        status: res.status(),
        url,
        body: json,
      });
    }
  });
  page.on('pageerror', (err) => console.error('[PAGE ERROR]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[CONSOLE]', msg.text());
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(({ videoFixture, fixture, VIDEO_ID, TEMP_VAULT }) => {
    localStorage.setItem('yt_mentor_videos_v2', JSON.stringify([videoFixture]));
    localStorage.setItem(`market_brief_${VIDEO_ID}`, JSON.stringify(fixture));
    localStorage.setItem('obsidian_settings_v1', JSON.stringify({
      vaultName: 'Knowledge-Base',
      vaultPath: TEMP_VAULT.replace(/\\/g, '/'),
    }));
    localStorage.removeItem('yt_obsidian_item_saves_v1');
  }, { videoFixture, fixture, VIDEO_ID, TEMP_VAULT });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Open video panel
  await page.locator('div').filter({ hasText: videoFixture.title }).last().click();
  await page.waitForSelector('[role="tablist"]', { timeout: 15000 });
  await page.getByRole('tab', { name: /ידע שימושי/ }).first().click();
  await page.waitForTimeout(1000);

  async function saveRowContaining(text) {
    const row = page.locator('[role="tabpanel"][data-state="active"]').locator('.group').filter({ hasText: text }).first();
    await row.scrollIntoViewIfNeeded();
    const obsBtn = row.getByRole('button', { name: /שמור ל-Obsidian/i });
    await obsBtn.click();
    await page.waitForTimeout(800);
    const picker = page.getByRole('dialog').filter({ hasText: /Obsidian|שמור ל-Obsidian/i });
    await picker.waitFor({ state: 'visible', timeout: 10000 });
    // Fix filename for consistent savePath
    const filenameInput = picker.locator('input').filter({ has: page.locator('[type="text"]') }).first();
    if (await filenameInput.count()) {
      await filenameInput.fill('test-note');
    }
    const saveBtn = picker.getByRole('button', { name: /אשר ושמור ל-Obsidian|שמור ל-Obsidian/i }).last();
    await saveBtn.click();
    await page.waitForTimeout(3500);
  }

  console.log('\n=== STEP 1: Save row A via UI ===');
  const netBeforeA = networkLog.length;
  await saveRowContaining(ROW_A);
  const netAfterA = networkLog.slice(netBeforeA);
  const diskAfterA = readDisk(TEMP_VAULT, REL_PATH);

  console.log('\n--- Network (save A) ---');
  for (const e of netAfterA) {
    if (e.type === 'request' && e.postData) {
      try {
        const body = JSON.parse(e.postData);
        console.log(`REQ ${e.url.split('/api')[1]} mode=${body.mode || '(none)'} path=${body.path} mergeItems=${body.mergeItems?.length ?? 0}`);
        if (body.mergeItems?.[0]) console.log('  mergeItem[0].text:', String(body.mergeItems[0].text).slice(0, 80));
      } catch {
        console.log(`REQ ${e.url} raw`);
      }
    }
    if (e.type === 'response') {
      console.log(`RES ${e.url.split('/api')[1]} ok=${e.body?.ok} verified=${e.body?.verified} mode=${e.body?.mode} savedPath=${e.body?.savedPath} strategy=${e.body?.merge ? 'merge-meta' : ''}`);
      if (e.body?.merge) console.log('  merge:', JSON.stringify(e.body.merge));
    }
  }

  console.log('\n--- Disk after save A ---');
  console.log('abs:', diskAfterA.abs);
  console.log('exists:', diskAfterA.content != null);
  console.log('contains A:', diskAfterA.content?.includes(ROW_A));
  console.log('contains B:', diskAfterA.content?.includes(ROW_B));
  console.log('--- file content ---\n' + (diskAfterA.content || '(empty/missing)'));

  console.log('\n=== STEP 2: Save row B via UI (same note) ===');
  const netBeforeB = networkLog.length;
  await saveRowContaining(ROW_B);
  const netAfterB = networkLog.slice(netBeforeB);
  const diskAfterB = readDisk(TEMP_VAULT, REL_PATH);

  console.log('\n--- Network (save B) ---');
  for (const e of netAfterB) {
    if (e.type === 'request' && e.postData) {
      try {
        const body = JSON.parse(e.postData);
        console.log(`REQ ${e.url.split('/api')[1]} mode=${body.mode || '(none)'} path=${body.path} mergeItems=${body.mergeItems?.length ?? 0}`);
        if (body.mergeItems?.[0]) console.log('  mergeItem[0].text:', String(body.mergeItems[0].text).slice(0, 80));
      } catch {
        console.log(`REQ ${e.url} raw`);
      }
    }
    if (e.type === 'response') {
      console.log(`RES ${e.url.split('/api')[1]} ok=${e.body?.ok} verified=${e.body?.verified} mode=${e.body?.mode} savedPath=${e.body?.savedPath}`);
      if (e.body?.merge) console.log('  merge:', JSON.stringify(e.body.merge));
    }
  }

  console.log('\n--- Disk after save B ---');
  console.log('abs:', diskAfterB.abs);
  console.log('contains A:', diskAfterB.content?.includes(ROW_A));
  console.log('contains B:', diskAfterB.content?.includes(ROW_B));
  console.log('--- file content ---\n' + (diskAfterB.content || '(empty/missing)'));

  const pathsA = netAfterA.filter((e) => e.type === 'response' && e.body?.savedPath).map((e) => e.body.savedPath);
  const pathsB = netAfterB.filter((e) => e.type === 'response' && e.body?.savedPath).map((e) => e.body.savedPath);
  console.log('\n=== SUMMARY ===');
  console.log('savePath A:', pathsA.join(', ') || '(none)');
  console.log('savePath B:', pathsB.join(', ') || '(none)');
  console.log('same path:', pathsA[0] && pathsB[0] ? pathsA[0] === pathsB[0] : 'unknown');
  console.log('A preserved after B:', diskAfterB.content?.includes(ROW_A));
  console.log('B present:', diskAfterB.content?.includes(ROW_B));
  console.log('CODE PATH: saveSingleItemToObsidian → BrainDestinationPicker → executeObsidianVaultWrite(mode=merge) → writeObsidianWithItemMerge');

  await browser.close();

  if (!diskAfterB.content?.includes(ROW_A) || !diskAfterB.content?.includes(ROW_B)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
