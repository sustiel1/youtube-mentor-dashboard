# Opportunities & Risks Design Rule

## Source of Truth
The Macro / Specialized Content "Opportunities and Risks" section is the visual source of truth.

Any equivalent section in Morning Brief or future dashboards must follow the same layout and design language.

## Iron Rule
Always preserve a fixed 6-card structure:
- 3 Opportunity slots
- 3 Risk slots

Do not collapse the layout when data is missing.

## Missing Data Rule
If there is not enough content, render empty visible placeholder cards so the visual structure remains stable.

## Placeholder Color Rule
Empty placeholder cards must be color-coded by section:
- Opportunity placeholders → green-tinted
- Risk placeholders → red-tinted

Empty placeholders must:
- preserve the same size and spacing as real cards
- preserve border radius and layout structure
- look intentionally empty
- not appear as broken UI
- not be white

## UX Reason
- Stable review and QA
- Clear structure even when AI returns partial data
- Consistent experience across Macro and Morning Brief
- Better semantic clarity by color

## Engineering Rule
- Prefer one shared reusable component
- Avoid separate visual variants for equivalent sections
- Preserve real-card behavior (checkbox/save/AI research)
- Keep RTL and mobile support correct

## Acceptance Criteria
- Up to 3 opportunities and 3 risks are shown
- Missing content renders empty visible placeholders
- Opportunity empty cards are green-tinted
- Risk empty cards are red-tinted
- Empty cards are not white
- Layout remains stable
- Existing interactive behavior still works for real cards

---

## Implementation Reference

**Shared component:** `src/components/dashboard/MacroStyleInsightCards.jsx`
- `MacroStyleOpportunityCard` — real opportunity card
- `MacroStyleRiskCard` — real risk card
- `MacroStyleEmptyInsightCard` — placeholder card, accepts `variant="opportunity"` or `variant="risk"`
- `padInsightSlots(items, 3)` — pads array to 3 slots

**Morning Brief implementation:** `src/components/dashboard/MorningBriefPanels.jsx` → `OpportunitiesRisksDashboard`

**Placeholder Tailwind classes (implemented in `MacroStyleEmptyInsightCard`):**

| Variant | Background | Border |
|---|---|---|
| `opportunity` | `bg-emerald-50/50 dark:bg-emerald-950/20` | `border-emerald-200/70 dark:border-emerald-800/40` |
| `risk` | `bg-red-50/50 dark:bg-red-950/20` | `border-red-200/70 dark:border-red-800/40` |

Border is always `border-dashed`. Min height `min-h-[168px]`. Radius `rounded-xl`.
