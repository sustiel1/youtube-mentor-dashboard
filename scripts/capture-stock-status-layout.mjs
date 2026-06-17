/**
 * Capture stock status row screenshots for QA.
 * Run: node scripts/capture-stock-status-layout.mjs  (dev server on :5184)
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'),
);

fixture.universalTabs.usefulKnowledge = fixture.universalTabs.usefulKnowledge || {};
fixture.universalTabs.usefulKnowledge.reusableKnowledge = [
  { symbol: 'NVDA', status: 'up' },
  { symbol: 'AAPL', status: 'bullish' },
  { symbol: 'MSFT', status: 'down' },
  { symbol: 'SLP', status: 'bearish' },
  { symbol: 'GOOG', status: 'neutral' },
  { symbol: 'PLTR', status: 'flat' },
  'symbol: TSLA | status: up',
];

const VIDEO_ID = 'runtime-audit-video-001';
const video = {
  id: VIDEO_ID,
  youtubeId: VIDEO_ID,
  url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  title: 'Runtime Tabs Audit Fixture',
  category: 'שוק ההון',
  subCategory: 'מבזק בוקר',
  confirmedSubCategory: 'morning-brief',
  userConfirmedSubCategory: true,
  fetchedAt: new Date().toISOString(),
  mentorId: 'local-mentor-1',
  mentorName: 'Audit Mentor',
};

async function capture(viewport, name) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize(viewport);
  await page.goto('http://localhost:5184/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ video, fixture, VIDEO_ID }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    let videos = [];
    try { videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { videos = []; }
    const rest = videos.filter((v) => (v.id || v.youtubeId) !== VIDEO_ID);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([video, ...rest]));
    localStorage.setItem(`market_brief_${VIDEO_ID}`, JSON.stringify(fixture));
  }, { video, fixture, VIDEO_ID });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const card = page.locator('div').filter({ hasText: 'Runtime Tabs Audit Fixture' }).last();
  await card.waitFor({ timeout: 20000 });
  await card.click();
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  await page.getByRole('tab', { name: /ידע שימושי/ }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: join(__dirname, `stock-status-${name}.png`),
    fullPage: false,
  });
  await browser.close();
}

await capture({ width: 1280, height: 900 }, 'after-desktop');
await capture({ width: 390, height: 844 }, 'after-mobile');
console.log('Saved scripts/stock-status-after-desktop.png and after-mobile.png');
