import { extractVideoTabItems } from '@/config/videoTabsConfig';
import { isRegimeDuplicateString } from '@/lib/morningBriefDisplay';
import {
  EconomicCalendarSection,
  MacroSection,
  MarketRegimeSection,
  MarketsSection,
  NewsSection,
  OpportunitiesRisksDashboard,
  SectorOverviewSection,
  SentimentSection,
  StocksMentionedSection,
} from './MorningBriefPanels';

const MARKET_FIELD_RE = /\b(direction|change|level)\s*:/;
function looksLikeMarketIndex(item) {
  if (item && typeof item === 'object') return true;
  if (typeof item !== 'string') return false;
  const ci = item.indexOf(':');
  if (ci === -1) return false;
  const tickerPart = item.slice(0, ci).trim();
  const rest = item.slice(ci + 1);
  return tickerPart.length <= 12 && MARKET_FIELD_RE.test(rest);
}

/**
 * Morning Brief dashboard — news-first section order.
 * Always renders all sections — empty states when data is sparse.
 * Presentation only; no GEM / extraction changes.
 */
export function MorningBriefDashboard({
  effectiveVideo,
  marketBriefData,
  onSaveToBrain,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
}) {
  const indicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
  const allNewsItems = extractVideoTabItems(effectiveVideo, 'market-news', marketBriefData);
  const plainNewsItems = allNewsItems
    .filter((i) => !looksLikeMarketIndex(i))
    .filter((i) => typeof i !== 'string' || !isRegimeDuplicateString(i));
  const macroItems = extractVideoTabItems(effectiveVideo, 'brief-macro', marketBriefData);

  return (
    <div className="space-y-3" dir="rtl" data-morning-brief-dashboard>
      <NewsSection
        items={plainNewsItems}
        onSaveToBrain={onSaveToBrain}
        marketBriefData={marketBriefData}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
      <MarketRegimeSection
        marketBriefData={marketBriefData}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
      <SectorOverviewSection
        marketBriefData={marketBriefData}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
      <OpportunitiesRisksDashboard
        marketBriefData={marketBriefData}
        effectiveVideo={effectiveVideo}
        onSaveToBrain={onSaveToBrain}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
      <StocksMentionedSection
        marketBriefData={marketBriefData}
        effectiveVideo={effectiveVideo}
        onSaveToBrain={onSaveToBrain}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
      <EconomicCalendarSection
        marketBriefData={marketBriefData}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
      <MacroSection
        items={macroItems}
        marketBriefData={marketBriefData}
        onSaveToBrain={onSaveToBrain}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
      <SentimentSection
        marketBriefData={marketBriefData}
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
      <MarketsSection
        marketBriefData={marketBriefData}
        indicesItems={indicesItems}
        onSaveToBrain={(text) => onSaveToBrain(text, 'indices', '📈 שווקים')}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
    </div>
  );
}
