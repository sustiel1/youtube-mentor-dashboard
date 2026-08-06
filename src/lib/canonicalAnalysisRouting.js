export function resolveAnalysisRoute({ videoType, tabsKey } = {}) {
  return videoType === "morningBrief" || tabsKey === "morningBrief"
    ? "market"
    : "general";
}

export function buildAnalysisTranscript(rawText, segments) {
  const usableSegments = (Array.isArray(segments) ? segments : [])
    .map((line) => ({
      text: String(line?.text || "").trim(),
      startSeconds: Number(line?.startSeconds ?? line?.start),
    }))
    .filter((line) => line.text && Number.isFinite(line.startSeconds) && line.startSeconds >= 0)
    .sort((a, b) => a.startSeconds - b.startSeconds);
  if (usableSegments.length === 0) return String(rawText || "").trim();
  return usableSegments
    .map((line) => `[${line.startSeconds}] ${line.text}`)
    .join("\n");
}

export function getCanonicalMarketAnalysisState({ provider, marketBriefData } = {}) {
  const extractionMeta = marketBriefData?.extractionMeta;
  const canonical =
    provider === "claude" &&
    marketBriefData?.contentType === "marketBrief" &&
    !!extractionMeta &&
    typeof extractionMeta === "object";
  return {
    canonical,
    source: canonical ? "claude_market_extraction" : (provider || "legacy"),
  };
}
