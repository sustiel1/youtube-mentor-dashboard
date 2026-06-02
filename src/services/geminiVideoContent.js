export async function fetchGeminiBasicSummary({ title, transcriptText, signal }) {
  const res = await fetch("/api/gemini-basic-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      title,
      transcriptText: typeof transcriptText === "string" ? transcriptText.trim() : "",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "Gemini basic summary failed");
    error.code = data.error || "GEMINI_BASIC_SUMMARY_FAILED";
    error.status = res.status;
    throw error;
  }

  return data;
}

export async function fetchGeminiVideoContent({
  videoId,
  title,
  description = "",
  durationSeconds = null,
  mentor = null,
  category = null,
  chapterHints = [],
  /** Full existing transcript — when present, server runs summary/chapters/keyPoints analysis instead of pseudo-transcript only. */
  transcriptText = null,
  transcriptSegments = null,
  chaptersTarget = 6,
  signal,
}) {
  const res = await fetch("/api/gemini-video-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      videoId,
      title,
      description,
      durationSeconds,
      mentor,
      category,
      chapterHints,
      chaptersTarget,
      ...(Array.isArray(transcriptSegments) && transcriptSegments.length > 0
        ? { transcriptSegments }
        : {}),
      ...(typeof transcriptText === "string" && transcriptText.trim().length > 0
        ? { transcriptText: transcriptText.trim() }
        : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "Gemini content fetch failed");
    error.code = data.error || "GEMINI_CONTENT_FAILED";
    error.status = res.status;
    throw error;
  }

  return data;
}
