# MARKET_DASHBOARD_UI_GUIDE.md
> Blueprint for the Market Intelligence Dashboard — Macro Specialized Tab
> Based on audit of `MacroGemDashboard.jsx` + `MorningBriefVisualPrimitives.jsx` + screenshots
> Language: Hebrew UI, English code

---

## 1. Information Architecture

### 1.1 Main Sections (in render order)

| # | Section | Component | Type | Role |
|---|---|---|---|---|
| 0 | תמונת מצב מהירה | `ExecutiveSnapshot` | Quick-glance panel | First thing seen — 3 status cards + KPI strip |
| 1 | 🌍 אירועי מאקרו | `MacroEventCardsSection` | Card list | What happened? |
| 2 | 🌐 תמונת מאקרו | `MacroOverviewCard` | Executive card | What does it mean? |
| 3 | ⭐ היילייטים | `MacroHighlightsSection` | Sentiment cards | Key takeaways |
| 4 | 💡 הזדמנויות | `MacroOpportunityCardsSection` | Grid cards | What to buy/enter |
| 5 | ⚠️ סיכונים | `MacroRiskCardsSection` | Grid cards | What to watch / avoid |
| 6 | 🔔 אזהרות | `MacroWarningsSection` | Action rows | Follow-up actions |
| 7 | 🏭 סקטורים | `MacroSectorsSection` | Table | Sector rotation signals |
| 8 | 🎯 מניות | `MacroStocksSection` | Table | Stocks mentioned |
| 9 | 📈 מדדים | `MacroIndicesSection` | Table | Index performance |
| 10 | 🏦 מדיניות הפד | `MacroObjectSection` | Key-value table | Fed policy details |
| 11 | 📊 משתני מאקרו | `MacroObjectSection` | Key-value table | Macro variables |

### 1.2 Section Hierarchy

```
Executive Snapshot (always visible — pinned to top)
│
├─ EVENTS LAYER (what happened)
│   └── Macro Events
│
├─ ANALYSIS LAYER (what it means)
│   ├── Macro Overview
│   └── Highlights
│
├─ DECISION LAYER (what to do)
│   ├── Opportunities
│   ├── Risks
│   └── Warnings / Actions
│
├─ DATA LAYER (raw supporting data)
│   ├── Sectors
│   ├── Stocks
│   └── Indices
│
└─ DEEP DATA LAYER (supplementary reference)
    ├── Fed Policy
    └── Macro Variables
```

### 1.3 Visual Grouping

Sections are grouped in `space-y-3` with a consistent `SectionCard` wrapper.
The `SectionCard` uses `rounded-xl border-2` for clear visual separation between sections.
The `ExecutiveSnapshot` is deliberately different (no `SectionCard`) — it's a flat embedded panel.

### 1.4 Content Prioritization

**Why this order works:**

1. **Executive Snapshot first** — investor can assess market state in under 5 seconds without scrolling
2. **Events → Analysis → Decision** — follows natural analyst thought process
3. **Opportunities before Risks** — psychological framing (actionable positive first)
4. **Tables at the bottom** — raw data for those who want depth, not for scanning

**Current weakness:** The `ExecutiveSnapshot` and `MacroOverviewCard` partially duplicate the same data (macroMood, riskOnRiskOff). This creates cognitive redundancy for the user.

### 1.5 User Scanning Flow (RTL)

```
Eyes start: TOP-RIGHT (section title)
     ↓
Badge / status pill (right side of row)
     ↓
Main text / description (center)
     ↓
Date or secondary badge (left side)
     ↓
Action buttons appear on hover (far left)
```

### 1.6 Reading Order Principles

- Section titles: top-right (RTL)
- Content: flows right → left
- Checkboxes: far right (first interaction point)
- Save/Research actions: far left (last, revealed on hover)
- Badges and status: near the title, on the right

---

## 2. Card Taxonomy

### 2.1 Executive Snapshot Card (`StatusCard`)

**Purpose:** Top-level 3-column summary of market state, top risk, and top opportunity. Entry point for the entire dashboard. Not scrollable.

**Data structure:**
```js
{
  accent: 'green' | 'red' | 'amber',
  icon: string (emoji),
  category: string,    // e.g. "מצב שוק"
  title: string,       // primary value
  subLine: string,     // secondary context
  bodyText: string,    // description (line-clamp-3)
  badge: string,       // bottom status badge
  ctaLabel: string,    // optional action button label
  ctaHref: string,     // optional action URL
}
```

**Required fields:** `accent`, `category`, `title`
**Optional fields:** `subLine`, `bodyText`, `badge`, `ctaLabel`, `ctaHref`
**Priority levels:** Always shown. Empty state has ghost text.

---

### 2.2 Macro Event Card (`MacroEventCardsSection`)

**Purpose:** Documents specific macro events (FOMC, news, geopolitics) with date, category, importance, and description.

**Data structure:**
```js
{
  title: string,        // event name
  date: string,         // event date
  description: string,  // body text
  impact: string,       // market impact explanation
  category: string,     // e.g. "בינונית", "גבוהה"
  importance: string,   // severity level
  sectors: string[],    // affected sectors
}
```

**Required fields:** `title`
**Optional fields:** `date`, `description`, `impact`, `category`, `importance`, `sectors`
**Priority levels:** Displayed in order provided by AI. No internal ranking logic yet.

**Visual pattern:** Large card with icon box (top-left in RTL), title+badge row, date chip, body text indented under icon, sector pills, action bar.

---

### 2.3 Macro Overview Card (`MacroOverviewCard`)

**Purpose:** Executive briefing of the macro picture. 5 structured rows: status pills, market story, key conclusion, winners/losers grid, investor actions.

**Data structure:**
```js
{
  macroMood: string,          // e.g. "ניטרלי", "Bullish"
  riskOnRiskOff: string,      // e.g. "Risk-On", "Risk-Off"
  mainTheme: string,          // market story
  mainConclusion: string,     // key conclusion
  marketImplication: string,  // market impact (fallback if no winners/losers)
  winners: string[],          // beneficiaries
  losers: string[],           // under pressure
  actions: string[],          // investor action points
}
```

**Required fields:** At least one field present
**Optional fields:** All fields optional but `mainTheme` and `mainConclusion` are most valuable
**Priority levels:** Derived `riskLabel` from combined mood + risk tones (low/medium/high)

---

### 2.4 Highlight Card (`MacroHighlightsSection`)

**Purpose:** Key takeaways with strong sentiment color coding. Each card represents one analyst insight with positive/negative/neutral framing.

**Data structure:**
```js
{
  title: string,            // headline
  description: string,      // explanation
  impact: string,           // market impact
  sentiment: string,        // "חיובי" | "שלילי" | "ניטרלי"
}
```

**Required fields:** `title`
**Optional fields:** `description`, `impact`, `sentiment`
**Priority levels:** Green (bullish) / Red (bearish) / Amber (neutral) — detected from `sentiment` field

---

### 2.5 Opportunity Card (`MacroOpportunityCardsSection`)

**Purpose:** Actionable trade/investment opportunities. Each card represents one investable idea with type, assets, and optional Finviz link.

**Data structure:**
```js
{
  title: string,        // opportunity name
  type: string,         // e.g. "Swing Trading", "Long-Term"
  assets: string,       // ticker or sector name
  description: string,  // explanation
  details: string,      // additional context
  sectors: string[],    // related sectors
}
```

**Required fields:** `title`
**Optional fields:** `type`, `assets`, `description`, `details`, `sectors`
**Priority levels:** Color is always green (opportunities are inherently positive)

---

### 2.6 Risk Card (`MacroRiskCardsSection`)

**Purpose:** Actionable risk scenarios. Each card represents one risk with severity level and potential impact.

**Data structure:**
```js
{
  title: string,        // risk name
  severity: string,     // "גבוהה" | "בינונית" | "נמוכה"
  description: string,  // explanation
  impact: string,       // market impact
  assets: string,       // affected tickers / sectors
}
```

**Required fields:** `title`
**Optional fields:** `severity`, `description`, `impact`, `assets`
**Priority levels:** Red (high) / Amber (medium) — derived from `severity`

---

### 2.7 Warning / Action Row (`MacroWarningsSection`)

**Purpose:** Follow-up action items and monitoring alerts. More operational than risks — these are "do this" or "watch this" items.

**Data structure:**
```js
{
  text: string,         // action description
  type: string,         // "warning" | "action" | "info"
  priority: string,     // "high" | "medium" | "low"
  category: string,     // "sectors" | "general"
  date: string,         // when to act / by when
}
```

**Required fields:** `text`
**Optional fields:** `type`, `priority`, `category`, `date`
**Priority levels:** חשוב (red) / מעקב (amber) / מידע (blue) / סקטורים (violet) / פעולה (green)

---

### 2.8 AI Insight / KPI Card (`KpiCard`)

**Purpose:** Single numeric or text value for economic indicators. Used in the KPI strip within `ExecutiveSnapshot`.

**Data structure:**
```js
{
  label: string,   // e.g. "🏦 ריבית"
  value: string,   // e.g. "4.25%"
  accent: string,  // color variant
  compact: bool,
  href: string,    // optional Finviz link
}
```

---

## 3. Visual Design System

### 3.1 Card Styles

| Style | Usage | CSS Pattern |
|---|---|---|
| `SectionCard` | All named sections | `rounded-xl border-2 bg-white px-3 py-3` |
| `StatusCard` | Executive snapshot cards | `rounded-xl border bg-gradient-to-br p-5 min-h-[11rem]` |
| Highlight Card | ⭐ Highlights | `rounded-2xl border shadow-sm hover:shadow-lg overflow-hidden` |
| Opportunity/Risk Grid | 💡⚠️ | `rounded-xl border p-4` with `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| Warning Row | 🔔 | `rounded-xl border px-4 py-3 shadow-sm hover:shadow-md` |
| KPI Card | Economic strip | `rounded-lg border px-3 py-2 h-full` |
| Info Block | Macro overview rows | `rounded-xl bg-slate-50 border px-4 py-3.5` |
| Tag Block | Winners / Losers | `rounded-xl border px-4 py-3` |
| Action Block | Investor actions | `rounded-xl bg-indigo-50 border-indigo-100 px-4 py-3.5` |

### 3.2 Border Usage

- **`border-2`**: Section-level containers (`SectionCard`) — strong visual anchor
- **`border`**: Card-level elements (StatusCard, KPI, InfoBlock) — lighter separation
- **`border-r-2` or `border-r-[3px]`**: Accent left-edge bar (RTL right-edge) for Highlights cards — sentiment signal
- **`border-b`**: Section header separator inside `SectionCard`
- **`border-b border-slate-100`**: Table row separator

### 3.3 Background Colors

| Surface | Light | Dark |
|---|---|---|
| Page / section | `bg-white` | `dark:bg-zinc-900` |
| Hover row | `hover:bg-slate-50/50` | `dark:hover:bg-zinc-800/25` |
| Info Block | `bg-slate-50` | `dark:bg-zinc-800/40` |
| Table head | `bg-white` | `dark:bg-zinc-900` |
| Green card | `from-emerald-50/90 via-green-50/60 to-white` | gradient to zinc-900 |
| Red card | `from-red-50/90 via-rose-50/60 to-white` | gradient to zinc-900 |
| Amber card | `from-amber-50/90 via-yellow-50/60 to-white` | gradient to zinc-900 |
| Action block | `bg-indigo-50` | `dark:bg-indigo-900/20` |

**Rule:** All pastel backgrounds use gradient `from-COLOR-50 to-white` for a modern soft look. Dark mode uses `/20`–`/30` opacity overlays on zinc-900.

### 3.4 Header Structure (inside SectionCard)

```
[Section icon + title (right)]     [count badge (center-right)]  [action buttons (left)]
─────────────────────────────────────────────────────────────────
[optional header pills row]
─────────────────────────────────────────────────────────────────
[section content]
```

- Title: `text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight`
- Count: `text-base font-bold tabular-nums` in tone color
- Separator: `border-b border-slate-200/80`

### 3.5 Badge Placement Rules (RTL)

| Badge type | Position | DOM position |
|---|---|---|
| Sentiment badge (Highlights) | Right of title row | First child in flex row |
| Category badge (Events) | Right of title, same line | Inline after title |
| Date chip | Left side of card header | DOM last before checkbox |
| Status badge (Warnings) | Right side of row | After text content |
| Importance badge | Right, inline with title | Next to title text |

**RTL Rule:** In `dir="rtl"` flex containers, **first DOM child = visual right**. Position elements in DOM reverse of their visual left-to-right position.

### 3.6 Icon Placement

| Context | Size | Placement |
|---|---|---|
| Executive snapshot | `text-xl`, `w-11 h-11` rounded box | Visual left (DOM right since RTL) |
| Highlight card | `text-[28px]`, `w-14 h-14 rounded-2xl` | Visual left |
| Event card | `text-2xl`, `w-12 h-12 rounded-xl` | Visual left |
| Info block header | `text-lg` emoji | Inline before label |
| Section title | Emoji prefix | Part of string |
| Warning row | `text-lg`, `w-9 h-9 rounded-xl` | Visual left |

### 3.7 RTL Rules

1. **Always set `dir="rtl"` on the outermost container** of each section
2. **Flex row DOM order** (visual right to left): `[checkbox] [content] [icon-box] [action-buttons]`
3. **Absolute positioned accent bar**: use `right-0` for the vertical sentiment stripe in RTL
4. **Text alignment**: `text-right` on all Hebrew content
5. **Tables**: `dir="rtl"` on `<table>`, columns defined right-to-left
6. **Indentation offset**: `mr-[72px]` (not `ml-`) for content indented under an icon
7. **LTR exceptions**: Ticker symbols, percentages, URLs use `dir="ltr"` inline

### 3.8 Typography Hierarchy

| Role | Class | Size | Weight | Color |
|---|---|---|---|---|
| Section title | `SECTION_HEADER_TITLE_CLS` | `text-xl sm:text-2xl` | `font-extrabold` | `text-slate-900` |
| Card title (primary) | `DASHBOARD_TABLE_CELL_PRIMARY_CLS` | `text-[15px]` | `font-bold` | `text-slate-900` |
| Body text | `DASHBOARD_TABLE_CELL_BODY_CLS` | `text-[15px]` | `font-semibold` | `text-slate-900` |
| Table header | `DASHBOARD_TABLE_HEAD_CLS` | `text-base` | `font-bold` | `text-slate-800` |
| Muted / secondary | `DASHBOARD_TABLE_CELL_MUTED_CLS` | `text-sm` | `font-semibold` | `text-slate-600` |
| Date / numeric | `DASHBOARD_TABLE_CELL_DATE_CLS` | `text-[15px]` | `font-semibold` | `text-slate-700` |
| Status / change | `DASHBOARD_TABLE_STATUS_CLS` | `text-base` | `font-bold` | tone-colored |
| KPI label | inline | `text-[10px]` | `font-semibold uppercase tracking-wide` | accent-colored |
| Category tag | inline | `text-xs` | `font-medium` | muted |
| Badge label | inline | `text-[13px]` | `font-semibold` | tone-colored |

**Line height rule:** Use `leading-relaxed` (1.625) for body paragraphs. Use `leading-snug` for single-line labels and badges.

### 3.9 Spacing System

| Token | Value | Usage |
|---|---|---|
| Section gap | `space-y-3` | Between all dashboard sections |
| Card padding | `p-4` or `p-5` | Card inner padding |
| Section card padding | `px-3 py-3` | SectionCard wrapper |
| Row padding | `py-2.5 px-3` | Table rows |
| Badge padding | `px-2.5 py-1` or `px-2 py-0.5` | Status chips |
| Icon-to-text offset | `mr-[72px]` | Body text indented under icon |
| Grid gap | `gap-3` | Opportunity / Risk grids |
| KPI gap | `gap-2` | KPI strip |

### 3.10 Grid System

| Section | Mobile | Tablet | Desktop |
|---|---|---|---|
| Executive Snapshot (cards) | `grid-cols-1` | `sm:grid-cols-3` | 3 equal columns |
| KPI strip | `grid-cols-2` | `sm:grid-cols-3` | `lg:grid-cols-5` |
| Opportunities | `grid-cols-1` | `sm:grid-cols-2` | `lg:grid-cols-3` |
| Risks | `grid-cols-1` | `sm:grid-cols-2` | `lg:grid-cols-3` |
| Winners / Losers | `grid-cols-2` | `grid-cols-2` | `grid-cols-2` |

---

## 4. Badge & Status System

### 4.1 Sentiment Badges

| Sentiment | Hebrew | Color | CSS |
|---|---|---|---|
| Bullish / Positive | **חיובי** | Emerald | `bg-emerald-100 text-emerald-700 border border-emerald-400/60` |
| Bearish / Negative | **שלילי** | Red | `bg-red-100 text-red-700 border border-red-400/60` |
| Neutral / Mixed | **ניטרלי** | Amber | `bg-amber-100 text-amber-700 border border-amber-400/60` |

**Detection logic:** String includes `bullish/חיובי/positive/buy/long` → green. Includes `bearish/שלילי/negative/sell/short` → red. Otherwise → amber.

### 4.2 Risk Severity Badges

| Severity | Hebrew | Color |
|---|---|---|
| Critical / High | **חומרה גבוהה** | Red |
| Medium | **חומרה בינונית** | Amber |
| Low | **חומרה נמוכה** | Green |

### 4.3 Warning Category Badges

| Category | Hebrew | Icon | Color |
|---|---|---|---|
| High priority | **חשוב** | ❗ | Red |
| Monitor | **מעקב** | ⏳ | Amber |
| Information | **מידע** | ℹ️ | Blue |
| Sector focus | **סקטורים** | 📊 | Violet |
| Action required | **פעולה** | ✅ | Emerald |

### 4.4 Market State Badges

| State | Display string | Color |
|---|---|---|
| Risk-On | **🟢 אופטימיות בשוק** | Green |
| Risk-Off | **🔴 חשש בשוק** | Red |
| Neutral | **🟡 ניטרלי** | Amber |

### 4.5 Risk Level (Derived)

| Derived | Hebrew | Logic |
|---|---|---|
| Low risk | **סיכון נמוך** | Both mood and risk-on/off are green |
| Medium risk | **סיכון בינוני** | Mixed signals |
| High risk | **סיכון גבוה** | Either mood or risk-on/off is red |

### 4.6 Naming Conventions

- Hebrew badge labels always use **noun form**, not adjective: `חשוב` not `חשובה`, `מעקב` not `למעקב`
- Importance levels: `גבוהה` / `בינונית` / `נמוכה` (feminine to match `חומרה`)
- Market sentiment: `חיובי` / `שלילי` / `ניטרלי` (masculine neutral)
- Categories: nouns only — `סקטורים`, `פעולה`, `מידע`, `מעקב`, `חשוב`

### 4.7 Badge Positioning Rules

| Rule | Reason |
|---|---|
| Sentiment badge: top-right of card | First thing read in RTL, establishes tone immediately |
| Category label: above title | Acts as subtitle / context tag |
| Importance badge: inline with title | Immediately communicates priority |
| Status badge: bottom of card | Conclusion after reading |
| Date: left side of header | Non-critical metadata, scanned last |

---

## 5. Component Inventory

### 5.1 Layout / Structure Components

#### `SectionCard`
- **Responsibility:** Wraps all named sections. Provides consistent header, border, padding, and empty-state handling.
- **Props:** `title`, `count`, `tone`, `children`, `isEmpty`, `emptyMessage`, `headerPills`, `headerActions`, `plainSurface`, `cardBulk`
- **States:** Normal / Empty
- **Variants:** Standard (white bg) / plainSurface (transparent)

#### `TabBulkItemsRegistrar`
- **Responsibility:** Registers all selectable items in the tab for select-all functionality.
- **Props:** `tab`, `items`
- **States:** Active / Inactive

---

### 5.2 Display Components

#### `StatusCard`
- **Responsibility:** Executive snapshot card. One of three top-level market state cards.
- **Props:** `accent`, `icon`, `category`, `title`, `subLine`, `bodyText`, `badge`, `ctaLabel`, `ctaHref`, `isEmpty`, `emptyTitle`
- **States:** Populated / Empty
- **Variants:** green (opportunity) / red (risk) / amber (neutral)

#### `KpiCard`
- **Responsibility:** Compact economic indicator tile (rate, inflation, bonds, oil, dollar).
- **Props:** `label`, `value`, `accent`, `compact`, `href`, `valueDir`
- **States:** With link (Finviz) / Without link
- **Variants:** blue / amber / slate (color map)

#### `MacroStatusPill`
- **Responsibility:** One status pill in the Macro Overview Card row 1. Shows label + dot + value.
- **Props:** `label`, `value`, `tone`
- **Variants:** green / red / amber

#### `MacroInfoBlock`
- **Responsibility:** One content block in Macro Overview (market story, conclusion, etc.).
- **Props:** `icon`, `label`, `value`, `variant`
- **Variants:** default (slate label) / blue / purple / sky

#### `MacroTagBlock`
- **Responsibility:** Winners or Losers chip container.
- **Props:** `icon`, `label`, `tags`, `tone`
- **Variants:** green (winners) / red (losers)

#### `MacroActionsBlock`
- **Responsibility:** Investor action bullet list (indigo block).
- **Props:** `actions` (string array)

---

### 5.3 Typography Components

#### `ImportanceBadge`
- **Responsibility:** Renders importance/severity as styled uppercase text.
- **Props:** `level`, `className`, `size`
- **Variants:** table / xs

#### `DirectionChip`
- **Responsibility:** Inline direction text with tone color (↑ עולה / ↓ יורד).
- **Props:** `text`, `displayText`, `light`

#### `DirectionText`
- **Responsibility:** Lightweight tone-colored text without container.
- **Props:** `text`, `fields`, `displayText`, `className`, `size`

#### `NumericChangeSpan`
- **Responsibility:** Renders market % and direction changes (↑ 0.6% / ↓ יורד).
- **Props:** `display`, `className`
- **Variants:** percent / direction / neutral / text

#### `DirectionBadge`
- **Responsibility:** Text-only direction status with arrow icon.
- **Props:** `fields`, `text`, `className`

#### `StockCategoryBadge`
- **Responsibility:** Emoji + label for stock category (opportunity / watchlist / risk).
- **Props:** `category`

---

### 5.4 Structural Display Components

#### `RegimeRow` / `RegimeCard`
- **Responsibility:** Key-value pair row for regime/indicator data.
- **Props:** `label`, `value`, `isLast`, `columnVariant`

#### `SectorRow` / `SectorCard`
- **Responsibility:** Sector name + direction status row with optional Finviz link.
- **Props:** `sector`, `direction`, `relativeStrength`, `isLast`, `columnVariant`

#### `TickerDirectionHeader`
- **Responsibility:** Ticker symbol + company name + direction status header.
- **Props:** `ticker`, `company`, `fields`, `text`

#### `DirectionCard`
- **Responsibility:** Card shell with direction-based border and background.
- **Props:** `fields`, `text`, `children`, `className`, `plain`

---

### 5.5 Action Components

#### `SaveBtn` (🧠)
- **Responsibility:** Save item text to Brain knowledge base.
- **Props:** `text`, `sectionKey`, `sectionLabel`, `onSaveToBrain`
- **States:** Hidden → appears on hover (`opacity-0 group-hover:opacity-100`)

#### `PxBtn` (🔍)
- **Responsibility:** Opens Perplexity AI research query in new tab.
- **Props:** `url`
- **States:** Hidden → appears on hover

#### `MacroSaveCluster`
- **Responsibility:** Smart save cluster — uses `UniversalTabQuickSaveFromBulk` when available, falls back to `SaveBtn`.
- **Props:** `text`, `sectionKey`, `sectionLabel`, `onSaveToBrain`, `bulkSelection`, `compact`

#### `UniversalTabCheckbox`
- **Responsibility:** Checkbox for multi-select / bulk save operations.
- **Props:** `checked`, `onChange`
- **States:** Checked / Unchecked. Hidden when no `onToggle` handler.

---

### 5.6 Utility Components

#### `EmptyState`
- **Responsibility:** Placeholder when a section has no data.
- **Props:** `message`

#### `MacroSentimentCell`
- **Responsibility:** Colored dot + text for sentiment in stock tables.
- **Props:** `value`

#### `ObjectRows`
- **Responsibility:** Renders nested object as key-value table rows with Hebrew labels.
- **Props:** `obj`, `groupLabel`, `sectionKey`, `sectionLabel`, `onSaveToBrain`, `bulkSelection`

---

## 6. Future Expansion Ideas

### 6.1 Cards That Fit Naturally

#### Market Breadth Card
Shows advance/decline ratio, new highs/lows, percent above moving averages.
Pattern: `StatusCard` variant with numeric KPI + trend direction.

#### Sector Rotation Card
Visual heatmap or ordered list of sector momentum (growth → value → defensive cycle).
Pattern: `SectorRow` extended with cycle phase badge.

#### ETF Flows Card
Inflows / outflows into major ETFs (SPY, QQQ, GLD, TLT).
Pattern: `KpiCard` strip with flow direction coloring.

#### Smart Money Card
Unusual options activity, dark pool prints, institutional positioning.
Pattern: `MacroResearchSection` list with color-coded bullish/bearish flags.

#### Economic Calendar Card
Upcoming macro releases (CPI, NFP, FOMC) with expected vs. prior values.
Pattern: `MacroEventCardsSection` variant with countdown timer.

#### Earnings Impact Card
Upcoming earnings that could move the macro picture (mega-cap, sector bellwethers).
Pattern: `StatusCard` or table section, sorted by market-cap weight.

#### Liquidity Analysis Card
Fed balance sheet, reverse repo, credit spreads.
Pattern: `KpiCard` strip or `MacroObjectSection` variant.

#### Dollar / EM Stress Card
DXY trend, EM currency pressure, capital flows.
Pattern: `StatusCard` variant (amber/red tone when DXY strengthens).

---

## 7. UX Improvements

### 7.1 Alignment Issues

| Issue | Location | Recommendation |
|---|---|---|
| Body text indented with `mr-[72px]` is brittle | Highlights, Events | Use CSS grid instead of margin offset |
| Grid cells not equal height | Opportunity / Risk grids | Add `items-stretch` + `h-full` on inner card |
| KPI strip labels truncated on small screens | Executive Snapshot | Add `title` tooltip for full label |

### 7.2 Badge Positioning Issues

| Issue | Location | Recommendation |
|---|---|---|
| Importance badge sometimes wraps to second line | Event cards | Add `whitespace-nowrap` + `shrink-0` |
| Warning badge cut off on narrow cards | Warnings section | Use `flex-wrap` on the badge row |
| Status pill labels too long for pill width | Macro Overview | Abbreviate long values (e.g. "Risk-On" not full sentence) |

### 7.3 Typography Issues

| Issue | Status | Recommendation |
|---|---|---|
| Body text on pastel cards lacked contrast | Fixed in latest session | Verify all inline overrides match shared constants |
| `opacity-80` was reducing contrast | Fixed | Never use `opacity-*` on body text — change the color value instead |
| `text-xs` for body text | Partially fixed | Minimum `text-sm` for reading paragraphs; `text-[15px]` preferred |
| Line height too tight | Fixed in `DASHBOARD_TABLE_CELL_BODY_CLS` | Use `leading-relaxed` (1.625) for all paragraphs |

### 7.4 Readability Issues

| Issue | Recommendation |
|---|---|
| Long descriptions cut with `line-clamp-3` | Add "הצג עוד" expand toggle for clipped text |
| Market story paragraphs in Macro Overview too dense | Add subtle `border-r-2` accent in InfoBlock for visual breathing |
| Executive Snapshot duplicates Macro Overview data | Consider collapsing one or making Snapshot a summary of the below sections |

### 7.5 Mobile Issues

| Issue | Recommendation |
|---|---|
| 3-column grid collapses to 1 column — important cards lost below fold | Consider 2-column on mobile for Status Cards |
| Hover-only action buttons invisible on touch | Add long-press or swipe gesture for mobile save actions |
| Table sections overflow horizontally | `overflow-x-auto` already applied — verify scroll hint is visible |
| KPI strip wraps to 2-column — some KPIs hidden | Add horizontal scroll or accordion for KPI strip |

### 7.6 RTL Issues

| Issue | Location | Status |
|---|---|---|
| Some `flex` items not explicitly set `dir="rtl"` | Nested inner components | Audit each nested flex — always set dir explicitly |
| `mr-[...]` used correctly but fragile | Multiple sections | Document that RTL uses `mr-` for indent, `ml-` for action areas |
| Hover buttons on far-left get clipped on small screens | Action bar | Add `overflow-visible` on the group container |

---

## 8. Design Principles

### 8.1 Core Philosophy

**"Analyst at a glance, researcher on demand."**
The dashboard must communicate the most critical signal within 5 seconds, then allow deep-dive without cluttering the primary view.

### 8.2 Extracted Principles

#### P1: Executive Summary First
The `ExecutiveSnapshot` is always first. It never moves. An investor should never need to scroll to understand the market state at a high level.

#### P2: Decision Flow Architecture
Sections follow a deliberate cognitive path:
1. **What happened?** (Events)
2. **What does it mean?** (Macro Overview + Highlights)
3. **What do I do?** (Opportunities + Risks + Warnings)
4. **What's the data?** (Tables)

Never mix these layers. Data tables always go below decision content.

#### P3: Color = Signal
Color is reserved for information, not decoration:
- 🟢 Green = bullish / opportunity / positive signal
- 🔴 Red = bearish / risk / negative signal
- 🟡 Amber = neutral / mixed / monitor
- 🔵 Blue = informational / data / reference
- 🟣 Violet = sector focus / category
- 🟤 Indigo = actions / recommendations

Never use a color that contradicts its semantic meaning.

#### P4: Progressive Disclosure
Primary content (title, badge, status) is always visible.
Secondary content (description, impact) is below the fold of the card.
Action buttons are hidden until hover — they exist but don't distract.

#### P5: Consistent RTL Typography
Every text element has an explicit Hebrew typographic role:
- Title → `font-bold` or `font-extrabold`
- Body → `font-semibold`, minimum `text-[15px]`, `leading-relaxed`
- Label / Badge → `font-semibold`, uppercase when category
- Muted → `font-semibold text-slate-600` (never `font-normal`)

**Never use `font-normal` or `opacity-*` to reduce text importance. Use explicit lighter colors.**

#### P6: Sparse Hover Actions
Action buttons (🧠 🔍) appear only on hover and are positioned at the far edge. They never compete with content. This keeps the reading experience clean while still making actions accessible.

#### P7: Interactivity Without Noise
Checkboxes and bulk selection exist on every row but are visually subtle. They don't appear unless a bulk action session is active. This prevents the UI from looking like a task manager when the user just wants to read.

#### P8: Low Cognitive Load
Each section has one clear purpose. Sections don't mix concerns. The user always knows what they're looking at:
- "I'm in the Events section. These are things that happened."
- "I'm in the Risks section. These are things that could go wrong."

#### P9: Consistent Hebrew Labeling
English field names from the AI output (e.g. `macroMood`, `riskOnRiskOff`) are always mapped to Hebrew before display. No raw English keys are ever shown to the user. The mapping lives in `MACRO_FIELD_HE`.

#### P10: Actions Are Colored, Data Is Neutral
Section content uses semantic colors (green/red/amber per tone).
Section wrappers (`SectionCard`) are always neutral white — they are structural, not semantic.
This prevents "everything is colorful" fatigue and ensures color remains meaningful.

---

## 9. Dashboard Governance Rules

> These rules are binding for all future dashboard work.
> No exceptions without explicit written approval.

---

### Rule 1 — No new card type without approval

**What it means:** A "card type" is any visual pattern that differs structurally from the existing taxonomy in Section 2. A new background treatment, new layout structure, or new data shape all count as a new card type.

**Before creating a new card type you must:**
1. Check Section 2 (Card Taxonomy) for an existing match
2. Confirm no existing component can be extended with a `variant` prop
3. Get explicit approval before writing any JSX

**Allowed:** New `variant` prop on an existing card type.
**Not allowed:** New card shape, new layout pattern, new container structure — without approval.

---

### Rule 2 — Every card must belong to an existing taxonomy

**What it means:** Every card rendered on the dashboard must map to one of the 8 types defined in Section 2:

| # | Type |
|---|---|
| 2.1 | Executive Snapshot Card |
| 2.2 | Macro Event Card |
| 2.3 | Macro Overview Card |
| 2.4 | Highlight Card |
| 2.5 | Opportunity Card |
| 2.6 | Risk Card |
| 2.7 | Warning / Action Row |
| 2.8 | AI Insight / KPI Card |

If data doesn't fit any type, that's a signal to **extend** an existing type (new optional field) — not create a new one.

---

### Rule 3 — Badge system is centralized

**What it means:** All badge colors, Hebrew labels, and positioning logic live in `MorningBriefVisualPrimitives.jsx` or in the centralized CSS maps defined in `MacroGemDashboard.jsx` (`HIGHLIGHT_TONE_CSS`, `WARNING_BADGE_CSS`, `OVERVIEW_TONE`, `SC`).

**Prohibited:**
- Inline `bg-red-100 text-red-700` badge classes written directly in JSX without going through a map
- Hebrew badge labels hardcoded per-component instead of from a shared source
- Local badge color logic duplicating the centralized tone detection

**Required:** New badge variants must be added to the centralized map, not invented locally.

**Reference:** Section 4 (Badge & Status System) defines all valid badge types.

---

### Rule 4 — Hebrew-first UI

**What it means:** Every user-facing string — labels, badges, tooltips, empty states, button text, table headers — must be in Hebrew. No English text is ever shown to the user.

**Enforcement:**
- All AI-output English field names pass through `heLabel()` before display
- All severity/importance strings pass through `translateLevel()` before display
- No raw JSON keys are ever rendered to the user
- Section titles are always Hebrew with emoji prefix

**Exception:** Ticker symbols (NVDA, AAPL) and percentage values (4.25%) remain in LTR English as they are proper nouns / numeric data.

---

### Rule 5 — Status badge always in header row

**What it means:** The primary status or sentiment badge of a card must appear in the same visual row as the card title. It is never placed below the title or in the body text.

**RTL positioning:** In `dir="rtl"` flex rows, the badge must be the **first DOM child** in the title row to appear visually on the right.

**Pattern:**
```jsx
<div className="flex items-start gap-2" dir="rtl">
  <span className="shrink-0 badge-classes">{badgeLabel}</span>  {/* DOM first = visual right */}
  <p className="flex-1 title-classes">{title}</p>
</div>
```

**Category labels** (e.g. "מצב שוק", "סיכון מרכזי") are placed **above** the title as a micro-label, not as a badge in the title row. Badges and category labels are two different elements.

---

### Rule 6 — AI action button placement is standardized

**What it means:** The 🧠 (Save to Brain) and 🔍 (Perplexity Research) buttons must always:

1. Be positioned at the **far left edge** of the card/row (DOM last in RTL)
2. Be **hidden by default** (`opacity-0`) and visible only on hover (`group-hover:opacity-100`)
3. Appear in a **consistent order**: 🔍 before 🧠 (research before save, left to right)
4. Use the shared `SaveBtn` / `PxBtn` / `MacroSaveCluster` components — never inline button reimplementations
5. Never be placed inside the card content area — only in the action zone

**Action button zone pattern:**
```jsx
<div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
  {pxUrl && <PxBtn url={pxUrl} />}
  <MacroSaveCluster ... />
</div>
```

---

### Rule 7 — All dashboards must support RTL

**What it means:** Every new section, card, or component must be built RTL-first. It is not an afterthought.

**Checklist for every new component:**
- [ ] Outermost container has `dir="rtl"`
- [ ] Text alignment is `text-right` on all Hebrew content
- [ ] Flex row DOM order is reverse of visual order (first DOM child = visual right)
- [ ] Margin indentation uses `mr-*` not `ml-*`
- [ ] Absolute-positioned elements use `right-*` not `left-*` for RTL anchoring
- [ ] LTR exceptions (tickers, numbers) use `dir="ltr"` inline

**Never assume RTL is inherited.** Always set `dir="rtl"` explicitly on each section container.

---

### Rule 8 — Mobile-first validation required

**What it means:** Every new card or section must be visually validated at 375px (iPhone SE) before it is considered done.

**Required breakpoints:**
| Breakpoint | Width | Validation required |
|---|---|---|
| Mobile | 375px | Primary validation |
| Tablet | 768px | Grid layout check |
| Desktop | 1280px+ | Full layout check |

**Mobile rules:**
- No horizontal overflow (use `overflow-x-auto` on tables)
- No text truncated below 2 lines without `title` tooltip
- No hover-only interactions as primary actions (touch has no hover)
- Grid columns collapse to 1 on mobile unless explicitly tested at 2
- Minimum tap target: 44×44px for all interactive elements

---

### Rule 9 — Reusable components before new components

**What it means:** Before writing a new component, check Section 5 (Component Inventory). If an existing component can handle the use case with a new prop, extend it. Do not create a duplicate.

**Decision order:**
1. Use existing component as-is
2. Add a `variant` or optional prop to an existing component
3. Create a new component only if structurally incompatible

**Anti-patterns to avoid:**
- Two components that render almost identically (e.g. `RiskCard` and `WarningCard` both being rounded bordered divs with an icon)
- Copying JSX from an existing component and tweaking it instead of extracting a shared base
- Creating a new section-specific badge component instead of using the centralized badge map

**When a new component is justified:** The existing components serve fundamentally different data shapes, not just different visual variants.

---

### Rule 10 — New sections must follow Information Architecture rules

**What it means:** New dashboard sections must be placed in the correct layer of the Information Architecture defined in Section 1.2.

**Layer assignment for new sections:**
| Layer | Question it answers | Examples |
|---|---|---|
| Events Layer | What happened? | Macro Events, Earnings Calendar, Economic Releases |
| Analysis Layer | What does it mean? | Macro Overview, Highlights, Market Breadth |
| Decision Layer | What do I do? | Opportunities, Risks, Warnings, Smart Money |
| Data Layer | What's the raw data? | Sectors, Stocks, Indices, ETF Flows |
| Deep Data Layer | What's the reference? | Fed Policy, Macro Variables, Liquidity |

**Prohibited:**
- Placing a "What to do" section above "What happened"
- Mixing raw data tables with decision-layer cards in the same section
- Adding a new Executive Snapshot card without updating the existing snapshot first

**The Executive Snapshot is fixed.** It always stays at position 0. It is not a "section" — it's a persistent orientation panel.

---

### Governance Summary Table

| Rule | What it governs | Enforcement point |
|---|---|---|
| 1 | Card types | Design review before any new card |
| 2 | Card taxonomy | Every JSX card must map to Section 2 |
| 3 | Badge system | No inline badge colors — always from map |
| 4 | Language | `heLabel()` + `translateLevel()` mandatory |
| 5 | Badge position | First DOM child in title flex row |
| 6 | AI buttons | `PxBtn` + `MacroSaveCluster` only, hover-only, far left |
| 7 | RTL | `dir="rtl"` on every new component's root |
| 8 | Mobile | Validate at 375px before done |
| 9 | Components | Check Section 5 before creating new |
| 10 | Section order | Map to IA layer before placing |

---

## Appendix: Shared CSS Constant Reference

```
// MorningBriefVisualPrimitives.jsx

COMPARISON_SURFACE_BG         bg-white dark:bg-zinc-900
COMPARISON_SECTION_BORDER     border-slate-200/80 dark:border-zinc-700/70
COMPARISON_TABLE_HEAD_BG      bg-white dark:bg-zinc-900
COMPARISON_ROW_HOVER          hover:bg-slate-50/50 dark:hover:bg-zinc-800/25

SECTION_HEADER_TITLE_CLS      text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight leading-snug shrink-0
SECTION_HEADER_ROW_CLS        flex flex-wrap items-center ... border-b ...
SECTION_HEADER_COUNT_CLS      text-base font-bold tabular-nums

DASHBOARD_TABLE_HEAD_CLS      text-base font-bold text-slate-800 dark:text-zinc-100 leading-tight
DASHBOARD_TABLE_CELL_PRIMARY_CLS  text-[15px] font-bold text-slate-900 dark:text-zinc-50 leading-snug
DASHBOARD_TABLE_CELL_BODY_CLS     text-[15px] font-semibold text-slate-900 dark:text-zinc-100 leading-relaxed
DASHBOARD_TABLE_CELL_DATE_CLS     text-[15px] font-semibold text-slate-700 dark:text-zinc-200 tabular-nums leading-snug
DASHBOARD_TABLE_STATUS_CLS        text-base font-bold leading-snug tabular-nums
DASHBOARD_TABLE_CELL_MUTED_CLS    text-sm font-semibold text-slate-600 dark:text-zinc-300 leading-snug
DASHBOARD_EMPTY_CLS               text-[15px] font-medium text-slate-400 dark:text-zinc-500 leading-snug
```

---

*Document version: 2026-06-22 — Governance rules added*
*Maintained by: Claude Code + Erez*
