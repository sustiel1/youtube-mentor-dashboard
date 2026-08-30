#!/usr/bin/env node
/**
 * Stage 3 QA — Workspace Day → Obsidian export (logic only, no dev server).
 *
 * Covers:
 *   1. Multi-category section ordering (fixed WORKSPACE_DAY_CATEGORY_ORDER).
 *   2. Merge-marker idempotency (export twice → one note, one day marker,
 *      no duplicate bullets, added=0 on the second pass, byte-identical).
 *   3. Routing resolution per category → `<routeHint.mainCategory>/Workspace Days`,
 *      plus a cross-engine agreement check (obsidianRouting vs obsidianExport).
 *   4. Frozen contentSnapshot → bullet rendering (+ wikilink-breaking sanitize).
 *   5. New category appearing on re-export is spliced in without corrupting
 *      the YAML frontmatter or duplicating the day marker.
 *   6. Empty day / non-closed day → structured { ok:false } (no false success).
 *
 * Run:
 *   node --import ./scripts/register-src-aliases.mjs scripts/workspace-day-obsidian-export-qa.mjs
 */
import assert from 'node:assert/strict';

import {
  buildWorkspaceDayMergeModel,
  buildWorkspaceDayDocument,
  resolveWorkspaceDayObsidianRoute,
  exportWorkspaceDayToObsidian,
  WORKSPACE_DAY_OBSIDIAN_SUBFOLDER,
  WORKSPACE_DAY_OBSIDIAN_ERROR,
} from '../src/lib/workspaceDayObsidianExport.js';
import { buildWorkspaceDayObsidianHandoff } from '../src/lib/workspaceDayObsidianContract.js';
import {
  WORKSPACE_DAY_CATEGORY_ORDER,
  WORKSPACE_DAY_CATEGORY_CATALOG,
  getWorkspaceDayCategoryMeta,
} from '../src/config/workspaceDayCategories.js';
import { noteContainsItemMarker } from '../src/lib/obsidianNoteMerge.js';
import { resolveObsidianFolderFromTaxonomy } from '../src/lib/obsidianRouting.js';
import { resolveObsidianFolderForVideo } from '../src/lib/obsidianExport.js';

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${error.message}`);
    failed += 1;
  }
}

function occurrences(haystack, needle) {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

function makeMember(id, category, { title, url, identity } = {}) {
  return {
    workspaceItemId: String(id),
    itemIdentityKey: identity || `identity:${id}`,
    category,
    entryMode: 'manual',
    attachedAt: '2026-08-29T08:00:00.000Z',
    frozen: true,
    frozenAt: '2026-08-29T18:00:00.000Z',
    refreshedAt: null,
    contentSnapshot: { videoTitle: title || `כותרת ${id}`, url: url || null },
    sourceVideoId: url ? null : `vid${id}`,
    sourceUrl: url || `https://www.youtube.com/watch?v=vid${id}`,
  };
}

function makeClosedDay(members, { dateKey = '2026-08-29', id = 'wd-2026-08-29-abc123' } = {}) {
  const day = {
    id,
    schemaVersion: 1,
    dateKey,
    status: 'closed',
    entryMode: 'manual',
    createdAt: `${dateKey}T07:00:00.000Z`,
    updatedAt: `${dateKey}T18:05:00.000Z`,
    closedAt: `${dateKey}T18:00:00.000Z`,
    reopenCount: 0,
    reopenedAt: null,
    members,
    closeSnapshot: null,
  };
  day.closeSnapshot = {
    schemaVersion: 1,
    builtAt: `${dateKey}T18:00:00.000Z`,
    memberCount: members.length,
    frozenCount: members.length,
    categoryBreakdown: {},
    checksum: 0,
    checksumAlgorithm: 'fnv1a',
    obsidianHandoff: buildWorkspaceDayObsidianHandoff(day, members),
  };
  return day;
}

// ── 1. Multi-category section ordering ──────────────────────────────────────
await check('sections follow the fixed category order regardless of member order', () => {
  const day = makeClosedDay([
    makeMember(1, 'general'),
    makeMember(2, 'ai'),
    makeMember(3, 'stocks'),
    makeMember(4, 'political'),
  ]);
  const model = buildWorkspaceDayMergeModel(day);
  assert.deepEqual(model.orderedCategories, ['stocks', 'political', 'ai', 'general']);

  const doc = buildWorkspaceDayDocument({ day, existingContent: '' });
  assert.equal(doc.ok, true);
  const labels = model.orderedCategories.map((c) => getWorkspaceDayCategoryMeta(c).label);
  const positions = labels.map((label) => doc.content.indexOf(`## ${label}`));
  assert.ok(positions.every((p) => p >= 0), 'every category section header present');
  assert.deepEqual(positions.slice().sort((a, b) => a - b), positions, 'sections in fixed order');
});

// ── 2. Merge-marker idempotency ────────────────────────────────────────────
await check('re-export merges into one note — one day marker, no dup bullets, added=0', () => {
  const day = makeClosedDay([
    makeMember(1, 'stocks', { title: 'מניית טסלה', url: 'https://youtu.be/aaa' }),
    makeMember(2, 'ai', { title: 'סוכני AI' }),
  ]);

  const first = buildWorkspaceDayDocument({ day, existingContent: '' });
  assert.equal(first.ok, true);
  assert.equal(first.isNew, true);
  assert.equal(first.added, 2);
  assert.equal(occurrences(first.content, day.closeSnapshot.obsidianHandoff.mergeMarker), 1);

  const second = buildWorkspaceDayDocument({ day, existingContent: first.content });
  assert.equal(second.ok, true);
  assert.equal(second.isNew, false);
  assert.equal(second.added, 0, 'nothing new added on identical re-export');
  assert.equal(second.skipped, 2, 'both members skipped by their item markers');
  assert.equal(second.content, first.content, 'byte-identical on idempotent re-export');
  assert.equal(occurrences(second.content, day.closeSnapshot.obsidianHandoff.mergeMarker), 1);
  assert.equal(occurrences(second.content, '* [מניית טסלה]('), 1);

  // manual edit between markers survives a third export
  const edited = first.content.replace(
    '## ' + getWorkspaceDayCategoryMeta('ai').label + '\n',
    '## ' + getWorkspaceDayCategoryMeta('ai').label + '\n\nהערה ידנית שנוספה ב-Obsidian\n',
  );
  const third = buildWorkspaceDayDocument({ day, existingContent: edited });
  assert.ok(third.content.includes('הערה ידנית שנוספה ב-Obsidian'), 'manual edit preserved');
  assert.equal(third.added, 0);
});

// ── 3. Routing resolution per category + cross-engine agreement ─────────────
await check('every category routes to <routeHint.mainCategory>/Workspace Days', () => {
  for (const category of WORKSPACE_DAY_CATEGORY_ORDER) {
    const day = makeClosedDay([makeMember(1, category)]);
    const route = resolveWorkspaceDayObsidianRoute(day, { vaultName: 'Knowledge-Base' });
    assert.equal(route.ok, true, `route ok for ${category}`);
    const expectedMain = WORKSPACE_DAY_CATEGORY_CATALOG[category].routeHint.mainCategory;
    assert.equal(route.mainCategory, expectedMain, `mainCategory for ${category}`);
    assert.equal(route.folder, `${expectedMain}/${WORKSPACE_DAY_OBSIDIAN_SUBFOLDER}`);
    assert.equal(route.fileName, 'WD-2026-08-29.md');
    assert.equal(route.finalFilePath, `${expectedMain}/${WORKSPACE_DAY_OBSIDIAN_SUBFOLDER}/WD-2026-08-29.md`);
    assert.ok(route.obsidianUrl.startsWith('obsidian://open?vault=Knowledge-Base&file='));
  }
});

await check('two routing engines agree on every mainCategory this feature can produce', () => {
  const roots = new Set(
    WORKSPACE_DAY_CATEGORY_ORDER.map((c) => WORKSPACE_DAY_CATEGORY_CATALOG[c].routeHint.mainCategory),
  );
  for (const root of roots) {
    const taxonomy = resolveObsidianFolderFromTaxonomy({ category: root });
    const exportEngine = resolveObsidianFolderForVideo({ category: root });
    assert.equal(taxonomy, root, `obsidianRouting returns the bare root for ${root}`);
    assert.equal(exportEngine, root, `obsidianExport returns the bare root for ${root}`);
    assert.equal(taxonomy, exportEngine, `engines agree for ${root}`);
  }
});

// ── 4. Frozen contentSnapshot → bullet rendering ───────────────────────────
await check('bullets are built from contentSnapshot with a source link + item marker', () => {
  const day = makeClosedDay([
    makeMember(1, 'stocks', { title: 'ניתוח S&P 500', url: 'https://example.com/x' }),
  ]);
  const model = buildWorkspaceDayMergeModel(day);
  const doc = buildWorkspaceDayDocument({ day, existingContent: '' });
  assert.ok(doc.content.includes('* [ניתוח S&P 500](https://example.com/x)'));
  assert.equal(noteContainsItemMarker(doc.content, model.items[0].identityKey), true);
});

await check('wikilink-breaking characters in a snapshot title are sanitized', () => {
  const day = makeClosedDay([
    makeMember(1, 'ai', { title: 'מדריך [חשוב] | חלק 2', url: 'https://example.com/y' }),
  ]);
  const doc = buildWorkspaceDayDocument({ day, existingContent: '' });
  assert.ok(!doc.content.includes('[חשוב]'), 'no raw square brackets from the title');
  assert.ok(doc.content.includes('מדריך  חשוב  / חלק 2') || doc.content.includes('מדריך חשוב / חלק 2'));
});

// ── 5. New category on re-export ───────────────────────────────────────────
await check('a category added after the first export is spliced in without frontmatter damage', () => {
  const dayV1 = makeClosedDay([makeMember(1, 'stocks', { title: 'פתיחת מסחר' })]);
  const first = buildWorkspaceDayDocument({ day: dayV1, existingContent: '' });
  assert.ok(first.content.startsWith('---\ntype: workspace-day\n'));

  const dayV2 = makeClosedDay([
    makeMember(1, 'stocks', { title: 'פתיחת מסחר' }),
    makeMember(2, 'political', { title: 'רגולציה חדשה', url: 'https://example.com/reg' }),
  ]);
  const second = buildWorkspaceDayDocument({ day: dayV2, existingContent: first.content });
  assert.equal(second.ok, true);
  assert.ok(second.content.startsWith('---\ntype: workspace-day\n'), 'frontmatter still intact at top');
  assert.equal(occurrences(second.content, '\n---\n'), 2, 'exactly frontmatter close + footer sentinel');
  assert.ok(second.content.includes(`## ${getWorkspaceDayCategoryMeta('political').label}`), 'new section header added');
  assert.ok(second.content.includes('* [רגולציה חדשה](https://example.com/reg)'), 'new member bullet added');
  assert.equal(occurrences(second.content, dayV2.closeSnapshot.obsidianHandoff.mergeMarker), 1, 'still one day marker');
  assert.equal(second.added, 1);
  assert.equal(second.skipped, 1);
});

await check('a new EARLIER-order category on re-export is inserted at its fixed position', () => {
  const dayV1 = makeClosedDay([makeMember(1, 'ai', { title: 'סיכום AI' })]);
  const first = buildWorkspaceDayDocument({ day: dayV1, existingContent: '' });

  const dayV2 = makeClosedDay([
    makeMember(1, 'ai', { title: 'סיכום AI' }),
    makeMember(2, 'stocks', { title: 'סגירת מסחר', url: 'https://example.com/close' }),
  ]);
  const second = buildWorkspaceDayDocument({ day: dayV2, existingContent: first.content });
  assert.equal(second.ok, true);
  const stocksAt = second.content.indexOf(`## ${getWorkspaceDayCategoryMeta('stocks').label}`);
  const aiAt = second.content.indexOf(`## ${getWorkspaceDayCategoryMeta('ai').label}`);
  assert.ok(stocksAt >= 0 && aiAt >= 0);
  assert.ok(stocksAt < aiAt, 'stocks section precedes ai (fixed order preserved on re-export)');
  assert.ok(second.content.startsWith('---\ntype: workspace-day\n'), 'frontmatter intact');
  assert.equal(second.added, 1);
});

// ── 6. No false success ───────────────────────────────────────────────────
await check('empty day → { ok:false, NO_CATEGORIES }', () => {
  const route = resolveWorkspaceDayObsidianRoute(makeClosedDay([]));
  assert.equal(route.ok, false);
  assert.equal(route.code, WORKSPACE_DAY_OBSIDIAN_ERROR.NO_CATEGORIES);
  assert.ok(typeof route.userMessage === 'string' && route.userMessage.length > 0);
});

await check('non-closed day → exportWorkspaceDayToObsidian rejects before any I/O', async () => {
  const openDay = { ...makeClosedDay([makeMember(1, 'stocks')]), status: 'open' };
  const result = await exportWorkspaceDayToObsidian(openDay);
  assert.equal(result.ok, false);
  assert.equal(result.code, WORKSPACE_DAY_OBSIDIAN_ERROR.DAY_NOT_CLOSED);
});

await check('export surfaces a Hebrew userMessage when the vault route is unreachable', async () => {
  // No dev server + no vault config in Node → fetch throws → structured failure.
  const day = makeClosedDay([makeMember(1, 'stocks')]);
  const result = await exportWorkspaceDayToObsidian(day);
  assert.equal(result.ok, false);
  assert.ok(
    [
      WORKSPACE_DAY_OBSIDIAN_ERROR.READ_FAILED,
      WORKSPACE_DAY_OBSIDIAN_ERROR.NO_VAULT_PATH,
      WORKSPACE_DAY_OBSIDIAN_ERROR.WRITE_FAILED,
    ].includes(result.code),
    `unexpected code: ${result.code}`,
  );
  assert.match(result.userMessage, /[֐-׿]/, 'userMessage is Hebrew');
});

// ── summary ──────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\nWorkspace Day Obsidian export QA: ${passed}/${total} passed`);
process.exit(failed > 0 ? 1 : 0);
