import assert from 'node:assert/strict';
import fs from 'node:fs';

import { hydrateCanonicalVideoAnalysisEvidence } from '../src/lib/canonicalVideoAnalysisHydration.js';
import { isVideoAnalyzed } from '../src/lib/gemsAnalyzedStatus.js';
import { APPLICATION_STORAGE_MODES } from '../src/lib/persistence/storageMode.js';

const savedAt = '2026-08-26T12:30:00.000Z';
const videos = [
  { id: 'late-night', youtubeId: 'youtube-late-night', title: 'Late Night' },
  { id: 'untouched', title: 'Untouched' },
];
const calls = [];
const hydrated = await hydrateCanonicalVideoAnalysisEvidence(videos, {
  storageMode: APPLICATION_STORAGE_MODES.INDEXED_DB,
  readMarketBrief: async (id) => {
    calls.push(id);
    if (id !== 'youtube-late-night') return null;
    return {
      data: {
        contentType: 'marketBrief',
        universalTabs: { summary: { shortSummary: 'Persisted Evening Brief' } },
        __marketBriefSource: { source: 'paste-video', savedAt },
      },
      storage: 'indexedDB',
      storageKey: `market_brief_${id}`,
    };
  },
});

assert.equal(hydrated.length, videos.length);
assert.notEqual(hydrated[0], videos[0], 'canonical evidence decorates a copy');
assert.equal(hydrated[1], videos[1], 'unrelated videos remain referentially unchanged');
assert.equal(isVideoAnalyzed(hydrated[0]), true);
assert.equal(hydrated[0].canonicalMarketBriefEvidence.analyzedAt, savedAt);
assert.equal(hydrated[0].canonicalMarketBriefEvidence.storageKey, 'market_brief_youtube-late-night');
assert.equal(isVideoAnalyzed(hydrated[1]), false);
assert.deepEqual(calls, ['late-night', 'youtube-late-night', 'untouched']);

const localMode = await hydrateCanonicalVideoAnalysisEvidence(videos, {
  storageMode: APPLICATION_STORAGE_MODES.LOCAL_STORAGE,
  readMarketBrief: async () => { throw new Error('must not read IndexedDB'); },
});
assert.equal(localMode, videos, 'localStorage mode keeps the existing synchronous evidence path');

const useVideosSource = fs.readFileSync(new URL('../src/hooks/useVideos.js', import.meta.url), 'utf8');
assert.match(useVideosSource, /await hydrateCanonicalVideoAnalysisEvidence\(loadLocalFirstVideos\(\)\)/);
const panelSource = fs.readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
const canonicalWriteStart = panelSource.indexOf('const persistenceResult = await writeCanonicalMarketBrief');
const canonicalWriteEnd = panelSource.indexOf('} else {', canonicalWriteStart);
assert.ok(canonicalWriteStart >= 0 && canonicalWriteEnd > canonicalWriteStart);
assert.match(panelSource.slice(canonicalWriteStart, canonicalWriteEnd), /queryClient\.invalidateQueries\(\{ queryKey: \['videos'\] \}\)/);

console.log('canonical-video-analysis-hydration-qa: PASS');
