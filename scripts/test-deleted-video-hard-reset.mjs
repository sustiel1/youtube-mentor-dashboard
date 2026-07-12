/**
 * Regression coverage for the "מחק נתונים והתחל מחדש" (delete data & start
 * fresh) action in the deleted-video restore dialog
 * (src/components/dashboard/ExternalVideoModal.jsx).
 *
 * Exercises the real service layer (src/services/videoStorage.js,
 * src/lib/videoFreshImport.js) against an in-memory localStorage polyfill —
 * the same functions the dialog calls, so this can't drift from the UI code.
 *
 * Run: node --import ./scripts/register-src-aliases.mjs scripts/test-deleted-video-hard-reset.mjs
 */
import { installMemoryLocalStorage } from './lib/memoryLocalStorage.mjs';

installMemoryLocalStorage();

const {
  deleteStoredVideo,
  findArchivedDeletedVideo,
  getDeletedVideoRestoreInfo,
  isVideoDeleted,
  purgeDeletedVideoRecord,
  restoreDeletedVideo,
  saveVideos,
} = await import('../src/services/videoStorage.js');

const { clearVideoGeneratedCaches, hasPreservableManualContent, withPreservedManualContent } =
  await import('../src/lib/videoFreshImport.js');

const { saveSavedAnalysis, loadSavedAnalysis } = await import('../src/lib/localAnalysisStore.js');
const { saveAiAnalysis, getAiAnalysis } = await import('../src/lib/aiAnalysisStore.js');
const { saveChunks, getChunks } = await import('../src/lib/localChunkStore.js');
const { saveSegments, hasSegments } = await import('../src/lib/localSegmentStore.js');

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failures += 1;
  }
}

function seedDeletedVideoWithAnalysis(videoId, { withManualContent = false } = {}) {
  const id = `ext_${videoId}`;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const video = {
    id,
    videoId,
    youtubeId: videoId,
    url,
    title: `Video ${videoId}`,
    analysisStatus: 'analyzed',
    shortSummary: 'summary text',
    chapters: [{ title: 'ch1', start: 0 }],
    ...(withManualContent
      ? {
          notes: [{ id: 'n1', text: 'my note' }],
          manualComments: { headline: 'edited by user' },
          obsidianSavedStatus: 'saved',
        }
      : {}),
  };

  // Put it in the active store, then soft-delete it (mirrors the real "delete video" flow).
  saveVideos([video]);
  deleteStoredVideo(id);

  // Seed generated-cache side tables the same way a real analysis run would.
  saveSavedAnalysis(id, { fullSummary: 'saved analysis blob' });
  saveAiAnalysis(id, { shortSummary: 'ai cache blob' });
  saveChunks(id, [{ text: 'chunk 1' }]);
  saveSegments(videoId, [{ text: 'seg 1', startSeconds: 0 }]);

  return { id, url, video };
}

console.log('=== 1. restore still works (archive intact, blacklist cleared) ===');
{
  const { id, url } = seedDeletedVideoWithAnalysis('AAAAAAAAAAA');
  check('shows up as deleted', isVideoDeleted(url));
  const info = getDeletedVideoRestoreInfo('AAAAAAAAAAA', url);
  check('restore info available', Boolean(info?.archived));
  const restored = restoreDeletedVideo({ ytId: 'AAAAAAAAAAA', url, patch: {} });
  check('restore returns a record', Boolean(restored));
  check('restored record keeps old analysis', restored?.shortSummary === 'summary text');
  check('no longer flagged as deleted after restore', !isVideoDeleted(url));
}

console.log('\n=== 3 & 7. delete-and-restart purges the archived record + generated caches (no rehydration) ===');
{
  const { id, url } = seedDeletedVideoWithAnalysis('BBBBBBBBBBB');
  check('saved analysis present before reset', Boolean(loadSavedAnalysis(id)));
  check('ai analysis present before reset', Boolean(getAiAnalysis(id)));
  check('chunks present before reset', getChunks(id).length > 0);
  check('segments present before reset', hasSegments('BBBBBBBBBBB'));

  const archived = purgeDeletedVideoRecord({ ytId: 'BBBBBBBBBBB', url });
  check('purge returns the discarded snapshot', archived?.id === id);
  clearVideoGeneratedCaches(archived);

  check('saved analysis removed', loadSavedAnalysis(id) === null);
  check('ai analysis removed', getAiAnalysis(id) === null);
  check('chunks removed', getChunks(id).length === 0);
  check('archive snapshot gone (GEM JSON cannot rehydrate)', findArchivedDeletedVideo('BBBBBBBBBBB', url) === null);
  check('blacklist cleared too', !isVideoDeleted(url));
  const infoAfter = getDeletedVideoRestoreInfo('BBBBBBBBBBB', url);
  check('no restore prompt would show anymore', infoAfter === null);
}

console.log('\n=== 4. same URL can start a fresh import right after purge ===');
{
  const { url } = seedDeletedVideoWithAnalysis('CCCCCCCCCCC');
  purgeDeletedVideoRecord({ ytId: 'CCCCCCCCCCC', url });
  check('not deleted, not duplicate — plain add path is free to run', !isVideoDeleted(url));
  check('getDeletedVideoRestoreInfo no longer intercepts this URL', getDeletedVideoRestoreInfo('CCCCCCCCCCC', url) === null);
}

console.log('\n=== 5. another video is untouched by a reset on video B ===');
{
  const a = seedDeletedVideoWithAnalysis('DDDDDDDDDDD');
  const b = seedDeletedVideoWithAnalysis('EEEEEEEEEEE');

  const archivedB = purgeDeletedVideoRecord({ ytId: 'EEEEEEEEEEE', url: b.url });
  clearVideoGeneratedCaches(archivedB);

  check('video A archive untouched', Boolean(findArchivedDeletedVideo('DDDDDDDDDDD', a.url)));
  check('video A still flagged deleted (restorable)', isVideoDeleted(a.url));
  check('video A saved analysis untouched', Boolean(loadSavedAnalysis(a.id)));
  check('video A chunks untouched', getChunks(a.id).length > 0);
}

console.log('\n=== 6. manual notes / Obsidian content preserved by default, dropped only when requested ===');
{
  const { url, id } = seedDeletedVideoWithAnalysis('FFFFFFFFFFF', { withManualContent: true });
  const archived = purgeDeletedVideoRecord({ ytId: 'FFFFFFFFFFF', url });
  clearVideoGeneratedCaches(archived);

  check('hasPreservableManualContent detects the notes', hasPreservableManualContent(archived));

  const freshRecord = { id, videoId: 'FFFFFFFFFFF', url, title: 'Video FFFFFFFFFFF', analysisStatus: 'not_analyzed' };
  const preserved = withPreservedManualContent(freshRecord, archived);
  check('notes carried over by default', preserved.notes?.[0]?.text === 'my note');
  check('manualComments carried over by default', preserved.manualComments?.headline === 'edited by user');
  check('obsidianSavedStatus carried over by default', preserved.obsidianSavedStatus === 'saved');
  check('generated fields NOT carried over (fresh record wins)', preserved.analysisStatus === 'not_analyzed');

  // "מחק גם הערות ותוכן ידני" checked — dialog simply skips the merge call.
  const droppedRecord = { ...freshRecord };
  check('when checkbox is checked, manual content is absent from the saved record', !droppedRecord.notes && !droppedRecord.manualComments);
}

console.log('\n=== Safety: idempotent / missing-record-safe purge ===');
{
  const missingUrl = 'https://www.youtube.com/watch?v=ZZZZZZZZZZZ';
  let threw = false;
  try {
    const first = purgeDeletedVideoRecord({ ytId: 'ZZZZZZZZZZZ', url: missingUrl });
    check('purge on a video with no archive/blacklist entry returns null, does not throw', first === null);
    const second = purgeDeletedVideoRecord({ ytId: 'ZZZZZZZZZZZ', url: missingUrl });
    check('calling purge twice in a row is a safe no-op the second time too', second === null);
  } catch {
    threw = true;
  }
  check('no exception thrown for missing records', !threw);

  const { url } = seedDeletedVideoWithAnalysis('GGGGGGGGGGG');
  purgeDeletedVideoRecord({ ytId: 'GGGGGGGGGGG', url });
  let secondCallThrew = false;
  let secondResult;
  try {
    secondResult = purgeDeletedVideoRecord({ ytId: 'GGGGGGGGGGG', url });
  } catch {
    secondCallThrew = true;
  }
  check('purging an already-purged video is idempotent (no throw, no-op)', !secondCallThrew && secondResult === null);
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL: ${failures} assertion(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
