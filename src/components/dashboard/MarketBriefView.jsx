import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ObsidianIcon } from "@/components/shared/ObsidianIcon";

const SECTIONS = [
  { key: "snapshot",          emoji: "⚡", label: "תמונת מצב",      kind: "list" },
  { key: "opportunities",     emoji: "🎯", label: "הזדמנויות",       kind: "list" },
  { key: "stocks",            emoji: "📈", label: "מניות וטיקרים",   kind: "stocks" },
  { key: "stockOfDay",        emoji: "🔥", label: "מניית היום",      kind: "single" },
  { key: "risks",             emoji: "🚨", label: "סיכונים ואזהרות", kind: "list" },
  { key: "watchThisWeek",     emoji: "📅", label: "מה לעקוב השבוע", kind: "list" },
  { key: "macro",             emoji: "🌎", label: "מאקרו",           kind: "list" },
  { key: "reusableKnowledge", emoji: "🧠", label: "ידע רב פעמי",    kind: "list" },
  { key: "actionChecklist",   emoji: "📋", label: "צ'קליסט פעולה",  kind: "checklist" },
];

function getItemText(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return String(item ?? "");
  if (item.ticker) {
    return [item.ticker, item.action, item.price, item.note].filter(Boolean).join(" · ");
  }
  return Object.values(item).filter(v => v && typeof v === "string").join(" · ");
}

function getSectionItems(data, section) {
  const val = data?.[section.key];
  if (!val) return [];
  if (section.kind === "single") {
    if (Array.isArray(val)) return val.map(getItemText).filter(Boolean);
    if (typeof val === "object" && val !== null) {
      return Object.entries(val)
        .filter(([, v]) => v && (typeof v === "string" || typeof v === "number"))
        .map(([k, v]) => `${k}: ${v}`);
    }
    return val ? [String(val)] : [];
  }
  if (Array.isArray(val)) return val.map(getItemText).filter(Boolean);
  if (typeof val === "string") return [val];
  return [];
}

function copyText(text) {
  navigator.clipboard.writeText(text)
    .then(() => toast.success("הועתק ✓"))
    .catch(() => toast.error("שגיאה בהעתקה"));
}

function ItemRow({ text, onCopy, onBrain, onObsidian, onWorkspace }) {
  return (
    <div className="group flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-white/80 dark:hover:bg-zinc-800/60 transition-colors">
      <span className="flex-1 text-sm text-slate-700 dark:text-zinc-300 leading-relaxed text-right">
        {text}
      </span>
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onBrain && (
          <button
            type="button"
            onClick={() => onBrain(text)}
            title="שמור למוח"
            className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm leading-none transition-colors"
          >
            🧠
          </button>
        )}
        {onObsidian && (
          <button
            type="button"
            onClick={() => onObsidian(text)}
            title="שמור ל-Obsidian"
            className="p-1 rounded text-violet-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 text-sm leading-none transition-colors"
          >
            <ObsidianIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {onWorkspace && (
          <button
            type="button"
            onClick={() => onWorkspace(text)}
            title="שמור ל-Workspace"
            className="p-1 rounded text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-sm leading-none transition-colors"
          >
            📚
          </button>
        )}
        <button
          type="button"
          onClick={() => onCopy(text)}
          title="העתק"
          className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function MarketBriefView({ data, onSaveToBrain, onSaveToObsidian, onSaveToWorkspace }) {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].key);

  const activeSec = SECTIONS.find(s => s.key === activeSection) ?? SECTIONS[0];
  const items = getSectionItems(data, activeSec);

  return (
    <div className="space-y-3" dir="rtl">
      {/* Meta header */}
      {(data?.briefDate || data?.marketSession || data?.channelName) && (
        <div className="flex flex-wrap gap-2 items-center text-xs px-1">
          {data?.channelName && (
            <span className="font-semibold text-slate-700 dark:text-zinc-200">{data.channelName}</span>
          )}
          {data?.briefDate && (
            <span className="bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full">
              {data.briefDate}
            </span>
          )}
          {data?.marketSession && (
            <span className="bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
              {data.marketSession}
            </span>
          )}
          {data?.duration && (
            <span className="text-slate-500 dark:text-zinc-400">{data.duration}</span>
          )}
        </div>
      )}

      {/* Section selector */}
      <div className="flex flex-wrap gap-1.5 pb-1">
        {SECTIONS.map(s => {
          const cnt = getSectionItems(data, s).length;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveSection(s.key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all",
                activeSection === s.key
                  ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm font-semibold"
                  : "text-slate-500 dark:text-zinc-400 hover:bg-white/70 dark:hover:bg-zinc-800/60"
              )}
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
              {cnt > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-px text-[9px] font-bold leading-none",
                  activeSection === s.key
                    ? "bg-slate-100 dark:bg-zinc-600 text-slate-600 dark:text-zinc-200"
                    : "bg-slate-200/80 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400"
                )}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Section content */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-900/60 px-3 py-3 min-h-[200px]">
        {/* Section header */}
        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200/70 dark:border-zinc-700/50">
          <button
            type="button"
            onClick={() => items.length && copyText(items.join("\n"))}
            disabled={!items.length}
            className="text-[11px] text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 flex items-center gap-1 disabled:opacity-30 transition-colors"
          >
            <Copy className="h-3 w-3" />
            העתק הכל
          </button>
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
            {activeSec.emoji} {activeSec.label}
            {items.length > 0 && (
              <span className="text-[11px] font-normal text-slate-400 dark:text-zinc-500 mr-1">
                ({items.length})
              </span>
            )}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-zinc-500 text-right py-4">
            אין נתונים עבור סעיף זה
          </p>
        ) : (
          <div className="space-y-0.5">
            {items.map((text, i) => (
              <ItemRow
                key={i}
                text={text}
                onCopy={copyText}
                onBrain={onSaveToBrain ?? null}
                onObsidian={onSaveToObsidian ?? null}
                onWorkspace={onSaveToWorkspace ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
