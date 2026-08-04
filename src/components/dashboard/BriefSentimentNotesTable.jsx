import { DASHBOARD_TABLE_CELL_BODY_CLS, DASHBOARD_TABLE_HEAD_CLS } from './MorningBriefVisualPrimitives';
import {
  BRIEF_CELL,
  BRIEF_COL,
  BRIEF_NOTES_TEXT_CLS,
  BRIEF_TABLE_CLS,
  BRIEF_TABLE_HEAD_ROW_CLS,
  BriefTableWrapper,
  SemanticTableRow,
} from './briefTableLayout';
import {
  resolveSemanticVisualState,
  SEMANTIC_DOT_CLASS,
  SEMANTIC_TEXT_CLASS,
} from '@/lib/specializedSemanticVisualState';

export const BRIEF_SENT_KEY_LABEL = {
  positive: 'חיובי',
  negative: 'שלילי',
  neutral: 'ניטרלי',
};

/** Dot + colored sentiment label — shared by Sectors, Market State, and Macro Gem. */
export function BriefSentimentCell({ value }) {
  if (!value) return <span className="text-slate-400 dark:text-zinc-500">—</span>;
  const state = resolveSemanticVisualState({ sentiment: value });
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${DASHBOARD_TABLE_CELL_BODY_CLS} ${SEMANTIC_TEXT_CLASS[state]}`}>
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${SEMANTIC_DOT_CLASS[state]}`} aria-hidden />
      <span>{value}</span>
    </span>
  );
}

const DEFAULT_ROW_CLS = 'group';

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
  getRowSemanticEvidence = null,
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
              <SemanticTableRow
                key={getRowKey(row, i)}
                evidence={getRowSemanticEvidence?.(row, i) || { sentiment: sentimentValue }}
                className={rowClassName}
                {...rowProps}
              >
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
              </SemanticTableRow>
            );
          })}
        </tbody>
      </table>
    </BriefTableWrapper>
  );
}

export { BRIEF_NOTES_TEXT_CLS };
