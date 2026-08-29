/**
 * Workspace Day — category enum + presentation catalog (Stage 1, data model).
 *
 * This is configuration only: no storage, no I/O, no schema mutation. It is the
 * single source of truth for:
 *   1. The 8 first-class WorkspaceDay category constants.
 *   2. Hebrew label + emoji per category (UI wiring happens in Stage 2).
 *   3. The FIXED v1 display order (no per-day custom ordering yet).
 *   4. routeHint.mainCategory — the eventual Obsidian vault root each category
 *      maps to. Stage 3 (obsidian-sync-engineer) consumes routeHint; the values
 *      here are the 5 OBSIDIAN_FOLDER_CATALOG top-level keys from
 *      src/lib/obsidianExport.js (duplicated as plain strings on purpose so this
 *      config stays dependency-free — see OBSIDIAN_MAIN_CATEGORY_KEYS guard).
 *
 * `ai` is deliberately first-class and is NEVER folded into `general`.
 */

export const WORKSPACE_DAY_CATEGORIES = Object.freeze({
  MARKET_BRIEF: 'marketBrief',
  MACRO: 'macro',
  DAILY_TRADING: 'dailyTrading',
  FUNDAMENTAL: 'fundamental',
  STOCKS: 'stocks',
  POLITICAL: 'political',
  AI: 'ai',
  GENERAL: 'general',
});

/**
 * FIXED v1 category display order (Stage brief #13). Exported as a constant so
 * every consumer renders the same order; there is no per-day custom ordering.
 */
export const WORKSPACE_DAY_CATEGORY_ORDER = Object.freeze([
  'stocks',
  'macro',
  'dailyTrading',
  'fundamental',
  'marketBrief',
  'political',
  'ai',
  'general',
]);

/** The 5 top-level keys of OBSIDIAN_FOLDER_CATALOG (src/lib/obsidianExport.js). */
export const OBSIDIAN_MAIN_CATEGORY_KEYS = Object.freeze([
  'שוק ההון',
  'טכנולוגיה ו-AI',
  'בריאות ותזונה',
  'ידע אישי',
  'פוליטיקה',
]);

export const WORKSPACE_DAY_CATEGORY_CATALOG = Object.freeze({
  stocks: Object.freeze({
    id: 'stocks',
    label: 'מניות',
    emoji: '📊',
    routeHint: Object.freeze({ mainCategory: 'שוק ההון' }),
  }),
  macro: Object.freeze({
    id: 'macro',
    label: 'מאקרו',
    emoji: '🌍',
    routeHint: Object.freeze({ mainCategory: 'שוק ההון' }),
  }),
  dailyTrading: Object.freeze({
    id: 'dailyTrading',
    label: 'מסחר יומי',
    emoji: '📈',
    routeHint: Object.freeze({ mainCategory: 'שוק ההון' }),
  }),
  fundamental: Object.freeze({
    id: 'fundamental',
    label: 'פונדמנטלי',
    emoji: '🧮',
    routeHint: Object.freeze({ mainCategory: 'שוק ההון' }),
  }),
  marketBrief: Object.freeze({
    id: 'marketBrief',
    label: 'מבזק שוק',
    emoji: '📰',
    routeHint: Object.freeze({ mainCategory: 'שוק ההון' }),
  }),
  political: Object.freeze({
    id: 'political',
    label: 'פוליטיקה ושווקים',
    emoji: '🏛',
    routeHint: Object.freeze({ mainCategory: 'פוליטיקה' }),
  }),
  ai: Object.freeze({
    id: 'ai',
    label: 'AI וטכנולוגיה',
    emoji: '🤖',
    routeHint: Object.freeze({ mainCategory: 'טכנולוגיה ו-AI' }),
  }),
  general: Object.freeze({
    id: 'general',
    label: 'כללי',
    emoji: '📁',
    routeHint: Object.freeze({ mainCategory: 'ידע אישי' }),
  }),
});

export const WORKSPACE_DAY_CATEGORY_IDS = Object.freeze(
  Object.keys(WORKSPACE_DAY_CATEGORY_CATALOG),
);

export function isWorkspaceDayCategory(value) {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(WORKSPACE_DAY_CATEGORY_CATALOG, value);
}

export function getWorkspaceDayCategoryMeta(category) {
  return WORKSPACE_DAY_CATEGORY_CATALOG[category] || WORKSPACE_DAY_CATEGORY_CATALOG.general;
}

export function getWorkspaceDayCategoryOrderIndex(category) {
  const index = WORKSPACE_DAY_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? WORKSPACE_DAY_CATEGORY_ORDER.length : index;
}

/** Returns the input categories de-duplicated and sorted by the fixed v1 order. */
export function sortWorkspaceDayCategories(categories = []) {
  return [...new Set(categories)]
    .filter(isWorkspaceDayCategory)
    .sort((a, b) => getWorkspaceDayCategoryOrderIndex(a) - getWorkspaceDayCategoryOrderIndex(b));
}

// ── Build-time guards ────────────────────────────────────────────────────────
if (WORKSPACE_DAY_CATEGORY_ORDER.length !== WORKSPACE_DAY_CATEGORY_IDS.length) {
  throw new Error('WorkspaceDay category order must list every catalog category exactly once');
}
for (const id of WORKSPACE_DAY_CATEGORY_ORDER) {
  if (!isWorkspaceDayCategory(id)) {
    throw new Error(`WorkspaceDay category order references unknown category: ${id}`);
  }
}
for (const meta of Object.values(WORKSPACE_DAY_CATEGORY_CATALOG)) {
  if (!OBSIDIAN_MAIN_CATEGORY_KEYS.includes(meta.routeHint.mainCategory)) {
    throw new Error(`WorkspaceDay routeHint points at an unknown Obsidian root: ${meta.routeHint.mainCategory}`);
  }
}
