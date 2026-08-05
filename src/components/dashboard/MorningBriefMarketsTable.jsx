import {
  extractMarketDashboardRows,
  getSpecializedSrc,
  normalizeMarketDashboardRow,
} from '@/lib/morningBriefDisplay';
import { cleanupMarketDashboardRows } from '@/lib/macroDisplayCleanup';
import { resolveMorningBriefPresentation } from '@/lib/morningBriefPresentation';
import {
  EmptyState,
  ExternalSymbolLink,
  NumericChangeSpan,
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from './MorningBriefVisualPrimitives';
import {
  formatMarketChange,
  getDirectionFromText,
  toneStyles,
  TONE,
} from '@/lib/morningBriefVisuals';
import { MorningBriefBulkCheckbox } from './MorningBriefBulkCheckbox';
import { UniversalTabQuickSaveFromBulk } from '@/components/shared/UniversalTabQuickSaveActions';
import { mergeBulkSelection } from '@/lib/universalTabBulkItems';
import { renderLinkedMarketText } from '@/components/shared/LinkedMarketText';
import { buildTradingViewChartUrl } from '@/utils/finvizLinks';
import {
  BRIEF_CELL,
  BRIEF_MARKETS_COL,
  BRIEF_NOTES_TEXT_CLS,
  BRIEF_SENTIMENT_INLINE_CLS,
  BRIEF_TABLE_CLS,
  BRIEF_TABLE_HEAD_ROW_CLS,
  BRIEF_TABLE_LINK_CLS,
  BriefTableWrapper,
} from './briefTableLayout';

const MARKETS_SENTIMENT_STYLE = {
  positive: { dot: 'bg-emerald-500', label: 'חיובי' },
  negative: { dot: 'bg-red-500', label: 'שלילי' },
  neutral: { dot: 'bg-amber-400', label: 'ניטרלי' },
};

function marketsToneToSentKey(tone) {
  if (tone === TONE.BULLISH) return 'positive';
  if (tone === TONE.BEARISH) return 'negative';
  return 'neutral';
}

/** Sentiment key for a market row — shared with MarketsSection header pills. */
export function marketRowSentimentKey(row) {
  const direction = getDirectionFromText(
    [row.trend, row.strength, row.comment].filter(Boolean).join(' '),
  );
  return marketsToneToSentKey(direction.tone);
}

/** Matches Morning Brief InlineSentimentBadge (dot + dark text, RTL). */
function MarketsTableSentimentBadge({ sentKey }) {
  const style = MARKETS_SENTIMENT_STYLE[sentKey];
  if (!style) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap ${BRIEF_SENTIMENT_INLINE_CLS} shrink-0`}
      dir="rtl"
    >
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${style.dot}`} aria-hidden />
      <span>{style.label}</span>
    </span>
  );
}

const _SEP = <span className="text-slate-300 dark:text-zinc-600 select-none mx-0.5" aria-hidden>·</span>;

function MarketRowSaveActions({ bulkSelection, mergedBulk, text, onSaveToBrain }) {
  const hasQuick =
    bulkSelection?.onQuickSaveBrain
    || bulkSelection?.onQuickSaveObsidian
    || bulkSelection?.onQuickSaveWorkspace;
  if (hasQuick) {
    return <UniversalTabQuickSaveFromBulk bulkSelection={mergedBulk} text={text} />;
  }
  if (!onSaveToBrain) return null;
  return (
    <button
      type="button"
      onClick={() => onSaveToBrain(text)}
      title="שמור למוח"
      className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm leading-none transition-colors opacity-100 max-md:opacity-90 md:opacity-0 md:group-hover:opacity-100"
    >
      🧠
    </button>
  );
}

/**
 * Morning Brief markets table — RTL reading order (right → left):
 *   נכס | סנטימנט | שינוי % | הערה | פעולות (☐ + TV/Inv + save on screen-left)
 * Asset cell is text-only; all row actions live in the far-left פעולות column.
 */
export function MorningBriefMarketsTable({
  marketBriefData,
  items = [],
  onSaveToBrain,
  showEmpty = true,
  bulkSelection = null,
  bulkSections = [],
  presentation,
}) {
  const ui = resolveMorningBriefPresentation(presentation);
  const showExternalLinks = ui.showStockExternalLinks;

  const fromSrc = extractMarketDashboardRows(getSpecializedSrc(marketBriefData));
  const fromItems = items.map((i) => normalizeMarketDashboardRow(i)).filter(Boolean);

  const seen = new Set();
  const merged = [...fromSrc, ...fromItems].filter((r) => {
    const sig = `${r.asset}|${r.trend}|${r.strength}|${r.comment}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  const rows = cleanupMarketDashboardRows(merged);

  if (rows.length === 0) {
    return showEmpty ? <EmptyState message="אין נתוני שווקים — יוצגו כאן מדדים ומניות-מדד" /> : null;
  }

  const getMarketChangePct = (row) => {
    const contextBlob = [row.trend, row.strength, row.comment].filter(Boolean).join(' ');
    const strengthVal = String(row?.strength ?? '').trim();
    const trendVal = String(row?.trend ?? '').trim();
    return formatMarketChange(strengthVal, contextBlob) || formatMarketChange(trendVal, contextBlob);
  };

  const formatRowText = (row) => [row.asset, row.trend, row.strength, row.comment].filter(Boolean).join(' · ');

  const actionsColWidth = showExternalLinks ? '20%' : '8%';

  return (
    <BriefTableWrapper>
      <table className={BRIEF_TABLE_CLS} dir="rtl" data-markets-table>
        <colgroup>
          <col style={{ width: BRIEF_MARKETS_COL.asset }} />
          <col style={{ width: BRIEF_MARKETS_COL.sentiment }} />
          <col style={{ width: BRIEF_MARKETS_COL.change }} />
          <col />
          <col style={{ width: actionsColWidth }} />
        </colgroup>
        <thead>
          <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>נכס</th>
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>שינוי %</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הערה</th>
            <th className={`py-1.5 pl-1 pr-0 text-left whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const summary = formatRowText(row);
            const pct = getMarketChangePct(row);
            const sentKey = marketRowSentimentKey(row);
            const assetName = String(row.asset || '').trim();
            const tvUrl = assetName ? buildTradingViewChartUrl(assetName) : null;
            const mergedBulk = bulkSelection
              ? mergeBulkSelection(bulkSelection, {
                  sectionLabel: '📈 שווקים',
                  type: 'indices',
                  tabScope: 'specialized',
                })
              : null;

            return (
              <tr
                key={i}
                className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group"
                data-market-item
              >
                <td className={BRIEF_CELL.short}>
                  <span className={`block truncate ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
                    <ExternalSymbolLink symbol={row.asset}>
                      {row.asset || '—'}
                    </ExternalSymbolLink>
                  </span>
                </td>
                <td className={BRIEF_CELL.sentiment}>
                  <MarketsTableSentimentBadge sentKey={sentKey} />
                </td>
                <td className={BRIEF_CELL.change}>
                  {pct ? (
                    <NumericChangeSpan display={{ ...pct, arrow: null }} />
                  ) : (
                    <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>
                  )}
                </td>
                <td className={BRIEF_CELL.notes}>
                  <p className={`${BRIEF_NOTES_TEXT_CLS} line-clamp-3`}>
                    {renderLinkedMarketText(row.comment) || '—'}
                  </p>
                </td>
                <td className="py-2 pl-1 pr-2 align-middle whitespace-nowrap text-left" data-markets-actions-cell>
                  <div className="inline-flex items-center justify-start gap-x-1.5" dir="ltr">
                    <MorningBriefBulkCheckbox
                      bulkSections={bulkSections}
                      sectionKey="markets"
                      text={summary}
                      sectionLabel="📈 שווקים"
                      tabKey="indices"
                      bulkSelection={bulkSelection}
                    />
                    {showExternalLinks && tvUrl ? (
                      <span className="inline-flex items-center gap-x-0.5 text-xs font-medium">
                        <a
                          href={tvUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={BRIEF_TABLE_LINK_CLS}
                          onClick={(e) => e.stopPropagation()}
                        >
                          TV
                        </a>
                        {_SEP}
                        <a
                          href={`https://www.investing.com/search/?q=${encodeURIComponent(assetName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={BRIEF_TABLE_LINK_CLS}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Inv
                        </a>
                        {_SEP}
                        <a
                          href={`https://il.investing.com/search/?q=${encodeURIComponent(assetName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={BRIEF_TABLE_LINK_CLS}
                          onClick={(e) => e.stopPropagation()}
                        >
                          InvIL
                        </a>
                      </span>
                    ) : null}
                    <MarketRowSaveActions
                      bulkSelection={bulkSelection}
                      mergedBulk={mergedBulk}
                      text={summary}
                      onSaveToBrain={onSaveToBrain}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </BriefTableWrapper>
  );
}
