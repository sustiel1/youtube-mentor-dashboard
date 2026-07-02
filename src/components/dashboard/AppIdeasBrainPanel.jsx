import { useMemo, useCallback } from 'react';
import { CircleHelp } from 'lucide-react';
import { renderLinkedMarketText } from '@/components/shared/LinkedMarketText';
import {
  APP_IDEAS_BRAIN_SECTIONS,
  extractAppIdeas,
  flattenAppIdeasBrain,
  countAppIdeasBrain,
} from '@/lib/extractAppIdeas';
import {
  formatBrainItemForDisplay,
  formatBrainSectionHeading,
  formatBrainTotalCount,
} from '@/lib/appIdeasBrainHumanization';
import {
  UniversalTabCheckbox,
  UniversalTabSelectRow,
} from '@/components/shared/UniversalTabSelectRow';
import { UniversalTabQuickSaveFromBulk } from '@/components/shared/UniversalTabQuickSaveActions';
import { UniversalTabSectionHeaderActions } from '@/components/shared/UniversalTabSectionHeaderActions';
import {
  formatCardBulkText,
  formatSectionCopyText,
  mergeBulkSelection,
} from '@/lib/universalTabBulkItems';

function BrainSourceTrace({ sourcePath }) {
  if (!sourcePath) return null;

  return (
    <details className="shrink-0 opacity-50 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <summary
        className="list-none cursor-pointer rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 [&::-webkit-details-marker]:hidden"
        title="מקור הנתונים"
        aria-label="מקור הנתונים"
      >
        <CircleHelp className="h-4 w-4" />
      </summary>
      <p
        className="absolute left-0 top-full mt-1 z-20 max-w-[min(100%,280px)] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-500 shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 font-mono break-all text-left"
        dir="ltr"
      >
        {sourcePath}
      </p>
    </details>
  );
}

function BrainListEntry({ item, isSelected, onToggle, bulkSelection = null }) {
  const { displayTitle, displayBody } = useMemo(
    () => formatBrainItemForDisplay(item),
    [item],
  );
  const saveText = displayTitle || item.title || item.content || '';

  return (
    <UniversalTabSelectRow
      className={`group relative gap-3 py-3 min-h-[44px] cursor-pointer border-b border-slate-100/80 dark:border-zinc-800/60 last:border-b-0 transition-colors ${
        isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20 -mx-1 px-1 rounded-md' : ''
      }`}
      checkbox={(
        <UniversalTabCheckbox
          checked={isSelected}
          onChange={onToggle}
          aria-label={`בחר: ${displayTitle}`}
        />
      )}
      actions={(
        <>
          <UniversalTabQuickSaveFromBulk
            bulkSelection={bulkSelection}
            text={saveText}
            sectionLabel="מוח רעיונות לאפליקציות"
            type="app-ideas-brain"
            tabScope="app-builder"
          />
          <BrainSourceTrace sourcePath={item.sourcePath} />
        </>
      )}
    >
      <p className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100 leading-relaxed">
        {renderLinkedMarketText(displayTitle)}
      </p>
      {displayBody && (
        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed whitespace-pre-wrap">
          {renderLinkedMarketText(displayBody)}
        </p>
      )}
    </UniversalTabSelectRow>
  );
}

function BrainDocumentSection({ section, items, isSelected, onToggle, bulkSelection = null }) {
  if (!items.length) return null;

  const sectionTitle = `${section.emoji} ${formatBrainSectionHeading(section.labelHe, items.length)}`;
  const itemLines = items.map((item) => {
    const { displayTitle, displayBody } = formatBrainItemForDisplay(item);
    return displayBody ? `${displayTitle}\n${displayBody}` : displayTitle;
  }).filter(Boolean);
  const saveText = formatCardBulkText(sectionTitle, itemLines);
  const copyText = formatSectionCopyText(sectionTitle, itemLines);

  return (
    <article className="pt-2">
      <div className="flex items-start justify-between gap-2 mb-3" dir="rtl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50 leading-snug text-right flex-1 min-w-0">
          {sectionTitle}
        </h2>
        {bulkSelection && saveText ? (
          <UniversalTabSectionHeaderActions
            text={saveText}
            copyText={copyText}
            bulkSelection={mergeBulkSelection(bulkSelection, {
              sectionLabel: section.labelHe,
              type: 'app-ideas-brain',
              tabScope: 'app-builder',
            })}
            sectionLabel={section.labelHe}
            type="app-ideas-brain"
            tabScope="app-builder"
          />
        ) : null}
      </div>
      <div className="mt-3">
        {items.map((item) => (
          <BrainListEntry
            key={item.id}
            item={item}
            isSelected={isSelected(item.id)}
            onToggle={() => onToggle(item.id)}
            bulkSelection={bulkSelection}
          />
        ))}
      </div>
    </article>
  );
}

/**
 * מוח רעיונות לאפליקציות — מסמך ידע רציף מחולץ מפלט AI קיים.
 */
export function AppIdeasBrainPanel({ video, marketBriefData = null, topicName = '', bulkSelection = null }) {
  const extracted = useMemo(
    () => extractAppIdeas(video, marketBriefData),
    [video, marketBriefData],
  );

  const allItems = useMemo(() => flattenAppIdeasBrain(extracted), [extracted]);
  const totalCount = countAppIdeasBrain(extracted);

  const bulkItems = useMemo(() => allItems.map((item) => {
    const { displayTitle } = formatBrainItemForDisplay(item);
    return {
      id: `app-ideas-brain:${item.id}`,
      text: displayTitle || item.title || item.content || '',
      sectionLabel: 'מוח רעיונות לאפליקציות',
      type: 'app-ideas-brain',
      tabScope: 'app-builder',
      rawItem: item,
    };
  }), [allItems]);

  const isSelected = useCallback((itemId) => {
    if (!bulkSelection?.multiSelected) return false;
    return bulkSelection.multiSelected.has(`app-ideas-brain:${itemId}`);
  }, [bulkSelection?.multiSelected]);

  const toggle = useCallback((itemId) => {
    if (!bulkSelection?.onToggle) return;
    const entry = bulkItems.find((b) => b.id === `app-ideas-brain:${itemId}`);
    if (!entry) return;
    bulkSelection.onToggle(entry.id, entry);
  }, [bulkItems, bulkSelection]);

  const count = bulkItems.filter((b) => isSelected(b.id.replace('app-ideas-brain:', ''))).length;

  if (totalCount === 0) {
    return (
      <section
        dir="rtl"
        className="border-b border-dashed border-slate-200 dark:border-zinc-700 pb-6 mb-2"
        data-app-ideas-brain
      >
        <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">מוח רעיונות לאפליקציות</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
          אין עדיין בלוקי מוצר לחילוץ מסרטון זה. הדבק ניתוח GEM או טען נתוני ניתוח קיימים.
        </p>
      </section>
    );
  }

  const visibleSections = APP_IDEAS_BRAIN_SECTIONS.filter(
    (section) => (extracted[section.key] || []).length > 0,
  );

  return (
    <section
      dir="rtl"
      className={`${count > 0 ? 'pb-20' : 'pb-4'}`}
      data-app-ideas-brain
    >
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-zinc-800/80 py-3 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-right">
            <h1 className="text-lg font-bold text-slate-900 dark:text-zinc-50">מוח רעיונות לאפליקציות</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
              {formatBrainTotalCount(totalCount)}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-10 px-0.5">
        {visibleSections.map((section, idx) => (
          <div key={section.key}>
            {idx > 0 && <hr className="border-slate-200 dark:border-zinc-800 mb-10" />}
            <BrainDocumentSection
              section={section}
              items={(extracted[section.key] || []).map((item) => ({
                ...item,
                sectionKey: section.key,
              }))}
              isSelected={isSelected}
              onToggle={toggle}
              bulkSelection={bulkSelection}
            />
          </div>
        ))}
      </div>

    </section>
  );
}
