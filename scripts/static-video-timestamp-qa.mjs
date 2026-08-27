import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildStaticYouTubeTimestampLink,
  formatStaticVideoTimestamp,
  resolveStaticVideoTimestamp,
} from '../src/lib/staticVideoTimestamp.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const videoId = 'dQw4w9WgXcQ';

const exact = buildStaticYouTubeTimestampLink(videoId, { timestampSeconds: 729 });
assert.equal(exact.href, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=729s');
assert.equal(exact.visibleLabel, '▶ 12:09');
assert.equal(exact.ariaLabel, 'פתח את הסרטון בזמן 12:09');
assert.equal(exact.target, '_blank');
assert.equal(exact.rel, 'noopener noreferrer');

const estimated = buildStaticYouTubeTimestampLink(videoId, { estimatedStartSeconds: 729 });
assert.equal(estimated.href, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=729s');
assert.equal(estimated.visibleLabel, '▶ ≈12:09');
assert.equal(estimated.ariaLabel, 'פתח את הסרטון באזור הזמן המשוער 12:09');

const zero = buildStaticYouTubeTimestampLink(videoId, { timestampSeconds: 0 });
assert.equal(zero.href, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0s');
assert.equal(zero.visibleLabel, '▶ 00:00');

assert.equal(formatStaticVideoTimestamp(59), '00:59');
assert.equal(formatStaticVideoTimestamp(729), '12:09');
assert.equal(formatStaticVideoTimestamp(3661), '1:01:01');
assert.equal(resolveStaticVideoTimestamp({ startSeconds: 729, timestampKind: 'estimated' }).estimated, true);
assert.deepEqual(resolveStaticVideoTimestamp({ exactStartSeconds: 5, estimatedStartSeconds: 8 }), {
  seconds: 5,
  label: '00:05',
  estimated: false,
});

for (const invalid of [null, undefined, -1, '729', Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(resolveStaticVideoTimestamp({ estimatedStartSeconds: invalid }), null, `invalid time rejected: ${String(invalid)}`);
}
assert.equal(resolveStaticVideoTimestamp('plain row'), null);
assert.equal(resolveStaticVideoTimestamp({ text: 'object without time' }), null);
assert.equal(buildStaticYouTubeTimestampLink('', { timestampSeconds: 1 }), null);
assert.equal(buildStaticYouTubeTimestampLink('not-a-youtube-id', { timestampSeconds: 1 }), null);

const componentSource = read('src/components/shared/StaticVideoTimestampLink.jsx');
const utilitySource = read('src/lib/staticVideoTimestamp.js');
const learningSource = read('src/components/dashboard/LearningTabContent.jsx');
const insightsSource = read('src/components/dashboard/InsightsStructuredView.jsx');
const dedicatedSource = read('src/components/dashboard/DedicatedContentSection.jsx');
const specializedSource = read('src/components/dashboard/SpecializedContentRenderer.jsx');
const panelSource = read('src/components/dashboard/VideoDetailPanel.jsx');

assert.match(componentSource, /data-static-video-time/);
assert.match(componentSource, /min-h-9/);
assert.match(componentSource, /max-w-full/);
assert.match(componentSource, /whitespace-nowrap/);
assert.match(componentSource, /dir="ltr"/);
assert.match(componentSource, /event\.stopPropagation\(\)/);
assert.match(learningSource, /StaticVideoTimestampLink/);
assert.match(learningSource, /data-static-time-candidate/);
assert.match(insightsSource, /StaticVideoTimestampActions/);
assert.match(dedicatedSource, /videoId=\{videoId\}/);
assert.match(specializedSource, /STATIC_TIME_NARRATIVE_TAB_KEYS/);
assert.match(panelSource, /TabsContent value="chapters"/);

const forbiddenRenderIo = /transcript|findTranscriptReference|textMatchScore|fuzzy|localStorage|indexedDB|Promise|async\s/;
assert.doesNotMatch(`${utilitySource}\n${componentSource}`, forbiddenRenderIo);
assert.doesNotMatch(utilitySource, /useContext/, 'the static link utility remains framework- and context-free');
assert.doesNotMatch(componentSource, /onClick=\{[^}]*seek|window\.open/i);

const repeated = buildStaticYouTubeTimestampLink(videoId, { estimatedStartSeconds: 729 });
assert.deepEqual(repeated, estimated, 'pure repeat resolution cannot duplicate or mutate state');

console.log('Static video timestamp QA: PASS');
