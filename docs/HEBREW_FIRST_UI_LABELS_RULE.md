# Hebrew-First UI Labels Rule

## Core Rule

All user-facing dashboard captions must be Hebrew-first.

If the English source term is useful for clarity, search, finance terminology, or ticker context, keep it in parentheses after the Hebrew.

## Format

```
עברית (English)
```

| Raw English | UI Display |
|---|---|
| Global Market | שוק גלובלי (Global Market) |
| Memory Semiconductor Stocks | מניות שבבי זיכרון (Memory Semiconductor Stocks) |
| Technology / Semiconductors | טכנולוגיה / שבבים (Technology / Semiconductors) |
| Small Caps (Russell) | חברות קטנות (Small Caps / Russell) |
| Software (IGV) | תוכנה (Software / IGV) |

## Rules

- Do not display English-only captions.
- Keep stock tickers and ETF symbols in English.
- Keep market symbols such as VIX, DXY, SPX, RUT, IGV in English.
- Use Hebrew for the readable label.
- Put the English/source term in parentheses only when it adds value.
- Prefer display normalization over changing raw data.
- Unknown labels should fall back safely to the original text.

## Suggested Helper

```js
getHebrewDisplayLabel(label)
```

- If `label` matches a known English term → return `"עברית (English)"`
- If no mapping found → return original `label` unchanged (safe fallback)
- Do not translate tickers (VIX, DXY, IGV, SPX, RUT, etc.)

## QA Checklist

- [ ] Cards show Hebrew-first labels
- [ ] Tables show Hebrew-first sector/index/asset names
- [ ] Tickers remain unchanged
- [ ] Links still work
- [ ] RTL layout remains clean
- [ ] Build passes

## What NOT to Change

- Raw stored data / GEM JSON fields
- Stock tickers and ETF symbols
- Internal component prop names
- Database entity fields
