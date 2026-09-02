# TRADINGBRAIN-WORKTREE-HYGIENE — מוכנות לבוקר

> קריאה-בלבד. שום commit/push/merge/stash/restore/reset/prune/מחיקת branch-worktree/
> עריכת קוד מקור/הפעלה-מחדש של שרת לא בוצעו. נכתב: 2026-09-01, ~19:10.
> HEAD בתחילה ובסוף: `a7536c0` (ללא שינוי).

---

## 1. מפקד סשנים — תמונת מצב שנעה תוך כדי הבדיקה עצמה

⚠️ **בזמן שביצעתי את המפקד, כל התהליכים בענן (4 סשני Claude, ה-Codex, ושרת ה-dev)
התחלפו PID תוך כ-2 דקות זו מזו** (מ-18:55 עד 18:57) — סימן ל-reload מלא של חלון
VS Code/extension host (לא פעולה נפרדת שלי, ולא בהכרח "מישהו הפעיל מחדש רק את השרת"
כפי שנוסח בבקשה — נראה כמו אירוע רחב יותר). דיווח למטה הוא הצילום **האחרון** שביצעתי,
~19:09.

| PID | תהליך | Session ID (`--resume`) | התחיל | פעיל/רגוע כרגע |
|---|---|---|---|---|
| 19644 | claude.exe | `e395ea4a-...` | 18:55:19 | **זה אני** (הסשן הנוכחי) |
| 4308 | claude.exe | `594934e8-...` | 18:56:12 | לא ידוע ישיר, ר' הערה |
| 28176 | claude.exe | `134f3de5-...` | 18:56:16 | לא ידוע ישיר, ר' הערה |
| 7856 | claude.exe | `f6423204-...` | 18:57:27 | לא ידוע ישיר, ר' הערה |
| 10404 | codex.exe | — | 18:55:07 | לא ידוע |
| 27292 | node (vite) | — | 18:56:43 | שרת dev, ר' סעיף 2 |

**איך קבעתי פעיל מול רגוע — לא ניחשתי, מדדתי:** בדקתי אילו קבצים בפועל השתנו בזמן אמת.
נכון ל-19:09, **`src/hooks/usePersistedVideo.js` השתנה תוך פחות מ-3 דקות** — ותוכן השינוי
הוא הוספת `console.log('[RTV-DEBUG] ...')` בשלושה מקומות בקובץ (דיבוג זמני, לא קוד סופי).
זהו **סימן ודאי לעריכה חיה ופעילה ממש עכשיו**, כנראה המשך חקירת TRADINGBRAIN-NIGHT-VERIFY-HARDEN
(סעיף 12 ב-QA checklist — "מנותח במלואו" — עדיין לא סגור). כל שאר הקבצים ה-dirty לא
השתנו מאז 17:51 לפחות (18 דקות רגיעה לפני שהתחלתי, ואז השקט נמשך) — סימן ל**הפוגה/idle**
בשאר החזיתות, לא בהכרח שהסשנים עצמם נסגרו.

**לא ניתן לקבוע ישירות איזה PID שייך לאיזה session name** (`e2`/`dc`/`11` מ-ListAgents) —
אין חשיפת מטא-דאטה ברמת התהליך למספר session/WORK-ID. שיוך המבוסס-הקשר (לא ודאי):
`dc` = TRADINGBRAIN-NIGHT-VERIFY-HARDEN (כתב את `MORNING-QUEUE-2026-09-02.md` ואת
`usePersistedVideo.js` ככל הנראה), `e2` = TRADINGBRAIN-GEMPICKER-COMPACT-SCORING (אושר
ע"י הודעת session אחר קודם בשיחה), `11` = לא זוהה כלל.

**פקודות כיבוי מדויקות לתהליכים "רגועים" (לא הרצתי אף אחת מהן):**
```powershell
# רק אחרי שתאשר איזה PID שייך לאיזה session — הרג session חי עלול להשמיד עבודה באמצע כתיבה
Stop-Process -Id 4308  -Confirm   # אם מאושר שאינו כותב כרגע
Stop-Process -Id 28176 -Confirm
Stop-Process -Id 7856  -Confirm
```
**המלצה: אל תכבה כלום עד שתזהה כל סשן דרך הכותרת/הטרמינל שלו בעצמך** — הרג PID לפי
ניחוש בלבד מסוכן יותר מהתועלת.

---

## 2. אמת שרת ה-Dev

**השרת הנוכחי (נכון ל-19:09): PID 27292**, `node ...\youtube-mentor-dashboard\node_modules\.bin\...\vite\bin\vite.js` — **worktree, branch ו-HEAD תואמים בדיוק** לריפו הזה (`feat/saved-market-rows-table` @ `a7536c0`). `curl http://localhost:5184/src/pages/Dashboard.jsx` → 200, כלומר Vite מגיש בזמן אמת את הקובץ ה-dirty (לא build ישן).

**ההיסטוריה המלאה שנצפתה בשיחה זו:** PID 10380 (בבדיקה מוקדמת יותר היום) → PID 3716
(כ-16:51) → **PID 27292 (כ-18:56, הנוכחי)**. כל שלושת הפעמים משרתים אותו worktree
בדיוק. **לא אני הפעלתי מחדש אף אחת מהן.** הריצה השלישית תואמת בדיוק את חלון ה-reload
הכללי שתואר בסעיף 1 — כלומר לא "מישהו הפעיל מחדש רק את השרת", אלא כל הסביבה עלתה
מחדש יחד (VS Code/extension host reload).

**מסקנה קריטית ל-QA של הבוקר:** השרת הרץ **כן** משרת את עץ העבודה הנוכחי במדויק —
אין פער בין מה שהמשתמש יראה בדפדפן למה ש-`git status`/הקוד בפועל מראים. QA ידני
מחר על `localhost:5184` תקף מבחינת זהות שרת. (זה לא אומר שה-QA-content עצמו כבר
עבר — ר' סעיף 5).

---

## 3. קבצי Scratch (`*.txt`)

**עדכון קריטי: 4 הקבצים כבר לא קיימים.** `before-click.txt`, `dash-full.txt`,
`dash-search-result.txt`, `dash-search.txt` היו נוכחים מוקדם יותר בשיחה הזו (זוהו
כסטייה לא-מיוחסת בדוח TRADINGBRAIN-UNATTENDED-SAFETY-SWEEP), אך **נעלמו** מהדיסק
ומ-`git status` בזמן שחלף. **לא אני מחקתי אותם.** ככל הנראה session אחר (סביר
`dc`, שממשיך לעבוד על אותו אזור קוד) ניקה אותם בעצמו כחלק מסדר-בית שגרתי, או שהיו
פלט זמני של Playwright/סקריפט debug שנוקה אוטומטית. אין מה לשחזר — השאלה "האם בטוח
למחוק" התייתרה מעצמה.

---

## 4. מלאי מלא — כל קובץ dirty, שורה אחת לכל אחד

| קובץ | WORK-ID | שינוי אמיתי (`--ignore-all-space`) | מצב |
|---|---|---|---|
| `.claude/settings.json` | לא-מיוחס | +4/-1 | מוכן (טריוויאלי, לא קשור לאף עבודה) |
| `docs/open-items-ledger.md` | תחזוקת backlog-tracker | +26/-10 | מוכן |
| `scripts/brief-gem-selector-qa.mjs` | GEMPICKER | +19/-5 | ממתין ל-QA ידני (לא mid-edit כרגע) |
| `src/ai/gemini/gemContentRouter.js` | GEMPICKER | +15/-7 | ממתין ל-QA ידני |
| `src/components/dashboard/GemRecommendationCard.jsx` | GEMPICKER | +7/-2 | ממתין ל-QA ידני |
| `src/components/dashboard/GemSelectionModal.jsx` | GEMPICKER | +69/-48 | ממתין ל-QA ידני |
| `src/components/dashboard/VideoDetailPanel.jsx` | GEMPICKER בלבד (שורות SAVEDROWS כבר committed ב-`a7536c0`) | +29/-6 | ממתין ל-QA ידני |
| `src/components/workspace/WorkspaceFocusedVideoCard.jsx` | RETURNTOVIDEO (pinned-card) | +3/-3 | מוכן, נבדק אוטומטית |
| `src/hooks/usePersistedVideo.js` | RETURNTOVIDEO/NIGHT-VERIFY-HARDEN | +24/-5 | **🔴 mid-edit חי כרגע — מכיל `console.log('[RTV-DEBUG]...')` זמני, חובה להסיר לפני כל commit** |
| `src/lib/gemRecommender.js` | GEMPICKER | +105/-25 | ממתין ל-QA ידני |
| `src/pages/Dashboard.jsx` | RETURNTOVIDEO | +21/-0 | מוכן, נבדק אוטומטית, **תלוי ב-QA פריט 12** |
| `src/pages/WorkspaceLibrary.jsx` | RETURNTOVIDEO (pinned-card) | +47/-0 | מוכן, נבדק אוטומטית |
| `docs/plan/MORNING-QUEUE-2026-09-02.md` (חדש) | RETURNTOVIDEO/NIGHT-VERIFY-HARDEN | 122 שורות | מוכן — דוח מקביל לזה |
| `docs/plan/REPORT-TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.md` (חדש) | GEMPICKER | 273 שורות | מוכן |
| `docs/plan/REPORT-UNATTENDED-SAFETY-SWEEP.md` (חדש) | הביקורת הקודמת שלי | 247 שורות | מוכן |
| `docs/qa/TRADINGBRAIN-WORKSPACE-RETURNTOVIDEO-QA.md` (חדש) | RETURNTOVIDEO | — | מוכן |
| `scripts/pinned-recent-video-card-qa.mjs` (חדש) | RETURNTOVIDEO | 44 שורות | מוכן, 8/8 |
| `scripts/publish-date-header-coverage-qa.mjs` (חדש) | RETURNTOVIDEO/a7536c0-gap | 53 שורות | מוכן, 12/12 |
| `scripts/return-to-analysis-deeplink-qa.mjs` (חדש) | RETURNTOVIDEO | 76 שורות | מוכן, 6/6 |

**קבצים שנוגעים ע"י יותר מ-session אחד:** לא אותר קובץ שנפגע פיזית משני owners
בו-זמנית ברגע הבדיקה (בניגוד לסבב קודם, שבו `VideoDetailPanel.jsx` היה מעורבב —
כעת מפוצל נקי: רק hunks של GEMPICKER נשארו שם, שורות `videoPublishedAt` כבר
committed). **אך** `WorkspaceFocusedVideoCard.jsx`, `Dashboard.jsx`, ו-`WorkspaceLibrary.jsx`
הם כולם חלק מאותו מקבץ RETURNTOVIDEO אחד (לא קונפליקט, אלא תלות הדדית מכוונת —
צריכים להיות ב-commit אחד יחד).

---

## 5. תוכנית Commit לבוקר

### מקבץ 1 — RETURNTOVIDEO (מוכן ברגע שתאשר, **חסום רק ע"י פריט debug אחד**)
**קבצים:** `src/pages/Dashboard.jsx`, `src/pages/WorkspaceLibrary.jsx`,
`src/components/workspace/WorkspaceFocusedVideoCard.jsx`,
`src/hooks/usePersistedVideo.js` (**רק אחרי הסרת שורות ה-`console.log('[RTV-DEBUG]...')`**),
`scripts/return-to-analysis-deeplink-qa.mjs`, `scripts/pinned-recent-video-card-qa.mjs`,
`docs/qa/TRADINGBRAIN-WORKSPACE-RETURNTOVIDEO-QA.md`.
**הודעה מוצעת:** ראה `docs/qa/TRADINGBRAIN-WORKSPACE-RETURNTOVIDEO-QA.md` (כבר כתובה שם, מוכנה להעתקה).
**QA חובה לפני commit:** סעיפים 1-13 בצ'קליסט הנ"ל, **בדגש על 11-13** (על וידאו אמיתי-מנותח בדפדפן חי — לא בוצע אוטומטית, לא ניתן לביצוע ע"י session).
**חסום כרגע ע"י:** `usePersistedVideo.js` עדיין באמצע עריכה חיה (debug logging) — **אל תעשה commit לפני שהסשן הפעיל שם מסיים ומנקה**.

### מקבץ 2 — GEMPICKER (מוכן ברגע ש-Decision-14 יוחלט + QA ידני יבוצע)
**קבצים:** `src/lib/gemRecommender.js`, `src/components/dashboard/GemSelectionModal.jsx`,
`src/ai/gemini/gemContentRouter.js`, `src/components/dashboard/GemRecommendationCard.jsx`,
`scripts/brief-gem-selector-qa.mjs`, + hunks ספציפיים ב-`VideoDetailPanel.jsx` (**לא כל
הקובץ** — ודא `git diff -- VideoDetailPanel.jsx` מכיל רק שינויי GEMPICKER לפני staging).
**הודעה מוצעת:** אין עדיין נוסח מוכן בדוח — להרכיב לפי `docs/plan/REPORT-TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.md`.
**QA חובה:** 10 הסעיפים ב-`REPORT-TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.md`, בדגש סעיף 4 (אחוז ביטחון על מבזקים — שאלה פתוחה).
**חסום ע"י:** החלטתך על `feat/gems-phase0-1` (Decision-14) — לא טכני, רק אישור.

### מקבץ 3 — a7536c0 scope gaps (שאלת היקף, לא באג — לא דחוף)
**אין קבצים ל-commit** — זו החלטת scope: להרחיב את מנגנון "פורסם" גם ל-Snapshot
ול-`WorkspaceVideoGroupCard.jsx` (התצוגה **האמיתית** של ברירת המחדל, שונה מ-
`WorkspaceGlobalSavedAnalysisGroup` שכבר תוקן — ראה תיקון-עצמי בסעיף 6) — או להשאיר כפי שהוא.
**חסום ע"י:** ההחלטה שלך בלבד.

### מקבץ 4 — ledger + docs עצמאיים
**קבצים:** `docs/open-items-ledger.md`, `.claude/settings.json`, שלושת דוחות ה-`docs/plan/*.md`.
**מוכן מיידית**, אפס תלות, אפס QA נדרש (מסמכים/תחזוקה בלבד).

**סדר מומלץ:** 4 → 1 (אחרי ניקוי debug + QA 11-13) → 2 (אחרי Decision-14) → 3 (בזמנך החופשי).

---

## 6. תיקון עצמי חשוב לדוחות קודמים בשיחה זו

בסבב ביקורת קודם (TRADINGBRAIN-WORKTREE-HYGIENE / CONSOLIDATION-AUDIT) דיווחתי ש-B2
("פורסם" בתצוגת ברירת המחדל) **מאושר** על סמך `WorkspaceGlobalSavedAnalysisGroup`.
**זה היה חלקי ומטעה**: `WorkspaceLibrary.jsx:1415` מפעיל את `WorkspaceGlobalSavedAnalysisGroup`
**רק כש-`activeCollection` אמיתי** (המשתמש בחר קטגוריה ספציפית). **התצוגה שנטענת
בפועל בברירת המחדל האמיתית (`activeCollection` ריק) היא `WorkspaceVideoGroupCard.jsx`** —
קומפוננטה שונה לגמרי, שמעולם לא קיבלה את מנגנון `videoLookup`/`buildSectionMetadataLine`
של `a7536c0`. יש לה שדה "פורסם" ישן ונפרד ברמת כרטיס-וידאו (`group.originalVideoDate`,
תאריך בלבד, ללא שעה, ללא lookup fallback לפריטים ישנים). **אומת ישירות בקוד עכשיו**
(`grep` על `WorkspaceVideoGroupCard.jsx` — אין `videoLookup` בקובץ כלל). session `dc`
הגיע לאותה מסקנה באופן עצמאי (`docs/plan/MORNING-QUEUE-2026-09-02.md`, סעיף 3). זו
בדיוק ה"מקבץ 3" למעלה — לא תוקן, לא הוחלט, ממתין לך.

---

## אישור סיום

- HEAD בתחילת המשימה: `a7536c0c7d6881056bc54bb3dbce62c000090539`
- HEAD בסוף המשימה: `a7536c0c7d6881056bc54bb3dbce62c000090539` — **ללא שינוי**
- לא בוצע commit, push, merge, rebase, stash, restore, reset, מחיקת branch/worktree, שינוי תלויות, עריכת קוד מקור, או הפעלה/כיבוי של תהליך כלשהו.
- שינויים שנצפו **מעבר לשליטתי** תוך כדי המשימה: PID-rotation מלא של 4 סשני Claude + Codex + שרת ה-dev (~18:55-18:57, לא ביוזמתי); הופעת `src/hooks/usePersistedVideo.js` כ-dirty עם debug logging חי; היעלמות 4 קבצי `*.txt` שהיו קיימים קודם בשיחה.
