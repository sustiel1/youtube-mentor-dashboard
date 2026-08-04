import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const timing = await vite.ssrLoadModule('/src/lib/chapterTimingSafety.js');
  const transcripts = await vite.ssrLoadModule('/src/lib/videoTranscriptUtils.js');
  const analytics = await vite.ssrLoadModule('/src/services/videoAnalytics.js');
  const generalValidator = await vite.ssrLoadModule('/src/ai/gemini/validators/validateGeneral.js');
  const marketValidator = await vite.ssrLoadModule('/src/ai/gemini/validators/validateMarket.js');
  const politicalValidator = await vite.ssrLoadModule('/src/ai/gemini/validators/validatePolitical.js');
  const generalSchema = await vite.ssrLoadModule('/src/ai/gemini/schemas/generalSchema.js');
  const marketSchema = await vite.ssrLoadModule('/src/ai/gemini/schemas/marketSchema.js');
  const politicalSchema = await vite.ssrLoadModule('/src/ai/gemini/schemas/politicalSchema.js');

  assert.equal(timing.normalizeChapterTiming({ startSeconds: -1, timestampSource: 'explicit-input' }).startSeconds, null);
  assert.equal(timing.normalizeChapterTiming({ startSeconds: 0.56, endSeconds: 2.75, timestampSource: 'youtube-timedtext' }).startSeconds, 0.56);
  assert.equal(timing.normalizeChapterTiming({ startSeconds: 120, timeSource: 'estimated' }).startSeconds, null);

  const distributed = timing.removeEvenlyDistributedTiming([0, 60, 120, 180].map((startSeconds, index) => ({ title: `c${index}`, startSeconds, timestampSource: 'explicit-input' })));
  assert.ok(distributed.every((chapter) => chapter.startSeconds == null && chapter.timestampSource === 'unavailable'));

  const transcript = transcripts.resolveTranscriptForChapters({ transcriptSegments: ['a', 'b', 'c'], transcript: 'plain text without timestamps '.repeat(30) });
  assert.equal(transcript.lines.length, 0);
  assert.equal(transcript.hasUsableText, false);
  const timedTranscript = transcripts.resolveTranscriptForChapters({ transcriptSegments: [{ text: 'אחד', startSeconds: 0.56 }, { text: 'שתיים', startSeconds: 2.75 }] });
  assert.equal(timedTranscript.lines[0].startSeconds, 0.56);

  const outline = analytics.outlineWithEstimatedTimes([{ title: 'אחד' }, { title: 'שתיים' }], { durationSeconds: 600 });
  assert.ok(outline.every((chapter) => chapter.startSeconds == null));
  assert.deepEqual(analytics.buildDurationFallbackChapters({ durationSeconds: 600 }), []);
  assert.equal(analytics.chaptersToVideoTopics([{ title: 'מדויק', startSeconds: 0.56 }])[0].timestampSeconds, 0.56);

  const alignmentLines = [
    { text: 'הפד השאיר את הריבית ללא שינוי ברמה הנוכחית', start: 0.56, duration: 3.2 },
    { text: 'נושא אחר לחלוטין על שוק העבודה', start: 8.4, duration: 2 },
    { text: 'דיון נוסף שאינו קשור לריבית', start: 15.2, duration: 2 },
    { text: 'עוד קטע בדיקה עצמאי', start: 22.7, duration: 2 },
    { text: 'סיום התמלול ללא התאמה נוספת', start: 31.1, duration: 2 },
  ];
  const matched = analytics.matchChaptersToTranscript(
    [{ title: 'הפד והריבית', description: 'הפד השאיר את הריבית ללא שינוי ברמה הנוכחית' }],
    { lines: alignmentLines },
  );
  assert.equal(matched[0].startSeconds, 0.56);
  assert.equal(matched[0].timestampSource, 'timed-transcript-alignment');
  assert.equal(analytics.matchChaptersToTranscript(
    [{ title: 'פרק ללא התאמה', description: 'טקסט ייחודי שאינו קיים באף מקטע' }],
    { lines: alignmentLines },
  ), null);

  const validated = analytics.validateChaptersForSave([
    { title: 'נושא ראשון ברור', summary: 'תיאור מספיק ארוך עבור הפרק הראשון', keyPoints: ['א'] },
    { title: 'נושא שני ברור', summary: 'תיאור מספיק ארוך עבור הפרק השני', keyPoints: ['ב'] },
    { title: 'נושא שלישי ברור', summary: 'תיאור מספיק ארוך עבור הפרק השלישי', keyPoints: ['ג'] },
  ]);
  assert.equal(validated.ok, true);
  assert.ok(validated.chapters.every((chapter) => chapter.startSeconds == null));

  const untimedChapter = { title: 'נושא מבוסס תוכן', summary: 'סיכום תקין', startSeconds: 120 };
  assert.equal(generalValidator.normalizeGeneralResult({ chapters: [untimedChapter] }).chapters[0].startSeconds, null);
  assert.equal(marketValidator.normalizeMarketResult({ chapters: [untimedChapter] }).chapters[0].startSeconds, null);
  assert.equal(politicalValidator.normalizePoliticalResult({ chapters: [untimedChapter] }).chapters[0].startSeconds, null);
  assert.equal(
    politicalValidator.normalizePoliticalResult({ chapters: [{ title: untimedChapter.title, summary: untimedChapter.summary, timestamp: '00:00.56' }] }).chapters[0].startSeconds,
    0.56,
  );

  for (const schemaText of [
    generalSchema.getGeneralSchemaExample(),
    marketSchema.getMarketSchemaExample(),
    politicalSchema.getPoliticalSchemaExample(),
  ]) {
    const example = JSON.parse(schemaText);
    assert.ok(example.chapters.every((chapter) => chapter.startSeconds == null && chapter.timestampSource === 'unavailable'));
  }

  const source = [
    '../src/components/dashboard/VideoDetailPanel.jsx',
    '../src/lib/videoTranscriptUtils.js',
    '../src/ai/gemini/schemas/generalSchema.js',
    '../src/ai/gemini/schemas/marketSchema.js',
    '../src/ai/gemini/schemas/politicalSchema.js',
    '../src/ai/gemini/validators/validatePolitical.js',
    '../src/ai/quickCopyPrompts.js',
  ].map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  for (const unsafe of ['i * 120', 'i * 150', 'index * 5', 'i * 60', 'plain_text_estimated', 'estimated_from_text', 'הערך לפי סדר הטקסט']) {
    assert.equal(source.includes(unsafe), false, `unsafe timing pattern remains: ${unsafe}`);
  }

  console.log(JSON.stringify({ status: 'passed', decimalsPreserved: true, pseudoTimingRemoved: true, untimedChaptersPreserved: true }, null, 2));
} finally {
  await vite.close();
}
