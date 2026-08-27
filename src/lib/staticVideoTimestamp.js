const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const MAX_STATIC_TIMESTAMP_SECONDS = Number.MAX_SAFE_INTEGER;

function isValidStaticSeconds(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= MAX_STATIC_TIMESTAMP_SECONDS;
}

function isEstimatedKind(item) {
  return item?.timestampKind === 'estimated';
}

export function formatStaticVideoTimestamp(seconds) {
  if (!isValidStaticSeconds(seconds)) return null;
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(remainder).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function resolveStaticVideoTimestamp(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  if (isValidStaticSeconds(item.exactStartSeconds)) {
    return {
      seconds: Math.floor(item.exactStartSeconds),
      label: formatStaticVideoTimestamp(item.exactStartSeconds),
      estimated: false,
    };
  }

  const directSeconds = isValidStaticSeconds(item.timestampSeconds)
    ? item.timestampSeconds
    : isValidStaticSeconds(item.startSeconds)
      ? item.startSeconds
      : null;

  if (directSeconds !== null) {
    return {
      seconds: Math.floor(directSeconds),
      label: formatStaticVideoTimestamp(directSeconds),
      estimated: isEstimatedKind(item),
    };
  }

  if (!isValidStaticSeconds(item.estimatedStartSeconds)) return null;
  return {
    seconds: Math.floor(item.estimatedStartSeconds),
    label: formatStaticVideoTimestamp(item.estimatedStartSeconds),
    estimated: true,
  };
}

export function buildStaticYouTubeTimestampLink(videoId, item) {
  const normalizedVideoId = typeof videoId === 'string' ? videoId.trim() : '';
  if (!YOUTUBE_VIDEO_ID_RE.test(normalizedVideoId)) return null;

  const timestamp = resolveStaticVideoTimestamp(item);
  if (!timestamp) return null;

  const visibleLabel = timestamp.estimated ? `▶ ≈${timestamp.label}` : `▶ ${timestamp.label}`;
  const ariaLabel = timestamp.estimated
    ? `פתח את הסרטון באזור הזמן המשוער ${timestamp.label}`
    : `פתח את הסרטון בזמן ${timestamp.label}`;

  return {
    ...timestamp,
    href: `https://www.youtube.com/watch?v=${normalizedVideoId}&t=${timestamp.seconds}s`,
    visibleLabel,
    ariaLabel,
    target: '_blank',
    rel: 'noopener noreferrer',
  };
}
