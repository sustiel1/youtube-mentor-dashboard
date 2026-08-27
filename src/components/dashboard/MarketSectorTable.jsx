import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from './MorningBriefVisualPrimitives';
import {
  buildPerplexityEtfHoldingsUrl,
} from '@/utils/finvizLinks';
import {
  resolveSectorSentimentPresentation,
} from '@/lib/sectorTablePresentation';
import {
  resolveSectorTableFinvizLink,
  resolveSectorTableFinvizLinks,
} from '@/lib/sectorFinvizLinks';
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

export function SectorSentimentCell({ value }) {
  const presentation = resolveSectorSentimentPresentation(value);
  if (!presentation.tone) return <BriefSentimentCell value={presentation.displayValue} />;

  const positive = presentation.tone === 'positive';
  const dotClass = positive ? 'bg-emerald-500' : 'bg-orange-500';
  const textClass = positive
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-orange-700 dark:text-orange-400';

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${DASHBOARD_TABLE_CELL_BODY_CLS} ${textClass}`}>
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <span>{presentation.displayValue}</span>
    </span>
  );
}

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

function SectorFinvizName({ sector, className }) {
  const displaySector = getHebrewDisplayLabel(sector);
  const links = resolveSectorTableFinvizLinks(sector);
  const [link] = links;

  if (!link) {
    return <span className={className}>{displaySector || '—'}</span>;
  }

  if (links.length === 1) {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`פתיחת תעודת הסל ${link.ticker} ב־Finviz`}
        aria-label={`פתיחת תעודת הסל ${link.ticker} ב־Finviz`}
        className={`${className} cursor-pointer rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
        onClick={(e) => e.stopPropagation()}
        data-finviz-link={link.ticker}
      >
        {displaySector}
        <span className="ms-1 text-xs" aria-hidden>↗</span>
      </a>
    );
  }

  return (
    <span className={`${className} inline-flex flex-wrap items-center gap-x-1`}>
      {links.map((item, index) => (
        <span key={item.ticker} className="inline-flex items-center gap-x-1">
          {index > 0 ? <span aria-hidden>ו־</span> : null}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`פתיחת תעודת הסל ${item.ticker} ב־Finviz`}
            aria-label={`פתיחת ${item.label} באמצעות תעודת הסל ${item.ticker} ב־Finviz`}
            className="cursor-pointer rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            onClick={(e) => e.stopPropagation()}
            data-finviz-link={item.ticker}
          >
            {item.label}
            <span className="ms-1 text-xs" aria-hidden>↗</span>
          </a>
        </span>
      ))}
    </span>
  );
}

function SectorNameCell({ sector, showHelperLinks = true }) {
  const link = resolveSectorTableFinvizLink(sector);
  const pxUrl = showHelperLinks && link ? buildPerplexityEtfHoldingsUrl(link.ticker) : null;

  const nameNode = (
    <SectorFinvizName sector={sector} className={DASHBOARD_TABLE_CELL_PRIMARY_CLS} />
  );

  if (!pxUrl) return nameNode;

  return (
    <div className="flex flex-col gap-0.5">
      {nameNode}
      <ResearchDropdownLink
        pxUrl={pxUrl}
        titleHe={`10 אחזקות מובילות של ${link.ticker}`}
      />
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
              const strLink = resolveSectorTableFinvizLink(normalized.sector);
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
                      <SectorFinvizName
                        sector={normalized.sector}
                        className={DASHBOARD_TABLE_CELL_BODY_CLS}
                      />
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
                  <SectorSentimentCell value={normalized.sentiment} />
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
