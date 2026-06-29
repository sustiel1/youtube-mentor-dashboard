# AI Analysis Link Routing — Planning Document

**Status:** Planning only — no code changes yet.  
**Date:** 2026-06-29  
**Author:** Claude Code (audit + plan)  
**Goal:** Design a "נתח עם AI" workflow that routes any market item to the right external tools based on entity type.

---

## 1. Current Architecture Audit

### 1.1 Where AI / Research Actions Currently Live

| Component / File | Role | Status |
|---|---|---|
| `src/components/shared/ResearchDropdown.jsx` | Split-button: Perplexity + Google Finance | Active — used in Macro cards |
| `src/components/shared/UniversalTabQuickSaveActions.jsx` | Per-row three-dots menu with Perplexity + Google Finance | **Disabled** — returns `null` in `compact=true` mode |
| `src/components/shared/UniversalTabSelectionBar.jsx` | Black bottom toolbar: Brain / Obsidian / Workspace / Copy | Active — **no AI analysis button** |
| `src/utils/finvizLinks.js` | `resolveFinvizTicker()`, `getFinvizUrl()`, `getExternalSymbolUrl()`, `buildPerplexityEtfHoldingsUrl()` | Active |
| `src/lib/macroIndicatorLinks.js` | `getMacroIndicatorUrl()` — maps macro indicators to FRED / Investing.com | Active |
| `src/lib/sentimentSourceLinks.js` | `getSentimentSourceLink()` — maps sentiment rows to CNN/AAII/CBOE/FRED | Active |
| `src/lib/aiAnalysisStore.js` | localStorage cache for **video** AI analysis | Active — not for market items |

### 1.2 Where Selected Items Are Stored

Selected items flow through `UniversalTabBulkContext` (context provider) and are managed by `UniversalTabBulkToolbar`. The black bottom `UniversalTabSelectionBar` appears when `count > 0`.

Each selected item typically carries:
```js
{
  id,        // unique row id
  text,      // display text / label
  type,      // tab scope: 'summary' | 'chapters' | 'insights' | 'useful-knowledge' | 'specialized'...
  tabScope,
  sectionLabel,
  timestamp,
}
```

Market-specific rows (Morning Brief) may additionally carry: `ticker`, `sector`, `label`, `category`, `source`, `note`.

### 1.3 Item Type Detection — Current State

| Detector | Where | Covers |
|---|---|---|
| `resolveFinvizTicker(input)` | `finvizLinks.js` | Stocks, ETFs, indices (via name/ticker), sectors (via name map), commodities (gold/silver/oil by name) |
| `getMacroIndicatorUrl(indicator)` | `macroIndicatorLinks.js` | Macro economic indicators (CPI, GDP, NFP, Fed Funds, etc.) |
| `getSentimentSourceLink(row)` | `sentimentSourceLinks.js` | Sentiment rows (Fear & Greed, VIX, COT, AAII, sector heatmap...) |

**What is missing:**
- No unified `detectMarketEntityType(item)` function.
- No `getAiAnalysisRoute(item)` that returns multi-tool link set.
- No `buildAiAnalysisPrompt(item)` for constructing type-aware AI prompts.
- No TradingView URL builder (only fallback map in `finvizLinks.js`).
- No Seeking Alpha / TipRanks link builders.
- No "נתח עם AI" button anywhere in the dashboard UI.

---

## 2. Entity Type Mapping

| Entity Type | Examples | Primary Tool | Secondary Tool | Target Format | Notes |
|---|---|---|---|---|---|
| **Stock ticker** | AAPL, NVDA, META | TradingView chart | Finviz overview + TipRanks | Fast Decision Table (RSI, MACD, scores) | Has `ticker` field; resolves via `resolveFinvizTicker` |
| **ETF** | SPY, QQQ, XLK, SMH | TradingView chart | Finviz + `buildPerplexityEtfHoldingsUrl` | Holdings analysis + trend | Already has `buildPerplexityEtfHoldingsUrl` in `finvizLinks.js` |
| **Index** | S&P 500, NASDAQ, Russell 2000 | TradingView (`TVC:SPX`, etc.) | Finviz map / Perplexity | Market regime table | Maps to ETF proxy in `_INDEX_MAP` |
| **Sector** | Technology, Financials, Semiconductors | Finviz groups | TradingView sector ETF | Relative strength table | Full map in `_SECTOR_ENTRIES` / `_HE_MAP` |
| **Commodity / Oil** | Oil, Gold, Silver, Natural Gas | TradingView + Investing.com | Perplexity macro context | Supply/demand + price trend | `macroIndicatorLinks.js` handles Oil/Gas |
| **Crypto** | BTC, ETH | TradingView (`BINANCE:BTCUSDT`) | alternative.me Fear & Greed | Price + sentiment | Handled by `_FALLBACK_URL_MAP` in `finvizLinks.js` |
| **Macro indicator** | CPI, GDP, NFP, Fed Funds | FRED page | Perplexity | Reading + market impact table | Full map in `macroIndicatorLinks.js` |
| **Economic calendar event** | FOMC, Jobs Report, ISM | FRED / ISM source | Perplexity | What happened + impact | Overlap with macro; event-specific |
| **News item** | Headline text | Google search | Perplexity | News context + affected tickers | No ticker; query built from title text |
| **Sentiment item** | Fear & Greed, COT, AAII | Source URL (CNN / CFTC / AAII) | Perplexity | Sentiment reading + market implication | Full map in `sentimentSourceLinks.js` |
| **Opportunity** | Sector rotation opportunity, breakout | Perplexity | Google Finance | Opportunity context + affected stocks | Constructed from `text` + `sectionLabel` |
| **Risk** | Fed hawkishness, credit spread widening | Perplexity | Google Finance | Risk context + sector impact | Constructed from `text` + `sectionLabel` |

---

## 3. Recommended Tool Routing

### 3.1 Stocks / ETFs

**Primary tools (in priority order):**

1. **TradingView** — chart with technical indicators
   - URL: `https://www.tradingview.com/chart/?symbol={SYMBOL}`
2. **Finviz** — quick overview and screener
   - URL: `https://finviz.com/quote.ashx?t={SYMBOL}`
   - Already resolved by `getFinvizUrl(input)` in `finvizLinks.js`
3. **Seeking Alpha** — fundamentals and analyst sentiment
   - URL: `https://seekingalpha.com/symbol/{SYMBOL}`
4. **TipRanks** — analyst score and price target consensus
   - URL: `https://www.tipranks.com/stocks/{symbolLower}`
5. **Perplexity** — current news and validation
   - URL: `https://www.perplexity.ai/search?q={encodedPrompt}`

**Required fast-analysis output (Decision Table):**

Technical:
- RSI (14)
- MACD (signal / histogram)
- Bollinger Bands (position)
- EMA 20 / 50 / 200
- Volume / Relative Volume
- Trend score (0–100)
- Momentum score (0–100)
- Support / Resistance levels

Fundamental:
- Valuation (P/E, P/S)
- Revenue growth
- Profitability (margins)
- Debt / balance sheet risk
- Analyst sentiment (Buy/Hold/Sell ratio)

Output:
- Key catalyst
- Key risk
- **Overall decision score 0–100**

---

### 3.2 Oil / Commodities

**Primary tools:**

1. **TradingView** — `https://www.tradingview.com/chart/?symbol=TVC:USOIL` (WTI) or `COMEX:GC1!` (Gold)
2. **Investing.com** — already in `macroIndicatorLinks.js` for crude/gas
3. **Perplexity** — macro context and supply/demand drivers

**Required fast-analysis output:**

- Price trend (bullish / bearish / neutral)
- RSI
- MACD
- Bollinger Bands
- Support / Resistance
- Supply / demand drivers
- Inflation impact
- Geopolitical risk level
- Sector impact (energy sector ETF: XLE)
- Key catalyst
- Key risk
- **Overall score 0–100**

---

### 3.3 Indices

**Primary tools:**

1. **TradingView** — `https://www.tradingview.com/chart/?symbol=TVC:SPX` / `TVC:NDX` / `TVC:RUT`
2. **Finviz heatmap** — `https://finviz.com/map.ashx` (for S&P 500)
3. **Perplexity** — market regime context

**Required fast-analysis output:**

- Trend direction
- Breadth (advance/decline)
- RSI
- Moving averages (50 / 200)
- Sector leadership
- Risk-on / risk-off status
- VIX level and implication
- Key support / resistance
- **Overall market score 0–100**

---

### 3.4 Sectors

**Primary tools:**

1. **Finviz groups** — `https://finviz.com/groups.ashx`
2. **TradingView** — sector ETF (resolved via `resolveSectorMeta()` in `finvizLinks.js`)
3. **Perplexity** — sector rotation context

**Required fast-analysis output:**

- Relative strength vs. S&P 500
- Momentum (weekly / monthly)
- ETF proxy (from `_SECTOR_ENTRIES` map)
- Top 3 leading stocks in sector
- Valuation pressure
- Earnings trend
- Macro sensitivity
- Key catalyst
- Key risk
- **Sector score 0–100**

---

### 3.5 Macro / Economic Events

**Primary tools:**

1. **FRED** — authoritative data page (resolved via `getMacroIndicatorUrl()`)
2. **Perplexity** — "what does this reading mean for markets"
3. **Google** — search by event name + "market impact"

**Required fast-analysis output:**

- What was announced / released
- Expected vs. actual (if event)
- Surprise direction (beat / miss / in-line)
- Affected sectors (bulleted list)
- Affected stocks / ETFs to watch
- Inflation impact
- Rates / Fed implications
- Risk level (low / medium / high)
- Confidence level
- What to watch next

---

## 4. AI Prompt Templates

### Stock / ETF
```
Analyze {SYMBOL} for a fast swing-trading decision. Return a compact table only.
Include: RSI, MACD, Bollinger Bands, EMA 20/50/200, volume/relative volume,
support/resistance, trend score, momentum score, valuation, growth, profitability,
debt/balance-sheet risk, analyst sentiment, key catalyst, key risk,
and an overall score from 0 to 100.
Keep the explanation short and decision-oriented.
```

### Commodity / Oil
```
Analyze {COMMODITY} for a fast market decision. Return a compact table only.
Include: trend, RSI, MACD, Bollinger Bands, support/resistance,
supply-demand drivers, inflation impact, geopolitical risk, affected sectors,
key catalyst, key risk, and an overall score from 0 to 100.
Keep it short and visual.
```

### Index
```
Analyze {INDEX} as a market-regime signal. Return a compact table only.
Include: trend, RSI, moving averages, breadth, sector leadership,
risk-on/risk-off status, volatility risk, key support/resistance,
and overall market score from 0 to 100.
```

### Sector
```
Analyze {SECTOR} for sector-rotation strength. Return a compact table only.
Include: relative strength, momentum, leading ETF, leading stocks,
valuation pressure, earnings trend, macro sensitivity,
key catalyst, key risk, and sector score from 0 to 100.
```

### Macro / Economic Event
```
Analyze {EVENT_OR_INDICATOR} and explain the market impact.
Return a compact table with: current reading, expectation, surprise direction,
affected sectors, affected stocks/ETFs, inflation impact, rates impact,
risk level, confidence level, and what to watch next.
```

### News / Opportunity / Risk (fallback)
```
Research: {TITLE}. Provide context, market implications, relevant tickers,
risks, and what to monitor. Keep it brief and decision-oriented.
```

---

## 5. Link Templates

These are URL patterns only — not yet implemented.

| Tool | URL Template | Notes |
|---|---|---|
| Finviz stock | `https://finviz.com/quote.ashx?t={SYMBOL}` | Already in `getFinvizUrl()` |
| Finviz groups | `https://finviz.com/groups.ashx` | For sectors |
| Finviz map | `https://finviz.com/map.ashx` | For market heatmap |
| TradingView (symbol) | `https://www.tradingview.com/chart/?symbol={SYMBOL}` | Works for stocks, ETFs, indices with prefix |
| TradingView (DXY) | `https://www.tradingview.com/chart/?symbol=TVC:DXY` | Already in `_FALLBACK_URL_MAP` |
| TradingView (WTI Oil) | `https://www.tradingview.com/chart/?symbol=TVC:USOIL` | New — needs adding |
| TradingView (Gold) | `https://www.tradingview.com/chart/?symbol=COMEX:GC1!` | New — needs adding |
| TradingView (S&P 500) | `https://www.tradingview.com/chart/?symbol=TVC:SPX` | New — needs adding |
| TradingView (NASDAQ) | `https://www.tradingview.com/chart/?symbol=TVC:NDX` | New — needs adding |
| Seeking Alpha | `https://seekingalpha.com/symbol/{SYMBOL}` | New — needs helper |
| TipRanks | `https://www.tipranks.com/stocks/{symbolLower}` | New — needs helper |
| Perplexity (search) | `https://www.perplexity.ai/search?q={encodedQuery}` | Already used in `buildPerplexityEtfHoldingsUrl()` |
| FRED | `https://fred.stlouisfed.org/series/{SERIES_ID}` | Already in `macroIndicatorLinks.js` |
| Investing.com commodity | `https://www.investing.com/commodities/{slug}` | Already in `macroIndicatorLinks.js` |
| Google Finance | `https://www.google.com/finance/` (copy query) | Already in `openGoogleFinance()` |

---

## 6. Proposed UX

### Flow: User Clicks "נתח עם AI"

```
1. User clicks "נתח עם AI" on any market row / item
     │
2. App calls detectMarketEntityType(item)
     │
3. Returns entity type: stock | etf | index | sector | commodity |
                         crypto | macro | event | news | sentiment |
                         opportunity | risk
     │
4. App calls getAiAnalysisRoute(item, entityType)
     │
5. Returns { primaryUrl, links: [...], prompt }
     │
6. Small AI analysis drawer / popover opens, showing:
     ┌─────────────────────────────────────────────────┐
     │  📊 נתח — {ITEM_LABEL}                          │
     │─────────────────────────────────────────────────│
     │  🔗 פתח ב-TradingView                           │
     │  🔗 פתח ב-Finviz                                │
     │  🔗 פתח ב-Seeking Alpha / TipRanks              │
     │  🔍 פתח ב-Perplexity עם שאילתה מוכנה            │
     │  📋 העתק פרומפט AI לניתוח                       │
     │─────────────────────────────────────────────────│
     │  📌 פורמט יעד: טבלת החלטה מהירה                 │
     └─────────────────────────────────────────────────┘
```

### Integration Point: Black Bottom Toolbar (Recommended)

Since `UniversalTabSelectionBar.jsx` is the single active action system:

```
Add to UniversalTabSelectionBar:
  🔍 נתח עם AI   (emerald button, only when 1 item selected OR always active)
```

This is **lower risk** than rebuilding the disabled three-dots menu.  
The button calls `getAiAnalysisRoute(selectedItems[0])` and opens the analysis menu.

---

## 7. Implementation Strategy (For Later)

### New helpers to create

**`src/lib/detectMarketEntityType.js`**
```js
// Returns: 'stock' | 'etf' | 'index' | 'sector' | 'commodity' | 
//          'crypto' | 'macro' | 'event' | 'news' | 'sentiment' | 
//          'opportunity' | 'risk' | 'unknown'
export function detectMarketEntityType(item) { ... }
```

Detection logic (in priority order):
1. If `item.type` already hints entity type → use it
2. If `item.ticker` is set → check known ETF list → `etf` or `stock`
3. If `item.label` / `item.text` matches `macroIndicatorLinks.js` aliases → `macro`
4. If `item.label` / `item.text` matches `sentimentSourceLinks.js` aliases → `sentiment`
5. If `resolveFinvizTicker(item.text)` returns a sector ETF → `sector`
6. If `item.category === 'index'` or matches `_INDEX_MAP` → `index`
7. If matches commodity aliases (oil, gold, etc.) → `commodity`
8. If `item.sectionLabel` includes 'הזדמנות' → `opportunity`
9. If `item.sectionLabel` includes 'סיכון' → `risk`
10. Default → `news` (fallback — open Google search)

---

**`src/lib/getAiAnalysisRoute.js`**
```js
// Returns: { entityType, label, links: [{label, url, icon}], prompt }
export function getAiAnalysisRoute(item) { ... }
```

---

**`src/lib/buildAiAnalysisPrompt.js`**
```js
// Returns: string — ready-to-use AI prompt
export function buildAiAnalysisPrompt(item, entityType) { ... }
```

---

**`src/lib/aiAnalysisToolRouting.js`** (config file)
```js
// Mapping of entityType → { primaryTool, tools: [...], promptTemplate }
export const AI_ANALYSIS_TOOL_ROUTING = { ... }
```

---

### Files that need small changes later

| File | Change |
|---|---|
| `src/components/shared/UniversalTabSelectionBar.jsx` | Add "נתח עם AI" button (one button, opens analysis menu) |
| `src/utils/finvizLinks.js` | Add `buildTradingViewUrl(symbol)` helper for direct chart links |
| `src/lib/macroIndicatorLinks.js` | Possibly expose entity type field per indicator entry |

### Files that stay unchanged

| File | Why |
|---|---|
| `src/components/shared/UniversalTabQuickSaveActions.jsx` | Three-dots menu remains disabled per SELECTION_TOOLBAR_WORKFLOW.md |
| `src/components/shared/ResearchDropdown.jsx` | Already works for Perplexity + Google Finance — don't touch |
| `src/utils/finvizLinks.js` (core logic) | Don't break existing `resolveFinvizTicker` or `getFinvizUrl` |

---

## 8. Safety / Rollback

- **Additive only** — add new helpers and a new toolbar button. Nothing is removed.
- **Do not modify** `resolveFinvizTicker`, `getFinvizUrl`, `getMacroIndicatorUrl`, or `getSentimentSourceLink`.
- **Do not revive** the three-dots menu (`compact` branch in `UniversalTabQuickSaveActions.jsx`).
- **Do not break** checkbox selection behavior.
- **Do not change** Brain / Obsidian / Workspace / Copy toolbar actions.
- **Start with one entity type** — recommend starting with stocks (`resolveFinvizTicker` + TradingView URL), then expand.
- Each new helper is independently testable — no cross-module risk.

---

## 9. Recommended First Implementation Step

1. Create `src/lib/detectMarketEntityType.js` — pure function, no UI.
2. Add `buildTradingViewUrl(symbol)` to `src/utils/finvizLinks.js`.
3. Create `src/lib/buildAiAnalysisPrompt.js` — pure function, returns string.
4. Add "נתח עם AI" button to `UniversalTabSelectionBar.jsx` — single button, opens a simple popover with 2–3 links + "העתק פרומפט".
5. Test with one stock ticker.
6. Expand to ETF, sector, macro.

---

## 10. Verification Plan

- No build required for this planning document.
- After any code implementation: run `npm run build` — must pass with no errors.
- Manual QA: click "נתח עם AI" on one stock row → verify correct links open → verify existing actions (Brain, Obsidian, Workspace, Copy) still work.

---

## 11. Suggested Commit Message (when ready)

```
feat: add AI analysis link routing helpers (detectMarketEntityType, buildAiAnalysisPrompt)

Adds entity type detection and prompt builder for market items.
Extends UniversalTabSelectionBar with "נתח עם AI" action.
No existing links, toolbar actions, or selection behavior changed.
```

---

*Planning document — no implementation yet. Requires explicit approval before any code changes.*
