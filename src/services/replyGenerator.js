function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeContextItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .slice(0, 6)
    .map((item) => ({
      title: normalizeText(item?.title || "Untitled"),
      excerpt: normalizeText(item?.excerpt || ""),
      workspacePath: item?.workspacePath || null,
      metadata: {
        contentRole: item?.metadata?.contentRole || "my_position",
        perspective: item?.metadata?.perspective || "self",
        userPosition: item?.metadata?.userPosition || "endorsed",
        category: item?.metadata?.category || null,
        channel: item?.metadata?.channel || null,
        tags: Array.isArray(item?.metadata?.tags) ? item.metadata.tags.slice(0, 8) : [],
      },
      supportingChunks: (Array.isArray(item?.supportingChunks) ? item.supportingChunks : [])
        .slice(0, 2)
        .map((chunk) => ({
          title: normalizeText(chunk?.title || ""),
          summary: normalizeText(chunk?.summary || ""),
          timestampLabel: chunk?.timestampLabel || null,
        })),
    }));
}

export async function generatePoliticalReplyFromBrain({
  postText,
  myPositions = [],
  opponentViews = [],
  toneProfile = null,
  signal,
}) {
  const payload = {
    postText: normalizeText(postText),
    myPositions: normalizeContextItems(myPositions),
    opponentViews: normalizeContextItems(opponentViews),
    toneProfile: normalizeText(toneProfile || ""),
  };

  if (!payload.postText) {
    const error = new Error("postText is required");
    error.code = "MISSING_POST_TEXT";
    throw error;
  }

  const res = await fetch("/api/generate-political-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "Political reply generation failed");
    error.code = data.error || "POLITICAL_REPLY_GENERATION_FAILED";
    error.status = res.status;
    throw error;
  }

  return {
    provider: data.provider || "gemini",
    model: data.model || null,
    variations: Array.isArray(data.variations) ? data.variations : [],
  };
}
