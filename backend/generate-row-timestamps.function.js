/**
 * Base44 Backend Function: GenerateRowTimestamps
 *
 * Dedicated, annotation-only operation (WORK-ID YMD-ONDEMAND-ROW-TIMES) —
 * deliberately NOT a rerun of full analysis (see
 * backend/analyze-video.function.js#handler, which normal/automatic
 * analysis still uses and which no longer requests row timestamps at all).
 *
 * Input carries only: the timestamped transcript, the existing visible row
 * texts with their stable paths, and duration when useful for context. No
 * title, mentor, category, channel name, or local record id is ever part of
 * this request.
 *
 * Output carries ONLY timestamp proposals keyed by the rowPath the caller
 * supplied — never rewritten row text, never new rows.
 *
 * Env:
 * - ANTHROPIC_API_KEY or VITE_ANTHROPIC_API_KEY
 * - Optional: ANTHROPIC_MODEL
 *
 * Deployed standalone by Base44 (no bundler, no repo access) — the pieces
 * below duplicate, byte-for-byte in behavior, the following canonical
 * modules; see scripts/row-timestamp-annotation-qa.mjs for the parity
 * tests between each pair:
 *   - src/lib/claudeJsonRepair.js        (stripMarkdownFences, repair, safe parse)
 *   - src/lib/timedNarrativeEvidenceGate.js (parseTimedTranscriptSegments, verify)
 *   - src/lib/rowTimestampAnnotation.js  (prompt, gate-to-annotations)
 */

const CLAUDE_MAX_TOKENS = 4_000;
const TRANSCRIPT_CHAR_LIMIT = 200_000;
const CLAUDE_SYSTEM_PROMPT = [
  'Return ONLY valid JSON.',
  'Do not wrap the output in Markdown code fences.',
  'Your entire response must be a single JSON object that starts with "{" and ends with "}".',
].join('\n');

// ── Transcript parsing (identical copy — see src/lib/timedNarrativeEvidenceGate.js) ──
const TIMED_LINE_RE = /^\[(\d+(?:\.\d+)?)\]\s?(.*)$/;
const DEFAULT_MAX_QUOTE_WINDOW = 10;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function isFiniteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function normalizeRowText(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}
function fingerprintRowText(text) {
  const normalized = normalizeRowText(text);
  let hash = 5381;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(16);
}
function parseTimedTranscriptSegments(transcriptText) {
  const lines = String(transcriptText || '').split('\n');
  const segments = [];
  for (const line of lines) {
    const match = TIMED_LINE_RE.exec(line.trim());
    if (!match) continue;
    const startSeconds = Number(match[1]);
    if (!Number.isFinite(startSeconds)) continue;
    segments.push({ startSeconds, text: match[2].trim() });
  }
  return segments;
}
function locateLiteralQuoteWindow(segments, quote, { maxWindow = DEFAULT_MAX_QUOTE_WINDOW } = {}) {
  const cleanQuote = cleanText(quote);
  if (!cleanQuote || !Array.isArray(segments) || segments.length === 0) return null;
  for (let startIndex = 0; startIndex < segments.length; startIndex += 1) {
    for (let width = 1; width <= maxWindow && startIndex + width <= segments.length; width += 1) {
      const window = segments.slice(startIndex, startIndex + width);
      const windowText = window.map((segment) => segment.text).join(' ');
      if (!windowText.includes(cleanQuote)) continue;
      const intervalStart = window[0].startSeconds;
      const nextSegment = segments[startIndex + width];
      const intervalEnd = nextSegment ? nextSegment.startSeconds : intervalStart;
      return { intervalStart, intervalEnd };
    }
  }
  return null;
}
function verifyTimedNarrativeEvidence(item, segments) {
  if (!item || typeof item !== 'object') return { hasClaim: false, verified: false };
  const quote = cleanText(item.sourceQuote);
  const timeProvided = item.estimatedStartSeconds !== undefined && item.estimatedStartSeconds !== null;
  const hasClaim = Boolean(quote) || timeProvided;
  if (!hasClaim) return { hasClaim: false, verified: false };
  const time = item.estimatedStartSeconds;
  if (!quote || !isFiniteNonNegative(time)) return { hasClaim: true, verified: false, reason: 'incomplete-claim' };
  const window = locateLiteralQuoteWindow(segments, quote);
  if (!window) return { hasClaim: true, verified: false, reason: 'quote-not-found' };
  const withinWindow = time >= window.intervalStart && time <= window.intervalEnd;
  if (!withinWindow) return { hasClaim: true, verified: false, reason: 'time-outside-window', window };
  return { hasClaim: true, verified: true, window };
}

// ── JSON repair (identical copy — see src/lib/claudeJsonRepair.js) ──
function repairUnescapedMidWordQuotes(text) {
  return String(text || '').replace(/([ְ-׿\w])"([ְ-׿\w])/g, '$1\\"$2');
}
function extractJsonParseDiagnostics(text, error) {
  const message = String(error?.message || '');
  const match = message.match(/position\s+(\d+)/i);
  const position = match ? Number(match[1]) : null;
  const windowStart = Number.isFinite(position) ? Math.max(0, position - 120) : 0;
  const windowEnd = Number.isFinite(position) ? Math.min(text.length, position + 120) : Math.min(text.length, 240);
  return {
    parseError: message,
    parseErrorPosition: Number.isFinite(position) ? position : null,
    parseErrorSnippet: text.slice(windowStart, windowEnd),
  };
}
function parseModelJson(rawText) {
  const cleaned = String(rawText || '').trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    const repaired = repairUnescapedMidWordQuotes(cleaned);
    if (repaired === cleaned) {
      const wrapped = new Error('Claude returned invalid JSON.');
      wrapped.code = 'ROW_TIMESTAMPS_INVALID_JSON';
      wrapped.status = 502;
      wrapped.diagnostics = extractJsonParseDiagnostics(cleaned, firstError);
      throw wrapped;
    }
    try {
      return JSON.parse(repaired);
    } catch (secondError) {
      const wrapped = new Error('Claude returned invalid JSON.');
      wrapped.code = 'ROW_TIMESTAMPS_INVALID_JSON';
      wrapped.status = 502;
      wrapped.diagnostics = extractJsonParseDiagnostics(repaired, secondError);
      throw wrapped;
    }
  }
}

// ── Prompt (identical copy — see src/lib/rowTimestampAnnotation.js) ──
function buildRowTimestampPrompt({ transcriptText, rows }) {
  const rowsBlock = rows.map((r) => `${r.rowPath}: ${r.text}`).join('\n');
  return [
    'להלן רשימת שורות טקסט קיימות מניתוח סרטון, ותמלול מתוזמן של אותו סרטון.',
    'המשימה שלך היא לאתר, עבור כל שורה, האם קיים ציטוט מילולי בתמלול שתומך בה — ואם כן, לציין את הזמן.',
    '',
    'אסור בהחלט:',
    '- לשכתב, לקצר או לשנות את טקסט השורה בכל צורה.',
    '- להחזיר שורות חדשות שלא קיבלת.',
    '- להסיק זמן מסדר השורות, מהתקדמות הטקסט או מחלוקת הסרטון לחלונות שווים.',
    '- להמציא ציטוט או זמן שאינו קיים מילולית בתמלול.',
    '',
    'עבור כל שורה שיש לה ראיית זמן מילולית וניתנת להגנה:',
    '- rowPath: העתק בדיוק את המזהה שקיבלת (לדוגמה summary.keyPoints[0]).',
    '- sourceQuote: ציטוט מילולי מדויק מהתמלול (חייב להופיע מילה במילה בתמלול).',
    '- estimatedStartSeconds: מספר שניות, בתוך קטע התמלול שמכיל את הציטוט.',
    '- estimatedEndSeconds: אופציונלי.',
    '- timestampConfidence: מספר בין 0 ל-1.',
    '',
    'עבור שורה שאין לה ראיית זמן ניתנת להגנה — אל תכלול אותה בכלל בתשובה (אל תמציא ערך).',
    '',
    'החזר JSON בפורמט הבא בדיוק:',
    JSON.stringify({
      annotations: [
        { rowPath: '...', sourceQuote: '...', estimatedStartSeconds: 0, estimatedEndSeconds: null, timestampConfidence: 0.9 },
      ],
    }, null, 2),
    '',
    'שורות לניתוח:',
    rowsBlock,
    '',
    'תמלול מתוזמן:',
    String(transcriptText || '').trim(),
  ].join('\n');
}

// ── Row-annotation gate (identical copy — see src/lib/rowTimestampAnnotation.js) ──
function applyEvidenceGateToRowAnnotations(rawAnnotations, rows, segments) {
  const rowsByPath = new Map(rows.map((r) => [r.rowPath, r]));
  const accepted = [];
  const rejected = [];
  const list = Array.isArray(rawAnnotations) ? rawAnnotations : [];
  for (const raw of list) {
    const rowPath = raw?.rowPath;
    const row = rowsByPath.get(rowPath);
    if (!row) { rejected.push({ rowPath: rowPath || null, reason: 'unknown-row-path', raw }); continue; }
    const evidence = verifyTimedNarrativeEvidence(
      { estimatedStartSeconds: raw.estimatedStartSeconds, sourceQuote: raw.sourceQuote },
      segments
    );
    if (!evidence.verified) { rejected.push({ rowPath, reason: evidence.reason || 'no-time-claim', raw }); continue; }
    accepted.push({
      rowPath,
      fingerprint: row.fingerprint,
      estimatedStartSeconds: raw.estimatedStartSeconds,
      estimatedEndSeconds: Number.isFinite(Number(raw.estimatedEndSeconds)) ? Number(raw.estimatedEndSeconds) : null,
      timestampConfidence: raw.timestampConfidence ?? null,
      sourceQuote: raw.sourceQuote,
      rowText: row.text,
      tab: row.tab,
      field: row.field,
    });
  }
  return { accepted, rejected };
}

async function callClaude(payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    const error = new Error('Missing ANTHROPIC_API_KEY');
    error.code = 'CLAUDE_API_KEY_MISSING';
    throw error;
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || 'Claude request failed');
    error.code = 'CLAUDE_ERROR';
    error.status = response.status;
    throw error;
  }
  return data;
}

/**
 * handler({ transcript, rows, durationSeconds }, { entities })
 *
 * `rows`: [{ rowPath, text }] — the exact, already-existing row texts to
 * annotate (caller-supplied; this function never fetches or regenerates
 * them). `entities` is accepted for Base44 convention consistency but is
 * NEVER used — this operation performs zero storage reads or writes.
 */
async function handler({ transcript = '', rows = [], durationSeconds = 0 } = {}, _context) {
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error('No rows supplied to annotate');
    error.code = 'NO_ROWS';
    throw error;
  }
  const rawTranscriptText = String(transcript || '').trim();
  const transcriptText = rawTranscriptText.slice(0, TRANSCRIPT_CHAR_LIMIT);
  if (!transcriptText) {
    const error = new Error('Transcript required');
    error.code = 'TRANSCRIPT_REQUIRED';
    throw error;
  }

  const cleanRows = rows
    .map((r) => {
      const text = String(r?.text || '').trim();
      return { rowPath: String(r?.rowPath || ''), text, fingerprint: fingerprintRowText(text) };
    })
    .filter((r) => r.rowPath && r.text);
  if (cleanRows.length === 0) {
    const error = new Error('No valid rows supplied to annotate');
    error.code = 'NO_ROWS';
    throw error;
  }

  const prompt = buildRowTimestampPrompt({ transcriptText, rows: cleanRows });
  const selectedModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  console.log('[RowTimestamps] request started', {
    model: selectedModel,
    rowCount: cleanRows.length,
    transcriptChars: transcriptText.length,
    promptChars: prompt.length,
    durationSeconds,
  });

  const result = await callClaude({
    model: selectedModel,
    max_tokens: CLAUDE_MAX_TOKENS,
    temperature: 0.1,
    system: CLAUDE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = Array.isArray(result?.content)
    ? result.content.filter((item) => item?.type === 'text').map((item) => item.text || '').join('\n')
    : '';

  const parsed = parseModelJson(text);
  const rawAnnotations = Array.isArray(parsed?.annotations) ? parsed.annotations : [];
  const fullSegments = parseTimedTranscriptSegments(rawTranscriptText);
  const segments = parseTimedTranscriptSegments(transcriptText);
  const { accepted, rejected } = applyEvidenceGateToRowAnnotations(rawAnnotations, cleanRows, segments);

  const staticTimeCoverage = {
    totalChars: rawTranscriptText.length,
    analyzedChars: transcriptText.length,
    totalSegments: fullSegments.length,
    analyzedSegments: segments.length,
    skippedSegments: Math.max(0, fullSegments.length - segments.length),
    status: segments.length >= fullSegments.length && fullSegments.length > 0 ? 'full' : (fullSegments.length === 0 ? 'unknown' : 'partial'),
  };

  console.log('[RowTimestamps] response gated', {
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    requestedRows: cleanRows.length,
    staticTimeCoverage,
  });

  return {
    provider: 'claude',
    model: selectedModel,
    rowCount: cleanRows.length,
    accepted,
    rejected,
    staticTimeCoverage,
    usage: result?.usage || null,
  };
}

module.exports = {
  handler,
  buildRowTimestampPrompt,
  applyEvidenceGateToRowAnnotations,
  parseTimedTranscriptSegments,
  verifyTimedNarrativeEvidence,
  fingerprintRowText,
  repairUnescapedMidWordQuotes,
  parseModelJson,
  callClaude,
  CLAUDE_MAX_TOKENS,
  TRANSCRIPT_CHAR_LIMIT,
  CLAUDE_SYSTEM_PROMPT,
};
