# דוח: TRADINGBRAIN-FRESHIMPORT-COST-GUARD

תאריך: 2026-09-02
WORK-ID: TRADINGBRAIN-FRESHIMPORT-COST-GUARD

## תוצאה מסכמת

הוחל שער אישור מפורש לפני כל קריאת Claude בתשלום שמופעלת אוטומטית ע"י
"ייבא מחדש מאפס". **STEP 1 נבדק לפני כל שינוי קוד, כנדרש**: הוכח חי (לא רק
מהקוד) שחיוב כפול לאותו סרטון **אינו אפשרי** דרך כישלון/רענון/פתיחה-מחדש —
ולכן לא היה צורך לתקן בעיה גדולה יותר לפני שער האישור. תוך כדי הבנייה של
שער האישור עצמו **נמצא ותוקן באג אמיתי נוסף**: מנגנון ניקוי הדגל שהעתקתי
מהקוד הקיים (`consumeFreshImportFlag`) פשוט **לא עבד** מול `forceUpsertVideo`
— זוהה, אומת, ותוקן לפני שנחתם הדוח.

---

## STEP 0 — הוכחת סביבה

- Repo root: `C:/Users/11/Desktop/Workspace/new-project/projects/youtube-mentor-dashboard`
- Branch: `feat/saved-market-rows-table`
- HEAD בתחילת הסשן: `c8bdd44629442cc6f7313847250d37a0488bde76`
- **HEAD זז במהלך הסשן** ל-`51701f6459fe60dc215b1823cff94e8a95a01b34`
  ("fix(workspace): show publish date/time in the default video-group card")
  — **לא אני**; קומיט מסשן מקביל אחר שרץ על אותו worktree. לא נגעתי ב-HEAD,
  לא commit-תי, לא stage-תי כלום.
- `git status --porcelain` בתחילת הסשן: 23 קבצים M + 12 untracked. תוך כדי
  הסשן ירדו 3 מהם (`WorkspaceVideoGroupCard.jsx`, `morningBriefVisuals.js`,
  `WorkspaceLibrary.jsx`) — קומיטו ע"י אותו סשן מקביל שהזיז את HEAD. **לא
  נגעתי בהם.**
- שרת הפיתוח הקנוני: PID **10360**, מאזין על `[::1]:5184`, אומת שהוא רץ
  מתוך worktree זה (command line + `<title>YouTube Mentor Dashboard</title>`).
  **לא הופעל מחדש, לא נגעתי בו.**
- `src/components/dashboard/VideoDetailPanel.jsx` היה, וממשיך להיות, דירטי
  מסשן/ים אחר/ים לאורך כל הסשן שלי (סה"כ diff גדל ל-398 שורות עד סוף הסשן —
  כולל השינוי שלי; רק ~65 מתוכן שלי, ראה PHASE C). ערכתי **רק** את שני
  הבלוקים הספציפיים שתוארו למטה — לא נגעתי בשום hunk אחר בקובץ.
- קריטי לגילוי מהותי בהמשך: תוך כדי הסשן שלי גיליתי שדוח קודם באותו path
  (`REPORT-TRADINGBRAIN-ADDBYLINK-VIDEO-MISMATCH.md`) נכתב מחדש ע"י סשן
  שלישי, וכלל תיקון **קיים ואמיתי** ב-`src/hooks/usePersistedVideo.js`
  ו-`src/pages/Dashboard.jsx:handleVideoPatch` (race condition ב-state של
  הפאנל — תוצאה אסינכרונית ישנה יכולה לדרוס וידאו אחר שהמשתמש עבר אליו).
  **קראתי את זה במלואו לפני שנגעתי בקוד**, ווידאתי שהתיקון שלי לא מתנגש
  איתו ולא נוגע באותם קבצים בכלל מלבד `VideoDetailPanel.jsx` (שם הם לא
  נגעו). ראה גם PHASE C.

---

## STEP 1 — מתי `pendingFreshImport` מתאפס ביחס לקריאה בתשלום, והאם חיוב כפול אפשרי

### מיפוי הקוד (לפני כל שינוי)

`pendingFreshImport: true` נכתב פעם אחת, ב-`ExternalVideoModal.jsx`'s
`handleDuplicateReimport`, **לפני** שהפאנל נפתח בכלל (דרך
`buildFreshImportRecord(..., {requestFreshAnalysis: true})`). ברגע שהפאנל
נפתח, `useEffect` ב-`VideoDetailPanel.jsx` (היה בשורה ~8149, כעת ~8154)
מריץ (לפני התיקון) ישירות את `runFreshImportPipeline`, אשר:

1. **מיד**, כפעולה סינכרונית ראשונה (לפני כל `await` בפועל, מוגן ע"י
   `consumePending`) — קורא ל-`persistFreshImportRecord(consumeFreshImportFlag(baseVideo))`.
2. שולף תמלול טרי (רשת, אמיתי).
3. **רק אם** התמלול הצליח והוחזרו segments — כותב patch מפורש
   `pendingFreshImport: false` (**זה** מה שבפועל מנקה את הדגל בקוד המקורי —
   ראה ממצא ה-baseline bug למטה).
4. קורא ל-`runAiAnalysis({force: true, ...})` — **כאן** נשלחת בקשת ה-POST
   האמיתית ל-`/api/claude-video-analyze` (אומת ב-`src/services/claudeVideoAnalyzer.js`
   ו-`src/services/aiVideoAnalyzer.js`).

### תשובה חיה, לא רק מהקוד

הקמתי Chromium מבודד (לא ה-instance המשותף עם ה-MCP, שהיה נעול ע"י סשן
אחר) מול **עותק קריאה-בלבד** של פרופיל ה-Chrome האמיתי (160 סרטונים אמיתיים
ב-`localStorage`), ויירטתי (`page.route`) את `POST /api/claude-video-analyze`
כדי לספור קריאות ולעכב/להכשיל אותן **בלי לבזבז טוקנים אמיתיים** (לפי
ההנחיה המפורשת). וידאתי ישירות מול השרת האמיתי ש-`ANTHROPIC_API_KEY` כן
מוגדר (`curl http://localhost:5184/api/claude-video-analyze/status` →
`{"configured":true,...}`), כדי שהניסוי יבדוק את התרחיש האמיתי, לא מקרה-קצה
של מפתח חסר.

**תרחיש A — סגירת פאנל וחזרה לאותו סרטון בזמן שהקריאה עוד "רצה" (עוכבה 5
שניות מלאכותית ע"י ה-route):** נספרה **קריאה אחת בלבד** (`analyzeCallCount=1`)
לאורך כל התרחיש — פתיחה, Escape, פתיחה מחדש דרך "טען גרסה קיימת" (הנתיב
האמין, לא תלוי בטעינה חוזרת של הפאנל). ה-storage אחרי הכל: `pendingFreshImport:false`.

**תרחיש B — כישלון (הוחזר 500 מכוון):** אחרי הכישלון, `pendingFreshImport`
נשאר `false` — **שום דבר לא מחזיר אותו ל-`true`** אחרי כישלון. פתיחה חוזרת
של אותו סרטון לא הפעילה קריאה נוספת.

**React StrictMode:** נבדק ב-`grep -r StrictMode src` — **לא קיים בכלל
בפרויקט הזה**. double-invocation של אפקטים לא רלוונטי כאן.

### תשובה: חיוב כפול לאותו סרטון **אינו אפשרי** דרך כישלון/רענון/remount

מוגן ע"י שלושה מנגנונים משולבים, כולם נבדקו:
1. `freshImportAutoRunRef` — ref פר-מופע-רכיב, מונע הרצה כפולה של אותו token
   (`videoId:freshImportRequestedAt`) כל עוד הרכיב (מופע יחיד, תמיד-מותקן
   ב-`Dashboard.jsx`) לא רוענן/נטען-מחדש.
2. `isFreshImportRunning` — מונע הרצה מקבילה של pipeline שני על אותו מופע.
3. הדגל `pendingFreshImport` מתאפס (בקוד המקורי: רק אם התמלול הצליח —
   ראה ממצא הבאג למטה) לפני הקריאה בתשלום, כך שפתיחה חוזרת לא רואה דגל
   "ממתין" שיפעיל שוב.

**ממצא נלווה, לא WORK-ID הזה, לא תוקן**: הניקוי בקוד המקורי (סעיף 3 למעלה)
**תלוי בהצלחת שליפת התמלול** — אם התמלול נכשל/ריק, ה-patch המפורש
`pendingFreshImport:false` אף פעם לא נכתב, וה-`consumeFreshImportFlag` בשני
המקומות האחרים ב-pipeline (`VideoDetailPanel.jsx:8034,8100`) **אינו מנקה
בפועל** (ראה PHASE C — אותו באג בדיוק שתיקנתי אצלי). המשמעות: וידאו שהתמלול
שלו נכשל יכול להישאר עם `pendingFreshImport:true` תקוע לצמיתות אחרי ריצה
מאושרת. זה **קיים גם בלי השינוי שלי**, לא נוצר על ידו, ומחוץ להיקף (אסור
לגעת בלוגיקת הניתוח/ה-pipeline עצמם). תועד ב"פריטים פתוחים" למטה.

**מסקנה**: הבעיה הגדולה יותר (חיוב כפול) **לא קיימת** — ניתן היה להמשיך
ישירות ל-STEP 2 כפי שההנחיה קבעה שיקרה במקרה הזה.

---

## STEP 2 — שער האישור שהוחל

קובץ יחיד: `src/components/dashboard/VideoDetailPanel.jsx`. שינוי אדיטיבי
בלבד — **אין** שינוי בלוגיקת הניתוח, ב-prompts, ב-chunking, או בצורת הנתונים
המאוחסנים.

### מה השתנה (עם שורות)

1. **State חדש** (שורה ~2189-2193): `freshImportConfirmPending` (boolean).
2. **ה-`useEffect` הקיים** (שורה ~8154-8170): במקום לקרוא ל-`runFreshImportPipeline`
   ישירות, כעת רק קובע `setFreshImportConfirmPending(true)`. אותו token-guard
   (`freshImportAutoRunRef`) נשאר **בדיוק** כמו שהיה — כעת שולט מתי **הדיאלוג**
   מוצג (לא מוצג פעמיים לאותו token), לא מתי ה-pipeline רץ.
3. **`handleConfirmFreshImportGate`** (חדש, שורה ~8173-8182): סוגר את
   הדיאלוג, ואז קורא ל-`runFreshImportPipeline` עם **בדיוק** אותם פרמטרים
   כמו קודם. ה-pipeline עצמו **לא שונה באות אחת**.
4. **`handleCancelFreshImportGate`** (חדש, שורה ~8189-8206): סוגר את הדיאלוג,
   ואם `pendingFreshImport` עדיין `true` — כותב patch מפורש
   `{pendingFreshImport:false, freshImportRequestedAt:null, freshImportSource:null}`
   על גבי שאר שדות ה-video הקיימים ללא שינוי (`...video`). **לא נוגע**
   בתמלול/סיכום/פרקים/שום שדה ניתוח אחר.
5. **Dialog UI חדש** (שורה ~13308-13337), משתמש ברכיבי `Dialog`/`DialogContent`/
   `DialogHeader`/`DialogTitle`/`DialogDescription` **הקיימים כבר** בקובץ
   (אין import חדש), באותו סגנון בדיוק כמו דיאלוג האישור הקיים
   (`saveAllConfirmOpen`) ממש לידו. טקסט: "⚠️ ניתוח AI חדש — פעולה בתשלום...
   זו בקשה אמיתית בתשלום ל-API, לא פעולה מקומית. להמשיך?" עם כפתורי
   "ביטול"/"המשך לניתוח בתשלום". `onOpenChange` מטפל גם ב-Escape/קליק
   מחוץ לדיאלוג כ**ביטול** (לא כאישור מרומז) — "no paid analysis... without
   a deliberate click" נשמר גם למקרה שהמשתמש פשוט סוגר את החלון בלי לבחור.

### הבאג שנמצא ותוקן תוך כדי (לא היה מתוכנן מראש)

הגרסה הראשונה של `handleCancelFreshImportGate` השתמשה ב-`consumeFreshImportFlag(video)`
הקיים (אותה פונקציה שה-pipeline המקורי כבר משתמש בה בשני מקומות). ריפרודוקציה
חיה גילתה: **הדגל נשאר `true`** ב-storage אחרי לחיצת "ביטול"! שורש הבעיה:
`consumeFreshImportFlag` עושה `delete obj.pendingFreshImport` — מפתח שנמחק
לחלוטין מהאובייקט **אינו נראה** ב-spread merge (`{...old, ...new}`) שמבצע
`forceUpsertVideo` (`src/services/videoStorage.js:601`): אם `new` לא מכיל
את המפתח כלל, ה-merge משאיר את הערך הישן (`true`) כמו שהוא — **בניגוד
ל-`undefined`/`false` מפורשים, שכן היו דורסים**. תוקן ע"י כתיבת ה-patch
באופן מפורש (`pendingFreshImport: false` ולא מחיקה) — ראה קוד למעלה. אומת
מחדש חי: אחרי התיקון, "ביטול" מנקה את הדגל נכון (`false` בפועל ב-storage).

**זה חושף שהמנגנון הקיים (`consumeFreshImportFlag` + `forceUpsertVideo`)
תמיד היה שברירי** — עבד רק כי ב-pipeline המקורי תמיד יש אחריו patch מפורש
נוסף (`pendingFreshImport:false` בתוך ה-transcript-success branch). לא
תיקנתי את שני המקומות הקיימים ב-pipeline עצמו (`VideoDetailPanel.jsx:8034,8100`)
— זה שינוי ללוגיקת הניתוח, אסור לפי ההנחיה. תועד כפריט פתוח.

---

## PHASE 3 — אימות

- **`npm run build`** — הצליח פעמיים (לפני ואחרי תיקון ה-cancel bug), `dist/`
  נוצר מחדש בכל פעם, ללא שגיאות.
- **Lint** — אין `eslint.config.*` בפרויקט (מצב קיים, לא קשור).
- **`node scripts/return-to-analysis-deeplink-qa.mjs`** — 13/13 עברו (מוודא
  שלא שברתי את תיקון ה-race condition של הסשן המקביל ב-`Dashboard.jsx`).
- **`node scripts/claude-json-repair-qa.mjs`** — PASS (לא קשור ישירות,
  בדיקת שפיות ל-Claude pipeline).
- **בדיקה חיה מקיפה** (Chromium מבודד, נתוני production אמיתיים, POST
  ל-Claude מיורט ונספר, ללא בזבוז טוקנים אמיתיים):
  1. פתיחת "ייבא מחדש מאפס" → דיאלוג אישור מופיע, **0** קריאות עד ללחיצה.
  2. **ביטול** → 0 קריאות, `pendingFreshImport:false` ב-storage,
     `analysisStatus:"not_analyzed"`, `shortSummary:null` (שום דבר לא נוסף/נמחק).
  3. רענון דף אחרי ביטול → הדיאלוג **לא** חוזר, 0 קריאות.
  4. (פרופיל נקי נפרד) **אישור** → **בדיוק קריאה אחת** ל-`/api/claude-video-analyze`,
     זהה להתנהגות המקורית.
  5. רענון דף **בזמן שהדיאלוג פתוח ולא נענה** → 0 קריאות; פתיחה חוזרת של
     אותו סרטון **אחרי** הרענון מציגה שוב את הדיאלוג (guard מתאפס עם טעינת
     דף חדשה — צפוי ותקין, לא "שוכח" את הבקשה המקורית).
  6. Escape לסגירת הדיאלוג ⇔ ביטול: מנקה את הדגל, 0 קריאות.
- **קבצים שנגעתי בהם**: `src/components/dashboard/VideoDetailPanel.jsx`
  בלבד. הקובץ היה דירטי מסשן/ים אחר/ים לפני ואחרי — **לא נגעתי** בשום hunk
  שלא כתבתי בעצמי (וידאתי ב-`git diff` hunk-by-hunk לפני כתיבת הדוח).
- **סבבי תיקון: 1** (הגרסה הראשונה של הביטול לא ניקתה את הדגל בפועל —
  אובחן ותוקן באותו סבב לפני שנחתם).

---

## סיכונים

- שער האישור **לא** נותן פתרון לבאג הנלווה (ניקוי-דגל תלוי-הצלחת-תמלול
  בשני המקומות הקיימים ב-pipeline) — אם המשתמש **מאשר** אבל התמלול נכשל,
  הדגל עלול להישאר `true` תקוע (guard ה-ref ימנע הצגה חוזרת של הדיאלוג
  לאותו token, כך שהמשתמש לא יתבקש שוב עבור אותה בקשה — לא מסוכן כספית,
  אבל UX לא אידיאלי). קיים גם ללא השינוי הזה.
- אין קונפליקט עם התיקון של הסשן המקביל (`usePersistedVideo.js`/
  `handleVideoPatch`) — קבצים שונים, ולא נגעתי בשום דבר שקשור אליהם.
- `VideoDetailPanel.jsx` ממשיך להיות קובץ ענק ומאוד דירטי מכמה סשנים —
  commit עתידי של מישהו אחר עלול "לבלוע" את השינוי הזה בטעות אם לא יבדוק
  hunk-by-hunk. מומלץ למשתמש לבדוק `git diff` באופן ממוקד לפני כל commit.

## Rollback

שינוי בקובץ יחיד, לא מקומיט:

```bash
git checkout -- src/components/dashboard/VideoDetailPanel.jsx
```

**אזהרה**: הפקודה הזו תבטל **גם** את שינויי הסשן המקביל בקובץ הזה (307+
שורות diff לא-שלי) כי `git checkout --` על קובץ מבטל את **כל** ה-diff שלו,
לא רק hunk ספציפי. אם רוצים לבטל **רק** את התיקון הזה בלי לפגוע בעבודה
המקבילה — יש לערוך ידנית ולהסיר את 5 הבלוקים המסומנים
`TRADINGBRAIN-FRESHIMPORT-COST-GUARD` (חיפוש `grep -n COST-GUARD` בקובץ
מצביע על כל המיקומים המדויקים) ולהחזיר את ה-`useEffect` לקרוא ל-
`runFreshImportPipeline` ישירות כמו שהיה.

---

## רשימת QA ידנית — http://localhost:5184/

1. פתח "הוסף סרטון לפי קישור", הדבק URL של סרטון **קיים** שכבר נותח, לחץ
   Enter (מציג "הסרטון כבר קיים"), לחץ **"ייבא מחדש מאפס"**.
2. **ציפייה**: מיד אחרי סגירת ה-modal, נפתח דיאלוג אזהרה חדש: "⚠️ ניתוח AI
   חדש — פעולה בתשלום" עם הסבר שזו בקשה אמיתית בתשלום. **שום ניתוח לא
   מתחיל עדיין** (אין spinner "שולח ל-Claude" ברקע).
3. לחץ **"ביטול"**. ציפייה: הדיאלוג נסגר, הפאנל נשאר פתוח על הסרטון (ריק —
   "לא נותח"), **שום** ניתוח לא רץ.
4. רענן את הדף (F5). ציפייה: הדיאלוג **לא** חוזר להופיע לבד. פתח שוב את
   אותו סרטון (למשל דרך "הוסף סרטון לפי קישור" → אותו URL → "טען גרסה
   קיימת") — ציפייה: נשאר "לא נותח", בלי שום קריאת רשת ל-Claude.
5. חזור על שלב 1, והפעם לחץ **"המשך לניתוח בתשלום"**. ציפייה: הדיאלוג
   נסגר, ה-pipeline רץ בדיוק כמו קודם (תמלול → ניתוח AI אמיתי → תוצאה
   מוצגת בפאנל).
6. **בדיקת עלות בפועל**: פתח DevTools → Network, סנן `claude-video-analyze`,
   וודא שרק **קריאת POST אחת** נשלחת לכל ריצת "אישור" (לא כפולה).
7. חזור על שלב 1, לחץ Escape (לא על אף כפתור). ציפייה: מתנהג כמו "ביטול" —
   הדיאלוג נסגר, שום ניתוח לא רץ.
8. תרחיש עומס: פתח "ייבא מחדש מאפס" לסרטון, **בלי לענות לדיאלוג**, סגור את
   כל הפאנל (X), פתח סרטון **אחר** לגמרי, המתן 10 שניות. ציפייה: הסרטון
   האחר מוצג נכון (זה כבר הבטחת התיקון של הסשן המקביל), ושום ניתוח לא רץ
   ברקע עבור הסרטון הראשון.

---

## סיווג קבצים סופי

| קובץ | סטטוס | הערה |
|---|---|---|
| `src/components/dashboard/VideoDetailPanel.jsx` | **unstaged — שינוי שלי בתוך קובץ דירטי משסה אחרת** | 5 בלוקים מסומנים `COST-GUARD`; שאר ה-diff (307+ שורות) לא שלי |
| `src/hooks/usePersistedVideo.js` | unstaged, **לא שלי** | תיקון race-condition מסשן מקביל (ראה STEP 0) — לא נגעתי |
| `src/pages/Dashboard.jsx` | unstaged, **לא שלי** | `handleVideoPatch` מאותו תיקון race — לא נגעתי |
| `src/components/dashboard/ExternalVideoModal.jsx` | unstaged, **לא שלי (סשן קודם)** | ה-thumbnail-placeholder fix מדוח קודם — נשאר כמו שהוא |
| שאר קבצי ה-M/?? המקוריים (13+) | unstaged/untracked, לא שלי | לא נבדקו, מחוץ להיקף |
| `docs/plan/REPORT-TRADINGBRAIN-FRESHIMPORT-COST-GUARD.md` (קובץ זה) | untracked, נכתב ע"י הסשן הזה | |
| HEAD | `51701f6459fe60dc215b1823cff94e8a95a01b34` | זז מ-`c8bdd44` **לא על ידי** — קומיט מסשן מקביל |

**שום דבר לא הועלה כ"נשמר"/"הושלם" — אין commit, אין stage, אין push.**

---

## פריטים פתוחים ל-backlog-tracker

1. **ממתין ל-QA ידני של המשתמש** לפי הרשימה למעלה, לפני commit.
2. **באג ניקוי-דגל תלוי-הצלחת-תמלול** (STEP 1/PHASE C, לא WORK-ID הזה,
   לא תוקן): `consumeFreshImportFlag` + `forceUpsertVideo`'s spread merge
   בשני המקומות הקיימים ב-`runFreshImportPipeline` (`VideoDetailPanel.jsx:8034,8100`)
   אינם מנקים בפועל את `pendingFreshImport` אם התמלול נכשל/ריק — הניקוי
   האמיתי היחיד תלוי ב-patch מפורש שרץ רק כשהתמלול מצליח. אחרי אישור עם
   תמלול כושל, הדגל עלול להישאר תקוע `true` (לא מסוכן כספית, אבל UX
   לא-אידיאלי — הדיאלוג לא יופיע שוב לאותו token). מומלץ תיקון עתידי:
   להחליף את שתי הקריאות ל-`consumeFreshImportFlag` בפatch מפורש כמו זה
   שהוספתי ב-`handleCancelFreshImportGate`.
3. **אין QA script ייעודי** לשער האישור החדש — כדאי סקריפט Playwright-based
   (לא unit-test) שממשיך לרוץ ב-CI, בהשראת הריפרודוקציות שביצעתי (route
   interception + ספירת קריאות).
4. שני commits לא-מקומיטים נוספים מסשנים מקבילים (`usePersistedVideo.js`+
   `Dashboard.jsx` race-fix; `ExternalVideoModal.jsx` thumbnail-fix) ממתינים
   ל-QA/commit של המשתמש — לא קשור לתיקון הזה, אבל שווה לציין שיש כרגע 3
   שינויים עצמאיים לא-מקומיטים על אותו worktree שממתינים לבדיקה.

---

## lessons.md

`lessons.md — לא נקרא: המשימה בוצעה תחת מדיניות unattended override מפורשת
של Claude Code; קובץ הלקחים (C:\Users\11\.codex\lessons.md) שייך לתהליך
Codex/AGENTS.md ולא נטען אוטומטית בסשן Claude Code זה.`

לקח פוטנציאלי לתיעוד עתידי (מצוין כאן, לא נכתב ל-lessons.md כי הוא ספציפי
לפרויקט הזה ולא כלל-פרויקטי): "ב-`videoStorage.js`, `forceUpsertVideo`
משתמש ב-spread merge (`{...old, ...new}`) נגד רקורד קיים — מחיקת מפתח
(`delete`) על אובייקט לפני שליחתו ל-merge כזה **לא** מנקה את השדה ב-storage
אם הוא כבר קיים שם; יש לכתוב override מפורש (`key: false`/`null`) כדי
לנקות שדה בוליאני/דגל דרך הפונקציה הזו."
