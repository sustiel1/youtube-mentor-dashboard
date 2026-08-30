import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from '@/components/dashboard/MorningBriefVisualPrimitives';
import { AnalysisTickerLink } from '@/components/shared/AnalysisTickerLink';
import { getStockSectorMeta } from '@/lib/stockSectorMap';
import { buildSectorTableFinvizUrl } from '@/lib/sectorFinvizLinks';
import {
  PILL_CLS,
  SECTOR_PILL_CLS,
  getSectorTone,
  CATEGORY_META,
  CATEGORY_ORDER,
  deriveSyntheticStockCategory,
  getActivityTone,
  getSavedStockSentimentTone,
} from '@/lib/stockRowVisuals';
import { parseStockRowFromText } from '@/lib/stockRowText';

/** Sector pill — ticker-only lookup, no dependency on the saved row's free text. */
function SectorPill({ ticker }) {
  const meta = getStockSectorMeta(ticker);
  if (!meta?.sectorHe) return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  const url = buildSectorTableFinvizUrl(meta.sectorEtf);
  const content = (
    <>
      <span className="truncate">{meta.sectorHe}</span>
      <span dir="ltr" className="text-[10px] font-bold opacity-70">{meta.sectorEtf}</span>
    </>
  );
  if (!url) {
    return <span className={`${SECTOR_PILL_CLS} ${getSectorTone(meta.sectorEtf)}`}>{content}</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      title={`פתיחת תעודת הסל ${meta.sectorEtf} (${meta.sector}) ב־Finviz`}
      aria-label={`פתיחת סקטור ${meta.sectorHe} דרך תעודת הסל ${meta.sectorEtf} ב־Finviz`}
      className={`${SECTOR_PILL_CLS} ${getSectorTone(meta.sectorEtf)} cursor-pointer transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-900`}
      data-stock-sector-link={meta.sectorEtf}
    >
      {content}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

/**
 * Table view for individually-saved "מניות שהוזכרו" rows aggregated under a
 * saved-analysis section. Visually mirrors the snapshot Stocks table
 * (טיקר / סקטור / סנטימנט / קטגוריה / פעילות / הערות, category filter chips)
 * as closely as the underlying saved text allows — see src/lib/stockRowText.js
 * for what can and cannot be recovered from it.
 *
 * Two known fidelity gaps vs. the committed StocksTable, both accepted by
 * explicit decision (2026-08-30):
 *   - "קטגוריה" is synthetic, derived from sentiment (deriveSyntheticStockCategory)
 *     — there is no real category field in this saved data.
 *   - "סנטימנט" only ever shows חיובי/שלילי/— (no explicit "ניטרלי"), because
 *     parseStockFromText's keyword-based inference has no neutral outcome.
 *
 * Rows whose text does not parse as a stock row fall back to a single
 * full-width text cell, so no saved content is ever dropped.
 */

const TH_CLS = `py-2.5 px-2 first:ps-0 last:pe-0 ${DASHBOARD_TABLE_HEAD_CLS}`;
const TD_CLS = 'py-2.5 px-2 align-middle first:ps-0 last:pe-0';

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

export function SavedStockRowsTable({ entries = [] }) {
  const [activeCat, setActiveCat] = useState('all');

  const rows = useMemo(() => entries.map((entry) => {
    const text = typeof entry === 'string' ? entry : entry?.text;
    const parsed = parseStockRowFromText(text);
    return {
      text: String(text || ''),
      parsed,
      category: parsed ? deriveSyntheticStockCategory(parsed.sentiment) : null,
    };
  }).filter((row) => row.text), [entries]);

  const { counts, filtered } = useMemo(() => {
    const c = { watchlist: 0, risk: 0, opportunity: 0, general: 0 };
    for (const row of rows) if (row.category) c[row.category] += 1;
    const f = activeCat === 'all' ? rows : rows.filter((row) => row.category === activeCat);
    return { counts: c, filtered: f };
  }, [rows, activeCat]);

  if (rows.length === 0) return null;

  return (
    <div data-saved-stock-rows-table>
      <div className="mb-2 flex flex-wrap items-center gap-1.5" dir="rtl" data-stock-category-filter>
        <FilterChip label="הכל" count={rows.length} isActive={activeCat === 'all'} onClick={() => setActiveCat('all')} />
        {CATEGORY_ORDER.filter((key) => counts[key] > 0).map((key) => (
          <FilterChip
            key={key}
            label={CATEGORY_META[key].label}
            count={counts[key]}
            isActive={activeCat === key}
            onClick={() => setActiveCat(key)}
          />
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 [scrollbar-gutter:stable]">
        <table className="w-full min-w-[760px] text-right table-fixed border-collapse" dir="rtl">
          <colgroup>
            <col style={{ width: '84px' }} />
            <col style={{ width: '160px' }} />
            <col style={{ width: '104px' }} />
            <col style={{ width: '116px' }} />
            <col style={{ width: '104px' }} />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-700">
              <th className={TH_CLS}>טיקר</th>
              <th className={TH_CLS}>סקטור</th>
              <th className={`${TH_CLS} text-center`}>סנטימנט</th>
              <th className={`${TH_CLS} text-center`}>קטגוריה</th>
              <th className={`${TH_CLS} text-center`}>פעילות</th>
              <th className={TH_CLS}>הערות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-slate-400 dark:text-zinc-600">
                  אין מניות בקטגוריה זו
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => {
                if (!row.parsed) {
                  return (
                    <tr key={`${row.text}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
                      <td colSpan={6} className={`${TD_CLS} ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                        <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{row.text}</span>
                      </td>
                    </tr>
                  );
                }
                const { symbol, companyName, sentiment, activity, notes } = row.parsed;
                const sentTone = getSavedStockSentimentTone(sentiment);
                const catKey = row.category;
                return (
                  <tr key={`${symbol || 'row'}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
                    <td className={`${TD_CLS} whitespace-nowrap ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
                      <AnalysisTickerLink ticker={symbol}>{symbol || '—'}</AnalysisTickerLink>
                    </td>
                    <td className={TD_CLS}>
                      <SectorPill ticker={symbol} />
                    </td>
                    <td className={`${TD_CLS} text-center`}>
                      {sentTone ? (
                        <span className={`${PILL_CLS} ${sentTone.className}`}>
                          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${sentTone.dotClassName}`} />
                          {sentTone.label}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className={`${TD_CLS} text-center`}>
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
                    <td className={`${TD_CLS} text-center`}>
                      {activity ? (
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getActivityTone(activity)}`} dir="ltr">
                          {activity}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className={`${TD_CLS} ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                      <p className="line-clamp-2 [overflow-wrap:anywhere]" title={[companyName, notes].filter(Boolean).join(' · ') || undefined}>
                        {[companyName, notes].filter(Boolean).join(' · ') || '—'}
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
