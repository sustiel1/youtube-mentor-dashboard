export const SENTIMENT_DESTINATIONS = Object.freeze([
  { key: 'fear-greed', scope: 'broad-market', labelHe: 'פחד ותאווה', url: 'https://www.cnn.com/markets/fear-and-greed', provider: 'CNN', measurementType: 'מדד סנטימנט משולב', cadence: 'מתעדכן במהלך יום המסחר' },
  { key: 'retail-investors', scope: 'retail-investors', labelHe: 'משקיעים פרטיים', url: 'https://www.aaii.com/sentimentsurvey', provider: 'AAII', measurementType: 'סקר שבועי', cadence: 'שבועי' },
  { key: 'active-managers', scope: 'active-managers', labelHe: 'מנהלי השקעות', url: 'https://www.naaim.org/programs/naaim-exposure-index/', provider: 'NAAIM', measurementType: 'חשיפה ומיצוב', cadence: 'שבועי' },
  { key: 'put-call', scope: 'options-positioning', labelHe: 'Put/Call', url: 'https://www.cboe.com/us/options/market_statistics/daily/', provider: 'Cboe', measurementType: 'פעילות אופציות', cadence: 'יומי' },
  { key: 'vix', scope: 'volatility', labelHe: 'VIX', url: 'https://www.cboe.com/tradable_products/vix/', provider: 'Cboe', measurementType: 'ציפיות לתנודתיות', cadence: 'במהלך יום המסחר' },
  { key: 'sector-map', scope: 'sector', labelHe: 'מפת סקטורים', url: 'https://finviz.com/groups.ashx', provider: 'Finviz', measurementType: 'ביצועי סקטורים', cadence: 'במהלך יום המסחר' },
  { key: 'market-map', scope: 'broad-market-map', labelHe: 'מפת השוק', url: 'https://finviz.com/map.ashx', provider: 'Finviz', measurementType: 'מפת חום שוק', cadence: 'במהלך יום המסחר' },
]);

const SCOPE_LABELS = Object.freeze({
  'broad-market': 'שוק רחב', macro: 'מאקרו', sector: 'סקטור', stock: 'מניה',
  volatility: 'תנודתיות', 'options-positioning': 'מיצוב אופציות',
  'retail-investors': 'משקיעים פרטיים', 'active-managers': 'מנהלי השקעות',
});

const SENTIMENT_HE = Object.freeze({ bullish: 'שורי', bearish: 'דובי', neutral: 'ניטרלי', mixed: 'מעורב' });

const present = (value) => value !== null && value !== undefined && value !== '';

export function normalizeSentimentCode(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (/bullish|positive|חיובי|שורי/.test(text)) return 'bullish';
  if (/bearish|negative|שלילי|דובי/.test(text)) return 'bearish';
  if (/mixed|מעורב/.test(text)) return 'mixed';
  if (/neutral|ניטרלי/.test(text)) return 'neutral';
  return '';
}

export function inferSentimentScope(label, explicitScope = '') {
  if (SCOPE_LABELS[explicitScope]) return explicitScope;
  const text = String(label || '').toLowerCase();
  if (/סקטור|sector/.test(text)) return 'sector';
  if (/מאקרו|macro/.test(text)) return 'macro';
  if (/vix|תנודת/.test(text)) return 'volatility';
  if (/put.?call|אופצי/.test(text)) return 'options-positioning';
  if (/קמעונ|retail|aaii/.test(text)) return 'retail-investors';
  if (/מוסדי|manager|naaim/.test(text)) return 'active-managers';
  if (/מניה|stock/.test(text)) return 'stock';
  if (/שוק|כללי|overall|broad/.test(text)) return 'broad-market';
  return '';
}

export function getSentimentDestination(row) {
  const scope = row?.scope || '';
  if (!scope) return null;
  return SENTIMENT_DESTINATIONS.find((entry) => entry.scope === scope) || null;
}

export function getSentimentScopeLabel(scope) {
  return SCOPE_LABELS[scope] || 'לא מסווג';
}

export function getSentimentLabelHe(sentiment) {
  return SENTIMENT_HE[sentiment] || '—';
}

export function getVerifiedExplicitEtfUrl(destination, explicitEtf) {
  const etf = String(explicitEtf || '').trim().toUpperCase();
  if (!etf || !destination || typeof destination !== 'object') return '';
  return destination.representativeEtf === etf && typeof destination.etfUrl === 'string'
    ? destination.etfUrl
    : '';
}

export function normalizeSentimentEvidenceItem(item, fallbackLabel = 'סנטימנט שוק') {
  if (typeof item === 'string') {
    const text = item.trim();
    if (!text) return null;
    return { label: fallbackLabel, scope: inferSentimentScope(fallbackLabel), subject: '', value: null, unit: '', sentiment: normalizeSentimentCode(text), reason: text, drivers: [], evidence: [], timeframe: '', asOf: '', sourceName: '', sourceType: 'video-claim', sourceUrl: '', confidence: null, verificationStatus: 'unverified' };
  }
  if (!item || typeof item !== 'object') return null;
  const label = String(item.label || item.name || item.type || item.category || fallbackLabel).trim();
  const scope = inferSentimentScope(label, item.scope);
  const derivedSectorSubject = scope === 'sector'
    ? label.replace(/סנטימנט|sector|סקטור/gi, '').trim()
    : '';
  const explicitSentiment = item.sentiment ?? item.direction ?? item.bias ?? item.status ?? item.mood;
  const legacyValue = item.value ?? item.text ?? item.description ?? item.summary ?? null;
  const sentiment = normalizeSentimentCode(explicitSentiment) || normalizeSentimentCode(legacyValue);
  const reason = String(item.reason || item.note || item.notes || item.comment || '').trim();
  const sourceType = ['video-claim', 'official', 'provider'].includes(item.sourceType) ? item.sourceType : 'video-claim';
  const verificationStatus = ['verified', 'unverified', 'conflicting'].includes(item.verificationStatus)
    ? item.verificationStatus
    : (sourceType === 'video-claim' || (!item.sourceName && !item.sourceUrl) ? 'unverified' : 'verified');
  return {
    label, scope, subject: String(item.subject || item.sector || item.ticker || derivedSectorSubject).trim(),
    value: present(item.value) && typeof item.value !== 'string' ? item.value : null,
    unit: String(item.unit || '').trim(), sentiment, reason: reason || (sentiment ? '' : String(legacyValue || '').trim()),
    drivers: Array.isArray(item.drivers) ? item.drivers.filter(Boolean) : [],
    evidence: Array.isArray(item.evidence) ? item.evidence.filter(Boolean) : [],
    timeframe: String(item.timeframe || '').trim(), asOf: String(item.asOf || '').trim(),
    sourceName: String(item.sourceName || '').trim(), sourceType, sourceUrl: String(item.sourceUrl || '').trim(),
    confidence: item.confidence ?? null, verificationStatus,
    etf: String(item.etf || '').trim(), rawValue: legacyValue,
  };
}

export function formatSentimentEvidenceText(row) {
  return [row.label, getSentimentLabelHe(row.sentiment), row.reason, ...row.drivers, ...row.evidence].filter(Boolean).join(' · ');
}
