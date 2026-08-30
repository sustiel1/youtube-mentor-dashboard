/**
 * Focused QA for the Phase 2 optional permanence-split fields on
 * `yt_obsidian_item_saves_v1` (src/lib/obsidianItemSaveStore.js).
 * WORK-ID: YMD-BRIEF-PERMANENCE-SPLIT.
 *
 * Exercises the real store functions against an in-memory localStorage
 * polyfill, asserting:
 *  (a) an old-shape record (no new fields) still round-trips and reads as saved
 *  (b) identityKey / dedupeKey are byte-identical whether or not the new
 *      optional fields are passed
 *  (c) the three existing consumers (isObsidianItemSaved,
 *      resolveObsidianItemSaveEntry, resolveObsidianBulkItemStatus) do not
 *      require the new fields and are unaffected by their presence/absence
 *
 * Run: node --import ./scripts/register-src-aliases.mjs scripts/obsidian-item-save-meta-qa.mjs
 */
import { installMemoryLocalStorage } from './lib/memoryLocalStorage.mjs';

installMemoryLocalStorage();

const {
  buildObsidianItemIdentityKey,
  buildObsidianItemDedupeKey,
  recordObsidianItemSave,
  isObsidianItemSaved,
  resolveObsidianItemSaveEntry,
  resolveObsidianBulkItemStatus,
} = await import('../src/lib/obsidianItemSaveStore.js');

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

const baseParams = {
  videoId: 'vid-meta-qa',
  tabKey: 'brief-risks',
  sectionKey: 'risks',
  text: 'לעולם לא להגדיל פוזיציה מפסידה',
  destinationPath: 'שוק ההון/מבזקים/2026-08-30.md',
};

// (b) identity/dedupe keys must be byte-identical regardless of the new fields
const identityWithoutMeta = buildObsidianItemIdentityKey(baseParams);
const dedupeWithoutMeta = buildObsidianItemDedupeKey(baseParams);
const identityWithMetaShape = buildObsidianItemIdentityKey(baseParams); // identity fn has no meta params at all
const dedupeWithMetaShape = buildObsidianItemDedupeKey(baseParams); // dedupe fn has no meta params at all
assert('identityKey unaffected by meta fields (fn has no meta params)', identityWithoutMeta === identityWithMetaShape);
assert('dedupeKey unaffected by meta fields (fn has no meta params)', dedupeWithoutMeta === dedupeWithMetaShape);

// Save WITHOUT any of the 6 new fields (old-shape / pre-Phase-3 caller)
const oldShapeEntry = recordObsidianItemSave({ ...baseParams, savedAt: '2026-08-30T06:00:00.000Z' });
assert('old-shape record created', Boolean(oldShapeEntry));
assert('old-shape record has no new fields', [
  'briefSectionKey', 'date', 'ticker', 'permanence', 'expiry', 'sourceChannel',
].every((f) => !(f in oldShapeEntry)));

// (a) old-shape record still round-trips and reads as saved via all 3 consumers
assert('(a) isObsidianItemSaved true for old-shape record', isObsidianItemSaved(baseParams, { destinationPath: baseParams.destinationPath }));
const resolvedOld = resolveObsidianItemSaveEntry(baseParams, { destinationPath: baseParams.destinationPath });
assert('(a) resolveObsidianItemSaveEntry returns old-shape entry', Boolean(resolvedOld) && resolvedOld.savedAt === '2026-08-30T06:00:00.000Z');
const bulkOld = resolveObsidianBulkItemStatus(
  [{ text: baseParams.text, tabKey: baseParams.tabKey, sectionKey: baseParams.sectionKey }],
  { videoId: baseParams.videoId, destinationPath: baseParams.destinationPath },
);
assert('(a) resolveObsidianBulkItemStatus.allSaved true for old-shape record', bulkOld.allSaved === true);

// Now overwrite the SAME key with all 6 new fields supplied (same identity/dedupe key by design)
const newShapeParams = {
  ...baseParams,
  savedAt: '2026-08-30T06:05:00.000Z',
  briefSectionKey: 'risks',
  date: '2026-08-30',
  ticker: 'nvda', // must normalize to uppercase
  permanence: 'daily',
  expiry: '2026-08-31',
  sourceChannel: 'ערוץ הבדיקה',
};
const identityWithFields = buildObsidianItemIdentityKey(newShapeParams);
const dedupeWithFields = buildObsidianItemDedupeKey(newShapeParams);
assert('(b) identityKey identical with fields present', identityWithFields === identityWithoutMeta);
assert('(b) dedupeKey identical with fields present', dedupeWithFields === dedupeWithoutMeta);

const newShapeEntry = recordObsidianItemSave(newShapeParams);
assert('new-shape record created', Boolean(newShapeEntry));
assert('briefSectionKey stored', newShapeEntry.briefSectionKey === 'risks');
assert('date stored', newShapeEntry.date === '2026-08-30');
assert('ticker normalized to uppercase', newShapeEntry.ticker === 'NVDA');
assert('permanence stored', newShapeEntry.permanence === 'daily');
assert('expiry stored', newShapeEntry.expiry === '2026-08-31');
assert('sourceChannel stored', newShapeEntry.sourceChannel === 'ערוץ הבדיקה');

// (c) consumers still resolve as saved and are unaffected by presence of new fields
assert('(c) isObsidianItemSaved true for new-shape record', isObsidianItemSaved(baseParams, { destinationPath: baseParams.destinationPath }));
const resolvedNew = resolveObsidianItemSaveEntry(baseParams, { destinationPath: baseParams.destinationPath });
assert('(c) resolveObsidianItemSaveEntry returns latest (new-shape) entry', resolvedNew?.savedAt === '2026-08-30T06:05:00.000Z');
const bulkNew = resolveObsidianBulkItemStatus(
  [{ text: baseParams.text, tabKey: baseParams.tabKey, sectionKey: baseParams.sectionKey }],
  { videoId: baseParams.videoId, destinationPath: baseParams.destinationPath },
);
assert('(c) resolveObsidianBulkItemStatus.allSaved true for new-shape record', bulkNew.allSaved === true);

// Fields not supplied at all must not appear on the entry (no stray literal 'undefined')
const partialEntry = recordObsidianItemSave({
  ...baseParams,
  destinationPath: 'שוק ההון/מבזקים/2026-08-31.md',
  permanence: 'permanent',
});
assert('unsupplied optional fields are absent (not undefined literal)', !('ticker' in partialEntry) && !('date' in partialEntry));
assert('permanence-only save stores permanence', partialEntry.permanence === 'permanent');

// Invalid permanence value must not be stored
const invalidPermEntry = recordObsidianItemSave({
  ...baseParams,
  destinationPath: 'שוק ההון/מבזקים/2026-09-01.md',
  permanence: 'sometimes',
});
assert('invalid permanence value rejected (not stored)', !('permanence' in invalidPermEntry));

console.log(`\nItem-save meta QA: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
