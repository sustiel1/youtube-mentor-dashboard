// ─── YouTube captions / transcript (on-demand only) ─────────────────────────
// Dev: Vite proxies `/api/youtube-transcript` (no browser CORS). Prod: use stored
// `video.transcript` or cache from a prior dev fetch — otherwise returns null.

const CACHE_LS_KEY = 'yt_mentor_transcript_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(map) {
  try {
    localStorage.setItem(CACHE_LS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Whether we already have a cached transcript body for this video (24h).
 * @param {string} videoId
 */
export function hasTranscript(videoId) {
  if (!videoId) return false;
  const e = readCache()[videoId];
  if (!e?.body || typeof e.body !== 'string' || e.body.length < 30) return false;
  if (!e.fetchedAt) return false;
  return Date.now() - new Date(e.fetchedAt).getTime() < CACHE_TTL_MS;
}

/**
 * Parse YouTube srv3 XML or WEBVTT into timed lines.
 * @param {string|null} rawTranscript
 * @returns {{ lines: { start: number, text: string }[] }}
 */
export function parseTranscript(rawTranscript) {
  if (!rawTranscript || typeof rawTranscript !== 'string') return { lines: [] };
  const t = rawTranscript.trim();
  if (t.startsWith('WEBVTT')) return parseWebVtt(t);
  return parseSrv3Xml(t);
}

function parseSrv3Xml(xml) {
  const lines = [];
  const re = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const start = parseFloat(m[1]);
    const inner = (m[3] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (!Number.isFinite(start) || !inner) continue;
    lines.push({ start, text: inner });
  }
  lines.sort((a, b) => a.start - b.start);
  return { lines };
}

function parseWebVtt(vtt) {
  const lines = [];
  const blocks = vtt.split(/\n\n+/);
  const tsRe = /^(\d{1,2}:\d{2}:\d{2}\.\d{3})\s+-->\s+/;
  for (const block of blocks) {
    const rows = block.split('\n').filter(Boolean);
    if (!rows.length) continue;
    let i = 0;
    if (/^\d+$/.test(rows[0])) i = 1;
    if (i >= rows.length) continue;
    const tm = rows[i].match(tsRe);
    if (!tm) continue;
    const start = parseVttTime(tm[1]);
    const text = rows.slice(i + 1).join(' ').replace(/\s+/g, ' ').trim();
    if (Number.isFinite(start) && text) lines.push({ start, text });
  }
  return { lines };
}

function parseVttTime(s) {
  const p = s.split(':');
  if (p.length !== 3) return NaN;
  const h = parseInt(p[0], 10);
  const m = parseInt(p[1], 10);
  const sec = parseFloat(p[2]);
  if ([h, m, sec].some((x) => Number.isNaN(x))) return NaN;
  return h * 3600 + m * 60 + sec;
}

/**
 * Fetch raw timedtext (srv3 XML) via dev proxy, or from local cache.
 * Does not run automatically.
 *
 * @param {string} videoId
 * @returns {Promise<string|null>}
 */
export async function fetchTranscript(videoId) {
  if (!videoId) return null;

  const cached = readCache()[videoId];
  if (
    cached?.body &&
    typeof cached.body === 'string' &&
    cached.fetchedAt &&
    Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS
  ) {
    return cached.body;
  }

  let raw = null;
  try {
    const res = await fetch(`/api/youtube-transcript?v=${encodeURIComponent(videoId)}`);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      raw = typeof data.body === 'string' ? data.body : null;
    }
  } catch {
    raw = null;
  }

  if (raw && raw.length > 20) {
    const map = readCache();
    map[videoId] = { body: raw, fetchedAt: new Date().toISOString() };
    writeCache(map);
    return raw;
  }

  return null;
}
