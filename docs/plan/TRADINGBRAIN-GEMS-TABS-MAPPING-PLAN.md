# TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN

**WORK-ID:** TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN
**סוג מסמך:** תכנון בלבד — אין קוד שהשתנה כתוצאה ממסמך זה
**נסקר מול:** `youtube-mentor-dashboard`, branch `feat/saved-market-rows-table`, HEAD `1c0df6d0d126931bfec6330e9fdfc4e6aa88087c` (לא זז לאורך כל הביקורת — נבדק פעמיים)
**תאריך:** 2026-08-31

---

## הערת מתודולוגיה

המסמך הזה נכתב **אך ורק מקריאה ישירה של הקוד החי** בעץ הנוכחי (לא מסמך אחר). הניסיון לקרוא את מסמך ה-cross-session מ-`C:\Users\11\AppData\Local\Temp\ymd-brief-permanence-codex-20260830\docs\LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md` נכשל — הנתיב לא קיים בסביבה הזו (`NOT FOUND`, נבדק ב-Bash). לכן כל טבלה, כל `file:line`, וכל מסקנה במסמך זה מבוססים על קריאה ישירה שלי בקבצי המקור, לא על אותו מסמך. זה למעשה חיזוק לדרישה "לאמת בעצמך" — לא הייתה ברירה אחרת.

בנוסף למבזק עצמו, התגלה בדרך מסמך governance קיים שהוא כמעט "source of truth" מוכן לחלק גדול מהשאלה הזו: **`docs/governance/STOCK_ANALYSIS_SCREEN_BIBLE.md`** — הוא כבר מגדיר `technical-analysis` ו-`fundamental-analysis` כ"מסכים" עצמאיים לצד `macro`, `morning-brief` וכו', עם routing, GEM key, Obsidian path ו-Brain SubBrain משלהם. המסמך הזה **מאשש** את רוב מה שנמצא כאן, אבל גם חושף אי-התאמות פנימיות בתוך עצמו (ראו סעיף 3.4).

---

## 1. איך מבזק הבוקר/הערב עובד היום — בפירוט שניתן להעתיק

### 1.1 ארכיטקטורת-העל: טאב אחד קבוע, לא טאב-בר לפי סוג

**ממצא מרכזי ומאומת:** לאפליקציה יש **7 טאבים אוניברסליים קבועים לכל סרטון** (`UNIVERSAL_TABS`, נגזר מ-`VIDEO_ANALYSIS_HEADINGS` ב-`src/config/workspaceHeadingRegistry.js:81-83`, נצרך ב-`src/config/videoTabsConfig.js:160-164`). זה לא רק מוסכמה — זה **כלל מחייב מתועד**:

> `docs/governance/USER_PRODUCT_INTENT_AND_FUTURE_VISION.md` §5: *"Exactly 7 tabs, fixed order, every video — no exceptions. Tab 7 (specialized) is the only category-specific surface."* וב-§8 טבלת Hard Stops: #1 "7 Universal Tabs — fixed order" ו-Soft Stop #5 "Adding 8th universal tab — Architectural invariant violation".

זה מאומת גם בקוד עצמו — `src/components/dashboard/VideoDetailPanel.jsx:10127`, ההערה מעל ה-`TabsList` אומרת מילולית: `{/* ── Universal 7-tab bar — same for every video (Phase 1) ── */}`.

**המשמעות הקריטית לתכנון:** קיימת מערכת ישנה ומקבילה של מערכי טאבים ייעודיים-לפי-סוג בתוך `videoTabsConfig.js` — `LEARNING_TABS`, `TECHNICAL_TABS` (שורות 186-197), `FUNDAMENTAL_TABS` (199-211), `MACRO_TABS` (213-224), `MORNING_BRIEF_TABS` (226-235), `EVENING_BRIEF_TABS` (237-246), `WEEKLY_BRIEF_TABS` (248-257), `EARNINGS_BRIEF_TABS` (259-268), `POLITICAL_TABS` (270-280), ופונקציית הבחירה `getTabsForVideo()` / `getTabsBySubTopic()` (305-341) שמחזירה אותם. **וידאתי ב-grep רחב על כל `src/` שלמערכים האלה ולפונקציות `getTabsForVideo`/`getTabsBySubTopic` אין אף צרכן חיצוני מחוץ ל-`videoTabsConfig.js` עצמו** — הן קוד מת ביחס לבחירת טאב-הבר בפועל. `STOCK_ANALYSIS_SCREEN_BIBLE.md:562` טוען שהמערכים "used for extraction, badges, AiMappingModal" — זו **אי-התאמה מתועדת בין הקוד לתיעוד** שיש לדווח עליה (לפי הכלל של אותו מסמך עצמו: "if implementation and documentation differ, report the contradiction"). מה שכן חי: **אוצר המילים** (`'indicators'`, `'setups'`, `'financial-metrics'` וכו') שהמערכים האלה הגדירו פעם, משוכפל כמחרוזות ידניות בתוך `SpecializedContentRenderer.jsx` (ראו 1.3).

**מסקנה לתכנון TABS:** הוספת טאב עליון שמיני (Technical / Fundamental / General) **סותרת פוזיטיבית כלל Hard-Stop מתועד**. כל תכנון סביר חייב לממש את "תצוגה בטאבים לפי סוג" **בתוך טאב 7 (תוכן ייעודי)**, לא לצידו.

### 1.2 שרשרת הזיהוי לפני שמגיעים ל-Tab 7

```
video.title/category/subCategory/contentType
        │
        ├─► detectVideoType(video)                    [videoTabsConfig.js:81-109]
        │     → 'political' | 'eveningBrief' | 'morningBrief' | 'learning' | 'general'
        │     (השוואת מחרוזת-משנה .includes() על מקבצי מילות-מפתח בעברית+אנגלית)
        │
        ├─► normalizeSubCategory(video.subCategory)    [videoTabsConfig.js:42-68]
        │     → 'technical-analysis' | 'fundamental-analysis' | 'macro' |
        │       'morning-brief' | 'evening-brief' | 'weekly-brief' |
        │       'earnings-brief' | 'political' | null
        │     (התאמת מחרוזת מדויקת בלבד מול SUB_CATEGORY_SLUG_MAP)
        │
        └─► effectiveBriefSlug (VideoDetailPanel.jsx:2695-2700)
              = briefDisplayClassification?.slug
                ?? normalizedSubCategory
                ?? (marketBriefData?.contentType === 'marketBrief' ? 'morning-brief' : null)
```

`effectiveBriefSlug` (או `normalizedSubCategory` כ-fallback) מוזרם כ-prop `normalizedSubCategory` ל-`SpecializedContentRenderer` (VideoDetailPanel.jsx:12491-12494) — זה ה-**router האמיתי** של טאב 7.

### 1.3 הראוטר האמיתי: `SpecializedContentRenderer.jsx`

קובץ מרכזי בן 439 שורות, `switch`-בסגנון if-chain על `slug`:

| טווח שורות | `slug` | מה קורה |
|---|---|---|
| 105-123 | `'fundamental-analysis'` | 6 sections קבועים: `financial-metrics`, `valuation`, `analysis-frameworks`, `investment-checklist`, `mistakes`, `checklists` — דרך `DedicatedContentSection` |
| 126-143 | `'technical-analysis'` | 5 sections קבועים: `indicators`, `setups`, `patterns`, `checklists`, `mistakes` |
| **146-159** | `'morning-brief' \|\| 'evening-brief'` | **תופס את שתי הערכים** → `MorningBriefDashboard` (9 קומפוננטות מוערמות, ללא תת-טאבים) |
| **162-222** | `'evening-brief'` (שוב) | **מת — לא ניתן להגיע לכאן לעולם**, ראו ממצא 3.1 למטה |
| 225-287 | `'weekly-brief'` | 12 sections ייעודיים inline |
| 290-350 | `'earnings-brief'` | 11 sections ייעודיים inline |
| 352-365 | macro (`slug==='macro'` **או** `marketBriefData.contentType==='market' && universalTabs קיים`) | `MacroGemDashboard` (קומפוננטה נפרדת, `MacroGemDashboard.jsx:2392+`) |
| 368-408 | `'political'` | 9 sections פוליטיים |
| 410-438 | **ברירת מחדל (הכל האחר)** | רשימה שטוחה מעורבת: `trading-brain`, `indicators`, `setups`, `patterns`, `checklists`, `mistakes`, `valuation`, `financial-metrics`, `cause-effect`, `market-impact` — **טכני ופונדמנטלי מעורבבים יחד ללא הפרדה** |

כל ענף משתמש בעטיפה משותפת `sect()`/`Section()` → `DedicatedContentSection.jsx` (73 שורות) → `SectionCard` (מ-`MorningBriefVisualPrimitives.jsx`) + `LearningTabContent` לרינדור הפריטים בפועל, ו-`renderBulkShell()` הרושם items ל-`TabBulkItemsRegistrar` לצורך בחירה מרובה. **זו נקודת השימוש-החוזר המרכזית** — כל היכולת החדשה חייבת לעבור דרך `DedicatedContentSection`/`sect()`, לא לבנות רינדור מקביל.

**ממצא באג מאומת (לא קשור למשימה, אבל היכולת TABS תיגע באותו קוד ממש):**
בשורה 146 התנאי `slug === 'morning-brief' || slug === 'evening-brief'` **תופס ומחזיר (`return`) עבור evening-brief לפני** שהקוד מגיע לענף הייעודי בשורה 162 (`if (slug === 'evening-brief')`), שמכיל טיפול עשיר ושונה לגמרי (📊 סקירת שוק, 📰 עדכוני שוק, 🌍 מאקרו, 📊 ביצועי סקטורים, 🔄 מה השתנה היום, 📅 אירועי מחר, 📅 לוח כלכלי, 🎯 רשימת מעקב, 💡 הזדמנויות, ⚠️ סיכונים — 11 sections). כלומר **מבזקי ערב תמיד מוצגים היום דרך `MorningBriefDashboard` (עיצוב הבוקר), והענף הייעודי לערב הוא קוד מת**. `STOCK_ANALYSIS_SCREEN_BIBLE.md:180-227` מתעד את ה-evening-brief הזה כאילו הוא רץ בפועל — עוד אי-התאמה תיעוד-מול-קוד.

### 1.4 סכימת ה-GEM (universalTabs.specialized)

`src/ai/gemini/schemas/morningBriefSchema.js` (75 שורות) — הצורה הקנונית שכל GEM מבזק בוקר אמור להחזיר:

```
contentType: "marketBrief"
universalTabs: {
  summary, chapters, insights, usefulKnowledge, appBuilder, topicsSubtopics,
  specialized: {
    indices[], marketNews[], stocksMentioned[], macro[],
    sentiment[], calendar[], opportunities[], risks[]
  }
}
```

בפועל, בזמן ריצה, `resolveSpecialized()`/`getSpecializedSrc()`/`mergeMorningBriefSpecializedSource()` (`morningBriefDisplay.js:140-200`, `videoTabsConfig.js:350-356`) ממזגות 3 שכבות: `universalTabs.specialized` (מועדף) ← `rawData` (fallback ← שם השדות הישנים) ← שדות flat ברמת השורש (legacy). כל שדה מערך (`SPECIALIZED_MERGE_ARRAY_KEYS`, `morningBriefDisplay.js:56-78`, כ-40 שמות שדה) עובר union לפי חתימת-זהות (`itemMergeSignature`), לא clobbering.

### 1.5 טבלת section-key → sectionLabel → tabKey (הטבלה הקנונית — אומתה ישירות מהקוד)

זה ה"מקור אמת" עבור בחירה מרובה/ייצוא בטאב הספציאלייזד של מבזק בוקר, מ-`buildMorningBriefBulkSections()` ב-`src/lib/morningBriefBulkSections.js:211-309`:

| `key` | `label` (עברית) | `tabKey` |
|---|---|---|
| `news` | 📰 חדשות | `market-news` |
| `market-regime` | 📊 מצב שוק | `market-regime` |
| `sectors` | 📊 סקטורים | `brief-sectors` |
| `opportunities` | 🎯 הזדמנויות | `brief-opportunities` |
| `risks` | ⚠️ סיכונים | `brief-risks` |
| `stocks-mentioned` | ⭐ מניות שהוזכרו | `stocks-mentioned` |
| `economic-calendar` | 📅 לוח כלכלי | `brief-calendar` |
| `macro` | 🌍 מאקרו | `brief-macro` |
| `sentiment` | 📊 סנטימנט | `brief-sentiment` |
| `markets` | 📈 שווקים | `indices` |
| `levels` | 🎚️ רמות מפתח | `key-levels` |
| `top-insights` | 💡 תובנות מובילות | `brief-conclusions` |
| `learning-insights` | 🧠 לקחים | `brief-conclusions` |
| `all-points` | 📌 נקודות נוספות | `brief-conclusions` |

כל שורה הופכת ל-`{id, text, sectionLabel, type, tabScope}` דרך `resolveMorningBriefSectionChildItems()` ומוזנת ל-selection/save UI המשותף (`universalTabBulkItems.js`).

### 1.6 itemType / הפורמטרים

`videoTabsConfig.js` מכיל פורמטרים ייעודיים לכל צורת item: `formatWatchlistItem()` (458-482), `formatMacroItem()` (488-517), `formatNewsItem()` (593-608), `formatSectorItem()` (619-632) — כולם סובלניים לכל string/object, אף פעם לא זורקים, מחזירים `''` כשאין תוכן אמיתי. `extractUnifiedStocks()` ב-`morningBriefDisplay.js:1445-1529` מאחד stocks מ-4 מקורות (stocksMentioned/opportunities/risks-שמזכירים-טיקר/news-שמזכיר-טיקר) לרשומה אחת פר טיקר עם `category` (`opportunity`/`watchlist`/`risk`/`general`, מדורג ב-`CATEGORY_RANK`).

### 1.7 שכבת ה-6 מרנדרי-שורות השמורות

מאומת ישירות מ-`src/lib/workspaceRowSelection.js:2-4` (הערת התיעוד בקובץ עצמו): *"the six saved-rows renderers (AnalysisList, SavedMarketRowsTable, SavedStockRowsTable, SavedSectorRowsTable, SavedOpportunityRowsTable, SavedNewsRows)"*.

| קומפוננטה | קובץ | קלט |
|---|---|---|
| `AnalysisList` | `src/components/shared/AnalysisContentPrimitives.jsx` | רשימת טקסט כללית (ה-fallback הגנרי) |
| `SavedMarketRowsTable` | `src/components/workspace/SavedMarketRowsTable.jsx` (136 שורות) | פרסור `parseMarketRowFromText` → טבלת נכס/מגמה/עוצמה/הערה |
| `SavedStockRowsTable` | `src/components/workspace/SavedStockRowsTable.jsx` | דומה, למניות |
| `SavedSectorRowsTable` | `src/components/workspace/SavedSectorRowsTable.jsx` | דומה, לסקטורים |
| `SavedOpportunityRowsTable` | `src/components/workspace/SavedOpportunityRowsTable.jsx` | הזדמנויות (וגם fallback ל-"הזדמנויות" שלא תואם Layer-1, לפי הערה ב-`SavedNewsRows.jsx:9-11`) |
| `SavedNewsRows` | `src/components/workspace/SavedNewsRows.jsx` (238 שורות) | כרטיסי חדשות עם chip נושא + entity links + טון |

כל ה-6 חולקים helper בחירה יחיד — `rowSelectionProps()` ב-`workspaceRowSelection.js:33-43` — הבחירה מבוססת `recordIds` (מזהי הרשומה הנשמרת), לא אינדקס שורה ויזואלית.

### 1.8 מיפוי סיווג פריטים קיים ברמת-הפריט (תקדים ישיר ל-MAPPING)

`src/lib/detectMarketEntityType.js` (130 שורות) **כבר מסווג כל item בודד** ל־`'stock'|'etf'|'index'|'commodity'|'crypto'|'macro'|'sector'|'sentiment'|'unknown'` (שורות 93-129), על בסיס `item.type`/`item.sectionLabel`/טיקר-בטקסט/סמל TradingView. זה בדיוק התבנית — "סיווג ברמת-הפריט, לא רק ברמת-הווידאו" — ש-MAPPING צריכה להרחיב, לא להמציא מחדש.

---

## 2. מצב נוכחי של שלוש היכולות והפער למטרה

### 2.1 GEMS (שכבת Gemini)

**קיים:** `src/ai/gemini/gemContentRouter.js` (335 שורות) — `CONTENT_TYPES = {MARKET_BRIEF, MACRO, DAILY_TRADING, FUNDAMENTAL, GENERAL, POLITICAL}` (32-39). שימו לב: **`fundamental` כבר existing כ-contentType מלא**, אבל "טכני" מיוצג בתור `DAILY_TRADING` (לא `TECHNICAL`) — שם שונה מכל שאר המערכת. `CONTENT_TYPE_TO_GEM` (55-62) ממפה `dailyTrading → 'technical'` (gemKey), אז ברמת ה-*label* המונח "טכני" קיים, אבל ברמת ה-*contentType constant* השם הפנימי שונה. `GEM_PROMPT_CONFIG_TABLE` (121-176) קובע ש**כל** contentType שוק ההון (marketBrief/macro/dailyTrading/fundamental) מפנה לאותה שלישיית prompt/schema/validator (`promptBuilderKey: 'market'`, `schemaKey: 'market'`, `validatorKey: 'market'`) — כלומר **אין כרגע schema נפרד לטכני מול פונדמנטלי מול מאקרו ברמת ה-JSON שחוזר מ-Gemini** — כולם חולקים את אותה סכימת `market` שטוחה (לא `universalTabs.specialized` העשיר; זה שמור ל-morningBrief בלבד לפי ההערה בסכימה: "morningBrief is different: canonical universalTabs-only contract").

**הפער:** אין שדה `contentClass`/סיווג-משנה על כל item בתוך פלט ה-GEM. `resolveContentClassification()` (213-268) מסווגת **וידאו שלם**, לא items בודדים בתוכו. כדי ש-GEMS "יפיקו פלט מובחן וטוב-טיפוס לכל class" (כפי שהמשימה מבקשת), צריך להוסיף שדה סיווג ברמת ה-item בתוך ה-schema/validator — הרחבה תוספתית (לא שוברת) של הדפוס הקיים ב-`stocksMentioned[]` וכו' (הוספת מפתח כמו `contentClass` לכל אובייקט item, בדיוק כמו ש-`importance`/`impact` כבר קיימים ב-schema כשדות אופציונליים).

### 2.2 TABS (תצוגה)

**קיים:** תשתית ה-Tab-7 המתוארת בסעיף 1.3 **כבר תומכת בשני מהשלושה classes באופן ישיר** — `technical-analysis` ו-`fundamental-analysis` הם ענפים קיימים, שלמים, עם sections ייעודיים ותוויות עברית. **גם macro** מקבל טיפול נפרד (`MacroGemDashboard`). מה שחסר הוא "class שלישי" מפורש ל"תוכן שוק כללי" — היום זה הענף **ברירת-המחדל** (410-438) שמערבב טכני+פונדמנטלי+מאקרו יחד ללא הפרדה ויזואלית.

**הפער:** (א) אין דרך "לעבור" בין 3 ה-classes בתוך וידאו יחיד שמכיל את כולם (למשל מבזק בוקר — שמכיל גם התייחסות טכנית, גם פונדמנטלית, גם מאקרו) — היום מבזק בוקר מציג הכול מוערם ברצף אחד (`MorningBriefDashboard`, ללא תתי-טאבים פנימיים). (ב) הענף ברירת-המחדל לא מפריד class כלל.

### 2.3 MAPPING (סיווג + ניתוב)

**קיים — וזה הממצא המרכזי של הביקורת:** יש **כבר שלושה** מסווגים חופפים חלקית בקוד, כולם מבוססי keyword-count על title/topic/transcript, ואף אחד מהם לא מזין ישירות את שני האחרים בעקביות:

| מסווג | קובץ | פלט |
|---|---|---|
| `resolveContentClassification()` | `gemContentRouter.js:213-268` | `contentType` (לבחירת prompt/schema Gemini) |
| `classifyVideoForGem()` / `preGemClassifier()` | `gemRecommender.js:331-459, 585-659` | `gemKey`, `recommendedCategoryLabel`, `recommendedSubCategory` (ל-UI המלצת GEM + הצעת category/subCategory) |
| `detectVideoType()` | `videoTabsConfig.js:81-109` | `videoType` (לבחירת TAB SET — אבל היום כל השלושה (טכני/פונדמנטלי/מאקרו) נופלים יחד תחת `'learning'`!) |

**באג-קונקרטי שנמצא ואומת (לא היה מתועד בשום מקום):** `gemRecommender.js`'s `GEM_CATEGORY_MAP.fundamental` (177-187) מציע `defaultSubCategory: 'ניתוח שוק'` ו-`subCategoryRules` עם תוויות `'ניתוח יסודי'`, `'בחירת מניות'`, `'ניתוח שוק'` — **אף אחת מהן לא תואמת** למחרוזת היחידה ש-`videoTabsConfig.js`'s `SUB_CATEGORY_SLUG_MAP` (42-62) מזהה בתור `fundamental-analysis`, שהיא **בדיוק** `'פונדמנטלי'`. כלומר: גם כשה-AI recommender **מזהה נכון** שסרטון הוא פונדמנטלי ומציע subCategory, הערך שהוא מציע **לעולם לא** יגרום ל-`getTabsBySubTopic()`/ל-`SpecializedContentRenderer`'s ה-`'fundamental-analysis'` branch להיבחר — הענף הייעודי, השלם, קיים בקוד **בפועל לא-נגיש** דרך זרימת ההמלצה האוטומטית. עבור `technical`: ה-`defaultSubCategory` (`'ניתוח טכני'`) כן תואם, אבל שני חוקי המשנה (`'פרייס אקשן'`, `'אסטרטגיות מסחר'`) לא — כך שגם כאן יש שביר-נגישות חלקית. זה **בדיוק** סוג הפער ש-MAPPING אמורה לסגור, ואישוש חד-משמעי לכך שה"3 מחלקות" כבר *קיימות רעיונית* בקוד — רק לא מקושרות אמין.

**הפער:** MAPPING חסרה שכבת-איחוד: מסווג אחד אמין (מודל או קוד) שהתוצאה שלו **מיושרת מילולית** מול `SUB_CATEGORY_SLUG_MAP`, מול `GEM_PROMPT_CONFIG_TABLE`, ומול קטלוג התיקיות ב-Obsidian (ראו 2.4) — ולא שלושה מסווגים עצמאיים עם מילון תוויות שונה כל אחד.

### 2.4 ניתוב Obsidian

שני מנועי ניתוב מקבילים (מתועד היטב ב-`.claude/agents/obsidian-sync-engineer.md`, ואומתי ישירות):
- **Taxonomy route** — `obsidianRouting.js:42-69` בונה `${category}/${subCategory}` **מילולית** מ-`video.category`/`video.subCategory`.
- **Keyword/catalog route** — `obsidianExport.js`'s `OBSIDIAN_FOLDER_CATALOG`/`FOLDER_KEYWORD_RULES`.

**הקטלוג כבר מכיל תיקיות נפרדות לכל class:** `שוק ההון/ניתוח טכני` (`obsidianExport.js:60`, ותואם ל-`שוק ההון/ספריית ידע/ניתוח טכני:43`), `שוק ההון/מאקרו` (49, 64). **אבל הפונדמנטלי סובל משיבוש-שם משולש:**

| מקור | שם התיקייה שמופיע |
|---|---|
| `obsidianExport.js:48` (ספריית ידע) | `שוק ההון/ספריית ידע/פונדמנטלי` |
| `obsidianExport.js:57` (top-level) | `שוק ההון/ניתוח פונדמנטלי` |
| `STOCK_ANALYSIS_SCREEN_BIBLE.md:447` (מסמך אחד) | `שוק ההון/פונדמנטלי` |
| `STOCK_ANALYSIS_SCREEN_BIBLE.md:508` (**אותו מסמך**, "planned hierarchy") | `שוק ההון/ניתוח פונדמנטלי` |
| `SUB_CATEGORY_SLUG_MAP` (videoTabsConfig.js:47) | הערך היחיד המוכר: `'פונדמנטלי'` |

כלומר: אם MAPPING תגדיר `video.subCategory = 'פונדמנטלי'` (הערך היחיד ש-`SUB_CATEGORY_SLUG_MAP` מכיר), ה-taxonomy route תיצור אוטומטית `שוק ההון/פונדמנטלי` — **תיקייה רביעית, שונה משלוש הקיימות**. זה בדיוק התרחיש שמתועד כ"פער ידוע" ב-`.claude/agents/obsidian-sync-engineer.md` (Known gap #5: "A routing target that misspells a Hebrew folder name creates a silent sibling folder") — כאן זוהה **מופע קונקרטי, מדויק, לפני שקרה בפועל**.

**הפער:** MAPPING **חייבת** לבחור שם קנוני יחיד (המלצה: `שוק ההון/ניתוח פונדמנטלי`, כי זה השם שכבר "פיזית קיים" לפי `obsidianExport.js:57` ומופיע ב"planned hierarchy" הרשמי) ולתקן את שאר המקומות אליו, **לפני** שמפעילים ניתוב אוטומטי מבוסס subCategory.

### 2.5 שכבת סיווג-נלווה נוספת (item-level, כבר קיימת)

`detectMarketEntityType.js` (סעיף 1.8 למעלה) — סיווג item ל-`stock/etf/index/commodity/crypto/macro/sector/sentiment` — **לא** מסווג טכני מול פונדמנטלי, אלא סוג-הישות. שימושי כתשומה משלימה (item שמסווג כ-`stock` עם `context` שמדבר על "רמת תמיכה/RSI" הוא כנראה `technical`; item עם "P/E, רווח רבעוני" הוא כנראה `fundamental`) אך **לא** תחליף לסיווג class עצמו.

---

## 3. ממצאים וסיכונים

כל הממצאים הבאים אומתו ישירות מהקוד (file:line מדויק), לא הועתקו משום מסמך אחר.

### 3.1 [חשוב] ענף evening-brief מת קוד — `SpecializedContentRenderer.jsx:146` תופס לפני `:162`
כבר תואר ב-1.3. **רלוונטי ישירות** כי היכולת TABS תערוך את אותו קובץ, ממש באותו אזור dispatch. מומלץ להעלות למשתמש כשאלה נפרדת (לתקן כחלק מהעבודה, או להשאיר ולתעד כידוע) — **לא לתקן בשקט כתופעת-לוואי**.

### 3.2 [חשוב] `resolveTone()` ב-`morningBriefVisuals.js` — סיכון התנגשות עברית זהה ל-lessons.md (2026-08-30), לא מתוקן, לא מוגן
lessons.md מתעד תיקון מ-2026-08-30 לשלושה מקומות עם regex "עולה"/"עול" לא-מעוגן שתפס גם בתוך "פעולה": `workspaceStockItems.js`'s `inferSentimentFromText`, `marketRowVisuals.js`'s `getMarketTrendTone`, ו-`morningBriefVisuals.js`'s **`parseStockMovePercentFromText`/`BULLISH_PERCENT_CTX`**. אימתתי (`scripts/hebrew-sentiment-token-guard-qa.mjs:1-23`) שה-QA guard מכסה **בדיוק** את שלוש הפונקציות האלה, דרך helper משותף `stripSentimentFalsePositiveTokens` ב-`src/lib/hebrewSentimentTokenGuard.js`.

אבל **אותו קובץ** `morningBriefVisuals.js` מכיל **פונקציה נוספת, שונה**: `resolveTone()` (שורות 86-95) עם `BULLISH_TOKENS` (20-24) שמכיל את המחרוזת הגולמית `'עולה'` (שורה 23) — **ולא קוראת ל-`stripSentimentFalsePositiveTokens`** (שמיובא לאותו קובץ בשורה 6, לשימוש בפונקציות אחרות בלבד). `resolveTone()` מוזנת ישירות ל-`normalizeNewsSentiment()` ב-`morningBriefNewsNormalize.js:91-100`, שקובעת את הטון (`positive`/`negative`/`neutral`) של **כל פריט חדשות** במבזק. כלומר: פריט חדשות שהטקסט שלו מכיל את המילה "פעולה" (למשל תג פעילות שמור, או משפט כמו "השוק ממתין לפעולה של הפד") **עלול להיות מסווג positive באופן שגוי** — אותה מחלקת-באג בדיוק כמו ב-lessons.md, במקום אחר בקוד, לא מכוסה. זה רלוונטי ישירות ל-MAPPING/GEMS: אם היכולת החדשה תשתמש ב-`resolveTone()` כאות משלים לסיווג class (למשל "טון שלילי + מילות macro = risk"), היא תירש את הבאג הזה. **המלצה לתכנון:** בכל שימוש עתידי ב-`resolveTone()`, או להחיל קודם `stripSentimentFalsePositiveTokens`, או לעבור ל-`stockRowText.js`'s `extractExplicitSentiment` (התבנית המתוקנת המומלצת ב-lessons.md).

### 3.3 [חשוב] "3 המחלקות" כבר קיימות חלקית — אך לא באותה גרנולריות בכל שכבה
כפי שהודגם ב-2.1–2.3: ברמת ה-Obsidian/Brain/Tab-7 יש **4** "מסכים" עצמאיים בפועל (`technical-analysis`, `fundamental-analysis`, `macro`, וארבעת ה-briefs שכל אחד מהם הוא בעצם תערובת-של-שלושתם לפי-פורמט-זמן). ברמת ה-GEM `CONTENT_TYPES` יש **6** (marketBrief/macro/dailyTrading/fundamental/general/political). ברמת `gemRecommender.js`'s `GEM_RULES` יש **7** (fundamental/technical/news/macro/appBuilder/political/general). **אף שכבה לא מיישרת עצמה בדיוק ל-3.** ההמלצה שלי (סעיף 4) — 3 מחלקות תוכן (טכני/פונדמנטלי/שוק-כללי) הן הגרנולריות הנכונה **לצורך התצוגה/הניתוב שהמשתמש ביקש**, בתנאי שמאקרו נשאר תת-רכיב בתוך "שוק כללי" ולא נעלם — כי הוא כבר "אזרח מדרגה ראשונה" (MacroGemDashboard נפרד) ואי אפשר סתם למזג אותו לרשימה שטוחה בלי לאבד את זה.

### 3.4 [משני] `STOCK_ANALYSIS_SCREEN_BIBLE.md` עצמו סותר את עצמו
המסמך (588 שורות, מוצהר כ"SOURCE OF TRUTH") מציג שני נתיבי Obsidian שונים לפונדמנטלי בשתי טבלאות שונות באותו מסמך (447 מול 508 — ראו 2.4), וטוען (562) שמערכי הטאבים הישנים "used for extraction, badges, AiMappingModal" בעוד שווידאתי ב-grep שאין להם צרכן חיצוני. לפי הכלל שהמסמך עצמו קובע ("if implementation and documentation differ, report the contradiction before modifying code") — יש לדווח, לא לתקן בשקט.

### 3.5 [משני] תווית `'כללי'` כבר תפוסה — התנגשות-שם אפשרית עם "class 3"
`gemRecommender.js:161-171` — ה-GEM key `'general'` עם `label: "כללי / ידע אישי"` הוא קטגוריה **שלא קשורה לשוק ההון בכלל** (בריאות/תזונה/פסיכולוגיה — `categoryLabel: 'בריאות'`!). אם "המחלקה השלישית" של התכונה החדשה (שוק כללי/מאקרו/חינוך/סנטימנט) תיקרא סתם "כללי" ב-UI, היא תתנגש סמנטית עם תווית קיימת ולא-קשורה. יש לבחור תווית מובחנת (ראו סעיף 5).

### 3.6 [משני] מסווגי keyword-substring — סיכון עברי מוכר, לא בהכרח חדש אך רלוונטי
כל שלושת המסווגים בסעיף 2.3 (`resolveContentClassification`, `classifyVideoForGem`, `detectVideoType`) עושים `text.toLowerCase().includes(keyword)` על מקבצי מילות-מפתח עברית+אנגלית, ללא anchoring למילה שלמה. לא זיהיתי התנגשות קונקרטית חדשה כמו ה-"עולה"/"פעולה" (המילים הטכניות/פונדמנטליות פחות חופפות מבחינה לשונית), אבל **כל הרחבה עתידית של מקבצי מילות-המפתח האלה חייבת קודם לבדוק חפיפה עם lessons.md (2026-08-26, 2026-08-22)** — "test Hebrew aliases individually and with attached prefixes" ו-"do not use `\b` as a Hebrew word boundary".

### 3.7 [משני] `docs/work-ledger.md` לא קיים ב-worktree הראשי
נמצא רק בתוך `.claude/worktrees/feat+brief-permanence-phase3-4/docs/work-ledger.md` — כלומר סשן אחר יצר אותו בתוך ה-worktree שלו, אבל הוא לא tracked ב-branch הראשי (`git ls-files docs/work-ledger.md` ריק). אין רישום cross-tool מרכזי כרגע ל-branch הזה.

---

## 4. אפשרויות תכנון למודל הסיווג

### אפשרות A — סיווג בזמן חילוץ (GEMS-time / מודל)
ה-schema/prompt (Phase 1 למטה) מורחבים כך שהמודל עצמו (Gemini, בזרימת ה-paste-back, או Claude בזרימת ה-`analyze-video` הקיימת) **מוציא** שדה `contentClass` על כל item רלוונטי כחלק מה-JSON שהוא כבר מייצר.

- **יתרון:** דיוק גבוה ביותר — למודל יש הקשר מלא (transcript). גרנולריות item-level "בחינם" — ה-JSON כבר מובנה ברמת item.
- **חיסרון:** דורש ניתוח-מחדש (הדבקת GEM מחדש) לכל הסרטונים שכבר נשמרו — אין backfill אוטומטי לפריטים ישנים. **מתח לא-פתור מול תיעוד:** `USER_PRODUCT_INTENT_AND_FUTURE_VISION.md` §8 Hard Stop #3 קובע *"GEM paste-back only — no GEM API"*, אבל בפועל קיים גם נתיב API חי (`vite.config.js` → `makeGeminiVideoContentPlugin`, הכפתור "נתח עם Gemini" ב-`VideoDetailPanel.jsx:~11870`) **נפרד** מזרימת ה-quick-copy-paste (`src/ai/quickCopyPrompts.js`). לא ברור אם ה-Hard Stop מתכוון לחסום גם את הנתיב הזה או רק לזרימת ההעתק-הדבק הידנית — **זו שאלה פתוחה למשתמש (סעיף 5), לא הנחה שאני עושה.**

### אפשרות B — סיווג בזמן תצוגה/שמירה (קוד טהור, client-side)
מסווג JS חדש (בהשראת/הרחבה של `resolveContentClassification`/`classifyVideoForGem`/`detectMarketEntityType`) שרץ על טקסט קיים (title, subCategory, טקסט GEM שכבר נשמר) ומחזיר `contentClass` + `confidence` + `source`, **ללא** צורך בשינוי schema או בהדבקה-מחדש.

- **יתרון:** עובד מיידית על כל הסרטונים הקיימים (backfill "בחינם"). לא תלוי בזמינות מודל.
- **חיסרון:** יורש את מגבלת ה-keyword-substring matching (סעיף 3.6). דיוק נמוך יותר מ-A, בפרט על תוכן מעורב (מבזקים).

### אפשרות C — היברידי (מומלץ)
מודל-מסמן-קדימה (A) + קוד-מסמן-לאחור (B) כ-**fallback עם provenance מפורש**, בדיוק לפי המוסכמה הקיימת בכל שכבה אחרת באפליקציה (universalTabs מועדף / rawData fallback; GEM subCategory מועדף / keyword fallback; Fear&Greed: `null` על חוסר-נתון, לעולם לא מנוחש). כל item מקבל `{ contentClass, confidence, source: 'model' | 'heuristic-backfill' | 'unclassified' }` — בדיוק כמו ש-`resolveContentClassification()` כבר מחזירה `{contentType, confidence, confidencePct, reason, source}` היום (`gemContentRouter.js:213-268`).

**המלצתי:** אפשרות C. זו לא רק "הכי בטוחה" — היא **התבנית שהקודבייס הזה כבר משתמש בה בכל מקום אחר**, כך שאין המצאת דפוס חמישי. ראו סעיף 6 Phase 2/3 לפירוט מנגנון ה-fallback.

### Backfill לפריטים שכבר נשמרו
פריטים/סרטונים קיימים מקבלים `contentClass: null` / `source: 'unclassified'` כברירת מחדל בהעלאה (מיגרציה תוספתית, לא הרסנית — ראו Phase 6). מעבר-רקע (background pass) מריץ את מסווג-ה-fallback (אפשרות B) ומציע `contentClass` עם `confidence` — **בלי לכתוב בשקט**. ה-UX המדויק לאישור כבר קיים באפליקציה ומוכר למשתמש: תבנית "Draft-first + Apply AI Recommendations + Undo" של `ObsidianMappingTab.jsx` (מתועדת ב-`USER_PRODUCT_INTENT_AND_FUTURE_VISION.md` §8 Hard Stop #9 "Draft-first Obsidian Mapping"). **מומלץ לשכפל בדיוק את התבנית הזו** ל"הצע סיווג class" ולא להמציא UI חדש.

---

## 5. שאלות פתוחות למשתמש — כל אחת כבחירה קונקרטית

1. **רשימת הטאבים/התוויות הסופית לשכבת ה-class בתוך Tab 7:**
   - (א) "טכני" (`ניתוח טכני`, תווית קיימת ותואמת) / "פונדמנטלי" (`ניתוח פונדמנטלי` — **לא** `פונדמנטלי` הבודד, כדי ליישר עם obsidianExport.js:57 ועם planned-hierarchy) / "**שוק כללי**" (לא "כללי" בגלל ההתנגשות בסעיף 3.5) — 3 שמות.
   - (ב) לחלופין: "טכני" / "פונדמנטלי" / "מאקרו ושוק" — שם שמדגיש שמאקרו "חי" בפנים.
   - (ג) משהו אחר לגמרי — המשתמש קובע.
   *נדרשת החלטה מפורשת כי התווית הזו תיכתב הן ל-UI, הן (דרך subCategory) לשם תיקיית Obsidian.*

2. **מתי מופיע מתג-ה-class בתוך Tab 7?**
   - (א) תמיד, גם לסרטון "טהור" (`technical-analysis` בלבד) — עקביות ויזואלית מלאה בין כל סרטוני שוק ההון.
   - (ב) רק כשה-video/GEM מסווג כ"מעורב" (מבזקים, או סרטון שה-MAPPING זיהתה בו יותר מ-class אחד) — שינוי ויזואלי מינימלי לסרטונים טהורים.
   *המלצתי הראשונית (לא סופית) — (ב), כי זה השינוי הקטן ביותר מעל הקוד הקיים ולא "מפריע" לזרימה שכבר עובדת ל-technical-analysis/fundamental-analysis הטהורים.*

3. **מי "מנצח" כש-video-level classification (subCategory) ו-item-level classification (בתוך ה-items) לא מסכימים?** למשל וידאו עם subCategory=`טכני` שמכיל item בודד שנראה פונדמנטלי (למשל דיון ב-P/E). להציג את ה-item תחת "טכני" (הקשר הווידאו) או תחת "פונדמנטלי" (הקשר ה-item)?

4. **תיקון ה-evening-brief dead branch (3.1) — בתוך המשימה הזו, כשלב נפרד לפני זה, או מחוץ לתחום לגמרי?** נוגע ישירות לאותם שורות קוד ש-TABS תערוך.

5. **נתיב-Gemini-חי (`/api/gemini-video-content`) מותר לשימוש ל-backfill מודל-מבוסס, או שה-Hard Stop "GEM paste-back only" חוסם גם אותו?** (סעיף 4, אפשרות A) — יש לאשר מפורשות לפני שמתכננים Phase שמניח תשובה.

6. **קטגוריית "שוק כללי" צריכה תיקיית Obsidian ייעודית חדשה, או שהיא מתפזרת לתיקיות הקיימות (`שוק ההון/מאקרו`, `שוק ההון/ניתוח חדשות`) לפי תת-הנושא של כל item?**

7. **מה עושים עם ה-8 מערכי-הטאבים-המתים (`TECHNICAL_TABS` וכו', סעיף 1.1)?** להשאיר כמות שהם (Soft Stop קיים), למחוק בפורמלי אחרי אישור נפרד, או לחבר-מחדש כחלק מ-TABS?

---

## 6. תוכנית מיושמת מדורגת

כל שלב עצמאי-לפריסה (independently shippable), עם תלות מפורשת בשלב הקודם רק כשבאמת קיימת. שם הסוכן נבחר מתוך `.claude/agents/*.md` **בפועל** (לא מומצא) — ראו קבצי ההגדרה שנקראו בשלמותם בתחילת המשימה.

### Phase 0 — החלטות (לא קוד)
**סוכן:** אין (routing/decision בלבד — `cto` יכול לתווך אם רוצים דיון נוסף). **שער:** תשובות המשתמש לסעיף 5 (לפחות שאלות 1, 2, 5). **תלות:** אין. חוסם את Phase 2 ואילך (Phase 1 יכול להתחיל מבלי לחכות, כי סכימת GEM לא תלויה בתוויות UI סופיות).

### Phase 1 — GEMS: הרחבת סכימה/prompt/validator
**סוכן מבצע:** `gemini-integration-engineer` (הבעלים המתועד של `gemContentRouter.js`, `schemas/*`, `validators/*`, `prompts/*`).
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/ai/gemini/schemas/morningBriefSchema.js`, `src/ai/gemini/schemas/marketSchema.js`, `src/ai/gemini/validators/validateMarket.js`, `src/ai/gemini/prompts/*market*`, `src/ai/gemini/gemContentRouter.js` (הוספת קבוע `contentClass` values, לא שינוי `CONTENT_TYPES` הקיים).
**מטרה:** הוספה תוספתית (non-breaking) של שדה `contentClass` (`'technical'|'fundamental'|'general'|null`) לכל item-shape רלוונטי ב-`universalTabs.specialized` (stocksMentioned, opportunities, risks, macro), + `confidence`/`source` ברמת ה-video ב-`resolveContentClassification()`.
**קריטריוני קבלה מדידים:**
- JSON קיים (ללא contentClass) ממשיך להתפרסר ולהיות מוצג זהה לפני-השינוי (regression על fixtures קיימים).
- `scripts/fixtures/macro-specialized-regression.fixture.mjs` וכל ה-`gems-*-qa.mjs` הרלוונטיים ירוקים.
- Prompt חדש נבדק ידנית מול כלל "no ASCII `"` inside string values" הקיים (JSON-safety, לא לשבור).
**QA:** `npm run test:*` הרלוונטיים ל-gems (`test-morning-brief-routing`, `content-routing-bridge-qa`, `market-stock-classification-qa`), `npm run build`.
**Rollback:** שדה חדש ואופציונלי — הסרה = מחיקת המפתח מה-schema example, אין impact על נתונים קיימים.
**תלות:** Phase 0 (חלקית — לא חוסם, אבל שמות ה-enum הסופיים כדאי שיהיו נעולים לפני commit).

### Phase 2 — MAPPING ברמת וידאו: יישור המסווגים הקיימים
**סוכנים מבצעים (מקבילי-חקירה → מיזוג מתואם, hybrid):** `decision-signal-engineer` (בעלים מתועד של `gemRecommender.js` ונוסחת ה-confidencePct) **ו-** `gemini-integration-engineer` (בעלים של `gemContentRouter.js`).
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/lib/gemRecommender.js` (תיקון `GEM_CATEGORY_MAP.fundamental`/`.technical` שיישרו ל-`SUB_CATEGORY_SLUG_MAP`), `src/config/videoTabsConfig.js` (`SUB_CATEGORY_SLUG_MAP` אם נדרש עדכון), `src/ai/gemini/gemContentRouter.js`.
**מטרה:** לתקן את הבאג המדויק שתועד בסעיף 2.3 — subCategory שה-recommender מציע **תמיד** יתאים למחרוזת שה-tab-router מזהה. אין המצאת מסווג רביעי — תיקון-יישור בין השלושה הקיימים.
**קריטריוני קבלה מדידים:**
- לכל key ב-`GEM_CATEGORY_MAP` (`fundamental`, `technical`, `macro`, …), כל תווית ב-`subCategoryRules` **וגם** ה-`defaultSubCategory` נמצאים ב-`SUB_CATEGORY_SLUG_MAP` (בדיקת-סגירה אוטומטית, לא רק ידנית — QA script חדש).
- וידאו עם `subCategory` שהתקבל מ-`preGemClassifier`/`classifyVideoForGem` מגיע ל-`getTabsBySubTopic()`/ל-branch הנכון ב-`SpecializedContentRenderer` ב-100% מהמקרים הנבדקים (לא רק ה-default).
**QA:** QA script חדש (`gem-subcategory-alignment-qa.mjs` או דומה) + `market-stock-classification-qa.mjs` קיים.
**Rollback:** שינוי במחרוזות בלבד בתוך קובצי config — `git revert` נקי, אין מיגרציית נתונים.
**תלות:** Phase 0 (שאלה 1 — התווית הסופית).

### Phase 3 — MAPPING ברמת item
**סוכן מבצע:** `gemini-integration-engineer` (יישור validator/schema) בשיתוף `decision-signal-engineer` (אם נדרש heuristic fallback ל-items ללא contentClass מהמודל — הרחבת `detectMarketEntityType.js`-style logic).
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/lib/detectMarketEntityType.js` (או קובץ אח חדש `detectContentClass.js` **רק אם באמת אין דרך להרחיב את הקיים** — יש להצדיק בפועל, לא להניח), `src/ai/gemini/validators/validateMarket.js`.
**מטרה:** מימוש אפשרות C (סעיף 4) בפועל — item עם `contentClass` מהמודל (Phase 1) מועדף; item בלי זה מקבל fallback היוריסטי עם `confidence`/`source` מפורשים.
**קריטריוני קבלה מדידים:** כל item שעובר דרך `extractVideoTabItems`/`buildMorningBriefBulkSections` נושא `contentClass`+`source` (גם אם `'unclassified'`) — לא `undefined` שקט.
**QA:** QA script ייעודי + regression fixture עם items מעורבים (טכני+פונדמנטלי+מאקרו באותו וידאו).
**תלות:** Phase 1 (השדה חייב להיות זמין ב-schema קודם), Phase 2 (יישור video-level).

### Phase 4 — TABS: תצוגה בתוך Tab 7
**סוכן מבצע:** `frontend-rtl-developer`.
**סוכן שוער:** `qa-release-reviewer` (Gate 8 — RTL בפרט).
**קבצים צפויים:** `src/components/dashboard/SpecializedContentRenderer.jsx` (הוספת מתג/תתי-טאב class בתוך ה-slugs הרלוונטיים, **ללא** נגיעה ב-`UNIVERSAL_TABS`), `src/components/dashboard/MorningBriefDashboard.jsx` (אם ברירת "מבזק מציג לפי class" נבחרת), רכיב חדש קטן (למשל `ContentClassSwitcher.jsx`) שמשוכפל בסגנון `SectionCard`/`DedicatedContentSection` הקיימים.
**מטרה:** לממש "תצוגה בטאבים לפי class" **בתוך** טאב 7, בהתאם ל-Hard Stop המתועד (סעיף 1.1) ולתשובת המשתמש לשאלה 2.
**קריטריוני קבלה מדידים:**
- `UNIVERSAL_TABS.length === 7` נשאר ללא שינוי (בדיקת regression מפורשת).
- וידאו `technical-analysis`/`fundamental-analysis` טהור מוצג **זהה בפיקסל** למצב הקודם כשאין עדיין נתוני class מעורבים (no visual regression).
- RTL checklist מלא (`frontend-rtl-developer.md`'s checklist) על הרכיב החדש: logical properties, `dir="rtl"`, accessible state על ה-switcher (aria-selected/aria-pressed).
**QA:** `npm run build`, בדיקת diff ידנית מול checklist RTL, `dedicated-content-selection-qa.mjs`, `specialized-section-order-qa.mjs`.
**Rollback:** הוספת UI תוספתית מאחורי flag/branch — הסרה = מחיקת ה-branch החדש מ-`SpecializedContentRenderer.jsx`, אין נתונים שנפגעים.
**תלות:** Phase 2, Phase 3 (צריך contentClass אמין כדי לדעת מתי להציג את המתג כלל).

### Phase 5 — ניתוב Obsidian
**סוכן מבצע:** `obsidian-sync-engineer`.
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/lib/obsidianExport.js` (תיקון שיבוש-השם המשולש, סעיף 2.4/3.4 — קביעת `שוק ההון/ניתוח פונדמנטלי` כקנוני, יישור שאר המקומות), `docs/governance/STOCK_ANALYSIS_SCREEN_BIBLE.md` (תיקון אי-ההתאמה הפנימית שנמצאה), `src/lib/obsidianRouting.js` (ללא שינוי לוגי, רק אם נדרש נרמול נוסף).
**מטרה:** לוודא ששני מנועי הניתוב (taxonomy + keyword/catalog) מסכימים על שם התיקייה לכל אחד מ-3 ה-classes, **לפני** שמפעילים ניתוב אוטומטי מבוסס-MAPPING.
**קריטריוני קבלה מדידים:** בדיקת-הסכמה אוטומטית בין `resolveObsidianFolderFromTaxonomy()` ל-`resolveObsidianFolderForVideo()`/`resolvePrimaryTopic()` לכל אחד מ-3 ה-subCategory values (כרגע לא קיימת בכלל — פער מתועד ב-`obsidian-sync-engineer.md` Known gap #3).
**QA:** `node scripts/obsidian-note-merge-qa.mjs`, `npm run test:merge-vault` (temp vault בלבד — **אסור** לכתוב ל-vault האמיתי בלי אישור מפורש).
**Rollback:** שינויי מחרוזת בקובצי routing — הפיך לחלוטין, אין כתיבה הרסנית.
**תלות:** Phase 2 (השם הסופי, לאחר יישור).

### Phase 6 — Persistence + backfill
**סוכן מבצע:** `persistence-storage-engineer` (שכבת האחסון) בשיתוף `frontend-rtl-developer` (חשיפת ה-backfill UI, בהשראת `ObsidianMappingTab.jsx`).
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/lib/persistence/storageManifest.js` (**רק אם** נדרש מפתח localStorage חדש — allowlist change מאושר-מראש, ראו Protected settings של אותו סוכן), `src/lib/workspaceLibraryStore.js`, `src/config/workspaceHeadingRegistry.js` (אם contentClass צריך להיות ציר-סינון ב-Workspace Library, בנוסף לציר ה-collection הקיים).
**מטרה:** שדה `contentClass` תוספתי על רשומות video ו-workspace item, עם ברירת מחדל `null`/`'unclassified'` לרשומות קיימות (לא reprocessing כפוי), + מסך "הצע סיווג" בסגנון draft-first (סעיף 4).
**קריטריוני קבלה מדידים:**
- כתיבה חדשה עם contentClass עוברת write→read-back→verify (חוזה הכתיבה הקיים, `persistence-storage-engineer.md`).
- רשומות ישנות (ללא contentClass) ממשיכות להיטען ולהיות מוצגות ללא שגיאה.
- אם נוסף מפתח allowlist — ה-count assert (`=== 66` וכו') עודכן **באותו diff**, עם אישור מפורש.
**QA:** QA script חדש בסגנון `workspace-persistence-qa.mjs`, `workspace-library-counts-qa.mjs` (regression — לא לשבור ספירות קיימות).
**Rollback:** מיגרציה תוספתית `dryRun`-capable (לפי הדפוס של `marketBriefSidecarMigration.js`) — אף פעם לא מוחקת מקור לפני read-back מאומת.
**תלות:** Phase 3 (השדה חייב מבנה סופי לפני שכותבים אותו ל-storage).

### Phase 7 — שכבת ה-Workspace/saved-rows + QA סופי
**סוכן מבצע:** `frontend-rtl-developer` (סינון/badge class בתוך ה-6 מרנדרי-שורות, `workspaceSavedAnalysis.js`).
**סוכן שוער:** `qa-release-reviewer` (שער סגירה סופי לכל התכונה).
**קבצים צפויים:** `src/utils/workspaceSavedAnalysis.js`, שכבת ה-6 renderers (סעיף 1.7) — **תוספת בלבד**, בלי לשנות את `rowSelectionProps()` המשותף.
**הערה קריטית לתיאום:** ענף זה נוגע **ישירות** באותם קבצים שכרגע בעבודה לא-מקומיטת ב-branch `feat/saved-market-rows-table` (`SavedNewsRows.jsx`, `workspaceSavedAnalysis.js`, `morningBriefBulkSections.js`). **אסור להתחיל Phase 7 לפני שאותה עבודה קיימת מקומיטת/ממוזגת** — ראו סעיף 8.
**מטרה:** אפשרות לסנן/לתייג שורות שמורות לפי class, ללא שבירת תבנית ה-`recordIds`/`selectedIds` הקיימת.
**QA:** `test:saved-market-rows`, `test:saved-stock-rows`, `test:saved-sector-rows`, `test:saved-opportunity-rows`, `test:saved-news-rows`, `test:workspace-row-selection` (כל ה-6 חייבים להישאר ירוקים).
**Rollback:** שדה תצוגה תוספתי, הפיך.
**תלות:** Phase 6, וגם על מיזוג `feat/saved-market-rows-table`.

**שער סיום קבוע לכל Phase:** `qa-release-reviewer` מריץ את 11 השערים המתועדים שלו (Build / Static sanity / Node QA / Playwright / Runtime / Persistence contract / RTL / Synchronized copies / QA-travels-with-change / Secrets) לפני כל commit-מוכן-למיזוג.

---

## 7. מחוץ לתחום (Not in Scope)

- **הוספת טאב-על שמיני** — סותר Hard Stop מתועד (`USER_PRODUCT_INTENT_AND_FUTURE_VISION.md` §8). כל תכנון שמניח את זה חייב לחזור למשתמש לאישור מפורש קודם.
- **מחיקת מערכי הטאבים המתים** (`TECHNICAL_TABS` וכו') — Soft Stop מתועד; דורש שיחה נפרדת (שאלה 7).
- **תיקון הענף המת של evening-brief** (3.1) — קיים, לא-קשור-במקור למשימה, רק "באותו קוד" — נשאר שאלה פתוחה (שאלה 4), לא הנחה.
- **תיקון `resolveTone()`** (3.2) — זוהה כסיכון, לא כמשימה. תיקון נפרד, מחוץ לפלייבוק הזה, אלא אם המשתמש מבקש לצרף אותו ל-Phase 1/3.
- **מיזוג שני מנועי ניתוב ה-Obsidian ליחיד** — פרויקט ארכיטקטוני נפרד ומתועד כ"פער ידוע" (obsidian-sync-engineer.md Known gap #3); Phase 5 רק **מיישר שמות**, לא ממזג מנועים.
- **קריאת API חיה ל-Gemini לצורך backfill המוני** (אפשרות A ב-סעיף 4) — נחסמת עד לתשובה לשאלה 5.
- **שינוי כל הגדרות ה-AI המוגנות** (`vite.config.js`, `VideoDetailPanel.jsx` — max_tokens, timeouts, chunking, `GEMINI_MOCK`) — מחוץ לתחום לחלוטין ללא אישור נפרד ומפורש.
- **שינוי מבנה `.claude/worktrees/`** או תיקון ה-`core.worktree` redirect שגרם לכשל ה-isolation בתחילת המשימה הזו — לא בתחום, לא שלי לגעת בו.
- **כתיבה אמיתית ל-vault Obsidian האמיתי** בכל שלב QA — רק temp-vault, אלא אם המשתמש מאשר אחרת.
- **שינוי `docs/work-ledger.md`** — לא קיים ב-branch הראשי, לא נוצר/נערך על ידי המסמך הזה.

---

## 8. Branch ו-Worktree מומלצים

**Branch בסיס:** `main`, **לא** `feat/saved-market-rows-table`. הנימוק: Phase 1 (GEMS) לא נוגע באף קובץ שכרגע לא-מקומיט ב-`feat/saved-market-rows-table` (`package.json`, `scripts/saved-news-rows-qa.mjs`, `scripts/test-specialized-news-sectors-mapping.mjs`, `MorningBriefBulkCheckbox.jsx`, `MorningBriefNewsSection.jsx`, `VideoDetailPanel.jsx`, `UniversalTabQuickSaveActions.jsx`, `SavedNewsRows.jsx`, `WorkspaceSaveReviewOverlay.jsx`, `morningBriefBulkSections.js`, `morningBriefNewsNormalize.js`, `universalTabBulkItems.js`, `workspaceSavedAnalysis.js`) — ולכן יכול להתחיל מיד על `main` בלי לרשת WIP לא-קשור. **אבל** Phase 4 (`SpecializedContentRenderer.jsx`) ו-Phase 7 (שכבת ה-saved-rows) **כן** חופפים ישירות לקבצים האלה — יש **לחכות שה-branch הנוכחי יתמזג ל-`main`** (או לפחות שהעבודה תקומיט) לפני שמתחילים בהם, אחרת התכנון הזה יבנה על גבי עבודה לא-מקומיטת של סשן אחר.

**Worktree מבודד:** כן, מומלץ — ובחוזק, בגלל שהעבודה הזו רב-שלבית וארוכה, ומשום ש**כרגע כבר יש 3 worktrees פעילים אחרים תחת `.claude/worktrees/`** (`agent-abf7c518da5e4a6d6`, `feat+brief-permanence-phase3-4`, `fix+asset-links-investing-fallback`) שמדגימים בדיוק את סוג ההתנגשות שהמשימה הזו נועדה למנוע. **אבל** — כפי שצוין בהוראות המשימה, יש בעיית `core.worktree` redirect קיימת ב-`.claude/worktrees/` שגרמה לכשל isolation-attempt כבר בתחילת המשימה הזו. אני **לא** חוקר או מתקן את זה (מחוץ לתחום). המלצה מעשית: ליצור worktree חדש ידנית עם `git worktree add <path-מחוץ-ל-.claude/worktrees/> main` (נתיב נקי, לא תחת התיקייה עם הבעיה הידועה), ולוודא בהתחלת כל Phase שה-`git status`/`HEAD` בפועל תואמים למצופה — לפי הדפוס שכבר מתועד ב-lessons.md (2026-08-21, "Compare identity gates from fresh explicit output").

---

*מסמך זה תוכנן בלבד. לא בוצע שום commit, לא נערך שום קובץ קוד, לא הופעל שום שרת. ממתין לסקירת המשתמש.*
