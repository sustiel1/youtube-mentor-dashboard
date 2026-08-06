import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const registry = await import('../src/lib/mentorChannelResources.js');
const channelId = 'UCSxjNbPriyBh9RNl_QNSAtw';
const expected = {
  home: 'https://www.youtube.com/@Micha.Stocks/featured',
  videos: 'https://www.youtube.com/@Micha.Stocks/videos',
  live: 'https://www.youtube.com/@Micha.Stocks/streams',
  courses: 'https://www.youtube.com/@Micha.Stocks/courses',
  playlists: 'https://www.youtube.com/@Micha.Stocks/playlists',
  posts: 'https://www.youtube.com/@Micha.Stocks/posts',
};

const byChannel = registry.resolveMentorChannelResourceSet({ id: 'different-id', name: 'Renamed', youtubeChannelId: channelId });
assert.equal(byChannel.resources.length, 6);
assert.deepEqual(Object.fromEntries(byChannel.resources.map((item) => [item.key, item.url])), expected);
assert.deepEqual(byChannel.resources.map((item) => item.key), ['home', 'videos', 'live', 'courses', 'playlists', 'posts']);
for (const resource of byChannel.resources) {
  assert.ok(resource.labelHe && resource.descriptionHe);
  assert.equal(resource.type, 'youtube-channel-tab');
  assert.equal(resource.verified, true);
}

assert.equal(registry.getMentorChannelResources({ id: 'm1', name: 'Any' }).length, 6);
assert.equal(registry.getMentorChannelResources({ handle: '@Micha.Stocks' }).length, 6);
assert.equal(registry.getMentorChannelResources({ channelUrl: 'https://www.youtube.com/@Micha.Stocks' }).length, 6);
assert.equal(registry.getMentorChannelResources({ name: 'Micha.Stocks' }).length, 6);
assert.equal(registry.getMentorChannelResources({ id: 'unknown', name: 'Micha.Stocks' }).length, 0);
assert.equal(registry.getMentorChannelResources({ name: 'Unknown mentor' }).length, 0);

const baseUrlOnly = registry.resolveMentorChannelResourceSet({
  id: 'custom-base-only',
  name: 'Mentor Base Only',
  channelUrl: 'https://www.youtube.com/@BaseOnlyMentor',
});
assert.deepEqual(baseUrlOnly.resources, []);
assert.equal(baseUrlOnly.channelIdentity.canonicalUrl, 'https://www.youtube.com/@BaseOnlyMentor');
assert.equal(registry.resolveMentorChannelResourceSet({ id: 'no-url', name: 'No URL' }), null);

const resourcesWithoutChannel = registry.resolveMentorChannelResourceSet({
  id: 'resources-only',
  name: 'Resources Only',
  channelResources: [
    { id: 'reference', type: 'custom', labelHe: 'מקור', url: 'https://example.com/reference', enabled: true },
  ],
});
assert.equal(resourcesWithoutChannel.resources.length, 1);
assert.equal(resourcesWithoutChannel.channelIdentity.canonicalUrl, '');

const persisted = registry.resolveMentorChannelResourceSet({
  id: 'm1',
  youtubeChannelId: channelId,
  channelResources: [
    { id: 'disabled', type: 'custom', labelHe: 'מושבת', url: 'https://example.com/off', enabled: false, order: 0 },
    { id: 'topic', type: 'topic-playlist', labelHe: 'נושא', url: 'https://www.youtube.com/playlist?list=PL123', enabled: true, order: 2 },
    { id: 'custom', type: 'custom', labelHe: 'מותאם', url: 'https://example.com/resource', enabled: true, order: 1 },
  ],
});
assert.equal(persisted.source, 'mentor');
assert.deepEqual(persisted.resources.map((item) => item.id), ['custom', 'topic']);
const configuredEmpty = registry.resolveMentorChannelResourceSet({ id: 'm1', channelResources: [] });
assert.deepEqual(configuredEmpty.resources, []);
assert.equal(configuredEmpty.channelIdentity.canonicalUrl, expected.home);
assert.equal(registry.validateMentorChannelResources([{ id: 'bad', type: 'home', labelHe: 'שגוי', url: 'https://example.com' }]).valid, false);
assert.equal(registry.validateMentorChannelResources([{ id: 'zero', type: 'custom', labelHe: 'אפס', url: 'https://example.com', enabled: false, order: 0 }]).resources[0].order, 0);

const component = fs.readFileSync(path.join(root, 'src/components/mentors/MentorChannelQuickNav.jsx'), 'utf8');
assert.match(component, /target="_blank"/);
assert.match(component, /rel="noopener noreferrer"/);
assert.match(component, /event\.key === 'Escape'/);
assert.match(component, /event\.key === ' '/);
assert.match(component, /triggerRef\.current\?\.focus/);
assert.match(component, /createPortal\(/);
assert.match(component, /document\.body/);
assert.match(component, /position: 'bottom'|placement: openAbove \? 'top' : 'bottom'/);
assert.match(component, /getBoundingClientRect\(\)/);
assert.match(component, /window\.addEventListener\('scroll', updatePosition, true\)/);
assert.match(component, /window\.addEventListener\('resize', updatePosition\)/);
assert.match(component, /overflow-y-auto/);
assert.match(component, /querySelector\('\[role="menuitem"\]'\)\?\.focus/);
assert.doesNotMatch(component, /Micha\.Stocks|UCSxjNbPriyBh9RNl_QNSAtw/);

const dashboard = fs.readFileSync(path.join(root, 'src/pages/Dashboard.jsx'), 'utf8');
assert.match(dashboard, /<MentorChannelQuickNav mentor=/);
assert.match(dashboard, /<FilterBar[\s\S]*filters=\{filters\}[\s\S]*onFiltersChange=\{setFilters\}/);
assert.match(dashboard, /<span className="whitespace-nowrap">ערוץ המנטור<\/span>/);
assert.match(dashboard, /overflow-x-auto/);

const videoDetail = fs.readFileSync(path.join(root, 'src/components/dashboard/VideoDetailPanel.jsx'), 'utf8');
assert.match(videoDetail, /<MentorChannelQuickNav/);
assert.match(videoDetail, /variant="text-link"/);
assert.match(videoDetail, /label=\{label\}/);
assert.match(videoDetail, /resolveMentorChannelResourceSet\(channelCenterMentor\)/);
assert.doesNotMatch(videoDetail, /Micha\.Stocks.*(?:featured|videos|streams|courses|playlists|posts)/);
assert.match(component, /variant === 'text-link'/);
assert.match(component, /מרכז הערוץ של \{mentorName\}/);
assert.match(component, /data-mentor-channel-home-action/);
assert.match(component, /resourceSet\.channelIdentity\.canonicalUrl \? <a/);
assert.match(component, /נושאי לימוד וקורסים/);
assert.match(component, /פתח ערוץ YouTube/);
console.log('Mentor Channel Quick Navigation: 34 assertions passed.');

const adminEditor = fs.readFileSync(path.join(root, 'src/components/admin/MentorChannelResourcesEditor.jsx'), 'utf8');
assert.match(adminEditor, /קישורי הערוץ ותתי־נושאים/);
assert.match(adminEditor, /window\.confirm/);
assert.match(adminEditor, /crypto\?\.randomUUID/);
assert.match(adminEditor, /תצוגה מקדימה/);
const mentorHook = fs.readFileSync(path.join(root, 'src/hooks/useMentors.js'), 'utf8');
assert.match(mentorHook, /setMentorChannelResourceOverride/);
assert.match(mentorHook, /applyMentorChannelResourceOverrides/);
