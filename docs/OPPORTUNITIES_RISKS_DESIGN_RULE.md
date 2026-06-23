# Opportunities & Risks Design Rule

**Status:** Enforced  
**Last Updated:** 2026-06-23  
**Applies to:** Every area in the app that renders an "Opportunities and Risks" section

---

## Iron Rule

Every place in the app that renders an "Opportunities and Risks" area **must** use the Macro-style card layout.

This is a strict design rule. No exceptions.

---

## Layout Requirements

| Requirement | Value |
|---|---|
| Opportunity slots | Always **3** |
| Risk slots | Always **3** |
| Empty slots | Rendered as visible placeholder cards |
| Section collapse on missing data | **Forbidden** |
| Minimum section height | Preserved regardless of data |

### Rules

- Always preserve a **6-card visual structure**: 3 opportunity slots + 3 risk slots.
- If extracted content has fewer than 3 items, **keep empty visible cards** in the remaining slots.
- **Do not collapse** the layout when data is missing.
- **Do not reduce** section height because data is missing.
- Use only the **first 3** opportunities and the **first 3** risks. Ignore extras.

---

## Rationale

- **Stable visual review** — reviewers scan the same layout every time, regardless of how much AI extracted.
- **Consistent QA** — testers always verify the same number of slots, not a variable count.
- **Same UX between Macro and Morning Brief** — both contexts present the same semantic section; they must look identical.
- **Avoid design divergence** — two different designs for the same semantic section creates confusion and maintenance debt.

---

## Implementation Rules

### Shared component

- **Prefer a shared component** over duplicate layouts.
- Morning Brief **must reuse** the same Macro-style renderer when possible.
- The shared components live in:
  - `src/components/dashboard/MacroStyleInsightCards.jsx`
  - Exports: `MacroStyleOpportunityCard`, `MacroStyleRiskCard`, `MacroStyleEmptyInsightCard`, `padInsightSlots`, `getMacroOppStyle`, `getMacroRiskStyle`

### Empty cards

- Empty cards must preserve: **border, border-radius, spacing, grid behavior**.
- Use `MacroStyleEmptyInsightCard` — do not render `null` or skip the slot.
- Empty cards use `data-empty-insight-slot` and `aria-hidden` for accessibility.

### Real cards

- Real opportunity cards: use `MacroStyleOpportunityCard`.
- Real risk cards: use `MacroStyleRiskCard`.
- All existing **checkbox**, **save**, and **AI Research** behaviors must be preserved.
- Pass `checkbox` and `saveActions` props to `MacroStyleInsightCardShell` via the card components.

### Grid

```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
  {paddedSlots.map((item, i) =>
    item
      ? <MacroStyleOpportunityCard key={...} ... />
      : <MacroStyleEmptyInsightCard key={...} variant="opportunity" slotIndex={i} />
  )}
</div>
```

### Padding helper

```js
// From MacroStyleInsightCards.jsx
const slots = padInsightSlots(items, INSIGHT_GRID_SLOT_COUNT); // pads to 3
```

### RTL

- `dir="rtl"` on all container divs.
- Mobile layout must remain clean — `grid-cols-1` on small screens.

---

## Acceptance Criteria

Before merging any implementation of Opportunities & Risks rendering, verify:

- [ ] Morning Brief "הזדמנויות וסיכונים" looks exactly like the Macro version
- [ ] Up to 3 opportunities and up to 3 risks are shown — no more, no less slots
- [ ] Missing data renders empty placeholder card slots (not collapsed, not null)
- [ ] Existing save / checkbox / AI Research actions still work on real cards
- [ ] Macro Dedicated Content remains visually unchanged
- [ ] `npm run build` passes with no errors
- [ ] RTL layout is correct
- [ ] Mobile layout is clean (single-column on small screens)

---

## Reference Implementation

**File:** `src/components/dashboard/MorningBriefPanels.jsx`  
**Function:** `OpportunitiesRisksDashboard` (~line 2184)

This function is the canonical Morning Brief implementation that satisfies all rules above.

**Shared cards:** `src/components/dashboard/MacroStyleInsightCards.jsx`

---

*Do not create a second visual design for Opportunities & Risks. Use the shared components.*
