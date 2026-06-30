# Sector Finviz Links — Source of Truth

## 1. Goal

Make every sector title in the app clickable.
When the user clicks a sector title, open the matching ETF / sector page on Finviz in a new tab.

Main use cases:
- Morning Brief
- Macro / market videos
- Sectors table
- Specialized tab sector rows
- Any card or row that shows sector / industry status

## 2. Product Rule

- Only the sector title is clickable (not the entire row).
- Open in a new tab: `target="_blank" rel="noopener noreferrer"`.
- `onClick` calls `event.stopPropagation()` to avoid triggering row selection or checkbox.
- Unknown sector labels fall back to Finviz search — never a broken link.
- URL format: `https://finviz.com/quote.ashx?t=TICKER&p=d` (daily chart view).
- Fallback URL: `https://finviz.com/search.ashx?q={encoded label}`
- Keep RTL layout unchanged.

## 3. ETF Mapping Table

### Core SPDR Sectors

| Sector | Hebrew | ETF |
|--------|--------|-----|
| Technology | טכנולוגיה | XLK |
| Communication Services | תקשורת | XLC |
| Consumer Discretionary | צריכה מחזורית | XLY |
| Consumer Staples | צריכה בסיסית | XLP |
| Energy | אנרגיה | XLE |
| Financials | פיננסים | XLF |
| Healthcare | בריאות | XLV |
| Industrials | תעשייה | XLI |
| Materials | חומרי גלם | XLB |
| Real Estate | נדל"ן | XLRE |
| Utilities | תשתיות | XLU |

### Common Market Brief Industries / Themes

| Sector | Hebrew | ETF |
|--------|--------|-----|
| Semiconductors / Chips | שבבים / מוליכים למחצה | SOXX |
| Technology / Semiconductors | טכנולוגיה / שבבים | SOXX |
| Software | תוכנה / IGV | IGV |
| Small Caps / Russell / Russell 2000 | חברות קטנות | IWM |
| Biotech | ביוטק | XBI |
| Banks | בנקים | KBE |
| Regional Banks | בנקים אזוריים | KRE |
| Retail | קמעונאות | XRT |
| Transportation | תחבורה | IYT |
| Homebuilders | בנייה למגורים | XHB |
| Aerospace & Defense | ביטחון ותעופה | ITA |
| Cybersecurity | סייבר | CIBR |
| Cloud | ענן | SKYY |
| AI / Artificial Intelligence | בינה מלאכותית | BOTZ |
| Robotics | רובוטיקה | BOTZ |
| Solar | סולאר / אנרגיה סולארית | TAN |
| Clean Energy | אנרגיה נקייה | ICLN |
| Oil Services | שירותי נפט | OIH |
| Metals & Mining | מתכות וכרייה | XME |
| Gold Miners | כורי זהב | GDX |
| Copper Miners | נחושת / כורי נחושת | COPX |
| Uranium | אורניום | URA |
| Crypto / Blockchain | קריפטו / בלוקצ'יין | BITQ |

## 4. Specific-Over-Broad Matching Rule

When a sector label is compound (e.g. "Technology / Semiconductors"), the **more specific** sub-sector wins.

Examples:
- "טכנולוגיה / שבבים" (Technology / Semiconductors) → **SOXX** (not XLK)
- "תוכנה" (Software / IGV) → **IGV**
- "חברות קטנות" (Small Caps / Russell) → **IWM**
- "טכנולוגיה" → **XLK**
- "אנרגיה / שירותי נפט" → **OIH** (not XLE)

Implementation: compound keys are stored first in `_SECTOR_ENTRIES` in `src/utils/finvizLinks.js` and checked via full-label lookup before the slash-split fallback.

## 5. Rendering Behavior

Where the sector title is rendered, wrap **only the title** with an anchor tag:

```jsx
<a
  href={getSectorFinvizUrl(sectorLabel)}
  target="_blank"
  rel="noopener noreferrer"
  onClick={(event) => event.stopPropagation()}
>
  {sectorLabel}
</a>
```

Styling rules:
- `color: inherit`
- `font-weight: inherit`
- `text-decoration: none`
- `hover:underline` is acceptable

### SectorRow (MorningBriefVisualPrimitives.jsx)

```jsx
const finvizUrl = meta?.finvizUrl ?? getSectorFinvizUrl(sectorName);
// ...
{finvizUrl ? (
  <a
    href={finvizUrl}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
  >
    {displayLabel}
  </a>
) : <span>{displayLabel}</span>}
```

### SectorNameCell (MarketSectorTable.jsx)

```jsx
const link = resolveSectorFinvizLink(sector);
const finvizUrl = link?.url ?? getSectorFinvizUrl(sector);
// ...
{finvizUrl ? (
  <a
    href={finvizUrl}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
  >
    {displaySector}
  </a>
) : <span>{displaySector}</span>}
```

## 6. Matching Rules

Resolution order in `getSectorFinvizUrl(input)` (`src/utils/finvizLinks.js`):

1. **Normalize input**: strip arrows (`↑ ↓`), bullets (`•`), tildes (`~`), extra whitespace
2. **Pure ticker check**: 1–6 uppercase letters → direct quote URL
3. **Ticker + label in head**: `"XBI (Biotech)"` → extract `XBI`
4. **Ticker in parens**: `"Biotech (XBI)"` → extract `XBI`
5. **Paren-strip base**: `"תוכנה (Software / IGV)"` → try `"תוכנה"` → `IGV`
6. **Full compound lookup**: `"Technology / Semiconductors"` → `SOXX`
7. **Slash split** (left side first, then right)
8. **Named index fallback** (NASDAQ → QQQ, S&P 500 → SPY, etc.)
9. **Search fallback**: `https://finviz.com/search.ashx?q={encodeURIComponent(label)}`

Rules:
- Exact match first, then safe `includes` match
- Prefer specific industry matches over broad sector matches
- Never return `undefined` for a non-empty label
- Hebrew and English labels normalized to lowercase for comparison

## 7. QA Checklist

Verify each label opens the correct Finviz page in a new tab:

| Label | Expected URL |
|-------|-------------|
| `טכנולוגיה / שבבים (Technology / Semiconductors)` | `https://finviz.com/quote.ashx?t=SOXX&p=d` |
| `תוכנה (Software / IGV)` | `https://finviz.com/quote.ashx?t=IGV&p=d` |
| `חברות קטנות (Small Caps / Russell)` | `https://finviz.com/quote.ashx?t=IWM&p=d` |
| `פיננסים` | `https://finviz.com/quote.ashx?t=XLF&p=d` |
| `אנרגיה` | `https://finviz.com/quote.ashx?t=XLE&p=d` |
| `בריאות` | `https://finviz.com/quote.ashx?t=XLV&p=d` |
| `סייבר` | `https://finviz.com/quote.ashx?t=CIBR&p=d` |
| `בנקים אזוריים` | `https://finviz.com/quote.ashx?t=KRE&p=d` |
| `ענן` | `https://finviz.com/quote.ashx?t=SKYY&p=d` |
| Unknown sector label | `https://finviz.com/search.ashx?q=...` |

### Regression Checks

- [ ] Checkbox still works (stopPropagation in place)
- [ ] Clicking sector title opens a new tab
- [ ] Clicking outside the title (sentiment / note column) keeps previous row behavior
- [ ] RTL layout remains unchanged
- [ ] Existing Finviz links for stocks are not broken
- [ ] Build passes with zero errors

## 8. Build Verification

```bash
npm run build
```

Expected: zero TypeScript / ESLint errors related to this change.

Scope of changed files:
- `src/utils/finvizLinks.js`
- `src/components/dashboard/MarketSectorTable.jsx`
- `src/components/dashboard/MorningBriefVisualPrimitives.jsx`

## 9. Staging Strategy

1. Pull latest to Base44 dev environment
2. Open Morning Brief with a macro video that has sector data
3. Run QA checklist in the dev environment
4. If all pass → Publish

## 10. Commit Strategy

Do not commit automatically.

Suggested commit message:
```
feat: add Finviz links for sector titles
```

Stage only task-related files:
```bash
git add src/utils/finvizLinks.js
git add src/components/dashboard/MarketSectorTable.jsx
git add src/components/dashboard/MorningBriefVisualPrimitives.jsx
```

## 11. Rollback Strategy

The change is purely additive:
- Existing labeled sectors that already resolved → still work (now with `&p=d` suffix)
- Newly resolved labels (paren format) → now clickable
- Unknown labels → search fallback instead of plain text

To rollback: revert the three changed files to their previous commit.
No database or API changes involved.

```bash
git checkout HEAD~1 -- src/utils/finvizLinks.js
git checkout HEAD~1 -- src/components/dashboard/MarketSectorTable.jsx
git checkout HEAD~1 -- src/components/dashboard/MorningBriefVisualPrimitives.jsx
```

## 12. Full Implementation Prompt (for future use)

Paste this prompt to implement or re-implement sector Finviz links:

---

```
AUTONOMOUS SAFE MODE

Make every sector title in the Morning Brief and Sectors table clickable.
Clicking should open the matching ETF page on Finviz in a new tab.

Behavior:
- Only the sector title text is clickable.
- Use target="_blank" rel="noopener noreferrer".
- onClick calls event.stopPropagation() to avoid row/checkbox conflicts.
- If the sector resolves to a known ETF, use:
  https://finviz.com/quote.ashx?t=TICKER&p=d
- If the sector is unknown, fall back to:
  https://finviz.com/search.ashx?q={encodeURIComponent(label)}
- Never return a broken link.

Resolution priority:
1. Pure ticker (XLK, SOXX, IWM)
2. Ticker + label: "XBI (Biotech)" → XBI
3. Ticker in parens: "Biotech (XBI)" → XBI
4. Paren-strip base: "תוכנה (Software / IGV)" → IGV
5. Full compound lookup: "Technology / Semiconductors" → SOXX
6. Slash split (left first, then right)
7. Named index fallback
8. Search fallback

Specific-over-broad rule:
"טכנולוגיה / שבבים" → SOXX (not XLK)
"אנרגיה / שירותי נפט" → OIH (not XLE)

Files to modify:
- src/utils/finvizLinks.js — resolution logic
- src/components/dashboard/MarketSectorTable.jsx — sector name cell
- src/components/dashboard/MorningBriefVisualPrimitives.jsx — sector row

Reference: docs/SECTOR_FINVIZ_LINKS.md

Run npm run build to verify.
Do not commit without asking first.
```

---

## 13. סיכום בעברית

**מטרה:** כל כותרת סקטור/ענף בפרויקט תהיה לחיצה ותפתח את דף ה-ETF הרלוונטי ב-Finviz בטאב חדש.

**מה לוחצים:** רק טקסט הכותרת — לא כל השורה, לא ה-checkbox.

**סדר עדיפויות:** ספציפי על פני כללי.
- "טכנולוגיה / שבבים" → SOXX (לא XLK)
- "ענן" → SKYY
- "בנקים אזוריים" → KRE (לא KBE)

**Fallback:** תווית לא מוכרת → חיפוש Finviz — ולא נשבר.

**URL:** `https://finviz.com/quote.ashx?t=TICKER&p=d`

**קבצים מרכזיים:**
- `src/utils/finvizLinks.js` — לוגיקת ה-resolution
- `src/components/dashboard/MarketSectorTable.jsx` — תא שם הסקטור
- `src/components/dashboard/MorningBriefVisualPrimitives.jsx` — שורת סקטור ב-Morning Brief
