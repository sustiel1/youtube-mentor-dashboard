# Finviz Link Behavior Rule

## Rule
Every valid market symbol, stock ticker, ETF, sector ticker, or index label that can be mapped to Finviz should be clickable.

## Source of Truth
The existing Markets / שווקים implementation is the reference behavior.

## Link Targets
Use Finviz quote pages for valid symbols.

## Index Mapping
- S&P 500 → SPY
- NASDAQ → QQQ
- DOW JONES → DIA
- RUSSELL 2000 → IWM
- BTC → BTCUSD or existing project convention

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
