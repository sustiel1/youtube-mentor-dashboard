# תוכנית מימוש — מסך פרה־מרקט

- פרויקט: `youtube-mentor-dashboard`
- WORK-ID: `TRADINGBRAIN-PREMARKET-PANEL`
- שם משימה: הוספת מסך פרה מרקט
- סטטוס מסמך: החלטה מוכנה למימוש; תכנון בלבד
- תאריך בדיקה: 2026-09-09

## 1. זהות סביבת העבודה

- Repository / worktree: `C:/Users/11/Desktop/Workspace/new-project/projects/youtube-mentor-dashboard`
- Git dir: `.git`
- Branch: `feat/saved-market-rows-table`
- HEAD: `5536e50ef641d3714a0485c6f5a0da34d7e4369f`
- זהו ה־worktree הראשי הפעיל; לא הוחלף branch או worktree.

בעת הבדיקה היו שינויים לא שמורים. הם נשמרו כפי שהם ולא בוצעו clean/reset/restore:

- Modified: `.claude/settings.json`
- Modified: `docs/open-items-ledger.md`
- Modified: `scripts/market-asset-provider-links-qa.mjs`
- Modified: `src/components/dashboard/MorningBriefMarketsTable.jsx`
- Modified: `src/components/dashboard/MorningBriefPanels.jsx`
- Untracked: `.claude/settings.local.json`
- Untracked: `.claude/settings.local.json.bak-2026-09-08`
- Untracked: `docs/gems/GEM-FUNDAMENTAL-EXAMPLE.json`
- Untracked: `docs/gems/GEM-FUNDAMENTAL-INSTRUCTIONS.md`
- Untracked: `docs/gems/GEM-FUNDAMENTAL-SCHEMA.md`
- Untracked: `docs/plan/AUDIT-TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA.md`
- Untracked: `docs/plan/DECISION-TRADINGBRAIN-SNAPSHOT-BASE.md`
- Untracked: `docs/plan/PLAN-TRADINGBRAIN-DAILY-DIRECTION-STATS.md`
- Untracked: `docs/plan/PLAN-TRADINGBRAIN-WIP-CLOSEOUT-GROUPS.md`
- Untracked: `docs/plan/REVIEW-TRADINGBRAIN-SNAPSHOT-PROTOTYPE.md`
- Untracked: `docs/qa/rescue-2026-09-07-desktop-worktrees/README.md`
- Untracked: `docs/qa/rescue-2026-09-07-desktop-worktrees/prototype-daily-snapshot/DailySnapshot.jsx`
- Untracked: `docs/qa/rescue-2026-09-07-desktop-worktrees/prototype-daily-snapshot/dailySnapshot.fixture.js`
- Untracked: `docs/qa/rescue-2026-09-07-desktop-worktrees/prototype-daily-snapshot/index.html`
- Untracked: `docs/qa/rescue-2026-09-07-desktop-worktrees/prototype-daily-snapshot/main.jsx`
- Untracked: `docs/qa/rescue-2026-09-07-desktop-worktrees/prototype-daily-snapshot/styles.css`
- Untracked: `docs/qa/rescue-2026-09-07-desktop-worktrees/src/lib/marketAssetDescriptions.js`
- Untracked: `docs/qa/rescue-2026-09-07-desktop-worktrees/src/lib/sectorTablePresentation.js`
- Untracked: `scripts/session-wip-status-report.mjs`
- Untracked: `scripts/tmp/gem-fundamental-schema-verify.mjs`
- Untracked: `scripts/tmp/gem-verify-loader.mjs`
- Untracked: `scripts/tmp/register-gem-verify-loader.mjs`
- Untracked: `tradingbrain-color-table-headings.png`
- Untracked: `tradingbrain-news-category-desktop.png`
- Untracked: `tradingbrain-sector-news-table-design.png`
- Untracked: `youtube-dashboard-loaded.png`

הערת בטיחות למימוש: שני קובצי טבלאות היעד כבר modified. לפני נגיעה בהם יש לתאם בעלות, לעיין ב־diff הקיים ולבצע שינוי נקודתי בלבד. אין לגעת ב־`vite.config.js`, בקובצי migration המוגנים או ב־allowlists/counts שב־`src/lib/persistence/storageManifest.js` ללא אישור מפורש.

## 2. ממצאי audit ומה ניתן למחזר

### כניסת נתונים לאפליקציה

| תחום | קבצים קיימים | שימוש מתוכנן |
|---|---|---|
| הדבקת JSON/תוכן שחולץ ב־AI | `src/components/dashboard/VideoDetailPanel.jsx` | למחזר את דפוס paste → preview → validation → save, לא את הגישה הישירה הישנה ל־localStorage |
| סכמת Morning Brief | `src/ai/gemini/schemas/morningBriefSchema.js` | מקור להבנת מבנה תוצאות שוק ומניות בלבד; נתוני פרה־מרקט יקבלו חוזה נפרד ונייטרלי למקור |
| נרמול תוצאת שוק | `src/ai/gemini/validators/validateMarket.js` | למחזר עקרונות validation; לא למחזר ברירות מחדל שמטשטשות ערך חסר |
| פרומפטים והפקת מידע | `src/ai/quickCopyPrompts.js` | לא נדרש ב־v1; המסך יקבל paste מפורש ולא יטען שנתוני AI הם quote חי |
| חילוץ שורות שוק ומניות | `src/lib/morningBriefDisplay.js` | `extractUnifiedStocks`, `extractMarketDashboardRows` ו־`getSpecializedSrc` הם נקודות האינטגרציה למניות שהוזכרו |
| קונפיגורציית tabs | `src/config/videoTabsConfig.js` | audit בלבד; אין צורך להוסיף tab למסך וידאו עבור מסך עליון חדש |

### התמדה ו־Workspace

| תחום | קבצים קיימים | החלטה |
|---|---|---|
| Facade מאושר | `src/lib/persistence/storageFacade.js` | כל cache חדש יעבור דרך `createStorageFacade`; אין שימוש ישיר ב־localStorage |
| דוגמת store קנונית | `src/lib/persistence/marketBriefCanonicalStore.js` | למחזר lazy runtime repository, read/write ו־read-back verification |
| Workspace library | `src/lib/workspaceLibraryStore.js`, `src/lib/persistence/workspacePersistence.js`, `src/hooks/useWorkspaceLibrary.js` | תמונת פרה־מרקט תוכל להישמר בעתיד כפריט Workspace מפורש; אין לכתוב payload לא מוכר ללא renderer תואם |
| Snapshot מובנה | `src/utils/structuredSnapshot.js`, `src/components/workspace/StructuredSnapshotView.jsx` | לשלב רק באמצעות שדה אופציונלי/adapter תואם לאחור; לא להמיר `null` למחרוזת או ל־0 |
| מודל יום עבודה | `src/lib/workspaceDayModel.js`, `src/lib/workspaceDayStore.js`, `src/lib/persistence/workspaceDayPersistence.js`, `src/hooks/useWorkspaceDays.js` | אין להשתמש ב־`workspaceDayPersistence.js` כפתרון cache לפרה־מרקט, כי הנתיב הנוכחי עדיין קשור ישירות ל־localStorage |
| Daily Snapshot | `docs/qa/rescue-2026-09-07-desktop-worktrees/prototype-daily-snapshot/`, `docs/plan/DECISION-TRADINGBRAIN-SNAPSHOT-BASE.md` | אין כרגע מסך production תחת `src`; יש להכין adapter טהור ולחבר רק לאחר שבסיס ה־Daily Snapshot ינחת במסלול production מוסכם |

### טבלאות, pills וקישורים

| רכיב/כלל | נתיב | שימוש מתוכנן |
|---|---|---|
| טבלת השווקים הפעילה | `src/components/dashboard/MorningBriefMarketsTable.jsx` | הרחבה באמצעות props אופציונליים להצגת last, previous close, change, volume, session ו־timestamp; ברירת המחדל הישנה נשארת ללא שינוי |
| טבלת מניות שהוזכרו | `src/components/dashboard/MorningBriefPanels.jsx` | הרחבת `StocksMentionedSection` באמצעות `quoteBySymbol`/מצב תצוגה אופציונלי, במקום טבלה מקבילה חדשה |
| טבלת שוק legacy/mobile | `src/components/dashboard/MarketIndicesTable.jsx` | מקור לדפוס responsive cards בלבד; לא להפוך אותה לנתיב render נוסף אם הטבלה הפעילה מספיקה |
| פריסת טבלה ושינוי מספרי | `src/components/dashboard/briefTableLayout.jsx`, `src/components/dashboard/MorningBriefVisualPrimitives.jsx` | למחזר wrapper, classes ו־`NumericChangeSpan` |
| pills וסנטימנט | `ComparisonSummaryPills`, `InlineSentimentBadge` בתוך `src/components/dashboard/MorningBriefPanels.jsx` | למחזר; `null` יוצג כ״לא זמין״ ולא ייספר כנייטרלי |
| resolver קנוני | `src/lib/marketEntityLinkResolver.js` | מניה בודדת: Finviz ראשון, `il.investing.com` fallback |
| registry לספקי נכס | `src/lib/marketAssetProviderLinks.js` | חוזים עתידיים: resolve לפי סוג נכס וסימול קנוני, ללא ניחוש URL |
| רכיבי קישור | `src/components/shared/MarketAssetProviderLinks.jsx`, `src/components/shared/MarketAssetLinksMenu.jsx`, `src/components/shared/LinkedMarketText.jsx` | למחזר את ה־UI הקיים |
| helpers נוספים | `src/utils/finvizLinks.js`, `src/utils/analysisTickerLinks.js` | אין לשכפל לוגיקת URL במסך החדש |

כלל קישור מחייב: equities עוברים דרך `resolveMarketEntityLink` עם Finviz בעדיפות ו־`il.investing.com` כ־fallback; futures עוברים דרך registry מוכר. נכס לא נתמך נשאר ללא קישור או עם fallback שה־resolver מחזיר — אין לבנות URL מהסימול בניחוש.

### RTL ושיטת QA

- `src/App.jsx` מגדיר `dir="rtl"`; הכותרות, ההסברים, מצבי empty/error והפעולות יהיו בעברית.
- סימולים, מחירים, אחוזים, נפח וחותמות זמן יקבלו `dir="ltr"` ברמת התא.
- המסמך כולו לא יקבל overflow אופקי; רק wrapper פנימי של טבלה רשאי לגלול.
- תבנית QA קיימת: Node + `node:assert/strict`, ובמקרים של alias דרך `node --import ./scripts/register-src-aliases.mjs`.
- דוגמאות רלוונטיות: `scripts/aaii-weekly-sentiment-logic-qa.mjs`, `scripts/aaii-weekly-sentiment-card-qa.mjs`, `scripts/saved-market-rows-qa.mjs`, `scripts/saved-stock-rows-qa.mjs`, `scripts/market-asset-provider-links-qa.mjs`, `scripts/structured-snapshot-qa.mjs`.
- בדיקות regression קיימות לשימור: `npm run test:saved-market-rows`, `npm run test:saved-stock-rows`, `npm run test:structured-snapshot`, ולאחר מכן `npm run build`.

## 3. בחינת מקורות נתונים — free first

הבדיקה מפרידה בין נתוני equities בשעות מורחבות לבין quotes של חוזי מדדים. מקור שמחזיר רק quote של המסחר הרגיל אינו עומד בדרישה. המחירים והמכסות נכונים למועד הבדיקה ועלולים להשתנות.

| מועמד | עלות ומגבלת free | מפתח | equities pre-market בפועל | US index futures בפועל | CORS / proxy / config | אמינות | תנאי שימוש אישי ומסקנה |
|---|---|---|---|---|---|---|---|
| Manual paste מקובץ/טבלת broker מורשית | $0; אין מכסת API | לא | כן, אם המקור שהמשתמש מדביק כולל last/session/time | כן, אם המקור כולל חוזי ES/NQ/YM/RTY או aliases ממופים | לא נדרש | parser מקומי דטרמיניסטי; הטריות תלויה במשתמש | מותר רק אם למשתמש זכות לצפות ולהעתיק לשימוש אישי. הפתרון החינמי היחיד שמכסה את שני סוגי הנכסים בלי תלות לא רשמית |
| Twelve Data | Basic חינם: 8 credits/min ו־800/day; extended hours דורש Pro+, שמוצג החל מכ־$99/mo | כן | כן ב־Pro+ עם `prepost=true` ו־`is_extended_hours`; לא ב־free | יש כיסוי futures/commodities בתוכניות מסוימות, אך כיסוי חוזי המדדים והזמן האמיתי חייב אימות בחשבון | קריאת browser חושפת key; נדרש backend/proxy והגדרת secret | ספק מתועד ויציב יחסית | שימוש אישי לפי התוכנית; redistribution מוגבל. לא עובר free-first ולא מאומת כמקור יחיד לשני הצדדים |
| Alpha Vantage | free: 25 requests/day; intraday/real-time רבים הם Premium | כן | התיעוד מתאר extended 04:00–20:00 ET, אך endpoint intraday/real-time הרלוונטי Premium | אין endpoint מתועד ל־real-time CME equity-index futures; commodity series אינן quote של חוזה | key בדפדפן אינו רצוי; backend/proxy | אמין ל־EOD, לא מתאים לדרישה זו ב־free | תנאי API ורישוי חלים; לא פתרון מלא |
| Finnhub | חשבון free עם quota מוגבל; קיימת תקרה גלובלית מתועדת, אך המכסה החינמית המדויקת תלויה בחשבון | כן | quote מחזיר current/previous close אך אינו מסמן quote pre-market; market-status מציין session בלבד | אין futures quote מתועד שמכסה את הדרישה | backend/proxy נדרש להגנת key | טוב ל־stocks רגילים; לא מספק סמנטיקת extended מלאה | אישי לפי רישיון החשבון; לא פתרון מלא |
| Massive / Polygon | Stocks Basic: $0, 5 calls/min, EOD וללא snapshot; Futures Basic: $0, 5 calls/min והיסטוריה. Starter מוצג כ־$29/mo לכל מוצר עבור delayed/snapshot | כן | extended נכלל במוצרי trades/aggregates/snapshot, אך לא live ב־free | snapshot delayed דורש לפחות Futures Starter | backend/proxy ושני products/configs | ספק מוסדי ומתועד | שימוש/תצוגה לפי רישיון; לפתרון delayed של שני הצדדים נדרשים שני מנויים, כ־$58/mo לפני מסים |
| Financial Modeling Prep | free: 250 calls/day, בעיקר EOD/reference; Starter כ־$22/mo בחיוב שנתי | כן | endpoints של aftermarket קיימים, אך כיסוי מלא אינו free; free מוגבל לעיתים לסימולי sample | commodity quote קיים, אך כיסוי front-month equity-index futures לא אושר כחוזה מלא | backend/proxy נדרש | טוב ל־fundamentals; התאמה חלקית כאן | שימוש אישי בתוכנית; display/redistribution עלולים לדרוש הסכם נוסף |
| Tiingo | Starter חינם: 500 unique symbols/month, 50 req/hour, 1,000/day | כן | Equity Realtime beta כולל 04:00–20:00 ET ו־pre/post | אין מוצר futures מתאים | backend/proxy להגנת token | טוב לצד equities בלבד; beta | individual/internal use; לא פתרון מלא |
| Alpaca Market Data | free עם IEX; תיעוד עבר מציין 200 calls/min | כן וחשבון | bars/trades של equities יכולים לכלול extended לפי טווח הבקשה | futures אינם נתמכים | backend/proxy והגדרת credentials | יציב ל־equities, פיד IEX אינו consolidated | שימוש אישי/מסחרי לפי הסכם; לא פתרון מלא |
| Marketstack | דף ההרשמה מציג 100 requests/month ב־free; FAQ ישן מציג עד 1,000, ולכן יש אי־עקביות. Basic כ־$9.99/mo | כן | free הוא EOD; אין שדה extended מובחן ומתועד שמספק את הדרישה | אין כיסוי חוזי מדדים מספק | backend/proxy | סביר ל־EOD | תנאי תוכנית חלים; לא מתאים |
| Yahoo Finance endpoints לא רשמיים | $0 וללא quota מובטח | לא ל־endpoint הלא רשמי | לעיתים `preMarketPrice`, `preMarketChangePercent` ו־`includePrePost=true` | סימולים כגון `ES=F` זמינים לעיתים | CORS חסום/לא מובטח; cookie/crumb/User-Agent ו־proxy עלולים להידרש | שביר וללא SLA | תנאי Yahoo אוסרים/מגבילים גישה אוטומטית מחוץ ל־API מאושר; אין לבחור לייצור |
| TradingView widgets | widget חינם עם branding | לא ל־embed | כן לתצוגה כאשר הפיד תומך | כן לתצוגת סימולי futures | script/iframe חיצוני; CSP/config עשויים להשתנות | אמין כתצוגה | הנתונים נשארים בתוך widget; אי אפשר לנרמל, לשמור או לחבר לטבלאות האפליקציה. לא עומד בחוזה הנתונים |
| CME delayed pages | חינם, delay של 10 דקות לפחות | לא | לא — futures בלבד | כן, כתצוגה מושהית | scraping ידרוש proxy ויהיה שביר | מקור סמכותי לצפייה | התנאים מאפשרים צפייה אישית בצורה המוצגת ומגבילים extraction/caching/software use; אין לבצע ingestion אוטומטי או להמליץ עליו כמקור paste קבוע |
| Finviz API/pages | API קשור למנוי; מגבלת API מתועדת סביב בקשה אחת ל־5 שניות | כן ל־API | עשוי להציג pre-market למניות | יש דפי futures, אך לא חוזה free API מאומת לשני הצרכים | backend/proxy להגנת key | טוב לקישורים/מחקר, לא כמקור free משולב | שימוש אישי בלבד והפצה מחדש מוגבלת; נשאר יעד קישור, לא provider ל־v1 |
| Tradier / Nasdaq public pages / Stooq ו־CSV ציבוריים | חינם או free tier משתנה | Tradier דורש key; האחרים לא תמיד | חלקם stocks-only או EOD; ללא חוזה extended עקבי | Tradier אינו futures; דפים/CSV אינם API חוזי אמין | לרוב CORS/proxy או scraping | לא עקבי | אין API חינמי, מתועד ומורשה שמכסה את שני הצדדים; נפסלו |

### החלטה

המקור המומלץ ל־v1 הוא **Manual paste ממקור שהמשתמש מורשה להשתמש בו**, עם parser מקומי, preview, validation, חותמת זמן ואזהרת stale. הוא ניצח מפני שהוא היחיד בעלות $0, ללא key, ללא proxy וללא שינוי config, שיכול להכיל גם equities pre-market וגם US index futures בתוך אותו חוזה נתונים. יש לומר במפורש: אין כרגע מקור אוטומטי חינמי, מתועד ומורשה שנמצא מתאים לשני סוגי הנתונים.

הבחירה אינה מאפשרת scraping. המשתמש אחראי להדביק export/copy ממקור אישי שמרשה זאת. אם בעתיד יאושר תקציב, provider adapter יאפשר להחליף את ה־ingestion בלי שינוי UI. מועמד paid ראשון לבדיקה הוא Twelve Data Pro+ רק לאחר proof-of-coverage לסימולי futures הנדרשים ובדיקת רישוי; אין להטמיע key ב־client.

מקורות רשמיים עיקריים:

- Twelve Data: <https://support.twelvedata.com/en/articles/5195429-pre-post-market-data>, <https://twelvedata.com/pricing>, <https://support.twelvedata.com/en/articles/5335783-trial>
- Alpha Vantage: <https://www.alphavantage.co/documentation/>, <https://www.alphavantage.co/premium/>, <https://www.alphavantage.co/terms_of_service/>
- Finnhub: <https://finnhub.io/docs/api/>
- Massive: <https://massive.com/pricing?product=stocks>, <https://massive.com/pricing?product=futures>, <https://massive.com/knowledge-base/article/does-massive-offer-pre-market-and-after-hours-data>
- FMP: <https://site.financialmodelingprep.com/developer/docs/pricing>
- Tiingo: <https://www.tiingo.com/about/pricing>, <https://www.tiingo.com/documentation/equity-realtime-stock-data>, <https://www.tiingo.com/documentation/general>
- Alpaca: <https://docs.alpaca.markets/us/v1.1/docs/about-market-data-api>, <https://docs.alpaca.markets/us/reference/stockbars>
- Marketstack: <https://marketstack.com/faq>
- TradingView: <https://www.tradingview.com/widget-docs/>, <https://www.tradingview.com/widget-docs/faq/data/>
- CME: <https://www.cmegroup.com/market-data/browse-data/delayed-quotes.html>, <https://www.cmegroup.com/trading/market-data-explanation-disclaimer.html>
- Yahoo terms: <https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apiforydn/index.html>, <https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apitnc/index.html>
- Finviz API limits: <https://finviz.com/knowledge-base/market-data-research/api/usage-limits>

## 4. חוזה נתונים מנורמל ונייטרלי למקור

### Snapshot

| שדה | טיפוס/כלל |
|---|---|
| `schemaVersion` | `1` |
| `tradeDate` | תאריך `YYYY-MM-DD` או `null` |
| `capturedAt` | ISO-8601 תקין או `null`; זמן קליטת ה־snapshot |
| `source.kind` | `manual-paste` או `api` |
| `source.provider` | שם ספק שהמשתמש בחר/הזין או `null` |
| `source.sourceUrl` | URL תקין או `null`; אין חובה ואין fetch אוטומטי |
| `quotes` | מערך רשומות quote מנורמלות |

### Quote

| שדה | טיפוס/כלל |
|---|---|
| `symbol` | סימול קנוני uppercase; חובה ולא ריק |
| `instrumentType` | `index_future` או `equity` |
| `last` | מספר finite או `null` |
| `previousClose` | מספר finite או `null`; ב־future המשמעות היא previous settlement כשהמקור מספק settlement |
| `changePercent` | מספר finite או `null` |
| `volume` | מספר finite שאינו שלילי או `null` |
| `session` | `pre_market`, `overnight_futures`, `regular`, `post_market`, `closed` או `unknown` |
| `timestamp` | זמן ה־quote בפורמט ISO-8601 או `null` |

כללי נרמול:

1. ערך חסר, ריק, `—`, `N/A`, `null`, אינסופי או שאינו ניתן לפענוח חוזר כ־`null`; אין ברירת מחדל מספרית.
2. אפס חוקי נשמר כ־0 ואינו נחשב חסר.
3. `changePercent` מפורש ותקין מהמקור נשמר. אם חסר, מותר לחשב רק כאשר `last` ו־`previousClose` finite ו־`previousClose !== 0`; אחרת `null`.
4. timestamp נשמר ב־UTC ISO; ה־UI רשאי להציג גם Asia/Jerusalem וגם ET, בלי לשנות את הערך השמור.
5. alias של ספק ממופה בנפרד מהמודל. מיפוי v1 לחוזים: ES, NQ, YM, RTY; אין להכניס suffix של ספק לתוך `symbol` הקנוני.
6. שורה מודבקת דורשת `symbol` ולפחות metric שוק תקין אחד או `timestamp`; שורת symbol-only מותרת רק כשהיא נוצרה מרשימת ״מניות שהוזכרו״ ומוצגת כנתון חסר, לא כ־quote שנקלט.
7. סימול כפול באותה הדבקה מסומן כשגיאת preview; אין merge שקט ואין ״האחרון מנצח״.
8. סנטימנט תצוגתי נגזר בלבד: חיובי/אפס/שלילי מתוך `changePercent`; `null` הוא ״לא זמין״ ומוחרג מספירות sentiment.

## 5. גבולות מודולים ונתיבים מוצעים

| מודול | נתיב מוצע | אחריות |
|---|---|---|
| חוזה ונרמול | `src/lib/preMarket/preMarketQuoteModel.js` | validation, coercion זהיר, aliases, null semantics, schema version |
| parser | `src/lib/preMarket/parsePreMarketPaste.js` | CSV/TSV וטבלת clipboard; header aliases; errors/warnings ו־preview ללא side effects |
| selectors | `src/lib/preMarket/preMarketSelectors.js` | פיצול futures/equities, join מדויק למניות שהוזכרו, sentiment counts ו־stale state |
| store | `src/lib/persistence/preMarketSnapshotStore.js` | read/write של snapshot נוכחי דרך `createStorageFacade`, read-back verification ושמירת snapshot תקין אחרון |
| hook | `src/hooks/usePreMarketSnapshot.js` | load/save state, error/stale flags; ללא גישה ישירה לאחסון |
| page | `src/pages/PreMarket.jsx` | orchestration בלבד: upload/paste, preview, save, freshness, tables ו־empty/error states |
| route map | `src/pages.config.js` | רישום page חדש בצורה additive |
| ניווט | `src/components/layout/AppSidebar.jsx` | פריט עברי ״פרה־מרקט״ ללא שינוי ניווט קיים |
| טבלת futures | `src/components/dashboard/MorningBriefMarketsTable.jsx` | props אופציונליים למצב pre-market; שימוש באותו shell/link/pill |
| טבלת equities | `src/components/dashboard/MorningBriefPanels.jsx` | props אופציונליים ל־`StocksMentionedSection`; ברירת המחדל הנוכחית נשארת |
| Daily adapter | `src/lib/preMarket/selectPreMarketDailySnapshotFocus.js` | בחירה מפורשת של עד 3 נכסים וחוזה output יציב למסך היומי |
| QA parser/model | `scripts/premarket-parser-qa.mjs` | fixtures ו־assertions למודל, parser ו־selectors |
| QA persistence | `scripts/premarket-storage-qa.mjs` | facade-backed round trip, invalid write ו־last-known-good |
| npm scripts | `package.json` | `test:premarket` שמריץ את שני סקריפטי ה־QA בתבנית הקיימת |

### אסטרטגיית cache

- מפתחות מוצעים: `market_brief_premarket_v1_current` בלבד ב־v1, תחת prefix מאושר שכבר קיים ב־storage facade.
- אין לשנות את `src/lib/persistence/storageManifest.js` כדי לעקוף governance.
- ה־store יכתוב רק snapshot שעבר validation מלא ויבצע read-back. כישלון כתיבה משאיר את ה־last-known-good ללא שינוי.
- stale מחושב בזמן קריאה מתוך `capturedAt`; נתון ישן נשאר מוצג עם badge ברור ואינו נמחק אוטומטית.
- אין היסטוריה בלתי מוגבלת בתוך cache. Snapshot שנשמר ל־Workspace/Daily Snapshot הוא עותק מפורש במסלול ההתמדה של היעד.
- אין localStorage ישיר, אין secret, אין API key ואין background fetch ב־v1.

## 6. מיקום וחוויית משתמש

- מסך top-level חדש ״פרה־מרקט״ ב־sidebar, באותו shell של האפליקציה וב־RTL.
- ראש המסך: זמן snapshot, ספק שהוזן, badge של session, מצב freshness ופעולות ״הדבק נתונים״ / ״עדכן״.
- אזור ראשון: חוזי מדדי ארה״ב, בסדר ES, NQ, YM, RTY, באמצעות `MorningBriefMarketsTable` המורחבת.
- אזור שני: מניות pre-market, באמצעות `StocksMentionedSection` המורחבת. אפשר לעבור בין ״כל המניות שנקלטו״ ל־״מניות שהוזכרו״.
- פעולת paste פותחת preview בעברית עם accepted/rejected rows, סימון שדות חסרים, timezone ומקור; רק אישור מפורש מחליף את snapshot התקין.
- empty state מסביר שהגרסה החינמית דורשת הדבקה ידנית ומציג header template נתמך, בלי לעודד scraping.
- stale state אינו מסתיר נתונים: מוצגים זמן הקליטה, גיל הנתון ואזהרה.
- בקישורים: equity משתמש בכלל Finviz → Investing; future משתמש ב־provider registry. אין רכיב קישור חדש.
- במובייל: cards או table scroll פנימי בהתאם להתנהגות הרכיב הקיים; מסמך ברוחב 390px ללא overflow אופקי.

## 7. נקודות אינטגרציה

### מניות שהוזכרו

1. הרשימה מתקבלת מ־`extractUnifiedStocks` על בסיס ה־Morning Brief הפעיל.
2. join נעשה לפי `symbol` מנורמל ובהשוואה case-insensitive מדויקת בלבד; אין substring, שם חברה או alias guessing.
3. ״טען מניות שהוזכרו״ יוצר rows לתצוגה עם metrics כ־`null`; רק paste תקין ממלא quote.
4. מניה שאינה ב־brief נשארת בטבלת ״כל המניות שנקלטו״ ואינה מזהמת את טבלת המוזכרות.
5. props החדשים ל־`StocksMentionedSection` אופציונליים; כל caller קיים ממשיך לקבל את אותה תצוגה והתנהגות.

### Daily Snapshot ו־Workspace

1. adapter טהור מחזיר עד שלושה focus items שנבחרו במפורש; אין דירוג או בחירה אוטומטית סמויה.
2. כל item נושא symbol, instrumentType, last, previousClose, changePercent, volume, session, timestamp, capturedAt ומקור; ערכים חסרים נשארים `null`.
3. עד שבסיס Daily Snapshot יעבור מ־`docs/qa/rescue-...` ל־production, ה־adapter והבדיקות יכולים להישלח עצמאית אך אין לחבר import לקובצי prototype.
4. לאחר נחיתת בסיס production, יעד חיבור מוצע: `src/components/tradingbrain/DailySnapshot.jsx` או הנתיב שייקבע ב־commit של הבסיס, עם section אופציונלי בלבד.
5. נעילת יום מעתיקה snapshot נבחר לתוך payload הקנוני של היום; היא אינה משאירה reference ל־cache המשתנה.
6. שמירה ל־Workspace תיעשה רק יחד עם renderer תואם ב־`StructuredSnapshotView.jsx`, באמצעות שדה אופציונלי `preMarketSnapshot`; readers ישנים מתעלמים ממנו. אין ליצור item type יתום.
7. אם מודל היום עדיין משתמש ישירות ב־localStorage, שלב החיבור יחכה למעבר facade מאושר או ישתמש ב־store הייעודי בלבד; אין להרחיב חוב טכני.

## 8. שלבי מימוש בגודל commit

כל שלב additive, ניתן לביטול בפני עצמו ושומר על callers ונתונים קיימים. לפני כל commit נדרש diff ממוקד ואישור המשתמש לפי מדיניות הפרויקט.

### שלב 1 — חוזה, parser ו־selectors

- Owner: `decision-signal-engineer`
- קבצים: `src/lib/preMarket/preMarketQuoteModel.js`, `src/lib/preMarket/parsePreMarketPaste.js`, `src/lib/preMarket/preMarketSelectors.js`, `scripts/premarket-parser-qa.mjs`, `package.json`.
- מסירה: parser ל־CSV/TSV/clipboard, schema v1, מיפוי aliases ו־join מדויק.
- קריטריוני קבלה:
  1. fixtures של equity ושל ES/NQ/YM/RTY מנורמלים לאותו חוזה.
  2. ערך חסר/פסול חוזר `null`; אפס נשמר.
  3. כפילויות ושורה בלי symbol נדחות ב־preview עם סיבה.
  4. `changePercent` מחושב רק בתנאים שהוגדרו.
  5. selectors אינם תלויים ב־React, storage או provider.
  6. `npm run test:premarket` עובר.

### שלב 2 — cache דרך storage facade

- Owner: `persistence-storage-engineer`
- קבצים: `src/lib/persistence/preMarketSnapshotStore.js`, `src/hooks/usePreMarketSnapshot.js`, `scripts/premarket-storage-qa.mjs`, `package.json`.
- מסירה: טעינה/שמירה של latest snapshot עם read-back ו־last-known-good.
- קריטריוני קבלה:
  1. אין `localStorage` ישיר בקבצים החדשים.
  2. המפתח נמצא תחת prefix קיים ואין שינוי ב־storage manifest המוגן.
  3. round trip שומר `null`, 0 ו־ISO timestamp ללא שינוי סמנטי.
  4. payload לא תקין או כישלון write אינם מחליפים snapshot תקין.
  5. stale נגזר מ־`capturedAt` ונבדק בשעון מוזרק.
  6. QA parser + persistence עובר.

### שלב 3 — מסך, ניווט ושימוש חוזר ב־UI

- Owner: `frontend-rtl-developer`
- קבצים: `src/pages/PreMarket.jsx`, `src/pages.config.js`, `src/components/layout/AppSidebar.jsx`, הרחבות נקודתיות ב־`src/components/dashboard/MorningBriefMarketsTable.jsx` וב־`src/components/dashboard/MorningBriefPanels.jsx`.
- מסירה: route top-level, paste preview, טבלת futures וטבלת equities בעברית RTL.
- קריטריוני קבלה:
  1. המסך נגיש מה־sidebar וחזרה למסכים קיימים אינה מאבדת state.
  2. אין table/pill/link component מקביל חדש.
  3. callers קיימים של שתי הטבלאות נראים ומתנהגים כפי שהתנהגו לפני השינוי.
  4. `null` מוצג ״לא זמין״ ולא כ־0/נייטרלי.
  5. Finviz-first/fallback ו־futures registry משמשים בפועל.
  6. 1440px ו־390px עוברים בדיקת RTL ללא document overflow.
  7. `npm run test:saved-market-rows`, `npm run test:saved-stock-rows`, `npm run test:premarket` ו־`npm run build` עוברים.

### שלב 4 — אינטגרציית מניות שהוזכרו ושמירת Workspace

- Owner: `frontend-rtl-developer`
- קבצים: הרחבה נקודתית ב־`src/components/dashboard/MorningBriefPanels.jsx`, `src/utils/structuredSnapshot.js`, `src/components/workspace/StructuredSnapshotView.jsx`, ובדיקות ב־`scripts/structured-snapshot-qa.mjs` או סקריפט premarket קיים.
- מסירה: filter מדויק למניות שהוזכרו ו־snapshot אופציונלי שניתן לפתוח מחדש ב־Workspace.
- קריטריוני קבלה:
  1. join מדויק בלבד; A אינו מתאים ל־AA ואין התאמה לפי טקסט חופשי.
  2. מניה שהוזכרה ללא quote מוצגת עם `null` ולא נעלמת.
  3. שמירה וטעינה מחדש מציגות אותו snapshot, source ו־capturedAt.
  4. payload ישן ללא `preMarketSnapshot` ממשיך להיפתח ללא migration.
  5. אין item type ללא renderer ואין localStorage ישיר.
  6. `npm run test:structured-snapshot` וכל בדיקות premarket עוברות.

### שלב 5A — חוזה Daily Snapshot עצמאי

- Owner: `decision-signal-engineer`
- קבצים: `src/lib/preMarket/selectPreMarketDailySnapshotFocus.js` ובדיקות בתוך `scripts/premarket-parser-qa.mjs`.
- מסירה: adapter טהור לעד שלושה נכסים שנבחרו ידנית, ללא תלות ב־prototype.
- קריטריוני קבלה:
  1. 0–3 selections נשמרים בסדר בחירת המשתמש.
  2. בחירה כפולה נדחית ו־4+ פריטים מחזירים שגיאת validation ברורה.
  3. כל ה־nulls, session וחותמות הזמן נשמרים.
  4. אין import מ־`docs/qa/rescue-*`.
  5. בדיקות premarket עוברות גם כאשר אין Daily Snapshot production.

### שלב 5B — חיבור למסך Daily Snapshot לאחר נחיתת הבסיס

- Owner: `frontend-rtl-developer`
- Reviewer חובה: `architect-reviewer`; בדיקת secrets/config: `security-secrets-auditor`; שער שחרור: `qa-release-reviewer`.
- קבצים: נתיב ה־Daily Snapshot production שייקבע, ה־persistence facade הקנוני שלו ובדיקת QA ייעודית. אין לערוך את קובצי rescue/prototype כמימוש production.
- מסירה: section אופציונלי שמקבל את adapter output וננעל כעותק בתוך היום.
- קריטריוני קבלה:
  1. המסך היומי עובד ללא premarket payload בדיוק כפי שעבד קודם.
  2. snapshot נעול אינו משתנה לאחר paste חדש במסך פרה־מרקט.
  3. refresh/reload מחזיר את אותו snapshot נעול דרך facade.
  4. אין direct localStorage חדש ואין secret בצד client.
  5. כל בדיקות premarket, snapshot, workspace וה־build עוברות.

## 9. רשימת QA ידנית

1. לפתוח את האפליקציה ולוודא שב־sidebar מופיע ״פרה־מרקט״ ושכל פריטי הניווט הקיימים עדיין פועלים.
2. לפתוח את המסך ללא cache ולוודא שמוצג empty state בעברית ולא ערכי 0 מומצאים.
3. להדביק TSV תקין עם ES, NQ, YM, RTY ושתי מניות; לוודא preview לפני שמירה.
4. לוודא שמספרים עם פסיקים, אחוזים, timestamps ושמות headers נתמכים מנורמלים נכון.
5. להדביק `0` אמיתי ולוודא שהוא נשמר; להדביק ריק, `—`, `N/A` וטקסט פסול ולוודא שמוצג ״לא זמין״.
6. להדביק symbol כפול ושורה בלי symbol; לוודא שהשמירה חסומה ושכל שגיאה מצביעה על השורה.
7. לאשר snapshot תקין, לבצע refresh ולוודא שכל הנתונים, המקור והזמן חזרו.
8. לנסות לשמור payload פסול אחרי snapshot תקין ולוודא שהגרסה התקינה האחרונה נשארה.
9. לשנות את זמן fixture מעבר לסף freshness ולוודא badge ״נתונים ישנים״ בלי מחיקת נתונים.
10. לבדוק שמניה נפתחת ב־Finviz, ואם אין התאמה — ב־`il.investing.com` לפי resolver; לבדוק שחוזה נפתח דרך registry בלבד.
11. לבדוק שמניה חיובית/אפס/שלילית מקבלת pill נכון ושערך חסר אינו נספר כנייטרלי.
12. לטעון Morning Brief עם A ו־AA ולוודא שה־join מחזיר רק התאמות exact.
13. לעבור בין ״כל המניות״ ל־״מניות שהוזכרו״ ולוודא ששורות שאינן מוזכרות אינן חודרות למסנן.
14. לשמור ל־Workspace, לבצע reload ולפתוח מחדש; לוודא snapshot זהה ותאימות לפריטי Workspace ישנים.
15. לאחר שלב 5B, לבחור עד שלושה נכסים ל־Daily Snapshot, לנעול את היום, לעדכן cache ולוודא שהיום הנעול לא השתנה.
16. לבדוק RTL ב־1440px וב־390px: אין overflow למסמך, header נשאר קריא, הטבלה בלבד נגללת אם נדרש, וסימולים/מספרים מוצגים LTR.
17. להפעיל dark/light mode ולוודא contrast, focus keyboard ו־labels נגישים ל־paste dialog ולכפתורים.
18. לבצע smoke test למסך Morning Brief הקיים ולוודא שטבלאות השוק והמניות לא השתנו כאשר props החדשים אינם מסופקים.

## 10. סיכונים והפחתה

| סיכון | הפחתה |
|---|---|
| נתון ידני ישן או שגוי | preview, מקור, capturedAt, stale badge ואישור מפורש |
| בלבול בין equity pre-market ל־futures overnight | enum session נפרד ותוויות שונות; futures previous close מוצג כ״סגירה/סליקה קודמת״ |
| DST בין ישראל ל־ET | שמירה ב־UTC והמרת תצוגה בספריית הזמן שכבר בפרויקט/דפדפן, בלי offset קשיח |
| ערך חסר הופך ל־0 או נייטרלי | null contract, assertions ו־UI ״לא זמין״ |
| alias של חוזה משתנה לפי ספק/front month | canonical ES/NQ/YM/RTY ומפת provider aliases נפרדת, ניתנת להחלפה |
| הפרת תנאי שימוש | אין scraping; המשתמש מצהיר/בוחר מקור מורשה; source metadata נשמר |
| key נחשף ב־client בעתיד | provider API עתידי רק דרך backend/secret; security review לפני הפעלה |
| כתיבה מתנגשת בשינויים הקיימים | תיאום בעלות ובדיקת diff לפני עריכת שני קובצי MorningBrief המסומנים modified |
| שינוי storage manifest מוגן | שימוש ב־prefix קיים וב־facade; כל שינוי allowlist דורש אישור נפרד |
| Daily Snapshot עדיין prototype | adapter עצמאי תחילה; wiring רק לאחר נתיב production קנוני |
| snapshot יומי משתנה אחרי עדכון cache | copy-on-lock ולא reference ל־current cache |
| regression במובייל/RTL | שימוש ברכיבי layout קיימים ו־QA ב־390px/1440px |

## 11. Rollback

- כל phase יישמר ב־commit נפרד ורק לאחר אישור; rollback יתבצע, אם יאושר, בסדר הפוך 5B → 1.
- הסרת route/sidebar משביתה את המסך בלי לשנות callers ישנים, משום שכל props וה־snapshot fields החדשים אופציונליים.
- הורדת adapter או renderer אינה מוחקת cache או פריטי Workspace. נתונים קיימים נשארים inert וניתנים לקריאה מחדש אם הפיצ'ר מוחזר.
- אין למחוק cache, Workspace items או snapshots יומיים כחלק מ־rollback ללא הרשאה מפורשת.
- אם phase נכשל לפני commit, מחזירים רק את diff של אותו phase לאחר בדיקת בעלות; אין reset/clean רחב.

## 12. הנחות

- הנחה: השימוש הוא אישי ולא מסחרי, והמשתמש ידביק רק נתונים שיש לו זכות לצפות בהם ולשמור אותם.
- הנחה: equities pre-market פירושו 04:00–09:30 ET; futures מסומנים `overnight_futures` ולא כ־equity pre-market.
- הנחה: סט החוזים הראשוני הוא ES, NQ, YM ו־RTY.
- הנחה: נתון ללא timestamp חוקי נשמר עם `timestamp: null` ואינו מקבל זמן quote מומצא; `capturedAt` הוא זמן הקליטה בלבד.
- הנחה: אין background refresh ב־v1; כל עדכון הוא paste ואישור מפורשים.
- הנחה: בסיס Daily Snapshot production טרם קיים; שלב 5B תלוי בנחיתתו ובנתיב שייקבע בו.
- הנחה: השינויים הלא שמורים בקובצי MorningBrief שייכים לעבודה מקבילה ויתואמו לפני מימוש.

## Review round 1 — responses

פרויקט: prototype-tradingbrain-research (worktree של youtube-mentor-dashboard, ענף prototype/tradingbrain-research-mockup-replica)
WORK-ID: PROTOTYPE-PREMARKET-PANEL-REVIEW
שם משימה: בדיקת תוכנית מסך פרה מרקט

1. **ACCEPT — מיקום מסמך התוכנית.** המסמך נמצא ב־`C:\Users\11\Desktop\Workspace\new-project\projects\youtube-mentor-dashboard\docs\plan\PLAN-TRADINGBRAIN-PREMARKET-PANEL.md`, ב־worktree הראשי, ומצבו `untracked` ולא ignored.
   הוא צריך לעבור, בשלב כתיבה מאושר נפרד, אל `C:\Users\11\Desktop\Workspace\new-project\projects\youtube-mentor-dashboard\.claude\worktrees\tradingbrain-research-mockup-replica\prototype-tradingbrain-research\docs\plan\PLAN-TRADINGBRAIN-PREMARKET-PANEL.md`; ב־review הזה הוא לא הועבר.

2. **ACCEPT — reference מוקלד לפי סוג נכס.** במקום `previousClose` יוגדרו `referencePrice: number|null` ו־`referenceType: previous_close|previous_settlement|null`.
   ה־UI יציג ״סגירה קודמת״ ל־equity ו״סליקה קודמת״ ל־index future; reference לא תואם לסוג הנכס ייפסל ולא יקבל label מנחש.

3. **ACCEPT — ספי stale מפורשים.** הספים יהיו: `pre_market=5`, `regular=2`, `post_market=10`, `overnight_futures=5`, ו־`closed=1440` דקות רק ביום שבו צפויה פתיחה; ב־weekend/holiday מאומת השעון מושהה ומוצג ״השוק סגור״.
   כל timestamp נשמר ב־UTC ISO-8601 ומוצג במקביל כ־ET (`America/New_York`) וכשעון ישראל (`Asia/Jerusalem`), ללא offset קשיח.

4. **ACCEPT — זיהוי session.** בימי מסחר בארה״ב: equities הם pre-market ב־04:00–09:30 ET, regular ב־09:30–16:00, after-hours ב־16:00–20:00, וסגור מחוץ לטווחים; futures פתוחים מיום א׳ 18:00 עד יום ו׳ 17:00 ET, עם maintenance יומי 17:00–18:00.
   weekend וחג אמריקאי מאומת הם `closed`; אם רשימת החגים אינה זמינה, מוחזר `unknown` ומוצגת אזהרת ״לוח החגים לא אומת״ במקום להסיק שהשוק פתוח.

5. **ACCEPT — פער ביחס לטווח יומי.** טבלת המניות שהוזכרו תציג `Gap / ATR` כ־`(last-referencePrice)/atr14Daily`, למשל `+0.34× ATR`, ללא הפיכתו לאות החלטה.
   הקלט הנדרש הוא ATR(14) יומי מהסשן הרגיל האחרון, באותו מטבע ועל בסיס מחירים מתואמי split; בהיעדרו יוצג ״לא זמין · ATR חסר״.

6. **ALTERNATIVE — לא להציג נפח גולמי כמדד מרכזי.** `volume` יישמר במודל, אך עמודת v1 תוסתר כברירת מחדל; כאשר קיים baseline תוצג `נפח יחסי לפרה־מרקט · 20 ימים` באותה דקת session.
   אם מציגים raw לצורכי audit בלבד, הכותרת תהיה ״נפח גולמי · ללא בסיס השוואה״ ולא יוצמד לו tone חיובי או שלילי.

7. **ACCEPT — בחירת merge מפורשת.** ב־preview המשתמש יבחר בין ״החלפת snapshot״, שהיא ברירת המחדל, לבין ״מיזוג לפי סימול״; duplicate בתוך אותה הדבקה נשאר שגיאה.
   במיזוג, שורה תקינה חדשה היא last-write-wins לסימול בלבד ושאר הסימולים הישנים נשמרים ומסומנים בזמן המקורי; בהחלפה, סימולים שאינם בהדבקה החדשה מוסרים מה־current snapshot אך לא מהיסטוריה נעולה.

8. **ACCEPT — provenance בתוך הנרמול.** לכל quote יתווסף `source` עם `kind`, `provider`, `providerSymbol` ו־`receivedAt`, וה־component יקבל תמיד quote מנורמל ללא תלות אם הגיע מ־paste או מ־adapter עתידי.
   Yahoo הוא endpoint לא רשמי וללא SLA, עלול להשתנות או להיחסם ב־CORS/auth, ותנאי הרישוי מגבילים automation ושימוש בנתונים; הוא אינו מאושר כמקור production במסגרת שינוי זה.

9. **ACCEPT — CSS גלובלי רק באב־הטיפוס.** לפני מעבר לאפליקציית האם יש להחליף ל־`PreMarketPanel.module.css` או לעטוף כל selector תחת root ייחודי כגון `[data-feature=premarket-panel]`.
   שמות `premarket-*` המוצעים אינם מתנגשים כעת, אך שימוש ב־`.card`, `.button`, `.source-bar` ו־`.tag` הוא coupling מכוון ל־prototype ועלול להתנגש או להשתנות ב־parent app.

10. **ACCEPT — canonicalization מוגדר.** מסירים whitespace חיצוני ו־`$` מוביל, ממירים ל־uppercase, דוחים whitespace פנימי, ומשווים רק ערך קנוני מלא.
    וריאציות share class ממופות באמצעות registry מאושר, למשל `BRK-B` ו־`BRK.B` אל `BRK.B`, בלי החלפה גורפת של כל מקף; לכן `A` לעולם אינו מתאים ל־`AA`.

### השפעה על קבצים ועל חוזה הנתונים

- שינוי ברשימת הקבצים: פריט 1 מעביר את מסמך התוכנית ל־worktree הנכון; פריט 9 מחליף את `premarket.css` ב־CSS module בעת החיבור ל־parent. פריט 8 עשוי להוסיף בעתיד adapter נפרד, אך לא במסגרת review זה.
- שינוי ב־`preMarket.js` או בחוזה הנתונים: פריטים 2, 3, 4, 5, 7, 8 ו־10. פריט 6 משאיר את `volume` בחוזה ומשנה את ברירת המחדל של התצוגה בלבד.
- display-only: פריטים 6 ו־9; בנוסף, ה־labels בפריט 2, תצוגת שני אזורי הזמן בפריט 3, הודעות `closed/unknown` בפריט 4 ועמודת Gap/ATR בפריט 5 הם חלקי UI של שינוי רחב יותר.

### רשימת הכרעות

1. מיקום מסמך התוכנית — ACCEPT
2. reference לפי סוג נכס — ACCEPT
3. סף stale ואזורי זמן — ACCEPT
4. כללי session — ACCEPT
5. Gap / ATR — ACCEPT
6. משמעות נפח פרה־מרקט — ALTERNATIVE
7. merge בין הדבקות — ACCEPT
8. source ו־adapter עתידי — ACCEPT
9. scoping של CSS — ACCEPT
10. canonicalization של סימולים — ACCEPT

הנחה: לוח חגים production עתידי יספק סטטוס מסחר מוסמך; עד אז כל יום חג שאינו ניתן לאימות יסומן `unknown` ולא `closed` או `regular`.

אישור: לא שונה קוד, לא בוצע staging, ולא בוצע commit; השינוי היחיד הוא צירוף section זה למסמך התוכנית הקיים בהתאם להרשאה המפורשת.

פרויקט: prototype-tradingbrain-research (worktree של youtube-mentor-dashboard, ענף prototype/tradingbrain-research-mockup-replica)
WORK-ID: PROTOTYPE-PREMARKET-PANEL-REVIEW
שם משימה: בדיקת תוכנית מסך פרה מרקט
