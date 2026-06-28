# Section Header Count Rule

## Source of Truth

The Macro / Specialized Content section header layout is the visual source of truth.

Morning Brief and future dashboards must follow the same section-header count pattern.

## Rule

Every extracted-data section should show a small item count next to the section title.

Examples:

- חדשות 📰 3
- מצב שוק 📊 3
- שווקים 📈 6
- סקטורים 🏭 4
- מניות שהוזכרו ⭐ 9

## Placement

The count must appear near the section title in the title area.

The count must not appear next to:

- Edit button
- AI badge
- left-side section controls

```
[כותרת + אייקון] [מספר קטן]                    [עריכה / בקרות]
        ↑ ימין (ליד הכותרת)                              ↑ שמאל
```

## Meaning

The count represents real extracted items from the video.

It must not count:

- empty placeholders
- visual slots
- skeleton cards
- layout-only boxes

## Opportunities and Risks

For Opportunities and Risks:

- count real opportunities + real risks
- do not count empty placeholder cards
- preserve the 6-card visual layout separately

Use `countOpportunitiesAndRisks(opportunities, risks)` — not padded grid slot length.

## Engineering Rule

Prefer the shared `SectionHeaderTitle` component (or `SectionCard` with a `count` prop).

Do not hardcode counts inside individual section layouts when a shared header can be used.

### Components

| Piece | Location |
|-------|----------|
| `SectionHeaderTitle` | `MorningBriefVisualPrimitives.jsx` — title + count row |
| `SectionCard` | Same file — wraps header + content; passes `count` to `SectionHeaderTitle` |
| `morningBriefSectionCount` | `morningBriefPresentation.js` — gates counts per presentation profile |

### Typography

`SECTION_HEADER_COUNT_CLS`:

- `text-sm font-semibold tabular-nums text-slate-500 dark:text-zinc-400`
- Secondary to the title; title remains visually dominant.

### Morning Brief presentation

Specialized Morning Brief (`MORNING_BRIEF_SPECIALIZED_PRESENTATION`):

- `showSectionCounts: true` — title counts on
- `showSummaryCounters: false` — colored pills under title off

Colored summary pills (חיובי / שלילי / ניטרלי) are **not** the same as the title count badge.

## Section count sources

| Section | Count source |
|---------|----------------|
| חדשות | `strings.length` |
| מצב שוק | `cards.length` |
| שווקים | `getMorningBriefMarketRows(...).length` |
| סקטורים | `rows.length` |
| הזדמנויות וסיכונים | `countOpportunitiesAndRisks(ideas, risks)` |
| מניות שהוזכרו | `stocks.length` |
| מאקרו / סנטימנט / לוח כלכלי | Respective extracted item arrays |

## Acceptance Criteria

- Count appears next to the section title
- Count is small and subtle
- Count reflects real extracted items
- Count is not duplicated near controls
- Count is not shown next to edit / AI / save controls
- RTL layout remains correct

## QA checklist

1. Open Morning Brief → Specialized.
2. Verify small counts appear beside: חדשות, מצב שוק, שווקים, סקטורים, הזדמנויות וסיכונים, מניות שהוזכרו, מאקרו, סנטימנט, לוח כלכלי.
3. Confirm counts are not beside edit or AI controls.
4. Confirm Opportunities/Risks total excludes empty grid slots.
5. Confirm Macro sections still show counts unchanged.
