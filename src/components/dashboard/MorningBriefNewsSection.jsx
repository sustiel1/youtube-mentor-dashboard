import { useMemo, useState } from 'react';
import {
  COLLAPSED_NEWS_ITEMS,
  MAX_NEWS_ITEMS,
  normalizeNewsItems,
} from '@/lib/morningBriefNewsNormalize';
import { MorningBriefBulkCheckbox } from './MorningBriefBulkCheckbox';
import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
} from './MorningBriefVisualPrimitives';
import { UNIVERSAL_TAB_CHECKBOX_COL_CLASS } from '@/components/shared/UniversalTabSelectRow';
import { UniversalTabQuickSaveFromBulk } from '@/components/shared/UniversalTabQuickSaveActions';
import { mergeBulkSelection } from '@/lib/universalTabBulkItems';
import { resolveMorningBriefBulkId } from '@/lib/morningBriefBulkSections';
import { renderLinkedMarketText } from '@/components/shared/LinkedMarketText';
import { semanticRowClass } from '@/lib/specializedSemanticVisualState';

const NEWS_CARD_SENTIMENT = {
  positive: {
    border: 'border-r-emerald-500 dark:border-r-emerald-400',
    badge: 'text-emerald-600 dark:text-emerald-400',
    label: 'חיובי',
  },
  negative: {
    border: 'border-r-red-500 dark:border-r-red-400',
    badge: 'text-red-600 dark:text-red-400',
    label: 'שלילי',
  },
  neutral: {
    border: 'border-r-slate-400 dark:border-r-slate-500',
    frame: 'border-solid',
    badge: 'text-slate-700 dark:text-slate-300',
    label: 'ניטרלי',
  },
  mixed: {
    border: 'border-r-amber-500 dark:border-r-amber-400',
    frame: 'border-solid',
    badge: 'text-amber-700 dark:text-amber-300',
    label: 'מעורב',
  },
  warning: {
    border: 'border-r-orange-500 dark:border-r-orange-400',
    badge: 'text-orange-700 dark:text-orange-300',
    label: 'אזהרה',
  },
  'high-risk': {
    border: 'border-r-rose-600 dark:border-r-rose-400',
    badge: 'text-rose-700 dark:text-rose-300',
    label: 'סיכון גבוה',
  },
  unknown: {
    border: 'border-r-slate-300 dark:border-r-zinc-600',
    frame: 'border-dashed',
    badge: 'text-slate-500 dark:text-zinc-400',
    label: 'לא סווג',
  },
};

function NewsCardSaveActions({
  bulkSelection,
  text,
  sectionLabel,
  tabKey,
  onSaveToBrain,
}) {
  const hasQuick = bulkSelection?.onQuickSaveBrain
    || bulkSelection?.onQuickSaveObsidian
    || bulkSelection?.onQuickSaveWorkspace;
  if (hasQuick) {
    return (
      <UniversalTabQuickSaveFromBulk
        bulkSelection={mergeBulkSelection(bulkSelection, {
          sectionLabel,
          type: tabKey,
          tabScope: 'specialized',
        })}
        text={text}
      />
    );
  }
  if (!onSaveToBrain) return null;
  return (
    <button
      type="button"
      onClick={() => onSaveToBrain(text, tabKey, sectionLabel)}
      title="שמור למוח"
      className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm leading-none transition-colors opacity-100 max-md:opacity-90 md:opacity-0 md:group-hover:opacity-100"
    >
      🧠
    </button>
  );
}

export function MorningBriefNewsCard({
  item,
  onSaveToBrain,
  bulkSelection = null,
  bulkSections = [],
}) {
  const sentKey = NEWS_CARD_SENTIMENT[item.sentiment] ? item.sentiment : 'unknown';
  const sentStyle = NEWS_CARD_SENTIMENT[sentKey];
  const saveText = item.saveText || [item.title, item.summary, item.impact].filter(Boolean).join(' — ');
  const bulkId = resolveMorningBriefBulkId(bulkSections, 'news', saveText);
  const isSelected = Boolean(bulkId && bulkSelection?.multiSelected?.has(bulkId));
  const semanticEvidence = sentKey === 'high-risk'
    ? { sentiment: 'negative' }
    : sentKey === 'warning'
      ? { status: 'warning' }
      : { sentiment: sentKey };

  return (
    <div
      dir="rtl"
      className={`group flex items-start gap-3 rounded-xl border border-r-4 border-slate-200 dark:border-zinc-700/60 ${sentStyle.border} ${sentStyle.frame || 'border-solid'} ${semanticRowClass(semanticEvidence)} ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''} px-3 py-3 shadow-sm transition-[background-color,box-shadow,outline-color] hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500/70 focus-within:ring-offset-1`}
      data-news-card
      data-news-semantic-status={sentKey}
      data-news-selected={isSelected ? 'true' : 'false'}
    >
      {/* Checkbox */}
      <div className={UNIVERSAL_TAB_CHECKBOX_COL_CLASS}>
        <MorningBriefBulkCheckbox
          bulkSections={bulkSections}
          sectionKey="news"
          text={saveText}
          sectionLabel="📰 חדשות"
          tabKey="market-news"
          bulkSelection={bulkSelection}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">

        {/* Row 1: Sentiment badge + Headline */}
        <div className="flex items-start gap-2" dir="rtl">
          <span className={`shrink-0 mt-[1px] rounded border border-current/25 px-1.5 py-0.5 text-[13px] font-bold whitespace-nowrap leading-snug ${sentStyle.badge}`}>
            {sentStyle.label}
          </span>
          <p className="flex-1 min-w-0 text-[15px] font-bold leading-snug line-clamp-2 text-slate-900 dark:text-zinc-50 break-words [overflow-wrap:anywhere]">
            {renderLinkedMarketText(item.title)}
          </p>
        </div>

        {/* Row 2: Summary */}
        {item.summary ? (
          <p className={`text-sm leading-snug line-clamp-2 ${DASHBOARD_TABLE_CELL_BODY_CLS} break-words [overflow-wrap:anywhere]`}>
            {renderLinkedMarketText(item.summary)}
          </p>
        ) : null}

        {/* Row 3: Impact — always shown */}
        <p className="text-sm leading-snug break-words [overflow-wrap:anywhere]">
          <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} font-semibold`}>השפעה: </span>
          {item.impact ? (
            <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{renderLinkedMarketText(item.impact)}</span>
          ) : (
            <span className="text-slate-300 dark:text-zinc-600">—</span>
          )}
        </p>

        {/* Row 4: Tags */}
        {item.tags?.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5" dir="rtl">
            {item.tags.map((tag) => (
              <span
                key={`${item.id}-${tag}`}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Save action */}
      <div className="shrink-0 flex items-start pt-0.5">
        <NewsCardSaveActions
          bulkSelection={bulkSelection}
          text={saveText}
          sectionLabel="📰 חדשות"
          tabKey="market-news"
          onSaveToBrain={onSaveToBrain}
        />
      </div>
    </div>
  );
}

export function MorningBriefNewsSection({
  items = [],
  onSaveToBrain,
  bulkSelection = null,
  bulkSections = [],
}) {
  const [expanded, setExpanded] = useState(false);

  const normalizedNews = useMemo(
    () => normalizeNewsItems(items).slice(0, MAX_NEWS_ITEMS),
    [items],
  );

  const hasMoreNews = normalizedNews.length > COLLAPSED_NEWS_ITEMS;
  const visibleNews = !hasMoreNews || expanded
    ? normalizedNews
    : normalizedNews.slice(0, COLLAPSED_NEWS_ITEMS);

  if (!normalizedNews.length) return null;

  return (
    <div dir="rtl" data-news-cards className="space-y-2">
      {visibleNews.map((item) => (
        <MorningBriefNewsCard
          key={item.id}
          item={item}
          onSaveToBrain={onSaveToBrain}
          bulkSelection={bulkSelection}
          bulkSections={bulkSections}
        />
      ))}

      {hasMoreNews ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-center text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-50 py-2 rounded-lg border border-dashed border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
          data-news-expand-toggle
        >
          {expanded ? 'הצג פחות' : 'הצג עוד חדשות'}
        </button>
      ) : null}
    </div>
  );
}
