import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5184';
const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(fs.readFileSync(
  path.join(root, 'scripts', 'fixtures', 'live-evidence-learning-insights.json'),
  'utf8',
));

const VIDEO_TITLE = 'Evidence Timestamp Interaction Fixture';
const VIDEO_ID = 'evidence-timestamp-interaction';
const LIVE_INSIGHT = 'התגובה הראשונית לחדשות אינה תמיד המגמה';

const video = {
  id: VIDEO_ID,
  youtubeId: VIDEO_ID,
  url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  title: VIDEO_TITLE,
  category: 'שוק ההון',
  subCategory: 'מבזק לילה',
  confirmedSubCategory: 'evening-brief',
  userConfirmedSubCategory: true,
  marketBriefData: {
    contentType: 'marketBrief',
    videoType: 'lateNight',
    ...fixture,
  },
  analysisProvider: 'gems',
  analysisStatus: 'analyzed',
  fetchedAt: '2026-08-04T00:00:00.000Z',
  analyzedAt: '2026-08-04T00:00:00.000Z',
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 355, height: 767 } });
await context.addInitScript(() => {
  window.__evidencePlayerAudit = { active: 0, maxActive: 0, seeks: [], plays: 0 };
  window.YT = {
    Player: class MockPlayer {
      constructor(_container, options) {
        this.options = options;
        window.__evidencePlayerAudit.active += 1;
        window.__evidencePlayerAudit.maxActive = Math.max(
          window.__evidencePlayerAudit.maxActive,
          window.__evidencePlayerAudit.active,
        );
        queueMicrotask(() => this.options.events?.onReady?.({ target: this }));
      }

      seekTo(seconds) {
        window.__evidencePlayerAudit.seeks.push(seconds);
      }

      playVideo() {
        window.__evidencePlayerAudit.plays += 1;
      }

      destroy() {
        window.__evidencePlayerAudit.active = Math.max(0, window.__evidencePlayerAudit.active - 1);
      }
    },
  };
});

const page = await context.newPage();

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((seedVideo) => {
    const key = 'yt_mentor_videos_v2';
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(key) || '[]'); } catch { existing = []; }
    const rest = existing.filter((item) => (item.id || item.youtubeId) !== seedVideo.id);
    localStorage.setItem(key, JSON.stringify([seedVideo, ...rest]));
    localStorage.setItem(`market_brief_${seedVideo.id}`, JSON.stringify(seedVideo.marketBriefData));
  }, video);
  await page.reload({ waitUntil: 'domcontentloaded' });

  const card = page.locator('div').filter({ hasText: VIDEO_TITLE }).last();
  await card.waitFor({ timeout: 20000 });
  await card.click();
  await page.getByRole('tab', { name: /תובנות/ }).first().click();

  const row = page.locator('[data-insight-row]').filter({ hasText: LIVE_INSIGHT });
  await row.waitFor({ timeout: 20000 });
  const timestamp = row.getByRole('button', { name: /עבור לזמן 08:00 בסרטון/ });
  const checkbox = row.getByRole('checkbox');

  assert.equal(await checkbox.isChecked(), false, 'checkbox starts clear');
  await timestamp.click();
  assert.equal(await checkbox.isChecked(), false, 'timestamp click must not toggle checkbox');

  await timestamp.focus();
  await timestamp.press('Enter');
  assert.equal(await checkbox.isChecked(), false, 'Enter must not toggle checkbox');

  await timestamp.press('Space');
  assert.equal(await checkbox.isChecked(), false, 'Space must not toggle checkbox');

  const audit = await page.evaluate(() => window.__evidencePlayerAudit);
  assert.deepEqual(audit.seeks, [480.25, 480.25, 480.25]);
  assert.equal(audit.plays, 3);
  assert.equal(audit.maxActive, 1, 'only one player may own seeking');

  await checkbox.click();
  assert.equal(await checkbox.isChecked(), true, 'checkbox remains independently operable');
  const afterCheckbox = await page.evaluate(() => window.__evidencePlayerAudit);
  assert.deepEqual(afterCheckbox.seeks, audit.seeks, 'checkbox click must not seek');

  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal((await page.locator('iframe').count()) <= 1, true, 'reload must not create a second player');

  console.log(JSON.stringify({
    status: 'passed',
    clickSeek: 480.25,
    keyboard: ['Enter', 'Space'],
    checkboxIndependent: true,
    singlePlayerOwner: true,
    viewport: '355x767',
    paidCalls: 0,
  }, null, 2));
} finally {
  await browser.close();
}
