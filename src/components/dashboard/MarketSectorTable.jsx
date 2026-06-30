import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from './MorningBriefVisualPrimitives';
import {
  buildPerplexityEtfHoldingsUrl,
  getSectorFinvizUrl,
  resolveSectorFinvizLink,
} from '@/utils/finvizLinks';
import { ResearchDropdownLink } from '@/components/shared/ResearchDropdown';
import {
  BRIEF_CELL,
  BRIEF_COL,
  BRIEF_NOTES_TEXT_CLS,
  BRIEF_TABLE_CLS,
  BRIEF_TABLE_HEAD_ROW_CLS,
  BriefTableWrapper,
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
    sentiment: sentimentLabel,
    note: noteText,
    rowText: [sector, sentimentLabel, noteText].filter(Boolean).join(' · '),
    isStringOnly: false,
  };
}

function SectorNameCell({ sector, showHelperLinks = true }) {
  const displaySector = getHebrewDisplayLabel(sector);
  if (!showHelperLinks) {
    return <span className={DASHBOARD_TABLE_CELL_PRIMARY_CLS}>{displaySector || '—'}</span>;
  }

  const link = resolveSectorFinvizLink(sector);
  const finvizUrl = link?.url ?? getSectorFinvizUrl(sector);
  const pxUrl = showHelperLinks && link ? buildPerplexityEtfHoldingsUrl(link.ticker) : null;

  return (
    <div className={showHelperLinks ? 'flex flex-col gap-0.5' : undefined}>
      {finvizUrl ? (
        <a
          href={finvizUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="פתח ב-Finviz ↗"
          className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline cursor-pointer`}
          onClick={(e) => e.stopPropagation()}
          data-finviz-link={link?.ticker || ''}
        >
          {displaySector}
        </a>
      ) : (
        <span className={DASHBOARD_TABLE_CELL_PRIMARY_CLS}>{displaySector || '—'}</span>
      )}
      {pxUrl && (
        <ResearchDropdownLink
          pxUrl={pxUrl}
          titleHe={`10 אחזקות מובילות של ${link.ticker}`}
        />
      )}
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
}) {
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

            if (normalized.isStringOnly) {
              const strLink = resolveSectorFinvizLink(normalized.sector);
              const strFinvizUrl = strLink?.url ?? getSectorFinvizUrl(normalized.sector);
              const strPxUrl = showHelperLinks && strLink ? buildPerplexityEtfHoldingsUrl(strLink.ticker) : null;
              return (
                <tr key={i} className={rowClassName}>
                  {renderLeadingCell ? (
                    <td className={BRIEF_CELL.checkbox}>
                      {renderLeadingCell(item, i, normalized)}
                    </td>
                  ) : null}
                  <td colSpan={4} className={BRIEF_CELL.notes}>
                    <div className={showHelperLinks ? 'flex flex-col gap-0.5' : undefined}>
                      {strFinvizUrl ? (
                        <a
                          href={strFinvizUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="פתח ב-Finviz ↗"
                          className={`${DASHBOARD_TABLE_CELL_BODY_CLS} hover:underline cursor-pointer`}
                          onClick={(e) => e.stopPropagation()}
                          data-finviz-link={strLink?.ticker || ''}
                        >
                          {getHebrewDisplayLabel(normalized.sector)}
                        </a>
                      ) : (
                        <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{getHebrewDisplayLabel(normalized.sector)}</span>
                      )}
                      {strPxUrl && (
                        <ResearchDropdownLink
                          pxUrl={strPxUrl}
                          titleHe={`10 אחזקות מובילות של ${strLink.ticker}`}
                        />
                      )}
                    </div>
                  </td>
                  {renderTrailingCell ? (
                    <td className={BRIEF_CELL.save}>
                      {renderTrailingCell(item, i, normalized)}
                    </td>
                  ) : null}
                </tr>
              );
            }

            return (
              <tr key={i} className={rowClassName} data-sector-item>
                {renderLeadingCell ? (
                  <td className={BRIEF_CELL.checkbox}>
                    {renderLeadingCell(item, i, normalized)}
                  </td>
                ) : null}
                <td className={BRIEF_CELL.short}>
                  <SectorNameCell sector={normalized.sector} showHelperLinks={showHelperLinks} />
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
                {renderTrailingCell ? (
                  <td className={BRIEF_CELL.save}>
                    {renderTrailingCell(item, i, normalized)}
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
