import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from './MorningBriefVisualPrimitives';
import { Fragment, useState } from 'react';
import {
  buildPerplexityEtfHoldingsUrl,
  FINVIZ_SECTOR_OVERVIEW_URL,
  resolveSectorDestination,
} from '@/utils/finvizLinks';
import { ResearchDropdownLink } from '@/components/shared/ResearchDropdown';
import { TradingViewSymbolAction } from '@/components/shared/TradingViewSymbolAction';
import { ExternalResourceAction } from '@/components/shared/ExternalResourceAction';
import {
  BRIEF_CELL,
  BRIEF_COL,
  BRIEF_NOTES_TEXT_CLS,
  BRIEF_TABLE_CLS,
  BRIEF_TABLE_HEAD_ROW_CLS,
  SemanticTableRow,
  BriefTableWrapper,
} from './briefTableLayout';
import { getHebrewDisplayLabel } from '@/lib/marketLabelTranslations';
import { resolveSectorTechnicals } from '@/lib/sectorTechnicals';
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
      sourceEtf: '',
      legacyEtf: '',
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
    sentiment: sentimentLabel,
    note: noteText,
    rowText: [sector, sentimentLabel, noteText].filter(Boolean).join(' · '),
    isStringOnly: false,
    sourceEtf: String(item.etf || '').trim(),
    legacyEtf: String(item.sectorEtf || item.representativeEtf || item.metadata?.etf || '').trim(),
  };
}

function SectorEtfAction({ destination, displaySector }) {
  if (!destination?.etfUrl || !destination.representativeEtf) return null;
  const ticker = destination.representativeEtf;
  const tooltip = `פתח את גרף ${ticker}, תעודת הסל המייצגת את סקטור ${displaySector}, ב־Finviz`;
  return (
    <ExternalResourceAction
      href={destination.etfUrl}
      label={<>ETF: {ticker} <span aria-hidden="true">↗</span></>}
      title={tooltip}
      ariaLabel={tooltip}
      dataAttributes={{
        'data-sector-etf-action': ticker,
        'data-sector-resolution-source': destination.resolutionSource,
      }}
    />
  );
}

function SectorTechnicalsAction({ normalized, displaySector }) {
  const destination = resolveSectorTechnicals(normalized);
  if (!destination) return null;
  const tooltip = `פתח RSI וניתוח טכני עבור ${displaySector}, באמצעות ETF ${destination.etf}, ב־TradingView`;
  return (
    <ExternalResourceAction
      href={destination.url}
      label="RSI וניתוח טכני"
      title={tooltip}
      ariaLabel={tooltip}
      dataAttributes={{
        'data-sector-technicals-action': destination.etf,
        'data-sector-technicals-source': destination.resolutionSource,
      }}
    />
  );
}

function SectorNameCell({ normalized }) {
  const { sector } = normalized;
  const displaySector = getHebrewDisplayLabel(sector);

  const nameNode = (
    <a
      href={FINVIZ_SECTOR_OVERVIEW_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="פתח את טבלת ביצועי הסקטורים ב־Finviz"
      aria-label={`פתח את סקירת ביצועי הסקטורים עבור ${displaySector} באתר Finviz`}
      className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline cursor-pointer`}
      onClick={(e) => e.stopPropagation()}
      data-finviz-sector-overview
    >
      {displaySector}
    </a>
  );

  return nameNode;
}

function SectorToolsTrigger({ open, onToggle, panelId, triggerId, checkbox }) {
  return (
    <div className="flex min-h-8 items-center justify-center gap-2" data-sector-tools-trigger-cell>
      {checkbox}
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(event) => { event.stopPropagation(); onToggle(); }}
        onKeyDown={(event) => event.stopPropagation()}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        data-sector-tools-trigger
      >
        <span className="hidden sm:inline">כלים וגרפים</span>
        <span className="sm:hidden">כלים</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
    </div>
  );
}

function SectorToolsPanel({
  normalized,
  displaySector,
  destination,
  panelId,
  triggerId,
  saveAction,
  showHelperLinks,
}) {
  const technicals = resolveSectorTechnicals(normalized);
  const researchUrl = showHelperLinks && destination.representativeEtf
    ? buildPerplexityEtfHoldingsUrl(destination.representativeEtf)
    : null;

  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={triggerId}
      className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white/80 p-3 sm:flex sm:flex-wrap sm:items-center dark:border-zinc-700 dark:bg-zinc-900/80"
      data-sector-tools-panel
    >
      {destination.representativeEtf ? (
        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200" data-sector-etf-identity>
          תעודת הסל של הסקטור: {destination.representativeEtf}
        </span>
      ) : null}
      <TradingViewSymbolAction asset={destination.representativeEtf || normalized.sector} />
      <SectorEtfAction destination={destination} displaySector={displaySector} />
      <SectorTechnicalsAction normalized={normalized} displaySector={displaySector} />
      {researchUrl ? (
        <ResearchDropdownLink
          pxUrl={researchUrl}
          titleHe={`10 אחזקות מובילות של ${destination.representativeEtf}`}
        />
      ) : null}
      {saveAction}
      {!destination.representativeEtf && !technicals && !researchUrl && !saveAction ? (
        <span className="text-xs text-slate-500 dark:text-zinc-400">לא נמצאו כלים מאומתים לסקטור זה</span>
      ) : null}
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
  showHelperLinks = true,
  actionsColumn = false,
}) {
  const [openRowIndex, setOpenRowIndex] = useState(null);
  const safe = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!safe.length) return null;

  return (
    <BriefTableWrapper>
      <table className={actionsColumn ? 'w-full text-right border-collapse table-fixed' : BRIEF_TABLE_CLS} dir="rtl" data-sector-table>
        <colgroup>
          {renderLeadingCell && !actionsColumn ? <col style={{ width: SECTOR_TABLE_MCOL.checkbox }} /> : null}
          <col style={{ width: SECTOR_TABLE_MCOL.name }} />
          <col style={{ width: SECTOR_TABLE_MCOL.sentiment }} />
          <col style={{ width: SECTOR_TABLE_MCOL.change }} />
          <col />
          {(renderTrailingCell || actionsColumn) ? (
            actionsColumn
              ? <col className="w-[22%] sm:w-[14%]" />
              : <col style={{ width: SECTOR_TABLE_MCOL.save }} />
          ) : null}
        </colgroup>
        <thead>
          <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
            {renderLeadingCell && !actionsColumn ? <th className="py-1.5 pr-2 pl-0" aria-label="בחירה" /> : null}
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סקטור</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
            <th className="py-1.5 px-2" aria-label="שינוי" />
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הערה / סיבה</th>
            {(renderTrailingCell || actionsColumn) ? (
              <th className={`px-2 py-1.5 text-center whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>
                {actionsColumn ? 'כלים וגרפים' : ''}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {safe.map((item, i) => {
            const options = typeof getRowOptions === 'function' ? getRowOptions(item, i) : {};
            const normalized = normalizeSectorTableRow(item, options);
            const destination = resolveSectorDestination(normalized);
            const displaySector = getHebrewDisplayLabel(normalized.sector);
            const disclosureOpen = openRowIndex === i;
            const panelId = `sector-tools-panel-${i}`;
            const triggerId = `sector-tools-trigger-${i}`;
            const toolsTrigger = actionsColumn ? (
              <SectorToolsTrigger
                open={disclosureOpen}
                onToggle={() => setOpenRowIndex((current) => current === i ? null : i)}
                panelId={panelId}
                triggerId={triggerId}
                checkbox={renderLeadingCell?.(item, i, normalized)}
              />
            ) : null;
            const toolsPanel = actionsColumn && disclosureOpen ? (
              <SectorToolsPanel
                normalized={normalized}
                displaySector={displaySector}
                destination={destination}
                panelId={panelId}
                triggerId={triggerId}
                saveAction={renderTrailingCell?.(item, i, normalized)}
                showHelperLinks={showHelperLinks}
              />
            ) : null;

            if (normalized.isStringOnly) {
              const strPxUrl = showHelperLinks && destination.representativeEtf
                ? buildPerplexityEtfHoldingsUrl(destination.representativeEtf)
                : null;
              return (
                <Fragment key={i}>
                <SemanticTableRow evidence={normalized} className={rowClassName}>
                  {renderLeadingCell && !actionsColumn ? (
                    <td className={BRIEF_CELL.checkbox}>
                      {renderLeadingCell(item, i, normalized)}
                    </td>
                  ) : null}
                  <td colSpan={4} className={BRIEF_CELL.notes}>
                    <div className={showHelperLinks ? 'flex flex-col gap-0.5' : undefined}>
                      <div className="flex flex-wrap items-center gap-1.5">
                      {normalized.sector ? (
                        <a
                          href={FINVIZ_SECTOR_OVERVIEW_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="פתח את טבלת ביצועי הסקטורים ב־Finviz"
                          aria-label={`פתח את סקירת ביצועי הסקטורים עבור ${displaySector} באתר Finviz`}
                          className={`${DASHBOARD_TABLE_CELL_BODY_CLS} hover:underline cursor-pointer`}
                          onClick={(e) => e.stopPropagation()}
                          data-finviz-sector-overview
                        >
                          {displaySector}
                        </a>
                      ) : (
                        <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{getHebrewDisplayLabel(normalized.sector)}</span>
                      )}
                        {!actionsColumn ? <TradingViewSymbolAction asset={destination.representativeEtf || normalized.sector} /> : null}
                        {!actionsColumn ? <SectorEtfAction destination={destination} displaySector={displaySector} /> : null}
                        {!actionsColumn ? <SectorTechnicalsAction normalized={normalized} displaySector={displaySector} /> : null}
                      </div>
                      {!actionsColumn && strPxUrl && (
                        <ResearchDropdownLink
                          pxUrl={strPxUrl}
                          titleHe={`10 אחזקות מובילות של ${destination.representativeEtf}`}
                        />
                      )}
                    </div>
                  </td>
                  {(renderTrailingCell || actionsColumn) ? (
                    <td className={actionsColumn ? BRIEF_CELL.actions : BRIEF_CELL.save}>
                      {actionsColumn ? toolsTrigger : renderTrailingCell(item, i, normalized)}
                    </td>
                  ) : null}
                </SemanticTableRow>
                {actionsColumn && disclosureOpen ? (
                  <tr data-sector-tools-row>
                    <td colSpan={5} className="px-2 py-2">{toolsPanel}</td>
                  </tr>
                ) : null}
                </Fragment>
              );
            }

            return (
              <Fragment key={i}>
              <SemanticTableRow evidence={normalized} className={rowClassName} data-sector-item>
                {renderLeadingCell && !actionsColumn ? (
                  <td className={BRIEF_CELL.checkbox}>
                    {renderLeadingCell(item, i, normalized)}
                  </td>
                ) : null}
                <td className={BRIEF_CELL.short}>
                  <SectorNameCell normalized={normalized} />
                </td>
                <td className={BRIEF_CELL.sentiment}>
                  <BriefSentimentCell value={normalized.sentiment} />
                </td>
                <td className={BRIEF_CELL.change} />
                <td className={BRIEF_CELL.notes}>
                  <p className={`${BRIEF_NOTES_TEXT_CLS} line-clamp-3`}>
                    {normalized.note || '—'}
                  </p>
                </td>
                {(renderTrailingCell || actionsColumn) ? (
                  <td className={actionsColumn ? BRIEF_CELL.actions : BRIEF_CELL.save}>
                    {actionsColumn ? toolsTrigger : renderTrailingCell(item, i, normalized)}
                  </td>
                ) : null}
              </SemanticTableRow>
              {actionsColumn && disclosureOpen ? (
                <tr data-sector-tools-row>
                  <td colSpan={5} className="px-2 py-2">{toolsPanel}</td>
                </tr>
              ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </BriefTableWrapper>
  );
}
