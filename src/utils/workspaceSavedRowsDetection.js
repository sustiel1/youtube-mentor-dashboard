/**
 * Section-type detection for the Path A saved-rows tables (indices/stocks/
 * sectors rendering as a compact table instead of a flat bullet list).
 *
 * Pure JS / no JSX — extracted out of WorkspaceFocusedVideoCard.jsx (which
 * has JSX throughout and can't be imported by plain node) so these
 * predicates can be unit tested directly with real section objects, instead
 * of grepping the component source for string literals.
 *
 * Each predicate reads `section.provenance[].originalItemType`, which comes
 * from `provenanceFor()` in workspaceSavedAnalysis.js:
 *   originalItemType: item.originalItemType || item.itemType || null
 * — item.originalItemType is preferred so this still resolves correctly for
 * items persisted by the per-row quick-save path (VideoDetailPanel.jsx's
 * saveSingleItemToWorkspace, which always writes itemType:'snippet' but
 * preserves the real type in originalItemType), not only the
 * WorkspaceSaveReviewOverlay.jsx bulk-review-and-confirm path.
 */

/** True when a text section is an aggregate of individually-saved market "indices" rows. */
export function isMarketRowsSection(section) {
  return !section.snapshot
    && section.entries.length > 0
    && section.provenance.some(entry => entry.originalItemType === 'indices');
}

/**
 * True when a text section is an aggregate of individually-saved
 * "מניות שהוזכרו" rows.
 *
 * Checks 'stocks-mentioned' — the raw type both save paths agree on — NOT
 * 'stock'. 'stock' only ever existed as WorkspaceSaveReviewOverlay.jsx's
 * itemType override for display-title purposes (stockExtraFields.itemType);
 * it was never written to originalItemType by either save path, and never
 * appears at all from the quick-save path. Checking for it here would make
 * every saved stock row fall through to the bullet-list renderer.
 */
export function isStockRowsSection(section) {
  return !section.snapshot
    && section.entries.length > 0
    && section.provenance.some(entry => entry.originalItemType === 'stocks-mentioned');
}

/**
 * True when a text section is an aggregate of individually-saved
 * "🏭 סקטורים" rows. 'brief-sectors' is the raw type both real producers
 * (MacroGemDashboard.jsx, MorningBriefPanels.jsx) use, and — unlike
 * stocks-mentioned — WorkspaceSaveReviewOverlay.jsx never remaps it to a
 * different itemType, so there is only one value to check here.
 */
export function isSectorRowsSection(section) {
  return !section.snapshot
    && section.entries.length > 0
    && section.provenance.some(entry => entry.originalItemType === 'brief-sectors');
}
