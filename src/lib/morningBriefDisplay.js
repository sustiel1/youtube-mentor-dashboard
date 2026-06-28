/**
 * Read-only presentation helpers for the Specialized tab's three-layer merge
 * (universalTabs.specialized → legacy top-level fields → rawData).
 * Originally built for Morning Brief; the merge itself is content-type agnostic —
 * it only depends on field names, so any brief type benefits once its field names
 * are listed in SPECIALIZED_MERGE_ARRAY_KEYS / SPECIALIZED_MERGE_OBJECT_KEYS below.
 * Mirrors resolveSpecialized() merge — does NOT change extraction logic.
 */

import { cleanupMarketDashboardRows } from '@/lib/macroDisplayCleanup';

const INDEX_OVERVIEW_KEYS = new Set([
  'spx', 'nasdaq', 'dow', 'russell', 'vix', 'dollar', 'bitcoin', 'oil', 'bonds10y',
  'bonds', 'gold', 'treasury', 'es', 'nq', 'spy', 'qqq', 'iwm',
]);

const REGIME_SPECS = [
  { keys: ['marketStatus', 'marketMood', 'marketCondition'], label: 'מצב השוק' },
  { keys: ['summary', 'marketSummary', 'briefSummary', 'executiveSummary'], label: 'סיכום' },
  { keys: ['mainConclusion', 'main_conclusion', 'primaryConclusion'], label: 'מסקנה מרכזית' },
  { keys: ['marketTrend', 'trend', 'marketDirection', 'overallTrend'], label: 'מגמת שוק' },
  { keys: ['breadth', 'marketBreadth', 'breadthIndicator'], label: 'רוחב שוק' },
  { keys: ['riskOn', 'riskOff', 'riskOnOff', 'riskEnvironment', 'riskAppetite'], label: 'Risk On / Off' },
  { keys: ['volatility', 'volatilityEnvironment', 'volEnvironment', 'vixEnvironment'], label: 'סביבת תנודתיות' },
  { keys: ['leadingSector', 'strongestSector', 'topSector', 'sectorLeader'], label: 'סקטור מוביל' },
  { keys: ['weakestSector', 'laggingSector', 'bottomSector'], label: 'סקטור חלש' },
  { keys: ['marketStrength', 'strength', 'overallStrength'], label: 'חוזק השוק' },
  { keys: ['marketWeakness', 'weakness', 'overallWeakness', 'marketVulnerability'], label: 'חולשת השוק' },
];

const TREND_TOKEN_MAP = {
  up: 'עלייה',
  down: 'ירידה',
  bullish: 'שורי',
  bearish: 'דובי',
  neutral: 'ניטרלי',
  flat: 'שטוח',
  positive: 'חיובי',
  negative: 'שלילי',
  weak: 'חלש',
  strong: 'חזק',
  weakening: 'מתחלש',
  strengthening: 'מתחזק',
};

/** Keys merged as concatenated arrays (specialized → legacy top-level → rawData priority). */
export const SPECIALIZED_MERGE_ARRAY_KEYS = [
  'indices', 'indexPerformance', 'indexData',
  'marketNews', 'headlines', 'news', 'topStories',
  'macroFactors', 'macro', 'macroEvents', 'macroHighlights', 'economicEvents',
  'stocksMentioned', 'stocks', 'watchlist', 'tickers', 'mentionedStocks',
  'watchlistLevels', 'keyLevels', 'catalysts',
  'sectorRotation', 'sectors', 'sectorPerformance', 'sectorOverview',
  'tradingOpportunities', 'opportunities', 'trades', 'breakoutCandidates',
  'economicCalendar', 'calendar', 'events', 'upcomingEvents', 'schedule',
  'earnings', 'risks', 'warnings', 'riskFactors',
  // ── Step 1 (weekly/earnings brief support) — same field names the legacy
  // extraction in videoTabsConfig.js already reads from `video`; listing them
  // here just lets the merge also pull them from rawData / universalTabs.specialized.
  'marketChanges', 'changes',
  'tomorrowEvents', 'nextEvents',
  'weeklyHighlights', 'highlights',
  'winners', 'topGainers',
  'losers', 'topLosers',
  'weeklyOutlook', 'outlook', 'nextWeekOutlook',
  'guidance', 'earningsGuidance',
  'managementCommentary', 'commentary',
  'financialMetrics',
];

/** Keys deep-merged as objects (later layers override leaf fields). */
export const SPECIALIZED_MERGE_OBJECT_KEYS = ['marketOverview', 'sentiment'];

const BRIEF_SHELL_KEYS = new Set([
  'contentType', 'universalTabs', 'rawData', 'brainKnowledge', 'metadata',
]);

function itemMergeSignature(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);
  const id = item.symbol || item.ticker || item.sector || item.event || item.name
    || item.risk || item.headline || item.title;
  return id ? String(id) : JSON.stringify(item);
}

function mergeArrayLayers(specArr, legacyArr, rawArr) {
  const out = [];
  const seen = new Set();
  for (const arr of [specArr, legacyArr, rawArr]) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const sig = itemMergeSignature(item);
      if (!sig || seen.has(sig)) continue;
      seen.add(sig);
      out.push(item);
    }
  }
  return out;
}

function mergeObjectLayers(...layers) {
  const out = {};
  for (const obj of layers) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (
        typeof v === 'object' && !Array.isArray(v)
        && typeof out[k] === 'object' && out[k] != null && !Array.isArray(out[k])
      ) {
        out[k] = { ...out[k], ...v };
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}

/**
 * Merges rawData + top-level brief fields + universalTabs.specialized for Morning Brief UI.
 * Arrays union rawData → top-level → specialized; specialized leaf fields win on object conflicts.
 */
export function mergeMorningBriefSpecializedSource(marketBriefData) {
  if (!marketBriefData || typeof marketBriefData !== 'object') return null;

  const raw = marketBriefData.rawData && typeof marketBriefData.rawData === 'object'
    ? marketBriefData.rawData
    : {};
  const spec = marketBriefData.universalTabs?.specialized;
  const specObj = spec && typeof spec === 'object' ? spec : {};

  const legacy = {};
  for (const [k, v] of Object.entries(marketBriefData)) {
    if (BRIEF_SHELL_KEYS.has(k)) continue;
    if (v == null) continue;
    legacy[k] = v;
  }

  const merged = { ...legacy };

  for (const key of SPECIALIZED_MERGE_ARRAY_KEYS) {
    // rawData → top-level → specialized; empty specialized arrays cannot block rawData items
    const combined = mergeArrayLayers(raw[key], legacy[key], specObj[key]);
    if (combined.length > 0) merged[key] = combined;
  }

  for (const key of SPECIALIZED_MERGE_OBJECT_KEYS) {
    if (key === 'sentiment') {
      const objCombined = mergeObjectLayers(
        Array.isArray(raw[key]) ? null : raw[key],
        Array.isArray(legacy[key]) ? null : legacy[key],
        Array.isArray(specObj[key]) ? null : specObj[key],
      );
      const arrCombined = mergeArrayLayers(
        Array.isArray(raw[key]) ? raw[key] : null,
        Array.isArray(legacy[key]) ? legacy[key] : null,
        Array.isArray(specObj[key]) ? specObj[key] : null,
      );
      if (Object.keys(objCombined).length > 0) {
        merged[key] = objCombined;
      } else if (arrCombined.length > 0) {
        merged[key] = arrCombined;
      }
      continue;
    }
    const combined = mergeObjectLayers(raw[key], legacy[key], specObj[key]);
    if (Object.keys(combined).length > 0) merged[key] = combined;
  }

  const allKeys = new Set([
    ...Object.keys(raw),
    ...Object.keys(legacy),
    ...Object.keys(specObj),
  ]);
  for (const key of allKeys) {
    if (SPECIALIZED_MERGE_ARRAY_KEYS.includes(key) || SPECIALIZED_MERGE_OBJECT_KEYS.includes(key)) continue;
    if (merged[key] != null) continue;
    const v = specObj[key] ?? legacy[key] ?? raw[key];
    if (v != null && typeof v !== 'object') merged[key] = v;
  }

  return merged;
}

/** Inject manualOverrides into merged src (display-only; preserves AI data underneath). */
function applyManualOverridesToMergedSrc(merged, manualOverrides) {
  if (!merged || !manualOverrides || typeof manualOverrides !== 'object') return merged;
  const out = { ...merged };

  for (const [sectionId, ov] of Object.entries(manualOverrides)) {
    if (!ov || ov.source !== 'manual') continue;

    if (sectionId === 'opportunitiesRisks' && ov.rows) {
      out.opportunities = ov.rows.opportunities ?? [];
      out.risks = (ov.rows.risks ?? []).map((r) => (
        typeof r === 'string' ? r : { risk: r.text, text: r.text, category: r.category || '' }
      ));
      continue;
    }

    if (!Array.isArray(ov.rows)) continue;

    switch (sectionId) {
      case 'economicCalendar':
        out.economicCalendar = ov.rows;
        out.calendar = ov.rows;
        break;
      case 'macro':
        out.macroFactors = ov.rows;
        break;
      case 'markets':
        out.indices = ov.rows.map((r) => ({
          name: r.asset,
          symbol: r.asset,
          trend: r.trend,
          strength: r.strength,
          note: r.comment,
          comment: r.comment,
        }));
        break;
      case 'sectors':
        out.sectors = ov.rows;
        break;
      case 'news':
        out.marketNews = ov.rows.map((r) => (typeof r === 'string' ? r : r.text || ''));
        out.news = out.marketNews;
        break;
      case 'marketRegime':
        out.__manualMarketRegimeCards = ov.rows;
        break;
      case 'stocksMentioned':
        out.stocksMentioned = ov.rows.map((s) => ({
          symbol: s.ticker,
          ticker: s.ticker,
          company: s.company,
          reason: s.context,
          context: s.context,
          sentiment: s.sentiment,
          category: s.category,
          notes: s.notes,
        }));
        break;
      default:
        break;
    }
  }

  return out;
}

/** Normalized specialized source for all Morning Brief panels and extractors. */
export function getSpecializedSrc(marketBriefData) {
  const merged = mergeMorningBriefSpecializedSource(marketBriefData);
  return applyManualOverridesToMergedSrc(merged, marketBriefData?.manualOverrides);
}

/** Count items in a single layer for runtime audit. */
export function countSpecializedLayer(layer, key) {
  if (!layer || typeof layer !== 'object') return 0;
  const v = layer[key];
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') return Object.keys(v).length;
  return v != null ? 1 : 0;
}

function safeCoerceString(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function pickString(obj, ...keys) {
  for (const key of keys) {
    const v = obj?.[key];
    const s = safeCoerceString(v);
    if (s) return s;
  }
  return '';
}

function pickArray(obj, ...keys) {
  for (const key of keys) {
    const v = obj?.[key];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  return [];
}

function formatDisplayValue(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(formatDisplayValue).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const parts = Object.entries(v)
      .filter(([, val]) => val != null && val !== '')
      .map(([k, val]) => `${k}: ${formatDisplayValue(val)}`);
    return parts.join(' | ');
  }
  return String(v);
}

/** Market regime summary cards from marketOverview / marketRegime / top-level fields. */
export function extractMarketRegimeCards(src) {
  if (!src) return [];

  if (Array.isArray(src.__manualMarketRegimeCards) && src.__manualMarketRegimeCards.length > 0) {
    return src.__manualMarketRegimeCards;
  }

  const pools = [
    src.marketRegime,
    src.marketOverview,
    src.overview,
    src.marketSummary,
    src,
  ].filter((p) => p && typeof p === 'object' && !Array.isArray(p));

  const cards = [];
  const used = new Set();

  for (const spec of REGIME_SPECS) {
    for (const pool of pools) {
      for (const key of spec.keys) {
        if (used.has(spec.label)) break;
        const raw = pool[key];
        const value = formatDisplayValue(raw);
        if (!value) continue;
        cards.push({ key, label: spec.label, value });
        used.add(spec.label);
        break;
      }
    }
  }

  // String fields on marketOverview that are not index tickers
  const mo = src.marketOverview;
  if (mo && typeof mo === 'object' && !Array.isArray(mo)) {
    for (const [key, val] of Object.entries(mo)) {
      if (INDEX_OVERVIEW_KEYS.has(key.toLowerCase())) continue;
      if (typeof val === 'object' && val !== null) continue;
      const value = formatDisplayValue(val);
      if (!value) continue;
      const spec = REGIME_SPECS.find((s) => s.keys.includes(key));
      const label = spec?.label || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
      if (used.has(label)) continue;
      cards.push({ key, label, value });
      used.add(label);
    }
  }

  return cards;
}

function normalizeOpportunity(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    const t = item.trim();
    return t ? { title: t, detail: '', kind: 'setup' } : null;
  }
  if (typeof item !== 'object') return null;

  const title = pickString(item, 'title', 'setup', 'idea', 'symbol', 'ticker', 'sector', 'name', 'stock');
  const detail = pickString(
    item, 'reason', 'description', 'note', 'comment', 'setup', 'strategy', 'entry', 'trigger', 'catalyst', 'type'
  );
  const kind = pickString(item, 'type', 'kind', 'category', 'setupType') || 'setup';

  if (!title && !detail) {
    const fallback = Object.values(item).find((v) => typeof v === 'string' && v.trim());
    if (!fallback) return null;
    return { title: fallback.trim(), detail: '', kind: 'setup' };
  }

  return { title: title || detail, detail: title && detail && title !== detail ? detail : '', kind };
}

function humanizeMarketToken(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (TREND_TOKEN_MAP[low]) return TREND_TOKEN_MAP[low];
  return s;
}

/** Dashboard row: נכס | מגמה | חוזק | הערה — presentation only. */
export function normalizeMarketDashboardRow(raw, defaultAsset = '') {
  if (!raw) return null;

  if (typeof raw === 'string') {
    const ci = raw.indexOf(':');
    if (ci === -1) {
      const t = raw.trim();
      return t ? { asset: t.toUpperCase(), trend: '', strength: '', comment: '' } : null;
    }
    return normalizeMarketDashboardRow(
      { name: raw.slice(0, ci).trim(), ...Object.fromEntries(
        raw.slice(ci + 1).split(/\s*\|\s*/).map((part) => {
          const ki = part.indexOf(':');
          if (ki === -1) return null;
          return [part.slice(0, ki).trim().toLowerCase(), part.slice(ki + 1).trim()];
        }).filter(Boolean)
      ) },
      defaultAsset
    );
  }

  if (typeof raw !== 'object') return null;

  const asset = (
    pickString(raw, 'name', 'symbol', 'ticker', 'asset', 'index', 'metric') || defaultAsset
  ).toUpperCase();

  const directionRaw = pickString(raw, 'trend', 'shortTermTrend', 'direction', 'bias', 'phase');
  const strengthRaw = pickString(
    raw, 'strength', 'momentum', 'relativeStrength', 'mediumTermTrend', 'rs', 'power'
  );
  const changeRaw = pickString(raw, 'change', 'pct', 'changePercent');
  const condition = pickString(raw, 'condition', 'state', 'status');
  const note = pickString(raw, 'note', 'comment', 'description', 'insight', 'context');

  const trendIsToken = directionRaw && directionRaw.length <= 20 &&
    ['up', 'down', 'bullish', 'bearish', 'neutral', 'flat'].includes(directionRaw.toLowerCase());

  let trend = humanizeMarketToken(directionRaw);
  if (!trend && condition && /weak|pullback|break|below|above|trend/i.test(condition) && condition.length < 40) {
    trend = condition;
  }

  let strength = humanizeMarketToken(strengthRaw) || changeRaw;
  if (!strength && raw.level && !note) {
    const lvl = String(raw.level || raw.price || raw.value || '').trim();
    if (lvl && !/^\d/.test(lvl)) strength = lvl;
  }

  let comment = note;
  if (!comment && condition && condition !== trend) comment = condition;
  if (!comment && raw.level) {
    const lvl = String(raw.level || raw.price || raw.value || '').trim();
    if (lvl && /below|above|support|resistance|ma|average|trendline/i.test(lvl)) comment = lvl;
    else if (lvl && !strength) comment = lvl;
  }

  if (!asset && !trend && !strength && !comment) return null;
  return { asset: asset || '—', trend, strength, comment };
}

/** Markets dashboard rows from indices + marketOverview tickers. */
export function extractMarketDashboardRows(src) {
  if (!src) return [];

  const rows = [];
  const push = (item, asset = '') => {
    const row = normalizeMarketDashboardRow(item, asset);
    if (row) rows.push(row);
  };

  for (const item of pickArray(src, 'indices', 'indexPerformance', 'indexData', 'keyLevels')) {
    push(item);
  }

  const mo = src.marketOverview;
  if (mo && typeof mo === 'object' && !Array.isArray(mo)) {
    for (const [key, val] of Object.entries(mo)) {
      if (!INDEX_OVERVIEW_KEYS.has(key.toLowerCase())) continue;
      if (val && typeof val === 'object') push(val, key.toUpperCase());
      else if (typeof val === 'string' && val.trim()) {
        rows.push({ asset: key.toUpperCase(), trend: '', strength: '', comment: val.trim() });
      }
    }
  }

  const seen = new Set();
  const unique = rows.filter((r) => {
    const sig = `${r.asset}|${r.trend}|${r.strength}|${r.comment}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

  return cleanupMarketDashboardRows(unique);
}

const OPPORTUNITY_KIND_LABELS = {
  setup: 'סטאפ',
  watchlist: 'מעקב',
  sector: 'סקטור',
  breakout: 'פריצה',
  swing: 'סווינג',
  rs: 'חוזק יחסי',
};

/** Actionable opportunities from multiple specialized keys. */
export function extractOpportunityIdeas(src) {
  if (!src) return [];

  const buckets = [
    { items: pickArray(src, 'opportunities', 'tradingOpportunities', 'trades', 'buyOpportunities'), kind: 'setup' },
    { items: pickArray(src, 'breakoutCandidates', 'breakouts', 'breakoutSetups'), kind: 'breakout' },
    { items: pickArray(src, 'relativeStrengthLeaders', 'rsLeaders', 'momentumLeaders'), kind: 'rs' },
    { items: pickArray(src, 'sectorsToMonitor', 'sectorsToWatch', 'strongSectors', 'leadingSectors'), kind: 'sector' },
    { items: pickArray(src, 'potentialSetups', 'setups', 'tradeIdeas'), kind: 'setup' },
    { items: pickArray(src, 'swingOpportunities', 'swingTrades', 'swingSetups'), kind: 'swing' },
  ];

  const raw = [];
  for (const { items, kind } of buckets) {
    for (const item of items) {
      const row = normalizeOpportunity(item);
      if (row) raw.push({ ...row, kind: row.kind !== 'setup' ? row.kind : kind });
    }
  }

  const seen = new Set();
  return raw
    .filter((row) => {
      if (!row?.title) return false;
      const sig = `${row.title}|${row.detail}|${row.kind}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    })
    .map((row) => ({
      ...row,
      kindLabel: OPPORTUNITY_KIND_LABELS[row.kind] || row.kind,
    }));
}

function normalizeRisk(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    const t = item.trim();
    return t ? { text: t, category: '' } : null;
  }
  if (typeof item !== 'object') return null;
  const text = pickString(item, 'risk', 'text', 'title', 'description', 'warning', 'note');
  const category = pickString(item, 'category', 'type', 'kind', 'severity', 'source', 'level');
  if (!text) {
    const fallback = Object.values(item).find((v) => typeof v === 'string' && v.trim());
    return fallback ? { text: fallback.trim(), category } : null;
  }
  return { text, category };
}

const RISK_BUCKETS = [
  { keys: ['risks', 'warnings', 'riskFactors', 'redFlags'], category: '' },
  { keys: ['breadthDeterioration', 'breadthRisks'], category: 'רוחב שוק' },
  { keys: ['concentrationRisk', 'concentrationRisks'], category: 'ריכוזיות' },
  { keys: ['macroRisks', 'macroRisk'], category: 'מאקרו' },
  { keys: ['eventRisks', 'eventRisk', 'calendarRisks'], category: 'אירוע' },
  { keys: ['sectorWeakness', 'weakSectors', 'laggingSectors'], category: 'סקטור חלש' },
];

/** Risk items from specialized risk-related keys. */
export function extractRiskItems(src) {
  if (!src) return [];
  const raw = [];
  for (const { keys, category } of RISK_BUCKETS) {
    for (const key of keys) {
      const arr = pickArray(src, key);
      for (const item of arr) {
        const r = normalizeRisk(item);
        if (r) raw.push({ ...r, category: r.category || category });
      }
    }
  }
  const seen = new Set();
  return raw.filter((r) => {
    if (seen.has(r.text)) return false;
    seen.add(r.text);
    return true;
  });
}

function detectEventType(text) {
  const t = (text || '').toLowerCase();
  if (/\bcpi\b|מדד\s*מחירים/.test(t)) return 'CPI';
  if (/\bppi\b/.test(t)) return 'PPI';
  if (/\bfomc\b|פד\b|fed\b|ריבית/.test(t)) return 'FOMC';
  if (/\bnfp\b|תעסוקה|payroll/.test(t)) return 'NFP';
  if (/earnings|דוחות|רווח/.test(t)) return 'דוחות';
  return '';
}

function formatMacroChange(item) {
  const direct = pickString(item, 'change', 'delta', 'movement');
  if (direct) return direct;
  const pct = item?.changePercent ?? item?.change_percent;
  if (pct != null && pct !== '') {
    const num = Number(pct);
    if (!Number.isNaN(num)) return `${num > 0 ? '+' : ''}${num}%`;
  }
  const dir = pickString(item, 'direction', 'trend');
  return dir || '';
}

function normalizeMacroIndicatorRow(item) {
  if (!item) return null;

  if (typeof item === 'string') {
    const t = item.trim();
    if (!t) return null;

    if (t.includes('|')) {
      const parts = t.split('|').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return {
          indicator: parts[0] || '',
          value: parts[1] || '',
          change: parts[2] || '',
          frequency: parts[3] || '',
          description: parts[4] || '',
          impact: parts[5] || '',
        };
      }
    }

    const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 1) {
      return {
        indicator: lines[0],
        value: '',
        change: '',
        frequency: '',
        description: '',
        impact: '',
      };
    }

    const row = {
      indicator: lines[0] || '',
      value: '',
      change: '',
      frequency: '',
      description: '',
      impact: '',
    };
    for (const line of lines.slice(1)) {
      if (line.startsWith('📅')) row.value = row.value || line.replace(/^📅\s*/, '').trim();
      else if (line.startsWith('חשיבות:')) row.frequency = line.replace(/^חשיבות:\s*/, '').trim();
      else if (line.startsWith('השפעה:')) row.impact = line.replace(/^השפעה:\s*/, '').trim();
      else if (line.startsWith('סקטורים:')) row.description = mergeContext(row.description, line.replace(/^סקטורים:\s*/, '').trim());
      else row.description = mergeContext(row.description, line);
    }
    return row;
  }

  if (typeof item !== 'object') return null;

  const eventName = pickString(item, 'event', 'title', 'subject');
  const indicator = pickString(item, 'name', 'symbol', 'indicator', 'ticker', 'stock') || eventName;
  const value = pickString(item, 'value', 'level', 'currentValue', 'price', 'current', 'when', 'date', 'time');
  const change = formatMacroChange(item);
  const frequency = pickString(item, 'updateFrequency', 'frequency', 'cadence', 'period', 'importance', 'priority');
  const description = pickString(
    item,
    'description', 'comment', 'condition', 'note', 'context', 'thesis', 'status', 'reason', 'sectors',
  );
  const impact = pickString(item, 'impact', 'marketImpact', 'effect', 'expectedImpact', 'sentiment', 'bias');

  if (!indicator && !value && !description && !impact) return null;

  return {
    indicator: indicator || eventName || value || '—',
    value: eventName && indicator !== eventName ? pickString(item, 'date', 'time', 'when', 'value') : value,
    change,
    frequency,
    description,
    impact,
  };
}

/** Parse one macro item (object or formatted string) for table display. */
export function parseMacroDisplayItem(item) {
  return normalizeMacroIndicatorRow(item);
}

/** Presentation-only macro rows for table UI (no schema / extractor changes). */
export function extractMacroIndicatorRows(src) {
  if (!src) return [];
  const raw = [
    ...pickArray(src, 'macroFactors'),
    ...pickArray(src, 'macro', 'macroEvents', 'macroHighlights', 'macroContext', 'economicContext', 'economicEvents'),
  ];
  const seen = new Set();
  return raw.map(normalizeMacroIndicatorRow).filter((row) => {
    if (!row) return false;
    const sig = `${row.indicator}|${row.value}|${row.change}|${row.description}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

function normalizeCalendarRow(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    const t = item.trim();
    if (!t) return null;
    return {
      event: t,
      date: '',
      importance: '',
      type: detectEventType(t),
      impact: '',
    };
  }
  if (typeof item !== 'object') return null;

  const event = pickString(item, 'event', 'title', 'name', 'subject', 'description');
  const date = pickString(item, 'date', 'time', 'when', 'day');
  const importance = pickString(item, 'importance', 'priority', 'significance');
  const impact = pickString(item, 'impact', 'marketImpact', 'expectedImpact', 'effect');
  const type = pickString(item, 'type', 'category') || detectEventType(event);

  if (!event && !date) return null;
  return { event: event || date, date, importance, type, impact };
}

export function extractCalendarRows(src) {
  if (!src) return [];
  const raw = [
    ...pickArray(src, 'calendar', 'economicCalendar', 'events', 'upcomingEvents', 'schedule', 'earningsCalendar'),
    ...pickArray(src, 'catalysts'),
  ];
  const seen = new Set();
  return raw.map(normalizeCalendarRow).filter((row) => {
    if (!row) return false;
    const sig = `${row.event}|${row.date}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

const SENTIMENT_FIELD_LABELS = {
  retail: 'סנטימנט קמעונאי',
  institutional: 'סנטימנט מוסדי',
  fearGreed: 'פחד וחמדנות',
  marketMood: 'מצב השוק',
  overall: 'סנטימנט כללי',
  generalMood: 'אווירה כללית',
};

function sentimentItemFromString(raw, index = 0) {
  const t = String(raw || '').trim();
  if (!t) return null;
  const split = t.split(' — ');
  if (split.length >= 2) {
    return { label: split[0].trim(), value: split.slice(1).join(' — ').trim() };
  }
  return { label: index === 0 ? 'סנטימנט שוק' : `סנטימנט ${index + 1}`, value: t };
}

function sentimentItemFromObject(item) {
  if (!item || typeof item !== 'object') return null;
  const label = pickString(item, 'label', 'name', 'type', 'category') || 'סנטימנט שוק';

  // Try standard value fields first
  const stdValue = item.value ?? item.text ?? item.description ?? item.summary ?? item.mood;
  if (stdValue != null) {
    const value = formatDisplayValue(stdValue);
    return value ? { label, value } : null;
  }

  // Avoid full-object serialization: combine tone field + note field instead
  const sentPart = pickString(item, 'sentiment', 'direction', 'bias', 'status');
  const notePart = pickString(item, 'note', 'notes', 'reason', 'comment', 'content');
  const value = [sentPart, notePart].filter(Boolean).join(' · ');

  return value ? { label, value } : null;
}

/** Object or array sentiment → labeled cards for UI. */
export function extractSentimentItems(src) {
  if (!src) return [];
  const items = [];

  const sent = src.sentiment;
  if (Array.isArray(sent)) {
    sent.forEach((item, index) => {
      if (typeof item === 'string') {
        const card = sentimentItemFromString(item, index);
        if (card) items.push(card);
      } else {
        const card = sentimentItemFromObject(item);
        if (card) items.push(card);
      }
    });
  } else if (sent && typeof sent === 'object') {
    for (const [key, val] of Object.entries(sent)) {
      const value = formatDisplayValue(val);
      if (!value) continue;
      items.push({
        label: SENTIMENT_FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
        value,
      });
    }
  }

  for (const item of pickArray(src, 'marketSentiment', 'sentimentAnalysis', 'fearGreed')) {
    if (typeof item === 'string') {
      const card = sentimentItemFromString(item, items.length);
      if (card) items.push(card);
    } else {
      const card = sentimentItemFromObject(item);
      if (card) items.push(card);
    }
  }

  return items;
}

export function hasSentimentData(src) {
  return extractSentimentItems(src).length > 0;
}

function normalizeEarningsRow(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    const t = item.trim();
    return t ? { ticker: t, impact: '', note: '' } : null;
  }
  if (typeof item !== 'object') return null;

  const ticker = pickString(item, 'symbol', 'ticker', 'name', 'stock');
  const impact = pickString(item, 'impact', 'direction', 'status', 'result');
  const note = pickString(item, 'note', 'description', 'comment', 'status', 'headline');

  if (!ticker && !note) return null;
  return { ticker: ticker || '—', impact, note };
}

export function extractEarningsRows(src) {
  if (!src) return [];
  return pickArray(src, 'earnings').map(normalizeEarningsRow).filter(Boolean);
}

function normalizeLevelRow(item, defaultLabel = '') {
  if (!item) return null;
  if (typeof item === 'string') {
    const t = item.trim();
    return t ? { symbol: defaultLabel || t, level: '', type: '', note: t } : null;
  }
  if (typeof item !== 'object') return null;

  const symbol = pickString(item, 'symbol', 'ticker', 'name', 'asset', 'index');
  const level = pickString(item, 'level', 'price', 'target', 'value');
  const type = pickString(item, 'type', 'kind', 'category');
  const note = pickString(item, 'description', 'note', 'comment', 'context');

  if (!symbol && !level && !note) return null;
  return { symbol: symbol || '—', level, type, note };
}

export function extractWatchlistLevelRows(src) {
  if (!src) return [];
  return pickArray(src, 'watchlistLevels').map((item) => normalizeLevelRow(item)).filter(Boolean);
}

export function extractKeyLevelRows(src) {
  if (!src) return [];
  return pickArray(src, 'keyLevels').map((item) => normalizeLevelRow(item)).filter(Boolean);
}

function normalizeSectorRow(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    const t = item.trim();
    return t ? { sector: t, direction: '', relativeStrength: '' } : null;
  }
  if (typeof item !== 'object') return null;

  const sector = pickString(item, 'sector', 'name', 'industry', 'group', 'title');
  const direction = pickString(item, 'direction', 'trend', 'move', 'performance');
  const relativeStrength = pickString(
    item, 'relativeStrength', 'rs', 'strength', 'rank', 'momentum', 'status'
  );

  const sentiment = pickString(item, 'sentiment', 'bias', 'outlook', 'tone');

  if (!sector) {
    const name = pickString(item, 'symbol', 'ticker');
    if (!name) return null;
    return { sector: name, direction, relativeStrength, sentiment };
  }
  return { sector, direction, relativeStrength, sentiment };
}

export function extractSectorRows(src) {
  if (!src) return [];
  const raw = [
    ...pickArray(src, 'sectorRotation', 'sectors', 'sectorPerformance', 'sectorOverview'),
    ...pickArray(src, 'leadingSectors'),
    ...pickArray(src, 'weakestSectors', 'laggingSectors'),
  ];
  const seen = new Set();
  return raw
    .map(normalizeSectorRow)
    .filter((r) => {
      if (!r) return false;
      const sig = r.sector;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
}

export function extractWatchlistRows(src) {
  if (!src) return [];
  const raw = pickArray(src, 'stocksMentioned', 'stocks', 'watchlist', 'tickers');
  return raw.map((item) => {
    if (typeof item === 'string') {
      const t = item.trim();
      return t ? { symbol: t, reason: '', importance: '', catalyst: '', level: '' } : null;
    }
    if (!item || typeof item !== 'object') return null;
    return {
      symbol: pickString(item, 'symbol', 'ticker', 'name', 'stock'),
      reason: pickString(item, 'reason', 'why', 'note', 'thesis', 'status'),
      importance: pickString(item, 'importance', 'priority', 'weight'),
      catalyst: pickString(item, 'catalyst', 'trigger', 'event'),
      level: pickString(item, 'level', 'price', 'target', 'entry'),
    };
  }).filter((r) => r && (r.symbol || r.reason));
}

const TICKER_RE = /\$?([A-Z]{1,5})(?:\.[A-Z])?\b/g;
const NON_TICKER_TOKENS = new Set([
  'CPI', 'PPI', 'NFP', 'FOMC', 'GDP', 'US', 'EU', 'UK', 'AI', 'CEO', 'CFO', 'IPO',
  'FDA', 'SEC', 'ETF', 'RS', 'MA', 'PM', 'AM', 'THE', 'AND', 'FOR', 'VIX',
]);

const CATEGORY_RANK = { opportunity: 4, watchlist: 3, risk: 2, general: 1 };
const CATEGORY_LABELS = {
  opportunity: 'הזדמנות',
  watchlist: 'מעקב',
  risk: 'סיכון',
  general: 'אזכור כללי',
};

function normalizeTicker(raw) {
  const t = String(raw || '').trim().toUpperCase().replace(/^\$/, '');
  if (!t || t.length > 6 || NON_TICKER_TOKENS.has(t)) return '';
  if (!/^[A-Z][A-Z0-9.]{0,5}$/.test(t)) return '';
  return t;
}

function tickersInText(text) {
  if (!text || typeof text !== 'string') return [];
  const found = new Set();
  let m;
  const re = new RegExp(TICKER_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    const t = normalizeTicker(m[1]);
    if (t) found.add(t);
  }
  return [...found];
}

function humanizeSentiment(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (['positive', 'bullish', 'buy', 'long', 'strong', 'up', 'חיובי', 'שורי'].some((x) => s.includes(x))) return 'חיובי';
  if (['negative', 'bearish', 'sell', 'short', 'avoid', 'weak', 'down', 'שלילי', 'דובי'].some((x) => s.includes(x))) return 'שלילי';
  if (['neutral', 'watch', 'hold', 'mixed', 'ניטרלי', 'מעקב'].some((x) => s.includes(x))) return 'ניטרלי';
  return raw.trim();
}

function humanizeActionability(category, item = {}) {
  const action = pickString(item, 'action', 'actionability', 'recommendation', 'stance');
  if (action) return action;
  const importance = pickString(item, 'importance', 'priority');
  if (category === 'opportunity') return importance ? `הזדמנות · ${importance}` : 'הזדמנות';
  if (category === 'watchlist') return importance ? `מעקב · ${importance}` : 'מעקב';
  if (category === 'risk') return 'סיכון / הימנעות';
  return importance || 'אזכור';
}

function mergeContext(a, b) {
  const parts = [a, b].filter(Boolean).map((s) => s.trim());
  const unique = [...new Set(parts)];
  return unique.join(' · ');
}

function stockRecordFromObject(item, category = 'general') {
  if (!item) return null;
  if (typeof item === 'string') {
    const tickers = tickersInText(item);
    const ticker = tickers[0] || normalizeTicker(item);
    if (!ticker) return null;
    const isTickerOnly = item.trim().toUpperCase() === ticker;
    return {
      ticker,
      company: '',
      context: isTickerOnly ? '' : item.trim(),
      sentiment: '',
      category,
      actionability: humanizeActionability(category),
      notes: '',
    };
  }
  if (typeof item !== 'object') return null;

  const ticker = normalizeTicker(
    pickString(item, 'symbol', 'ticker', 'stock', 'title', 'name')
  ) || tickersInText(pickString(item, 'description', 'setup', 'idea'))[0];
  if (!ticker) return null;

  const nameField = pickString(item, 'name');
  const company = pickString(item, 'company', 'nameHebrew', 'companyName')
    || (nameField && normalizeTicker(nameField) !== nameField ? nameField : '');

  return {
    ticker,
    company,
    context: pickString(item, 'reason', 'context', 'why', 'note', 'thesis', 'description', 'status'),
    sentiment: humanizeSentiment(
      pickString(item, 'sentiment', 'bias', 'outlook', 'mood', 'direction')
    ),
    category,
    actionability: humanizeActionability(category, item),
    notes: mergeContext(
      pickString(item, 'catalyst', 'trigger', 'event'),
      pickString(item, 'level', 'price', 'target', 'entry')
    ),
    changePercent: pickString(item, 'changePercent', 'percentChange', 'pct', 'dailyChange'),
  };
}

function upsertStock(map, record) {
  if (!record?.ticker) return;
  const key = record.ticker;
  const prev = map.get(key);
  if (!prev) {
    map.set(key, { ...record });
    return;
  }
  const category =
    (CATEGORY_RANK[record.category] || 0) > (CATEGORY_RANK[prev.category] || 0)
      ? record.category
      : prev.category;
  map.set(key, {
    ticker: key,
    company: prev.company || record.company,
    context: mergeContext(prev.context, record.context),
    sentiment: prev.sentiment || record.sentiment,
    category,
    actionability: humanizeActionability(category, { importance: prev.actionability || record.actionability }),
    notes: mergeContext(prev.notes, record.notes),
    changePercent: prev.changePercent || record.changePercent,
  });
}

/**
 * Unified stock list from all existing specialized + video sources (presentation only).
 */
export function extractUnifiedStocks(marketBriefData, video = null) {
  const manualStocks = marketBriefData?.manualOverrides?.stocksMentioned;
  if (manualStocks?.source === 'manual' && Array.isArray(manualStocks.rows)) {
    return manualStocks.rows
      .map((s) => ({
        ...s,
        categoryLabel: CATEGORY_LABELS[s.category] || CATEGORY_LABELS.general,
      }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  const src = getSpecializedSrc(marketBriefData);
  const map = new Map();

  const ingestList = (items, category) => {
    for (const item of items) {
      const rec = stockRecordFromObject(item, category);
      if (rec) upsertStock(map, rec);
    }
  };

  if (src) {
    ingestList(pickArray(src, 'stocksMentioned', 'stocks', 'watchlist', 'tickers', 'watchlistLevels', 'mentionedStocks', 'topStocks', 'stockPicks'), 'watchlist');
    ingestList(pickArray(src, 'opportunities', 'tradingOpportunities', 'trades', 'breakoutCandidates', 'breakouts', 'swingOpportunities', 'swingTrades'), 'opportunity');
    ingestList(pickArray(src, 'relativeStrengthLeaders', 'rsLeaders', 'momentumLeaders'), 'opportunity');

    for (const risk of extractRiskItems(src)) {
      for (const ticker of tickersInText(risk.text)) {
        upsertStock(map, {
          ticker,
          company: '',
          context: risk.text,
          sentiment: 'שלילי',
          category: 'risk',
          actionability: 'סיכון',
          notes: risk.category || '',
        });
      }
    }

    for (const news of pickArray(src, 'marketNews', 'headlines', 'news')) {
      if (typeof news !== 'string') continue;
      for (const ticker of tickersInText(news)) {
        upsertStock(map, {
          ticker,
          company: '',
          context: news,
          sentiment: '',
          category: 'general',
          actionability: 'אזכור בחדשות',
          notes: '',
        });
      }
    }
  }

  if (video) {
    ingestList(pickArray(video, 'stocksMentioned', 'mentionedStocks', 'tickers'), 'watchlist');
    ingestList(pickArray(video?.analysis, 'stocksMentioned'), 'watchlist');
    ingestList(pickArray(video, 'tradingSetups'), 'opportunity');
  }

  return [...map.values()]
    .map((s) => ({
      ...s,
      categoryLabel: CATEGORY_LABELS[s.category] || CATEGORY_LABELS.general,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function hasUnifiedStocks(marketBriefData, video = null) {
  return extractUnifiedStocks(marketBriefData, video).length > 0;
}

/** Filter flattened market-news strings that duplicate regime card content. */
export function isRegimeDuplicateString(text) {
  if (typeof text !== 'string') return false;
  const regimeKeyPattern = /^(marketTrend|breadth|riskOn|riskOff|riskOnOff|volatility|leadingSector|weakestSector|marketStrength)\s*:/i;
  return regimeKeyPattern.test(text.trim());
}
