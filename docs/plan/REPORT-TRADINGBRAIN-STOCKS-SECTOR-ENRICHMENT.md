# REPORT — TRADINGBRAIN-STOCKS-SECTOR-ENRICHMENT

WORK-ID: TRADINGBRAIN-STOCKS-SECTOR-ENRICHMENT
SESSION-TITLE: טריידינג בריין — מניות שהוזכרו — השלמת סקטור — בבירור

## מצב Repo (Phase A)

Repo: `c:\Users\11\Desktop\Workspace\new-project\projects\youtube-mentor-dashboard`, branch `feat/saved-market-rows-table`.
HEAD בתחילת המשימה ובסופה זהה: `369a769db5bce34ba7e81258ad97f0ea66dde916` — שום דבר לא קומיט, שום דבר לא staged (אומת בנפרד על ידי ה-orchestrator לאחר סיום הסוכן).

כל 18 הקבצים ה"מלוכלכים" שצוינו בתחילת המשימה + הקבצים ה-untracked של docs/plan ו-scripts/workspace נבדקו וזוהו כשייכים לסשן אחר (saved-market-rows) — לא נגעו בהם. `docs/open-items-ledger.md` נסרק (grep ל-sector/Finviz/MarketSectorTable) — אין שורה פתוחה חופפת למשימה הזו.

## Root Cause

ערך הסקטור של מניה מגיע מחילוץ AI מתוך תמלול הסרטון — אם הסרטון לא הזכיר סקטור, השדה ריק. זו בעיית **נתוני מקור חסרים**, לא באג רינדור. אימות בקוד: אף לא אחד מ-`normalizeStockRow` (`src/utils/structuredSnapshot.js`), `stockRecordFromObject` (`src/lib/morningBriefDisplay.js`) או `parseStockRowFromText` (`src/lib/stockRowText.js`) שמר שדה `sector` — כך שגם אם וידאו כן הזכיר סקטור, לא היה נתיב שמעביר אותו הלאה. שלושת אתרי הרינדור הממשיים הסתמכו אך ורק על מפה סטטית ישנה (`src/lib/stockSectorMap.js`) שהשתמשה בטקסונומיית GICS (Semiconductors/Software → SMH/IGV) במקום 11 הסקטורים של Finviz, וחסרה את DELL/GTLB/HPQ/MDB/VRT/CRDO/PANW לגמרי.

## מה נבנה

**קובץ חדש `src/lib/stockSectorEnrichment.js`** — מקור אמת יחיד: `FINVIZ_SECTOR_META` (11 מפתחות מדויקים → labelHe+ETF, כל התוויות מיובאות מהקוד הקיים, אף לא תווית אחת הומצאה), `TICKER_SECTOR_MAP` (348 טיקרים, כולל כל 8 טיקרי הקבלה), ו-`resolveStockSectorDisplay({ ticker, storedSector })` — הפותר המשותף היחיד (סדר: stored value → מפה → null). משתמש מחדש ב-helper הקיים `buildSectorTableFinvizUrl`/`resolveSectorTableFinvizLink` מ-`src/lib/sectorFinvizLinks.js` (לא נבנה URL builder שני; `src/utils/finvizLinks.js` הוא מודול נפרד ולא רלוונטי כאן — לקישורי ticker ולא ETF).

**חיבור נתונים (אדיטיבי בלבד)**: `normalizeStockRow` ו-`stockRecordFromObject`/`upsertStock` עכשיו שומרים ומאחדים שדה `sector` (במקום להשמיט אותו) — כך ש"אם יש ערך שמור, לעולם לא נדרוס אותו" יהיה אמיתי ברגע שיהיה מפיק אמיתי.

**חיווט 3 אתרי הרינדור** (`SavedStockRowsTable.jsx`, `StructuredSnapshotView.jsx`, `MorningBriefPanels.jsx`) — כל אחד הוחלף מ-`getStockSectorMeta` ל-`resolveStockSectorDisplay`, תוך שימור מדויק של ה-JSX/עיצוב/hover/data-attributes הקיימים (רק שם השדה השתנה).

**QA חדש**: `scripts/sector-enrichment-map-qa.mjs` — 13 בדיקות, כולן עוברות. נוסף `test:sector-enrichment-map` ל-package.json.

## תיקוני QA קיימים (תוצאה ישירה וצפויה של השינוי, לא תקלה)

- `scripts/structured-snapshot-qa.mjs` — הוספת `sector: ''` לאובייקט הצפוי (השדה החדש אדיטיבי, כוונה).
- `scripts/sector-table-presentation-qa.mjs` — עדכון בדיקת source-text מ-`resolveSectorTableFinvizLink(sectorLabel)` ל-`resolveStockSectorDisplay({ ticker, storedSector: stock.sector })`.

## קריטריוני קבלה

1. ✅ DELL/GTLB/HPQ/MDB/VRT/CRDO/PANW/UBER — כולם במפה, נבדק ב-QA.
2. ✅ קישור Finviz נכון (ETF תואם) לכל תוצאת map; ל-storedSector יש קישור רק אם `resolveSectorTableFinvizLink` מזהה אותו — אין ניחוש slug.
3. ✅ טיקר לא ידוע → `null` → "—", בלי קישור, בלי console error.
4. ✅ (בעיצוב) — אך אין כרגע נתון אמיתי בפרודקשן עם `sector` שמור לבדוק מולו (ראה קונפליקטים למטה).
5. ✅ אין שינוי חזותי לעמודות/רכיבים אחרים — אומת ב-diff מלא.
6. ⚠️ **Coverage נמדד, לא הונח** — אין כלי דפדפן בסשן זה, לכן לא ניתן לגשת ל-IndexedDB אמיתי (נרשם כפער, לא עוקף). Proxy הכי קרוב: 8 טיקרים אמיתיים שנמצאו ב-fixtures קיימים בריפו (MRVL, MRNA, ORCL, META, EBAY, AVGO, AMZN, NVDA) — 8/8 = 100%, אך זו מדגם קטן ולא מייצג נתוני משתמש אמיתיים.

## קונפליקטים stored-vs-map

אין — כי שום מפיק אמיתי בקוד לא ממלא היום שדה `sector` על שורת מניה (ראה root cause).

## תוויות עבריות שהומצאו

**אף אחת.** כל 11 התוויות שאובות מ-`src/lib/marketLabelTranslations.js` ומ-`src/lib/stockSectorMap.js` הקיים. הכרעה מודעת אחת: "תשתיות" (לא "שירותים ציבוריים") ל-Utilities, כי זו התווית המרכזית/מוסמכת יותר (מופיעה בשני מקורות קיימים לעומת אחד).

## אתרי רינדור שנדחו

אין — כל 3 אתרי הרינדור האמיתיים היו נקיים ותוחזקו.

## בדיקות שבוצעו

- `node scripts/sector-enrichment-map-qa.mjs` → 13/13
- `npm run build` → exit 0
- `structured-snapshot-qa.mjs` → 15/15
- `saved-stock-rows-qa.mjs` → 23/23
- `sector-finviz-links-qa.mjs`, `sector-table-presentation-qa.mjs`, `market-stock-classification-qa.mjs` (מודול מוגן — לא נערך), `workspace-market-dimensions-qa.mjs` (38/38), `saved-market-rows-qa.mjs` (14/14), `structured-display-text-qa.mjs` — כולם עוברים.
- הרצת **כל** ~90 סקריפטי `*-qa.mjs` בריפו: 10 נכשלים, אף אחד לא מפנה לקבצים שנערכו (אומת ב-grep) — כולם תקלות ידועות מראש (Obsidian/vault/Playwright timeouts, indicator-enum, pinned-card, publish-date-header, workspace-navigation — כבר מתועדים ב-ledger) או תקלת מודול לא קשורה (`youtube-transcript-persistence-qa.mjs`).
- אין lint/type-check מוגדר בריפו.
- `git diff --check` נקי על כל הקבצים. סקירת diff מלאה — נקי, אדיטיבי, אין CRLF churn אמיתי.

## סבבי תיקון

1 (שני עדכוני QA צפויים כתוצאה ישירה מהשינוי המכוון, לא תקלות).

## סיכונים/מגבלות

- אין QA דפדפן חי (אין כלי דפדפן זמין בסשן זה).
- כיסוי המפה חלקי (348 טיקרים, לא כל S&P500+Nasdaq100 המלא — 600+).
- נתיב "stored value" לא נבדק מול נתון אמיתי מתנגש (כי כזה לא קיים היום).
- `src/lib/stockSectorMap.js` הפך לקוד מת (3 אתרי הקריאה הוחלפו) — לא נמחק, לפי מדיניות "שינויים מינימליים, לא מוחקים בלי אישור".

## Rollback

כל השינויים unstaged/untracked בלבד — `git checkout -- <file>` על כל אחד מ-8 הקבצים שהשתנו (בטוח, כי אף אחד מהם לא היה מלוכלך לפני המשימה), או פשוט מחיקת 2 הקבצים החדשים.

## קבצים שהשתנו (הכל unstaged/untracked, שום דבר staged)

**Modified:** `package.json`, `scripts/sector-table-presentation-qa.mjs`, `scripts/structured-snapshot-qa.mjs`, `src/components/dashboard/MorningBriefPanels.jsx`, `src/components/workspace/SavedStockRowsTable.jsx`, `src/components/workspace/StructuredSnapshotView.jsx`, `src/lib/morningBriefDisplay.js`, `src/utils/structuredSnapshot.js`

**New (untracked):** `src/lib/stockSectorEnrichment.js`, `scripts/sector-enrichment-map-qa.mjs`

## הצעת commit message (לא בוצע)

```
feat(stocks): add ticker->Finviz-sector enrichment map + shared resolver

Adds a static local ticker->sector fallback (11 canonical Finviz sectors,
348 tickers incl. DELL/GTLB/HPQ/MDB/VRT/CRDO/PANW/UBER) and wires it into
all 3 stock-row sector render sites via one shared pure resolver
(resolveStockSectorDisplay), replacing the old GICS-style stockSectorMap.
Stored sector values (if ever present) are never overwritten.
```

## צ'קליסט QA ידני (עברית, לדפדפן אמיתי)

1. פתח וידאו/תמונת מצב שמכילה אחת מ-DELL/GTLB/HPQ/MDB/VRT/CRDO/PANW/UBER — ודא שבעמודת "סקטור" מופיע שם, לא "—".
2. לחץ על קישור הסקטור — ודא פתיחת עמוד ה-ETF הנכון ב-Finviz (למשל UBER→XLK).
3. בדוק טיקר לא ברשימה — ודא "—" בלבד, בלי קישור, בלי שגיאה ב-Console (F12).
4. בדוק בשלושת המסכים: ניתוח חי, Workspace Library (שורות שמורות), Structured Snapshot.
5. ודא שאין שינוי חזותי בעמודות אחרות.
6. ודא RTL תקין (יישור ימני, כיוון החץ ↗).

## פריטים לא גמורים — ל-ledger

- אין QA דפדפן חי; לא אומת חזותית מול משתמש אמיתי | owner: qa-release-reviewer | status: open | file: `src/lib/stockSectorEnrichment.js` + 3 render sites, branch `feat/saved-market-rows-table`.
- כיסוי המפה חלקי (348 טיקרים, לא S&P500+Nasdaq100 מלא) — נדרש מקור נתונים חי להרחבה בטוחה | owner: unassigned | status: needs-user-decision | file: `src/lib/stockSectorEnrichment.js`.
- `src/lib/stockSectorMap.js` הפך לקוד מת (3 אתרי הקריאה הוחלפו) — למחוק/להשאיר? | owner: unassigned | status: needs-user-decision | file: `src/lib/stockSectorMap.js`.
- מדידת coverage אמיתית מול נתוני משתמש שמורים (IndexedDB) לא בוצעה — proxy קטן בלבד (8/8 fixtures) | owner: unassigned | status: open | file: N/A (דורש כלי דפדפן).

## lessons.md

`lessons.md — נקרא: כן (C:\Users\11\.codex\lessons.md, מלא); לקחים רלוונטיים שהוחלו: "Prove a renderer is active before editing it" (אימות grep לכל אתרי הקריאה לפני עריכה), "Match source-contract assertions to the inspected implementation" (עדכון בדיקות QA לפי ההתנהגות החדשה ולא שימור assertion מיושן), "Include untracked files in whitespace verification" (git diff --check על כל הקבצים כולל untracked); לקח חדש שנוסף: אין (לא זוהתה תקלה חדשה, מאושרת וניתנת לשימוש חוזר, שמצדיקה תיעוד).`

---

## ⏸️ ורדיקט: ממתין ל-QA ידני בדפדפן

כל הקריטריונים הטכניים (1,2,3,5) עברו ואומתו; קריטריון 4 מיושם אך לא נבדק מול נתון אמיתי מתנגש (כי אין כזה כרגע בקוד); קריטריון 6 נמדד רק מול proxy קטן, לא מול נתוני משתמש אמיתיים — בשל היעדר כלי דפדפן בסשן זה (לא נעשה מעקף — דווח כפער בפירוש). Build/QA/lint (לא קיים) — כולם ירוקים. שום דבר לא קומיט.

---

## Round 2 — תיקון באג "רכב" ללא קישור (2026-09-04)

### באג מדווח
ב-QA ידני של המשתמש: שורות F ו-GM הציגו סקטור "רכב" כטקסט רגיל בלי קישור Finviz, ו-TSLA הציג "רכב וטכנולوגיה" גם כן בלי קישור — בעוד ששבבים/תוכנה/טכנولوגיה/קמעונאות באותה טבלה כן מקושרים.

### Root cause — אומת בקוד לפני עריכה
כפי שצוין מראש: אלו ערכים שמורים שחולצו ע"י AI (stored-value-first מנצח), וה-label העברי "רכב" לא הופיע בטבלת ה-alias הקיימת (`EXACT_SECTOR_ETF_ALIASES` ב-`src/lib/sectorFinvizLinks.js`) ולא בקבוצות ה-fuzzy-matching (`SECTOR_ETF_ALIASES`) — ולכן `resolveSectorTableFinvizLink('רכב')` החזיר `null` → אין קישור. אושר תואם למצופה, ללא סטייה מהאבחון המוצע.

חשוב לציין ממצא נוסף שאומת תוך כדי: הטבלה `SavedStockRowsTable.jsx` ("Workspace Library" saved rows) בכלל **לא** מעבירה `storedSector` ל-`resolveStockSectorDisplay` (`SectorPill` שם מקבל רק `ticker` — קוד+הערה קיימים, `row.parsed` מגיע מ-`parseStockRowFromText` על טקסט חופשי, בלי שדה סקטור מובנה) — כך שהבאג הזה לא יכול להתרחש שם. הטבלה שהמשתמש צילם היא בהכרח `StructuredSnapshotView.jsx` או `MorningBriefPanels.jsx` (שתיהן כן מעבירות `storedSector: stock.sector` ומכילות כותרת "מניות שהוזכרו" זהה) — התיקון ב-resolver המשותף חל אוטומטית על שתיהן.

### מה תוקן
1. **`src/lib/sectorFinvizLinks.js`** (קובץ קיים שהורחב, לא נוצרה טבלה שנייה) — 3 aliases חדשים ל-`EXACT_SECTOR_ETF_ALIASES`: `רכב`→XLY, `רכב חשמלי`→XLY, `יצרניות רכב`→XLY (Consumer Cyclical, אחד מ-11 הסקטורים המאושרים; לא CARZ/SMH/SOXX).
2. **`src/lib/stockSectorEnrichment.js`** — שני helpers חדשים ו-fallback chain ב-`resolveStockSectorDisplay`:
   - `tickerMapLink(ticker)` — עוטף את מפת הטיקרים הקיימת ל-link object.
   - `firstResolvableComponentLink(label)` — מפרק label מורכב למילים (מסיר "ו" מוביל מכל token), מנסה לפתור כל token דרך ה-resolver הקיים, מחזיר את ההתאמה הראשונה.
   - סדר הפתרון החדש בענף ה-stored: `resolveSectorTableFinvizLink(stored) || tickerMapLink(ticker) || firstResolvableComponentLink(stored)`. ה-**label המוצג נשאר תמיד הטקסט השמור המדויק** — רק יעד הקישור עובר fallback. זה בדיוק מה שגרם ל-TSLA ("רכב וטכنولوجية") להיפתר: ה-label המלא לא נמצא בטבלה, אז fallback לטיקר TSLA→Consumer Cyclical→XLY (עדיפות על component-split, כמבוקש בסעיף 3).
3. F ו-GM ("רכב" בלבד) נפתרים כבר בשלב 1 (ה-alias החדש) — לא מגיעים ל-fallback כלל, אך גם הטיקר שלהם ידוע (Consumer Cyclical) ומסכים.

### קונפליקטים label-vs-ticker
לא נמצאו — לכל 3 המקרים (F, GM, TSLA) ה-label (אחרי ההרחבה) וה-ticker fallback מסכימים על XLY. לא בוצע rewrite/migration/backfill לשום רשומה שמורה.

### QA
`scripts/sector-enrichment-map-qa.mjs` הורחב (לא נוצר סקריפט שני) ב-6 בדיקות חדשות: `רכב`→XLY, compound `רכב וטכנولوجية`→XLY עם label ללא שינוי, F/GM/TSLA כולם→XLY, אימות שה-fallback מכבד ticker-map (לא ניחוש component), unknown label + unknown ticker→plain text, וה-3 aliases החדשים כולם בתוך 11 ה-ETF המאושרים. בדיקה קיימת אחת עודכנה (`resolver returns a stored value with no link...`) — הוחלף הטיקר מ-AAPL (ידוע, כעת ⁠היה נותן קישור בטעות תחת ההתנהגות החדשה) ל-ticker לא ידוע, כדי לשמר את הכוונה המקורית של הבדיקה (label+ticker שניהם לא ידועים → אין קישור). **19/19 בדיקות עוברות.**

`npm run build` → exit 0. הרצו בנוסף ועברו: `structured-snapshot-qa.mjs` (15/15), `sector-table-presentation-qa.mjs`, `sector-finviz-links-qa.mjs`, `saved-stock-rows-qa.mjs` (23), `workspace-market-dimensions-qa.mjs` (38), `saved-market-rows-qa.mjs` (14), `market-stock-classification-qa.mjs` (מודול מוגן, לא נערך), `structured-display-text-qa.mjs`.

RTL: אין קבצי JSX שנערכו בסבב הזה (רק `.js` לוגיקה טהורה) — אין סיכון RTL חדש.

### Live QA
נוסה `browser_navigate` פעם אחת — נחסם: הפרופיל המשותף (`mcp-chrome-7e26c77`) כבר בשימוש ע"י סשן מקביל. לפי החוק המפורש: לא בוצע מעקף, לא נוסה שוב. **אין QA דפדפן חי בסבב הזה.**

### מפקד תוויות (label census) — לא ניתן היה לבצע מול נתונים אמיתיים
בשל אותה חסימת פרופיל דפדפן, לא ניתן לקרוא IndexedDB אמיתי ולמנות תוויות סקטור בפועל אצל המשתמש — **אותה מגבלה בדיוק כמו בסבב 1**. ה-proxy הזמין היחיד הוא מחרוזות בתוך fixtures/בדיקות בריפו (לא נתוני משתמש): `ביוטכنولوגיה ותרופות`, `טכנولوגיה`, `קمעonaut ומוצרי שיפוץ בית`, `''` (ריק) — כולן כבר נפתרות (מלבד ריק). "רכב"/"רכב וטכنولوگیה" הופיעו רק בדוח הבאג של המשתמש עצמו, לא ב-fixtures. **לא מדווח מספר coverage אמיתי — זה פער פתוח, לא הונח כאילו נמדד.**

### תשובה לשאלה הפתוחה מסבב 1
כן, `src/lib/stockSectorMap.js` הוא המפה הקיימת שהתבקשתי לשקול. אושר (סבב 1): הוא לא הורחב כי הוא משתמש בטקסונומיה עדינה יותר משל Finviz (`Semiconductors`→SMH, `Software`→IGV כקטגוריות נפרדות), בעוד המשימה דרשה במפורש בדיוק 11 מפתחות Finviz שמאחדים את שתיהן תחת Technology→XLK. השניים חלוקים על 18 טיקרים חופפים (כל שמות השבבים/התוכנה: NVDA, AMD, INTC, AVGO, QCOM, MU, AMAT, LRCX, KLAC, MRVL, ARM, ADBE, CRM, ORCL, PLTR, NOW, SNOW, UBER) — במכוון, לא בטעות. **לא נמחק** (כנדרש) — עדיין קוד מת, עדיין דורש החלטת משתמש.

### קבצים שהשתנו בסבב 2 (הכל unstaged/untracked, שום דבר staged)
- **Modified:** `src/lib/sectorFinvizLinks.js` (חדש לרשימת השינויים — לא נערך בסבב 1), `src/lib/stockSectorEnrichment.js`, `scripts/sector-enrichment-map-qa.mjs` (שני האחרונים כבר untracked מסבב 1, נערכו שוב)
- אין קבצים חדשים בסבב זה.

### סבבי תיקון
1 (התיקון עבד בניסיון הראשון; עדכון בדיקה קיימת אחת כתוצאה ישירה וצפויה מהשינוי המכוון).

### סיכונים/מגבלות (מעודכן)
- אין עדיין QA דפדפן חי בשני הסבבים — אותו gap, לא נסגר.
- מפקד תוויות אמיתי (coverage) לא בוצע גם בסבב זה — אותה סיבה.
- ה-fallback ל-first-resolvable-component (סעיף 3, המקרה השלישי בשרשרת) לא נבדק ישירות ב-QA למקרה שבו הטיקר לא ידוע אבל component בודד כן נפתר — כוסה עקיפין ע"י שאר הבדיקות (התנהגות תואמת קוד, לא unit-tested בנפרד). פער קטן, לתעד.
- `stockSectorMap.js` עדיין קוד מת — עדיין דורש החלטת משתמש (לא שונה בסבב זה).

### Rollback
`git checkout -- src/lib/sectorFinvizLinks.js` (היה נקי לפני הסבב); מחיקת/שחזור `src/lib/stockSectorEnrichment.js` ו-`scripts/sector-enrichment-map-qa.mjs` לגרסתם מסבב 1 (`git diff` על שניהם ריק כי הם untracked — לצפות בגרסה הקודמת יש לחפש בהיסטוריית ה-Edit של סבב 1 בלבד אם צריך שחזור מדויק; בפועל, מחיקת 6 הבדיקות/2 ה-helpers החדשים משני הקבצים מספיקה).

### הצעת commit message מעודכנת (לא בוצע, עדיין לא קומיט מאף סבב)
```
feat(stocks): add ticker->Finviz-sector enrichment map + shared resolver

Adds a static local ticker->sector fallback (11 canonical Finviz sectors,
348 tickers incl. DELL/GTLB/HPQ/MDB/VRT/CRDO/PANW/UBER) and wires it into
all 3 stock-row sector render sites via one shared pure resolver
(resolveStockSectorDisplay), replacing the old GICS-style stockSectorMap.
Stored sector values are never overwritten; when a stored label has no
known ETF alias (e.g. "רכב"), the resolver now falls back to the ticker
map and then to the label's first resolvable component for the LINK
target only -- the displayed text always stays the stored label verbatim.
Extends the existing Hebrew sector-label alias table with automotive
aliases (רכב / רכב חשמלי / יצרניות רכב -> XLY).
```

### צ'קליסט QA ידני מעודכן (עברית, לדפדפן אמיתי)
1. פתח וידאו/תמונת מצב שמכילה אחת מ-DELL/GTLB/HPQ/MDB/VRT/CRDO/PANW/UBER — ודא שבעמודת "סקטور" מופיע שם, לא "—".
2. לחץ על קישור הסקטור — ודא פתיחת עמוד ה-ETF הנכון ב-Finviz (למשל UBER→XLK).
3. **חדש:** מצא שורת F או GM עם סקטור "רכב" — ודא שהטקסט "רכב" מוצג (ללא שינוי) **וגם** מקושר ל-XLY ב-Finviz.
4. **חדש:** מצא שורת TSLA עם סקטור "רכב וטכنولوجية" (או label מורכב דומה) — ודא שהטקסט המלא מוצג בלי פיצול, ומקושר ל-XLY.
5. בדוק טיקר לא ברשימה — ודא "—" בלבד, בלי קישור, בלי שגיאה ב-Console (F12).
6. בדוק בשלושת המסכים: ניתוח חי / Structured Snapshot, Workspace Library (שורות שמורות — שם אין stored sector כלל, תמיד ymap-based), Morning Brief.
7. ודא שאין שינוי חזותי בעמודות אחרות (אין קובצי JSX שנערכו בסבב זה).
8. ודא RTL תקין (יישור ימני, כיוון החץ ↗).

### פריטים לא גמורים — ל-ledger (עדכון)
- (ממשיך מסבב 1) אין QA דפדפن חי — עדיין פתוח, אותה סיבה (פרופיל נעול).
- (ממשיך מסבב 1) מפקד/כיסוי אמיתי מול IndexedDB אמיתי — עדיין לא בוצע, אותה סיבה.
- (ממשיך מסבب 1) `stockSectorMap.js` קוד מת — עדיין דורש החלטת משתמש (מחיקה/השארה).
- **חדש:** ה-fallback `firstResolvableComponentLink` (השלב השלישי בשרשרת) לא מכוסה ב-unit test ישיר — רק בעקיפין. מומלץ להוסיף בדיקה ייעודית בסבב עתידי אם רוצים כיסוי מלא.

### lessons.md
`lessons.md — נקרא: כן; לקחים רלוונטיים שהוחלו: "Prove a renderer is active before editing it" (אימות איזו טבלה בפועל מקבלת storedSector לפני שיוך הבאג, גילוי ש-SavedStockRowsTable אינו הטבלה הרלוונטית), "Report a missing browser tool instead of fabricating live browser QA" (ניסיון יחיד ל-browser_navigate, דיווח חסימה מפורש, ללא מעקף), "Match source-contract assertions to the inspected implementation" (עדכון הבדיקה הקיימת שהייתה נשברת עם ה-fallback החדש); לקח חדש שנוסף: אין (לא זוהתה תקלה חדשה ומאושרת המצדיקה תיעוד).`

---

## Round 3 — מיזוג הגרנולריות הישנה (SMH/IGV) + סגירת פער QA (2026-09-04)

### מה בוצע
המשתמש הסיר במפורש את ההגבלה "רק 11 ה-ETF המאושרים" וביקש למזג את הדיוק העדין יותר של `src/lib/stockSectorMap.js` הישן לתוך ה-resolver.

**1. נתיב ה-label (stored) — לא נדרש שינוי קוד.** אומת שהערכים שבבים→SMH, תוכנה→IGV, טכנולוגיה→XLK כבר קיימים ולא נגעו בהם ב-`EXACT_SECTOR_ETF_ALIASES` (`src/lib/sectorFinvizLinks.js`) מלפני המשימה כולה — נוספו רק בדיקות QA שמאמתות זאת במפורש.

**2. נתיב ה-ticker-map — נוסף override חדש.** ב-`src/lib/stockSectorEnrichment.js`: מפה חדשה `TICKER_ETF_OVERRIDE` (18 טיקרים בדיוק: 11→SMH, 6→IGV, UBER→XLY) + helper `tickerEtf(ticker, sectorKey)` שמוחל בשני המקומות שמפיקים קישור מהטיקר. ה-sectorKey וה-label הסינתטי לא השתנו — עדיין 'Technology'/'טכנולוגיה' לכל 18 הטיקרים — רק יעד הקישור (ETF) נדרס.

**UBER — סטייה מודעת ומתועדת:** לפי הוראה מפורשת, UBER מקושר כעת ל-XLY (Consumer Cyclical) — לא ל-IGV (המפה הישנה) ולא ל-XLK (סבב 1). זו הפיכה מכוונת של קריטריון הקבלה המקורי מסבב 1. עודכן `ACCEPTANCE_TICKERS`/נוסף `ACCEPTANCE_ETF_OVERRIDE` בבדיקת ה-QA. מודגש: זה יוצר אי-עקביות טקסטואלית קלה — UBER יציג עדיין את התווית הסינתטית "טכנולוגיה" אך יקושר לקרן Consumer Cyclical.

**3. `src/lib/stockSectorMap.js` — לא נמחק ולא נערך**, כנדרש. עדיין קוד מת מבחינת קריאה ישירה, אך הגרנולריות שלו (SMH/IGV) מוזגה לתוך ה-resolver דרך `TICKER_ETF_OVERRIDE`.

**4. סגירת פער QA מסבב 2:** נוספו 2 בדיקות ישירות ל-`firstResolvableComponentLink`.

### QA
`scripts/sector-enrichment-map-qa.mjs` הורחב (לא נוצר סקריפט שני) ב-10 בדיקות חדשות, ועודכנה בדיקת הקבלה של 8 הטיקרים כדי לשקף את חריגת UBER. **29/29 בדיקות עוברות.** `npm run build` → exit 0. + 7 סקריפטי QA קשורים נוספים — כולם ירוקים (structured-snapshot 15/15, sector-table-presentation, sector-finviz-links, saved-stock-rows 23, workspace-market-dimensions 38, saved-market-rows 14, structured-display-text, market-stock-classification מוגן).

`git diff --check` נקי. אין קבצי JSX שנערכו → אין RTL. `src/lib/stockSectorMap.js` אומת ב-`git status` כלא נגוע.

### Live QA
נוסה `browser_navigate` פעם אחת נוספת — עדיין חסום (אותו פרופיל בשימוש ע"י סשן מקביל). לא נעקף. שלושה סבבים ברציפות ללא QA דפדפן חי.

### קבצים שהשתנו בסבב 3 (הכל unstaged/untracked, שום דבר staged)
- `src/lib/stockSectorEnrichment.js` (untracked מסבב 1, נערך שוב) — `TICKER_ETF_OVERRIDE` (exported), `tickerEtf()`, עדכון `tickerMapLink()` ועדכון ה-branch הישיר.
- `scripts/sector-enrichment-map-qa.mjs` (untracked מסבב 1, נערך שוב) — 10 בדיקות חדשות + עדכון בדיקת הקבלה.
- `src/lib/sectorFinvizLinks.js` — לא נערך בסבב זה.
- `src/lib/stockSectorMap.js` — לא נערך, לא נמחק, כנדרש.

### סבבי תיקון
1 (הכל עבר בניסיון ראשון).

### סיכונים (מעודכן)
- אין QA דפדפן חי — 3/3 סבבים.
- אי-עקביות label/ETF ל-UBER (label "טכנולוגיה" מקושר ל-XLY) — תוצאה ישירה של הוראה מפורשת, לא באג.
- מפקד coverage אמיתי מול IndexedDB — עדיין לא בוצע.

### Rollback
מחיקת `TICKER_ETF_OVERRIDE`/`tickerEtf`/2 העדכונים ב-`stockSectorEnrichment.js`, ומחיקת 10 הבדיקות + שחזור בדיקת הקבלה המקורית ב-`sector-enrichment-map-qa.mjs`. `sectorFinvizLinks.js`/`stockSectorMap.js` לא נערכו.

### הצעת commit message מעודכנת (לא בוצע — מוכן לאישור commit)
```
feat(stocks): add ticker->Finviz-sector enrichment map + shared resolver

Adds a static local ticker->sector fallback (11 canonical Finviz sectors,
348 tickers) and wires it into all 3 stock-row sector render sites via one
shared pure resolver (resolveStockSectorDisplay), replacing the old
GICS-style stockSectorMap.js as the active lookup (kept in place, unused).

Stored sector values are never overwritten. When a stored label has no
known ETF alias, the resolver falls back to the ticker map, then to the
label's first resolvable component, for the LINK target only -- displayed
text always stays the stored label verbatim. Extends the Hebrew alias
table with automotive labels (רכב / רכב חשמלי / יצרניות רכב -> XLY).

Merges stockSectorMap.js's finer sub-industry granularity back in via a
per-ticker ETF override (TICKER_ETF_OVERRIDE): 17 semiconductor/software
tickers link to SMH/IGV instead of the generic Technology ETF (XLK),
matching the more specific classification; UBER is a deliberate exception
overriding both maps' original ETF -> XLY (Consumer Cyclical), per
explicit instruction. sectorKey/displayed labels are unaffected by this
override -- only the link target changes.
```

### צ'קליסט QA ידני מאוחד (עברית, לדפדפן אמיתי) — סבבים 1-3 יחד
1. פתח וידאו/תמונת מצב שמכילה אחת מ-DELL/GTLB/HPQ/MDB/VRT/CRDO/PANW — ודא שבעמודת "סקטור" מופיע שם, לא "—", ומקושר לקרן ה-ETF התואמת (למשל DELL/GTLB→XLK).
2. מצא מניית שבבים ללא ערך שמור (NVDA/AMD/AVGO/INTC/QCOM/MU) — ודא שהתווית "טכנולוגיה" (או מה שמופיע) מקושרת ל-SMH, לא XLK.
3. מצא מניית תוכנה ללא ערך שמור (SNOW/ADBE/CRM/ORCL/PLTR/NOW) — ודא קישור ל-IGV, לא XLK.
4. מצא UBER — ודא שהתווית עדיין "טכנולוגיה" (או דומה) אך הקישור מוביל ל-XLY (לא XLK, לא IGV) — זו סטייה מכוונת, לא באג.
5. מצא שורת F או GM עם סקטור שמור "רכב" — ודא שהטקסט "רכב" מוצג ללא שינוי וגם מקושר ל-XLY.
6. מצא שורת TSLA עם "רכב וטכנולוגיה" (או label מורכב דומה) — ודא שהטקסט המלא מוצג בלי פיצול, ומקושר ל-XLY.
7. בדוק סקטור כללי "טכנולוגיה" (בדיוק, לא חלק ממחרוזת אוטומוטיבית) — ודא שהוא מקושר ל-XLK.
8. בדוק טיקר לא ברשימה — ודא "—" בלבד, בלי קישור, בלי שגיאת Console (F12).
9. בדוק בשלושת המסכים: ניתוח חי/Structured Snapshot, Workspace Library (שם אין stored sector כלל — תמיד map-based), Morning Brief.
10. ודא שאין שינוי חזותי בעמודות אחרות, ו-RTL תקין (יישור ימני).

### פריטים לא גמורים — ל-ledger (מעודכן ע"י backlog-tracker)
- (ממשיך) אין QA דפדפן חי — 3 סבבים ברציפות, אותה סיבה (פרופיל נעול).
- (ממשיך, נסגר) פער ה-`firstResolvableComponentLink` נסגר — 2 unit tests ישירים נוספו. שורת ה-ledger מ-Round 2 שמתעדת אותו צריכה עדכון/סגירה.
- (ממשיך) `stockSectorMap.js` קוד מת — עדיין דורש החלטת משתמש (מחיקה/השארה) — לא שונה בסבב זה.
- **חדש:** אי-עקביות label/ETF ל-UBER (label "טכנולוגיה" מקושר ל-XLY) — תיעוד מודע, לא באג, אך שווה מודעות UX.

## ⏸️ ורדיקט: מוכן לאישור commit — כל הבדיקות האוטומטיות עברו, אין QA דפדפן חי (שלושה סבבים ברציפות), חריגת UBER מתועדת במפורש.
