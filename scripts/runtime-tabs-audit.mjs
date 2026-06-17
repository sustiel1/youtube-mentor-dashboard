/**
 * Playwright + audit matrix smoke test.
 * Run: node scripts/runtime-tabs-audit.mjs  (requires dev server on :5184)
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'),
);

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

const TAB_TRIGGERS = [
  { value: 'summary', pattern: /סיכום/ },
  { value: 'chapters', pattern: /פרקים/ },
  { value: 'insights', pattern: /תובנות/ },
  { value: 'useful-knowledge', pattern: /ידע שימושי/ },
  { value: 'app-builder', pattern: /APP/ },
  { value: 'topics-subtopics', pattern: /מיפוי ל-Obsidian|קטגוריה ראשית|תגיות/ },
  { value: 'specialized', pattern: /תוכן ייעודי|ייעודי/ },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const domByTab = {};

  await page.goto('http://localhost:5184/', { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.evaluate(({ video, fixture, VIDEO_ID }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    let videos = [];
    try { videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { videos = []; }
    const rest = videos.filter((v) => (v.id || v.youtubeId) !== VIDEO_ID);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([video, ...rest]));
    localStorage.setItem(`market_brief_${VIDEO_ID}`, JSON.stringify(fixture));
    localStorage.removeItem('app_builder_v1');
  }, { video, fixture, VIDEO_ID });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const seeded = await page.evaluate((VIDEO_ID) => ({
    videoCount: JSON.parse(localStorage.getItem('yt_mentor_videos_v2') || '[]').length,
    briefKey: `market_brief_${VIDEO_ID}`,
    briefExists: !!localStorage.getItem(`market_brief_${VIDEO_ID}`),
    briefHasUniversal: !!JSON.parse(localStorage.getItem(`market_brief_${VIDEO_ID}`) || '{}').universalTabs,
  }), VIDEO_ID);
  console.log('[audit-seed]', seeded);

  const card = page.locator('div').filter({ hasText: 'Runtime Tabs Audit Fixture' }).last();
  await card.waitFor({ timeout: 20000 });
  await card.click();
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  await page.waitForTimeout(2000);

  for (const { value, pattern } of TAB_TRIGGERS) {
    const trigger = page.getByRole('tab', { name: pattern }).first();
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(1200);
      const domCount = await page.evaluate(() => {
        const root = document.querySelector('[role="tabpanel"][data-state="active"]');
        if (!root) return 0;
        const rows = root.querySelectorAll('.group.flex.items-start.gap-2.rounded-lg').length;
        const insightRows = root.querySelectorAll('[data-insight-row]').length;
        const tableRows = root.querySelectorAll('table tbody tr').length;
        const chapterRows = root.querySelectorAll('li.flex.items-start.gap-2').length;
        const summaryBullets = root.querySelectorAll('ul.space-y-2 li, ul.space-y-3 li').length;
        const pills = root.querySelectorAll('.rounded-full').length;
        const textareas = root.querySelectorAll('textarea').length;
        return Math.max(rows + tableRows, insightRows, chapterRows, summaryBullets, pills, textareas);
      });
      domByTab[value] = domCount;
      console.log(`[audit-dom] ${value}=${domCount}`);
      await page.screenshot({ path: join(__dirname, `audit-screenshot-${value}.png`), fullPage: false });
    } else {
      console.warn(`[audit] tab trigger not found: ${value}`);
    }
  }

  await browser.close();

  execSync('npx vite-node scripts/print-audit-matrix.mjs', {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, AUDIT_DOM_BY_TAB: JSON.stringify(domByTab) },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
