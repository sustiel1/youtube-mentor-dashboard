import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveItemEvidenceTime } from '../src/lib/evidenceTimestamp.js';

const segments = [
  { text: 'הפד השאיר את הריבית ללא שינוי ברמה הנוכחית', startSeconds: 0.56, durationSeconds: 3.2 },
  { text: 'המשך שאינו קשור לתובנה הנבדקת', startSeconds: 8.4, durationSeconds: 2 },
];
const verified = resolveItemEvidenceTime(
  { text: 'הפד השאיר את הריבית ללא שינוי', startSeconds: 0.56, timestampSource: 'youtube-timedtext', timestampConfidence: 1 },
  'הפד השאיר את הריבית ללא שינוי',
  segments,
);
assert.equal(verified.startSeconds, 0.56);
assert.equal(resolveItemEvidenceTime({ text: 'ישן', startSeconds: 12 }, 'ישן', []), null);
assert.equal(resolveItemEvidenceTime('פריט legacy ללא התאמה', 'פריט legacy ללא התאמה', segments), null);

const panel = fs.readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
const learning = fs.readFileSync(new URL('../src/components/dashboard/LearningTabContent.jsx', import.meta.url), 'utf8');
const insights = fs.readFileSync(new URL('../src/components/dashboard/InsightsStructuredView.jsx', import.meta.url), 'utf8');
const button = fs.readFileSync(new URL('../src/components/shared/EvidenceTimestampButton.jsx', import.meta.url), 'utf8');
assert.equal((panel.match(/useYouTubePlayer\(/g) || []).length, 1);
assert.ok(panel.includes('playerRef={videoPlayerRef}'));
assert.ok(panel.includes('transcriptSegments={storedTranscriptSegments}'));
assert.ok(panel.includes('onSeek={seekVideoTo}'));
assert.ok(learning.includes('resolveItemEvidenceTime'));
assert.ok(insights.includes('resolveItemEvidenceTime'));
assert.ok(button.includes('event.stopPropagation()'));
assert.ok(button.includes('aria-label='));

console.log(JSON.stringify({ status: 'passed', verifiedOnly: true, singlePlayerOwner: true, checkboxIndependent: true, legacyUntimedCompatible: true }, null, 2));
