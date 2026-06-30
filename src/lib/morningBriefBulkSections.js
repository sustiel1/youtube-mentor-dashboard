/**
 * Presentation-only: Morning Brief specialized tab → universal bulk selection sections.
 * Mirrors visible save text in MorningBriefDashboard panels (no extraction/schema changes).
 */
import { extractVideoTabItems } from '@/config/videoTabsConfig';
import { cleanupMacroDisplayRows, cleanupMarketDashboardRows } from '@/lib/macroDisplayCleanup';
import { parseMacroDisplayItem } from '@/lib/morningBriefDisplay';
import { translateDisplayLabel, translateMarketStatusLabel } from '@/lib/specializedDisplayI18n';
import {
  buildCardBulkItemsFromSections,
  formatBulkItemText,
  formatCardBulkText,
} from '@/lib/universalTabBulkItems';
import {
  extractCalendarRows,
  extractMacroIndicatorRows,
  extractMarketDashboardRows,
  extractMarketRegimeCards,
  extractOpportunityIdeas,
  extractRiskItems,
  extractSectorRows,
  extractSentimentItems,
  extractUnifiedStocks,
  getSpecializedSrc,
  isRegimeDuplicateString,
  normalizeMarketDashboardRow,
} from '@/lib/morningBriefDisplay';

const INTERNAL_NEWS_FIELD_RE = /^(headline|title|content|source|impact)\s*:\s*/i;

function stripInternalNewsFieldLabel(text) {
  let s = String(text || '').trim();
  while (INTERNAL_NEWS_FIELD_RE.test(s)) {
    s = s.replace(INTERNAL_NEWS_FIELD_RE, '').trim();
  }
  return s;
}

function normalizeNewsStrings(items) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  return safe.map((item) => {
    if (typeof item === 'string') return stripInternalNewsFieldLabel(item);
    if (typeof item === 'object') {
      return stripInternalNewsFieldLabel(
        [item.headline, item.title, item.content, item.details, item.source, item.impact]
          .filter(Boolean)
          .join(' — '),
      );
    }
    return stripInternalNewsFieldLabel(String(item));
  }).filter(Boolean);
}

function filterOpportunityIdeas(marketBriefData, effectiveVideo) {
  const stockTickers = new Set(extractUnifiedStocks(marketBriefData, effectiveVideo).map((s) => s.ticker));
  return extractOpportunityIdeas(getSpecializedSrc(marketBriefData)).filter((idea) => {
    const title = (idea.title || '').trim().toUpperCase();
    if (stockTickers.has(title) && title.length <= 5) return false;
    return true;
  });
}

function formatOpportunityText(idea) {
  const titleText = String(idea.title || '').trim();
  const ticker = String(idea.ticker || '').trim().toUpperCase();
  const title = ticker ? `${ticker} · ${titleText}` : titleText;
  const detail = String(idea.detail || '').trim();
  const description = detail && detail !== titleText ? detail : '';
  return [title, description].filter(Boolean).join(' — ');
}

function formatMarketRowText(row) {
  return [row.asset, row.trend, row.strength, row.comment].filter(Boolean).join(' · ');
}

function formatMacroRowText(row) {
  return [row.indicator, row.value, row.change, row.frequency, row.description, row.impact]
    .filter(Boolean)
    .join(' · ');
}

function formatSectorRowText(row) {
  return [row.sector, row.direction, row.relativeStrength].filter(Boolean).join(' · ');
}

function formatCalendarRowText(row) {
  return [row.event, row.date, row.importance, row.impact].filter(Boolean).join(' · ');
}

function formatStockRowText(stock) {
  return [stock.ticker, stock.company, stock.context, stock.sentiment].filter(Boolean).join(' · ');
}

function stripInternalFieldLabels(text) {
  let s = String(text || '').trim();
  const re = /^(marketTrend|breadth|riskOn|riskOff|volatility|leadingSector|weakestSector|marketStrength)\s*:\s*/i;
  while (re.test(s)) {
    s = s.replace(re, '').trim();
  }
  return s;
}

function formatRegimeCardText(card) {
  return `${translateMarketStatusLabel(card.label)}: ${stripInternalFieldLabels(card.value)}`;
}

function mergeMacroDisplayRows(primaryRows, fallbackItems) {
  const seen = new Set(primaryRows.map((r) => `${r.indicator}|${r.value}|${r.change}|${r.description}`));
  const merged = [...primaryRows];
  for (const item of fallbackItems) {
    const parsed = parseMacroDisplayItem(item);
    if (!parsed?.indicator) continue;
    const sig = `${parsed.indicator}|${parsed.value}|${parsed.change}|${parsed.description}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    merged.push(parsed);
  }
  return merged;
}

function mergeMarketRows(marketBriefData, indicesItems = []) {
  const fromSrc = extractMarketDashboardRows(getSpecializedSrc(marketBriefData));
  const fromItems = indicesItems.map((i) => normalizeMarketDashboardRow(i)).filter(Boolean);
  const seen = new Set();
  const merged = [...fromSrc, ...fromItems].filter((r) => {
    const sig = `${r.asset}|${r.trend}|${r.strength}|${r.comment}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  return cleanupMarketDashboardRows(merged);
}

/** Merged market/index rows for Morning Brief שווקים (matches MorningBriefMarketsTable). */
export function getMorningBriefMarketRows(marketBriefData, indicesItems = []) {
  return mergeMarketRows(marketBriefData, indicesItems);
}

function getMacroDisplayRows(marketBriefData, fallbackItems = []) {
  const src = getSpecializedSrc(marketBriefData);
  const fromSrc = extractMacroIndicatorRows(src);
  const marketRows = extractMarketDashboardRows(src);
  const safeItems = Array.isArray(fallbackItems) ? fallbackItems.filter(Boolean) : [];
  return cleanupMacroDisplayRows(mergeMacroDisplayRows(fromSrc, safeItems), marketRows);
}

/**
 * @returns {Array<{ key: string, label: string, items: string[], tabKey: string }>}
 */
export function buildMorningBriefBulkSections(effectiveVideo = {}, marketBriefData = null) {
  const src = getSpecializedSrc(marketBriefData);
  const indicesItems = extractVideoTabItems(effectiveVideo, 'indices', marketBriefData);
  const allNewsItems = extractVideoTabItems(effectiveVideo, 'market-news', marketBriefData);
  const plainNewsItems = allNewsItems
    .filter((i) => {
      if (typeof i === 'string' && isRegimeDuplicateString(i)) return false;
      return true;
    })
    .filter((i) => typeof i !== 'string' || !(/\b(direction|change|level)\s*:/.test(i) && i.indexOf(':') > 0 && i.slice(0, i.indexOf(':')).trim().length <= 12));

  const sections = [];

  const newsItems = normalizeNewsStrings(plainNewsItems);
  if (newsItems.length) {
    sections.push({ key: 'news', label: '📰 חדשות', items: newsItems, tabKey: 'market-news' });
  }

  const regimeItems = extractMarketRegimeCards(src).map(formatRegimeCardText).filter(Boolean);
  if (regimeItems.length) {
    sections.push({ key: 'market-regime', label: '📊 מצב שוק', items: regimeItems, tabKey: 'market-regime' });
  }

  const sectorItems = extractSectorRows(src).map(formatSectorRowText).filter(Boolean);
  if (sectorItems.length) {
    sections.push({ key: 'sectors', label: '📊 סקטורים', items: sectorItems, tabKey: 'brief-sectors' });
  }

  const opportunityItems = filterOpportunityIdeas(marketBriefData, effectiveVideo)
    .map(formatOpportunityText)
    .filter(Boolean);
  if (opportunityItems.length) {
    sections.push({ key: 'opportunities', label: '🎯 הזדמנויות', items: opportunityItems, tabKey: 'brief-opportunities' });
  }

  const riskItems = extractRiskItems(src).map((r) => r.text).filter(Boolean);
  if (riskItems.length) {
    sections.push({ key: 'risks', label: '⚠️ סיכונים', items: riskItems, tabKey: 'brief-risks' });
  }

  const stockItems = extractUnifiedStocks(marketBriefData, effectiveVideo)
    .map(formatStockRowText)
    .filter(Boolean);
  if (stockItems.length) {
    sections.push({ key: 'stocks-mentioned', label: '⭐ מניות שהוזכרו', items: stockItems, tabKey: 'stocks-mentioned' });
  }

  const calendarItems = extractCalendarRows(src).map(formatCalendarRowText).filter(Boolean);
  if (calendarItems.length) {
    sections.push({ key: 'economic-calendar', label: '📅 לוח כלכלי', items: calendarItems, tabKey: 'brief-calendar' });
  }

  const macroFallback = extractVideoTabItems(effectiveVideo, 'brief-macro', marketBriefData);
  const macroItems = getMacroDisplayRows(marketBriefData, macroFallback)
    .map(formatMacroRowText)
    .filter(Boolean);
  if (macroItems.length) {
    sections.push({ key: 'macro', label: '🌍 מאקרו', items: macroItems, tabKey: 'brief-macro' });
  }

  const sentimentItems = extractSentimentItems(src)
    .map(({ label, value }) => `${label}: ${value}`)
    .filter(Boolean);
  if (sentimentItems.length) {
    sections.push({ key: 'sentiment', label: '📊 סנטימנט', items: sentimentItems, tabKey: 'brief-sentiment' });
  }

  const marketItems = mergeMarketRows(marketBriefData, indicesItems)
    .map(formatMarketRowText)
    .filter(Boolean);
  if (marketItems.length) {
    sections.push({ key: 'markets', label: '📈 שווקים', items: marketItems, tabKey: 'indices' });
  }

  return sections;
}

/** Card-level save text from a morning brief section key. */
export function resolveMorningBriefCardText(sections, sectionKey, title) {
  const sec = sections.find((s) => s.key === sectionKey);
  if (!sec?.items?.length) return '';
  return formatCardBulkText(title || sec.label, sec.items);
}

/** Combined card text (e.g. opportunities + risks in one shell). */
export function resolveMorningBriefCombinedCardText(sections, sectionKeys, title) {
  const items = sectionKeys.flatMap((k) => sections.find((s) => s.key === k)?.items || []);
  if (!items.length) return '';
  return formatCardBulkText(title, items);
}

/**
 * Card-level bulk items for Morning Brief dashboard sections.
 * Merges opportunities + risks into the combined dashboard card.
 */
export function buildMorningBriefCardBulkItems(sections = []) {
  const opp = sections.find((s) => s.key === 'opportunities');
  const risks = sections.find((s) => s.key === 'risks');
  const cardSections = sections.filter((s) => s.key !== 'opportunities' && s.key !== 'risks');

  if (opp?.items?.length || risks?.items?.length) {
    cardSections.push({
      key: 'opportunities-risks',
      label: '🎯 הזדמנויות וסיכונים',
      items: [...(opp?.items || []), ...(risks?.items || [])],
      tabKey: 'brief-opportunities',
    });
  }

  return buildCardBulkItemsFromSections(cardSections, 'specialized');
}

/** Resolve bulk id matching buildBulkItemsFromSections('specialized', ...). */
export function resolveMorningBriefBulkId(sections, sectionKey, text) {
  const sec = sections.find((s) => s.key === sectionKey);
  if (!sec) return null;
  const normalized = String(text || '').trim();
  const idx = sec.items.findIndex((item) => String(formatBulkItemText(item)).trim() === normalized);
  if (idx < 0) return null;
  return `specialized:${sectionKey}:${idx}`;
}
