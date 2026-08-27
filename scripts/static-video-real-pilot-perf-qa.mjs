import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:5184/static-video-real-pilot-qa.html';
const TAB_NAMES = ['סיכום', 'תובנות', 'ידע שימושי', 'תוכן ייעודי'];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function measure(page, timestamps) {
  await page.goto(`${BASE_URL}?timestamps=${timestamps ? '1' : '0'}`, { waitUntil: 'domcontentloaded' });

  for (const name of TAB_NAMES) {
    await page.getByRole('tab', { name, exact: true }).click();
  }

  const rounds = [];
  for (let round = 0; round < 3; round += 1) {
    const timings = {};
    for (const name of TAB_NAMES) {
      const startedAt = await page.evaluate(() => performance.now());
      await page.getByRole('tab', { name, exact: true }).click();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const endedAt = await page.evaluate(() => performance.now());
      timings[name] = Number((endedAt - startedAt).toFixed(3));
    }
    rounds.push(timings);
  }

  return {
    rounds,
    medians: Object.fromEntries(TAB_NAMES.map((name) => [
      name,
      Number(median(rounds.map((round) => round[name])).toFixed(3)),
    ])),
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const baseline = await measure(page, false);
const enabled = await measure(page, true);
const regressions = Object.fromEntries(TAB_NAMES.map((name) => [
  name,
  Number((((enabled.medians[name] - baseline.medians[name]) / baseline.medians[name]) * 100).toFixed(2)),
]));
const overallBaseline = median(Object.values(baseline.medians));
const overallEnabled = median(Object.values(enabled.medians));
const overallRegression = Number((((overallEnabled - overallBaseline) / overallBaseline) * 100).toFixed(2));

console.log(JSON.stringify({ baseline, enabled, regressions, overallRegression }, null, 2));
await context.close();
await browser.close();
