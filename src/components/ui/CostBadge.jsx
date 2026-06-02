import { cn } from "@/lib/utils";

const VARIANTS = {
  free: {
    dot: "bg-green-500",
    label: "חינם",
    emoji: "🟢",
    tooltip: "פעולה זו אינה צורכת קרדיטים ואינה מבצעת קריאת API בתשלום.",
    classes: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
  },
  gemini: {
    dot: "bg-yellow-500",
    label: "Gemini",
    emoji: "🟡",
    tooltip: "פעולה זו משתמשת ב-Google Gemini API.",
    classes: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400",
  },
  claude: {
    dot: "bg-red-500",
    label: "Claude API",
    emoji: "🔴",
    tooltip: "פעולה זו שולחת נתונים ל-Anthropic Claude API ועלולה לצרוך קרדיטים.",
    classes: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  },
  local: {
    dot: "bg-yellow-500",
    label: "AI מקומי",
    emoji: "🟡",
    tooltip: "פעולה זו משתמשת ב-AI מקומי (Ollama) ואינה שולחת נתונים לאינטרנט.",
    classes: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400",
  },
};

export function CostBadge({ variant = "free", className }) {
  const v = VARIANTS[variant] || VARIANTS.free;
  return (
    <span
      title={v.tooltip}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold select-none cursor-help",
        v.classes,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", v.dot)} />
      {v.label}
    </span>
  );
}
