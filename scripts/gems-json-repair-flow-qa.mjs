/**
 * Focused QA for YMD-GEMS-JSON-REPAIR and YMD-GEMS-PASTE-QUOTA.
 * Run: node scripts/gems-json-repair-flow-qa.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getMorningBriefSchemaExample } from '../src/ai/gemini/schemas/morningBriefSchema.js';
import {
  buildCanonicalGemsRegenerationPrompt,
  buildGemsJsonRepairReport,
  buildSafeGemsRepairReportSnapshot,
  canonicalizeGemsPayloadForPersistence,
  parseAndValidateGemsJson,
  repairGemsJsonDeterministically,
} from '../src/lib/gemsJsonRepair.js';
import {
  GEMS_DRAFT_QUOTA_WARNING,
  GEMS_DRAFT_STORAGE_WARNING,
  GEMS_STORAGE_QUOTA_MESSAGE,
  getGemsDraftPersistenceWarning,
  persistVerifiedLocalValue,
} from '../src/lib/gemsLocalPersistence.js';
import {
  runGemsJsonRepair,
  serializeGemsRepairError,
} from '../src/server/gemsJsonRepairProvider.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const canonicalValue = {
  contentType: 'marketBrief',
  universalTabs: {
    summary: { shortSummary: 'תקציר', fullSummary: 'סיכום מלא' },
    chapters: [],
    specialized: {},
  },
};
const canonicalJson = JSON.stringify(canonicalValue);

function createMemoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

const successfulStorage = createMemoryStorage();
const successfulValue = { contentType: 'marketBrief', universalTabs: canonicalValue.universalTabs };
persistVerifiedLocalValue('market_brief_success', successfulValue, successfulStorage);
assert.deepEqual(JSON.parse(successfulStorage.getItem('market_brief_success')), successfulValue);

const quotaStorage = createMemoryStorage([['market_brief_existing', '{"preserved":true}']]);
quotaStorage.setItem = () => {
  const error = new Error('Storage quota reached');
  error.name = 'QuotaExceededError';
  throw error;
};
assert.throws(
  () => persistVerifiedLocalValue('market_brief_existing', { replacement: true }, quotaStorage),
  (error) => error?.classification === 'quota-exceeded'
    && error?.code === 'GEMS_STORAGE_QUOTA_EXCEEDED'
    && error?.message === GEMS_STORAGE_QUOTA_MESSAGE,
);
assert.equal(quotaStorage.getItem('market_brief_existing'), '{"preserved":true}');
assert.match(GEMS_STORAGE_QUOTA_MESSAGE, /האחסון בדפדפן מלא/);
assert.match(GEMS_STORAGE_QUOTA_MESSAGE, /התוכן לא נשמר/);
assert.equal(
  getGemsDraftPersistenceWarning({ classification: 'quota-exceeded' }),
  GEMS_DRAFT_QUOTA_WARNING,
);
assert.equal(
  getGemsDraftPersistenceWarning({ classification: 'storage-operation-failed' }),
  GEMS_DRAFT_STORAGE_WARNING,
);
assert.match(GEMS_DRAFT_QUOTA_WARNING, /עדיין אפשר להתחיל ניתוח/);
assert.match(GEMS_DRAFT_QUOTA_WARNING, /הנתונים הקיימים לא שונו/);

const valid = parseAndValidateGemsJson(canonicalJson);
assert.equal(valid.ok, true);
assert.equal(valid.validation.schema, 'marketBrief-canonical');
assert.equal(repairGemsJsonDeterministically(canonicalJson).status, 'valid');
assert.deepEqual(canonicalizeGemsPayloadForPersistence(canonicalValue), canonicalValue);

const abbreviationJson = `{
  "contentType": "marketBrief",
  "universalTabs": {
    "summary": {
      "shortSummary": "תשואות האג"ח עלו, נדל"ן נחלש בארה"ב ומדד נאסד"ק התחזק."
    },
    "chapters": []
  }
}`;
const abbreviationRepair = repairGemsJsonDeterministically(abbreviationJson);
assert.equal(abbreviationRepair.status, 'repaired');
assert.equal(parseAndValidateGemsJson(abbreviationRepair.repairedJson).ok, true);
assert.equal(
  JSON.parse(abbreviationRepair.repairedJson).universalTabs.summary.shortSummary,
  'תשואות האג"ח עלו, נדל"ן נחלש בארה"ב ומדד נאסד"ק התחזק.',
);

const legacyJson = JSON.stringify({
  contentType: 'marketBrief',
  shortSummary: 'תקציר ישן',
  fullSummary: 'סיכום ישן',
});
const legacy = parseAndValidateGemsJson(legacyJson);
assert.equal(legacy.ok, true);
assert.equal(legacy.validation.schema, 'marketBrief-legacy');

const duplicatedPayload = {
  contentType: 'marketBrief',
  shortSummary: 'תקציר קנוני',
  fullSummary: 'סיכום קנוני',
  chapters: [{ title: 'פתיחה', startSeconds: 0 }],
  top5Insights: ['תובנה'],
  reusableKnowledge: ['ידע'],
  indices: [{ symbol: 'SPX', change: '+1%' }],
  marketOverview: { marketMood: 'חיובי' },
  universalTabs: {
    summary: { shortSummary: 'תקציר קנוני' },
    chapters: [],
    insights: {},
    usefulKnowledge: {},
    specialized: {},
  },
};
const canonicalizedPayload = canonicalizeGemsPayloadForPersistence(duplicatedPayload);
for (const rootField of [
  'shortSummary', 'fullSummary', 'chapters', 'top5Insights',
  'reusableKnowledge', 'indices', 'marketOverview',
]) {
  assert.equal(Object.hasOwn(canonicalizedPayload, rootField), false, `root duplicate remained: ${rootField}`);
}
assert.equal(canonicalizedPayload.universalTabs.summary.fullSummary, 'סיכום קנוני');
assert.equal(canonicalizedPayload.universalTabs.chapters.length, 1);
assert.deepEqual(canonicalizedPayload.universalTabs.insights.top5Insights, ['תובנה']);
assert.deepEqual(canonicalizedPayload.universalTabs.usefulKnowledge.reusableKnowledge, ['ידע']);
assert.equal(canonicalizedPayload.universalTabs.specialized.indices[0].symbol, 'SPX');
assert.equal(canonicalizedPayload.universalTabs.specialized.marketOverview.marketMood, 'חיובי');
assert.equal(parseAndValidateGemsJson(JSON.stringify(canonicalizedPayload)).ok, true);
assert.equal(duplicatedPayload.shortSummary, 'תקציר קנוני', 'normalization mutated its input');
assert.equal(canonicalizeGemsPayloadForPersistence(JSON.parse(legacyJson)).shortSummary, 'תקציר ישן');
const canonicalPersistenceStorage = createMemoryStorage();
persistVerifiedLocalValue('market_brief_canonical_reload', canonicalizedPayload, canonicalPersistenceStorage);
const canonicalReloaded = JSON.parse(canonicalPersistenceStorage.getItem('market_brief_canonical_reload'));
assert.deepEqual(canonicalReloaded, canonicalizedPayload);
assert.equal(parseAndValidateGemsJson(JSON.stringify(canonicalReloaded)).ok, true);
assert.deepEqual(Object.keys(canonicalReloaded).sort(), ['contentType', 'universalTabs']);

const arraySummaryPayload = canonicalizeGemsPayloadForPersistence({
  contentType: 'marketBrief',
  shortSummary: 'סיכום שטוח',
  tags: ['שוק'],
  universalTabs: {
    summary: ['סיכום קנוני'],
    chapters: [],
    topicsSubtopics: [],
  },
});
assert.deepEqual(arraySummaryPayload.universalTabs.summary, ['סיכום קנוני', 'סיכום שטוח']);
assert.deepEqual(arraySummaryPayload.universalTabs.topicsSubtopics, ['שוק']);
assert.equal(Object.hasOwn(arraySummaryPayload, 'shortSummary'), false);
assert.equal(Object.hasOwn(arraySummaryPayload, 'tags'), false);

const repairable = canonicalJson.replace(/}\s*$/, ',}');
const repaired = repairGemsJsonDeterministically(repairable);
assert.equal(repaired.status, 'repaired');
assert.equal(parseAndValidateGemsJson(repaired.repairedJson).ok, true);
const repairedReport = buildGemsJsonRepairReport({ outcome: repaired, raw: repairable });
assert.match(repairedReport, /Validated Repaired JSON Preview/);
assert.match(repairedReport, /FULL PREVIEW/);
assert.match(repairedReport, /Project: YouTube Mentor Dashboard/);
assert.match(repairedReport, /WORK-ID: YMD-GEMS-IMPORT-RECOVERY/);
assert.match(repairedReport, /Ready-to-Send Codex \/ Claude Code Request/);
const safeReportSnapshot = buildSafeGemsRepairReportSnapshot({
  ...repaired,
  report: repairedReport,
  originalJson: 'must-not-be-retained',
  repairedJson: 'must-not-be-retained',
}, {
  videoId: 'video-report-test',
  generatedAt: '2026-08-26T00:00:00.000Z',
});
assert.equal(safeReportSnapshot.videoId, 'video-report-test');
assert.equal(safeReportSnapshot.report, repairedReport);
assert.equal(safeReportSnapshot.persistenceStatus, 'pending');
assert.equal(Object.hasOwn(safeReportSnapshot, 'originalJson'), false);
assert.equal(Object.hasOwn(safeReportSnapshot, 'repairedJson'), false);

const schemaInvalid = JSON.stringify({ contentType: 'marketBrief', universalTabs: { summary: {} } });
const schemaInvalidResult = repairGemsJsonDeterministically(schemaInvalid);
assert.equal(schemaInvalidResult.status, 'failed');
assert.equal(schemaInvalidResult.repairedJson, null);
assert.doesNotMatch(buildGemsJsonRepairReport({ outcome: schemaInvalidResult, raw: schemaInvalid }), /Repaired JSON Preview/);

const eofJson = canonicalJson.slice(0, -12);
const eofResult = repairGemsJsonDeterministically(eofJson);
assert.equal(eofResult.status, 'regeneration-required');
assert.equal(eofResult.repairedJson, null);
assert.equal(eofResult.original.diagnostics.isEof, true);
const eofReport = buildGemsJsonRepairReport({ outcome: eofResult, raw: eofJson });
assert.match(eofReport, /Regeneration Required/);
assert.doesNotMatch(eofReport, /Repaired JSON Preview/);
const regenerationPrompt = buildCanonicalGemsRegenerationPrompt();
assert.match(regenerationPrompt, /contentType.*universalTabs/s);
assert.match(regenerationPrompt, /אל תשכפל.*legacy/);

const malformedNonEof = canonicalJson.replace('"chapters"', '"chapters');
const malformedResult = repairGemsJsonDeterministically(malformedNonEof);
assert.equal(malformedResult.status, 'failed');
assert.equal(malformedResult.repairedJson, null);

const longRepairable = JSON.stringify({
  ...canonicalValue,
  universalTabs: {
    ...canonicalValue.universalTabs,
    summary: { shortSummary: 'א'.repeat(2400), fullSummary: 'סיכום' },
  },
}).replace(/}\s*$/, ',}');
const longResult = repairGemsJsonDeterministically(longRepairable);
assert.equal(longResult.status, 'repaired');
const longReport = buildGemsJsonRepairReport({ outcome: longResult, raw: longRepairable });
assert.match(longReport, /TRUNCATED PREVIEW: first 2000 of/);
assert.equal(parseAndValidateGemsJson(longResult.repairedJson).ok, true);

let localProviderCalls = 0;
const localProviderValid = await runGemsJsonRepair({
  rawJson: canonicalJson,
  apiKey: 'unused',
  fetchImpl: async () => { localProviderCalls += 1; throw new Error('must not call'); },
});
assert.equal(localProviderValid.status, 'valid');
assert.equal(localProviderCalls, 0);

const missingComma = canonicalJson.replace('},"chapters"', '}"chapters"');
const fakeEnvelope = JSON.stringify({
  repairedJson: canonicalJson,
  changes: ['Inserted missing comma.'],
  why: 'Syntax error.',
  prevention: [],
  promptCorrection: '',
});
let missingCommaProviderCalls = 0;
const aiResult = await runGemsJsonRepair({
  rawJson: missingComma,
  apiKey: 'test-key',
  fetchImpl: async () => {
    missingCommaProviderCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: fakeEnvelope }] } }] }),
    };
  },
});
assert.equal(aiResult.status, 'repaired');
assert.equal(aiResult.source, 'deterministic');
assert.equal(aiResult.finalValidation.ok, true);
assert.equal(missingCommaProviderCalls, 0);

let unavailableError;
try {
  await runGemsJsonRepair({
    rawJson: malformedNonEof,
    apiKey: 'test-key',
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: { status: 'UNAVAILABLE', message: 'Provider unavailable for test.' } }),
    }),
  });
} catch (error) {
  unavailableError = serializeGemsRepairError(error);
}
assert.deepEqual(unavailableError, {
  error: 'UNAVAILABLE',
  message: 'Provider unavailable for test.',
  status: 503,
});
const unavailableReport = buildGemsJsonRepairReport({
  outcome: malformedResult,
  raw: malformedNonEof,
  serverError: { code: unavailableError.error, status: unavailableError.status, message: unavailableError.message },
});
assert.match(unavailableReport, /Code: UNAVAILABLE/);
assert.match(unavailableReport, /HTTP status: 503/);
assert.match(unavailableReport, /Provider unavailable for test\./);
assert.doesNotMatch(unavailableReport, /Repaired JSON Preview/);

const schemaExample = JSON.parse(getMorningBriefSchemaExample());
assert.equal(schemaExample.contentType, 'marketBrief');
assert.ok(schemaExample.universalTabs);
for (const legacyKey of ['shortSummary', 'fullSummary', 'chapters', 'marketNews', 'indices']) {
  assert.equal(Object.hasOwn(schemaExample, legacyKey), false, `canonical schema duplicated ${legacyKey}`);
}

const backendPath = path.resolve(dirname, '../backend/repair-gems-json.function.js');
const panelSource = fs.readFileSync(
  path.resolve(dirname, '../src/components/dashboard/VideoDetailPanel.jsx'),
  'utf8',
);
const backendSource = fs.readFileSync(backendPath, 'utf8');
const serviceSource = fs.readFileSync(path.resolve(dirname, '../src/services/gemsJsonRepair.js'), 'utf8');
const viteConfigSource = fs.readFileSync(path.resolve(dirname, '../vite.config.js'), 'utf8');
assert.match(serviceSource, /base44\.functions\.RepairGemsJson\(payload\)/);
assert.match(serviceSource, /fetch\('\/api\/gemini-repair-json'/);
assert.match(viteConfigSource, /runGemsJsonRepair\(\{/);
assert.match(panelSource, /data-testid="gems-storage-error"/);
assert.match(panelSource, /data-testid="gems-draft-storage-warning"/);
assert.match(panelSource, /GEMS_STORAGE_QUOTA_MESSAGE/);
assert.match(panelSource, /getGemsDraftPersistenceWarning/);
const automaticRepairRawStart = panelSource.indexOf('const raw = gemsPasteInput.trim();', panelSource.indexOf('const currentGemsJsonValidation'));
const automaticRepairEffectStart = panelSource.lastIndexOf('useEffect(() => {', automaticRepairRawStart);
const automaticRepairEffectEnd = panelSource.indexOf('  const canStartGemsAnalysis', automaticRepairEffectStart);
assert.ok(automaticRepairEffectStart >= 0, 'paste/change must start deterministic repair automatically');
assert.ok(automaticRepairEffectEnd > automaticRepairEffectStart, 'automatic deterministic repair effect must be bounded');
const automaticRepairEffect = panelSource.slice(automaticRepairEffectStart, automaticRepairEffectEnd);
assert.match(automaticRepairEffect, /repairGemsJsonDeterministically\(raw\)/);
assert.match(automaticRepairEffect, /setGemsAiRepairResult\(\{/);
assert.match(automaticRepairEffect, /validationStatus: outcome\.status === 'regeneration-required'.*?'validated'.*?'failed'/s);
assert.match(automaticRepairEffect, /\[gemsPasteInput, currentGemsJsonValidation\.isValid\]/);
assert.doesNotMatch(automaticRepairEffect, /gemsDraftPersistenceWarning/);
assert.doesNotMatch(panelSource, /שגיאה בעיבוד:.*QuotaExceededError/);
assert.match(panelSource, /max-h-\[90vh\].*overflow-hidden.*flex.*flex-col/);
assert.match(panelSource, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
assert.match(panelSource, /data-testid="gems-primary-actions"/);
assert.match(panelSource, /data-testid="gems-secondary-actions"/);
assert.match(panelSource, /data-testid="gems-last-repair-report"/);
assert.match(panelSource, /data-testid="gems-canonical-json-source"/);
assert.match(panelSource, /data-testid="gems-corrected-json-source"/);
assert.match(panelSource, /handleCopyAiRepairReport\('Codex'\)/);
assert.match(panelSource, /handleCopyAiRepairReport\('Claude Code'\)/);
assert.match(panelSource, /handleCopyClaudeCodeDebugReport\('Codex'\)/);
assert.match(panelSource, /handleCopyClaudeCodeDebugReport\('Claude Code'\)/);
assert.match(panelSource, /data-testid="gems-copy-recovery-status-report"/);
assert.match(panelSource, /data-testid="gems-recovery-status-report"/);
assert.match(panelSource, /aria-label="דוח מצב שחזור GEMS"/);
assert.match(panelSource, /onClick=\{handleCopyGemsRecoveryStatusReport\}/);
assert.match(panelSource, /createGemsRecoveryStatusReport/);
assert.match(panelSource, /savedPayload = marketBriefData \|\| video\?\.marketBriefData \|\| null/);
assert.match(panelSource, /repairReportAtStart[\s\S]*?persistenceStatus: 'saved'/);
assert.match(panelSource, /gems-secondary-actions" className="flex min-w-0 gap-2 overflow-x-auto/);
assert.match(
  panelSource,
  /data-testid="gems-primary-actions"[\s\S]*?התחל ניתוח[\s\S]*?data-testid="gems-secondary-actions"/,
);
assert.match(panelSource, /העתק דוח ל-Codex/);
assert.match(
  panelSource,
  /const showClaudeCodeDebugReport = Boolean\([\s\S]*?gemsAiRepairResult \|\|[\s\S]*?gemsAiRepairFailed/,
);
assert.match(panelSource, /const canStartGemsAnalysis = currentGemsJsonValidation\.isValid;/);
assert.doesNotMatch(panelSource, /const canStartGemsAnalysis = .*gemsPersistenceError/);
assert.match(panelSource, /disabled=\{!canStartGemsAnalysis\}/);
assert.match(panelSource, /gemsDraftPersistenceWarning \|\|[\s\S]*?gemsPersistenceError/);
assert.match(panelSource, /showGemsDraftPersistenceFailure\(error\)/);
assert.doesNotMatch(
  panelSource,
  /handleApplyGemsJson = \(\) => \{\s*if \(gemsPersistenceError\)/,
);
assert.match(panelSource, /if \(!saveSavedAnalysis\(video\.id, snapshot\)\)/);
assert.match(
  panelSource,
  /persistRequiredGemsSnapshot\(saved\);[\s\S]{0,700}?toast\.success/,
);
assert.match(panelSource, /persistenceError: gemsPersistenceError \|\| null/);
assert.match(panelSource, /draftPersistenceWarning: gemsDraftPersistenceWarning \|\| null/);
const backendModule = { exports: {} };
const backendFetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: fakeEnvelope }] } }] }),
});
new Function('module', 'exports', 'process', 'fetch', backendSource)(
  backendModule,
  backendModule.exports,
  { env: { GEMINI_API_KEY: 'test-key', GEMINI_REPAIR_MODEL: 'test-model' } },
  backendFetch,
);
const backend = backendModule.exports;
assert.equal(backend.parseAndValidate(canonicalJson).ok, true);
assert.equal(backend.parseAndValidate(legacyJson).validation.schema, 'marketBrief-legacy');
assert.equal(backend.deterministicRepair(repairable).status, 'repaired');
assert.equal(backend.deterministicRepair(eofJson).status, 'regeneration-required');
const backendAiResult = await backend.handler({ rawJson: missingComma });
assert.equal(backendAiResult.status, 'repaired');
assert.equal(backendAiResult.finalValidation.ok, true);

console.log('GEMS JSON repair QA passed: canonical, legacy, deterministic, EOF, report gate, AI, and Base44 paths.');
