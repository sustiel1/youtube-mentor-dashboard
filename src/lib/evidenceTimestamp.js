const ALLOWED_SOURCES = new Set([
  'youtube-timedtext', 'explicit-input', 'official-youtube-chapter', 'timed-transcript-alignment',
]);

export const MIN_VERIFIED_TIMESTAMP_CONFIDENCE = 0.72;

export function normalizeEvidenceTime(item) {
  if (!item || typeof item !== 'object' || item.startSeconds == null || item.startSeconds === '') return null;
  if (['chunk-relative', 'chunk'].includes(String(item.timestampBasis || item.timingScope || '').trim())) return null;
  const startSeconds = Number(item.startSeconds);
  const endSeconds = item.endSeconds == null ? null : Number(item.endSeconds);
  const timestampSource = String(item.timestampSource || '').trim();
  const timestampConfidence = item.timestampConfidence == null ? null : Number(item.timestampConfidence);
  if (!Number.isFinite(startSeconds) || startSeconds < 0 || !ALLOWED_SOURCES.has(timestampSource)) return null;
  if (endSeconds != null && (!Number.isFinite(endSeconds) || endSeconds <= startSeconds)) return null;
  if (timestampConfidence != null && (!Number.isFinite(timestampConfidence) || timestampConfidence < MIN_VERIFIED_TIMESTAMP_CONFIDENCE || timestampConfidence > 1)) return null;
  return { startSeconds, endSeconds, timestampSource, timestampConfidence };
}

function tokens(value) {
  return String(value || '').toLocaleLowerCase('he').match(/[\p{L}\p{N}$%]+/gu)
    ?.filter((token) => token.length >= 3 || /\d/.test(token)) || [];
}

export function alignItemToTimedSegments(text, segments, { threshold = 0.72, margin = 0.12 } = {}) {
  const itemTokens = [...new Set(tokens(text))];
  if (itemTokens.length < 3 || !Array.isArray(segments)) return null;
  const normalized = segments.map((segment) => ({
    ...segment,
    startSeconds: Number(segment?.startSeconds ?? segment?.start),
    text: String(segment?.text || segment?.content || '').trim(),
  })).filter((segment) => Number.isFinite(segment.startSeconds) && segment.startSeconds >= 0 && segment.text);
  const candidates = [];
  for (let index = 0; index < normalized.length; index += 1) {
    for (const size of [1, 2, 3]) {
      const group = normalized.slice(index, index + size);
      if (group.length !== size) continue;
      const segmentTokens = new Set(tokens(group.map((entry) => entry.text).join(' ')));
      const common = itemTokens.filter((token) => segmentTokens.has(token));
      if (common.length < 3) continue;
      const distinctive = common.filter((token) => /\d/.test(token) || token.startsWith('$'));
      const score = Math.min(1, (common.length + distinctive.length * 0.5) / Math.min(itemTokens.length, 8));
      candidates.push({ segment: group[0], score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const unique = candidates.filter((candidate, index) =>
    candidates.findIndex((item) => item.segment.startSeconds === candidate.segment.startSeconds) === index);
  const best = unique[0];
  if (!best || best.score < threshold || (unique[1] && best.score - unique[1].score < margin)) return null;
  const duration = Number(best.segment.durationSeconds ?? best.segment.duration);
  return {
    startSeconds: best.segment.startSeconds,
    endSeconds: Number.isFinite(duration) && duration > 0 ? best.segment.startSeconds + duration : null,
    timestampSource: 'timed-transcript-alignment',
    timestampConfidence: Number(best.score.toFixed(3)),
  };
}

export function resolveItemEvidenceTime(item, text, segments) {
  return normalizeEvidenceTime(item) || alignItemToTimedSegments(text, segments);
}

export function formatEvidenceTimestamp(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '';
  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
