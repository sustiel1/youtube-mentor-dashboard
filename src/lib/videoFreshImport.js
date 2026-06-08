import { clearAiAnalysis } from "@/lib/aiAnalysisStore";
import { deleteSavedAnalysis } from "@/lib/localAnalysisStore";
import { forceUpsertLocalVideo } from "@/lib/localVideoStore";
import { deleteChunks } from "@/lib/localChunkStore";
import { clearSegments } from "@/lib/localSegmentStore";
import { clearTranscriptCache } from "@/services/youtubeTranscript";
import { getVideoIdFromUrl } from "@/services/youtubeMetadata";

const GENERATED_NULL_FIELDS = [
  "categoryOverride",
  "subCategoryOverride",
  "obsidianTopic",
  "recommendedGem",
  "recommendedSubTopic",
  "gemOverride",
  "dismissedSubTopicRec",
  "uiMode",
  "tabsPreset",
  "gemType",
  "analysisType",
  "transcript",
  "manualTranscript",
  "whisperTranscript",
  "transcriptSource",
  "transcriptLanguage",
  "transcriptError",
  "transcriptQuality",
  "transcriptLength",
  "transcriptImportedAt",
  "shortSummary",
  "fullSummary",
  "summary",
  "aiSummary",
  "aiSummaryShort",
  "aiSummaryLong",
  "chapterSource",
  "mainLesson",
  "strategyOrMethod",
  "brainSummary",
  "analysisProvider",
  "analysisSource",
  "analysisMode",
  "analysisQuality",
  "analysisError",
  "analysisVersion",
  "analysisSavedAt",
  "analyzedAt",
  "mainClaim",
  "speakerPosition",
  "ideologyAnalysis",
  "theologyAnalysis",
  "opponentView",
  "liberalJewishPerspective",
  "cachedTranscript",
  "cachedClassification",
  "savedAnalysis",
  "attachedDocumentsInsights",
];

const GENERATED_EMPTY_ARRAY_FIELDS = [
  "transcriptSegments",
  "chapters",
  "aiChapters",
  "chaptersAI",
  "descriptionChapters",
  "keyPoints",
  "keyInsights",
  "actionItems",
  "videoTopics",
  "tags",
  "rules",
  "mistakesToAvoid",
  "warnings",
  "concepts",
  "frameworks",
  "thesis",
  "questions",
  "checklists",
  "arguments",
  "counterArguments",
  "knowledgePoints",
  "viralQuotes",
  "politicalSlogans",
  "debateResponses",
  "commentBank",
  "campaignKit",
  "reusableKnowledge",
  "knowledgeSections",
  "politicalSections",
  "marketSections",
];

const GENERATED_EMPTY_OBJECT_FIELDS = [
  "selectedKnowledgeItems",
];

function cloneArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function cloneObject(value, fallback = null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : fallback;
}

export function getFreshImportVideoIds(video) {
  const id = video?.id ? String(video.id).trim() : null;
  const youtubeId =
    video?.youtubeId
      ? String(video.youtubeId).trim()
      : video?.videoId
        ? String(video.videoId).trim()
        : getVideoIdFromUrl(video?.url || "");

  return { id, youtubeId };
}

export function clearVideoGeneratedCaches(video) {
  const { id, youtubeId } = getFreshImportVideoIds(video);
  const cleared = {
    savedAnalysis: false,
    aiAnalysis: false,
    transcriptCache: false,
    transcriptSegments: false,
    chunks: false,
    chunksByYoutubeId: false,
    politicalSummaryKeys: [],
    localStorageKeys: [],
  };

  const removeKey = (key) => {
    if (!key) return false;
    try {
      if (localStorage.getItem(key) === null) return false;
      localStorage.removeItem(key);
      cleared.localStorageKeys.push(key);
      return true;
    } catch {
      return false;
    }
  };

  if (id) {
    cleared.savedAnalysis = deleteSavedAnalysis(id);
    clearAiAnalysis(id);
    cleared.aiAnalysis = true;
    try {
      cleared.chunks = deleteChunks(id);
    } catch {
      cleared.chunks = false;
    }
  }

  if (youtubeId) {
    try {
      cleared.transcriptCache = clearTranscriptCache(youtubeId);
    } catch {
      cleared.transcriptCache = false;
    }
    try {
      cleared.transcriptSegments = clearSegments(youtubeId);
    } catch {
      cleared.transcriptSegments = false;
    }
    if (youtubeId !== id) {
      try {
        cleared.chunksByYoutubeId = deleteChunks(youtubeId);
      } catch {
        cleared.chunksByYoutubeId = false;
      }
    }
  }

  const politicalKeys = [
    id ? `political_summary_${id}` : null,
    youtubeId ? `political_summary_${youtubeId}` : null,
  ].filter(Boolean);
  politicalKeys.forEach((key) => {
    if (removeKey(key)) cleared.politicalSummaryKeys.push(key);
  });

  [
    id ? `gems-applied-${id}` : null,
    id ? `gems-paste-${id}` : null,
    id ? `analysis:${id}` : null,
    id ? `ai_analysis_${id}` : null,
    youtubeId && youtubeId !== id ? `analysis:${youtubeId}` : null,
    youtubeId && youtubeId !== id ? `ai_analysis_${youtubeId}` : null,
  ]
    .filter(Boolean)
    .forEach(removeKey);

  return cleared;
}

export function buildFreshImportRecord(existingVideo, freshVideo, options = {}) {
  const sourceVideo = existingVideo && typeof existingVideo === "object" ? existingVideo : {};
  const fresh = freshVideo && typeof freshVideo === "object" ? freshVideo : {};
  const requestFreshAnalysis = options.requestFreshAnalysis === true;
  const requestedAt = typeof options.requestedAt === "string"
    ? options.requestedAt
    : new Date().toISOString();
  const requestSource = typeof options.requestSource === "string" && options.requestSource.trim()
    ? options.requestSource.trim()
    : "manual";

  const topicIds = Array.isArray(fresh.topicIds) && fresh.topicIds.length > 0
    ? cloneArray(fresh.topicIds)
    : cloneArray(sourceVideo.topicIds);

  const attachedDocuments = Array.isArray(sourceVideo.attachedDocuments)
    ? cloneArray(sourceVideo.attachedDocuments)
    : Array.isArray(fresh.attachedDocuments)
      ? cloneArray(fresh.attachedDocuments)
      : [];

  const presentations = Array.isArray(sourceVideo.presentations)
    ? cloneArray(sourceVideo.presentations)
    : Array.isArray(fresh.presentations)
      ? cloneArray(fresh.presentations)
      : [];

  const next = {
    ...sourceVideo,
    ...fresh,
    id: sourceVideo.id || fresh.id,
    videoId: fresh.videoId || sourceVideo.videoId || sourceVideo.youtubeId || fresh.youtubeId || null,
    youtubeId: fresh.youtubeId || sourceVideo.youtubeId || sourceVideo.videoId || fresh.videoId || null,
    url: fresh.url || sourceVideo.url || null,
    title: fresh.title || sourceVideo.title || "סרטון YouTube",
    thumbnail: fresh.thumbnail || sourceVideo.thumbnail || sourceVideo.thumbnailUrl || null,
    channelTitle: fresh.channelTitle || sourceVideo.channelTitle || null,
    channelId: fresh.channelId || sourceVideo.channelId || null,
    channelUrl: fresh.channelUrl || sourceVideo.channelUrl || null,
    channelThumbnail: fresh.channelThumbnail || sourceVideo.channelThumbnail || null,
    mentorId: fresh.mentorId ?? sourceVideo.mentorId ?? null,
    topicIds,
    source: fresh.source || sourceVideo.source || "manual",
    publishedAt: fresh.publishedAt || sourceVideo.publishedAt || new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    addedAt: sourceVideo.addedAt || fresh.addedAt || new Date().toISOString(),
    addedManually: sourceVideo.addedManually ?? fresh.addedManually ?? true,
    status: fresh.status || "new",
    isSaved: sourceVideo.isSaved ?? fresh.isSaved ?? false,
    learningStatus: sourceVideo.learningStatus ?? fresh.learningStatus ?? "not_started",
    customSubtitle:
      typeof sourceVideo.customSubtitle === "string"
        ? sourceVideo.customSubtitle
        : typeof fresh.customSubtitle === "string"
          ? fresh.customSubtitle
          : null,
    attachedDocuments,
    presentations,
    obsidianSavedStatus: sourceVideo.obsidianSavedStatus ?? fresh.obsidianSavedStatus ?? null,
    savedToBrain: sourceVideo.savedToBrain ?? fresh.savedToBrain ?? false,
    savedToMyChannels: sourceVideo.savedToMyChannels ?? fresh.savedToMyChannels ?? false,
    savedChannelCollectionId: sourceVideo.savedChannelCollectionId ?? fresh.savedChannelCollectionId ?? null,
    cloudBackupFileId: sourceVideo.cloudBackupFileId ?? fresh.cloudBackupFileId ?? null,
    isPermanent: sourceVideo.isPermanent ?? fresh.isPermanent ?? false,
    unpinnedAt: sourceVideo.unpinnedAt ?? fresh.unpinnedAt ?? null,
    duration: fresh.duration || sourceVideo.duration || null,
    viewCount:
      Number.isFinite(fresh.viewCount)
        ? fresh.viewCount
        : Number.isFinite(sourceVideo.viewCount)
          ? sourceVideo.viewCount
          : null,
    category: fresh.category ?? null,
    subCategory: null,
    contentType: fresh.contentType ?? (sourceVideo.contentType === "pdf" ? "pdf" : null),
    transcriptStatus: "unavailable",
    analysisStatus: "not_analyzed",
    pendingFreshImport: requestFreshAnalysis,
    freshImportRequestedAt: requestFreshAnalysis ? requestedAt : null,
    freshImportSource: requestFreshAnalysis ? requestSource : null,
  };

  GENERATED_NULL_FIELDS.forEach((key) => {
    next[key] = null;
  });

  GENERATED_EMPTY_ARRAY_FIELDS.forEach((key) => {
    next[key] = [];
  });

  GENERATED_EMPTY_OBJECT_FIELDS.forEach((key) => {
    next[key] = {};
  });

  next.selectedKnowledgeItems = {};
  next.transcriptStatus = "unavailable";
  next.analysisStatus = "not_analyzed";
  next.category = fresh.category ?? null;
  next.subCategory = null;
  next.customSubtitle =
    typeof sourceVideo.customSubtitle === "string"
      ? sourceVideo.customSubtitle
      : typeof fresh.customSubtitle === "string"
        ? fresh.customSubtitle
        : null;
  next.attachedDocuments = attachedDocuments;
  next.presentations = presentations;
  if (Array.isArray(sourceVideo.notes)) {
    next.notes = cloneArray(sourceVideo.notes);
  }
  if (sourceVideo.manualComments != null) {
    next.manualComments = cloneObject(sourceVideo.manualComments, sourceVideo.manualComments);
  }

  return next;
}

export function stripFreshImportFlags(video) {
  if (!video || typeof video !== "object") return video;
  const next = { ...video };
  delete next.pendingFreshImport;
  delete next.freshImportRequestedAt;
  delete next.freshImportSource;
  return next;
}

export function consumeFreshImportFlag(video) {
  if (!video || typeof video !== "object") return video;
  return stripFreshImportFlags(video);
}

export function saveFreshImportRecordLocally(record) {
  return forceUpsertLocalVideo(record);
}
