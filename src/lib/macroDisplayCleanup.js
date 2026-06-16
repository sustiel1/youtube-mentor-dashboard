/**
 * Presentation-only cleanup for Macro table rows:
 * dedupe index/ETF entities, sanitize change fields, filter overlap with Markets.
 */

import {
  isDuplicateDirectionLabel,
  parseNumericChangeDisplay,
} from '@/lib/morningBriefVisuals';

/** Canonical entity keys for index ↔ ETF deduplication. */
const ETF_TO_ENTITY = {
  spy: 'sp500',
  qqq: 'nasdaq',
  iwm: 'russell',
  dia: 'dow',
};

const ENTITY_INDEX_PATTERNS = [
  { key: 'sp500', pattern: /s&p|sp\s*500|ספ\s*500|סוף\s*500/i },
  { key: 'nasdaq', pattern: /nasdaq|נאסד(?:ק)?/i },
  { key: 'russell', pattern: /russell(?:\s*2000)?|רוסל/i },
  { key: 'dow', pattern: /dow(?:\s*jones)?|דאו(?:\s*jones)?/i },
];

const ETF_TICKERS = new Set(['spy', 'qqq', 'iwm', 'dia', 'es', 'nq']);

const TRAILING_DIRECTION_RE =
  /\s*(עליה|עלייה|עולה|ירידה|יורדת|יורד|חיובי|שלילי|up|down|bullish|bearish|positive|negative)\s*$/i;

/** Normalize indicator/asset to canonical entity key for dedup. */
export function normalizeMarketEntityKey(name) {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();

  if (ETF_TO_ENTITY[lower]) return ETF_TO_ENTITY[lower];

  for (const { key, pattern } of ENTITY_INDEX_PATTERNS) {
    if (pattern.test(raw)) return key;
  }

  return lower.replace(/\s+/g, ' ');
}

export function isMarketIndexEntityKey(key) {
  return ['sp500', 'nasdaq', 'russell', 'dow'].includes(key);
}

/** Strip arrow prefix and trailing direction words from composite change strings. */
export function sanitizeMacroChangeValue(change) {
  let raw = String(change ?? '').trim();
  if (!raw) return '';

  raw = raw.replace(/^[↑↓▲▼]\s*/, '').trim();
  raw = raw.replace(TRAILING_DIRECTION_RE, '').trim();

  const numMatch = raw.match(/([+-]?\d+(?:\.\d+)?)\s*%?/);
  if (numMatch) {
    const hasPct = /%/.test(raw);
    return hasPct ? `${numMatch[1]}%` : numMatch[1];
  }

  if (isDuplicateDirectionLabel(raw)) return '';
  return raw;
}

function macroRowContext(row) {
  return [row?.impact, row?.description, row?.indicator, row?.value, row?.change]
    .filter(Boolean)
    .join(' ');
}

/** Remove redundant direction text from impact when change already encodes direction. */
export function sanitizeMacroImpact(impact, change, row = {}) {
  const impactText = String(impact ?? '').trim();
  if (!impactText) return '';

  const ctx = macroRowContext(row);
  const cleanChange = sanitizeMacroChangeValue(change);
  const numeric = parseNumericChangeDisplay(cleanChange, ctx);

  if (numeric?.kind === 'percent' && isDuplicateDirectionLabel(impactText)) {
    return '';
  }

  if (numeric?.kind === 'percent') {
    const impactLower = impactText.toLowerCase();
    const redundantUp = numeric.tone === 'bullish' &&
      /על|עול|חיוב|up|bullish|positive/i.test(impactLower);
    const redundantDown = numeric.tone === 'bearish' &&
      /יריד|יורד|שליל|down|bearish|negative/i.test(impactLower);
    if (redundantUp || redundantDown) return '';
  }

  if (isDuplicateDirectionLabel(impactText)) return '';
  return impactText;
}

/** Sanitize a single macro row for consistent display. */
export function sanitizeMacroDisplayRow(row) {
  if (!row) return row;
  const change = sanitizeMacroChangeValue(row.change);
  const impact = sanitizeMacroImpact(row.impact, row.change, row);
  return { ...row, change, impact };
}

function rowDisplayScore(row, nameKey = 'indicator') {
  const ind = String(row[nameKey] ?? '').toLowerCase();
  let score = 0;
  if (!ETF_TICKERS.has(ind)) score += 20;
  const change = row.change ?? row.strength ?? '';
  if (/%/.test(change) || parseNumericChangeDisplay(change, macroRowContext(row))) score += 10;
  if (row.description || row.comment) score += 3;
  if (row.value) score += 1;
  return score;
}

/** Dedupe SPY/QQQ/IWM when S&P 500/NASDAQ/Russell already present. */
export function dedupeRowsByMarketEntity(rows, nameKey = 'indicator') {
  const byKey = new Map();
  let anon = 0;

  for (const row of rows) {
    const key = normalizeMarketEntityKey(row[nameKey]);
    if (!key) {
      byKey.set(`__anon_${anon++}`, row);
      continue;
    }

    const prev = byKey.get(key);
    if (!prev || rowDisplayScore(row, nameKey) > rowDisplayScore(prev, nameKey)) {
      byKey.set(key, row);
    }
  }

  return [...byKey.values()];
}

/** @deprecated alias */
export function dedupeMacroRowsByEntity(rows) {
  return dedupeRowsByMarketEntity(rows, 'indicator');
}

/** Sanitize Markets row strength/trend fields (composite strings like "0.6% עליה"). */
export function sanitizeMarketDashboardRowForDisplay(row) {
  if (!row) return row;

  const context = [row.trend, row.strength, row.comment].filter(Boolean).join(' ');
  let strength = sanitizeMacroChangeValue(row.strength);
  let trend = String(row.trend ?? '').trim();

  if (!strength && trend) {
    const fromTrend = sanitizeMacroChangeValue(trend);
    if (fromTrend && /\d/.test(fromTrend)) {
      strength = fromTrend;
      if (isDuplicateDirectionLabel(trend)) trend = '';
    }
  }

  if (isDuplicateDirectionLabel(trend)) trend = '';
  if (isDuplicateDirectionLabel(strength)) strength = '';

  if (strength && !/%/.test(strength) && /^\d/.test(strength)) {
    const parsed = parseNumericChangeDisplay(strength, context);
    if (parsed?.kind === 'percent' && !strength.includes('%')) {
      strength = `${strength}%`;
    }
  }

  return { ...row, strength: strength || '', trend: trend || '' };
}

/** Remove macro rows that duplicate Markets table entities (indices/ETFs). */
export function filterMacroRowsOverlappingMarkets(macroRows, marketRows = []) {
  const marketKeys = new Set(
    marketRows.map((r) => normalizeMarketEntityKey(r.asset)).filter(Boolean),
  );

  if (marketKeys.size === 0) return macroRows;

  return macroRows.filter((row) => {
    const key = normalizeMarketEntityKey(row.indicator);
    if (!key) return true;
    if (marketKeys.has(key) && isMarketIndexEntityKey(key)) return false;
    if (marketKeys.has(key) && ETF_TICKERS.has(String(row.indicator ?? '').trim().toLowerCase())) {
      return false;
    }
    return true;
  });
}

/**
 * Full macro display pipeline (presentation only).
 */
export function cleanupMacroDisplayRows(macroRows, marketRows = []) {
  const sanitized = macroRows.map(sanitizeMacroDisplayRow);
  const deduped = dedupeRowsByMarketEntity(sanitized, 'indicator');
  return filterMacroRowsOverlappingMarkets(deduped, marketRows);
}

/** Sanitize + entity-dedupe for Markets table rows. */
export function cleanupMarketDashboardRows(rows) {
  const sanitized = rows.map(sanitizeMarketDashboardRowForDisplay);
  return dedupeRowsByMarketEntity(sanitized, 'asset');
}
