# Sector / Theme → Finviz Link Mapping

**Source of truth:** `src/utils/finvizLinks.js` — `_SECTOR_ENTRIES` array.

## כלל קבוע

כל תווית סקטור / תמה בטבלה **חייבת** להיות ניתנת לקישור ל-Finviz אם קיים ETF proxy מוכר.
לא ליצור לינקים שבורים. תוויות לא מוכרות — טקסט רגיל בלבד.

---

## מיפוי נוכחי (English → ETF Proxy)

| English Label | ETF Proxy | Finviz URL |
|---|---|---|
| Technology | XLK | finviz.com/quote.ashx?t=XLK |
| Technology / Semiconductors | SOXX | finviz.com/quote.ashx?t=SOXX |
| Semiconductors | SOXX | finviz.com/quote.ashx?t=SOXX |
| Software | IGV | finviz.com/quote.ashx?t=IGV |
| Small Caps | IWM | finviz.com/quote.ashx?t=IWM |
| Small Caps (Russell) | IWM | finviz.com/quote.ashx?t=IWM |
| Russell | IWM | finviz.com/quote.ashx?t=IWM |
| Communication Services | XLC | finviz.com/quote.ashx?t=XLC |
| Consumer Cyclical | XLY | finviz.com/quote.ashx?t=XLY |
| Consumer Discretionary | XLY | finviz.com/quote.ashx?t=XLY |
| Consumer Defensive | XLP | finviz.com/quote.ashx?t=XLP |
| Consumer Staples | XLP | finviz.com/quote.ashx?t=XLP |
| Energy | XLE | finviz.com/quote.ashx?t=XLE |
| Financial / Financials | XLF | finviz.com/quote.ashx?t=XLF |
| Healthcare | XLV | finviz.com/quote.ashx?t=XLV |
| Industrials | XLI | finviz.com/quote.ashx?t=XLI |
| Basic Materials | XLB | finviz.com/quote.ashx?t=XLB |
| Real Estate | XLRE | finviz.com/quote.ashx?t=XLRE |
| Utilities | XLU | finviz.com/quote.ashx?t=XLU |
| Regional Banks | KRE | finviz.com/quote.ashx?t=KRE |
| Banks | KBE | finviz.com/quote.ashx?t=KBE |
| Biotechnology / Biotech | XBI | finviz.com/quote.ashx?t=XBI |
| Cybersecurity | CIBR | finviz.com/quote.ashx?t=CIBR |
| Cloud Computing | SKYY | finviz.com/quote.ashx?t=SKYY |
| AI / Robotics | BOTZ | finviz.com/quote.ashx?t=BOTZ |
| Gold Miners | GDX | finviz.com/quote.ashx?t=GDX |
| Oil & Gas | XLE | finviz.com/quote.ashx?t=XLE |
| Long Treasury Bonds | TLT | finviz.com/quote.ashx?t=TLT |
| US Dollar | UUP | finviz.com/quote.ashx?t=UUP |

---

## כללי עברית

- תוויות בעברית עם תרגום זמין מוצגות כ: `עברית (English)`
- תרגומים מנוהלים ב: `src/lib/marketLabelTranslations.js`
- לינקי Finviz מחושבים מהתווית **המקורית** (לפני תרגום), לא מהתרגום

```
Technology / Semiconductors → טכנולוגיה / שבבים (Technology / Semiconductors) → SOXX
Small Caps (Russell)        → חברות קטנות (Small Caps (Russell))               → IWM
Software (IGV)              → תוכנה (Software (IGV))                           → IGV
```

---

## ארכיטקטורה

```
label (string)
  └─ resolveSectorFinvizLink(label)   → { ticker, url } | null
  └─ getSectorFinvizUrl(label)        → url string | null
  └─ resolveFinvizTicker(label)       → ticker string | null

display
  └─ getHebrewDisplayLabel(label)     → "עברית (English)" | unchanged
```

**קדימות בresolution:**
1. Pure ticker (A-Z, 1-6 chars)
2. Ticker + parens head: `XBI (Biotech)` → XBI
3. Ticker in parens: `Biotech (XBI)` → XBI
4. **Full-label lookup** (חדש) — מתאים לתוויות מורכבות לפני slash-split
5. Slash-split: `Energy / Oil` → left side
6. Named index map (NASDAQ, Russell…)
7. Sector name map

---

## הוספת מיפוי חדש

1. הוסף entry ל-`_SECTOR_ENTRIES` ב-`src/utils/finvizLinks.js`
2. הוסף תרגום עברית ל-`MARKET_LABEL_ENTRIES` ב-`src/lib/marketLabelTranslations.js`
3. עדכן טבלה זו

**אל תוסיף לינקים שבורים** — אם אין ETF proxy מוכר, השאר טקסט רגיל.

---

## ⚠️ הערת SMH vs SOXX

המשימה ציינה **SMH** (VanEck Semiconductor ETF) עבור שבבים.
המיפוי הנוכחי משתמש ב-**SOXX** (iShares Semiconductor ETF) — שניהם תקינים כ-proxy.
שנה ל-SMH ב-`_SECTOR_ENTRIES` אם מעדיף.
