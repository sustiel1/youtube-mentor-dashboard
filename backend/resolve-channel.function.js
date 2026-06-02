/**
 * Base44 Backend Function: ResolveChannel
 *
 * Mirrors the local dev proxy so Base44 and local-first behave the same.
 * Accepts:
 *   { url?: string, handle?: string, currentChannelId?: string, forceRepair?: boolean }
 */

const UC_EXACT_RE = /^UC[\w-]{22}$/;
const YOUTUBE_BASE = 'https://www.youtube.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function normalizeYoutubeInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (UC_EXACT_RE.test(raw)) return `${YOUTUBE_BASE}/channel/${raw}`;
  if (raw.startsWith('@')) return `${YOUTUBE_BASE}/${raw}`;
  return raw;
}

function isSuspiciousChannelId(value) {
  const id = String(value || '').trim();
  return !id || !id.startsWith('UC') || id.includes('...') || id.length !== 24 || /\s/.test(id);
}

function extractChannelIdFromYoutubeHtml(html) {
  const patterns = [
    { method: 'handle_html', regex: /"channelId":"(UC[\w-]{22})"/ },
    { method: 'external_id', regex: /"externalId":"(UC[\w-]{22})"/ },
    { method: 'meta_channel_id', regex: /<meta\s+itemprop="channelId"\s+content="(UC[\w-]{22})"/i },
    { method: 'canonical', regex: /<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/i },
    { method: 'browse_id', regex: /"browseId":"(UC[\w-]{22})"/ },
    { method: 'channel_url', regex: /youtube\.com\/channel\/(UC[\w-]{22})/i },
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern.regex);
    if (match?.[1]) return { channelId: match[1], method: pattern.method };
  }
  return null;
}

async function fetchYoutubeHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
    },
  });
  const html = await response.text();
  return { response, html };
}

async function verifyYoutubeRss(channelId) {
  const rssUrl = `${YOUTUBE_BASE}/feeds/videos.xml?channel_id=${channelId}`;
  const response = await fetch(rssUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
    },
  });
  const body = await response.text();
  return {
    ok: response.ok && body.includes('<feed'),
    status: response.status,
    rssUrl,
  };
}

async function handler({ url, handle, currentChannelId, forceRepair = false }) {
  const input = url || handle || null;
  const attempts = [];

  const fail = (error) => ({ success: false, error, attempts });

  const tryResolvedId = async (channelId, method, sourceInput) => {
    const id = String(channelId || '').trim();
    const attempt = { method, input: sourceInput || id, channelId: id || null };
    console.log('[repair-channel] attempt', attempt);

    if (isSuspiciousChannelId(id)) {
      attempt.status = 'failed';
      attempt.error = 'Channel ID חשוד או לא תקין';
      attempts.push(attempt);
      return null;
    }

    const rss = await verifyYoutubeRss(id);
    attempt.rssStatus = rss.status;
    if (!rss.ok) {
      attempt.status = 'failed';
      attempt.error = 'Channel ID נמצא אבל RSS לא תקין';
      attempts.push(attempt);
      return null;
    }

    attempt.status = 'success';
    attempts.push(attempt);
    return {
      success: true,
      channelId: id,
      channelUrl: `${YOUTUBE_BASE}/channel/${id}`,
      rssUrl: rss.rssUrl,
      rssStatus: rss.status,
      method,
      attempts,
    };
  };

  try {
    if (!input && !currentChannelId) {
      return fail('חסר URL ערוץ — נדרש URL כדי לתקן אוטומטית');
    }

    if (currentChannelId && !forceRepair) {
      const direct = await tryResolvedId(currentChannelId, 'current_id', currentChannelId);
      if (direct) return direct;
    }

    const normalized = normalizeYoutubeInput(input);
    if (!normalized) return fail('חסר URL ערוץ — נדרש URL כדי לתקן אוטומטית');
    if (!/^https?:\/\//i.test(normalized)) return fail('חסר URL ערוץ. הוסף URL מלא או @handle.');

    const parsed = new URL(normalized);
    const pathname = parsed.pathname || '/';
    const directId = pathname.match(/\/channel\/(UC[\w-]{22})/i)?.[1];

    if (directId) {
      const direct = await tryResolvedId(directId, 'channel_url', normalized);
      if (direct) return direct;
    }

    const fallbackMethod =
      pathname.startsWith('/@') ? 'handle_html'
      : pathname.startsWith('/c/') || pathname.startsWith('/user/') ? 'canonical'
      : 'youtube_html';

    const { response, html } = await fetchYoutubeHtml(normalized);
    if (!response.ok) {
      const attempt = {
        method: fallbackMethod,
        input: normalized,
        status: 'failed',
        error: `YouTube returned ${response.status}`,
      };
      console.log('[repair-channel] attempt', attempt);
      attempts.push(attempt);
      return fail('לא הצלחתי למצוא Channel ID תקין');
    }

    const extracted = extractChannelIdFromYoutubeHtml(html);
    if (!extracted?.channelId) {
      const attempt = {
        method: fallbackMethod,
        input: normalized,
        status: 'failed',
        error: 'לא נמצא Channel ID ב-HTML של הערוץ',
      };
      console.log('[repair-channel] attempt', attempt);
      attempts.push(attempt);
      return fail('לא הצלחתי למצוא Channel ID תקין');
    }

    const verified = await tryResolvedId(extracted.channelId, extracted.method || fallbackMethod, normalized);
    if (verified) return verified;

    return fail('לא הצלחתי למצוא Channel ID תקין');
  } catch (error) {
    const attempt = {
      method: 'resolver_exception',
      input: input || currentChannelId || null,
      status: 'failed',
      error: error?.message || 'Resolve failed',
    };
    console.log('[repair-channel] attempt', attempt);
    attempts.push(attempt);
    console.error('[repair-channel] failed', error);
    return fail(error?.message || 'Resolve failed');
  }
}

module.exports = { handler };
