import { getWorkspaceItemIdentity, getWorkspaceSourceVideoId } from './workspaceItemIdentity.js';
import { getWorkspaceSectionLabel } from './workspaceVideoGrouping.js';
import {
  WORKSPACE_COLLECTION_HEADINGS,
  classifyWorkspaceItemHeading,
  getWorkspaceNavigationCollectionForItem,
} from '../config/workspaceHeadingRegistry.js';
import { orderSpecializedSections } from '../lib/specializedSectionOrder.js';

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

/**
 * True when a content line is itself just a stray echo of the section
 * heading (e.g. an AI response that repeats "\uD83D\uDCF0 \u05D7\u05D3\u05E9\u05D5\u05EA" as its own first
 * bullet, with no real content) \u2014 such lines are dropped so they don't show
 * up as a duplicate of the card title. See buildTextSections() below.
 *
 * cleanHeading() classifies several canonical headings (\u05D7\u05D3\u05E9\u05D5\u05EA, \u05EA\u05D5\u05D1\u05E0\u05D5\u05EA
 * \u05DE\u05E8\u05DB\u05D6\u05D9\u05D5\u05EA, \u05E1\u05D9\u05DB\u05D5\u05E0\u05D9\u05DD \u05DE\u05E8\u05DB\u05D6\u05D9\u05D9\u05DD, \u05DE\u05E6\u05D1 \u05D4\u05E9\u05D5\u05E7, ...) via `key.includes(...)` substring
 * checks \u2014 correct for short raw heading strings, but far too loose when
 * reused against a full content line: any real sentence that merely
 * mentions one of those keywords once (e.g. a saved news row whose own text
 * is "\u05E2\u05D3\u05DB\u05D5\u05DF \u05D7\u05D3\u05E9\u05D5\u05EA: \u05D4\u05E4\u05D3 \u05D4\u05D5\u05EA\u05D9\u05E8 \u05D0\u05EA \u05D4\u05E8\u05D9\u05D1\u05D9\u05EA \u05DC\u05DC\u05D0 \u05E9\u05D9\u05E0\u05D5\u05D9...") would also match
 * `cleanHeading(line) === heading` and get silently dropped, leaving the
 * section with provenance but zero renderable entries (bug found in live
 * QA: header showed "1 \u05E8\u05E9\u05D5\u05DE\u05D5\u05EA \u05DE\u05E7\u05D5\u05E8", body rendered nothing).
 *
 * The length guard below keeps the original heading-echo behavior (the line
 * is essentially just the heading, nothing else) while excluding any line
 * that merely contains the keyword among substantially more real content.
 */
function isHeadingEchoLine(line, heading) {
  if (cleanHeading(line) !== heading) return false;
  const strip = (value) => normalized(value).replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const strippedLine = strip(line);
  const strippedHeading = strip(heading);
  return strippedLine.length <= strippedHeading.length + 12;
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

function firstSavedText(...values) {
  return values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
}

function savedArray(...values) {
  const candidate = values.find(value => Array.isArray(value) && value.length > 0)
    || values.find(Array.isArray);
  return candidate ? candidate.filter(Boolean) : [];
}

function parseLegacyNewsText(text) {
  const parts = String(text || '').split(/\s+[—–-]\s+/).map(part => part.trim()).filter(Boolean);
  const impactIndex = parts.findIndex(part => /^השפעה\s*:/i.test(part));
  return {
    title: parts[0] || '',
    description: parts.slice(1, impactIndex >= 0 ? impactIndex : 2).join(' — '),
    impact: impactIndex >= 0 ? parts[impactIndex].replace(/^השפעה\s*:\s*/i, '').trim() : '',
  };
}

/** Structured, display-only news entry. Existing persisted records are never rewritten. */
export function buildSavedNewsEntry(item = {}, text = persistedText(item)) {
  const identity = item?.identityPayload && typeof item.identityPayload === 'object'
    ? item.identityPayload
    : {};
  const legacy = parseLegacyNewsText(text);
  const legacyTitle = /^(?:bullish|bearish|neutral|positive|negative|חיובי|שלילי|ניטרלי)$/i.test(legacy.title)
    ? ''
    : legacy.title;
  const sourceVideoTitle = firstSavedText(item.sourceVideoTitle, item.sourceTitle);
  const itemVideoTitle = firstSavedText(item.videoTitle, item.title);
  const compatibleVideoTitle = itemVideoTitle
    && normalized(itemVideoTitle) !== normalized(sourceVideoTitle)
    && !/^\s*(?:📰\s*)?חדשות\s*[—–-]/u.test(itemVideoTitle)
      ? itemVideoTitle
      : '';
  const headline = firstSavedText(item.newsTitle, identity.title, legacyTitle, compatibleVideoTitle)
    || 'פריט חדשות ללא כותרת';
  const description = firstSavedText(
    item.newsDescription,
    identity.description,
    item.newsContent,
    identity.content,
    legacy.description,
  );
  const impact = firstSavedText(item.impact, identity.impact, legacy.impact);
  const sentiment = firstSavedText(item.sentiment, identity.sentiment);
  const symbols = savedArray(item.symbols, item.tickers, identity.symbols, identity.tickers);
  const links = savedArray(item.links, identity.links);
  const sourceMetadata = [item.sourceMetadata, identity.sourceMetadata]
    .find(value => value && typeof value === 'object' && !Array.isArray(value)) || {};
  const fallbackDescription = description || (
    headline === 'פריט חדשות ללא כותרת'
      ? 'לא נשמרו כותרת או תיאור עבור הרשומה הישנה.'
      : 'לא נשמר תיאור עבור פריט חדשות זה.'
  );
  const displayText = text || [headline, fallbackDescription, impact ? `השפעה: ${impact}` : ''].filter(Boolean).join(' — ');

  return {
    text: displayText,
    headline,
    description: fallbackDescription,
    sentiment,
    impact,
    symbols,
    links,
    sourceMetadata,
    rank: persistedRank(item),
    recordIds: [item.id],
    structuredNews: true,
  };
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

export function provenanceFor(item, sectionHeading) {
  const identity = getWorkspaceItemIdentity(item);
  const heading = classifyWorkspaceItemHeading(item);
  return {
    recordId: item.id,
    sourceVideoId: item.sourceVideoId || getWorkspaceSourceVideoId(item),
    sourceTabId: item.sourceTabId || heading?.sourceTabId || null,
    sourceTab: heading?.label || item.sourceTab || item.savedSectionType || item.sectionType || null,
    sourceSectionId: item.sourceSectionId || null,
    sourceSectionHeading: item.sourceHeading || sectionHeading,
    originalItemType: item.originalItemType || item.itemType || null,
    sourceTimestamp: sourceTimestamp(item),
    savedAt: item.savedAt || null,
    contentHash: item.contentHash || identity?.contentHash || null,
    sourceBriefSlug: item.sourceBriefSlug || item.briefSlug || null,
    sourceVideoType: item.sourceVideoType || null,
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
    const isNewsItem = item?.originalItemType === 'market-news';
    let fields = isNewsItem ? [] : labelledFields(item, text);
    if (!isNewsItem && fields.length === 0 && /^(bullish|bearish|neutral|חיובי|שלילי|ניטרלי)$/i.test(text)) {
      fields = [{ label: 'סנטימנט', value: text }];
    }
    if (!text && fields.length === 0 && !isNewsItem && tabId !== 'topics') continue;
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
    if (isNewsItem) {
      const newsEntry = buildSavedNewsEntry(item, text);
      const newsKey = normalized(newsEntry.text);
      if (newsKey && !seenLines.has(newsKey)) section.entries.push(newsEntry);
    }
    for (const line of isNewsItem || fields.length > 0 ? [] : textLines(text)) {
      const lineKey = normalized(line);
      if (!lineKey || isHeadingEchoLine(line, heading) || seenLines.has(lineKey)) continue;
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
  byTab.specialized = orderSpecializedSections(byTab.specialized);
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
