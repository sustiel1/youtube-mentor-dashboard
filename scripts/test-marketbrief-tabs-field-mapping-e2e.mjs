/**
 * Focused browser regression check for the Market Brief field-mapping fixes:
 * Insights, Useful Knowledge, APP Builder, and Summary all failed to surface
 * data from a pasted contentType: 'marketBrief' GEM JSON (no universalTabs,
 * no rawData wrapper) because several field-recognition lists didn't know
 * about `note`, `learningInsights`, or `appBuilding.dashboardIdeas`/
 * `newIndicators`. This seeds one video with the new schema and one with the
 * legacy schema (explicit text/insight fields) to prove the fix is additive
 * and does not change legacy rendering.
 *
 * Follows the same seed/open/assert pattern as
 * scripts/test-chapters-marketbrief-e2e.mjs / scripts/useful-knowledge-p1-validate.mjs.
 *
 * Run: node scripts/test-marketbrief-tabs-field-mapping-e2e.mjs  (dev server on :5184)
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5184';
const NEW_SCHEMA_VIDEO_ID = 'marketbrief-fields-e2e-new-schema';
const LEGACY_SCHEMA_VIDEO_ID = 'marketbrief-fields-e2e-legacy-schema';

const NOTE_TEXT = 'תובנה ייחודית לבדיקת השדה note';
const ASSET_LABEL = 'ביטקוין בדיקה';
const TICKER_LABEL = 'TESTBTC';
const LEARNING_INSIGHT_TEXT = 'תובנת למידה ממוקדת בדיקה לבדיקת learningInsights';
const DASHBOARD_IDEA_TITLE_HE = 'לוח מעקב בדיקה ייחודי לבדיקת appBuilding';
const LEGACY_INSIGHT_TEXT = 'תובנה legacy עם שדה text ישן שלא אמור להשתנות';
const LEGACY_SUBJECT_THAT_MUST_NOT_PREFIX = 'ISHOULDNOTPREFIX';

const newSchemaMarketBriefData = {
  contentType: 'marketBrief',
  videoType: 'open',
  channelName: 'E2E Fixture Channel',
  top5Insights: [
    {
      rank: 1,
      asset: ASSET_LABEL,
      ticker: TICKER_LABEL,
      level: '66400',
      category: 'technical',
      significance: 'critical',
      note: NOTE_TEXT,
      action: 'watch',
    },
  ],
  learningInsights: [
    {
      insight: LEARNING_INSIGHT_TEXT,
      category: 'psychology',
      whyImportant: 'כדי לוודא שהתובנה מוצגת בטאב ידע שימושי',
      applicableToApp: true,
    },
  ],
  appBuilding: {
    dashboardIdeas: [
      {
        idea: DASHBOARD_IDEA_TITLE_HE,
        component: 'TestDashboardWidget',
        dataSource: 'e2e-fixture',
        whyUseful: 'עוזר לבדוק שהרעיון המפורש מוצג בפועל בטאב APP ולא רק ההיוריסטיקה',
        priority: 'high',
      },
    ],
    newIndicators: [],
    existingIndicators: [],
    dataConnections: [],
    alerts: [],
    noNewIndicators: false,
  },
  marketOverview: { generalMood: 'bullish', summary: 'בדיקת E2E למיפוי שדות' },
};

const legacySchemaMarketBriefData = {
  contentType: 'marketBrief',
  videoType: 'open',
  channelName: 'E2E Fixture Channel',
  top5Insights: [
    {
      rank: 1,
      asset: LEGACY_SUBJECT_THAT_MUST_NOT_PREFIX,
      ticker: 'XXX',
      category: 'technical',
      text: LEGACY_INSIGHT_TEXT,
      action: 'watch',
    },
  ],
  marketOverview: { generalMood: 'neutral', summary: 'בדיקת legacy' },
};

function buildVideo(id, marketBriefData, title) {
  return {
    id,
    youtubeId: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
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
}

function record(results, id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id}: ${detail}`);
}

async function seed(page, videos) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ videos, ids }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { existing = []; }
    const rest = existing.filter((v) => !ids.includes(v.id || v.youtubeId));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...videos, ...rest]));
    for (const v of videos) {
      localStorage.setItem(`market_brief_${v.id}`, JSON.stringify(v.marketBriefData));
    }
  }, { videos, ids: videos.map((v) => v.id) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

async function openVideo(page, title) {
  const card = page.locator('div').filter({ hasText: title }).last();
  await card.waitFor({ timeout: 20000 });
  await card.click();
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  await page.waitForTimeout(600);
}

async function openTab(page, namePattern) {
  const tab = page.getByRole('tab', { name: namePattern }).first();
  await tab.waitFor({ timeout: 15000 });
  await tab.click();
  await page.waitForTimeout(800);
}

async function closePanel(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

async function bodyContains(page, text) {
  return (await page.getByText(text).count()) > 0;
}

async function main() {
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const newVideo = buildVideo(NEW_SCHEMA_VIDEO_ID, newSchemaMarketBriefData, 'Fields E2E New Schema Video');
  const legacyVideo = buildVideo(LEGACY_SCHEMA_VIDEO_ID, legacySchemaMarketBriefData, 'Fields E2E Legacy Schema Video');
  await seed(page, [newVideo, legacyVideo]);

  // ── New-schema video: Insights tab must show `note` text ──
  await openVideo(page, 'Fields E2E New Schema Video');
  await openTab(page, /תובנות/);
  record(results, '1-insights-note-renders', await bodyContains(page, NOTE_TEXT), `looked for "${NOTE_TEXT}"`);

  // ── New-schema video: Useful Knowledge tab must show learningInsights ──
  await openTab(page, /ידע שימושי/);
  record(results, '2-useful-knowledge-learninginsights-renders', await bodyContains(page, LEARNING_INSIGHT_TEXT), `looked for "${LEARNING_INSIGHT_TEXT}"`);

  // ── New-schema video: APP tab must show explicit appBuilding idea ──
  await openTab(page, /APP/);
  record(results, '3-app-builder-explicit-idea-renders', await bodyContains(page, DASHBOARD_IDEA_TITLE_HE), `looked for "${DASHBOARD_IDEA_TITLE_HE}"`);

  // ── New-schema video: Summary tab must show readable note text, not a raw key-dump ──
  await openTab(page, /סיכום/);
  const summaryHasNote = await bodyContains(page, NOTE_TEXT);
  const summaryHasRawDump = await bodyContains(page, 'rank:');
  record(results, '4-summary-shows-readable-note', summaryHasNote, `looked for "${NOTE_TEXT}"`);
  record(results, '5-summary-no-raw-dump', !summaryHasRawDump, `checked absence of "rank:" — found=${summaryHasRawDump}`);

  // ── Legacy-schema video: existing `text` field must render unprefixed/unchanged ──
  await closePanel(page);
  await openVideo(page, 'Fields E2E Legacy Schema Video');
  await openTab(page, /תובנות/);
  const legacyRendersOwnText = await bodyContains(page, LEGACY_INSIGHT_TEXT);
  const legacyWronglyPrefixed = await bodyContains(page, `${LEGACY_SUBJECT_THAT_MUST_NOT_PREFIX}:`);
  record(results, '6-legacy-text-field-unchanged', legacyRendersOwnText, `looked for "${LEGACY_INSIGHT_TEXT}"`);
  record(results, '7-legacy-not-wrongly-prefixed', !legacyWronglyPrefixed, `checked absence of "${LEGACY_SUBJECT_THAT_MUST_NOT_PREFIX}:" — found=${legacyWronglyPrefixed}`);

  await browser.close();

  const allPass = results.every((r) => r.pass);
  console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
