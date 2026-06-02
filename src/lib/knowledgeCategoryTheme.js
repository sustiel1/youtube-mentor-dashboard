/**
 * Subtle category colors for Useful Knowledge sections (RTL-friendly).
 * Presentation only — no data/logic coupling.
 */

import { cn } from "@/lib/utils";

/** Shared base for knowledge filter pills (Linear / Vercel–style). */
export const KNOWLEDGE_FILTER_TAB_BASE =
  "group relative inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-tight transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.97]";

const DEFAULT = {
  header: "text-slate-600 dark:text-zinc-400",
  headerBg: "bg-slate-50/80 dark:bg-zinc-900/50",
  sectionBorder: "border-slate-200/80 dark:border-zinc-800/80",
  sectionBg: "bg-white/40 dark:bg-zinc-950/20",
  accentRail: "border-slate-300/50 dark:border-zinc-600/50",
  rowChecked:
    "border-indigo-300/90 bg-indigo-50/80 text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-100",
  rowHover: "hover:bg-slate-50/80 dark:hover:bg-zinc-800/50",
  checkboxChecked: "border-indigo-500 bg-indigo-500",
  checkboxIdle: "border-slate-300 bg-white dark:border-zinc-600 dark:bg-zinc-900",
  filterActive: "border-indigo-600 bg-indigo-600 text-white",
  filterIdle:
    "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
};

/** @type {Record<string, typeof DEFAULT>} */
const THEMES = {
  definition: {
    header: "text-emerald-800 dark:text-emerald-300",
    headerBg: "bg-emerald-50/90 dark:bg-emerald-950/35",
    sectionBorder: "border-emerald-200/70 dark:border-emerald-800/45",
    sectionBg: "bg-emerald-50/25 dark:bg-emerald-950/12",
    accentRail: "border-emerald-400/55 dark:border-emerald-500/45",
    rowChecked:
      "border-emerald-300/90 bg-emerald-50/90 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/45 dark:text-emerald-100",
    rowHover: "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/25",
    checkboxChecked: "border-emerald-600 bg-emerald-600",
    checkboxIdle: "border-emerald-200 bg-white dark:border-emerald-700 dark:bg-zinc-900",
    filterActive: "border-emerald-600 bg-emerald-600 text-white",
    filterIdle:
      "border-emerald-200/80 bg-white text-emerald-800 hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-zinc-900 dark:text-emerald-300",
  },
  rule: {
    header: "text-blue-800 dark:text-blue-300",
    headerBg: "bg-blue-50/90 dark:bg-blue-950/35",
    sectionBorder: "border-blue-200/70 dark:border-blue-800/45",
    sectionBg: "bg-blue-50/25 dark:bg-blue-950/12",
    accentRail: "border-blue-400/55 dark:border-blue-500/45",
    rowChecked:
      "border-blue-300/90 bg-blue-50/90 text-blue-950 dark:border-blue-500/40 dark:bg-blue-950/45 dark:text-blue-100",
    rowHover: "hover:bg-blue-50/50 dark:hover:bg-blue-950/25",
    checkboxChecked: "border-blue-600 bg-blue-600",
    checkboxIdle: "border-blue-200 bg-white dark:border-blue-700 dark:bg-zinc-900",
    filterActive: "border-blue-600 bg-blue-600 text-white",
    filterIdle:
      "border-blue-200/80 bg-white text-blue-800 hover:border-blue-300 dark:border-blue-900/50 dark:bg-zinc-900 dark:text-blue-300",
  },
  warning: {
    header: "text-amber-900 dark:text-amber-200",
    headerBg: "bg-amber-50/90 dark:bg-amber-950/35",
    sectionBorder: "border-amber-200/70 dark:border-amber-800/45",
    sectionBg: "bg-amber-50/25 dark:bg-amber-950/12",
    accentRail: "border-amber-400/55 dark:border-amber-500/45",
    rowChecked:
      "border-amber-300/90 bg-amber-50/90 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/45 dark:text-amber-100",
    rowHover: "hover:bg-amber-50/50 dark:hover:bg-amber-950/25",
    checkboxChecked: "border-amber-600 bg-amber-600",
    checkboxIdle: "border-amber-200 bg-white dark:border-amber-700 dark:bg-zinc-900",
    filterActive: "border-amber-600 bg-amber-600 text-white",
    filterIdle:
      "border-amber-200/80 bg-white text-amber-900 hover:border-amber-300 dark:border-amber-900/50 dark:bg-zinc-900 dark:text-amber-200",
  },
  insight: {
    header: "text-violet-800 dark:text-violet-300",
    headerBg: "bg-violet-50/90 dark:bg-violet-950/35",
    sectionBorder: "border-violet-200/70 dark:border-violet-800/45",
    sectionBg: "bg-violet-50/25 dark:bg-violet-950/12",
    accentRail: "border-violet-400/55 dark:border-violet-500/45",
    rowChecked:
      "border-violet-300/90 bg-violet-50/90 text-violet-950 dark:border-violet-500/40 dark:bg-violet-950/45 dark:text-violet-100",
    rowHover: "hover:bg-violet-50/50 dark:hover:bg-violet-950/25",
    checkboxChecked: "border-violet-600 bg-violet-600",
    checkboxIdle: "border-violet-200 bg-white dark:border-violet-700 dark:bg-zinc-900",
    filterActive: "border-violet-600 bg-violet-600 text-white",
    filterIdle:
      "border-violet-200/80 bg-white text-violet-800 hover:border-violet-300 dark:border-violet-900/50 dark:bg-zinc-900 dark:text-violet-300",
  },
  prompt: {
    header: "text-pink-800 dark:text-pink-300",
    headerBg: "bg-pink-50/90 dark:bg-pink-950/35",
    sectionBorder: "border-pink-200/70 dark:border-pink-800/45",
    sectionBg: "bg-pink-50/25 dark:bg-pink-950/12",
    accentRail: "border-pink-400/55 dark:border-pink-500/45",
    rowChecked:
      "border-pink-300/90 bg-pink-50/90 text-pink-950 dark:border-pink-500/40 dark:bg-pink-950/45 dark:text-pink-100",
    rowHover: "hover:bg-pink-50/50 dark:hover:bg-pink-950/25",
    checkboxChecked: "border-pink-600 bg-pink-600",
    checkboxIdle: "border-pink-200 bg-white dark:border-pink-700 dark:bg-zinc-900",
    filterActive: "border-pink-600 bg-pink-600 text-white",
    filterIdle:
      "border-pink-200/80 bg-white text-pink-800 hover:border-pink-300 dark:border-pink-900/50 dark:bg-zinc-900 dark:text-pink-300",
  },
  app: {
    header: "text-cyan-800 dark:text-cyan-300",
    headerBg: "bg-cyan-50/90 dark:bg-cyan-950/35",
    sectionBorder: "border-cyan-200/70 dark:border-cyan-800/45",
    sectionBg: "bg-cyan-50/25 dark:bg-cyan-950/12",
    accentRail: "border-cyan-400/55 dark:border-cyan-500/45",
    rowChecked:
      "border-cyan-300/90 bg-cyan-50/90 text-cyan-950 dark:border-cyan-500/40 dark:bg-cyan-950/45 dark:text-cyan-100",
    rowHover: "hover:bg-cyan-50/50 dark:hover:bg-cyan-950/25",
    checkboxChecked: "border-cyan-600 bg-cyan-600",
    checkboxIdle: "border-cyan-200 bg-white dark:border-cyan-700 dark:bg-zinc-900",
    filterActive: "border-cyan-600 bg-cyan-600 text-white",
    filterIdle:
      "border-cyan-200/80 bg-white text-cyan-800 hover:border-cyan-300 dark:border-cyan-900/50 dark:bg-zinc-900 dark:text-cyan-300",
  },
  kpi: {
    header: "text-indigo-800 dark:text-indigo-300",
    headerBg: "bg-indigo-50/90 dark:bg-indigo-950/35",
    sectionBorder: "border-indigo-200/70 dark:border-indigo-800/45",
    sectionBg: "bg-indigo-50/25 dark:bg-indigo-950/12",
    accentRail: "border-indigo-400/55 dark:border-indigo-500/45",
    rowChecked:
      "border-indigo-300/90 bg-indigo-50/90 text-indigo-950 dark:border-indigo-500/40 dark:bg-indigo-950/45 dark:text-indigo-100",
    rowHover: "hover:bg-indigo-50/50 dark:hover:bg-indigo-950/25",
    checkboxChecked: "border-indigo-600 bg-indigo-600",
    checkboxIdle: "border-indigo-200 bg-white dark:border-indigo-700 dark:bg-zinc-900",
    filterActive: "border-indigo-600 bg-indigo-600 text-white",
    filterIdle:
      "border-indigo-200/80 bg-white text-indigo-800 hover:border-indigo-300 dark:border-indigo-900/50 dark:bg-zinc-900 dark:text-indigo-300",
  },
  keyPoints: {
    header: "text-slate-700 dark:text-zinc-300",
    headerBg: "bg-slate-50/90 dark:bg-zinc-900/50",
    sectionBorder: "border-slate-200/80 dark:border-zinc-700/50",
    sectionBg: "bg-slate-50/20 dark:bg-zinc-900/15",
    accentRail: "border-slate-400/45 dark:border-zinc-500/45",
    rowChecked:
      "border-slate-300/90 bg-slate-50/90 text-slate-900 dark:border-zinc-500/40 dark:bg-zinc-900/50 dark:text-zinc-100",
    rowHover: "hover:bg-slate-50/60 dark:hover:bg-zinc-800/40",
    checkboxChecked: "border-slate-600 bg-slate-600",
    checkboxIdle: "border-slate-300 bg-white dark:border-zinc-600 dark:bg-zinc-900",
    filterActive: "border-slate-600 bg-slate-600 text-white",
    filterIdle:
      "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  },
  actionItems: {
    header: "text-teal-800 dark:text-teal-300",
    headerBg: "bg-teal-50/90 dark:bg-teal-950/35",
    sectionBorder: "border-teal-200/70 dark:border-teal-800/45",
    sectionBg: "bg-teal-50/25 dark:bg-teal-950/12",
    accentRail: "border-teal-400/55 dark:border-teal-500/45",
    rowChecked:
      "border-teal-300/90 bg-teal-50/90 text-teal-950 dark:border-teal-500/40 dark:bg-teal-950/45 dark:text-teal-100",
    rowHover: "hover:bg-teal-50/50 dark:hover:bg-teal-950/25",
    checkboxChecked: "border-teal-600 bg-teal-600",
    checkboxIdle: "border-teal-200 bg-white dark:border-teal-700 dark:bg-zinc-900",
    filterActive: "border-teal-600 bg-teal-600 text-white",
    filterIdle:
      "border-teal-200/80 bg-white text-teal-800 hover:border-teal-300 dark:border-teal-900/50 dark:bg-zinc-900 dark:text-teal-300",
  },
  mainLesson: {
    header: "text-indigo-800 dark:text-indigo-300",
    headerBg: "bg-indigo-50/90 dark:bg-indigo-950/35",
    sectionBorder: "border-indigo-200/70 dark:border-indigo-800/45",
    sectionBg: "bg-indigo-50/25 dark:bg-indigo-950/12",
    accentRail: "border-indigo-400/55 dark:border-indigo-500/45",
    rowChecked:
      "border-indigo-300/90 bg-indigo-50/90 text-indigo-950 dark:border-indigo-500/40 dark:bg-indigo-950/45 dark:text-indigo-100",
    rowHover: "hover:bg-indigo-50/50 dark:hover:bg-indigo-950/25",
    checkboxChecked: "border-indigo-600 bg-indigo-600",
    checkboxIdle: "border-indigo-200 bg-white dark:border-indigo-700 dark:bg-zinc-900",
    filterActive: "border-indigo-600 bg-indigo-600 text-white",
    filterIdle:
      "border-indigo-200/80 bg-white text-indigo-800 hover:border-indigo-300 dark:border-indigo-900/50 dark:bg-zinc-900 dark:text-indigo-300",
  },
  // Political field keys
  mainClaim: {
    header: "text-rose-800 dark:text-rose-300",
    headerBg: "bg-rose-50/90 dark:bg-rose-950/35",
    sectionBorder: "border-rose-200/70 dark:border-rose-800/45",
    sectionBg: "bg-rose-50/25 dark:bg-rose-950/12",
    accentRail: "border-rose-400/55 dark:border-rose-500/45",
    rowChecked:
      "border-rose-300/90 bg-rose-50/90 text-rose-950 dark:border-rose-500/40 dark:bg-rose-950/45 dark:text-rose-100",
    rowHover: "hover:bg-rose-50/50 dark:hover:bg-rose-950/25",
    checkboxChecked: "border-rose-600 bg-rose-600",
    checkboxIdle: "border-rose-200 bg-white dark:border-rose-700 dark:bg-zinc-900",
    filterActive: "border-rose-600 bg-rose-600 text-white",
    filterIdle:
      "border-rose-200/80 bg-white text-rose-800 hover:border-rose-300 dark:border-rose-900/50 dark:bg-zinc-900 dark:text-rose-300",
  },
  speakerPosition: {
    header: "text-amber-900 dark:text-amber-200",
    headerBg: "bg-amber-50/90 dark:bg-amber-950/35",
    sectionBorder: "border-amber-200/70 dark:border-amber-800/45",
    sectionBg: "bg-amber-50/25 dark:bg-amber-950/12",
    accentRail: "border-amber-400/55 dark:border-amber-500/45",
    rowChecked:
      "border-amber-300/90 bg-amber-50/90 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/45 dark:text-amber-100",
    rowHover: "hover:bg-amber-50/50 dark:hover:bg-amber-950/25",
    checkboxChecked: "border-amber-600 bg-amber-600",
    checkboxIdle: "border-amber-200 bg-white dark:border-amber-700 dark:bg-zinc-900",
    filterActive: "border-amber-600 bg-amber-600 text-white",
    filterIdle:
      "border-amber-200/80 bg-white text-amber-900 hover:border-amber-300 dark:border-amber-900/50 dark:bg-zinc-900 dark:text-amber-200",
  },
  politicalArguments: {
    header: "text-blue-800 dark:text-blue-300",
    headerBg: "bg-blue-50/90 dark:bg-blue-950/35",
    sectionBorder: "border-blue-200/70 dark:border-blue-800/45",
    sectionBg: "bg-blue-50/25 dark:bg-blue-950/12",
    accentRail: "border-blue-400/55 dark:border-blue-500/45",
    rowChecked:
      "border-blue-300/90 bg-blue-50/90 text-blue-950 dark:border-blue-500/40 dark:bg-blue-950/45 dark:text-blue-100",
    rowHover: "hover:bg-blue-50/50 dark:hover:bg-blue-950/25",
    checkboxChecked: "border-blue-600 bg-blue-600",
    checkboxIdle: "border-blue-200 bg-white dark:border-blue-700 dark:bg-zinc-900",
    filterActive: "border-blue-600 bg-blue-600 text-white",
    filterIdle:
      "border-blue-200/80 bg-white text-blue-800 hover:border-blue-300 dark:border-blue-900/50 dark:bg-zinc-900 dark:text-blue-300",
  },
  weakPoints: {
    header: "text-orange-800 dark:text-orange-300",
    headerBg: "bg-orange-50/90 dark:bg-orange-950/35",
    sectionBorder: "border-orange-200/70 dark:border-orange-800/45",
    sectionBg: "bg-orange-50/25 dark:bg-orange-950/12",
    accentRail: "border-orange-400/55 dark:border-orange-500/45",
    rowChecked:
      "border-orange-300/90 bg-orange-50/90 text-orange-950 dark:border-orange-500/40 dark:bg-orange-950/45 dark:text-orange-100",
    rowHover: "hover:bg-orange-50/50 dark:hover:bg-orange-950/25",
    checkboxChecked: "border-orange-600 bg-orange-600",
    checkboxIdle: "border-orange-200 bg-white dark:border-orange-700 dark:bg-zinc-900",
    filterActive: "border-orange-600 bg-orange-600 text-white",
    filterIdle:
      "border-orange-200/80 bg-white text-orange-800 hover:border-orange-300 dark:border-orange-900/50 dark:bg-zinc-900 dark:text-orange-300",
  },
  counterArguments: {
    header: "text-rose-800 dark:text-rose-300",
    headerBg: "bg-rose-50/90 dark:bg-rose-950/35",
    sectionBorder: "border-rose-200/70 dark:border-rose-800/45",
    sectionBg: "bg-rose-50/25 dark:bg-rose-950/12",
    accentRail: "border-rose-400/55 dark:border-rose-500/45",
    rowChecked:
      "border-rose-300/90 bg-rose-50/90 text-rose-950 dark:border-rose-500/40 dark:bg-rose-950/45 dark:text-rose-100",
    rowHover: "hover:bg-rose-50/50 dark:hover:bg-rose-950/25",
    checkboxChecked: "border-rose-600 bg-rose-600",
    checkboxIdle: "border-rose-200 bg-white dark:border-rose-700 dark:bg-zinc-900",
    filterActive: "border-rose-600 bg-rose-600 text-white",
    filterIdle:
      "border-rose-200/80 bg-white text-rose-800 hover:border-rose-300 dark:border-rose-900/50 dark:bg-zinc-900 dark:text-rose-300",
  },
  socialMediaReplies: {
    header: "text-purple-800 dark:text-purple-300",
    headerBg: "bg-purple-50/90 dark:bg-purple-950/35",
    sectionBorder: "border-purple-200/70 dark:border-purple-800/45",
    sectionBg: "bg-purple-50/25 dark:bg-purple-950/12",
    accentRail: "border-purple-400/55 dark:border-purple-500/45",
    rowChecked:
      "border-purple-300/90 bg-purple-50/90 text-purple-950 dark:border-purple-500/40 dark:bg-purple-950/45 dark:text-purple-100",
    rowHover: "hover:bg-purple-50/50 dark:hover:bg-purple-950/25",
    checkboxChecked: "border-purple-600 bg-purple-600",
    checkboxIdle: "border-purple-200 bg-white dark:border-purple-700 dark:bg-zinc-900",
    filterActive: "border-purple-600 bg-purple-600 text-white",
    filterIdle:
      "border-purple-200/80 bg-white text-purple-800 hover:border-purple-300 dark:border-purple-900/50 dark:bg-zinc-900 dark:text-purple-300",
  },
};

const KEY_ALIASES = {
  concepts: "definition",
  warnings: "warning",
  mistakesToAvoid: "warning",
  keyInsights: "insight",
  brainHighlights: "insight",
  suggestedFeatures: "app",
  feature: "app",
};

export function resolveKnowledgeCategoryKey(key) {
  if (!key || key === "all") return null;
  const raw = String(key).trim();
  if (THEMES[raw]) return raw;
  if (KEY_ALIASES[raw]) return KEY_ALIASES[raw];
  return "keyPoints";
}

export function getKnowledgeCategoryTheme(categoryKey) {
  const resolved = resolveKnowledgeCategoryKey(categoryKey);
  if (!resolved || !THEMES[resolved]) return DEFAULT;
  return THEMES[resolved];
}

/** Vivid count badges — matched to category accent, high contrast at a glance. */
function makeFilterCountBadges(accent) {
  const badges = {
    default: {
      countActive:
        "bg-white text-slate-900 shadow-[0_1px_5px_rgba(0,0,0,0.18)] ring-1 ring-white/90 dark:bg-white dark:text-slate-900",
      countIdle:
        "bg-slate-200 text-slate-900 border border-slate-300 shadow-[0_1px_3px_rgba(71,85,105,0.14)] ring-1 ring-slate-200/80 group-hover:bg-slate-300 group-hover:border-slate-400/90 dark:bg-zinc-600 dark:text-zinc-50 dark:border-zinc-500 dark:ring-zinc-500/40 dark:group-hover:bg-zinc-500",
    },
    emerald: {
      countActive:
        "bg-white text-emerald-700 shadow-[0_1px_5px_rgba(5,150,105,0.35)] ring-1 ring-white/90 dark:text-emerald-800",
      countIdle:
        "bg-emerald-200 text-emerald-950 border border-emerald-400/80 shadow-[0_1px_4px_rgba(16,185,129,0.22)] ring-1 ring-emerald-300/60 group-hover:bg-emerald-300 group-hover:border-emerald-500/80 dark:bg-emerald-600 dark:text-emerald-50 dark:border-emerald-400/70 dark:ring-emerald-500/35 dark:group-hover:bg-emerald-500",
    },
    blue: {
      countActive:
        "bg-white text-blue-700 shadow-[0_1px_5px_rgba(37,99,235,0.35)] ring-1 ring-white/90 dark:text-blue-300",
      countIdle:
        "bg-blue-200 text-blue-950 border border-blue-400/80 shadow-[0_1px_4px_rgba(59,130,246,0.22)] ring-1 ring-blue-300/60 group-hover:bg-blue-300 group-hover:border-blue-500/80 dark:bg-blue-600 dark:text-blue-50 dark:border-blue-400/70 dark:ring-blue-500/35 dark:group-hover:bg-blue-500",
    },
    amber: {
      countActive:
        "bg-white text-amber-800 shadow-[0_1px_5px_rgba(217,119,6,0.35)] ring-1 ring-white/90 dark:text-amber-200",
      countIdle:
        "bg-amber-200 text-amber-950 border border-amber-400/80 shadow-[0_1px_4px_rgba(245,158,11,0.25)] ring-1 ring-amber-300/60 group-hover:bg-amber-300 group-hover:border-amber-500/80 dark:bg-amber-600 dark:text-amber-50 dark:border-amber-400/70 dark:ring-amber-500/35 dark:group-hover:bg-amber-500",
    },
    violet: {
      countActive:
        "bg-white text-violet-700 shadow-[0_1px_5px_rgba(124,58,237,0.35)] ring-1 ring-white/90 dark:text-violet-200",
      countIdle:
        "bg-violet-200 text-violet-950 border border-violet-400/80 shadow-[0_1px_4px_rgba(139,92,246,0.24)] ring-1 ring-violet-300/60 group-hover:bg-violet-300 group-hover:border-violet-500/80 dark:bg-violet-600 dark:text-violet-50 dark:border-violet-400/70 dark:ring-violet-500/35 dark:group-hover:bg-violet-500",
    },
    pink: {
      countActive:
        "bg-white text-pink-700 shadow-[0_1px_5px_rgba(219,39,119,0.32)] ring-1 ring-white/90 dark:text-pink-200",
      countIdle:
        "bg-pink-200 text-pink-950 border border-pink-400/80 shadow-[0_1px_4px_rgba(236,72,153,0.22)] ring-1 ring-pink-300/60 group-hover:bg-pink-300 group-hover:border-pink-500/80 dark:bg-pink-600 dark:text-pink-50 dark:border-pink-400/70 dark:ring-pink-500/35 dark:group-hover:bg-pink-500",
    },
    cyan: {
      countActive:
        "bg-white text-cyan-800 shadow-[0_1px_5px_rgba(8,145,178,0.32)] ring-1 ring-white/90 dark:text-cyan-100",
      countIdle:
        "bg-cyan-200 text-cyan-950 border border-cyan-400/80 shadow-[0_1px_4px_rgba(6,182,212,0.22)] ring-1 ring-cyan-300/60 group-hover:bg-cyan-300 group-hover:border-cyan-500/80 dark:bg-cyan-600 dark:text-cyan-50 dark:border-cyan-400/70 dark:ring-cyan-500/35 dark:group-hover:bg-cyan-500",
    },
    indigo: {
      countActive:
        "bg-white text-indigo-700 shadow-[0_1px_5px_rgba(79,70,229,0.35)] ring-1 ring-white/90 dark:text-indigo-200",
      countIdle:
        "bg-indigo-200 text-indigo-950 border border-indigo-400/80 shadow-[0_1px_4px_rgba(99,102,241,0.24)] ring-1 ring-indigo-300/60 group-hover:bg-indigo-300 group-hover:border-indigo-500/80 dark:bg-indigo-600 dark:text-indigo-50 dark:border-indigo-400/70 dark:ring-indigo-500/35 dark:group-hover:bg-indigo-500",
    },
    slate: {
      countActive:
        "bg-white text-slate-700 shadow-[0_1px_5px_rgba(71,85,105,0.28)] ring-1 ring-white/90 dark:text-slate-200",
      countIdle:
        "bg-slate-200 text-slate-900 border border-slate-400/75 shadow-[0_1px_3px_rgba(100,116,139,0.16)] ring-1 ring-slate-300/50 group-hover:bg-slate-300 group-hover:border-slate-500/70 dark:bg-zinc-600 dark:text-zinc-50 dark:border-zinc-500/70 dark:group-hover:bg-zinc-500",
    },
    teal: {
      countActive:
        "bg-white text-teal-800 shadow-[0_1px_5px_rgba(13,148,136,0.32)] ring-1 ring-white/90 dark:text-teal-100",
      countIdle:
        "bg-teal-200 text-teal-950 border border-teal-400/80 shadow-[0_1px_4px_rgba(20,184,166,0.22)] ring-1 ring-teal-300/60 group-hover:bg-teal-300 group-hover:border-teal-500/80 dark:bg-teal-600 dark:text-teal-50 dark:border-teal-400/70 dark:ring-teal-500/35 dark:group-hover:bg-teal-500",
    },
    rose: {
      countActive:
        "bg-white text-rose-700 shadow-[0_1px_5px_rgba(225,29,72,0.32)] ring-1 ring-white/90 dark:text-rose-100",
      countIdle:
        "bg-rose-200 text-rose-950 border border-rose-400/80 shadow-[0_1px_4px_rgba(244,63,94,0.22)] ring-1 ring-rose-300/60 group-hover:bg-rose-300 group-hover:border-rose-500/80 dark:bg-rose-600 dark:text-rose-50 dark:border-rose-400/70 dark:ring-rose-500/35 dark:group-hover:bg-rose-500",
    },
    orange: {
      countActive:
        "bg-white text-orange-800 shadow-[0_1px_5px_rgba(234,88,12,0.32)] ring-1 ring-white/90 dark:text-orange-100",
      countIdle:
        "bg-orange-200 text-orange-950 border border-orange-400/80 shadow-[0_1px_4px_rgba(249,115,22,0.22)] ring-1 ring-orange-300/60 group-hover:bg-orange-300 group-hover:border-orange-500/80 dark:bg-orange-600 dark:text-orange-50 dark:border-orange-400/70 dark:ring-orange-500/35 dark:group-hover:bg-orange-500",
    },
    purple: {
      countActive:
        "bg-white text-purple-700 shadow-[0_1px_5px_rgba(147,51,234,0.32)] ring-1 ring-white/90 dark:text-purple-100",
      countIdle:
        "bg-purple-200 text-purple-950 border border-purple-400/80 shadow-[0_1px_4px_rgba(168,85,247,0.22)] ring-1 ring-purple-300/60 group-hover:bg-purple-300 group-hover:border-purple-500/80 dark:bg-purple-600 dark:text-purple-50 dark:border-purple-400/70 dark:ring-purple-500/35 dark:group-hover:bg-purple-500",
    },
  };
  return badges[accent] || badges.default;
}

/** Premium filter-pill styles per accent (full Tailwind classes). */
const FILTER_TAB_STYLES = {
  default: {
    active:
      "z-[1] scale-[1.02] border-slate-800/90 bg-slate-900 text-white shadow-[0_4px_16px_-3px_rgba(15,23,42,0.28)] ring-2 ring-slate-500/20 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.45)] dark:ring-white/30",
    idle:
      "border-slate-200/90 bg-white/95 text-slate-600 backdrop-blur-sm dark:border-zinc-700/90 dark:bg-zinc-900/75 dark:text-zinc-400",
    hover:
      "hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_2px_10px_-2px_rgba(15,23,42,0.12)] dark:hover:border-zinc-600 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-100",
    ...makeFilterCountBadges("default"),
  },
  emerald: {
    active:
      "z-[1] scale-[1.02] border-emerald-500/90 bg-emerald-600 text-white shadow-[0_4px_16px_-3px_rgba(5,150,105,0.4)] ring-2 ring-emerald-400/30 dark:shadow-emerald-900/50",
    idle:
      "border-emerald-200/70 bg-emerald-50/50 text-emerald-800/95 dark:border-emerald-900/55 dark:bg-emerald-950/25 dark:text-emerald-300/95",
    hover:
      "hover:-translate-y-px hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-950 hover:shadow-[0_2px_12px_-2px_rgba(16,185,129,0.2)] dark:hover:border-emerald-700 dark:hover:bg-emerald-950/45",
    ...makeFilterCountBadges("emerald"),
  },
  blue: {
    active:
      "z-[1] scale-[1.02] border-blue-500/90 bg-blue-600 text-white shadow-[0_4px_16px_-3px_rgba(37,99,235,0.4)] ring-2 ring-blue-400/30 dark:shadow-blue-900/50",
    idle:
      "border-blue-200/70 bg-blue-50/50 text-blue-800/95 dark:border-blue-900/55 dark:bg-blue-950/25 dark:text-blue-300/95",
    hover:
      "hover:-translate-y-px hover:border-blue-300 hover:bg-blue-50 hover:text-blue-950 hover:shadow-[0_2px_12px_-2px_rgba(59,130,246,0.2)] dark:hover:border-blue-700 dark:hover:bg-blue-950/45",
    ...makeFilterCountBadges("blue"),
  },
  amber: {
    active:
      "z-[1] scale-[1.02] border-amber-500/90 bg-amber-600 text-white shadow-[0_4px_16px_-3px_rgba(217,119,6,0.4)] ring-2 ring-amber-400/30 dark:shadow-amber-900/50",
    idle:
      "border-amber-200/70 bg-amber-50/50 text-amber-900/95 dark:border-amber-900/55 dark:bg-amber-950/25 dark:text-amber-200/95",
    hover:
      "hover:-translate-y-px hover:border-amber-300 hover:bg-amber-50 hover:text-amber-950 hover:shadow-[0_2px_12px_-2px_rgba(245,158,11,0.22)] dark:hover:border-amber-700 dark:hover:bg-amber-950/45",
    ...makeFilterCountBadges("amber"),
  },
  violet: {
    active:
      "z-[1] scale-[1.02] border-violet-500/90 bg-violet-600 text-white shadow-[0_4px_16px_-3px_rgba(124,58,237,0.4)] ring-2 ring-violet-400/30 dark:shadow-violet-900/50",
    idle:
      "border-violet-200/70 bg-violet-50/50 text-violet-800/95 dark:border-violet-900/55 dark:bg-violet-950/25 dark:text-violet-300/95",
    hover:
      "hover:-translate-y-px hover:border-violet-300 hover:bg-violet-50 hover:text-violet-950 hover:shadow-[0_2px_12px_-2px_rgba(139,92,246,0.22)] dark:hover:border-violet-700 dark:hover:bg-violet-950/45",
    ...makeFilterCountBadges("violet"),
  },
  pink: {
    active:
      "z-[1] scale-[1.02] border-pink-500/90 bg-pink-600 text-white shadow-[0_4px_16px_-3px_rgba(219,39,119,0.38)] ring-2 ring-pink-400/30 dark:shadow-pink-900/50",
    idle:
      "border-pink-200/70 bg-pink-50/50 text-pink-800/95 dark:border-pink-900/55 dark:bg-pink-950/25 dark:text-pink-300/95",
    hover:
      "hover:-translate-y-px hover:border-pink-300 hover:bg-pink-50 hover:text-pink-950 hover:shadow-[0_2px_12px_-2px_rgba(236,72,153,0.2)] dark:hover:border-pink-700 dark:hover:bg-pink-950/45",
    ...makeFilterCountBadges("pink"),
  },
  cyan: {
    active:
      "z-[1] scale-[1.02] border-cyan-500/90 bg-cyan-600 text-white shadow-[0_4px_16px_-3px_rgba(8,145,178,0.38)] ring-2 ring-cyan-400/30 dark:shadow-cyan-900/50",
    idle:
      "border-cyan-200/70 bg-cyan-50/50 text-cyan-800/95 dark:border-cyan-900/55 dark:bg-cyan-950/25 dark:text-cyan-300/95",
    hover:
      "hover:-translate-y-px hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-950 hover:shadow-[0_2px_12px_-2px_rgba(6,182,212,0.2)] dark:hover:border-cyan-700 dark:hover:bg-cyan-950/45",
    ...makeFilterCountBadges("cyan"),
  },
  indigo: {
    active:
      "z-[1] scale-[1.02] border-indigo-500/90 bg-indigo-600 text-white shadow-[0_4px_16px_-3px_rgba(79,70,229,0.4)] ring-2 ring-indigo-400/30 dark:shadow-indigo-900/50",
    idle:
      "border-indigo-200/70 bg-indigo-50/50 text-indigo-800/95 dark:border-indigo-900/55 dark:bg-indigo-950/25 dark:text-indigo-300/95",
    hover:
      "hover:-translate-y-px hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-950 hover:shadow-[0_2px_12px_-2px_rgba(99,102,241,0.22)] dark:hover:border-indigo-700 dark:hover:bg-indigo-950/45",
    ...makeFilterCountBadges("indigo"),
  },
  slate: {
    active:
      "z-[1] scale-[1.02] border-slate-500/90 bg-slate-600 text-white shadow-[0_4px_16px_-3px_rgba(71,85,105,0.35)] ring-2 ring-slate-400/25",
    idle:
      "border-slate-200/70 bg-slate-50/50 text-slate-700/95 dark:border-zinc-700/55 dark:bg-zinc-900/40 dark:text-zinc-300/95",
    hover:
      "hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_2px_10px_-2px_rgba(100,116,139,0.15)] dark:hover:border-zinc-600 dark:hover:bg-zinc-800/80",
    ...makeFilterCountBadges("slate"),
  },
  teal: {
    active:
      "z-[1] scale-[1.02] border-teal-500/90 bg-teal-600 text-white shadow-[0_4px_16px_-3px_rgba(13,148,136,0.38)] ring-2 ring-teal-400/30 dark:shadow-teal-900/50",
    idle:
      "border-teal-200/70 bg-teal-50/50 text-teal-800/95 dark:border-teal-900/55 dark:bg-teal-950/25 dark:text-teal-300/95",
    hover:
      "hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50 hover:shadow-[0_2px_12px_-2px_rgba(20,184,166,0.2)] dark:hover:border-teal-700 dark:hover:bg-teal-950/45",
    ...makeFilterCountBadges("teal"),
  },
  rose: {
    active:
      "z-[1] scale-[1.02] border-rose-500/90 bg-rose-600 text-white shadow-[0_4px_16px_-3px_rgba(225,29,72,0.35)] ring-2 ring-rose-400/30 dark:shadow-rose-900/50",
    idle:
      "border-rose-200/70 bg-rose-50/50 text-rose-800/95 dark:border-rose-900/55 dark:bg-rose-950/25 dark:text-rose-300/95",
    hover:
      "hover:-translate-y-px hover:border-rose-300 hover:bg-rose-50 hover:shadow-[0_2px_12px_-2px_rgba(244,63,94,0.2)] dark:hover:border-rose-700 dark:hover:bg-rose-950/45",
    ...makeFilterCountBadges("rose"),
  },
  orange: {
    active:
      "z-[1] scale-[1.02] border-orange-500/90 bg-orange-600 text-white shadow-[0_4px_16px_-3px_rgba(234,88,12,0.38)] ring-2 ring-orange-400/30 dark:shadow-orange-900/50",
    idle:
      "border-orange-200/70 bg-orange-50/50 text-orange-800/95 dark:border-orange-900/55 dark:bg-orange-950/25 dark:text-orange-300/95",
    hover:
      "hover:-translate-y-px hover:border-orange-300 hover:bg-orange-50 hover:shadow-[0_2px_12px_-2px_rgba(249,115,22,0.2)] dark:hover:border-orange-700 dark:hover:bg-orange-950/45",
    ...makeFilterCountBadges("orange"),
  },
  purple: {
    active:
      "z-[1] scale-[1.02] border-purple-500/90 bg-purple-600 text-white shadow-[0_4px_16px_-3px_rgba(147,51,234,0.38)] ring-2 ring-purple-400/30 dark:shadow-purple-900/50",
    idle:
      "border-purple-200/70 bg-purple-50/50 text-purple-800/95 dark:border-purple-900/55 dark:bg-purple-950/25 dark:text-purple-300/95",
    hover:
      "hover:-translate-y-px hover:border-purple-300 hover:bg-purple-50 hover:shadow-[0_2px_12px_-2px_rgba(168,85,247,0.2)] dark:hover:border-purple-700 dark:hover:bg-purple-950/45",
    ...makeFilterCountBadges("purple"),
  },
};

const FILTER_ACCENT_BY_THEME = {
  definition: "emerald",
  rule: "blue",
  warning: "amber",
  insight: "violet",
  prompt: "pink",
  app: "cyan",
  kpi: "indigo",
  keyPoints: "slate",
  actionItems: "teal",
  mainLesson: "indigo",
  mainClaim: "rose",
  speakerPosition: "amber",
  politicalArguments: "blue",
  weakPoints: "orange",
  counterArguments: "rose",
  socialMediaReplies: "purple",
};

export function getKnowledgeFilterTabStyles(categoryKey) {
  if (!categoryKey || categoryKey === "all") return FILTER_TAB_STYLES.default;
  const resolved = resolveKnowledgeCategoryKey(categoryKey);
  const accent = FILTER_ACCENT_BY_THEME[resolved] || "slate";
  return FILTER_TAB_STYLES[accent] || FILTER_TAB_STYLES.default;
}

export function getKnowledgeFilterTabClassName(categoryKey, isActive) {
  const s = getKnowledgeFilterTabStyles(categoryKey);
  return cn(
    KNOWLEDGE_FILTER_TAB_BASE,
    isActive ? s.active : cn(s.idle, s.hover)
  );
}

export function getKnowledgeFilterCountClassName(categoryKey, isActive) {
  const s = getKnowledgeFilterTabStyles(categoryKey);
  return cn(
    "min-w-[1.55rem] shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-extrabold tabular-nums leading-none tracking-tight transition-all duration-200",
    isActive ? cn(s.countActive, "scale-105") : cn(s.countIdle, "group-hover:scale-105"),
  );
}
