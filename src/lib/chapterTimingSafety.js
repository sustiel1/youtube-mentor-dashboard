const VERIFIED_SOURCES = new Set([
  'youtube-timedtext',
  'official-youtube-chapter',
  'youtube-description',
  'description_timestamp',
  'description_timestamps',
  'explicit-input',
  'manual-input',
  'timed-transcript-alignment',
  'transcript',
]);

const UNSAFE_SOURCES = new Set([
  'estimated', 'estimated_from_text', 'estimated_proportional', 'duration_fallback',
  'plain_text_estimated', 'outline', 'transcript_heuristic', 'chunk-relative', 'chunk',
]);

export function finiteNonNegativeTime(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function normalizeChapterTiming(chapter, { defaultSource = 'unavailable' } = {}) {
  const chapterSource = String(chapter?.chapterSource || chapter?.source || '').trim();
  const rawSource = String(chapter?.timestampSource || chapter?.timeSource || '').trim();
  const derivedSource = rawSource === 'real'
    ? /description/.test(chapterSource) ? 'youtube-description'
      : /native|youtube/.test(chapterSource) ? 'official-youtube-chapter'
        : /transcript/.test(chapterSource) ? 'youtube-timedtext'
          : /manual|gems/.test(chapterSource) ? 'explicit-input'
            : defaultSource
    : rawSource || defaultSource;
  const source = String(derivedSource || 'unavailable').trim();
  const startSeconds = finiteNonNegativeTime(chapter?.startSeconds ?? chapter?.start ?? chapter?.timestampSeconds);
  const endCandidate = finiteNonNegativeTime(chapter?.endSeconds ?? chapter?.end);
  const sourceAllowed = VERIFIED_SOURCES.has(source) && !UNSAFE_SOURCES.has(source);
  if (startSeconds == null || !sourceAllowed) {
    return { startSeconds: null, endSeconds: null, timestampSource: 'unavailable', timestampConfidence: null };
  }
  const endSeconds = endCandidate != null && endCandidate >= startSeconds ? endCandidate : null;
  const confidenceRaw = chapter?.timestampConfidence;
  const timestampConfidence = confidenceRaw == null
    ? null
    : Number.isFinite(Number(confidenceRaw)) && Number(confidenceRaw) >= 0 && Number(confidenceRaw) <= 1
      ? Number(confidenceRaw)
      : null;
  return { startSeconds, endSeconds, timestampSource: source, timestampConfidence };
}

export function removeEvenlyDistributedTiming(chapters, tolerance = 0.08) {
  const list = Array.isArray(chapters) ? chapters : [];
  const starts = list.map((chapter) => finiteNonNegativeTime(chapter?.startSeconds));
  if (starts.length < 4 || starts.some((value) => value == null)) return list;
  const gaps = starts.slice(1).map((start, index) => start - starts[index]);
  const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  if (!(average > 0) || !gaps.every((gap) => Math.abs(gap - average) / average < tolerance)) return list;
  return list.map((chapter) => ({
    ...chapter,
    startSeconds: null,
    endSeconds: null,
    timestamp: '',
    timestampSource: 'unavailable',
    timestampConfidence: null,
    isEstimated: false,
  }));
}
