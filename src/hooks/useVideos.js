import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video } from '@/api/entities';
import { VIDEOS } from '@/data/mockData';
import { getLocalVideos, hasLocalVideos, saveLocalVideo, updateLocalVideo } from '@/lib/localVideoStore';

// Fetch all videos — priority chain:
//   1. Base44 (when connected)
//   2. localStorage — real ingested videos
//   3. mockData — only when localStorage is also empty
export function useVideos() {
  return useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      try {
        const data = await Video.list('-publishedAt');
        return data ?? [];
      } catch {
        const local = getLocalVideos();
        if (local.length > 0) {
          console.info(`[useVideos] Base44 unavailable — using ${local.length} local videos`);
          return [...local].sort((a, b) =>
            new Date(b.publishedAt) - new Date(a.publishedAt)
          );
        }
        console.warn('[useVideos] Base44 unavailable — using mock data');
        return VIDEOS;
      }
    },
  });
}

// Fetch a single video by id
export function useVideo(videoId) {
  return useQuery({
    queryKey: ['videos', videoId],
    queryFn: async () => {
      try {
        const all = await Video.list('-publishedAt');
        return all.find((v) => v.id === videoId) ?? null;
      } catch {
        return VIDEOS.find((v) => v.id === videoId) ?? null;
      }
    },
    enabled: !!videoId,
  });
}

// Mutation: update a video's status (and optionally other fields)
export function useUpdateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => Video.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: update transcript
export function useUpdateTranscript() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, transcript }) => Video.update(id, { transcript }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: update summary fields
// Falls back to localStorage when Base44 is unavailable
export function useUpdateSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, shortSummary, fullSummary, keyPoints, tags }) => {
      try {
        return await Video.update(id, { shortSummary, fullSummary, keyPoints, tags, status: 'done' });
      } catch {
        const updated = updateLocalVideo(id, { shortSummary, fullSummary, keyPoints, tags, status: 'done' });
        if (!updated) throw new Error('סרטון לא נמצא ב-localStorage');
        return updated;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: create a new video record
// Falls back to localStorage when Base44 is unavailable
export function useCreateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (videoData) => {
      try {
        return await Video.create(videoData);
      } catch {
        // Base44 unavailable — persist to localStorage instead
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

// Mutation: toggle isSaved
export function useSaveVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isSaved }) => Video.update(id, { isSaved }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: update learningStatus
export function useUpdateLearningStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, learningStatus }) => Video.update(id, { learningStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: assign topics to a video
export function useAssignTopics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, topicIds }) => Video.update(id, { topicIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: update presentations array on a video
export function useUpdatePresentations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, presentations }) => Video.update(id, { presentations }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}
