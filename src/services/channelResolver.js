// Production-safe Channel ID repair flow.
// All network access goes through local proxy endpoints to avoid browser CORS issues.

import { checkChannelRssFeed } from './rssFeedHealth';

const UC_RE = /^UC[\w-]{22}$/;

export function isValidChannelId(id) {
  const value = String(id || '').trim();
  return UC_RE.test(value) && !value.includes('...') && !/\s/.test(value);
}

export function isSuspiciousChannelId(id) {
  const value = String(id || '').trim();
  return !isValidChannelId(value);
}

export function buildCanonicalChannelUrl(channelId) {
  return isValidChannelId(channelId) ? `https://www.youtube.com/channel/${channelId}` : null;
}

function extractHandleFromUrl(url) {
  const match = String(url || '').match(/\/@([^/?#]+)/);
  return match ? `@${match[1]}` : null;
}

function buildRepairInput({ channelUrl, handle, currentChannelId }) {
  if (channelUrl) return channelUrl;
  if (handle) return handle.startsWith('@') ? handle : `@${handle}`;
  if (currentChannelId && isValidChannelId(currentChannelId)) return currentChannelId;
  return null;
}

async function callResolverProxy({ input, currentChannelId, forceRepair = false }) {
  const params = new URLSearchParams();
  if (input) params.set('url', input);
  if (currentChannelId) params.set('currentChannelId', currentChannelId);
  if (forceRepair) params.set('forceRepair', 'true');

  const res = await fetch(`/api/youtube/resolve-channel?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function repairChannelId({
  mentor,
  channelUrl = null,
  handle = null,
  forceRepair = false,
}) {
  const mentorName = mentor?.name || 'unknown';
  const currentChannelId = mentor?.youtubeChannelId || mentor?.channelId || null;
  const derivedHandle = handle || extractHandleFromUrl(channelUrl) || mentor?.handle || null;
  const input = buildRepairInput({ channelUrl, handle: derivedHandle, currentChannelId });

  console.log('[repair-channel] start', {
    mentor: mentorName,
    currentChannelId,
    channelUrl,
    handle: derivedHandle,
    forceRepair,
  });

  if (!channelUrl && !derivedHandle && !currentChannelId) {
    return {
      success: false,
      channelId: null,
      channelUrl: null,
      youtubeUrl: null,
      rssUrl: null,
      rssStatus: 0,
      method: null,
      error: 'חסר URL ערוץ — נדרש URL כדי לתקן אוטומטית',
      attempts: [],
    };
  }

  if (!channelUrl && !derivedHandle && currentChannelId && !forceRepair) {
    const rss = await checkChannelRssFeed(currentChannelId);
    if (rss.ok) {
      return {
        success: true,
        channelId: currentChannelId,
        channelUrl: buildCanonicalChannelUrl(currentChannelId),
        youtubeUrl: buildCanonicalChannelUrl(currentChannelId),
        rssUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${currentChannelId}`,
        rssStatus: rss.status,
        method: 'current_id',
        error: null,
        attempts: [{
          method: 'current_id',
          input: currentChannelId,
          status: 'success',
          rssStatus: rss.status,
        }],
      };
    }
    if (!rss.needsRepair) {
      return {
        success: false,
        channelId: currentChannelId,
        channelUrl: buildCanonicalChannelUrl(currentChannelId),
        youtubeUrl: buildCanonicalChannelUrl(currentChannelId),
        rssUrl: rss.rssUrl,
        rssStatus: rss.status,
        method: 'current_id',
        error: rss.detail,
        attempts: [{
          method: 'current_id',
          input: currentChannelId,
          status: 'failed',
          rssStatus: rss.status,
          error: rss.detail,
        }],
      };
    }
  }

  if (!channelUrl && !derivedHandle) {
    return {
      success: false,
      channelId: null,
      channelUrl: null,
      youtubeUrl: null,
      rssUrl: null,
      rssStatus: 0,
      method: null,
      error: 'חסר URL ערוץ. הוסף URL מלא או @handle.',
      attempts: [],
    };
  }

  const proxy = await callResolverProxy({ input, currentChannelId, forceRepair });
  for (const attempt of proxy.data?.attempts || []) {
    console.log('[repair-channel] attempt', attempt);
  }
  if (!proxy.ok || !proxy.data?.success) {
    const error = proxy.data?.error || 'לא הצלחתי למצוא Channel ID תקין';
    console.error('[repair-channel] failed', { mentor: mentorName, error, attempts: proxy.data?.attempts || [] });
    return {
      success: false,
      channelId: null,
      channelUrl: null,
      youtubeUrl: null,
      rssUrl: null,
      rssStatus: proxy.data?.status || proxy.status || 0,
      method: null,
      error,
      attempts: proxy.data?.attempts || [],
    };
  }

  const result = proxy.data;
  console.log('[repair-channel] success', result);
  return {
    success: true,
    channelId: result.channelId,
    channelUrl: result.channelUrl || buildCanonicalChannelUrl(result.channelId),
    youtubeUrl: result.channelUrl || buildCanonicalChannelUrl(result.channelId),
    rssUrl: result.rssUrl,
    rssStatus: result.rssStatus,
    method: result.method,
    error: null,
    attempts: result.attempts || [],
  };
}
