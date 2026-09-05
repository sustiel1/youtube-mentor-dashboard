import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseAndValidateGemsJson,
  repairGemsJsonDeterministically,
} from '../src/lib/gemsJsonRepair.js';
import {
  classifyGemsDiagnostic,
  createGemsImportDiagnosticReport,
  createGemsRecoveryStatusReport,
} from '../src/lib/gemsImportDiagnosticReport.js';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/gems-json-lexical-regressions.fixture.json', import.meta.url),
  'utf8',
));

const validRaw = JSON.stringify(fixture.validCanonical);
const valid = parseAndValidateGemsJson(validRaw);
assert.equal(valid.ok, true, 'strict canonical JSON must validate immediately');
assert.equal(repairGemsJsonDeterministically(validRaw).status, 'valid');

const missingComma = parseAndValidateGemsJson(fixture.missingCommaLine3Column49);
assert.equal(missingComma.ok, false);
assert.equal(missingComma.diagnostics.line, 3);
assert.equal(missingComma.diagnostics.column, 49);
assert.match(missingComma.diagnostics.message, /Expected ',' or '}' after property value/);

const missingCommaRepair = repairGemsJsonDeterministically(fixture.missingCommaLine3Column49);
assert.equal(missingCommaRepair.status, 'repaired');
assert.deepEqual(missingCommaRepair.changes, ['Inserted missing property comma at line 3, column 49.']);
assert.equal(parseAndValidateGemsJson(missingCommaRepair.repairedJson).ok, true);
assert.deepEqual(missingCommaRepair.safety, {
  lexicalOnly: true,
  meaningChanged: false,
  ambiguityDetected: false,
  reconstructionUsed: false,
  truncationDetected: false,
  manualApprovalRequired: true,
  candidateParsed: true,
  candidateSchemaValid: true,
  requiredContentValid: true,
  canonicalizationValid: true,
});

const quoteRepair = repairGemsJsonDeterministically(fixture.unescapedHebrewAbbreviation);
assert.equal(quoteRepair.status, 'repaired');
assert.match(quoteRepair.changes.join(' '), /unescaped quote/);
assert.equal(parseAndValidateGemsJson(quoteRepair.repairedJson).ok, true);
assert.equal(
  JSON.parse(quoteRepair.repairedJson).universalTabs.summary.shortSummary,
  'תשואות האג"ח עלו',
);

const quotedPhraseRepair = repairGemsJsonDeterministically(fixture.unescapedQuotedPhrase);
assert.equal(quotedPhraseRepair.status, 'repaired');
assert.match(quotedPhraseRepair.changes.join(' '), /unescaped quote/);
assert.equal(parseAndValidateGemsJson(quotedPhraseRepair.repairedJson).ok, true);
assert.equal(
  JSON.parse(quotedPhraseRepair.repairedJson).universalTabs.summary.shortSummary,
  'המרצה אמר "זהירות" בשוק',
);

const missingCommaBetweenStrings = repairGemsJsonDeterministically(fixture.missingCommaBetweenStringValues);
assert.equal(missingCommaBetweenStrings.status, 'repaired');
assert.match(missingCommaBetweenStrings.changes.join(' '), /Inserted missing property comma/);
assert.doesNotMatch(missingCommaBetweenStrings.changes.join(' '), /unescaped quote/);
assert.deepEqual(
  JSON.parse(missingCommaBetweenStrings.repairedJson).universalTabs.summary,
  { a: 'b', c: 'd' },
);

const quotedWordCommaRepair = repairGemsJsonDeterministically(fixture.unescapedQuotedWordFollowedByComma);
assert.equal(quotedWordCommaRepair.status, 'repaired');
assert.match(quotedWordCommaRepair.changes.join(' '), /unescaped quote/);
assert.equal(parseAndValidateGemsJson(quotedWordCommaRepair.repairedJson).ok, true);
assert.equal(
  JSON.parse(quotedWordCommaRepair.repairedJson).universalTabs.summary.shortSummary,
  'למרות לחץ בקהילה סביב "קריסה", המדדים יציבים',
);

const arrayOfStringsRepair = repairGemsJsonDeterministically(fixture.arrayOfHebrewStringsWithTrailingComma);
assert.equal(arrayOfStringsRepair.status, 'repaired');
assert.deepEqual(arrayOfStringsRepair.changes, ['Removed trailing comma(s).']);
assert.equal(parseAndValidateGemsJson(arrayOfStringsRepair.repairedJson).ok, true);
assert.deepEqual(
  JSON.parse(arrayOfStringsRepair.repairedJson).universalTabs.topicsSubtopics,
  ['א', 'ב', 'ג'],
);

const eof = repairGemsJsonDeterministically(validRaw.slice(0, -5));
assert.equal(eof.status, 'regeneration-required');
assert.equal(eof.repairedJson, null);
assert.equal(eof.safety.truncationDetected, true);
assert.equal(eof.safety.reconstructionUsed, false);

const schemaInvalid = repairGemsJsonDeterministically(JSON.stringify({
  contentType: 'marketBrief',
  universalTabs: { summary: {} },
}));
assert.equal(schemaInvalid.status, 'failed');
assert.equal(schemaInvalid.repairedJson, null);

const classification = classifyGemsDiagnostic({
  parseValid: false,
  schemaValid: false,
  parserDiagnostics: missingComma.diagnostics,
  repairChanges: missingCommaRepair.changes,
  draftPersistenceWarning: 'QuotaExceededError',
});
assert.equal(classification.category, 'syntax-missing-comma');
assert.equal(classifyGemsDiagnostic({
  parseValid: true,
  schemaValid: true,
  draftPersistenceWarning: 'QuotaExceededError',
}).category, 'draft-quota-warning');

const privateMarker = 'PRIVATE_PAYLOAD_MARKER';
const report = createGemsImportDiagnosticReport({
  rawGemsOutput: `${fixture.missingCommaLine3Column49}${privateMarker}`,
  parseError: missingComma.diagnostics.message,
  parseValid: false,
  schemaValid: false,
  parserDiagnostics: missingComma.diagnostics,
  repairSource: 'deterministic',
  repairChanges: missingCommaRepair.changes,
  repairStatus: 'validated',
  storageMetadata: { canonical: { layer: 'IndexedDB', key: 'market_brief_fixture' } },
  existingDataPreserved: true,
});
assert.match(report, /WORK-ID: YMD-GEMS-IMPORT-RECOVERY/);
assert.match(report, /Project: YouTube Mentor Dashboard/);
assert.match(report, /READY-TO-SEND CODEX \/ CLAUDE CODE REQUEST/);
assert.match(report, /Session: קליטת GEMS שחזור התוכן/);
assert.match(report, /Category: syntax-missing-comma/);
assert.match(report, /Line: 3/);
assert.match(report, /Column: 49/);
assert.match(report, /Redacted source excerpt:/);
assert.match(report, /complete GEMS payload.*intentionally omitted|complete GEMS payload.*not included/s);
assert.doesNotMatch(report, new RegExp(privateMarker));
assert.doesNotMatch(report, /"contentType": "marketBrief"/);

const recoveryStatusReport = createGemsRecoveryStatusReport({
  videoId: 'fixture-video',
  videoTitle: 'Fixture Evening Brief',
  contentType: 'marketBrief',
  subtype: 'evening-brief',
  parseValid: true,
  schemaValid: true,
  canStart: true,
  inputSource: 'canonical-saved-json',
  inputLength: 21796,
  storageMode: 'indexed-db',
  canonicalAnalysisVisible: true,
  cardAnalyzed: true,
});
assert.match(recoveryStatusReport, /GEMS IMPORT RECOVERY STATUS REPORT/);
assert.match(recoveryStatusReport, /WORK-ID: YMD-GEMS-IMPORT-RECOVERY/);
assert.match(recoveryStatusReport, /Status: ready/);
assert.match(recoveryStatusReport, /parseValid: true/);
assert.match(recoveryStatusReport, /schemaValid: true/);
assert.match(recoveryStatusReport, /canonical IndexedDB record and verifies read-back/);
assert.match(recoveryStatusReport, /cards and dashboard statistics hydrate canonical Market Brief evidence/);
assert.match(recoveryStatusReport, /READY-TO-SEND CODEX REQUEST IF THIS RECURS/);
assert.match(recoveryStatusReport, /scripts\/gems-import-recovery-qa\.mjs/);
assert.doesNotMatch(recoveryStatusReport, /PRIVATE_PAYLOAD_MARKER|"universalTabs"/);

console.log('gems-json-lexical-regressions-qa: PASS');
