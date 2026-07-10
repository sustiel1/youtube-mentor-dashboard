// ─── Workspace Virtual Taxonomy ───────────────────────────────────────────────
// Maps broad display domains → all stored topic IDs that belong there.
// This is UI-only: no localStorage or schema changes.
// Used by both WorkspaceLibrary (navigation/filtering) and
// WorkspaceSaveReviewOverlay (topics view grouping).

export const VIRTUAL_TAXONOMY = [
  {
    id: 'vt-markets', name: 'שוק ההון', emoji: '📈',
    realTopicIds: [
      // New hierarchy sub-topics
      'wt-markets', 'wt-markets-daily', 'wt-markets-stocks', 'wt-markets-sentiment',
      'wt-markets-events', 'wt-markets-opportunities', 'wt-markets-risks', 'wt-markets-etf',
      'wt-markets-macro', 'wt-markets-sectors', 'wt-markets-technical', 'wt-markets-risk',
      'wt-markets-crypto', 'wt-markets-reports', 'wt-markets-mentioned',
      // Legacy main topics (stored as parentId:null in old taxonomy)
      'wt-stocks', 'wt-stocks-quick', 'wt-stocks-watchlist', 'wt-stocks-chips', 'wt-stocks-ai',
      'wt-stocks-energy', 'wt-stocks-banks', 'wt-stocks-realestate', 'wt-stocks-earnings',
      'wt-macro', 'wt-macro-rates', 'wt-macro-inflation', 'wt-macro-bonds', 'wt-macro-dollar',
      'wt-macro-jobs', 'wt-macro-events',
      'wt-sectors', 'wt-sectors-tech', 'wt-sectors-energy', 'wt-sectors-financials',
      'wt-sectors-health', 'wt-sectors-realestate', 'wt-sectors-consumer', 'wt-sectors-industrial',
      'wt-technical', 'wt-technical-sr', 'wt-technical-trend', 'wt-technical-ma',
      'wt-technical-rsi', 'wt-technical-macd', 'wt-technical-volume', 'wt-technical-entry',
      'wt-risk', 'wt-risk-sizing', 'wt-risk-stoploss', 'wt-risk-diversification',
      'wt-risk-drawdown', 'wt-risk-hedging', 'wt-risk-scenarios',
      'wt-crypto', 'wt-crypto-btc', 'wt-crypto-eth', 'wt-crypto-alts', 'wt-crypto-defi', 'wt-crypto-macro',
    ],
    legacyNames: ['שוק ההון', 'מניות', 'מאקרו', 'סקטורים', 'מסחר טכני', 'ניהול סיכונים', 'קריפטו'],
    subtopics: [
      { id: 'vts-macro',     name: 'מאקרו',          realTopicIds: ['wt-macro', 'wt-macro-rates', 'wt-macro-inflation', 'wt-macro-bonds', 'wt-macro-dollar', 'wt-macro-jobs', 'wt-macro-events', 'wt-markets-macro'] },
      { id: 'vts-stocks',    name: 'מניות',           realTopicIds: ['wt-stocks', 'wt-stocks-quick', 'wt-stocks-watchlist', 'wt-stocks-chips', 'wt-stocks-ai', 'wt-stocks-energy', 'wt-stocks-banks', 'wt-stocks-realestate', 'wt-stocks-earnings', 'wt-markets-stocks', 'wt-markets-mentioned'] },
      { id: 'vts-sectors',   name: 'סקטורים',         realTopicIds: ['wt-sectors', 'wt-sectors-tech', 'wt-sectors-energy', 'wt-sectors-financials', 'wt-sectors-health', 'wt-sectors-realestate', 'wt-sectors-consumer', 'wt-sectors-industrial', 'wt-markets-sectors'] },
      { id: 'vts-technical', name: 'מסחר טכני',       realTopicIds: ['wt-technical', 'wt-technical-sr', 'wt-technical-trend', 'wt-technical-ma', 'wt-technical-rsi', 'wt-technical-macd', 'wt-technical-volume', 'wt-technical-entry', 'wt-markets-technical'] },
      { id: 'vts-risk',      name: 'ניהול סיכונים',   realTopicIds: ['wt-risk', 'wt-risk-sizing', 'wt-risk-stoploss', 'wt-risk-diversification', 'wt-risk-drawdown', 'wt-risk-hedging', 'wt-risk-scenarios', 'wt-markets-risk'] },
      { id: 'vts-crypto',    name: 'קריפטו',          realTopicIds: ['wt-crypto', 'wt-crypto-btc', 'wt-crypto-eth', 'wt-crypto-alts', 'wt-crypto-defi', 'wt-crypto-macro', 'wt-markets-crypto'] },
      { id: 'vts-etf',       name: 'ETF / מדדים',     realTopicIds: ['wt-markets-etf'] },
      { id: 'vts-daily',     name: 'סקירת שוק יומית', realTopicIds: ['wt-markets-daily'] },
      { id: 'vts-sentiment', name: 'סנטימנט שוק',     realTopicIds: ['wt-markets-sentiment'] },
    ],
  },
  {
    id: 'vt-ai', name: 'AI וטכנולוגיה', emoji: '🤖',
    realTopicIds: [
      'wt-ai', 'wt-ai-claudecode', 'wt-ai-cursor', 'wt-ai-chatgpt', 'wt-ai-perplexity',
      'wt-ai-n8n', 'wt-ai-automation', 'wt-ai-rag', 'wt-ai-frontend', 'wt-ai-backend', 'wt-ai-apis', 'wt-ai-qa',
      'wt-tools', 'wt-tools-finviz', 'wt-tools-tradingview', 'wt-tools-perplexity',
      'wt-tools-notebooklm', 'wt-tools-obsidian', 'wt-tools-screeners',
    ],
    legacyNames: ['AI וטכנולוגיה', 'כלים וקישורים'],
    subtopics: [
      { id: 'vts-ai-cc',    name: 'Claude Code',      realTopicIds: ['wt-ai-claudecode'] },
      { id: 'vts-ai-n8n',   name: 'n8n / Automation', realTopicIds: ['wt-ai-n8n', 'wt-ai-automation'] },
      { id: 'vts-ai-tools', name: 'כלים',             realTopicIds: ['wt-tools', 'wt-tools-finviz', 'wt-tools-tradingview', 'wt-tools-perplexity', 'wt-tools-notebooklm', 'wt-tools-obsidian', 'wt-tools-screeners'] },
    ],
  },
  {
    id: 'vt-health', name: 'תזונה ובריאות', emoji: '🥗',
    realTopicIds: ['wt-health', 'wt-health-keto', 'wt-health-diabetes', 'wt-health-lowcarb', 'wt-health-recipes', 'wt-health-exercise', 'wt-health-tests', 'wt-health-supplements', 'wt-health-general'],
    legacyNames: ['תזונה ובריאות', 'תזונה', 'בריאות'],
    subtopics: [],
  },
  {
    id: 'vt-politics', name: 'פוליטיקה', emoji: '🏛',
    realTopicIds: ['wt-politics', 'wt-politics-israel', 'wt-politics-security', 'wt-politics-law', 'wt-politics-religion', 'wt-politics-media', 'wt-politics-economy', 'wt-politics-geo'],
    legacyNames: ['פוליטיקה'],
    subtopics: [],
  },
  {
    id: 'vt-personal', name: 'ידע אישי', emoji: '💡',
    realTopicIds: [
      'wt-personal', 'wt-personal-habits', 'wt-personal-books', 'wt-personal-mindset', 'wt-personal-tools', 'wt-personal-learning',
      'wt-learning', 'wt-learning-methods', 'wt-learning-rules', 'wt-learning-mistakes', 'wt-learning-books', 'wt-learning-frameworks',
    ],
    legacyNames: ['ידע אישי', 'לימוד / אסטרטגיה', 'לימוד'],
    subtopics: [
      { id: 'vts-pe-learning', name: 'לימוד / אסטרטגיה', realTopicIds: ['wt-learning', 'wt-learning-methods', 'wt-learning-rules', 'wt-learning-mistakes', 'wt-learning-books', 'wt-learning-frameworks'] },
    ],
  },
  {
    id: 'vt-general', name: 'כללי', emoji: '📁',
    realTopicIds: ['wt-general'],
    legacyNames: ['כללי'],
    subtopics: [],
  },
];

// Returns true if item belongs to the given virtual topic
export function itemMatchesVirtTopic(item, vt) {
  return vt.realTopicIds.includes(item.topicId) ||
         vt.realTopicIds.includes(item.subTopicId) ||
         vt.legacyNames.includes(item.topicName);
}

// Item counts per virtual main topic
export function getVirtTopicCounts(items) {
  const counts = {};
  for (const item of items) {
    for (const vt of VIRTUAL_TAXONOMY) {
      if (itemMatchesVirtTopic(item, vt)) {
        counts[vt.id] = (counts[vt.id] || 0) + 1;
        break;
      }
    }
  }
  return counts;
}

// Item counts per subtopic of a given virtual main topic (pass all items or pre-filtered)
export function getVirtSubtopicCounts(items, vtId) {
  const vt = VIRTUAL_TAXONOMY.find(v => v.id === vtId);
  if (!vt) return {};
  const counts = {};
  for (const item of items) {
    for (const vs of vt.subtopics) {
      if (vs.realTopicIds.includes(item.topicId) || vs.realTopicIds.includes(item.subTopicId)) {
        counts[vs.id] = (counts[vs.id] || 0) + 1;
        break;
      }
    }
  }
  return counts;
}

// Filter items to only those matching the given virtual main topic
export function filterByVirtTopic(items, vtId) {
  if (!vtId) return items;
  const vt = VIRTUAL_TAXONOMY.find(v => v.id === vtId);
  if (!vt) return items;
  const idSet   = new Set(vt.realTopicIds);
  const nameSet = new Set(vt.legacyNames);
  return items.filter(i => idSet.has(i.topicId) || idSet.has(i.subTopicId) || nameSet.has(i.topicName));
}

// Filter items to only those matching the given virtual subtopic
export function filterByVirtSubtopic(items, vtId, vtsId) {
  if (!vtId || !vtsId) return items;
  const vt  = VIRTUAL_TAXONOMY.find(v => v.id === vtId);
  const vs  = vt?.subtopics.find(s => s.id === vtsId);
  if (!vs) return items;
  const subIdSet = new Set(vs.realTopicIds);
  return items.filter(i => subIdSet.has(i.topicId) || subIdSet.has(i.subTopicId));
}

// Groups items by virtual taxonomy. Unmatched items go under '__none__'.
export function groupItemsByVirtTopic(items) {
  const groups = {};
  for (const item of items) {
    let matched = false;
    for (const vt of VIRTUAL_TAXONOMY) {
      if (itemMatchesVirtTopic(item, vt)) {
        if (!groups[vt.id]) groups[vt.id] = [];
        groups[vt.id].push(item);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!groups['__none__']) groups['__none__'] = [];
      groups['__none__'].push(item);
    }
  }
  return groups;
}

// Groups items by subtopic within a virtual main topic.
// Items not matching any subtopic go under '__other__'.
export function groupItemsByVirtSubtopic(items, vtId) {
  const vt = VIRTUAL_TAXONOMY.find(v => v.id === vtId);
  if (!vt || vt.subtopics.length === 0) return { '__all__': items };
  const groups = {};
  for (const item of items) {
    let matched = false;
    for (const vs of vt.subtopics) {
      if (vs.realTopicIds.includes(item.topicId) || vs.realTopicIds.includes(item.subTopicId)) {
        if (!groups[vs.id]) groups[vs.id] = [];
        groups[vs.id].push(item);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!groups['__other__']) groups['__other__'] = [];
      groups['__other__'].push(item);
    }
  }
  return groups;
}
