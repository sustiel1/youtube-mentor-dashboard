// ─── Topic Config ─────────────────────────────────────────────────────────────
// Mapping: topicId → { emoji, bg, text, border }
// All topic IDs match mockData.js TOPICS array (t1–t13).

export const TOPIC_CONFIG = {
  // ── בינה מלאכותית ─────────────────────────────────
  t1:  { emoji: "🤖", bg: "bg-violet-100",  text: "text-violet-800",  border: "border-violet-200"  }, // בינה מלאכותית

  // ── שוק ההון ──────────────────────────────────────
  t2:  { emoji: "📊", bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-200"    }, // שוק ההון
  t3:  { emoji: "💰", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-200" }, // השקעות
  t4:  { emoji: "📈", bg: "bg-orange-100",  text: "text-orange-800",  border: "border-orange-200"  }, // מסחר
  t5:  { emoji: "📉", bg: "bg-indigo-100",  text: "text-indigo-800",  border: "border-indigo-200"  }, // ניתוח טכני
  t6:  { emoji: "📑", bg: "bg-slate-100",   text: "text-slate-700",   border: "border-slate-200"   }, // ניתוח פונדמנטלי
  t7:  { emoji: "🪙", bg: "bg-green-100",   text: "text-green-800",   border: "border-green-200"   }, // מניות

  // ── אוטומציה וכלים ────────────────────────────────
  t8:  { emoji: "⚙️", bg: "bg-cyan-100",    text: "text-cyan-800",    border: "border-cyan-200"    }, // אוטומציה
  t9:  { emoji: "💻", bg: "bg-sky-100",     text: "text-sky-800",     border: "border-sky-200"     }, // פיתוח תוכנה
  t10: { emoji: "📢", bg: "bg-pink-100",    text: "text-pink-800",    border: "border-pink-200"    }, // שיווק דיגיטלי
  t11: { emoji: "🎙️", bg: "bg-yellow-100",  text: "text-yellow-800",  border: "border-yellow-200"  }, // פודקאסטים
  t12: { emoji: "🔧", bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-200"   }, // כלים וטכנולוגיות
  t13: { emoji: "🏗️", bg: "bg-fuchsia-100", text: "text-fuchsia-800", border: "border-fuchsia-200" }, // בניית אפליקציות
};

// Fallback for unknown/future topic IDs
const DEFAULT_CONFIG = {
  emoji: "🏷️",
  bg: "bg-gray-100",
  text: "text-gray-700",
  border: "border-gray-200",
};

export function getTopicConfig(topicId) {
  return TOPIC_CONFIG[topicId] ?? DEFAULT_CONFIG;
}
