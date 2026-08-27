import { LearningTabContent } from './LearningTabContent';
import { SectionCard } from './MorningBriefVisualPrimitives';
import { TONE } from '@/lib/morningBriefVisuals';
import { formatBulkItemText, mergeBulkSelection } from '@/lib/universalTabBulkItems';

/** Row hover — matches StocksMentionedSection / Morning Brief dedicated tables. */
export const DEDICATED_CONTENT_ROW_HOVER =
  'group rounded-lg px-2 py-2 hover:bg-slate-50/50 dark:hover:bg-zinc-800/25 transition-colors';

/**
 * Standard list section for the 🎯 תוכן ייעודי (Dedicated Content) tab.
 * Mirrors StocksMentionedSection shell: SectionCard, RTL wrapper, bulk select-all, row hover.
 */
export function DedicatedContentSection({
  label,
  items,
  tabKey,
  sectionKey,
  onSaveToBrain,
  checkSaved,
  bulkSelection = null,
  macroDirection = false,
  videoId = null,
}) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  if (safe.length === 0) return null;

  const resolvedSectionKey = sectionKey || tabKey;
  const idPrefix = `specialized:${resolvedSectionKey}`;
  const sectionChildItems = bulkSelection
    ? safe.map((item, i) => ({
        id: `${idPrefix}:${i}`,
        text: formatBulkItemText(item),
        sectionLabel: label,
        type: tabKey,
        tabScope: 'specialized',
      }))
    : null;

  const mergedBulk = bulkSelection
    ? mergeBulkSelection(bulkSelection, {
        idPrefix,
        sectionLabel: label,
        type: tabKey,
        tabScope: 'specialized',
      })
    : null;

  return (
    <SectionCard
      title={label}
      count={safe.length}
      tone={TONE.NEUTRAL}
      plainSurface
      sectionSelectAllItems={sectionChildItems}
      bulkSelection={bulkSelection}
    >
      <div dir="rtl" data-dedicated-content-section={resolvedSectionKey}>
        <LearningTabContent
          items={safe}
          videoId={videoId}
          emptyLabel=""
          macroDirection={macroDirection}
          onSaveToBrain={onSaveToBrain ? (text) => onSaveToBrain(text, tabKey, label) : undefined}
          isSaved={checkSaved ? (text) => checkSaved(text, tabKey) : undefined}
          bulkSelection={mergedBulk}
          rowClassName={DEDICATED_CONTENT_ROW_HOVER}
        />
      </div>
    </SectionCard>
  );
}
