const CONTEXT_RADIUS = 180;
const SECRET_PATTERNS = [
  [/(Authorization|Cookie)\s*:\s*[^\r\n]+/gi, '$1: [REDACTED]'],
  [/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_GOOGLE_KEY]'],
  [/\bsk-(?:ant-)?[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_API_KEY]'],
  [/("(?:api[_-]?key|token|secret|password|client_secret)"\s*:\s*")[^"]*(")/gi, '$1[REDACTED]$2'],
];

export const ANALYSIS_FAILURE_CATEGORIES = Object.freeze([
  'transcript-missing', 'transcript-fetch-failed', 'transcript-empty', 'transcript-untimed',
  'provider-request-failed', 'provider-empty-response', 'provider-truncated-response',
  'json-malformed', 'json-unescaped-quote', 'json-code-fence', 'manual-input-not-json',
  'schema-invalid', 'repair-failed', 'persistence-failed', 'unknown-analysis-failure',
]);

export function redactDiagnosticText(value = '') {
  let text = String(value);
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text.replace(/(?:fullTranscript|transcript)\s*[:=]\s*[\s\S]{300,}/gi, '[FULL TRANSCRIPT REDACTED]');
}

export function resolveFailureLocation(message = '', raw = '', explicitPosition = null) {
  const positionMatch = String(message).match(/\bposition\s+(\d+)\b/i);
  const lineMatch = String(message).match(/\bline\s+(\d+)\s+column\s+(\d+)\b/i);
  const position = Number.isFinite(explicitPosition) ? explicitPosition : positionMatch ? Number(positionMatch[1]) : null;
  let computedLine = null;
  let computedColumn = null;
  if (Number.isFinite(position) && raw) {
    const rows = String(raw).slice(0, position).split(/\r?\n/);
    computedLine = rows.length;
    computedColumn = (rows.at(-1)?.length || 0) + 1;
  }
  const line = lineMatch ? Number(lineMatch[1]) : computedLine;
  const column = lineMatch ? Number(lineMatch[2]) : computedColumn;
  return { position, line, column, computedLine, computedColumn, disagreement: Boolean(lineMatch && computedLine && (line !== computedLine || column !== computedColumn)) };
}

export function extractSafeFailureContext(raw = '', position = null) {
  if (!raw || !Number.isFinite(position)) return '';
  const text = String(raw);
  const safePosition = Math.max(0, Math.min(position, text.length));
  const start = Math.max(0, safePosition - CONTEXT_RADIUS);
  const end = Math.min(text.length, safePosition + CONTEXT_RADIUS + 1);
  const before = redactDiagnosticText(text.slice(start, safePosition));
  const character = redactDiagnosticText(text.slice(safePosition, safePosition + 1)) || '[END]';
  const after = redactDiagnosticText(text.slice(safePosition + 1, end));
  return `${before}[OFFSET ${safePosition} · CHAR ${JSON.stringify(character)}]${after}`;
}

export function detectManualGemsInputKind(raw = '') {
  const text = String(raw).trimStart();
  if (!text) return 'empty';
  if (/^VIDEO TITLE\s*:/i.test(text) && /\nTRANSCRIPT\s*:/i.test(text)) return 'transcript-context';
  if (/^(?:\{|\[|```(?:json)?)/i.test(text)) return 'json-candidate';
  return 'plain-text';
}

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return `afd-${(result >>> 0).toString(16).padStart(8, '0')}`;
}

export function classifyAnalysisFailure({ code = '', message = '', raw = '', position = null, stage = '' } = {}) {
  const inputKind = detectManualGemsInputKind(raw);
  const effectivePosition = inputKind === 'transcript-context' && !Number.isFinite(position) ? Math.max(0, String(raw).search(/\S/)) : position;
  const location = resolveFailureLocation(message, raw, effectivePosition);
  const normalized = `${code} ${message}`.toLowerCase();
  let category = 'unknown-analysis-failure';
  if (inputKind === 'transcript-context') category = 'manual-input-not-json';
  else if (/transcript.*missing|no transcript/.test(normalized)) category = 'transcript-missing';
  else if (/transcript.*fetch|caption.*fetch/.test(normalized)) category = 'transcript-fetch-failed';
  else if (/transcript.*empty/.test(normalized)) category = 'transcript-empty';
  else if (/untimed|missing.*timing/.test(normalized)) category = 'transcript-untimed';
  else if (/empty_provider_response|provider.*empty/.test(normalized)) category = 'provider-empty-response';
  else if (/truncat|unexpected end|unterminated/.test(normalized)) category = 'provider-truncated-response';
  else if (/invalid_market_schema|schema/.test(normalized)) category = 'schema-invalid';
  else if (/repair/.test(normalized)) category = 'repair-failed';
  else if (/persist|storage|save failed/.test(normalized)) category = 'persistence-failed';
  else if (/request|network|fetch failed|gemini_error/.test(normalized)) category = 'provider-request-failed';
  else if (/```/.test(raw)) category = 'json-code-fence';
  else if (/json|unexpected token|expected |property value|comma/.test(normalized)) {
    const nearby = String(raw).slice(Math.max(0, (location.position || 0) - 120), (location.position || 0) + 120);
    category = /[\u0590-\u05ffA-Za-z0-9]\s*"[\u0590-\u05ffA-Za-z]/.test(nearby) ? 'json-unescaped-quote' : 'json-malformed';
  }
  return {
    category, stage, technicalMessage: redactDiagnosticText(message || code),
    line: location.line, column: location.column, offset: location.position,
    locationDisagreement: location.disagreement,
    safeContext: extractSafeFailureContext(raw, location.position),
    previousDataPreserved: true,
  };
}

export function buildPayloadProcessingTrace({ rawProviderOutput = '', parserInput = '', position = null } = {}) {
  const raw = String(rawProviderOutput);
  const parsed = String(parserInput);
  return {
    rawLength: raw.length, parserInputLength: parsed.length,
    rawHash: hash(raw), parserInputHash: hash(parsed),
    relation: raw === parsed ? 'identical' : 'changed-before-parse',
    rawExcerpt: extractSafeFailureContext(raw, position),
    parserInputExcerpt: extractSafeFailureContext(parsed, position),
  };
}

export function buildAnalysisFailureFingerprint(diagnostic, { route = '', schemaVersion = '' } = {}) {
  const normalized = String(diagnostic?.technicalMessage || '').toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
  return hash([diagnostic?.category, diagnostic?.stage, normalized, route, schemaVersion].join('|'));
}
