/**
 * Live-Stream Brief Permanence — Phase 4 maintenance tooling.
 * WORK-ID: YMD-BRIEF-PERMANENCE-SPLIT
 * docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md §3.2, §7 (Phase 4 row).
 *
 * Pure logic only — no localStorage, no vault fetch. All I/O is injected by
 * the caller (readNoteContent / writeNoteContent), matching this codebase's
 * existing split between obsidianNoteMerge.js (pure) and
 * obsidianVaultMergeWrite.js (I/O). This module has NOT been wired to a UI
 * button yet — see the Phase 4 report for the proposed integration point
 * (src/pages/Admin.jsx's existing "ארגון Vault" tab, which already has the
 * same report-then-confirm two-step pattern for vault-migration scans).
 *
 * Two-step design, exactly per §3.2:
 *   1. scanExpiredBriefItems() — read-only. Candidates + 3 non-candidate
 *      report buckets (missingMeta, mismatch, alreadyArchived). Never
 *      writes anything.
 *   2. computeArchiveForCandidate() — pure "what would writing this look
 *      like" for ONE verified candidate. The caller (a future DEV-button
 *      handler) is responsible for the actual explicit-confirm gate and
 *      the real vault write.
 *
 * Hard constraints enforced structurally (not just by convention):
 *   - Never touches PLAYBOOK_PATH (candidates are daily-only by construction —
 *     resolveDailyBriefPath is used, never PLAYBOOK_PATH).
 *   - Never deletes: source content is only ever appended to (a trailing
 *     tombstone comment), the original bullet/marker/meta lines are always
 *     preserved verbatim.
 *   - Never mutates a `permanent` item: only `permanence === 'daily'` entries
 *     are ever considered at all.
 */
import { buildObsidianItemMarker, insertBulletIntoSection } from '@/lib/obsidianNoteMerge';
import { resolveDailyBriefPath } from '@/lib/briefPermanenceMeta';
import { resolveEntryIdentityKey } from '@/lib/obsidianItemSaveStore';

const YMD_META_LINE_RE = /^<!--\s*ymd-meta:v1\s/;
const YMD_EXPIRED_LINE_RE = /^<!--\s*ymd-expired:v1\s/;
export const ARCHIVED_ITEMS_SECTION_LABEL = 'ארכיון';

function isDatedBriefPath(path) {
  return /^שוק ההון\/מבזקים\/\d{4}-\d{2}-\d{2}\.md$/.test(String(path || '').trim());
}

/**
 * Locates one item's block (bullet line + identity marker + optional
 * ymd-meta line) inside note content, by exact line-adjacency — the same
 * shape obsidianNoteMerge.js's buildBulletBlock() always writes: bullet
 * line, then the marker line directly below it, then (optionally) the
 * ymd-meta line directly below that. Returns null when the marker isn't
 * found, or is found but not preceded by a bullet line (malformed/manually
 * edited note — report only, never guess).
 */
export function locateItemBlock(content, identityKey) {
  const marker = buildObsidianItemMarker(identityKey);
  if (!marker) return null;
  const lines = String(content || '').split('\n');
  const markerLineIdx = lines.findIndex((l) => l.trim() === marker);
  if (markerLineIdx <= 0) return null;

  const bulletLine = lines[markerLineIdx - 1];
  if (!bulletLine.trimStart().startsWith('*')) return null;

  let blockEndIdx = markerLineIdx;
  const nextLine = lines[markerLineIdx + 1];
  const hasMetaLine = Boolean(nextLine && YMD_META_LINE_RE.test(nextLine.trim()));
  if (hasMetaLine) blockEndIdx = markerLineIdx + 1;

  const tombstoneLine = lines[blockEndIdx + 1];
  const alreadyArchived = Boolean(tombstoneLine && YMD_EXPIRED_LINE_RE.test(tombstoneLine.trim()));

  return {
    bulletLineIdx: markerLineIdx - 1,
    markerLineIdx,
    metaLineIdx: hasMetaLine ? markerLineIdx + 1 : null,
    blockEndIdx,
    blockText: lines.slice(markerLineIdx - 1, blockEndIdx + 1).join('\n'),
    hasMetaLine,
    alreadyArchived,
  };
}

/**
 * §3.2 first button — "בדיקת תפוגה" — read-only scan. Never writes.
 * @param {object} params
 * @param {Array} params.entries — from listObsidianItemSaveEntries()
 * @param {string} params.today — `YYYY-MM-DD` (caller resolves via resolveSaveDateJerusalem)
 * @param {(path: string) => string|null} params.readNoteContent — injected vault read; null = unreadable/missing
 * @returns {{candidates: object[], missingMeta: object[], mismatch: object[], alreadyArchived: object[]}}
 */
export function scanExpiredBriefItems({ entries = [], today, readNoteContent }) {
  const candidates = [];
  const missingMeta = [];
  const mismatch = [];
  const alreadyArchived = [];

  for (const entry of entries) {
    if (entry.permanence !== 'daily') continue; // permanent items are never candidates
    if (!entry.expiry || !entry.date) continue; // nothing to compare against
    if (today < entry.expiry) continue; // not expired yet

    const targetPath = resolveDailyBriefPath(entry.date);
    if (!targetPath) continue; // no valid date to archive to — report nothing rather than guess

    if (isDatedBriefPath(entry.destinationPath) && entry.destinationPath === targetPath) {
      continue; // already living in its own correct dated archive — nothing to do
    }

    const identityKey = resolveEntryIdentityKey(entry);
    const sourceContent = readNoteContent ? readNoteContent(entry.destinationPath) : null;
    const base = { dedupeKey: entry.dedupeKey, videoId: entry.videoId, briefSectionKey: entry.briefSectionKey || null, sourcePath: entry.destinationPath, targetPath, expiry: entry.expiry, date: entry.date };

    if (sourceContent == null) {
      missingMeta.push({ ...base, reason: 'source-unreadable' });
      continue;
    }

    const block = locateItemBlock(sourceContent, identityKey);
    if (!block) {
      missingMeta.push({ ...base, reason: 'marker-not-found' });
      continue;
    }
    if (!block.hasMetaLine) {
      missingMeta.push({ ...base, reason: 'ymd-meta-missing' });
      continue;
    }
    if (block.alreadyArchived) {
      alreadyArchived.push({ ...base, reason: 'tombstone-present' });
      continue;
    }

    // Verify the note's own ymd-meta agrees with the store on permanence —
    // the one field whose disagreement would mean archiving the wrong thing.
    const metaLineMatch = /permanence=([a-z-]+)/.exec(sourceContent.split('\n')[block.metaLineIdx] || '');
    const notedPermanence = metaLineMatch ? decodeURIComponent(metaLineMatch[1]) : null;
    if (notedPermanence && notedPermanence !== entry.permanence) {
      mismatch.push({ ...base, reason: 'permanence-mismatch', storePermanence: entry.permanence, notedPermanence });
      continue;
    }

    candidates.push({ ...base, sourceText: block.blockText, identityKey });
  }

  return { candidates, missingMeta, mismatch, alreadyArchived };
}

/**
 * §3.2 second button — "ארכב פריטים שפגו" — pure "what would this write do"
 * for ONE already-verified candidate (from scanExpiredBriefItems's
 * `candidates` list — never re-derive independently, to avoid acting on a
 * candidate whose note changed between scan and archive). Copy + tombstone,
 * never move/delete: the source's original bullet/marker/meta lines are
 * always preserved verbatim; only a tombstone comment is appended after them.
 *
 * @param {object} params
 * @param {object} params.candidate — one entry from scanExpiredBriefItems().candidates
 * @param {string} params.sourceContent — freshly re-read source note content
 * @param {string} [params.targetContent] — freshly re-read target note content (may not exist yet)
 * @param {string} params.expiredOn — `YYYY-MM-DD`, the archive-run date (not the item's own date)
 * @returns {{ok: boolean, reason?: string, updatedSourceContent?: string, updatedTargetContent?: string, targetChanged?: boolean}}
 */
export function computeArchiveForCandidate({ candidate, sourceContent, targetContent = '', expiredOn }) {
  const block = locateItemBlock(sourceContent, candidate.identityKey);
  if (!block) return { ok: false, reason: 'source-changed-since-scan' };
  if (block.alreadyArchived) return { ok: false, reason: 'already-archived' };

  const alreadyInTarget = String(targetContent || '').includes(buildObsidianItemMarker(candidate.identityKey));
  const updatedTargetContent = alreadyInTarget
    ? targetContent
    : insertBulletIntoSection(targetContent, ARCHIVED_ITEMS_SECTION_LABEL, block.blockText);

  const tombstone = `<!-- ymd-expired:v1 archivedTo=${encodeURIComponent(candidate.targetPath)} expiredOn=${expiredOn} -->`;
  const lines = String(sourceContent).split('\n');
  lines.splice(block.blockEndIdx + 1, 0, tombstone);
  const updatedSourceContent = lines.join('\n');

  return {
    ok: true,
    updatedSourceContent,
    updatedTargetContent,
    targetChanged: !alreadyInTarget,
  };
}
