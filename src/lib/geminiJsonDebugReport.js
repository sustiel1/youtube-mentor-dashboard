/**
 * Builds a plain-text diagnostic report for a failed/partially-failed GEMS JSON
 * paste, meant to be copied and pasted directly into Claude Code for debugging.
 * Self-contained (no project imports) so it can also run under plain Node in
 * scripts/tests without a bundler.
 */

// Matches the transcript chunking threshold used elsewhere in the app
// (see CLAUDE.md "AI settings" table — CHUNK_THRESHOLD = 15_000) so the
// debug report's truncation point stays consistent with what the app itself
// already treats as "large" text.
const TRANSCRIPT_SAFE_CHARS = 15000;
const TRANSCRIPT_HEAD_CHARS = 9000;
const TRANSCRIPT_TAIL_CHARS = 4000;

// Generic safety cap for other free-text fields (raw output, repair candidate,
// AI repair result) so a pathological input can't blow up the clipboard payload.
const FIELD_SAFE_CHARS = 200000;
const FIELD_HEAD_CHARS = 150000;
const FIELD_TAIL_CHARS = 40000;

const SECRET_PATTERNS = [
  // Bearer tokens
  [/Bearer\s+[A-Za-z0-9\-_.=]+/gi, 'Bearer [REDACTED]'],
  // Authorization / Cookie headers
  [/Authorization:\s*\S+/gi, 'Authorization: [REDACTED]'],
  [/Cookie:\s*[^\n\r]+/gi, 'Cookie: [REDACTED]'],
  // Provider-specific key prefixes
  [/\bsk-ant-[A-Za-z0-9\-_]{10,}\b/g, '[REDACTED_ANTHROPIC_KEY]'],
  [/\bsk-[A-Za-z0-9\-_]{10,}\b/g, '[REDACTED_API_KEY]'],
  [/\bAIza[0-9A-Za-z\-_]{20,}\b/g, '[REDACTED_GOOGLE_KEY]'],
  // Generic "key": "value" / "token": "value" style JSON/env fields
  [/("(?:api[_-]?key|apikey|access_token|refresh_token|secret|password|token|client_secret)"\s*:\s*")[^"]*(")/gi, '$1[REDACTED]$2'],
  [/((?:api[_-]?key|apikey|access_token|refresh_token|secret|password|token|client_secret)\s*=\s*)[^\s&"']+/gi, '$1[REDACTED]'],
];

function sanitizeSecrets(text) {
  if (!text) return text;
  let out = String(text);
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Safely turns any value into readable text — never leaves "[object Object]". */
function safeStringify(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[circular]';
        seen.add(val);
      }
      return val;
    }, 2);
  } catch {
    try { return String(value); } catch { return '[unserializable value]'; }
  }
}

function truncateMiddle(text, headChars, tailChars, label) {
  const str = String(text);
  if (str.length <= headChars + tailChars) return str;
  const omitted = str.length - headChars - tailChars;
  return (
    str.slice(0, headChars) +
    `\n\n... [${label} truncated — ${omitted} characters omitted from the middle, ` +
    `total length ${str.length}] ...\n\n` +
    str.slice(str.length - tailChars)
  );
}

function formatTranscriptBlock(transcript) {
  if (!transcript) return null;
  const text = String(transcript);
  const charCount = text.length;
  const body = text.length > TRANSCRIPT_SAFE_CHARS
    ? truncateMiddle(text, TRANSCRIPT_HEAD_CHARS, TRANSCRIPT_TAIL_CHARS, 'transcript')
    : text;
  return { charCount, body };
}

function formatLargeField(value, label) {
  const text = safeStringify(value);
  if (!text) return '';
  return text.length > FIELD_SAFE_CHARS
    ? truncateMiddle(text, FIELD_HEAD_CHARS, FIELD_TAIL_CHARS, label)
    : text;
}

const CLAUDE_CODE_INSTRUCTIONS = `Claude Code — please use the data below to:
1. Reproduce the issue using the included raw Gemini output (and transcript, if present).
2. Audit the exact parsing path this input goes through in the app.
3. Identify the root cause of the parse/repair failure.
4. Implement the smallest safe fix — do not refactor unrelated code.
5. Preserve existing behavior for already-valid JSON.
6. Preserve Hebrew text, quotation marks, geresh (') and gershayim (") exactly.
7. Add a focused regression test/fixture covering this case.
8. Run the production build and confirm it passes.
9. Avoid unrelated changes.
10. Do not commit or push unless explicitly asked to.`;

/**
 * @param {object} input
 * @param {string} [input.videoTitle]
 * @param {string} [input.videoId]
 * @param {string} [input.videoUrl]
 * @param {string} [input.channelName]
 * @param {string} [input.contentType]
 * @param {string|Error} [input.parseError]
 * @param {boolean} [input.parseValid]
 * @param {string} [input.rawGeminiOutput]
 * @param {string} [input.transcript]
 * @param {string|object} [input.repairCandidate]
 * @param {string|object} [input.aiRepairResult]
 * @param {object} [input.diagnostics]
 * @returns {string} plain-text report, ready to copy into Claude Code
 */
export function createGeminiJsonDebugReport({
  videoTitle,
  videoId,
  videoUrl,
  channelName,
  contentType,
  parseError,
  parseValid,
  rawGeminiOutput,
  transcript,
  repairCandidate,
  aiRepairResult,
  diagnostics,
} = {}) {
  const lines = [];

  lines.push('================ CLAUDE CODE TASK ================');
  lines.push(CLAUDE_CODE_INSTRUCTIONS);
  lines.push('');

  lines.push('================ VIDEO METADATA ================');
  lines.push(`Title: ${videoTitle || '(not available)'}`);
  lines.push(`Video ID: ${videoId || '(not available)'}`);
  lines.push(`Video URL: ${videoUrl || '(not available)'}`);
  lines.push(`Channel: ${channelName || '(not available)'}`);
  lines.push(`Content type: ${contentType || '(not available)'}`);
  lines.push('');

  lines.push('================ PARSE ERROR ================');
  lines.push(`parseValid: ${parseValid === undefined ? '(unknown)' : String(parseValid)}`);
  const errText = parseError instanceof Error ? parseError.message : parseError;
  lines.push(`Error: ${errText ? sanitizeSecrets(String(errText)) : '(none)'}`);
  lines.push('');

  if (diagnostics && typeof diagnostics === 'object' && Object.keys(diagnostics).length > 0) {
    lines.push('================ DIAGNOSTICS ================');
    lines.push(sanitizeSecrets(formatLargeField(diagnostics, 'diagnostics')));
    lines.push('');
  }

  lines.push('================ RAW GEMINI OUTPUT START ================');
  lines.push(rawGeminiOutput ? sanitizeSecrets(formatLargeField(rawGeminiOutput, 'raw Gemini output')) : '(not available)');
  lines.push('================ RAW GEMINI OUTPUT END ================');
  lines.push('');

  const transcriptBlock = formatTranscriptBlock(transcript);
  lines.push('================ TRANSCRIPT START ================');
  if (transcriptBlock) {
    lines.push(`(transcript length: ${transcriptBlock.charCount} characters)`);
    lines.push(sanitizeSecrets(transcriptBlock.body));
  } else {
    lines.push('(not available)');
  }
  lines.push('================ TRANSCRIPT END ================');
  lines.push('');

  lines.push('================ REPAIR CANDIDATE START ================');
  lines.push(repairCandidate ? sanitizeSecrets(formatLargeField(repairCandidate, 'repair candidate')) : '(not available)');
  lines.push('================ REPAIR CANDIDATE END ================');
  lines.push('');

  lines.push('================ AI REPAIR RESULT START ================');
  lines.push(aiRepairResult ? sanitizeSecrets(formatLargeField(aiRepairResult, 'AI repair result')) : '(not available)');
  lines.push('================ AI REPAIR RESULT END ================');

  return lines.join('\n');
}
