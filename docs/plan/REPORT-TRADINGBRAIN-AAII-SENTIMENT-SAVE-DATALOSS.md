# דוח: TRADINGBRAIN-AAII-SENTIMENT-SAVE-DATALOSS

תאריך: 2026-09-02 — 2026-09-03
WORK-ID: TRADINGBRAIN-AAII-SENTIMENT-SAVE-DATALOSS
Branch: `feat/saved-market-rows-table`

## ✅ הושלם — נבדק ונשמר ב־commit

---

## תוצאה מסכמת

תוקן באג שקט של אובדן נתונים בעורך הסנטימנט השבועי של AAII: פתיחת שבוע קיים
ולחיצה על "שמירה" — **גם בלי לשנות שום שדה** — מחקה בשקט את הממוצעים
ההיסטוריים (`bullishAverage`/`neutralAverage`/`bearishAverage`) שכבר היו
שמורים לאותו שבוע. התיקון נבדק (QA אוטומטי + build + QA ידני בדפדפן על ידי
המשתמש), אושר, ונשמר ב-2 commits מקומיים.

---

## שורש הבעיה

שלוש נקודות בקוד יצרו יחד את הבאג:

1. **`AAIIWeeklySentimentEditor.jsx`'s `buildDraft()`** — לא העביר הלאה את
   שלושת הממוצעים מ-`currentRecord` אל ה-draft הניתן לעריכה.
2. **`aaiiWeeklySentiment.js`'s `buildAaiiWeeklyRecord()`** — בנה רשומה בלי
   שדות הפירוט בכל שמירה שלא לוותה בהדבקה-וניתוח טרייה של שורת AAII באותו
   סשן עריכה.
3. **`upsertAaiiWeeklyRecord()`** — מחליף רשומה שלמה לפי שבוע, בלי מיזוג
   ברמת שדה — כך שכל שדה חסר ב-draft נמחק בפועל מהאחסון.

## התיקון

- `buildDraft()` מעביר הלאה את שלושת הממוצעים כשהם קיימים ותקינים
  (`hasAaiiWeeklyAverages`) — **לא** את ה-spread.
- `bullBearSpread` **תמיד** מחושב מחדש כ-`bullish - bearish`
  (`computeAaiiSpread`), הן בשמירה ידנית והן בהדבקה — אף פעם לא נלקח משורה
  מודבקת או מרשומה ישנה.
- בדיקת אי-ההתאמה בטולרנס 0.1pp ב-`validateAaiiParsedValues` (שהייתה חוסמת
  שמירה) הוסרה — ולידציית שלושת האחוזים/הממוצעים נשארה כפי שהייתה.
- ללא שינוי במפתח האחסון, בסכימה, או במיגרציה — רשומות legacy (בלי ממוצעים)
  ממשיכות לעבוד ללא שינוי.

## קבצים שהשתנו

- `src/lib/aaiiWeeklySentiment.js`
- `src/components/dashboard/AAIIWeeklySentimentEditor.jsx`
- `scripts/aaii-weekly-sentiment-logic-qa.mjs` — כיסוי רגרסיה מלא ל-7 קריטריוני קבלה (A–G)
- `scripts/aaii-weekly-sentiment-card-qa.mjs` — תיקון נפרד, לא קשור: regex מיושן מול `FearGreedScoreCardContainer`

## בדיקות שהורצו

| בדיקה | תוצאה |
|---|---|
| `aaii-weekly-sentiment-logic-qa.mjs` | PASS |
| `aaii-weekly-sentiment-card-qa.mjs` | PASS |
| `npm run build` | PASS (exit 0) |
| Lint / Type-check | לא קיימים בפרויקט (אין eslint/tsconfig) — מתועד ב-ledger |
| QA ידני בדפדפן (המשתמש) | **עבר** |

## Commits

| SHA | תיאור |
|---|---|
| `bf48c6f74e01c1b2322f2b39a221a9612ac2de04` | התיקון עצמו (4 קבצים) |
| `49d0c52bed24004e9ef465c8c853dc54e3544339` | תיעוד סגירה ב-`docs/open-items-ledger.md` |

שני ה-commits **מקומיים בלבד — לא נדחפו ל-origin**.

## ממצא נלווה משמעותי — עבודה מקבילה מ-Codex

תוך כדי סגירת המשימה התגלה ש-**session נפרד של OpenAI Codex** (לא Claude
Code) פעל במקביל על אותו worktree בדיוק — ביצע commit משלו (`542b47d`) וכתב
שורות משלו ל-`docs/open-items-ledger.md` בזמן שסשן זה היה באמצע עבודה על אותו
קובץ. אומת ברמת תהליכי מערכת ההפעלה (`Get-CimInstance Win32_Process`), לא רק
דרך `git status`. תועד בזיכרון הפרויקט (`project_shared_worktree_coordination`)
לטובת סשנים עתידיים.

## פריטים פתוחים (מתועדים ב-`docs/open-items-ledger.md`)

- `AAII_WEEKLY_SENTIMENT_SPREAD_TOLERANCE` — לא בשימוש למטרתו המקורית, דורש החלטה
- אין lint/typecheck בפרויקט — דורש החלטה
- Radix Tooltip לא נראה ב-SSR — מגבלת תשתית QA, ל-verification ידני בלבד
- שאר הענף (13+ קבצים לא-קשורים, חלקם מ-Codex) — לא נוגעים ב-WORK-ID הזה

## Rollback

```
git revert bf48c6f74e01c1b2322f2b39a221a9612ac2de04
git revert 49d0c52bed24004e9ef465c8c853dc54e3544339
```
