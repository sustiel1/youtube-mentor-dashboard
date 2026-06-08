// YouTube captions / transcript (on-demand only)
// Dev: Vite proxies `/api/youtube-transcript` (no browser CORS). Prod: use stored
// `video.transcript` or cache from a prior dev fetch — otherwise returns null.

import { saveSegments, hasSegments } from '@/lib/localSegmentStore';

const CACHE_LS_KEY = 'yt_mentor_transcript_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function buildTranscriptFailure(reason, diagnostics = null, transcriptStatus = "unavailable", meta = null) {
  return {
    ok: false,
    reason,
    diagnostics,
    transcriptStatus,
    body: null,
    source: meta?.source || null,
    language: meta?.language || null,
    segments: [],
  };
}

export function validateTranscriptUsable(payload) {
  const segments = Array.isArray(payload?.segments) ? payload.segments.map(normalizeSegment).filter(Boolean) : [];
  const totalChars = segments.reduce((sum, segment) => sum + String(segment.text || '').length, 0);
  const timestampedCount = segments.filter((segment) => Number.isFinite(segment.startSeconds)).length;

  if (!Array.isArray(payload?.segments)) {
    return { ok: false, reason: "Transcript לא חזר כמערך segments", segments, totalChars, timestampedCount };
  }
  if (timestampedCount === 0) {
    return { ok: false, reason: "Transcript נמצא אבל חסרים timestamps", segments, totalChars, timestampedCount };
  }
  if (segments.length === 0) {
    return { ok: false, reason: "Transcript לא מכיל segments שמישים", segments, totalChars, timestampedCount };
  }

  // Partial is allowed: >= 3 timestamped+text segments
  const usablePartial = segments.length >= 3;
  const transcriptStatus = usablePartial ? (segments.length >= 10 && totalChars >= 800 ? "full" : "partial") : "partial";
  const transcriptQuality =
    segments.length >= 25 && totalChars >= 2500 ? "high"
    : segments.length >= 10 && totalChars >= 800 ? "medium"
    : "low";

  return { ok: true, reason: null, segments, totalChars, timestampedCount, transcriptStatus, transcriptQuality, usablePartial };
}

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

function normalizeSegment(segment) {
  const startSeconds = Number(segment?.startSeconds ?? segment?.start ?? 0);
  const durationSeconds = Number(segment?.durationSeconds ?? segment?.duration ?? segment?.dur ?? 0);
  const text = String(segment?.text || '').trim();
  if (!Number.isFinite(startSeconds) || !text) return null;
  return {
    text,
    startSeconds,
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds >= 0 ? durationSeconds : 0,
    start: startSeconds,
  };
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
 * Parse YouTube srv3 XML or WEBVTT into timed segments.
 * @param {string|{body?: string, segments?: Array, lang?: string}|null} rawTranscript
 * @returns {{ lines: { text: string, startSeconds: number, durationSeconds: number, start: number }[], segments: { text: string, startSeconds: number, durationSeconds: number, start: number }[], lang: string|null }}
 */
export function parseTranscript(rawTranscript) {
  if (!rawTranscript) return { lines: [], segments: [], lang: null };

  if (typeof rawTranscript === 'object') {
    const segments = Array.isArray(rawTranscript.segments)
      ? rawTranscript.segments.map(normalizeSegment).filter(Boolean)
      : [];
    if (segments.length > 0) {
      return {
        lines: segments,
        segments,
        lang: rawTranscript.lang || null,
      };
    }
    if (typeof rawTranscript.body === 'string') {
      return parseTranscript(rawTranscript.body);
    }
    return { lines: [], segments: [], lang: rawTranscript.lang || null };
  }

  if (typeof rawTranscript !== 'string') return { lines: [], segments: [], lang: null };
  const trimmed = rawTranscript.trim();
  if (trimmed.startsWith('{') && trimmed.includes('"events"')) return parseJson3(trimmed);
  if (trimmed.startsWith('WEBVTT')) return parseWebVtt(trimmed);
  return parseSrv3Xml(trimmed);
}

function parseJson3(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    const lines = Array.isArray(data?.events)
      ? data.events.flatMap((event) => {
          const startMs = Number(event?.tStartMs);
          const durationMs = Number(event?.dDurationMs ?? 0);
          const segments = Array.isArray(event?.segs) ? event.segs : [];
          const text = segments.map((segment) => segment?.utf8 || '').join('').replace(/\s+/g, ' ').trim();
          if (!Number.isFinite(startMs) || !text) return [];
          return [{
            text,
            startSeconds: startMs / 1000,
            durationSeconds: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs / 1000 : 0,
            start: startMs / 1000,
          }];
        })
      : [];
    return { lines, segments: lines, lang: null };
  } catch {
    return { lines: [], segments: [], lang: null };
  }
}

function parseSrv3Xml(xml) {
  const lines = [];
  const seen = new Set();
  const re = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const startSeconds = parseFloat(m[1]);
    const durationSeconds = parseFloat(m[2] || '0');
    const text = (m[3] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (!Number.isFinite(startSeconds) || !text) continue;
    const key = `${startSeconds}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({
      text,
      startSeconds,
      durationSeconds: Number.isFinite(durationSeconds) && durationSeconds >= 0 ? durationSeconds : 0,
      start: startSeconds,
    });
  }

  const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  while ((m = pRe.exec(xml)) !== null) {
    const attrs = m[1] || '';
    const body = m[2] || '';
    const startMatch = attrs.match(/\b(?:t|start)="([\d.]+)"/i);
    const durMatch = attrs.match(/\b(?:d|dur)="([\d.]+)"/i);
    const rawStart = startMatch?.[1];
    const rawDuration = durMatch?.[1];
    const startSeconds = Number(rawStart) / (String(rawStart).includes('.') ? 1 : 1000);
    const durationSeconds = Number(rawDuration) / (String(rawDuration).includes('.') ? 1 : 1000);
    const text = (body || '')
      .replace(/<s\b[^>]*>/gi, '')
      .replace(/<\/s>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (!Number.isFinite(startSeconds) || !text) continue;
    const key = `${startSeconds}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({
      text,
      startSeconds,
      durationSeconds: Number.isFinite(durationSeconds) && durationSeconds >= 0 ? durationSeconds : 0,
      start: startSeconds,
    });
  }

  lines.sort((a, b) => a.startSeconds - b.startSeconds);
  return { lines, segments: lines, lang: null };
}

function parseWebVtt(vtt) {
  const lines = [];
  const blocks = vtt.split(/\n\n+/);
  const tsRe = /^(\d{1,2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{1,2}:\d{2}:\d{2}\.\d{3})/;
  for (const block of blocks) {
    const rows = block.split('\n').filter(Boolean);
    if (!rows.length) continue;
    let i = 0;
    if (/^\d+$/.test(rows[0])) i = 1;
    if (i >= rows.length) continue;
    const tm = rows[i].match(tsRe);
    if (!tm) continue;
    const start = parseVttTime(tm[1]);
    const end = parseVttTime(tm[2]);
    const text = rows.slice(i + 1).join(' ').replace(/\s+/g, ' ').trim();
    if (Number.isFinite(start) && text) {
      lines.push({
        text,
        startSeconds: start,
        durationSeconds: Number.isFinite(end) && end >= start ? end - start : 0,
        start,
      });
    }
  }
  return { lines, segments: lines, lang: null };
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

export function clearTranscriptCache(videoId) {
  if (!videoId) return false;
  const cache = readCache();
  if (!(videoId in cache)) return false;
  delete cache[videoId];
  writeCache(cache);
  return true;
}

export async function fetchTranscriptPayload(videoId) {
  if (!videoId) return null;

  const cached = readCache()[videoId];
  if (
    cached?.body &&
    typeof cached.body === 'string' &&
    cached.fetchedAt &&
    Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS
  ) {
    const parsed = parseTranscript(cached);
    if (import.meta.env.DEV) {
      console.info(`[transcript] found count=${parsed.lines.length} lang=${cached.lang || 'unknown'} source=cache`);
    }
    if (!hasSegments(videoId) && parsed.lines.length > 0) {
      saveSegments(videoId, parsed.lines);
    }
    return {
      body: cached.body,
      lang: cached.lang || null,
      segments: parsed.lines,
      fetchedAt: cached.fetchedAt,
    };
  }

  try {
    const res = await fetch(`/api/youtube-transcript?v=${encodeURIComponent(videoId)}`);
    const data = await res.json().catch(() => ({}));
    console.log(`[transcript-payload] videoId=${videoId} httpStatus=${res.status} ok=${res.ok} error=${data.error || 'none'} lang=${data.lang || 'none'} bodyLen=${typeof data.body === 'string' ? data.body.length : 'N/A'}`);
    if (!res.ok) {
      if (import.meta.env.DEV) {
        console.info(`[transcript] unavailable reason=${data.message || data.error || res.status}`);
      }
      return null;
    }

    const body = typeof data.body === 'string' ? data.body : null;
    if (!body || body.length <= 20) {
      if (import.meta.env.DEV) {
        console.info('[transcript] unavailable reason=empty-body');
      }
      return null;
    }

    console.log(`[transcript-payload] bodyPreview=${body.slice(0, 120).replace(/\n/g,' ')}`);
    const parsed = parseTranscript(data);
    const payload = {
      body,
      lang: data.lang || null,
      segments: parsed.lines,
      fetchedAt: new Date().toISOString(),
    };
    const map = readCache();
    map[videoId] = payload;
    writeCache(map);
    console.log(`[transcript-payload] parsedLines=${parsed.lines.length} lang=${payload.lang || 'unknown'}`);
    if (parsed.lines.length > 0) {
      saveSegments(videoId, parsed.lines);
    }
    if (import.meta.env.DEV) {
      console.info(`[transcript] found count=${parsed.lines.length} lang=${payload.lang || 'unknown'}`);
    }
    return payload;
  } catch {
    if (import.meta.env.DEV) {
      console.info('[transcript] unavailable reason=request-failed');
    }
    return null;
  }
}

/**
 * Fetch raw timedtext (srv3 XML) via dev proxy, or from local cache.
 * Does not run automatically.
 *
 * @param {string} videoId
 * @returns {Promise<string|null>}
 */
export async function fetchTranscript(videoId) {
  const payload = await fetchTranscriptPayload(videoId);
  return payload?.body || null;
}

export async function fetchTranscriptDiagnostics(videoId) {
  if (!videoId) return buildTranscriptFailure("Missing videoId");
  console.log("[transcript] videoId", videoId);

  try {
    const res = await fetch(`/api/youtube-transcript?v=${encodeURIComponent(videoId)}&diagnostics=1`);
    const data = await res.json().catch(() => ({}));
    const diagnostics = data?.diagnostics || null;

    if (import.meta.env.DEV) {
      console.log("[transcript] caption tracks found", diagnostics?.tracksCount ?? 0);
    }

    if (!res.ok || !data?.ok) {
      const reason = data?.reason || data?.message || data?.error || `HTTP ${res.status}`;
      console.error("[transcript] failed reason", reason);
      return buildTranscriptFailure(reason, diagnostics, "none", {
        source: data?.source || "youtube",
        language: data?.language || data?.lang || null,
      });
    }

    const segments = Array.isArray(data?.segments) ? data.segments.map(normalizeSegment).filter(Boolean) : [];
    console.log("[transcript] result segments", segments.length);
    console.log("[transcript] usable transcript length", segments.reduce((sum, segment) => sum + String(segment?.text || '').length, 0));
    return {
      ok: true,
      source: data.source || null,
      language: data.language || data.lang || null,
      body: typeof data.body === "string" ? data.body : null,
      segments,
      diagnostics,
      transcriptStatus: null,
      transcriptQuality: null,
    };
  } catch {
    const reason = "שגיאת רשת או proxy בבדיקת transcript";
    console.error("[transcript] failed reason", reason);
    return buildTranscriptFailure(reason, null, "none");
  }
}

export async function getBestTranscript(videoId) {
  const result = await fetchTranscriptDiagnostics(videoId);
  if (!result.ok) return result;

  const validation = validateTranscriptUsable(result);
  if (!validation.ok) {
    console.error("[transcript] failed reason", validation.reason);
    return buildTranscriptFailure(validation.reason, result.diagnostics, "none", {
      source: result?.source || "youtube",
      language: result?.language || null,
    });
  }

  console.log("[transcript] status", validation.transcriptStatus);
  return {
    ...result,
    ok: true,
    segments: validation.segments,
    transcriptStatus: validation.transcriptStatus,
    transcriptQuality: validation.transcriptQuality,
  };
}
