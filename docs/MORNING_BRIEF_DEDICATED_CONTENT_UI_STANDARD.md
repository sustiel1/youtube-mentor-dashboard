# Morning Brief / Dedicated Content UI Standard

> **מקור אמת ויזואלי** לכל החלטות עיצוב ב-Morning Brief וב-Dedicated Content.
> עדכון אחרון: 2026-06-25

---

## 1. Purpose

This document is the single source of truth for how Morning Brief sub-sections and Dedicated Content sub-topics should look, behave, and align.

It exists to:
- Prevent column drift between sections
- Ensure consistent RTL layout across all tables and cards
- Define precise rules for sentiment, change/value, and notes columns
- Provide a QA reference before every release or Base44 pull

**Rule zero:** if a new sub-section is added, it must follow all rules in this document before it reaches production.

---

## 2. Sections Covered

| Section | Hebrew | Component |
|---|---|---|
| Market Regime | מצב שוק | `MorningBriefPanels.jsx` — `MarketRegimeTable` |
| Sectors | סקטורים | `MarketSectorTable.jsx` |
| Mentioned Stocks | מניות שהוזכרו | `MorningBriefPanels.jsx` — `StocksSection` |
| Markets / Indices | שווקים | `MorningBriefMarketsTable.jsx` |
| Sentiment | סנטימנט | `MorningBriefPanels.jsx` — `SentimentSection` |
| Macro | מאקרו | `MorningBriefPanels.jsx` — `MacroSection` |
| Economic Calendar | לוח כלכלי | `MorningBriefPanels.jsx` — `EconomicCalendarSection` |
| News | חדשות | `MorningBriefNewsSection.jsx` |
| Opportunities & Risks | הזדמנויות וסיכונים | `MorningBriefPanels.jsx` — `OpportunitiesRisksDashboard` |
| Dedicated Content sub-topics | נושאים | `InsightsStructuredView.jsx` et al. |

---

## 3. General Layout Rules

All sub-sections must follow these rules without exception:

### 3.1 RTL
- Every table and card uses `dir="rtl"`.
- Visual reading order: right → left.
- First column in JSX = rightmost column visually.

### 3.2 Section Card
- Wrapped in `SectionCard` with: title + icon + count badge.
- Consistent padding: card body `px-4 py-3` or equivalent.
- Empty state shown with `emptyMessage` prop — no blank white space.

### 3.3 Table Wrapper
- All tables use `BriefTableWrapper` (provides `overflow-x-auto` for narrow viewports).
- All tables use `BRIEF_TABLE_CLS = 'w-full min-w-[980px] text-right border-collapse table-fixed'`.
- `table-fixed` is mandatory — prevents columns from shifting based on content length.

### 3.4 Row Height
- Standard row: `py-2` on cells.
- No row should be taller than ~3 lines of text.
- Long text wraps only inside the Notes column (see §8).

### 3.5 Hover State
- Every table row: `hover:bg-slate-50/50 dark:hover:bg-zinc-800/25`.
- `group` class on `<tr>` so save actions can use `group-hover:opacity-100`.

---

## 4. Shared Column Alignment Standard

### The Golden Rule

> **All sections must have their Sentiment column start at the same horizontal position (40.5% from the right), and their Notes/Description/Impact column start at 67% from the right.**

This is achieved by ensuring the pre-sentiment columns always sum to **38%** (plus 2.5% checkbox = 40.5%), and a dedicated **11% change/value column** separates Sentiment from Notes.

### Column Width Constants (`briefTableLayout.jsx`)

```js
BRIEF_COL = {
  checkbox:     '2.5%',   // ☐ — always first
  primaryLabel: '38%',    // single-label sections
  sentiment:    '15.5%',  // סנטימנט — always starts at 40.5%
  change:       '11%',    // שינוי % / ערך — structural, even if empty
  // notes = flex (remaining ~28%)
  save:         '5%',     // 💾 — always last

  // Multi-label sections (sum to 38%):
  indicator:    '24%',    // מאקרו: indicator
  macroValue:   '14%',    // מאקרו: value/change cell
  symbol:       '20%',    // מניות: symbol
  sector:       '18%',    // מניות: sector

  // Markets:
  // asset = 38% (via BRIEF_MARKETS_COL.asset)
}
```

### Alignment Table — Notes starts at 67% in every section

| Section | Col 1 (☐) | Col 2 | Col 3 | Sentiment starts | Change col | Notes starts |
|---|---|---|---|---|---|---|
| Market Regime | 2.5% | label 38% | — | **40.5%** | 11% (empty) | **67%** |
| Sectors | 2.5% | name 38% | — | **40.5%** | 11% (empty) | **67%** |
| Sentiment | 2.5% | type 38% | — | **40.5%** | 11% (ערך) | **67%** |
| Macro | 2.5% | indicator 24% + value 14% | — | **40.5%** | 11% (empty) | **67%** |
| Markets | 2.5% | asset 38% | — | **40.5%** | 11% (שינוי%) | **67%** |
| Stocks | 2.5% | symbol 20% + sector 18% | — | **40.5%** | 11% (שינוי%) | **67%** |
| Economic Calendar | 2.5% | event 38% | — | **40.5%** (חשיבות) | 11% (מועד) | **67%** |

**Key insight:** Sections without real change data (Market Regime, Sectors, Macro) still have an 11% structural column that renders empty. This empty column is what keeps the Notes column aligned at 67%.

---

## 5. Recommended Table Column Order

### Standard market/stock tables (RTL reading order — right to left)

```
☐  |  Primary Label  |  סנטימנט  |  שינוי %  |  הערות / תיאור  |  💾
```

- Primary Label = symbol, name, indicator, asset — whatever is the row identifier
- For two-column identifiers (Stocks: symbol + sector, Macro: indicator + value), they sum to 38%
- Sentiment always at 40.5%
- Change/value always at 56%
- Notes always at 67%

### Economic Calendar

```
☐  |  אירוע  |  חשיבות  |  מועד  |  השפעה  |  💾
```

- **חשיבות** maps to Sentiment position (40.5%) — qualitative assessment
- **מועד** maps to Change position (56%) — specific short value
- **השפעה** maps to Notes position (67%) — free-form description

---

## 6. Sentiment Styling Rules

### 6.1 Table Sentiment — Dot + Label

All table sections use `InlineSentimentBadge`:

```
● חיובי    — emerald-500 dot + dark text
● ניטרלי   — amber-400 dot + dark text
● שלילי    — red-500 dot + dark text
```

Component: `InlineSentimentBadge` with `BRIEF_SENTIMENT_INLINE_CLS`.

### 6.2 News Cards — Text Only (no badge fill)

News cards use colored text without background or border:

```
חיובי   — text-emerald-600 dark:text-emerald-400  font-bold  text-[13px]
ניטרלי  — text-amber-600   dark:text-amber-400    font-bold  text-[13px]
שלילי   — text-red-600     dark:text-red-400      font-bold  text-[13px]
```

**No** `bg-*`, **no** `border`, **no** `rounded-md`, **no** `px-2 py-0.5`.

### 6.3 Economic Calendar Importance — Pill Badge (not dot)

```
קריטי    — red pill    (bg-red-950 / text-red-100)
גבוהה    — red pill    (bg-red-100 / text-red-800)
בינונית  — orange pill (bg-orange-100 / text-orange-800)
נמוכה    — gray pill   (bg-slate-100 / text-slate-500)
```

**Color rule:** Low importance is gray, NOT green. Green is reserved for "positive" sentiment only.

Component: `CalendarImportanceDot` — renders a rounded pill via `importanceStyles()` classes.

### 6.4 Economic Calendar Impact — Directional Text

The `impact` column contains free-form qualitative text (e.g. "Rate-sensitive sectors could reprice", "Potentially positive"). It is rendered via `BriefNewsNotesText` — the same component used in the Macro section.

- Directional keywords (bullish/bearish) → colored text
- Plain text → neutral body text
- Missing → `—`

**Semantic distinction from Importance:**
- **Importance** = how significant is this event? (High/Medium/Low pill)
- **Impact** = what effect is expected? (qualitative text with directional coloring)

### 6.4 News Card Side Border

The left (RTL: right) border of each news card always matches sentiment:

```
positive → border-r-emerald-500
neutral  → border-r-amber-500
negative → border-r-red-500
```

---

## 7. Change / Value Column Formatting

Rules for the `שינוי %` / `ערך` column:

| Rule | Detail |
|---|---|
| Positive % | Green text + ↑ arrow |
| Negative % | Red text + ↓ arrow |
| Missing | `—` (slate-300 / zinc-600) |
| Sentiment in same cell | **Never** — separate columns always |
| Raw debug strings | **Never** — no `value:`, `status:`, `description:` in UI |

### 7.1 Sentiment Section — `parseSentimentValueForDisplay`

The Sentiment section has AI output that may be structured (`"value: 17.3 | status: ניטרלי | description: ..."`). The helper `parseSentimentValueForDisplay(raw)` extracts:
- `numericText` → shown in **ערך** column (plain number, e.g. `17.3`)
- `descriptionText` → shown in **הערה** column (text only)

Never show raw field labels (`value:`, `status:`, etc.) in the UI.

---

## 8. Notes / Description / Impact Column Rules

All these field names map to the same shared **Notes column** (starts at 67%):

`הערות` · `הערה` · `תיאור` · `השפעה` · `תיאור / השפעה` · `סיבה` · `הערה / סיבה`

Rules:
- This column always has `flex` width (takes remaining space ~28%)
- Text wraps freely inside this column
- `line-clamp-3` for table rows (prevents oversized rows)
- Long Hebrew text **must not** push sentiment or change columns
- Uses `BRIEF_CELL.notes = 'px-2 py-2 align-middle min-w-0 overflow-hidden'`

---

## 9. Markets Table Design

Reference design: mirrors Mentioned Stocks.

```
☐  |  נכס (38%)  |  סנטימנט (15.5%)  |  שינוי % (11%)  |  הערה (flex)  |  💾
```

- Asset name in primary label column
- Sentiment as dot + label
- Change% shown if AI provides it, otherwise `—`
- Notes column for free-form comment

---

## 10. Mentioned Stocks Table Design

```
☐  |  סימול (20%)  |  סקטור (18%)  |  סנטימנט (15.5%)  |  שינוי % (11%)  |  הערות (flex)  |  💾
```

- Symbol + Sector sum to 38% → Sentiment aligns at 40.5%
- Change% from `stock.changePercent` field (populated via GEM output)
- If no changePercent data → `—` (never invented)
- External links column optional (renders only if `ui.showStockExternalLinks`)

---

## 11. Sentiment Section Design

```
☐  |  סוג (38%)  |  סנטימנט (15.5%)  |  ערך (11%)  |  הערה (flex)  |  💾
```

- **סוג** = indicator type (Fear & Greed, VIX, Put/Call Ratio)
- **סנטימנט** = tone dot + label (derived from full value text)
- **ערך** = clean numeric only (e.g. `17.3`, `62`) — via `parseSentimentValueForDisplay`
- **הערה** = description text only — no numeric, no field labels

---

## 12. Economic Calendar Design

```
☐  |  אירוע (38%)  |  חשיבות (15.5%)  |  מועד (11%)  |  השפעה (flex)  |  💾
```

- **חשיבות** uses `CalendarImportanceDot` — colored pill badge (not dot)
  - `critical` / `קריטי` → dark red pill
  - `high` / `גבוהה` → red pill
  - `medium` / `בינונית` → orange pill
  - `low` / `נמוכה` → gray pill (not green — green is reserved for "positive")
- **מועד** = date string (short, whitespace-nowrap)
- **השפעה** = qualitative impact text, rendered via `BriefNewsNotesText` — directional keywords colored, plain text neutral
- AI schema (`morningBriefSchema.js`) outputs calendar as objects: `{ event, date, importance, impact }`
- Backward compatible: string items still parse correctly via `normalizeCalendarRow`

---

## 13. Opportunities & Risks Layout

Reorder rule (IIFE in JSX):

| State | Display order |
|---|---|
| Both have content | Opportunities first (top), Risks second |
| Only risks have content | **Risks first (top)**, empty opportunities below |
| Only opportunities have content | Opportunities first (top), empty risks below |
| Both empty | Single empty state |

The group with real content **always** appears first visually, so the user sees meaningful data immediately.

---

## 14. News Card Design

### Card Structure (RTL)

```
┌─ border-r-[color] ──────────────────────────────────────────┐
│ ☐  [sentiment text]  Headline bold (line-clamp-2)      [💾] │
│                      Summary lighter (line-clamp-2)         │
│                      השפעה: impact text / —                 │
│                      [tag] [tag] [tag]                      │
└─────────────────────────────────────────────────────────────┘
```

### Rules

| Element | Rule |
|---|---|
| Layout | Cards, not table |
| Sentiment | Colored text only — no filled badge, no border, no background |
| Sentiment font | `text-[13px] font-bold` |
| Sentiment position | Before headline in JSX → appears rightmost in RTL |
| Headline | `text-[15px] font-bold line-clamp-2` |
| Summary | `text-sm line-clamp-2` — lighter color |
| Impact | Always shown — `"השפעה: —"` if missing |
| Tags | Small pills at bottom — max 3 tags per card |
| Side border | `border-r-4` colored to match sentiment |
| Expand/collapse | Show 3 items collapsed, "הצג עוד" button for more |

---

## 15. Dedicated Content Sub-topic Style

Sub-topics generated inside Dedicated Content follow the same rules:

- Sub-section title rendered with icon + count (same `SectionCard` pattern)
- Tables use same `BRIEF_TABLE_CLS` and `BriefTableWrapper`
- Column alignment follows §4 (Sentiment at 40.5%, Notes at 67%)
- Sentiment uses same dot + label pattern
- Cards (insights, knowledge) use consistent padding and text hierarchy
- RTL throughout

---

## 16. QA Checklist

Run this checklist after every significant UI change and before every Base44 Pull + Publish:

### Layout & Alignment
- [ ] All sections render in RTL direction
- [ ] Sentiment column visually aligned across all table sections
- [ ] Change/value column visually aligned across all table sections
- [ ] Notes/Description/Impact column starts at same position across all sections
- [ ] No random column gaps or width mismatches on desktop (1280px+)
- [ ] Horizontal scroll appears on narrow viewports, not at desktop width

### Sentiment
- [ ] חיובי = green in all tables and news cards
- [ ] ניטרלי = amber/yellow in all tables and news cards
- [ ] שלילי = red in all tables and news cards
- [ ] News card sentiment is text-only (no filled badge)
- [ ] Economic Calendar חשיבות uses colored dot (not plain text)

### Data Rendering
- [ ] No raw debug strings in UI (`value:`, `status:`, `description:` etc.)
- [ ] Sentiment section ערך column shows only clean numbers or `—`
- [ ] Change% column shows `—` when data is missing (not `0` or empty)
- [ ] Long Hebrew text wraps inside Notes column and does not overflow
- [ ] Economic Calendar shows `importance` dot (not `—`) after re-analysis

### Opportunities & Risks
- [ ] When only risks exist → risks appear at top
- [ ] When only opportunities exist → opportunities appear at top
- [ ] Both empty → clean empty state, not broken layout

### News
- [ ] News cards show: sentiment text · headline · summary · impact · tags
- [ ] Impact line always visible (shows `—` if empty)
- [ ] Side border color matches sentiment
- [ ] Expand/collapse button works for >3 items

### Compatibility
- [ ] Old saved videos (pre-schema-update) still render correctly
- [ ] Freshly analyzed videos display all new fields
- [ ] No console errors related to missing fields or null access

---

## Sector Holdings Rule

Every sector or sector ETF displayed in Morning Brief / Dedicated Content must include a small **"🔎 בדוק אחזקות"** action near the sector name.

### Where it applies

| Section | Component | Status |
|---|---|---|
| Sectors (comparison columns) | `SectorRow` in `MorningBriefVisualPrimitives.jsx` | ✅ implemented |
| Sectors (table view) | `SectorNameCell` in `MarketSectorTable.jsx` | ✅ implemented |
| Macro / Specialized screens | `MacroGemDashboard.jsx` | ✅ implemented |
| Any future sector component | Must use `buildPerplexityEtfHoldingsUrl(etf)` | rule |

### Visual spec

```
XLF (Financials)
🔎 בדוק אחזקות         ← text-[10px] violet-500, below sector name

XBI (Biotech)
🔎 בדוק אחזקות

Consumer Discretionary
🔎 בדוק אחזקות
```

### Rules

- Link appears **only when a sector ETF is resolvable** via `resolveSectorMeta()` or `resolveSectorFinvizLink()`.
- If no ETF is known → no link shown (not an error, not an empty placeholder).
- Link opens **Perplexity** with a structured Hebrew query for top 10 ETF holdings.
- Styling: `text-[10px] font-medium text-violet-500 hover:text-violet-700 dark:text-violet-400 whitespace-nowrap`.
- `onClick={(e) => e.stopPropagation()}` — must not trigger row selection.
- RTL correct — link appears below sector name, reads right-to-left.

### Helper functions (from `src/utils/finvizLinks.js`)

```js
resolveSectorMeta(sectorName)           // → { etf, he, finvizUrl } | null
buildPerplexityEtfHoldingsUrl(etf)      // → Perplexity search URL | null
resolveSectorFinvizLink(sectorStr)      // → { ticker, url } | null  (for table cells)
```

### QA additions

- [ ] "🔎 בדוק אחזקות" appears under each sector with a known ETF
- [ ] Link is absent (not broken) for sectors with no ETF mapping
- [ ] Clicking the link does not select the row or open an unrelated modal
- [ ] Table column alignment is not broken by the link addition
- [ ] RTL layout correct on all screen sizes

---

---

## 17. Clickable Financial Symbols Rule

Every financial symbol displayed in Morning Brief / Dedicated Content must be a clickable external link when a URL can be resolved. If no URL is known, the symbol renders as plain text — never a broken link.

### Priority of link target

| Symbol type | Target | Tool |
|---|---|---|
| US stocks / ETFs | Finviz quote page | `getFinvizUrl()` |
| Named indices (NASDAQ, S&P 500, Russell 2000) | Finviz via ETF proxy | `getFinvizUrl()` / `_INDEX_MAP` |
| DXY / Dollar Index | TradingView `TVC:DXY` | `getExternalSymbolUrl()` fallback |
| BTC / Bitcoin | TradingView `BINANCE:BTCUSDT` | `getExternalSymbolUrl()` fallback |
| ETH / Ethereum | TradingView `BINANCE:ETHUSDT` | `getExternalSymbolUrl()` fallback |
| VIX | TradingView `TVC:VIX` | `getExternalSymbolUrl()` fallback |
| Israeli indices (TA35, TA125) | No link (excluded) | returns `null` |
| Unknown symbol | No link (plain text) | returns `null` |

### Where it applies

| Section | Component | Status |
|---|---|---|
| Markets / Indices table | `MorningBriefMarketsTable.jsx` — `row.asset` | ✅ implemented |
| Mentioned Stocks | `MorningBriefPanels.jsx` — `StocksSection` | ✅ implemented |
| Sectors table | `MarketSectorTable.jsx` — `SectorNameCell` | ✅ implemented (Finviz) |
| Macro / Specialized | `MacroGemDashboard.jsx` — inline links | ✅ implemented |
| Any future symbol display | Must use `ExternalSymbolLink` or `getExternalSymbolUrl` | rule |

### Reusable component

**`ExternalSymbolLink`** — exported from `MorningBriefVisualPrimitives.jsx`

```jsx
<ExternalSymbolLink symbol="AAPL" className={DASHBOARD_TABLE_CELL_PRIMARY_CLS}>
  AAPL
</ExternalSymbolLink>
```

- Resolves URL via `getExternalSymbolUrl(symbol)` (Finviz → TradingView fallback)
- Renders `<a target="_blank" rel="noopener noreferrer">` when URL is found
- Renders `<span>` when no URL is known — never a broken link
- `onClick={(e) => e.stopPropagation()}` — never triggers row selection
- `hover:underline cursor-pointer` styling — subtle, RTL correct

### Helper functions (from `src/utils/finvizLinks.js`)

```js
getFinvizUrl(input)           // Finviz URL or null
getExternalSymbolUrl(input)   // Finviz first, then TradingView/CNN fallback, then null
resolveFinvizTicker(input)    // ETF/ticker string or null
```

### Styling rules

- Links use the same class as the surrounding text (`DASHBOARD_TABLE_CELL_PRIMARY_CLS`) plus `hover:underline`
- No separate link color — matches surrounding typography
- `target="_blank"` always
- RTL correct — no direction change for the link itself

### QA additions

- [ ] NASDAQ, S&P 500, Dow Jones in Markets table are clickable (→ Finviz via QQQ/SPY/DIA proxy)
- [ ] DXY / Dollar Index in Markets table is clickable (→ TradingView)
- [ ] BTC / Bitcoin in Markets table is clickable (→ TradingView)
- [ ] TA35, TA125 render as plain text (not a broken link)
- [ ] Unknown symbols render as plain text (not a broken link)
- [ ] Clicking a symbol does not select the row or open unrelated UI
- [ ] Link opens in new tab

---

## Appendix: Key File Map

| File | Purpose |
|---|---|
| `src/components/dashboard/briefTableLayout.jsx` | All shared column widths, cell classes, BriefTableWrapper |
| `src/components/dashboard/MorningBriefPanels.jsx` | All Morning Brief section tables |
| `src/components/dashboard/MorningBriefMarketsTable.jsx` | Markets table |
| `src/components/dashboard/MarketSectorTable.jsx` | Sectors table |
| `src/components/dashboard/MorningBriefNewsSection.jsx` | News cards |
| `src/components/dashboard/MorningBriefVisualPrimitives.jsx` | ImportanceBadge, NumericChangeSpan, DirectionText |
| `src/lib/morningBriefVisuals.js` | importanceStyles, importanceTextStyles, toneStyles |
| `src/lib/morningBriefDisplay.js` | extractCalendarRows, normalizeCalendarRow, stockRecordFromObject |
| `src/lib/morningBriefNewsNormalize.js` | normalizeNewsItems, normalizeNewsSentiment |
| `src/lib/sentimentDisplayI18n.js` | translateSentimentValue, translateSentimentLabel |
| `src/ai/gemini/schemas/morningBriefSchema.js` | GEM output schema (calendar now uses objects with importance) |
| `src/ai/quickCopyPrompts.js` | Prompt instructions for GEM analysis |
