import {
  parseAndValidateGemsJson,
  repairGemsJsonDeterministically,
} from '../lib/gemsJsonRepair.js';

export const DEFAULT_GEMS_REPAIR_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_REPAIR_TIMEOUT_MS = 150_000;

function repairError(message, code, status = 502) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function stripMarkdownFence(text) {
  return String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function buildRepairPrompt({ rawJson, diagnostics }) {
  return [
    'Return STRICT JSON only. Do not use Markdown.',
    'Repair the supplied GEMS JSON without inventing missing content.',
    'The output wrapper must have exactly these fields:',
    '{"repairedJson":"valid JSON text","changes":[],"why":"","prevention":[],"promptCorrection":""}',
    'Rules:',
    '- repairedJson must itself be a complete JSON object encoded as a JSON string.',
    '- Preserve all existing values and sections.',
    '- Fix syntax/escaping only; do not summarize, omit, or fabricate content.',
    '- Do not return a candidate if content is missing at EOF.',
    '- The repaired document must follow the GEMS schema already present in the input.',
    '',
    `Parser error: ${diagnostics?.message || 'unknown'}`,
    `Parser position: ${diagnostics?.position ?? 'unknown'}`,
    '',
    'Broken JSON:',
    rawJson,
  ].join('\n');
}

function parseGeminiEnvelope(payload) {
  const text = Array.isArray(payload?.candidates?.[0]?.content?.parts)
    ? payload.candidates[0].content.parts.map((part) => part?.text || '').join('\n')
    : '';
  if (!text.trim()) {
    const finishReason = payload?.candidates?.[0]?.finishReason || 'unknown';
    throw repairError(`Gemini returned no repair text (finishReason=${finishReason}).`, 'AI_REPAIR_EMPTY_RESPONSE');
  }
  try {
    return JSON.parse(stripMarkdownFence(text));
  } catch (error) {
    throw repairError(`Gemini repair envelope was not valid JSON: ${error.message}`, 'AI_REPAIR_INVALID_ENVELOPE');
  }
}

export async function callGeminiGemsJsonRepair({
  apiKey,
  rawJson,
  diagnostics,
  model = DEFAULT_GEMS_REPAIR_MODEL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) throw repairError('GEMINI_API_KEY is missing.', 'GEMINI_API_KEY_MISSING', 500);
  if (typeof fetchImpl !== 'function') throw repairError('Server fetch is unavailable.', 'SERVER_FETCH_UNAVAILABLE', 500);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_REPAIR_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildRepairPrompt({ rawJson, diagnostics }) }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 32768,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw repairError(`Gemini repair request timed out after ${GEMINI_REPAIR_TIMEOUT_MS}ms.`, 'GEMINI_REPAIR_TIMEOUT', 504);
    }
    throw repairError(error?.message || 'Gemini repair request failed.', 'GEMINI_REPAIR_NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage = payload?.error?.message || `Gemini repair request failed with HTTP ${response.status}.`;
    throw repairError(providerMessage, payload?.error?.status || 'GEMINI_REPAIR_ERROR', response.status);
  }

  const envelope = parseGeminiEnvelope(payload);
  const repairedJson = typeof envelope?.repairedJson === 'string' ? envelope.repairedJson.trim() : '';
  if (!repairedJson) {
    throw repairError('Gemini repair response omitted repairedJson.', 'AI_REPAIR_MISSING_CANDIDATE');
  }
  const candidate = parseAndValidateGemsJson(repairedJson);
  if (!candidate.ok) {
    const reason = candidate.diagnostics?.message || candidate.validation?.errors?.join(' | ') || 'unknown validation failure';
    throw repairError(`Gemini repair candidate failed final validation: ${reason}`, 'AI_REPAIR_INVALID_CANDIDATE');
  }

  return {
    status: 'repaired',
    source: 'ai',
    repairedJson,
    changes: Array.isArray(envelope.changes) ? envelope.changes.map(String) : [],
    why: typeof envelope.why === 'string' ? envelope.why : '',
    prevention: Array.isArray(envelope.prevention) ? envelope.prevention.map(String) : [],
    promptCorrection: typeof envelope.promptCorrection === 'string' ? envelope.promptCorrection : '',
    finalValidation: candidate.validation,
  };
}

export async function runGemsJsonRepair({
  rawJson,
  apiKey,
  model = DEFAULT_GEMS_REPAIR_MODEL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const raw = String(rawJson || '').trim();
  if (!raw) throw repairError('rawJson is required.', 'MISSING_JSON', 400);

  const deterministic = repairGemsJsonDeterministically(raw);
  if (deterministic.status !== 'failed') return deterministic;

  const aiResult = await callGeminiGemsJsonRepair({
    apiKey,
    rawJson: raw,
    diagnostics: deterministic.original?.diagnostics,
    model,
    fetchImpl,
  });
  return {
    ...aiResult,
    original: deterministic.original,
  };
}

export function serializeGemsRepairError(error) {
  return {
    error: error?.code || 'GEMINI_REPAIR_ERROR',
    message: error?.message || 'GEMS JSON repair failed.',
    status: Number(error?.status) || 502,
  };
}
