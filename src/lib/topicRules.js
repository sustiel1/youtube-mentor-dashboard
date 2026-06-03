// HARD RULE: Topic = single source of truth for Gem + Brain + Obsidian.
// When a video has a known topic, this map enforces:
//   - which Gem category to use (gemCategoryLabel)
//   - which Obsidian primary folder to save to (obsidianPrimary)
//
// Priority order enforced by callers:
//   1. Manual user selection
//   2. Known mentor/channel mapping (topicIds)
//   3. Saved video topic (video.category / video.obsidianTopic)
//   4. AI/keyword classification fallback

export const TOPIC_RULES = {
  'שוק ההון':        { gemCategoryLabel: 'שוק ההון',   obsidianPrimary: 'שוק ההון'        },
  'טכנולוגיה ו-AI':  { gemCategoryLabel: 'פיתוח',       obsidianPrimary: 'טכנולוגיה ו-AI'  },
  'פוליטיקה':        { gemCategoryLabel: 'פוליטיקה',    obsidianPrimary: 'פוליטיקה'        },
  'בריאות ותזונה':   { gemCategoryLabel: 'בריאות',      obsidianPrimary: 'בריאות ותזונה'   },
  'ידע אישי':        { gemCategoryLabel: 'בריאות',      obsidianPrimary: 'ידע אישי'        },
};

// Maps system topic IDs (from mockData.js) → obsidianPrimary folder.
// Used by obsidianExport when video.category is not yet set.
export const TOPIC_ID_TO_OBSIDIAN = {
  't1':        'טכנולוגיה ו-AI',
  't2':        'שוק ההון',
  't_pol':     'פוליטיקה',
  't_health':  'בריאות ותזונה',
  't_personal':'ידע אישי',
};

/** Returns the topic rule for a given topic name, or null if unknown. */
export function getTopicRule(topicName) {
  return TOPIC_RULES[String(topicName || '').trim()] ?? null;
}

/** Returns the obsidian primary folder for a system topic ID, or null. */
export function getObsidianPrimaryByTopicId(topicId) {
  return TOPIC_ID_TO_OBSIDIAN[String(topicId || '').trim()] ?? null;
}
