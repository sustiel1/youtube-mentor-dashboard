import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseStructuredMarketResponse, buildMarketExtractionPrompt } = require('../shared/marketExtractionContract.cjs');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const timing = await vite.ssrLoadModule('/src/lib/evidenceTimestamp.js');
  const { extractUniversalTabContent } = await vite.ssrLoadModule('/src/lib/universalTabSections.js');

  assert.deepEqual(timing.normalizeEvidenceTime({
    startSeconds: 0,
    endSeconds: 4.5,
    timestampSource: 'youtube-timedtext',
    timestampConfidence: 1,
  }), { startSeconds: 0, endSeconds: 4.5, timestampSource: 'youtube-timedtext', timestampConfidence: 1 });
  assert.equal(timing.formatEvidenceTimestamp(522.4), '08:42');
  assert.equal(timing.formatEvidenceTimestamp(3858.9), '1:04:18');
  assert.equal(timing.normalizeEvidenceTime({ startSeconds: -1, timestampSource: 'explicit-input' }), null);
  assert.equal(timing.normalizeEvidenceTime({ startSeconds: null, timestampSource: 'explicit-input' }), null);
  assert.equal(timing.normalizeEvidenceTime({ startSeconds: 4, timestampSource: 'explicit-input', timestampBasis: 'chunk-relative' }), null);
  assert.equal(timing.normalizeEvidenceTime({ startSeconds: 10, endSeconds: 10, timestampSource: 'explicit-input' }), null);
  assert.equal(timing.normalizeEvidenceTime({ startSeconds: 10, timestampSource: 'unavailable' }), null);
  assert.equal(timing.normalizeEvidenceTime({ startSeconds: 10, timestampSource: 'explicit-input', timestampConfidence: 0.71 }), null);

  const segments = [
    { text: 'CrowdStrike הכתה בהכנסות וברווחים אך ירדה לאחר המסחר בגלל ציפיות גבוהות', startSeconds: 522.4, durationSeconds: 25.7 },
    { text: 'דיון כללי על מצב השוק והמדדים', startSeconds: 900 },
  ];
  const aligned = timing.alignItemToTimedSegments(
    'CrowdStrike הכתה בהכנסות וברווחים אך ירדה לאחר המסחר בגלל ציפיות גבוהות',
    segments,
  );
  assert.equal(aligned.startSeconds, 522.4);
  assert.equal(aligned.timestampSource, 'timed-transcript-alignment');
  assert.equal(timing.alignItemToTimedSegments('חשוב לנהל סיכונים', segments), null);
  assert.equal(timing.alignItemToTimedSegments('טקסט ללא תזמון', [{ text: 'טקסט ללא תזמון' }]), null);
  const multiSegment = timing.alignItemToTimedSegments(
    'Broadcom הציגה צמיחה חזקה אך המניה ירדה לאחר המסחר',
    [
      { text: 'Broadcom הציגה צמיחה חזקה', startSeconds: 736.2, durationSeconds: 4 },
      { text: 'אך המניה ירדה לאחר המסחר', startSeconds: 740.2, durationSeconds: 4 },
    ],
  );
  assert.equal(multiSegment.startSeconds, 736.2);

  const shaped = extractUniversalTabContent({}, 'insights', { universalTabs: { insights: {
    top5Insights: [{ insight: 'תובנה מתוזמנת', startSeconds: 0, timestampSource: 'explicit-input', timestampConfidence: 1 }],
    learningInsights: [{ lesson: 'לקח מתוזמן', whyImportant: 'הסבר', startSeconds: 12.6, timestampSource: 'youtube-timedtext' }],
  } } });
  assert.equal(shaped.sections.reduce((sum, section) => sum + section.items.length, 0), 2);
  assert.equal(shaped.sections[0].items[0].startSeconds, 0);
  assert.equal(shaped.sections[1].items[0].startSeconds, 12.6);
  assert.doesNotMatch(shaped.sections[1].items[0].text, /lesson:|whyImportant:|category:|applicableToApp:|\|/);

  const useful = extractUniversalTabContent({}, 'useful-knowledge', { universalTabs: { usefulKnowledge: {
    reusableKnowledge: [{ text: 'ידע מתוזמן', startSeconds: 17.4, timestampSource: 'official-youtube-chapter' }, 'ידע ישן'],
  } } });
  assert.equal(useful.sections[0].items.length, 2);
  assert.equal(useful.sections[0].items[0].startSeconds, 17.4);
  assert.equal(useful.sections[0].items[1], 'ידע ישן');

  const parsed = parseStructuredMarketResponse(JSON.stringify({
    contentType: 'marketBrief',
    top5Insights: [{ insight: 'אפס תקין', startSeconds: 0, timestampSource: 'explicit-input', timestampConfidence: 1 }],
    learningInsights: [{ lesson: 'ערך false נשמר', applicableToApp: false, startSeconds: 12.6, timestampSource: 'youtube-timedtext' }],
  }), { allowEmpty: true });
  assert.equal(parsed.top5Insights[0].startSeconds, 0);
  assert.equal(parsed.learningInsights[0].applicableToApp, false);
  assert.equal(parsed.learningInsights[0].startSeconds, 12.6);

  const nestedPayload = {
    contentType: 'marketBrief',
    universalTabs: {
      insights: {
        top5Insights: [{ insight: 'nested zero', startSeconds: 0, endSeconds: 4.25, timestampSource: 'youtube-timedtext', timestampConfidence: 1 }],
        learningInsights: [{ lesson: 'nested false', applicableToApp: false, startSeconds: null, endSeconds: null, timestampSource: 'unavailable', timestampConfidence: null }],
        marketLessons: [{ text: 'decimal', startSeconds: 12.75, timestampSource: 'explicit-input', timestampConfidence: 0.9 }],
      },
      usefulKnowledge: { group: { leaf: [{ text: 'knowledge', startSeconds: 22.5, timestampSource: 'official-youtube-chapter', timestampConfidence: 1 }] } },
    },
  };
  const nestedParsed = parseStructuredMarketResponse(JSON.stringify(nestedPayload), { allowEmpty: true });
  assert.equal(nestedParsed.top5Insights[0].startSeconds, 0);
  assert.equal(nestedParsed.top5Insights, nestedParsed.universalTabs.insights.top5Insights);
  assert.equal(nestedParsed.learningInsights[0].applicableToApp, false);
  assert.equal(nestedParsed.learningInsights[0].startSeconds, null);
  assert.equal(nestedParsed.universalTabs.usefulKnowledge.group.leaf[0].startSeconds, 22.5);
  assert.deepEqual(JSON.parse(JSON.stringify(nestedParsed)).universalTabs.insights.top5Insights, nestedParsed.universalTabs.insights.top5Insights);
  assert.throws(() => parseStructuredMarketResponse(JSON.stringify({ contentType: 'marketBrief', universalTabs: { insights: { conclusions: [{ text: 'bad', startSeconds: -1, timestampSource: 'explicit-input' }] } } }), { allowEmpty: true }), /must not be negative/);
  assert.throws(() => parseStructuredMarketResponse(JSON.stringify({ contentType: 'marketBrief', universalTabs: { usefulKnowledge: { leaf: [{ text: 'bad end', startSeconds: 8, endSeconds: 7, timestampSource: 'explicit-input' }] } } }), { allowEmpty: true }), /greater than startSeconds/);
  const prompt = buildMarketExtractionPrompt({
    title: 'timed input', transcriptChunk: 'spoken evidence',
    transcriptSegments: [{ startSeconds: 0.56, durationSeconds: 4.2, text: 'spoken evidence' }],
  });
  assert.match(prompt, /"startSeconds":0\.56/);
  assert.match(prompt, /"durationSeconds":4\.2/);

  const panelSource = fs.readFileSync('src/components/dashboard/VideoDetailPanel.jsx', 'utf8');
  const chipSource = fs.readFileSync('src/components/shared/EvidenceTimestampButton.jsx', 'utf8');
  const hookSource = fs.readFileSync('src/hooks/useYouTubePlayer.js', 'utf8');
  assert.match(panelSource, /seekTo: seekVideoTo/);
  assert.match(panelSource, /onSeek=\{seekVideoTo\}/);
  assert.match(chipSource, /event\.stopPropagation\(\)/);
  assert.match(chipSource, /type="button"/);
  assert.match(hookSource, /pendingSeekRef\.current = value/);
  assert.match(hookSource, /playVideo/);

  console.log('Evidence timestamps regression: PASS');
} finally {
  await vite.close();
}
