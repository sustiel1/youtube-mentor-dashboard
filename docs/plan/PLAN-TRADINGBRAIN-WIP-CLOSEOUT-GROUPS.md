# PLAN-TRADINGBRAIN-WIP-CLOSEOUT-GROUPS

**WORK-ID:** TRADINGBRAIN-WIP-CLOSEOUT-PRECLEAN (Phase 3 בלבד)
**סוג מסמך:** תכנון/הכנה בלבד — **אין** בקובץ זה, ולא בוצע כתוצאה ממנו, שום `git add`/`commit`/`push`.
**Repo:** `youtube-mentor-dashboard`, branch `feat/saved-market-rows-table`
**HEAD בזמן הכתיבה:** `8586bbf62a119e384960c821825dbde0d421361d`
**תאריך:** 2026-09-07

---

## שלב a — מדידה טרייה של עץ העבודה

`git status --porcelain -b` הורץ מחדש ממש לפני כתיבת מסמך זה (לא הסתמכות על תמונת מצב ישנה). התוצאה: **12 קבצים לא-committed** — 10 `M` + 2 `??` — זהה בדיוק לרשימה שבגוף המשימה:

```
 M .claude/settings.json
 M scripts/brief-gem-selector-qa.mjs
 M scripts/pinned-recent-video-card-qa.mjs
 M src/ai/gemini/gemContentRouter.js
 M src/components/dashboard/ExternalVideoModal.jsx
 M src/components/dashboard/GemRecommendationCard.jsx
 M src/components/dashboard/GemSelectionModal.jsx
 M src/components/dashboard/VideoDetailPanel.jsx
 M src/components/workspace/WorkspaceCollectionTiles.jsx
 M src/lib/gemRecommender.js
?? docs/plan/PLAN-TRADINGBRAIN-DAILY-DIRECTION-STATS.md
?? scripts/publish-date-header-coverage-qa.mjs
```

**בדיקת "האם מישהו עורך עכשיו בפועל" (לא רק `git status`, גם טבלת תהליכים):**

- לכל אחד מ-12 הקבצים נבדק mtime טרי (`stat -c %y`). האחרון שהשתנה הוא `.claude/settings.json` (2026-09-07 11:43) — **8+ דקות** לפני רגע הכתיבה הזה; שאר הקבצים לא זזו מאז 2026-09-01–2026-09-06. **אף קובץ מתוך ה-12 אינו "חם" (בעריכה ממש עכשיו).**
- **אך** נמצא בפועל תהליך Codex חי (`codex.exe` PID 34940 + שרשרת `codex-command-runner`/`node.exe`, כולם `Get-Process` → alive) עם `--working-dir` בדיוק על worktree זה, שהחל **2026-09-07 11:51:57** — כלומר תוך כדי המשימה הנוכחית. תוך כדי הבדיקה נצפה בפועל **collision חי**: `docs/open-items-ledger.md` השתנה (`M`, mtime 11:52:47) על ידי אותו תהליך Codex, ואז — לפני שנגעתי בו בכלל — הוא **commit-א ו-push-א את עצמו** (`8586bbf`, "docs(ledger): record FOMC regime-cell sample-size finding") ונעלם מ-`git status`. שום נזק לא נגרם (לא נגעתי בקובץ בזמן שהשתנה), אך זו הוכחה טרייה נוספת לסיכון המתועד ב-[[project_shared_worktree_coordination]] — worktree זה פעיל כרגע גם ל-Codex, לא רק לסשני Claude Code.
- מסקנה מעשית: **אף אחד מ-12 הקבצים לא הוחרג** (אף לא `VideoDetailPanel.jsx`, שהמשימה חשדה בו במפורש) — אך `docs/open-items-ledger.md` עצמו נשאר בסיכון קבוע לקולזיה חיה, ולכן מסירת הרשומות ל-`backlog-tracker` (סעיף f למטה) עדיפה על כתיבה ישירה שלי לקובץ הזה כרגע.

**ממצא רקע חשוב:** רוב 10 הקבצים ה-`M` (למעט `.claude/settings.json` שהמשיך לגדול) **כבר גובו במלואם, בייט-לבייט**, ב-`docs/qa/WIP-SNAPSHOT-2026-09-06.patch` (commit `2f005ff`, **דחוף ל-`origin`**) — אומת עכשיו ישירות עם `git apply --check --reverse` לכל קובץ בנפרד: `brief-gem-selector-qa.mjs`, `pinned-recent-video-card-qa.mjs`, `gemContentRouter.js`, `ExternalVideoModal.jsx`, `GemRecommendationCard.jsx`, `GemSelectionModal.jsx`, `VideoDetailPanel.jsx`, `gemRecommender.js` — **כולם תואמים בייט-לבייט** לפאץ' הזה. המשמעות: **הסיכון האמיתי ב"אובדן" של 8 מתוך 12 הקבצים נמוך בהרבה ממה שנראה על פני השטח** — גם אם ה-worktree יימחק, ניתן לשחזר את אותו תוכן בדיוק מהפאץ' המתועד. הסיכון האמיתי מרוכז בשני קבצים **ללא כל גיבוי**: `docs/plan/PLAN-TRADINGBRAIN-DAILY-DIRECTION-STATS.md` (נוצר 20:13, אחרי ה-snapshot מ-12:13) ו-`scripts/publish-date-header-coverage-qa.mjs` (untracked — לא נכלל ב-patch שמכסה רק קבצים tracked).

---

## שלב b — קיבוץ 12 הקבצים ל-7 קבוצות עצמאיות

הקיבוץ מבוסס על ניתוח `git diff` טרי לכל קובץ + היסטוריה קיימת ומאומתת מחדש היום ב-`docs/open-items-ledger.md` (במיוחד השורות תחת `TRADINGBRAIN-GEMPICKER-COMPACT-SCORING`, `TRADINGBRAIN-ADDBYLINK-VIDEO-MISMATCH`, `TRADINGBRAIN-PINNED-CARD-QA-BROKEN-BY-CONCURRENT-EDIT`, `TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS`, `TRADINGBRAIN-VIDEODETAILPANEL-INTERLEAVED-STAGING`, `YMD-SETTINGS-UNCOMMITTED` — כל אחד מהם עודכן היום מחדש עם ריצה חיה, ראה שלב c).

| # | קבוצה (WORK-ID) | קבצים | דורש `git add -p`? |
|---|---|---|---|
| 1 | ללא בעלים — false-positive | `WorkspaceCollectionTiles.jsx` | לא |
| 2 | ללא בעלים — תיעוד תכנון | `docs/plan/PLAN-TRADINGBRAIN-DAILY-DIRECTION-STATS.md` | לא |
| 3 | `YMD-SETTINGS-UNCOMMITTED` | `.claude/settings.json` | לא |
| 4 | `TRADINGBRAIN-ADDBYLINK-VIDEO-MISMATCH` | `ExternalVideoModal.jsx` | לא |
| 5 | `TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS` (תת-פריט: QA stale) | `scripts/publish-date-header-coverage-qa.mjs` | לא |
| 6 | `TRADINGBRAIN-PINNED-CARD-QA-BROKEN-BY-CONCURRENT-EDIT` | `scripts/pinned-recent-video-card-qa.mjs` | לא |
| 7 | `TRADINGBRAIN-GEMPICKER-COMPACT-SCORING` (+ `TRADINGBRAIN-FRESHIMPORT-COST-GUARD` שזור) | `gemRecommender.js`, `GemSelectionModal.jsx`, `GemRecommendationCard.jsx`, `gemContentRouter.js`, `brief-gem-selector-qa.mjs`, **`VideoDetailPanel.jsx`** | **כן — רק `VideoDetailPanel.jsx`** |

**⚠️ הקובץ היחיד מבין ה-12 שדורש staging ברמת hunk:** `VideoDetailPanel.jsx`. השורה הקיימת `TRADINGBRAIN-VIDEODETAILPANEL-INTERLEAVED-STAGING` בלדג'ר (מאומתת שוב היום — עדיין 408 שורות/251+/157-, זהה) מתעדת שה-diff הזה שזור בין שני WORK-ID נפרדים (`TRADINGBRAIN-GEMPICKER-COMPACT-SCORING` ו-`TRADINGBRAIN-FRESHIMPORT-COST-GUARD`) שאיש לא פירק בפועל עדיין — סטטוס `needs-user-decision`. שאר 11 הקבצים נקיים — כל אחד תואם בדיוק ל-WORK-ID אחד.

---

## שלב c — פירוט לכל קבוצה (מהבטוחה למסוכנת)

### קבוצה 1 — `WorkspaceCollectionTiles.jsx` (הכי בטוחה — בעצם "אין כלום")
**מה זה עושה:** כלום. אומת עכשיו ישירות: `git show HEAD:...` מול הקובץ בדיסק — **5347 בייט בשני הצדדים, זהים לחלוטין**. ה-`M` ב-`git status` הוא artifact טהור של אזהרת "LF will be replaced by CRLF" — לא שינוי תוכן. מתועד כבר ב-ledger (2026-09-03 CORRECTION) כ-false-positive.
**אומת בדפדפן אמיתי:** לא רלוונטי — אין קוד ששונה.
**סיכון אם יאבד:** אפס. אין מה לאבד.
**הודעת commit מוצעת:** אין צורך ב-commit בכלל. אם רוצים "לנקות" את ה-`git status`, `git add` בלבד (ללא commit נפרד) יספיק לרענן את סטטוס ה-index; לא ממליץ לבזבז commit נפרד על שינוי line-ending.
**QA ידני (עברית):** לא נדרש — שום קוד לא השתנה.

---

### קבוצה 2 — `docs/plan/PLAN-TRADINGBRAIN-DAILY-DIRECTION-STATS.md`
**מה זה עושה:** מסמך תכנון בלבד (299 שורות) ל-WORK-ID נפרד `TRADINGBRAIN-DAILY-DIRECTION-STATS` — הטיה סטטיסטית ליום המסחר. מצהיר במפורש בכותרתו: "לא בוצע שום שינוי קוד כתוצאה ממסמך זה". קורא/מתעד את עץ העבודה המלוכלך כרקע לא-קשור, לא נוגע בו.
**אומת בדפדפן אמיתי:** לא רלוונטי — מסמך, לא קוד.
**סיכון אם יאבד:** בינוני-גבוה יחסית לגודלו — **אין שום גיבוי קיים** (נוצר 20:13 ב-2026-09-06, אחרי ה-snapshot commit `2f005ff` מ-12:13 usually; קובץ untracked לחלוטין). איבודו פירושו לשחזר מחקר/תכנון של מפת שימוש-חוזר, חוזה נתונים, וטווחי תאריכים מאפס.
**הודעת commit מוצעת:** `docs(plan): add TRADINGBRAIN-DAILY-DIRECTION-STATS planning doc (no code)`
**QA ידני (עברית):**
1. פתח את הקובץ וודא שהוא נטען כ-Markdown תקין (אין תגי HTML שבורים).
2. ודא שאין בו מפתחות API, סיסמאות או נתונים רגישים (מסמך זה עצמו מצהיר "לא בוצע שינוי קוד" — משמש כבדיקת שפיות בלבד).
3. אין צורך בבדיקת דפדפן — זהו commit תיעודי טהור.

---

### קבוצה 3 — `.claude/settings.json` (`YMD-SETTINGS-UNCOMMITTED`)
**מה זה עושה:** תוספות ל-allowlist של הרשאות כלים ל-Claude Code (לא קוד אפליקציה): `node --check`, פתיחת Chrome עם remote-debugging, `curl` ל-endpoints של DevTools ול-Yahoo/FRED/ALFRED (מהעבודה על `TRADINGBRAIN-DAILY-DIRECTION-STATS` ב-worktree הנפרד), והרצת `pinned-recent-video-card-qa.mjs`/`validate-history.mjs`. אומת עכשיו: 18 שורות diff (היה 11+/1- ב-2026-09-06, גדל מאז).
**אומת בדפדפן אמיתי:** לא רלוונטי — קובץ קונפיגורציה של הכלי, לא של האפליקציה.
**סיכון אם יאבד:** נמוך — קל יחסית לשחזר (המשתמש יאושר מחדש כל הרשאה בפעם הבאה שתידרש), אבל מטריד מבחינת נוחות עבודה.
**הודעת commit מוצעת:** `chore(claude-settings): allow FRED/Yahoo fetch + chrome-debug + QA-run commands`
**QA ידני (עברית):**
1. פתח את `.claude/settings.json` וודא שה-JSON תקין (`node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json'))"`).
2. ודא שאין בשורות החדשות מפתח API אמיתי בטקסט גלוי (רק פקודות `curl` עם URL-ים ציבוריים ללא מפתח — נבדק, תקין).
3. אין צורך בבדיקת דפדפן.

---

### קבוצה 4 — `ExternalVideoModal.jsx` (`TRADINGBRAIN-ADDBYLINK-VIDEO-MISMATCH`)
**מה זה עושה:** תיקון הגנתי-בלבד (additive) לבאג "וידאו לא נכון מוצג בתצוגה מקדימה": YouTube CDN מחזיר 404 עם גוף placeholder תקין (120×90) עבור וידאו שנמחק, כך שה-`<img>` מפעיל `onload` (לא `onerror`) ושרשרת ה-fallback הקיימת (maxres→hq) לא מופעלת בשקט. התוספת: handler ל-`onLoad` שבודק `naturalWidth <= 120` ומציג מצב מפורש "אין תמונה — לא נמצאה תמונה ממוזערת" במקום placeholder מטעה.
**אומת בדפדפן אמיתי:** **כן, חלקית** — נבדק בעבר חי (placeholder מוצג לזיהוי מת, thumbnail אמיתי עדיין נטען לזיהוי תקין, ללא false positives). `npm run build` נקי. **לא אומת**: התרחיש המקורי המלא שדווח ("נפתח סרטון מ-31.8") — root cause אחר (מירוץ כתיבה א-סינכרונית) כבר תוקן ונדחף בנפרד (`59c4bb0`), נפרד מהתיקון הזה.
**סיכון אם יאבד:** נמוך — **מגובה בייט-לבייט** ב-`docs/qa/WIP-SNAPSHOT-2026-09-06.patch` (אומת `git apply --check --reverse` עכשיו — תואם).
**הודעת commit מוצעת:** `fix(video-modal): show explicit "no thumbnail" state instead of a misleading CDN placeholder`
**QA ידני (עברית):**
1. פתח "הוסף סרטון לפי קישור" והדבק URL של סרטון **קיים** ותקין — ודא שהתמונה הממוזערת האמיתית נטענת כרגיל (ללא רגרסיה).
2. הדבק URL של מזהה וידאו **לא-קיים/מחוק** (לדוגמה מזהה אקראי בן 11 תווים) — ודא שמופיע טקסט מפורש "אין תמונה — לא נמצאה תמונה ממוזערת" ולא placeholder ריק/מטעה.
3. ודא שבשני המקרים אין שגיאות ב-console.
4. לחץ "הוסף לדשבורד" על הסרטון התקין מסעיף 1 — ודא שנפתח בדיוק הסרטון שהודבק (לא סרטון ישן/אחר).
5. חזור על הבדיקה המקורית שדווחה (ה-URL/ID המדויק מהדיווח ההתחלתי, אם קיים בהישג יד) כדי לסגור סופית את ה-WORK-ID.

---

### קבוצה 5 — `scripts/publish-date-header-coverage-qa.mjs` (חלק מ-`TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS`)
**מה זה עושה:** סקריפט QA שנועד להוכיח שהפער "'כל הסרטונים' לא מקבל כותרת תאריך פרסום" עדיין קיים (`assert.doesNotMatch(...,/buildSectionMetadataLine/...)`). **אומת עכשיו מחדש, ריצה חיה**: הסקריפט **נכשל** — `WorkspaceVideoGroupCard.jsx` **כבר** קורא ל-`buildSectionMetadataLine` (קומיט אחר, לא-מזוהה, שכבר נכנס ל-HEAD) — כלומר הפער שהסקריפט נועד להוכיח **כבר נסגר**, וה-assertion של הסקריפט הפוך/מיושן ביחס למציאות הנוכחית, לא רגרסיה אמיתית.
**אומת בדפדפן אמיתי:** לא רלוונטי לקובץ עצמו (זהו קובץ בדיקה, לא קוד אפליקציה) — אך המצב שהוא בודק מעולם לא אומת מול IndexedDB אמיתי של המשתמש.
**סיכון אם יאבד:** נמוך — מגובה בייט-לבייט? **לא** — קובץ untracked, **אין לו שום גיבוי** (לא נכלל ב-WIP-SNAPSHOT.patch, ששומר רק קבצי tracked). איבודו פירושו לכתוב מחדש 53 שורות של הוכחת-כיסוי, אך התוכן שהוא מוכיח כבר לא רלוונטי (ראה למעלה) כך שהאובדן בפועל נמוך.
**המלצה לפני commit:** **אין להכניס כמות שהוא** — יכניס gate כשל קבוע ל-suite. יש להחליט: להפוך את הכיוון (`doesNotMatch`→`match`) כדי לשקף שהפער נסגר, או לפרוש (retire) את הסקריפט. החלטה זו שייכת ל-`gemini-integration-engineer`/`frontend-rtl-developer` (ראו ledger).
**הודעת commit מוצעת (רק אחרי החלטה):** `test(workspace): flip publish-date-header coverage assertion to match closed gap` (או `chore: retire stale publish-date-header-coverage-qa.mjs`, לפי ההחלטה).
**QA ידני (עברית) — לביצוע אחרי תיקון הסקריפט:**
1. הרץ `node scripts/publish-date-header-coverage-qa.mjs` וודא סיום עם "12 assertions passed" (או המספר המעודכן לאחר תיקון).
2. פתח את מסך "כל הסרטונים" (ללא אוסף נבחר) בדפדפן אמיתי עם נתונים אמיתיים — ודא בעין שכותרת תאריך פרסום אכן מוצגת מעל כל סקציה.
3. ודא שאין שגיאות console בטעינת המסך הזה.

---

### קבוצה 6 — `scripts/pinned-recent-video-card-qa.mjs` (`TRADINGBRAIN-PINNED-CARD-QA-BROKEN-BY-CONCURRENT-EDIT`)
**מה זה עושה:** קובץ QA שעבר תוספת assertions חדשה (תיקון "מונים" + 4 fixtures חדשים: הוספה/הסרה של שורה שמורה, אוסף ריק נשאר אפס) — אך **נכשל היום מחדש, ריצה חיה מאומתת**: על `assert.match(pageSource, /showClearFocus=\{false\}/...)` מול `WorkspaceLibrary.jsx` — קובץ **שאינו חלק מ-12 הקבצים האלה** (כבר committed בעבר תחת `TRADINGBRAIN-WORKSPACE-TILES-PLACEMENT`) והשאיר את הקובץ הזה עם assertion מיושן.
**⚠️ אזהרה מיוחדת:** הקובץ הזה עבר תקרית `git checkout --` בטעות שמחקה WIP קודם (מתועד ב-ledger, 2026-09-03) ושוחזר ידנית מזיכרון ה-context של הסשן שביצע זאת — **מעולם לא הוכח checksum-זהה למקור לפני התקרית**. לכן דורש בדיקת-תוכן של בעלים (`frontend-rtl-developer`) לפני אמון מלא, לא רק commit אוטומטי.
**אומת בדפדפן אמיתי:** לא — קובץ QA בלבד, ותוצאתו כרגע כישלון.
**סיכון אם יאבד:** נמוך-בינוני — **מגובה בייט-לבייט** ב-WIP-SNAPSHOT.patch (אומת עכשיו) **אך** אותו גיבוי הוא בעצמו רק שחזור-מהזיכרון לא-מאומת מהתקרית המקורית — גיבוי ל"מצב לא-ודאי", לא ל"מצב נכון ומקורי".
**הודעת commit מוצעת (אחרי בדיקת תוכן + תיקון ה-assertion המיושן):** `test(workspace): fix pinned-card counters QA + reconcile stale showClearFocus assertion`
**QA ידני (עברית):**
1. בקש מ-`frontend-rtl-developer` (או בצע ידנית) סקירת diff מלאה של הקובץ מול הכוונה המקורית (תיקון מונים) — ודא שאין קוד "מוזר"/לא-שלם משאריות התקרית.
2. הרץ את הסקריפט וודא שהוא עובר במלואו (16/16 assertions, לפי מה שמתועד ב-ledger) אחרי תיקון ה-assertion המיושן.
3. פתח בדפדפן את הכרטיס "סרטון אחרון שנשמר" (pinned card) בעמוד Workspace Library, הוסף פריט לאוסף וודא שהמונה מתעדכן נכון (X ייחודיים · Y שמירות).
4. הסר את הפריט וודא שהמונה חוזר לערך הקודם, ושאוסף ריק מציג 0/0 (לא שגיאה).

---

### קבוצה 7 — GEMS bundle (`TRADINGBRAIN-GEMPICKER-COMPACT-SCORING`, `VideoDetailPanel.jsx` שזור גם עם `TRADINGBRAIN-FRESHIMPORT-COST-GUARD`) — **המסוכנת ביותר**
**קבצים:** `gemRecommender.js` (149 שורות), `GemSelectionModal.jsx` (165), `GemRecommendationCard.jsx` (9), `gemContentRouter.js` (22), `brief-gem-selector-qa.mjs` (24), **`VideoDetailPanel.jsx`** (408 — **שזור, דורש `git add -p`**).
**מה זה עושה:** סשן פיצ'ר שלם — עיצוב קומפקטי ל-GEM picker, מוסכמת מצב-ממתין ("unclassified"), תגי ביטחון (confidence badges). לפי הדוח שלו עצמו (`docs/plan/REPORT-TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.md`): **"UNTESTED BY THE USER. NOT COMMITTED."**
**תיקון (2026-09-07, אחרי בדיקה חוזרת של `backlog-tracker`):** הריצה הראשונה שביצעתי כאן (`node scripts/brief-gem-selector-qa.mjs` בלי דגל bootstrap) הניבה `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/lib'` ותועדה בטעות כאן כ"רגרסיה טרייה" — זו הייתה **שגיאת הרצה שלי, לא רגרסיה אמיתית**. הפקודה הנכונה, התואמת למוסכמת `package.json`/לקח `lessons.md` 2026-08-25 ("Use each standalone test's exact declared command"), היא `node --import ./scripts/register-src-aliases.mjs scripts/brief-gem-selector-qa.mjs` — עם הדגל הזה **הסקריפט עובר בהצלחה** ("brief GEM selector QA: mapping, selection, clipboard and safe-open assertions passed"), אומת עכשיו פעמיים (על ידי `backlog-tracker` ואז שוב ישירות על ידי). `npm run build` המלא עובר נקי (exit 0) בכל מקרה. המשמעות: קבוצה זו **איבדה אחד מסימני האזהרה שיוחסו לה** — אין רגרסיית QA טרייה ב-`brief-gem-selector-qa.mjs`; שאר הממצאים בקבוצה זו (UNTESTED BY THE USER, קוד מת ב-`gemContentRouter.js`, false-positive במילות מפתח, ניגוד UX בין שתי מערכות ניקוד, `VideoDetailPanel.jsx` השזור) נשארים בעינם ולא הושפעו מהתיקון הזה.
**סוגיות פתוחות נוספות, מתועדות (needs-user-decision, לא תוקנו):**
- `gemContentRouter.js` — קוד מת מוצהר: אפס import sites בכל `src/`, הערת header שלו מיושנת.
- `gemRecommender.js` — false-positive שיטתי במילות מפתח כלליות ("תמיכה"/"התנגדות" וכו') שמסווגות שגוי כ-dayTrading; חוסר תמיכה בגרסאות איות עברי ("פנדמנטלי" ללא ו').
- ניגוד UX: שתי מערכות ניקוד לא-ניתנות-להשוואה (top row מול accordion TJS) מוצגות זו לצד זו.
- `VideoDetailPanel.jsx` שזור בין שני WORK-ID (ראה קבוצה 7 בטבלה למעלה) — לא פוצל.
**אומת בדפדפן אמיתי:** **לא, אפס.** אין QA דפדפן אנושי בכלל על כל הקבוצה הזו — מוצהר "UNTESTED BY THE USER" בדוח המקורי, ולא השתנה מאז.
**סיכון אם יאבד:** **הגבוה ביותר מבין כל 7 הקבוצות** — כמות קוד הכי גדולה (619 שורות שינוי משוקללות בכל 12 הקבצים, רובן כאן), עבודת אפיון/מיפוי מלאה. **אך מגובה בייט-לבייט** ב-`docs/qa/WIP-SNAPSHOT-2026-09-06.patch` (אומת `git apply --check --reverse` לכל 6 הקבצים בנפרד עכשיו — כולם תואמים) — כך שהסיכון בפועל הוא "יישום מחדש של הפאץ'", לא אובדן טוטלי, **בתנאי ש-`docs/qa/`/git history עצמם לא נמחקים**.
**הודעת commit מוצעת (רק אחרי staging נפרד ואישור משתמש):**
- Commit נפרד ל-`VideoDetailPanel.jsx` (אחרי `git add -p` לפיצול משני ה-WORK-ID): `feat(video-panel): wire compact GEM picker scoring into detail panel`
- Commit לשאר 5 הקבצים: `feat(gems): compact GEM picker layout + confidence badges + unclassified pending state`
- **לא לדחוף (push) לפני שהמשתמש עצמו מריץ QA דפדפן ועונה לשאלת המוצר הפתוחה** (האם להציג % ביטחון בשורה העליונה).
**QA ידני (עברית) — 10 צעדים, מבוסס על ה-checklist שכבר קיים ב-`docs/plan/REPORT-TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.md`, מומלץ להריץ במלואו לפני כל commit:**
1. פתח וידאו שכבר מסווג בבירור (למשל כותרת עם "ניתוח טכני") ובדוק שה-GEM picker העליון מציג את ה-GEM הנכון עם תג ביטחון סביר.
2. פתח וידאו עם כותרת מעורפלת/כללית ובדוק שהמצב "ממתין לסיווג" (unclassified) מוצג — לא סיווג שגוי בביטחון גבוה.
3. פתח וידאו עם כותרת "ניתוח טכני" מובהק ובדוק שהוא לא מסווג בטעות ל-dayTrading (הבאג הידוע במילות מפתח).
4. פתח את ה-accordion "אפשרויות נוספות" (TJS) ובדוק שהאחוזים שם עקביים לוגית מול השורה העליונה (או לפחות שההבדל לא נראה כמו באג בעיניים של משתמש חדש).
5. בדוק שלחיצה על GEM מומלץ בשורה העליונה פותחת/משייכת את ה-GEM הנכון בפאנל הניתוח.
6. בדוק שווידאו עם ניתוח טרי (fresh import) לא "מאבד" את הסיווג שלו תוך כדי מעבר בין וידאו לוידאו (קשור ל-`TRADINGBRAIN-FRESHIMPORT-COST-GUARD` השזור ב-`VideoDetailPanel.jsx`).
7. בדוק שאין regressions בתפריט/במודל בחירת ה-GEM הידני (`GemSelectionModal.jsx`) — פתיחה, סגירה, בחירה ידנית.
8. בדוק ב-console שאין שגיאות JS חדשות בעת מעבר בין 3-4 וידאו שונים ברצף.
9. ודא ויזואלית (RTL) שתגי הביטחון לא נחתכים/לא מתנגשים בפריסה בעברית.
10. ענה על השאלה הפתוחה: האם להציג אחוז ביטחון בשורה העליונה של המבזק (למשל "AI מומלץ 97%") — זו החלטת מוצר חדשה, לא באג.

---

## שלב d — סדר קבוצות וסיכום "מי יכול להיכנס בלי QA דפדפן"

| סדר (בטוח→מסוכן) | קבוצה | ניתן ל-commit בלי QA דפדפן? |
|---|---|---|
| 1 | `WorkspaceCollectionTiles.jsx` | **כן** — אין שינוי תוכן בכלל |
| 2 | `PLAN-TRADINGBRAIN-DAILY-DIRECTION-STATS.md` | **כן** — תיעוד בלבד |
| 3 | `.claude/settings.json` | **כן** — קונפיגורציית כלי, לא אפליקציה |
| 4 | `ExternalVideoModal.jsx` | **כן, בזהירות** — תיקון הגנתי-נטו, ללא סיכון רגרסיה; מומלץ QA לפי הצ'קליסט אך לא חוסם |
| 5 | `publish-date-header-coverage-qa.mjs` | **לא כמות שהוא** — צריך החלטת-תיקון קודם (ראה קבוצה 5), אחרת נכנס RED |
| 6 | `pinned-recent-video-card-qa.mjs` | **לא** — נכשל כרגע + עבר תקרית שחזור לא-מאומתת, דורש סקירת-תוכן של בעלים קודם |
| 7 | GEMS bundle + `VideoDetailPanel.jsx` | **בהחלט לא** — "UNTESTED BY THE USER" מוצהר, QA דפדפן מלא (10 צעדים למעלה) הוא תנאי-סף, וגם `VideoDetailPanel.jsx` דורש פיצול hunk לפני כל commit |

---

## שלב f — מסירה ל-backlog-tracker

כל 7 הקבוצות תואמות רשומות **קיימות ומאומתות-מחדש-היום** ב-`docs/open-items-ledger.md` (`YMD-SETTINGS-UNCOMMITTED`, `TRADINGBRAIN-ADDBYLINK-VIDEO-MISMATCH`, `TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS`, `TRADINGBRAIN-PINNED-CARD-QA-BROKEN-BY-CONCURRENT-EDIT`, `TRADINGBRAIN-GEMPICKER-COMPACT-SCORING`, `TRADINGBRAIN-VIDEODETAILPANEL-INTERLEAVED-STAGING`) — **פרט לשתיים שאינן מכוסות עדיין**: קבוצה 1 (`WorkspaceCollectionTiles.jsx`, false-positive, כבר יש הערת-תיקון אך לא שורת WORK-ID ייעודית) וקבוצה 2 (`docs/plan/PLAN-TRADINGBRAIN-DAILY-DIRECTION-STATS.md`, מסמך חדש שנוצר אחרי המיפוי האחרון). מבקש מ-`backlog-tracker`, בהפעלה נפרדת, להוסיף:
1. שורה חדשה עבור `docs/plan/PLAN-TRADINGBRAIN-DAILY-DIRECTION-STATS.md` (untracked, ללא גיבוי, ללא WORK-ID קיים).
2. עדכון/הערה על ה-3 ממצאים הטריים מהיום (2026-09-07) שאומתו בריצה חיה: (א) `publish-date-header-coverage-qa.mjs` עדיין נכשל באותה assertion הפוכה; (ב) `pinned-recent-video-card-qa.mjs` עדיין נכשל על `showClearFocus={false}`; (ג) `brief-gem-selector-qa.mjs` עדיין נכשל עם `ERR_MODULE_NOT_FOUND '@/lib'`; וכן `npm run build` נקי (exit 0).
3. ציון קיומו של `docs/plan/PLAN-TRADINGBRAIN-WIP-CLOSEOUT-GROUPS.md` (מסמך זה) כהפניה מרכזת ל-staging-plan של כל 12 הקבצים, במקום לפזר את אותו מידע מחדש בין שורות נפרדות.
4. ציון הממצא החדש שרוב 8 מתוך 10 הקבצים ה-`M` מגובים בייט-לבייט ב-`docs/qa/WIP-SNAPSHOT-2026-09-06.patch` (מוריד את דירוג ה"סיכון אם יאבד" שלהם).

**לא בוצעה כתיבה ישירה שלי ל-`docs/open-items-ledger.md`** — לאור ה-collision החי שנצפה בשלב a (Codex כתב לקובץ הזה ממש תוך כדי המשימה), עדיף למסור ל-`backlog-tracker` (בעל `Write`, בנוי לקרוא-מחדש-לפני-כתיבה) מאשר לערוך אני ישירות קובץ שמישהו אחר עשוי לגעת בו באותה שנייה.

---

## הנחות (assumption)

הנחתי שהכוונה ב"12 קבצים" ו-"VideoDetailPanel.jsx" תואמת בדיוק את מצב עץ העבודה כפי שנמדד בפועל עכשיו (10 `M` + 2 `??`, זהה למה שתואר במשימה) — לא נדרש שינוי הנחה, ההתאמה הייתה מלאה.
