import { translateSentimentLabel } from '@/lib/sentimentDisplayI18n';

const VIDEO_SOURCE_HE = 'ניתוח הסרטון';

const DIRECTION_MAP = new Map([
  ['bullish', 'bullish'],
  ['positive', 'bullish'],
  ['up', 'bullish'],
  ['שורי', 'bullish'],
  ['חיובי', 'bullish'],
  ['bearish', 'bearish'],
  ['negative', 'bearish'],
  ['down', 'bearish'],
  ['דובי', 'bearish'],
  ['שלילי', 'bearish'],
  ['neutral', 'neutral'],
  ['mixed', 'neutral'],
  ['flat', 'neutral'],
  ['ניטרלי', 'neutral'],
  ['מעורב', 'neutral'],
]);

const FIELD_LABELS = {
  sentiment: 'סנטימנט שוק',
  marketSentiment: 'סנטימנט שוק',
  sentimentAnalysis: 'ניתוח סנטימנט',
  fearGreed: 'פחד וחמדנות',
  marketMood: 'מצב השוק',
};

const ITEM_SHAPE_KEYS = new Set([
  'label', 'name', 'type', 'category', 'direction', 'sentimentDirection', 'sentiment',
  'bias', 'value', 'score', 'reading', 'evidence', 'drivers', 'source', 'sourceName',
  'sourceUrl', 'date', 'asOf', 'scope', 'confidence', 'verificationState', 'verified',
  'externallyVerified', 'etf', 'etfTarget',
]);

function firstPresent(...values) {
  return values.find((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  });
}

function scalarValue(value) {
  return ['string', 'number', 'boolean'].includes(typeof value) ? value : undefined;
}

export function formatSentimentScalar(value) {
  if (value === true || value === 'true') return 'כן';
  if (value === false || value === 'false') return 'לא';
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function safeText(value, maxLength = 600) {
  const scalar = scalarValue(value);
  if (scalar === undefined) return '';
  const text = formatSentimentScalar(scalar).replace(/\s+/g, ' ').trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function safeExternalUrl(value) {
  const raw = safeText(value, 2000);
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.username || parsed.password) return '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/token|secret|password|auth|api.?key/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function safeTextList(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => safeText(item, 240)).filter(Boolean);
}

function normalizeDirection(value) {
  const explicit = safeText(value, 40).toLowerCase();
  return DIRECTION_MAP.get(explicit) || 'unverified';
}

export function getSentimentDirectionLabel(direction) {
  if (direction === 'bullish') return 'שורי';
  if (direction === 'bearish') return 'דובי';
  if (direction === 'neutral') return 'ניטרלי';
  return 'לא אומת';
}

export function getSentimentVerificationLabel(state) {
  if (state === 'external-verified') return 'אומת חיצונית';
  if (state === 'unverified') return 'לא אומת';
  return 'ניתוח הסרטון — לא אומת חיצונית';
}

function sourceParts(item) {
  const sourceObject = item?.source && typeof item.source === 'object' && !Array.isArray(item.source)
    ? item.source
    : null;
  const sourceScalar = scalarValue(item?.source);
  const sourceUrl = safeExternalUrl(firstPresent(
    item?.sourceUrl,
    item?.evidenceUrl,
    sourceObject?.url,
    typeof sourceScalar === 'string' && /^https?:\/\//i.test(sourceScalar) ? sourceScalar : undefined,
  ));
  let source = safeText(firstPresent(
    item?.sourceName,
    item?.provider,
    sourceObject?.name,
    sourceObject?.label,
    typeof sourceScalar === 'string' && !/^https?:\/\//i.test(sourceScalar) ? sourceScalar : undefined,
  ), 160);
  const sourceKind = safeText(firstPresent(item?.sourceType, item?.origin, sourceObject?.type), 60).toLowerCase();
  const isVideo = !source || /^(video|transcript|gem|ai|ניתוח הסרטון)$/i.test(source) || /video|transcript/.test(sourceKind);
  if (isVideo) source = VIDEO_SOURCE_HE;
  return { source, sourceUrl, isVideo };
}

function normalizeVerification(item, { source, sourceUrl, isVideo, evidence }) {
  const rawState = safeText(firstPresent(item?.verificationState, item?.verification, item?.sourceType), 80).toLowerCase();
  const verified = firstPresent(item?.externallyVerified, item?.externalEvidence, item?.verified);
  const claimsExternalVerification = verified === true
    || /external.*verified|verified.*external|אומת חיצונית/.test(rawState);
  const namedExternalSource = source && source !== VIDEO_SOURCE_HE;
  const actualExternalEvidence = Boolean(
    claimsExternalVerification
    && evidence
    && (sourceUrl || namedExternalSource)
  );
  if (actualExternalEvidence) return { verificationState: 'external-verified', verified: true };
  if (isVideo) return { verificationState: 'video-unverified', verified: false };
  return { verificationState: 'unverified', verified: false };
}

function normalizeEtfTarget(value) {
  const target = safeText(value, 16).toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(target) ? target : null;
}

function objectLooksLikeItem(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).some((key) => ITEM_SHAPE_KEYS.has(key));
}

function entriesFromValue(value, fallbackLabel) {
  if (Array.isArray(value)) return value.map((item) => ({ item, fallbackLabel }));
  if (objectLooksLikeItem(value)) return [{ item: value, fallbackLabel }];
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([label, item]) => ({
      item: objectLooksLikeItem(item) ? { label, ...item } : { label, value: item },
      fallbackLabel,
    }));
  }
  if (scalarValue(value) !== undefined) return [{ item: value, fallbackLabel }];
  return [];
}

export function normalizeSentimentEvidenceItem(input, index = 0, fallbackLabel = 'סנטימנט שוק') {
  if (scalarValue(input) !== undefined) {
    const evidence = safeText(input);
    if (!evidence) return null;
    return {
      label: fallbackLabel || `סנטימנט ${index + 1}`,
      direction: 'unverified',
      value: input,
      source: VIDEO_SOURCE_HE,
      sourceUrl: '',
      date: '',
      scope: '',
      evidence,
      drivers: [],
      confidence: null,
      verificationState: 'video-unverified',
      verified: false,
      etfTarget: null,
    };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const label = safeText(firstPresent(input.label, input.name, input.type, input.category), 160)
    || fallbackLabel
    || `סנטימנט ${index + 1}`;
  const value = scalarValue(firstPresent(input.value, input.score, input.reading, input.indexValue));
  const evidence = safeText(firstPresent(
    input.evidence,
    input.details,
    input.description,
    input.summary,
    input.note,
    input.notes,
    input.text,
    input.content,
    value,
  ));
  const explicitDirection = firstPresent(
    input.direction,
    input.sentimentDirection,
    input.sentiment,
    input.bias,
  );
  const sourceData = sourceParts(input);
  const verification = normalizeVerification(input, { ...sourceData, evidence });
  const drivers = safeTextList(firstPresent(
    input.drivers,
    input.driver,
    input.reasons,
    input.reason,
    input.factors,
  ));

  return {
    label,
    direction: normalizeDirection(explicitDirection),
    value: value ?? null,
    source: sourceData.source,
    sourceUrl: sourceData.sourceUrl,
    date: safeText(firstPresent(input.date, input.asOf, input.observedAt, input.timestamp), 120),
    scope: safeText(firstPresent(input.scope, input.market, input.asset, input.segment), 160),
    evidence,
    drivers,
    confidence: scalarValue(firstPresent(input.confidence, input.confidenceScore)) ?? null,
    ...verification,
    etfTarget: normalizeEtfTarget(firstPresent(input.etfTarget, input.etf)),
  };
}

function sentimentIdentity(item) {
  return [
    item.label,
    item.direction,
    formatSentimentScalar(item.value),
    item.source,
    item.date,
    item.scope,
    item.evidence,
    item.drivers.join('|'),
  ].map((value) => String(value || '').trim().toLowerCase()).join('\u0000');
}

/** Canonical Sentiment selector used by renderer, export, counts and AI Mapping. */
export function selectSentimentEvidenceItems(src) {
  if (!src || typeof src !== 'object') return [];
  const entries = [];
  for (const field of ['sentiment', 'marketSentiment', 'sentimentAnalysis', 'fearGreed', 'marketMood']) {
    entries.push(...entriesFromValue(src[field], FIELD_LABELS[field]));
  }
  const seen = new Set();
  const items = [];
  entries.forEach(({ item, fallbackLabel }, index) => {
    const normalized = normalizeSentimentEvidenceItem(item, index, fallbackLabel);
    if (!normalized) return;
    const identity = sentimentIdentity(normalized);
    if (seen.has(identity)) return;
    seen.add(identity);
    items.push(normalized);
  });
  return items;
}

export function formatSentimentEvidenceText(item) {
  if (!item) return '';
  const parts = [
    translateSentimentLabel(item.label),
    `כיוון: ${getSentimentDirectionLabel(item.direction)}`,
    formatSentimentScalar(item.value) ? `ערך: ${formatSentimentScalar(item.value)}` : '',
    `מקור: ${item.source || VIDEO_SOURCE_HE}`,
    item.sourceUrl ? `קישור מקור: ${item.sourceUrl}` : '',
    item.date ? `תאריך: ${item.date}` : '',
    item.scope ? `היקף: ${item.scope}` : '',
    item.evidence ? `ראיות: ${item.evidence}` : '',
    item.drivers.length ? `מניעים: ${item.drivers.join(', ')}` : '',
    formatSentimentScalar(item.confidence) ? `ביטחון: ${formatSentimentScalar(item.confidence)}` : '',
    `מצב אימות: ${getSentimentVerificationLabel(item.verificationState)}`,
    item.etfTarget ? `ETF מפורש: ${item.etfTarget}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}
