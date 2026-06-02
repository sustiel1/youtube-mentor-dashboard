import { createPortal } from "react-dom";
import { X, BookOpen } from "lucide-react";

const sections = [
  {
    title: "מה זה Obsidian?",
    content: `Obsidian הוא תוכנת פתקים מקומית שעובדת עם קבצי Markdown (.md).
הידע שלך נשמר בתיקיית vault על המחשב שלך — לא בענן, לא בשרתים חיצוניים.
כל קובץ הוא טקסט רגיל שאתה יכול לפתוח עם כל עורך.`,
  },
  {
    title: "איך לפתוח את ה-Vault?",
    content: `1. פתח את אפליקציית Obsidian
2. בחר "Open folder as vault"
3. נווט ל: C:\\Users\\11\\Desktop\\Workspace\\Knowledge-Base
4. לחץ "Open" — זה מספיק פעם אחת

לאחר הרישום, כפתור "Obsidian" בפאנל ייפתח ישירות לקובץ הנכון.`,
  },
  {
    title: "מבנה תיקיות ה-Knowledge Base",
    content: `Knowledge-Base/
├── שוק ההון/
│   └── ניתוח טכני/
│       └── V-video-title.md
├── טכנולוגיה ו-AI/
│   └── V-video-title.md
├── בריאות ותזונה/
│   └── V-video-title.md
└── ידע אישי/
    └── למידה/
        └── V-video-title.md

כל קטגוריית וידאו ממופה לתיקיה ולקובץ אוטומטית.`,
    isCode: true,
  },
  {
    title: "איך נשמרים keypoints בקובץ?",
    content: `כשאתה לוחץ "שמור למוח" על keypoint, המערכת:
1. מזהה את קטגוריית הסרטון (לדוג׳: Stock Market)
2. בוחרת קובץ מתאים (לדוג׳: מניות.md)
3. מוסיפה כותרת הסרטון פעם אחת
4. מוסיפה את הנקודה עם אימוג׳י דירוג אם הוגדר

דוגמה לפורמט שנשמר:

### שם הסרטון
*15/05/2026*
- קנה מניה רק כשנוגעת לממוצע 150 🔥
- עקוב אחרי ה-RSI לפני כניסה לפוזיציה ⭐`,
    isCode: true,
  },
  {
    title: "דירוגי כרטיסיות ואימוג׳י",
    content: `כל keypoint יכול לקבל דירוג לפני השמירה:

🔥  חשוב מאוד (important)
⭐  איכות גבוהה (quality)
🟡  לחזור ולסקור (review)

ללא דירוג — נשמר כשורה רגילה ללא אימוג׳י.`,
  },
  {
    title: "איך ליצור תיקיה חדשה ב-Obsidian?",
    content: `בסרגל הצד השמאלי:
1. לחץ קליק ימני על ה-vault הראשי
2. בחר "New folder"
3. הקלד שם התיקיה

לחלופין, צור תיקיה ישירות בסייר הקבצים — Obsidian יזהה אותה אוטומטית.`,
  },
  {
    title: "איך ליצור קובץ חדש?",
    content: `בסרגל הצד:
1. לחץ על הכפתור "New note" (סמל עיפרון)
2. הזן שם לקובץ (ללא סיומת .md)
3. Obsidian יצור את הקובץ בתיקיה הנוכחית

ניתן גם להשתמש בקיצור: Ctrl+N`,
  },
  {
    title: "איך למחוק קובץ?",
    content: `בסרגל הצד:
1. קליק ימני על הקובץ
2. בחר "Delete"
3. Obsidian שולח לפח המיחזור של המערכת (לא נמחק לצמיתות מיד)

אפשר לשחזר מהפח אם נמחק בטעות.`,
  },
  {
    title: "איך למחוק תוכן מקובץ?",
    content: `פתח את הקובץ ב-Obsidian ומחק את הטקסט ידנית.
הקבצים הם טקסט רגיל — ניתן לערוך בכל עורך כולל Notepad.

מחיקה מהאפליקציה לא תשפיע על קבצי ה-vault — הם נפרדים.`,
  },
  {
    title: "מחיקת frontmatter (metadata)",
    content: `ה-frontmatter הוא הבלוק בין --- בתחילת הקובץ:

---
topic: Stock Market
subtopic: מניות
updated: 2026-05-15
---

ניתן למחוק אותו לחלוטין או לשנות את הערכים ידנית.
Obsidian יתעלם ממנו בתצוגה הרגילה.`,
    isCode: true,
  },
  {
    title: "פתיחת קובץ ישירות מהאפליקציה",
    content: `כפתור "Obsidian" בסרגל הטאבים פותח ישירות את הקובץ המתאים.
זה עובד באמצעות פרוטוקול obsidian://:

obsidian://open?vault=Knowledge-Base&file=שוק ההון/ניתוח טכני/V-video-title.md

דרישה: Obsidian מותקן ורשום ב-Windows.
ה-vault חייב להיות פתוח לפחות פעם אחת ב-Obsidian.`,
    isCode: true,
  },
  {
    title: "גיבוי ה-Knowledge Base",
    content: `ה-vault הוא תיקיה רגילה — מספיק לגבות אותה:

גיבוי ידני:
העתק את C:\\Users\\11\\Desktop\\Workspace\\Knowledge-Base לדיסק חיצוני.

גיבוי אוטומטי (מומלץ):
השתמש ב-Git לניהול גרסאות:
  git init
  git add .
  git commit -m "backup"

או הפעל סינכרון עם OneDrive / Google Drive.`,
  },
  {
    title: "העברת ידע בין מחשבים",
    content: `1. העתק את תיקיית Knowledge-Base למיקום הרצוי
2. פתח Obsidian במחשב החדש
3. בחר "Open folder as vault" ונווט לתיקיה
4. כל הפתקים, הקישורים והגרפים יישמרו

הקבצים הם Markdown סטנדרטי — אין תלות ב-Obsidian עצמו.`,
  },
];

export default function ObsidianTechnicalGuide({ open, onClose }) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-start justify-end"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="obsidian-guide-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-[1] h-full w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-700 bg-violet-50 dark:bg-violet-950/30">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-violet-600" />
            <h2 id="obsidian-guide-title" className="text-lg font-semibold text-violet-900 dark:text-violet-100">
              מדריך Obsidian — Knowledge Base
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {sections.map((section, i) => (
            <div key={i} className="space-y-2">
              <h3 className="text-sm font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-xs font-bold text-violet-600 dark:text-violet-300">
                  {i + 1}
                </span>
                {section.title}
              </h3>
              {section.isCode ? (
                <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-slate-100 dark:bg-zinc-800 rounded-lg px-4 py-3 text-slate-700 dark:text-slate-300 font-mono border border-slate-200 dark:border-zinc-700">
                  {section.content}
                </pre>
              ) : (
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                  {section.content}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-zinc-700 text-xs text-slate-400 dark:text-slate-500 text-center">
          הקבצים נשמרים ב: C:\Users\11\Desktop\Workspace\Knowledge-Base
        </div>
      </div>
    </div>,
    document.body
  );
}
