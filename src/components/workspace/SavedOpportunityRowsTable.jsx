import { useMemo, useState } from 'react';
import {
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from '@/components/dashboard/MorningBriefVisualPrimitives';
import { parseOpportunityRowLayer1 } from '@/lib/opportunityRowText';
import { PILL_CLS, ENTRY_PILL_CLS, STOP_PILL_CLS, TIMEFRAME_PILL_CLS } from '@/lib/opportunityRowVisuals';
import { resolveMarketEntityLink, findMarketEntityLinksInText } from '@/lib/marketEntityLinkResolver';
import { deriveNewsTopic } from '@/lib/newsRowVisuals';
import { NewsStyleTextRow } from '@/components/workspace/SavedNewsRows';
import { UniversalTabCheckbox } from '@/components/shared/UniversalTabSelectRow';
import { rowSelectionProps } from '@/lib/workspaceRowSelection';
import {
  getWorkspaceRecordRevealState,
  useWorkspaceRecordRevealIds,
  WORKSPACE_RECORD_REVEAL_CLASS,
} from '@/context/WorkspaceRecordRevealContext';

/**
 * Table + fallback row list for individually-saved "🎯 הזדמנויות" rows.
 *
 * Two independent producers write this itemType with different text shapes
 * (see opportunityRowText.js's doc comment). Layer-1-parseable rows (the
 * dominant morning-brief " · "+Hebrew-prefix shape) render as table rows;
 * everything else — the MacroGemDashboard `\n`-separated shape, or any text
 * that otherwise fails to segment — renders below the table using the same
 * news-style row layout as SavedNewsRows (topic chip + entity chips + text +
 * tone border), never as a table row with all-"—" trade-plan columns and
 * never as raw unstyled plain text. Both groups share the one section
 * header provided by the caller (WorkspaceFocusedVideoCard.jsx).
 *
 * No "actions" column: MarketAssetLinksMenu's provider registry
 * (marketAssetProviderLinks.js) only resolves assets it can type as
 * stock/ETF/sector from an object shape this saved-row data doesn't reliably
 * carry — for a bare ticker string it returns "—" for nearly every row here,
 * which is exactly the "dead control" the approved scope says to omit
 * instead of rendering. The ticker cell itself is already a real link (see
 * marketEntityLinkResolver.js), so no separate actions affordance is lost.
 */

const TH_CLS = `py-2.5 px-2 first:ps-0 last:pe-0 ${DASHBOARD_TABLE_HEAD_CLS}`;
const TD_CLS = 'py-2.5 px-2 align-middle first:ps-0 last:pe-0';

function FilterChip({ label, count, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
        isActive
          ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-70">· {count}</span>
    </button>
  );
}

function TickerLink({ ticker }) {
  if (!ticker) return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  const link = resolveMarketEntityLink(ticker);
  if (!link) return <span dir="ltr" className="font-bold">{ticker}</span>;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      dir="ltr"
      onClick={(event) => event.stopPropagation()}
      title={link.provider === 'finviz' ? `פתיחת ${ticker} ב־Finviz` : `פתיחת ${ticker} ב־Investing.com`}
      aria-label={link.provider === 'finviz' ? `פתיחת ${ticker} ב־Finviz` : `פתיחת ${ticker} ב־Investing.com`}
      className="font-bold text-indigo-700 underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
    >
      {ticker}
    </a>
  );
}

function ValuePill({ value, toneClass }) {
  if (!value) return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  return (
    <span dir="ltr" className={`${PILL_CLS} ${toneClass}`}>
      {value}
    </span>
  );
}

export function SavedOpportunityRowsTable({ entries = [], selectedIds, onToggleGroup }) {
  const [activeTimeframe, setActiveTimeframe] = useState('all');
  const revealIds = useWorkspaceRecordRevealIds();
  const showCheckboxCol = !!(selectedIds && onToggleGroup);

  const { tableRows, fallbackRows } = useMemo(() => {
    const table = [];
    const fallback = [];
    for (const entry of entries) {
      const text = typeof entry === 'string' ? entry : entry?.text;
      const safeText = String(text || '').trim();
      if (!safeText) continue;
      const recordIds = typeof entry === 'object' ? entry?.recordIds : null;
      const parsed = parseOpportunityRowLayer1(safeText);
      if (parsed) {
        table.push({ ...parsed, recordIds });
      } else {
        const entityLinks = findMarketEntityLinksInText(safeText);
        const topic = deriveNewsTopic(safeText, entityLinks);
        fallback.push({ text: safeText, recordIds, entityLinks, topic });
      }
    }
    return { tableRows: table, fallbackRows: fallback };
  }, [entries]);

  const { counts, filteredTableRows } = useMemo(() => {
    const c = {};
    for (const row of tableRows) {
      if (row.timeframe) c[row.timeframe] = (c[row.timeframe] || 0) + 1;
    }
    const f = activeTimeframe === 'all' ? tableRows : tableRows.filter((row) => row.timeframe === activeTimeframe);
    return { counts: c, filteredTableRows: f };
  }, [tableRows, activeTimeframe]);

  if (tableRows.length === 0 && fallbackRows.length === 0) return null;

  const timeframeValues = Object.keys(counts);

  return (
    <div className="space-y-3" data-saved-opportunity-rows>
      {tableRows.length > 0 && (
        <div data-saved-opportunity-table>
          {timeframeValues.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5" dir="rtl" data-opportunity-timeframe-filter>
              <FilterChip label="הכל" count={tableRows.length} isActive={activeTimeframe === 'all'} onClick={() => setActiveTimeframe('all')} />
              {timeframeValues.map((value) => (
                <FilterChip
                  key={value}
                  label={value}
                  count={counts[value]}
                  isActive={activeTimeframe === value}
                  onClick={() => setActiveTimeframe((cur) => (cur === value ? 'all' : value))}
                />
              ))}
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 [scrollbar-gutter:stable]">
            <table className="w-full min-w-[640px] text-right table-fixed border-collapse" dir="rtl">
              <colgroup>
                {showCheckboxCol && <col style={{ width: '32px' }} />}
                <col style={{ width: '84px' }} />
                <col />
                <col style={{ width: '96px' }} />
                <col style={{ width: '96px' }} />
                <col style={{ width: '96px' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-700">
                  {showCheckboxCol && <th className={TH_CLS} aria-label="בחירה" />}
                  <th className={TH_CLS}>מניה</th>
                  <th className={TH_CLS}>סטאפ</th>
                  <th className={`${TH_CLS} text-center`}>כניסה</th>
                  <th className={`${TH_CLS} text-center`}>סטופ</th>
                  <th className={`${TH_CLS} text-center`}>טווח</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={showCheckboxCol ? 6 : 5} className="py-6 text-center text-sm text-slate-400 dark:text-zinc-600">
                      אין הזדמנויות בטווח זה
                    </td>
                  </tr>
                ) : (
                  filteredTableRows.map((row, i) => {
                    const selection = rowSelectionProps({ recordIds: row.recordIds, selectedIds, onToggleGroup, ariaLabel: `בחר את השורה: ${row.ticker || row.setup || 'הזדמנות'}` });
                    const reveal = getWorkspaceRecordRevealState(row.recordIds, revealIds);
                    return (
                      <tr key={`${row.ticker || 'row'}-${i}`} {...reveal.attributes} className={`border-b border-slate-100 transition-colors dark:border-zinc-800 last:border-0 ${reveal.highlighted ? WORKSPACE_RECORD_REVEAL_CLASS : ''}`}>
                        {showCheckboxCol && (
                          <td className={`${TD_CLS} text-center`}>
                            {selection && <UniversalTabCheckbox {...selection} />}
                          </td>
                        )}
                        <td className={`${TD_CLS} whitespace-nowrap`}>
                          <TickerLink ticker={row.ticker} />
                        </td>
                        <td className={`${TD_CLS} ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                          <p className="line-clamp-2 [overflow-wrap:anywhere]" title={row.setup || undefined}>
                            {row.setup || '—'}
                          </p>
                        </td>
                        <td className={`${TD_CLS} text-center`}>
                          <ValuePill value={row.entry} toneClass={ENTRY_PILL_CLS} />
                        </td>
                        <td className={`${TD_CLS} text-center`}>
                          <ValuePill value={row.stop} toneClass={STOP_PILL_CLS} />
                        </td>
                        <td className={`${TD_CLS} text-center`}>
                          <ValuePill value={row.timeframe} toneClass={TIMEFRAME_PILL_CLS} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fallbackRows.length > 0 && (
        <div className="flex flex-col gap-2" data-saved-opportunity-fallback-rows>
          {fallbackRows.map((row, i) => (
            <NewsStyleTextRow
              key={`${row.text}-${i}`}
              topic={row.topic}
              entityLinks={row.entityLinks}
              text={row.text}
              recordIds={row.recordIds}
              selectedIds={selectedIds}
              onToggleGroup={onToggleGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
}
