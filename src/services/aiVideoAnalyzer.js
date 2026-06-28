import { analyzeVideoWithClaude } from "@/services/claudeVideoAnalyzer";
import { normalizeAiAnalysisResult } from "@/services/videoAnalytics";
import { computeTargetChapters } from "@/lib/chapterCountUtils";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeQualityScore({ chapters, shortSummary, fullSummary, durationSeconds }) {
  const c = Array.isArray(chapters) ? chapters : [];
  let score = 0;
  if (String(shortSummary || "").trim().length > 20) score += 15;
  if (String(fullSummary || "").trim().length > 60) score += 15;
  if (c.length >= 4) score += 20;
  if (c.length >= 6) score += 10;
  const last = c[c.length - 1];
  const lastEnd = Number.isFinite(last?.endSeconds)
    ? last.endSeconds
    : Number.isFinite(last?.startSeconds)
      ? last.startSeconds
      : 0;
  const d = Number(durationSeconds);
  if (Number.isFinite(d) && d > 0) {
    if (lastEnd >= 0.75 * d) score += 20;
    if (lastEnd >= 0.9 * d) score += 10;
  } else {
    score += 10;
  }
  return clamp(score, 0, 100);
}

export async function analyzeVideoWithProvider({
  videoId,
  title,
  transcript,
  durationSeconds,
  mentor = null,
  category = null,
  chaptersTarget: chaptersTargetOverride = null,
  signal,
}) {
  const chaptersTarget = chaptersTargetOverride ?? computeTargetChapters(durationSeconds);

  const raw = await analyzeVideoWithClaude({
    videoId,
    title,
    transcript,
    durationSeconds,
    mentor,
    category,
    chaptersTarget,
    signal,
  });

  const normalized = normalizeAiAnalysisResult(raw);
  const qualityScore = Number.isFinite(raw?.qualityScore)
    ? raw.qualityScore
    : computeQualityScore({
        chapters: normalized.chapters,
        shortSummary: normalized.shortSummary,
        fullSummary: normalized.fullSummary,
        durationSeconds,
      });

  return {
    shortSummary: normalized.shortSummary,
    fullSummary: normalized.fullSummary,
    chapters: normalized.chapters,
    tags: normalized.tags,
    keyPoints: normalized.keyPoints,
    mainLesson: normalized.mainLesson,
    keyInsights: normalized.keyInsights,
    rules: normalized.rules,
    actionItems: normalized.actionItems,
    mistakesToAvoid: normalized.mistakesToAvoid,
    concepts: normalized.concepts,
    frameworks: normalized.frameworks,
    questions: normalized.questions,
    qualityScore,
    brainSummary: normalized.brainSummary || null,
    provider: raw?.provider || "claude",
    isFallback: Boolean(raw?.isFallback),
    contentType: normalized.contentType || null,
    mainClaim: normalized.mainClaim || null,
    speakerPosition: normalized.speakerPosition || null,
    politicalArguments: normalized.politicalArguments || [],
    weakPoints: normalized.weakPoints || [],
    counterArguments: normalized.counterArguments || [],
    socialMediaReplies: normalized.socialMediaReplies || [],
    raw: {
      ...raw,
      qualityScore,
      provider: raw?.provider || "claude",
    },
  };
}
