#!/usr/bin/env node
import assert from 'node:assert/strict';
import { groupWorkspaceItemsByVideo } from '../src/utils/workspaceVideoGrouping.js';
import { selectSavedAnalysisSections, selectSavedAnalysisViewer } from '../src/utils/workspaceSavedAnalysis.js';

const snapshot = (ticker = 'AAA') => ({ videoId: 'KOom2PCpl6Q', savedAt: '2026-08-10T08:00:00Z', stocksTable: [{ ticker, company: 'Persisted' }], marketsTable: [], sentimentTable: [{ label: 'מצב', value: 'זהיר' }] });
const items = [
  { id: 'summary-parent', videoId: 'KOom2PCpl6Q', itemType: 'snippet', sourceTab: 'summary', videoTitle: 'סיכום ב-30 שניות — Source video', notes: '🚀 סיכום ב-30 שניות\nשורה ראשונה\nשורה משותפת', savedAt: '2026-08-10' },
  { id: 'summary-child', videoId: 'KOom2PCpl6Q', itemType: 'snippet', sourceTab: 'summary', videoTitle: 'סיכום ב-30 שניות — Source video', notes: 'שורה משותפת', savedAt: '2026-08-09' },
  { id: 'insight', videoId: 'KOom2PCpl6Q', itemType: 'insight', sourceTab: 'insights', videoTitle: 'תובנות — Source video', identityPayload: { lesson: 'להמתין לאישור', whyImportant: 'מפחית סיכון' }, savedAt: '2026-08-08' },
  { id: 'knowledge', videoId: 'KOom2PCpl6Q', itemType: 'checklist', sourceTab: 'useful-knowledge', videoTitle: 'צ׳קליסט פעולה — Source video', notes: 'בדוק נזילות', savedAt: '2026-08-07' },
  { id: 'market-state', videoId: 'KOom2PCpl6Q', itemType: 'snippet', sourceTab: 'summary', videoTitle: 'מצב השוק — Source video', notes: 'label: מצב כללי | value: חיובי מתוח | sentiment: bullish | reason: תנודתיות גבוהה', savedAt: '2026-08-07' },
  // REGRESSION (found in live browser QA, 2026-08-31): a real single-line
  // news save whose own body text merely mentions the word "חדשות" was
  // being silently dropped entirely — cleanHeading()'s substring check
  // (`key.includes('חדשות')`), reused to detect a content line that is just
  // a stray echo of the section heading, doesn't distinguish "the line IS
  // basically just the heading" from "the line is a real sentence that
  // happens to mention that word once". Section ended up with provenance
  // but zero entries (header showed a record count, body rendered nothing).
  { id: 'news-mentions-heading-word', videoId: 'KOom2PCpl6Q', itemType: 'snippet', sourceTab: 'market-news', sourceHeading: '📰 חדשות', originalItemType: 'market-news', notes: 'עדכון חדשות: הפד הותיר את הריבית ללא שינוי בהחלטתו האחרונה', savedAt: '2026-08-11' },
  ...[1, 2, 3, 4].map(index => ({ id: `snapshot-${index}`, videoId: 'KOom2PCpl6Q', itemType: 'structured-snapshot', sourceTab: 'Specialized', structuredSnapshot: snapshot(), savedAt: `2026-08-0${index}` })),
  { id: 'snapshot-history', videoId: 'KOom2PCpl6Q', itemType: 'structured-snapshot', sourceTab: 'Specialized', structuredSnapshot: snapshot('BBB'), savedAt: '2026-07-31' },
];
const originalJson = JSON.stringify(items);
const grouped = groupWorkspaceItemsByVideo(items);
const group = grouped.videoGroups[0];
group.marketBriefData = { summary: 'UNSAVED_SOURCE_ANALYSIS_POISON', chapters: [{ title: 'UNSAVED_CHAPTER' }] };
const viewer = selectSavedAnalysisViewer(group);
const allCollections = selectSavedAnalysisSections(viewer);
const snapshotCollection = selectSavedAnalysisSections(viewer, 'specialized');

assert.equal(viewer.byTab.summary.length, 2, 'persisted Summary records group under Summary');
const savedSummary = viewer.byTab.summary.find(section => section.heading === 'סיכום ב־30 שניות');
assert.deepEqual(savedSummary.entries.map(entry => entry.text), ['שורה ראשונה', 'שורה משותפת'], 'parent/child duplicate and repeated section heading render once');
assert.deepEqual(savedSummary.provenance.map(entry => entry.recordId).sort(), ['summary-child', 'summary-parent']);
const savedMarketState = viewer.byTab.summary.find(section => section.heading === 'מצב השוק');
assert.deepEqual(savedMarketState.fields.map(field => field.label), ['מדד', 'ערך', 'סנטימנט', 'הסבר'], 'pipe-separated structured content becomes labelled fields');
assert.doesNotMatch(JSON.stringify(savedMarketState.entries), /label:|sentiment:/, 'raw pipe strings are not rendered');
assert.equal(viewer.byTab.insights[0].fields.find(field => field.label === 'לקח')?.value, 'להמתין לאישור');
assert.equal(viewer.byTab.insights[0].fields.find(field => field.label === 'למה זה חשוב')?.value, 'מפחית סיכון');
assert.equal(viewer.byTab.knowledge[0].heading, 'צ׳קליסט פעולה');
assert.equal(viewer.byTab.chapters.length, 0, 'unsaved Chapters remain absent');
assert.equal(viewer.byTab.apps.length, 0, 'unsaved APP remains absent');
assert.equal(viewer.byTab.specialized.length, 2, 'different persisted Snapshot hashes remain versions inside Targeted Content');
assert.equal(viewer.byTab.specialized.find(section => section.copyCount === 4)?.snapshot.stocksTable[0].ticker, 'AAA', 'Snapshot uses its persisted payload');
assert.equal(viewer.byTab.specialized.find(section => section.copyCount === 4)?.provenance.length, 4, 'four identical Snapshot records render once with provenance');
assert.equal(allCollections.collectionId, 'all', 'no active collection means all saved collections');
assert.equal(allCollections.sections.length, Object.values(viewer.byTab).flat().length, 'all collections renders every persisted section once');
assert.deepEqual(snapshotCollection.sections, viewer.byTab.specialized, 'Targeted Content renders its matching persisted Snapshot subsections');
assert.doesNotMatch(JSON.stringify(viewer), /UNSAVED_SOURCE_ANALYSIS_POISON|UNSAVED_CHAPTER/, 'source analysis is never read or rendered');
const persistedIds = new Set(items.map(item => item.id));
for (const section of Object.values(viewer.byTab).flat()) {
  assert.ok(section.provenance.length > 0, `rendered block ${section.id} has persisted provenance`);
  assert.ok(section.provenance.every(entry => persistedIds.has(entry.recordId)), `rendered block ${section.id} maps only to persisted records`);
}
assert.deepEqual(new Set(viewer.renderedRecordIds), persistedIds, 'every persisted child ID remains reachable');

const savedNewsHeadingCollision = Object.values(viewer.byTab).flat()
  .find(section => section.provenance.some(entry => entry.recordId === 'news-mentions-heading-word'));
assert.ok(savedNewsHeadingCollision, 'the news-mentioning-"חדשות" item is still classified into a section');
assert.equal(savedNewsHeadingCollision.entries.length, 1, 'REGRESSION: a real news sentence that merely mentions the heading word "חדשות" is kept as a real entry, not dropped as a heading echo');
assert.equal(savedNewsHeadingCollision.entries[0]?.text, 'עדכון חדשות: הפד הותיר את הריבית ללא שינוי בהחלטתו האחרונה');
assert.equal(JSON.stringify(items), originalJson, 'viewer selector does not mutate persistence input');
assert.equal(viewer.emptyMessage, 'לא נשמר תוכן מסוג זה');

console.log('Workspace saved-analysis provenance QA: 33 assertions passed');
