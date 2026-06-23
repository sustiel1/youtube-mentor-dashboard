import { DASHBOARD_TABLE_CELL_BODY_CLS, DASHBOARD_TABLE_HEAD_CLS } from './MorningBriefVisualPrimitives';
import {
  BRIEF_CELL,
  BRIEF_COL,
  BRIEF_NOTES_TEXT_CLS,
  BRIEF_TABLE_CLS,
  BRIEF_TABLE_HEAD_ROW_CLS,
  BriefTableWrapper,
} from './briefTableLayout';

export const BRIEF_SENT_KEY_LABEL = {
  positive: 'חיובי',
  negative: 'שלילי',
  neutral: 'ניטרלי',
};

/** Dot + colored sentiment label — shared by Sectors, Market State, and Macro Gem. */
export function BriefSentimentCell({ value }) {
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

const DEFAULT_ROW_CLS =
  'border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group';

/**
 * Shared Morning Brief table: ☐ | label | סנטימנט | הערה / סיבה | save
 * Used by Sectors and Market State for identical column alignment and styling.
 */
export function BriefSentimentNotesTable({
  labelHeader,
  notesHeader = 'הערה / סיבה',
  rows = [],
  getRowKey = (_row, i) => i,
  getRowMeta = () => ({}),
  renderLabelCell,
  renderSentimentValue,
  renderNotesCell,
  renderLeadingCell = null,
  renderTrailingCell = null,
  rowClassName = DEFAULT_ROW_CLS,
  rowDataAttr = null,
}) {
  const safe = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!safe.length) return null;

  return (
    <BriefTableWrapper>
      <table className={BRIEF_TABLE_CLS} dir="rtl">
        <colgroup>
          {renderLeadingCell ? <col style={{ width: BRIEF_COL.checkbox }} /> : null}
          <col style={{ width: BRIEF_COL.primaryLabel }} />
          <col style={{ width: BRIEF_COL.sentiment }} />
          <col />
          {renderTrailingCell ? <col style={{ width: BRIEF_COL.save }} /> : null}
        </colgroup>
        <thead>
          <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
            {renderLeadingCell ? <th className="py-1.5 pr-2 pl-0" aria-label="בחירה" /> : null}
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>{labelHeader}</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>{notesHeader}</th>
            {renderTrailingCell ? <th className="py-1.5 pl-1 pr-0" aria-label="שמירה" /> : null}
          </tr>
        </thead>
        <tbody>
          {safe.map((row, i) => {
            const meta = getRowMeta(row, i) || {};
            const sentimentValue = renderSentimentValue(row, i);
            const rowProps = rowDataAttr ? { [rowDataAttr.attr]: rowDataAttr.value } : {};

            return (
              <tr key={getRowKey(row, i)} className={rowClassName} {...rowProps}>
                {renderLeadingCell ? (
                  <td className={BRIEF_CELL.checkbox}>
                    {renderLeadingCell(row, i, meta)}
                  </td>
                ) : null}
                <td className={BRIEF_CELL.short}>
                  {renderLabelCell(row, i)}
                </td>
                <td className={BRIEF_CELL.sentiment}>
                  <BriefSentimentCell value={sentimentValue} />
                </td>
                <td className={BRIEF_CELL.notes}>
                  {renderNotesCell(row, i)}
                </td>
                {renderTrailingCell ? (
                  <td className={BRIEF_CELL.save}>
                    {renderTrailingCell(row, i, meta)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </BriefTableWrapper>
  );
}

export { BRIEF_NOTES_TEXT_CLS };
