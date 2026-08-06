/**
 * Section-aware extraction for universalTabs object/array shapes.
 * Preserves section titles → bullet items (no GEM output mutation).
 */
import { extractVideoTabItems } from '@/config/videoTabsConfig';
import { formatStockStatusText } from '@/lib/stockStatusDisplay';
import { normalizeConclusionText, resolveSummaryConclusion } from '@/lib/summaryConclusionResolver';
import { formatMarketStateItem, formatSummaryMarketItem } from '@/lib/summaryItemDisplay';
import { resolveInsightDisplay } from '@/lib/insightDisplay';

const TAB_UT_KEYS = {
  summary: 'summary',
  insights: 'insights',
  'useful-knowledge': 'usefulKnowledge',
  'topics-subtopics': 'topicsSubtopics',
  'app-builder': 'appBuilder',
};

const OBJECT_FIELD_LABELS = {
  summary: {
    shortSummary: 'סיכום קצר',
    fullSummary: 'סיכום מלא',
    marketMood: 'מצב שוק',
    mainConclusion: 'מסקנה מרכזית',
    topTakeaways: 'נקודות עיקריות',
    importantWarnings: 'אזהרות חשובות',
    keyOpportunities: 'הזדמנויות מרכזיות',
  },
  insights: {
    top5Insights: 'תובנות מרכזיות',
    learningInsights: 'תובנות לימוד',
    marketLessons: 'לקחי שוק',
    tradingInsights: 'תובנות מסחר',
    conclusions: 'מסקנות',
  },
  usefulKnowledge: {
    reusableKnowledge: 'ידע לשימוש חוזר',
    actionChecklist: 'צ\'קליסט פעולה',
    keyTakeaways: 'נקודות מפתח',
    riskManagement: 'ניהול סיכונים',
    mistakesToAvoid: 'טעויות להימנע',
    rules: 'כללים',
  },
  topicsSubtopics: {
    tags: 'תגיות',
    obsidianTopics: 'נושאי Obsidian',
    relatedTopics: 'נושאים קשורים',
    suggestedSubTopics: 'הצעות תתי-נושא',
  },
  appBuilder: {
    kpiList: 'מדדי KPI',
    dataPoints: 'נקודות נתונים',
    dashboards: 'דשבורדים',
    dashboardUpdates: 'עדכוני דשבורד',
    prompts: 'פרומפטים',
    alerts: 'התראות',
    newIndicators: 'אינדיקטורים חדשים',
    screeningCriteria: 'קריטריוני סינון',
    dataFields: 'שדות נתונים',
    suggestedFeatures: 'פיצ\'רים מוצעים',
    componentSuggestions: 'הצעות קומפוננטות',
  },
};

function coerceDisplayText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function formatObjectLine(obj, tabValue = '') {
  if (tabValue === 'insights') {
    const insightDisplay = resolveInsightDisplay(obj);
    if (insightDisplay.recognized) return insightDisplay.text;
  }
  const marketStateLine = tabValue === 'summary' ? formatMarketStateItem(obj) : '';
  if (marketStateLine) return marketStateLine;
  const summaryMarketLine = tabValue === 'summary' ? formatSummaryMarketItem(obj) : '';
  if (summaryMarketLine) return summaryMarketLine;
  const stockLine = formatStockStatusText(obj);
  if (stockLine) return stockLine;
  if (!obj || typeof obj !== 'object') return coerceDisplayText(obj);
  const text = coerceDisplayText(
    obj.text || obj.insight || obj.point || obj.content || obj.summary ||
    obj.title || obj.name || obj.rule || obj.description || ''
  );
  if (text) return text;
  const parts = Object.entries(obj)
    .filter(([, v]) => v != null && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${v}`)
    .filter(Boolean);
  return parts.join(' | ');
}

function shouldPreserveEvidenceObject(value, tabValue, line) {
  return Boolean(
    line
    && (tabValue === 'insights' || tabValue === 'useful-knowledge')
    && value
    && typeof value === 'object'
    && ['startSeconds', 'endSeconds', 'timestampSource', 'timestampConfidence'].some((key) => (
      Object.prototype.hasOwnProperty.call(value, key)
    ))
  );
}

/** Flatten one JSON value into display strings (no section titles). */
export function valueToDisplayItems(val, tabValue = '') {
  if (val == null) return [];
  if (typeof val === 'string') {
    const t = val.trim();
    return t ? [t] : [];
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    return [String(val)];
  }
  if (Array.isArray(val)) {
    return val.flatMap((entry) => valueToDisplayItems(entry, tabValue));
  }
  if (typeof val === 'object') {
    if (Array.isArray(val.items)) {
      return val.items.flatMap((child) => valueToDisplayItems(child, tabValue));
    }
    if (Array.isArray(val.bullets)) {
      return val.bullets.flatMap((child) => valueToDisplayItems(child, tabValue));
    }
    if (Array.isArray(val.points)) {
      return val.points.flatMap((child) => valueToDisplayItems(child, tabValue));
    }
    const line = formatObjectLine(val, tabValue);
    if (shouldPreserveEvidenceObject(val, tabValue, line)) return [{ ...val, text: line }];
    return line ? [line] : [];
  }
  return [];
}

function getUtRaw(marketBriefData, tabValue) {
  const ut = marketBriefData?.universalTabs;
  if (!ut) return undefined;
  if (tabValue === 'app-builder') {
    return ut.app || ut.appBuilder;
  }
  const key = TAB_UT_KEYS[tabValue];
  return key ? ut[key] : undefined;
}

function sectionsFromObject(obj, fieldLabels, tabValue) {
  const sections = [];
  for (const [fieldKey, label] of Object.entries(fieldLabels)) {
    const items = valueToDisplayItems(obj[fieldKey], tabValue);
    if (items.length > 0) {
      sections.push({ key: fieldKey, label, items });
    }
  }
  return sections;
}

function sectionsFromArray(raw, tabValue) {
  const sections = [];
  const flatItems = [];

  for (const entry of raw) {
    if (entry && typeof entry === 'object' && Array.isArray(entry.items)) {
      const label = (entry.title || entry.label || entry.name || entry.section || 'סעיף').trim();
      const items = valueToDisplayItems(entry.items, tabValue);
      if (items.length > 0) sections.push({ key: label, label, items });
      continue;
    }
    flatItems.push(...valueToDisplayItems(entry, tabValue));
  }

  if (sections.length > 0) {
    if (flatItems.length > 0) {
      sections.push({ key: '__flat', label: 'נוספים', items: flatItems });
    }
    return sections;
  }
  return null;
}

/**
 * @returns {{ mode: 'sections', sections: Array<{key,label,items}> } | { mode: 'flat', items: string[] } | null}
 */
export function extractUniversalTabContent(_video, tabValue, marketBriefData) {
  const raw = getUtRaw(marketBriefData, tabValue);
  const resolvedConclusion = tabValue === 'summary'
    ? resolveSummaryConclusion({ video: _video, marketBriefData })
    : null;
  if (raw == null) {
    return resolvedConclusion?.text
      ? { mode: 'sections', sections: [{ key: 'mainConclusion', label: 'מסקנה מרכזית', items: [resolvedConclusion.text] }] }
      : null;
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const nested = sectionsFromArray(raw, tabValue);
    if (nested?.length) {
      if (resolvedConclusion?.text) {
        const conclusionKey = normalizeConclusionText(resolvedConclusion.text);
        const exists = nested.some((section) => (
          section.items.some((item) => normalizeConclusionText(item) === conclusionKey)
        ));
        if (!exists) {
          nested.push({ key: 'mainConclusion', label: 'מסקנה מרכזית', items: [resolvedConclusion.text] });
        }
      }
      return { mode: 'sections', sections: nested };
    }
    const items = raw.flatMap((e) => valueToDisplayItems(e, tabValue));
    if (resolvedConclusion?.text) {
      const conclusionKey = normalizeConclusionText(resolvedConclusion.text);
      const exists = items.some((item) => normalizeConclusionText(item) === conclusionKey);
      if (!exists) {
        return {
          mode: 'sections',
          sections: [
            { key: '__flat', label: 'סיכום', items },
            { key: 'mainConclusion', label: 'מסקנה מרכזית', items: [resolvedConclusion.text] },
          ],
        };
      }
    }
    return items.length ? { mode: 'flat', items } : null;
  }

  if (typeof raw === 'object') {
    const labels = OBJECT_FIELD_LABELS[TAB_UT_KEYS[tabValue]] || OBJECT_FIELD_LABELS[tabValue === 'app-builder' ? 'appBuilder' : ''];
    if (labels) {
      const sections = sectionsFromObject(raw, labels, tabValue);
      if (
        resolvedConclusion?.text
        && resolvedConclusion.sourcePath !== 'marketBriefData.universalTabs.summary.mainConclusion'
      ) {
        sections.push({ key: 'mainConclusion', label: 'מסקנה מרכזית', items: [resolvedConclusion.text] });
      }
      if (sections.length > 0) {
        return { mode: 'sections', sections };
      }
    }
    const items = valueToDisplayItems(raw, tabValue);
    return items.length ? { mode: 'flat', items } : null;
  }

  const items = valueToDisplayItems(raw, tabValue);
  return items.length ? { mode: 'flat', items } : null;
}

/** Legacy flat list — used when section extractor returns null. */
export function extractUniversalTabFlatItems(video, tabValue, marketBriefData) {
  return extractVideoTabItems(video, tabValue, marketBriefData);
}

export function logUniversalTabExtractShape(tabValue, shaped, marketBriefData) {
  if (!import.meta.env.DEV) return;
  const raw = getUtRaw(marketBriefData, tabValue);
  const itemCount = shaped?.mode === 'sections'
    ? shaped.sections.reduce((sum, s) => sum + s.items.length, 0)
    : (shaped?.items?.length ?? 0);
  console.log('[UniversalTabDepth:shape]', {
    tab: tabValue,
    rawType: Array.isArray(raw) ? 'array' : typeof raw,
    rawPreview: raw != null ? JSON.stringify(raw).slice(0, 800) : null,
    mode: shaped?.mode ?? 'fallback',
    sectionCount: shaped?.sections?.length ?? 0,
    itemCount,
    sections: shaped?.mode === 'sections'
      ? shaped.sections.map((s) => ({ label: s.label, count: s.items.length, sample: s.items[0] }))
      : undefined,
  });
}
