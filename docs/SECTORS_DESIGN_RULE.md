# Sectors Design Rule

**Status:** Enforced  
**Last Updated:** 2026-06-23  
**Applies to:** Every area in the app that renders a Sectors section

---

## Iron Rule

Any place in the app that renders a Sectors section **must** use the Macro-style sector table.

This is a strict design rule. No exceptions.

---

## Required Columns

| Column | Description |
|---|---|
| **סקטור** | Sector name (bold) + optional "בדוק אחזקות" link below |
| **סנטימנט** | Sentiment dot + label on one line |
| **הערה / סיבה** | Full-width notes/reason text |

### Column rules

- Sentiment must always be in its own **dedicated column** — not embedded inside the sector name column.
- The colored dot and sentiment label must appear on **one line**.
- The sector name must be **bold**.
- "בדוק אחזקות" (Perplexity ETF holdings link) must appear **under the sector name** when the sector has a recognized ticker.
- Notes/reason must appear in the **wide notes column** — never truncated to one line unless explicitly intended.

---

## Shared Implementation

**File:** `src/components/dashboard/MarketSectorTable.jsx`  
**Export:** `MarketSectorTable`

This component is the single source of truth for all sectors table rendering. Both Macro Dedicated Content and Morning Brief use it.

### Supporting files

| File | Role |
|---|---|
| `src/components/dashboard/briefTableLayout.jsx` | Shared table CSS constants and `BriefTableWrapper` |
| `src/components/dashboard/BriefSentimentNotesTable.jsx` | `BriefSentimentCell` — dot + sentiment label |
| `src/utils/finvizLinks.js` | `resolveSectorFinvizLink`, `buildPerplexityEtfHoldingsUrl` |

---

## Usage Pattern

```jsx
<MarketSectorTable
  rows={sectorRows}
  getRowOptions={(row) => ({ sentKey: row.sentKey })}
  renderLeadingCell={(row, i, normalized) => (
    <CheckboxComponent text={normalized.rowText} ... />
  )}
  renderTrailingCell={(row, i, normalized) => (
    <SaveActionsComponent text={normalized.rowText} ... />
  )}
/>
```

### Row normalization

`normalizeSectorTableRow(item, options)` in `MarketSectorTable.jsx` accepts:

```js
// Normalized output shape
{
  sector: string,       // from: item.sector | item.name
  sentiment: string,    // from: item.direction | item.trend | item.performance | item.sentiment | sentKey
  note: string,         // from: item.relativeStrength | item.note | item.description | item.strength | item.reason
  rowText: string,      // concatenated for save/clipboard
}
```

**Supported legacy field names** (all backward-compatible):

| Field type | Accepted keys |
|---|---|
| Sector name | `sector`, `name` |
| Sentiment | `direction`, `trend`, `performance`, `sentiment`, or `sentKey` option |
| Notes | `relativeStrength`, `note`, `description`, `strength`, `reason`, `rationale`, `why`, `catalyst` |

---

## Do Not

- Do **not** create a separate visual design for Morning Brief sectors.
- Do **not** embed sentiment inside the sector name column.
- Do **not** render sentiment as plain text without a colored dot.
- Do **not** skip the "בדוק אחזקות" link — it is auto-resolved from the sector name.
- Do **not** fork `MarketSectorTable` — extend it via `renderLeadingCell` / `renderTrailingCell` props.

---

## Acceptance Criteria

Before merging any implementation of a Sectors section, verify:

- [ ] Morning Brief "סקטורים" looks exactly like Macro "סקטורים"
- [ ] Columns are: **סקטור** | **סנטימנט** | **הערה / סיבה**
- [ ] Sentiment is **not** inside the sector column
- [ ] Sentiment dot and text appear on the **same line**
- [ ] Sector name is **bold**
- [ ] "בדוק אחזקות" appears under the sector name when available
- [ ] Notes appear in the wide notes column
- [ ] Positive / neutral / negative sentiment colors work correctly
- [ ] Existing checkbox and save behavior still works
- [ ] Macro sectors remain visually unchanged
- [ ] RTL layout is correct
- [ ] Mobile layout is clean (horizontal scroll on narrow viewports)
- [ ] `npm run build` passes with no errors

---

## Sentiment Color Reference

| Sentiment key | Label | Dot color |
|---|---|---|
| `positive` | חיובי | `bg-emerald-500` |
| `neutral` | ניטרלי | `bg-amber-400` |
| `negative` | שלילי | `bg-red-500` |

Logic in `BriefSentimentCell` (`BriefSentimentNotesTable.jsx`): auto-detects from label keywords (bullish/חיובי → positive, bearish/שלילי → negative, else → neutral).

---

*Do not create a second sectors table design. Use `MarketSectorTable` for every sectors section in the app.*
