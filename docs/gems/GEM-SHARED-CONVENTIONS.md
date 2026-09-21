# GEM-SHARED-CONVENTIONS

**WORK-ID:** TRADINGBRAIN-CROSS-GEM-DEDICATED-CONTENT-RULE
**מטרת הקובץ:** רשימה יחידה של כל מושג/שם-שדה ש**חייב** להישאר זהה בין כל ה-GEMs הקיימים והעתידיים בנושא שוק-ההון (פונדמנטלי, מבזק, טכני, אלגו) — **רק** עבור מושגים משותפים (shared concepts). **זה לא מסמך של יישור-שמות (key-renaming)** — אינו דורש ואינו מציע לשנות שום שם-שדה קיים בקוד או בהוראות. מטרתו למנוע מצב שבו GEM עתידי (טכני/אלגו) בוחר שם-שדה חדש/דומה-אך-שונה למושג שכבר יש לו שם מוסכם, וכך יוצר כפילות-תיעוד/פיצול-קוד מיותר.

---

## עקרון-העל

כשתוכן ב-GEM חדש ממלא **תפקיד זהה** למושג שכבר מוגדר ומיושם באחד מה-GEMs הקיימים — יש להשתמש **באותו שם-שדה בדיוק ובאותה צורת-אובייקט בדיוק**, לא בשם/צורה "דומים". כשהתוכן הוא **דומיין-ספציפי** ל-GEM החדש (אין לו מקבילה קיימת) — מותר וצפוי שם-שדה חדש; אין חובה "לדחוס" תוכן חדש לתוך שם-שדה קיים רק כדי לעמוד בכלל הזה.

---

## 1. `stockFundamentals` / `stockTechnicals` — תוכן ייעודי לפי טיקר (טאב 7)

**מקור-האמת:** `docs/gems/GEM-FUNDAMENTAL-INSTRUCTIONS.md` שורות 81-133 (`stockFundamentals`), ומשוכפל **מילולית זהה** ב-`docs/gems/GEM-BRIEF-INSTRUCTIONS.md` "תוספת 2" (כולל `stockTechnicals`).

צורת-פריט מחייבת (שני השדות):

```json
{
  "ticker": "AAPL",
  "company": "Apple",
  "metric": "מכפיל עתידי",
  "value": 34.3,
  "interpretation": "התנגדות היסטורית — שיא 10 שנים",
  "asOf": "2026-09-09",
  "sourceQuote": "מכפיל הרווח העתידי של אפל עומד היום על 34.3",
  "estimatedStartSeconds": 470,
  "timestampKind": "estimated",
  "liveDataAvailable": true,
  "liveDataNote": "מכפיל רווח עדכני מנתוני שוק"
}
```

- `stockTechnicals`: זהה במבנה, `metric` → `levelType`.
- שדות-חובה (שניהם): `ticker`, `metric`/`levelType`, `value`.
- **גייט RULE 1 (חוצה-נושא):** חילוץ מותנה **רק בעדות** (מדד/רמה+ערך+טיקר אמיתיים+`sourceQuote`), **לא** בהתאמת-נושא-מרכזי לסרטון — חל על כל GEM, ללא יוצא מן הכלל. ר' `docs/gems/GEM-TECHNICAL-PREP-NOTES.md` §6 ו-`docs/gems/GEM-ALGO-PREP-NOTES.md` §2 לניסוח המלא.

## 2. `liveDataAvailable` / `liveDataNote` — דגל נתון בר-רענון

**מקור-האמת:** `docs/gems/GEM-FUNDAMENTAL-INSTRUCTIONS.md` שורות 110-117, זהה ב-`GEM-BRIEF-INSTRUCTIONS.md` "תוספת 2".

- שני שדות **חובה** בכל שורת `stockFundamentals`/`stockTechnicals` — לעולם לא מושמטים בשקט (בשונה משדות-הזמן).
- `liveDataAvailable` (`true`/`false`): מסווג לפי **טבע המדד**, לא לפי זמינות-פיד בפועל. `true` — נתון שוק/פיננסי אובייקטיבי ובר-ציטוט שמקור חי מפרסם על בסיס שוטף (מחיר/מכפיל/EPS/רמה טכנית מספרית/נפח). `false` — תוכן פרשני-נרטיבי.
- `liveDataNote`: כש-`true` — סוג-המקור במילים פשוטות; כש-`false` — "לא רלוונטי — פרשנות ולא נתון מתעדכן" או ניסוח דומה.

## 3. `methodologicalRules` — כלל-מסחר חוזר, מובנה-predicate

**מקור-האמת:** `docs/gems/GEM-FUNDAMENTAL-INSTRUCTIONS.md` שורות 222-263 (חטיבת "חילוץ כללי מסחר (פיילוט)"), זהה ב-`GEM-BRIEF-INSTRUCTIONS.md` "תוספת 1".

צורת-פריט מחייבת: `{ ruleName, entryCondition, invalidationCondition, exitCondition, scopeOfApplicability, requiredMeasurement, confidenceLanguage, source, extractionType }`.

צורת אובייקט-תנאי (predicate), לשלושת מערכי-התנאי:

```json
{
  "indicator": "שם המדד/האינדיקטור/התנאי כפי שנאמר",
  "comparator": "> | < | >= | <= | == | חוצה-מעלה | חוצה-מטה | מצב-איכותי",
  "value": null,
  "unit": null,
  "timeframe": "לא צוין",
  "assetType": "מניה",
  "rawPhrase": "הניסוח המדויק כפי שנאמר בתמלול",
  "thresholdDefined": false
}
```

- `extractionType` קבוע: `"methodologicalRule"` (בנפרד: `"observation"` ל-`marketObservations`, שדה-אח שאינו ברשימת המושגים-המשותפים-חובה כאן — ספציפי לפיילוט הפונדמנטלי כיום).
- כלל אנטי-המצאה מוחלט לשדה `value`/`thresholdDefined`: תנאי איכותי-בלי-מספר → `comparator:"מצב-איכותי"`, `value:null`, `thresholdDefined:false` — לעולם לא סף מומצא.

## 4. 7 טאבי-UI קבועים (`UNIVERSAL_TABS`)

**מקור-האמת:** מנגנון-אפליקציה קבוע (`VideoDetailPanel.jsx:3042,10341`), **לא** שדה שה-GEM כותב. כל GEM עתידי פועל מול אותם 7 טאבים קבועים בממשק (סיכום / פרקים / תובנות / ידע שימושי / APP / נושאים ותתי-נושאים / תוכן ייעודי) — ללא תלות באיזה נתיב-JSON (flat vs. `universalTabs` היברידי) ה-GEM שלו משתמש בו כדי להגיע אליהם (ר' טבלת-ההתאמה בסעיף 6 למטה). **אסור** ל-GEM עתידי להמציא שם-טאב שמיני או לשנות את סדר-7-הטאבים.

## 5. עקרון אנטי-המצאה / zero-inference — חל על כל מושג משותף כאן, ללא יוצא מן הכלל

אף אחד מארבעת המושגים למעלה, וגם לא RULE 1 (חוצה-נושא) או RULE 2 (שמות-אחידים) עצמם — **אינם** מקלים בשום צורה על כלל האנטי-המצאה הבסיסי החל על כל GEM בפרויקט: אסור להמציא מספר/טיקר/תאריך/ציטוט שלא נאמרו בפועל בתמלול; עדיף להשמיט שדה/שורה מאשר לנחש; `sourceQuote` חייב להיות ציטוט מילולי אמיתי. RULE 1 מרחיב **רק** את היקף-הנושא שממנו מותר לחלץ (לא תלוי בנושא-מרכזי-תואם) — הוא **אינו** מרחיב את סף-הראיה הנדרש לכל שורה בודדת.

---

## 6. טבלת-התאמה אינפורמטיבית: `universalTabs` (מבזק) ↔ שדות-שורש (פונדמנטלי)

**⚠️ לידע בלבד — לא task של יישור-שמות.** הטבלה הזו **מתעדת התאמה מושגית**, כדי שמי שעובד על שני ה-GEMs יבין ששני מבנים שונים-בקוד מזינים בפועל את אותם 7 טאבי-UI. **אין** לשנות שום שם-מפתח קיים ב-`universalTabs` של המבזק כדי "להתאים" לשמות-השדה השטוחים של הפונדמנטלי, ולהפך — שני המבנים נשארים כפי שהם, כל אחד תקף במלואו לנתיב-הקליטה שלו בקוד.

| טאב-UI | מפתח `universalTabs` (מבזק, מקונן) | שדה-שורש (פונדמנטלי, שטוח) |
|---|---|---|
| 1. סיכום | `universalTabs.summary.shortSummary`/`.fullSummary` | `shortSummary`/`fullSummary` (גם ברמת-שורש למבזק, בכפילות מכוונת) |
| 2. פרקים | `universalTabs.chapters` | `chapters` |
| 3. תובנות | `universalTabs.insights.top5Insights`/`.learningInsights`/... | `keyInsights` |
| 4. ידע שימושי | `universalTabs.usefulKnowledge.reusableKnowledge`/`.actionChecklist`/`.rules`/... | `usefulKnowledge`/`checklists`/`mistakesToAvoid`/`frameworks`/`financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates` |
| 5. APP | `universalTabs.appBuilder.*` | *(אין — לא נגיש דרך JSON שטוח לפונדמנטלי כיום)* |
| 6. נושאים ותתי-נושאים | `universalTabs.topicsSubtopics.tags` | `tags` |
| 7. תוכן ייעודי | `stockFundamentals`/`stockTechnicals` (ברמת-שורש אצל שניהם — **לא** מקונן תחת `universalTabs.specialized`, ר' `GEM-BRIEF-INSTRUCTIONS.md` "תיקון-ממצא") | `stockFundamentals`/`stockTechnicals` — **שם-שדה זהה לחלוטין, לא רק מושג-מקביל** |

שים לב: שורה 7 היא היוצא-מן-הכלל בטבלה הזו — שם-השדה **כבר זהה במלואו** בין שני ה-GEMs (זה בדיוק מה שסעיף 1 למעלה מתעד כחובה), בעוד ששאר השורות (1-6) הן שני מבנים-שונים-במכוון שמזינים את אותו טאב-UI, לא שני שמות של אותו דבר.

---

## מסמכים מקשרים (cross-link, לא כפילות-תוכן)

- `docs/gems/GEM-FUNDAMENTAL-INSTRUCTIONS.md` — מקור-האמת המקורי לצורת `stockFundamentals`/`liveDataAvailable`/`methodologicalRules`.
- `docs/gems/GEM-BRIEF-INSTRUCTIONS.md` — ההטמעה השנייה, מאומתת-זהה.
- `docs/gems/GEM-TECHNICAL-PREP-NOTES.md` §6 — RULE 1/RULE 2 כעקרונות-קבע לג'ם הטכני העתידי.
- `docs/gems/GEM-ALGO-PREP-NOTES.md` §2-3 — אותם עקרונות, לג'ם האלגו העתידי.

## Changelog

- **2026-09-15, WORK-ID `TRADINGBRAIN-CROSS-GEM-DEDICATED-CONTENT-RULE` (`gem-architect`):** קובץ חדש — נוצר לפי בקשת-משתמש מפורשת (RULE 2) לרכז את רשימת המושגים-המשותפים-חובה בין כל ה-GEMs, כולל טבלת-ההתאמה האינפורמטיבית מול `universalTabs`. מסמכים בלבד, אפס שינוי קוד.
