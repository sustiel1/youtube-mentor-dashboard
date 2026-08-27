import { chromium } from 'playwright';

const APP_URL = process.env.YMD_APP_URL || 'http://127.0.0.1:5184/';
const VIDEO_ID = 'YMDstat0001';
const ITEM_COUNT = 80;

const makeItems = (prefix) => Array.from({ length: ITEM_COUNT }, (_, index) => {
  if (index === 0) return { text: `${prefix} 1`, timestampSeconds: 729 };
  if (index === 1) return { text: `${prefix} 2`, estimatedStartSeconds: 729, timestampKind: 'estimated' };
  if (index === 2) return { text: `${prefix} 3`, timestampSeconds: 0 };
  if (index === 3) return { text: `${prefix} 4`, estimatedStartSeconds: 'invalid' };
  return {
    text: `${prefix} ${index + 1}`,
    estimatedStartSeconds: index * 37,
    timestampKind: 'estimated',
  };
});

const video = {
  id: VIDEO_ID,
  youtubeId: VIDEO_ID,
  url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  title: 'Static Timestamp Performance Fixture',
  category: 'למידה',
  subCategory: 'כללי',
  fetchedAt: new Date().toISOString(),
  mentorId: 'static-time-perf-mentor',
  mentorName: 'Static Time QA',
  shortSummary: 'סיכום בדיקה מבודד',
  keyPoints: process.env.YMD_PERF_SUMMARY_ITEMS === '1' ? makeItems('נקודת מפתח') : [],
  keyInsights: makeItems('תובנה'),
  actionItems: makeItems('פעולה'),
  frameworks: makeItems('מסגרת'),
  tradingPrinciples: makeItems('עיקרון'),
  chapters: [{ title: 'פרק בדיקה', startSeconds: 0, endSeconds: 60 }],
};

const tabs = [
  { value: 'summary', name: /סיכום/ },
  { value: 'insights', name: /תובנות/ },
  { value: 'chapters', name: /פרקים/ },
  { value: 'useful-knowledge', name: /ידע שימושי/ },
  { value: 'specialized', name: /תוכן ייעודי|ייעודי/ },
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    globalThis.__staticTimeLongTasks = [];
    if ('PerformanceObserver' in globalThis) {
      const observer = new PerformanceObserver((list) => {
        globalThis.__staticTimeLongTasks.push(...list.getEntries().map((entry) => entry.duration));
      });
      try { observer.observe({ type: 'longtask', buffered: true }); } catch { /* unsupported */ }
    }
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ video, VIDEO_ID }) => {
    const storageKey = 'yt_mentor_videos_v2';
    let videos = [];
    try { videos = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { videos = []; }
    localStorage.setItem(storageKey, JSON.stringify([
      video,
      ...videos.filter((item) => (item.id || item.youtubeId) !== VIDEO_ID),
    ]));
  }, { video, VIDEO_ID });

  await page.reload({ waitUntil: 'domcontentloaded' });
  const card = page.getByText(video.title, { exact: true }).first();
  await card.waitFor({ timeout: 20000 });
  await card.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]').click();
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });

  const rounds = [];
  const timestampButtonCountsByTab = {};
  const formatterInvocationCountsByTab = {};
  const horizontalOverflowByTab = {};
  for (let round = 0; round < 3; round += 1) {
    const timings = {};
    for (const tab of tabs) {
      const trigger = page.getByRole('tab', { name: tab.name }).first();
      if (!(await trigger.count())) {
        timings[tab.value] = null;
        continue;
      }
      const startedAt = await page.evaluate(() => performance.now());
      await trigger.click();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const endedAt = await page.evaluate(() => performance.now());
      timings[tab.value] = Number((endedAt - startedAt).toFixed(3));
      const activePanel = page.locator('[role="tabpanel"][data-state="active"]');
      timestampButtonCountsByTab[tab.value] = await activePanel.locator('[data-static-video-time]').count();
      formatterInvocationCountsByTab[tab.value] = await activePanel.locator('[data-static-time-candidate]').count();
      horizontalOverflowByTab[tab.value] = await page.evaluate(() => (
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      ));
    }
    rounds.push(timings);
  }

  const medians = Object.fromEntries(tabs.map(({ value }) => {
    const values = rounds.map((round) => round[value]).filter(Number.isFinite);
    return [value, Number(median(values).toFixed(3))];
  }));
  const diagnostics = await page.evaluate(() => ({
    timestampButtons: document.querySelectorAll('[data-static-video-time]').length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    longTasks: globalThis.__staticTimeLongTasks || [],
    heapBytes: performance.memory?.usedJSHeapSize ?? null,
  }));

  const insightsTab = page.getByRole('tab', { name: /תובנות/ }).first();
  await insightsTab.click();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  const firstLinks = await page.locator('[data-static-video-time]').evaluateAll((links) => links.slice(0, 3).map((link) => ({
    href: link.href,
    label: link.textContent.trim(),
    ariaLabel: link.getAttribute('aria-label'),
    target: link.target,
    rel: link.rel,
  })));
  const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (!wasDark) {
    await page.getByTestId('dashboard-theme-toggle').evaluate((button) => button.click());
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    await page.waitForTimeout(250);
  }
  const darkModeStyles = await page.evaluate(() => {
    const link = document.querySelector('[data-static-video-time]');
    const style = link ? getComputedStyle(link) : null;
    const result = style ? {
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      className: link.className,
      htmlDark: document.documentElement.classList.contains('dark'),
      bodyDark: document.body.classList.contains('dark'),
      darkSelectorMatches: link.matches('.dark\\:bg-zinc-800\\/70:is(.dark *)'),
    } : null;
    return result;
  });
  if (!wasDark) await page.getByTestId('dashboard-theme-toggle').evaluate((button) => button.click());
  const chapterTab = page.getByRole('tab', { name: /פרקים/ }).first();
  await chapterTab.click();
  const chapterTimestampButtons = await page.locator('[data-static-video-time]').count();

  await insightsTab.click();
  await page.evaluate(() => {
    globalThis.__transcriptMatcherCalls = 0;
    globalThis.findTranscriptReference = () => { globalThis.__transcriptMatcherCalls += 1; };
    globalThis.textMatchScore = () => { globalThis.__transcriptMatcherCalls += 1; };
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-static-video-time]')) event.preventDefault();
    }, { capture: true, once: true });
  });
  await page.locator('[data-static-video-time]').first().click();
  const transcriptMatcherCallsAfterClick = await page.evaluate(() => globalThis.__transcriptMatcherCalls);
  const countBeforeReload = await page.locator('[data-static-video-time]').count();

  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloadedCard = page.getByText(video.title, { exact: true }).first();
  await reloadedCard.waitFor({ timeout: 20000 });
  await reloadedCard.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]').click();
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  await page.getByRole('tab', { name: /תובנות/ }).first().click();
  const countAfterReload = await page.locator('[data-static-video-time]').count();

  console.log(JSON.stringify({
    rounds,
    medians,
    diagnostics,
    timestampButtonCountsByTab,
    formatterInvocationCountsByTab,
    horizontalOverflowByTab,
    functional: {
      firstLinks,
      darkModeStyles,
      chapterTimestampButtons,
      transcriptMatcherCallsAfterClick,
      countBeforeReload,
      countAfterReload,
    },
  }, null, 2));
  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
