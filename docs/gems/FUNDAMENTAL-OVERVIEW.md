# FUNDAMENTAL-OVERVIEW — ג'ם פונדמנטלי לימודי

**WORK-ID:** TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA
**מטרת המסמך:** נקודת-כניסה יחידה למי שנכנס לפיצ'ר הזה בעוד שבוע. לא מחליף את `AUDIT-TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA.md` / `GEM-FUNDAMENTAL-SCHEMA.md` / `GEM-FUNDAMENTAL-INSTRUCTIONS.md` — מקשר אליהם ומצטט מהם. נכתב מול הקוד בפועל (`git status`/`git diff` על ה-worktree הנוכחי, לא הועתק מתוכניות). כל השדות/הקבצים כאן קיימים ב-working tree כרגע — **לא committed**.

**⚠️ קרא את סעיף 7 לפני כל דבר אחר** — יש התנגשות ארכיטקטונית ממשית בין מה שהמסמכים הקיימים אומרים למה שהקוד עושה כרגע.

---

## 1. מה הג'ם הפונדמנטלי עושה

GEM ב-Gemini (מוגדר חוץ-לאפליקציה, טקסט ה-System Instructions שלו ב-`docs/gems/GEM-FUNDAMENTAL-INSTRUCTIONS.md`) שמקבל תמלול של סרטון יוטיוב בעברית העוסק בניתוח פונדמנטלי, ומחזיר **חומר לימודי לשימוש חוזר** — מושגים, מסגרות ניתוח, יחסים פיננסיים, 26 KPI, תבניות פרומפט — **לא** המלצת קנייה/מכירה על מניה ספציפית ולא ניבוי מחיר. הפלט מודבק ידנית באפליקציה דרך דיאלוג "הדבק JSON מ-GEMS" (`VideoDetailPanel.jsx`).

## 2. חוזה ה-JSON השטוח — כל שדה, מי מרנדר אותו, file:line

מקור: `GEM-FUNDAMENTAL-SCHEMA.md` §3/§5 (נגזר מקריאת קוד, לא מתוכנית) — הטבלה כאן מצטטת ומעדכנת אותו למצב הקוד הנוכחי בפועל (ראו תיקונים ב-§4 למטה).

| שדה JSON | נכתב על `video` ע"י | מוצג ב-טאב | case/מיקום תצוגה |
|---|---|---|---|
| `shortSummary` | `normalizeAiAnalysisResult` (`videoAnalytics.js:1156-1162`) | 1 (סיכום) | `videoTabsConfig.js` case `'summary'`, ~שורה 689 |
| `fullSummary` | `:1163-1169` | 1 (סיכום) | **מוצג כעת בנפרד מ-`shortSummary`, לא רק fallback** — ר' §4 |
| `mainLesson` | `:1125-1129, 1177` | 1 (סיכום) | **מוצג כעת כפריט נפרד באותו טאב** — ר' §4 |
| `chapters` | `:1092-1100, 1227` | 2 (פרקים) | case `'chapters'`, ~703 |
| `keyInsights` | `:1187-1194` | 3 (תובנות) | case `'insights'` legacy, ~814 |
| `usefulKnowledge` | `:1225` | 4 (ידע שימושי) | case `'useful-knowledge'` legacy, ~735 |
| `frameworks` | `:1204-1206` | 4 — ⚙️ מסגרות ניתוח | `VideoDetailPanel.jsx` תוכן-לימודי array, case `'analysis-frameworks'` |
| `checklists` | `:1198-1200` | 4 — ✅ צ'קליסטים | case `'checklists'` |
| `mistakesToAvoid` | `:1184-1186` | 4 — ❌ טעויות נפוצות | case `'mistakes'` |
| `warnings` | `:1201-1203` | 4 — ❌ טעויות נפוצות (מוזג, לא נפרד) | **מוצג כעת, ממוזג עם `mistakesToAvoid`** — ר' §4 |
| `financialMetrics` | `:1207` (נוסף 2026-09-10) | 4 — 📈 מדדים פיננסיים | case `'financial-metrics'` |
| `valuation` | `:1208` (נוסף 2026-09-10) | 4 — 💰 הערכת שווי | case `'valuation'` |
| `investmentChecklist` | `:1209` (נוסף 2026-09-10) | 4 — 📋 צ'קליסט השקעה | case `'investment-checklist'` — fallback ל-`checklists` רק אם ריק |
| `promptTemplates` | `:1210` (נוסף 2026-09-10) | 4 — 📜 תבניות פרומפט | case `'prompt-templates'` (חדש) |
| `tags` | `:1180` | 6 (נושאים ותתי־נושאים) | case `'topics-subtopics'` legacy |
| `stockFundamentals` | `:1213-1214` (נוסף 2026-09-11, normalizer ייעודי — לא `normalizeLearningArray`) | 7 (תוכן ייעודי) — 📊 נתונים פונדמנטליים (**חדש**) | case `'stock-fundamentals'` (`videoTabsConfig.js`) → `<StockFundamentalsSection>` |
| — | — | 5 (APP) | **לא נגיש כלל** — `AppBuilderTab.jsx` תלוי רק ב-`marketBriefData`, שלעולם `null` בנתיב הזה (`GEM-FUNDAMENTAL-SCHEMA.md` §6) |
| — | — | 7 (תוכן ייעודי) | **ר' §7 — זו הסתירה המרכזית של המסמך הזה** |

שער-הקבלה (`validateGemsJsonValue`, `gemsJsonRepair.js:248-301`): לפחות שדה אחד מ-`GENERIC_ANALYSIS_FIELDS` (`shortSummary`/`fullSummary`/`keyPoints`/`allPoints`/`chapters`/`keyInsights`/`usefulKnowledge`/`actionItems`/`politicalSummary`/`brainHighlights`) חייב להופיע ברמת השורש, אחרת ה-JSON נדחה במלואו לפני `normalizeAiAnalysisResult`.

**שדות שכתובים אך אף פעם לא נצפים היום:** אין — ר' §4, שני הפערים היחידים מסוג זה שתועדו נסגרו בקוד. השדה `analysisFrameworks`/`riskRules` (שמות שגויים, לא `frameworks`/לא נתמך) יושמטו בשקט אם ה-GEM יחזיר אותם — לא באג, שם-שדה לא נכון.

## 3. התבנית הקבועה לפריט וה-🧠 סמן-המלצה

מקור: `LearningTabContent.jsx` (untracked/modified, לא כל הקוד ב-worktree הזה מיוחס ל-WORK-ID הזה — ר' §8).

- **תבנית הפריט הקבועה** (`parseTemplateItem`, `LearningTabContent.jsx:78-91`): מחרוזת `"תווית: ערך · תווית: ערך · ..."` — למשל `"מושג: X · הגדרה קצרה: Y · מתי זה תקף: Z · איך מודדים או איפה רואים את זה: W · מקור: HH:MM:SS"`. `parseLearningTemplateItem` (`:130`) מפרק את זה לעמודות טבלה אמיתיות (מושג/הגדרה קצרה/איך מודדים) כשלפחות אחת מ-2 העמודות הנקובות קיימת; אחרת נשאר רינדור stacked רגיל (`TemplateItemContent`, `:93-113`). מרונדר בפועל ע"י `TemplateItemsTable`/`TemplateTableRow` (`:404`, `:334`) כטבלה אמיתית, בתוך `LearningTabContent`'s `templateTable` prop (`:519`, `false` כברירת מחדל — ר' שער `!hasStructuredSections` שנוסף ב-`VideoDetailPanel.jsx` כדי שתוכן-מבזק לא ייתפס בטעות בשער הזה, מתועד בשורת ה-ledger 208).
- **סמן ה-🧠**: `BRAIN_BADGE_RE` (`:53`) מזהה זנב `"· 🧠 מומלץ לשמור למוח · סיבה: <טקסט>"` שה-GEM עשוי לצרף לסוף פריט; `extractBrainBadge` (`:55-60`) קוצץ אותו מהתצוגה/העתקה/שמירה ומרנדר אותו כתג נפרד (`BrainRecommendedBadge`, `:62-71`) — כלומר ה-GEM יכול לסמן פריט ספציפי כמומלץ-במיוחד לשמירה, וזה לא נכנס לטקסט השמור בפועל.

## 4. שני תיקוני "ראשון-מנצח → מיזוג" — כבר בקוד, בניגוד למה ש-SCHEMA.md אומר

`GEM-FUNDAMENTAL-SCHEMA.md` §6.1/§8 מתעד שני פערים כ**"לא תוקן, פתוח ב-ledger"**:
1. `fullSummary`/`mainLesson` נכתבים אך לעולם לא מוצגים כש-`shortSummary` גם קיים (`pickStringAsArray` ראשון-לא-ריק-מנצח, `videoTabsConfig.js:689`).
2. `warnings` נכתב אך לעולם לא מוצג כש-`mistakesToAvoid` גם קיים (`pickArray` ראשון-לא-ריק-מנצח, `videoTabsConfig.js:783`).

**תיקון (2026-09-11 לילה):** קריאה ראשונית של הקוד הנוכחי (`git diff -- src/config/videoTabsConfig.js`) הראתה ששניהם תוקנו, וסבב מוקדם יותר של המסמך הזה דיווח על זה כ"לא-מיוחס". **זה היה שגוי** — קריאה מלאה יותר של `docs/open-items-ledger.md` (כולל סעיף "Recently resolved", לא רק "Open items") מצאה שהתיקון **כן מתועד**, בשורה "TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA — `pickArray`/`pickStringAsArray` 'first-non-empty-wins' merge bug fixed in code", תאריך 2026-09-10 — כולל את הטריגר (משתמש דיווח על תמלול "כמעט ריק"), אימות-נגד לפני התיקון, ובחירת המשתמש המפורשת (`AskUserQuestion`, "לתקן בקוד עכשיו") לתקן בקוד ולא רק במסמכים. תיקונים בקוד:

```js
// case 'summary' — כעת שתי קריאות pickStringAsArray נפרדות, לא שרשרת fallback אחת:
...pickStringAsArray(video, 'shortSummary', 'fullSummary', 'gemSummary', 'summary'),
...pickStringAsArray(video, 'mainLesson'),

// case 'mistakes' — כעת שלוש קריאות pickArray נפרדות, לא שרשרת fallback אחת:
...pickArray(video, 'mistakesToAvoid'),
...pickArray(video, 'warnings'),
...pickArray(video, 'riskRules'),
```

**מסקנה:** `GEM-FUNDAMENTAL-SCHEMA.md`/`GEM-FUNDAMENTAL-INSTRUCTIONS.md` עודכנו הלילה (2026-09-11, לפי הכרעת המשתמש) לתאר את זה נכון — שני המסמכים תוקנו נקודתית, לא נכתבו-מחדש.

## 5. ה-topicIds → subCategory resolver ולמה הוא קיים

קובץ: `src/utils/subCategoryTopicResolver.js` (untracked). **שורש הבעיה שהוא פותר**: וידאו שנדבק דרך "הדבק JSON מ-GEMS" **לעולם לא מקבל `subCategory`/`confirmedSubCategory`** — אלה נכתבים רק ע"י כפתור ה-UI הידני "תת-נושא", לא ע"י זרימת ה-GEM. בלי `subCategory`, `SpecializedContentRenderer` (הענף שמזין טאב 7) לא יכול לדעת שזה וידאו פונדמנטלי/טכני.

`resolveSubCategorySlugFromTopics(topicIds)` (`:45-52`) פותר את זה ע"י מעבר על `topicIds` של הווידאו (הנקבעים ע"י בורר-הנושאים בטקסונומיה, נתיב UI נפרד) ומיפוי שם-נושא → slug, דרך אותו `normalizeSubCategory`/`SUB_CATEGORY_SLUG_MAP` שמשמש כבר לכל השדה (לא טבלת-מיפוי שנייה). **מחובר בפועל** ל-`effectiveSubCategory` ב-`VideoDetailPanel.jsx:2759` כ-fallback אחרון (רק כש-`subCategory`/`confirmedSubCategory` שניהם ריקים):

```js
// VideoDetailPanel.jsx:2748-2760
const rawValue = confirmedVal ?? subCategoryOverride ?? video?.subCategory ?? videoProp?.subCategory;
const trimmed = ...;
if (trimmed) return trimmed;
return resolveSubCategorySlugFromTopics(video?.topicIds || videoProp?.topicIds) || "";
```

זה זורם ל-`normalizedSubCategory` (`:2773`) ← `effectiveBriefSlug` (`:2806-2811`) ← ה-`slug` prop של `SpecializedContentRenderer` (`:12849`). **שכבת-הגנה שנייה, נפרדת**, קיימת ב-`SpecializedContentRenderer.jsx` עצמו — `looksLikeFundamentalOrTechnical(video)` (בודקת רק שדות-חתימה כמו `frameworks`/`financialMetrics`/`valuation`/`investmentChecklist`) — פועלת רק כשגם `slug` ריק (כלומר גם ל-topicIds אין מיפוי). שתי השכבות משלימות זו את זו, לא כפולות: topicIds-resolver מכסה וידאו שסווג ידנית בטקסונומיה; signal-detection מכסה וידאו בלי שום סיווג-נושא בכלל אך עם שדות-GEM שכבר התמלאו.

## 6. איך נתיב ההדבקה שונה מהצינור האוטומטי

שני צינורות **בלתי-תלויים לגמרי** (מתועד ב-audit, מאומת כאן שוב): הצינור האוטומטי (`vite.config.js` handler + `backend/analyze-video.function.js`, מופעל ע"י כפתור "התחל ניתוח AI") משתמש ב-`src/ai/gemini/{prompts,schemas,validators}` **ומפעיל** `timedNarrativeEvidenceGate.js` לאימות ציטוט-מקור מול תמלול אמיתי. נתיב ההדבקה הידני (`VideoDetailPanel.jsx`'s `_applyParsedGems` → `normalizeAiAnalysisResult`) **אינו קורא ל-evidence gate בשום מקום** (מאומת בגריפ מלא) — זמן/ציטוט שה-GEM (מחוץ לאפליקציה) יכתוב לא עובר שום בדיקת-אמינות אוטומטית; ההוראות מדגישות "עדיף בלי זמן מאשר זמן שגוי" בהתאם. פירוט מלא: `GEM-FUNDAMENTAL-SCHEMA.md` §9.4.

`_applyParsedGems` מנתב לפי 4 תנאים בסדר (`VideoDetailPanel.jsx:6531+`): `contentType==='marketBrief'` → מבזק; `universalTabs.appBuilder` → App Builder; `contentType==='market' && universalTabs` (object) → נתיב מאקרו/Universal, ל-`marketBriefData` (**לא** קורא ל-`normalizeAiAnalysisResult`, לכן ה-GEM הפונדמנטלי **חייב** JSON שטוח בלי `universalTabs` — אחרת כל שדותיו הופכים בלתי-נראים); אחרת → הנתיב שלנו.

## 7. ✅ טאב 7 — הוכרע (2026-09-11 לילה): הקוד נכון ונשאר

**הכרעת המשתמש, סופית:** הקוד הנוכחי נכון ונשאר. הבקשה המפורשת הייתה שטאב 7 יציג את **9 הסעיפים המלאים** של דשבורד המבזק (כולל Fear&Greed/AAII החיים), **עם ה-empty-state העצמאי של כל סעיף** כשאין לו תוכן — לא את ה-empty-state הכולל-אחד שהיה קיים לפני 2026-09-10, ולא את הריקון-לגמרי מ-2026-09-10.

**מה שבאמת קורה, מדויק:** `SpecializedContentRenderer.jsx`'s ענף `fundamental-analysis`/`technical-analysis` מרנדר את `<MorningBriefDashboard>` (9 הסעיפים, ר' §2 שורה "7 (תוכן ייעודי)"). **הג'ם הפונדמנטלי עצמו עדיין לא פולט שום דבר לטאב 7** — `GEM-FUNDAMENTAL-INSTRUCTIONS.md` לא מבקש מהג'ם נתוני-מניה/מאקרו יומיים (Decision 1/3, ר' §8), ואין קשר בין הג'ם הזה ל-`marketBriefData`. **האפליקציה** (לא הג'ם) מרנדרת את מבנה 9 הסעיפים בכל מקרה, וכל סעיף מציג את ה-empty-state **שלו עצמו** (בדיוק כמו שמבזק בוקר/ערב לפני ניתוח GEM מציג — `SentimentSection`/`MarketRegimeSection`/וכו', כל אחד עם empty-state ייעודי) עד שיהיה `marketBriefData` אמיתי (כרגע: אין נתיב שממלא אותו לג'ם הפונדמנטלי כלל — זה נשאר עקבי-ומכוון, לא באג). ה-widgets החיים (Fear&Greed, AAII) **אינם תלויים** ב-`marketBriefData` בכלל — הם מציגים נתון-שוק גלובלי אמיתי בכל מקרה (ר' §2/`SentimentSection`).

**מדוע ה-instructions/schema הקודמים אמרו אחרת:** נכתבו ב-2026-09-10 לפי כלל אז-בתוקף ("טאב 7 = תוכן יומי בלבד, ריק לגמרי לג'ם הזה"). ב-2026-09-11 המשתמש שינה את ההחלטה במפורש (הוראה נפרדת, אותה שיחה) וביקש את מבנה-9-הסעיפים במקום ה-empty-state הכולל. שני הסבבים היו תקינים כל אחד בזמנו — התיעוד לא עודכן אחרי השני. תוקן כאן ובשני המסמכים האחרים (ר' למטה).

## 8. פערים ידועים ופתוחים (סטטוס נכון להיום)

| פער | סטטוס |
|---|---|
| טאב 7 מציג דשבורד-מבזק (9 סעיפים, empty-state עצמאי לכל סעיף) לתוכן פונדמנטלי/טכני, לא empty-state אחד כולל | **✅ הוכרע 2026-09-11 — זו ההתנהגות הנכונה, ר' §7** |
| `fullSummary`/`mainLesson` "לעולם לא מוצגים" ו-`warnings` "לעולם לא מוצג" — היה מתועד כפתוח ב-SCHEMA.md | **✅ תוקן בתיעוד 2026-09-11** — בפועל תוקן בקוד קודם לכן; שורת ledger נוספה לתיעוד מי/מתי (ר' §4) |
| APP (טאב 5) לא נגיש דרך JSON שטוח | פתוח, ידוע, לא בהיקף — הוראות ה-GEM לא מנסות למלא אותו |
| אין טבלת-מניות ייעודית לטאב 7 פונדמנטלי | פתוח, Decision 3 עדיין בתוקף — הג'ם עצמו עדיין לא פולט תוכן-מניה יומי, ר' §7 |
| `technical-analysis`'s `indicators`/`setups`/`patterns` — היו בלי בית מחוץ לטאב 7 | **נסגר 2026-09-11** — 5 סעיפי טאב 4 חדשים (`indicators`/`setups`/`patterns`/`cause-effect`/`market-impact`), ר' שורת ledger 212 |
| אין evidence-gate על נתיב ההדבקה הידני (זמן/ציטוט לא מאומת) | פתוח, מכוון — "עדיף בלי זמן מאשר זמן שגוי" בהוראות |
| דוגמת ה-GEM משתמשת בתיאורי-חברה מוכללים, לא בטיקרים אמיתיים — לא בודקת stock-linkification | פתוח, `architect-reviewer` |

## 9. Changelog

**2026-09-11 (מאוחר, WORK-ID TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY) — `stockFundamentals`/`stockTechnicals`, שני סעיפי-טבלה חדשים בטאב 7:** הג'ם הפונדמנטלי כעת **כן** כותב שדה שמזין את טאב 7 — `stockFundamentals` (נקודות-נתון פונדמנטליות אמיתיות לפי טיקר, שונה מהותית מ-`financialMetrics`/`valuation` הלימודיים). מוצג בסעיף חדש "📊 נתונים פונדמנטליים", מעל "⭐ מניות שהוזכרו". שדה-אח, `stockTechnicals` (סכימה בלבד — GEM טכני נפרד עדיין לא כותב אותו), מוצג ב-"📐 נתונים טכניים" מעל אותו סעיף. שני הסעיפים מותנים יחד ב-`showStockDataSections` prop על `MorningBriefDashboard.jsx` (ברירת מחדל `false`) — מונע דליפה למבזק בוקר/ערב שחולקים את אותו רכיב בדיוק. §7 למעלה (טאב 7 = דשבורד-מבזק מלא) עדיין נכון — זה תוסף, לא סתירה: הג'ם עדיין לא כותב שום דבר לשאר 9 הסעיפים, רק לשני החדשים. פירוט מלא: `docs/plan/AUDIT-TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY.md`, `GEM-FUNDAMENTAL-SCHEMA.md` §10.

**2026-09-11 (לילה) — הכרעת טאב 7 + תיקון תיעוד stale:** המשתמש הכריע את §7 (הקוד נכון, נשאר) ואישר commit+push. `GEM-FUNDAMENTAL-SCHEMA.md`/`GEM-FUNDAMENTAL-INSTRUCTIONS.md` עודכנו לתאר את מה שהקוד עושה בפועל (לא נכתבו-מחדש — עודכנו נקודתית, ר' הערות "עדכון 2026-09-11" בתוכם); `fullSummary`/`mainLesson`/`warnings` תוקנו משלוש הצהרות "לא מוצג" ל-"מוצג, ר' file:line"; שורת ledger נוספה המתעדת את תיקון ה-merge ב-`videoTabsConfig.js` שלא היה מיוחס קודם.

**2026-09-11 (מוקדם) — נכתב לראשונה:** לא בוצע שינוי קוד. איחוד כל התיעוד המפוזר (audit/schema/instructions/example/ledger) למקום כניסה אחד, וזיהוי הסתירה שהייתה אז פתוחה בסעיף 7.

## 10. מסמכים קשורים

- `docs/plan/AUDIT-TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA.md` — הביקורת המקורית (2026-09-09), read-only.
- `docs/gems/GEM-FUNDAMENTAL-SCHEMA.md` — חוזה ה-JSON המלא, file:line לכל שדה (stale על 2 נקודות, ר' §4/§8).
- `docs/gems/GEM-FUNDAMENTAL-INSTRUCTIONS.md` — הטקסט להדבקה ב-Gemini + מפת 26 ה-KPI + 4 דשבורדי-העל + תבניות פרומפט (stale על §7).
- `docs/gems/GEM-FUNDAMENTAL-EXAMPLE.json` — דוגמת JSON מלאה.
- `docs/open-items-ledger.md` — שורות `TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA` (92, 182, 194, 206, 208, 212) ו-`TRADINGBRAIN-LEARNING-TAB-FIXED-SECTIONS` (210, סשן מקביל שנגע באותו קובץ).
- `docs/gems/GEM-TECHNICAL-PREP-NOTES.md` — מסמך הכנה נפרד לג'ם הטכני של מחר (WORK-ID מוצע `TRADINGBRAIN-GEM-TECHNICAL-SCHEMA`, לא התחיל) — מה ניתן לשימוש חוזר, מה ספציפי-לפונדמנטלי, ותיקון-דיוק נוסף ל-`GEM-FUNDAMENTAL-SCHEMA.md` §7 (`indicators` כן ממופה, בניגוד למה שכתוב שם).

**⚠️ הערת-בעלות:** קובץ זה (`FUNDAMENTAL-OVERVIEW.md`) וגם `GEM-TECHNICAL-PREP-NOTES.md` נוצרו/נערכו בפער של שניות בודדות זה מזה (חותמות-זמן `git`/`stat`, 2026-09-11 ~02:53). לא ניתן לקבוע בוודאות מתוך התוכן בלבד אם שני הקבצים נכתבו על ידי אותו סשן או על ידי שני סשנים מקבילים על אותו worktree משותף (תופעה מתועדת בפרויקט הזה — ר' `[[project_shared_worktree_coordination]]`). שני הקבצים אומתו ידנית מול הקוד הנוכחי ונמצאו עקביים זה עם זה ועם הקוד — אין סתירה ביניהם, רק אי-ודאות לגבי ייחוס.
