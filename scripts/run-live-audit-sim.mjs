import fs from 'fs';
import {
  getSpecializedSrc,
  extractMarketRegimeCards,
  extractSectorRows,
  extractCalendarRows,
  extractUnifiedStocks,
  extractOpportunityIdeas,
  extractRiskItems,
  extractMarketDashboardRows,
} from '../src/lib/morningBriefDisplay.js';
import { extractVideoTabItems } from '../src/config/videoTabsConfig.js';

const marketBriefData = JSON.parse(fs.readFileSync('./scripts/tmp-live-audit.json', 'utf8'));
const video = { id: 'test', confirmedSubCategory: 'morning-brief' };
const src = getSpecializedSrc(marketBriefData);

const stockTickers = new Set(extractUnifiedStocks(marketBriefData, video).map((s) => s.ticker));
const opps = extractOpportunityIdeas(src).filter((idea) => {
  const title = (idea.title || '').trim().toUpperCase();
  if (stockTickers.has(title) && title.length <= 5) return false;
  return true;
});

const counts = {
  regime: extractMarketRegimeCards(src).length,
  sectors: extractSectorRows(src).length,
  calendar: extractCalendarRows(src).length,
  stocks: extractUnifiedStocks(marketBriefData, video).length,
  opportunitiesRaw: extractOpportunityIdeas(src).length,
  opportunitiesAfterDedupe: opps.length,
  risks: extractRiskItems(src).length,
  markets: extractMarketDashboardRows(src).length,
  marketNews: extractVideoTabItems(video, 'market-news', marketBriefData).length,
  macro: extractVideoTabItems(video, 'brief-macro', marketBriefData).length,
  sentiment: extractVideoTabItems(video, 'brief-sentiment', marketBriefData).length,
  legacyCalendar: extractVideoTabItems(video, 'brief-calendar', marketBriefData).length,
  stocksMentionedLegacy: '(skipped — formatWatchlistItem throws on numeric level)',
  indices: extractVideoTabItems(video, 'indices', marketBriefData).length,
};

console.log(JSON.stringify(counts, null, 2));
console.log('stocks tickers:', [...stockTickers]);
console.log('sector rows:', extractSectorRows(src));
console.log('macro items:', extractVideoTabItems(video, 'brief-macro', marketBriefData));
console.log('sentiment items:', extractVideoTabItems(video, 'brief-sentiment', marketBriefData));
