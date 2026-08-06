import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatAdditiveChapterResult,
  prepareAdditiveChapterMerge,
} from '../src/lib/additiveChapterMerge.js';

const existing = Array.from({ length: 7 }, (_, index) => ({
  id: `existing-${index}`,
  title: `פרק קיים ${index}`,
  summary: `סיכום ידני ${index}`,
  keyPoints: [`נקודה ${index}`],
  startSeconds: index === 0 ? 0 : index * 100,
  endSeconds: index * 100 + 90,
  timestampSource: 'verified',
  timestampConfidence: index === 0 ? 0 : 0.95,
  manuallyEdited: true,
  selected: index === 2,
  provenance: { source: 'user' },
  unknownLegacyField: `legacy-${index}`,
}));

const candidates = [
  { id: 'new-timed', title: 'פרק חדש מתוזמן', startSeconds: 250.56, endSeconds: 275.25, source: 'gem' },
  { id: 'new-untimed', title: 'פרק חדש ללא זמן', source: 'gem' },
];

const merged = prepareAdditiveChapterMerge(existing, candidates);
assert.equal(merged.ok, true);
assert.equal(merged.chapters.length, 9);
assert.equal(merged.existingCount, 7);
assert.equal(merged.addedCount, 2);
assert.deepEqual(merged.chapters.filter((chapter) => chapter.id?.startsWith('existing-')), existing);
assert.equal(merged.chapters.at(-1).id, 'new-untimed');
assert.equal(merged.chapters.find((chapter) => chapter.id === 'new-timed').startSeconds, 250.56);

const duplicateId = prepareAdditiveChapterMerge(existing, [
  { id: 'existing-2', title: 'כותרת אוטומטית שונה', startSeconds: 200, endSeconds: 290 },
]);
assert.equal(duplicateId.addedCount, 0);
assert.equal(duplicateId.duplicateCount, 1);
assert.strictEqual(duplicateId.chapters[2], existing[2]);

const duplicateTimedTitle = prepareAdditiveChapterMerge(existing, [
  { title: '  פרק, קיים 3! ', startSeconds: 300.8, endSeconds: 390 },
]);
assert.equal(duplicateTimedTitle.duplicateCount, 1);

const untimedExisting = [{ title: 'פרק ללא זמן', summary: 'נשמר' }];
const duplicateUntimed = prepareAdditiveChapterMerge(untimedExisting, [{ title: 'פרק ללא זמן' }]);
assert.equal(duplicateUntimed.duplicateCount, 1);
assert.strictEqual(duplicateUntimed.chapters[0], untimedExisting[0]);

const sameTopicDifferentTime = prepareAdditiveChapterMerge(existing, [
  { title: 'פרק קיים 3', startSeconds: 350, endSeconds: 375 },
]);
assert.equal(sameTopicDifferentTime.addedCount, 1);

const ambiguousBoundary = prepareAdditiveChapterMerge(existing, [
  { title: 'כותרת אחרת', startSeconds: 300.4, endSeconds: 350 },
]);
assert.equal(ambiguousBoundary.addedCount, 0);
assert.equal(ambiguousBoundary.uncertainCount, 1);

const empty = prepareAdditiveChapterMerge(existing, []);
assert.equal(empty.ok, true);
assert.equal(empty.addedCount, 0);
assert.deepEqual(empty.chapters, existing);

for (const invalidCandidate of [
  { title: 'שלילי', startSeconds: -1 },
  { title: 'סיום שגוי', startSeconds: 10, endSeconds: 10 },
  { title: '', startSeconds: 10 },
]) {
  const invalid = prepareAdditiveChapterMerge(existing, [invalidCandidate]);
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.chapters, existing);
}

const zeroTimestamp = prepareAdditiveChapterMerge([], [
  { id: 'zero', title: 'אפס', startSeconds: 0, endSeconds: 0.5 },
]);
const decimalTimestamp = prepareAdditiveChapterMerge([], [
  { id: 'decimal', title: 'עשרוני', startSeconds: 0.56, endSeconds: 1.25 },
]);
assert.equal(zeroTimestamp.ok, true);
assert.equal(decimalTimestamp.ok, true);
assert.equal(zeroTimestamp.chapters[0].startSeconds, 0);
assert.equal(decimalTimestamp.chapters[0].startSeconds, 0.56);

const officialDuplicate = prepareAdditiveChapterMerge(existing, [
  { title: 'כותרת מקורית', chapterSource: 'youtube', sourceId: 'official-1', startSeconds: 800 },
]);
const officialSecondPass = prepareAdditiveChapterMerge(officialDuplicate.chapters, [
  { title: 'כותרת מעודכנת', chapterSource: 'youtube', sourceId: 'official-1', startSeconds: 800 },
]);
assert.equal(officialSecondPass.duplicateCount, 1);

assert.match(formatAdditiveChapterResult(merged), /נשמרו 7 פרקים קיימים/);
assert.match(formatAdditiveChapterResult(merged), /נוספו 2 פרקים חדשים/);
assert.match(formatAdditiveChapterResult(empty), /נשמרו ללא שינוי/);
assert.match(formatAdditiveChapterResult({ ok: false }), /לא בוצע שינוי/);

const panelSource = readFileSync(
  new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url),
  'utf8',
);
const autoHandler = panelSource.slice(
  panelSource.indexOf('const handleAutoDetectChapters'),
  panelSource.indexOf('const handleGenerateHebrewTitles'),
);
assert.match(autoHandler, /activeChapterScanRef\.current/);
assert.match(autoHandler, /persistAutomaticChapterCandidates\(aiChapters, scanId, 'description_timestamp'\)/);
assert.match(autoHandler, /handleGenerateTranscriptChapters\(\{ additive: true, scanId \}\)/);
assert.match(autoHandler, /persistAutomaticChapterCandidates\(aiChapters, scanId, 'gem'\)/);
assert.doesNotMatch(autoHandler, /descriptionChapters:\s*aiChapters/);
assert.match(panelSource, /disabled=\{isYoutubeChaptersFetch\}/);
assert.match(panelSource, /בדיקת הפרקים נכשלה\. הפרקים הקיימים נשמרו ללא שינוי/);

console.log(JSON.stringify({
  status: 'passed',
  existingPreserved: existing.length,
  finalCount: merged.chapters.length,
  added: merged.addedCount,
  duplicateRules: 4,
  timestamps: ['0', '0.56'],
}, null, 2));
