import { Copy } from "lucide-react";
import { toast } from "sonner";
import { formatMacroDirection } from "@/lib/morningBriefVisuals";
import { formatStockStatusText, getStockStatusVisual } from "@/lib/stockStatusDisplay";
import { StockStatusLine } from "@/components/dashboard/StockStatusLine";
import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
  NumericChangeSpan,
} from "./MorningBriefVisualPrimitives";
import {
  SavedRowIndicator,
  UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS,
  UniversalTabCheckbox,
  UniversalTabSelectRow,
} from "@/components/shared/UniversalTabSelectRow";
import { BriefTableWrapper, BRIEF_TABLE_CLS, BRIEF_TABLE_HEAD_ROW_CLS } from "./briefTableLayout";
import { UniversalTabQuickSaveFromBulk } from "@/components/shared/UniversalTabQuickSaveActions";
import { mergeBulkSelection } from "@/lib/universalTabBulkItems";
import { isRowAlreadySaved } from "@/utils/workspaceSavedRowLookup";
import { renderLinkedMarketText } from '@/components/shared/LinkedMarketText';
import { StaticVideoTimestampLink } from '@/components/shared/StaticVideoTimestampLink';
import { localizeStructuredDisplayText } from '@/lib/structuredDisplayText';

function formatItem(item) {
  const stockLine = formatStockStatusText(item);
  if (stockLine) return localizeStructuredDisplayText(stockLine);
  if (typeof item === 'string') return localizeStructuredDisplayText(item);
  if (!item || typeof item !== 'object') return String(item ?? '').trim();
  const nested = item.items || item.bullets || item.points;
  if (Array.isArray(nested) && nested.length > 0) {
    const title = (item.title || item.label || item.name || '').trim();
    const body = nested
      .map((child) => formatItem(child))
      .filter(Boolean)
      .map((line) => `• ${line}`)
      .join('\n');
    if (title && body) return `${localizeStructuredDisplayText(title)}\n${body}`;
    if (body) return body;
  }
  const text = (
    item.text || item.title || item.content || item.summary || item.point ||
    item.name || item.rule || item.description || item.insight || item.fact ||
    item.definition || item.setup || item.pattern || ''
  ).trim();
  if (text) return localizeStructuredDisplayText(text);
  const val = Object.values(item).find(v => typeof v === 'string' && v.trim());
  return val ? localizeStructuredDisplayText(val) : '';
}

// Matches a trailing "🧠 מומלץ לשמור למוח · סיבה: <reason>" marker the GEM may append
// to an item's text. Stripped from display/copy/save and rendered as a small badge.
const BRAIN_BADGE_RE = /\s*·?\s*🧠\s*מומלץ לשמור למוח\s*·\s*סיבה:\s*(.+)$/;

function extractBrainBadge(text) {
  if (typeof text !== 'string') return { text, reason: null };
  const match = text.match(BRAIN_BADGE_RE);
  if (!match) return { text, reason: null };
  return { text: text.slice(0, match.index).trim(), reason: match[1].trim() || null };
}

function BrainRecommendedBadge({ reason }) {
  return (
    <span
      title={reason || undefined}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold leading-none text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"
    >
      🧠 מומלץ לשמור למוח
    </span>
  );
}

// The fixed GEM item template is a " · "-joined "תווית: ערך" sequence — e.g.
// "מושג: X · הגדרה קצרה: Y · מתי זה תקף: Z · ... · מקור: W" (learning fields) or
// "מטרה: X · פרומפט: \"Y\" · מקור: Z" (promptTemplates). Parsed at display time only;
// the stored string itself is never rewritten. Falls back to null (plain rendering)
// for anything that isn't a clean multi-segment label:value sequence.
function parseTemplateItem(text) {
  if (typeof text !== 'string' || !text.includes(' · ')) return null;
  const segments = text.split(' · ').map((s) => s.trim()).filter(Boolean);
  if (segments.length < 2) return null;
  const parsed = segments.map((segment) => {
    const match = segment.match(/^([^:·]{1,40}):\s*(.*)$/s);
    return match ? { label: match[1].trim(), value: match[2].trim() } : null;
  });
  if (parsed.some((part) => !part)) return null;
  const [titlePart, ...rest] = parsed;
  if (!titlePart.value) return null;
  const rows = rest.filter((part) => part.value && part.value !== '-');
  return { title: titlePart.value, rows };
}

function TemplateItemContent({ text }) {
  const parsed = parseTemplateItem(text);
  if (!parsed) {
    return <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{renderLinkedMarketText(text)}</span>;
  }
  return (
    <div className="w-full">
      <p className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-100">{parsed.title}</p>
      {parsed.rows.length > 0 && (
        <dl className="mt-1 space-y-0.5">
          {parsed.rows.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-x-1.5 text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-100">
              <dt className="shrink-0">{row.label}:</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// Column split for the fixed learning-item template (מושג / הגדרה קצרה / מתי זה
// תקף / מתי זה לא תקף / איך מודדים או איפה רואים את זה / מקור) — only promotes an
// item to the real-table layout when at least one of the two named table columns is
// actually present; other " · "-joined templates that pass parseTemplateItem (e.g.
// promptTemplates' מטרה/פרומפט/מקור) keep the existing stacked TemplateItemContent
// rendering instead of forcing two permanently-empty "—" columns.
const DEFINITION_LABEL_HINTS = ['הגדרה קצרה', 'הגדרה'];
const HOW_TO_MEASURE_LABEL_HINTS = ['איך מודדים', 'איפה רואים'];

function takeMatchingRow(rows, hints) {
  const idx = rows.findIndex((row) => hints.some((hint) => row.label.includes(hint)));
  if (idx === -1) return null;
  return rows.splice(idx, 1)[0];
}

function parseLearningTemplateItem(text) {
  const parsed = parseTemplateItem(text);
  if (!parsed) return null;
  const rest = [...parsed.rows];
  const definition = takeMatchingRow(rest, DEFINITION_LABEL_HINTS);
  const howToMeasure = takeMatchingRow(rest, HOW_TO_MEASURE_LABEL_HINTS);
  if (!definition && !howToMeasure) return null;
  return { title: parsed.title, definition, howToMeasure, rest };
}

const TEMPLATE_TABLE_COL = {
  checkbox: '2rem',
  concept: '20%',
  definition: '30%',
  howToMeasure: '30%',
  info: '2.25rem',
};

/** Rare/longer template fields (מתי זה תקף, מתי זה לא תקף, מקור) behind a tooltip
 * instead of widening the table — only rendered when at least one is present. */
function TemplateRowExtraInfo({ rest }) {
  if (!rest.length) return null;
  const tooltip = rest.map((row) => `${row.label}: ${row.value}`).join('\n');
  return (
    <span
      title={tooltip}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 cursor-help"
      aria-label="פרטים נוספים"
    >
      ℹ️
    </span>
  );
}

function copyText(text) {
  navigator.clipboard.writeText(text)
    .then(() => toast.success('הועתק ✓'))
    .catch(() => toast.error('שגיאה בהעתקה'));
}

function MacroDirectionLines({ text }) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <span className="flex flex-col gap-1 items-end">
      {lines.map((line, i) => {
        const display = formatMacroDirection(line);
        return display ? <NumericChangeSpan key={i} display={display} /> : null;
      })}
    </span>
  );
}

function buildPxUrl(text) {
  if (!text?.trim()) return null;
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(text.trim())}`;
}

/** Per-row hover toolbar: timestamp link, quick-save-to-brain, copy, saved indicator.
 * Shared by the plain stacked row (ItemRow) and the real-table row (TemplateTableRow)
 * so both layouts keep byte-identical action behaviour. */
function ItemRowActions({
  text,
  videoId = null,
  sourceItem = null,
  productionRowId = null,
  rowTimestampSection = null,
  connectButton = null,
  saved,
  onBrain,
  bulkSelection = null,
  pxUrl = null,
}) {
  const alreadySaved = isRowAlreadySaved(
    text,
    bulkSelection?.type || bulkSelection?.tabScope || null,
    bulkSelection?.savedRowIndex,
  );

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <StaticVideoTimestampLink
        videoId={videoId}
        item={sourceItem}
        productionRowId={productionRowId}
        section={rowTimestampSection}
        displayText={text}
      />
      {connectButton}
      <UniversalTabQuickSaveFromBulk
        bulkSelection={bulkSelection}
        text={text}
        brainSaved={saved}
        pxUrl={pxUrl}
      />
      {!bulkSelection?.onQuickSaveBrain && saved ? (
        <span
          title="נשמר למוח"
          className="px-1 py-0.5 rounded text-emerald-600 dark:text-emerald-400 text-xs font-medium leading-none whitespace-nowrap opacity-100 max-md:opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        >
          ✓ נשמר
        </span>
      ) : null}
      {!bulkSelection?.onQuickSaveBrain && !saved && onBrain ? (
        <button
          type="button"
          onClick={onBrain}
          title="שמור למוח"
          className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm leading-none transition-colors opacity-100 max-md:opacity-90 md:opacity-0 md:group-hover:opacity-100"
        >
          🧠
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => copyText(text)}
        title="העתק"
        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-700 transition-colors opacity-100 max-md:opacity-90 md:opacity-0 md:group-hover:opacity-100"
      >
        <Copy className="h-3 w-3" />
      </button>
      {alreadySaved && <SavedRowIndicator />}
    </div>
  );
}

function ItemRow({
  text,
  brainReason = null,
  sourceItem = null,
  videoId = null,
  productionRowId = null,
  rowTimestampSection = null,
  stockVisual = null,
  onBrain,
  saved,
  macroDirection = false,
  bulkSelected = false,
  onBulkToggle = null,
  bulkSelection = null,
  pxUrl = null,
  url = null,
  connectButton = null,
  rowClassName = 'group rounded-lg px-2 py-2 hover:bg-white/80 dark:hover:bg-zinc-800/60 transition-colors',
}) {
  const actions = (
    <ItemRowActions
      text={text}
      videoId={videoId}
      sourceItem={sourceItem}
      productionRowId={productionRowId}
      rowTimestampSection={rowTimestampSection}
      connectButton={connectButton}
      saved={saved}
      onBrain={onBrain}
      bulkSelection={bulkSelection}
      pxUrl={pxUrl}
    />
  );

  return (
    <UniversalTabSelectRow
      className={rowClassName}
      data-static-time-candidate={videoId ? 'true' : undefined}
      checkbox={onBulkToggle ? (
        <UniversalTabCheckbox checked={bulkSelected} onChange={onBulkToggle} />
      ) : null}
      actions={actions}
    >
      <span className="block w-full text-right text-sm leading-[1.7] break-words whitespace-normal">
        {stockVisual ? (
          <StockStatusLine visual={stockVisual} />
        ) : macroDirection ? (
          <MacroDirectionLines text={text} />
        ) : url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`${DASHBOARD_TABLE_CELL_BODY_CLS} hover:underline`}
          >
            {text}
          </a>
        ) : (
          <TemplateItemContent text={text} />
        )}
        {brainReason && (
          <span className="mt-1 block">
            <BrainRecommendedBadge reason={brainReason} />
          </span>
        )}
      </span>
    </UniversalTabSelectRow>
  );
}

/**
 * One real table row for a parsed learning-template item — מושג | הגדרה קצרה |
 * איך מודדים as their own columns, the rarer fields (מתי זה תקף/לא תקף, מקור)
 * behind the ℹ️ tooltip, the 🧠 badge as a marker on the מושג cell. Row actions
 * reuse ItemRowActions verbatim so checkbox / save-to-brain / copy / saved-indicator
 * behave identically to the stacked (non-table) row.
 */
function TemplateTableRow({
  entry,
  index,
  videoId,
  bulkSelection,
  bulkId,
  bulkSelected,
  onBulkToggle,
  connectButton,
  onBrain,
  saved,
  pxUrl,
}) {
  const { text, sourceItem, brainReason } = entry;
  const parsed = parseLearningTemplateItem(text);
  if (!parsed) return null;

  return (
    <tr
      key={index}
      className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group"
      data-static-time-candidate={videoId ? 'true' : undefined}
    >
      <td className={UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS}>
        {onBulkToggle ? (
          <UniversalTabCheckbox checked={bulkSelected} onChange={onBulkToggle} />
        ) : null}
      </td>
      <td className="px-2 py-2 align-top text-right">
        <p className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-100">
          {parsed.title}
        </p>
        {brainReason && (
          <span className="mt-1 block">
            <BrainRecommendedBadge reason={brainReason} />
          </span>
        )}
      </td>
      <td className="px-2 py-2 align-top text-right text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-100">
        {parsed.definition ? parsed.definition.value : <span className="text-slate-300 dark:text-zinc-600">—</span>}
      </td>
      <td className="px-2 py-2 align-top text-right text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-100">
        {parsed.howToMeasure ? parsed.howToMeasure.value : <span className="text-slate-300 dark:text-zinc-600">—</span>}
      </td>
      <td className="px-1 py-2 align-top text-center">
        <TemplateRowExtraInfo rest={parsed.rest} />
      </td>
      <td className="py-2 pl-1 pr-0 align-top">
        <ItemRowActions
          text={text}
          videoId={videoId}
          sourceItem={sourceItem}
          productionRowId={bulkId}
          rowTimestampSection={bulkSelection?.sectionLabel || bulkSelection?.type || null}
          connectButton={connectButton}
          saved={saved}
          onBrain={onBrain}
          bulkSelection={bulkSelection}
          pxUrl={pxUrl}
        />
      </td>
    </tr>
  );
}

/**
 * Real table (column headers, aligned cells) for the subset of a section's items
 * that match the fixed learning template — mirrors the מבזק בוקר/ערב table shell
 * (BRIEF_TABLE_CLS / BriefTableWrapper) rather than a parallel implementation.
 */
function TemplateItemsTable({
  rows,
  videoId,
  bulkSelection,
  onSaveToBrain,
  isSaved,
  getConnectButton,
  items,
}) {
  return (
    <BriefTableWrapper>
      <table className={BRIEF_TABLE_CLS} dir="rtl">
        <colgroup>
          <col style={{ width: TEMPLATE_TABLE_COL.checkbox }} />
          <col style={{ width: TEMPLATE_TABLE_COL.concept }} />
          <col style={{ width: TEMPLATE_TABLE_COL.definition }} />
          <col style={{ width: TEMPLATE_TABLE_COL.howToMeasure }} />
          <col style={{ width: TEMPLATE_TABLE_COL.info }} />
          <col />
        </colgroup>
        <thead>
          <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
            <th className="py-1.5 pr-2 pl-0" aria-label="בחירה" />
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>מושג</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הגדרה קצרה</th>
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>איך מודדים או איפה רואים את זה</th>
            <th className="py-1.5" aria-label="פרטים נוספים" />
            <th className="py-1.5" aria-label="פעולות" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ text, sourceItem, brainReason, i }) => {
            const entry = { text, sourceItem, brainReason };
            const bulkId = bulkSelection ? `${bulkSelection.idPrefix}:${i}` : null;
            const bulkSelected = !!(bulkId && bulkSelection?.multiSelected?.has(bulkId));
            const connectButton = getConnectButton ? getConnectButton(text, items[i]) : null;
            return (
              <TemplateTableRow
                key={i}
                index={i}
                entry={entry}
                videoId={videoId}
                bulkSelection={bulkSelection}
                bulkId={bulkId}
                bulkSelected={bulkSelected}
                onBulkToggle={bulkId && bulkSelection?.onToggle ? () => bulkSelection.onToggle(bulkId, {
                  text,
                  sectionLabel: bulkSelection.sectionLabel || '',
                  type: bulkSelection.type || bulkSelection.tabScope,
                  tabScope: bulkSelection.tabScope,
                }) : null}
                connectButton={connectButton}
                onBrain={onSaveToBrain ? () => onSaveToBrain(text) : null}
                saved={isSaved ? isSaved(text) : false}
                pxUrl={buildPxUrl(text)}
              />
            );
          })}
        </tbody>
      </table>
    </BriefTableWrapper>
  );
}

function formatSourceDate(dateRaw) {
  if (!dateRaw) return '';
  try {
    const d = new Date(dateRaw);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

/** Lightweight human source line for Useful Knowledge tab (one line per video). */
export function UsefulKnowledgeSourceLine({ video, mentorName = '' }) {
  const label =
    String(mentorName || '').trim() ||
    String(video?.mentorName || '').trim() ||
    String(video?.channelTitle || video?.channelName || video?.channel || '').trim();
  const dateLabel = formatSourceDate(
    video?.publishedAt || video?.uploadDate || video?.date || video?.createdAt,
  );

  if (!label && !dateLabel) return null;

  return (
    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3 text-right px-1 leading-snug">
      🎥 {label || 'ערוץ לא ידוע'}
      {dateLabel ? ` · ${dateLabel}` : ''}
    </p>
  );
}

/**
 * Generic tab content renderer for learning-specific tabs.
 */
export function LearningTabContent({
  items = [],
  videoId = null,
  emptyLabel = 'אין עדיין נתונים בסעיף הזה',
  onSaveToBrain,
  isSaved,
  macroDirection = false,
  bulkSelection = null,
  getItemUrl = null,
  getConnectButton = null,
  rowClassName,
  // Opt-in only — the fixed-template useful-knowledge section (tab 4) passes this;
  // every other caller (the morning/evening brief's SummaryBriefingView included)
  // leaves it false and keeps the exact stacked-row rendering below unchanged.
  templateTable = false,
}) {
  const formatted = items
    .map((sourceItem) => {
      const { text, reason } = extractBrainBadge(formatItem(sourceItem));
      return { sourceItem, text, brainReason: reason };
    })
    .filter(({ text }) => Boolean(text));

  if (formatted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500" dir="rtl">
        <span className="text-3xl mb-2 opacity-30">📭</span>
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  if (!templateTable) {
    return (
      <div className="space-y-0.5" dir="rtl">
        {formatted.map(({ text, sourceItem, brainReason }, i) => {
          const stockVisual = getStockStatusVisual(sourceItem);
          const bulkId = bulkSelection
            ? `${bulkSelection.idPrefix}:${i}`
            : null;
          const bulkSelected = bulkId && bulkSelection?.multiSelected?.has(bulkId);
          const url = getItemUrl ? getItemUrl(text, items[i]) : null;
          const connectButton = getConnectButton ? getConnectButton(text, items[i]) : null;
          return (
            <ItemRow
              key={i}
              text={text}
              brainReason={brainReason}
              sourceItem={sourceItem}
              videoId={videoId}
              productionRowId={bulkId}
              rowTimestampSection={bulkSelection?.sectionLabel || bulkSelection?.type || null}
              url={url}
              connectButton={connectButton}
              stockVisual={stockVisual}
              macroDirection={macroDirection}
              saved={isSaved ? isSaved(text) : false}
              onBrain={onSaveToBrain ? () => onSaveToBrain(text) : null}
              bulkSelected={!!bulkSelected}
              onBulkToggle={bulkId && bulkSelection?.onToggle ? () => bulkSelection.onToggle(bulkId, {
                text,
                sectionLabel: bulkSelection.sectionLabel || '',
                type: bulkSelection.type || bulkSelection.tabScope,
                tabScope: bulkSelection.tabScope,
              }) : null}
              bulkSelection={bulkSelection}
              pxUrl={buildPxUrl(text)}
              rowClassName={rowClassName}
            />
          );
        })}
      </div>
    );
  }

  // templateTable === true: items matching the fixed learning template (at least one
  // of הגדרה קצרה / איך מודדים present) render as a real table; anything else — an
  // item that doesn't match at all, or a promptTemplates-style item with neither
  // named column — falls back to the exact same stacked ItemRow used above.
  const withIndex = formatted.map((entry, i) => ({ ...entry, i }));
  const tableRows = withIndex.filter(({ text }) => !!parseLearningTemplateItem(text));
  const plainRows = withIndex.filter(({ text }) => !parseLearningTemplateItem(text));

  return (
    <div className="space-y-3" dir="rtl">
      {tableRows.length > 0 && (
        <TemplateItemsTable
          rows={tableRows}
          videoId={videoId}
          bulkSelection={bulkSelection}
          onSaveToBrain={onSaveToBrain}
          isSaved={isSaved}
          getConnectButton={getConnectButton}
          items={items}
        />
      )}
      {plainRows.length > 0 && (
        <div className="space-y-0.5">
          {plainRows.map(({ text, sourceItem, brainReason, i }) => {
            const stockVisual = getStockStatusVisual(sourceItem);
            const bulkId = bulkSelection
              ? `${bulkSelection.idPrefix}:${i}`
              : null;
            const bulkSelected = bulkId && bulkSelection?.multiSelected?.has(bulkId);
            const url = getItemUrl ? getItemUrl(text, items[i]) : null;
            const connectButton = getConnectButton ? getConnectButton(text, items[i]) : null;
            return (
              <ItemRow
                key={i}
                text={text}
                brainReason={brainReason}
                sourceItem={sourceItem}
                videoId={videoId}
                productionRowId={bulkId}
                rowTimestampSection={bulkSelection?.sectionLabel || bulkSelection?.type || null}
                url={url}
                connectButton={connectButton}
                stockVisual={stockVisual}
                macroDirection={macroDirection}
                saved={isSaved ? isSaved(text) : false}
                onBrain={onSaveToBrain ? () => onSaveToBrain(text) : null}
                bulkSelected={!!bulkSelected}
                onBulkToggle={bulkId && bulkSelection?.onToggle ? () => bulkSelection.onToggle(bulkId, {
                  text,
                  sectionLabel: bulkSelection.sectionLabel || '',
                  type: bulkSelection.type || bulkSelection.tabScope,
                  tabScope: bulkSelection.tabScope,
                }) : null}
                bulkSelection={bulkSelection}
                pxUrl={buildPxUrl(text)}
                rowClassName={rowClassName}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
