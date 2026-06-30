# AI Analyze — Opportunity & Risk Prompt Rule

## Problem

When users selected items from `brief-opportunities` or `brief-risks` tabs and clicked
"Analyze with AI", the generated prompt was either a stock/entity prompt or a generic
multi-asset comparison table. Short labels like:

- שוק גלובלי
- מניות שבבי זיכרון
- פריצת התנגדות ומעבר מעל קווי מגמה יורדים

...provided no contextual value to an AI that doesn't know **why** they are
opportunities or risks, or **what to look for**.

---

## Product Rule

Whenever the selected items include at least one item from `brief-opportunities` or
`brief-risks`, the AI prompt **must** use the opportunity/risk analysis format instead
of the entity-aware format.

---

## Detection Logic (`buildStockAiPrompt.js`)

An item is classified as an **opportunity** if any of the following is true:
- `item.type === 'brief-opportunities'`
- `item.tabScope === 'brief-opportunities'`
- `item.sectionLabel` matches `/הזדמנות|הזדמנויות/i`

An item is classified as a **risk** if any of the following is true:
- `item.type === 'brief-risks'`
- `item.tabScope === 'brief-risks'`
- `item.sectionLabel` matches `/^סיכון|^סיכונים/i`

If `_hasOpportunityOrRisk(items)` returns `true`, the entire batch uses
`_buildOpportunityRiskPrompt`.

---

## Prompt Structure

```
נתח את הפריטים הנבחרים מתוך מבזק השוק.
הסבר כל הזדמנות וכל סיכון בצורה פשוטה וברורה:
- מה זה אומר?
- למה זה חשוב?
- מי מושפע?
- מה יאשר את התרחיש?
- מה יבטל את התרחיש?
- מה לעקוב בהמשך?
אין לתת המלצת השקעה מחייבת.

הזדמנויות:
1. <item text>
2. <item text>

סיכונים:
1. <item text>
2. <item text>

אחר:
1. <item text>    ← only if mixed selection includes non-opp/risk items

נא לנתח בעברית בטבלה קומפקטית.
```

---

## Grouping Rule

| Group   | Condition                          |
|---------|------------------------------------|
| הזדמנויות | `item.type === 'brief-opportunities'` or matching sectionLabel |
| סיכונים   | `item.type === 'brief-risks'` or matching sectionLabel |
| אחר       | Any item that is neither of the above |

Sections with 0 items are omitted.

---

## Execution Order in `buildPerplexityAnalysisPrompt`

```
1. If items is empty → return ''
2. If any item is opportunity/risk → _buildOpportunityRiskPrompt(items)
3. If single item → _buildSinglePrompt(item[0])
4. If multiple items → _multiPrompt(items)
```

---

## QA Checklist

- [ ] Select 1 opportunity item → prompt starts with "נתח את הפריטים הנבחרים..."
- [ ] Select 2 risk items → prompt lists them under "סיכונים:"
- [ ] Select mix of opp + risk → both sections appear, no entity/stock prompt
- [ ] Select mix of opp + stock ticker → all appear (opp under הזדמנויות, ticker under אחר)
- [ ] Select only a stock ticker (no opp/risk) → old entity-aware prompt still fires
- [ ] Prompt copied to clipboard and pasted in Perplexity → returns structured Hebrew analysis

---

## Build Verification

```
npm run build
```

Expected: no TypeScript/ESLint errors. The function signature is unchanged so no
downstream import changes are needed.

---

## Rollback Strategy

The change is additive — the new detection block is inserted **before** the existing
`if (items.length === 1)` branch. To revert, remove the `_hasOpportunityOrRisk` check
and the three helper functions from `buildStockAiPrompt.js`. All other code is
untouched.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/buildStockAiPrompt.js` | Added `_isOpportunity`, `_isRisk`, `_hasOpportunityOrRisk`, `_buildOpportunityRiskPrompt`; updated `buildPerplexityAnalysisPrompt` routing |
| `docs/AI_ANALYZE_OPPORTUNITY_RISK_PROMPT_RULE.md` | This file |
