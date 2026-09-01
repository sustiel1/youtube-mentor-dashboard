#!/usr/bin/env node
// Guards the TRADINGBRAIN-WORKSPACE-RETURNTOVIDEO deep-link fix.
//
// Two distinct bugs were found and fixed under this WORK-ID:
//
// (a) sourceVideoId fallback: VideoDetailPanel.jsx's row-select save
//     (handleSaveSelectedToWorkspace) and structured-snapshot save
//     (handleSaveStructuredSnapshot) computed sourceVideoId as
//     `youtubeId || null` with no fallback to the video's own internal id.
//     Real video records never populate youtubeId/videoId (confirmed via
//     live app data: 0/160 real records have either field — the YouTube id
//     lives only embedded in `url`), so every row/snapshot save produced
//     sourceVideoId: null. SaveToWorkspaceDialog.jsx's whole-video save
//     already fell back correctly (`youtubeId || videoId` where
//     `videoId = video?.id || video?.videoId`); the two VideoDetailPanel.jsx
//     handlers now use the same fallback shape.
//
// (b) URL-fallback resolution: when sourceVideoId is null,
//     getWorkspaceVideoIdentity() (workspaceVideoGrouping.js) derives the
//     saved item's group key from the video's URL instead — a plain YouTube
//     id (e.g. "3KA8CYUd2tI"). That id can never match a real record's
//     id/videoId/youtubeId fields (id is an internal `local_...` string;
//     videoId/youtubeId don't exist on real records at all), so
//     WorkspaceLibrary's handleSourceVideoClick/handleReturnToAnalysis and
//     Dashboard.jsx's deep-link effect all failed to resolve the real
//     record — even though the fix from TRADINGBRAIN-NIGHT-VERIFY-HARDEN
//     (which added the youtubeId check to the triple-check) was already in
//     place. findVideoByIdOrUrl() now adds a URL-matching fallback: extract
//     the YouTube id from both the group's URL and each candidate video's
//     URL and compare those, so pre-fix saves (sourceVideoId: null) still
//     resolve correctly without inventing a match when there genuinely
//     isn't one (e.g. the source video was deleted).
//
// Live-browser reproduction (Playwright, against a real 160-video local
// dataset with real id/url shapes) confirmed both bugs before the fix and
// confirmed the fix resolves them; this script guards the same logic at the
// unit level so a regression fails fast without a browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findVideoByIdOrUrl, extractYoutubeIdFromUrl } from '../src/utils/workspaceVideoGrouping.js';

// ── 1. Structural guards: the real source files still contain the fix ──────
const dashboardSource = readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');
const workspaceLibrarySource = readFileSync(new URL('../src/pages/WorkspaceLibrary.jsx', import.meta.url), 'utf8');
const videoDetailPanelSource = readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');

assert.match(
  dashboardSource,
  /const existing = findVideoByIdOrUrl\(videos, \{ targetId, targetUrl: meta\?\.url \}\);/,
  'Dashboard.jsx deep-link effect resolves via findVideoByIdOrUrl (id triple-check + URL fallback)',
);
assert.match(
  workspaceLibrarySource,
  /const fullVideo = findVideoByIdOrUrl\(videos, \{ targetId: group\.videoId, targetUrl: group\.videoUrl \}\);/g,
  'WorkspaceLibrary.jsx resolves saved-item groups via findVideoByIdOrUrl',
);
assert.equal(
  (workspaceLibrarySource.match(/findVideoByIdOrUrl\(videos, \{ targetId: group\.videoId, targetUrl: group\.videoUrl \}\)/g) || []).length,
  2,
  'both handleSourceVideoClick and handleReturnToAnalysis use findVideoByIdOrUrl',
);
assert.match(
  workspaceLibrarySource,
  /navigateTo\('Dashboard',\s*\{\s*openVideoId:\s*fallbackVideo\.id \|\| group\.videoId,\s*openVideoMeta:\s*fallbackVideo\s*\}\)/,
  'handleReturnToAnalysis prefers the resolved record\'s own id over the raw group key',
);
assert.match(
  videoDetailPanelSource,
  /sourceVideoId: youtubeId \|\| videoIdFallback \|\| null,[\s\S]{0,40}sourceVideoType: videoType,/,
  'handleSaveSelectedToWorkspace falls back to the video\'s own internal id when youtubeId/videoId are absent',
);
assert.match(
  videoDetailPanelSource,
  /sourceVideoId: youtubeId \|\| videoIdFallback \|\| null,\s*\n\s*sourceTabId: 'structured-snapshot',/,
  'handleSaveStructuredSnapshot falls back to the video\'s own internal id when youtubeId/videoId are absent',
);

// ── 2. Behavioral guard: (a) legacy null-sourceVideoId item resolves via URL ──
// A real analyzed video whose id/videoId/youtubeId never carry the plain
// YouTube id — only `url` does (the actual shape of every real record in
// this app's storage, confirmed live).
const videos = [
  {
    id: 'local_1785778232466_voytd',
    url: 'https://www.youtube.com/watch?v=3KA8CYUd2tI',
    shortSummary: 'ניתוח אמיתי',
    analysisStatus: 'analyzed',
  },
];

// Item saved BEFORE the fix: sourceVideoId was null, so the group key is
// URL-derived (getWorkspaceVideoIdentity's fallback path).
const legacyGroup = { videoId: '3KA8CYUd2tI', videoUrl: 'https://www.youtube.com/watch?v=3KA8CYUd2tI' };
const resolvedLegacy = findVideoByIdOrUrl(videos, { targetId: legacyGroup.videoId, targetUrl: legacyGroup.videoUrl });
assert.ok(resolvedLegacy, 'a pre-fix item (sourceVideoId: null, URL-derived group key) resolves via the URL fallback');
assert.equal(resolvedLegacy.id, 'local_1785778232466_voytd', 'resolves to the correct real record');
assert.equal(resolvedLegacy.shortSummary, 'ניתוח אמיתי', 'the resolved record carries its real analysis, not a stub');

// ── 3. Behavioral guard: (a) post-fix item resolves via id, not URL ────────
// Item saved AFTER the fix: sourceVideoId is the real internal id. Give it a
// deliberately WRONG videoUrl (pointing at a different real video) to prove
// the id-match branch wins and the URL is never consulted when id matches.
const otherVideo = { id: 'local_other_video', url: 'https://www.youtube.com/watch?v=ssBalq6kmCU', shortSummary: 'וידאו אחר' };
videos.push(otherVideo);
const postFixGroup = { videoId: 'local_1785778232466_voytd', videoUrl: 'https://www.youtube.com/watch?v=ssBalq6kmCU' };
const resolvedPostFix = findVideoByIdOrUrl(videos, { targetId: postFixGroup.videoId, targetUrl: postFixGroup.videoUrl });
assert.equal(resolvedPostFix?.id, 'local_1785778232466_voytd', 'id match takes priority over a mismatched URL');
assert.notEqual(resolvedPostFix?.id, otherVideo.id, 'does not fall through to the (wrong) URL-matched record when id matches');

// ── 4. Behavioral guard: (d) deleted/nonexistent source video fails gracefully ──
const ghostGroup = { videoId: 'ghost_id_does_not_exist', videoUrl: 'https://www.youtube.com/watch?v=GHOSTID999' };
const resolvedGhost = findVideoByIdOrUrl(videos, { targetId: ghostGroup.videoId, targetUrl: ghostGroup.videoUrl });
assert.equal(resolvedGhost, null, 'a saved item whose source video no longer exists resolves to null, not a fabricated match');

// ── 5. extractYoutubeIdFromUrl handles youtu.be and query-param forms alike ──
assert.equal(extractYoutubeIdFromUrl('https://www.youtube.com/watch?v=3KA8CYUd2tI'), '3KA8CYUd2tI');
assert.equal(extractYoutubeIdFromUrl('https://youtu.be/3KA8CYUd2tI'), '3KA8CYUd2tI');
assert.equal(extractYoutubeIdFromUrl('https://www.youtube.com/watch?list=PL123&v=3KA8CYUd2tI'), '3KA8CYUd2tI');
assert.equal(extractYoutubeIdFromUrl(null), null);

// ── 6. Un-analyzed video must still show the CTA path, not be forced-fed a stub ──
const neverAnalyzed = { id: 'never_analyzed_1', url: 'https://www.youtube.com/watch?v=YTNONE1', shortSummary: undefined, analysisStatus: 'not_analyzed' };
videos.push(neverAnalyzed);
const naGroup = { videoId: 'never_analyzed_1', videoUrl: 'https://www.youtube.com/watch?v=YTNONE1' };
const naResolved = findVideoByIdOrUrl(videos, { targetId: naGroup.videoId, targetUrl: naGroup.videoUrl });
assert.ok(naResolved, 'a genuinely un-analyzed video still resolves to its real (unanalyzed) record, not null');
assert.equal(naResolved.shortSummary, undefined, 'no shortSummary is fabricated for a genuinely un-analyzed video — the CTA path is preserved');

console.log('return-to-analysis deep-link QA: 13 assertions passed');
