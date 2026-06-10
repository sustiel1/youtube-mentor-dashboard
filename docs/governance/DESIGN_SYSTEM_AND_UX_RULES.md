# DESIGN SYSTEM AND UX RULES

```
SOURCE OF TRUTH

Future development must follow this document.

If implementation and documentation differ,
report the contradiction before modifying code.
```

**Project:** YouTube Mentor Dashboard  
**Theme:** Hebrew RTL, dark theme  
**Platform:** Base44 + React + Tailwind CSS

---

## Core UX Principles

1. **Fast review, selective saving** — user scans content, saves only what matters.
2. **Consistent navigation** — same 7 tabs on every video.
3. **No silent saves** — every persistence action is explicit.
4. **Minimal clutter** — compact badges and accordions over large blocks.
5. **Hebrew-first** — all UI text in Hebrew; RTL throughout.

---

## RTL Layout

| Rule | Implementation |
|------|----------------|
| App root | `dir="rtl"` on `App.jsx` |
| Video modal | `dir="rtl"` on `VideoDetailPanel.jsx` |
| Bulk bars | `dir="rtl"` on `UniversalTabSelectionBar.jsx`, `BulkSelectionBar.jsx` |
| Morning Brief | `dir="rtl"` on `MorningBriefDashboard.jsx` |
| LTR exceptions | Paths, filenames, timestamps, vault paths use `dir="ltr"` |
| Forbidden | English labels in UI (e.g., "Markets" → must be `שוק ההון`) |

---

## Tab Sizing (7 Universal Tabs)

| Property | Value | File |
|----------|-------|------|
| Tab bar min height | `min-h-[52px]` | `VideoDetailPanel.jsx` |
| Tab trigger height | `h-11 min-h-[44px]` | `VideoDetailPanel.jsx` |
| Mobile behavior | Horizontal scroll | `VideoDetailPanel.jsx` |
| Large screens | `lg:flex-1` equal width | `VideoDetailPanel.jsx` |
| Tab content min height | `min-h-[320px]` | `VideoDetailPanel.jsx` |
| Quick actions grid | `grid-cols-7` above tabs | `VideoDetailPanel.jsx` |

### Tab Order (Fixed)

```
סיכום → פרקים → תובנות → ידע שימושי → APP → מיפוי ל-Obsidian → תוכן ייעודי
```

### Tab Change Behavior

- Bulk selection **clears** on tab change (`useTabBulkSelection.js`).
- Active tab state persists within modal session only.

---

## Bulk Action Placement

### Select-All Row

**Position:** Fixed below tab navigation bar.  
**Components:** `UniversalTabBulkToolbar.jsx`, `UniversalTabBulkHeader.jsx`

| Element | Label | Action |
|---------|-------|--------|
| Select all | בחר הכל | Select all items in active tab |
| Clear | נקה בחירה | Clear selection |
| Count | `נבחרו X פריטים` | Selection count |

### Dialog Footer Save Bar

**Position:** Sticky footer at bottom of `DialogContent`.  
**Component:** `UniversalTabSelectionBar.jsx`  
**Visibility:** When `tabBulkCount > 0`

**Button order (left to right in RTL):**

```
נקה → [count] → 🧠 Brain → 🔮 Obsidian → ⭐ Workspace
```

### Per-Row Quick Save

**Position:** Inline on each item row.  
**Component:** `UniversalTabQuickSaveActions.jsx`  
**Behavior:** Hover-reveal on desktop; always visible on mobile.

| Icon | Action |
|------|--------|
| 🧠 | Save to Brain |
| 🔮 | Save to Obsidian |
| ⭐ | Save to Workspace |

### Brain Highlight Bar

**Position:** Separate sticky bar above footer when brain-selection flow active.  
**Location:** `VideoDetailPanel.jsx` ~10490–10510

### Spec vs Runtime Note

`AI_DEVELOPMENT_GUIDE.md` §22 references `BulkSelectionBar.jsx` — this component exists but is **not wired**. Runtime uses `UniversalTabSelectionBar` + `UniversalTabBulkToolbar`. Follow runtime, not unused spec component.

---

## Save Action Placement

| Save Type | Entry Point | Confirmation |
|-----------|-------------|--------------|
| Per-row Brain | 🧠 inline button | None — immediate save |
| Per-row Obsidian | 🔮 inline button | `BrainDestinationPicker` modal |
| Per-row Workspace | ⭐ inline button | None — immediate save |
| Bulk (any destination) | Footer bar buttons | Obsidian → picker modal |
| Full video Brain | Toolbar "שמור למוח" | `BrainDestinationPicker` |
| Full video Obsidian | Obsidian Mapping tab save | Picker + merge/overwrite choice |
| Full video Workspace | `SaveToWorkspaceDialog` | Dialog with topic mapping |

### Saved-State Indicators (Per-Row)

| State | Brain | Obsidian | Workspace |
|-------|-------|----------|-----------|
| Unsaved | 🧠 (default) | 🔮 שמור ל-Obsidian (violet) | ⭐ (default) |
| Saved | ✓🧠 (emerald) | ✅ נשמר ל-Obsidian (emerald) | ✓⭐ (emerald) |
| Open saved | Click ✓🧠 → navigate | Click ✅ → open vault file | Click ✓⭐ → open item |

Resolver: `saveStatusResolver.js` — `resolveBrainSaveStatus`, `resolveWorkspaceSaveStatus`, `isObsidianItemSaved`.

---

## Card Styling

### Universal Tab Cards

```css
rounded-xl border border-slate-200 bg-slate-50/80
dark:border-zinc-800 dark:bg-zinc-900
```

**File:** `summaryCardStyles.js`, `UniversalTabSectionBlocks.jsx`

### Summary Lead (No Shell)

Right border accent, larger type — no card wrapper.  
**Class:** `SUMMARY_LEAD_CLASS` in `summaryCardStyles.js`

### Morning Brief Section Cards

```css
rounded-xl border-2
white/zinc surface
dashed empty states
```

**Component:** `SectionCard`, `EmptyState` in `MorningBriefVisualPrimitives.jsx`

### Political Cards

Colored borders by section type:
- Amber, violet, teal, indigo variants
- **Component:** `PCard` in `VideoDetailPanel.jsx` specialized political render

### Card Content Rules

- Prefer compact badges over large blocks
- No full-width buttons unless necessary
- Accordions for long content
- Empty states always visible (Morning Brief)

---

## Status Colors

### Market Direction

| Tone | Color | Keywords |
|------|-------|----------|
| Bullish | Emerald | עולה, פריצה, bullish, breakout |
| Bearish | Red | יורדת, דילול, bearish, dilution |
| Neutral | Slate | stable, neutral, ללא שינוי |

**File:** `morningBriefVisuals.js` — `TONE_STYLES`, `resolveTone()`

### Stock Status Text

| Status | Color | Dot |
|--------|-------|-----|
| Positive | `text-emerald-600` | 🟢 |
| Negative | `text-red-600` | 🔴 |
| Neutral | `text-slate-500` | ⚪ |

**File:** `stockStatusDisplay.js`

### Stock Category (Watchlist)

| Category | Color |
|----------|-------|
| opportunity | emerald |
| watchlist | sky |
| risk | red |
| general | slate |

**File:** `STOCK_CATEGORY_TEXT_CLS` in `MorningBriefPanels.jsx`

### Learning Status Badges

| Status | Color |
|--------|-------|
| Not started | gray |
| In progress | amber |
| Completed | emerald |
| Reviewed | purple |
| Bookmarked | blue |

**Component:** `LearningStatusBadge.jsx`

### Obsidian Confidence

| Range | Badge |
|-------|-------|
| ≥ 90% | 🟢 High Confidence |
| 70–89% | 🟡 Medium Confidence |
| < 70% | 🔴 Low Confidence |

Display only — no gating. Sources: `aiSubCategoryRec.confidence` or `gemRec.confidencePct`.

### Obsidian Mapping Status Badges

| State | Badge |
|-------|-------|
| AI suggested | AI Suggested |
| Applied | Applied |
| Manually edited | Manually Edited |

### Bulk Selection Theme

Indigo accent for selection UI.  
**Files:** `BulkSelectionBar.jsx`, `UniversalTabBulkHeader.jsx`

---

## Watchlist Presentation

### Label

Always **רשימת מעקב** — not "מניות מוזכרות" in morning brief context.

### Item Format

Multi-line via `formatWatchlistItem()`:

```
{symbol}
{reason}
{importance} | {catalyst}
{level}
```

### Visual Elements

| Element | Component |
|---------|-----------|
| Direction text | `DirectionText` |
| Move percent | `StockMovePercentIndicator` |
| Arrows | ▲/▼ colored |
| Hidden labels | `isStockMentionHiddenLabel()` hides redundant "מעקב"/"watchlist" |

### Dedup

`extractUnifiedStocks()` merges `stocksMentioned`, `watchlist`, `tickers`, `watchlistLevels`.

---

## Stock Status Visualization

### Rules

1. **Presentation layer only** — does not mutate GEM schema.
2. Keyword detection in Hebrew and English.
3. Object rows: `{symbol, status/direction/sentiment}` via `isStockStatusObject()`.

### Components

| Component | Purpose |
|-----------|---------|
| `DirectionChip` | Inline direction label |
| `DirectionBadge` | Badge variant (used in markets table) |
| `ChangeValue` | Colored numeric change |
| `ImportanceBadge` | H/M/L importance |

**File:** `MorningBriefVisualPrimitives.jsx`

### Pending UX (Not Yet Implemented)

- Green/Red directional indicators (extend beyond tone)
- Up/Down arrows on all change values
- H/M/L badges on stocks/opportunities (calendar has importance)
- Confidence on Morning Brief sections

---

## Obsidian Indicators

| Indicator | Meaning | Component |
|-----------|---------|-----------|
| 🔮 | Save to Obsidian action | `UniversalTabQuickSaveActions.jsx` |
| ✅ נשמר ל-Obsidian | Item saved to vault | Same |
| `ObsidianIcon` | Official crystal SVG | `ObsidianIcon.jsx` |
| Path preview | `שוק ההון/מבזק בוקר/V-{slug}.md` | `ObsidianMappingTab.jsx` |
| Saved-on-card | Lists `brainSaves[]`, legacy paths | `ObsidianSavedOnCard.jsx` |
| Vault display name | Default `"Knowledge-Base"` | `BrainDestinationPicker.jsx` |

### Obsidian Mapping Tab UI

| Element | Behavior |
|---------|----------|
| 🤖 Apply AI Recommendations | Merge into local draft |
| ↩ Undo Last Apply | Snapshot restore |
| 📁 Obsidian Path | Live preview via `buildPathSegments()` |
| Footer note | "Draft only — save via existing flows" |

---

## Brain Indicators

| Indicator | Meaning |
|-----------|---------|
| 🧠 | Save to Brain |
| ✓🧠 | Saved — click to open |
| SubBrain picker | `BrainDestinationPicker` suggests folders from `brainStructure.js` |
| Brain highlight bar | Active when brain-selection mode on |

### Brain Folder Hierarchy

15 SubBrains under `שוק ההון` — see `brainStructure.js`.  
Picker shows suggestions; user can override path.

---

## Workspace Indicators

| Indicator | Meaning |
|-----------|---------|
| ⭐ | Save to Workspace |
| ✓⭐ | Saved snippet |
| Workspace Library | Full video saved via `SaveToWorkspaceDialog` |
| Path hint | `Workspace/קטעים/{videoTitle}/{section}.md` |

### Two Workspace Paths

1. **Snippets** — per-row/bulk → `localKnowledgeItemStore` (same store as Brain!)
2. **Full video** — `workspace_library_v1` via dialog

---

## Modal & Dropdown Rules

| Rule | Implementation |
|------|----------------|
| Video modal does NOT close on outside click | `onPointerDownOutside={e => e.preventDefault()}` |
| Video modal does NOT close on ESC | Same pattern |
| Only X button closes modal | Explicit close handler |
| Dropdown z-index | ≥ 9999 |
| Dropdown scrollable | Required for long lists |
| Stop propagation | `e.nativeEvent.stopImmediatePropagation()` on dropdown buttons |

**Source:** `AI_DEVELOPMENT_GUIDE.md` §8

---

## Typography & Spacing

| Rule | Detail |
|------|--------|
| Prefer compact | Badges over paragraphs where possible |
| Section headers | Emoji + Hebrew label (e.g., 📰 חדשות) |
| Empty states | Dashed border, muted text, always visible |
| Tables | `MorningBriefMarketsTable` — responsive, ▲/▼ in cells |

---

## Dark Theme

- Tailwind `dark:` variants throughout
- Cards: `dark:border-zinc-800 dark:bg-zinc-900`
- Bulk bar: dark sticky footer variant in `UniversalTabSelectionBar`

---

## Accessibility Notes

| Item | Status |
|------|--------|
| Min touch target | 44px (`min-h-[44px]` on tab triggers) |
| Color not sole indicator | Direction uses text + color + arrows |
| RTL screen readers | `dir="rtl"` set at container level |

---

## Component Reference Index

| Concern | File |
|---------|------|
| Tab bar | `VideoDetailPanel.jsx` |
| Bulk toolbar | `UniversalTabBulkToolbar.jsx` |
| Bulk footer | `UniversalTabSelectionBar.jsx` |
| Per-row save | `UniversalTabQuickSaveActions.jsx` |
| Card styles | `summaryCardStyles.js` |
| Morning Brief visuals | `MorningBriefVisualPrimitives.jsx` |
| Market tone | `morningBriefVisuals.js` |
| Stock status | `stockStatusDisplay.js` |
| Save status | `saveStatusResolver.js` |
| Obsidian icon | `ObsidianIcon.jsx` |
| Destination picker | `BrainDestinationPicker.jsx` |
| Learning badge | `LearningStatusBadge.jsx` |

---

## QA Checklist for UX Changes

Every UI change must verify:

- [ ] RTL layout intact
- [ ] Hebrew labels only (no English leaks)
- [ ] Tab bar sizing unchanged
- [ ] Bulk selection clears on tab change
- [ ] Save indicators update after save
- [ ] Modal does not close accidentally
- [ ] Dark theme variants present
- [ ] Empty states still visible (Morning Brief)
- [ ] Mobile horizontal scroll on tabs

---

*For architectural rationale see `PROJECT_DECISIONS_HISTORY.md`. For save flow details see `SAVE_SYSTEM_ARCHITECTURE.md`.*
