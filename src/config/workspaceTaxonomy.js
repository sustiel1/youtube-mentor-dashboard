const SEED_DATE = '2024-01-01T00:00:00.000Z';

export const DEFAULT_WORKSPACE_TOPICS = [
  // שוק ההון
  { id: 'wt-markets',              name: 'שוק ההון',          parentId: null,        emoji: '📈', createdAt: SEED_DATE },
  { id: 'wt-markets-daily',        name: 'סקירת שוק יומית',  parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-markets-stocks',       name: 'מניות שהוזכרו',    parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-markets-sentiment',    name: 'סנטימנט שוק',      parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-markets-events',       name: 'אירועי השבוע',     parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-markets-opportunities',name: 'הזדמנויות',         parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-markets-risks',        name: 'סיכונים',           parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-markets-etf',          name: 'ETF / מדדים',       parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },

  // מניות
  { id: 'wt-stocks',               name: 'מניות',             parentId: null,         emoji: '📊', createdAt: SEED_DATE },
  { id: 'wt-stocks-quick',         name: 'החלטה מהירה',      parentId: 'wt-stocks',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-stocks-watchlist',     name: 'מניות לצפייה',     parentId: 'wt-stocks',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-stocks-chips',         name: 'שבבים',             parentId: 'wt-stocks',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-stocks-ai',            name: 'AI',                parentId: 'wt-stocks',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-stocks-energy',        name: 'אנרגיה',            parentId: 'wt-stocks',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-stocks-banks',         name: 'בנקים',             parentId: 'wt-stocks',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-stocks-realestate',    name: 'נדל"ן',             parentId: 'wt-stocks',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-stocks-earnings',      name: 'דוחות',             parentId: 'wt-stocks',  emoji: null, createdAt: SEED_DATE },

  // מאקרו
  { id: 'wt-macro',                name: 'מאקרו',             parentId: null,         emoji: '🌍', createdAt: SEED_DATE },
  { id: 'wt-macro-rates',          name: 'ריבית / פד',        parentId: 'wt-macro',   emoji: null, createdAt: SEED_DATE },
  { id: 'wt-macro-inflation',      name: 'אינפלציה',          parentId: 'wt-macro',   emoji: null, createdAt: SEED_DATE },
  { id: 'wt-macro-bonds',          name: 'אג"ח',              parentId: 'wt-macro',   emoji: null, createdAt: SEED_DATE },
  { id: 'wt-macro-dollar',         name: 'דולר',              parentId: 'wt-macro',   emoji: null, createdAt: SEED_DATE },
  { id: 'wt-macro-jobs',           name: 'שוק עבודה',         parentId: 'wt-macro',   emoji: null, createdAt: SEED_DATE },
  { id: 'wt-macro-events',         name: 'אירועים כלכליים',   parentId: 'wt-macro',   emoji: null, createdAt: SEED_DATE },

  // סקטורים
  { id: 'wt-sectors',              name: 'סקטורים',            parentId: null,          emoji: '🏭', createdAt: SEED_DATE },
  { id: 'wt-sectors-tech',         name: 'טכנולוגיה',          parentId: 'wt-sectors',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-sectors-energy',       name: 'אנרגיה',             parentId: 'wt-sectors',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-sectors-financials',   name: 'פיננסים',            parentId: 'wt-sectors',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-sectors-health',       name: 'בריאות',             parentId: 'wt-sectors',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-sectors-realestate',   name: 'נדל"ן',              parentId: 'wt-sectors',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-sectors-consumer',     name: 'צריכה',              parentId: 'wt-sectors',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-sectors-industrial',   name: 'תעשייה',             parentId: 'wt-sectors',  emoji: null, createdAt: SEED_DATE },

  // מסחר טכני
  { id: 'wt-technical',            name: 'מסחר טכני',          parentId: null,           emoji: '⚡', createdAt: SEED_DATE },
  { id: 'wt-technical-sr',         name: 'תמיכה והתנגדות',    parentId: 'wt-technical', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-technical-trend',      name: 'מגמה',               parentId: 'wt-technical', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-technical-ma',         name: 'ממוצעים נעים',       parentId: 'wt-technical', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-technical-rsi',        name: 'RSI',                parentId: 'wt-technical', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-technical-macd',       name: 'MACD',               parentId: 'wt-technical', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-technical-volume',     name: 'נפח מסחר',           parentId: 'wt-technical', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-technical-entry',      name: 'כניסה ויציאה',       parentId: 'wt-technical', emoji: null, createdAt: SEED_DATE },

  // ניהול סיכונים
  { id: 'wt-risk',                 name: 'ניהול סיכונים',      parentId: null,       emoji: '🛡', createdAt: SEED_DATE },
  { id: 'wt-risk-sizing',          name: 'גודל פוזיציה',       parentId: 'wt-risk',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-risk-stoploss',        name: 'סטופ לוס',           parentId: 'wt-risk',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-risk-diversification', name: 'פיזור',              parentId: 'wt-risk',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-risk-drawdown',        name: 'Drawdown',           parentId: 'wt-risk',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-risk-hedging',         name: 'Hedging',            parentId: 'wt-risk',  emoji: null, createdAt: SEED_DATE },
  { id: 'wt-risk-scenarios',       name: 'תרחישי סיכון',       parentId: 'wt-risk',  emoji: null, createdAt: SEED_DATE },

  // קריפטו
  { id: 'wt-crypto',               name: 'קריפטו',             parentId: null,        emoji: '₿', createdAt: SEED_DATE },
  { id: 'wt-crypto-btc',           name: 'Bitcoin',            parentId: 'wt-crypto', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-crypto-eth',           name: 'Ethereum',           parentId: 'wt-crypto', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-crypto-alts',          name: 'Altcoins',           parentId: 'wt-crypto', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-crypto-defi',          name: 'DeFi',               parentId: 'wt-crypto', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-crypto-macro',         name: 'מאקרו קריפטו',       parentId: 'wt-crypto', emoji: null, createdAt: SEED_DATE },

  // לימוד / אסטרטגיה
  { id: 'wt-learning',             name: 'לימוד / אסטרטגיה',  parentId: null,          emoji: '🎓', createdAt: SEED_DATE },
  { id: 'wt-learning-methods',     name: 'שיטות עבודה',        parentId: 'wt-learning', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-learning-rules',       name: 'חוקים אישיים',       parentId: 'wt-learning', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-learning-mistakes',    name: 'טעויות ולקחים',      parentId: 'wt-learning', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-learning-books',       name: 'רעיונות מספרים',     parentId: 'wt-learning', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-learning-frameworks',  name: 'Frameworks',         parentId: 'wt-learning', emoji: null, createdAt: SEED_DATE },

  // כלים וקישורים
  { id: 'wt-tools',                name: 'כלים וקישורים',      parentId: null,       emoji: '🔗', createdAt: SEED_DATE },
  { id: 'wt-tools-finviz',         name: 'Finviz',             parentId: 'wt-tools', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-tools-tradingview',    name: 'TradingView',        parentId: 'wt-tools', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-tools-perplexity',     name: 'Perplexity',         parentId: 'wt-tools', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-tools-notebooklm',     name: 'NotebookLM',         parentId: 'wt-tools', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-tools-obsidian',       name: 'Obsidian',           parentId: 'wt-tools', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-tools-screeners',      name: 'Screeners',          parentId: 'wt-tools', emoji: null, createdAt: SEED_DATE },

  // כללי
  { id: 'wt-general',              name: 'כללי',               parentId: null, emoji: '📁', createdAt: SEED_DATE },
];
