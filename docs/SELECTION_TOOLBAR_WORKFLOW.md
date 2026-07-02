# Selection Toolbar Workflow

## Single Source of Truth for Selected-Item Actions

The **black bottom selection toolbar** is the only active system for bulk/selected-item actions.

---

## Architecture

### Black Bottom Toolbar (active)

Component: `UniversalTabSelectionBar` (dark, `bg-zinc-900`)
Also: `BulkSelectionBar` (light, sticky bottom)

Triggered when: one or more items selected via checkbox/V
Actions: Copy · Workspace · Obsidian · Save to Brain · Clear selection

### Three-Dots Menu (hidden)

Component: `CompactSaveMenu` inside `UniversalTabQuickSaveActions`
Status: **Disabled** — returns `null` when `compact={true}`

Location: `src/components/shared/UniversalTabQuickSaveActions.jsx`

```jsx
// Line ~266
if (compact) {
  // Three-dots menu hidden — bottom selection toolbar handles all bulk actions
  return null;
}
```

---

## How to Re-enable the Three-Dots Menu

To restore the per-row three-dots menu, replace the `return null` block with:

```jsx
if (compact) {
  return (
    <CompactSaveMenu
      payload={payload}
      onBrain={onBrain}
      onObsidian={onObsidian}
      onWorkspace={onWorkspace}
      brainSaved={brainSaved}
      obsidianSaved={obsidianSaved}
      workspaceSaved={workspaceSaved}
      pxUrl={pxUrl}
      className={className}
    />
  );
}
```

---

## Adding AI Actions to the Bottom Toolbar

To add AI actions, edit `UniversalTabSelectionBar` in:
`src/components/shared/UniversalTabSelectionBar.jsx`

Add a new button in the actions `<div>` block alongside existing buttons (Brain, Obsidian, Workspace, Copy).

---

## Files Changed (2026-06-29)

| File | Change |
|---|---|
| `src/components/shared/UniversalTabQuickSaveActions.jsx` | `compact` branch now returns `null` instead of rendering `CompactSaveMenu` |
| `docs/SELECTION_TOOLBAR_WORKFLOW.md` | This file — documents the new single-toolbar approach |
