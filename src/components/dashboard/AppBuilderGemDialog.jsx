import { useState, useEffect } from "react";
import { X, Clipboard, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal } from "@/components/ui/dialog";

const PASTE_CACHE_PREFIX = "app_builder_gem_paste_";

function cacheKey(videoId) {
  return `${PASTE_CACHE_PREFIX}${videoId || "unknown"}`;
}
function readCache(videoId) {
  try { return localStorage.getItem(cacheKey(videoId)) || ""; } catch { return ""; }
}
function writeCache(videoId, text) {
  try { localStorage.setItem(cacheKey(videoId), text); } catch {}
}
function clearCache(videoId) {
  try { localStorage.removeItem(cacheKey(videoId)); } catch {}
}

/**
 * Parses GEM JSON output → APP Builder section map.
 * Returns { sections: {key: string}, filledCount: number }.
 * Throws descriptive Error on failure.
 */
function parseGemJson(rawText) {
  // Strip markdown code fences if the GEM wrapped the output
  const cleaned = rawText.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  if (cleaned.startsWith("#")) {
    throw new Error(
      "הפלט שהודבק הוא Markdown ולא JSON.\n" +
      "בקש מה-GEM להחזיר פלט ב-JSON בלבד לפי הפורמט הצפוי (ראה \"פורמט JSON צפוי\" למעלה)."
    );
  }

  const obj = JSON.parse(cleaned);

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("JSON אינו אובייקט");
  }
  if (obj.contentType && obj.contentType !== "appBuilder") {
    throw new Error(`contentType שגוי: "${obj.contentType}" — חייב להיות "appBuilder"`);
  }

  const sections = {};

  // summary
  if (typeof obj.summary === "string" && obj.summary.trim()) {
    sections.summary = obj.summary.trim();
  } else if (Array.isArray(obj.summary) && obj.summary.length) {
    sections.summary = obj.summary.join("\n");
  }

  // array fields → bullet list
  for (const key of ["requirements", "screens", "logic", "risks", "tasks"]) {
    const val = obj[key];
    if (Array.isArray(val) && val.length) {
      sections[key] = val.map((item) => `• ${String(item).trim()}`).join("\n");
    } else if (typeof val === "string" && val.trim()) {
      sections[key] = val.trim();
    }
  }

  // developmentPrompt → prompt (prefer claudeCode, fallback to codex/base44)
  if (obj.developmentPrompt && typeof obj.developmentPrompt === "object") {
    const { claudeCode, codex, base44 } = obj.developmentPrompt;
    const chosen = (claudeCode || codex || base44 || "").trim();
    if (chosen) sections.prompt = chosen;
  } else if (typeof obj.prompt === "string" && obj.prompt.trim()) {
    sections.prompt = obj.prompt.trim();
  }

  const filledCount = Object.values(sections).filter(Boolean).length;
  if (filledCount === 0) {
    throw new Error("ה-JSON תקין אבל כל השדות ריקים — ודא שה-GEM החזיר תוכן");
  }

  return { sections, filledCount };
}

const JSON_EXAMPLE = `{
  "contentType": "appBuilder",
  "summary": "...",
  "requirements": ["..."],
  "screens": ["..."],
  "logic": ["..."],
  "risks": ["..."],
  "tasks": ["..."],
  "developmentPrompt": {
    "claudeCode": "...",
    "codex": "...",
    "base44": "..."
  }
}`;

/**
 * §26 APP Builder — GEM paste-back dialog.
 * Accepts JSON from the user (pasted from external GEM), validates it,
 * and calls onApply(sections, filledCount) on success.
 *
 * "מחק מלל" clears ONLY the textarea + auto-restore cache.
 * It does NOT delete the saved APP Builder draft.
 */
export function AppBuilderGemDialog({ open, onOpenChange, videoId, onApply }) {
  const [text, setText] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setText(readCache(videoId));
      setError(null);
    }
  }, [open, videoId]);

  const handleChange = (val) => {
    setText(val);
    writeCache(videoId, val);
    if (error) setError(null);
  };

  const handleClearText = () => {
    setText("");
    clearCache(videoId);
    setError(null);
    toast.info("המלל נמחק");
  };

  const handleApply = () => {
    if (!text.trim()) {
      setError("הטקסטאריה ריקה — הדבק JSON מה-GEM ולחץ אשר");
      return;
    }
    try {
      const { sections, filledCount } = parseGemJson(text);
      clearCache(videoId);
      onApply(sections, filledCount);
      onOpenChange(false);
    } catch (err) {
      setError(`JSON לא תקין: ${err.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[360] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          onPointerDownOutside={(e) => e.preventDefault()}
          className="fixed left-[50%] top-[50%] z-[370] w-full max-w-[600px] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="text-right text-base font-semibold text-slate-900 dark:text-zinc-100">
            📋 הדבק JSON מ-GEM
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-0.5 text-right text-xs text-slate-500 dark:text-zinc-400">
            הדבק כאן את פלט ה-JSON שקיבלת מ-GEM בונה האפליקציות. הסעיפים יתמלאו אוטומטית.
          </DialogPrimitive.Description>

          {/* Collapsible format reminder */}
          <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="cursor-pointer select-none px-3 py-2 text-[11px] text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
              פורמט JSON צפוי ▾
            </summary>
            <pre
              dir="ltr"
              className="overflow-x-auto px-3 pb-3 pt-1 text-[10px] leading-relaxed text-slate-600 dark:text-zinc-300"
            >
              {JSON_EXAMPLE}
            </pre>
          </details>

          {/* Paste area */}
          <textarea
            dir="ltr"
            rows={12}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder='{ "contentType": "appBuilder", ... }'
            spellCheck={false}
            className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />

          {/* Validation error */}
          {error && (
            <div
              dir="rtl"
              className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400"
            >
              ⚠ {error}
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center justify-between gap-2">
            {/* Left: clear text only */}
            <button
              type="button"
              onClick={handleClearText}
              disabled={!text}
              title="מחק רק את המלל שהודבק כאן — לא מוחק את הטיוטה השמורה"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחק מלל
            </button>

            {/* Right: cancel + apply */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                סגור
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!text.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Clipboard className="h-3.5 w-3.5" />
                אשר והדבק
              </button>
            </div>
          </div>

          <DialogPrimitive.Close className="absolute left-4 top-4 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
            <span className="sr-only">סגור</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
