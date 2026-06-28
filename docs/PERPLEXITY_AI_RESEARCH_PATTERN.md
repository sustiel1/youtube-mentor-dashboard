# Perplexity / AI Research Pattern

**Source of Truth:** This document + `SAVE_SYSTEM_ARCHITECTURE` + `DESIGN_SYSTEM_AND_UX_RULES` + `AI_DEVELOPMENT_GUIDE`  
**Visual Reference:** Macro Dedicated Content card — action button style  
**Status:** Design Pattern (pre-implementation)  
**Last Updated:** 2026-06-23

---

## 1. Purpose

The **AI Research action** is a reusable card-level action that enriches any content item with external AI-assisted research via Perplexity (or a compatible AI research tool).

It is an **additive action** — it does not replace save, copy, Brain, Obsidian, or Workspace actions. It appears alongside them wherever deeper contextual research would be useful.

---

## 2. Where It Should Appear

The AI Research action may appear in any card or item where external research adds value:

| Context | Example items |
|---|---|
| Morning Brief — Opportunities | Sector opportunity cards, macro opportunity summaries |
| Morning Brief — Risks | Market risk cards, geopolitical risk items |
| Macro Dashboard | Opportunity / risk / event cards |
| Stocks Mentioned | Individual stock cards with ticker |
| Market Catalyst Cards | Earnings, Fed decisions, macro data releases |
| Sector Cards | Sector performance cards |
| Specialized Content Cards | Any card surfaced through SpecializedContentRenderer |
| Any enrichable item | Any item where a research query can be meaningfully constructed |

**Rule:** If the card has a `title`, `ticker`, `sector`, `risk`, or `opportunity` field — it is a candidate for AI Research.

---

## 3. Visual Pattern

### Button specification

| Property | Value |
|---|---|
| Label | `"AI מחקר 🔍"` or `"AI Research 🔍"` |
| Shape | Small rounded button (`rounded`) |
| Size | Compact — `p-1 text-sm leading-none` (match `PxBtn` in `MacroGemDashboard.jsx`) |
| Color | Violet — `text-violet-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30` |
| Position | Card footer or action row, after existing actions |
| RTL | Required — icon on left in LTR layout becomes right in RTL |
| Icon | 🔍 or a search/research icon |

### Layout rules

- Must **not** crowd the card header.
- Must **not** shift or displace the Save / Copy / Brain / Obsidian / Workspace actions.
- Should be visually consistent with the Macro Dedicated Content card action button style.
- On mobile: ensure the action row does not overflow or collapse awkwardly.

### Example (visual concept)

```
┌─────────────────────────────────────────┐
│  📈 Fed rate decision — September 2026  │
│  Risk: high | Sector: Financials        │
│─────────────────────────────────────────│
│  [🧠]  [🔮]  [⭐]  [🔍]               │
└─────────────────────────────────────────┘
```
*Per-row actions per DESIGN_SYSTEM_AND_UX_RULES: 🧠 Brain · 🔮 Obsidian · ⭐ Workspace · 🔍 AI Research*

---

## 4. Behavior

Clicking the AI Research button should **prepare or open a research query** based on the card's available data fields.

### Input fields (priority order)

1. `ticker` — stock symbol if available
2. `title` — card headline / item name
3. `sector` — sector label
4. `catalyst` — event or catalyst text
5. `risk` — risk description
6. `opportunity` — opportunity description
7. `summary` — summary text
8. `source_video` — video context if available (title, channel, date)

### Query construction rule

Build the most specific query possible from available fields. Fall back to broader fields if specific ones are missing.

### Action modes (phased)

| Phase | Action | Status |
|---|---|---|
| Phase 1 (minimal) | Copy query to clipboard | Not yet implemented |
| Phase 2 | Open Perplexity in new tab with pre-filled query | **Already implemented** in `MacroGemDashboard.jsx` → `PxBtn` |
| Phase 3 | Save research result to Brain / Obsidian / Workspace | Future |

**Note:** `PxBtn` in `MacroGemDashboard.jsx` (line 149) is the reference implementation for Phase 2.  
Extending this pattern to other card types is the goal — not rebuilding it.  
Phase 1 (clipboard copy) remains the lowest-risk starting point for card types that don't yet have a URL builder.

---

## 5. Example Query Templates

### Stock / Ticker
```
Research {ticker}: recent news, catalysts, analyst sentiment, risks, technical setup, and upcoming events.
```

### Market Risk
```
Research this market risk: {risk_text}. Explain why it matters, which sectors are affected, related tickers, and near-term implications.
```

### Market Opportunity
```
Research this market opportunity: {opportunity_text}. Identify affected stocks, catalysts, probability, risks, and what to watch next.
```

### Sector
```
Research the {sector} sector: current momentum, key catalysts, top tickers, risks, and analyst outlook.
```

### Market Catalyst / Event
```
Research this market catalyst: {catalyst_text}. Explain its impact on markets, affected sectors, potential winners and losers, and timing.
```

### General (fallback)
```
Research: {title}. Provide context, market implications, relevant tickers, risks, and what to monitor.
```

---

## 6. Integration Rules

| Rule | Detail |
|---|---|
| Additive only | Do not remove or replace Save / Copy / Brain / Obsidian / Workspace actions |
| No Macro logic in Morning Brief | Each section remains architecturally separate |
| Preserve bulk selection | AI Research does not interfere with multi-select behavior |
| Preserve card data | Card state, labels, and fields must not be mutated |
| Use shared helpers | Prefer existing UI action components if available |
| Low-risk implementation | Minimal code surface; no new dependencies required |
| No external API calls at click time | Phase 1 only constructs and copies the query string |

---

## 7. Source of Truth / Visual Reference

| Resource | Role |
|---|---|
| This document | Pattern definition and integration rules |
| `SAVE_SYSTEM_ARCHITECTURE.md` | Action system architecture reference |
| `DESIGN_SYSTEM_AND_UX_RULES.md` | Visual consistency rules |
| `AI_DEVELOPMENT_GUIDE.md` | AI integration development guidelines |
| Macro Dedicated Content card | Visual reference — `PxBtn` component in `MacroGemDashboard.jsx:149` |

---

## 8. QA Checklist

Before merging any implementation of this pattern, verify:

- [ ] Button is visible in all expected card types
- [ ] RTL layout is correct — label reads right-to-left naturally
- [ ] Mobile layout is not broken by the additional action
- [ ] Existing Save / Copy / Brain / Obsidian / Workspace actions still work
- [ ] No unrelated cards have been changed
- [ ] `npm run build` passes with no errors
- [ ] Query construction produces meaningful text for each card type tested
- [ ] Clipboard copy works in browser (Phase 1)

---

## 9. Future Ideas (Optional Enhancements)

These are not in scope for initial implementation but are valid future directions:

| Idea | Notes |
|---|---|
| Open Perplexity in new tab | `window.open` with pre-built query URL |
| Copy research prompt | Phase 1 — clipboard only |
| Save research result to Brain | Requires Brain write flow |
| Save research result to Obsidian | Requires Obsidian write flow |
| Attach research result to Workspace | Requires Workspace item update |
| Research history per card | Store last query timestamp and result snippet |
| Batch research for multiple selected cards | Integrate with bulk selection system |

---

*Pattern defined: 2026-06-23 | Do not implement without reviewing SAVE_SYSTEM_ARCHITECTURE and DESIGN_SYSTEM_AND_UX_RULES first.*
