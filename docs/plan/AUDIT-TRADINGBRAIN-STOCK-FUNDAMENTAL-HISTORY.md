# AUDIT-TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY

**WORK-ID:** TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY
**סוג מסמך:** READ-ONLY AUDIT. לא בוצע שום שינוי קוד תחת `src/`. הקובץ הזה untracked, לא בוצע לו `git add`, אין commit, אין push.
**מטרה:** לקבוע איך האפליקציה יכולה לאחסן נתוני-מניה פונדמנטליים כנקודות-נתון (data points) היסטוריות, ניתנות ל-query לפי טיקר ולאורך זמן — וגם איך להציג נתונים כאלה ברמת-הווידאו הבודד בטאב 7 ("תוכן ייעודי"), בפורמט הטבלה שהמבזק כבר משתמש בו.

---

## Step 0 — זהות המאגר, worktree, ענף, HEAD, ואימות שרת הפיתוח

- **נתיב:** `C:\Users\11\Desktop\Workspace\new-project\projects\youtube-mentor-dashboard`
- **ענף:** `feat/saved-market-rows-table`
- **HEAD:** `8917078131895e04e95cd457d8c035d721d05404` — `fix(fundamental-gem): restore tab-4 renderers for 10 fields commit 8801b5c removed from tab 7`
- **Worktrees:** 19 סה"כ (`git worktree list`), רק ה-worktree הראשי (הנתיב לעיל) נבדק — שאר ה-18 לא רלוונטיים-בשם למשימה הזו ולא נבדקו (scope decision, לא ניחוש).
- **אימות שרת הפיתוח על 5184:** `netstat -ano` מצא תהליך יחיד שמאזין על `[::1]:5184` (PID 30652). `Get-CimInstance Win32_Process` על ה-PID הזה מחזיר command line `node ...\youtube-mentor-dashboard\node_modules\.bin\..\vite\bin\vite.js` — הנתיב המלא לבינארי ה-vite הוא בתוך `node_modules` **של ה-worktree הזה עצמו**. אומת ש-`node_modules` הוא תיקייה אמיתית (לא symlink/junction — `(Get-Item ...).LinkType` החזיר ריק) ולא משותפת בין worktrees. **אין מזמש/mismatch** — פורט 5184 משרת בדיוק את ה-worktree והענף הנבדקים כאן.

**מסקנה: אין צורך לעצור. ממשיך בביקורת.**

---

## Step 1 — מה קיים כבר בקוד: נתוני-מניה פר-ticker, מפת aliases, `appBuilding.dataFields`, וחילוץ טיקר מטקסט

### 1.1 שתי משפחות-נתונים נפרדות לגמרי בקוד היום — ההבחנה הזו קריטית לכל שאר המסמך

**(A) `stocksMentioned`/`extractUnifiedStocks` — נתוני-אזכור-מניה, לא נתונים פונדמנטליים מספריים.**
`stockRecordFromObject()` (`src/lib/morningBriefDisplay.js:1345-1410`) הוא ה-normalizer בפועל שממיר item גולמי (string או object) לרשומת-מניה מובנית:
```js
{
  ticker, company, context, sentiment, sector, category, actionability,
  notes, changePercent, timeframe, priority, isNewToWatch, source,
  sourceVideoId, videoId, rowTimestampSourceItems,
}
```
**אין כאן שום שדה למדד פונדמנטלי (P/E, EPS וכו') ואין שדה תאריך-תצפית.** `extractUnifiedStocks()` (`:1452+`) קורא ל-`getSpecializedSrc(marketBriefData)` — כלומר **תלוי ב-`marketBriefData`**, שכפי שיוסבר ב-Step 5, לעולם `null` בנתיב ה-GEM הפונדמנטלי הקיים.

**(B) `financialMetrics`/`valuation` (הג'ם הפונדמנטלי הקיים) — חומר לימודי/הגדרתי, לא תצפית-מספר-בפועל.**
נבדק ישירות ב-`docs/gems/GEM-FUNDAMENTAL-EXAMPLE.json:38-60` — כל item בשדות `financialMetrics`/`valuation` הוא בתבנית קבועה "מושג: X · הגדרה קצרה: Y · מתי זה תקף: Z · איך מודדים: W · מקור: HH:MM" — כלומר **מסביר מהו P/E ואיך מחשבים אותו**, לא **"ה-P/E של AAPL הוא 34.3 היום"**. `parseTemplateItem`/`parseLearningTemplateItem` (`src/components/dashboard/LearningTabContent.jsx:78-91, 130`) מפרקים את התבנית הזו לעמודות ("מושג"/"הגדרה קצרה"/"איך מודדים") — שוב, מבנה לימודי, לא ticker+date+value. **זו בדיוק ההבחנה שהמשימה הנוכחית דורשת: "AAPL, 2026-09-09, forward P/E 34.3" הוא type חדש לגמרי — לא קיים שום נתיב שממלא אותו היום.**

### 1.2 מפת aliases לחילוץ/קישור טיקר מטקסט — קיימת, עשירה

`src/utils/finvizLinks.js`:
- `_EN_COMPANY_TICKER_MAP` (שורה 715) — Map שם-חברה-אנגלי → טיקר.
- `HE_CARD_COMPANY_ALIASES` (שורה 799) + `resolveHebrewStockTicker()` (שורה 793) — aliases עברית → טיקר.
- `_TV_ALIAS_MAP` (שורה 380) — aliases ל-TradingView symbol (נפרד, לא תמיד זהה ל-Finviz).
- `resolveFinvizTicker()` (שורה 204), `isFinvizLinkable()` (שורה 309) — resolve + validation.

`src/lib/morningBriefDisplay.js`:
- `normalizeTicker()` (שורה 1300) — regex `^[A-Z][A-Z0-9.]{0,5}$` + בלאק-ליסט `NON_TICKER_TOKENS`.
- `tickersInText()` (שורה 1307) — סורק טקסט חופשי ומוציא כל טיקר תקין (רגקס `TICKER_RE` גלובלי, מסנן `S&P 500`).

**מסקנה:** יש כבר תשתית מוצקה לזיהוי/נרמול/קישור טיקר מטקסט חופשי — לשימוש חוזר, לא צריך לבנות מחדש.

### 1.3 `video.appBuilding.dataFields` — שדה-passthrough קיים, לא מנוצל היום

`normalizeAiAnalysisResult()` (`src/services/videoAnalytics.js:1276-1307`) כותבת `video.appBuilding` כשה-GEM מחזיר שדה `appBuilding` ברמת-שורש. בתוכו:
```js
const dataFields = safeArr(ab.dataFields);   // videoAnalytics.js:1284
```
זהו **array גולמי, ללא normalizer** (בניגוד ל-`suggestedFeatures` שכן עובר מיפוי-שדות מלא, שורות 1285-1302) — `dataFields` מועבר as-is. מקור השם: `src/lib/extractAppIdeas.js:185` (`{ key: 'dataFields', categories: ['dataModels'], path: 'universalTabs.app.dataFields' }`) — שדה שנועד לתאר **מודל-נתונים מוצע לאפליקציה** (App Builder, טאב 5), **לא** תצפיות פונדמנטליות בפועל. אין שום consumer שממפה item מתוכו ל-ticker/date/value — זה "idea about a data model", לא "a data point".

**מסקנה ל-Step 1:** אין היום שום מבנה-נתונים קיים שמייצג "טיקר + תאריך + מדד + ערך + מקור". שלוש התשתיות שכן קיימות (alias map, ticker regex, `dataFields` passthrough) הן חלקי-בנייה שימושיים, לא פתרון קיים.

---

## Step 2 — שכבת ה-persistence: localStorage, IndexedDB, schema/versioning

### 2.1 אחסון-האמת בפועל של רשומת-וידאו: localStorage, לא IndexedDB

`src/services/videoStorage.js` — `STORAGE_KEY = "yt_mentor_videos_v2"` (שורה 17). `loadVideosRaw()`/`saveVideos()` (שורה 161) קוראים/כותבים **מערך JSON יחיד שלם** תחת המפתח הזה — כל השדות שה-GEM מוסיף (`financialMetrics`, `valuation`, `appBuilding` וכו') יושבים כשדות על אובייקט ה-video בתוך המערך הזה. **אין schema version על רשומת-video בודדת** — שדות חדשים נוספים additive, בלי migration פורמלי (כך בדיוק נוספו `financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates` ב-commit 8801b5c, ללא כל migration).

### 2.2 שכבת IndexedDB — קיימת, נפרדת, מיועדת ל-Workspace, לא ל-video הרגיל

`src/lib/persistence/storageManifest.js`:
```js
export const APP_DATA_DB_NAME = 'yt_mentor_app_data_v1';
export const APP_DATA_DB_VERSION = 2;
export const APP_DATA_STORES = {
  META, SOURCE_ENTRIES, VIDEOS, ANALYSES, TRANSCRIPTS,
  WORKSPACE_ITEMS, SNAPSHOTS, MEDIA_BLOBS,
  MIGRATION_JOURNAL, WORKSPACE_CHANGE_JOURNAL,
};
```
`src/lib/persistence/appDataDb.js`'s `createSchema()` (שורות 31-91) יוצר את ה-object stores **רק אם עוד לא קיימים** (`if (!database.objectStoreNames.contains(...))`) — הוספת store חדש היא **תוספת additive טהורה**: להוסיף שם-store ל-manifest, לרשום אותו ב-`createSchema()`, ולהעלות את `APP_DATA_DB_VERSION` (2→3), מה שמפעיל `onupgradeneeded` (`openAppDataDb`, שורה 102) בלי לגעת ב-stores הקיימים או ברשומות שבהם.

**אזהרה חשובה:** ה-store `WORKSPACE_ITEMS`/`WORKSPACE_CHANGE_JOURNAL` מלווה בטקס "generation" מורכב — `commitWorkspaceMutation()` (שורה 239-295) בודק concurrency מול `activeWorkspaceGeneration`/`workspaceRecoveryAnchor`, ו-`activateGeneration()` (שורה 308-403) דורש עדות-אימות מלאה (`activationEvidence.verified`, hash equality וכו') לפני שמאפשר activation. **זו תשתית-מיגרציה ייעודית ל-workspace items, לא API כללי-לשימוש-מיידי** — store חדש (כמו תצפיות-מניה) לא צריך ולא אמור לעבור דרך הטקס הזה; הוא יכול להשתמש ב-helpers הגנריים היחסית (`writeBatch`, `readRecords`, `listByGeneration`) בלי המנגנון של activation/recovery-anchor.

### 2.3 מפתחות localStorage — רשימה סגורה, נאכפת ב-runtime

`storageManifest.js:194-196`:
```js
if (LOCAL_STORAGE_FIXED_KEYS.length !== 67) {
  throw new Error('Expected exactly 67 verified fixed localStorage keys');
}
```
כלומר: **מפתח localStorage קבוע חדש חייב תוספת מפורשת ל-`LOCAL_STORAGE_FIXED_KEYS` וגם עדכון המספר `67`** — אחרת ה-import של הקובץ עצמו זורק. לחלופין, מפתח דינמי (למשל `stock-observations:{ticker}`) יכול להשתמש באחד ה-prefixes הקיימים ב-`LOCAL_STORAGE_DYNAMIC_PREFIXES` (שורה 87) או שיהיה צריך prefix חדש שם.

**מסקנה ל-Step 2:** אפשר להוסיף store חדש בצורה additive לגמרי בכל אחת מ-3 השכבות (video record field, IndexedDB store חדש, או localStorage key חדש) — בלי לגעת ברשומות קיימות. הסיכון היחיד הוא לא-טכני: לא לבלבל בין תשתית ה-IndexedDB ה"כבדה" (generation/activation, מיועדת ל-workspace) לבין הוספה פשוטה.

---

## Step 3 — מנגנון שמירת "המוח" (checkbox + toolbar) — טקסט-בלבד, לא host מתאים לתצפיות מספריות מובנות

מקור-אמת: `docs/governance/SAVE_SYSTEM_ARCHITECTURE.md` (Source-of-truth doc מוצהר בקובץ עצמו) + קריאת `localKnowledgeItemStore.js`.

- **חתימת הפונקציה בפועל:** `saveSingleItemToBrain(text, tabKey, label)` — `text` הוא **מחרוזת שטוחה**, לא object. הפורמט-שטוח קורה **לפני** ההגעה לפונקציית השמירה (`formatBulkItemText(item)`, מזוהה בביקורת הקודמת ב-`src/lib/universalTabBulkItems.js:11-35`).
- **מפתח ה-dedupe:** `brain-item:{videoId}:{tab}:{textKey}`, כש-`textKey` הוא 60 התווים הראשונים של הטקסט המנורמל (`SAVE_SYSTEM_ARCHITECTURE.md` §1.1) — מפתח מבוסס-תוכן-טקסטואלי, **לא** מפתח מבוסס `ticker+date`.
- **שכבת האחסון עצמה (`localKnowledgeItemStore.js`) כן גמישה טכנית:** `normalizeKnowledgeItem()` עושה `{ ...item, metadata: {...} }` — כלומר שדות נוספים על ה-item עצמו **היו שורדים** אם מישהו היה מעביר אותם. אבל **אף אחד מנקודות-הכניסה הקיימות (`saveSingleItemToBrain`, בונה ה-bulk items) לא בונה item עם שדות ticker/metric/value נפרדים** — כולם עוברים דרך flatten-ל-טקסט קודם.
- **אין query-by-field:** `readAll()` (`localKnowledgeItemStore.js:36-45`) קורא את **כל** המערך מ-`localStorage` בכל פעם — אין אינדקס, אין query API. "להשוות AAPL על פני עשרות סרטונים" דרך המנגנון הזה ידרוש סריקת-כל-הפריטים + regex/string-match על הטקסט החופשי בכל קריאה — לא סקיילבילי ולא אמין (מדד שנכתב מעט אחרת בטקסט לא יימצא).

**מסקנה ל-Step 3:** מנגנון ה"מוח" הוא **host לא-מתאים** לתצפיות-מניה מספריות היסטוריות — לא בגלל מגבלה טכנית קשיחה של שכבת האחסון (שהיא גמישה), אלא כי **כל שרשרת-הקריאה מעליה בנויה text-first, ללא concept של שדה מובנה הניתן ל-query**. שימוש בו ידרוש שכבת-אינדוקס נפרדת ממילא — ואם כבר בונים כזו, עדיף store ייעודי (Step 4).

---

## Step 4 — 2-3 אפשרויות אחסון, מדורגות

### אפשרות 1 (מומלצת) — store ייעודי `stockObservations`, keyed by ticker+date

**צורת הנתונים:**
```js
{
  generationId, id,              // keyPath ['generationId','id'] — עקבי עם שאר ה-generation stores
  ticker: 'AAPL',
  company: 'Apple Inc.',
  metricName: 'forwardPE',
  metricLabel: 'מכפיל רווח עתידי',
  value: 34.3,
  unit: 'x',
  dateObserved: '2026-09-09',
  sourceVideoId: 'video-123',
  sourceTimestampSeconds: 470,
  sourceQuote: '...',
  createdAt: ISOString,
}
```
**היכן נכתב:** `src/lib/persistence/appDataDb.js` — store חדש `STOCK_OBSERVATIONS` נוסף ל-`APP_DATA_STORES` (`storageManifest.js`), עם `keyPath: ['generationId','id']` ו-`index('ticker','ticker')` + `index('videoId','videoId')` (אותו pattern כמו `WORKSPACE_ITEMS`, `appDataDb.js:58-63`). **בלי** לעבור דרך `commitWorkspaceMutation`/activation ceremony — שימוש ישיר ב-`writeBatch`/`readRecords`/`listByGeneration` הגנריים שכבר קיימים (שורות 145-193).
**איך ההיסטוריה מצטברת:** כל paste-JSON חדש עם שדה חדש (למשל `stockDataPoints`, ר' Step 5) מייצר N רשומות, אחת לכל item, id דטרמיניסטי (hash של `ticker+dateObserved+metricName+sourceVideoId`) כדי ש-paste חוזר על אותו JSON לא ייצור כפילויות.
**איך זה נשלף:** helper חדש `getObservationsByTicker(ticker)` שמבצע `index('ticker').getAll(ticker)` — query אמיתי, לא סריקת-כל-הרשומות.
**סיכון מיגרציה:** נמוך — additive טהור, לא נוגע ב-stores קיימים. הסיכון היחיד: לוודא ש-`APP_DATA_DB_VERSION` bump לא מתנגש עם bump מקביל מ-session אחר על אותו worktree (ר' `[[project_shared_worktree_coordination]]` בזיכרון — כמה sessions כבר עבדו על אותו worktree בו-זמנית).
**היקף מימוש:** בינוני — store חדש + index, מיפוי-שדה חדש ב-`normalizeAiAnalysisResult`, hook-כתיבה (למשל ב-`handleApplyGemsJson`/`completeGemsImport`, `VideoDetailPanel.jsx:6700` איזור), helper-query, ורכיב-UI לטבלה (Step 8-9).

### אפשרות 2 (קלה) — רק העשרת רשומת ה-video הקיימת, בלי store נפרד

**צורת הנתונים:** שדה שטוח חדש על ה-video עצמו, בדיוק כמו `financialMetrics`:
```js
video.stockObservations = [
  { ticker: 'AAPL', company: 'Apple Inc.', metricName: 'forwardPE', metricLabel: 'מכפיל רווח עתידי', value: 34.3, dateObserved: '2026-09-09', sourceQuote: '...', estimatedStartSeconds: 470 },
  ...
]
```
**היכן נכתב:** שורת-מיפוי אחת נוספת ב-`normalizeAiAnalysisResult` (`videoAnalytics.js`, ליד שורה 1207-1210, אותו pattern בדיוק כמו `financialMetrics`/`valuation`) → נשמר על ה-video ב-`yt_mentor_videos_v2` (localStorage) דרך `saveVideos()` הקיים — **אפס שינוי לשכבת האחסון עצמה**.
**איך ההיסטוריה מצטברת:** אין אגירה ייעודית — "היסטוריה" = כל ה-videos שיש להם `stockObservations` לא-ריק. להשוות AAPL על פני זמן דורש `loadVideos()` (טוען הכל) + `.filter/.flatMap` על השדה הזה בזמן-קריאה.
**איך זה נשלף:** פונקציית עזר חדשה `getAllStockObservations()` שסורקת `loadVideos()` — **O(n) videos** בכל קריאה, לא query מאונדקס. סביר לחלוטין בהיקף-נתונים נוכחי (מאות וידאו, לא מיליונים) אך לא סקיילבילי לטווח ארוך.
**סיכון מיגרציה:** אפס — בדיוק אותו pattern שכבר בוצע 4 פעמים (financialMetrics/valuation/investmentChecklist/promptTemplates ב-2026-09-10) בלי שום migration.
**היקף מימוש:** קטן — שורת מיפוי אחת + פונקציית-סריקה + UI.

### אפשרות 3 (ביניים, ראו גם Step 11) — video field כ-source-of-truth יחיד, ללא store שני בכלל

זהה לאפשרות 2 לכתיבה, אך עם החלטה מפורשת לא לבנות אף פעם store-2 נפרד — "טבלת-היסטוריה לפי טיקר" היא **view נגזר** בזמן-ריצה מעל `loadVideos()`, לא persistence נפרד. חוסך את כל הסיכון/מורכבות של Step 2.2 (IndexedDB generation ceremony) לגמרי, במחיר ביצועים (סריקה מלאה בכל query) שברוב הסבירות לא ירגיש בהיקף-הנתונים הנוכחי.

**דירוג:** אפשרות 3 מומלצת ל-v1 (המשכיות ישירה למה שכבר קיים, אפס סיכון, אפס תשתית חדשה) → אפשרות 1 כ-upgrade עתידי כשנפח-הנתונים/הצורך ב-query מהיר יצדיק אותו → אפשרות 2 היא בעצם תת-מקרה של 3 (זהה בכתיבה, נבדלת רק בכוונה-להמשך).

---

## Step 5 — מה הוראות ה-GEM צריכות לפלוט; דוגמה מלאה; carry-through דרך gemsJsonRepair.js / normalizeAiAnalysisResult

### 5.1 שם-שדה מוצע: `stockDataPoints` (שטוח, ברמת-שורש, כמו `financialMetrics`)

```json
{
  "contentType": "market",
  "shortSummary": "...",
  "stockDataPoints": [
    {
      "ticker": "AAPL",
      "company": "Apple Inc.",
      "metricName": "forwardPE",
      "metricLabel": "מכפיל רווח עתידי",
      "value": 34.3,
      "unit": "x",
      "dateObserved": "2026-09-09",
      "context": "נחשב כהתנגדות היסטורית לפי הדובר",
      "estimatedStartSeconds": 470,
      "sourceQuote": "מכפיל הרווח העתידי של אפל עומד היום על 34.3"
    },
    {
      "ticker": "NVDA",
      "company": "NVIDIA Corporation",
      "metricName": "forwardPE",
      "metricLabel": "מכפיל רווח עתידי",
      "value": 18.7,
      "unit": "x",
      "dateObserved": "2026-09-09",
      "context": "מתומחר בזול יחסית לצמיחה הצפויה",
      "estimatedStartSeconds": 512,
      "sourceQuote": "אנבידיה נסחרת במכפיל של 18.7 בלבד"
    },
    {
      "ticker": "GOOGL",
      "company": "Alphabet Inc.",
      "metricName": "forwardPE",
      "metricLabel": "מכפיל רווח עתידי",
      "value": 25.3,
      "unit": "x",
      "dateObserved": "2026-09-09",
      "context": "בטווח ההיסטורי הרגיל של החברה",
      "estimatedStartSeconds": 545,
      "sourceQuote": "גוגל נסחרת במכפיל 25.3, קרוב לממוצע ההיסטורי שלה"
    }
  ]
}
```

### 5.2 האם `validateGemsJsonValue` (שער-הקבלה) מקבל את זה בלי שינוי קוד — כן

`src/lib/gemsJsonRepair.js:248-301` (מתועד גם ב-`GEM-FUNDAMENTAL-SCHEMA.md` §2): שדה לא-מוכר ברמת-השורש **לא נדחה** — הבדיקה היחידה היא שלפחות שדה אחד מ-`GENERIC_ANALYSIS_FIELDS` (10 שדות, `gemsJsonRepair.js:59-70`) קיים. `shortSummary` (שכבר מומלץ תמיד ב-instructions) מספיק. **`stockDataPoints` עצמו עובר דרך ללא כל בדיקה ספציפית** — לא נבדק מבנית, לא נבדק תוכן.

### 5.3 האם `normalizeAiAnalysisResult` מעביר אותו הלאה — **לא, בלי תוספת קוד**

זו הנקודה הקריטית: `normalizeAiAnalysisResult()` (`videoAnalytics.js:1080-1317`) בונה **אובייקט חדש עם רשימת-שדות קבועה-מראש** (whitelist) — היא **לא** עושה pass-through של שדות לא-מוכרים. בדיוק כמו ש-`financialMetrics`/`valuation` היו "כתובים אך לא נגישים" עד commit 8801b5c (ר' `GEM-FUNDAMENTAL-SCHEMA.md` §8), כל שדה `stockDataPoints` שה-GEM יחזיר **יושמט בשקט** אם לא תתווסף שורת-מיפוי מפורשת (בדיוק כמו `videoAnalytics.js:1207`):
```js
stockDataPoints: normalizeLearningArray(merged.stockDataPoints || nested.stockDataPoints),
```
**זו לא ניתנת-לפתרון בניסוח-פרומפט בלבד — נדרשת שורת קוד אחת.** (יש לשקול אם `normalizeLearningArray` — שנועדה לפריטי-טקסט עם timing אופציונלי — מתאימה ל-object מובנה עם `value`/`unit` מספריים, או שנדרש normalizer ייעודי-חדש שלא קורס שדות מספריים למחרוזת; לא נבדק בעומק, מפורש כ-open item.)

### 5.4 מסלול ה-paste הידני (`gemsJsonRepair.js`) — כן יעביר את זה בלי שינוי, בכפוף ל-5.3

`canonicalizeGemsPayloadForPersistence()` (`gemsJsonRepair.js:152-177`) מדלג מוחלט כש-`universalTabs` נעדר (`:153`) — כלומר JSON שטוח עם `stockDataPoints` ינותב תמיד ל-`_applyParsedGems`'s branch 4 (`VideoDetailPanel.jsx:6666`, `normalizeAiAnalysisResult`), **בדיוק כמו `financialMetrics`/`valuation`**. **המסקנה: מסלול ה-paste "יעביר" את השדה מבחינת parsing/validation — אבל רק `normalizeAiAnalysisResult` יכול לגרום לו להיכתב בפועל על ה-video, וזה דורש שינוי-קוד (5.3).**

---

## Step 6 — מה עלול להישבר/להיכפל

1. **בלבול מושגי בין `financialMetrics`/`valuation` (לימודי) לבין `stockDataPoints` (תצפית-בפועל)** — הסיכון הגדול ביותר. אם ה-GEM יתבקש לפעמים לכתוב את אותו מספר גם ב-`financialMetrics` (בפורמט "מושג: P/E · הגדרה...") וגם ב-`stockDataPoints` (`{ticker:'AAPL', value:34.3}`), התוכן ייכתב פעמיים בשני מקומות שונים באפליקציה (טאב 4 + הסעיף החדש בטאב 7) — לא bug טכני, אלא כפילות-תוכן שדורשת ניסוח-הוראות ברור ל-GEM: "מספר בפועל לטיקר → `stockDataPoints` בלבד; הסבר-מושג כללי → `financialMetrics`/`valuation` בלבד".
2. **`densityWarnings`** (`gemsJsonRepair.js:16-40`) לא מכיר את `stockDataPoints` — `computeDensityWarnings()` בודק רק `financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates` (`DENSITY_CHECK_FIELDS`, שורה 16-21), מותנה ב-`hasFundamentalShape` (שורה 28-30, דורש frameworks+checklists+mistakesToAvoid). GEM שיחזיר רק שדה `stockDataPoints` בודד (item אחד בלבד) **לא יקבל שום אזהרת-דלילות** — לא באג חוסם, אבל UX-gap אם רוצים אכיפת-איכות דומה.
3. **`"בחר הכל"` דה-דופליקציה** — תועד ב-`docs/SPECIALIZED_SELECT_ALL_DEDUP_RULE.md`/`docs/UNIVERSAL_SECTION_SELECT_ALL_AND_EXPORT_RULE.md`: רק leaf row items נרשמים ל-Select All, לא card-level (`SpecializedContentRenderer.jsx:108-110`, ההערה בקוד עצמה). סעיף חדש **חייב** לעקוב אחרי אותו pattern (`buildMorningBriefBulkSections` + registration ברמת-שורה, לא ברמת-card) אחרת "בחר הכל" בטאב specialized ייצור כפילויות ב-export — בדיוק הבאג שכבר תועד ותוקן פעם אחת עבור סעיפים אחרים.
4. **`AppBuilderTab` (טאב 5) לא רואה `stockDataPoints`** — אותו gap כמו `dataFields`/`financialMetrics` (`GEM-FUNDAMENTAL-SCHEMA.md` §6): `AppBuilderTab.jsx` תלוי אך ורק ב-`marketBriefData`, שנשאר `null` בנתיב הזה. לא רלוונטי לטאב 7, מצוין להשלמה.
5. **אין breakage לתאב-4 העשרה הקיימת** (10 השדות מ-8801b5c/8917078) — `stockDataPoints` הוא שדה נפרד לגמרי, לא נוגע ב-`financialMetrics`/`valuation`/וכו'.
6. **ראו Step 12 להרחבה על סיכון-דליפה לטאב 7 של מבזק בוקר/ערב** — זה הסיכון המשמעותי ביותר בכל המשימה, לא "עוד סיכון ברשימה".

---

## Step 7 — שייך לאפליקציה הזו, לא להחלטת-הידע-הנפרדת

**קביעה:** נתוני-פונדמנטלי-לפי-טיקר-ותאריך **שייכים לאפליקציה הזו**, לא ל"מערכת ידע אישי" נפרדת (ה-decision הפתוחה שהמשתמש טרם קיבל, מוזכרת גם בזיכרון `project_brain_evolution.md` — עדכון: זיכרון בן 123 יום, לא אומת כרלוונטי-במפורש לדיוק ההחלטה שהמשתמש מתכוון אליה כאן; מוזכר כאן רק כדי לא להתעלם ממנו, לא כמקור-קביעה).

**נימוק, מבוסס-קוד:**
1. **מקור הנתונים הוא הפייפליין הקיים של הוידאו** — GEM paste-back דרך `VideoDetailPanel.jsx`, אותו `parseAndValidateGemsJson`/`normalizeAiAnalysisResult` ששאר כל שדות ה-GEM כבר עוברים דרכו. מערכת-ידע כללית-נפרדת תצטרך לבנות מחדש: ingestion מ-JSON, זיהוי-טיקר, קישור-לוידאו-ולזמן — כל אלה **כבר קיימים כאן** (Step 1.2, Step 5).
2. **הצריכה הטבעית היא לצד שאר תוכן-הוידאו** — המשתמש רוצה לראות "מה אמר הסרטון על AAPL ב-07:50" לצד שאר הניתוח של אותו סרטון (טאב 7), לא במסך נפרד מנותק-הקשר.
3. **מבנה-הנתונים (ticker+date+numeric value, לא markdown/notes חופשי) שונה מהותית מכל מה ש"מוח"/Obsidian/Workspace תומכים בהם היום** (Step 3) — גם "המערכת הנפרדת", אם וכשתיבנה, תצטרך אינדוקס-לפי-שדה דומה; זה לא ייחודי ל-app הזה, אבל **קשירה למקור (הוידאו, הזמן, הציטוט)** היא כן ייחודית ל-app הזה.
4. **אין עדיין שום מפרט למערכת-הידע-הנפרדת** בקוד/במסמכים — קישור נתונים-חיים למשהו שלא קיים הוא סיכון תכנוני, לא רק טכני.

**מה שכן שייך להחלטה-הנפרדת, אם/כשתתקבל:** אם המשתמש בעתיד יחליט לבנות knowledge-base גנרי (multi-project, לא רק YouTube), אפשר יהיה **לייצא** מה-store הזה (Step 4, אפשרות 1/3) אליו — אבל זה קונסומר עתידי, לא סיבה לדחות את הבנייה כאן עכשיו.

---

## Step 8 — הוספת סעיף חדש לטאב 7: בעלים, מבנה section, empty-state, נקודת-הכנסה מדויקת

### 8.1 הבעלים של רשימת ה-sections: `MorningBriefDashboard.jsx`

**קריטי:** מאז commit 8801b5c (2026-09-10), ענף `fundamental-analysis`/`technical-analysis` ב-`SpecializedContentRenderer.jsx` (שורות 141-158) **אינו** מרנדר עוד 6 sections גנריים משלו (כפי שתיאר האודיט הקודם, שהיה נכון עד אז) — הוא מרנדר את **אותו `<MorningBriefDashboard>`** בדיוק שהמבזק בוקר/ערב משתמש בו:

```jsx
// SpecializedContentRenderer.jsx:141-158
if (
  slug === 'fundamental-analysis' ||
  slug === 'technical-analysis' ||
  (!slug && looksLikeFundamentalOrTechnical(effectiveVideo))
) {
  const fundamentalBulkDefs = buildMorningBriefBulkSections(effectiveVideo, marketBriefData);
  return renderBulkShell(fundamentalBulkDefs, (
    <MorningBriefDashboard
      effectiveVideo={effectiveVideo}
      marketBriefData={marketBriefData}
      onSaveToBrain={onSaveToBrain}
      onSaveMarketBriefSection={onSaveMarketBriefSection}
      bulkSelection={bulkSelection}
      bulkSections={fundamentalBulkDefs}
      presentation={MORNING_BRIEF_SPECIALIZED_PRESENTATION}
    />
  ));
}

// SpecializedContentRenderer.jsx:161-174 — morning-brief/evening-brief
if (slug === 'morning-brief' || slug === 'evening-brief') {
  const morningBulkDefs = buildMorningBriefBulkSections(effectiveVideo, marketBriefData);
  return renderBulkShell(morningBulkDefs, (
    <MorningBriefDashboard ... presentation={MORNING_BRIEF_SPECIALIZED_PRESENTATION} />
  ));
}
```

זו **אותה קריאת-קומפוננטה**, לא שני מימושים מקבילים (ההערה בקוד עצמו, `SpecializedContentRenderer.jsx:125-129`, מאשרת זאת: "Renders the exact same 9-section dashboard the morning/evening brief uses ... not a parallel implementation"). **המשמעות: כל שינוי בתוך `MorningBriefDashboard.jsx` משפיע על ארבעת ה-slugs האלה בבת-אחת** — ר' Step 12.

### 8.2 מבנה-section בפועל

`src/components/dashboard/MorningBriefDashboard.jsx` (119 שורות, נקראה במלואה) — רינדור JSX-order קבוע של 9 sections, ללא sectionDefs array דינמי:
```jsx
<SentimentSection .../>
<MarketRegimeSection .../>
<EconomicCalendarSection .../>
<MacroSection .../>
<NewsSection .../>
<OpportunitiesRisksDashboard .../>
<SectorOverviewSection .../>
<MarketsSection .../>              {/* שורה 102-108 */}
<StocksMentionedSection .../>      {/* שורה 109-115 — "⭐ מניות שהוזכרו" */}
```
כל section מיובא מ-`./MorningBriefPanels` (שורות 4-14). **נקודת ההכנסה המדויקת ל-"📊 נתונים פונדמנטליים" מעל "⭐ מניות שהוזכרו": בין הסגירה של `<MarketsSection>` (שורה 108) לפתיחת `<StocksMentionedSection>` (שורה 109).**

### 8.3 ה-empty-state המשותף — `SectionCard`

כל section עוטף את התוכן ב-`<SectionCard title=... count=... isEmpty=... emptyMessage=... .../>` (למשל `StocksMentionedSection`, `MorningBriefPanels.jsx:3079-3100`). `SectionCard` (`src/components/dashboard/MorningBriefVisualPrimitives.jsx:153+`) הוא הרכיב המשותף שמייצר את הכותרת+ספירה+"בחר הכל" (הפיל "בחר הכל"/"נקה" ל-selection-ברמת-section מוגדר באותו קובץ, שורה 130-148: `SectionSelectAllButton`-style). **סעיף חדש חייב לעטוף עצמו באותו `<SectionCard>`** כדי לקבל את אותה חוויית ריק/ספירה/בחר-הכל שכל שאר תשעת הסעיפים כבר מקבלים — לא רכיב-ריק נפרד.

### 8.4 שורת-הטבלה לחיקוי — `StockMentionTableRow`

`MorningBriefPanels.jsx:2913-3042` — `StockMentionTableRow` היא הדוגמה החיה לפורמט-טבלה שהמשתמש מבקש: `<td>` checkbox (`MorningBriefBulkCheckbox`) → סימול (טיקר, לינק ל-Finviz) → סקטור (לינק) → סנטימנט (badge) → שינוי% → הערות → לינקים חיצוניים (TV/Investing) → timestamp-link + `BriefRowSaveActions` + `SavedRowIndicator`. סעיף פונדמנטלי-חדש אמור לעקוב אחרי אותו pattern מדויק, עם עמודות שונות (ר' Step 9).

**מסקנה: כן, אפשר להוסיף סעיף בצורה additive — אך לא בלי לגעת בקובץ המשותף `MorningBriefDashboard.jsx` (ר' Step 12 לפתרון-הבטיחות).**

---

## Step 9 — צורת-שורה לסעיף החדש; מה כבר עובר דרך הנתיב הקיים; דוגמה מלאה

### 9.1 צורת-שורה מוצעת

```js
{
  ticker: 'AAPL',
  company: 'Apple Inc.',
  metricName: 'forwardPE',
  metricLabel: 'מכפיל רווח עתידי',
  value: 34.3,
  unit: 'x',
  dateObserved: '2026-09-09',
  rowTimestampSourceItems: [rawItem],   // ללינק-הזמן החי, אותה תשתית כמו שאר הסעיפים
}
```
זהה במהות למבנה `stockDataPoints` המוצע ב-Step 5.1 — **אותו JSON, שני צרכנים**: (א) store היסטורי (Step 4), (ב) טבלת-תצוגה-בטאב-7 (Step 8). ר' Step 11 להכרעה בין "כתיבה כפולה" ל-"כתיבה יחידה".

### 9.2 מה כבר עובר דרך `normalizeAiAnalysisResult`/`gemsJsonRepair.js` היום — בלי שינוי קוד

כפי שנקבע ב-Step 5.3: **שום דבר** מ-`stockDataPoints` לא נגיש בלי שורת-מיפוי חדשה ב-`normalizeAiAnalysisResult`. שער-הקבלה (`validateGemsJsonValue`) לא חוסם אותו, אך גם לא מעביר אותו לשום מקום שימושי לבד.

### 9.3 דוגמה מלאה, ממולאת (09.09.2026)

```json
{
  "contentType": "market",
  "shortSummary": "השוואת מכפילי רווח עתידיים בין שלוש חברות טכנולוגיה מובילות.",
  "stockDataPoints": [
    { "ticker": "AAPL",  "company": "Apple Inc.",       "metricName": "forwardPE", "metricLabel": "מכפיל רווח עתידי", "value": 34.3, "unit": "x", "dateObserved": "2026-09-09", "context": "נחשב כהתנגדות היסטורית", "estimatedStartSeconds": 470 },
    { "ticker": "NVDA",  "company": "NVIDIA Corporation", "metricName": "forwardPE", "metricLabel": "מכפיל רווח עתידי", "value": 18.7, "unit": "x", "dateObserved": "2026-09-09", "context": "מתומחר בזול יחסית לצמיחה", "estimatedStartSeconds": 512 },
    { "ticker": "GOOGL", "company": "Alphabet Inc.",    "metricName": "forwardPE", "metricLabel": "מכפיל רווח עתידי", "value": 25.3, "unit": "x", "dateObserved": "2026-09-09", "context": "בטווח ההיסטורי הרגיל", "estimatedStartSeconds": 545 }
  ]
}
```

---

## Step 10 — שני מקורות-נתונים: הצהרות-בווידאו מול רענון-חי

### 10.a הצהרות-בווידאו (GEM extraction) — ישים היום, בלי שינוי-קוד מעבר לתצוגה

כפי שנקבע ב-Steps 5/9: מסלול ה-paste הקיים (`parseAndValidateGemsJson` → `normalizeAiAnalysisResult`) **יקבל** JSON כזה מבחינת parsing/validation ללא שינוי. הפער היחיד הוא **מיפוי-שדה אחד** ב-`normalizeAiAnalysisResult` (כדי שהשדה בכלל ייכתב על ה-video) ו-**רכיב-UI חדש** (Step 8) — לא evidence-gate, לא parser חדש. תואם ישירות למסקנת `GEM-FUNDAMENTAL-SCHEMA.md` §9.4: אין evidence-gate על מסלול ה-paste הידני בכלל היום (רק על הפייפליין האוטומטי) — "עדיף בלי זמן מאשר זמן שגוי" ממשיך לחול.

### 10.b רענון-חי ממקור-נתונים חיצוני — **לא קיים בקוד היום, כלל**

חיפוש מלא ב-`vite.config.js` (`grep "'/api/"`) מצא 19 endpoints: `rss`, `market/fear-greed`, `resolve-channel`, `youtube-transcript`, `gemini-video-content`, `analyze-video`, `gemini-repair-json`, `generate-row-timestamps`, `claude-video-analyze(/status)`, `political-summary`, `youtube-video-metadata`, `vault/{diagnostics,read,write,append,knowledge-library/ensure,list}`, `gemini-hebrew-titles`, `gemini-ai-mapping-diagnosis`. **אין אף endpoint לציטוט-מניה/פונדמנטלס (quote/fundamentals provider)** — `/api/market/fear-greed` הוא מדד-סנטימנט-שוק גלובלי (CNN Fear&Greed), לא per-ticker.

`.env.example` (נקרא במלואו) — אין שום מפתח ל-Twelve Data / Alpha Vantage / Finnhub / Polygon / IEX. `grep -i "twelvedata|alphavantage|finnhub|polygon|iexcloud"` על כל ה-repo מצא **רק** אזכורים בשני מסמכי-תכנון לא-ממומשים (`docs/plan/PLAN-TRADINGBRAIN-PREMARKET-PANEL.md`, `docs/plan/PLAN-TRADINGBRAIN-DAILY-DIRECTION-STATS.md`) ובתיאור-agent אחד (`decision-signal-engineer.md`) — לא קוד.

**הערה חשובה על CLAUDE.md האישי:** `.claude/CLAUDE.md` ברמת ה-workspace (`c:\Users\11\Desktop\Workspace\.claude\CLAUDE.md`) מזכיר "Twelve Data API Key: [YOUR_KEY_HERE]" — זה **קונפיגורציה אישית ברמת ה-workspace, לא חלק מהריפו הזה ולא מחוברת לשום קוד כאן**. אין import, אין env var בפועל, אין fetch. **קביעה מפורשת: מקור-חיצוני-לרענון-נתונים אינו קיים בריפו הזה היום.**

**המינימום הדרוש (ללא הוספת dependency/key בפועל, כנדרש):** endpoint חדש ב-`vite.config.js` (בדומה ל-`/api/market/fear-greed`, שורה 151) שמפנה ל-provider-חיצוני, plus מפתח-API אמיתי דרך Base44 Environment Variables/`.env.local` (לא בקוד, כפי ש-CLAUDE.md של הפרויקט מחייב) — **לא בוצע כאן, לא הוצע dependency ספציפי**, רק זוהה שזה נדרש אם וכשתיבחר האופציה הזו.

---

## Step 11 — חיבור בין שורות-פר-וידאו לבין ה-store ההיסטורי: כתיבה יחידה, לא כפולה

**המלצה: כתיבה יחידה, קריאה כפולה.** ה-video record (`video.stockDataPoints`, Step 5/9) הוא ה-**source of truth היחיד בזמן-כתיבה** — נכתב פעם אחת ב-paste (`normalizeAiAnalysisResult`). שני הצרכנים:
1. **תצוגת טאב 7** (Step 8-9): קוראת ישירות מ-`effectiveVideo.stockDataPoints` — video-scoped, בדיוק כמו ש-`financial-metrics` case קורא `video.financialMetrics` (`videoTabsConfig.js:924-929`).
2. **תצוגת-היסטוריה לפי-טיקר** (Step 4, אפשרות 1/3): אם וכשתיבנה, **נגזרת** מאותו שדה — סריקת `loadVideos()` + flatMap על `stockDataPoints` (אפשרות 3), או upsert לתוך store נפרד בזמן ה-paste עצמו (אפשרות 1, שכן דורשת כתיבה שנייה לצורך אינדוקס — אך עדיין **מאותו JSON מקור**, לא re-entry ידני נפרד).

**למה לא כפילות-אמיתית:** גם באפשרות 1, ה-write השני הוא derived-write אוטומטי מאותו payload (כמו index secondary בכל DB) — לא שני מקורות-אמת נפרדים שיכולים לסטות זה מזה. **לא מומלץ:** לבקש מה-GEM/מהמשתמש למלא את אותו מידע פעמיים בשני מקומות נפרדים בפרומפט.

---

## Step 12 — סיכון-דליפה לתצוגת המבזק (morning/evening brief) — הסיכון המרכזי, דורש הכרעה

כפי שנקבע ב-Step 8.1: **`MorningBriefDashboard.jsx` הוא אותו קובץ, אותה קריאת-קומפוננטה, בין fundamental-analysis/technical-analysis לבין morning-brief/evening-brief בפועל** (`SpecializedContentRenderer.jsx:141-174`). **אם הסעיף "📊 נתונים פונדמנטליים" ייכתב היישר לתוך ה-JSX הקבוע של `MorningBriefDashboard.jsx` (בין שורה 108 ל-109), הוא יופיע אוטומטית בכל ארבעת ה-slugs — כולל מבזק בוקר/ערב האמיתיים, שלא ביקשו את זה ולא תוכננו לזה.**

זה בדיוק אותו סוג-בעיה שתועד ונפתר עבור התוכן-הלימודי לפני 8801b5c ("טאב 7 = תוכן יומי בלבד" → הועבר לטאב 4 כדי לא "ללכלך" את שאר ה-slugs) — כאן ההיפך: תוכן שכן שייך ספציפית ל-fundamental/technical מאיים "לדלוף" למבזק.

**פתרון מומלץ (לא בוצע, לא קוד):** להוסיף prop אופציונלי ל-`MorningBriefDashboard` (למשל `showFundamentalDataSection = false`) — ברירת-מחדל `false` כדי ש-morning-brief/evening-brief (`SpecializedContentRenderer.jsx:164`, שלא יעבירו את ה-prop) יישארו **בדיוק** כפי שהם היום; רק הקריאה מ-fundamental-analysis/technical-analysis branch (שורה 148) תעביר `showFundamentalDataSection` + הנתונים הרלוונטיים. כך השינוי נשאר additive לקובץ המשותף, בלי לסכן את שני ה-slugs שלא ביקשו את זה. **חלופה שנשקלה ונדחתה בביקורת זו (לא מומלצת):** לפצל `MorningBriefDashboard` לשני קבצים — לא נחוץ בהיקף השינוי הזה ומגדיל את הסיכון-לרגרסיה בכל 4 ה-slugs בבת-אחת.

**זהו open item שדורש הכרעת-משתמש מפורשת לפני מימוש** — לא ניתן להניח "כמובן שלא" בלי בדיקה, כי ייתכן שהמשתמש דווקא כן רוצה שדשבורד-המבזק גם יראה תצפיות-פונדמנטל כשהן קיימות (אם ה-video שמזין את המבזק עצמו מכיל אותן). מפורש כ-open item, לא כהכרעה.

---

## קבצים שנקראו/נבדקו בפועל (נתיבים מלאים, מעבר לאלה שצוטטו inline)

- `docs/plan/AUDIT-TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA.md` (מלא, 488 שורות — ביקורת קודמת, בסיס להשוואה)
- `docs/gems/FUNDAMENTAL-OVERVIEW.md` (מלא, 128 שורות)
- `docs/gems/GEM-FUNDAMENTAL-SCHEMA.md` (מלא, 238 שורות)
- `docs/gems/GEM-FUNDAMENTAL-EXAMPLE.json` (שורות 1-60)
- `docs/governance/SAVE_SYSTEM_ARCHITECTURE.md` (מלא, 495 שורות)
- `src/lib/morningBriefDisplay.js` (שורות 1300-1460 + grep על function list)
- `src/lib/persistence/appDataDb.js` (מלא, 424 שורות)
- `src/lib/persistence/storageManifest.js` (מלא, 197 שורות)
- `src/services/videoStorage.js` (שורות 1-100)
- `src/services/videoAnalytics.js` (שורות 1080-1349)
- `src/lib/gemsJsonRepair.js` (שורות 1-120)
- `src/lib/localKnowledgeItemStore.js` (grep ממוקד + שורות 24-140)
- `src/components/dashboard/MorningBriefDashboard.jsx` (מלא, 119 שורות)
- `src/components/dashboard/SpecializedContentRenderer.jsx` (שורות 100-280)
- `src/components/dashboard/MorningBriefPanels.jsx` (שורות 2850-3110)
- `src/config/videoTabsConfig.js` (grep ממוקד על case 'financial-metrics'/'valuation'/'investment-checklist'/'prompt-templates')
- `src/lib/specializedSectionOrder.js` (מלא, 84 שורות)
- `src/utils/finvizLinks.js` (grep ל-exports)
- `src/lib/extractAppIdeas.js` (שורות 140-210)
- `vite.config.js` (grep על `server.middlewares.use('/api/`)
- `.env.example` (מלא)
- `C:\Users\11\.claude\projects\...\memory\project_brain_evolution.md` (מלא — הקשר Step 7)
- `git show --stat` על commits 8801b5c ו-8917078 (לזיהוי שהאודיט הקודם stale)

## הנחות מפורשות (במקום שהמידע חסר)

1. הונח ששם-השדה `stockDataPoints` (Step 5) הוא בחירה סבירה שלא מתנגשת עם אף שדה קיים (אומת ב-grep ש-`stockDataPoints` לא מופיע היום בשום קובץ ב-`src/`) — לא ניתן לאישור-משתמש כאן לפי כללי המשימה (no clarifying questions).
2. הונח שהזיכרון `project_brain_evolution.md` (123 יום, מסומן stale על-ידי המערכת עצמה) רלוונטי-בערך בלבד ל-Step 7, לא כמקור-קביעה מדויק ל"החלטת-הידע-הנפרדת" שהמשתמש מתכוון אליה — לא אומת מול המשתמש.
3. הונח שהיקף-הנתונים הנוכחי (וידאו בודדים, לא אלפי-תצפיות ביום) הופך את אפשרות 3 (ללא store שני) לסבירה ל-v1 — לא נמדד בפועל מול מספר הוידאו האמיתי במערכת.
4. לא נבדק בעומק אם `normalizeLearningArray`/`normalizeLearningItem` (המנגנון הקיים שממיר item ל-object-עם-timing) מתאים ל-object עם שדה `value` מספרי בלי לקרוס אותו למחרוזת (Step 5.3) — מפורש כ-open item, לא הונח בוודאות.

---

✅ פרויקט youtube-mentor-dashboard · WORK-ID TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY · שם משימה: אחסון נתוני מניות פונדמנטליים היסטוריים
**Commit status:** לא בוצע commit — הקובץ נשאר untracked, לפי דרישת המשימה.
**Push status:** לא בוצע push.
**מה נשאר פתוח (להכרעת המשתמש, יועבר ל-backlog-tracker):**
1. בחירת אפשרות-אחסון (Step 4: אפשרות 1/2/3).
2. שם-השדה `stockDataPoints` ותוספת שורת-המיפוי ב-`normalizeAiAnalysisResult` (Step 5.3, 9.2).
3. פתרון סיכון-הדליפה למבזק בוקר/ערב לפני נגיעה ב-`MorningBriefDashboard.jsx` (Step 12) — **חוסם לכל מימוש בטאב 7**.
4. הבחנה מפורשת בהוראות ה-GEM בין `financialMetrics`/`valuation` (לימודי) לבין `stockDataPoints` (תצפית-בפועל) כדי למנוע כפילות-תוכן (Step 6.1).
5. האם רענון-חי ממקור-חיצוני (Step 10.b) בכלל בהיקף המשימה כרגע, או רק extraction מהווידאו (Step 10.a) ל-v1.
