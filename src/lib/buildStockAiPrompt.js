/**
 * Builds AI analysis prompts for Perplexity.
 * Entity-aware routing: stock, etf, index, commodity, crypto, macro, sector, sentiment.
 */
import { detectMarketEntityType, extractIndexNameFromItem } from '@/lib/detectMarketEntityType';

// ─────────────────────────────────────────────────────────────────────────────
// Legacy exports (kept unchanged for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export function buildStockAiPrompt(ticker) {
  const sym = String(ticker || '').toUpperCase().trim();
  if (!sym) return '';
  return (
    `Analyze ${sym} for a fast swing-trading decision. Return a compact table only.\n` +
    `Include: RSI, MACD, Bollinger Bands, EMA 20/50/200, volume/relative volume, ` +
    `support/resistance, trend score, momentum score, valuation, growth, profitability, ` +
    `debt/balance-sheet risk, analyst sentiment, key catalyst, key risk, ` +
    `and an overall score from 0 to 100.\n` +
    `Keep the explanation short and decision-oriented.`
  );
}

export function buildStockPerplexityUrl(ticker) {
  const prompt = buildStockAiPrompt(ticker);
  if (!prompt) return null;
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`;
}

export const PERPLEXITY_SPACE_URL =
  'https://www.perplexity.ai/spaces/stock-fast-decision-oOhCJwdnQKqXFNhAt5CVVw';

// ─────────────────────────────────────────────────────────────────────────────
// Entity-aware Perplexity Space prompt builder
// ─────────────────────────────────────────────────────────────────────────────

const _LANG =
  'ענה אך ורק בעברית. טבלאות RTL בלבד. אל תסביר — רק טבלאות.\n' +
  'כל שורה חייבת לכלול סטטוס צבע: 🟢 חיובי / 🟡 ניטרלי / 🔴 שלילי\n' +
  'עמודות: | פרמטר | נתון | 🔴🟡🟢 | פירוש קצר | ציון |';

const _CITE = 'ציין מקורות. תובנות עד 12 מילים. סיוע להחלטה בלבד.';

function _label(item) {
  return extractIndexNameFromItem(item) || String(item?.text || '').slice(0, 60) || '?';
}

function _stockEtfPrompt(label, isEtf) {
  const desc = isEtf ? 'קרן סל (ETF)' : 'מניה או קרן סל';
  return (
    `הצג את גרף המחיר / כרטיס ציטוט של ${label} אם זמין.\n\n` +
    `נתח את ${label} כ${desc}.\n\n` +
    `${_LANG}\n\n` +
    `## 1. החלטה מהירה\n\n` +
    `## 2. טכני\n` +
    `כלול: RSI, MACD, Bollinger Bands, EMA 20/50/200, נפח, נפח יחסי, תמיכה/התנגדות, מגמה, מומנטום\n\n` +
    `## 3. פנדמנטלי\n` +
    `כלול: P/E, Forward P/E, PEG, ROE/ROIC, צמיחת הכנסות, צמיחת EPS, מרווחים, FCF, חוב, אנליסטים\n\n` +
    `## 4. סיכונים וקטליזטורים\n` +
    `| גורם | פרטים | 🔴🟡🟢 | השפעה |\n\n` +
    `## ציון כולל\n` +
    `| ציון כולל (0-100) | ציון טכני | ציון פנדמנטלי | ציון סיכון | החלטה |\n` +
    `| --- | --- | --- | --- | מעקב / המתנה / להימנע / כניסה מעל טריגר |\n\n` +
    _CITE
  );
}

function _indexPrompt(label) {
  return (
    `הצג את גרף המחיר / כרטיס ציטוט של ${label} אם זמין.\n\n` +
    `נתח את ${label} כמדד שוק.\n\n` +
    `${_LANG}\n\n` +
    `## 1. החלטה מהירה\n\n` +
    `## 2. טכני\n` +
    `כלול: RSI, MACD, Bollinger Bands, EMA 20/50/200, תמיכה/התנגדות\n\n` +
    `## 3. רוחב שוק וסקטורים\n` +
    `כלול: breadth, סקטורים מובילים, סקטורים חלשים\n\n` +
    `## 4. מאקרו וסיכונים\n` +
    `כלול: רגישות ריביות, רגישות אינפלציה, תנודתיות, קטליזטור ראשי, סיכון ראשי, מה לבדוק\n\n` +
    `## מצב השוק\n` +
    `| ציון שוק (0-100) | מצב | מה לבדוק |\n` +
    `| --- | Risk-On / ניטרלי / Risk-Off / המתנה | --- |\n\n` +
    _CITE
  );
}

function _commodityPrompt(label) {
  return (
    `הצג את גרף המחיר / כרטיס ציטוט של ${label} אם זמין.\n\n` +
    `נתח את ${label} כסחורה.\n\n` +
    `${_LANG}\n\n` +
    `## 1. החלטה מהירה\n\n` +
    `## 2. טכני\n` +
    `כלול: RSI, MACD, Bollinger Bands, EMA 20/50/200, תמיכה/התנגדות\n\n` +
    `## 3. היצע / ביקוש / מאקרו\n` +
    `כלול: מלאים, ייצור, השפעת אינפלציה, השפעת דולר, סיכון גיאופוליטי, סקטורים מושפעים\n\n` +
    `## 4. סיכונים וקטליזטורים\n` +
    `| גורם | פרטים | 🔴🟡🟢 | השפעה |\n\n` +
    `## ציון סחורה (0-100) ומה לבדוק\n\n` +
    _CITE
  );
}

function _cryptoPrompt(label) {
  return (
    `הצג את גרף המחיר / כרטיס ציטוט של ${label} אם זמין.\n\n` +
    `נתח את ${label} כנכס קריפטו.\n\n` +
    `${_LANG}\n\n` +
    `## 1. החלטה מהירה\n\n` +
    `## 2. טכני\n` +
    `כלול: RSI, MACD, Bollinger Bands, EMA 20/50/200, נפח, תמיכה/התנגדות, מומנטום\n\n` +
    `## 3. סנטימנט ונזילות\n` +
    `כלול: Risk-On/Off, השפעת דולר, נזילות, קורלציה לנאסד"ק\n\n` +
    `## 4. סיכונים וקטליזטורים\n` +
    `| גורם | פרטים | 🔴🟡🟢 | השפעה |\n\n` +
    `## ציון קריפטו (0-100) ומה לבדוק\n\n` +
    _CITE
  );
}

function _macroPrompt(label) {
  return (
    `הצג גרף פרוקסי רלוונטי של ${label} אם זמין. אם אין גרף ישיר — השתמש בפרוקסי השוק הטוב ביותר.\n\n` +
    `נתח את ${label} כגורם מאקרו.\n\n` +
    `${_LANG}\n\n` +
    `## 1. החלטה מהירה\n` +
    `כלול: קריאה נוכחית, קריאה צפויה, כיוון הפתעה\n\n` +
    `## 2. נתון מאקרו\n` +
    `כלול: השפעה על אינפלציה, על ריביות, על הדולר\n\n` +
    `## 3. השפעה על שווקים\n` +
    `כלול: מדדים מושפעים, סקטורים מושפעים, מניות/ETFs מושפעים\n\n` +
    `## 4. סיכונים וקטליזטורים\n` +
    `| גורם | פרטים | 🔴🟡🟢 | השפעה |\n\n` +
    `## ציון השפעה כוללת (0-100) ומה לבדוק\n\n` +
    _CITE
  );
}

function _sectorPrompt(label) {
  return (
    `הצג את גרף המחיר / כרטיס ציטוט של קרן ה-${label} אם זמין.\n\n` +
    `נתח את ${label} כסקטור / קרן סל פרוקסי.\n\n` +
    `${_LANG}\n\n` +
    `## 1. החלטה מהירה\n\n` +
    `## 2. טכני\n` +
    `כלול: RSI, MACD, EMA 20/50/200, חוזק יחסי, תמיכה/התנגדות\n\n` +
    `## 3. רוטציה וסקטור\n` +
    `כלול: מניות מובילות, מניות חלשות, רוטציה סקטוריאלית, רגישות מאקרו\n\n` +
    `## 4. סיכונים וקטליזטורים\n` +
    `| גורם | פרטים | 🔴🟡🟢 | השפעה |\n\n` +
    `## ציון סקטור (0-100) ומה לבדוק\n\n` +
    _CITE
  );
}

function _sentimentPrompt(label) {
  return (
    `הצג גרף פרוקסי שוק של ${label} אם זמין. לסנטימנט כללי — השתמש ב-S&P 500 או VIX. לסנטימנט קריפטו — השתמש ב-Bitcoin.\n\n` +
    `נתח את ${label} כאות סנטימנט שוק.\n\n` +
    `${_LANG}\n\n` +
    `## 1. החלטה מהירה\n\n` +
    `## 2. סנטימנט\n` +
    `כלול: Fear/Greed, VIX/תנודתיות, Risk-On/Off, קמעונאים, מוסדיים\n\n` +
    `## 3. השפעה על נכסים\n` +
    `כלול: סקטורים מושפעים, נכסים מושפעים\n\n` +
    `## 4. סיכונים וקטליזטורים\n` +
    `| גורם | פרטים | 🔴🟡🟢 | השפעה |\n\n` +
    `## ציון סנטימנט כולל (0-100) ומה לבדוק\n\n` +
    _CITE
  );
}

function _buildSinglePrompt(item) {
  const entityType = detectMarketEntityType(item);
  const lbl = _label(item);
  if (!lbl) return '';
  switch (entityType) {
    case 'stock':     return _stockEtfPrompt(lbl, false);
    case 'etf':       return _stockEtfPrompt(lbl, true);
    case 'index':     return _indexPrompt(lbl);
    case 'commodity': return _commodityPrompt(lbl);
    case 'crypto':    return _cryptoPrompt(lbl);
    case 'macro':     return _macroPrompt(lbl);
    case 'sector':    return _sectorPrompt(lbl);
    case 'sentiment': return _sentimentPrompt(lbl);
    default:          return _stockEtfPrompt(lbl, false);
  }
}

function _multiPrompt(items) {
  const list = items.map((item) => `- ${_label(item)}`).join('\n');
  return (
    `נתח את הנכסים הבאים:\n${list}\n\n` +
    `לכל נכס, זהה אם מדובר במניה, קרן סל, מדד, סחורה, קריפטו, מאקרו, סקטור או אות סנטימנט.\n\n` +
    `הצג גרף / כרטיס ציטוט של הנכס הראשון אם זמין.\n\n` +
    `החזר טבלת השוואה קומפקטית בעברית RTL:\n` +
    `| נכס | סוג | מצב | 🔴🟡🟢 | ציון | מה לבדוק |\n\n` +
    `שורה תחתונה: [משפט עברית קצר אחד]\n\n` +
    _CITE
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Opportunity / Risk specialized prompt
// ─────────────────────────────────────────────────────────────────────────────

function _isOpportunity(item) {
  return item?.type === 'brief-opportunities' ||
    item?.tabScope === 'brief-opportunities' ||
    /הזדמנות|הזדמנויות/i.test(item?.sectionLabel || '');
}

function _isRisk(item) {
  return item?.type === 'brief-risks' ||
    item?.tabScope === 'brief-risks' ||
    /^סיכון|^סיכונים/i.test(item?.sectionLabel || '');
}

function _hasOpportunityOrRisk(items) {
  return items.some((item) => _isOpportunity(item) || _isRisk(item));
}

function _buildOpportunityRiskPrompt(items) {
  const opportunities = items.filter(_isOpportunity);
  const risks = items.filter(_isRisk);
  const others = items.filter((item) => !_isOpportunity(item) && !_isRisk(item));

  const header =
    'נתח את הפריטים הנבחרים מתוך מבזק השוק.\n' +
    'הסבר כל הזדמנות וכל סיכון בצורה פשוטה וברורה:\n' +
    '- מה זה אומר?\n' +
    '- למה זה חשוב?\n' +
    '- מי מושפע?\n' +
    '- מה יאשר את התרחיש?\n' +
    '- מה יבטל את התרחיש?\n' +
    '- מה לעקוב בהמשך?\n' +
    'אין לתת המלצת השקעה מחייבת.\n';

  const parts = [];

  if (opportunities.length > 0) {
    const lines = opportunities.map((item, i) => `${i + 1}. ${_label(item)}`).join('\n');
    parts.push(`הזדמנויות:\n${lines}`);
  }

  if (risks.length > 0) {
    const lines = risks.map((item, i) => `${i + 1}. ${_label(item)}`).join('\n');
    parts.push(`סיכונים:\n${lines}`);
  }

  if (others.length > 0) {
    const lines = others.map((item, i) => `${i + 1}. ${_label(item)}`).join('\n');
    parts.push(`אחר:\n${lines}`);
  }

  return `${header}\n${parts.join('\n\n')}\n\nנא לנתח בעברית בטבלה קומפקטית.`;
}

/**
 * Builds a ready-to-paste Perplexity Space analysis prompt for one or more
 * selected bulk items. Detects entity type and returns the appropriate prompt.
 * Self-contained — no reliance on Space system instructions.
 */
export function buildPerplexityAnalysisPrompt(selectedItems) {
  const items = Array.isArray(selectedItems) ? selectedItems.filter(Boolean) : [];
  if (items.length === 0) return '';
  if (_hasOpportunityOrRisk(items)) return _buildOpportunityRiskPrompt(items);
  if (items.length === 1) return _buildSinglePrompt(items[0]);
  return _multiPrompt(items);
}
