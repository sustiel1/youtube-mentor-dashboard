# Morning Brief Specialized Output — Implemented Fixes
**תאריך יישום:** 2026-06-30
**מבוסס על:** MORNING_BRIEF_SPECIALIZED_OUTPUT_AUDIT.md

---

## סיכום

יושמו 5 תיקוני P מתוך הדוח: P2, P3, P4, P5, P6.
סה"כ 7 שינויי קוד ב-2 קבצים + קובץ תיעוד זה.

---

## קבצים שהשתנו

### src/lib/morningBriefDisplay.js (6 שינויים)

| # | שינוי | P | שורה משוערת |
|---|---|---|---|
| 1 | `TREND_TOKEN_MAP` — הוסף `broken: 'שבור'` | P5 | ~32 |
| 2 | הוסף `REGIME_OVERVIEW_SKIP_KEYS` — set עם `date`, `briefdate`, `timestamp`, `brieftime` | P4 | ~17 |
| 3 | `itemMergeSignature` — הוסף `item.indicator` + normalization של `(EnglishCode)` patterns | P3 | ~83 |
| 4 | `extractMarketRegimeCards` — skip `REGIME_OVERVIEW_SKIP_KEYS` בלולאת marketOverview | P4 | ~350 |
| 5 | `SENTIMENT_FIELD_LABELS` — הוסף `mood`, `reason`, `crypto` | P2 | ~827 |
| 6 | `normalizeOpportunity` — הוסף `rationale` ל-pickString של detail | P6 (opp) | ~374 |

### src/lib/morningBriefBulkSections.js (1 שינוי)

| # | שינוי | P | שורה משוערת |
|---|---|---|---|
| 7 | `normalizeNewsStrings` — הוסף `item.details` למערך השדות | P6 (news) | ~45 |

---

## פירוט כל שינוי

### P2 — תוויות Hebrew לשדות סנטימנט

**לפני:**
```js
const SENTIMENT_FIELD_LABELS = {
  retail: 'סנטימנט קמעונאי',
  ...
};
```

**אחרי:**
```js
const SENTIMENT_FIELD_LABELS = {
  retail: 'סנטימנט קמעונאי',
  ...
  mood: 'מצב רוח',
  reason: 'סיבה',
  crypto: 'קריפטו',
};
```

**תוצאה:** `Mood: מתוח` → `מצב רוח: מתוח`, `Reason: ...` → `סיבה: ...`, `Crypto: ...` → `קריפטו: ...`

---

### P3 — תיקון itemMergeSignature לכלול indicator + normalization

**לפני:**
```js
const id = item.symbol || item.ticker || item.sector || item.event || item.name
  || item.risk || item.headline || item.title;
return id ? String(id) : JSON.stringify(item);
```

**אחרי:**
```js
const id = item.indicator || item.symbol || item.ticker || ...|| item.name || ...;
if (!id) return JSON.stringify(item);
const s = String(id).trim();
const m = /\(([A-Za-z0-9]+)\)$/.exec(s);
return m ? m[1].toUpperCase() : s;
```

**תוצאה:**
- `{indicator: "Dixie", ...}` → sig = `"DIXIE"`
- `{name: "הדולר (Dixie)", ...}` → sig = `"DIXIE"` ✓ — מדוידים עכשיו!
- US10Y / אג"ח: עדיין לא מדוידים (שמות שונים ללא pattern משותף — נדרשת מפת תרגום נפרדת)

---

### P4 — סינון date מסעיף מצב שוק

**הוספה:**
```js
const REGIME_OVERVIEW_SKIP_KEYS = new Set(['date', 'briefdate', 'timestamp', 'brieftime']);
```

**בלולאה:**
```js
if (REGIME_OVERVIEW_SKIP_KEYS.has(key.toLowerCase())) continue;
```

**תוצאה:** `תאריך המבזק: 2026-06-30` לא יופיע יותר בסעיף מצב שוק.
שדה `context` ממשיך להיות מוצג כ-`רקע השוק: ...` (כפי שהיה — translateMarketStatusLabel כבר מטפל בזה).

---

### P5 — תרגום "Broken" לעברית

**לפני:**
```js
const TREND_TOKEN_MAP = { up: 'עלייה', ... };
```

**אחרי:**
```js
const TREND_TOKEN_MAP = { up: 'עלייה', ..., broken: 'שבור' };
```

**תוצאה:** `BTC · Broken` → `BTC · שבור`

---

### P6 — שמירת details בחדשות + rationale בהזדמנויות

**חדשות (`normalizeNewsStrings`):**
```js
// לפני:
[item.headline, item.title, item.content, item.source, item.impact]
// אחרי:
[item.headline, item.title, item.content, item.details, item.source, item.impact]
```

**הזדמנויות (`normalizeOpportunity`):**
```js
// לפני:
pickString(item, 'reason', 'description', 'note', ...)
// אחרי:
pickString(item, 'rationale', 'reason', 'description', 'note', ...)
```

---

## מה לא שונה (במכוון)

| נושא | סיבה |
|---|---|
| P1 — כפילות card/row | שינוי גדול ב-universalTabBulkItems — דחוי לסשן נפרד |
| P7 — quarterReturn | שינוי בלוגיקת normalizeMarketDashboardRow — דחוי |
| P8 — ⚠️ לשינויי מחיר >500% | לוגיקה חדשה מורכבת — דחוי |
| P10 — US10Y/אג"ח dedup | נדרשת מפת canonical — P3 טיפל ב-Dixie בלבד |
| marketLabelTranslations.js | לא נדרש ל-P2-P6 |

---

## תוצאת Build

```
EXIT_CODE=0
dist/index.html ✓
dist/assets/ ✓
```

---

## QA ידני מומלץ ב-Base44 Production

לאחר Pull:

- [ ] סנטימנט → "מצב רוח: ...", "סיבה: ...", "קריפטו: ..." (לא "Mood:", "Reason:", "Crypto:")
- [ ] מצב שוק → אין שורה "תאריך המבזק: ..."
- [ ] מצב שוק → "רקע השוק: ..." עדיין מופיע (context לא נפלט)
- [ ] Dixie → מופיע פעם אחת בלבד (לא כפול עם "הדולר (Dixie)")
- [ ] BTC · שבור (לא "BTC · Broken")
- [ ] הזדמנות AVAV → כולל rationale אם קיים בנתונים
- [ ] קוריאה + הייטק → מופיע בחדשות אם שדה `details` קיים בנתונים
- [ ] שאר הסעיפים (מניות, מאקרו, לוח כלכלי) → עובדים כרגיל

---

## הודעת Commit מוצעת

```
fix: specialized tab labels, macro dedup, and news normalization

- Add Hebrew labels for sentiment fields: mood/reason/crypto (P2)
- Include indicator field in macro merge signature + normalize Hebrew(Code) patterns (P3)
- Exclude date/timestamp from market regime cards (P4)
- Add 'broken' token to TREND_TOKEN_MAP as שבור (P5)
- Add details field to news string normalization (P6-news)
- Add rationale field to opportunity detail normalization (P6-opp)
```
