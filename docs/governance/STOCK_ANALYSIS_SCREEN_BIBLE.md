# STOCK ANALYSIS SCREEN BIBLE

```
SOURCE OF TRUTH

Future development must follow this document.

If implementation and documentation differ,
report the contradiction before modifying code.
```

**Project:** YouTube Mentor Dashboard  
**Domain:** שוק ההון (Stock Market)  
**Last updated:** June 2026  
**Canonical code paths:** `VideoDetailPanel.jsx`, `SpecializedContentRenderer.jsx`, `videoTabsConfig.js`, `morningBriefDisplay.js`

---

## Purpose of This Document

This is the **permanent reference architecture** for all stock-market content in the app. It defines how each brief type, analysis type, and cross-cutting concern (watchlists) maps to:

- UI sections (Specialized tab)
- 7 Universal Tabs
- Brain hierarchy
- Obsidian vault paths
- APP Builder consumption

**Important architectural fact:** There are no separate routes or pages for stock analysis screens. Everything renders inside `VideoDetailPanel` — one modal shell for all video types.

---

## Global Architecture

### Entry Point

```
VideoDetailPanel.jsx
  ├── 7 Universal Tabs (always visible)
  └── Tab 7: specialized → SpecializedContentRenderer.jsx
        └── switch(normalizedSubCategory)
              ├── morning-brief    → MorningBriefDashboard.jsx
              ├── evening-brief    → inline sections
              ├── weekly-brief     → inline sections
              ├── earnings-brief   → inline sections
              ├── macro            → inline sections
              ├── technical-analysis → LearningTabContent.jsx sections
              └── fundamental-analysis → LearningTabContent.jsx sections
```

### Slug Map (Hebrew ↔ English)

From `SUB_CATEGORY_SLUG_MAP` in `videoTabsConfig.js`:

| Screen | Slug | Hebrew (DB) |
|--------|------|-------------|
| Morning Brief | `morning-brief` | מבזק בוקר |
| Evening Brief | `evening-brief` | מבזק ערב |
| Weekly Brief | `weekly-brief` | מבזק שבועי |
| Earnings Brief | `earnings-brief` | מבזק דוחות |
| Macro Analysis | `macro` | מאקרו |
| Technical Analysis | `technical-analysis` | ניתוח טכני |
| Fundamental Analysis | `fundamental-analysis` | פונדמנטלי |

### 7 Universal Tabs (All Stock Videos)

Fixed order from `UNIVERSAL_TABS`:

| # | Tab Key | Label | Purpose |
|---|---------|-------|---------|
| 1 | `summary` | סיכום | Executive summary, market mood, top takeaways |
| 2 | `chapters` | פרקים | Timestamped chapters (when data available) |
| 3 | `insights` | תובנות | Top insights, trading lessons, market lessons |
| 4 | `useful-knowledge` | ידע שימושי | Reusable rules, checklists, evergreen knowledge |
| 5 | `app-builder` | APP | Product ideas — gated to שוק ההון, פוליטיקה, טכנולוגיה ו-AI, בריאות ותזונה |
| 6 | `topics-subtopics` | מיפוי ל-Obsidian | AI recommendations, tags, topics, path preview |
| 7 | `specialized` | תוכן ייעודי | Sub-category-specific dashboard or sections |

Data extraction: `extractUniversalTabContent()` in `universalTabSections.js`.  
GEM schema key: `universalTabs.*` (preferred) with legacy field fallback.

---

## Screen-by-Screen Reference

---

### 1. Morning Brief (מבזק בוקר)

**Slug:** `morning-brief`  
**Context header:** 🌅 מבזק בוקר / ⏰ לפני פתיחת המסחר  
**Primary component:** `MorningBriefDashboard.jsx`

#### Purpose

Pre-market briefing dashboard. Fixed 10-section layout always visible (including empty states). Presentation layer only — does **not** change GEM schema or prompts.

#### Expected Output

A scannable morning dashboard covering: news, market regime, sectors, opportunities/risks, stocks mentioned, economic calendar, macro, sentiment, and markets table.

#### Data Model

**GEM preferred structure** (`morningBriefSchema.js`):

```json
{
  "universalTabs": {
    "summary": { "shortSummary", "marketMood", "topTakeaways" },
    "chapters": [...],
    "insights": { "top5Insights", "tradingInsights" },
    "usefulKnowledge": { "reusableKnowledge", "actionChecklist", "rules" },
    "appBuilder": { "kpiList", "dashboards", "prompts", "suggestedFeatures" },
    "topicsSubtopics": [...],
    "specialized": {
      "indices", "marketNews", "stocksMentioned", "macro",
      "sentiment", "calendar", "opportunities", "risks"
    }
  }
}
```

**Merge order** (`morningBriefDisplay.js`): `raw → legacy → spec`  
**Key array fields:** `indices`, `marketNews`, `macro`, `stocksMentioned`, `watchlist`, `watchlistLevels`, `opportunities`, `risks`, `calendar`, `sectors`

#### 10 Specialized Sections (Fixed Order)

| # | Section | Component | tabKey (bulk) |
|---|---------|-----------|---------------|
| 1 | 📰 חדשות | `NewsSection` | `market-news` |
| 2 | 📊 מצב שוק | `MarketRegimeSection` | `indices` |
| 3 | 📊 סקטורים | `SectorOverviewSection` | `brief-sectors` |
| 4 | הזדמנויות + סיכונים | `OpportunitiesRisksDashboard` | `brief-opportunities`, `brief-risks` |
| 5 | ⭐ מניות שהוזכרו | `StocksMentionedSection` | `stocks-mentioned` |
| 6 | 📅 לוח כלכלי | `EconomicCalendarSection` | `brief-calendar` |
| 7 | 🌍 מאקרו | `MacroSection` | `brief-macro` |
| 8 | 📊 סנטימנט | `SentimentSection` | `brief-sentiment` |
| 9 | 📈 שווקים | `MarketsSection` | `indices` |

Bulk mapping: `buildMorningBriefBulkSections()` in `morningBriefBulkSections.js`.

#### Universal Tabs Mapping

| Universal Tab | Data Source |
|---------------|-------------|
| summary | `universalTabs.summary` or `top5Insights` |
| chapters | `universalTabs.chapters` |
| insights | `universalTabs.insights` |
| useful-knowledge | `universalTabs.usefulKnowledge` |
| app-builder | `universalTabs.app` / `appBuilder` |
| topics-subtopics | `universalTabs.topicsSubtopics` |
| specialized | `MorningBriefDashboard` (10 sections) |

Field mapping helper: `getMorningBriefFieldMapping()` in `morningBriefDisplay.js`.

#### Obsidian Behavior

- **Video-level path:** `שוק ההון/מבזק בוקר/V-{slug}.md` via `resolveVideoObsidianRoute()`
- **Planned path (docs):** `שוק ההון/מבזקי בוקר/{date}` — **known drift** vs runtime slug-based routing
- **Per-row/bulk save:** merge engine with HTML comment markers (`obsidianNoteMerge.js`)
- **Keyword routing:** watchlist/scanner keywords → `שוק ההון/רשימות מעקב`

#### Brain Behavior

- Per-item save → `localKnowledgeItemStore` (`yt_knowledge_items_v1`)
- ID pattern: `brain-item:{videoId}:{tab}:{textKey}`
- Suggested SubBrains: `רשימות מעקב`, `מאקרו`, `ניתוח טכני`, `דוחות ורווחים`
- Bulk: `UniversalTabBulkProvider` + `MorningBriefBulkCheckbox`

#### APP Builder Integration

- Tab visible for `שוק ההון`
- `extractAppIdeas()` reads: `watchlistLevels`, `opportunities`, `risks`, `alerts`
- Watchlist content triggers `Watchlist Manager` idea (`IDEA_SUFFIX_RULES`)
- Obsidian path: `App Ideas/Stock Market/` or `App Ideas/Market App Brain/`
- APP Builder **consumes** knowledge — does not generate analysis

---

### 2. Evening Brief (מבזק ערב)

**Slug:** `evening-brief`  
**Context header:** 🌇 מבזק ערב / 🌙 לאחר סיום המסחר  
**Component:** `SpecializedContentRenderer.jsx` (inline sections)

#### Purpose

End-of-day market summary. Dynamic sections — only rendered when data exists (unlike Morning Brief's fixed dashboard).

#### Expected Output

Daily recap: macro updates, market review (indices), sector performance, what changed today, tomorrow's events, watchlist, opportunities, risks.

#### Data Model

Same GEM `universalTabs` + `specialized` structure as Morning Brief.  
Additional fields from `video.analysis` top-level: `brief-sectors`, `brief-changes`, `brief-tomorrow`.

#### Specialized Sections

| Section | tabKey | Notes |
|---------|--------|-------|
| 📋 עדכוני מאקרו | `market-news` | Textual news |
| 📊 סקירת שוק | `indices` | **This is Market Review** — `MarketIndicesTable` |
| 📰 עדכוני שוק | `market-news` | Index-like table |
| 🌍 מאקרו | `brief-macro` | |
| 📊 סנטימנט שוק | `brief-sentiment` | `macroDirection` chip |
| 📊 ביצועי סקטורים | `brief-sectors` | |
| 🔄 מה השתנה היום | `brief-changes` | |
| 📅 אירועי מחר | `brief-tomorrow` | |
| 📅 לוח כלכלי | `brief-calendar` | |
| 🎯 רשימת מעקב | `stocks-mentioned` | |
| 💡 הזדמנויות | `brief-opportunities` | |
| ⚠️ סיכונים | `brief-risks` | |

Legacy tab config: `EVENING_BRIEF_TABS` in `videoTabsConfig.js`.

#### Universal Tabs Mapping

Same 7-tab structure. Specialized tab renders evening-specific sections.  
GEM key: `news` via `resolveGemKeyFromSubCategory()`.

#### Obsidian / Brain / APP Builder

- Obsidian planned: `שוק ההון/מבזקי ערב/`
- Brain SubBrains: `מאקרו`, `רשימות מעקב`
- APP Builder: same cross-topic rules as Morning Brief

---

### 3. Weekly Brief (מבזק שבועי)

**Slug:** `weekly-brief`  
**Context header:** 📆 מבזק שבועי / 📆 סיכום והיערכות לשבוע

#### Purpose

Weekly market recap and forward outlook.

#### Expected Output

Week highlights, market performance table, winners/losers, macro review, sentiment, calendar, next-week forecast, watchlist, opportunities, risks.

#### Data Model

Shared brief fields + week-specific:
- `brief-highlights` ← `video.weeklyHighlights`
- `brief-winners` ← `video.winners`
- `brief-losers` ← `video.losers`
- `brief-outlook` ← `video.weeklyOutlook`

#### Specialized Sections

כותרות השבוע, סיכום שוק, ביצועי שוק (`indices`), חדשות, מאקרו, מנצחים, מפסידים, סנטימנט, לוח כלכלי, תחזית שבוע הבא, רשימת מעקב, הזדמנויות, סיכונים.

#### Universal Tabs / Obsidian / Brain / APP Builder

Standard 7-tab mapping. Obsidian: `שוק ההון/מבזקי שבועי/`.

---

### 4. Earnings Brief (מבזק דוחות)

**Slug:** `earnings-brief` (also `דוחות ורווחים` in mockData — not in slug map)  
**Context header:** 📈 מבזק דוחות / 📈 עונת דוחות

#### Purpose

Earnings season briefing — financial metrics, guidance, management commentary.

#### Expected Output

Financial metrics table, earnings guidance, management commentary, macro context, sentiment, calendar, market background, news, indices, watchlist, opportunities, risks.

#### Data Model

Dedicated fields:
- `financial-metrics`
- `earnings-guidance`
- `earnings-commentary`

Plus shared brief fields.

#### Specialized Sections

מדדים פיננסיים, תחזיות, פרשנות הנהלה, מאקרו, סנטימנט, לוח כלכלי, רקע שוק, חדשות, שווקים, רשימת מעקב, הזדמנויות, סיכונים.

#### Obsidian / Brain

- Obsidian: `שוק ההון/דוחות כספיים/`
- Brain SubBrain: `דוחות ורווחים`

---

### 5. Market Review (סקירת שוק)

**Status: NOT a standalone screen — cross-cutting section**

#### Purpose

Market indices and performance review. Appears within Evening Brief (and other briefs) as the indices/market close section.

#### Where It Appears

| Location | Implementation |
|----------|----------------|
| Evening Brief tab label | `EVENING_BRIEF_TABS` → `indices` = `סקירת שוק` |
| Evening Brief section | `📊 סקירת שוק` in `SpecializedContentRenderer` |
| Data extraction | `extractVideoTabItems(..., 'indices')` |
| Component | `MarketIndicesTable.jsx` |

#### Data Model

Fields: `specialized.indices`, `indexPerformance`, `keyLevels`, `sectorRotation`.

#### Universal Tabs Mapping

Indices data may appear in:
- Tab 7 specialized (evening/weekly brief sections)
- Tab 1 summary (market mood context)

#### Obsidian / Brain / APP Builder

Saved as part of parent brief's per-row/bulk flows. No separate vault folder.

---

### 6. Macro Analysis (מאקרו)

**Slug:** `macro`  
**Context header:** 🏦 מאקרו / 🏦 אירועי מאקרו וכלכלה

#### Purpose

Macroeconomic events and their market impact.

#### Expected Output

Macro events list, market indices context, opportunities derived from macro analysis.

#### Data Model

Fields: `cause-effect`, `market-impact`, `brief-macro` from `video.analysis` + `specialized.macro*`.  
GEM key: `"macro"`.

#### Specialized Sections

| Section | tabKey |
|---------|--------|
| 🌍 אירועי מאקרו | `brief-macro` |
| 📊 שווקים | `indices` + `MarketIndicesTable` |
| 💡 הזדמנויות | `brief-opportunities` |

Legacy tabs (`MACRO_TABS`): סיכום, פרקים, מושגים, סיבה ותוצאה, השפעה על השוק, צ'קליסט מאקרו, סיכונים, תובנות, ידע שימושי, רעיונות אפליקציה.

#### Obsidian / Brain

- Obsidian: `שוק ההון/מאקרו/`
- Brain SubBrain: `מאקרו`
- AiMappingModal label: `Macro Analysis (GEM מאקרו)`

---

### 7. Technical Analysis (ניתוח טכני)

**Slug:** `technical-analysis`  
**Component:** `LearningTabContent.jsx` for item rendering

#### Purpose

Educational technical analysis — indicators, setups, patterns, rules, common mistakes.

#### Expected Output

Structured learning items per section: indicators, trading setups, chart patterns, checklists, mistakes.

#### Data Model

From `video.analysis` / `video.analysis.learning`:
- `indicators`, `setups`, `patterns`, `checklists`, `mistakes`

GEM key: `"technical"`.

#### Specialized Sections

| Section | tabKey |
|---------|--------|
| 📈 אינדיקטורים | `indicators` |
| 🎯 סטאפים | `setups` |
| 📊 פטרנים | `patterns` |
| ✅ כללים | `checklists` |
| ⚠️ טעויות | `mistakes` |

Legacy tabs (`TECHNICAL_TABS`): full educational tab set.

#### Obsidian / Brain

- Obsidian keyword rule: `שוק ההון/ניתוח טכני`
- Brain SubBrains: `ניתוח טכני`, `אינדיקטורים`, `אסטרטגיות`

---

### 8. Fundamental Analysis (פונדמנטלי)

**Slug:** `fundamental-analysis`

#### Purpose

Educational fundamental analysis — financial metrics, valuation, frameworks.

#### Expected Output

Financial metrics, valuation methods, analysis frameworks, investment checklist, risks, rules.

#### Data Model

Fields: `financial-metrics`, `valuation`, `analysis-frameworks`, `investment-checklist`, `mistakes`, `checklists`.  
GEM key: `"fundamental"`.

#### Specialized Sections

מדדים פיננסיים, הערכת שווי, מסגרות ניתוח, צ'קליסט השקעה, סיכונים, כללים.

#### Obsidian / Brain

- Obsidian: `שוק ההון/פונדמנטלי`
- Brain SubBrain: `פונדמנטלי`

---

### 9. Watchlists (רשימות מעקב)

**Status: NOT a standalone screen — cross-cutting concern**

#### Purpose

Track mentioned stocks, watchlist levels, opportunities, and risks across all brief types.

#### Where It Appears

| Layer | Implementation |
|-------|----------------|
| UI tab key | `stocks-mentioned` → label `רשימת מעקב` |
| Morning Brief | `StocksMentionedSection`, `extractUnifiedStocks()` |
| GEM fields | `stocksMentioned`, `stocks`, `watchlist`, `tickers`, `watchlistLevels`, `keyLevels` |
| Formatter | `formatWatchlistItem()` in `videoTabsConfig.js` |
| Categories | `watchlist`, `opportunity`, `risk`, `general` — `CATEGORY_RANK` in `morningBriefDisplay.js` |

#### Data Model

Rich multi-line format per item:
- symbol, reason, importance, catalyst, level
- direction tone (עולה/יורדת/פריצה/דילול)
- category color: opportunity=emerald, watchlist=sky, risk=red

#### Universal Tabs Mapping

- Tab 7 specialized: `StocksMentionedSection` (morning) or `stocks-mentioned` section (other briefs)
- Tab 3 insights: may include stock-related insights
- Tab 5 app-builder: watchlist → `Watchlist Manager` idea

#### Obsidian Behavior

- Folder: `שוק ההון/רשימות מעקב`
- Keywords: `watchlist`, `scanner` in `FOLDER_KEYWORD_RULES` (`obsidianExport.js`)

#### Brain Behavior

- SubBrain folder: `רשימות מעקב` in `brainStructure.js`
- Topic taxonomy: `sb_sm_watchlist` "רשימות מעקב" in `mockData.js`

#### APP Builder Integration

- `watchlistLevels` in specialized → triggers Watchlist Manager feature idea
- `IDEA_SUFFIX_RULES` maps watchlist content to product concepts
- APP Builder reads watchlist data; does not create watchlist entries

---

## Obsidian Vault Structure (Stock Market)

**Planned hierarchy** (from `AI_DEVELOPMENT_GUIDE.md` §34):

```
שוק ההון/
├── ניתוח טכני/
├── ניתוח פונדמנטלי/
├── מאקרו/
├── מבזקי בוקר/
├── מבזקי ערב/
├── מבזקי שבועי/
├── דוחות כספיים/
├── רשימות מעקב/
└── ידע לשימוש חוזר/
```

**Runtime routing** (`obsidianRouting.js`): `{category}/{subCategory}/V-{slug}.md`

**Known drift:** Docs use Hebrew plural folder names (`מבזקי בוקר`); runtime uses slug or Hebrew singular (`מבזק בוקר`). QA scripts may use English slug (`morning-brief/`). Report contradictions before changing paths.

---

## Brain Hierarchy (Stock Market)

From `brainStructure.js` — SubBrains under `שוק ההון`:

```
מסחר יומי | אסטרטגיות | אינדיקטורים | שיטת הרצפים | פונדמנטלי
מאקרו | מניות AI | ניהול סיכונים | מסחר סווינג | ניתוח טכני
השקעות לטווח ארוך | אופציות | רשימות מעקב | דוחות ורווחים | טראמפ ושוק ההון
```

---

## APP Builder Rules (Stock Market)

**Gating:** `APP_BUILDER_TOPICS` includes `שוק ההון`.

**Principle:** APP Builder **consumes** extracted knowledge — it does not generate market analysis.

**Data sources:**
- `specialized.opportunities`, `watchlistLevels`, `risks`
- `universalTabs.app.*` (kpiList, dashboards, prompts, suggestedFeatures)
- `insights.marketLessons`

**Storage paths:**
- `App Ideas/Stock Market/` (per `AI_DEVELOPMENT_GUIDE.md` §26)
- `App Ideas/Market App Brain/` (runtime in `appIdeasBrainObsidian.js`)

**Sections** (`APP_BUILDER_SECTIONS` in `appBuilderStore.js`):
summary, requirements, screens, logic, risks, tasks, prompt

---

## Documentation vs Implementation Drift

| Topic | Docs Say | Code Does | Action Required |
|-------|----------|-----------|-----------------|
| Morning Brief tabs | §6 lists 9 tabs (Stock of the Day, etc.) | 10 fixed dashboard sections | This bible reflects **code**; §6 in AI_DEVELOPMENT_GUIDE is outdated |
| Obsidian morning path | `מבזקי בוקר/{date}` | `שוק ההון/מבזק בוקר/V-{slug}.md` | Align on next vault migration |
| Legacy tab arrays | `MORNING_BRIEF_TABS`, `TECHNICAL_TABS`, etc. | UI uses `UNIVERSAL_TABS` only | Legacy arrays used for extraction, badges, AiMappingModal |
| Earnings slug | `earnings-brief` | Also `דוחות ורווחים` in mockData | Add to `SUB_CATEGORY_SLUG_MAP` |

---

## Key Files Index

| Concern | File |
|---------|------|
| Shell | `src/components/dashboard/VideoDetailPanel.jsx` |
| Specialized router | `src/components/dashboard/SpecializedContentRenderer.jsx` |
| Morning Brief dashboard | `src/components/dashboard/MorningBriefDashboard.jsx` |
| Morning Brief sections | `src/components/dashboard/MorningBriefPanels.jsx` |
| Data merge/extract | `src/lib/morningBriefDisplay.js` |
| Bulk sections | `src/lib/morningBriefBulkSections.js` |
| Slug map + extraction | `src/config/videoTabsConfig.js` |
| Universal tab extraction | `src/lib/universalTabSections.js` |
| APP ideas extraction | `src/lib/extractAppIdeas.js` |
| Obsidian routing | `src/lib/obsidianRouting.js` |
| Brain hierarchy | `src/config/brainStructure.js` |
| GEM schema example | `src/ai/gemini/schemas/morningBriefSchema.js` |
| Visual system | `src/lib/morningBriefVisuals.js` |
| Stock status display | `src/lib/stockStatusDisplay.js` |

---

*This document supersedes scattered references in `AI_DEVELOPMENT_GUIDE.md` §6 and §24 for stock screen architecture. For save flows see `SAVE_SYSTEM_ARCHITECTURE.md`. For UX rules see `DESIGN_SYSTEM_AND_UX_RULES.md`.*
