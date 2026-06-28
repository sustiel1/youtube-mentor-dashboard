import { extractVideoTabItems } from '@/config/videoTabsConfig';
import { isRegimeDuplicateString } from '@/lib/morningBriefDisplay';
import { MORNING_BRIEF_SPECIALIZED_PRESENTATION } from '@/lib/morningBriefPresentation';
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

const sectionProps = (presentation, bulkSelection, bulkSections) => ({
  presentation,
  bulkSelection,
  bulkSections,
});

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
  presentation = MORNING_BRIEF_SPECIALIZED_PRESENTATION,
}) {
  const indicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
  const allNewsItems = extractVideoTabItems(effectiveVideo, 'market-news', marketBriefData);
  const plainNewsItems = allNewsItems
    .filter((i) => !looksLikeMarketIndex(i))
    .filter((i) => typeof i !== 'string' || !isRegimeDuplicateString(i));
  const macroItems = extractVideoTabItems(effectiveVideo, 'brief-macro', marketBriefData);
  const shared = sectionProps(presentation, bulkSelection, bulkSections);

  return (
    <div className="space-y-3" dir="rtl" data-morning-brief-dashboard>
      <NewsSection
        items={plainNewsItems}
        onSaveToBrain={onSaveToBrain}
        marketBriefData={marketBriefData}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
      <MarketRegimeSection
        marketBriefData={marketBriefData}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
      <SectorOverviewSection
        marketBriefData={marketBriefData}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
      <OpportunitiesRisksDashboard
        marketBriefData={marketBriefData}
        effectiveVideo={effectiveVideo}
        onSaveToBrain={onSaveToBrain}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
      <StocksMentionedSection
        marketBriefData={marketBriefData}
        effectiveVideo={effectiveVideo}
        onSaveToBrain={onSaveToBrain}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
      <EconomicCalendarSection
        marketBriefData={marketBriefData}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
      <MacroSection
        items={macroItems}
        marketBriefData={marketBriefData}
        onSaveToBrain={onSaveToBrain}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
      <SentimentSection
        marketBriefData={marketBriefData}
        {...shared}
      />
      <MarketsSection
        marketBriefData={marketBriefData}
        indicesItems={indicesItems}
        onSaveToBrain={(text) => onSaveToBrain(text, 'indices', '📈 שווקים')}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
    </div>
  );
}
