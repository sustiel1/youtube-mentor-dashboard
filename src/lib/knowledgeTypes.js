export const KNOWLEDGE_TYPES = [
  { id: 'Fundamental',     label: 'פונדמנטלי',        emoji: '📊', badge: 'text-green-700 dark:text-green-400',   filterActive: 'bg-green-600 text-white border-green-600',   filterIdle: 'bg-green-50 text-green-800 border-green-200 hover:border-green-300' },
  { id: 'Valuation',       label: 'תמחור',             emoji: '💰', badge: 'text-blue-700 dark:text-blue-400',       filterActive: 'bg-blue-600 text-white border-blue-600',     filterIdle: 'bg-blue-50 text-blue-800 border-blue-200 hover:border-blue-300' },
  { id: 'CashFlow',        label: 'תזרים מזומנים',     emoji: '💵', badge: 'text-teal-700 dark:text-teal-400',       filterActive: 'bg-teal-600 text-white border-teal-600',     filterIdle: 'bg-teal-50 text-teal-800 border-teal-200 hover:border-teal-300' },
  { id: 'FinancialHealth', label: 'חוסן פיננסי',       emoji: '🏦', badge: 'text-cyan-700 dark:text-cyan-400',       filterActive: 'bg-cyan-600 text-white border-cyan-600',     filterIdle: 'bg-cyan-50 text-cyan-800 border-cyan-200 hover:border-cyan-300' },
  { id: 'Profitability',   label: 'רווחיות',           emoji: '📈', badge: 'text-emerald-700 dark:text-emerald-400', filterActive: 'bg-emerald-600 text-white border-emerald-600', filterIdle: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-300' },
  { id: 'Growth',          label: 'צמיחה',             emoji: '🚀', badge: 'text-lime-700 dark:text-lime-400',       filterActive: 'bg-lime-600 text-white border-lime-600',     filterIdle: 'bg-lime-50 text-lime-800 border-lime-200 hover:border-lime-300' },
  { id: 'Macro',           label: 'מאקרו',             emoji: '🌍', badge: 'text-purple-700 dark:text-purple-400',   filterActive: 'bg-purple-600 text-white border-purple-600', filterIdle: 'bg-purple-50 text-purple-800 border-purple-200 hover:border-purple-300' },
  { id: 'Technical',       label: 'טכני',              emoji: '📉', badge: 'text-indigo-700 dark:text-indigo-400',   filterActive: 'bg-indigo-600 text-white border-indigo-600', filterIdle: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:border-indigo-300' },
  { id: 'Risk',            label: 'ניהול סיכונים',     emoji: '⚠️', badge: 'text-red-700 dark:text-red-400',         filterActive: 'bg-red-600 text-white border-red-600',       filterIdle: 'bg-red-50 text-red-800 border-red-200 hover:border-red-300' },
  { id: 'Strategy',        label: 'אסטרטגיה',          emoji: '🎯', badge: 'text-violet-700 dark:text-violet-400',   filterActive: 'bg-violet-600 text-white border-violet-600', filterIdle: 'bg-violet-50 text-violet-800 border-violet-200 hover:border-violet-300' },
  { id: 'Psychology',      label: 'פסיכולוגיה',        emoji: '🧠', badge: 'text-pink-700 dark:text-pink-400',       filterActive: 'bg-pink-600 text-white border-pink-600',     filterIdle: 'bg-pink-50 text-pink-800 border-pink-200 hover:border-pink-300' },
  { id: 'News',            label: 'חדשות',             emoji: '📰', badge: 'text-orange-700 dark:text-orange-400',   filterActive: 'bg-orange-600 text-white border-orange-600', filterIdle: 'bg-orange-50 text-orange-800 border-orange-200 hover:border-orange-300' },
  { id: 'KPI',             label: 'מדדים ו-KPI',       emoji: '📋', badge: 'text-amber-700 dark:text-amber-400',     filterActive: 'bg-amber-600 text-white border-amber-600',   filterIdle: 'bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-300' },
  { id: 'AppBuilding',     label: 'פיתוח אפליקציה',    emoji: '⚙️', badge: 'text-slate-600 dark:text-slate-400',     filterActive: 'bg-slate-700 text-white border-slate-700',   filterIdle: 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300' },
];

const TYPE_MAP = new Map(KNOWLEDGE_TYPES.map(t => [t.id, t]));

export function getKnowledgeTypeConfig(id) {
  return TYPE_MAP.get(id) ?? null;
}

// ── Keyword-based auto-inference ──────────────────────────────────────────────
const INFERENCE_RULES = [
  { id: 'Valuation',       kw: ['p/e', 'p/s', 'ev/ebitda', 'dcf', 'intrinsic value', 'fair value', 'מכפיל', 'תמחור', 'שווי', 'valuation'] },
  { id: 'CashFlow',        kw: ['cash flow', 'free cash', 'fcf', 'ocf', 'תזרים', 'מזומנים', 'operating cash'] },
  { id: 'FinancialHealth', kw: ['debt', 'leverage', 'liquidity', 'balance sheet', 'חוב', 'נזילות', 'מינוף', 'credit rating', 'solvency'] },
  { id: 'Profitability',   kw: ['margin', 'roe', 'roic', 'eps', 'net income', 'profit', 'מרווח', 'רווח', 'ebitda', 'gross margin'] },
  { id: 'Growth',          kw: ['growth', 'revenue growth', 'expansion', 'צמיחה', 'הכנסות', 'market share', 'scale', 'cagr'] },
  { id: 'Macro',           kw: ['inflation', 'interest rate', 'fed ', 'gdp', 'bonds', 'unemployment', 'אינפלציה', 'ריבית', 'מאקרו', 'recession', 'central bank', 'yield curve', 'macro'] },
  { id: 'Technical',       kw: ['support', 'resistance', 'chart', 'rsi', 'macd', 'moving average', 'trend', 'breakout', 'pattern', 'volume', 'טכני', 'candlestick'] },
  { id: 'Risk',            kw: ['risk', 'volatility', 'dilution', 'downside', 'סיכון', 'תנודתיות', 'danger', 'hazard', 'drawdown', 'bankruptcy'] },
  { id: 'Strategy',        kw: ['strategy', 'framework', 'portfolio', 'checklist', 'system', 'אסטרטגיה', 'תיק', 'מסגרת', 'allocation', 'position sizing'] },
  { id: 'Psychology',      kw: ['fear', 'greed', 'sentiment', 'behavior', 'emotion', 'crowd', 'bias', 'פחד', 'חמדנות', 'פסיכולוגיה', 'panic', 'euphoria', 'herd'] },
  { id: 'News',            kw: ['earnings', 'guidance', 'acquisition', 'lawsuit', 'regulation', 'quarterly report', 'דוחות', 'חדשות', 'merger', 'ipo', 'sec filing'] },
  { id: 'KPI',             kw: ['kpi', 'metric', 'formula', 'ratio', 'indicator', 'מדד', 'יחס', 'מדדים', 'calculate', 'measurement', 'benchmark'] },
  { id: 'AppBuilding',     kw: ['dashboard', 'automation', 'workflow', 'prompt', 'database', 'component', 'אפליקציה', 'אוטומציה', 'build', 'ui/ux', 'feature request', 'api endpoint'] },
  { id: 'Fundamental',     kw: ['business model', 'moat', 'competitive advantage', 'management quality', 'industry', 'מודל עסקי', 'יתרון תחרותי', 'ניהול', 'ענף', 'fundamentals'] },
];

export function inferKnowledgeTypes(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const found = [];
  for (const rule of INFERENCE_RULES) {
    if (rule.kw.some(kw => lower.includes(kw))) found.push(rule.id);
  }
  return found;
}

// ── Useful Knowledge shelf classification ─────────────────────────────────────

/**
 * Returns true if the text looks like a time-sensitive market fact — not evergreen.
 * These belong in "Temporary Market Facts", not mixed with reusable principles.
 */
export function isTemporaryMarketFact(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  // Ticker + specific price number: "GOOGL 349", "MSFT at 420"
  if (/\b[A-Z]{2,5}\s+(?:at\s+)?\d{3,}\b/.test(t)) return true;
  // Support/resistance at a specific level
  if (/(?:support|resistance|תמיכה|התנגדות)\s+(?:at|ב|ל|of)?\s*[\d,]+/i.test(t)) return true;
  // Macro data with specific current %: "inflation at 3.2%", "ריבית עמדה על 5.25%"
  if (/(?:inflation|אינפלציה|cpi|gdp|interest rate|ריבית|unemployment|אבטלה|pce)\s+(?:at|of|ב|ל|עומד על|עלה ל|is|stands at)?\s*[\d.]+%/i.test(t)) return true;
  // Fed/central bank rate decisions
  if (/(?:fed|federal reserve|הפד|בנק מרכזי|ecb|fomc).{0,40}(?:raised?|lowered?|cut|העלה|הוריד|הפחית|הקפיא).{0,20}\d/i.test(t)) return true;
  // Quarterly or annual time-bound data: "Q3 2024", "2025 forecast"
  if (/(?:Q[1-4]\s*\/?\s*\d{2,4}|רבעון\s+[א-ד]+\s*\d{2,4}|\b20[2-9]\d\s+(?:forecast|outlook|estimate|תחזית|projection))/.test(t)) return true;
  // Price targets
  if (/(?:price target|target price|מחיר יעד|tp:?)\s*[\$€£]?\s*\d+/i.test(t)) return true;
  // Specific % forecasts: "expected to reach 4%", "צפי ל-3.5%"
  if (/(?:forecast|תחזית|projection|expected to reach|צפי ל|expected at).{0,25}\d+\.?\d*%/i.test(t)) return true;
  return false;
}
