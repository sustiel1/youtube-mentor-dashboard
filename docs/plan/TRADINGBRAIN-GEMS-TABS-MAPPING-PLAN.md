# TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN

**WORK-ID:** TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN
**סוג מסמך:** תכנון בלבד — אין קוד שהשתנה כתוצאה ממסמך זה
**נסקר מול:** `youtube-mentor-dashboard`, branch `feat/saved-market-rows-table`, קומיט הבסיס `0733b84` (הגרסה הקודמת של מסמך זה) — לא זז לאורך כל הביקורת הנוכחית.
**תאריך:** 2026-09-01 (עדכון רביעי)

---

## עדכון רביעי — 2 תשובות נוספות למשתמש, הפכו להחלטות 15-16

הסבב הקודם (עדכון שלישי) השאיר 4 שאלות פתוחות חדשות וצרות (סעיף 8). המשתמש הכריע בשתיים מהן במפורש — סגורות עכשיו כהחלטות 15 ו-16 (סעיף 5 להלן):

1. **[שאלה 1 הישנה, מהחלטה 11] `macro` הישן מוסתר/מוזז או נשאר זמין לצד `macroMarket`?** הוכרע: **`macro` מוסר מרשימת ה-override הידני בלבד** (4 האפשרויות ברשימה הן brief/technical/fundamental/macroMarket) — לא מוסתר, לא מוזז, לא נמחק במובן הקוד; המפתח `macro` עצמו וכל חמשת הצרכנים הקיימים שלו (מסמכים בהחלטה 11) נשארים ללא שינוי. תועד כהחלטה 15.
2. **[שאלה 2 הישנה, מהחלטה 11] דרוש תג/frontmatter מבחין ב-Obsidian בין `macro` הישן ל-`macroMarket` החדש בתוך אותה תיקייה?** הוכרע: כן, נדרש סימון-מקור בתוך כל note. **נבדק בקוד החי (לא הונח) איזה מנגנון-תיוג קיים כבר וניתן להרחבה תוספתית מול המצאת מנגנון מקביל** — ראו החלטה 16 לממצא המלא, כולל הפתעה: המנגנון הקיים הרלוונטי ביותר (`buildFrontmatter`'s שדה `source`) **אינו** למעשה מחווט לתוך נתיב-הכתיבה האמיתי שממלא את התיקייה המשותפת (`writeObsidianWithItemMerge`/`mergeItemsIntoObsidianNote`) — נדרשת תוספת קטנה, לא רתימה של מנגנון קיים כמות שהוא.

שאלות 3-4 הישנות (סעיף 8) **נותרו פתוחות** — המשתמש לא הכריע בהן בסבב זה; ראו סעיף 8 המעודכן.

---

## עדכון שלישי — 4 תשובות למשתמש על "שאלות פתוחות חדשות" (סעיף 8 הקודם), הפכו להחלטות 11-14

הסבב הקודם (עדכון שני) השאיר 4 שאלות פתוחות בעקבות תיקון הארכיטקטורה ל-4 GEMS. המשתמש ענה על כל 4, והתשובות נוספו כהחלטות 11-14 (סעיף 5 להלן). **לפני כתיבתן נבדקו כל 4 התשובות מול הקוד החי מחדש — שתיים מתוכן חשפו סתירות קונקרטיות בקוד הקיים שהתכנון הקודם לא זיהה:**

1. **Q1 (מפתח `macroMarket` נפרד, לא הרחבת `macro`)** — הוכרע. **תוקן ישירות: החלטה 1 (למטה) הכילה בעבר המלצה לכיוון ההפוך ("הרחבה של macro הקיים") — הומרה עכשיו להפניה להחלטה 11.** שני סיכוני-התנגשות קונקרטיים אותרו ותועדו במפורש בהחלטה 11 (לא רק "יתכן ותהיה בעיה" — נבדקו בפועל): (א) תווית UI כפולה ("מאקרו" הישן מול "מאקרו ושוק" החדש, שני GEMs נפרדים וחיים בו-זמנית), (ב) התנגשות תיקיית Obsidian (שני GEMs כותבים לאותה תיקייה `שוק ההון/מאקרו` לפי החלטה 6 הקיימת).
2. **Q2 (override תמיד זמין, רשימה תמיד מלאה)** — הוכרע חלקית, **עם סתירה קונקרטית שנמצאה בקוד**: כפתור הפתיחה ("🔀 שנה GEM"/"💎 ניהול GEMS") אכן **תמיד מוצג ללא תנאי** — זה אושש כפי שהיה. אבל **הרשימה בפועל בתוך `GemSelectionModal.jsx` אינה תמיד מלאה** — עבור וידאו מסוג מבזק בוקר/ערב (בדיוק אוכלוסיית-היעד של 4 ה-GEMS) הרשימה מוצגת מקופלת מאחורי "אפשרויות נוספות", ו-`macro`/`macroMarket` לא מוצג שם כלל היום. זו סתירה אמיתית ל"הרשימה תמיד מציגה את כל 4 ה-GEMS" — תועדה במלואה בהחלטה 12 ו-Phase 2 עודכן בהתאם.
3. **Q3 (טאבים ריקים לא מוסתרים לעולם)** — הוכרע, **ללא סתירה בקוד** (לא נמצאה שום לוגיקת hide-empty-tab ברמת ה-tab bar — ראו אימות ב-1.1). כל האזכורים הקודמים במסמך שרמזו על הסתרת טאב ריק תוקנו (3 מיקומים, ראו רשימה בדוח הסגירה).
4. **Q4 (`unclassified`/"ממתין לסיווג" כמצב pending, לא GEM חמישי)** — הוכרע, **עם סתירה קונקרטית שנמצאה בקוד**: שכבת ה-Tab-7 (`SpecializedContentRenderer.jsx` default branch, 410-438) כבר ניטרלית ולא בונה class חמישי — זה תקין. אבל **שני מסווגי ה-GEM עצמם** (`gemRecommender.js`'s `classifyVideoForGem()` וגם `gemContentRouter.js`'s `resolveContentClassification()`) **כבר היום, כשאין אות ברור, לא מחזירים מצב-המתנה ניטרלי — הם בוחרים אקטיבית ב-GEM "כללי"/קטגוריית "בריאות"**, לא מצב pending. תועד במלואו בהחלטה 14 כשינוי קוד נדרש בשני קבצים, לא רק "וידוא".

---

## מה השתנה מהגרסה שהוקומטה (0733b84) ולמה

הגרסה הקודמת (0733b84) תכננה סביב הנחה שהתבררה כלא-מדויקת בניסוח שלה, גם אם חלק מהעובדות שהיא איתרה נכונות: היא הציעה "3 מחלקות תוכן" (טכני/פונדמנטלי/שוק כללי) המוצגות **בתוך** טאב 7 הקיים, מתוך חשש ש-Tab 7 חייב להישאר "מסך אחד" ושמערכת ה-GEMS/subCategory הקיימת לא תומכת בהפרדה אמיתית. המשתמש תיקן את המסגור: **יהיו 4 GEMS נפרדים** (המבזק הקיים + טכני + פונדמנטלי + מאקרו ושוק), כל אחד עם ה-7 טאבים הרגילים, כאשר טאב 7 בלבד הוא המשטח הספציפי-ל-GEM — לא "מתג בתוך טאב 7" של 3 מחלקות בווידאו יחיד.

**אימתתי מחדש את שתי ההנחות הקריטיות לפני שכתבתי מחדש, ולא מצאתי סתירה:**

1. **"7 הטאבים הם קבועים ל-כל וידאו, זהים לחלוטין ב-1-6, וטאב 7 כבר משתנה לפי GEM/contentType"** — **מאושר במלואו בקוד החי**. `VideoDetailPanel.jsx:2933` (`visibleTabDefinitions = UNIVERSAL_TABS`) ו-`VideoDetailPanel.jsx:10154` (`{UNIVERSAL_TABS.map(...)}`) הם המקום היחיד שבו נבנה ה-tab bar בפועל — **לא** `getTabsForVideo()`/`getTabsBySubTopic()`. חיפוש רחב (`grep`) על כל `src/` מאשר: `getTabsForVideo`/`getTabsBySubTopic`/`TECHNICAL_TABS`/`FUNDAMENTAL_TABS`/`MACRO_TABS` **לא מיובאים ולא נצרכים** לא ב-`VideoDetailPanel.jsx` ולא ב-`AiMappingModal.jsx` (הקובץ היחיד השלישי שמוזכר ב-grep) — הם קוד מת, בדיוק כפי שהגרסה הקודמת של המסמך כבר קבעה בסעיף 1.1 שלה. כלומר: **אין צורך "לבטל" מנגנון טאב-בר-לפי-סוג קיים** — הוא כבר לא רץ. טאב 7 (`SpecializedContentRenderer.jsx`) כבר מנתב לפי `slug` (`technical-analysis`/`fundamental-analysis`/`macro`/`morning-brief`/`evening-brief`/ברירת-מחדל, שורות 105-438, ללא שינוי משורה למול הגרסה הקודמת) — זה בדיוק המנגנון שהארכיטקטורה המתוקנת מבקשת "להרחיב" ל-4 GEMS, לא להמציא.
2. **"אין צורך בטאב 8, אין צורך במתג תלת-כיווני בתוך טאב 7"** — נובע ישירות מ-(1). מכיוון שהטאב-בר בפועל תמיד `UNIVERSAL_TABS` (7 קבועים) ומכיוון שטאב 7 כבר מנתב לפי `slug`, הוספת 3 GEMS חדשים היא הרחבה של אותה טבלת ניתוב הקיימת ב-`SpecializedContentRenderer.jsx`, לא שינוי מבני. **אין סתירה בין הארכיטקטורה המתוקנת לקוד.**

**שני ממצאים חדשים וקריטיים לתכנון, שלא נכללו בגרסה הקודמת ומשנים באופן ממשי את היקף כמה מהשלבים:**

- **מנגנון manual GEM override כבר קיים במלואו בקוד** (`VideoDetailPanel.jsx:2350-2351` — `gemOverride`/`setGemOverride`, `GemSelectionModal` בשורות 12917-12930, כפתור "🔀 שנה GEM" בשורה 12886-12889, ונשמר דרך `saveVideoFields({ gemOverride: key })`). זה משנה מהותית את Phase "manual override" (החלטה 8 למטה) מ"בנה UI חדש" ל"ודא שרשימת ה-GEMS ב-`GEM_ALT_OPTIONS`/`GEM_CATEGORY_MAP` כוללת את 3 ה-GEMS החדשים ומיושרת עם תיקון ה-subCategory router (הרחבת Phase 2 הקיים)".
- **מנגנון schema-to-prompt-text export כבר קיים במלואו בקוד** (`src/ai/quickCopyPrompts.js`) — `getMarketSchemaExample()` (מיובא מ-`src/ai/gemini/schemas/marketSchema.js`) כבר מוטמע ישירות בתוך `buildGeminiMarketQuickPrompt()`, ויש כבר **כפתורי quick-copy נפרדים** בדיוק לשלוש הקטגוריות המבוקשות: `gemini-technical` ("Gemini טכני"), `gemini-fundamental` ("Gemini פונדמנטלי"), `gemini-macro` ("Gemini מאקרו") (שורות 334-369, כולם עדיין בונים פרומפט מאותו `buildGeminiMarketQuickPrompt`/סכימה שטוחה זהה — `QUICK_COPY_ACTIONS`/`QUICK_COPY_GROUPS`, שורות 316-457). זה משנה את Phase "schema export" (החלטה 9) מ"בנה מנגנון חדש" ל"פצל את הסכימה/ההוראות המשותפת הקיימת ל-3 גרסאות ייעודיות (או השאר סכימה משותפת + `contentClass` מבחין, ראו החלטה 1) והצמד כל כפתור ל-schema/routing החדש".

מלבד שני אלה, שאר הממצאים העובדתיים בגרסה הקודמת (סעיפים 1, 2, 3 להלן) נותרו נכונים ומאומתים שוב במלואם, למעט התאמות ניסוח קטנות שנדרשות כדי לשקף 4 GEMS במקום 3 מחלקות. פרק 4 (אפשרויות מודל סיווג), פרק 5 (שאלות פתוחות) ופרק 6 (שלבים) נכתבו מחדש כמעט לגמרי כדי לשקף את עשר ההחלטות שהתקבלו.

---

## 1. איך מבזק הבוקר/הערב עובד היום — בפירוט שניתן להעתיק

### 1.1 ארכיטקטורת-העל: 7 טאבים קבועים לכל וידאו, טאב 7 כבר GEM-specific

**ממצא מרכזי, מאומת שוב במלואו:** לאפליקציה יש **7 טאבים אוניברסליים קבועים לכל סרטון** (`UNIVERSAL_TABS`, נגזר מ-`VIDEO_ANALYSIS_HEADINGS` ב-`src/config/workspaceHeadingRegistry.js:81-83`, נצרך ב-`src/config/videoTabsConfig.js:160-164`). זה כלל מחייב מתועד:

> `docs/governance/USER_PRODUCT_INTENT_AND_FUTURE_VISION.md` §5: *"Exactly 7 tabs, fixed order, every video — no exceptions. Tab 7 (specialized) is the only category-specific surface."* וב-§8 טבלת Hard Stops: #1 "7 Universal Tabs — fixed order" ו-Soft Stop #5 "Adding 8th universal tab — Architectural invariant violation".

מאומת גם בקוד: `VideoDetailPanel.jsx:2933` (`visibleTabDefinitions = UNIVERSAL_TABS`) ו-`VideoDetailPanel.jsx:10154` (`{UNIVERSAL_TABS.map(({ value, label, emoji }) => ...)}`) — **זה המקום היחיד** בו נבנה ה-tab bar בפועל. ההערה מעל ה-`TabsList` (שורה 10127 בגרסה הקודמת של הקובץ) אומרת מילולית: `{/* ── Universal 7-tab bar — same for every video (Phase 1) ── */}`.

**המשמעות הקריטית לתכנון, ומאושרת מחדש:** קיימת מערכת ישנה ומקבילה של מערכי טאבים ייעודיים-לפי-סוג בתוך `videoTabsConfig.js` — `LEARNING_TABS`, `TECHNICAL_TABS` (שורות 186-197), `FUNDAMENTAL_TABS` (199-211), `MACRO_TABS` (213-224), `MORNING_BRIEF_TABS` (226-235), `EVENING_BRIEF_TABS` (237-246), `WEEKLY_BRIEF_TABS` (248-257), `EARNINGS_BRIEF_TABS` (259-268), `POLITICAL_TABS` (270-280), ופונקציית הבחירה `getTabsForVideo()` / `getTabsBySubTopic()` (305-341) שמחזירה אותם. **גרפ טרי על כל `src/` (בוצע מחדש עבור מסמך זה) מאשר שוב: אין אף צרכן חיצוני** ל-`getTabsForVideo`/`getTabsBySubTopic`/`TECHNICAL_TABS`/`FUNDAMENTAL_TABS`/`MACRO_TABS` — לא ב-`VideoDetailPanel.jsx` (בודק ישירות: אין import של השמות האלה) ולא ב-`AiMappingModal.jsx` (הקובץ השלישי היחיד שמזכיר `UNIVERSAL_TABS`, ונבדק ישירות — לא מזכיר אף אחד מהמערכים/הפונקציות האלה). זה **אישוש ישיר לארכיטקטורה המתוקנת**: אין "טאב-בר לפי GEM" חי כרגע, ואין צורך להסיר אחד — כל 4 ה-GEMS יעברו דרך אותו `UNIVERSAL_TABS` בדיוק. הערכים ה"מתים" נשארים כמות שהם לפי החלטה 7 (ראו להלן).

**מסקנה לתכנון:** אין סתירה בין 4 ה-GEMS לכלל "7 טאבים קבועים" — כל GEM (כולל 3 החדשים) ישתמש באותו `UNIVERSAL_TABS`, וההבדל ביניהם יתבטא **רק** בתוכן טאב 7. **כל 7 הטאבים מוצגים תמיד, לכל GEM, ללא הסתרה** (החלטה 13) — טאב ללא תוכן מציג מצב-ריק "אין תוכן" במקום להיעלם.

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
        └─► effectiveBriefSlug (VideoDetailPanel.jsx:~2695-2700)
              = briefDisplayClassification?.slug
                ?? normalizedSubCategory
                ?? (marketBriefData?.contentType === 'marketBrief' ? 'morning-brief' : null)
```

`effectiveBriefSlug` (או `normalizedSubCategory` כ-fallback) מוזרם כ-prop `normalizedSubCategory` ל-`SpecializedContentRenderer` — זה ה-**router האמיתי** של טאב 7. **חדש ל-4 GEMS:** `SUB_CATEGORY_SLUG_MAP` (42-62) כבר מכיל `'technical-analysis'` ו-`'fundamental-analysis'` וגם `'macro'` כערכים מוכרים — אין צורך להוסיף slugs חדשים, רק לוודא שה-video מקבל את השם הקנוני הנכון (ראו החלטה 1 ו-Phase 2 המורחב).

### 1.3 הראוטר האמיתי: `SpecializedContentRenderer.jsx` — נבדק שוב, ללא שינוי

| טווח שורות | `slug` | מה קורה |
|---|---|---|
| 105-123 | `'fundamental-analysis'` | 6 sections קבועים: `financial-metrics`, `valuation`, `analysis-frameworks`, `investment-checklist`, `mistakes`, `checklists` — דרך `DedicatedContentSection` |
| 126-143 | `'technical-analysis'` | 5 sections קבועים: `indicators`, `setups`, `patterns`, `checklists`, `mistakes` |
| **146-159** | `'morning-brief' \|\| 'evening-brief'` | **תופס את שתי הערכים** → `MorningBriefDashboard` (9 קומפוננטות מוערמות, ללא תתי-טאבים) |
| **162-222** | `'evening-brief'` (שוב) | **מת — לא ניתן להגיע לכאן לעולם**, ראו 3.1 |
| 225-287 | `'weekly-brief'` | 12 sections ייעודיים inline |
| 290-350 | `'earnings-brief'` | 11 sections ייעודיים inline |
| 352-365 | macro (`slug==='macro'` **או** `marketBriefData.contentType==='market' && universalTabs קיים`) | `MacroGemDashboard` (קומפוננטה נפרדת) |
| 368-408 | `'political'` | 9 sections פוליטיים |
| 410-438 | **ברירת מחדל (הכל האחר)** | רשימה שטוחה מעורבת: `trading-brain`, `indicators`, `setups`, `patterns`, `checklists`, `mistakes`, `valuation`, `financial-metrics`, `cause-effect`, `market-impact` |

נבדק ישירות שוב (`grep` על `SpecializedContentRenderer.jsx`) — `MorningBriefDashboard`, `MacroGemDashboard`, ותנאי ה-146/162 קיימים באותם מיקומים, ללא שינוי. **המסקנה החשובה ל-4 GEMS:** הראוטר הזה **כבר מדגים בדיוק את התבנית המבוקשת** — כל `slug` מקבל רכיב/סט-sections נפרד. הוספת `technical`/`fundamental`/`macro-market` (השמות הסופיים — ראו החלטה 1) כ-GEMS נפרדים ברמת ה-**routing למעלה** (`gemContentRouter.js`/`gemRecommender.js`) פשוט מזינה את אותו `slug` שכבר קיים כאן — **אין צורך לגעת במבנה `SpecializedContentRenderer.jsx` עצמו לצורך זה**, רק להעשיר את תוכן ה-sections שכל branch מציג (טכני: רמות/תמיכה-התנגדות/פטרנים/אינדיקטורים; פונדמנטלי: דוחות/מכפילים/הערכת שווי/תזה; מאקרו ושוק: ריבית/אינפלציה/סקטורים/סנטימנט — לפי הצורך שכל GEM יחזיר).

### 1.4 סכימת ה-GEM (universalTabs.specialized) — ללא שינוי מהותי

`src/ai/gemini/schemas/morningBriefSchema.js` (75 שורות) — הצורה הקנונית שכל GEM מבזק בוקר אמור להחזיר. `resolveSpecialized()`/`getSpecializedSrc()` (`videoTabsConfig.js:350-356`, `morningBriefDisplay.js`) ממזגות 3 שכבות (`universalTabs.specialized` ← `rawData` ← flat) בעקבות union, לא clobbering.

### 1.5 טבלת section-key → sectionLabel → tabKey — ללא שינוי

כפי שתועד בגרסה הקודמת (`src/lib/morningBriefBulkSections.js:211-309`) — לא נגעתי בזה, אין השפעה על 4 ה-GEMS.

### 1.6 itemType / הפורמטרים ושכבת ה-stock המשותפת — נבדק שוב לעומק

`extractUnifiedStocks()` (`src/lib/morningBriefDisplay.js:1445-1529`) מאחדת stocks מכמה מקורות דרך `stockRecordFromObject()` (`morningBriefDisplay.js:1345-1420 בערך`). **נבדק ישירות:** `stockRecordFromObject()` מחזירה **צורה קבועה מוגדרת-מראש**, לא passthrough חופשי:

```js
{ ticker, company, context, sentiment, category, actionability, notes, rowTimestampSourceItems }
```

**זה משנה במעט את המסקנה של הגרסה הקודמת ("הטבלה כבר תומכת בהוספה תוספתית של שדות")** — זה נכון **בעיקרון** (התבנית של האפליקציה תמיד מוסיפה שדות אופציונליים חדשים, לא בונה טבלה מקבילה), אבל זו **לא הרחבה אוטומטית "בחינם"**: כדי ש-stock item מ-GEM טכני יישא `support`/`resistance` ומ-GEM פונדמנטלי יישא `peRatio`/`targetPrice`, יש לבצע שינוי קוד קונקרטי ב-`stockRecordFromObject()` (הוספת שדות אופציונליים חדשים, בדיוק כמו ש-`sentiment`/`actionability` כבר קיימים היום) — לא "זה כבר עובד". יש לתכנן את זה כצעד מפורש בתוך Phase הבנייה של ה-GEM הטכני (ראו Phase 5 להלן), לא כהנחה.

`extractUnifiedStocks()` היא **פונקציה משותפת יחידה** לכל ה-GEMS — **אין** לבנות טבלת stocks נפרדת per-GEM; זה מתאים במדויק לדרישת המשתמש.

### 1.7 שכבת ה-6 מרנדרי-שורות השמורות — ללא שינוי

כפי שתועד בגרסה הקודמת (`src/lib/workspaceRowSelection.js`, 6 renderers). ללא נגיעה בתכנון זה.

### 1.8 מיפוי סיווג פריטים קיים ברמת-הפריט — ללא שינוי

`src/lib/detectMarketEntityType.js` — תקדים ישיר לסיווג ברמת-item (החלטה 3 למטה בונה על זה).

---

## 2. מצב נוכחי של GEMS / TABS / MAPPING מול המטרה של 4 GEMS

### 2.1 GEMS (שכבת Gemini) — עדכון מהותי: מנגנון schema-export כבר קיים

**קיים, אושש מחדש:** `src/ai/gemini/gemContentRouter.js` — `CONTENT_TYPES = {MARKET_BRIEF, MACRO, DAILY_TRADING, FUNDAMENTAL, GENERAL, POLITICAL}` (32-39, ערכי מחרוזת: `marketBrief`, `macro`, `dailyTrading`, `fundamental`, `general`, `political`). `CONTENT_TYPE_TO_GEM` (55-62) כבר ממפה `dailyTrading → 'technical'` (gemKey!) — כלומר ה-*label* "טכני" קיים כבר כ-`gemKey`, רק שם ה-contentType-constant הפנימי (`DAILY_TRADING`) שונה מהמוסכמה. `GEM_PROMPT_CONFIG_TABLE` (121-176) — **כל** contentType שוק ההון (marketBrief/macro/dailyTrading/fundamental) מפנה **לאותה שלישיית** prompt/schema/validator (`promptBuilderKey: 'market'`, `schemaKey: 'market'`, `validatorKey: 'market'`) — אין עדיין schema נפרד לטכני מול פונדמנטלי מול מאקרו ברמת ה-JSON.

**ממצא חדש שמשנה את התכנון:** `src/ai/quickCopyPrompts.js` **כבר בנוי בדיוק לפי התבנית שהחלטה 9 מבקשת** — `getMarketSchemaExample()` (מיובא מ-`schemas/marketSchema.js`) משובץ ישירות בתוך `buildGeminiMarketQuickPrompt()`, וקיימים כבר 3 כפתורים ייעודיים ב-`QUICK_COPY_ACTIONS` (שורות 334-369): `gemini-technical` ("Gemini טכני", 📈), `gemini-fundamental` ("Gemini פונדמנטלי", 📊), `gemini-macro` ("Gemini מאקרו", 🌍) — כולם עדיין קוראים לאותה `buildGeminiMarketQuickPrompt`/סכימה שטוחה זהה (אין הבדל תוכן בין השלושה כרגע). **המשמעות:** אין צורך "להמציא" מנגנון schema-to-prompt — יש להרחיב אותו: לפצל `getMarketSchemaExample()`/את הוראות ה-prompt לשלוש גרסאות ייעודיות (או לשמור schema משותף + שדה `contentClass` מבחין, ראו החלטה 1), ולוודא שכל אחד משלושת הכפתורים הקיימים בונה בפועל את הפרומפט הייעודי-ל-GEM שלו.

**הפער שנותר:** אין עדיין שדה `contentClass`/מפתח ייעודי-item בתוך פלט ה-GEM, ואין 3 סכימות/פרומפטים נפרדים בפועל (רק 3 כפתורי UI שמצביעים כרגע על אותה סכימה).

### 2.2 TABS (תצוגה) — עודכן: אין עוד "class שלישי" מעורפל, יש 4 GEMS מפורשים

**קיים:** תשתית ה-Tab-7 (סעיף 1.3) **כבר תומכת בשני משלושת ה-GEMS השוקיים** (`technical-analysis`, `fundamental-analysis`) ובנפרד גם ב-`macro`. **הפער:** אין עדיין "class" מפורש ל"מאקרו ושוק" (מאקרו ותוכן שוק כללי יחד — decision 1(ב)) — כרגע macro מטופל לבד (`MacroGemDashboard`), ותוכן-שוק-כללי נופל ל-branch ברירת-המחדל (410-438) שמערבב הכל. Phase הבנייה של GEM ה-"מאקרו ושוק" (Phase 7 להלן) צריך להחליט אם להרחיב את `MacroGemDashboard` הקיים (מומלץ — הוא כבר "אזרח מדרגה ראשונה") או לבנות רכיב מקביל.

### 2.3 MAPPING (סיווג + ניתוב) — עודכן: אותו באג מדויק, אך כעת חוסם 3 GEMS לא class אחד

**קיים — נבדק שוב, ללא שינוי בעובדות:** יש **כבר שלושה** מסווגים חופפים חלקית: `resolveContentClassification()` (`gemContentRouter.js:213-268`), `classifyVideoForGem()`/`preGemClassifier()` (`gemRecommender.js:331-459, 585-659`), `detectVideoType()` (`videoTabsConfig.js:81-109`).

**באג-קונקרטי, נבדק שוב ומאושר בדיוק:** `gemRecommender.js`'s `GEM_CATEGORY_MAP.fundamental` (177-187, קרא נבדק ישירות) — `defaultSubCategory: 'ניתוח שוק'`, `subCategoryRules` labels: `'ניתוח יסודי'`, `'בחירת מניות'`, `'ניתוח שוק'` — **אף אחת לא תואמת** את הערך היחיד שמוכר ב-`SUB_CATEGORY_SLUG_MAP` בתור `fundamental-analysis`, שהוא **בדיוק** `'פונדמנטלי'`. עבור `technical` (188-197): `defaultSubCategory: 'ניתוח טכני'` **כן** תואם, אבל `'פרייס אקשן'`/`'אסטרטגיות מסחר'` לא. **המשמעות ל-4 GEMS:** זה הבאג המדויק שהופך את שתי הרשימות המלאות של `subCategoryRules` (עבור פונדמנטלי וטכני) ל"לא-נגישות" דרך ה-recommender האוטומטי — בדיוק הפער ש-Phase 2 (subCategory alignment) חייב לתקן **לפני** שמוסיפים override ידני (החלטה 8), כי אחרת המשתמש ילחץ "שנה GEM" כל פעם שהמלצת ברירת-המחדל שגויה עקב הבאג הזה.

**הפער:** MAPPING חסרה שכבת-איחוד מילולית בין שלושת המסווגים ובין `SUB_CATEGORY_SLUG_MAP`/`GEM_PROMPT_CONFIG_TABLE`/קטלוג Obsidian.

### 2.4 ניתוב Obsidian — ללא שינוי עובדתי, מוזן להחלטה 6

שני מנועי ניתוב מקבילים (`obsidianRouting.js:42-69` taxonomy, `obsidianExport.js`'s `OBSIDIAN_FOLDER_CATALOG`/`FOLDER_KEYWORD_RULES` keyword/catalog). הקטלוג כבר מכיל `שוק ההון/ניתוח טכני`, `שוק ההון/מאקרו`, וסובל משיבוש-שם משולש עבור פונדמנטלי (`שוק ההון/ספריית ידע/פונדמנטלי` מול `שוק ההון/ניתוח פונדמנטלי` מול `STOCK_ANALYSIS_SCREEN_BIBLE.md`'s שני שמות שונים). **המלצה שנותרת בתוקף:** `שוק ההון/ניתוח פונדמנטלי` כשם קנוני.

**החלטה 6 (מאקרו ושוק → תיקיות קיימות, לא תיקייה חדשה) מוזנת ישירות לכאן:** אין לפתוח תיקייה רביעית — GEM ה-"מאקרו ושוק" מנתב items לפי תת-נושא לתוך `שוק ההון/מאקרו` (לתוכן מאקרו טהור) או `שוק ההון/ניתוח חדשות` (לתוכן שוק-כללי/חדשותי), בהתאם למסווג הקיים ברמת-item (`detectMarketEntityType.js`, סעיף 1.8) ולא בתיקייה חדשה ייעודית ל-GEM עצמו.

### 2.5 שכבת סיווג-נלווה item-level — ללא שינוי

`detectMarketEntityType.js` — לא תחליף לסיווג class, אבל תשומה משלימה שימושית.

---

## 3. ממצאים וסיכונים (נבדקו שוב; ללא שינוי מהותי מלבד הרחבת 3.1/3.3)

### 3.1 [חשוב, החלטה 4] ענף evening-brief מת קוד — `SpecializedContentRenderer.jsx:146` תופס לפני `:162`
נבדק שוב ישירות (`grep`) — `slug === 'morning-brief' || slug === 'evening-brief'` בשורה 146 עדיין `return`-ת לפני שהקוד מגיע לענף הייעודי בשורה 162. **המשתמש קבע (החלטה 4): זה שלב עצמאי, לפני עבודת התכונה, עם commit נפרד** — לא עוד שאלה פתוחה.

### 3.2 [חשוב] `resolveTone()` ב-`morningBriefVisuals.js` — סיכון התנגשות עברית זהה ל-lessons.md (2026-08-30), עדיין לא מתוקן
ללא שינוי מהגרסה הקודמת. נשאר מחוץ לתחום אלא אם המשתמש מבקש לצרף לאחד השלבים (ראו סעיף "מחוץ לתחום").

### 3.3 [חשוב, מעודכן] "4 ה-GEMS" כבר קיימות חלקית ברמות שונות — ולא כולן באותה גרנולריות
ברמת ה-Obsidian/Brain/Tab-7 יש כבר "מסכים" נפרדים ל-`technical-analysis`, `fundamental-analysis`, `macro`. ברמת ה-GEM `CONTENT_TYPES` יש 6 (marketBrief/macro/dailyTrading/fundamental/general/political). ברמת `gemRecommender.js`'s `GEM_RULES`/`GEM_ALT_OPTIONS` יש 7 (fundamental/technical/news/macro/appBuilder/political/general) — **וכאן חשוב: `GEM_ALT_OPTIONS` כבר כולל `technical`, `fundamental`, `macro`, `news` (=מבזק) כמפתחות נפרדים** — כלומר ברמת ה-UI-selector (`GemSelectionModal`) 4-מתוך-4 ה-GEMS המבוקשים **כבר קיימים כמפתחות אפשריים לבחירה ידנית**, רק לא מיושרים אחד-לאחד עם ה-subCategory/schema/routing השלם. אף שכבה לא מיישרת עצמה בדיוק ל-4 GEMS **קוהרנטית**, אך הבסיס קיים בכל שכבה — זו הרחבה/יישור, לא בנייה מאפס.

### 3.4 [משני] `STOCK_ANALYSIS_SCREEN_BIBLE.md` עצמו סותר את עצמו — ללא שינוי
ראו 2.4. לא נבדק מחדש לעומק במסמך זה (מחוץ להיקף התיקון המבוקש), אך הפער נשאר מתועד.

### 3.5 [משני] תווית `'כללי'` כבר תפוסה — פחות רלוונטי כעת
מכיוון שהוחלט (החלטה 1) על "מאקרו ושוק" ולא "כללי", ההתנגשות עם `gemRecommender.js`'s `general` (בריאות/תזונה) נמנעת מראש. נשאר כתיעוד-רקע בלבד.

### 3.6 [משני] מסווגי keyword-substring — סיכון עברי מוכר
ללא שינוי. **רלוונטי במיוחד להרחבת `GEM_RULES`/`CONTENT_SIGNALS` לצורך 4 GEMS** — כל מקבץ מילות-מפתח חדש חייב להיבדק מול lessons.md (2026-08-26, 2026-08-22, 2026-08-30) לפני commit.

### 3.7 [משני] `docs/work-ledger.md` לא קיים ב-worktree הראשי
ללא שינוי.

---

## 4. אפשרויות תכנון למודל הסיווג (עודכן: הוכרע — אפשרות C, ללא backfill)

### אפשרות A — סיווג בזמן חילוץ (GEMS-time / מודל)
המודל (Gemini, בזרימת ה-paste-back הידנית — המשתמש כותב את 3 הפרומפטים החדשים בעצמו, החלטה 9) מוציא שדה `contentClass` על כל item רלוונטי כחלק מה-JSON. **יתרון:** דיוק גבוה, גרנולריות item-level "בחינם". **החלטה 5 (הישנה) התייתרה:** מכיוון שאין backfill בכלל (החלטה 5 החדשה), השאלה "האם מותר להשתמש בנתיב Gemini החי ל-backfill" כבר לא רלוונטית — **אין backfill, לא דרך API חי ולא דרך היוריסטיקה**. סרטונים חדשים בלבד עוברים ניתוח מחדש עם הפרומפטים החדשים.

### אפשרות B — סיווג בזמן תצוגה/שמירה (קוד טהור, client-side)
מסווג JS (בהשראת `resolveContentClassification`/`classifyVideoForGem`/`detectMarketEntityType`) שרץ על טקסט קיים. **שימוש מצומצם כעת:** מכיוון שאין backfill, אפשרות B **לא** נחוצה כמנגנון "מילוי-לאחור" — אבל **כן** נחוצה בגרסה מצומצמת בתוך Phase 6 (MAPPING ברמת item) כ-fallback ל-items שה-GEM לא סימן `contentClass` עבורם (למשל item ישן שנשמר לפני שהשדה נוסף לסכימה, בתוך אותו וידאו חדש).

### אפשרות C — היברידי (מומלץ, הוכרע)
מודל-מסמן-קדימה (A) + קוד-מסמן-לאחור (B) כ-fallback עם provenance מפורש: `{ contentClass, confidence, source: 'model' | 'heuristic-fallback' | 'unclassified' }` — **התבנית הקיימת כבר בכל שכבה אחרת** (universalTabs מועדף/rawData fallback; `resolveContentClassification()` כבר מחזירה `{contentType, confidence, confidencePct, reason, source}` היום). **הוכרע כאפשרות הסופית** — ראו Phase 6.

### Backfill — **בוטל לגמרי (החלטה 5)**
אין backfill בשום צורה לסרטונים/פריטים קיימים. המשתמש ימחק נתוני בדיקה ישנים ויבצע ניתוח-מחדש ידני לאחר שהמערכת החדשה עובדת. **שני caveats מפורשים:**
(א) המחיקה תתבצע **רק לאחר** שהמערכת החדשה אומתה כעובדת — לא לפני.
(ב) מחיקה בתוך האפליקציה **אינה** מוחקת notes שכבר יוצאו ל-Obsidian — אלו משטח נפרד ולא מושפע.

---

## 5. החלטות שהתקבלו (מחליף את "שאלות פתוחות" הקודם — כל 7 השאלות הישנות סגורות)

### החלטה 1 — שמות GEM/class ומפתחות אנגליים יציבים
**תוויות עברית (UI בלבד):** טכני / פונדמנטלי / מאקרו ושוק.
**מפתחות אנגליים יציבים לאחסון/Obsidian/schema** (לעולם לא התווית העברית עצמה נשמרת):
- `technical` — **מיושר עם `gemRecommender.js`'s `GEM_RULES[1].key === 'technical'` ו-`GEM_CATEGORY_MAP.technical`, הקיימים כבר בדיוק בשם הזה** — אין שינוי שם נדרש כאן.
- `fundamental` — **מיושר עם `GEM_RULES[0].key === 'fundamental'` ו-`GEM_CATEGORY_MAP.fundamental`, הקיימים כבר בדיוק בשם הזה**.
- `macroMarket` — **מפתח חדש**. נבחר camelCase כדי ליישר עם המוסכמה הקיימת ב-`gemContentRouter.js`'s `CONTENT_TYPES` (`marketBrief`, `dailyTrading` — camelCase, לא kebab-case) וב-`gemRecommender.js`'s `GEM_RULES` keys (`appBuilder` — camelCase). **הוכרע בהחלטה 11: `macroMarket` הוא מפתח נפרד לחלוטין, לא הרחבה של `macro` הקיים.** ה-`macro` הקיים (`GEM_CATEGORY_MAP.macro`, `SUB_CATEGORY_SLUG_MAP`'s `'macro'`, `MacroGemDashboard`, `CONTENT_TYPES.MACRO`) נשאר בדיוק כפי שהוא, ללא שינוי וללא ניתוב-מחדש — שני המפתחות מתקיימים זה לצד זה. ראו החלטה 11 לפירוט מלא כולל סיכוני התנגשות שאותרו בקוד (תווית UI, תיקיית Obsidian).
- ב-`SUB_CATEGORY_SLUG_MAP` (`videoTabsConfig.js:42-62`): הערכים `'technical-analysis'`/`'fundamental-analysis'`/`'macro'` **כבר קיימים** — אין להוסיף slugs חדשים ל-tab-7-routing, רק ליישר אליהם את שאר השכבות (Phase 2 המורחב).
- Obsidian: `שוק ההון/ניתוח טכני`, `שוק ההון/ניתוח פונדמנטלי` (קנוני, מתקן שיבוש קיים), `שוק ההון/מאקרו` (החלטה 6 — ללא תיקייה רביעית).

### החלטה 2 — סיווג ברמת-וידאו בלבד, מבוסס title+transcript
מחליפה את שאלה 3 הישנה (video-vs-item). ה-routing ל-4 GEMS קורה **פעם אחת, ברמת הווידאו כולו**, ב-GEM-selection time — לא per-item ברמה הזו. משפיע על: `gemRecommender.js` (רמת ההמלצה), `GemSelectionModal` (רמת הבחירה הידנית).

### החלטה 3 — מיזוג תוכן: וידאו אחד = GEM דומיננטי אחד; הפרדה בתוך טאב 7 ברמת item
וידאו "מעורב" **לא** נשלח לשני GEMS. הוא מנותב ל-GEM דומיננטי יחיד. הפרדה בין תוכן טכני/פונדמנטלי/מאקרו-ושוק בתוך אותו וידאו קורית **בתוך** טאב 7 של ה-GEM שכבר נבחר, ברמת item: item עם סיווג בטוח מקבל bucket תצוגה משלו; item לא-בטוח נופל לברירת-המחדל של הווידאו. זה מודל item-vs-video **בהיקף מצומצם** — בתוך GEM אחד שכבר נותב, לא לרוחב 4 GEMS. משפיע על: `SpecializedContentRenderer.jsx` (רינדור bucket-ים בתוך ה-branch הרלוונטי), schema/validator (שדה `contentClass` על item).

### החלטה 4 — תיקון evening-brief dead branch כשלב נפרד, לפני עבודת התכונה
ראו 3.1. Phase 0.5 להלן (לפני Phase 1) — commit נפרד, לא חלק מ-Phase של תכונה אחרת.

### החלטה 5 — אין backfill בכלל
ראו סעיף 4 לעיל. משפיע ישירות: מבטל את ה-Phase "Persistence + backfill" הישן במלואו. משפיע על `persistence-storage-engineer`'s scope — אין מיגרציית-רקע, רק שדה אופציונלי חדש לרשומות **חדשות**.

### החלטה 6 — מאקרו ושוק מנתב לתיקיות Obsidian קיימות, לא תיקייה חדשה
ראו 2.4. משפיע: `obsidianExport.js`'s `OBSIDIAN_FOLDER_CATALOG`/`FOLDER_KEYWORD_RULES` — לא נדרש שינוי מבני, רק ודא שה-routing-by-subtopic (item-level, לא GEM-level) עדיין עובד לתוכן מה-GEM החדש.

### החלטה 7 — מערכי הטאבים המתים נשארים כמות שהם
`TECHNICAL_TABS`/`FUNDAMENTAL_TABS`/`MACRO_TABS`/וכו' ב-`videoTabsConfig.js` — מפורשות **מחוץ לתחום**. אין למחוק, אין לחבר-מחדש.

### החלטה 8 — Manual GEM override, אחרי תיקון subCategory router
**עדכון קריטי מהסקירה מחדש: המנגנון כבר קיים** — `gemOverride` state, `GemSelectionModal`, כפתור "🔀 שנה GEM" (`VideoDetailPanel.jsx:2350-2351, 12886-12930`), נשמר דרך `saveVideoFields({ gemOverride: key })`, ומוצג/נבחר מ-`GEM_ALT_OPTIONS` (הנגזר מ-`GEM_RULES` ב-`gemRecommender.js`). **מה שנדרש בפועל, לא בנייה מאפס:**
1. לוודא ש-`GEM_ALT_OPTIONS`/`GEM_CATEGORY_MAP` וגם `GemSelectionModal.jsx`'s `ALL_FIXED_GEMS` כוללים את `macroMarket` כערך **חדש ונפרד** (החלטה 11 — לא הרחבה של `macro` הקיים) לצד `technical`/`fundamental` הקיימים.
2. לוודא שהבחירה הידנית (`onSave` ב-`GemSelectionModal`) קורית **לפני** שהמשתמש לוחץ על כפתור quick-copy הרלוונטי (`gemini-technical`/`gemini-fundamental`/`gemini-macro`) — כלומר ש-`effectiveGemInfo`/ה-label שמוצג ליד כפתורי ההעתקה משקף את ה-override, לא רק את ההמלצה האוטומטית.
3. חד-פעמי-לוידאו, בלי זיכרון נלמד/כלל-per-channel — **כבר כך היום** (אין persist ברמת ערוץ, רק ברמת `video.gemOverride`).
**סדר תלות מפורש:** אחרי Phase 2 (תיקון subCategory router) — כי חלק ניכר מהמלצות שגויות היום נובע מהבאג המדויק בסעיף 2.3, לא ממחסור ב-UI override.

**תיקון קריטי (החלטה 12, מסבב תשובות נוסף):** הנחת-העבודה כאן ש-`GEM_ALT_OPTIONS`/`GEM_CATEGORY_MAP` הם המקור שממנו `GemSelectionModal` שואב את רשימת הבחירה — **התבררה כלא-מדויקת**. `GemSelectionModal.jsx` משתמש במבנה נתונים נפרד ומוקשח (`ALL_FIXED_GEMS`, שורות 25-53), לא ב-`GEM_ALT_OPTIONS`. ראו החלטה 12 לפירוט המלא והשלכותיו על Phase 2.

### החלטה 9 — המשתמש כותב את 3 הפרומפטים ביד; האפליקציה חושפת רק את ה-schema
**עדכון קריטי מהסקירה מחדש: המנגנון כבר קיים חלקית** — `src/ai/quickCopyPrompts.js`'s `getMarketSchemaExample()` + `buildGeminiMarketQuickPrompt()` + 3 כפתורי `QUICK_COPY_ACTIONS` (`gemini-technical`/`gemini-fundamental`/`gemini-macro`) קיימים כבר, אך שלושתם עדיין מצביעים על **אותה** סכימה שטוחה זהה. הנדרש בפועל: לפצל את ה-schema/ההוראות (`schemas/marketSchema.js` או שלוש סכימות ייעודיות חדשות) כך שכל אחד מ-3 הכפתורים בונה prompt עם schema ייעודי-ל-class (כולל שדה `contentClass` מהחלטה 3, אם רלוונטי ברמת ה-item schema). המשתמש מעתיק את ה-schema הזה **ידנית** לתוך Gemini custom GEM prompt שהוא כותב בעצמו — האפליקציה **לא** מייצרת/שולחת prompt מלא ל-GEM חדש בזמן ריצה עבור 3 ה-GEMS החדשים (בניגוד ל-`buildGeminiNewsQuickPrompt()` המלא הקיים למבזק, שממשיך לעבוד כפי שהוא).

### החלטה 10 — טכני נבנה ראשון, מלא-מקצה-לקצה; פונדמנטלי ומאקרו-ושוק כשכפול מאוחר יותר
כל שלב-בנייה (schema, tab-7 rendering, stock-record extension, quick-copy prompt, Obsidian routing) נבנה ומאומת **על GEM הטכני בלבד** תחילה. פונדמנטלי ומאקרו-ושוק **לא** מקבלים redesign עצמאי — הם משכפלים את אותו מנגנון/shell שהוכח על טכני (ראו Phase 8 להלן).

### החלטה 11 — `macroMarket` הוא מפתח נפרד לגמרי, לא הרחבה של `macro` הקיים (סוגר את החלטה 1)
**המשתמש הכריע:** מפתח אנגלי חדש ונפרד — `macroMarket` — לא הרחבה של `macro` הקיים. **אומת בקוד:** `macro` נצרך היום בארבעה מקומות שנשארים **ללא כל שינוי**, קיימים זה לצד זה עם `macroMarket` החדש:
1. `SUB_CATEGORY_SLUG_MAP` (`videoTabsConfig.js:46,56`) — `'מאקרו': 'macro'`, `'macro': 'macro'`.
2. `GEM_CATEGORY_MAP.macro` (`gemRecommender.js:218-227`) — `defaultSubCategory: 'מאקרו'`, שלוש `subCategoryRules` (מדיניות מוניטרית / ניהול סיכונים / כלכלה גלובלית) — **מיושר נכון** מול ה-slug (בניגוד לבאג ב-`fundamental`/`technical` שתועד בסעיף 2.3 — ל-`macro` אין את הבאג הזה).
3. `GEM_RULES`/`GEM_ALT_OPTIONS`/`TJS_GEMS` (`gemRecommender.js:108-119,174`, `GemSelectionModal.jsx:31-36`) — `key: "macro"`, `label: "מאקרו"`, `icon: "🌐"` — GEM נבחר-ידנית עצמאי וקיים, בשימוש פעיל.
4. `gemContentRouter.js:34,57,131-136` — `CONTENT_TYPES.MACRO = 'macro'`, `CONTENT_TYPE_TO_GEM.macro = 'macro'`, `GEM_PROMPT_CONFIG_TABLE[MACRO].gemKey = 'macro'`.
5. `SpecializedContentRenderer.jsx:354` — `isMacroContent = slug === 'macro' || (...)` → `MacroGemDashboard`.

**אף אחד מהחמישה לא ישונה, לא יוסר ולא ינותב-מחדש.** `macroMarket` דורש תוספות **מקבילות**, לא עריכת הקיימות: slug חדש ושונה ב-`SUB_CATEGORY_SLUG_MAP` (למשל `'macro-market'`), ערך חדש `GEM_CATEGORY_MAP.macroMarket`, ערך חדש ב-`GEM_RULES`/רשימת ה-GEM_ALT_OPTIONS, ו-branch/condition חדש (או מורחב בזהירות) ב-`SpecializedContentRenderer.jsx` — נקודת ההחלטה הזו נדחית ל-Phase 8 (איך בדיוק ה-branch החדש מתייחס ל-`MacroGemDashboard` הקיים — קומפוננטה חדשה נפרדת, או אותה קומפוננטה עם prop המבחין class).

**שני סיכוני-התנגשות שאותרו בקוד ומדווחים במפורש, כנדרש — אינם "כנראה בסדר":**
- **סיכון תווית UI:** לאחר המימוש יהיו **שני GEMs נפרדים וחיים בו-זמנית עם תוויות עברית כמעט-זהות** — "מאקרו" (הישן, `key: macro`, `icon: 🌐`, חלק מ-`GEM_ALT_OPTIONS`/`TJS_GEMS`, ממשיך לפעול ב-`GemSelectionModal`) מול "מאקרו ושוק" (החדש, `key: macroMarket`, אחד מ-4 ה-GEMS הרשמיים). משתמש שבוחר GEM ידנית לוידאו מאקרו-כלכלי יראה **שתי** אפשרויות דומות-שם ברשימה (ברגע שהחלטה 12 מיישמת "תמיד כל 4 GEMS" — יתווספו לצד ה-`macro` הישן שכבר קיים ברשימה כיום). זה סיכון UX אמיתי, לא רק ניסוחי — יש להחליט ב-Phase 8 אם "מאקרו" הישן מוסתר/מוזז מהרשימה הרגילה כשהמשתמש עובד בהקשר 4-ה-GEMS, או אם שני התוויות נשארות זמינות זו לצד זו במודע.
- **סיכון תיקיית Obsidian:** לפי החלטה 6 (קיימת, לא השתנתה), `macroMarket` מנתב תוכן-מאקרו-טהור ל-**אותה** תיקייה קיימת `שוק ההון/מאקרו` שה-GEM `macro` הישן כבר כותב אליה. כלומר **שני GEMs נפרדים לגמרי ברמת ה-key יכתבו לאותה תיקייה בפועל** — אין הפרדה ויזואלית בין התוכן שמקורו ב-GEM הישן לתוכן שמקורו ב-`macroMarket` החדש בתוך ה-vault. יש להחליט ב-Phase 8/7 אם דרוש תג/frontmatter מבחין (`source-gem: macro` מול `source-gem: macroMarket`) בתוך אותה תיקייה, לא רק לבטוח ש"זה בסדר כי זו אותה תיקייה ממילא".

### החלטה 12 — Manual GEM override תמיד זמין; רשימה נדרשת להיות תמיד-מלאה, אך אינה כזו היום — נדרש תיקון UI קונקרטי
**המשתמש הכריע:** כפתור "🔀 שנה GEM" זמין תמיד, בכל מצב (המלצה בטוחה/לא-בטוחה/כבר-נדרס/`unclassified`) — לעולם לא מוסתר-מותנה. הרשימה מציגה תמיד את כל 4 ה-GEMS, ללא קשר להמלצה האוטומטית.

**מה אומת ותואם:** כפתור הפתיחה עצמו **כבר תמיד מוצג ללא תנאי היום**, בשני מקומות ב-`VideoDetailPanel.jsx`:
- שורות 12883-12889 ("🔀 שנה GEM", בתוך דיאלוג צפיית התמלול) — לא נמצא שום תנאי סביב הכפתור עצמו.
- שורות 11404-11410 ("💎 ניהול GEMS", בתוך פאנל הווידאו הראשי) — גם כאן ללא תנאי סביב הכפתור עצמו.
**מסקנה:** אין כאן שינוי התנהגות נדרש — הכפתור כבר תואם את ההחלטה כמות שהוא.

**מה נמצא כסתירה קונקרטית, לא רק "פרט ליישום":** ההנחה הקודמת של המסמך (בהחלטה 8 לעיל) ש-`GEM_ALT_OPTIONS`/`GEM_CATEGORY_MAP` הם המקור לרשימה שמוצגת ב-`GemSelectionModal` — **שגויה**. `GemSelectionModal.jsx` (שורות 25-53) בונה את הרשימה שלו ממבנה נתונים נפרד ומוקשח משלו — `ALL_FIXED_GEMS = [...FIXED_GEMS_TOP, MARKET_BRIEF_GEM, ...TJS_GEMS, ...KNOWLEDGE_MARKET_GEMS]` — כאשר `technical`/`fundamental` יושבים ב-`KNOWLEDGE_MARKET_GEMS` (שורות 46-49) ו-`macro` יושב ב-`TJS_GEMS` (שורות 31-36); **אין שם היום שום ערך `macroMarket`**. `GEM_ALT_OPTIONS` (מ-`gemRecommender.js`) כן משמש ב-`VideoDetailPanel.jsx` אך רק לחיפוש-תווית (`GEM_ALT_OPTIONS.find(g => g.key === gemOverride)`, שורות 2911-2912, 12929) — לא כמקור לרשימת הבחירה במודל עצמו.

**חמור יותר — הרשימה בפועל בתוך `GemSelectionModal.jsx` אינה תמיד-מלאה כפי שההחלטה דורשת, נמצאה סתירה ישירה:**
- כאשר `isMarketBriefWorkflowVideo(video)` מחזיר `true` (מוגדר ב-`gemRecommender.js:8-11` כ-`detectVideoType(video) === 'morningBrief' || 'eveningBrief'` — **בדיוק אוכלוסיית-היעד המרכזית** של תכונת 4-ה-GEMS), ה-branch הרלוונטי ב-`GemSelectionModal.jsx` (שורות 522-553) מציג רק את שורת `MARKET_BRIEF_GEM` בגלוי, ואת `political`/`technical`/`fundamental`/`general` **בתוך בלוק מקופל** (`hidden={!showAdditionalOptions}`, שורה 544) שמתחיל **סגור כברירת מחדל**, אלא אם כבר קיים override שמור שאינו `MARKET_BRIEF_GEM_KEY` (`shouldExpandAdditionalOptions()`, שורה 58). **ו-`TJS_GEMS` (שכולל `macro`) לא מוצג כלל ב-branch הזה** — כלומר עבור וידאו מבזק בוקר/ערב, `macro`/`macroMarket` אינו מוצג כאפשרות היום, בשום מצב.
- ב-branch השני (וידאו שאינו מבזק, שורות 554-562): `technical`/`fundamental` מוצגים ללא תנאי — תקין. אבל `macro` יושב בתוך accordion מקופל נפרד ("GEMS TJS", `renderTJSAccordion()`, שורות 405-441) שמתחיל **סגור** כברירת מחדל (`isExpanded = expandedCategory === "tjs"`).

**המסקנה, לא ניתנת לעקיפה:** "הרשימה תמיד מציגה את כל 4 ה-GEMS ללא תלות במצב" **אינה** נכונה בקוד הקיים היום — נדרש שינוי UI קונקרטי ב-`GemSelectionModal.jsx`, לא רק "וידוא": (1) הוספת `macroMarket` כערך חדש (קרוב לוודאי לצד `technical`/`fundamental` ב-`KNOWLEDGE_MARKET_GEMS`, או במבנה חדש ייעודי ל-4-ה-GEMS); (2) עבור `isMarketBriefWorkflow`, יש לפרוש (לא לקפל) את 4 ה-GEMS כברירת מחדל, ללא תלות ב-`showAdditionalOptions`; (3) להחליט אם `macro`/`macroMarket` נשארים בתוך ה-accordion "GEMS TJS" הנפרד (סיכון-בלבול, ראו החלטה 11) או עוברים לרשימת ה-4 הראשית. **Phase 2 עודכן בהתאם (ראו סעיף 6).**

### החלטה 13 — טאבים ריקים לעולם לא מוסתרים; מחליפה כל אזכור קודם של "הסתר טאב ריק"
**המשתמש הכריע:** כל 7 הטאבים תמיד מוצגים לכל GEM. טאב ללא תוכן מציג מצב-ריק עם הטקסט "אין תוכן" במקום להיעלם. **סיבה:** layout זהה בין 4 ה-GEMS, והמשתמש מעדיף לראות שהטאב קיים מאשר לתהות אם משהו חסר.

**אומת בקוד — אין סתירה, ואף יש כבר תבנית תואמת:** לא נמצאה שום לוגיקת hide-empty-tab ברמת ה-tab-bar עצמו (`VideoDetailPanel.jsx`'s `UNIVERSAL_TABS.map`, סעיף 1.1) — 7 הטאבים תמיד נבנים ללא תנאי. בתוך טאב 7, ה-branch ברירת-המחדל של `SpecializedContentRenderer.jsx` (410-438) **כבר מיישם בדיוק את הדפוס המבוקש**: כשאין תוכן (`defaultSects.length === 0`) הוא מציג הודעת-ריק בעיצוב קיים ("🎯 אין תוכן ייעודי לסרטון זה / נתח את הסרטון כדי לייצר תוכן ייעודי") **במקום** להסתיר את הטאב — זה תקדים-קוד ישיר לתבנית שהוחלטה, לא צריך להמציא מנגנון חדש, רק להעתיק את הדפוס ל-branches הייעודיים של טכני/פונדמנטלי/מאקרו-ושוק (Phase 5/8).

**כל האזכורים הקודמים במסמך שרמזו על הסתרת-טאב-ריק תוקנו (3 מיקומים, אין אף אחד שנותר):**
1. סעיף "מסקנה לתכנון" בסוף 1.1 — הוסר "ואפשרות הסתרה של טאב ריק", הוחלף בהפניה מפורשת להחלטה זו.
2. Phase 5 (סעיף 6 להלן) — קריטריון הקבלה ותיאור המטרה עודכנו מ"הסתר טאב ריק" ל"תמיד מוצג + מצב ריק 'אין תוכן'".
3. שאלה פתוחה 3 הישנה (סעיף 8 הקודם, "הסתר טאב ריק — שדה חדש או נגזר") — **הוסרה במלואה**, שאלה סגורה.

### החלטה 14 — `unclassified`/"ממתין לסיווג" הוא מצב pending בלבד, לא GEM חמישי — נמצאה סתירה בשני מסווגים, לא רק ב-Tab 7
**המשתמש הכריע:** וידאו שלא מסווג בביטחון לאף אחד מ-4 ה-GEMS מקבל תווית "ממתין לסיווג" (מפתח אנגלי לאחסון: `unclassified`) — מפורשות מצב **המתנה**, לא GEM/class חמישי. אין לו schema/Tab-7/תיקיית Obsidian ייעודיים משלו; הוא מוצג דרך אותו shell של 7 טאבים כמו כל GEM אחר, והמשתמש קובע GEM אמיתי ידנית דרך כפתור ה-override התמיד-זמין (החלטה 12).

**אומת בקוד — Tab 7 עצמו נקי, אך שני שכבות-הסיווג שמעליו לא ניטרליות ודורשות תיקון קוד קונקרטי:**
- **`SpecializedContentRenderer.jsx`'s default branch (410-438) — אין קונפליקט.** כשאין תוכן ייעודי, הוא פשוט מציג הודעת-ריק כללית (ראו החלטה 13) — אין class חמישי, אין קומפוננטה ייעודית, אין נתיב Obsidian מיוחד. השכבה הזו כבר "ניטרלית" כנדרש.
- **`gemRecommender.js`'s `classifyVideoForGem()` (שורות 393-408) — קונפליקט קונקרטי.** כש-`top.score === 0` (אין אות ברור בכלל), הפונקציה **לא** מחזירה מצב-המתנה ניטרלי — היא בוחרת אקטיבית ב-`gemKey: "general"` (`gemLabel: "כללי"`, `icon: "💡"`) **עם קטגוריה מפורשת** `recommendedCategoryCode: 'Health'`, `recommendedCategoryLabel: 'בריאות'`, `recommendedSubCategory: 'כללי'` — כלומר וידאו לא-ברור מקבל היום המלצה אקטיבית ולא-קשורה לתחום ("בריאות"), לא תווית-המתנה.
- **`gemContentRouter.js`'s `resolveContentClassification()` (שורות 259-267, "Phase 4: General fallback") — אותה תבנית קונפליקט.** מחזיר `contentType: CONTENT_TYPES.GENERAL`, `recommendedGem: 'general'`, `source: 'fallback'` — שוב, בחירה אקטיבית ב-GEM כללי, לא מצב `unclassified`/pending.

**המסקנה, לא ניתנת לעקיפה:** מימוש "ממתין לסיווג" **אינו** רק "לוודא שאין התנגשות" (כפי שהמשימה ניסחה מראש) — הוא דורש **שינוי קוד ממשי** בשתי הפונקציות האלה: להוסיף מסלול נפרד עבור "אין אות ברור בכלל" שמחזיר `{ recommendedGem: 'unclassified', confidence: null/'none', source: 'unclassified', ... }` (או ערך שקול) **במקום** ברירת-המחדל הנוכחית ל-`general`/בריאות. יש לוודא גם ש-`general`/"כללי" (ה-GEM האמיתי, הבלתי-קשור-לשוק, המיועד לתוכן אישי/בריאות) לא מתבלבל עם `unclassified` (מצב-המתנה חדש) — שני מושגים שונים לגמרי שכרגע ממופים לאותו key `general` בקוד. הוזן כקריטריון קבלה מפורש ב-Phase 1 (סעיף 6 להלן).

### החלטה 15 — `macro` הישן מוסר מרשימת ה-override הידני; המפתח `macro` עצמו לא נוגעים בו (סוגר שאלה פתוחה 1 מהסבב הקודם)
**המשתמש הכריע:** רשימת ה-override הידני (זו שהמשתמש בוחר ממנה, הנבנית דרך `GemSelectionModal.jsx`'s `ALL_FIXED_GEMS`, לפי ממצא החלטה 12) מכילה **בדיוק 4 ערכים**: מבזק בוקר/ערב (`brief`/`news`, לפי מפתח ה-`MARKET_BRIEF_GEM`/`news` הקיים), טכני (`technical`), פונדמנטלי (`fundamental`), מאקרו ושוק (`macroMarket`). **המפתח `macro` הישן אינו אחד מ-4 האפשרויות ברשימה הזו** — הוא GEM עצמאי, אבל לא GEM שהמשתמש בוחר ידנית לצורך ניתוח 4-ה-GEMS; לפי הממצא הקיים במסמך (סעיף 2.2 ו-`SpecializedContentRenderer.jsx:352-365`) הוא מנתב ל-`MacroGemDashboard` — משטח דשבורד, לא GEM-לניתוח-שבוחרים.

**מה בדיוק מוסר, ומה לא נוגעים בו — קריטי להבחין:**
- **מוסר (list-membership בלבד):** ערך ה-`macro` מוסר מתוך `ALL_FIXED_GEMS`/`TJS_GEMS` **בהיקף שבו הוא מוצג כאפשרות-בחירה לרשימת 4-ה-GEMS** (`GemSelectionModal.jsx:31-36` — כרגע `macro` יושב שם לצד `key`-ים אחרים ב-`TJS_GEMS`; יש להוציא אותו מהתצוגה הזו, לא למחוק את הרשומה מהקובץ אם היא משמשת גם למקומות אחרים — להכריע לפי המבנה בפועל ב-Phase 2).
- **לא נוגעים בהם, ללא שום שינוי** (כפי שכבר תועד בהחלטה 11, מאושר שוב כאן ללא סתירה): `SUB_CATEGORY_SLUG_MAP`'s `'macro'` (`videoTabsConfig.js:46,56`), `GEM_CATEGORY_MAP.macro` (`gemRecommender.js:218-227`), `GEM_RULES`/`CONTENT_TYPES.MACRO`/`CONTENT_TYPE_TO_GEM.macro`/`GEM_PROMPT_CONFIG_TABLE[MACRO]` (`gemContentRouter.js:34,57,131-136`), הענף `slug === 'macro'` → `MacroGemDashboard` (`SpecializedContentRenderer.jsx:354`). כל חמשת הצרכנים שתועדו בהחלטה 11 ממשיכים לפעול בדיוק כפי שהם היום.

**התוצאה, ופתרון הסיכון שתועד בהחלטה 11:** ה"סיכון תווית UI" שהחלטה 11 דיווחה עליו (שני GEMs עם תוויות עברית כמעט-זהות — "מאקרו" מול "מאקרו ושוק" — זמינים בו-זמנית ברשימת ה-override) **נפתר**: רשימת ה-override הידני מציגה מעתה רק "מאקרו ושוק" (`macroMarket`), לא "מאקרו" (`macro`). `macro` הישן ממשיך לפעול **כמשטח נפרד** (הדשבורד הקיים) שאינו נגיש דרך רשימת-הבחירה-הידנית-ל-4-GEMS, בדיוק כפי שאינו GEM-לבחירה כבר היום מבחינה מושגית.

**משפיע על Phase 2** (סעיף 6 להלן) — קריטריון קבלה חדש: הרשימה כוללת בדיוק 4 ערכים (brief/technical/fundamental/macroMarket), **ולא** כוללת `macro`, בכל branch של `GemSelectionModal.jsx` (כולל `isMarketBriefWorkflow` ו-accordion "GEMS TJS" — אם `macro` ממשיך לשבת שם למטרות אחרות, יש לוודא שהוא לא מופיע גם ברשימת-4-ה-GEMS המוצגת).

### החלטה 16 — `macroMarket` ו-`macro` חולקים את אותה תיקיית Obsidian; הבחנה דרך סימון-מקור בתוך כל note — נדרשת תוספת קטנה למנגנון הכתיבה בפועל, לא רתימה של מנגנון קיים כמות-שהוא
**המשתמש הכריע:** אין תיקייה רביעית (החלטה 6 נשארת בתוקף ללא שינוי) — `macroMarket` כותב לאותה `שוק ההון/מאקרו` שה-`macro` הישן כבר כותב אליה. כדי לשמור על תיקייה קריאה (שאדם או כלי עתידי יוכל להבחין איזה מפתח הפיק איזו note), כל note שנכתבת שם חייבת לשאת סימון שמזהה את המפתח שהפיק אותה.

**נבדק בקוד החי לפני כתיבת ההחלטה, כנדרש — נמצאו שלושה מנגנוני-תיוג אמיתיים וקיימים, אך אף אחד מהם אינו "רק להשתמש בו כמות שהוא" עבור נתיב-הכתיבה שבאמת ממלא את התיקייה המשותפת:**

1. **`buildObsidianItemMarker()` / `OBSIDIAN_ITEM_MARKER_PREFIX` (`src/lib/obsidianNoteMerge.js:6-14`)** — התג הקיים בפועל: `<!-- obsidian-item:${identityKey} -->`, מוטמע דרך `buildBulletBlock()` (`obsidianNoteMerge.js:57-62`) בסוף כל בולט שממוזג. **זה בדיוק ה-HTML-comment item-marker/identity-marker שהוזכר בהנחיה** — הוא קיים, בשימוש פעיל, וזה מנגנון ה-dedupe האמיתי היחיד של שכבת ה-merge. **אך:** התג בנוי מ-`identityKey`, שנבנה היום (`buildObsidianItemIdentityKey`, נצרך ב-`src/lib/obsidianVideoMergeItems.js:43-48`) מ-`{videoId, tabKey, sectionKey, text}` בלבד — **אין בו היום שום רכיב source-gem**. וחשוב יותר: לפי התיעוד המפורש בראש הקובץ (`obsidianNoteMerge.js:3`, "invisible in Obsidian reading view") — התג **בלתי-נראה** למשתמש שקורא את ה-note בפועל ב-Obsidian. לכן הוא מתאים ל-dedupe מכני, אבל **לא** מספק את המטרה המפורשת של ההחלטה ("אדם... יוכל להבחין") ללא שינוי נוסף.
2. **`buildFrontmatter()` (`src/lib/obsidianExport.js:473-492`)** — בונה בלוק YAML frontmatter אמיתי עם שדה `source` קיים כבר (שורה 483: `` `source: ${source}` ``, מותנה-קיום) ושדה `tags` (שורה 485) — **בדיוק סוג השדה האדיטיבי שההנחיה ציפתה למצוא**. **אך, ממצא קריטי שנבדק ולא הונח:** `buildFrontmatter()` נצרך רק בנתיבי-יצירת-note מלאה כמו `generateDailyNote()` (`obsidianExport.js:496` ואילך) — **הוא אינו נקרא בכלל** מתוך `writeObsidianWithItemMerge()`/`mergeItemsIntoObsidianNote()` (`src/lib/obsidianVaultMergeWrite.js:32-44`, `src/lib/obsidianNoteMerge.js:72-113`), שהוא **נתיב-הכתיבה בפועל** שממלא notes בתוך `שוק ההון/מאקרו` מתוך פעולות משתמש בווידאו (מאומת: `VideoDetailPanel.jsx:4886` קורא ל-`writeObsidianWithItemMerge`, לא ל-`buildFrontmatter`/`generateDailyNote`). note חדשה שנוצרת דרך המיזוג מקבלת רק `# {title}` (`obsidianNoteMerge.js:85-87`) — **ללא frontmatter כלל**. כלומר: שדה ה-`source` קיים בקודבייס, אך אינו מחווט לתוך זרימת-הכתיבה הרלוונטית להחלטה הזו.
3. **`resolveObsidianAnalysisTypeLabel()`/`ANALYSIS_TYPE_BY_CONTENT`/`ANALYSIS_TYPE_BY_SAVE` (`src/lib/obsidianExportMetadata.js:7-27,110-120`) + `applyObsidianExportMetadata()` (שורות 223-241)** — מייצר שורת "Analysis Type: ..." **נראית-לעין** בראש note (`buildObsidianExportMetadataHeader()`, שורה 178). זה המנגנון הקרוב ביותר ל"תג אנושי-קריא קיים" — אך **גם הוא לא נקרא** מתוך `writeObsidianWithItemMerge`/`mergeItemsIntoObsidianNote` (אותו ממצא כמו (2)) — הוא שייך לנתיב-ייצוא-note-שלם נפרד (למשל `applyObsidianExportMetadata` בשימוש דרך זרימות ייצוא אחרות ב-`buildWorkspaceZip.js`/`localKnowledgeItemStore.js`, לא דרך המיזוג-לתיקייה-משותפת).

**מסקנה, ללא בדיה:** נבדק בפועל וזה **לא** מקרה של "מנגנון קיים, רק תוסיפו לו ערך" — שלושת המנגנונים אמיתיים וקיימים, אך אף אחד מהם אינו כבר-מחווט לתוך נתיב-הכתיבה שבאמת ממלא notes משותפות ב-`שוק ההון/מאקרו`. הקרוב ביותר, מבחינת "תוספת קטנה על גבי דפוס קיים" (לא מנגנון מקביל חדש) הוא **הרחבת אותו `buildBulletBlock()`** (`obsidianNoteMerge.js:57-62`) שכבר בונה כל בולט שממוזג: להוסיף תג-מקור **נראה-לעין** קטן בתוך גוף הבולט עצמו (למשל תחילית `[macroMarket] ` לפני הטקסט, מיושמת רק כשה-item מגיע מה-GEM `macroMarket` — בולטים קיימים/מה-`macro` הישן נשארים ללא שינוי ויזואלי, non-breaking) — לצד הרחבה מקבילה של `buildObsidianItemIdentityKey`/`identityKey` (כבר קיים, `obsidianVideoMergeItems.js:43-48`) כך שיכלול רכיב source-gem, כדי שגם ה-marker הבלתי-נראה (dedupe) יבדיל בין שתי המקורות ולא יתפוס item מ-`macroMarket` כ"כבר קיים" כי item דומה כבר נכתב מ-`macro`. **זו תוספת קטנה על גבי אותה תבנית, לא מנגנון מקביל חדש.**

**משפיע על Phase 7/8** (סעיף 6 להלן) — קריטריון קבלה חדש: כל note שנכתבת ל-`שוק ההון/מאקרו` דרך `macroMarket` נושאת תג-מקור נראה-לעין המבחין אותה מ-`macro`; QA חדש מוודא שהתג מופיע ושה-identityKey לא מתנגש בין שני המקורות.

---

## 6. תוכנית מיושמת מדורגת (מעודכנת: טכני-קודם, ללא backfill, evening-brief כשלב עצמאי ראשון)

כל שלב עצמאי-לפריסה, עם תלות מפורשת רק כשבאמת קיימת. שמות סוכנים מאומתים מול `.claude/agents/*.md` בפועל (glob רץ מחדש עבור מסמך זה — כל השמות המשמשים למטה קיימים).

### Phase 0 — evening-brief dead branch fix (החלטה 4)
**סוכן מבצע:** `gemini-integration-engineer` (או `frontend-rtl-developer` אם התיקון נתפס כ-UI טהור — להכריע לפי אופי ה-diff בפועל; שני הסוכנים בעלי הרשאת כתיבה לקובץ).
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/components/dashboard/SpecializedContentRenderer.jsx` (שורות 146-222 בלבד).
**מטרה:** לתקן את תנאי ה-`if` בשורה 146 כך שהוא לא תופס `'evening-brief'` לפני שהקוד מגיע לענף הייעודי בשורה 162 — כדי שמבזקי ערב יציגו את ה-11 sections הייעודיים שלהם (📊 סקירת שוק, 📰 עדכוני שוק וכו') ולא את עיצוב הבוקר.
**קריטריוני קבלה מדידים:** וידאו עם `slug === 'evening-brief'` מגיע בפועל ל-branch 162-222 (בדיקת regression חדשה — כרגע לא קיימת כי הענף אף פעם לא רץ). וידאו `'morning-brief'` ממשיך להתנהג בדיוק כמו קודם (no regression).
**QA:** fixture חדש עם `slug: 'evening-brief'`, `npm run build`.
**Rollback:** שינוי תנאי `if` יחיד — `git revert` נקי.
**תלות:** אין. **חוסם** את Phase 1 ואילך רק במובן ש**אותו קובץ** ייערך שוב שם — יש לבצע כ-commit נפרד ומאושר לפני שממשיכים, לא לערבב diff.

### Phase 1 — subCategory router alignment (Phase 2 הישן, ממוקם ראשון בסדר הפיצ'רי בגלל החלטה 8)
**סוכנים מבצעים:** `decision-signal-engineer` (בעלים של `gemRecommender.js`) + `gemini-integration-engineer` (בעלים של `gemContentRouter.js`).
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/lib/gemRecommender.js` (`GEM_CATEGORY_MAP.fundamental`/`.technical`), `src/config/videoTabsConfig.js` (`SUB_CATEGORY_SLUG_MAP` אם צריך תוספת).
**מטרה:** לתקן את הבאג המדויק בסעיף 2.3 — כל label ב-`subCategoryRules` וגם כל `defaultSubCategory` יתאימו למחרוזת שמוכרת ב-`SUB_CATEGORY_SLUG_MAP`. **בנוסף (החלטה 14):** להחליף את ה-fallback הנוכחי ל"אין אות ברור" (`classifyVideoForGem()` שורות 393-408, `resolveContentClassification()` שורות 259-267) ממצב שבוחר אקטיבית `general`/"בריאות" למצב-המתנה ניטרלי `unclassified`/"ממתין לסיווג" — תוך הבחנה ברורה בין `unclassified` (מצב-המתנה החדש) לבין `general`/"כללי" (ה-GEM האמיתי, הבלתי-קשור, המיועד לתוכן בריאות/אישי).
**קריטריוני קבלה מדידים:** בדיקת-סגירה אוטומטית (QA script חדש) — לכל key ב-`GEM_CATEGORY_MAP`, כל label ב-`subCategoryRules`+`defaultSubCategory` נמצא ב-`SUB_CATEGORY_SLUG_MAP`. וידאו עם subCategory מ-`preGemClassifier`/`classifyVideoForGem` מגיע ל-branch הנכון ב-`SpecializedContentRenderer` ב-100% מהמקרים הנבדקים. וידאו ללא אות סיווג ברור מקבל `unclassified`/"ממתין לסיווג" משתי הפונקציות (לא `general`/"בריאות" כברירת מחדל) ומוצג עדיין דרך ה-shell הרגיל של 7 הטאבים (אין class חמישי).
**QA:** `gem-subcategory-alignment-qa.mjs` (חדש) + `market-stock-classification-qa.mjs`.
**Rollback:** שינוי מחרוזות config בלבד.
**תלות:** Phase 0 (קובץ שונה, אין התנגשות diff — אבל רצף לוגי).

### Phase 2 — Manual GEM override: תיקון UI קונקרטי, לא רק וידוא (החלטות 11, 12, 15)
**סוכן מבצע:** `frontend-rtl-developer` (עריכת `GemSelectionModal.jsx` — המקור האמיתי לרשימה, לא `GEM_ALT_OPTIONS`) בשיתוף `decision-signal-engineer` (עדכון `GEM_CATEGORY_MAP`/`GEM_RULES`).
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/lib/gemRecommender.js` (`GEM_RULES`/`GEM_CATEGORY_MAP` — הוספת `macroMarket` כערך **חדש ונפרד**, `macro` הקיים ללא שינוי — החלטה 11), `src/components/dashboard/GemSelectionModal.jsx` (הוספת `macroMarket` ל-`ALL_FIXED_GEMS`/למבנה הרלוונטי; **הוצאת `macro` מרשימת-4-ה-GEMS המוצגת — החלטה 15**; פתיחת ברירת-המחדל של 4 ה-GEMS ב-branch `isMarketBriefWorkflow` כך שאינה תלויה ב-`showAdditionalOptions`), `src/components/dashboard/VideoDetailPanel.jsx` (וידוא סדר: override → quick-copy label — הכפתורים עצמם כבר תמיד-מוצגים, אין צורך לשנות שם).
**מטרה:** לתקן בפועל את הפער שאותר בהחלטה 12 — כפתור הפתיחה כבר תמיד-זמין (אין צורך לגעת), אך רשימת ה-GEMS בתוך `GemSelectionModal` **אינה** תמיד מציגה את 4 ה-GEMS הנכונים כיום (מקופלת מאחורי "אפשרויות נוספות" עבור וידאו-מבזק, `macroMarket` כלל לא קיים, ו-`macro` עדיין יושב בתוך `TJS_GEMS`/accordion "GEMS TJS" ולא ברשימת-4-ה-GEMS — לפי החלטה 15 הוא **צריך להישאר מחוץ** לרשימה הזו, לא להצטרף אליה). לוודא שה-label המוצג ליד כפתורי quick-copy משקף את הבחירה הידנית.
**קריטריוני קבלה מדידים:** עבור וידאו מסוג מבזק בוקר/ערב, רשימת ה-override מציגה **בדיוק** 4 ערכים — brief/news, technical, fundamental, macroMarket — **ללא** צורך ללחוץ "אפשרויות נוספות" קודם, **ו-`macro` אינו מופיע ברשימה הזו** (החלטה 15). עבור וידאו רגיל, אותם 4 ערכים מוצגים ללא תלות במצב ה-accordion "GEMS TJS"; `macro` יכול להישאר נגיש דרך accordion "GEMS TJS" הנפרד (כמשטח-דשבורד עצמאי, לא כאחת מ-4 האפשרויות) אך לא ברשימה הראשית. בחירת GEM ידנית משנה את ה-label/icon המוצג ליד כפתורי quick-copy הרלוונטיים לפני ההעתקה (visual regression check). ההמלצה האוטומטית עדיין מוצגת כברירת מחדל (`recommendedGemKey`) כשלא בוצע override.
**QA:** בדיקה ידנית + `npm run build`.
**Rollback:** שינוי תוסף ל-config/קומפוננטה קיימת, הפיך.
**תלות:** Phase 1.

### Phase 3 — Schema-export ייעודי ל-3 GEMS (החלטה 9)
**סוכן מבצע:** `gemini-integration-engineer`.
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/ai/gemini/schemas/marketSchema.js` (פיצול/הרחבה), `src/ai/quickCopyPrompts.js` (`buildGeminiMarketQuickPrompt` → 3 גרסאות ייעודיות או פרמטר `gemClass`), `QUICK_COPY_ACTIONS` (עדכון 3 הכפתורים הקיימים `gemini-technical`/`gemini-fundamental`/`gemini-macro` לקרוא לגרסה הייעודית).
**מטרה:** לחשוף schema ייעודי-ל-class בפורמט שהמשתמש יכול להעתיק-ולהדביק לתוך פרומפט Gemini custom GEM שהוא כותב בעצמו. **טכני תחילה** (החלטה 10) — Phase זה יכול לספק את שלושת ה-schemas יחד (כי זו עבודת config), אך ה-QA/verification המלא מתבצע קודם על הטכני בלבד.
**קריטריוני קבלה מדידים:** schema הטכני כולל שדות ייעודיים (support/resistance/patterns/indicators, בהתאם ל-`TECHNICAL_TABS`/technical-analysis branch הקיים). JSON קיים ללא ההבדלים החדשים ממשיך להתפרסר (regression).
**QA:** בדיקה ידנית מול כלל "no ASCII quote in string values", `npm run build`.
**Rollback:** שדה/schema חדש — לא שובר קיים.
**תלות:** אין תלות טכנית קשיחה ב-Phase 1/2, אך מומלץ אחרי Phase 1 כדי שהתוויות תואמות.

### Phase 4 — GEMS: שדה contentClass ברמת item (Phase 1+3 הישנים ממוזגים, ממוקד טכני)
**סוכן מבצע:** `gemini-integration-engineer`.
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/ai/gemini/schemas/marketSchema.js`, `src/ai/gemini/validators/validateMarket.js`, `src/ai/gemini/gemContentRouter.js`.
**מטרה:** הוספה תוספתית (non-breaking) של שדה `contentClass` (`'technical'|'fundamental'|'macroMarket'|null`) לכל item-shape רלוונטי (stocksMentioned, opportunities, risks וכו') — ממומש ונבדק תחילה על ה-GEM הטכני, לפי החלטה 10.
**קריטריוני קבלה מדידים:** JSON קיים (ללא contentClass) ממשיך להתפרסר זהה. Regression fixtures ירוקים.
**QA:** `npm run test:*` הרלוונטיים ל-gems, `npm run build`.
**Rollback:** שדה אופציונלי, הסרה הפיכה.
**תלות:** Phase 3.

### Phase 5 — TABS: הצגת GEM הטכני בטאב 7, כולל item-level bucket (החלטה 3)
**סוכן מבצע:** `frontend-rtl-developer`.
**סוכן שוער:** `qa-release-reviewer` (Gate 8 RTL).
**קבצים צפויים:** `src/components/dashboard/SpecializedContentRenderer.jsx` (branch `technical-analysis`, שורות 126-143 — הרחבה, **ללא** נגיעה ב-`UNIVERSAL_TABS`), רכיב bucket-display קטן במידת הצורך (בסגנון `DedicatedContentSection` הקיים).
**מטרה:** להציג תוכן טכני בטאב 7, כולל הפרדת items לפי `contentClass` בתוך אותו וידאו (החלטה 3). **טאב 7 מוצג תמיד, ללא הסתרה (החלטה 13)** — כשאין תוכן, מוצג מצב-ריק "אין תוכן" בסגנון הדפוס הקיים כבר ב-`SpecializedContentRenderer.jsx`'s default branch (410-438, "אין תוכן ייעודי לסרטון זה") — להעתיק את אותו דפוס ל-branch הטכני, לא להמציא לוגיקת הסתרה חדשה.
**קריטריוני קבלה מדידים:** `UNIVERSAL_TABS.length === 7` ללא שינוי, וטאב 7 מוצג בכל מצב (גם ללא תוכן כלל — לא נעלם מה-tab bar). וידאו `technical-analysis` טהור (ללא items מעורבים) מוצג זהה-בפיקסל למצב היום. וידאו `technical-analysis` ללא תוכן כלשהו מציג מצב-ריק "אין תוכן" בטאב 7 (לא מסתיר את הטאב). RTL checklist מלא.
**QA:** `npm run build`, `dedicated-content-selection-qa.mjs`, `specialized-section-order-qa.mjs`.
**Rollback:** תוספת בתוך branch קיים — הסרה הפיכה.
**תלות:** Phase 4.

### Phase 6 — הרחבת שכבת ה-stock המשותפת עם שדות טכניים (סעיף 1.6)
**סוכן מבצע:** `decision-signal-engineer` (בעלים של הלוגיקה שמזינה ניקוד/שדות) בשיתוף `gemini-integration-engineer`.
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/lib/morningBriefDisplay.js` (`stockRecordFromObject()` — הוספת שדות אופציונליים `support`/`resistance`/וכו', **לא** טבלה מקבילה).
**מטרה:** לוודא ש-`extractUnifiedStocks()` הקיים מציג שדות טכניים כשה-GEM הטכני מספק אותם, בלי לשבור את המבנה המשותף ל-4 ה-GEMS.
**קריטריוני קבלה מדידים:** stock item ללא שדות טכניים ממשיך להיות מוצג זהה (regression). stock item עם שדות טכניים חדשים מציג אותם בפועל.
**QA:** regression fixture + `npm run build`.
**Rollback:** שדות אופציונליים, הפיך.
**תלות:** Phase 4, Phase 5.

### Phase 7 — Obsidian routing עבור GEM הטכני
**סוכן מבצע:** `obsidian-sync-engineer`.
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** `src/lib/obsidianExport.js` (וידוא `שוק ההון/ניתוח טכני` כבר קנוני — נבדק, כן קיים; רק לוודא שרשומות עם ה-subCategory המתוקן (Phase 1) אכן מגיעות לשם).
**מטרה:** לוודא שה-taxonomy route וה-keyword/catalog route מסכימים על התיקייה עבור GEM טכני, **לפני** שמפעילים ניתוב אוטומטי מבוסס-MAPPING על תוכן חי.
**קריטריוני קבלה מדידים:** בדיקת-הסכמה אוטומטית בין שני מנועי הניתוב עבור `technical-analysis` (לא קיימת היום — פער מתועד ב-`obsidian-sync-engineer.md`).
**QA:** `node scripts/obsidian-note-merge-qa.mjs` (temp vault בלבד — אסור לכתוב ל-vault האמיתי).
**Rollback:** שינוי מחרוזת, הפיך.
**תלות:** Phase 1.

### Phase 8 — שכפול ל-פונדמנטלי ומאקרו-ושוק (החלטה 10 — לא redesign, שכפול מוכח; כולל סימון-מקור Obsidian מהחלטה 16)
**סוכן מבצע:** `gemini-integration-engineer` + `frontend-rtl-developer` + `obsidian-sync-engineer` (אותה חלוקת עבודה כמו Phases 3-7, מוחלת פעמיים).
**סוכן שוער:** `qa-release-reviewer`.
**קבצים צפויים:** אותם קבצים כמו Phases 3-7, בהרחבה ל-`fundamental-analysis` (schema/branch כבר קיים חלקית — 105-123) ול-`macroMarket` (schema חדש, branch/condition **חדש** ב-`SpecializedContentRenderer.jsx` נפרד מ-`slug === 'macro'` הקיים — החלטה 11; להכריע כאן אם משתמש ב-`MacroGemDashboard` הקיים עם prop-מבחין או בקומפוננטה נפרדת). **בנוסף (החלטה 16):** `src/lib/obsidianNoteMerge.js` (`buildBulletBlock()` — הוספת תג-מקור נראה-לעין כש-item מקורו ב-`macroMarket`), `src/lib/obsidianVideoMergeItems.js` (`buildObsidianItemIdentityKey`-consumers — הרחבת ה-identityKey ברכיב source-gem כדי שלא יתנגש עם items מ-`macro`).
**מטרה:** לשכפל את המנגנון שהוכח על טכני — **לא** לעצב מחדש. שם התיקייה הפונדמנטלי מתוקן ל-`שוק ההון/ניתוח פונדמנטלי` (2.4) כחלק מהעבודה הזו. עבור `macroMarket` בלבד (לא `fundamental`): לממש את סימון-המקור בתוך notes שנכתבות ל-`שוק ההון/מאקרו` המשותפת עם `macro` הישן (החלטה 16) — תוספת נראית-לעין בגוף הבולט, ללא שינוי ב-notes/בולטים קיימים שמקורם ב-`macro`.
**קריטריוני קבלה מדידים:** אותם קריטריונים כמו Phase 5-7, מוחלים על שני ה-GEMS הנוספים. שם תיקיית Obsidian הפונדמנטלי מיושר לגמרי (בדיקת-הסכמה חדשה, כמו Phase 7). **חדש (החלטה 16):** כל note/בולט שנכתב ל-`שוק ההון/מאקרו` דרך `macroMarket` נושא תג-מקור נראה-לעין (למשל תחילית `[macroMarket]`) שמבחין אותו מתוכן שמקורו ב-`macro`; בולטים קיימים שמקורם ב-`macro` נשארים ללא שינוי ויזואלי (regression); item מ-`macroMarket` ו-item דומה-בתוכן מ-`macro` לא נתפסים כאותו `identityKey` (בדיקת אי-התנגשות dedupe חדשה).
**QA:** אותה חבילת QA, מוכפלת. **חדש:** בדיקת סימון-מקור + אי-התנגשות identityKey בין `macro`/`macroMarket`, temp-vault בלבד.
**Rollback:** אותו, הפיך.
**תלות:** Phase 3-7 (מוכחים על טכני קודם — Phase זה **לא** מתחיל לפני שטכני עבר QA מלא).

### Phase 9 — שכבת ה-Workspace/saved-rows + QA סופי לכל 4 ה-GEMS
**סוכן מבצע:** `frontend-rtl-developer`.
**סוכן שוער:** `qa-release-reviewer` (שער סגירה סופי).
**קבצים צפויים:** `src/utils/workspaceSavedAnalysis.js`, שכבת ה-6 renderers (סעיף 1.7) — תוספת בלבד.
**הערה קריטית לתיאום, ללא שינוי מהגרסה הקודמת:** ענף זה נוגע ישירות באותם קבצים שכרגע בעבודה לא-מקומיטת ב-branch `feat/saved-market-rows-table`. **אסור להתחיל Phase 9 לפני שאותה עבודה מקומיטת/ממוזגת.**
**מטרה:** אפשרות לסנן/לתייג שורות שמורות לפי `contentClass`/GEM, ללא שבירת `recordIds`/`selectedIds`.
**QA:** כל 6 סוויטות ה-saved-rows הקיימות.
**Rollback:** שדה תצוגה תוספתי, הפיך.
**תלות:** Phase 8, ומיזוג `feat/saved-market-rows-table`.

**שער סיום קבוע לכל Phase:** `qa-release-reviewer` מריץ את 11 השערים המתועדים שלו לפני כל commit-מוכן-למיזוג.

---

## 7. מחוץ לתחום (Not in Scope) — מעודכן

- **הוספת טאב-על שמיני** — סותר Hard Stop מתועד. אין שינוי מהגרסה הקודמת.
- **מחיקת מערכי הטאבים המתים** (`TECHNICAL_TABS` וכו') — **סגור סופית** לפי החלטה 7 (לא רק "דורש שיחה" כמו קודם — נשארים כמות שהם, נקודה).
- **Backfill בכל צורה** (מודל או היוריסטיקה) לסרטונים/items קיימים — **סגור סופית** לפי החלטה 5. הוסר מהיקף העבודה במלואו, כולל ה-Phase הישן "Persistence + backfill".
- **תיקון `resolveTone()`** (3.2) — סיכון מזוהה, לא משימה, אלא אם המשתמש מבקש לצרף לאחד השלבים.
- **מיזוג שני מנועי ניתוב ה-Obsidian ליחיד** — פרויקט ארכיטקטוני נפרד; Phases 7/8 רק מיישרים שמות.
- **פתיחת GEM/class חמישי** — לא רק "לא בהיקף", אלא **נשלל במפורש**: 4 GEMS הם המספר הסופי (מבזק + טכני + פונדמנטלי + מאקרו-ושוק).
- **זיכרון-override נלמד/per-channel** — נשלל במפורש בהחלטה 8: בחירה חד-פעמית לוידאו, לא כלל שנשמר.
- **פרומפטים שהאפליקציה מייצרת/שולחת אוטומטית ל-3 ה-GEMS החדשים** — נשלל במפורש בהחלטה 9: המשתמש כותב את הפרומפטים בעצמו ב-Gemini; האפליקציה חושפת schema בלבד (בניגוד ל-`buildGeminiNewsQuickPrompt` המלא הקיים למבזק, שממשיך לפעול כפי שהוא).
- **שינוי כל הגדרות ה-AI המוגנות** (`vite.config.js`, `max_tokens`, timeouts, chunking, `GEMINI_MOCK`) — מחוץ לתחום לחלוטין ללא אישור נפרד.
- **שינוי מבנה `.claude/worktrees/`** — לא בתחום.
- **כתיבה אמיתית ל-vault Obsidian האמיתי** בכל שלב QA — רק temp-vault.
- **שינוי `docs/work-ledger.md`** — לא קיים ב-branch הראשי, לא נוצר/נערך על ידי המסמך הזה.

---

## 8. שאלות פתוחות (מעודכן — 2 מתוך 4 נסגרו בסבב הנוכחי)

**4 השאלות הקודמות (macroMarket key / מיקום UI ל-override / הסתר-טאב-ריק / unclassified מהסבב הקודם-לקודם) נענו והפכו להחלטות 11-14 (סעיף 5 לעיל). מתוך 4 השאלות הצרות-יותר שנפתחו בעקבותיהן, 2 נענו בסבב הנוכחי והפכו להחלטות 15-16. נותרו 2 שאלות פתוחות, ללא שינוי בניסוחן:**

1. **[מהחלטה 12] מה בדיוק קורה ל-`macro`/`macroMarket` בתוך ה-accordion "GEMS TJS" הנפרד (`renderTJSAccordion`, `GemSelectionModal.jsx:405-441`)?** לפי החלטה 15, `macro` אינו אחד מ-4 האפשרויות ברשימה הראשית — אך האם הוא נשאר בתוך accordion "GEMS TJS" (כמשטח-דשבורד נגיש בנפרד, לא כאחת מ-4 האפשרויות), או מוסר גם משם? זו החלטת UX סופית שיש לאשר לפני מימוש Phase 2, אך אינה חוסמת את הקריטריון המרכזי של Phase 2 (הרשימה הראשית מכילה בדיוק 4 ערכים ולא כוללת `macro`) — שכבר הוכרע.
2. **[מהחלטה 14] תווית "ממתין לסיווג" — מוצגת איפה בדיוק ב-UI?** ליד ה-GEM indicator הקיים (כמו `effectiveGemInfo?.gemLabel` שכבר מוצג ב-`VideoDetailPanel.jsx:12878`, `11398`), כתחליף זמני ל-label כשאין GEM מזוהה בביטחון? יש לאשר מיקום/ניסוח מדויק בתחילת Phase 1.

---

## 9. Branch ו-Worktree מומלצים — ללא שינוי מהותי מהגרסה הקודמת

**Branch בסיס:** `main`, לא `feat/saved-market-rows-table`. Phase 0 (evening-brief fix) ו-Phases 1-8 (עד Phase 9) לא נוגעים באף קובץ שכרגע לא-מקומיט ב-`feat/saved-market-rows-table` (`package.json`, `scripts/saved-news-rows-qa.mjs`, `scripts/test-specialized-news-sectors-mapping.mjs`, `MorningBriefBulkCheckbox.jsx`, `MorningBriefNewsSection.jsx`, `VideoDetailPanel.jsx`**\***, `UniversalTabQuickSaveActions.jsx`, `SavedNewsRows.jsx`, `WorkspaceSaveReviewOverlay.jsx`, `morningBriefBulkSections.js`, `morningBriefNewsNormalize.js`, `universalTabBulkItems.js`, `workspaceSavedAnalysis.js`, ועוד קבצים untracked שנוספו מאז — `newsSelectionMetadata.js`, `workspaceSelectionDraft.js`, `WorkspaceRecordRevealContext.jsx`, `workspaceSaveNavigation.js`).

**\* הערה חשובה שלא הייתה בגרסה הקודמת:** Phase 2 (Manual GEM override) **כן** נוגע ב-`VideoDetailPanel.jsx` — אותו קובץ שנמצא כרגע בעבודה לא-מקומיטת בסשן המקביל. יש לתאם/לחכות שהעבודה המקבילה תקומיט לפני התחלת Phase 2, לא רק Phase 9 כמו בגרסה הקודמת.

**Worktree מבודד:** מומלץ בחוזקה, מאותם נימוקים כמו בגרסה הקודמת (worktrees מקבילים קיימים, סיכון התנגשות). ליצור worktree חדש ידנית עם `git worktree add <נתיב מחוץ ל-.claude/worktrees/> main`, ולוודא HEAD/status טרי בתחילת כל Phase.

---

*מסמך זה תוכנן/עודכן בלבד. לא בוצע שום commit, לא נערך שום קובץ קוד, לא הופעל שום שרת. ממתין לסקירת המשתמש.*
