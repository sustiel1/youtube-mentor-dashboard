import fs from 'fs';
import {
  mergeMorningBriefSpecializedSource,
  getSpecializedSrc,
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

const full = JSON.parse(fs.readFileSync('./scripts/tmp-live-audit.json', 'utf8'));

function audit(label, mbd) {
  const raw = mbd.rawData || {};
  const spec = mbd.universalTabs?.specialized || {};
  const src = getSpecializedSrc(mbd);

  const rows = [
    ['marketOverview', countSpecializedLayer(raw, 'marketOverview'), countSpecializedLayer(spec, 'marketOverview'), extractMarketRegimeCards(src).length],
    ['stocksMentioned', countSpecializedLayer(raw, 'stocksMentioned'), countSpecializedLayer(spec, 'stocksMentioned'), extractUnifiedStocks(mbd, null).length],
    ['sectorRotation', countSpecializedLayer(raw, 'sectorRotation'), countSpecializedLayer(spec, 'sectorRotation'), extractSectorRows(src).length],
    ['economicCalendar', countSpecializedLayer(raw, 'economicCalendar'), countSpecializedLayer(spec, 'economicCalendar'), extractCalendarRows(src).length],
    ['risks', countSpecializedLayer(raw, 'risks'), countSpecializedLayer(spec, 'risks'), extractRiskItems(src).length],
    ['sentiment', countSpecializedLayer(raw, 'sentiment'), countSpecializedLayer(spec, 'sentiment'), extractSentimentItems(src).length],
    ['earnings', countSpecializedLayer(raw, 'earnings'), countSpecializedLayer(spec, 'earnings'), extractEarningsRows(src).length],
    ['watchlistLevels', countSpecializedLayer(raw, 'watchlistLevels'), countSpecializedLayer(spec, 'watchlistLevels'), extractWatchlistLevelRows(src).length],
    ['keyLevels', countSpecializedLayer(raw, 'keyLevels'), countSpecializedLayer(spec, 'keyLevels'), extractKeyLevelRows(src).length],
  ];

  console.log(`\n=== ${label} ===`);
  console.log('Section | rawData | specialized | merged');
  for (const r of rows) console.log(`${r[0]} | ${r[1]} | ${r[2]} | ${r[3]}`);
}

const sparse = {
  contentType: 'marketBrief',
  rawData: full.rawData,
  universalTabs: { specialized: {
    marketOverview: full.universalTabs.specialized.marketOverview,
    indices: full.universalTabs.specialized.indices,
    marketNews: full.universalTabs.specialized.marketNews,
  }},
};

audit('FULL JSON', full);
audit('SPARSE specialized + full rawData', sparse);
audit('rawData ONLY', { contentType: 'marketBrief', rawData: full.rawData });
