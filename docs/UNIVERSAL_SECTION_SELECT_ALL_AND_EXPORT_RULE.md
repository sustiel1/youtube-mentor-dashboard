# Universal Section Select-All & CSV Export Rule

## 1. Goal

Allow users to select all child items within a section by clicking the section header checkbox — across all 7 universal tabs. Enables efficient bulk save, export, and AI analysis for entire sections without clicking each row individually.

## 2. Product Rule

Every section with saveable content must expose a checkbox that:
- **Checked** — all children are selected
- **Indeterminate** — some children are selected
- **Unchecked** — no children are selected
- Clicking an unchecked/indeterminate header adds all missing children to selection
- Clicking a checked header removes all section children from selection
- Child items remain individually selectable

## 3. Supported Tabs

| Tab | Implementation |
|---|---|
| Summary | `BriefingCard` → `SelectableSummaryCardHeader` with `sectionChildItems` |
| Insights | `UniversalTabSectionLabelRow` with `sectionChildItems` (VideoDetailPanel + InsightsStructuredView) |
| Useful Knowledge | `UniversalTabSectionLabelRow` with `sectionChildItems` (VideoDetailPanel) |
| APP Builder | Handled by `AppBuilderTab` component (uses its own bulk system) |
| Obsidian Mapping | Topics section via `UniversalTabSectionLabelRow` in VideoDetailPanel |
| Specialized | `Section` component → `SelectableSummaryCardHeader` / `UniversalTabSectionLabelRow` with `sectionChildItems` |
| Chapters | Not applicable — chapters use their own select mechanism |

## 4. Section-Level Selection Behavior

### New hook functions (useTabBulkSelection.js)

- `multiSelectSection(items[])` — **additively** adds items to `multiSelected` Map without replacing existing selections
- `multiDeselectSection(ids[])` — **selectively** removes items by id list from `multiSelected` Map

### Exposed on bulkSelectionShare

- `onSectionSelect(items[])` — calls `multiSelectSection`
- `onSectionDeselect(ids[])` — calls `multiDeselectSection`

### Checkbox component

- `SectionCheckbox` (in `UniversalTabSectionLabelRow.jsx`) — indeterminate-aware `<input type="checkbox">` using a `ref` to set `.indeterminate`
- `CardSectionCheckbox` (in `SelectableSummaryCardHeader.jsx`) — same pattern for card headers

## 5. Child Item Preservation Rule

Each child item in `sectionChildItems` includes:
- `id` — stable: `${idPrefix}:${i}` (matches `LearningTabContent` / `InsightList` bulkId formula)
- `text` — formatted display text via `formatBulkItemText`
- `sectionLabel` — section title
- `type` — tab key / content type
- `tabScope` — universal tab scope

## 6. Deduplication Rule

- `multiSelectSection` only adds items **not already in** `multiSelected` (checks `Map.has(id)`)
- `multiDeselectSection` only removes the specified ids
- The global "בחר הכל" button registers only **leaf row items** — not card-level blobs — preventing parent+child duplication
- `Summary` tab: `buildSummaryBriefingCardBulkItems` is still used for Obsidian merge but the section header checkbox now selects individual children instead of the card blob

## 7. Save Behavior

When items are selected via section checkbox:
- **Brain** — each child item is saved individually via `saveSingleItemToBrain`
- **Obsidian** — each child item is included in the merge via `toObsidianMergeItem`
- **Workspace** — each child item is saved as a separate `KnowledgeItem`

The section context (`sectionLabel`) is preserved on every child item for grouping.

## 8. Analyze with AI Behavior

The `handleOpenPerplexity` handler receives all `multiSelected.values()` — including items selected via section checkbox. Section context is included via `sectionLabel` field when building the analysis prompt.

## 9. Copy/Export Behavior

- **📋 העתק** — copies all selected items as markdown grouped by section
- **📊 ייצוא CSV** — downloads a `.csv` file with columns: Source, Tab, Section, Text, Ticker, Timestamp
  - BOM-encoded UTF-8 for correct Hebrew display in Excel
  - Ticker extracted from `TICKER ·` prefix if present

## 10. Excel Export Status

**No XLSX library is installed** (`xlsx`/`exceljs` not in `package.json`). CSV export is implemented as a compatible alternative. True XLSX requires adding a dependency — pending approval.

To add XLSX: `npm install xlsx` then replace `csvExport.js` with a SheetJS implementation.

## 11. QA Checklist

### Summary Tab
- [ ] Click section header checkbox on "סיכום ב-30 שניות" → all rows selected (checkboxes appear)
- [ ] Bottom toolbar shows count = N rows (not 1 card)
- [ ] Click again → all deselected
- [ ] Select 1 row manually → section header shows indeterminate
- [ ] Save to Brain → N items saved, not the card blob

### Insights Tab
- [ ] Section header checkbox selects all insight rows
- [ ] Indeterminate state shows when partial selection

### Useful Knowledge Tab
- [ ] Each section (rules, checklist, etc.) has a working section checkbox
- [ ] Multi-section: select section A → select section B → both groups selected together

### Specialized Tab
- [ ] Section header checkbox selects all child rows in that section
- [ ] No 1:2 duplication: each item appears once in selection count

### All Tabs
- [ ] Individual row checkboxes still work
- [ ] Global "בחר הכל" still works (selects all leaf items)
- [ ] "נקה בחירה" clears section-selected items
- [ ] Bottom toolbar appears on section select
- [ ] 📋 העתק copies correct items
- [ ] 📊 ייצוא CSV downloads file with correct rows
- [ ] 🧠 שמור למוח saves individual items
- [ ] Obsidian save includes section items
- [ ] Workspace save includes section items
- [ ] TradingView / Perplexity buttons still work
- [ ] RTL layout unchanged
- [ ] Finviz links still work

## 12. Build Verification

```
npm run build
```
Expected: exit 0, no TypeScript/JSX errors.

## 13. Staging Strategy

All changes are additive and backward-compatible:
- New props (`sectionChildItems`) default to `null` — existing behavior unchanged when not passed
- `onSectionSelect` / `onSectionDeselect` are optional on `bulkSelection` — components check for existence before calling
- CSV export button only appears when `onCsvExport` prop is provided

## 14. Commit Strategy

Suggested commit message:
```
feat: add section-level select all across universal tabs
```

Files changed:
- `src/hooks/useTabBulkSelection.js`
- `src/components/dashboard/VideoDetailPanel.jsx`
- `src/components/shared/UniversalTabSectionLabelRow.jsx`
- `src/components/shared/SelectableSummaryCardHeader.jsx`
- `src/components/dashboard/SummaryBriefingView.jsx`
- `src/components/dashboard/SpecializedContentRenderer.jsx`
- `src/components/dashboard/InsightsStructuredView.jsx`
- `src/components/shared/UniversalTabSelectionBar.jsx`
- `src/lib/csvExport.js` (new)
- `docs/UNIVERSAL_SECTION_SELECT_ALL_AND_EXPORT_RULE.md` (new)

## 15. Rollback Strategy

All changes are additive. To revert:
1. Remove `sectionChildItems` props from all call sites
2. Revert `UniversalTabSectionLabelRow.jsx` and `SelectableSummaryCardHeader.jsx` to previous versions
3. Remove `multiSelectSection` / `multiDeselectSection` from `useTabBulkSelection.js`
4. Remove `onSectionSelect` / `onSectionDeselect` from `bulkSelectionShare`
5. Remove `onCsvExport` from `UniversalTabSelectionBar` and `VideoDetailPanel`
6. Delete `src/lib/csvExport.js`
