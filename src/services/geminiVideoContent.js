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
  channelName = "",
  description = "",
  durationSeconds = null,
  mentor = null,
  category = null,
  chapterHints = [],
  transcriptText = null,
  transcriptSegments = null,
  chaptersTarget = 6,
  analysisMode = "smart",
  youtubeUrl = null,
  userNotes = null,
  attachedDocumentsMetadata = null,
  signal,
}) {
  const res = await fetch("/api/gemini-video-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      videoId,
      title,
      channelName,
      description,
      durationSeconds,
      mentor,
      category,
      chapterHints,
      chaptersTarget,
      analysisMode,
      youtubeUrl,
      userNotes,
      ...(Array.isArray(transcriptSegments) && transcriptSegments.length > 0
        ? { transcriptSegments }
        : {}),
      ...(typeof transcriptText === "string" && transcriptText.trim().length > 0
        ? { transcriptText: transcriptText.trim() }
        : {}),
      ...(Array.isArray(attachedDocumentsMetadata) && attachedDocumentsMetadata.length > 0
        ? { attachedDocumentsMetadata }
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

export async function fetchHebrewChapterTitles({ videoTitle, category, subCategory, chapters, signal }) {
  const res = await fetch("/api/gemini-hebrew-titles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ videoTitle, category, subCategory, chapters }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "Hebrew titles generation failed");
    error.code = data.error || "HEBREW_TITLES_FAILED";
    throw error;
  }
  if (data.error === "GEMINI_API_KEY_MISSING") {
    const error = new Error("מפתח Gemini חסר");
    error.code = "GEMINI_API_KEY_MISSING";
    throw error;
  }
  return data;
}
