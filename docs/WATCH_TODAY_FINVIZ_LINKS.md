# Watch Today — Finviz Links & Ticker Enrichment

## Problem
The "מה לעקוב היום" section showed Hebrew company names only (e.g., "סנדיסק", "אמזון").
Tickers were not displayed, and items were not clickable.

## Product Rule
Every stock item in "מה לעקוב היום" must:
1. Display a ticker prefix: `TICKER · Hebrew name`
2. Be clickable — opens the Finviz daily chart in a new tab

## Display Rule
| Has ticker | Display format |
|---|---|
| Yes | `TICKER · Hebrew name` — entire text is a clickable link |
| No | Hebrew name only — plain text, no link |

## URL Rule
```
https://finviz.com/quote.ashx?t={TICKER}&p=d
```
Built by `buildFinvizQuoteUrl(ticker)` in `src/utils/finvizLinks.js`.

## Ticker Resolution Rule
Priority order:
1. **Existing prefix in string** — if text already starts with uppercase letters + separator (e.g., `"AVAV – reason"`), extract the ticker from the prefix
2. **Full string match** against Hebrew name map (`_HE_STOCK_WATCH_MAP` in `finvizLinks.js`)
3. **Part before separator** — e.g., `"סנדיסק – הסיבה"` → try `"סנדיסק"`
4. **No match** — return original text, no link

## Hebrew Name → Ticker Map

| Hebrew | Ticker |
|---|---|
| סנדיסק | SNDK |
| אמזון | AMZN |
| ארוויירונמנט | AVAV |
| קונסנטריקס | CNXC |
| איי אם די / אי אם די | AMD |
| ברודקום | AVGO |
| ריצ'י ברוס | RBA |
| אפלייד מטריאלס / מטיריאלס | AMAT |
| קומקאסט | CMCSA |
| טרייד דסק | TTD |
| סופר מיקרו | SMCI |
| רוקט לאב | RKLB |
| וורוניס | VRNS |

To add more entries: edit `_HE_STOCK_WATCH_MAP` in `src/utils/finvizLinks.js`.

## English Company Name → Ticker Map

Added in 2026-06-30. Lookup is case-insensitive (`.toLowerCase()`).

| Input | Ticker |
|---|---|
| Nvidia | NVDA |
| Apple | AAPL |
| Tesla | TSLA |
| Broadcom | AVGO |
| Google | GOOGL |
| Alphabet | GOOGL |
| Oracle | ORCL |
| Meta | META |
| Amazon | AMZN |
| Microsoft | MSFT |
| AMD | AMD |
| Applied Materials | AMAT |
| Super Micro | SMCI |
| Rocket Lab | RKLB |
| Varonis | VRNS |
| Trade Desk | TTD |
| Comcast | CMCSA |
| Concentrix | CNXC |
| AeroVironment | AVAV |
| Sandisk / SanDisk | SNDK |
| Ritchie Bros | RBA |

To add more entries: edit `_EN_COMPANY_TICKER_MAP` in `src/utils/finvizLinks.js`.

## Files Changed

| File | Change |
|---|---|
| `src/utils/finvizLinks.js` | Added `_HE_STOCK_WATCH_MAP`, `resolveHebrewStockTicker()`, `enrichWatchTodayItem()` |
| `src/components/dashboard/LearningTabContent.jsx` | Added `url` prop to `ItemRow`; added `getItemUrl` prop to `LearningTabContent` |
| `src/components/dashboard/SummaryBriefingView.jsx` | Enriches `briefing.watchToday` items before rendering; passes `getItemUrl` to `LearningTabContent` |

## Data Flow

```
briefing.watchToday: string[]          (plain Hebrew strings)
         ↓
watchEnriched = .map(enrichWatchTodayItem)
         ↓
watchTexts: string[]                   ("TICKER · Hebrew" or unchanged)
watchUrlByText: Map<string, string>    (displayText → Finviz URL)
         ↓
LearningTabContent(items=watchTexts, getItemUrl=...)
         ↓
ItemRow renders <a href={url}> when url is set
```

## QA Checklist

Use Morning Brief 30.6.26.

- [ ] "סנדיסק" → shows "SNDK · סנדיסק", opens `finviz.com/quote.ashx?t=SNDK&p=d`
- [ ] "אמזון" → shows "AMZN · אמזון", opens Finviz AMZN
- [ ] "ארוויירונמנט" → shows "AVAV · ארוויירונמנט", opens Finviz AVAV
- [ ] "קונסנטריקס" → shows "CNXC · קונסנטריקס", opens Finviz CNXC
- [ ] "אי אם די" → shows "AMD · אי אם די", opens Finviz AMD
- [ ] "ברודקום" → shows "AVGO · ברודקום", opens Finviz AVGO
- [ ] "ריצ'י ברוס" → shows "RBA · ריצ'י ברוס", opens Finviz RBA
- [ ] "אפלייד מטריאלס" → shows "AMAT · אפלייד מטריאלס", opens Finviz AMAT
- [ ] "Nvidia" → clickable, opens Finviz NVDA
- [ ] "Apple" → clickable, opens Finviz AAPL
- [ ] "Tesla" → clickable, opens Finviz TSLA
- [ ] "Broadcom" → clickable, opens Finviz AVGO
- [ ] "Google" → clickable, opens Finviz GOOGL
- [ ] "Oracle" → clickable, opens Finviz ORCL
- [ ] "Meta" → clickable, opens Finviz META
- [ ] "Amazon" → clickable, opens Finviz AMZN
- [ ] Checkbox selection still works
- [ ] Save to Brain still works (saves with ticker prefix)
- [ ] TradingView toolbar button unchanged
- [ ] RTL layout unchanged
- [ ] Other sections (keyInsights, keyRisks, etc.) are unchanged
- [ ] Build passes

## Build Verification
```
npm run build
```
Expected: exit 0, no TypeScript/JSX errors.

## Rollback Strategy
To revert: undo the three changes above.

In `SummaryBriefingView.jsx`, replace `watchTexts` back to `briefing.watchToday` and remove the `enrichWatchTodayItem` import + computation block.

In `LearningTabContent.jsx`, remove `url` from `ItemRow` and `getItemUrl` from `LearningTabContent`.

In `finvizLinks.js`, remove the block starting with `// ── Watch-Today: Hebrew company name...`.
