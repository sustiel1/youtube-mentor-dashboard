/**
 * Discovers app feature opportunities from macro / video analysis JSON.
 * Pure client-side — no AI, no GEM, no API calls.
 * Quality over quantity: low-confidence ideas are dropped.
 *
 * Each idea carries:
 *   titleHe — primary display (Hebrew)
 *   titleEn — technical name (English, for dev tools / GEM)
 *   valueDescription — one-sentence value proposition (Hebrew, outcome-focused)
 */

export const FEATURE_CATEGORIES = [
  'Scanner',
  'Dashboard',
  'Tracker',
  'Analytics',
  'Alert System',
  'Watchlist',
  'Index',
  'Matrix',
];

/** Hebrew display labels for category IDs (English enums stay internal). */
export const FEATURE_CATEGORY_LABELS_HE = {
  Scanner: 'סורק',
  Watchlist: 'רשימת מעקב',
  Matrix: 'מטריצה',
  'Alert System': 'מערכת התראות',
  Tracker: 'מעקב',
  Dashboard: 'דשבורד',
  Index: 'מדד',
  Analytics: 'אנליטיקה',
  'Signal Engine': 'מנוע איתותים',
  'Breakout Scanner': 'סורק פריצות',
  'Momentum Scanner': 'סורק מומנטום',
};

/** Returns Hebrew label for UI; unknown categories fall back to English id. */
export function getCategoryDisplayLabel(category) {
  const key = s(category);
  if (!key) return '';
  return FEATURE_CATEGORY_LABELS_HE[key] || key;
}

const MIN_CONFIDENCE = 0.65;
const MIN_APP_FIT = 6;
const HEBREW_RE = /[\u0590-\u05FF]/;

/** Canonical Hebrew ↔ English name pairs */
const KNOWN_NAMES = {
  'XBI Momentum Scanner': { he: 'סורק מומנטום ביוטק', en: 'XBI Momentum Scanner' },
  'Real Estate Stress Index': { he: 'מדד לחץ נדל״ן ישראלי', en: 'Real Estate Stress Index' },
  'Tech Leaders Tracker': { he: 'מעקב מניות טכנולוגיה מובילות', en: 'Tech Leaders Tracker' },
  'Financials Sector Tracker': { he: 'מעקב סקטור פיננסים', en: 'Financials Sector Tracker' },
  'Consumer Pressure Index': { he: 'מדד לחץ צרכני', en: 'Consumer Pressure Index' },
  'Fed Reform Tracker': { he: 'מעקב רפורמות הפד', en: 'Fed Reform Tracker' },
  'Fed Rate Decision Tracker': { he: 'מעקב החלטות ריבית הפד', en: 'Fed Rate Decision Tracker' },
  'Fed Communication Analyzer': { he: 'מנתח תקשורת הפד', en: 'Fed Communication Analyzer' },
  'Fed Balance Sheet Tracker': { he: 'מעקב מאזן הפד', en: 'Fed Balance Sheet Tracker' },
  'Fed Policy Tracker': { he: 'מעקב מדיניות הפד', en: 'Fed Policy Tracker' },
  'Dot Plot Analyzer': { he: 'מנתח Dot Plot', en: 'Dot Plot Analyzer' },
  'Employment & AI Index': { he: 'מדד תעסוקה ו-AI', en: 'Employment & AI Index' },
  'Support Level Watchlist': { he: 'מעקב רמות תמיכה', en: 'Support Level Watchlist' },
  'Sector Impact Matrix': { he: 'מטריצת השפעה סקטוריאלית', en: 'Sector Impact Matrix' },
  'Macro Risk Alert System': { he: 'מערכת התראות סיכון מאקרו', en: 'Macro Risk Alert System' },
  'Market Opportunity Scanner': { he: 'סורק הזדמנויות שוק', en: 'Market Opportunity Scanner' },
  'Insight-Driven Feature': { he: 'פיצ׳ר מתובנת וידאו', en: 'Insight-Driven Feature' },
};

/** Short Hebrew value proposition keyed by English technical name (12–25 words, outcome-focused) */
const VALUE_DESCRIPTION_HE = {
  'XBI Momentum Scanner': 'מזהה מובילי ביוטק עולים לפני שהשוק מגלים אותם, כדי שתוכלו להיכנס מוקדם יותר מהמגה.',
  'Support Level Watchlist': 'עוזר להגיב מהר יותר כשמחיר בודק, שובר או חוזר לרמות קריטיות שציין המנטור בסרטון.',
  'Real Estate Stress Index': 'נותן אזהרה מוקדמת לחולשה בשוק הנדל״ן לפני שהירידות במחירים הופכות לגלויות לכולם.',
  'Fed Reform Tracker': 'מאפשר לזהות שינויי מדיניות של הפד שמשפיעים על התיק לפני שהשוק מתמחר אותם.',
  'Tech Leaders Tracker': 'מדגיש חוזק וחולשה במניות הטכנולוגיה המובילות שמובילות לרוב את כיוון השוק הכללי.',
  'Financials Sector Tracker': 'חושף איך שינויי ריבית משפיעים על סקטור הפיננסים לפני שזה משתקף במחירי המניות.',
  'Consumer Pressure Index': 'מאתר סימנים מוקדמים להאטה בצרכנות לפני שהיא פוגעת ברווחי חברות הקמעונאות והשירותים.',
  'Fed Rate Decision Tracker': 'עוזר לכוון פוזיציות מיד אחרי החלטות ריבית, במקום לפספס את המהלך הראשון של השוק.',
  'Fed Communication Analyzer': 'חושף שינויי טון בהודעות הפד שמניעים תנועות בשוק, בלי לקרוא כל נאום ודוח באורך מלא.',
  'Fed Balance Sheet Tracker': 'מראה מתי נזילות בשוק משתנה בגלל מאזן הפד, לפני שההשפעה מגיעה למחירי הנכסים.',
  'Fed Policy Tracker': 'מאחד את כל אותות מדיניות הפד לתמונה אחת שמסייעת להחליט על הקצאת תיק מהירה יותר.',
  'Dot Plot Analyzer': 'מסביר במהירות אם תחזיות הריבית של הפד השתנו, כדי שלא תתמקמו נגד כיוון המדיניות החדש.',
  'Employment & AI Index': 'מאזן בין חוזק שוק העבודה לבין לחץ AI על תעסוקה, לפני שהשוק בוחר כיוון אחד בלבד.',
  'Sector Impact Matrix': 'מראה בתוך שניות אילו סקטורים מרוויחים או מפסידים מהמדיניות הנוכחית, לצורך הקצאה מהירה.',
  'Macro Risk Alert System': 'מרכז את אזהרות המאקרו החשובות במקום אחד, כדי שלא ייעלמו בתוך מחקר ארוך או עומס יומי.',
  'Market Opportunity Scanner': 'הופך רעיונות מסחר מהסרטון לרשימת פעולה, במקום להשאיר אותם כהערות שקל לשכוח.',
  'Biotech Stress Index': 'מאותת על לחץ בביוטק לפני שהמניות החלשות מושכות את כל הסקטור מטה איתן.',
  'Consumer Stress Index': 'מזהה חולשה בצרכנות מוקדם, לפני שהיא מתבטאת בירידות ברווחים ובמחירי מניות הקמעונאות.',
  'Insight-Driven Feature': 'הופך תובנה ספציפית מהסרטון לכלי שימושי שחוסך זמן בכל יום מסחר חוזר.',
};

const CATEGORY_VALUE_DESCRIPTION_HE = {
  Scanner: 'מאתר מועמדים חזקים לפני שהם בולטים בשוק, כדי שלא תפספסו את המהלך המוקדם.',
  Watchlist: 'שולח התראה בזמן כשמחיר מגיע לרמה שחשובה לכם, בלי לעקוב ידנית אחרי כל גרף.',
  Matrix: 'מראה בתוך שניות אילו סקטורים מרוויחים או מפסידים מהמדיניות הנוכחית, לצורך הקצאה מהירה.',
  'Alert System': 'מרכז את האזהרות החשובות במקום אחד כדי שלא תפספסו סיכון שמסתתר במחקר ארוך.',
  Tracker: 'עוזר לזהות שינוי מגמה או מדיניות בזמן, לפני שהשוק מתמחר את ההפתעה.',
  Dashboard: 'הופך תובנות מסרטון למסך מעקב יומי שחוסך זמן ומונע החמצת מהלך חשוב.',
  Index: 'מאחד אותות מפוזרים לציון אחד שמאותת על לחץ או הזדמנות לפני תגובת השוק.',
  Analytics: 'מסביר במהירות מה משמעות הנתונים לפוזיציה שלכם, בלי לקרוא דוחות ארוכים.',
};

/** Per-feature builder profiles — structured sections for AI agents */
const BUILDER_PROFILES = {
  'XBI Momentum Scanner': {
    monitor: 'XBI constituent biotech stocks for relative strength, volume expansion, breakout proximity and trend acceleration',
    store: 'scan snapshots, momentum scores, symbol metadata, alert rules and user watchlists',
    display: 'sortable momentum rankings, breakout charts, top movers cards and alert status',
    alertWhen: 'a symbol crosses momentum threshold, volume spikes or breaks a defined resistance level',
    filterBy: 'market cap, volume, momentum score, sector tag and technical strength',
    dataInputs: ['XBI ETF holdings or biotech symbol universe', 'Daily and intraday OHLCV price feeds', 'Relative strength vs SPY/QQQ', 'Volume averages and breakout levels', 'User-defined watchlists'],
    userProblem: 'Traders miss biotech momentum moves because XBI constituents are scattered across tools and manual scanning is slow.',
    targetUsers: 'Biotech-focused swing traders, momentum scanners, and active investors tracking the XBI basket.',
    businessValue: 'Surfaces actionable biotech momentum candidates early and reduces time spent manually screening dozens of symbols.',
    mvp: 'Daily scan table with momentum score, volume flag, mini chart and one-click watchlist add; basic email/in-app alert on breakout.',
    phase2: 'Intraday refresh, custom scoring weights, backtest view and sector peer comparison.',
    phase3: 'Portfolio overlay, options liquidity hints, API export and multi-basket templates.',
    rankingLogic: 'Momentum score 0–100 per XBI constituent: RS vs XBI/SPY 40%, volume vs 20d avg 30%, distance to 20d high (breakout) 20%, price above 50d MA 10%. Table sorted by score desc.',
  },
  'Real Estate Stress Index': {
    monitor: 'Israeli real estate stress via inventory, sales velocity, mortgage activity and developer pressure proxies',
    store: 'stress component values, composite index history, threshold configs and alert logs',
    display: 'composite stress gauge, component breakdown, trend history chart and regional comparison',
    alertWhen: 'composite stress exceeds user threshold or a component deteriorates sharply week-over-week',
    filterBy: 'region, property type, stress component, date range and severity band',
    dataInputs: ['Housing inventory and transaction volume series', 'Mortgage origination or rate proxy data', 'Developer debt or project pipeline indicators', 'Historical stress index calculations', 'Video-derived macro context tags'],
    userProblem: 'Investors lack a single view of real-estate market stress and discover weakness too late.',
    targetUsers: 'Real-estate investors, macro traders, and analysts monitoring Israeli property risk.',
    businessValue: 'Compresses fragmented housing signals into one actionable stress score with alertable thresholds.',
    mvp: 'Manual or CSV-fed metrics, composite score, trend line and threshold alert.',
    phase2: 'Automated data connectors, regional drill-down and peer market comparison.',
    phase3: 'Predictive stress modeling, developer watchlists and report export for research notes.',
    rankingLogic: 'Stress composite 0–100: inventory pressure 30%, sales velocity 25%, mortgage activity proxy 25%, developer pipeline stress 20%. Bands: 0–33 low, 34–66 medium, 67+ high.',
  },
  'Support Level Watchlist': {
    monitor: 'user-defined symbols against support and resistance levels extracted from video analysis',
    store: 'symbols, price levels, level source notes, alert preferences and break event history',
    display: 'watchlist table, mini price charts, level editor and active alert panel',
    alertWhen: 'price breaks below support or above resistance by a configurable buffer',
    filterBy: 'symbol, distance to level, alert status, sector and time since last break',
    dataInputs: ['Live or delayed equity price quotes', 'Support/resistance levels from analysis', 'Symbol metadata and sector tags', 'User watchlist and alert preferences'],
    userProblem: 'Traders forget key levels mentioned in research and miss breaks without continuous manual chart checks.',
    targetUsers: 'Technical traders, swing traders and investors maintaining active level-based watchlists.',
    businessValue: 'Automates level monitoring and delivers timely break alerts tied to research-backed prices.',
    mvp: 'Watchlist CRUD, level fields per symbol, price compare job and break notifications.',
    phase2: 'Multi-timeframe levels, chart overlay UI and bulk import from video notes.',
    phase3: 'Broker integration, options strike context and shared team watchlists.',
    alertLogic: 'Poll quotes every 1–5 min. Fire when price ≤ support×(1−buffer) or ≥ resistance×(1+buffer). Alert body includes symbol, level, sourceRef from video. 15 min cooldown per symbol/direction.',
  },
  'Fed Reform Tracker': {
    monitor: 'Fed governance reforms, committee changes, policy rule updates and official announcements',
    store: 'events timeline, document links, reform milestones, impact tags and user subscriptions',
    display: 'reform timeline, announcement feed, committee tracker and sector impact matrix',
    alertWhen: 'a new reform milestone is published or a tracked committee change is confirmed',
    filterBy: 'reform topic, committee, date range, impact severity and asset class',
    dataInputs: ['Fed official announcements and press releases', 'FOMC meeting calendar', 'Policy document metadata', 'Sector impact tags from macro analysis'],
    userProblem: 'Macro traders struggle to track Fed structural reforms across scattered official sources.',
    targetUsers: 'Macro investors, rates traders, policy researchers and financial media analysts.',
    businessValue: 'Centralizes reform milestones and links them to tradable sector implications.',
    mvp: 'Curated event feed, timeline view, manual tagging and email alert on new items.',
    phase2: 'NLP summarization, auto sector tagging and calendar sync.',
    phase3: 'Historical reform playbook library and cross-central-bank comparison.',
  },
  'Tech Leaders Tracker': {
    monitor: 'leading technology stocks for trend, relative strength, volume posture and moving-average alignment',
    store: 'symbol rankings, trend scores, sparkline cache, filters and watchlist links',
    display: 'ranked leaders table, sparkline charts, sector filter bar and quick actions',
    alertWhen: 'a leader loses trend status, breaks a key MA or hits relative-strength extreme',
    filterBy: 'market cap, momentum rank, sector, volume and distance from 52-week high',
    dataInputs: ['Mega-cap tech symbol list', 'Daily OHLCV and volume', 'Relative strength vs QQQ/SPY', 'Moving averages and trend flags'],
    userProblem: 'It is hard to see which tech leaders are strengthening or weakening without building custom screens.',
    targetUsers: 'Growth investors, tech sector traders and portfolio managers watching Mag 7-style names.',
    businessValue: 'Provides a focused leaderboard of tech leadership shifts for faster allocation decisions.',
    mvp: 'Ranked table with trend badge, sparkline and watchlist add.',
    phase2: 'Custom universes, RS history and earnings-date overlays.',
    phase3: 'Factor attribution, pair-trade suggestions and API for dashboard embed.',
  },
  'Financials Sector Tracker': {
    monitor: 'financial sector stocks and ETFs for yield sensitivity, relative strength and rate-driven moves',
    store: 'sector rankings, yield spread snapshots, alert rules and historical sector performance',
    display: 'sector heatmap, yield spread widget, movers list and alert configuration',
    alertWhen: 'yield spread widens beyond threshold or a financial sub-sector loses relative strength',
    filterBy: 'sub-sector, market cap, yield spread band, RS rank and date',
    dataInputs: ['XLF or bank stock universe', 'Treasury yield and spread series', 'Sector RS vs SPY', 'Volume and trend indicators'],
    userProblem: 'Rate-sensitive financial trades require monitoring spreads and sector breadth across many tickers.',
    targetUsers: 'Rates traders, sector rotators and investors overweight financials.',
    businessValue: 'Links macro rate moves to tradable financial sector leadership in one view.',
    mvp: 'Heatmap, spread widget, top movers and basic spread alert.',
    phase2: 'Sub-sector weights, historical replay and earnings calendar overlay.',
    phase3: 'Bank-specific credit stress flags and automated research brief export.',
  },
  'Sector Impact Matrix': {
    monitor: 'sector-level sentiment and performance under current macro policy scenarios',
    store: 'matrix cell values, policy tags, filter presets and comparison snapshots',
    display: 'impact matrix grid, sentiment heatmap, relative strength chart and quick filter bar',
    alertWhen: 'a sector flips sentiment quadrant or policy tag assignment changes',
    filterBy: 'policy scenario, sector, sentiment, time window and impact severity',
    dataInputs: ['Sector list with sentiment from analysis', 'Relative performance vs benchmark', 'Policy/event tags', 'Historical sector snapshots'],
    userProblem: 'Allocators cannot quickly see which sectors win or lose under a macro narrative.',
    targetUsers: 'Macro strategists, sector ETF traders and portfolio allocators.',
    businessValue: 'Turns multi-sector analysis into a scannable decision matrix.',
    mvp: 'Static matrix from analysis data, heatmap colors and CSV export.',
    phase2: 'Live performance refresh, saved scenarios and cell annotations.',
    phase3: 'Stress-test sliders and automated rebalance suggestions.',
    rankingLogic: 'Cell score = sentiment (−1..+1) × 5d RS quintile (1–5). Rank sectors by |score|; flag cells that cross sign vs prior snapshot.',
  },
  'Macro Risk Alert System': {
    monitor: 'active macro and sector warnings with severity scoring',
    store: 'warning feed items, acknowledgment state, mute rules and risk gauge history',
    display: 'warnings feed, risk level gauge, macro dashboard summary and alert banner',
    alertWhen: 'new warning arrives, severity escalates or risk gauge crosses band',
    filterBy: 'severity, category, sector, acknowledgment status and date',
    dataInputs: ['Warning text from video macro analysis', 'Severity and category tags', 'Optional external headline feed', 'User mute and routing preferences'],
    userProblem: 'Critical macro risks are buried in long research and are easy to miss intraday.',
    targetUsers: 'Traders, PMs and macro desks needing a single risk inbox.',
    businessValue: 'Consolidates disparate warnings into prioritized, actionable alerts.',
    mvp: 'Feed from analysis warnings, severity chips, acknowledge button and email alert.',
    phase2: 'Rules engine, digest mode and multi-channel routing.',
    phase3: 'Team queues, SLA tracking and integration with portfolio risk systems.',
    rankingLogic: 'Feed order: severity (critical > high > medium > low), then recency desc. Gauge = 3×critical + 2×high + 1×medium open warnings.',
  },
  'Dot Plot Analyzer': {
    monitor: 'Fed dot plot releases, median path shifts and participant dispersion',
    store: 'dot plot snapshots by meeting, median series, annotations and alert configs',
    display: 'dot plot chart, meeting comparison panel, median trend line and release notes',
    alertWhen: 'median dot plot path shifts by more than a defined number of bps',
    filterBy: 'meeting date, horizon year, participant cohort and median delta',
    dataInputs: ['FOMC dot plot release data', 'Historical median path series', 'Meeting calendar', 'Market-implied rate paths for compare'],
    userProblem: 'Rates traders need fast visual diff across dot plot meetings without manual charting.',
    targetUsers: 'Rates traders, macro strategists and fixed-income analysts.',
    businessValue: 'Speeds interpretation of Fed rate path changes for positioning decisions.',
    mvp: 'Upload or paste plot data, chart view, meeting-to-meeting median compare.',
    phase2: 'Auto-fetch releases, dispersion metrics and market overlay.',
    phase3: 'Scenario library and automated trade idea tagging.',
  },
  'Market Opportunity Scanner': {
    monitor: 'symbols, setups and catalysts referenced in the source video analysis',
    store: 'opportunity rows, setup tags, scan presets and watchlist links',
    display: 'opportunity table, setup tags, momentum filters and watchlist actions',
    alertWhen: 'a scanned symbol matches setup criteria or catalyst date approaches',
    filterBy: 'setup type, sector, momentum, catalyst window and confidence',
    dataInputs: ['Symbols and themes from video opportunities', 'Price and volume feeds', 'Setup tag dictionary', 'User watchlist and alert prefs'],
    userProblem: 'Video research identifies ideas but they are not operationalized into a live scan.',
    targetUsers: 'Retail and pro-sumer traders acting on mentor or macro video research.',
    businessValue: 'Bridges content insights to a repeatable scanning workflow.',
    mvp: 'Table seeded from analysis, basic filters and watchlist add.',
    phase2: 'Live price refresh, scoring model and preset library.',
    phase3: 'Auto-ingest from new videos and shared opportunity boards.',
  },
  'Consumer Pressure Index': {
    monitor: 'consumer-sector stress via spending proxies, retail earnings trends, credit usage and sentiment indicators',
    store: 'index components, composite score history, threshold configs and alert logs',
    display: 'composite pressure gauge, component breakdown chart, sector heatmap and trend timeline',
    alertWhen: 'composite pressure crosses user threshold or a key component deteriorates week-over-week',
    filterBy: 'sub-sector, component type, severity band, date range and region',
    dataInputs: ['Retail sales and consumer spending series', 'Consumer credit and delinquency proxies', 'Retail earnings revision data', 'Sentiment surveys or video-derived macro tags'],
    userProblem: 'Consumer weakness signals are spread across retail data, earnings and macro commentary.',
    targetUsers: 'Sector rotators, consumer ETF traders and macro analysts watching discretionary vs staples.',
    businessValue: 'Summarizes consumer health into one alertable index tied to tradable sector positioning.',
    mvp: 'Manual metric inputs, composite score, trend chart and threshold alert.',
    phase2: 'Auto data refresh, sub-sector drill-down and peer index comparison.',
    phase3: 'Predictive recession flags and portfolio stress overlay.',
  },
  'Fed Rate Decision Tracker': {
    monitor: 'FOMC rate decisions, dot plot shifts, statement language changes and market-implied path',
    store: 'meeting outcomes, rate path history, statement diffs, alert subscriptions and calendar events',
    display: 'decision timeline, rate path chart, statement diff viewer and countdown to next meeting',
    alertWhen: 'a new rate decision is published or implied path shifts beyond threshold',
    filterBy: 'meeting date, rate change magnitude, statement theme and asset-class impact tag',
    dataInputs: ['FOMC meeting calendar and outcomes', 'Federal funds target rate history', 'Statement and press conference text', 'Futures-implied rate path'],
    userProblem: 'Rates positioning requires tracking decisions, language nuance and path changes across meetings.',
    targetUsers: 'Rates traders, fixed-income PMs and macro strategists.',
    businessValue: 'Centralizes FOMC decision context for faster post-meeting positioning.',
    mvp: 'Meeting calendar, outcome log, basic path chart and decision-day alert.',
    phase2: 'Statement NLP diff, dot plot overlay and historical playbook tags.',
    phase3: 'Cross-asset impact scoring and automated trade journal hooks.',
  },
  'Fed Communication Analyzer': {
    monitor: 'Fed speeches, minutes, testimony and press conferences for hawkish/dovish tone shifts',
    store: 'document archive, tone scores, key phrase extractions, speaker metadata and alert rules',
    display: 'communication feed, tone trend chart, phrase cloud and speaker comparison panel',
    alertWhen: 'tone score shifts beyond band or a tracked keyword appears in new communication',
    filterBy: 'speaker, document type, tone direction, date range and topic tag',
    dataInputs: ['Fed speech and minutes text', 'Speaker roster and role metadata', 'NLP tone scoring model', 'Market reaction snapshots optional'],
    userProblem: 'Fed messaging is voluminous and traders miss subtle tone pivots buried in long documents.',
    targetUsers: 'Macro researchers, rates desks and financial journalists.',
    businessValue: 'Surfaces actionable tone shifts without reading every Fed release end-to-end.',
    mvp: 'Curated feed, manual tone tags, keyword alert and summary cards.',
    phase2: 'Automated NLP scoring, diff vs prior release and calendar sync.',
    phase3: 'Multi-central-bank compare and historical tone playbook library.',
  },
  'Fed Balance Sheet Tracker': {
    monitor: 'Fed balance sheet size, QT/QE pace, reserve levels and liquidity facility usage',
    store: 'weekly balance sheet snapshots, component breakdown series, alert thresholds and chart cache',
    display: 'balance sheet trend chart, component stacked area, QT pace gauge and release calendar',
    alertWhen: 'weekly change exceeds threshold or a tracked component accelerates',
    filterBy: 'component type, change magnitude, date range and facility category',
    dataInputs: ['H.4.1 weekly release data', 'Treasury and MBS holdings series', 'Reserve and RRP balances', 'Historical QT/QE benchmarks'],
    userProblem: 'Liquidity traders need timely visibility into balance sheet runoff without parsing Fed releases manually.',
    targetUsers: 'Liquidity-focused macro traders, rates strategists and risk managers.',
    businessValue: 'Links balance sheet dynamics to market liquidity conditions in one dashboard.',
    mvp: 'Weekly data ingest, trend charts, component breakdown and change alert.',
    phase2: 'Intra-cycle projections, cross-asset correlation panel and export.',
    phase3: 'Global central bank balance sheet compare and liquidity stress scoring.',
  },
  'Fed Policy Tracker': {
    monitor: 'broad Fed policy stance across rates, balance sheet, forward guidance and regulatory signals',
    store: 'policy stance score, event timeline, document links, sector tags and user watch rules',
    display: 'policy stance gauge, unified timeline, document feed and sector impact sidebar',
    alertWhen: 'aggregate policy stance shifts or a new high-impact policy event is tagged',
    filterBy: 'policy pillar, stance direction, date range, sector and severity',
    dataInputs: ['Rate, BS and communication events', 'Policy stance scoring rubric', 'Sector impact tags from analysis', 'Official Fed document links'],
    userProblem: 'Fed policy spans multiple channels and investors lack a single stance dashboard.',
    targetUsers: 'Macro PMs, multi-asset strategists and research teams.',
    businessValue: 'Unifies disparate Fed signals into one stance view for allocation decisions.',
    mvp: 'Timeline feed, manual stance tags, gauge widget and email alert.',
    phase2: 'Auto stance scoring, sector matrix link and calendar integration.',
    phase3: 'Historical regime library and automated briefing export.',
  },
  'Employment & AI Index': {
    monitor: 'labor market health alongside AI displacement and productivity signals from macro research',
    store: 'employment components, AI impact proxies, composite index history and alert configs',
    display: 'dual-track gauge (jobs vs AI), component table, trend charts and narrative summary card',
    alertWhen: 'employment weakness accelerates or AI displacement score crosses threshold',
    filterBy: 'component, sector exposure, severity, date range and geography',
    dataInputs: ['Payrolls, claims and JOLTS-style series', 'AI adoption or capex proxies', 'Sector employment weights', 'Video-derived thematic tags'],
    userProblem: 'Investors struggle to weigh traditional jobs data against emerging AI labor disruption themes.',
    targetUsers: 'Macro strategists, thematic investors and labor-sensitive sector traders.',
    businessValue: 'Combines classic employment metrics with AI narrative into one decision index.',
    mvp: 'Manual component inputs, composite score, trend view and threshold alert.',
    phase2: 'Automated feeds, sector exposure map and historical regime tags.',
    phase3: 'Predictive modeling and portfolio sector tilt suggestions.',
  },
};

const CATEGORY_BUILDER_DEFAULTS = {
  Scanner: {
    monitor: 'a defined symbol universe for momentum, breakout and relative-strength signals',
    userProblem: 'Manual scanning across charts and spreadsheets is slow and opportunities are missed.',
    targetUsers: 'Active traders and investors who run daily or weekly setup scans.',
    phase2: 'Custom scan presets, intraday mode and backtest summary.',
    phase3: 'ML ranking, portfolio correlation view and team-shared scan libraries.',
  },
  Watchlist: {
    monitor: 'tracked symbols against price levels, catalysts and user-defined conditions',
    userProblem: 'Maintaining levels and alerts across many symbols in separate tools creates gaps.',
    targetUsers: 'Swing traders and investors with active symbol lists.',
    phase2: 'Chart overlays, multi-level stacks and import from research notes.',
    phase3: 'Broker sync, shared lists and mobile push routing.',
  },
  Tracker: {
    monitor: 'time-series metrics, events and trend shifts for a macro or market theme',
    userProblem: 'Important policy or sector developments are scattered and hard to monitor consistently.',
    targetUsers: 'Macro traders, sector analysts and long-horizon investors.',
    phase2: 'Automated ingestion, annotation and comparison windows.',
    phase3: 'Cross-asset linkage, scenario modeling and export APIs.',
  },
  Matrix: {
    monitor: 'multi-entity relationships across sectors, policies or sentiment dimensions',
    userProblem: 'Comparing many sectors or factors at once requires manual spreadsheets.',
    targetUsers: 'Macro strategists, sector rotators and risk managers.',
    phase2: 'Saved views, cell drill-down and historical matrix replay.',
    phase3: 'Simulation overlays and collaborative annotations.',
  },
  Index: {
    monitor: 'component metrics that roll up into a composite stress or pressure score',
    userProblem: 'Raw indicators are noisy; users need one interpretable score with history.',
    targetUsers: 'Macro investors, sector specialists and risk-focused traders.',
    phase2: 'Weight tuning UI, component drill-down and benchmark compare.',
    phase3: 'Forecast bands, alert playbooks and index API.',
  },
  'Alert System': {
    monitor: 'aggregated macro and market warnings with severity and category tags',
    userProblem: 'Risk signals arrive from many channels and get lost without a command center.',
    targetUsers: 'Traders, portfolio managers and macro desks needing unified risk visibility.',
    phase2: 'Severity rules engine, mute schedules and digest emails.',
    phase3: 'Integration with external news APIs and team escalation workflows.',
  },
  Analytics: {
    monitor: 'complex indicator series and document releases for interpretable analytics',
    userProblem: 'Raw Fed or macro releases require manual interpretation before trading decisions.',
    targetUsers: 'Rates traders, macro researchers and data-driven investors.',
    phase2: 'Release diffing, tone scoring and annotation layers.',
    phase3: 'Multi-indicator dashboards and automated brief generation.',
  },
  Dashboard: {
    monitor: 'key metrics and status cards for a focused market theme',
    userProblem: 'Insights from video research are not operationalized into a live monitoring view.',
    targetUsers: 'Retail and pro-sumer traders building personal market intelligence stacks.',
    phase2: 'Layout editor, widget library and saved dashboards.',
    phase3: 'Multi-user workspaces and embeddable widgets.',
  },
};

/** Per-feature UI layout areas (numbered in brief); actions appended separately */
const FEATURE_UI_LAYOUT = {
  'XBI Momentum Scanner': {
    areas: [
      'Filter Bar — XBI universe, min momentum score, volume and sector filters',
      'Results Table — rank, symbol, momentum score, volume flag, sparkline, alert badge',
      'Detail Panel — breakout chart, RS vs XBI/SPY, video source note on row select',
      'Alert Rules Panel — threshold editor, resistance-break condition, channel toggle',
      'Watchlist Section — quick-add strip for selected symbols',
    ],
    actions: ['Run scan', 'Add to watchlist', 'Create breakout alert'],
  },
  'Support Level Watchlist': {
    areas: [
      'Symbol Search / Add Bar — ticker lookup and bulk import from video notes',
      'Watchlist Table — symbol, support, resistance, distance %, alert state',
      'Mini Chart Panel — price chart with level overlays on row select',
      'Alert Feed — recent breaks, pending notifications, cooldown status',
      'Level Editor Drawer — buffer %, source note, active/inactive toggle',
    ],
    actions: ['Add symbol', 'Edit levels', 'Acknowledge break', 'Mute alert'],
  },
  'Real Estate Stress Index': {
    areas: [
      'Composite Stress Gauge — headline score and severity band',
      'Component Breakdown — inventory, sales velocity, mortgage, developer pressure',
      'Trend History Chart — composite score over selectable window',
      'Regional Comparison Table — sub-market stress readings',
      'Threshold & Alert Panel — band config and recent alert log',
    ],
    actions: ['Set threshold', 'Drill into component', 'Export snapshot'],
  },
  'Tech Leaders Tracker': {
    areas: [
      'Sector Filter Bar — mega-cap preset, RS rank, volume filter',
      'Leaders Table — rank, symbol, trend badge, sparkline, RS vs QQQ',
      'Detail Panel — MA alignment chart and 52-week-high distance',
      'Alert Status Strip — leaders that lost trend or hit RS extreme',
    ],
    actions: ['Add to watchlist', 'Filter by trend', 'Subscribe to status change'],
  },
  'Sector Impact Matrix': {
    areas: [
      'Scenario Filter Bar — policy tag, date window, sector subset',
      'Impact Matrix Grid — heatmap cells (sector × sentiment/performance)',
      'Sector Detail Side Panel — drivers, linked warnings, source insight',
      'Relative Strength Chart — benchmark comparison for selected cell',
    ],
    actions: ['Save view', 'Export CSV', 'Switch scenario'],
  },
  'Macro Risk Alert System': {
    areas: [
      'Risk Gauge Header — aggregate severity score and open-count chips',
      'Filter Bar — severity, category, sector, acknowledgment status',
      'Warnings Feed Table — priority-sorted rows with severity badges',
      'Warning Detail Panel — full text, source link, linked entities',
    ],
    actions: ['Acknowledge', 'Mute category', 'Configure routing'],
  },
  'Dot Plot Analyzer': {
    areas: [
      'Meeting Selector — FOMC release picker and compare toggle',
      'Dot Plot Chart — participant rate paths by horizon year',
      'Median Trend Line — meeting-over-meeting median path overlay',
      'Comparison Panel — prior meeting diff and bps delta summary',
    ],
    actions: ['Compare meetings', 'Set median-shift alert', 'Export chart'],
  },
  'Market Opportunity Scanner': {
    areas: [
      'Setup Filter Bar — setup type, sector, catalyst window, confidence',
      'Opportunity Table — symbol, setup tag, momentum flag, catalyst date',
      'Detail Panel — chart, video excerpt, linked source insight',
      'Watchlist Quick-Add — one-click add from selected row',
    ],
    actions: ['Apply preset filter', 'Add to watchlist', 'Flag for review'],
  },
  'Financials Sector Tracker': {
    areas: [
      'Yield Spread Widget — headline spread and delta vs prior session',
      'Sector Heatmap — financial sub-sectors colored by RS and spread sensitivity',
      'Movers Table — rank, symbol, RS, volume, trend badge',
      'Alert Config Panel — spread threshold and sub-sector RS rules',
    ],
    actions: ['Filter sub-sector', 'Add mover to watchlist', 'Set spread alert'],
  },
  'Fed Rate Decision Tracker': {
    areas: [
      'Next-Meeting Countdown — date, implied path snapshot',
      'Decision Timeline — outcomes, rate change, statement theme tags',
      'Rate Path Chart — target rate and futures-implied overlay',
      'Statement Diff Viewer — side-by-side excerpt on row select',
    ],
    actions: ['Open statement diff', 'Subscribe to decision alert', 'Export timeline'],
  },
  'Fed Communication Analyzer': {
    areas: [
      'Communication Feed — speaker, doc type, date, tone badge',
      'Tone Trend Chart — hawkish/dovish score over time',
      'Phrase Highlights Panel — keyword hits on row select',
      'Alert Rules — tone band breach and keyword watch list',
    ],
    actions: ['Filter by speaker', 'Set keyword alert', 'Pin summary'],
  },
  'Fed Balance Sheet Tracker': {
    areas: [
      'Balance Sheet Trend Chart — total assets weekly series',
      'Component Stacked Area — Treasuries, MBS, reserves, RRP',
      'QT Pace Gauge — runoff rate vs prior cycle benchmark',
      'Weekly Change Table — release date, delta, alert flag',
    ],
    actions: ['Set weekly-change alert', 'Drill into component', 'Export chart'],
  },
  'Fed Policy Tracker': {
    areas: [
      'Policy Stance Gauge — aggregate hawkish/dovish score',
      'Unified Timeline — rates, BS, guidance events with pillar tags',
      'Document Feed — latest releases with sector impact sidebar',
      'Sector Impact Sidebar — linked tags for selected event',
    ],
    actions: ['Filter by policy pillar', 'Subscribe to stance shift', 'Open source doc'],
  },
  'Fed Reform Tracker': {
    areas: [
      'Reform Timeline — milestones, committee, impact severity',
      'Announcement Feed — sorted by date with reform topic tags',
      'Committee Tracker Table — member/role changes and status',
      'Sector Impact Matrix — linked implications for selected milestone',
    ],
    actions: ['Filter by reform topic', 'Subscribe to milestone alert', 'Export timeline'],
  },
  'Consumer Pressure Index': {
    areas: [
      'Composite Pressure Gauge — headline score and severity band',
      'Component Breakdown — spending, credit, retail revisions, sentiment',
      'Sub-sector Heatmap — discretionary vs staples pressure',
      'Threshold & Alert Panel — band config and recent crossings',
    ],
    actions: ['Set threshold', 'Drill into component', 'Export snapshot'],
  },
  'Employment & AI Index': {
    areas: [
      'Dual-Track Gauge — jobs strength vs AI displacement score',
      'Component Table — payrolls, claims, AI capex/adoption proxies',
      'Trend Charts — each track over selectable window',
      'Narrative Summary Card — which track is dominating',
    ],
    actions: ['Set displacement alert', 'Compare tracks', 'Export report'],
  },
};

const UI_LAYOUT_BY_CATEGORY = {
  Scanner: {
    areas: [
      'Filter Bar — universe preset, score threshold, sector and date filters',
      'Results Table — rank, symbol, score, flags, sparkline, alert status',
      'Detail Panel — chart and source context on row select',
      'Alert Rules Panel — condition editor and notification channel',
    ],
    actions: ['Run scan', 'Add to watchlist', 'Create alert'],
  },
  Watchlist: {
    areas: [
      'Symbol Search / Add Bar',
      'Watchlist Table — symbol, trigger level, distance %, alert state',
      'Mini Chart Panel — level overlay on row select',
      'Alert Feed — recent events and pending notifications',
    ],
    actions: ['Add symbol', 'Edit levels', 'Acknowledge event'],
  },
  Tracker: {
    areas: [
      'Summary Status Bar — current state badge and last-updated timestamp',
      'Trend / Timeline Chart — primary metric or event history',
      'Entity Table — tracked items with latest reading and delta',
      'Event Detail Drawer — document link, impact tags, notes',
    ],
    actions: ['Subscribe to alert', 'Export snapshot', 'Open source'],
  },
  Index: {
    areas: [
      'Composite Gauge — headline score and severity band',
      'Component Breakdown — input table or stacked bar',
      'Trend History Chart — composite over selectable window',
      'Threshold & Alert Panel — band config and alert log',
    ],
    actions: ['Set threshold', 'Drill into component', 'Export report'],
  },
  Matrix: {
    areas: [
      'Scenario Filter Bar — policy tag, date, entity subset',
      'Impact Matrix Grid — heatmap of cross-dimensional scores',
      'Detail Side Panel — cell drivers and linked context',
      'Comparison Chart — benchmark or prior-snapshot overlay',
    ],
    actions: ['Save view', 'Export CSV', 'Toggle scenario'],
  },
  'Alert System': {
    areas: [
      'Risk Gauge Header — aggregate severity score',
      'Filter Bar — severity, category, acknowledgment status',
      'Warnings Feed Table — priority-sorted items',
      'Warning Detail Panel — full text and source metadata',
    ],
    actions: ['Acknowledge', 'Mute category', 'Configure routing'],
  },
  Analytics: {
    areas: [
      'Release Selector — date or meeting picker',
      'Primary Visualization — main chart or analytic view',
      'Comparison Panel — prior-period diff or overlay',
      'Insight Summary Card — auto-generated takeaway',
    ],
    actions: ['Pin to dashboard', 'Export chart', 'Set metric alert'],
  },
  Dashboard: {
    areas: [
      'KPI Summary Row — headline metric cards',
      'Filter Bar — symbol, sector, date range',
      'Widget Grid — core tables and charts',
      'Drill-down Modal — detail on card or row click',
    ],
    actions: ['Refresh data', 'Save layout', 'Open drill-down'],
  },
};

/** Realistic user stories keyed by English technical name */
const FEATURE_USER_STORIES = {
  'XBI Momentum Scanner':
    'As a biotech-focused swing trader, I want to scan all XBI constituents, rank them by momentum strength, and receive alerts when a stock breaks a key level, so I can identify opportunities before the broader market notices them.',
  'Support Level Watchlist':
    'As a swing trader, I want to monitor support and resistance levels from my video research with automatic break alerts, so I can react immediately when price tests or violates a critical level.',
  'Real Estate Stress Index':
    'As a macro investor monitoring Israeli property risk, I want a single composite stress score with component breakdown and threshold alerts, so I can reduce exposure before weakness becomes obvious in prices.',
  'Fed Reform Tracker':
    'As a rates trader, I want a unified timeline of Fed governance reforms linked to sector impact tags, so I can reposition before structural policy changes are fully priced in.',
  'Tech Leaders Tracker':
    'As a growth investor, I want a ranked view of mega-cap tech leaders with trend and relative-strength status, so I can tilt allocation toward strength and away from fading names quickly.',
  'Financials Sector Tracker':
    'As a sector rotator, I want to see how yield spreads and relative strength map to financial sub-sectors in one screen, so I can trade rate sensitivity without building custom screens.',
  'Sector Impact Matrix':
    'As a macro strategist, I want to see which sectors win or lose under the current policy scenario in a single matrix, so I can make allocation calls in seconds instead of spreadsheets.',
  'Macro Risk Alert System':
    'As a portfolio manager, I want all active macro warnings prioritized by severity in one inbox, so I never miss a critical risk buried in lengthy research.',
  'Dot Plot Analyzer':
    'As a rates trader, I want to compare Fed dot plot medians across meetings with bps deltas highlighted, so I can adjust duration exposure right after a release.',
  'Market Opportunity Scanner':
    'As an active trader acting on mentor research, I want video-derived setups in a filterable scan table with watchlist actions, so I can operationalize ideas before the catalyst window closes.',
  'Consumer Pressure Index':
    'As a consumer-sector trader, I want a composite pressure score with spending and credit components, so I can short or hedge retail exposure before earnings disappointments cluster.',
  'Fed Rate Decision Tracker':
    'As a fixed-income PM, I want each FOMC outcome with rate path and statement diff in one timeline, so I can reposition immediately after a decision without parsing multiple sources.',
  'Fed Communication Analyzer':
    'As a macro researcher, I want hawkish/dovish tone shifts surfaced from new Fed communications, so I can anticipate market moves without reading every speech end-to-end.',
  'Fed Balance Sheet Tracker':
    'As a liquidity-focused trader, I want weekly balance sheet changes with QT pace and component breakdown, so I can anticipate liquidity-driven moves before they hit risk assets.',
  'Fed Policy Tracker':
    'As a multi-asset strategist, I want rates, balance sheet and guidance signals rolled into one policy stance gauge, so I can align portfolio risk with the Fed’s overall direction.',
  'Employment & AI Index':
    'As a thematic macro investor, I want employment strength weighed against AI displacement pressure in one index, so I can position for whichever labor narrative the market adopts next.',
};

const USER_STORY_BY_CATEGORY = {
  Scanner: {
    goal: 'scan and rank a defined symbol universe by setup strength',
    outcome: 'I can act on the best candidates before the setup becomes crowded',
  },
  Watchlist: {
    goal: 'track my symbols against research-backed price levels with timely notifications',
    outcome: 'I can react to level breaks without watching charts all day',
  },
  Tracker: {
    goal: 'follow a macro or sector theme with the latest reading and event history in one place',
    outcome: 'I can spot material shifts early enough to adjust positioning',
  },
  Index: {
    goal: 'see a single composite score with component drivers and trend history',
    outcome: 'I can decide when stress or opportunity is building before prices fully reflect it',
  },
  Matrix: {
    goal: 'compare many sectors or factors in a scannable cross-impact view',
    outcome: 'I can make faster allocation calls under the current macro narrative',
  },
  'Alert System': {
    goal: 'receive prioritized warnings from all macro sources in one feed',
    outcome: 'I never miss a critical risk signal during a busy trading day',
  },
  Analytics: {
    goal: 'load the latest release and compare it to the prior period with a clear summary',
    outcome: 'I can translate complex data into a positioning decision quickly',
  },
  Dashboard: {
    goal: 'open one screen with the key metrics and widgets for this research theme',
    outcome: 'I can monitor daily without rebuilding charts and tables from scratch',
  },
};

function personaFromTargetUsers(targetUsers) {
  const first = s(targetUsers).split(',')[0].trim();
  return first ? first.toLowerCase() : 'active trader';
}

function formatUiLayout(areas, actions) {
  const lines = ['Main Screen:', ...areas.map((area, i) => `${i + 1}. ${area}`)];
  if (actions?.length) {
    lines.push('', `Actions: ${actions.join(', ')}.`);
  }
  return lines.join('\n');
}

function buildUiLayout({ cat, profile, titleEn, coreComponents }) {
  if (profile.uiLayout) {
    return Array.isArray(profile.uiLayout)
      ? formatUiLayout(profile.uiLayout, profile.uiActions)
      : s(profile.uiLayout);
  }

  const known = FEATURE_UI_LAYOUT[s(titleEn)];
  if (known) return formatUiLayout(known.areas, known.actions);

  const categoryLayout = UI_LAYOUT_BY_CATEGORY[cat] || UI_LAYOUT_BY_CATEGORY.Dashboard;
  const areas = [...categoryLayout.areas];
  const primaryWidget = coreComponents[0];
  if (primaryWidget && !areas.some((a) => a.toLowerCase().includes(primaryWidget.toLowerCase().slice(0, 8)))) {
    areas[1] = `${areas[1]} (primary: ${primaryWidget})`;
  }
  return formatUiLayout(areas, categoryLayout.actions);
}

function buildExampleUserStory({
  cat,
  profile,
  titleEn,
  targetUsers,
  hasAlert,
  hasRanking,
}) {
  if (profile.userStory) return s(profile.userStory);

  const known = FEATURE_USER_STORIES[s(titleEn)];
  if (known) return known;

  const persona = personaFromTargetUsers(targetUsers);
  const template = USER_STORY_BY_CATEGORY[cat] || USER_STORY_BY_CATEGORY.Dashboard;
  let goal = template.goal;
  if (hasRanking && !/rank/i.test(goal)) goal = `${goal} with clear ranking`;
  if (hasAlert && !/alert|notif/i.test(goal)) goal = `${goal} and receive alerts on material changes`;

  const feature = s(titleEn);
  if (feature && feature !== 'Custom Feature' && feature !== 'Insight-Driven Feature') {
    goal = `${goal} for ${feature}`;
  }

  return `As a ${persona}, I want to ${goal}, so that ${template.outcome}.`;
}

const GENERIC_FEATURE_NAMES = new Set([
  'Insight-Driven Feature',
  'Custom Feature',
]);

const SOURCE_TYPE_CONFIDENCE_CAP = {
  insight: 6,
  indicator: 6,
  gem: 7,
};

const THEME_EVIDENCE_PATTERNS = [
  {
    test: /real.?estate|נדל|housing|דיור/i,
    themes: [
      [/inventor/i, 'Housing inventory pressure mentioned in source analysis'],
      [/mortgage|משכנ|financ/i, 'Mortgage activity or financing conditions referenced'],
      [/developer|קבלן|pipeline|בנייה/i, 'Developer financing or project pipeline stress referenced'],
      [/sales|עסקאות|transaction|velocity/i, 'Sales velocity or transaction volume concerns noted'],
      [/negotiat|מיקוח|discount/i, 'Buyer negotiation dynamics or pricing flexibility noted'],
      [/price|מחיר|valuation/i, 'Price trend or valuation pressure discussed'],
    ],
  },
  {
    test: /xbi|biotech|ביוטק/i,
    themes: [
      [/momentum|מומנטום|relative.?strength|\brs\b/i, 'Momentum or relative-strength thesis in source'],
      [/breakout|פריצ|resistance|התנגדות/i, 'Breakout or resistance-level setup referenced'],
      [/volume|נפח|participation/i, 'Volume expansion or participation signal noted'],
    ],
  },
  {
    test: /fed|פד|fomc|rate|ריבית/i,
    themes: [
      [/dot.?plot/i, 'Dot plot or rate-path guidance discussed'],
      [/balance.?sheet|מאזן|qt|qe/i, 'Balance sheet or liquidity runoff referenced'],
      [/statement|minutes|speech|תקשורת/i, 'Fed communication or statement language noted'],
      [/reform|committee|ועד/i, 'Fed governance or committee reform topic raised'],
    ],
  },
  {
    test: /consumer|צרכנ|retail/i,
    themes: [
      [/spending|הוצא|retail/i, 'Consumer spending or retail demand signal noted'],
      [/credit|אשראי|delinquen/i, 'Credit usage or delinquency pressure referenced'],
      [/sentiment|סנטימנט/i, 'Consumer sentiment deterioration mentioned'],
    ],
  },
  {
    test: /financial|xlf|bank|פיננס/i,
    themes: [
      [/yield|spread|תשוא/i, 'Yield spread or rate sensitivity discussed'],
      [/credit|אשראי/i, 'Credit conditions or spread widening noted'],
      [/relative.?strength|\brs\b/i, 'Financial sector relative-strength signal referenced'],
    ],
  },
];

function splitEvidencePhrases(text) {
  return s(text)
    .split(/[,;•\n]|(?:\.\s+)|(?:\s+[-–—]\s+)/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 12 && p.length <= 120);
}

function extractSupportingEvidence({
  sourceInsight,
  shortDescription,
  sourceType,
  titleEn,
}) {
  if (sourceType === 'risk' && shortDescription) {
    const warningPhrases = splitEvidencePhrases(shortDescription);
    if (warningPhrases.length >= 1) {
      return warningPhrases.slice(0, 4);
    }
  }

  const evidence = [];
  const combined = `${titleEn} ${sourceInsight} ${shortDescription}`;

  for (const group of THEME_EVIDENCE_PATTERNS) {
    if (!group.test.test(combined)) continue;
    for (const [re, label] of group.themes) {
      if (re.test(combined) && !evidence.includes(label)) evidence.push(label);
    }
  }

  const levelMatch = sourceInsight.match(/Key levels mentioned:\s*(.+)/i);
  if (levelMatch) {
    levelMatch[1].split(',').map((sym) => sym.trim()).filter(Boolean).forEach((sym) => {
      evidence.push(`Price levels cited for ${sym}`);
    });
  }

  if (sourceType === 'structure') {
    const countMatch = sourceInsight.match(/(\d+)\s+sectors/i);
    if (countMatch) {
      evidence.push(`${countMatch[1]} sectors with sentiment data in the source video`);
    }
  }


  if (sourceType === 'opportunity' && sourceInsight) {
    evidence.push(`Dedicated opportunity callout: "${sourceInsight.slice(0, 90)}"`);
  }

  if (evidence.length < 2 && shortDescription) {
    splitEvidencePhrases(shortDescription).slice(0, 3).forEach((phrase) => {
      if (!evidence.includes(phrase)) evidence.push(phrase);
    });
  }

  if (evidence.length === 0 && sourceInsight) {
    evidence.push(sourceInsight);
  }

  return [...new Set(evidence)].slice(0, 5);
}

function computeDiscoveryConfidenceScore({
  sourceType,
  evidence,
  numericConfidence,
  titleEn,
}) {
  let score = Math.round((numericConfidence || 0.7) * 10);
  const count = evidence.length;

  if (count >= 4) score = Math.max(score, 8);
  else if (count >= 3) score = Math.max(score, 7);
  else if (count <= 1) score = Math.min(score, 6);

  if (GENERIC_FEATURE_NAMES.has(s(titleEn))) score = Math.min(score, 5);
  if (SOURCE_TYPE_CONFIDENCE_CAP[sourceType]) {
    score = Math.min(score, SOURCE_TYPE_CONFIDENCE_CAP[sourceType]);
  }
  if (sourceType === 'opportunity' && count >= 2) score = Math.max(score, 8);
  if (sourceType === 'watchlist' && count >= 2) score = Math.max(score, 8);
  if (sourceType === 'structure') score = Math.max(score, 7);

  return Math.min(10, Math.max(1, score));
}

function buildDiscoveryConfidence({
  profile,
  sourceInsight,
  shortDescription,
  sourceType,
  titleEn,
  confidence,
}) {
  if (profile.discoveryConfidence) return s(profile.discoveryConfidence);

  const evidence = extractSupportingEvidence({
    sourceInsight,
    shortDescription,
    sourceType,
    titleEn,
  });
  const score = computeDiscoveryConfidenceScore({
    sourceType,
    evidence,
    numericConfidence: confidence,
    titleEn,
  });

  const count = evidence.length;
  const reasonIntro = count >= 3
    ? 'The video contained multiple independent references to:'
    : count === 2
      ? 'The source analysis includes two related signals:'
      : 'The feature is primarily supported by a single source signal:';

  const closing = count >= 3
    ? 'The feature is supported by several related insights rather than a single mention.'
    : count === 2
      ? 'Corroborating signals raise confidence, though broader thematic coverage in the video is limited.'
      : 'Confidence is moderate because the idea rests on limited direct evidence in the source material.';

  return `${score}/10\n\nReason:\n\n${reasonIntro}\n\n${bulletList(evidence)}\n\n${closing}`;
}

const WORTH_BUILDING_BY_FEATURE = {
  'Real Estate Stress Index': `Most investors recognize housing market weakness only after prices begin falling.

A Real Estate Stress Index provides earlier signals by combining inventory pressure, mortgage activity, sales velocity, and developer stress into a single actionable indicator.

This creates ongoing monitoring value rather than a one-time research report.`,
  'XBI Momentum Scanner': `Biotech momentum setups are easy to miss when XBI constituents are spread across separate tools and manual screens.

A dedicated scanner ranks the basket by momentum, volume and breakout proximity, then routes alerts on qualifying names.

That turns a one-off video call into a repeatable pre-market workflow instead of a note you revisit once.`,
  'Support Level Watchlist': `Levels mentioned in research are forgotten quickly unless they are tied to live price monitoring.

A level-based watchlist automates break detection against mentor-backed prices and surfaces alerts when action is required.

The product keeps working after the video is watched, which a summary alone cannot do.`,
  'Macro Risk Alert System': `Macro risks are often buried in long-form research and are easy to miss during an active trading day.

A prioritized risk inbox consolidates warnings by severity and routes only what needs attention now.

Persistent alerting creates daily utility instead of a static list read once.`,
  'Sector Impact Matrix': `Sector winners and losers under a macro narrative are usually rebuilt in spreadsheets for every new video.

A matrix view compresses cross-sector impact into one scannable screen with saved scenarios.

Reusable allocation views justify building a product rather than re-deriving the same table manually.`,
};

const ONGOING_VALUE_BY_CATEGORY = {
  Scanner: 'Repeated scans turn episodic video research into a daily workflow instead of a static note.',
  Watchlist: 'Automated level monitoring replaces manual chart checks every time new research arrives.',
  Tracker: 'A living tracker compounds value across releases instead of re-reading old summaries.',
  Index: 'A persistent composite score supports threshold alerts long after the original video.',
  Matrix: 'Saved scenario views make sector allocation repeatable under changing macro narratives.',
  'Alert System': 'A unified risk inbox stays useful as new warnings arrive, not only on watch day.',
  Analytics: 'Release-over-release comparison builds institutional memory beyond a one-off explanation.',
  Dashboard: 'A dedicated screen operationalizes research into a daily monitoring habit.',
};

function buildWhyWorthBuilding({
  cat,
  profile,
  titleEn,
  userProblem,
  businessValue,
  worthBuilding,
}) {
  if (profile.whyWorthBuilding) return s(profile.whyWorthBuilding);

  const known = WORTH_BUILDING_BY_FEATURE[s(titleEn)];
  if (known) return known;

  const problem = s(userProblem).replace(/\.$/, '');
  const value = s(businessValue).replace(/\.$/, '');
  const ongoing = ONGOING_VALUE_BY_CATEGORY[cat]
    || 'Persistent tooling delivers ongoing decision support rather than a one-time research artifact.';

  const paragraphs = [
    `${problem}. Reading the video summary alone does not solve this repeatedly.`,
    value.endsWith('.') ? value : `${value}.`,
    ongoing,
  ];

  if (worthBuilding === 'Maybe') {
    paragraphs[2] = `${ongoing} Validate demand with the MVP scope before investing in automation.`;
  }

  return paragraphs.slice(0, 3).join('\n\n');
}

function bulletList(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => s(item))
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join('\n');
}

function defaultDataInputs(category, sourceInsight, titleEn) {
  const base = [
    'Equity or ETF price and volume feeds (daily minimum; intraday optional)',
    `Context from video analysis: ${s(sourceInsight).slice(0, 100)}`,
    'User preferences: watchlists, thresholds, filters and alert channels',
  ];
  if (category === 'Tracker' || /fed|פד/i.test(titleEn)) {
    base.unshift('Macro event calendar and official policy document metadata');
  }
  if (category === 'Index' || /stress|pressure|index/i.test(titleEn)) {
    base.unshift('Component indicator time series for composite scoring');
  }
  if (category === 'Matrix') {
    base.unshift('Sector or entity attribute table with sentiment and performance tags');
  }
  return base.slice(0, 5);
}

const ALERT_CATEGORIES = new Set(['Watchlist', 'Tracker', 'Alert System', 'Index', 'Scanner']);
const RANKING_CATEGORIES = new Set(['Scanner', 'Index', 'Matrix', 'Alert System']);

function resolveBriefSections(category, profile, titleEn, components) {
  const compText = components.join(' ').toLowerCase();
  const titleText = s(titleEn).toLowerCase();
  const hasAlert = ALERT_CATEGORIES.has(category)
    || Boolean(profile.alertLogic || profile.alertWhen);
  const hasRanking = RANKING_CATEGORIES.has(category)
    || Boolean(profile.rankingLogic)
    || (category === 'Tracker' && /rank|leader|momentum|heatmap/i.test(`${titleText} ${compText}`));
  return { hasAlert, hasRanking };
}

function buildUserWorkflow({ cat, profile, coreComponents }) {
  if (profile.userWorkflow) {
    return Array.isArray(profile.userWorkflow)
      ? bulletList(profile.userWorkflow)
      : s(profile.userWorkflow);
  }

  const stepsByCategory = {
    Scanner: [
      'Select universe or saved scan preset.',
      'Run scan and review ranked results table.',
      'Open symbol row for chart detail and source context.',
      'Add to watchlist or attach alert on selected symbols.',
    ],
    Watchlist: [
      'Add symbol and define support/resistance or trigger level.',
      'Monitor live distance-to-level in watchlist table.',
      'Act on break alert — review chart and source note.',
      'Update, acknowledge or remove level after event.',
    ],
    Tracker: [
      'View current tracked state on timeline or status panel.',
      'Compare latest reading vs prior snapshot or threshold.',
      'Drill into event detail and linked source document.',
      'Subscribe to notification on material state change.',
    ],
    Index: [
      'Review composite score gauge and component breakdown.',
      'Inspect trend history and period-over-period delta.',
      'Adjust component weights or threshold bands if exposed.',
      'Act on severity band change via alert or export.',
    ],
    Matrix: [
      'Select policy scenario or filter preset.',
      'Scan matrix cells for sector sentiment vs performance.',
      'Drill into row/column for supporting context.',
      'Export view or save snapshot for allocation notes.',
    ],
    'Alert System': [
      'Scan prioritized warning feed by severity.',
      'Acknowledge or mute non-actionable items.',
      'Open linked macro context for active warnings.',
      'Configure routing rules and digest schedule.',
    ],
    Analytics: [
      'Load latest release or dataset into analyzer view.',
      'Compare current vs prior period (diff or overlay).',
      'Read auto-summary and annotate takeaway.',
      'Export chart snapshot or pin to dashboard.',
    ],
    Dashboard: [
      'Land on summary layout with primary KPI cards.',
      'Filter widgets by symbol, sector or date range.',
      'Drill from card into underlying table or chart.',
      'Pin or rearrange widgets for daily monitoring routine.',
    ],
  };

  return bulletList(stepsByCategory[cat] || stepsByCategory.Dashboard);
}

function buildAlertLogic({ cat, profile, alertWhen, filterBy }) {
  if (profile.alertLogic) return s(profile.alertLogic);
  if (!alertWhen) return null;

  const cadence = cat === 'Watchlist' ? '1–5 min poll'
    : cat === 'Scanner' ? 'post-scan (+ optional intraday)'
      : cat === 'Tracker' ? 'on release / scheduled job'
        : 'on ingest or schedule';

  return `Trigger: ${alertWhen}. Cadence: ${cadence}. Filters: ${filterBy}. Channels: in-app (MVP), email optional. Cooldown: 15 min per symbol/event.`;
}

function buildRankingLogic({ cat, profile, titleEn, components }) {
  if (profile.rankingLogic) return s(profile.rankingLogic);

  const compText = components.join(' ').toLowerCase();
  const titleText = s(titleEn).toLowerCase();

  if (cat === 'Scanner') {
    return 'Composite score 0–100: RS vs benchmark 40%, volume vs 20d avg 30%, breakout proximity 20%, short-term trend alignment 10%. Default sort: score descending; tie-break by volume.';
  }
  if (cat === 'Index') {
    return 'Normalize each component to 0–100, apply weights (default equal), sum to composite. Emit delta vs prior period and map to severity band (low / medium / high).';
  }
  if (cat === 'Matrix') {
    return 'Cell score = sentiment tag × relative-performance quintile. Rank sectors by absolute impact; highlight quadrant flips vs prior snapshot.';
  }
  if (cat === 'Alert System') {
    return 'Sort open warnings: severity (critical > high > medium > low), then recency. Risk gauge = weighted sum of open items by severity tier.';
  }
  if (cat === 'Tracker' && /rank|leader|momentum|heatmap/i.test(`${titleText} ${compText}`)) {
    return 'Rank entities by trend score (RS, MA alignment, volume posture). Surface status badge change when rank exits top-N band or trend flips.';
  }
  return null;
}

function buildDataModel({ cat, en, profile }) {
  if (profile.dataModel) {
    return Array.isArray(profile.dataModel)
      ? bulletList(profile.dataModel)
      : s(profile.dataModel);
  }

  const slug = en.replace(/\s+/g, '');
  const modelsByCategory = {
    Scanner: [
      `\`ScanRun\` (id, runAt, universe, filtersJson)`,
      `\`SymbolScore\` (scanRunId, symbol, score, rank, flagsJson)`,
      `\`AlertRule\` (id, symbol, condition, threshold, channel, active)`,
      `\`WatchlistEntry\` (userId, symbol, sourceRef, createdAt)`,
    ],
    Watchlist: [
      `\`WatchlistItem\` (id, symbol, sector, notes, active)`,
      `\`PriceLevel\` (watchlistItemId, type, price, bufferPct, sourceRef)`,
      `\`BreakEvent\` (watchlistItemId, direction, priceAtBreak, firedAt)`,
      `\`AlertPreference\` (userId, channel, cooldownMin)`,
    ],
    Tracker: [
      `\`TrackedEntity\` (id, key, label, category, metadataJson)`,
      `\`MetricSnapshot\` (entityId, capturedAt, valueJson, deltaJson)`,
      `\`TimelineEvent\` (entityId, eventAt, title, sourceUrl, impactTag)`,
      `\`AlertSubscription\` (entityId, condition, threshold, channel)`,
    ],
    Index: [
      `\`IndexComponent\` (id, name, weight, sourceKey, normalizeRule)`,
      `\`IndexSnapshot\` (capturedAt, compositeScore, band, componentsJson)`,
      `\`ThresholdConfig\` (band, minScore, maxScore, notify)`,
      `\`AlertLog\` (snapshotId, band, firedAt, acknowledged)`,
    ],
    Matrix: [
      `\`MatrixScenario\` (id, name, policyTag, filtersJson)`,
      `\`MatrixCell\` (scenarioId, rowKey, colKey, score, sentiment, perfTag)`,
      `\`MatrixSnapshot\` (scenarioId, capturedAt, cellsJson)`,
      `\`SavedView\` (userId, scenarioId, layoutJson)`,
    ],
    'Alert System': [
      `\`Warning\` (id, sourceRef, severity, category, body, status)`,
      `\`RiskGaugeSnapshot\` (capturedAt, score, openCountBySeverityJson)`,
      `\`MuteRule\` (category, pattern, expiresAt)`,
      `\`DeliveryLog\` (warningId, channel, sentAt, status)`,
    ],
    Analytics: [
      `\`DatasetRelease\` (id, releaseAt, sourceType, rawPayloadRef)`,
      `\`AnalysisResult\` (releaseId, metricsJson, diffJson, summary)`,
      `\`Annotation\` (releaseId, userId, note, createdAt)`,
      `\`AlertConfig\` (metricKey, threshold, direction, channel)`,
    ],
    Dashboard: [
      `\`DashboardLayout\` (userId, widgetsJson, updatedAt)`,
      `\`WidgetConfig\` (id, type, dataSourceKey, filtersJson)`,
      `\`MetricCache\` (widgetId, capturedAt, payloadJson)`,
      `\`UserPreference\` (userId, theme, locale, defaultFiltersJson)`,
    ],
  };

  const entities = modelsByCategory[cat] || [
    `\`${slug}Entity\` (id, key, label, metadataJson)`,
    `\`${slug}Snapshot\` (entityId, capturedAt, valueJson)`,
    `\`UserConfig\` (userId, thresholdsJson, filtersJson)`,
    `\`AlertRule\` (entityId, condition, channel, active)`,
  ];
  return bulletList(entities);
}

function buildSuccessCriteria({ cat, profile, coreComponents }) {
  if (profile.successCriteria) {
    return Array.isArray(profile.successCriteria)
      ? bulletList(profile.successCriteria)
      : s(profile.successCriteria);
  }

  const items = [
    `Primary ${cat.toLowerCase()} workflow completable in ≤3 clicks from entry view.`,
    `Core view (${coreComponents.slice(0, 2).join(', ')}) renders from persisted data without manual seed edits.`,
    'Filter and sort controls affect displayed rows/charts correctly in QA scenarios.',
  ];

  if (ALERT_CATEGORIES.has(cat)) {
    items.push('Threshold breach produces exactly one deduplicated alert in QA harness.');
  }
  if (RANKING_CATEGORIES.has(cat)) {
    items.push('Ranking/score order matches documented formula on fixed fixture dataset.');
  }
  items.push('Brief is sufficient to generate PRD, schema, UI tree and dev tasks without follow-up.');

  return bulletList(items.slice(0, 4));
}

function buildAiBuilderPrompt({
  titleEn,
  cat,
  monitor,
  mvp,
  coreComponents,
  hasAlert,
  hasRanking,
}) {
  const parts = [
    `Build production-ready **${cat}** feature **${titleEn}**.`,
    `Monitor: ${monitor}`,
    `UI: ${coreComponents.slice(0, 4).join(', ')}.`,
    `MVP: ${mvp}`,
  ];
  if (hasRanking) parts.push('Implement Ranking / Scoring Logic as specified.');
  if (hasAlert) parts.push('Implement Alert / Automation Logic as specified.');
  parts.push(
    'Use UI Layout for screen structure; Example User Story is the primary acceptance scenario.',
    'Honor Discovery Confidence and Why This Is Worth Building when scoping MVP priority.',
    'Deliver PRD, technical spec, DB schema (from Data Model), React UI tree, ordered dev tasks.',
    'Targets: App Builder GEM, Claude Code, Cursor, Codex, Base44, Lovable. Responsive + Hebrew RTL where localized.',
  );
  return parts.join(' ');
}

function composeStructuredBrief({
  titleEn,
  category,
  components = [],
  sourceInsight = '',
  whyItMatters = '',
  sourceType = 'macro',
  shortDescription = '',
  confidence = 0.7,
  appFitScore = 6,
  reusabilityScore = 6,
  worthBuilding = 'Maybe',
}) {
  const en = s(titleEn);
  const cat = category || 'Dashboard';
  const profile = BUILDER_PROFILES[en] || {};
  const catDefaults = CATEGORY_BUILDER_DEFAULTS[cat] || CATEGORY_BUILDER_DEFAULTS.Dashboard;
  const comps = components.map(s).filter(Boolean);
  const coreComponents = profile.coreComponents || (
    comps.length >= 2
      ? comps
      : ['Summary header', 'Data table or chart', 'Filter bar', 'Alert configuration panel']
  );

  const monitor = profile.monitor || catDefaults.monitor || `signals related to ${en}`;
  const alertWhen = profile.alertWhen || null;
  const filterBy = profile.filterBy || 'symbol, date range, severity, category and custom tags';
  const { hasAlert, hasRanking } = resolveBriefSections(cat, profile, en, coreComponents);

  const insightSnippet = s(sourceInsight).slice(0, 85);
  const featureSummary = profile.featureSummary || (
    `${en} operationalizes video-derived insight ("${insightSnippet}") into a shippable ${cat.toLowerCase()} module.`
  );

  const userProblem = profile.userProblem || catDefaults.userProblem;
  const targetUsers = profile.targetUsers || catDefaults.targetUsers;
  const dataInputs = profile.dataInputs || defaultDataInputs(cat, sourceInsight, en);
  const businessValue = profile.businessValue || s(whyItMatters) || (
    `Cuts time from research insight to actionable ${cat.toLowerCase()} decision.`
  );
  const mvp = profile.mvp || (
    `${coreComponents.slice(0, 3).join(', ')}; API or manual data ingest; one persistence layer; one alert channel.`
  );
  const phase2 = profile.phase2 || catDefaults.phase2;
  const phase3 = profile.phase3 || catDefaults.phase3;

  const userWorkflow = buildUserWorkflow({ cat, profile, coreComponents });
  const alertLogic = hasAlert
    ? buildAlertLogic({ cat, profile, alertWhen: alertWhen || 'user-defined thresholds are breached', filterBy })
    : null;
  const rankingLogic = hasRanking
    ? buildRankingLogic({ cat, profile, titleEn: en, components: coreComponents })
    : null;
  const dataModel = buildDataModel({ cat, en, profile });
  const successCriteria = buildSuccessCriteria({ cat, profile, coreComponents });
  const uiLayout = buildUiLayout({ cat, profile, titleEn: en, coreComponents });
  const exampleUserStory = buildExampleUserStory({
    cat,
    profile,
    titleEn: en,
    targetUsers,
    hasAlert: Boolean(alertLogic),
    hasRanking: Boolean(rankingLogic),
  });
  const discoveryConfidence = buildDiscoveryConfidence({
    profile,
    sourceInsight,
    shortDescription,
    sourceType,
    titleEn: en,
    confidence,
  });
  const whyWorthBuilding = buildWhyWorthBuilding({
    cat,
    profile,
    titleEn: en,
    userProblem,
    businessValue,
    worthBuilding,
  });

  const aiPrompt = buildAiBuilderPrompt({
    titleEn: en,
    cat,
    monitor,
    mvp,
    coreComponents: coreComponents.slice(0, 5),
    hasAlert: Boolean(alertLogic),
    hasRanking: Boolean(rankingLogic),
  });

  const blocks = [
    ['Feature Summary', featureSummary],
    ['User Problem', userProblem],
    ['Target Users', targetUsers],
    ['Core Components', bulletList(coreComponents.slice(0, 4))],
    ['Key Data Inputs', bulletList(dataInputs.slice(0, 4))],
    ['User Workflow', userWorkflow],
    ...(alertLogic ? [['Alert / Automation Logic', alertLogic]] : []),
    ...(rankingLogic ? [['Ranking / Scoring Logic', rankingLogic]] : []),
    ['Data Model', dataModel],
    ['Business Value', businessValue],
    ['MVP Scope', mvp],
    ['Future Enhancements', `**Phase 2:** ${phase2}\n**Phase 3:** ${phase3}`],
    ['Success Criteria', successCriteria],
    ['UI Layout', uiLayout],
    ['Example User Story', exampleUserStory],
    ['Discovery Confidence', discoveryConfidence],
    ['Why This Is Worth Building', whyWorthBuilding],
    ['AI Builder Prompt', aiPrompt],
  ];

  return blocks
    .map(([heading, body]) => `### ${heading}\n${body}`)
    .join('\n\n');
}

function inferAiBuilderBrief({
  titleEn,
  category,
  components = [],
  sourceInsight = '',
  whyItMatters = '',
  sourceType = 'macro',
  shortDescription = '',
  confidence = 0.7,
  appFitScore = 6,
  reusabilityScore = 6,
  worthBuilding = 'Maybe',
}, override) {
  const custom = s(override);
  if (custom) return custom;

  return composeStructuredBrief({
    titleEn,
    category,
    components,
    sourceInsight,
    whyItMatters,
    sourceType,
    shortDescription,
    confidence,
    appFitScore,
    reusabilityScore,
    worthBuilding,
  });
}

function s(val) {
  return typeof val === 'string' ? val.trim() : String(val ?? '').trim();
}

function clampScore(n, min = 1, max = 10) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function pair(he, en) {
  const known = KNOWN_NAMES[en];
  if (known) return { titleHe: known.he, titleEn: known.en };
  return { titleHe: s(he), titleEn: s(en) };
}

function resolveTitles(partial) {
  const he = s(partial.titleHe);
  const en = s(partial.titleEn);
  if (he && en) return { titleHe: he, titleEn: en };

  const legacy = s(partial.productIdea);
  if (!legacy) return { titleHe: '', titleEn: '' };

  const byEn = KNOWN_NAMES[legacy];
  if (byEn) return { titleHe: byEn.he, titleEn: byEn.en };

  const byHe = Object.values(KNOWN_NAMES).find((n) => n.he === legacy);
  if (byHe) return { titleHe: byHe.he, titleEn: byHe.en };

  if (HEBREW_RE.test(legacy)) {
    return pair('פיצ׳ר מתובנת וידאו', 'Custom Feature');
  }
  return pair('פיצ׳ר מותאם', legacy);
}

function inferCategory(titleEn, components = [], sourceType = '') {
  const text = `${s(titleEn)} ${components.join(' ')} ${sourceType}`.toLowerCase();
  if (/matrix|מטריצ/.test(text)) return 'Matrix';
  if (/scanner|סורק|breakout/.test(text)) return 'Scanner';
  if (/watchlist|רמות תמיכה|support level/.test(text)) return 'Watchlist';
  if (/alert|התרא|warning|אזהר|risk/.test(text)) return 'Alert System';
  if (/index|מדד|pressure|לחץ|stress/.test(text)) return 'Index';
  if (/dot.?plot|analyzer|analytic|מנתח/.test(text)) return 'Analytics';
  if (/dashboard|לוח בקרה|macro.*system/.test(text)) return 'Dashboard';
  if (/tracker|מעקב|fed|פד/.test(text)) return 'Tracker';
  return 'Dashboard';
}

function inferReusability(components = [], category = '') {
  const reusable = ['Alert Engine', 'Watchlist', 'Dashboard Card', 'Metric Widget', 'Trend Chart', 'Heatmap'];
  const hits = (Array.isArray(components) ? components : []).filter((c) =>
    reusable.some((r) => s(c).toLowerCase().includes(r.toLowerCase())),
  ).length;
  const base = { Matrix: 8, Scanner: 7, Tracker: 8, Index: 7, Watchlist: 9, 'Alert System': 8, Analytics: 6, Dashboard: 7 };
  return clampScore((base[category] || 6) + Math.min(2, hits));
}

function inferWorthBuilding(appFitScore, reusabilityScore, confidence) {
  if (appFitScore >= 8 && confidence >= 0.75) return 'Yes';
  if (appFitScore >= 7 || (appFitScore >= 6 && reusabilityScore >= 7)) return 'Maybe';
  if (appFitScore >= MIN_APP_FIT) return 'Maybe';
  return 'No';
}

function whySentence(userValue, shortDescription, fallback) {
  const pick = s(userValue) || s(shortDescription) || s(fallback);
  if (!pick) return '';
  const one = pick.split(/[.!?]\s/)[0].trim();
  return one.length > 120 ? `${one.slice(0, 117)}…` : one;
}

function inferValueDescription(titleEn, category, override) {
  const custom = s(override);
  if (custom) return custom;

  const byTitle = VALUE_DESCRIPTION_HE[s(titleEn)];
  if (byTitle) return byTitle;

  const en = s(titleEn);
  if (/stress index/i.test(en)) {
    return 'נותן אזהרה מוקדמת לחולשה בסקטור לפני שהירידות במחירים הופכות לגלויות לכולם.';
  }
  if (/sector tracker/i.test(en)) {
    return 'חושף מגמות חוזק וחולשה בסקטור שמשפיעות על החלטות הקצאה בתיק, לפני שהשוק מגיב.';
  }
  if (/\btracker\b/i.test(en)) {
    return 'עוזר לזהות שינוי מגמה או מדיניות בזמן, לפני שהשוק מתמחר את ההפתעה.';
  }
  if (/\bscanner\b/i.test(en)) {
    return 'מאתר מועמדים חזקים לפני שהם בולטים בשוק, כדי שלא תפספסו את המהלך המוקדם.';
  }
  if (/\bindex\b/i.test(en)) {
    return 'מאחד אותות מפוזרים לציון אחד שמאותת על לחץ או הזדמנות לפני תגובת השוק.';
  }

  return CATEGORY_VALUE_DESCRIPTION_HE[category]
    || 'הופך תובנה מהסרטון לכלי שימושי שחוסך זמן ומונע החמצת מהלך חשוב.';
}

function namesForOpportunity(opp) {
  const text = (s(opp.title) + ' ' + s(opp.details)).toLowerCase();
  if (/ביוטק|biotech|xbi/.test(text)) return pair('סורק מומנטום ביוטק', 'XBI Momentum Scanner');
  if (/נדל[״"]?ן|real.?estate|קבלן/.test(text)) return pair('מדד לחץ נדל״ן ישראלי', 'Real Estate Stress Index');
  if (/טכנולוג|tech|avgo|magnificent/.test(text)) return pair('מעקב מניות טכנולוגיה מובילות', 'Tech Leaders Tracker');
  const title = s(opp.title);
  if (HEBREW_RE.test(title)) return pair(title.split(' ').slice(0, 5).join(' '), 'Market Opportunity Scanner');
  return pair('סורק הזדמנויות שוק', title.split(' ').slice(0, 4).join(' ') || 'Market Opportunity Scanner');
}

function compsForOppType(type) {
  const t = s(type).toLowerCase();
  if (/swing|סווינג/.test(t)) return ['Momentum Scanner', 'Breakout Chart', 'Alert Engine', 'Watchlist'];
  if (/real.?estate|נדל/.test(t)) return ['Pressure Index', 'Risk Gauge', 'Sales Tracker', 'Alert Banner'];
  return ['Metric Widget', 'Trend Chart', 'Alert Engine', 'Dashboard Card'];
}

function namesForSector(sector) {
  const t = s(sector).toLowerCase();
  if (/xbi|biotech|ביוטק/.test(t)) return pair('סורק מומנטום ביוטק', 'XBI Momentum Scanner');
  if (/xlf|financials|פיננסי/.test(t)) return pair('מעקב סקטור פיננסים', 'Financials Sector Tracker');
  if (/real.?estate|נדל/.test(t)) return pair('מדד לחץ נדל״ן', 'Real Estate Stress Index');
  if (/consumer|צרכנות/.test(t)) return pair('מדד לחץ צרכני', 'Consumer Pressure Index');
  const base = s(sector).split('(')[0].split('/').pop().trim().slice(0, 20);
  return pair(`מעקב סקטור ${base}`, `${base} Sector Tracker`);
}

function namesForStressSector(sectorLabel) {
  const raw = s(sectorLabel).split('(')[0].split('/').pop().trim();
  const t = raw.toLowerCase();
  if (/xbi|biotech|ביוטק/.test(t)) return pair('מדד לחץ ביוטק', 'Biotech Stress Index');
  if (/real.?estate|נדל/.test(t)) return pair('מדד לחץ נדל״ן', 'Real Estate Stress Index');
  if (/consumer|צרכנות/.test(t)) return pair('מדד לחץ צרכני', 'Consumer Stress Index');
  const en = `${raw.slice(0, 18)} Stress Index`;
  return pair(`מדד לחץ ${raw.slice(0, 14)}`, en);
}

function compsForSector(sector) {
  const t = s(sector).toLowerCase();
  if (/xbi|biotech/.test(t)) return ['Momentum Scanner', 'Breakout Chart', 'Top Movers', 'Alert Engine'];
  if (/xlf|financials/.test(t)) return ['Sector Chart', 'Yield Spread', 'Heatmap', 'Alert Engine'];
  if (/real.?estate|נדל/.test(t)) return ['Pressure Index', 'Debt Gauge', 'Sales Tracker', 'Alert Banner'];
  if (/consumer/.test(t)) return ['Pressure Gauge', 'Spending Index', 'Retail Trend', 'Alert Engine'];
  return ['Sector Chart', 'Heatmap', 'Alert Engine', 'Watchlist'];
}

function namesForPolicy(topic, desc) {
  const text = (s(topic) + ' ' + s(desc)).toLowerCase();
  if (/ועדות|committees|reform|מבנ/.test(text)) return pair('מעקב רפורמות הפד', 'Fed Reform Tracker');
  if (/ריבית|rate|decision/.test(text)) return pair('מעקב החלטות ריבית הפד', 'Fed Rate Decision Tracker');
  if (/תקשורת|communication/.test(text)) return pair('מנתח תקשורת הפד', 'Fed Communication Analyzer');
  if (/מאזן|balance.sheet/.test(text)) return pair('מעקב מאזן הפד', 'Fed Balance Sheet Tracker');
  return pair('מעקב מדיניות הפד', 'Fed Policy Tracker');
}

function compsForPolicy(isReform) {
  return isReform
    ? ['Committee Tracker', 'Reform Timeline', 'Announcement Feed', 'Impact Matrix']
    : ['Rate Widget', 'Dot Plot Chart', 'Rate History', 'Alert Engine'];
}

function namesForMacroFactor(indicator) {
  const t = s(indicator).toLowerCase();
  if (/dot.?plot/.test(t)) return pair('מנתח Dot Plot', 'Dot Plot Analyzer');
  if (/balance.sheet|מאזן/.test(t)) return pair('מעקב מאזן הפד', 'Fed Balance Sheet Tracker');
  if (/communication|תקשורת/.test(t)) return pair('מנתח תקשורת הפד', 'Fed Communication Analyzer');
  if (/employ|תעסוקה/.test(t)) return pair('מדד תעסוקה ו-AI', 'Employment & AI Index');
  const label = s(indicator).slice(0, 28);
  return pair(`מעקב ${label}`, `${label} Tracker`);
}

function finalizeIdea(partial) {
  const { titleHe, titleEn } = resolveTitles(partial);
  const sourceInsight = s(partial.sourceInsight);
  if (!titleHe || !titleEn || !sourceInsight || sourceInsight.length < 8) return null;

  const components = (Array.isArray(partial.components) ? partial.components : [])
    .map(s)
    .filter(Boolean)
    .slice(0, 4);
  if (components.length < 2) return null;

  const category = partial.category || inferCategory(titleEn, components, partial.sourceType);
  const appFitScore = clampScore(partial.appFitScore ?? 6);
  const confidence = Math.min(1, Math.max(0, Number(partial.confidence) || 0));
  if (confidence < MIN_CONFIDENCE || appFitScore < MIN_APP_FIT) return null;

  const reusabilityScore = clampScore(
    partial.reusabilityScore ?? inferReusability(components, category),
  );
  const worthBuilding = partial.worthBuilding || inferWorthBuilding(appFitScore, reusabilityScore, confidence);
  if (worthBuilding === 'No') return null;

  const whyItMatters = whySentence(
    partial.userValue,
    partial.shortDescription,
    partial.whyItMatters,
  );
  if (!whyItMatters || whyItMatters.length < 12) return null;

  const valueDescription = inferValueDescription(
    titleEn,
    category,
    partial.valueDescription || partial.whatItDoes,
  );
  const aiBuilderBrief = inferAiBuilderBrief(
    {
      titleEn,
      category,
      components,
      sourceInsight,
      whyItMatters,
      sourceType: partial.sourceType || 'macro',
      shortDescription: partial.shortDescription || '',
      confidence,
      appFitScore,
      reusabilityScore,
      worthBuilding,
    },
    partial.aiBuilderBrief,
  );

  return {
    id: partial.id || `${titleEn}-${sourceInsight}`.toLowerCase().replace(/\s+/g, '-').slice(0, 80),
    titleHe,
    titleEn,
    productIdea: titleEn,
    category,
    valueDescription,
    aiBuilderBrief,
    sourceInsight,
    whyItMatters,
    components,
    reusabilityScore,
    appFitScore,
    worthBuilding,
    confidence,
    sourceType: partial.sourceType || 'macro',
  };
}

/** Normalizes legacy / GEM idea objects into discovery shape. */
export function normalizeDiscoveryIdea(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;

  const components = (Array.isArray(raw.components) ? raw.components : [])
    .concat(raw.suggestedComponent ? [raw.suggestedComponent] : [])
    .map(s)
    .filter(Boolean)
    .slice(0, 4);

  return finalizeIdea({
    id: raw.id || `gem-${index}`,
    titleHe: raw.titleHe,
    titleEn: raw.titleEn,
    productIdea: raw.productIdea || raw.appName || raw.name,
    sourceInsight: s(raw.sourceInsight) || s(raw.shortDescription)?.slice(0, 80),
    userValue: raw.userValue,
    shortDescription: raw.shortDescription,
    components: components.length >= 2 ? components : ['Dashboard Card', 'Alert Engine', 'Trend Chart'],
    appFitScore: raw.appFitScore ?? 7,
    confidence: raw.confidence ?? 0.72,
    category: raw.category,
    sourceType: 'gem',
  });
}

export function discoverFeaturesFromMacro(marketBriefData) {
  if (!marketBriefData) return [];

  const raw = marketBriefData.rawData || {};
  const ut = marketBriefData.universalTabs || {};
  const utInsights = ut.insights || {};
  const utApp = ut.app || ut.appBuilder || {};

  const ideas = [];
  const seen = new Set();

  function add(partial) {
    const idea = finalizeIdea(partial);
    if (!idea) return;
    const key = idea.titleEn.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ideas.push(idea);
  }

  for (const opp of raw.opportunities || []) {
    if (!opp?.title || s(opp.title).length < 6) continue;
    const details = s(opp.details);
    if (!details && s(opp.title).length < 15) continue;
    const names = namesForOpportunity(opp);
    add({
      ...names,
      sourceInsight: s(opp.title),
      userValue: details
        ? `Turns "${s(opp.title).slice(0, 70)}" into an actionable trade setup before the window closes.`
        : '',
      shortDescription: details,
      components: compsForOppType(opp.type || ''),
      sourceType: 'opportunity',
      appFitScore: 9,
      confidence: 0.92,
    });
  }

  for (const sec of raw.sectors || []) {
    if (!sec?.sector) continue;
    const sentiment = s(sec.sentiment);
    if (sentiment !== 'חיובי' && sentiment !== 'שלילי') continue;
    const desc = s(sec.description) || s(sec.reason);
    if (desc.length < 15) continue;

    const isNegative = sentiment === 'שלילי';
    const sectorLabel = s(sec.sector).split('(')[0].trim();
    const names = isNegative ? namesForStressSector(sectorLabel) : namesForSector(sec.sector);
    add({
      ...names,
      sourceInsight: isNegative
        ? `Sector under pressure: ${sectorLabel}`
        : `Strong ${sectorLabel} momentum`,
      userValue: isNegative
        ? `Provides early warning of weakness in ${sectorLabel} before losses spread to the broader market.`
        : `Surfaces breakout candidates in ${sectorLabel} before they become crowded trades.`,
      shortDescription: desc,
      components: isNegative
        ? ['Pressure Gauge', 'Risk Indicator', 'Trend Line', 'Alert Banner']
        : compsForSector(sec.sector),
      sourceType: 'sector',
      appFitScore: isNegative ? 7 : 8,
      confidence: 0.85,
    });
  }

  const stocksWithLevels = (raw.stocksMentioned || []).filter(
    (st) => st?.symbol && /\d/.test(String(st.reason || '')),
  );
  if (stocksWithLevels.length >= 2) {
    const symbols = stocksWithLevels.slice(0, 4).map((x) => x.symbol).join(', ');
    add({
      ...pair('מעקב רמות תמיכה', 'Support Level Watchlist'),
      sourceInsight: `Key levels mentioned: ${symbols}`,
      userValue: 'Helps traders react faster when important price levels are tested, broken, or reclaimed.',
      components: ['Support Level Table', 'Price Alert Engine', 'Mini Chart', 'Watchlist'],
      sourceType: 'watchlist',
      appFitScore: 8,
      confidence: 0.88,
    });
  }

  const policyNamesSeen = new Set();
  for (const policy of raw.fedPolicy || []) {
    if (!policy?.topic) continue;
    const desc = s(policy.description);
    if (desc.length < 20) continue;
    const isReform = /ועדות|reform|committee|מבנ/i.test(desc);
    const names = namesForPolicy(policy.topic, desc);
    if (policyNamesSeen.has(names.titleEn)) continue;
    policyNamesSeen.add(names.titleEn);
    add({
      ...names,
      sourceInsight: `Fed: ${s(policy.topic).slice(0, 60)}`,
      userValue: `Flags shifts in ${s(policy.topic).slice(0, 55)} early enough to adjust positioning before the market reprices.`,
      shortDescription: desc,
      components: compsForPolicy(isReform),
      sourceType: 'fed',
      appFitScore: isReform ? 8 : 7,
      confidence: 0.82,
    });
  }

  const sectorsWithDesc = (raw.sectors || []).filter((sec) => s(sec.description).length >= 10);
  if (sectorsWithDesc.length >= 4) {
    add({
      ...pair('מטריצת השפעה סקטוריאלית', 'Sector Impact Matrix'),
      sourceInsight: `${sectorsWithDesc.length} sectors analyzed in video`,
      userValue: 'Shows which sectors win or lose under current macro policy so allocation decisions take seconds, not hours.',
      components: ['Impact Matrix', 'Sentiment Heatmap', 'Relative Strength Chart', 'Quick Filter'],
      sourceType: 'structure',
      appFitScore: 7,
      confidence: 0.78,
    });
  }

  for (const factor of raw.macroFactors || []) {
    if (!factor?.indicator) continue;
    const desc = s(factor.description);
    if (desc.length < 15) continue;
    add({
      ...namesForMacroFactor(factor.indicator),
      sourceInsight: `Macro indicator: ${s(factor.indicator)}`,
      userValue: `Clarifies what ${s(factor.indicator)} means for your positioning without parsing lengthy macro releases.`,
      shortDescription: desc,
      components: ['Indicator Card', 'Trend Chart', 'Dot Plot Visualizer', 'Alert Engine'],
      sourceType: 'macro',
      appFitScore: 7,
      confidence: 0.8,
    });
  }

  const warnings = (raw.warnings || []).map(s).filter((w) => w.length >= 20);
  if (warnings.length >= 2) {
    add({
      ...pair('מערכת התראות סיכון מאקרו', 'Macro Risk Alert System'),
      sourceInsight: warnings[0].slice(0, 80),
      userValue: 'Surfaces critical macro risks in one prioritized view so nothing important gets buried in long research.',
      shortDescription: warnings.slice(0, 4).join('. '),
      components: ['Warnings Feed', 'Risk Gauge', 'Macro Dashboard', 'Alert Banner'],
      sourceType: 'risk',
      appFitScore: 7,
      confidence: 0.76,
      reusabilityScore: 8,
    });
  }

  const insightLists = [
    ...(Array.isArray(utInsights) ? utInsights : []),
    ...(Array.isArray(utInsights.top5Insights) ? utInsights.top5Insights : []),
    ...(Array.isArray(utInsights.tradingInsights) ? utInsights.tradingInsights : []),
    ...(Array.isArray(marketBriefData.top5Insights) ? marketBriefData.top5Insights : []),
  ];
  for (const item of insightLists) {
    const text = typeof item === 'string' ? item : s(item?.text || item?.point || item?.insight);
    if (text.length < 25) continue;
    if (!/scanner|tracker|dashboard|מעקב|סורק|מדד|סקטור|fed|פד|מניה|stock|alert/i.test(text)) continue;
    const snippet = text.split(/[.:]/)[0].trim().slice(0, 40);
    const names = HEBREW_RE.test(snippet)
      ? pair(snippet, 'Insight-Driven Feature')
      : pair('פיצ׳ר מתובנת וידאו', snippet.length >= 8 ? snippet : 'Insight-Driven Feature');
    add({
      ...names,
      sourceInsight: text.slice(0, 90),
      userValue: 'Turns a one-off video insight into a reusable tool you can act on every trading day.',
      components: ['Insight Card', 'Trend Chart', 'Alert Engine', 'Watchlist'],
      sourceType: 'insight',
      appFitScore: 6,
      confidence: 0.68,
    });
  }

  for (const ind of utApp.newIndicators || []) {
    const text = s(ind);
    if (text.length < 25 || /מדד חדש|new indicator/i.test(text)) continue;
    const label = text.split('(')[0].trim().slice(0, 45);
    if (label.length < 8) continue;
    const names = HEBREW_RE.test(label)
      ? pair(label, `${label.replace(/[^\w\s]/g, '').slice(0, 24) || 'Custom'} Indicator`)
      : pair(`מדד ${label.slice(0, 20)}`, label);
    add({
      ...names,
      sourceInsight: text.slice(0, 90),
      userValue: 'Captures a novel market signal from the video before it becomes a widely watched indicator.',
      components: ['Indicator Card', 'Trend Chart', 'Benchmark Compare', 'Alert Engine'],
      sourceType: 'indicator',
      appFitScore: 6,
      confidence: 0.66,
    });
  }

  return ideas
    .sort((a, b) => {
      const worthOrder = { Yes: 3, Maybe: 2, No: 1 };
      const w = (worthOrder[b.worthBuilding] || 0) - (worthOrder[a.worthBuilding] || 0);
      if (w !== 0) return w;
      return (b.appFitScore || 0) - (a.appFitScore || 0);
    })
    .slice(0, 10);
}

/** Brief for pasting into the dedicated App Builder GEM (discovery → builder handoff). */
export function buildDiscoveryGemBrief(idea, video, topicName = '') {
  if (!idea) return '';
  const title = video?.title || 'הסרטון';
  const vId = video?.videoId || video?.id || '';
  const url = vId ? `https://www.youtube.com/watch?v=${encodeURIComponent(vId)}` : null;
  const comps = (idea.components || []).map((c) => `• ${c}`).join('\n');
  const nameHe = idea.titleHe || idea.productIdea;
  const nameEn = idea.titleEn || idea.productIdea;

  return [
    '# Feature Discovery — App Builder GEM Input',
    '',
    url ? `Video: ${url}` : null,
    `Title: ${title}`,
    topicName ? `Topic: ${topicName}` : null,
    '',
    '## Selected Feature Opportunity',
    `**Name (HE):** ${nameHe}`,
    `**Name (EN):** ${nameEn}`,
    `**Category:** ${idea.category || '—'} (${getCategoryDisplayLabel(idea.category)})`,
    `**Value proposition:** ${idea.valueDescription || idea.whatItDoes || '—'}`,
    `**Source insight:** ${idea.sourceInsight}`,
    `**Why it matters:** ${idea.whyItMatters}`,
    '',
    '## AI Builder Brief',
    idea.aiBuilderBrief || '—',
    '',
    '## Suggested Components',
    comps || '—',
    '',
    '## Evaluation',
    `• App Fit Score: ${idea.appFitScore}/10`,
    `• Reusability Score: ${idea.reusabilityScore}/10`,
    `• Worth building: ${idea.worthBuilding}`,
    '',
    '## Instructions for GEM',
    'Expand the AI Builder Brief above into a full PRD, technical specification, database schema (from Data Model), UI component tree and ordered development tasks.',
    'Honor conditional sections: Ranking / Scoring Logic and Alert / Automation Logic only when present.',
    'Use UI Layout for screen structure and Example User Story as the primary acceptance scenario.',
    'Discovery Confidence and Why This Is Worth Building inform MVP priority and scope decisions.',
    'Use the English technical name for component naming and code generation.',
    'Targets: App Builder GEM, Claude Code, Cursor, Codex, Base44, Lovable.',
    'Do NOT generate unrelated features — focus only on the selected opportunity above.',
  ].filter((line) => line !== null).join('\n').trim();
}
