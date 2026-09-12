# GEM-FUNDAMENTAL-SCHEMA

**WORK-ID:** TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA
**סוג מסמך:** חוזה JSON מדויק, נגזר מחדש מקריאת קוד בפועל (לא מהעתקת סיכום הביקורת הקודמת). כל שדה מצוטט עם file:line. אין שינוי קוד — מסמך תיעוד בלבד.
**החלטות מנחות (לא לערער, נקבעו על ידי המשתמש):** ראו `docs/plan/AUDIT-TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA.md` — 7 ההחלטות הפתוחות שם הוכרעו: JSON שטוח בלבד (Decision 2), פער financial-metrics/valuation מקובל ל-v1 (Decision 1, **נסגר בקוד ב-2026-09-10, ר' למטה**), אין טבלת מניות ייעודית חדשה (Decision 3).

**עדכון ארכיטקטוני (2026-09-10, כלל "טאב 7 = תוכן יומי בלבד"):** כלל חדש, גורף לכל הנושאים באפליקציה (לא רק פונדמנטלי): טאב 7 ("תוכן ייעודי") שמור אך ורק לתוכן ספציפי-לחברה/מניה **של אותו יום**. כל חומר לימודי כללי — `frameworks`/`checklists`/`mistakesToAvoid` וגם 4 שדות חדשים (`financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates`) — עבר לטאב 4 ("ידע שימושי"). ה-branch `macro` **לא נגע בו** — נבדק ונמצא כבר תואם לכלל (`MacroGemDashboard.jsx` מציג רק תוכן יומי אמיתי: אירועים, סיכונים, סקטורים, מניות, מדדים — אין שם אף סעיף "לימודי"). ענפי המבזקים (`morning-brief`/`evening-brief`/`weekly-brief`/`earnings-brief`) **לא נגעו בהם כלל**, לפי דרישה מפורשת.

**⚠️ עדכון ארכיטקטוני שני, מבטל את הראשון עבור טאב 7 בלבד (2026-09-11 לילה, הכרעת משתמש סופית — ר' `docs/gems/FUNDAMENTAL-OVERVIEW.md` §7):** ההצהרה למעלה ש-`fundamental-analysis`/`technical-analysis` branches "רוקנו מ-`sectionDefs` ונופלות תמיד ל-empty-state המשותף" **אינה נכונה יותר**. המשתמש ביקש במפורש שטאב 7 יציג את **9 הסעיפים המלאים** של דשבורד המבזק (`<MorningBriefDashboard>` — 🧠 סנטימנט עם Fear&Greed/AAII חיים, 📊 מצב שוק, 📅 לוח כלכלי, 🌍 מאקרו, 📰 חדשות, 🎯 הזדמנויות וסיכונים, 🏭 סקטורים, 📈 שווקים, ⭐ מניות שהוזכרו) — **עם ה-empty-state העצמאי של כל סעיף בנפרד**, לא empty-state כולל-אחד. **הג'ם הפונדמנטלי עצמו עדיין לא פולט שום דבר לטאב 7** — זו האפליקציה שמרנדרת את מבנה 9 הסעיפים בכל מקרה (בדיוק כמו שהיא עושה למבזק לפני ניתוח GEM); כל שדה-תוכן שהג'ם הזה כותב עדיין הולך לטאבים 3/4 בלבד, ללא שינוי. סעיפים 3-8 למטה (למעט §5 שורת "תוכן ייעודי (7)", המתוקנת בנפרד) נשארים נכונים כמתועד — ההבדל הוא ורק בהתנהגות טאב 7 עצמו.

---

## 1. נקודת הכניסה בפועל

`VideoDetailPanel.jsx`'s `handleApplyGemsJson()` → `parseAndValidateGemsJson(raw)` (`src/lib/gemsJsonRepair.js:303`) → בהצלחה → `_applyParsedGems(result.value)` (`VideoDetailPanel.jsx:6524`).

`_applyParsedGems` בודק בסדר הזה (`VideoDetailPanel.jsx:6531-6660`):
1. `canonicalParsed?.contentType === 'marketBrief'` → נתיב מבזק (**לא** לשימוש כאן).
2. `parsed?.universalTabs?.appBuilder` קיים + לא marketBrief → נתיב App Builder נפרד.
3. `canonicalParsed?.contentType === 'market' && canonicalParsed?.universalTabs` (object) → נתיב "Macro / Universal Market GEM", מאחסן ל-`marketBriefData`.
4. **אחרת (זה הנתיב שלנו)** → `normalizeAiAnalysisResult(parsed)` (`VideoDetailPanel.jsx:6666`) → `completeGemsImport(pending, normalized)` (`VideoDetailPanel.jsx:6700`) — ממזג (merge) את פלט ה-normalize **ישירות על אובייקט ה-`video`**.

**אימות קריטי ל-Decision 2:** `canonicalizeGemsPayloadForPersistence(value)` (`src/lib/gemsJsonRepair.js:152-177`), הפונקציה הראשונה שרצה בתוך `_applyParsedGems` (`VideoDetailPanel.jsx:6531`), פותחת ב: `if (!isPlainObject(value) || !isPlainObject(value.universalTabs)) return value;` (`gemsJsonRepair.js:153`). כלומר **אם `universalTabs` נעדר לגמרי מה-JSON, הפונקציה מחזירה את האובייקט ללא שינוי** — מאושר: JSON שטוח ללא `universalTabs` בהחלט ינתב לנתיב 4 לעיל, בלי סיכון "לגלוש" בטעות לנתיב 3.

---

## 2. שער-הקבלה של `validateGemsJsonValue` לנתיב השטוח (`src/lib/gemsJsonRepair.js:248-301`)

- Root **חייב** להיות plain object (`gemsJsonRepair.js:250-252`).
- `contentType`, אם קיים, חייב להיות string (`:254-256`).
- **מכיוון של-JSON השטוח שלנו אין `universalTabs`**, הבדיקה `isPlainObject(universalTabs)` (`:264`) נכשלת ומדלגים ישר ל-branch האחרון (`:296-300`):

```js
const GENERIC_ANALYSIS_FIELDS = [
  'shortSummary', 'fullSummary', 'keyPoints', 'allPoints', 'chapters',
  'keyInsights', 'usefulKnowledge', 'actionItems', 'politicalSummary', 'brainHighlights',
];
```
(`src/lib/gemsJsonRepair.js:28-39`)

**דרישת-סף מחייבת:** לפחות שדה אחד מתוך 10 השדות האלה **חייב** להופיע ברמת השורש, אחרת `validateGemsJsonValue` מחזירה `ok:false` עם השגיאה `'No recognized GEMS analysis fields were found.'` (`:297-299`), ו-`parseAndValidateGemsJson` **דוחה את כל ה-JSON** לפני שהוא מגיע בכלל ל-`normalizeAiAnalysisResult`. בפרקטיקה: `shortSummary`, `fullSummary`, `chapters`, `keyInsights`, ו-`usefulKnowledge` (כולם מומלצים ב-instructions ממילא) מספיקים בנוחות.

---

## 3. מיפוי שדה→שדה מדויק: `normalizeAiAnalysisResult()` (`src/services/videoAnalytics.js:1080-1293`)

זו הפונקציה שמייצרת את האובייקט שמתמזג בפועל על `video`. הטבלה הבאה מצטטת כל שורת-מיפוי רלוונטית:

| שדה פלט (נכתב על `video.<key>`) | קורא מ-(`merged`/`nested`/`learning` = spread של `result`/`result.analysis`) | file:line |
|---|---|---|
| `shortSummary` | `merged.shortSummary \|\| merged.summary \|\| nested.shortSummary \|\| nested.summary` | `videoAnalytics.js:1156-1162` |
| `fullSummary` | `merged.fullSummary \|\| merged.longSummary \|\| nested.fullSummary \|\| nested.longSummary` | `:1163-1169` |
| `mainLesson` | `merged.mainLesson` (string) או `.summary`/`.title` | `:1125-1129, 1177` |
| `chapters` | `normalizeAnalysisChapters(merged.chapters \|\| merged.sections \|\| merged.segments \|\| merged.topics \|\| merged.videoTopics \|\| merged.aiChapters)` | `:1092-1100, 1227` |
| `keyInsights` | `merged.keyInsights \|\| nested.keyInsights \|\| utB.keyInsights \|\| bkB.keyInsights` (+ מאוחד עם `learning.keyInsights`) | `:1187-1194` |
| `usefulKnowledge` | `merged.usefulKnowledge \|\| nested.usefulKnowledge \|\| learning.usefulKnowledge \|\| learning.keyTakeaways` | `:1225` |
| `tags` | `merged.tags \|\| merged.aiTags \|\| nested.tags \|\| nested.aiTags \|\| bkB.tags` | `:1180` |
| **`frameworks`** | `merged.frameworks \|\| nested.frameworks \|\| learning.frameworks` | `:1204-1206` |
| **`checklists`** | `merged.checklists \|\| nested.checklists \|\| learning.checklists` | `:1198-1200` |
| **`mistakesToAvoid`** | `merged.mistakesToAvoid \|\| nested.mistakesToAvoid` | `:1184-1186` |
| **`warnings`** | `merged.warnings \|\| nested.warnings \|\| learning.warnings \|\| specB.riskFactors \|\| bkB.warnings` | `:1201-1203` — **מוצג בפועל כעת, ממוזג עם `mistakesToAvoid`, ר' §6.1 המתוקן** |
| **`financialMetrics`** (חדש, 2026-09-10) | `normalizeLearningArray(merged.financialMetrics \|\| nested.financialMetrics)` | `:1207` |
| **`valuation`** (חדש, 2026-09-10) | `normalizeLearningArray(merged.valuation \|\| nested.valuation)` | `:1208` |
| **`investmentChecklist`** (חדש, 2026-09-10) | `normalizeLearningArray(merged.investmentChecklist \|\| nested.investmentChecklist)` | `:1209` |
| **`promptTemplates`** (חדש, 2026-09-10) | `normalizeLearningArray(merged.promptTemplates \|\| nested.promptTemplates)` | `:1210` |

**עדכון (2026-09-11, WORK-ID TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY):**

| **`stockFundamentals`** (חדש, 2026-09-11) | `normalizeStockFundamentalsArray(merged.stockFundamentals \|\| nested.stockFundamentals)` — normalizer ייעודי, **לא** `normalizeLearningArray` (שקורס אובייקטים למחרוזת-תצוגה) | `videoAnalytics.js` (ליד שורה 1209-1210, פונקציית `normalizeStockDataPointItem`) |

שלא כמו 8 השדות בטבלה למעלה, `stockFundamentals` הוא **תמיד** מערך אובייקטים מובנים (`{ticker, company, metric, value, interpretation, asOf, sourceQuote, estimatedStartSeconds, timestampKind}`), לא טקסט. הנורמליזר **דורש** `ticker`+`metric`+`value` — פריט חסר אחד משלושתם מוחזר `null` ומסונן בשקט (`Array.prototype.filter(Boolean)`), לא שגיאת-parse. ר' §10 למטה לפירוט המלא (שדה, מיפוי, רינדור, gate).

**עדכון (2026-09-10):** 4 השדות האחרונים בטבלה נוספו כעת — סוגר את הפער ההיסטורי (ראו למטה, §4/§5/§8 היו). **עדיין לא ממופים בכלל**, מאומת בקריאת הפונקציה השלמה: `analysisFrameworks` (רק `frameworks` ממופה — שם השדה הנכון הוא `frameworks`, **לא** `analysisFrameworks`), `riskRules`. אם ה-GEM יחזיר אחד משני אלה, הם פשוט **יושמטו בשקט**.

**✅ תוקן — `warnings`, `fullSummary`, `mainLesson` ממופים כאן וכעת גם מוצגים, כל אחד במסלול משלו (`mainLesson`/`warnings`: ledger "Recently resolved", 2026-09-10; `fullSummary`: שורת ledger 2026-09-11, "Key-points card restyle"):** הטבלה למעלה נכונה — `normalizeAiAnalysisResult` כותבת את שלושת השדות האלה על `video`. עד 2026-09-10 השכבה הבאה — `extractVideoTabItems()` ב-`videoTabsConfig.js` — השתמשה ב-`pickArray`/`pickStringAsArray` "ראשון-לא-ריק-מנצח, לא ממזג", מה שגרם לשלושת השדות האלה לא להיקרא בפועל כש-`shortSummary`/`mistakesToAvoid` היו מלאים. **קריאה ישירה של הקוד הנוכחי מצאה ששלושתם תוקנו, בשני מנגנונים נפרדים**: (א) `case 'mistakes'` (`videoTabsConfig.js`, ליד שורה 783) מריץ כעת שלוש קריאות `pickArray` נפרדות ל-`mistakesToAvoid`/`warnings`/`riskRules`, ממוזגות יחד — `warnings` מוצג עכשיו בטאב 4 יחד עם `mistakesToAvoid`; (ב) `case 'summary'` (ליד שורה 689) מריץ כעת שתי קריאות `pickStringAsArray` נפרדות — שרשרת האליאסים `shortSummary`/`fullSummary`/`gemSummary`/`summary` (ראשון-לא-ריק-מנצח, ללא שינוי) ואז `mainLesson` בנפרד, שמוצג כעת תמיד בנוסף — `fullSummary` **עדיין** נחשב אליאס בתוך `case 'summary'` עצמו ולכן לא נבדק שם כש-`shortSummary` מלא; אך הוא כעת מוצג דרך מסלול נפרד וחדש: `FullSummaryParagraphs` (`src/components/dashboard/FullSummaryParagraphs.jsx`, קומפוננטה חדשה) מרונדרת ב-`VideoDetailPanel.jsx:11234` כ-`<FullSummaryParagraphs text={effectiveVideo.fullSummary} .../>` — כרטיס "📖 סיכום מלא" עצמאי, בלתי-תלוי ב-`extractVideoTabItems('summary')`. פירוט מלא בסעיף 6.1 למטה, שעודכן בהתאם.

---

## 4. שני הפערים המדויקים שנדרשו לפתרון עמימות (i)/(ii)

### (i) שם השדה המדויק ל-frameworks/checklists/mistakesToAvoid/warnings — נפתר

מאושר בטבלה שלמעלה (סעיף 3), ישירות מקריאת `videoAnalytics.js:1184-1206`: השמות הנכונים והיחידים שממופים בפועל הם `frameworks` (**לא** `analysisFrameworks`), `checklists`, `mistakesToAvoid`, `warnings`. אין תמיכה ב-`riskRules` בנתיב הזה כלל (בניגוד לסכימה השטוחה הישנה `getMarketSchemaExample()` שכן כוללת `riskRules` — אך זו שייכת לנתיב אחר, לא ל-`normalizeAiAnalysisResult`). **הערה (מתוקנת 2026-09-11):** "ממופה" כאן פירושו שהשדה נכתב על `video`; `warnings` ספציפית **כן מוצג כעת בפועל**, ממוזג עם `mistakesToAvoid` בתוך אותו סעיף בטאב 4 — ראה §6.1 המתוקן.

### (ii) `checklists` מול `investment-checklist` — היה כפול, **נסגר בקוד ב-2026-09-10**

`src/config/videoTabsConfig.js`'s `extractVideoTabItems()` — המצב **ההיסטורי** (לפני 2026-09-10):

```js
case 'checklists':
  return [...pickArray(video, 'checklists'), ...pickArray(al, 'checklists'), ...pickArray(a, 'checklists', 'rules')];

case 'investment-checklist':
  return [
    ...pickArray(video, 'investmentChecklist'),        // ← היה לעולם ריק (לא ממופה)
    ...pickArray(a, 'investmentChecklist'),
    ...pickArray(video, 'checklists'), // graceful fallback  ← המקור בפועל, תמיד
  ];
```

**התיקון שבוצע (2026-09-10):** עכשיו `investmentChecklist` ממופה (§3 למעלה), וה-`case` שונה לגייט אמיתי — `checklists` נכנס כ-fallback **רק אם** `investmentChecklist` ריק:

```js
case 'investment-checklist': {
  const primary = [...pickArray(video, 'investmentChecklist'), ...pickArray(a, 'investmentChecklist')];
  return primary.length > 0 ? primary : pickArray(video, 'checklists');
}
```
(`src/config/videoTabsConfig.js`, ליד case `'checklists'`)

**מסקנה עדכנית:** כשה-GEM ממלא את שני השדות (מומלץ עכשיו — `checklists` לכללי-אצבע כלליים, `investmentChecklist` לתוכן הנהלה/אנליסטים/buybacks), שני הסעיפים בטאב 4 ("✅ צ'קליסטים" ו-"📋 צ'קליסט השקעה") מציגים תוכן **שונה בפועל**, לא כפול. הכפילות ההיסטורית עדיין קיימת רק אם ה-GEM משאיר את `investmentChecklist` ריק (התנהגות legacy, עדיין נתמכת לתאימות-לאחור).

---

## 5. מיפוי מלא: שדה JSON → טאב/אזור באפליקציה, עם סטטוס נגישות (מעודכן 2026-09-10)

**שינוי מבני:** כל 7 שדות התוכן הלימודי (כולל 4 החדשים) עברו מטאב 7 לטאב 4 — טאב 7 אינו מקבל אף שדה מהג'ם הפונדמנטלי הזה יותר (ר' "עדכון ארכיטקטוני" בראש המסמך).

| שדה JSON שטוח | טאב (#) | אזור | נגיש דרך JSON שטוח? | מקור בקוד |
|---|---|---|---|---|
| `shortSummary` | סיכום (1) | — | ✅ כן | `videoTabsConfig.js` case `'summary'`, `pickStringAsArray(video,'shortSummary','fullSummary','gemSummary','summary')` (`~689`) — ראשון-לא-ריק-מנצח בין 4 האליאסים |
| `mainLesson` | סיכום (1) | — | ✅ **כן, תוקן 2026-09-11** — `pickStringAsArray(video,'mainLesson')` נפרד, מתווסף תמיד (ר' §6.1) | אותו case, קריאה שנייה נפרדת |
| `fullSummary` | סיכום (1) — כרטיס "📖 סיכום מלא" נפרד | — | ✅ **כן, תוקן 2026-09-11** — לא דרך `case 'summary'` (שם עדיין אליאס-בלבד), אלא כרטיס עצמאי | `FullSummaryParagraphs.jsx`, מרונדר ב-`VideoDetailPanel.jsx:11234` |
| `chapters` | פרקים (2) | — | ✅ כן | case `'chapters'` (`~703-706`), `normalizeAnalysisChapters` |
| `keyInsights` | תובנות (3) | — | ✅ כן | case `'insights'` legacy (`~814-825`) |
| `usefulKnowledge` | ידע שימושי (4) | 📚 ידע לשימוש חוזר | ✅ כן | case `'useful-knowledge'` legacy (`~735-743`) |
| `frameworks` | ידע שימושי (4) | ⚙️ מסגרות ניתוח (**הועבר מטאב 7**, 2026-09-10) | ✅ כן | `VideoDetailPanel.jsx`'s תוכן-לימודי section array (ליד שורה 12400), case `'analysis-frameworks'` |
| `checklists` | ידע שימושי (4) | ✅ צ'קליסטים (**הועבר מטאב 7**) | ✅ כן | אותו מערך, case `'checklists'` |
| `mistakesToAvoid` | ידע שימושי (4) | ❌ טעויות נפוצות (**הועבר מטאב 7**, תווית שונתה מ"⚠️ סיכונים") | ✅ כן | אותו מערך, case `'mistakes'` |
| `financialMetrics` (חדש) | ידע שימושי (4) | 📈 מדדים פיננסיים | ✅ **כן — נסגר הפער, Decision 1** | case `'financial-metrics'` (`~924-929`), קורא `video.financialMetrics` שממופה כעת (§3) |
| `valuation` (חדש) | ידע שימושי (4) | 💰 הערכת שווי | ✅ **כן — נסגר הפער, Decision 1** | case `'valuation'` (`~931-935`), קורא `video.valuation` שממופה כעת |
| `investmentChecklist` (חדש) | ידע שימושי (4) | 📋 צ'קליסט השקעה | ✅ כן, תוכן נפרד מ-`checklists` כעת (§4-ii) | case `'investment-checklist'`, גייט חדש |
| `promptTemplates` (חדש) | ידע שימושי (4) | 📜 תבניות פרומפט (סעיף חדש) | ✅ כן | case `'prompt-templates'` (חדש) |
| — | APP (5) | — | ❌ **לא** — ראו סעיף 6 | `AppBuilderTab.jsx` |
| `tags`/`obsidianTopics`/`metadataTopics` | נושאים ותתי־נושאים (6) | — | ✅ כן (`tags` מומלץ) | case `'topics-subtopics'` legacy (`videoTabsConfig.js:1196-1199`) |
| `warnings` | ידע שימושי (4) — ❌ טעויות נפוצות (ממוזג עם `mistakesToAvoid`) | — | ✅ **כן, תוקן 2026-09-11** — ר' §6.1 | case `'mistakes'` (`~783`), קריאת `pickArray` נפרדת ל-`warnings`, ממוזגת עם `mistakesToAvoid`/`riskRules` |
| `stockFundamentals` (חדש) | תוכן ייעודי (7) | 📊 נתונים פונדמנטליים (**חדש, מעל "⭐ מניות שהוזכרו"**) | ✅ כן — case `'stock-fundamentals'` ב-`extractVideoTabItems` | `videoTabsConfig.js`, מיד אחרי case `'prompt-templates'` |
| — | תוכן ייעודי (7) | — | **מוצג — דשבורד-מבזק בן 9+2 סעיפים (2 החדשים רק לוידאו פונדמנטלי/טכני, ר' §10), כל סעיף עם empty-state עצמאי; הוכרע 2026-09-11, ר' `FUNDAMENTAL-OVERVIEW.md` §7** | `SpecializedContentRenderer.jsx`'s `fundamental-analysis`/`technical-analysis` branches מרנדרות `<MorningBriefDashboard showStockDataSections>`; שאר סעיפי-המבזק ריקים במובן "אין `marketBriefData`" — לא ב-`stockFundamentals`/`stockTechnicals` |

---

## 6. ממצא נוסף שהתגלה תוך כדי אימות מחדש: טאב APP אינו נגיש דרך JSON שטוח כלל

`VideoDetailPanel.jsx:12210-12216` מרנדר את טאב 5 ("APP") באמצעות `<AppBuilderTab video={video} topicName={...} marketBriefData={marketBriefData} />` — **לא** דרך `extractVideoTabItems()`. קריאת `src/components/dashboard/AppBuilderTab.jsx:1-51` מאשרת: התוכן היחיד שהקומפוננטה מציגה מגיע מ-`discoverFeaturesFromMacro(marketBriefData)` (שורה 32-35) — כלומר תלוי **ב-`marketBriefData` בלבד**, לא בשום שדה על `video`. בנתיב השטוח (Decision 2) `marketBriefData` נשאר `null` (הוא מוגדר רק בנתיבים 1/3 של `_applyParsedGems`, לא בנתיב 4 שאנחנו משתמשים בו). `normalizeAiAnalysisResult` אמנם מחזירה שדה `appBuilding` (`videoAnalytics.js:1264-1284`), אך אומת בגריפ רחב (`grep -rn "\.appBuilding\b" src/`) ש-**שום קומפוננטה שמרנדרת את טאב 5 לא צורכת אותו** — הצרכנים היחידים של `appBuilding`/`analysis.appBuilding` הם `KnowledgeBrainSections.jsx` ו-`SummaryTabView.jsx`, שני מסכים **שאינם** טאב 5 של 7-הטאבים.

**מסקנה:** בניגוד לפער financial-metrics/valuation (שהיה כבר ידוע), זהו ממצא **חדש** שהתגלה רק באימות המחודש הזה. הוראות ה-GEM (`GEM-FUNDAMENTAL-INSTRUCTIONS.md`) מכוונות במפורש שלא לנסות למלא תוכן ל-APP. זהו gap תיעודי בלבד — לא בוצע שום שינוי קוד.

### 6.1 ✅ "נכתב אך לעולם לא מוצג" — היה נכון עד 2026-09-10, תוקן בקוד ומתועד ב-ledger (ר' למטה)

ממצא זה עלה ב-2026-09-10 מהרצת GEM אמיתי (לא הדוגמה שלנו) על תמלול פונדמנטלי אמיתי, והשוואת ה-JSON שחזר מול מה שהוצג בפועל בטאבים. שורש הבעיה **לא היה** ב-`normalizeAiAnalysisResult` (שממפה את כל השדות נכון, ראה §3) — הוא היה בשכבה שאחריה, ב-`extractVideoTabItems()` (`src/config/videoTabsConfig.js`), ששימשה בשני helpers שבנויים "ראשון-לא-ריק-מנצח, לא ממזגים":

```js
// src/config/videoTabsConfig.js:403-409
function pickArray(obj, ...keys) {
  for (const key of keys) {
    const val = obj?.[key];
    if (Array.isArray(val) && val.length > 0) return val;
  }
  return [];
}

// src/config/videoTabsConfig.js:421-427
function pickStringAsArray(obj, ...keys) {
  for (const key of keys) {
    const val = obj?.[key];
    if (typeof val === 'string' && val.trim()) return [val.trim()];
  }
  return [];
}
```

שני מקומות קונקרטיים בהם זה גרם לאובדן-תוכן שקט, **ושניהם תוקנו בקוד מאז** (מקור התיקון לא תועד ב-ledger עד סבב 2026-09-11 זה — נוספה שורה מתקנת):

| שדה על `video` | קורא אותו | הבעיה שהיתה (עד 2026-09-10) | מה הקוד עושה כעת | file:line |
|---|---|---|---|---|
| `mainLesson` | case `'summary'` | `pickStringAsArray(video,'shortSummary','fullSummary','gemSummary','summary','mainLesson')` החזירה **רק** את הראשון הלא-ריק; `shortSummary` תמיד מלא ⟸ `mainLesson` לעולם לא נבדק. | ✅ קריאת `pickStringAsArray(video,'mainLesson')` נפרדת, נוספת בכל מקרה — מוצג כעת כפריט נוסף בטאב 1. | `videoTabsConfig.js:689` |
| `fullSummary` | case `'summary'` | אותה שרשרת אליאסים — `shortSummary` תמיד מלא ⟸ `fullSummary` לעולם לא נבדק. | ✅ **לא** דרך `case 'summary'` (שם עדיין אליאס-בלבד, ללא שינוי) — אלא דרך כרטיס נפרד `FullSummaryParagraphs` ("📖 סיכום מלא"), שקורא `effectiveVideo.fullSummary` ישירות, בלתי-תלוי בשרשרת ה-picker. | `FullSummaryParagraphs.jsx`, מרונדר ב-`VideoDetailPanel.jsx:11234` |
| `warnings` | case `'mistakes'` | `pickArray(video,'mistakesToAvoid','warnings','riskRules')` החזירה **רק** את הראשון הלא-ריק; `mistakesToAvoid` תמיד מלא ⟸ `warnings` לעולם לא נבדק. | ✅ שלוש קריאות `pickArray` נפרדות ל-`mistakesToAvoid`/`warnings`/`riskRules`, כל התוכן הלא-ריק ממוזג יחד לאותו סעיף "❌ טעויות נפוצות" בטאב 4. | `videoTabsConfig.js:781-786`, השורה הקריטית `:783` |

**תיקון שבוצע במסמכים (2026-09-10, נכון עדיין כהמלצת-תוכן):** `GEM-FUNDAMENTAL-INSTRUCTIONS.md` ממשיך להורות ל-GEM (א) לשלב את המסקנה המרכזית בתוך `shortSummary` עצמו (כי `shortSummary` הוא היחיד שמוצג ראשון/בולט בטאב 1), ו-(ב) לוותר על שדה `warnings` נפרד ולמזג כל תוכן-סיכון לתוך `mistakesToAvoid` — זו עדיין המלצת-תוכן טובה גם היום שהקוד מציג את `warnings` בנפרד, כי היא פשוטה יותר לכתיבה מצד ה-GEM; אך אינה עוד הכרחית-לתצוגה כמו שהייתה.

**תיקון-הקוד בוצע בפועל (2026-09-10, מתועד ב-`docs/open-items-ledger.md`'s "Recently resolved" section — "`pickArray`/`pickStringAsArray` 'first-non-empty-wins' merge bug fixed in code" — לא ב"Open items"; זו הסיבה שקריאה חלקית של הledger פספסה את התיעוד באיטרציה קודמת של המסמך הזה):** ה-`pickArray`/`pickStringAsArray` הרלוונטיים הוחלפו בגרסת-מיזוג (concat כל המועמדים הלא-ריקים, לא "ראשון מנצח") בדיוק במקומות שבהם רצוי תוכן-מצטבר — שרשרת האליאסים המקורית (`shortSummary`/`fullSummary`/`gemSummary`/`summary`) נותרה "ראשון מנצח" בכוונה (הם אכן שמות-נרדפים לאותו תוכן), ורק `mainLesson`/`warnings` (שאינם נרדפים, אלא תוכן משלים) יצאו מהשרשרת למיזוג נפרד.

---

## 7. שדות שנבדקו ונמצאו **לא** רלוונטיים לנתיב הזה (לשם שלמות)

- `keyPoints`/`allPoints`/`actionItems`/`politicalSummary`/`brainHighlights` — חלק מ-`GENERIC_ANALYSIS_FIELDS` (מספיקים לשער הכניסה, סעיף 2) אך לא נדרשים לתוכן פונדמנטלי; לא הוכללו בהוראות/בדוגמה כדי לא להסיח.
- `stocksMentioned`/`tradingSetups`/`tradingRules`/`keyLevels`/`indicators`/`marketConditions`/`riskRules` — קיימים בסכימה השטוחה **הישנה** המשותפת (`getMarketSchemaExample()`, `src/ai/gemini/schemas/marketSchema.js`) אך **אף אחד מהם לא ממופה על ידי `normalizeAiAnalysisResult`** (אומת בקריאת הפונקציה המלאה) — שימוש בהם היה מבוזבז באותה מידה כמו `financialMetrics`/`valuation`. לא נכללו בהוראות.

---

## 8. סיכום פערים (מעודכן 2026-09-10)

| פער | סטטוס | הערה |
|---|---|---|
| financial-metrics לא נגיש | ✅ **נסגר 2026-09-10** | `financialMetrics` ממופה כעת (§3), מוצג בטאב 4 |
| valuation לא נגיש | ✅ **נסגר 2026-09-10** | `valuation` ממופה כעת (§3), מוצג בטאב 4 |
| APP (tab 5) לא נגיש דרך JSON שטוח | פתוח | לא טופל בקוד הסבב הזה — הוראות ה-GEM לא מנסות למלא אותו |
| `checklists`/`investment-checklist` — כפילות מבנית | ✅ **נסגר 2026-09-10** | `investmentChecklist` ממופה + גייט fallback (§4-ii) — שני הסעיפים מציגים תוכן שונה כשה-GEM ממלא את שניהם |
| אין טבלת מניות ייעודית בטאב 7 לפונדמנטלי | ✅ **נסגר חלקית 2026-09-11** (WORK-ID TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY) | `stockFundamentals` (הג'ם כותב) + `stockTechnicals` (סכימה מוגדרת, GEM טכני נפרד עדיין לא כותב) — שני סעיפי-טבלה חדשים בטאב 7, ר' §10. "חלקית" כי רק הפונדמנטלי מוזן כרגע. |
| טאב 7 מציג תוכן לימודי (frameworks/checklists/mistakes) | ✅ **תוקן 2026-09-10 — הוסר לגמרי** | הועבר לטאב 4 בעקבות כלל "טאב 7 = תוכן יומי בלבד"; חל גם על `technical-analysis`; `macro` נבדק ונמצא כבר תואם, לא נגע בו; מבזקים לא נגעו בהם |
| טאב 7 חוזר להציג מבנה מלא (דשבורד-מבזק בן 9 סעיפים) במקום empty-state כולל-אחד | **✅ הכרעת משתמש 2026-09-11 — זו ההתנהגות המבוקשת, ר' `FUNDAMENTAL-OVERVIEW.md` §7** | מבטל את השורה שלמעלה עבור טאב 7 בלבד — התוכן הלימודי (frameworks/checklists/mistakes) עדיין בטאב 4, לא חזר לטאב 7 |
| `promptTemplates`/26 מדדי KPI/4 דשבורדי-על לא נתפסים | ✅ **נסגר 2026-09-10** | `promptTemplates` שדה חדש + `financialMetrics`/`valuation` מכסים את מפת ה-KPI + `frameworks` מכסה את הדשבורדים (ר' `GEM-FUNDAMENTAL-INSTRUCTIONS.md`) |
| אין אכיפת-צפיפות על ה-JSON שנדבק (GEM עלול לסכם במקום למנות) | ✅ **נסגר חלקית 2026-09-10** | `validateGemsJsonValue` מחזירה כעת `densityWarnings` (לא-חוסם) כשה-GEM מחזיר שדה עם פריט יחיד בלבד; באנר מוצג למשתמש בדיאלוג ההדבקה |
| דוגמת ה-GEM (`GEM-FUNDAMENTAL-EXAMPLE.json`) משתמשת בתיאורי-חברה מוכללים ("חברת שבבים מובילה") ולא בטיקרים/שמות חברה אמיתיים | `architect-reviewer`, סבב-ביקורת שני | פרשנות סבירה של "אל תמציא תוכן" (אין תמלול אמיתי לדוגמה) — אך המשמעות בפועל: הדוגמה **לא** בודקת את מסלול stock-linkification/Finviz, גם אם הוא היה חלק מהציפייה המקורית ל-"2-3 שורות מניה". אם רוצים לוודא שהאפליקציה מקשרת טיקרים אמיתיים מתוך `frameworks`/`checklists` בפועל, נדרש סבב-בדיקה נפרד עם דוגמה שכוללת טיקר אמיתי (למשל `NVDA`) — לא בוצע כאן. |
| `mainLesson` נכתב על `video` אך לעולם לא מוצג בטאב 1 כאשר `shortSummary` גם קיים | ✅ **נסגר בקוד 2026-09-10, ledger "Recently resolved"** | היה: `pickStringAsArray` "ראשון-לא-ריק-מנצח" (`videoTabsConfig.js:689`). כעת: נבדק בנפרד, מוצג תמיד. ר' §6.1 המתוקן. |
| `fullSummary` נכתב על `video` אך לעולם לא מוצג בטאב 1 כאשר `shortSummary` גם קיים | ✅ **נסגר בקוד — שורת ledger 2026-09-11 ("Key-points card restyle")** | היה: `pickStringAsArray` "ראשון-לא-ריק-מנצח" (`videoTabsConfig.js:689`, ללא שינוי בשרשרת הזו עצמה). כעת מוצג דרך כרטיס `FullSummaryParagraphs` נפרד, בלתי-תלוי בשרשרת. ר' §6.1 המתוקן. |
| `warnings` נכתב על `video` אך לעולם לא מוצג בטאב 7 (**היום: טאב 4**) כאשר `mistakesToAvoid` גם קיים | ✅ **נסגר בקוד 2026-09-10, ledger "Recently resolved"** | היה: `pickArray` "ראשון-לא-ריק-מנצח" (`videoTabsConfig.js:783`). כעת: שלוש קריאות נפרדות, ממוזגות. ר' §6.1 המתוקן. |
| פריטי הלמידה (frameworks/checklists/mistakesToAvoid/financialMetrics/valuation/investmentChecklist/promptTemplates/usefulKnowledge) הם מחרוזות שטוחות — חותמת ה"מקור: HH:MM:SS" אינה קישור פעיל | ✅ **נסגר 2026-09-10, ללא שינוי קוד** | ר' §9 למטה — כל 8 השדות יכולים כעת לשאת פריט-אובייקט עם `estimatedStartSeconds`/`sourceQuote`, ומקבלים קישור-זמן פעיל דרך תשתית קיימת (`normalizeTimedNarrativeItem`). אופציונלי — GEM יכול עדיין להחזיר מחרוזת פשוטה כשלא בטוח בזמן. |

---

## 9. `universalTabs` — נבדק כישימות, נמצא לא-שמיש; נמצא פתרון חלופי ללא שינוי קוד (2026-09-10)

### 9.1 השאלה שנבדקה

האם ניתן להעתיק את התבנית שמבזק בוקר/ערב משתמש בה (JSON עם `universalTabs`, שדות-זמן לכל פריט, כללי-אימות מחמירים) לג'ם הפונדמנטלי, כדי לקבל עושר-חילוץ דומה?

### 9.2 מסקנה: לא — 2 סיבות חוסמות, מאומתות בקוד

**סיבה א' — חטיפת נתיב-קליטה.** `VideoDetailPanel.jsx`'s `_applyParsedGems` (שורה 6530) בודק לפי סדר: (1) `contentType==='marketBrief'` (שורה 6540) → נתיב מבזק; (2) `universalTabs.appBuilder` קיים (שורה 6599) → נתיב App Builder; (3) **`contentType==='market' && universalTabs` (object)** (שורה 6627, כותרת ההערה בקוד עצמה: `"Macro / Universal Market GEM — contentType: 'market' with universalTabs. Routes through marketBriefData so all universalTabs.* tabs render correctly."`) → מאחסן ל-`marketBriefData`; (4) אחרת → `normalizeAiAnalysisResult(parsed)` (שורה 6672), ממזג ישירות על `video`.

כל payload עם `contentType:"market"`+`universalTabs` נופל תמיד לנתיב (3). ו-`SpecializedContentRenderer.jsx`'s `isMacroContent` (`const isMacroContent = slug === 'macro' || (!!marketBriefData?.universalTabs && marketBriefData?.contentType === 'market')`) **לא בודק slug בכלל** כשהתנאי השני מתקיים — כלומר וידאו עם `normalizedSubCategory === 'fundamental-analysis'` שנשא `marketBriefData` כזה **היה מוצג כדשבורד מאקרו** (`<MacroGemDashboard>`) במקום ה-empty-state הפונדמנטלי שנקבע היום — סותר ישירות את כלל "טאב 7 = תוכן יומי בלבד".

**סיבה ב' — איפוס כל שדות התוכן.** נתיב (3) לעיל **קורא רק** ל-`completeGemsImport(pending, { marketBriefData, marketBriefSavedAt })` (שורה 6647-6651) — **הוא לעולם לא קורא ל-`normalizeAiAnalysisResult`**. המשמעות: `frameworks`/`checklists`/`mistakesToAvoid`/`financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates`/`usefulKnowledge` לא היו נכתבים על `video` בכלל בנתיב הזה. גם קריאה מ-`marketBriefData` ישירות לא הייתה מצילה את רובם: מתוך 6 ה-`case`-ים הרלוונטיים ב-`extractVideoTabItems`, רק `financial-metrics` קורא `marketBriefData` (דרך `resolveSpecialized()`, `videoTabsConfig.js:350-356`) — `valuation`/`analysis-frameworks`/`investment-checklist`/`checklists`/`mistakes` קוראים **רק** מ-`video`/`video.analysis`, לעולם לא מ-`marketBriefData`. גם `canonicalizeGemsPayloadForPersistence` (`gemsJsonRepair.js:183-208`) לא היה עוזר — רשימות השדות שהוא מקפל ל-`universalTabs.specialized` (`CANONICAL_SPECIALIZED_ROOT_FIELDS`, שורה 103) לא כוללות אף אחד משמות השדות שלנו.

**לכן: לא בוצע שום שינוי ל-`contentType`, לא נוסף `universalTabs`, לא נגעתי בקוד הניתוב.**

### 9.3 הפתרון בפועל — תשתית קיימת, לא universalTabs

בדיקת השאלה "האם התשתית של per-item timing תפעל" הובילה לממצא נפרד וחיובי: `normalizeLearningArray`/`normalizeLearningItem` (`src/services/videoAnalytics.js:619-673`) — **הפונקציה שכל 8 השדות שלנו כבר עוברים דרכה, ללא קשר ל-universalTabs** — קוראת ב-`normalizeLearningItem` (שורה 623) ל-`normalizeTimedNarrativeItem(value)` (`src/ai/gemini/validators/timedNarrative.js:39-74`), ואם הפריט הוא אובייקט עם `timestampSeconds`/`estimatedStartSeconds` תקין, **מחזירה אותו כאובייקט** (שורה 624-626: `if (timedValue && typeof timedValue === 'object') return { ...timedValue, text: cleanAtomicText(timedValue.text) };`) — לא קורסת למחרוזת. `LearningTabContent.jsx`'s `ItemRow` (שורה 98-104) מעביר את הפריט הגולמי (`sourceItem`) ל-`<StaticVideoTimestampLink item={sourceItem} .../>` בנפרד מהטקסט המפורמט — כך ש-`resolveStaticVideoTimestamp` (`staticVideoTimestamp.js:26-40`, מזהה `timestampSeconds`/`estimatedStartSeconds`/`startSeconds`/`exactStartSeconds`) מקבל את האובייקט המקורי ומפעיל קישור אמיתי. פריט ללא שדה-זמן (רק `text`) נופל בחזרה למחרוזת פשוטה (`normalizeLearningItem` שורה 656: `value.text` הוא אחד המפתחות ב-"single well-known keys" fallback) — **לא רגרסיה**, אותה התנהגות כמו היום.

**אומת חי**: הדוגמה `GEM-FUNDAMENTAL-EXAMPLE.json` עודכנה עם כמה פריטי-אובייקט (`frameworks`/`mistakesToAvoid`), נדבקה דרך דיאלוג "הדבק JSON מ-GEMS" האמיתי, ואייקון קישור-הזמן הופיע ופעל על הפריטים האלה בטאב 4 — פריטים ללא שדה-זמן המשיכו להציג כרגיל, ללא רגרסיה.

### 9.4 מה קיים בקוד לצורך "evidence gate" ולמה הוא לא רלוונטי לנתיב הזה

`src/lib/timedNarrativeEvidenceGate.js`'s `applyTimedNarrativeEvidenceGateToAnalysis` (שורה 138) מאמת ציטוט-מקור מול תמלול אמיתי ומוחקת שדות-זמן לא-מאומתים. גריפ מלא של קריאות ל-פונקציה הזו מצא **רק** 4 מקומות: `vite.config.js:529,586,1083` ו-`backend/analyze-video.function.js:405` — כולם בצינור הניתוח **האוטומטי** (הכפתור "התחל ניתוח AI" בתוך האפליקציה, לא הדבקת GEM JSON). **הנתיב הידני (`_applyParsedGems`/`normalizeAiAnalysisResult`) לא קורא לפונקציה הזו בשום מקום** — מאומת בגריפ. משמעות: זמן שה-GEM (מחוץ לאפליקציה) יכתוב, לא עובר שום בדיקת-אמינות אוטומטית כאן — ההוראות (`GEM-FUNDAMENTAL-INSTRUCTIONS.md`) מדגישות "עדיף בלי זמן מאשר זמן שגוי" בהתאם.

---

## 10. `stockFundamentals` / `stockTechnicals` — טבלאות תוכן ייעודי בטאב 7 (2026-09-11, WORK-ID TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY)

### 10.1 `stockFundamentals` — הג'ם הזה כן כותב אותו

צורת הפריט, הרחבה מלאה בהוראות (`GEM-FUNDAMENTAL-INSTRUCTIONS.md`'s סעיף `stockFundamentals`), נורמליזציה ב-`normalizeStockDataPointItem(value, 'metric')` (`videoAnalytics.js`):

```js
{ ticker, company, metric, value, interpretation, asOf, sourceQuote, estimatedStartSeconds, timestampKind }
```

חובה: `ticker` (מנורמל ל-uppercase+trim), `metric` (string לא-ריק), `value` (כל טיפוס, רק נבדק שאינו ריק/undefined/null). פריט חסר אחד מאלה מוחזר `null` ומסונן — **אין שגיאת-parse, אין אזהרה, פשוט לא מופיע**. שדות אחרים (`company`/`interpretation`/`asOf`/`sourceQuote`) אופציונליים, trim בלבד. `estimatedStartSeconds`/`timestampKind` — אותה לוגיקה בדיוק כמו `normalizeTimedNarrativeItem` (שדה-מספר תקין + `timestampKind` מ-`{exact,estimated}`, ברירת מחדל `estimated` אם יש `estimatedStartSeconds` בלי `timestampKind`).

### 10.2 `stockTechnicals` — **סכימה בלבד כאן, אין הוראות-GEM עדיין**

**⚠️ מחוץ להיקף המסמך הזה:** ההוראות לג'ם שיכתוב את השדה הזה בפועל שייכות ל-WORK-ID נפרד, `TRADINGBRAIN-GEM-TECHNICAL-SCHEMA` — **טרם נכתבו** (ר' `docs/gems/GEM-TECHNICAL-PREP-NOTES.md`, הכנה בלבד). הקוד (normalizer + case + רינדור) כן קיים ומוכן לקבל את השדה ברגע שייכתב, אך שום GEM לא פולט אותו כיום — הסעיף "📐 נתונים טכניים" בטאב 7 יציג empty-state עד אז.

צורת הפריט (זהה במבנה ל-`stockFundamentals`, רק `metric`→`levelType`), נורמליזציה ב-`normalizeStockDataPointItem(value, 'levelType')`:

```js
{ ticker, company, levelType, value, interpretation, asOf, sourceQuote, estimatedStartSeconds, timestampKind }
```

חובה: `ticker`, `levelType` (string לא-ריק — ערכים מוצעים: תמיכה / התנגדות / ממוצע נע / פער מחיר / קו מגמה / נפח, **לא נאכף בקוד**, הנחיה בלבד לג'ם העתידי), `value`.

### 10.3 מיפוי שדה→תצוגה (שני השדות, אותה שרשרת בדיוק)

| שלב | `stockFundamentals` | `stockTechnicals` |
|---|---|---|
| Normalize | `normalizeStockFundamentalsArray` → `video.stockFundamentals` | `normalizeStockTechnicalsArray` → `video.stockTechnicals` |
| Extract (tab-7) | `extractVideoTabItems(video, 'stock-fundamentals', marketBriefData)` — `videoTabsConfig.js`, אותו pattern כמו `financial-metrics` (`resolveSpecialized` קודם, נופל ל-`video`/`video.analysis`) | `extractVideoTabItems(video, 'stock-technicals', marketBriefData)` |
| Bulk-section (בחר הכל) | `buildMorningBriefBulkSections` (`morningBriefBulkSections.js`) — פריט `{key:'stock-fundamentals', label:'📊 נתונים פונדמנטליים', ...}`, מתווסף **רק אם** יש לפחות שורה אחת (כמו כל שאר הסעיפים בפונקציה הזו) | זהה, `key:'stock-technicals'`, `label:'📐 נתונים טכניים'` |
| Render | `<StockFundamentalsSection>` (`MorningBriefPanels.jsx`) — עמודות: סימול / מדד / ערך / משמעות / תאריך | `<StockTechnicalsSection>` — עמודות: סימול / סוג רמה / ערך / משמעות / תאריך |
| Gate | שני הסעיפים מותנים יחד ב-`showStockDataSections` (prop בוליאני על `MorningBriefDashboard`, ברירת מחדל `false`) — ר' §10.4 |

### 10.4 ה-gate — שני הסעיפים לעולם לא מופיעים במבזק בוקר/ערב

`MorningBriefDashboard.jsx` הוא הרכיב המשותף היחיד בין 4 ה-slugs (`fundamental-analysis`/`technical-analysis`/`morning-brief`/`evening-brief`, ר' `AUDIT-TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY.md` Step 12). ה-prop `showStockDataSections` (ברירת מחדל `false`) עוטף את שני הסעיפים החדשים ב-JSX (`{showStockDataSections ? <>...</> : null}`) — **רק** `SpecializedContentRenderer.jsx`'s `fundamental-analysis`/`technical-analysis` branch (שורה ~148) מעביר `showStockDataSections` (בוליאני `true`, ללא ערך = `true` ב-JSX). ה-branch של `morning-brief`/`evening-brief` (שורה ~165) ו-`weekly-brief`/`earnings-brief` (שאינם קוראים ל-`MorningBriefDashboard` בכלל, יש להם רינדור עצמאי) לא נוגעים ולא מעבירים את ה-prop — כלומר גם אם `video.stockFundamentals` היה איכשהו מתמלא על וידאו-מבזק (לא קורה בפועל, אף GEM-מבזק לא כותב את השדה הזה), הסעיף **לא היה מרונדר בכלל**, לא רק ריק — `{false ? ... : null}` לא מכניס אף DOM node, לא SectionCard ריק.

---

## 11. הכנה ל-GEM הטכני (מחר) — ראו מסמך נפרד

**עדכון (2026-09-11):** נכתב מסמך הכנה נפרד, `docs/gems/GEM-TECHNICAL-PREP-NOTES.md`, לקראת בניית ה-GEM הטכני על אותו עיקרון. הוא מתעד מה ניתן לשימוש חוזר כמו-שהוא, מה ספציפי-לפונדמנטלי וצריך תחליף, אילו שדות (`indicators`/`setups`/`patterns`) הנתיב הטכני כבר קורא היום עם file:line, ותיקון-דיוק ל-§7 למעלה (`indicators` **כן** ממופה ע"י `normalizeAiAnalysisResult`, בניגוד למה שכתוב שם). **לא בוצע שום שינוי קוד או כתיבת הוראות ל-GEM הטכני** — מסמך תיעוד-הכנה בלבד.
