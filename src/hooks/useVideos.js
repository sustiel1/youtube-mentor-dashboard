import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video } from '@/api/entities';
import { isBase44Enabled } from '@/config/base44Flags';
import { VIDEOS } from '@/data/mockData';
import {
  getLocalVideos,
  saveLocalVideo,
  updateLocalVideo,
  deleteLocalVideo,
  forceUpsertLocalVideo,
} from '@/lib/localVideoStore';
import { applyChannelCollectionsToVideos } from '@/lib/localChannelCollectionsStore';
import { hasLocalVideoStoreSnapshot, wereLocalVideosCleared } from '@/services/videoStorage';
import { isDriveConnected, deleteDriveFileById } from '@/lib/gdriveAnalysisStore';

function sortVideosDesc(videos) {
  return [...videos].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
  );
}

function loadLocalFirstVideos() {
  const local = getLocalVideos();
  if (local.length > 0) {
    if (import.meta.env.DEV) {
      console.info(`[useVideos] local-first — ${local.length} videos from storage`);
    }
    return sortVideosDesc(local);
  }
  if (wereLocalVideosCleared() || hasLocalVideoStoreSnapshot()) {
    if (import.meta.env.DEV) {
      console.info('[useVideos] local-first — storage cleared → returning []');
    }
    return [];
  }
  console.warn('[useVideos] local-first — using mock data');
  return VIDEOS;
}

// Fetch all videos — Base44 optional; otherwise localStorage → mockData
export function useVideos() {
  return useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      if (!isBase44Enabled()) {
        return applyChannelCollectionsToVideos(loadLocalFirstVideos());
      }
      try {
        const data = await Video.list('-publishedAt');
        return applyChannelCollectionsToVideos(data ?? []);
      } catch {
        return applyChannelCollectionsToVideos(loadLocalFirstVideos());
      }
    },
  });
}

// Fetch a single video by id — checks list cache before fetching all videos
export function useVideo(videoId) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['videos', videoId],
    queryFn: async () => {
      if (!isBase44Enabled()) {
        const local = getLocalVideos().find((v) => v.id === videoId);
        if (local) return applyChannelCollectionsToVideos([local])[0] ?? local;
        if (hasLocalVideoStoreSnapshot() || wereLocalVideosCleared()) return null;
        return applyChannelCollectionsToVideos([VIDEOS.find((v) => v.id === videoId) ?? null].filter(Boolean))[0] ?? null;
      }
      const cached = queryClient.getQueryData(['videos']);
      if (Array.isArray(cached)) {
        const found = cached.find((v) => v.id === videoId);
        if (found) return found;
      }
      try {
        const all = await Video.list('-publishedAt');
        return applyChannelCollectionsToVideos(all).find((v) => v.id === videoId) ?? null;
      } catch {
        const local = getLocalVideos().find((v) => v.id === videoId);
        if (local) return applyChannelCollectionsToVideos([local])[0] ?? local;
        if (hasLocalVideoStoreSnapshot() || wereLocalVideosCleared()) return null;
        return applyChannelCollectionsToVideos([VIDEOS.find((v) => v.id === videoId) ?? null].filter(Boolean))[0] ?? null;
      }
    },
    enabled: !!videoId,
  });
}

// Mutation: update a video's status (and optionally other fields)
export function useUpdateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      if (!isBase44Enabled()) {
        const u = updateLocalVideo(id, data);
        if (u) return u;
        throw new Error('סרטון לא נמצא באחסון מקומי');
      }
      return Video.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: update transcript
export function useUpdateTranscript() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, transcript }) => {
      if (!isBase44Enabled()) {
        const u = updateLocalVideo(id, { transcript });
        if (u) return u;
        throw new Error('סרטון לא נמצא באחסון מקומי');
      }
      return Video.update(id, { transcript });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: update summary fields
export function useUpdateSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      shortSummary,
      fullSummary,
      keyPoints,
      tags,
      videoTopics,
      aiChapters,
      chapters,
      transcript,
      transcriptSegments,
      transcriptSource,
      transcriptLength,
      manualTranscript,
      whisperTranscript,
      transcriptLanguage,
      transcriptQuality,
      analyzedAt,
      analysisStatus,
      analysisError,
      aiSummaryShort,
      aiSummaryLong,
      keyInsights,
      actionItems,
      mainLesson,
      strategyOrMethod,
      rules,
      checklists,
      warnings,
      frameworks,
      concepts,
      thesis,
      questions,
      mistakesToAvoid,
      atomicKnowledge,
      analysisVersion,
      chapterSource,
      analysisQuality,
      descriptionChapters,
      duration,
      viewCount,
      analysisProvider,
      transcriptStatus,
      transcriptError,
      brainSummary,
      contentType,
      mainClaim,
      speakerPosition,
      politicalArguments,
      weakPoints,
      counterArguments,
      socialMediaReplies,
      _fullVideo,
    }) => {
      const patch = { shortSummary, fullSummary, keyPoints, tags, videoTopics };
      if (contentType != null) patch.contentType = contentType;
      if (mainClaim != null) patch.mainClaim = mainClaim;
      if (speakerPosition != null) patch.speakerPosition = speakerPosition;
      if (Array.isArray(politicalArguments)) patch.politicalArguments = politicalArguments;
      if (Array.isArray(weakPoints)) patch.weakPoints = weakPoints;
      if (Array.isArray(counterArguments)) patch.counterArguments = counterArguments;
      if (Array.isArray(socialMediaReplies)) patch.socialMediaReplies = socialMediaReplies;
      if (brainSummary != null) patch.brainSummary = brainSummary;
      if (Array.isArray(aiChapters) && aiChapters.length > 0) patch.aiChapters = aiChapters;
      if (Array.isArray(chapters) && chapters.length > 0) patch.chapters = chapters;
      if (Array.isArray(descriptionChapters) && descriptionChapters.length > 0) patch.descriptionChapters = descriptionChapters;
      if (transcript != null) patch.transcript = transcript;
      if (Array.isArray(transcriptSegments)) patch.transcriptSegments = transcriptSegments;
      if (transcriptSource != null) patch.transcriptSource = transcriptSource;
      if (transcriptLength != null) patch.transcriptLength = transcriptLength;
      if (manualTranscript != null) patch.manualTranscript = manualTranscript;
      if (whisperTranscript != null) patch.whisperTranscript = whisperTranscript;
      if (transcriptLanguage != null) patch.transcriptLanguage = transcriptLanguage;
      if (transcriptQuality != null) patch.transcriptQuality = transcriptQuality;
      if (analyzedAt) patch.analyzedAt = analyzedAt;
      if (analysisStatus) patch.analysisStatus = analysisStatus;
      if (analysisError !== undefined) patch.analysisError = analysisError;
      if (chapterSource != null) patch.chapterSource = chapterSource;
      if (analysisQuality != null) patch.analysisQuality = analysisQuality;
      if (duration != null) patch.duration = duration;
      if (Number.isFinite(viewCount)) patch.viewCount = viewCount;
      if (analysisProvider != null) patch.analysisProvider = analysisProvider;
      if (transcriptStatus != null) patch.transcriptStatus = transcriptStatus;
      if (transcriptError !== undefined) patch.transcriptError = transcriptError;
      if (aiSummaryShort != null) patch.aiSummaryShort = aiSummaryShort;
      if (aiSummaryLong != null) patch.aiSummaryLong = aiSummaryLong;
      if (Array.isArray(keyInsights)) patch.keyInsights = keyInsights;
      if (Array.isArray(actionItems)) patch.actionItems = actionItems;
      if (mainLesson != null) patch.mainLesson = mainLesson;
      if (strategyOrMethod != null) patch.strategyOrMethod = strategyOrMethod;
      if (Array.isArray(rules)) patch.rules = rules;
      if (Array.isArray(checklists)) patch.checklists = checklists;
      if (Array.isArray(warnings)) patch.warnings = warnings;
      if (Array.isArray(frameworks)) patch.frameworks = frameworks;
      if (Array.isArray(concepts)) patch.concepts = concepts;
      if (Array.isArray(thesis)) patch.thesis = thesis;
      if (Array.isArray(questions)) patch.questions = questions;
      if (Array.isArray(mistakesToAvoid)) patch.mistakesToAvoid = mistakesToAvoid;
      if (atomicKnowledge != null) patch.atomicKnowledge = atomicKnowledge;
      if (analysisVersion != null) patch.analysisVersion = analysisVersion;
      if (analysisStatus === 'completed') {
        patch.status = 'done';
      }

      console.log('[political-store] patch.contentType:', patch.contentType, 'patch.mainClaim:', patch.mainClaim);
      if (!isBase44Enabled() || String(id || '').startsWith('local_')) {
        const updated = updateLocalVideo(id, patch);
        console.log('[political-store] updated.contentType:', updated?.contentType);
        if (updated) return updated;
        if (_fullVideo) return forceUpsertLocalVideo({ ..._fullVideo, ...patch });
        throw new Error('שמירה נכשלה — הסרטון לא נמצא ב-localStorage');
      }

      try {
        return await Video.update(id, patch);
      } catch {
        const updated = updateLocalVideo(id, patch);
        if (updated) return updated;
        if (_fullVideo) return forceUpsertLocalVideo({ ..._fullVideo, ...patch });
        throw new Error('שמירה נכשלה — הסרטון לא נמצא ב-Base44 או ב-localStorage');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: create a new video record
export function useCreateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (videoData) => {
      if (!isBase44Enabled()) {
        const saved = saveLocalVideo(videoData);
        if (!saved) throw new Error('כפילות — הסרטון כבר קיים');
        return saved;
      }
      try {
        return await Video.create(videoData);
      } catch {
        const saved = saveLocalVideo(videoData);
        if (!saved) throw new Error('כפילות — הסרטון כבר קיים');
        return saved;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: delete a video
export function useDeleteVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      if (!isBase44Enabled()) {
        // Capture Drive backup file ID before local delete
        const driveFileId = getLocalVideos().find(v => v.id === id)?.cloudBackupFileId ?? null;
        if (deleteLocalVideo(id)) {
          // Fire-and-forget Drive cleanup — local delete already succeeded
          if (driveFileId && isDriveConnected()) {
            deleteDriveFileById(driveFileId).catch(e =>
              console.warn('[delete] Drive backup cleanup failed:', e.message)
            );
          }
          return;
        }
        throw new Error('הסרטון לא נמצא באחסון מקומי (סרטוני mock לא נמחקים מקומית)');
      }
      return Video.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: toggle isSaved
export function useSaveVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isSaved }) => {
      if (!isBase44Enabled()) {
        const u = updateLocalVideo(id, { isSaved });
        if (u) return u;
        throw new Error('סרטון לא נמצא באחסון מקומי');
      }
      return Video.update(id, { isSaved });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: update learningStatus
export function useUpdateLearningStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, learningStatus }) => {
      if (!isBase44Enabled()) {
        const u = updateLocalVideo(id, { learningStatus });
        if (u) return u;
        throw new Error('סרטון לא נמצא באחסון מקומי');
      }
      return Video.update(id, { learningStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: assign topics to a video
export function useAssignTopics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, topicIds }) => {
      if (!isBase44Enabled()) {
        const u = updateLocalVideo(id, { topicIds });
        if (u) return u;
        throw new Error('סרטון לא נמצא באחסון מקומי');
      }
      return Video.update(id, { topicIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: update presentations array on a video
export function useUpdatePresentations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, presentations }) => {
      if (!isBase44Enabled()) {
        const u = updateLocalVideo(id, { presentations });
        if (u) return u;
        throw new Error('סרטון לא נמצא באחסון מקומי');
      }
      return Video.update(id, { presentations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}
