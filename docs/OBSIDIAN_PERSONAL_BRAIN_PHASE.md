# Obsidian-first Personal Brain — Phase Checkpoint

## What Currently Works

- Obsidian ZIP export works from `Workspace`.
- Video notes are exported as Markdown learning notes.
- Structured selected knowledge can become real atomic notes.
- `brainHighlights` are now part of the selectable atomic knowledge flow.
- Visible Brain Highlight cards in the video analysis UI are selectable directly.
- Selection is persisted on the video via `selectedKnowledgeItems`.
- The `🧠 בחר ידע לברין` modal uses the same selection state as the visible highlight cards.
- `שמור לברין` creates a single `KnowledgeItem` from the currently selected items.
- Re-saving the same video updates the same `KnowledgeItem` id instead of creating duplicates.
- Export stats are tracked and surfaced:
  - `videoNotes`
  - `atomicNotesTotal`
  - `atomicByType`
- ZIP export success toast is wired:
  - `יוצאו X הערות וידאו ו־Y הערות אטומיות לאובסידיאן`

## Current ZIP Structure

Current export structure is topic-rooted, not a global `Videos/` root:

```text
<Topic>/
  Learnings/
    V-<video-slug>.md
  Atomic/
    Insights/
      <selected-brain-highlight>.md
      <selected-insight>.md
    Rules/
    Actions/
    Mistakes/
    Concepts/
    Frameworks/
    Questions/
    Quotes/
```

Notes:

- Selected `brainHighlights` are exported under `Atomic/Insights/`.
- The main video note links to selected atomic notes.
- Each atomic note includes a `## Source` section with a backlink to the source video note and source video id.

## Selection Flow

1. The main analysis layout stays clean:
   - `סיכום קצר`
   - `סיכום מלא`
   - `תובנות מרכזיות`
   - `פרקי הסרטון`
2. Brain Highlight cards remain visible in `תובנות מרכזיות`.
3. Clicking a visible Brain Highlight card toggles selection.
4. Selected highlight cards show:
   - checked state
   - blue border
   - subtle blue background
5. Selection is stored immediately in `video.selectedKnowledgeItems` with keys like:
   - `brainHighlights:0`
   - `brainHighlights:1`
6. The compact `🧠 בחר ידע לברין` button opens the full selection modal.
7. The modal supports:
   - all selectable atomic knowledge sections
   - section counts
   - `בחר הכל`
   - `נקה`
   - individual toggles
   - `שמור לברין`
   - `ייצוא`
8. Modal state and visible highlight card state are shared.
9. Refresh persists selection from localStorage-backed video storage.

## Important Files Changed

- [src/components/dashboard/VideoDetailPanel.jsx](../src/components/dashboard/VideoDetailPanel.jsx)
  - Visible Brain Highlight selection UI
  - `🧠 בחר ידע לברין` button
  - shared `selectedItems` state
  - knowledge picker modal
  - save/export actions from selected items

- [src/lib/obsidianExport.js](../src/lib/obsidianExport.js)
  - `extractBrainHighlightsFromVideo`
  - `getSelectedAtomicKnowledge`
  - `brainHighlights` mapping to `Atomic/Insights`
  - atomic note generation
  - selected knowledge Markdown building

- [src/lib/buildWorkspaceZip.js](../src/lib/buildWorkspaceZip.js)
  - ZIP assembly
  - export stats
  - `atomicByType.insights` counting for selected `brainHighlights`

- [src/lib/localKnowledgeItemStore.js](../src/lib/localKnowledgeItemStore.js)
  - `createKnowledgeItemFromVideo`
  - selected knowledge filtering
  - duplicate-safe upsert behavior via stable video-based id

- [src/pages/Workspace.jsx](../src/pages/Workspace.jsx)
  - ZIP export entrypoint and toast flow

## Known Limitations

- ZIP structure is topic-rooted today, not a dedicated global `Videos/` folder.
- Brain Highlights in the main analysis view are derived from `brainSummary` parsing or fallback structured fields, so display depends on available analysis content.
- `KnowledgeItem` creation is intentionally localStorage-first and lightweight; there is no backend sync in this phase.
- Selection persistence is video-level only; there is no separate selection history/versioning layer.
- Exported atomic note filenames are slug-based and implementation-driven, not yet user-curated.
- This phase does not change the AI analysis pipeline or backend schema.

## Next Recommended Phase

Phase recommendation: normalize the Obsidian vault model and make the Personal Brain export more explicit.

Suggested focus:

- Introduce a documented canonical vault structure policy:
  - decide whether to keep topic-rooted export or add a global `Videos/` root
- Add stronger note-link conventions:
  - consistent wiki-link formatting
  - predictable cross-note references
- Add small automated regression coverage for:
  - Brain Highlight selection persistence
  - modal select/clear behavior
  - ZIP export stats
  - backlink integrity
- Add a lightweight export manifest inside the ZIP for future debugging and migration safety.
