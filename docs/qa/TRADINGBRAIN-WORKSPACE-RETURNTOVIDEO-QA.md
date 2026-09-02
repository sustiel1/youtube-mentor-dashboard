# TRADINGBRAIN-WORKSPACE-RETURNTOVIDEO — Manual QA Checklist

Covers both the return-to-analysis button + pinned-recent-video card
(built earlier) and the deep-link regression fix (TRADINGBRAIN-NIGHT-VERIFY-HARDEN
overnight run, uncommitted). Run this against real, previously-analyzed videos —
the automated scripts under `scripts/` cover the logic but cannot substitute for
clicking through the real UI with real data.

1. Open Workspace Library, pick any video with saved content, click "הצג תוכן מהסרטון".
2. Confirm the new "חזרה לניתוח הסרטון" button appears between "חזרה לכל הסרטונים" ל-"נקה כפילויות" (אם קיים), באותו סגנון RTL.
3. לחץ עליו — ודא נחיתה על ניתוח הסרטון הנכון (כותרת תואמת).
4. בחר ושמור עוד כמה שורות מהניתוח.
5. חזור ל-Workspace Library (כפתור "Workspace" בסיידבר).
6. פוקס שוב על אותו וידאו — ודא ששתי הקבוצות (ישנה+חדשה) קיימות.
7. רענן עמוד בזמן פוקוס על הוידאו — ודא שהפוקוס והשורות שורדים.
8. וידאו עם שמירה אחת בלבד — ודא שהכפתור עדיין מופיע ועובד.
9. תצוגת "כל הסרטונים" הכללית — ודא שלא השתנתה חזותית מלבד הכרטיס המוצמד.
10. תצוגת ברירת מחדל (ללא `?video=`) — ודא שהכרטיס המוצמד לוידאו האחרון שנשמר ממנו מופיע מעל הרשימה, ושהוא מתחלף לוידאו הנכון אחרי שמירה חדשה מוידאו אחר.
11. **[חדש]** מהכרטיס המוצמד, לחץ "חזרה לניתוח הסרטון", שמור שורות נוספות מאותו וידאו, חזור ל-Workspace Library, ודא ששתי הקבוצות (הישנה והחדשה) מופיעות תחת אותו וידאו עם ספירה נכונה.
12. **[חדש]** פתח וידאו ספציפי עם `?video=...` (כרטיס הפוקוס הרגיל, לא המוצמד) וודא שהכפתור מופיע גם שם ונוחת על הוידאו הנכון, **מנותח במלואו** (לא במצב "טרם נותח").
13. **[חדש]** ודא ששורת הכותרת "פורסם" (מ-a7536c0) עדיין מוצגת נכון גם בכרטיס המוצמד וגם בכרטיס הפוקוס הרגיל.

## תוספת קריטית — בדיקת תיקון הרגרסיה (TRADINGBRAIN-NIGHT-VERIFY-HARDEN, לילה)

באג שדווח: לחיצה על "חזרה לניתוח הסרטון" פתחה את הפאנל במצב "טרם נותח" עבור וידאו שכבר נותח בפועל. **אושר ותוקן הלילה** — הסיבה בפועל: `group.videoId` יכול להגיע משדה `youtubeId` של הפריט השמור, בעוד `Dashboard.jsx`'s deep-link effect בדק רק `videoId`/`id` (לא `youtubeId`), ו-`handleReturnToAnalysis` העביר את `group.videoId` הגולמי במקום את ה-`id` הפנימי האמיתי של הרשומה שנמצאה. **לא נבדק על וידאו אמיתי-מנותח בדפדפן חי** — סביבת ה-QA האוטומטית (Playwright) לא כללה נתונים אמיתיים מנותחים, רק פיקסטורות QA. אומת באמצעות: (א) הזרקת רשומה סינתטית עם אותו mismatch מדויק ל-localStorage בדפדפן חי והוכחה שהמנגנון הישן נכשל והחדש מצליח, (ב) 3 סקריפטי QA חדשים (ראה למטה) שעברו. **פריטים 12 ו-13 למעלה חייבים להתבצע איתך על נתונים אמיתיים לפני שזה נחשב מאומת במלואו.**

## סקריפטים אוטומטיים חדשים (עברו, ראה דוח מלא)

- `scripts/return-to-analysis-deeplink-qa.mjs` — 6/6 עברו
- `scripts/pinned-recent-video-card-qa.mjs` — 8/8 עברו
- `scripts/publish-date-header-coverage-qa.mjs` — 12/12 עברו

## הודעת commit מוצעת

```
fix(workspace): resolve real video id before deep-linking to analysis panel

handleReturnToAnalysis now passes the resolved record's own canonical `id`
(not the raw group key, which may be sourced from videoId/id/youtubeId
depending on how the item was saved) as openVideoId. Dashboard.jsx's
deep-link effect now also checks youtubeId, matching the triple-check
already used by handleSourceVideoClick — closing the gap where a
youtubeId-sourced group key silently fell back to the un-analyzed stub
even though the real, analyzed record existed.

WORK-ID: TRADINGBRAIN-WORKSPACE-RETURNTOVIDEO
```
