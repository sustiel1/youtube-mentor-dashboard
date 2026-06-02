import { useState, useCallback, useEffect } from 'react';
import {
  THUMBNAIL_CHAIN,
  getThumbnailUrl,
  isYouTubePlaceholder,
  getCachedThumbnail,
  setCachedThumbnail,
  clearCachedThumbnail,
} from '@/lib/thumbnailFallback';

/**
 * Manages the full YouTube thumbnail fallback chain:
 *   maxresdefault → hqdefault → sddefault → mqdefault → default → null (friendly placeholder)
 *
 * Also detects the YouTube gray 120×90 placeholder on load and skips past it.
 * Caches the working quality in localStorage to avoid repeated fallbacks.
 *
 * @param {{ youtubeId?: string, storedUrl?: string }} param0
 */
export function useThumbnailFallback({ youtubeId, storedUrl }) {
  const getInitialState = () => {
    if (!youtubeId) return { idx: 0, url: storedUrl || null, status: storedUrl ? 'loading' : 'failed' };
    const cached = getCachedThumbnail(youtubeId);
    if (cached?.quality) {
      const idx = THUMBNAIL_CHAIN.indexOf(cached.quality);
      return { idx: idx >= 0 ? idx : 0, url: cached.url, status: 'loading' };
    }
    return { idx: 0, url: storedUrl || getThumbnailUrl(youtubeId, 'maxresdefault'), status: 'loading' };
  };

  const initial = getInitialState();
  const [qualityIdx, setQualityIdx] = useState(initial.idx);
  const [currentUrl, setCurrentUrl] = useState(initial.url);
  const [status, setStatus] = useState(initial.status);
  const [lastFetchAt, setLastFetchAt] = useState(() => {
    if (!youtubeId) return null;
    const cached = getCachedThumbnail(youtubeId);
    return cached?.at || null;
  });

  // When youtubeId changes (different video opened), reset to the correct state
  useEffect(() => {
    const s = getInitialState();
    setQualityIdx(s.idx);
    setCurrentUrl(s.url);
    setStatus(s.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  const tryNext = useCallback(
    (fromIdx) => {
      const nextIdx = fromIdx + 1;
      if (!youtubeId || nextIdx >= THUMBNAIL_CHAIN.length) {
        setStatus('failed');
        setCurrentUrl(null);
        return;
      }
      const quality = THUMBNAIL_CHAIN[nextIdx];
      setQualityIdx(nextIdx);
      setCurrentUrl(getThumbnailUrl(youtubeId, quality));
      setStatus('loading');
    },
    [youtubeId],
  );

  const handleError = useCallback(() => {
    tryNext(qualityIdx);
  }, [qualityIdx, tryNext]);

  const handleLoad = useCallback(
    (e) => {
      const img = e.currentTarget;
      // Detect the YouTube gray 120×90 placeholder served for missing maxresdefault
      if (isYouTubePlaceholder(img) && qualityIdx < THUMBNAIL_CHAIN.length - 1) {
        tryNext(qualityIdx);
        return;
      }
      const now = Date.now();
      setStatus('ok');
      setLastFetchAt(now);
      if (youtubeId) setCachedThumbnail(youtubeId, THUMBNAIL_CHAIN[qualityIdx]);
    },
    [qualityIdx, youtubeId, tryNext],
  );

  const refresh = useCallback(() => {
    if (!youtubeId) return;
    clearCachedThumbnail(youtubeId);
    setQualityIdx(0);
    setCurrentUrl(getThumbnailUrl(youtubeId, 'maxresdefault'));
    setStatus('loading');
    setLastFetchAt(null);
  }, [youtubeId]);

  return {
    src: currentUrl,
    status,          // 'loading' | 'ok' | 'failed'
    onError: handleError,
    onLoad: handleLoad,
    refresh,
    diagnostics: {
      url: currentUrl,
      quality: THUMBNAIL_CHAIN[qualityIdx] ?? null,
      status,
      lastFetchAt,
    },
  };
}
