// ─── Workspace Tab Preferences ────────────────────────────────────────────────
// Stores UI-only tab customizations in localStorage.
// Does NOT affect saved workspace items or the VIRTUAL_TAXONOMY structure.
//
// Schema: { hiddenTabIds: string[], labelOverrides: Record<string, string> }

const PREFS_KEY = 'workspace_tab_preferences_v1';

function defaultPrefs() {
  return { hiddenTabIds: [], labelOverrides: {} };
}

export function getWorkspaceTabPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs();
    return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch {
    return defaultPrefs();
  }
}

export function saveWorkspaceTabPreferences(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

export function resetWorkspaceTabPreferences() {
  try {
    localStorage.removeItem(PREFS_KEY);
  } catch {}
}

// Returns tabs filtered to visible only, with display-label overrides applied.
// Hidden tabs still exist in the taxonomy and their data is accessible —
// only the navigation shortcut is removed from the UI.
export function getVisibleMainTabs(allTabs, prefs) {
  const { hiddenTabIds = [], labelOverrides = {} } = prefs;
  return allTabs
    .filter(vt => !hiddenTabIds.includes(vt.id))
    .map(vt => ({ ...vt, displayName: labelOverrides[vt.id] || vt.name }));
}
