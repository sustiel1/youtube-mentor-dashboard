const TOLERANCE_SECONDS = 1;
const finiteTime = (value) => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;

export function normalizeChapterComparisonText(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('he')
    .replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function valid(chapter) {
  if (!chapter || typeof chapter !== 'object' || !normalizeChapterComparisonText(chapter.title)) return false;
  const start = finiteTime(chapter.startSeconds);
  const end = finiteTime(chapter.endSeconds);
  return !(start != null && start < 0) && !(end != null && end < 0) && !(start != null && end != null && end <= start);
}

function identity(chapter) {
  const stable = chapter?.id ?? chapter?.chapterId ?? chapter?.stableId;
  if (stable != null) return `id:${stable}`;
  const source = String(chapter?.chapterSource || chapter?.source || '').trim();
  const sourceId = chapter?.sourceId ?? chapter?.officialId ?? chapter?.youtubeChapterId;
  return source && sourceId != null ? `source:${source}:${sourceId}` : null;
}

function classify(existing, candidate) {
  const candidateIdentity = identity(candidate);
  if (candidateIdentity && existing.some((chapter) => identity(chapter) === candidateIdentity)) return 'duplicate';
  const title = normalizeChapterComparisonText(candidate.title);
  const start = finiteTime(candidate.startSeconds);
  const end = finiteTime(candidate.endSeconds);
  for (const chapter of existing) {
    const existingTitle = normalizeChapterComparisonText(chapter.title);
    const existingStart = finiteTime(chapter.startSeconds);
    const existingEnd = finiteTime(chapter.endSeconds);
    const sameStart = start != null && existingStart != null && Math.abs(start - existingStart) <= TOLERANCE_SECONDS;
    const sameEnd = end != null && existingEnd != null && Math.abs(end - existingEnd) <= TOLERANCE_SECONDS;
    if (title === existingTitle && (sameStart || sameEnd || (start == null && existingStart == null))) return 'duplicate';
    if (sameStart && title !== existingTitle) return 'uncertain';
  }
  return 'unique';
}

export function prepareAdditiveChapterMerge(existingChapters, candidateChapters) {
  const existing = Array.isArray(existingChapters) ? existingChapters : [];
  const candidates = Array.isArray(candidateChapters) ? candidateChapters : [];
  if (![...existing, ...candidates].every(valid)) {
    return { ok: false, reason: 'invalid_chapter', chapters: existing, existingCount: existing.length, addedCount: 0, duplicateCount: 0, uncertainCount: 0 };
  }
  const chapters = [...existing];
  const added = [];
  let duplicateCount = 0;
  let uncertainCount = 0;
  for (const candidate of candidates) {
    const result = classify(chapters, candidate);
    if (result === 'duplicate') { duplicateCount += 1; continue; }
    if (result === 'uncertain') { uncertainCount += 1; continue; }
    const start = finiteTime(candidate.startSeconds);
    const index = start == null ? -1 : chapters.findIndex((chapter) => {
      const existingStart = finiteTime(chapter.startSeconds);
      return existingStart != null && existingStart > start;
    });
    if (index < 0) chapters.push(candidate); else chapters.splice(index, 0, candidate);
    added.push(candidate);
  }
  return { ok: true, chapters, added, existingCount: existing.length, addedCount: added.length, duplicateCount, uncertainCount };
}
