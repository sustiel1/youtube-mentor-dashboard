/**
 * Structured display for insights tab — display only, no extraction changes.
 */

import {
  UniversalTabCheckbox,
  UniversalTabSelectRow,
} from '@/components/shared/UniversalTabSelectRow';
import { UniversalTabQuickSaveFromBulk, UniversalTabQuickSaveActions } from '@/components/shared/UniversalTabQuickSaveActions';
import { UniversalTabSectionLabelRow } from '@/components/shared/UniversalTabSectionLabelRow';
import { mergeBulkSelection } from '@/lib/universalTabBulkItems';
import { DASHBOARD_TABLE_CELL_BODY_CLS } from './MorningBriefVisualPrimitives';
import {
  SUMMARY_CARD_CLASS,
  SUMMARY_CARD_TITLE_CLASS,
} from '@/lib/summaryCardStyles';

const COLUMNS = [
  {
    key: 'type',
    label: 'סוג',
    pick: (row) => {
      if (typeof row !== 'object' || !row) return '';
      return String(row.type || row.category || row.kind || row.insightType || row._type || '').trim();
    },
  },
  {
    key: 'insight',
    label: 'תובנה',
    pick: (row) => {
      if (typeof row === 'string') return row.trim();
      if (!row || typeof row !== 'object') return String(row ?? '').trim();
      return String(
        row.insight || row.text || row.title || row.content || row.point || row.summary || ''
      ).trim();
    },
  },
  {
    key: 'meaning',
    label: 'משמעות',
    pick: (row) => {
      if (typeof row !== 'object' || !row) return '';
      return String(
        row.meaning || row.whyImportant || row.reason || row.significance ||
        row.explanation || row.implication || ''
      ).trim();
    },
  },
  {
    key: 'action',
    label: 'פעולה אפשרית',
    pick: (row) => {
      if (typeof row !== 'object' || !row) return '';
      return String(
        row.action || row.possibleAction || row.actionable || row.suggestedAction ||
        row.nextStep || row.recommendedAction || ''
      ).trim();
    },
  },
];

function buildPxUrl(text) {
  if (!text?.trim()) return null;
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(text.trim())}`;
}

/** Presentation-only: collapse accidental per-word newlines into flowing paragraphs. */
function displayInsightText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])\n(?!\n)([^\n])/g, '$1 $2')
    .trim();
}

function normalizeRows(items = []) {
  return items
    .map((item) => {
      if (typeof item === 'string') {
        const t = item.trim();
        return t ? { insight: t } : null;
      }
      if (item && typeof item === 'object') {
        const insight = COLUMNS.find((c) => c.key === 'insight').pick(item);
        if (!insight) return null;
        return item;
      }
      return null;
    })
    .filter(Boolean);
}

function activeColumns(rows) {
  return COLUMNS.filter((col) => rows.some((row) => col.pick(row)));
}

function rowSummary(row) {
  return COLUMNS.map((c) => c.pick(row)).filter(Boolean).join(' · ');
}

function InsightCard({ row, onSaveToBrain, isSaved, bulkSelected, onBulkToggle, bulkSelection }) {
  const cols = activeColumns([row]);
  const summary = rowSummary(row);
  const saved = isSaved ? isSaved(summary) : false;
  const pxUrl = buildPxUrl(summary);

  const actions = bulkSelection?.onQuickSaveBrain ? (
    <UniversalTabQuickSaveFromBulk
      bulkSelection={bulkSelection}
      text={summary}
      brainSaved={saved}
      pxUrl={pxUrl}
    />
  ) : (summary || pxUrl) ? (
    <UniversalTabQuickSaveActions
      meta={{ text: summary, sectionLabel: 'תובנות', type: 'insights' }}
      onBrain={onSaveToBrain ? () => onSaveToBrain(summary) : undefined}
      brainSaved={saved}
      pxUrl={pxUrl}
      compact
    />
  ) : null;

  const insightOnly = cols.length === 1 && cols[0].key === 'insight';

  return (
    <UniversalTabSelectRow
      data-insight-row
      className="group rounded-lg px-2 py-2 hover:bg-white/80 dark:hover:bg-zinc-800/60 transition-colors"
      checkbox={onBulkToggle ? (
        <UniversalTabCheckbox checked={!!bulkSelected} onChange={onBulkToggle} aria-label="בחר תובנה" />
      ) : null}
      actions={actions}
      contentClassName={insightOnly ? undefined : 'space-y-2'}
    >
      {insightOnly ? (
        <span className="block w-full text-right text-sm leading-[1.7] break-words whitespace-normal">
          <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>
            {displayInsightText(cols[0].pick(row))}
          </span>
        </span>
      ) : (
        cols.map((col) => {
          const val = displayInsightText(col.pick(row));
          if (!val) return null;
          return (
            <div key={col.key} className="w-full text-right">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 leading-tight">
                {col.label}
              </span>
              <span className="mt-0.5 block w-full text-right text-sm leading-[1.7] break-words whitespace-normal">
                <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{val}</span>
              </span>
            </div>
          );
        })
      )}
    </UniversalTabSelectRow>
  );
}

function InsightList({ rows, onSaveToBrain, isSaved, bulkSelection }) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {rows.map((row, i) => {
        const bulkId = bulkSelection ? `${bulkSelection.idPrefix}:${i}` : null;
        const summary = rowSummary(row);
        return (
          <InsightCard
            key={i}
            row={row}
            onSaveToBrain={onSaveToBrain}
            isSaved={isSaved}
            bulkSelected={bulkId && bulkSelection?.multiSelected?.has(bulkId)}
            onBulkToggle={bulkId && bulkSelection?.onToggle ? () => bulkSelection.onToggle(bulkId, {
              text: summary,
              sectionLabel: bulkSelection.sectionLabel || '',
              type: bulkSelection.type || 'insights',
              tabScope: bulkSelection.tabScope || 'insights',
            }) : null}
            bulkSelection={bulkSelection}
          />
        );
      })}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {{ key, label, items }[]} props.sections — optional grouped sections
 * @param {unknown[]} props.items — flat items when no sections
 */
export function InsightsStructuredView({
  sections = [],
  items = [],
  sectionLabelClassName = SUMMARY_CARD_TITLE_CLASS,
  cardClassName = SUMMARY_CARD_CLASS,
  onSaveToBrain,
  isSaved,
  bulkSelection = null,
  tabScope = 'insights',
}) {
  const populatedSections = sections
    .map((s) => ({ ...s, rows: normalizeRows(s.items) }))
    .filter((s) => s.rows.length > 0);

  const flatRows = normalizeRows(items);

  if (populatedSections.length === 0 && flatRows.length === 0) return null;

  if (populatedSections.length > 0) {
    return (
      <div className="space-y-3" dir="rtl">
        {populatedSections.map(({ key, label, rows }) => {
          const sectionLines = rows.map((row) => rowSummary(row)).filter(Boolean);
          return (
          <div key={key || label} className={cardClassName}>
            {label ? (
              <UniversalTabSectionLabelRow
                label={label}
                items={sectionLines}
                bulkSelection={bulkSelection}
                tabScope={tabScope}
                type={tabScope}
                sectionKey={key || label}
                labelClassName={sectionLabelClassName}
              />
            ) : null}
            <InsightList
              rows={rows}
              onSaveToBrain={onSaveToBrain}
              isSaved={isSaved}
              bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
                idPrefix: `${tabScope}:${key || label}`,
                sectionLabel: label || '',
                type: tabScope,
                tabScope,
              }) : null}
            />
          </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cardClassName} dir="rtl">
      <InsightList
        rows={flatRows}
        onSaveToBrain={onSaveToBrain}
        isSaved={isSaved}
        bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
          idPrefix: `${tabScope}:flat`,
          sectionLabel: '',
          type: tabScope,
          tabScope,
        }) : null}
      />
    </div>
  );
}
