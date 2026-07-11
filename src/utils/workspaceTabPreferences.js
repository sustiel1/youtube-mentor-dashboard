// ─── Workspace Tab Preferences ────────────────────────────────────────────────
// Stores UI-only tab customizations in localStorage.
// Does NOT affect saved workspace items or the VIRTUAL_TAXONOMY structure.
//
// Schema:
//   hiddenTabIds:   string[]           — built-in tabs hidden by user
//   labelOverrides: Record<string,str> — display-name overrides
//   customMainTabs: Array<{ id, name, emoji, realTopicId, isCustom }> — user-created tabs

const PREFS_KEY = 'workspace_tab_preferences_v1';

function defaultPrefs() {
  return {
    hiddenTabIds: [],
    labelOverrides: {},
    customMainTabs: [],
    // Row 2: custom subtopics per virtual-topic — { [vtId]: [{id, name}] }
    customSubtopics: {},
    // Row 3: custom workflow/status tabs — [{value, label}]
    customWorkflowTabs: [],
  };
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

// Converts customMainTabs from stored format to VIRTUAL_TAXONOMY-compatible shape
export function getCustomTabsAsVirtual(prefs) {
  return (prefs.customMainTabs || []).map(ct => ({
    id:           ct.id,
    name:         ct.name,
    emoji:        ct.emoji || '📌',
    realTopicIds: ct.realTopicId ? [ct.realTopicId] : [],
    legacyNames:  [],
    subtopics:    [],
    isCustom:     true,
  }));
}

// Returns baseTabs (VIRTUAL_TAXONOMY) merged with user's custom tabs
export function getAllMergedTabs(baseTabs, prefs) {
  return [...baseTabs, ...getCustomTabsAsVirtual(prefs)];
}

// Adds a new custom tab to preferences (call saveWorkspaceTabPreferences after)
export function addCustomMainTab(prefs, { name, emoji, topicId }) {
  const id = `cvt-${topicId}`;
  const customMainTabs = [
    ...(prefs.customMainTabs || []),
    { id, name, emoji: emoji || '📌', realTopicId: topicId, isCustom: true },
  ];
  return { ...prefs, customMainTabs };
}

// Removes a custom tab from preferences (cannot remove built-in tabs)
export function removeCustomMainTab(prefs, tabId) {
  const customMainTabs = (prefs.customMainTabs || []).filter(t => t.id !== tabId);
  return { ...prefs, customMainTabs };
}

// ─── Custom subtopics (Row 2) ─────────────────────────────────────────────────

export function getCustomSubtopics(prefs, vtId) {
  return (prefs.customSubtopics || {})[vtId] || [];
}

export function addCustomSubtopic(prefs, vtId, name) {
  const id   = `cvts-${vtId}-${Date.now()}`;
  const prev = (prefs.customSubtopics || {})[vtId] || [];
  return {
    ...prefs,
    customSubtopics: { ...(prefs.customSubtopics || {}), [vtId]: [...prev, { id, name }] },
  };
}

export function removeCustomSubtopic(prefs, vtId, id) {
  const prev = (prefs.customSubtopics || {})[vtId] || [];
  return {
    ...prefs,
    customSubtopics: { ...(prefs.customSubtopics || {}), [vtId]: prev.filter(s => s.id !== id) },
  };
}

// ─── Custom workflow/status tabs (Row 3) ──────────────────────────────────────

export function getCustomWorkflowTabs(prefs) {
  return prefs.customWorkflowTabs || [];
}

export function addCustomWorkflowTab(prefs, name) {
  const value = `cwf-${Date.now()}`;
  return {
    ...prefs,
    customWorkflowTabs: [...(prefs.customWorkflowTabs || []), { value, label: name }],
  };
}

export function removeCustomWorkflowTab(prefs, value) {
  return {
    ...prefs,
    customWorkflowTabs: (prefs.customWorkflowTabs || []).filter(t => t.value !== value),
  };
}
