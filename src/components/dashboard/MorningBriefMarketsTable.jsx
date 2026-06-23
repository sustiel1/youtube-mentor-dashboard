import {
  extractMarketDashboardRows,
  getSpecializedSrc,
  normalizeMarketDashboardRow,
} from '@/lib/morningBriefDisplay';
import { cleanupMarketDashboardRows } from '@/lib/macroDisplayCleanup';
import {
  EmptyState,
  NumericChangeSpan,
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
  COMPARISON_ROW_HOVER,
} from './MorningBriefVisualPrimitives';
import {
  getDirectionFromText,
  getMarketChangeStrengthParts,
  toneStyles,
  TONE,
} from '@/lib/morningBriefVisuals';
import { MorningBriefBulkCheckbox } from './MorningBriefBulkCheckbox';
import { UniversalTabQuickSaveFromBulk } from '@/components/shared/UniversalTabQuickSaveActions';
import { mergeBulkSelection } from '@/lib/universalTabBulkItems';
import {
  BRIEF_CELL,
  BRIEF_COL,
  BRIEF_NOTES_TEXT_CLS,
  BRIEF_SENTIMENT_INLINE_CLS,
  BRIEF_TABLE_CLS,
  BRIEF_TABLE_HEAD_ROW_CLS,
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

/**
 * Morning Brief markets table: ☐ | נכס | שינוי / חוזק | סנטימנט | הערה | 💾
 * Checkbox always first column, save always last column.
 */
export function MorningBriefMarketsTable({
  marketBriefData,
  items = [],
  onSaveToBrain,
  showEmpty = true,
  bulkSelection = null,
  bulkSections = [],
}) {
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

  const renderChangeStrength = (row) => {
    const parts = getMarketChangeStrengthParts(row);
    if (parts.length === 0) return null;
    return (
      <span className="inline-flex items-center gap-x-2 whitespace-nowrap justify-end">
        {parts.map((part, idx) => (
          <NumericChangeSpan key={`part-${idx}`} display={part} />
        ))}
      </span>
    );
  };

  const rowDirection = (row) => getDirectionFromText(
    [row.trend, row.strength, row.comment].filter(Boolean).join(' '),
  );
  const rowBorder = (row) => toneStyles(rowDirection(row).tone).border;
  const formatRowText = (row) => [row.asset, row.trend, row.strength, row.comment].filter(Boolean).join(' · ');

  const hasQuickSave = (sel) =>
    sel?.onQuickSaveBrain || sel?.onQuickSaveObsidian || sel?.onQuickSaveWorkspace;

  return (
    <BriefTableWrapper>
      <table className={BRIEF_TABLE_CLS} dir="rtl">
        <colgroup>
          <col style={{ width: BRIEF_COL.checkbox }} />
          <col style={{ width: BRIEF_COL.asset }} />
          <col style={{ width: BRIEF_COL.change }} />
          <col style={{ width: BRIEF_COL.sentiment }} />
          <col />
          <col style={{ width: BRIEF_COL.save }} />
        </colgroup>
        <thead>
          <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
            <th className="py-1.5 pr-2 pl-0" aria-label="בחירה" />
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>נכס</th>
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>שינוי / חוזק</th>
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הערה</th>
            <th className="py-1.5 pl-1 pr-0" aria-label="שמירה" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const summary = formatRowText(row);
            const changeEl = renderChangeStrength(row);
            const direction = rowDirection(row);
            const sentKey = marketsToneToSentKey(direction.tone);
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
                className={`border-b border-slate-200/70 dark:border-zinc-700/50 ${COMPARISON_ROW_HOVER} group border-r-2 ${rowBorder(row)}`}
              >
                <td className={BRIEF_CELL.checkbox}>
                  <MorningBriefBulkCheckbox
                    bulkSections={bulkSections}
                    sectionKey="markets"
                    text={summary}
                    sectionLabel="📈 שווקים"
                    tabKey="indices"
                    bulkSelection={bulkSelection}
                  />
                </td>
                <td className={`${BRIEF_CELL.short} ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
                  {row.asset || '—'}
                </td>
                <td className={BRIEF_CELL.change}>
                  {changeEl || <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>}
                </td>
                <td className={BRIEF_CELL.sentiment}>
                  <MarketsTableSentimentBadge sentKey={sentKey} />
                </td>
                <td className={BRIEF_CELL.notes}>
                  <p className={`${BRIEF_NOTES_TEXT_CLS} line-clamp-3`}>
                    {row.comment || '—'}
                  </p>
                </td>
                <td className={BRIEF_CELL.save}>
                  {hasQuickSave(bulkSelection) ? (
                    <UniversalTabQuickSaveFromBulk bulkSelection={mergedBulk} text={summary} />
                  ) : onSaveToBrain ? (
                    <button
                      type="button"
                      onClick={() => onSaveToBrain(summary)}
                      title="שמור למוח"
                      className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm leading-none transition-colors"
                    >
                      🧠
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </BriefTableWrapper>
  );
}
