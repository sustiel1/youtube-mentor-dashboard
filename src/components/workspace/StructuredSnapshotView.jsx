import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnalysisSectionCard } from '@/components/shared/AnalysisContentPrimitives';
import { AnalysisTickerLink } from '@/components/shared/AnalysisTickerLink';
import {
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from '@/components/dashboard/MorningBriefVisualPrimitives';
import { MarketAssetLinksMenu } from '@/components/shared/MarketAssetLinksMenu';
import { MarketAssetDescriptionTooltip } from '@/components/shared/MarketAssetDescriptionTooltip';
import { resolveStockSectorDisplay } from '@/lib/stockSectorEnrichment';
import { normalizeStructuredSnapshotCollections } from '@/utils/structuredSnapshot';
import { format } from "date-fns";
import { he } from "date-fns/locale";

/**
 * Read-only viewer for a `structured-snapshot` Workspace Library item.
 * Renders ONLY what is stored in `snapshot` (structuredSnapshot) — never
 * re-derives rows from live video/marketBriefData. Self-contained Dialog,
 * so it can be opened on top of WorkspaceSaveReviewOverlay's own Dialog.
 */
export function StructuredSnapshotView({ open, onOpenChange, snapshot, itemTitle }) {
  if (!snapshot) return null;

  const savedLabel = (() => {
    try { return format(new Date(snapshot.savedAt), "d בMMMM yyyy, HH:mm", { locale: he }); }
    catch { return ''; }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="flex flex-col p-0 gap-0 w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh]">
        <DialogHeader className="shrink-0 border-b border-slate-200 dark:border-zinc-800 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-right text-base font-bold text-slate-900 dark:text-zinc-100">
            📊 {itemTitle || snapshot.videoTitle || 'תמונת מצב שוק'}
            {savedLabel && (
              <span className="text-xs font-normal text-slate-400 dark:text-zinc-500">— נשמר {savedLabel}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5"><StructuredSnapshotContent snapshot={snapshot} /></div>
      </DialogContent>
    </Dialog>
  );
}

export function StructuredSnapshotContent({ snapshot }) {
  if (!snapshot) return null;
  const normalizedSnapshot = normalizeStructuredSnapshotCollections(snapshot);
  return (
    <div className="space-y-3" data-persisted-snapshot="true">
      <SnapshotSection title="📊 סנטימנט שוק" count={normalizedSnapshot.sentimentTable.length}>
        <SentimentTable rows={normalizedSnapshot.sentimentTable} />
      </SnapshotSection>
      <SnapshotSection title="📈 שווקים" count={normalizedSnapshot.marketsTable.length}>
        <MarketsTable rows={normalizedSnapshot.marketsTable} />
      </SnapshotSection>
      <SnapshotSection title="⭐ מניות שהוזכרו" count={normalizedSnapshot.stocksTable.length}>
        <StocksTable rows={normalizedSnapshot.stocksTable} />
      </SnapshotSection>
    </div>
  );
}

function SnapshotSection({ title, count, children }) {
  return (
    <AnalysisSectionCard title={title} count={count}>
      {children}
    </AnalysisSectionCard>
  );
}

function EmptyTableNote({ label }) {
  return <p className="py-6 text-center text-sm text-slate-400 dark:text-zinc-600">{label}</p>;
}

const TH_CLS = `py-2.5 px-2 first:ps-0 last:pe-0 ${DASHBOARD_TABLE_HEAD_CLS}`;

// Stocks table cell hierarchy: טיקר primary, סקטור/סנטימנט/קטגוריה colored pills, קשר/הערות muted.
const STOCK_TD_CLS = 'py-2.5 px-2 align-middle first:ps-0 last:pe-0';

// Sector ETF → pill tone. Same colour-class shape as getTrendTone / getSentimentTone.
const SECTOR_TONE = {
  XLK:  'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300',
  IGV:  'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
  SMH:  'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  XLC:  'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  XLY:  'border-pink-200 bg-pink-50 text-pink-800 dark:border-pink-800 dark:bg-pink-950/40 dark:text-pink-300',
  XLP:  'border-lime-200 bg-lime-50 text-lime-800 dark:border-lime-800 dark:bg-lime-950/40 dark:text-lime-300',
  XLF:  'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  XLE:  'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  XLI:  'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  XLV:  'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  XLB:  'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
  XLU:  'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  XLRE: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300',
};
const SECTOR_TONE_FALLBACK = 'border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

function getSectorTone(etf) {
  return SECTOR_TONE[String(etf || '').toUpperCase()] || SECTOR_TONE_FALLBACK;
}

// Stock category → { key, label, tone }. Keys match the GEM enum (opportunity/watchlist/risk/general).
const CATEGORY_META = {
  watchlist:   { label: 'Watchlist', tone: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' },
  risk:        { label: 'סיכון',      tone: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300' },
  opportunity: { label: 'הזדמנות',    tone: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300' },
  general:     { label: 'אזכור',      tone: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
};
const CATEGORY_ORDER = ['watchlist', 'risk', 'opportunity', 'general'];

function normStockCategory(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/watchlist|מעקב/.test(text)) return 'watchlist';
  if (/risk|סיכון|סיכונ/.test(text)) return 'risk';
  if (/opportunity|הזדמנות|הזדמנ/.test(text)) return 'opportunity';
  return 'general';
}

/** "avoid" activity gets a red-tinted tag; everything else is a neutral tag. */
function getActivityTone(value) {
  return /avoid|הימנע|הימנעות|להימנע/i.test(String(value || ''))
    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

const PILL_CLS = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold';
const SECTOR_PILL_CLS = `${PILL_CLS} max-w-full whitespace-nowrap`;

function SectorPill({ ticker, storedSector }) {
  const meta = resolveStockSectorDisplay({ ticker, storedSector });
  if (!meta?.label) return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  const content = (
    <>
      <span className="truncate">{meta.label}</span>
      {meta.etf && <span dir="ltr" className="text-[10px] font-bold opacity-70">{meta.etf}</span>}
    </>
  );
  if (!meta.url) {
    return <span className={`${SECTOR_PILL_CLS} ${getSectorTone(meta.etf)}`}>{content}</span>;
  }
  return (
    <a
      href={meta.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      title={`פתיחת תעודת הסל ${meta.etf} (${meta.label}) ב־Finviz`}
      aria-label={`פתיחת סקטור ${meta.label} דרך תעודת הסל ${meta.etf} ב־Finviz`}
      className={`${SECTOR_PILL_CLS} ${getSectorTone(meta.etf)} cursor-pointer transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-900`}
      data-stock-sector-link={meta.etf}
    >
      {content}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

function StockCategoryFilterChips({ counts, total, active, onChange }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5" dir="rtl" data-stock-category-filter>
      <FilterChip label="הכל" count={total} isActive={active === 'all'} onClick={() => onChange('all')} />
      {CATEGORY_ORDER.filter((key) => counts[key] > 0).map((key) => (
        <FilterChip
          key={key}
          label={CATEGORY_META[key].label}
          count={counts[key]}
          isActive={active === key}
          onClick={() => onChange(key)}
        />
      ))}
    </div>
  );
}

function FilterChip({ label, count, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
        isActive
          ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-70">· {count}</span>
    </button>
  );
}

function StocksTable({ rows = [] }) {
  const [activeCat, setActiveCat] = useState('all');

  const { counts, filtered } = useMemo(() => {
    const c = { watchlist: 0, risk: 0, opportunity: 0, general: 0 };
    for (const r of rows) c[normStockCategory(r.category)] += 1;
    const f = activeCat === 'all' ? rows : rows.filter((r) => normStockCategory(r.category) === activeCat);
    return { counts: c, filtered: f };
  }, [rows, activeCat]);

  if (rows.length === 0) return <EmptyTableNote label="לא נשמרו מניות בתמונת המצב הזו" />;

  return (
    <div>
      <StockCategoryFilterChips counts={counts} total={rows.length} active={activeCat} onChange={setActiveCat} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 [scrollbar-gutter:stable]">
        <table className="w-full min-w-[820px] text-right table-fixed border-collapse" dir="rtl" data-snapshot-stocks-table>
          <colgroup>
            <col style={{ width: '84px' }} />
            <col style={{ width: '164px' }} />
            <col />
            <col style={{ width: '104px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '112px' }} />
            <col style={{ width: '190px' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-700">
              <th className={TH_CLS}>טיקר</th>
              <th className={TH_CLS}>סקטור</th>
              <th className={TH_CLS}>קשר</th>
              <th className={`${TH_CLS} text-center`}>סנטימנט</th>
              <th className={`${TH_CLS} text-center`}>קטגוריה</th>
              <th className={`${TH_CLS} text-center`}>פעילות</th>
              <th className={TH_CLS}>הערות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-slate-400 dark:text-zinc-600">
                  אין מניות בקטגוריה זו
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => {
                const catKey = normStockCategory(r.category);
                const sentTone = r.sentiment ? getSentimentTone(r.sentiment) : null;
                return (
                  <tr key={`${r.ticker || 'row'}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
                    <td className={`${STOCK_TD_CLS} whitespace-nowrap ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
                      <AnalysisTickerLink ticker={r.ticker}>{r.ticker || '—'}</AnalysisTickerLink>
                    </td>
                    <td className={STOCK_TD_CLS}>
                      <SectorPill ticker={r.ticker} storedSector={r.sector} />
                    </td>
                    <td className={`${STOCK_TD_CLS} ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                      <p className="line-clamp-1 [overflow-wrap:anywhere]" title={r.context || undefined}>
                        {r.context || '—'}
                      </p>
                    </td>
                    <td className={`${STOCK_TD_CLS} text-center`}>
                      {sentTone ? (
                        <span className={`${PILL_CLS} ${sentTone.className}`}>
                          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${sentTone.dotClassName}`} />
                          {r.sentiment}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className={`${STOCK_TD_CLS} text-center`}>
                      <button
                        type="button"
                        onClick={() => setActiveCat((cur) => (cur === catKey ? 'all' : catKey))}
                        aria-pressed={activeCat === catKey}
                        title={activeCat === catKey ? 'ביטול הסינון' : `סינון לפי ${CATEGORY_META[catKey].label}`}
                        className={`${PILL_CLS} ${CATEGORY_META[catKey].tone} cursor-pointer transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-900 ${
                          activeCat === catKey ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-zinc-900' : ''
                        }`}
                      >
                        {CATEGORY_META[catKey].label}
                      </button>
                    </td>
                    <td className={`${STOCK_TD_CLS} text-center`}>
                      {r.actionability ? (
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getActivityTone(r.actionability)}`}>
                          {r.actionability}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className={`${STOCK_TD_CLS} ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                      <p className="line-clamp-2 [overflow-wrap:anywhere]" title={r.notes || undefined}>
                        {r.notes || '—'}
                      </p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Finviz stays reachable through the asset-name preferred link — parity with the live Markets table. */
const SNAPSHOT_MARKETS_HIDDEN_PROVIDERS = Object.freeze(['finviz']);

// Markets table cell hierarchy: נכס primary, מגמה a colored pill, עוצמה + הערה secondary/muted.
const MARKET_TD_CLS = 'py-2.5 px-2 align-middle first:ps-0 last:pe-0';

function MarketsTable({ rows = [] }) {
  if (rows.length === 0) return <EmptyTableNote label="לא נשמרו נתוני שווקים בתמונת המצב הזו" />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 [scrollbar-gutter:stable]">
      <table className="w-full min-w-[720px] text-right table-fixed border-collapse" dir="rtl">
        <colgroup>
          <col style={{ width: '170px' }} />
          <col style={{ width: '64px' }} />
          <col style={{ width: '120px' }} />
          <col style={{ width: '116px' }} />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200 dark:border-zinc-700">
            <th className={TH_CLS}>נכס</th>
            <th className={`${TH_CLS} text-center`}>קישורים</th>
            <th className={`${TH_CLS} text-center`}>מגמה</th>
            <th className={`${TH_CLS} text-center`}>עוצמה</th>
            <th className={TH_CLS}>הערה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const trend = String(r.trend || '').trim();
            const strength = String(r.strength || '').trim();
            const tone = trend ? getTrendTone(trend) : null;
            return (
              <tr key={`${r.asset || 'row'}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
                <td className={`${MARKET_TD_CLS} whitespace-nowrap ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
                  <MarketAssetDescriptionTooltip asset={r.asset} showQualifier={false}>
                    {r.asset || '—'}
                  </MarketAssetDescriptionTooltip>
                </td>
                <td className={`${MARKET_TD_CLS} text-center`}>
                  <MarketAssetLinksMenu asset={r.asset} hiddenProviders={SNAPSHOT_MARKETS_HIDDEN_PROVIDERS} />
                </td>
                <td className={`${MARKET_TD_CLS} text-center`}>
                  {tone ? (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.className}`}>
                      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dotClassName}`} />
                      {trend}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className={`${MARKET_TD_CLS} text-center ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                  {strength
                    ? (/\d/.test(strength)
                        ? <span dir="ltr" className="tabular-nums" style={{ unicodeBidi: 'isolate' }}>{strength}</span>
                        : strength)
                    : '—'}
                </td>
                <td className={`${MARKET_TD_CLS} ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                  <p className="line-clamp-2 [overflow-wrap:anywhere]" title={r.comment || undefined}>
                    {r.comment || '—'}
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SentimentTable({ rows = [] }) {
  if (rows.length === 0) return <EmptyTableNote label="לא נשמר סנטימנט בתמונת המצב הזו" />;
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const tone = getSentimentTone(r.value);
        return (
          <div key={`${r.label || 'row'}-${i}`} className="rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2 flex items-start gap-2">
            <span className={`shrink-0 ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{r.label || '—'}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.className}`}>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dotClassName}`} />
              {r.value || '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function getSentimentTone(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/מתוח|מעורב|זהיר|תנודתי/.test(text)) {
    return {
      className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      dotClassName: 'bg-amber-500',
    };
  }
  if (/שלילי|דובי|יריד/.test(text)) {
    return {
      className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
      dotClassName: 'bg-red-500',
    };
  }
  if (/חיובי|שורי|עליות?/.test(text)) {
    return {
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      dotClassName: 'bg-emerald-500',
    };
  }
  return {
    className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    dotClassName: 'bg-slate-400',
  };
}

/** Market trend → pill tone (עולה / יורד / דשדוש). Shares SentimentTable's colour classes. */
function getTrendTone(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/דשדוש|מדשדש|צידי|יציב|ללא שינוי|שטוח|מעורב|ניטרל/.test(text)) {
    return {
      className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      dotClassName: 'bg-amber-500',
    };
  }
  if (/יור[דת]|יריד|נפיל|צונ|דוב|שליל|נחלש|אדום|מתמת/.test(text)) {
    return {
      className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
      dotClassName: 'bg-red-500',
    };
  }
  if (/עול|עלי|טיפוס|מזנק|שור|ראלי|ירוק|חיוב/.test(text)) {
    return {
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      dotClassName: 'bg-emerald-500',
    };
  }
  return {
    className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    dotClassName: 'bg-slate-400',
  };
}
