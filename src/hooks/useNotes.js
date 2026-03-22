import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Note } from '@/api/entities';
import { NOTES } from '@/data/mockData';
import { getNotesByVideoId, createLocalNote, deleteLocalNote } from '@/lib/localNoteStore';

// Fetch notes for a specific video
// Priority: Base44 → localStorage (offline-created notes) → mockData
export function useNotesByVideo(videoId) {
  return useQuery({
    queryKey: ['notes', 'video', videoId],
    queryFn: async () => {
      try {
        const data = await Note.filter({ videoId });
        return data ?? [];
      } catch {
        const local = getNotesByVideoId(videoId);
        if (local.length > 0) return local;
        return NOTES.filter((n) => n.videoId === videoId);
      }
    },
    enabled: !!videoId,
  });
}

// Fetch notes for a specific topic (topic-level notes, not per-video)
export function useNotesByTopic(topicId) {
  return useQuery({
    queryKey: ['notes', 'topic', topicId],
    queryFn: async () => {
      try {
        const data = await Note.filter({ topicId });
        return (data ?? []).filter((n) => !n.videoId);
      } catch (error) {
        console.warn('[useNotes] Base44 unavailable — using mock data:', error.message);
        return NOTES.filter((n) => n.topicId === topicId && !n.videoId);
      }
    },
    enabled: !!topicId,
  });
}

// Mutation: create a note (supports both videoId and topicId)
// Falls back to localStorage when Base44 is unavailable
export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ videoId, topicId, content, timestampSeconds, timestampLabel }) => {
      try {
        return await Note.create({
          videoId: videoId || null,
          topicId: topicId || null,
          content,
          ...(timestampSeconds != null && { timestampSeconds, timestampLabel }),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Base44 unavailable — persist locally (only for video notes)
        if (videoId) return createLocalNote({ videoId, content, timestampSeconds, timestampLabel });
        throw new Error('שמירת הערת נושא נכשלה — Base44 לא זמין');
      }
    },
    onSuccess: (_data, variables) => {
      if (variables.videoId) {
        queryClient.invalidateQueries({ queryKey: ['notes', 'video', variables.videoId] });
      }
      if (variables.topicId) {
        queryClient.invalidateQueries({ queryKey: ['notes', 'topic', variables.topicId] });
      }
    },
  });
}

// Mutation: update a note
export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }) =>
      Note.update(id, {
        content,
        updatedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

// Mutation: delete a note
// Falls back to localStorage deletion when Base44 is unavailable
export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      try {
        return await Note.delete(id);
      } catch {
        deleteLocalNote(id);
      }
    },
    onSuccess: (_data, variables) => {
      // Invalidate all notes queries — videoId may not be available here
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}
