/**
 * Merge fresh YouTube metadata into a restored archived record without wiping saved fields.
 */
export function mergeRestoredVideoWithFreshMetadata(archived, fresh) {
  const base = { ...(archived || {}) };
  const next = { ...(fresh || {}) };

  const pick = (key, preferFresh = false) => {
    const a = base[key];
    const f = next[key];
    if (preferFresh && f != null && f !== '') return f;
    if (a != null && a !== '' && !(Array.isArray(a) && a.length === 0)) return a;
    return f != null && f !== '' ? f : a;
  };

  return {
    ...base,
    ...next,
    id: base.id || next.id,
    url: pick('url', true),
    videoId: pick('videoId', true) || pick('youtubeId', true),
    youtubeId: pick('youtubeId', true) || pick('videoId', true),
    title: pick('title'),
    thumbnail: pick('thumbnail', true),
    channelTitle: pick('channelTitle', true),
    channelId: pick('channelId', true),
    channelUrl: pick('channelUrl', true),
    channelThumbnail: pick('channelThumbnail', true),
    description: pick('description'),
    duration: pick('duration'),
    publishedAt: pick('publishedAt'),
    transcript: pick('transcript'),
    transcriptSegments: pick('transcriptSegments'),
    transcriptSource: pick('transcriptSource'),
    transcriptStatus: pick('transcriptStatus'),
    transcriptLength: pick('transcriptLength'),
    manualTranscript: pick('manualTranscript'),
    whisperTranscript: pick('whisperTranscript'),
    aiChapters: pick('aiChapters'),
    chapters: pick('chapters'),
    descriptionChapters: pick('descriptionChapters'),
    chapterSource: pick('chapterSource'),
    shortSummary: pick('shortSummary'),
    fullSummary: pick('fullSummary'),
    aiSummaryShort: pick('aiSummaryShort'),
    aiSummaryLong: pick('aiSummaryLong'),
    keyPoints: pick('keyPoints'),
    keyInsights: pick('keyInsights'),
    brainSummary: pick('brainSummary'),
    analysisStatus: pick('analysisStatus'),
    analysisProvider: pick('analysisProvider'),
    analyzedAt: pick('analyzedAt'),
    analysisQuality: pick('analysisQuality'),
    isSaved: base.isSaved ?? next.isSaved,
    topicIds:
      Array.isArray(next.topicIds) && next.topicIds.length > 0
        ? next.topicIds
        : base.topicIds,
    mentorId: next.mentorId != null && next.mentorId !== '' ? next.mentorId : base.mentorId,
    tags: Array.isArray(base.tags) && base.tags.length > 0 ? base.tags : next.tags,
  };
}
