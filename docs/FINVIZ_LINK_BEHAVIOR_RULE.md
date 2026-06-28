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
