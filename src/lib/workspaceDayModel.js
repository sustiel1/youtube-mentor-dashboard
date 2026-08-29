/**
 * Workspace Day — pure data-model helpers (Stage 1).
 *
 * NO storage / I/O / events here. Everything is a pure function the store
 * (workspaceDayStore.js) composes. Identity is delegated to the existing
 * getWorkspaceItemIdentity() helper — this module never modifies it.
 *
 * Record shape (persisted under localStorage key `workspace_days_v1`):
 * {
 *   id: 'wd-YYYY-MM-DD-<suffix>',
 *   schemaVersion: 1,
 *   dateKey: 'YYYY-MM-DD',          // LOCAL calendar date (manual open only)
 *   status: 'open' | 'closed',
 *   entryMode: 'manual' | 'auto',   // create default 'manual'
 *   createdAt / updatedAt / closedAt: ISO | null,
 *   reopenCount: number,
 *   reopenedAt: ISO | null,
 *   members: WorkspaceDayMember[],
 *   closeSnapshot: object | null,    // most-recent close (see buildDayCloseSnapshot)
 * }
 *
 * Member shape:
 * {
 *   workspaceItemId: string,
 *   itemIdentityKey: string | null,  // denormalized getWorkspaceItemIdentity(item)?.key
 *   category: WorkspaceDay category,
 *   entryMode: 'manual' | 'auto',
 *   attachedAt: ISO,
 *   frozen: boolean,
 *   frozenAt: ISO | null,
 *   refreshedAt: ISO | null,         // set ONLY by refreshWorkspaceDayMemberFromSource
 *   contentSnapshot: object | null,  // deep copy of the item's renderable payload
 *   sourceVideoId: string | null,
 *   sourceUrl: string | null,
 * }
 */

import { canonicalize, fnv1a } from '@/lib/persistence/storageIntegrity';
import { buildWorkspaceDayObsidianHandoff } from '@/lib/workspaceDayObsidianContract';
import {
  getWorkspaceItemIdentity,
  getWorkspaceSourceVideoId,
} from '@/utils/workspaceItemIdentity';
import { VIRTUAL_TAXONOMY, itemMatchesVirtTopic } from '@/utils/workspaceVirtualTaxonomy';
import {
  WORKSPACE_DAY_CATEGORIES as CATEGORIES,
  isWorkspaceDayCategory,
} from '@/config/workspaceDayCategories';

export const WORKSPACE_DAY_SCHEMA_VERSION = 1;
export const WORKSPACE_DAY_STATUSES = Object.freeze(['open', 'closed']);
export const WORKSPACE_DAY_ENTRY_MODES = Object.freeze(['manual', 'auto']);

const DAY_MS = 86400000;

// UI-only fields that must never enter a frozen contentSnapshot.
const MEMBER_VOLATILE_FIELDS = Object.freeze(['uiState', 'selected', 'isSelected', '_localOnly']);

// ── small utils ──────────────────────────────────────────────────────────────

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) throw new TypeError('WorkspaceDay: invalid date input');
  return date;
}

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeEntryMode(entryMode) {
  return WORKSPACE_DAY_ENTRY_MODES.includes(entryMode) ? entryMode : 'manual';
}

/** LOCAL calendar date key. Manual day-open only — no "today" / scheduling logic. */
export function resolveWorkspaceDayDateKey(dateInput = new Date()) {
  const date = toDate(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Deep copy of the item minus UI-only fields — what gets frozen on close. */
export function getWorkspaceDayRenderablePayload(item) {
  if (!item || typeof item !== 'object') return null;
  const clone = deepClone(item);
  MEMBER_VOLATILE_FIELDS.forEach((field) => { delete clone[field]; });
  return clone;
}

function resolveItemSourceUrl(item) {
  const direct = item?.sourceUrl || item?.url || item?.videoUrl || item?.sourceVideoUrl;
  if (direct) return String(direct);
  const videoId = getWorkspaceSourceVideoId(item);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

// ── category resolution (PURE, priority order per Stage brief #11) ────────────

const MARKET_CONTENT_TYPES = new Set(['marketBrief', 'macro', 'dailyTrading', 'fundamental']);

const LEGACY_TOPIC_NAME_CATEGORY = Object.freeze({
  'מניות': CATEGORIES.STOCKS,
  'מאקרו': CATEGORIES.MACRO,
  'פונדמנטלי': CATEGORIES.FUNDAMENTAL,
  'ניתוח יסודי': CATEGORIES.FUNDAMENTAL,
  'מסחר יומי': CATEGORIES.DAILY_TRADING,
  'מסחר טכני': CATEGORIES.DAILY_TRADING,
  'טכני': CATEGORIES.DAILY_TRADING,
  'ניהול סיכונים': CATEGORIES.DAILY_TRADING,
  'מבזק': CATEGORIES.MARKET_BRIEF,
  'סיכום שוק': CATEGORIES.MARKET_BRIEF,
  'שוק ההון': CATEGORIES.MARKET_BRIEF,
  'סקטורים': CATEGORIES.MARKET_BRIEF,
  'קריפטו': CATEGORIES.MARKET_BRIEF,
  'AI וטכנולוגיה': CATEGORIES.AI,
  'כלים וקישורים': CATEGORIES.AI,
});

/** (a) gemContentRouter output — only the 4 market content types are decisive. */
function getMarketContentClassification(video) {
  const contentType = String(video?.metadata?.contentClassification?.contentType || '').trim();
  return MARKET_CONTENT_TYPES.has(contentType) ? contentType : null;
}

/**
 * Political-tab signal: the item is EXPLICITLY assigned to a political
 * topic / collection / tag. Deliberately does NOT inspect titles or the rich
 * politicalSummary.* ideology/theology payload — that content stays
 * Obsidian-only (Stage brief #11 + #12 coexistence).
 */
function hasPoliticalTopicTag(item) {
  if (!item) return false;
  const politicsVt = VIRTUAL_TAXONOMY.find((vt) => vt.id === 'vt-politics');
  if (politicsVt && itemMatchesVirtTopic(item, politicsVt)) return true;
  if (String(item.topicName || '').trim() === 'פוליטיקה') return true;
  const tags = Array.isArray(item?.provenance?.semanticTags) ? item.provenance.semanticTags : [];
  return tags.some((tag) => ['political', 'politics', 'פוליטיקה'].includes(String(tag).toLowerCase()));
}

/**
 * Political refinement (documented heuristic): tag `political` ONLY when a
 * market content classification (US-markets/finance) overlaps with an explicit
 * political topic assignment on the item. "US politics ∩ capital markets".
 * Being sourced from a political mentor is NOT sufficient on its own.
 */
function resolvesToPolitical(item, video) {
  return Boolean(getMarketContentClassification(video)) && hasPoliticalTopicTag(item);
}

function marketsSubcategory(item, marketsVt) {
  const sub = marketsVt.subtopics.find((candidate) => (
    candidate.realTopicIds.includes(item?.topicId)
    || candidate.realTopicIds.includes(item?.subTopicId)
  ));
  switch (sub?.id) {
    case 'vts-stocks': return CATEGORIES.STOCKS;
    case 'vts-macro': return CATEGORIES.MACRO;
    case 'vts-fundamental': return CATEGORIES.FUNDAMENTAL;
    case 'vts-daily':
    case 'vts-technical':
    case 'vts-risk':
      return CATEGORIES.DAILY_TRADING;
    default:
      // vts-sectors / vts-etf / vts-crypto / vts-sentiment / bare שוק ההון
      return CATEGORIES.MARKET_BRIEF;
  }
}

/** (c) virtual-taxonomy match. */
function categoryFromVirtualTaxonomy(item) {
  if (!item) return null;
  const aiVt = VIRTUAL_TAXONOMY.find((vt) => vt.id === 'vt-ai');
  if (aiVt && itemMatchesVirtTopic(item, aiVt)) return CATEGORIES.AI;
  const marketsVt = VIRTUAL_TAXONOMY.find((vt) => vt.id === 'vt-markets');
  if (marketsVt && itemMatchesVirtTopic(item, marketsVt)) return marketsSubcategory(item, marketsVt);
  // vt-politics without a market classification → general (ideology content is
  // Obsidian-only); vt-health / vt-personal / vt-general → general.
  return null;
}

/** (d) legacy topicName match. */
function categoryFromLegacyTopicName(item) {
  return LEGACY_TOPIC_NAME_CATEGORY[String(item?.topicName || '').trim()] || null;
}

/**
 * resolveWorkspaceDayCategory(item, video) — PURE.
 * Priority: (a) gem content classification → political refinement →
 * (b) provenance.workspaceCollection / sourceTabId → (c) virtual taxonomy →
 * (d) legacy topicName → (e) 'general'.
 */
export function resolveWorkspaceDayCategory(item = null, video = null) {
  // (a) + political refinement (can override a market classification)
  if (resolvesToPolitical(item, video)) return CATEGORIES.POLITICAL;
  const marketContentType = getMarketContentClassification(video);
  if (marketContentType) return marketContentType;

  // (b) provenance collection / sourceTabId — only app-builder is category-bearing
  const collection = String(item?.provenance?.workspaceCollection || '').toLowerCase();
  const sourceTabId = String(item?.sourceTabId || item?.provenance?.sourceTabId || '').toLowerCase();
  if (collection === 'apps' || sourceTabId === 'app-builder') return CATEGORIES.AI;

  // (c) virtual taxonomy
  const virtualCategory = categoryFromVirtualTaxonomy(item);
  if (virtualCategory) return virtualCategory;

  // (d) legacy topicName
  const legacyCategory = categoryFromLegacyTopicName(item);
  if (legacyCategory) return legacyCategory;

  // (e) fallback
  return CATEGORIES.GENERAL;
}

// ── record / member builders ─────────────────────────────────────────────────

export function createWorkspaceDayRecord({ now = new Date(), entryMode = 'manual', idSuffix } = {}) {
  const timestamp = toDate(now);
  const iso = timestamp.toISOString();
  const dateKey = resolveWorkspaceDayDateKey(timestamp);
  const suffix = String(idSuffix || Math.random().toString(36).slice(2, 8));
  return {
    id: `wd-${dateKey}-${suffix}`,
    schemaVersion: WORKSPACE_DAY_SCHEMA_VERSION,
    dateKey,
    status: 'open',
    entryMode: normalizeEntryMode(entryMode),
    createdAt: iso,
    updatedAt: iso,
    closedAt: null,
    reopenCount: 0,
    reopenedAt: null,
    members: [],
    closeSnapshot: null,
  };
}

export function buildWorkspaceDayMember({ item, video = null, entryMode = 'manual', now = new Date() } = {}) {
  if (!item || !item.id) throw new TypeError('buildWorkspaceDayMember requires an item with an id');
  const iso = toDate(now).toISOString();
  return {
    workspaceItemId: String(item.id),
    itemIdentityKey: getWorkspaceItemIdentity(item)?.key ?? null,
    category: resolveWorkspaceDayCategory(item, video),
    entryMode: normalizeEntryMode(entryMode),
    attachedAt: iso,
    frozen: false,
    frozenAt: null,
    refreshedAt: null,
    contentSnapshot: null,
    sourceVideoId: getWorkspaceSourceVideoId(item),
    sourceUrl: resolveItemSourceUrl(item),
  };
}

// ── dedup / identity ─────────────────────────────────────────────────────────

/** In-day dedup key for a stored member. */
export function getWorkspaceDayMemberDedupKey(member) {
  const identityKey = member?.itemIdentityKey;
  if (identityKey) return String(identityKey);
  return `item:${member?.workspaceItemId ?? ''}`;
}

/** In-day dedup key for a live item OR a { workspaceItemId, itemIdentityKey } ref. */
export function getWorkspaceDayItemDedupKey(itemOrRef) {
  if (!itemOrRef) return 'item:';
  const identity = getWorkspaceItemIdentity(itemOrRef);
  if (identity?.key) return identity.key;
  if (itemOrRef.itemIdentityKey) return String(itemOrRef.itemIdentityKey);
  const id = itemOrRef.id ?? itemOrRef.workspaceItemId ?? '';
  return `item:${id}`;
}

// ── drift detection (read-only — never mutates contentSnapshot) ───────────────

/**
 * Compares a member's stored identity vs the live item's current identity.
 * currentItem == null → treated as "item is gone".
 * Returns a flag object for the UI read model. Does NOT auto-refresh anything.
 */
export function detectWorkspaceDayMemberDrift(member, currentItem) {
  const storedIdentityKey = getWorkspaceDayMemberDedupKey(member);
  if (!currentItem) {
    return { drifted: true, driftReason: 'item-missing', storedIdentityKey, currentIdentityKey: null };
  }
  const currentIdentityKey = getWorkspaceItemIdentity(currentItem)?.key
    ?? `item:${currentItem.id ?? member?.workspaceItemId ?? ''}`;
  const drifted = currentIdentityKey !== storedIdentityKey;
  return {
    drifted,
    driftReason: drifted ? 'identity-changed' : null,
    storedIdentityKey,
    currentIdentityKey,
  };
}

// ── freeze / refresh ─────────────────────────────────────────────────────────

/**
 * Freezes a member for day close. Re-affirms itemIdentityKey from the live item
 * (falls back to the stored key) and snapshots the live renderable payload. If
 * no live item is supplied, keeps the existing snapshot/key (member already
 * frozen from an earlier close survives a reopen unchanged).
 */
export function freezeWorkspaceDayMember(member, liveItem = null, { now = new Date() } = {}) {
  const iso = toDate(now).toISOString();
  const reaffirmedKey = liveItem
    ? (getWorkspaceItemIdentity(liveItem)?.key ?? member?.itemIdentityKey ?? null)
    : (member?.itemIdentityKey ?? null);
  const snapshotSource = liveItem
    ? getWorkspaceDayRenderablePayload(liveItem)
    : (member?.contentSnapshot ?? null);
  return {
    ...member,
    frozen: true,
    frozenAt: member?.frozenAt || iso,
    itemIdentityKey: reaffirmedKey,
    contentSnapshot: deepClone(snapshotSource),
  };
}

/**
 * The ONLY operation allowed to update contentSnapshot + itemIdentityKey and to
 * set refreshedAt. Requires a live item.
 */
export function refreshWorkspaceDayMemberFromSource(member, liveItem, { video = null, now = new Date() } = {}) {
  if (!liveItem) throw new TypeError('refreshWorkspaceDayMemberFromSource requires a live item');
  const iso = toDate(now).toISOString();
  return {
    ...member,
    itemIdentityKey: getWorkspaceItemIdentity(liveItem)?.key ?? null,
    category: resolveWorkspaceDayCategory(liveItem, video),
    contentSnapshot: deepClone(getWorkspaceDayRenderablePayload(liveItem)),
    refreshedAt: iso,
    sourceVideoId: getWorkspaceSourceVideoId(liveItem),
    sourceUrl: resolveItemSourceUrl(liveItem),
  };
}

// ── close snapshot ───────────────────────────────────────────────────────────

/** Informational only (Stage brief #10) — NEVER triggers a mutation. */
export function computeWorkspaceDayAgeInDays(day, now = new Date()) {
  const created = new Date(day?.createdAt || 0).getTime();
  if (!Number.isFinite(created) || created <= 0) return 0;
  return Math.max(0, Math.floor((toDate(now).getTime() - created) / DAY_MS));
}

/**
 * Builds day.closeSnapshot: counts + category breakdown + a reproducible
 * fnv1a checksum over the frozen members, plus the Stage-3 obsidianHandoff stub.
 */
export function buildDayCloseSnapshot(day, members = [], {
  now = new Date(),
  buildObsidianHandoff = buildWorkspaceDayObsidianHandoff,
} = {}) {
  const iso = toDate(now).toISOString();
  const list = Array.isArray(members) ? members : [];
  const frozenMembers = list.filter((member) => member?.frozen);

  const categoryBreakdown = {};
  for (const member of list) {
    const category = isWorkspaceDayCategory(member?.category) ? member.category : CATEGORIES.GENERAL;
    categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
  }

  const checksumBasis = canonicalize(frozenMembers.map((member) => ({
    workspaceItemId: String(member?.workspaceItemId || ''),
    itemIdentityKey: member?.itemIdentityKey ?? null,
    category: member?.category ?? CATEGORIES.GENERAL,
    contentSnapshot: member?.contentSnapshot ?? null,
  })));

  return {
    schemaVersion: WORKSPACE_DAY_SCHEMA_VERSION,
    builtAt: iso,
    memberCount: list.length,
    frozenCount: frozenMembers.length,
    categoryBreakdown,
    checksum: fnv1a(JSON.stringify(checksumBasis)),
    checksumAlgorithm: 'fnv1a',
    obsidianHandoff: typeof buildObsidianHandoff === 'function'
      ? buildObsidianHandoff(day, list)
      : null,
  };
}
