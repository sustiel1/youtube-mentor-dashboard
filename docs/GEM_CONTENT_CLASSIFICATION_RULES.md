# GEM Content Classification Rules

> מקור אמת לכללי הסיווג של GEM recommendation.
> עדכון אחרון: 2026-06-30

---

## Overview

The GEM recommendation system classifies each video into one of:

| GEM key | Label | contentType (fine-grained) |
|---|---|---|
| `news` | מבזק בוקר | `marketBrief` |
| `macro` | מאקרו | `macro` |
| `technical` | טכני | `dailyTrading` |
| `fundamental` | פונדמנטלי | `fundamental` |
| `political` | פוליטי | `political` |
| `appBuilder` | בניית אפליקציה | — |
| `general` | כללי | `general` |

Two classification layers exist in the codebase, but only one is currently active:
- **UI recommendation layer** (`preGemClassifier` in `src/lib/gemRecommender.js`) — **active**. Called from `VideoDetailPanel.jsx`'s `gemRec` `useMemo`; controls the GEM recommendation card and GEM selection modal.
- **Routing/analysis layer** (`resolveContentClassification` in `src/ai/gemini/gemContentRouter.js`) — **dormant**. Verified (2026-07-26, Phase 3C architecture audit) that this module is not imported anywhere in `src/`, `scripts/`, or `e2e/`. It does not control `metadata.contentClassification` or Gemini prompt dispatch today — the real client call (`fetchGeminiVideoContent` in `src/services/geminiVideoContent.js`) sends no `contentType` field at all. See `docs/adr/ADR_TITLE_OVERRIDE_SOURCE_OF_TRUTH.md` for the full verified call graph and the decision to retain this code as dormant pending a separate lifecycle decision.

---

## metadata.contentClassification

> ⚠️ **This section documents the dormant `gemContentRouter.js` design, not currently active
> behavior.** `resolveContentClassification()` is not called by any live code path (verified
> 2026-07-26 — see the ADR linked above). The "How it controls the app" table below describes what
> this module *would* control if it were wired in, not what happens today.

`resolveContentClassification(video, transcriptText)` returns:

```js
{
  contentType:    'marketBrief' | 'macro' | 'dailyTrading' | 'fundamental' | 'general' | 'political',
  recommendedGem: 'news' | 'macro' | 'technical' | 'fundamental' | 'general' | 'political',
  confidence:     'high' | 'medium' | 'low',
  confidencePct:  number,
  reason:         'string in Hebrew',
  source:         'titleOverride' | 'titleKeywords' | 'transcriptRules' | 'fallback',
}
```

Wrapped via `wrapAsMetadataClassification()` as:
```js
{
  metadata: {
    contentClassification: { ...above, classifiedAt: ISO_STRING }
  }
}
```

### What this module would control, if wired in (currently: nothing)

| Field | Would control |
|---|---|
| `metadata.contentClassification.contentType` | Gemini prompt selection via `getGeminiDispatchType(contentType)` |
| `metadata.contentClassification.recommendedGem` | GEM recommendation UI (recommendation card, selection modal) |

`getGemPromptConfig(contentType)` from `gemContentRouter.js` looks up `promptBuilderKey`,
`schemaKey`, `validatorKey` — but nothing currently calls `getGemPromptConfig` or
`resolveContentClassification` to produce a `contentType` for it to look up. The GEM recommendation
UI's actual `recommendedGem` comes from the **active** layer instead: `preGemClassifier` /
`classifyVideoForGem` in `src/lib/gemRecommender.js`.

---

## Priority Order

| Priority | Source | Function | When |
|---|---|---|---|
| **1** | `titleOverride` | `TITLE_OVERRIDE_RULES` in `gemRecommender.js` | Title matches a deterministic pattern |
| **2** | `titleKeywords` | `classifyVideoForGem` + `news.titleKeywords` | Title/channel keywords match |
| **3** | `transcriptRules` | `classifyVideoForGem` transcript scoring | Transcript > 200 chars available |
| **4** | Validation fallback | `preGemClassifier` | Morning brief title + wrong gem returned |
| **5** | `geminiTranscript` | Future — Gemini classification endpoint | Low confidence after all above |
| **6** | `fallback` | `general` default | No signals found |

The VideoDetailPanel `gemRec` useMemo checks `preGemClassifier` **before** `resolveGemKeyFromSubCategory` and **before** the TranscriptGuard. A `titleOverride` result bypasses both.

---

## Title Override Rules

Defined in `TITLE_OVERRIDE_RULES` in `gemRecommender.js`.

| Pattern | GEM | contentType | Source |
|---|---|---|---|
| `מבזק לייב פתיחה` | `news` / מבזק בוקר | morningBrief | titleOverride |
| `מבזק בוקר` | `news` / מבזק בוקר | morningBrief | titleOverride |

Title overrides have `confidence: 'high'`, `confidencePct: 97`, and **cannot be overridden** by stored `subCategory`, `resolveGemKeyFromSubCategory`, or the market TranscriptGuard.

---

## Transcript-Based Classification Rules

When no title override fires, the transcript is scored against keyword rules.

### Morning Brief / Market Brief (`news`)

Classify as `news` when transcript includes:
- market overview, indices, sectors, stocks mentioned, watchlist
- economic calendar, risks, sentiment, catalysts
- opening/live market brief language
- "מבזק", "מדדים", "סקטורים", "מניות", "מאקרו שבועי"
- "market recap", "morning brief", "today in markets"

### Macro (`macro`)

Classify as `macro` when main focus is:
- interest rates, Fed / central banks, inflation, bonds / yields
- dollar, oil / commodities from macro angle
- recession / growth, geopolitics, broad market regime
- "ריבית", "אינפלציה", "פד", "בנק מרכזי"

### Daily Trading (`dayTrading` in TJS / `technical` in general classifier)

Classify as `dayTrading` / `technical` when main focus is:
- intraday setups, entry/exit levels, support/resistance for today
- trade plan, scalping/day-trade language
- stop loss, target, risk/reward, premarket session actions
- "פריצה", "תמיכה", "התנגדות", "כניסה", "יעד", "סטופ"

### Fundamental (`fundamental`)

Classify as `fundamental` **only** when main focus is:
- company financials, earnings, valuation
- revenue / profit / margins, balance sheet
- analyst ratings, long-term company analysis
- "earnings", "revenue", "EPS", "PE ratio", "balance sheet"

---

## Validation Fallback Rules

Applied in `preGemClassifier` Phase 4:

| Rule | Condition | Action |
|---|---|---|
| Morning brief title must stay news | Title contains morning brief signal + gem ≠ news | Force gem = news |
| Macro must not become fundamental | If macro transcript signals dominate but gem = fundamental | (future) |
| Daily trading must not become fundamental | If day-trade signals dominate but gem = fundamental | (future) |

---

## Examples

| Title / Transcript | Expected GEM | Source |
|---|---|---|
| "מבזק לייב פתיחה לתאריך 25.6.26" | `news` | titleOverride |
| "מבזק לייב פתיחה לתאריך 29.6.26" | `news` | titleOverride |
| "מבזק בוקר יום שני" | `news` | titleOverride |
| "premarket analysis nasdaq" | `news` | titleKeywords |
| "סקירת בוקר שוק ההון" | `news` | titleKeywords (+ validation fallback) |
| transcript: Fed/rates/inflation > 200 chars | `macro` | transcriptRules |
| transcript: entry/stop/resistance/intraday | `technical` / `dayTrading` | transcriptRules |
| transcript: earnings/valuation/EPS/revenue | `fundamental` | transcriptRules |
| "ניתוח פוליטי" + political contentType | `political` | titleKeywords |
| "ארוחת בוקר קטוגנית" | `general` | fallback |

---

## Files

| File | Role |
|---|---|
| `src/ai/gemini/gemContentRouter.js` | **Dormant.** Not imported anywhere (verified 2026-07-26). Contains its own `TITLE_OVERRIDE_RULES`, `CONTENT_SIGNALS`, `GEM_PROMPT_CONFIG_TABLE`, `resolveContentClassification`, `getGemPromptConfig` — none currently called by live code. Not the source of truth; retained as dormant scaffolding pending a separate lifecycle decision. See `docs/adr/ADR_TITLE_OVERRIDE_SOURCE_OF_TRUTH.md`. |
| `src/lib/gemRecommender.js` | **Active — authoritative source of truth** for title-override/GEM-recommendation behavior: `TITLE_OVERRIDE_RULES`, `preGemClassifier`, `classifyVideoForGem`. Its `TITLE_OVERRIDE_RULES` array is not mechanically synchronized with `gemContentRouter.js`'s copy — the two currently differ in field shape and in the `contentType` value used (`'morningBrief'` here vs. `'marketBrief'` there); this has no live effect since only this file's copy executes. |
| `src/components/dashboard/VideoDetailPanel.jsx` | `gemRec` useMemo — calls `preGemClassifier` (the active layer) first |
| `src/components/dashboard/GemRecommendationCard.jsx` | UI display of recommendation |
| `src/components/dashboard/GemSelectionModal.jsx` | UI selection modal using `recommendedGemKey` |
| `scripts/test-morning-brief-routing.mjs` | **Not a production-code regression test.** Contains manually copied "minimal" reimplementations of the classification logic (explicitly labeled as such in its own comments) and does not import `gemRecommender.js` or `gemContentRouter.js`. Its assertions validate the hand-copied logic, not the real source files. |
| `docs/MORNING_BRIEF_GEMS_ROUTING.md` | Morning Brief routing source-of-truth |
| `docs/GEMS_OUTPUT_LANGUAGE_RULES.md` | Language rules for GEM prompt output |
| `docs/adr/ADR_TITLE_OVERRIDE_SOURCE_OF_TRUTH.md` | Verified runtime call graph, architecture decision, and rationale for the active/dormant split above |

---

## Regression Fixture

```bash
node scripts/test-morning-brief-routing.mjs
# → passes (see current count in file header)
```

Covers: title override (sections 6-7), transcript classification (section 8), non-market isolation
(section 9), a hand-copied `resolveContentClassification`-style function (section 10).

> ⚠️ **This script does not import `src/lib/gemRecommender.js` or `src/ai/gemini/gemContentRouter.js`.**
> It re-implements their logic inline (see the script's own "Minimal copy of ..." comments). A pass
> here confirms the copied logic behaves as expected — it does **not** prove the real production
> files still behave the same way. Treat it as a specification/regression-intent document, not a
> production-code test. See `docs/adr/ADR_TITLE_OVERRIDE_SOURCE_OF_TRUTH.md` for the verified detail.
