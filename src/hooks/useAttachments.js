// ─── useAttachments ───────────────────────────────────────────────────────────
// TanStack Query wrappers around the IndexedDB attachment store.
// Provides a consistent hook API for reading / writing video screenshots.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAttachmentsByVideoId,
  saveAttachment,
  deleteAttachment,
  fileToDataUrl,
} from '@/lib/attachmentStore';

// Fetch all attachments for a specific video
export function useAttachments(videoId) {
  return useQuery({
    queryKey: ['attachments', videoId],
    queryFn: () => getAttachmentsByVideoId(videoId),
    enabled: !!videoId,
    // On IndexedDB failure (private browsing etc.) — return empty array, don't crash
    placeholderData: [],
    retry: false,
  });
}

// Upload a File and save it as an attachment linked to videoId
export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ videoId, file }) => {
      const dataUrl = await fileToDataUrl(file);
      return saveAttachment({ videoId, name: file.name, type: file.type, dataUrl });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', data.videoId] });
    },
  });
}

// Delete an attachment by id
export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => deleteAttachment(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', variables.videoId] });
    },
  });
}
