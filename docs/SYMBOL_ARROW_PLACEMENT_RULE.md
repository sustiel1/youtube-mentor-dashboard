# Symbol Arrow Placement Rule

## Purpose

Directional arrows must always appear next to the related symbol, asset name, index name, or indicator name.

This rule prevents visual clutter in numeric columns and makes financial tables easier to scan.

## Core Rule

If a row has a directional marker such as:

- ↑
- ↓
- →
- ↔
- ●

The marker should be rendered next to the symbol/name column, not inside the numeric value column.

## Correct Layout

| Symbol / Indicator | Value | Change / Trend | Sentiment |
|---|---:|---|---|
| S&P 500 ↑ | 1% | Positive | Positive |
| NASDAQ ↑ | 1% | Positive | Positive |
| RUSSELL 2000 ↓ | 0.8% | Negative | Negative |
| VIX (VIX) ↓ | 18.0 | Weakening | Positive |
| DXY (DXY) ↑ | 101.2 | Stable / Strong | Positive |
| Bitcoin ↓ | 60,180 | Support | Negative |

## Wrong Layout

| Symbol / Indicator | Value / Change | Sentiment |
|---|---:|---|
| S&P 500 | 1% ↑ | Positive |
| VIX (VIX) | 18.0 ↓ Weakening | Positive |
| Bitcoin | 60,180 ↓ Support | Negative |

## Table Rules

### Symbol / Indicator Column

This column may include:

- Symbol
- Index name
- Asset name
- Indicator name
- Direction arrow

Examples:

- `SPX ↑`
- `NASDAQ ↑`
- `RUT ↓`
- `Bitcoin ↓`
- `VIX (VIX) ↓`
- `DXY (DXY) ↑`

### Value Column

This column should contain only the raw numeric or textual value.

Examples:

- `1%`
- `0.8%`
- `18.0`
- `101.2`
- `60,180`
- `N/A`
- `Sub 70`

Do not place arrows in this column.

### Change / Trend Column

This column should contain trend text only, without arrows.

Examples:

- `Positive`
- `Negative`
- `Weakening`
- `Stable / Strong`
- `Support`
- `Volatile`
- `Slightly rising`

Do not place `↑`, `↓`, or `●` in this column.

### Sentiment Column

The sentiment column remains separate and should not replace the arrow.

Examples:

- Positive
- Neutral
- Negative

## RTL / Hebrew Tables

In RTL Hebrew tables, the same rule applies:

| אינדיקטור | ערך | שינוי / מגמה | סנטימנט |
|---|---:|---|---|
| מדד הפחד VIX (VIX) ↓ | 18.0 | נחלש | חיובי |
| מדד הדולר DXY (DXY) ↑ | 101.2 | יציב / חזק | חיובי |
| Bitcoin ↓ | 60,180 | תמיכה | שלילי |

## Implementation Guidance

When rendering a financial table:

1. Resolve the symbol/name cell first.
2. Resolve the direction arrow from the existing change/trend logic.
3. Append the arrow inside the symbol/name cell.
4. Render numeric values without arrows.
5. Render trend text without arrows.
6. Preserve existing arrow colors:
   - Green for positive/up/supportive
   - Red for negative/down/risk
   - Neutral color for mixed/neutral markers

## Edge Cases

- If the arrow is `null`, empty, or `-`, do not render it.
- If the arrow is `●`, render it only when it adds useful meaning.
- Avoid duplicate arrows in the same row.
- Do not show arrows in both the symbol column and the change column.
- If a table already has a dedicated direction column, audit before changing.

## Required QA

Before approving changes:

- Verify arrows appear next to symbols/names.
- Verify numeric columns contain numbers only.
- Verify trend columns contain text only.
- Verify no duplicate arrows appear.
- Verify desktop RTL layout is clean.
- Verify mobile layout does not overflow.
- Run build.
