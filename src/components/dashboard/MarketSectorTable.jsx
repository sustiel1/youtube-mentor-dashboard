import { Fragment, useState } from 'react';
import {
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from './MorningBriefVisualPrimitives';
import {
  buildPerplexityEtfHoldingsUrl,
} from '@/utils/finvizLinks';
import { resolveSectorTools } from '@/lib/sectorTools';
import { ResearchDropdownLink } from '@/components/shared/ResearchDropdown';
import {
  BRIEF_CELL,
  BRIEF_COL,
  BRIEF_NOTES_TEXT_CLS,
  BRIEF_TABLE_CLS,
  BRIEF_TABLE_HEAD_ROW_CLS,
  BriefTableWrapper,
  SemanticTableRow,
} from './briefTableLayout';
import { getHebrewDisplayLabel } from '@/lib/marketLabelTranslations';
import { BRIEF_SENT_KEY_LABEL, BriefSentimentCell } from './BriefSentimentNotesTable';

/** Column widths — matches Macro Gem sectors table. */
export const SECTOR_TABLE_MCOL = {
  checkbox: BRIEF_COL.checkbox,
  sentiment: BRIEF_COL.sentiment,
  change: BRIEF_COL.change,
  save: BRIEF_COL.save,
  name: BRIEF_COL.primaryLabel,
};

/** @deprecated Use BriefSentimentCell */
export const SectorSentimentCell = BriefSentimentCell;

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
  const sentimentFallback = options.sentKey ? BRIEF_SENT_KEY_LABEL[options.sentKey] : '';
  const sentimentLabel = sentiment || sentimentFallback;

  return {
    sector,
    sourceEtf: String(item.etf || item.sectorEtf || '').trim().toUpperCase(),
    sentiment: sentimentLabel,
    note: noteText,
    rowText: [sector, sentimentLabel, noteText].filter(Boolean).join(' · '),
    isStringOnly: false,
  };
}

function SectorNameCell({ sector, tools, showHelperLinks = true, expanded, onToggle, controlsId }) {
  const displaySector = getHebrewDisplayLabel(sector);
  const pxUrl = showHelperLinks && tools
    ? buildPerplexityEtfHoldingsUrl(tools.etf)
    : null;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={DASHBOARD_TABLE_CELL_PRIMARY_CLS}>{displaySector || '—'}</span>
        {tools ? (
          <a
            href={tools.etfDestination.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`פתח ${tools.etf} ב-Finviz`}
            className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-indigo-700 hover:underline dark:bg-zinc-800 dark:text-indigo-300"
            onClick={(event) => event.stopPropagation()}
            data-sector-etf={tools.etf}
          >
            {tools.etf}
          </a>
        ) : null}
        {tools ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={controlsId}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-300"
            data-sector-tools-toggle
          >
            כלי סקטור {expanded ? '▴' : '▾'}
          </button>
        ) : null}
      </div>
      {pxUrl ? (
        <ResearchDropdownLink
          pxUrl={pxUrl}
          titleHe={`10 אחזקות מובילות של ${tools.etf}`}
        />
      ) : null}
    </div>
  );
}

function SectorToolsPanel({ tools, id }) {
  if (!tools) return null;
  const links = [
    ...tools.researchTools,
    { id: 'tradingview-technicals', labelHe: 'RSI וניתוח טכני', provider: 'TradingView', url: tools.technicalsUrl },
  ];
  return (
    <div id={id} className="flex flex-wrap gap-2 py-2" data-sector-tools-panel>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          title={`${link.labelHe} — ${link.provider}`}
          data-sector-tool={link.id}
        >
          {link.labelHe}
        </a>
      ))}
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
  rowClassName = 'group',
  showHelperLinks = true,
}) {
  const [expandedRow, setExpandedRow] = useState(null);
  const safe = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!safe.length) return null;

  return (
    <BriefTableWrapper>
      <table className={BRIEF_TABLE_CLS} dir="rtl">
        <colgroup>
          {renderLeadingCell ? <col style={{ width: SECTOR_TABLE_MCOL.checkbox }} /> : null}
          <col style={{ width: SECTOR_TABLE_MCOL.name }} />
          <col style={{ width: SECTOR_TABLE_MCOL.sentiment }} />
          <col style={{ width: SECTOR_TABLE_MCOL.change }} />
          <col />
          {renderTrailingCell ? <col style={{ width: SECTOR_TABLE_MCOL.save }} /> : null}
        </colgroup>
        <thead>
          <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
            {renderLeadingCell ? <th className="py-1.5 pr-2 pl-0" aria-label="בחירה" /> : null}
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סקטור</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
            <th className="py-1.5 px-2" aria-label="שינוי" />
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הערה / סיבה</th>
            {renderTrailingCell ? <th className="py-1.5 pl-1 pr-0" aria-label="שמירה" /> : null}
          </tr>
        </thead>
        <tbody>
          {safe.map((item, i) => {
            const options = typeof getRowOptions === 'function' ? getRowOptions(item, i) : {};
            const normalized = normalizeSectorTableRow(item, options);
            const tools = resolveSectorTools({
              sector: normalized.sector,
              etf: normalized.sourceEtf,
            });
            const rowKey = `sector-${i}`;
            const controlsId = `sector-tools-${i}`;
            const expanded = expandedRow === rowKey;
            const nameCell = (
              <SectorNameCell
                sector={normalized.sector}
                tools={tools}
                showHelperLinks={showHelperLinks}
                expanded={expanded}
                controlsId={controlsId}
                onToggle={() => setExpandedRow(expanded ? null : rowKey)}
              />
            );
            const toolsRow = expanded && tools ? (
              <tr className="border-b border-slate-200/70 bg-slate-50/60 dark:border-zinc-700/50 dark:bg-zinc-900/60">
                <td colSpan={4 + (renderLeadingCell ? 1 : 0) + (renderTrailingCell ? 1 : 0)} className="px-3">
                  <SectorToolsPanel tools={tools} id={controlsId} />
                </td>
              </tr>
            ) : null;

            if (normalized.isStringOnly) {
              return (
                <Fragment key={rowKey}>
                  <SemanticTableRow evidence={{}} className={rowClassName} data-sector-item>
                    {renderLeadingCell ? (
                      <td className={BRIEF_CELL.checkbox}>
                        {renderLeadingCell(item, i, normalized)}
                      </td>
                    ) : null}
                    <td colSpan={4} className={BRIEF_CELL.notes}>{nameCell}</td>
                    {renderTrailingCell ? (
                      <td className={BRIEF_CELL.save}>
                        {renderTrailingCell(item, i, normalized)}
                      </td>
                    ) : null}
                  </SemanticTableRow>
                  {toolsRow}
                </Fragment>
              );
            }

            return (
              <Fragment key={rowKey}>
                <SemanticTableRow
                  evidence={{
                    direction: item?.direction,
                    sentiment: item?.sentiment || options.sentKey,
                    trend: item?.trend,
                    changePercent: item?.changePercent,
                  }}
                  className={rowClassName}
                  data-sector-item
                >
                  {renderLeadingCell ? (
                    <td className={BRIEF_CELL.checkbox}>
                      {renderLeadingCell(item, i, normalized)}
                    </td>
                  ) : null}
                  <td className={BRIEF_CELL.short}>{nameCell}</td>
                  <td className={BRIEF_CELL.sentiment}>
                    <BriefSentimentCell value={normalized.sentiment} />
                  </td>
                  <td className={BRIEF_CELL.change} />
                  <td className={BRIEF_CELL.notes}>
                    <p className={`${BRIEF_NOTES_TEXT_CLS} line-clamp-3`}>
                      {normalized.note || '—'}
                    </p>
                  </td>
                  {renderTrailingCell ? (
                    <td className={BRIEF_CELL.save}>
                      {renderTrailingCell(item, i, normalized)}
                    </td>
                  ) : null}
                </SemanticTableRow>
                {toolsRow}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </BriefTableWrapper>
  );
}
