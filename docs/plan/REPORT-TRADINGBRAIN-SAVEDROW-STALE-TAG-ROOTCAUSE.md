# REPORT — TRADINGBRAIN-SAVEDROW-STALE-TAG-ROOTCAUSE

**Branch:** `feat/saved-market-rows-table` — HEAD `de5d3e79e738467dae4396985333317fdb971c6b`, לא זז לאורך הסבב. `git status --porcelain` זהה בדיוק בתחילת הסבב ובסופו (16 קבצי `M`, 5 קבצי `??` — כולם מסשנים אחרים, לא נגעתי בהם). אומת עצמאית על ידי הסשן ההורה לאחר סיום הסבב: HEAD ו-`git status` אכן זהים לפני/אחרי.

## תקציר מנהלים

**לא נמצאה הוכחה חיה, מגובה בנתוני storage אמיתיים, לבאג בקוד הנוכחי.** כל מנגנון שהצלחתי לבדוק בפועל מול ה-bundle המוגש בפועל יצא תקין. לא הצלחתי להשלים round-trip מלא של storage אמיתי (שמירה→מחיקה דרך UI אמיתי→קריאה חוזרת) בגלל **חסימה סביבתית אמיתית ומתועדת**: אף אחד משלושת פרופילי האוטומציה הזמינים לי מעולם לא עבר activation חד-פעמי ומאושר (governance-gated) שהופך IndexedDB ל"פעיל", ותהליך זה קיים אך ורק בתוך `src/dev/ytmdbOriginMigrationController.js` המוגן — קובץ שאסור לי להריץ. גישה לפרופיל Chrome האישי של המשתמש כבר נדחתה מפורשות בסבבים קודמים ולא ניסיתי לעקוף זאת. בהתאם להנחיה המפורשת — **Phase 2 לא הופעל, לא נערך שום קובץ קוד**.

## Phase 0 — סביבה

- HEAD `de5d3e79e738467dae4396985333317fdb971c6b`, `git status --porcelain` זהה בתחילת ובסוף הסבב.
- PID 10360 (`[::1]:5184`) ו-PID 14112 (`127.0.0.1:5184`) — שניהם עדיין רצים, לא הופעלו/הופסקו מחדש. `curl` על שני ה-URL-ים → `200`.
- אימות bundle: `curl` על `workspaceSavedRowLookup.js`/`useSavedRowIndex.js` המוגשים החזיר סימני-זיהוי מדויקים מ-round 10 (`currentVideoResolved`, `idCandidate`/`urlCandidate`) — **אין פער בין הקוד המוגש לעץ העבודה** בסשן החי הזה.
- `@playwright/test` הוא devDependency אמיתי וקיים כבר בפרויקט; לא הותקן דבר חדש.

## Phase 1 — מה בוצע בפועל בדפדפן חי

### ניסיון לקבל נתונים אמיתיים
לא ניסיתי גישה לפרופיל Chrome האישי של המשתמש (PID 17664, עדיין פועל) — כבר נדחתה מפורשות פעמיים בסבב 7. איתרתי 3 פרופילי אוטומציה תחת `ms-playwright-mcp\`: `mcp-chrome-7e26c77` (2/9), `mcp-chrome-b48b249` (26/8), `mcp-chrome-2961beb` (30/7) — אימתתי שאף chrome.exe חי לא מצביע לאף אחד מהם כרגע. יצרתי **עותקים בלבד** תחת `C:\tmp\ymd-savedrow-stale-tag-phase1*\`.

### ניסיון אמיתי לכתוב 11 שורות "מדדים" דרך פונקציית הייצור עצמה
כתבתי סקריפט Playwright (`phase1-repro.cjs`) שמייבא **דינמית את קוד הייצור החי** (`workspacePersistence.js`, `workspaceSavedRowLookup.js`, `workspaceHeadingRegistry.js`) בתוך דף אמיתי, בנה 11 רשומות בצורה זהה בדיוק ל-`WorkspaceSaveReviewOverlay.jsx` (אותם שדות, `createWorkspaceProvenance()` אמיתי, `itemType/originalItemType: 'indices'`), וקרא ל-`persistence.saveItemsBulk()` האמיתית.

**תוצאה אמיתית שנתפסה:**
```json
{"mode":"indexedDB","beforeTotal":5,"saveResult":{"ok":false,"errorDump":{"code":"indexeddb-activation-required","operation":"save-items-bulk"}}}
```
השמירה נכשלה במפורש — בדיוק לפי חוזה write→verify→report (אין הצלחה מזויפת).

### אבחון מדויק (לא השערה)
קריאה ישירה של מטא-הנתונים האמיתיים (`repo.readMeta`):
```json
{"itemsCount":5,"itemIds":["ws-snapshot-test-1","old-plain-1","ws-snapshot-1788293422513-qarepro","ws-caseB-postfix","ws-caseD-deleted"],
 "activeWorkspaceGeneration":null,"activeGeneration":null,"recoveryAnchor":null,
 "deleteAttempt":{"probeId":"ws-snapshot-test-1","ok":false,"errorCode":"indexeddb-activation-required"}}
```

ממצאים קריטיים:
1. **גם `deleteItems()` נכשל** באותה שגיאה על פריט קיים אמיתי — לא רק כתיבה חדשה חסומה, **כל כתיבה** (כולל מחיקה) חסומה בפרופיל הזה.
2. `activeWorkspaceGeneration`/`activeGeneration`/`recoveryAnchor` — **כולם `null`**. אין generation פעיל כלל. זו הסיבה הישירה (`workspacePersistence.js:239-246`): אם `current.source !== 'indexedDB'`, הכתיבה חוזרת ישר עם `activationRequiredFailure`, בלי fallback ל-localStorage (בכוונה).
3. שמות ה-IDs (`ws-caseB-postfix`, `ws-caseD-deleted`, `...-qarepro`) הם תוויות מקרה-בדיקה מסבב אבחון קודם — לא נתוני משתמש אורגניים. כלומר **5 הפריטים ש-round 7 דיווח עליהם כ"5 real IndexedDB items" מעולם לא היו IndexedDB אמיתי** — ישבו ב-fallback ל-localStorage כל הזמן, ורק *נראו* "אמיתיים" כי `persistence.mode` (הגדרת התצורה) אמר `'indexedDB'`, בעוד מקור הקריאה בפועל (`source`) היה `'localStorage'`. **זה תיקון ממשי, מגובה-ראיות, לטענת round 7** — לא סתם חזרה על הנימוק שלו.

בדקתי גם את שני הפרופילים הרדומים האחרים — **אותה תוצאה בדיוק**: 0 פריטים, כל 3 מטא-המפתחות `null`. כלומר **שלושת פרופילי האוטומציה הזמינים לי, ללא יוצא מן הכלל, מעולם לא עברו activation**.

חיפוש קוד (`grep -rn "migrateLocalStorageToIndexedDb|activateReadyGeneration"`) מאשר: **המקום היחיד בכל הריפו שקורא לפונקציות האלה הוא `src/dev/ytmdbOriginMigrationController.js`** — activation קשור אך ורק לכלי ה-DEV המוגן. אסור לי להריץ אותו — לא ניסיתי.

`.env.development.local` קובע `VITE_YTMDB_STORAGE_MODE=indexedDB` (ספציפי-מכונה, לא ב-git) — כלומר זה חל על **כל** דפדפן שפונה ל-dev server הזה, כולל בהכרח הדפדפן האמיתי של המשתמש. מאחר שהמשתמש בפועל מצליח לשמור/למחוק (כל 10 הסבבים הקודמים), הפרופיל **האמיתי** שלו כבר עבר activation אי-שם — אירוע שקרה מחוץ לכל פרופיל שבהישג ידי.

**מסקנה:** לא ניתן היה להשלים round-trip אמיתי מלא בשום פרופיל זמין — לא בעיית קוד, מגבלת סביבת-בדיקה מתועדת.

### הבדיקה המקסימלית שכן בוצעה: האלגוריתם עצמו, חי, מול ה-bundle המוגש
במקום round-trip דרך storage, בדקתי את `buildSavedRowIndex`/`isRowAlreadySaved`/`resolveVideoScope` **חי בתוך הדפדפן, נגד ה-bundle המוגש בפועל**, עם מערכי `items` "לפני/אחרי" שמדמים בדיוק מה ש-`readItems()` היה מחזיר אחרי מחיקה אמיתית מוצלחת:

```json
{"currentVideoScopes":["video:ymd-repro-video-stale-tag-1","video:ymdReproStaleTag1"],
 "taggedAllPresent":[true×11],
 "taggedAllDeleted":[false×11],
 "taggedOnlyLegacyLeft":[false×11]}
```

1. 11 פריטים עם scope שנפתר → כולם מסומנים — נכון.
2. אותם 11 נמחקו לגמרי מהמערך (מדמה מחיקה אמיתית מוצלחת) → **אף אחד לא מסומן** — נכון. **הוכחה חיה שהאלגוריתם מנקה תג נכון ברגע שהרשומה נעלמת מ-`items`.**
3. מקרה הבאג המקורי המדויק — נשארים רק duplicates לא-מקושרים (unscoped legacy) בזמן שהווידאו הנוכחי נפתר → **אף אחד לא מסומן**. הוכחה חיה שתיקון **round 10** (`currentVideoResolved`) פעיל ועובד ב-bundle המוגש.

בנוסף קראתי (read-only) את `VideoDetailPanel.jsx:6067-6133`: `savedRowIndex` נמצא בתקינות במערך התלויות של ה-`useMemo` שבונה `bulkSelectionShare` — אין memoization תקוע. וקראתי את `App.jsx`: `Dashboard`↔`WorkspaceLibrary` הם `PageComponent` שונים לגמרי — "לחזור למסך הניתוח" הוא תמיד mount מחדש אמיתי, לא state ישן.

## תשובה לחמשת ההשערות (a)-(e)

לא ניתן היה להוכיח (a)-(d) כנכונים, ולא נמצאה עדות אמיתית לבאג קוד. **(e) משהו אחר, ספציפית**: ההסבר הכי-נתמך-בראיות שנותר הוא **bundle ישן בטאב שכבר פתוח אצל המשתמש** (Lesson 2026-08-27) — משום שהראיה החיה שלי (bundle טרי בכל טעינה חדשה) לא יכולה לבדוק טאב ישן קיים. זו לא הוכחה, אלא ההסבר הכי-סביר שנותר אחרי שכל מנגנון אחר נבדק ויצא נקי.

## למה כל אחת מהשערות הסבבים הקודמים שגויה/לא-רלוונטית כאן
- **סבב 4** (התנגשות unscoped) — נכון לתקופתו, **תוקן ב-round 10**, ואומת שוב חי הפעם (case 3) שהתיקון עדיין עובד.
- **סבב 6** (אבחון סטטי בלבד) — השערת "bundle לא רענן" לא אומתה אז בגלל נעילת דפדפן; הפעם קיבלתי דפדפן חי ואישרתי ש-bundle טרי בכל טעינה חדשה — אך זה לא בודק טאב ספציפי שכבר פתוח.
- **סבב 8** (read/write store-mismatch) — הוכח נכון בזמנו (אותו store); אושר מחדש כאן ברמה עמוקה יותר, אך התגלה שגם ה"store" עצמו לא היה IndexedDB אמיתי בפרופיל שנבדק.
- **סבב 9** (מערך ריק == null) — נשאר תקף, לא נסתר.
- **סבב 10** (כלל fallback חדש) — אומת מחדש **חי** (לא רק ביחידת-בדיקה סטטית) ונמצא פועל כמתוכנן.

המשמעות: אף סבב קודם לא ניסה בפועל כתיבה/מחיקה אמיתית דרך דפדפן חי — זהו הניסיון הראשון, והוא זה שחשף את חסימת ה-activation.

## Phase 2 — לא בוצע
לא נמצא root cause מוכח ברמת storage אמיתית → Phase 2 לא הופעל. לא נערך שום קובץ קוד.

## קבצים שנגעתי בהם
- **נכתב בפועל בריפו:** אף קובץ, מלבד דוח זה (שנכתב על ידי הסשן ההורה לאחר שכלי הכתיבה של הסוכן המשני עצמו נחסם מיצירת קובצי דוח — התוכן זהה למה שהסוכן החזיר).
- **נקרא בלבד:** `src/utils/workspaceSavedRowLookup.js`, `src/hooks/useSavedRowIndex.js`, `src/components/dashboard/VideoDetailPanel.jsx` (grep ממוקד בלבד), `src/App.jsx`, `src/pages/WorkspaceLibrary.jsx`, `src/components/workspace/WorkspaceFocusedVideoCard.jsx`, `src/components/workspace/WorkspaceSaveReviewOverlay.jsx`, `src/components/workspace/ConfirmDialog.jsx`, `src/components/workspace/WorkspaceBulkActionBar.jsx`, `src/utils/workspaceSavedAnalysis.js`, `src/utils/workspaceSavedRowsDetection.js`, `src/config/workspaceHeadingRegistry.js`, `src/lib/persistence/workspacePersistence.js`, `src/lib/workspaceLibraryStore.js`, `src/utils/workspaceBriefRouting.js`, `src/lib/workspaceSelectionDraft.js`.
- **תוצרים מחוץ לריפו:** סקריפטי Playwright ב-scratchpad; `C:\tmp\ymd-savedrow-stale-tag-phase1\profile\` נותר (עותק, ללא שינוי מפריטיו המקוריים); עותקים רדומים אחרים נמחקו.

## אימות שבוצע
- `git status --porcelain` זהה בתחילת/סוף הסבב — אומת גם עצמאית על ידי הסשן ההורה.
- `curl` — שני ה-origin-ים `200`, bundle תואם עץ עבודה.
- 4 סקריפטי Playwright חיים רצו בהצלחה מול dev server אמיתי.
- `node --import ./scripts/register-src-aliases.mjs scripts/saved-row-video-scoping-qa.mjs` → **21/21** (אומת שוב עצמאית על ידי הסשן ההורה — 21/21).
- `node --import ./scripts/register-src-aliases.mjs scripts/saved-row-empty-scope-qa.mjs` → **10/10** (אומת שוב עצמאית על ידי הסשן ההורה — 10/10).
- `npm run build`/`lint` — לא הורצו (אין שינוי קוד).
- אומת שה-5 פריטים המקוריים בפרופיל הבדיקה נשארו זהים לפני/אחרי (אין מוטציה שקרתה בטעות).

## שינויים שדרשו אישור — לא בוצעו
לא נגעתי ב-`ytmdbOriginMigrationController.js`/`ytmdbOriginStorageManifest.js`, לא הרצתי activation, לא נגעתי בפרופיל האישי של המשתמש, לא בוצע commit, לא עודכן `docs/open-items-ledger.md` (עודכן בנפרד על ידי `backlog-tracker`, ראה שם).

## סיכונים ומגבלות שנותרו
1. לא בוצע round-trip אמיתי מלא ב-IndexedDB פעיל אמיתי — שלוש דרכים לסגור, כל אחת דורשת אישור/גישה שאין לסבב זה (activation מבוקר / פרופיל אמיתי / בדיקת המשתמש עצמו עם hard-refresh).
2. אם המשתמש כן ביצע hard refresh לפני הבדיקה האחרונה שדיווח עליה וזה עדיין נכשל — זה יסתור את המסקנה כאן ויצביע על באג אמיתי שטרם זוהה.
3. Drift קיים בלתי-קשור (16 קבצי `M`+5 `??` מסשנים אחרים) — לא נגעו בהם.

## צעד מומלץ הבא
1. למשתמש: hard refresh (Ctrl+Shift+R) בשני הטאבים הרלוונטיים לפני כל בדיקה נוספת.
2. להריץ קונסול-סניפט שבודק `activeWorkspaceGeneration`/`activeGeneration` בפרופיל האמיתי — אם יוצא `null` אצל המשתמש עצמו, זו תגלית חדשה שדורשת סבב נפרד.
3. רק לאחר מכן, אם הסימפטום נמשך בטאב טרי — לפתוח סבב המשך עם גישה מאושרת.

## Checklist ידני ל-QA (עברית)
1. רעננו לגמרי (Ctrl+Shift+R) את טאב מסך הניתוח וגם את טאב Workspace Library.
2. פתחו סרטון/מבזק עם שורות "מדדים" שמורות ומתויגות.
3. עברו ל-Workspace Library, מחקו את כל קטע השווקים.
4. ודאו שהופיעה הודעת הצלחה (לא שגיאה).
5. חיזרו למסך הניתוח (ניווט רגיל) — ודאו שהתג נעלם.
6. אם עדיין מופיע — F5 מלא, בדקו שוב.
7. אם נשאר גם אחרי F5 — שלחו את פלט הסניפט (סעיף "צעד מומלץ הבא" #2).
8. בדקו DevTools Console בזמן המחיקה למקרה של שגיאה מוסתרת.

## lessons.md status line
lessons.md — נקרא: כן; לקחים רלוונטיים שהוחלו: "2026-08-27 — Reverify the served bundle" (אומת ה-bundle לפני שהמשכתי), "2026-08-27 — Verify the exact persistence backend" (זה שחשף את ה-fallback ל-localStorage בפרופילי הבדיקה), "2026-09-01 — Report a missing browser tool instead of fabricating live browser QA" (לא זויף מעבר למה שהוכח), "2026-08-30 — Never rm -rf without checking untracked" (כל המחיקות בוצעו רק תחת C:\tmp). לקח חדש שנוסף: אין — הממצא ספציפי מדי לפרויקט זה כדי להיות lesson גנרי.
