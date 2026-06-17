/**
 * Capture save-status popover screenshots.
 * Run: node scripts/capture-save-status-popover.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../e2e/screenshots/save-status-popover');
const BASE_URL = 'http://localhost:5184';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'),
);

const videoFixture = {
  id: 'save-popover-video',
  youtubeId: 'save-popover-video',
  url: 'https://www.youtube.com/watch?v=save-popover-video',
  title: 'Save Status Popover Fixture',
  category: 'שוק ההון',
  subCategory: 'ניתוח טכני',
  confirmedSubCategory: 'technical-analysis',
  userConfirmedSubCategory: true,
  fetchedAt: new Date().toISOString(),
  publishedAt: '2026-06-10T10:00:00.000Z',
  indicators: ['RSI oversold on XLF — bounce watch'],
  setups: ['Pullback entry above 50-day MA on SPY'],
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ videoFixture, fixture }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    const videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      .filter((v) => (v.id || v.youtubeId) !== videoFixture.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([videoFixture, ...videos]));
    localStorage.setItem(`market_brief_${videoFixture.id}`, JSON.stringify(fixture));
    localStorage.setItem('yt_knowledge_items_v1', '[]');
  }, { videoFixture, fixture });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const card = page.locator('div').filter({ hasText: videoFixture.title }).last();
  await card.click();
  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  await page.getByRole('tab', { name: /תובנות/ }).click();
  await page.waitForTimeout(1200);

  await page.screenshot({ path: join(OUT_DIR, 'before-click-row-actions.png'), fullPage: false });

  const panel = page.locator('[role="tabpanel"][data-state="active"]');
  await panel.locator('.group').first().hover();
  await page.waitForTimeout(400);
  const brainBtn = panel.locator('button').filter({ hasText: '🧠' }).first();
  await brainBtn.click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT_DIR, 'after-brain-unsaved-popover.png'), fullPage: false });

  await page.locator('[data-save-status-popover] button').filter({ hasText: 'שמור עכשיו' }).click({ force: true });
  await page.waitForTimeout(800);
  await brainBtn.click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT_DIR, 'after-brain-saved-popover.png'), fullPage: false });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const obsBtn = page.locator('[role="tabpanel"][data-state="active"] button[title="Obsidian — לחץ לסטטוס"]').first();
  await obsBtn.click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT_DIR, 'after-obsidian-popover.png'), fullPage: false });

  await browser.close();
  console.log(`Screenshots: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
