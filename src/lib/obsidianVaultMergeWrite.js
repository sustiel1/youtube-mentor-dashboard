/**
 * Unified Obsidian merge write — read existing note, merge items, write safely.
 * Used by both per-row and batch saves (same engine).
 */
import { mergeItemsIntoObsidianNote, noteContainsItemMarker } from '@/lib/obsidianNoteMerge';

const READ_ROUTE = '/api/vault/read';
const WRITE_ROUTE = '/api/vault/write';

export async function readObsidianVaultMarkdown({ path, vaultPath, vaultName } = {}) {
  try {
    const res = await fetch(READ_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, vaultPath, vaultName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.ok) {
      return { ok: false, content: '', exists: false, error: data?.error || 'READ_FAILED' };
    }
    return {
      ok: true,
      content: String(data.content || ''),
      exists: data.exists === true,
      savedPath: data.savedPath || path,
    };
  } catch (err) {
    return { ok: false, content: '', exists: false, error: err?.message || 'READ_FAILED' };
  }
}

export function mergeObsidianVaultItems({
  existingContent = '',
  mergeItems = [],
  videoTitle = '',
  footerLines = [],
} = {}) {
  return mergeItemsIntoObsidianNote({
    existingContent,
    videoTitle,
    items: mergeItems,
    footerLines,
  });
}

/**
 * Read → merge → write. Tries server merge first; falls back to full merged content write.
 */
export async function writeObsidianWithItemMerge({
  savePath,
  mergeItems = [],
  footerLines = [],
  videoTitle = '',
  vaultPath,
  vaultName,
  videoMeta = {},
} = {}) {
  const read = await readObsidianVaultMarkdown({ path: savePath, vaultPath, vaultName });
  const merged = mergeObsidianVaultItems({
    existingContent: read.content,
    mergeItems,
    videoTitle,
    footerLines,
  });

  const basePayload = {
    path: savePath,
    vaultPath,
    vaultName,
    videoTitle,
    footerLines,
    mergeItems,
    ...videoMeta,
  };

  let res = await fetch(WRITE_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...basePayload, mode: 'merge' }),
  });
  let data = await res.json().catch(() => ({}));

  if (data?.ok && data?.verified === true) {
    return { ok: true, data, merged, read, strategy: 'server-merge' };
  }

  // Fallback: write client-read merged document (preserves A+B when server merge unavailable)
  res = await fetch(WRITE_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...basePayload,
      mode: 'merged-content',
      content: merged.content,
    }),
  });
  data = await res.json().catch(() => ({}));

  if (data?.ok && data?.verified === true) {
    return { ok: true, data, merged, read, strategy: 'client-merge-fallback' };
  }

  return {
    ok: false,
    data,
    merged,
    read,
    strategy: 'failed',
    error: data?.error || data?.message || 'WRITE_FAILED',
  };
}

export function verifyMergedMarkers(content, mergeItems = []) {
  const body = String(content || '');
  return (mergeItems || []).every((item) => noteContainsItemMarker(body, item.identityKey));
}
