# GEMS Tab Mapping — Regression Rules

Source of truth for how GEM JSON is mapped to Universal Tabs.

---

## Gemini Market Brief structured-output safety

Gemini Market Brief output must use provider-supported structured JSON, one shared strict parser, at most one bounded provider repair attempt, schema validation before persistence, and preservation of the previous valid payload on failure. Complete outer Markdown fences may be removed deterministically; ambiguous internal quotes must never be guessed or rewritten locally. Empty, malformed, truncated, schema-invalid, and partial responses remain distinct failure states and must not be persisted.

## Safe analysis-failure handoff

Transcript, provider, JSON, schema, repair and persistence failures use one deterministic classification contract. User-facing failures must explain the category and stage in Hebrew, state whether the current payload is repairable, and confirm whether previous valid data was preserved. A malformed JSON response must not be mislabeled as a missing transcript.

The Codex handoff is clipboard-only and runs locally after an explicit click. It includes a bounded context window of at most 300 characters before and after the parser position, redacts credentials, replaces transcripts with `[FULL TRANSCRIPT REDACTED]`, and never includes a full oversized payload or browser-storage dump. No report is transmitted automatically and report generation never invokes an AI provider.

The bounded excerpt must mark the exact zero-based parser offset and character. Message-provided line/column and offset-derived line/column are retained independently; disagreements are reported rather than silently resolved. Raw provider/captured input and the exact parser input are compared through redacted bounded excerpts, lengths and non-sensitive hashes. Identical hashes show that no application transformation changed the captured string before parsing; differing hashes require auditing the named preprocessing stage before assigning the corruption source.

Repair diagnostics must record the attempt count and eligibility. Automatic Market Brief extraction runs at most one connected provider repair after strict parsing fails. Manual GEMS paste never invokes a paid provider automatically; its report records attempt count `0` and explains that AI repair requires an explicit user action.

Current-payload repair and future code remediation are separate actions: `תקן JSON` may change only the pasted candidate, while `העתק דוח תיקון ל־Codex` creates a sanitized development prompt and does not repair, import or persist data. `התחל ניתוח` remains disabled until strict parsing and schema validation succeed. Failure fingerprints are derived only from normalized non-sensitive diagnostic properties, never from a transcript or full payload.

## Summary main-conclusion compatibility

The resolved Summary conclusion uses this read-time priority without rewriting stored payloads:

1. `marketBriefData.universalTabs.summary.mainConclusion`
2. `marketBriefData.mainLesson`
3. `video.mainLesson`

`mainLesson` is a Summary fallback, not an automatic Useful Knowledge or Specialized item. Before displaying a fallback, normalized exact-text comparison checks the canonical conclusion, Summary takeaways, learning insights, and reusable knowledge. An identical fallback is classified as a duplicate and is not rendered twice. Existing, future GEMS, canonical AI, and legacy videos receive this behavior without storage migration.

## Data Layer Hierarchy

```
marketBriefData (the stored GEM JSON)
├── universalTabs          ← UI layer (preferred)
│   ├── summary            → Summary tab
│   ├── chapters           → Chapters tab
│   ├── insights           → Insights tab
│   ├── usefulKnowledge    → Useful Knowledge tab
│   ├── appBuilder / app   → APP tab
│   ├── topicsSubtopics    → Topics & Subtopics / Obsidian Mapping tab
│   └── specialized        → Specialized tab (badge only; actual render uses MorningBriefDashboard)
├── rawData                ← Source of truth (fallback when universalTabs is absent/thin)
│   ├── marketOverview     ← object: { text, marketMood, ... }
│   ├── marketNews         ← array
│   ├── indices            ← array
│   ├── macroFactors       ← array
│   ├── stocksMentioned    ← array
│   ├── watchlistLevels    ← array
│   ├── keyLevels          ← array
│   ├── catalysts          ← array
│   ├── sectorRotation     ← array
│   ├── tradingOpportunities ← array
│   ├── economicCalendar   ← array
│   ├── earnings           ← array
│   ├── risks              ← array
│   ├── sentiment          ← array or object
│   ├── top5Insights       ← array
│   ├── reusableKnowledge  ← array
│   ├── learningInsights   ← array
│   └── appBuilding        ← object
└── (legacy flat fields)   ← top-level arrays (oldest format, lowest priority)
```

---

## Extraction Priority Rules

### For each Universal Tab:

1. **universalTabs.X** — checked first. If present and non-empty → return it.
2. **rawData.X** — fallback when universalTabs.X is missing, empty, or too thin.
3. **video.X / legacy fields** — last resort for non-market-brief videos.

### For Morning Brief Specialized Tab:

Rendered by `MorningBriefDashboard` (not a flat item list).

- `market-news` items come from `extractVideoTabItems('market-news', ...)`:
  - Reads from `resolveSpecialized(marketBriefData)` which merges rawData + top-level + universalTabs.specialized (spec wins for same-named keys)
  - `marketOverview.text` is extracted as a clean string — NOT via `pickObjectAsStrings` to avoid "text: ..." label leakage
  - `filterDiagnosticItems` is applied to remove markdown fences / repair report text

- `indices` and `brief-macro` follow same `resolveSpecialized` pattern.

- `MorningBriefPanels` sections (MarketRegimeSection, SectorOverviewSection, etc.) use `getSpecializedSrc → mergeMorningBriefSpecializedSource` which does a proper array union-merge.

---

## Diagnostic Content Guard

**Rule:** Repair diagnostics must never become displayed content.

Items matching any of these patterns are filtered out by `isDiagnosticItem()`:
- Strings starting with ` ``` ` (markdown code fences)
- Strings matching `## Repaired JSON Preview`
- Strings matching `## Original Error Context`
- Strings matching `## How To Prevent It`
- Strings matching `## Suggested Prompt/Schema Correction`
- Strings matching `## Error Summary/Context/Info`

`filterDiagnosticItems(arr)` is applied in:
- `extractVideoTabItems('market-news', ...)`
- `extractVideoTabItems('specialized', ...)`

---

## marketOverview Field Rule

`marketOverview` is an OBJECT with text narrative fields:
```json
{ "text": "...", "marketMood": "bearish", "direction": "down" }
```

**Wrong:** `pickObjectAsStrings(src, 'marketOverview')` → produces `["text: ...", "marketMood: bearish"]`

**Correct:** `pickStringAsArray(src.marketOverview, 'text', 'summary', 'overview', 'briefSummary')` → produces `["..."]`

This prevents "text:" and "marketMood:" from appearing as separate raw-label items in the news section.

---

## Morning Brief Title Override Rule

**Hard Rule (must never be removed):**

If `video.title` contains `"מבזק לייב פתיחה"` or `"מבזק בוקר"`:
- GEM routing → `news` GEM (מבזק בוקר)
- `effectiveBriefSlug` → `'morning-brief'`
- Specialized tab → `MorningBriefDashboard`
- `contentType` in GEM JSON must be `'marketBrief'`

Implemented in:
- `TITLE_OVERRIDE_RULES` in `src/lib/gemRecommender.js`
- `preGemClassifier()` in `src/lib/gemRecommender.js` (called from `VideoDetailPanel.jsx`)
- `MORNING_BRIEF_KEYWORDS` in `src/config/videoTabsConfig.js`
- `TITLE_OVERRIDE_RULES` in `src/ai/gemini/gemContentRouter.js`

---

## GEM Schema Versions

| Version | Structure | Notes |
|---------|-----------|-------|
| Morning Brief | `contentType: 'marketBrief'` + `universalTabs.*` + legacy flat fields | Standard morning brief GEM |
| Macro GEM | `contentType: 'market'` + `universalTabs.*` | Routed via `_applyParsedGems` |
| rawData variant | `rawData.*` at top level | Some GEMs output data inside `rawData` wrapper |

All three are supported. `resolveSpecialized` and rawData fallbacks cover the third case.

---

## What NOT To Do

- Do NOT store repair report text (buildGemsJsonRepairReport output) into marketBriefData
- Do NOT use `pickObjectAsStrings(src, 'marketOverview')` — it produces raw label strings
- Do NOT skip `filterDiagnosticItems` when extracting from arrays that might contain GEM output
- Do NOT remove the Morning Brief title override rules (commit cf8c3cf)
- Do NOT change `universalTabs` priority over rawData in `resolveSpecialized`

## Specialized Coverage and Export Contract

- `buildMorningBriefBulkSections` is the shared source of truth for visible Specialized rows and selected-item export.
- No fixed item-count limit is applied; payloads with more than 30 meaningful rows remain available.
- Enum/status values must include their semantic label and must not render as standalone `mixed`, `out`, or `into`.
- Market rows require a real asset label; partial objects must never render as `— · status`.
- Preserve meaningful `0` and `false` values.
- Preserve valid scalar market levels and enrich their existing parent rows; never create a second row for the same source asset.
- Preserve known contextual level fields such as condition, importance, and action on the existing level row.
- Do not indiscriminately expose unknown raw properties, nested objects, or arrays; every displayed field requires a known semantic contract.
- Levels, top insights, learning insights, and `allPoints` are explicit Specialized sections when present.
- Deduplicate only identical source facts within a section; do not collapse distinct facts solely because their wording is similar.

Regression script: `scripts/test-specialized-content-coverage.mjs`

### Sector destination and representative-ETF contract

- Sector names and the general sector shortcut open the canonical Finviz overview: `https://finviz.com/groups.ashx?g=sector&v=140`; sector navigation never falls back to the generic Finviz homepage.
- Representative ETF precedence is: valid normalized source `etf`, valid legacy sector metadata, then the controlled sector-alias registry.
- A resolved representative ETF receives its own Finviz quote action; it is described as a representative proxy, not an exact sector identity.
- Unknown sector text and generic risk-asset wording receive no guessed ETF action. Stored GEMS payloads are never rewritten.

### Manual stock-field override contract

- Imported GEMS and raw structured fields remain immutable; manual values live only under `marketBriefData.manualOverrides.stocksMentioned.fieldOverrides`.
- Field overrides are keyed by stable stock identity (`stock:<canonical ticker>`) and field name.
- Display precedence is: explicit manual field override, canonical structured value, existing fallback, empty placeholder.
- Removing one field override restores the current canonical value without deleting other manual fields.
- GEMS re-import and re-analysis preserve the override layer while keeping newly extracted canonical data underneath it.
- Selection state remains temporary UI state and is not stored with manual field overrides.

### Canonical stock identity and TradingView destination

- Stock identity is `ticker + exchange`; the public destination is `https://il.tradingview.com/symbols/<EXCHANGE>-<TICKER>/`.
- Resolution priority is an explicit supported source `exchange`, then the centralized verified ticker-to-exchange registry, otherwise no TradingView link.
- New GEMS payloads may provide optional `stocksMentioned[].exchange`; legacy payloads remain supported through the verified registry.
- Ambiguous, invalid, non-stock, and missing-exchange values remain readable but unlinked. No NASDAQ fallback or private TradingView layout URL is allowed.
- AI Mapping reports the deterministic stock-link status without classifying a missing external link as lost Specialized content.

### P0 normalization rules

- Reject asset-only market rows; a recognized asset must also have a level, change, direction, note, or structured status. Preserve numeric `0` and boolean `false`.
- Canonicalize the explicit `BTC` alias to `BITCOIN` without rewriting stored legacy payloads.
- Keep `currentValue`, `dailyLow`, `support`, and `resistance` as distinct roles. A technical level never replaces a current market value.
- Preserve legacy `level` when no stronger role is supplied.
- Preserve relative event wording. Conflicting timing evidence is marked `conflicting` / `מועד לא מאומת`; no date is inferred from the computer clock.

## New-video Market Extraction Contract

- `shared/marketExtractionContract.cjs` owns the canonical optional market payload, evidence rules, bounded transcript chunking, parsing, aggregation, and completeness metrics.
- `backend/analyze-video.function.js` and the local Vite Claude adapter call the same contract; provider adapters may not redefine the schema.
- Long transcripts are processed sequentially in bounded overlapping chunks. Array facts merge by stable semantic identity, existing values win deterministic conflicts, and failed chunks produce explicit partial-analysis metadata.
- Parsing accepts clean JSON or a provider code fence. One provider repair attempt is allowed per malformed chunk; arbitrary objects and unknown fields are not persisted into the canonical payload.
- `video.marketBriefData` and `market_brief_<videoId>` persist the same canonical payload without rewriting historical records.
- Existing summary-only videos remain valid and require no migration or reanalysis.
- `buildMorningBriefBulkSections` remains the only mapper shared by Specialized UI and export.
- Rollback is additive: remove the provider adapters and canonical extraction fields while retaining the mapper commit and existing saved payloads.

---

## Regression Test: "מבזק לייב פתיחה לתאריך 18.6.26"

Expected behavior after fix:
- Summary → non-empty (from `universalTabs.summary` OR `rawData.marketOverview.text` OR `rawData.top5Insights`)
- Insights → non-empty (from `universalTabs.insights` OR `rawData.top5Insights`)
- Useful Knowledge → non-empty (from `universalTabs.usefulKnowledge` OR `rawData.reusableKnowledge`)
- APP → non-empty (from `universalTabs.appBuilder` OR `rawData.appBuilding` OR `rawData.tradingOpportunities`)
- Topics → non-empty (from `universalTabs.topicsSubtopics` OR `rawData.obsidianTopics`)
- Specialized → renders `MorningBriefDashboard` with indices, marketNews, macro, stocks, etc.
- No "Repaired JSON Preview" in any rendered tab item
- No markdown code fences (` ``` `) in any rendered tab item
- No "text: ..." or "marketMood: ..." labels in market-news section
- Market rows show complete data (not truncated via pickObjectAsStrings)

Test script: `scripts/test-morning-brief-routing.mjs`
# Opportunities and Risks fallback rule

Opportunity and risk panels display up to three evidence-backed items. Structured sources take priority, summary warnings/opportunities may be used as labeled fallbacks, semantic duplicates are suppressed, and empty presentation placeholders are never counted or rendered.
