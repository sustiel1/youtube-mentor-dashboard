# Macro Research Resources — Source of Truth

`src/lib/specializedSectionResources.js` owns the six verified resources shown by the Market State Macro Research Center. The registry stores stable keys, Hebrew labels and descriptions, provider names, fixed HTTPS destinations, categories, and explicit aliases. It stores no live values.

The canonical destinations are Investing.com Israel Economic Calendar, CME FedWatch, Investing.com Israel US 10Y yield, and the public TradingView pages for CBOE VIX, TVC DXY, and WTI (`USOIL`).

Row-level resolution is exact and allowlisted: `BONDS10Y`/`US10Y`/`TNX`, `VIX`, `DOLLAR`/`DXY`, and `OIL`/`WTI`. Generic Market State narratives remain plain text. URLs are never generated from free text.

The feature is research navigation only. It does not scrape, fetch, or calculate market data, and it does not provide investment recommendations. External links open in a new tab with `noopener noreferrer`; the menu supports Enter, Space, Escape, focus restoration, RTL layout, and propagation isolation.

Verify with `node scripts/test-macro-research-center.mjs`, the existing external-routing regressions, the Specialized coverage regression, a production build, and desktop/narrow localhost QA without changing browser storage.
