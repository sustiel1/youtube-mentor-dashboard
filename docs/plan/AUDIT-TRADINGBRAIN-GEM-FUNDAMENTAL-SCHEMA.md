# AUDIT-TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA

**WORK-ID:** TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA
**סוג מסמך:** READ-ONLY AUDIT. לא בוצע שום שינוי קוד. הקובץ הזה untracked, לא בוצע לו `git add`.
**מטרה:** לספק בסיס עובדתי, מאומת מול קוד בפועל, לפני כתיבת הוראות GEM פונדמנטלי חדשות ב-Gemini.

---

## Step 0 — זהות המאגר ומצב Git

הנתונים הבאים סופקו על-ידי הסשן המתאם (orchestrating session) ולא נגזרו מחדש על-ידי סוכן זה (אין לו גישה ל-Bash/git):

- **נתיב מאגר / worktree:** `C:/Users/11/Desktop/Workspace/new-project/projects/youtube-mentor-dashboard`
- **ענף:** `feat/saved-market-rows-table`
- **HEAD SHA:** `5536e50ef641d3714a0485c6f5a0da34d7e4369f`
- **Dev server:** תהליך Vite (PID 30164) מאזין על `[::1]:5184` — תואם ל-origins המורשים המתועדים ב-CLAUDE.md של הפרויקט (`http://127.0.0.1:5184` + `http://localhost:5184`), מה שמאשר שפורט 5184 משרת בדיוק את ה-worktree הזה.

### שורות פתוחות רלוונטיות ב-`docs/open-items-ledger.md` (GEMS / schema / tab-mapping / fundamental)

נקראו בעיון (grep ממוקד + קריאת שורות ספציפיות, לא כל 204 השורות של הקובץ שכן הוא כבד מאוד):

1. **`TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN`** — תוכנית 4-GEMs (`docs/plan/TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN.md`), תכנון בלבד, ללא קוד. 2 מתוך 4 שאלות פתוחות עדיין פתוחות נכון ל-2026-09-01 (סעיף 8 שם). ראו Step 8 למטה — בדקתי את התוכנית מול הקוד בפועל.
2. **`TRADINGBRAIN-GEMPICKER-COMPACT-SCORING`** — session שלם, **לא-committed**, שמשנה בדיוק את הקבצים הרלוונטיים לביקורת הזו: `src/lib/gemRecommender.js`, `src/components/dashboard/GemSelectionModal.jsx`, `src/components/dashboard/GemRecommendationCard.jsx`, `src/ai/gemini/gemContentRouter.js`, `src/components/dashboard/VideoDetailPanel.jsx`, `scripts/brief-gem-selector-qa.mjs`. תועד ש-`gemContentRouter.js` (כולל `resolveContentClassification`, `GEM_PROMPT_CONFIG_TABLE`) **אין לו שום consumer חי ב-`src/`** — אימתתי זאת עצמאית (ראו Step 4). תועדה גם בעיית spelling variant בעברית ("פנדמנטלי" בלי ו') שלא נתפסת ב-keyword matching של `GEM_RULES.fundamental`.
3. **`TRADINGBRAIN-VIDEODETAILPANEL-INTERLEAVED-STAGING`** — `VideoDetailPanel.jsx` נושא diff לא-committed משוזר בין שני WORK-IDs (GEMPICKER-COMPACT-SCORING + FRESHIMPORT-COST-GUARD), 408 שורות גולמיות. דורש `git add -p` לפני כל commit עתידי על קובץ זה.
4. **`TRADINGBRAIN-WORKTREE-TRIAGE`** (שורה עם רשימת קבצים) — מאשר עצמאית שאותם קבצים (`gemContentRouter.js`, `gemRecommender.js`, `GemSelectionModal.jsx`, `GemRecommendationCard.jsx`, `VideoDetailPanel.jsx`, `brief-gem-selector-qa.mjs`) נמצאים כרגע `M` (modified, לא committed) — תואם למה שנצפה ישירות בקריאת הקוד לביקורת זו.

לא נמצאה שורה פתוחה שעוסקת ישירות ב-schema/contract של GEM פונדמנטלי עצמו (למעט ה-keyword/spelling-variant gap בסעיף 2 לעיל) — זו תוכנית עבודה עתידית, לא רשומה קיימת.

### `feat/gems-phase0-1` — worktree נפרד, נבדק כנדרש

נבדק (Read/Glob בלבד, ללא נגיעה) הנתיב `C:/Users/11/Desktop/Workspace/new-project/projects/youtube-mentor-dashboard-worktree-gems-phase0-1`, ענף `feat/gems-phase0-1`, HEAD `f9586f0`. קראתי במלואו את `docs/plan/NIGHT-REPORT-TRADINGBRAIN-GEMS-PHASE0-1.md` שנמצא שם.

**ממצא מרכזי — יש חפיפה קונקרטית וממשית, לא רק תיאורטית:**

- ה-worktree הזה נבנה על בסיס `origin/main` @ `2888f7a`, **לא** על `feat/saved-market-rows-table`.
- יש בו commit יחיד עם קוד (`b8a8d40`) ששינה **בדיוק את אותם שני קבצים** שכבר dirty (uncommitted) על הענף הנוכחי במסגרת `TRADINGBRAIN-GEMPICKER-COMPACT-SCORING`: `src/lib/gemRecommender.js`'s `classifyVideoForGem()` ו-`src/ai/gemini/gemContentRouter.js`'s `resolveContentClassification()` — שני היישומים מוסיפים מצב `unclassified`/"ממתין לסיווג" (Decision 14 בתוכנית), אך **בסדר לוגי שונה**: הגרסה ב-`feat/gems-phase0-1` מפעילה את הבדיקה `top.score === 0` **אחרי** שלב "explicit-category-boost", מה שיכול לגרום לוידאו ללא אות אמיתי להיחשב "מסווג בביטחון" באופן שגוי; הגרסה הנוכחית ב-worktree הזה (הלא-committed, אימתתי ישירות בקריאת `gemContentRouter.js` בפועל) בודקת `hadRealKeywordSignal` **לפני** הבוסט — סמנטית נכונה יותר. זה תואם בדיוק את מה שכבר תועד בשורת ה-ledger (`TRADINGBRAIN-GEMPICKER-COMPACT-SCORING`, שורה עם ציון "החלטה 14").
- ה-worktree הנפרד גם קבע ("Phase 0") ש**באג ה-evening-brief dead branch לא קיים** ב-`origin/main` (שם שני התנאים ב-`SpecializedContentRenderer.jsx` נפרדים, שורות 200/219). **אך קראתי את הקובץ בפועל ב-worktree הנוכחי (`feat/saved-market-rows-table` @ HEAD) ומצאתי שהבאג עדיין קיים כאן**: שורה 146 עדיין `if (slug === 'morning-brief' || slug === 'evening-brief') { ... return ... }` — כלומר ה-branch הייעודי ל-evening-brief בשורה 162 הוא עדיין **קוד מת, לא נגיש**. זה סותר את מסקנת ה-worktree הנפרד (שנכתבה מול `origin/main`, לא מול הענף הזה) — ולא במקרה: שני הענפים התפצלו (`git merge-base --is-ancestor 8495180 origin/main` → false, כפי שתועד בדוח הלילה עצמו). **מסקנה: הדוח מה-worktree הנפרד רלוונטי רק ל-`origin/main`; על `feat/saved-market-rows-table` הבאג עדיין חי, ואומת כאן ישירות בקריאת קוד, לא הונח.**
- שום דבר מה-worktree הזה לא מוזג/נדחף/נגע בענף הנוכחי. הוא נשאר local-only, לא נוגע בו הביקורת הזו.

**האם נבדקו worktrees נוספים?** לא. ה-session-start hook מדווח 39 worktrees בסך הכול (חלקם תחת `C:/tmp`, `AppData\Local\Temp\claude\...` וכו') — נבדק **רק** `youtube-mentor-dashboard-worktree-gems-phase0-1`, כי הוא היחיד שנראה רלוונטי-ל-GEMS מהשם שלו. שאר ה-worktrees לא נבדקו כלל (לא Glob, לא Read) — זו הכרעה מפורשת של scope, לא ממצא.

---

## Step 1 — שבעת הטאבים האוניברסליים

מקור האמת בפועל **אינו** מערך סטטי בתוך `VideoDetailPanel.jsx` — הוא `VIDEO_ANALYSIS_HEADINGS` מ-`src/config/workspaceHeadingRegistry.js`, ש-`UNIVERSAL_TABS` ב-`src/config/videoTabsConfig.js` (`videoTabsConfig.js:160-164`) בונה ממנו ישירות (`.map()`), ו-`VideoDetailPanel.jsx` מייבא ומרנדר (`VideoDetailPanel.jsx:139` ל-import, `:3035` ל-`visibleTabDefinitions = UNIVERSAL_TABS`, `:10311` ל-render בפועל של ה-tab bar).

**סדר, key, תווית, אייקון** (`src/config/workspaceHeadingRegistry.js:1-75`, מפולטר להוציא `structured-snapshot`):

| # | `sourceTabId` | תווית עברית | אייקון | renderer בפועל (`VideoDetailPanel.jsx`) |
|---|---|---|---|---|
| 1 | `summary` | סיכום | 📝 | `TabsContent value="summary"` (שורה 10356), inline JSX |
| 2 | `chapters` | פרקים | 📚 | `TabsContent value="chapters"` (שורה 11149) |
| 3 | `insights` | תובנות | 💡 | `TabsContent value="insights"` (שורה 12219) |
| 4 | `useful-knowledge` | ידע שימושי | 🧠 | `TabsContent value="useful-knowledge"` (שורה 12337) |
| 5 | `app-builder` | APP | 🚀 | `TabsContent value="app-builder"` (שורה 12210) → `<AppBuilderTab>` |
| 6 | `topics-subtopics` | נושאים ותתי־נושאים | 🏷️ | `TabsContent value="topics-subtopics"` (שורה 12485) |
| 7 | `specialized` | תוכן ייעודי | 🎯 | `TabsContent value="specialized"` (שורה 12658) → `<SpecializedContentRenderer>` |

(שים לב: `structured-snapshot` קיים ב-`WORKSPACE_HEADING_REGISTRY` — אבל מסונן החוצה מ-`VIDEO_ANALYSIS_HEADINGS`/`UNIVERSAL_TABS`, לכן **אינו** אחד משבעת טאבי הווידאו; הוא יעד ניווט-Workspace נפרד בלבד — ראו Step 6.)

`visibleTabDefinitions = UNIVERSAL_TABS` (שורה 3035) הוא **בלתי-מותנה** — 7 הטאבים תמיד מוצגים לכל וידאו, לא רק לפונדמנטלי, בלי הסתרה. זה תואם בדיוק את מה שתוכנית ה-GEMS-TABS-MAPPING-PLAN מכנה "Decision 13".

### מערכי `TECHNICAL_TABS`/`FUNDAMENTAL_TABS`/`MACRO_TABS` — עדיין קיימים, אך **קוד מת מאומת**

`src/config/videoTabsConfig.js` עדיין מכיל `TECHNICAL_TABS`, `FUNDAMENTAL_TABS`, `MACRO_TABS`, `MORNING_BRIEF_TABS`, `EVENING_BRIEF_TABS` וכו' (שורות 186-280), ופונקציות `getTabsBySubTopic()`/`getTabsForVideo()` (שורות 286-341) שבונות ממערכים אלה tab-bar **לפי subCategory**. אימתתי ישירות:

- `grep -rn "getTabsBySubTopic|getTabsForVideo" src/` → **התאמה יחידה**: ההגדרה העצמית בתוך `videoTabsConfig.js`. **אין consumer אחר בשום מקום ב-`src/`.**
- ב-`VideoDetailPanel.jsx` יש `selectedTabsConfigKey = normalizedSubCategory || videoType` (שורה 3037) ו-`isLegacyLearningLayout` (שורה 3038) — אך `isLegacyLearningLayout` **מוצהר ולא נצרך בשום מקום אחר** (grep מלא בקובץ מחזיר רק את שורת ההצהרה עצמה). `selectedTabsConfigKey` כן נצרך, אבל **רק** בתוך `useMemo`/`useEffect` dependency arrays, מחרוזת debug אחת (שורה 9857), ו-prop יחיד ל-`<AiMappingModal>` (שורה 13141) — קומפוננטת **DEV-only** לאבחון בלבד.
- מכאן: `TECHNICAL_TABS`/`FUNDAMENTAL_TABS`/`MACRO_TABS` ו-`getTabsBySubTopic`/`getTabsForVideo` הם קוד מת שמיוצא אך אינו מניע שום דבר בפועל את ה-tab-bar. זה תואם ל-"Decision 7" בתוכנית הקיימת ("מערכי הטאבים המתים נשארים כמות שהם" — סגור סופית, לא נמחקים).

**מסקנה ל-GEM פונדמנטלי:** אין צורך (ואין השפעה) בהתאמת `FUNDAMENTAL_TABS` — הוא לא בשימוש. ה-7 טאבים תמיד קבועים; ההבדל בין GEM לGEM מתבטא **רק** בתוכן טאב 7 (ותוכן שדות אחרים דרך fallback paths, ראו Step 2/7).

---

## Step 2 — חוזה ה-JSON הנוכחי בפועל (parser/validator אמיתי)

### שתי שרשראות ingestion נפרדות לגמרי באפליקציה — ממצא ארכיטקטוני מרכזי

בזמן הביקורת התגלה שקיימות **שתי מערכות שונות ובלתי-תלויות**, וקל לבלבל ביניהן:

**(A) הפייפליין האוטומטי** (`vite.config.js`'s `/api/gemini-video-content` handler + `src/ai/gemini/analyzeVideoWithGemini.js`) — מנתח URL/תמלול ישירות מול Gemini API. בונה prompt **inline** בתוך `vite.config.js` (לא דרך `src/ai/gemini/prompts/*`), ומריץ `sanitizeJsonGershayim`. **אימתתי ש-`vite.config.js` אינו מייבא כלל מ-`src/ai/gemini/{prompts,schemas,validators}`** (grep מלא בקובץ — 0 תוצאות). כלומר משפחת ה-prompts/schemas/validators המודולרית (`buildMarketAnalysisPrompt`, `validateMarket.js` וכו') **אינה** בשימוש על ידי הפייפליין האוטומטי הזה בכלל.

**(B) זרימת ה-paste-back הידנית** — זו הרלוונטית ישירות למשימת ה-GEM שהמשתמש כותב ומדביק בעצמו. שרשרת ה-entry-point האמיתית:

1. משתמש לוחץ "פתח GEM + העתק תמלול" (`GemSelectionModal.jsx`, ראו Step 9) — מעתיק payload פשוט ללוח, פותח את ה-GEM ב-Gemini web UI.
2. המשתמש מדביק את תשובת ה-GEM בתיבת ה-paste ב-`VideoDetailPanel.jsx` (`gemsPasteInput`).
3. `handleApplyGemsJson()` (`VideoDetailPanel.jsx:6733`) קורא ל-**`parseAndValidateGemsJson(raw)`** מ-`src/lib/gemsJsonRepair.js:303` — **זהו ה-parser/validator האמיתי שגייט את מה שהמשתמש רואה**.
4. בכשל — `repairGemsJsonDeterministically(raw)` מנסה תיקון fail-closed דטרמיניסטי (ללא ניחוש).
5. בהצלחה — `_applyParsedGems(result.value)` (`VideoDetailPanel.jsx:6524`) מנתב לפי `contentType`/`universalTabs` לאחד מכמה נתיבי-שמירה (ראו Step 10).

**חשוב:** `validateGemsJsonValue()` (ב-`gemsJsonRepair.js`) הוא ולידטור **גנרי, לא ספציפי-ל-fundamental** — הוא **לא** הולידטור `validateMarket.js`/`validateGeneral.js`/`validatePolitical.js` שב-`src/ai/gemini/validators/`. אימתתי: אין שום import site ל-`validateMarket`/`validateGeneral`/`validatePolitical` בשום מקום ב-`src/` מלבד ההגדרה העצמית; ה-consumer היחיד של משפחת `src/ai/gemini/validators/` הוא `timedNarrative.js`'s `normalizeTimedNarrativeItem` דרך `RowTimestampGenerator.jsx` (פיצ'ר צר, opt-in, ללא קשר ל-ingestion הכללי).

### `validateGemsJsonValue()` — כללי הקבלה בפועל (`src/lib/gemsJsonRepair.js:248-301`)

```js
const UNIVERSAL_TAB_TYPES = {
  summary:          ['object', 'array'],
  chapters:         ['array'],
  insights:         ['object', 'array'],
  usefulKnowledge:  ['object', 'array'],
  appBuilder:       ['object'],
  topicsSubtopics:  ['object', 'array'],
  specialized:      ['object'],
};
```

- Root **חייב** להיות אובייקט.
- `contentType`, אם קיים — חייב להיות string.
- `universalTabs`, אם קיים — חייב להיות object; כל אחד מ-7 המפתחות שמופיעים בו נבדק מול הטיפוס המצופה (טבלה למעלה); אם `universalTabs` קיים אך ריק לגמרי מ-7 המפתחות הידועים — שגיאה.
- אם `contentType === 'marketBrief'` — יש דרישה נוספת (canonical/legacy), לא רלוונטי ישירות לפונדמנטלי.
- אחרת, אם `universalTabs` קיים — `schema: 'universal-tabs'`, מתקבל.
- אחרת (JSON שטוח לגמרי, בלי `universalTabs`) — נדרש לפחות שדה אחד מתוך `GENERIC_ANALYSIS_FIELDS = ['shortSummary','fullSummary','keyPoints','allPoints','chapters','keyInsights','usefulKnowledge','actionItems','politicalSummary','brainHighlights']` — `schema: 'analysis-legacy'`.

זהו ולידטור **מבני-שטחי בלבד** — לא בודק תוכן שדות `specialized`, לא יודע דבר על "פונדמנטלי" ספציפית. **כל JSON חוקי מבחינה מבנית (object תקין + אחד מהתנאים לעיל) יעבור.**

---

## Step 3 — ה-GEM הקיים (מבזק בוקר/ערב) כתבנית ייחוס

`src/ai/quickCopyPrompts.js` מגדיר את כל כפתורי "Quick Copy" (הפרומפטים המובנים-מראש שהאפליקציה **כן** מרכיבה בעצמה — נפרד מ-"פתח GEM + העתק תמלול" הידני, ראו Step 9).

### `buildGeminiNewsQuickPrompt` — ה-GEM של מבזק בוקר/ערב (`quickCopyPrompts.js:148-187`)

- סכימה: `getMorningBriefSchemaExample()` (universalTabs-only, ראו למטה).
- כללי שפה מפורשים: כל תוכן טקסט **בעברית**; אנגלית מותרת רק לטיקרים/שמות חברות/מדדים/URLs.
- כללי JSON קפדניים מפורשים: אסור `"` בתוך ערכי מחרוזת (עם דוגמאות: נאסדק, אגח, תא, חכ), חובת פסיקים, אסור לחתוך JSON, אסור מבנה JSON גולמי בתוך מחרוזת, `\n` ולא שורה חדשה אמיתית.
- `contentType: 'marketBrief'` חובה מפורשת.
- הנחיה מפורשת: "מלא את universalTabs.specialized... אל תשכפל shortSummary/fullSummary/chapters או specialized כשדות legacy ברמת השורש" — בדיוק המדיניות universalTabs-only שמתועדת ב-CLAUDE.md.

### `getMorningBriefSchemaExample()` (`src/ai/gemini/schemas/morningBriefSchema.js`)

מבנה: `{ contentType: "marketBrief", universalTabs: { summary[], chapters[], insights[], usefulKnowledge[], appBuilder{}, topicsSubtopics[], specialized{ indices[], marketNews[], stocksMentioned[], macro[], sentiment[], calendar[], opportunities[], risks[] } } }` — 7 מפתחות `universalTabs` תואמים בדיוק ל-7 הטאבים (Step 1), ו-`specialized` הוא אובייקט חופשי עם שדות ספציפיים-למבזק.

### שלושת הכפתורים `gemini-technical` / `gemini-fundamental` / `gemini-macro` — **בפועל, זהים לחלוטין**

בדקתי ישירות ב-`QUICK_COPY_ACTIONS` (`quickCopyPrompts.js:316-436`):

```js
{ id: 'gemini-fundamental', flow: 'gem-fundamental', buildPrompt: buildGeminiMarketQuickPrompt, ... }
{ id: 'gemini-technical',   flow: 'gem-technical',   buildPrompt: buildGeminiMarketQuickPrompt, ... }
{ id: 'gemini-macro',       flow: 'gem-macro',       buildPrompt: buildGeminiMarketQuickPrompt, ... }
{ id: 'gemini-daytrading',  flow: 'gem-dayTrading',  buildPrompt: buildGeminiMarketQuickPrompt, ... }
{ id: 'gemini-combo',                                buildPrompt: buildGeminiMarketQuickPrompt, ... }
```

**כל חמשת הכפתורים האלה קוראים לאותה פונקציה בדיוק — `buildGeminiMarketQuickPrompt`** (`quickCopyPrompts.js:77-101`), שמשתמשת ב-**`getMarketSchemaExample({ chaptersTarget: 6 })`** — הסכימה **השטוחה** (לא universalTabs), עם שדות: `contentType:'market', shortSummary, fullSummary, keyPoints[], chapters[], mainLesson, keyInsights[], usefulKnowledge[], stocksMentioned[], tradingSetups[], tradingRules[], riskRules[], keyLevels[], indicators[], marketConditions[], actionItems[], warnings[], tags[]`.

**מסקנה:** נכון להיום, **אין שום GEM/schema ייעודי-לפונדמנטלי** בקוד בפועל. כפתור "Gemini פונדמנטלי" מייצר בדיוק את אותו פרומפט/schema כמו טכני/מאקרו/מסחר-יומי — schema גנרי לשוק ההון, ללא שדות פונדמנטליים כלל (אין `financialMetrics`, אין `valuation`, אין `analysisFrameworks`, אין `investmentChecklist`). זה תואם ל-Decision 10 בתוכנית הקיימת ("טכני נבנה ראשון... פונדמנטלי ומאקרו-ושוק כשכפול מאוחר יותר") ול-Decision 9 ("המשתמש כותב את 3 הפרומפטים ביד; האפליקציה חושפת רק schema") — כלומר זה **מתוכנן** להישאר כך עד שהמשתמש עצמו יכתוב פרומפט ייעודי (בדיוק המשימה הנוכחית).

---

## Step 4 — הצד הפונדמנטלי הספציפי

### `GEM_RULES.fundamental` (`src/lib/gemRecommender.js:81-97`)

```js
{
  key: "fundamental", label: "פונדמנטלי", icon: "📊",
  titleKeywords: ["earnings","valuation","fundamental","revenue","income","profit",
    "pe ratio","cash flow","dividend","acquisition","growth","analyst",
    "upgrade","downgrade","target price","eps","q1","q2","q3","q4",
    "דוח רבעוני","דוחות כספיים","עונת הדוחות","תוצאות רבעון","מכפיל רווח",
    "תזת השקעה","ניתוח פונדמנטלי"],
  topicKeywords: ["fundamental","stocks","equity","financial","investing","פונדמנטלי"],
  transcriptKeywords: ["revenue","earnings","valuation","margin","guidance","eps",
    "profit","pe ratio","market cap","cash flow","balance sheet","dividend",
    "acquisition","business model","pricing power","competitive advantage",
    "return on equity","debt to equity","net income","gross profit", ...],
}
```

### `GEM_CATEGORY_MAP.fundamental` (`gemRecommender.js:234-247`)

```js
fundamental: {
  categoryCode: 'Markets', categoryLabel: 'שוק ההון',
  defaultSubCategory: 'פונדמנטלי',   // תואם ל-SUB_CATEGORY_SLUG_MAP('fundamental-analysis')
  subCategoryRules: [
    { label: 'ניתוח יסודי', keywords: ['earnings','revenue','valuation','pe ratio','eps','cash flow','profit margin','balance sheet','net income'] },
    { label: 'בחירת מניות', keywords: ['stock pick','undervalued','growth stock','value investing','dividend','acquisition','return on equity'] },
    { label: 'ניתוח שוק',   keywords: ['market analysis','sector','industry analysis','market cap','analyst','upgrade','downgrade','target price'] },
  ],
}
```

הערת קוד קיימת בשורה 238-240 מאשרת ש-`defaultSubCategory: 'פונדמנטלי'` הוא **התיקון** לבעיה מתועדת בתוכנית (§2.3) — כלומר תיקון זה **כבר בוצע בקוד** (ראו Step 8).

### מפתח ה-GEM כפי שמופיע ב-`GemSelectionModal.jsx` (Step 9-11) וב-`gemContentRouter.js`

- `GemSelectionModal.jsx`: `KNOWLEDGE_MARKET_GEMS` (שורות 46-49) מכיל `{ key: "fundamental", label: "ניתוח טכני"... }` — לא, מדויק: `{ key: "fundamental", label: "פונדמנטלי", icon: "📊", description: "ניתוח פונדמנטלי של חברות, מניות וביצועים פיננסיים" }`.
- `gemContentRouter.js`: `CONTENT_TYPE_TO_GEM.fundamental = 'fundamental'`, `GEM_PROMPT_CONFIG_TABLE[FUNDAMENTAL] = { geminiContentType:'market', promptBuilderKey:'market', schemaKey:'market', validatorKey:'market', gemKey:'fundamental', gemLabel:'פונדמנטלי' }` — **אך כל הקובץ הזה קוד מת (אין consumer, אומת ב-Step 0/Step 2)**, ולכן ה-mapping הזה הוא תיעוד-כוונה בלבד, לא נתיב חי.
- ניתוב Obsidian: ראו Step 6/8 — יש כמה נתיבי-תיקייה מועמדים שלא מאוחדים לגמרי.

### תיקון spelling-variant לא בוצע (ידוע, מתועד ב-ledger)

"פנדמנטלי" (בלי ו') לא ייתפס על ידי אף אחת מרשימות המילות-מפתח לעיל (substring matching בלבד, אין fuzzy/normalize). זו החלטה קיימת ומתועדת ב-ledger ("הוספת וריאנטים נדחתה במפורש כ-workaround עד כה") — לא תוקן כאן.

---

## Step 5 — טאב 7 "תוכן ייעודי" — מה שהוא מרנדר בפועל היום

### `SpecializedContentRenderer.jsx` — ה-router האמיתי של טאב 7

מקבל `normalizedSubCategory` (מ-`VideoDetailPanel.jsx:12674`: `effectiveBriefSlug ?? normalizedSubCategory`) ומבצע ניתוב לפי `slug`:

```
if (slug === 'fundamental-analysis') → 6 sections גנריים (ראו למטה)
if (slug === 'technical-analysis')   → 5 sections גנריים דומים
if (slug === 'morning-brief' || slug === 'evening-brief') → MorningBriefDashboard  ← ⚠️ ראו אזהרה למטה
if (slug === 'evening-brief')        → קוד מת (unreachable, ראו למטה)
if (slug === 'weekly-brief')         → dashboard ייעודי
if (slug === 'earnings-brief')       → dashboard ייעודי
isMacroContent (slug==='macro' או universalTabs+contentType==='market') → <MacroGemDashboard>
if (slug === 'political' || hasPoliticalTabSet) → sections פוליטיים
default → sections גנריים נוספים (fallback רחב)
```

**⚠️ אזהרה חשובה, אומתה ישירות בקוד ה-HEAD הנוכחי (לא הונחה):** שורה 146 `if (slug === 'morning-brief' || slug === 'evening-brief') { ...; return renderBulkShell(...) }` — כלומר גם וידאו `evening-brief` נכנס ל-branch הזה ומקבל `MorningBriefDashboard` (בפריזנטציה של בוקר), ו-**ה-branch הייעודי ל-`evening-brief` בשורה 162-222 הוא קוד מת, אינו נגיש לעולם**, כי ה-`return` בשורה 148-158 כבר קורה קודם. זה **בדיוק** הבאג שהתוכנית (§3.1, Decision 4) מתעדת כ"Phase 0 — עדיין לא בוצע, שלב עצמאי לפני עבודת הפיצ'ר". אינו קשור ישירות ל-fundamental, אך רלוונטי כי אותו קובץ הוא ה-router של טאב 7 עבור כל ה-GEMs.

### ה-branch `fundamental-analysis` (שורות 104-123) — 6 sections

```js
sectionDefs = [
  { key:'financial-metrics',    label:'📈 מדדים פיננסיים',  tabKey:'financial-metrics' },
  { key:'valuation',            label:'💰 הערכת שווי',       tabKey:'valuation' },
  { key:'analysis-frameworks',  label:'⚙️ מסגרות ניתוח',     tabKey:'analysis-frameworks' },
  { key:'investment-checklist', label:"📋 צ'קליסט השקעה",   tabKey:'investment-checklist' },
  { key:'mistakes',             label:'⚠️ סיכונים',          tabKey:'mistakes' },
  { key:'checklists',           label:'✅ כללים',             tabKey:'checklists' },
].filter(d => d.items.length > 0);
```

כל item מגיע דרך `extractVideoTabItems(effectiveVideo, tabKey, marketBriefData)` (ראו Step 7 — כאן הפער הקוני האמיתי). הרינדור עצמו הוא `DedicatedContentSection` (רשימת בולטים גנרית) — **אין** טבלת מניות ייעודית ל-branch הזה (בניגוד למאקרו/מבזק בוקר-ערב).

### `DedicatedContentSection.jsx` — צורת ה-item שהוא מרנדר

מעביר items ל-`LearningTabContent`, שמקבל **string** או **object** עם מפתחות אפשריים: `text | title | content | summary | point | name | rule | description | insight | fact | definition | setup | pattern`, וגם תמיכה בקינון (`item.items`/`item.bullets`/`item.points`). זה תואם ל-pattern של `narrativeText()` המתואר ב-system prompt (גמיש מאוד, לא סכימה נוקשה).

### `MacroGemDashboard.jsx` — לשם השוואה (מה שfundamental **אין לו**)

בניגוד לfundamental, המאקרו-דשבורד הוא רינדור ייעודי עשיר: מיפוי שדה-אנגלי→תווית-עברית (`MACRO_FIELD_HE`), `MarketSectorTable` (טבלת סקטורים עם קישורי Finviz), `SavedRowIndicator`/`UniversalTabQuickSaveActions` לכל שורה. אין מקבילה ל-fundamental היום.

### `MarketSectorTable.jsx`

טבלת סקטורים (לא מניות בודדות): `normalizeSectorTableRow(item)` מצפה ל-`sector|name`, `direction|trend|performance|sentiment`, `relativeStrength|note|description|strength`, `reason|rationale|why|catalyst`. **לא** משמשת את ה-branch הפונדמנטלי היום.

### `stockRecordFromObject()` (`src/lib/morningBriefDisplay.js:1345-1410`) — הצורה המדויקת

```js
{
  ...item,                    // ← כל שדה מקורי לא-מוכר נשמר (spread ראשון, לפני override)
  ticker,                     // string, חובה — אחרת null מוחזר
  company,                    // string
  context,                    // string
  sentiment,                  // string, humanized
  sector,                     // string (נשמר כמו שהוא, לא נדרס ע"י static fallback map)
  category,                   // string, resolved via CATEGORY_RANK
  actionability,              // string, humanized
  notes,                      // string, merged משדות multiple
  changePercent,               // string
  timeframe,                  // string
  priority,                   // string
  isNewToWatch,                // boolean | null
  source,                      // string
  sourceVideoId,                // string
  videoId,                      // string
  rowTimestampSourceItems,      // array — [item המקורי]
}
```

**שדות לא-מוכרים נשמרים** (בזכות `...item` spread) — **לא נדרסים**. חשוב: זו פונקציה **פנימית** (לא exported), נצרכת רק דרך `extractUnifiedStocks()`/`hasUnifiedStocks()` (exported), שנצרכות **אך ורק** על ידי `MorningBriefPanels.jsx`, `morningBriefBulkSections.js`, `manualBriefOverrides.js` — **כולן בהקשר מבזק בוקר/ערב, לא בהקשר fundamental-analysis**. אימתתי ב-grep רחב: `SpecializedContentRenderer.jsx`'s branch `fundamental-analysis` **אינו** קורא ל-`extractUnifiedStocks`/`stockRecordFromObject` כלל.

**מסקנה קריטית ל-Step 7:** אם ה-GEM הפונדמנטלי ירצה טבלת-מניות עם ticker/sector/Finviz-link (כמו שיש למבזק בוקר), **זה דורש קוד חדש** — אין נתיב קיים שמחבר את `stockRecordFromObject`/`MarketIndicesTable` ל-branch הפונדמנטלי של טאב 7 היום.

---

## Step 6 — Persistence ל-Workspace ול-Obsidian

### שרידות שדות ל-Workspace Library

- שיוך item ל-collection ב-Workspace: `getWorkspaceCollectionForItem()`/`createWorkspaceProvenance()` (`workspaceHeadingRegistry.js:169-211`) — פריט שנשמר מטאב 7 מקבל `workspaceCollection: 'specialized'`, `sourceTabId: 'specialized'`.
- **תוכן ה-item עצמו מוצמד (flatten) לטקסט** לפני השמירה: `formatBulkItemText(item)` (`src/lib/universalTabBulkItems.js:11-35`) — אותו logic-pattern כמו ה-renderer (מחפש `text|title|content|summary|point|name|rule|description|insight|fact|definition|setup|pattern`, נופל חזרה ל-`Object.values` הראשון שהוא string). **שדות מובנים (כמו ticker/sector/sentiment נפרדים) לא שורדים בנפרד** אלא אם ה-item הבודד נושא במפורש שדה `selectionPayload` (`buildBulkItemsFromSections`, שורות 56-58 ב-`universalTabBulkItems.js`) — במקרה כזה שדות `selectionPayload` נפרשים (`...`) לתוך ה-item שנשמר, מעבר ל-`text`. זהו מנגנון-קיים שאפשר לנצל, אך שום producer קיים ב-fundamental לא ממלא אותו.
- שמירה בודדת (לא bulk) מ-`DedicatedContentSection`/`onSaveToBrain(text, tabKey, label)` מעבירה גם היא `text` בלבד — לא את ה-object המקורי.

### Obsidian export

`src/lib/obsidianExport.js` מכיל `OBSIDIAN_FOLDER_CATALOG` (קטלוג רחב של תיקיות מותרות תחת `שוק ההון`, לא נתיב-הכרעה יחיד). נמצאו **3 מחרוזות שונות הקשורות ל"פונדמנטלי"** באותו קובץ:
- `'שוק ההון/ספריית ידע/פונדמנטלי'` (שורה 48, בתוך הקטלוג)
- `'שוק ההון/ניתוח פונדמנטלי'` (שורה 57, בתוך הקטלוג — **זו התיקייה הקנונית לפי התוכנית, §Decision 1/Phase 8**)
- `'שוק ההון/פונדמנטלי'` (שורה 212, בתוך branch של ניתוב-לפי-מילות-מפתח נפרד)

**לא אומתה בעומק** איזו מהשלוש בפועל נבחרת בזמן ריצה עבור item פונדמנטלי אמיתי — זה תלוי בלוגיקה נוספת ב-`src/lib/obsidianRouting.js`/`src/lib/topicRules.js` (`resolveObsidianFolderFromTaxonomy`, `getObsidianPrimaryByTopicId`) שלא נקראה בעומק במסגרת ביקורת זו (מוגבל scope/זמן). **זה open item מפורש** — ראו רשימת ההחלטות הפתוחות בסוף.

---

## Step 7 — פערים שדורשים קוד ממשי (לא רק ניסוח פרומפט)

זו הרשימה המרכזית, מאומתת ישירות מקריאת קוד (לא הנחה):

1. **`financial-metrics` ו-`valuation` — אין נתיב אחד שממלא את שניהם בבת אחת דרך JSON יחיד שנעטף בצורה טבעית.**
   - `videoTabsConfig.js`'s case `'financial-metrics'` (שורות 914-919) **כן** קורא ל-`resolveSpecialized(marketBriefData)` → `pickArray(src, 'financialMetrics')` — כלומר **אם** ה-GEM עוטף את הפלט כ-`contentType:'market'` + `universalTabs.specialized.financialMetrics`, וזה מנותב דרך ה-"Macro / Universal Market GEM" path (`VideoDetailPanel.jsx:6621-6659`), הוא **כן** יתמלא.
   - אבל case `'valuation'` (שורות 921-925) קורא **רק** ל-`pickArray(video, 'valuation')`/`pickArray(a, 'valuation')` — **לא** בודק `marketBriefData` בכלל. אין שום JSON-key שיכול למלא את `valuation` דרך paste היום.
   - `normalizeAiAnalysisResult()` (`src/services/videoAnalytics.js:1080-1293`) — הפונקציה שמפזרת JSON שטוח (נתיב "generic fallback" ב-`_applyParsedGems`, ראו Step 10) על גבי `video` — **אינה מכילה כלל מיפוי ל-`financialMetrics` או `valuation`**. גם אם ה-GEM יחזיר שדות `financialMetrics`/`valuation` ברמת-שורש שטוחה, `normalizeAiAnalysisResult` **תשמיט אותם** (רשימת שדות מוגדרת-מראש, לא pass-through). **זה genuine code gap — לא ניתן לפתור בניסוח פרומפט בלבד.**

2. **`analysis-frameworks`, `investment-checklist`, `mistakes`, `checklists` — כן עובדים היום, אך רק דרך המסלול השטוח (לא universalTabs).**
   - `analysis-frameworks` קורא `video.frameworks`/`video.analysisFrameworks` → `normalizeAiAnalysisResult` **כן** ממפה `frameworks`.
   - `investment-checklist` נופל חזרה ל-`video.checklists` (fallback מפורש בקוד) → `normalizeAiAnalysisResult` **כן** ממפה `checklists`.
   - `mistakes` קורא `mistakesToAvoid`/`warnings`/`riskRules` → `normalizeAiAnalysisResult` **כן** ממפה `mistakesToAvoid`/`warnings`.
   - **אך אף אחד מהם לא בודק `marketBriefData` בכלל** — כלומר אם ה-GEM ישתמש בעטיפת `universalTabs`, ארבעת השדות האלה **לא יתמלאו** (רק `financial-metrics` בודק universalTabs). **סתירה פנימית**: לא ניתן היום להשתמש בעטיפת universalTabs אחת אחידה שממלאת את **כל** 6 סעיפי הפונדמנטלי בו-זמנית — צריך או (א) לוותר על 2 השדות (financial-metrics/valuation) שדורשים universalTabs, או (ב) פרויקט-קוד נפרד שמוסיף `resolveSpecialized(marketBriefData)` לארבעת ה-cases האחרים (בדיוק כפי שכבר נעשה עבור financial-metrics).

3. **אין טבלת-מניות ייעודית ל-fundamental** (ראו Step 5) — אם רוצים UI ברמת המאקרו-דשבורד/מבזק (טבלה עם ticker, Finviz-link, sentiment-dot), זה קוד UI חדש, לא רק prompt.

4. **`evening-brief` dead branch** (Step 5) — לא קשור ישירות לfundamental, אך אם GEM פונדמנטלי אי-פעם ישתמש ב-slug `evening-brief` בטעות (לא סביר, אך שווה לציין) הוא ייפול ל-branch הלא-נכון.

5. **Obsidian folder לא מאוחד** (Step 6) — 3 מחרוxxxxxxx (ראה למעלה) — לא קוד-חוסם, אבל non-deterministic מבחינת ה-note יגיע לאיזו תיקייה.

6. **אילוצים שהפלט **חייב** לכבד כדי לא לשבור צרכנים קיימים:**
   - Root object תקין, לא markdown/code-fence (`parseAndValidateGemsJson` דורש `JSON.parse` נקי או תיקון deterministic מוצלח).
   - שום `"` לא-בורח בתוך string values (כלל JSON-safety הבסיסי, מתועד גם ב-CLAUDE.md).
   - אם `contentType:'marketBrief'` — **לא** לשמש, זה שמור אך ורק למבזק בוקר/ערב (ה-branch הראשון ב-`_applyParsedGems`).
   - אם רוצים למלא `financial-metrics` — **חובה** `contentType:'market'` + `universalTabs` (אחרת לא מנותב ל-marketBriefData כלל, ראו Step 10).
   - `video.subCategory`/`confirmedSubCategory` צריך להיות מנורמל ל-`'פונדמנטלי'`/`'fundamental-analysis'` (`SUB_CATEGORY_SLUG_MAP`) כדי ש-`SpecializedContentRenderer` בכלל ייכנס ל-branch הנכון — זו קביעה בצד-האפליקציה (GEM picker / classification), לא שדה שה-GEM עצמו שולט בו ישירות ב-JSON.

---

## Step 8 — בדיקת מציאות מול `docs/plan/TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN.md`

התוכנית עצמה ארוכה ועברה כמה סבבי עדכון (עד "עדכון רביעי", החלטות 1-16). קראתי את מבנה-העל (grep על כותרות + קטעים נבחרים). ממצאים מול הקוד בפועל על `feat/saved-market-rows-table`:

| החלטה/סעיף בתוכנית | סטטוס בקוד בפועל, כפי שנבדק כאן |
|---|---|
| §1.1 "7 טאבים קבועים, טאב 7 GEM-specific" | **מיושם** — אומת ב-Step 1. |
| §2.3 "defaultSubCategory של fundamental מתוקן ל-'פונדמנטלי'" | **מיושם** — `gemRecommender.js:241`, עם הערת-קוד שמפנה במפורש לתוכנית. |
| Decision 4 / §3.1 "evening-brief dead branch — Phase 0, לתקן לפני הפיצ'ר" | **לא מיושם** — אומת ישירות: `SpecializedContentRenderer.jsx:146` עדיין מכיל את התנאי המשולב. |
| Decision 7 "מערכי טאבים מתים (TECHNICAL_TABS וכו') נשארים כמות שהם" | **תואם** — לא נמחקו, גם לא נצרכים (Step 1). |
| Decision 9 "המשתמש כותב 3 פרומפטים ביד; האפליקציה חושפת רק schema" | **תואם למצב בפועל** — `buildGeminiMarketQuickPrompt`/`getMarketSchemaExample` הם schema גנרי משותף, לא GEM ייעודי (Step 3). |
| Decision 10 "טכני קודם, מלא-מקצה-לקצה; פונדמנטלי/מאקרו-ושוק שכפול מאוחר יותר" | **טרם מומש עבור אף אחד מה-3** — כפי שנצפה, טכני/פונדמנטלי/מאקרו כולם עדיין באותו schema גנרי משותף; אין GEM טכני "מלא-מקצה-לקצה" קיים היום שממנו לשכפל. |
| Decision 12 "GemSelectionModal.jsx משתמש ב-ALL_FIXED_GEMS נפרד, לא ב-GEM_ALT_OPTIONS/GEM_CATEGORY_MAP" | **מיושם/מדויק** — אומת ישירות: `GemSelectionModal.jsx:53` מגדיר `ALL_FIXED_GEMS` בנפרד; `fundamental` קיים שם (`KNOWLEDGE_MARKET_GEMS`, שורה 48). |
| Decision 13 "טאבים ריקים לעולם לא מוסתרים" | **מיושם** — `visibleTabDefinitions = UNIVERSAL_TABS` בלתי-מותנה (Step 1). |
| Decision 14 "unclassified הוא pending בלבד, לא GEM חמישי" | **מיושם חלקית, לא-committed** — קיים ב-`gemContentRouter.js`/`gemRecommender.js` הנוכחיים (dirty), עם ניסוח נכון יותר מהגרסה המקבילה ב-worktree הנפרד (ראו Step 0). |
| §8, שאלה 1 ("macro בתוך accordion GEMS TJS — נשאר או מוסר?") | **פתוחה** — כפי שהתוכנית עצמה מציינת. |
| §8, שאלה 2 ("תווית 'ממתין לסיווג' — איפה בדיוק ב-UI?") | **פתוחה**. |
| Phase 3/8 "schema-export ייעודי ל-3 GEMs, כולל פונדמנטלי" | **לא מיושם** — עדיין schema גנרי משותף (Step 3). זו בדיוק המשימה שהמשתמש עומד לבצע ידנית עכשיו. |

**מסקנה:** התוכנית מדויקת ברובה מול הקוד, אך **הסדר המומלץ שלה (טכני קודם, ורק אז פונדמנטלי כשכפול)** לא נשמר על ידי הבקשה הנוכחית — המשתמש מבקש לבנות ישירות GEM פונדמנטלי, בלי ש-GEM טכני "מוכח-קצה-לקצה" קיים כתבנית לשכפל ממנה. זו אינה טעות — זו סטייה מפורשת מהתוכנית שכדאי שהמשתמש יהיה מודע לה.

---

## Step 9 — ה-URL המוגדר של ה-GEM וה-payload שמועתק

### אחסון ה-URL

- מפתח: `gemUrl.fundamental` ב-`localStorage` (+ blob גיבוי-legacy תחת `gems_config`).
- קובץ: `src/lib/gemsConfig.js`. **כל אחד מ-10 מפתחות ה-GEM יש לו slot URL עצמאי משלו** (`GEM_STORAGE_KEYS`: general, political, market, technical, fundamental, appBuilder, macro, news, dayTrading, marketBrief).
- ברירת מחדל ל-fundamental: `https://gemini.google.com/gem/593021ea2734` (`defaultGems.fundamental`).
- עריכה: כפתור "הגדר URL"/"ערוך URL" ב-`GemSelectionModal.jsx` → `handleSaveUrl()` → `saveAnyGemUrl(selected, urlDraft)` → `saveGemConfigSnapshot({[key]: url})`.
- ולידציה: `isGeminiGemUrl()` דורשת hostname `gemini.google.com` ונתיב שמתחיל ב-`/gem/`.

### "פתח GEM + העתק תמלול" — ה-payload המדויק שמועתק ללוח (`GemSelectionModal.jsx:258-312`)

```
Title: <video.title>
Channel: <video.channelTitle || video.channelName>
Category: <category>
SubCategory: <subCategory>

JSON output requirements:
Return one complete strict JSON object. Escape every ASCII double quote inside a string value as \".
Include every required comma between adjacent JSON properties and array items.

Transcript:
<fullTranscriptText>
```

**זהו payload מינימלי, ללא schema example, ללא הנחיות שפה/תוכן ספציפיות.** הוא **שונה לחלוטין** מהפרומפט המורכב שמייצר `buildGeminiMarketQuickPrompt` (Step 3) — אין קשר בין השניים בזרימה הזו. משמעות: המידע על "מה בדיוק להחזיר" (סכימה, שפה, סגנון) **חייב** להיות מוטמע בתוך ה-System Instructions של ה-GEM עצמו ב-Gemini web UI — בדיוק מה שהמשתמש עומד לכתוב עכשיו. האפליקציה עצמה, בנתיב הזה, לא שולחת שום schema.

---

## Step 10 — נתיב ההחזרה (Paste-back)

### נקודת הכניסה

`VideoDetailPanel.jsx` — תיבת טקסט `gemsPasteInput` (state), מוזנת דרך דיאלוג "📰 הדבק סיכום מה-GEM" (ראו גם `isGemsPasteOpen`). מצפה ל-**raw JSON** (לא markdown fence — `parseAndValidateGemsJson` מסיר fences אם קיימים כחלק מהניקוי, אך הכלל הבסיסי הוא JSON טהור לפי הוראות ה-prompt).

### `handleApplyGemsJson()` (שורה 6733)

1. `parseAndValidateGemsJson(raw)` — `JSON.parse` קפדני + `validateGemsJsonValue` (Step 2).
2. בכשל — `repairGemsJsonDeterministically(raw)` (מ-`src/lib/gemsJsonRepair.js`, **לא** ה-repair המקיף `sanitizeJsonGershayim` השמור ל-server בלבד). מציג ב-UI: מיקום מדויק (שורה/עמודה), תרגום שגיאה, קונטקסט מסביב לשגיאה, ואפשרות "אשר תיקון" אם נמצא repair שעבר parse+validate.
3. בהצלחה — `_applyParsedGems(result.value)` מנתב לפי `contentType`:
   - `contentType === 'marketBrief'` → marketBriefData (מבזק בלבד).
   - `universalTabs.appBuilder` קיים + לא marketBrief → App Builder draft נפרד.
   - `contentType === 'market'` **וגם** `universalTabs` object → **marketBriefData**, tab פעיל עובר ל-`summary`.
   - אחרת (fallback גנרי — זה מה שקורה ל-schema השטוח הנוכחי של "Gemini פונדמנטלי") → `normalizeAiAnalysisResult(parsed)` → `completeGemsImport(pending, normalized)` שמאחד (merge) שדות **ישירות על ה-`video`** (לא marketBriefData) → tab פעיל עובר ל-`definitions` אם `contentType` הוא `technical|market|learning`, אחרת ל-`political`.

**שדות לא-מוכרים:** בנתיב ה-fallback הגנרי — **נופלים**, כי `normalizeAiAnalysisResult` מחזירה רשימת שדות קבועה-מראש (whitelist), לא pass-through. בנתיב ה-marketBriefData (universalTabs) — **נשמרים כולם** (ה-object השלם נשמר כ-`marketBriefData`), אך רק שדות שה-extraction switch (`extractVideoTabItems`) יודע לחפש בפועל מוצגים אי-פעם.

### מה המשתמש רואה על תשובה פגומה

הודעת שגיאה מדויקת ("JSON לא תקין — שורה X, עמודה Y") + תרגום השגיאה (`translateJsonError`) + הצגת הקונטקסט סביב מיקום השגיאה + (אם רלוונטי) הצעת תיקון דטרמיניסטי שהמשתמש צריך לאשר ידנית — **שום דבר לא מוחל אוטומטית בלי אישור**, תואם לעיקרון fail-closed שמתואר ב-system prompt.

---

## Step 11 — טקסט התיאור בפיקר

"ניתוח פונדמנטלי של חברות, מניות וביצועים פיננסיים" נמצא **אך ורק** ב-`GemSelectionModal.jsx:48` (`KNOWLEDGE_MARKET_GEMS`), כשדה `description` להצגה בכרטיס ה-GEM בתוך המודל. אימתתי בחיפוש-מחרוזת מלא בכל `src/` — **אין שום מקום נוסף** שמשתמש בטקסט הזה (לא ב-Obsidian export, לא ב-tooltips אחרים, לא ב-`gemContentRouter.js`, שם ה-`description` המקביל הוא ניסוח שונה: "ניתוח יסודי: דוחות, שווי, רווחים").

---

## הצעת שלד JSON ל-GEM הפונדמנטלי — נגזר **אך ורק** ממה שהקוד מקבל היום

בהתבסס בלעדית על Steps 2/7/10 — **לא** על שדות חדשים שהומצאו. שני חלקים, כי כפי שהוכח ב-Step 7 אין נתיב יחיד שממלא את כל 6 הסעיפים בבת אחת בלי שינוי קוד:

### אפשרות מומלצת להיום (ללא שינוי קוד): JSON שטוח, לא universalTabs

ממלא: `analysis-frameworks`, `investment-checklist` (fallback), `mistakes`, `checklists`, `chapters`, `insights`, `useful-knowledge`, `summary`. **לא** ממלא: `financial-metrics`, `valuation` (Step 7, פער אמיתי).

```json
{
  "contentType": "market",
  "shortSummary": "...",
  "fullSummary": "...",
  "chapters": [{ "title": "...", "startSeconds": 0, "endSeconds": 0, "summary": "...", "keyPoints": ["..."] }],
  "mainLesson": "...",
  "keyInsights": ["..."],
  "usefulKnowledge": ["..."],
  "frameworks": ["..."],
  "checklists": ["..."],
  "mistakesToAvoid": ["..."],
  "warnings": ["..."],
  "tags": ["..."]
}
```

(שדות אלה נלקחו ישירות מ-`normalizeAiAnalysisResult()`'s מפת השדות המאומתת ב-Step 7 — לא ניחוש.)

### מה שדורש שינוי קוד כדי לעבוד (מתועד כבעיה פתוחה, לא מומלץ לכתוב כרגע בפרומפט בלי החלטת-קוד נלווית)

`financialMetrics`/`valuation` — קיימים כרגע רק בתור מפתחות שה-**renderer** (`videoTabsConfig.js`) יודע לחפש (`financial-metrics` בלבד, ורק דרך `universalTabs.specialized.financialMetrics`), אך שום **parser/normalizer** בצד ה-ingestion לא מעביר אותם לשם מ-JSON שטוח. עד שיתווסף מיפוי מקביל, שדות אלה **לא יופיעו בתוך טאב 7** גם אם ה-GEM יחזיר אותם.

---

## מה נמצא, קבצים שנבדקו, הנחות, החלטות פתוחות

### קבצים שנקראו/נבדקו בפועל (נתיבים מלאים)

- `C:\Users\11\Desktop\Workspace\new-project\projects\youtube-mentor-dashboard\docs\open-items-ledger.md`
- `C:\Users\11\.codex\lessons.md`
- `C:\Users\11\Desktop\Workspace\new-project\projects\youtube-mentor-dashboard-worktree-gems-phase0-1\docs\plan\NIGHT-REPORT-TRADINGBRAIN-GEMS-PHASE0-1.md`
- `src\config\videoTabsConfig.js`, `src\config\workspaceHeadingRegistry.js`
- `src\components\dashboard\VideoDetailPanel.jsx` (מספר קטעים ממוקדים: 139, 3000-3120, 6480-6800, 9857, 10300-10360, 11149, 12210-12750, 13100-13150)
- `src\components\dashboard\SpecializedContentRenderer.jsx` (מלא)
- `src\components\dashboard\DedicatedContentSection.jsx` (מלא)
- `src\components\dashboard\MarketSectorTable.jsx` (מלא)
- `src\components\dashboard\MacroGemDashboard.jsx` (קטע פתיחה)
- `src\components\dashboard\LearningTabContent.jsx` (grep ממוקד)
- `src\components\dashboard\AiMappingModal.jsx` (grep ממוקד)
- `src\components\dashboard\GemSelectionModal.jsx` (מלא ברובו: 1-340, 600-630, 780-785)
- `src\lib\gemRecommender.js` (grep + קטעים: 81-273)
- `src\lib\gemsConfig.js` (מלא)
- `src\lib\gemsJsonRepair.js` (קטעים: 1-40, 200-310)
- `src\lib\morningBriefDisplay.js` (grep + 1345-1430)
- `src\lib\obsidianExport.js` (קטע פתיחה, 1-75)
- `src\ai\gemini\gemContentRouter.js` (מלא)
- `src\ai\quickCopyPrompts.js` (מלא)
- `src\ai\gemini\schemas\marketSchema.js` (מלא)
- `src\ai\gemini\schemas\morningBriefSchema.js` (מלא)
- `src\ai\gemini\validators\validateMarket.js` (grep ל-exports בלבד)
- `src\services\videoAnalytics.js` (קטעים 1080-1300)
- `vite.config.js` (grep ל-imports של ai/gemini)
- `docs\plan\TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN.md` (grep על כותרות + קטעים נבחרים, לא כל הקובץ מילה-במילה)

### הנחות מפורשות (כשמידע חסר)

1. הנחתי ש-"39 worktrees" מה-session-start hook אינם רלוונטיים ל-GEMS מלבד `gems-phase0-1` — לא נבדקו אחד-אחד (scope-decision, לא ניחוש עובדתי).
2. לא עקבתי במלואו אחר `src/lib/obsidianRouting.js`/`src/lib/topicRules.js` כדי לקבוע איזו משלוש התיקיות הפונדמנטליות נבחרת בפועל בזמן ריצה — הושאר כ-open item מפורש, לא הונח.
3. הנחתי ש"תוכן ייעודי לחברות/מניות" בהקשר המשימה מתייחס לטבלת stocks/tickers ברמת tab 7, בדומה למאקרו/מבזק — לא אומת מול המשתמש במפורש, אך זו הפרשנות הסבירה היחידה מתוך התיאור בבריף.

### רשימת החלטות פתוחות שהמשתמש צריך לקבל לפני כתיבת הוראות ה-GEM

1. **פער financial-metrics/valuation (Step 7)**: להסתפק היום בלי שני השדות האלה (ולתעד ב-prompt שהם "future"), או לבקש שינוי קוד תחילה (הוספת מיפוי ב-`normalizeAiAnalysisResult`/`extractVideoTabItems`) לפני כתיבת הוראות ה-GEM שיסתמכו עליהם?
2. **universalTabs לעומת שטוח**: לבחור מסלול אחד (universalTabs+market, ממלא רק financial-metrics; או שטוח, ממלא את 4 האחרים) — או לדרוש את תיקון-הקוד שיאחד את שניהם (Step 7, סעיף 2)?
3. **טבלת מניות ייעודית לפונדמנטלי**: לבנות כמו במאקרו (`MarketSectorTable`/`stockRecordFromObject`-style) — זו עבודת UI/קוד נפרדת, לא רק ניסוח פרומפט.
4. **evening-brief dead branch** (Step 5/8): לתקן כ"Phase 0" נפרד לפני/אחרי עבודת הפונדמנטלי — לא משפיע ישירות על פונדמנטלי, אך משפיע על אותו קובץ router.
5. **סדר-העבודה מול התוכנית** (Step 8, Decision 10): התוכנית ממליצה "טכני קודם" — האם לאשר סטייה מפורשת ולהתקדם ישירות לפונדמנטלי, כפי שהמשימה הנוכחית מבקשת?
6. **תיקיית Obsidian** (Step 6): לאחד ל-`שוק ההון/ניתוח פונדמנטלי` (הקנוני לפי התוכנית) ולבטל/להבהיר את שתי המחרוזות האחרות, או להשאיר כפי שהוא עד שהנתיב בפועל ייבדק?
7. **`feat/gems-phase0-1`** (Step 0): להשאיר local/לא-ממוזג כפי שהוא (אין קריאה לפעולה מיידית — לא נגעתי), או לקבל החלטה מודעת האם/מתי למזג את Phase 1 שלו (`b8a8d40`) לתוך `feat/saved-market-rows-table`, לאור זה שהגרסה הנוכחית על הענף הזה כבר "טובה יותר" מבחינה לוגית?
