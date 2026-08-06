const TIME_TOLERANCE_SECONDS = 1;

function finiteTime(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeChapterComparisonText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('he')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stableId(chapter) {
  return chapter?.id ?? chapter?.chapterId ?? chapter?.stableId ?? null;
}

function officialIdentity(chapter) {
  const source = String(chapter?.chapterSource || chapter?.source || '').trim();
  const sourceId = chapter?.sourceId ?? chapter?.officialId ?? chapter?.youtubeChapterId ?? null;
  return source && sourceId != null ? `${source}:${String(sourceId)}` : null;
}

function classifyCandidate(existing, candidate) {
  const candidateId = stableId(candidate);
  if (candidateId != null && existing.some((chapter) => stableId(chapter) === candidateId)) {
    return 'duplicate';
  }

  const candidateOfficialIdentity = officialIdentity(candidate);
  if (
    candidateOfficialIdentity &&
    existing.some((chapter) => officialIdentity(chapter) === candidateOfficialIdentity)
  ) {
    return 'duplicate';
  }

  const candidateTitle = normalizeChapterComparisonText(candidate?.title);
  const candidateStart = finiteTime(candidate?.startSeconds);
  const candidateEnd = finiteTime(candidate?.endSeconds);

  for (const chapter of existing) {
    const existingTitle = normalizeChapterComparisonText(chapter?.title);
    const existingStart = finiteTime(chapter?.startSeconds);
    const existingEnd = finiteTime(chapter?.endSeconds);
    const sameStart = candidateStart != null && existingStart != null &&
      Math.abs(candidateStart - existingStart) <= TIME_TOLERANCE_SECONDS;
    const sameEnd = candidateEnd != null && existingEnd != null &&
      Math.abs(candidateEnd - existingEnd) <= TIME_TOLERANCE_SECONDS;

    if (candidateTitle && candidateTitle === existingTitle) {
      if (sameStart || sameEnd || (candidateStart == null && existingStart == null)) return 'duplicate';
    }

    // A shared verified boundary with a different title is ambiguous. Keep the
    // authoritative existing chapter and require explicit review.
    if (sameStart && candidateTitle !== existingTitle) return 'uncertain';
  }

  return 'unique';
}

function validateChapter(chapter) {
  if (!chapter || typeof chapter !== 'object') return false;
  if (!normalizeChapterComparisonText(chapter.title)) return false;
  const start = finiteTime(chapter.startSeconds);
  const end = finiteTime(chapter.endSeconds);
  if (start != null && start < 0) return false;
  if (end != null && end < 0) return false;
  if (start != null && end != null && end <= start) return false;
  return true;
}

function insertWithoutReorderingExisting(output, chapter) {
  const start = finiteTime(chapter.startSeconds);
  if (start == null) {
    output.push(chapter);
    return;
  }
  const insertionIndex = output.findIndex((existing) => {
    const existingStart = finiteTime(existing?.startSeconds);
    return existingStart != null && existingStart > start;
  });
  if (insertionIndex === -1) output.push(chapter);
  else output.splice(insertionIndex, 0, chapter);
}

export function prepareAdditiveChapterMerge(existingChapters, candidateChapters) {
  const existing = Array.isArray(existingChapters) ? existingChapters : [];
  const candidates = Array.isArray(candidateChapters) ? candidateChapters : [];

  if (!existing.every(validateChapter) || !candidates.every(validateChapter)) {
    return {
      ok: false,
      reason: 'invalid_chapter',
      chapters: existing,
      existingCount: existing.length,
      addedCount: 0,
      duplicateCount: 0,
      uncertainCount: 0,
    };
  }

  const output = [...existing];
  let duplicateCount = 0;
  let uncertainCount = 0;
  const added = [];

  for (const candidate of candidates) {
    const classification = classifyCandidate(output, candidate);
    if (classification === 'duplicate') {
      duplicateCount += 1;
      continue;
    }
    if (classification === 'uncertain') {
      uncertainCount += 1;
      continue;
    }
    insertWithoutReorderingExisting(output, candidate);
    added.push(candidate);
  }

  const existingPositions = existing.map((chapter) => output.indexOf(chapter));
  const existingOrderPreserved = existingPositions.every(
    (position, index) => position >= 0 && (index === 0 || position > existingPositions[index - 1]),
  );
  if (!existingOrderPreserved || output.length !== existing.length + added.length) {
    return {
      ok: false,
      reason: 'existing_chapter_invariant',
      chapters: existing,
      existingCount: existing.length,
      addedCount: 0,
      duplicateCount,
      uncertainCount,
    };
  }

  return {
    ok: true,
    chapters: output,
    added,
    existingCount: existing.length,
    addedCount: added.length,
    duplicateCount,
    uncertainCount,
  };
}

export function formatAdditiveChapterResult(result) {
  if (!result?.ok) return 'המיזוג נעצר כדי להגן על הפרקים הקיימים. לא בוצע שינוי.';
  if (result.addedCount === 0) {
    return `לא נמצאו פרקים חדשים. ${result.existingCount} הפרקים הקיימים נשמרו ללא שינוי.`;
  }
  const uncertain = result.uncertainCount > 0
    ? ` ${result.uncertainCount} מועמדים דורשים אימות.`
    : '';
  return `בדיקת הפרקים הושלמה: נשמרו ${result.existingCount} פרקים קיימים, נוספו ${result.addedCount} פרקים חדשים ו־${result.duplicateCount} כפילויות דולגו.${uncertain}`;
}
