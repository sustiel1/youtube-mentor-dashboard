# GEM-BRIEF-SCHEMA

**WORK-ID:** TRADINGBRAIN-BRIEF-RULES-STOCKDATA
**סוג מסמך:** חוזה JSON, נגזר מקריאת קוד בפועל, באותו סגנון בדיוק כמו `docs/gems/GEM-FUNDAMENTAL-SCHEMA.md` (כל שדה מצוטט עם file:line). **עותק-ייחוס בריפו בלבד** — הג'ם הפרטי עצמו חי מחוץ לריפו, ר' `docs/gems/GEM-BRIEF-INSTRUCTIONS.md` לפרטים. אין שינוי קוד — מסמך תיעוד בלבד.

---

## 1. נקודת הכניסה בפועל

`VideoDetailPanel.jsx`'s `_applyParsedGems(parsed)` (`:6534`) → `canonicalParsed = canonicalizeGemsPayloadForPersistence(parsed)` (`:6541`, `src/lib/gemsJsonRepair.js:183-208`) → `if (canonicalParsed?.contentType === 'marketBrief')` (`:6544`) → מסלול-מבזק נפרד: `parsedWithOverrides = stampMarketBriefSource(preserveManualOverridesOnReanalysis(marketBriefData, canonicalParsed), {...})` → נשמר כ-`marketBriefData: parsedWithOverrides` על `video` (`:6562-6566`).

**אימות קריטי, אותו דפוס כמו אצל הפונדמנטלי:** המסלול הזה **אינו** קורא ל-`normalizeAiAnalysisResult` בשום שלב — הוא ממפה רק ל-`marketBriefData`. משמעות: שום שדה חדש שיתווסף כאן **לא** ייכתב אף פעם על `video.*` השטוח — כל צריכה חייבת לעבור דרך `marketBriefData`/`resolveSpecialized`, לא דרך אותו מנגנון שמזין את "📏 כללי מסחר" הקבוע (ר' §4 למטה).

---

## 2. `canonicalizeGemsPayloadForPersistence` — מה קורה לשדות ברמת-שורש

(`src/lib/gemsJsonRepair.js:183-208`) רץ על כל payload עם `contentType` מתוך `['marketBrief', 'market']` **ו**-`universalTabs` (object) קיים — שני התנאים מתקיימים עבור הטקסט הבסיסי ב-`GEM-BRIEF-INSTRUCTIONS.md` (`contentType:"marketBrief"` + `universalTabs` תמיד נוכח בשלד).

`moveRootFieldsIntoSection(root, universalTabs, 'specialized', CANONICAL_SPECIALIZED_ROOT_FIELDS)` (`:199`) — `CANONICAL_SPECIALIZED_ROOT_FIELDS` (`:103-118`) מכיל את **כל** השדות ברמת-השורש שהטקסט הבסיסי משתמש בהם בפועל:

```
indices, indexPerformance, indexData,
marketNews, headlines, news, topStories,
macroFactors, macro, macroEvents, macroHighlights, economicEvents,
stocksMentioned, stocks, watchlist, tickers, mentionedStocks,
watchlistLevels, keyLevels, catalysts,
sectorRotation, sectors, sectorPerformance, sectorOverview,
tradingOpportunities, opportunities, trades, breakoutCandidates,
economicCalendar, calendar, events, upcomingEvents, schedule,
earnings, risks, warnings, riskFactors,
marketChanges, changes, tomorrowEvents, nextEvents,
weeklyHighlights, highlights, winners, topGainers,
losers, topLosers, weeklyOutlook, outlook, nextWeekOutlook,
guidance, earningsGuidance, managementCommentary, commentary,
financialMetrics, marketOverview, sentiment
```

`moveRootFieldsIntoSection` (`:152-177`) עבור כל שדה ברשימה: אם קיים ב-`root` (רמת-שורש) → ממזג ל-`universalTabs.specialized[field]` (או `universalTabs.specialized` עצמו אם מערך) **ומוחק** (`delete root[field]`, `:161`/`:173`) מרמת-השורש.

**קריטי לשדות החדשים כאן:** `stockFundamentals`, `stockTechnicals`, `methodologicalRules` **אינם** ברשימה למעלה. משמעות: `canonicalizeGemsPayloadForPersistence` **לא נוגעת בהם בכלל** — הם לא נמחקים מרמת-השורש, לא מועברים ל-`specialized`. הם פשוט נשארים כפי שנכתבו, על אובייקט ה-`canonicalParsed`, ומשם ישר ל-`marketBriefData` (§1 למעלה) — ללא עיבוד נוסף.

---

## 3. `resolveSpecialized` — למה שדות-שורש-לא-מוכרים עדיין נגישים

`videoTabsConfig.js:138-144`:
```js
function resolveSpecialized(mbd) {
  if (!mbd || typeof mbd !== 'object') return mbd;
  const spec = mbd.universalTabs?.specialized;
  const raw = (mbd.rawData && typeof mbd.rawData === 'object') ? mbd.rawData : null;
  if (!spec && !raw) return mbd;
  return { ...mbd, ...(raw || {}), ...(spec || {}) };
}
```

`{ ...mbd, ... }` — שכבת ה-spread הראשונה היא **כל** `marketBriefData` עצמו, כולל כל שדה-שורש שלא עבר canonicalization (§2 למעלה). לכן `stockFundamentals`/`stockTechnicals` ברמת-שורש **כן** מגיעים אל `src` בכל `case` שקורא `resolveSpecialized(marketBriefData)` — **בלי** צורך להוסיף אותם ל-`CANONICAL_SPECIALIZED_ROOT_FIELDS`. `methodologicalRules` ברמת-שורש **גם** יגיע ל-`src` באותו אופן — אך (ר' §5 למטה) שום `case` לא קורא אותו משם היום.

---

## 4. `stocksMentioned` הקיים — שונה מהותית מ-`stockFundamentals`/`stockTechnicals`, לא כפילות

הטקסט הבסיסי כבר מגדיר `stocksMentioned` ברמת-שורש, צורה: `{ticker, nameHebrew, exchange, sentiment, reason, priceLevel, change, action, catalyst, timeframe, priority, isNewToWatch, sector}` — עשיר יותר ממה שדוגמת-הקוד הישנה (`src/ai/gemini/schemas/morningBriefSchema.js:48-51`, `{symbol, reason, importance}`) מציגה; **דוגמת-הקוד הזו מיושנת/חלקית ביחס לטקסט-הבסיס האמיתי**, ממצא בפני עצמו (לא בהיקף התיקון כאן — הקובץ הזה `src/`, לא נגעתי בו).

בכל מקרה — `stocksMentioned` (כל צורתו) מתעד **דיון/סנטימנט/פעולה מוצעת** למניה; `stockFundamentals`/`stockTechnicals` מתעדים **ערך-מדד ספציפי מצוטט**. שני שדות-שורש נפרדים, מוצגים דרך `case` נפרדים (`'stock-fundamentals'`/`'stock-technicals'` מול הlogic הקיים ל-`stocksMentioned` ב-`extractVideoTabItems`), לא מתנגשים.

---

## 5. `methodologicalRules` — סטטוס-חיווט: אפס קוד, אפס נגישות, מסמכים בלבד

בניגוד ל-`stockFundamentals`/`stockTechnicals` (§6 למטה, שם *כן* קיימת שכבת-חילוץ כללית), עבור `methodologicalRules` **שום קוד לא קיים**: אין `case` ב-`extractVideoTabItems` (`videoTabsConfig.js`) שקורא `pickArray(src, 'methodologicalRules')`, ואין שום מיקום אחר ב-`src/` (מאומת בגריפ מחדש היום) שקורא את השם הזה מ-`marketBriefData`. הדבקת JSON עם השדה הזה למבזק **בטוחה** (לא נדחית — `validateGemsJsonValue` לא בודקת שדות לא-מוכרים ברמת-שורש) אך **התוכן לא יוצג בשום מקום**. זהה בדיוק לסטטוס שהיה ל-`methodologicalRules` הפונדמנטלי *לפני* WORK-ID `TRADINGBRAIN-RULES-DISPLAY-WIRING` (ר' §8 למטה להבדל).

### 5.1 `usefulKnowledge.rules` הקיים — קרוב-לחיווט אך **לא** מגיע ל"📏 כללי מסחר", משתי סיבות עצמאיות

הטקסט הבסיסי כבר מגדיר `universalTabs.usefulKnowledge.rules: []` (פריט שטוח `{text, startSeconds, endSeconds, timestampSource, timestampConfidence}`). נבדק במפורש היום אם זה כבר "עובד" עם אפס שינוי קוד — **לא**, משתי סיבות בלתי-תלויות:

**סיבה א' — הסעיף הקבוע "📏 כללי מסחר" לא קורא מ-`marketBriefData` בכלל.** `VideoDetailPanel.jsx:12399-12410`:
```js
const rawRules = [
  ...(Array.isArray(effectiveVideo?.rules)          ? effectiveVideo.rules          : []),
  ...(Array.isArray(effectiveVideo?.analysis?.rules) ? effectiveVideo.analysis.rules : []),
  ...(Array.isArray(effectiveVideo?.methodologicalRules)
    ? effectiveVideo.methodologicalRules.map(formatMethodologicalRuleAsLearningItem).filter(Boolean)
    : []),
].filter(Boolean);
```
קורא **רק** מ-`effectiveVideo` (האובייקט השטוח) — לעולם לא מ-`marketBriefData`. מכיוון שמסלול המבזק (§1 למעלה) לעולם לא כותב ל-`video.rules`/`video.methodologicalRules` השטוחים, הסעיף הקבוע יישאר ריק למבזקים **תמיד**, ללא קשר למה שה-GEM כותב. **בהשוואה:** שני הבלוקים השכנים ממש, 20 שורות מתחת (`:12427-12442`, `rawMentalModels`/`rawRiskMgmt`), **כן** כוללים נפילת-`marketBriefData?.universalTabs?.usefulKnowledge?.mentalModels`/`.riskManagement` — כלומר יש כאן א-סימטריה קיימת בקוד בין `rules` (בלי נפילת-מבזק) לבין `mentalModels`/`riskManagement` השכנים (עם נפילת-מבזק). לא ברור אם מכוונת — תועד כפריט-ledger נפרד (ר' דוח-הסיום).

**סיבה ב' — גם הטאב הכללי "ידע שימושי" עלול "להרעיב" את `rules` בשקט, בגלל pickArray מסוג first-wins.** `case 'useful-knowledge'` (`videoTabsConfig.js:502-514`):
```js
case 'useful-knowledge': {
  const utUseful = marketBriefData?.universalTabs?.usefulKnowledge;
  ...
  if (utUseful && typeof utUseful === 'object') {
    const items = [
      ...pickArray(utUseful, 'reusableKnowledge', 'actionChecklist', 'keyTakeaways', 'riskManagement', 'mistakesToAvoid', 'rules'),
    ];
    ...
  }
```
`pickArray` (`videoTabsConfig.js:403-409`, מתועד גם ב-`GEM-FUNDAMENTAL-SCHEMA.md` §6.1 כדפוס-הבאג הידוע) הוא **"ראשון-לא-ריק-מנצח"**, לא איחוד — מחזיר את **הראשון** מבין `reusableKnowledge`/`actionChecklist`/`keyTakeaways`/`riskManagement`/`mistakesToAvoid`/`rules` שיש בו תוכן. הטקסט הבסיסי (`GEM-BRIEF-INSTRUCTIONS.md`) מנחה את ה-GEM למלא `reusableKnowledge` באופן שוטף ("Extract reusable knowledge such as..."). כלומר: **כל עוד `reusableKnowledge` מלא (המצב הצפוי והרגיל)**, `rules` **לעולם לא ייבדק בכלל** ע"י ה-`case` הזה — מוזנח בשקט, אותו באג-מיזוג מדויק שכבר תוקן במקומות אחרים בקוד (`GEM-FUNDAMENTAL-SCHEMA.md` §6.1, "pickArray/pickStringAsArray first-non-empty-wins merge bug") אך **לא** כאן.

**מסקנה:** `usefulKnowledge.rules` הוא שדה-אמת בטקסט הבסיסי, אך כיום **אינו נגיש בפועל** בשום תצוגה ייעודית של מבזק — לא בסעיף הקבוע, וכמעט-תמיד גם לא בטאב הכללי. זה **לא** תוקן בסבב הזה (מחוץ להיקף, `src/` אסור לגעת).

---

## 6. `stockFundamentals`/`stockTechnicals` — סטטוס-חיווט: חילוץ עובד, תצוגה חסומה-במכוון

### 6.1 שכבת-החילוץ (Extract)

`videoTabsConfig.js:749-761`:
```js
case 'stock-fundamentals': {
  const src = resolveSpecialized(marketBriefData);
  return src
    ? pickArray(src, 'stockFundamentals')
    : [...pickArray(video, 'stockFundamentals'), ...pickArray(a, 'stockFundamentals')];
}

case 'stock-technicals': {
  const src = resolveSpecialized(marketBriefData);
  return src
    ? pickArray(src, 'stockTechnicals')
    : [...pickArray(video, 'stockTechnicals'), ...pickArray(a, 'stockTechnicals')];
}
```
עבור מבזק, `marketBriefData` תמיד truthy → `src = resolveSpecialized(marketBriefData)` → `pickArray(src, 'stockFundamentals')` **ימצא** שדה-שורש `stockFundamentals` (§3 למעלה מסביר למה) **ללא שום שינוי-קוד נוסף**. מאומת מחדש היום (לא רק מצוטט מהביקורת הקודמת) — שורות-קוד זהות, קובץ לא נערך.

### 6.2 שכבת-התצוגה (Render) — חסומה במכוון ולצמיתות

`MorningBriefDashboard.jsx:65` — `showStockDataSections = false` (ברירת-מחדל). `:124` — `{showStockDataSections ? (<>...<StockFundamentalsSection/>...<StockTechnicalsSection/>...</>) : null}`.

`SpecializedContentRenderer.jsx:141-160` — ה-branch `fundamental-analysis`/`technical-analysis` (`slug==='fundamental-analysis' || slug==='technical-analysis' || looksLikeFundamentalOrTechnical(...)`) מעביר `showStockDataSections` (`:156`, בוליאני `true` ללא ערך = JSX shorthand ל-`true`).

`SpecializedContentRenderer.jsx:163-177` — ה-branch `morning-brief`/`evening-brief` **לא** מעביר את ה-prop כלל — ברירת-המחדל `false` חלה.

`MorningBriefPanels.jsx:3216-3221`, תגובת-הקוד, ציטוט מדויק:
```js
// ── Stock fundamentals / technicals (WORK-ID TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY) ──
// Structured per-ticker data points extracted by the fundamental/technical GEM
// (video.stockFundamentals / video.stockTechnicals, see videoAnalytics.js).
// Rendered ONLY when the caller explicitly opts in (MorningBriefDashboard's
// showStockDataSections prop) — never on a real morning/evening brief, since
// these two share the exact same dashboard component. See SpecializedContentRenderer.jsx.
```

**זו החלטת-ארכיטקטורה מתועדת בקוד עצמו, לא "טרם נבנה".** גם אם `marketBriefData.stockFundamentals` יאוכלס במלואו — `<StockFundamentalsSection>`/`<StockTechnicalsSection>` לעולם לא יירונדרו במבזק אמיתי, כי ה-JSX עצמו (`{false ? <>...</> : null}`) לא מכניס אף DOM node.

### 6.3 מה נדרש כדי לפתוח את התצוגה (מחוץ להיקף המסמך הזה)

שינוי-קוד קטן ויחיד: העברת `showStockDataSections` (או prop דומה) גם מ-branch `morning-brief`/`evening-brief` ב-`SpecializedContentRenderer.jsx:163-177`. דורש החלטת-משתמש מפורשת (שינוי-קוד, לא מסמכים) ו-`frontend-rtl-developer` לביצוע + `qa-release-reviewer` לשער.

---

## 7. טבלת-השוואה מול הג'ם הפונדמנטלי

| היבט | פונדמנטלי (`GEM-FUNDAMENTAL-*`) | מבזק (`GEM-BRIEF-*`, כאן) |
|---|---|---|
| מיקום שדות-תוכן | JSON שטוח לגמרי, `universalTabs` **אסור** | `universalTabs` תמיד נוכח (שלד קבוע), אך רוב-התוכן ברמת-שורש, מועבר ל-`universalTabs.specialized` ע"י `canonicalizeGemsPayloadForPersistence` |
| `stockFundamentals`/`stockTechnicals` מיקום | שורש שטוח | שורש (לא `specialized` — לא ברשימת ה-whitelist, אך עדיין נגיש דרך `resolveSpecialized`'s root-spread, §3) |
| `stockFundamentals` extract | `case 'stock-fundamentals'` קורא ישירות מ-`video`/`video.analysis` (JSON שטוח נכתב ישר על video) | אותו `case` בדיוק, אך דרך ה-branch `resolveSpecialized(marketBriefData)` |
| `stockFundamentals` render gate | ✅ פתוח (`showStockDataSections` מועבר `true`) | ❌ חסום במכוון, לצמיתות (§6.2) |
| `methodologicalRules` extract/render | ✅ חובר (WORK-ID `TRADINGBRAIN-RULES-DISPLAY-WIRING`, §8) — **אך עדיין uncommitted, ר' פריט-ledger נפרד** | ❌ אפס קוד — לא extract, לא render |
| שדה-כלל פשוט מתחרה | אין (רק `methodologicalRules`) | `usefulKnowledge.rules` כבר קיים בטקסט-הבסיס — אך לא נגיש בפועל (§5.1) |

---

## 8. הערה חוצת-מסמכים: מצב `methodologicalRules` הפונדמנטלי כרגע (לא נבדק כאן לראשונה, מאומת מחדש)

`GEM-FUNDAMENTAL-SCHEMA.md` §12.5 מתעד ש-`methodologicalRules` "חובר לתצוגה" (WORK-ID `TRADINGBRAIN-RULES-DISPLAY-WIRING`) — **אך `git diff --stat` מאשר שהקוד הזה (normalizer + `rawRules`-merge ב-`VideoDetailPanel.jsx`) עדיין `uncommitted`**, חי רק ב-working-tree הנוכחי (`M src/components/dashboard/VideoDetailPanel.jsx`, `M src/services/videoAnalytics.js`), לא ב-`HEAD` (`46fe894`). ל-WORK-ID הזה גם אין שורת-ledger משלו — נוספה שורה חדשה (`needs-user-decision`) ב-`docs/open-items-ledger.md` בסבב הראשון של אותו WORK-ID (`TRADINGBRAIN-BRIEF-RULES-STOCKDATA`). לא נערך שום קוד על ידי המסמך הזה.
