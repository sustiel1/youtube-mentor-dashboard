/**
 * Normalizes and validates market/trading content analysis results.
 */

import {
  dedupeTimedNarratives,
  normalizeTimedNarrativeArray,
} from './timedNarrative.js';

function pickStrings(arr) {
  return (Array.isArray(arr) ? arr : []).map((x) => String(x || '').trim()).filter(Boolean);
}

export function normalizeMarketResult(parsed) {
  const keyPoints = dedupeTimedNarratives([
    ...normalizeTimedNarrativeArray(parsed?.keyPoints),
    ...normalizeTimedNarrativeArray(parsed?.tradingRules),
  ], 80);
  return {
    ...parsed,
    contentType: 'market',
    keyPoints,
    stocksMentioned: pickStrings(parsed?.stocksMentioned),
    keyInsights: normalizeTimedNarrativeArray(parsed?.keyInsights),
    usefulKnowledge: normalizeTimedNarrativeArray(parsed?.usefulKnowledge),
    tradingSetups: normalizeTimedNarrativeArray(parsed?.tradingSetups),
    tradingRules: normalizeTimedNarrativeArray(parsed?.tradingRules),
    riskRules: normalizeTimedNarrativeArray(parsed?.riskRules),
    actionItems: normalizeTimedNarrativeArray(parsed?.actionItems),
    warnings: normalizeTimedNarrativeArray(parsed?.warnings),
    keyLevels: pickStrings(parsed?.keyLevels),
    indicators: pickStrings(parsed?.indicators),
    marketConditions: pickStrings(parsed?.marketConditions),
    chapters: Array.isArray(parsed?.chapters) ? parsed.chapters : [],
    tags: pickStrings(parsed?.tags),
  };
}

export function validateMarketQuality({ parsed, transcriptLength = 0 }) {
  const reasons = [];
  const shortSummary = String(parsed?.shortSummary || '').trim();
  const fullSummary = String(parsed?.fullSummary || '').trim();
  const chapters = Array.isArray(parsed?.chapters) ? parsed.chapters : [];
  const minSummaryChars = transcriptLength >= 8000 ? 200 : 120;
  const allowChapterless = transcriptLength >= 300 && transcriptLength < 2000;

  if ((shortSummary.length + fullSummary.length) < minSummaryChars) {
    reasons.push(`market summary too short (${shortSummary.length + fullSummary.length})`);
  }
  if (!allowChapterless && chapters.length < 2) {
    reasons.push(`not enough market chapters (${chapters.length})`);
  }
  if (!allowChapterless && chapters.some((c) => !Number.isFinite(Number(c?.startSeconds)))) {
    reasons.push('market chapter timestamp missing');
  }

  return { ok: reasons.length === 0, reasons };
}

export function serializeMarketResponse(parsed, modelId) {
  return {
    mode: 'analysis',
    provider: 'gemini',
    model: modelId,
    contentType: 'market',
    language: parsed?.language || 'he',
    shortSummary: String(parsed?.shortSummary || '').trim(),
    fullSummary: String(parsed?.fullSummary || '').trim(),
    keyPoints: Array.isArray(parsed?.keyPoints) ? parsed.keyPoints : [],
    chapters: Array.isArray(parsed?.chapters) ? parsed.chapters : [],
    mainLesson: String(parsed?.mainLesson || '').trim() || null,
    stocksMentioned: Array.isArray(parsed?.stocksMentioned) ? parsed.stocksMentioned : [],
    tradingSetups: Array.isArray(parsed?.tradingSetups) ? parsed.tradingSetups : [],
    tradingRules: Array.isArray(parsed?.tradingRules) ? parsed.tradingRules : [],
    riskRules: Array.isArray(parsed?.riskRules) ? parsed.riskRules : [],
    keyLevels: Array.isArray(parsed?.keyLevels) ? parsed.keyLevels : [],
    indicators: Array.isArray(parsed?.indicators) ? parsed.indicators : [],
    marketConditions: Array.isArray(parsed?.marketConditions) ? parsed.marketConditions : [],
    actionItems: normalizeTimedNarrativeArray(parsed?.actionItems),
    warnings: normalizeTimedNarrativeArray(parsed?.warnings),
    tags: Array.isArray(parsed?.tags) ? parsed.tags : [],
  };
}
