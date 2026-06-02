import { base44 } from '@/api/base44Client';
import { isBase44Enabled } from '@/config/base44Flags';

const UC_RE = /^UC[\w-]{22}$/;

function isShortOrInvalidChannelId(channelId) {
  const id = String(channelId || '').trim();
  return !id || id.includes('...') || id.length < 24 || !id.startsWith('UC');
}

function buildRssCheckResult({
  ok = false,
  channelId = '',
  rssUrl = '',
  status = 0,
  errorType = null,
  detail = null,
  videosCount = null,
  needsRepair = false,
  needsProxy = false,
}) {
  return {
    ok,
    channelId,
    rssUrl,
    status,
    errorType,
    detail,
    videosCount,
    needsRepair,
    needsProxy,
  };
}

function classifyBrowserFetchError(message) {
  const text = String(message || '').toLowerCase();
  if (text.includes('failed to fetch') || text.includes('network') || text.includes('cors')) {
    return {
      status: 0,
      errorType: 'needs_proxy',
      detail: 'שגיאת רשת או CORS — צריך proxy/backend לבדיקת RSS',
      needsProxy: true,
      needsRepair: false,
    };
  }
  return {
    status: 0,
    errorType: 'network_error',
    detail: message || 'שגיאת רשת',
    needsProxy: true,
    needsRepair: false,
  };
}

function classifyProxyPayload(channelId, rssUrl, payload = {}, fallbackStatus = 0) {
  const status = Number(payload?.status || fallbackStatus || 0);
  const errorType = payload?.errorType || null;
  const videosCount = Number.isFinite(Number(payload?.videosCount)) ? Number(payload.videosCount) : null;

  if (payload?.success && status === 200) {
    return buildRssCheckResult({
      ok: true,
      channelId,
      rssUrl: payload?.rssUrl || rssUrl,
      status,
      errorType: null,
      detail: null,
      videosCount,
      needsRepair: false,
      needsProxy: false,
    });
  }

  if (status === 404) {
    return buildRssCheckResult({
      ok: false,
      channelId,
      rssUrl: payload?.rssUrl || rssUrl,
      status,
      errorType: 'not_found',
      detail: 'RSS 404 — ייתכן שה-Channel ID לא תקין או שהערוץ לא זמין ב-RSS',
      videosCount,
      needsRepair: true,
      needsProxy: false,
    });
  }

  if (status >= 500) {
    return buildRssCheckResult({
      ok: false,
      channelId,
      rssUrl: payload?.rssUrl || rssUrl,
      status,
      errorType: 'temporary_error',
      detail: 'YouTube החזיר 500 — זו כנראה תקלה זמנית או חסימה, לא בהכרח ID שגוי',
      videosCount,
      needsRepair: false,
      needsProxy: false,
    });
  }

  if (errorType === 'needs_proxy' || errorType === 'network_error') {
    return buildRssCheckResult({
      ok: false,
      channelId,
      rssUrl: payload?.rssUrl || rssUrl,
      status,
      errorType,
      detail: payload?.error || 'בדיקת RSS מהדפדפן עלולה להיכשל בגלל CORS. יש להעביר דרך backend/proxy.',
      videosCount,
      needsRepair: false,
      needsProxy: true,
    });
  }

  return buildRssCheckResult({
    ok: false,
    channelId,
    rssUrl: payload?.rssUrl || rssUrl,
    status,
    errorType: errorType || 'unknown_error',
    detail: payload?.error || `HTTP ${status || 0}`,
    videosCount,
    needsRepair: false,
    needsProxy: status === 0,
  });
}

export async function checkChannelRssFeed(channelId) {
  const id = String(channelId || '').trim();
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;

  console.log('[rss-check] channelId', id);
  console.log('[rss-check] url', rssUrl);

  if (isShortOrInvalidChannelId(id)) {
    return buildRssCheckResult({
      ok: false,
      channelId: id,
      rssUrl,
      status: 0,
      errorType: 'invalid_channel_id',
      detail: 'Channel ID חסר או מקוצר',
      needsRepair: true,
      needsProxy: false,
    });
  }

  if (isBase44Enabled() && base44) {
    try {
      const result = await base44.functions.FetchRss({ channelId: id });
      if (result?.xml && typeof result.xml === 'string' && result.xml.includes('<feed')) {
        const videosCount = (result.xml.match(/<entry>/g) || []).length;
        return buildRssCheckResult({
          ok: true,
          channelId: id,
          rssUrl,
          status: 200,
          errorType: null,
          detail: null,
          videosCount,
          needsRepair: false,
          needsProxy: false,
        });
      }
    } catch {
      // fall through to local proxy
    }
  }

  try {
    const res = await fetch(`/api/youtube/rss/check?channelId=${encodeURIComponent(id)}`);
    const payload = await res.json().catch(() => ({}));
    return classifyProxyPayload(id, rssUrl, payload, res.status);
  } catch (error) {
    const classified = classifyBrowserFetchError(error?.message);
    return buildRssCheckResult({
      ok: false,
      channelId: id,
      rssUrl,
      ...classified,
    });
  }
}
