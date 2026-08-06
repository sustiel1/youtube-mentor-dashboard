const ALLOWED_SOURCES = new Set([
  'youtube-timedtext',
  'explicit-input',
  'official-youtube-chapter',
  'timed-transcript-alignment',
]);
export const MIN_VERIFIED_TIMESTAMP_CONFIDENCE = 0.72;

export function normalizeEvidenceTime(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.startSeconds == null || item.startSeconds === '') return null;
  if (['chunk-relative', 'chunk'].includes(String(item.timestampBasis || item.timingScope || '').trim())) return null;
  const startSeconds = Number(item.startSeconds);
  if (!Number.isFinite(startSeconds) || startSeconds < 0) return null;
  const endRaw = item.endSeconds;
  const endSeconds = endRaw == null ? null : Number(endRaw);
  if (endSeconds != null && (!Number.isFinite(endSeconds) || endSeconds <= startSeconds)) return null;
  const timestampSource = String(item.timestampSource || '').trim();
  if (!ALLOWED_SOURCES.has(timestampSource)) return null;
  const confidenceRaw = item.timestampConfidence;
  const timestampConfidence = confidenceRaw == null ? null : Number(confidenceRaw);
  if (timestampConfidence != null && (!Number.isFinite(timestampConfidence) || timestampConfidence < 0 || timestampConfidence > 1)) return null;
  if (timestampConfidence != null && timestampConfidence < MIN_VERIFIED_TIMESTAMP_CONFIDENCE) return null;
  return { startSeconds, endSeconds, timestampSource, timestampConfidence };
}

function tokens(value) {
  return String(value || '')
    .toLocaleLowerCase('he')
    .match(/[\p{L}\p{N}$%]+/gu)?.filter((token) => token.length >= 3 || /\d/.test(token)) || [];
}

export function alignItemToTimedSegments(text, segments, { threshold = 0.72, margin = 0.12 } = {}) {
  const itemTokens = [...new Set(tokens(text))];
  if (itemTokens.length < 3 || !Array.isArray(segments)) return null;
  const normalizedSegments = segments.map((segment) => ({
    ...segment,
    startSeconds: Number(segment?.startSeconds ?? segment?.start),
    text: String(segment?.text || segment?.content || '').trim(),
  })).filter((segment) => Number.isFinite(segment.startSeconds) && segment.startSeconds >= 0 && segment.text);
  const windows = normalizedSegments.flatMap((segment, index) => [1, 2, 3].map((size) => {
    const group = normalizedSegments.slice(index, index + size);
    if (group.length !== size) return null;
    return { segment, text: group.map((entry) => entry.text).join(' ') };
  }).filter(Boolean));
  const scored = windows.map(({ segment, text: windowText }) => {
    const startSeconds = segment.startSeconds;
    const segmentTokens = new Set(tokens(windowText));
    const common = itemTokens.filter((token) => segmentTokens.has(token));
    const distinctive = common.filter((token) => /\d/.test(token) || token.startsWith('$'));
    const score = Math.min(1, (common.length + distinctive.length * 0.5) / Math.min(itemTokens.length, 8));
    return { segment, startSeconds, score, common: common.length };
  }).filter(Boolean).filter((candidate) => candidate.common >= 3).sort((a, b) => b.score - a.score);
  const seenStarts = new Set();
  const candidates = scored.filter((candidate) => {
    if (seenStarts.has(candidate.startSeconds)) return false;
    seenStarts.add(candidate.startSeconds);
    return true;
  });
  const best = candidates[0];
  if (!best || best.score < threshold) return null;
  if (candidates[1] && best.score - candidates[1].score < margin) return null;
  const duration = Number(best.segment?.durationSeconds ?? best.segment?.duration);
  return {
    startSeconds: best.startSeconds,
    endSeconds: Number.isFinite(duration) && duration > 0 ? best.startSeconds + duration : null,
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
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
