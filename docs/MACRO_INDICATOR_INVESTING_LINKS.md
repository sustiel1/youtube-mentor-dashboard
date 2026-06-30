# Macro Indicator Investing.com Israel Links

## 1. Goal

Every macro indicator title in the Morning Brief Macro table should be a clickable link that opens the matching page on Investing.com Israel (`https://il.investing.com`).

## 2. Product Rule

- **Only the indicator title** is clickable — not the checkbox, not the row.
- Opens in a new tab (`target="_blank" rel="noopener noreferrer"`).
- Known indicators → specific il.investing.com page.
- Unknown indicators → il.investing.com search fallback: `https://il.investing.com/search/?q={label}`.
- Hebrew labels and arrows (↑ ↓ •) are stripped before matching.
- RTL layout is preserved.

## 3. URL Mapping Table

| Indicator | Aliases | URL |
|-----------|---------|-----|
| VIX | vix, volatility, fear index, מדד הפחד | il.investing.com/indices/volatility-s-p-500 |
| DXY | dxy, dollar index, מדד הדולר | il.investing.com/indices/usdollar |
| S&P 500 | s&p 500, spx, spy | il.investing.com/indices/us-spx-500 |
| Nasdaq 100 | nasdaq 100, ndx, qqq | il.investing.com/indices/nq-100 |
| Nasdaq | nasdaq, ixic | il.investing.com/indices/nasdaq-composite |
| Dow Jones | dow jones, djia | il.investing.com/indices/us-30 |
| Russell 2000 | russell 2000, rut, iwm | il.investing.com/indices/smallcap-2000 |
| Bitcoin | bitcoin, btc, ביטקוין | il.investing.com/crypto/bitcoin/btc |
| Ethereum | ethereum, eth, אתריום | il.investing.com/crypto/ethereum/eth-usd |
| Crude Oil | crude oil, wti, נפט גולמי | il.investing.com/commodities/crude-oil |
| Brent | brent, brent oil | il.investing.com/commodities/brent-oil |
| Gold | gold, xau, זהב | il.investing.com/commodities/gold |
| Silver | silver, xag, כסף | il.investing.com/commodities/silver |
| Copper | copper, נחושת | il.investing.com/commodities/copper |
| Natural Gas | natural gas, nat gas, גז טבעי | il.investing.com/commodities/natural-gas |
| US Yields / 10Y | us yields, us10y, תשואות | il.investing.com/rates-bonds/u.s.-10-year-bond-yield |
| 2Y | us2y, 2 year yield | il.investing.com/rates-bonds/u.s.-2-year-bond-yield |
| 5Y | us5y, 5 year yield | il.investing.com/rates-bonds/u.s.-5-year-bond-yield |
| 30Y | us30y, 30 year yield | il.investing.com/rates-bonds/u.s.-30-year-bond-yield |
| EUR/USD | eurusd, euro | il.investing.com/currencies/eur-usd |
| USD/ILS | usd/ils, dollar shekel, דולר שקל | il.investing.com/currencies/usd-ils |
| USD/JPY | usdjpy, yen | il.investing.com/currencies/usd-jpy |
| Unknown | any unmatched label | il.investing.com/search/?q={label} |

## 4. Implementation Notes

**File:** `src/lib/macroIndicatorLinks.js`

**Key functions:**
- `getMacroIndicatorUrl(indicator)` — primary entry point, always returns a URL
- `resolveMacroIndicatorInvestingUrl(input)` — tries INVESTING_IL_MAP, falls back to search
- `buildInvestingSearchUrl(input)` — builds `il.investing.com/search/?q=...`
- `hasKnownMacroIndicatorLink(input)` — boolean, true if a specific page is found

**Noise stripping:** Leading/trailing arrows (↑ ↓ • ~) are removed before matching.

**Parenthetical extraction:** "מדד הפחד (VIX)" → tries "vix" separately as a candidate.

**Wiring:** `MorningBriefPanels.jsx` → `MacroSection` → indicator cell already calls `getMacroIndicatorUrl(row.indicator)` and renders `<a>` when URL is non-null.

**Legacy FRED URLs** are retained as `MACRO_INDICATOR_FRED_REFS` for reference only.

## 5. QA Checklist

- [ ] מדד הפחד (VIX) → opens `il.investing.com/indices/volatility-s-p-500`
- [ ] מדד הדולר (DXY) → opens `il.investing.com/indices/usdollar`
- [ ] Bitcoin → opens `il.investing.com/crypto/bitcoin/btc`
- [ ] Ethereum → opens `il.investing.com/crypto/ethereum/eth-usd`
- [ ] נפט גולמי (Crude Oil) → opens `il.investing.com/commodities/crude-oil`
- [ ] US Yields → opens `il.investing.com/rates-bonds/u.s.-10-year-bond-yield`
- [ ] Unknown macro label → opens `il.investing.com/search/?q=...`
- [ ] Checkbox still works
- [ ] Clicking on row outside title does not open link
- [ ] RTL layout unchanged
- [ ] No console errors

## 6. Build Verification

```bash
npm run build
```

Expected: EXIT_CODE 0, `dist/assets/index-*.js` updated.

## 7. Staging Strategy

1. Pull to Base44.
2. Open a video with macro section data.
3. Run QA checklist above.
4. Confirm all known indicators link to the correct il.investing.com page.
5. Confirm unknown indicators open search.

## 8. Commit Strategy

Commit only after manual QA passes:
```
feat: add il.investing.com links for macro indicator titles

Replaces FRED/TradingView fallbacks with il.investing.com pages
for VIX, DXY, BTC, ETH, Oil, Gold, Yields, Forex, and Indices.
Unknown indicators fall back to il.investing.com search.
```

## 9. Rollback Strategy

If links open wrong pages:
- Revert `src/lib/macroIndicatorLinks.js` to the previous git commit.
- The panel wiring in `MorningBriefPanels.jsx` does not need to change.
