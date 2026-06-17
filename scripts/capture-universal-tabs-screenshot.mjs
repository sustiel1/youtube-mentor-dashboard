/**
 * Capture Universal Tab bar screenshot for UX QA.
 * Run: node scripts/capture-universal-tabs-screenshot.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../e2e/screenshots/universal-tabs-ux');
const BASE_URL = 'http://localhost:5184';

const videoFixture = {
  id: 'tabs-ux-video',
  youtubeId: 'tabs-ux-video',
  url: 'https://www.youtube.com/watch?v=tabs-ux-video',
  title: 'Universal Tabs UX Screenshot',
  category: 'שוק ההון',
  subCategory: 'מבזק בוקר',
  confirmedSubCategory: 'morning-brief',
  userConfirmedSubCategory: true,
  fetchedAt: new Date().toISOString(),
  publishedAt: '2026-06-10T08:00:00.000Z',
  summaryShort: 'סיכום קצר לבדיקת טאבים.',
  insights: ['תובנה לדוגמה'],
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ videoFixture }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    let videos = [];
    try { videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { videos = []; }
    const rest = videos.filter((v) => (v.id || v.youtubeId) !== videoFixture.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([videoFixture, ...rest]));
  }, { videoFixture });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const card = page.locator('div').filter({ hasText: videoFixture.title }).last();
  await card.click();
  await page.waitForSelector('#analysis-tabs [role="tablist"]', { timeout: 25000 });
  await page.waitForTimeout(800);

  const tabBar = page.locator('#analysis-tabs [role="tablist"]');
  await tabBar.screenshot({ path: join(OUT_DIR, 'after-desktop-tab-bar.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await tabBar.screenshot({ path: join(OUT_DIR, 'after-mobile-tab-bar.png') });

  await browser.close();
  console.log(`Screenshots saved to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
