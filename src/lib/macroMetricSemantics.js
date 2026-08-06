const REFERENCE_LABELS_HE = Object.freeze({
  'policy-target': 'יעד מדיניות',
  'market-consensus': 'צפי שוק',
  'previous-reading': 'נתון קודם',
  'technical-level': 'רמת ייחוס',
  none: '',
});

const VALID_TRENDS = new Set(['up', 'down', 'unchanged', 'unknown']);
const present = (value) => value !== null && value !== undefined && value !== '';

function displayValue(value, unit = '') {
  if (!present(value)) return '';
  const text = String(value).trim();
  if (!text || !unit || text.includes(unit)) return text;
  return `${text}${unit === '%' ? '%' : ` ${unit}`}`;
}

function numericValue(value) {
  if (!present(value)) return null;
  const match = String(value).replace(/,/g, '').match(/[+-]?\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : NaN;
  return Number.isFinite(number) ? number : null;
}

function compatible(left, right) {
  const a = String(left ?? '').trim().toLowerCase();
  const b = String(right ?? '').trim().toLowerCase();
  return !a || !b || a === b;
}

function formatGap(value, unit) {
  const rounded = Math.round(value * 1000) / 1000;
  const prefix = rounded > 0 ? '+' : '';
  return unit === '%' ? `${prefix}${rounded} נק׳ אחוז` : `${prefix}${rounded}${unit ? ` ${unit}` : ''}`;
}

export function getMacroReferenceTypeLabel(referenceType) {
  return REFERENCE_LABELS_HE[referenceType] || 'רמת ייחוס';
}

export function resolveMacroMetricSemantics(row = {}) {
  const legacyValueHasMeasuredContext = Boolean(
    row.metricType || row.period || row.asOf || row.sourceName || row.sourceUrl,
  );
  const hasManualActualOverride = Array.isArray(row.manualOverrideFields)
    && row.manualOverrideFields.includes('actualValue');
  const actualValue = hasManualActualOverride
    ? row.actualValue
    : present(row.actualValue)
      ? row.actualValue
      : (legacyValueHasMeasuredContext ? row.value : null);
  const referenceType = REFERENCE_LABELS_HE[row.referenceType] !== undefined
    ? row.referenceType
    : (present(row.targetValue) ? 'policy-target' : present(row.referenceValue) ? 'technical-level' : 'none');
  const referenceValue = present(row.targetValue) ? row.targetValue : row.referenceValue;
  const compatibleEvidence = compatible(row.actualPeriod || row.period, row.referencePeriod || row.period)
    && compatible(row.actualUnit || row.unit, row.referenceUnit || row.unit)
    && compatible(row.actualMetricType || row.metricType, row.referenceMetricType || row.metricType);
  const actualNumber = numericValue(actualValue);
  const referenceNumber = numericValue(referenceValue);
  const calculatedGap = compatibleEvidence && actualNumber !== null && referenceNumber !== null
    ? actualNumber - referenceNumber
    : null;
  const sourceUnverified = row.verificationStatus === 'conflicting'
    || row.verificationStatus === 'unverified'
    || row.sourceType === 'video-claim'
    || (!row.sourceName && !row.sourceUrl)
    || (!row.period && !row.asOf)
    || (!row.metricType && !row.actualMetricType);

  return {
    ...row,
    actualDisplay: displayValue(actualValue, row.actualUnit || row.unit),
    periodDisplay: row.period || row.asOf || '',
    referenceType,
    referenceLabel: getMacroReferenceTypeLabel(referenceType),
    referenceDisplay: displayValue(referenceValue, row.referenceUnit || row.unit),
    gapDisplay: compatibleEvidence && present(actualValue) && present(referenceValue) && present(row.gapValue)
      ? displayValue(row.gapValue, row.gapUnit || row.unit)
      : (calculatedGap === null ? '' : formatGap(calculatedGap, row.unit)),
    trend: VALID_TRENDS.has(row.trend) ? row.trend : 'unknown',
    meaning: [row.description, row.marketMeaning, row.impact].filter(Boolean).join(' · '),
    sourceUnverified,
    sourceWarning: sourceUnverified ? 'נתון מהסרטון · מקור או תקופה לא אומתו' : '',
  };
}
