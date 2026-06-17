/**
 * Capture Market State (מצב שוק) section screenshots for QA.
 * Run: node scripts/capture-market-state-layout.mjs  (dev server on :5175)
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:5175';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'),
);

fixture.contentType = 'marketBrief';
fixture.universalTabs.specialized.marketOverview = {
  ...fixture.universalTabs.specialized.marketOverview,
  marketTrend: 'ירוק חזק בפתיחה, השוק נפתח בעליות לקראת פרסום נתוני CPI מחר בבוקר',
  breadth: 'חיובי — רוחב השוק משתפר, כ-65% מהמניות ב-S&P 500 מעל ממוצע 50 יום',
  riskOnOff: 'Risk-On עם מנהיגות טכנולוגיה ושבבים, אך עם תנודתיות גבוהה',
  volatilityEnvironment: 'VIX בירידה אך עדיין מעל 20 — סביבת תנודתיות בינונית-גבוהה',
  leadingSector: 'טכנולוגיה ושבבים מובילים את העליות',
  weakestSector: 'שירותים ציבוריים ואנרגיה בירידה יחסית',
  marketStrength: 'בינוני — שיאים באינדקסים על רוחב צר',
  marketWeakness: 'מנהיגות צרה — ריכוז ב-Mag 7',
  status: 'פתיחה ירוקה, תשומת הלב ממוקדת בדוח CPI',
  generalMood: 'תנודתי עם נטייה חיובית',
};

const VIDEO_ID = 'market-state-layout-qa';
const VIDEO_TITLE = 'Market State Layout QA';
const video = {
  id: VIDEO_ID,
  youtubeId: VIDEO_ID,
  url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  title: VIDEO_TITLE,
  category: 'שוק ההון',
  subCategory: 'מבזק בוקר',
  confirmedSubCategory: 'morning-brief',
  userConfirmedSubCategory: true,
  fetchedAt: new Date().toISOString(),
  mentorId: 'local-mentor-1',
  mentorName: 'QA Mentor',
};

async function openVideo(page) {
  const dialogOpen = await page.locator('[role="dialog"][data-state="open"]').count();
  if (dialogOpen > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  const card = page.locator('div').filter({ hasText: VIDEO_TITLE }).last();
  await card.waitFor({ timeout: 25000 });
  await card.click();
  await page.waitForSelector('#analysis-tabs [role="tablist"]', { timeout: 25000 });
  await page.waitForTimeout(800);
}

async function capture(viewport, name) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize(viewport);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
  await openVideo(page);
  await page.getByRole('tab', { name: /תוכן ייעודי/ }).first().click();
  await page.waitForTimeout(1200);
  const section = page.locator('[data-regime-comparison]').first();
  await section.waitFor({ timeout: 15000 });
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await section.screenshot({
    path: join(__dirname, `market-state-${name}.png`),
  });
  await browser.close();
}

await capture({ width: 1280, height: 900 }, 'after-desktop');
await capture({ width: 390, height: 844 }, 'after-mobile');
console.log(`Saved screenshots to ${__dirname} (after-desktop + after-mobile)`);
