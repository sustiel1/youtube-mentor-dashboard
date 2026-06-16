import { formatStockStatusText } from './stockStatusDisplay';

/** Merge shared bulk handlers (quick save, toggle) with row-specific overrides. */
export function mergeBulkSelection(base, overrides = {}) {
  if (!base && !Object.keys(overrides).length) return null;
  return { ...(base || {}), ...overrides };
}

/** Format a tab item to plain text (mirrors LearningTabContent.formatItem). */
export function formatBulkItemText(item) {
  const stockLine = formatStockStatusText(item);
  if (stockLine) return stockLine;
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return String(item ?? '').trim();
  const nested = item.items || item.bullets || item.points;
  if (Array.isArray(nested) && nested.length > 0) {
    const title = (item.title || item.label || item.name || '').trim();
    const body = nested
      .map((child) => formatBulkItemText(child))
      .filter(Boolean)
      .map((line) => `• ${line}`)
      .join('\n');
    if (title && body) return `${title}\n${body}`;
    if (body) return body;
  }
  const text = (
    item.text || item.title || item.content || item.summary || item.point ||
    item.name || item.rule || item.description || item.insight || item.fact ||
    item.definition || item.setup || item.pattern || ''
  ).trim();
  if (text) return text;
  const val = Object.values(item).find((v) => typeof v === 'string' && v.trim());
  return val ? val.trim() : '';
}

/**
 * Build bulk-selection entries from tab sections.
 * @param {Array<{key,label,items,tabKey?}>} sections
 * @param {string} tabScope - universal tab value (e.g. useful-knowledge)
 * @param {string} [idPrefix] - defaults to tabScope
 */
export function buildBulkItemsFromSections(sections = [], tabScope, idPrefix = tabScope) {
  const out = [];
  sections.forEach(({ key, label, items, tabKey }) => {
    const sourceTab = tabKey || tabScope;
    const list = Array.isArray(items) ? items : [];
    list.map(formatBulkItemText).filter(Boolean).forEach((text, i) => {
      out.push({
        id: `${idPrefix}:${key || sourceTab}:${i}`,
        text,
        sectionLabel: label || '',
        type: sourceTab,
        tabScope,
      });
    });
  });
  return out;
}

/** Format a whole card for save/bulk (title + bullet lines). */
export function formatCardBulkText(title, items = []) {
  const titleLine = String(title || '').trim();
  const lines = (Array.isArray(items) ? items : [])
    .map(formatBulkItemText)
    .filter(Boolean);
  if (!titleLine && lines.length === 0) return '';
  if (lines.length === 0) return titleLine;
  const body = lines.map((line) => `• ${line}`).join('\n');
  return titleLine ? `${titleLine}\n\n${body}` : body;
}

/**
 * Human-readable markdown for section clipboard copy (RTL-friendly plain text).
 * @param {string} title
 * @param {unknown[]} [items]
 * @param {{ copyText?: string, groups?: Array<{ label: string, items: unknown[] }> }} [options]
 */
export function formatSectionCopyText(title, items = [], options = {}) {
  if (options.copyText) return String(options.copyText).trim();

  const cleanTitle = String(title || '').trim().replace(/^#+\s*/, '');
  const header = cleanTitle ? `## ${cleanTitle}` : '';

  if (Array.isArray(options.groups) && options.groups.length > 0) {
    const body = options.groups
      .map(({ label, items: groupItems }) => {
        const sub = String(label || '').trim().replace(/^#+\s*/, '');
        const lines = (Array.isArray(groupItems) ? groupItems : [])
          .map(formatBulkItemText)
          .filter(Boolean);
        if (!sub || lines.length === 0) return '';
        return `### ${sub}\n${lines.join('\n')}`;
      })
      .filter(Boolean)
      .join('\n\n');
    return [header, body].filter(Boolean).join('\n\n').trim();
  }

  const lines = (Array.isArray(items) ? items : [])
    .map(formatBulkItemText)
    .filter(Boolean);
  if (!lines.length && !header) return '';
  return [header, lines.join('\n')].filter(Boolean).join('\n\n').trim();
}

/** Markdown copy from card-level save text (title + optional • bullets). */
export function formatSectionCopyFromCardText(title, cardText) {
  const raw = String(cardText || '').trim();
  if (!raw) return formatSectionCopyText(title, []);
  const chunks = raw.split('\n\n');
  const first = chunks[0]?.trim() || String(title || '').trim();
  const bodyLines = (chunks.slice(1).join('\n\n') || '')
    .split('\n')
    .map((line) => line.replace(/^•\s*/, '').trim())
    .filter(Boolean);
  const sectionTitle = String(title || first).trim();
  if (bodyLines.length === 0) return formatSectionCopyText(sectionTitle, [first]);
  return formatSectionCopyText(sectionTitle, bodyLines);
}

/** One bulk entry per top-level card (section shell). */
export function buildCardBulkItem({
  cardId,
  title,
  items = [],
  tabScope,
  type,
  sectionLabel,
}) {
  const text = formatCardBulkText(title, items);
  if (!text || !cardId) return null;
  const sourceTab = type || tabScope;
  return {
    id: `${tabScope}:card:${cardId}`,
    text,
    sectionLabel: sectionLabel || title || '',
    type: sourceTab,
    tabScope,
    isCard: true,
  };
}

/** Build card-level bulk entries from section defs (one card per section). */
export function buildCardBulkItemsFromSections(sections = [], tabScope, idPrefix = tabScope) {
  return sections
    .map(({ key, label, items, tabKey }) => buildCardBulkItem({
      cardId: key,
      title: label,
      items,
      tabScope: idPrefix,
      type: tabKey || tabScope,
      sectionLabel: label || '',
    }))
    .filter(Boolean);
}

/** Flat string list → bulk entries. */
export function buildBulkItemsFromTexts(texts = [], { tabScope, sectionLabel = '', type, idPrefix }) {
  const prefix = idPrefix || tabScope;
  const sourceTab = type || tabScope;
  return texts
    .map(formatBulkItemText)
    .filter(Boolean)
    .map((text, i) => ({
      id: `${prefix}:${i}`,
      text,
      sectionLabel,
      type: sourceTab,
      tabScope,
    }));
}

/** Flatten market status object into selectable text lines (presentation only). */
export function flattenMarketStatusItems(status) {
  if (!status) return [];
  const out = [];
  if (Array.isArray(status.factors)) {
    status.factors.forEach((f) => {
      const t = String(f ?? '').trim();
      if (t) out.push(t);
    });
  }
  const explanation = String(status.explanation ?? '').trim();
  const tone = String(status.tone ?? '').trim();
  if (explanation && explanation !== tone && !out.includes(explanation)) {
    out.push(explanation);
  }
  if (out.length === 0 && tone) out.push(tone);
  return out;
}

/** Summary briefing cards → bulk entries (matches SummaryBriefingView idPrefix keys). */
export function buildSummaryBriefingBulkItems(briefing) {
  if (!briefing) return [];
  const sections = [
    { key: 'thirty', label: 'סיכום ב-30 שניות', items: briefing.thirtySecond || [], tabKey: 'summary' },
    { key: 'market', label: 'מצב השוק', items: flattenMarketStatusItems(briefing.marketStatus), tabKey: 'summary' },
    { key: 'watch', label: 'מה לעקוב היום', items: briefing.watchToday || [], tabKey: 'summary' },
    { key: 'insights', label: 'תובנות מרכזיות', items: briefing.keyInsights || [], tabKey: 'summary' },
    { key: 'risks', label: 'סיכונים', items: briefing.keyRisks || [], tabKey: 'summary' },
    { key: 'checklist', label: 'צ\'קליסט פעולה', items: briefing.actionChecklist || [], tabKey: 'summary' },
  ].filter((s) => Array.isArray(s.items) && s.items.length > 0);
  return buildBulkItemsFromSections(sections, 'summary');
}

/** Summary briefing top cards → one bulk entry per card shell. */
export function buildSummaryBriefingCardBulkItems(briefing) {
  if (!briefing) return [];
  const cards = [
    { key: 'thirty', label: '🚀 סיכום ב-30 שניות', items: briefing.thirtySecond || [] },
    { key: 'market', label: '🌡️ מצב השוק', items: flattenMarketStatusItems(briefing.marketStatus) },
    { key: 'watch', label: '🎯 מה לעקוב היום', items: briefing.watchToday || [] },
    { key: 'insights', label: '💡 התובנות החשובות ביותר', items: briefing.keyInsights || [] },
    { key: 'risks', label: '⚠️ סיכונים מרכזיים', items: briefing.keyRisks || [] },
    { key: 'checklist', label: '📋 צ\'קליסט פעולה', items: briefing.actionChecklist || [] },
    ...(briefing.fullSummaryText
      ? [{ key: 'full', label: '📝 סיכום מלא', items: [briefing.fullSummaryText] }]
      : []),
  ].filter((c) => Array.isArray(c.items) && c.items.length > 0);
  return buildCardBulkItemsFromSections(
    cards.map((c) => ({ ...c, tabKey: 'summary' })),
    'summary',
  );
}

/** Political summary sections → bulk entries (matches summary tab political cards). */
export function buildPoliticalSummaryBulkItems(ps) {
  if (!ps) return [];
  const sections = [
    { k: 'shortSummary', l: 'תקציר קצר', c: ps.shortSummary },
    { k: 'mainClaim', l: 'הטענה המרכזית', c: ps.mainClaim },
    { k: 'keyPoints', l: 'נקודות מרכזיות', c: ps.keyPoints },
    { k: 'supportingArguments', l: 'טיעונים בעד', c: ps.supportingArguments },
    { k: 'weaknesses', l: 'נקודות חולשה', c: ps.weaknessesAndCounterpoints },
    { k: 'usefulQuotes', l: 'ציטוטים חזקים', c: ps.usefulQuotes },
    { k: 'bottomLine', l: 'שורה תחתונה', c: ps.bottomLine },
    { k: 'context', l: 'הקשר', c: ps.context },
    { k: 'conclusion', l: 'מסקנה', c: ps.conclusion },
    { k: 'implications', l: 'השלכות', c: ps.implications },
  ].filter((s) => s.c && (typeof s.c === 'string' ? s.c.trim() : (Array.isArray(s.c) ? s.c.length > 0 : false)));

  return sections.flatMap(({ k, l, c }) => {
    const arr = Array.isArray(c) ? c : [c];
    return arr.filter(Boolean).map((text, i) => ({
      id: `summary:${k}:${i}`,
      text: String(text).slice(0, 500),
      sectionLabel: l,
      type: 'summary',
      tabScope: 'summary',
    }));
  });
}

/** Chapter list → bulk entries. */
export function buildChaptersBulkItems(chapters = []) {
  return (Array.isArray(chapters) ? chapters : []).map((ch, i) => ({
    id: `chapters:${i}`,
    text: ch.title || `פרק ${i + 1}`,
    sectionLabel: 'פרקים',
    type: 'chapters',
    tabScope: 'chapters',
    timestamp: ch.timestamp || '',
  }));
}
