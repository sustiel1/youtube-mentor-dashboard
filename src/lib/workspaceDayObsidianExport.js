/**
 * Stage 3 — Workspace Day → Obsidian export (MANUAL ONLY).
 *
 * One Obsidian note per closed day. Sections are the day's categories in the
 * fixed WORKSPACE_DAY_CATEGORY_ORDER; each member renders as a bullet built from
 * its frozen `contentSnapshot` (+ source link). Re-exporting the same day is
 * idempotent: the day-level HTML-comment marker
 * `<!-- workspace-day:<dateKey>:<dayId> -->` anchors the note and each member
 * carries its own `<!-- obsidian-item:wsday-item:… -->` marker, so the shared
 * merge engine (obsidianNoteMerge.js) only ever *inserts* new bullets and never
 * rewrites existing / manually-edited content.
 *
 * Routing (Fixed decision #2 — no new/parallel destination):
 *   - The transport payload is the closed day's
 *     `closeSnapshot.obsidianHandoff` (buildWorkspaceDayObsidianHandoff), whose
 *     `routeHints[category].mainCategory` is one of the 5 OBSIDIAN_FOLDER_CATALOG
 *     roots (validated against OBSIDIAN_MAIN_CATEGORY_KEYS from the same config
 *     guard).
 *   - The note lands in `<mainCategory>/Workspace Days/WD-<dateKey>.md`, where
 *     `mainCategory` is the routeHint of the FIRST present category in the fixed
 *     order. Every present category still gets its own `## ` section inside the
 *     single note.
 *
 * Authoritative routing engine for THIS feature: the OBSIDIAN_FOLDER_CATALOG
 * registry owned by src/lib/obsidianExport.js (surfaced here via the
 * OBSIDIAN_MAIN_CATEGORY_KEYS mirror in src/config/workspaceDayCategories.js).
 * The taxonomy resolver in src/lib/obsidianRouting.js is a strict subset used
 * for per-video V-*.md paths; it agrees with the catalog for every bare root
 * (both return the root string unchanged), so the two engines cannot disagree
 * on any destination this feature can produce.
 */

import {
  WORKSPACE_DAY_CATEGORY_ORDER,
  OBSIDIAN_MAIN_CATEGORY_KEYS,
  getWorkspaceDayCategoryMeta,
  isWorkspaceDayCategory,
} from '@/config/workspaceDayCategories';
import { buildWorkspaceDayObsidianHandoff } from '@/lib/workspaceDayObsidianContract';
import { mergeItemsIntoObsidianNote } from '@/lib/obsidianNoteMerge';
import { buildFrontmatter } from '@/lib/obsidianExport';
import {
  sanitizeObsidianRelativePath,
  buildObsidianOpenUrl,
  getObsidianVaultRequestFields,
  getActiveObsidianVaultConfig,
} from '@/lib/obsidianVaultConfig';

export const WORKSPACE_DAY_OBSIDIAN_SUBFOLDER = 'Workspace Days';
export const WORKSPACE_DAY_OBSIDIAN_NOTE_TYPE = 'workspace-day';

const READ_ROUTE = '/api/vault/read';
const WRITE_ROUTE = '/api/vault/write';

export const WORKSPACE_DAY_OBSIDIAN_ERROR = Object.freeze({
  DAY_NOT_CLOSED: 'day-not-closed',
  NO_CATEGORIES: 'no-categories',
  UNKNOWN_ROUTE: 'unknown-route',
  NO_VAULT_PATH: 'no-vault-path',
  READ_FAILED: 'read-failed',
  WRITE_FAILED: 'write-failed',
  NOT_VERIFIED: 'not-verified',
});

const USER_MESSAGES = {
  [WORKSPACE_DAY_OBSIDIAN_ERROR.DAY_NOT_CLOSED]: 'אפשר לייצא ל-Obsidian רק יום עבודה סגור.',
  [WORKSPACE_DAY_OBSIDIAN_ERROR.NO_CATEGORIES]: 'אין פריטים ביום העבודה — אין מה לייצא ל-Obsidian.',
  [WORKSPACE_DAY_OBSIDIAN_ERROR.UNKNOWN_ROUTE]: 'לא נמצאה תיקיית יעד תקינה ב-vault עבור קטגוריות היום. הייצוא בוטל.',
  [WORKSPACE_DAY_OBSIDIAN_ERROR.NO_VAULT_PATH]: 'לא הוגדר נתיב ל-Obsidian vault. פתחו את הגדרות ה-vault ונסו שוב.',
  [WORKSPACE_DAY_OBSIDIAN_ERROR.READ_FAILED]: 'קריאת ההערה הקיימת מ-Obsidian נכשלה. היום לא יוצא.',
  [WORKSPACE_DAY_OBSIDIAN_ERROR.WRITE_FAILED]: 'כתיבת ההערה ל-Obsidian נכשלה. היום לא יוצא.',
  [WORKSPACE_DAY_OBSIDIAN_ERROR.NOT_VERIFIED]: 'הכתיבה ל-Obsidian לא אומתה — ייתכן שההערה לא נשמרה במלואה. הסטטוס לא עודכן.',
};

function fail(code, extra = {}) {
  return {
    ok: false,
    code,
    userMessage: USER_MESSAGES[code] || 'ייצוא היום ל-Obsidian נכשל.',
    ...extra,
  };
}

// ── node-safe wrappers (vault config touches import.meta.env / window) ────────
function safeVaultRequestFields() {
  try {
    const fields = getObsidianVaultRequestFields();
    return { vaultName: fields?.vaultName || '', vaultPath: fields?.vaultPath || '' };
  } catch {
    return { vaultName: '', vaultPath: '' };
  }
}

function safeActiveVaultName() {
  try {
    return getActiveObsidianVaultConfig()?.vaultName || '';
  } catch {
    return '';
  }
}

// ── small text helpers ──────────────────────────────────────────────────────
function sanitizeInline(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[[\]]/g, ' ')
    .replace(/\|/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatHeb(iso) {
  try {
    return new Date(iso).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(iso || '—');
  }
}

function resolveHandoff(day) {
  const snap = day?.closeSnapshot?.obsidianHandoff;
  if (snap && Array.isArray(snap.orderedCategories) && typeof snap.mergeMarker === 'string' && snap.mergeMarker) {
    return snap;
  }
  // Legacy / missing handoff — rebuild from the day itself (same pure contract).
  return buildWorkspaceDayObsidianHandoff(day || {}, Array.isArray(day?.members) ? day.members : []);
}

function resolveMemberTitle(member) {
  const snapshot = member?.contentSnapshot || {};
  return (
    sanitizeInline(
      snapshot.videoTitle
        || snapshot.title
        || snapshot.label
        || snapshot.name
        || snapshot.headline
        || member?.sourceUrl
        || `פריט ${member?.workspaceItemId || ''}`,
    ) || 'פריט ללא כותרת'
  );
}

function resolveMemberUrl(member) {
  const snapshot = member?.contentSnapshot || {};
  const raw = String(
    member?.sourceUrl || snapshot.sourceUrl || snapshot.url || snapshot.videoUrl || '',
  ).trim();
  return /^https?:\/\//i.test(raw) ? raw : '';
}

function memberBulletText(member) {
  const title = resolveMemberTitle(member);
  const url = resolveMemberUrl(member);
  return url ? `[${title}](${url})` : title;
}

function memberIdentityKey(dayId, category, member) {
  const base = String(member?.itemIdentityKey || member?.workspaceItemId || 'item').trim() || 'item';
  return `wsday-item:${dayId}:${category}:${base}`;
}

// ── merge model (PURE) ──────────────────────────────────────────────────────
/**
 * Builds the per-category section model + flat merge-item list for a day.
 * Membership comes from the contract handoff (categoryBuckets, fixed order);
 * the renderable title/url is DERIVED from day.members[].contentSnapshot
 * (Fixed decision #3 — the stub lacks contentSnapshot, so derive it locally).
 */
export function buildWorkspaceDayMergeModel(day) {
  const handoff = resolveHandoff(day);
  const dayId = String(handoff.dayId || day?.id || '');
  const dateKey = String(handoff.dateKey || day?.dateKey || '');

  const membersById = new Map();
  for (const member of Array.isArray(day?.members) ? day.members : []) {
    membersById.set(String(member?.workspaceItemId), member);
  }

  const orderedCategories = (Array.isArray(handoff.orderedCategories) ? handoff.orderedCategories : [])
    .filter(isWorkspaceDayCategory)
    .slice()
    .sort((a, b) => WORKSPACE_DAY_CATEGORY_ORDER.indexOf(a) - WORKSPACE_DAY_CATEGORY_ORDER.indexOf(b));

  const sections = [];
  const items = [];

  for (const category of orderedCategories) {
    const label = getWorkspaceDayCategoryMeta(category).label;
    const bucket = Array.isArray(handoff.categoryBuckets?.[category])
      ? handoff.categoryBuckets[category]
      : [];
    const sectionItems = [];
    for (const entry of bucket) {
      const member = membersById.get(String(entry?.workspaceItemId)) || {
        workspaceItemId: entry?.workspaceItemId,
        itemIdentityKey: entry?.itemIdentityKey,
        sourceUrl: entry?.sourceUrl,
        contentSnapshot: null,
      };
      const text = memberBulletText(member);
      const identityKey = memberIdentityKey(dayId, category, member);
      sectionItems.push({ text, identityKey, sectionLabel: label });
      items.push({ text, sectionLabel: label, identityKey });
    }
    sections.push({ category, label, items: sectionItems });
  }

  return {
    handoff,
    dayId,
    dateKey,
    dayMarker: handoff.mergeMarker,
    orderedCategories,
    sectionLabels: sections.map((section) => section.label),
    sections,
    items,
  };
}

// ── routing (PURE) ─────────────────────────────────────────────────────────
/**
 * @returns {{ ok:true, primaryCategory, mainCategory, folder, fileName,
 *   finalFilePath, obsidianUrl, orderedCategories }} | { ok:false, code, userMessage }
 */
export function resolveWorkspaceDayObsidianRoute(day, { vaultName = '' } = {}) {
  const model = buildWorkspaceDayMergeModel(day);
  if (model.orderedCategories.length === 0) {
    return fail(WORKSPACE_DAY_OBSIDIAN_ERROR.NO_CATEGORIES);
  }

  const primaryCategory = model.orderedCategories[0];
  const mainCategory = model.handoff.routeHints?.[primaryCategory]?.mainCategory
    || getWorkspaceDayCategoryMeta(primaryCategory).routeHint.mainCategory;

  if (!OBSIDIAN_MAIN_CATEGORY_KEYS.includes(mainCategory)) {
    return fail(WORKSPACE_DAY_OBSIDIAN_ERROR.UNKNOWN_ROUTE, { mainCategory });
  }

  const folder = `${mainCategory}/${WORKSPACE_DAY_OBSIDIAN_SUBFOLDER}`;
  const fileName = `WD-${model.dateKey || 'unknown'}.md`;
  const finalFilePath = sanitizeObsidianRelativePath(`${folder}/${fileName}`);
  const obsidianUrl = vaultName ? buildObsidianOpenUrl(finalFilePath, vaultName) : '';

  return {
    ok: true,
    primaryCategory,
    mainCategory,
    folder,
    fileName,
    finalFilePath,
    obsidianUrl,
    orderedCategories: model.orderedCategories,
  };
}

// ── document build (PURE) ──────────────────────────────────────────────────
function buildScaffold(day, model, route) {
  const created = day?.closeSnapshot?.obsidianHandoff?.generatedAt
    || day?.closedAt
    || day?.updatedAt
    || new Date().toISOString();
  const dateKey = model.dateKey || 'unknown';

  const frontmatter = buildFrontmatter({
    type: WORKSPACE_DAY_OBSIDIAN_NOTE_TYPE,
    topic: route.mainCategory,
    tags: ['workspace-day', ...model.orderedCategories],
    date: dateKey,
    created,
  });

  const header = [
    frontmatter,
    '',
    `# יום עבודה — ${dateKey}`,
    '',
    `- קטגוריות: ${model.sectionLabels.join(', ') || '—'}`,
    `- פריטים: ${model.items.length}`,
    `- יעד ב-vault: ${route.folder}`,
    `- יוצא בתאריך: ${formatHeb(created)}`,
    '',
    model.dayMarker,
    '',
  ].join('\n');

  const sectionHeaders = model.sectionLabels.map((label) => `## ${label}\n`).join('\n');
  return `${header}\n${sectionHeaders}\n---\n`;
}

function frontmatterEndIndex(content) {
  const match = String(content || '').match(/^---\n[\s\S]*?\n---\n/);
  return match ? match[0].length : 0;
}

function ensureDayMarker(content, marker) {
  const base = String(content || '');
  if (!marker || base.includes(marker)) return base;
  const fmEnd = frontmatterEndIndex(base);
  const footerIdx = base.lastIndexOf('\n---');
  if (footerIdx > fmEnd) {
    return `${base.slice(0, footerIdx)}\n${marker}\n${base.slice(footerIdx + 1)}`;
  }
  return `${base.trimEnd()}\n\n${marker}\n`;
}

/**
 * Guarantees a `## <label>` header exists for every label WITHOUT letting the
 * merge engine create it (its new-section branch would target the frontmatter
 * `\n---` fence). `labels` MUST already be in the fixed category order; each
 * missing header is spliced in at its ordered position — before the first later
 * section that already exists, else right before the footer `---`.
 */
function ensureSectionHeaders(content, labels) {
  let base = String(content || '');
  const hasHeader = (label) => base.includes(`## ${label}`);

  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    if (hasHeader(label)) continue;

    const header = `## ${label}\n`;
    // Anchor = the next already-present section in fixed order.
    let anchorIdx = -1;
    for (let j = i + 1; j < labels.length; j += 1) {
      if (hasHeader(labels[j])) {
        anchorIdx = base.indexOf(`## ${labels[j]}`);
        break;
      }
    }

    if (anchorIdx >= 0) {
      base = `${base.slice(0, anchorIdx)}${header}\n${base.slice(anchorIdx)}`;
      continue;
    }

    const fmEnd = frontmatterEndIndex(base);
    const footerIdx = base.lastIndexOf('\n---');
    if (footerIdx > fmEnd) {
      base = `${base.slice(0, footerIdx + 1)}\n${header}\n${base.slice(footerIdx + 1)}`;
    } else {
      base = `${base.trimEnd()}\n\n${header}\n---\n`;
    }
  }

  return base;
}

/**
 * Read → merge → produce the full document to write (merged-content mode).
 * Pure: pass `existingContent` from /api/vault/read (empty string when absent).
 */
export function buildWorkspaceDayDocument({ day, existingContent = '', route } = {}) {
  const resolvedRoute = route || resolveWorkspaceDayObsidianRoute(day);
  if (!resolvedRoute.ok) return resolvedRoute;

  const model = buildWorkspaceDayMergeModel(day);
  let base = String(existingContent || '');
  const isNew = !base.trim();

  if (isNew) {
    base = buildScaffold(day, model, resolvedRoute);
  } else {
    base = ensureDayMarker(base, model.dayMarker);
    base = ensureSectionHeaders(base, model.sectionLabels);
  }

  const merged = mergeItemsIntoObsidianNote({
    existingContent: base,
    items: model.items,
    footerLines: [],
  });

  return {
    ok: true,
    isNew,
    content: merged.content,
    added: merged.added,
    skipped: merged.skipped,
    changed: Boolean(merged.changed) || isNew,
    mergeItems: model.items.map((item) => ({
      text: item.text,
      sectionLabel: item.sectionLabel,
      identityKey: item.identityKey,
    })),
    route: resolvedRoute,
    model,
  };
}

// ── the actual export (async, dev-server /api/vault/*) ──────────────────────
/**
 * Manual export of a CLOSED Workspace Day to its Obsidian note.
 * Never records success unless the server verified every merge marker.
 *
 * @returns {Promise<{ ok:true, strategy, savedPath, obsidianUrl, folder,
 *   mainCategory, added, skipped, itemCount, categories }
 *   | { ok:false, code, userMessage }>}
 */
export async function exportWorkspaceDayToObsidian(day, options = {}) {
  if (!day || day.status !== 'closed') {
    return fail(WORKSPACE_DAY_OBSIDIAN_ERROR.DAY_NOT_CLOSED);
  }

  const vaultFields = options.vaultFields || safeVaultRequestFields();
  const vaultName = options.vaultName || vaultFields.vaultName || safeActiveVaultName();

  const route = resolveWorkspaceDayObsidianRoute(day, { vaultName });
  if (!route.ok) return route;

  const baseBody = {
    path: route.finalFilePath,
    vaultName: vaultFields.vaultName,
    vaultPath: vaultFields.vaultPath,
  };

  // 1. read existing note (missing file → ok:true, exists:false)
  let read;
  try {
    const res = await fetch(READ_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });
    read = await res.json().catch(() => ({}));
  } catch (err) {
    return fail(WORKSPACE_DAY_OBSIDIAN_ERROR.READ_FAILED, { cause: err?.message || String(err) });
  }
  if (!read?.ok) {
    if (read?.error === 'NO_VAULT_PATH' || read?.error === 'VAULT_NOT_FOUND') {
      return fail(WORKSPACE_DAY_OBSIDIAN_ERROR.NO_VAULT_PATH);
    }
    return fail(WORKSPACE_DAY_OBSIDIAN_ERROR.READ_FAILED, { error: read?.error });
  }

  // 2. build the merged document
  const doc = buildWorkspaceDayDocument({
    day,
    existingContent: read.exists ? read.content : '',
    route,
  });
  if (!doc.ok) return doc;

  // 3. write verbatim (merged-content) — server verifies every marker present
  let data;
  try {
    const res = await fetch(WRITE_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...baseBody,
        mode: 'merged-content',
        content: doc.content,
        mergeItems: doc.mergeItems,
        footerLines: [],
      }),
    });
    data = await res.json().catch(() => ({}));
  } catch (err) {
    return fail(WORKSPACE_DAY_OBSIDIAN_ERROR.WRITE_FAILED, { cause: err?.message || String(err) });
  }

  if (data?.error === 'NO_VAULT_PATH') return fail(WORKSPACE_DAY_OBSIDIAN_ERROR.NO_VAULT_PATH);
  if (!data?.ok) {
    return fail(WORKSPACE_DAY_OBSIDIAN_ERROR.WRITE_FAILED, { error: data?.error || data?.message });
  }
  if (data.verified !== true) {
    return fail(WORKSPACE_DAY_OBSIDIAN_ERROR.NOT_VERIFIED, {
      savedPath: data.savedPath || route.finalFilePath,
    });
  }

  return {
    ok: true,
    strategy: doc.isNew ? 'created' : 'merged',
    savedPath: data.savedPath || route.finalFilePath,
    absolutePath: data.absolutePath || '',
    obsidianUrl: route.obsidianUrl || data.obsidianUri || '',
    folder: route.folder,
    mainCategory: route.mainCategory,
    added: doc.added,
    skipped: doc.skipped,
    itemCount: doc.mergeItems.length,
    categories: route.orderedCategories,
  };
}
