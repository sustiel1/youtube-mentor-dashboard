import { resolveChapterNavigationData } from './chapterTimestamp.js';

// Near timestamps are duplicates only when their text also overlaps.
export const CHAPTER_DUPLICATE_TOLERANCE_SECONDS = 8;
// Automatic transcript chapters are useful only inside gaps of at least three minutes.
export const CHAPTER_MEANINGFUL_GAP_SECONDS = 180;

function normalizedText(chapter) {
  return [chapter?.title, chapter?.summary, chapter?.description, chapter?.transcriptText]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('he')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textTokens(chapter) {
  return new Set(normalizedText(chapter).split(' ').filter((token) => token.length > 1));
}

export function chapterTextOverlaps(left, right) {
  const leftText = normalizedText(left);
  const rightText = normalizedText(right);
  if (!leftText || !rightText) return false;
  if (leftText === rightText || leftText.includes(rightText) || rightText.includes(leftText)) return true;

  const leftTokens = textTokens(left);
  const rightTokens = textTokens(right);
  const smallerSize = Math.min(leftTokens.size, rightTokens.size);
  if (smallerSize === 0) return false;
  let shared = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) shared += 1;
  });
  return shared / smallerSize >= 0.5;
}

export function chaptersAreDuplicates(left, right, toleranceSeconds = CHAPTER_DUPLICATE_TOLERANCE_SECONDS) {
  const leftTime = resolveChapterNavigationData(left);
  const rightTime = resolveChapterNavigationData(right);

  if (leftTime.available && rightTime.available) {
    const difference = Math.abs(leftTime.seconds - rightTime.seconds);
    if (difference === 0) return true;
    return difference <= toleranceSeconds && chapterTextOverlaps(left, right);
  }

  return chapterTextOverlaps(left, right);
}

function enrichMissingTiming(existing, candidate) {
  const existingTime = resolveChapterNavigationData(existing);
  const candidateTime = resolveChapterNavigationData(candidate);
  if (existingTime.available || !candidateTime.available) return existing;

  return {
    ...existing,
    startSeconds: candidateTime.seconds,
    timestamp: candidate?.timestamp || candidateTime.label,
    timeSource: candidate?.timeSource || 'estimated_transcript',
    timestampSource: candidate?.timestampSource || candidate?.timeSource || 'estimated_transcript',
    isEstimated: candidate?.isEstimated ?? true,
    timingSource: candidate?.timingSource || candidate?.chapterSource || candidate?.source || 'automatic',
  };
}

function withSourceDefaults(chapter, source) {
  const copy = { ...chapter };
  if (source === 'youtube') {
    if (!copy.chapterSource) copy.chapterSource = 'description_timestamp';
    if (!copy.source) copy.source = copy.chapterSource;
    if (!copy.timeSource && resolveChapterNavigationData(copy).available) copy.timeSource = 'real';
    if (copy.isEstimated == null && resolveChapterNavigationData(copy).available) copy.isEstimated = false;
  } else if (source === 'gem') {
    if (!copy.chapterSource) copy.chapterSource = 'gem';
    if (!copy.source) copy.source = copy.chapterSource;
  } else if (source === 'saved') {
    if (!copy.chapterSource) copy.chapterSource = 'saved';
    if (!copy.source) copy.source = copy.chapterSource;
    if (!copy.timeSource && resolveChapterNavigationData(copy).available) copy.timeSource = 'real';
    if (copy.isEstimated == null && resolveChapterNavigationData(copy).available) copy.isEstimated = false;
  } else {
    if (!copy.chapterSource) copy.chapterSource = 'transcript_heuristic';
    if (!copy.source) copy.source = copy.chapterSource;
    if (!copy.timeSource) copy.timeSource = 'estimated_transcript';
    if (copy.isEstimated == null) copy.isEstimated = resolveChapterNavigationData(copy).available;
  }
  return copy;
}

function appendUnique(target, chapters, source, onTimingEnriched = null) {
  const accepted = [];
  (Array.isArray(chapters) ? chapters : []).forEach((chapter) => {
    if (!chapter || typeof chapter !== 'object') return;
    const candidate = withSourceDefaults(chapter, source);
    const duplicateIndex = target.findIndex((existing) => chaptersAreDuplicates(existing, candidate));
    if (duplicateIndex >= 0) {
      const enriched = enrichMissingTiming(target[duplicateIndex], candidate);
      if (enriched !== target[duplicateIndex]) {
        target[duplicateIndex] = enriched;
        onTimingEnriched?.(enriched);
      }
      return;
    }
    target.push(candidate);
    accepted.push(candidate);
  });
  return accepted;
}

function sortChronologically(chapters) {
  return chapters
    .map((chapter, index) => ({ chapter, index, navigation: resolveChapterNavigationData(chapter) }))
    .sort((left, right) => {
      if (left.navigation.available && right.navigation.available) {
        return left.navigation.seconds - right.navigation.seconds || left.index - right.index;
      }
      if (left.navigation.available) return -1;
      if (right.navigation.available) return 1;
      return left.index - right.index;
    })
    .map(({ chapter }) => chapter);
}

export function findMeaningfulChapterGaps(chapters, durationSeconds) {
  const times = [...new Set((Array.isArray(chapters) ? chapters : [])
    .map((chapter) => resolveChapterNavigationData(chapter))
    .filter((navigation) => navigation.available)
    .map((navigation) => navigation.seconds))]
    .sort((a, b) => a - b);

  if (times.length < 2) {
    const knownDuration = Number.isFinite(durationSeconds) && durationSeconds > 0;
    return [{ start: 0, end: knownDuration ? durationSeconds : Infinity }];
  }

  const gaps = [];
  if (times[0] >= CHAPTER_MEANINGFUL_GAP_SECONDS) gaps.push({ start: 0, end: times[0] });
  for (let index = 1; index < times.length; index += 1) {
    if (times[index] - times[index - 1] >= CHAPTER_MEANINGFUL_GAP_SECONDS) {
      gaps.push({ start: times[index - 1], end: times[index] });
    }
  }
  if (Number.isFinite(durationSeconds) && durationSeconds - times.at(-1) >= CHAPTER_MEANINGFUL_GAP_SECONDS) {
    gaps.push({ start: times.at(-1), end: durationSeconds });
  }
  return gaps;
}

function candidateIsInGap(chapter, gaps) {
  const navigation = resolveChapterNavigationData(chapter);
  if (!navigation.available) return false;
  return gaps.some((gap) => navigation.seconds >= gap.start && navigation.seconds <= gap.end);
}

/**
 * Deterministic source merge: YouTube exact/native -> GEMS JSON -> saved/manual -> transcript estimates.
 * Existing objects win every duplicate comparison; automatic rows are accepted only in meaningful gaps.
 */
export function mergeChapterSources({
  youtubeChapters = [],
  gemChapters = [],
  savedChapters = [],
  automaticChapters = [],
  durationSeconds = null,
} = {}) {
  const merged = [];
  appendUnique(merged, youtubeChapters, 'youtube');
  appendUnique(merged, gemChapters, 'gem');
  appendUnique(merged, savedChapters, 'saved');
  const authoritativeCount = merged.length;
  const gaps = findMeaningfulChapterGaps(merged, durationSeconds);
  const complete = authoritativeCount >= 2 && gaps.length === 0;
  const candidates = complete
    ? []
    : (Array.isArray(automaticChapters) ? automaticChapters : [])
      .filter((chapter) => candidateIsInGap(chapter, gaps));
  const enrichedAutomatic = [];
  const acceptedAutomatic = appendUnique(
    merged,
    candidates,
    'automatic',
    (chapter) => enrichedAutomatic.push(chapter),
  );

  return {
    chapters: sortChronologically(merged),
    acceptedAutomatic,
    enrichedAutomatic,
    authoritativeCount,
    complete,
    gaps,
  };
}

export function getHebrewTitlesErrorMessage(error) {
  if (error?.code === 'GEMINI_API_KEY_MISSING') return 'נדרש חיבור AI כדי ליצור כותרות עבריות.';
  if (error?.name === 'AbortError' || error?.code === 'TIMEOUT') {
    return 'יצירת הכותרות נמשכה זמן רב מדי. אפשר לנסות שוב; הפרקים הקיימים נשמרו ללא שינוי.';
  }
  if (error?.code === 'INVALID_MODEL_RESPONSE') {
    return 'שירות הכותרות החזיר תשובה לא תקינה. אפשר לנסות שוב; הפרקים הקיימים נשמרו ללא שינוי.';
  }
  if (/no longer available|not found|404/i.test(String(error?.message || ''))) {
    return 'מודל יצירת הכותרות אינו זמין. הפרקים הקיימים נשמרו ללא שינוי.';
  }
  return 'יצירת הכותרות נכשלה. אפשר לנסות שוב; הפרקים הקיימים נשמרו ללא שינוי.';
}
