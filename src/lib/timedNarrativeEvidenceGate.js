/**
 * Server-side evidence gate for static narrative timestamps.
 *
 * Verifies that a model-claimed `sourceQuote` appears literally inside the
 * exact timestamped transcript text the model was shown, and that the
 * claimed `estimatedStartSeconds` falls inside the transcript window that
 * contains the quote. Runs once, server-side, after the model response is
 * parsed and before normalization/storage — never during React render.
 *
 * Must stay in sync with the inlined copy in
 * backend/analyze-video.function.js (that file is deployed standalone by
 * Base44 and cannot import project modules). See
 * scripts/timed-narrative-evidence-gate-qa.mjs for the parity test between
 * the two copies.
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

export const TIMED_NARRATIVE_ARRAY_FIELDS = [
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

/** Parses the literal `[seconds] text` lines the model was shown back into segments. */
export function parseTimedTranscriptSegments(transcriptText) {
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

/**
 * Literal (non-fuzzy) substring search for `quote` across increasing
 * consecutive-segment windows. Returns the transcript-covered interval
 * containing the match, using the next segment's start as the end bound
 * (or the window's own start when it is the final segment — never invents
 * a padding value).
 */
export function locateLiteralQuoteWindow(segments, quote, { maxWindow = DEFAULT_MAX_QUOTE_WINDOW } = {}) {
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

/**
 * Pure verification: does `item` have a defensible time claim, and if so,
 * is it backed by a literal quote inside a matching transcript window?
 */
export function verifyTimedNarrativeEvidence(item, segments) {
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

/**
 * Strips only the time-claim fields when evidence fails to verify. The
 * item's own content (text and every other field) is always preserved.
 */
export function applyTimedNarrativeEvidenceGate(item, segments) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;

  const evidence = verifyTimedNarrativeEvidence(item, segments);
  if (!evidence.hasClaim || evidence.verified) return item;

  const stripped = { ...item };
  for (const field of TIME_CLAIM_FIELDS) delete stripped[field];
  return stripped;
}

export function applyTimedNarrativeEvidenceGateToArray(items, segments) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => applyTimedNarrativeEvidenceGate(item, segments));
}

/**
 * Gates every known timed-narrative array field on a raw (still-parsed,
 * pre-normalization) model analysis object. Fields not present, or not
 * arrays, are left untouched. `chapters` is intentionally never included —
 * the committed chapter mechanism is a separate, unrelated pipeline.
 */
export function applyTimedNarrativeEvidenceGateToAnalysis(analysis, segments, fieldNames = TIMED_NARRATIVE_ARRAY_FIELDS) {
  if (!analysis || typeof analysis !== 'object') return analysis;
  const gated = { ...analysis };
  for (const field of fieldNames) {
    if (Array.isArray(gated[field])) {
      gated[field] = applyTimedNarrativeEvidenceGateToArray(gated[field], segments);
    }
  }
  return gated;
}

/**
 * Reports how much of the genuine transcript the model actually saw, so a
 * transcript that ever exceeds the caller's input-size limit is honestly
 * flagged as partial rather than silently treated as full-video coverage.
 */
export function computeTranscriptCoverage(fullSegments, analyzedSegments, fullCharCount, analyzedCharCount) {
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
