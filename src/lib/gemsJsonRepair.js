const UNIVERSAL_TAB_TYPES = {
  summary: ['object', 'array'],
  chapters: ['array'],
  insights: ['object', 'array'],
  usefulKnowledge: ['object', 'array'],
  appBuilder: ['object'],
  topicsSubtopics: ['object', 'array'],
  specialized: ['object'],
};

const LEGACY_MARKET_FIELDS = [
  'shortSummary',
  'fullSummary',
  'chapters',
  'top5Insights',
  'reusableKnowledge',
  'keyTakeaways',
  'marketNews',
  'indices',
  'stocksMentioned',
  'macro',
  'sentiment',
  'calendar',
  'opportunities',
  'risks',
];

const GENERIC_ANALYSIS_FIELDS = [
  'shortSummary',
  'fullSummary',
  'keyPoints',
  'allPoints',
  'chapters',
  'keyInsights',
  'usefulKnowledge',
  'actionItems',
  'politicalSummary',
  'brainHighlights',
];

const CANONICAL_SUMMARY_ROOT_FIELDS = [
  'shortSummary',
  'fullSummary',
  'mainLesson',
  'marketMood',
  'mainConclusion',
  'topTakeaways',
];

const CANONICAL_INSIGHTS_ROOT_FIELDS = [
  'top5Insights',
  'keyPoints',
  'allPoints',
  'learningInsights',
  'marketLessons',
  'tradingInsights',
  'conclusions',
];

const CANONICAL_USEFUL_KNOWLEDGE_ROOT_FIELDS = [
  'reusableKnowledge',
  'keyTakeaways',
  'actionChecklist',
  'riskManagement',
  'mistakesToAvoid',
  'rules',
  'actionItems',
];

const CANONICAL_TOPICS_ROOT_FIELDS = ['tags', 'obsidianTopics'];

const CANONICAL_SPECIALIZED_ROOT_FIELDS = [
  'indices', 'indexPerformance', 'indexData',
  'marketNews', 'headlines', 'news', 'topStories',
  'macroFactors', 'macro', 'macroEvents', 'macroHighlights', 'economicEvents',
  'stocksMentioned', 'stocks', 'watchlist', 'tickers', 'mentionedStocks',
  'watchlistLevels', 'keyLevels', 'catalysts',
  'sectorRotation', 'sectors', 'sectorPerformance', 'sectorOverview',
  'tradingOpportunities', 'opportunities', 'trades', 'breakoutCandidates',
  'economicCalendar', 'calendar', 'events', 'upcomingEvents', 'schedule',
  'earnings', 'risks', 'warnings', 'riskFactors',
  'marketChanges', 'changes', 'tomorrowEvents', 'nextEvents',
  'weeklyHighlights', 'highlights', 'winners', 'topGainers',
  'losers', 'topLosers', 'weeklyOutlook', 'outlook', 'nextWeekOutlook',
  'guidance', 'earningsGuidance', 'managementCommentary', 'commentary',
  'financialMetrics', 'marketOverview', 'sentiment',
];

function valueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function mergeCanonicalValue(canonicalValue, legacyValue) {
  if (canonicalValue == null) return legacyValue;
  if (legacyValue == null) return canonicalValue;
  if (Array.isArray(canonicalValue) && Array.isArray(legacyValue)) {
    const seen = new Set();
    return [...canonicalValue, ...legacyValue].filter((item) => {
      const signature = typeof item === 'string' ? item.trim() : JSON.stringify(item);
      if (!signature || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }
  if (isPlainObject(canonicalValue) && isPlainObject(legacyValue)) {
    return { ...legacyValue, ...canonicalValue };
  }
  return canonicalValue;
}

function moveRootFieldsIntoSection(root, universalTabs, sectionName, fields) {
  const section = universalTabs[sectionName];
  if (Array.isArray(section)) {
    let nextSection = [...section];
    let changed = false;
    for (const field of fields) {
      if (!hasOwn(root, field)) continue;
      const legacyItems = Array.isArray(root[field]) ? root[field] : [root[field]];
      nextSection = mergeCanonicalValue(nextSection, legacyItems);
      delete root[field];
      changed = true;
    }
    if (changed) universalTabs[sectionName] = nextSection;
    return;
  }
  if (!isPlainObject(section)) return;
  const nextSection = { ...section };
  let changed = false;
  for (const field of fields) {
    if (!hasOwn(root, field)) continue;
    nextSection[field] = mergeCanonicalValue(nextSection[field], root[field]);
    delete root[field];
    changed = true;
  }
  if (changed) universalTabs[sectionName] = nextSection;
}

/**
 * Produces the compact canonical payload used by new writes. Existing records
 * remain untouched and readable through the legacy fallback paths.
 */
export function canonicalizeGemsPayloadForPersistence(value) {
  if (!isPlainObject(value) || !isPlainObject(value.universalTabs)) return value;
  if (!['marketBrief', 'market'].includes(String(value.contentType || ''))) return value;

  const root = { ...value };
  const universalTabs = { ...value.universalTabs };
  root.universalTabs = universalTabs;

  moveRootFieldsIntoSection(root, universalTabs, 'summary', CANONICAL_SUMMARY_ROOT_FIELDS);
  moveRootFieldsIntoSection(root, universalTabs, 'insights', CANONICAL_INSIGHTS_ROOT_FIELDS);
  moveRootFieldsIntoSection(
    root,
    universalTabs,
    'usefulKnowledge',
    CANONICAL_USEFUL_KNOWLEDGE_ROOT_FIELDS,
  );
  moveRootFieldsIntoSection(root, universalTabs, 'specialized', CANONICAL_SPECIALIZED_ROOT_FIELDS);
  moveRootFieldsIntoSection(root, universalTabs, 'topicsSubtopics', CANONICAL_TOPICS_ROOT_FIELDS);

  if (Array.isArray(universalTabs.chapters) && Array.isArray(root.chapters)) {
    universalTabs.chapters = mergeCanonicalValue(universalTabs.chapters, root.chapters);
    delete root.chapters;
  }

  return root;
}

function hashTextFNV1a(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getLineColumn(text, position) {
  const boundedPosition = Math.max(0, Math.min(text.length, position));
  const before = text.slice(0, boundedPosition);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function resolvePositionFromLineColumn(text, line, column) {
  const lines = text.split('\n');
  let position = 0;
  for (let index = 0; index < Math.max(0, line - 1) && index < lines.length; index += 1) {
    position += lines[index].length + 1;
  }
  return Math.min(text.length, position + Math.max(0, column - 1));
}

export function getJsonParserDiagnostics(rawText, error) {
  const text = String(rawText || '');
  const message = String(error?.message || error || 'Invalid JSON');
  const positionMatch = message.match(/position\s+(\d+)/i) || message.match(/\bat\s+(\d+)\b/i);
  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  let position = positionMatch ? Number(positionMatch[1]) : null;
  if (!Number.isFinite(position) && lineColumnMatch) {
    position = resolvePositionFromLineColumn(text, Number(lineColumnMatch[1]), Number(lineColumnMatch[2]));
  }
  const explicitEof = /unexpected end|end of json input|unterminated string/i.test(message);
  if (!Number.isFinite(position) && explicitEof) position = text.length;
  if (Number.isFinite(position)) position = Math.max(0, Math.min(text.length, position));

  const location = Number.isFinite(position) ? getLineColumn(text, position) : { line: null, column: null };
  const lastContentPosition = text.trimEnd().length;
  const isEof = explicitEof || (Number.isFinite(position) && position >= lastContentPosition);
  const contextRadius = 240;
  const contextStart = Number.isFinite(position) ? Math.max(0, position - contextRadius) : 0;
  const contextEnd = Number.isFinite(position)
    ? Math.min(text.length, position + contextRadius)
    : Math.min(text.length, contextRadius * 2);
  const markerOffset = Number.isFinite(position) ? position - contextStart : null;
  const rawContext = text.slice(contextStart, contextEnd);
  const markedContext = Number.isFinite(markerOffset)
    ? `${rawContext.slice(0, markerOffset)}[PARSER_ERROR]${rawContext.slice(markerOffset)}`
    : rawContext;

  return {
    message,
    position: Number.isFinite(position) ? position : null,
    line: location.line,
    column: location.column,
    char: Number.isFinite(position) ? (text[position] ?? 'EOF') : null,
    isEof,
    inputLength: text.length,
    inputHash: hashTextFNV1a(text),
    context: markedContext,
    contextStart,
    contextEnd,
    contextTruncatedBefore: contextStart > 0,
    contextTruncatedAfter: contextEnd < text.length,
  };
}

export function validateGemsJsonValue(value) {
  const errors = [];
  if (!isPlainObject(value)) {
    return { ok: false, schema: null, errors: ['Root value must be a JSON object.'] };
  }

  if (hasOwn(value, 'contentType') && typeof value.contentType !== 'string') {
    errors.push('contentType must be a string when present.');
  }

  const contentType = typeof value.contentType === 'string' ? value.contentType.trim() : '';
  const universalTabs = value.universalTabs;
  if (hasOwn(value, 'universalTabs') && !isPlainObject(universalTabs)) {
    errors.push('universalTabs must be an object.');
  }

  if (isPlainObject(universalTabs)) {
    const presentUniversalKeys = Object.keys(UNIVERSAL_TAB_TYPES).filter((key) => hasOwn(universalTabs, key));
    for (const key of presentUniversalKeys) {
      const actualType = valueType(universalTabs[key]);
      if (!UNIVERSAL_TAB_TYPES[key].includes(actualType)) {
        errors.push(`universalTabs.${key} must be ${UNIVERSAL_TAB_TYPES[key].join(' or ')}, received ${actualType}.`);
      }
    }
    if (presentUniversalKeys.length === 0) {
      errors.push('universalTabs does not contain a supported tab section.');
    }
  }

  if (contentType === 'marketBrief') {
    if (isPlainObject(universalTabs)) {
      const hasContentSection = ['chapters', 'insights', 'usefulKnowledge', 'specialized']
        .some((key) => hasOwn(universalTabs, key));
      if (!hasContentSection) errors.push('Canonical marketBrief requires at least one content section besides summary.');
      return { ok: errors.length === 0, schema: 'marketBrief-canonical', errors };
    }

    const legacyFields = LEGACY_MARKET_FIELDS.filter((key) => hasOwn(value, key));
    if (legacyFields.length < 2) {
      errors.push('Legacy marketBrief requires at least two recognized top-level content fields.');
    }
    return { ok: errors.length === 0, schema: 'marketBrief-legacy', errors };
  }

  if (isPlainObject(universalTabs)) {
    return { ok: errors.length === 0, schema: 'universal-tabs', errors };
  }

  const genericFields = GENERIC_ANALYSIS_FIELDS.filter((key) => hasOwn(value, key));
  if (genericFields.length === 0) {
    errors.push('No recognized GEMS analysis fields were found.');
  }
  return { ok: errors.length === 0, schema: 'analysis-legacy', errors };
}

export function parseAndValidateGemsJson(rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) {
    return {
      ok: false,
      value: null,
      diagnostics: getJsonParserDiagnostics('', new Error('JSON input is empty.')),
      validation: { ok: false, schema: null, errors: ['JSON input is empty.'] },
    };
  }

  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      value: null,
      diagnostics: getJsonParserDiagnostics(raw, error),
      validation: null,
    };
  }

  const validation = validateGemsJsonValue(value);
  return {
    ok: validation.ok,
    value,
    diagnostics: null,
    validation,
  };
}

function escapeLiteralControlsInsideStrings(text) {
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      output += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      output += char;
      inString = !inString;
      continue;
    }
    if (inString && char === '\n') { output += '\\n'; continue; }
    if (inString && char === '\r') { output += '\\r'; continue; }
    if (inString && char === '\t') { output += '\\t'; continue; }
    output += char;
  }
  return output;
}

function escapeUnescapedQuotesInsideWords(text) {
  let output = '';
  let inString = false;
  let escaped = false;
  let changes = 0;
  const wordChar = /[\u05B0-\u05FF\w]/;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      output += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      const previous = text[index - 1] || '';
      const next = text[index + 1] || '';
      if (inString && wordChar.test(previous) && wordChar.test(next)) {
        output += '\\"';
        changes += 1;
        continue;
      }
      inString = !inString;
    }
    output += char;
  }

  return { text: output, changes };
}

function insertProvenMissingPropertyComma(text, diagnostics) {
  if (!diagnostics || diagnostics.isEof || !Number.isFinite(diagnostics.position)) return null;
  if (!/Expected ',' or '}' after property value/i.test(diagnostics.message || '')) return null;

  const position = diagnostics.position;
  const suffix = text.slice(position);
  if (!/^"(?:[^"\\]|\\.)*"\s*:/.test(suffix)) return null;

  let previousIndex = position - 1;
  while (previousIndex >= 0 && /\s/.test(text[previousIndex])) previousIndex -= 1;
  if (previousIndex < 0 || !/["}\]0-9el]/.test(text[previousIndex])) return null;

  return `${text.slice(0, position)},${text.slice(position)}`;
}

function hasRequiredGemsContent(value) {
  if (!isPlainObject(value)) return false;
  if (isPlainObject(value.universalTabs)) {
    return Object.values(value.universalTabs).some((section) => {
      if (Array.isArray(section)) return section.length > 0;
      return isPlainObject(section) && Object.keys(section).length > 0;
    });
  }
  return [...LEGACY_MARKET_FIELDS, ...GENERIC_ANALYSIS_FIELDS]
    .some((key) => hasOwn(value, key) && value[key] != null && value[key] !== '');
}

function buildRepairSafety(overrides = {}) {
  return {
    lexicalOnly: true,
    meaningChanged: false,
    ambiguityDetected: false,
    reconstructionUsed: false,
    truncationDetected: false,
    manualApprovalRequired: true,
    candidateParsed: false,
    candidateSchemaValid: false,
    requiredContentValid: false,
    canonicalizationValid: false,
    ...overrides,
  };
}

export function repairGemsJsonDeterministically(rawText) {
  const raw = String(rawText || '').trim();
  const original = parseAndValidateGemsJson(raw);
  if (original.ok) {
    return {
      status: 'valid',
      source: 'original',
      repairedJson: null,
      changes: [],
      original,
      finalValidation: original.validation,
      safety: buildRepairSafety({
        manualApprovalRequired: false,
        candidateParsed: true,
        candidateSchemaValid: true,
        requiredContentValid: hasRequiredGemsContent(original.value),
        canonicalizationValid: true,
      }),
    };
  }
  if (original.diagnostics?.isEof) {
    return {
      status: 'regeneration-required',
      source: 'regeneration',
      repairedJson: null,
      changes: [],
      original,
      finalValidation: null,
      safety: buildRepairSafety({ truncationDetected: true }),
    };
  }

  if (!original.diagnostics) {
    return {
      status: 'failed',
      source: 'deterministic',
      repairedJson: null,
      changes: [],
      original,
      candidateValidation: original.validation,
      finalValidation: null,
      safety: buildRepairSafety(),
    };
  }

  let candidate = raw;
  const changes = [];
  const beforeFence = candidate;
  candidate = candidate.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (candidate !== beforeFence) changes.push('Removed markdown wrapper.');

  const quoteRepair = escapeUnescapedQuotesInsideWords(candidate);
  candidate = quoteRepair.text;
  if (quoteRepair.changes > 0) changes.push(`Escaped ${quoteRepair.changes} unescaped quote(s) inside word(s).`);

  const beforeTrailingComma = candidate;
  candidate = candidate.replace(/,(\s*[}\]])/g, '$1');
  if (candidate !== beforeTrailingComma) changes.push('Removed trailing comma(s).');

  const beforeControls = candidate;
  candidate = escapeLiteralControlsInsideStrings(candidate);
  if (candidate !== beforeControls) changes.push('Escaped literal control characters inside string values.');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const commaCheck = parseAndValidateGemsJson(candidate);
    if (commaCheck.ok || !commaCheck.diagnostics) break;
    const withComma = insertProvenMissingPropertyComma(candidate, commaCheck.diagnostics);
    if (!withComma || withComma === candidate) break;
    candidate = withComma;
    changes.push(`Inserted missing property comma at line ${commaCheck.diagnostics.line}, column ${commaCheck.diagnostics.column}.`);
  }

  const candidateResult = parseAndValidateGemsJson(candidate);
  const requiredContentValid = candidateResult.ok && hasRequiredGemsContent(candidateResult.value);
  const canonicalizedCandidate = candidateResult.ok
    ? canonicalizeGemsPayloadForPersistence(candidateResult.value)
    : null;
  const canonicalValidation = canonicalizedCandidate
    ? validateGemsJsonValue(canonicalizedCandidate)
    : null;
  const canonicalizationValid = Boolean(canonicalValidation?.ok && hasRequiredGemsContent(canonicalizedCandidate));
  if (candidateResult.ok && requiredContentValid && canonicalizationValid && candidate !== raw) {
    return {
      status: 'repaired',
      source: 'deterministic',
      repairedJson: candidate,
      changes,
      original,
      finalValidation: candidateResult.validation,
      safety: buildRepairSafety({
        candidateParsed: true,
        candidateSchemaValid: true,
        requiredContentValid: true,
        canonicalizationValid: true,
      }),
    };
  }

  return {
    status: 'failed',
    source: 'deterministic',
    repairedJson: null,
    changes,
    original,
    candidateDiagnostics: candidateResult.diagnostics,
    candidateValidation: candidateResult.validation,
    finalValidation: null,
    safety: buildRepairSafety({
      candidateParsed: Boolean(candidateResult.value),
      candidateSchemaValid: Boolean(candidateResult.validation?.ok),
      requiredContentValid,
      canonicalizationValid,
    }),
  };
}

export function selectAutomaticDeterministicGemsRepair(rawText) {
  const originalJson = String(rawText ?? '');
  const original = parseAndValidateGemsJson(originalJson);
  if (original.ok) {
    return {
      shouldApply: false,
      status: 'valid',
      originalJson,
      repairedJson: null,
      outcome: null,
    };
  }

  const outcome = repairGemsJsonDeterministically(originalJson);
  if (
    outcome.status !== 'repaired'
    || outcome.source !== 'deterministic'
    || typeof outcome.repairedJson !== 'string'
  ) {
    return {
      shouldApply: false,
      status: outcome.status,
      originalJson,
      repairedJson: null,
      outcome,
    };
  }

  // Re-run the complete parser and existing schema gate at the automatic
  // application boundary. A candidate that fails either check stays manual.
  const verified = parseAndValidateGemsJson(outcome.repairedJson);
  if (!verified.ok) {
    return {
      shouldApply: false,
      status: 'failed',
      originalJson,
      repairedJson: null,
      outcome: {
        ...outcome,
        candidateDiagnostics: verified.diagnostics,
        candidateValidation: verified.validation,
        finalValidation: null,
      },
    };
  }

  return {
    shouldApply: true,
    status: 'repaired',
    originalJson,
    repairedJson: outcome.repairedJson,
    outcome: {
      ...outcome,
      finalValidation: verified.validation,
    },
  };
}

export function buildCanonicalGemsRegenerationPrompt() {
  return [
    'צור מחדש את ניתוח המבזק האחרון והחזר JSON תקין בלבד, ללא Markdown וללא טקסט נוסף.',
    'השתמש בחוזה הקנוני הקצר בלבד: contentType ו-universalTabs. אל תשכפל שדות legacy ברמת השורש.',
    'מבנה נדרש:',
    '{"contentType":"marketBrief","universalTabs":{"summary":{},"chapters":[],"insights":{},"usefulKnowledge":{},"appBuilder":{},"topicsSubtopics":[],"specialized":{}}}',
    'כל מחרוזת חייבת להיות חוקית ב-JSON; שורות חדשות בתוך מחרוזת יש לכתוב כ-\\n.',
    'אם חסר מידע לשדה, החזר מערך או אובייקט ריק. סיים את כל הסוגריים וודא שהתו האחרון הוא }. ',
  ].join('\n');
}

function formatDiagnostics(lines, diagnostics) {
  if (!diagnostics) {
    lines.push('Parser location is unavailable.');
    return;
  }
  lines.push(
    `Parser error: ${diagnostics.message}`,
    `Location: line ${diagnostics.line ?? 'unknown'}, column ${diagnostics.column ?? 'unknown'}, position ${diagnostics.position ?? 'unknown'}, character ${diagnostics.char ?? 'unknown'}.`,
    `Input length: ${diagnostics.inputLength}; diagnostic hash: ${diagnostics.inputHash}.`,
    '',
    '## Diagnostic Context',
    `[BOUNDED CONTEXT ${diagnostics.contextStart}-${diagnostics.contextEnd} of ${diagnostics.inputLength}; truncated-before=${diagnostics.contextTruncatedBefore}; truncated-after=${diagnostics.contextTruncatedAfter}]`,
    '```text',
    diagnostics.context || '(empty)',
    '```',
  );
}

export function buildGemsJsonRepairReport({
  outcome,
  raw,
  serverError = null,
  reason = '',
  prevention = [],
  promptCorrection = '',
  projectName = 'YouTube Mentor Dashboard',
  workId = 'YMD-GEMS-IMPORT-RECOVERY',
  problemDescription = 'GEMS returned JSON that could not complete the strict parse, schema-validation, repair, or persistence flow.',
} = {}) {
  const source = outcome?.source || 'unknown';
  const status = outcome?.status || 'failed';
  const diagnostics = outcome?.original?.diagnostics || null;
  const validation = outcome?.finalValidation || outcome?.original?.validation || outcome?.candidateValidation || null;
  const input = String(raw || '');
  const lines = [
    '# GEMS JSON Repair Report',
    '',
    `Status: ${status}`,
    `Source: ${source}`,
    '',
    '## Project Context',
    `Project: ${projectName}`,
    `WORK-ID: ${workId}`,
    `Problem: ${problemDescription}`,
    '',
    '## Ready-to-Send Codex / Claude Code Request',
    `Continue in the "${projectName}" project under WORK-ID ${workId}. Diagnose the exact GEMS JSON failure documented below, reproduce it with a static fixture, and implement only the smallest compatible correction. Preserve existing records, do not reconstruct truncated content, do not call paid AI/GEMS services, and do not commit without explicit approval.`,
    '',
    '## Original Input',
    `Captured unchanged in the current in-memory repair state. Length: ${input.length}; diagnostic hash: ${hashTextFNV1a(input)}.`,
    '',
    '## Parser / Validation',
  ];

  if (outcome?.original?.ok) {
    lines.push(`Original input passed JSON.parse and schema validation (${outcome.original.validation?.schema || 'unknown schema'}). No repair was required.`);
  } else if (diagnostics) {
    formatDiagnostics(lines, diagnostics);
  } else if (outcome?.original?.validation) {
    lines.push(`JSON.parse passed but schema validation failed: ${outcome.original.validation.errors.join(' | ')}`);
  } else {
    lines.push('No parser diagnostics were captured.');
  }

  if (serverError) {
    lines.push(
      '',
      '## Server Error',
      `Code: ${serverError.code || 'UNKNOWN'}`,
      `HTTP status: ${serverError.status ?? 'unknown'}`,
      `Message: ${serverError.message || 'Unknown server error'}`,
    );
  }

  lines.push('', '## Repair Changes');
  if (Array.isArray(outcome?.changes) && outcome.changes.length > 0) {
    lines.push(...outcome.changes.map((change) => `- ${change}`));
  } else {
    lines.push('- None.');
  }

  if (validation) {
    lines.push(
      '',
      '## Final Schema Validation',
      `Valid: ${validation.ok ? 'yes' : 'no'}`,
      `Schema: ${validation.schema || 'unknown'}`,
    );
    if (validation.errors?.length) lines.push(...validation.errors.map((error) => `- ${error}`));
  }

  if (status === 'regeneration-required') {
    lines.push(
      '',
      '## Regeneration Required',
      'The input ended at EOF or is irrecoverably truncated. Missing content was not invented or reconstructed.',
      '',
      '```text',
      buildCanonicalGemsRegenerationPrompt(),
      '```',
    );
  }

  lines.push(
    '',
    '## Why It Happened',
    reason || (status === 'valid'
      ? 'The input was already valid; invoking repair was unnecessary.'
      : 'The model output did not satisfy the strict JSON and GEMS schema contract.'),
    '',
    '## How To Prevent It',
    ...(prevention.length > 0 ? prevention.map((item) => `- ${item}`) : [
      '- Return strict JSON only.',
      '- Escape newline characters as \\n inside strings.',
      '- Use only the canonical universalTabs output contract.',
      '- Regenerate instead of guessing when output ends at EOF.',
    ]),
    '',
    '## Suggested Prompt/Schema Correction',
    promptCorrection || 'Return the shorter canonical contentType + universalTabs JSON contract only; omit duplicate legacy root fields.',
  );

  if (status === 'repaired' && outcome?.repairedJson && outcome?.finalValidation?.ok) {
    const previewLimit = 2000;
    const preview = outcome.repairedJson.slice(0, previewLimit);
    lines.push(
      '',
      '## Validated Repaired JSON Preview',
      `[${outcome.repairedJson.length > previewLimit ? `TRUNCATED PREVIEW: first ${previewLimit} of ${outcome.repairedJson.length} characters` : `FULL PREVIEW: ${outcome.repairedJson.length} characters`}]`,
      '```json',
      preview,
      '```',
    );
  }

  return lines.join('\n');
}

export function buildSafeGemsRepairReportSnapshot(result, {
  videoId = null,
  generatedAt = new Date().toISOString(),
  persistenceStatus = 'pending',
} = {}) {
  if (!result?.report) return null;
  return {
    videoId,
    report: String(result.report),
    source: result.source || null,
    status: result.validationStatus || result.status || null,
    changes: Array.isArray(result.changes) ? result.changes.map(String) : [],
    generatedAt,
    persistenceStatus,
  };
}
