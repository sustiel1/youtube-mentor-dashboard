import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Note } from '@/api/entities';
import { isBase44Enabled } from '@/config/base44Flags';
import {
  getNotesByVideoId,
  createLocalNote,
  deleteLocalNote,
  updateLocalNote,
} from '@/lib/localNoteStore';

const _SESSION_KEY = '_yt_note_entity_missing';

let _missing = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(_SESSION_KEY) === '1';
let _checkDone = _missing;
let _checkPromise = null;

function isEntityMissing(error) {
  return (
    error?.response?.status === 404 ||
    String(error?.message || '').toLowerCase().includes('not found')
  );
}

function markMissing() {
  _missing = true;
  _checkDone = true;
  try {
    sessionStorage.setItem(_SESSION_KEY, '1');
  } catch {}
}

async function checkNoteEntity() {
  if (_checkDone) return _missing;
  if (!_checkPromise) {
    _checkPromise = Note.filter({ videoId: '__schema_check__' })
      .then(() => false)
      .catch((err) => {
        if (isEntityMissing(err)) {
          markMissing();
          return true;
        }
        return false;
      })
      .finally(() => {
        _checkDone = true;
        _checkPromise = null;
      });
  }
  return _checkPromise;
}

export function useNotesByVideo(videoId) {
  return useQuery({
    queryKey: ['notes', 'video', videoId],
    queryFn: async () => {
      if (!isBase44Enabled()) {
        return getNotesByVideoId(videoId);
      }
      if (_missing) return getNotesByVideoId(videoId);
      const missing = await checkNoteEntity();
      if (missing) return getNotesByVideoId(videoId);
      try {
        return (await Note.filter({ videoId })) ?? [];
      } catch (err) {
        if (isEntityMissing(err)) markMissing();
        return getNotesByVideoId(videoId);
      }
    },
    enabled: !!videoId,
    retry: false,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useNotesByTopic(topicId) {
  return useQuery({
    queryKey: ['notes', 'topic', topicId],
    queryFn: async () => {
      if (!isBase44Enabled()) {
        return [];
      }
      if (_missing) return [];
      try {
        const data = await Note.filter({ topicId });
        return (data ?? []).filter((n) => !n.videoId);
      } catch (err) {
        if (isEntityMissing(err)) markMissing();
        return [];
      }
    },
    enabled: !!topicId,
    retry: false,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ videoId, topicId, content, timestampSeconds, timestampLabel, images }) => {
      if (!isBase44Enabled()) {
        if (videoId) {
          return createLocalNote({ videoId, content, timestampSeconds, timestampLabel, images });
        }
        throw new Error('מצב local-first: הערות נושא מחוץ-וידאו אינן נתמכות מקומית');
      }
      try {
        return await Note.create({
          videoId: videoId || null,
          topicId: topicId || null,
          content,
          ...(timestampSeconds != null && { timestampSeconds, timestampLabel }),
          ...(Array.isArray(images) && images.length > 0 && { images }),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        if (videoId) return createLocalNote({ videoId, content, timestampSeconds, timestampLabel, images });
        throw new Error('שמירת הערת נושא נכשלה — Base44 לא זמין');
      }
    },
    onSuccess: (_data, variables) => {
      if (variables.videoId) queryClient.invalidateQueries({ queryKey: ['notes', 'video', variables.videoId] });
      if (variables.topicId) queryClient.invalidateQueries({ queryKey: ['notes', 'topic', variables.topicId] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }) => {
      if (!isBase44Enabled()) {
        const u = updateLocalNote(id, { content });
        if (u) return u;
        throw new Error('הערה לא נמצאה מקומית');
      }
      return Note.update(id, { content, updatedAt: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      if (!isBase44Enabled()) {
        deleteLocalNote(id);
        return;
      }
      try {
        return await Note.delete(id);
      } catch {
        deleteLocalNote(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}
