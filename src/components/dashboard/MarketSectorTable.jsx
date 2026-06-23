import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from './MorningBriefVisualPrimitives';
import {
  buildPerplexityEtfHoldingsUrl,
  resolveSectorFinvizLink,
} from '@/utils/finvizLinks';

/** Column widths — matches Macro Gem sectors table (38% pre-sentiment + 15.5% sentiment). */
export const SECTOR_TABLE_MCOL = {
  checkbox: '2.5%',
  sentiment: '15.5%',
  save: '5%',
  name: '38%',
};

const SENT_KEY_LABEL = {
  positive: 'חיובי',
  negative: 'שלילי',
  neutral: 'ניטרלי',
};

/** Dot + colored sentiment label — shared by Macro Gem and Morning Brief sectors. */
export function SectorSentimentCell({ value }) {
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
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dot}`} aria-hidden />
      <span>{value}</span>
    </span>
  );
}

/**
 * Normalizes sector row data from Macro Gem or Morning Brief into a common shape.
 * @param {string|object} item
 * @param {{ sentKey?: string }} [options]
 */
export function normalizeSectorTableRow(item, options = {}) {
  if (typeof item === 'string') {
    const sector = item.trim();
    return {
      sector,
      sentiment: '',
      note: '',
      rowText: sector,
      isStringOnly: true,
    };
  }

  const sector = String(item.sector || item.name || '').trim();
  const sentiment = String(
    item.direction || item.trend || item.performance || item.sentiment || ''
  ).trim();
  const note = String(
    item.relativeStrength || item.note || item.description || item.strength || ''
  ).trim();
  const reason = String(
    item.reason || item.rationale || item.why || item.catalyst || ''
  ).trim();
  const noteText = [note, reason].filter(Boolean).join(' · ');
  const sentimentFallback = options.sentKey ? SENT_KEY_LABEL[options.sentKey] : '';
  const sentimentLabel = sentiment || sentimentFallback;

  return {
    sector,
    sentiment: sentimentLabel,
    note: noteText,
    rowText: [sector, sentimentLabel, noteText].filter(Boolean).join(' · '),
    isStringOnly: false,
  };
}

function SectorNameCell({ sector }) {
  const link = resolveSectorFinvizLink(sector);
  const pxUrl = link ? buildPerplexityEtfHoldingsUrl(link.ticker) : null;

  return (
    <div className="flex flex-col gap-0.5">
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title="פתח ב-Finviz ↗"
          className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline cursor-pointer`}
          onClick={(e) => e.stopPropagation()}
          data-finviz-link={link.ticker}
        >
          {sector}
        </a>
      ) : (
        <span className={DASHBOARD_TABLE_CELL_PRIMARY_CLS}>{sector || '—'}</span>
      )}
      {pxUrl && (
        <a
          href={pxUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`10 אחזקות מובילות של ${link.ticker} ב-Perplexity`}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] font-medium text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 whitespace-nowrap transition-colors"
        >
          🔎 בדוק אחזקות
        </a>
      )}
    </div>
  );
}

/**
 * Shared sectors table: ☐ | סקטור | סנטימנט | הערה / סיבה | save
 * Leading/trailing cells are injected so Morning Brief can add checkbox + save actions.
 */
export function MarketSectorTable({
  rows = [],
  renderLeadingCell = null,
  renderTrailingCell = null,
  getRowOptions = null,
  rowClassName = 'border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group',
}) {
  const safe = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!safe.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right border-collapse" style={{ tableLayout: 'fixed' }} dir="rtl">
        <colgroup>
          {renderLeadingCell ? <col style={{ width: SECTOR_TABLE_MCOL.checkbox }} /> : null}
          <col style={{ width: SECTOR_TABLE_MCOL.name }} />
          <col style={{ width: SECTOR_TABLE_MCOL.sentiment }} />
          <col />
          {renderTrailingCell ? <col style={{ width: SECTOR_TABLE_MCOL.save }} /> : null}
        </colgroup>
        <thead>
          <tr className="border-b-2 border-slate-200/80 dark:border-zinc-700/70">
            {renderLeadingCell ? <th className="py-1.5 pr-2 pl-0" aria-label="בחירה" /> : null}
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סקטור</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הערה / סיבה</th>
            {renderTrailingCell ? <th className="py-1.5 pl-1 pr-0" aria-label="שמירה" /> : null}
          </tr>
        </thead>
        <tbody>
          {safe.map((item, i) => {
            const options = typeof getRowOptions === 'function' ? getRowOptions(item, i) : {};
            const normalized = normalizeSectorTableRow(item, options);

            if (normalized.isStringOnly) {
              const strLink = resolveSectorFinvizLink(normalized.sector);
              const strPxUrl = strLink ? buildPerplexityEtfHoldingsUrl(strLink.ticker) : null;
              return (
                <tr key={i} className={rowClassName}>
                  {renderLeadingCell ? (
                    <td className="py-2 pr-2 pl-0 align-middle">
                      {renderLeadingCell(item, i, normalized)}
                    </td>
                  ) : null}
                  <td colSpan={3} className="px-2 py-2 align-middle">
                    <div className="flex flex-col gap-0.5">
                      <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{normalized.sector}</span>
                      {strPxUrl && (
                        <a
                          href={strPxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`10 אחזקות מובילות של ${strLink.ticker} ב-Perplexity`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-medium text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 whitespace-nowrap transition-colors"
                        >
                          🔎 בדוק אחזקות
                        </a>
                      )}
                    </div>
                  </td>
                  {renderTrailingCell ? (
                    <td className="py-2 pl-1 pr-0 w-8 align-middle opacity-0 group-hover:opacity-100 transition-opacity">
                      {renderTrailingCell(item, i, normalized)}
                    </td>
                  ) : null}
                </tr>
              );
            }

            return (
              <tr key={i} className={rowClassName} data-sector-item>
                {renderLeadingCell ? (
                  <td className="py-2 pr-2 pl-0 w-5 align-middle">
                    {renderLeadingCell(item, i, normalized)}
                  </td>
                ) : null}
                <td className="px-2 py-2 align-middle">
                  <SectorNameCell sector={normalized.sector} />
                </td>
                <td className="px-2 py-2 align-middle">
                  <SectorSentimentCell value={normalized.sentiment} />
                </td>
                <td className="px-2 py-2 align-middle">
                  <p className={`${DASHBOARD_TABLE_CELL_BODY_CLS} line-clamp-3 break-words`}>
                    {normalized.note || '—'}
                  </p>
                </td>
                {renderTrailingCell ? (
                  <td className="py-2 pl-1 pr-0 w-8 align-middle opacity-0 group-hover:opacity-100 transition-opacity">
                    {renderTrailingCell(item, i, normalized)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
