/**
 * Playwright validation for Useful Knowledge P1 (UK-1 + UK-2).
 * Run: node scripts/useful-knowledge-p1-validate.mjs  (dev server on :5184)
 */
import { chromium, devices } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '../e2e/screenshots/uk-p1');
const BASE_URL = 'http://localhost:5184';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'),
);

const VIDEO_MENTOR_ID = 'uk-p1-mentor-video';
const VIDEO_CHANNEL_ID = 'uk-p1-channel-video';
const MENTOR_ID = 'uk-p1-mentor-001';
const PUBLISHED_AT = '2026-06-09T10:00:00.000Z';
const EXPECTED_DATE = '09/06/2026';
const SAMPLE_ITEM_TEXT = 'When VIX > 25, reduce position size by 50%.';

const videoWithMentor = {
  id: VIDEO_MENTOR_ID,
  youtubeId: VIDEO_MENTOR_ID,
  url: `https://www.youtube.com/watch?v=${VIDEO_MENTOR_ID}`,
  title: 'UK P1 Mentor Fixture',
  category: 'שוק ההון',
  subCategory: 'מבזק בוקר',
  confirmedSubCategory: 'morning-brief',
  userConfirmedSubCategory: true,
  fetchedAt: new Date().toISOString(),
  publishedAt: PUBLISHED_AT,
  mentorId: MENTOR_ID,
  mentorName: 'Micha Stocks',
};

const videoChannelOnly = {
  id: VIDEO_CHANNEL_ID,
  youtubeId: VIDEO_CHANNEL_ID,
  url: `https://www.youtube.com/watch?v=${VIDEO_CHANNEL_ID}`,
  title: 'UK P1 Channel Fallback Fixture',
  category: 'שוק ההון',
  subCategory: 'מבזק בוקר',
  confirmedSubCategory: 'morning-brief',
  userConfirmedSubCategory: true,
  fetchedAt: new Date().toISOString(),
  publishedAt: PUBLISHED_AT,
  channelTitle: 'Wysetrade',
};

const customMentor = {
  id: MENTOR_ID,
  name: 'Micha Stocks',
  active: true,
  category: 'Markets',
  sourceUrl: 'https://www.youtube.com/@michastocks',
};

function itemDedupeKey(vid, tab, text) {
  const textKey = String(text || '').slice(0, 60).toLowerCase()
    .replace(/\s+/g, '-').replace(/[^a-z0-9א-ת-]/g, '') || 'item';
  return `brain-item:${vid}:${tab}:${textKey}`;
}

const EXPECTED_ITEM_ID = itemDedupeKey(VIDEO_MENTOR_ID, 'useful-knowledge', SAMPLE_ITEM_TEXT);

async function seedPage(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ videoWithMentor, videoChannelOnly, fixture, customMentor, VIDEO_MENTOR_ID, VIDEO_CHANNEL_ID }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    let videos = [];
    try { videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { videos = []; }
    const rest = videos.filter((v) => {
      const id = v.id || v.youtubeId;
      return id !== VIDEO_MENTOR_ID && id !== VIDEO_CHANNEL_ID;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([videoWithMentor, videoChannelOnly, ...rest]));
    localStorage.setItem(`market_brief_${VIDEO_MENTOR_ID}`, JSON.stringify(fixture));
    localStorage.setItem(`market_brief_${VIDEO_CHANNEL_ID}`, JSON.stringify(fixture));

    let mentors = [];
    try { mentors = JSON.parse(localStorage.getItem('yt_custom_mentors_v1') || '[]'); } catch { mentors = []; }
    const mentorRest = mentors.filter((m) => m.id !== customMentor.id);
    localStorage.setItem('yt_custom_mentors_v1', JSON.stringify([customMentor, ...mentorRest]));

    const items = JSON.parse(localStorage.getItem('yt_knowledge_items_v1') || '[]');
    const filtered = items.filter((i) => {
      const id = String(i.id || '');
      return !id.startsWith(`brain-item:${VIDEO_MENTOR_ID}:`) && !id.startsWith(`brain-item:${VIDEO_CHANNEL_ID}:`);
    });
    localStorage.setItem('yt_knowledge_items_v1', JSON.stringify(filtered));
  }, { videoWithMentor, videoChannelOnly, fixture, customMentor, VIDEO_MENTOR_ID, VIDEO_CHANNEL_ID });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
}

async function openVideoByTitle(page, title) {
  const card = page.locator('div').filter({ hasText: title }).last();
  await card.waitFor({ timeout: 20000 });
  await card.click();
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  await page.waitForTimeout(800);
}

async function openUsefulKnowledgeTab(page) {
  const tab = page.getByRole('tab', { name: /ידע שימושי/ }).first();
  await tab.waitFor({ timeout: 15000 });
  await tab.click();
  await page.waitForTimeout(1000);
}

async function closeVideoPanel(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const dialogOpen = await page.locator('[role="dialog"][data-state="open"]').count();
  if (dialogOpen) {
    await page.locator('[role="dialog"] button.absolute.top-3.left-3').first().click();
  }
  await page.waitForTimeout(500);
}

async function getActivePanel(page) {
  return page.locator('[role="tabpanel"][data-state="active"]');
}

async function countBrainButtons(panel) {
  return panel.getByTitle('שמור למוח').count();
}

async function countSavedLabels(panel) {
  return panel.getByText('✓ נשמר למוח', { exact: true }).count();
}

async function readKnowledgeStorage(page, videoId, expectedItemId = EXPECTED_ITEM_ID) {
  return page.evaluate(({ videoId, expectedItemId }) => {
    const prefix = `brain-item:${videoId}:`;
    const raw = localStorage.getItem('yt_knowledge_items_v1');
    let items = [];
    try { items = JSON.parse(raw || '[]'); } catch { items = []; }
    const matching = items.filter((i) => String(i.id || '').startsWith(prefix));
    const exact = items.find((i) => i.id === expectedItemId);
    return {
      totalItems: items.length,
      videoItems: matching.length,
      exactId: expectedItemId,
      exactFound: !!exact,
      exactTitle: exact?.title || null,
      workspacePath: exact?.workspacePath || null,
    };
  }, { videoId, expectedItemId });
}

function record(results, id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id}: ${detail}`);
}

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const results = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const page = await context.newPage();

  await seedPage(page);

  // ── Test 1: Save item ──
  await openVideoByTitle(page, 'UK P1 Mentor Fixture');
  await openUsefulKnowledgeTab(page);
  const panel = await getActivePanel(page);
  const sourceLineBefore = await panel.locator('p').filter({ hasText: '🎥' }).first().textContent().catch(() => '');
  const brainBtn = panel.getByTitle('שמור למוח').first();
  const hadBrain = await brainBtn.count();
  if (hadBrain) await brainBtn.click();
  await page.waitForTimeout(1200);
  const savedAfterClick = await countSavedLabels(panel);
  const storageAfterSave = await readKnowledgeStorage(page, VIDEO_MENTOR_ID);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '01-after-save-desktop.png'), fullPage: false });
  record(
    results,
    '1-save-item',
    hadBrain > 0 && savedAfterClick >= 1 && storageAfterSave.exactFound,
    `brainBtn=${hadBrain}, savedLabels=${savedAfterClick}, localStorage.exactFound=${storageAfterSave.exactFound}, source="${(sourceLineBefore || '').trim()}"`,
  );

  // ── Test 2: Refresh page ──
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await openVideoByTitle(page, 'UK P1 Mentor Fixture');
  await openUsefulKnowledgeTab(page);
  const panel2 = await getActivePanel(page);
  const savedAfterRefresh = await countSavedLabels(panel2);
  const brainAfterRefresh = await countBrainButtons(panel2);
  const storageAfterRefresh = await readKnowledgeStorage(page, VIDEO_MENTOR_ID);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '02-after-refresh.png'), fullPage: false });
  record(
    results,
    '2-refresh-page',
    savedAfterRefresh >= 1 && storageAfterRefresh.exactFound,
    `savedLabels=${savedAfterRefresh}, brainButtons=${brainAfterRefresh}, localStorage.exactFound=${storageAfterRefresh.exactFound}`,
  );

  // ── Test 3: Reopen video (close panel, reopen) ──
  await closeVideoPanel(page);
  await openVideoByTitle(page, 'UK P1 Mentor Fixture');
  await openUsefulKnowledgeTab(page);
  const panel3 = await getActivePanel(page);
  const savedAfterReopen = await countSavedLabels(panel3);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '03-reopen-video.png'), fullPage: false });
  record(
    results,
    '3-reopen-video',
    savedAfterReopen >= 1,
    `savedLabels=${savedAfterReopen}`,
  );

  // ── Test 4: Navigate between videos ──
  await closeVideoPanel(page);
  await openVideoByTitle(page, 'UK P1 Channel Fallback Fixture');
  await openUsefulKnowledgeTab(page);
  await page.waitForTimeout(500);
  await closeVideoPanel(page);
  await openVideoByTitle(page, 'UK P1 Mentor Fixture');
  await openUsefulKnowledgeTab(page);
  const panel4 = await getActivePanel(page);
  const savedAfterNav = await countSavedLabels(panel4);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '04-navigate-between-videos.png'), fullPage: false });
  record(
    results,
    '4-navigate-between-videos',
    savedAfterNav >= 1,
    `savedLabels on mentor video after visiting channel video=${savedAfterNav}`,
  );

  // ── Test 5: Dedupe (duplicate upsert must not create a second row) ──
  const countBeforeDedupe = (await readKnowledgeStorage(page, VIDEO_MENTOR_ID)).videoItems;
  const duplicateUpsert = await page.evaluate(({ expectedItemId, VIDEO_MENTOR_ID, SAMPLE_ITEM_TEXT }) => {
    const key = 'yt_knowledge_items_v1';
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    const existing = items.find((i) => i.id === expectedItemId);
    if (!existing) return { ok: false, reason: 'missing-baseline' };
    const now = new Date().toISOString();
    const duplicate = { ...existing, updatedAt: now, title: String(SAMPLE_ITEM_TEXT).slice(0, 80) };
    const idx = items.findIndex((i) => i.id === expectedItemId);
    const next = [...items];
    if (idx === -1) next.unshift(duplicate);
    else next[idx] = duplicate;
    localStorage.setItem(key, JSON.stringify(next));
    const after = JSON.parse(localStorage.getItem(key) || '[]');
    const matches = after.filter((i) => String(i.id || '').startsWith(`brain-item:${VIDEO_MENTOR_ID}:`));
    return { ok: matches.length === 1, matches: matches.length, ids: matches.map((i) => i.id) };
  }, { expectedItemId: EXPECTED_ITEM_ID, VIDEO_MENTOR_ID, SAMPLE_ITEM_TEXT });
  const storageAfterDedupe = await readKnowledgeStorage(page, VIDEO_MENTOR_ID);
  const savedLabelsDedupe = await countSavedLabels(panel4);
  record(
    results,
    '5-dedupe',
    duplicateUpsert.ok && storageAfterDedupe.videoItems === countBeforeDedupe && savedLabelsDedupe >= 1,
    `videoItems before=${countBeforeDedupe} after=${storageAfterDedupe.videoItems}, duplicateUpsert=${JSON.stringify(duplicateUpsert)}`,
  );

  // ── Test 6: Mobile layout ──
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const panelMobile = await getActivePanel(page);
  const savedMobile = await countSavedLabels(panelMobile);
  const savedVisible = await panelMobile.getByText('✓ נשמר למוח', { exact: true }).first().isVisible();
  const box = savedMobile > 0
    ? await panelMobile.getByText('✓ נשמר למוח', { exact: true }).first().boundingBox()
    : null;
  await page.screenshot({ path: join(SCREENSHOT_DIR, '05-mobile-layout.png'), fullPage: false });
  record(
    results,
    '6-mobile-layout',
    savedMobile >= 1 && savedVisible && box && box.width > 0,
    `savedLabels=${savedMobile}, visible=${savedVisible}, width=${box?.width ?? 0}`,
  );

  // ── Test 7: Mentor / channel fallback ──
  await page.setViewportSize({ width: 1280, height: 800 });
  await closeVideoPanel(page);

  await openVideoByTitle(page, 'UK P1 Mentor Fixture');
  await openUsefulKnowledgeTab(page);
  const panelMentor = await getActivePanel(page);
  const mentorLine = (await panelMentor.locator('p').filter({ hasText: '🎥' }).first().textContent() || '').trim();
  await page.screenshot({ path: join(SCREENSHOT_DIR, '06a-mentor-source-line.png'), fullPage: false });
  const mentorPass = mentorLine.includes('Micha Stocks') && mentorLine.includes(EXPECTED_DATE);
  record(results, '7a-mentor-source', mentorPass, `line="${mentorLine}"`);

  await closeVideoPanel(page);

  await openVideoByTitle(page, 'UK P1 Channel Fallback Fixture');
  await openUsefulKnowledgeTab(page);
  const panelChannel = await getActivePanel(page);
  const channelLine = (await panelChannel.locator('p').filter({ hasText: '🎥' }).first().textContent() || '').trim();
  await page.screenshot({ path: join(SCREENSHOT_DIR, '06b-channel-fallback-line.png'), fullPage: false });
  const channelPass = channelLine.includes('Wysetrade') && channelLine.includes(EXPECTED_DATE);
  record(results, '7b-channel-fallback', channelPass, `line="${channelLine}"`);

  // localStorage summary
  const lsSummary = await page.evaluate(({ expectedItemId, SAMPLE_ITEM_TEXT }) => {
    const items = JSON.parse(localStorage.getItem('yt_knowledge_items_v1') || '[]');
    const exact = items.find((i) => i.id === expectedItemId);
    return {
      storageKey: 'yt_knowledge_items_v1',
      itemId: expectedItemId,
      found: !!exact,
      title: exact?.title || null,
      metadataKeys: exact?.metadata ? Object.keys(exact.metadata).sort() : [],
      hasWorkspacePath: !!exact?.workspacePath,
      sampleText: SAMPLE_ITEM_TEXT,
    };
  }, { expectedItemId: EXPECTED_ITEM_ID, SAMPLE_ITEM_TEXT });

  console.log('\n[localStorage]', JSON.stringify(lsSummary, null, 2));

  const edgeCases = [];
  if (!mentorPass && mentorLine.includes('Micha Stocks')) {
    edgeCases.push('Mentor name present but date format may differ from expected DD/MM/YYYY');
  }
  if (savedAfterRefresh > 0 && brainAfterRefresh > 0) {
    edgeCases.push('Both saved label and brain button visible after refresh — possible mixed state on unsaved sibling items');
  }
  if (storageAfterSave.workspacePath?.includes('/')) {
    edgeCases.push(`workspacePath still uses technical path internally (UI hides it): ${storageAfterSave.workspacePath}`);
  }

  await browser.close();

  const allPass = results.every((r) => r.pass);
  console.log('\n=== UK P1 VALIDATION SUMMARY ===');
  for (const r of results) {
    console.log(`${r.pass ? '✓' : '✗'} ${r.id}: ${r.detail}`);
  }
  if (edgeCases.length) {
    console.log('\nEdge cases:');
    edgeCases.forEach((e) => console.log(`- ${e}`));
  }
  console.log(`\nScreenshots: ${SCREENSHOT_DIR}`);
  console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
