// Knowledge Library — fixed per-tab accumulation pages in localStorage + Obsidian vault.
// Parallel to the Brain save workflow; does NOT replace it.

import { buildObsidianOpenUrl, getConfiguredObsidianVaultName } from "@/lib/obsidianVaultConfig";
import { openObsidianUrl } from "@/lib/obsidianExport";

const STORAGE_KEY = "yt_knowledge_library_v1";
const LIBRARY_ROOT = "שוק ההון/ספריית ידע";

export const LEGACY_LIBRARY_PATHS = [
  "שוק ההון/כללים.md",
  "שוק ההון/מושגים.md",
  "שוק ההון/תובנות.md",
  "שוק ההון/אזהרות.md",
  "שוק ההון/KPI.md",
  "שוק ההון/פיצ'רים.md",
  "שוק ההון/פרומפטים.md",
  "שוק ההון/לאפליקציה שלי.md",
  "שוק ההון/טכני.md",
  "שוק ההון/פונדמנטלי.md",
  "שוק ההון/מאקרו.md",
  "שוק ההון/ניהול סיכונים.md",
  "שוק ההון/אסטרטגיות.md",
  "שוק ההון/חדשות.md",
];

export const FIXED_LIBRARY_PATHS = [
  `${LIBRARY_ROOT}/פונדמנטלי/מושגים.md`,
  `${LIBRARY_ROOT}/פונדמנטלי/כללים.md`,
  `${LIBRARY_ROOT}/פונדמנטלי/תובנות.md`,
  `${LIBRARY_ROOT}/פונדמנטלי/אזהרות.md`,
  `${LIBRARY_ROOT}/פונדמנטלי/KPI.md`,
  `${LIBRARY_ROOT}/פונדמנטלי/דוחות כספיים.md`,
  `${LIBRARY_ROOT}/פונדמנטלי/הערכת שווי.md`,
  `${LIBRARY_ROOT}/ניתוח טכני/מושגים.md`,
  `${LIBRARY_ROOT}/ניתוח טכני/כללים.md`,
  `${LIBRARY_ROOT}/ניתוח טכני/תובנות.md`,
  `${LIBRARY_ROOT}/ניתוח טכני/אזהרות.md`,
  `${LIBRARY_ROOT}/ניתוח טכני/תבניות גרף.md`,
  `${LIBRARY_ROOT}/ניתוח טכני/Price Action.md`,
  `${LIBRARY_ROOT}/אינדיקטורים/RSI.md`,
  `${LIBRARY_ROOT}/אינדיקטורים/MACD.md`,
  `${LIBRARY_ROOT}/אינדיקטורים/ADX.md`,
  `${LIBRARY_ROOT}/אינדיקטורים/EMA.md`,
  `${LIBRARY_ROOT}/אינדיקטורים/VWAP.md`,
  `${LIBRARY_ROOT}/אינדיקטורים/Bollinger Bands.md`,
  `${LIBRARY_ROOT}/אינדיקטורים/Ichimoku.md`,
  `${LIBRARY_ROOT}/אינדיקטורים/OBV.md`,
  `${LIBRARY_ROOT}/אינדיקטורים/ATR.md`,
  `${LIBRARY_ROOT}/אינדיקטורים/SuperTrend.md`,
  `${LIBRARY_ROOT}/אסטרטגיות/סווינג.md`,
  `${LIBRARY_ROOT}/אסטרטגיות/פריצות.md`,
  `${LIBRARY_ROOT}/אסטרטגיות/Momentum.md`,
  `${LIBRARY_ROOT}/אסטרטגיות/Gap Trading.md`,
  `${LIBRARY_ROOT}/אסטרטגיות/Pullback.md`,
  `${LIBRARY_ROOT}/אסטרטגיות/Trend Following.md`,
  `${LIBRARY_ROOT}/אסטרטגיות/שורט.md`,
  `${LIBRARY_ROOT}/ניהול סיכונים/אזהרות.md`,
  `${LIBRARY_ROOT}/ניהול סיכונים/גודל פוזיציה.md`,
  `${LIBRARY_ROOT}/ניהול סיכונים/Stop Loss.md`,
  `${LIBRARY_ROOT}/ניהול סיכונים/Risk Reward.md`,
  `${LIBRARY_ROOT}/ניהול סיכונים/Drawdown.md`,
  `${LIBRARY_ROOT}/ניהול סיכונים/Portfolio Risk.md`,
  `${LIBRARY_ROOT}/ניהול סיכונים/טעויות נפוצות.md`,
  `${LIBRARY_ROOT}/מאקרו/ריבית.md`,
  `${LIBRARY_ROOT}/מאקרו/אינפלציה.md`,
  `${LIBRARY_ROOT}/מאקרו/FED.md`,
  `${LIBRARY_ROOT}/מאקרו/אגח.md`,
  `${LIBRARY_ROOT}/מאקרו/אבטלה.md`,
  `${LIBRARY_ROOT}/מאקרו/GDP.md`,
  `${LIBRARY_ROOT}/מאקרו/מחזורי שוק.md`,
  `${LIBRARY_ROOT}/ניתוח חדשות/דוחות רבעוניים.md`,
  `${LIBRARY_ROOT}/ניתוח חדשות/Guidance.md`,
  `${LIBRARY_ROOT}/ניתוח חדשות/Insider Trading.md`,
  `${LIBRARY_ROOT}/ניתוח חדשות/M&A.md`,
  `${LIBRARY_ROOT}/ניתוח חדשות/רגולציה.md`,
  `${LIBRARY_ROOT}/ניתוח חדשות/אירועי שוק.md`,
  `${LIBRARY_ROOT}/הערכת שווי/DCF.md`,
  `${LIBRARY_ROOT}/הערכת שווי/P-E.md`,
  `${LIBRARY_ROOT}/הערכת שווי/PEG.md`,
  `${LIBRARY_ROOT}/הערכת שווי/EV-EBITDA.md`,
  `${LIBRARY_ROOT}/הערכת שווי/P-S.md`,
  `${LIBRARY_ROOT}/הערכת שווי/Margin of Safety.md`,
  `${LIBRARY_ROOT}/פסיכולוגיית מסחר/FOMO.md`,
  `${LIBRARY_ROOT}/פסיכולוגיית מסחר/Fear & Greed.md`,
  `${LIBRARY_ROOT}/פסיכולוגיית מסחר/Biases.md`,
  `${LIBRARY_ROOT}/פסיכולוגיית מסחר/Discipline.md`,
  `${LIBRARY_ROOT}/פסיכולוגיית מסחר/Emotional Trading.md`,
  `${LIBRARY_ROOT}/פסיכולוגיית מסחר/Mindset.md`,
  `${LIBRARY_ROOT}/סקטורים ותעשיות/AI.md`,
  `${LIBRARY_ROOT}/סקטורים ותעשיות/SaaS.md`,
  `${LIBRARY_ROOT}/סקטורים ותעשיות/Semiconductors.md`,
  `${LIBRARY_ROOT}/סקטורים ותעשיות/Cyber.md`,
  `${LIBRARY_ROOT}/סקטורים ותעשיות/Healthcare.md`,
  `${LIBRARY_ROOT}/סקטורים ותעשיות/Financials.md`,
  `${LIBRARY_ROOT}/סקטורים ותעשיות/Energy.md`,
  `${LIBRARY_ROOT}/סקטורים ותעשיות/Real Estate.md`,
  `${LIBRARY_ROOT}/ETF/SPY.md`,
  `${LIBRARY_ROOT}/ETF/QQQ.md`,
  `${LIBRARY_ROOT}/ETF/IWM.md`,
  `${LIBRARY_ROOT}/ETF/Sector ETFs.md`,
  `${LIBRARY_ROOT}/ETF/International ETFs.md`,
  `${LIBRARY_ROOT}/צ'קליסטים/צ'קליסט סווינג.md`,
  `${LIBRARY_ROOT}/צ'קליסטים/צ'קליסט פונדמנטלי.md`,
  `${LIBRARY_ROOT}/צ'קליסטים/צ'קליסט דוח כספי.md`,
  `${LIBRARY_ROOT}/צ'קליסטים/צ'קליסט כניסה.md`,
  `${LIBRARY_ROOT}/צ'קליסטים/צ'קליסט יציאה.md`,
  `${LIBRARY_ROOT}/AI והשקעות/Prompts.md`,
  `${LIBRARY_ROOT}/AI והשקעות/Agents.md`,
  `${LIBRARY_ROOT}/AI והשקעות/RAG.md`,
  `${LIBRARY_ROOT}/AI והשקעות/News Analysis.md`,
  `${LIBRARY_ROOT}/AI והשקעות/Earnings Analysis.md`,
  `${LIBRARY_ROOT}/AI והשקעות/AI Workflows.md`,
  `${LIBRARY_ROOT}/בניית אפליקציה/פיצ'רים.md`,
  `${LIBRARY_ROOT}/בניית אפליקציה/KPI.md`,
  `${LIBRARY_ROOT}/בניית אפליקציה/דשבורדים.md`,
  `${LIBRARY_ROOT}/בניית אפליקציה/UX Ideas.md`,
  `${LIBRARY_ROOT}/בניית אפליקציה/Database.md`,
  `${LIBRARY_ROOT}/בניית אפליקציה/Automations.md`,
  `${LIBRARY_ROOT}/בניית אפליקציה/Roadmap.md`,
  `${LIBRARY_ROOT}/בניית אפליקציה/Prompts.md`,
];

const SECTION_FILE_MAP = {
  definition: "מושגים.md",
  concepts: "מושגים.md",
  rule: "כללים.md",
  rules: "כללים.md",
  warning: "אזהרות.md",
  warnings: "אזהרות.md",
  insight: "תובנות.md",
  keyInsights: "תובנות.md",
  keyPoints: "תובנות.md",
  actionItems: "תובנות.md",
  learning: "תובנות.md",
  market: "תובנות.md",
  stock: "תובנות.md",
  opportunity: "תובנות.md",
  prompt: "פרומפטים.md",
  kpi: "KPI.md",
  feature: "פיצ'רים.md",
  app: "פיצ'רים.md",
  suggestedFeatures: "פיצ'רים.md",
};

const TYPE_PRIORITY = [
  "AppBuilding",
  "News",
  "Macro",
  "Risk",
  "Strategy",
  "Technical",
  "Valuation",
  "Fundamental",
  "Psychology",
  "KPI",
];

const TYPE_TO_FOLDER = {
  Fundamental: "פונדמנטלי",
  Valuation: "הערכת שווי",
  CashFlow: "פונדמנטלי",
  FinancialHealth: "פונדמנטלי",
  Profitability: "פונדמנטלי",
  Growth: "פונדמנטלי",
  Macro: "מאקרו",
  Technical: "ניתוח טכני",
  Risk: "ניהול סיכונים",
  Strategy: "אסטרטגיות",
  Psychology: "פסיכולוגיית מסחר",
  News: "ניתוח חדשות",
  KPI: "פונדמנטלי",
  AppBuilding: "בניית אפליקציה",
};

const SECTION_TO_FOLDER = {
  macro: "מאקרו",
  technical: "ניתוח טכני",
  prompt: "AI והשקעות",
  feature: "בניית אפליקציה",
  app: "בניית אפליקציה",
  suggestedFeatures: "בניית אפליקציה",
  kpi: "פונדמנטלי",
};

const KEYWORD_ROUTES = [
  { folder: "אינדיקטורים", file: "RSI.md", patterns: ["rsi"] },
  { folder: "אינדיקטורים", file: "MACD.md", patterns: ["macd"] },
  { folder: "אינדיקטורים", file: "ADX.md", patterns: ["adx"] },
  { folder: "אינדיקטורים", file: "EMA.md", patterns: [" ema", "ema ", "ema-", "ema_", "moving average", "ממוצע נע"] },
  { folder: "אינדיקטורים", file: "VWAP.md", patterns: ["vwap"] },
  { folder: "אינדיקטורים", file: "Bollinger Bands.md", patterns: ["bollinger", "בולינגר"] },
  { folder: "אינדיקטורים", file: "Ichimoku.md", patterns: ["ichimoku", "איצ'ימוקו", "איצימוקו"] },
  { folder: "אינדיקטורים", file: "OBV.md", patterns: ["obv"] },
  { folder: "אינדיקטורים", file: "ATR.md", patterns: ["atr"] },
  { folder: "אינדיקטורים", file: "SuperTrend.md", patterns: ["supertrend", "super trend"] },
  { folder: "אסטרטגיות", file: "סווינג.md", patterns: ["swing", "סווינג"] },
  { folder: "אסטרטגיות", file: "פריצות.md", patterns: ["breakout", "breakouts", "פריצה", "פריצות"] },
  { folder: "אסטרטגיות", file: "Momentum.md", patterns: ["momentum"] },
  { folder: "אסטרטגיות", file: "Gap Trading.md", patterns: ["gap trading", "gap", "גאפ"] },
  { folder: "אסטרטגיות", file: "Pullback.md", patterns: ["pullback", "פולבק"] },
  { folder: "אסטרטגיות", file: "Trend Following.md", patterns: ["trend following", "מגמה"] },
  { folder: "אסטרטגיות", file: "שורט.md", patterns: ["short", "שורט"] },
  { folder: "ניהול סיכונים", file: "גודל פוזיציה.md", patterns: ["position sizing", "גודל פוזיציה"] },
  { folder: "ניהול סיכונים", file: "Stop Loss.md", patterns: ["stop loss", "סטופ לוס"] },
  { folder: "ניהול סיכונים", file: "Risk Reward.md", patterns: ["risk reward", "risk/reward", "יחס סיכוי סיכון"] },
  { folder: "ניהול סיכונים", file: "Drawdown.md", patterns: ["drawdown", "דרואדאון"] },
  { folder: "ניהול סיכונים", file: "Portfolio Risk.md", patterns: ["portfolio risk", "סיכון תיק"] },
  { folder: "ניהול סיכונים", file: "טעויות נפוצות.md", patterns: ["mistake", "mistakes", "טעויות", "טעות"] },
  { folder: "מאקרו", file: "ריבית.md", patterns: ["interest rate", "rates", "ריבית"] },
  { folder: "מאקרו", file: "אינפלציה.md", patterns: ["inflation", "אינפלציה"] },
  { folder: "מאקרו", file: "FED.md", patterns: [" fed", "fomc", "federal reserve"] },
  { folder: "מאקרו", file: "אגח.md", patterns: ["bond", "bonds", "אגח", "אג\"ח", "yield"] },
  { folder: "מאקרו", file: "אבטלה.md", patterns: ["unemployment", "אבטלה", "jobless"] },
  { folder: "מאקרו", file: "GDP.md", patterns: ["gdp"] },
  { folder: "מאקרו", file: "מחזורי שוק.md", patterns: ["market cycle", "market cycles", "מחזור"] },
  { folder: "ניתוח חדשות", file: "דוחות רבעוניים.md", patterns: ["earnings", "quarterly", "דוחות", "רבעוני"] },
  { folder: "ניתוח חדשות", file: "Guidance.md", patterns: ["guidance"] },
  { folder: "ניתוח חדשות", file: "Insider Trading.md", patterns: ["insider"] },
  { folder: "ניתוח חדשות", file: "M&A.md", patterns: ["m&a", "merger", "acquisition"] },
  { folder: "ניתוח חדשות", file: "רגולציה.md", patterns: ["regulation", "sec", "regulator", "רגולציה"] },
  { folder: "ניתוח חדשות", file: "אירועי שוק.md", patterns: ["event", "catalyst", "אירוע שוק"] },
  { folder: "הערכת שווי", file: "DCF.md", patterns: ["dcf"] },
  { folder: "הערכת שווי", file: "P-E.md", patterns: ["p/e", "pe ratio", "מכפיל רווח"] },
  { folder: "הערכת שווי", file: "PEG.md", patterns: ["peg"] },
  { folder: "הערכת שווי", file: "EV-EBITDA.md", patterns: ["ev/ebitda", "ev ebitda"] },
  { folder: "הערכת שווי", file: "P-S.md", patterns: ["p/s", "price to sales"] },
  { folder: "הערכת שווי", file: "Margin of Safety.md", patterns: ["margin of safety"] },
  { folder: "פסיכולוגיית מסחר", file: "FOMO.md", patterns: ["fomo"] },
  { folder: "פסיכולוגיית מסחר", file: "Fear & Greed.md", patterns: ["fear", "greed"] },
  { folder: "פסיכולוגיית מסחר", file: "Biases.md", patterns: ["bias", "biases", "הטיה", "הטיות"] },
  { folder: "פסיכולוגיית מסחר", file: "Discipline.md", patterns: ["discipline", "משמעת"] },
  { folder: "פסיכולוגיית מסחר", file: "Emotional Trading.md", patterns: ["emotional", "emotion", "רגשי"] },
  { folder: "פסיכולוגיית מסחר", file: "Mindset.md", patterns: ["mindset", "מיינדסט"] },
  { folder: "סקטורים ותעשיות", file: "AI.md", patterns: ["ai "] },
  { folder: "סקטורים ותעשיות", file: "SaaS.md", patterns: ["saas"] },
  { folder: "סקטורים ותעשיות", file: "Semiconductors.md", patterns: ["semiconductor", "chip", "chips", "שבבים"] },
  { folder: "סקטורים ותעשיות", file: "Cyber.md", patterns: ["cyber"] },
  { folder: "סקטורים ותעשיות", file: "Healthcare.md", patterns: ["healthcare"] },
  { folder: "סקטורים ותעשיות", file: "Financials.md", patterns: ["financials", "banks", "banking"] },
  { folder: "סקטורים ותעשיות", file: "Energy.md", patterns: ["energy", "oil", "gas"] },
  { folder: "סקטורים ותעשיות", file: "Real Estate.md", patterns: ["real estate", "reit"] },
  { folder: "ETF", file: "SPY.md", patterns: ["spy"] },
  { folder: "ETF", file: "QQQ.md", patterns: ["qqq"] },
  { folder: "ETF", file: "IWM.md", patterns: ["iwm"] },
  { folder: "ETF", file: "Sector ETFs.md", patterns: ["sector etf", "sector etfs"] },
  { folder: "ETF", file: "International ETFs.md", patterns: ["international etf", "international etfs"] },
  { folder: "צ'קליסטים", file: "צ'קליסט סווינג.md", patterns: ["checklist swing", "צ'קליסט סווינג"] },
  { folder: "צ'קליסטים", file: "צ'קליסט פונדמנטלי.md", patterns: ["checklist fundamental", "צ'קליסט פונדמנטלי"] },
  { folder: "צ'קליסטים", file: "צ'קליסט דוח כספי.md", patterns: ["checklist earnings", "דוח כספי"] },
  { folder: "צ'קליסטים", file: "צ'קליסט כניסה.md", patterns: ["entry checklist", "צ'קליסט כניסה"] },
  { folder: "צ'קליסטים", file: "צ'קליסט יציאה.md", patterns: ["exit checklist", "צ'קליסט יציאה"] },
  { folder: "AI והשקעות", file: "Prompts.md", patterns: ["prompt", "prompts"] },
  { folder: "AI והשקעות", file: "Agents.md", patterns: ["agent", "agents"] },
  { folder: "AI והשקעות", file: "RAG.md", patterns: ["rag"] },
  { folder: "AI והשקעות", file: "News Analysis.md", patterns: ["news analysis"] },
  { folder: "AI והשקעות", file: "Earnings Analysis.md", patterns: ["earnings analysis"] },
  { folder: "AI והשקעות", file: "AI Workflows.md", patterns: ["workflow", "workflows"] },
  { folder: "בניית אפליקציה", file: "Prompts.md", patterns: ["prompt", "prompts"] },
  { folder: "בניית אפליקציה", file: "פיצ'רים.md", patterns: ["feature", "features", "פיצ'ר", "פיצ'רים"] },
  { folder: "בניית אפליקציה", file: "KPI.md", patterns: ["kpi"] },
  { folder: "בניית אפליקציה", file: "דשבורדים.md", patterns: ["dashboard", "dashboards", "דשבורד"] },
  { folder: "בניית אפליקציה", file: "UX Ideas.md", patterns: ["ux", "ui", "user experience"] },
  { folder: "בניית אפליקציה", file: "Database.md", patterns: ["database", "schema", "db"] },
  { folder: "בניית אפליקציה", file: "Automations.md", patterns: ["automation", "automations", "workflow"] },
  { folder: "בניית אפליקציה", file: "Roadmap.md", patterns: ["roadmap"] },
];

function buildLibraryPath(folder, file) {
  return `${LIBRARY_ROOT}/${folder}/${file}`;
}

function normalizeHaystack(value) {
  return String(value || "").toLowerCase();
}

function inferFolderFromTypes(knowledgeTypes = [], sectionKey = null) {
  for (const typeId of TYPE_PRIORITY) {
    if (knowledgeTypes.includes(typeId) && TYPE_TO_FOLDER[typeId]) return TYPE_TO_FOLDER[typeId];
  }
  for (const typeId of knowledgeTypes) {
    if (TYPE_TO_FOLDER[typeId]) return TYPE_TO_FOLDER[typeId];
  }
  return SECTION_TO_FOLDER[String(sectionKey || "")] || null;
}

function findKeywordRoute({ text, itemKey, knowledgeTypes = [] }) {
  const haystack = normalizeHaystack(`${itemKey || ""} ${text || ""}`);
  const prioritizedRoutes = knowledgeTypes.includes("AppBuilding")
    ? [
        ...KEYWORD_ROUTES.filter((route) => route.folder === "בניית אפליקציה"),
        ...KEYWORD_ROUTES.filter((route) => route.folder !== "בניית אפליקציה"),
      ]
    : KEYWORD_ROUTES;
  for (const route of prioritizedRoutes) {
    if (route.patterns.some((pattern) => haystack.includes(normalizeHaystack(pattern)))) {
      if (route.folder === "בניית אפליקציה" && !knowledgeTypes.includes("AppBuilding")) continue;
      return route;
    }
  }
  return null;
}

function resolveFolderDefaultFile(folder, sectionKey, knowledgeTypes = []) {
  const sectionFile = SECTION_FILE_MAP[String(sectionKey || "")];
  if (folder === "בניית אפליקציה") {
    if (sectionKey === "prompt") return "Prompts.md";
    if (sectionKey === "kpi" || knowledgeTypes.includes("KPI")) return "KPI.md";
    return "פיצ'רים.md";
  }
  if (folder === "פונדמנטלי") {
    if (sectionKey === "kpi" || knowledgeTypes.includes("KPI")) return "KPI.md";
    return sectionFile || "תובנות.md";
  }
  if (folder === "ניתוח טכני") return sectionFile || "תובנות.md";
  if (folder === "ניהול סיכונים") return sectionFile || "אזהרות.md";
  if (folder === "מאקרו") return "מחזורי שוק.md";
  if (folder === "ניתוח חדשות") return "אירועי שוק.md";
  if (folder === "הערכת שווי") return "DCF.md";
  if (folder === "פסיכולוגיית מסחר") return "Mindset.md";
  return sectionFile || "תובנות.md";
}

export function resolveLibraryRoute({ sectionKey = null, knowledgeTypes = [], text = "", itemKey = null } = {}) {
  const types = Array.isArray(knowledgeTypes) ? knowledgeTypes.filter(Boolean) : [];
  const keywordRoute = findKeywordRoute({ text, itemKey, knowledgeTypes: types });
  let targetPath = null;

  if (keywordRoute) {
    targetPath = buildLibraryPath(keywordRoute.folder, keywordRoute.file);
  } else {
    const folder = inferFolderFromTypes(types, sectionKey) || "פונדמנטלי";
    const file = resolveFolderDefaultFile(folder, sectionKey, types);
    targetPath = buildLibraryPath(folder, file);
  }

  return { itemKey, sectionKey, knowledgeTypes: types, targetPath };
}

export function getLibraryPagePath(categoryKey) {
  return resolveLibraryRoute({ sectionKey: categoryKey }).targetPath;
}

export function getLibraryPathFromTypes(knowledgeTypes = []) {
  return resolveLibraryRoute({ knowledgeTypes }).targetPath;
}

export function getLibraryPathForItem(sectionKeyOrOptions, knowledgeTypes = []) {
  if (sectionKeyOrOptions && typeof sectionKeyOrOptions === "object" && !Array.isArray(sectionKeyOrOptions)) {
    const route = resolveLibraryRoute(sectionKeyOrOptions);
    if (sectionKeyOrOptions.log === true) {
      console.log("[KnowledgeLibrary] resolved route", route);
    }
    return route.targetPath;
  }
  return resolveLibraryRoute({ sectionKey: sectionKeyOrOptions, knowledgeTypes }).targetPath;
}

function readLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}

function writeLibrary(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[knowledgeLibrary] write failed:", e?.message || e);
  }
}

function normalize(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

let ensureVaultFilesPromise = null;

/** Create missing fixed library pages in the Obsidian vault (dev server only). */
export function ensureKnowledgeLibraryVaultFiles() {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, skipped: true });
  }
  if (!ensureVaultFilesPromise) {
    ensureVaultFilesPromise = fetch("/api/vault/knowledge-library/ensure", { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        console.log("[KnowledgeLibrary] ensure fixed files", data);
        if (Array.isArray(data?.migrationReport?.foundLegacy) && data.migrationReport.foundLegacy.length > 0) {
          console.warn("[KnowledgeLibrary] migration report", data.migrationReport);
        }
        return data;
      })
      .catch((err) => {
        console.warn("[KnowledgeLibrary] ensure fixed files failed:", err?.message || err);
        return { ok: false, error: err?.message || "network error" };
      });
  }
  return ensureVaultFilesPromise;
}

/**
 * Append a single knowledge item to the matching fixed library page (localStorage).
 * @returns {{ saved: boolean, isDuplicate: boolean, path: string|null }}
 */
export function appendToLibrary({ text, categoryKey, path: directPath, videoTitle, channel, date, url }) {
  const path = directPath || getLibraryPagePath(categoryKey);
  if (!path) return { saved: false, isDuplicate: false, path: null };

  const norm = normalize(text);
  if (!norm) return { saved: false, isDuplicate: false, path };

  const lib = readLibrary();
  if (!lib[path]) lib[path] = { items: [] };

  const exists = lib[path].items.some(item => normalize(item.text) === norm);
  if (exists) return { saved: false, isDuplicate: true, path };

  lib[path].items.push({
    text: norm,
    source: {
      videoTitle: videoTitle || null,
      channel: channel || null,
      date: date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      url: url || null,
    },
    savedAt: new Date().toISOString(),
  });

  writeLibrary(lib);
  return { saved: true, isDuplicate: false, path };
}

export function isInLibrary(text, categoryKey) {
  const path = getLibraryPagePath(categoryKey);
  if (!path) return false;
  const lib = readLibrary();
  const page = lib[path];
  if (!page?.items) return false;
  const norm = normalize(text);
  return page.items.some(item => normalize(item.text) === norm);
}

export function getLibraryContents() {
  return readLibrary();
}

export function getLibraryPageContents(path) {
  return readLibrary()[path] ?? null;
}

const KB_SETTINGS_KEY = "yt_kb_settings_v1";

export function isInLibraryAtPath(text, path) {
  if (!path) return false;
  const lib = readLibrary();
  const page = lib[path];
  if (!page?.items) return false;
  const norm = normalize(text);
  return page.items.some(item => normalize(item.text) === norm);
}

/** Open a library page in Obsidian — same URL builder as Brain save. */
export function openInObsidian(filePath, vaultName = getConfiguredObsidianVaultName()) {
  const url = buildObsidianOpenUrl(filePath, vaultName);
  if (!url) return;
  console.log("[KnowledgeLibrary] open url", url);
  openObsidianUrl(url, { bypassDedupe: true });
}

/**
 * Write to vault first, verify, then mirror to localStorage.
 * @returns {Promise<{ saved, isDuplicate, path, vaultWritten, verified, vaultError, obsidianUrl }>}
 */
export async function appendToLibraryAndVault({ text, categoryKey, path: directPath, videoTitle, channel, date, url }) {
  const targetPath = directPath || getLibraryPagePath(categoryKey);
  const vaultName = getConfiguredObsidianVaultName();
  const writeMethod = "/api/vault/append";

  console.log("[KnowledgeLibrary] targetPath", targetPath);
  console.log("[KnowledgeLibrary] using write method", writeMethod);

  if (!targetPath) {
    return {
      saved: false,
      isDuplicate: false,
      path: null,
      vaultWritten: false,
      verified: false,
      vaultError: "no target path",
      obsidianUrl: null,
    };
  }

  let vaultWritten = false;
  let verified = false;
  let vaultError = null;
  let writeResult = null;
  let isDuplicateInVault = false;

  try {
    const normalizedTargetPath = String(targetPath).replace(/\\/g, "/").replace(/^\/+/, "");
    const pathParts = normalizedTargetPath.split("/");
    const manualFile = pathParts.pop() || "";
    const manualFolder = pathParts.join("/");
    const normalizedText = normalize(text);

    await ensureKnowledgeLibraryVaultFiles();

    const res = await fetch("/api/vault/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: null,
        videoTitle: videoTitle || null,
        channelTitle: channel || null,
        keyPoints: [normalizedText],
        tags: [],
        manualFolder,
        manualFile,
        verifyKeyPoints: [normalizedText],
        channel: channel || null,
        date: date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        url: url || null,
      }),
    });
    writeResult = await res.json().catch(() => ({}));
    verified = writeResult?.verified === true;
    vaultWritten = verified;
    isDuplicateInVault = writeResult?.alreadyExists === true;
    if (!verified) {
      vaultError = writeResult?.error || "לא הצלחתי ליצור או לעדכן את קובץ Obsidian";
    }
  } catch (err) {
    vaultError = err.message || "לא הצלחתי ליצור או לעדכן את קובץ Obsidian";
  }

  console.log("[KnowledgeLibrary] write result", writeResult);
  console.log("[KnowledgeLibrary] verification result", verified);

  const obsidianUrl = verified ? buildObsidianOpenUrl(targetPath, vaultName) : null;

  let localResult = { saved: false, isDuplicate: false, path: targetPath };
  if (verified) {
    localResult = appendToLibrary({
      text,
      path: targetPath,
      videoTitle,
      channel,
      date,
      url,
    });
    if (localResult.isDuplicate || isDuplicateInVault) {
      localResult = { saved: true, isDuplicate: true, path: targetPath };
    }
  }

  return {
    ...localResult,
    path: targetPath,
    vaultWritten,
    verified,
    vaultError,
    obsidianUrl,
  };
}

export function getKBSettings() {
  try {
    const raw = localStorage.getItem(KB_SETTINGS_KEY);
    const vault = getConfiguredObsidianVaultName();
    return { autoOpenObsidian: false, obsidianVault: vault, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { autoOpenObsidian: false, obsidianVault: getConfiguredObsidianVaultName() };
  }
}

export function setKBSettings(partial) {
  try {
    localStorage.setItem(KB_SETTINGS_KEY, JSON.stringify({ ...getKBSettings(), ...partial }));
  } catch (e) { console.warn("[knowledgeLibrary] settings write failed:", e?.message); }
}

export function exportLibraryPageAsMarkdown(path) {
  const lib = readLibrary();
  const page = lib[path];
  if (!page?.items?.length) return null;

  const pageName = path.replace(/\.md$/, "").split("/").pop();
  const lines = [`# ${pageName}`, "", `> מאגר ידע — ${page.items.length} פריטים`, "", "---", ""];

  page.items.forEach((item, idx) => {
    lines.push(`## פריט ${idx + 1}`, "");
    lines.push(item.text, "");
    if (item.source) {
      const { videoTitle: vt, channel: ch, date: dt, url: u } = item.source;
      const parts = [
        vt ? `📹 ${vt}` : null,
        ch ? `📺 ${ch}` : null,
        dt ? `📅 ${dt}` : null,
        u  ? `🔗 [צפה ביוטיוב](${u})` : null,
      ].filter(Boolean);
      if (parts.length) { lines.push("> " + parts.join(" · "), ""); }
    }
  });

  return lines.join("\n");
}
