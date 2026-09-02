# TRADINGBRAIN-UNATTENDED-SAFETY-SWEEP — דוח ריצה ללא השגחה

> נכתב ללא נוכחות המשתמש. שום commit, push, merge, rebase, stash, restore, reset,
> מחיקת branch/worktree, שינוי תלויות, הפעלה מחדש של שרת, או עריכת קוד אפליקציה
> לא בוצעו. השינויים היחידים שנכתבו: `docs/open-items-ledger.md` (דרך
> backlog-tracker) וקובץ זה.
>
> נכתב: 2026-09-01 · WORK-ID: `TRADINGBRAIN-UNATTENDED-SAFETY-SWEEP`

---

## Step 0 — Baseline

- Repo: `c:\Users\11\Desktop\Workspace\new-project\projects\youtube-mentor-dashboard`
- Worktree: הראשי (זהה לנתיב למעלה)
- Branch: `feat/saved-market-rows-table`
- HEAD בתחילת המשימה: `a7536c0c7d6881056bc54bb3dbce62c000090539`
- Dev server: מאזין על `[::1]:5184`, **PID 3716** (שונה מ-PID 10380 שנצפה קודם באותה שיחה — מישהו/משהו הפעיל מחדש את vite; לא אני. Command line מאמת אותו worktree בדיוק: `...\youtube-mentor-dashboard\node_modules\.bin\...\vite\bin\vite.js`, `StartTime` 9/1/2026 16:51).
- **Baseline `git status --porcelain`** (בתחילת המשימה):
  ```
  M .claude/settings.json
  M docs/open-items-ledger.md
  M scripts/brief-gem-selector-qa.mjs
  M src/ai/gemini/gemContentRouter.js
  M src/components/dashboard/GemRecommendationCard.jsx
  M src/components/dashboard/GemSelectionModal.jsx
  M src/components/dashboard/VideoDetailPanel.jsx
  M src/components/workspace/WorkspaceFocusedVideoCard.jsx
  M src/lib/gemRecommender.js
  M src/pages/WorkspaceLibrary.jsx
  ?? docs/plan/REPORT-TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.md
  ```
  **בדיקה חוזרת בסוף המשימה — HEAD ללא שינוי (`a7536c0`), אך נמצאה סטייה נוספת:** מלבד `docs/open-items-ledger.md` (עודכן ע"י backlog-tracker, מורשה) וקובץ זה (חדש, מורשה) — הופיעו 4 קבצי scratch לא-מיוחסים: `before-click.txt`, `dash-full.txt`, `dash-search-result.txt`, `dash-search.txt` (root של הריפו). אלה **לא נוצרו על ידי**, ותואמים בזמן להתחלת session לילי חדש (`youtube-mentor-dashboard-dc`, WORK-ID `TRADINGBRAIN-NIGHT-VERIFY-HARDEN`) שיצר קשר תוך כדי המשימה הזו והודיע שהוא מתחיל לעבוד על תיקון deep-link ב-`VideoDetailPanel.jsx`/`Dashboard.jsx` — סביר שאלה פלטי דיבוג/חיפוש שלו. לא נגעתי בהם.
- **תגלית באמצע המשימה, לא ביוזמתי:** `WorkspaceFocusedVideoCard.jsx` ו-`WorkspaceLibrary.jsx` נערכו שוב על-ידי session אחר תוך כדי העבודה — נוסף פיצ'ר "וידאו אחרון נעוץ" (pinned recent video) מעל תצוגת "כל הסרטונים". WORK-ID לא זוהה. לא נגעתי, לא ביטלתי — לפי ההנחיה שקיבלתי, זה תקין ומכובד כמצב נוכחי. נלקח בחשבון בבדיקות B2/B3 למטה (הפיצ'ר החדש כן משרשר `videoLookup` נכון, לא פוגע בממצאים).

---

## PART A — עבודה שקיימת רק על המכונה הזו

### A1. אימות הגיבוי ב-`C:\Users\11\Desktop\Workspace\ymd-wip-backup-2026-09-01\`

**קיים ותקין.** `index.md` (7,199 בייט) קריא במלואו — גיבוי מקיף שנעשה כבר היום ב-12:41-12:42 ע"י session אחר, מכסה 15 worktrees, ללא שינוי git state כלשהו (מתועד ומאומת בעצמו).

| Patch | גודל | תקינות מבנית (`git apply --stat`) | מתאים לעץ הנוכחי (`git apply --check`) |
|---|---|---|---|
| `main-worktree/diff-HEAD.patch` | 107,487 בייט | ✅ תקין, ניתן לפענוח | ❌ נכשל — **לא שחיתות**: נוצר מול `46fc6e0`, וה-HEAD כבר התקדם ל-`a7536c0` (חלק מהתוכן כבר committed), וגם קבצי GEMPICKER המשיכו להשתנות מאז 12:41. |
| `ymd-market-provider-table-integration/diff-cached.patch` | 41,383 בייט | ✅ תקין | ❌ נכשל — **"No such file or directory"** על 2 מתוך 7 קבצים: ה-worktree המקורי (תחת `%TEMP%`) התחיל להתפורר מאז שהגיבוי נלקח. **זהו הפריט בסיכון הגבוה ביותר — הגיבוי הוא כרגע כנראה העותק היחיד הנגיש של חלק מהתוכן.** |
| שאר ה-patches (asset-links-fallback, brief-permanence-phase3-4) | ~1KB כל אחד | ✅ תקין | לא נבדק (branches כבר pushed, תוכן טריוויאלי בלבד) |

**מסקנה:** הגיבוי עצמו שלם ואמין. אי-ההתאמה ל-`git apply --check` היא תוצאה **צפויה** של המשך העבודה מאז שהגיבוי נלקח, לא סימן לקובץ פגום. **מומלץ: לרענן את הגיבוי של `ymd-market-provider-table-integration` בהקדם**, לפני שה-worktree שם מתפורר עוד יותר.

### A2. 12 הקומיטים המקומיים על `main`, לפני `origin/main`

כולם מאת Erez Sustiel, 2026-07-11/12 — עבודה אמיתית וקוהרנטית, **אף אחד לא נראה כמו scratch/revert/תאונה**:

| SHA | תאריך | תיאור בעברית |
|---|---|---|
| `bd11421` | 07-11 12:57 | הוספת פילטרים מתקדמים למסך ה-Workspace |
| `46f1f72` | 07-11 13:13 | עיצוב מחדש של פריסת ה-Workspace + שורות טאב הניתנות להגדרה — **⚠️ נוגע גם ב-3 קבצי prompt של Gemini** (`generalPrompt.js`, `marketPrompt.js`, `politicalPrompt.js`) ו-`quickCopyPrompts.js` — לא ברור למה קומיט "עיצוב פריסה" נוגע ב-prompts; ראוי לבדיקה ידנית לפני push |
| `a3cd53d` | 07-11 20:44 | הצגת כפתורי פעולה על פריטי Workspace |
| `7fb02b0` | 07-12 06:29 | פישוט ניווט וסינון ב-Workspace |
| `c1febb8` | 07-12 08:24 | fixture רגרסיה למיפוי מאקרו ב-Specialized tab |
| `6b242e1` | 07-12 08:25 | תיקון: עצירת אובדן/קיצוץ פקטורי מאקרו ב-Specialized tab |
| `e2be09b` | 07-12 08:37 | תיעוד ביקורת מיפוי מאקרו |
| `53e5887` | 07-12 09:03 | הוספת אפשרות ניתוח טרי לשחזור וידאו שנמחק |
| `06968a7` | 07-12 10:04 | תיקון קריאה לפונקציה לא-מוגדרת (`multiSelectClear`) |
| `72e1130` | 07-12 10:17 | שחזור מיפוי חדשות וסקטורים ב-Specialized |
| `20b2faa` | 07-12 10:19 | הוספת בורר Perplexity Space עם ניתוב מניות |
| `9af9a6f` | 07-12 10:20 | תיעוד handoff סשן |

**לא נמצאו סודות/מפתחות.** דגל אחד: `46f1f72` נוגע בקבצי AI-prompt — לא בהכרח בעייתי, אך שווה עין לפני push.

### A3. Branches ללא upstream

| Branch | קדימה מ-main | Behind main | תאריך אחרון | כבר מאוחד במקום אחר? | המלצה |
|---|---|---|---|---|---|
| `feat/markets-and-stocks-table-redesign` | 45 | 0 | 08-30 | **כן — ancestor מלא של `feat/saved-market-rows-table`** | **לנטוש** (התוכן כבר בפנים) |
| `fix/market-brief-dependency-closure` | 29 | 0 | 08-25 | **כן — ancestor מלא של `feat/saved-market-rows-table`** | **לנטוש** (התוכן כבר בפנים) |
| `feature/market-asset-descriptions-hebrew` | 19 | 0 | 08-20 | לא (רק חלקית קרוב) | לבדוק/למזג ידנית |
| `feature/market-provider-foundation` | 20 | 0 | 08-21 | לא | לבדוק/למזג ידנית |
| `feature/market-provider-table-integration` | 20 | 0 | 08-21 | לא | לבדוק/למזג ידנית — **ה-worktree שלו מתפורר, ר' A1** |
| `fix/late-night-market-brief-integration` | 20 | 0 | 08-03 | לא נבדק | לבדוק |
| `fix/marketbrief-tabs-field-mapping` | 9 | 0 | 07-28 | לא נבדק | לבדוק |
| `fix/new-video-market-extraction-pipeline` | 9 | 0 | 08-07 | לא נבדק | לבדוק |
| `fix/ai-mapping-diagnostic-states` | 4 | 0 | 07-28 | לא נבדק | לבדוק |
| `fix/specialized-content-contextual-mapping` | 1 | 0 | 07-29 | לא נבדק | לבדוק (קומיט בודד, קטן) |
| `integration/recent-app-improvements` | 48 | 0 | 08-07 | לא נבדק | לבדוק — כולל Google Drive OAuth stage 1 |
| `audit/phase5-documentation-archive` | 8 | 0 | 07-26 | לא נבדק | לבדוק |
| `backup/pre-split-6b3846d` | 0 | 47 | 06-30 | — נבלע ע"י main | **בטוח לנטוש** (main כבר עקף אותו) |
| `worktree-agent-abf7c518da5e4a6d6` | 0 | 12 | 07-11 | — נבלע ע"י main | **בטוח לנטוש** |

לא בוצעה שום פעולה על אף branch.

### A4. `docs/markdown-governance-cleanup` (44 קדימה)

**מאושר במדויק:** הקומיט האחרון, `4c981ec` (30/08), הוא **"feat(workspace): add Workspace Day Obsidian export (Stage 3)"** — 5 קבצים, 800+ שורות (`workspaceDayObsidianExport.js` חדש בן 486 שורות, סקריפט QA בן 279 שורות, שינויים ב-`WorkspaceDay.jsx` וב-`obsidianExport.js`). **זהו פיצ'ר אמיתי, לא קשור לחלוטין ל"markdown governance"** כפי ששם ה-branch מרמז. **כן, ה-branch צריך להתפצל** לפני push — לפחות לשני חלקים: (א) עבודת ה-governance/markdown המקורית, (ב) פיצ'ר Obsidian export שהסתנן פנימה.

### A5. טבלת החלטות — לתשובת המשתמש (כן/לא)

| # | פריט | המלצה | כן/לא |
|---|---|---|---|
| 1 | לרענן גיבוי של `ymd-market-provider-table-integration` (worktree מתפורר) | כן, בהקדם | ☐ |
| 2 | לבדוק את `46f1f72` (נוגע ב-AI prompts) לפני push | כן | ☐ |
| 3 | לדחוף את 12 קומיטי `main` | ממתין לבדיקה ידנית | ☐ |
| 4 | לנטוש `feat/markets-and-stocks-table-redesign` (כבר בפנים) | כן | ☐ |
| 5 | לנטוש `fix/market-brief-dependency-closure` (כבר בפנים) | כן | ☐ |
| 6 | לנטוש `backup/pre-split-6b3846d` (נבלע ע"י main) | כן | ☐ |
| 7 | לנטוש `worktree-agent-abf7c518da5e4a6d6` (נבלע ע"י main) | כן | ☐ |
| 8 | לבדוק את 8 ה-branches הנותרים אחד-אחד (לא נבדקו לעומק) | כן | ☐ |
| 9 | לפצל את `docs/markdown-governance-cleanup` לפני push | כן | ☐ |

---

## PART B — אימות פיצ'ר תאריך/שעת פרסום (כבר shipped כ-`a7536c0`)

### B1. אזור זמן — **הלוגיקה הוכחה נכונה, אך לא כל מקרה אמיתי אומת**

- קלט UTC בקרה `2026-08-21T14:29:00Z` → פלט מדויק `17:29` תחת `Intl` שנפתר ל-`Asia/Jerusalem` (אומת גם ב-Node וגם בדפדפן Chromium אמיתי דרך Playwright).
- מבחן ניגוד: אילו הקוד היה מציג UTC כפי שהוא (התרחיש שחששת ממנו), קלט `17:29:00Z` היה מציג `20:29` — שונה לגמרי מהתוצאה הנצפית.
- **מסקנה:** ההמרה **אכן** מקומית (ישראל), לא UTC. **אך:** מעולם לא נקרא הערך הגולמי בפועל של הסרטון הספציפי מהצילום-מסך המקורי — אין גישה לנתוני הדפדפן/IndexedDB האמיתיים של המשתמש בסביבה האוטומטית (פרופיל מבודד, ריק). **הלוגיקה מוכחת; המקרה הקונקרטי — לא.**

### B2. תצוגת ברירת מחדל — **✅ מאושר בקוד**

`src/pages/WorkspaceLibrary.jsx:1418` מעביר `videoLookup={videoLookup}` ל-`<WorkspaceGlobalSavedAnalysisGroup>`, אשר משרשר אותו ל-`WorkspaceSavedAnalysisContent` ב-`WorkspaceFocusedVideoCard.jsx:368-383`. גם הפיצ'ר החדש שהתגלה (וידאו נעוץ) משרשר `videoLookup` נכון — אין רגרסיה.

### B3. כיסוי חוצה-סקציות — **✅ מאושר בקוד**

בדיוק 6 קריאות ל-`buildSectionMetadataLine(section.provenance, ...)` ב-`WorkspaceFocusedVideoCard.jsx` — אחת לכל סוג סקציה (טקסט/שווקים/מניות/סקטורים/הזדמנויות/חדשות).

### B4. מקרי קצה — **✅ עובר על פיקסטורות סינתטיות, ⚠️ לא על נתונים אמיתיים**

`scripts/saved-rows-publish-metadata-qa.mjs` (30 בדיקות, הורץ מחדש הרגע) — עובר במלואו, כולל: אין תאריך → פורמט ישן ללא null/Invalid Date; אין brief slug → תווית מושמטת; סקציה רב-סרטונית → לא מנחש תאריך יחיד מטעה. **כל אלה על נתונים מדומים דרך רינדור SSR של הקוד האמיתי — לא נבדק מול ה-Workspace Library האמיתי של המשתמש.**

### B5. עדכון Ledger

הועבר ל-backlog-tracker — הרצתי ברקע, מחכה לתוצאה (ר' "פעולות ברקע" למטה).

---

## PART C — היגיינת Worktree וסשנים

### C1. Worktrees "prunable"

**20 worktrees** מסומנים `prunable` ע"י `git worktree list --porcelain`. אימתתי מדגם: התיקיות **לא קיימות בכלל על הדיסק** — כלומר אין שום קובץ uncommitted/untracked לאבד (מה שקיים כבר שמור ב-object database של git, נגיש דרך שם ה-branch). **פקודת הניקוי המדויקת (לא הופעלה):**
```
git worktree prune --dry-run -v   # לבדוק קודם מה יימחק
git worktree prune                # לבצע בפועל
```

### C2. `.claude/settings.json`

Diff: 3 שורות allowlist הרשאות נוספו (`Bash(echo "---exit:$?---")`, `Bash(git show *)`, `Bash(rm head_video_panel_check.tmp)`), אין הסרות, אין שינוי מבני. **נראה אינצידנטלי** — תואם בדיוק לפקודות Bash שאושרו בפועל בסשנים שונים במהלך היום, לא הנדסת-הרשאות מכוונת. בטוח ל-commit או discard, לפי שיקול דעתך.

### C3. מיפוי תהליכים חיים על המכונה

| PID | תהליך | מה |
|---|---|---|
| 3716 | node (vite.js) | שרת ה-dev של הפרויקט, `[::1]:5184` |
| 26896, 27368, 14264, 14288 | claude.exe | 4 סשני Claude Code חיים (אחד מהם — `14264`, מזוהה כ-`e395ea4a-...` — הוא **אני**, הסשן הנוכחי) |
| 23244 | codex.exe | תהליך Codex חי אחד |
| 4 זוגות node.exe/npx | Playwright MCP | ככל הנראה שרת MCP נפרד לכל סשן Claude שטען יכולת דפדפן |

**לא ניתן לקבוע מכאן לבד איזה WORK-ID כל PID עובד עליו** (אין חשיפת מטא-דאטה ברמת התהליך). לפי העדויות העקיפות בעבודה עצמה (קבצים שהשתנו תוך כדי), לפחות session אחד עובד על "וידאו נעוץ" (לא מזוהה WORK-ID) ואחד/יותר על GEMPICKER. **המלצה: לא הרגתי אף תהליך** (הרג session פעיל עלול להשמיד עבודה באמצע כתיבה) — כשתתעורר, זהה כל סשן דרך הכותרת/הטרמינל שלו וסגור ידנית את המיותרים כדי לחזור לכותב יחיד.

### C4. `feat/gems-phase0-1`

**לא נגעתי.** לא merge, לא rebase, לא cherry-pick, לא מחיקה. הענף עדיין קיים בדיוק כפי שהיה (`f9586f0`, worktree נפרד, נקי, 2 קדימה מ-`origin/main`). ההחלטה "לנטוש" נשארת **המלצה הנדסית שלי ושל session אחר, לא אישור שלך** (ר' Task B הקודם וה-ledger).

---

## PART D — הכנה בלבד, ללא ביצוע

### D1. תיקון מינימלי מדויק ל-`resolveTone("פעולה")` — **דיף בלבד, לא הוחל**

שורש הבעיה: `FALSE_POSITIVE_TOKENS` מכיל **רק מילה אחת** — `'פעולה'` (`src/lib/hebrewSentimentTokenGuard.js:35`). `resolveTone()` הוא נקודת הכניסה היחידה שלא מנקה אותה לפני ההתאמה.

**התיקון המומלץ — עריכה אחת בלבד, בפונקציה עצמה, ללא צורך לגעת באף אחד מ-12 מקומות הקריאה:**

```diff
--- a/src/lib/morningBriefVisuals.js
+++ b/src/lib/morningBriefVisuals.js
@@ -85,7 +85,11 @@
 /** Classify free-text market tokens into bullish / bearish / neutral. */
 export function resolveTone(text) {
-  const t = norm(text);
+  // 2026-09-01: strip known Hebrew false-positive substring collisions
+  // (e.g. "פעולה" containing "עולה") before token matching — the same
+  // guard already used internally by inferSignedNumber() in this file,
+  // and by the 3 other modules fixed per lessons.md's 2026-08-30 entry.
+  // resolveTone() itself was the widely-shared entry point those never covered.
+  const t = norm(stripSentimentFalsePositiveTokens(text));
   if (!t) return TONE.NEUTRAL;
   if (BULLISH_TOKENS.some((tok) => t.includes(tok))) return TONE.BULLISH;
   if (BEARISH_TOKENS.some((tok) => t.includes(tok))) return TONE.BEARISH;
```
(`stripSentimentFalsePositiveTokens` כבר מיובא בקובץ הזה, שורה 6 — אין import חדש נדרש.)

**12 מקומות הקריאה — כולם מקבלים את התיקון אוטומטית, ללא עריכה נפרדת:**

| # | קובץ:שורה | האם ההתנהגות תשתנה |
|---|---|---|
| 1-8 | `MorningBriefPanels.jsx:273,625,649,679,1693,1948,1997,3006` | רק אם הטקסט הנבדק מכיל את המילה השלמה "פעולה" |
| 9 | `MorningBriefVisualPrimitives.jsx:442` | כנ"ל |
| 10 | `aaiiWeeklySentiment.js:141` | כנ"ל (לא סביר — קלט מספרי) |
| 11 | `morningBriefNewsNormalize.js:96` | כנ"ל |
| 12 | `stockStatusDisplay.js:52` | כנ"ל |
| — | `morningBriefVisuals.js` הפנימי (`inferSignedNumber`) | **ללא שינוי** — כבר מנקה בעצמו לפני הקריאה, התיקון idempotent |

היקף השינוי בפועל: **רק** טקסטים שמכילים את המילה השלמה "פעולה" (למשל תגית פעילות "פעולה" בשורות GEM שמורות) יסווגו נכון (ניטרלי/לפי שאר הטקסט) במקום `bullish` שגוי. שום קלט אחר לא מושפע. **לא הוחל בקוד.**

### D2. GEMPICKER — אישור מצב + חזרה על QA

**מאושר:** 6 קבצים אמיתיים (+ `docs/open-items-ledger.md` + הדוח שלהם) — כולם single-owner כרגע (שורות `videoPublishedAt` כבר לא מעורבבות ב-`VideoDetailPanel.jsx`, מאומת ב-Task B הקודם ושוב עכשיו). לא stag־תי, לא committed.

**רשימת QA ידנית ל-10 סעיפים (חובה לפני כל commit, כפי שכבר תועד ב-`docs/plan/REPORT-TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.md`):**
1. וידאו טכני מובהק → מצומצם, "טכני" מסומן, ~79%+
2. וידאו פונדמנטלי (איות תקין) → מצומצם, ~75%+
3. וידאו פסיכולוגיית מסחר → **"מאקרו ושוק"**, לא טכני
4. **קריטי, טרם נענה:** מבזק בוקר/ערב → האם אחוז ביטחון (97%) מופיע ליד "AI מומלץ"? זו תוספת חדשה לא מאושרת
5. וידאו עם איות שגוי ("פנדמנטלי") → "ממתין לסיווג", לא GEM שגוי, לא קריסה
6. באותו וידאו — בחירה ידנית עובדת
7. וידאו ללא אות סיווג כלל → "ממתין לסיווג", ללא ניחוש
8. וידאו לא-שוק-הון → אין רגרסיה
9. Console נקי משגיאות חדשות
10. `git status` תואם בדיוק את מה שמתועד

---

## סיכום ומיפוי סטטוס

- **Committed ו-pushed:** TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS (`a7536c0`) — **אך לא מאומת סופית**, ר' B1/B4 — הועבר בחזרה ל"פתוח" ב-ledger.
- **Uncommitted, בעץ הראשי:** GEMPICKER (6 קבצים), פיצ'ר "וידאו נעוץ" לא-מזוהה (2 קבצים), `.claude/settings.json`.
- **קיים רק מקומית, לא-pushed:** `main` (12 קומיטים), `docs/markdown-governance-cleanup` (44), `feat/gems-phase0-1` (2), 12 branches נוספים ללא upstream.
- **בלתי-מיוחס:** `.claude/settings.json`, פיצ'ר "וידאו נעוץ" (WORK-ID לא זוהה).
- **דורש החלטת משתמש:** כל טבלת A5; GEMS decision-14 (b8a8d40 vs. uncommitted); QA ידני ל-GEMPICKER; אישור/דחייה של `resolveTone()` fix (D1); B1's המקרה הספציפי.

### סדר מומלץ לבוקר
1. קרא את טבלת A5 וסמן כן/לא.
2. רענן גיבוי ל-`ymd-market-provider-table-integration` (בסיכון).
3. פתח את הדפדפן שלך על `localhost:5184`, בדוק את הסרטון המקורי מהצילום-מסך — קרא את `publishedAt` הגולמי שלו (Console: `await (await indexedDB...).get(...)`) ואשר את B1 סופית.
4. הרץ את 10 בדיקות ה-QA הידניות ל-GEMPICKER (D2), במיוחד סעיף 4.
5. החלט על `resolveTone()` (D1) — אישור להחיל את התיקון בן-השורה האחת.
6. החלט על GEMS decision-14 (לנטוש את `feat/gems-phase0-1` בפועל, אם מסכים).
7. עבור על branches ללא-upstream (A3) לפי הטבלה.
8. שקול `git worktree prune` (C1).

**אישור מפורש:** לא בוצע commit, push, merge, rebase, stash, restore, reset, מחיקת branch/worktree, שינוי תלויות, הפעלה מחדש של שרת, או עריכת קוד אפליקציה כלשהו במהלך המשימה הזו.
