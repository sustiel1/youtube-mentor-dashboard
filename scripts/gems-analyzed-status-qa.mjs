import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  completeGemsAnalysisProvenance,
  countAnalyzedVideos,
  createPendingGemsAnalysisProvenance,
  filterAnalyzedVideos,
  hasLegacyAnalysisTabContent,
  isVideoAnalyzed,
  resolveVideoAnalyzedState,
} from '../src/lib/gemsAnalyzedStatus.js';

const importedAt = '2026-08-25T08:00:00.000Z';
const persistedAt = '2026-08-25T08:00:01.000Z';
const gemsV1 = { contentType: 'learning', summary: 'v1', universalTabs: { definitions: ['a'] } };
const gemsV2 = { contentType: 'learning', summary: 'v2', universalTabs: { definitions: ['b'] } };

const pendingV1 = createPendingGemsAnalysisProvenance(gemsV1, importedAt);
const completeV1 = completeGemsAnalysisProvenance(pendingV1, persistedAt);
const current = {
  id: 'current',
  analysisProvider: 'gems',
  analysisStatus: 'analyzed',
  analyzedAt: persistedAt,
  gemsAnalysisProvenance: completeV1,
};

assert.equal(isVideoAnalyzed(current), true, 'current GEMS-linked tabs must be analyzed');
assert.deepEqual(resolveVideoAnalyzedState(current), {
  analyzed: true,
  analyzedAt: persistedAt,
  contentIdentity: completeV1.contentIdentity,
});

const legacyFixtures = [
  { id: 'boolean', analysisStatus: 'analyzed' },
  { id: 'date', analyzedAt: persistedAt },
  { id: 'done', status: 'done' },
  { id: 'chapters', aiChapters: [{ title: 'old chapter' }] },
];
legacyFixtures.forEach((video) => assert.equal(isVideoAnalyzed(video), false));
assert.equal(hasLegacyAnalysisTabContent({ contentType: 'marketBrief' }), false, 'metadata alone is not tab content');
assert.equal(hasLegacyAnalysisTabContent({ universalTabs: { specialized: { marketNews: [{ title: 'legacy row' }] } } }), true);
assert.equal(isVideoAnalyzed({ id: 'legacy-summary', shortSummary: 'old summary' }), true, 'filled legacy summary tab is analyzed');
assert.deepEqual(resolveVideoAnalyzedState({
  id: 'canonical-indexeddb',
  canonicalMarketBriefEvidence: {
    analyzed: true,
    analyzedAt: persistedAt,
    storage: 'indexedDB',
    storageKey: 'market_brief_canonical-indexeddb',
  },
}), {
  analyzed: true,
  analyzedAt: persistedAt,
  contentIdentity: null,
}, 'canonical IndexedDB evidence must drive the same card/filter/count selector');
assert.equal(isVideoAnalyzed({
  id: 'canonical-pending',
  canonicalMarketBriefEvidence: { analyzed: true, analyzedAt: persistedAt },
  gemsAnalysisProvenance: pendingV1,
}), false, 'pending provenance must take precedence over canonical legacy evidence');

assert.equal(isVideoAnalyzed({ ...current, gemsAnalysisProvenance: pendingV1 }), false, 'import alone is not enough');
assert.equal(isVideoAnalyzed({ ...current, analysisStatus: 'failed' }), false, 'failed update is not analyzed');
assert.equal(isVideoAnalyzed({ ...current, analysisStatus: 'processing' }), false, 'partial update is not analyzed');
assert.equal(isVideoAnalyzed({ ...current, analysisProvider: 'gemini' }), false, 'unrelated provider is not analyzed');
assert.equal(isVideoAnalyzed({ ...current, analyzedAt: '2026-08-25T08:00:02.000Z' }), false, 'timestamp mismatch is stale');

const pendingV2 = createPendingGemsAnalysisProvenance(gemsV2, '2026-08-25T09:00:00.000Z');
assert.notEqual(pendingV2.contentIdentity, completeV1.contentIdentity);
assert.equal(isVideoAnalyzed({ ...current, gemsAnalysisProvenance: pendingV2 }), false, 'new GEMS invalidates old tabs');
assert.equal(isVideoAnalyzed({
  ...current,
  gemsAnalysisProvenance: { ...pendingV2, tabsSourceIdentity: completeV1.contentIdentity, tabsPersistedAt: persistedAt },
}), false, 'stale tabs cannot satisfy a newer import');

const archived = structuredClone(current);
archived.archivedAt = '2026-08-25T10:00:00.000Z';
assert.equal(isVideoAnalyzed(archived), true, 'archive metadata must not grant or revoke valid provenance');
const restored = { ...archived, archivedAt: null, title: 'metadata edit' };
assert.equal(isVideoAnalyzed(restored), true, 'restore and metadata edits preserve valid provenance');

const canonicalIndexedDbVideo = {
  id: 'canonical-indexeddb-count',
  canonicalMarketBriefEvidence: { analyzed: true, analyzedAt: persistedAt },
};
const videos = [current, canonicalIndexedDbVideo, ...legacyFixtures, { ...current, id: 'failed', analysisStatus: 'failed' }];
assert.equal(filterAnalyzedVideos(videos).length, 2);
assert.equal(countAnalyzedVideos(videos), 2);
assert.equal(videos.filter(isVideoAnalyzed).length, countAnalyzedVideos(videos), 'badge/filter/count classification must match');

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failWrites = false;
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) {
    if (this.failWrites) throw new Error('simulated persistence failure');
    this.values.set(key, String(value));
  }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
storage.setItem('market_brief_legacy-sidecar', JSON.stringify({
  contentType: 'marketBrief',
  universalTabs: { specialized: { marketNews: [{ title: 'stored row' }] } },
}));
assert.equal(isVideoAnalyzed({ id: 'legacy-sidecar' }), true, 'filled persisted legacy tabs are analyzed');
assert.equal(isVideoAnalyzed({
  id: 'legacy-sidecar',
  gemsAnalysisProvenance: pendingV1,
}), false, 'pending provenance must not be overridden by legacy tab content');
const { saveVideos, updateStoredVideo } = await import('../src/services/videoStorage.js');
assert.equal(saveVideos([{ ...current, gemsAnalysisProvenance: pendingV1 }]), true);
storage.failWrites = true;
assert.equal(updateStoredVideo('current', current), null, 'failed final write must be reported');
storage.failWrites = false;
const afterFailure = JSON.parse(storage.getItem('yt_mentor_videos_v2'))[0];
assert.equal(isVideoAnalyzed(afterFailure), false, 'failed final write must remain pending after reload');
assert.ok(updateStoredVideo('current', current), 'successful final write must return the persisted record');
const afterReload = JSON.parse(storage.getItem('yt_mentor_videos_v2'))[0];
assert.equal(isVideoAnalyzed(afterReload), true, 'successful provenance must survive reload');

const sourceContracts = [
  ['src/components/dashboard/VideoCard.jsx', /resolveVideoAnalyzedState/, /analyzedState\.analyzed/],
  ['src/pages/Dashboard.jsx', /countAnalyzedVideos/, /filterAnalyzedVideos/],
  ['src/pages/CloudBackups.jsx', /filterAnalyzedVideos/],
  ['src/pages/TopicKnowledgePage.jsx', /isVideoAnalyzed/],
  ['src/pages/KnowledgeLibrary.jsx', /isVideoAnalyzed/],
  ['src/pages/Workspace.jsx', /countAnalyzedVideos/],
];
for (const [file, ...patterns] of sourceContracts) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  patterns.forEach((pattern) => assert.match(source, pattern, `${file} must use the centralized resolver`));
}
const cardSource = fs.readFileSync(new URL('../src/components/dashboard/VideoCard.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(cardSource, /const hasAnyAiContent/);
const detailPanelSource = fs.readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
assert.match(
  detailPanelSource,
  /const cardVideo = queryClient\.getQueryData\(\['videos'\]\)\?\.find\(\(candidate\) => candidate\?\.id === videoId\) \|\| video;/,
  'the recovery status report must resolve evidence from the same videos query used by cards and statistics',
);
assert.match(
  detailPanelSource,
  /cardAnalyzed:\s*isVideoAnalyzed\(cardVideo\)/,
  'the recovery status report must use the same analyzed selector as cards and statistics',
);
assert.doesNotMatch(
  detailPanelSource,
  /cardAnalyzed:\s*Boolean\(video\?\.canonicalMarketBriefEvidence\?\.analyzed\)/,
  'the recovery report must not narrow analyzed evidence to the canonical hydration field',
);

console.log('gems-analyzed-status-qa: PASS (current, legacy tabs, stale, failed, partial, reload/archive consistency)');
