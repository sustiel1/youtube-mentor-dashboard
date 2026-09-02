# דוח: TRADINGBRAIN-ANALYSIS-CONTENT-MISMATCH-SWEEP

תאריך: 2026-09-02
WORK-ID: TRADINGBRAIN-ANALYSIS-CONTENT-MISMATCH-SWEEP
סוג משימה: **READ-ONLY AUDIT בלבד** — לא בוצע שום edit/stage/commit/push/restart.
בעלים: `persistence-storage-engineer` (חקירה ראשית) | תמיכה קריאה-בלבד: `gemini-integration-engineer` (נתיבי GEM/Gemini) | ניתוב: `cto` | דוח זה נכתב ע"י האורקסטרטור לאחר איחוד שני הדוחות המקבילים.

---

## תקציר מנהלים

נמצא **מנגנון מוכח** (code-trace, לא live repro) שיכול לגרום בדיוק לתסמין שדווח: פאנל הווידאו מציג ניתוח של סרטון אחר לגמרי. המנגנון הוא **חוסר סימטריה בתיקון הקודם** (`59c4bb0`, WORK-ID `TRADINGBRAIN-ADDBYLINK-VIDEO-MISMATCH`) — התיקון ההוא הגן על נתיב אחד (`handleVideoPatch`) אבל **לא** על נתיב תאום שנקרא באותן נקודות בדיוק (`onAnalyzeDone`), שנשאר **ללא הגנה** עד היום.

**מה שלא הצלחנו לאשר**: האם הרשומה הספציפית שדיווחתם עליה ("מבזק לייב פתיחה לתאריך 31.8.26", `6INKqnq7cG8`) אכן **נשמרה** ב-`localStorage` עם התוכן השגוי, או שזו הייתה תקלת-תצוגה חולפת (הפאנל "קפץ" זמנית ולא נשמר בפועל). **אף אחד משני סוכני המשנה לא היה מצויד בכלי דפדפן/CDP** כדי לקרוא ישירות את ה-`localStorage` החי שלכם — זו מגבלת-כלים אמיתית, לא ממצא. סעיף "שאלות פתוחות" בסוף מפרט איך לסגור את הפער הזה.

---

## STEP 0 — הוכחת סביבה (מאומת ישירות ע"י האורקסטרטור, אחרי סיום שני הסוכנים)

- Repo root: `C:/Users/11/Desktop/Workspace/new-project/projects/youtube-mentor-dashboard`
- Branch: `feat/saved-market-rows-table`
- HEAD (בזמן כתיבת הדוח, מאומת ישירות): `e0e6fc1` ("feat: reposition library search")
- **ה-worktree זז תוך כדי הסשן**: `persistence-storage-engineer` דיווח ש-HEAD היה `68c157e` בתחילת עבודתו וזז ל-`e0e6fc1` תוך כדי — קומיט מסשן מקביל אחר, לא שלנו. הוכחה חיה נוספת ש-worktree זה משותף ופעיל כרגע (כמו שצוין גם ע"י `cto` וגם ע"י `TRADINGBRAIN-WORKTREE-TRIAGE` בלדג'ר).
- שני שרתי `vite` רצים על פורט 5184 (PID 14112 על `127.0.0.1`, PID 10360 על `[::1]`) — שניהם נטענים מתוך worktree זה; לא אומת איזה מהם "קנוני", לא הופעל/הופסק אף אחד.
- `git status --short` (מאומת ע"י האורקסטרטור אחרי שני הסוכנים): 16 קבצים modified + 17 untracked — כולל `src/components/dashboard/VideoDetailPanel.jsx` (עדיין דירטי, WIP לא-קשור מ-2 WORK-IDs אחרים: `FRESHIMPORT-COST-GUARD`, `GEMPICKER-COMPACT-SCORING`). **`src/pages/Dashboard.jsx` כבר נקי/מקומיט** נכון לזמן כתיבת הדוח — כל הציטוטים ממנו כאן הם **מהמצב המקומיט הנוכחי (`e0e6fc1`)**, לא WIP.
- `persistence-storage-engineer` דיווח על תיקון-עצמי שקוף: הרצה בטעות של פקודת `node -e` אד-הוק (ניסיון לקרוא קובץ LevelDB בינארי) שחרגה מהרשאת ה-Bash המוגבלת שלו ל-QA/lint/build/git בלבד; זוהתה בעצמו, לא חזרה על עצמה, לא השפיעה על שום קובץ. מדווח כאן לשקיפות מלאה, לא סווג כממצא.

---

## STEPS 1–3 — שחזור ישיר מול הרשומה + חיפוש מקור אמיתי + סריקה כלל-קורפורטית: **לא בוצעו**

שני סוכני המשנה דיווחו במפורש (לא בדו תוצאה) שאין להם כלי לקרוא את `localStorage['yt_mentor_videos_v2']` החי:
- `persistence-storage-engineer` מוגבל ל-Read/Write/Edit/Bash(מוגבל)/Glob/Grep — אין כלי דפדפן/CDP.
- `gemini-integration-engineer` מוגבל ל-Read/Write/Edit/Grep/Glob — אין לו אפילו Bash.
- ניסיון עוקף: `persistence-storage-engineer` ניסה `Grep` על עותק ישן (מסשן קודם) של פרופיל Chrome אמיתי תחת `C:\tmp\ymd-diag-browser-profile-20260902\Default\Local Storage\leveldb`, חיפוש `6INKqnq7cG8`, `yt_mentor_videos_v2`, ושדות סכימה ידועים (`shortSummary`, `analysisStatus`) — **אפס תוצאות בכולם**. זו **תוצאה לא-חד-משמעית**: ripgrep על תוכן LevelDB בינארי (rocksdb-style log/ldb files) נוטה לפספס מחרוזות שמפוצלות בין chunks דחוסים — לא ניתן להסיק מכך שהנתונים לא קיימים שם. בנוסף, timestamp העדכון של אותו פרופיל (00:53 היום) מראה שהוא נכתב זה עתה, כנראה ע"י סשן מקביל אחר — לא בטוח שהעותק הזה בכלל יציב/רלוונטי.
- לא נמצא אקספורט JSON קיים בדיסק של `yt_mentor_videos_v2` שניתן היה לקרוא ישירות.

**מסקנה**: הבאג **לא אושר ולא הופרך** מול הנתונים החיים שלכם. כל מה שלהלן הוא code-trace מוכח, לא live repro. ראו "שאלות פתוחות" לאיך לסגור את הפער.

---

## STEP 4 — נתיב הכתיבה: הממצא המרכזי

### הממצא המוכח (PROVEN, code-trace + אימות ישיר של האורקסטרטור נגד HEAD הנוכחי)

ב-`src/pages/Dashboard.jsx:1405`:
```js
onAnalyzeDone={(result) => setSelectedVideo((prev) => ({ ...prev, ...result }))}
onVideoPatch={handleVideoPatch}
```

לעומת `handleVideoPatch` הסמוך, `src/pages/Dashboard.jsx:743-753` (התיקון הקיים מ-`59c4bb0`):
```js
const handleVideoPatch = (patch) => {
  const patchedVideoId = patch?.id || selectedVideo?.id;
  setSelectedVideo((prev) => {
    if (!prev) return null;
    // A patch naming a different video's id is a stale async result (transcript
    // fetch, AI analysis, fresh-import pipeline) from a video the user has since
    // navigated away from — applying it would silently swap the open panel to
    // that other video. See TRADINGBRAIN-ADDBYLINK-VIDEO-MISMATCH.
    if (patch?.id && prev.id && patch.id !== prev.id) return prev;
    return { ...prev, ...patch };
  });
  ...
```

**`onAnalyzeDone` לא מקבל את אותה הגנה.** בכל שש נקודות הקריאה שלו ב-`VideoDetailPanel.jsx` (שורות 3424, 7475, 7755, 7804, 7964, 8665) הוא נקרא **צמוד** ל-`onVideoPatch` עם אותו `nextVideo` — אומת ישירות בקוד הנוכחי, למשל שורות 7754-7755 ו-8664-8665:
```js
onVideoPatch?.(nextVideo);
onAnalyzeDone?.(nextVideo);
```
`onVideoPatch` (מוגן) מעדכן את ה-cache (`queryClient`) **ואת** `selectedVideo` בבדיקת-זהות; `onAnalyzeDone` (לא מוגן) דורס את `selectedVideo` **שוב, בלי בדיקה**, מיד אחרי זה — כלומר ההגנה שהתווספה ב-`handleVideoPatch` נדרסת בפועל ע"י הקריאה הבאה באותה שורת קוד.

**כל ארבעת נתיבי הכתיבה שנבדקו (fresh import/Claude, re-analysis/Gemini, transcript paste/Claude) עוברים דרך `onAnalyzeDone` הלא-מוגן**; רק נתיב GEM-JSON-paste (`_applyParsedGems`) לא קורא ל-`onAnalyzeDone` בכלל ולכן לא נחשף.

**ההתאמה הכי קרובה לתרחיש שדיווחתם**: נתיב ה-re-analysis של Gemini (`handleGeminiContent`, `VideoDetailPanel.jsx:8540-8672`) הוא בדיוק הספק ל-GEM/מבזקי-בוקר, קורא ל-`fetchGeminiVideoContent` **בלי `AbortController`**, וה-timeout השרתי המוגדר (`vite.config.js`, לפי ה-CLAUDE.md המוגן של הפרויקט) הוא עד 600-620 שניות — חלון-race רחב מאוד למעבר בין סרטונים לפני שהתוצאה חוזרת.

### תרחיש מוכח (מבוסס קוד, זהה במנגנון לתרחיש שכבר הוכח ב-Phase B של הדוח הקודם)

1. משתמש פותח סרטון A (למשל וידאו טכני ישן עם ניתוח Cup-and-Handle), מתחיל ניתוח-מחדש (Gemini) שלוקח זמן.
2. משתמש סוגר/עוזב את הפאנל, פותח סרטון B ("מבזק לייב פתיחה לתאריך 31.8.26").
3. ניתוח A מסתיים ברקע → קורא ל-`onVideoPatch(nextVideoA)` (מתעלם, כי `prev.id !== patch.id`) **ואז מיד** ל-`onAnalyzeDone(nextVideoA)` (**לא בודק כלום**) → `setSelectedVideo(prev => ({...prev, ...nextVideoA}))` → הפאנל שמציג כרגע B **מתמלא בתוכן של A** (כותרת, סיכום, tags — כולל `.id` של A).

זה מסביר **בדיוק** את הסימפטום שבצילום המסך: תוכן Cup-and-Handle/Data Dog/Charter/HCI תחת פאנל שאמור להציג מבזק בוקר.

### מה כן מוגן (PROVEN)

עקבתי (persistence-storage-engineer) את שרשרת הכתיבה בפועל ל-storage בשני הנתיבים: `runAiAnalysis` → `patch.id = workingVideo.id` (נצרב מ-closure) → `updateSummary.mutateAsync` → `updateLocalVideo`/`updateStoredVideo` (`videoStorage.js:256-259`) → `findIndex(v => v.id === id)` — **התאמה בלעדית לפי id, ללא fallback רך**. כלומר **הכתיבה המתמשכת (persist) עצמה תמיד הולכת ל-id הנכון** בנתיב הזה — ה-`59c4bb0` וההגנה הפנימית של `usePersistedVideo` לא באמת נדרשים לזה, כי ה-id כבר "נעוץ" בסגירה (closure) מרגע הפעלת הניתוח, לא נגזר מ-state חי.

**המשמעות**: הממצא המרכזי (`onAnalyzeDone`) הוא **וודאי תקלת-תצוגה** (הפאנל הפתוח מציג תוכן שגוי). האם הוא **גם** גורם לכתיבה שגויה ל-storage — תלוי אם פעולה נוספת של המשתמש (עריכה ידנית, שמירת תג) מתבצעת בזמן שהפאנל "משוכנע" בטעות שהוא מציג את A — לא אושר בפועל (Steps 1-3 לא בוצעו).

### ממצא משני, לא-מוכח (HYPOTHESIS בלבד) — נתיב storage נפרד לגמרי

ב-`src/services/videoStorage.js:587-592`, `forceUpsertVideo` (בשימוש בנתיב "ייבוא מחדש מאפס"):
```js
const idx = videos.findIndex(
  (v) =>
    v.id === video.id ||
    (url && v.url === url) ||
    (ytId && extractVideoId(v.url) === ytId)
);
...
if (idx !== -1) {
  videos[idx] = { ...videos[idx], ...record }; // record.id === video.id, נכפה על התוצאה
}
```
זו התאמה עם **fallback רך** לפי `url`/`ytId` בנוסף ל-`id`. בתנאי-קצה (אם ההתאמה לפי `id` נכשלת אבל `url`/`ytId` תואמים רשומה **אחרת** קיימת), הפונקציה תמזג את הרקורד החדש **לתוך הרשומה האחרת** ותכפה עליה `id` חדש — מנגנון **נפרד לגמרי** מבעיית ה-`onAnalyzeDone`, שיכול תיאורטית לגרום לזיהום צולב אמיתי ב-storage (לא רק בתצוגה). **לא אומת שקרה בפועל** — זו רק זיהוי-מנגנון תיאורטי שדורש נתונים חיים כדי לבדוק (למשל: לחפש שתי רשומות עם אותו `url`/`ytId` אבל `id` שונה).

---

## STEP 3 — טבלת mismatch כלל-קורפורטית

**לא בוצעה** — תלויה ב-Steps 1-2 (קריאת נתונים חיים) שלא התאפשרו. אין טבלה להציג; 0 רשומות נסרקו בפועל מול נתונים אמיתיים.

---

## סטטוס root-cause

| ממצא | סטטוס | מנגנון |
|---|---|---|
| `onAnalyzeDone` (`Dashboard.jsx:1405`) חסר את הגנת הזהות שיש ל-`handleVideoPatch` | **PROVEN** (code-trace + אימות ישיר מול HEAD נוכחי `e0e6fc1`) | תקלת-תצוגה: פאנל פתוח יכול להציג ניתוח של סרטון אחר |
| הכתיבה המתמשכת ל-storage (נתיב ניתוח AI רגיל) תמיד הולכת ל-id הנכון | **PROVEN** (code-trace עד `updateStoredVideo`) | closure-bound id, לא state חי |
| `forceUpsertVideo` fallback matching (`url`/`ytId`) יכול לזהם רשומה אחרת | **HYPOTHESIS** | לא אומת בנתונים חיים |
| הרשומה הספציפית שדווחה ("31.8.26"/`6INKqnq7cG8`) אכן נגועה ב-storage (לא רק הוצגה שגוי רגעית) | **לא נבדק** | Steps 1-3 לא בוצעו — מגבלת כלים |
| קיימות רשומות נוספות נגועות בקורפוס | **לא נבדק** | Steps 1-3 לא בוצעו |
| ניקוי (אם יידרש) — ידני או סקריפטי | **לא ניתן להחליט** — תלוי בממצאי Steps 1-3 שלא בוצעו | — |

---

## הצעת guard לזיהוי (לא מומש — read-only)

### 1. תיקון מינימלי, סימטרי לתיקון הקיים (עלות: נמוכה מאוד)
להוסיף ל-`onAnalyzeDone` ב-`Dashboard.jsx:1405` בדיוק את אותה בדיקה שכבר קיימת ב-`handleVideoPatch:751`:
```js
onAnalyzeDone={(result) => setSelectedVideo((prev) => {
  if (!prev) return null;
  if (result?.id && prev.id && result.id !== prev.id) return prev;
  return { ...prev, ...result };
})}
```
זהה בדיוק לדפוס שכבר אושר ותוקן פעם אחת (`59c4bb0`) — אותה "משפחת תיקון", אותו קובץ, אותה שורה בקירוב. **סיכון רגרסיה נמוך** (התנהגות משתנה רק במקרה של תוצאה אסינכרונית שמגיעה אחרי מעבר סרטון — התרחיש הרגיל לא מושפע, בדיוק כמו שהוכח ב-Phase D של הדוח הקודם).

### 2. הגנת write-time עמוקה יותר (עלות: בינונית)
ב-`forceUpsertVideo` (`videoStorage.js:587-608`) — להימנע ממיזוג-דריסה כש-`id` לא תואם ישירות אלא רק `url`/`ytId` (fallback), או לפחות לרשום אזהרה מפורשת (`console.warn`) כדי שתקלה עתידית תהיה ניתנת לאבחון בלוגים במקום להיעלם בשקט.

### 3. אזהרת read-time (עלות: גבוהה יחסית, פיצ'ר UI חדש)
בדיקת-עקביות קלה בזמן טעינת רשומה: אם ה-tags/summary language "מתנגש" בבירור עם קטגוריית הכותרת (למשל `ניתוח טכני`/`ספל וידית` על רשומה שכותרתה מכילה `מבזק`/`לייב`/`פתיחה`), להציג badge אזהרה בפאנל — **לא לתקן אוטומטית**, רק לחשוף. דורש היוריסטיקה נוספת (רשימת מילות-מפתח סותרות) ותחזוקה.

---

## קריטריוני קבלה מדידים לתיקון עתידי

1. **שחזור חי דטרמיניסטי** (Playwright, בהשראת Phase B בדוח הקודם): פתיחת סרטון A, התחלת ניתוח-מחדש עם `page.route()` שמעכב את תגובת ה-API, מעבר לסרטון B תוך כדי, המתנה לסיום ניתוח A — הפאנל **נשאר** על B (לא "קופץ" חזרה ל-A). כישלון = הבאג עדיין קיים.
2. **בדיקת רגרסיה**: אותו תרחיש בלי race (המשתמש נשאר על אותו סרטון) — התוכן עדיין מתעדכן נכון.
3. **סקריפט QA חדש לזיהוי mismatch כלל-קורפורטי** (למשל `scripts/analysis-videoid-consistency-qa.mjs`) שרץ מול dataset (live export או fixture) ומזהה: (א) tags/topic-category שסותר את קטגוריית הכותרת, (ב) שתי רשומות עם summary זהה/כמעט-זהה. הסקריפט חייב לתפוס את המקרה הידוע (הרשומה שדיווחתם) כ-positive.
4. הרשומה הספציפית שדווחה מאומתת נקייה (אחרי תיקון, או אחרי ניקוי ידני אם התברר שהיא נגועה בפועל).
5. אין רגרסיה בסקריפטי ה-QA הקיימים שנוגעים לאותו אזור (`return-to-analysis-deeplink-qa.mjs`, `canonical-video-analysis-hydration-qa.mjs`, `pinned-recent-video-card-qa.mjs`).

---

## שאלות פתוחות הדורשות החלטת משתמש

1. **איך לסגור את פער Steps 1-3?** שתי אפשרויות: (א) לאשר לסוכן משנה גישה לכלי דפדפן/Playwright כדי לקרוא את ה-`localStorage` החי דרך שרת הפיתוח הרץ (יש שני שרתי vite פעילים על 5184), או (ב) אתם מריצים את כלי הגיבוי/ייצוא הקיים באפליקציה (יש כלי DEV תחת `src/dev/`) ושומרים JSON — אז נוכל לקרוא אותו ישירות. בלי אחת מהשתיים, לא ניתן לאשר אם הרשומה הספציפית או רשומות נוספות בקורפוס נגועות בפועל.
2. **לממש את התיקון המינימלי המוצע (סעיף 1 למעלה) עכשיו**, גם בלי אישור live, בהתחשב בזה שהוא זהה בדיוק לתיקון שכבר אושר פעם אחת (`59c4bb0`) ובסיכון-רגרסיה נמוך? או להמתין לאישור-live קודם?
3. אם יתברר שיש רשומות נגועות בפועל בקורפוס — ניקוי ידני (אתם, רשומה-רשומה) או סקריפט תיקון אוטומטי (מבוסס על שחזור התוכן הנכון מהתמלול/re-analysis)?
4. `src/components/dashboard/VideoDetailPanel.jsx` עדיין דירטי מ-2 WORK-IDs אחרים (~605 שורות diff) — כל תיקון עתידי ב-`onAnalyzeDone`/`Dashboard.jsx` לא נוגע בקובץ הזה בכלל (כמו התיקון הקודם), אבל אם בעתיד יידרש תיקון גם בתוך `VideoDetailPanel.jsx` עצמו — יהיה צריך לתאם עם הסשנים האחרים כדי לא להתנגש ב-WIP הקיים.

---

## קבצים שנקראו/נבדקו (ריכוז)

`src/pages/Dashboard.jsx` (שורות 743-757, 1401-1408), `src/components/dashboard/VideoDetailPanel.jsx` (שורות 2141, 3424, 7475, 7567-7970, 7740-7810, 8010-8122, 8540-8672), `src/hooks/usePersistedVideo.js`, `src/hooks/useVideos.js` (שורות 1-260), `src/lib/localVideoStore.js`, `src/services/videoStorage.js` (שורות 215-334, 577-608), `src/lib/videoFreshImport.js` (שורות 190-369), `src/ai/gemini/gemContentRouter.js`, `src/services/geminiVideoContent.js`, `docs/plan/REPORT-TRADINGBRAIN-ADDBYLINK-VIDEO-MISMATCH.md`, `docs/open-items-ledger.md`.

---

## פריטים פתוחים ל-backlog-tracker

1. **`onAnalyzeDone` (`Dashboard.jsx:1405`) חסר הגנת זהות סימטרית ל-`handleVideoPatch`** — PROVEN, תיקון מוצע קיים (סעיף "הצעת guard" #1 למעלה), ממתין להחלטת משתמש אם לממש עכשיו או אחרי אימות-live. Owner מוצע: `persistence-storage-engineer`.
2. **Steps 1-3 (repro חי + סריקה כלל-קורפורטית) לא בוצעו** — מגבלת כלים (אין דפדפן/CDP בסוכני persistence/gemini). דורש החלטת משתמש (שאלה פתוחה #1). Owner מוצע: `persistence-storage-engineer` (עם גישת דפדפן) או המשתמש (ייצוא ידני).
3. **`forceUpsertVideo` fallback matching (`url`/`ytId`) — hypothesis לזיהום צולב ב-storage, לא אומת** — דורש בדיקה מול נתונים חיים (חלק מ-Steps 1-3) או ניתוח-קוד נוסף ממוקד. Owner מוצע: `persistence-storage-engineer`.
4. **אין סקריפט QA לזיהוי mismatch בין ניתוח לזהות וידאו** — קריטריון קבלה #3 למעלה. Owner מוצע: `persistence-storage-engineer` או `qa-release-reviewer`.
5. **`docs/qa/error-scan-log.md` לא קיים** — `error-monitoring-reviewer` מעולם לא הורץ (תזכורת מ-`cto`, לא ממצא של המשימה הזו).

---

## lessons.md

`lessons.md — נקרא: כן` (שני סוכני המשנה קראו `C:\Users\11\.codex\lessons.md`).
**לקחים רלוונטיים שהוחלו**: "Report a missing browser tool instead of fabricating live browser QA" (2026-09-01) — יושם במלואו, שני הסוכנים דיווחו במפורש על מגבלת-הכלים במקום לבדות repro; "Audit safety invariants repository-wide" — `gemini-integration-engineer` מיפה את **כל** נקודות הקריאה ל-`onAnalyzeDone` בקובץ, לא רק את הראשונה שנמצאה; "Trace discriminator gates through every consumer" (2026-08-19) — `persistence-storage-engineer` עקב עד הכתיבה בפועל ב-storage, לא נעצר ב-hook הראשון.
**לקח חדש שנוסף**: לא נוסף לקח חדש חד-משמעי ע"י שני הסוכנים. **לקח פוטנציאלי לתיעוד עתידי (לא נכתב אוטומטית, רק מוצע)**: "כשמתקנים race condition ב-async-completion callback, לבדוק את **כל** ה-callbacks המקבילים שנקראים באותה נקודת קוד (`onVideoPatch`+`onAnalyzeDone` וכו') — תיקון שמכסה רק אחד מהם משאיר את הבאג פתוח דרך התאום שלו, בדיוק כמו שקרה כאן."