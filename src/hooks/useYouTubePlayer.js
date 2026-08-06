import { useCallback, useEffect, useRef, useState } from 'react';

let youtubeApiPromise = null;

function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('window-unavailable'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('youtube-api-unavailable'));
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('youtube-api-load-failed'));
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

export function useYouTubePlayer(videoId, { playOnSeek = true } = {}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const activeVideoIdRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  const queueSeek = useCallback((seconds) => {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return false;
    pendingSeekRef.current = value;
    return true;
  }, []);

  const seekTo = useCallback((seconds) => {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return false;
    if (!playerRef.current?.seekTo || !isReady) return queueSeek(value);
    playerRef.current.seekTo(value, true);
    if (playOnSeek) playerRef.current.playVideo?.();
    return true;
  }, [isReady, playOnSeek, queueSeek]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setIsReady(false);

    if (!videoId) {
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      activeVideoIdRef.current = null;
      return undefined;
    }

    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      if (playerRef.current && activeVideoIdRef.current !== videoId) {
        playerRef.current.cueVideoById?.(videoId);
        activeVideoIdRef.current = videoId;
        setIsReady(true);
        return;
      }
      if (playerRef.current) return;

      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1, enablejsapi: 1 },
        events: {
          onReady(event) {
            if (cancelled) return;
            activeVideoIdRef.current = videoId;
            setIsReady(true);
            if (pendingSeekRef.current != null) {
              const pending = pendingSeekRef.current;
              pendingSeekRef.current = null;
              event.target.seekTo(pending, true);
              if (playOnSeek) event.target.playVideo?.();
            }
          },
          onError(event) {
            if (!cancelled) setError(`youtube-player-${event?.data ?? 'error'}`);
          },
        },
      });
    }).catch((reason) => {
      if (!cancelled) setError(reason?.message || 'youtube-player-unavailable');
    });

    return () => {
      cancelled = true;
    };
  }, [videoId, playOnSeek]);

  useEffect(() => () => {
    try { playerRef.current?.destroy?.(); } catch {}
    playerRef.current = null;
    activeVideoIdRef.current = null;
    pendingSeekRef.current = null;
  }, []);

  return { containerRef, playerRef, isReady, error, seekTo, queueSeek };
}
