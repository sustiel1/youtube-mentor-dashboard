import { ExternalLink } from 'lucide-react';
import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from '@/components/dashboard/MorningBriefVisualPrimitives';
import { renderLinkedMarketText } from '@/components/shared/LinkedMarketText';
import { getHebrewDisplayLabel } from '@/lib/marketLabelTranslations';
import { resolveSectorTableFinvizLink } from '@/lib/sectorFinvizLinks';
import { PILL_CLS, SECTOR_PILL_CLS, getSectorTone } from '@/lib/stockRowVisuals';
import { getSectorRowSentimentTone, getSectorRowSentimentLabel } from '@/lib/sectorRowVisuals';
import { parseSectorRowFromText } from '@/lib/sectorRowText';

/**
 * Table view for individually-saved "🏭 סקטורים" rows aggregated under a
 * saved-analysis section. Mirrors the visual language of
 * SavedMarketRowsTable/SavedStockRowsTable (ETF pill, sentiment pill,
 * ticker-linkified commentary) but with only 3 real columns — סקטור /
 * סנטימנט / הערה — since this saved-row shape has no numeric change% and no
 * separate "mentioned tickers" field: any stock tickers appearing in the
 * commentary (e.g. "CRWD, OKTA ו-CRM נהנות") are just free-text substrings,
 * auto-linkified inline via renderLinkedMarketText — same treatment as the
 * indices comment cell — not a distinct structured field or column.
 *
 * Rows whose text does not parse (should not normally happen — see
 * sectorRowText.js's doc comment) fall back to a full-width text cell, so no
 * saved content is ever dropped.
 */

const TH_CLS = `py-2.5 px-2 first:ps-0 last:pe-0 ${DASHBOARD_TABLE_HEAD_CLS}`;
const TD_CLS = 'py-2.5 px-2 align-middle first:ps-0 last:pe-0';

/** Sector name + ETF pill — ticker-independent lookup, matches the live table's SectorFinvizName. */
function SectorNamePill({ sector }) {
  const displaySector = getHebrewDisplayLabel(sector) || sector;
  const link = resolveSectorTableFinvizLink(sector);

  if (!link) {
    return <span className={`whitespace-nowrap ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{displaySector || '—'}</span>;
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      title={`פתיחת תעודת הסל ${link.ticker} ב־Finviz`}
      aria-label={`פתיחת סקטור ${displaySector} דרך תעודת הסל ${link.ticker} ב־Finviz`}
      className={`${SECTOR_PILL_CLS} ${getSectorTone(link.ticker)} cursor-pointer transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-900`}
      data-stock-sector-link={link.ticker}
    >
      <span className="truncate">{displaySector}</span>
      <span dir="ltr" className="text-[10px] font-bold opacity-70">{link.ticker}</span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

export function SavedSectorRowsTable({ entries = [] }) {
  const rows = entries.map((entry) => {
    const text = typeof entry === 'string' ? entry : entry?.text;
    return { text: String(text || ''), parsed: parseSectorRowFromText(text) };
  }).filter((row) => row.text);

  if (rows.length === 0) return null;

  return (
    <div
      className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 [scrollbar-gutter:stable]"
      data-saved-sector-rows-table
    >
      <table className="w-full min-w-[560px] text-right table-fixed border-collapse" dir="rtl">
        <colgroup>
          <col style={{ width: '190px' }} />
          <col style={{ width: '120px' }} />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200 dark:border-zinc-700">
            <th className={TH_CLS}>סקטור</th>
            <th className={`${TH_CLS} text-center`}>סנטימנט</th>
            <th className={TH_CLS}>הערה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ text, parsed }, i) => {
            if (!parsed) {
              return (
                <tr key={`${text}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
                  <td colSpan={3} className={`${TD_CLS} ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                    <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {renderLinkedMarketText(text)}
                    </span>
                  </td>
                </tr>
              );
            }
            const { sector, sentimentRaw, note } = parsed;
            const tone = sentimentRaw ? getSectorRowSentimentTone(sentimentRaw) : null;
            return (
              <tr key={`${sector || 'row'}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
                <td className={TD_CLS}>
                  <SectorNamePill sector={sector} />
                </td>
                <td className={`${TD_CLS} text-center`}>
                  {tone ? (
                    <span className={`${PILL_CLS} ${tone.className}`}>
                      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dotClassName}`} />
                      {tone.label}
                    </span>
                  ) : sentimentRaw ? (
                    <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{getSectorRowSentimentLabel(sentimentRaw)}</span>
                  ) : (
                    <span className="text-slate-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className={`${TD_CLS} ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                  <p className="line-clamp-2 [overflow-wrap:anywhere]" title={note || undefined}>
                    {note ? renderLinkedMarketText(note) : '—'}
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
