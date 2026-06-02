import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateStoredVideo } from '@/services/videoStorage';

const STORAGE_KEY = 'yt_mentor_videos_v2';

function readFromStorage(videoId) {
  if (!videoId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).find(v => v.id === videoId) ?? null;
  } catch {
    return null;
  }
}

/**
 * Single source of truth for a video being viewed/edited.
 *
 * - Initializes from localStorage; falls back to seedVideo (e.g. from React Query cache).
 * - patch(updates) writes to localStorage, updates local state, and invalidates the
 *   ['videos'] query so the list view stays in sync.
 * - setVideo lets callers inject a known-fresh value (e.g. after a Base44 mutation).
 * - Re-syncs from storage when videoId changes (new video selected).
 */
export function usePersistedVideo(videoId, seedVideo) {
  const [currentVideo, setCurrentVideo] = useState(() =>
    readFromStorage(videoId) ?? seedVideo ?? null
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!videoId) { setCurrentVideo(null); return; }
    setCurrentVideo(readFromStorage(videoId) ?? seedVideo ?? null);
  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((updates) => {
    if (!videoId) return null;
    const saved = updateStoredVideo(videoId, updates);
    if (saved) {
      setCurrentVideo(saved);
    } else {
      setCurrentVideo(prev => ({ ...(prev ?? {}), ...updates }));
    }
    queryClient.invalidateQueries({ queryKey: ['videos'] });
    return saved;
  }, [videoId, queryClient]);

  return { video: currentVideo, patch, setVideo: setCurrentVideo };
}
