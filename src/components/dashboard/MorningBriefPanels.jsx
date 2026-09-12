import { useCallback, useState } from 'react';
import { cleanupMacroDisplayRows } from '@/lib/macroDisplayCleanup';
import {
  extractCalendarRows,
  mergeCalendarRows,
  mergeMacroDisplayRows,
  extractMacroIndicatorRows,
  extractMarketDashboardRows,
  extractMarketRegimeCards,
  extractOpportunityIdeas,
  extractRiskItems,
  extractSectorRows,
  extractSentimentItems,
  extractUnifiedStocks,
  getSpecializedSrc,
  hasSentimentData,
  hasUnifiedStocks,
} from '@/lib/morningBriefDisplay';
import { translateSentimentLabel, translateSentimentValue } from '@/lib/sentimentDisplayI18n';
import {
  translateIndicatorEnumValue,
  translateIndicatorStatusDisplay,
  translateKnownIndicatorEnumValue,
} from '@/lib/indicatorEnumDisplay';
import {
  FINVIZ_MARKET_MAP_LINK,
  resolveMarketRegimeRowLink,
} from '@/lib/marketRegimeExternalLinks';
import {
  DISPLAY_COLUMN_TITLES,
  DISPLAY_SECTION_TITLES,
  TONE_DISPLAY_LABELS,
  translateDisplayLabel,
  translateMarketStatusLabel,
} from '@/lib/specializedDisplayI18n';
import {
  getDirectionBadge,
  getDirectionFromFields,
  importanceStyles,
  importanceTextStyles,
  getMacroChangeDisplay,
  getMacroFieldDisplay,
  parseStockMovePercentFromText,
  resolveTone,
  stockCategoryBadge,
  TONE,
  tickersInDisplayText,
  toneStyles,
} from '@/lib/morningBriefVisuals';
import { MorningBriefMarketsTable, marketRowSentimentKey } from './MorningBriefMarketsTable';
import { MarketSectorTable } from './MarketSectorTable';
import { FearGreedScoreCardContainer } from './FearGreedScoreCardContainer';
import { AAIIWeeklySentimentCardContainer } from './AAIIWeeklySentimentCardContainer';
import {
  BRIEF_NOTES_TEXT_CLS,
} from './BriefSentimentNotesTable';
import {
  BRIEF_CELL,
  BRIEF_COL,
  BRIEF_SENTIMENT_INLINE_CLS,
  BRIEF_TABLE_CLS,
  BRIEF_TABLE_HEAD_ROW_CLS,
  BriefTableWrapper,
} from './briefTableLayout';
import {
  ChangeValue,
  DirectionText,
  NumericChangeSpan,
  RegimeCard,
  RegimeRow,
  ImportanceBadge,
  COMPARISON_SURFACE_BG,
  COMPARISON_ROW_HOVER,
  COMPARISON_TABLE_HEAD_BG,
  DASHBOARD_COLUMN_HEADER_CLS,
  DASHBOARD_EMPTY_CLS,
  DASHBOARD_ITEM_ROW_CLS,
  DASHBOARD_PILL_CLS,
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_DATE_CLS,
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
  DASHBOARD_TABLE_STATUS_CLS,
  SectionCard,
  SECTION_HEADER_TITLE_CLS,
  SectorCard,
  SectorRow,
  getSectorMeta,
} from './MorningBriefVisualPrimitives';
import {
  BRIEF_MANUAL_SECTION_IDS,
  SECTION_EDIT_COLUMNS,
  getEditableRowsForSection,
} from '@/lib/manualBriefOverrides';
import { resolveStockSectorDisplay } from '@/lib/stockSectorEnrichment';
import { resolveMorningBriefPresentation, morningBriefSectionCount, morningBriefShowsSummaryCounters, morningBriefSubsectionTitle, countOpportunitiesAndRisks } from '@/lib/morningBriefPresentation';
import {
  formatMorningBriefCalendarText,
  formatMorningBriefMacroText,
  formatMorningBriefOpportunityText,
  formatMorningBriefRegimeText,
  formatMorningBriefSectorText,
  formatMorningBriefStockText,
  formatMorningBriefStockFundamentalText,
  formatMorningBriefStockTechnicalText,
  getMorningBriefMarketRows,
} from '@/lib/morningBriefBulkSections';
import { extractVideoTabItems } from '@/config/videoTabsConfig';
import {
  BriefSectionManualHeaderExtras,
  ManualEditGrid,
  ManualOpportunitiesRisksEdit,
  useBriefSectionManualEdit,
} from './BriefSectionManualEdit';
import { MorningBriefBulkCheckbox } from './MorningBriefBulkCheckbox';
import {
  INSIGHT_GRID_SLOT_COUNT,
  MacroStyleEmptyInsightCard,
  MacroStyleOpportunityCard,
  MacroStyleRiskCard,
  getMacroOppStyle,
  getMacroRiskStyle,
  padInsightSlots,
} from './MacroStyleInsightCards';
import {
  UNIVERSAL_TAB_CHECKBOX_COL_CLASS,
  UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS,
  UniversalTabSelectRow,
  SavedRowIndicator,
} from '@/components/shared/UniversalTabSelectRow';
import { isRowAlreadySaved } from '@/utils/workspaceSavedRowLookup';
import { mergeBulkSelection } from '@/lib/universalTabBulkItems';
import { UniversalTabQuickSaveFromBulk } from '@/components/shared/UniversalTabQuickSaveActions';
import { StaticVideoTimestampLink } from '@/components/shared/StaticVideoTimestampLink';
import { MorningBriefNewsSection } from './MorningBriefNewsSection';
import { normalizeNewsItems } from '@/lib/morningBriefNewsNormalize';
import {
  resolveMorningBriefCardText,
  resolveMorningBriefCombinedCardText,
  resolveMorningBriefSectionChildItems,
  resolveMorningBriefCombinedSectionChildItems,
} from '@/lib/morningBriefBulkSections';
import {
  CNN_FEAR_GREED_URL,
  getSentimentSourceLink,
} from '@/lib/sentimentSourceLinks';
import { getMacroIndicatorUrl } from '@/lib/macroIndicatorLinks';
import { translateMarketLabel, translateImportanceLevel } from '@/lib/marketLabelTranslations';
import {
  EconomicCalendarActionLink,
  EconomicCalendarHeaderLinks,
  EconomicCalendarTitleLink,
} from './EconomicCalendarHeaderLinks';

function morningBriefCardBulk(bulkSections, bulkSelection, sectionKey, title, { disabled = false, cardId, type } = {}) {
  if (!bulkSelection || disabled) return null;
  const cardText = resolveMorningBriefCardText(bulkSections, sectionKey, title);
  if (!cardText) return null;
  const sec = bulkSections.find((s) => s.key === sectionKey);
  return {
    cardId: cardId || sectionKey,
    cardText,
    bulkSelection,
    tabScope: 'specialized',
    type: type || sec?.tabKey || 'specialized',
    sectionLabel: title,
  };
}

function morningBriefCombinedCardBulk(bulkSections, bulkSelection, sectionKeys, title, { disabled = false, cardId, type } = {}) {
  if (!bulkSelection || disabled) return null;
  const cardText = resolveMorningBriefCombinedCardText(bulkSections, sectionKeys, title);
  if (!cardText) return null;
  return {
    cardId: cardId || sectionKeys.join('-'),
    cardText,
    bulkSelection,
    tabScope: 'specialized',
    type: type || 'specialized',
    sectionLabel: title,
  };
}

function BriefQuickSaveActions({
  bulkSelection,
  text,
  sectionLabel,
  tabKey,
  tabScope = 'specialized',
}) {
  return (
    <UniversalTabQuickSaveFromBulk
      bulkSelection={mergeBulkSelection(bulkSelection, {
        sectionLabel,
        type: tabKey,
        tabScope,
      })}
      text={text}
    />
  );
}

function BriefRowSaveActions({
  bulkSelection,
  text,
  sectionLabel,
  tabKey,
  onSaveToBrain,
  tabScope = 'specialized',
}) {
  const hasQuick = bulkSelection?.onQuickSaveBrain
    || bulkSelection?.onQuickSaveObsidian
    || bulkSelection?.onQuickSaveWorkspace;
  if (hasQuick) {
    return (
      <BriefQuickSaveActions
        bulkSelection={bulkSelection}
        text={text}
        sectionLabel={sectionLabel}
        tabKey={tabKey}
        tabScope={tabScope}
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

// Stable reference for the "no marketBriefData" fallback below — useBriefSectionManualEdit's
// own useEffect depends on this value, so a fresh `{}` literal on every render (the video has
// no marketBriefData at all, e.g. a fundamental/technical GEMS-paste video) would change on
// every render and loop (setDraft → render → new {} → effect fires → setDraft → ...).
const EMPTY_MARKET_BRIEF_DATA = {};

function useMorningBriefSectionEdit(sectionId, { marketBriefData, effectiveVideo, onSaveMarketBriefSection, newsItems, presentation }) {
  const ui = resolveMorningBriefPresentation(presentation);
  const enabled = Boolean(onSaveMarketBriefSection && marketBriefData);
  const getDraftRows = useCallback(
    () => getEditableRowsForSection(marketBriefData, effectiveVideo, sectionId, newsItems),
    [marketBriefData, effectiveVideo, sectionId, newsItems],
  );

  const edit = useBriefSectionManualEdit({
    sectionId,
    marketBriefData: marketBriefData || EMPTY_MARKET_BRIEF_DATA,
    getDraftRows,
    onSaveSection: onSaveMarketBriefSection || (async () => {}),
  });

  const headerActions = enabled ? (
    <BriefSectionManualHeaderExtras
      sectionId={sectionId}
      marketBriefData={marketBriefData}
      editing={edit.editing}
      saving={edit.saving}
      onEdit={edit.startEdit}
      onCancel={edit.cancelEdit}
      onSave={edit.saveEdit}
      showAiBadge={ui.showAiBadge}
    />
  ) : null;

  return { ...edit, headerActions, enabled };
}

// ── Comparison dashboard helpers (presentation only) ─────────────────
function splitSignalsByTone(items, getText) {
  const positive = [];
  const negative = [];
  let bullishCount = 0;
  let bearishCount = 0;
  for (const item of items) {
    const tone = resolveTone(getText(item));
    if (tone === TONE.BEARISH) {
      negative.push(item);
      bearishCount += 1;
    } else if (tone === TONE.BULLISH) {
      positive.push(item);
      bullishCount += 1;
    } else {
      positive.push(item);
    }
  }
  return { positive, negative, bullishCount, bearishCount };
}

function SignalComparisonColumn({
  variant,
  title,
  count,
  isEmpty = false,
  children,
  scrollable = false,
  emptyMessage,
}) {
  const isPositive = variant === 'positive';
  const bodyCls = scrollable
    ? 'flex-1 min-h-0 overflow-y-auto px-2.5 py-2 space-y-2'
    : 'px-2.5 py-2 space-y-2';

  return (
    <div
      dir="rtl"
      className={`flex flex-col rounded-xl border-2 min-h-[120px] text-right ${
        newsColumnVariantStyles(isPositive ? 'positive' : 'negative').column
      }${scrollable ? ' h-full max-h-full' : ''}`}
      data-signal-column={variant}
    >
      <DashboardColumnHeader
        title={title}
        count={count}
        countTextCls={newsColumnVariantStyles(isPositive ? 'positive' : 'negative').countText}
      />
      <div className={bodyCls}>
        {isEmpty ? (
          <p className={`${DASHBOARD_EMPTY_CLS} text-center py-6`}>{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function SignalComparisonBlock({
  sectionTitle,
  bullishCount,
  bearishCount,
  positiveEmpty,
  negativeEmpty,
  positiveContent,
  negativeContent,
  dataSection,
  defaultOpen = true,
}) {
  return (
    <details
      open={defaultOpen}
      dir="rtl"
      className={`rounded-xl border border-slate-200/80 dark:border-zinc-700/80 ${COMPARISON_SURFACE_BG} px-2.5 py-2.5 group text-right`}
      data-comparison-section={dataSection}
    >
      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none pt-1 pb-3 mb-3 px-0.5 text-right border-b border-slate-200/80 dark:border-zinc-700/70">
        <div className="flex flex-wrap items-center gap-2">
          <span className={SECTION_HEADER_TITLE_CLS}>{sectionTitle}</span>
          <span className="hidden sm:inline-flex">
            <ComparisonSummaryPills
              pills={[
                { count: bullishCount, label: 'חיובי', tone: 'positive' },
                { count: bearishCount, label: 'שלילי', tone: 'negative' },
              ]}
            />
          </span>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-zinc-500 group-open:hidden">הצג</span>
        <span className="text-[10px] text-slate-400 dark:text-zinc-500 hidden group-open:inline">הסתר</span>
      </summary>

      <div className="lg:hidden space-y-3" dir="rtl">
        <SignalComparisonColumn
          variant="positive"
          title={DISPLAY_COLUMN_TITLES.signals.positive}
          count={bullishCount}
          isEmpty={positiveEmpty}
          emptyMessage="לא נמצאו איתותים חיוביים"
        >
          {positiveContent}
        </SignalComparisonColumn>
        <SignalComparisonColumn
          variant="negative"
          title={DISPLAY_COLUMN_TITLES.signals.negative}
          count={bearishCount}
          isEmpty={negativeEmpty}
          emptyMessage="לא נמצאו איתותים שליליים"
        >
          {negativeContent}
        </SignalComparisonColumn>
      </div>

      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3 lg:h-[min(50vh,400px)] lg:min-h-[160px]" dir="rtl">
        <SignalComparisonColumn
          variant="positive"
          title={DISPLAY_COLUMN_TITLES.signals.positive}
          count={bullishCount}
          isEmpty={positiveEmpty}
          scrollable
          emptyMessage="לא נמצאו איתותים חיוביים"
        >
          {positiveContent}
        </SignalComparisonColumn>
        <SignalComparisonColumn
          variant="negative"
          title={DISPLAY_COLUMN_TITLES.signals.negative}
          count={bearishCount}
          isEmpty={negativeEmpty}
          scrollable
          emptyMessage="לא נמצאו איתותים שליליים"
        >
          {negativeContent}
        </SignalComparisonColumn>
      </div>
    </details>
  );
}

const INTERNAL_NEWS_FIELD_RE = /^[a-z][a-zA-Z0-9]*:\s*/;

/** Strip internal GEM keys (e.g. status:, generalMood:, marketBreadth:) — presentation only. */
function stripInternalFieldLabels(text) {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  if (raw.includes(' | ')) {
    return raw
      .split(' | ')
      .map((part) => stripInternalFieldLabels(part))
      .filter(Boolean)
      .join(' · ');
  }
  let s = raw;
  while (INTERNAL_NEWS_FIELD_RE.test(s)) {
    s = s.replace(INTERNAL_NEWS_FIELD_RE, '').trim();
  }
  return s;
}

function stripInternalNewsFieldLabel(text) {
  return stripInternalFieldLabels(text);
}

function normalizeNewsStrings(items) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  return safe.map((item) => {
    if (typeof item === 'string') return stripInternalNewsFieldLabel(item);
    if (typeof item === 'object') {
      return stripInternalNewsFieldLabel(
        [item.headline, item.title, item.content, item.source, item.impact]
          .filter(Boolean)
          .join(' — '),
      );
    }
    return stripInternalNewsFieldLabel(String(item));
  }).filter(Boolean);
}

function newsColumnVariantStyles(variant) {
  if (variant === 'positive') {
    return {
      column: `border-emerald-300/80 dark:border-emerald-700/50 ${COMPARISON_SURFACE_BG}`,
      countText: 'text-emerald-700 dark:text-emerald-300',
      emoji: '🟢',
    };
  }
  if (variant === 'negative') {
    return {
      column: `border-red-300/80 dark:border-red-800/50 ${COMPARISON_SURFACE_BG}`,
      countText: 'text-red-700 dark:text-red-300',
      emoji: '🔴',
    };
  }
  return {
    column: `border-amber-300/80 dark:border-amber-700/50 ${COMPARISON_SURFACE_BG}`,
    countText: 'text-amber-700 dark:text-amber-300',
    emoji: '🟡',
  };
}

const NEWS_COLUMN_TITLES = DISPLAY_COLUMN_TITLES.news;

const SUMMARY_COUNT_TEXT = {
  positive: 'text-emerald-700 dark:text-emerald-300',
  neutral: 'text-amber-700 dark:text-amber-300',
  negative: 'text-red-700 dark:text-red-300',
  watch: 'text-sky-700 dark:text-sky-300',
};

function ComparisonSummaryPills({ pills = [] }) {
  const visible = pills.filter((p) => p.show !== false);
  if (!visible.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-start gap-x-2.5 gap-y-0.5 min-w-0" dir="rtl">
      {visible.map((pill, i) => (
        <span
          key={`${pill.label}-${i}`}
          className={`inline-flex items-center gap-1 ${DASHBOARD_PILL_CLS} whitespace-nowrap ${
            pill.cls || SUMMARY_COUNT_TEXT[pill.tone] || SUMMARY_COUNT_TEXT.neutral
          }`}
        >
          <span>{pill.label}:</span>
          <span className="font-semibold">{pill.count}</span>
        </span>
      ))}
    </div>
  );
}

function ThreeToneSummaryPills({
  bullishCount,
  neutralCount,
  bearishCount,
  labels,
  showNeutralWhenEmpty = true,
}) {
  const pills = [
    { count: bullishCount, label: labels.positive, tone: 'positive' },
    {
      count: neutralCount,
      label: labels.neutral,
      tone: 'neutral',
      show: showNeutralWhenEmpty || neutralCount > 0,
    },
    { count: bearishCount, label: labels.negative, tone: 'negative' },
  ];
  return <ComparisonSummaryPills pills={pills} />;
}

const INLINE_SENTIMENT_STYLE = {
  positive: {
    dot: 'bg-emerald-500',
    label: 'חיובי',
  },
  negative: {
    dot: 'bg-red-500',
    label: 'שלילי',
  },
  neutral: {
    dot: 'bg-amber-400',
    label: 'ניטרלי',
  },
};

function normalizeInlineSentKey(sentKey) {
  if (sentKey === 'bullish' || sentKey === TONE.BULLISH || sentKey === 'positive') return 'positive';
  if (sentKey === 'bearish' || sentKey === TONE.BEARISH || sentKey === 'negative') return 'negative';
  return 'neutral';
}

/** Compact table sentiment: colored dot (right) + dark label (RTL — מצב שוק, סקטורים, מאקרו, סנטימנט, מניות). */
function InlineSentimentBadge({ sentKey, className = '' }) {
  const style = INLINE_SENTIMENT_STYLE[normalizeInlineSentKey(sentKey)];
  if (!style) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}
      dir="rtl"
    >
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${style.dot}`} aria-hidden />
      <span className="text-slate-900 dark:text-zinc-50">{style.label}</span>
    </span>
  );
}

function toneToSentKey(tone) {
  if (tone === TONE.BULLISH) return 'positive';
  if (tone === TONE.BEARISH) return 'negative';
  return 'neutral';
}

/** Paragraph rhythm — matches חדשות row detail text (text-sm + body + leading-snug). */
const BRIEF_NEWS_NOTES_CLS =
  `text-sm ${DASHBOARD_TABLE_CELL_BODY_CLS} leading-snug break-words [overflow-wrap:anywhere]`;

function BriefNewsNotesText({
  text,
  row = null,
  className = '',
  empty = '—',
  translateIndicatorEnums = false,
}) {
  const raw = String(text || '').trim();
  if (!raw) {
    if (empty == null) return null;
    return <span className="text-slate-300 dark:text-zinc-600">{empty}</span>;
  }
  const display = row ? getMacroFieldDisplay(raw, row) : null;

  // Compact numeric change only — colored arrow + value (not full paragraphs).
  if (display?.kind === 'percent') {
    return <NumericChangeSpan display={display} />;
  }
  if (display?.kind === 'neutral' && display.text === '—') {
    return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  }

  let bodyText = raw;
  let arrowPrefix = null;
  if (display?.kind === 'direction') {
    bodyText = display.text || raw.replace(/^[↑↓▲▼•]\s*/, '').trim();
    if (display.arrow && display.arrow !== '•') {
      arrowPrefix = (
        <span className={`${DASHBOARD_TABLE_STATUS_CLS} ${display.cls}`.trim()}>
          {display.arrow}{' '}
        </span>
      );
    }
  } else if (display?.text) {
    bodyText = display.text;
  }

  if (translateIndicatorEnums) {
    bodyText = translateIndicatorStatusDisplay(bodyText);
  }

  return (
    <p className={`${BRIEF_NEWS_NOTES_CLS} line-clamp-3 ${className}`.trim()} title={bodyText}>
      {arrowPrefix}
      {bodyText}
    </p>
  );
}

const BRIEF_TABLE_LINK_CLS = 'text-xs font-medium text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline';

function NewsColumnHeader({ title, count, countTextCls }) {
  return <DashboardColumnHeader title={title} count={count} countTextCls={countTextCls} />;
}

function splitNewsByTone(items, getText) {
  const positive = [];
  const negative = [];
  const neutral = [];
  let bullishCount = 0;
  let bearishCount = 0;
  for (const item of items) {
    const tone = resolveTone(getText(item));
    if (tone === TONE.BEARISH) {
      negative.push(item);
      bearishCount += 1;
    } else if (tone === TONE.BULLISH) {
      positive.push(item);
      bullishCount += 1;
    } else {
      neutral.push(item);
    }
  }
  return { positive, negative, neutral, bullishCount, bearishCount };
}

function ToneStatusText({ tone, label, className = '' }) {
  const styles = toneStyles(tone);
  return (
    <span className={`inline whitespace-nowrap ${DASHBOARD_TABLE_STATUS_CLS} ${styles.text} ${className}`}>
      {label}
    </span>
  );
}

function NewsImpactBadge({ text }) {
  const tone = resolveTone(text);
  const label = tone === TONE.BULLISH
    ? TONE_DISPLAY_LABELS.positive
    : tone === TONE.BEARISH
      ? TONE_DISPLAY_LABELS.negative
      : TONE_DISPLAY_LABELS.neutral;
  return <ToneStatusText tone={tone} label={label} className="shrink-0" />;
}

function parseNewsDisplay(text) {
  const raw = String(text || '').trim();
  const splitIdx = raw.indexOf(' — ');
  if (splitIdx === -1) return { headline: raw, detail: '' };
  return {
    headline: raw.slice(0, splitIdx).trim(),
    detail: raw.slice(splitIdx + 3).trim(),
  };
}

function NewsComparisonCard({
  text,
  onSaveToBrain,
  variant = 'neutral',
  inColumn = false,
  isLast = false,
  bulkSelection = null,
  bulkSections = [],
}) {
  const displayText = stripInternalNewsFieldLabel(text);
  const { headline, detail } = parseNewsDisplay(displayText);
  const tone = resolveTone(displayText);
  const styles = toneStyles(tone);
  const shellCls = inColumn
    ? 'py-2 text-right group bg-transparent'
    : `rounded-lg border-2 ${styles.border} ${COMPARISON_SURFACE_BG} px-2 py-1 text-right group`;

  return (
    <UniversalTabSelectRow
      className={inColumn ? DASHBOARD_ITEM_ROW_CLS : ''}
      data-news-card
      checkbox={(
        <MorningBriefBulkCheckbox
          bulkSections={bulkSections}
          sectionKey="news"
          text={displayText}
          sectionLabel="📰 חדשות"
          tabKey="market-news"
          bulkSelection={bulkSelection}
        />
      )}
      actions={(
        <BriefRowSaveActions
          bulkSelection={bulkSelection}
          text={displayText}
          sectionLabel="📰 חדשות"
          tabKey="market-news"
          onSaveToBrain={onSaveToBrain}
        />
      )}
    >
      <div className={shellCls}>
      <div className="min-w-0 text-right">
        <p className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} text-right ${inColumn ? '' : styles.text}`}>
          {headline}
        </p>
        {detail && (
          <p className={`${DASHBOARD_TABLE_CELL_BODY_CLS} mt-1 text-right`}>{detail}</p>
        )}
      </div>
      {!inColumn && <NewsImpactBadge text={displayText} />}
      {inColumn && !isLast && (
        <div className="mt-2 border-b border-slate-200/70 dark:border-zinc-700/50" aria-hidden />
      )}
      </div>
    </UniversalTabSelectRow>
  );
}

function NewsSignalCard({ text, onSaveToBrain }) {
  return <NewsComparisonCard text={text} onSaveToBrain={onSaveToBrain} />;
}

function NewsComparisonColumn({
  variant,
  count,
  items,
  onSaveToBrain,
  scrollable = false,
  emptyMessage,
  bulkSelection = null,
  bulkSections = [],
}) {
  const styles = newsColumnVariantStyles(variant);
  const title = NEWS_COLUMN_TITLES[variant] || NEWS_COLUMN_TITLES.neutral;
  const bodyCls = scrollable
    ? 'flex-1 min-h-0 overflow-y-auto px-1.5 py-1 space-y-0.5'
    : 'px-1.5 py-1 space-y-0.5';

  return (
    <div
      dir="rtl"
      className={`flex flex-col rounded-xl border-2 min-h-[72px] text-right ${styles.column}${scrollable ? ' h-full max-h-full' : ''}`}
      data-news-column={variant}
    >
      <NewsColumnHeader title={title} count={count} countTextCls={styles.countText} />
      <div className={bodyCls}>
        {items.length === 0 ? (
          <p className={`${DASHBOARD_EMPTY_CLS} text-right py-2 px-0.5`}>{emptyMessage}</p>
        ) : (
          items.map((text, i) => (
            <NewsComparisonCard
              key={i}
              text={text}
              onSaveToBrain={onSaveToBrain}
              variant={variant}
              inColumn
              isLast={i === items.length - 1}
              bulkSelection={bulkSelection}
              bulkSections={bulkSections}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NewsNeutralBlock({ items, onSaveToBrain, scrollable = false, bulkSelection = null, bulkSections = [] }) {
  return (
    <NewsComparisonColumn
      variant="neutral"
      count={items.length}
      items={items}
      onSaveToBrain={onSaveToBrain}
      scrollable={scrollable}
      emptyMessage="לא נמצאו חדשות כלליות"
      bulkSelection={bulkSelection}
      bulkSections={bulkSections}
    />
  );
}

/** Unified comparison dashboard: Market Regime, Sectors, News side-by-side. */
export function MarketSignalsComparisonDashboard({ marketBriefData, newsItems = [], onSaveToBrain }) {
  const regimeCards = extractMarketRegimeCards(getSpecializedSrc(marketBriefData));
  const sectorRows = extractSectorRows(getSpecializedSrc(marketBriefData));
  const newsStrings = normalizeNewsStrings(newsItems);

  const regimeSplit = splitSignalsByTone(regimeCards, (c) => c.value);
  const sectorSplit = splitSignalsByTone(sectorRows, (r) => `${r.direction} ${r.relativeStrength}`);
  const regimePositive = regimeSplit.positive.map(({ key, label, value }, i) => (
    <RegimeCard
      key={key + label}
      label={label}
      value={stripInternalFieldLabels(value)}
      isLast={i === regimeSplit.positive.length - 1}
      columnVariant="positive"
    />
  ));
  const regimeNegative = regimeSplit.negative.map(({ key, label, value }, i) => (
    <RegimeCard
      key={key + label}
      label={label}
      value={stripInternalFieldLabels(value)}
      isLast={i === regimeSplit.negative.length - 1}
      columnVariant="negative"
    />
  ));

  const sectorPositiveCards = sectorSplit.positive.map((row, i) => (
    <SectorCard
      key={i}
      sector={row.sector}
      direction={row.direction}
      relativeStrength={row.relativeStrength}
      isLast={i === sectorSplit.positive.length - 1}
      columnVariant="positive"
    />
  ));
  const sectorNegativeCards = sectorSplit.negative.map((row, i) => (
    <SectorCard
      key={i}
      sector={row.sector}
      direction={row.direction}
      relativeStrength={row.relativeStrength}
      isLast={i === sectorSplit.negative.length - 1}
      columnVariant="negative"
    />
  ));

  const newsSplit3 = splitNewsByTone(newsStrings, (t) => t);
  const newsPositiveCards = newsSplit3.positive.map((text, i) => (
    <NewsComparisonCard key={i} text={text} onSaveToBrain={onSaveToBrain} variant="positive" />
  ));
  const newsNegativeCards = newsSplit3.negative.map((text, i) => (
    <NewsComparisonCard key={i} text={text} onSaveToBrain={onSaveToBrain} variant="negative" />
  ));

  return (
    <div className="space-y-3" dir="rtl" data-market-signals-dashboard>
      <SignalComparisonBlock
        sectionTitle={DISPLAY_SECTION_TITLES.marketRegime}
        bullishCount={regimeSplit.bullishCount}
        bearishCount={regimeSplit.bearishCount}
        positiveEmpty={regimeSplit.positive.length === 0}
        negativeEmpty={regimeSplit.negative.length === 0}
        positiveContent={regimePositive}
        negativeContent={regimeNegative}
        dataSection="regime"
      />
      <SignalComparisonBlock
        sectionTitle={DISPLAY_SECTION_TITLES.sectors}
        bullishCount={sectorSplit.bullishCount}
        bearishCount={sectorSplit.bearishCount}
        positiveEmpty={sectorSplit.positive.length === 0}
        negativeEmpty={sectorSplit.negative.length === 0}
        positiveContent={sectorPositiveCards}
        negativeContent={sectorNegativeCards}
        dataSection="sectors"
      />
      <SignalComparisonBlock
        sectionTitle={DISPLAY_SECTION_TITLES.news}
        bullishCount={newsSplit3.bullishCount}
        bearishCount={newsSplit3.bearishCount}
        positiveEmpty={newsSplit3.positive.length === 0}
        negativeEmpty={newsSplit3.negative.length === 0}
        positiveContent={newsPositiveCards}
        negativeContent={newsNegativeCards}
        dataSection="news"
      />
      {newsSplit3.neutral.length > 0 && (
        <NewsNeutralBlock items={newsSplit3.neutral} onSaveToBrain={onSaveToBrain} scrollable />
      )}
    </div>
  );
}

function RegimeListItem({
  label,
  value,
  isLast = false,
  columnVariant,
  bulkSelection = null,
  bulkSections = [],
  stacked = false,
}) {
  const displayText = `${translateMarketStatusLabel(label)}: ${stripInternalFieldLabels(value)}`;
  const displayValue = stripInternalFieldLabels(value);
  const rowCtx = { indicator: translateMarketStatusLabel(label), description: displayValue };
  const numericDisplay = displayValue ? getMacroFieldDisplay(displayValue, rowCtx) : null;

  return (
    <UniversalTabSelectRow
      className="group"
      checkbox={(
        <MorningBriefBulkCheckbox
          bulkSections={bulkSections}
          sectionKey="market-regime"
          text={displayText}
          sectionLabel="📊 מצב שוק"
          tabKey="market-regime"
          bulkSelection={bulkSelection}
        />
      )}
      actions={(
        <BriefQuickSaveActions
          bulkSelection={bulkSelection}
          text={displayText}
          sectionLabel="📊 מצב שוק"
          tabKey="market-regime"
        />
      )}
    >
      {stacked ? (
        <div dir="rtl" className="min-w-0 text-right" data-regime-item>
          <div className="flex items-start gap-x-4 min-w-0">
            <span className={`shrink-0 w-[24%] min-w-[8rem] max-w-[14rem] ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
              {translateMarketStatusLabel(label)}
            </span>
            <span className="flex-1 min-w-0 text-right break-words [overflow-wrap:anywhere] leading-snug">
              {numericDisplay ? (
                <NumericChangeSpan display={numericDisplay} />
              ) : (
                <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{displayValue || '—'}</span>
              )}
            </span>
          </div>
        </div>
      ) : (
        <RegimeRow
          label={translateMarketStatusLabel(label)}
          value={displayValue}
          isLast={isLast}
          columnVariant={columnVariant}
        />
      )}
    </UniversalTabSelectRow>
  );
}

function RegimeStackedGroup({
  variant,
  title,
  count,
  cards,
  emptyMessage,
  bulkSelection = null,
  bulkSections = [],
  hideWhenEmpty = true,
}) {
  if (hideWhenEmpty && cards.length === 0) return null;

  const styles = newsColumnVariantStyles(variant);

  return (
    <div
      dir="rtl"
      className={`rounded-lg border overflow-hidden text-right ${styles.column}`}
      data-regime-group={variant}
    >
      <DashboardColumnHeader title={title} count={count} countTextCls={styles.countText} />
      <div className="divide-y divide-slate-100/80 dark:divide-zinc-800/50">
        {cards.length === 0 ? (
          <p className={`${DASHBOARD_EMPTY_CLS} text-center py-3 px-2.5`}>{emptyMessage}</p>
        ) : (
          cards.map((card, i) => (
            <div
              key={card.key + card.label}
              className={`px-2.5 py-1.5 ${COMPARISON_ROW_HOVER} transition-colors`}
            >
              <RegimeListItem
                label={card.label}
                value={card.value}
                isLast={i === cards.length - 1}
                columnVariant={variant}
                bulkSelection={bulkSelection}
                bulkSections={bulkSections}
                stacked
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RegimeComparisonColumn({
  variant,
  title,
  count,
  cards,
  scrollable = false,
  emptyMessage,
  bulkSelection = null,
  bulkSections = [],
}) {
  const styles = newsColumnVariantStyles(variant);
  const bodyCls = scrollable
    ? 'flex-1 min-h-0 overflow-y-auto px-3 py-1 max-h-[min(38vh,300px)]'
    : 'px-3 py-1';

  return (
    <div
      dir="rtl"
      className={`flex flex-col rounded-xl border-2 min-h-[100px] text-right ${styles.column}${scrollable ? ' h-full max-h-full' : ''}`}
      data-regime-column={variant}
    >
      <DashboardColumnHeader
        title={title}
        count={count}
        countTextCls={styles.countText}
      />
      <div className={bodyCls}>
        {cards.length === 0 ? (
          <p className={`${DASHBOARD_EMPTY_CLS} text-center py-4`}>{emptyMessage}</p>
        ) : (
          cards.map((card, i) => (
            <RegimeListItem
              key={card.key + card.label}
              label={card.label}
              value={card.value}
              isLast={i === cards.length - 1}
              columnVariant={variant}
              bulkSelection={bulkSelection}
              bulkSections={bulkSections}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RegimeNeutralBlock({ cards, scrollable = false, bulkSelection = null, bulkSections = [] }) {
  return (
    <RegimeComparisonColumn
      variant="neutral"
      title={DISPLAY_COLUMN_TITLES.regime.neutral}
      count={cards.length}
      cards={cards}
      scrollable={scrollable}
      emptyMessage="לא נמצאו פריטי מצב שוק ניטרליים"
      bulkSelection={bulkSelection}
      bulkSections={bulkSections}
    />
  );
}


/** Compact מצב שוק table: ☐ | אינדיקטור | סנטימנט | הערה / סיבה | save */
function MarketRegimeTable({ rows, bulkSections, bulkSelection }) {
  if (!rows.length) return null;

  return (
    <BriefTableWrapper>
      <table className={BRIEF_TABLE_CLS} dir="rtl">
        <colgroup>
          <col style={{ width: BRIEF_COL.checkbox }} />
          <col style={{ width: BRIEF_COL.primaryLabel }} />
          <col style={{ width: BRIEF_COL.sentiment }} />
          <col style={{ width: BRIEF_COL.change }} />
          <col />
          <col style={{ width: BRIEF_COL.save }} />
        </colgroup>
        <thead>
          <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
            <th className="py-1.5 pr-2 pl-0" aria-label="בחירה" />
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>אינדיקטור</th>
            <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
            <th className="py-1.5 px-2" aria-label="שינוי" />
            <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הערה / סיבה</th>
            <th className="py-1.5 pl-1 pr-0" aria-label="שמירה" />
          </tr>
        </thead>
        <tbody>
          {rows.map((card) => {
            const displayLabel = translateMarketStatusLabel(card.label);
            const displayText = formatMorningBriefRegimeText(card);
            const displayValue = stripInternalFieldLabels(card.value);
            const rowCtx = { indicator: displayLabel, description: displayValue };
            const externalLink = resolveMarketRegimeRowLink(card);

            return (
              <tr
                key={card.key + card.label}
                className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group"
              >
                <td className={BRIEF_CELL.checkbox}>
                  <div className="flex flex-col items-center gap-1">
                    <MorningBriefBulkCheckbox
                      bulkSections={bulkSections}
                      sectionKey="market-regime"
                      text={displayText}
                      sectionLabel="📊 מצב שוק"
                      tabKey="market-regime"
                      bulkSelection={bulkSelection}
                    />
                  </div>
                </td>
                <td className={BRIEF_CELL.short}>
                  {externalLink ? (
                    <a
                      href={externalLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="פתיחה באתר חיצוני"
                      aria-label={externalLink.ariaLabel}
                      onClick={(event) => event.stopPropagation()}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-sm ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:hover:text-indigo-300`}
                      data-market-regime-link={externalLink.id}
                    >
                      <span>{displayLabel}</span>
                      <span className="text-xs" aria-hidden>↗</span>
                    </a>
                  ) : (
                    <span className={DASHBOARD_TABLE_CELL_PRIMARY_CLS}>{displayLabel}</span>
                  )}
                </td>
                <td className={BRIEF_CELL.sentiment}>
                  <InlineSentimentBadge
                    sentKey={card.sentKey}
                    className={BRIEF_SENTIMENT_INLINE_CLS}
                  />
                </td>
                <td className={BRIEF_CELL.change} />
                <td className={BRIEF_CELL.notes}>
                  <BriefNewsNotesText text={displayValue} row={rowCtx} translateIndicatorEnums />
                </td>
                <td className="py-2 pl-1 pr-0 align-middle">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <BriefQuickSaveActions
                      bulkSelection={bulkSelection}
                      text={displayText}
                      sectionLabel="📊 מצב שוק"
                      tabKey="market-regime"
                    />
                  </div>
                  {isRowAlreadySaved(displayText, 'market-regime', bulkSelection?.savedRowIndex) && <SavedRowIndicator />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </BriefTableWrapper>
  );
}

// ── 1. Market Regime ─────────────────────────────────────────────────
export function MarketRegimeSection({ marketBriefData, onSaveMarketBriefSection, bulkSelection = null, bulkSections = [], presentation }) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.marketRegime, { marketBriefData, onSaveMarketBriefSection, presentation });
  const cards = extractMarketRegimeCards(getSpecializedSrc(marketBriefData));
  const split = splitNewsByTone(cards, (c) => stripInternalFieldLabels(c.value));

  return (
    <SectionCard
      title={(
        <a
          href={FINVIZ_MARKET_MAP_LINK.url}
          target="_blank"
          rel="noopener noreferrer"
          title="פתיחה באתר חיצוני"
          aria-label={FINVIZ_MARKET_MAP_LINK.ariaLabel}
          className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:hover:text-indigo-300"
          data-market-regime-heading-link
        >
          <span>📊 מצב שוק</span>
          <span className="text-xs" aria-hidden>↗</span>
        </a>
      )}
      count={morningBriefSectionCount(presentation, cards.length)}
      tone={TONE.NEUTRAL}
      isEmpty={!edit.editing && cards.length === 0}
      emptyMessage="מצב שוק, רוחב, Risk On/Off ותנודתיות יוצגו כאן"
      plainSurface
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'market-regime', '📊 מצב שוק', { disabled: edit.editing })}
      sectionSelectAllItems={!edit.editing ? resolveMorningBriefSectionChildItems(bulkSections, 'market-regime') : null}
      bulkSelection={bulkSelection}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.marketRegime}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <div dir="rtl" data-regime-comparison>
        <MarketRegimeTable
          rows={[
            ...split.positive.map((c) => ({ ...c, sentKey: 'positive' })),
            ...split.neutral.map((c) => ({ ...c, sentKey: 'neutral' })),
            ...split.negative.map((c) => ({ ...c, sentKey: 'negative' })),
          ]}
          bulkSections={bulkSections}
          bulkSelection={bulkSelection}
        />
      </div>
      )}
    </SectionCard>
  );
}

// ── 2. Markets ───────────────────────────────────────────────────────
export function MarketsSection({
  marketBriefData,
  indicesItems = [],
  onSaveToBrain,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
  presentation,
}) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.markets, { marketBriefData, onSaveMarketBriefSection, presentation });
  const marketRows = getMorningBriefMarketRows(marketBriefData, indicesItems);

  const bullishCount = marketRows.filter((r) => marketRowSentimentKey(r) === 'positive').length;
  const bearishCount = marketRows.filter((r) => marketRowSentimentKey(r) === 'negative').length;
  const neutralCount = marketRows.filter((r) => marketRowSentimentKey(r) === 'neutral').length;

  return (
    <SectionCard
      title={DISPLAY_SECTION_TITLES.markets}
      count={morningBriefSectionCount(presentation, marketRows.length)}
      tone={TONE.NEUTRAL}
      plainSurface
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'markets', DISPLAY_SECTION_TITLES.markets, { disabled: edit.editing })}
      sectionSelectAllItems={!edit.editing ? resolveMorningBriefSectionChildItems(bulkSections, 'markets') : null}
      bulkSelection={bulkSelection}
      headerPills={morningBriefShowsSummaryCounters(presentation) && !edit.editing ? (
        <ComparisonSummaryPills
          pills={[
            { count: bullishCount, label: 'חיוביות', tone: 'positive' },
            { count: neutralCount, label: 'ניטרלי', tone: 'watch' },
            { count: bearishCount, label: 'שליליות', tone: 'negative' },
          ]}
        />
      ) : null}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.markets}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <div dir="rtl" data-markets-section>
        <MorningBriefMarketsTable
          marketBriefData={marketBriefData}
          items={indicesItems}
          onSaveToBrain={onSaveToBrain}
          showEmpty
          bulkSelection={bulkSelection}
          bulkSections={bulkSections}
          presentation={presentation}
        />
      </div>
      )}
    </SectionCard>
  );
}

function SectorComparisonColumn({
  variant,
  title,
  count,
  rows,
  scrollable = false,
  emptyMessage,
  bulkSelection = null,
  bulkSections = [],
}) {
  const isPositive = variant === 'positive';
  const bodyCls = scrollable
    ? 'flex-1 min-h-0 overflow-y-auto px-3 py-1 max-h-[min(38vh,300px)]'
    : 'px-3 py-1';

  return (
    <div
      dir="rtl"
      className={`flex flex-col rounded-xl border-2 min-h-[120px] text-right ${
        newsColumnVariantStyles(isPositive ? 'positive' : 'negative').column
      }${scrollable ? ' h-full max-h-full' : ''}`}
      data-sector-column={variant}
    >
      <DashboardColumnHeader
        title={title}
        count={count}
        countTextCls={newsColumnVariantStyles(isPositive ? 'positive' : 'negative').countText}
      />
      <div className={bodyCls}>
        {rows.length === 0 ? (
          <p className={`${DASHBOARD_EMPTY_CLS} text-center py-6`}>{emptyMessage}</p>
        ) : (
          rows.map((row, i) => {
            const sectorText = [row.sector, row.direction, row.relativeStrength].filter(Boolean).join(' · ');
            const sectorBulkText = formatMorningBriefSectorText(row);
            return (
              <UniversalTabSelectRow
                key={i}
                className="group"
                checkbox={(
                  <MorningBriefBulkCheckbox
                    bulkSections={bulkSections}
                    sectionKey="sectors"
                    text={sectorBulkText}
                    sectionLabel="🏭 סקטורים"
                    tabKey="brief-sectors"
                    bulkSelection={bulkSelection}
                  />
                )}
                actions={(
                  <BriefQuickSaveActions
                    bulkSelection={bulkSelection}
                    text={sectorText}
                    sectionLabel="🏭 סקטורים"
                    tabKey="brief-sectors"
                  />
                )}
              >
                <SectorRow
                  sector={row.sector}
                  direction={row.direction}
                  relativeStrength={row.relativeStrength}
                  isLast={i === rows.length - 1}
                  columnVariant={variant}
                />
              </UniversalTabSelectRow>
            );
          })
        )}
      </div>
    </div>
  );
}

function SectorNeutralBlock({ rows, bulkSelection = null, bulkSections = [] }) {
  if (!rows.length) return null;
  return (
    <div
      dir="rtl"
      className={`rounded-xl border-2 text-right ${newsColumnVariantStyles('neutral').column}`}
      data-sector-neutral
    >
      <DashboardColumnHeader
        title={DISPLAY_COLUMN_TITLES.sectors.neutral}
        count={rows.length}
        countTextCls={newsColumnVariantStyles('neutral').countText}
      />
      <div className="px-3 py-1">
        {rows.map((row, i) => {
          const sectorText = [row.sector, row.direction, row.relativeStrength].filter(Boolean).join(' · ');
          const sectorBulkText = formatMorningBriefSectorText(row);
          return (
            <UniversalTabSelectRow
              key={i}
              className="group"
              checkbox={(
                <MorningBriefBulkCheckbox
                  bulkSections={bulkSections}
                  sectionKey="sectors"
                  text={sectorBulkText}
                  sectionLabel="🏭 סקטורים"
                  tabKey="brief-sectors"
                  bulkSelection={bulkSelection}
                />
              )}
              actions={(
                <BriefQuickSaveActions
                  bulkSelection={bulkSelection}
                  text={sectorText}
                  sectionLabel="🏭 סקטורים"
                  tabKey="brief-sectors"
                />
              )}
            >
              <SectorRow
                sector={row.sector}
                direction={row.direction}
                relativeStrength={row.relativeStrength}
                isLast={i === rows.length - 1}
                columnVariant="neutral"
              />
            </UniversalTabSelectRow>
          );
        })}
      </div>
    </div>
  );
}

// ── 3. Sectors ───────────────────────────────────────────────────────
const FINVIZ_GROUPS_URL = 'https://finviz.com/groups';
const FINVIZ_GROUPS_ARIA_LABEL = 'פתיחת סקירת הסקטורים והקבוצות באתר Finviz';

function SectorGroupsHeaderLink() {
  return (
    <a
      href={FINVIZ_GROUPS_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={FINVIZ_GROUPS_ARIA_LABEL}
      title="השוואת ביצועים בין סקטורים ב־Finviz"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900"
      data-sector-groups-finviz-link
    >
      <span>סקירת סקטורים ב־Finviz</span>
      <span aria-hidden="true" className="text-sm leading-none">↗</span>
    </a>
  );
}

export function SectorOverviewSection({ marketBriefData, onSaveMarketBriefSection, bulkSelection = null, bulkSections = [], presentation }) {
  const ui = resolveMorningBriefPresentation(presentation);
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.sectors, { marketBriefData, onSaveMarketBriefSection, presentation });
  const rows = extractSectorRows(getSpecializedSrc(marketBriefData));
  const split = splitNewsByTone(rows, (r) => `${r.sentiment} ${r.direction} ${r.relativeStrength}`);

  return (
    <SectionCard
      title="🏭 סקטורים"
      count={morningBriefSectionCount(presentation, rows.length)}
      tone={TONE.NEUTRAL}
      isEmpty={!edit.editing && rows.length === 0}
      emptyMessage="ביצועי סקטורים ורוטציה יוצגו כאן"
      plainSurface
      headerLinks={<SectorGroupsHeaderLink />}
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'sectors', '🏭 סקטורים', { disabled: edit.editing })}
      sectionSelectAllItems={!edit.editing ? resolveMorningBriefSectionChildItems(bulkSections, 'sectors') : null}
      bulkSelection={bulkSelection}
      headerPills={morningBriefShowsSummaryCounters(presentation) && !edit.editing ? (
        <ThreeToneSummaryPills
          bullishCount={split.bullishCount}
          neutralCount={split.neutral.length}
          bearishCount={split.bearishCount}
          labels={{ positive: 'חיוביים', neutral: 'ניטרליים', negative: 'שליליים' }}
          showNeutralWhenEmpty={false}
        />
      ) : null}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.sectors}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <div dir="rtl" data-sector-comparison>
        <MarketSectorTable
          showHelperLinks={ui.showHelperLinks}
          rows={[
            ...split.positive.map((r) => ({ ...r, sentKey: 'positive' })),
            ...split.negative.map((r) => ({ ...r, sentKey: 'negative' })),
            ...split.neutral.map((r) => ({ ...r, sentKey: 'neutral' })),
          ]}
          getRowOptions={(row) => ({ sentKey: row.sentKey })}
          renderLeadingCell={(row, _i, normalized) => (
            <div className="flex flex-col items-center gap-1">
              <MorningBriefBulkCheckbox
                bulkSections={bulkSections}
                sectionKey="sectors"
                text={formatMorningBriefSectorText(row)}
                sectionLabel="🏭 סקטורים"
                tabKey="brief-sectors"
                bulkSelection={bulkSelection}
              />
            </div>
          )}
          renderTrailingCell={(row, _i, normalized) => (
            <BriefQuickSaveActions
              bulkSelection={bulkSelection}
              text={normalized.rowText}
              sectionLabel="🏭 סקטורים"
              tabKey="brief-sectors"
            />
          )}
          renderTrailingBadge={(row, _i) => (
            isRowAlreadySaved(formatMorningBriefSectorText(row), 'brief-sectors', bulkSelection?.savedRowIndex)
              ? <SavedRowIndicator />
              : null
          )}
        />
      </div>
      )}
    </SectionCard>
  );
}

// ── 4. News ──────────────────────────────────────────────────────────
const NEWS_EXTERNAL_SOURCES = Object.freeze([
  {
    key: 'investing-il',
    visibleLabel: 'חדשות בעברית',
    sourceLabel: 'Investing ישראל',
    url: 'https://il.investing.com/news',
    ariaLabel: 'פתיחת חדשות כלכלה ושוק ההון באתר Investing.com ישראל',
  },
  {
    key: 'reuters',
    visibleLabel: 'חדשות מהעולם',
    sourceLabel: 'Reuters',
    url: 'https://www.reuters.com/markets/',
    ariaLabel: 'פתיחת חדשות השווקים בעולם באתר Reuters',
  },
]);

function NewsExternalLinkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3H3.75A1.75 1.75 0 0 0 2 4.75v7.5C2 13.22 2.78 14 3.75 14h7.5A1.75 1.75 0 0 0 13 12.25V10" />
      <path d="M9 2h5v5M14 2 7.5 8.5" />
    </svg>
  );
}

function NewsSectionHeadingLink() {
  return (
    <a
      href={NEWS_EXTERNAL_SOURCES[0].url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={NEWS_EXTERNAL_SOURCES[0].ariaLabel}
      title="פתיחה באתר חיצוני"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900"
      data-news-heading-link
    >
      <span>📰 חדשות</span>
      <NewsExternalLinkIcon />
    </a>
  );
}

function NewsExternalSourceLinks() {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" data-news-source-links>
      {NEWS_EXTERNAL_SOURCES.map((source) => (
        <a
          key={source.key}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={source.ariaLabel}
          title="פתיחה באתר חיצוני"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900"
          data-news-source={source.key}
        >
          <span>{source.visibleLabel}</span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">{source.sourceLabel}</span>
          <NewsExternalLinkIcon />
        </a>
      ))}
    </div>
  );
}

export function NewsSection({
  items = [],
  onSaveToBrain,
  marketBriefData,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
  presentation,
}) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.news, {
    marketBriefData,
    onSaveMarketBriefSection,
    newsItems: items,
    presentation,
  });
  const normalizedNews = normalizeNewsItems(items);

  return (
    <SectionCard
      title={<NewsSectionHeadingLink />}
      count={morningBriefSectionCount(presentation, normalizedNews.length)}
      tone={TONE.NEUTRAL}
      isEmpty={!edit.editing && normalizedNews.length === 0}
      emptyMessage="כותרות ועדכוני שוק יוצגו כאן"
      plainSurface
      headerLinks={<NewsExternalSourceLinks />}
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'news', '📰 חדשות', { disabled: edit.editing })}
      sectionSelectAllItems={!edit.editing ? resolveMorningBriefSectionChildItems(bulkSections, 'news') : null}
      bulkSelection={bulkSelection}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.news}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <MorningBriefNewsSection
        items={items}
        onSaveToBrain={onSaveToBrain}
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
      )}
    </SectionCard>
  );
}

// ── 5. Macro ─────────────────────────────────────────────────────────
function macroRowChangeContext(row) {
  return [row?.impact, row?.description, row?.indicator, row?.value].filter(Boolean).join(' ');
}

function MacroChangeCell({ display, rawValue }) {
  if (!display && !String(rawValue || '').trim()) {
    return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  }

  if (display?.kind === 'percent' || display?.kind === 'neutral') {
    return <NumericChangeSpan display={{ ...display, arrow: null }} />;
  }

  const translated = translateIndicatorEnumValue(display?.text ?? rawValue);
  const textClass = display?.cls || 'font-semibold text-slate-500 dark:text-zinc-400';
  return <span className={textClass}>{translated}</span>;
}

function MacroRowSummary(row) {
  return formatMorningBriefMacroText(row);
}

export function MacroSection({
  items = [],
  marketBriefData,
  onSaveToBrain,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
  presentation,
}) {
  const ui = resolveMorningBriefPresentation(presentation);
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.macro, { marketBriefData, onSaveMarketBriefSection, presentation });
  const src = getSpecializedSrc(marketBriefData);
  const fromSrc = extractMacroIndicatorRows(src);
  const marketRows = extractMarketDashboardRows(src);
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const rows = cleanupMacroDisplayRows(mergeMacroDisplayRows(fromSrc, safeItems), marketRows)
    .filter((row) => Boolean(row.value || row.change || row.description || row.impact || row.frequency));

  return (
    <SectionCard
      title={DISPLAY_SECTION_TITLES.macro}
      count={morningBriefSectionCount(presentation, rows.length)}
      tone={TONE.NEUTRAL}
      isEmpty={!edit.editing && rows.length === 0}
      emptyMessage="גורמי מאקרו, אירועים כלכליים ו-VIX יוצגו כאן"
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'macro', DISPLAY_SECTION_TITLES.macro, { disabled: edit.editing })}
      sectionSelectAllItems={!edit.editing ? resolveMorningBriefSectionChildItems(bulkSections, 'macro') : null}
      bulkSelection={bulkSelection}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.macro}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <div dir="rtl" data-macro-section>
        <BriefTableWrapper>
          <table className={BRIEF_TABLE_CLS} dir="rtl">
            <colgroup>
              <col style={{ width: BRIEF_COL.checkbox }} />
              <col style={{ width: BRIEF_COL.indicator }} />
              <col style={{ width: BRIEF_COL.macroValue }} />
              <col style={{ width: BRIEF_COL.change }} />
              <col style={{ width: BRIEF_COL.sentiment }} />
              <col />
              <col style={{ width: BRIEF_COL.save }} />
            </colgroup>
            <thead>
              <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
                <th className="py-1.5 pr-2 pl-0" />
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>אינדיקטור</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>ערך</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>שינוי / מגמה</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
                <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>תיאור / השפעה</th>
                <th className="py-1.5 pl-1 pr-0" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const summary = MacroRowSummary(row);
                const rowTone = resolveTone([row.change, row.impact, row.description].filter(Boolean).join(' '));
                const rowBorder = toneStyles(rowTone).border;
                const sentKey = toneToSentKey(rowTone);
                const changeDisplay = getMacroChangeDisplay(row.change, macroRowChangeContext(row));
                return (
                  <tr
                    key={i}
                    className={`border-b border-slate-100 dark:border-zinc-800/60 ${COMPARISON_ROW_HOVER} transition-colors group border-r-2 ${rowBorder}`}
                    data-macro-row
                  >
                    <td className={BRIEF_CELL.checkbox}>
                      <div className="flex flex-col items-center gap-1">
                        <MorningBriefBulkCheckbox
                          bulkSections={bulkSections}
                          sectionKey="macro"
                          text={summary}
                          sectionLabel="🌍 מאקרו"
                          tabKey="brief-macro"
                          bulkSelection={bulkSelection}
                        />
                      </div>
                    </td>
                    <td className={BRIEF_CELL.short}>
                      <div className="flex items-center gap-1 min-w-0">
                        {(() => {
                          const macroUrl = row.indicator ? getMacroIndicatorUrl(row.indicator) : null;
                          const displayIndicator = row.indicator ? translateMarketLabel(row.indicator) : '—';
                          return macroUrl ? (
                            <a
                              href={macroUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="פתח מקור נתונים ↗"
                              aria-label="פתח מקור נתונים"
                              onClick={(e) => e.stopPropagation()}
                              className={`truncate hover:underline cursor-pointer ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}
                            >
                              {displayIndicator}
                            </a>
                          ) : (
                            <span className={`truncate ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{displayIndicator}</span>
                          );
                        })()}
                        {changeDisplay?.arrow && changeDisplay.arrow !== '●' && (
                          <span className={`shrink-0 text-base font-bold leading-none ${changeDisplay.cls}`} aria-hidden>
                            {changeDisplay.arrow}
                          </span>
                        )}
                      </div>
                      {ui.showRowMetadata && row.frequency && (
                        <p className={`mt-0.5 ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>
                          {translateKnownIndicatorEnumValue(row.frequency)}
                        </p>
                      )}
                    </td>
                    <td className={BRIEF_CELL.change}>
                      {row.value ? (
                        <p className={`tabular-nums ${DASHBOARD_TABLE_CELL_BODY_CLS}`}>
                          {translateKnownIndicatorEnumValue(row.value)}
                        </p>
                      ) : (
                        <span className="text-slate-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className={BRIEF_CELL.change}>
                      <MacroChangeCell display={changeDisplay} rawValue={row.change} />
                    </td>
                    <td className={BRIEF_CELL.sentiment}>
                      <InlineSentimentBadge
                        sentKey={sentKey}
                        className={BRIEF_SENTIMENT_INLINE_CLS}
                      />
                    </td>
                    <td className={BRIEF_CELL.notes}>
                      {row.description && (
                        <BriefNewsNotesText
                          text={row.description}
                          row={row}
                          translateIndicatorEnums
                        />
                      )}
                      {row.impact && (
                        <BriefNewsNotesText
                          text={row.impact}
                          row={row}
                          className={row.description ? 'mt-0.5' : ''}
                          translateIndicatorEnums
                        />
                      )}
                      {!row.description && !row.impact && (
                        <span className="text-slate-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-2 pl-1 pr-0 align-middle">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <StaticVideoTimestampLink
                          items={row.rowTimestampSourceItems}
                          section="macro"
                          productionRowId={`specialized:macro:${row.indicator || i}`}
                          displayText={summary}
                        />
                        {onSaveToBrain ? (
                          <BriefRowSaveActions
                            bulkSelection={bulkSelection}
                            text={summary}
                            sectionLabel="🌍 מאקרו"
                            tabKey="brief-macro"
                            onSaveToBrain={onSaveToBrain}
                          />
                        ) : (
                          <BriefQuickSaveActions
                            bulkSelection={bulkSelection}
                            text={summary}
                            sectionLabel="🌍 מאקרו"
                            tabKey="brief-macro"
                          />
                        )}
                      </div>
                      {isRowAlreadySaved(summary, 'brief-macro', bulkSelection?.savedRowIndex) && <SavedRowIndicator />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </BriefTableWrapper>
      </div>
      )}
    </SectionCard>
  );
}

// ── 6. Sentiment ─────────────────────────────────────────────────────

/**
 * Parses a sentiment value field into clean display parts.
 * Handles:
 *   - plain numbers: "17.3", "62"
 *   - number + text: "62 — ניטרלי", "0.82 bullish"
 *   - structured AI output: "value: 17.3 | status: ניטרלי | description: ..."
 *   - plain text: "שורי", "neutral"
 * Returns { numericText, descriptionText } — both may be null.
 */
function parseSentimentValueForDisplay(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { numericText: null, descriptionText: null };

  // Structured format: "key: val | key: val | ..."
  if (/\w+\s*:\s*.+\|/.test(text)) {
    const parts = {};
    text.split('|').forEach((seg) => {
      const m = seg.match(/^\s*(\w+)\s*:\s*([\s\S]+?)\s*$/);
      if (m) parts[m[1].toLowerCase()] = m[2].trim();
    });
    const numRaw = parts['value'] ?? parts['numeric'] ?? null;
    const numericText = numRaw && /^[+-]?\d+(\.\d+)?$/.test(numRaw) ? numRaw : null;
    const descriptionText = parts['description'] ?? parts['desc'] ?? null;
    return { numericText, descriptionText };
  }

  // Leading number — extract it, rest becomes description
  const leadingNum = text.match(/^([+-]?\d+(?:\.\d+)?)/);
  if (leadingNum) {
    const rest = text.slice(leadingNum[0].length).trim().replace(/^[—\-–·|,;]+\s*/, '').trim();
    return { numericText: leadingNum[0], descriptionText: rest || null };
  }

  // Pure text — no numeric
  return { numericText: null, descriptionText: text };
}

function sentimentLabelEmoji(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('מוסדי') || l.includes('institutional')) return '🏦';
  if (l.includes('פחד') || l.includes('fear') || l.includes('greed') || l.includes('חמדנות')) return '😨';
  if (l.includes('קמעונאי') || l.includes('retail')) return '🛒';
  if (l.includes('כללי') || l.includes('overall') || l.includes('אווירה')) return '📊';
  return '🧠';
}

function SentimentSectionTitleLink() {
  return (
    <a
      href={CNN_FEAR_GREED_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="פתיחת מדד הפחד והחמדנות של CNN"
      aria-label="פתיחת מדד הפחד והחמדנות של CNN"
      className="inline-flex items-center gap-1 rounded-sm hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:hover:text-indigo-300"
      onClick={(event) => event.stopPropagation()}
      data-sentiment-heading-link
    >
      <span>{DISPLAY_SECTION_TITLES.sentiment}</span>
      <span className="text-xs" aria-hidden>↗</span>
    </a>
  );
}

function SentimentListItem({
  label,
  value,
  bulkSelection = null,
  bulkSections = [],
}) {
  const valueText = String(value || '').trim();
  const displayLabel = translateKnownIndicatorEnumValue(translateSentimentLabel(label));
  const enumDisplayValue = translateKnownIndicatorEnumValue(valueText);
  const displayValue = enumDisplayValue !== valueText
    ? enumDisplayValue
    : translateSentimentValue(valueText);
  const rowCtx = { indicator: displayLabel, description: displayValue, impact: valueText };
  const display = displayValue ? getMacroFieldDisplay(displayValue, rowCtx) : null;
  const bulkText = `${label}: ${value}`;

  return (
    <UniversalTabSelectRow
      className={`${DASHBOARD_ITEM_ROW_CLS} text-right border-b border-slate-200/70 dark:border-zinc-700/50 last:border-b-0`}
      data-sentiment-item
      checkbox={(
        <MorningBriefBulkCheckbox
          bulkSections={bulkSections}
          sectionKey="sentiment"
          text={bulkText}
          sectionLabel="📊 סנטימנט"
          tabKey="brief-sentiment"
          bulkSelection={bulkSelection}
        />
      )}
      actions={(
        <BriefQuickSaveActions
          bulkSelection={bulkSelection}
          text={bulkText}
          sectionLabel="📊 סנטימנט"
          tabKey="brief-sentiment"
        />
      )}
    >
      <p className={`mb-1.5 ${DASHBOARD_TABLE_HEAD_CLS} text-slate-700 dark:text-zinc-200`}>
        <span className="me-1.5" aria-hidden>{sentimentLabelEmoji(displayLabel)}</span>
        {displayLabel}
      </p>
      {displayValue && (
        display ? (
          <NumericChangeSpan display={display} />
        ) : (
          <p className={DASHBOARD_TABLE_CELL_BODY_CLS}>{displayValue}</p>
        )
      )}
    </UniversalTabSelectRow>
  );
}

export function SentimentSection({
  marketBriefData,
  bulkSelection = null,
  bulkSections = [],
  presentation,
}) {
  const items = extractSentimentItems(getSpecializedSrc(marketBriefData));
  const tone = items.length > 0
    ? resolveTone(items.map((i) => i.value).join(' '))
    : TONE.NEUTRAL;

  return (
    <SectionCard
      title={<SentimentSectionTitleLink />}
      count={morningBriefSectionCount(presentation, items.length)}
      tone={tone}
      isEmpty={items.length === 0}
      emptyMessage="סנטימנט קמעונאי, מוסדי ופחד וחמדנות יוצגו כאן"
      equalHeaderLinkColumns
      headerLinks={(
        <>
          <FearGreedScoreCardContainer />
          <AAIIWeeklySentimentCardContainer />
        </>
      )}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'sentiment', DISPLAY_SECTION_TITLES.sentiment)}
      sectionSelectAllItems={resolveMorningBriefSectionChildItems(bulkSections, 'sentiment')}
      bulkSelection={bulkSelection}
    >
      <div dir="rtl" data-sentiment-list>
        <BriefTableWrapper>
          <table className={BRIEF_TABLE_CLS} dir="rtl">
            <colgroup>
              <col style={{ width: BRIEF_COL.checkbox }} />
              <col style={{ width: BRIEF_COL.primaryLabel }} />
              <col style={{ width: BRIEF_COL.sentiment }} />
              <col style={{ width: BRIEF_COL.change }} />
              <col />
              <col style={{ width: BRIEF_COL.save }} />
            </colgroup>
            <thead>
              <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
                <th className="py-1.5 pr-2 pl-0" />
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סוג</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>ערך</th>
                <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הערה</th>
                <th className="py-1.5 pl-1 pr-0" />
              </tr>
            </thead>
            <tbody>
              {items.map(({ label, value }, i) => {
                const valueText = String(value || '').trim();
                const displayLabel = translateKnownIndicatorEnumValue(translateSentimentLabel(label));
                const { numericText, descriptionText } = parseSentimentValueForDisplay(valueText);
                const visibleDescriptionText = translateKnownIndicatorEnumValue(descriptionText);
                const bulkText = `${label}: ${value}`;
                const itemTone = resolveTone(valueText);
                const sourceLink = getSentimentSourceLink({ label, value });
                return (
                  <tr key={`${label}-${i}`} className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group" data-sentiment-item>
                    <td className={BRIEF_CELL.checkbox}>
                      <div className="flex flex-col items-center gap-1">
                        <MorningBriefBulkCheckbox
                          bulkSections={bulkSections}
                          sectionKey="sentiment"
                          text={bulkText}
                          sectionLabel="📊 סנטימנט"
                          tabKey="brief-sentiment"
                          bulkSelection={bulkSelection}
                        />
                      </div>
                    </td>
                    <td className={BRIEF_CELL.short}>
                      {sourceLink ? (
                        <a
                          href={sourceLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={sourceLink.ariaLabel || 'פתיחת מקור סנטימנט'}
                          aria-label={sourceLink.ariaLabel || 'פתיחת מקור סנטימנט'}
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-sm ${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
                          onClick={(event) => event.stopPropagation()}
                          data-contextual-sentiment-link={sourceLink.id}
                        >
                          <span className="me-1.5" aria-hidden>{sentimentLabelEmoji(displayLabel)}</span>
                          {displayLabel}
                          <span className="text-xs" aria-hidden>↗</span>
                        </a>
                      ) : (
                        <span className={`whitespace-nowrap ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
                          <span className="me-1.5" aria-hidden>{sentimentLabelEmoji(displayLabel)}</span>
                          {displayLabel}
                        </span>
                      )}
                    </td>
                    <td className={BRIEF_CELL.sentiment}>
                      <InlineSentimentBadge
                        sentKey={toneToSentKey(itemTone)}
                        className={BRIEF_SENTIMENT_INLINE_CLS}
                      />
                    </td>
                    <td className={BRIEF_CELL.change}>
                      {numericText ? (
                        <span className={`tabular-nums ${DASHBOARD_TABLE_CELL_BODY_CLS}`}>{numericText}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className={BRIEF_CELL.notes}>
                      <p className={`${BRIEF_NOTES_TEXT_CLS} line-clamp-3`}>
                        {visibleDescriptionText || '—'}
                      </p>
                    </td>
                    <td className="py-2 pl-1 pr-0 align-middle">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <BriefQuickSaveActions
                          bulkSelection={bulkSelection}
                          text={bulkText}
                          sectionLabel="📊 סנטימנט"
                          tabKey="brief-sentiment"
                        />
                      </div>
                      {isRowAlreadySaved(bulkText, 'brief-sentiment', bulkSelection?.savedRowIndex) && <SavedRowIndicator />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </BriefTableWrapper>
      </div>
    </SectionCard>
  );
}

// ── 7. Economic Calendar ─────────────────────────────────────────────
function CalendarTypeBadge({ type }) {
  if (!type) return <span className={`text-slate-300 dark:text-zinc-600 ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>—</span>;
  return (
    <span className={`inline whitespace-nowrap ${DASHBOARD_TABLE_CELL_BODY_CLS} text-slate-500 dark:text-zinc-400`}>
      {translateMarketLabel(type)}
    </span>
  );
}

const CALENDAR_IMPORTANCE_LABEL = {
  CRITICAL:      'קריטי',
  HIGH:          'גבוהה',
  'MEDIUM-HIGH': 'בינונית-גבוהה',
  MEDIUM:        'בינונית',
  'MEDIUM-LOW':  'בינונית-נמוכה',
  LOW:           'נמוכה',
};

function CalendarImportanceDot({ level }) {
  const meta = importanceStyles(level);
  if (!meta) return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  const label = CALENDAR_IMPORTANCE_LABEL[meta.label]
    ?? translateImportanceLevel(meta.label)
    ?? meta.label;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${meta.cls}`}
    >
      {label}
    </span>
  );
}

function CalendarTableRow({ row, bulkSections, bulkSelection }) {
  const calendarText = [row.event, row.date, row.importance, row.impact].filter(Boolean).join(' · ');
  const calendarBulkText = formatMorningBriefCalendarText(row);

  return (
    <tr className={`border-b border-slate-100/80 dark:border-zinc-800/40 ${COMPARISON_ROW_HOVER} transition-colors group`} data-calendar-row>
      <td className={BRIEF_CELL.checkbox}>
        <div className="flex flex-col items-center gap-1">
          <MorningBriefBulkCheckbox
            bulkSections={bulkSections}
            sectionKey="economic-calendar"
            text={calendarBulkText}
            sectionLabel="📅 לוח כלכלי"
            tabKey="brief-calendar"
            bulkSelection={bulkSelection}
          />
        </div>
      </td>
      <td className={BRIEF_CELL.short}>
        <p className={`${BRIEF_NOTES_TEXT_CLS}`} title={row.event}>
          {row.event || '—'}
        </p>
      </td>
      <td className={BRIEF_CELL.sentiment}>
        <CalendarImportanceDot level={row.importance} />
      </td>
      <td className={BRIEF_CELL.change}>
        {row.date ? (
          <p className={`${DASHBOARD_TABLE_CELL_DATE_CLS} whitespace-nowrap`}>{translateMarketLabel(row.date)}</p>
        ) : (
          <span className="text-slate-300 dark:text-zinc-600">—</span>
        )}
      </td>
      <td className={BRIEF_CELL.notes}>
        <BriefNewsNotesText
          text={translateSentimentValue(row.impact)}
          row={{ indicator: row.event, description: row.impact }}
          empty={null}
        />
        {!row.impact && (
          <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>
        )}
      </td>
      <td className="py-2 pl-1 pr-0 align-middle">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <BriefQuickSaveActions
            bulkSelection={bulkSelection}
            text={calendarText}
            sectionLabel="📅 לוח כלכלי"
            tabKey="brief-calendar"
          />
        </div>
        {isRowAlreadySaved(calendarBulkText, 'brief-calendar', bulkSelection?.savedRowIndex) && <SavedRowIndicator />}
      </td>
    </tr>
  );
}

export function EconomicCalendarSection({
  marketBriefData,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
  presentation,
}) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.economicCalendar, { marketBriefData, onSaveMarketBriefSection, presentation });
  const rows = mergeCalendarRows(extractCalendarRows(getSpecializedSrc(marketBriefData)));

  return (
    <SectionCard
      title={<EconomicCalendarTitleLink />}
      count={morningBriefSectionCount(presentation, rows.length)}
      tone={TONE.NEUTRAL}
      headerLinks={<EconomicCalendarHeaderLinks />}
      headerActions={(
        <>
          <EconomicCalendarActionLink />
          {edit.headerActions}
        </>
      )}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'economic-calendar', DISPLAY_SECTION_TITLES.economicCalendar, { disabled: edit.editing })}
      sectionSelectAllItems={!edit.editing ? resolveMorningBriefSectionChildItems(bulkSections, 'economic-calendar') : null}
      bulkSelection={bulkSelection}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.economicCalendar}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : rows.length === 0 ? (
        <div
          className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-sm text-slate-600 dark:border-zinc-700/80 dark:bg-zinc-900/60 dark:text-zinc-300"
          dir="rtl"
          data-economic-calendar-shortcut
        >
          אירועי מאקרו, החלטות ריבית, אינפלציה, תעסוקה ונתונים כלכליים בזמן אמת.
        </div>
      ) : (
      <div dir="rtl" data-economic-calendar>
        <BriefTableWrapper>
          <table className={BRIEF_TABLE_CLS} dir="rtl">
            <colgroup>
              <col style={{ width: BRIEF_COL.checkbox }} />
              <col style={{ width: BRIEF_COL.primaryLabel }} />
              <col style={{ width: BRIEF_COL.sentiment }} />
              <col style={{ width: BRIEF_COL.change }} />
              <col />
              <col style={{ width: BRIEF_COL.save }} />
            </colgroup>
            <thead>
              <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
                <th className="py-1.5 pr-2 pl-0" />
                <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>אירוע</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>חשיבות</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>מועד</th>
                <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>השפעה</th>
                <th className="py-1.5 pl-1 pr-0" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <CalendarTableRow
                  key={i}
                  row={row}
                  bulkSections={bulkSections}
                  bulkSelection={bulkSelection}
                />
              ))}
            </tbody>
          </table>
        </BriefTableWrapper>
      </div>
      )}
    </SectionCard>
  );
}

// ── 8. Opportunities & Risks (compact list renderers) ────────────────
function filterOpportunityIdeas(marketBriefData, effectiveVideo) {
  const stockTickers = new Set(extractUnifiedStocks(marketBriefData, effectiveVideo).map((s) => s.ticker));
  return extractOpportunityIdeas(getSpecializedSrc(marketBriefData)).filter((idea) => {
    const title = (idea.title || '').trim().toUpperCase();
    if (stockTickers.has(title) && title.length <= 5) return false;
    return true;
  });
}

const SEVERITY_LABELS = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

function SeverityLabel({ level }) {
  if (!level || !importanceTextStyles(level)) return null;
  return <ImportanceBadge level={level} size="table" />;
}

function ComparisonListDivider({ isLast }) {
  if (isLast) return null;
  return <div className="border-b border-slate-200/70 dark:border-zinc-700/50" aria-hidden />;
}

function OpportunityListItem({
  idea,
  onSaveToBrain,
  isLast = false,
  bulkSelection = null,
  bulkSections = [],
}) {
  const title = String(idea.title || '').trim();
  const detail = String(idea.detail || '').trim();
  const description = detail && detail !== title ? detail : '';
  const saveText = [title, description].filter(Boolean).join(' — ');
  const selectionText = formatMorningBriefOpportunityText(idea);

  return (
    <UniversalTabSelectRow
      className={`group ${DASHBOARD_ITEM_ROW_CLS} text-right`}
      data-opportunity-item
      checkbox={(
        <MorningBriefBulkCheckbox
          bulkSections={bulkSections}
          sectionKey="opportunities"
          text={selectionText}
          sectionLabel="🎯 הזדמנויות"
          tabKey="brief-opportunities"
          bulkSelection={bulkSelection}
        />
      )}
      actions={(
        <div className="inline-flex items-center gap-1" dir="ltr">
          <StaticVideoTimestampLink
            item={idea.sourceItem}
            section="opportunities"
            productionRowId={`specialized:opportunity:${title}`}
            displayText={saveText}
          />
          <BriefRowSaveActions
          bulkSelection={bulkSelection}
          text={saveText}
          sectionLabel="🎯 הזדמנויות"
          tabKey="brief-opportunities"
          onSaveToBrain={onSaveToBrain}
          />
        </div>
      )}
    >
      {title && (
        <p className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} break-words [overflow-wrap:anywhere]`}>{title}</p>
      )}
      {description && (
        <p className={`${DASHBOARD_TABLE_CELL_BODY_CLS} mt-1 break-words [overflow-wrap:anywhere]`}>{description}</p>
      )}
      {idea.kindLabel && (
        <p className={`mt-1 ${DASHBOARD_TABLE_CELL_BODY_CLS} text-emerald-700 dark:text-emerald-400`}>{idea.kindLabel}</p>
      )}
      <ComparisonListDivider isLast={isLast} />
    </UniversalTabSelectRow>
  );
}

function parseRiskDisplay(risk) {
  const raw = String(risk.text || '').trim();
  if (!raw) return { title: '', description: '', severity: null, tag: null };

  const category = String(risk.category || '').trim();
  const severityMeta = category ? importanceStyles(category) : null;
  const isSeverity = severityMeta && SEVERITY_LABELS.has(severityMeta.label);
  const severity = isSeverity ? category : null;
  const tag = category && !isSeverity ? category : null;

  const dashIdx = raw.indexOf(' — ');
  if (dashIdx !== -1) {
    return {
      title: raw.slice(0, dashIdx).trim(),
      description: raw.slice(dashIdx + 3).trim(),
      severity,
      tag,
    };
  }

  const tickers = tickersInDisplayText(raw);
  if (tickers.length === 1) {
    const ticker = tickers[0];
    const upper = raw.toUpperCase();
    if (upper === ticker || upper.startsWith(`${ticker} `) || upper.startsWith(`${ticker}:`) || upper.startsWith(`${ticker}-`)) {
      const rest = raw.slice(ticker.length).replace(/^[\s:—\-]+/, '').trim();
      if (rest) {
        return { title: ticker, description: rest, severity, tag };
      }
    }
  }

  return { title: raw, description: '', severity, tag };
}

function RiskListItem({
  risk,
  onSaveToBrain,
  isLast = false,
  bulkSelection = null,
  bulkSections = [],
}) {
  const { title, description, severity, tag } = parseRiskDisplay(risk);

  return (
    <UniversalTabSelectRow
      className={`group ${DASHBOARD_ITEM_ROW_CLS} text-right`}
      data-risk-item
      checkbox={(
        <MorningBriefBulkCheckbox
          bulkSections={bulkSections}
          sectionKey="risks"
          text={risk.text}
          sectionLabel="⚠️ סיכונים"
          tabKey="brief-risks"
          bulkSelection={bulkSelection}
        />
      )}
      actions={(
        <div className="inline-flex items-center gap-1" dir="ltr">
          <StaticVideoTimestampLink
            item={risk.sourceItem}
            section="risks"
            productionRowId={`specialized:risk:${risk.text}`}
            displayText={risk.text}
          />
          <BriefRowSaveActions
          bulkSelection={bulkSelection}
          text={risk.text}
          sectionLabel="⚠️ סיכונים"
          tabKey="brief-risks"
          onSaveToBrain={onSaveToBrain}
          />
        </div>
      )}
    >
      {title && (
        <p className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} break-words [overflow-wrap:anywhere]`}>{title}</p>
      )}
      {description && (
        <p className={`${DASHBOARD_TABLE_CELL_BODY_CLS} mt-1 break-words [overflow-wrap:anywhere]`}>{description}</p>
      )}
      {(severity || tag) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 justify-start">
          {severity && <SeverityLabel level={severity} />}
          {tag && (
            <span className={DASHBOARD_TABLE_CELL_MUTED_CLS}>{tag}</span>
          )}
        </div>
      )}
      <ComparisonListDivider isLast={isLast} />
    </UniversalTabSelectRow>
  );
}

function DashboardColumnHeader({ title, count, countTextCls }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-b shrink-0 text-right" dir="rtl">
      <p className={`${DASHBOARD_COLUMN_HEADER_CLS} text-slate-700 dark:text-zinc-200 tracking-wide text-right`}>{title}</p>
      <span className={`${DASHBOARD_PILL_CLS} ${countTextCls}`}>
        {count}
      </span>
    </div>
  );
}

function OpportunitiesColumn({
  ideas,
  onSaveToBrain,
  scrollable = false,
  bulkSelection = null,
  bulkSections = [],
}) {
  const bodyCls = scrollable
    ? 'flex-1 min-h-0 overflow-y-auto px-3 py-1'
    : 'px-3 py-1';

  return (
    <div
      dir="rtl"
      className={`flex flex-col rounded-xl border-2 min-h-[120px] text-right ${newsColumnVariantStyles('positive').column}${scrollable ? ' h-full max-h-full' : ''}`}
      data-opportunities-column
    >
      <DashboardColumnHeader
        title={DISPLAY_COLUMN_TITLES.opportunities}
        count={ideas.length}
        countTextCls={newsColumnVariantStyles('positive').countText}
      />
      <div className={bodyCls}>
        {ideas.length === 0 ? (
          <p className={`${DASHBOARD_EMPTY_CLS} text-center py-6`}>לא נמצאו הזדמנויות</p>
        ) : (
          ideas.map((idea, i) => (
            <OpportunityListItem
              key={i}
              idea={idea}
              onSaveToBrain={onSaveToBrain}
              isLast={i === ideas.length - 1}
              bulkSelection={bulkSelection}
              bulkSections={bulkSections}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RisksColumn({
  risks,
  onSaveToBrain,
  scrollable = false,
  bulkSelection = null,
  bulkSections = [],
}) {
  const bodyCls = scrollable
    ? 'flex-1 min-h-0 overflow-y-auto px-3 py-1'
    : 'px-3 py-1';

  return (
    <div
      dir="rtl"
      className={`flex flex-col rounded-xl border-2 min-h-[120px] text-right ${newsColumnVariantStyles('negative').column}${scrollable ? ' h-full max-h-full' : ''}`}
      data-risks-column
    >
      <DashboardColumnHeader
        title={DISPLAY_COLUMN_TITLES.risks}
        count={risks.length}
        countTextCls={newsColumnVariantStyles('negative').countText}
      />
      <div className={bodyCls}>
        {risks.length === 0 ? (
          <p className={`${DASHBOARD_EMPTY_CLS} text-center py-6`}>לא נמצאו סיכונים</p>
        ) : (
          risks.map((risk, i) => (
            <RiskListItem
              key={i}
              risk={risk}
              onSaveToBrain={onSaveToBrain}
              isLast={i === risks.length - 1}
              bulkSelection={bulkSelection}
              bulkSections={bulkSections}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Side-by-side Opportunities / Risks dashboard — Macro-style 3+3 card grid with placeholders. */
export function OpportunitiesRisksDashboard({
  marketBriefData,
  effectiveVideo,
  onSaveToBrain,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
  presentation,
}) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.opportunitiesRisks, {
    marketBriefData,
    effectiveVideo,
    onSaveMarketBriefSection,
    presentation,
  });
  const ideas = filterOpportunityIdeas(marketBriefData, effectiveVideo);
  const risks = extractRiskItems(getSpecializedSrc(marketBriefData));
  const opportunitySlots = padInsightSlots(ideas, INSIGHT_GRID_SLOT_COUNT);
  const riskSlots = padInsightSlots(risks, INSIGHT_GRID_SLOT_COUNT);
  const oppRiskCount = countOpportunitiesAndRisks(ideas, risks);

  return (
    <SectionCard
      title="🎯 הזדמנויות וסיכונים"
      count={morningBriefSectionCount(presentation, oppRiskCount)}
      tone={TONE.NEUTRAL}
      isEmpty={false}
      emptyMessage="הזדמנויות וסיכונים יוצגו כאן"
      plainSurface
      headerActions={edit.headerActions}
      cardBulk={morningBriefCombinedCardBulk(
        bulkSections,
        bulkSelection,
        ['opportunities', 'risks'],
        '🎯 הזדמנויות וסיכונים',
        { disabled: edit.editing, cardId: 'opportunities-risks' },
      )}
      sectionSelectAllItems={!edit.editing ? resolveMorningBriefCombinedSectionChildItems(bulkSections, ['opportunities', 'risks']) : null}
      bulkSelection={bulkSelection}
      headerPills={morningBriefShowsSummaryCounters(presentation) && !edit.editing ? (
        <ComparisonSummaryPills
          pills={[
            { count: ideas.length, label: 'הזדמנויות', tone: 'positive' },
            { count: risks.length, label: 'סיכונים', tone: 'negative' },
          ]}
        />
      ) : null}
    >
      {edit.editing ? (
        <ManualOpportunitiesRisksEdit
          draft={edit.draft}
          onChange={edit.setDraft}
          opportunityColumns={SECTION_EDIT_COLUMNS.opportunities}
          riskColumns={SECTION_EDIT_COLUMNS.risks}
        />
      ) : (
      <div dir="rtl" data-opportunities-risks-dashboard className="space-y-5">
        {(() => {
          const risksFirst = risks.length > 0 && ideas.length === 0;

          const oppBlock = (
            <div key="opp-block">
              <p className={`${DASHBOARD_TABLE_HEAD_CLS} mb-2.5 text-emerald-700 dark:text-emerald-400`}>
                {morningBriefSubsectionTitle(presentation, '💡 הזדמנויות', ideas.length)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {opportunitySlots.map((idea, i) => {
                  if (!idea) {
                    return <MacroStyleEmptyInsightCard key={`opp-empty-${i}`} variant="opportunity" slotIndex={i} />;
                  }
                  const titleText = String(idea.title || '').trim();
                  const ticker = String(idea.ticker || '').trim().toUpperCase();
                  const title = ticker ? `${ticker} · ${titleText}` : titleText;
                  const detail = String(idea.detail || '').trim();
                  const description = detail && detail !== titleText ? detail : '';
                  const saveText = [title, description].filter(Boolean).join(' — ');
                  const selectionText = formatMorningBriefOpportunityText(idea);
                  const pillLabel = String(idea.kindLabel || '').trim();
                  const style = {
                    ...getMacroOppStyle(pillLabel, title),
                    bg: 'bg-emerald-50/80 dark:bg-emerald-950/20',
                    border: 'border-emerald-200 dark:border-emerald-800',
                  };
                  return (
                    <MacroStyleOpportunityCard
                      key={`opp-${i}-${title}`}
                      style={style}
                      title={title}
                      pillLabel={pillLabel || null}
                      details={description || null}
                      pxUrl={null}
                      dataAttrs={{ 'data-opportunity-item': true }}
                      checkbox={(
                        <div className="flex flex-col items-center gap-1">
                          <MorningBriefBulkCheckbox
                            bulkSections={bulkSections}
                            sectionKey="opportunities"
                            text={selectionText}
                            sectionLabel="🎯 הזדמנויות"
                            tabKey="brief-opportunities"
                            bulkSelection={bulkSelection}
                          />
                        </div>
                      )}
                      saveActions={(
                        <>
                          <BriefRowSaveActions
                            bulkSelection={bulkSelection}
                            text={saveText}
                            sectionLabel="🎯 הזדמנויות"
                            tabKey="brief-opportunities"
                            onSaveToBrain={onSaveToBrain}
                          />
                          {isRowAlreadySaved(selectionText, 'brief-opportunities', bulkSelection?.savedRowIndex) && <SavedRowIndicator />}
                        </>
                      )}
                    />
                  );
                })}
              </div>
            </div>
          );

          const riskBlock = (
            <div key="risk-block">
              <p className={`${DASHBOARD_TABLE_HEAD_CLS} mb-2.5 text-red-700 dark:text-red-400`}>
                {morningBriefSubsectionTitle(presentation, '⚠️ סיכונים', risks.length)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {riskSlots.map((risk, i) => {
                  if (!risk) {
                    return <MacroStyleEmptyInsightCard key={`risk-empty-${i}`} variant="risk" slotIndex={i} />;
                  }
                  const { title, description, severity, tag } = parseRiskDisplay(risk);
                  const pillLabel = (severity ? translateImportanceLevel(severity) : null) || tag || '';
                  const style = {
                    ...getMacroRiskStyle(severity || tag || ''),
                    bg: 'bg-rose-50/80 dark:bg-rose-950/20',
                    border: 'border-rose-200 dark:border-rose-800',
                  };
                  return (
                    <MacroStyleRiskCard
                      key={`risk-${i}-${title}`}
                      style={style}
                      title={title}
                      pillLabel={pillLabel || null}
                      details={description || null}
                      pxUrl={null}
                      dataAttrs={{ 'data-risk-item': true }}
                      checkbox={(
                        <div className="flex flex-col items-center gap-1">
                          <MorningBriefBulkCheckbox
                            bulkSections={bulkSections}
                            sectionKey="risks"
                            text={risk.text}
                            sectionLabel="⚠️ סיכונים"
                            tabKey="brief-risks"
                            bulkSelection={bulkSelection}
                          />
                        </div>
                      )}
                      saveActions={(
                        <>
                          <BriefRowSaveActions
                            bulkSelection={bulkSelection}
                            text={risk.text}
                            sectionLabel="⚠️ סיכונים"
                            tabKey="brief-risks"
                            onSaveToBrain={onSaveToBrain}
                          />
                          {isRowAlreadySaved(risk.text, 'brief-risks', bulkSelection?.savedRowIndex) && <SavedRowIndicator />}
                        </>
                      )}
                    />
                  );
                })}
              </div>
            </div>
          );

          return risksFirst ? [riskBlock, oppBlock] : [oppBlock, riskBlock];
        })()}
      </div>
      )}
    </SectionCard>
  );
}

export function OpportunitiesSection({ marketBriefData, effectiveVideo, onSaveToBrain }) {
  const ideas = filterOpportunityIdeas(marketBriefData, effectiveVideo);

  return (
    <SectionCard
      title={DISPLAY_SECTION_TITLES.opportunities}
      count={ideas.length}
      tone={TONE.BULLISH}
      isEmpty={ideas.length === 0}
      emptyMessage="לא נמצאו הזדמנויות"
    >
      <div className="px-1" dir="rtl">
        {ideas.map((idea, i) => (
          <OpportunityListItem
            key={i}
            idea={idea}
            onSaveToBrain={onSaveToBrain}
            isLast={i === ideas.length - 1}
          />
        ))}
      </div>
    </SectionCard>
  );
}

// ── 9. Risks ─────────────────────────────────────────────────────────
export function RisksWarningSection({ marketBriefData, onSaveToBrain }) {
  const risks = extractRiskItems(getSpecializedSrc(marketBriefData));

  return (
    <SectionCard
      title={DISPLAY_SECTION_TITLES.risks}
      count={risks.length}
      tone={TONE.BEARISH}
      isEmpty={risks.length === 0}
      emptyMessage="לא נמצאו סיכונים"
    >
      <div className="px-1" dir="rtl">
        {risks.map((risk, i) => (
          <RiskListItem
            key={i}
            risk={risk}
            onSaveToBrain={onSaveToBrain}
            isLast={i === risks.length - 1}
          />
        ))}
      </div>
    </SectionCard>
  );
}

// ── 10. Stocks Mentioned ─────────────────────────────────────────────
const STOCKS_SENTIMENT_ORDER = { bullish: 0, bearish: 1, neutral: 2 };

const STOCK_SENTIMENT_COLUMNS = [
  {
    key: 'bullish',
    label: DISPLAY_COLUMN_TITLES.stocks.bullish,
    border: 'border-emerald-300/80 dark:border-emerald-700/50',
    header: 'text-emerald-800 dark:text-emerald-300',
    countText: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    key: 'bearish',
    label: DISPLAY_COLUMN_TITLES.stocks.bearish,
    border: 'border-red-300/80 dark:border-red-800/50',
    header: 'text-red-800 dark:text-red-300',
    countText: 'text-red-700 dark:text-red-300',
  },
  {
    key: 'neutral',
    label: DISPLAY_COLUMN_TITLES.stocks.neutral,
    border: 'border-sky-300/80 dark:border-sky-700/50',
    header: 'text-sky-800 dark:text-sky-300',
    countText: 'text-sky-700 dark:text-sky-300',
  },
];

function stockDirFields(stock) {
  return {
    status: stock.context,
    action: stock.actionability,
    sentiment: stock.sentiment,
    category: stock.category,
    context: stock.context,
    notes: stock.notes,
    strategy: stock.actionability,
  };
}

function stockSentimentColumnKey(stock) {
  const tone = getDirectionFromFields(stockDirFields(stock)).tone;
  if (tone === TONE.BULLISH) return 'bullish';
  if (tone === TONE.BEARISH) return 'bearish';
  return 'neutral';
}

function normalizeStockBadgeKey(label) {
  return String(label || '').trim().toLowerCase();
}

/** Hide redundant watchlist labels in Stocks Mentioned UI only. */
function isStockMentionHiddenLabel(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const key = normalizeStockBadgeKey(raw);
  return key === 'מעקב' || key === 'watchlist';
}

function stockMentionActionability(actionability) {
  const raw = String(actionability || '').trim();
  if (!raw || isStockMentionHiddenLabel(raw)) return '';
  return raw;
}

const STOCK_CATEGORY_TEXT_CLS = {
  opportunity: 'text-emerald-700 dark:text-emerald-300',
  watchlist: 'text-sky-700 dark:text-sky-300',
  risk: 'text-red-700 dark:text-red-300',
  general: 'text-slate-600 dark:text-zinc-400',
};

function StockCategoryText({ category }) {
  const meta = stockCategoryBadge(category);
  if (isStockMentionHiddenLabel(meta.label) || category === 'watchlist') return null;
  const textCls = STOCK_CATEGORY_TEXT_CLS[category] || STOCK_CATEGORY_TEXT_CLS.general;
  return (
    <span className={`${DASHBOARD_TABLE_CELL_BODY_CLS} ${textCls}`}>
      {meta.label}
    </span>
  );
}

function StockMentionDirectionText({ fields }) {
  const badge = getDirectionBadge(fields);
  if (!badge.label || isStockMentionHiddenLabel(badge.label)) return null;
  return <DirectionText fields={fields} size="table" />;
}

/** Collect unique header badges — direction first, then category if label differs. */
function collectStockDisplayBadges(stock, dirFields) {
  const badges = [];
  const seen = new Set();

  const dirBadge = getDirectionBadge(dirFields);
  if (dirBadge.label && !isStockMentionHiddenLabel(dirBadge.label)) {
    const key = normalizeStockBadgeKey(dirBadge.label);
    if (!seen.has(key)) {
      seen.add(key);
      badges.push({ kind: 'direction' });
    }
  }

  const category = stock.category;
  if (category && category !== 'general' && category !== 'watchlist') {
    const catLabel = stockCategoryBadge(category).label;
    const key = normalizeStockBadgeKey(catLabel);
    if (catLabel && !isStockMentionHiddenLabel(catLabel) && !seen.has(key)) {
      seen.add(key);
      badges.push({ kind: 'category' });
    }
  }

  return badges;
}

function StockMovePercentIndicator({ move }) {
  if (!move) return null;
  const moveStyles = toneStyles(move.tone);
  return (
    <span
      className={`${DASHBOARD_TABLE_STATUS_CLS} shrink-0 ${moveStyles.text}`}
      data-stock-move-percent
    >
      {move.display}
    </span>
  );
}

const _SEP = <span className="text-slate-300 dark:text-zinc-600 select-none mx-0.5" aria-hidden>·</span>;

function StockMentionTableRow({
  stock,
  onSaveToBrain,
  bulkSelection = null,
  bulkSections = [],
  showStockExternalLinks = true,
}) {
  const summary = [stock.ticker, stock.company, stock.context, stock.sentiment].filter(Boolean).join(' · ');
  const selectionText = formatMorningBriefStockText(stock);
  const sentKey = stockSentimentColumnKey(stock);
  const ticker = String(stock.ticker || '').trim();
  const notesText = [stock.context, stock.notes].filter(Boolean).map((s) => String(s).trim()).filter(Boolean).join(' · ');
  const sectorMeta = resolveStockSectorDisplay({ ticker, storedSector: stock.sector });
  const sectorLabel = String(sectorMeta?.label || '').trim();
  const sectorLink = sectorMeta?.url ? { ticker: sectorMeta.etf, url: sectorMeta.url } : null;

  return (
    <tr className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group" data-stock-item>
      <td className={BRIEF_CELL.checkbox}>
        <div className="flex flex-col items-center gap-1">
          <MorningBriefBulkCheckbox
            bulkSections={bulkSections}
            sectionKey="stocks-mentioned"
            text={selectionText}
            sectionLabel="⭐ מניות שהוזכרו"
            tabKey="stocks-mentioned"
            bulkSelection={bulkSelection}
          />
        </div>
      </td>
      {/* סימול */}
      <td className={BRIEF_CELL.short}>
        {ticker ? (
          <a
            href={`https://finviz.com/quote.ashx?t=${encodeURIComponent(ticker)}&p=d`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`Open ${ticker} in Finviz`}
            aria-label={`Open ${ticker} in Finviz`}
            className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline cursor-pointer`}
          >
            {ticker}
          </a>
        ) : <span className="text-slate-400 dark:text-zinc-500">—</span>}
      </td>
      {/* סקטור */}
      <td className={BRIEF_CELL.short}>
        {sectorLabel ? (
          sectorLink ? (
            <a
              href={sectorLink.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              title="פתיחת תעודת הסל של הסקטור ב־Finviz"
              aria-label={`פתיחת סקטור ${sectorLabel} באמצעות תעודת הסל ${sectorLink.ticker} באתר Finviz`}
              className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:text-violet-700 dark:hover:text-violet-300 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
              data-stock-sector-finviz-link={sectorLink.ticker}
            >
              <span>{sectorLabel}</span>
              <span className="shrink-0 text-[10px]" aria-hidden>↗</span>
            </a>
          ) : (
            <span className={DASHBOARD_TABLE_CELL_MUTED_CLS}>{sectorLabel}</span>
          )
        ) : (
          <span className="text-slate-400 dark:text-zinc-500 text-sm">—</span>
        )}
      </td>
      {/* סנטימנט */}
      <td className={BRIEF_CELL.sentiment}>
        <InlineSentimentBadge
          sentKey={sentKey}
          className={BRIEF_SENTIMENT_INLINE_CLS}
        />
      </td>
      {/* שינוי % */}
      <td className={BRIEF_CELL.change}>
        {stock.changePercent
          ? <ChangeValue value={stock.changePercent} />
          : <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>
        }
      </td>
      {/* הערות */}
      <td className={BRIEF_CELL.notes}>
        <p
          className={`${BRIEF_NOTES_TEXT_CLS} line-clamp-3`}
          title={notesText || undefined}
        >
          {notesText || '—'}
        </p>
      </td>
      {/* קישורים */}
      {showStockExternalLinks ? (
      <td className={BRIEF_CELL.links}>
        {ticker ? (
          <span className="inline-flex items-center gap-x-0.5 text-xs font-medium">
            <a href={`https://www.tradingview.com/symbols/NASDAQ-${encodeURIComponent(ticker)}/`} target="_blank" rel="noopener noreferrer" className={BRIEF_TABLE_LINK_CLS}>TV</a>
            {_SEP}
            <a href={`https://www.investing.com/search/?q=${encodeURIComponent(ticker)}`} target="_blank" rel="noopener noreferrer" className={BRIEF_TABLE_LINK_CLS}>Inv</a>
            {_SEP}
            <a href={`https://il.investing.com/search/?q=${encodeURIComponent(ticker)}`} target="_blank" rel="noopener noreferrer" className={BRIEF_TABLE_LINK_CLS}>InvIL</a>
          </span>
        ) : (
          <span className="text-slate-400 dark:text-zinc-500 text-sm">—</span>
        )}
      </td>
      ) : null}
      <td className="py-2 pl-1 pr-0 align-middle">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <StaticVideoTimestampLink
            items={stock.rowTimestampSourceItems}
            section="stocks-mentioned"
            productionRowId={`specialized:stock:${ticker}`}
            displayText={summary}
          />
          <BriefRowSaveActions
            bulkSelection={bulkSelection}
            text={summary}
            sectionLabel="⭐ מניות שהוזכרו"
            tabKey="stocks-mentioned"
            onSaveToBrain={onSaveToBrain}
          />
        </div>
        {isRowAlreadySaved(selectionText, 'stocks-mentioned', bulkSelection?.savedRowIndex) && <SavedRowIndicator />}
      </td>
    </tr>
  );
}

export function StocksMentionedSection({
  marketBriefData,
  effectiveVideo,
  onSaveToBrain,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
  presentation,
}) {
  const ui = resolveMorningBriefPresentation(presentation);
  const [sortBy, setSortBy] = useState('sentiment');
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.stocksMentioned, {
    marketBriefData,
    effectiveVideo,
    onSaveMarketBriefSection,
    presentation,
  });
  const stocks = extractUnifiedStocks(marketBriefData, effectiveVideo);
  const tone = stocks.length > 0
    ? resolveTone(stocks.map((s) => s.sentiment).join(' '))
    : TONE.NEUTRAL;

  const bullishCount = stocks.filter((s) => stockSentimentColumnKey(s) === 'bullish').length;
  const bearishCount = stocks.filter((s) => stockSentimentColumnKey(s) === 'bearish').length;
  const neutralCount = stocks.filter((s) => stockSentimentColumnKey(s) === 'neutral').length;

  const sortedStocks = [...stocks].sort((a, b) => {
    if (sortBy === 'ticker') {
      return String(a.ticker || '').localeCompare(String(b.ticker || ''), 'he');
    }
    const ka = stockSentimentColumnKey(a);
    const kb = stockSentimentColumnKey(b);
    return (STOCKS_SENTIMENT_ORDER[ka] ?? 2) - (STOCKS_SENTIMENT_ORDER[kb] ?? 2);
  });

  return (
    <SectionCard
      title="⭐ מניות שהוזכרו"
      count={morningBriefSectionCount(presentation, stocks.length)}
      tone={tone}
      isEmpty={!edit.editing && stocks.length === 0}
      emptyMessage="טיקרים, סנטימנט והקשר יוצגו כאן"
      plainSurface
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'stocks-mentioned', '⭐ מניות שהוזכרו', { disabled: edit.editing })}
      sectionSelectAllItems={!edit.editing ? resolveMorningBriefSectionChildItems(bulkSections, 'stocks-mentioned') : null}
      bulkSelection={bulkSelection}
      headerPills={morningBriefShowsSummaryCounters(presentation) && !edit.editing ? (
        <ComparisonSummaryPills
          pills={[
            { count: bullishCount, label: 'חיוביות', tone: 'positive' },
            { count: neutralCount, label: 'ניטרלי', tone: 'watch' },
            { count: bearishCount, label: 'שליליות', tone: 'negative' },
          ]}
        />
      ) : null}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.stocksMentioned}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <div dir="rtl" data-stocks-mentioned-section>
        {ui.showSortControls && (
        <div className="flex items-center gap-1.5 mb-3 justify-end">
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">מיון:</span>
          {[
            { key: 'sentiment', label: 'סנטימנט' },
            { key: 'ticker', label: 'טיקר א-ב' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={
                'text-[11px] px-2 py-0.5 rounded-full transition-colors ' +
                (sortBy === key
                  ? 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-medium'
                  : 'text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800')
              }
            >
              {label}
            </button>
          ))}
        </div>
        )}
        {/* Stocks table */}
        <BriefTableWrapper>
          <table className={BRIEF_TABLE_CLS} dir="rtl">
            <colgroup>
              <col style={{ width: BRIEF_COL.checkbox }} />
              <col style={{ width: BRIEF_COL.symbol }} />
              <col style={{ width: BRIEF_COL.sector }} />
              <col style={{ width: BRIEF_COL.sentiment }} />
              <col style={{ width: BRIEF_COL.change }} />
              <col />
              {ui.showStockExternalLinks ? <col style={{ width: BRIEF_COL.links }} /> : null}
              <col style={{ width: BRIEF_COL.save }} />
            </colgroup>
            <thead>
              <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
                <th className="py-1.5 pr-2 pl-0" />
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סימול</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סקטור</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>סנטימנט</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>שינוי %</th>
                <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>הערות</th>
                {ui.showStockExternalLinks ? (
                  <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>קישורים</th>
                ) : null}
                <th className="py-1.5 pl-1 pr-0" />
              </tr>
            </thead>
            <tbody>
              {sortedStocks.map((stock, i) => (
                <StockMentionTableRow
                  key={`${stock.ticker}-${i}`}
                  stock={stock}
                  onSaveToBrain={onSaveToBrain}
                  bulkSelection={bulkSelection}
                  bulkSections={bulkSections}
                  showStockExternalLinks={ui.showStockExternalLinks}
                />
              ))}
            </tbody>
          </table>
        </BriefTableWrapper>
      </div>
      )}
    </SectionCard>
  );
}

// ── Stock fundamentals / technicals (WORK-ID TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY) ──
// Structured per-ticker data points extracted by the fundamental/technical GEM
// (video.stockFundamentals / video.stockTechnicals, see videoAnalytics.js).
// Rendered ONLY when the caller explicitly opts in (MorningBriefDashboard's
// showStockDataSections prop) — never on a real morning/evening brief, since
// these two share the exact same dashboard component. See SpecializedContentRenderer.jsx.

function StockDataTableRow({
  row,
  typeField,
  formatText,
  sectionKey,
  sectionLabel,
  onSaveToBrain,
  bulkSelection = null,
  bulkSections = [],
}) {
  const ticker = String(row.ticker || '').trim();
  const typeValue = String(row[typeField] || '').trim();
  const valueText = row.value != null && String(row.value).trim() ? String(row.value) : '';
  const summary = formatText(row);
  const selectionText = summary;

  return (
    <tr className="border-b border-slate-200/70 dark:border-zinc-700/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 group" data-stock-data-item>
      <td className={BRIEF_CELL.checkbox}>
        <div className="flex flex-col items-center gap-1">
          <MorningBriefBulkCheckbox
            bulkSections={bulkSections}
            sectionKey={sectionKey}
            text={selectionText}
            sectionLabel={sectionLabel}
            tabKey={sectionKey}
            bulkSelection={bulkSelection}
          />
        </div>
      </td>
      {/* טיקר */}
      <td className={BRIEF_CELL.short}>
        {ticker ? (
          <a
            href={`https://finviz.com/quote.ashx?t=${encodeURIComponent(ticker)}&p=d`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={row.company ? `${ticker} — ${row.company}` : `Open ${ticker} in Finviz`}
            aria-label={`Open ${ticker} in Finviz`}
            className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline cursor-pointer`}
          >
            {ticker}
          </a>
        ) : <span className="text-slate-400 dark:text-zinc-500">—</span>}
      </td>
      {/* מדד / סוג רמה */}
      <td className={BRIEF_CELL.short}>
        <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{typeValue || '—'}</span>
      </td>
      {/* ערך */}
      <td className={BRIEF_CELL.change}>
        {valueText
          ? <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{valueText}</span>
          : <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>
        }
      </td>
      {/* משמעות */}
      <td className={BRIEF_CELL.notes}>
        <p className={`${BRIEF_NOTES_TEXT_CLS} line-clamp-3`} title={row.interpretation || undefined}>
          {row.interpretation || '—'}
        </p>
      </td>
      {/* תאריך */}
      <td className={BRIEF_CELL.short}>
        <p className={`${DASHBOARD_TABLE_CELL_DATE_CLS} whitespace-nowrap`}>{row.asOf || '—'}</p>
      </td>
      <td className="py-2 pl-1 pr-0 align-middle">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <StaticVideoTimestampLink
            items={[row]}
            section={sectionKey}
            productionRowId={`specialized:${sectionKey}:${ticker}:${typeValue}`}
            displayText={summary}
          />
          <BriefRowSaveActions
            bulkSelection={bulkSelection}
            text={summary}
            sectionLabel={sectionLabel}
            tabKey={sectionKey}
            onSaveToBrain={onSaveToBrain}
          />
        </div>
        {isRowAlreadySaved(selectionText, sectionKey, bulkSelection?.savedRowIndex) && <SavedRowIndicator />}
      </td>
    </tr>
  );
}

function StockDataSection({
  title,
  emptyMessage,
  typeColumnLabel,
  typeField,
  formatText,
  sectionKey,
  effectiveVideo,
  marketBriefData,
  onSaveToBrain,
  bulkSelection = null,
  bulkSections = [],
  presentation,
}) {
  const rows = extractVideoTabItems(effectiveVideo, sectionKey, marketBriefData);

  return (
    <SectionCard
      title={title}
      count={morningBriefSectionCount(presentation, rows.length)}
      tone={TONE.NEUTRAL}
      isEmpty={rows.length === 0}
      emptyMessage={emptyMessage}
      plainSurface
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, sectionKey, title)}
      sectionSelectAllItems={resolveMorningBriefSectionChildItems(bulkSections, sectionKey)}
      bulkSelection={bulkSelection}
    >
      <div dir="rtl" data-stock-data-section={sectionKey}>
        <BriefTableWrapper>
          <table className={BRIEF_TABLE_CLS} dir="rtl">
            <colgroup>
              <col style={{ width: BRIEF_COL.checkbox }} />
              <col style={{ width: BRIEF_COL.symbol }} />
              <col style={{ width: BRIEF_COL.type }} />
              <col style={{ width: BRIEF_COL.change }} />
              <col />
              <col style={{ width: '10%' }} />
              <col style={{ width: BRIEF_COL.save }} />
            </colgroup>
            <thead>
              <tr className={BRIEF_TABLE_HEAD_ROW_CLS}>
                <th className="py-1.5 pr-2 pl-0" />
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>טיקר</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>{typeColumnLabel}</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>ערך</th>
                <th className={`px-2 py-1.5 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>משמעות</th>
                <th className={`px-2 py-1.5 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}>תאריך</th>
                <th className="py-1.5 pl-1 pr-0" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <StockDataTableRow
                  key={`${row.ticker}-${i}`}
                  row={row}
                  typeField={typeField}
                  formatText={formatText}
                  sectionKey={sectionKey}
                  sectionLabel={title}
                  onSaveToBrain={onSaveToBrain}
                  bulkSelection={bulkSelection}
                  bulkSections={bulkSections}
                />
              ))}
            </tbody>
          </table>
        </BriefTableWrapper>
      </div>
    </SectionCard>
  );
}

export function StockFundamentalsSection(props) {
  return (
    <StockDataSection
      title="📊 נתונים פונדמנטליים"
      emptyMessage="מדדים פונדמנטליים לטיקר — ערך ותאריך — יוצגו כאן"
      typeColumnLabel="מדד"
      typeField="metric"
      formatText={formatMorningBriefStockFundamentalText}
      sectionKey="stock-fundamentals"
      {...props}
    />
  );
}

export function StockTechnicalsSection(props) {
  return (
    <StockDataSection
      title="📐 נתונים טכניים"
      emptyMessage="רמות תמיכה/התנגדות לטיקר — ערך ותאריך — יוצגו כאן"
      typeColumnLabel="סוג רמה"
      typeField="levelType"
      formatText={formatMorningBriefStockTechnicalText}
      sectionKey="stock-technicals"
      {...props}
    />
  );
}

// ── Legacy helpers (backward compat for other brief types) ─────────────
export function hasEnhancedCalendar(marketBriefData) {
  return extractCalendarRows(getSpecializedSrc(marketBriefData)).length > 0;
}

export function hasEnhancedOpportunities(marketBriefData) {
  return extractOpportunityIdeas(getSpecializedSrc(marketBriefData)).length > 0;
}

export function hasEnhancedRisks(marketBriefData) {
  return extractRiskItems(getSpecializedSrc(marketBriefData)).length > 0;
}

export function hasEnhancedWatchlist(marketBriefData, effectiveVideo = null) {
  return hasUnifiedStocks(marketBriefData, effectiveVideo);
}

export function hasEnhancedSentiment(marketBriefData) {
  return hasSentimentData(getSpecializedSrc(marketBriefData));
}
