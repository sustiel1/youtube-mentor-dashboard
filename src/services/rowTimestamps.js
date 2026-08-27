import { isBase44Enabled } from '@/config/base44Flags';
import { getSegments } from '@/lib/localSegmentStore';
import { parseTimedTranscriptSegments } from '@/lib/timedNarrativeEvidenceGate';
import { buildRowTimestampRequestPayload } from '@/lib/rowTimestampAnnotation';
import { getVideoIdFromUrl } from '@/services/youtubeMetadata';
import { validateTranscriptUsable } from '@/services/youtubeTranscript';

const REQUEST_TIMEOUT_MS = 600_000;
export const ROW_TRANSCRIPT_TIMEOUT_MS = 45_000;

function formatTimedSegments(segments) {
  if (!Array.isArray(segments)) return '';
  return segments
    .map((segment) => {
      if (!segment || typeof segment !== 'object') return null;
      const startSeconds = Number(segment.startSeconds ?? segment.start);
      const text = String(segment.text || segment.content || '').trim();
      if (!Number.isFinite(startSeconds) || startSeconds < 0 || !text) return null;
      return `[${startSeconds}] ${text}`;
    })
    .filter(Boolean)
    .join('\n');
}

function acceptTimedText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return parseTimedTranscriptSegments(text).length > 0 ? text : '';
}

export function resolveRowTimestampYoutubeId(video, explicitYoutubeId = null) {
  return [
    explicitYoutubeId,
    video?.youtubeId,
    video?.videoId,
    getVideoIdFromUrl(video?.url),
  ].find((value) => typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value)) || null;
}

export function buildRowTimestampTranscript(video, savedAnalysis = null, explicitYoutubeId = null) {
  const candidates = [
    formatTimedSegments(video?.transcriptSegments),
    formatTimedSegments(video?.storedTranscriptSegments),
    formatTimedSegments(video?.segments),
    formatTimedSegments(video?.transcript_segments),
    acceptTimedText(video?.transcriptText),
    acceptTimedText(video?.transcript),
    acceptTimedText(video?.manualTranscript),
    formatTimedSegments(savedAnalysis?.transcriptSegments),
    acceptTimedText(savedAnalysis?.transcript),
    acceptTimedText(savedAnalysis?.manualTranscript),
  ].filter(Boolean);

  const youtubeId = resolveRowTimestampYoutubeId(video, explicitYoutubeId);
  if (youtubeId) {
    const stored = formatTimedSegments(getSegments(youtubeId));
    if (stored) candidates.push(stored);
  }

  return candidates.reduce((best, candidate) => {
    const bestCount = parseTimedTranscriptSegments(best).length;
    const candidateCount = parseTimedTranscriptSegments(candidate).length;
    return candidateCount > bestCount ? candidate : best;
  }, '');
}

function transcriptLoadError(message, code, status = null) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export async function loadRowTimestampTranscript({
  video,
  savedAnalysis = null,
  youtubeId: explicitYoutubeId = null,
  transcriptText = '',
  signal,
  timeoutMs = ROW_TRANSCRIPT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  const youtubeId = resolveRowTimestampYoutubeId(video, explicitYoutubeId);
  if (!youtubeId) {
    throw transcriptLoadError('לא ניתן לזהות את מזהה הסרטון ב-YouTube.', 'INVALID_YOUTUBE_ID');
  }

  const cached = acceptTimedText(transcriptText)
    || buildRowTimestampTranscript(video, savedAnalysis, youtubeId);
  if (cached) {
    return { transcript: cached, youtubeId, source: 'cache' };
  }

  if (typeof fetchImpl !== 'function') {
    throw transcriptLoadError('טעינת התמלול אינה זמינה כרגע. נסה שוב.', 'TRANSCRIPT_FETCH_UNAVAILABLE');
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortExternal = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', abortExternal, { once: true });
  }
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(`/api/youtube-transcript?v=${encodeURIComponent(youtubeId)}`, {
      method: 'GET',
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = response.status === 404
        ? 'לא נמצא תמלול מתוזמן לסרטון. נסה שוב מאוחר יותר.'
        : 'טעינת התמלול נכשלה. נסה שוב.';
      throw transcriptLoadError(message, data.error || 'TRANSCRIPT_FETCH_FAILED', response.status);
    }

    const validation = validateTranscriptUsable(data);
    if (!validation.ok || !validation.usablePartial) {
      throw transcriptLoadError('התמלול שהתקבל אינו מכיל זמנים אמינים. נסה שוב.', 'INVALID_TIMED_TRANSCRIPT');
    }
    const transcript = formatTimedSegments(validation.segments);
    if (parseTimedTranscriptSegments(transcript).length === 0) {
      throw transcriptLoadError('התמלול שהתקבל אינו מכיל זמנים אמינים. נסה שוב.', 'INVALID_TIMED_TRANSCRIPT');
    }
    return {
      transcript,
      youtubeId,
      source: 'network',
      validation,
    };
  } catch (error) {
    if (typeof error?.code === 'string') throw error;
    if (timedOut) {
      throw transcriptLoadError('טעינת התמלול ארכה זמן רב מדי. נסה שוב.', 'TRANSCRIPT_TIMEOUT');
    }
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw transcriptLoadError('טעינת התמלול בוטלה. אפשר לנסות שוב.', 'TRANSCRIPT_CANCELLED');
    }
    throw transcriptLoadError('טעינת התמלול נכשלה. נסה שוב.', 'TRANSCRIPT_FETCH_FAILED');
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', abortExternal);
  }
}

export async function generateRowTimestamps({ transcript, rows, durationSeconds = 0, signal } = {}) {
  const payload = buildRowTimestampRequestPayload({ transcript, rows, durationSeconds });

  if (isBase44Enabled()) {
    const { base44 } = await import('@/api/base44Client');
    if (base44) return base44.functions.GenerateRowTimestamps(payload);
  }

  const controller = new AbortController();
  const abortExternal = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', abortExternal, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch('/api/generate-row-timestamps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', abortExternal);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'יצירת הזמנים נכשלה');
    error.code = data.error || 'ROW_TIMESTAMPS_FAILED';
    error.status = response.status;
    throw error;
  }
  return data;
}
