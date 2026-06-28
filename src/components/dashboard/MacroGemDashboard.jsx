import { TONE } from '@/lib/morningBriefVisuals';
import {
  DASHBOARD_TABLE_HEAD_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_CELL_BODY_CLS,
  SectionCard,
  getSectorMeta,
} from './MorningBriefVisualPrimitives';
import { LearningTabContent } from './LearningTabContent';
import { TabBulkItemsRegistrar } from './TabBulkItemsRegistrar';
import { extractVideoTabItems } from '@/config/videoTabsConfig';
import { mergeBulkSelection } from '@/lib/universalTabBulkItems';
import { resolveFinvizTicker } from '@/utils/finvizLinks';
import { MarketSectorTable } from './MarketSectorTable';
import { UniversalTabCheckbox } from '@/components/shared/UniversalTabSelectRow';
import { UniversalTabQuickSaveFromBulk, UniversalTabQuickSaveActions } from '@/components/shared/UniversalTabQuickSaveActions';
import { ResearchDropdown, ResearchDropdownCompact } from '@/components/shared/ResearchDropdown';

// ── Hebrew label map for raw English GEM keys ────────────────────────

const MACRO_FIELD_HE = {
  // macroOverview fields
  mainTheme: 'נושא מרכזי',
  macroMood: 'מצב מאקרו',
  mainConclusion: 'מסקנה מרכזית',
  marketImplication: 'השפעה על השוק',
  riskOnRiskOff: 'Risk On / Risk Off',
  // fedPolicy / interestRates fields
  decision: 'החלטה',
  tone: 'טון',
  rationale: 'נימוק',
  bias: 'הטיה',
  policy: 'מדיניות',
  forecast: 'פרוגנוזה',
  // generic object fields
  status: 'סטטוס',
  direction: 'כיוון',
  impact: 'השפעה',
  current: 'נוכחי',
  trend: 'מגמה',
  outlook: 'תחזית',
  level: 'רמה',
  rate: 'שיעור',
  change: 'שינוי',
  description: 'תיאור',
  context: 'הקשר',
  signal: 'אות',
  note: 'הערה',
  assessment: 'הערכה',
  value: 'ערך',
  price: 'מחיר',
  yield: 'תשואה',
  spread: 'ספרד',
  strength: 'חוזק',
  supply: 'היצע',
  demand: 'ביקוש',
  growth: 'צמיחה',
  employment: 'תעסוקה',
  wages: 'שכר',
  nextMeeting: 'פגישה הבאה',
  expectation: 'ציפייה',
  summary: 'סיכום',
  key: 'מפתח',
  main: 'עיקרי',
  sentiment: 'סנטימנט',
  action: 'פעולה',
  risk: 'סיכון',
  opportunity: 'הזדמנות',
  headline: 'כותרת',
  type: 'סוג',
  category: 'קטגוריה',
  importance: 'חשיבות',
  magnitude: 'עצמה',
  momentum: 'מומנטום',
  volatility: 'תנודתיות',
  indicator: 'אינדיקטור',
  target: 'יעד',
  support: 'תמיכה',
  resistance: 'התנגדות',
  projection: 'תחזית',
};

function heLabel(key) {
  return MACRO_FIELD_HE[key] || key;
}

// For nested object values: unknown keys → show value only (no raw English key name)
function flattenVal(val) {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.filter(Boolean).map(flattenVal).join(', ');
  if (typeof val === 'object') {
    return Object.entries(val)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => {
        const heKey = MACRO_FIELD_HE[k];
        const flatV = flattenVal(v);
        return heKey ? `${heKey}: ${flatV}` : flatV;
      })
      .filter(Boolean)
      .join(' · ');
  }
  return String(val);
}

// ── Save button helper ───────────────────────────────────────────────

function SaveBtn({ text, sectionKey, sectionLabel, onSaveToBrain }) {
  if (!onSaveToBrain || !text) return null;
  return (
    <button
      type="button"
      onClick={() => onSaveToBrain(text, sectionKey, sectionLabel)}
      title="שמור למוח"
      className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm leading-none transition-colors"
    >
      🧠
    </button>
  );
}

/**
 * Renders Brain / Obsidian / Workspace save actions when bulkSelection provides
 * the quick-save handlers. Falls back to compact ⋯ menu with brain + copy.
 */
function MacroSaveCluster({ text, sectionKey, sectionLabel, onSaveToBrain, bulkSelection, compact = true }) {
  if (bulkSelection?.onQuickSaveBrain || bulkSelection?.onQuickSaveObsidian || bulkSelection?.onQuickSaveWorkspace) {
    return (
      <UniversalTabQuickSaveFromBulk
        bulkSelection={bulkSelection}
        text={text}
        sectionLabel={sectionLabel}
        type={sectionKey}
        tabScope="specialized"
        compact={compact}
      />
    );
  }
  if (!text) return null;
  return (
    <UniversalTabQuickSaveActions
      meta={{ text, sectionLabel, type: sectionKey }}
      onBrain={onSaveToBrain ? () => onSaveToBrain(text, sectionKey, sectionLabel) : undefined}
      compact
    />
  );
}

// ── Research provider button (Perplexity + Google Finance dropdown) ──

function PxBtn({ url }) {
  return <ResearchDropdownCompact pxUrl={url} />;
}

// ── Object section (key-value table) ────────────────────────────────

function ObjectRows({ obj, groupLabel, sectionKey, sectionLabel, onSaveToBrain, bulkSelection }) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return null;

  return (
    <>
      {groupLabel && (
        <tr>
          <td colSpan={4} className="pt-4 pb-1 pr-2 pl-0">
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              {groupLabel}
            </span>
          </td>
        </tr>
      )}
      {entries.map(([key, val]) => {
        const heKey = heLabel(key);
        const displayVal = flattenVal(val);
        if (!displayVal) return null;
        const rowText = `${heKey}: ${displayVal}`;
        return (
          <tr
            key={key}
            className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group"
          >
            {/* Checkbox col — reserved for future bulk selection */}
            <td className="py-2 pr-2 pl-0 w-5 align-middle" />
            <td className="px-2 py-2 align-top w-[160px] min-w-[120px]">
              <span className={`whitespace-nowrap ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{heKey}</span>
            </td>
            <td className="px-2 py-2 align-top">
              <p
                className={`${DASHBOARD_TABLE_CELL_BODY_CLS} break-words [overflow-wrap:anywhere]`}
                dir={/^[a-zA-Z0-9\s]+$/.test(displayVal.slice(0, 6)) ? 'ltr' : 'rtl'}
              >
                {displayVal}
              </p>
            </td>
            {/* Save col */}
            <td className="py-2 pl-1 pr-0 w-8 align-middle opacity-0 group-hover:opacity-100 transition-opacity">
              <MacroSaveCluster text={rowText} sectionKey={sectionKey} sectionLabel={sectionLabel} onSaveToBrain={onSaveToBrain} bulkSelection={bulkSelection} />
            </td>
          </tr>
        );
      })}
    </>
  );
}

function MacroObjectSection({ title, objects, sectionKey, onSaveToBrain, bulkSelection }) {
  const valid = objects.filter(({ obj }) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    return Object.keys(obj).length > 0;
  });
  if (!valid.length) return null;

  const totalEntries = valid.reduce((sum, { obj }) => sum + Object.keys(obj).length, 0);

  return (
    <SectionCard title={title} count={totalEntries} tone={TONE.NEUTRAL}>
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse" dir="rtl">
          <thead>
            <tr className="border-b-2 border-slate-200/80 dark:border-zinc-700/70">
              <th className="py-1.5 pr-2 pl-0 w-5" />
              <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>שדה</th>
              <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>ערך</th>
              <th className="py-1.5 pl-1 pr-0 w-8" />
            </tr>
          </thead>
          <tbody>
            {valid.map(({ label, obj }) => (
              <ObjectRows
                key={label}
                obj={obj}
                groupLabel={valid.length > 1 ? label : null}
                sectionKey={sectionKey}
                sectionLabel={title}
                onSaveToBrain={onSaveToBrain}
                bulkSelection={bulkSelection}
              />
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ── Stocks mentioned table ───────────────────────────────────────────

function MacroSentimentCell({ value }) {
  if (!value) return <span className="text-slate-400 dark:text-zinc-500">—</span>;
  const v = String(value).toLowerCase();
  const isPositive = v.includes('חיובי') || v.includes('bullish') || v.includes('long') || v.includes('buy') || v.includes('up') || v.includes('outperform') || v.includes('strong');
  const isNegative = v.includes('שלילי') || v.includes('bearish') || v.includes('short') || v.includes('sell') || v.includes('down') || v.includes('underperform') || v.includes('weak');
  const dot = isPositive ? 'bg-emerald-500' : isNegative ? 'bg-red-500' : 'bg-amber-400';
  const textCls = isPositive
    ? 'text-emerald-700 dark:text-emerald-400'
    : isNegative
    ? 'text-red-700 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${DASHBOARD_TABLE_CELL_BODY_CLS} ${textCls}`}>
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <span>{value}</span>
    </span>
  );
}

// ── Shared column-width tokens — aligns Sentiment across all market tables ──
// Pre-Sentiment columns in every table must sum to 38% (+ 2.5% checkbox = 40.5%).
// Stocks:  symbol(11%) + company(27%) = 38%
// Sectors: name(38%) = 38%
// Indices: name(27%) + change(11%) = 38%
const MCOL = {
  checkbox: '2.5%', sentiment: '15.5%', save: '5%',
  stocks:  { symbol: '11%', company: '27%' },
  sectors: { name: '38%' },
  indices: { name: '27%', change: '11%' },
};

function MacroStocksSection({ stocks, onSaveToBrain, bulkSelection }) {
  const safe = Array.isArray(stocks) ? stocks.filter(Boolean) : [];
  if (!safe.length) return null;

  const merged = bulkSelection
    ? mergeBulkSelection(bulkSelection, {
        idPrefix: 'macro-gem:stocks-mentioned',
        sectionLabel: '🎯 מניות שהוזכרו',
        type: 'stocks-mentioned',
        tabScope: 'specialized',
      })
    : null;

  return (
    <SectionCard title="🎯 מניות שהוזכרו" count={safe.length} tone={TONE.NEUTRAL}>
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse" style={{ tableLayout: 'fixed' }} dir="rtl">
          <colgroup>
            <col style={{ width: MCOL.checkbox }} />
            <col style={{ width: MCOL.stocks.symbol }} />
            <col style={{ width: MCOL.stocks.company }} />
            <col style={{ width: MCOL.sentiment }} />
            <col />
            <col style={{ width: MCOL.save }} />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-slate-200/80 dark:border-zinc-700/70">
              <th className="py-1.5 pr-2 pl-0" />
              <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סימבול</th>
              <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>חברה</th>
              <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
              <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סיבה / הערה</th>
              <th className="py-1.5 pl-1 pr-0" />
            </tr>
          </thead>
          <tbody>
            {safe.map((item, i) => {
              if (typeof item === 'string') {
                // Extract ticker from strings like "AVGO", "AVGO - Broadcom", "AVGO (Broadcom)"
                const tickerMatch = item.match(/\b([A-Z]{2,5})\b/);
                const strTicker = tickerMatch?.[1] || null;
                const strPxUrl  = strTicker ? buildPerplexityStockUrl(strTicker) : null;
                return (
                  <tr key={i} className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 group">
                    <td className="py-2 pr-2 pl-0 w-5 align-middle" />
                    <td colSpan={4} className="px-2 py-2 align-middle">
                      {strTicker ? (
                        <a
                          href={`https://finviz.com/quote.ashx?t=${encodeURIComponent(strTicker)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="פתח ב-Finviz ↗"
                          className={`font-mono font-bold ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline`}
                          dir="ltr"
                          onClick={(e) => e.stopPropagation()}
                          data-finviz-link={strTicker}
                        >
                          {item}
                        </a>
                      ) : (
                        <span className={DASHBOARD_TABLE_CELL_BODY_CLS} dir="ltr">{item}</span>
                      )}
                    </td>
                    <td className="py-2 pl-1 pr-0 w-8 align-middle opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-0.5">
                        <PxBtn url={strPxUrl} />
                        <MacroSaveCluster text={item} sectionKey="stocks-mentioned" sectionLabel="🎯 מניות שהוזכרו" onSaveToBrain={onSaveToBrain} bulkSelection={merged} />
                      </div>
                    </td>
                  </tr>
                );
              }

              const symbol = String(item.symbol || item.ticker || item.stock || '').trim();
              const company = String(item.company || item.name || '').trim();
              const sent = String(item.sentiment || item.direction || item.tone || '').trim();
              const reason = String(item.reason || item.note || item.why || item.comment || item.analysis || item.thesis || '').trim();
              const rowText = [symbol, company, sent, reason].filter(Boolean).join(' · ');
              const stockPxUrl = symbol ? buildPerplexityStockUrl(symbol) : null;

              return (
                <tr
                  key={i}
                  className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group"
                >
                  <td className="py-2 pr-2 pl-0 w-5 align-middle" />
                  <td className="px-2 py-2 align-middle whitespace-nowrap">
                    {symbol ? (
                      <a
                        href={`https://finviz.com/quote.ashx?t=${encodeURIComponent(symbol)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="פתח ב-Finviz ↗"
                        className={`font-mono font-bold ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline cursor-pointer`}
                        dir="ltr"
                        onClick={(e) => e.stopPropagation()}
                        data-finviz-link={symbol}
                      >
                        {symbol}
                      </a>
                    ) : (
                      <span className="text-slate-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{company || '—'}</span>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <MacroSentimentCell value={sent} />
                  </td>
                  <td className="px-2 py-2 align-middle max-w-[22rem]">
                    <p
                      className={`${DASHBOARD_TABLE_CELL_BODY_CLS} line-clamp-2 break-words`}
                      title={reason || undefined}
                    >
                      {reason || '—'}
                    </p>
                  </td>
                  <td className="py-2 pl-1 pr-0 w-8 align-middle opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-0.5">
                      <PxBtn url={stockPxUrl} />
                      <MacroSaveCluster text={rowText} sectionKey="stocks-mentioned" sectionLabel="🎯 מניות שהוזכרו" onSaveToBrain={onSaveToBrain} bulkSelection={merged} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ── Sectors table ────────────────────────────────────────────────────


function MacroSectorsSection({ sectors, onSaveToBrain, bulkSelection }) {
  const safe = Array.isArray(sectors) ? sectors.filter(Boolean) : [];
  if (!safe.length) return null;

  const merged = bulkSelection
    ? mergeBulkSelection(bulkSelection, {
        idPrefix: 'macro-gem:brief-sectors',
        sectionLabel: '🏭 סקטורים',
        type: 'brief-sectors',
        tabScope: 'specialized',
      })
    : null;

  return (
    <SectionCard title="🏭 סקטורים" count={safe.length} tone={TONE.NEUTRAL}>
      <MarketSectorTable
        rows={safe}
        renderLeadingCell={() => null}
        renderTrailingCell={(_item, _i, normalized) => (
          <MacroSaveCluster
            text={normalized.rowText}
            sectionKey="brief-sectors"
            sectionLabel="🏭 סקטורים"
            onSaveToBrain={onSaveToBrain}
            bulkSelection={merged}
          />
        )}
      />
    </SectionCard>
  );
}

// ── Severity / Importance translation ───────────────────────────────

const SEVERITY_HE = {
  critical: 'קריטית', CRITICAL: 'קריטית',
  'very high': 'גבוהה מאוד', 'VERY HIGH': 'גבוהה מאוד',
  high: 'גבוהה', HIGH: 'גבוהה',
  medium: 'בינונית', MEDIUM: 'בינונית',
  low: 'נמוכה', LOW: 'נמוכה',
  minimal: 'מינימלית', MINIMAL: 'מינימלית',
};

function translateLevel(val) {
  const s = String(val || '').trim();
  return SEVERITY_HE[s] || s;
}

// ── Item formatters — never expose raw English keys ──────────────────

/**
 * Macro event item: { event/title, date, importance, impact, sectors }
 * → "event_title\n📅 date\nחשיבות: HIGH_in_he\nהשפעה: impact"
 */
function formatMacroEventItem(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);

  const title = (item.event || item.title || item.name || item.subject || '').trim();
  const date  = (item.date  || item.time  || item.when   || '').trim();
  const imp   = translateLevel(item.importance || item.priority || item.significance || '');
  const impact = (item.impact || item.effect || item.description || item.expectedImpact || '').trim();
  const sectors = item.sectors || item.affectedSectors;
  const secStr  = Array.isArray(sectors) ? sectors.join(', ') : typeof sectors === 'string' ? sectors : '';

  if (!title && !impact) {
    return Object.values(item).find((v) => typeof v === 'string' && v.trim()) || '';
  }

  const lines = [];
  if (title)  lines.push(title);
  if (date)   lines.push(`📅 ${date}`);
  if (imp)    lines.push(`חשיבות: ${imp}`);
  if (impact) lines.push(`השפעה: ${impact}`);
  if (secStr) lines.push(`סקטורים: ${secStr}`);
  return lines.join('\n');
}

/**
 * Opportunity item: { title/name, type/category, details/description, assets, catalyst }
 * → "title\nסוג: type\nפרטים: details"
 */
function formatOpportunityItem(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);

  const title   = (item.title   || item.name        || item.opportunity || item.subject  || '').trim();
  const type    = (item.type    || item.category     || item.style       || item.strategy || '').trim();
  const details = (item.details || item.description  || item.note        || item.thesis   || '').trim();
  const assets  = item.assets   || item.tickers      || '';
  const assetStr = Array.isArray(assets) ? assets.join(', ') : String(assets || '');
  const catalyst = (item.catalyst || item.trigger || '').trim();

  if (!title && !details) {
    return Object.values(item).find((v) => typeof v === 'string' && v.trim()) || '';
  }

  const lines = [];
  if (title)    lines.push(title);
  if (type)     lines.push(`סוג: ${type}`);
  if (details)  lines.push(`פרטים: ${details}`);
  if (assetStr) lines.push(`נכסים: ${assetStr}`);
  if (catalyst) lines.push(`קטליסט: ${catalyst}`);
  return lines.join('\n');
}

/**
 * Risk item: { title/name/risk, severity/level, details/description/impact, affectedAssets }
 * → "title\nחומרה: HIGH_in_he\nפרטים: details"
 */
function formatRiskItem(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);

  const title    = (item.title   || item.name        || item.risk     || item.subject || '').trim();
  const severity = translateLevel(item.severity || item.level || item.importance || '');
  const details  = (item.details || item.description || item.impact   || item.note   || '').trim();
  const affected = item.affectedAssets || item.assets || item.tickers || '';
  const affStr   = Array.isArray(affected) ? affected.join(', ') : String(affected || '');

  if (!title && !details) {
    return Object.values(item).find((v) => typeof v === 'string' && v.trim()) || '';
  }

  const lines = [];
  if (title)    lines.push(title);
  if (severity) lines.push(`חומרה: ${severity}`);
  if (details)  lines.push(`פרטים: ${details}`);
  if (affStr)   lines.push(`נכסים: ${affStr}`);
  return lines.join('\n');
}

/**
 * Warning / action item: { warning/action/title/text, details/description, priority }
 * → "text\nעדיפות: priority_in_he\nפרטים: details"
 */
function formatWarningItem(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);

  const text     = (item.warning || item.action  || item.title   || item.text   || item.content || '').trim();
  const details  = (item.details || item.description || item.note || '').trim();
  const priority = translateLevel(item.priority || item.importance || item.severity || '');

  if (!text && !details) {
    return Object.values(item).find((v) => typeof v === 'string' && v.trim()) || '';
  }

  const lines = [];
  if (text)     lines.push(text);
  if (priority) lines.push(`עדיפות: ${priority}`);
  if (details)  lines.push(`פרטים: ${details}`);
  return lines.join('\n');
}

function formatHighlightItem(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);

  const title       = (item.title || item.headline || item.name || item.subject || item.highlight || '').trim();
  const description = (item.description || item.detail || item.note || item.text || item.summary || '').trim();
  const sentiment   = (item.sentiment || item.direction || item.tone || '').trim();
  const impact      = (item.impact || item.marketImplication || '').trim();

  if (!title && !description) {
    return Object.values(item).find((v) => typeof v === 'string' && v.trim()) || '';
  }

  const lines = [];
  if (title)       lines.push(title);
  if (sentiment)   lines.push(`סנטימנט: ${sentiment}`);
  if (description) lines.push(description);
  if (impact)      lines.push(`השפעה: ${impact}`);
  return lines.join('\n');
}

// ── Array section (bulleted list via LearningTabContent) ─────────────

function MacroArraySection({ title, items, sectionKey, formatItem, onSaveToBrain, bulkSelection }) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safe.length) return null;

  // Use provided formatter; fall back to string passthrough for unknown shapes
  const fmt = formatItem || ((item) => (typeof item === 'string' ? item.trim() : String(item)));
  const strings = safe.map(fmt).filter(Boolean);
  if (!strings.length) return null;

  return (
    <SectionCard title={title} count={strings.length} tone={TONE.NEUTRAL}>
      <LearningTabContent
        items={strings}
        emptyLabel=""
        onSaveToBrain={onSaveToBrain ? (text) => onSaveToBrain(text, sectionKey, title) : undefined}
        bulkSelection={
          bulkSelection
            ? mergeBulkSelection(bulkSelection, {
                idPrefix: `macro-gem:${sectionKey}`,
                sectionLabel: title,
                type: sectionKey,
                tabScope: 'specialized',
              })
            : null
        }
      />
    </SectionCard>
  );
}

// ── Array section with per-item Perplexity research button + checkbox ─

function MacroResearchSection({ title, items, sectionKey, formatItem, pxUrlBuilder, onSaveToBrain, bulkSelection }) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safe.length) return null;
  const fmt = formatItem || ((item) => (typeof item === 'string' ? item.trim() : String(item)));

  const merged = bulkSelection
    ? mergeBulkSelection(bulkSelection, {
        idPrefix: `macro-gem:${sectionKey}`,
        sectionLabel: title,
        type: sectionKey,
        tabScope: 'specialized',
      })
    : null;

  return (
    <SectionCard title={title} count={safe.length} tone={TONE.NEUTRAL}>
      <ul className="divide-y divide-slate-100 dark:divide-zinc-800" dir="rtl">
        {safe.map((item, i) => {
          const text = fmt(item);
          if (!text) return null;
          const pxUrl = pxUrlBuilder ? pxUrlBuilder(item) : null;
          const bulkId = merged ? `macro-gem:${sectionKey}:${i}` : null;
          const isChecked = bulkId ? !!merged.multiSelected?.has(bulkId) : false;
          const onToggle = bulkId && merged?.onToggle
            ? () => merged.onToggle(bulkId, { text, sectionLabel: title, type: sectionKey, tabScope: 'specialized' })
            : null;
          return (
            <li key={i} className="group flex items-start gap-2 py-2 px-1 first:pt-0 last:pb-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 rounded transition-colors">
              {onToggle && (
                <div className="shrink-0 mt-1">
                  <UniversalTabCheckbox checked={isChecked} onChange={onToggle} />
                </div>
              )}
              <span className="mt-1.5 text-indigo-300 dark:text-indigo-600 shrink-0 select-none text-[10px]">▸</span>
              <p className={`flex-1 text-sm leading-relaxed ${DASHBOARD_TABLE_CELL_BODY_CLS} break-words [overflow-wrap:anywhere] whitespace-pre-line`}>{text}</p>
              <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {pxUrl && <PxBtn url={pxUrl} />}
                <MacroSaveCluster text={text} sectionKey={sectionKey} sectionLabel={title} onSaveToBrain={onSaveToBrain} bulkSelection={merged} />
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

// ── Highlights section — sentiment-colored cards ──────────────────────

const HIGHLIGHT_TONE_CSS = {
  green: {
    card:      'bg-gradient-to-br from-emerald-50/90 via-green-50/60 to-white dark:from-emerald-950/25 dark:via-green-950/10 dark:to-zinc-900 border-emerald-200/80 dark:border-emerald-800/50',
    accent:    'bg-emerald-500',
    badge:     'text-emerald-700 dark:text-emerald-300 border border-emerald-400/60 dark:border-emerald-600/50',
    iconBg:    'bg-emerald-50 dark:bg-emerald-950/30',
    iconEmoji: '📈',
    sentLabel: 'חיובי',
  },
  red: {
    card:      'bg-gradient-to-br from-red-50/90 via-rose-50/60 to-white dark:from-red-950/25 dark:via-rose-950/10 dark:to-zinc-900 border-red-200/80 dark:border-red-800/50',
    accent:    'bg-red-500',
    badge:     'text-red-700 dark:text-red-300 border border-red-400/60 dark:border-red-600/50',
    iconBg:    'bg-red-50 dark:bg-red-950/30',
    iconEmoji: '📉',
    sentLabel: 'שלילי',
  },
  amber: {
    card:      'bg-gradient-to-br from-amber-50/90 via-yellow-50/60 to-white dark:from-amber-950/25 dark:via-yellow-950/10 dark:to-zinc-900 border-amber-200/80 dark:border-amber-800/50',
    accent:    'bg-amber-400',
    badge:     'text-amber-700 dark:text-amber-300 border border-amber-400/60 dark:border-amber-600/50',
    iconBg:    'bg-amber-50 dark:bg-amber-950/30',
    iconEmoji: '⚖️',
    sentLabel: 'ניטרלי',
  },
};

function getHighlightTone(item) {
  const raw = typeof item === 'string' ? item : (item?.sentiment || item?.direction || item?.tone || '');
  const sl = String(raw).toLowerCase();
  if (sl.includes('חיובי') || sl.includes('bullish') || sl.includes('positive') || sl.includes('buy') || sl.includes('long')) return 'green';
  if (sl.includes('שלילי') || sl.includes('bearish') || sl.includes('negative') || sl.includes('sell') || sl.includes('short')) return 'red';
  return 'amber';
}

function MacroHighlightsSection({ items, onSaveToBrain, bulkSelection }) {
  const safe = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!safe.length) return null;

  const merged = bulkSelection
    ? mergeBulkSelection(bulkSelection, {
        idPrefix: 'macro-gem:macro-highlights',
        sectionLabel: '⭐ היילייטים',
        type: 'macro-highlights',
        tabScope: 'specialized',
      })
    : null;

  return (
    <SectionCard title="⭐ היילייטים" count={safe.length} tone={TONE.NEUTRAL}>
      <div className="space-y-3" dir="rtl">
        {safe.map((item, i) => {
          const title   = (typeof item === 'string' ? item : (item.title || item.headline || item.name || item.subject || item.highlight || '')).trim();
          const descr   = typeof item === 'object' ? (item.description || item.detail || item.note || item.text || item.summary || '').trim() : '';
          const impact  = typeof item === 'object' ? (item.impact || item.marketImplication || '').trim() : '';
          const tone    = getHighlightTone(item);
          const css     = HIGHLIGHT_TONE_CSS[tone];
          const rowText = formatHighlightItem(item);

          const bulkId    = merged ? `macro-gem:macro-highlights:${i}` : null;
          const isChecked = bulkId ? !!merged.multiSelected?.has(bulkId) : false;
          const onToggle  = bulkId && merged?.onToggle
            ? () => merged.onToggle(bulkId, { text: rowText, sectionLabel: '⭐ היילייטים', type: 'macro-highlights', tabScope: 'specialized' })
            : null;
          const pxUrl = buildPerplexityResearchQuery(item, 'highlights');

          return (
            <div
              key={i}
              className={`group relative rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden ${css.card}`}
            >
              {/* Sentiment accent bar — right edge in RTL */}
              <div className={`absolute right-0 top-0 bottom-0 w-[3px] ${css.accent}`} />

              <div className="p-5 pr-6" dir="rtl">
                {/* ── Header row ───────────────────────────────────── */}
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl ${css.iconBg} shadow-sm text-[28px] leading-none`}>
                    {css.iconEmoji}
                  </div>

                  {/* Title + sentiment badge — same line */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-baseline gap-2 flex-wrap" dir="rtl">
                      <p className="text-base font-black leading-tight text-slate-900 dark:text-zinc-50 break-words [overflow-wrap:anywhere] flex-1 min-w-0">
                        {title || '—'}
                      </p>
                      <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-[13px] font-semibold leading-none ${css.badge}`}>
                        {css.sentLabel}
                      </span>
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div className="shrink-0 flex flex-col items-end">
                    {onToggle && <UniversalTabCheckbox checked={isChecked} onChange={onToggle} />}
                  </div>
                </div>

                {/* ── Body text ────────────────────────────────────── */}
                {(descr || impact) && (
                  <div className="mt-3 space-y-1 mr-[72px]">
                    {descr && (
                      <p className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100 leading-relaxed break-words">
                        {descr}
                      </p>
                    )}
                    {impact && (
                      <p className="text-[15px] font-medium text-slate-800 dark:text-zinc-200 italic leading-relaxed break-words">
                        {impact}
                      </p>
                    )}
                  </div>
                )}

                {/* ── Action bar ───────────────────────────────────── */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100/80 dark:border-zinc-800/60 flex-wrap">
                  {pxUrl && <ResearchDropdown pxUrl={pxUrl} />}
                  <div className="mr-auto flex items-center gap-1">
                    <MacroSaveCluster text={rowText} sectionKey="macro-highlights" sectionLabel="⭐ היילייטים" onSaveToBrain={onSaveToBrain} bulkSelection={merged} compact={true} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ── Warnings & Follow-up Actions — action card rows ──────────────────

const WARNING_BADGE_CSS = {
  קריטי: {
    badge:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    border: 'border-r-red-500 dark:border-r-red-500',
    iconBg: 'bg-red-50 dark:bg-red-950/30',
    icon:   '🔴',
    dot:    'bg-red-500',
    emoji:  '🔴',
  },
  חשוב: {
    badge:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    border: 'border-r-orange-500 dark:border-r-orange-400',
    iconBg: 'bg-orange-50 dark:bg-orange-950/30',
    icon:   '🟠',
    dot:    'bg-orange-500',
    emoji:  '🟠',
  },
  מעקב: {
    badge:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    border: 'border-r-amber-400 dark:border-r-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/30',
    icon:   '🟡',
    dot:    'bg-amber-500',
    emoji:  '🟡',
  },
  מידע: {
    badge:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    border: 'border-r-blue-400 dark:border-r-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-950/30',
    icon:   '🔵',
    dot:    'bg-blue-500',
    emoji:  '🔵',
  },
  פעולה: {
    badge:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    border: 'border-r-emerald-500 dark:border-r-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon:   '🟢',
    dot:    'bg-emerald-500',
    emoji:  '🟢',
  },
};

function resolveWarningBadge(item) {
  if (typeof item === 'string') return 'מעקב';
  const raw = (item.type || item.category || item.badge || item.priority || item.importance || '').toLowerCase();
  if (raw.includes('critical') || raw.includes('קריטי') || raw.includes('severe') || raw.includes('extreme')) return 'קריטי';
  if (raw.includes('important') || raw.includes('חשוב') || raw.includes('high') || raw.includes('urgent')) return 'חשוב';
  if (raw.includes('info') || raw.includes('מידע') || raw.includes('note') || raw.includes('low')) return 'מידע';
  if (raw.includes('action') || raw.includes('פעולה') || raw.includes('buy') || raw.includes('sell') || raw.includes('trade')) return 'פעולה';
  return 'מעקב';
}

function resolveWarningDate(item) {
  if (typeof item !== 'object' || !item) return null;
  return (item.date || item.time || item.when || item.timestamp || '').trim() || null;
}

function MacroWarningsSection({ items, onSaveToBrain, bulkSelection }) {
  const safe = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!safe.length) return null;

  const merged = bulkSelection
    ? mergeBulkSelection(bulkSelection, {
        idPrefix: 'macro-gem:macro-warnings',
        sectionLabel: '🔔 אזהרות ופעולות למעקב',
        type: 'macro-warnings',
        tabScope: 'specialized',
      })
    : null;

  const PRIORITY_ORDER = ['קריטי', 'חשוב', 'מעקב', 'מידע', 'פעולה'];
  const priorityCounts = safe.reduce((acc, item) => {
    const k = resolveWarningBadge(item);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return (
    <SectionCard title="🔔 אזהרות ופעולות למעקב" count={safe.length} tone={TONE.NEUTRAL}>
      <div className="space-y-2" dir="rtl">
        {safe.map((item, i) => {
          const text = typeof item === 'string' ? item.trim()
            : (item.warning || item.action || item.title || item.text || item.content || '').trim();
          if (!text) return null;

          const hasWarningField = typeof item === 'object' && Boolean(item?.warning);
          const recommendation  = typeof item === 'object'
            ? (item.recommendation || item.suggestion || (hasWarningField ? item.action : '') || '').trim()
            : '';
          const details  = typeof item === 'object' ? (item.details || item.description || item.note || '').trim() : '';
          const dateStr  = resolveWarningDate(item);
          const badgeKey = resolveWarningBadge(item);
          const css      = WARNING_BADGE_CSS[badgeKey] || WARNING_BADGE_CSS['מעקב'];
          const rowText  = formatWarningItem(item);

          const bulkId    = merged ? `macro-gem:macro-warnings:${i}` : null;
          const isChecked = bulkId ? !!merged.multiSelected?.has(bulkId) : false;
          const onToggle  = bulkId && merged?.onToggle
            ? () => merged.onToggle(bulkId, { text: rowText, sectionLabel: '🔔 אזהרות ופעולות למעקב', type: 'macro-warnings', tabScope: 'specialized' })
            : null;

          return (
            <div
              key={i}
              dir="rtl"
              className={`group flex items-start gap-3 rounded-xl border border-r-4 ${css.border} border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 shadow-sm hover:shadow-md transition-shadow`}
            >
              {/* Checkbox — far right in RTL (first in DOM) */}
              {onToggle && (
                <div className="shrink-0 pt-0.5">
                  <UniversalTabCheckbox checked={isChecked} onChange={onToggle} />
                </div>
              )}

              {/* Content block */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-snug ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} break-words [overflow-wrap:anywhere]`}>
                  {text}
                </p>
                {recommendation && (
                  <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-400 font-medium leading-snug">
                    💡 {recommendation}
                  </p>
                )}
                {!recommendation && details && (
                  <p className={`text-sm mt-0.5 ${DASHBOARD_TABLE_CELL_BODY_CLS} leading-snug`}>{details}</p>
                )}
                {dateStr && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                    <span>📅</span>
                    <span>{dateStr}</span>
                  </div>
                )}
              </div>

              {/* Save — far left in RTL */}
              <div className="shrink-0 flex items-center">
                <MacroSaveCluster text={rowText} sectionKey="macro-warnings" sectionLabel="🔔 אזהרות ופעולות למעקב" onSaveToBrain={onSaveToBrain} bulkSelection={merged} />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ── Market impact Perplexity URL ─────────────────────────────────────

function buildMarketImpactUrl(item) {
  const title = typeof item === 'string' ? item.trim()
    : (item?.event || item?.title || item?.name || '').trim();
  if (!title) return null;
  const q = `מה ההשפעה על השוק הפיננסי של "${title}"?\n1. אילו מניות/סקטורים יושפעו חיובית\n2. אילו יושפעו שלילית\n3. השפעה על אג"ח ומטבעות\nענה בעברית.`;
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`;
}

// ── Event icon heuristic ──────────────────────────────────────────────

function getEventIcon(item) {
  const t = typeof item === 'string' ? item
    : `${item?.event || item?.title || ''} ${item?.impact || item?.description || ''}`;
  const l = t.toLowerCase();
  if (l.includes('fed') || l.includes('fomc') || l.includes('ריבית') || l.includes('בנק')) return '🏦';
  if (l.includes('war') || l.includes('trump') || l.includes('מלחמה') || l.includes('גיאופ')) return '🌍';
  if (l.includes('gdp') || l.includes('cpi') || l.includes('inflation') || l.includes('אינפלציה') || l.includes('תמ"ג')) return '📊';
  if (l.includes('earnings') || l.includes('דוחות') || l.includes('רבעון')) return '📈';
  if (l.includes('oil') || l.includes('נפט') || l.includes('opec') || l.includes('אנרגיה')) return '⛽';
  if (l.includes('trade') || l.includes('tariff') || l.includes('מכס') || l.includes('סחר')) return '🔄';
  return '📌';
}

// ── MacroEventCardsSection — premium terminal-style cards ─────────────

function MacroEventCardsSection({ items, onSaveToBrain, bulkSelection }) {
  const safe = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!safe.length) return null;

  const merged = bulkSelection
    ? mergeBulkSelection(bulkSelection, {
        idPrefix: 'macro-gem:brief-macro',
        sectionLabel: '🌍 אירועי מאקרו',
        type: 'brief-macro',
        tabScope: 'specialized',
      })
    : null;

  return (
    <SectionCard title="🌍 אירועי מאקרו" count={safe.length} tone={TONE.NEUTRAL}>
      <p className="text-[12px] text-slate-500 dark:text-zinc-400 mb-3 pb-2 border-b border-slate-100 dark:border-zinc-800">
        אירועים נקודתיים שיכולים להזיז את השוק
      </p>
      <div className="w-full overflow-x-auto" dir="rtl">
        <table className="w-full min-w-[860px] text-right border-collapse table-fixed" dir="rtl">
          <colgroup>
            <col style={{ width: '2.5%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col />
            <col style={{ width: '11%' }} />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-slate-200/80 dark:border-zinc-700/70">
              <th className="py-1.5 pr-2 pl-0" aria-label="בחירה" />
              <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>אירוע</th>
              <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>תאריך</th>
              <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>חשיבות</th>
              <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סוג אירוע</th>
              <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>נכסים מושפעים</th>
              <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>השפעה צפויה</th>
              <th className={`py-1.5 pl-1 pr-0 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {safe.map((item, i) => {
              const isStr     = typeof item === 'string';
              const title     = isStr ? item.trim() : (item.event || item.title || item.name || item.subject || '').trim();
              const date      = isStr ? '' : (item.date || item.time || item.when || '').trim();
              const imp       = isStr ? '' : translateLevel(item.importance || item.priority || item.significance || '');
              const impact    = isStr ? '' : (item.impact || item.effect || item.description || item.expectedImpact || '').trim();
              const eventType = isStr ? '' : (item.type || item.eventType || item.category || '').trim();
              const secs      = isStr ? [] : (() => {
                const raw = item.sectors || item.affectedSectors || item.affectedAssets || item.assets || [];
                return Array.isArray(raw) ? raw : String(raw).split(',').map(s => s.trim()).filter(Boolean);
              })();
              const rowText = formatMacroEventItem(item);
              const pxUrl   = buildPerplexityResearchQuery(item, 'events');
              const mktUrl  = buildMarketImpactUrl(item);

              const bulkId    = merged ? `macro-gem:brief-macro:${i}` : null;
              const isChecked = bulkId ? !!merged.multiSelected?.has(bulkId) : false;
              const onToggle  = bulkId && merged?.onToggle
                ? () => merged.onToggle(bulkId, { text: rowText, sectionLabel: '🌍 אירועי מאקרו', type: 'brief-macro', tabScope: 'specialized' })
                : null;

              const impCls = (() => {
                const il = imp.toLowerCase();
                if (il.includes('גבוהה') || il.includes('קריטי') || il.includes('מאוד'))
                  return 'bg-red-100 text-red-700 border border-red-300/60 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700/50';
                if (il.includes('בינונית') || il.includes('medium'))
                  return 'bg-amber-100 text-amber-700 border border-amber-300/60 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700/50';
                return 'bg-slate-100 text-slate-600 border border-slate-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700/60';
              })();

              return (
                <tr
                  key={i}
                  className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/80 dark:hover:bg-zinc-800/30 transition-colors group"
                >
                  <td className="py-2 pr-2 pl-0 align-middle">
                    {onToggle && <UniversalTabCheckbox checked={isChecked} onChange={onToggle} />}
                  </td>
                  <td className="px-2 py-2.5 align-middle">
                    <p className="text-sm font-bold leading-snug text-slate-900 dark:text-zinc-50 break-words [overflow-wrap:anywhere] line-clamp-3">
                      {title || '—'}
                    </p>
                  </td>
                  <td className="px-2 py-2.5 align-middle whitespace-nowrap">
                    {date
                      ? <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">📅 {date}</span>
                      : <span className="text-slate-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-2 py-2.5 align-middle">
                    {imp
                      ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${impCls}`}>{imp}</span>
                      : <span className="text-slate-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-2 py-2.5 align-middle">
                    {eventType
                      ? <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 break-words">{eventType}</span>
                      : <span className="text-slate-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-2 py-2.5 align-middle">
                    {secs.length > 0
                      ? <div className="flex flex-wrap gap-1">
                          {secs.map((s, si) => (
                            <span key={si} className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/40 text-[10px] font-semibold text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                              {s}
                            </span>
                          ))}
                        </div>
                      : <span className="text-slate-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-2 py-2.5 align-middle min-w-0">
                    {impact
                      ? <p className="text-[12px] font-medium text-slate-700 dark:text-zinc-200 leading-relaxed line-clamp-3 break-words [overflow-wrap:anywhere]">{impact}</p>
                      : <span className="text-slate-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-2 py-2.5 align-middle">
                    <div className="flex flex-col gap-1.5 items-end">
                      {mktUrl && (
                        <a href={mktUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                           className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/90 dark:bg-cyan-950/40 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors whitespace-nowrap">
                          📈 שוק
                        </a>
                      )}
                      {pxUrl && <ResearchDropdown pxUrl={pxUrl} label="AI" />}
                      <MacroSaveCluster text={rowText} sectionKey="brief-macro" sectionLabel="🌍 אירועי מאקרו" onSaveToBrain={onSaveToBrain} bulkSelection={merged} compact={true} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ── Centralized Hebrew financial terms map ────────────────────────────
// All English-only labels in the UI pass through translateFinancialTerm.
// Keys are lowercase English; values are Hebrew-only display strings.

const HE_TERMS = {
  // Risk sentiment
  'risk-on':              'אופטימיות בשוק',
  'risk on':              'אופטימיות בשוק',
  'risk-off':             'חשש בשוק',
  'risk off':             'חשש בשוק',
  // Market tone
  'bullish':              'שורי',
  'bearish':              'דובי',
  'neutral':              'ניטרלי',
  'bullish but cautious': 'שורי-זהיר',
  'mixed':                'מעורב',
  'high volatility':      'תנודתיות גבוהה',
  'volatile':             'תנודתי',
  'optimistic':           'אופטימי',
  'pessimistic':          'פסימי',
  // Direction
  'up':                   'עולה',
  'down':                 'יורד',
  'strong':               'חזק',
  'weak':                 'חלש',
  'expansion':            'התרחבות',
  'contraction':          'התכווצות',
  'crash':                'קריסה',
  // Opportunity types
  'long equity':          'לונג מניות',
  'short equity':         'שורט מניות',
  'swing trading':        'מסחר סווינג',
  'swing':                'מסחר סווינג',
  'momentum':             'מומנטום',
  'value':                'השקעת ערך',
  'growth':               'צמיחה',
  'dividend':             'דיבידנד',
  'real estate':          'נדל"ן',
  'reit':                 'נדל"ן',
  'bonds':                'אג"ח',
  'fixed income':         'הכנסה קבועה',
  'commodities':          'סחורות',
  'gold':                 'זהב',
  'crypto':               'קריפטו',
  'tech':                 'טכנולוגיה',
  'macro':                'מאקרו',
  'hedge':                'גידור',
  'options':              'אופציות',
  'etf':                  'תעודת סל',
  // Sectors
  'technology':           'טכנולוגיה',
  'healthcare':           'בריאות',
  'financials':           'פיננסים',
  'energy':               'אנרגיה',
  'utilities':            'תשתיות',
  'industrials':          'תעשייה',
  'materials':            'חומרים',
  'consumer staples':     'צריכה בסיסית',
  'consumer discretionary': 'צריכה מחזורית',
  'communication services': 'תקשורת',
};

/** Translate a raw English financial term to Hebrew. Hebrew text passes through unchanged. */
function translateFinancialTerm(text) {
  if (!text) return text;
  const key = String(text).trim().toLowerCase();
  return HE_TERMS[key] || text;
}

const translateOppType = translateFinancialTerm;

// ── Opportunity style resolver ────────────────────────────────────────

function getOppStyle(type, assets) {
  const t = `${type} ${assets}`.toLowerCase();
  if (t.includes('real estate') || t.includes('reit') || t.includes('נדל'))
    return { bg: 'bg-teal-50 dark:bg-teal-950/20', border: 'border-teal-200 dark:border-teal-800', badge: 'text-teal-700 dark:text-teal-300 border border-teal-400/60 dark:border-teal-600/50', icon: '🏠' };
  if (t.includes('swing') || t.includes('trading') || t.includes('momentum') || t.includes('short'))
    return { bg: 'bg-violet-50 dark:bg-violet-950/20', border: 'border-violet-200 dark:border-violet-800', badge: 'text-violet-700 dark:text-violet-300 border border-violet-400/60 dark:border-violet-600/50', icon: '📊' };
  if (t.includes('bond') || t.includes('fixed') || t.includes('treasury') || t.includes('אג"ח'))
    return { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800', badge: 'text-blue-700 dark:text-blue-300 border border-blue-400/60 dark:border-blue-600/50', icon: '🏛️' };
  if (t.includes('long') || t.includes('equity') || t.includes('growth'))
    return { bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-800', badge: 'text-orange-700 dark:text-orange-300 border border-orange-400/60 dark:border-orange-600/50', icon: '🚀' };
  if (t.includes('bio') || t.includes('health') || t.includes('pharma') || t.includes('בריאות'))
    return { bg: 'bg-pink-50 dark:bg-pink-950/20', border: 'border-pink-200 dark:border-pink-800', badge: 'text-pink-700 dark:text-pink-300 border border-pink-400/60 dark:border-pink-600/50', icon: '🧬' };
  return { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800', badge: 'text-emerald-700 dark:text-emerald-300 border border-emerald-400/60 dark:border-emerald-600/50', icon: '💡' };
}

// ── MacroOpportunityCardsSection ──────────────────────────────────────

function MacroOpportunityCardsSection({ items, onSaveToBrain, bulkSelection }) {
  const safe = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!safe.length) return null;

  const merged = bulkSelection
    ? mergeBulkSelection(bulkSelection, {
        idPrefix: 'macro-gem:brief-opportunities',
        sectionLabel: '💡 הזדמנויות',
        type: 'brief-opportunities',
        tabScope: 'specialized',
      })
    : null;

  return (
    <SectionCard title="💡 הזדמנויות" count={safe.length} tone={TONE.NEUTRAL}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" dir="rtl">
        {safe.map((item, i) => {
          const isStr   = typeof item === 'string';
          const title   = isStr ? item.trim() : (item.title || item.name || item.opportunity || item.subject || '').trim();
          const type    = isStr ? '' : (item.type || item.category || item.style || item.strategy || '').trim();
          const details = isStr ? '' : (item.details || item.description || item.note || item.thesis || '').trim();
          const assets  = isStr ? '' : (() => {
            const a = item.assets || item.tickers || '';
            return Array.isArray(a) ? a.join(', ') : String(a || '');
          })();
          const catalyst = isStr ? '' : (item.catalyst || item.trigger || '').trim();
          const rowText  = formatOpportunityItem(item);
          const pxUrl    = buildPerplexityResearchQuery(item, 'opportunities');
          const style    = getOppStyle(type, assets);

          const bulkId    = merged ? `macro-gem:brief-opportunities:${i}` : null;
          const isChecked = bulkId ? !!merged.multiSelected?.has(bulkId) : false;
          const onToggle  = bulkId && merged?.onToggle
            ? () => merged.onToggle(bulkId, { text: rowText, sectionLabel: '💡 הזדמנויות', type: 'brief-opportunities', tabScope: 'specialized' })
            : null;

          return (
            <div key={i} className={`group flex flex-col rounded-xl border ${style.border} ${style.bg} p-4 shadow-sm hover:shadow-md transition-shadow`}>
              {/* Header: icon | title+badge | checkbox — unified row */}
              <div className="flex items-start gap-3 mb-3">
                <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-white/70 dark:bg-zinc-900/50 shadow-sm text-xl">
                  {style.icon}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-baseline gap-2 flex-wrap" dir="rtl">
                    <p className={`text-sm font-bold leading-snug flex-1 min-w-0 ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} break-words [overflow-wrap:anywhere]`}>{title || '—'}</p>
                    {type && (
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold leading-none ${style.badge}`}>
                        {translateOppType(type)}
                      </span>
                    )}
                  </div>
                </div>
                {onToggle && (
                  <div className="shrink-0">
                    <UniversalTabCheckbox checked={isChecked} onChange={onToggle} />
                  </div>
                )}
              </div>
              {/* details */}
              {details && (
                <p className={`text-xs ${DASHBOARD_TABLE_CELL_BODY_CLS} mb-1 leading-relaxed line-clamp-3 break-words`}>{details}</p>
              )}
              {catalyst && (
                <p className={`text-xs italic ${DASHBOARD_TABLE_CELL_BODY_CLS} opacity-75 mb-1`}>{catalyst}</p>
              )}
              {assets && (
                <p className="text-[10px] font-mono font-semibold text-slate-500 dark:text-zinc-400 mb-2" dir="ltr">{assets}</p>
              )}
              {/* buttons */}
              <div className="flex items-center gap-1.5 mt-auto pt-2 flex-wrap">
                {pxUrl && <ResearchDropdown pxUrl={pxUrl} />}
                <div className="mr-auto">
                  <MacroSaveCluster text={rowText} sectionKey="brief-opportunities" sectionLabel="💡 הזדמנויות" onSaveToBrain={onSaveToBrain} bulkSelection={merged} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ── Risk style resolver ───────────────────────────────────────────────

function getRiskStyle(severity) {
  const sl = severity.toLowerCase();
  if (sl.includes('קריטי') || sl.includes('critical'))
    return { bg: 'bg-red-100 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-700', badge: 'text-red-800 dark:text-red-300 border border-red-500/60 dark:border-red-600/50', icon: '🔴' };
  if (sl.includes('גבוהה') || sl.includes('high') || sl.includes('גבוה מאוד'))
    return { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-800', badge: 'text-red-700 dark:text-red-300 border border-red-400/60 dark:border-red-600/50', icon: '🔴' };
  if (sl.includes('בינונית') || sl.includes('medium'))
    return { bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-800', badge: 'text-orange-700 dark:text-orange-300 border border-orange-400/60 dark:border-orange-600/50', icon: '🟠' };
  return { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', badge: 'text-amber-700 dark:text-amber-300 border border-amber-400/60 dark:border-amber-600/50', icon: '⚠️' };
}

// ── MacroRiskCardsSection ─────────────────────────────────────────────

function MacroRiskCardsSection({ items, onSaveToBrain, bulkSelection }) {
  const safe = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!safe.length) return null;

  const merged = bulkSelection
    ? mergeBulkSelection(bulkSelection, {
        idPrefix: 'macro-gem:brief-risks',
        sectionLabel: '⚠️ סיכונים',
        type: 'brief-risks',
        tabScope: 'specialized',
      })
    : null;

  return (
    <SectionCard title="⚠️ סיכונים" count={safe.length} tone={TONE.NEUTRAL}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" dir="rtl">
        {safe.map((item, i) => {
          const isStr    = typeof item === 'string';
          const title    = isStr ? item.trim() : (item.title || item.name || item.risk || item.subject || '').trim();
          const severity = isStr ? '' : translateLevel(item.severity || item.level || item.importance || '');
          const details  = isStr ? '' : (item.details || item.description || item.impact || item.note || '').trim();
          const affected = isStr ? '' : (() => {
            const a = item.affectedAssets || item.assets || item.tickers || '';
            return Array.isArray(a) ? a.join(', ') : String(a || '');
          })();
          const rowText = formatRiskItem(item);
          const pxUrl   = buildPerplexityResearchQuery(item, 'risks');
          const style   = getRiskStyle(severity);

          const bulkId    = merged ? `macro-gem:brief-risks:${i}` : null;
          const isChecked = bulkId ? !!merged.multiSelected?.has(bulkId) : false;
          const onToggle  = bulkId && merged?.onToggle
            ? () => merged.onToggle(bulkId, { text: rowText, sectionLabel: '⚠️ סיכונים', type: 'brief-risks', tabScope: 'specialized' })
            : null;

          return (
            <div key={i} className={`group flex flex-col rounded-xl border ${style.border} ${style.bg} p-4 shadow-sm hover:shadow-md transition-shadow`}>
              {/* Header: icon | title+badge | checkbox — unified row */}
              <div className="flex items-start gap-3 mb-3">
                <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-white/70 dark:bg-zinc-900/50 shadow-sm text-xl">
                  {style.icon}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-baseline gap-2 flex-wrap" dir="rtl">
                    <p className={`text-sm font-bold leading-snug flex-1 min-w-0 ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} break-words [overflow-wrap:anywhere]`}>{title || '—'}</p>
                    {severity && (
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold leading-none ${style.badge}`}>
                        {severity}
                      </span>
                    )}
                  </div>
                </div>
                {onToggle && (
                  <div className="shrink-0">
                    <UniversalTabCheckbox checked={isChecked} onChange={onToggle} />
                  </div>
                )}
              </div>
              {/* details */}
              {details && (
                <p className={`text-xs ${DASHBOARD_TABLE_CELL_BODY_CLS} mb-1 leading-relaxed line-clamp-3 break-words`}>{details}</p>
              )}
              {affected && (
                <p className="text-[10px] font-mono font-semibold text-slate-500 dark:text-zinc-400 mb-2" dir="ltr">{affected}</p>
              )}
              {/* buttons */}
              <div className="flex items-center gap-1.5 mt-auto pt-2 flex-wrap">
                {pxUrl && <ResearchDropdown pxUrl={pxUrl} />}
                <div className="mr-auto">
                  <MacroSaveCluster text={rowText} sectionKey="brief-risks" sectionLabel="⚠️ סיכונים" onSaveToBrain={onSaveToBrain} bulkSelection={merged} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ── Sector name → Finviz link resolver ──────────────────────────────
// Handles: bare ETF "XLF", "XLF (Financials)", English name, Hebrew name.

const SECTOR_HE_TO_EN = {
  'פיננסים': 'Financials', 'בנקים': 'Financials',
  'טכנולוגיה': 'Technology',
  'בריאות': 'Healthcare',
  'תעשייה': 'Industrials',
  'אנרגיה': 'Energy',
  'נדל"ן': 'Real Estate', 'נדל׳ן': 'Real Estate', 'נדלן': 'Real Estate',
  'תקשורת': 'Communication Services',
  'צריכה מחזורית': 'Consumer Discretionary',
  'צריכה בסיסית': 'Consumer Staples',
  'חומרי גלם': 'Materials',
  'תשתיות': 'Utilities',
  'ביוטק': 'Biotechnology',
  'מוליכים למחצה': 'Semiconductors',
};

const EXTRA_SECTOR_TICKER = {
  'Biotech': 'XBI', 'Biotechnology': 'XBI',
  'Big Tech': 'QQQ',
  'Defense': 'ITA',
  'Gold': 'GLD', 'Silver': 'SLV',
  'Oil': 'XLE', 'Banks': 'XLF',
};

function _finvizUrl(ticker) {
  return `https://finviz.com/quote.ashx?t=${encodeURIComponent(ticker)}`;
}

function buildPerplexityEtfHoldingsUrl(symbol) {
  if (!symbol) return null;
  const q = `נתח את קרן ${symbol}.\n\nהצג:\n1. 10 האחזקות הגדולות ביותר לפי משקל\n2. שם החברה\n3. סימבול\n4. משקל בקרן באחוזים\n5. אילו מניות מובילות את ביצועי הקרן\n6. אילו מניות מהוות סיכון לקרן\n7. האם הקרן במומנטום חיובי, ניטרלי או שלילי\n8. סיכום קצר למשקיע סווינג\n\nענה בעברית ובטבלה מסודרת.`;
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`;
}

function buildPerplexityStockUrl(symbol) {
  if (!symbol) return null;
  const q = `נתח את מניית ${symbol}.\n\nהצג:\n1. תזת השקעה\n2. מצב טכני\n3. תמיכה והתנגדות\n4. מומנטום יחסי מול SPY ו-QQQ\n5. נתונים פונדמנטליים מרכזיים\n6. המלצות אנליסטים אם קיימות\n7. סיכונים מרכזיים\n8. קטליזטורים אפשריים\n9. ציון הזדמנות מ-0 עד 100\n10. מסקנה: קנייה / מעקב / החזקה / הימנעות\n\nענה בעברית ובצורה תמציתית.`;
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`;
}

function buildPerplexityResearchQuery(item, sectionType) {
  if (!item) return null;
  let q = '';

  if (sectionType === 'highlights') {
    const title   = typeof item === 'string' ? item.trim()
      : (item.title || item.headline || item.name || item.subject || item.highlight || '').trim();
    const details = typeof item === 'object'
      ? (item.description || item.detail || item.note || item.text || item.summary || '').trim() : '';
    if (!title) return null;
    q = `נתח את ההיילייט הבא בהקשר של שוק ההון:\n\n"${title}"${details ? `\n\n"${details}"` : ''}\n\nהצג:\n1. למה זה חשוב למשקיעים\n2. אילו סקטורים מושפעים\n3. אילו מניות או ETF רלוונטיים\n4. תרחיש חיובי\n5. תרחיש שלילי\n6. מה כדאי לעקוב ב-30 הימים הקרובים\n\nענה בעברית ובצורה תמציתית.`;
  } else if (sectionType === 'events') {
    const title  = typeof item === 'string' ? item.trim()
      : (item.event || item.title || item.name || item.subject || '').trim();
    const date   = typeof item === 'object' ? (item.date  || item.time || item.when || '').trim() : '';
    const imp    = typeof item === 'object' ? translateLevel(item.importance || item.priority || item.significance || '') : '';
    const impact = typeof item === 'object' ? (item.impact || item.effect || item.description || item.expectedImpact || '').trim() : '';
    if (!title) return null;
    const lines = [`נתח את אירוע המאקרו הבא:\n\n"${title}"`];
    if (date)   lines.push(`תאריך: ${date}`);
    if (imp)    lines.push(`חשיבות: ${imp}`);
    if (impact) lines.push(`השפעה: ${impact}`);
    lines.push(`\nהצג:\n1. האם האירוע חיובי, ניטרלי או שלילי לשוק\n2. השפעה על SPY / QQQ / IWM\n3. השפעה על אג"ח ודולר\n4. השפעה על סקטורים מרכזיים\n5. מה המשקיע צריך לעקוב אחריו בשבועיים הקרובים\n\nענה בעברית.`);
    q = lines.join('\n');
  } else if (sectionType === 'opportunities') {
    const title   = typeof item === 'string' ? item.trim()
      : (item.title || item.name || item.opportunity || item.subject || '').trim();
    const type    = typeof item === 'object' ? (item.type || item.category || '').trim() : '';
    const details = typeof item === 'object' ? (item.details || item.description || item.note || item.thesis || '').trim() : '';
    if (!title) return null;
    const lines = [`בדוק האם ההזדמנות הבאה עדיין רלוונטית:\n\n"${title}"`];
    if (type)    lines.push(`סוג: ${type}`);
    if (details) lines.push(`פרטים: ${details}`);
    lines.push(`\nהצג:\n1. האם זו הזדמנות קנייה, מעקב או הימנעות\n2. הקטליזטורים המרכזיים\n3. הסיכונים המרכזיים\n4. מניות / ETF רלוונטיים\n5. רמות תמיכה והתנגדות אם קיימות\n6. ציון הזדמנות מ-0 עד 100\n\nענה בעברית.`);
    q = lines.join('\n');
  } else if (sectionType === 'risks') {
    const title    = typeof item === 'string' ? item.trim()
      : (item.title || item.name || item.risk || item.subject || '').trim();
    const severity = typeof item === 'object' ? translateLevel(item.severity || item.level || item.importance || '') : '';
    const details  = typeof item === 'object' ? (item.details || item.description || item.impact || item.note || '').trim() : '';
    if (!title) return null;
    const lines = [`נתח את הסיכון הבא למשקיעים:\n\n"${title}"`];
    if (severity) lines.push(`חומרה: ${severity}`);
    if (details)  lines.push(`פרטים: ${details}`);
    lines.push(`\nהצג:\n1. מה ההסתברות שהסיכון יתממש\n2. אילו סקטורים הכי חשופים\n3. אילו מניות או ETF עלולים להיפגע\n4. אילו אינדיקטורים כדאי לעקוב\n5. מה יבטל את תרחיש הסיכון\n6. ציון סיכון מ-0 עד 100\n\nענה בעברית.`);
    q = lines.join('\n');
  } else if (sectionType === 'warnings') {
    const text = typeof item === 'string' ? item.trim()
      : (item.warning || item.action || item.title || item.text || item.content || '').trim();
    if (!text) return null;
    q = `בדוק את פעולת המעקב הבאה:\n\n"${text}"\n\nהצג:\n1. האם זה עדיין רלוונטי לפי הנתונים האחרונים\n2. אילו נתונים צריך לבדוק\n3. אילו מניות / ETF קשורים\n4. מה תהיה אינדיקציה חיובית\n5. מה תהיה אינדיקציה שלילית\n6. פעולה מומלצת: קנייה / מעקב / המתנה / הימנעות\n\nענה בעברית.`;
  } else if (sectionType === 'snapshot') {
    const category = (item.category || '').trim();
    const title    = (item.title    || '').trim();
    const body     = (item.body     || '').trim();
    const badge    = (item.badge    || '').trim();
    if (!title && !body) return null;
    const lines = [`נתח את מצב השוק הבא:`];
    if (category) lines.push(`קטגוריה: ${category}`);
    if (title)    lines.push(`כותרת: ${title}`);
    if (badge)    lines.push(`מצב: ${badge}`);
    if (body)     lines.push(`פרטים: ${body}`);
    lines.push(`\nהצג:\n1. האם מצב זה תומך בקנייה, המתנה או הימנעות\n2. אילו סקטורים ומניות מושפעים\n3. מה הסיכון המרכזי\n4. מה כדאי לעקוב בשבועיים הקרובים\n\nענה בעברית ובצורה תמציתית.`);
    q = lines.join('\n');
  } else if (sectionType === 'macro-overview') {
    const topic = (item.topic || '').trim();
    const text  = (item.text  || '').trim();
    if (!text) return null;
    const lines = [`נתח את נושא המאקרו הבא:`];
    if (topic) lines.push(`נושא: ${topic}`);
    if (text)  lines.push(`סיכום: ${text}`);
    lines.push(`\nהצג:\n1. למה זה חשוב למשקיעים עכשיו\n2. אילו סקטורים ומניות מושפעים\n3. מה הסיכון\n4. מה כדאי לעקוב בהמשך\n\nענה בעברית ובצורה תמציתית.`);
    q = lines.join('\n');
  }

  if (!q) return null;
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`;
}

function resolveGemSectorLink(sectorStr) {
  const str = String(sectorStr || '').trim();
  if (!str) return null;

  // 1. Bare ETF ticker or "ETF (Name)": "XLF", "XBI (Biotech)"
  const headTicker = str.match(/^([A-Z]{2,6})(?:\s*\(.*\))?$/)?.[1];
  if (headTicker) return { ticker: headTicker, url: _finvizUrl(headTicker) };

  const englishPart = str.includes('/') ? str.split('/')[0].trim() : str;

  // 2. English name in SECTOR_METADATA
  const meta = getSectorMeta(englishPart) || getSectorMeta(str);
  if (meta?.finvizUrl) return { ticker: meta.etf, url: meta.finvizUrl };

  // 3. Hebrew name → translate → getSectorMeta
  const heKey = Object.keys(SECTOR_HE_TO_EN).find(k => str.includes(k) || englishPart.includes(k));
  if (heKey) {
    const heMeta = getSectorMeta(SECTOR_HE_TO_EN[heKey]);
    if (heMeta?.finvizUrl) return { ticker: heMeta.etf, url: heMeta.finvizUrl };
  }

  // 4. Extra aliases not in SECTOR_METADATA
  const extraTicker = EXTRA_SECTOR_TICKER[englishPart] || EXTRA_SECTOR_TICKER[str];
  if (extraTicker) return { ticker: extraTicker, url: _finvizUrl(extraTicker) };

  return null;
}

// ── Custom indices table: checkbox | מדד/נכס | שינוי | סנטימנט | סיבה | save ──

function MacroGemIndicesTable({ items, onSaveToBrain, bulkSelection }) {
  const safe = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!safe.length) return null;

  const merged = bulkSelection
    ? mergeBulkSelection(bulkSelection, {
        idPrefix: 'macro-gem:indices',
        sectionLabel: '📈 מדדים',
        type: 'indices',
        tabScope: 'specialized',
      })
    : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right border-collapse" style={{ tableLayout: 'fixed' }} dir="rtl">
        <colgroup>
          <col style={{ width: MCOL.checkbox }} />
          <col style={{ width: MCOL.indices.name }} />
          <col style={{ width: MCOL.indices.change }} />
          <col style={{ width: MCOL.sentiment }} />
          <col />
          <col style={{ width: MCOL.save }} />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-slate-200/80 dark:border-zinc-700/70">
            <th className="py-1.5 pr-2 pl-0" />
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>מדד / נכס</th>
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>שינוי</th>
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סיבה</th>
            <th className="py-1.5 pl-1 pr-0" />
          </tr>
        </thead>
        <tbody>
          {safe.map((item, i) => {
            if (typeof item === 'string') {
              const ft = resolveFinvizTicker(item.trim());
              const idxStrPxUrl = ft ? buildPerplexityStockUrl(ft) : null;
              return (
                <tr key={i} className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 group">
                  <td className="py-2 pr-2 pl-0 w-5 align-middle" />
                  <td colSpan={4} className="px-2 py-2 align-middle">
                    {ft ? (
                      <a
                        href={`https://finviz.com/quote.ashx?t=${encodeURIComponent(ft)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="פתח ב-Finviz ↗"
                        className={`font-mono font-bold ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline`}
                        dir="ltr"
                        onClick={(e) => e.stopPropagation()}
                        data-finviz-link={ft}
                      >
                        {item}
                      </a>
                    ) : (
                      <span className={`font-mono ${DASHBOARD_TABLE_CELL_BODY_CLS}`} dir="ltr">{item}</span>
                    )}
                  </td>
                  <td className="py-2 pl-1 pr-0 w-8 align-middle opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-0.5">
                      <PxBtn url={idxStrPxUrl} />
                      <MacroSaveCluster text={item} sectionKey="indices" sectionLabel="📈 מדדים" onSaveToBrain={onSaveToBrain} bulkSelection={merged} />
                    </div>
                  </td>
                </tr>
              );
            }

            const rawName   = String(item.name || item.asset || item.index || item.ticker || item.symbol || item.metric || '').trim();
            const name      = rawName.toUpperCase() || '—';
            const change    = String(item.change || item.pct || item.changePercent || item.performance || '').trim();
            const direction = String(item.direction || item.trend || item.sentiment || '').trim();
            const reason    = String(item.reason || item.note || item.insight || item.description || item.rationale || '').trim();

            const rowText = [name, change, direction, reason].filter(Boolean).join(' · ');
            // Resolve ticker: prefer the original raw name for named indices (e.g. "Nasdaq" → QQQ)
            const ft = resolveFinvizTicker(rawName) || resolveFinvizTicker(name);
            const idxPxUrl = ft ? buildPerplexityStockUrl(ft) : null;

            return (
              <tr key={i} className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group">
                <td className="py-2 pr-2 pl-0 w-5 align-middle" />
                <td className="px-2 py-2 align-middle whitespace-nowrap">
                  {ft ? (
                    <a
                      href={`https://finviz.com/quote.ashx?t=${encodeURIComponent(ft)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="פתח ב-Finviz ↗"
                      className={`font-mono font-bold ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline cursor-pointer`}
                      dir="ltr"
                      onClick={(e) => e.stopPropagation()}
                      data-finviz-link={ft}
                    >
                      {name}
                    </a>
                  ) : (
                    <span className={`font-mono font-bold ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`} dir="ltr">{name}</span>
                  )}
                </td>
                <td className="px-2 py-2 align-middle whitespace-nowrap">
                  <span className={`font-mono font-semibold ${DASHBOARD_TABLE_CELL_BODY_CLS}`} dir="ltr">{change || '—'}</span>
                </td>
                <td className="px-2 py-2 align-middle">
                  <MacroSentimentCell value={direction} />
                </td>
                <td className="px-2 py-2 align-middle max-w-[22rem]">
                  <p className={`${DASHBOARD_TABLE_CELL_BODY_CLS} line-clamp-2 break-words`}>{reason || '—'}</p>
                </td>
                <td className="py-2 pl-1 pr-0 w-8 align-middle opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-0.5">
                    <PxBtn url={idxPxUrl} />
                    <MacroSaveCluster text={rowText} sectionKey="indices" sectionLabel="📈 מדדים" onSaveToBrain={onSaveToBrain} bulkSelection={merged} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MacroIndicesSection({ indicesItems, onSaveToBrain, bulkSelection }) {
  if (!indicesItems || indicesItems.length === 0) return null;
  return (
    <SectionCard title="📈 מדדים" count={indicesItems.length} tone={TONE.NEUTRAL}>
      <MacroGemIndicesTable
        items={indicesItems}
        onSaveToBrain={onSaveToBrain ? (text) => onSaveToBrain(text, 'indices', '📈 מדדים') : undefined}
        bulkSelection={bulkSelection}
      />
    </SectionCard>
  );
}

// ── Helper: wrap string or array into an object for ObjectSection ────

function asObj(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.trim()) return { ערך: val };
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  return null;
}

// ── Cross-section deduplication ──────────────────────────────────────

function conceptKey(item) {
  const text = typeof item === 'string' ? item
    : String(item?.title || item?.name || item?.text || item?.warning || item?.action || '');
  const tickers = (text.match(/\b[A-Z]{2,5}\b/g) || []).sort().join(',');
  const phrase = text.trim().slice(0, 40).toLowerCase().replace(/[^\w֐-׿]/g, ' ').replace(/\s+/g, ' ').trim();
  return tickers || phrase;
}

function dedupeVsRef(items, ...refArrays) {
  if (!Array.isArray(items) || !items.length) return items;
  const seen = new Set();
  refArrays.flat().filter(Boolean).forEach(item => {
    const k = conceptKey(item);
    if (k) seen.add(k);
  });
  if (!seen.size) return items;
  return items.filter(item => {
    const k = conceptKey(item);
    return !k || !seen.has(k);
  });
}

// ── Executive Snapshot ───────────────────────────────────────────────

function firstText(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  const item = arr[0];
  if (typeof item === 'string') return item.trim();
  return (item.title || item.name || item.text || item.opportunity || item.risk || item.warning || '').trim();
}

// Maps a market-state text to a card accent: only the mood value counts here — not risk sentiment.
function getMarketStateTone(value) {
  const tl = String(value || '').toLowerCase();
  if (
    tl.includes('bullish') || tl.includes('חיובי') || tl.includes('שורי') ||
    tl.includes('positive') || tl.includes('עלייה') || tl.includes('אופטימי')
  ) return 'green';
  if (
    tl.includes('bearish') || tl.includes('שלילי') || tl.includes('דובי') ||
    tl.includes('negative') || tl.includes('ירידה') || tl.includes('פסימי')
  ) return 'red';
  return 'amber'; // neutral / ניטרלי / מעורב / mixed
}

function extractEconValue(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of ['current', 'rate', 'level', 'price', 'yield', 'value', 'status', 'target', 'forecast']) {
    const v = obj[k];
    if (v && typeof v === 'string' && v.trim()) return v.trim().slice(0, 45);
    if (v != null && typeof v === 'number') return String(v);
  }
  const entry = Object.entries(obj).find(([, v]) => typeof v === 'string' && v.trim() && v.trim().length < 55);
  return entry ? entry[1].trim() : null;
}

// ── Compact economic KPI cards (secondary row) ────────────────────
const KPI_BORDER = {
  green: 'border-emerald-200/70 dark:border-emerald-800/40',
  red:   'border-red-200/70 dark:border-red-800/40',
  blue:  'border-sky-200/70 dark:border-sky-800/40',
  amber: 'border-amber-200/70 dark:border-amber-800/40',
  slate: 'border-slate-200/80 dark:border-zinc-700/60',
};
const KPI_BG = {
  green: 'bg-emerald-50/80 dark:bg-emerald-950/20',
  red:   'bg-red-50/70 dark:bg-red-950/20',
  blue:  'bg-sky-50/60 dark:bg-sky-950/20',
  amber: 'bg-amber-50/70 dark:bg-amber-950/20',
  slate: 'bg-white/70 dark:bg-zinc-800/40',
};
const KPI_LABEL = {
  green: 'text-emerald-600 dark:text-emerald-500',
  red:   'text-red-500 dark:text-red-400',
  blue:  'text-sky-600 dark:text-sky-500',
  amber: 'text-amber-600 dark:text-amber-500',
  slate: 'text-slate-500 dark:text-zinc-400',
};
const KPI_VALUE = {
  green: 'text-emerald-900 dark:text-emerald-200',
  red:   'text-red-900 dark:text-red-200',
  blue:  'text-sky-900 dark:text-sky-200',
  amber: 'text-amber-900 dark:text-amber-200',
  slate: 'text-slate-800 dark:text-zinc-200',
};

function KpiCard({ label, value, accent = 'slate', href, valueDir = 'rtl', compact = false }) {
  if (!value) return null;
  const border = KPI_BORDER[accent] ?? KPI_BORDER.slate;
  const bg     = KPI_BG[accent]     ?? KPI_BG.slate;
  const lc     = KPI_LABEL[accent]  ?? KPI_LABEL.slate;
  const vc     = KPI_VALUE[accent]  ?? KPI_VALUE.slate;

  const inner = (
    <div className={`rounded-lg border ${border} ${bg} px-3 ${compact ? 'py-2' : 'py-2.5'} h-full flex flex-col gap-0.5 min-w-0 transition-shadow hover:shadow-sm`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide truncate ${lc}`}>{label}</p>
      <p className={`${compact ? 'text-[13px]' : 'text-sm'} font-bold leading-snug line-clamp-2 ${vc}`} dir={valueDir}>{value}</p>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title="פתח ב-Finviz ↗"
        onClick={(e) => e.stopPropagation()} className="block h-full">{inner}</a>
    );
  }
  return inner;
}

// ── Primary Status Cards (top 3) ─────────────────────────────────
const SC = {
  green: {
    border: 'border-emerald-200 dark:border-emerald-800/60',
    bg:     'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-zinc-900',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/60',
    iconTx: 'text-emerald-600 dark:text-emerald-400',
    cat:    'text-slate-400 dark:text-zinc-500',
    title:  'text-slate-900 dark:text-white',
    body:   'text-slate-700 dark:text-zinc-300',
    dot:    'text-emerald-500 dark:text-emerald-400',
    badge:  'bg-emerald-100 border border-emerald-200 text-slate-800 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-zinc-200',
    btn:    'bg-white dark:bg-zinc-900/80 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/40',
  },
  red: {
    border: 'border-red-200 dark:border-red-800/60',
    bg:     'bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-zinc-900',
    iconBg: 'bg-red-100 dark:bg-red-900/60',
    iconTx: 'text-red-500 dark:text-red-400',
    cat:    'text-slate-400 dark:text-zinc-500',
    title:  'text-slate-900 dark:text-white',
    body:   'text-slate-700 dark:text-zinc-300',
    dot:    'text-red-500 dark:text-red-400',
    badge:  'bg-red-100 border border-red-200 text-slate-800 dark:bg-red-900/40 dark:border-red-700 dark:text-zinc-200',
    btn:    'bg-white dark:bg-zinc-900/80 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40',
  },
  amber: {
    border: 'border-amber-200 dark:border-amber-800/60',
    bg:     'bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-zinc-900',
    iconBg: 'bg-amber-100 dark:bg-amber-900/60',
    iconTx: 'text-amber-600 dark:text-amber-400',
    cat:    'text-slate-400 dark:text-zinc-500',
    title:  'text-slate-900 dark:text-white',
    body:   'text-slate-700 dark:text-zinc-300',
    dot:    'text-amber-500 dark:text-amber-400',
    badge:  'bg-amber-100 border border-amber-200 text-slate-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-zinc-200',
    btn:    'bg-white dark:bg-zinc-900/80 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/40',
  },
};

function StatusCard({ accent = 'amber', icon, category, title, subLine, bodyText, badge, ctaLabel, ctaHref, researchHref, isEmpty = false, emptyTitle }) {
  const s = SC[accent] ?? SC.amber;
  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-5 flex flex-col min-h-[11rem] transition-shadow hover:shadow-md`} dir="rtl">
      {/* Header: category label right, icon left */}
      <div className="flex items-start justify-between mb-3">
        <div className={`rounded-xl w-11 h-11 flex items-center justify-center text-xl shrink-0 ${s.iconBg} ${s.iconTx}`}>
          {icon}
        </div>
        <p className={`text-[13px] font-semibold ${s.cat}`}>{category}</p>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isEmpty && title ? (
          <>
            <p className={`text-lg font-bold leading-snug mb-1.5 break-words ${s.title}`}>{title}</p>
            {subLine && (
              <p className={`text-[13px] mt-0.5 break-words ${s.body}`}>{subLine}</p>
            )}
            {bodyText && (
              <p className={`text-[13px] mt-1 line-clamp-3 break-words ${s.body}`}>{bodyText}</p>
            )}
          </>
        ) : (
          <div className="flex flex-col justify-center py-2">
            <p className={`text-sm font-semibold opacity-40 ${s.title}`}>{emptyTitle || 'אין נתון זמין'}</p>
            <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">נמשיך לעקוב ולעדכן</p>
          </div>
        )}
      </div>

      {/* Footer: CTA button or badge with colored dot, + AI research action */}
      <div className="mt-4 shrink-0 flex items-center gap-2 flex-wrap">
        {!isEmpty && ctaHref && ctaLabel ? (
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            title="פתח בפיניוויז ↗"
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${s.btn}`}
          >
            {ctaLabel} <span aria-hidden="true" dir="ltr">↗</span>
          </a>
        ) : !isEmpty && badge ? (
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg ${s.badge}`}>
            <span className={s.dot} aria-hidden="true">●</span>
            {badge}
          </span>
        ) : null}
        {!isEmpty && researchHref && <ResearchDropdown pxUrl={researchHref} />}
      </div>
    </div>
  );
}

// ── Macro Overview — executive briefing card ─────────────────────────

function getOverviewTone(text) {
  const sl = String(text).toLowerCase();
  if (sl.includes('risk-on') || sl.includes('risk on') || sl.includes('חיובי') || sl.includes('bullish') || sl.includes('positive')) return 'green';
  if (sl.includes('risk-off') || sl.includes('risk off') || sl.includes('שלילי') || sl.includes('bearish') || sl.includes('negative')) return 'red';
  return 'amber';
}

const OVERVIEW_TONE = {
  green: {
    pill:   'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700',
    label:  'text-emerald-500 dark:text-emerald-500',
    value:  'text-emerald-800 dark:text-emerald-200',
    dot:    'bg-emerald-500',
    tag:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    block:  'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800/60',
    head:   'text-emerald-600 dark:text-emerald-400',
  },
  red: {
    pill:   'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-700',
    label:  'text-red-500 dark:text-red-500',
    value:  'text-red-800 dark:text-red-200',
    dot:    'bg-red-500',
    tag:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    block:  'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800/60',
    head:   'text-red-600 dark:text-red-400',
  },
  amber: {
    pill:   'bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700',
    label:  'text-amber-500 dark:text-amber-500',
    value:  'text-amber-800 dark:text-amber-200',
    dot:    'bg-amber-500',
    tag:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    block:  'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/60',
    head:   'text-amber-600 dark:text-amber-400',
  },
};

function MacroStatusPill({ label, value, tone }) {
  const c = OVERVIEW_TONE[tone] || OVERVIEW_TONE.amber;
  return (
    <div className={`flex flex-col items-center px-4 py-2.5 rounded-xl border ${c.pill} min-w-[110px] flex-1`}>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${c.label} mb-1.5`}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
        <span className={`text-sm font-bold leading-tight ${c.value} text-center`}>{value}</span>
      </div>
    </div>
  );
}

function MacroInfoBlock({ icon, label, value, variant = 'default' }) {
  if (!value) return null;
  const LABEL_CLS = {
    blue:    'text-blue-700 dark:text-blue-400',
    purple:  'text-purple-700 dark:text-purple-400',
    sky:     'text-sky-600 dark:text-sky-400',
    default: 'text-slate-500 dark:text-zinc-400',
  };
  const labelCls = LABEL_CLS[variant] || LABEL_CLS.default;
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-700/50 px-4 py-3.5" dir="rtl">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-lg leading-none">{icon}</span>
        <span className={`text-[17px] font-bold ${labelCls}`}>{label}</span>
      </div>
      <p className={`text-sm font-medium leading-relaxed ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} break-words [overflow-wrap:anywhere]`}>
        {value}
      </p>
    </div>
  );
}

function MacroTagBlock({ icon, label, tags, tone }) {
  const c = OVERVIEW_TONE[tone] || OVERVIEW_TONE.green;
  return (
    <div className={`rounded-xl border px-4 py-3 ${c.block}`} dir="rtl">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-base leading-none">{icon}</span>
        <span className={`text-xs font-bold uppercase tracking-wider ${c.head}`}>{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.tag}`}>{tag}</span>
        ))}
      </div>
    </div>
  );
}

function MacroActionsBlock({ actions }) {
  return (
    <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 px-4 py-3.5" dir="rtl">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-base leading-none">💡</span>
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">מה המשקיע צריך לעשות?</span>
      </div>
      <ul className="space-y-1.5">
        {actions.map((action, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-indigo-400 dark:text-indigo-500 mt-0.5 shrink-0 font-bold">•</span>
            <span className={`text-sm ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{action}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MacroOverviewCard({ macroOverview, onSaveToBrain, bulkSelection }) {
  if (!macroOverview || typeof macroOverview !== 'object' || Array.isArray(macroOverview)) return null;
  const entries = Object.entries(macroOverview).filter(([, v]) => v != null && String(v).trim());
  if (!entries.length) return null;

  const g = (key) => (macroOverview[key] || '').trim();
  const mainTheme         = g('mainTheme');
  const macroMood         = g('macroMood');
  const mainConclusion    = g('mainConclusion');
  const marketImplication = g('marketImplication') || g('marketImplications');
  const riskOnRiskOff     = g('riskOnRiskOff');

  // Try structured winners / losers / actions from extra schema fields
  const toArr = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean).map(String);
    if (typeof v === 'string') return v.split(/[,;•\n]+/).map((s) => s.trim()).filter(Boolean);
    return [];
  };
  const winners = toArr(macroOverview.winners || macroOverview.beneficiaries || macroOverview.outperformers);
  const losers  = toArr(macroOverview.losers  || macroOverview.underPerformers || macroOverview.underPressure);
  const actions = toArr(macroOverview.actions || macroOverview.recommendations || macroOverview.investorActions || macroOverview.actionItems);

  const allKnownKeys = new Set([
    'mainTheme', 'macroMood', 'mainConclusion', 'marketImplication', 'marketImplications', 'riskOnRiskOff',
    'winners', 'beneficiaries', 'outperformers', 'losers', 'underPerformers', 'underPressure',
    'actions', 'recommendations', 'investorActions', 'actionItems',
  ]);
  const extras = entries.filter(([k]) => !allKnownKeys.has(k));

  const fullText = [
    macroMood         && `מצב מאקרו: ${macroMood}`,
    riskOnRiskOff     && `Risk On/Off: ${riskOnRiskOff}`,
    mainTheme         && `נושא מרכזי: ${mainTheme}`,
    mainConclusion    && `מסקנה מרכזית: ${mainConclusion}`,
    marketImplication && `השפעה על השוק: ${marketImplication}`,
    winners.length    && `מרוויחים: ${winners.join(', ')}`,
    losers.length     && `תחת לחץ: ${losers.join(', ')}`,
    actions.length    && `פעולות: ${actions.join(' • ')}`,
    ...extras.map(([k, v]) => `${heLabel(k)}: ${String(v).trim()}`),
  ].filter(Boolean).join('\n');

  const mainThemeUrl         = mainTheme         ? buildPerplexityResearchQuery({ topic: 'הסיפור המרכזי של השוק', text: mainTheme },         'macro-overview') : null;
  const mainConclusionUrl    = mainConclusion     ? buildPerplexityResearchQuery({ topic: 'מסקנה מרכזית',        text: mainConclusion },     'macro-overview') : null;
  const marketImplicationUrl = marketImplication  ? buildPerplexityResearchQuery({ topic: 'השפעה על השוק',       text: marketImplication },  'macro-overview') : null;
  const actionsUrl           = actions.length     ? buildPerplexityResearchQuery({ topic: 'מה לעקוב',            text: actions.join(' • ') }, 'macro-overview') : null;

  return (
    <SectionCard title="🌐 תמונת מאקרו" count={null} tone={TONE.NEUTRAL}>
      <div className="space-y-3" dir="rtl">
        <p className="text-[12px] text-slate-500 dark:text-zinc-400 -mt-1 mb-1 pb-2 border-b border-slate-100 dark:border-zinc-800">
          סיכום מצב השוק והמשמעות הרחבה
        </p>

        {/* Compact summary table */}
        {(mainTheme || mainConclusion || marketImplication || winners.length > 0 || losers.length > 0 || actions.length > 0 || extras.length > 0) && (
          <div className="w-full overflow-x-auto rounded-lg border border-slate-100 dark:border-zinc-800" dir="rtl">
            <table className="w-full text-right border-collapse" dir="rtl">
              <colgroup>
                <col style={{ width: '22%' }} />
                <col />
                <col style={{ width: '96px' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-zinc-700/70 bg-slate-50/60 dark:bg-zinc-800/30">
                  <th className={`px-3 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>נושא</th>
                  <th className={`px-3 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סיכום</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mainTheme && (
                  <tr className="border-b border-slate-100 dark:border-zinc-800/60 hover:bg-slate-50/60 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-blue-700 dark:text-blue-400">🎯 סיפור השוק</span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 leading-relaxed break-words [overflow-wrap:anywhere]">{mainTheme}</p>
                    </td>
                    <td className="px-2 py-2.5 align-middle">
                      {mainThemeUrl && <ResearchDropdown pxUrl={mainThemeUrl} />}
                    </td>
                  </tr>
                )}
                {mainConclusion && (
                  <tr className="border-b border-slate-100 dark:border-zinc-800/60 hover:bg-slate-50/60 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-purple-700 dark:text-purple-400">📌 מסקנה מרכזית</span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 leading-relaxed break-words [overflow-wrap:anywhere]">{mainConclusion}</p>
                    </td>
                    <td className="px-2 py-2.5 align-middle">
                      {mainConclusionUrl && <ResearchDropdown pxUrl={mainConclusionUrl} />}
                    </td>
                  </tr>
                )}
                {marketImplication && (
                  <tr className="border-b border-slate-100 dark:border-zinc-800/60 hover:bg-slate-50/60 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-sky-600 dark:text-sky-400">📈 השפעה על השוק</span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 leading-relaxed break-words [overflow-wrap:anywhere]">{marketImplication}</p>
                    </td>
                    <td className="px-2 py-2.5 align-middle">
                      {marketImplicationUrl && <ResearchDropdown pxUrl={marketImplicationUrl} />}
                    </td>
                  </tr>
                )}
                {(winners.length > 0 || losers.length > 0) && (
                  <tr className="border-b border-slate-100 dark:border-zinc-800/60 hover:bg-slate-50/60 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <span className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">📊 שוק</span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-3">
                        {winners.length > 0 && (
                          <span className="flex flex-wrap gap-1 items-center">
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">📈 מרוויחים:</span>
                            {winners.map((w, wi) => (
                              <span key={wi} className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-semibold">{w}</span>
                            ))}
                          </span>
                        )}
                        {losers.length > 0 && (
                          <span className="flex flex-wrap gap-1 items-center">
                            <span className="text-[11px] font-bold text-red-600 dark:text-red-400">📉 תחת לחץ:</span>
                            {losers.map((l, li) => (
                              <span key={li} className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-semibold">{l}</span>
                            ))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td />
                  </tr>
                )}
                {actions.length > 0 && (
                  <tr className="border-b border-slate-100 dark:border-zinc-800/60 hover:bg-slate-50/60 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-indigo-600 dark:text-indigo-400">💡 מה לעקוב</span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <ul className="space-y-1">
                        {actions.map((a, ai) => (
                          <li key={ai} className="flex items-start gap-1.5">
                            <span className="text-indigo-400 dark:text-indigo-500 mt-0.5 shrink-0 font-bold text-[10px]">•</span>
                            <span className="text-sm text-slate-700 dark:text-zinc-200">{a}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-2 py-2.5 align-middle">
                      {actionsUrl && <ResearchDropdown pxUrl={actionsUrl} />}
                    </td>
                  </tr>
                )}
                {extras.map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100 dark:border-zinc-800/60 hover:bg-slate-50/60 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <span className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">• {heLabel(k)}</span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <p className="text-sm text-slate-700 dark:text-zinc-200 break-words [overflow-wrap:anywhere]">{String(v).trim()}</p>
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {fullText && (
        <div className="flex justify-end mt-3 px-1">
          <MacroSaveCluster text={fullText} sectionKey="macro-overview" sectionLabel="🌐 תמונת מאקרו" onSaveToBrain={onSaveToBrain} bulkSelection={bulkSelection} />
        </div>
      )}
    </SectionCard>
  );
}

// ── Executive Snapshot (quick-glance cards row) ───────────────────────

function ExecutiveSnapshot({ macroOverview, opportunities, risks, interestRates, inflation, bondYields, oilEnergy, dollar }) {
  const mood    = macroOverview?.macroMood || macroOverview?.mainTheme || '';
  const riskStr = macroOverview?.riskOnRiskOff || '';
  const summary = (macroOverview?.mainConclusion || macroOverview?.marketImplication || macroOverview?.summary || '').trim();

  // ── Card 1: Opportunity ──────────────────────────────────
  const oppRaw = Array.isArray(opportunities) ? opportunities[0] : null;
  const oppTitle = oppRaw
    ? (typeof oppRaw === 'string' ? oppRaw.trim()
      : (oppRaw.title || oppRaw.name || oppRaw.opportunity || '').trim())
    : '';
  const oppType   = oppRaw && typeof oppRaw === 'object' ? (oppRaw.type || oppRaw.category || '').trim() : '';
  const oppAssets = oppRaw && typeof oppRaw === 'object'
    ? (Array.isArray(oppRaw.assets || oppRaw.tickers)
      ? (oppRaw.assets || oppRaw.tickers).join(', ')
      : String(oppRaw.assets || oppRaw.tickers || oppRaw.ticker || '').trim())
    : '';
  const oppDetail = oppRaw && typeof oppRaw === 'object'
    ? (oppRaw.details || oppRaw.description || oppRaw.thesis || '').trim() : '';
  const oppTickerM = (oppTitle + ' ' + oppAssets).match(/\b([A-Z]{2,5})\b/);
  const oppTicker  = oppTickerM?.[1] || null;
  const oppLink    = oppTicker ? `https://finviz.com/quote.ashx?t=${encodeURIComponent(oppTicker)}`
    : (resolveGemSectorLink(oppAssets)?.url || null);
  const oppSubLine = [oppType, oppAssets].filter(Boolean).join(' · ') || null;

  // ── Card 2: Risk ─────────────────────────────────────────
  const riskRaw = Array.isArray(risks) ? risks[0] : null;
  const riskTitle = riskRaw
    ? (typeof riskRaw === 'string' ? riskRaw.trim()
      : (riskRaw.title || riskRaw.name || riskRaw.risk || '').trim())
    : '';
  const riskSev  = riskRaw && typeof riskRaw === 'object'
    ? translateLevel(riskRaw.severity || riskRaw.level || riskRaw.importance || '') : '';
  const riskBody = riskRaw && typeof riskRaw === 'object'
    ? (riskRaw.impact || riskRaw.description || riskRaw.details || '').trim() : '';
  const riskBadge = riskSev ? `רמת סיכון: ${riskSev}` : null;
  const riskAccent = (() => {
    const sl = (riskSev + riskTitle).toLowerCase();
    if (sl.includes('גבוהה') || sl.includes('קריטית') || sl.includes('critical') || sl.includes('high')) return 'red';
    if (sl.includes('בינונית') || sl.includes('medium')) return 'amber';
    return 'red';
  })();

  // ── Card 3: Market State ──────────────────────────────────
  // Color is based ONLY on mood (macroMood/mainTheme) — riskStr is the Risk Sentiment sub-line,
  // not the market-state color signal. This prevents Risk-On turning a "ניטרלי" card green.
  const moodAccent = getMarketStateTone(mood);
  const moodIcon = { green: '📈', red: '📉', amber: '⚖️' }[moodAccent];
  const riskDisplay = (() => {
    const tl = riskStr.toLowerCase();
    if (tl.includes('risk-on') || tl.includes('risk on')) return '🟢 אופטימיות בשוק';
    if (tl.includes('risk-off') || tl.includes('risk off')) return '🔴 חשש בשוק';
    return riskStr ? `🟡 ${riskStr}` : null;
  })();
  // Badge shows the market-state value itself (e.g. "ניטרלי") — not risk sentiment.
  const moodBadge = mood || riskStr || null;

  // ── Economic KPI strip (row 2) ────────────────────────────
  const rateVal   = extractEconValue(interestRates);
  const inflVal   = extractEconValue(inflation);
  const bondVal   = extractEconValue(bondYields);
  const oilVal    = extractEconValue(oilEnergy);
  const dollarVal = extractEconValue(dollar);
  const hasRow2   = rateVal || inflVal || bondVal || oilVal || dollarVal;

  const hasAnyData = mood || riskStr || oppTitle || riskTitle || hasRow2;
  if (!hasAnyData) return null;

  const moodResearchHref = buildPerplexityResearchQuery(
    { category: 'מצב שוק', title: mood || riskStr, badge: moodBadge, body: summary },
    'snapshot',
  );
  const riskResearchHref = buildPerplexityResearchQuery(
    { category: 'סיכון מרכזי', title: riskTitle, badge: riskSev, body: riskBody },
    'snapshot',
  );
  const oppResearchHref = buildPerplexityResearchQuery(
    { category: 'הזדמנות מרכזית', title: oppTitle, badge: oppType, body: oppDetail },
    'snapshot',
  );

  return (
    <div dir="rtl">
      {/* Row 1: 3 primary status cards — RTL order: מצב שוק (right) → סיכון (center) → הזדמנות (left) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatusCard
          accent={moodAccent}
          icon={moodIcon}
          category="מצב שוק"
          title={mood || riskStr || ''}
          subLine={riskDisplay}
          bodyText={summary}
          badge={moodBadge}
          isEmpty={!mood && !riskStr}
          emptyTitle="מצב שוק לא ידוע"
          researchHref={moodResearchHref}
        />
        <StatusCard
          accent={riskAccent}
          icon="⚠️"
          category="סיכון מרכזי"
          title={riskTitle}
          bodyText={riskBody}
          badge={riskBadge}
          isEmpty={!riskTitle}
          emptyTitle="אין כרגע סיכון מרכזי"
          researchHref={riskResearchHref}
        />
        <StatusCard
          accent="green"
          icon="💡"
          category="הזדמנות מרכזית"
          title={oppTitle}
          subLine={oppSubLine}
          bodyText={oppDetail}
          ctaLabel={oppTicker ? `פתח ${oppTicker} בפיניוויז` : oppLink ? 'פתח בפיניוויז' : null}
          ctaHref={oppLink}
          isEmpty={!oppTitle}
          emptyTitle="אין כרגע הזדמנות מרכזית"
          researchHref={oppResearchHref}
        />
      </div>

      {/* Row 2: compact economic KPI strip */}
      {hasRow2 && (
        <>
          <div className="my-3 border-t border-slate-100 dark:border-zinc-800" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {rateVal   && <KpiCard label="🏦 ריבית"    value={rateVal}   accent="blue"  compact />}
            {inflVal   && <KpiCard label="📊 אינפלציה" value={inflVal}   accent="amber" compact />}
            {bondVal   && <KpiCard label="📈 אג״ח 10Y" value={bondVal}   accent="slate" compact valueDir="ltr" />}
            {oilVal    && <KpiCard label="🛢️ נפט"      value={oilVal}    accent="amber" compact />}
            {dollarVal && <KpiCard label="💵 דולר"     value={dollarVal} accent="blue"  compact />}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────

/**
 * Dedicated renderer for Macro GEM paste-back data.
 * Reads from marketBriefData.rawData and universalTabs.specialized.
 * Renders rich tables with Hebrew labels — no raw English keys exposed.
 */
export function MacroGemDashboard({
  marketBriefData,
  effectiveVideo,
  onSaveToBrain,
  bulkSelection = null,
}) {
  const raw = marketBriefData?.rawData || {};
  const spec = marketBriefData?.universalTabs?.specialized || {};

  // Prefer rawData; fall back to specialized
  const get = (key) => (raw[key] !== undefined ? raw[key] : spec[key]);

  const macroOverview  = asObj(get('macroOverview'));
  const fedPolicy      = asObj(get('fedPolicy'));
  const interestRates  = asObj(get('interestRates'));
  const inflation      = asObj(get('inflation'));
  const bondYields     = asObj(get('bondYields'));
  const dollar         = asObj(get('dollar'));
  const oilEnergy      = asObj(get('oilEnergy'));
  const liquidity      = asObj(get('liquidity'));
  const laborMarket    = asObj(get('laborMarket'));
  const growthRecession = asObj(get('growthRecession'));

  // Arrays — macroHighlights is a dedicated section, not merged into events
  const sectors         = get('sectors');
  const stocksMentioned = get('stocksMentioned');
  const macroEvents     = get('macroEvents') || get('macroFactors');
  const macroHighlights = get('macroHighlights');
  const opportunities   = get('opportunities');
  const risks           = get('risks');
  const warnings        = get('warnings');
  const actionItems     = get('actionItems');

  // Indices via the universal extractor (handles both legacy and new field names)
  const indicesItems = effectiveVideo
    ? extractVideoTabItems(effectiveVideo, 'indices', marketBriefData)
    : (Array.isArray(get('indices')) ? get('indices') : []);

  // J: warnings + actionItems combined, deduplicated against opportunities and risks
  const warningsRaw = [
    ...(Array.isArray(warnings) ? warnings : []),
    ...(Array.isArray(actionItems) ? actionItems : []),
  ];
  const warningsAndActions = dedupeVsRef(warningsRaw, opportunities, risks);

  const isEmpty =
    !macroOverview && !fedPolicy && !interestRates && !inflation && !bondYields
    && !dollar && !oilEnergy && !liquidity && !laborMarket && !growthRecession
    && indicesItems.length === 0
    && !Array.isArray(sectors) && !Array.isArray(stocksMentioned)
    && !Array.isArray(macroEvents) && !Array.isArray(macroHighlights)
    && !Array.isArray(opportunities) && !Array.isArray(risks)
    && warningsAndActions.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
        <span className="text-3xl mb-2 opacity-30">🌍</span>
        <p className="text-sm">אין עדיין נתוני מאקרו — הדבק JSON מ-GEM מאקרו</p>
      </div>
    );
  }

  // Build bulk items for select-all registration (array sections only; object/table sections excluded)
  const macroBulkItems = bulkSelection ? (() => {
    const out = [];
    const add = (arr, fmt, sectionKey, sectionLabel) => {
      const safe = Array.isArray(arr) ? arr.filter(Boolean) : [];
      safe.map(fmt).filter(Boolean).forEach((text, i) => {
        out.push({ id: `macro-gem:${sectionKey}:${i}`, text, sectionLabel, type: sectionKey, tabScope: 'specialized' });
      });
    };
    add(macroHighlights,    formatHighlightItem,   'macro-highlights',    '⭐ היילייטים');
    add(macroEvents,        formatMacroEventItem,  'brief-macro',         '🌍 אירועי מאקרו');
    add(opportunities,      formatOpportunityItem, 'brief-opportunities', '💡 הזדמנויות');
    add(risks,              formatRiskItem,        'brief-risks',         '⚠️ סיכונים');
    add(warningsAndActions, formatWarningItem,     'macro-warnings',      '🔔 אזהרות ופעולות למעקב');
    return out;
  })() : [];

  return (
    <div className="space-y-3" dir="rtl" data-macro-gem-dashboard>
      <TabBulkItemsRegistrar tab="specialized" items={macroBulkItems} />

      {/* ✦ תמונת מצב מהירה */}
      <SectionCard title="🌍 תמונת מצב מהירה" count={null} tone={TONE.NEUTRAL}>
        <ExecutiveSnapshot
          macroOverview={macroOverview}
          opportunities={Array.isArray(opportunities) ? opportunities : []}
          risks={Array.isArray(risks) ? risks : []}
          sectors={Array.isArray(sectors) ? sectors : []}
          interestRates={interestRates}
          inflation={inflation}
          bondYields={bondYields}
          oilEnergy={oilEnergy}
          dollar={dollar}
        />
      </SectionCard>

      {/* 1. היילייטים — השורה התחתונה של הסרטון */}
      <MacroHighlightsSection
        items={macroHighlights}
        onSaveToBrain={onSaveToBrain}
        bulkSelection={bulkSelection}
      />

      {/* 2. אירועי מאקרו — מה קרה? */}
      <MacroEventCardsSection
        items={macroEvents}
        onSaveToBrain={onSaveToBrain}
        bulkSelection={bulkSelection}
      />

      {/* 3. תמונת מאקרו — מה זה אומר? */}
      <MacroOverviewCard
        macroOverview={macroOverview}
        onSaveToBrain={onSaveToBrain}
        bulkSelection={bulkSelection}
      />

      {/* 4. סיכונים */}
      <MacroRiskCardsSection
        items={risks}
        onSaveToBrain={onSaveToBrain}
        bulkSelection={bulkSelection}
      />

      {/* 5. הזדמנויות */}
      <MacroOpportunityCardsSection
        items={opportunities}
        onSaveToBrain={onSaveToBrain}
        bulkSelection={bulkSelection}
      />

      {/* 6. אזהרות ופעולות למעקב */}
      {warningsAndActions.length > 0 && (
        <MacroWarningsSection
          items={warningsAndActions}
          onSaveToBrain={onSaveToBrain}
          bulkSelection={bulkSelection}
        />
      )}

      {/* 7. סקטורים */}
      <MacroSectorsSection sectors={sectors} onSaveToBrain={onSaveToBrain} bulkSelection={bulkSelection} />

      {/* 8. מניות שהוזכרו */}
      <MacroStocksSection stocks={stocksMentioned} onSaveToBrain={onSaveToBrain} bulkSelection={bulkSelection} />

      {/* 9. מדדים ואינדיקטורים */}
      <MacroIndicesSection indicesItems={indicesItems} onSaveToBrain={onSaveToBrain} bulkSelection={bulkSelection} />

      <MacroObjectSection
        title="🏦 מדיניות הפד וריבית"
        objects={[
          { label: 'מדיניות הפד', obj: fedPolicy },
          { label: 'ריבית', obj: interestRates },
        ]}
        sectionKey="fed-rates"
        onSaveToBrain={onSaveToBrain}
        bulkSelection={bulkSelection}
      />

      <MacroObjectSection
        title="📊 משתני מאקרו מרכזיים"
        objects={[
          { label: 'אינפלציה', obj: inflation },
          { label: 'אג"ח ותשואות', obj: bondYields },
          { label: 'דולר', obj: dollar },
          { label: 'נפט ואנרגיה', obj: oilEnergy },
          { label: 'נזילות', obj: liquidity },
          { label: 'שוק העבודה', obj: laborMarket },
          { label: 'צמיחה / מיתון', obj: growthRecession },
        ]}
        sectionKey="economic-factors"
        onSaveToBrain={onSaveToBrain}
        bulkSelection={bulkSelection}
      />

    </div>
  );
}
