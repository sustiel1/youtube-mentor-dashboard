import { hasLegacyAnalysisTabContent } from './gemsAnalyzedStatus.js';
import { getMarketBriefCandidateTimestamp, selectNewestMarketBriefCandidate } from './marketBriefSourceSelection.js';
import { readCanonicalMarketBrief } from './persistence/marketBriefCanonicalStore.js';
import { APPLICATION_STORAGE_MODES, getApplicationStorageMode } from './persistence/storageMode.js';

function uniqueVideoIds(video) {
  return [...new Set([video?.id, video?.youtubeId, video?.videoId]
    .map((value) => String(value || '').trim())
    .filter(Boolean))];
}

export async function hydrateCanonicalVideoAnalysisEvidence(videos = [], {
  storageMode = getApplicationStorageMode(),
  readMarketBrief = readCanonicalMarketBrief,
} = {}) {
  if (!Array.isArray(videos) || videos.length === 0) return [];
  if (storageMode !== APPLICATION_STORAGE_MODES.INDEXED_DB) return videos;

  return Promise.all(videos.map(async (video) => {
    if (!video || video.gemsAnalysisProvenance) return video;
    const ids = uniqueVideoIds(video);
    if (!ids.length) return video;

    const reads = await Promise.all(ids.map(async (id, fallbackOrder) => {
      const result = await readMarketBrief(id);
      if (!hasLegacyAnalysisTabContent(result?.data)) return null;
      return {
        data: result.data,
        storage: result.storage,
        storageKey: result.storageKey,
        fallbackOrder,
      };
    }));
    const selected = selectNewestMarketBriefCandidate(reads);
    if (!selected) return video;
    const timestamp = getMarketBriefCandidateTimestamp(selected);

    return {
      ...video,
      canonicalMarketBriefEvidence: {
        analyzed: true,
        analyzedAt: timestamp == null ? null : new Date(timestamp).toISOString(),
        storage: selected.storage || 'indexedDB',
        storageKey: selected.storageKey || null,
      },
    };
  }));
}
