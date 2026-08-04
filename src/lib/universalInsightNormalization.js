const PRIMARY_TEXT_KEYS = [
  'insight', 'lesson', 'text', 'point', 'content', 'summary', 'title',
  'name', 'rule', 'description', 'note', 'fact', 'definition', 'setup', 'pattern',
];

const MEANING_KEYS = [
  'meaning', 'whyImportant', 'reason', 'significance', 'explanation', 'implication',
];

const ACTION_KEYS = [
  'action', 'possibleAction', 'actionable', 'suggestedAction', 'nextStep',
  'recommendedAction', 'application',
];

const SAFE_SCALAR_KEYS = [
  'id', 'title', 'text', 'type', 'category', 'kind', 'insightType',
  'evidence', 'source', 'sourceName', 'sourceUrl', 'date', 'scope', 'drivers',
  'confidence', 'verificationState', 'verified', 'externallyVerified',
  'applicableToApp', 'manual', 'isManual', 'userEdited',
  'asset', 'ticker',
  'startSeconds', 'endSeconds', 'timestampSource', 'timestampConfidence',
  'timestampBasis', 'timingScope',
];

function scalarValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return undefined;
}

function firstScalar(item, keys) {
  for (const key of keys) {
    const value = scalarValue(item?.[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Presentation-only normalization for structured Insight / Useful Knowledge rows.
 * It keeps verified timing and safe manual metadata while preventing arbitrary raw
 * provider fields from reaching renderer, export or diagnostics paths.
 */
export function normalizeUniversalInsightItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;

  const insightValue = firstScalar(item, PRIMARY_TEXT_KEYS);
  if (insightValue === undefined) return null;

  const normalized = {};
  for (const key of SAFE_SCALAR_KEYS) {
    const value = scalarValue(item[key]);
    if (value !== undefined) normalized[key] = value;
  }

  normalized.insight = String(insightValue);

  const meaning = firstScalar(item, MEANING_KEYS);
  if (meaning !== undefined) normalized.meaning = String(meaning);

  const action = firstScalar(item, ACTION_KEYS);
  if (action !== undefined) normalized.action = String(action);

  return normalized;
}
