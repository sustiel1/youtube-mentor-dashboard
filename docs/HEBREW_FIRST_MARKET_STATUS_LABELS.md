# HEBREW_FIRST_MARKET_STATUS_LABELS

## Problem

The "Market Status / מצב שוק" table displayed raw internal labels instead of clear Hebrew labels:

| What appeared | Why |
|---|---|
| `Context` | AI returned a `context` key on `marketOverview`; no mapping existed |
| `Mood` | AI returned a `mood` key; no mapping existed |
| `Date` | AI returned a `date` key; leaked into indicator column |
| `סיכום` | REGIME_SPECS label was too short; not expanded to full UI label |
| `סנטימנט` | `translateMarketStatusLabel` skipped Hebrew strings; no expansion happened |

**Root cause:** The fallback loop in `extractMarketRegimeCards` (morningBriefDisplay.js) humanizes unknown keys to title-case English (e.g., `context` → `Context`). `translateMarketStatusLabel` did not handle these inputs, and also did not expand short Hebrew labels.

---

## Product Rule

**All indicator labels in the Market Status table must be in clear Hebrew.**

- No raw English keys (`Context`, `Mood`, `Date`, `Sentiment`)
- No short/internal Hebrew labels (`סיכום`, `סנטימנט`)
- Prefer descriptive, user-facing Hebrew phrases

---

## Label Mapping Table

| Input (raw key or AI-humanized) | Output label |
|---|---|
| `summary` / `סיכום` | סיכום מצב השוק |
| `context` / `Context` / `market context` | רקע השוק |
| `mood` / `Mood` | מצב רוח השוק |
| `date` / `Date` / `brief date` | תאריך המבזק |
| `sentiment` / `Sentiment` / `סנטימנט` | סנטימנט שוק |
| `main conclusion` / `mainConclusion` | מסקנה מרכזית |
| `market status` / `marketStatus` | מצב השוק |
| `market mood` / `marketMood` | מצב השוק |

---

## Where the Fix Lives

| File | Change |
|---|---|
| `src/lib/specializedDisplayI18n.js` | Added `context`, `mood`, `date`, `sentiment` to `MARKET_STATUS_LABELS_HE`; updated `translateMarketStatusLabel` to handle English inputs AND Hebrew short-form expansions (`סיכום` → `סיכום מצב השוק`, `סנטימנט` → `סנטימנט שוק`) |
| `src/lib/morningBriefDisplay.js` | Changed REGIME_SPECS label from `'סיכום'` to `'סיכום מצב השוק'` for summary keys |

---

## Duplicate Handling Rule (Mood vs. Sentiment)

`Mood` and `Sentiment` can both appear in AI output and may overlap conceptually. The code cannot determine at runtime whether they contain identical information.

**Rule:**
- Both rows are shown if the AI produces both fields with different content.
- If both have the same content, it is the AI's responsibility to omit one.
- For future AI prompt tuning: prefer `mood` for narrative market feel and `sentiment` for quantified sentiment indicators (fear/greed index, retail vs. institutional).

---

## QA Checklist

After deploying to Base44 Production:

- [ ] Open a Morning Brief video
- [ ] Check the "מצב שוק" section
- [ ] Confirm NO English labels: `Context`, `Mood`, `Date`, `Sentiment` must not appear
- [ ] Confirm NO short Hebrew: `סיכום` alone must not appear (should be `סיכום מצב השוק`)
- [ ] Confirm `סנטימנט` alone must not appear (should be `סנטימנט שוק`)
- [ ] Expected Hebrew labels: `סיכום מצב השוק`, `רקע השוק`, `מצב רוח השוק`, `סנטימנט שוק`
- [ ] Verify RTL layout is unchanged
- [ ] Verify checkboxes work as before

---

## Build Verification

```bash
npm run build
# Expected: EXIT 0, no errors
```

Build confirmed passing after this fix.

---

## Rollback Strategy

If labels appear broken after deployment:

1. In `src/lib/specializedDisplayI18n.js`:
   - Revert `MARKET_STATUS_LABELS_HE.summary` back to `'סיכום'`
   - Remove the `context`, `mood`, `date`, `sentiment` entries
   - Remove the Hebrew short-label expansion block from `translateMarketStatusLabel`
   - Remove the new English key checks (`context`, `mood`, `date`, `sentiment`)

2. In `src/lib/morningBriefDisplay.js`:
   - Revert `label: 'סיכום מצב השוק'` back to `label: 'סיכום'` in REGIME_SPECS

3. `npm run build` + Base44 Git Pull + Publish
