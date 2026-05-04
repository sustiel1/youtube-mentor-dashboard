// ─── YouTube channel RSS health check ──────────────────────────────────────────
// Used by Admin → RSS to verify feeds before showing "מוכן" or pulling videos.
// Prod: Base44 FetchRss. Dev: Vite `/api/rss` proxy (same as rssIngestion).

import { base44 } from '@/api/base44Client';

/**
 * HEAD-like check: fetch feed XML and verify it looks like a valid Atom feed.
 *
 * @param {string} channelId — UC… 24 chars
 * @returns {Promise<{ ok: boolean, status: number, detail: string | null }>}
 */
export async function checkChannelRssFeed(channelId) {
  if (!channelId || typeof channelId !== 'string') {
    return { ok: false, status: 0, detail: 'חסר Channel ID' };
  }
  const id = channelId.trim();
  if (!id.startsWith('UC') || id.length !== 24) {
    return { ok: false, status: 0, detail: 'פורמט Channel ID לא תקין' };
  }

  let xml = null;
  let httpStatus = 0;

  try {
    const result = await base44.functions.FetchRss({ channelId: id });
    if (result?.xml && typeof result.xml === 'string') {
      xml = result.xml;
      httpStatus = 200;
    }
  } catch {
    // fall through to dev proxy
  }

  if (!xml) {
    try {
      const res = await fetch(`/api/rss?channelId=${encodeURIComponent(id)}`);
      httpStatus = res.status;
      xml = await res.text();
      if (!res.ok) {
        return {
          ok:     false,
          status: httpStatus,
          detail: `HTTP ${httpStatus}`,
        };
      }
    } catch (e) {
      return { ok: false, status: 0, detail: e?.message || 'שגיאת רשת' };
    }
  }

  const trimmed = (xml || '').trim();
  if (!trimmed.includes('<feed')) {
    return { ok: false, status: httpStatus || 500, detail: 'תגובה לא תקינה (אין feed)' };
  }
  if (trimmed.includes('<parsererror') || trimmed.length < 80) {
    return { ok: false, status: httpStatus || 500, detail: 'XML לא תקין' };
  }

  return { ok: true, status: httpStatus || 200, detail: null };
}
