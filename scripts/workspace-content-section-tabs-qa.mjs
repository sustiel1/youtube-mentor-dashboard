#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WORKSPACE_CONTENT_SECTION_FALLBACK_ID,
  filterWorkspaceItemsByContentSection,
  getWorkspaceContentSectionId,
  resolveWorkspaceContentSectionSelection,
  selectWorkspaceContentSectionPresentation,
  selectWorkspaceContentSectionTabs,
  selectWorkspaceVideoGroups,
} from '../src/utils/workspaceVideoGrouping.js';

let assertions = 0;
const equal = (...args) => { assertions += 1; assert.equal(...args); };
const deepEqual = (...args) => { assertions += 1; assert.deepEqual(...args); };
const ok = (...args) => { assertions += 1; assert.ok(...args); };

let storageWrites = 0;
globalThis.localStorage = { setItem() { storageWrites += 1; } };
globalThis.indexedDB = { open() { storageWrites += 1; throw new Error('selector attempted IndexedDB access'); } };

const base = { topicId: 'markets', subTopicId: 'daily', itemType: 'insight', sourceTab: 'insights' };
const records = [
  { ...base, id: 'macro', sourceVideoId: 'video-a', sourceSectionId: 'macro', sourceHeading: 'מאקרו', identityPayload: { text: 'rates' } },
  { ...base, id: 'macro-copy', sourceVideoId: 'video-a', sourceSectionId: 'macro', sourceHeading: 'מאקרו', identityPayload: { text: 'rates' } },
  { ...base, id: 'opportunity', sourceVideoId: null, videoUrl: 'https://youtu.be/abcdefghijk', sourceSectionId: 'opportunities', sourceHeading: 'הזדמנויות', identityPayload: { text: 'growth' } },
  { ...base, id: 'risk', sourceVideoId: 'video-a', sourceSectionId: 'risks', sourceHeading: 'סיכונים', identityPayload: { text: 'drawdown' } },
  { ...base, id: 'legacy', sourceVideoId: 'video-a', notes: 'legacy record' },
  { ...base, id: 'without-video', sourceVideoId: null, sourceSectionId: null, identityPayload: { text: 'orphan' } },
  { ...base, id: 'whole', sourceVideoId: 'video-a', itemType: 'whole-video', sourceSectionId: 'whole-video', sourceHeading: 'סרטון מלא', identityPayload: { text: 'whole' } },
  { ...base, id: 'snapshot', sourceVideoId: null, videoId: 'video-a', itemType: 'structured-snapshot', sourceSectionId: 'structured-snapshot', sourceHeading: 'תמונת מצב', structuredSnapshot: { videoId: 'video-a', stocks: [], markets: [], sentiment: [] } },
  { ...base, id: 'app', sourceVideoId: null, itemType: 'app', sourceTab: 'app-builder', sourceSectionId: 'apps', sourceHeading: 'APP', appPayload: { name: 'tool' }, identityPayload: { name: 'tool' } },
];
const before = structuredClone(records);
const scoped = selectWorkspaceVideoGroups({
  items: records,
  topicId: 'markets',
  subtopicId: 'daily',
  collectionId: 'insights',
});
const navigation = selectWorkspaceContentSectionTabs(scoped.items, { collectionId: 'insights' });

equal(navigation.showTabs, true, 'two or more meaningful groups show the row');
equal(navigation.tabs[0].label, 'הכול', 'all is always first');
equal(navigation.tabs[0].count, 6, 'all uses logical identity and preserves legacy fallbacks');
deepEqual(navigation.tabs.slice(1).map(tab => tab.label), ['מאקרו', 'הזדמנויות', 'סיכונים', 'ללא סעיף', 'סרטון מלא']);
// Grouping key is now sourceHeading-first: tab.value equals the heading text itself, not the old sourceSectionId slug.
equal(navigation.tabs.find(tab => tab.value === 'מאקרו').count, 1, 'logical duplicates count once');
equal(navigation.tabs.find(tab => tab.value === WORKSPACE_CONTENT_SECTION_FALLBACK_ID).count, 2, 'missing and legacy records share the fallback tab');
deepEqual(filterWorkspaceItemsByContentSection(scoped.items, 'מאקרו').map(item => item.id), ['macro', 'macro-copy']);
deepEqual(filterWorkspaceItemsByContentSection(scoped.items, WORKSPACE_CONTENT_SECTION_FALLBACK_ID).map(item => item.id).sort(), ['legacy', 'without-video']);
equal(getWorkspaceContentSectionId({ sourceSectionId: 'unsectioned' }), WORKSPACE_CONTENT_SECTION_FALLBACK_ID);
equal(getWorkspaceContentSectionId({ contentRouting: { sourceSectionId: 'nested' } }), 'nested');
equal(getWorkspaceContentSectionId({ sourceHeading: 'מסקנות', sourceSectionId: 'brief-conclusions' }), 'מסקנות', 'sourceHeading wins over sourceSectionId when both are present');
equal(getWorkspaceContentSectionId({ sourceHeading: '  מסקנות  ', sourceSectionId: 'other-slug' }), 'מסקנות', 'heading is trimmed');
equal(getWorkspaceContentSectionId({ sourceHeading: 'מסקנות   AI', sourceSectionId: 'other-slug' }), 'מסקנות AI', 'internal whitespace runs collapse');
equal(
  getWorkspaceContentSectionId({ sourceHeading: 'מסקנות', sourceSectionId: 'brief-conclusions' }),
  getWorkspaceContentSectionId({ sourceHeading: ' מסקנות', sourceSectionId: 'learning-conclusions' }),
  'two distinct sourceSectionIds that share the same normalised heading text merge into one group',
);
equal(getWorkspaceContentSectionId({ sourceHeading: '   ', sourceSectionId: 'risks' }), 'risks', 'whitespace-only heading is treated as absent, falls through to sourceSectionId');
equal(selectWorkspaceContentSectionPresentation(scoped, 'מאקרו').allUniqueContentCount, scoped.allUniqueContentCount, 'parent scope metadata remains intact');
deepEqual(selectWorkspaceContentSectionPresentation(scoped, 'מאקרו').items.map(item => item.id), ['macro', 'macro-copy']);
equal(selectWorkspaceContentSectionPresentation(scoped, WORKSPACE_CONTENT_SECTION_FALLBACK_ID).withoutVideo.some(item => item.id === 'without-video'), true);

const allCollections = selectWorkspaceVideoGroups({ items: records, topicId: 'markets', subtopicId: 'daily', collectionId: 'all' });
deepEqual(new Set(allCollections.items.map(item => item.id)), new Set(records.map(item => item.id)), 'whole-video, snapshot, app, null-video-id and withoutVideo records stay reachable');
equal(resolveWorkspaceContentSectionSelection('מאקרו', navigation), 'מאקרו');
equal(resolveWorkspaceContentSectionSelection('removed', navigation), '', 'removed section resets safely');
equal(resolveWorkspaceContentSectionSelection('מאקרו', selectWorkspaceContentSectionTabs([records[0]], { collectionId: 'insights' })), '', 'single-section collection hides tabs and resets');
equal(resolveWorkspaceContentSectionSelection('מאקרו', selectWorkspaceContentSectionTabs(records, { collectionId: 'apps' })), 'מאקרו', 'selection resolver is driven only by the supplied canonical scope');

const afterAdd = selectWorkspaceContentSectionTabs([...scoped.items, { ...base, id: 'new-risk', sourceVideoId: 'video-b', sourceSectionId: 'risks', sourceHeading: 'סיכונים', identityPayload: { text: 'new risk' } }], { collectionId: 'insights' });
equal(afterAdd.tabs.find(tab => tab.value === 'סיכונים').count, 2, 'counts update after adding a logical row');
const afterRemove = selectWorkspaceContentSectionTabs(scoped.items.filter(item => item.sourceSectionId !== 'risks'), { collectionId: 'insights' });
equal(afterRemove.sections.some(section => section.id === 'סיכונים'), false, 'tabs update after rows are removed');
deepEqual(records, before, 'selectors do not mutate saved records');
equal(storageWrites, 0, 'tab derivation and switching perform no storage writes');

const pageSource = readFileSync(new URL('../src/pages/WorkspaceLibrary.jsx', import.meta.url), 'utf8');
const componentSource = readFileSync(new URL('../src/components/workspace/WorkspaceContentSectionTabs.jsx', import.meta.url), 'utf8');
const sharedTabSource = readFileSync(new URL('../src/components/workspace/WorkspaceTabRow.jsx', import.meta.url), 'utf8');
ok(pageSource.includes('setActiveContentSectionId'), 'page owns temporary React state');
ok(!pageSource.includes('workspace_content_section'), 'content-section state has no persistence key');
ok(sharedTabSource.includes('aria-pressed={activeValue === tab.value}'), 'the unrelated shared pill row keeps its own accessible active-state pattern');
// Pill-capsule redesign (TRADINGBRAIN-WORKSPACE-SECTIONTABS-PILL-REDESIGN):
// the row now wraps onto additional lines at narrow widths instead of
// scrolling horizontally, so the old "never wraps" pin is inverted here.
ok(componentSource.includes('dir="rtl"') && componentSource.includes('flex-wrap'), 'row is RTL and wraps instead of overflowing at narrow widths');

// Underline-tab redesign: proper ARIA tab roles with roving tabindex,
// replacing the pill row's aria-pressed usage which doesn't fit tab semantics.
ok(!componentSource.includes('aria-pressed'), 'content-section tabs no longer use aria-pressed (replaced by role="tab" + aria-selected)');
ok(componentSource.includes('role="tablist"'), 'container exposes role="tablist"');
ok(componentSource.includes("role=\"tab\""), 'each item exposes role="tab"');
ok(componentSource.includes('aria-selected={isActive}'), 'active tab is exposed via aria-selected');
ok(componentSource.includes('tabIndex={focusedIndex === index ? 0 : -1}'), 'roving tabindex: exactly one tab is in the tab order at a time');
ok(componentSource.includes("'Home'") && componentSource.includes("'End'") && componentSource.includes('ArrowLeft') && componentSource.includes('ArrowRight'), 'arrow keys plus Home/End are handled for keyboard navigation');
ok(componentSource.includes('focus-visible:ring'), 'a visible focus ring is applied');
ok(componentSource.includes('title={tab.label}'), 'full label is exposed via the title attribute for truncated tabs');
ok(componentSource.includes('max-w-[9rem] truncate'), 'long labels truncate instead of wrapping');

// Canonical ordering + duplicate-label disambiguation are presentation-only:
// they must not touch the grouping key, so verify the component reads the
// registry for order/context rather than reshaping selectWorkspaceContentSectionTabs.
ok(componentSource.includes('VIDEO_ANALYSIS_HEADINGS') && componentSource.includes('REGISTRY_ORDER'), 'tabs are ordered using the canonical heading registry order');
ok(componentSource.includes('buildDisplayTabs') && componentSource.includes('collectionContextLabel'), 'duplicate labels are disambiguated using source-collection context, not invented names');
ok(componentSource.includes('[allTab, ...finalSectionTabs]'), 'the "הכול" tab is always prepended first, unaffected by ordering/disambiguation');

const groupingSource = readFileSync(new URL('../src/utils/workspaceVideoGrouping.js', import.meta.url), 'utf8');
ok(!groupingSource.includes('collectionContextLabel') && !groupingSource.includes('buildDisplayTabs'), 'grouping-key derivation is untouched by the tab-row redesign');

console.log(`workspace-content-section-tabs-qa: ${assertions} assertions passed`);
