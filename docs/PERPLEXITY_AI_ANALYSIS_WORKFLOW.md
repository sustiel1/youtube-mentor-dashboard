# Perplexity AI Analysis Workflow

**Status:** Active  
**Last Updated:** 2026-06-29  
**Related:** [AI_ANALYSIS_LINK_ROUTING_PLAN.md](AI_ANALYSIS_LINK_ROUTING_PLAN.md) · [SELECTION_TOOLBAR_WORKFLOW.md](SELECTION_TOOLBAR_WORKFLOW.md)

---

## Overview

The black bottom selection toolbar provides two analysis actions for selected market items:

| Button | Color | Action |
|---|---|---|
| `📈 TradingView` | Emerald | Opens the user's personal TradingView chart for the selected ticker |
| `🤖 נתח עם AI` | Teal | Copies a structured Hebrew analysis prompt + opens Perplexity Space |

---

## Black Bottom Toolbar — Full Button Set

When one or more items are selected via checkbox, the toolbar appears:

```
✕ נקה   |   נבחרו X פריטים   🧠 שמור למוח   🔮 Obsidian   ⭐ Workspace   📋 העתק   📈 TradingView   🤖 נתח עם AI
```

| Button | Behavior |
|---|---|
| `✕ נקה` | Clears selection |
| `🧠 שמור למוח` | Saves selected items to Brain |
| `🔮 Obsidian` | Saves selected items to Obsidian vault |
| `⭐ Workspace` | Saves selected items to Workspace |
| `📋 העתק` | Copies selected items as text |
| `📈 TradingView` | Opens TradingView chart (stocks, indices, commodities, crypto, sectors, macro, sentiment) |
| `🤖 נתח עם AI` | Copies AI prompt + opens Perplexity Space (any item type) |

---

## TradingView Button

**Trigger:** Any selected asset row — stock, ETF, market index, commodity, crypto, macro driver, sector, or sentiment signal.

**Behavior:**
1. Detects entity type via `detectMarketEntityType(item)` in `src/lib/detectMarketEntityType.js`.
2. Extracts ticker via `extractTickerFromItem(item)`.
3. Opens the user's personal TradingView chart with exchange-qualified symbol.
4. Shows toast: `"📈 TICKER — נפתח ב-TradingView"`

**Base chart URL:**
```
https://il.tradingview.com/chart/54fxnDLz/
```

**With symbol (example: MSFT):**
```
https://il.tradingview.com/chart/54fxnDLz/?symbol=NASDAQ%3AMSFT
```

**Exchange qualification:** Handled by `buildTradingViewChartUrl(symbol)` in `src/utils/finvizLinks.js`.

| Exchange | Examples |
|---|---|
| `NASDAQ:` | MSFT, AAPL, NVDA, TSLA, GOOGL, META, AMZN, QQQ, SMH... |
| `NYSE:` | JPM, BAC, V, MA, XOM, NKE, WMT, ORCL, BABA... |
| `AMEX:` | SPY, IWM, GLD, XLK, XLF, XLE, XBI, XRT, VNQ... |
| Special | BTC → `BITSTAMP:BTCUSD`, DXY → `TVC:DXY`, VIX → `TVC:VIX` |

**Non-stock / non-index fallback:** Toast: `"TradingView זמין למניות ומדדי שוק — בחר שורת מניה מ"מניות שהוזכרו" או שורה מ"שווקים""`

---

## TradingView Market / Index Routing

Market index rows (from the **שווקים** tab) are also supported. The entity type is detected as `'index'` when:
- `item.type === 'indices'`, or
- `item.sectionLabel` contains `'שווקים'`

**Asset name extraction** — `extractIndexNameFromItem(item)` in `detectMarketEntityType.js`:
1. Tries structured fields in order: `symbol`, `ticker`, `name`, `title`, `label`, `asset`, `index`, `market`
2. Falls back to first segment of `text` split by ` · ` (Morning Brief format: `"NASDAQ · bullish · strong · [comment]"`)

**Index → TradingView symbol map** (`_TV_INDEX_MAP` in `finvizLinks.js`):

| Asset name | TradingView symbol |
|---|---|
| `NASDAQ` | `NASDAQ:IXIC` |
| `NASDAQ COMPOSITE` | `NASDAQ:IXIC` |
| `NASDAQ 100` | `NASDAQ:NDX` |
| `S&P 500` | `SP:SPX` |
| `SP500` | `SP:SPX` |
| `DOW JONES` | `DJ:DJI` |
| `DOW` | `DJ:DJI` |
| `RUSSELL 2000` | `TVC:RUT` |
| `RUSSELL` | `TVC:RUT` |
| `KOSPI` | `KRX:KOSPI` |
| `SOUTH KOREAN KOSPI` | `KRX:KOSPI` |
| `NIKKEI` | `TVC:NI225` |
| `HANG SENG` | `TVC:HSI` |
| `DAX` | `XETR:DAX` |
| `FTSE 100` | `TVC:UKX` |
| `BITCOIN` / `BTC` | `BITSTAMP:BTCUSD` (via `_TV_SPECIAL_MAP`) |

**Debug:** When an index row is opened, `console.debug('[TradingView] market index item:', ...)` logs the raw item structure for verification.

**URL examples:**

| Selection | Opens |
|---|---|
| RUSSELL 2000 | `...?symbol=TVC%3ARUT` |
| S&P 500 | `...?symbol=SP%3ASPX` |
| DOW JONES | `...?symbol=DJ%3ADJI` |
| BITCOIN | `...?symbol=BITSTAMP%3ABTCUSD` |
| MSFT (stock) | `...?symbol=NASDAQ%3AMSFT` |

---

## Perplexity AI Analysis Button

**Trigger:** Any selected item (stock, sector, macro, news, sentiment, opportunity, risk).

**Perplexity Space URL:**
```
https://www.perplexity.ai/spaces/stock-fast-decision-oOhCJwdnQKqXFNhAt5CVVw
```

**Behavior on click:**
1. Builds analysis prompt via `buildPerplexityAnalysisPrompt(selectedItems)` in `src/lib/buildStockAiPrompt.js`.
2. Copies prompt to clipboard (fire-and-forget — no permission dialog).
3. Shows toast: `"הפרומפט הועתק. הדבק אותו ב-Perplexity ולחץ Enter. 🤖"` (5 seconds).
4. Opens Perplexity Space in a new tab.

**User flow:**
```
1. בחר מניה / נכס בצ'קבוקס
2. לחץ "🤖 נתח עם AI"
3. Space נפתח ב-Perplexity
4. Ctrl+V / ⌘V → הדבק
5. Enter → ניתוח מתחיל
```

---

## Prompt Format — Single Item

```
נתח את {TICKER_OR_LABEL}

ענה אך ורק בעברית. טבלאות RTL בלבד. אל תסביר — רק טבלאות.
כל שורה חייבת לכלול סטטוס צבע: 🟢 חיובי / 🟡 ניטרלי / 🔴 שלילי

## 1. החלטה מהירה
| פרמטר | נתון | 🔴🟡🟢 | פירוש קצר | ציון |

## 2. טכני
| פרמטר | נתון | 🔴🟡🟢 | פירוש קצר | ציון |
כלול: RSI, MACD, Bollinger Bands, EMA 20/50/200, נפח, תמיכה/התנגדות

## 3. פנדמנטלי
| פרמטר | נתון | 🔴🟡🟢 | פירוש קצר | ציון |
כלול: P/E, צמיחה, מרווחים, חוב, המלצות אנליסטים

## 4. סיכונים וקטליזטורים
| גורם | פרטים | 🔴🟡🟢 | השפעה |

## ציון כולל
| ציון (0-100) | החלטה |
| --- | קנה / מעקב / הימנע |

ציין מקורות. תובנות קצרות בלבד. אין הסברים ארוכים.
```

## Prompt Format — Multiple Items

```
נתח את הנכסים הבאים:
- {ITEM_1}
- {ITEM_2}
- ...

לכל נכס החזר טבלאות החלטה נפרדות.
[same table instructions as above]
```

---

## Required Analysis Sections

| Section | Content |
|---|---|
| **1. החלטה מהירה** | Summary row with top 3–5 key signals |
| **2. טכני** | RSI, MACD, Bollinger Bands, EMA 20/50/200, volume, support/resistance |
| **3. פנדמנטלי** | P/E, growth, margins, debt, analyst ratings |
| **4. סיכונים וקטליזטורים** | Key upside catalysts and downside risks |
| **ציון כולל** | 0–100 score + Buy / Watch / Avoid decision |

## Color Status Requirement

Every table row must include one of:

| Code | Meaning |
|---|---|
| 🟢 | חיובי — positive signal |
| 🟡 | ניטרלי — neutral / watch |
| 🔴 | שלילי — negative / risk |

---

## Implementation Files

| File | Role |
|---|---|
| `src/lib/buildStockAiPrompt.js` | `buildPerplexityAnalysisPrompt()`, `PERPLEXITY_SPACE_URL` |
| `src/lib/detectMarketEntityType.js` | `detectMarketEntityType()`, `extractTickerFromItem()` |
| `src/utils/finvizLinks.js` | `buildTradingViewChartUrl()` |
| `src/components/shared/UniversalTabSelectionBar.jsx` | Toolbar buttons: `onAiAnalyze` (TV), `onPerplexity` (AI) |
| `src/components/dashboard/VideoDetailPanel.jsx` | Handlers: `handleOpenTradingView`, `handleOpenPerplexity` |

---

## Safety Rules

- **Do not replace TradingView** — the two buttons are independent actions.
- **Do not revive the three-dots menu** — it is intentionally disabled (see `SELECTION_TOOLBAR_WORKFLOW.md`).
- **Do not break Brain / Obsidian / Workspace / Copy** — all four remain unchanged.
- **Do not call Perplexity API** — prompt is clipboard-only, no direct API integration.
- **Keep this additive** — new buttons only. No existing action removed.

---

## TradingView Coverage Summary

TradingView now supports market indices, commodities, crypto, macro proxies and sector proxies from selected dashboard rows (in addition to stocks).

| Category | Examples | Resolved to |
|---|---|---|
| Stocks | MSFT, AAPL, NVDA | NASDAQ:MSFT etc. |
| ETFs | SPY, QQQ, IWM, XBI | AMEX/NASDAQ:* |
| US Indices | NASDAQ, S&P 500, DOW JONES, RUSSELL 2000 | NASDAQ:IXIC, SP:SPX… |
| Global Indices | KOSPI, NIKKEI, HANG SENG, DAX, FTSE | KRX/TVC/XETR:* |
| Crypto | BITCOIN, BTC, CRYPTO, ETHEREUM, ETH | BITSTAMP:BTCUSD/ETHUSD |
| Gold / Silver | GOLD, זהב, SILVER, כסף | TVC:GOLD, TVC:SILVER |
| Oil | CRUDE OIL, OIL, FUEL, נפט גולמי / דלק | TVC:USOIL |
| Other Commodities | NATURAL GAS, COPPER, גז טבעי | TVC:NATGAS, COMEX:HG1! |
| Macro / Rates | PCE INFLATION, INFLATION, INTEREST RATES, FED FUNDS | TVC:US10Y |
| Dollar | DXY, US DOLLAR | TVC:DXY |
| VIX | VIX, RISK-OFF | TVC:VIX |
| Sectors (Hebrew) | טכנולוגיה, בריאות, פיננסים, אנרגיה, תשתיות, נדל"ן | AMEX:XLK/XLV/XLF/XLE/XLU/XLRE |
| Housing | US HOUSING MARKET, HOUSING | AMEX:XLRE, AMEX:XHB |
| Sentiment | MARKET SENTIMENT, RISK-ON | SP:SPX |

**Implementation:** `_TV_ALIAS_MAP` in `src/utils/finvizLinks.js` — checked first in `buildTradingViewChartUrl`. New `lookupTradingViewSymbol(name)` export lets the handler check resolvability before opening.

---

## Perplexity Entity-Specific Prompt Routing

`buildPerplexityAnalysisPrompt(selectedItems)` in `src/lib/buildStockAiPrompt.js` detects entity type per item and selects the appropriate prompt template.

### Entity Type → Prompt Template

| Entity type | Detection logic | Prompt focus |
|---|---|---|
| `stock` | `type === 'stocks-mentioned'` / sectionLabel includes `מניות` (non-ETF ticker) | Technical + fundamental + risk score |
| `etf` | Same as stock but ticker is in known ETF set (SPY, QQQ, XLK…) | Same as stock, labeled "קרן סל" |
| `index` | `type === 'indices'` / sectionLabel includes `שווקים`, TV symbol is a plain index | Market breadth + macro + sector rotation |
| `commodity` | שווקים row whose TV symbol is `TVC:USOIL`, `TVC:GOLD`, `TVC:SILVER`, `TVC:NATGAS`, `COMEX:HG1!` | Supply/demand + macro + geopolitical |
| `crypto` | שווקים row whose TV symbol starts with `BITSTAMP:` | Technical + sentiment + liquidity |
| `macro` | `type === 'brief-macro'` / sectionLabel includes `מאקרו`, OR שווקים row with `TVC:US10Y`, `TVC:DXY`, `TVC:VIX` | Current reading + market impact + affected assets |
| `sector` | שווקים row whose TV symbol is `AMEX:XL*`, `NASDAQ:SMH`, `NASDAQ:QQQ` etc. | Relative strength + rotation + leading stocks |
| `sentiment` | `type === 'brief-sentiment'` / sectionLabel includes `סנטימנט` | Fear/Greed + Risk-On/Off + VIX proxy |
| `unknown` | Unrecognized item | Falls back to stock/ETF template |

### Chart / Quote Card Request

Every prompt begins with a request for a finance chart or quote card:

- **Stocks / ETFs / Indices / Commodities / Crypto / Sectors:** `"הצג את גרף המחיר / כרטיס ציטוט של {LABEL} אם זמין."`
- **Macro / Sentiment:** `"הצג גרף פרוקסי רלוונטי של {LABEL} אם זמין. אם אין גרף ישיר — השתמש בפרוקסי השוק הטוב ביותר."`
- **Sentiment fallback:** Instructs to use S&P 500 / VIX for general market, Bitcoin for crypto sentiment.

**Known limitation:** Perplexity does not always display the chart card. The prompt requests it, but the app does not depend on it.

### Label Extraction

`extractIndexNameFromItem(item)` is used for all entity types:
1. Tries structured fields: `symbol`, `ticker`, `name`, `title`, `label`, `asset`, `index`, `market`
2. Falls back to first segment of `text` split by ` · ` (Morning Brief format)

Examples:
- `{ text: "CRUDE OIL / FUEL · bearish · strong" }` → label: `"CRUDE OIL / FUEL"`
- `{ text: "AAPL · Apple Inc. · context" }` → label: `"AAPL"`
- `{ text: "סנטימנט כללי · bearish" }` → label: `"סנטימנט כללי"`

### Multiple Selection

When multiple items are selected, a single comparison prompt is built:

```
נתח את הנכסים הבאים:
- ITEM_1
- ITEM_2
- ...

לכל נכס, זהה אם מדובר במניה, קרן סל, מדד, סחורה, קריפטו, מאקרו, סקטור או אות סנטימנט.

החזר טבלת השוואה קומפקטית:
| נכס | סוג | מצב | 🔴🟡🟢 | ציון | מה לבדוק |

שורה תחתונה: [משפט קצר]
```

---

## Future Extensions (Out of Scope Now)

- Add "Finviz" button for stocks (opens `finviz.com/quote.ashx?t={TICKER}`)
- Support entity types beyond stocks: macro indicators, sentiment rows, sectors
- Auto-detect exchange for tickers not in `_TV_EXCHANGE_MAP`
- Perplexity URL prefill if Space API ever supports `?q=` parameter
