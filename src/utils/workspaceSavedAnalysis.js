import { getWorkspaceItemIdentity, getWorkspaceSourceVideoId } from './workspaceItemIdentity.js';
import { getWorkspaceSectionLabel } from './workspaceVideoGrouping.js';
import {
  WORKSPACE_COLLECTION_HEADINGS,
  classifyWorkspaceItemHeading,
  getWorkspaceNavigationCollectionForItem,
} from '../config/workspaceHeadingRegistry.js';

export const SAVED_ANALYSIS_TABS = [
  ...WORKSPACE_COLLECTION_HEADINGS.map(definition => ({
    id: definition.id,
    label: definition.label,
    emoji: definition.emoji,
  })),
  { id: 'unclassified', label: 'פריטים נוספים', emoji: '📦' },
];

const EMPTY_MESSAGE = 'לא נשמר תוכן מסוג זה';

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase('he').replace(/\s+/g, ' ');
}

function cleanHeading(value) {
  const heading = String(value || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const key = normalized(heading).replace(/[׳״']/g, '');
  if (key.includes('התובנות החשובות ביותר') || key.includes('תובנות מרכזיות')) return 'תובנות מרכזיות';
  if (key.includes('סיכונים מרכזיים') || key === 'סיכונים') return 'סיכונים';
  if (key.includes('צקליסט פעולה')) return 'צ׳קליסט פעולה';
  if (key.includes('סיכום ב-30 שניות') || key.includes('סיכום ב־30 שניות')) return 'סיכום ב־30 שניות';
  if (key.includes('סיכום מלא')) return 'סיכום מלא';
  if (key.includes('מה לעקוב היום')) return 'מה לעקוב היום';
  if (key.includes('מצב השוק')) return 'מצב השוק';
  if (key.includes('חדשות')) return 'חדשות';
  if (key === 'סיכום') return 'סיכום';
  return heading || 'תוכן שמור';
}

function headingIcon(value) {
  return String(value || '').match(/\p{Extended_Pictographic}(?:\uFE0F)?/u)?.[0] || null;
}

function persistedText(item) {
  const identity = item?.identityPayload;
  const app = item?.appPayload || item?.appBrief;
  const candidates = [
    item?.rawSourceText, item?.fullNotes, item?.savedText, item?.text, item?.notes,
    identity?.text, identity?.lesson, identity?.insight, identity?.content,
    app?.description, app?.sourceInsight, app?.valueProposition,
  ];
  return String(candidates.find(value => typeof value === 'string' && value.trim()) || '').trim();
}

function sourceTimestamp(item) {
  return item?.timestamp ?? item?.startTime ?? item?.segmentStart ?? item?.sourceTimestamp ?? null;
}

function persistedRank(item) {
  const value = item?.identityPayload?.rank ?? item?.rank ?? item?.priorityOrder ?? null;
  const rank = Number(value);
  return Number.isInteger(rank) && rank > 0 ? rank : null;
}

function textLines(text) {
  return String(text || '').split(/\r?\n+/).map(line => line.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
}

const FIELD_LABELS = {
  lesson: 'לקח', whyimportant: 'למה זה חשוב', why_it_matters: 'למה זה חשוב', category: 'קטגוריה',
  tickers: 'טיקרים קשורים', sourceinsight: 'תובנת מקור', valueproposition: 'הצעת ערך',
  corecomponents: 'רכיבים מרכזיים', mvpscope: 'היקף MVP', featurename: 'שם היכולת',
  label: 'מדד', value: 'ערך', sentiment: 'סנטימנט', reason: 'הסבר', direction: 'מגמה',
  currentvalue: 'ערך נוכחי', change: 'שינוי', note: 'הערה',
};

function labelledFields(item, text) {
  const source = [item?.identityPayload, item?.appPayload, item?.appBrief].find(value => value && typeof value === 'object') || {};
  const fields = Object.entries(source).flatMap(([key, value]) => {
    const label = FIELD_LABELS[normalized(key).replace(/[^a-z_]/g, '')];
    if (!label || value == null || value === '') return [];
    return [{ label, value: Array.isArray(value) ? value.join(', ') : String(value) }];
  });
  if (fields.length > 0) return fields;
  const parts = String(text || '').split(/\s*\|\s*/);
  if (parts.length < 2 || !parts.every(part => part.includes(':'))) return [];
  return parts.flatMap(part => {
    const separator = part.indexOf(':');
    const key = normalized(part.slice(0, separator)).replace(/[^a-z_]/g, '');
    const value = part.slice(separator + 1).trim();
    return FIELD_LABELS[key] && value ? [{ label: FIELD_LABELS[key], value }] : [];
  });
}

function provenanceFor(item, sectionHeading) {
  const identity = getWorkspaceItemIdentity(item);
  const heading = classifyWorkspaceItemHeading(item);
  return {
    recordId: item.id,
    sourceVideoId: item.sourceVideoId || getWorkspaceSourceVideoId(item),
    sourceTabId: item.sourceTabId || heading?.sourceTabId || null,
    sourceTab: heading?.label || item.sourceTab || item.savedSectionType || item.sectionType || null,
    sourceSectionId: item.sourceSectionId || null,
    sourceSectionHeading: item.sourceHeading || sectionHeading,
    originalItemType: item.itemType || null,
    sourceTimestamp: sourceTimestamp(item),
    savedAt: item.savedAt || null,
    contentHash: item.contentHash || identity?.contentHash || null,
  };
}

function buildTextSections(items) {
  const sectionMap = new Map();
  for (const item of items) {
    if (item?.itemType === 'structured-snapshot' && item?.structuredSnapshot) continue;
    const rawHeading = item.sourceHeading || getWorkspaceSectionLabel(item, 'other');
    const heading = cleanHeading(rawHeading);
    const tabId = getWorkspaceNavigationCollectionForItem(item, 'unclassified');
    const text = persistedText(item);
    let fields = labelledFields(item, text);
    if (fields.length === 0 && /^(bullish|bearish|neutral|חיובי|שלילי|ניטרלי)$/i.test(text)) fields = [{ label: 'סנטימנט', value: text }];
    if (!text && fields.length === 0 && tabId !== 'topics') continue;
    const key = `${tabId}|${normalized(heading)}`;
    const section = sectionMap.get(key) || {
      id: key,
      tabId,
      heading,
      icon: headingIcon(rawHeading),
      entries: [],
      fields: [],
      provenance: [],
    };
    const provenance = provenanceFor(item, rawHeading);
    section.provenance.push(provenance);

    const seenLines = new Set(section.entries.map(entry => normalized(entry.text)));
    for (const line of fields.length > 0 ? [] : textLines(text)) {
      const lineKey = normalized(line);
      if (!lineKey || cleanHeading(line) === heading || seenLines.has(lineKey)) continue;
      seenLines.add(lineKey);
      section.entries.push({ text: line, rank: persistedRank(item), recordIds: [item.id] });
    }
    const seenFields = new Set(section.fields.map(field => `${field.label}|${normalized(field.value)}`));
    for (const field of fields) {
      const fieldKey = `${field.label}|${normalized(field.value)}`;
      if (!seenFields.has(fieldKey)) { seenFields.add(fieldKey); section.fields.push({ ...field, recordIds: [item.id] }); }
    }
    sectionMap.set(key, section);
  }
  return [...sectionMap.values()];
}

function buildSnapshots(videoGroup) {
  return videoGroup.versions.filter(version => (
    version.canonical?.itemType === 'structured-snapshot' && version.canonical?.structuredSnapshot
  )).map(version => ({
    id: version.contentKey,
    tabId: 'specialized',
    heading: 'תמונת מצב',
    snapshot: version.canonical.structuredSnapshot,
    copyCount: version.copyCount,
    provenance: version.records.map(item => provenanceFor(item, 'תמונת מצב')),
  }));
}

export function selectSavedAnalysisViewer(videoGroup) {
  const items = Array.isArray(videoGroup?.items) ? videoGroup.items : [];
  const textSections = buildTextSections(items);
  const snapshotSections = videoGroup ? buildSnapshots(videoGroup) : [];
  const sections = [...textSections, ...snapshotSections];
  const byTab = Object.fromEntries(SAVED_ANALYSIS_TABS.map(tab => [tab.id, sections.filter(section => section.tabId === tab.id)]));
  return {
    tabs: SAVED_ANALYSIS_TABS.map(tab => ({ ...tab, count: byTab[tab.id].length })),
    byTab,
    emptyMessage: EMPTY_MESSAGE,
    persistedRecordIds: items.map(item => item.id),
    renderedRecordIds: [...new Set(sections.flatMap(section => section.provenance.map(entry => entry.recordId)))],
  };
}

export function selectSavedAnalysisSections(viewer, activeCollection = null) {
  const collectionId = activeCollection || 'all';
  if (collectionId === 'all') {
    return {
      collectionId,
      sections: viewer.tabs.flatMap(tab => viewer.byTab[tab.id] || []),
    };
  }
  return {
    collectionId,
    sections: viewer.byTab[collectionId] || [],
  };
}
