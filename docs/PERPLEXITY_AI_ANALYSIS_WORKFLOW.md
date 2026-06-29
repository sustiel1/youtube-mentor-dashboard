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
| `📈 TradingView` | Opens TradingView chart (stock tickers only) |
| `🤖 נתח עם AI` | Copies AI prompt + opens Perplexity Space (any item type) |

---

## TradingView Button

**Trigger:** One stock ticker selected (type `stocks-mentioned` or text that starts with a US ticker symbol).

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

**Non-stock fallback:** Toast: `"TradingView זמין כעת למניות בלבד"`

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

## Future Extensions (Out of Scope Now)

- Add "Finviz" button for stocks (opens `finviz.com/quote.ashx?t={TICKER}`)
- Support entity types beyond stocks: macro indicators, sentiment rows, sectors
- Auto-detect exchange for tickers not in `_TV_EXCHANGE_MAP`
- Perplexity URL prefill if Space API ever supports `?q=` parameter
