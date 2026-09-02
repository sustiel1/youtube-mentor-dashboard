import { useMemo } from 'react';
import { useWorkspaceItems } from './useWorkspaceLibrary';
import { buildSavedRowIndex, resolveVideoScope } from '@/utils/workspaceSavedRowLookup';

/**
 * Builds the "already saved to Workspace" row-identity Set once per render,
 * reused across every per-row checkbox site in the live-analysis screen.
 * Reuses the existing useWorkspaceItems() hook (already subscribed to the
 * workspace persistence layer's 'record-updated'/'generation-active'
 * events) — no second subscription mechanism.
 *
 * @param {object|null} [currentVideo] - the video currently open in
 *   VideoDetailPanel.jsx (effectiveVideo). Resolved into UP TO TWO
 *   candidate scope keys (see buildSavedRowIndex()'s doc comment for why
 *   two, not one): an id-based key (matching saves made after the
 *   sourceVideoId fix, which fall back to the video's own `id`) and a
 *   URL-based key (matching saves made before it, which only ever
 *   populated `videoUrl`). Passing neither (an empty video) falls back to
 *   the pre-scoping behavior for legacy-unresolvable saved items only.
 */
export function useSavedRowIndex(currentVideo) {
  const { items } = useWorkspaceItems();
  const idCandidate = currentVideo?.youtubeId || currentVideo?.videoId || currentVideo?.id || null;
  const urlCandidate = currentVideo?.url || null;
  const currentVideoScopes = useMemo(() => {
    const idScope = idCandidate ? resolveVideoScope({ sourceVideoId: idCandidate }) : null;
    const urlScope = urlCandidate ? resolveVideoScope({ videoUrl: urlCandidate }) : null;
    return [idScope, urlScope].filter(Boolean);
  }, [idCandidate, urlCandidate]);
  return useMemo(() => buildSavedRowIndex(items, currentVideoScopes), [items, currentVideoScopes]);
}
