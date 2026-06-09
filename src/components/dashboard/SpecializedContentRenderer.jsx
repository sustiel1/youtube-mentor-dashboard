import { LearningTabContent } from "./LearningTabContent";
import { MarketIndicesTable } from "./MarketIndicesTable";
import { extractVideoTabItems } from "@/config/videoTabsConfig";

// Detects structured market-index strings like "spx: direction: down | change: -0.23% | level: | note: ..."
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

function Section({ label, items, tabKey, onSaveToBrain, checkSaved }) {
  const safe = Array.isArray(items) ? items : [];
  if (safe.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
      <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 px-1 text-right">{label}</p>
      <LearningTabContent
        items={safe}
        emptyLabel=""
        onSaveToBrain={(text) => onSaveToBrain(text, tabKey, label)}
        isSaved={checkSaved ? (text) => checkSaved(text, tabKey) : undefined}
      />
    </div>
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
  normalizedSubCategory,
  marketBriefData,
  politicalSummary,
  hasPoliticalTabSet,
  onSaveToBrain,
  checkSaved,
}) {
  const slug = normalizedSubCategory;

  const sect = (label, items, tabKey) => (
    <Section
      key={tabKey}
      label={label}
      items={items}
      tabKey={tabKey}
      onSaveToBrain={onSaveToBrain}
      checkSaved={checkSaved}
    />
  );

  // ── Fundamental Analysis ─────────────────────────────────────────
  if (slug === 'fundamental-analysis') {
    const sects = [
      sect('📈 מדדים פיננסיים',  extractVideoTabItems(effectiveVideo, 'financial-metrics',    marketBriefData), 'financial-metrics'),
      sect('💰 הערכת שווי',       extractVideoTabItems(effectiveVideo, 'valuation',            marketBriefData), 'valuation'),
      sect('⚙️ מסגרות ניתוח',     extractVideoTabItems(effectiveVideo, 'analysis-frameworks',  marketBriefData), 'analysis-frameworks'),
      sect("📋 צ'קליסט השקעה",    extractVideoTabItems(effectiveVideo, 'investment-checklist', marketBriefData), 'investment-checklist'),
      sect('⚠️ סיכונים',          extractVideoTabItems(effectiveVideo, 'mistakes',             marketBriefData), 'mistakes'),
      sect('✅ כללים',             extractVideoTabItems(effectiveVideo, 'checklists',           marketBriefData), 'checklists'),
    ].filter(Boolean);

    if (sects.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">📊</span>
        <p className="text-sm">אין עדיין נתונים פונדמנטליים — נתח את הסרטון</p>
      </div>
    );
    return <div className="space-y-3">{sects}</div>;
  }

  // ── Technical Analysis ───────────────────────────────────────────
  if (slug === 'technical-analysis') {
    const sects = [
      sect('📈 אינדיקטורים', extractVideoTabItems(effectiveVideo, 'indicators',  marketBriefData), 'indicators'),
      sect('🎯 סטאפים',      extractVideoTabItems(effectiveVideo, 'setups',      marketBriefData), 'setups'),
      sect('📊 פטרנים',      extractVideoTabItems(effectiveVideo, 'patterns',    marketBriefData), 'patterns'),
      sect('✅ כללים',        extractVideoTabItems(effectiveVideo, 'checklists',  marketBriefData), 'checklists'),
      sect('⚠️ טעויות',      extractVideoTabItems(effectiveVideo, 'mistakes',    marketBriefData), 'mistakes'),
    ].filter(Boolean);

    if (sects.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">📊</span>
        <p className="text-sm">אין עדיין נתונים טכניים — נתח את הסרטון</p>
      </div>
    );
    return <div className="space-y-3">{sects}</div>;
  }

  // ── Morning Brief ────────────────────────────────────────────────
  if (slug === 'morning-brief') {
    const indicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
    const indicesSect = indicesItems.length > 0 ? (
      <div key="indices" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 px-1 text-right">📊 שווקים</p>
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
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 px-1 text-right">📰 סקירת שוק</p>
        <MarketIndicesTable
          items={marketIndexItems}
          onSaveToBrain={(text) => onSaveToBrain(text, 'market-news', '📰 סקירת שוק')}
        />
      </div>
    ) : null;

    const sects = [
      marketNewsSect,
      plainNewsItems.length > 0 ? sect('📋 חדשות', plainNewsItems, 'market-news') : null,
      indicesSect,
      sect('🌍 מאקרו',          extractVideoTabItems(effectiveVideo, 'brief-macro',         marketBriefData), 'brief-macro'),
      sect('📊 סנטימנט שוק',   extractVideoTabItems(effectiveVideo, 'brief-sentiment',     marketBriefData), 'brief-sentiment'),
      sect('📅 לוח כלכלי',     extractVideoTabItems(effectiveVideo, 'brief-calendar',      marketBriefData), 'brief-calendar'),
      sect('🎯 רשימת מעקב',    extractVideoTabItems(effectiveVideo, 'stocks-mentioned',    marketBriefData), 'stocks-mentioned'),
      sect('💡 הזדמנויות',     extractVideoTabItems(effectiveVideo, 'brief-opportunities', marketBriefData), 'brief-opportunities'),
      sect('⚠️ סיכונים',       extractVideoTabItems(effectiveVideo, 'brief-risks',         marketBriefData), 'brief-risks'),
    ].filter(Boolean);

    if (sects.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">📰</span>
        <p className="text-sm">אין עדיין נתוני מבזק — הדבק JSON מ-GEM</p>
      </div>
    );
    return <div className="space-y-3">{sects}</div>;
  }

  // ── Evening Brief ────────────────────────────────────────────────
  if (slug === 'evening-brief') {
    const indicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
    const indicesSect = indicesItems.length > 0 ? (
      <div key="indices" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 px-1 text-right">📊 סקירת שוק</p>
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
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 px-1 text-right">📰 עדכוני שוק</p>
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
    return <div className="space-y-3">{sects}</div>;
  }

  // ── Weekly Brief ─────────────────────────────────────────────────
  if (slug === 'weekly-brief') {
    const indicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
    const indicesSect = indicesItems.length > 0 ? (
      <div key="indices" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 px-1 text-right">📊 ביצועי שוק</p>
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
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 px-1 text-right">📰 סיכום שוק</p>
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
    return <div className="space-y-3">{sects}</div>;
  }

  // ── Earnings Brief ───────────────────────────────────────────────
  if (slug === 'earnings-brief') {
    const indicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
    const indicesSect = indicesItems.length > 0 ? (
      <div key="indices" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 px-1 text-right">📊 שווקים</p>
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
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 px-1 text-right">📰 רקע שוק</p>
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
    return <div className="space-y-3">{sects}</div>;
  }

  // ── Macro ────────────────────────────────────────────────────────
  if (slug === 'macro') {
    const macroIndicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
    const macroIndicesSect = macroIndicesItems.length > 0 ? (
      <div key="indices" className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 px-1 text-right">📊 שווקים</p>
        <MarketIndicesTable
          items={macroIndicesItems}
          onSaveToBrain={(text) => onSaveToBrain(text, 'indices', '📊 שווקים')}
        />
      </div>
    ) : null;

    const sects = [
      sect('🌍 אירועי מאקרו', extractVideoTabItems(effectiveVideo, 'brief-macro',         marketBriefData), 'brief-macro'),
      macroIndicesSect,
      sect('💡 הזדמנויות',    extractVideoTabItems(effectiveVideo, 'brief-opportunities', marketBriefData), 'brief-opportunities'),
    ].filter(Boolean);

    if (sects.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">🌍</span>
        <p className="text-sm">אין עדיין נתוני מאקרו</p>
      </div>
    );
    return <div className="space-y-3">{sects}</div>;
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

    const sects = [
      sect('👥 שחקנים מרכזיים',   keyPlayers,                                                        'political-players'),
      sect('⚖️ אידיאולוגיה',      [...safeArr(Array.isArray(_ia)  ? _ia  : []), ...objToArr(_ia)],  'political-ideology'),
      sect('✡️ תאולוגיה',          [...safeArr(Array.isArray(_ta)  ? _ta  : []), ...objToArr(_ta)],  'political-theology'),
      sect('🕊️ יהדות ליברלית',    [...safeArr(Array.isArray(_ljp) ? _ljp : []), ...objToArr(_ljp)], 'political-liberal'),
      sect('✅ בעד',               argsFor,                                                            'political-for'),
      sect('❌ נגד',               argsAgainst,                                                        'political-against'),
      sect('📢 סיסמאות וציטוטים', [...safeArr(_vq), ...safeArr(_sl)],                                'political-slogans'),
      sect('⚔️ תגובות לוויכוחים', safeArr(_dr),                                                      'political-debates'),
      sect('📚 ידע לשימוש חוזר',  safeArr(_rk),                                                      'political-reusable'),
    ].filter(Boolean);

    if (sects.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">🏛️</span>
        <p className="text-sm">אין עדיין ניתוח פוליטי — נתח עם GEM פוליטי</p>
      </div>
    );
    return <div className="space-y-3">{sects}</div>;
  }

  // ── Default: show any available specialized content ─────────────
  const defaultSects = [
    sect('🧠 תובנות מפתח',      extractVideoTabItems(effectiveVideo, 'trading-brain',    marketBriefData), 'trading-brain'),
    sect('📈 אינדיקטורים',       extractVideoTabItems(effectiveVideo, 'indicators',       marketBriefData), 'indicators'),
    sect('🎯 סטאפים',             extractVideoTabItems(effectiveVideo, 'setups',           marketBriefData), 'setups'),
    sect('📊 פטרנים',             extractVideoTabItems(effectiveVideo, 'patterns',         marketBriefData), 'patterns'),
    sect('✅ כללים',               extractVideoTabItems(effectiveVideo, 'checklists',       marketBriefData), 'checklists'),
    sect('⚠️ טעויות',             extractVideoTabItems(effectiveVideo, 'mistakes',         marketBriefData), 'mistakes'),
    sect('💰 הערכת שווי',          extractVideoTabItems(effectiveVideo, 'valuation',        marketBriefData), 'valuation'),
    sect('📊 מדדים פיננסיים',    extractVideoTabItems(effectiveVideo, 'financial-metrics', marketBriefData), 'financial-metrics'),
    sect('🔗 סיבה ותוצאה',        extractVideoTabItems(effectiveVideo, 'cause-effect',     marketBriefData), 'cause-effect'),
    sect('🌎 השפעה על השוק',      extractVideoTabItems(effectiveVideo, 'market-impact',    marketBriefData), 'market-impact'),
  ].filter(Boolean);

  if (defaultSects.length === 0) return (
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
  return <div className="space-y-3">{defaultSects}</div>;
}
