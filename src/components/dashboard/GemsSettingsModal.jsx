import React, { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ExternalLink, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import {
  getGemConfigSnapshot,
  openGeminiGemUrl,
  saveGemConfigSnapshot,
} from "@/lib/gemsConfig";

const GEM_ROWS = [
  { key: "fundamental", label: "פונדמנטלי", icon: "📊" },
  { key: "technical",   label: "טכני",       icon: "📈" },
  { key: "political",   label: "פוליטי",     icon: "🏛️" },
  { key: "macro",       label: "מאקרו",      icon: "🌍" },
  { key: "news",        label: "מבזק בוקר", icon: "📰" },
  { key: "appBuilder",  label: "App Builder",icon: "🏗️" },
  { key: "general",     label: "כללי",       icon: "✨" },
];

export function GemsSettingsModal({ open, onOpenChange, focusKey = null }) {
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (open) setDraft(getGemConfigSnapshot());
  }, [open]);

  const handleSave = () => {
    try {
      saveGemConfigSnapshot(draft);
      toast.success("הגדרות GEMS נשמרו");
      onOpenChange(false);
    } catch {
      toast.error("שגיאה בשמירת ההגדרות");
    }
  };

  const handleTest = (key) => {
    const url = draft[key] || "";
    if (!url) { toast.error("אין URL להפעלה"); return; }
    if (!openGeminiGemUrl(url)) {
      toast.info("הפופ-אפ נחסם — פתח ידנית", { description: url });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[360] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          className="fixed left-[50%] top-[50%] z-[370] w-full max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="text-right text-base font-semibold text-slate-900 dark:text-zinc-100">
            ⚙ ניהול כל ה-GEMS
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-0.5 text-right text-xs text-slate-500 dark:text-zinc-400">
            כתובות Gem נשמרות ב-localStorage ומשותפות לכל הסרטונים
          </DialogPrimitive.Description>

          <div className="mt-4 space-y-3">
            {GEM_ROWS.map(({ key, label, icon }) => {
              const hasUrl = Boolean(draft[key]);
              const isFocused = key === focusKey;
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-base leading-none">{icon}</span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{label}</span>
                    {!hasUrl && (
                      <span className="mr-auto text-[10px] font-bold text-red-500 dark:text-red-400">⚠ חסר URL</span>
                    )}
                    {hasUrl && (
                      <span className="mr-auto inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        מוגדר
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      dir="ltr"
                      autoFocus={isFocused}
                      value={draft[key] || ""}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [key]: e.target.value.trim() }))
                      }
                      placeholder="https://gemini.google.com/gem/..."
                      className={`flex-1 rounded-lg border px-3 py-2 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:text-zinc-100 dark:bg-zinc-900 ${
                        hasUrl
                          ? "border-slate-200 bg-white dark:border-zinc-700"
                          : "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/10"
                      }`}
                    />
                    <button
                      type="button"
                      disabled={!draft[key]}
                      onClick={() => handleTest(key)}
                      title="בדוק קישור"
                      className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
            >
              <Save className="h-4 w-4" />
              שמור את כל ה-GEMS
            </button>
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
