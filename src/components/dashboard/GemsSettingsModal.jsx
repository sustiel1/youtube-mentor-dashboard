import React, { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ExternalLink, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import {
  GEMS_CONFIG_KEY,
  defaultGems,
  getGemUrl,
  openGeminiGemUrl,
} from "@/lib/gemsConfig";

const GEM_ROWS = [
  { key: "fundamental", label: "פונדמנטלי", icon: "📊" },
  { key: "appBuilder", label: "App Builder", icon: "🏗️" },
  { key: "political", label: "פוליטי", icon: "🏛️" },
  { key: "general", label: "כללי", icon: "✨" },
  { key: "technical", label: "טכני", icon: "📈" },
  { key: "macro", label: "מאקרו", icon: "🌍" },
  { key: "news", label: "מבזק בוקר", icon: "📰" },
];

function loadGems() {
  try {
    const raw = localStorage.getItem(GEMS_CONFIG_KEY);
    if (!raw) return { ...defaultGems };
    return { ...defaultGems, ...JSON.parse(raw) };
  } catch {
    return { ...defaultGems };
  }
}

export function GemsSettingsModal({ open, onOpenChange }) {
  const [gems, setGems] = useState(loadGems);

  useEffect(() => {
    if (open) setGems(loadGems());
  }, [open]);

  const handleSave = () => {
    try {
      localStorage.setItem(GEMS_CONFIG_KEY, JSON.stringify(gems));
      toast.success("הגדרות נשמרו");
      onOpenChange(false);
    } catch {
      toast.error("שגיאה בשמירת ההגדרות");
    }
  };

  const handleTestUrl = (key) => {
    const resolvedUrl = getGemUrl(key);
    const ok = openGeminiGemUrl(resolvedUrl);
    if (!ok) {
      toast.info("הפופ-אפ נחסם — פתח את ה-Gem ידנית", {
        description: resolvedUrl,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[340] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          className="fixed left-[50%] top-[50%] z-[350] w-full max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="text-right text-base font-semibold text-slate-900 dark:text-zinc-100">
            הגדרות GEMS
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            ניהול כתובות Gemini Gems שנשמרות ב-localStorage
          </DialogPrimitive.Description>

          <div className="mt-4 space-y-3">
            {GEM_ROWS.map(({ key, label, icon }) => (
              <div key={key}>
                <div className="mb-1 text-xs font-medium text-slate-600 dark:text-zinc-400">
                  {icon} {label}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={gems[key] || ""}
                    onChange={(e) =>
                      setGems((prev) => ({ ...prev, [key]: e.target.value.trim() }))
                    }
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    disabled={!gems[key]}
                    onClick={() => handleTestUrl(key)}
                    title="בדוק קישור"
                    className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Save className="h-4 w-4" />
              שמור הגדרות
            </button>
          </div>

          <DialogPrimitive.Close className="absolute left-4 top-4 rounded-md p-1 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
            <span className="sr-only">סגור</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
