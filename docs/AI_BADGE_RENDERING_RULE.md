# AI Badge Rendering Rule — Morning Brief

## Purpose

Morning Brief / Hebrew Content section headers may show a small source badge (`🤖 AI` or `✏️ Manual`) next to the **ערוך** control. This document defines the single allowed rendering path.

## Single component

All AI / Manual source badges **must** be rendered through:

- `src/components/dashboard/AiSourceBadge.jsx`

Do **not** hardcode `🤖 AI`, `AI`, or duplicate badge markup inside individual Morning Brief section components.

## Rendering path (current)

```
SectionCard.headerActions
  ← useMorningBriefSectionEdit() in MorningBriefPanels.jsx
    ← BriefSectionManualHeaderExtras in BriefSectionManualEdit.jsx
      ← ManualSourceBadge (thin wrapper)
        ← AiSourceBadge
```

Sections that show the badge (when manual edit is enabled):

- חדשות
- מצב שוק
- שווקים
- סקטורים
- הזדמנויות וסיכונים
- מניות שהוזכרו
- לוח כלכלי
- מאקרו

Sections without manual edit (e.g. סנטימנט) do **not** show the badge.

## Global visibility toggle

To hide AI/Manual badges across **all** Morning Brief sections:

```js
// morningBriefPresentation.js — specialized profile (תוכן ייעודי)
export const MORNING_BRIEF_SPECIALIZED_PRESENTATION = {
  showAiBadge: false,
  // ...
};
```

Morning Brief Specialized passes this profile via `MorningBriefDashboard` `presentation` prop.

Legacy global flag (non-specialized surfaces only):

```js
// AiSourceBadge.jsx
export const MORNING_BRIEF_SHOW_AI_SOURCE_BADGE = true;
```

Per-section override:

```jsx
useMorningBriefSectionEdit(sectionId, { ..., presentation: { showAiBadge: false } })
```

## Visual rules

- Size: `text-[10px]`, `font-semibold`, compact padding
- AI variant: slate background, `🤖` + `AI`
- Manual variant: amber background, `✏️` + `Manual`
- RTL: badge sits in header actions row, before **ערוך**
- Tooltip: `title` on badge (`AiSourceBadge` default titles)

## Future pages

Reuse `AiSourceBadge` for any new section that needs AI vs Manual source indication. Do not create parallel badge styles.

## Audit notes (2026-06)

- No hardcoded `🤖 AI` strings remain in Morning Brief section components.
- Badge logic was previously inlined in `ManualSourceBadge`; now centralized in `AiSourceBadge.jsx`.
- `SentimentSection` has no edit header — no AI badge (by design).
