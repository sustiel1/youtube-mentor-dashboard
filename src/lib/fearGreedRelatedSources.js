// Verified, read-only external data sources that help explain specific CNN
// Fear & Greed components. Sourced from auditing the archived former
// application's IndicatorExplanationCenter.tsx (read-only inspection of
// Desktopdashboarddesigncopycopy-main.zip — never modified), then
// independently re-verified live on 2026-08-25 (real-browser navigation,
// not just an HTTP status check) — see the pre-QA report for evidence.
//
// None of these providers (Finviz, CBOE, StockCharts, FRED) expose a public
// JSON API, so this module intentionally holds links only — no scraped or
// invented live value, unit, or timestamp. Rendered as compact chips beside
// each indicator's own title in FearGreedFullScreenModal.jsx — never as CNN
// data, and never in a separate catch-all section.
//
// Audit notes on specific decisions:
// - put_call_options has no entry: the former app's only related link (CBOE's
//   /us/options/market_statistics/ page) is a general navigation landing page
//   with no put/call data actually on it (verified live) — omitted rather
//   than shown as a misleading empty control or a mislabeled "graph".
// - market_volatility: the former app's Finviz link for VIX (t=^VIX) was
//   verified dead (404 via finviz.com/stock?t=^VIX redirect) — CBOE's own
//   VIX product page was verified live instead (shows the real-time VIX
//   spot price).
// - stock_price_strength vs stock_price_breadth previously both pointed at
//   the same StockCharts $NYA200R (NYSE % of stocks above their 200-day
//   moving average — a participation/breadth metric) — a real duplication.
//   Re-audited: $NYA200R genuinely belongs under breadth (participation).
//   For strength (CNN compares NYSE 52-week highs vs lows), StockCharts'
//   $NYHL ("NYSE - New Highs-New Lows INDX") was found and verified live as
//   a distinct, genuinely-matching destination — no duplication remains.
// - market_momentum: the former app also linked QQQ (Nasdaq-100) here, but
//   CNN's own momentum indicator is defined purely against the S&P 500 (vs
//   its 125-day moving average) — QQQ isn't part of that definition, so it
//   was dropped rather than displayed as an unexplained addition. SPY (an
//   S&P 500 ETF) matches directly and is kept.
// - safe_haven_demand: CNN's indicator compares stock vs. Treasury bond
//   returns over 20 trading days. FRED's DGS10 (10-year Treasury yield)
//   matches the bond side directly. GLD (gold) isn't literally part of
//   CNN's formula, but gold is a conventional safe-haven asset and was kept
//   per explicit instruction — labeled clearly as a supplemental source,
//   never presented as a CNN input.
export const FEAR_GREED_RELATED_SOURCES = Object.freeze({
  market_momentum: Object.freeze([
    {
      shortLabel: 'SPY',
      provider: 'Finviz',
      url: 'https://finviz.com/quote.ashx?t=SPY',
      ariaLabel: 'פתח גרף SPY באתר Finviz',
    },
  ]),
  stock_price_strength: Object.freeze([
    {
      shortLabel: 'NYSE',
      provider: 'StockCharts',
      url: 'https://stockcharts.com/h-sc/ui?s=$NYHL',
      ariaLabel: 'פתח גרף שיאים ושפלים חדשים ב-NYSE ($NYHL) באתר StockCharts',
    },
  ]),
  stock_price_breadth: Object.freeze([
    {
      shortLabel: 'NYSE',
      provider: 'StockCharts',
      url: 'https://stockcharts.com/h-sc/ui?s=$NYA200R',
      ariaLabel: 'פתח גרף אחוז מניות NYSE מעל ממוצע נע 200 יום ($NYA200R) באתר StockCharts',
    },
  ]),
  put_call_options: Object.freeze([]),
  market_volatility: Object.freeze([
    {
      shortLabel: 'VIX',
      provider: 'CBOE',
      url: 'https://www.cboe.com/tradable_products/vix/',
      ariaLabel: 'פתח גרף VIX באתר CBOE',
    },
  ]),
  safe_haven_demand: Object.freeze([
    {
      shortLabel: 'GLD',
      provider: 'Finviz',
      url: 'https://finviz.com/quote.ashx?t=GLD',
      ariaLabel: 'פתח גרף GLD באתר Finviz',
    },
    {
      shortLabel: 'אג״ח 10Y',
      provider: 'FRED',
      url: 'https://fred.stlouisfed.org/series/DGS10',
      ariaLabel: 'פתח גרף תשואת אג״ח ממשלתי ל-10 שנים (DGS10) באתר FRED',
    },
  ]),
  junk_bond_demand: Object.freeze([
    {
      shortLabel: 'HYG',
      provider: 'Finviz',
      url: 'https://finviz.com/quote.ashx?t=HYG',
      ariaLabel: 'פתח גרף HYG באתר Finviz',
    },
  ]),
});
