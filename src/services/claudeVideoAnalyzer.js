function buildClaudeError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

const CLAUDE_STATUS_TIMEOUT_MS = 20_000;

/** Long transcripts + JSON repair need more wall time; cap avoids infinite hangs */
function computeClaudeAnalyzeTimeoutMs(transcriptChars) {
  const c = Math.max(0, Number(transcriptChars) || 0);
  const baseMs = 120_000; // 2 min minimum
  const per1kMs = 8_000; // +8s per 1k transcript chars
  return Math.min(600_000, baseMs + Math.ceil(c / 1000) * per1kMs);
}

function isAbortError(e) {
  return e?.name === "AbortError" || e?.name === "TimeoutError";
}

export async function getClaudeAnalyzerStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLAUDE_STATUS_TIMEOUT_MS);
  let res;
  try {
    res = await fetch("/api/claude-video-analyze/status", { signal: controller.signal });
  } catch (e) {
    if (isAbortError(e)) {
      throw buildClaudeError("Claude status request timed out", "CLAUDE_STATUS_TIMEOUT", 408);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw buildClaudeError(
      data.message || "Claude status request failed",
      data.error || "CLAUDE_STATUS_ERROR",
      res.status
    );
  }
  return data;
}

export async function analyzeVideoWithClaude({
  videoId,
  title,
  transcript,
  durationSeconds,
  mentor = null,
  category = null,
  chaptersTarget = 6,
  signal,
}) {
  const selectedModel = "claude-sonnet-4-6";
  console.log("[Claude] analyzer selected", { videoId, title });
  console.log("[Claude] request started", { videoId, chaptersTarget, model: selectedModel });
  const transcriptChars = typeof transcript === "string" ? transcript.length : 0;
  const analyzeTimeoutMs = computeClaudeAnalyzeTimeoutMs(transcriptChars);
  console.log("[Claude] transcript chars (request)", transcriptChars, "timeoutMs", analyzeTimeoutMs);

  const controller = new AbortController();
  const abortExternal = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abortExternal, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(), analyzeTimeoutMs);
  let res;
  try {
    res = await fetch("/api/claude-video-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        videoId,
        title,
        transcript,
        durationSeconds,
        mentor,
        category,
        chaptersTarget,
      }),
    });
  } catch (e) {
    if (isAbortError(e)) {
      if (signal?.aborted) {
        const aborted = new Error("Claude analysis aborted");
        aborted.name = "AbortError";
        aborted.code = "CLAUDE_ABORTED";
        throw aborted;
      }
      throw buildClaudeError(
        "Claude analysis request timed out — try again or use a shorter transcript segment",
        "CLAUDE_TIMEOUT",
        408
      );
    }
    throw e;
  } finally {
    if (signal) signal.removeEventListener("abort", abortExternal);
    clearTimeout(timeoutId);
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    if (isAbortError(e)) {
      throw buildClaudeError(
        "Claude analysis response was interrupted (timeout)",
        "CLAUDE_TIMEOUT",
        408
      );
    }
    data = {};
  }
  if (!res.ok) {
    if (data.error === "CLAUDE_API_KEY_MISSING") {
      console.log("[Claude] missing API key");
    }
    console.error("[Claude] request failed", {
      videoId,
      status: res.status,
      error: data.error,
      message: data.message,
    });
    throw buildClaudeError(
      data.message || "Claude request failed",
      data.error || "CLAUDE_ERROR",
      res.status
    );
  }

  console.log("[Claude] request completed", {
    videoId,
    chapters: Array.isArray(data?.chapters) ? data.chapters.length : 0,
    provider: data?.provider || "claude",
    model: data?.model || selectedModel,
  });
  return data;
}
