/**
 * Normalizes and validates general/educational content analysis results.
 * Extracted from vite.config.js mergeGeminiExtendedAnalysisFields + validateGeminiFinalAnalysis (general path).
 */

function pickStrings(arr) {
  return (Array.isArray(arr) ? arr : []).map((x) => String(x || '').trim()).filter(Boolean);
}

export function normalizeGeneralResult(parsed) {
  const keyPoints = [
    ...pickStrings(parsed.keyPoints),
    ...pickStrings(parsed.usefulKnowledge),
    ...pickStrings(parsed.keyTakeaways),
  ];
  const keyInsights = [...new Set([
    ...pickStrings(parsed.keyInsights),
    ...pickStrings(parsed.insights),
  ])];
  const actionItems = [...new Set([
    ...pickStrings(parsed.actionItems),
    ...pickStrings(parsed.actionableIdeas),
  ])];

  let fullSummary = String(parsed.fullSummary || '').trim();
  const sentiment = String(parsed.sentiment || '').trim();
  const tone = String(parsed.tone || '').trim();
  if (sentiment || tone) {
    const block = [
      tone ? `טון: ${tone}` : '',
      sentiment ? `סנטימנט: ${sentiment}` : '',
    ].filter(Boolean).join('\n');
    fullSummary = fullSummary
      ? `${fullSummary}\n\n——\nטון וסנטימנט:\n${block}`
      : `טון וסנטימנט:\n${block}`;
  }

  return {
    ...parsed,
    keyPoints: [...new Set(keyPoints)].slice(0, 80),
    keyInsights,
    actionItems,
    fullSummary,
  };
}

/**
 * Returns { ok, reasons } — reasons is non-empty when quality is insufficient.
 */
export function validateGeneralQuality({ parsed, chunkAnalyses = [], transcriptLength = 0 }) {
  const reasons = [];
  const shortSummary = String(parsed?.shortSummary || '').trim();
  const fullSummary = String(parsed?.fullSummary || '').trim();
  const chapters = Array.isArray(parsed?.chapters) ? parsed.chapters : [];
  const actionableIdeas = Array.isArray(parsed?.actionableIdeas) ? parsed.actionableIdeas : [];
  const minSummaryChars = transcriptLength >= 8000 ? 260 : 180;
  const allowChapterless = transcriptLength >= 300 && transcriptLength < 2000;

  if ((shortSummary.length + fullSummary.length) < minSummaryChars) {
    reasons.push(`summary too short (${shortSummary.length + fullSummary.length})`);
  }
  if (!String(parsed?.mainLesson || '').trim()) reasons.push('mainLesson missing');
  if (!allowChapterless && chapters.length < Math.min(Math.max(chunkAnalyses.length, 2), 6)) {
    reasons.push(`not enough chapters (${chapters.length})`);
  }
  if (!allowChapterless && chapters.some((c) => !Number.isFinite(Number(c?.startSeconds)))) {
    reasons.push('chapter timestamp missing');
  }
  if (chunkAnalyses.some((chunk) => !String(chunk?.mainClaim || '').trim())) {
    reasons.push('specific claims missing');
  }
  if (actionableIdeas.length === 0) reasons.push('actionable ideas missing');

  return { ok: reasons.length === 0, reasons };
}

/**
 * Serializes the normalized general result into the API response shape.
 */
export function serializeGeneralResponse(parsed, modelId) {
  return {
    mode: 'analysis',
    provider: 'gemini',
    model: modelId,
    language: parsed?.language || 'he',
    shortSummary: String(parsed?.shortSummary || '').trim(),
    fullSummary: String(parsed?.fullSummary || '').trim(),
    keyPoints: Array.isArray(parsed?.keyPoints) ? parsed.keyPoints : [],
    chapters: Array.isArray(parsed?.chapters) ? parsed.chapters : [],
    tags: Array.isArray(parsed?.tags) ? parsed.tags : [],
    mainLesson: String(parsed?.mainLesson || '').trim() || null,
    keyInsights: Array.isArray(parsed?.keyInsights) ? parsed.keyInsights : [],
    rules: Array.isArray(parsed?.rules) ? parsed.rules : [],
    actionItems: Array.isArray(parsed?.actionItems) ? parsed.actionItems : [],
    mistakesToAvoid: Array.isArray(parsed?.mistakesToAvoid) ? parsed.mistakesToAvoid : [],
    strategyOrMethod: String(parsed?.strategyOrMethod || '').trim() || null,
    checklists: Array.isArray(parsed?.checklists) ? parsed.checklists : [],
    warnings: Array.isArray(parsed?.warnings) ? parsed.warnings : [],
    frameworks: Array.isArray(parsed?.frameworks) ? parsed.frameworks : [],
    concepts: Array.isArray(parsed?.concepts) ? parsed.concepts : [],
    thesis: Array.isArray(parsed?.thesis) ? parsed.thesis : [],
    questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
  };
}
