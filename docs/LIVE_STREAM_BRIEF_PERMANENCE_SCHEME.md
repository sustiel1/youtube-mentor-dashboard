# Live‑Stream Market Brief — Permanent vs Daily Knowledge Scheme

> מסמך תכנון בלבד. אין שינוי קוד ללא אישור מפורש.
> נוצר: 2026-08-30 · WORK-ID מוצע: `YMD-BRIEF-PERMANENCE-SPLIT`

מטרה: להפריד ידע **קבוע** (כללי מסחר חוזרים, דפוסי סיכון, תובנות שיטה) מתוכן
**יומי/מתכלה** (מניות למעקב היום, סנטימנט היום) בסיכומי "מבזק לייב פתיחה"
החוזרים, כך שספריית הידע ב‑Obsidian לא תצבור רעש מיושן.

---

## 1. ביקורת מצב קיים (Audit)

### 1.1 שני מנועי ניתוב

| מנוע | תפקיד | פלט |
|---|---|---|
| `src/lib/obsidianRouting.js` | ניתוב ברמת סרטון לפי טקסונומיה | `{category}/{subCategory}/V-{slug}.md` |
| `src/lib/obsidianExport.js` | קטלוג תיקיות סמנטי + חוקי מילות מפתח + בוני פתקים | `OBSIDIAN_FOLDER_CATALOG`, `FOLDER_KEYWORD_RULES`, `CATEGORY_TO_TOPIC`, `resolvePrimaryTopic()`, `ATOMIC_FIELD_TO_FOLDER`, `GEMS_V2_SECTION_PATHS` |

מנוע המיזוג (משותף לכל שמירת פריט): `src/lib/obsidianNoteMerge.js` →
`mergeItemsIntoObsidianNote()` — סמני HTML comment `<!-- obsidian-item:{identityKey} -->`,
הוספת bullet תחת `## sectionLabel`, dedupe לפי הסמן. כתיבה דרך
`/api/vault/write?mode=merge` (`obsidianVaultMergeWrite.js`), מעקב ב‑
`obsidianItemSaveStore` (`yt_obsidian_item_saves_v1`, localStorage).

### 1.2 המבזק כבר ממופה

כותרת שמכילה `מבזק לייב פתיחה` → מסווגת `morningBrief` (ראה
`docs/MORNING_BRIEF_GEMS_ROUTING.md`) → נתיב `שוק ההון`.
`buildMorningBriefBulkSections()` (`src/lib/morningBriefBulkSections.js`) כבר מייצר
בדיוק את הקטגוריות שבמשימה:

| קטגוריה במשימה | section key | sectionLabel | tabKey |
|---|---|---|---|
| Watch Today / מניות | `stocks-mentioned`, `levels` | ⭐ מניות שהוזכרו / 🎚️ רמות מפתח | `stocks-mentioned`, `key-levels` |
| Risks | `risks` | ⚠️ סיכונים | `brief-risks` |
| Key Insights | `top-insights`, `learning-insights` | 💡 תובנות מובילות / 🧠 לקחים | `brief-conclusions` |
| Action Checklist | `opportunities` + לקחים ניתנים לפעולה | 🎯 הזדמנויות | `brief-opportunities` |
| Market State | `market-regime`, `sentiment`, `markets`, `macro` | 📊 מצב שוק / 📊 סנטימנט / 📈 שווקים / 🌍 מאקרו | `brief-*` |
| 30‑Second / Full Summary | `summary` (ב‑`collectVideoObsidianMergeItems`) | 📝 סיכום | `summary` |

הפריטים כבר עוברים דרך `collectVideoObsidianMergeItems()` →
`mergeItemsIntoObsidianNote()`. **הצינור קיים ופעיל** (אומת: `morningBriefBulkSections`
→ `obsidianVideoMergeItems` → `obsidianNoteMerge`).

### 1.3 סכמת האחסון הקיימת (per‑item)

רשומה ב‑`obsidianItemSaveStore`:

```
{ videoId, tabKey, sectionKey, textHash, textPreview, destinationPath, savedAt }
```

identityKey = `videoId + tabKey + sectionKey + text-hash(60)`.
ב‑frontmatter של הפתק בלבד: `date`, `source`, `channel`, `topic`, `tags`.

### 1.4 מיפוי השדות המוצעים → מה כבר קיים

| שדה מוצע | בית קיים | פער |
|---|---|---|
| `category` | `sectionLabel` / `tabKey` (`brief-*`) | ✅ קיים |
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

## 2. התוספת המוצעת (עיצוב בלבד)

### 2.1 שתי יעדים קבועים בתוך הקטלוג הקיים

1. **Permanent → פתק פלייבוק עומד יחיד**
   `שוק ההון/ספריית ידע/צ'קליסטים/פלייבוק מסחר.md`
   עם H2 יציבים: `## צ'קליסט פתיחת יום`, `## כללי ניהול סיכונים`,
   `## דפוסי סיכון חוזרים`, `## תובנות שיטה`.
   (כל התיקיות כבר קיימות ב‑`OBSIDIAN_FOLDER_CATALOG['שוק ההון']`.)

2. **Daily/ephemeral → פתק מתוארך**
   `שוק ההון/מבזקים/YYYY-MM-DD.md` — תבנית שם `YYYY-MM-DD.md` כבר נתמכת
   ב‑`generateDailyNote()`. נדרש רק להוסיף `'שוק ההון/מבזקים'` לקטלוג.
   פריטי watch יכולים לחלופין ללכת ל‑`שוק ההון/רשימות מעקב` הקיים.

### 2.2 הרחבת סכמת הרשומה (תואם לאחור — כל השדות אופציונליים)

```
{ …הקיים…, date?, ticker?, permanence?: 'permanent'|'daily', expiry?, sourceChannel? }
```

ברירת מחדל: **לא** `'daily'` גורף. `permanence` נקבע לפי טבלת 2.4, עם אפשרות
override ידני ב‑save‑picker.

### 2.3 הרחבת הסמן (marker) — אדיטיבי ובטוח

שומרים את `<!-- obsidian-item:{identityKey} -->` (dedupe לא משתנה) ומוסיפים
שורת מטא שנייה שהמנוע הנוכחי מתעלם ממנה (`includes()` בלבד):

```html
<!-- obsidian-item:vid123:brief-risks:ab12cd -->
* אף פעם לא להגדיל פוזיציה מפסידה — [[V-slug|2026-08-30]]
<!-- ymd-meta: permanence=permanent; date=2026-08-30; ticker=; ttl= -->
```

### 2.4 ברירת מחדל של permanence לפי סקשן

| סקשן (section key) | permanence ברירת מחדל | יעד | expiry |
|---|---|---|---|
| `opportunities` (Action Checklist) | permanent | פלייבוק › צ'קליסט פתיחת יום | — |
| `risks` | permanent (override ל‑daily אם "היום…") | פלייבוק › דפוסי סיכון חוזרים | — |
| `learning-insights` / `top-insights` (שיטה) | permanent | פלייבוק › תובנות שיטה | — |
| `stocks-mentioned` / `levels` (Watch Today) | daily | מבזק מתוארך / רשימות מעקב | +5 ימי מסחר |
| `market-regime` / `sentiment` / `markets` / `macro` | daily | מבזק מתוארך | +1 יום |
| `economic-calendar` | daily | מבזק מתוארך | תאריך האירוע |
| `summary` (30‑Second / Full) | daily, לא מקודם | מבזק מתוארך | ארכיון עם הפתק |

---

## 3. קידום / מיזוג — תכנון

### 3.1 Permanent → פלייבוק עומד

- בשמירה עם `permanence:'permanent'`, פריט המיזוג מנותב לפתק הפלייבוק במקום
  לפתק המתוארך, **דרך אותו** `mergeItemsIntoObsidianNote()`. `sectionLabel` ממופה
  ל‑H2 יציב בפלייבוק.
- **Dedupe מדויק**: סמן הזהות כבר מונע הוספה חוזרת.
- **כמעט‑כפילויות** (אותו כלל מנוסח אחרת בימים שונים): **תור סקירה ידני**, לא
  auto‑merge. bullets חדשים נוחתים תחת `## נכנס לאחרונה (לא ממוזג)` עם תאריך
  `ymd-meta`; מעבר ידני/תקופתי ("מזג פלייבוק", אולי כפתור DEV בהמשך) מקדם אותם
  לסקשן הקנוני ומכווץ כפילויות.
  נימוק — `lessons.md` 2026-07-28 / 2026-08-25: לא לשטח/למזג ידע מובנה בלי לשמר
  provenance ובלי שער אנושי.
- **Provenance**: כל bullet מקודם שומר backlink `— [[V-<slug>|<date>]]`.
- **מונה חזרות**: אם הטקסט כבר קיים, במקום skip בלבד — לאפשר `(נצפה גם ב‑<date>)`
  או bump ל‑count ב‑`ymd-meta`. כלל שחוזר = ביטחון גבוה.

### 3.2 Daily → תפוגה / ארכוב

- פריטים יומיים נכתבים ל‑`שוק ההון/מבזקים/YYYY-MM-DD.md`. **הפתק המתוארך הוא
  הארכיון — שום דבר לא נמחק.**
- `expiry` נשמר ב‑`ymd-meta` וב‑item store. סריקה תקופתית (תכנון:
  `scripts/obsidian-brief-expiry-sweep.mjs`, opt‑in, או כפתור DEV) עושה **דיווח
  קריאה‑בלבד קודם**: מאתרת bullets שפג תוקפם ויושבים בפתק **לא‑מתוארך** (למשל
  בטעות ב‑רשימות מעקב), מעבירה אותם לפתק היום, ומשאירה tombstone
  `<!-- expired: moved to מבזקים/YYYY-MM-DD -->`. **לעולם לא נוגעת בפלייבוק.**
  נימוק — `lessons.md` 2026-08-30: אין מחיקה רקורסיבית; tombstone במקום delete.
- `obsidianItemSaveStore` מקבל `permanence`/`expiry` כדי שאינדיקטור ה"נשמר"
  יוכל להציג "פג תוקף" בלי סבב לוולט.
- **Rollup שבועי** (אופציונלי, בהמשך): `generateWeeklyRecapNote()` → `W-YYYY-WW.md`
  כבר קיים. מחוץ ל‑scope של v1.

---

## 4. אילוצים / שימוש בתשתית קיימת

- אין מנוע ניתוב חדש, אין store מקביל. שימוש חוזר:
  `mergeItemsIntoObsidianNote`, `obsidianVaultMergeWrite`, `/api/vault/*`,
  `obsidianItemSaveStore`, `OBSIDIAN_FOLDER_CATALOG`.
- תיקיות חדשות = רק רשומות ב‑`OBSIDIAN_FOLDER_CATALOG['שוק ההון']`
  (`מבזקים`; הפלייבוק חי תחת `צ'קליסטים` הקיים).
- כל טקסט UI בעברית RTL.
- Vault API ל‑dev בלבד (Risk #10 ב‑`SAVE_SYSTEM_ARCHITECTURE.md`) — המגבלה נשארת.
- הגדרות ה‑AI המוגנות (`vite.config.js` / `VideoDetailPanel.jsx`) — לא נגועות.

---

## 5. שאלות פתוחות לאישור לפני מימוש

1. פלייבוק יחיד עם H2, או פתק‑לכל‑קטגוריה (סיכון / שיטה / צ'קליסט)?
   המלצה: להתחיל ב‑**יחיד** `פלייבוק מסחר.md`, לפצל רק אם יגדל.
2. ברירת מחדל ל‑permanence כשהמשתמש לא מסווג — טבלת 2.4 + toggle override,
   או לשאול תמיד? המלצה: ברירת מחדל לפי סקשן + override.
3. כמעט‑כפילויות: auto‑merge או תור סקירה ידני? המלצה: ידני ל‑v1.
4. סריקת תפוגה: סקריפט אוטומטי או כפתור DEV? המלצה: כפתור DEV + דו"ח
   קריאה‑בלבד קודם.
5. "live stream market analysis" = אותו "מבזק לייב פתיחה" (morningBrief), או
   פורמט ערוץ נפרד? אם נפרד — עדיין משתמש באותו צינור דרך keyword כותרת חדש.

---

## 6. WORK-ID מומלץ + שורת work-ledger מוצעת

**WORK-ID:** `YMD-BRIEF-PERMANENCE-SPLIT` — status: `proposed`
(פורמט `YMD-<SLUG>` תואם `src/lib/gemsImportDiagnosticReport.js`).

**`docs/work-ledger.md` לא קיים.** מוצע ליצור אותו עם השורה (המשתמש מוסיף ידנית):

```
| WORK-ID | task summary | assigned tool | status | branch / worktree | last updated |
|---|---|---|---|---|---|
| YMD-BRIEF-PERMANENCE-SPLIT | Split live-stream brief items into permanent playbook vs daily expiring Obsidian notes | Claude Code | proposed | feat/brief-permanence-split (ליצירה מ-main) | 2026-08-30 |
```

הענף הנוכחי `docs/markdown-governance-cleanup` אינו קשור — מומלץ ענף חדש
`feat/brief-permanence-split` מ‑`main`.

**ניתוב מימוש עתידי** (אחרי אישור): `architect-reviewer` לאישור גבול הרחבת‑הסכמה →
`obsidian-sync-engineer` למימוש → `frontend-rtl-developer` ל‑override ב‑save‑picker →
`qa-release-reviewer` לפני commit.

---

## 7. שלבים (כל שלב דורש אישור נפרד)

| שלב | תוכן |
|---|---|
| Phase 1 — עיצוב | המסמך הזה. ✅ |
| Phase 2 — סכמה | שדות אופציונליים ב‑`obsidianItemSaveStore` + כותב `ymd-meta` ב‑`obsidianNoteMerge` (אדיטיבי) + `scripts/obsidian-permanence-qa.mjs` |
| Phase 3 — מיפוי | טבלת ברירת‑מחדל סקשן→permanence + UI override ב‑save‑picker |
| Phase 4 — תחזוקה | סקשן holding בפלייבוק + כפתור DEV לדו"ח תפוגה (קריאה‑בלבד) |
