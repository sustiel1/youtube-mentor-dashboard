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
  extractWatchlistLevelRows,
  extractKeyLevelRows,
  getSpecializedSrc,
  isRegimeDuplicateString,
  macroRowRichness,
  macroSemanticKey,
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
  const tradePlan = [
    idea.entry && `כניסה: ${idea.entry}`,
    idea.stop && `סטופ: ${idea.stop}`,
    idea.target && `יעד: ${idea.target}`,
    idea.rrRatio && `יחס סיכון/סיכוי: ${idea.rrRatio}`,
    idea.timeframe && `טווח: ${idea.timeframe}`,
    idea.confidence && `ביטחון: ${idea.confidence}`,
  ].filter(Boolean);
  return [title, description, ...tradePlan].filter(Boolean).join(' · ');
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
  return [
    row.sector,
    row.direction && `זרימת כספים: ${row.direction}`,
    row.relativeStrength,
    row.reason,
    row.etf && `ETF: ${row.etf}`,
    row.stocks?.length && `מניות: ${row.stocks.join(', ')}`,
  ].filter(Boolean).join(' · ');
}

function formatCalendarRowText(row) {
  return [
    row.event,
    row.date,
    row.importance,
    row.impact && `השפעה: ${row.impact}`,
    row.timeframe && `תזמון: ${row.timeframe}`,
    row.affectedStocks?.length && `מושפעות: ${row.affectedStocks.join(', ')}`,
  ].filter(Boolean).join(' · ');
}

function formatStockRowText(stock) {
  return [
    stock.ticker,
    stock.company,
    stock.context,
    stock.sentiment,
    stock.changePercent,
    stock.actionability && `פעולה: ${stock.actionability}`,
    stock.notes,
    stock.timeframe && `טווח: ${stock.timeframe}`,
    stock.priority && `עדיפות: ${stock.priority}`,
    stock.isNewToWatch != null && `חדש למעקב: ${stock.isNewToWatch ? 'כן' : 'לא'}`,
  ].filter(Boolean).join(' · ');
}

function formatLevelRowText(row) {
  return [
    row.symbol,
    row.level,
    row.type,
    row.note,
  ].filter(Boolean).join(' · ');
}

function formatStructuredFact(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const preferred = [
    item.rank != null && `#${item.rank}`,
    item.ticker || item.asset || item.insight || item.point || item.title,
    item.level,
    item.note || item.reason || item.whyImportant,
    item.action && `פעולה: ${item.action}`,
    item.significance && `חשיבות: ${item.significance}`,
    item.category && `קטגוריה: ${item.category}`,
    item.applicableToApp != null && `יישומי לאפליקציה: ${item.applicableToApp ? 'כן' : 'לא'}`,
  ].filter(Boolean);
  return preferred.join(' · ');
}

function uniqueTexts(items) {
  const seen = new Set();
  return items.map(formatStructuredFact).filter((text) => {
    if (!text || seen.has(text)) return false;
    seen.add(text);
    return true;
  });
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
  // Semantic (not exact-string) dedup: fallbackItems come from a separate legacy
  // resolution path (extractVideoTabItems('brief-macro', ...)) and often re-describe
  // the same event with different phrasing — merge by topic, keep the richer row.
  const groups = new Map();
  for (const row of primaryRows) {
    groups.set(macroSemanticKey(row.indicator), row);
  }
  for (const item of fallbackItems) {
    const parsed = parseMacroDisplayItem(item);
    if (!parsed?.indicator) continue;
    const key = macroSemanticKey(parsed.indicator);
    const prev = groups.get(key);
    if (!prev || macroRowRichness(parsed) > macroRowRichness(prev)) {
      groups.set(key, parsed);
    }
  }
  return [...groups.values()];
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

  const levelItems = [
    ...extractWatchlistLevelRows(src),
    ...extractKeyLevelRows(src),
  ].map(formatLevelRowText).filter(Boolean);
  if (levelItems.length) {
    sections.push({ key: 'levels', label: '🎚️ רמות מפתח', items: levelItems, tabKey: 'key-levels' });
  }

  const insightItems = uniqueTexts(Array.isArray(src?.top5Insights) ? src.top5Insights : []);
  if (insightItems.length) {
    sections.push({ key: 'top-insights', label: '💡 תובנות מובילות', items: insightItems, tabKey: 'brief-conclusions' });
  }

  const learningItems = uniqueTexts(Array.isArray(src?.learningInsights) ? src.learningInsights : []);
  if (learningItems.length) {
    sections.push({ key: 'learning-insights', label: '🧠 לקחים', items: learningItems, tabKey: 'brief-conclusions' });
  }

  const allPointItems = uniqueTexts(Array.isArray(src?.allPoints) ? src.allPoints : []);
  if (allPointItems.length) {
    sections.push({ key: 'all-points', label: '📌 נקודות נוספות', items: allPointItems, tabKey: 'brief-conclusions' });
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

/**
 * Converts a section's items into {id, text, sectionLabel, type, tabScope} format
 * for section-level select-all. IDs match resolveMorningBriefBulkId output.
 */
export function resolveMorningBriefSectionChildItems(sections, sectionKey) {
  const sec = sections.find((s) => s.key === sectionKey);
  if (!sec?.items?.length) return [];
  return sec.items.map((item, i) => ({
    id: `specialized:${sectionKey}:${i}`,
    text: String(formatBulkItemText(item)).trim(),
    sectionLabel: sec.label,
    type: sec.tabKey || 'specialized',
    tabScope: 'specialized',
  }));
}

/** Combined child items from multiple section keys (e.g. opportunities + risks). */
export function resolveMorningBriefCombinedSectionChildItems(sections, sectionKeys) {
  return sectionKeys.flatMap((key) => resolveMorningBriefSectionChildItems(sections, key));
}
