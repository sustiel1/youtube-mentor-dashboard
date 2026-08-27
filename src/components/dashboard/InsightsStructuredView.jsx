/**
 * Structured display for insights tab — display only, no extraction changes.
 */

import { Lightbulb } from 'lucide-react';
import {
  UniversalTabCheckbox,
  UniversalTabSelectRow,
} from '@/components/shared/UniversalTabSelectRow';
import { UniversalTabQuickSaveFromBulk, UniversalTabQuickSaveActions } from '@/components/shared/UniversalTabQuickSaveActions';
import { UniversalTabSectionLabelRow } from '@/components/shared/UniversalTabSectionLabelRow';
import { mergeBulkSelection, formatBulkItemText } from '@/lib/universalTabBulkItems';
import { formatInsightDisplayText, getInsightDisplayFields } from '@/lib/insightDisplay';
import { renderLinkedMarketText } from '@/components/shared/LinkedMarketText';
import { StaticVideoTimestampActions } from '@/components/shared/StaticVideoTimestampLink';
import {
  SUMMARY_CARD_CLASS,
  SUMMARY_CARD_TITLE_CLASS,
} from '@/lib/summaryCardStyles';

const INSIGHT_TEXT_CLS = 'text-base leading-[1.55] sm:text-[17px]';

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
      const fields = getInsightDisplayFields(item);
      return fields ? { ...fields, source: item } : null;
    })
    .filter(Boolean);
}

function rowSummary(row) {
  return formatInsightDisplayText(row);
}

function InsightCard({ row, videoId, productionRowId, onSaveToBrain, isSaved, bulkSelected, onBulkToggle, bulkSelection }) {
  const summary = rowSummary(row);
  const saved = isSaved ? isSaved(summary) : false;
  const pxUrl = buildPxUrl(summary);

  const quickActions = bulkSelection?.onQuickSaveBrain ? (
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
  const actions = (
    <StaticVideoTimestampActions
      videoId={videoId}
      item={row.source}
      productionRowId={productionRowId}
      section={bulkSelection?.sectionLabel || 'תובנות מרכזיות'}
      displayText={summary}
    >
      {quickActions}
    </StaticVideoTimestampActions>
  );

  return (
    <UniversalTabSelectRow
      data-insight-row
      data-static-time-candidate={videoId ? 'true' : undefined}
      className="group rounded-lg px-2 py-2.5 hover:bg-white/80 dark:hover:bg-zinc-800/60 transition-colors"
      checkbox={onBulkToggle ? (
        <UniversalTabCheckbox checked={!!bulkSelected} onChange={onBulkToggle} aria-label="בחר תובנה" />
      ) : null}
      actions={actions}
      contentClassName={row.whyImportant ? 'space-y-1.5' : undefined}
    >
      <span className={`block w-full text-right break-words whitespace-normal ${INSIGHT_TEXT_CLS}`}>
        <span className="font-semibold text-slate-900 dark:text-zinc-100">
          {renderLinkedMarketText(displayInsightText(row.lesson))}
        </span>
      </span>
      {row.whyImportant ? (
        <div className="w-full text-right leading-none">
          <div
            data-insight-why-callout
            className="inline-flex max-w-full items-start gap-1.5 rounded-md border border-s-2 border-s-sky-400 border-sky-200/80 bg-sky-50/70 px-2.5 py-1.5 text-right dark:border-s-sky-500/70 dark:border-sky-800/60 dark:bg-sky-950/25"
          >
            <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
            <span className={`min-w-0 break-words whitespace-normal text-slate-700 dark:text-zinc-200 ${INSIGHT_TEXT_CLS}`}>
              <span className="font-semibold text-sky-800 dark:text-sky-200">למה זה חשוב:</span>{' '}
              {renderLinkedMarketText(displayInsightText(row.whyImportant))}
            </span>
          </div>
        </div>
      ) : null}
    </UniversalTabSelectRow>
  );
}

function InsightList({ rows, videoId, onSaveToBrain, isSaved, bulkSelection }) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-1">
      {rows.map((row, i) => {
        const bulkId = bulkSelection ? `${bulkSelection.idPrefix}:${i}` : null;
        const summary = rowSummary(row);
        return (
          <InsightCard
            key={i}
            row={row}
            videoId={videoId}
            productionRowId={bulkId}
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
  videoId = null,
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
          const idPrefix = `${tabScope}:${key || label}`;
          const sectionChildItems = bulkSelection ? rows.map((row, i) => ({
            id: `${idPrefix}:${i}`,
            text: rowSummary(row) || formatBulkItemText(row),
            sectionLabel: label || '',
            type: tabScope,
            tabScope,
          })) : null;
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
                sectionChildItems={sectionChildItems}
              />
            ) : null}
            <InsightList
              rows={rows}
              videoId={videoId}
              onSaveToBrain={onSaveToBrain}
              isSaved={isSaved}
              bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
                idPrefix,
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
        videoId={videoId}
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
