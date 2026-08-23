/**
 * Parse a persisted chapter time without coercing missing values to zero.
 * Supports numeric seconds, numeric strings, MM:SS and HH:MM:SS.
 */
export function parseChapterTimeToSeconds(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }

  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) ? Math.floor(seconds) : null;
  }

  const parts = text.split(':');
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (!parts.every((part) => /^\d+$/.test(part))) return null;

  const numbers = parts.map(Number);
  if (parts.length === 2) {
    const [minutes, seconds] = numbers;
    if (seconds > 59) return null;
    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = numbers;
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatChapterTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function resolveChapterNavigationData(chapter) {
  const numericCandidates = [
    chapter?.startSeconds,
    chapter?.start_sec,
    chapter?.timestampSeconds,
    chapter?.startTime,
    chapter?.start,
    chapter?.t,
  ];

  for (const candidate of numericCandidates) {
    const seconds = parseChapterTimeToSeconds(candidate);
    if (seconds !== null) {
      return { available: true, seconds, label: formatChapterTime(seconds) };
    }
  }

  const labelCandidates = [
    chapter?.timestamp,
    chapter?.timestampLabel,
    chapter?.time,
    chapter?.timeLabel,
  ];

  for (const candidate of labelCandidates) {
    const seconds = parseChapterTimeToSeconds(candidate);
    if (seconds !== null) {
      return { available: true, seconds, label: formatChapterTime(seconds) };
    }
  }

  return { available: false, seconds: null, label: '' };
}

export function hasEstimatedChapterTimes(chapters) {
  if (!Array.isArray(chapters)) return false;

  return chapters.some((chapter) => {
    if (!resolveChapterNavigationData(chapter).available) return false;

    const timestampSource = String(chapter?.timestampSource || '').toLowerCase();
    const timeSource = String(chapter?.timeSource || '').toLowerCase();
    return (
      chapter?.isEstimated === true ||
      timestampSource.startsWith('estimated') ||
      timeSource.startsWith('estimated')
    );
  });
}
