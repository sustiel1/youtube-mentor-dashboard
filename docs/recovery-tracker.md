# מעקב שחזור — YouTube Mentor Dashboard

עודכן: `2026-08-04 19:39:35 +03:00`
מקור אמת: היסטוריית Git, קבצי ה־repository, בדיקות שבוצעו על HEAD הנוכחי, build ו־runtime פעיל.
הקובץ החיצוני `C:\Users\11\Desktop\מונית\youtube-mentor-recovery-tracker.md` הוא מקור היסטורי בלבד ומסומן כמוחלף על ידי קובץ זה.

## כללי ניהול מחייבים

- [x] אין לסמן סעיף כשלם על סמך טקסט tracker בלבד.
- [x] כל `[x]` בקובץ זה נשען על commit שנמצא ב־ancestry, בדיקה קיימת/מורצת או QA מתועד.
- [x] כל עדכון חדש מסומן `🆕`.
- [x] אין לבצע staging או commit ללא שער אישור מפורש.
- [x] אין לכלול tracker ב־commit אלא כחלק מ־documentation commit שאושר במפורש.
- [x] אין לבצע push, merge, deploy, publish, החלפת/restart שרת או שינוי production data ללא אישור מפורש.
- [x] אין להשתמש ב־reset, restore או clean במהלך recovery ללא אישור מפורש.

## 🆕 ממשל batch רב־חבילות

- [x] ניתן להשלים ברצף עד שלוש חבילות קשורות ומאושרות לפני שער commit יחיד.
- [x] במהלך batch אין לבצע staging או commit ואין להחזיר את ה־working tree לאחור בין חבילות.
- [x] לפני תחילת batch יש לקבע שם batch, scope מאושר, Starting HEAD וסדר תלות; אין להסיק חבילות שאינן בתחום שאושר.
- [x] לאחר כל חבילה יש לתעד manifest מדויק, staged/unstaged/untracked, hash של diff החבילה, בדיקות, build, browser QA, סבבי תיקון, הודעת commit מוצעת, תלויות וחפיפות.
- [x] patch ייעודי לכל חבילה נשמר מחוץ ל־repository תחת `C:\tmp\ymd-review-patches\<batch-name>\<package-number>-<package-name>.patch`, ו־SHA-256 שלו נרשם כאן.
- [x] review patch של חבילת קוד כולל רק את נתיבי/hunks החבילה; `docs/recovery-tracker.md` מנוהל כדלתא משותפת של ה־batch ומוקצה במפורש ל־commit האחרון או ל־commit תיעוד, בלי לעבור שלושה commits מוצעים.
- [x] אין להתחיל חבילה עוקבת לפני שהקודמת עברה acceptance וה־manifest, patch ו־hash שלה נלכדו.
- [x] חפיפה בקובץ מחייבת תיעוד נתיב ו־hunks; אם hunk staging אינו חד־משמעי, החבילות התלויות מאוחדות ל־commit מוצע אחד.
- [x] בסיום batch מורצים matrix משולב, build, `git diff --check`, בדיקות whitespace לקבצים חדשים ו־browser/responsive/console/reload QA.
- [x] שער הסיום היחיד הוא `PENDING BATCH COMMIT APPROVAL`; אין ליצור יותר משלושה commits מוצעים.
- [x] לאחר אישור, כל commit נבדק ומבוצע לפי סדר התלות ורק מנתיבים או hunks מפורשים; `git add .` ו־`git add -A` אסורים.
- [x] אם ההפרדה נעשית עמומה בכל שלב, עוצרים לפני commit ומציעים commit משולב אחד.

## 🆕 מצב קנוני נוכחי

- Repository משותף: `C:\Users\11\Desktop\Workspace\new-project\projects\youtube-mentor-dashboard`
- Worktree קנוני: `C:\tmp\ymd-recent-app-integration`
- Branch: `integration/recent-app-improvements`
- Parent HEAD המאומת של commit התיעוד הנוכחי: `89c09d06174ba2ec56080d1ecb3dec89676de7bc`
- Parent subject: `test: verify live evidence timestamp interactions`
- Upstream: אין upstream מוגדר לענף; ה־commits מקומיים בלבד.
- Runtime PID: `8452`
- Runtime command: `"node" "C:\tmp\ymd-recent-app-integration\node_modules\.bin\\..\vite\bin\vite.js"`
- URL: `http://localhost:5184`
- [x] localhost מאזין ב־PID `8452` ומגיש את ה־worktree הקנוני.
- [x] cache-busting request החזיר HTTP `200`.
- [x] מודול UI ייחודי מ־HEAD הנוכחי הוגש מהשרת.
- [x] 🆕 runtime module audit החזיר HTTP `200` וכלל `normalizeUniversalInsightItem` ו־`preserveStructured`, ולכן localhost מגיש את ה־working tree המשתנה של ה־batch.
- [x] localhost מגיש את קוד האפליקציה committed מ־`888a1ac20d091cf3d31b1019724ef654caffd3e5`; commit `89c09d06174ba2ec56080d1ecb3dec89676de7bc` מוסיף בדיקת interaction בלבד ואינו משנה runtime.

### 🆕 Git classification במהלך batch `evidence-live-renderer-batch`

- Staged לפני commit התיעוד: אין.
- Unstaged tracked לפני commit התיעוד: `docs/recovery-tracker.md` בלבד.
- Untracked: אין.
- [x] 🆕 כל חמשת נתיבי היישום/בדיקות של חבילות 1–2 committed; אין application diff שנותר.
- Build artifacts: לא נוספו ל־Git status.
- `lessons.md`: מחוץ ל־repository ואינו כלול.

## משימה פעילה והמשימה הבאה

- [x] 🆕 משימה פעילה: reconciliation תיעודי סופי של batch `evidence-live-renderer-batch`; חבילות היישום וה־interaction committed והתקבלו.
- [x] 🆕 חבילת UI נשמרה ב־commit `95acf502f4c14c1c8e104c963270beb1d2279b76`.
- [x] 🆕 tracker נשמר ב־commit `1ba1640d298049f3de3de6c3a51b0f5ad0c2fc07` (`docs: add verified recovery tracker`).
- [x] 🆕 נבדקו כל חמש הרשומות המקומיות הזמינות; שלוש רשומות עם מצב ניתוח/GEMS נפתחו ונבדקו דרך ה־UI.
- [x] 🆕 defect ה־live renderer ברשומה `ידיעה אחר ידיעה - לייט נייט` תוקן והתקבל: מטא־דאטת הראיות נשמרת, שדות גולמיים אינם מוצגים, וכפתורי evidence timestamp עברו click/seek/keyboard/checkbox-separation.
- [x] 🆕 בשתי רשומות Evening בעלות Specialized מאוכלס סעיף הסקטורים ריק; populated Sector Tools סומן `not available in current local data` ותוצאת fixture/regression נשארת בתוקף.
- [x] 🆕 **Base44 proxy read-only QA**: התוסף מפעיל proxy רק כאשר `VITE_BASE44_APP_BASE_URL` מוגדר; ב־worktree אין `.env` או `.env.local`, ובקשת probe מקומית לנתיב `/api` לא מוכר חזרה כ־HTML של Vite. זהו פער תצורת סביבה/runtime, לא כשל build או defect בקוד.
- [x] 🆕 המשימה הבאה המדויקת: שמירת reconciliation זה ב־commit התיעוד המאושר `docs: record evidence live-renderer batch verification`; SHA עצמי אינו נרשם בקובץ כדי למנוע לולאת תיעוד.

## 🆕 Batch פעיל — `evidence-live-renderer-batch`

- Starting HEAD: `1ba1640d298049f3de3de6c3a51b0f5ad0c2fc07`.
- Branch/worktree: `integration/recent-app-improvements` / `C:\tmp\ymd-recent-app-integration`.
- Staging/commits במהלך היישום: לא בוצעו; לאחר שער האישור נשמרו חבילות 1–2 בשני commits אטומיים לפי סדר התלות.
- Combined application review-patches SHA-256 (חבילות 1–2 לפי סדר): `225ED6562F6887B1074B9D0908100AFEDB97B49E883ED40361F7470B990F43A4`.
- Combined all-review-artifacts SHA-256 (חבילות 1–3 לפי סדר): `E32DDB27A14B58409CC6C4B611A0049282BD2F3F0530CE1E6481EE7A43F24055`.
- Final application manifest: `src/lib/universalTabSections.js`, `src/lib/universalInsightNormalization.js`, `scripts/fixtures/live-evidence-learning-insights.json`, `scripts/test-live-insight-normalization.mjs`, `scripts/test-live-evidence-timestamp-interaction.mjs`.
- Shared documentation delta: `docs/recovery-tracker.md`.

### [x] חבילה 1 — live insight normalization — committed and accepted

- Acceptance: עבר בבדיקות החבילה ובמטריצה המשולבת; committed ב־`888a1ac20d091cf3d31b1019724ef654caffd3e5`.
- מטרה: לשמר את אובייקט ה־Insight המובנה ואת מטא־דאטת הראיות דרך ה־selector הקנוני, בלי להציג שמות שדות או raw provider data.
- Modified: `src/lib/universalTabSections.js`.
- Untracked: `src/lib/universalInsightNormalization.js`, `scripts/fixtures/live-evidence-learning-insights.json`, `scripts/test-live-insight-normalization.mjs`.
- Package diff hash: `9A9DDA867657A43DE610483F78B95EFAB1E0773085B52E0EFCDC050A23E8DDEE` (זהה ל־review patch SHA-256).
- Review patch: `C:\tmp\ymd-review-patches\evidence-live-renderer-batch\01-live-insight-normalization.patch`.
- Patch SHA-256: `9A9DDA867657A43DE610483F78B95EFAB1E0773085B52E0EFCDC050A23E8DDEE`.
- בדיקות: `test-live-insight-normalization`, `test-evidence-timestamp-ui`, `test-marketbrief-tabs-field-mapping-e2e`, `test-ai-mapping-renderer-parity` — כולן Exit `0`; `git diff --check` עבר.
- Build/browser QA: לא הורצו בנפרד אחרי חבילה 1; יבוצעו במטריצה המשולבת בסוף ה־batch.
- סבבי תיקון: `3` — שני תיקוני ציפיית בדיקה ותיקון whitespace יחיד; production behavior לא שונה בעקבות התיקונים.
- תלות: HEAD הפותח וה־selector/renderer/export/count paths שכבר מאוחדים בו.
- חפיפות: אין עם חבילה קודמת ב־batch; `docs/recovery-tracker.md` הוא דלתא משותפת ואינו כלול ב־review patch.
- Save verification: רשימת הקבצים המדויקת, ה־staged diff המלא, התאמה ל־review patch המאושר ו־`git diff --cached --check` עברו.
- Committed: `888a1ac20d091cf3d31b1019724ef654caffd3e5` — `fix: preserve live insight evidence metadata`.

### [x] חבילה 2 — evidence timestamp interaction — committed and accepted

- Acceptance: עבר; לא נדרש שינוי production נוסף מעבר לנרמול בחבילה 1; committed ב־`89c09d06174ba2ec56080d1ecb3dec89676de7bc`.
- מטרה: להוכיח שהמטא־דאטה המאומת מגיע ל־`EvidenceTimestampButton` ולבעלות seek היחידה הקיימת.
- Modified: אין נתיב production נוסף.
- Untracked: `scripts/test-live-evidence-timestamp-interaction.mjs`.
- Package diff hash: `7C845EB2D8FD44F36C08DD03A6361978D5A024425C5B716896F6B568BE406CAE` (זהה ל־review patch SHA-256).
- Review patch: `C:\tmp\ymd-review-patches\evidence-live-renderer-batch\02-evidence-timestamp-interaction.patch`.
- Patch SHA-256: `7C845EB2D8FD44F36C08DD03A6361978D5A024425C5B716896F6B568BE406CAE`.
- בדיקות: `test-live-evidence-timestamp-interaction`, `test-live-insight-normalization`, `test-evidence-timestamp-ui` — כולן Exit `0`; `git diff --check` עבר.
- QA ממוקד: click, Enter ו־Space ביצעו seek ל־`480.25`; checkbox לא השתנה ולא הפעיל seek; בעלות נגן יחיד; reload; viewport `355×767`.
- Build/browser QA חי: build ו־QA על הרשומה המקומית יבוצעו בחבילה 3 ובמטריצה המשולבת.
- סבבי תיקון: `0` בחבילה 2; סך ה־batch הסופי `3`.
- תלות: חבילה 1 וה־fixture `live-evidence-learning-insights.json`.
- חפיפות: אין נתיב קוד חופף; קובץ הבדיקה צורך את fixture חבילה 1. `docs/recovery-tracker.md` נשאר דלתא משותפת.
- Save verification: רשימת הקבצים המדויקת, ה־staged diff המלא, התאמה ל־review patch המאושר ו־`git diff --cached --check` עברו.
- Committed: `89c09d06174ba2ec56080d1ecb3dec89676de7bc` — `test: verify live evidence timestamp interactions`.

### [x] חבילה 3 — live-data QA closure

- Acceptance: עבר; אין diff של application source בחבילה זו.
- Live record: `ידיעה אחר ידיעה - לייט נייט`.
- QA חי: שמות השדות `lesson`, `category`, `whyImportant` ו־raw JSON אינם מוצגים; שישה Insight timestamps ושישה Useful Knowledge timestamps זמינים; `08:00` אומת ב־click, Enter ו־Space; checkbox נשאר מבודד; iframe יחיד; reload שמר את התוצאה.
- RTL/responsive: ללא document/dialog overflow בבדיקות `323×697` ו־`355×767`; Browser viewport דיווח CSS viewport נטו קטן יותר בגלל מסגרת Chrome, ובדיקת ה־Playwright הממוקדת אימתה `355×767` מלא.
- Sector Tools live: `not available in current local data`; הוצג empty state מפורש. fixture/regression נשאר מקור האימות למצב מאוכלס.
- Console: אפס application warnings/errors; נצפו רק הודעות `chrome-extension://` חיצוניות.
- Cache-busting/runtime: HTTP `200`; PID `8452`; Vite command מצביע ל־`C:\tmp\ymd-recent-app-integration`; המודול המוגש כולל את קוד ה־batch.
- Combined tests: `33/33` scripts עברו. שתי בדיקות Macro הותנעו עם `--import ./scripts/register-src-aliases.mjs` לפי שורת `Run:` שלהן; ניסיונות plain-node הראשוניים נכשלו לפני assertions ואינם כשל מוצר.
- Build: `npm.cmd run build` עבר Exit `0`; הודעת Base44 proxy החסר היא מצב env ידוע ולא compilation failure.
- `git diff --check`: עבר; whitespace checks לכל ארבעת הקבצים החדשים עברו.
- Package application diff hash: `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` (SHA-256 של diff ריק; QA בלבד).
- Review patch/attestation: `C:\tmp\ymd-review-patches\evidence-live-renderer-batch\03-live-data-qa-closure.patch`.
- Patch SHA-256: `68705B9759DA7C3E8FE44949A74BCBEE153E452329798F03A633778C7993B7D7`.
- סבבי תיקון: `0` בחבילה 3; סך ה־batch `3`.
- תלות: חבילות 1–2 וה־runtime הקנוני הפעיל.
- חפיפות: אין קוד; `docs/recovery-tracker.md` הוא דלתא משותפת של כל ה־batch ויוקצה ל־commit התיעוד האחרון.
- Proposed commit: `docs: record evidence live-renderer batch verification`.

## רצף commits מאומת

כל ה־commits הבאים קיימים ונמצאים ב־first-parent ancestry של HEAD הנוכחי:

| מצב | SHA | קבצים | Subject | Rollback בטוח |
|---|---|---:|---|---|
| [x] | `e920725046a782443413b3e91cffecb2e44ff390` | 3 | `feat: add bounded market extraction pipeline v1` | `git revert e920725046a782443413b3e91cffecb2e44ff390` |
| [x] | `00713fd9e4ae7b72ea1648acea347b01b9712562` | 4 | `fix: recover late-night specialized content` | `git revert 00713fd9e4ae7b72ea1648acea347b01b9712562` |
| [x] | `6d0c05e65aff9819c778af6d36b84a88099179d5` | 5 | `fix: normalize nested specialized content sources` | `git revert 6d0c05e65aff9819c778af6d36b84a88099179d5` |
| [x] | `e9f3ae0ebb8c098732438a96b7f443ff69b2edef` | 10 | `fix: restore session-aware market brief GEM routing` | `git revert e9f3ae0ebb8c098732438a96b7f443ff69b2edef` |
| [x] | `3d5a0d6ec46463cca0061193c7c2ca8720d28f58` | 6 | `feat: add strict Market Brief extraction schema v2` | `git revert 3d5a0d6ec46463cca0061193c7c2ca8720d28f58` |
| [x] | `ade9f3219626b9605dd67fe828963a76791178fa` | 2 | `feat: add Market Brief persistence guard contract` | `git revert ade9f3219626b9605dd67fe828963a76791178fa` |
| [x] | `7ac04afdf60775bcc279e747ffcde0768040f7f1` | 5 | `feat: add evidence timing and additive chapter contracts` | `git revert 7ac04afdf60775bcc279e747ffcde0768040f7f1` |
| [x] | `4cba02ce6d62a62a3f35e5b67adc99f0ec8307c4` | 4 | `feat: add canonical market destination registry` | `git revert 4cba02ce6d62a62a3f35e5b67adc99f0ec8307c4` |
| [x] | `e78d25da5ca4489536b465ef3c3df7015c661943` | 2 | `feat: add sanitized analysis failure diagnostics` | `git revert e78d25da5ca4489536b465ef3c3df7015c661943` |
| [x] | `9a4daf7e7f68ac69202e0b0ba3be1cf72d536e11` | 5 | `fix: guard Market Brief runtime persistence` | `git revert 9a4daf7e7f68ac69202e0b0ba3be1cf72d536e11` |
| [x] | `08e129facc0d1590be37105e3a969e1ae8b34c94` | 20 | `fix: require evidence-backed chapter timing` | `git revert 08e129facc0d1590be37105e3a969e1ae8b34c94` |
| [x] | `a1397bd130e9304e36a660d731125816999eef2b` | 6 | `feat: add evidence timestamp seeking` | `git revert a1397bd130e9304e36a660d731125816999eef2b` |
| [x] | `093a8fbd509efdc20f16dd61669f80bb249ee0de` | 4 | `fix: align AI mapping diagnostics with rendered content` | `git revert 093a8fbd509efdc20f16dd61669f80bb249ee0de` |
| [x] | `64e84d576be6f72ac0776bed00dba2aaa25dbc5e` | 4 | `fix: stabilize market brief panels and dialog accessibility` | `git revert 64e84d576be6f72ac0776bed00dba2aaa25dbc5e` |
| [x] | `64be7d2035a86ae6bce393c3da5833163dae39e1` | 11 | `fix: align specialized content mapping and Hebrew parity` | `git revert 64be7d2035a86ae6bce393c3da5833163dae39e1` |
| [x] | `988d3a543a36e0f379cb05fa0f5c7a1151a1fbb8` | 14 | `fix: add evidence-backed sentiment center` | `git revert 988d3a543a36e0f379cb05fa0f5c7a1151a1fbb8` |
| [x] | `6d134e97f4c81845165864e8c793f6ce448ecf55` | 17 | `fix: preserve macro value semantics and official sources` | `git revert 6d134e97f4c81845165864e8c793f6ce448ecf55` |
| [x] | `91a9fd84fc8ad4793e9ce5e17fe42d224e6012b9` | 14 | `fix: secure market links and restore sector tools` | `git revert 91a9fd84fc8ad4793e9ce5e17fe42d224e6012b9` |
| [x] | `e76f3b663c6a3cb6225dce43c68b88949feacc25` | 14 | `fix: add canonical mentor channel center and preserve market brief routing` | `git revert e76f3b663c6a3cb6225dce43c68b88949feacc25` |
| [x] 🆕 | `95acf502f4c14c1c8e104c963270beb1d2279b76` | 21 | `fix: unify semantic UI states and responsive accessibility` | `git revert 95acf502f4c14c1c8e104c963270beb1d2279b76` |
| [x] 🆕 | `1ba1640d298049f3de3de6c3a51b0f5ad0c2fc07` | 1 | `docs: add verified recovery tracker` | `git revert 1ba1640d298049f3de3de6c3a51b0f5ad0c2fc07` |
| [x] 🆕 | `888a1ac20d091cf3d31b1019724ef654caffd3e5` | 4 | `fix: preserve live insight evidence metadata` | `git revert 888a1ac20d091cf3d31b1019724ef654caffd3e5` |
| [x] 🆕 | `89c09d06174ba2ec56080d1ecb3dec89676de7bc` | 1 | `test: verify live evidence timestamp interactions` | `git revert 89c09d06174ba2ec56080d1ecb3dec89676de7bc` |

אין לבצע אף rollback ללא אישור מפורש.

## 1. Extraction, persistence ו־failure diagnostics

- [x] Extraction v1 מבצע bounded processing, normalization, deduplication ודיווח partial failure.
- [x] Extraction/schema v2 כולל strict Market Brief parser/schema, bounded repair יחיד ו־Gemini structured-output wiring.
- [x] failure diagnostics מסוננים ואינם חושפים transcript מלא, secrets או raw provider payload.
- [x] runtime persistence guard מחובר לנתיבי השמירה.
- [x] payload פגום או חלקי נדחה בלי למחוק נתון תקין קודם.
- [x] נשמרים manual overrides, מקטעי תמלול, עברית, `0`, `false` וזמנים עשרוניים.
- [x] legacy/new payload normalization נשמר.
- [x] persistence ו־runtime-persistence עוברים לאחר reload בבדיקות.
- [x] commits: `e920725`, `3d5a0d6`, `ade9f32`, `e78d25d`, `9a4daf7`.

## 2. Chapters, evidence timestamps ונגן יחיד

- [x] index/duration/equal-spacing אינם fallback ליצירת זמן ראיה.
- [x] זמן ללא ראיה הופך `null`/unavailable.
- [x] זמן מותאם רק מול transcript מתוזמן ובהתאמה חזקה.
- [x] נשמרים timestamp `0` וזמנים עשרוניים.
- [x] מיזוג פרקים additive ואינו מוחק פרקים קיימים.
- [x] פרקים נשמרים לאחר reload בבדיקות.
- [x] פרקים, Insights ו־Useful Knowledge משתמשים באותו seek owner ובנגן YouTube יחיד.
- [x] כפתור זמן מוצג רק לזמן מאומת ונפרד מה־checkbox.
- [x] תוויות נגישות בעברית נבדקו במבחנים.
- [x] narrow-layout כללי נבדק בפועל ב־323/355px.
- [x] 🆕 קליק, Enter ו־Space על evidence timestamp ברשומה חיה אומתו; checkbox נשאר מבודד ונשמרה בעלות iframe/player יחידה.
- [x] commits: `7ac04af`, `08e129f`, `a1397bd`, `888a1ac`, `89c09d0`.

## 3. AI Mapping

- [x] מוצגים מספר שדות פעילים ומספר פריטים כולל.
- [x] Specialized count תואם renderer/export.
- [x] excluded-items מוצג תמיד, כולל empty state.
- [x] לכל excluded item קיימים path מסונן, preview מוגבל, סיבה בעברית, destination, elsewhere ו־action-required.
- [x] אין חשיפת transcript מלא, secrets, raw provider payload או JSON גדול.
- [x] נעשה שימוש ב־selector/normalization/deduplication הקנוניים של renderer.
- [x] נשמרים עברית, `0`, `false`, decimals ונתון ידני.
- [x] diagnostic, sanitization, renderer/export/count parity עוברים.
- [x] QA צר ב־355px מתועד; כפתור סגירה נגיש נוסף בחבילת UI.
- [x] commits: `093a8fb`, `95acf50`.

## 4. Specialized Content

- [x] News.
- [x] Market status.
- [x] Sectors.
- [x] Opportunities.
- [x] Risks.
- [x] Mentioned stocks/assets.
- [x] Company events.
- [x] Economic calendar.
- [x] Macro בסיסי.
- [x] Sentiment בסיסי.
- [x] Markets.
- [x] Key levels.
- [x] Top insights.
- [x] Learning insights.
- [x] Lessons.
- [x] Morning, Generic ו־Evening/Late Night מגיעים לכל אזורי Specialized הרלוונטיים.
- [x] nested, sibling, `top5Insights`, `learningInsights`, `allPoints` ו־direct items נתמכים.
- [x] שמות שדות גולמיים, `[object Object]`, JSON גולמי, שורות ריקות וכפילויות מיותרות אינם מוצגים.
- [x] נשמרים עברית, `0`, `false`, decimals, manual data ו־evidence timestamps.
- [x] renderer, export, counts ו־AI Mapping parity עוברים.
- [x] commits: `00713fd`, `6d0c05e`, `64be7d2`.

## 5. Sentiment evidence center

- [x] נשמרים ומוצגים source, date, scope, evidence, drivers, confidence ו־verification state.
- [x] Bullish/Bearish מגיעים רק משדה מובנה מפורש.
- [x] מידע מהסרטון בלבד מסומן `ניתוח הסרטון — לא אומת חיצונית`.
- [x] אין המצאת ETF או destination מטקסט חופשי.
- [x] unknown/unverified assets נשארים plain text.
- [x] null ETF target אינו גורם crash.
- [x] Neutral מקבל מצב חזותי מלא וקריא.
- [x] נשמרים עברית, `0`, `false`, decimals, manual information ו־timestamps.
- [x] Morning, Generic, Evening ומבנים legacy נתמכים.
- [x] renderer/export/counts/AI Mapping parity עוברים.
- [x] commit: `988d3a543a36e0f379cb05fa0f5c7a1151a1fbb8`.

## 6. Macro value semantics

- [x] actual/current/target/reference/forecast/previous מופרדים.
- [x] change, trend, period, meaning והפער מהיעד מפורשים.
- [x] יעד אינפלציה אינו מוצג כ־CPI נוכחי.
- [x] קישורים רשמיים מוגבלים ל־allowlist עבור BLS, Federal Reserve ו־Investing Israel.
- [x] renderer/export/counts/AI Mapping parity עוברים.
- [x] helper היסטורי לחיפוש Investing נשאר לתאימות ואינו הנתיב הקנוני.
- [x] commit: `6d134e97f4c81845165864e8c793f6ce448ecf55`.

## 7. Market Links ו־Sector Tools

- [x] SPX, NASDAQ, DOW, RUSSELL, VIX, OIL, DOLLAR, BITCOIN ו־BONDS10Y נתמכים.
- [x] מניות, ETF, company-event assets ו־key-level assets מקושרים רק לאחר זיהוי מאומת.
- [x] גבולות alias תקינים; `אפליקציה` אינה מזוהה כ־AAPL.
- [x] unknown/ambiguous asset נשאר plain text.
- [x] אין יצירת search link מניחוש טקסט חופשי.
- [x] Finviz משמש רק למניה/ETF מאומתים.
- [x] BONDS10Y משתמש ב־Investing Israel המאושר.
- [x] TradingView משמש רק כאשר identity ו־exchange מאומתים.
- [x] external links משתמשים בפתיחה מאובטחת ו־checkbox/link מופרדים.
- [x] null destination אינו גורם crash.
- [x] Finviz Sector Map, ביצועים יומיים/שבועיים/חודשיים, TradingView Heatmap, State Street Tracker ו־Technicals/RSI קיימים.
- [x] XLK, XLC, XLY, XLP, XLE, XLF, XLV, XLI, XLB, XLRE ו־XLU ממופים.
- [x] אין Finviz homepage כללי ואין ETF label כפול.
- [ ] 🆕 populated Sector Tools אינו זמין ב־live stored records הנוכחיים; שתי רשומות Evening מאוכלסות הציגו סעיף סקטורים ריק, ולכן fixture/regression נשאר מקור האימות.
- [x] commit: `91a9fd84fc8ad4793e9ce5e17fe42d224e6012b9`.

## 8. Mentor Channel Center ו־GEMS routing

- [x] Channel Center זמין ב־Dashboard וב־Video Detail.
- [x] home, videos, live, courses, playlists ו־posts מגיעים מ־registry קנוני.
- [x] אין hard-code ל־Micha.Stocks.
- [x] Admin מאפשר עריכת תתי־קישורים.
- [x] `useMentors` ו־`mentorRegistry` מיושרים כמקור אמת.
- [x] persistence משתמש ב־`mentorTopicOverrides` ללא storage מתחרה.
- [x] Morning ו־Evening Market Brief משתמשים ב־GEM launcher הקנוני.
- [x] stored override ישן אינו מנתב confirmed Market Brief ל־GEM אחר.
- [x] non-Market Brief ממשיך להשתמש ב־GEM שנבחר.
- [x] unknown session שומר בחירה ידנית.
- [x] G15, G15b ו־routing regressions עוברים.
- [x] commits: `e9f3ae0`, `e76f3b6`.

## 9. Runtime stability ונגישות

- [x] `Maximum update depth exceeded` תוקן במקור הלולאה.
- [x] Radix dialog description תוקן סמנטית ולא הושתק.
- [x] commit: `64e84d576be6f72ac0776bed00dba2aaa25dbc5e`.
- [x] 🆕 ארבעה מצבי UI משותפים: positive, negative, neutral, warning.
- [x] 🆕 המצב חל על כל השורה/כרטיס ולא רק badge.
- [x] 🆕 משמעות פיננסית אינה מוסקת מטקסט נרטיבי חופשי.
- [x] 🆕 Select All הוא section-local ותומך checked/unchecked/mixed.
- [x] 🆕 checkbox, link, row ו־timestamp מופרדים.
- [x] 🆕 sidebar נייד כולל dialog semantics, focus trap, Escape והחזרת focus.
- [x] 🆕 sidebar סגור מוסר מעץ הנגישות ומסדר המיקוד.
- [x] 🆕 Video Detail משתמש בכפתור סגירה יחיד ונגיש.
- [x] 🆕 AI Mapping close button קיבל שם נגיש.
- [x] 🆕 RTL וללא document overflow ב־323, 355, 640, 768 ו־1280.
- [x] 🆕 commit: `95acf502f4c14c1c8e104c963270beb1d2279b76`.

## 10. בדיקות, build ו־browser QA

- [x] 🆕 batch `evidence-live-renderer-batch`: כל `33/33` סקריפטי הרגרסיה הזמינים והרלוונטיים עברו על ה־working tree הסופי.
- [x] 🆕 שתי בדיקות החבילה החדשות עברו שוב לאחר תיקון whitespace סופי, ולאחריהן production build עבר Exit `0`.
- [x] 🆕 `30/30` סקריפטי רגרסיה עברו מחדש על HEAD `95acf502…` ב־`2026-08-04`.
- [x] G3A, G15, G15b ו־Morning/Evening routing עברו.
- [x] Specialized coverage/parity ו־news/sectors עברו.
- [x] AI Mapping diagnostics ו־renderer/export/count parity עברו.
- [x] Market Links, destinations ו־Sector Tools עברו.
- [x] Macro ו־Sentiment עברו.
- [x] Extraction structured JSON ו־pipeline עברו.
- [x] Persistence guard ו־runtime persistence עברו.
- [x] Chapters, additive merge ו־evidence/event timestamps עברו.
- [x] Runtime warning stability, analysis failure contract ו־Gemini debug report עברו.
- [x] 🆕 production build עבר Exit `0` על HEAD הנוכחי.
- [x] build הודיע `Base44 Proxy not enabled` בגלל env חסר; זו אינה שגיאת compilation.
- [x] `git diff --check` עבר לפני commit חבילת UI וה־worktree היה נקי לאחריו.
- [x] browser QA מתועד ל־323×697, 355×767, 640×900, 768×1024 ו־1280×800.
- [x] 🆕 browser reload נוסף על HEAD הנוכחי נטען ב־RTL וללא overflow ברוחב 929px.
- [x] 🆕 Live-data QA: הרשומה `ידיעה אחר ידיעה - לייט נייט` מציגה Evidence Timestamp פעיל, טקסט עברי נקי, seek/keyboard/checkbox separation ונגן יחיד; שורת סקטור מאוכלסת לא נמצאה.
- [x] 🆕 cache-busting reload נוסף החזיר מסמך RTL תקין ללא overflow וללא application warnings; הודעות הקונסולה היחידות הגיעו מ־Chrome extensions.
- [x] 🆕 audit ל־`favicon.ico`: ה־404 הקודם לא שוחזר; בקשה ישירה ל־`/favicon.ico?audit=20260804` החזירה HTTP `200` דרך fallback של Vite, `index.html` אינו מפנה ל־favicon ואין תיקיית `public`. לא הוכח defect יישומי בבדיקה הנוכחית.
- [x] 🆕 Base44 proxy audit: `@base44/vite-plugin` דורש `VITE_BASE44_APP_BASE_URL`; אין קובץ env מקומי ב־worktree וה־runtime הנוכחי אינו מנתב probe לא מוכר ל־Base44.
- [x] cache-busting HTTP reload החזיר `200`.
- [x] שלושת סבבי התיקון של חבילת UI נוצלו; tracker reconciliation השתמש בסבב תיקון whitespace אחד.

## סיכונים ומגבלות פתוחות

- [ ] ספק AI אמיתי בתשלום לא נבדק; אין להפעיל ללא אישור ועלות מודעת.
- [ ] אין transaction אטומי בין כל מנגנוני האחסון; guards מפחיתים סיכון אך אינם transaction.
- [x] 🆕 evidence timestamp live-renderer defect שוחזר, תוקן ונשמר ב־`888a1ac20d091cf3d31b1019724ef654caffd3e5`; בדיקת ה־interaction נשמרה ב־`89c09d06174ba2ec56080d1ecb3dec89676de7bc`.
- [ ] 🆕 populated Sector Tools live state אינו זמין ברשומות המקומיות הנוכחיות; fixture/regression עברו.
- [ ] 🆕 זמן הניגון המדויק בתוך iframe אינו קריא cross-origin; הקריאה `seekTo(480.25)` אומתה בבדיקת ה־interaction הממוקדת.
- [ ] 🆕 Base44 proxy המקומי אינו פעיל ב־build או ב־runtime הנוכחיים משום ש־`VITE_BASE44_APP_BASE_URL` אינו מוגדר ב־worktree; הפעלה דורשת env מאושר ו־server restart מאושר.
- [ ] rendering אינו מבצע live network verification למקורות Macro/Sentiment; הוא מסתמך על metadata מובנה ו־allowlists.
- [ ] אזהרות LF→CRLF עדיין עשויות להופיע בפעולת Git עתידית; חבילת UI נבדקה ולא הכילה rewrite רחב.
- [ ] YouTube iframe עשוי להפיק `postMessage` warning חיצוני כאשר Video Detail פתוח.
- [x] 🆕 `favicon.ico` 404 ההיסטורי לא שוחזר; אין כרגע ראיה ל־application-owned 404. היעדר favicon ייעודי נשאר שיפור אופציונלי בלבד.
- [x] אין upstream לענף הנוכחי ולא בוצעו push, merge או deploy במסגרת השחזור.
- [x] worktrees וענפי documentation/secondary נשארו ללא שינוי במשימה זו.

## Gate נוכחי

- חבילת application אחרונה: `888a1ac20d091cf3d31b1019724ef654caffd3e5`, committed ומאומתת.
- בדיקת ה־interaction: `89c09d06174ba2ec56080d1ecb3dec89676de7bc`, committed ומאומתת.
- tracker: reconciliation תיעודי סופי; commit 3 אינו רושם את ה־SHA של עצמו כדי למנוע לולאה self-referential.
- `evidence-live-renderer-batch`: חבילות 1–2 committed והתקבלו; תיעוד חבילה 3 נשמר ב־commit המכיל קובץ זה.
- מבנה commit שבוצע: (1) normalization + fixture/test, (2) interaction regression, (3) tracker documentation.
- Base44 proxy נשאר מחוץ ל־scope ודורש בנפרד env ו־server restart מאושרים.
- [x] 🆕 שער ה־batch אושר במפורש; שלושת ה־commits האטומיים בוצעו לפי סדר התלות, ללא push, merge או deploy.
