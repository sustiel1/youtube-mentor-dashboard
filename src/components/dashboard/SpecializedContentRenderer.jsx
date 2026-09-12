import { DedicatedContentSection } from "./DedicatedContentSection";
import { MarketIndicesTable } from "./MarketIndicesTable";
import { MorningBriefDashboard } from "./MorningBriefDashboard";
import { MORNING_BRIEF_SPECIALIZED_PRESENTATION } from "@/lib/morningBriefPresentation";
import { MacroGemDashboard } from "./MacroGemDashboard";
import { DASHBOARD_COLUMN_HEADER_CLS } from "./MorningBriefVisualPrimitives";
import { buildBulkItemsFromSections } from "@/lib/universalTabBulkItems";
import { extractVideoTabItems } from "@/config/videoTabsConfig";
import { TabBulkItemsRegistrar } from "./TabBulkItemsRegistrar";
import {
  buildMorningBriefBulkSections,
} from "@/lib/morningBriefBulkSections";

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

const STATIC_TIME_NARRATIVE_TAB_KEYS = new Set([
  'analysis-frameworks', 'investment-checklist', 'mistakes', 'checklists',
  'setups', 'patterns', 'trading-brain', 'cause-effect', 'market-impact',
  'political-ideology', 'political-theology', 'political-liberal',
  'political-for', 'political-against', 'political-debates', 'political-reusable',
]);

// Same field groups the header's cross-content-signal chip already uses
// (VideoDetailPanel.jsx, ~line 9609) to detect fundamental vs. technical
// content — exclusive to those two GEM families, unlike keyInsights/
// checklists/mistakes/promptTemplates which general-purpose GEM output can
// also populate. Deliberately narrow: a video only counts as fundamental/
// technical here when it carries one of these specific fields, not any
// learning content whatsoever.
const FUNDAMENTAL_SIGNAL_FIELDS = ['frameworks', 'analysisFrameworks', 'financialMetrics', 'valuation', 'investmentChecklist'];
const TECHNICAL_SIGNAL_FIELDS = ['indicators', 'setups', 'tradingSetups', 'patterns', 'tradingPatterns'];
function hasNonEmptyArrayField(video, keys) {
  return keys.some((k) => Array.isArray(video?.[k]) && video[k].length > 0);
}
function looksLikeFundamentalOrTechnical(video) {
  return hasNonEmptyArrayField(video, FUNDAMENTAL_SIGNAL_FIELDS) || hasNonEmptyArrayField(video, TECHNICAL_SIGNAL_FIELDS);
}

function Section({ label, items, tabKey, sectionKey, videoId, onSaveToBrain, checkSaved, bulkSelection }) {
  return (
    <DedicatedContentSection
      label={label}
      items={items}
      tabKey={tabKey}
      sectionKey={sectionKey}
      videoId={STATIC_TIME_NARRATIVE_TAB_KEYS.has(tabKey) ? videoId : null}
      noteVideoId={videoId}
      onSaveToBrain={onSaveToBrain}
      checkSaved={checkSaved}
      bulkSelection={bulkSelection}
      macroDirection={tabKey === 'brief-macro'}
    />
  );
}

/**
 * Renders dynamic content inside the 🎯 Specialized Content tab.
 * Content varies by normalizedSubCategory.
 *
 * Props:
 *   effectiveVideo       — the resolved video object
 *   normalizedSubCategory — slug from normalizeSubCategory()
 *   marketBriefData      — parsed GEM JSON (brief videos)
 *   politicalSummary     — political AI analysis state
 *   hasPoliticalTabSet   — boolean: is this a political video
 *   onSaveToBrain(text, tabKey, label) — save callback
 */
export function SpecializedContentRenderer({
  effectiveVideo,
  youtubeId = null,
  normalizedSubCategory,
  marketBriefData,
  politicalSummary,
  hasPoliticalTabSet,
  onSaveToBrain,
  onSaveMarketBriefSection,
  checkSaved,
  bulkSelection = null,
}) {
  const slug = normalizedSubCategory;
  const timestampYoutubeId = youtubeId;

  const sect = (label, items, tabKey, sectionKey = tabKey) => (
    <Section
      key={tabKey}
      label={label}
      items={items}
      tabKey={tabKey}
      sectionKey={sectionKey}
      videoId={timestampYoutubeId}
      onSaveToBrain={onSaveToBrain}
      checkSaved={checkSaved}
      bulkSelection={bulkSelection}
    />
  );

  const renderBulkShell = (sections, content) => {
    const sectionDefs = sections.map((s) => ({ key: s.key, label: s.label, items: s.items, tabKey: s.tabKey }));
    // Only leaf row items are registered for Select All — card-level items are excluded
    // to prevent parent+child duplication when all items are exported together.
    // Card header checkboxes still work individually via direct toggleMultiSelect.
    const rowItems = bulkSelection ? buildBulkItemsFromSections(sectionDefs, 'specialized') : [];
    return (
      <div className="space-y-3" dir="rtl">
        <TabBulkItemsRegistrar tab="specialized" items={rowItems} />
        {content}
      </div>
    );
  };

  // ── Fundamental / Technical Analysis ──────────────────────────────
  // Tab 7 is for that day's stock/company content only — learning material
  // (frameworks, checklists, mistakes, financial metrics, valuation,
  // indicators, setups, patterns) lives in tabs 3/4 instead (see
  // VideoDetailPanel.jsx's useful-knowledge section array).
  // Renders the exact same 9-section dashboard the morning/evening brief
  // uses (MorningBriefDashboard + buildMorningBriefBulkSections) — not a
  // parallel implementation. Every extractVideoTabItems() case it calls
  // already has a flat/legacy fallback for videos with no marketBriefData,
  // so this works for a plain GEMS-paste video, not just a real brief.
  //
  // Trigger condition is broader than `slug === 'fundamental-analysis' ||
  // 'technical-analysis'` on purpose: subCategory is a free-text field the
  // paste flow never sets automatically (confirmed live — a real
  // GEMS-pasted fundamental video has subCategory === ''), so `slug` is
  // null for most real fundamental/technical videos and they would never
  // reach this branch on slug alone. looksLikeFundamentalOrTechnical()
  // mirrors the same field groups the header's cross-content-signal chip
  // already uses (VideoDetailPanel.jsx, ~line 9609) so a video only
  // qualifies when it actually carries fundamental- or technical-specific
  // content, not any GEM output in general.
  if (
    slug === 'fundamental-analysis' ||
    slug === 'technical-analysis' ||
    (!slug && looksLikeFundamentalOrTechnical(effectiveVideo))
  ) {
    const fundamentalBulkDefs = buildMorningBriefBulkSections(effectiveVideo, marketBriefData);
    return renderBulkShell(fundamentalBulkDefs, (
      <MorningBriefDashboard
        effectiveVideo={effectiveVideo}
        marketBriefData={marketBriefData}
        onSaveToBrain={onSaveToBrain}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        bulkSelection={bulkSelection}
        bulkSections={fundamentalBulkDefs}
        presentation={MORNING_BRIEF_SPECIALIZED_PRESENTATION}
        showStockDataSections
      />
    ));
  }

  // ── Morning Brief — fixed 10-section dashboard ─────────────────────
  if (slug === 'morning-brief' || slug === 'evening-brief') {
    const morningBulkDefs = buildMorningBriefBulkSections(effectiveVideo, marketBriefData);
    return renderBulkShell(morningBulkDefs, (
      <MorningBriefDashboard
        effectiveVideo={effectiveVideo}
        marketBriefData={marketBriefData}
        onSaveToBrain={onSaveToBrain}
        onSaveMarketBriefSection={onSaveMarketBriefSection}
        bulkSelection={bulkSelection}
        bulkSections={morningBulkDefs}
        presentation={MORNING_BRIEF_SPECIALIZED_PRESENTATION}
      />
    ));
  }

  // ── Evening Brief ────────────────────────────────────────────────
  if (slug === 'evening-brief') {
    const indicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
    const indicesSect = indicesItems.length > 0 ? (
      <div key="indices" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className={`${DASHBOARD_COLUMN_HEADER_CLS} text-slate-800 dark:text-zinc-100 mb-2 px-1 text-right`}>📊 סקירת שוק</p>
        <MarketIndicesTable
          items={indicesItems}
          onSaveToBrain={(text) => onSaveToBrain(text, 'indices', '📊 סקירת שוק')}
        />
      </div>
    ) : null;

    const allNewsItems = extractVideoTabItems(effectiveVideo, 'market-news', marketBriefData);
    const marketIndexItems = allNewsItems.filter(looksLikeMarketIndex);
    const plainNewsItems   = allNewsItems.filter((i) => !looksLikeMarketIndex(i));

    const marketNewsSect = marketIndexItems.length > 0 ? (
      <div key="market-news-table" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className={`${DASHBOARD_COLUMN_HEADER_CLS} text-slate-800 dark:text-zinc-100 mb-2 px-1 text-right`}>📰 עדכוני שוק</p>
        <MarketIndicesTable
          items={marketIndexItems}
          onSaveToBrain={(text) => onSaveToBrain(text, 'market-news', '📰 עדכוני שוק')}
        />
      </div>
    ) : null;

    const sects = [
      marketNewsSect,
      plainNewsItems.length > 0 ? sect('📋 עדכוני מאקרו', plainNewsItems, 'market-news') : null,
      indicesSect,
      sect('🌍 מאקרו',            extractVideoTabItems(effectiveVideo, 'brief-macro',         marketBriefData), 'brief-macro'),
      sect('📊 סנטימנט שוק',     extractVideoTabItems(effectiveVideo, 'brief-sentiment',     marketBriefData), 'brief-sentiment'),
      sect('📊 ביצועי סקטורים',  extractVideoTabItems(effectiveVideo, 'brief-sectors',       marketBriefData), 'brief-sectors'),
      sect('🔄 מה השתנה היום',   extractVideoTabItems(effectiveVideo, 'brief-changes',       marketBriefData), 'brief-changes'),
      sect('📅 אירועי מחר',      extractVideoTabItems(effectiveVideo, 'brief-tomorrow',      marketBriefData), 'brief-tomorrow'),
      sect('📅 לוח כלכלי',       extractVideoTabItems(effectiveVideo, 'brief-calendar',      marketBriefData), 'brief-calendar'),
      sect('🎯 רשימת מעקב',      extractVideoTabItems(effectiveVideo, 'stocks-mentioned',    marketBriefData), 'stocks-mentioned'),
      sect('💡 הזדמנויות',       extractVideoTabItems(effectiveVideo, 'brief-opportunities', marketBriefData), 'brief-opportunities'),
      sect('⚠️ סיכונים',         extractVideoTabItems(effectiveVideo, 'brief-risks',         marketBriefData), 'brief-risks'),
    ].filter(Boolean);

    if (sects.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">🌙</span>
        <p className="text-sm">אין עדיין נתוני מבזק ערב — הדבק JSON מ-GEM</p>
      </div>
    );
    const eveningBulkDefs = [
      ...(plainNewsItems.length > 0 ? [{ key: 'market-news', label: '📋 עדכוני מאקרו', items: plainNewsItems, tabKey: 'market-news' }] : []),
      { key: 'brief-macro', label: '🌍 מאקרו', items: extractVideoTabItems(effectiveVideo, 'brief-macro', marketBriefData), tabKey: 'brief-macro' },
      { key: 'brief-sentiment', label: '📊 סנטימנט שוק', items: extractVideoTabItems(effectiveVideo, 'brief-sentiment', marketBriefData), tabKey: 'brief-sentiment' },
      { key: 'brief-sectors', label: '📊 ביצועי סקטורים', items: extractVideoTabItems(effectiveVideo, 'brief-sectors', marketBriefData), tabKey: 'brief-sectors' },
      { key: 'brief-changes', label: '🔄 מה השתנה היום', items: extractVideoTabItems(effectiveVideo, 'brief-changes', marketBriefData), tabKey: 'brief-changes' },
      { key: 'brief-tomorrow', label: '📅 אירועי מחר', items: extractVideoTabItems(effectiveVideo, 'brief-tomorrow', marketBriefData), tabKey: 'brief-tomorrow' },
      { key: 'brief-calendar', label: '📅 לוח כלכלי', items: extractVideoTabItems(effectiveVideo, 'brief-calendar', marketBriefData), tabKey: 'brief-calendar' },
      { key: 'stocks-mentioned', label: '🎯 רשימת מעקב', items: extractVideoTabItems(effectiveVideo, 'stocks-mentioned', marketBriefData), tabKey: 'stocks-mentioned' },
      { key: 'brief-opportunities', label: '💡 הזדמנויות', items: extractVideoTabItems(effectiveVideo, 'brief-opportunities', marketBriefData), tabKey: 'brief-opportunities' },
      { key: 'brief-risks', label: '⚠️ סיכונים', items: extractVideoTabItems(effectiveVideo, 'brief-risks', marketBriefData), tabKey: 'brief-risks' },
    ].filter((d) => d.items.length > 0);
    return renderBulkShell(eveningBulkDefs, sects);
  }

  // ── Weekly Brief ─────────────────────────────────────────────────
  if (slug === 'weekly-brief') {
    const indicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
    const indicesSect = indicesItems.length > 0 ? (
      <div key="indices" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className={`${DASHBOARD_COLUMN_HEADER_CLS} text-slate-800 dark:text-zinc-100 mb-2 px-1 text-right`}>📊 ביצועי שוק</p>
        <MarketIndicesTable
          items={indicesItems}
          onSaveToBrain={(text) => onSaveToBrain(text, 'indices', '📊 ביצועי שוק')}
        />
      </div>
    ) : null;

    const allNewsItems = extractVideoTabItems(effectiveVideo, 'market-news', marketBriefData);
    const marketIndexItems = allNewsItems.filter(looksLikeMarketIndex);
    const plainNewsItems   = allNewsItems.filter((i) => !looksLikeMarketIndex(i));

    const marketNewsSect = marketIndexItems.length > 0 ? (
      <div key="market-news-table" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className={`${DASHBOARD_COLUMN_HEADER_CLS} text-slate-800 dark:text-zinc-100 mb-2 px-1 text-right`}>📰 סיכום שוק</p>
        <MarketIndicesTable
          items={marketIndexItems}
          onSaveToBrain={(text) => onSaveToBrain(text, 'market-news', '📰 סיכום שוק')}
        />
      </div>
    ) : null;

    const sects = [
      sect('📰 כותרות השבוע',    extractVideoTabItems(effectiveVideo, 'brief-highlights',   marketBriefData), 'brief-highlights'),
      marketNewsSect,
      plainNewsItems.length > 0 ? sect('📋 חדשות', plainNewsItems, 'market-news') : null,
      indicesSect,
      sect('🌍 מאקרו',            extractVideoTabItems(effectiveVideo, 'brief-macro',         marketBriefData), 'brief-macro'),
      sect('🏆 מנצחים',           extractVideoTabItems(effectiveVideo, 'brief-winners',       marketBriefData), 'brief-winners'),
      sect('📉 מפסידים',          extractVideoTabItems(effectiveVideo, 'brief-losers',        marketBriefData), 'brief-losers'),
      sect('📊 סנטימנט שוק',     extractVideoTabItems(effectiveVideo, 'brief-sentiment',     marketBriefData), 'brief-sentiment'),
      sect('📅 לוח כלכלי',       extractVideoTabItems(effectiveVideo, 'brief-calendar',      marketBriefData), 'brief-calendar'),
      sect('🔮 תחזית שבוע הבא',  extractVideoTabItems(effectiveVideo, 'brief-outlook',       marketBriefData), 'brief-outlook'),
      sect('🎯 רשימת מעקב',      extractVideoTabItems(effectiveVideo, 'stocks-mentioned',    marketBriefData), 'stocks-mentioned'),
      sect('💡 הזדמנויות',       extractVideoTabItems(effectiveVideo, 'brief-opportunities', marketBriefData), 'brief-opportunities'),
      sect('⚠️ סיכונים',         extractVideoTabItems(effectiveVideo, 'brief-risks',         marketBriefData), 'brief-risks'),
    ].filter(Boolean);

    if (sects.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">📆</span>
        <p className="text-sm">אין עדיין נתוני מבזק שבועי — הדבק JSON מ-GEM</p>
      </div>
    );
    const weeklyBulkDefs = [
      { key: 'brief-highlights', label: '📰 כותרות השבוע', items: extractVideoTabItems(effectiveVideo, 'brief-highlights', marketBriefData), tabKey: 'brief-highlights' },
      ...(plainNewsItems.length > 0 ? [{ key: 'market-news', label: '📋 חדשות', items: plainNewsItems, tabKey: 'market-news' }] : []),
      { key: 'brief-macro', label: '🌍 מאקרו', items: extractVideoTabItems(effectiveVideo, 'brief-macro', marketBriefData), tabKey: 'brief-macro' },
      { key: 'brief-winners', label: '🏆 מנצחים', items: extractVideoTabItems(effectiveVideo, 'brief-winners', marketBriefData), tabKey: 'brief-winners' },
      { key: 'brief-losers', label: '📉 מפסידים', items: extractVideoTabItems(effectiveVideo, 'brief-losers', marketBriefData), tabKey: 'brief-losers' },
      { key: 'brief-sentiment', label: '📊 סנטימנט שוק', items: extractVideoTabItems(effectiveVideo, 'brief-sentiment', marketBriefData), tabKey: 'brief-sentiment' },
      { key: 'brief-calendar', label: '📅 לוח כלכלי', items: extractVideoTabItems(effectiveVideo, 'brief-calendar', marketBriefData), tabKey: 'brief-calendar' },
      { key: 'brief-outlook', label: '🔮 תחזית שבוע הבא', items: extractVideoTabItems(effectiveVideo, 'brief-outlook', marketBriefData), tabKey: 'brief-outlook' },
      { key: 'stocks-mentioned', label: '🎯 רשימת מעקב', items: extractVideoTabItems(effectiveVideo, 'stocks-mentioned', marketBriefData), tabKey: 'stocks-mentioned' },
      { key: 'brief-opportunities', label: '💡 הזדמנויות', items: extractVideoTabItems(effectiveVideo, 'brief-opportunities', marketBriefData), tabKey: 'brief-opportunities' },
      { key: 'brief-risks', label: '⚠️ סיכונים', items: extractVideoTabItems(effectiveVideo, 'brief-risks', marketBriefData), tabKey: 'brief-risks' },
    ].filter((d) => d.items.length > 0);
    return renderBulkShell(weeklyBulkDefs, sects);
  }

  // ── Earnings Brief ───────────────────────────────────────────────
  if (slug === 'earnings-brief') {
    const indicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
    const indicesSect = indicesItems.length > 0 ? (
      <div key="indices" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className={`${DASHBOARD_COLUMN_HEADER_CLS} text-slate-800 dark:text-zinc-100 mb-2 px-1 text-right`}>📊 שווקים</p>
        <MarketIndicesTable
          items={indicesItems}
          onSaveToBrain={(text) => onSaveToBrain(text, 'indices', '📊 שווקים')}
        />
      </div>
    ) : null;

    const allNewsItems = extractVideoTabItems(effectiveVideo, 'market-news', marketBriefData);
    const marketIndexItems = allNewsItems.filter(looksLikeMarketIndex);
    const plainNewsItems   = allNewsItems.filter((i) => !looksLikeMarketIndex(i));

    const marketNewsSect = marketIndexItems.length > 0 ? (
      <div key="market-news-table" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className={`${DASHBOARD_COLUMN_HEADER_CLS} text-slate-800 dark:text-zinc-100 mb-2 px-1 text-right`}>📰 רקע שוק</p>
        <MarketIndicesTable
          items={marketIndexItems}
          onSaveToBrain={(text) => onSaveToBrain(text, 'market-news', '📰 רקע שוק')}
        />
      </div>
    ) : null;

    const sects = [
      sect('📈 מדדים פיננסיים',  extractVideoTabItems(effectiveVideo, 'financial-metrics',   marketBriefData), 'financial-metrics'),
      sect('🎯 תחזיות',           extractVideoTabItems(effectiveVideo, 'earnings-guidance',   marketBriefData), 'earnings-guidance'),
      sect('💬 פרשנות הנהלה',    extractVideoTabItems(effectiveVideo, 'earnings-commentary',  marketBriefData), 'earnings-commentary'),
      sect('🌍 מאקרו',            extractVideoTabItems(effectiveVideo, 'brief-macro',          marketBriefData), 'brief-macro'),
      sect('📊 סנטימנט שוק',     extractVideoTabItems(effectiveVideo, 'brief-sentiment',      marketBriefData), 'brief-sentiment'),
      sect('📅 לוח כלכלי',       extractVideoTabItems(effectiveVideo, 'brief-calendar',       marketBriefData), 'brief-calendar'),
      marketNewsSect,
      plainNewsItems.length > 0 ? sect('📋 חדשות', plainNewsItems, 'market-news') : null,
      indicesSect,
      sect('🎯 רשימת מעקב',      extractVideoTabItems(effectiveVideo, 'stocks-mentioned',     marketBriefData), 'stocks-mentioned'),
      sect('💡 הזדמנויות',       extractVideoTabItems(effectiveVideo, 'brief-opportunities',  marketBriefData), 'brief-opportunities'),
      sect('⚠️ סיכונים',         extractVideoTabItems(effectiveVideo, 'brief-risks',          marketBriefData), 'brief-risks'),
    ].filter(Boolean);

    if (sects.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">📈</span>
        <p className="text-sm">אין עדיין נתוני דוחות — הדבק JSON מ-GEM</p>
      </div>
    );
    const earningsBulkDefs = [
      { key: 'financial-metrics', label: '📈 מדדים פיננסיים', items: extractVideoTabItems(effectiveVideo, 'financial-metrics', marketBriefData), tabKey: 'financial-metrics' },
      { key: 'earnings-guidance', label: '🎯 תחזיות', items: extractVideoTabItems(effectiveVideo, 'earnings-guidance', marketBriefData), tabKey: 'earnings-guidance' },
      { key: 'earnings-commentary', label: '💬 פרשנות הנהלה', items: extractVideoTabItems(effectiveVideo, 'earnings-commentary', marketBriefData), tabKey: 'earnings-commentary' },
      { key: 'brief-macro', label: '🌍 מאקרו', items: extractVideoTabItems(effectiveVideo, 'brief-macro', marketBriefData), tabKey: 'brief-macro' },
      { key: 'brief-sentiment', label: '📊 סנטימנט שוק', items: extractVideoTabItems(effectiveVideo, 'brief-sentiment', marketBriefData), tabKey: 'brief-sentiment' },
      { key: 'brief-calendar', label: '📅 לוח כלכלי', items: extractVideoTabItems(effectiveVideo, 'brief-calendar', marketBriefData), tabKey: 'brief-calendar' },
      ...(plainNewsItems.length > 0 ? [{ key: 'market-news', label: '📋 חדשות', items: plainNewsItems, tabKey: 'market-news' }] : []),
      { key: 'stocks-mentioned', label: '🎯 רשימת מעקב', items: extractVideoTabItems(effectiveVideo, 'stocks-mentioned', marketBriefData), tabKey: 'stocks-mentioned' },
      { key: 'brief-opportunities', label: '💡 הזדמנויות', items: extractVideoTabItems(effectiveVideo, 'brief-opportunities', marketBriefData), tabKey: 'brief-opportunities' },
      { key: 'brief-risks', label: '⚠️ סיכונים', items: extractVideoTabItems(effectiveVideo, 'brief-risks', marketBriefData), tabKey: 'brief-risks' },
    ].filter((d) => d.items.length > 0);
    return renderBulkShell(earningsBulkDefs, sects);
  }

  // ── Macro ────────────────────────────────────────────────────────
  // Detect Macro GEM regardless of slug (handles videos without subCategory='מאקרו')
  const isMacroContent = slug === 'macro' || (!!marketBriefData?.universalTabs && marketBriefData?.contentType === 'market');

  if (isMacroContent) {
    return (
      <MacroGemDashboard
        marketBriefData={marketBriefData}
        effectiveVideo={effectiveVideo}
        onSaveToBrain={onSaveToBrain}
        bulkSelection={bulkSelection}
      />
    );
  }

  // ── Political ────────────────────────────────────────────────────
  if (slug === 'political' || hasPoliticalTabSet) {
    const safeStr  = (v) => (typeof v === 'string' ? v.trim() : (v?.text || v?.content || v?.title || v?.summary || '').trim());
    const safeArr  = (arr) => (Array.isArray(arr) ? arr : []).map(safeStr).filter(Boolean);
    const objToArr = (obj) => (obj && typeof obj === 'object' && !Array.isArray(obj))
      ? Object.values(obj).filter(v => typeof v === 'string' && v.trim())
      : [];

    const ps = politicalSummary;
    const _vq  = ps?.viralQuotes             || ps?.politicalSummary?.viralQuotes             || [];
    const _sl  = ps?.politicalSlogans         || ps?.politicalSummary?.politicalSlogans         || [];
    const _dr  = ps?.debateResponses          || ps?.politicalSummary?.debateResponses          || [];
    const _ta  = ps?.theologyAnalysis         || ps?.politicalSummary?.theologyAnalysis         || null;
    const _ia  = ps?.ideologyAnalysis         || ps?.politicalSummary?.ideologyAnalysis         || null;
    const _ljp = ps?.liberalJewishPerspective || ps?.politicalSummary?.liberalJewishPerspective || null;
    const _rk  = ps?.reusableKnowledge        || ps?.politicalSummary?.reusableKnowledge        || [];

    const keyPlayers   = extractVideoTabItems(effectiveVideo, 'political-players',      marketBriefData);
    const argsFor      = extractVideoTabItems(effectiveVideo, 'political-for',          marketBriefData);
    const argsAgainst  = extractVideoTabItems(effectiveVideo, 'political-against',      marketBriefData);

    const politicalSectionDefs = [
      { key: 'political-players', label: '👥 שחקנים מרכזיים', items: keyPlayers, tabKey: 'political-players' },
      { key: 'political-ideology', label: '⚖️ אידיאולוגיה', items: [...safeArr(Array.isArray(_ia) ? _ia : []), ...objToArr(_ia)], tabKey: 'political-ideology' },
      { key: 'political-theology', label: '✡️ תאולוגיה', items: [...safeArr(Array.isArray(_ta) ? _ta : []), ...objToArr(_ta)], tabKey: 'political-theology' },
      { key: 'political-liberal', label: '🕊️ יהדות ליברלית', items: [...safeArr(Array.isArray(_ljp) ? _ljp : []), ...objToArr(_ljp)], tabKey: 'political-liberal' },
      { key: 'political-for', label: '✅ בעד', items: argsFor, tabKey: 'political-for' },
      { key: 'political-against', label: '❌ נגד', items: argsAgainst, tabKey: 'political-against' },
      { key: 'political-slogans', label: '📢 סיסמאות וציטוטים', items: [...safeArr(_vq), ...safeArr(_sl)], tabKey: 'political-slogans' },
      { key: 'political-debates', label: '⚔️ תגובות לוויכוחים', items: safeArr(_dr), tabKey: 'political-debates' },
      { key: 'political-reusable', label: '📚 ידע לשימוש חוזר', items: safeArr(_rk), tabKey: 'political-reusable' },
    ].filter((d) => d.items.length > 0);
    const sects = politicalSectionDefs.map((d) => sect(d.label, d.items, d.tabKey, d.key));

    if (sects.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">🏛️</span>
        <p className="text-sm">אין עדיין ניתוח פוליטי — נתח עם GEM פוליטי</p>
      </div>
    );
    return renderBulkShell(politicalSectionDefs, sects);
  }

  // ── Default: no dedicated (daily stock/company) content for this video ──
  // All 10 fields formerly rendered here as per-field cards (trading-brain,
  // indicators, setups, patterns, checklists, mistakes, valuation,
  // financial-metrics, cause-effect, market-impact) are rendered
  // unconditionally elsewhere regardless of which branch of this function
  // runs: trading-brain's own fields (mainLesson/brainHighlights/
  // tradingPrinciples/mentalModels/keyInsights) are already covered by tab
  // 3's lesson/insights/principles/thesis sections, and the other 9 are
  // covered by tab 4's useful-knowledge section array (VideoDetailPanel.jsx)
  // — neither depends on normalizedSubCategory, so removing them here can't
  // lose data. A video with real fundamental/technical signal never reaches
  // this point at all (see looksLikeFundamentalOrTechnical() above).
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
      <span className="text-3xl mb-2 opacity-30">🎯</span>
      <p className="text-sm">אין תוכן ייעודי לסרטון זה</p>
      <p className="text-xs text-slate-300 dark:text-zinc-600 mt-1">נתח את הסרטון כדי לייצר תוכן ייעודי</p>
      {effectiveVideo?.subCategory && (
        <span className="mt-1.5 text-xs font-mono bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-slate-500 dark:text-zinc-400">
          {effectiveVideo.subCategory}
        </span>
      )}
    </div>
  );
}
