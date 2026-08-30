# Live‑Stream Market Brief — Permanent vs Daily Knowledge Scheme

> מסמך תכנון בלבד. אין שינוי קוד ללא אישור מפורש.
> עודכן: 2026-08-30 · WORK-ID: `YMD-BRIEF-PERMANENCE-SPLIT`

מטרה: להפריד ידע **קבוע** (כללי מסחר חוזרים, דפוסי סיכון, תובנות שיטה) מתוכן
**יומי/מתכלה** (מניות למעקב, מצב שוק וסנטימנט יומי) בסיכומי "מבזק לייב פתיחה",
כך שספריית הידע ב‑Obsidian לא תצבור רעש מיושן.

---

## 1. ביקורת מצב קיים (Audit)

### 1.1 הצינור הקיים

| רכיב | תפקיד |
|---|---|
| `src/config/videoTabsConfig.js` | זיהוי כותרת וסיווג `morningBrief` |
| `src/lib/morningBriefBulkSections.js` | יצירת סקשני המבזק |
| `src/lib/obsidianVideoMergeItems.js` | הפיכת פריטי בחירה ל‑merge items |
| `src/lib/obsidianNoteMerge.js` | הוספת bullet וסמן זהות, עם dedupe מדויק |
| `src/lib/obsidianVaultMergeWrite.js` | כתיבת merge דרך `/api/vault/write` |
| `src/lib/obsidianItemSaveStore.js` | מעקב שמירה ב‑`yt_obsidian_item_saves_v1` |

`src/lib/obsidianRouting.js` מנתב פתק סרטון מלא (`V-<slug>.md`) ואינו נתיב
שמירת הפריט. `src/lib/obsidianExport.js` הוא הבית של קטלוג התיקיות ובוני הפתקים.
השינוי המתוכנן הוא שכבה מעל הצינור הקיים — לא מנוע ניתוב חדש.

### 1.2 מפת המפיק בפועל

כותרת שמכילה `מבזק לייב פתיחה` מסווגת כיום `morningBrief` ומנותבת ל‑`שוק ההון`.
`buildMorningBriefBulkSections()` מפיק, כאשר יש תוכן, את המפתחות הבאים בדיוק:

| `key` | `sectionLabel` | `tabKey` |
|---|---|---|
| `news` | `📰 חדשות` | `market-news` |
| `market-regime` | `📊 מצב שוק` | `market-regime` |
| `sectors` | `📊 סקטורים` | `brief-sectors` |
| `opportunities` | `🎯 הזדמנויות` | `brief-opportunities` |
| `risks` | `⚠️ סיכונים` | `brief-risks` |
| `stocks-mentioned` | `⭐ מניות שהוזכרו` | `stocks-mentioned` |
| `economic-calendar` | `📅 לוח כלכלי` | `brief-calendar` |
| `macro` | `🌍 מאקרו` | `brief-macro` |
| `sentiment` | `📊 סנטימנט` | `brief-sentiment` |
| `markets` | `📈 שווקים` | `indices` |
| `levels` | `🎚️ רמות מפתח` | `key-levels` |
| `top-insights` | `💡 תובנות מובילות` | `brief-conclusions` |
| `learning-insights` | `🧠 לקחים` | `brief-conclusions` |
| `all-points` | `📌 נקודות נוספות` | `brief-conclusions` |

בנוסף, `buildMorningBriefCardBulkItems()` מפיק מעטפת כרטיס משולבת
`opportunities-risks`, ובוני הסיכום מפיקים `thirty`, `market`, `watch`,
`insights`, `risks`, `checklist`, `full` ו‑`raw` תחת `tabKey: 'summary'`.

**פער שאותר בביקורת:** `buildBulkItemsFromSections()` שומר את `key` רק בתוך `id`;
`bulkEntryToMergeItem()` משתמש ב‑`sectionLabel` בתור `sectionKey`. לכן המפתחות
הקנוניים נעלמים לפני ה‑merge. התכנון מוסיף `briefSectionKey` אופציונלי ושומר את
משמעות `sectionKey` הקיימת ללא שינוי, כדי לא לשבור זהות או רשומות עבר.

### 1.3 סכמת האחסון הקיימת (per‑item)

רשומה ב‑`obsidianItemSaveStore`:

```
{ videoId, tabKey, sectionKey, textHash, textPreview, destinationPath, savedAt }
```

identityKey = `videoId + tabKey + sectionKey + text-hash(60)`.
מפתח הרשומה ב‑store מוסיף גם `@destinationPath`; סמן הפתק אינו כולל נתיב.
ב‑frontmatter של הפתק בלבד: `date`, `source`, `channel`, `topic`, `tags`.
סדר הבלוק הקיים הוא bullet ולאחריו `<!-- obsidian-item:{identityKey} -->`.

### 1.4 מיפוי השדות המוצעים → מה כבר קיים

| שדה מוצע | בית קיים | פער |
|---|---|---|
| `category` | `sectionLabel` / `tabKey` (`brief-*`) | קיים, אך ה‑`key` הקנוני נזרק |
| `date` | `frontmatter.date` בלבד — לא ברמת פריט | ⚠️ להוסיף לרשומה + ל‑bullet |
| `ticker` | קיים רק בתוך הטקסט | ⚠️ שדה חדש, אופציונלי |
| `text` | גוף ה‑bullet | ✅ |
| `source` (channel/video) | `frontmatter.channel` + `videoId` ברשומה | ✅ חלקי |
| `permanence` | — | ⚠️ **חדש — עיקר התוספת** |
| `expiry` | — | ⚠️ חדש, ל‑daily בלבד |

### 1.5 מסקנה — הרחבה, לא קטגוריה חדשה

המבזק כבר מנותב ל‑`שוק ההון` ולסקשנים נכונים. מה שחסר הוא **שכבת permanence**
מעל צינור המיזוג הקיים. אין צורך במנוע ניתוב חדש ואין צורך ב‑store מקביל.

---

## 2. חוזה העיצוב הסופי

### 2.1 יעדים קבועים

1. **Permanent — פתק פלייבוק עומד יחיד**
   `שוק ההון/ספריית ידע/צ'קליסטים/פלייבוק מסחר.md`
2. **Daily — פתק ארכיון מתוארך**
   `שוק ההון/מבזקים/{date}.md`, כאשר `{date}` הוא תאריך המבזק בפורמט
   `YYYY-MM-DD`, לא יום ביצוע סריקת התפוגה.

במימוש עתידי תתווסף רק הרשומה `שוק ההון/מבזקים` ל‑
`OBSIDIAN_FOLDER_CATALOG['שוק ההון']`; תיקיית `צ'קליסטים` כבר קיימת.

### 2.2 הרחבת `obsidianItemSaveStore`

ממשיכים להשתמש ב‑`yt_obsidian_item_saves_v1`. כל השדות החדשים אופציונליים;
רשומה ישנה שחסרים בה השדות נשארת שמורה ותקינה.

| שדה חדש | סוג | כלל וערך חסר |
|---|---|---|
| `briefSectionKey?` | `string` | מפתח קנוני מטבלה 2.4; `undefined` ברשומה ישנה |
| `date?` | `string` | תאריך מקור `YYYY-MM-DD`; `undefined` אם אין תאריך אמין |
| `ticker?` | `string` | ticker יחיד, מאומת מהשדה המובנה ומנורמל ל‑uppercase; לא מחלצים בטקסט חופשי |
| `permanence?` | `'permanent' \| 'daily'` | לפי 2.4 או override; חסר ברשומה ישנה |
| `expiry?` | `string` | היום הראשון שבו הפריט פג, `YYYY-MM-DD`; חסר ל‑permanent ולרשומה ישנה |
| `sourceChannel?` | `string` | שם הערוץ כפי שנשמר במטא הסרטון; `undefined` אם אינו זמין |

`sectionKey`, מפתח הזהות ומפתח הרשומה הקיימים אינם משנים משמעות. לפריט מבזק חדש
`briefSectionKey`, `date` ו‑`permanence` הם חובה לוגית אצל המפיק, אך נשארים
אופציונליים בסכמה כדי לשמור תאימות לאחור.

הכרעת `date`: תאריך מפורש ומאומת מכותרת/סכמת המבזק → `publishedAt` תקין → תאריך
השמירה ב‑`Asia/Jerusalem`. אין קריאת רשת לצורך ההכרעה.

### 2.3 סמן `ymd-meta` האדיטיבי

בלוק חדש נכתב בסדר הבא, בלי לשנות את סמן הזהות:

```html
* לעולם לא להגדיל פוזיציה מפסידה — [[V-slug|2026-08-30]]
<!-- obsidian-item:vid123:brief-risks:ab12cd -->
<!-- ymd-meta:v1 briefSectionKey=risks permanence=permanent date=2026-08-30 expiry=- ticker=- sourceChannel=%D7%A2%D7%A8%D7%95%D7%A5 -->
```

חוזה השורה מדויק:

- שורה אחת מיד אחרי `obsidian-item`, בסדר השדות המוצג.
- ערכים עוברים UTF‑8 `encodeURIComponent`; `-` מציין ערך חסר.
- `v1` הוא גרסת פורמט הסמן בלבד ואינו מפתח storage חדש.
- `identityKey` אינו כולל אף שדה חדש; `includes(existingMarker)` נשאר מנגנון
  ה‑dedupe היחיד ב‑v1.
- אם dedupe מוצא סמן ישן, הוא מדלג על הפריט כולו ואינו מבצע backfill ל‑meta.
  הסריקה תדווח `missing-meta` ולא תנחש.

### 2.4 טבלת ברירת המחדל הסופית

`expiry` הוא היום הראשון שבו הפריט אינו פעיל; פריט daily פג כאשר
`today >= expiry`. חישוב תאריך הוא date-only. “5 ימי מסחר” ב‑v1 פירושו חמישה
ימי שני–שישי אחרי `date`, ללא שירות חיצוני וללא לוח חגים; המשתמש רשאי לתקן ידנית.

| `briefSectionKey` | מפיק | ברירת מחדל | יעד | `expiry` |
|---|---|---|---|---|
| `news` | specialized | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `market-regime` | specialized | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `sectors` | specialized | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `opportunities` | specialized | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `risks` | specialized | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `stocks-mentioned` | specialized | daily | `מבזקים/{date}.md` | אחרי 5 ימי שני–שישי |
| `economic-calendar` | specialized | daily | `מבזקים/{date}.md` | היום שאחרי תאריך האירוע; fallback: `date + 1` |
| `macro` | specialized | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `sentiment` | specialized | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `markets` | specialized | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `levels` | specialized | daily | `מבזקים/{date}.md` | אחרי 5 ימי שני–שישי |
| `top-insights` | specialized | permanent | פלייבוק › `נכנס לאחרונה — טרם מיזוג` (יעד קנוני: `תובנות שיטה`) | — |
| `learning-insights` | specialized | permanent | פלייבוק › `נכנס לאחרונה — טרם מיזוג` (יעד קנוני: `תובנות שיטה`) | — |
| `all-points` | specialized | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `opportunities-risks` | כרטיס משולב | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `summary:thirty` | summary | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `summary:market` | summary | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `summary:watch` | summary | daily | `מבזקים/{date}.md` | אחרי 5 ימי שני–שישי |
| `summary:insights` | summary | permanent | פלייבוק › `נכנס לאחרונה — טרם מיזוג` | — |
| `summary:risks` | summary | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `summary:checklist` | summary | permanent | פלייבוק › `נכנס לאחרונה — טרם מיזוג` | — |
| `summary:full` | summary | daily | `מבזקים/{date}.md` | `date + 1` יום |
| `summary:raw` | fallback `summaryShort` | daily | `מבזקים/{date}.md` | `date + 1` יום |

הטבלה כוללת את כל 14 המפתחות שמפיק `buildMorningBriefBulkSections()`, את מפתח
הכרטיס המשולב ואת כל מפתחות הסיכום. מפתח מבזק לא מוכר מקבל fallback שמרני:
`daily`, יעד מתוארך ו‑`expiry = date + 1`.

`opportunities` ו‑`risks` הם daily כברירת מחדל מפני שהמפיק הנוכחי מתאר בדרך כלל
הזדמנות או סיכון של היום. כלל חוזר מתוכם יכול להיות מקודם ידנית ל‑permanent.

### 2.5 התנהגות ה‑save-picker

- לא שואלים בכל שמירה. ה‑picker מציג את ברירת המחדל מהטבלה ומאפשר toggle מפורש
  בין `יומי` ל‑`קבוע`.
- שינוי ל‑daily מחשב מחדש יעד ו‑expiry; שינוי ל‑permanent מסיר expiry ומנתב
  לאזור ההמתנה בפלייבוק.
- override משנה רק `permanence`, יעד ו‑expiry. הוא אינו משנה `date`, `ticker`,
  `sourceChannel`, `briefSectionKey`, הטקסט או identity.
- מסלול בחירת נתיב ידני נשאר אפשרי. daily שנשמר בפתק לא‑מתוארך יזוהה בסריקה.
- כל טקסט UI חדש בעברית וב‑RTL.

---

## 3. פלייבוק, קידום ותפוגה

### 3.1 מבנה פתק הפלייבוק

הפתק היחיד נשמר ב‑`שוק ההון/ספריית ידע/צ'קליסטים/פלייבוק מסחר.md` ובסדר H2
יציב זה:

```markdown
# פלייבוק מסחר

## נכנס לאחרונה — טרם מיזוג
## צ'קליסט פתיחת יום
## כללי ניהול סיכונים
## דפוסי סיכון חוזרים
## תובנות שיטה
```

כל פריט permanent חדש נכנס תחילה ל‑`## נכנס לאחרונה — טרם מיזוג`, עם backlink
לסרטון, תאריך, סמן זהות ו‑`ymd-meta`. אין auto‑merge של כמעט‑כפילויות.

מפת הסקירה הידנית מה‑`sectionLabel`/`briefSectionKey` אל H2 קנוני:

| מקור | H2 קנוני לאחר אישור אנושי |
|---|---|
| `summary:checklist`; `צ'קליסט פעולה`; `📋 צ'קליסט פעולה` | `צ'קליסט פתיחת יום` |
| כלל סיכון מפורש מתוך `risks` / `summary:risks` | `כללי ניהול סיכונים` |
| דפוס חוזר מתוך `risks`; `⚠️ סיכונים`; `⚠️ סיכונים מרכזיים` | `דפוסי סיכון חוזרים` |
| `summary:insights`; `top-insights`; `learning-insights`; `תובנות מרכזיות`; `💡 תובנות מובילות`; `🧠 לקחים`; `💡 התובנות החשובות ביותר` | `תובנות שיטה` |
| `opportunities` או `opportunities-risks` שקודמו ידנית | `צ'קליסט פתיחת יום`, רק אחרי פיצול ואישור |
| כל מקור אחר | נשאר באזור ההמתנה עד שהסוקר בוחר H2 |

כרטיס משולב אינו מקודם כיחידה בלי ביקורת: הסוקר מפצל סיכון והזדמנות ושומר לכל
bullet את סמן המקור. הטקסט המובנה נשמר כפי שהוצג; ticker או זהות סקשן אינם
נזרקים, וערכי enum/status נשמרים רק עם התווית המאומתת שלהם. אין מונה חזרות או
שכתוב אוטומטי ב‑v1.

### 3.2 מנגנון daily, ארכיון ותפוגה

- ברירת המחדל כותבת daily ישירות ל‑`שוק ההון/מבזקים/{date}.md`; הפתק המתוארך
  הוא הארכיון הקבוע ושום פתק או bullet אינם נמחקים.
- הטריגר שנבחר הוא **כפתור DEV**, לא סקריפט אוטומטי. Vault API נשאר dev-only.
- לחיצה ראשונה `בדיקת תפוגה` היא read-only ומציגה: מועמדים, יעד ארכיון,
  `missing-meta`, אי‑התאמה בין store לסמן ופריטים שכבר אורכבו.
- פעולה שנייה ונפרדת `ארכב פריטים שפגו` דורשת אישור מפורש. היא פועלת רק על
  daily שפג ונמצא בפתק לא‑מתוארך: מעתיקה את הבלוק לפתק `{date}.md` אם סמן
  הזהות אינו קיים שם, ומשאירה ליד המקור tombstone אדיטיבי:

```html
<!-- ymd-expired:v1 archivedTo=%D7%A9%D7%95%D7%A7%20%D7%94%D7%94%D7%95%D7%9F%2F%D7%9E%D7%91%D7%96%D7%A7%D7%99%D7%9D%2F2026-08-30.md expiredOn=2026-08-31 -->
```

- “ארכב” פירושו copy + tombstone, לא move מוחק. הרצה חוזרת מזהה את ה‑tombstone
  ומדווחת `already-archived`.
- הסריקה מתחילה מהמועמדים ב‑item store, אך לפני כתיבה מאמתת בפתק את סמן הזהות
  ואת `ymd-meta`. רשומה ישנה, meta חסר או אי‑התאמה נכנסים לדוח בלבד.
- הסריקה לעולם אינה נוגעת ב‑`פלייבוק מסחר.md`, אינה מוחקת תיקייה ואינה משנה
  פריט `permanent`.

### 3.3 מפת צרכנים מלאה

| שדה / סמן | מפיק ו‑save-picker | `obsidianNoteMerge` / dedupe | אינדיקטור saved/expired | סריקת תפוגה |
|---|---|---|---|---|
| `briefSectionKey` | נשמר מהמפתח הקנוני; קובע default | נכתב ל‑meta; לא נכנס לזהות | אינו משנה saved; מסביר מקור | מאמת התאמה ל‑meta ו‑fallback |
| `date` | מוכרע פעם אחת ואינו משתנה ב‑override | נכתב ל‑meta; dedupe מתעלם | מוצג כהקשר בלבד | קובע את פתק הארכיון |
| `ticker` | רק משדה מובנה מאומת; אחרת חסר | נכתב ל‑meta; dedupe מתעלם | אינו משנה saved/expired | מועתק כ‑provenance; אינו תנאי סריקה |
| `permanence` | default מהטבלה או toggle | בוחר path/H2 ונכתב ל‑meta; לא בזהות | חסר/`permanent` נשאר saved; `daily` עשוי להיות expired | רק `daily` הוא מועמד; permanent תמיד מוחרג |
| `expiry` | מחושב מחדש אחרי toggle | נכתב ל‑meta; dedupe מתעלם | `today >= expiry` ⇒ `נשמר — פג תוקף`; עדיין saved | תנאי הסף לסריקה |
| `sourceChannel` | מועתק ממטא הסרטון | נכתב מקודד ל‑meta; dedupe מתעלם | אינו משנה סטטוס | נשמר בהעתקת הארכיון בלבד |
| `ymd-meta` | נבנה מאותם ערכים שנרשמו ב‑store | נכתב אחרי סמן הזהות; `includes()` בודק רק `obsidian-item` | אין קריאת Vault; הסטטוס מגיע מה‑store | נדרש לאימות לפני apply; חסר ⇒ report-only |

לשמירת תאימות, `isObsidianItemSaved()` ממשיך להחזיר `true` גם לפריט שפג.
הצרכנים שמציגים סטטוס משתמשים ברשומה המלאה ומוסיפים מצב `expired`; bulk status
נשאר “נשמר” ומקבל בנוסף מונה/תווית של פריטים שפג תוקפם. רשומה ישנה בלי
`permanence` או `expiry` נשארת `saved`, לעולם לא `expired` אוטומטית.

---

## 4. אילוצים מחייבים

- אין מנוע ניתוב חדש, אין store מקביל. שימוש חוזר:
  `mergeItemsIntoObsidianNote`, `obsidianVaultMergeWrite`, `/api/vault/*`,
  `obsidianItemSaveStore`, `OBSIDIAN_FOLDER_CATALOG`.
- אין localStorage key חדש ואין שינוי במשמעות מפתח הזהות הקיים.
- תיקיות חדשות = רק הרשומה `מבזקים` ב‑`OBSIDIAN_FOLDER_CATALOG['שוק ההון']`;
  הפלייבוק חי תחת `צ'קליסטים` הקיים.
- כל טקסט UI בעברית RTL.
- Vault API ל‑dev בלבד (Risk #10 ב‑`SAVE_SYSTEM_ARCHITECTURE.md`) — המגבלה נשארת.
- אין שינוי ב‑`ytmdbOriginMigrationController.js`, ב‑`ytmdbOriginStorageManifest.js`
  או ב‑key-count assertions של `storageManifest.js`.
- הגדרות ה‑AI המוגנות (`vite.config.js` / `VideoDetailPanel.jsx`) אינן משתנות.
- אין קריאת AI/GEMS בסיווג permanence או בסריקת התפוגה.
- אין flatten או merge שמאבדים ticker, מפתח סקשן, תווית enum או provenance.
- אין מחיקה. גם תיקון ידני משאיר סמן מקור; ניקוי תיקייה אינו חלק מהעיצוב.

---

## 5. חמש החלטות סגורות

1. **פלייבוק יחיד עם H2 יציבים.** נימוק: נקודת עיון אחת, ללא פיצול מוקדם של
   ידע מועט. פיצול עתידי דורש החלטת עיצוב חדשה.
2. **ברירת מחדל לפי טבלה 2.4 + toggle, לא שאלה בכל שמירה.** נימוק: זרימה מהירה
   עם override גלוי ו‑fallback שמרני ל‑daily.
3. **כמעט‑כפילויות עוברות תור סקירה ידני.** נימוק: ניסוח דומה אינו זהות סמנטית,
   ומיזוג אוטומטי עלול למחוק provenance או משמעות.
4. **סריקת תפוגה מופעלת מכפתור DEV דו‑שלבי.** נימוק: report-only לפני mutation,
   אישור מפורש, וללא תלות בתזמון או שירות חיצוני.
5. **`live stream market analysis` הוא alias כותרת נפרד, אך לא פורמט נתונים או
   מנוע נפרד.** במימוש עתידי תתווסף רק המחרוזת המדויקת והמנורמלת
   `live stream market analysis` ל‑`MORNING_BRIEF_KEYWORDS`; לא מוסיפים keyword
   רחב `market analysis`. לאחר הזיהוי הוא מסווג `morningBrief` ועובר באותו צינור.

---

## 6. זהות עבודה ומצב

- WORK-ID: `YMD-BRIEF-PERMANENCE-SPLIT`
- Branch: `feat/brief-permanence-split`, נוצר ישירות מ‑`main`.
- `docs/work-ledger.md` קיים בענף; משימת התכנון אינה משנה אותו.
- מצב: עיצוב נסגר במסמך זה; מימוש, QA ו‑commit עדיין דורשים אישור מפורש.
- בעל מימוש עתידי: `obsidian-sync-engineer`; התאמת UI RTL לאחר מכן.

---

## 7. שלבים עתידיים — כל שלב דורש אישור נפרד

| שלב | תוכן | אימות עתידי |
|---|---|---|
| Phase 1 — עיצוב | המסמך הזה | סקירה עריכתית מול סעיפים 1–5 |
| Phase 2 — סכמה וסמן | שדות אופציונליים + `ymd-meta` אדיטיבי | QA ממוקד לתאימות ול‑dedupe |
| Phase 3 — מיפוי ו‑UI | שימור `briefSectionKey`, טבלת defaults ו‑toggle RTL | QA של producer→consumer ושל override |
| Phase 4 — תחזוקה | כפתור DEV דו‑שלבי, report-only ואז archive copy+tombstone | fixture בלבד; הוכחת zero-delete ו‑playbook untouched |

במשימת התכנון הנוכחית לא מוסיפים או מריצים `scripts/*-qa.mjs`, build או lint.
