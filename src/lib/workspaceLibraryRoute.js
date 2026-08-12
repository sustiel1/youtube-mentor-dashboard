import {
  WORKSPACE_COLLECTION_IDS,
  WORKSPACE_FALLBACK_COLLECTION,
  normalizeWorkspaceNavigationCollection,
} from '../config/workspaceHeadingRegistry.js';

export const WORKSPACE_LIBRARY_PATH = '/workspace-library';

const PARAM_KEYS = ['itemId', 'video', 'topicId', 'subtopicId', 'collection', 'semantic', 'returnTo'];
const INVALID_PATHS = new Set(['/null', '/undefined']);
const VALID_COLLECTIONS = new Set([...WORKSPACE_COLLECTION_IDS, WORKSPACE_FALLBACK_COLLECTION.id]);

function normalizeValue(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized || /^(null|undefined)$/i.test(normalized) || normalized.length > 300 || /[\u0000-\u001f]/.test(normalized)) return null;
  return normalized;
}

function normalizeParam(key, value) {
  const normalized = normalizeValue(value);
  if (!normalized) return null;
  if (key === 'collection') {
    if (normalized === 'all') return null;
    const navigationCollection = normalizeWorkspaceNavigationCollection(normalized);
    return navigationCollection && VALID_COLLECTIONS.has(navigationCollection) ? navigationCollection : null;
  }
  if (key === 'returnTo' && (!normalized.startsWith('/') || normalized.startsWith('//') || INVALID_PATHS.has(normalized))) return null;
  return normalized;
}

export function getWorkspaceLibraryUrl(options = {}) {
  const params = new URLSearchParams();
  for (const key of PARAM_KEYS) {
    const value = normalizeParam(key, options[key]);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `${WORKSPACE_LIBRARY_PATH}${query ? `?${query}` : ''}`;
}

function parseSearch(search) {
  const source = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const params = {};
  let malformed = false;
  for (const key of PARAM_KEYS) {
    if (!source.has(key)) continue;
    const rawValue = source.get(key);
    if (key === 'collection' && normalizeValue(rawValue) === 'all') continue;
    const value = normalizeParam(key, rawValue);
    if (value) params[key] = value;
    else malformed = true;
  }
  for (const key of source.keys()) {
    if (!PARAM_KEYS.includes(key)) malformed = true;
  }
  return { params, malformed };
}

export function toggleWorkspaceCollectionSelection(activeCollection, requestedCollection) {
  const active = normalizeParam('collection', activeCollection);
  const requested = normalizeParam('collection', requestedCollection);
  if (!requested) return null;
  return active === requested ? null : requested;
}

export function resolveWorkspaceLibraryLocation(pathname = '/', search = '') {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/';
  const parsed = parseSearch(search);
  if (INVALID_PATHS.has(path)) {
    return {
      isWorkspaceLibrary: true,
      canonicalUrl: getWorkspaceLibraryUrl(parsed.params),
      params: { ...parsed.params, routeNotice: 'invalid-route' },
      shouldReplace: true,
    };
  }
  if (path !== WORKSPACE_LIBRARY_PATH) return { isWorkspaceLibrary: false };

  const canonicalUrl = getWorkspaceLibraryUrl(parsed.params);
  return {
    isWorkspaceLibrary: true,
    canonicalUrl,
    params: parsed.malformed ? { ...parsed.params, routeNotice: 'malformed-params' } : parsed.params,
    shouldReplace: parsed.malformed || `${path}${search || ''}` !== canonicalUrl,
  };
}
