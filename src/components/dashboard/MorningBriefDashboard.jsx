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
  StockFundamentalsSection,
  StockTechnicalsSection,
  StocksMentionedSection,
} from './MorningBriefPanels';

const MARKET_FIELD_RE = /\b(direction|change|level)\s*:/;
function looksLikeMarketIndex(item) {
  if (item && typeof item === 'object') {
    const source = item.rowTimestampSourceItem || item;
    const identity = source.asset || source.index || source.symbol || source.ticker || source.name;
    const marketValue = source.direction || source.change || source.level || source.trend || source.strength || source.comment;
    return Boolean(identity && marketValue);
  }
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
 * Morning Brief dashboard — sentiment-first presentation order.
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
  // Opt-in only — default false so this exact same dashboard, when rendered
  // for a real morning/evening brief (SpecializedContentRenderer.jsx's
  // morning-brief/evening-brief/weekly-brief/earnings-brief branches, which
  // never pass this prop), never shows these two sections — not even their
  // empty state. Only the fundamental-analysis/technical-analysis branch
  // passes true. See docs/plan/AUDIT-TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY.md Step 12.
  showStockDataSections = false,
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
      <SentimentSection
        marketBriefData={marketBriefData}
        {...shared}
      />
      <MarketRegimeSection
        marketBriefData={marketBriefData}
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
      <NewsSection
        items={plainNewsItems}
        onSaveToBrain={onSaveToBrain}
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
      <SectorOverviewSection
        marketBriefData={marketBriefData}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
      <MarketsSection
        marketBriefData={marketBriefData}
        indicesItems={indicesItems}
        onSaveToBrain={(text) => onSaveToBrain(text, 'indices', '📈 שווקים')}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
      {showStockDataSections ? (
        <>
          <StockFundamentalsSection
            marketBriefData={marketBriefData}
            effectiveVideo={effectiveVideo}
            onSaveToBrain={onSaveToBrain}
            {...shared}
          />
          <StockTechnicalsSection
            marketBriefData={marketBriefData}
            effectiveVideo={effectiveVideo}
            onSaveToBrain={onSaveToBrain}
            {...shared}
          />
        </>
      ) : null}
      <StocksMentionedSection
        marketBriefData={marketBriefData}
        effectiveVideo={effectiveVideo}
        onSaveToBrain={onSaveToBrain}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        {...shared}
      />
    </div>
  );
}
