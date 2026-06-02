function buildOllamaError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function extractJsonBlock(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const fenced = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  if (fenced.startsWith("{") && fenced.endsWith("}")) return fenced;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return fenced.slice(start, end + 1);
  }
  return null;
}

export const OLLAMA_SERVE_COMMAND = "ollama serve";
export const OLLAMA_PULL_COMMAND = "ollama pull llama3.2";

export async function checkOllamaStatus() {
  let response;
  try {
    response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
    });
  } catch {
    return {
      status: "ollama_offline",
      message: "Ollama לא פעיל. הפעל במחשב: ollama serve",
    };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      status: "ollama_offline",
      message: "Ollama לא פעיל. הפעל במחשב: ollama serve",
    };
  }

  const models = Array.isArray(data?.models) ? data.models : [];
  const hasLlamaModel = models.some((model) => {
    const name = String(model?.name || model?.model || "").trim().toLowerCase();
    return name === "llama3.2" || name.startsWith("llama3.2:");
  });

  if (!hasLlamaModel) {
    return {
      status: "model_missing",
      message: "המודל llama3.2 לא מותקן. הרץ: ollama pull llama3.2",
    };
  }

  return {
    status: "ready",
    message: "llama3.2 מוכן לשימוש",
  };
}

export async function quickTestOllamaModel() {
  let response;
  try {
    response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        prompt: "כתוב משפט בדיקה קצר",
        stream: false,
      }),
    });
  } catch {
    return {
      status: "ollama_offline",
      message: "Ollama לא פעיל. הפעל במחשב: ollama serve",
    };
  }

  const data = await response.json().catch(() => ({}));
  const message = String(data?.error || data?.message || "").trim();

  if (!response.ok) {
    if (response.status === 404 && /model\s+["']?llama3\.2["']?\s+not found/i.test(message)) {
      return {
        status: "model_missing",
        message: "המודל llama3.2 לא מותקן. יש להריץ במחשב: ollama pull llama3.2",
      };
    }

    return {
      status: "failed",
      message: message || "בדיקת llama3.2 נכשלה",
    };
  }

  const output = String(data?.response || "").trim();
  if (!output) {
    return {
      status: "failed",
      message: "llama3.2 לא החזיר תשובת בדיקה",
    };
  }

  return {
    status: "ready",
    message: "llama3.2 מחובר ועובד",
    output,
  };
}

export async function analyzeVideoWithOllama({
  videoId,
  title,
  transcript,
  durationSeconds,
  mentor = null,
  category = null,
  signal,
}) {
  const prompt = `
אתה מחזיר JSON בלבד בעברית.
נתח את התמלול הבא והחזר מבנה ניתוח וידאו מלא.

פרטי הסרטון:
- videoId: ${videoId}
- title: ${title}
- mentor: ${mentor || "לא צוין"}
- category: ${category || "לא צוין"}
- durationSeconds: ${Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : "לא צוין"}

דרישות:
- אל תחזיר markdown
- אל תחזיר טקסט מחוץ ל-JSON
- פרקים חייבים להיות מבוססי תמלול ולא גנריים
- אם יש timestamps בתמלול, השתמש בהם
- אם אין מידע מסוים, כתוב "לא צוין בתמלול"

החזר JSON בפורמט:
{
  "summary": "סיכום קצר",
  "shortSummary": "תקציר קצר",
  "fullSummary": "סיכום מלא",
  "chapters": [
    {
      "title": "כותרת פרק",
      "startSeconds": 0,
      "endSeconds": 120,
      "summary": "מה קורה בפרק",
      "keyPoints": ["נקודה 1", "נקודה 2"]
    }
  ],
  "keyPoints": ["נקודה מרכזית 1", "נקודה מרכזית 2"],
  "tags": ["tag1", "tag2"],
  "brainSummary": "## 🎯 Core Idea\n...\n\n## 🧠 Reusable Insights\n- ...\n\n## ✅ Principles / Rules\n- ...\n\n## 🔁 Reusable Actions\n- ...\n\n## 🧩 Key Concepts\n- ...\n\n## ⚠️ Mistakes / Risks\n- ...\n\n## 📝 Personal Notes\n[מלא ידנית]\n\n## 🔗 Source\n[כותרת](url)"
}

תמלול:
${String(transcript || "").trim()}
`.trim();

  let response;
  try {
    response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model: "llama3.2",
        prompt,
        stream: false,
        format: "json",
      }),
    });
  } catch (error) {
    throw buildOllamaError(
      "Ollama לא פעיל. הפעל במחשב: ollama serve",
      "OLLAMA_UNAVAILABLE",
      0
    );
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(data?.error || data?.message || "Ollama request failed");
    if (response.status === 404 && /model\s+["']?llama3\.2["']?\s+not found/i.test(message)) {
      throw buildOllamaError(
        "מודל llama3.2 לא מותקן ב-Ollama. הרץ במחשב: ollama pull llama3.2",
        "OLLAMA_MODEL_NOT_FOUND",
        response.status
      );
    }
    throw buildOllamaError(
      message,
      "OLLAMA_ERROR",
      response.status
    );
  }

  const jsonText = extractJsonBlock(data?.response);
  if (!jsonText) {
    throw buildOllamaError("Ollama לא החזיר JSON תקין", "OLLAMA_INVALID_JSON", 200);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw buildOllamaError("Ollama לא החזיר JSON תקין", "OLLAMA_INVALID_JSON", 200);
  }

  return {
    ...parsed,
    provider: "llama3.2",
  };
}
