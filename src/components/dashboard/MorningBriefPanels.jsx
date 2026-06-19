import { useCallback, useState } from 'react';
import { cleanupMacroDisplayRows } from '@/lib/macroDisplayCleanup';
import {
  extractCalendarRows,
  extractMacroIndicatorRows,
  extractMarketDashboardRows,
  parseMacroDisplayItem,
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
  DISPLAY_COLUMN_TITLES,
  DISPLAY_SECTION_TITLES,
  TONE_DISPLAY_LABELS,
  translateDisplayLabel,
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
import { MorningBriefMarketsTable } from './MorningBriefMarketsTable';
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
} from './MorningBriefVisualPrimitives';
import {
  BRIEF_MANUAL_SECTION_IDS,
  SECTION_EDIT_COLUMNS,
  getEditableRowsForSection,
} from '@/lib/manualBriefOverrides';
import {
  BriefSectionManualHeaderExtras,
  ManualEditGrid,
  ManualOpportunitiesRisksEdit,
  useBriefSectionManualEdit,
} from './BriefSectionManualEdit';
import { MorningBriefBulkCheckbox } from './MorningBriefBulkCheckbox';
import {
  UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS,
  UniversalTabSelectRow,
} from '@/components/shared/UniversalTabSelectRow';
import { mergeBulkSelection } from '@/lib/universalTabBulkItems';
import { UniversalTabQuickSaveFromBulk } from '@/components/shared/UniversalTabQuickSaveActions';
import {
  resolveMorningBriefCardText,
  resolveMorningBriefCombinedCardText,
} from '@/lib/morningBriefBulkSections';

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

function useMorningBriefSectionEdit(sectionId, { marketBriefData, effectiveVideo, onSaveMarketBriefSection, newsItems }) {
  const enabled = Boolean(onSaveMarketBriefSection && marketBriefData);
  const getDraftRows = useCallback(
    () => getEditableRowsForSection(marketBriefData, effectiveVideo, sectionId, newsItems),
    [marketBriefData, effectiveVideo, sectionId, newsItems],
  );

  const edit = useBriefSectionManualEdit({
    sectionId,
    marketBriefData: marketBriefData || {},
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
  const displayText = `${translateDisplayLabel(label)}: ${stripInternalFieldLabels(value)}`;
  const displayValue = stripInternalFieldLabels(value);
  const rowCtx = { indicator: translateDisplayLabel(label), description: displayValue };
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
              {translateDisplayLabel(label)}
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
          label={translateDisplayLabel(label)}
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

// ── 1. Market Regime ─────────────────────────────────────────────────
export function MarketRegimeSection({ marketBriefData, onSaveMarketBriefSection, bulkSelection = null, bulkSections = [] }) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.marketRegime, { marketBriefData, onSaveMarketBriefSection });
  const cards = extractMarketRegimeCards(getSpecializedSrc(marketBriefData));
  const split = splitNewsByTone(cards, (c) => stripInternalFieldLabels(c.value));

  return (
    <SectionCard
      title="📊 מצב שוק"
      count={cards.length}
      tone={TONE.NEUTRAL}
      isEmpty={!edit.editing && cards.length === 0}
      emptyMessage="מצב שוק, רוחב, Risk On/Off ותנודתיות יוצגו כאן"
      plainSurface
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'market-regime', '📊 מצב שוק', { disabled: edit.editing })}
      headerPills={!edit.editing ? (
        <ThreeToneSummaryPills
          bullishCount={split.bullishCount}
          neutralCount={split.neutral.length}
          bearishCount={split.bearishCount}
          labels={{ positive: 'חיובי', neutral: 'ניטרלי', negative: 'שלילי' }}
        />
      ) : null}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.marketRegime}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <div dir="rtl" data-regime-comparison className="space-y-2">
        <RegimeStackedGroup
          variant="positive"
          title={DISPLAY_COLUMN_TITLES.regime.positive}
          count={split.bullishCount}
          cards={split.positive}
          emptyMessage="לא נמצאו פריטי מצב שוק חיוביים"
          bulkSelection={bulkSelection}
          bulkSections={bulkSections}
        />
        <RegimeStackedGroup
          variant="neutral"
          title={DISPLAY_COLUMN_TITLES.regime.neutral}
          count={split.neutral.length}
          cards={split.neutral}
          emptyMessage="לא נמצאו פריטי מצב שוק ניטרליים"
          bulkSelection={bulkSelection}
          bulkSections={bulkSections}
        />
        <RegimeStackedGroup
          variant="negative"
          title={DISPLAY_COLUMN_TITLES.regime.negative}
          count={split.bearishCount}
          cards={split.negative}
          emptyMessage="לא נמצאו פריטי מצב שוק שליליים"
          bulkSelection={bulkSelection}
          bulkSections={bulkSections}
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
}) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.markets, { marketBriefData, onSaveMarketBriefSection });

  return (
    <SectionCard
      title={DISPLAY_SECTION_TITLES.markets}
      tone={TONE.NEUTRAL}
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'markets', DISPLAY_SECTION_TITLES.markets, { disabled: edit.editing })}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.markets}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <MorningBriefMarketsTable
        marketBriefData={marketBriefData}
        items={indicesItems}
        onSaveToBrain={onSaveToBrain}
        showEmpty
        bulkSelection={bulkSelection}
        bulkSections={bulkSections}
      />
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
            return (
              <UniversalTabSelectRow
                key={i}
                className="group"
                checkbox={(
                  <MorningBriefBulkCheckbox
                    bulkSections={bulkSections}
                    sectionKey="sectors"
                    text={sectorText}
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
          return (
            <UniversalTabSelectRow
              key={i}
              className="group"
              checkbox={(
                <MorningBriefBulkCheckbox
                  bulkSections={bulkSections}
                  sectionKey="sectors"
                  text={sectorText}
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
export function SectorOverviewSection({ marketBriefData, onSaveMarketBriefSection, bulkSelection = null, bulkSections = [] }) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.sectors, { marketBriefData, onSaveMarketBriefSection });
  const rows = extractSectorRows(getSpecializedSrc(marketBriefData));
  const split = splitNewsByTone(rows, (r) => `${r.direction} ${r.relativeStrength}`);

  return (
    <SectionCard
      title="🏭 סקטורים"
      count={rows.length}
      tone={TONE.NEUTRAL}
      isEmpty={!edit.editing && rows.length === 0}
      emptyMessage="ביצועי סקטורים ורוטציה יוצגו כאן"
      plainSurface
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'sectors', '🏭 סקטורים', { disabled: edit.editing })}
      headerPills={!edit.editing ? (
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
        {/* Mobile: stacked Positive → Negative → Neutral */}
        <div className="lg:hidden space-y-3">
          <SectorComparisonColumn
            variant="positive"
            title={DISPLAY_COLUMN_TITLES.sectors.positive}
            count={split.bullishCount}
            rows={split.positive}
            emptyMessage="לא נמצאו סקטורים חיוביים"
            bulkSelection={bulkSelection}
            bulkSections={bulkSections}
          />
          <SectorComparisonColumn
            variant="negative"
            title={DISPLAY_COLUMN_TITLES.sectors.negative}
            count={split.bearishCount}
            rows={split.negative}
            emptyMessage="לא נמצאו סקטורים שליליים"
            bulkSelection={bulkSelection}
            bulkSections={bulkSections}
          />
          <SectorNeutralBlock rows={split.neutral} bulkSelection={bulkSelection} bulkSections={bulkSections} />
        </div>

        {/* Desktop: 2 columns — Positive right, Negative left (RTL). Hidden when both empty. */}
        {(split.bullishCount > 0 || split.bearishCount > 0) && (
        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3 lg:max-h-[min(60vh,480px)] lg:min-h-[160px]">
          <SectorComparisonColumn
            variant="positive"
            title={DISPLAY_COLUMN_TITLES.sectors.positive}
            count={split.bullishCount}
            rows={split.positive}
            scrollable
            emptyMessage="לא נמצאו סקטורים חיוביים"
            bulkSelection={bulkSelection}
            bulkSections={bulkSections}
          />
          <SectorComparisonColumn
            variant="negative"
            title={DISPLAY_COLUMN_TITLES.sectors.negative}
            count={split.bearishCount}
            rows={split.negative}
            scrollable
            emptyMessage="לא נמצאו סקטורים שליליים"
            bulkSelection={bulkSelection}
            bulkSections={bulkSections}
          />
        </div>
        )}
        <div className={`hidden lg:block${(split.bullishCount > 0 || split.bearishCount > 0) && split.neutral.length > 0 ? ' mt-3' : ''}`}>
          <SectorNeutralBlock rows={split.neutral} bulkSelection={bulkSelection} bulkSections={bulkSections} />
        </div>
      </div>
      )}
    </SectionCard>
  );
}

// ── 4. News ──────────────────────────────────────────────────────────
export function NewsSection({
  items = [],
  onSaveToBrain,
  marketBriefData,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
}) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.news, {
    marketBriefData,
    onSaveMarketBriefSection,
    newsItems: items,
  });
  const strings = normalizeNewsStrings(items);
  const split = splitNewsByTone(strings, (t) => t);

  return (
    <SectionCard
      title="📰 חדשות"
      count={strings.length}
      tone={TONE.NEUTRAL}
      isEmpty={!edit.editing && strings.length === 0}
      emptyMessage="כותרות ועדכוני שוק יוצגו כאן"
      plainSurface
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'news', '📰 חדשות', { disabled: edit.editing })}
      headerPills={!edit.editing ? (
        <ThreeToneSummaryPills
          bullishCount={split.bullishCount}
          neutralCount={split.neutral.length}
          bearishCount={split.bearishCount}
          labels={{ positive: 'חיוביות', neutral: 'כלליות', negative: 'שליליות' }}
        />
      ) : null}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.news}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <div dir="rtl" data-news-comparison>
        {/* Mobile: stacked Positive → Neutral → Negative */}
        <div className="lg:hidden space-y-1.5">
          <NewsComparisonColumn
            variant="positive"
            count={split.bullishCount}
            items={split.positive}
            onSaveToBrain={onSaveToBrain}
            emptyMessage="לא נמצאו חדשות חיוביות"
            bulkSelection={bulkSelection}
            bulkSections={bulkSections}
          />
          <NewsNeutralBlock items={split.neutral} onSaveToBrain={onSaveToBrain} bulkSelection={bulkSelection} bulkSections={bulkSections} />
          <NewsComparisonColumn
            variant="negative"
            count={split.bearishCount}
            items={split.negative}
            onSaveToBrain={onSaveToBrain}
            emptyMessage="לא נמצאו חדשות שליליות"
            bulkSelection={bulkSelection}
            bulkSections={bulkSections}
          />
        </div>

        {/* Desktop: 3 columns — Positive | Neutral | Negative (RTL: right → left) */}
        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-1.5 lg:max-h-[min(55vh,440px)] lg:min-h-[120px]">
          <NewsComparisonColumn
            variant="positive"
            count={split.bullishCount}
            items={split.positive}
            onSaveToBrain={onSaveToBrain}
            scrollable
            emptyMessage="לא נמצאו חדשות חיוביות"
            bulkSelection={bulkSelection}
            bulkSections={bulkSections}
          />
          <NewsNeutralBlock items={split.neutral} onSaveToBrain={onSaveToBrain} scrollable bulkSelection={bulkSelection} bulkSections={bulkSections} />
          <NewsComparisonColumn
            variant="negative"
            count={split.bearishCount}
            items={split.negative}
            onSaveToBrain={onSaveToBrain}
            scrollable
            emptyMessage="לא נמצאו חדשות שליליות"
            bulkSelection={bulkSelection}
            bulkSections={bulkSections}
          />
        </div>
      </div>
      )}
    </SectionCard>
  );
}

// ── 5. Macro ─────────────────────────────────────────────────────────
const MACRO_TABLE_HEADERS = [
  { key: 'indicator', label: 'אינדיקטור' },
  { key: 'value', label: 'ערך נוכחי' },
  { key: 'change', label: 'שינוי' },
  { key: 'frequency', label: 'תדירות עדכון' },
  { key: 'description', label: 'תיאור' },
  { key: 'impact', label: 'השפעה' },
];

function mergeMacroDisplayRows(primaryRows, fallbackItems) {
  const seen = new Set(primaryRows.map((r) => `${r.indicator}|${r.value}|${r.change}|${r.description}`));
  const merged = [...primaryRows];
  for (const item of fallbackItems) {
    const parsed = parseMacroDisplayItem(item);
    if (!parsed?.indicator) continue;
    const sig = `${parsed.indicator}|${parsed.value}|${parsed.change}|${parsed.description}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    merged.push(parsed);
  }
  return merged;
}

function macroRowChangeContext(row) {
  return [row?.impact, row?.description, row?.indicator, row?.value].filter(Boolean).join(' ');
}

function MacroChangeCell({ change, row }) {
  const display = getMacroChangeDisplay(change, macroRowChangeContext(row));
  if (!display) {
    return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  }
  return <NumericChangeSpan display={display} />;
}

function MacroDirectionCell({ text, row, className = DASHBOARD_TABLE_STATUS_CLS }) {
  const display = getMacroFieldDisplay(text, row);
  if (!display) {
    return <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>;
  }
  return <NumericChangeSpan display={display} className={className} />;
}

/** Compact impact badge — shows only tone label, never raw AI narrative. */
function MacroImpactBadge({ text }) {
  if (!text) return <span className="text-slate-300 dark:text-zinc-600">—</span>;
  const tone = resolveTone(text);
  const styles = toneStyles(tone);
  const label = tone === TONE.BULLISH
    ? `🟢 ${TONE_DISPLAY_LABELS.positive}`
    : tone === TONE.BEARISH
      ? `🔴 ${TONE_DISPLAY_LABELS.negative}`
      : `⚪ ${TONE_DISPLAY_LABELS.neutral}`;
  return (
    <span className={`inline-flex items-center whitespace-nowrap text-xs font-semibold ${styles.text}`}>
      {label}
    </span>
  );
}

function MacroRowSummary(row) {
  return [row.indicator, row.value, row.change, row.frequency, row.description, row.impact]
    .filter(Boolean)
    .join(' · ');
}

export function MacroSection({
  items = [],
  marketBriefData,
  onSaveToBrain,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
}) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.macro, { marketBriefData, onSaveMarketBriefSection });
  const src = getSpecializedSrc(marketBriefData);
  const fromSrc = extractMacroIndicatorRows(src);
  const marketRows = extractMarketDashboardRows(src);
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const rows = cleanupMacroDisplayRows(mergeMacroDisplayRows(fromSrc, safeItems), marketRows)
    .filter((row) => Boolean(row.value || row.change || row.description || row.impact || row.frequency));

  return (
    <SectionCard
      title={DISPLAY_SECTION_TITLES.macro}
      count={rows.length}
      tone={TONE.NEUTRAL}
      isEmpty={!edit.editing && rows.length === 0}
      emptyMessage="גורמי מאקרו, אירועים כלכליים ו-VIX יוצגו כאן"
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'macro', DISPLAY_SECTION_TITLES.macro, { disabled: edit.editing })}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.macro}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <div dir="rtl" data-macro-section>
        {/* Desktop table */}
        <div className="hidden md:block max-h-[min(70vh,520px)] overflow-y-auto rounded-lg border border-slate-200/80 dark:border-zinc-700/80">
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              {(onSaveToBrain || bulkSelection) && <col className="w-[32px]" />}
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[38%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className={`sticky top-0 z-10 ${COMPARISON_TABLE_HEAD_BG} backdrop-blur-sm`}>
              <tr className="border-b border-slate-200 dark:border-zinc-700">
                {(onSaveToBrain || bulkSelection) && (
                  <th className={UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS} aria-label="בחירה" />
                )}
                {MACRO_TABLE_HEADERS.map((h) => (
                  <th
                    key={h.key}
                    className={`px-2.5 py-2 text-right whitespace-nowrap ${DASHBOARD_TABLE_HEAD_CLS}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const summary = MacroRowSummary(row);
                const rowTone = resolveTone([row.change, row.impact, row.description].filter(Boolean).join(' '));
                const rowBorder = toneStyles(rowTone).border;
                return (
                  <tr
                    key={i}
                    className={`border-b border-slate-100 dark:border-zinc-800/60 ${COMPARISON_ROW_HOVER} transition-colors group border-r-2 ${rowBorder}`}
                    data-macro-row
                  >
                    {(onSaveToBrain || bulkSelection) && (
                      <td className={UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS}>
                        <div className="flex flex-col items-center gap-1">
                          <MorningBriefBulkCheckbox
                            bulkSections={bulkSections}
                            sectionKey="macro"
                            text={summary}
                            sectionLabel="🌍 מאקרו"
                            tabKey="brief-macro"
                            bulkSelection={bulkSelection}
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
                      </td>
                    )}
                    <td className={`px-2.5 py-2 align-top whitespace-nowrap ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{row.indicator || '—'}</td>
                    <td className={`px-2.5 py-2 align-top whitespace-nowrap tabular-nums ${DASHBOARD_TABLE_CELL_BODY_CLS}`}>{row.value || '—'}</td>
                    <td className="px-2.5 py-2 align-top whitespace-nowrap">
                      <MacroChangeCell change={row.change} row={row} />
                    </td>
                    <td className={`px-2.5 py-2 align-top whitespace-nowrap ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>{row.frequency || '—'}</td>
                    <td
                      className="px-2.5 py-2 align-top text-right"
                      title={row.description || undefined}
                    >
                      {row.description ? (
                        <div className="leading-snug line-clamp-2 overflow-hidden">
                          <MacroDirectionCell text={row.description} row={row} />
                        </div>
                      ) : (
                        <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 align-top whitespace-nowrap">
                      <MacroImpactBadge text={row.impact} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile compact cards */}
        <div className="md:hidden space-y-2" data-macro-mobile>
          {rows.map((row, i) => {
            const summary = MacroRowSummary(row);
            const rowTone = resolveTone([row.change, row.impact, row.description].filter(Boolean).join(' '));
            const styles = toneStyles(rowTone);
            const changeDisplay = getMacroChangeDisplay(row.change, macroRowChangeContext(row));
            const descriptionDisplay = row.description ? getMacroFieldDisplay(row.description, row) : null;
            const impactDisplay = row.impact ? getMacroFieldDisplay(row.impact, row) : null;
            return (
              <details
                key={i}
                className={`rounded-lg border ${styles.border} ${COMPARISON_SURFACE_BG} overflow-hidden group`}
                data-macro-row
              >
                <summary className="px-3 py-2.5 cursor-pointer list-none text-right">
                  <UniversalTabSelectRow
                    checkbox={(
                      <MorningBriefBulkCheckbox
                        bulkSections={bulkSections}
                        sectionKey="macro"
                        text={summary}
                        sectionLabel="🌍 מאקרו"
                        tabKey="brief-macro"
                        bulkSelection={bulkSelection}
                      />
                    )}
                    actions={changeDisplay ? (
                      <NumericChangeSpan display={changeDisplay} />
                    ) : null}
                  >
                    <p className={`truncate ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{row.indicator || '—'}</p>
                    {row.value && (
                      <p className={`tabular-nums ${DASHBOARD_TABLE_CELL_BODY_CLS}`}>{row.value}</p>
                    )}
                  </UniversalTabSelectRow>
                </summary>
                <div className="px-3 pb-2.5 pt-0 space-y-1.5 border-t border-slate-100 dark:border-zinc-800/60 text-right">
                  {row.frequency && (
                    <p className={DASHBOARD_TABLE_CELL_MUTED_CLS}>
                      <span className="font-semibold">תדירות: </span>{row.frequency}
                    </p>
                  )}
                  {descriptionDisplay && (
                    <p className="leading-relaxed">
                      <NumericChangeSpan display={descriptionDisplay} />
                    </p>
                  )}
                  {impactDisplay && (
                    <p className="leading-relaxed">
                      <span className={`font-semibold ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>השפעה: </span>
                      <NumericChangeSpan display={impactDisplay} />
                    </p>
                  )}
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
              </details>
            );
          })}
        </div>
      </div>
      )}
    </SectionCard>
  );
}

// ── 6. Sentiment ─────────────────────────────────────────────────────
function sentimentLabelEmoji(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('מוסדי') || l.includes('institutional')) return '🏦';
  if (l.includes('פחד') || l.includes('fear') || l.includes('greed') || l.includes('חמדנות')) return '😨';
  if (l.includes('קמעונאי') || l.includes('retail')) return '🛒';
  if (l.includes('כללי') || l.includes('overall') || l.includes('אווירה')) return '📊';
  return '🧠';
}

function SentimentListItem({
  label,
  value,
  bulkSelection = null,
  bulkSections = [],
}) {
  const valueText = String(value || '').trim();
  const displayLabel = translateSentimentLabel(label);
  const displayValue = translateSentimentValue(valueText);
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
}) {
  const items = extractSentimentItems(getSpecializedSrc(marketBriefData));
  const tone = items.length > 0
    ? resolveTone(items.map((i) => i.value).join(' '))
    : TONE.NEUTRAL;

  return (
    <SectionCard
      title={DISPLAY_SECTION_TITLES.sentiment}
      count={items.length}
      tone={tone}
      isEmpty={items.length === 0}
      emptyMessage="סנטימנט קמעונאי, מוסדי ופחד וחמדנות יוצגו כאן"
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'sentiment', DISPLAY_SECTION_TITLES.sentiment)}
    >
      <div dir="rtl" className="w-full px-0.5" data-sentiment-list>
        {items.map(({ label, value }, i) => (
          <SentimentListItem
            key={`${label}-${i}`}
            label={label}
            value={value}
            bulkSelection={bulkSelection}
            bulkSections={bulkSections}
          />
        ))}
      </div>
    </SectionCard>
  );
}

// ── 7. Economic Calendar ─────────────────────────────────────────────
function CalendarTypeBadge({ type }) {
  if (!type) return <span className={`text-slate-300 dark:text-zinc-600 ${DASHBOARD_TABLE_CELL_MUTED_CLS}`}>—</span>;
  return (
    <span className={`inline whitespace-nowrap ${DASHBOARD_TABLE_CELL_BODY_CLS} text-violet-700 dark:text-violet-300`}>
      {type}
    </span>
  );
}

function CalendarImportanceText({ level, table = false }) {
  if (!level || !importanceTextStyles(level)) {
    return <span className={`text-slate-300 dark:text-zinc-600 ${table ? DASHBOARD_TABLE_CELL_MUTED_CLS : 'text-[10px]'}`}>—</span>;
  }
  return <ImportanceBadge level={level} size={table ? 'table' : 'xs'} />;
}

function CalendarLegend() {
  return (
    <div
      className="flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 mt-1.5 pt-1.5 border-t border-slate-100/80 dark:border-zinc-800/50 text-[9px] text-slate-400 dark:text-zinc-500"
      dir="rtl"
      data-calendar-legend
    >
      <span className="inline-flex items-center gap-1">
        <CalendarTypeBadge type="CPI" />
        <CalendarTypeBadge type="FOMC" />
        <span className="text-slate-300 dark:text-zinc-600">סוג אירוע</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <CalendarImportanceText level="high" />
        <CalendarImportanceText level="critical" />
        <CalendarImportanceText level="medium" />
        <CalendarImportanceText level="low" />
        <span className="text-slate-300 dark:text-zinc-600">חשיבות</span>
      </span>
      <span>השפעה · צבע לפי כיוון</span>
    </div>
  );
}

function CalendarMobileCard({
  row,
  bulkSelection = null,
  bulkSections = [],
}) {
  const calendarText = [row.event, row.date, row.importance, row.impact].filter(Boolean).join(' · ');
  return (
    <details
      className={`rounded-lg border border-slate-200/80 dark:border-zinc-700/60 ${COMPARISON_SURFACE_BG} overflow-hidden group`}
      data-calendar-row
    >
      <summary className="px-2.5 py-2 cursor-pointer list-none text-right min-h-0">
        <UniversalTabSelectRow
          checkbox={(
            <MorningBriefBulkCheckbox
              bulkSections={bulkSections}
              sectionKey="economic-calendar"
              text={calendarText}
              sectionLabel="📅 לוח כלכלי"
              tabKey="brief-calendar"
              bulkSelection={bulkSelection}
            />
          )}
          actions={(
            <>
              <BriefQuickSaveActions
                bulkSelection={bulkSelection}
                text={calendarText}
                sectionLabel="📅 לוח כלכלי"
                tabKey="brief-calendar"
              />
              <CalendarTypeBadge type={row.type} />
              {row.importance && <CalendarImportanceText level={row.importance} />}
            </>
          )}
        >
          <p className={`truncate ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{row.event}</p>
          {row.date && (
            <p className={DASHBOARD_TABLE_CELL_DATE_CLS}>{row.date}</p>
          )}
        </UniversalTabSelectRow>
      </summary>
      {row.impact && (
        <div className="px-2.5 pb-2 pt-0 border-t border-slate-100/80 dark:border-zinc-800/50 text-right">
          <p className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} mb-0.5`}>השפעה</p>
          <ChangeValue value={row.impact} />
        </div>
      )}
    </details>
  );
}

export function EconomicCalendarSection({
  marketBriefData,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
}) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.economicCalendar, { marketBriefData, onSaveMarketBriefSection });
  const rows = extractCalendarRows(getSpecializedSrc(marketBriefData));

  return (
    <SectionCard
      title={DISPLAY_SECTION_TITLES.economicCalendar}
      count={rows.length}
      tone={TONE.NEUTRAL}
      isEmpty={!edit.editing && rows.length === 0}
      emptyMessage="אירועים כלכליים, דוחות ו-CPI יוצגו כאן"
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'economic-calendar', DISPLAY_SECTION_TITLES.economicCalendar, { disabled: edit.editing })}
    >
      {edit.editing ? (
        <ManualEditGrid
          columns={SECTION_EDIT_COLUMNS.economicCalendar}
          rows={edit.draft}
          onChange={edit.setDraft}
        />
      ) : (
      <div dir="rtl" data-economic-calendar>
        {/* Desktop — compact balanced table */}
        <div className="hidden md:block rounded-lg border border-slate-200/60 dark:border-zinc-700/50 overflow-hidden">
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              {bulkSelection && <col className="w-[32px]" />}
              <col className="w-[10%]" />
              <col className="w-[38%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className={COMPARISON_TABLE_HEAD_BG}>
              <tr className="border-b border-slate-200/80 dark:border-zinc-700/60">
                {bulkSelection && (
                  <th className={UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS} aria-label="בחירה" />
                )}
                <th className={`px-2.5 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>סוג</th>
                <th className={`px-2.5 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>אירוע</th>
                <th className={`px-2.5 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>מועד</th>
                <th className={`px-2.5 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>חשיבות</th>
                <th className={`px-2.5 py-2 text-right ${DASHBOARD_TABLE_HEAD_CLS}`}>השפעה</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const calendarText = [row.event, row.date, row.importance, row.impact].filter(Boolean).join(' · ');
                return (
                <tr
                  key={i}
                  className={`border-b border-slate-100/80 dark:border-zinc-800/40 ${COMPARISON_ROW_HOVER} transition-colors align-middle`}
                  data-calendar-row
                >
                  {bulkSelection && (
                    <td className={UNIVERSAL_TAB_TABLE_CHECKBOX_CELL_CLASS}>
                      <div className="flex flex-col items-center gap-1">
                        <MorningBriefBulkCheckbox
                          bulkSections={bulkSections}
                          sectionKey="economic-calendar"
                          text={calendarText}
                          sectionLabel="📅 לוח כלכלי"
                          tabKey="brief-calendar"
                          bulkSelection={bulkSelection}
                        />
                        <BriefQuickSaveActions
                          bulkSelection={bulkSelection}
                          text={calendarText}
                          sectionLabel="📅 לוח כלכלי"
                          tabKey="brief-calendar"
                        />
                      </div>
                    </td>
                  )}
                  <td className="px-2 py-1.5 align-middle">
                    <CalendarTypeBadge type={row.type} />
                  </td>
                  <td className={`px-2.5 py-2 truncate ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`} title={row.event}>
                    {row.event}
                  </td>
                  <td className={`px-2.5 py-2 whitespace-nowrap ${DASHBOARD_TABLE_CELL_DATE_CLS}`}>
                    {row.date || <span className="text-slate-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-2.5 py-2 align-middle">
                    <CalendarImportanceText level={row.importance} table />
                  </td>
                  <td className="px-2.5 py-2 align-middle leading-snug">
                    {row.impact ? <ChangeValue value={row.impact} /> : <span className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} text-slate-300 dark:text-zinc-600`}>—</span>}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile — compact accordion cards */}
        <div className="md:hidden space-y-1.5" data-calendar-mobile>
          {rows.map((row, i) => (
            <CalendarMobileCard
              key={i}
              row={row}
              bulkSelection={bulkSelection}
              bulkSections={bulkSections}
            />
          ))}
        </div>

        {rows.length > 0 && <CalendarLegend />}
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

  return (
    <UniversalTabSelectRow
      className={`group ${DASHBOARD_ITEM_ROW_CLS} text-right`}
      data-opportunity-item
      checkbox={(
        <MorningBriefBulkCheckbox
          bulkSections={bulkSections}
          sectionKey="opportunities"
          text={saveText}
          sectionLabel="🎯 הזדמנויות"
          tabKey="brief-opportunities"
          bulkSelection={bulkSelection}
        />
      )}
      actions={(
        <BriefRowSaveActions
          bulkSelection={bulkSelection}
          text={saveText}
          sectionLabel="🎯 הזדמנויות"
          tabKey="brief-opportunities"
          onSaveToBrain={onSaveToBrain}
        />
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
        <BriefRowSaveActions
          bulkSelection={bulkSelection}
          text={risk.text}
          sectionLabel="⚠️ סיכונים"
          tabKey="brief-risks"
          onSaveToBrain={onSaveToBrain}
        />
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

/** Side-by-side Opportunities / Risks dashboard (desktop) with stacked mobile layout. */
export function OpportunitiesRisksDashboard({
  marketBriefData,
  effectiveVideo,
  onSaveToBrain,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
}) {
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.opportunitiesRisks, {
    marketBriefData,
    effectiveVideo,
    onSaveMarketBriefSection,
  });
  const ideas = filterOpportunityIdeas(marketBriefData, effectiveVideo);
  const risks = extractRiskItems(getSpecializedSrc(marketBriefData));

  return (
    <SectionCard
      title="🎯 הזדמנויות וסיכונים"
      tone={TONE.NEUTRAL}
      isEmpty={!edit.editing && ideas.length === 0 && risks.length === 0}
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
      headerPills={!edit.editing ? (
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
      <div dir="rtl" data-opportunities-risks-dashboard>
      {/* Mobile: stacked — Opportunities then Risks */}
      <div className="lg:hidden space-y-3">
        <OpportunitiesColumn ideas={ideas} onSaveToBrain={onSaveToBrain} bulkSelection={bulkSelection} bulkSections={bulkSections} />
        <RisksColumn risks={risks} onSaveToBrain={onSaveToBrain} bulkSelection={bulkSelection} bulkSections={bulkSections} />
      </div>

      {/* Desktop: 2 equal columns, independent scroll — Opportunities right, Risks left (RTL) */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3 lg:h-[min(70vh,560px)] lg:min-h-[200px]">
        <OpportunitiesColumn ideas={ideas} onSaveToBrain={onSaveToBrain} scrollable bulkSelection={bulkSelection} bulkSections={bulkSections} />
        <RisksColumn risks={risks} onSaveToBrain={onSaveToBrain} scrollable bulkSelection={bulkSelection} bulkSections={bulkSections} />
      </div>
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

function StockMentionRow({
  stock,
  onSaveToBrain,
  isLast = false,
  bulkSelection = null,
  bulkSections = [],
}) {
  const summary = [stock.ticker, stock.company, stock.context, stock.sentiment].filter(Boolean).join(' · ');
  const dirFields = stockDirFields(stock);
  const dir = getDirectionFromFields(dirFields);
  const styles = toneStyles(dir.tone);
  const headerBadges = collectStockDisplayBadges(stock, dirFields);
  const notesText = String(stock.notes || '').trim();
  const contextText = String(stock.context || '').trim();
  const showNotes = notesText && notesText !== contextText;
  const actionabilityText = stockMentionActionability(stock.actionability);
  const movePercent = parseStockMovePercentFromText(
    [contextText, notesText, stock.sentiment],
    dir.tone !== TONE.NEUTRAL ? dir.tone : null,
  );

  return (
    <UniversalTabSelectRow
      className={`group ${DASHBOARD_ITEM_ROW_CLS} text-right`}
      data-stock-item
      checkbox={(
        <MorningBriefBulkCheckbox
          bulkSections={bulkSections}
          sectionKey="stocks-mentioned"
          text={summary}
          sectionLabel="⭐ מניות שהוזכרו"
          tabKey="stocks-mentioned"
          bulkSelection={bulkSelection}
        />
      )}
      actions={(
        <BriefRowSaveActions
          bulkSelection={bulkSelection}
          text={summary}
          sectionLabel="⭐ מניות שהוזכרו"
          tabKey="stocks-mentioned"
          onSaveToBrain={onSaveToBrain}
        />
      )}
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 justify-start min-w-0" data-stock-row-header>
        <span className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} shrink-0 ${styles.text}`}>{stock.ticker}</span>
        <StockMovePercentIndicator move={movePercent} />
        {headerBadges.map((badge, i) => (
          <span key={`${badge.kind}-${i}`} className="inline-flex items-center gap-x-1.5 shrink-0">
            <span className="text-slate-300 dark:text-zinc-600 select-none" aria-hidden>|</span>
            {badge.kind === 'direction' ? (
              <StockMentionDirectionText fields={dirFields} />
            ) : (
              <StockCategoryText category={stock.category} />
            )}
          </span>
        ))}
      </div>
      {stock.company && (
        <p className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} mt-1`}>{stock.company}</p>
      )}
      {contextText && (
        <p className={`${DASHBOARD_TABLE_CELL_BODY_CLS} mt-1 break-words ${styles.text}`}>{contextText}</p>
      )}
      {showNotes && (
        <p className={`${DASHBOARD_TABLE_CELL_BODY_CLS} mt-1 break-words`}>{notesText}</p>
      )}
      {actionabilityText && (
        <p className={`${DASHBOARD_TABLE_CELL_MUTED_CLS} mt-1`}>
          פעולה: {actionabilityText}
        </p>
      )}
      {!isLast && (
        <div className="mt-2.5 border-b border-slate-200/70 dark:border-zinc-700/50" aria-hidden />
      )}
    </UniversalTabSelectRow>
  );
}

export function StocksMentionedSection({
  marketBriefData,
  effectiveVideo,
  onSaveToBrain,
  onSaveMarketBriefSection,
  bulkSelection = null,
  bulkSections = [],
}) {
  const [sortBy, setSortBy] = useState('sentiment');
  const edit = useMorningBriefSectionEdit(BRIEF_MANUAL_SECTION_IDS.stocksMentioned, {
    marketBriefData,
    effectiveVideo,
    onSaveMarketBriefSection,
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
      count={stocks.length}
      tone={tone}
      isEmpty={!edit.editing && stocks.length === 0}
      emptyMessage="טיקרים, סנטימנט והקשר יוצגו כאן"
      plainSurface
      headerActions={edit.headerActions}
      cardBulk={morningBriefCardBulk(bulkSections, bulkSelection, 'stocks-mentioned', '⭐ מניות שהוזכרו', { disabled: edit.editing })}
      headerPills={!edit.editing ? (
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
        {/* Sort controls */}
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
        {/* Unified flat stock list */}
        {sortedStocks.map((stock, i) => {
          const sentKey = stockSentimentColumnKey(stock);
          const sentEmoji = sentKey === 'bullish' ? '🟢' : sentKey === 'bearish' ? '🔴' : '🔵';
          return (
            <div key={`${stock.ticker}-${i}`} className="flex items-start gap-2 min-w-0">
              <span className="text-sm leading-none mt-2 shrink-0 select-none" aria-hidden>{sentEmoji}</span>
              <div className="flex-1 min-w-0">
                <StockMentionRow
                  stock={stock}
                  onSaveToBrain={onSaveToBrain}
                  isLast={i === sortedStocks.length - 1}
                  bulkSelection={bulkSelection}
                  bulkSections={bulkSections}
                />
              </div>
            </div>
          );
        })}
      </div>
      )}
    </SectionCard>
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
