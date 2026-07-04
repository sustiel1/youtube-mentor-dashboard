/**
 * Generates arrays of contextual Hebrew Perplexity questions for selected market brief items.
 *
 * Unlike aiAnalysisQuestionBank.js (which builds a single analysis prompt),
 * this module returns 4-6 stand-alone questions the user can browse, select,
 * and paste into Perplexity one at a time.
 *
 * Each question: { id: string, text: string, templateType: string }
 */

// ── Regex patterns (mirrors aiAnalysisQuestionBank.js logic) ─────────────────

const _RE_STOCK_WORDS =
  /המניה|מנייה|מניות|פרמרקט|אחרי.{0,3}שעות|לאחר.{0,3}שעות|\bEPS\b|רווח.{0,3}למניה|שווי.{0,3}שוק|דוח.{0,3}רבעוני|הנפקה|\bIPO\b/i;

const _RE_STOCK_MOVE =
  /זינקה|קפצה|צנחה|נפלה|ירדה.{0,4}%|עלתה.{0,4}%|גאפ.{0,4}(למעלה|למטה)|נסחרת.{0,4}סביב/i;

const _RE_HE_COMPANY =
  /(מטה|אפל|אמזון|גוגל|אלפבית|מיקרוסופט|נבידיה|טסלה|נטפליקס|אינטל|ברודקום|קוואלקום|אורקל|סיילספורס|ספוטיפיי|אובר|ליפט|שופיפיי|סנאפ)/i;

const _RE_EN_TICKER = /\b([A-Z]{2,5})\b/;

const _NON_STOCK_CAPS = new Set([
  'AI','VC','PE','US','EU','UK','IPO','ICO','ETF','VIX','DXY','CPI','PCE',
  'PPI','GDP','FED','FOMC','CEO','CFO','COO','ESG','EPS','FCF','ROE','ROI',
  'YOY','QOQ','TTM','LTM','RTL','RTX','SPX','NDX','DJI','HIV','FDA','SEC',
  'NFP','ISM','PMI','PCE',
]);

const _RE_MARKET_WIDE =
  /\bS&P\b|SP.{0,2}500|נאסד["ק]?|\bNASDAQ\b|\bNasdaq\b|\bDow\b|דאו\s*ג'ונס|ראסל|\bRussell\b|\bVIX\b|\bDXY\b|תשואות?\s*(10|שנה)|10Y|שוק.{0,4}הרחב|רוחב.{0,4}שוק|\bSPY\b|\bQQQ\b|\bIWM\b/i;

const _RE_SECTOR =
  /\bAI\b|בינה.{0,4}מלאכותית|\bLLM\b|ענן|\bcloud\b|\bAWS\b|\bAzure\b|\bGCP\b|מוליכים.{0,4}למחצה|שבבים|\bchips\b|\bSMH\b|בנקים|בנקאי|ריבית.{0,6}פד|אנרגיה|נפט|גז\s|\bOil\b|ביטקוין|\bbitcoin\b|קריפטו|\bcrypto\b|\bBTC\b|אג["']ח|\bbonds?\b|ביומד|\bbiotech\b|פארמ|pharma|סייבר|cyber|נדל"ן|\bREIT\b/i;

const _RE_RISK =
  /נשבר|חולשה|אזהרה|לחץ.{0,6}מכירה|ירידה.{0,4}חדה|קריסה|סיכון.{0,4}גבוה|\bbearish\b|sell.{0,4}off|תיקון.{0,6}(חד|שוק)|\bcorrection\b|מימוש.{0,4}חד/i;

const _RE_MACRO =
  /\bCPI\b|\bPCE\b|\bPPI\b|\bGDP\b|\bFed\b|\bFOMC\b|אינפלציה|inflation|ריבית|interest.{0,4}rate|תעסוקה|unemployment|payroll|\bJobs\b|\bNFP\b|\bISM\b|\bPMI\b/i;

// ── Content type detection ────────────────────────────────────────────────────

function _hasEnTicker(text) {
  const m = text.match(_RE_EN_TICKER);
  return m ? !_NON_STOCK_CAPS.has(m[1]) : false;
}

function _detectContentType(texts) {
  const combined = texts.join(' ');
  if (_RE_STOCK_WORDS.test(combined)) return 'stock';
  if (_RE_STOCK_MOVE.test(combined) && (_RE_HE_COMPANY.test(combined) || _hasEnTicker(combined))) return 'stock';
  if (_RE_MARKET_WIDE.test(combined)) return 'market';
  if (_RE_SECTOR.test(combined)) return 'sector';
  if (_RE_MACRO.test(combined)) return 'macro';
  if (_RE_RISK.test(combined)) return 'risk';
  return null;
}

function _detectSectionType(sectionLabels) {
  const combined = sectionLabels.join(' ');
  if (/חדשות/i.test(combined)) return 'news';
  if (/לוח.{0,4}כלכלי|אירועי.{0,4}מאקרו/i.test(combined)) return 'calendar';
  if (/הזדמנות/i.test(combined)) return 'opportunity';
  if (/^סיכון|^סיכונים/i.test(combined)) return 'risk';
  if (/מניות/i.test(combined)) return 'stock';
  if (/סקטור/i.test(combined)) return 'sector';
  if (/מצב.{0,4}שוק/i.test(combined)) return 'market';
  return null;
}

// ── Entity + theme extraction ─────────────────────────────────────────────────

function _extractEntityName(texts) {
  const combined = texts.join(' ');
  const heMatch = combined.match(_RE_HE_COMPANY);
  if (heMatch) return heMatch[0];
  const words = combined.split(/[\s,;:()\[\]"']+/);
  for (const w of words) {
    if (/^[A-Z]{2,5}$/.test(w) && !_NON_STOCK_CAPS.has(w)) return w;
  }
  return null;
}

function _extractThemes(texts) {
  const combined = texts.join(' ');
  const themes = [];
  if (/ענן|cloud|AWS|Azure|GCP/i.test(combined)) themes.push('cloud');
  if (/\bAI\b|בינה.{0,4}מלאכותית|LLM|גנרטיב|gen.?ai/i.test(combined)) themes.push('ai');
  if (/פרמרקט|pre.{0,3}market|אחרי.{0,4}שעות|after.{0,4}hours/i.test(combined)) themes.push('premarket');
  if (/דוח|רבעוני|earnings|EPS|הכנסות|revenue/i.test(combined)) themes.push('earnings');
  if (/דיבידנד|רכישה.{0,4}עצמית|buyback/i.test(combined)) themes.push('shareholder');
  if (/מיזוג|רכישה|acquisition|M&A/i.test(combined)) themes.push('ma');
  if (/ריבית|Fed|FOMC|אינפלציה|inflation|CPI|PCE/i.test(combined)) themes.push('rates');
  if (/גיאו|מלחמה|war|סנקציה|sanction|tariff/i.test(combined)) themes.push('geopolitical');
  if (/ביטקוין|bitcoin|קריפטו|crypto|\bETH\b|\bBTC\b/i.test(combined)) themes.push('crypto');
  if (/נפט|oil|energy|אנרגיה/i.test(combined)) themes.push('energy');
  return themes;
}

function _extractSectorName(texts) {
  const combined = texts.join(' ');
  const pairs = [
    [/\bAI\b|בינה.{0,4}מלאכותית/i, 'AI'],
    [/ענן|cloud/i, 'ענן (Cloud)'],
    [/מוליכים.{0,4}למחצה|שבבים|chips|SMH/i, 'מוליכים למחצה'],
    [/בנקים|banking/i, 'בנקאות'],
    [/אנרגיה|energy/i, 'אנרגיה'],
    [/ביטקוין|crypto/i, 'קריפטו'],
    [/ביומד|biotech/i, 'ביוטכנולוגיה'],
    [/סייבר|cyber/i, 'סייבר'],
    [/נדל"ן|REIT/i, 'נדל"ן'],
    [/pharma|פארמ/i, 'פארמה'],
  ];
  for (const [re, name] of pairs) {
    if (re.test(combined)) return name;
  }
  return null;
}

// ── Question builders ─────────────────────────────────────────────────────────

function _q(i, templateType, text) {
  return { id: `q-${i}`, templateType, text };
}

function _stockQuestions(entity, themes) {
  const name = entity || 'המניה';
  const ref = entity ? `מניית ${entity}` : 'המניה';
  const q = [];

  // Catalyst — premarket / earnings / generic
  if (themes.includes('premarket')) {
    q.push(_q(q.length, 'catalyst',
      `מה הקטליזטור שגרם לתנועה ב${ref} בפרמרקט? האם הוא נתמך בחדשות רשמיות, הודעת חברה, או שינוי תחזית?`));
  } else if (themes.includes('earnings')) {
    q.push(_q(q.length, 'catalyst',
      `מה היה בדוח ${name} שהפתיע את השוק? מה ה-beat/miss ב-EPS ובהכנסות ביחס לקונצנזוס?`));
  } else {
    q.push(_q(q.length, 'catalyst',
      `מה הקטליזטור האחרון שגרם לתנועה ב${ref}? האם הוא נתמך בדוחות, תחזיות, או חדשות רשמיות?`));
  }

  // Technical
  q.push(_q(q.length, 'technical',
    `האם התנועה ב${ref} נראית כמו תגובת יתר קצרת טווח או שינוי מגמה מבוסס? בדוק: מחיר, נפח, EMA 20/50/200, תמיכות והתנגדויות מרכזיות.`));

  // Competitive — AI/cloud-specific vs. generic
  if (themes.includes('ai') && themes.includes('cloud')) {
    q.push(_q(q.length, 'competitive',
      `כיצד ${name} מתחרה בתחומי ה-AI והענן מול Amazon, Microsoft ו-Google? מה הבידול, ה-CapEx היחסי ושולי הרווח?`));
  } else if (themes.includes('ai')) {
    q.push(_q(q.length, 'competitive',
      `מה עומק ה-AI stack של ${name} ביחס למתחרות? מי מוביל ומה הפוטנציאל להכנסות AI בשנתיים הקרובות?`));
  } else {
    q.push(_q(q.length, 'competitive',
      `כיצד ${ref} משתווה למתחרות הישירות מבחינת הכנסות, שולי רווח, ו-CapEx? מי מוביל את הנרטיב הסקטוריאלי?`));
  }

  // Risk — AI / earnings / generic
  if (themes.includes('ai') || themes.includes('cloud')) {
    q.push(_q(q.length, 'risk',
      `מהם הסיכונים המרכזיים לתזת ה-AI והענן של ${name}? מה עלול לפגוע בתמחור ברבעונים הקרובים?`));
  } else if (themes.includes('earnings')) {
    q.push(_q(q.length, 'risk',
      `מה הסיכונים לדוחות הבאים של ${name}? מה הקונצנזוס ומה עלול להפתיע כלפי מטה?`));
  } else {
    q.push(_q(q.length, 'risk',
      `מהם הסיכונים המרכזיים לתזה של ${ref}? מה הטריגרים שיכולים לשנות את הכיוון?`));
  }

  // Monitor
  if (themes.includes('ai') || themes.includes('cloud')) {
    q.push(_q(q.length, 'monitor',
      `אילו KPIs ונתונים לעקוב כדי לדעת אם ה-AI של ${name} מתחיל להפוך להכנסות ממשיות ולשיפור שולי רווח?`));
  } else {
    q.push(_q(q.length, 'monitor',
      `אילו נתונים, רמות מחיר ואירועים לעקוב ב${ref} כדי לאשר או לבטל את הכיוון הנוכחי?`));
  }

  return q;
}

function _marketQuestions() {
  return [
    _q(0, 'macro',
      'מה הכיוון הנוכחי של שוק המניות — Risk-On, ניטרלי, Risk-Off, או המתנה? מה מדדי הרוחב (breadth) ו-VIX אומרים?'),
    _q(1, 'sector',
      'אילו סקטורים מובילים ואילו מפגרים כרגע? מה הרוטציה הסקטוריאלית מסמנת על כיוון השוק הרחב?'),
    _q(2, 'macro',
      'מה ההשפעה של הנתונים המאקרו האחרונים (ריבית, אינפלציה, תעסוקה) על ציפיות הפד ועל הדולר?'),
    _q(3, 'technical',
      'מה רמות המפתח ב-S&P 500 ו-NASDAQ לצפות אליהן — תמיכה, התנגדות, ופריצה עם נפח?'),
    _q(4, 'monitor',
      'אילו נכסים נהנים ואילו סובלים בסביבה המאקרו הנוכחית? מה ה-trade עם יחס הסיכוי-סיכון הטוב ביותר?'),
  ];
}

function _sectorQuestions(sectorName) {
  const sec = sectorName || 'הסקטור';
  return [
    _q(0, 'sector',
      `מה הכוח היחסי של ${sec} ביחס לשוק הרחב כרגע? מה הגרף של ה-ETF המייצג מראה מבחינת מגמה ומומנטום?`),
    _q(1, 'sector',
      `אילו מניות מובילות ב${sec} ואילו מפגרות? מה מאחורי הפערים ומה זה מסמן?`),
    _q(2, 'macro',
      `האם יש רוטציה לתוך ${sec} או ממנו כרגע? מה הנרטיב המאקרו ותנאי הריבית שמאחורי זה?`),
    _q(3, 'risk',
      `מהם הסיכונים המרכזיים ל${sec} בחודשים הקרובים? מה הטריגרים לשינוי הכיוון?`),
    _q(4, 'monitor',
      `אילו נתונים, ETFs ומניות לעקוב כדי להעריך את המשך המגמה ב${sec}?`),
  ];
}

function _macroQuestions(themes) {
  const q = [];
  if (themes.includes('rates')) {
    q.push(_q(q.length, 'macro',
      'מה הציפיות הנוכחיות לגבי מדיניות הפד? מה הסבירות לשינוי ריבית בישיבות הקרובות לפי CME FedWatch?'));
    q.push(_q(q.length, 'macro',
      'כיצד הנתון המאקרו האחרון (CPI/PCE/NFP) שינה את ציפיות השוק לריבית? מה ה-dovish/hawkish pivot?'));
  } else {
    q.push(_q(q.length, 'macro',
      'מה ההשלכות של הנתון המאקרו הזה על ציפיות הפד, הדולר ואג"ח ה-10 שנה?'));
  }
  q.push(_q(q.length, 'sector',
    'אילו סקטורים, מדדים ונכסים מושפעים ישירות מהנתון המאקרו הזה? מה הכיוון המוקדם?'));
  q.push(_q(q.length, 'technical',
    'מה הרמות הטכניות ב-S&P 500 ובאג"ח ה-10 שנה שיאשרו את ההשפעה של הנתון הזה?'));
  q.push(_q(q.length, 'monitor',
    'מה לעקוב בימים הקרובים כדי לאמוד את ההשפעה הנמשכת של הנתון הזה על שוק ההון?'));
  return q;
}

function _riskQuestions() {
  return [
    _q(0, 'risk',
      'מה ההסתברות שהסיכון הזה יתממש ובאיזה טווח זמן? מה ה-base case, bull case ו-bear case?'),
    _q(1, 'risk',
      'אילו נכסים, סקטורים ומדדים יושפעו ראשונים אם הסיכון יתממש? מה הקורלציה הצפויה?'),
    _q(2, 'risk',
      'כיצד להגן על תיק השקעות מהסיכון הזה? אילו כלי גידור רלוונטיים (VIX, Put options, זהב, אג"ח)?'),
    _q(3, 'monitor',
      'מה הנתונים, האירועים והרמות הטכניות שיאשרו או יבטלו את הסיכון הזה? מה לעקוב?'),
    _q(4, 'macro',
      'כיצד הסיכון הזה קשור לסיכוני מאקרו אחרים בשוק? מה הגורם השולט כרגע?'),
  ];
}

function _opportunityQuestions() {
  return [
    _q(0, 'catalyst',
      'מה הפוטנציאל של ההזדמנות הזאת ובאיזה טווח זמן? מה ה-upside הצפוי ביחס לסיכון?'),
    _q(1, 'technical',
      'מה הטריגר שיאשר את ההזדמנות הזאת? מה נקודת הכניסה האופטימלית — תמיכה, פריצה, או שינוי סנטימנט?'),
    _q(2, 'sector',
      'אילו מניות, ETFs או נכסים מייצגים הכי טוב את ההזדמנות הזאת? מי המוביל הסקטוריאלי?'),
    _q(3, 'risk',
      'מה ניהול הסיכון המתאים לניצול הזדמנות זו — stop loss מוצע, גודל פוזיציה, ויחס סיכוי-סיכון?'),
    _q(4, 'monitor',
      'מה הסיכונים לתזה הזאת ומה יבטל אותה? מה לעקוב כדי לדעת מתי לצאת?'),
  ];
}

function _newsQuestions(themes) {
  const q = [];
  q.push(_q(q.length, 'news',
    'מה ההשפעה הצפויה של החדשה הזאת על השוק בטווח הקצר (שעות-ימים) ובטווח הבינוני (שבועות)?'));
  q.push(_q(q.length, 'news',
    'כיצד השוק הגיב בפעמים הקודמות לחדשות דומות? מה האנלוגיה ההיסטורית הרלוונטית ביותר?'));
  q.push(_q(q.length, 'sector',
    'אילו סקטורים, מניות ונכסים יושפעו ישירות מהחדשה הזאת? מה ה-trade הברור ביותר?'));
  q.push(_q(q.length, 'macro',
    'מה הקונצנזוס הנוכחי בשוק ביחס לחדשה הזאת? מה כבר מגולם במחירים ומה עדיין לא?'));
  if (themes.includes('geopolitical')) {
    q.push(_q(q.length, 'risk',
      'מה הסיכון הגיאופוליטי הנובע מהחדשה הזאת? מה ה-worst case ומה הנכסים המגוננים (זהב, VIX, אג"ח)?'));
  } else {
    q.push(_q(q.length, 'monitor',
      'אם התוצאה תהיה שונה מהציפיות — מה ה-trade? מה תגובת השוק בתרחיש חיובי לעומת שלילי?'));
  }
  return q;
}

function _calendarQuestions() {
  return [
    _q(0, 'calendar',
      'מה הציפייה הקונצנזוסית לאירוע הכלכלי הזה? מה כבר מגולם במחירים ומה יפתיע?'),
    _q(1, 'calendar',
      'מה ההיסטוריה של האירוע הזה — כיצד תגב השוק כשהנתון הפתיע כלפי מעלה / מטה?'),
    _q(2, 'sector',
      'אילו מדדים, סקטורים ומטבעות רגישים ביותר לתוצאת האירוע הזה? מה ה-trade הברור?'),
    _q(3, 'monitor',
      'מה לעקוב בשעות שאחרי האירוע — אילו סימנים יאשרו את ההשפעה ואילו יסמנו תגובת יתר?'),
  ];
}

function _genericQuestions() {
  return [
    _q(0, 'macro',
      'מה ההשלכות המאקרו של הנושא הזה על שוק המניות? מה הכיוון הכולל — Risk-On, ניטרלי, Risk-Off, או המתנה?'),
    _q(1, 'sector',
      'אילו מניות, ETFs וסקטורים מושפעים ישירות מהנושא הזה? מה ה-trade הרלוונטי ביותר?'),
    _q(2, 'technical',
      'מה הנתונים הטכניים המרכזיים שיכולים לאשר או לבטל את הכיוון שהנושא מרמז עליו?'),
    _q(3, 'monitor',
      'מה לעקוב בימים הקרובים כדי להעריך את ההשפעה של הנושא הזה על השוק?'),
  ];
}

// ── Public exports ────────────────────────────────────────────────────────────

/**
 * Generates 4-6 contextual Hebrew questions for the given selected items.
 * @param {Array} selectedItems - { text, sectionLabel, type, tabScope }
 * @returns {Array<{id: string, text: string, templateType: string}>}
 */
export function generatePerplexityQuestions(selectedItems) {
  const items = Array.isArray(selectedItems) ? selectedItems.filter(Boolean) : [];
  if (!items.length) return [];

  const texts = items.map((i) => String(i.text || '').trim()).filter(Boolean);
  const sectionLabels = [...new Set(items.map((i) => String(i.sectionLabel || '')).filter(Boolean))];
  const themes = _extractThemes(texts);
  const contentType = _detectContentType(texts) || _detectSectionType(sectionLabels);
  const entity = _extractEntityName(texts);

  switch (contentType) {
    case 'stock':       return _stockQuestions(entity, themes);
    case 'market':      return _marketQuestions();
    case 'sector':      return _sectorQuestions(_extractSectorName(texts));
    case 'macro':       return _macroQuestions(themes);
    case 'risk':        return _riskQuestions();
    case 'opportunity': return _opportunityQuestions();
    case 'news':        return _newsQuestions(themes);
    case 'calendar':    return _calendarQuestions();
    default:            return _genericQuestions();
  }
}

/** Display labels for templateType badges. */
export const TEMPLATE_LABELS = {
  catalyst:    '📌 קטליזטור',
  technical:   '📈 טכני',
  competitive: '🏆 תחרות',
  fundamental: '💰 פנדמנטלי',
  risk:        '⚠️ סיכון',
  monitor:     '👁 מה לעקוב',
  macro:       '🌐 מאקרו',
  sector:      '📊 סקטור',
  news:        '📰 חדשות',
  calendar:    '📅 לוח כלכלי',
  opportunity: '💡 הזדמנות',
  generic:     '🔍 כללי',
};
