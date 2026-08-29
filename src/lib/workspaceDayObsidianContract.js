/**
 * Workspace Day → Obsidian handoff CONTRACT (Stage 1 stub).
 *
 * Stage 3 (obsidian-sync-engineer) owns the real note-body / merge-marker /
 * per-category export internals. This module only pins the *calling contract*
 * so Stage 3 can change internals without touching callers:
 *   - buildWorkspaceDayObsidianHandoff(day, members) is PURE — no I/O, no
 *     network, no storage, no date-now side effects (it reads day.closedAt).
 *   - The returned object is embedded verbatim into day.closeSnapshot.obsidianHandoff
 *     by buildDayCloseSnapshot() in workspaceDayModel.js.
 *
 * Fields intentionally included now (so Stage 3 is an internals-only change):
 *   identityKey   — stable key for locating/merging the day's Obsidian note
 *   mergeMarker   — HTML comment marker Stage 3 will use for idempotent merges
 *   categoryBuckets / orderedCategories — per-category member grouping
 *   routeHints    — category → Obsidian vault-root hint (from config)
 *   members[]     — per-member sourceVideoId / sourceUrl for link rendering
 */

import {
  WORKSPACE_DAY_CATEGORY_ORDER,
  getWorkspaceDayCategoryMeta,
} from '@/config/workspaceDayCategories';

export const WORKSPACE_DAY_OBSIDIAN_CONTRACT_VERSION = 1;

function normalizeMember(member = {}) {
  return {
    workspaceItemId: String(member?.workspaceItemId || ''),
    itemIdentityKey: member?.itemIdentityKey ?? null,
    category: member?.category || 'general',
    sourceVideoId: member?.sourceVideoId ?? null,
    sourceUrl: member?.sourceUrl ?? null,
    frozen: Boolean(member?.frozen),
  };
}

/**
 * @param {object} day     WorkspaceDay record (id, dateKey, closedAt, ...)
 * @param {Array}  members WorkspaceDay members (denormalized attach records)
 * @returns {object} placeholder Obsidian handoff — status: 'stub'
 */
export function buildWorkspaceDayObsidianHandoff(day = {}, members = []) {
  const dateKey = String(day?.dateKey || '');
  const dayId = String(day?.id || '');
  const normalizedMembers = (Array.isArray(members) ? members : []).map(normalizeMember);

  const categoryBuckets = {};
  for (const member of normalizedMembers) {
    const bucket = categoryBuckets[member.category] || (categoryBuckets[member.category] = []);
    bucket.push({
      workspaceItemId: member.workspaceItemId,
      itemIdentityKey: member.itemIdentityKey,
      sourceVideoId: member.sourceVideoId,
      sourceUrl: member.sourceUrl,
    });
  }

  const orderedCategories = WORKSPACE_DAY_CATEGORY_ORDER.filter((category) => categoryBuckets[category]);

  const routeHints = {};
  for (const category of orderedCategories) {
    routeHints[category] = { mainCategory: getWorkspaceDayCategoryMeta(category).routeHint.mainCategory };
  }

  return {
    contractVersion: WORKSPACE_DAY_OBSIDIAN_CONTRACT_VERSION,
    status: 'stub',
    identityKey: `wsday:${dayId || dateKey}`,
    mergeMarker: `<!-- workspace-day:${dateKey}:${dayId} -->`,
    dateKey,
    dayId,
    orderedCategories,
    categoryBuckets,
    routeHints,
    members: normalizedMembers,
    generatedAt: day?.closedAt || null,
  };
}
