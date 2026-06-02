/**
 * Generates exports/Obsidian-Brain-Structure.zip from the same BRAIN_STRUCTURE
 * source of truth used by the browser's "ייצא מבנה Obsidian" button.
 *
 * Usage:
 *   npm run export:brain-structure
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── inline BRAIN_STRUCTURE (mirrors src/config/brainStructure.js) ──────────
// Kept here so the script runs without a build step or module-alias tooling.
// If you change brainStructure.js, update this block too.
const BRAIN_STRUCTURE = {
  "פוליטיקה": [
    "פוליטיקה פנימית", "מדינת הלכה", "משיחיים", "הכיבוש", "בחירות", "טראמפ",
    "דמוקרטיה ומוסדות", "מערכת המשפט", "תקשורת ותעמולה", "כלכלה וחברה",
    "חרדים וגיוס", "ביטחון וצבא", "שחיתות ושלטון", "מחאה ואקטיביזם",
    "גיאופוליטיקה", "רעיונות ועומק",
  ],
  "שוק ההון": [
    "מסחר יומי", "אסטרטגיות", "אינדיקטורים", "שיטת הרצפים", "פונדמנטלי",
    "מאקרו", "מניות AI", "ניהול סיכונים", "מסחר סווינג", "ניתוח טכני",
    "השקעות לטווח ארוך", "אופציות", "רשימות מעקב", "דוחות ורווחים",
    "טראמפ ושוק ההון",
  ],
  "בריאות ותזונה": [
    "קיטו", "סכרת", "תזונה דלת פחמימות", "מתכונים בריאים", "לחמים וקמחים",
    "גלידות וקינוחים", "מדדי סוכר", "ירידה במשקל", "פעילות גופנית",
    "בדיקות ומעקב", "תוספים וזהירות",
  ],
  "טכנולוגיה ו-AI": [
    "Claude Code", "Codex", "Cursor", "ChatGPT", "Gemini", "Perplexity",
    "Ollama", "מודלים סיניים", "Local LLMs", "Prompt Engineering",
    "AI Workflows", "Automation", "n8n", "Base44", "Obsidian",
    "RAG ו-Knowledge Systems", "Frontend", "Backend", "React",
    "Debugging ו-QA", "APIs ו-Integrations",
  ],
  "ידע אישי": [
    "רעיונות", "משימות", "החלטות", "תוכניות", "למידה", "צ׳קליסטים",
    "סיכומים", "תובנות אישיות",
  ],
};

// ── helpers ─────────────────────────────────────────────────────────────────

function brainIndex(name) {
  return [`# ${name}`, "", "This folder is part of the Personal Brain structure."].join("\n");
}

function subBrainIndex(brainName, subName) {
  return [
    `# ${subName}`, "",
    `Brain: ${brainName}`, `SubBrain: ${subName}`, "",
    "Purpose:", "This folder is part of the Personal Brain structure.",
  ].join("\n");
}

// ── build ZIP ────────────────────────────────────────────────────────────────

const zip = new JSZip();
let brainCount = 0;
let subBrainCount = 0;

for (const [brain, subs] of Object.entries(BRAIN_STRUCTURE)) {
  zip.file(`Workspace/${brain}/_index.md`, brainIndex(brain));
  brainCount++;

  for (const sub of subs) {
    zip.file(`Workspace/${brain}/${sub}/_index.md`, subBrainIndex(brain, sub));
    subBrainCount++;
  }
}

// ── write to disk ────────────────────────────────────────────────────────────

const outDir = path.join(ROOT, "exports");
const outFile = path.join(outDir, "Obsidian-Brain-Structure.zip");

fs.mkdirSync(outDir, { recursive: true });

const buffer = await zip.generateAsync({ type: "nodebuffer" });
fs.writeFileSync(outFile, buffer);

console.log(`✓ Brain Structure ZIP written:`);
console.log(`  ${outFile}`);
console.log(`  ${brainCount} Brains · ${subBrainCount} SubBrains · ${subBrainCount + brainCount} folders`);
