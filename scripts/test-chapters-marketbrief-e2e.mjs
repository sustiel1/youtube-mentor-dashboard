/**
 * Focused browser regression check for the reported bug: a pasted
 * contentType: 'marketBrief' GEM JSON is persisted verbatim as
 * video.marketBriefData; the Chapters tab must show its top-level
 * `chapters` array on first render AND after a hard page refresh
 * (real localStorage rehydration, not just the pure-function check in
 * scripts/test-chapters-rawdata-fallback.mjs).
 *
 * Follows the same seed/open/assert pattern as
 * scripts/useful-knowledge-p1-validate.mjs.
 *
 * Run: node scripts/test-chapters-marketbrief-e2e.mjs  (dev server on :5184)
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5184';
const VIDEO_ID = 'chapters-e2e-fixture';

const marketBriefData = {
  contentType: 'marketBrief',
  videoType: 'open',
  channelName: 'E2E Fixture Channel',
  chapters: [
    { title: 'פתיחה — פרק בדיקה', startSeconds: 0, endSeconds: 150, summary: 'פרק ראשון לבדיקה' },
    { title: 'מאקרו — פרק בדיקה', startSeconds: 150, endSeconds: 270, summary: 'פרק שני לבדיקה' },
  ],
  top5Insights: [{ rank: 1, asset: 'TEST', ticker: 'TST', note: 'בדיקה' }],
  marketOverview: { generalMood: 'bullish', summary: 'בדיקת E2E' },
};

const video = {
  id: VIDEO_ID,
  youtubeId: VIDEO_ID,
  url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  title: 'Chapters E2E Fixture Video',
  category: 'שוק ההון',
  subCategory: 'מבזק בוקר',
  confirmedSubCategory: 'morning-brief',
  userConfirmedSubCategory: true,
  fetchedAt: new Date().toISOString(),
  marketBriefData,
  analysisProvider: 'gems',
  analysisStatus: 'analyzed',
  analyzedAt: new Date().toISOString(),
};

function record(results, id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id}: ${detail}`);
}

async function seed(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ video, marketBriefData, VIDEO_ID }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    let videos = [];
    try { videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { videos = []; }
    const rest = videos.filter((v) => (v.id || v.youtubeId) !== VIDEO_ID);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([video, ...rest]));
    localStorage.setItem(`market_brief_${VIDEO_ID}`, JSON.stringify(marketBriefData));
  }, { video, marketBriefData, VIDEO_ID });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

async function openVideo(page) {
  const card = page.locator('div').filter({ hasText: 'Chapters E2E Fixture Video' }).last();
  await card.waitFor({ timeout: 20000 });
  await card.click();
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  await page.waitForTimeout(600);
}

async function openChaptersTab(page) {
  const tab = page.getByRole('tab', { name: /פרקים/ }).first();
  await tab.waitFor({ timeout: 15000 });
  await tab.click();
  await page.waitForTimeout(800);
}

async function closePanel(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

async function countFixtureChapterText(page) {
  return page.getByText('פתיחה — פרק בדיקה').count();
}

async function main() {
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await seed(page);

  // Test 1: chapters visible immediately after seeding (same-session render)
  await openVideo(page);
  await openChaptersTab(page);
  const initialCount = await countFixtureChapterText(page);
  record(results, '1-chapters-visible-initial', initialCount > 0, `matches=${initialCount}`);

  // Test 2: chapters survive a hard refresh (the reported bug)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await openVideo(page);
  await openChaptersTab(page);
  const afterRefreshCount = await countFixtureChapterText(page);
  record(results, '2-chapters-survive-refresh', afterRefreshCount > 0, `matches=${afterRefreshCount}`);

  // Test 3: chapters survive navigate-away-and-back (close panel, reopen)
  await closePanel(page);
  await openVideo(page);
  await openChaptersTab(page);
  const afterReopenCount = await countFixtureChapterText(page);
  record(results, '3-chapters-survive-reopen', afterReopenCount > 0, `matches=${afterReopenCount}`);

  await browser.close();

  const allPass = results.every((r) => r.pass);
  console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
