import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

import {
  formatChapterTime,
  hasEstimatedChapterTimes,
  parseChapterTimeToSeconds,
  resolveChapterNavigationData,
} from '../src/lib/chapterTimestamp.js';
import {
  CHAPTER_DUPLICATE_TOLERANCE_SECONDS,
  chaptersAreDuplicates,
  getHebrewTitlesErrorMessage,
  mergeChapterSources,
} from '../src/lib/chapterEnrichment.js';
import { buildTimestampUrl } from '../src/services/youtubeMetadata.js';

assert.equal(parseChapterTimeToSeconds('03:42'), 222, 'MM:SS converts to seconds');
assert.equal(parseChapterTimeToSeconds('1:02:03'), 3723, 'HH:MM:SS converts to seconds');
assert.equal(parseChapterTimeToSeconds(738), 738, 'numeric seconds remain valid');
assert.equal(parseChapterTimeToSeconds('738'), 738, 'numeric-string seconds remain valid');
assert.equal(parseChapterTimeToSeconds('00:00'), 0, '00:00 remains a valid timestamp');
assert.equal(formatChapterTime(0), '00:00');
assert.equal(formatChapterTime(3723), '1:02:03');

for (const invalid of [null, undefined, '', ' ', -1, '-1', '03:99', '1:60:00', 'bad']) {
  assert.equal(parseChapterTimeToSeconds(invalid), null, `invalid timestamp rejected: ${String(invalid)}`);
}

assert.deepEqual(
  resolveChapterNavigationData({ startTime: '12:18' }),
  { available: true, seconds: 738, label: '12:18' },
  'startTime alias remains navigable',
);

const missingGemTiming = mergeChapterSources({
  gemChapters: [{ title: 'מדיניות הפד והריבית', startSeconds: null, chapterSource: 'gem' }],
  automaticChapters: [{ title: 'מדיניות הפד ושינויי ריבית', startSeconds: 289, timeSource: 'estimated_transcript', isEstimated: true }],
  durationSeconds: 900,
});
assert.equal(missingGemTiming.chapters.length, 1, 'a transcript timing match enriches an untimed GEMS chapter without duplication');
assert.equal(missingGemTiming.chapters[0].startSeconds, 289, 'the matched transcript timestamp is preserved');
assert.equal(missingGemTiming.chapters[0].chapterSource, 'gem', 'the higher-priority GEMS chapter source is preserved');
assert.equal(missingGemTiming.chapters[0].timestampSource, 'estimated_transcript', 'the timing source remains explicit');
assert.equal(missingGemTiming.enrichedAutomatic.length, 1, 'timing enrichment is reported separately from added chapters');
assert.equal(missingGemTiming.acceptedAutomatic.length, 0, 'timing enrichment does not report a duplicate chapter addition');

const unknownDurationTiming = mergeChapterSources({
  gemChapters: [{ title: 'Untimed chapter', startSeconds: null, chapterSource: 'gem' }],
  automaticChapters: [{ title: 'Untimed chapter', startSeconds: 125, timeSource: 'estimated_transcript' }],
  durationSeconds: 0,
});
assert.equal(
  unknownDurationTiming.chapters[0].startSeconds,
  125,
  'missing video duration does not discard a valid transcript timestamp',
);
assert.equal(unknownDurationTiming.enrichedAutomatic.length, 1, 'unknown-duration timing enrichment is reported');
assert.deepEqual(
  resolveChapterNavigationData({ startSeconds: null, timestamp: '' }),
  { available: false, seconds: null, label: '' },
  'missing timestamps remain unavailable',
);

assert.equal(
  hasEstimatedChapterTimes([{ startSeconds: 222, timeSource: 'estimated' }]),
  true,
  'estimated time sources show the shared indication',
);
assert.equal(
  hasEstimatedChapterTimes([{ timestamp: '03:42', timestampSource: 'estimated_proportional' }]),
  true,
  'estimated timestamp sources show the shared indication',
);
assert.equal(
  hasEstimatedChapterTimes([{ startSeconds: 222, isEstimated: true }]),
  true,
  'explicit estimated flags show the shared indication',
);
assert.equal(
  hasEstimatedChapterTimes([{ startSeconds: 222, timeSource: 'real', isEstimated: false }]),
  false,
  'confirmed times do not show the shared indication',
);
assert.equal(
  hasEstimatedChapterTimes([{ startSeconds: null, isEstimated: true }]),
  false,
  'chapters without a displayed timestamp do not show the indication',
);

const youtubeOnly = [
  { title: 'פתיחה', startSeconds: 0, chapterSource: 'description_timestamp', isEstimated: false },
  { title: 'סקירת שוק', startSeconds: 240, chapterSource: 'description_timestamp', isEstimated: false },
];
const youtubeOnlyResult = mergeChapterSources({ youtubeChapters: youtubeOnly, durationSeconds: 420 });
assert.deepEqual(youtubeOnlyResult.chapters.map(ch => ch.title), ['פתיחה', 'סקירת שוק'], 'YouTube-only chapters are preserved');
assert.equal(youtubeOnlyResult.acceptedAutomatic.length, 0, 'YouTube-only flow adds no automatic chapters');

const gemsOnly = [
  { title: 'מניות הבנקים', startSeconds: 60, chapterSource: 'gem' },
  { title: 'מדיניות הריבית', startSeconds: 220, chapterSource: 'gem' },
];
const gemsOnlyResult = mergeChapterSources({ gemChapters: gemsOnly, durationSeconds: 360 });
assert.deepEqual(gemsOnlyResult.chapters.map(ch => ch.chapterSource), ['gem', 'gem'], 'GEMS-only chapters keep their source');

const bothSources = mergeChapterSources({
  youtubeChapters: youtubeOnly,
  gemChapters: [
    { title: 'פתיחה והקדמה', startSeconds: 0, chapterSource: 'gem' },
    { title: 'תחזית לשבוע', startSeconds: 120, chapterSource: 'gem' },
  ],
  durationSeconds: 420,
});
assert.equal(bothSources.chapters.length, 3, 'overlapping YouTube/GEMS chapters are deduplicated');
assert.equal(bothSources.chapters[0].title, youtubeOnly[0].title, 'the authoritative YouTube title wins');
assert.equal(bothSources.chapters[0].startSeconds, youtubeOnly[0].startSeconds, 'the authoritative YouTube timestamp wins');
assert.equal(bothSources.chapters[0].chapterSource, youtubeOnly[0].chapterSource, 'the authoritative YouTube source wins');
assert.deepEqual(bothSources.chapters.map(ch => ch.startSeconds), [0, 120, 240], 'merged sources remain chronological');

const savedPriority = mergeChapterSources({
  youtubeChapters: [{ title: 'YouTube exact', startSeconds: 0, chapterSource: 'description_timestamp' }],
  gemChapters: [{ title: 'GEMS exact', startSeconds: 120, chapterSource: 'gem' }],
  savedChapters: [{ title: 'Saved manual', startSeconds: 240, chapterSource: 'manual' }],
  automaticChapters: [{ title: 'Automatic supplement', startSeconds: 420 }],
  durationSeconds: 600,
});
assert.deepEqual(
  savedPriority.chapters.map(ch => ch.chapterSource),
  ['description_timestamp', 'gem', 'manual', 'transcript_heuristic'],
  'source priority preserves YouTube, GEMS and saved/manual chapters before automatic supplements',
);

assert.equal(
  chaptersAreDuplicates(
    { title: 'סקירת מדדי השוק', startSeconds: 240 },
    { title: 'מדדי השוק וסקירה', startSeconds: 240 + CHAPTER_DUPLICATE_TOLERANCE_SECONDS },
  ),
  true,
  'near timestamps with overlapping text are duplicates',
);
assert.equal(
  chaptersAreDuplicates(
    { title: 'סקירת מדדי השוק', startSeconds: 240 },
    { title: 'ניתוח מניית אפל', startSeconds: 244 },
  ),
  false,
  'near timestamps with different content remain distinct',
);

const gapResult = mergeChapterSources({
  youtubeChapters: [
    { title: 'פתיחה', startSeconds: 0 },
    { title: 'סיום', startSeconds: 600 },
  ],
  automaticChapters: [
    { title: 'דיון אמצעי', startSeconds: 300 },
    { title: 'פתיחה אוטומטית', startSeconds: 4 },
  ],
  durationSeconds: 660,
});
assert.equal(gapResult.acceptedAutomatic.length, 1, 'only a meaningful-gap automatic chapter is accepted');
assert.equal(gapResult.acceptedAutomatic[0].title, 'דיון אמצעי');
assert.equal(gapResult.acceptedAutomatic[0].isEstimated, true, 'automatic timestamps remain estimated');
assert.deepEqual(gapResult.chapters.map(ch => ch.startSeconds), [0, 300, 600], 'automatic additions are ordered chronologically');

const completeResult = mergeChapterSources({
  youtubeChapters: [
    { title: 'פתיחה', startSeconds: 0 },
    { title: 'אמצע', startSeconds: 150 },
    { title: 'סיום', startSeconds: 300 },
  ],
  automaticChapters: [{ title: 'תוספת לא נחוצה', startSeconds: 75 }],
  durationSeconds: 420,
});
assert.equal(completeResult.complete, true, 'complete authoritative chapters are detected before generation');
assert.equal(completeResult.acceptedAutomatic.length, 0, 'complete chapters do not accept automatic additions');

const unchangedOnFailure = structuredClone(youtubeOnly);
assert.deepEqual(
  mergeChapterSources({ youtubeChapters: unchangedOnFailure, automaticChapters: null, durationSeconds: 420 })
    .chapters.map(ch => [ch.title, ch.startSeconds, ch.chapterSource]),
  youtubeOnly.map(ch => [ch.title, ch.startSeconds, ch.chapterSource]),
  'a missing/malformed automatic result leaves existing chapters unchanged',
);

const firstPass = mergeChapterSources({
  youtubeChapters: [{ title: 'פתיחה', startSeconds: 0 }],
  automaticChapters: [{ title: 'השלמה', startSeconds: 240 }],
  durationSeconds: 360,
});
const reloadPass = mergeChapterSources({
  youtubeChapters: [{ title: 'פתיחה', startSeconds: 0 }],
  automaticChapters: firstPass.acceptedAutomatic,
  durationSeconds: 360,
});
assert.equal(reloadPass.chapters.length, firstPass.chapters.length, 'reload/persistence does not duplicate supplements');

assert.match(
  getHebrewTitlesErrorMessage({ message: '404 model is no longer available' }),
  /מודל יצירת הכותרות אינו זמין/,
  'verified unavailable-model failure gets an accurate Hebrew message',
);
assert.match(
  getHebrewTitlesErrorMessage({ name: 'AbortError' }),
  /זמן רב מדי/,
  'request timeouts get a retryable Hebrew message',
);
assert.match(
  getHebrewTitlesErrorMessage({ code: 'INVALID_MODEL_RESPONSE' }),
  /תשובה לא תקינה/,
  'malformed model responses get an accurate Hebrew message',
);

const panelSource = await readFile(
  new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url),
  'utf8',
);
assert.equal(
  panelSource.match(/הזמנים משוערים/g)?.length ?? 0,
  1,
  'the shared estimated-times indication appears exactly once in the chapters panel',
);
assert.match(
  panelSource,
  /displayedChapterTimesAreEstimated\s*&&/,
  'the shared indication is conditionally rendered',
);
assert.match(panelSource, /השלם פרקים אוטומטית/, 'the action is clearly labeled as supplementation');
assert.match(panelSource, /autoSupplementalChapters/, 'automatic additions use an additive persistence field');
assert.match(
  panelSource.match(/const handleGenerateTranscriptChapters[\s\S]*?const \{ data: videoNotes/)[0],
  /fetchTranscriptPayload\(ytId\)/,
  'automatic supplementation fetches a YouTube transcript only when no usable transcript is already available',
);
assert.doesNotMatch(
  panelSource.match(/const handleGenerateTranscriptChapters[\s\S]*?const \{ data: videoNotes/)[0],
  /chapters:\s*aiChapters|aiChapters:\s*aiChapters/,
  'automatic supplementation does not replace legacy chapter arrays',
);

assert.equal(
  buildTimestampUrl('https://www.youtube.com/watch?v=video-id', 222),
  'https://www.youtube.com/watch?v=video-id&t=222',
  'YouTube navigation includes the correct time parameter',
);
assert.equal(
  buildTimestampUrl('https://youtu.be/video-id', 0),
  'https://youtu.be/video-id?t=0',
  'zero seconds remains a valid YouTube destination',
);
for (const seconds of [0, 222, 738]) {
  assert.match(
    buildTimestampUrl('https://www.youtube.com/watch?v=video-id', seconds),
    new RegExp(`[?&]t=${seconds}(?:&|$)`),
    `first/middle/final seek keeps ${seconds} seconds`,
  );
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: ChapterItem } = await server.ssrLoadModule('/src/components/dashboard/ChapterItem.jsx');
  const { chaptersFromAiAnalysisResult, matchChaptersToTranscript } = await server.ssrLoadModule('/src/services/videoAnalytics.js');
  const renderChapter = (section) => renderToStaticMarkup(React.createElement(ChapterItem, {
    section,
    videoUrl: 'https://www.youtube.com/watch?v=video-id',
    variant: 'row',
  }));

  const missingMarkup = renderChapter({ title: 'פרק ללא זמן', startSeconds: null });
  assert.match(missingMarkup, /חסר זמן לפרק/, 'missing-time state is visible in Hebrew');
  assert.match(missingMarkup, /dir="rtl"/, 'missing-time state uses Hebrew text direction');
  assert.doesNotMatch(missingMarkup, /<button/, 'missing-time chapter is not interactive');
  assert.doesNotMatch(missingMarkup, /00:00/, 'missing time is not coerced to 00:00');

  const zeroMarkup = renderChapter({ title: 'פתיחה', startSeconds: 0 });
  assert.match(zeroMarkup, /<button/, 'valid zero-time chapter is interactive');
  assert.match(zeroMarkup, /00:00/, 'valid zero-time chapter is displayed');

  const middleMarkup = renderChapter({ title: 'פרק אמצעי', timestamp: '03:42' });
  assert.match(middleMarkup, /<button/, 'valid timestamp-string chapter is interactive');
  assert.match(middleMarkup, /03:42/, 'valid timestamp string is displayed');

  const estimatedMarkup = renderChapter({
    title: 'פרק לדוגמה',
    startSeconds: 222,
    isEstimated: true,
    timestampSource: 'estimated',
    chapterSource: 'transcript_heuristic',
  });
  assert.match(estimatedMarkup, /<button/, 'estimated chapter remains interactive');
  assert.match(estimatedMarkup, /03:42/, 'estimated chapter keeps its timestamp');
  assert.doesNotMatch(estimatedMarkup, /משוער/, 'chapter rows do not repeat the estimated label');

  const malformedMarkup = renderChapter({ title: 'פרק פגום', timestamp: '03:99' });
  assert.match(malformedMarkup, /חסר זמן לפרק/, 'malformed timestamps render unavailable state');
  assert.doesNotMatch(malformedMarkup, /<button/, 'malformed timestamps are not interactive');

  const normalizedAliases = chaptersFromAiAnalysisResult({ chapters: [
    { title: 'MM:SS', startTime: '03:42' },
    { title: 'HH:MM:SS', timestamp: '1:02:03' },
    { title: 'Missing', startSeconds: null, timestamp: '' },
    { title: 'Malformed', timestamp: '03:99' },
  ] });
  assert.equal(normalizedAliases[0].startSeconds, 222, 'startTime is normalized at the shared data boundary');
  assert.equal(normalizedAliases[1].startSeconds, 3723, 'timestamp label is normalized at the shared data boundary');
  assert.equal('startSeconds' in normalizedAliases[2], false, 'missing source time stays absent after normalization');
  assert.equal('startSeconds' in normalizedAliases[3], false, 'malformed source time stays absent after normalization');

  const distributedMatches = matchChaptersToTranscript(
    Array.from({ length: 7 }, (_, index) => ({ title: `Topic ${index + 1}`, startSeconds: null })),
    { lines: Array.from({ length: 70 }, (_, index) => ({ text: `unrelated transcript line ${index}`, start: index * 10 })) },
  );
  assert.deepEqual(
    distributedMatches.map(chapter => chapter.startSeconds),
    [0, 100, 200, 300, 400, 500, 600],
    'transcript matching keeps every chapter in its allocated timeline window',
  );
} finally {
  await server.close();
}

console.log('chapter timestamp QA passed');
