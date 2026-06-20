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
  COMPARISON_TABLE_HEAD_BG,
} from './MorningBriefVisualPrimitives';
import {
  getDirectionFromText,
  getMarketChangeStrengthParts,
  toneStyles,
} from '@/lib/morningBriefVisuals';
import { MorningBriefBulkCheckbox } from './MorningBriefBulkCheckbox';
import { UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS } from '@/components/shared/UniversalTabSelectRow';
import { UniversalTabQuickSaveFromBulk } from '@/components/shared/UniversalTabQuickSaveActions';
import { mergeBulkSelection } from '@/lib/universalTabBulkItems';

/**
 * Morning Brief markets table: ☐ | נכס | שינוי / חוזק | הערה | 💾
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
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 justify-end">
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
    <div dir="rtl">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col className="w-8" />
            <col className="w-[14%]" />
            <col className="w-[22%]" />
            <col />
            <col className="w-8" />
          </colgroup>
          <thead>
            <tr className={`border-b-2 border-slate-200 dark:border-zinc-700 ${COMPARISON_TABLE_HEAD_BG}`}>
              <th className="py-1.5 pr-2 pl-0 w-8" aria-label="בחירה" />
              <th className={`px-3 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>נכס</th>
              <th className={`px-3 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>שינוי / חוזק</th>
              <th className={`px-3 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הערה</th>
              <th className="py-1.5 pl-1 pr-0 w-8" aria-label="שמירה" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const summary = formatRowText(row);
              const changeEl = renderChangeStrength(row);
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
                  className={`border-b border-slate-100 dark:border-zinc-800/60 ${COMPARISON_ROW_HOVER} group border-r-2 ${rowBorder(row)}`}
                >
                  <td className="py-2 pr-2 pl-0 w-8 align-middle">
                    <MorningBriefBulkCheckbox
                      bulkSections={bulkSections}
                      sectionKey="markets"
                      text={summary}
                      sectionLabel="📈 שווקים"
                      tabKey="indices"
                      bulkSelection={bulkSelection}
                    />
                  </td>
                  <td className={`px-3 py-2.5 ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{row.asset}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">
                    {changeEl || <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>}
                  </td>
                  <td className={`px-3 py-2.5 ${DASHBOARD_TABLE_CELL_BODY_CLS}`}>{row.comment || '—'}</td>
                  <td className="py-2 pl-1 pr-0 align-middle opacity-0 group-hover:opacity-100 transition-opacity">
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
      </div>
    </div>
  );
}
