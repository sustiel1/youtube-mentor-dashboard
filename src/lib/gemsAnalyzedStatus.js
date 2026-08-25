import { canonicalize, fnv1a } from './persistence/storageIntegrity.js';

export const GEMS_ANALYSIS_PROVENANCE_VERSION = 1;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseIsoTime(value) {
  if (!isNonEmptyString(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

const LEGACY_TAB_CONTENT_KEYS = [
  'summary',
  'shortSummary',
  'fullSummary',
  'top5Insights',
  'reusableKnowledge',
  'keyTakeaways',
  'actionChecklist',
  'conclusions',
  'keyPoints',
  'keyInsights',
  'actionItems',
  'mainLesson',
  'definitions',
  'indicators',
  'setups',
  'patterns',
  'checklists',
  'mistakes',
  'marketNews',
  'marketIndices',
  'macroFactors',
  'sectorRotation',
  'stocksMentioned',
  'opportunities',
  'risks',
];

function hasMeaningfulValue(value, depth = 0) {
  if (depth > 8 || value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.values(value).some((item) => hasMeaningfulValue(item, depth + 1));
}

export function hasLegacyAnalysisTabContent(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (hasMeaningfulValue(payload.universalTabs) || hasMeaningfulValue(payload.rawData)) return true;
  return LEGACY_TAB_CONTENT_KEYS.some((key) => hasMeaningfulValue(payload[key]));
}

function readJsonStorageValue(storage, key) {
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function resolveLegacyAnalysisTabEvidence(video, storage = globalThis.localStorage) {
  if (!video || typeof video !== 'object') return null;

  if (hasLegacyAnalysisTabContent(video)) {
    return { payload: video, savedAt: video.marketBriefSavedAt || video.analyzedAt || null };
  }

  const embedded = video.marketBriefData;
  if (hasLegacyAnalysisTabContent(embedded)) {
    return { payload: embedded, savedAt: video.marketBriefSavedAt || video.analyzedAt || null };
  }

  const ids = [...new Set([video.id, video.youtubeId, video.videoId].filter(Boolean))];
  for (const id of ids) {
    const marketBrief = readJsonStorageValue(storage, `market_brief_${id}`);
    if (hasLegacyAnalysisTabContent(marketBrief)) {
      return { payload: marketBrief, savedAt: video.marketBriefSavedAt || video.analyzedAt || null };
    }

    const savedAnalysis = readJsonStorageValue(storage, `analysis:${id}`);
    const savedPayload = savedAnalysis?.marketBriefData || savedAnalysis;
    if (hasLegacyAnalysisTabContent(savedPayload)) {
      return { payload: savedPayload, savedAt: savedAnalysis?.savedAt || video.analyzedAt || null };
    }
  }

  return null;
}

export function createGemsContentIdentity(gemsContent) {
  if (!gemsContent || typeof gemsContent !== 'object') {
    throw new Error('GEMS content must be a parsed object');
  }
  const canonical = JSON.stringify(canonicalize(gemsContent));
  if (!canonical || canonical === '{}') {
    throw new Error('GEMS content must not be empty');
  }
  const reverse = [...canonical].reverse().join('');
  return `gems-v${GEMS_ANALYSIS_PROVENANCE_VERSION}:${canonical.length}:${fnv1a(canonical)}:${fnv1a(reverse)}`;
}

export function createPendingGemsAnalysisProvenance(gemsContent, importedAt = new Date().toISOString()) {
  if (parseIsoTime(importedAt) == null) throw new Error('A valid GEMS import time is required');
  return {
    schemaVersion: GEMS_ANALYSIS_PROVENANCE_VERSION,
    contentIdentity: createGemsContentIdentity(gemsContent),
    importedAt,
    tabsSourceIdentity: null,
    tabsPersistedAt: null,
  };
}

export function completeGemsAnalysisProvenance(pending, tabsPersistedAt = new Date().toISOString()) {
  const importedTime = parseIsoTime(pending?.importedAt);
  const persistedTime = parseIsoTime(tabsPersistedAt);
  if (
    pending?.schemaVersion !== GEMS_ANALYSIS_PROVENANCE_VERSION
    || !isNonEmptyString(pending?.contentIdentity)
    || importedTime == null
    || persistedTime == null
    || persistedTime < importedTime
  ) {
    throw new Error('Valid pending GEMS provenance is required');
  }
  return {
    ...pending,
    tabsSourceIdentity: pending.contentIdentity,
    tabsPersistedAt,
  };
}

export function resolveVideoAnalyzedState(video) {
  const provenance = video?.gemsAnalysisProvenance;
  const importedTime = parseIsoTime(provenance?.importedAt);
  const persistedTime = parseIsoTime(provenance?.tabsPersistedAt);
  const analyzed = Boolean(
    provenance?.schemaVersion === GEMS_ANALYSIS_PROVENANCE_VERSION
    && isNonEmptyString(provenance?.contentIdentity)
    && provenance.tabsSourceIdentity === provenance.contentIdentity
    && importedTime != null
    && persistedTime != null
    && persistedTime >= importedTime
    && video?.analysisProvider === 'gems'
    && video?.analysisStatus === 'analyzed'
    && video?.analyzedAt === provenance.tabsPersistedAt
  );

  if (provenance) {
    return {
      analyzed,
      analyzedAt: analyzed ? provenance.tabsPersistedAt : null,
      contentIdentity: analyzed ? provenance.contentIdentity : null,
    };
  }

  const legacyEvidence = resolveLegacyAnalysisTabEvidence(video);
  const legacyAnalyzedAt = parseIsoTime(legacyEvidence?.savedAt) == null ? null : legacyEvidence.savedAt;
  return {
    analyzed: Boolean(legacyEvidence),
    analyzedAt: legacyEvidence ? legacyAnalyzedAt : null,
    contentIdentity: null,
  };
}

export function isVideoAnalyzed(video) {
  return resolveVideoAnalyzedState(video).analyzed;
}

export function filterAnalyzedVideos(videos = []) {
  return videos.filter(isVideoAnalyzed);
}

export function countAnalyzedVideos(videos = []) {
  return filterAnalyzedVideos(videos).length;
}
