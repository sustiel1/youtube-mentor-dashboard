# קטלוג תיעוד — YouTube Mentor Dashboard

**תאריך:** 2026-06-22
**מספר מסמכים:** 26
**שפה:** עברית

---

# חובה לקרוא לפני פיתוח

1. **`docs/governance/MASTER_PROJECT_BIBLE.md`** — מפת כוח של כל המסמכים. מסביר מה הפרויקט עושה, אילו מסמכים קיימים, ואיזה מסמך מנצח במקרה של סתירה. קרא ראשון.

2. **`AI_DEVELOPMENT_GUIDE.md`** — "חוקת הפרויקט", §1 עד §34 (2055 שורות). כל כלל בנושא שמירה, טאבים, Obsidian, קטגוריות תוכן מוגדר כאן. חובה לפני כל שינוי.

3. **`docs/governance/CURRENT_STATE_JUNE_2026.md`** — מה עובד ומה שבור עכשיו. 4 גייטים פתוחים חוסמים פרסום. קרא כדי לא לבזבז זמן על בעיות שכבר נפתרו.

4. **`docs/governance/DESIGN_SYSTEM_AND_UX_RULES.md`** — כל כלל UI: RTL, גדלי טאבים, סדר הטאבים הקבוע, צבעים. לא לגעת ב-UI בלי לפתוח זה קודם.

5. **`docs/governance/SAVE_SYSTEM_ARCHITECTURE.md`** — מפת מערכת השמירה המלאה. Brain, Obsidian, Workspace — מי שולח לאן, עם דיאגרמת Mermaid. לא לגעת בשמירה בלי לקרוא.

---

# טבלת כל המסמכים

| קובץ | קטגוריה | מה הקובץ עושה | מתי לפתוח | אזור במערכת | סטטוס |
|------|---------|--------------|-----------|-------------|-------|
| `docs/governance/MASTER_PROJECT_BIBLE.md` | ממשל | חזון הפרויקט בשלושה שלבים, מפת כל מסמכי הממשל, היררכיית סמכות בין מסמכים | קריאה ראשונה בכל סשן חדש | כל המערכת | פעיל |
| `AI_DEVELOPMENT_GUIDE.md` | ממשל | "חוקת הפרויקט" §1–§34: היררכיית נושאים, כללי GEM, Obsidian, Universal Tabs, בחירה מרובה, מבנה כל קטגוריות התוכן | לפני כל שינוי — feature, טאבים, שמירה, נושא | כל המערכת | פעיל |
| `docs/governance/CURRENT_STATE_JUNE_2026.md` | ממשל | snapshot מה עובד: Universal Tabs ✅, Merge Engine ✅, Brain ✅, Morning Brief ✅; 4 גייטי שחרור פתוחים | תחילת כל סשן פיתוח | כל המערכת | פעיל |
| `docs/governance/DESIGN_SYSTEM_AND_UX_RULES.md` | ממשל | כללי RTL, גדלי טאבים (min-h-[52px], h-11), סדר טאבים קבוע, פלטת צבעים, כללי קומפוננטות, אינדיקטורי שמירה | לפני כל שינוי UI, עיצוב, טאבים | UI כללי, VideoDetailPanel | פעיל |
| `docs/governance/SAVE_SYSTEM_ARCHITECTURE.md` | ארכיטקטורה | ארכיטקטורת שמירה ל-4 יעדים (Brain / Obsidian / Workspace / Knowledge Library), Mermaid diagram, dedupe 3 שכבות | לפני כל שינוי בזרימת שמירה | Brain, Obsidian, Workspace | פעיל |
| `SKILL.md` | ארכיטקטורה | מודלי נתונים מלאים (Mentor / Video / Analysis / Settings / FetchLog), מפת localStorage, מבנה קבצים לפי שירות / hook / קומפוננטה, כל הזרימות, 10 כללי מערכת | כשצריך שמות שדות, localStorage keys, מפת שירותים | כל השירותים | פעיל |
| `PROJECT_STATUS.md` | ממשל | מצב build, 4 גייטי שחרור פתוחים (CH-1, MB-2, MB-3, MB-4), סיכונים פתוחים, משימות מומלצות (עדכון אחרון: 2026-06-17) | תחילת סשן; לפני מגע בפרקים או Morning Brief | כל המערכת | פעיל |
| `docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md` | ממשל | 9 כללי ממשל מחייבים: עמידה ביקורתית, הגנת ארכיטקטורה, שינוי מינימלי, ללא secrets, תיעוד, commit, בדיקות | תמיד פעיל — קרא לפני סשן גדול | כל תהליך הפיתוח | פעיל |
| `docs/governance/STOCK_ANALYSIS_SCREEN_BIBLE.md` | ממשל | מסמך התייחסות קבוע לשוק ההון: מיפוי morning / evening / weekly → טאבים, Universal Tabs, נתיבי Obsidian, APP Builder | לפני כל עבודה על שוק ההון, Morning Brief, Specialized tab | שוק ההון, SpecializedContentRenderer | פעיל |
| `docs/governance/USER_PRODUCT_INTENT_AND_FUTURE_VISION.md` | ממשל | חזון מוצר: למה הפרויקט קיים, מה ההצלחה נראית כמוה ב-3 אופקים, non-negotiables | לפני הצעת ארכיטקטורה, feature חדשה, או refactor | כל המערכת | פעיל |
| `docs/governance/PROJECT_DECISIONS_HISTORY.md` | ממשל | לוג החלטות ארכיטקטורה עם הסבר למה: Universal Tabs, GEM paste-back, עברית, localStorage-first | לפני שינוי כל החלטה ארכיטקטורה | כל המערכת | פעיל |
| `docs/PROJECT_DOCUMENTATION_INDEX.md` | מסמך עזר | רג'יסטרי מסמכים מרכזי: היררכיית עדיפויות, תחומים פונקציונליים, backlog מסמכים חסרים | כשצריך למצוא מסמך רלוונטי במהירות | כל התיעוד | פעיל |
| `docs/PROJECT_MARKDOWN_FILE_INDEX.md` | מסמך עזר | אינדקס מלא של 26 קובצי MD: כותרת, תיאור, סטטוס, "Best Used For", "Can Be Used As Inspiration For" | כשרוצים לדעת אילו מסמכים קיימים ולמה | כל התיעוד | פעיל |
| `README.md` | מסמך עזר | סקירת הפרויקט: React 18 + Vite + Tailwind + Base44 + Playwright, הוראות הקמה, quick-start, CI/CD | פתיחת פרויקט חדש; onboarding | כל המערכת | פעיל |
| `MARKET_DASHBOARD_UI_GUIDE.md` | ארכיטקטורה | blueprint לדשבורד מאקרו: 11 סקציות (ExecutiveSnapshot עד Fed Policy), שמות קומפוננטות, סדר רינדור | לפני עבודה על MacroGemDashboard.jsx | Macro, Market Intelligence | פעיל |
| `docs/governance/NEXT_SESSION_QA.md` | תהליך עבודה | צ'קליסט QA ידני: 8 תרחישים — MD export, Brain indicator, brain-picker, keyboard close, bulk save dedup | לפני סשן QA; לפני סגירת גייטי שחרור | כל תהליך QA | פעיל |
| `CLAUDE.md` | תהליך עבודה | הגדרות Claude Code + הגדרות AI נעולות: max_tokens=8192, timeout=600s, CHUNK_THRESHOLD=15K, GEMINI_MOCK=false | נקרא אוטומטית — קרא לפני שינוי vite.config.js | Gemini, Claude API, Base44 | פעיל |
| `PROMPTS.md` | תהליך עבודה | 8 פרומפטים מוכנים בעברית: session בסיסי, feature חדשה, תיקון באג, code review, refactor, env vars, Base44 sync, תיעוד | כשמתחילים משימה ממוקדת — copy-paste prompt מוכן | כל סשן פיתוח | פעיל |
| `docs/base44-checklist.md` | תהליך עבודה | צ'קליסט הגדרת Base44 ↔ GitHub: קביעת מקור אמת, ניהול secrets, VITE_ prefix convention | הגדרת פרויקט Base44 חדש; reconnect אחרי disconnect | Base44, GitHub | פעיל |
| `AGENTS.md` | תהליך עבודה | Base44 + GitHub workflow: 8 עקרונות, כללי קוד / console / secrets / git. ⚠️ כפול מדויק של docs/workflow.md | ניתן להשתמש, אך עדיף CLAUDE.md | Base44, Git | מיושן (כפול) |
| `docs/workflow.md` | תהליך עבודה | Base44 + GitHub workflow. ⚠️ כפול מדויק של AGENTS.md — 117 שורות זהות לחלוטין | אין ערך ייחודי — עדיף AGENTS.md או CLAUDE.md | Base44, Git | מיושן (כפול) |
| `docs/OBSIDIAN_PERSONAL_BRAIN_PHASE.md` | ארכיטקטורה | תיאור ארכיטקטורת ZIP export: מבנה Topic/Learnings/, Topic/Atomic/Insights/, סוגי הערות אטומיות. ⚠️ vault API החליף את ZIP | רקע היסטורי על סוגי atomic notes; השראה לתיעוד vault API עדכני | Obsidian, Brain | מיושן |
| `docs/PROJECT_DOCUMENTATION_AUDIT.md` | ביקורת | ביקורת תיעוד מלאה (2026-06-22): 26 קבצים, 8 בעיות, מבנה docs/ מוצע, רשימת סיכונים, 7 צעדי יישום | לפני ארגון מחדש של תיעוד; להבין מה כפול ומה מיושן | כל התיעוד | פעיל |
| `ROUTES_AUDIT_REPORT.md` | ביקורת | snapshot נתיבים (2026-06-01): 14 routes, 12 sidebar entries, 7 admin tabs, LearningHub orphan. ⚠️ עשוי לא לשקף מצב נוכחי | הבנת מבנה navigation; לוודא נגד pages.config.js | Navigation, Sidebar | היסטורי |
| `CHAPTER_ENGINE_ROOT_CAUSE_REPORT.md` | ביקורת | ניתוח מקור בעיית פרקים (2026-06-22): 7 מקורות פרקים, שרשרת עדיפויות, normalizer functions, quality gates. ניתוח בלבד | לפני כל עבודה על system פרקים; debugging CH-1 | ChapterItem, VideoDetailPanel | היסטורי |
| `docs/governance/MILESTONE_MORNING_BRIEF_DASHBOARD_CLUSTER.md` | אבן דרך | milestone סגור (2026-06-16): 5 commits, 53 קבצים נוספו, Universal Tabs bulk selection, Obsidian merge engine, Morning Brief dashboard | הבנה מה נכלל ב-cleanup baseline | Morning Brief, Universal Tabs | היסטורי |

---

# מסמכי השראה לפי תחום

## UI / UX

- `docs/governance/DESIGN_SYSTEM_AND_UX_RULES.md` — כל כלל RTL, גדלי טאבים, פלטת צבעים, כללי קומפוננטות
- `MARKET_DASHBOARD_UI_GUIDE.md` — blueprint מפורט ל-11 סקציות של דשבורד מאקרו
- `docs/governance/STOCK_ANALYSIS_SCREEN_BIBLE.md` — מיפוי UI מסכי שוק ההון לפי סוג תוכן

## Universal Tabs

- `AI_DEVELOPMENT_GUIDE.md` §22 — Universal Bulk Selection & Save System, BulkSelectionBar
- `AI_DEVELOPMENT_GUIDE.md` §28 — 8 טאבים סטנדרטיים לתוכן חינוכי
- `docs/governance/STOCK_ANALYSIS_SCREEN_BIBLE.md` — מיפוי brief types → טאבים
- `docs/governance/DESIGN_SYSTEM_AND_UX_RULES.md` — גדלי טאבים, סדר קבוע, tab change behavior

## Morning Brief

- `docs/governance/STOCK_ANALYSIS_SCREEN_BIBLE.md` — מבנה Morning Brief (9 טאבים), מיפוי לסקציות UI
- `AI_DEVELOPMENT_GUIDE.md` §6, §24 — 9 הטאבים הרשמיים, כללי Morning Brief
- `docs/governance/CURRENT_STATE_JUNE_2026.md` — מה עובד ב-Morning Brief
- `MARKET_DASHBOARD_UI_GUIDE.md` — blueprint ויזואלי לטאב מאקרו

## Chapters

- `CHAPTER_ENGINE_ROOT_CAUSE_REPORT.md` — 7 מקורות פרקים, שרשרת עדיפויות, normalizer functions
- `PROJECT_STATUS.md` — תיאור CH-1: resolveStartSeconds() נכשל, startSeconds חסר
- `AI_DEVELOPMENT_GUIDE.md` §7 — GEM כמקור פרקים, paste-back flow

## GEMS

- `AI_DEVELOPMENT_GUIDE.md` §7, §18 — GEM paste-back flow, status indicators, localStorage vs DB
- `CLAUDE.md` — הגדרות Gemini ו-Claude API נעולות (GEMINI_MOCK, max_tokens, timeout)
- `docs/governance/CURRENT_STATE_JUNE_2026.md` — מה עובד ב-GEM extraction

## Obsidian

- `AI_DEVELOPMENT_GUIDE.md` §9, §30 — כל נתיבי Obsidian, Master Folder Architecture
- `docs/governance/SAVE_SYSTEM_ARCHITECTURE.md` — vault API, merge engine, dedupe 3 שכבות
- `docs/OBSIDIAN_PERSONAL_BRAIN_PHASE.md` — רקע ארכיטקטורת ZIP, סוגי atomic notes

## Brain

- `docs/governance/SAVE_SYSTEM_ARCHITECTURE.md` — Brain save flow, per-item localStorage vs full-video vault
- `AI_DEVELOPMENT_GUIDE.md` §4, §22 — כללי שמירה ל-Brain, BulkSelectionBar
- `docs/governance/CURRENT_STATE_JUNE_2026.md` — per-row quick save, bulk brain save, dedupe

## Workspace

- `AI_DEVELOPMENT_GUIDE.md` §14 — Workspace rules: manual-only, no auto-add, DB persistence
- `docs/governance/SAVE_SYSTEM_ARCHITECTURE.md` — Workspace storage layer, Knowledge Library
- `ROUTES_AUDIT_REPORT.md` — אימות נתיב Workspace

## ארכיטקטורה

- `docs/governance/MASTER_PROJECT_BIBLE.md` — ארכיטקטורת 7 שלבי הידע
- `SKILL.md` — מודלי נתונים מלאים, מבנה קבצים
- `docs/governance/SAVE_SYSTEM_ARCHITECTURE.md` — ארכיטקטורת שמירה
- `docs/governance/PROJECT_DECISIONS_HISTORY.md` — למה כל החלטה ארכיטקטורה

## ממשל וניהול פרויקט

- `docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md` — 9 כללי ממשל מחייבים ל-Claude Code
- `docs/governance/PROJECT_DECISIONS_HISTORY.md` — לוג החלטות מנומק
- `docs/governance/USER_PRODUCT_INTENT_AND_FUTURE_VISION.md` — חזון מוצר ו-non-negotiables
- `docs/PROJECT_DOCUMENTATION_INDEX.md` — רג'יסטרי מסמכים מרכזי

---

# קיצורי דרך נפוצים

דוגמאות לשאלות שאפשר לשאול את Claude Code:

* "השתמש ב-STOCK_ANALYSIS_SCREEN_BIBLE כהשראה לבניית screen bible לפוליטיקה"
* "סכם את כל מסמכי ה-Obsidian מה-docs/"
* "מצא את מסמך המקור של מערכת ה-Chapters"
* "איזה מסמך מתאר את Universal Tabs?"
* "לפני שאני משנה את זרימת השמירה, אילו מסמכים צריך לקרוא?"
* "מה ה-atomic note types שנתמכים ב-Brain?"
* "הצג את כל הגייטים הפתוחים שחוסמים פרסום"
* "איזה קטגוריות של תוכן מוגדרות ב-AI_DEVELOPMENT_GUIDE?"
* "מצא סתירה בין AI_DEVELOPMENT_GUIDE לבין docs/governance/"
* "אילו מסמכים הם כפולים ואפשר לאחד?"

---

*נוצר על ידי Claude Code — 2026-06-22. לא שונה, הועבר, או נמחק אף קובץ.*
