export const MARKET_BRIEF_SPACE_URL =
  'https://www.perplexity.ai/spaces/shlvt-lpy-kvtrt-market-brief-AJeh9fGtRKiEpVR2Id0qyQ';

export const STOCK_FAST_DECISION_SPACE_URL =
  'https://www.perplexity.ai/spaces/stock-fast-decision-oOhCJwdnQKqXFNhAt5CVVw';

export const PERPLEXITY_SPACES = {
  marketBrief: {
    key: 'marketBrief',
    label: 'Market Brief — שאלות לפי כותרת',
    url: MARKET_BRIEF_SPACE_URL,
  },
  stockFastDecision: {
    key: 'stockFastDecision',
    label: 'Stock Fast Decision — החלטה מהירה על מניה',
    url: STOCK_FAST_DECISION_SPACE_URL,
  },
};

// Ordered list for UI rendering
export const SELECTABLE_SPACES = Object.values(PERPLEXITY_SPACES);

export function getPerplexitySpaceByKey(key) {
  return PERPLEXITY_SPACES[key] ?? PERPLEXITY_SPACES.marketBrief;
}

const STOCK_SECTION_KEYWORDS = [
  'מניות שהוזכרו', 'מניות', 'טיקר', 'טיקרים',
  'stocks mentioned', 'ticker', 'tickers',
];

export function isStockRelatedQuestionSection(sectionTitleOrKey = '') {
  const lower = String(sectionTitleOrKey).toLowerCase();
  return STOCK_SECTION_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

export function getDefaultPerplexitySpaceForQuestionSection(sectionTitleOrKey) {
  return isStockRelatedQuestionSection(sectionTitleOrKey)
    ? 'stockFastDecision'
    : 'marketBrief';
}

// backward-compat alias
export const getDefaultPerplexitySpaceForSection = getDefaultPerplexitySpaceForQuestionSection;

export const STOCK_FAST_DECISION_QUESTIONS = [
  { id: 'sfd-1',  text: 'מה החברה עושה ומה מקור ההכנסות המרכזי שלה?' },
  { id: 'sfd-2',  text: 'האם הסנטימנט סביב המניה חיובי, שלילי או ניטרלי?' },
  { id: 'sfd-3',  text: 'מהם הקטליזטורים החשובים ביותר שצריך לבדוק לפני החלטת קנייה?' },
  { id: 'sfd-4',  text: 'האם החדשות האחרונות תומכות בעלייה או בירידה במניה?' },
  { id: 'sfd-5',  text: 'מה מצב הדוחות האחרונים: הכנסות, רווחיות, תחזית וצמיחה?' },
  { id: 'sfd-6',  text: 'האם יש שינוי בהמלצות אנליסטים, מחיר יעד או פעילות מוסדיים?' },
  { id: 'sfd-7',  text: 'האם התמחור נראה יקר, סביר או זול ביחס לצמיחה ולסקטור?' },
  { id: 'sfd-8',  text: 'מהם הסיכונים המרכזיים בטווח הקצר?' },
  { id: 'sfd-9',  text: 'מה אומר הגרף מבחינת מגמה, תמיכה, התנגדות ומומנטום?' },
  { id: 'sfd-10', text: 'האם זו מניה למעקב בלבד, כניסה חלקית, כניסה מלאה או הימנעות?' },
  { id: 'sfd-11', text: 'מה התנאים שצריכים להתקיים כדי לקבל החלטת כניסה?' },
  { id: 'sfd-12', text: 'מה רמת הביטחון בהחלטה מ־1 עד 10 ולמה?' },
];
