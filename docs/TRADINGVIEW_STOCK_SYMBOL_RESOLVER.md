# TradingView Stock Symbol Resolver

**Status:** Active  
**Last Updated:** 2026-06-30  
**Related:** [MARKET_ENTITY_ANALYSIS_ROUTING.md](MARKET_ENTITY_ANALYSIS_ROUTING.md) · [PERPLEXITY_AI_ANALYSIS_WORKFLOW.md](PERPLEXITY_AI_ANALYSIS_WORKFLOW.md)

---

## Problem

Dashboard items in sections like "מה לעקוב היום" can appear as bare English company names (Nvidia, Broadcom, Google…). These are not tickers. The TradingView button did not know how to resolve them to a valid symbol, and either showed a fallback toast or produced a broken chart URL.

---

## Product Rule

**Every selected item that represents a known stock or company must open TradingView with a valid, exchange-qualified symbol — never with a broken or mismatched symbol.**

- Known company names → resolve to `EXCHANGE:TICKER` → open personal chart
- Unknown labels (not resolvable) → open TradingView symbol search
- Existing ticker-first formats (`AVGO · Broadcom`) → unchanged, already worked

---

## Resolver Order (in `buildTradingViewChartUrl`)

`src/utils/finvizLinks.js`

```
Input: "Nvidia"
  → _normTv("Nvidia") → "NVIDIA"

Step 1: _TV_ALIAS_MAP.get("NVIDIA")
        → "NASDAQ:NVDA"  ✓  (added in this fix)
        → return personal chart URL with ?symbol=NASDAQ%3ANVDA

Step 2: _TV_EXCHANGE_MAP.get(s)
        → for known tickers: "MSFT" → "NASDAQ" → "NASDAQ:MSFT"

Step 3: Pure A-Z ticker 1-6 chars  (e.g. "XYZ")
        → NASDAQ:XYZ fallback

Step 4: Unknown multi-word label
        → buildTradingViewSearchUrl(s)
        → https://il.tradingview.com/search/?query=...
```

---

## Alias Map Entries (Company Names)

Added to `_TV_ALIAS_MAP` in `src/utils/finvizLinks.js`.

### English Company Names

| Input (any case) | Resolves to |
|---|---|
| Nvidia / NVIDIA | `NASDAQ:NVDA` |
| Apple / APPLE | `NASDAQ:AAPL` |
| Tesla / TESLA | `NASDAQ:TSLA` |
| Broadcom / BROADCOM | `NASDAQ:AVGO` |
| Google / GOOGLE | `NASDAQ:GOOGL` |
| Alphabet / ALPHABET | `NASDAQ:GOOGL` |
| Oracle / ORACLE | `NYSE:ORCL` |
| Amazon / AMAZON | `NASDAQ:AMZN` |
| Microsoft / MICROSOFT | `NASDAQ:MSFT` |
| Applied Materials | `NASDAQ:AMAT` |
| Super Micro | `NASDAQ:SMCI` |
| Rocket Lab | `NASDAQ:RKLB` |
| Varonis | `NASDAQ:VRNS` |
| Trade Desk | `NASDAQ:TTD` |
| Comcast | `NASDAQ:CMCSA` |
| Concentrix | `NASDAQ:CNXC` |
| AeroVironment | `NASDAQ:AVAV` |
| Sandisk / SanDisk | `NASDAQ:SNDK` |
| Ritchie Bros | `NYSE:RBA` |

**Note:** META, AMD are already in `_TV_EXCHANGE_MAP` (step 2) — no alias needed.

### Hebrew Company Names

| Input | Resolves to |
|---|---|
| אנבידיה | `NASDAQ:NVDA` |
| אפל | `NASDAQ:AAPL` |
| טסלה | `NASDAQ:TSLA` |
| ברודקום | `NASDAQ:AVGO` |
| גוגל | `NASDAQ:GOOGL` |
| אלפאבית | `NASDAQ:GOOGL` |
| אורקל | `NYSE:ORCL` |
| מטא | `NASDAQ:META` |
| אמזון | `NASDAQ:AMZN` |
| מיקרוסופט | `NASDAQ:MSFT` |
| איי אם די / אי אם די | `NASDAQ:AMD` |

**Note:** Hebrew names that go through `enrichWatchTodayItem` are already prefixed with the ticker (e.g. `"AVGO · ברודקום"`) — the alias map entries here are a safety net for cases that bypass enrichment.

---

## Fallback Behavior

| Case | Behavior |
|---|---|
| Known company name | Opens personal chart with `EXCHANGE:TICKER` |
| Known ticker (step 2) | Opens personal chart with `EXCHANGE:TICKER` |
| Pure 1-6 uppercase letters (unknown) | Opens `NASDAQ:TICKER` (existing fallback) |
| Multi-word unknown label | Opens TradingView search: `il.tradingview.com/search/?query=...` |

**`buildTradingViewSearchUrl(query)`** — new export in `finvizLinks.js`. Returns the TradingView symbol search URL for any query string.

---

## Item Flow for "מה לעקוב היום"

```
briefing.watchToday = ["Nvidia", "ברודקום", "AVGO · Broadcom"]
  ↓
enrichWatchTodayItem (per item):
  "Nvidia"          → { displayText: "Nvidia",           ticker: null } — not enriched
  "ברודקום"         → { displayText: "AVGO · ברודקום",   ticker: "AVGO" } — enriched
  "AVGO · Broadcom" → { displayText: "AVGO · Broadcom",  ticker: "AVGO" } — prefix match
  ↓
LearningTabContent receives displayText as item.text
  ↓
User selects item → handleOpenTradingView
  ↓
"Nvidia"          → entityType='unknown' → name="Nvidia" → lookupTradingViewSymbol → "NASDAQ:NVDA" ✓
"AVGO · ברודקום"  → entityType='stock'  → ticker="AVGO" → buildTradingViewChartUrl("AVGO") ✓
"AVGO · Broadcom" → entityType='stock'  → ticker="AVGO" → buildTradingViewChartUrl("AVGO") ✓
```

---

## QA Checklist

Select from "מה לעקוב היום" and click 📈 TradingView:

| # | Input | Expected symbol | Expected URL pattern |
|---|---|---|---|
| 1 | Nvidia | `NASDAQ:NVDA` | `?symbol=NASDAQ%3ANVDA` |
| 2 | Apple | `NASDAQ:AAPL` | `?symbol=NASDAQ%3AAAPL` |
| 3 | Tesla | `NASDAQ:TSLA` | `?symbol=NASDAQ%3ATSLA` |
| 4 | Broadcom | `NASDAQ:AVGO` | `?symbol=NASDAQ%3AAVGO` |
| 5 | Google | `NASDAQ:GOOGL` | `?symbol=NASDAQ%3AGOOGL` |
| 6 | Oracle | `NYSE:ORCL` | `?symbol=NYSE%3AORCL` |
| 7 | Meta | `NASDAQ:META` | `?symbol=NASDAQ%3AMETA` |
| 8 | Amazon | `NASDAQ:AMZN` | `?symbol=NASDAQ%3AAMZN` |

Also verify regression tests:

| # | Input | Expected |
|---|---|---|
| 9 | `AVGO · Broadcom` (enriched) | `NASDAQ:AVGO` via step 2 |
| 10 | MSFT (stock section) | `NASDAQ:MSFT` via step 2 |
| 11 | RUSSELL 2000 (שווקים) | `TVC:RUT` via alias map |
| 12 | Unknown text | TradingView search URL |

---

## Build Verification

```bash
npm run build   # must exit 0
```

---

## Safety Rules

- Do NOT hardcode a static 500-stock list — use alias map for known watchlist names only
- Do NOT break existing Finviz links — `resolveFinvizTicker` is unchanged
- Do NOT remove the toast fallback in `handleOpenTradingView` — it's the last resort
- Do NOT change TradingView routing for sectors/indices/crypto/macro — those use separate alias map entries

---

## Rollback Strategy

If the company name entries cause unexpected symbol resolution:
1. Remove the affected entries from `_TV_ALIAS_MAP` in `src/utils/finvizLinks.js`
2. The step 4 fallback (`buildTradingViewSearchUrl`) is safe — it opens search, not a broken chart

---

## Implementation Files

| File | Change |
|---|---|
| `src/utils/finvizLinks.js` | Added 19 English + 11 Hebrew company name entries to `_TV_ALIAS_MAP`; added `buildTradingViewSearchUrl`; fixed step 3/4 in `buildTradingViewChartUrl` |
| `docs/TRADINGVIEW_STOCK_SYMBOL_RESOLVER.md` | This file |
