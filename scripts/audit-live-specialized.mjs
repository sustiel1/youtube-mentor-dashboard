/**
 * Runtime audit: rawData vs universalTabs.specialized vs merged source.
 * Run with dev server: node scripts/audit-live-specialized.mjs
 */
import { chromium } from 'playwright';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  getSpecializedSrc,
  mergeMorningBriefSpecializedSource,
  countSpecializedLayer,
  extractMarketRegimeCards,
  extractSectorRows,
  extractCalendarRows,
  extractUnifiedStocks,
  extractOpportunityIdeas,
  extractRiskItems,
  extractMarketDashboardRows,
  extractSentimentItems,
  extractEarningsRows,
  extractWatchlistLevelRows,
  extractKeyLevelRows,
} from '../src/lib/morningBriefDisplay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SECTIONS = [
  { name: 'marketOverview', merged: (src) => extractMarketRegimeCards(src).length, keys: ['marketOverview'] },
  { name: 'indices', merged: (src) => extractMarketDashboardRows(src).length, keys: ['indices'] },
  { name: 'marketNews', merged: (src) => (src?.marketNews?.length || 0) + (src?.marketOverview ? 1 : 0), keys: ['marketNews'] },
  { name: 'macroFactors', merged: (src) => src?.macroFactors?.length || 0, keys: ['macroFactors'] },
  { name: 'stocksMentioned', merged: (src, v, mbd) => extractUnifiedStocks(mbd, v).length, keys: ['stocksMentioned'] },
  { name: 'watchlistLevels', merged: (src) => extractWatchlistLevelRows(src).length, keys: ['watchlistLevels'] },
  { name: 'keyLevels', merged: (src) => extractKeyLevelRows(src).length, keys: ['keyLevels'] },
  { name: 'catalysts', merged: (src) => {
    const cal = extractCalendarRows(src);
    return cal.filter((r) => /catalyst|cpi|fomc|nfp/i.test(r.event || '')).length || countSpecializedLayer(src, 'catalysts');
  }, keys: ['catalysts'] },
  { name: 'sectorRotation', merged: (src) => extractSectorRows(src).length, keys: ['sectorRotation'] },
  { name: 'tradingOpportunities', merged: (src) => extractOpportunityIdeas(src).length, keys: ['tradingOpportunities', 'opportunities'] },
  { name: 'economicCalendar', merged: (src) => extractCalendarRows(src).length, keys: ['economicCalendar', 'calendar'] },
  { name: 'earnings', merged: (src) => extractEarningsRows(src).length, keys: ['earnings'] },
  { name: 'risks', merged: (src) => extractRiskItems(src).length, keys: ['risks'] },
  { name: 'sentiment', merged: (src) => extractSentimentItems(src).length, keys: ['sentiment'] },
];

function layerCount(layer, keys) {
  return keys.reduce((sum, k) => sum + countSpecializedLayer(layer, k), 0);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const baseUrl = process.env.AUDIT_URL || 'http://localhost:5184/';
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  const storage = await page.evaluate(() => {
    const videos = JSON.parse(localStorage.getItem('yt_mentor_videos_v2') || '[]');
    const briefKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('market_brief_')) briefKeys.push(k);
    }
    const briefs = {};
    for (const k of briefKeys) briefKeys.forEach((key) => {
      try { briefs[key] = JSON.parse(localStorage.getItem(key)); } catch { briefs[key] = null; }
    });
    return { videos, briefKeys, briefs };
  });

  console.log('\n=== LIVE MERGE AUDIT ===\n');
  console.log('market_brief_* keys:', storage.briefKeys.length);

  let targetKey = storage.briefKeys[0];
  let targetBrief = targetKey ? storage.briefs[targetKey] : null;
  let targetVideo = null;

  for (const v of storage.videos) {
    const key = `market_brief_${v.id || v.youtubeId}`;
    if (storage.briefs[key]) {
      targetKey = key;
      targetBrief = storage.briefs[key];
      targetVideo = v;
      break;
    }
  }

  if (!targetBrief) {
    console.log('No market_brief_* in localStorage.');
    await browser.close();
    return;
  }

  const raw = targetBrief.rawData || {};
  const spec = targetBrief.universalTabs?.specialized || {};
  const merged = mergeMorningBriefSpecializedSource(targetBrief);
  const src = getSpecializedSrc(targetBrief);
  const video = targetVideo || { id: 'audit' };

  console.log('briefKey:', targetKey);
  console.log('videoTitle:', targetVideo?.title || '(no video row)');
  console.log('subCategory:', targetVideo?.confirmedSubCategory || targetVideo?.subCategory);

  // Open video + specialized tab for DOM counts
  if (targetVideo?.title) {
    const card = page.locator('div').filter({ hasText: targetVideo.title }).last();
    if (await card.count()) {
      await card.click();
      await page.waitForTimeout(1500);
      const tab = page.getByRole('tab', { name: /תוכן ייעודי|ייעודי/ }).first();
      if (await tab.count()) {
        await tab.click();
        await page.waitForTimeout(1200);
      }
    }
  }

  const domLabels = await page.evaluate(() => {
    const root = document.querySelector('[role="tabpanel"][data-state="active"]');
    if (!root) return {};
    const text = root.innerText || '';
    return {
      marketOverview: text.includes('לוח בקרה') ? 1 : 0,
      stocksMentioned: root.querySelectorAll('[data-stock-card]').length,
      sectorRotation: text.includes('סקטורים') ? 1 : 0,
      economicCalendar: text.includes('לוח כלכלי') ? 1 : 0,
      earnings: text.includes('דוחות רווח') ? 1 : 0,
      sentiment: text.includes('סנטימנט') ? 1 : 0,
      watchlistLevels: text.includes('רמות מעקב') ? 1 : 0,
      keyLevels: text.includes('רמות מפתח') ? 1 : 0,
      risks: text.includes('סיכונים ואזהרות') ? 1 : 0,
      opportunities: text.includes('הזדמנויות וסטאפים') ? 1 : 0,
      indices: text.includes('שווקים') ? 1 : 0,
      marketNews: text.includes('חדשות') ? 1 : 0,
      macroFactors: text.includes('מאקרו') ? 1 : 0,
    };
  });

  console.log('\nSection | rawData | specialized | merged | DOM');
  console.log('--------|---------|-------------|--------|----');
  for (const s of SECTIONS) {
    const rawC = layerCount(raw, s.keys);
    const specC = layerCount(spec, s.keys);
    const mergedC = s.merged(src, video, targetBrief);
    const domC = domLabels[s.name] ?? '—';
    console.log(`${s.name} | ${rawC} | ${specC} | ${mergedC} | ${domC}`);
  }

  await page.screenshot({ path: join(__dirname, 'audit-live-specialized.png'), fullPage: false });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
