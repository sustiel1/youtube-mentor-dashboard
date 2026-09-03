import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  VIDEO_ANALYSIS_HEADINGS,
  WORKSPACE_FALLBACK_COLLECTION,
  getWorkspaceHeadingByCollection,
  getWorkspaceNavigationCollectionForItem,
} from '@/config/workspaceHeadingRegistry';

// Canonical heading order, keyed by workspaceCollection — mirrors the order
// headings actually appear in a video analysis. Sections whose dominant
// collection isn't in the registry (e.g. the "ללא סעיף" fallback) sort last.
const REGISTRY_ORDER = new Map(
  VIDEO_ANALYSIS_HEADINGS.map((definition, index) => [definition.workspaceCollection, index]),
);

function dominantCollectionId(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const counts = new Map();
  for (const item of items) {
    const id = getWorkspaceNavigationCollectionForItem(item);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  let bestId = null;
  let bestCount = -1;
  for (const [id, count] of counts) {
    if (count > bestCount) { bestId = id; bestCount = count; }
  }
  return bestId;
}

function collectionOrderIndex(items) {
  const id = dominantCollectionId(items);
  return REGISTRY_ORDER.has(id) ? REGISTRY_ORDER.get(id) : REGISTRY_ORDER.size;
}

function collectionContextLabel(items) {
  const id = dominantCollectionId(items);
  if (!id) return '';
  if (id === WORKSPACE_FALLBACK_COLLECTION.id) return WORKSPACE_FALLBACK_COLLECTION.label;
  return getWorkspaceHeadingByCollection(id)?.label || '';
}

// Presentation-only: two distinct section ids can legitimately share the
// same heading text (e.g. an explicit "מסקנות" heading saved from two
// different source sections). Merging them would mean changing the
// grouping key itself, which is out of scope here — so duplicates are
// disambiguated for display only, first by the section's dominant
// workspace-collection context, then (if that still collides) by a plain
// ordinal, without altering tab.value or the underlying section ids.
function buildDisplayTabs(navigation) {
  const [allTab, ...rawSectionTabs] = navigation.tabs;
  const sectionById = new Map(navigation.sections.map(section => [section.id, section]));

  const ordered = [...rawSectionTabs].sort((a, b) => (
    collectionOrderIndex(sectionById.get(a.value)?.items) - collectionOrderIndex(sectionById.get(b.value)?.items)
  ));

  const labelCounts = new Map();
  for (const tab of ordered) labelCounts.set(tab.label, (labelCounts.get(tab.label) || 0) + 1);

  const withContext = ordered.map(tab => {
    if (labelCounts.get(tab.label) <= 1) return tab;
    const context = collectionContextLabel(sectionById.get(tab.value)?.items);
    return context && context !== tab.label ? { ...tab, label: `${tab.label} · ${context}` } : tab;
  });

  const finalCounts = new Map();
  for (const tab of withContext) finalCounts.set(tab.label, (finalCounts.get(tab.label) || 0) + 1);
  const ordinalSeen = new Map();
  const finalSectionTabs = withContext.map(tab => {
    if (finalCounts.get(tab.label) <= 1) return tab;
    const ordinal = (ordinalSeen.get(tab.label) || 0) + 1;
    ordinalSeen.set(tab.label, ordinal);
    return { ...tab, label: `${tab.label} ${ordinal}` };
  });

  return [allTab, ...finalSectionTabs];
}

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

export function WorkspaceContentSectionTabs({ navigation, activeValue, onSelect }) {
  const tabs = useMemo(() => (navigation?.showTabs ? buildDisplayTabs(navigation) : null), [navigation]);
  const tabRefs = useRef([]);
  const scrollRef = useRef(null);
  const [edgeFade, setEdgeFade] = useState({ start: false, end: false });

  const activeIndex = useMemo(() => {
    if (!tabs) return 0;
    const index = tabs.findIndex(tab => tab.value === activeValue);
    return index >= 0 ? index : 0;
  }, [tabs, activeValue]);
  const [focusedIndex, setFocusedIndex] = useState(activeIndex);
  useEffect(() => { setFocusedIndex(activeIndex); }, [activeIndex]);

  const updateEdgeFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const distanceFromStart = Math.abs(el.scrollLeft);
    setEdgeFade({
      start: distanceFromStart > 4,
      end: distanceFromStart < maxScroll - 4,
    });
  }, []);

  useEffect(() => {
    updateEdgeFade();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateEdgeFade);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tabs, updateEdgeFade]);

  const moveFocus = useCallback((index) => {
    if (!tabs) return;
    const clamped = (index + tabs.length) % tabs.length;
    setFocusedIndex(clamped);
    tabRefs.current[clamped]?.focus();
    onSelect(tabs[clamped].value);
  }, [tabs, onSelect]);

  const handleKeyDown = useCallback((event) => {
    if (!NAV_KEYS.has(event.key) || !tabs) return;
    event.preventDefault();
    if (event.key === 'Home') { moveFocus(0); return; }
    if (event.key === 'End') { moveFocus(tabs.length - 1); return; }
    // RTL: ArrowRight moves toward the visually-right (earlier/previous) tab,
    // ArrowLeft moves toward the visually-left (later/next) tab.
    moveFocus(focusedIndex + (event.key === 'ArrowLeft' ? 1 : -1));
  }, [tabs, focusedIndex, moveFocus]);

  if (!tabs) return null;

  return (
    <nav aria-label="סעיפי תוכן" data-workspace-content-section-tabs="true" dir="rtl" className="border-b border-slate-200 dark:border-zinc-800">
      <div className="relative">
        {edgeFade.start && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white dark:from-zinc-950 to-transparent" />
        )}
        {edgeFade.end && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white dark:from-zinc-950 to-transparent" />
        )}
        <div
          ref={scrollRef}
          role="tablist"
          aria-label="סעיפי תוכן"
          aria-orientation="horizontal"
          dir="rtl"
          className="flex flex-nowrap items-center gap-5 overflow-x-auto overscroll-x-contain"
          onScroll={updateEdgeFade}
          onKeyDown={handleKeyDown}
        >
          {tabs.map((tab, index) => {
            const isActive = activeValue === tab.value;
            return (
              <button
                key={tab.value}
                ref={el => { tabRefs.current[index] = el; }}
                type="button"
                role="tab"
                id={`workspace-content-section-tab-${tab.value || 'all'}`}
                aria-selected={isActive}
                tabIndex={focusedIndex === index ? 0 : -1}
                title={tab.label}
                onClick={() => moveFocus(index)}
                className={cn(
                  'shrink-0 whitespace-nowrap border-b-2 -mb-px py-2 text-sm font-normal transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-1 focus-visible:rounded-sm',
                  isActive
                    ? 'border-violet-600 text-slate-900 dark:border-violet-400 dark:text-zinc-100'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                )}
              >
                <span className="inline-block max-w-[9rem] truncate align-middle">{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="ms-1.5 align-middle text-xs font-normal text-slate-400 dark:text-zinc-500">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
