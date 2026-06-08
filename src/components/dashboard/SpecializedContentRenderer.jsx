import { LearningTabContent } from "./LearningTabContent";
import { MarketIndicesTable } from "./MarketIndicesTable";
import { extractVideoTabItems } from "@/config/videoTabsConfig";

function Section({ label, items, tabKey, onSaveToBrain }) {
  const safe = Array.isArray(items) ? items : [];
  if (safe.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
      <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 px-1 text-right">{label}</p>
      <LearningTabContent
        items={safe}
        emptyLabel=""
        onSaveToBrain={(text) => onSaveToBrain(text, tabKey, label)}
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
}) {
  const slug = normalizedSubCategory;

  const sect = (label, items, tabKey) => (
    <Section
      key={tabKey}
      label={label}
      items={items}
      tabKey={tabKey}
      onSaveToBrain={onSaveToBrain}
    />
  );

  // ── Technical / Fundamental Analysis ────────────────────────────
  if (slug === 'technical-analysis' || slug === 'fundamental-analysis') {
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

  // ── Market Brief ─────────────────────────────────────────────────
  if (['morning-brief', 'evening-brief', 'weekly-brief', 'earnings-brief'].includes(slug)) {
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

    const sects = [
      sect('📰 חדשות',       extractVideoTabItems(effectiveVideo, 'market-news',         marketBriefData), 'market-news'),
      indicesSect,
      sect('🌍 מאקרו',        extractVideoTabItems(effectiveVideo, 'brief-macro',         marketBriefData), 'brief-macro'),
      sect('🎯 רשימת מעקב',  extractVideoTabItems(effectiveVideo, 'stocks-mentioned',    marketBriefData), 'stocks-mentioned'),
      sect('💡 הזדמנויות',   extractVideoTabItems(effectiveVideo, 'brief-opportunities', marketBriefData), 'brief-opportunities'),
      sect('⚠️ סיכונים',     extractVideoTabItems(effectiveVideo, 'brief-risks',         marketBriefData), 'brief-risks'),
    ].filter(Boolean);

    if (sects.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">📰</span>
        <p className="text-sm">אין עדיין נתוני מבזק — הדבק JSON מ-GEM</p>
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

    const sects = [
      sect('⚖️ אידיאולוגיה',      [...safeArr(Array.isArray(_ia)  ? _ia  : []), ...objToArr(_ia)],  'political-ideology'),
      sect('✡️ תאולוגיה',          [...safeArr(Array.isArray(_ta)  ? _ta  : []), ...objToArr(_ta)],  'political-theology'),
      sect('🕊️ יהדות ליברלית',    [...safeArr(Array.isArray(_ljp) ? _ljp : []), ...objToArr(_ljp)], 'political-liberal'),
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
