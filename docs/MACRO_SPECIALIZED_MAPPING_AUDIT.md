# Specialized Tab — Macro Mapping Audit
**תאריך:** 2026-07-12
**מקור:** מבזק לייב פתיחה לתאריך 10.7.26 — GEM JSON (fixture: `scripts/fixtures/macro-specialized-regression.fixture.mjs`)
**קומיטים:** `c1febb8` (טסטים), `6b242e1` (תיקון)

---

## 1. Executive Summary

לשונית Specialized הציגה רק חלק מגורמי המאקרו שה-GEM חילץ בפועל:

| שכבה | כמות | הערה |
|---|---|---|
| `rawData.macroFactors` | 3 | פד, אורקל, קריפטו (BTC+ETH) — כל אחד עם `{ factor, note }` מפורט |
| `universalTabs.specialized.macroFactors` | 2 | רק פד ואורקל, בפורמט `{ name, status }` קצר יותר; **אין פריט קריפטו כלל** |
| מוצג בפועל (לפני התיקון) | 1–2 | תלוי בנתיב רינדור; תוכן חלקי, כותרת חשופה בלי הסבר |
| מוצג בפועל (אחרי התיקון) | **3** | פד + אורקל + קריפטו, כל אחד עם ההסבר המלא |

הבעיה לא הייתה כלל אחד אלא **שילוב של שלושה באגים עצמאיים** שהצטברו זה על זה.

---

## 2. Root Cause — שלושה באגים

### באג 1 — `normalizeMacroIndicatorRow` לא הכיר `factor`
**קובץ:** `src/lib/morningBriefDisplay.js`

`rawData.macroFactors` משתמש בצורה `{ factor, note }`, אבל הפונקציה חיפשה אינדיקטור רק תחת `name/symbol/indicator/ticker/stock`. כשלא נמצא — `indicator` נפל לברירת מחדל `'—'`, ואז `_isMalformedIndicatorName('—')` **זרק את כל הפריט**, כולל ה-`note` המפורט.

**תוצאה ישירה:** פריט הקריפטו (אין לו מקבילה קצרה ב-specialized) נמחק **לגמרי** מהמאקרו — לא כותרת, לא הסבר, כלום. ה-ETH (1,794) והביטקוין (64,000) *כפריט מאקרו* פשוט נעלמו.

### באג 2 — `resolveSpecialized` עושה שכפול שטחי (shallow spread) במקום מיזוג
**קובץ:** `src/config/videoTabsConfig.js`

```js
function resolveSpecialized(mbd) {
  ...
  return { ...mbd, ...(raw || {}), ...(spec || {}) };
}
```

זהו spread שטחי: `specialized.macroFactors` (2 פריטים) **מחליף** לגמרי את `rawData.macroFactors` (3 פריטים) — לא מאחד מערכים. זה מנגנון **נפרד ועצמאי** מה-merge העמוק (`mergeMorningBriefSpecializedSource` ב-`morningBriefDisplay.js`), שכן הוא כן עושה איחוד מערכים נכון. כך שהיו במקביל **שני יישומי merge שונים ולא-מסונכרנים** שהזינו את אותה לשונית — אחד "עשיר" ואחד "עני".

### באג 3 — `formatMacroItem` התעלם מ-`status`/`note`
**קובץ:** `src/config/videoTabsConfig.js`

הפונקציה שממירה אובייקט מאקרו לטקסט הכירה רק `event/title/name/subject` לכותרת ו-`impact/marketImpact/effect/expectedImpact` לגוף. כשפריט specialized (`{ name, status }`) עבר בנתיב הזה — הכותרת (`name`) הוצגה, אבל `status` (ההסבר) **נשמט לגמרי**. זו הסיבה שהפריט של הפד הוצג ככותרת חשופה ("ועדות הבדיקה של הפד") בלי המסקנה שהריבית צפויה להישאר ללא שינוי.

---

## 3. למה זו לא הייתה "ניתוב קטגוריות" (אשליה)

הדיווח המקורי תיאר שאורקל "עבר" ל-Stocks וביטקוין "עבר" ל-Markets. **נבדק ואומת: אין קוד שמעביר קטגוריות.**

`extractUnifiedStocks` (Stocks) ו-`extractMarketDashboardRows`/`extractKeyLevelRows` (Markets) קוראים ישירות ובאופן בלתי-תלוי מ-`stocksMentioned` / `indices` / `keyLevels` — מערכים נפרדים לגמרי מ-`macroFactors`, שלא הושפעו מהבאגים למעלה. כשפריט המאקרו התרוקן, המידע המקביל ב-Stocks/Markets המשיך להופיע כרגיל — מה שיצר את **הרושם** של "מעבר קטגוריה", בעוד שבפועל שום דבר לא הוסר משם ושום דבר לא "עבר" — המאקרו פשוט התרוקן בנפרד.

**מסקנה:** אין ואף פעם לא הייתה כאן לוגיקת "consume once" חוצת-קטגוריות (global consume-once rule). לא נדרש לשנות את Stocks/Markets.

---

## 4. Ticker Normalization — לא תוקן, ובכוונה

נבדקו הטיקרים החשודים מהדיווח המקורי: `BUG` (SK Hynix), `CRDL` (Circle), `WDF` (WD-40), `S1` (SentinelOne).

**נמצא:** אין ב-codebase שום alias map (נבדק `src/utils/finvizLinks.js` וקבצי מיפוי טיקרים נוספים) שמייצר את הערכים האלה מתוך שם החברה. `normalizeTicker()` ו-`stockRecordFromObject()` (ב-`morningBriefDisplay.js`) רק **מוודאים פורמט** (regex) על טיקר שכבר סופק — הם לא ממציאים או ממפים טיקר משם.

**מסקנה:** הטיקרים השגויים מגיעים **מפלט ה-GEM/AI עצמו** (זיהוי שגוי של המודל בעת פענוח התמלול), לא משכבת המיפוי בקוד. בהתאם להנחיה המפורשת — **לא בוצע שינוי בקוד טיקרים**. תיקון אמיתי דורש שינוי ב-prompt של ה-GEM או שכבת ולידציה נפרדת (לא בסקופ של המשימה הזו).

---

## 5. `metadata.mappingHints.specializedSources` — מטא-דאטה מתה

נבדק בכל ה-codebase: המפתח `specializedSources` **לא נקרא בשום מקום** ככלי סינון בפועל. ההופעה היחידה שלו היא בבדיקת דיאגנוסטיקה ב-`VideoDetailPanel.jsx` שמחפשת האם המחרוזת `mappingHints` דלפה כטקסט גולמי לתוך JSON שבור (repair detection) — לא שימוש תפקודי.

**מסקנה:** הרחבת הרשימה (`marketNews`, `macroFactors`, `keyLevels` וכו') לא הייתה משנה דבר בבאג הזה, ולכן לא בוצעה — בהתאם לעיקרון "לא לבצע שינוי רחב שלא הוכח כנדרש".

---

## 6. התיקון (additive, presentation-layer בלבד)

| # | שינוי | קובץ |
|---|---|---|
| 1 | `normalizeMacroIndicatorRow`: הוספת `'factor'` לזיהוי indicator | `morningBriefDisplay.js` |
| 2 | `extractMacroIndicatorRows`: מיזוג לפי **מפתח סמנטי** (`macroSemanticKey`) — לא exact-string — עם buckets: fed-policy / credit-rating / crypto-market / dollar-index / oil / inflation / jobs / volatility / bond-yield, ופולבאק ל-2 מילים משמעותיות ראשונות. שומר את הפריט העשיר יותר (`macroRowRichness`) | `morningBriefDisplay.js` |
| 3 | `mergeMacroDisplayRows` (שני עותקים כפולים) הוחלף לאותו מיזוג סמנטי, כדי שנתיב ה-fallback הישן (`brief-macro`) לא יחזיר כפילות "עני" מול פריט "עשיר" שכבר קיים | `morningBriefBulkSections.js`, `MorningBriefPanels.jsx` |
| 4 | `brief-macro` case: איחוד מפורש של `rawData.macroFactors` + `specialized.macroFactors` לפני פורמט, במקום להסתמך על ה-spread השטחי של `resolveSpecialized` | `videoTabsConfig.js` |
| 5 | `formatMacroItem`: הוספת זיהוי `factor` (כותרת) ו-`status`/`note`/`description`/`comment` (גוף) | `videoTabsConfig.js` |

כל השינויים תוספתיים (additive) — לא שונה סכמת GEM, לא בוצעה מיגרציית נתונים, לא נגעו קטגוריות Stocks/Markets/GEM schema.

---

## 7. תוצאות בדיקה

**Regression fixture** (`scripts/test-macro-specialized-regression.mjs`) — 11/11 assertions עברו:
- בדיוק 3 פריטי מאקרו מוצגים (פד, אורקל, קריפטו)
- פריט הפד כולל את תוכן ה-rate outlook, לא רק כותרת
- פריט אורקל מזכיר BBB-
- פריט הקריפטו כולל גם ביטקוין (64,000) וגם את'ריום (1,794) — שניהם, לא רק אחד
- אין כרטיסי מאקרו כפולים
- אורקל עדיין מופיע תחת Stocks (כפילות חוצת-קטגוריה מותרת ומצופה)
- ביטקוין עדיין מופיע תחת Markets/keyLevels

**Backward-compat smoke test** (`scripts/test-macro-mapping-compat.mjs`) — 3/3 עברו:
- payload שאינו marketBrief מחזיר מערך ריק בלי קריסה
- payload legacy עם דדופ Dixie/US10Y (מנגנון `itemMergeSignature` הקיים) ממשיך לעבוד כרגיל

**בדיקות קיימות** (`scripts/test-morning-brief-routing.mjs`) — 88/88 עברו, ללא רגרסיה.

**Build:** `npm run build` — exit code 0, `dist/index.html` + `dist/assets/*` נבנו תקין.

---

## 8. Diagnostics (dev-only, לא production logging)

הרצת `scripts/test-macro-specialized-regression.mjs` מדפיסה:
```
macro received: rawData=3 specialized=2
macro normalized (candidates post-merge): 5
macro deduplicated / rendered: 3
```
תואם ליעד: `received: 3, rendered: 3`.

---

## 9. Rollback

`git revert 6b242e1` — קומיט בודד, ללא תלות בנתונים מאוחסנים ו-ללא שינוי סכמת GEM. אין צורך במיגרציה.

---

## 10. Commits

1. `c1febb8` — `test: add regression fixture for Specialized-tab macro mapping bug` (פיקסצ'ר + טסטים, נכשל מול הקוד הלא-מתוקן)
2. `6b242e1` — `fix: stop dropping/truncating Specialized-tab macro factors` (התיקון, 4 קבצים בלבד — MorningBriefPanels.jsx ו-morningBriefBulkSections.js הוכללו באופן חלקי בלבד כדי לא לכלול עבודת "select-all" קודמת ולא-קשורה שהייתה כבר ב-working tree)

---

## 11. מה נשאר פתוח (במכוון, מחוץ לסקופ)

- טיקרים שגויים (BUG/CRDL/WDF/S1) — מקורם ב-GEM/AI, לא בקוד המיפוי. תיקון אמיתי דורש שינוי prompt.
- `mappingHints.specializedSources` — מטא-דאטה מתה; לא הורחבה כי לא הייתה קשורה לבאג.
- שני מנגנוני ה-merge המקבילים (`mergeMorningBriefSpecializedSource` מול `resolveSpecialized`) עדיין קיימים במקביל — תוקן רק המקרה הספציפי של `macroFactors` ב-`brief-macro`. איחוד ארכיטקטוני מלא בין השניים הוא שינוי רחב יותר שלא הוכח כנדרש לבאג הזה.
