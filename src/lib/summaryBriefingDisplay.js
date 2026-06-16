/**
 * Presentation-only mapping: existing GEM / video fields → daily briefing sections.
 * Does NOT change extraction, schemas, or storage.
 */
import { valueToDisplayItems } from '@/lib/universalTabSections';
import { mergeMorningBriefSpecializedSource } from '@/lib/morningBriefDisplay';
import { formatStockStatusText } from '@/lib/stockStatusDisplay';

const MAX_THIRTY_SECOND = 5;
const MAX_INSIGHTS = 5;
const MAX_WATCH = 8;

function uniqueStrings(items = [], limit = 20) {
  const out = [];
  const seen = new Set();
  for (const raw of items) {
    const text = String(raw || '').trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function pickArray(...sources) {
  for (const src of sources) {
    if (Array.isArray(src) && src.length > 0) return src;
  }
  return [];
}

function formatIndexBullet(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const name = item.name || item.symbol || item.ticker || item.index || '';
  const change = item.change || item.changePct || item.pct || item.move || '';
  const level = item.level || item.value || item.price || '';
  const parts = [name, change, level].filter(Boolean);
  if (parts.length >= 2) return `${name} ${change}`.trim();
  return formatObjectLine(item);
}

function formatStockWatch(item) {
  const humanized = formatStockStatusText(item);
  if (humanized) return humanized;
  if (typeof item === 'string') {
    const fromString = formatStockStatusText(item.trim());
    return fromString || item.trim();
  }
  if (!item || typeof item !== 'object') return '';
  const sym = item.symbol || item.ticker || item.name || '';
  const reason = item.reason || item.note || item.context || item.level || item.keyLevel || '';
  const company = item.company || '';
  const label = sym || company;
  if (label && reason) return `${label} – ${reason}`;
  return formatObjectLine(item);
}

function formatCalendarWatch(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const event = item.event || item.title || item.name || '';
  const date = item.date || item.time || item.when || '';
  const impact = item.impact || item.importance || '';
  const parts = [event, date, impact].filter(Boolean);
  return parts.join(' · ');
}

function formatObjectLine(obj) {
  const stockLine = formatStockStatusText(obj);
  if (stockLine) return stockLine;
  if (!obj || typeof obj !== 'object') return String(obj ?? '').trim();
  const text = String(
    obj.text || obj.insight || obj.point || obj.content || obj.summary ||
    obj.title || obj.name || obj.rule || obj.description || obj.risk || ''
  ).trim();
  if (text) return text;
  return Object.entries(obj)
    .filter(([, v]) => v != null && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');
}

function inferToneLabel(...candidates) {
  const blob = candidates.filter(Boolean).join(' ').toLowerCase();
  if (!blob) return null;
  if (/risk.?off|דובי|bearish|מסוכן|זהירות|cautious/i.test(blob)) {
    if (/cautious|זהיר/i.test(blob)) return 'Bullish but cautious';
    return 'Risk-off';
  }
  if (/high vol|תנודתיות|vix|volatile/i.test(blob)) return 'High volatility';
  if (/neutral|ניטרלי|mixed|מעורב/i.test(blob)) return 'Neutral';
  if (/bullish|שורי|optimism|חיובי|risk.?on/i.test(blob)) return 'Bullish';
  return null;
}

function splitSummaryBullets(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const lines = raw.split(/\n+/).map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const sentences = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 12);
  return sentences.length > 1 ? sentences : [raw];
}

function textsOverlap(a, b) {
  const an = String(a || '').trim().toLowerCase();
  const bn = String(b || '').trim().toLowerCase();
  if (!an || !bn) return false;
  if (an === bn) return true;
  const minLen = Math.min(an.length, bn.length);
  if (minLen >= 24) return an.includes(bn) || bn.includes(an);
  return false;
}

/** Presentation-only: whether thirty-second briefing already shows summaryShort. */
export function isSummaryShortCoveredByBriefing(summaryShort, thirtySecond) {
  const short = String(summaryShort || '').trim();
  if (!short || !Array.isArray(thirtySecond) || thirtySecond.length === 0) return false;

  const bullets = splitSummaryBullets(short);
  const targets = bullets.length > 0 ? bullets : [short];

  return targets.every((bullet) =>
    thirtySecond.some((item) => textsOverlap(bullet, item)),
  );
}

function readSummaryObject(marketBriefData) {
  const ut = marketBriefData?.universalTabs?.summary;
  return ut && typeof ut === 'object' && !Array.isArray(ut) ? ut : {};
}

function readUsefulObject(marketBriefData) {
  const ut = marketBriefData?.universalTabs?.usefulKnowledge;
  return ut && typeof ut === 'object' && !Array.isArray(ut) ? ut : {};
}

function readInsightsObject(marketBriefData) {
  const ut = marketBriefData?.universalTabs?.insights;
  if (ut && typeof ut === 'object' && !Array.isArray(ut)) return ut;
  return {};
}

/**
 * @returns {{
 *   thirtySecond: string[],
 *   marketStatus: { tone: string, factors: string[], explanation: string } | null,
 *   watchToday: string[],
 *   keyInsights: string[],
 *   keyRisks: string[],
 *   actionChecklist: string[],
 *   fullSummaryText: string,
 *   hasBriefing: boolean,
 *   coversSummaryShort: boolean,
 * }}
 */
export function buildDailyBriefingView({
  effectiveVideo = {},
  marketBriefData = null,
  summaryShort = '',
  fullSummary = '',
  summaryShaped = null,
} = {}) {
  const video = effectiveVideo || {};
  const mbd = marketBriefData || {};
  const summaryObj = readSummaryObject(mbd);
  const usefulObj = readUsefulObject(mbd);
  const insightsObj = readInsightsObject(mbd);
  const merged = mergeMorningBriefSpecializedSource(mbd) || {};

  const topTakeaways = valueToDisplayItems(summaryObj.topTakeaways);
  const shortSummaryBullets = splitSummaryBullets(summaryObj.shortSummary || summaryShort);
  const indexBullets = pickArray(merged.indices, mbd.indices, video.indices)
    .map(formatIndexBullet)
    .filter(Boolean);
  const flatSummaryItems = summaryShaped?.mode === 'flat'
    ? summaryShaped.items
    : (summaryShaped?.mode === 'sections'
      ? summaryShaped.sections.flatMap((s) => s.items)
      : []);

  const thirtySecond = uniqueStrings([
    ...topTakeaways,
    ...indexBullets,
    ...shortSummaryBullets,
    ...flatSummaryItems,
    ...valueToDisplayItems(pickArray(mbd.top5Insights, insightsObj.top5Insights)),
  ], MAX_THIRTY_SECOND);

  const moodRaw = String(
    summaryObj.marketMood || summaryObj.mainConclusion || ''
  ).trim();
  const sentimentLines = valueToDisplayItems(
    pickArray(merged.sentiment, mbd.sentiment, video.sentiment)
  );
  const overview = merged.marketOverview && typeof merged.marketOverview === 'object'
    ? merged.marketOverview
    : {};
  const tone = inferToneLabel(
    moodRaw,
    sentimentLines[0],
    overview.marketTrend,
    overview.riskOnOff,
  ) || (moodRaw ? moodRaw.split(/[.!?\n]/)[0].slice(0, 60) : null);

  const statusFactors = uniqueStrings([
    ...valueToDisplayItems(summaryObj.keyOpportunities).slice(0, 2),
    ...sentimentLines.slice(0, 2),
    overview.leadingSector ? `סקטור מוביל: ${overview.leadingSector}` : '',
    overview.marketTrend ? `מגמה: ${overview.marketTrend}` : '',
  ], 4);

  const statusExplanation = moodRaw
    || sentimentLines[0]
    || overview.marketStrength
    || overview.breadth
    || '';

  const marketStatus = (tone || statusExplanation)
    ? {
      tone: tone || 'Neutral',
      factors: statusFactors,
      explanation: String(statusExplanation).trim(),
    }
    : null;

  const watchToday = uniqueStrings([
    ...pickArray(merged.opportunities, mbd.opportunities, video.opportunities).map(formatObjectLine),
    ...pickArray(merged.stocksMentioned, mbd.stocksMentioned, video.stocksMentioned).map(formatStockWatch),
    ...pickArray(merged.calendar, merged.economicCalendar, mbd.calendar, mbd.macro, video.macro).map(formatCalendarWatch),
    ...valueToDisplayItems(summaryObj.keyOpportunities),
    ...pickArray(merged.watchlistLevels, merged.keyLevels, mbd.watchlistLevels).map(formatObjectLine),
  ], MAX_WATCH);

  const keyInsights = uniqueStrings([
    ...valueToDisplayItems(pickArray(insightsObj.top5Insights, mbd.top5Insights, video.top5Insights)),
    ...valueToDisplayItems(pickArray(usefulObj.reusableKnowledge, mbd.reusableKnowledge, video.reusableKnowledge)),
    ...valueToDisplayItems(pickArray(insightsObj.marketLessons, insightsObj.learningInsights, mbd.learningInsights)),
    ...valueToDisplayItems(pickArray(mbd.conclusions, video.conclusions)),
    ...valueToDisplayItems(pickArray(insightsObj.tradingInsights)),
  ], MAX_INSIGHTS);

  const keyRisks = uniqueStrings([
    ...pickArray(merged.risks, mbd.risks, video.risks).map(formatObjectLine),
    ...valueToDisplayItems(summaryObj.importantWarnings),
    ...valueToDisplayItems(pickArray(usefulObj.riskManagement, mbd.riskManagement)),
    ...pickArray(merged.warnings, mbd.warnings).map(formatObjectLine),
  ], 6);

  const actionChecklist = uniqueStrings([
    ...valueToDisplayItems(pickArray(usefulObj.actionChecklist, mbd.actionChecklist, video.actionChecklist)),
    ...valueToDisplayItems(pickArray(video.actionItems, mbd.actionItems)),
  ], 8);

  const fullSummaryText = String(
    summaryObj.fullSummary || fullSummary || video.fullSummary || video.gemSummary || ''
  ).trim();

  const hasBriefing = Boolean(
    thirtySecond.length
    || marketStatus
    || watchToday.length
    || keyInsights.length
    || keyRisks.length
    || actionChecklist.length,
  );

  return {
    thirtySecond,
    marketStatus,
    watchToday,
    keyInsights,
    keyRisks,
    actionChecklist,
    fullSummaryText,
    hasBriefing,
    coversSummaryShort: isSummaryShortCoveredByBriefing(summaryShort, thirtySecond),
  };
}
