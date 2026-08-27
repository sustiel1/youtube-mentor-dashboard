/**
 * Base44 Backend Function: RepairGemsJson
 *
 * Production counterpart of the local Vite /api/gemini-repair-json route.
 * The function is standalone because Base44 deploys backend functions without
 * access to project imports. It deliberately fails closed for EOF/truncation
 * and returns a repair only after JSON.parse plus the GEMS schema gate pass.
 *
 * Env:
 * - GEMINI_API_KEY
 * - Optional GEMINI_REPAIR_MODEL (defaults to gemini-3.5-flash-lite)
 */

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const PROVIDER_TIMEOUT_MS = 150_000;

const UNIVERSAL_TYPES = {
  summary: ['object', 'array'],
  chapters: ['array'],
  insights: ['object', 'array'],
  usefulKnowledge: ['object', 'array'],
  appBuilder: ['object'],
  topicsSubtopics: ['object', 'array'],
  specialized: ['object'],
};

const LEGACY_MARKET_FIELDS = [
  'shortSummary', 'fullSummary', 'chapters', 'top5Insights',
  'reusableKnowledge', 'keyTakeaways', 'marketNews', 'indices',
  'stocksMentioned', 'macro', 'sentiment', 'calendar',
  'opportunities', 'risks',
];

const GENERIC_FIELDS = [
  'shortSummary', 'fullSummary', 'keyPoints', 'allPoints', 'chapters',
  'keyInsights', 'usefulKnowledge', 'actionItems', 'politicalSummary',
  'brainHighlights',
];

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function lineColumn(text, position) {
  const lines = text.slice(0, position).split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function validate(value) {
  const errors = [];
  if (!isObject(value)) return { ok: false, schema: null, errors: ['Root value must be a JSON object.'] };
  if (hasOwn(value, 'contentType') && typeof value.contentType !== 'string') {
    errors.push('contentType must be a string when present.');
  }
  const contentType = typeof value.contentType === 'string' ? value.contentType.trim() : '';
  const tabs = value.universalTabs;
  if (hasOwn(value, 'universalTabs') && !isObject(tabs)) errors.push('universalTabs must be an object.');

  if (isObject(tabs)) {
    const present = Object.keys(UNIVERSAL_TYPES).filter((key) => hasOwn(tabs, key));
    for (const key of present) {
      const actual = typeOf(tabs[key]);
      if (!UNIVERSAL_TYPES[key].includes(actual)) {
        errors.push(`universalTabs.${key} must be ${UNIVERSAL_TYPES[key].join(' or ')}, received ${actual}.`);
      }
    }
    if (present.length === 0) errors.push('universalTabs does not contain a supported tab section.');
  }

  if (contentType === 'marketBrief') {
    if (isObject(tabs)) {
      if (!['chapters', 'insights', 'usefulKnowledge', 'specialized'].some((key) => hasOwn(tabs, key))) {
        errors.push('Canonical marketBrief requires at least one content section besides summary.');
      }
      return { ok: errors.length === 0, schema: 'marketBrief-canonical', errors };
    }
    if (LEGACY_MARKET_FIELDS.filter((key) => hasOwn(value, key)).length < 2) {
      errors.push('Legacy marketBrief requires at least two recognized top-level content fields.');
    }
    return { ok: errors.length === 0, schema: 'marketBrief-legacy', errors };
  }
  if (isObject(tabs)) return { ok: errors.length === 0, schema: 'universal-tabs', errors };
  if (!GENERIC_FIELDS.some((key) => hasOwn(value, key))) errors.push('No recognized GEMS analysis fields were found.');
  return { ok: errors.length === 0, schema: 'analysis-legacy', errors };
}

function diagnostics(text, error) {
  const message = String(error?.message || error || 'Invalid JSON');
  const positionMatch = message.match(/position\s+(\d+)/i) || message.match(/\bat\s+(\d+)\b/i);
  let position = positionMatch ? Number(positionMatch[1]) : null;
  const explicitEof = /unexpected end|end of json input|unterminated string/i.test(message);
  if (!Number.isFinite(position) && explicitEof) position = text.length;
  if (Number.isFinite(position)) position = Math.min(text.length, Math.max(0, position));
  const lastContentPosition = text.trimEnd().length;
  const location = Number.isFinite(position) ? lineColumn(text, position) : { line: null, column: null };
  const contextStart = Number.isFinite(position) ? Math.max(0, position - 240) : 0;
  const contextEnd = Number.isFinite(position) ? Math.min(text.length, position + 240) : Math.min(text.length, 480);
  const context = text.slice(contextStart, contextEnd);
  const markerOffset = Number.isFinite(position) ? position - contextStart : null;
  return {
    message,
    position: Number.isFinite(position) ? position : null,
    line: location.line,
    column: location.column,
    char: Number.isFinite(position) ? (text[position] ?? 'EOF') : null,
    isEof: explicitEof || (Number.isFinite(position) && position >= lastContentPosition),
    inputLength: text.length,
    inputHash: hashText(text),
    context: Number.isFinite(markerOffset)
      ? `${context.slice(0, markerOffset)}[PARSER_ERROR]${context.slice(markerOffset)}`
      : context,
    contextStart,
    contextEnd,
    contextTruncatedBefore: contextStart > 0,
    contextTruncatedAfter: contextEnd < text.length,
  };
}

function parseAndValidate(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, diagnostics: diagnostics(text, error), validation: null };
  }
  const validation = validate(value);
  return { ok: validation.ok, diagnostics: null, validation };
}

function escapeControls(text) {
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) { output += char; escaped = false; continue; }
    if (char === '\\' && inString) { output += char; escaped = true; continue; }
    if (char === '"') { output += char; inString = !inString; continue; }
    if (inString && char === '\n') { output += '\\n'; continue; }
    if (inString && char === '\r') { output += '\\r'; continue; }
    if (inString && char === '\t') { output += '\\t'; continue; }
    output += char;
  }
  return output;
}

function deterministicRepair(raw) {
  const original = parseAndValidate(raw);
  if (original.ok) return { status: 'valid', source: 'original', repairedJson: null, changes: [], original, finalValidation: original.validation };
  if (original.diagnostics?.isEof) {
    return { status: 'regeneration-required', source: 'regeneration', repairedJson: null, changes: [], original, finalValidation: null };
  }

  let candidate = raw;
  const changes = [];
  const beforeFence = candidate;
  candidate = candidate.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (candidate !== beforeFence) changes.push('Removed markdown wrapper.');
  const beforeQuotes = candidate;
  candidate = candidate.replace(/([\u05B0-\u05FF\w])"([\u05B0-\u05FF\w])/g, '$1\\"$2');
  if (candidate !== beforeQuotes) changes.push('Escaped an unescaped quote inside a word.');
  const beforeComma = candidate;
  candidate = candidate.replace(/,(\s*[}\]])/g, '$1');
  if (candidate !== beforeComma) changes.push('Removed trailing comma(s).');
  const beforeControls = candidate;
  candidate = escapeControls(candidate);
  if (candidate !== beforeControls) changes.push('Escaped literal control characters inside string values.');

  const finalResult = parseAndValidate(candidate);
  if (candidate !== raw && finalResult.ok) {
    return {
      status: 'repaired',
      source: 'deterministic',
      repairedJson: candidate,
      changes,
      original,
      finalValidation: finalResult.validation,
    };
  }
  return {
    status: 'failed',
    source: 'deterministic',
    repairedJson: null,
    changes,
    original,
    diagnostics: original.diagnostics,
    finalValidation: null,
  };
}

function createError(message, code, status = 502) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function buildPrompt(rawJson, parserDiagnostics) {
  return [
    'Return STRICT JSON only. Do not use Markdown.',
    'Repair syntax and escaping only. Preserve every existing value and section.',
    'Never invent content that is absent from the input.',
    'Return exactly: {"repairedJson":"valid JSON text","changes":[],"why":"","prevention":[],"promptCorrection":""}',
    `Parser error: ${parserDiagnostics?.message || 'unknown'}`,
    `Parser position: ${parserDiagnostics?.position ?? 'unknown'}`,
    'Broken JSON:',
    rawJson,
  ].join('\n');
}

async function callGemini(rawJson, parserDiagnostics) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw createError('GEMINI_API_KEY is missing.', 'GEMINI_API_KEY_MISSING', 500);
  const model = process.env.GEMINI_REPAIR_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(rawJson, parserDiagnostics) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 32768, responseMimeType: 'application/json' },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw createError(`Gemini repair request timed out after ${PROVIDER_TIMEOUT_MS}ms.`, 'GEMINI_REPAIR_TIMEOUT', 504);
    }
    throw createError(error?.message || 'Gemini repair request failed.', 'GEMINI_REPAIR_NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw createError(
      payload?.error?.message || `Gemini repair request failed with HTTP ${response.status}.`,
      payload?.error?.status || 'GEMINI_REPAIR_ERROR',
      response.status,
    );
  }
  const responseText = Array.isArray(payload?.candidates?.[0]?.content?.parts)
    ? payload.candidates[0].content.parts.map((part) => part?.text || '').join('\n')
    : '';
  let envelope;
  try {
    envelope = JSON.parse(responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
  } catch (error) {
    throw createError(`Gemini repair envelope was not valid JSON: ${error.message}`, 'AI_REPAIR_INVALID_ENVELOPE');
  }
  const repairedJson = typeof envelope?.repairedJson === 'string' ? envelope.repairedJson.trim() : '';
  if (!repairedJson) throw createError('Gemini repair response omitted repairedJson.', 'AI_REPAIR_MISSING_CANDIDATE');
  const finalResult = parseAndValidate(repairedJson);
  if (!finalResult.ok) {
    const reason = finalResult.diagnostics?.message || finalResult.validation?.errors?.join(' | ') || 'unknown validation failure';
    throw createError(`Gemini repair candidate failed final validation: ${reason}`, 'AI_REPAIR_INVALID_CANDIDATE');
  }
  return {
    status: 'repaired',
    source: 'ai',
    repairedJson,
    changes: Array.isArray(envelope.changes) ? envelope.changes.map(String) : [],
    why: typeof envelope.why === 'string' ? envelope.why : '',
    prevention: Array.isArray(envelope.prevention) ? envelope.prevention.map(String) : [],
    promptCorrection: typeof envelope.promptCorrection === 'string' ? envelope.promptCorrection : '',
    finalValidation: finalResult.validation,
  };
}

async function handler({ rawJson } = {}) {
  const raw = String(rawJson || '').trim();
  if (!raw) throw createError('rawJson is required.', 'MISSING_JSON', 400);
  const deterministic = deterministicRepair(raw);
  if (deterministic.status !== 'failed') return deterministic;
  return { ...(await callGemini(raw, deterministic.diagnostics)), original: deterministic.original };
}

module.exports = {
  handler,
  validate,
  parseAndValidate,
  deterministicRepair,
  DEFAULT_MODEL,
};
