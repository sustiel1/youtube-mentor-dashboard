// ─── Centralized Topic Config ──────────────────────────────────────────────
// Single source of truth for all topic/category styling across the app.
// Used by: AppSidebar, CategoryBadge, Admin (RSS tab), and anywhere else.

import {
  Music4, Construction, Candy, HeartPulse, Landmark,
  ChefHat, Workflow, Bot, ChartCandlestick, Code, Hash,
} from "lucide-react";

// ── Name-based map (primary source of truth) ──────────────────────────────
// Keys are Hebrew topic names. Partial matching is supported via getTopicByName().
export const TOPIC_CONFIG_BY_NAME = {
  "מוזיקה":             { Icon: Music4,          bg: "bg-purple-100", text: "text-purple-600", label: "מוזיקה"          },
  "מנופים":             { Icon: Construction,     bg: "bg-orange-100", text: "text-orange-600", label: "מנופים"          },
  "סוכר":               { Icon: Candy,            bg: "bg-pink-100",   text: "text-pink-600",   label: "סוכר"            },
  "בריאות":             { Icon: HeartPulse,       bg: "bg-red-100",    text: "text-red-600",    label: "בריאות"          },
  "פוליטיקה":           { Icon: Landmark,         bg: "bg-blue-100",   text: "text-blue-600",   label: "פוליטיקה"        },
  "פוליטיקה ותוכן ישר": { Icon: Landmark,         bg: "bg-blue-100",   text: "text-blue-600",   label: "פוליטיקה ותוכן" },
  "פוליטיקה ותוכן":     { Icon: Landmark,         bg: "bg-blue-100",   text: "text-blue-600",   label: "פוליטיקה ותוכן" },
  "אוכל ובישול":        { Icon: ChefHat,          bg: "bg-yellow-100", text: "text-yellow-700", label: "אוכל ובישול"     },
  "אוכל":               { Icon: ChefHat,          bg: "bg-yellow-100", text: "text-yellow-700", label: "אוכל"            },
  "אוטומציה":           { Icon: Workflow,         bg: "bg-indigo-100", text: "text-indigo-600", label: "אוטומציה"        },
  "בינה מלאכותית":      { Icon: Bot,              bg: "bg-violet-100", text: "text-violet-600", label: "בינה מלאכותית"  },
  "שוק ההון":           { Icon: ChartCandlestick, bg: "bg-green-100",  text: "text-green-600",  label: "שוק ההון"        },
  "פיתוח":              { Icon: Code,             bg: "bg-sky-100",    text: "text-sky-600",    label: "פיתוח"           },
};

// ── Category code → Hebrew name (for mentor.category field) ───────────────
export const CATEGORY_TO_NAME = {
  AI:       "בינה מלאכותית",
  Markets:  "שוק ההון",
  Food:     "אוכל ובישול",
  Health:   "בריאות",
  Music:    "מוזיקה",
  Politics: "פוליטיקה ותוכן",
  Dev:      "פיתוח",
};

// ── Fallback ───────────────────────────────────────────────────────────────
export const DEFAULT_TOPIC_CONFIG = {
  Icon:  Hash,
  bg:    "bg-gray-100",
  text:  "text-gray-600",
  label: "אחר",
};

// ── Lookup by topic name (partial match supported) ─────────────────────────
// Handles names like "בינה מלאכותית (AI)" or "פוליטיקה ותוכן ישראלי"
export function getTopicByName(name) {
  if (!name) return null;
  if (TOPIC_CONFIG_BY_NAME[name]) return TOPIC_CONFIG_BY_NAME[name];
  const lower = name.toLowerCase();
  for (const [key, cfg] of Object.entries(TOPIC_CONFIG_BY_NAME)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return cfg;
  }
  return null;
}

// ── Lookup by category code (AI, Markets, Food, etc.) ─────────────────────
export function getTopicByCategory(categoryCode) {
  const name = CATEGORY_TO_NAME[categoryCode];
  if (!name) return DEFAULT_TOPIC_CONFIG;
  return TOPIC_CONFIG_BY_NAME[name] ?? DEFAULT_TOPIC_CONFIG;
}

// ── Icon name → Lucide component (for Topics UI) ──────────────────────────
export const TOPIC_ICON_MAP = {
  Music4, Construction, Candy, HeartPulse, Landmark,
  ChefHat, Workflow, Bot, ChartCandlestick, Code, Hash,
};

// ── Category code → display config (icon, label, color, name, description) ─
export const CATEGORY_CONFIG = {
  AI:       { icon: Bot,              label: "בינה מלאכותית", color: "bg-violet-100 text-violet-700", name: "בינה מלאכותית", description: "AI, אוטומציה, כלים טכנולוגיים" },
  Markets:  { icon: ChartCandlestick, label: "שוק ההון",      color: "bg-green-100 text-green-700",   name: "שוק ההון",      description: "מסחר, השקעות, ניתוח טכני"     },
  Food:     { icon: ChefHat,          label: "אוכל ובישול",   color: "bg-yellow-100 text-yellow-700", name: "אוכל ובישול",   description: "מתכונים, בישול, אוכל"          },
  Health:   { icon: HeartPulse,       label: "בריאות",        color: "bg-red-100 text-red-700",       name: "בריאות",        description: "בריאות, כושר, תזונה"           },
  Music:    { icon: Music4,           label: "מוזיקה",        color: "bg-purple-100 text-purple-700", name: "מוזיקה",        description: "מוזיקה, כלי נגינה"             },
  Politics: { icon: Landmark,         label: "פוליטיקה",      color: "bg-blue-100 text-blue-700",     name: "פוליטיקה",      description: "פוליטיקה ותוכן"                },
  Dev:      { icon: Code,             label: "פיתוח",         color: "bg-sky-100 text-sky-700",       name: "פיתוח",         description: "פיתוח תוכנה, בניית אפליקציות" },
};

// ── Alias: getTopicConfig = getTopicByName ─────────────────────────────────
export { getTopicByName as getTopicConfig };

// ── Reverse: topic name → category code ───────────────────────────────────
export function getCategoryCodeForTopicName(topicName) {
  if (!topicName) return null;
  const lower = topicName.toLowerCase();
  for (const [code, name] of Object.entries(CATEGORY_TO_NAME)) {
    if (lower === name.toLowerCase() || lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) {
      return code;
    }
  }
  return null;
}
