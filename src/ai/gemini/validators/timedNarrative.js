const VALID_KINDS = new Set(['exact', 'estimated']);

function finiteSeconds(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function narrativeText(value) {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  return cleanText(
    value.text ||
    value.summary ||
    value.title ||
    value.fact ||
    value.insight ||
    value.rule ||
    value.warning ||
    value.point ||
    value.value ||
    value.claim ||
    value.response ||
    value.counterArgument ||
    value.counter ||
    value.definition ||
    value.name ||
    value.term ||
    value.explanation ||
    value.description ||
    '',
  );
}

export function normalizeTimedNarrativeItem(value) {
  const text = narrativeText(value);
  if (!text) return null;
  if (!value || typeof value !== 'object') return text;

  const exactSeconds = finiteSeconds(value.timestampSeconds);
  const estimatedStartSeconds = finiteSeconds(value.estimatedStartSeconds);
  if (exactSeconds == null && estimatedStartSeconds == null) return text;

  const estimatedEndSeconds = finiteSeconds(value.estimatedEndSeconds);
  const timestampKind = VALID_KINDS.has(value.timestampKind)
    ? value.timestampKind
    : estimatedStartSeconds != null
      ? 'estimated'
      : 'exact';
  const timestampSource = cleanText(value.timestampSource);
  const sourceQuote = cleanText(value.sourceQuote || value.sourceQuoteOrEvidence);
  const confidence = value.timestampConfidence;

  return {
    text,
    ...(exactSeconds != null ? { timestampSeconds: exactSeconds } : {}),
    ...(estimatedStartSeconds != null ? { estimatedStartSeconds } : {}),
    ...(estimatedEndSeconds != null && (estimatedStartSeconds == null || estimatedEndSeconds >= estimatedStartSeconds)
      ? { estimatedEndSeconds }
      : {}),
    timestampKind,
    ...(timestampSource ? { timestampSource } : {}),
    ...(typeof confidence === 'number' && Number.isFinite(confidence)
      ? { timestampConfidence: confidence }
      : cleanText(confidence)
        ? { timestampConfidence: cleanText(confidence) }
        : {}),
    ...(sourceQuote ? { sourceQuote } : {}),
  };
}

export function normalizeTimedNarrativeArray(values) {
  if (!Array.isArray(values)) return [];
  return values.map(normalizeTimedNarrativeItem).filter(Boolean);
}

export function narrativeIdentity(value) {
  return narrativeText(value).toLocaleLowerCase('he');
}

export function dedupeTimedNarratives(values, limit = Infinity) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = normalizeTimedNarrativeItem(value);
    const identity = narrativeIdentity(normalized);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}
