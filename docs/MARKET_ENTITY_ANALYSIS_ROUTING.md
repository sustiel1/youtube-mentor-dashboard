# Market Entity Analysis Routing

**Status:** Active  
**Last Updated:** 2026-06-29  
**Related:** [PERPLEXITY_AI_ANALYSIS_WORKFLOW.md](PERPLEXITY_AI_ANALYSIS_WORKFLOW.md) · [SELECTION_TOOLBAR_WORKFLOW.md](SELECTION_TOOLBAR_WORKFLOW.md)

---

## 1. Purpose

Selected dashboard rows can represent different market entity types. The black bottom selection toolbar routes each selected item to the correct analysis destination based on its entity type.

Entity types supported:

| Type | Description |
|---|---|
| `stock` | Individual equity (MSFT, AAPL, NVDA, JPM…) |
| `etf` | Exchange-traded fund (SPY, QQQ, XLK, GLD…) |
| `index` | Market index (NASDAQ, S&P 500, RUSSELL 2000, DAX…) |
| `commodity` | Physical commodity (Gold, Oil, Gas, Silver, Copper) |
| `crypto` | Cryptocurrency (BTC, ETH, CRYPTO) |
| `macro` | Macro driver (PCE Inflation, Interest Rates, DXY, VIX) |
| `sector` | Sector ETF proxy (Technology, Healthcare, Financials…) |
| `sentiment` | Market sentiment signal (סנטימנט כללי, Risk-On/Off…) |
| `unknown` | Unrecognized item — falls back to stock prompt |

---

## 2. Entity Detection

**File:** `src/lib/detectMarketEntityType.js`  
**Function:** `detectMarketEntityType(item)`

### Fields Inspected

| Field | Used for |
|---|---|
| `item.type` | Primary type signal: `'stocks-mentioned'`, `'indices'`, `'brief-macro'`, `'brief-sentiment'` |
| `item.sectionLabel` | Hebrew label of the tab section: `'מניות'`, `'שווקים'`, `'מאקרו'`, `'סנטימנט'` |
| `item.text` | Morning Brief row text (used for ticker/name extraction) |

### Detection Logic

```
if type === 'stocks-mentioned' OR sectionLabel includes 'מניות':
  extract ticker from text (first segment split by ' · ')
  if ticker is in _ETF_TICKERS set → return 'etf'
  else → return 'stock'

if type === 'brief-macro' OR sectionLabel includes 'מאקרו' → return 'macro'

if type === 'brief-sentiment' OR sectionLabel includes 'סנטימנט' → return 'sentiment'

if type === 'indices' OR sectionLabel includes 'שווקים':
  extract asset name → resolve TradingView symbol via lookupTradingViewSymbol()
  if symbol starts with 'BITSTAMP:' → return 'crypto'
  if symbol is in _COMMODITY_TV set → return 'commodity'
  if symbol is in _MACRO_TV set → return 'macro'
  if symbol is in _SECTOR_TV set → return 'sector'
  else → return 'index'

fallback: try to extract ticker from text
  if ticker in _ETF_TICKERS → return 'etf'
  if ticker in finviz → return 'stock'

→ return 'unknown'
```

### Classification Sets

```js
// ETFs — sub-classifies stock-section rows
_ETF_TICKERS: SPY, IWM, DIA, GLD, SLV, USO, QQQ, TLT, SMH,
              XLK, XLF, XLE, XLV, XLI, XLB, XLU, XLY, XLP, XLC, XLRE,
              XBI, XRT, XHB, VNQ, JETS, TAN, ITA, KRE, IGV

// Commodities — TV symbol matches
_COMMODITY_TV: TVC:USOIL, TVC:UKOIL, TVC:NATGAS, TVC:GOLD, TVC:SILVER, COMEX:HG1!

// Macro proxies — TV symbol matches
_MACRO_TV: TVC:US10Y, TVC:DXY, TVC:VIX

// Sector ETF proxies — TV symbol matches
_SECTOR_TV: AMEX:XLK, AMEX:XLV, AMEX:XLF, AMEX:XLE, AMEX:XLU, AMEX:XLRE,
            AMEX:XHB, AMEX:XBI, AMEX:XLI, AMEX:XLB, AMEX:XLY, AMEX:XLP,
            AMEX:XLC, AMEX:IWM, NASDAQ:SMH, NASDAQ:QQQ, AMEX:VNQ, AMEX:KRE,
            AMEX:XRT, AMEX:TAN, AMEX:JETS, AMEX:IGV
```

### Label Extraction

`extractIndexNameFromItem(item)` — used for all entity types:

1. Tries structured fields in order: `symbol`, `ticker`, `name`, `title`, `label`, `asset`, `index`, `market`
2. Falls back to first segment of `text` split by ` · ` (Morning Brief format)

Examples:
- `"CRUDE OIL / FUEL · bearish · strong"` → `"CRUDE OIL / FUEL"`
- `"AAPL · Apple Inc. · context"` → `"AAPL"`
- `"סנטימנט כללי · bearish"` → `"סנטימנט כללי"`

---

## 3. TradingView Routing

**File:** `src/utils/finvizLinks.js`  
**Function:** `buildTradingViewChartUrl(symbolOrName)`  
**Handler:** `handleOpenTradingView` in `src/components/dashboard/VideoDetailPanel.jsx`

### Base Chart URL

```
https://il.tradingview.com/chart/54fxnDLz/
```

With symbol: `...?symbol=NASDAQ%3AMSFT`

### Stocks — Exchange-Qualified Symbols

Ticker → exchange prefix from `_TV_EXCHANGE_MAP`:

| Exchange | Examples |
|---|---|
| `NASDAQ:` | MSFT, AAPL, NVDA, TSLA, GOOGL, META, AMZN, QQQ, SMH |
| `NYSE:` | JPM, BAC, V, MA, XOM, NKE, WMT, ORCL |
| `AMEX:` | SPY, IWM, GLD, XLK, XLF, XLE, XBI, XRT, VNQ |

### Non-Stock Rows — Alias Map

Asset name → TradingView symbol from `_TV_ALIAS_MAP` (~130 entries):

| Asset name | TradingView symbol |
|---|---|
| `MSFT` | `NASDAQ:MSFT` |
| `RUSSELL 2000` | `TVC:RUT` |
| `S&P 500` | `SP:SPX` |
| `NASDAQ` | `NASDAQ:IXIC` |
| `DOW JONES` | `DJ:DJI` |
| `NIKKEI` | `TVC:NI225` |
| `DAX` | `XETR:DAX` |
| `CRUDE OIL / FUEL` | `TVC:USOIL` |
| `GOLD` | `TVC:GOLD` |
| `SILVER` | `TVC:SILVER` |
| `NATURAL GAS` | `TVC:NATGAS` |
| `BITCOIN` | `BITSTAMP:BTCUSD` |
| `ETHEREUM` | `BITSTAMP:ETHUSD` |
| `PCE INFLATION` | `TVC:US10Y` |
| `INTEREST RATES` | `TVC:US10Y` |
| `DXY` | `TVC:DXY` |
| `VIX` | `TVC:VIX` |
| `TECHNOLOGY / טכנולוגיה` | `AMEX:XLK` |
| `US HOUSING MARKET` | `AMEX:XHB` |

---

## 4. Perplexity Routing

**File:** `src/lib/buildStockAiPrompt.js`  
**Function:** `buildPerplexityAnalysisPrompt(selectedItems)`  
**Handler:** `handleOpenPerplexity` in `src/components/dashboard/VideoDetailPanel.jsx`

### Perplexity Space URL

```
https://www.perplexity.ai/spaces/stock-fast-decision-oOhCJwdnQKqXFNhAt5CVVw
```

### Entity Type → Prompt Builder

| Entity type | Prompt builder | Chart request |
|---|---|---|
| `stock` | `_stockEtfPrompt(label, false)` | `"הצג את גרף המחיר / כרטיס ציטוט של {LABEL} אם זמין."` |
| `etf` | `_stockEtfPrompt(label, true)` | Same as stock |
| `index` | `_indexPrompt(label)` | Same as stock |
| `commodity` | `_commodityPrompt(label)` | Same as stock |
| `crypto` | `_cryptoPrompt(label)` | Same as stock |
| `macro` | `_macroPrompt(label)` | `"הצג גרף פרוקסי רלוונטי של {LABEL} אם זמין. אם אין גרף ישיר — השתמש בפרוקסי השוק הטוב ביותר."` |
| `sector` | `_sectorPrompt(label)` | `"הצג את גרף המחיר / כרטיס ציטוט של קרן ה-{LABEL} אם זמין."` |
| `sentiment` | `_sentimentPrompt(label)` | `"הצג גרף פרוקסי שוק של {LABEL} אם זמין. לסנטימנט כללי — S&P 500 או VIX. לסנטימנט קריפטו — Bitcoin."` |
| `unknown` | `_stockEtfPrompt(label, false)` | Same as stock |
| multiple items | `_multiPrompt(items)` | Requests chart of first item only |

### Prompt Sections per Entity Type

| Entity | Sections |
|---|---|
| stock / etf | החלטה מהירה · טכני (RSI/MACD/BB/EMA) · פנדמנטלי (P/E/PEG/ROE) · סיכונים וקטליזטורים · ציון כולל |
| index | החלטה מהירה · טכני · רוחב שוק וסקטורים · מאקרו וסיכונים · מצב השוק |
| commodity | החלטה מהירה · טכני · היצע/ביקוש/מאקרו · סיכונים וקטליזטורים · ציון סחורה |
| crypto | החלטה מהירה · טכני · סנטימנט ונזילות · סיכונים וקטליזטורים · ציון קריפטו |
| macro | החלטה מהירה · נתון מאקרו · השפעה על שווקים · סיכונים וקטליזטורים · ציון השפעה כוללת |
| sector | החלטה מהירה · טכני · רוטציה וסקטור · סיכונים וקטליזטורים · ציון סקטור |
| sentiment | החלטה מהירה · סנטימנט (Fear/Greed/VIX) · השפעה על נכסים · סיכונים וקטליזטורים · ציון סנטימנט |
| multi | טבלת השוואה: נכס / סוג / מצב / 🔴🟡🟢 / ציון / מה לבדוק |

---

## 5. Prompt Output Rules

Every Perplexity prompt enforces:

- **Language:** Hebrew only (`ענה אך ורק בעברית`)
- **Format:** RTL tables only (`טבלאות RTL בלבד. אל תסביר — רק טבלאות`)
- **Color status:** Every row must include one of:

| Code | Meaning |
|---|---|
| 🟢 | חיובי — positive signal |
| 🟡 | ניטרלי — neutral / watch |
| 🔴 | שלילי — negative / risk |

- **Table columns:** `| פרמטר | נתון | 🔴🟡🟢 | פירוש קצר | ציון |`
- **Score:** 0–100 per section + overall
- **Decision column:** `מעקב / המתנה / להימנע / כניסה מעל טריגר`
- **Brevity:** `תובנות עד 12 מילים. סיוע להחלטה בלבד.`
- **Sources:** `ציין מקורות`
- **Chart request:** Every prompt opens with a chart/quote card request (known limitation: Perplexity does not always show it)

---

## 6. QA Checklist

Manual verification cases after Pull to Base44 Production:

| # | Selection | Expected TV symbol | Expected Perplexity prompt type |
|---|---|---|---|
| 1 | MSFT (stocks section) | `NASDAQ:MSFT` | stock |
| 2 | SPY (stocks section) | `AMEX:SPY` | etf |
| 3 | RUSSELL 2000 (שווקים) | `TVC:RUT` | index |
| 4 | S&P 500 (שווקים) | `SP:SPX` | index |
| 5 | CRUDE OIL / FUEL (שווקים) | `TVC:USOIL` | commodity |
| 6 | GOLD (שווקים) | `TVC:GOLD` | commodity |
| 7 | BITCOIN (שווקים) | `BITSTAMP:BTCUSD` | crypto |
| 8 | PCE INFLATION (מאקרו tab) | `TVC:US10Y` | macro |
| 9 | VIX (שווקים) | `TVC:VIX` | macro (sub-classified via `_MACRO_TV`) |
| 10 | US HOUSING MARKET (שווקים) | `AMEX:XHB` | sector (sub-classified via `_SECTOR_TV`) |
| 11 | TECHNOLOGY / טכנולוגיה (שווקים) | `AMEX:XLK` | sector |
| 12 | סנטימנט כללי (סנטימנט tab) | — (no TV chart, toast shows) | sentiment |
| 13 | MSFT + SPY (2 items) | — (multi) | multi-item comparison table |

**Verify per test:**
- [ ] TradingView opens correct symbol URL (or shows correct fallback toast)
- [ ] Perplexity Space opens
- [ ] Clipboard contains correct prompt type (paste to verify)
- [ ] Prompt language is Hebrew
- [ ] Prompt contains chart/quote card request
- [ ] Prompt contains correct sections for entity type

---

## 7. Safety Rules

| Rule | Reason |
|---|---|
| Do NOT revive the three-dots menu | Intentionally disabled — see `SELECTION_TOOLBAR_WORKFLOW.md` |
| Do NOT break the black bottom toolbar | `UniversalTabSelectionBar` must keep all buttons: Brain / Obsidian / Workspace / Copy / TradingView / Perplexity |
| Do NOT break Brain / Obsidian / Workspace / Copy | These four are independent of entity routing — must stay unchanged |
| Do NOT replace TradingView with Perplexity | The two buttons are independent: TradingView = chart, Perplexity = analysis prompt |
| Do NOT call Perplexity API | Prompt is clipboard-only — no direct API integration |
| Do NOT break `PERPLEXITY_SPACE_URL` | Legacy export — used by other callers |
| Do NOT change TradingView routing | Entity-aware TV routing is already complete and stable |
| Do NOT delete files | Per global CLAUDE.md |
| Do NOT commit without approval | Per project workflow |
| Do NOT run `git reset / rebase / revert / clean / push --force` | Destructive — requires explicit approval |

---

## Implementation Files

| File | Role |
|---|---|
| `src/lib/detectMarketEntityType.js` | `detectMarketEntityType()`, `extractTickerFromItem()`, `extractIndexNameFromItem()` |
| `src/lib/buildStockAiPrompt.js` | `buildPerplexityAnalysisPrompt()`, `PERPLEXITY_SPACE_URL` |
| `src/utils/finvizLinks.js` | `buildTradingViewChartUrl()`, `lookupTradingViewSymbol()`, `_TV_ALIAS_MAP` |
| `src/components/shared/UniversalTabSelectionBar.jsx` | Toolbar buttons: `onAiAnalyze` (TV), `onPerplexity` (AI) |
| `src/components/dashboard/VideoDetailPanel.jsx` | Handlers: `handleOpenTradingView`, `handleOpenPerplexity` |
