const DEFAULT_WORK_ID = 'YMD-GEMS-IMPORT-RECOVERY';
const DEFAULT_SESSION_NAME = 'קליטת GEMS שחזור התוכן';
const DEFAULT_PROJECT_NAME = 'YouTube Mentor Dashboard';

const SECRET_PATTERNS = [
  [/Bearer\s+[A-Za-z0-9\-_.=]+/gi, 'Bearer [REDACTED]'],
  [/Authorization:\s*\S+/gi, 'Authorization: [REDACTED]'],
  [/Cookie:\s*[^\n\r]+/gi, 'Cookie: [REDACTED]'],
  [/\bsk-ant-[A-Za-z0-9\-_]{10,}\b/g, '[REDACTED_ANTHROPIC_KEY]'],
  [/\bsk-[A-Za-z0-9\-_]{10,}\b/g, '[REDACTED_API_KEY]'],
  [/\bAIza[0-9A-Za-z\-_]{20,}\b/g, '[REDACTED_GOOGLE_KEY]'],
];

function sanitizeSecrets(value) {
  let output = String(value ?? '');
  for (const [pattern, replacement] of SECRET_PATTERNS) output = output.replace(pattern, replacement);
  return output;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '(unserializable safe metadata)';
  }
}

function boundedRedactedExcerpt(rawText, position) {
  const text = String(rawText || '');
  if (!text || !Number.isFinite(position)) return '(not available)';
  const radius = 90;
  const start = Math.max(0, position - radius);
  const end = Math.min(text.length, position + radius);
  const markerOffset = position - start;
  const marked = `${text.slice(start, start + markerOffset)}⟦^⟧${text.slice(start + markerOffset, end)}`;
  const masked = sanitizeSecrets(marked).replace(/[\p{L}\p{N}]/gu, '•');
  return `${start > 0 ? '…' : ''}${masked}${end < text.length ? '…' : ''}`;
}

export function classifyGemsDiagnostic({
  parseValid,
  schemaValid,
  parserDiagnostics,
  repairChanges = [],
  draftPersistenceWarning,
  persistenceError,
} = {}) {
  const changes = Array.isArray(repairChanges) ? repairChanges.join(' ') : String(repairChanges || '');
  const parserMessage = String(parserDiagnostics?.message || '');
  if (persistenceError) return { category: 'final-persistence-failure', likelyLayer: 'persistence', investigationTarget: 'canonical IndexedDB mandatory write and read-back verification' };
  if (parseValid === false) {
    if (parserDiagnostics?.isEof) return { category: 'truncated-or-eof-json', likelyLayer: 'external-gem-output', investigationTarget: 'upstream output completeness; never reconstruct missing content' };
    if (/Inserted missing property comma/i.test(changes)) return { category: 'syntax-missing-comma', likelyLayer: 'external-gem-output', investigationTarget: 'comma between adjacent object properties' };
    if (/unescaped quote/i.test(changes)) return { category: 'syntax-unescaped-ascii-quote', likelyLayer: 'external-gem-output', investigationTarget: 'ASCII quotation mark inside a JSON string or Hebrew abbreviation' };
    if (/control character|bad control|newline/i.test(parserMessage)) return { category: 'syntax-raw-control-character', likelyLayer: 'external-gem-output', investigationTarget: 'literal newline or tab inside a JSON string' };
    return { category: 'syntax-invalid-json', likelyLayer: 'external-gem-output-or-parser', investigationTarget: 'exact parser offset and surrounding JSON punctuation' };
  }
  if (schemaValid === false) return { category: 'schema-rejection', likelyLayer: 'application-schema-or-external-contract', investigationTarget: 'required canonical contentType/universalTabs sections and field types' };
  if (draftPersistenceWarning) return { category: 'draft-quota-warning', likelyLayer: 'optional-draft-storage', investigationTarget: 'non-blocking localStorage draft write' };
  return { category: 'unknown-import-failure', likelyLayer: 'routing-canonicalization-or-renderer', investigationTarget: 'canonicalization, subtype routing, persistence read-back and reopen renderer' };
}

const CODEX_INSTRUCTIONS = `Codex — investigate only from the safe metadata below:
1. Reproduce the category with a static synthetic fixture; the complete user payload is intentionally omitted.
2. Verify the parser, schema, canonicalization and persistence path before changing code.
3. Treat the likely layer as an investigation lead, not as a proven root cause.
4. Implement only a narrowly proven compatible fix and preserve existing valid data.
5. Add a focused regression test for the confirmed category.
6. Do not call paid AI/GEMS services and do not commit or push without explicit approval.`;

export function createGemsImportDiagnosticReport({
  projectName = DEFAULT_PROJECT_NAME,
  workId = DEFAULT_WORK_ID,
  sessionName = DEFAULT_SESSION_NAME,
  date = new Date().toISOString(),
  appVersion,
  head,
  videoId,
  videoTitle,
  contentType,
  subtype,
  parseError,
  parseValid,
  schemaValid,
  rawGemsOutput,
  parserDiagnostics,
  repairSource,
  repairChanges = [],
  repairStatus,
  draftPersistenceWarning,
  persistenceError,
  storageMetadata,
  existingDataPreserved,
  occurrenceCount = 1,
} = {}) {
  const classification = classifyGemsDiagnostic({
    parseValid,
    schemaValid,
    parserDiagnostics,
    repairChanges,
    draftPersistenceWarning,
    persistenceError,
  });
  const lines = [
    '================ CODEX SAFE DIAGNOSTIC ================',
    CODEX_INSTRUCTIONS,
    '',
    '================ TASK IDENTITY ================',
    `Project: ${projectName}`,
    `WORK-ID: ${workId}`,
    `Session: ${sessionName}`,
    `Date: ${date}`,
    `Application version: ${appVersion || '(not available)'}`,
    `HEAD: ${head || '(not exposed to browser)'}`,
    `Record ID: ${videoId || '(not available)'}`,
    `Record title: ${videoTitle || '(not available)'}`,
    `Content type: ${contentType || '(not available)'}`,
    `Subtype: ${subtype || '(not available)'}`,
    `Problem: GEMS import failed in category ${classification.category}; the exact evidence and safe investigation target are included below.`,
    '',
    '================ READY-TO-SEND CODEX / CLAUDE CODE REQUEST ================',
    `Continue in the "${projectName}" project under WORK-ID ${workId}. Diagnose category ${classification.category} from the safe evidence below. Reproduce it with a static fixture, preserve existing data, make only the smallest compatible change, do not call paid AI/GEMS services, and do not commit without explicit approval.`,
    '',
    '================ FAILURE CLASSIFICATION ================',
    `Category: ${classification.category}`,
    `Occurrence count: ${Math.max(1, Number(occurrenceCount) || 1)}`,
    `Likely layer (not proven root cause): ${classification.likelyLayer}`,
    `Investigation target: ${classification.investigationTarget}`,
    '',
    '================ PARSER AND SCHEMA ================',
    `parseValid: ${parseValid === undefined ? '(unknown)' : String(parseValid)}`,
    `schemaValid: ${schemaValid === undefined ? '(unknown)' : String(schemaValid)}`,
    `Error: ${parseError ? sanitizeSecrets(parseError instanceof Error ? parseError.message : parseError) : '(none)'}`,
    `Position: ${Number.isFinite(parserDiagnostics?.position) ? parserDiagnostics.position : '(not available)'}`,
    `Line: ${Number.isFinite(parserDiagnostics?.line) ? parserDiagnostics.line : '(not available)'}`,
    `Column: ${Number.isFinite(parserDiagnostics?.column) ? parserDiagnostics.column : '(not available)'}`,
    `Input length: ${Number.isFinite(parserDiagnostics?.inputLength) ? parserDiagnostics.inputLength : String(rawGemsOutput || '').length}`,
    `Input hash: ${parserDiagnostics?.inputHash || '(not available)'}`,
    `Redacted source excerpt: ${boundedRedactedExcerpt(rawGemsOutput, parserDiagnostics?.position)}`,
    '',
    '================ FLOW STATES ================',
    `Repair source: ${repairSource || '(none)'}`,
    `Repair changes: ${repairChanges.length ? sanitizeSecrets(repairChanges.join(' | ')) : '(none)'}`,
    `Repair status: ${repairStatus || '(none)'}`,
    `Draft warning: ${draftPersistenceWarning ? 'present' : 'none'}`,
    `Final persistence error: ${persistenceError ? sanitizeSecrets(persistenceError) : 'none'}`,
    `Existing data preserved: ${existingDataPreserved === undefined ? '(unknown)' : String(existingDataPreserved)}`,
    '',
    '================ SAFE STORAGE METADATA ================',
    storageMetadata ? sanitizeSecrets(safeStringify(storageMetadata)) : '(not available)',
    '',
    'Privacy: complete GEMS payload, transcript, repair candidate, credentials and unrelated stored content were not included.',
    'Transmission: this report is copied locally only after an explicit button click and is never sent automatically.',
  ];
  return lines.join('\n');
}

export function createGemsRecoveryStatusReport({
  projectName = DEFAULT_PROJECT_NAME,
  workId = DEFAULT_WORK_ID,
  sessionName = DEFAULT_SESSION_NAME,
  date = new Date().toISOString(),
  appVersion,
  head,
  videoId,
  videoTitle,
  contentType,
  subtype,
  parseValid,
  schemaValid,
  canStart,
  inputSource,
  inputLength,
  storageMode,
  canonicalAnalysisVisible,
  cardAnalyzed,
  draftPersistenceWarning,
  persistenceError,
  repairStatus,
} = {}) {
  const healthy = parseValid === true && schemaValid === true && canStart === true && !persistenceError;
  const lines = [
    '================ GEMS IMPORT RECOVERY STATUS REPORT ================',
    '',
    '================ TASK IDENTITY ================',
    `Project: ${sanitizeSecrets(projectName)}`,
    `WORK-ID: ${sanitizeSecrets(workId)}`,
    `Session: ${sanitizeSecrets(sessionName)}`,
    `Date: ${sanitizeSecrets(date)}`,
    `Application version: ${sanitizeSecrets(appVersion || '(not available)')}`,
    `HEAD: ${sanitizeSecrets(head || '(not exposed to browser)')}`,
    `Record ID: ${sanitizeSecrets(videoId || '(not available)')}`,
    `Record title: ${sanitizeSecrets(videoTitle || '(not available)')}`,
    `Content type: ${sanitizeSecrets(contentType || '(not available)')}`,
    `Subtype: ${sanitizeSecrets(subtype || '(not available)')}`,
    '',
    '================ CURRENT STATE ================',
    `Status: ${healthy ? 'ready' : 'attention-required'}`,
    `parseValid: ${parseValid === undefined ? '(unknown)' : String(parseValid)}`,
    `schemaValid: ${schemaValid === undefined ? '(unknown)' : String(schemaValid)}`,
    `canStart: ${canStart === undefined ? '(unknown)' : String(canStart)}`,
    `Input source: ${sanitizeSecrets(inputSource || '(not available)')}`,
    `Input length: ${Number.isFinite(inputLength) ? inputLength : '(not available)'}`,
    `Repair status: ${sanitizeSecrets(repairStatus || '(none)')}`,
    `Storage mode: ${sanitizeSecrets(storageMode || '(not available)')}`,
    `Canonical analysis visible in detail view: ${canonicalAnalysisVisible === undefined ? '(unknown)' : String(canonicalAnalysisVisible)}`,
    `Analyzed evidence visible to cards/statistics: ${cardAnalyzed === undefined ? '(unknown)' : String(cardAnalyzed)}`,
    `Draft persistence warning: ${draftPersistenceWarning ? 'present (optional and non-blocking)' : 'none'}`,
    `Final persistence error: ${persistenceError ? sanitizeSecrets(persistenceError) : 'none'}`,
    '',
    '================ PROVEN RECOVERY CHANGES ================',
    '1. Strict JSON is accepted only after JSON.parse and canonical GEMS schema validation both pass.',
    '2. Repairable malformed JSON uses deterministic lexical repair over the complete pasted payload and requires a validated candidate before applying it.',
    '3. Truncated or non-repairable JSON remains blocked; missing content is never invented or reconstructed.',
    '4. Draft localStorage quota failure remains an optional warning and cannot disable parsing or the mandatory final save.',
    '5. Market Brief final persistence uses the established canonical IndexedDB record and verifies read-back before reporting success.',
    '6. Optional compatibility sidecar failure cannot invalidate a successfully persisted canonical record.',
    '7. Video cards and dashboard statistics hydrate canonical Market Brief evidence from IndexedDB read-only, so reopened analyses remain marked as analyzed without write-on-read.',
    '8. Transcript persistence uses its canonical IndexedDB path and read-back verification, so a saved transcript remains green after reopen/reload.',
    '9. This current status report remains copyable even when the JSON is already valid and no active repair candidate exists.',
    '',
    '================ REGRESSION PROTECTION ================',
    '- scripts/gems-json-lexical-regressions-qa.mjs',
    '- scripts/gems-json-repair-flow-qa.mjs',
    '- scripts/gems-import-recovery-qa.mjs',
    '- scripts/gems-analyzed-status-qa.mjs',
    '- scripts/canonical-video-analysis-hydration-qa.mjs',
    '- scripts/youtube-transcript-persistence-qa.mjs',
    '',
    '================ READY-TO-SEND CODEX REQUEST IF THIS RECURS ================',
    `Continue in the "${sanitizeSecrets(projectName)}" project under WORK-ID ${sanitizeSecrets(workId)} and session "${sanitizeSecrets(sessionName)}". Reproduce the exact current UI state, then inspect the full paste validation, deterministic repair state, canonical IndexedDB mandatory write/read-back, reopen path, and read-only card hydration. Preserve all existing data and unrelated work. Do not clear storage, call paid AI/GEMS services, commit, push, merge, deploy, or modify production. Prove the root cause before making only the smallest compatible change, and add a static regression test for the confirmed failure.`,
    '',
    'Privacy: the complete GEMS JSON, transcript, repair candidate, credentials and unrelated stored content are not included.',
    'Transmission: this report is copied locally only after an explicit button click and is never sent automatically.',
  ];
  return lines.join('\n');
}
