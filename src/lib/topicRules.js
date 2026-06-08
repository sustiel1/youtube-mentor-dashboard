// HARD RULE: Topic = single source of truth for Gem + Brain + Obsidian.
// When a video has a known topic, this map enforces:
//   - which Gem category to use (gemCategoryLabel)
//   - which Obsidian primary folder to save to (obsidianPrimary)
//   - which App Ideas subfolder to use (appIdeasFolder)
//
// Priority order enforced by callers:
//   1. Manual user selection
//   2. Known mentor/channel mapping (topicIds)
//   3. Saved video topic (video.category / video.obsidianTopic)
//   4. AI/keyword classification fallback

export const TOPIC_RULES = {
  'שוק ההון':        { gemCategoryLabel: 'שוק ההון',    obsidianPrimary: 'שוק ההון',        appIdeasFolder: 'Stock Market'             },
  'טכנולוגיה ו-AI':  { gemCategoryLabel: 'פיתוח',        obsidianPrimary: 'טכנולוגיה ו-AI',  appIdeasFolder: 'AI & Technology'          },
  'פוליטיקה':        { gemCategoryLabel: 'פוליטיקה',     obsidianPrimary: 'פוליטיקה',        appIdeasFolder: 'Politics'                 },
  'בריאות ותזונה':   { gemCategoryLabel: 'בריאות',       obsidianPrimary: 'בריאות ותזונה',   appIdeasFolder: 'Health & Nutrition'       },
  'ידע אישי':        { gemCategoryLabel: 'ידע אישי',     obsidianPrimary: 'ידע אישי',        appIdeasFolder: 'Personal Knowledge'       },
  'דרופשיפינג':      { gemCategoryLabel: 'דרופשיפינג',   obsidianPrimary: 'דרופשיפינג',      appIdeasFolder: 'Dropshipping & Ecommerce' },
  'פיתוח':           { gemCategoryLabel: 'פיתוח',        obsidianPrimary: 'פיתוח',           appIdeasFolder: 'Development'              },
};

// Maps system topic IDs (from mockData.js) → obsidianPrimary folder.
// Used by obsidianExport when video.category is not yet set.
export const TOPIC_ID_TO_OBSIDIAN = {
  't1':          'טכנולוגיה ו-AI',
  't2':          'שוק ההון',
  't_pol':       'פוליטיקה',
  't_health':    'בריאות ותזונה',
  't_personal':  'ידע אישי',
  't_drop':      'דרופשיפינג',
};

/** Returns the topic rule for a given topic name, or null if unknown. */
export function getTopicRule(topicName) {
  return TOPIC_RULES[String(topicName || '').trim()] ?? null;
}

/** Returns the obsidian primary folder for a system topic ID, or null. */
export function getObsidianPrimaryByTopicId(topicId) {
  return TOPIC_ID_TO_OBSIDIAN[String(topicId || '').trim()] ?? null;
}

/**
 * Returns the App Ideas Obsidian subfolder for a topic.
 * Resolves to: App Ideas/{folder}/
 * §30: App Ideas/{topic}/ is the only valid APP Builder storage path.
 */
export function getAppIdeasFolder(topicName) {
  const rule = getTopicRule(topicName);
  return rule?.appIdeasFolder ?? 'Future Projects';
}
