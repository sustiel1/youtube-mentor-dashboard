/**
 * Fixture-only QA for Phase 4 maintenance tooling
 * (src/lib/briefExpiryMaintenance.js). WORK-ID: YMD-BRIEF-PERMANENCE-SPLIT.
 * docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md §3.2's own required proof:
 * zero-delete, playbook untouched, report-then-confirm two-step behavior.
 *
 * Pure-function QA — no localStorage, no real vault I/O; readNoteContent/
 * targetContent are supplied as literal fixture strings.
 *
 * Run: node --import ./scripts/register-src-aliases.mjs scripts/brief-expiry-maintenance-qa.mjs
 */
const {
  locateItemBlock,
  scanExpiredBriefItems,
  computeArchiveForCandidate,
  ARCHIVED_ITEMS_SECTION_LABEL,
} = await import('../src/lib/briefExpiryMaintenance.js');
const { buildObsidianItemMarker } = await import('../src/lib/obsidianNoteMerge.js');
const { PLAYBOOK_PATH } = await import('../src/lib/briefPermanenceMeta.js');

let passed = 0;
let failed = 0;
function assert(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${name}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const IDENTITY = 'obsidian-item:vid1:brief-risks:ab12cd:risks';
const MARKER = buildObsidianItemMarker(IDENTITY);

const sourceWithMeta = [
  '# מבזק ישן',
  '',
  '## סיכונים',
  '',
  '* לעולם לא להגדיל פוזיציה מפסידה',
  MARKER,
  '<!-- ymd-meta:v1 briefSectionKey=risks permanence=daily date=2026-08-25 expiry=2026-08-26 ticker=- sourceChannel=- -->',
  '',
].join('\n');

// ── locateItemBlock ──────────────────────────────────────────────────────────
assert('locateItemBlock finds the block and its meta line', (() => {
  const b = locateItemBlock(sourceWithMeta, IDENTITY);
  return b && b.hasMetaLine && !b.alreadyArchived && b.blockText.includes('* לעולם לא להגדיל');
})());
assert('locateItemBlock returns null for an unknown identity', locateItemBlock(sourceWithMeta, 'obsidian-item:nope:x:y:z') === null);
assert('locateItemBlock returns null when marker exists but has no preceding bullet (malformed note)', (() => {
  const malformed = `# note\n${MARKER}\n`;
  return locateItemBlock(malformed, IDENTITY) === null;
})());
assert('locateItemBlock detects an existing tombstone', (() => {
  const withTombstone = sourceWithMeta.trimEnd() + '\n<!-- ymd-expired:v1 archivedTo=x expiredOn=2026-08-27 -->\n';
  return locateItemBlock(withTombstone, IDENTITY)?.alreadyArchived === true;
})());

// ── scanExpiredBriefItems ─────────────────────────────────────────────────────
const baseEntry = {
  dedupeKey: `${IDENTITY}@שוק ההון/מבזקים/2026-08-25.md`, // NOTE: intentionally NOT its own dated home below
  videoId: 'vid1',
  tabKey: 'brief-risks',
  sectionKey: 'risks',
  permanence: 'daily',
  date: '2026-08-25',
  expiry: '2026-08-26',
  destinationPath: 'שוק ההון/סרטונים/וידאו ישן.md', // saved somewhere OTHER than its dated home
};

assert('permanent entries are never candidates, regardless of expiry', (() => {
  const r = scanExpiredBriefItems({
    entries: [{ ...baseEntry, permanence: 'permanent', dedupeKey: 'x@y' }],
    today: '2026-09-01',
    readNoteContent: () => sourceWithMeta,
  });
  return r.candidates.length === 0 && r.missingMeta.length === 0 && r.mismatch.length === 0;
})());

assert('not-yet-expired daily entries are skipped entirely', (() => {
  const r = scanExpiredBriefItems({
    entries: [baseEntry],
    today: '2026-08-25', // before expiry
    readNoteContent: () => sourceWithMeta,
  });
  return r.candidates.length === 0;
})());

assert('an item already living in its own correctly-dated archive is skipped (nothing to do)', (() => {
  const r = scanExpiredBriefItems({
    entries: [{ ...baseEntry, destinationPath: 'שוק ההון/מבזקים/2026-08-25.md' }],
    today: '2026-09-01',
    readNoteContent: () => sourceWithMeta,
  });
  return r.candidates.length === 0 && r.missingMeta.length === 0;
})());

assert('an expired daily item in an undated note is a real candidate', (() => {
  const r = scanExpiredBriefItems({
    entries: [{ ...baseEntry, dedupeKey: `${IDENTITY}@שוק ההון/סרטונים/וידאו ישן.md` }],
    today: '2026-09-01',
    readNoteContent: () => sourceWithMeta,
  });
  return r.candidates.length === 1 && r.candidates[0].targetPath === 'שוק ההון/מבזקים/2026-08-25.md';
})());

assert('unreadable source note is reported as missing-meta, not silently dropped', (() => {
  const r = scanExpiredBriefItems({
    entries: [{ ...baseEntry, dedupeKey: `${IDENTITY}@שוק ההון/סרטונים/וידאו ישן.md` }],
    today: '2026-09-01',
    readNoteContent: () => null,
  });
  return r.candidates.length === 0 && r.missingMeta.length === 1 && r.missingMeta[0].reason === 'source-unreadable';
})());

assert('marker not found in the note (drifted/edited manually) is reported, not archived blind', (() => {
  const r = scanExpiredBriefItems({
    entries: [{ ...baseEntry, dedupeKey: `${IDENTITY}@שוק ההון/סרטונים/וידאו ישן.md` }],
    today: '2026-09-01',
    readNoteContent: () => '# empty note, item was manually deleted\n',
  });
  return r.candidates.length === 0 && r.missingMeta.length === 1 && r.missingMeta[0].reason === 'marker-not-found';
})());

assert('marker present but no ymd-meta line is reported as missing-meta, not archived', (() => {
  const noMeta = ['* לעולם לא להגדיל פוזיציה מפסידה', MARKER, ''].join('\n');
  const r = scanExpiredBriefItems({
    entries: [{ ...baseEntry, dedupeKey: `${IDENTITY}@שוק ההון/סרטונים/וידאו ישן.md` }],
    today: '2026-09-01',
    readNoteContent: () => noMeta,
  });
  return r.candidates.length === 0 && r.missingMeta.length === 1 && r.missingMeta[0].reason === 'ymd-meta-missing';
})());

assert('already-tombstoned item is reported as already-archived, not re-archived', (() => {
  const withTombstone = sourceWithMeta.trimEnd() + '\n<!-- ymd-expired:v1 archivedTo=x expiredOn=2026-08-27 -->\n';
  const r = scanExpiredBriefItems({
    entries: [{ ...baseEntry, dedupeKey: `${IDENTITY}@שוק ההון/סרטונים/וידאו ישן.md` }],
    today: '2026-09-01',
    readNoteContent: () => withTombstone,
  });
  return r.candidates.length === 0 && r.alreadyArchived.length === 1;
})());

assert('a note whose ymd-meta disagrees with the store on permanence is flagged as a mismatch, not archived', (() => {
  const disagreeing = sourceWithMeta.replace('permanence=daily', 'permanence=permanent');
  const r = scanExpiredBriefItems({
    entries: [{ ...baseEntry, dedupeKey: `${IDENTITY}@שוק ההון/סרטונים/וידאו ישן.md` }],
    today: '2026-09-01',
    readNoteContent: () => disagreeing,
  });
  return r.candidates.length === 0 && r.mismatch.length === 1 && r.mismatch[0].notedPermanence === 'permanent';
})());

// ── computeArchiveForCandidate ────────────────────────────────────────────────
const scanResult = scanExpiredBriefItems({
  entries: [{ ...baseEntry, dedupeKey: `${IDENTITY}@שוק ההון/סרטונים/וידאו ישן.md` }],
  today: '2026-09-01',
  readNoteContent: () => sourceWithMeta,
});
const candidate = scanResult.candidates[0];

assert('candidate resolved for archive-write test', Boolean(candidate));

const archiveResult = computeArchiveForCandidate({
  candidate,
  sourceContent: sourceWithMeta,
  targetContent: '',
  expiredOn: '2026-09-01',
});

assert('archive computation succeeds for a valid candidate', archiveResult.ok === true);
assert('ORIGINAL bullet line is preserved verbatim in the source (never deleted)', archiveResult.updatedSourceContent.includes('* לעולם לא להגדיל פוזיציה מפסידה'));
assert('ORIGINAL identity marker is preserved verbatim in the source', archiveResult.updatedSourceContent.includes(MARKER));
assert('ORIGINAL ymd-meta line is preserved verbatim in the source', archiveResult.updatedSourceContent.includes('ymd-meta:v1 briefSectionKey=risks permanence=daily'));
assert('a tombstone comment is appended, in the exact documented §3.2 format', archiveResult.updatedSourceContent.includes(`<!-- ymd-expired:v1 archivedTo=${encodeURIComponent('שוק ההון/מבזקים/2026-08-25.md')} expiredOn=2026-09-01 -->`));
assert('source content only grows — the tombstone line count is +1 vs the original, nothing removed', archiveResult.updatedSourceContent.split('\n').length === sourceWithMeta.split('\n').length + 1);
assert('target note now contains the copied block', archiveResult.updatedTargetContent.includes(MARKER) && archiveResult.updatedTargetContent.includes('* לעולם לא להגדיל'));
assert('target note uses the documented archived-items section label', archiveResult.updatedTargetContent.includes(`## ${ARCHIVED_ITEMS_SECTION_LABEL}`));
assert('targetChanged is true on first archive', archiveResult.targetChanged === true);

// Re-running against a target that ALREADY has the item: does not duplicate.
const secondRun = computeArchiveForCandidate({
  candidate,
  sourceContent: sourceWithMeta, // source unchanged — simulates re-running the scan+archive before the source was updated
  targetContent: archiveResult.updatedTargetContent,
  expiredOn: '2026-09-01',
});
assert('re-archiving against a target that already has the item does not duplicate the block', (secondRun.updatedTargetContent.match(new RegExp(MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 1);
assert('targetChanged is false when the item was already present in the target', secondRun.targetChanged === false);

// Re-running against an ALREADY-TOMBSTONED source: refuses, does not double-tombstone.
const alreadyDone = computeArchiveForCandidate({
  candidate,
  sourceContent: archiveResult.updatedSourceContent, // now has the tombstone
  targetContent: archiveResult.updatedTargetContent,
  expiredOn: '2026-09-02',
});
assert('re-archiving an already-tombstoned source refuses rather than double-tombstoning', alreadyDone.ok === false && alreadyDone.reason === 'already-archived');

// ── §3.2 hard constraints — explicit proof ────────────────────────────────────
assert('PROOF: computeArchiveForCandidate never references or touches PLAYBOOK_PATH', !archiveResult.updatedSourceContent.includes(PLAYBOOK_PATH) && !archiveResult.updatedTargetContent.includes(PLAYBOOK_PATH));
assert('PROOF: zero-delete — every line of the original source content still appears in the archived source, in order', (() => {
  const originalLines = sourceWithMeta.split('\n');
  const updatedLines = archiveResult.updatedSourceContent.split('\n');
  let cursor = 0;
  for (const line of originalLines) {
    const idx = updatedLines.indexOf(line, cursor);
    if (idx === -1) return false;
    cursor = idx + 1;
  }
  return true;
})());

console.log(`\nBrief expiry maintenance QA: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
