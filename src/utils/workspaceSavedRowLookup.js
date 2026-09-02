/**
 * "Already saved to Workspace" row lookup for live-analysis screens
 * (VideoDetailPanel.jsx's GEM content tabs).
 *
 * Match key = `${category}|${normalizedText}` — UNCHANGED shape from the
 * original implementation, so `isRowAlreadySaved()`'s signature and all ~22
 * existing render call sites need no edits. Video scoping (added in this
 * round) happens one level up, at INDEX-BUILD time, not in the key itself:
 * `buildSavedRowIndex(items, currentVideoScope)` only includes an item if
 * its own resolved video scope matches the video currently open, OR the
 * item has no resolvable scope at all (legacy data — see below). This is
 * semantically equivalent to prefixing every key with a video scope and
 * checking both the scoped and unscoped variants, but touches far less of
 * the codebase, since `useSavedRowIndex()` is already rebuilt once per open
 * video (see useSavedRowIndex.js) — there is only ever one "current video"
 * per built index, so filtering the source items is enough.
 *
 * Video scope resolution reuses `getWorkspaceVideoIdentity()` from
 * workspaceVideoGrouping.js — the same canonical resolver
 * `groupWorkspaceItemsByVideo()` already uses to group saved items by
 * video, and which itself now benefits from the sourceVideoId save-path
 * fix (commit 8b073512d) and its `findVideoByIdOrUrl()` URL-fallback
 * resolution for items saved before that fix. Not reimplemented here.
 *
 * Fallback rule for items with NO resolvable video identity
 * (`getWorkspaceVideoIdentity(item)` returns null), changed in the round
 * that added this comment (see WORK-ID TRADINGBRAIN-ANALYSIS-SAVEDROW-
 * INDICATOR, "כלל ההתאמה" round): the original Round-4 assumption — that
 * such items should always match regardless of which video is open — was a
 * leftover from before commit 8b073512d (which fixed the save-time id bug
 * and added `findVideoByIdOrUrl()` so older rows resolve via URL). That
 * fallback is what caused the reported symptom: legacy unscoped items kept
 * tagging rows for a video whose own rows had since been deleted, because
 * the index never distinguished "this saved item belongs to no video" from
 * "this saved item belongs to a video other than the deleted one." The
 * fallback now applies ONLY when the currently open video itself cannot be
 * resolved (`currentVideoScopes` empty/null — see `useSavedRowIndex.js`,
 * and Round 9's proof that an empty array and `null` are equivalent there).
 * Once the open video DOES resolve to at least one scope, an unscoped saved
 * item is excluded — it no longer tags rows in ANY resolvable video. This
 * means: (a) two saved items sharing the same category+text from two
 * DIFFERENT resolvable videos still only tag the genuinely matching
 * video's rows; (b) two saved items sharing the same category+text from
 * the SAME video (a genuine duplicate save) still both count as one match;
 * (c) a legacy item that has never resolved to any video no longer tags
 * rows in a video that itself resolves — accepted, deliberate behavior
 * change, not a regression: it removes the exact false-positive class that
 * caused deletions to leave stale tags behind.
 *
 * Structured-snapshot items (handleSaveStructuredSnapshot in
 * VideoDetailPanel.jsx) are confirmed NOT a duplicate source for this
 * indicator and need no special-casing: createWorkspaceProvenance() (see
 * config/workspaceHeadingRegistry.js) never sets `originalItemType`, so a
 * snapshot item's resolved category is always the literal string
 * `'structured-snapshot'` — a category no live row renderer ever passes to
 * `isRowAlreadySaved()` (they always pass their own specific category:
 * 'indices', 'stocks-mentioned', 'brief-sectors', etc.). Category mismatch
 * alone rules out any snapshot-vs-row collision by construction; verified
 * by reading the exact snapshot item construction, not assumed.
 *
 * Pure JS, no I/O, no React — reuses the exported `normalized()` and
 * `persistedText()` helpers from workspaceSavedAnalysis.js (the proven
 * canonical Hebrew-text normalizer / saved-item text resolver already used
 * by the Workspace Library's own saved-analysis viewer) rather than
 * reimplementing a second parallel version of either.
 */

import { normalized, persistedText } from './workspaceSavedAnalysis.js';
import { getWorkspaceVideoIdentity } from './workspaceVideoGrouping.js';

/** Trailing punctuation stripped after normalization (Hebrew geresh/gershayim included). */
const TRAILING_PUNCTUATION_RE = /[.,;:!?…׳״"'\s]+$/u;

/** Markdown link syntax `[label](url)` → `label`. */
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((?:[^()]*)\)/g;

/** Bare http(s):// URL tokens (whitespace/punctuation-delimited). */
const BARE_URL_RE = /https?:\/\/\S+/gi;

/**
 * Normalizes a row's display text for saved-row identity matching:
 * trim → collapse whitespace → NFKC → toLocaleLowerCase('he') (via the
 * shared `normalized()` helper) → strip markdown links down to their label
 * → strip bare URLs → strip trailing punctuation.
 */
export function normalizeSavedRowText(text) {
  const withoutLinks = String(text || '')
    .replace(MARKDOWN_LINK_RE, '$1')
    .replace(BARE_URL_RE, '');
  const nfkc = withoutLinks.normalize('NFKC');
  return normalized(nfkc).replace(TRAILING_PUNCTUATION_RE, '');
}

/**
 * Resolves a persisted item's original category, using the same
 * `originalItemType || itemType` fallback convention documented and used
 * by workspaceSavedRowsDetection.js's Path-A table-type predicates.
 */
export function resolveSavedItemCategory(item) {
  return item?.originalItemType || item?.itemType || null;
}

/**
 * Resolves an item's (or a live-video pseudo-item's — see
 * useSavedRowIndex.js) video scope key via the shared canonical resolver.
 * Returns null when unresolvable (legacy data, or a video record with no
 * id/videoId/youtubeId/url at all).
 */
export function resolveVideoScope(item) {
  return getWorkspaceVideoIdentity(item)?.key || null;
}

/**
 * Builds a Set of `${category}|${normalizedText}` keys for saved items
 * that (a) have a non-empty category and non-empty resolved text, and (b)
 * either resolve to one of `currentVideoScopes` or have no resolvable
 * video scope at all (backward-compatible legacy fallback — see file
 * header). Structured-snapshot items never match any live category (see
 * file header) and are naturally excluded without special-casing.
 *
 * `currentVideoScopes` accepts more than one acceptable scope because a
 * single real video can resolve to TWO different keys depending on which
 * save-time convention produced the saved item: saves made after the
 * sourceVideoId fix (commit 8b073512d) fall back to the video's own
 * internal `id` when no youtubeId/videoId is populated (the common case
 * for real records — see lessons.md 2026-08-24), so `resolveVideoScope()`
 * on those resolves via sourceVideoId to `video:<internalId>`. Saves made
 * BEFORE that fix never set sourceVideoId at all, so `resolveVideoScope()`
 * falls through to its own videoUrl-based extraction, resolving instead to
 * `video:<youtubeId>` (the id embedded in the URL). Both are the SAME real
 * video; without accepting both keys, pre-fix legacy saves — still the
 * majority of real data as of this round — would be wrongly excluded as
 * "a different video" instead of correctly falling into either the
 * matching-scope or (if truly unresolvable) the legacy-unscoped path. See
 * useSavedRowIndex.js for how both candidate scopes are computed for the
 * currently open video.
 *
 * @param {Array} items
 * @param {string|Iterable<string>|null} [currentVideoScopes] - one or more
 *   acceptable scope keys for the video currently open. Omitted/null/empty
 *   means the current video itself could not be resolved to any scope —
 *   the ONLY condition under which an unscoped (unresolvable) saved item
 *   still matches. Whenever at least one real scope is present, unscoped
 *   items are excluded — callers should always pass it when a video is open.
 */
export function buildSavedRowIndex(items, currentVideoScopes = null) {
  const scopes = currentVideoScopes == null
    ? new Set()
    : new Set(
        typeof currentVideoScopes === 'string' ? [currentVideoScopes] : currentVideoScopes,
      );
  const currentVideoResolved = scopes.size > 0;
  const index = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const category = resolveSavedItemCategory(item);
    if (!category) continue;
    const text = normalizeSavedRowText(persistedText(item));
    if (!text) continue;
    const itemScope = resolveVideoScope(item);
    if (itemScope !== null) {
      if (!scopes.has(itemScope)) continue;
    } else if (currentVideoResolved) {
      continue;
    }
    index.add(`${category}|${text}`);
  }
  return index;
}

/** False-safe: true only when `index` is a Set containing the row's key. */
export function isRowAlreadySaved(text, category, index) {
  if (!(index instanceof Set)) return false;
  if (!category) return false;
  const normalizedText = normalizeSavedRowText(text);
  if (!normalizedText) return false;
  return index.has(`${category}|${normalizedText}`);
}
