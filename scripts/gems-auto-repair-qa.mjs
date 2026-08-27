/**
 * Focused regression QA for WORK-ID YMD-GEMS-AUTO-REPAIR.
 * Run: node --import ./scripts/register-src-aliases.mjs scripts/gems-auto-repair-qa.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  canonicalizeGemsPayloadForPersistence,
  parseAndValidateGemsJson,
  selectAutomaticDeterministicGemsRepair,
} from '../src/lib/gemsJsonRepair.js';
import { createMarketBriefCanonicalStore } from '../src/lib/persistence/marketBriefCanonicalStore.js';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/gems-json-lexical-regressions.fixture.json', import.meta.url),
  'utf8',
));

const validRaw = `  ${JSON.stringify(fixture.validCanonical)}\n`;
const validSelection = selectAutomaticDeterministicGemsRepair(validRaw);
assert.equal(validSelection.shouldApply, false);
assert.equal(validSelection.status, 'valid');
assert.equal(validSelection.originalJson, validRaw, 'valid input must remain byte-for-byte unchanged');
assert.equal(validSelection.repairedJson, null);

for (const [label, raw] of [
  ['unescaped ASCII quote', fixture.unescapedHebrewAbbreviation],
  ['missing property comma', fixture.missingCommaLine3Column49],
]) {
  const selection = selectAutomaticDeterministicGemsRepair(raw);
  assert.equal(selection.shouldApply, true, `${label} must be auto-applicable`);
  assert.equal(selection.outcome.source, 'deterministic');
  assert.equal(selection.outcome.finalValidation.ok, true);
  assert.equal(parseAndValidateGemsJson(selection.repairedJson).ok, true);
}

const schemaInvalidAfterLexicalRepair = '{"contentType":123,}';
const schemaInvalidSelection = selectAutomaticDeterministicGemsRepair(schemaInvalidAfterLexicalRepair);
assert.equal(schemaInvalidSelection.shouldApply, false);
assert.equal(schemaInvalidSelection.status, 'failed');
assert.equal(schemaInvalidSelection.originalJson, schemaInvalidAfterLexicalRepair);
assert.equal(schemaInvalidSelection.repairedJson, null);
assert.equal(schemaInvalidSelection.outcome.candidateDiagnostics, null);
assert.equal(schemaInvalidSelection.outcome.candidateValidation.ok, false);

const unrepairedInvalid = '{"contentType":"marketBrief","universalTabs":{"summary":oops,"chapters":[]}}';
const unrepairedSelection = selectAutomaticDeterministicGemsRepair(unrepairedInvalid);
assert.equal(unrepairedSelection.shouldApply, false);
assert.equal(unrepairedSelection.status, 'failed');
assert.equal(unrepairedSelection.originalJson, unrepairedInvalid);
assert.equal(unrepairedSelection.repairedJson, null);

function createMemoryRepository() {
  const records = new Map();
  const keyOf = ([generationId, storageKey]) => `${generationId}\u0000${storageKey}`;
  return {
    async readMeta(key) {
      return key === 'activeGeneration'
        ? { key, generationId: 'active-generation', state: 'active' }
        : null;
    },
    async writeBatch(_storeName, nextRecords) {
      nextRecords.forEach((record) => records.set(
        keyOf([record.generationId, record.storageKey]),
        structuredClone(record),
      ));
    },
    async readRecords(_storeName, keys) {
      return keys.map((key) => records.get(keyOf(key)) || null);
    },
    async readSourceEntry(generationId, storageKey) {
      return records.get(keyOf([generationId, storageKey])) || null;
    },
  };
}

const noDraftStorage = {
  getItem() { return null; },
  setItem() { throw new Error('canonical IndexedDB save must not use draft storage'); },
};
const store = createMarketBriefCanonicalStore({
  mode: 'indexedDB',
  repository: createMemoryRepository(),
  localStorageArea: noDraftStorage,
  cryptoProvider: globalThis.crypto,
});
const autoRepairForSave = selectAutomaticDeterministicGemsRepair(fixture.missingCommaLine3Column49);
const parsedForSave = parseAndValidateGemsJson(autoRepairForSave.repairedJson);
assert.equal(parsedForSave.ok, true);
const canonicalForSave = canonicalizeGemsPayloadForPersistence(parsedForSave.value);
const saved = await store.write('auto-repair-fixture', canonicalForSave);
assert.equal(saved.ok, true);
assert.equal(saved.storage, 'indexedDB');
const reopened = await store.read('auto-repair-fixture');
assert.deepEqual(reopened.data, canonicalForSave, 'automatic repair must survive canonical save and read-back');

const panelSource = readFileSync(
  new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url),
  'utf8',
);
const pasteHandlerStart = panelSource.indexOf('const handleAutomaticGemsPaste = (event) =>');
const pasteHandlerEnd = panelSource.indexOf('  const currentGemsJsonValidation', pasteHandlerStart);
assert.ok(pasteHandlerStart >= 0 && pasteHandlerEnd > pasteHandlerStart);
const pasteHandler = panelSource.slice(pasteHandlerStart, pasteHandlerEnd);
assert.match(pasteHandler, /selectAutomaticDeterministicGemsRepair\(pasted\)/);
assert.match(pasteHandler, /if \(!automaticRepair\.shouldApply\) return;[\s\S]*event\.preventDefault\(\)/);
assert.match(pasteHandler, /persistVerifiedLocalValue\(`gems-paste-\$\{video\.id\}`, repairedJson\)/);
assert.match(pasteHandler, /validationStatus: 'applied'/);
assert.match(pasteHandler, /workId: 'YMD-GEMS-AUTO-REPAIR'/);
assert.doesNotMatch(pasteHandler, /requestGemsJsonRepair|handleAiRepairGemsJson/);
assert.match(panelSource, /onPaste=\{handleAutomaticGemsPaste\}/);

const modalSource = readFileSync(
  new URL('../src/components/dashboard/GemSelectionModal.jsx', import.meta.url),
  'utf8',
);
assert.match(modalSource, /Escape every ASCII double quote inside a string value/);
assert.match(modalSource, /Include every required comma between adjacent JSON properties and array items/);

const promptSource = readFileSync(
  new URL('../src/ai/quickCopyPrompts.js', import.meta.url),
  'utf8',
);
assert.match(promptSource, /אין להשמיט פסיקים נדרשים/);

console.log('gems-auto-repair-qa: PASS');
