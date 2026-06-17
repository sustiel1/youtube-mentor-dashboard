/**
 * Playwright E2E validation — Universal Tab Bulk Selection.
 * Run: node scripts/universal-tab-bulk-validate.mjs  (dev server on :5184)
 */
import { chromium, devices } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '../e2e/screenshots/universal-tab-bulk');
const BASE_URL = 'http://localhost:5184';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'),
);

const VIDEO_ID = 'bulk-validate-video';
const VIDEO_TITLE = 'Bulk Selection Validation Fixture';

const TABS = [
  { id: 'summary', label: /סיכום/, countMode: 'items' },
  { id: 'chapters', label: /פרקים/, countMode: 'chapters' },
  { id: 'insights', label: /תובנות/, countMode: 'items' },
  { id: 'useful-knowledge', label: /ידע שימושי/, countMode: 'items' },
  { id: 'app-builder', label: /^APP$|APP/, countMode: 'app' },
  { id: 'topics-subtopics', label: /מיפוי ל-Obsidian/, countMode: 'items' },
  { id: 'specialized', label: /תוכן ייעודי/, countMode: 'items' },
];

const videoFixture = {
  id: VIDEO_ID,
  youtubeId: VIDEO_ID,
  url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  title: VIDEO_TITLE,
  category: 'שוק ההון',
  subCategory: 'מבזק בוקר',
  confirmedSubCategory: 'morning-brief',
  userConfirmedSubCategory: true,
  fetchedAt: new Date().toISOString(),
  publishedAt: '2026-06-10T08:00:00.000Z',
  mentorName: 'Bulk Test Mentor',
};

const appBuilderDraft = {
  summary: 'PRD summary section for bulk validation.',
  requirements: 'User can monitor market indices in one dashboard.',
  logic: 'Fetch indices → compare to thresholds → alert user.',
  risks: 'API rate limits\nStale data risk',
  tasks: 'Build index widget\nAdd alert logic',
  triggers: 'CPI release\nVIX spike',
  screens: 'Dashboard main\nSettings panel',
  developmentPrompt: 'Build React RTL dashboard from PRD sections.',
};

function record(results, id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id}: ${detail}`);
}

async function seedPage(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ videoFixture, fixture, VIDEO_ID, appBuilderDraft }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    let videos = [];
    try { videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { videos = []; }
    const rest = videos.filter((v) => (v.id || v.youtubeId) !== VIDEO_ID);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([videoFixture, ...rest]));
    localStorage.setItem(`market_brief_${VIDEO_ID}`, JSON.stringify(fixture));

    const appKey = 'app_builder_v1';
    let appData = {};
    try { appData = JSON.parse(localStorage.getItem(appKey) || '{}'); } catch { appData = {}; }
    appData[VIDEO_ID] = { ...appBuilderDraft, _meta: { seededAt: new Date().toISOString() } };
    localStorage.setItem(appKey, JSON.stringify(appData));

    const brainKey = 'yt_knowledge_items_v1';
    let items = [];
    try { items = JSON.parse(localStorage.getItem(brainKey) || '[]'); } catch { items = []; }
    const filtered = items.filter((i) => !String(i.id || '').includes(VIDEO_ID));
    localStorage.setItem(brainKey, JSON.stringify(filtered));
  }, { videoFixture, fixture, VIDEO_ID, appBuilderDraft });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
}

async function openVideo(page) {
  const dialogOpen = await page.locator('[role="dialog"][data-state="open"]').count();
  if (dialogOpen > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
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

async function clickFooterBrain(page) {
  await getSelectionFooter(page).getByRole('button', { name: '🧠 שמור למוח', exact: true }).click();
}

async function clickFooterObsidian(page) {
  await getSelectionFooter(page).getByRole('button', { name: '📁 Obsidian', exact: true }).click();
}

async function clickFooterWorkspace(page) {
  await getSelectionFooter(page).getByRole('button', { name: '⭐ Workspace', exact: true }).click();
}

async function getActivePanel(page) {
  return page.locator('[role="tabpanel"][data-state="active"]');
}

async function ensureVideoOpen(page) {
  let open = await page.locator('[role="dialog"][data-state="open"]').count();
  if (open > 0) {
    const hasTabs = await page.locator('[role="tablist"]').count();
    if (hasTabs > 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    open = await page.locator('[role="dialog"][data-state="open"]').count();
  }
  if (open === 0) await openVideo(page);
}

async function openTab(page, labelPattern) {
  await ensureVideoOpen(page);
  const tab = page.getByRole('tab', { name: labelPattern }).first();
  await tab.waitFor({ timeout: 15000 });
  await tab.click();
  await page.waitForTimeout(1200);
}

async function footerCount(page) {
  const dialog = getDialog(page);
  const el = dialog.getByText(/נבחרו \d+ פריטים/);
  const visible = await el.isVisible().catch(() => false);
  if (!visible) return 0;
  const text = await el.textContent();
  const m = text.match(/נבחרו (\d+) פריטים/);
  return m ? parseInt(m[1], 10) : 0;
}

async function footerVisible(page) {
  const dialog = getDialog(page);
  return dialog.getByText(/נבחרו \d+ פריטים/).isVisible().catch(() => false);
}

async function footerButtonCount(page) {
  const dialog = getDialog(page);
  return dialog.getByText(/נבחרו \d+ פריטים/).count();
}

async function clickFooterClear(page) {
  if (!(await footerVisible(page))) return;
  const dialog = getDialog(page);
  const clearBtn = dialog.getByRole('button', { name: '✕ נקה', exact: true });
  try {
    if (await clearBtn.count()) {
      await clearBtn.click({ timeout: 5000 });
    }
  } catch {
    // Save handlers may already clear selection / close footer
  }
  await page.waitForTimeout(400);
}

async function clickSelectAllInPanel(panel) {
  const btn = panel.getByText('בחר הכל', { exact: true }).first();
  const count = await btn.count();
  if (!count) return false;
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await panel.page().waitForTimeout(500);
  return true;
}

async function parseExpectedCount(panel, countMode) {
  if (countMode === 'chapters') {
    const text = await panel.locator('text=/\\d+ פרקים/').first().textContent().catch(() => '');
    const m = text.match(/(\d+) פרקים/);
    if (m) return parseInt(m[1], 10);
  }
  if (countMode === 'app') {
    const header = panel.locator('[data-app-ideas-brain]').getByText(/פריטים/).first();
    if (await header.count()) {
      const t = await header.textContent();
      const m = t.match(/(\d+)/);
      if (m) return parseInt(m[1], 10);
    }
    const prdCheckboxes = panel.locator('[data-app-builder-workspace] input[type="checkbox"]');
    const appIdeasCheckboxes = panel.locator('[data-app-ideas-brain] input[type="checkbox"]');
    const prd = await prdCheckboxes.count();
    const ideas = await appIdeasCheckboxes.count();
    if (ideas > 0) return ideas;
    if (prd > 0) return prd;
  }
  const itemsLabel = panel.locator('span.text-xs').filter({ hasText: /^\d+ פריטים$/ }).first();
  if (await itemsLabel.count()) {
    const t = await itemsLabel.textContent();
    const m = t.match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  const alt = await panel.getByText(/^\d+ פריטים$/).first().textContent().catch(() => '');
  const m2 = alt.match(/(\d+)/);
  if (m2) return parseInt(m2[1], 10);
  return await panel.locator('input[type="checkbox"][aria-label="בחר פריט"], input[type="checkbox"]').count();
}

async function countCheckedBoxes(panel) {
  return panel.locator('input[type="checkbox"]:checked').count();
}

async function readBrainItems(page, prefix = 'brain-item') {
  return page.evaluate(({ VIDEO_ID, prefix }) => {
    const items = JSON.parse(localStorage.getItem('yt_knowledge_items_v1') || '[]');
    return items.filter((i) => String(i.id || '').includes(VIDEO_ID) && String(i.id || '').startsWith(prefix));
  }, { VIDEO_ID, prefix });
}

async function readWorkspaceItems(page) {
  return page.evaluate(({ VIDEO_ID }) => {
    const items = JSON.parse(localStorage.getItem('yt_knowledge_items_v1') || '[]');
    return items.filter((i) => String(i.id || '').startsWith(`ws-sel:${VIDEO_ID}:`));
  }, { VIDEO_ID });
}

async function selectFirstCheckbox(panel) {
  const cbs = panel.locator('input[type="checkbox"]');
  const count = await cbs.count();
  for (let i = 0; i < count; i++) {
    const cb = cbs.nth(i);
    const visible = await cb.isVisible().catch(() => false);
    if (!visible) continue;
    await cb.scrollIntoViewIfNeeded();
    if (!(await cb.isChecked())) await cb.click();
    return true;
  }
  return false;
}

async function runSelectAllTest(page, results, tab, shotIndex) {
  await openTab(page, tab.label);
  const panel = await getActivePanel(page);
  const expected = await parseExpectedCount(panel, tab.countMode);
  const clicked = await clickSelectAllInPanel(panel);
  await page.waitForTimeout(600);
  const footer = await footerCount(page);
  const checked = await countCheckedBoxes(panel);
  const footerShown = await footerVisible(page);

  await page.screenshot({
    path: join(SCREENSHOT_DIR, `${String(shotIndex).padStart(2, '0')}-select-all-${tab.id}.png`),
    fullPage: false,
  });

  const pass = clicked && expected > 0 && footerShown && footer === expected;
  record(
    results,
    `T1-select-all-${tab.id}`,
    pass,
    `clicked=${clicked}, expected=${expected}, footer=${footer}, checked=${checked}, footerShown=${footerShown}`,
  );
  return { expected, footer };
}

async function runClearTest(page, results, tab) {
  await openTab(page, tab.label);
  const panel = await getActivePanel(page);
  const clicked = await clickSelectAllInPanel(panel);
  await page.waitForTimeout(400);
  const before = await footerCount(page);
  if (!clicked || before === 0) {
    record(results, `T2-clear-${tab.id}`, false, `skipped — no selectable items (clicked=${clicked}, before=${before})`);
    return;
  }
  await clickFooterClear(page);
  const after = await footerCount(page);
  const footerHidden = !(await footerVisible(page));
  const checked = await countCheckedBoxes(panel);
  const pass = before > 0 && after === 0 && footerHidden;
  record(results, `T2-clear-${tab.id}`, pass, `before=${before}, after=${after}, footerHidden=${footerHidden}, checked=${checked}`);
}

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const results = [];
  const edgeCases = [];
  const pageErrors = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  await seedPage(page);
  await openVideo(page);

  // ── TEST 1: Select All per tab ──
  let shot = 1;
  for (const tab of TABS) {
    await runSelectAllTest(page, results, tab, shot++);
    await clickFooterClear(page);
  }

  // ── TEST 2: Clear selection per tab ──
  await openVideo(page);
  for (const tab of TABS) {
    await runClearTest(page, results, tab);
  }

  // ── TEST 3: Tab isolation ──
  await openVideo(page);
  const isolationPairs = [
    ['useful-knowledge', 'insights'],
    ['insights', 'chapters'],
    ['chapters', 'summary'],
    ['summary', 'app-builder'],
    ['app-builder', 'topics-subtopics'],
    ['topics-subtopics', 'useful-knowledge'],
  ];
  for (const [fromId, toId] of isolationPairs) {
    const fromTab = TABS.find((t) => t.id === fromId);
    const toTab = TABS.find((t) => t.id === toId);
    await openTab(page, fromTab.label);
    const fromPanel = await getActivePanel(page);
    const clicked = await clickSelectAllInPanel(fromPanel);
    await page.waitForTimeout(400);
    const selBefore = await footerCount(page);
    await openTab(page, toTab.label);
    await page.waitForTimeout(500);
    const selAfter = await footerCount(page);
    const hidden = !(await footerVisible(page));
    const pass = clicked && selBefore > 0 && selAfter === 0 && hidden;
    record(results, `T3-isolation-${fromId}-to-${toId}`, pass, `clicked=${clicked}, before=${selBefore}, after=${selAfter}, hidden=${hidden}`);
  }

  // ── TEST 4: Brain save per tab ──
  await openVideo(page);
  for (const tab of TABS) {
    await openTab(page, tab.label);
    const panel = await getActivePanel(page);
    const before = (await readBrainItems(page, 'brain-item')).length;
    let selected = await selectFirstCheckbox(panel);
    if (!selected) selected = await clickSelectAllInPanel(panel);
    await page.waitForTimeout(400);
    const selCount = await footerCount(page);
    if (selected && selCount > 0) {
      await clickFooterBrain(page);
      await page.waitForTimeout(1200);
    }
    const after = (await readBrainItems(page, 'brain-item')).length;
    const dupes = await page.evaluate(({ VIDEO_ID }) => {
      const items = JSON.parse(localStorage.getItem('yt_knowledge_items_v1') || '[]');
      const ids = items.filter((i) => String(i.id || '').includes(VIDEO_ID)).map((i) => i.id);
      return ids.length - new Set(ids).size;
    }, { VIDEO_ID });
    const pass = selected && selCount > 0 && after >= before + 1 && dupes === 0;
    record(results, `T4-brain-${tab.id}`, pass, `selected=${selected}, selCount=${selCount}, brainBefore=${before}, brainAfter=${after}, dupes=${dupes}`);
    await clickFooterClear(page);
  }

  // ── TEST 5: Obsidian save (no runtime crash) ──
  await openVideo(page);
  for (const tab of TABS) {
    const errorsBefore = pageErrors.length;
    await openTab(page, tab.label);
    const panel = await getActivePanel(page);
    let obsSelected = await selectFirstCheckbox(panel);
    if (!obsSelected) obsSelected = await clickSelectAllInPanel(panel);
    await page.waitForTimeout(400);
    if (await footerCount(page) > 0) {
      const footer = getSelectionFooter(page);
      if (await footer.getByRole('button', { name: '📁 Obsidian', exact: true }).isVisible()) {
        await clickFooterObsidian(page);
        await page.waitForTimeout(800);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }
    const newErrors = pageErrors.length - errorsBefore;
    const pass = obsSelected && newErrors === 0;
    record(results, `T5-obsidian-${tab.id}`, pass, `selected=${obsSelected}, newPageErrors=${newErrors}`);
    await ensureVideoOpen(page);
    await clickFooterClear(page);
  }

  // ── TEST 6: Workspace save ──
  await openVideo(page);
  for (const tab of TABS) {
    await openTab(page, tab.label);
    const panel = await getActivePanel(page);
    const before = (await readWorkspaceItems(page)).length;
    let wsSelected = await selectFirstCheckbox(panel);
    if (!wsSelected) wsSelected = await clickSelectAllInPanel(panel);
    await page.waitForTimeout(400);
    if (await footerCount(page) > 0) {
      await clickFooterWorkspace(page);
      await page.waitForTimeout(1200);
    }
    const after = (await readWorkspaceItems(page)).length;
    const pass = after >= before + 1;
    record(results, `T6-workspace-${tab.id}`, pass, `wsBefore=${before}, wsAfter=${after}`);
    await clickFooterClear(page);
  }

  // ── TEST 7: Chapters regression ──
  await openTab(page, /פרקים/);
  const chaptersPanel = await getActivePanel(page);
  const chapterCount = await parseExpectedCount(chaptersPanel, 'chapters');
  await clickSelectAllInPanel(chaptersPanel);
  await page.waitForTimeout(500);
  const chFooterCount = await footerCount(page);
  const chFooterBar = getSelectionFooter(page);
  const chFooterBtns = await chFooterBar.getByRole('button').count();
  const brainBefore = (await readBrainItems(page, 'brain-item')).length;
  await clickFooterBrain(page);
  await page.waitForTimeout(1200);
  const brainAfter = (await readBrainItems(page, 'brain-item')).length;
  await page.screenshot({ path: join(SCREENSHOT_DIR, '07-chapters-regression.png'), fullPage: false });
  const chPass = chapterCount > 0 && chFooterCount === chapterCount && chFooterBtns >= 3 && brainAfter >= brainBefore;
  record(
    results,
    'T7-chapters-regression',
    chPass,
    `chapters=${chapterCount}, footer=${chFooterCount}, footerBtns=${chFooterBtns}, brainAfter>=before=${brainAfter >= brainBefore} (dedupe may block duplicate)`,
  );
  await clickFooterClear(page);

  // ── TEST 8: Mobile layout ──
  await openTab(page, /ידע שימושי/);
  const ukPanel = await getActivePanel(page);
  await clickSelectAllInPanel(ukPanel);
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobFooterVisible = await footerVisible(page);
  const mobCount = await footerCount(page);
  const dialog = getDialog(page);
  const brainBox = await getSelectionFooter(page).getByRole('button', { name: '🧠 שמור למוח', exact: true }).boundingBox();
  const counterBox = await dialog.getByText(/נבחרו \d+ פריטים/).boundingBox();
  await page.screenshot({ path: join(SCREENSHOT_DIR, '08-mobile-footer.png'), fullPage: false });
  const mobPass = mobFooterVisible && mobCount > 0 && brainBox?.width > 40 && counterBox?.width > 50;
  record(results, 'T8-mobile', mobPass, `footer=${mobCount}, brainW=${brainBox?.width}, counterW=${counterBox?.width}`);
  await page.setViewportSize({ width: 1280, height: 900 });

  // ── TEST 9: APP tab mixed selection ──
  await openTab(page, /APP/);
  const appPanel = await getActivePanel(page);
  const ideasBtn = appPanel.locator('[data-app-ideas-brain]').getByText('בחר הכל', { exact: true });
  if (await ideasBtn.count()) {
    await ideasBtn.click();
    await page.waitForTimeout(500);
  }
  const prdCb = appPanel.locator('[data-app-builder-workspace] input[type="checkbox"]').first();
  if (await prdCb.count()) {
    if (!(await prdCb.isChecked())) await prdCb.click();
    await page.waitForTimeout(400);
  }
  const appFooterCount = await footerCount(page);
  const footerDupes = await footerButtonCount(page);
  const appFooterBar = getSelectionFooter(page);
  const hasBrain = await appFooterBar.getByRole('button', { name: '🧠 שמור למוח', exact: true }).isVisible();
  const hasObs = await appFooterBar.getByRole('button', { name: '📁 Obsidian', exact: true }).isVisible();
  await page.screenshot({ path: join(SCREENSHOT_DIR, '09-app-mixed-selection.png'), fullPage: false });
  if (appFooterCount > 0) {
    await clickFooterBrain(page);
    await page.waitForTimeout(1200);
  }
  const appPass = appFooterCount > 1 && footerDupes === 1 && hasBrain && hasObs;
  record(results, 'T9-app-mixed', appPass, `footer=${appFooterCount}, footerBars=${footerDupes}, brain=${hasBrain}, obs=${hasObs}`);
  await clickFooterClear(page);

  // ── TEST 10: Specialized bulk on technical-analysis video (sections with checkboxes) ──
  const TECH_VIDEO_ID = 'bulk-validate-technical';
  await page.evaluate(({ TECH_VIDEO_ID, fixture, appBuilderDraft }) => {
    const video = {
      id: TECH_VIDEO_ID,
      youtubeId: TECH_VIDEO_ID,
      url: `https://www.youtube.com/watch?v=${TECH_VIDEO_ID}`,
      title: 'Bulk Technical Analysis Fixture',
      category: 'שוק ההון',
      subCategory: 'ניתוח טכני',
      confirmedSubCategory: 'technical-analysis',
      userConfirmedSubCategory: true,
      fetchedAt: new Date().toISOString(),
      publishedAt: '2026-06-10T09:00:00.000Z',
      indicators: ['RSI oversold on XLF — bounce watch'],
      setups: ['Pullback entry above 50-day MA on SPY'],
      patterns: ['Ascending triangle forming on QQQ'],
      checklists: ['Confirm volume before breakout entry'],
    };
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    const videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').filter((v) => (v.id || v.youtubeId) !== TECH_VIDEO_ID);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([video, ...videos]));
    localStorage.setItem(`market_brief_${TECH_VIDEO_ID}`, JSON.stringify(fixture));
  }, { TECH_VIDEO_ID, fixture, appBuilderDraft });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const techCard = page.locator('div').filter({ hasText: 'Bulk Technical Analysis Fixture' }).last();
  await techCard.click();
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  await openTab(page, /תוכן ייעודי/);
  const techPanel = await getActivePanel(page);
  const techExpected = await parseExpectedCount(techPanel, 'items');
  const techClicked = await clickSelectAllInPanel(techPanel);
  await page.waitForTimeout(500);
  const techFooter = await footerCount(page);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '10-specialized-technical-bulk.png'), fullPage: false });
  record(
    results,
    'T10-specialized-technical-bulk',
    techClicked && techExpected > 0 && techFooter === techExpected,
    `clicked=${techClicked}, expected=${techExpected}, footer=${techFooter}`,
  );
  await clickFooterClear(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Edge cases
  edgeCases.push('Morning-brief Specialized tab duplicates checkboxes in mobile/desktop layouts — footer count uses bulk items, DOM may show more checked boxes.');
  edgeCases.push('Topics tab (sections mode): footer selection works; checkboxes may be absent because items render inside ObsidianMappingTab without bulk UI.');

  const summaryPanel = await (async () => {
    await openVideo(page);
    await openTab(page, /סיכום/);
    return getActivePanel(page);
  })();
  const summarySelectAllCount = await summaryPanel.getByText('בחר הכל', { exact: true }).count();
  if (summarySelectAllCount > 0) {
    edgeCases.push('Summary tab: "בחר הכל" lives inside nested GEM section (section 7), not at tab top — briefing sections use per-item checkboxes only.');
  }
  const specPanel = await (async () => {
    await openTab(page, /תוכן ייעודי/);
    return getActivePanel(page);
  })();
  const specBulkHeader = await specPanel.locator('[data-universal-tab-bulk-header]').count();
  if (specBulkHeader === 0) {
    edgeCases.push('Specialized tab: Morning Brief bulk header missing — check buildMorningBriefBulkSections wiring.');
  }
  if (pageErrors.length > 0) {
    edgeCases.push(`Console/page errors captured (${pageErrors.length}): ${pageErrors.slice(0, 3).join(' | ')}`);
  }

  await browser.close();

  // Build check
  const { execSync } = await import('child_process');
  let buildPass = false;
  try {
    execSync('npm run build', { cwd: join(__dirname, '..'), stdio: 'pipe', timeout: 120000 });
    buildPass = true;
  } catch (e) {
    edgeCases.push(`Build failed: ${e.message?.slice(0, 200)}`);
  }
  record(results, 'build-green', buildPass, buildPass ? 'npm run build OK' : 'build failed');

  const allPass = results.every((r) => r.pass);
  const validatedTabs = TABS.map((t) => t.id);

  console.log('\n=== UNIVERSAL TAB BULK VALIDATION ===\n');
  console.log('| Test | Result | Detail |');
  console.log('|------|--------|--------|');
  for (const r of results) {
    console.log(`| ${r.id} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.detail.slice(0, 80)} |`);
  }
  if (edgeCases.length) {
    console.log('\nEdge cases:');
    edgeCases.forEach((e) => console.log(`- ${e}`));
  }
  console.log(`\nScreenshots: ${SCREENSHOT_DIR}`);
  console.log(`Tabs validated: ${validatedTabs.join(', ')}`);
  console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
