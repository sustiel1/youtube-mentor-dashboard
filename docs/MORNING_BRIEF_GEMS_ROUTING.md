# Morning Brief GEMS Routing Rule

> מקור אמת לנתיב ה-routing של סרטוני מבזק פתיחה לייב.  
> עדכון אחרון: 2026-06-30

---

## Rule

Any video/GEM whose title includes:

```
מבזק לייב פתיחה לתאריך
```

must be classified as `marketBrief` / `morningBrief`, even if the raw `contentType` is missing, generic, or incorrect.

---

## Why

These videos contain structured market brief data including indices, macro factors, stocks mentioned, watchlist levels, sector rotation, trading opportunities, economic calendar, risks, and sentiment.

They must **not** be rendered as generic video analysis.

---

## Routing Chain (effectiveBriefSlug)

Priority order in `VideoDetailPanel.jsx`:

| Priority | Condition | Result |
|---|---|---|
| 1 | `video.subCategory` = "מבזק בוקר" (or other known slugs) | `normalizeSubCategory()` → 'morning-brief' |
| 2 | GEM JSON pasted with `contentType: 'marketBrief'` | `effectiveBriefSlug` → 'morning-brief' |
| **3** | **Title includes "מבזק לייב פתיחה"** | **`videoType` = 'morningBrief' → 'morning-brief'** |
| 4 | None of the above | `null` (generic rendering) |

Priority 3 was added in the fix session of 2026-06-30 via:
- `'מבזק לייב פתיחה'` added to `MORNING_BRIEF_KEYWORDS` in `videoTabsConfig.js`
- `videoType === 'morningBrief'` fallback added to `effectiveBriefSlug` in `VideoDetailPanel.jsx`

---

## Specialized Tab Mapping Requirement

When `effectiveBriefSlug === 'morning-brief'`, the Specialized tab (תוכן ייעודי) renders `MorningBriefDashboard`, which displays all major market brief sections.

### Required Sections

| Section | Hebrew | Data Source |
|---|---|---|
| News | חדשות | `rawData.marketNews` / `universalTabs.specialized.marketNews` |
| Market Regime | מצב שוק | derived from `rawData.marketOverview` |
| Sectors | סקטורים | `rawData.sectorRotation` |
| Opportunities & Risks | הזדמנויות וסיכונים | `rawData.tradingOpportunities` + `rawData.risks` |
| Stocks Mentioned | מניות שהוזכרו | `rawData.stocksMentioned` + `rawData.watchlistLevels` |
| Economic Calendar | לוח כלכלי | `rawData.economicCalendar` |
| Macro | מאקרו | `rawData.macroFactors` |
| Sentiment | סנטימנט | `rawData.sentiment` |
| Markets / Indices | שווקים | `rawData.indices` |

### Data Merge Flow

```
rawData.*  →  universalTabs.specialized.*  →  top-level fields
      ↓
mergeMorningBriefSpecializedSource()
      ↓
getSpecializedSrc()
      ↓
MorningBriefDashboard sections
```

All keys in `SPECIALIZED_MERGE_ARRAY_KEYS` (morningBriefDisplay.js) are merged before display.

---

## GEMS Field Mapping Notes

| GEMS field | Normalizer | Display field | Fixed in |
|---|---|---|---|
| `macroFactors[].notes` | `normalizeMacroIndicatorRow` | description | 2026-06-30 — added 'notes' to pickString |
| `stocksMentioned[].action` | `stockRecordFromObject` | sentiment | 2026-06-30 — added 'action' to sentiment pickString |
| `stocksMentioned[].technicalState` | `stockRecordFromObject` | notes | 2026-06-30 — added 'technicalState' to notes pickString |
| `watchlistLevels[].notes` | `formatWatchlistItem` | reason | 2026-06-30 — added 'notes' + 'context' to reason |
| `stocksMentioned[].notes` | `stockRecordFromObject` | context | 2026-06-30 — added 'notes' to context pickString |

---

## Regression Example

**Title:** `מבזק לייב פתיחה לתאריך 29.6.26`

**Expected classification:** `morningBrief` (via title detection)

**Expected `effectiveBriefSlug`:** `'morning-brief'`

**Expected Specialized tab:** `MorningBriefDashboard` with all sections populated

**Regression fixture:** `scripts/test-morning-brief-routing.mjs`

```bash
node scripts/test-morning-brief-routing.mjs
# → 27 passed, 0 failed
```

---

## Scope: Routing + GEM Recommendation + Gemini Prompt

The Morning Brief title rule applies to ALL three layers:

| Layer | What changes |
|---|---|
| Routing / rendering | `effectiveBriefSlug` → 'morning-brief' → `MorningBriefDashboard` |
| GEM recommendation / auto-selection | `preGemClassifier` returns `gemKey='news'`, `source='titleOverride'` |
| Gemini prompt selection | contentType='market' is already correct for all שוק ההון videos |

Fix added 2026-06-30 (second pass): `preGemClassifier` in `gemRecommender.js` + title override in `gemRec` useMemo in `VideoDetailPanel.jsx`.

---

## Files Changed (2026-06-30)

| File | Change |
|---|---|
| `src/config/videoTabsConfig.js` | Added 'מבזק לייב פתיחה' to `MORNING_BRIEF_KEYWORDS`; added 'notes' + 'context' to `formatWatchlistItem` reason |
| `src/components/dashboard/VideoDetailPanel.jsx` | Added `videoType === 'morningBrief'` fallback to `effectiveBriefSlug` |
| `src/lib/morningBriefDisplay.js` | Added 'notes' to `normalizeMacroIndicatorRow` description; added 'notes' + 'action' + 'technicalState' to `stockRecordFromObject` |
| `scripts/test-morning-brief-routing.mjs` | New — regression fixture (27 assertions) |
| `docs/MORNING_BRIEF_GEMS_ROUTING.md` | New — this document |

---

## Rollback

To revert all changes, remove:
- keyword `'מבזק לייב פתיחה'` from `MORNING_BRIEF_KEYWORDS`
- `videoType === 'morningBrief'` line in `effectiveBriefSlug`
- `'notes'` additions in `normalizeMacroIndicatorRow` and `stockRecordFromObject`
- `'notes'` + `'context'` additions in `formatWatchlistItem`
- `scripts/test-morning-brief-routing.mjs`
- This file
