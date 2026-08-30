import {
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from '@/components/dashboard/MorningBriefVisualPrimitives';
import { MarketAssetLinksMenu } from '@/components/shared/MarketAssetLinksMenu';
import { MarketAssetPreferredLink } from '@/components/shared/MarketAssetProviderLinks';
import { renderLinkedMarketText } from '@/components/shared/LinkedMarketText';
import { getMarketTrendTone, MARKET_PILL_CLS } from '@/lib/marketRowVisuals';
import { parseMarketRowFromText } from '@/lib/marketRowText';

/**
 * Table view for individually-saved "indices" rows aggregated under a
 * saved-analysis section. Mirrors the snapshot Markets table layout
 * (columns נכס / קישורים / מגמה / עוצמה / הערה, coloured trend pill,
 * consolidated links menu) but sources its columns from a best-effort
 * parse of each entry's flat text — see src/lib/marketRowText.js.
 *
 * Rows whose text does not parse as a market row fall back to a single
 * full-width text cell, so no saved content is ever dropped.
 */

// Finviz stays reachable through the asset-name preferred link — parity with the snapshot table.
const HIDDEN_PROVIDERS = Object.freeze(['finviz']);

const TH_CLS = `py-2.5 px-2 first:ps-0 last:pe-0 ${DASHBOARD_TABLE_HEAD_CLS}`;
const TD_CLS = 'py-2.5 px-2 align-middle first:ps-0 last:pe-0';

function isNumericStrength(value) {
  return /\d/.test(String(value || ''));
}

export function SavedMarketRowsTable({ entries = [] }) {
  const rows = entries.map((entry) => {
    const text = typeof entry === 'string' ? entry : entry?.text;
    return { text: String(text || ''), parsed: parseMarketRowFromText(typeof entry === 'string' ? entry : entry?.text) };
  }).filter((row) => row.text);

  if (rows.length === 0) return null;

  return (
    <div
      className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 [scrollbar-gutter:stable]"
      data-saved-market-rows-table
    >
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
          {rows.map(({ text, parsed }, i) => {
            if (!parsed) {
              return (
                <tr key={`${text}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
                  <td colSpan={5} className={`${TD_CLS} ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                    <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {renderLinkedMarketText(text)}
                    </span>
                  </td>
                </tr>
              );
            }
            const { asset, trend, strength, comment } = parsed;
            const tone = trend ? getMarketTrendTone(trend) : null;
            return (
              <tr key={`${asset || 'row'}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
                <td className={`${TD_CLS} whitespace-nowrap ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
                  {asset
                    ? <MarketAssetPreferredLink asset={asset} showQualifier={false}>{asset}</MarketAssetPreferredLink>
                    : <span className="text-slate-300 dark:text-zinc-600">—</span>}
                </td>
                <td className={`${TD_CLS} text-center`}>
                  <MarketAssetLinksMenu asset={asset} hiddenProviders={HIDDEN_PROVIDERS} />
                </td>
                <td className={`${TD_CLS} text-center`}>
                  {tone ? (
                    <span className={`${MARKET_PILL_CLS} ${tone.className}`}>
                      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dotClassName}`} />
                      {trend}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className={`${TD_CLS} text-center ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                  {strength
                    ? (isNumericStrength(strength)
                        ? <span dir="ltr" className="tabular-nums" style={{ unicodeBidi: 'isolate' }}>{strength}</span>
                        : strength)
                    : '—'}
                </td>
                <td className={`${TD_CLS} ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                  <p className="line-clamp-2 [overflow-wrap:anywhere]" title={comment || undefined}>
                    {comment ? renderLinkedMarketText(comment) : '—'}
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
