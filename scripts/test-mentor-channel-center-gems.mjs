import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(fs.readFileSync(
  path.join(root, 'scripts/fixtures/mentor-channel-center-gems.json'),
  'utf8',
));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const registry = await vite.ssrLoadModule('/src/lib/mentorRegistry.js');
  const overrides = await vite.ssrLoadModule('/src/lib/mentorTopicOverrides.js');
  const launcher = await vite.ssrLoadModule('/src/lib/marketBriefGemLauncher.js');
  const sessions = await vite.ssrLoadModule('/src/lib/marketBriefSession.js');
  const specialized = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');

  const [micha, second, partial, malformed] = fixture.mentors;
  const michaCenter = registry.resolveMentorChannelCenter(micha);
  const secondCenter = registry.resolveMentorChannelCenter(second);
  const partialCenter = registry.resolveMentorChannelCenter(partial);
  const malformedCenter = registry.resolveMentorChannelCenter(malformed);

  assert.deepEqual(michaCenter.links.map((link) => link.key), ['home', 'videos', 'live', 'courses', 'playlists', 'posts']);
  assert.deepEqual(secondCenter.links.map((link) => link.key), ['home', 'videos', 'live', 'courses', 'playlists', 'posts']);
  assert.deepEqual(partialCenter.links.map((link) => link.key), ['home', 'playlists']);
  assert.equal(malformedCenter.links.length, 0);
  assert.equal(malformedCenter.status, 'unavailable');

  const normalizedSecond = registry.normalizeMentorRecord(second);
  assert.equal(normalizedSecond.name, 'מנטור שני');
  assert.equal(normalizedSecond.active, false);
  assert.equal(normalizedSecond.priority, 0);

  const duplicateLegacy = registry.resolveMentorChannelCenter({
    id: 'legacy-duplicate',
    name: 'Legacy',
    channelUrl: 'https://www.youtube.com/@LegacyMentor',
    youtubeUrl: 'https://www.youtube.com/@LegacyMentor',
    channelResources: [
      { key: 'home', url: 'https://www.youtube.com/@LegacyMentor' },
      { type: 'videos', url: 'https://www.youtube.com/@LegacyMentor/videos' },
    ],
  });
  assert.deepEqual(duplicateLegacy.links.map((link) => link.key), ['home', 'videos']);

  const emptyHome = registry.resolveMentorChannelCenter({
    id: 'explicit-empty',
    youtubeChannelId: 'UC1234567890123456789012',
    channelLinks: { home: '' },
  });
  assert.equal(emptyHome.links.length, 0, 'intentional empty home suppresses identity fallback');
  assert.equal(registry.resolveMentorChannelCenter(null), null);
  assert.equal(registry.sanitizeMentorChannelUrl('javascript:alert(1)', 'home'), '');
  assert.equal(registry.sanitizeMentorChannelUrl('https://example.com/@bad', 'home'), '');
  assert.equal(registry.sanitizeMentorChannelUrl('https://www.youtube.com/watch?v=abc', 'home'), '');

  const oneFieldEdit = registry.mergeMentorChannelLinkPatch(second, {
    posts: 'https://www.youtube.com/@SecondMentor/community',
  });
  assert.equal(oneFieldEdit.valid, true);
  assert.equal(oneFieldEdit.channelLinks.videos, second.videosUrl);
  assert.equal(oneFieldEdit.channelLinks.posts, 'https://www.youtube.com/@SecondMentor/community');

  overrides.setMentorTopicOverride(second.id, { channelLinks: oneFieldEdit.channelLinks });
  const reloaded = registry.normalizeMentorRecords(overrides.applyTopicOverridesToMentors([second]))[0];
  assert.equal(reloaded.channelLinks.posts, 'https://www.youtube.com/@SecondMentor/community');
  assert.equal(reloaded.channelLinks.courses, second.coursesUrl);
  assert.equal(reloaded.active, false);
  assert.equal(reloaded.priority, 0);

  const invalidEdit = registry.validateMentorChannelLinks({
    ...oneFieldEdit.channelLinks,
    posts: 'file:///tmp/not-allowed',
  });
  assert.equal(invalidEdit.valid, false);

  const routes = fixture.routing;
  assert.equal(launcher.resolveMarketBriefLaunchContext({ video: routes.morning }).session, 'morning');
  assert.equal(launcher.resolveMarketBriefLaunchContext({ video: routes.preMarket }).session, 'morning');
  assert.equal(launcher.resolveMarketBriefLaunchContext({ video: routes.evening }).session, 'evening');
  assert.equal(launcher.resolveMarketBriefLaunchContext({ video: routes.afterMarket }).session, 'evening');
  assert.equal(launcher.resolveMarketBriefLaunchContext({ video: routes.lateNight }).session, 'evening');
  assert.equal(launcher.resolveMarketBriefLaunchContext({ video: routes.confirmedNonBrief }).isMarketBrief, false);

  const generic = launcher.resolveMarketBriefLaunchContext({ video: routes.generic });
  assert.equal(generic.isMarketBrief, true);
  assert.equal(generic.session, 'unknown');
  assert.equal(launcher.resolveMarketBriefLaunchContext({ video: routes.generic, manualSession: 'evening' }).session, 'evening');
  assert.equal(launcher.resolveMarketBriefLaunchContext({ video: routes.unknown }).isMarketBrief, false);
  assert.equal(sessions.getMarketBriefSessionDisplay('morning').gemLabel, 'מבזק בוקר');
  assert.equal(sessions.getMarketBriefSessionDisplay('evening').gemLabel, 'מבזק ערב');

  const staleOverride = 'https://gemini.google.com/gem/OLD_MARKET_OVERRIDE';
  const manualNonBrief = 'https://gemini.google.com/gem/MANUAL_NON_BRIEF';
  assert.equal(
    launcher.resolveGemLaunchUrl({ isMarketBrief: true, selectedGemUrl: staleOverride }),
    launcher.MARKET_BRIEF_GEM.url,
  );
  assert.equal(
    launcher.resolveGemLaunchUrl({ isMarketBrief: false, selectedGemUrl: manualNonBrief }),
    manualNonBrief,
  );

  const eveningFixture = JSON.parse(read('scripts/fixtures/g3a-late-night-sibling-specialized.json'));
  const eveningSpecialized = specialized.getSpecializedSrc(eveningFixture);
  assert.ok(eveningSpecialized.marketNews.length > 0);
  assert.ok(eveningSpecialized.stocksMentioned.length > 0);

  const centerSource = read('src/components/mentors/MentorChannelCenter.jsx');
  const dashboardSource = read('src/pages/Dashboard.jsx');
  const detailSource = read('src/components/dashboard/VideoDetailPanel.jsx');
  const adminSource = read('src/pages/Admin.jsx');
  const hookSource = read('src/hooks/useMentors.js');
  const modalSource = read('src/components/dashboard/GemSelectionModal.jsx');

  assert.match(centerSource, /target="_blank"/);
  assert.match(centerSource, /rel="noopener noreferrer"/);
  assert.match(centerSource, /event\.stopPropagation\(\)/);
  assert.match(centerSource, /window\.innerWidth - viewportPadding \* 2/);
  assert.doesNotMatch(centerSource, /Micha\.Stocks|UCSxjNbPriyBh9RNl_QNSAtw/);
  assert.match(dashboardSource, /<MentorChannelCenter/);
  assert.match(detailSource, /<MentorChannelCenter/);
  assert.doesNotMatch(dashboardSource, /buildMentorYouTubeUrl/);
  assert.doesNotMatch(detailSource, /mentorChannelUrl/);
  assert.match(adminSource, /<MentorChannelLinksEditor/);
  assert.match(adminSource, /validateMentorChannelLinks/);
  assert.match(adminSource, /createPortal\(/);
  assert.match(hookSource, /topicFields\.channelLinks/);
  assert.match(hookSource, /normalizeMentorRecords/);
  assert.match(modalSource, /<DialogPrimitive\.Description className="sr-only"/);
  assert.doesNotMatch(modalSource, /aria-describedby="gem-modal-desc"/);
  assert.match(modalSource, /marketBriefLaunch\.session === 'unknown'/);
  assert.match(modalSource, /marketBriefLaunch\.isMarketBrief \? MARKET_BRIEF_GEM\.key : selected/);

  console.log(JSON.stringify({
    status: 'passed',
    mentors: fixture.mentors.length,
    michaLinks: michaCenter.links.length,
    secondMentorLinks: secondCenter.links.length,
    partialLinks: partialCenter.links.length,
    routing: { morning: 'morning', evening: 'evening', generic: 'manual', nonBrief: 'preserved' },
  }, null, 2));
} finally {
  await vite.close();
}
