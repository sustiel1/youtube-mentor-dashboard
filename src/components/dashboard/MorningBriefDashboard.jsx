import { extractVideoTabItems } from '@/config/videoTabsConfig';
import { isRegimeDuplicateString } from '@/lib/morningBriefDisplay';
import {
  MORNING_BRIEF_SPECIALIZED_PRESENTATION,
  resolveMarketBriefSectionOrder,
  resolveMorningBriefPresentation,
} from '@/lib/morningBriefPresentation';
import { translateDisplayLabel } from '@/lib/specializedDisplayI18n';
import { ExternalSymbolLink, SectionCard } from './MorningBriefVisualPrimitives';
import { SemanticTableRow } from './briefTableLayout';
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

const STRUCTURED_FIELDS = {
  'company-events': [
    ['event', 'אירוע'], ['affectedStocks', 'נכסים'], ['timeframe', 'מועד'],
  ],
  levels: [
    ['symbol', 'נכס'], ['level', 'רמה'], ['type', 'סוג'], ['condition', 'תנאי'], ['note', 'הערה'],
  ],
  'top-insights': [
    ['rank', 'דירוג'], ['insight', 'תובנה'], ['whyImportant', 'למה חשוב'], ['action', 'פעולה'],
  ],
  'learning-insights': [
    ['lesson', 'לקח'], ['reason', 'הסבר'], ['action', 'יישום'],
  ],
  'all-points': [
    ['point', 'נקודה'], ['category', 'קטגוריה'], ['significance', 'חשיבות'],
  ],
};

function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value === true) return 'כן';
  if (value === false) return 'לא';
  return translateDisplayLabel(value);
}

function StructuredAssetLinks({ value }) {
  const assets = (Array.isArray(value) ? value : [value])
    .map((asset) => String(asset || '').trim())
    .filter(Boolean);
  if (!assets.length) return '—';
  return assets.map((asset, index) => (
    <span key={`${asset}:${index}`} className="inline-flex items-center">
      {index > 0 ? <span aria-hidden="true" className="ml-1">,</span> : null}
      <ExternalSymbolLink symbol={asset} verifiedAssetOnly>{asset}</ExternalSymbolLink>
    </span>
  ));
}

function renderStructuredValue(sectionKey, fieldKey, value) {
  const isCompanyAsset = sectionKey === 'company-events' && fieldKey === 'affectedStocks';
  const isLevelAsset = sectionKey === 'levels' && fieldKey === 'symbol';
  return isCompanyAsset || isLevelAsset
    ? <StructuredAssetLinks value={value} />
    : (displayValue(value) || '—');
}

const ACTION_LABELS_HE = Object.freeze({
  watch: 'מעקב', avoid: 'להימנע', buy: 'קנייה', sell: 'מכירה', alert: 'התראה',
});

const INSIGHT_TABLE_LAYOUT = Object.freeze({
  'top-insights': { required: new Set(['rank', 'insight']), primary: 'insight', widths: { rank: 'w-14', insight: 'w-[48%]', whyImportant: 'w-[32%]', action: 'w-24' } },
  'learning-insights': { required: new Set(['lesson']), primary: 'lesson', widths: { lesson: 'w-[55%]', reason: 'w-[30%]', action: 'w-[15%]' } },
});

function structuredDisplayValue(sectionKey, fieldKey, value) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  const rendered = renderStructuredValue(sectionKey, fieldKey, value);
  if (fieldKey !== 'action' || typeof rendered !== 'string') return rendered;
  return ACTION_LABELS_HE[rendered.trim().toLowerCase()] || rendered;
}

function structuredFieldValue(sectionKey, fieldKey, record) {
  if (sectionKey === 'top-insights' && fieldKey === 'whyImportant') {
    return record?.whyImportant ?? record?.meaning ?? record?.reason ?? record?.significance;
  }
  if (sectionKey === 'learning-insights' && fieldKey === 'reason') {
    return record?.reason ?? record?.whyImportant ?? record?.explanation;
  }
  return record?.[fieldKey];
}

function StructuredBulkSection({ section, bulkSelection }) {
  if (!section?.items?.length) return null;
  const records = Array.isArray(section.records) ? section.records : [];
  const insightLayout = INSIGHT_TABLE_LAYOUT[section.key];
  const fields = (STRUCTURED_FIELDS[section.key] || []).filter(([key]) => (
    !insightLayout || insightLayout.required.has(key) || records.some((record) => displayValue(structuredFieldValue(section.key, key, record)))
  ));
  return (
    <SectionCard title={section.label} count={section.items.length}>
      <div className={insightLayout ? 'w-full overflow-hidden' : 'overflow-x-auto'}>
        <table className={`w-full table-fixed text-right ${insightLayout ? 'insight-readable-table' : 'min-w-[620px]'}`}>
          <thead><tr className="border-b border-slate-200 text-sm text-slate-600">
            <th className="w-12 p-2" aria-label="בחירה" />
            {fields.map(([key, label]) => <th key={key} className={`${insightLayout?.widths?.[key] || ''} p-3 align-top font-semibold`}>{label}</th>)}
          </tr></thead>
          <tbody>{section.items.map((text, index) => {
            const id = `specialized:${section.key}:${index}`;
            const record = records[index];
            return (
              <SemanticTableRow key={id} evidence={record} className="align-top last:border-0">
                <td className="p-3 align-top"><input type="checkbox" checked={bulkSelection?.multiSelected?.has(id) || false}
                  onChange={() => bulkSelection?.onToggle?.(id, { text, sectionLabel: section.label, type: section.tabKey, tabScope: 'specialized' })}
                  aria-label={`בחר פריט ${index + 1}`} /></td>
                {fields.map(([key]) => <td key={key} className="p-3 align-top text-[15px] font-normal leading-7 text-slate-800 dark:text-zinc-100 whitespace-normal break-words">
                  {structuredDisplayValue(section.key, key, structuredFieldValue(section.key, key, record))}
                </td>)}
              </SemanticTableRow>
            );
          })}</tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/**
 * One canonical section registry, ordered by the active morning/evening presentation profile.
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
  const resolvedPresentation = resolveMorningBriefPresentation(presentation);
  const byKey = new Map(bulkSections.map((section) => [section.key, section]));
  const has = (...keys) => keys.some((key) => byKey.get(key)?.items?.length > 0);
  const optionalVisible = (key) => !resolvedPresentation.hideEmptyOptionalSections || has(key);

  const registry = {
    news: <NewsSection key="news" items={plainNewsItems} onSaveToBrain={onSaveToBrain} marketBriefData={marketBriefData} onSaveMarketBriefSection={onSaveMarketBriefSection} {...shared} />,
    'market-regime': <MarketRegimeSection key="market-regime" marketBriefData={marketBriefData} onSaveMarketBriefSection={onSaveMarketBriefSection} {...shared} />,
    sectors: <SectorOverviewSection key="sectors" marketBriefData={marketBriefData} onSaveMarketBriefSection={onSaveMarketBriefSection} {...shared} />,
    'opportunities-risks': <OpportunitiesRisksDashboard key="opportunities-risks" marketBriefData={marketBriefData} effectiveVideo={effectiveVideo} onSaveToBrain={onSaveToBrain} onSaveMarketBriefSection={onSaveMarketBriefSection} {...shared} />,
    'stocks-mentioned': <StocksMentionedSection key="stocks-mentioned" marketBriefData={marketBriefData} effectiveVideo={effectiveVideo} onSaveToBrain={onSaveToBrain} onSaveMarketBriefSection={onSaveMarketBriefSection} {...shared} />,
    'economic-calendar': optionalVisible('economic-calendar') ? <EconomicCalendarSection key="economic-calendar" marketBriefData={marketBriefData} onSaveMarketBriefSection={onSaveMarketBriefSection} {...shared} /> : null,
    macro: optionalVisible('macro') ? <MacroSection key="macro" items={macroItems} marketBriefData={marketBriefData} onSaveToBrain={onSaveToBrain} onSaveMarketBriefSection={onSaveMarketBriefSection} {...shared} /> : null,
    sentiment: optionalVisible('sentiment') ? <SentimentSection key="sentiment" marketBriefData={marketBriefData} effectiveVideo={effectiveVideo} {...shared} /> : null,
    markets: <MarketsSection key="markets" marketBriefData={marketBriefData} indicesItems={indicesItems} onSaveToBrain={(text) => onSaveToBrain(text, 'indices', '📈 שווקים')} onSaveMarketBriefSection={onSaveMarketBriefSection} {...shared} />,
  };
  for (const key of Object.keys(STRUCTURED_FIELDS)) {
    registry[key] = <StructuredBulkSection key={key} section={byKey.get(key)} bulkSelection={bulkSelection} />;
  }

  return (
    <div className="space-y-3" dir="rtl" data-morning-brief-dashboard>
      {resolveMarketBriefSectionOrder(presentation).map((key) => registry[key] || null)}
    </div>
  );
}
