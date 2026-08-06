/**
 * Manual override layer for Morning Brief structured sections (presentation + persistence).
 * Stored on marketBriefData.manualOverrides — non-destructive; AI re-analysis preserves overrides.
 */

import {
  extractCalendarRows,
  extractMacroIndicatorRows,
  extractMarketDashboardRows,
  extractMarketRegimeCards,
  extractOpportunityIdeas,
  extractRiskItems,
  extractSectorRows,
  extractUnifiedStocks,
  getSpecializedSrc,
} from '@/lib/morningBriefDisplay';

export const BRIEF_MANUAL_SECTION_IDS = {
  news: 'news',
  marketRegime: 'marketRegime',
  sectors: 'sectors',
  opportunitiesRisks: 'opportunitiesRisks',
  stocksMentioned: 'stocksMentioned',
  economicCalendar: 'economicCalendar',
  macro: 'macro',
  markets: 'markets',
};

export const SECTION_EDIT_COLUMNS = {
  economicCalendar: [
    { key: 'event', label: 'אירוע' },
    { key: 'date', label: 'תאריך' },
    { key: 'importance', label: 'חשיבות' },
    { key: 'type', label: 'סוג' },
    { key: 'impact', label: 'השפעה' },
  ],
  macro: [
    { key: 'indicator', label: 'אינדיקטור' },
    { key: 'actualValue', label: 'נתון בפועל' },
    { key: 'change', label: 'שינוי' },
    { key: 'frequency', label: 'תדירות' },
    { key: 'description', label: 'תיאור' },
    { key: 'impact', label: 'השפעה' },
  ],
  markets: [
    { key: 'asset', label: 'נכס' },
    { key: 'trend', label: 'מגמה' },
    { key: 'strength', label: 'חוזק' },
    { key: 'comment', label: 'הערה' },
  ],
  stocksMentioned: [
    { key: 'ticker', label: 'טיקר' },
    { key: 'company', label: 'חברה' },
    { key: 'context', label: 'הקשר' },
    { key: 'sentiment', label: 'סנטימנט' },
    { key: 'notes', label: 'הערות' },
  ],
  sectors: [
    { key: 'sector', label: 'סקטור' },
    { key: 'direction', label: 'כיוון' },
    { key: 'relativeStrength', label: 'חוזק יחסי' },
  ],
  news: [
    { key: 'text', label: 'כותרת / תוכן' },
  ],
  marketRegime: [
    { key: 'label', label: 'שדה' },
    { key: 'value', label: 'ערך' },
  ],
  opportunities: [
    { key: 'title', label: 'כותרת' },
    { key: 'detail', label: 'פירוט' },
    { key: 'kind', label: 'סוג' },
  ],
  risks: [
    { key: 'text', label: 'סיכון' },
    { key: 'category', label: 'קטגוריה' },
  ],
};

export function getManualSectionOverride(marketBriefData, sectionId) {
  const ov = marketBriefData?.manualOverrides?.[sectionId];
  if (!ov || ov.source !== 'manual') return null;
  return ov;
}

export function getManualSectionSource(marketBriefData, sectionId) {
  return getManualSectionOverride(marketBriefData, sectionId) ? 'manual' : 'ai';
}

export function buildMarketBriefWithSectionOverride(marketBriefData, sectionId, payload) {
  const rows = Array.isArray(payload) ? payload : (payload?.rows ?? []);
  const sectionData = sectionId === BRIEF_MANUAL_SECTION_IDS.opportunitiesRisks
    ? {
        source: 'manual',
        updatedAt: new Date().toISOString(),
        rows: {
          opportunities: payload?.opportunities ?? [],
          risks: payload?.risks ?? [],
        },
      }
    : {
        source: 'manual',
        updatedAt: new Date().toISOString(),
        rows: sectionId === BRIEF_MANUAL_SECTION_IDS.macro
          ? normalizeMacroManualRows(rows)
          : rows,
      };

  return {
    ...marketBriefData,
    manualOverrides: {
      ...(marketBriefData?.manualOverrides || {}),
      [sectionId]: sectionData,
    },
  };
}

function parseManualNumericValue(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

export function normalizeMacroManualRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    actualValue: parseManualNumericValue(row?.actualValue),
    manualOverrideFields: Array.from(new Set([...(row?.manualOverrideFields || []), 'actualValue'])),
  }));
}

export function readPersistedMarketBriefData(videoId) {
  if (!videoId) return null;
  try {
    const raw = localStorage.getItem(`market_brief_${videoId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function buildMarketBriefWithFieldOverride(
  marketBriefData,
  sectionId,
  rowId,
  field,
  value,
) {
  const current = marketBriefData?.manualOverrides?.[sectionId] || {};
  const fieldOverrides = { ...(current.fieldOverrides || {}) };
  const rowOverrides = { ...(fieldOverrides[rowId] || {}) };

  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    delete rowOverrides[field];
  } else {
    rowOverrides[field] = value;
  }

  if (Object.keys(rowOverrides).length) fieldOverrides[rowId] = rowOverrides;
  else delete fieldOverrides[rowId];

  const manualOverrides = { ...(marketBriefData?.manualOverrides || {}) };
  if (!Object.keys(fieldOverrides).length && !Array.isArray(current.rows)) {
    delete manualOverrides[sectionId];
  } else {
    manualOverrides[sectionId] = {
      ...current,
      source: 'manual',
      updatedAt: new Date().toISOString(),
      fieldOverrides,
    };
  }

  return {
    ...marketBriefData,
    manualOverrides,
  };
}

export function normalizeStockManualFieldValue(field, input) {
  const value = typeof input === 'string' ? input.trim() : input;
  if (value === '' || value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (field === 'changePercent') {
    const text = String(value);
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(text)) {
      return { ok: false, error: 'יש להזין שינוי מספרי תקין, לדוגמה ‎-5.9%' };
    }
    return { ok: true, value: text };
  }
  const limits = { sector: 80, notes: 500 };
  const limit = limits[field] || 200;
  const text = String(value);
  if (text.length > limit) {
    return { ok: false, error: `הערך ארוך מדי (עד ${limit} תווים)` };
  }
  return { ok: true, value: text };
}

export function persistMarketBriefData(videoId, data, patchVideo) {
  let directStorageSaved = !videoId;
  let directStorageError = null;
  if (videoId) {
    try {
      localStorage.setItem(`market_brief_${videoId}`, JSON.stringify(data));
      directStorageSaved = true;
    } catch (e) {
      directStorageError = e;
      console.warn('[manualBriefOverrides] localStorage save failed:', e?.message);
    }
  }
  let patchResult = null;
  if (typeof patchVideo === 'function') {
    patchResult = patchVideo({ marketBriefData: data });
  }
  if (!directStorageSaved && !patchResult) {
    throw directStorageError || new Error('Manual override persistence failed');
  }
  return data;
}

/** Keep manual overrides when new GEM JSON is applied. */
export function preserveManualOverridesOnReanalysis(existingData, newParsed) {
  if (!existingData?.manualOverrides) return newParsed;
  return {
    ...newParsed,
    manualOverrides: existingData.manualOverrides,
  };
}

function normalizeNewsRow(item) {
  if (typeof item === 'string') return { text: item.trim() };
  if (item && typeof item === 'object') {
    return { text: String(item.text || item.headline || item.title || '').trim() };
  }
  return { text: String(item || '').trim() };
}

/** Rows for edit grid — manual override or current AI display shape. */
export function getEditableRowsForSection(marketBriefData, effectiveVideo, sectionId, newsItems = []) {
  const manual = getManualSectionOverride(marketBriefData, sectionId);
  if (manual) {
    if (sectionId === BRIEF_MANUAL_SECTION_IDS.opportunitiesRisks) {
      return {
        opportunities: manual.rows?.opportunities ?? [],
        risks: manual.rows?.risks ?? [],
      };
    }
    if (Array.isArray(manual.rows)) return manual.rows;
  }

  const src = getSpecializedSrc(marketBriefData);

  switch (sectionId) {
    case BRIEF_MANUAL_SECTION_IDS.economicCalendar:
      return extractCalendarRows(src);
    case BRIEF_MANUAL_SECTION_IDS.macro:
      return extractMacroIndicatorRows(src);
    case BRIEF_MANUAL_SECTION_IDS.markets:
      return extractMarketDashboardRows(src);
    case BRIEF_MANUAL_SECTION_IDS.stocksMentioned:
      return extractUnifiedStocks(marketBriefData, effectiveVideo);
    case BRIEF_MANUAL_SECTION_IDS.sectors:
      return extractSectorRows(src);
    case BRIEF_MANUAL_SECTION_IDS.marketRegime:
      return extractMarketRegimeCards(src);
    case BRIEF_MANUAL_SECTION_IDS.news:
      return (Array.isArray(newsItems) ? newsItems : [])
        .filter(Boolean)
        .map(normalizeNewsRow);
    case BRIEF_MANUAL_SECTION_IDS.opportunitiesRisks:
      return {
        opportunities: extractOpportunityIdeas(src),
        risks: extractRiskItems(src),
      };
    default:
      return [];
  }
}

export function cloneEditableRows(rows) {
  return JSON.parse(JSON.stringify(rows ?? []));
}

export function emptyRowForColumns(columns) {
  const row = {};
  for (const col of columns) row[col.key] = '';
  return row;
}
