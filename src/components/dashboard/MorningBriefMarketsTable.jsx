import {
  extractMarketDashboardRows,
  getSpecializedSrc,
  normalizeMarketDashboardRow,
} from '@/lib/morningBriefDisplay';
import { cleanupMarketDashboardRows } from '@/lib/macroDisplayCleanup';
import {
  EmptyState,
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
import { StaticVideoTimestampLink } from '@/components/shared/StaticVideoTimestampLink';
import { MarketAssetDescriptionTooltip } from '@/components/shared/MarketAssetDescriptionTooltip';
import {
  MarketAssetFuturesLink,
  MarketAssetProviderLinks,
} from '@/components/shared/MarketAssetProviderLinks';
import {
  BRIEF_MARKETS_CELL,
  BRIEF_MARKETS_COL,
  BRIEF_NOTES_TEXT_CLS,
  BRIEF_SENTIMENT_INLINE_CLS,
  BRIEF_TABLE_CLS,
  BRIEF_TABLE_HEAD_ROW_CLS,
  BriefTableWrapper,
} from './briefTableLayout';

const MARKETS_TABLE_HIDDEN_PROVIDERS = Object.freeze(['finviz']);

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
 *   נכס | גרף חוזים | קישורים | סנטימנט | שינוי % | הערה | פעולות
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
  const fromSrc = extractMarketDashboardRows(getSpecializedSrc(marketBriefData));
  const fromItems = items
    .map((item) => {
      const row = normalizeMarketDashboardRow(item);
      return row ? { ...row, rowTimestampSourceItem: item } : null;
    })
    .filter(Boolean);

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

  return (
    <BriefTableWrapper>
      <table className={BRIEF_TABLE_CLS} dir="rtl" data-markets-table>
        <colgroup>
          <col style={{ width: BRIEF_MARKETS_COL.asset }} />
          <col style={{ width: BRIEF_MARKETS_COL.futures }} />
          <col style={{ width: BRIEF_MARKETS_COL.links }} />
          <col style={{ width: BRIEF_MARKETS_COL.sentiment }} />
          <col style={{ width: BRIEF_MARKETS_COL.change }} />
          <col />
          <col style={{ width: BRIEF_MARKETS_COL.actions }} />
        </colgroup>
        <thead>
          <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
            <th className={`${BRIEF_MARKETS_CELL.asset} whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>נכס</th>
            <th className={`${BRIEF_MARKETS_CELL.futures} whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>גרף חוזים</th>
            <th className={`${BRIEF_MARKETS_CELL.links} whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>קישורים</th>
            <th className={`${BRIEF_MARKETS_CELL.sentiment} whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
            <th className={`${BRIEF_MARKETS_CELL.change} whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>שינוי %</th>
            <th className={`${BRIEF_MARKETS_CELL.notes} ${DASHBOARD_TABLE_HEAD_CLS}`}>הערה</th>
            <th className={`${BRIEF_MARKETS_CELL.actions} whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const summary = formatRowText(row);
            const timestampSourceItems = fromItems
              .filter((candidate) => String(candidate.asset || '').trim() === String(row.asset || '').trim())
              .map((candidate) => candidate.rowTimestampSourceItem);
            const pct = getMarketChangePct(row);
            const sentKey = marketRowSentimentKey(row);
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
                <td className={BRIEF_MARKETS_CELL.asset}>
                  <div className="flex min-w-0 items-start gap-2">
                    <MorningBriefBulkCheckbox
                      bulkSections={bulkSections}
                      sectionKey="markets"
                      text={summary}
                      sectionLabel="📈 שווקים"
                      tabKey="indices"
                      bulkSelection={bulkSelection}
                    />
                    <span className={`block shrink-0 whitespace-nowrap ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
                      <MarketAssetDescriptionTooltip
                        asset={row.asset}
                        showInfoButton={false}
                        showQualifier={false}
                      >
                        {row.asset || '—'}
                      </MarketAssetDescriptionTooltip>
                    </span>
                  </div>
                </td>
                <td className={BRIEF_MARKETS_CELL.futures} data-markets-futures-cell>
                  <MarketAssetFuturesLink asset={row.asset} />
                </td>
                <td className={`${BRIEF_MARKETS_CELL.links} min-w-0`} data-markets-provider-links-cell>
                  <MarketAssetProviderLinks
                    asset={row.asset}
                    hiddenProviders={MARKETS_TABLE_HIDDEN_PROVIDERS}
                  />
                </td>
                <td className={`${BRIEF_MARKETS_CELL.sentiment} whitespace-nowrap overflow-hidden`}>
                  <MarketsTableSentimentBadge sentKey={sentKey} />
                </td>
                <td className={`${BRIEF_MARKETS_CELL.change} whitespace-nowrap overflow-hidden`}>
                  {pct ? (
                    <NumericChangeSpan display={{ ...pct, arrow: null }} />
                  ) : (
                    <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>
                  )}
                </td>
                <td className={BRIEF_MARKETS_CELL.notes}>
                  <p className={`${BRIEF_NOTES_TEXT_CLS} line-clamp-3`}>
                    {renderLinkedMarketText(row.comment) || '—'}
                  </p>
                </td>
                <td className={`${BRIEF_MARKETS_CELL.actions} whitespace-nowrap`} data-markets-actions-cell>
                  <div className="inline-flex items-center justify-center gap-1" dir="ltr">
                    <StaticVideoTimestampLink
                      items={timestampSourceItems}
                      section="markets"
                      productionRowId={`specialized:markets:${row.asset || i}`}
                      displayText={summary}
                    />
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
