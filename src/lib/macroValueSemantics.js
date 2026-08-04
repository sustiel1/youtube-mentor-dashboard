import { sanitizeMacroSourceUrl } from '@/lib/macroIndicatorLinks';

const ARRAY_FIELDS = [
  'macroFactors', 'macro', 'macroEvents', 'macroHighlights',
  'macroContext', 'economicContext', 'economicEvents', 'macroConditions',
];

const OBJECT_FIELDS = [
  'macroOverview', 'fedPolicy', 'interestRates', 'inflation', 'bondYields',
  'dollar', 'oilEnergy', 'liquidity', 'laborMarket', 'growthRecession',
];

const SENSITIVE_KEYS = /(transcript|rawProvider|providerPayload|rawResponse|secret|token|password|api.?key)/i;

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function isPresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return isScalar(value);
}

function firstPresent(...values) {
  return values.find(isPresent);
}

function safeScalar(value) {
  if (!isScalar(value)) return undefined;
  if (typeof value === 'number' && !Number.isFinite(value)) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.replace(/\s+/g, ' ').trim();
    return trimmed || undefined;
  }
  return value;
}

function safeText(value, maxLength = 800) {
  const scalar = safeScalar(value);
  if (scalar === undefined) return '';
  const text = scalar === true ? 'כן' : scalar === false ? 'לא' : String(scalar);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function formatMacroScalar(value) {
  if (value === true || value === 'true') return 'כן';
  if (value === false || value === 'false') return 'לא';
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseExplicitLine(row, line) {
  const specs = [
    [/^(?:בפועל|actual)\s*:\s*(.+)$/i, 'actualValue'],
    [/^(?:נוכחי|current)\s*:\s*(.+)$/i, 'currentValue'],
    [/^(?:יעד|target)\s*:\s*(.+)$/i, 'targetValue'],
    [/^(?:ייחוס|reference)\s*:\s*(.+)$/i, 'referenceValue'],
    [/^(?:תחזית|forecast)\s*:\s*(.+)$/i, 'forecastValue'],
    [/^(?:קודם|previous)\s*:\s*(.+)$/i, 'previousValue'],
    [/^(?:שינוי|change)\s*:\s*(.+)$/i, 'change'],
    [/^(?:תקופה|period)\s*:\s*(.+)$/i, 'period'],
    [/^(?:פער מהיעד|gap to target)\s*:\s*(.+)$/i, 'gapToTarget'],
    [/^(?:משמעות|meaning)\s*:\s*(.+)$/i, 'meaning'],
    [/^(?:השפעה|impact)\s*:\s*(.+)$/i, 'impact'],
  ];
  for (const [pattern, field] of specs) {
    const match = line.match(pattern);
    if (match) {
      row[field] = match[1].trim();
      return true;
    }
  }
  return false;
}

function normalizeLegacyString(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  const parts = text.includes('|')
    ? text.split('|').map((part) => part.trim()).filter(Boolean)
    : text.split('\n').map((part) => part.trim()).filter(Boolean);
  const row = {
    indicator: parts.shift() || '',
    actualValue: null,
    currentValue: null,
    targetValue: null,
    referenceValue: null,
    forecastValue: null,
    previousValue: null,
    legacyValue: null,
    change: '',
    trend: '',
    period: '',
    frequency: '',
    description: '',
    meaning: '',
    impact: '',
    gapToTarget: null,
    unit: '',
    source: '',
    sourceUrl: '',
    date: '',
    timestamp: '',
    importance: '',
  };
  const unclassified = [];
  for (const part of parts) {
    if (!parseExplicitLine(row, part)) unclassified.push(part);
  }
  if (text.includes('|') && unclassified.length > 0) {
    row.legacyValue = unclassified.shift();
  }
  row.description = unclassified.join(' · ');
  return row;
}

function valueFrom(item, ...keys) {
  return safeScalar(firstPresent(...keys.map((key) => item?.[key])));
}

function textFrom(item, ...keys) {
  return safeText(firstPresent(...keys.map((key) => item?.[key])));
}

export function normalizeMacroValueItem(input, fallbackIndicator = '') {
  if (isScalar(input)) {
    const row = normalizeLegacyString(input);
    if (row && fallbackIndicator && !row.indicator) row.indicator = fallbackIndicator;
    return row;
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const eventName = textFrom(input, 'event', 'title', 'subject');
  const indicator = textFrom(input, 'indicator', 'factor', 'name', 'metric', 'series', 'symbol')
    || eventName
    || fallbackIndicator;
  const sourceUrl = sanitizeMacroSourceUrl(firstPresent(input.sourceUrl, input.officialSourceUrl, input.url));
  const changePercent = valueFrom(input, 'changePercent', 'change_percent');
  const change = valueFrom(input, 'change', 'delta', 'movement')
    ?? (changePercent !== undefined ? `${Number(changePercent) > 0 ? '+' : ''}${changePercent}%` : '');

  const row = {
    indicator,
    actualValue: valueFrom(input, 'actualValue', 'actual', 'observedValue', 'reportedValue'),
    currentValue: valueFrom(input, 'currentValue', 'current'),
    targetValue: valueFrom(input, 'targetValue', 'target', 'policyTarget'),
    referenceValue: valueFrom(input, 'referenceValue', 'reference', 'baselineValue', 'baseline'),
    forecastValue: valueFrom(input, 'forecastValue', 'forecast', 'consensus', 'expectedValue'),
    previousValue: valueFrom(input, 'previousValue', 'previous', 'priorValue', 'prior'),
    legacyValue: valueFrom(input, 'value', 'level', 'price', 'reading'),
    change,
    trend: textFrom(input, 'trend', 'direction'),
    period: textFrom(input, 'period', 'referencePeriod', 'reportingPeriod', 'asOfPeriod'),
    frequency: textFrom(input, 'updateFrequency', 'frequency', 'cadence'),
    description: textFrom(input, 'description', 'comment', 'condition', 'note', 'notes', 'context', 'thesis', 'status', 'reason'),
    meaning: textFrom(input, 'meaning', 'economicMeaning', 'interpretation'),
    impact: textFrom(input, 'impact', 'marketImpact', 'effect', 'expectedImpact'),
    gapToTarget: valueFrom(input, 'gapToTarget', 'targetGap'),
    unit: textFrom(input, 'unit', 'valueUnit'),
    source: textFrom(input, 'source', 'sourceName', 'provider'),
    sourceUrl,
    date: textFrom(input, 'date', 'asOf', 'observedAt'),
    timestamp: textFrom(input, 'timestamp', 'evidenceTimestamp'),
    importance: textFrom(input, 'importance', 'priority', 'significance'),
    category: textFrom(input, 'category'),
    verified: valueFrom(input, 'verified'),
    isPreliminary: valueFrom(input, 'isPreliminary', 'preliminary'),
  };

  if (!row.indicator && ![
    row.actualValue, row.currentValue, row.targetValue, row.referenceValue,
    row.forecastValue, row.previousValue, row.legacyValue, row.description,
    row.meaning, row.impact,
  ].some(isPresent)) return null;
  return row;
}

const TOPIC_BUCKETS = [
  { keys: ['fed inflation target', 'federal reserve inflation target', 'יעד האינפלציה של הפד'], canonical: 'fed-inflation-target' },
  { keys: ['core cpi', 'cpi ליבה', 'מדד ליבה'], canonical: 'core-cpi' },
  { keys: ['cpi', 'consumer price index', 'מדד המחירים לצרכן'], canonical: 'cpi' },
  { keys: ['core pce', 'pce ליבה'], canonical: 'core-pce' },
  { keys: ['pce', 'personal consumption expenditures'], canonical: 'pce' },
  { keys: ['ppi', 'producer price index', 'מדד המחירים ליצרן'], canonical: 'ppi' },
  { keys: ['fed', 'fomc', 'ריבית', 'הפד', 'federal reserve', 'rate decision', 'ועדות'], canonical: 'fed-policy' },
  { keys: ['אורקל', 'oracle', 'orcl', 'דירוג אג', 'דירוג אשראי', 'bond rating', 'credit rating'], canonical: 'credit-rating' },
  { keys: ['ביטקוין', 'bitcoin', 'btc', 'אתריום', 'ethereum', 'eth', 'קריפטו', 'crypto'], canonical: 'crypto-market' },
  { keys: ['דולר', 'dollar', 'dxy', 'dixie'], canonical: 'dollar-index' },
  { keys: ['נפט', 'oil', 'wti', 'brent'], canonical: 'oil' },
  { keys: ['אינפלציה', 'inflation', 'מדד מחירים'], canonical: 'inflation' },
  { keys: ['תעסוקה', 'jobs', 'nfp', 'payroll', 'unemployment', 'אבטלה'], canonical: 'jobs' },
  { keys: ['vix', 'תנודתיות', 'volatility'], canonical: 'volatility' },
  { keys: ['תשואת', 'תשואות', 'אג"ח', 'אגח', 'bond yield', 'treasury', 'us10y'], canonical: 'bond-yield' },
];

export function macroSemanticKey(indicatorText) {
  const norm = String(indicatorText || '').toLowerCase();
  for (const { keys, canonical } of TOPIC_BUCKETS) {
    if (keys.some((key) => norm.includes(key))) return canonical;
  }
  const words = norm.replace(/[^\wא-ת\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2);
  return words.slice(0, 3).join(' ') || norm;
}

export function macroRowRichness(row) {
  return Object.entries(row || {}).reduce((score, [key, value]) => {
    if (!isPresent(value) || SENSITIVE_KEYS.test(key)) return score;
    return score + (typeof value === 'string' ? Math.min(value.length, 120) : 8);
  }, 0);
}

function rowIdentity(row) {
  return [macroSemanticKey(row.indicator), row.period, row.date]
    .map((value) => String(value || '').trim().toLowerCase())
    .join('\u0000');
}

function mergeRows(existing, incoming) {
  const richer = macroRowRichness(incoming) > macroRowRichness(existing) ? incoming : existing;
  const other = richer === incoming ? existing : incoming;
  const merged = { ...richer };
  for (const [key, value] of Object.entries(other)) {
    if (!isPresent(merged[key]) && isPresent(value)) merged[key] = value;
    if (['description', 'meaning', 'impact'].includes(key) && String(value || '').length > String(merged[key] || '').length) {
      merged[key] = value;
    }
  }
  return merged;
}

export function mergeMacroValueRows(rows) {
  const groups = new Map();
  let anonymous = 0;
  for (const row of rows) {
    if (!row) continue;
    const identity = rowIdentity(row) || `anonymous-${anonymous++}`;
    groups.set(identity, groups.has(identity) ? mergeRows(groups.get(identity), row) : row);
  }
  return [...groups.values()];
}

function objectEntries(value, fallbackIndicator) {
  if (Array.isArray(value)) return value.map((item) => ({ item, fallbackIndicator }));
  if (!value || typeof value !== 'object') return isScalar(value) ? [{ item: value, fallbackIndicator }] : [];
  const knownItemKey = ['indicator', 'factor', 'name', 'metric', 'actualValue', 'currentValue', 'targetValue', 'value', 'description', 'status']
    .some((key) => Object.prototype.hasOwnProperty.call(value, key));
  if (knownItemKey) return [{ item: value, fallbackIndicator }];
  return Object.entries(value)
    .filter(([key]) => !SENSITIVE_KEYS.test(key))
    .map(([key, item]) => ({ item: typeof item === 'object' && item !== null ? { indicator: key, ...item } : { indicator: key, value: item }, fallbackIndicator }));
}

function collectLayer(layer) {
  if (!layer || typeof layer !== 'object') return [];
  const entries = [];
  for (const field of ARRAY_FIELDS) entries.push(...objectEntries(layer[field], field));
  for (const field of OBJECT_FIELDS) entries.push(...objectEntries(layer[field], field));
  return entries;
}

export function selectMacroValueRows(src) {
  if (!src || typeof src !== 'object') return [];
  return mergeMacroValueRows(
    collectLayer(src)
      .map(({ item, fallbackIndicator }) => normalizeMacroValueItem(item, fallbackIndicator))
      .filter(Boolean),
  );
}

export function selectMacroValueRowsFromMarketBrief(marketBriefData) {
  if (!marketBriefData || typeof marketBriefData !== 'object') return [];
  const manual = marketBriefData.manualOverrides?.macro;
  if (manual?.source === 'manual' && Array.isArray(manual.rows)) {
    return mergeMacroValueRows(manual.rows.map((item) => normalizeMacroValueItem(item)).filter(Boolean));
  }
  const layers = [
    marketBriefData.universalTabs?.specialized,
    marketBriefData.universalTabs,
    marketBriefData,
    marketBriefData.rawData?.universalTabs?.specialized,
    marketBriefData.rawData,
  ];
  return mergeMacroValueRows(
    layers.flatMap(collectLayer)
      .map(({ item, fallbackIndicator }) => normalizeMacroValueItem(item, fallbackIndicator))
      .filter(Boolean),
  );
}

function labeledValue(label, value, unit = '') {
  const text = formatMacroScalar(value);
  if (!text) return '';
  const suffix = unit && !text.includes(unit) ? unit : '';
  return `${label}: ${text}${suffix}`;
}

export function formatMacroValueText(row) {
  if (!row) return '';
  return [
    safeText(row.indicator, 180),
    labeledValue('בפועל', row.actualValue, row.unit),
    labeledValue('נוכחי', row.currentValue, row.unit),
    labeledValue('ערך מדווח', row.legacyValue, row.unit),
    labeledValue('יעד', row.targetValue, row.unit),
    labeledValue('ייחוס', row.referenceValue, row.unit),
    labeledValue('תחזית', row.forecastValue, row.unit),
    labeledValue('קודם', row.previousValue, row.unit),
    labeledValue('שינוי', row.change),
    row.trend ? `מגמה: ${safeText(row.trend)}` : '',
    row.period ? `תקופה: ${safeText(row.period)}` : '',
    labeledValue('פער מהיעד', row.gapToTarget, row.unit),
    row.description ? `תיאור: ${safeText(row.description)}` : '',
    row.meaning ? `משמעות: ${safeText(row.meaning)}` : '',
    row.impact ? `השפעה: ${safeText(row.impact)}` : '',
    row.source ? `מקור: ${safeText(row.source, 160)}` : '',
    row.sourceUrl ? `קישור מקור: ${row.sourceUrl}` : '',
    row.date ? `תאריך: ${safeText(row.date, 120)}` : '',
    row.timestamp ? `חותמת זמן: ${safeText(row.timestamp, 120)}` : '',
    isPresent(row.verified) ? `אומת: ${formatMacroScalar(row.verified)}` : '',
    isPresent(row.isPreliminary) ? `ראשוני: ${formatMacroScalar(row.isPreliminary)}` : '',
  ].filter(Boolean).join(' · ');
}
