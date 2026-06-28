import { LearningTabContent } from './LearningTabContent';
import { CollapsibleFullSummary } from './CollapsibleFullSummary';
import { buildDailyBriefingView } from '@/lib/summaryBriefingDisplay';
import { mergeBulkSelection, flattenMarketStatusItems, formatCardBulkText } from '@/lib/universalTabBulkItems';
import {
  SUMMARY_CARD_CLASS,
  SUMMARY_CARD_TITLE_CLASS,
  SUMMARY_LEAD_CLASS,
} from '@/lib/summaryCardStyles';
import { SelectableSummaryCardHeader } from '@/components/shared/SelectableSummaryCardHeader';
import { UniversalTabSectionLabelRow } from '@/components/shared/UniversalTabSectionLabelRow';
import { cn } from '@/lib/utils';

const TONE_STYLES = {
  Bullish: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
  'Bullish but cautious': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
  Neutral: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  'Risk-off': 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800',
  'High volatility': 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800',
};

const TONE_DISPLAY = {
  Bullish: 'שורי',
  'Bullish but cautious': 'שורי-זהיר',
  Neutral: 'ניטרלי',
  'Risk-off': 'חשש בשוק',
  'High volatility': 'תנודתיות גבוהה',
};

function BriefingCard({
  title,
  cardId,
  cardItems = [],
  bulkSelection = null,
  children,
}) {
  if (!children) return null;
  const cardText = formatCardBulkText(title, cardItems);
  const hasCardBulk = bulkSelection && cardId && cardText;

  return (
    <div className={cn(SUMMARY_CARD_CLASS, hasCardBulk && 'group/card')}>
      {hasCardBulk ? (
        <SelectableSummaryCardHeader
          title={title}
          cardId={cardId}
          cardText={cardText}
          bulkSelection={bulkSelection}
          tabScope="summary"
          type="summary"
          sectionLabel={title}
          titleClassName={SUMMARY_CARD_TITLE_CLASS.replace(' mb-2', '')}
          headerRowClassName="pt-0 pb-2 mb-2 border-b border-slate-200/60 dark:border-zinc-700/60"
        />
      ) : title ? (
        <UniversalTabSectionLabelRow
          label={title}
          items={cardItems}
          bulkSelection={bulkSelection}
          tabScope="summary"
          type="summary"
          sectionKey={cardId}
        />
      ) : null}
      {children}
    </div>
  );
}

function BulletList({ items, leadFirst = false }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-2 text-right" dir="rtl">
      {items.map((text, i) => (
        <li
          key={i}
          className={cn(
            'flex items-start gap-2 justify-end',
            leadFirst && i === 0 ? 'block' : '',
          )}
        >
          {leadFirst && i === 0 ? (
            <p className={SUMMARY_LEAD_CLASS}>{text}</p>
          ) : (
            <>
              <span className="flex-1 text-sm text-slate-800 dark:text-zinc-200 leading-relaxed">{text}</span>
              <span className="text-slate-400 shrink-0">•</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function ChecklistList({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1.5 text-right" dir="rtl">
      {items.map((text, i) => (
        <li key={i} className="text-sm text-slate-800 dark:text-zinc-200 leading-relaxed flex items-start gap-2 justify-end">
          <span className="flex-1">{text}</span>
          <span className="text-slate-500 shrink-0 font-mono text-xs">□</span>
        </li>
      ))}
    </ul>
  );
}

function MarketStatusBlock({ status }) {
  if (!status) return null;
  const toneCls = TONE_STYLES[status.tone] || TONE_STYLES.Neutral;
  return (
    <div className="space-y-2 text-right" dir="rtl">
      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${toneCls}`}>
        {TONE_DISPLAY[status.tone] || status.tone}
      </span>
      {status.factors.length > 0 && (
        <ul className="space-y-1">
          {status.factors.map((f, i) => (
            <li key={i} className="text-sm text-slate-700 dark:text-zinc-300">• {f}</li>
          ))}
        </ul>
      )}
      {status.explanation && status.explanation !== status.tone && (
        <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{status.explanation}</p>
      )}
    </div>
  );
}

/**
 * Actionable daily briefing layout for Summary tab (presentation only).
 */
export function SummaryBriefingView({
  effectiveVideo,
  marketBriefData,
  summaryShort = '',
  fullSummary = '',
  summaryShaped = null,
  briefing: briefingProp = null,
  fullSummaryStorageKey = null,
  onSaveToBrain,
  isSaved,
  bulkSelection = null,
  children = null,
}) {
  const briefing = briefingProp ?? buildDailyBriefingView({
    effectiveVideo,
    marketBriefData,
    summaryShort,
    fullSummary,
    summaryShaped,
  });

  if (!briefing.hasBriefing && !children) return null;

  const brain = onSaveToBrain
    ? (text, label) => onSaveToBrain(text, 'summary', label)
    : null;

  const marketStatusItems = flattenMarketStatusItems(briefing.marketStatus);
  const fullSummaryItems = briefing.fullSummaryText ? [briefing.fullSummaryText] : [];
  const execItems = briefing.executiveConclusion ?? [];

  return (
    <div className="space-y-3" dir="rtl">
      {briefing.thirtySecond.length > 0 && (
        <BriefingCard
          title="🚀 סיכום ב-30 שניות"
          cardId="thirty"
          cardItems={briefing.thirtySecond}
          bulkSelection={bulkSelection}
        >
          {brain ? (
            <LearningTabContent
              items={briefing.thirtySecond}
              emptyLabel=""
              onSaveToBrain={(text) => brain(text, 'סיכום ב-30 שניות')}
              isSaved={isSaved ? (text) => isSaved(text, 'summary') : undefined}
              bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
                idPrefix: 'summary:thirty',
                sectionLabel: 'סיכום ב-30 שניות',
                type: 'summary',
                tabScope: 'summary',
              }) : null}
            />
          ) : (
            <BulletList items={briefing.thirtySecond} leadFirst />
          )}
        </BriefingCard>
      )}

      {briefing.marketStatus && (
        <BriefingCard
          title="🌡️ מצב השוק"
          cardId="market"
          cardItems={marketStatusItems}
          bulkSelection={bulkSelection}
        >
          {brain ? (
            <div className="space-y-2">
              {briefing.marketStatus.tone && (
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${TONE_STYLES[briefing.marketStatus.tone] || TONE_STYLES.Neutral}`}>
                  {TONE_DISPLAY[briefing.marketStatus.tone] || briefing.marketStatus.tone}
                </span>
              )}
              <LearningTabContent
                items={marketStatusItems}
                emptyLabel=""
                onSaveToBrain={(text) => brain(text, 'מצב השוק')}
                isSaved={isSaved ? (text) => isSaved(text, 'summary') : undefined}
                bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
                  idPrefix: 'summary:market',
                  sectionLabel: 'מצב השוק',
                  type: 'summary',
                  tabScope: 'summary',
                }) : null}
              />
            </div>
          ) : (
            <MarketStatusBlock status={briefing.marketStatus} />
          )}
        </BriefingCard>
      )}

      {briefing.watchToday.length > 0 && (
        <BriefingCard
          title="🎯 מה לעקוב היום"
          cardId="watch"
          cardItems={briefing.watchToday}
          bulkSelection={bulkSelection}
        >
          {brain ? (
            <LearningTabContent
              items={briefing.watchToday}
              emptyLabel=""
              onSaveToBrain={(text) => brain(text, 'מה לעקוב היום')}
              isSaved={isSaved ? (text) => isSaved(text, 'summary') : undefined}
              bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
                idPrefix: 'summary:watch',
                sectionLabel: 'מה לעקוב היום',
                type: 'summary',
                tabScope: 'summary',
              }) : null}
            />
          ) : (
            <BulletList items={briefing.watchToday} />
          )}
        </BriefingCard>
      )}

      {briefing.keyInsights.length > 0 && (
        <BriefingCard
          title="💡 התובנות החשובות ביותר"
          cardId="insights"
          cardItems={briefing.keyInsights}
          bulkSelection={bulkSelection}
        >
          {brain ? (
            <LearningTabContent
              items={briefing.keyInsights}
              emptyLabel=""
              onSaveToBrain={(text) => brain(text, 'תובנות מרכזיות')}
              isSaved={isSaved ? (text) => isSaved(text, 'summary') : undefined}
              bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
                idPrefix: 'summary:insights',
                sectionLabel: 'תובנות מרכזיות',
                type: 'summary',
                tabScope: 'summary',
              }) : null}
            />
          ) : (
            <BulletList items={briefing.keyInsights} />
          )}
        </BriefingCard>
      )}

      {briefing.keyRisks.length > 0 && (
        <BriefingCard
          title="⚠️ סיכונים מרכזיים"
          cardId="risks"
          cardItems={briefing.keyRisks}
          bulkSelection={bulkSelection}
        >
          {brain ? (
            <LearningTabContent
              items={briefing.keyRisks}
              emptyLabel=""
              onSaveToBrain={(text) => brain(text, 'סיכונים')}
              isSaved={isSaved ? (text) => isSaved(text, 'summary') : undefined}
              bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
                idPrefix: 'summary:risks',
                sectionLabel: 'סיכונים',
                type: 'summary',
                tabScope: 'summary',
              }) : null}
            />
          ) : (
            <BulletList items={briefing.keyRisks} />
          )}
        </BriefingCard>
      )}

      {briefing.actionChecklist.length > 0 && (
        <BriefingCard
          title="📋 צ'קליסט פעולה"
          cardId="checklist"
          cardItems={briefing.actionChecklist}
          bulkSelection={bulkSelection}
        >
          {brain ? (
            <LearningTabContent
              items={briefing.actionChecklist}
              emptyLabel=""
              onSaveToBrain={(text) => brain(text, 'צ\'קליסט פעולה')}
              isSaved={isSaved ? (text) => isSaved(text, 'summary') : undefined}
              bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
                idPrefix: 'summary:checklist',
                sectionLabel: 'צ\'קליסט פעולה',
                type: 'summary',
                tabScope: 'summary',
              }) : null}
            />
          ) : (
            <ChecklistList items={briefing.actionChecklist} />
          )}
        </BriefingCard>
      )}

      {(execItems.length > 0 || briefing.fullSummaryText || children) && (
        <BriefingCard
          title="🎯 מסקנה מנהלים"
          cardId="full"
          cardItems={execItems.length > 0 ? execItems : fullSummaryItems}
          bulkSelection={bulkSelection}
        >
          {execItems.length > 0 ? (
            brain ? (
              <LearningTabContent
                items={execItems}
                emptyLabel=""
                onSaveToBrain={(text) => brain(text, 'מסקנה מנהלים')}
                isSaved={isSaved ? (text) => isSaved(text, 'summary') : undefined}
                bulkSelection={bulkSelection ? mergeBulkSelection(bulkSelection, {
                  idPrefix: 'summary:exec',
                  sectionLabel: 'מסקנה מנהלים',
                  type: 'summary',
                  tabScope: 'summary',
                }) : null}
              />
            ) : (
              <BulletList items={execItems} />
            )
          ) : (
            <>
              {briefing.fullSummaryText && (
                <CollapsibleFullSummary
                  text={briefing.fullSummaryText}
                  storageKey={fullSummaryStorageKey}
                  className="mb-3"
                />
              )}
              {children}
            </>
          )}
        </BriefingCard>
      )}
    </div>
  );
}
