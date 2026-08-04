# מעקב שחזור — YouTube Mentor Dashboard

עודכן: `2026-08-04 16:58:40 +03:00`
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

## 🆕 מצב קנוני נוכחי

- Repository משותף: `C:\Users\11\Desktop\Workspace\new-project\projects\youtube-mentor-dashboard`
- Worktree קנוני: `C:\tmp\ymd-recent-app-integration`
- Branch: `integration/recent-app-improvements`
- HEAD: `95acf502f4c14c1c8e104c963270beb1d2279b76`
- Subject: `fix: unify semantic UI states and responsive accessibility`
- Upstream: אין upstream מוגדר לענף; ה־commits מקומיים בלבד.
- Runtime PID: `8452`
- Runtime command: `"node" "C:\tmp\ymd-recent-app-integration\node_modules\.bin\\..\vite\bin\vite.js"`
- URL: `http://localhost:5184`
- [x] localhost מאזין ב־PID `8452` ומגיש את ה־worktree הקנוני.
- [x] cache-busting request החזיר HTTP `200`.
- [x] מודול UI ייחודי מ־HEAD הנוכחי הוגש מהשרת.
- [x] localhost מגיש קוד committed מ־HEAD `95acf502…`; ה־tracker אינו קוד runtime.

### 🆕 Git classification לאחר עדכון tracker זה

- Staged: אין.
- Unstaged tracked: אין.
- Untracked: `docs/recovery-tracker.md` בלבד.
- Build artifacts: לא נוספו ל־Git status.
- `lessons.md`: מחוץ ל־repository ואינו כלול.

## משימה פעילה והמשימה הבאה

- [x] 🆕 משימה פעילה: השלמת commit חבילת UI ושחזור tracker מקומי מול Git/QA/runtime.
- [x] 🆕 חבילת UI נשמרה ב־commit `95acf502f4c14c1c8e104c963270beb1d2279b76`.
- [ ] שער documentation commit ל־tracker: לא התבקש; הקובץ נשאר untracked לפי המדיניות.
- [ ] המשימה הבאה המדויקת: **Live-data QA closure** — בדיקת evidence-timestamp click על רשומה אמיתית בעלת זמן מאומת, ובדיקת Sector Tools מאוכלס כאשר קיימת רשומה מקומית מתאימה, ללא יצירה או שינוי production data.
- [ ] אין להתחיל את המשימה הבאה לפני שהמשתמש סוקר tracker זה ומאשר במפורש.

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
- [ ] קליק evidence timestamp על רשומה חיה בעלת זמן מאומת טרם נבדק בדפדפן.
- [x] commits: `7ac04af`, `08e129f`, `a1397bd`.

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
- [ ] populated Sector Tools לא נבדק על live stored record; fixture/regression בלבד.
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
- [x] 🆕 fresh browser console: אין application warnings; קיימת בקשת `favicon.ico` שמחזירה 404.
- [x] cache-busting HTTP reload החזיר `200`.
- [x] שלושת סבבי התיקון של חבילת UI נוצלו; tracker reconciliation השתמש בסבב תיקון whitespace אחד.

## סיכונים ומגבלות פתוחות

- [ ] ספק AI אמיתי בתשלום לא נבדק; אין להפעיל ללא אישור ועלות מודעת.
- [ ] אין transaction אטומי בין כל מנגנוני האחסון; guards מפחיתים סיכון אך אינם transaction.
- [ ] evidence timestamp click על פריט חי בעל זמן מאומת טרם נבדק.
- [ ] populated Sector Tools live state אינו זמין ברשומות המקומיות שנבדקו.
- [ ] Base44 proxy המקומי אינו פעיל בסביבת build הנוכחית בגלל env חסר.
- [ ] rendering אינו מבצע live network verification למקורות Macro/Sentiment; הוא מסתמך על metadata מובנה ו־allowlists.
- [ ] אזהרות LF→CRLF עדיין עשויות להופיע בפעולת Git עתידית; חבילת UI נבדקה ולא הכילה rewrite רחב.
- [ ] YouTube iframe עשוי להפיק `postMessage` warning חיצוני כאשר Video Detail פתוח.
- [ ] `favicon.ico` מחזיר 404 בדפדפן טרי; אינו כשל יישום אך נשאר חוב asset קטן.
- [x] אין upstream לענף הנוכחי ולא בוצעו push, merge או deploy במסגרת השחזור.
- [x] worktrees וענפי documentation/secondary נשארו ללא שינוי במשימה זו.

## Gate נוכחי

- חבילת application אחרונה: committed ומאומתת.
- tracker: untracked ולא מאושר ל־commit.
- אין חבילת application accepted שממתינה ל־commit.
- אין להתחיל package חדש עד אישור המשתמש למשימה הבאה.
