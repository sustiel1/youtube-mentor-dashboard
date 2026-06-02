/**
 * Single source of truth for the Personal Brain folder hierarchy.
 * Keys = main Brain names. Values = SubBrain names array.
 *
 * Used by:
 *   - buildBrainStructureZip  (Obsidian scaffold ZIP export)
 *   - BrainDestinationPicker  (save-to-brain SubBrain suggestions)
 */
export const BRAIN_STRUCTURE = {
  "פוליטיקה": [
    "פוליטיקה פנימית",
    "מדינת הלכה",
    "משיחיים",
    "הכיבוש",
    "בחירות",
    "טראמפ",
    "דמוקרטיה ומוסדות",
    "מערכת המשפט",
    "תקשורת ותעמולה",
    "כלכלה וחברה",
    "חרדים וגיוס",
    "ביטחון וצבא",
    "שחיתות ושלטון",
    "מחאה ואקטיביזם",
    "גיאופוליטיקה",
    "רעיונות ועומק",
  ],

  "שוק ההון": [
    "מסחר יומי",
    "אסטרטגיות",
    "אינדיקטורים",
    "שיטת הרצפים",
    "פונדמנטלי",
    "מאקרו",
    "מניות AI",
    "ניהול סיכונים",
    "מסחר סווינג",
    "ניתוח טכני",
    "השקעות לטווח ארוך",
    "אופציות",
    "רשימות מעקב",
    "דוחות ורווחים",
    "טראמפ ושוק ההון",
  ],

  "בריאות ותזונה": [
    "קיטו",
    "סכרת",
    "תזונה דלת פחמימות",
    "מתכונים בריאים",
    "לחמים וקמחים",
    "גלידות וקינוחים",
    "מדדי סוכר",
    "ירידה במשקל",
    "פעילות גופנית",
    "בדיקות ומעקב",
    "תוספים וזהירות",
  ],

  "טכנולוגיה ו-AI": [
    "Claude Code",
    "Codex",
    "Cursor",
    "ChatGPT",
    "Gemini",
    "Perplexity",
    "Ollama",
    "מודלים סיניים",
    "Local LLMs",
    "Prompt Engineering",
    "AI Workflows",
    "Automation",
    "n8n",
    "Base44",
    "Obsidian",
    "RAG ו-Knowledge Systems",
    "Frontend",
    "Backend",
    "React",
    "Debugging ו-QA",
    "APIs ו-Integrations",
  ],

  "ידע אישי": [
    "רעיונות",
    "משימות",
    "החלטות",
    "תוכניות",
    "למידה",
    "צ׳קליסטים",
    "סיכומים",
    "תובנות אישיות",
  ],
};
