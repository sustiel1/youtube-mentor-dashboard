# Morning Brief Specialized Output Audit
**תאריך:** 2026-06-30  
**מקור:** מבזק לייב פתיחה — Micha.Stocks  
**לשונית:** Specialized  
**פריטים שיוצאו:** 53  
**פריטים ייחודיים בפועל:** ~27  

---

## 1. Executive Summary

הלשונית Specialized מייצרת פלט **מוכפל ב-2** לכל אורכה.
מתוך 53 פריטים שיוצאו, כ-26 הם כפולים מדויקים של קבוצות הסעיפים (פריטים 1–8) שחוזרות כשורות יחידות (פריטים 9–53).  
מעבר לכפילות, זוהו **4 קטגוריות עיקריות של בעיות**:

| קטגוריה | חומרה | מספר מקרים |
|---|---|---|
| כפילות תוכן מלאה | גבוהה | 26 פריטים |
| דליפת מפתחות JSON גולמיים לממשק | גבוהה | 3 פריטים (Mood, Reason, Crypto) |
| כפילות מאקרו (Dixie / US10Y) | גבוהה | 2 זוגות |
| מטא-מידע (תאריך, רקע) מוצג כתוכן | בינונית | 2 פריטים |

**המלצה:** יישום מומלץ — יש 8 תיקונים מדויקים שניתן לעשות ב-3 קבצים.

---

## 2. Raw Material Structure

### rawData fields (מה נמצא בחומר הגולמי)

| שדה | תוכן |
|---|---|
| `marketOverview` | mood, date, context |
| `marketNews` | 3 פריטים (פגישה בדוחה, קוריאה+הייטק, סולאר) |
| `indices` | 5 מדדים + quarterReturn |
| `macroFactors` | 5 אינדיקטורים (Dixie, WTI, אג"ח, VIX, שקל-דולר) |
| `stocksMentioned` | 13 מניות עם ticker+name+action+notes |
| `watchlist` | 10 tickers (RKLB, VRNS, AMZN…) |
| `watchlistLevels` | 2 רמות (AVAV 224, AMAT 900) |
| `keyLevels` | 3 רמות BTC+ETH |
| `catalysts` | 2 קטליסטים (סוף רבעון, דוחה) |
| `risks` | 3 סיכונים עם severity |
| `tradingOpportunities` | 1 הזדמנות (AVAV) עם rationale מלא |
| `earnings` | 2 חברות (AVAV חיובי, CNXC שלילי) |
| `sentiment` | mood + reason |
| `top5Insights` | 5 תובנות |
| `learningInsights` | 2 לקחים |
| `actionChecklist` | 3 פעולות |

### universalTabs.specialized fields (מה ה-GEM ייצר לשכבת Specialized)

| שדה | תוכן | הבדל מ-rawData |
|---|---|---|
| `marketOverview` | summary + sentiment | מצומצם יותר |
| `indices` | 3 מדדים (SPY, QQQ, IWM) | חסרים Russell, RSP |
| `marketNews` | 1 פריט בלבד | חסרים 2 מ-3 |
| `macroFactors` | 2 פריטים (Dixie, US10Y) | חסרים WTI, VIX, שקל-דולר |
| `stocksMentioned` | 2 מניות בלבד (AVAV, AMAT) | חסרים 11 מתוך 13 |
| `risks` | 1 סיכון בלבד | חסרים 2 מ-3 |

---

## 3. Current Specialized Output Structure

הפלט מגיע משני מסלולים מקבילים שנבחרו יחד:

**מסלול A — Card-level (פריטים 1–8):**  
`buildMorningBriefCardBulkItems()` → `formatCardBulkText()` → כותרת + כל השורות כ-bullets

**מסלול B — Row-level (פריטים 9–53):**  
`buildMorningBriefBulkSections()` → כל שורה בנפרד עם כותרת הסעיף

**בעיה:** הייצוא כולל את שני המסלולים יחד — כל תוכן מופיע פעמיים.

---

## 4. What Works Well

| נושא | הערכה |
|---|---|
| 13 מניות עם ticker+שם עברי+action | טוב — מידע מלא ושימושי |
| קטגוריה מדד שוק (S&P, NASDAQ וכו') | ברורה ומפורטת |
| הזדמנויות וסיכונים מופרדים בשורות יחידות (פריטים 16–20) | ברור |
| כותרות בעברית עם אמוג'י | ברורות לניווט |
| שיטת merge (specialized → legacy → rawData) | עקרונית נכונה |
| מאקרו מכיל 5 אינדיקטורים מ-rawData | כיסוי מלא |
| סיכונים עם ערכים ספציפיים (101.2, 71$) | אינפורמטיבי ✓ |

---

## 5. Problems Found

### P1 — כפילות תוכן מלאה (High)

**בעיה:** כל סעיף מופיע פעמיים — פעם כ"כרטיס" (bullets) ופעם כשורות יחידות.

**דוגמה:**
- פריט 2: `📊 מצב שוק` עם 5 bullets
- פריטים 11–15: אותם 5 bullets, כל אחד בנפרד

**למה חשוב:** הפלט המיוצא ל-Brain/Obsidian/Copy מכיל 100% כפילויות — 53 פריטים אבל רק ~27 ייחודיים.  
**תיקון מוצע:** בעת ייצוא "בחר הכל" — לא לאפשר בחירת card + rows של אותו סעיף בו-זמנית.  
**קבצים לבדיקה:** `src/lib/universalTabBulkItems.js`, `src/lib/morningBriefBulkSections.js`

---

### P2 — מפתחות JSON גולמיים דולפים לממשק (High)

**בעיה:** שדות `mood`, `reason`, `crypto` מ-`rawData.sentiment` לא ממופים ב-`SENTIMENT_FIELD_LABELS` ב-`morningBriefDisplay.js`, לכן מגיעים כ-camelCase אנגלי.

**דוגמאות מהפלט:**
```
Mood: מתוח / שלילי        ← צריך: מצב רוח: מתוח / שלילי
Reason: הפיכת המדדים...   ← צריך: סיבה: הפיכת המדדים...
Crypto: דובי מאוד          ← צריך: קריפטו: דובי מאוד
```

**למה חשוב:** משתמש רגיל יראה מפתחות JSON אנגליים — ממשק לא-עברי.  
**תיקון מוצע:** הוסף ל-`SENTIMENT_FIELD_LABELS`:
```js
mood: 'מצב רוח',
reason: 'סיבה',
crypto: 'קריפטו',
```
**קובץ:** `src/lib/morningBriefDisplay.js` → `SENTIMENT_FIELD_LABELS` (שורה ~823)

---

### P3 — כפילות מאקרו — Dixie ו-US10Y (High)

**בעיה:** `itemMergeSignature()` מחפש שדה `name` לחתימה, אבל `specialized.macroFactors` משתמש בשדה `indicator`. התוצאה: merge לא מזהה את הכפילויות.

**דוגמאות:**
```
הדולר (Dixie) · מתחזק ל-101.2 - 101.3   ← מ-rawData.macroFactors (שדה: name)
Dixie · 101.3                              ← מ-specialized.macroFactors (שדה: indicator) — כפילות!

אג"ח · תשואות מרימות ראש                 ← מ-rawData.macroFactors
US10Y · האג"ח מרימים ראש                 ← מ-specialized.macroFactors — כפילות!
```

**למה חשוב:** VIX, Dixie, US10Y מוצגים פעמיים עם שמות שונים — מבלבל.  
**תיקון מוצע:** ב-`itemMergeSignature` — הוסף `item.indicator` לרשימת השדות.  
**קובץ:** `src/lib/morningBriefDisplay.js` → `itemMergeSignature()` (שורה ~79)

```js
// שינוי מוצע:
const id = item.symbol || item.ticker || item.sector || item.event || item.name
  || item.indicator   // ← הוסף זאת
  || item.risk || item.headline || item.title;
```

---

### P4 — מטא-מידע מוצג כתוכן שוק (Medium)

**בעיה:** `extractMarketRegimeCards()` מבצע loop על כל שדות `marketOverview` כולל `date` ו-`context`. שדות אלה הם מטא-מידע על המבזק, לא מצב שוק.

**דוגמאות מהפלט:**
```
תאריך המבזק: 2026-06-30           ← לא תוכן שוק
רקע השוק: יום אחרון לחודש יוני   ← הקשר, לא מצב שוק אקטיבי
```

**למה חשוב:** מבלבל — "תאריך המבזק" לא צריך להיות בסעיף "מצב שוק".  
**תיקון מוצע:** סנן שדות מטא (`date`, `context`) מ-`extractMarketRegimeCards`.  
**קובץ:** `src/lib/morningBriefDisplay.js` → `extractMarketRegimeCards()` (שורה ~308)

---

### P5 — BTC מסומן "Broken" (Medium)

**בעיה:** `keyLevels` של BTC מגיע עם `status: "Broken"` — מפתח פנימי אנגלי שדולף לממשק.  
**פלט בפועל:** `BTC · Broken`  
**צריך להיות:** `ביטקוין · נשבר מתחת ל-60,000`  
**תיקון מוצע:** ב-`TREND_TOKEN_MAP` הוסף:
```js
broken: 'נשבר',
```
**קובץ:** `src/lib/morningBriefDisplay.js` → `TREND_TOKEN_MAP` (שורה ~32)

---

### P6 — חדשות חסרות מ-rawData (Medium)

**בעיה:** `rawData.marketNews` מכיל 3 פריטים, אבל "קוריאה מגדילה השקעות בהייטק" לא מופיע בפלט.  
**סיבה:** `normalizeNewsStrings` ב-`morningBriefBulkSections.js` לוקח רק `headline, title, content, source, impact` — שדה `details` (שבו נמצא הסבר הפריט הזה) לא נכלל.  
**קובץ:** `src/lib/morningBriefBulkSections.js` → `normalizeNewsStrings()` (שורה ~39)

---

### P7 — תשואות ריבעוניות חסרות (Medium)

**בעיה:** `rawData.indices` מכיל שדה `quarterReturn` (+28%, +22%, +16%) אבל הוא לא מוצג בפלט.  
**פלט בפועל:** `NASDAQ · מושך למעלה בפתיחה`  
**יכול להיות:** `NASDAQ · מושך למעלה · +28% ברבעון`  
**קובץ:** `src/lib/morningBriefDisplay.js` → `normalizeMarketDashboardRow()` (שורה ~394)

---

### P8 — הזדמנות AVAV רזה מדי (Medium)

**בעיה:** `extractOpportunityIdeas()` מחזיר "כניסה לאחר דוחות חזקים" בלבד — ללא ticker, ללא rationale.  

**rawData מכיל rationale מלא:**
> "עלתה ב-27%-30% אבל רחוקה מההתנגדות ב-224, יש בשר לעליות ואין מה להרגיש פספוס"

**הבעיה הטכנית:** `formatOpportunityText()` מחבר `title + detail` — אבל ב-rawData שדה ה-rationale נמצא תחת `rationale`, לא `detail/reason/note`, אז הוא לא נכלל.  
**קובץ:** `src/lib/morningBriefBulkSections.js` → `formatOpportunityText()` (שורה ~63)  
**קובץ:** `src/lib/morningBriefDisplay.js` → `normalizeOpportunity()` (שורה ~359) — הוסף `rationale` לרשימת השדות.

---

### P9 — SNDK — מחיר יעד חריג ללא סימון (Low)

**בעיה:** מחיר יעד של SNDK עלה מ-20.73 ל-3,000 — עלייה של 14,400%. לא מסומן כחשוד.  
**פלט:** `SNDK · סנדיסק · אנליסטים העלו מחיר יעד ל-3000 מ-20.73, ניתוח פונדמנטלי הזוי`  
**הערה:** הטקסט הגולמי עצמו מציין "הזוי" — אבל אין סימון ⚠️ אוטומטי.  
**תיקון עתידי מוצע:** זיהוי אוטומטי של שינויי מחיר יעד >500% והוספת prefix ⚠️.

---

### P10 — נורמליזציה של שמות מאקרו (Low)

**בעיה:** שמות אינדיקטורים לא עקביים ולא סטנדרטיים.

| שם בפלט | שם מומלץ |
|---|---|
| Dixie | DXY / מדד הדולר |
| הדולר (Dixie) | DXY / מדד הדולר |
| US10Y | תשואת אג"ח ארה"ב ל-10 שנים |
| אג"ח | לא ברור — US10Y? IL10Y? |
| WTI | נפט WTI ✓ (כבר ברור) |

**קובץ:** `src/lib/marketLabelTranslations.js` — להוסיף:
```js
'Dixie': 'DXY / מדד הדולר',
'US10Y': 'תשואת אג"ח ארה"ב ל-10 שנים',
```

---

## 6. Duplication Analysis

### כפילות מסלול A vs B:

| סעיף | פריטים בכרטיס (A) | פריטים כשורות (B) | כפולים |
|---|---|---|---|
| 📰 חדשות | 2 | 2 (פריטים 9-10) | 2 |
| 📊 מצב שוק | 5 | 5 (פריטים 11-15) | 5 |
| 🎯 הזדמנויות וסיכונים | 5 | 5 (פריטים 16-20) | 5 |
| ⭐ מניות שהוזכרו | 13 | 13 (פריטים 21-33) | 13 |
| 📅 לוח כלכלי | 3 | 3 (פריטים 34-36) | 3 |
| 🌍 מאקרו | 7 | 7 (פריטים 37-43) | 7 |
| 📊 סנטימנט | 4 | 4 (פריטים 44-47) | 4 |
| 📈 שווקים | 6 | 6 (פריטים 48-53) | 6 |
| **סה"כ** | **45** | **45** | **45** |

### כפילות מאקרו פנימית:

| זוג | פריט ראשון | פריט כפול |
|---|---|---|
| Dixie | `הדולר (Dixie) · מתחזק ל-101.2` (פריט 37) | `Dixie · 101.3` (פריט 42) |
| US10Y/אג"ח | `אג"ח · תשואות מרימות ראש` (פריט 39) | `US10Y · האג"ח מרימים ראש` (פריט 43) |

**סיכום:** 53 פריטים → ~27 ייחודיים → יחס כפילות 1:2.

---

## 7. Missing Information Analysis

| מידע חסר | מיקום בנתונים הגולמיים | חומרה |
|---|---|---|
| חדשות קוריאה + הייטק | `rawData.marketNews[1].title` | בינונית |
| תשואות ריבעוניות S&P +16%, Nasdaq +28%, Russell +22% | `rawData.indices[].quarterReturn` | בינונית |
| AVAV rationale מלאה | `rawData.tradingOpportunities[0].rationale` | בינונית |
| ETH keyLevel @ 1,550 | `rawData.keyLevels[2]` | נמוכה |
| 10 tickers מ-watchlist לא מסומנים ככאלה | `rawData.watchlist[]` | נמוכה |
| learningInsights (2 לקחים) | `rawData.learningInsights[]` | נמוכה |
| top5Insights (5 תובנות) | `rawData.top5Insights[]` | נמוכה |
| actionChecklist (3 פעולות) | `rawData.actionChecklist[]` | נמוכה |
| severity של הסיכונים | `rawData.risks[].severity` | נמוכה |

---

## 8. Label/Translation Issues

| פלט נוכחי | צריך להיות | שדה JSON | קובץ לתיקון |
|---|---|---|---|
| `Mood: מתוח / שלילי` | `מצב רוח: מתוח / שלילי` | `sentiment.mood` | `morningBriefDisplay.js:SENTIMENT_FIELD_LABELS` |
| `Reason: הפיכת המדדים` | `סיבה: הפיכת המדדים` | `sentiment.reason` | `morningBriefDisplay.js:SENTIMENT_FIELD_LABELS` |
| `Crypto: דובי מאוד` | `קריפטו: דובי מאוד` | `sentiment.crypto` | `morningBriefDisplay.js:SENTIMENT_FIELD_LABELS` |
| `BTC · Broken` | `ביטקוין · נשבר` | `keyLevels[].status` | `morningBriefDisplay.js:TREND_TOKEN_MAP` |
| `תאריך המבזק: 2026-06-30` | להסיר מסעיף מצב שוק | `marketOverview.date` | `morningBriefDisplay.js:extractMarketRegimeCards` |
| `רקע השוק: יום אחרון לחודש יוני` | להסיר מסעיף מצב שוק | `marketOverview.context` | `morningBriefDisplay.js:extractMarketRegimeCards` |

---

## 9. Macro Normalization Issues

### שורש הבעיה הטכני:

`itemMergeSignature()` ב-[morningBriefDisplay.js](../src/lib/morningBriefDisplay.js) (שורה ~79):
```js
const id = item.symbol || item.ticker || item.sector || item.event || item.name
  || item.risk || item.headline || item.title;
```

- `rawData.macroFactors` משתמש בשדה `name` → חתימה = "הדולר (Dixie)"
- `specialized.macroFactors` משתמש בשדה `indicator` → שדה `name` ריק → חתימה = `JSON.stringify({indicator: "Dixie", ...})`
- שתי החתימות שונות → שני הפריטים עוברים ← **כפילות**

### שמות לא סטנדרטיים:

| שם נוכחי | שם מומלץ |
|---|---|
| Dixie | DXY / מדד הדולר |
| הדולר (Dixie) | DXY / מדד הדולר |
| US10Y | תשואת אג"ח ארה"ב ל-10 שנים |
| אג"ח | ↑ לא ברור (צריך לשייך ל-US10Y) |

---

## 10. Opportunities/Risks Quality Review

### הזדמנויות (1 פריט):

| פריט | איכות | בעיה |
|---|---|---|
| "כניסה לאחר דוחות חזקים" | חלש | חסר: מי? מה הרמה? מה ה-rationale? |

**rawData מכיל rationale מלא:**
> "עלתה ב-27%-30% אבל רחוקה מהתנגדות ב-224, יש בשר לעליות ואין מה להרגיש פספוס"

**הבעיה:** `normalizeOpportunity()` לא קורא שדה `rationale` — רק `reason, description, note, comment, setup, strategy, entry, trigger, catalyst, type`.

### סיכונים (3 פריטים):

| פריט | איכות | הערה |
|---|---|---|
| התחזקות הדולר מעל 101.2 | טוב | ערך ספציפי ✓ |
| שבירת רמות תמיכה בקריפטו | טוב | רלוונטי ✓ |
| עליית מחירי הנפט ל-71$ | טוב | ערך ספציפי ✓ |

**סיכון חסר:** `rawData.keyLevels` מכיל ETH @ 1,550 — לא הופיע כסיכון.

### בעיית עירוב בכרטיס המשולב (פריט 8):

בכרטיס 🎯 הזדמנויות וסיכונים — הזדמנות אחת + 4 סיכונים ברשימה אחת ללא הפרדה ויזואלית.  
בשורות הבודדות (פריטים 16–20) — ההפרדה ל-🎯 ו-⚠️ קיימת ✓.

---

## 11. Recommended Product Rules

1. **אין מפתח JSON גולמי בממשק** — כל שדה חייב מיפוי עברי לפני הצגה.
2. **אין תאריך/הקשר בסעיף מצב שוק** — `date` ו-`context` הם מטא-מידע על המבזק, לא תוכן שוק.
3. **Card + Rows לא ייוצאו יחד** — ייצוא "בחר הכל" = רמה אחת בלבד (card OR rows).
4. **Macro dedup לפי indicator בנוסף ל-name** — `itemMergeSignature` חייב לכלול שדה `indicator`.
5. **שמות קנוניים למאקרו** — `Dixie` → `DXY / מדד הדולר`, `US10Y` → תשואת אג"ח 10 שנים.
6. **status ו-trend ערכים אנגליים → עברית** — `Broken` → `נשבר`, כולל כל ערכי TREND_TOKEN_MAP.
7. **שינוי מחיר יעד >500%** → prefix ⚠️ אוטומטי.
8. **Opportunity rationale חובה** — אם קיים `rationale/setup/ticker` → חייב להופיע ב-detail.
9. **תשואות ריבעוניות** → שדה `quarterReturn` יוצג בשורת מדד כשקיים.
10. **חדשות: כל שדות הטקסט** — `details` בנוסף ל-`headline, title, content`.

---

## 12. Recommended Implementation Plan

| # | תיקון | חומרה | קובץ | שינוי |
|---|---|---|---|---|
| 1 | הוסף `mood`, `reason`, `crypto` ל-`SENTIMENT_FIELD_LABELS` | גבוהה | `morningBriefDisplay.js` | ~3 שורות |
| 2 | הוסף `item.indicator` ל-`itemMergeSignature` | גבוהה | `morningBriefDisplay.js` | 1 שורה |
| 3 | סנן `date` ו-`context` מ-`extractMarketRegimeCards` | בינונית | `morningBriefDisplay.js` | ~3 שורות |
| 4 | הוסף `broken: 'נשבר'` ל-`TREND_TOKEN_MAP` | בינונית | `morningBriefDisplay.js` | 1 שורה |
| 5 | הוסף `rationale` ל-`normalizeOpportunity()` pickString | בינונית | `morningBriefDisplay.js` | 1 שורה |
| 6 | הוסף `details` ל-`normalizeNewsStrings()` | בינונית | `morningBriefBulkSections.js` | 1 שורה |
| 7 | הוסף Dixie/US10Y ל-`marketLabelTranslations.js` | נמוכה | `marketLabelTranslations.js` | ~4 שורות |
| 8 | הוסף `quarterReturn` ל-`normalizeMarketDashboardRow()` | נמוכה | `morningBriefDisplay.js` | ~3 שורות |

**תיקון P1 (כפילות Card+Rows)** — דורש הבנה עמוקה יותר של זרימת הבחירה ב-`universalTabBulkItems.js` לפני יישום.

---

## 13. QA Checklist

לאחר יישום — לבדוק ידנית ב-Base44 Production:

- [ ] יצוא "בחר הכל" מלשונית Specialized → אין כפילויות
- [ ] פריטי סנטימנט → "מצב רוח:", "סיבה:", "קריפטו:" (בעברית)
- [ ] מאקרו → Dixie מופיע **פעם אחת** בלבד
- [ ] מאקרו → US10Y מופיע **פעם אחת** בלבד
- [ ] BTC בלוח שווקים → "נשבר" ולא "Broken"
- [ ] מצב שוק → אין "תאריך המבזק: 2026-06-30"
- [ ] מצב שוק → אין "רקע השוק: יום אחרון..."
- [ ] חדשות → 3 פריטים (כולל קוריאה+הייטק)
- [ ] הזדמנות AVAV → כולל rationale מלא
- [ ] מדד Nasdaq → מוצג "+28% ברבעון" כשזמין
- [ ] SNDK → ⚠️ לפני טקסט מחיר יעד חריג

---

## 14. Suggested Commit Messages

```
fix: add Hebrew labels for mood/reason/crypto in sentiment field map
fix: include indicator field in macro merge deduplication signature
fix: exclude date and context fields from market regime cards
fix: map 'Broken' status token to Hebrew in market trend token map
fix: include rationale field in opportunity normalizer pick list
fix: include details field in news string normalization
feat: add Dixie/US10Y canonical Hebrew labels to market translations
feat: show quarterReturn in market dashboard row text when available
```
