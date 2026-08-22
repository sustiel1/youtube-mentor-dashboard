# Finviz Link Behavior Rule

## Rule
Every valid market symbol, stock ticker, ETF, sector ticker, or index label that can be mapped to Finviz should be clickable.

## Source of Truth
The existing Markets / שווקים implementation is the reference behavior.

## Link Targets
Use Finviz quote pages for valid symbols.

## Markets-table provider policy

The canonical registry and resolver are `VERIFIED_MARKET_ASSETS` and
`resolveMarketAssetProviderLinks()` in `src/lib/marketAssetProviderLinks.js`.

Primary symbol navigation uses this fixed priority:

1. Verified Finviz exact destination or explicitly approved Overview representative
2. Investing.com Israel
3. TradingView
4. No link

The Markets table's `קישורים` column intentionally hides the Finviz chip. It
continues to show Investing.com Israel and TradingView, in that order. The asset
symbol opens the verified Finviz Overview representative. A separate compact
`גרף חוזים` column opens the documented Finviz futures chart, when one exists.

### Approved Finviz market mappings

| Displayed asset | Primary Finviz Overview | Representative meaning | Futures chart |
|---|---|---|---|
| SPX / S&P 500 | `https://finviz.com/stock?t=SPY` | S&P 500 ETF representative | `ES` → `https://finviz.com/futures?t=ES` |
| NASDAQ / NASDAQ 100 | `https://finviz.com/stock?t=QQQ` | Nasdaq-100 ETF representative | `NQ` → `https://finviz.com/futures?t=NQ` |
| DOW / Dow Jones | `https://finviz.com/stock?t=DIA` | Dow Jones ETF representative | `YM` → `https://finviz.com/futures?t=YM` |
| RUSSELL / Russell 2000 | `https://finviz.com/stock?t=IWM` | Russell 2000 ETF representative | `ER2` → `https://finviz.com/futures?t=ER2` |
| VIX | `https://finviz.com/stock?t=VIXY` | Short-term VIX-futures ETF; not the cash VIX | `VX` → `https://finviz.com/futures?t=VX` |
| OIL / WTI | `https://finviz.com/stock?t=USO` | WTI-representative fund using futures; not spot oil | `CL` → `https://finviz.com/futures?t=CL` |
| DOLLAR / DXY | `https://finviz.com/stock?t=UUP` | Bullish U.S. Dollar Index fund representative | `DX` → `https://finviz.com/futures?p=d&t=DX` |
| BONDS10Y / US10Y | `https://finviz.com/stock?t=IEF` | 7–10 year Treasury bond-price ETF; not the US10Y yield | `ZN` → `https://finviz.com/futures?t=ZN` |
| BITCOIN / BTC | `https://finviz.com/crypto?t=BTCUSD` | Direct market pair | None |

Representative metadata is provider-specific and must remain available in the
symbol link's concise `title` and accessible name. The live Markets asset cell
shows only the original symbol, not a visible representative or futures badge.
The futures column must label its controls by contract code and accessible
contract name. Investing and TradingView links must not inherit Finviz proxy
metadata.

### Adding or changing mappings

- Never derive or guess an instrument URL from a display symbol.
- Open the proposed HTTPS URL and verify that Finviz identifies the intended
  instrument; an HTTP 200 response or a generic futures page is insufficient.
- Record exact aliases, Overview representative, semantic qualifier and any
  separately verified futures chart in the canonical registry.
- Keep explicit record URLs and live-data/source provenance outside default
  asset navigation.
- Add focused resolver tests for the canonical key, aliases, exact Overview and
  futures URLs, provider priority, representative qualifier, fallbacks and
  unknown symbols.
- Add rendered-component QA for clickable-symbol semantics, a symbol-only asset
  cell, futures accessibility, safe new-tab attributes and chip order.

## Do Not Link
- Empty values
- `—`
- Plain Hebrew titles without a clear ticker
- Generic descriptions without a market symbol

## UX
- Clickable text only
- Open in new tab
- No layout shift
- RTL must remain unchanged
- Subtle hover indication only

## Technical Preference
Use a shared helper:
- `buildFinvizUrl(symbol)`
- `resolveFinvizSymbol(item)`
- `isFinvizLinkable(item)`

---

## Watch-Today Company Name Resolver (commit 0f29c52)

### Rule
Plain English company names in "מה לעקוב היום" must resolve to valid Finviz ticker links when a known mapping exists.

### Resolution Priority (in `enrichWatchTodayItem`)
1. **Ticker prefix wins** — if the string starts with an uppercase ticker followed by `·`, `–`, or `-`:
   - `"NVDA · Nvidia"` → NVDA
   - `"AAPL · Apple"` → AAPL
   - `"MSFT · Microsoft"` → MSFT
2. **Hebrew name lookup** — `_HE_STOCK_WATCH_MAP`
3. **English company name lookup** — `_EN_COMPANY_TICKER_MAP` (case-insensitive, full string first then name-before-separator)

### Company Name Aliases (`_EN_COMPANY_TICKER_MAP`)
Added in commit 0f29c52:

| Company name | Ticker |
|---|---|
| Intel | INTC |
| Palantir | PLTR |
| Snapchat | SNAP |
| Snap | SNAP |
| La-Z-Boy | LZB |
| AST SpaceMobile | ASTS |

### Unknown Names
If a company name is not in either map, `enrichWatchTodayItem` returns `finvizUrl: null`. No broken Finviz quote link is generated.

### Source Files
- `src/utils/finvizLinks.js` — `_EN_COMPANY_TICKER_MAP`, `enrichWatchTodayItem(rawText)`
- `src/components/dashboard/SummaryBriefingView.jsx` — calls `enrichWatchTodayItem` on each `briefing.watchToday` item

### QA (commit 0f29c52)
- Build: exit 0, no errors
- All six new aliases passed: INTC, PLTR, SNAP, LZB, ASTS
- Existing ticker-prefix items (NVDA, AAPL, MSFT) unchanged
