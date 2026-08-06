function meaningfulText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeConclusionText(value) {
  return meaningfulText(value)
    .normalize('NFKC')
    .toLocaleLowerCase('he')
    .replace(/[.,;:!?…'"׳״\-–—()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function flattenComparableTexts(value) {
  if (Array.isArray(value)) return value.flatMap(flattenComparableTexts);
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!value || typeof value !== 'object') return [];
  const text = meaningfulText(
    value.text
      || value.content
      || value.insight
      || value.lesson
      || value.summary
      || value.title,
  );
  return text ? [text] : [];
}

function findExactDuplicate(text, candidates) {
  const normalized = normalizeConclusionText(text);
  if (!normalized) return null;
  return candidates.find((candidate) => normalizeConclusionText(candidate.text) === normalized) || null;
}

export function resolveSummaryConclusion({
  video = {},
  marketBriefData = null,
} = {}) {
  const resolvedVideo = video || {};
  const payload = marketBriefData && typeof marketBriefData === 'object' ? marketBriefData : {};
  const summary = payload.universalTabs?.summary;
  const summaryObject = summary && typeof summary === 'object' && !Array.isArray(summary) ? summary : {};
  const canonical = meaningfulText(summaryObject.mainConclusion);
  const payloadMainLesson = meaningfulText(payload.mainLesson);
  const legacyMainLesson = meaningfulText(resolvedVideo.mainLesson);
  const comparisonCandidates = [
    ...flattenComparableTexts(Array.isArray(summary) ? summary : [])
      .map((text) => ({ text, path: 'marketBriefData.universalTabs.summary' })),
    ...flattenComparableTexts(summaryObject.topTakeaways)
      .map((text) => ({ text, path: 'marketBriefData.universalTabs.summary.topTakeaways' })),
    ...flattenComparableTexts(payload.universalTabs?.insights?.learningInsights)
      .map((text) => ({ text, path: 'marketBriefData.universalTabs.insights.learningInsights' })),
    ...flattenComparableTexts(payload.universalTabs?.usefulKnowledge?.reusableKnowledge)
      .map((text) => ({ text, path: 'marketBriefData.universalTabs.usefulKnowledge.reusableKnowledge' })),
  ];

  if (canonical) {
    const payloadDuplicate = payloadMainLesson
      ? findExactDuplicate(payloadMainLesson, [
          { text: canonical, path: 'marketBriefData.universalTabs.summary.mainConclusion' },
          ...comparisonCandidates,
        ])
      : null;
    return {
      text: canonical,
      sourcePath: 'marketBriefData.universalTabs.summary.mainConclusion',
      fallbackPath: payloadMainLesson ? 'marketBriefData.mainLesson' : '',
      fallbackStatus: payloadMainLesson
        ? (payloadDuplicate ? 'duplicate' : 'shadowed')
        : 'absent',
      duplicateOf: payloadDuplicate?.path || '',
    };
  }

  if (payloadMainLesson) {
    const duplicate = findExactDuplicate(payloadMainLesson, comparisonCandidates);
    return {
      text: duplicate ? '' : payloadMainLesson,
      sourcePath: duplicate ? '' : 'marketBriefData.mainLesson',
      fallbackPath: 'marketBriefData.mainLesson',
      fallbackStatus: duplicate ? 'duplicate' : 'selected',
      duplicateOf: duplicate?.path || '',
    };
  }

  if (legacyMainLesson) {
    const duplicate = findExactDuplicate(legacyMainLesson, comparisonCandidates);
    return {
      text: duplicate ? '' : legacyMainLesson,
      sourcePath: duplicate ? '' : 'video.mainLesson',
      fallbackPath: 'video.mainLesson',
      fallbackStatus: duplicate ? 'duplicate' : 'selected',
      duplicateOf: duplicate?.path || '',
    };
  }

  return {
    text: '',
    sourcePath: '',
    fallbackPath: '',
    fallbackStatus: 'absent',
    duplicateOf: '',
  };
}
