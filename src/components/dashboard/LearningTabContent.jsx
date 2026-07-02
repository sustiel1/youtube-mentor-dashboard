import { Copy } from "lucide-react";
import { toast } from "sonner";
import { formatMacroDirection } from "@/lib/morningBriefVisuals";
import { formatStockStatusText, getStockStatusVisual } from "@/lib/stockStatusDisplay";
import { StockStatusLine } from "@/components/dashboard/StockStatusLine";
import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  NumericChangeSpan,
} from "./MorningBriefVisualPrimitives";
import {
  UniversalTabCheckbox,
  UniversalTabSelectRow,
} from "@/components/shared/UniversalTabSelectRow";
import { UniversalTabQuickSaveFromBulk } from "@/components/shared/UniversalTabQuickSaveActions";
import { mergeBulkSelection } from "@/lib/universalTabBulkItems";
import { renderLinkedMarketText } from '@/components/shared/LinkedMarketText';

function formatItem(item) {
  const stockLine = formatStockStatusText(item);
  if (stockLine) return stockLine;
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return String(item ?? '').trim();
  const nested = item.items || item.bullets || item.points;
  if (Array.isArray(nested) && nested.length > 0) {
    const title = (item.title || item.label || item.name || '').trim();
    const body = nested
      .map((child) => formatItem(child))
      .filter(Boolean)
      .map((line) => `• ${line}`)
      .join('\n');
    if (title && body) return `${title}\n${body}`;
    if (body) return body;
  }
  const text = (
    item.text || item.title || item.content || item.summary || item.point ||
    item.name || item.rule || item.description || item.insight || item.fact ||
    item.definition || item.setup || item.pattern || ''
  ).trim();
  if (text) return text;
  const val = Object.values(item).find(v => typeof v === 'string' && v.trim());
  return val ? val.trim() : '';
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

function ItemRow({
  text,
  stockVisual = null,
  onBrain,
  saved,
  macroDirection = false,
  bulkSelected = false,
  onBulkToggle = null,
  bulkSelection = null,
  pxUrl = null,
  url = null,
}) {
  const actions = (
    <div className="flex items-center gap-0.5 shrink-0">
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
    </div>
  );

  return (
    <UniversalTabSelectRow
      className="group rounded-lg px-2 py-2 hover:bg-white/80 dark:hover:bg-zinc-800/60 transition-colors"
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
          <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{renderLinkedMarketText(text)}</span>
        )}
      </span>
    </UniversalTabSelectRow>
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
  emptyLabel = 'אין עדיין נתונים בסעיף הזה',
  onSaveToBrain,
  isSaved,
  macroDirection = false,
  bulkSelection = null,
  getItemUrl = null,
}) {
  const formatted = items.map(formatItem).filter(Boolean);

  if (formatted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500" dir="rtl">
        <span className="text-3xl mb-2 opacity-30">📭</span>
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5" dir="rtl">
      {formatted.map((text, i) => {
        const stockVisual = getStockStatusVisual(items[i]);
        const bulkId = bulkSelection
          ? `${bulkSelection.idPrefix}:${i}`
          : null;
        const bulkSelected = bulkId && bulkSelection?.multiSelected?.has(bulkId);
        const url = getItemUrl ? getItemUrl(text, items[i]) : null;
        return (
          <ItemRow
            key={i}
            text={text}
            url={url}
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
          />
        );
      })}
    </div>
  );
}
