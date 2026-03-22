// AI Analysis cache — persists analysis results per videoId in localStorage.
// Key: ai_analysis_${videoId}
// Value: { shortSummary, fullSummary, keyPoints, tags, savedAt }

const key = (videoId) => `ai_analysis_${videoId}`;

export function getAiAnalysis(videoId) {
  if (!videoId) return null;
  try {
    const raw = localStorage.getItem(key(videoId));
    if (raw) {
      console.debug(`[AI] cache hit for ${videoId}`);
      return JSON.parse(raw);
    }
    console.debug(`[AI] cache miss for ${videoId}`);
    return null;
  } catch {
    return null;
  }
}

export function saveAiAnalysis(videoId, data) {
  if (!videoId) return;
  try {
    localStorage.setItem(
      key(videoId),
      JSON.stringify({ ...data, savedAt: new Date().toISOString() })
    );
    console.debug(`[AI] saved analysis for ${videoId}`);
  } catch (e) {
    console.warn("[aiAnalysisStore] write failed:", e.message);
  }
}

export function clearAiAnalysis(videoId) {
  if (!videoId) return;
  try {
    localStorage.removeItem(key(videoId));
    console.debug(`[AI] cleared analysis for ${videoId}`);
  } catch {}
}
