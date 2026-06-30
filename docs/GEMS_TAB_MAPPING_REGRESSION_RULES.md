# GEMS Tab Mapping — Regression Rules

Source of truth for how GEM JSON is mapped to Universal Tabs.

---

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
