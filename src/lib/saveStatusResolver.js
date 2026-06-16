/**
 * Read-only save status helpers for Brain / Obsidian library / Workspace.
 * Uses existing storage — no format or save-logic changes.
 */
import { getKnowledgeItems } from '@/lib/localKnowledgeItemStore';
import { getLibraryContents } from '@/lib/knowledgeLibrary';
import { resolveObsidianItemSaveEntry } from '@/lib/obsidianItemSaveStore';

function normalizeText(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

function textDedupeKey(text) {
  return String(text || '').slice(0, 60).toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9א-ת-]/g, '') || 'item';
}

/** Same id scheme as VideoDetailPanel.itemDedupeKey */
export function buildItemSaveIds(videoId, tabKey, text) {
  const key = textDedupeKey(text);
  const tab = tabKey || 'multi';
  return {
    brainId: `brain-item:${videoId}:${tab}:${key}`,
    wsId: `ws-item:${videoId}:${tab}:${key}`,
  };
}

function findKnowledgeItem(id) {
  if (!id) return null;
  return getKnowledgeItems().find((item) => item.id === id) || null;
}

function formatSavedDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export function resolveBrainSaveStatus(videoId, tabKey, text) {
  const { brainId } = buildItemSaveIds(videoId, tabKey, text);
  const item = findKnowledgeItem(brainId);
  if (!item) {
    return {
      saved: false,
      location: 'Knowledge Store',
      savedAt: null,
      openPath: null,
      topicId: null,
    };
  }
  return {
    saved: true,
    location: item.workspacePath || 'Knowledge Store',
    savedAt: formatSavedDate(item.metadata?.savedAt || item.updatedAt || item.createdAt),
    openPath: item.workspacePath || null,
    topicId: item.topicId || null,
  };
}

export function resolveWorkspaceSaveStatus(videoId, tabKey, text) {
  const { wsId } = buildItemSaveIds(videoId, tabKey, text);
  const item = findKnowledgeItem(wsId);
  if (!item) {
    return {
      saved: false,
      location: 'Workspace / קטעים',
      savedAt: null,
      openPath: null,
      topicId: null,
    };
  }
  return {
    saved: true,
    location: item.workspacePath || item.sectionName || 'Workspace',
    savedAt: formatSavedDate(item.updatedAt || item.createdAt),
    openPath: item.workspacePath || null,
    topicId: item.topicId || null,
  };
}

function resolveObsidianSaveStatusFromLibrary(text) {
  const norm = normalizeText(text);
  if (!norm) return null;

  const lib = getLibraryContents();
  for (const [path, page] of Object.entries(lib)) {
    const items = Array.isArray(page?.items) ? page.items : [];
    const match = items.find((entry) => normalizeText(entry?.text) === norm);
    if (match) {
      return {
        saved: true,
        path,
        savedAt: formatSavedDate(match.savedAt),
        openPath: path,
        hint: null,
      };
    }
  }
  return null;
}

/**
 * @param {string|{ videoId?, tabKey?, sectionKey?, text, destinationPath? }} textOrParams
 */
export function resolveObsidianSaveStatus(textOrParams, legacyTabKey) {
  const params = typeof textOrParams === 'string'
    ? { text: textOrParams, tabKey: legacyTabKey }
    : (textOrParams || {});
  const norm = normalizeText(params.text);
  if (!norm) {
    return {
      saved: false,
      path: null,
      savedAt: null,
      openPath: null,
      hint: 'שמירה מורידה קובץ Markdown לתיקיית ההורדות',
    };
  }

  if (params.videoId) {
    const entry = resolveObsidianItemSaveEntry(
      {
        videoId: params.videoId,
        tabKey: params.tabKey,
        sectionKey: params.sectionKey,
        text: norm,
      },
      params.destinationPath ? { destinationPath: params.destinationPath } : {},
    );
    if (entry) {
      return {
        saved: true,
        path: entry.destinationPath,
        savedAt: formatSavedDate(entry.savedAt),
        openPath: entry.destinationPath,
        hint: null,
      };
    }
  }

  const libraryStatus = resolveObsidianSaveStatusFromLibrary(norm);
  if (libraryStatus) return libraryStatus;

  return {
    saved: false,
    path: null,
    savedAt: null,
    openPath: null,
    hint: 'שמירה מורידה קובץ Markdown לתיקיית ההורדות',
  };
}

export function resolveSaveStatusForTarget(target, { videoId, tabKey, sectionKey, text, destinationPath }) {
  if (target === 'brain') return resolveBrainSaveStatus(videoId, tabKey, text);
  if (target === 'workspace') return resolveWorkspaceSaveStatus(videoId, tabKey, text);
  if (target === 'obsidian') {
    return resolveObsidianSaveStatus({ videoId, tabKey, sectionKey, text, destinationPath });
  }
  return { saved: false };
}
