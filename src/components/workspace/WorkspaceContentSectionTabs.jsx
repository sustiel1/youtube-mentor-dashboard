import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, Flag, Star, Sun, GraduationCap, Trophy, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  VIDEO_ANALYSIS_HEADINGS,
  WORKSPACE_FALLBACK_COLLECTION,
  getWorkspaceHeadingByCollection,
  getWorkspaceNavigationCollectionForItem,
} from '@/config/workspaceHeadingRegistry';

// Section headings are free-form Hebrew text (not the fixed 7-collection
// registry), so icons are matched by keyword with a neutral fallback for
// anything unrecognized.
const SECTION_ICON_KEYWORDS = [
  { keywords: ['מסקנ'], Icon: Flag },
  { keywords: ['מרכזי'], Icon: Star },
  { keywords: ['לימוד'], Icon: Sun },
  { keywords: ['לקח', 'שוק'], Icon: GraduationCap },
  { keywords: ['מסחר'], Icon: Trophy },
];

function getSectionIcon(label) {
  const text = String(label || '');
  for (const { keywords, Icon } of SECTION_ICON_KEYWORDS) {
    if (keywords.some(keyword => text.includes(keyword))) return Icon;
  }
  return Layers;
}

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

  const activeIndex = useMemo(() => {
    if (!tabs) return 0;
    const index = tabs.findIndex(tab => tab.value === activeValue);
    return index >= 0 ? index : 0;
  }, [tabs, activeValue]);
  const [focusedIndex, setFocusedIndex] = useState(activeIndex);
  useEffect(() => { setFocusedIndex(activeIndex); }, [activeIndex]);

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
    <nav aria-label="סעיפי תוכן" data-workspace-content-section-tabs="true" dir="rtl">
      <div
        role="tablist"
        aria-label="סעיפי תוכן"
        aria-orientation="horizontal"
        dir="rtl"
        className="flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-100/60 p-1.5 dark:border-zinc-700/60 dark:bg-zinc-800/50"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => {
          const isActive = activeValue === tab.value;
          const Icon = index === 0 ? LayoutGrid : getSectionIcon(tab.label);
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
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 focus-visible:rounded-full',
                isActive
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', isActive ? 'text-white' : 'text-slate-400 dark:text-zinc-500')} aria-hidden="true" />
              <span className="inline-block max-w-[9rem] truncate align-middle">{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none',
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
