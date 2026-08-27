/**
 * Base44 Backend Function: AnalyzeVideo
 *
 * Env:
 * - ANTHROPIC_API_KEY or VITE_ANTHROPIC_API_KEY
 * - Optional: ANTHROPIC_MODEL
 */

// A single request safely covers any realistic video: at this pilot's
// measured density (~12.3 chars/sec of transcript) 200k chars covers roughly
// 4.5 hours, and Claude's context window has ample headroom left over for
// output — see docs/session-closures for the audit that established this.
// Output size is bounded by the fixed per-field item caps in buildPrompt(),
// not by transcript length, so raising this does not require raising
// CLAUDE_MAX_TOKENS.
const TRANSCRIPT_CHAR_LIMIT = 200_000;
const CLAUDE_MAX_TOKENS = 6_000;
const CLAUDE_SYSTEM_PROMPT = [
  'Return ONLY valid JSON.',
  'Do not wrap the output in Markdown code fences.',
  'Your entire response must be a single JSON object that starts with "{" and ends with "}".',
].join('\n');

/**
 * Server-side evidence gate for static narrative timestamps.
 *
 * This backend function is deployed by Base44 as a standalone file with no
 * bundler and no access to the rest of the repo, so it cannot import
 * src/lib/timedNarrativeEvidenceGate.js. This copy must stay behaviorally
 * identical to that module — see scripts/timed-narrative-evidence-gate-qa.mjs,
 * which runs the same fixtures through both and asserts identical output.
 */
const TIMED_LINE_RE = /^\[(\d+(?:\.\d+)?)\]\s?(.*)$/;
const DEFAULT_MAX_QUOTE_WINDOW = 10;
const TIME_CLAIM_FIELDS = [
  'estimatedStartSeconds',
  'estimatedEndSeconds',
  'timestampKind',
  'timestampSource',
  'timestampConfidence',
  'sourceQuote',
];
const TIMED_NARRATIVE_ARRAY_FIELDS = [
  'keyPoints', 'keyInsights', 'rules', 'actionItems', 'mistakesToAvoid',
  'usefulKnowledge', 'tradingSetups', 'tradingRules', 'riskRules', 'warnings',
  'arguments', 'weakPoints', 'counterArguments', 'socialMediaReplies',
  'debateResponses', 'allPoints', 'knowledgePoints', 'insights',
  'keyTakeaways', 'actionableIdeas',
];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isFiniteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
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

  // Strict on purpose: a stringified number is a malformed claim, not a
  // valid one to be coerced — the model's schema always emits a JSON number.
  const time = item.estimatedStartSeconds;
  if (!quote || !isFiniteNonNegative(time)) {
    return { hasClaim: true, verified: false, reason: 'incomplete-claim' };
  }

  const window = locateLiteralQuoteWindow(segments, quote);
  if (!window) return { hasClaim: true, verified: false, reason: 'quote-not-found' };

  const withinWindow = time >= window.intervalStart && time <= window.intervalEnd;
  if (!withinWindow) return { hasClaim: true, verified: false, reason: 'time-outside-window', window };

  return { hasClaim: true, verified: true, window };
}

function applyTimedNarrativeEvidenceGate(item, segments) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;

  const evidence = verifyTimedNarrativeEvidence(item, segments);
  if (!evidence.hasClaim || evidence.verified) return item;

  const stripped = { ...item };
  for (const field of TIME_CLAIM_FIELDS) delete stripped[field];
  return stripped;
}

function applyTimedNarrativeEvidenceGateToArray(items, segments) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => applyTimedNarrativeEvidenceGate(item, segments));
}

/**
 * Reports how much of the genuine transcript the model actually saw, so a
 * transcript that ever exceeds TRANSCRIPT_CHAR_LIMIT is honestly flagged as
 * partial rather than silently treated as a full-video analysis.
 */
function computeTranscriptCoverage(fullSegments, analyzedSegments, fullCharCount, analyzedCharCount) {
  const totalSegments = Array.isArray(fullSegments) ? fullSegments.length : 0;
  const analyzedSegmentCount = Array.isArray(analyzedSegments) ? analyzedSegments.length : 0;
  const skippedSegments = Math.max(0, totalSegments - analyzedSegmentCount);
  const coveragePercent = totalSegments > 0
    ? Math.round((analyzedSegmentCount / totalSegments) * 1000) / 10
    : 0;
  return {
    totalChars: fullCharCount,
    analyzedChars: analyzedCharCount,
    totalSegments,
    analyzedSegments: analyzedSegmentCount,
    skippedSegments,
    chunkCount: 1,
    transcriptStartSeconds: totalSegments > 0 ? fullSegments[0].startSeconds : null,
    transcriptEndSeconds: totalSegments > 0 ? fullSegments[totalSegments - 1].startSeconds : null,
    analyzedStartSeconds: analyzedSegmentCount > 0 ? analyzedSegments[0].startSeconds : null,
    analyzedEndSeconds: analyzedSegmentCount > 0 ? analyzedSegments[analyzedSegmentCount - 1].startSeconds : null,
    coveragePercent,
    status: skippedSegments === 0 && totalSegments > 0 ? 'full' : (totalSegments === 0 ? 'unknown' : 'partial'),
  };
}

function applyTimedNarrativeEvidenceGateToAnalysis(analysis, segments, fieldNames = TIMED_NARRATIVE_ARRAY_FIELDS) {
  if (!analysis || typeof analysis !== 'object') return analysis;
  const gated = { ...analysis };
  for (const field of fieldNames) {
    if (Array.isArray(gated[field])) {
      gated[field] = applyTimedNarrativeEvidenceGateToArray(gated[field], segments);
    }
  }
  return gated;
}

function buildPrompt({ title, transcript, durationSeconds, mentor, category, chaptersTarget }) {
  // Row timestamps (estimatedStartSeconds/sourceQuote/etc.) are intentionally
  // NOT requested here. Normal analysis must never auto-generate them — that
  // is now a separate, explicit, per-video opt-in operation
  // (backend/generate-row-timestamps.function.js). See WORK-ID
  // YMD-ONDEMAND-ROW-TIMES.
  const narrativeItem = { text: '...' };
  return [
    'נתח את התמלול הבא בלבד והחזר JSON בלבד, בלי markdown ובלי טקסט נוסף.',
    'שמור על תשובה קצרה ויציבה. אל תחזיר brainSummary, markdown, או שדות ארוכים שלא נתבקשו.',
    'החזר רק את השדות הבאים ובאותו סדר.',
    'shortSummary: 2-3 משפטים.',
    'fullSummary: 4-6 משפטים.',
    'keyPoints: עד 5 פריטים במבנה האובייקט שבסכמה.',
    `chapters: בערך ${chaptersTarget} פרקים שמכסים את כל הסרטון.`,
    'mainLesson: משפט קצר אחד.',
    'keyInsights: עד 4 פריטים במבנה האובייקט שבסכמה.',
    'rules: עד 4 פריטים במבנה האובייקט שבסכמה.',
    'actionItems: עד 4 פריטים במבנה האובייקט שבסכמה.',
    'mistakesToAvoid: עד 4 פריטים במבנה האובייקט שבסכמה.',
    'strategyOrMethod: משפט קצר אחד או מחרוזת ריקה.',
    'tags: עד 4 תגיות.',
    'אם אין מספיק חומר לשדה מסוים, החזר מערך ריק או מחרוזת ריקה.',
    'כל כותרת פרק חייבת להיות ספציפית ולא גנרית.',
    '',
    `כותרת: ${title}`,
    mentor ? `מנטור: ${mentor}` : null,
    category ? `קטגוריה: ${category}` : null,
    Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0
      ? `משך סרטון בשניות: ${Math.floor(Number(durationSeconds))}`
      : null,
    '',
    'החזר רק JSON בפורמט הבא:',
    JSON.stringify({
      shortSummary: '...',
      fullSummary: '...',
      keyPoints: [narrativeItem],
      chapters: [
        {
          title: '...',
          startSeconds: 0,
          endSeconds: 120,
          summary: '...',
          keyPoints: ['...'],
        },
      ],
      mainLesson: '...',
      keyInsights: [narrativeItem],
      rules: [narrativeItem],
      actionItems: [narrativeItem],
      mistakesToAvoid: [narrativeItem],
      strategyOrMethod: '...',
      tags: ['...'],
    }, null, 2),
    '',
    'אל תחזיר שום שדה נוסף.',
    'Transcript:',
    String(transcript || '').trim(),
  ].filter(Boolean).join('\n');
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

/**
 * Narrow, context-anchored repair for a bare quote embedded mid-word/
 * mid-sentence (Hebrew abbreviations like עו"ד, or an un-escaped
 * quotation mark Claude left inside a sentence). Requires a Hebrew
 * letter/point or ASCII word character on BOTH sides of the quote, so it
 * never touches: real JSON string boundaries (always adjacent to
 * structural syntax on at least one side), real Hebrew punctuation
 * (גרשיים ״ is a different Unicode codepoint from ASCII "), or already-
 * escaped quotes (the preceding `\` fails the word/Hebrew-char check).
 *
 * Deliberately does NOT replicate vite.config.js#sanitizeJsonGershayim's
 * second pass (iterative, position-based blind quote-escaping) — that
 * heuristic can't distinguish "this quote is the defect" from "a different,
 * earlier defect made the error position land here by coincidence," so at
 * most one narrow repair is ever attempted here before failing closed.
 *
 * Must stay behaviorally identical to repairUnescapedMidWordQuotes in
 * src/lib/claudeJsonRepair.js — see scripts/claude-json-repair-qa.mjs for
 * the parity test between the two copies.
 */
function repairUnescapedMidWordQuotes(text) {
  return String(text || '').replace(/([ְ-׿\w])"([ְ-׿\w])/g, '$1\\"$2');
}

function parseClaudeJson(rawText) {
  const text = String(rawText || '').trim();
  const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    const repaired = repairUnescapedMidWordQuotes(cleaned);
    if (repaired === cleaned) {
      const wrapped = new Error('Claude returned invalid JSON. Try Gemini or reduce transcript length.');
      wrapped.code = 'CLAUDE_INVALID_JSON';
      wrapped.status = 502;
      wrapped.diagnostics = extractJsonParseDiagnostics(cleaned, firstError);
      throw wrapped;
    }
    try {
      const parsed = JSON.parse(repaired);
      console.log('[Claude] JSON repaired: unescaped mid-word quote(s) fixed before parsing');
      return parsed;
    } catch (secondError) {
      const wrapped = new Error('Claude returned invalid JSON. Try Gemini or reduce transcript length.');
      wrapped.code = 'CLAUDE_INVALID_JSON';
      wrapped.status = 502;
      wrapped.diagnostics = extractJsonParseDiagnostics(repaired, secondError);
      throw wrapped;
    }
  }
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
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
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

async function handler(
  {
    videoId,
    transcript = '',
    title = '',
    durationSeconds = 0,
    mentor = null,
    category = null,
  },
  { entities }
) {
  const videos = await entities.Video.filter({ _id: videoId });
  const video = videos[0];
  if (!video) throw new Error(`Video not found: ${videoId}`);

  const rawTranscriptText = String(transcript || video.transcript || '').trim();
  const transcriptText = rawTranscriptText.slice(0, TRANSCRIPT_CHAR_LIMIT);
  if (!transcriptText) {
    console.error('[Claude] transcript missing', {
      videoId,
      responseLength: 0,
      repairAttempted: false,
      transcriptUsed: false,
      chapterSource: 'description_only',
    });
    const error = new Error('Transcript required');
    error.code = 'TRANSCRIPT_REQUIRED';
    throw error;
  }

  const prompt = buildPrompt({
    title: title || video.title || '',
    transcript: transcriptText,
    durationSeconds,
    mentor,
    category,
    chaptersTarget: durationSeconds > 0 ? (durationSeconds <= 14 * 60 ? 5 : durationSeconds <= 22 * 60 ? 7 : 8) : 6,
  });

  const selectedModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  console.log('[Claude] request started', {
    videoId,
    model: selectedModel,
    transcriptChars: transcriptText.length,
    promptChars: prompt.length,
    transcriptUsed: true,
    chapterSource: 'transcript',
  });

  const result = await callClaude({
    model: selectedModel,
    max_tokens: CLAUDE_MAX_TOKENS,
    temperature: 0.1,
    system: CLAUDE_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: prompt },
    ],
  });

  const text = Array.isArray(result?.content)
    ? result.content.filter((item) => item?.type === 'text').map((item) => item.text || '').join('\n')
    : '';

  console.log('[Claude] response received', {
    videoId,
    responseLength: text.length,
    repairAttempted: false,
    transcriptUsed: true,
    chapterSource: 'transcript',
  });

  const parsed = parseClaudeJson(text);
  // Row timestamps are no longer requested in this prompt (see buildPrompt),
  // but the gate is still applied here — fail-closed, with an EMPTY segment
  // list — as defense in depth: it guarantees zero estimatedStartSeconds/
  // sourceQuote fields can ever survive the normal, automatic analysis path,
  // even if a model ignores the instruction and emits one anyway.
  // Row timestamps are only ever produced by the separate, explicit,
  // per-video opt-in operation (generate-row-timestamps.function.js).
  const analysis = applyTimedNarrativeEvidenceGateToAnalysis(parsed, []);
  const fullSegments = parseTimedTranscriptSegments(rawTranscriptText);
  const analysisSegments = parseTimedTranscriptSegments(transcriptText);
  const staticTimeCoverage = computeTranscriptCoverage(
    fullSegments,
    analysisSegments,
    rawTranscriptText.length,
    transcriptText.length
  );
  console.log('[Claude] transcript coverage', { videoId, ...staticTimeCoverage });

  await entities.Video.update(videoId, {
    shortSummary: analysis.shortSummary || null,
    fullSummary: analysis.fullSummary || null,
    tags: Array.isArray(analysis.tags) ? analysis.tags : [],
    status: 'done',
  });

  return {
    ...analysis,
    provider: 'claude',
    model: selectedModel,
    isFallback: false,
    staticTimeCoverage,
  };
}

module.exports = {
  handler,
  // Exported only for the parity test (scripts/timed-narrative-evidence-gate-qa.mjs),
  // which asserts this stays behaviorally identical to src/lib/timedNarrativeEvidenceGate.js.
  parseTimedTranscriptSegments,
  applyTimedNarrativeEvidenceGateToAnalysis,
  computeTranscriptCoverage,
  TRANSCRIPT_CHAR_LIMIT,
  // Exported only so isolated audit/pilot tooling can reconstruct and
  // inspect the exact outbound request before/after the one real network
  // call, without duplicating or diverging from what handler() actually
  // does internally.
  buildPrompt,
  callClaude,
  parseClaudeJson,
  // Exported only for the parity test (scripts/claude-json-repair-qa.mjs),
  // which asserts this stays behaviorally identical to
  // src/lib/claudeJsonRepair.js#repairUnescapedMidWordQuotes.
  repairUnescapedMidWordQuotes,
  CLAUDE_MAX_TOKENS,
  CLAUDE_SYSTEM_PROMPT,
};
