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
    // Order below is the intended tab display order (מניות first, then סקטורים,
    // ...). "כולם" is appended last by the two UI callers, not defined here.
    // subtopics: [] on each entry below is a scaffold for curated sub-subtopics
    // (3rd level). It's normally empty — sub-subtopics are usually surfaced
    // dynamically from the real topic tree instead (see getRealChildren in the
    // component), not hand-curated here. Populate it only for a deliberately
    // pre-authored grouping, same spirit as this file's own top-level curation.
    subtopics: [
      { id: 'vts-stocks',    name: 'מניות',           realTopicIds: ['wt-stocks', 'wt-stocks-quick', 'wt-stocks-watchlist', 'wt-stocks-chips', 'wt-stocks-ai', 'wt-stocks-energy', 'wt-stocks-banks', 'wt-stocks-realestate', 'wt-stocks-earnings', 'wt-markets-stocks', 'wt-markets-mentioned'], subtopics: [] },
      { id: 'vts-sectors',   name: 'סקטורים',         realTopicIds: ['wt-sectors', 'wt-sectors-tech', 'wt-sectors-energy', 'wt-sectors-financials', 'wt-sectors-health', 'wt-sectors-realestate', 'wt-sectors-consumer', 'wt-sectors-industrial', 'wt-markets-sectors'], subtopics: [] },
      { id: 'vts-macro',     name: 'מאקרו',          realTopicIds: ['wt-macro', 'wt-macro-rates', 'wt-macro-inflation', 'wt-macro-bonds', 'wt-macro-dollar', 'wt-macro-jobs', 'wt-macro-events', 'wt-markets-macro'], subtopics: [] },
      { id: 'vts-technical', name: 'מסחר טכני',       realTopicIds: ['wt-technical', 'wt-technical-sr', 'wt-technical-trend', 'wt-technical-ma', 'wt-technical-rsi', 'wt-technical-macd', 'wt-technical-volume', 'wt-technical-entry', 'wt-markets-technical'], subtopics: [] },
      { id: 'vts-risk',      name: 'ניהול סיכונים',   realTopicIds: ['wt-risk', 'wt-risk-sizing', 'wt-risk-stoploss', 'wt-risk-diversification', 'wt-risk-drawdown', 'wt-risk-hedging', 'wt-risk-scenarios', 'wt-markets-risk'], subtopics: [] },
      { id: 'vts-etf',       name: 'ETF / מדדים',     realTopicIds: ['wt-markets-etf'], subtopics: [] },
      { id: 'vts-crypto',    name: 'קריפטו',          realTopicIds: ['wt-crypto', 'wt-crypto-btc', 'wt-crypto-eth', 'wt-crypto-alts', 'wt-crypto-defi', 'wt-crypto-macro', 'wt-markets-crypto'], subtopics: [] },
      { id: 'vts-daily',     name: 'סקירת שוק יומית', realTopicIds: ['wt-markets-daily'], subtopics: [] },
      { id: 'vts-sentiment', name: 'סנטימנט שוק',     realTopicIds: ['wt-markets-sentiment'], subtopics: [] },
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
      { id: 'vts-ai-cc',    name: 'Claude Code',      realTopicIds: ['wt-ai-claudecode'], subtopics: [] },
      { id: 'vts-ai-n8n',   name: 'n8n / Automation', realTopicIds: ['wt-ai-n8n', 'wt-ai-automation'], subtopics: [] },
      { id: 'vts-ai-tools', name: 'כלים',             realTopicIds: ['wt-tools', 'wt-tools-finviz', 'wt-tools-tradingview', 'wt-tools-perplexity', 'wt-tools-notebooklm', 'wt-tools-obsidian', 'wt-tools-screeners'], subtopics: [] },
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
      { id: 'vts-pe-learning', name: 'לימוד / אסטרטגיה', realTopicIds: ['wt-learning', 'wt-learning-methods', 'wt-learning-rules', 'wt-learning-mistakes', 'wt-learning-books', 'wt-learning-frameworks'], subtopics: [] },
    ],
  },
  {
    id: 'vt-general', name: 'כללי', emoji: '📁',
    realTopicIds: ['wt-general'],
    legacyNames: ['כללי'],
    subtopics: [],
  },
];

// ─── Ancestry-aware matching ────────────────────────────────────────────────
// VIRTUAL_TAXONOMY's realTopicIds lists are curated/hardcoded — they can't know
// about topics a user creates later via a "+" button (random ids). To keep
// those newly-created topics/sub-subtopics filterable without hand-editing this
// file, matching optionally walks the real topic's parentId chain: an item
// matches a virtual node if its own id is in the node's realTopicIds (fast
// path, unchanged from before) OR if it's a descendant of one of those ids in
// the real topic tree (new — requires the caller to pass `realTopics`).
// Omitting `realTopics` (default []) preserves the exact old behavior.
const EMPTY_SET = new Set();

function buildTopicsById(realTopics) {
  const map = new Map();
  for (const t of realTopics) map.set(t.id, t);
  return map;
}

function idOrAncestorInSet(topicsById, id, idSet, excludeIds = EMPTY_SET) {
  let cur = id;
  let depth = 0;
  while (cur && depth < 12) {
    if (idSet.has(cur) && !excludeIds.has(cur)) return true;
    const topic = topicsById.get(cur);
    cur = topic ? topic.parentId : null;
    depth++;
  }
  return false;
}

// Returns true if item belongs to the given virtual topic.
// `excludeIds` — real topic ids to treat as non-matching even if still
// statically listed in vt.realTopicIds (see promotedTopicIds in
// workspaceTabPreferences.js: VIRTUAL_TAXONOMY can't be edited at runtime, so
// a promoted-to-main-topic id needs this escape hatch to stop matching its
// old curated grouping).
export function itemMatchesVirtTopic(item, vt, realTopics = [], excludeIds = []) {
  const idSet = new Set(vt.realTopicIds);
  const exclude = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);
  if ((idSet.has(item.topicId) && !exclude.has(item.topicId)) ||
      (idSet.has(item.subTopicId) && !exclude.has(item.subTopicId)) ||
      (idSet.has(item.subSubTopicId) && !exclude.has(item.subSubTopicId))) return true;
  if (vt.legacyNames.includes(item.topicName)) return true;
  if (realTopics.length === 0) return false;
  const topicsById = buildTopicsById(realTopics);
  return idOrAncestorInSet(topicsById, item.subSubTopicId, idSet, exclude) ||
         idOrAncestorInSet(topicsById, item.subTopicId, idSet, exclude) ||
         idOrAncestorInSet(topicsById, item.topicId, idSet, exclude);
}

// Item counts per virtual main topic
export function getVirtTopicCounts(items, realTopics = [], excludeIds = []) {
  const counts = {};
  for (const item of items) {
    for (const vt of VIRTUAL_TAXONOMY) {
      if (itemMatchesVirtTopic(item, vt, realTopics, excludeIds)) {
        counts[vt.id] = (counts[vt.id] || 0) + 1;
        break;
      }
    }
  }
  return counts;
}

// Item counts per subtopic of a given virtual main topic (pass all items or pre-filtered).
// An item tagged at the sub-subtopic level rolls up into its parent subtopic's count.
// Items whose subTopicId is a dynamically-created real topic not covered by any
// curated vs (e.g. added via the "+" button) are counted under their own real
// id, so freshly-created subtopics get a non-zero count without needing a
// hand-authored vs entry.
export function getVirtSubtopicCounts(items, vtId, realTopics = []) {
  const vt = VIRTUAL_TAXONOMY.find(v => v.id === vtId);
  if (!vt) return {};
  const topicsById = buildTopicsById(realTopics);
  const coveredIds = new Set(vt.subtopics.flatMap(vs => vs.realTopicIds));
  const counts = {};
  for (const item of items) {
    let matchedVsId = null;
    for (const vs of vt.subtopics) {
      const idSet = new Set(vs.realTopicIds);
      const matches = idSet.has(item.topicId) || idSet.has(item.subTopicId) || idSet.has(item.subSubTopicId) ||
        (realTopics.length > 0 && (
          idOrAncestorInSet(topicsById, item.subSubTopicId, idSet) ||
          idOrAncestorInSet(topicsById, item.subTopicId, idSet)
        ));
      if (matches) { matchedVsId = vs.id; break; }
    }
    if (matchedVsId) {
      counts[matchedVsId] = (counts[matchedVsId] || 0) + 1;
    } else if (item.subTopicId && !coveredIds.has(item.subTopicId)) {
      counts[item.subTopicId] = (counts[item.subTopicId] || 0) + 1;
    }
  }
  return counts;
}

// Filter items to only those matching the given virtual main topic
export function filterByVirtTopic(items, vtId, realTopics = [], excludeIds = []) {
  if (!vtId) return items;
  const vt = VIRTUAL_TAXONOMY.find(v => v.id === vtId);
  if (!vt) return items;
  return items.filter(i => itemMatchesVirtTopic(i, vt, realTopics, excludeIds));
}

// Filter items to only those matching the given virtual subtopic (including
// items tagged at a sub-subtopic descending from it). If vtsId isn't a curated
// vs id, it's treated as a raw real topic id (a dynamically-created subtopic
// with no hand-authored vs entry) and matched directly/by ancestry.
export function filterByVirtSubtopic(items, vtId, vtsId, realTopics = []) {
  if (!vtId || !vtsId) return items;
  const vt  = VIRTUAL_TAXONOMY.find(v => v.id === vtId);
  const vs  = vt?.subtopics.find(s => s.id === vtsId);
  const topicsById = buildTopicsById(realTopics);
  if (!vs) {
    const idSet = new Set([vtsId]);
    return items.filter(i =>
      i.subTopicId === vtsId || i.subSubTopicId === vtsId ||
      (realTopics.length > 0 && idOrAncestorInSet(topicsById, i.subSubTopicId, idSet))
    );
  }
  const idSet = new Set(vs.realTopicIds);
  return items.filter(i =>
    idSet.has(i.topicId) || idSet.has(i.subTopicId) || idSet.has(i.subSubTopicId) ||
    (realTopics.length > 0 && (
      idOrAncestorInSet(topicsById, i.subSubTopicId, idSet) ||
      idOrAncestorInSet(topicsById, i.subTopicId, idSet)
    ))
  );
}

// Groups items by virtual taxonomy. Unmatched items go under '__none__'.
export function groupItemsByVirtTopic(items, realTopics = [], excludeIds = []) {
  const groups = {};
  for (const item of items) {
    let matched = false;
    for (const vt of VIRTUAL_TAXONOMY) {
      if (itemMatchesVirtTopic(item, vt, realTopics, excludeIds)) {
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

// ─── Canonical real save-target for a virtual nav path ────────────────────────
// The virtual taxonomy groups MANY real topic ids under one display tab (e.g.
// "מניות" aggregates 11 legacy topic ids). There is no 1:1 mapping, so this
// never guesses among them — it only ever resolves to a real topic that the
// taxonomy data itself already ties to that exact virtual node:
//   1. An existing real topic whose id is nested under the resolved real main
//      topic AND is declared in the virtual subtopic's own realTopicIds — the
//      most literal match for "main topic X, subtopic Y".
//   2. Failing that, a real top-level topic that is itself declared in the
//      subtopic's realTopicIds (covers subtopics that exist in the real
//      system as their own top-level topic rather than nested, e.g. "מאקרו").
//   3. Failing that, the resolved main topic alone (no subtopic) — still an
//      exact, unambiguous existing topic.
// Returns null when even the main topic can't be resolved unambiguously —
// callers must show a manual-selection prompt in that case, never guess.
export function getCanonicalSaveTargetForVirtualPath(virtTopicId, virtSubtopicId, realTopics = []) {
  if (!virtTopicId) return null;
  const vt = VIRTUAL_TAXONOMY.find(v => v.id === virtTopicId);
  if (!vt) return null;

  // Canonical real main topic = an existing top-level real topic whose name
  // exactly matches the virtual topic's display name. Never invented.
  const realMainTopic = realTopics.find(t => !t.parentId && t.name === vt.name);
  if (!realMainTopic) return null;

  if (!virtSubtopicId) {
    return { topicId: realMainTopic.id, subTopicId: null, topicName: realMainTopic.name, subTopicName: null };
  }

  const vs = vt.subtopics.find(s => s.id === virtSubtopicId);
  if (!vs) {
    return { topicId: realMainTopic.id, subTopicId: null, topicName: realMainTopic.name, subTopicName: null };
  }

  // Only ever consider real topics the taxonomy itself already declares as
  // belonging to this subtopic — never a name-similarity guess.
  const candidates = realTopics.filter(t => vs.realTopicIds.includes(t.id));

  const nested = candidates.filter(t => t.parentId === realMainTopic.id);
  if (nested.length === 1) {
    return { topicId: realMainTopic.id, subTopicId: nested[0].id, topicName: realMainTopic.name, subTopicName: nested[0].name };
  }

  const topLevel = candidates.filter(t => !t.parentId);
  const exactTopLevel = topLevel.find(t => t.name === vs.name);
  if (exactTopLevel) {
    return { topicId: exactTopLevel.id, subTopicId: null, topicName: exactTopLevel.name, subTopicName: null };
  }
  if (topLevel.length === 1) {
    return { topicId: topLevel[0].id, subTopicId: null, topicName: topLevel[0].name, subTopicName: null };
  }

  // Subtopic is ambiguous (0 or 2+ equally-valid real candidates) — fall back
  // to the main topic alone rather than guessing between candidates.
  return { topicId: realMainTopic.id, subTopicId: null, topicName: realMainTopic.name, subTopicName: null };
}

// Groups items by subtopic within a virtual main topic.
// Items not matching any subtopic go under '__other__'.
export function groupItemsByVirtSubtopic(items, vtId, realTopics = []) {
  const vt = VIRTUAL_TAXONOMY.find(v => v.id === vtId);
  if (!vt || vt.subtopics.length === 0) return { '__all__': items };
  const topicsById = buildTopicsById(realTopics);
  const groups = {};
  for (const item of items) {
    let matched = false;
    for (const vs of vt.subtopics) {
      const idSet = new Set(vs.realTopicIds);
      const matches = idSet.has(item.topicId) || idSet.has(item.subTopicId) || idSet.has(item.subSubTopicId) ||
        (realTopics.length > 0 && (
          idOrAncestorInSet(topicsById, item.subSubTopicId, idSet) ||
          idOrAncestorInSet(topicsById, item.subTopicId, idSet)
        ));
      if (matches) {
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

// ─── Sub-subtopic (3rd level) helpers ──────────────────────────────────────
// Unlike the curated vt/vs layers above, sub-subtopics are normally created ad
// hoc (via the accordion's "+" button) under whatever real topic the current
// subtopic resolves to — there's no practical way to hand-curate ids for them
// in advance. So these operate directly on the real topic tree: `parentRealId`
// is the real topic id of the currently-active subtopic (resolved by the
// caller, e.g. via getCanonicalSaveTargetForVirtualPath or used directly when
// the active subtopic tab is already a real id).

// Item counts keyed by real sub-subtopic id (item.subSubTopicId). The caller
// already knows which ids are actual children of the active subtopic (from
// getSubTopics(parentRealId)), so this doesn't need the parent id itself —
// it just tallies every subSubTopicId seen; the caller looks up by child id.
export function getRealChildCounts(items) {
  const counts = {};
  for (const item of items) {
    if (item.subSubTopicId) {
      counts[item.subSubTopicId] = (counts[item.subSubTopicId] || 0) + 1;
    }
  }
  return counts;
}

// Filter items to only those tagged with the given real sub-subtopic id.
export function filterByRealSubSubtopic(items, subSubTopicId) {
  if (!subSubTopicId) return items;
  return items.filter(i => i.subSubTopicId === subSubTopicId);
}
