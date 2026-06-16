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

  COMPARISON_SURFACE_BG,

  COMPARISON_TABLE_HEAD_BG,

} from './MorningBriefVisualPrimitives';

import {

  getDirectionFromText,

  getMarketChangeStrengthParts,

  toneStyles,

} from '@/lib/morningBriefVisuals';

import { MorningBriefBulkCheckbox } from './MorningBriefBulkCheckbox';
import {
  UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS,
  UniversalTabSelectRow,
} from '@/components/shared/UniversalTabSelectRow';



/**

 * Morning Brief markets view: נכס | שינוי / חוזק | הערה

 * Presentation only — no extraction changes.

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



  const showActionCol = onSaveToBrain || bulkSelection;



  return (

    <div dir="rtl">

      <div className="hidden sm:block overflow-x-auto">

        <table className="w-full border-collapse table-fixed">

          <colgroup>

            {showActionCol && <col className="w-[36px]" />}

            <col className="w-[14%]" />

            <col className="w-[22%]" />

            <col className="w-[64%]" />

          </colgroup>

          <thead>

            <tr className={`border-b-2 border-slate-200 dark:border-zinc-700 ${COMPARISON_TABLE_HEAD_BG}`}>

              {showActionCol && (
                <th className={UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS} aria-label="בחירה" />
              )}

              <th className={`px-3 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>נכס</th>

              <th className={`px-3 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>שינוי / חוזק</th>

              <th className={`px-3 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הערה</th>

            </tr>

          </thead>

          <tbody>

            {rows.map((row, i) => {

              const summary = formatRowText(row);

              const changeEl = renderChangeStrength(row);

              return (

                <tr

                  key={i}

                  className={`border-b border-slate-100 dark:border-zinc-800/60 ${COMPARISON_ROW_HOVER} group border-r-2 ${rowBorder(row)}`}

                >

                  {showActionCol && (

                    <td className={UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS}>

                      <div className="flex flex-col items-center gap-1">

                        <MorningBriefBulkCheckbox

                          bulkSections={bulkSections}

                          sectionKey="markets"

                          text={summary}

                          sectionLabel="📈 שווקים"

                          tabKey="indices"

                          bulkSelection={bulkSelection}

                        />

                        {onSaveToBrain && (

                          <button

                            type="button"

                            onClick={() => onSaveToBrain(summary)}

                            className="opacity-0 group-hover:opacity-100 text-indigo-400 hover:text-indigo-600 text-sm"

                            title="שמור למוח"

                          >

                            🧠

                          </button>

                        )}

                      </div>

                    </td>

                  )}

                  <td className={`px-3 py-2.5 ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{row.asset}</td>

                  <td className="px-3 py-2.5 whitespace-nowrap text-right">

                    {changeEl || <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>}

                  </td>

                  <td className={`px-3 py-2.5 ${DASHBOARD_TABLE_CELL_BODY_CLS}`}>{row.comment || '—'}</td>

                </tr>

              );

            })}

          </tbody>

        </table>

      </div>



      <div className="sm:hidden space-y-2">

        {rows.map((row, i) => {

          const styles = toneStyles(rowDirection(row).tone);

          const changeEl = renderChangeStrength(row);

          const summary = formatRowText(row);

          return (

            <div

              key={i}

              className={`rounded-lg border-2 ${styles.border} ${COMPARISON_SURFACE_BG} px-3 py-2.5 text-right`}

            >

              <UniversalTabSelectRow

                checkbox={bulkSelection ? (

                  <MorningBriefBulkCheckbox

                    bulkSections={bulkSections}

                    sectionKey="markets"

                    text={summary}

                    sectionLabel="📈 שווקים"

                    tabKey="indices"

                    bulkSelection={bulkSelection}

                  />

                ) : null}

                actions={changeEl}

              >

                <p className={DASHBOARD_TABLE_CELL_PRIMARY_CLS}>{row.asset}</p>

              </UniversalTabSelectRow>

              {row.comment && (

                <p className={`mt-1.5 ${DASHBOARD_TABLE_CELL_BODY_CLS}`}>{row.comment}</p>

              )}

            </div>

          );

        })}

      </div>

    </div>

  );

}

