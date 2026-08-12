import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPersistedYouTubeTimestampUrl,
  buildSafeFinvizTickerUrl,
  normalizeAnalysisTicker,
} from '../src/utils/analysisTickerLinks.js';
import { WORKSPACE_COLLECTION_HEADINGS } from '../src/config/workspaceHeadingRegistry.js';
import { selectSavedAnalysisViewer } from '../src/utils/workspaceSavedAnalysis.js';

let assertions = 0;
function check(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
}

check(normalizeAnalysisTicker(' nvda '), 'NVDA', 'ticker normalization is bounded and uppercase');
check(buildSafeFinvizTickerUrl('NVDA'), 'https://finviz.com/quote.ashx?t=NVDA', 'valid stock ticker gets an encoded Finviz URL');
check(buildSafeFinvizTickerUrl('free text'), null, 'arbitrary free text cannot create an external link');
check(buildSafeFinvizTickerUrl('VIX'), null, 'unsupported market assets do not create broken Finviz links');
check(buildSafeFinvizTickerUrl('TA35'), null, 'unsupported Israeli indices do not create broken Finviz links');
check(buildSafeFinvizTickerUrl('NVDA<script>'), null, 'unsafe ticker characters are rejected');
check(buildPersistedYouTubeTimestampUrl('https://www.youtube.com/watch?v=KOom2PCpl6Q', 42), 'https://www.youtube.com/watch?v=KOom2PCpl6Q&t=42', 'persisted timestamp creates a safe source URL');
check(buildPersistedYouTubeTimestampUrl('https://example.com/watch?v=KOom2PCpl6Q', 42), null, 'non-YouTube timestamp destinations are rejected');
check(buildPersistedYouTubeTimestampUrl('https://youtu.be/KOom2PCpl6Q', null), null, 'missing timestamps are never fabricated');

const items = [
  {
    id: 'persisted-1', sourceVideoId: 'video-1', sourceTabId: 'insights', sourceSectionId: 'key-insights',
    sourceHeading: '💡 תובנות מובילות', itemType: 'insight', savedAt: '2026-08-10T10:00:00Z',
    identityPayload: { text: 'NVDA נשמר במפורש', rank: 2 },
  },
  {
    id: 'persisted-2', sourceVideoId: 'video-1', sourceTabId: 'insights', sourceSectionId: 'key-insights',
    sourceHeading: '💡 תובנות מובילות', itemType: 'insight', savedAt: '2026-08-10T10:01:00Z',
    identityPayload: { text: 'NVDA נשמר במפורש', rank: 2 },
  },
  {
    id: 'persisted-fields', sourceVideoId: 'video-1', sourceTabId: 'app', sourceSectionId: 'app-opportunity',
    sourceHeading: '🚀 APP', itemType: 'app', savedAt: '2026-08-10T10:02:00Z',
    appPayload: { description: 'תיאור שמור', valueProposition: 'ערך שמור' },
  },
];
const viewer = selectSavedAnalysisViewer({ items, versions: [] });
const insightSection = viewer.byTab.insights[0];
check(insightSection.heading, 'תובנות מובילות', 'original persisted section heading is preserved');
check(insightSection.icon, '💡', 'persisted section icon is preserved');
check(insightSection.entries.length, 1, 'exact duplicate text renders once logically');
check(insightSection.entries[0].rank, 2, 'persisted ranking remains attached to the rendered row');
check(insightSection.provenance.map(entry => entry.recordId), ['persisted-1', 'persisted-2'], 'underlying duplicate records remain reachable');
check(JSON.stringify(viewer).includes('unsaved-live-analysis'), false, 'unsaved source-analysis content is never introduced');
check(viewer.byTab.apps[0].fields.map(field => field.label), ['הצעת ערך'], 'structured APP payload renders labelled fields instead of raw JSON');
check(viewer.persistedRecordIds, items.map(item => item.id), 'the viewer leaves the persisted record set unchanged');

const expectedCollections = [
  ['summary', 'סיכום', '📝'], ['chapters', 'פרקים', '📚'], ['insights', 'תובנות', '💡'],
  ['knowledge', 'ידע שימושי', '🧠'], ['apps', 'APP', '🚀'], ['topics', 'נושאים ותתי־נושאים', '🏷️'],
  ['specialized', 'תוכן ייעודי', '🎯'],
];
check(WORKSPACE_COLLECTION_HEADINGS.map(({ id, label, emoji }) => [id, label, emoji]), expectedCollections, 'the seven primary labels and icons remain the shared source of truth');

const primitivesSource = readFileSync(new URL('../src/components/shared/AnalysisContentPrimitives.jsx', import.meta.url), 'utf8');
const tickerSource = readFileSync(new URL('../src/components/shared/AnalysisTickerLink.jsx', import.meta.url), 'utf8');
const linkedSource = readFileSync(new URL('../src/components/shared/LinkedMarketText.jsx', import.meta.url), 'utf8');
const focusedSource = readFileSync(new URL('../src/components/workspace/WorkspaceFocusedVideoCard.jsx', import.meta.url), 'utf8');
const snapshotSource = readFileSync(new URL('../src/components/workspace/StructuredSnapshotView.jsx', import.meta.url), 'utf8');
const librarySource = readFileSync(new URL('../src/pages/WorkspaceLibrary.jsx', import.meta.url), 'utf8');
check(primitivesSource.includes('SUMMARY_CARD_CLASS') && primitivesSource.includes('SectionHeaderTitle'), true, 'Analysis and Workspace share card and heading presentation tokens');
check(primitivesSource.includes('DASHBOARD_TABLE_CELL_BODY_CLS'), true, 'Analysis and Workspace share body typography');
check(tickerSource.includes('rel="noopener noreferrer"'), true, 'external ticker links use safe window features');
check(tickerSource.includes('aria-label={`פתח את ${normalized} ב־Finviz`}'), true, 'ticker links expose a Hebrew accessible name');
check(tickerSource.includes('focus-visible:ring-2'), true, 'ticker links expose visible keyboard focus');
check(tickerSource.includes('event.stopPropagation()'), true, 'ticker activation is independent from checkbox selection');
check(linkedSource.includes('<AnalysisTickerLink'), true, 'live Analysis text and Workspace text reuse the same ticker component');
check(focusedSource.includes('<AnalysisSectionCard') && focusedSource.includes('<AnalysisList'), true, 'focused Workspace uses the shared Analysis presentation layer');
check(focusedSource.includes('WorkspaceGlobalSavedAnalysisGroup'), true, 'global collections use the same saved-analysis sections with source attribution');
check(librarySource.includes('<WorkspaceGlobalSavedAnalysisGroup'), true, 'global collection routing renders the shared section component');
check(snapshotSource.includes('<AnalysisTickerLink ticker={r.ticker}>'), true, 'Snapshot stock cells use the same safe ticker action');
check(snapshotSource.includes('changePercent'), false, 'Snapshot Markets does not invent a percentage field');
check(focusedSource.includes('section.provenance.find(entry => entry.sourceTimestamp != null)'), true, 'source navigation depends only on persisted timestamp provenance');
check(focusedSource.includes('פרטים טכניים'), true, 'technical IDs remain behind an optional disclosure');
check(focusedSource.includes('StructuredSnapshotContent snapshot={section.snapshot}'), true, 'Targeted Content reuses the persisted-only Snapshot renderer');

console.log(`Workspace Analysis parity QA: ${assertions} assertions passed`);
