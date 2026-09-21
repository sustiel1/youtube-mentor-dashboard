# Screens & GEMs Architecture Mapping — youtube-mentor-dashboard

**תקציר (עברית):** מסמך זה הוא ביקורת ארכיטקטורה מלאה של אפליקציית youtube-mentor-dashboard, מיועד לסקירה על ידי מודלים חיצוניים (Claude/ChatGPT/Gemini) ללא גישה לריפו. כל טענה מגובה בציטוט `path:line`; טענה שלא אומתה ישירות מסומנת `UNVERIFIED`. המסמך נבנה על ידי שישה סוכני-מחקר מקבילים שקראו את הקוד בפועל (read-only), וסוכם על ידי סשן יחיד.

---

## Table of Contents

- [0. Audit metadata](#0-audit-metadata)
- [1. Screen & tab inventory](#1-screen--tab-inventory)
  - [1.1 Routing mechanism](#11-routing-mechanism)
  - [1.2 Navigation hierarchy](#12-navigation-hierarchy)
  - [1.3 VideoDetailPanel — the "7 universal tabs"](#13-videodetailpanel--the-7-universal-tabs)
  - [1.4 Dead tab-configuration subsystem](#14-dead-tab-configuration-subsystem)
  - [1.5 Hidden/orphan tabs and a likely runtime bug](#15-hiddenorphan-tabs-and-a-likely-runtime-bug)
  - [1.6 Where political content actually renders](#16-where-political-content-actually-renders)
  - [1.7 Modals and dialogs](#17-modals-and-dialogs)
  - [1.8 Workspace Library screen structure](#18-workspace-library-screen-structure)
  - [1.9 Hebrew/RTL handling](#19-hebrewrtl-handling)
  - [1.10 User interaction flows](#110-user-interaction-flows)
- [2. Fundamental GEMS — full detail](#2-fundamental-gems--full-detail)
  - [2.1 Artefact inventory](#21-artefact-inventory)
  - [2.2 Classification, registry, confidence score, manual override](#22-classification-registry-confidence-score-manual-override)
  - [2.3 System instructions — verbatim](#23-system-instructions--verbatim)
  - [2.4 Schema contract doc — verbatim](#24-schema-contract-doc--verbatim)
  - [2.5 Example JSON — verbatim](#25-example-json--verbatim)
  - [2.6 Field-by-field table](#26-field-by-field-table)
  - [2.7 Flat schema vs. universalTabs/marketBrief schema](#27-flat-schema-vs-universaltabsmarketbrief-schema)
  - [2.8 Two ingestion chains](#28-two-ingestion-chains)
  - [2.9 Tab 7 behavior and the APP-tab contradiction](#29-tab-7-behavior-and-the-app-tab-contradiction)
  - [2.10 Other GEMs — implemented vs. planned](#210-other-gems--implemented-vs-planned)
- [3. Gemini integration](#3-gemini-integration)
- [4. State & component mapping](#4-state--component-mapping)
  - [4.1 Global state inventory](#41-global-state-inventory)
  - [4.2 Persistence](#42-persistence)
  - [4.3 Data-flow diagrams](#43-data-flow-diagrams)
  - [4.4 Screen → reads/writes/owns table](#44-screen--readswritesowns-table)
  - [4.5 Cross-component coupling](#45-cross-component-coupling)
  - [4.6 Known architectural defects](#46-known-architectural-defects)
- [5. Risks, gaps and open questions](#5-risks-gaps-and-open-questions)
  - [5.1 Architectural defects and contradictions (consolidated)](#51-architectural-defects-and-contradictions-consolidated)
  - [5.2 Documentation/code drift](#52-documentationcode-drift)
  - [5.3 Security findings](#53-security-findings)
  - [5.4 Untested / unverified paths](#54-untested--unverified-paths)
  - [5.5 Open items ledger — overlapping rows (not acted on)](#55-open-items-ledger--overlapping-rows-not-acted-on)
  - [5.6 Open questions requiring a product/owner decision](#56-open-questions-requiring-a-productowner-decision)

---

## 0. Audit metadata

**Repo:** `C:/Users/11/Desktop/Workspace/new-project/projects/youtube-mentor-dashboard`
**Branch:** `feat/saved-market-rows-table`
**HEAD at audit time:** `be1a70db302f891c3bbbd88f555b0e9b3e74cf9a` (`be1a70d`)
**Date:** 2026-09-14
**Working-tree cleanliness:** clean except one pre-existing, unrelated modification to `docs/open-items-ledger.md` (+17/-2 lines, an in-progress ledger edit from before this audit started). No other file was modified, staged, or committed by this audit. `git status --porcelain` at both start and end of this audit showed only that one line, plus this new file (`screens_and_gems_mapping.md`, untracked) at the end.

**All line-number citations in this document refer to HEAD `be1a70d` plus that one uncommitted ledger change** (which is not itself cited anywhere in this document — it is unrelated to screens/GEMs architecture). Every other file this document cites was read at its committed HEAD state. Six read-only research agents performed the underlying investigation in parallel (dispatched from `.claude/agents/`: `architect-reviewer`, `gem-architect`, `gemini-integration-engineer`, `frontend-rtl-developer`, `persistence-storage-engineer`, `security-secrets-auditor`); one orchestrating session assembled their findings into this single document, resolving one verification gap directly (git-tracking status of `.env*` files, §5.3) and performing the final redaction pass.

**How to read this document (for the external reviewer):**
- Every factual claim carries a `path:line` citation (paths are relative to the repo root above).
- A claim that could not be directly verified against the implementation is labeled **`UNVERIFIED`** — treat it as a lead, not a fact.
- Where two code paths appear to do the same thing differently, both are documented, with an explicit statement of which one actually runs at runtime and the evidence for that.
- Dead code / empty areas are stated as such, with the grep/import-search evidence that makes them dead, not inferred from naming.
- Hebrew UI text, GEM instructions, and schema text are reproduced verbatim inside fenced code blocks — untranslated, unedited.
- Secrets, tokens, and personal GEM URLs are replaced with `[REDACTED]` throughout, per this audit's explicit redaction mandate. See §5.3 for the dedicated security-findings subsection.
- This audit is **read-only**: no application file was created, edited, moved, renamed, or deleted; no build/dev/test command was run; no git-mutating command was run. Only this one new markdown file was produced.

---

## 1. Screen & tab inventory

**תקציר (עברית):** אין ראוטר — הניווט מבוסס state+`window.history` ידני. `VideoDetailPanel` מציג תמיד 7 טאבים אחידים ("Universal Tabs"), ללא תלות בסוג הווידאו; מנגנון שלם של "טאבים לפי סוג-תוכן" (13 קבועים/פונקציות) קיים בקוד אך הוא מת — אפס צרכנים. נמצא גם באג סביר: הפניה למשתנה לא-מוגדר `POLITICAL_TAB_VALUES` שעלולה לזרוק שגיאה בזמן ריצה עבור וידאו פוליטי.

### 1.1 Routing mechanism

There is **no router library**. `package.json` and a full-text search of `src/` for `react-router` both return zero matches. Navigation is a hand-rolled state+`window.history` mechanism defined in `src/App.jsx`:
- `AppLayout` keeps `currentPage`/`pageParams` in `useState` (`src/App.jsx:27-28`).
- `navigateTo(page, params)` (`src/App.jsx:88-96`) calls `window.history.pushState({page, params}, '', destination)` then sets React state directly — it does not rely on the browser actually re-rendering from the URL.
- A `popstate` listener (`src/App.jsx:50-71`) re-derives `currentPage`/`pageParams` from `window.history.state` (or from a special-cased Workspace Library URL resolver) so back/forward works.
- The only page with a "real" URL shape is Workspace Library, resolved via `resolveWorkspaceLibraryLocation`/`getWorkspaceLibraryUrl` (`src/lib/workspaceLibraryRoute.js`, referenced at `src/App.jsx:15,26,52,89`). All other pages are pure client-state switches with `/` as the URL.
- The active page component is selected from a plain lookup table: `const PageComponent = PAGES[currentPage] || PAGES["Dashboard"]` (`src/App.jsx:73`), where `PAGES` is defined in `src/pages.config.js:17-33` (15 registered page keys, no lazy loading/code-splitting — all 15 page modules are statically imported at `src/pages.config.js:1-15`).

### 1.2 Navigation hierarchy

```
main.jsx (src/main.jsx:8) → App (src/App.jsx:159)
└─ AppLayout (src/App.jsx:25)
   ├─ AppSidebar (src/components/layout/AppSidebar.jsx:82) — persistent left rail, navigateTo() buttons
   │   ├─ "כל הסרטונים" → Dashboard                         (AppSidebar.jsx:244)
   │   ├─ "שמורים" → SavedVideos                             (AppSidebar.jsx:252)
   │   ├─ "תור למידה" → LearningQueue                        (AppSidebar.jsx:260)
   │   ├─ "גיבויי ענן" → CloudBackups                         (AppSidebar.jsx:266)
   │   ├─ "ספריית ידע" → KnowledgeLibrary                    (AppSidebar.jsx:277)
   │   ├─ "חיפוש ידע" → KnowledgeSearch                       (AppSidebar.jsx:283)
   │   ├─ "Workspace" → WorkspaceLibrary                       (AppSidebar.jsx:289)
   │   ├─ "הברינים שלי" → TopicsPage                            (AppSidebar.jsx:297)
   │   │   └─ per-topic icon → TopicKnowledgePage {topicId}     (AppSidebar.jsx:351)
   │   │   └─ per-topic "כל הסרטונים ←" → TopicPage {topicId}    (AppSidebar.jsx:426)
   │   │   └─ per-mentor row → MentorPage {mentorId}             (AppSidebar.jsx:471)
   │   ├─ "🧠 שמור למוח" (footer) → opens SaveToBrainModal (global, not a page) (AppSidebar.jsx:554-561, App.jsx:131,146-150)
   │   └─ "ניהול" → Admin                                       (AppSidebar.jsx:580)
   ├─ <PageComponent> (one of the 15 pages.config.js entries)
   │   └─ Dashboard (src/pages/Dashboard.jsx:489)
   │       ├─ VideoCard grid (Dashboard.jsx:1372-1389) → click → handleVideoClick → opens
   │       │   └─ VideoDetailPanel (Dashboard.jsx:1395-1410) — sheet/overlay, NOT a page
   │       │       └─ Tabs (see §1.3)
   │       ├─ ExternalVideoModal (Dashboard.jsx:1412-1422) — "add by link"
   │       └─ PdfUploader (Dashboard.jsx:1212) → also opens VideoDetailPanel
   │   └─ WorkspaceLibrary (src/pages/WorkspaceLibrary.jsx:94)
   │       ├─ its own local VideoDetailPanel instance (WorkspaceLibrary.jsx:32, state at 134-135)
   │       └─ can also *leave* the page via navigateTo('Dashboard', {openVideoId,...}) (WorkspaceLibrary.jsx:856) — see §4.5
   └─ SaveToBrainModal (App.jsx:146-150) — global, mounted once at the AppLayout level, opened from the sidebar footer button regardless of current page
```

### 1.3 VideoDetailPanel — the "7 universal tabs"

`src/components/dashboard/VideoDetailPanel.jsx` is a single ~12,900-line component (`Tabs`/`TabsList` block at `VideoDetailPanel.jsx:10349-10371`). The rendered tab bar is driven by one constant:

```js
// src/components/dashboard/VideoDetailPanel.jsx:3042
const visibleTabDefinitions = UNIVERSAL_TABS;
```

`UNIVERSAL_TABS` (`src/config/videoTabsConfig.js:160-164`) is generated from `VIDEO_ANALYSIS_HEADINGS` (`src/config/workspaceHeadingRegistry.js:1-83`), the same registry used to classify Workspace-Library collections (§1.8). This is the actual, always-rendered, video-type-independent tab bar — confirmed: it is **not** conditioned on `detectVideoType`/`subCategory` anywhere in the `TabsList` render (`VideoDetailPanel.jsx:10352-10370` maps `UNIVERSAL_TABS` unconditionally).

| tab key (`value`) | Hebrew label (verbatim) | icon | defined at | `TabsContent` at | fields read (`extractVideoTabItems`, `videoTabsConfig.js`) |
|---|---|---|---|---|---|
| `summary` | סיכום | 📝 | `workspaceHeadingRegistry.js:3-10` | `VideoDetailPanel.jsx:10401` | `video.shortSummary/fullSummary/gemSummary/summary`, `video.mainLesson`, plus `marketBriefData.universalTabs.summary`/`.rawData.*` fallbacks (`videoTabsConfig.js:660-699`) |
| `chapters` | פרקים | 📚 | `workspaceHeadingRegistry.js:12-19` | `VideoDetailPanel.jsx:11275` | `video.chapters/aiChapters`, `video.analysis.chapters/aiChapters`, `marketBriefData.universalTabs.chapters` (`videoTabsConfig.js:701-712`) |
| `insights` | תובנות | 💡 | `workspaceHeadingRegistry.js:21-28` | `VideoDetailPanel.jsx:12345` | `video.analysis.keyInsights`, `video.keyInsights/brainHighlights/tradingPrinciples/mentalModels/keyPoints/top5Insights`, nested `video.analysis.brainHighlights`, GEM `top5Insights/reusableKnowledge/...` (`videoTabsConfig.js:798-836`) |
| `useful-knowledge` | ידע שימושי | 🧠 | `workspaceHeadingRegistry.js:30-37` | `VideoDetailPanel.jsx:12463` | `video.analysis.frameworks/usefulKnowledge/keyTakeaways`, `video.actionItems/usefulKnowledge/keyTakeaways`, `video.analysis.learning.keyTakeaways/actionItems`, `allPoints` filtered to `rule/strategy/checklist` (`videoTabsConfig.js:714-749`) |
| `app-builder` | APP | 🚀 | `workspaceHeadingRegistry.js:39-46` | `VideoDetailPanel.jsx:12336` | `video.analysis.appBuilding.{kpiList,dashboards,prompts,screeningCriteria,dataFields,suggestedFeatures}`, `allPoints` filtered to `feature/prompt/kpi` (`videoTabsConfig.js:1159-1202`) |
| `topics-subtopics` | נושאים ותתי־נושאים | 🏷️ | `workspaceHeadingRegistry.js:48-55` | `VideoDetailPanel.jsx:12678` | `video.analysis.obsidianTopics/metadataTopics/tags`, `video.obsidianTopics/tags/topicIds` (`videoTabsConfig.js:1204-1235`) |
| `specialized` | תוכן ייעודי | 🎯 | `workspaceHeadingRegistry.js:57-64` | `VideoDetailPanel.jsx:12851` | `marketBriefData.universalTabs.specialized.{indices,marketNews,stocksMentioned,macro,top5Insights}` with `resolveSpecialized()` merge fallback (`videoTabsConfig.js:1237-1259`); for political videos the whole political sub-section set renders *inside* this tab (§1.6) |

An 8th registry entry, `structured-snapshot` (`workspaceHeadingRegistry.js:66-74`), is explicitly filtered out of `VIDEO_ANALYSIS_HEADINGS` (`workspaceHeadingRegistry.js:81-83`) and therefore out of `UNIVERSAL_TABS` — it exists only as a Workspace-Library collection (§1.8), not a video-panel tab.

### 1.4 Dead tab-configuration subsystem

`src/config/videoTabsConfig.js` defines many more tab-array constants and two "resolver" functions that look like they should drive the tab bar per video type. Grepping every identifier across `src/` (excluding `videoTabsConfig.js` itself) returns **zero matches** for all of them:

- `LEARNING_TABS` (`videoTabsConfig.js:120-132`)
- `LEARNING_GROUP_MAIN_TABS` (`videoTabsConfig.js:135-140`)
- `LEARNING_SUB_TABS` (`videoTabsConfig.js:143-152`)
- `BRIEF_TABS` (`videoTabsConfig.js:166-175`)
- `DEFAULT_TABS` (`videoTabsConfig.js:177-182`)
- `TECHNICAL_TABS` (`videoTabsConfig.js:186-197`)
- `FUNDAMENTAL_TABS` (`videoTabsConfig.js:199-211`)
- `MACRO_TABS` (`videoTabsConfig.js:213-224`)
- `MORNING_BRIEF_TABS` (`videoTabsConfig.js:226-235`)
- `EVENING_BRIEF_TABS` (`videoTabsConfig.js:237-246`)
- `WEEKLY_BRIEF_TABS` (`videoTabsConfig.js:248-257`)
- `EARNINGS_BRIEF_TABS` (`videoTabsConfig.js:259-268`)
- `POLITICAL_TABS` (`videoTabsConfig.js:270-280`)
- `getTabsForVideo()` (`videoTabsConfig.js:305-341`) and `getTabsBySubTopic()` (`videoTabsConfig.js:286-299`) — the functions that would *consume* the arrays above

Proof: grepping the pattern of all 15 names across `src/` returns exactly one file: `videoTabsConfig.js` itself. `VideoDetailPanel.jsx`'s own import line (`VideoDetailPanel.jsx:139`) imports only `detectVideoType, extractVideoTabItems, getBriefDisplayClassification, getTabBadge, normalizeSubCategory, getMorningBriefFieldMapping, UNIVERSAL_TABS, LEARNING_SUB_TAB_VALUES` — none of the per-type tab arrays. `detectVideoType`/`getBriefDisplayClassification`/`normalizeSubCategory` are still live (used for labeling/classification, e.g. the "מבזק בוקר"/"מבזק ערב" header text), but the entire "different tab set per video type" mechanism those functions were apparently built to feed is orphaned. `getTabsForVideo` in particular contains the only code path that would ever splice `{value:'political', label:'פוליטי', emoji:'🏛️'}` into a tab bar (`videoTabsConfig.js:337`) — and it is never called.

### 1.5 Hidden/orphan tabs and a likely runtime bug

Beyond the 7 `UNIVERSAL_TABS`, the same `Tabs` root (`VideoDetailPanel.jsx:10349`) also renders 4 more `TabsContent` blocks with **no corresponding `TabsTrigger`** in the visible bar:

- `notes` (`VideoDetailPanel.jsx:11611`) — reachable via a sidebar button, `setActiveTab("notes")` (`VideoDetailPanel.jsx:10164`).
- `transcript` (`VideoDetailPanel.jsx:11631`) — reachable via a sidebar button, `setActiveTab("transcript")` (`VideoDetailPanel.jsx:10022`).
- `ai-analysis` (`VideoDetailPanel.jsx:11967`) — reachable via multiple sidebar/action buttons, e.g. `setActiveTab("ai-analysis")` (`VideoDetailPanel.jsx:10300,10314,10933,12244`).
- `brain-select` (`VideoDetailPanel.jsx:12237`) — **appears unreachable**. `activeTab` is initialized to `"summary"` (`VideoDetailPanel.jsx:2259`); grepping the literal string `brain-select` across all of `src/` finds only its own declaration in `SUPPLEMENTARY_ALLOWED_TABS` (`VideoDetailPanel.jsx:1209`) and its `TabsContent` definition (`VideoDetailPanel.jsx:12237`). No `setActiveTab("brain-select")` call, `TabsTrigger`, or deep-link exists anywhere. Its "בחר הכל / שמור X פריטים למוח" UI (`VideoDetailPanel.jsx:12252-12330`) therefore appears to be dead UI reachable only by manually setting state in devtools — labeled `UNVERIFIED-as-dead` rather than fully confirmed, since a dynamic `setActiveTab(someVar)` call could theoretically resolve to this value at runtime, but a full-text grep found none.

`SUPPLEMENTARY_ALLOWED_TABS = new Set(["notes", "transcript", "brain-select"])` (`VideoDetailPanel.jsx:1209`) is used inside an effect (`VideoDetailPanel.jsx:3064-3081`) that force-resets `activeTab` back to the first universal tab whenever the current `activeTab` isn't in the allowed set.

**Likely bug — undefined `POLITICAL_TAB_VALUES` reference:**
```js
// src/components/dashboard/VideoDetailPanel.jsx:3064-3069
useEffect(() => {
  const allowedTabValues = new Set([
    ...visibleTabDefinitions.map((tab) => tab.value),
    ...SUPPLEMENTARY_ALLOWED_TABS,
    ...(resolvedVideoMode.mode === "politics" ? ["political", ...POLITICAL_TAB_VALUES] : []),
  ]);
```
`POLITICAL_TAB_VALUES` is referenced at `VideoDetailPanel.jsx:3068` and has **no declaration, import, or definition anywhere in `src/`** (repo-wide grep). If `resolvedVideoMode.mode === "politics"` is ever true, this line should throw `ReferenceError: POLITICAL_TAB_VALUES is not defined` inside a `useEffect`. `resolvedVideoMode.mode === "politics"` is a real, reachable code path — it gates the "⚔️ דעת האויב" opponent-view toggle (`VideoDetailPanel.jsx:9419-9433`) — so this is not obviously unreachable. This is **static evidence only** (this audit could not execute the app); see §5.4.

### 1.6 Where political content actually renders

Despite no `political` `TabsContent` and dead `POLITICAL_TABS` (§1.4), political-specific sections *do* render — inside the live `specialized` universal tab, via `src/components/dashboard/SpecializedContentRenderer.jsx:395-434`. When `slug === 'political' || hasPoliticalTabSet`, it builds 8 sub-sections (`political-players/political-ideology/political-theology/political-liberal/political-for/political-against/political-slogans/political-debates/political-reusable`, labels at `SpecializedContentRenderer.jsx:416-424`) sourced from `extractVideoTabItems(effectiveVideo, 'political-*', marketBriefData)` and a `politicalSummary` prop (fields: `viralQuotes, politicalSlogans, debateResponses, theologyAnalysis, ideologyAnalysis, liberalJewishPerspective, reusableKnowledge` — `SpecializedContentRenderer.jsx:402-409`).

### 1.7 Modals and dialogs

| Modal | Trigger (component + handler) | Renders at | Writes to |
|---|---|---|---|
| `GemSelectionModal` ("GEM picker") | sidebar quick-action "Gem מומלץ" `onClick={() => setShowGemModal(true)}` (`VideoDetailPanel.jsx:9971`); also `VideoDetailPanel.jsx:11691,13237` | `VideoDetailPanel.jsx:13269-13302` | `onSave` → `saveVideoFields({gemOverride: key})` (`VideoDetailPanel.jsx:13283-13286`); `onGemSummaryPaste` → `saveVideoFields({gemSummary: text})` (`VideoDetailPanel.jsx:13296-13298`) |
| GEMS JSON paste dialog (inline `Dialog`, `isGemsPasteOpen`) | sidebar quick-action "GEMS JSON" (`VideoDetailPanel.jsx:9980`), and buttons at `VideoDetailPanel.jsx:10941,12206` | `VideoDetailPanel.jsx:13683-13850` (approx.) | `handleApplyGemsJson` (`VideoDetailPanel.jsx:6742`) → `parseAndValidateGemsJson()` (`src/lib/gemsJsonRepair.js`) → `_applyParsedGems` (`VideoDetailPanel.jsx:6533`) — handoff into the GEM-parsing subsystem, detailed in §2 |
| `AiMappingModal` — dev-only field→tab diagnostics viewer, **not** the paste dialog | gated by `import.meta.env.DEV` (`VideoDetailPanel.jsx:13324-13344`) — **not rendered in production builds at all** | `VideoDetailPanel.jsx:13325-13343` | read-only diagnostics; can call `onSaveVideoFields` (`saveVideoFields`) |
| `ExternalVideoModal` (add-by-link) | Dashboard "הוסף סרטון" button `onClick={() => setIsExternalVideoModalOpen(true)}` (`Dashboard.jsx:1201-1209`) | `Dashboard.jsx:1412-1422` | `handleSubmit` (`ExternalVideoModal.jsx:363`) → `buildExternalVideoObject()` (`src/services/youtubeOEmbed.js`) → `saveLocalVideo()` (`ExternalVideoModal.jsx:28,409`) → React-Query cache invalidation (`ExternalVideoModal.jsx:431-432`) → `onVideoAdded` → Dashboard opens `VideoDetailPanel` (`Dashboard.jsx:1417-1421`) |
| `SaveToWorkspaceDialog` (main "save video to Workspace Library") | header "⭐ Workspace" button `onClick={() => {...; setWorkspaceSaveOpen(true);}}` (`VideoDetailPanel.jsx:9405-9417`) | `VideoDetailPanel.jsx:13651` | writes via `useWorkspaceItems`/`@/lib/workspaceLibraryStore` (`SaveToWorkspaceDialog.jsx:18`) — the store `WorkspaceLibrary.jsx` actually reads |
| `SaveToBrainModal` (global) | `AppSidebar` footer "🧠 שמור למוח" `onClick={() => onSaveToBrain("")}` (`AppSidebar.jsx:554-561`) → `App.jsx:131,146-150` | `App.jsx:146-150`, mounted once at `AppLayout` level | `upsertKnowledgeItem()` from `src/lib/localKnowledgeItemStore` (`SaveToBrainModal.jsx:10-14,144`) |
| `GemRawModal` | not traced in depth | `VideoDetailPanel.jsx:13261-13266` | read-only viewer of `marketBriefData` |
| `ObsidianSettingsDialog` | vault-path settings, opened from various save-failure paths (`VideoDetailPanel.jsx:5066,5085-5087`) | `VideoDetailPanel.jsx:13304-13315` | vault-name/path config |
| `GemsSettingsModal` | global GEM-URL management, sidebar action | `VideoDetailPanel.jsx:13318-13321` | GEM URL registry (not traced) |

### 1.8 Workspace Library screen structure

`src/pages/WorkspaceLibrary.jsx:94` (2,000+ lines). Two independent taxonomy dimensions coexist:

1. **Virtual main topics / subtopics** — `VIRTUAL_TAXONOMY` (`src/utils/workspaceVirtualTaxonomy.js:7-89`): 6 top-level tabs — `vt-markets` ("שוק ההון", with 10 subtopics: מניות/סקטורים/מאקרו/פונדמנטלי/טכני/ניהול סיכונים/ETF-מדדים/קריפטו/סקירת שוק יומית/סנטימנט שוק), `vt-ai` ("AI וטכנולוגיה"), `vt-health` ("תזונה ובריאות"), `vt-politics` ("פוליטיקה"), `vt-personal` ("ידע אישי"), `vt-general` ("כללי") — plus an implicit "כולם"/all appended by UI callers (`workspaceVirtualTaxonomy.js:30-31`).
2. **Content-type collections** — the same 7 `WORKSPACE_COLLECTION_HEADINGS` derived from `VIDEO_ANALYSIS_HEADINGS` plus `structured-snapshot`/`unclassified` fallback (`src/config/workspaceHeadingRegistry.js:85-108`), rendered via `WorkspaceCollectionTiles`, `WorkspaceContentSectionTabs`, `WorkspaceScopeTiles` (`WorkspaceLibrary.jsx:20,37-38`). Per-card rendering: `WorkspaceTabRow` (`:19`), `WorkspaceVideoGroupCard` (`:43`), `WorkspaceFocusedVideoCard`/`WorkspaceGlobalSavedAnalysisGroup` (`:44`), `WorkspaceDay`/`useWorkspaceDays` (`:28,34`), `StructuredSnapshotView` (`:39`).
3. Market items additionally carry a workflow-status dimension: `MARKET_STATUS_TABS` (הכל/⭐ למעקב/🎯 מועמדות/📋 לפני דוחות/⚠️ בסיכון/📦 ארכיון — `WorkspaceLibrary.jsx:65-79`).

### 1.9 Hebrew/RTL handling

**Global root:** `index.html:2` — `<html lang="he" dir="rtl">`. This is the only `<html>`-level direction declaration; `src/main.jsx:1-8` mounts `<App/>` directly into `#root` with no additional direction wrapper. The root app div also re-asserts `dir="rtl"` (`src/App.jsx:110-114`).

**Per-component re-assertion is pervasive, not exceptional.** A repo-wide count of the literal string `dir="rtl"` under `src/` returns **491 occurrences across 134 files**. Representative: `src/components/workspace/SavedMarketRowsTable.jsx:57`, `src/components/workspace/ConfirmDialog.jsx:31`; `src/pages/Admin.jsx` has 27 occurrences alone; `VideoDetailPanel.jsx` has 92.

**No Radix `DirectionProvider` anywhere** — `grep DirectionProvider` across `src/` returns zero matches. Every Radix-portalled primitive receives `dir="rtl"` as an explicit prop at each call site (e.g. `src/components/workspace/SaveToWorkspaceDialog.jsx:326,329,387,396` — two separate `<Select>` instances in the same file, each independently annotated). `src/components/ui/select.jsx` and `src/components/ui/dialog.jsx` do **not** default or bake in `dir="rtl"` — they pass `...props` through unmodified (`ui/select.jsx:12-19,48-59`, `ui/dialog.jsx:24-49`), so RTL correctness for every portalled instance depends entirely on the consumer remembering to pass it, with no context-based safety net.

**Tailwind RTL utilities:** logical properties (`ms-`/`me-`/`ps-`/`pe-`) appear 27 times across 13 files (e.g. `src/components/dashboard/MacroGemDashboard.jsx:33-34`); logical inset utilities (`start-`/`end-`) appear exactly once (`VideoDetailPanel.jsx:403`). Physical `ml-`/`mr-`/`pl-`/`pr-` dominate at **155 occurrences across 41 files** — roughly 6× the logical-property count. **`rtl:`/`ltr:` Tailwind variant classes and `space-x-reverse`: zero usage anywhere in `src/`.** The app achieves its RTL look purely via the global `dir="rtl"` attribute plus hand-picked physical values, not Tailwind's logical/variant mirroring system. `src/components/ui/dialog.jsx:42`'s close button is hardcoded `absolute left-4 top-4` (not the shadcn default `right-4`, not a logical `end-4`) — a manual, non-mirroring RTL adaptation.

**Mixed LTR/RTL bidi handling** has a dedicated, documented helper: `src/components/dashboard/FullSummaryParagraphs.jsx:1-85` isolates embedded Latin/number runs in Hebrew paragraphs using a regex (`LATIN_TOKEN`/`LATIN_RUN_REGEX`, `:41-42`) and wraps each in `<bdi dir="ltr">` (`:57-59`) — explicitly excluding trailing connectors glued to Hebrew words (e.g. `"Allocation-ו"`). `<bdi>` (not `<bdo>`) is the app's standard isolation primitive for numbers/tickers embedded in Hebrew sentences (e.g. `AAIIWeeklySentimentCard.jsx:393`, `FearGreedIndicatorsGrid.jsx:166`). Explicit CSS `unicode-bidi: isolate` is also used directly for numeric values (`src/components/workspace/SavedMarketRowsTable.jsx:126`, `StructuredSnapshotView.jsx:362`). Ticker symbols get `dir="ltr"` scoped tightly to just the symbol, with an explicit design-rationale comment (`src/components/workspace/StockWatchlistView.jsx:307-311`). Timestamp direction uses three different strategies across files: static `dir="ltr"` (`src/pages/Dashboard.jsx:1036`), content-dependent conditional `dir` (`ChapterItem.jsx:206`: `dir={timestampUnavailable ? "rtl" : "ltr"}`), and a bespoke regex heuristic testing only the first 6 characters (`MacroGemDashboard.jsx:191`: `/^[a-zA-Z0-9\s]+$/.test(displayVal.slice(0, 6))`) — the third pattern is fragile and not reused elsewhere. Date/currency formatting uses `Intl`/`toLocaleString('he-IL', …)` in several files (`src/lib/briefContextDisplay.js:82,100,109`, `src/lib/fearGreed.js:166`).

**Hebrew-substring-matching pitfall — explicit guard found:** `src/lib/hebrewSentimentTokenGuard.js:1-52` guards against the fact that JS regex `\b` never matches around Hebrew letters (`\w` covers only `[A-Za-z0-9_]`), so a naive substring search for the bullish keyword `עולה` ("rising") false-positives inside the unrelated word `פעולה` ("action"). Rather than a general word-boundary rewrite (which would also break intentional substrings like `שעולה`), the fix is a narrow whitelist — `FALSE_POSITIVE_TOKENS = new Set(['פעולה'])` (`:35`) — stripped via `stripSentimentFalsePositiveTokens` (`:43-52`) before any sentiment regex runs. Reused by `src/utils/workspaceStockItems.js:6,46-52` (confirmed) and referenced by `morningBriefVisuals.js`/`marketRowVisuals.js` per the module's own doc comment (not independently re-verified — `UNVERIFIED` for those two call sites specifically). A second, related guard in `src/lib/stockRowText.js:76-84` handles bidi-reordering-aware tag parsing (`LABEL: value` vs `value :LABEL`). **No nikud or Hebrew final-letter-form normalization exists anywhere in `src/`** — searched for and confirmed absent; the `.normalize('NFKC')` calls found elsewhere (e.g. `src/lib/videoTitleSearch.js:1-3`) are for ticker/quote-variant matching, not Hebrew-specific normalization.

**RTL/Hebrew risks (carried into §5):** no `DirectionProvider` at the app root (a missed `dir="rtl"` prop on a new dialog/select has no structural safety net); shadcn primitives use hardcoded physical positioning for direction-sensitive chrome; Tailwind's RTL-variant system is unused entirely; no dedicated Hebrew webfont (`src/index.css:59` uses a system-font stack); `dir="auto"` is essentially absent from form inputs (only 5 occurrences app-wide, all on display elements, none on `<input>`/`<textarea>`); three inconsistent content-based `dir`-heuristic strategies coexist; no nikud/final-letter-form normalization exists as a reusable pattern if ever needed; two independent bidi-handling systems (CSS-class-based `.analysis-content`/`.hebrew-content`/`.rtl-text` in `src/index.css:63-99`, vs. the React-level `<bdi>`/`FullSummaryParagraphs` approach) coexist without a documented boundary between them.

### 1.10 User interaction flows

**(a) Add a video**
1. Manual: click "הוסף סרטון" — `Dashboard.jsx:1201-1209` → `setIsExternalVideoModalOpen(true)`.
2. User enters URL; `handleUrlChange` validates via `isValidYouTubeUrl`/`parseYouTubeVideoId` (`ExternalVideoModal.jsx:40,175`).
3. Submit → `handleSubmit` (`ExternalVideoModal.jsx:363`) → dedup check `findVideoByYoutubeId(mergedVideoListForDedup(queryClient), videoId)` (`ExternalVideoModal.jsx:75,381-382`) → `buildExternalVideoObject()` (`src/services/youtubeOEmbed.js`) → `saveLocalVideo(videoObj)` (`ExternalVideoModal.jsx:409`).
4. `queryClient.invalidateQueries({queryKey:["videos"]})` (`ExternalVideoModal.jsx:431`) refreshes the React-Query cache backing `useVideos()`.
5. `onVideoAdded(added)` → `Dashboard.jsx:1417-1421` sets `selectedVideo`/`panelOpen(true)`, opening `VideoDetailPanel`.
   *Alternate path*: automatic — "סרוק עכשיו" button → `handleManualChannelScan` (`Dashboard.jsx:815`) → `runChannelScan(mentors,{reason:'manual',force:true})` (`@/services/channelScanService`, `Dashboard.jsx:14,821`) — not traced further (out of scope depth).

**(b) Run automatic analysis**
1. Click "התחל ניתוח" (sidebar Start-Analysis card) — `onClick={() => { setActiveTab("ai-analysis"); handleGeminiContent(); }}` (`VideoDetailPanel.jsx:10300`, duplicate trigger at `10933`).
2. `handleGeminiContent` (`VideoDetailPanel.jsx:8641`) gathers chapter hints, duration, transcript text/segments, optional attached-PDF text (`VideoDetailPanel.jsx:8650-8673`).
3. Calls `fetchGeminiVideoContent({...})` (`VideoDetailPanel.jsx:8675`) — handoff into the AI/Gemini pipeline, detailed in §3.
4. Result passed through `validateAiAnalysisQuality(result)` (`VideoDetailPanel.jsx:8696`) and `validateChaptersForSave(...)` (`VideoDetailPanel.jsx:8709-8715`), then persisted via a patch object (`VideoDetailPanel.jsx:8720+`).

**(c) Open a GEM and paste JSON back into the app**
1. Click "Gem מומלץ" (`VideoDetailPanel.jsx:9971`) → `GemSelectionModal` opens (`:13269`) → user opens the external Gemini Gem URL (not traced) → `onGemOpened` closes the modal and marks `gem-summary-waiting-{id}` in `localStorage` (`:13288-13295`).
2. Click "GEMS JSON" / "📋 הדבק GEM JSON" (`:9980, 10941, 12206`) → `setIsGemsPasteOpen(true)` opens the paste dialog (`:13683`).
3. Paste into the `textarea` — auto-handled via `onPaste={handleAutomaticGemsPaste}` (`:13724`) or manually edited (`:13725-13742`), which also live-persists a draft to `localStorage` key `gems-paste-{video.id}` (`:13733`).
4. Click "החל"/Apply → `handleApplyGemsJson` (`:6742`) → `parseAndValidateGemsJson(raw)` (`:6752`) — handoff into GEM-parsing/validation, detailed in §2. On success, `_applyParsedGems(result.value)` (`:6790`, defined `:6533`) persists the parsed result to the video record.

**(d) Select rows and save to Workspace Library**
Two distinct, non-unified code paths both labeled "Workspace" in the UI:
1. **Whole-video save** (the one that actually reaches the Workspace Library screen): header "⭐ Workspace" button (`:9405-9417`) → `setWorkspaceSaveOpen(true)` → `SaveToWorkspaceDialog` (`:13651`) → persists via `useWorkspaceItems`/`@/lib/workspaceLibraryStore` (`SaveToWorkspaceDialog.jsx:17-18`) — the store `WorkspaceLibrary.jsx` reads through `useWorkspaceItems()`.
2. **Per-card "quick save" dropdown**, present on every summary-card row (`:10651-10681`, repeated `~10851-10880`, `~11090-11250`, all inside the `summary` `TabsContent`, `:10401-11272`): "⭐ שמור ל-Workspace" calls `handleSavePsSectionTo(saveKey, title, saveContent, 'workspace')` (`:10672`, defined `:4573`), which for the `workspace`/`opponent` branch writes an ad-hoc item directly via `upsertKnowledgeItem(item)` (`:4619`, from `@/lib/localKnowledgeItemStore`) — **the same store the "brain" system uses**, not `workspaceLibraryStore`. This path never surfaces in the actual Workspace Library screen despite its label — see defect in §4.6.

**(e) Save an item to the "brain"/knowledge system**
1. Global entry point: sidebar footer "🧠 שמור למוח" (`AppSidebar.jsx:554-561`) → `SaveToBrainModal` (`App.jsx:146-150`) → `upsertKnowledgeItem()` (`SaveToBrainModal.jsx:144`).
2. In-panel entry point (per-card, general — despite the handler's political-sounding name, not just political videos): same dropdown as flow (d), destination `'brain'` → `handleSavePsSectionTo` (`:4580-4583`) → `handleSavePsSection(sectionKey, sectionLabel, content)` (`:4515`, called **without** its optional 4th `sectionTypeOverride` argument, `:4581`) → defaults `resolvedSectionType = sectionTypeOverride || 'politicalSummary'` (`:4521`) and files the item under a `"פוליטיקה/…"` `workspacePath` (`:4536-4549`) → `upsertKnowledgeItem(item)` (`:4567`). **This mislabels every non-political video's card-level "save to brain" action as `sectionType:'politicalSummary'` under a Politics path** — see §4.6.
3. Bulk entry point: sidebar "💾 שמור למוח" quick action (`:9986-9991`) → `handleSaveAllToBrain` (`:4704`) → picker flow (not fully traced) → confirm button → `handleSaveAllConfirmed` (`:4740`, triggered at `:13639`).

**(f) Export to Obsidian**
Three separate code paths, all inside `VideoDetailPanel.jsx`:
1. Per-card "🧠 שמור ▾" dropdown, destination `'obsidian'` (`:10665`) → inline in `handleSavePsSectionTo` (`:4584-4589`): builds a markdown string and calls `downloadMarkdown(md, filename)` (`:4586`, from `@/lib/obsidianExport`) — browser-download fallback only, no vault write attempted here.
2. Sidebar "📄 יצוא MD" quick action (`:10096-10104`): `buildVideoFullNote(video, mentorName, null, videoNotes, [], {opponentSentences})` → `downloadMarkdown(note.content, filename)` — same handoff module, whole-video variant.
3. Real vault-write path: `executeObsidianVaultWrite` (`:4973`, `fetch('/api/vault/write', …)` at `:5035`), called from `:5523,5537,5561,13467` — handoff into the Obsidian-sync HTTP endpoint, not traced server-side. On failure it falls back to `readObsidianVaultMarkdown` + `downloadMarkdown` (`:5098-5109`). Separately, `handleSaveAllConfirmed` (`:4740`) contains its **own independent inline** `fetch('/api/vault/write', …)` (`:4743`) rather than calling `executeObsidianVaultWrite` — a duplication, see §4.6.

---

## 2. Fundamental GEMS — full detail

**תקציר (עברית):** קיימים שני מנועי-סיווג נפרדים ולא-מחוברים — `gemContentRouter.js` (מפורט, מתועד, אך **מת לחלוטין**, אפס צרכנים) ו-`gemRecommender.js` (המנוע החי בפועל, עם נוסחת confidence ממשית). הוראות ה-GEM הפונדמנטלי (שהוא GEM חיצוני ב-Gemini, לא קוד בריפו) מנוהלות ב-`docs/gems/` ומשוכפלות כאן במלואן. נמצאה סתירה מאומתת: ההוראות עדיין אוסרות שדה (`warnings`) שהקוד כבר מציג בפועל.

### 2.1 Artefact inventory

| Artefact | Path | Status |
|---|---|---|
| Instructions doc (System Instructions text pasted into Gemini's custom-GEM builder) | `docs/gems/GEM-FUNDAMENTAL-INSTRUCTIONS.md` | Exists, full text in §2.3 |
| Schema/contract doc (prose + file:line citations, not a machine JSON-Schema file) | `docs/gems/GEM-FUNDAMENTAL-SCHEMA.md` | Exists, full text in §2.4 |
| Example JSON output | `docs/gems/GEM-FUNDAMENTAL-EXAMPLE.json` | Exists, full text in §2.5 |
| Entry-point/map doc | `docs/gems/FUNDAMENTAL-OVERVIEW.md` | Exists |
| Technical-GEM prep notes (not the technical GEM's own instructions) | `docs/gems/GEM-TECHNICAL-PREP-NOTES.md` | Exists — explicitly "no code change, no instructions written" |

**No machine-readable JSON Schema file exists for the fundamental GEM anywhere in the repo** — `Glob "**/*GEM*INSTRUCTIONS*"` returns only `GEM-FUNDAMENTAL-INSTRUCTIONS.md`; there is no `.schema.json` file. The "contract" is: (a) prose in `GEM-FUNDAMENTAL-SCHEMA.md`, (b) the example file, (c) the normalizer function in code acting as the de-facto validator (it silently accepts/drops fields rather than throwing on schema violations — §2.6).

The fundamental GEM itself is **not code that runs inside this repo** — it is a Gemini custom-GEM configured externally in Gemini's own web UI, whose System Instructions text happens to be version-controlled here as documentation (`docs/gems/FUNDAMENTAL-OVERVIEW.md:12`: "GEM ב-Gemini (מוגדר חוץ-לאפליקציה...)"). The app only ever consumes JSON the user pastes back in manually (§2.8, chain B).

### 2.2 Classification, registry, confidence score, manual override

**Finding: two independent, non-communicating classification engines exist in the code, only one of which is actually wired up.**

#### 2.2a `src/ai/gemini/gemContentRouter.js` — defined but functionally dead

This file's own header comment (`gemContentRouter.js:1-29`) describes itself as "Single source of truth for... Gemini dispatch type mapping... recommendedGem... resolveContentClassification() — produces metadata.contentClassification." It exports `CONTENT_TYPES` (`:34-41`), `GEMINI_DISPATCH_TYPE` (`:46-53`), `CONTENT_TYPE_TO_GEM` (`:57-64`), `TITLE_OVERRIDE_RULES` (`:70-85` — title containing `מבזק לייב פתיחה` or `מבזק בוקר` → `contentType: marketBrief`, confidence 97%), `CONTENT_SIGNALS` (`:89-119` — English+Hebrew keyword lists per contentType), `GEM_PROMPT_CONFIG_TABLE` (`:123-178`), and `resolveContentClassification(video, transcriptText)` (`:215-276` — priority: title override 97% → transcript keywords `minMatches=2` 75% → title-only keywords `minMatches=1` 55% → fallback `unclassified` 0%).

**Verified dead-code status**, three independent greps: (1) `resolveContentClassification(`/`wrapAsMetadataClassification(` — zero call sites anywhere outside their own definitions. (2) `getGeminiDispatchType|getGemPromptConfig|GEM_PROMPT_CONFIG_TABLE` — zero importers anywhere in `src/`. (3) `contentClassification` (the field this module claims to produce) appears in exactly two files: `gemContentRouter.js` (definition) and `src/lib/workspaceDayModel.js:122-124` (a defensive read, `video?.metadata?.contentClassification?.contentType`, always `null` in practice since nothing ever writes it). `gemContentRouter.js` itself is imported by exactly one file, `workspaceDayModel.js`.

**Conclusion:** this module's confidence-score formula and title-override rules are never invoked to classify any real video — it is inert and actively misleading to a reader who assumes it's the live router.

#### 2.2b `src/lib/gemRecommender.js` — the live classification/recommendation engine

This is the engine actually wired to the UI:
- `TITLE_OVERRIDE_RULES` (`gemRecommender.js:56-79`) — a **second, separately-maintained** copy of the same two title patterns, producing `gemKey: MARKET_BRIEF_GEM_KEY` output shape (different field names than `gemContentRouter.js`'s copy).
- `GEM_RULES` (`:81+`) — per-GEM weighted keyword lists (Hebrew+English), e.g. fundamental's Hebrew signals include `דוח רבעוני`, `דוחות כספיים`, `עונת הדוחות`, `מכפיל רווח`, `תזת השקעה`, `ניתוח פונדמנטלי` (`:89-101`).
- `classifyVideoForGem(video, transcriptText, options)` (`:391-539`) — the confidence-score formula:
  ```js
  score += countMatches(metaContext, rule.titleKeywords) * 2;
  score += countMatches(metaContext, rule.topicKeywords) * 2;
  // + regex titlePatterns matches * 2, if present
  if (hasTranscript) score += countMatches(transcriptText, rule.transcriptKeywords);
  ```
  Then a hard topic/category rule reorders results (`:428-448`), then an explicit-category boost (+4 if `video.category` is already set, `:452-459`), then:
  ```js
  margin = top.score - second.score;
  if (top.score >= 6 && margin >= 3) confidence = "high";
  else if (top.score >= 3 || margin >= 2) confidence = "medium";
  else confidence = "low";
  confidencePct = Math.min(96, Math.round(40 + (top.score/(top.score+4))*46 + (margin/(margin+2))*10));
  ```
  (`:490-505`). If no rule scored above zero *before* the category boost (`hadRealKeywordSignal`, captured at `:424` specifically so the boost alone can't manufacture a fake winner), the function returns `gemKey: UNCLASSIFIED_GEM_KEY` (`"unclassified"`, `:14`), confidence `"none"`, 0% — a real, distinguishable "pending manual classification" state (`:466-488`).
- Consumers confirmed by grep: `VideoDetailPanel.jsx`, `GemRecommendationCard.jsx`, `GemSelectionModal.jsx` all import from `gemRecommender.js` (not `gemContentRouter.js`). `GemRecommendationCard.jsx:1,6,22-26` renders the confidence badge off `recommendation.confidencePct`/`.gemKey`/`.reason`, thresholds `isHigh=confidencePct>=85`, `isLow=confidencePct<70`, `isVeryLow=confidencePct<50`.

#### 2.2c Manual override path

`GemSelectionModal.jsx` is the picker UI. Fixed GEM registry rows: `FIXED_GEMS_TOP` (`general`, `political`, `:25-28`), `MARKET_BRIEF_GEM` (`marketBrief`, `:38-43`), `TJS_GEMS` (`news`, `macro`, `dayTrading`, `appBuilder`, `:31-36`), `KNOWLEDGE_MARKET_GEMS` (`technical` "ניתוח טכני", `fundamental` "פונדמנטלי", `:46-49`). `initialSelection = resolveWorkflowGemSelection({video, savedGemKey, recommendedGemKey})` (`:145`) is only a **pre-selected default** — `resolveWorkflowGemSelection` (`gemRecommender.js:44-52`) explicitly falls through past `UNCLASSIFIED_GEM_KEY` to `"general"` rather than pre-selecting a fake row. `const [selected, setSelected] = useState(initialSelection)` (`:147`) is freely reassignable by clicking any other GEM tile. `handleSaveGem` → `onSave(selected)` (`:314-316`) persists whichever `gemKey` the user actually clicked, regardless of the recommendation. Per-GEM URL storage: `localStorage.gemUrl.<key>`/`gems_config` blob (`:96-115`) — these are the user's own private Gemini GEM URLs, which live only in runtime `localStorage`, never in a committed file (none were found in any file read for this audit).

### 2.3 System instructions — verbatim

Source: `docs/gems/GEM-FUNDAMENTAL-INSTRUCTIONS.md:20-196` — only the block the doc itself marks as "the text to paste into Gemini" (meta-commentary/changelog prose surrounding it is excluded, per the doc's own instruction that only this block is meant for pasting). Hebrew reproduced exactly as written, unedited.

```
# תפקיד

אתה GEM לניתוח פונדמנטלי של חברות ומניות מתוך תמלול סרטון יוטיוב בעברית. תפקידך לחלץ **חומר לימודי לשימוש חוזר** — מושגים, מסגרות ניתוח, יחסים פיננסיים, מודלים עסקיים, קשרים בין מאקרו-כלכלה לניתוח פונדמנטלי — **לא** להמליץ על מניה ספציפית לקנייה/מכירה, ולא לנבא מחיר עתידי. אתה כלי לימוד, לא כלי ייעוץ השקעות.

# מקורות מותרים

חובה להתבסס אך ורק על מה שנאמר בפועל בתמלול. אסור להמציא מספרים, שמות חברות, נתונים פיננסיים, או מסקנות שלא נאמרו. כאשר התמלול לא מספק פרט הנדרש לשדה — כתוב במפורש "לא נאמר בסרטון" באותו שדה, ולעולם אל תמלא פער בניחוש.

# פלט: אובייקט JSON שטוח אחד בלבד

- החזר **אובייקט JSON אחד בלבד**. אסור טקסט לפני/אחרי, אסור הסברים, אסור ```json, אסור markdown.
- **אסור** מפתח בשם `universalTabs` בשום מקום — הפלט שטוח (flat), כל השדות ברמת השורש.
- `contentType` חייב להיות המחרוזת `"market"`.

## כללי JSON קפדניים — חובה

- אסור מרכאות כפולות (`"`) בתוך ערכי מחרוזת — כולל מונחי שוק וקיצורים בעברית: כתוב נאסדק (לא נאסד"ק), אגח (לא אג"ח), תא (לא ת"א), חכ (לא ח"כ) — ללא גרשיים בשום מקרה.
- חובה פסיק בין כל שני שדות סמוכים ובין כל שני פריטים סמוכים במערך — אסור להשמיט פסיקים נדרשים.
- אסור לחתוך את ה-JSON באמצע — כל האובייקטים והמערכים חייבים להיסגר, כולל הסוגריים המסולסלות/מרובעות האחרונות.
- אסור להכניס מבנה JSON גולמי (object/array מקונן) בתוך ערך שאמור להיות מחרוזת פשוטה.
- שורות חדשות בתוך מחרוזת — כתוב `\n` (backslash + n), לא שורה חדשה אמיתית.
- כל ערך מערך (array) הוא **primitive (מחרוזת) בלבד** בשדות `keyInsights`, `tags` — לא אובייקטים מקוננים.
- בשדות `frameworks`, `checklists`, `mistakesToAvoid`, `financialMetrics`, `valuation`, `investmentChecklist`, `promptTemplates`, `usefulKnowledge` — כל פריט הוא **או** מחרוזת פשוטה **או** אובייקט עם זמן וציטוט-מקור (ר' "פריט עם זמן וציטוט-מקור" למטה). לעולם לא מבנה מקונן מעבר לצורה המדויקת הזו — אסור array/object בתוך שדה שאמור להיות string.
- בשדה `stockFundamentals` — כל פריט הוא **תמיד אובייקט** (לא מחרוזת) בצורה `{ ticker, company, metric, value, interpretation, asOf, sourceQuote, estimatedStartSeconds, timestampKind }` — ר' סעיף ייעודי למטה. `ticker`/`metric`/`value` חובה; פריט חסר אחד מהם יושמט בשקט.

# מיפוי שדות → טאבים באפליקציה (7 הטאבים הקבועים)

האפליקציה מציגה תמיד 7 טאבים קבועים לכל וידאו. הטבלה הבאה קובעת בדיוק אילו שדות JSON שטוחים מזינים כל טאב — אין לסטות משמות השדות, הם קבועים בקוד.

| # | טאב (label בעברית) | שדה/שדות JSON ברמת השורש | סוג |
|---|---|---|---|
| 1 | סיכום | `shortSummary` **(המרכזי, מוצג ראשון)**, `mainLesson` **(מוצג כפריט נוסף)**, `fullSummary` **(מוצג בכרטיס נפרד "סיכום מלא")** | string |
| 2 | פרקים | `chapters` | array of `{ title, startSeconds, endSeconds, summary }` |
| 3 | תובנות | `keyInsights` | array of strings |
| 4 | ידע שימושי | `usefulKnowledge`, `checklists`, `mistakesToAvoid`, `frameworks`, `financialMetrics`, `valuation`, `investmentChecklist`, `promptTemplates` — כל חומר הלימוד, מפוצל לסעיפים מתויגים בתוך הטאב | array of strings |
| 5 | APP | *(אין שדה — לא נגיש דרך JSON שטוח כיום, אל תמלא)* | — |
| 6 | נושאים ותתי־נושאים | `tags` | array of strings — **תגיות נושא בלבד** (למשל "עונת הדוחות", "מכפילי שווי") — **אסור טיקר/שם חברה כאן** |
| 7 | תוכן ייעודי | `stockFundamentals` **(חדש, 2026-09-11)** — נקודות-נתון פונדמנטליות לפי טיקר, מוצג בסעיף "📊 נתונים פונדמנטליים" מעל "⭐ מניות שהוזכרו". ר' סעיף ייעודי למטה | array of objects |

**הנחיה ל-`shortSummary`:** הוא היחיד שמוצג ראשון/בולט בטאב 1 (טבלה למעלה), ולכן חייב לכלול את **המסקנה המרכזית** של הסרטון, לא רק פתיח כללי — כאילו תוכן `mainLesson` שולב בתוכו במשפט אחד או שניים. חובה למלא גם `fullSummary` וגם `mainLesson` במלואם — שניהם מוצגים בפועל (`mainLesson` כפריט נוסף באותו טאב, `fullSummary` בכרטיס "סיכום מלא" נפרד) — אך אין להסתמך עליהם *בלבד* כדי להעביר מידע קריטי, כי `shortSummary` מוצג ראשון ובולט יותר.

## 7 שדות התוכן הלימודי — כולם זורמים לטאב 4 ("ידע שימושי"), מפוצלים לסעיפים

אלה 7 השדות שנועדו לתפוס את החומר הלימודי העיקרי שהסרטון מלמד (מושגים, מדדים, מסגרות, תבניות פרומפט) — כל אחד מוצג כסעיף נפרד ומתויג בטאב 4:

| שדה JSON | סעיף בטאב 4 | תוכן |
|---|---|---|
| `frameworks` | ⚙️ מסגרות ניתוח | מסגרות-על לניתוח פונדמנטלי — **כולל את 4 דשבורדי-העל** (Foundation/Momentum/Valuation History/Capital Allocation, ר' סעיף "4 דשבורדי-העל" למטה), כל דשבורד כפריט `frameworks` נפרד |
| `financialMetrics` | 📈 מדדים פיננסיים | מדדי רווחיות, תזרים מזומנים, ואיתנות פיננסית — ר' "מפת 26 ה-KPI" למטה, שכבות 1+3+4 |
| `valuation` | 💰 הערכת שווי | מכפילי שווי — ר' "מפת 26 ה-KPI" למטה, שכבה 2 |
| `investmentChecklist` | 📋 צ'קליסט השקעה | הנהלה, אנליסטים, buybacks, עסקאות בעלי עניין — ר' "מפת 26 ה-KPI" למטה, שכבה 5 |
| `promptTemplates` | 📜 תבניות פרומפט | תבניות הפרומפט המדויקות שהסרטון מלמד להרצה בכלי AI חיצוני (למשל Perplexity Finance) — ר' "תבניות פרומפט" למטה |
| `checklists` | ✅ צ'קליסטים | כללי-אצבע כלליים לניתוח פונדמנטלי (לא ספציפי-שכבה) |
| `mistakesToAvoid` | ❌ טעויות נפוצות | טעויות נפוצות בניתוח פונדמנטלי — כולל מגבלות מתודולוגיות (ר' "מגבלות ומסגרת" למטה) |

**עקרון-על:** אין להזכיר טיקר/שם חברה ספציפי כ"נושא" של פריט — כל 7 השדות האלה נועדו לחומר לימודי כללי/רב-פעמי-שימוש (בדיוק כפי שנאמר בהגדרת "תפקיד" למעלה). מותר להזכיר חברה כ**דוגמה קצרה** בתוך פריט (כמו שהסרטון עצמו מזכיר NVIDIA/AMD/Broadcom כדוגמאות ליישום מסגרת השוואה, לא כהמלצת השקעה) — אך אסור שפריט שלם יהיה "ניתוח של חברה X" ולא "הסבר על מדד/מסגרת/תבנית עם דוגמה".

## `stockFundamentals` — נקודות-נתון פונדמנטליות בפועל, לפי טיקר (חדש, 2026-09-11)

**זה בדיוק ההפך מ-7 השדות למעלה.** 7 השדות למעלה מסבירים *מהו* מדד (הגדרה כללית, רב-פעמית-שימוש). `stockFundamentals` מתעד *מה נאמר בפועל בסרטון על טיקר ספציפי, ביום הזה* — מספר אמיתי, לא הסבר. **אל תכתוב את אותו מידע פעמיים** — אם הסרטון אומר "מכפיל הרווח העתידי של אפל הוא 34.3", זה שורה אחת ב-`stockFundamentals` (`ticker:"AAPL", metric:"מכפיל עתידי", value:34.3`) — **לא** גם פריט חדש ב-`valuation` שמסביר "Forward P/E". `valuation`/`financialMetrics` נשארים מוקדשים אך ורק להגדרות/מסגרות כלליות, גם כשמזכירים דוגמת-חברה קצרה בתוך ההסבר (כפי שכבר מותר לעיל).

### צורת כל פריט

```json
{
  "ticker": "AAPL",
  "company": "Apple",
  "metric": "מכפיל עתידי",
  "value": 34.3,
  "interpretation": "התנגדות היסטורית — שיא 10 שנים",
  "asOf": "2026-09-09",
  "sourceQuote": "מכפיל הרווח העתידי של אפל עומד היום על 34.3, וזו בדיוק הרמה שממנה המניה נדחתה כמה פעמים בעבר",
  "estimatedStartSeconds": 470,
  "timestampKind": "estimated"
}
```

**שדות חובה** — פריט בלי אחד משלושת אלה נזרק בשקט על ידי הקוד (לא שגיאה, פשוט לא יוצג): `ticker`, `metric`, `value`.
**שדות מומלצים מאוד** (לא חוסמים, אך בלעדיהם השורה חסרת-הקשר): `company`, `interpretation`, `asOf`.
**שדות זמן** (`estimatedStartSeconds`/`timestampKind`/`sourceQuote`) — אותו כלל בדיוק כמו בסעיף "פריט עם זמן וציטוט-מקור" למעלה: מלא רק כשבטוחים, עדיף להשמיט מאשר לנחש.

`value` יכול להיות מספר (`34.3`) או מחרוזת קצרה אם המספר לבדו לא מספיק הקשר (`"34.3x"`, `"212 מיליארד דולר"`) — לא צריך יחידה נפרדת, שלב אותה ב-`value` אם צריך.
`asOf` הוא התאריך שהמספר היה נכון לפיו **לפי הסרטון** (למשל תאריך פרסום הסרטון, אם לא צוין תאריך אחר במפורש) — פורמט ISO `YYYY-MM-DD`. אם לא ניתן לדעת מהתמלול — השמט את השדה, אל תמציא תאריך.

### 7 סוגי-חילוץ נדרשים, כשהסרטון מכיל אותם — מנה כל אחד כשורה נפרדת

1. **מדד + ערך + טיקר** — הצורה הבסיסית ביותר: "המכפיל של X הוא Y".
2. **רמת התנגדות/תמיכה פונדמנטלית** — ערך שהמניה נדחתה ממנו בעבר, **כולל כמה פעמים ועל פני איזו תקופה** אם נאמר (`interpretation`, למשל: "נדחתה משם 3 פעמים ב-10 השנים האחרונות").
3. **מיקום ביחס להיסטוריה העצמית** — שיא/שפל/אמצע טווח של 5 או 10 שנים (`interpretation`, למשל: "קרוב לשיא של 10 שנים").
4. **השוואת עמיתים (peer comparison)** — אותו מדד על פני 2-3 טיקרים — שורה נפרדת לכל טיקר, לא שורה אחת משותפת (כדי שכל שורה תישאר יחידה שניתן להשוות/לסנן לפי טיקר).
5. **הסיבה שניתנה לפרמיה/דיסקאונט** — במילים, כפי שנאמרה בסרטון (`interpretation`).
6. **דפוס התנהגות סביב אירועים** — כמו השקות מוצר או דוחות רבעוניים, אם הסרטון מקשר בין אירוע כזה לתנועה במדד (`interpretation`).
7. **טריגר או תנאי שהדובר ציין** — תנאי שהדובר אמר שיגרום לשינוי (למשל "אם המכפיל ירד מתחת ל-25" — `interpretation`).

**כלל אנטי-המצאה, מוחלט:** שורה נכתבת **רק** כשהמספר/הרמה נאמרו בפועל בסרטון. אסור הערכות, אסור ידע חיצוני, אסור למלא פערים. **עדיף להשמיט שורה לגמרי מאשר לנחש** — בדיוק כמו כלל "מקורות מותרים" בראש המסמך. אם מדד נאמר בלי מספר קונקרטי (למשל "המכפיל שלה גבוה" בלי מספר) — אל תכתוב שורה, זה לא `stockFundamentals`, לכל היותר הקשר כללי במקום אחר.

### מה עדיין לא נכתב (מחוץ להיקף)

`stockTechnicals` (רמות טכניות: תמיכה/התנגדות/ממוצע נע/פער מחיר/קו מגמה/נפח) **אינו** שדה שה-GEM הזה מתבקש למלא — מוגדר ב-`docs/gems/GEM-FUNDAMENTAL-SCHEMA.md` לצורך הקוד/הרינדור בלבד; ההוראות לג'ם הטכני ייכתבו בנפרד תחת WORK-ID `TRADINGBRAIN-GEM-TECHNICAL-SCHEMA` (טרם נכתבו).

## מפת 26 ה-KPI — רשימת-בדיקה שחובה לעבור עליה במלואה, לא לסכם

הסרטון מלמד 26 מדדים ספציפיים ב-5 שכבות. **אל תסכם — מנה כל מדד שהוזכר בשם, כפריט נפרד**, גם אם כמה מדדים נשמעים דומים. כל פריט בתבנית הקבועה (ר' מטה), עם השכבה/שם המדד תחת "מושג":

| שכבה | מדדים (עד 26 בס"ה) | שדה JSON |
|---|---|---|
| 1. רווחיות וצמיחה (Core Performance) | Revenue Growth (8 רבעונים), Gross Margin, Operating Margin, Net Margin, EPS, EBITDA | `financialMetrics` |
| 2. תמחור ומכפילים (Valuation Multiples) | P/E, Forward P/E, P/S, EV/EBITDA, PEG Ratio, Price-to-Book | `valuation` |
| 3. תזרים מזומנים (Cash Flow Reality) | Operating Cash Flow, Free Cash Flow (FCF), FCF Margin, FCF Yield | `financialMetrics` |
| 4. בריאות פיננסית ומבנה הון (Balance Sheet & Solvency) | Debt-to-Equity, Net Cash vs Debt, Current Ratio, ROE, ROIC | `financialMetrics` |
| 5. הנהלה ושוק (Governance & Sentiment) | ניתוח שיחות ועידה, קונצנזוס אנליסטים, Earnings Revisions, Share Buybacks, עסקאות בעלי עניין (Insider Transactions) | `investmentChecklist` |

אם הסרטון לא מזכיר מדד מסוים בשם — אל תמציא אותו; פשוט אל תכלול פריט עבורו (אין חובה למלא את כל ה-26 אם חלקם לא הוזכרו בפועל).

## 4 דשבורדי-העל — כל אחד כפריט `frameworks` נפרד

אם הסרטון מלמד מתודולוגיית ריכוז (כמו Foundation/Engine-Momentum/Historical-Valuation/Capital-Allocation), כל דשבורד כזה הוא פריט `frameworks` נפרד — "מושג" = שם הדשבורד, "הגדרה קצרה" = מה הוא מרכז, "איך מודדים" = אילו מדדים/שכבות נכנסים אליו:

- **Foundation (בסיס)**: הכנסות, מרווחי רווח ו-FCF רבעוני/שנתי.
- **Engine / Momentum (מנוע שינוי)**: קצב שינוי ה-EPS, צמיחה שנתית ביחס ליעדים.
- **Valuation History (היסטוריית תמחור)**: השוואת P/E, P/S, EV/EBITDA על פני כמה שנים.
- **Capital Allocation (הקצאת הון)**: הכנסה פר עובד, buybacks, תשואה על ההון המושקע.

## תבניות פרומפט — `promptTemplates`

אם הסרטון מדגים תבנית פרומפט מדויקת שהצופה אמור להריץ בכלי AI חיצוני (כמו Perplexity Finance), לכוד אותה **מילה במילה** כפי שנאמרה, כולל placeholder כמו `[TICKER]`. הטקסט הקבוע של הפריט (שדה `text`, ר' "פריט עם זמן וציטוט-מקור" למטה):

```
מטרה: <מה הפרומפט הזה מפיק> · פרומפט: "<טקסט הפרומפט המדויק, עם [TICKER] כפי שנאמר>" · מקור: <HH:MM:SS או "לא נאמר בסרטון">
```

## תבנית פריט קבועה — חובה לכל פריט ב-frameworks / checklists / mistakesToAvoid / financialMetrics / valuation / investmentChecklist / usefulKnowledge

הטקסט הקבוע של כל פריט (שדה `text`) בשבעת השדות האלה **חייב** לעקוב אחרי התבנית הקבועה הזו, מילה במילה בסדר הזה, מופרדת ב-` · ` (`promptTemplates` יוצא מן הכלל — ר' תבנית נפרדת מעלה; `usefulKnowledge` פטור מהתבנית — משפט חופשי מספיק):

```
מושג: <שם המושג/הכלל> · הגדרה קצרה: <משפט אחד> · מתי זה תקף: <תנאי> · מתי זה לא תקף: <תנאי נגדי או "-" אם לא רלוונטי> · איך מודדים או איפה רואים את זה: <נוסחה/מקום בדוח/אינדיקציה קונקרטית> · מקור: <חותמת זמן HH:MM:SS מהסרטון, או "לא נאמר בסרטון" אם המידע חסר>
```

זו אחידות מכוונת — לא סתם עיצוב. המבנה הקבוע הזה הוא מה שמאפשר לאפליקציה להמיר את הטקסט הזה לשדות מובנים אמיתיים (שם מושג, ערך סף, מקור) **בלי לנתח את הסרטון מחדש**. אל תקצר את התבנית, אל תדלג על חלק ממנה, גם אם החלק ריק — כתוב "לא נאמר בסרטון" או "-" במפורש במקום להשמיט. שים לב: מחרוזת "מקור: HH:MM:SS" בטקסט היא **תיאור אנושי בלבד** — היא **לא** מפעילה קישור-זמן לחיצתי באפליקציה. כדי שהאפליקציה תציג קישור-זמן אמיתי (שקופץ לרגע הזה בסרטון), יש להוסיף גם את שדה הזמן המובנה — ר' הסעיף הבא.

## פריט עם זמן וציטוט-מקור (אופציונלי, מומלץ מאוד)

כל פריט בשמונת השדות (`frameworks`/`checklists`/`mistakesToAvoid`/`financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates`/`usefulKnowledge`) יכול להיות **מחרוזת פשוטה** (כמו עד כה) **או אובייקט** בצורה הזו, כדי להפעיל קישור-זמן לחיצתי אמיתי באפליקציה:

```json
{
  "text": "<הטקסט הקבוע בתבנית — זהה למה שהיה נכתב כמחרוזת>",
  "estimatedStartSeconds": <מספר שניות מתחילת הסרטון — הערכה, לא חובה מדויקת לפריים>,
  "timestampKind": "estimated",
  "sourceQuote": "<ציטוט קצר מילולי מהתמלול, קרוב לרגע הזה — מאפשר לבן-אדם לאמת ידנית>"
}
```

**כללים מחייבים לשדה הזמן:**
- מלא `estimatedStartSeconds`/`timestampKind`/`sourceQuote` **רק** כשאתה סביר בטוח בזמן, מבוסס על מה שבאמת נשמע בתמלול. **עדיף להשמיט את שלושת השדות ולהשאיר רק `text`** (בדיוק כמו מחרוזת רגילה) **מאשר לנחש זמן**. באפליקציה **אין** בדיקת-אמינות אוטומטית על הקלט הזה (ר' ההערה הארכיטקטונית למעלה) — טעות כאן תיצור קישור-זמן שקופץ למקום הלא-נכון בסרטון, לא רק טקסט שגוי.
- `sourceQuote` צריך להיות ציטוט **מילולי קצר** (משפט אחד) מהתמלול עצמו, לא סיכום — זה מה שמאפשר לבן-אדם לאמת את הזמן ידנית.
- `timestampKind` תמיד `"estimated"` בהקשר הזה (לא `"exact"` — אתה מעריך לפי התמלול, לא קורא frame מדויק מהווידאו).
- אם ממלאים את שדה הזמן, עדיין יש לכלול את "מקור: HH:MM:SS" בתוך `text` עצמו — שני הדברים לא סותרים, `text` הוא לקריאה אנושית, שדה הזמן המובנה הוא למנגנון הקישור.

## מגבלות ומסגרת — תוכן חובה ב-`mistakesToAvoid`

מעבר לטעויות ניתוח נקודתיות, `mistakesToAvoid` חייב לכלול גם פריטים על **מגבלות מתודולוגיות** אם הסרטון מתייחס אליהן — למשל: ההבדל בין ניתוח מאקרו לניתוח מיקרו (רמת-חברה), מגבלות מודל DCF (תחזית מבוססת הנחות, לא עובדה), וההבחנה בין "בריאות פונדמנטלית" ל"תזמון שוק" (ניתוח פונדמנטלי לא אומר מתי לקנות, רק אם העסק בריא). כל אחד כפריט נפרד בתבנית הקבועה.

# איסורים מפורשים

- אסור להמליץ "לקנות"/"למכור" מניה ספציפית — רק לתאר מה נאמר בתמלול לגבי ניתוח.
- אסור למלא מספר/נתון פיננסי שלא נאמר בפועל — כתוב "לא נאמר בסרטון".
- אסור שפריט שלם יהיה ניתוח של חברה ספציפית (המלצה/מסקנת השקעה) — ראה "עקרון-על" למעלה; מותרת רק דוגמה קצרה בתוך פריט לימודי.
- אסור למלא שדות `analysisFrameworks`/`riskRules`/`universalTabs`/`warnings` — אינם נתמכים כרגע דרך JSON שטוח; שימוש בהם לא יגרום לשגיאה, אך התוכן לא יוצג בשום מקום באפליקציה (מבוזבז). `financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates` **כן** נתמכים כעת — ר' טבלת "7 שדות התוכן הלימודי" למעלה. במקום `warnings` — כל תוכן מסוג סיכון/אזהרה שייך ל-`mistakesToAvoid`.

# פורמט פלט

החזר אך ורק אובייקט JSON אחד, במבנה שמתואר ב-`docs/gems/GEM-FUNDAMENTAL-SCHEMA.md` ומודגם ב-`docs/gems/GEM-FUNDAMENTAL-EXAMPLE.json`.
```

**⚠️ Verified-stale content inside the block itself:** the row "5 | APP | *(אין שדה...אל תמלא)*" and the "איסורים"-list line banning `warnings` as unsupported/wasted are **both factually wrong against the current code** — see §2.9 (APP tab is now reachable) and the note below (`warnings` is now displayed, merged with `mistakesToAvoid`). This is the literal text a person would paste into Gemini today; it actively tells the GEM not to do something the app now supports. **Contradiction, confirmed against live code:** `videoTabsConfig.js:786-792` (`case 'mistakes'`) concatenates `pickArray(video,'mistakesToAvoid')` + `pickArray(video,'warnings')` + `pickArray(video,'riskRules')` — `warnings` **is** displayed today, merged into "❌ טעויות נפוצות" alongside `mistakesToAvoid`. The doc's own non-pasteable commentary (`GEM-FUNDAMENTAL-INSTRUCTIONS.md:8,203`) already acknowledges this fix happened, but the pasteable instruction block itself was never updated to match — low practical severity (no data is lost, since the GEM is told to route warning-content into `mistakesToAvoid` anyway) but a real, live doc/code mismatch inside text a person actually pastes into Gemini.

### 2.4 Schema contract doc — verbatim

Source: `docs/gems/GEM-FUNDAMENTAL-SCHEMA.md`, reproduced in full (this is the project's own file:line-cited engineering record of the flat-JSON contract, not a pasteable prompt — reproduced here in full per this audit's "complete, not summarized" mandate for GEM schemas). Note that several statements inside this doc are themselves superseded by even-later entries later in the same doc (the doc is a running log) — read sequentially, later sections correct earlier ones, as the doc itself does.

```markdown
# GEM-FUNDAMENTAL-SCHEMA

**WORK-ID:** TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA
**סוג מסמך:** חוזה JSON מדויק, נגזר מחדש מקריאת קוד בפועל (לא מהעתקת סיכום הביקורת הקודמת). כל שדה מצוטט עם file:line. אין שינוי קוד — מסמך תיעוד בלבד.
**החלטות מנחות (לא לערער, נקבעו על ידי המשתמש):** ראו `docs/plan/AUDIT-TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA.md` — 7 ההחלטות הפתוחות שם הוכרעו: JSON שטוח בלבד (Decision 2), פער financial-metrics/valuation מקובל ל-v1 (Decision 1, **נסגר בקוד ב-2026-09-10, ר' למטה**), אין טבלת מניות ייעודית חדשה (Decision 3).

**עדכון ארכיטקטוני (2026-09-10, כלל "טאב 7 = תוכן יומי בלבד"):** כלל חדש, גורף לכל הנושאים באפליקציה (לא רק פונדמנטלי): טאב 7 ("תוכן ייעודי") שמור אך ורק לתוכן ספציפי-לחברה/מניה **של אותו יום**. כל חומר לימודי כללי — `frameworks`/`checklists`/`mistakesToAvoid` וגם 4 שדות חדשים (`financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates`) — עבר לטאב 4 ("ידע שימושי"). ה-branch `macro` **לא נגע בו** — נבדק ונמצא כבר תואם לכלל (`MacroGemDashboard.jsx` מציג רק תוכן יומי אמיתי: אירועים, סיכונים, סקטורים, מניות, מדדים — אין שם אף סעיף "לימודי"). ענפי המבזקים (`morning-brief`/`evening-brief`/`weekly-brief`/`earnings-brief`) **לא נגעו בהם כלל**, לפי דרישה מפורשת.

**⚠️ עדכון ארכיטקטוני שני, מבטל את הראשון עבור טאב 7 בלבד (2026-09-11 לילה, הכרעת משתמש סופית — ר' `docs/gems/FUNDAMENTAL-OVERVIEW.md` §7):** ההצהרה למעלה ש-`fundamental-analysis`/`technical-analysis` branches "רוקנו מ-`sectionDefs` ונופלות תמיד ל-empty-state המשותף" **אינה נכונה יותר**. המשתמש ביקש במפורש שטאב 7 יציג את **9 הסעיפים המלאים** של דשבורד המבזק (`<MorningBriefDashboard>` — 🧠 סנטימנט עם Fear&Greed/AAII חיים, 📊 מצב שוק, 📅 לוח כלכלי, 🌍 מאקרו, 📰 חדשות, 🎯 הזדמנויות וסיכונים, 🏭 סקטורים, 📈 שווקים, ⭐ מניות שהוזכרו) — **עם ה-empty-state העצמאי של כל סעיף בנפרד**, לא empty-state כולל-אחד. **הג'ם הפונדמנטלי עצמו עדיין לא פולט שום דבר לטאב 7** — זו האפליקציה שמרנדרת את מבנה 9 הסעיפים בכל מקרה (בדיוק כמו שהיא עושה למבזק לפני ניתוח GEM); כל שדה-תוכן שהג'ם הזה כותב עדיין הולך לטאבים 3/4 בלבד, ללא שינוי. סעיפים 3-8 למטה (למעט §5 שורת "תוכן ייעודי (7)", המתוקנת בנפרד) נשארים נכונים כמתועד — ההבדל הוא ורק בהתנהגות טאב 7 עצמו.

---

## 1. נקודת הכניסה בפועל

`VideoDetailPanel.jsx`'s `handleApplyGemsJson()` → `parseAndValidateGemsJson(raw)` (`src/lib/gemsJsonRepair.js:303`) → בהצלחה → `_applyParsedGems(result.value)` (`VideoDetailPanel.jsx:6524`).

`_applyParsedGems` בודק בסדר הזה (`VideoDetailPanel.jsx:6531-6660`):
1. `canonicalParsed?.contentType === 'marketBrief'` → נתיב מבזק (**לא** לשימוש כאן).
2. `parsed?.universalTabs?.appBuilder` קיים + לא marketBrief → נתיב App Builder נפרד.
3. `canonicalParsed?.contentType === 'market' && canonicalParsed?.universalTabs` (object) → נתיב "Macro / Universal Market GEM", מאחסן ל-`marketBriefData`.
4. **אחרת (זה הנתיב שלנו)** → `normalizeAiAnalysisResult(parsed)` (`VideoDetailPanel.jsx:6666`) → `completeGemsImport(pending, normalized)` (`VideoDetailPanel.jsx:6700`) — ממזג (merge) את פלט ה-normalize **ישירות על אובייקט ה-`video`**.

**אימות קריטי ל-Decision 2:** `canonicalizeGemsPayloadForPersistence(value)` (`src/lib/gemsJsonRepair.js:152-177`), הפונקציה הראשונה שרצה בתוך `_applyParsedGems` (`VideoDetailPanel.jsx:6531`), פותחת ב: `if (!isPlainObject(value) || !isPlainObject(value.universalTabs)) return value;` (`gemsJsonRepair.js:153`). כלומר **אם `universalTabs` נעדר לגמרי מה-JSON, הפונקציה מחזירה את האובייקט ללא שינוי** — מאושר: JSON שטוח ללא `universalTabs` בהחלט ינתב לנתיב 4 לעיל, בלי סיכון "לגלוש" בטעות לנתיב 3.

---

## 2. שער-הקבלה של `validateGemsJsonValue` לנתיב השטוח (`src/lib/gemsJsonRepair.js:248-301`)

- Root **חייב** להיות plain object (`gemsJsonRepair.js:250-252`).
- `contentType`, אם קיים, חייב להיות string (`:254-256`).
- **מכיוון של-JSON השטוח שלנו אין `universalTabs`**, הבדיקה `isPlainObject(universalTabs)` (`:264`) נכשלת ומדלגים ישר ל-branch האחרון (`:296-300`):

```js
const GENERIC_ANALYSIS_FIELDS = [
  'shortSummary', 'fullSummary', 'keyPoints', 'allPoints', 'chapters',
  'keyInsights', 'usefulKnowledge', 'actionItems', 'politicalSummary', 'brainHighlights',
];
```
(`src/lib/gemsJsonRepair.js:28-39`)

**דרישת-סף מחייבת:** לפחות שדה אחד מתוך 10 השדות האלה **חייב** להופיע ברמת השורש, אחרת `validateGemsJsonValue` מחזירה `ok:false` עם השגיאה `'No recognized GEMS analysis fields were found.'` (`:297-299`), ו-`parseAndValidateGemsJson` **דוחה את כל ה-JSON** לפני שהוא מגיע בכלל ל-`normalizeAiAnalysisResult`. בפרקטיקה: `shortSummary`, `fullSummary`, `chapters`, `keyInsights`, ו-`usefulKnowledge` (כולם מומלצים ב-instructions ממילא) מספיקים בנוחות.

---

## 3. מיפוי שדה→שדה מדויק: `normalizeAiAnalysisResult()` (`src/services/videoAnalytics.js:1080-1293`)

זו הפונקציה שמייצרת את האובייקט שמתמזג בפועל על `video`. הטבלה הבאה מצטטת כל שורת-מיפוי רלוונטית:

| שדה פלט (נכתב על `video.<key>`) | קורא מ-(`merged`/`nested`/`learning` = spread של `result`/`result.analysis`) | file:line |
|---|---|---|
| `shortSummary` | `merged.shortSummary \|\| merged.summary \|\| nested.shortSummary \|\| nested.summary` | `videoAnalytics.js:1156-1162` |
| `fullSummary` | `merged.fullSummary \|\| merged.longSummary \|\| nested.fullSummary \|\| nested.longSummary` | `:1163-1169` |
| `mainLesson` | `merged.mainLesson` (string) או `.summary`/`.title` | `:1125-1129, 1177` |
| `chapters` | `normalizeAnalysisChapters(merged.chapters \|\| merged.sections \|\| merged.segments \|\| merged.topics \|\| merged.videoTopics \|\| merged.aiChapters)` | `:1092-1100, 1227` |
| `keyInsights` | `merged.keyInsights \|\| nested.keyInsights \|\| utB.keyInsights \|\| bkB.keyInsights` (+ מאוחד עם `learning.keyInsights`) | `:1187-1194` |
| `usefulKnowledge` | `merged.usefulKnowledge \|\| nested.usefulKnowledge \|\| learning.usefulKnowledge \|\| learning.keyTakeaways` | `:1225` |
| `tags` | `merged.tags \|\| merged.aiTags \|\| nested.tags \|\| nested.aiTags \|\| bkB.tags` | `:1180` |
| **`frameworks`** | `merged.frameworks \|\| nested.frameworks \|\| learning.frameworks` | `:1204-1206` |
| **`checklists`** | `merged.checklists \|\| nested.checklists \|\| learning.checklists` | `:1198-1200` |
| **`mistakesToAvoid`** | `merged.mistakesToAvoid \|\| nested.mistakesToAvoid` | `:1184-1186` |
| **`warnings`** | `merged.warnings \|\| nested.warnings \|\| learning.warnings \|\| specB.riskFactors \|\| bkB.warnings` | `:1201-1203` — **מוצג בפועל כעת, ממוזג עם `mistakesToAvoid`, ר' §6.1 המתוקן** |
| **`financialMetrics`** (חדש, 2026-09-10) | `normalizeLearningArray(merged.financialMetrics \|\| nested.financialMetrics)` | `:1207` |
| **`valuation`** (חדש, 2026-09-10) | `normalizeLearningArray(merged.valuation \|\| nested.valuation)` | `:1208` |
| **`investmentChecklist`** (חדש, 2026-09-10) | `normalizeLearningArray(merged.investmentChecklist \|\| nested.investmentChecklist)` | `:1209` |
| **`promptTemplates`** (חדש, 2026-09-10) | `normalizeLearningArray(merged.promptTemplates \|\| nested.promptTemplates)` | `:1210` |

**עדכון (2026-09-11, WORK-ID TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY):**

| **`stockFundamentals`** (חדש, 2026-09-11) | `normalizeStockFundamentalsArray(merged.stockFundamentals \|\| nested.stockFundamentals)` — normalizer ייעודי, **לא** `normalizeLearningArray` (שקורס אובייקטים למחרוזת-תצוגה) | `videoAnalytics.js` (ליד שורה 1209-1210, פונקציית `normalizeStockDataPointItem`) |

שלא כמו 8 השדות בטבלה למעלה, `stockFundamentals` הוא **תמיד** מערך אובייקטים מובנים (`{ticker, company, metric, value, interpretation, asOf, sourceQuote, estimatedStartSeconds, timestampKind}`), לא טקסט. הנורמליזר **דורש** `ticker`+`metric`+`value` — פריט חסר אחד משלושתם מוחזר `null` ומסונן בשקט (`Array.prototype.filter(Boolean)`), לא שגיאת-parse. ר' §10 למטה לפירוט המלא (שדה, מיפוי, רינדור, gate).

**עדכון (2026-09-10):** 4 השדות האחרונים בטבלה נוספו כעת — סוגר את הפער ההיסטורי (ראו למטה, §4/§5/§8 היו). **עדיין לא ממופים בכלל**, מאומת בקריאת הפונקציה השלמה: `analysisFrameworks` (רק `frameworks` ממופה — שם השדה הנכון הוא `frameworks`, **לא** `analysisFrameworks`), `riskRules`. אם ה-GEM יחזיר אחד משני אלה, הם פשוט **יושמטו בשקט**.

**✅ תוקן — `warnings`, `fullSummary`, `mainLesson` ממופים כאן וכעת גם מוצגים, כל אחד במסלול משלו (`mainLesson`/`warnings`: ledger "Recently resolved", 2026-09-10; `fullSummary`: שורת ledger 2026-09-11, "Key-points card restyle"):** הטבלה למעלה נכונה — `normalizeAiAnalysisResult` כותבת את שלושת השדות האלה על `video`. עד 2026-09-10 השכבה הבאה — `extractVideoTabItems()` ב-`videoTabsConfig.js` — השתמשה ב-`pickArray`/`pickStringAsArray` "ראשון-לא-ריק-מנצח, לא ממזג", מה שגרם לשלושת השדות האלה לא להיקרא בפועל כש-`shortSummary`/`mistakesToAvoid` היו מלאים. **קריאה ישירה של הקוד הנוכחי מצאה ששלושתם תוקנו, בשני מנגנונים נפרדים**: (א) `case 'mistakes'` (`videoTabsConfig.js`, ליד שורה 783) מריץ כעת שלוש קריאות `pickArray` נפרדות ל-`mistakesToAvoid`/`warnings`/`riskRules`, ממוזגות יחד — `warnings` מוצג עכשיו בטאב 4 יחד עם `mistakesToAvoid`; (ב) `case 'summary'` (ליד שורה 689) מריץ כעת שתי קריאות `pickStringAsArray` נפרדות — שרשרת האליאסים המקורית (`shortSummary`/`fullSummary`/`gemSummary`/`summary`, ראשון-לא-ריק-מנצח, ללא שינוי) ואז `mainLesson` בנפרד, שמוצג כעת תמיד בנוסף — `fullSummary` **עדיין** נחשב אליאס בתוך `case 'summary'` עצמו ולכן לא נבדק שם כש-`shortSummary` מלא; אך הוא כעת מוצג דרך מסלול נפרד וחדש: `FullSummaryParagraphs` (`src/components/dashboard/FullSummaryParagraphs.jsx`, קומפוננטה חדשה) מרונדרת ב-`VideoDetailPanel.jsx:11234` כ-`<FullSummaryParagraphs text={effectiveVideo.fullSummary} .../>` — כרטיס "📖 סיכום מלא" עצמאי, בלתי-תלוי ב-`extractVideoTabItems('summary')`. פירוט מלא בסעיף 6.1 למטה, שעודכן בהתאם.

---

## 4. שני הפערים המדויקים שנדרשו לפתרון עמימות (i)/(ii)

### (i) שם השדה המדויק ל-frameworks/checklists/mistakesToAvoid/warnings — נפתר

מאושר בטבלה שלמעלה (סעיף 3), ישירות מקריאת `videoAnalytics.js:1184-1206`: השמות הנכונים והיחידים שממופים בפועל הם `frameworks` (**לא** `analysisFrameworks`), `checklists`, `mistakesToAvoid`, `warnings`. אין תמיכה ב-`riskRules` בנתיב הזה כלל (בניגוד לסכימה השטוחה הישנה `getMarketSchemaExample()` שכן כוללת `riskRules` — אך זו שייכת לנתיב אחר, לא ל-`normalizeAiAnalysisResult`). **הערה (מתוקנת 2026-09-11):** "ממופה" כאן פירושו שהשדה נכתב על `video`; `warnings` ספציפית **כן מוצג כעת בפועל**, ממוזג עם `mistakesToAvoid` בתוך אותו סעיף בטאב 4 — ראה §6.1 המתוקן.

### (ii) `checklists` מול `investment-checklist` — היה כפול, **נסגר בקוד ב-2026-09-10**

`src/config/videoTabsConfig.js`'s `extractVideoTabItems()` — המצב **ההיסטורי** (לפני 2026-09-10):

```js
case 'checklists':
  return [...pickArray(video, 'checklists'), ...pickArray(al, 'checklists'), ...pickArray(a, 'checklists', 'rules')];

case 'investment-checklist':
  return [
    ...pickArray(video, 'investmentChecklist'),        // ← היה לעולם ריק (לא ממופה)
    ...pickArray(a, 'investmentChecklist'),
    ...pickArray(video, 'checklists'), // graceful fallback  ← המקור בפועל, תמיד
  ];
```

**התיקון שבוצע (2026-09-10):** עכשיו `investmentChecklist` ממופה (§3 למעלה), וה-`case` שונה לגייט אמיתי — `checklists` נכנס כ-fallback **רק אם** `investmentChecklist` ריק:

```js
case 'investment-checklist': {
  const primary = [...pickArray(video, 'investmentChecklist'), ...pickArray(a, 'investmentChecklist')];
  return primary.length > 0 ? primary : pickArray(video, 'checklists');
}
```
(`src/config/videoTabsConfig.js`, ליד case `'checklists'`)

**מסקנה עדכנית:** כשה-GEM ממלא את שני השדות (מומלץ עכשיו — `checklists` לכללי-אצבע כלליים, `investmentChecklist` לתוכן הנהלה/אנליסטים/buybacks), שני הסעיפים בטאב 4 ("✅ צ'קליסטים" ו-"📋 צ'קליסט השקעה") מציגים תוכן **שונה בפועל**, לא כפול. הכפילות ההיסטורית עדיין קיימת רק אם ה-GEM משאיר את `investmentChecklist` ריק (התנהגות legacy, עדיין נתמכת לתאימות-לאחור).

---

## 5. מיפוי מלא: שדה JSON → טאב/אזור באפליקציה, עם סטטוס נגישות (מעודכן 2026-09-10)

**שינוי מבני:** כל 7 שדות התוכן הלימודי (כולל 4 החדשים) עברו מטאב 7 לטאב 4 — טאב 7 אינו מקבל אף שדה מהג'ם הפונדמנטלי הזה יותר (ר' "עדכון ארכיטקטוני" בראש המסמך).

| שדה JSON שטוח | טאב (#) | אזור | נגיש דרך JSON שטוח? | מקור בקוד |
|---|---|---|---|---|
| `shortSummary` | סיכום (1) | — | ✅ כן | `videoTabsConfig.js` case `'summary'`, `pickStringAsArray(video,'shortSummary','fullSummary','gemSummary','summary')` (`~689`) — ראשון-לא-ריק-מנצח בין 4 האליאסים |
| `mainLesson` | סיכום (1) | — | ✅ **כן, תוקן 2026-09-11** — `pickStringAsArray(video,'mainLesson')` נפרד, מתווסף תמיד (ר' §6.1) | אותו case, קריאה שנייה נפרדת |
| `fullSummary` | סיכום (1) — כרטיס "📖 סיכום מלא" נפרד | — | ✅ **כן, תוקן 2026-09-11** — לא דרך `case 'summary'` (שם עדיין אליאס-בלבד), אלא כרטיס עצמאי | `FullSummaryParagraphs.jsx`, מרונדר ב-`VideoDetailPanel.jsx:11234` |
| `chapters` | פרקים (2) | — | ✅ כן | case `'chapters'` (`~703-706`), `normalizeAnalysisChapters` |
| `keyInsights` | תובנות (3) | — | ✅ כן | case `'insights'` legacy (`~814-825`) |
| `usefulKnowledge` | ידע שימושי (4) | 📚 ידע לשימוש חוזר | ✅ כן | case `'useful-knowledge'` legacy (`~735-743`) |
| `frameworks` | ידע שימושי (4) | ⚙️ מסגרות ניתוח (**הועבר מטאב 7**, 2026-09-10) | ✅ כן | `VideoDetailPanel.jsx`'s תוכן-לימודי section array (ליד שורה 12400), case `'analysis-frameworks'` |
| `checklists` | ידע שימושי (4) | ✅ צ'קליסטים (**הועבר מטאב 7**) | ✅ כן | אותו מערך, case `'checklists'` |
| `mistakesToAvoid` | ידע שימושי (4) | ❌ טעויות נפוצות (**הועבר מטאב 7**, תווית שונתה מ"⚠️ סיכונים") | ✅ כן | אותו מערך, case `'mistakes'` |
| `financialMetrics` (חדש) | ידע שימושי (4) | 📈 מדדים פיננסיים | ✅ **כן — נסגר הפער, Decision 1** | case `'financial-metrics'` (`~924-929`), קורא `video.financialMetrics` שממופה כעת (§3) |
| `valuation` (חדש) | ידע שימושי (4) | 💰 הערכת שווי | ✅ **כן — נסגר הפער, Decision 1** | case `'valuation'` (`~931-935`), קורא `video.valuation` שממופה כעת |
| `investmentChecklist` (חדש) | ידע שימושי (4) | 📋 צ'קליסט השקעה | ✅ כן, תוכן נפרד מ-`checklists` כעת (§4-ii) | case `'investment-checklist'`, גייט חדש |
| `promptTemplates` (חדש) | ידע שימושי (4) | 📜 תבניות פרומפט (סעיף חדש) | ✅ כן | case `'prompt-templates'` (חדש) |
| — | APP (5) | — | ❌ **לא** — ראו סעיף 6 | `AppBuilderTab.jsx` |
| `tags`/`obsidianTopics`/`metadataTopics` | נושאים ותתי־נושאים (6) | — | ✅ כן (`tags` מומלץ) | case `'topics-subtopics'` legacy (`videoTabsConfig.js:1196-1199`) |
| `warnings` | ידע שימושי (4) — ❌ טעויות נפוצות (ממוזג עם `mistakesToAvoid`) | — | ✅ **כן, תוקן 2026-09-11** — ר' §6.1 | case `'mistakes'` (`~783`), קריאת `pickArray` נפרדת ל-`warnings`, ממוזגת עם `mistakesToAvoid`/`riskRules` |
| `stockFundamentals` (חדש) | תוכן ייעודי (7) | 📊 נתונים פונדמנטליים (**חדש, מעל "⭐ מניות שהוזכרו"**) | ✅ כן — case `'stock-fundamentals'` ב-`extractVideoTabItems` | `videoTabsConfig.js`, מיד אחרי case `'prompt-templates'` |
| — | תוכן ייעודי (7) | — | **מוצג — דשבורד-מבזק בן 9+2 סעיפים (2 החדשים רק לוידאו פונדמנטלי/טכני, ר' §10), כל סעיף עם empty-state עצמאי; הוכרע 2026-09-11, ר' `FUNDAMENTAL-OVERVIEW.md` §7** | `SpecializedContentRenderer.jsx`'s `fundamental-analysis`/`technical-analysis` branches מרנדרות `<MorningBriefDashboard showStockDataSections>`; שאר סעיפי-המבזק ריקים במובן "אין `marketBriefData`" — לא ב-`stockFundamentals`/`stockTechnicals` |

---

## 6. ממצא נוסף שהתגלה תוך כדי אימות מחדש: טאב APP אינו נגיש דרך JSON שטוח כלל

`VideoDetailPanel.jsx:12210-12216` מרנדר את טאב 5 ("APP") באמצעות `<AppBuilderTab video={video} topicName={...} marketBriefData={marketBriefData} />` — **לא** דרך `extractVideoTabItems()`. קריאת `src/components/dashboard/AppBuilderTab.jsx:1-51` מאשרת: התוכן היחיד שהקומפוננטה מציגה מגיע מ-`discoverFeaturesFromMacro(marketBriefData)` (שורה 32-35) — כלומר תלוי **ב-`marketBriefData` בלבד**, לא בשום שדה על `video`. בנתיב השטוח (Decision 2) `marketBriefData` נשאר `null` (הוא מוגדר רק בנתיבים 1/3 של `_applyParsedGems`, לא בנתיב 4 שאנחנו משתמשים בו). `normalizeAiAnalysisResult` אמנם מחזירה שדה `appBuilding` (`videoAnalytics.js:1264-1284`), אך אומת בגריפ רחב (`grep -rn "\.appBuilding\b" src/`) ש-**שום קומפוננטה שמרנדרת את טאב 5 לא צורכת אותו** — הצרכנים היחידים של `appBuilding`/`analysis.appBuilding` הם `KnowledgeBrainSections.jsx` ו-`SummaryTabView.jsx`, שני מסכים **שאינם** טאב 5 של 7-הטאבים.

**מסקנה:** בניגוד לפער financial-metrics/valuation (שהיה כבר ידוע), זהו ממצא **חדש** שהתגלה רק באימות המחודש הזה. הוראות ה-GEM (`GEM-FUNDAMENTAL-INSTRUCTIONS.md`) מכוונות במפורש שלא לנסות למלא תוכן ל-APP. זהו gap תיעודי בלבד — לא בוצע שום שינוי קוד.

**⚠️ הערת-מתאם (Section 2.9 למטה, מבוססת על ממצא סוכן-מחקר נפרד, gem-architect): הקביעה הזו — ש-tab 5/APP אינו נגיש דרך JSON שטוח — נמצאה שגויה מול הקוד החי בסבב-ביקורת נפרד ומאוחר יותר. ר' §2.9 להמשך והכרעה.**

### 6.1 ✅ "נכתב אך לעולם לא מוצג" — היה נכון עד 2026-09-10, תוקן בקוד ומתועד ב-ledger (ר' למטה)

ממצא זה עלה ב-2026-09-10 מהרצת GEM אמיתי (לא הדוגמה שלנו) על תמלול פונדמנטלי אמיתי, והשוואת ה-JSON שחזר מול מה שהוצג בפועל בטאבים. שורש הבעיה **לא היה** ב-`normalizeAiAnalysisResult` (שממפה את כל השדות נכון, ראה §3) — הוא היה בשכבה שאחריה, ב-`extractVideoTabItems()` (`src/config/videoTabsConfig.js`), ששימשה בשני helpers שבנויים "ראשון-לא-ריק-מנצח, לא ממזגים":

```js
// src/config/videoTabsConfig.js:403-409
function pickArray(obj, ...keys) {
  for (const key of keys) {
    const val = obj?.[key];
    if (Array.isArray(val) && val.length > 0) return val;
  }
  return [];
}

// src/config/videoTabsConfig.js:421-427
function pickStringAsArray(obj, ...keys) {
  for (const key of keys) {
    const val = obj?.[key];
    if (typeof val === 'string' && val.trim()) return [val.trim()];
  }
  return [];
}
```

שני מקומות קונקרטיים בהם זה גרם לאובדן-תוכן שקט, **ושניהם תוקנו בקוד מאז** (מקור התיקון לא תועד ב-ledger עד סבב 2026-09-11 זה — נוספה שורה מתקנת):

| שדה על `video` | קורא אותו | הבעיה שהיתה (עד 2026-09-10) | מה הקוד עושה כעת | file:line |
|---|---|---|---|---|
| `mainLesson` | case `'summary'` | `pickStringAsArray(video,'shortSummary','fullSummary','gemSummary','summary','mainLesson')` החזירה **רק** את הראשון הלא-ריק; `shortSummary` תמיד מלא ⟸ `mainLesson` לעולם לא נבדק. | ✅ קריאת `pickStringAsArray(video,'mainLesson')` נפרדת, נוספת בכל מקרה — מוצג כעת כפריט נוסף בטאב 1. | `videoTabsConfig.js:689` |
| `fullSummary` | case `'summary'` | אותה שרשרת אליאסים — `shortSummary` תמיד מלא ⟸ `fullSummary` לעולם לא נבדק. | ✅ **לא** דרך `case 'summary'` (שם עדיין אליאס-בלבד, ללא שינוי) — אלא דרך כרטיס נפרד `FullSummaryParagraphs` ("📖 סיכום מלא"), שקורא `effectiveVideo.fullSummary` ישירות, בלתי-תלוי בשרשרת ה-picker. | `FullSummaryParagraphs.jsx`, מרונדר ב-`VideoDetailPanel.jsx:11234` |
| `warnings` | case `'mistakes'` | `pickArray(video,'mistakesToAvoid','warnings','riskRules')` החזירה **רק** את הראשון הלא-ריק; `mistakesToAvoid` תמיד מלא ⟸ `warnings` לעולם לא נבדק. | ✅ שלוש קריאות `pickArray` נפרדות ל-`mistakesToAvoid`/`warnings`/`riskRules`, כל התוכן הלא-ריק ממוזג יחד לאותו סעיף "❌ טעויות נפוצות" בטאב 4. | `videoTabsConfig.js:781-786`, השורה הקריטית `:783` |

**תיקון שבוצע במסמכים (2026-09-10, נכון עדיין כהמלצת-תוכן):** `GEM-FUNDAMENTAL-INSTRUCTIONS.md` ממשיך להורות ל-GEM (א) לשלב את המסקנה המרכזית בתוך `shortSummary` עצמו (כי `shortSummary` הוא היחיד שמוצג ראשון/בולט בטאב 1), ו-(ב) לוותר על שדה `warnings` נפרד ולמזג כל תוכן-סיכון לתוך `mistakesToAvoid` — זו עדיין המלצת-תוכן טובה גם היום שהקוד מציג את `warnings` בנפרד, כי היא פשוטה יותר לכתיבה מצד ה-GEM; אך אינה עוד הכרחית-לתצוגה כמו שהייתה.

**תיקון-הקוד בוצע בפועל (2026-09-10, מתועד ב-`docs/open-items-ledger.md`'s "Recently resolved" section — "`pickArray`/`pickStringAsArray` 'first-non-empty-wins' merge bug fixed in code" — לא ב"Open items"; זו הסיבה שקריאה חלקית של הledger פספסה את התיעוד באיטרציה קודמת של המסמך הזה):** ה-`pickArray`/`pickStringAsArray` הרלוונטיים הוחלפו בגרסת-מיזוג (concat כל המועמדים הלא-ריקים, לא "ראשון מנצח") בדיוק במקומות שבהם רצוי תוכן-מצטבר — שרשרת האליאסים המקורית (`shortSummary`/`fullSummary`/`gemSummary`/`summary`) נותרה "ראשון מנצח" בכוונה (הם אכן שמות-נרדפים לאותו תוכן), ורק `mainLesson`/`warnings` (שאינם נרדפים, אלא תוכן משלים) יצאו מהשרשרת למיזוג נפרד.

---

## 7. שדות שנבדקו ונמצאו **לא** רלוונטיים לנתיב הזה (לשם שלמות)

- `keyPoints`/`allPoints`/`actionItems`/`politicalSummary`/`brainHighlights` — חלק מ-`GENERIC_ANALYSIS_FIELDS` (מספיקים לשער הכניסה, סעיף 2) אך לא נדרשים לתוכן פונדמנטלי; לא הוכללו בהוראות/בדוגמה כדי לא להסיח.
- `stocksMentioned`/`tradingSetups`/`tradingRules`/`keyLevels`/`indicators`/`marketConditions`/`riskRules` — קיימים בסכימה השטוחה **הישנה** המשותפת (`getMarketSchemaExample()`, `src/ai/gemini/schemas/marketSchema.js`) אך **אף אחד מהם לא ממופה על ידי `normalizeAiAnalysisResult`** (אומת בקריאת הפונקציה המלאה) — שימוש בהם היה מבוזבז באותה מידה כמו `financialMetrics`/`valuation`. לא נכללו בהוראות.

---

## 8. סיכום פערים (מעודכן 2026-09-10)

| פער | סטטוס | הערה |
|---|---|---|
| financial-metrics לא נגיש | ✅ **נסגר 2026-09-10** | `financialMetrics` ממופה כעת (§3), מוצג בטאב 4 |
| valuation לא נגיש | ✅ **נסגר 2026-09-10** | `valuation` ממופה כעת (§3), מוצג בטאב 4 |
| APP (tab 5) לא נגיש דרך JSON שטוח | פתוח | לא טופל בקוד הסבב הזה — הוראות ה-GEM לא מנסות למלא אותו |
| `checklists`/`investment-checklist` — כפילות מבנית | ✅ **נסגר 2026-09-10** | `investmentChecklist` ממופה + גייט fallback (§4-ii) — שני הסעיפים מציגים תוכן שונה כשה-GEM ממלא את שניהם |
| אין טבלת מניות ייעודית בטאב 7 לפונדמנטלי | ✅ **נסגר חלקית 2026-09-11** (WORK-ID TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY) | `stockFundamentals` (הג'ם כותב) + `stockTechnicals` (סכימה מוגדרת, GEM טכני נפרד עדיין לא כותב) — שני סעיפי-טבלה חדשים בטאב 7, ר' §10. "חלקית" כי רק הפונדמנטלי מוזן כרגע. |
| טאב 7 מציג תוכן לימודי (frameworks/checklists/mistakes) | ✅ **תוקן 2026-09-10 — הוסר לגמרי** | הועבר לטאב 4 בעקבות כלל "טאב 7 = תוכן יומי בלבד"; חל גם על `technical-analysis`; `macro` נבדק ונמצא כבר תואם, לא נגע בו; מבזקים לא נגעו בהם |
| טאב 7 חוזר להציג מבנה מלא (דשבורד-מבזק בן 9 סעיפים) במקום empty-state כולל-אחד | **✅ הכרעת משתמש 2026-09-11 — זו ההתנהגות המבוקשת, ר' `FUNDAMENTAL-OVERVIEW.md` §7** | מבטל את השורה שלמעלה עבור טאב 7 בלבד — התוכן הלימודי (frameworks/checklists/mistakes) עדיין בטאב 4, לא חזר לטאב 7 |
| `promptTemplates`/26 מדדי KPI/4 דשבורדי-על לא נתפסים | ✅ **נסגר 2026-09-10** | `promptTemplates` שדה חדש + `financialMetrics`/`valuation` מכסים את מפת ה-KPI + `frameworks` מכסה את הדשבורדים (ר' `GEM-FUNDAMENTAL-INSTRUCTIONS.md`) |
| אין אכיפת-צפיפות על ה-JSON שנדבק (GEM עלול לסכם במקום למנות) | ✅ **נסגר חלקית 2026-09-10** | `validateGemsJsonValue` מחזירה כעת `densityWarnings` (לא-חוסם) כשה-GEM מחזיר שדה עם פריט יחיד בלבד; באנר מוצג למשתמש בדיאלוג ההדבקה |
| דוגמת ה-GEM (`GEM-FUNDAMENTAL-EXAMPLE.json`) משתמשת בתיאורי-חברה מוכללים ("חברת שבבים מובילה") ולא בטיקרים/שמות חברה אמיתיים | `architect-reviewer`, סבב-ביקורת שני | פרשנות סבירה של "אל תמציא תוכן" (אין תמלול אמיתי לדוגמה) — אך המשמעות בפועל: הדוגמה **לא** בודקת את מסלול stock-linkification/Finviz, גם אם הוא היה חלק מהציפייה המקורית ל-"2-3 שורות מניה". אם רוצים לוודא שהאפליקציה מקשרת טיקרים אמיתיים מתוך `frameworks`/`checklists` בפועל, נדרש סבב-בדיקה נפרד עם דוגמה שכוללת טיקר אמיתי (למשל `NVDA`) — לא בוצע כאן. |
| `mainLesson` נכתב על `video` אך לעולם לא מוצג בטאב 1 כאשר `shortSummary` גם קיים | ✅ **נסגר בקוד 2026-09-10, ledger "Recently resolved"** | היה: `pickStringAsArray` "ראשון-לא-ריק-מנצח" (`videoTabsConfig.js:689`). כעת: נבדק בנפרד, מוצג תמיד. ר' §6.1 המתוקן. |
| `fullSummary` נכתב על `video` אך לעולם לא מוצג בטאב 1 כאשר `shortSummary` גם קיים | ✅ **נסגר בקוד — שורת ledger 2026-09-11 ("Key-points card restyle")** | היה: `pickStringAsArray` "ראשון-לא-ריק-מנצח" (`videoTabsConfig.js:689`, ללא שינוי בשרשרת הזו עצמה). כעת מוצג דרך כרטיס `FullSummaryParagraphs` נפרד, בלתי-תלוי בשרשרת. ר' §6.1 המתוקן. |
| `warnings` נכתב על `video` אך לעולם לא מוצג בטאב 7 (**היום: טאב 4**) כאשר `mistakesToAvoid` גם קיים | ✅ **נסגר בקוד 2026-09-10, ledger "Recently resolved"** | היה: `pickArray` "ראשון-לא-ריק-מנצח" (`videoTabsConfig.js:783`). כעת: שלוש קריאות נפרדות, ממוזגות. ר' §6.1 המתוקן. |
| פריטי הלמידה (frameworks/checklists/mistakesToAvoid/financialMetrics/valuation/investmentChecklist/promptTemplates/usefulKnowledge) הם מחרוזות שטוחות — חותמת ה"מקור: HH:MM:SS" אינה קישור פעיל | ✅ **נסגר 2026-09-10, ללא שינוי קוד** | ר' §9 למטה — כל 8 השדות יכולים כעת לשאת פריט-אובייקט עם `estimatedStartSeconds`/`sourceQuote`, ומקבלים קישור-זמן פעיל דרך תשתית קיימת (`normalizeTimedNarrativeItem`). אופציונלי — GEM יכול עדיין להחזיר מחרוזת פשוטה כשלא בטוח בזמן. |

---

## 9. `universalTabs` — נבדק כישימות, נמצא לא-שמיש; נמצא פתרון חלופי ללא שינוי קוד (2026-09-10)

### 9.1 השאלה שנבדקה

האם ניתן להעתיק את התבנית שמבזק בוקר/ערב משתמש בה (JSON עם `universalTabs`, שדות-זמן לכל פריט, כללי-אימות מחמירים) לג'ם הפונדמנטלי, כדי לקבל עושר-חילוץ דומה?

### 9.2 מסקנה: לא — 2 סיבות חוסמות, מאומתות בקוד

**סיבה א' — חטיפת נתיב-קליטה.** `VideoDetailPanel.jsx`'s `_applyParsedGems` (שורה 6530) בודק לפי סדר: (1) `contentType==='marketBrief'` (שורה 6540) → נתיב מבזק; (2) `universalTabs.appBuilder` קיים (שורה 6599) → נתיב App Builder; (3) **`contentType==='market' && universalTabs` (object)** (שורה 6627, כותרת ההערה בקוד עצמה: `"Macro / Universal Market GEM — contentType: 'market' with universalTabs. Routes through marketBriefData so all universalTabs.* tabs render correctly."`) → מאחסן ל-`marketBriefData`; (4) אחרת → `normalizeAiAnalysisResult(parsed)` (שורה 6672), ממזג ישירות על `video`.

כל payload עם `contentType:"market"`+`universalTabs` נופל תמיד לנתיב (3). ו-`SpecializedContentRenderer.jsx`'s `isMacroContent` (`const isMacroContent = slug === 'macro' || (!!marketBriefData?.universalTabs && marketBriefData?.contentType === 'market')`) **לא בודק slug בכלל** כשהתנאי השני מתקיים — כלומר וידאו עם `normalizedSubCategory === 'fundamental-analysis'` שנשא `marketBriefData` כזה **היה מוצג כדשבורד מאקרו** (`<MacroGemDashboard>`) במקום ה-empty-state הפונדמנטלי שנקבע היום — סותר ישירות את כלל "טאב 7 = תוכן יומי בלבד".

**סיבה ב' — איפוס כל שדות התוכן.** נתיב (3) לעיל **קורא רק** ל-`completeGemsImport(pending, { marketBriefData, marketBriefSavedAt })` (שורה 6647-6651) — **הוא לעולם לא קורא ל-`normalizeAiAnalysisResult`**. המשמעות: `frameworks`/`checklists`/`mistakesToAvoid`/`financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates`/`usefulKnowledge` לא היו נכתבים על `video` בכלל בנתיב הזה. גם קריאה מ-`marketBriefData` ישירות לא הייתה מצילה את רובם: מתוך 6 ה-`case`-ים הרלוונטיים ב-`extractVideoTabItems`, רק `financial-metrics` קורא `marketBriefData` (דרך `resolveSpecialized()`, `videoTabsConfig.js:350-356`) — `valuation`/`analysis-frameworks`/`investment-checklist`/`checklists`/`mistakes` קוראים **רק** מ-`video`/`video.analysis`, לעולם לא מ-`marketBriefData`. גם `canonicalizeGemsPayloadForPersistence` (`gemsJsonRepair.js:183-208`) לא היה עוזר — רשימות השדות שהוא מקפל ל-`universalTabs.specialized` (`CANONICAL_SPECIALIZED_ROOT_FIELDS`, שורה 103) לא כוללות אף אחד משמות השדות שלנו.

**לכן: לא בוצע שום שינוי ל-`contentType`, לא נוסף `universalTabs`, לא נגעתי בקוד הניתוב.**

### 9.3 הפתרון בפועל — תשתית קיימת, לא universalTabs

בדיקת השאלה "האם התשתית של per-item timing תפעל" הובילה לממצא נפרד וחיובי: `normalizeLearningArray`/`normalizeLearningItem` (`src/services/videoAnalytics.js:619-673`) — **הפונקציה שכל 8 השדות שלנו כבר עוברים דרכה, ללא קשר ל-universalTabs** — קוראת ב-`normalizeLearningItem` (שורה 623) ל-`normalizeTimedNarrativeItem(value)` (`src/ai/gemini/validators/timedNarrative.js:39-74`), ואם הפריט הוא אובייקט עם `timestampSeconds`/`estimatedStartSeconds` תקין, **מחזירה אותו כאובייקט** (שורה 624-626: `if (timedValue && typeof timedValue === 'object') return { ...timedValue, text: cleanAtomicText(timedValue.text) };`) — לא קורסת למחרוזת. `LearningTabContent.jsx`'s `ItemRow` (שורה 98-104) מעביר את הפריט הגולמי (`sourceItem`) ל-`<StaticVideoTimestampLink item={sourceItem} .../>` בנפרד מהטקסט המפורמט — כך ש-`resolveStaticVideoTimestamp` (`staticVideoTimestamp.js:26-40`, מזהה `timestampSeconds`/`estimatedStartSeconds`/`startSeconds`/`exactStartSeconds`) מקבל את האובייקט המקורי ומפעיל קישור אמיתי. פריט ללא שדה-זמן (רק `text`) נופל בחזרה למחרוזת פשוטה (`normalizeLearningItem` שורה 656: `value.text` הוא אחד המפתחות ב-"single well-known keys" fallback) — **לא רגרסיה**, אותה התנהגות כמו היום.

**אומת חי**: הדוגמה `GEM-FUNDAMENTAL-EXAMPLE.json` עודכנה עם כמה פריטי-אובייקט (`frameworks`/`mistakesToAvoid`), נדבקה דרך דיאלוג "הדבק JSON מ-GEMS" האמיתי, ואייקון קישור-הזמן הופיע ופעל על הפריטים האלה בטאב 4 — פריטים ללא שדה-זמן המשיכו להציג כרגיל, ללא רגרסיה.

### 9.4 מה קיים בקוד לצורך "evidence gate" ולמה הוא לא רלוונטי לנתיב הזה

`src/lib/timedNarrativeEvidenceGate.js`'s `applyTimedNarrativeEvidenceGateToAnalysis` (שורה 138) מאמת ציטוט-מקור מול תמלול אמיתי ומוחקת שדות-זמן לא-מאומתים. גריפ מלא של קריאות ל-פונקציה הזו מצא **רק** 4 מקומות: `vite.config.js:529,586,1083` ו-`backend/analyze-video.function.js:405` — כולם בצינור הניתוח **האוטומטי** (הכפתור "התחל ניתוח AI" בתוך האפליקציה, לא הדבקת GEM JSON). **הנתיב הידני (`_applyParsedGems`/`normalizeAiAnalysisResult`) לא קורא לפונקציה הזו בשום מקום** — מאומת בגריפ. משמעות: זמן שה-GEM (מחוץ לאפליקציה) יכתוב, לא עובר שום בדיקת-אמינות אוטומטית כאן — ההוראות (`GEM-FUNDAMENTAL-INSTRUCTIONS.md`) מדגישות "עדיף בלי זמן מאשר זמן שגוי" בהתאם.

---

## 10. `stockFundamentals` / `stockTechnicals` — טבלאות תוכן ייעודי בטאב 7 (2026-09-11, WORK-ID TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY)

### 10.1 `stockFundamentals` — הג'ם הזה כן כותב אותו

צורת הפריט, הרחבה מלאה בהוראות (`GEM-FUNDAMENTAL-INSTRUCTIONS.md`'s סעיף `stockFundamentals`), נורמליזציה ב-`normalizeStockDataPointItem(value, 'metric')` (`videoAnalytics.js`):

```js
{ ticker, company, metric, value, interpretation, asOf, sourceQuote, estimatedStartSeconds, timestampKind }
```

חובה: `ticker` (מנורמל ל-uppercase+trim), `metric` (string לא-ריק), `value` (כל טיפוס, רק נבדק שאינו ריק/undefined/null). פריט חסר אחד מאלה מוחזר `null` ומסונן — **אין שגיאת-parse, אין אזהרה, פשוט לא מופיע**. שדות אחרים (`company`/`interpretation`/`asOf`/`sourceQuote`) אופציונליים, trim בלבד. `estimatedStartSeconds`/`timestampKind` — אותה לוגיקה בדיוק כמו `normalizeTimedNarrativeItem` (שדה-מספר תקין + `timestampKind` מ-`{exact,estimated}`, ברירת מחדל `estimated` אם יש `estimatedStartSeconds` בלי `timestampKind`).

### 10.2 `stockTechnicals` — **סכימה בלבד כאן, אין הוראות-GEM עדיין**

**⚠️ מחוץ להיקף המסמך הזה:** ההוראות לג'ם שיכתוב את השדה הזה בפועל שייכות ל-WORK-ID נפרד, `TRADINGBRAIN-GEM-TECHNICAL-SCHEMA` — **טרם נכתבו** (ר' `docs/gems/GEM-TECHNICAL-PREP-NOTES.md`, הכנה בלבד). הקוד (normalizer + case + רינדור) כן קיים ומוכן לקבל את השדה ברגע שייכתב, אך שום GEM לא פולט אותו כיום — הסעיף "📐 נתונים טכניים" בטאב 7 יציג empty-state עד אז.

צורת הפריט (זהה במבנה ל-`stockFundamentals`, רק `metric`→`levelType`), נורמליזציה ב-`normalizeStockDataPointItem(value, 'levelType')`:

```js
{ ticker, company, levelType, value, interpretation, asOf, sourceQuote, estimatedStartSeconds, timestampKind }
```

חובה: `ticker`, `levelType` (string לא-ריק — ערכים מוצעים: תמיכה / התנגדות / ממוצע נע / פער מחיר / קו מגמה / נפח, **לא נאכף בקוד**, הנחיה בלבד לג'ם העתידי), `value`.

### 10.3 מיפוי שדה→תצוגה (שני השדות, אותה שרשרת בדיוק)

| שלב | `stockFundamentals` | `stockTechnicals` |
|---|---|---|
| Normalize | `normalizeStockFundamentalsArray` → `video.stockFundamentals` | `normalizeStockTechnicalsArray` → `video.stockTechnicals` |
| Extract (tab-7) | `extractVideoTabItems(video, 'stock-fundamentals', marketBriefData)` — `videoTabsConfig.js`, אותו pattern כמו `financial-metrics` (`resolveSpecialized` קודם, נופל ל-`video`/`video.analysis`) | `extractVideoTabItems(video, 'stock-technicals', marketBriefData)` |
| Bulk-section (בחר הכל) | `buildMorningBriefBulkSections` (`morningBriefBulkSections.js`) — פריט `{key:'stock-fundamentals', label:'📊 נתונים פונדמנטליים', ...}`, מתווסף **רק אם** יש לפחות שורה אחת (כמו כל שאר הסעיפים בפונקציה הזו) | זהה, `key:'stock-technicals'`, `label:'📐 נתונים טכניים'` |
| Render | `<StockFundamentalsSection>` (`MorningBriefPanels.jsx`) — עמודות: סימול / מדד / ערך / משמעות / תאריך | `<StockTechnicalsSection>` — עמודות: סימול / סוג רמה / ערך / משמעות / תאריך |
| Gate | שני הסעיפים מותנים יחד ב-`showStockDataSections` (prop בוליאני על `MorningBriefDashboard`, ברירת מחדל `false`) — ר' §10.4 |

### 10.4 ה-gate — שני הסעיפים לעולם לא מופיעים במבזק בוקר/ערב

`MorningBriefDashboard.jsx` הוא הרכיב המשותף היחיד בין 4 ה-slugs (`fundamental-analysis`/`technical-analysis`/`morning-brief`/`evening-brief`, ר' `AUDIT-TRADINGBRAIN-STOCK-FUNDAMENTAL-HISTORY.md` Step 12). ה-prop `showStockDataSections` (ברירת מחדל `false`) עוטף את שני הסעיפים החדשים ב-JSX (`{showStockDataSections ? <>...</> : null}`) — **רק** `SpecializedContentRenderer.jsx`'s `fundamental-analysis`/`technical-analysis` branch (שורה ~148) מעביר `showStockDataSections` (בוליאני `true`, ללא ערך = `true` ב-JSX). ה-branch של `morning-brief`/`evening-brief` (שורה ~165) ו-`weekly-brief`/`earnings-brief` (שאינם קוראים ל-`MorningBriefDashboard` בכלל, יש להם רינדור עצמאי) לא נוגעים ולא מעבירים את ה-prop — כלומר גם אם `video.stockFundamentals` היה איכשהו מתמלא על וידאו-מבזק (לא קורה בפועל, אף GEM-מבזק לא כותב את השדה הזה), הסעיף **לא היה מרונדר בכלל**, לא רק ריק — `{false ? ... : null}` לא מכניס אף DOM node, לא SectionCard ריק.

---

## 11. הכנה ל-GEM הטכני (מחר) — ראו מסמך נפרד

**עדכון (2026-09-11):** נכתב מסמך הכנה נפרד, `docs/gems/GEM-TECHNICAL-PREP-NOTES.md`, לקראת בניית ה-GEM הטכני על אותו עיקרון. הוא מתעד מה ניתן לשימוש חוזר כמו-שהוא, מה ספציפי-לפונדמנטלי וצריך תחליף, אילו שדות (`indicators`/`setups`/`patterns`) הנתיב הטכני כבר קורא היום עם file:line, ותיקון-דיוק ל-§7 למעלה (`indicators` **כן** ממופה ע"י `normalizeAiAnalysisResult`, בניגוד למה שכתוב שם). **לא בוצע שום שינוי קוד או כתיבת הוראות ל-GEM הטכני** — מסמך תיעוד-הכנה בלבד.
```

**Note on internal line-number drift:** the sub-agent that produced §2.6 below re-verified this doc's citations directly against live code at HEAD `be1a70d` and found the underlying *logic* correct throughout, but line numbers drifted by roughly 2-55 lines in `videoAnalytics.js` (consistent with this doc's own repeated warnings that the working tree was uncommitted/modified at various points in its writing history). Treat the line numbers above as approximate; the mapping logic they describe was independently re-confirmed.

### 2.5 Example JSON — verbatim

Source: `docs/gems/GEM-FUNDAMENTAL-EXAMPLE.json`, reproduced in full, byte-for-byte (128 lines). Top-level keys: `contentType`, `shortSummary`, `fullSummary`, `mainLesson`, `chapters[]`, `keyInsights[]`, `usefulKnowledge[]`, `tags[]`, `frameworks[]` (mixed string/timed-object items), `financialMetrics[]`, `valuation[]`, `checklists[]`, `investmentChecklist[]`, `promptTemplates[]`, `mistakesToAvoid[]` (mixed string/timed-object items), `stockFundamentals[]` (three ticker rows: AAPL/NVDA/GOOGL, all with `sourceQuote`+`estimatedStartSeconds`+`timestampKind:"estimated"`).

**Documented gap in the example itself** (flagged by the project's own `architect-reviewer` in a prior audit round, `GEM-FUNDAMENTAL-SCHEMA.md:206`): several `frameworks`/`checklists` items use generic company descriptions ("חברת שבבים מובילה") rather than real tickers, so the example never exercises stock-linkification/Finviz-mapping on those fields — only `stockFundamentals` uses real tickers.

```json
{
  "contentType": "market",
  "shortSummary": "ניתוח פונדמנטלי של עונת הדוחות הנוכחית בסקטור השבבים, עם דגש על מכפילי רווח ותזרים מזומנים פנוי. המסקנה המרכזית: מכפיל רווח בודד אינו מספיק כדי לשפוט חברה — יש לבחון אותו יחד עם קצב הצמיחה ואיכות תזרים המזומנים, לא כמספר מבודד.",
  "fullSummary": "הסרטון סוקר דוחות רבעוניים בסקטור השבבים, משווה מכפילי רווח לממוצע הענף, ובוחן איכות תזרים מזומנים פנוי כאינדיקטור מרכזי לאיתנות פיננסית לפני קבלת החלטת השקעה. מודגש שוב ושוב שמכפיל בודד אינו מספיק ללא הקשר של קצב צמיחה ואיכות רווח.",
  "mainLesson": "מכפיל רווח בודד לא מספיק כדי לשפוט חברה — יש לבחון אותו יחד עם קצב הצמיחה ואיכות תזרים המזומנים, לא כמספר מבודד.",
  "chapters": [
    { "title": "דוח רבעוני של חברת שבבים מובילה", "startSeconds": 0, "endSeconds": 240, "summary": "סקירת הכנסות, רווח תפעולי ותחזית הנהלה לרבעון הבא." },
    { "title": "מכפיל רווח מול ממוצע סקטור השבבים", "startSeconds": 240, "endSeconds": 480, "summary": "השוואת מכפיל הרווח של החברה לממוצע הענף וניתוח הפער." },
    { "title": "תזרים מזומנים פנוי של יצרנית מכשור אלקטרוני", "startSeconds": 480, "endSeconds": 720, "summary": "בחינת יכולת החברה לממן דיבידנד ורכישה עצמית מתוך תזרים תפעולי." }
  ],
  "keyInsights": [
    "צמיחת הכנסות לבדה אינה מעידה על איתנות — יש לבחון אותה יחד עם מגמת שולי הרווח התפעולי לאורך מספר רבעונים ולא רבעון בודד.",
    "ירידה במכפיל רווח יכולה לשקף גם האטה בצמיחה וגם תמחור-חסר אמיתי — יש להבחין בין שני התרחישים לפני מסקנה."
  ],
  "usefulKnowledge": [
    "תזרים מזומנים פנוי מחושב כתזרים מזומנים תפעולי בניכוי השקעות הוניות נדרשות.",
    "מכפיל רווח עתידי מבוסס על תחזית רווח של אנליסטים ולכן רגיש לשינויי הערכה, בשונה ממכפיל רווח היסטורי המבוסס על נתונים מדווחים."
  ],
  "tags": [
    "עונת הדוחות",
    "מכפילי שווי",
    "תזרים מזומנים פנוי",
    "סקטור השבבים"
  ],
  "frameworks": [
    {
      "text": "מושג: דשבורד Foundation (בסיס) · הגדרה קצרה: מבט ראשון ומהיר על חברה — הכנסות, מרווחי רווח ותזרים מזומנים פנוי, רבעוני ושנתי. · מתי זה תקף: בתחילת מחקר על חברה חדשה, לפני צלילה למדדים מפורטים. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: ריכוז Revenue/Gross Margin/Operating Margin/FCF בטבלה אחת לכמה רבעונים. · מקור: 09:40",
      "estimatedStartSeconds": 580,
      "timestampKind": "estimated",
      "sourceQuote": "הדשבורד הראשון הוא הפאונדיישן — הכנסות, מרווחי רווח ותזרים מזומנים"
    },
    "מושג: דשבורד Engine / Momentum (מנוע שינוי) · הגדרה קצרה: מדידת קצב השינוי בביצועי החברה, לא רק הרמה המוחלטת — קצב שינוי EPS, הכנסות מול יעדים. · מתי זה תקף: כשרוצים לדעת אם החברה מאיצה או מאטה, לא רק אם היא גדולה או קטנה. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: שינוי אחוזי ב-EPS ובהכנסות בין רבעונים עוקבים. · מקור: 10:05",
    "מושג: דשבורד Valuation History (היסטוריית תמחור) · הגדרה קצרה: השוואת P/E, P/S, EV/EBITDA של החברה להיסטוריה שלה עצמה על פני 5-10 שנים, לא רק למתחרים. · מתי זה תקף: לבדוק אם החברה זולה או יקרה ביחס לעצמה היום מול העבר. · מתי זה לא תקף: לא אומר לבד אם המחיר טוב לקנייה — רק הקשר היסטורי. · איך מודדים או איפה רואים את זה: גרף מכפילים על ציר זמן של 5-10 שנים. · מקור: 10:20",
    "מושג: דשבורד Capital Allocation (הקצאת הון) · הגדרה קצרה: האם ההנהלה משתמשת בהון בצורה יעילה — הכנסה פר עובד, היקף רכישה עצמית, תשואה על ההון המושקע. · מתי זה תקף: לבדוק איכות ניהול לאורך זמן, לא רק ביצועים נקודתיים. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: Revenue per Employee, Share Buybacks, ROIC. · מקור: 10:35",
    "מושג: מגמת שולי תזרים מזומנים פנוי · הגדרה קצרה: השוואת אחוז תזרים המזומנים החופשי מההכנסות לאורך שמונה רבעונים ביחס לחציון הסקטור עבור חברת NVIDIA · מתי זה תקף: כאשר נדרש ניתוח מגמת יצירת מזומנים של החברה מול מתחרותיה בענף השבבים · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: חלוקת תזרים המזומנים החופשי בהכנסות והשוואה מול מדדי הסקטור · מקור: 09:20",
    "מושג: השוואת מתחרות בסקטור השבבים · הגדרה קצרה: הפקת ניתוח רוחבי באמצעות בינה מלאכותית להשוואת נתוני פעילות בין NVIDIA לבין AMD לבין Broadcom ולבין Intel · מתי זה תקף: בעת ביצוע הערכת שווי יחסית בין חברות מובילות באותו תחום פעילות · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: הרצת שאילתה אחודה המרכזת מדדי תזרים והכנסות לכלל החברות · מקור: 11:20"
  ],
  "financialMetrics": [
    "מושג: Revenue Growth (קצב צמיחת הכנסות, 8 רבעונים) · הגדרה קצרה: השוואת קצב גידול ההכנסות על פני 8 רבעונים אחרונים כדי לזהות תאוצה או האטה עסקית. · מתי זה תקף: בכל ניתוח פונדמנטלי ראשוני לחברה. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: שינוי אחוזי בהכנסות רבעון מול רבעון מקביל אשתקד, 8 רבעונים ברצף. · מקור: 05:20",
    "מושג: Gross Margin (שולי רווח גולמי) · הגדרה קצרה: אחוז הרווח הגולמי מתוך ההכנסות — מודד יעילות תמחור וייצור. · מתי זה תקף: להשוואת יעילות תפעולית לאורך זמן ומול מתחרים. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: רווח גולמי חלקי הכנסות מתוך דוח רווח והפסד. · מקור: 05:35",
    "מושג: Operating Margin (שולי רווח תפעולי) · הגדרה קצרה: מודד האם העסק הופך יעיל יותר או פחות יעיל לאורך זמן. · מתי זה תקף: מעקב אחר יעילות תפעולית מרבעון לרבעון. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: רווח תפעולי חלקי הכנסות. · מקור: 05:50",
    "מושג: Net Margin (שולי רווח נקי) · הגדרה קצרה: השורה התחתונה — הרווח הנקי ביחס להכנסות אחרי כל ההוצאות. · מתי זה תקף: להבין רווחיות סופית אמיתית של העסק. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: רווח נקי חלקי הכנסות. · מקור: 06:00",
    "מושג: EPS (רווח למניה) · הגדרה קצרה: מעקב אחר מגמת ה-EPS לאורך זמן כדי לראות אם התוצאה נובעת מרווחיות אמיתית או רק מצמצום מספר המניות. · מתי זה תקף: בכל בדיקת רווחיות פר-מניה, תמיד בהקשר של רבעונים קודמים. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: רווח נקי חלקי מספר מניות מדוללות, לאורך כמה רבעונים. · מקור: 06:10",
    "מושג: EBITDA · הגדרה קצרה: רווח לפני ריבית, מס, פחת והפחתות — מדד תפעולי הנקי ממבנה הון וממדיניות חשבונאית. · מתי זה תקף: להשוואת רווחיות תפעולית בין חברות עם מבני הון שונים. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: רווח תפעולי בתוספת פחת והפחתות. · מקור: 06:20",
    "מושג: Operating Cash Flow (תזרים מזומנים תפעולי) · הגדרה קצרה: המזומן שנוצר בפועל מפעילות שוטפת של העסק — קשה מאוד לבצע עליו מניפולציה חשבונאית. · מתי זה תקף: לבדוק את איכות הרווח מול המזומן שבאמת נכנס. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: דוח תזרים מזומנים, סעיף פעילות שוטפת. · מקור: 07:00",
    "מושג: Free Cash Flow (FCF, תזרים מזומנים חופשי) · הגדרה קצרה: כמה מזומן החברה באמת שומרת אחרי כל ההשקעות ההוניות הנדרשות. · מתי זה תקף: בכל בדיקת יכולת מימון דיבידנד/רכישה עצמית/צמיחה עתידית. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: תזרים תפעולי פחות הוצאות הוניות. · מקור: 07:15",
    "מושג: FCF Margin (שולי תזרים מזומנים חופשי) · הגדרה קצרה: אחוז תזרים המזומנים החופשי מתוך ההכנסות. · מתי זה תקף: להשוואת איכות המרת הכנסות למזומן אמיתי בין חברות. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: FCF חלקי הכנסות. · מקור: 07:25",
    "מושג: FCF Yield (תשואת תזרים מזומנים חופשי) · הגדרה קצרה: תזרים מזומנים חופשי ביחס לשווי השוק של החברה — מעין 'מכפיל הפוך' מבוסס מזומן. · מתי זה תקף: להשוואת תמחור חברות על בסיס יצירת מזומן ולא רק רווח חשבונאי. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: FCF חלקי שווי שוק (Market Cap). · מקור: 07:35",
    "מושג: Debt-to-Equity (יחס חוב להון) · הגדרה קצרה: יחס בין סך החוב להון העצמי — מודד מינוף פיננסי. · מתי זה תקף: לפני כל החלטת השקעה בחברה עם מינוף משמעותי. · מתי זה לא תקף: לחברות פיננסיות עם מבנה הון שונה מטבעו. · איך מודדים או איפה רואים את זה: סך התחייבויות חלקי הון עצמי מהמאזן. · מקור: 08:00",
    "מושג: Net Cash vs Debt (מזומן נטו מול חוב) · הגדרה קצרה: האם לחברה יש יותר מזומן מחוב, או להפך — אינדיקציה ישירה לגמישות פיננסית. · מתי זה תקף: בבדיקת עמידות החברה במשברי נזילות. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: מזומן ושווי מזומנים פחות סך חוב, מתוך המאזן. · מקור: 08:10",
    "מושג: Current Ratio (יחס שוטף) · הגדרה קצרה: יכולת החברה לכסות התחייבויות שוטפות מנכסים שוטפים. · מתי זה תקף: לבדיקת נזילות לטווח קצר. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: נכסים שוטפים חלקי התחייבויות שוטפות. · מקור: 08:20",
    "מושג: ROE (תשואה על ההון העצמי) · הגדרה קצרה: כמה רווח החברה מייצרת ביחס להון העצמי שהושקע בה. · מתי זה תקף: להשוואת יעילות ניצול הון עצמי בין חברות. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: רווח נקי חלקי הון עצמי. · מקור: 08:30",
    "מושג: ROIC (תשואה על ההון המושקע) · הגדרה קצרה: תשואה על כלל ההון המושקע בעסק (הון עצמי + חוב) — מדד רחב יותר מ-ROE. · מתי זה תקף: להשוואת יעילות שימוש בכל מקורות המימון, לא רק הון עצמי. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: רווח תפעולי אחרי מס חלקי סך ההון המושקע. · מקור: 08:40"
  ],
  "valuation": [
    "מושג: מכפיל רווח (P/E) · הגדרה קצרה: יחס בין מחיר המניה לרווח למניה. · מתי זה תקף: להשוואת חברות דומות באותו סקטור עם רווחיות יציבה. · מתי זה לא תקף: לחברות הפסדיות או עם רווח חד-פעמי חריג. · איך מודדים או איפה רואים את זה: מחיר מניה חלקי רווח למניה של 12 החודשים האחרונים. · מקור: 00:04:10",
    "מושג: מכפיל רווח עתידי (Forward P/E) · הגדרה קצרה: מכפיל המבוסס על תחזית רווח עתידית ולא על רווח היסטורי. · מתי זה תקף: כשרוצים לבחון ציפיות שוק לצמיחה עתידית. · מתי זה לא תקף: כשתחזיות האנליסטים עצמן לא אמינות או סותרות זו את זו. · איך מודדים או איפה רואים את זה: מחיר מניה חלקי רווח חזוי ל-12 החודשים הקרובים. · מקור: 00:06:20",
    "מושג: P/S (מכפיל מכירות) · הגדרה קצרה: יחס בין שווי החברה להכנסותיה — שימושי במיוחד לחברות צמיחה ללא רווח יציב. · מתי זה תקף: חשוב להבין איך חברות צמיחה יצליחו להגיע לשווי הגיוני. · מתי זה לא תקף: פחות רלוונטי לחברות בוגרות עם רווחיות יציבה. · איך מודדים או איפה רואים את זה: שווי שוק חלקי הכנסות שנתיות. · מקור: 08:55",
    "מושג: EV/EBITDA · הגדרה קצרה: יחס בין ערך המיזם (Enterprise Value) ל-EBITDA — מנטרל הבדלי מבנה הון בין חברות. · מתי זה תקף: להשוואת חברות עם רמות מינוף שונות. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: (שווי שוק + חוב נטו) חלקי EBITDA. · מקור: 09:00",
    "מושג: PEG Ratio · הגדרה קצרה: מכפיל רווח מנורמל לפי קצב הצמיחה — מי שמדברת עליו הרבה בהקשר קצב צמיחה גבוה היא פלנטיר וסרויסנאו ודומותיהן. · מתי זה תקף: להשוואת חברות עם קצבי צמיחה שונים באמצעות מספר אחד. · מתי זה לא תקף: כשקצב הצמיחה עצמו לא יציב או לא צפוי. · איך מודדים או איפה רואים את זה: מכפיל P/E חלקי קצב צמיחת הרווח השנתי הצפוי. · מקור: 09:10",
    "מושג: Price-to-Book (מכפיל הון) · הגדרה קצרה: יחס בין מחיר המניה להון העצמי למניה. · מתי זה תקף: רלוונטי במיוחד לחברות פיננסיות ותעשייתיות עם נכסים מוחשיים משמעותיים. · מתי זה לא תקף: פחות רלוונטי לחברות טכנולוגיה מבוססות-נכסים-בלתי-מוחשיים. · איך מודדים או איפה רואים את זה: מחיר מניה חלקי הון עצמי למניה. · מקור: 09:30"
  ],
  "checklists": [
    "מושג: יחס חוב להון · הגדרה קצרה: יחס בין סך החוב להון העצמי של החברה. · מתי זה תקף: לפני כל החלטת השקעה בחברה עם מינוף משמעותי. · מתי זה לא תקף: לחברות פיננסיות עם מבנה הון שונה מטבעו. · איך מודדים או איפה רואים את זה: סך התחייבויות חלקי הון עצמי מהמאזן. · מקור: 00:10:05.",
    "מושג: עקביות תזרים מזומנים פנוי · הגדרה קצרה: בדיקת יציבות תזרים המזומנים הפנוי על פני כמה רבעונים, לא רבעון בודד. · מתי זה תקף: כשמעריכים איתנות פיננסית ארוכת-טווח. · מתי זה לא תקף: ברבעון עם השקעת הון חד-פעמית גדולה. · איך מודדים או איפה רואים את זה: השוואת תזרים מזומנים פנוי בין 3-4 הרבעונים האחרונים. · מקור: 00:09:15.",
    "מושג: שולי רווח תפעולי מול שנה קודמת · הגדרה קצרה: השוואת שולי הרווח התפעולי לאותו רבעון אשתקד. · מתי זה תקף: לבדוק אם שיפור או הרעה ברווחיות הוא מגמתי או עונתי. · מתי זה לא תקף: כשיש שינוי חד-פעמי בהוצאות תפעוליות. · איך מודדים או איפה רואים את זה: רווח תפעולי חלקי הכנסות, השוואה בין רבעונים מקבילים. · מקור: 00:03:40."
  ],
  "investmentChecklist": [
    "מושג: מעקב אחר שיחות ועידה (Earnings Call Highlights) · הגדרה קצרה: קריאה או האזנה לתמלול שיחת המשקיעים הרבעונית ולהיילייטים שלה, לא רק לדוחות היבשים. · מתי זה תקף: בכל בדיקה רבעונית לפני החלטת השקעה. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: תמלול והיילייטים של שיחת המשקיעים, זמינים בכלים כמו Perplexity Finance תחת Earnings. · מקור: 12:10",
    "מושג: קונצנזוס אנליסטים (Analyst Consensus) · הגדרה קצרה: מה האנליסטים חושבים על החברה ולאן הם מכוונים את התחזיות שלהם. · מתי זה תקף: כדי להבין ציפיות שוק לפני ואחרי דיווח תוצאות. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: עמוד קונצנזוס אנליסטים בכלי מחקר פיננסי. · מקור: 12:25",
    "מושג: Earnings Revisions (עדכוני תחזית רווח) · הגדרה קצרה: האם אנליסטים מעלים או מורידים את תחזיות הרווח שלהם לחברה לאורך זמן. · מתי זה תקף: אינדיקציה מוקדמת לשינוי סנטימנט לפני שהמחיר בהכרח זז. · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: מגמת שינוי תחזיות רווח לאורך זמן בכלי מחקר. · מקור: 12:35",
    "מושג: רכישות עצמיות (Share Buybacks) · הגדרה קצרה: האם ההנהלה קונה בחזרה מניות של החברה, ובאיזה היקף — אינדיקציה לאמון ההנהלה ולהקצאת הון. · מתי זה תקף: כחלק מבדיקת הקצאת הון (דשבורד Capital Allocation). · מתי זה לא תקף: - · איך מודדים או איפה רואים את זה: היקף רכישה עצמית מדווח בדוחות תזרים/הון. · מקור: 12:45",
    "מושג: עסקאות בעלי עניין (Insider Transactions) · הגדרה קצרה: מי בהנהלה קונה ומי מוכר מניות של החברה שלו עצמו. · מתי זה תקף: כאינדיקציה נוספת (לא בלעדית) לאמון פנימי בעתיד החברה. · מתי זה לא תקף: מכירה בודדת של מנהל בודד אינה בהכרח משמעותית — יש לבחון היקף ודפוס. · איך מודדים או איפה רואים את זה: דיווחי עסקאות בעלי עניין לרשויות ניירות ערך. · מקור: 12:55"
  ],
  "promptTemplates": [
    "מטרה: לקבל קצב צמיחת הכנסות ל-8 רבעונים אחרונים לחברה נתונה · פרומפט: \"give me [TICKER] revenue last 8 quarters, compare growth rate quarter over quarter\" · מקור: 05:25",
    "מטרה: להשוות תזרים מזומנים חופשי ומדדי יעילות בין מספר חברות מתחרות באותו סקטור בבת אחת · פרומפט: \"compare free cash flow margin and FCF yield for [TICKER1], [TICKER2], [TICKER3] and [TICKER4] over the last 8 quarters, show trend versus sector median\" · מקור: 11:05",
    "מטרה: להפיק דוח ניתוח מקיף (deep dive) לחברה אחת המרכז את כל 26 ה-KPI לקראת דיווח תוצאות · פרומפט: \"[TICKER] deep dive analysis — combine revenue growth, margins, EPS, valuation multiples, cash flow, balance sheet health and capital allocation into one comprehensive report before earnings\" · מקור: 13:40"
  ],
  "mistakesToAvoid": [
    {
      "text": "מושג: השוואת מכפיל רווח בין סקטורים שונים · הגדרה קצרה: טעות נפוצה של השוואת מכפילים בלי נירמול לפי קצב צמיחה וסקטור. · מתי זה תקף: כשמשווים חברת טכנולוגיה לחברה תעשייתית ישירות בלי הקשר. · איך מזהים זאת: מכפיל גבוה מוצג כיקר בלי התייחסות לצמיחה הצפויה. · מקור: 00:07:50.",
      "estimatedStartSeconds": 470,
      "timestampKind": "estimated",
      "sourceQuote": "טעות נפוצה היא להשוות מכפיל רווח בין סקטורים שונים בלי לנרמל לפי קצב הצמיחה"
    },
    "מושג: חוב לטווח ארוך שלא פורט בתמלול · הגדרה קצרה: לא נאמר בסרטון פירוט מלא של מבנה החוב לטווח ארוך של חברת השבבים. · מתי זה תקף: יש להשלים בדיקה עצמאית בדוח הכספי הרשמי לפני החלטת השקעה. · איך מזהים זאת: חיפוש בדוח הכספי הרשמי תחת סעיף התחייבויות לטווח ארוך. · מקור: לא נאמר בסרטון.",
    "מושג: תלות בביקוש לקטגוריית מוצר אחת · הגדרה קצרה: סיכון ריכוזיות הכנסות סביב ביקוש בודד שהוזכר בתמלול. · מתי זה תקף: כשמעל מחצית ההכנסות תלויות בקטגוריית מוצר אחת. · איך מודדים: פילוח הכנסות לפי קטגוריית מוצר מתוך הדוח הכספי. · מקור: 00:11:30.",
    "מושג: בלבול בין מאקרו למיקרו · הגדרה קצרה: התייחסות לתנאי מאקרו כלליים (ריבית, אינפלציה) כאילו הם מסבירים את הביצועים הספציפיים של חברה בודדת, בלי לבדוק את הנתונים הפרטניים שלה. · מתי זה תקף: בכל פעם שמנתחים חברה בודדת בהקשר של סביבה מאקרו-כלכלית משתנה. · איך מזהים זאת: מסקנה על חברה ספציפית שמבוססת רק על טרנד ענפי/מאקרו כללי, בלי נתון פר-חברה תומך. · מקור: לא נאמר בסרטון.",
    "מושג: הסתמכות עיוורת על מודל DCF · הגדרה קצרה: מודל תזרים מזומנים מהוון (DCF) סופג כל הנחה שמזינים אליו — תחזית שגויה מייצרת שווי-יעד שגוי בביטחון-יתר, בין אם דרך אקסל ידני ובין אם דרך AI. · מתי זה תקף: בכל שימוש במודל DCF או בכלי AI לבניית תרחיש שווי עתידי. · איך מזהים זאת: שווי-יעד שמוצג כוודאות בלי ציון מפורש של הנחות היסוד שמאחוריו (קצב צמיחה, שיעור היוון). · מקור: 14:20",
    "מושג: בלבול בין בריאות פונדמנטלית לתזמון שוק · הגדרה קצרה: ניתוח פונדמנטלי עונה על 'האם העסק בריא', לא על 'מתי לקנות' — זו שאלה שונה לגמרי שדורשת כלים אחרים (טכני, מומנטום). · מתי זה תקף: בכל פעם שמשתמשים במסקנה פונדמנטלית כדי לקבוע נקודת כניסה מדויקת. · איך מזהים זאת: החלטת תזמון קנייה/מכירה שמבוססת רק על מדדים פונדמנטליים בלי אינדיקציית טיימינג נפרדת. · מקור: 14:35"
  ],
  "stockFundamentals": [
    {
      "ticker": "AAPL",
      "company": "Apple",
      "metric": "מכפיל עתידי",
      "value": 34.3,
      "interpretation": "התנגדות פונדמנטלית היסטורית — קרוב לשיא מכפיל של 10 שנים, ואזור 30+ שממנו המניה נדחתה כמה פעמים בעבר",
      "asOf": "2026-09-09",
      "sourceQuote": "מכפיל הרווח העתידי של אפל עומד היום על 34.3, וזו בדיוק הרמה שממנה המניה נדחתה כמה פעמים בעשור האחרון, באזור ה-30 ומעלה",
      "estimatedStartSeconds": 470,
      "timestampKind": "estimated"
    },
    {
      "ticker": "NVDA",
      "company": "NVIDIA",
      "metric": "מכפיל עתידי",
      "value": 18.7,
      "interpretation": "זולה משמעותית מאפל ומגוגל באותו מדד — השוואת עמיתים",
      "asOf": "2026-09-09",
      "sourceQuote": "לעומת זאת אנבידיה נסחרת במכפיל עתידי של 18.7 בלבד",
      "estimatedStartSeconds": 512,
      "timestampKind": "estimated"
    },
    {
      "ticker": "GOOGL",
      "company": "Alphabet",
      "metric": "מכפיל עתידי",
      "value": 25.3,
      "interpretation": "בטווח ביניים בין השתיים, קרוב לממוצע ההיסטורי שלה",
      "asOf": "2026-09-09",
      "sourceQuote": "וגוגל נמצאת באמצע, מכפיל עתידי של 25.3",
      "estimatedStartSeconds": 545,
      "timestampKind": "estimated"
    }
  ]
}
```

### 2.6 Field-by-field table

All `videoAnalytics.js` line numbers below are as found live at HEAD `be1a70d` (differing slightly, +40 to +55 lines, from the numbers cited in the schema doc reproduced in §2.4 — that doc already warns the tree was a moving target while it was written). Underlying logic verified identical to the doc's description; only line numbers drifted.

| JSON field | Normalizer (file:line) | App field (`video.<key>`) | Consuming tab | Render path (file:line) | Empty/missing behavior |
|---|---|---|---|---|---|
| `shortSummary` | `videoAnalytics.js:1203-1209` (`merged.shortSummary\|\|merged.summary\|\|nested.shortSummary\|\|nested.summary`) | `shortSummary` | 1 Summary | `videoTabsConfig.js` case `'summary'` (`:660-698`), `pickStringAsArray(video,'shortSummary','fullSummary','gemSummary','summary')` — first non-empty of 4 aliases wins | Empty string → row omitted |
| `fullSummary` | `:1210-1216` | `fullSummary` | 1 Summary (separate "סיכום מלא" card) | `FullSummaryParagraphs.jsx`, rendered `VideoDetailPanel.jsx:11234` — reads `effectiveVideo.fullSummary` directly, independent of the alias chain above | Empty string → card not rendered |
| `mainLesson` | `:1224` (`resolvedMainLesson`, computed `:1172-1176`) | `mainLesson` | 1 Summary | Same case `'summary'`, separate `pickStringAsArray(video,'mainLesson')` call (`:694`), appended unconditionally | Defaults to `"לא צוין בתמלול"` if nothing resolves (`:1224`) — always non-empty |
| `chapters` | `:1139-1147` → `normalizeAnalysisChapters` | `chapters` (+ mirrored to `aiChapters`, `chapterSource:'gems_analysis'` if non-empty, `:1288`) | 2 Chapters | case `'chapters'` (`videoTabsConfig.js:701-712`) | Empty array → chapters tab empty-state |
| `keyInsights` | `:1234-1241` (merges `merged.keyInsights`/`learning.keyInsights`/`brainInsights`) | `keyInsights` | 3 Insights | case `'insights'` legacy (~814) | Falls back to `atomicKnowledge`-derived array if empty |
| `usefulKnowledge` | `:1278` | `usefulKnowledge` | 4 Useful Knowledge | case `'useful-knowledge'` legacy | Empty → section omitted |
| `frameworks` | `:1251-1253` via `normalizeLearningArray` | `frameworks` | 4, "⚙️ מסגרות ניתוח" | case `'analysis-frameworks'` (`videoTabsConfig.js:937-941`), `pickArray(video,'frameworks','analysisFrameworks')` | Empty → section omitted |
| `checklists` | `:1245-1247` | `checklists` | 4, "✅ צ'קליסטים" | case `'checklists'` (`:779-784`) | Empty → omitted |
| `mistakesToAvoid` | `:1231-1233` | `mistakesToAvoid` | 4, "❌ טעויות נפוצות" | case `'mistakes'` (`:786-793`) — **merged** with `warnings`/`riskRules`, all three concatenated, not first-wins | Empty for all three → omitted |
| `warnings` | `:1248-1250` | `warnings` | 4, same "❌ טעויות נפוצות" section (merged, not separate) | Same case `'mistakes'` (`:791-792`), `pickArray(video,'warnings')` as its own concat term — confirmed live code, not a doc claim | Empty → omitted |
| `financialMetrics` | `:1254` | `financialMetrics` | 4, "📈 מדדים פיננסיים" | case `'financial-metrics'` (`:924-929`) — reads `resolveSpecialized(marketBriefData)` first (always `null` on the flat/manual path, §2.7), falls back to `video`/`video.analysis` | Empty → omitted |
| `valuation` | `:1255` | `valuation` | 4, "💰 הערכת שווי" | case `'valuation'` (`:931-935`) | Empty → omitted |
| `investmentChecklist` | `:1256` | `investmentChecklist` | 4, "📋 צ'קליסט השקעה" | case `'investment-checklist'` (`:943-949`) — falls back to `checklists` **only if** `investmentChecklist` itself is empty | Empty on both → omitted |
| `promptTemplates` | `:1257` | `promptTemplates` | 4, "📜 תבניות פרומפט" | case `'prompt-templates'` (`:951-955`) | Empty → omitted |
| `stockFundamentals` | `:1258` via dedicated `normalizeStockFundamentalsArray`/`normalizeStockDataPointItem(v,'metric')` (`videoAnalytics.js:687-716`) — **not** `normalizeLearningArray`, preserves object shape | `stockFundamentals` | 7 Specialized, "📊 נתונים פונדמנטליים" | case `'stock-fundamentals'` (`:961-966`) → `<StockFundamentalsSection>` in `MorningBriefPanels.jsx` | Item missing `ticker`/`metric`/`value` → `null`, silently `.filter(Boolean)`-dropped, not a parse error |
| `tags` | `:1227` | `tags` | 6 Topics | case `'topics-subtopics'` legacy | Empty → omitted |
| `contentType` | `:1292` | `contentType` | routing signal only, consumed before normalization runs (§2.7) | n/a | — |
| `appBuilding` (**not** a field the fundamental GEM's own instructions ask for) | `:1325-1356` | `appBuilding` | **5 APP** | `AppBuilderTab.jsx:40` `discoverFeaturesFromAppBuilding(video?.appBuilding)` | `appBuilding` absent → `discoverFeaturesFromAppBuilding` returns `[]`, falls back silently to `discoverFeaturesFromMacro(marketBriefData)` (also `[]` on the flat path) |

**Fields written by the normalizer but never rendered anywhere:** none found for the 8 fundamental-specific fields as of HEAD `be1a70d` — the historical "first-non-empty-wins" bug that silently hid `mainLesson`/`fullSummary`/`warnings` (documented as fixed in §2.4 §6.1) was independently re-confirmed against live code: the `pickArray`/`pickStringAsArray` call sites for `case 'summary'`/`case 'mistakes'` are genuinely separate, merging calls, not a single fallback chain.

**Fields the UI reads that the fundamental GEM's schema never populates:** `stockTechnicals` — normalizer exists (`videoAnalytics.js:717+`), tab-7 case exists (`case 'stock-technicals'`, `videoTabsConfig.js:968-973`) — but no GEM in this repo writes it (confirmed: no technical-GEM instructions exist, §2.10). Intentional per the instructions' own "מה עדיין לא נכתב" section, not a bug.

**Fields explicitly forbidden by the instructions that the code drops silently:** `analysisFrameworks` (wrong name — correct is `frameworks`), `riskRules`, `universalTabs` (flips routing, §2.7), `warnings` (this ban is stale text — see §2.3's verified-stale-content note).

### 2.7 Flat schema vs. universalTabs/marketBrief schema

`VideoDetailPanel.jsx`'s `_applyParsedGems(parsed)` (function starts `:6533`, differs from the schema doc's cited `:6524`/`:6531` by 2-9 lines — same function) is the single dispatcher. It calls `canonicalizeGemsPayloadForPersistence(parsed)` first (`:6540`), then branches in this exact order:

1. **`canonicalParsed?.contentType === 'marketBrief'`** (`:6543`) → morning/evening-brief path. Persists to `marketBriefData`. Sets `activeTab` to `'specialized'`. **Does not call `normalizeAiAnalysisResult`.**
2. **`parsed?.universalTabs?.appBuilder` present and `contentType !== 'marketBrief'`** (`:6602`) → standalone App-Builder-tab paste, via `mapUniversalAppBuilderToSections` + `saveAppBuilderDraft`. Sets `activeTab` to `'app-builder'`.
3. **`canonicalParsed?.contentType === 'market' && canonicalParsed?.universalTabs` is a plain object** (`:6630`) → "Macro / Universal Market GEM" path — the code's own comment reads: *"Macro / Universal Market GEM — contentType: 'market' with universalTabs. Routes through marketBriefData so all universalTabs.* tabs render correctly."* Persists to `marketBriefData`, sets `activeTab` to `'summary'`. **Also does not call `normalizeAiAnalysisResult`.**
4. **Else (the fundamental GEM's actual path)** (`:6675`) → `normalizeAiAnalysisResult(parsed)`, merged onto `video` directly via `completeGemsImport`.

**Why the fundamental GEM's instructions ban `universalTabs`:** `canonicalizeGemsPayloadForPersistence` (`gemsJsonRepair.js:184`) opens with `if (!isPlainObject(value) || !isPlainObject(value.universalTabs)) return value;`, so a flat payload with no `universalTabs` key passes through unchanged and correctly falls to branch 4. If the fundamental GEM ever emitted `contentType:"market"` + a `universalTabs` object, it would be silently hijacked into branch 3 — all 8 learning fields plus `stockFundamentals` would never reach `normalizeAiAnalysisResult` at all, and `SpecializedContentRenderer.jsx:380` (`isMacroContent = slug==='macro' || (!!marketBriefData?.universalTabs && marketBriefData?.contentType==='market')`) would force tab 7 to render the **macro** dashboard instead of the fundamental one, regardless of the video's actual subCategory slug. Both halves of this claim verified against live code.

### 2.8 Two ingestion chains

**Ingestion Chain A — automatic in-app pipeline (video → AI call → parse → persist)**

Two **separate, non-shared** implementations exist, for two different deployment targets:

- **A1. Local dev server (Gemini), `vite.config.js`** — handler around `:490-600`. Builds a prompt via `buildGeminiAnalysisPrompt({...})` (`vite.config.js:382`) — a single generic prompt builder, not dispatched per-contentType (`getGeminiDispatchType`/`getGemPromptConfig` from the dead `gemContentRouter.js` are never imported here). Two stages: Stage 1 tries direct YouTube-URL analysis via `gemini-2.0-flash`; Stage 2 falls back to transcript text. Both stages call `applyTimedNarrativeEvidenceGateToAnalysis(parsed, [])` (`:529`, `:586`) — with a deliberately **empty** segment array, meaning any timed claim from URL-only analysis is stripped by construction. This pipeline does **not** know about `docs/gems/GEM-FUNDAMENTAL-INSTRUCTIONS.md` — no fundamental-specific prompt/schema/validator is wired to it (`UNVERIFIED` whether `src/ai/gemini/prompts/marketPrompt.js` is ever invoked from this exact handler — not traced to closure, see §5.4).
- **A2. Base44 production backend (Claude), `backend/analyze-video.function.js`** — standalone file, deployed by Base44 with no bundler, carrying its own inlined copy of the evidence-gate logic (`:24-49`, its own comment cites `scripts/timed-narrative-evidence-gate-qa.mjs` as the parity test between the two copies). Uses `CLAUDE_MAX_TOKENS = 6_000`, `TRANSCRIPT_CHAR_LIMIT = 200_000`, a fixed generic `CLAUDE_SYSTEM_PROMPT` (`:17-22`, not the fundamental GEM's text). Its `TIMED_NARRATIVE_ARRAY_FIELDS` list (`:43-49`, mirrored in `src/lib/timedNarrativeEvidenceGate.js:29-35`) includes `mistakesToAvoid`/`usefulKnowledge`/`warnings`/`riskRules` but **not** `frameworks`/`financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates`/`checklists`/`stockFundamentals`/`stockTechnicals` — so even if this pipeline someday emitted fundamental-specific fields, the evidence gate would not scan most of them.

Both A1 and A2 are entirely separate from the fundamental GEM — its actual "model call" happens outside this repo, inside Gemini's own custom-GEM web UI, using the System Instructions text in §2.3.

**Ingestion Chain B — manual paste-back path (user pastes GEM JSON into the app)**

Entry: `VideoDetailPanel.jsx`'s "הדבק JSON מ-GEMS" dialog → `handleApplyGemsJson()` → `parseAndValidateGemsJson(raw)` (`gemsJsonRepair.js:334-364`):
1. `JSON.parse(raw)` — on failure, returns diagnostics from `getJsonParserDiagnostics` (`:235+`) without attempting repair yet.
2. On successful parse, `validateGemsJsonValue(value)` (`:279-332`) runs the branch logic detailed in §2.4 §2 (`GENERIC_ANALYSIS_FIELDS` threshold gate) and computes `densityWarnings` (`:23-40`, non-blocking, fires only when `value.frameworks && value.checklists && value.mistakesToAvoid` are all arrays and one of `financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates` has exactly 1 item — flagged to the user in the paste dialog as a possible "summarized instead of enumerated" warning, never blocks the apply).
3. If `parseAndValidateGemsJson` fails outright, `repairGemsJsonDeterministically(rawText)` (`:506+`) attempts **lexical-only** JSON repair: escaping literal control characters inside strings (`:366-393`), escaping unescaped quotes inside words via a lookahead heuristic (`:405-461`), inserting a proven-missing property comma only when the specific parser error message matches (`:463-476`). All repairs are marked `lexicalOnly: true`, `meaningChanged: false` (`:490-504`) — no semantic reconstruction, no field invention.
4. On success, `_applyParsedGems` routes per §2.7's 4-branch logic, and for the fundamental case ends at `normalizeAiAnalysisResult(parsed)` (`VideoDetailPanel.jsx:6675`).

**Evidence gate does NOT run on chain B** — verified by grep, not assumed: `applyTimedNarrativeEvidenceGateToAnalysis` has exactly 4 call sites in the entire repo (`vite.config.js:529,586,1083` and `backend/analyze-video.function.js:405`) — all inside chain A. Zero call sites inside `VideoDetailPanel.jsx`, `gemsJsonRepair.js`, or `videoAnalytics.js`. This means any `estimatedStartSeconds`/`sourceQuote` the fundamental GEM writes (external to this repo, in Gemini's own UI) is trusted as-is by chain B, with no automatic verification against a real transcript — exactly why the instructions repeatedly say "עדיף בלי זמן מאשר זמן שגוי" (better no timestamp than a wrong one): compensating for a real, confirmed gap, not excess caution.

JSON-repair heuristics run only on chain B (they operate on raw pasted text before any model call would exist). Chain A's cleanup is a much smaller, single-purpose step (`sanitizeJsonGershayim` + fenced-code-block strip, `vite.config.js:522-524,577-579`), not the same deterministic-repair engine.

### 2.9 Tab 7 behavior and the APP-tab contradiction

`SpecializedContentRenderer.jsx:141-160` renders `<MorningBriefDashboard>` — the same 9-section brief dashboard used for morning/evening briefs — for any video whose `slug` is `'fundamental-analysis'`/`'technical-analysis'`, **or** (when `slug` is empty, the normal case for a manually-pasted fundamental video, since the paste flow never sets `subCategory`) whenever `looksLikeFundamentalOrTechnical(effectiveVideo)` is true — a signal-field check against `FUNDAMENTAL_SIGNAL_FIELDS = ['frameworks','analysisFrameworks','financialMetrics','valuation','investmentChecklist']` or `TECHNICAL_SIGNAL_FIELDS = ['indicators','setups','tradingSetups','patterns','tradingPatterns']` (`:39-45`). The `showStockDataSections` prop (`:156`) is passed only on this branch, gating the `stockFundamentals`/`stockTechnicals` table sections (§2.4 §10.4) so they never leak into the plain morning/evening-brief render.

**Confirmed contradiction, code newer than docs (APP tab):** the schema doc (§2.4 §6) states tab 5 (APP) is unreachable via flat JSON — its exact words: *"שום קומפוננטה שמרנדרת את טאב 5 לא צורכת אותו [appBuilding]."* This is **false against live code today**: `AppBuilderTab.jsx:36-48` reads `discoverFeaturesFromAppBuilding(video?.appBuilding)` (`featureDiscovery.js:1745-1758`, calling `normalizeSuggestedFeature` at `:1691-1737`), merges GEM-authored ideas ahead of `discoverFeaturesFromMacro(marketBriefData)`-derived ones, and `AppBuilderTab.jsx` is confirmed rendered as tab 5 with `video={video}` at `VideoDetailPanel.jsx:12337-12341`. The normalizer (`videoAnalytics.js:1325-1356`) genuinely maps `merged.appBuilding` → `video.appBuilding`, requiring `feature`+`whatItDoes`+`reason` non-empty per item (`featureDiscovery.js:1697`), dropping `confidence:"low"` items lacking a `sourceQuote` (`:1701`). **The field name is `appBuilding` (object with `.suggestedFeatures[]`), a distinct shape from the `universalTabs.appBuilder` field the routing logic checks for hijacking (§2.7 branch 2)** — these are two different fields with confusingly similar names, independently verified not to collide. Practical implication: the fundamental GEM's instructions could safely ask for `appBuilding.suggestedFeatures[]` today and it would reach tab 5, but the current pasteable instruction text (§2.3) explicitly forbids trying. Whether this `appBuilding` code path was added before or after the schema doc's §6 was last edited is `UNVERIFIED` — only which side is correct *now* is confirmed.

### 2.10 Other GEMs — implemented vs. planned

| GEM family | Instructions doc in `docs/gems/`? | Schema/code registry | Rendering component | Verdict |
|---|---|---|---|---|
| **Morning/evening brief** ("מבזק בוקר/ערב") | **None** — `Glob "**/*GEM*INSTRUCTIONS*"` across the whole repo returns only `GEM-FUNDAMENTAL-INSTRUCTIONS.md` | `MARKET_BRIEF_GEM_KEY="marketBrief"` (`src/lib/gemsConfig.js:2-3`); canonical schema `getMorningBriefSchemaExample()` (`src/ai/gemini/schemas/morningBriefSchema.js:8+`, real `universalTabs`-shaped example); full routing branch in `_applyParsedGems` (§2.7 branch 1) | `MorningBriefDashboard.jsx`, rendered from `SpecializedContentRenderer.jsx:163-175` for `slug==='morning-brief'\|\|'evening-brief'` | **IMPLEMENTED** at the code level. The GEM's own prompt text is **not checked into this repo** — unlike the fundamental GEM, it must live only in the user's private Gemini custom-GEM configuration. |
| **Macro** ("מאקרו") | **None** | Registry key `macro` in `GemSelectionModal.jsx`'s `TJS_GEMS` (`:33`) and `gemRecommender.js`'s `GEM_CATEGORY_MAP`; routes through the same `contentType==='market' && universalTabs` branch as any Universal-Market GEM (§2.7 branch 3); `isMacroContent` gate confirmed live at `SpecializedContentRenderer.jsx:380` | `MacroGemDashboard.jsx` (confirmed via Glob) | **IMPLEMENTED** at the code level but **no instruction/schema/example doc exists for it anywhere in `docs/gems/`** — same doc gap as morning/evening brief. |
| **Technical** ("ניתוח טכני") | **Only a prep-notes doc**, `docs/gems/GEM-TECHNICAL-PREP-NOTES.md` — its own title and body state explicitly (`:3-5`): *"WORK-ID (tomorrow, the actual build): TRADINGBRAIN-GEM-TECHNICAL-SCHEMA (proposed)... no code change, no instructions text written."* No `GEM-TECHNICAL-INSTRUCTIONS.md`/`GEM-TECHNICAL-SCHEMA.md`/`GEM-TECHNICAL-EXAMPLE.json` exist (the prep-notes doc itself states at `:86` it verified via `git log --all` that no such trio of files has ever existed) | `indicators`/`setups`/`patterns` fields **are** mapped by `normalizeAiAnalysisResult` (`videoAnalytics.js:1272-1274`, confirmed live) and reportedly have dedicated tab-4 sections wired in `VideoDetailPanel.jsx` (per the prep-notes doc's own `git diff` findings — exact line numbers there are `UNVERIFIED`, §5.4). `TECHNICAL_SIGNAL_FIELDS` exists in `SpecializedContentRenderer.jsx:40` and correctly triggers the same tab-7 `MorningBriefDashboard` branch as fundamental (§2.9) | Same `MorningBriefDashboard.jsx`/`SpecializedContentRenderer.jsx` branch, shared with fundamental — not a separate component | **PLANNED / PARTIAL.** Supporting code infrastructure (normalizer fields, tab-4 sections, tab-7 routing, signal-field detection) is real and already working — a technical GEM output using the *existing* fields would render correctly today. What is missing is the GEM's own instruction/schema/example documents — nobody has written the System Instructions text yet. |

---

## 3. Gemini integration

**תקציר (עברית):** כל קריאות Gemini רצות server-side בלבד (Vite dev-middleware או Base44 backend functions) — אין קריאה מה-browser. שלושה מודלים בשימוש בפועל (`gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-3.5-flash-lite`) — לא `gemini-1.5-pro`. אומת: **כל** נתיב קריאה בתשלום דורש קליק מפורש של המשתמש — אפס נתיבים אוטומטיים נמצאו, כולל בדיקת כל ה-`useEffect` הרלוונטיים.

### 3.1 Model identifier strings

| Model string | File:line | SDK/REST |
|---|---|---|
| `gemini-2.0-flash` | `vite.config.js:516` (Stage 1, URL analysis) | SDK |
| `gemini-2.0-flash` | `vite.config.js:574` (Stage 2, transcript fallback) | SDK |
| `gemini-2.0-flash` | `vite.config.js:1201` (`/api/political-summary`) | SDK |
| `gemini-2.0-flash-lite` | `vite.config.js:682` (legacy `/api/analyze-video`) | SDK |
| `gemini-2.0-flash-lite` | `vite.config.js:2129` (`/api/gemini-ai-mapping-diagnosis`) | SDK |
| `gemini-3.5-flash-lite` | `vite.config.js:2047` (`/api/gemini-hebrew-titles`) | SDK |
| `gemini-3.5-flash-lite` | `src/server/gemsJsonRepairProvider.js:6` (`DEFAULT_GEMS_REPAIR_MODEL`, used `:61/124`), overridable by `env.GEMINI_REPAIR_MODEL` (`vite.config.js:727`) | Raw REST `fetch` |
| `gemini-3.5-flash-lite` | `backend/repair-gems-json.function.js:14` (`DEFAULT_MODEL`), overridable by `process.env.GEMINI_REPAIR_MODEL` (`:234`) | Raw REST `fetch` |
| `gemini-3.5-flash-lite` | `.env.example:34` (`GEMINI_REPAIR_MODEL=gemini-3.5-flash-lite`, documents the default) | — |

**`gemini-1.5-pro` does not appear anywhere in this repository** (repo-wide grep for `gemini-1.5`, `gemini-pro`, `models/gemini`). Three distinct model families are used. Every call site uses the `@google/generative-ai` SDK v`^0.24.1` (`package.json:83`), **except** the GEMS-JSON-repair path, which bypasses the SDK and calls the raw REST endpoint `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}` directly (`src/server/gemsJsonRepairProvider.js:71`, `backend/repair-gems-json.function.js:239`).

### 3.2 Every Gemini call site

All Gemini calls run **server-side only**: Vite dev-server `configureServer` middleware (dev-only) or standalone Base44 backend functions. **No Gemini call is made from browser-executed code** — verified by grepping all of `src/` for `generativelanguage.googleapis.com` and `GoogleGenerativeAI`: both appear only inside `vite.config.js`, `src/server/gemsJsonRepairProvider.js`, and `backend/repair-gems-json.function.js`, none of which ship to the client (`backend/*.function.js` uses CommonJS `module.exports`, `:300`, deployed standalone to Base44, never bundled by Vite).

1. **`POST /api/gemini-video-content`** — `vite.config.js:457-601`, Vite dev-middleware. Stage 1: `model.generateContent([{fileData:{mimeType:'video/mp4', fileUri: ytUrl}}, {text: prompt}])` (`:517-520`). Stage 2: `model.generateContent(txPrompt)` (`:574-575`), fires when Stage 1 is skipped/insufficient and `txText.length >= 300` (`:554`). **No `generationConfig`, no `safetySettings`, no `responseSchema`/`responseMimeType`, no explicit temperature/token limit at either call** (SDK defaults apply; effective values `UNVERIFIED` — SDK internals not read). Gating: Stage 1 accepted only if `isResultSufficient()` (`:359-367`: `fullSummary.length>50`, `keyPoints.filter(Boolean).length>=2`, `chapters.length>=2`, rejects output containing `"placeholder"`/`"cannot access"`/`"לא יכול לגשת"`).
2. **`POST /api/analyze-video`** (legacy) — `vite.config.js:606-709`. `model: 'gemini-2.0-flash-lite'`, no `generationConfig` (`:682-684`). Has a `GEMINI_MOCK` short-circuit: `if (env.GEMINI_MOCK === 'true')` returns hardcoded Hebrew mock JSON after a 1200ms `setTimeout`, no network call (`:643-658`) — **this is the only place in the repo where `GEMINI_MOCK` is read as a branch condition**; `VideoDetailPanel.jsx:7590,8094` only reference it inside user-facing Hebrew error-hint strings.
3. **`POST /api/gemini-repair-json`** — `vite.config.js:711-736`, delegates to `runGemsJsonRepair()` (`src/server/gemsJsonRepairProvider.js:121-144`). Deterministic repair runs **first**; Gemini is called **only if** deterministic status is `'failed'` (`:130-131`) — a genuine cost-avoidance gate. Body: `{contents:[{role:'user',parts:[{text:prompt}]}], generationConfig:{temperature:0, maxOutputTokens:32768, responseMimeType:'application/json'}}` (`:71-83`) — the only Gemini call site setting `responseMimeType: 'application/json'`. 150,000ms `AbortController` timeout (`:8,67-68`).
4. **`POST /api/political-summary`** — `vite.config.js:1119-1219`. `model:'gemini-2.0-flash'`, no `generationConfig` (`:1201-1202`). Gate: `transcriptText.trim().length >= 100` (`:1149`); transcript truncated to `slice(0,12000)` chars (`:1161`).
5. **`POST /api/gemini-hebrew-titles`** — `vite.config.js:1997-2073`. `model:'gemini-3.5-flash-lite'`, no `generationConfig` (`:2047-2048`). Post-check: returned `hebrewTitles` array length must exactly equal input chapter count or the server returns `502 INVALID_MODEL_RESPONSE` (`:2055-2062`).
6. **`POST /api/gemini-ai-mapping-diagnosis`** — `vite.config.js:2075-2156`. `model:'gemini-2.0-flash-lite'`, `generationConfig:{temperature:0.1, maxOutputTokens:4096}` (`:2129-2133`) — the **only** SDK-based call site with an explicit `generationConfig`.
7. **`backend/repair-gems-json.function.js`** — Base44 backend function `RepairGemsJson`, standalone (no shared `src/` imports, per its own header). Near-identical twin of item 3: same deterministic-first gate (`:167`), same REST endpoint/`generationConfig` (`:239-247`), same 150,000ms timeout (`:16`).

**No `safetySettings`/`HarmCategory`/`HarmBlockThreshold` appear anywhere in the repository** (repo-wide grep, zero matches) — provider defaults apply everywhere.

### 3.3 Prompts sent to Gemini (verbatim, interpolated variables marked)

**Main analysis prompt** — `buildGeminiAnalysisPrompt()`, `vite.config.js:382-452`, used for both stages of `/api/gemini-video-content`:

```
נתח את הסרטון ביסודיות והחזר JSON בלבד, בלי markdown ובלי טקסט נוסף.

═══ מטרת הניתוח ═══
המטרה: חלץ ידע אישי מקצועי שניתן לעשות בו שימוש חוזר.
שאל: "אם שכחתי לגמרי את הסרטון — מה הייתי רוצה שיישאר?" — זה הידע שצריך לחלץ.

═══ כללי פרקים ═══
צור בערך ${chaptersTarget || 6} פרקים איכותיים שמכסים את כל הסרטון מההתחלה ועד הסוף.
כל כותרת פרק חייבת להיות ספציפית. אסור: "פתיח", "סיכום", "פרק 1".
כלול startSeconds ו-endSeconds לכל פרק.
הפרק האחרון חייב להתחיל בשליש האחרון של הסרטון (startSeconds ≥ 65% ממשך הסרטון).
אסור לעצור פרקים באמצע הסרטון — הפרקים חייבים להגיע קרוב לסוף.

═══ כללי איכות ═══
אסור: "placeholder", ביטויים גנריים.
אם אין חומר לשדה — החזר מערך ריק.
עברית תקינה וברורה.
[if attached PDFs: "═══ מסמכים מצורפים ═══" block listing ${attachedDocumentsMetadata}]

כותרת: ${title}
[ערוץ: ${channelName}]
[מנטור: ${mentor}]
[קטגוריה: ${category}]
[משך סרטון בשניות: ${durationSeconds}]
[הערות: ${userNotes}]

החזר JSON עם השדות הבאים בלבד:
${JSON.stringify(schema, null, 2)}
```
(Stage 2 additionally appends `\nרמזי פרקים:\n${chapterHintsText}` and `\nTranscript:\n${txText}` — `vite.config.js:572`.) Note: this prompt has **no explicit "no ASCII `\"` inside strings" instruction** — unlike the fundamental GEM's own instructions (§2.3) — this server relies entirely on post-hoc repair (`sanitizeJsonGershayim`) rather than prompt-level prevention.

**Legacy `/api/analyze-video` prompt** — `vite.config.js:662-677`:
```
אתה עוזר לימוד בעברית. נתח את הסרטון הבא והחזר JSON בלבד, ללא markdown, ללא טקסט נוסף.
כל הטקסטים בתוצאה חייבים להיות בעברית טבעית וברורה.

כותרת הסרטון: ${title}
תיאור: ${description || 'אין תיאור'}
נקודות מפתח קיימות: ${existingPoints}

החזר JSON בפורמט הזה בלבד:
{
  "shortSummary": "תקציר קצר של 2-3 משפטים בעברית על מה שהסרטון מלמד",
  "fullSummary": "תקציר מפורט של 4-6 משפטים בעברית עם תובנות מעשיות",
  "keyPoints": ["נקודה מרכזית 1 בעברית", ...],
  "tags": ["תגית1", "תגית2", "תגית3"]
}
```

**`/api/political-summary` prompt** — `vite.config.js:1154-1197` (transcript truncated to 12,000 chars):
```
אתה מנתח פוליטי מומחה. נתח את הסרטון הפוליטי הבא על סמך התמלול.
החזר JSON תקין בלבד. ללא markdown. ללא ```json. ללא טקסט לפני ה-JSON ואחריו.
חובה להתחיל ב-{ ולהסתיים ב-}. פסיקים בין כל השדות. ללא גרשיים שבורים. כל הטקסטים בעברית.

כותרת: ${title}
[ערוץ: ${channelName}]
תמלול:
${transcriptText.slice(0, 12000)}

החזר JSON בפורמט הבא בדיוק:
{ "videoMetadata": {...}, "politicalSummary": {...}, "chapters": [...], "arguments": [...], ... }
```
(Full field list at `vite.config.js:1164-1197` — `videoMetadata`, `politicalSummary`, `chapters`, `arguments`, `counterArguments`, `knowledgePoints`, `keyInsights`, `warnings`, `rules`, `concepts`, `politicalSlogans`, `viralQuotes`, `debateResponses`, `commentBank`, `campaignKit`, `ideologyAnalysis`.)

**`/api/gemini-hebrew-titles` prompt** — `vite.config.js:2032-2043` (string concatenation, not a template literal):
```
אתה עוזר לימוד. תפקידך לתרגם ולנסח מחדש כותרות פרקים לעברית בצורה ברורה ותמציתית.

כותרת הסרטון: ${videoTitle}
קטגוריה: ${category}
תת-קטגוריה: ${subCategory}

פרקים לעיבוד:
${chapterLines}

הוראות:
- צור כותרת עברית קצרה (4-8 מילים) לכל פרק.
- הכותרת חייבת לשקף את תוכן הפרק, לא להיות תרגום מילולי.
- אל תשתמש ב-"פרק 1", "פתיח" וכו'' — כותרת ספציפית בלבד.
- החזר JSON בלבד, ללא markdown, בפורמט הזה:
{"hebrewTitles": ["כותרת 1", "כותרת 2", ...]}

מספר הכותרות חייב להיות בדיוק ${chapters.length}.
```

**`/api/gemini-ai-mapping-diagnosis` prompt** — `vite.config.js:2111-2125` (English — a debugging-assistant prompt, verbatim):
```
You are a debugging assistant for a React app that maps YouTube video AI analysis into 7 universal tabs: summary, chapters, insights, useful-knowledge, app-builder, topics-subtopics, specialized.

Analyze the diagnostic report below and return ONLY valid JSON (no markdown fences, no extra text) with this exact structure:
{ "status": "ok", "working": [...], "issues": [...], "missingData": [...], "unmappedData": [...], "tabMappingPlan": {...}, "fixPromptForClaudeCode": "..." }

Diagnostic report:
${reportStr}
```

**GEMS-JSON-repair prompt** — `src/server/gemsJsonRepairProvider.js:21-39` and its `backend/repair-gems-json.function.js:218-229` twin (English, identical structure in both):
```
Return STRICT JSON only. Do not use Markdown.
Repair the supplied GEMS JSON without inventing missing content.
The output wrapper must have exactly these fields:
{"repairedJson":"valid JSON text","changes":[],"why":"","prevention":[],"promptCorrection":""}
Rules:
- repairedJson must itself be a complete JSON object encoded as a JSON string.
- Preserve all existing values and sections.
- Fix syntax/escaping only; do not summarize, omit, or fabricate content.
- Do not return a candidate if content is missing at EOF.
- The repaired document must follow the GEMS schema already present in the input.

Parser error: ${diagnostics.message}
Parser position: ${diagnostics.position}

Broken JSON:
${rawJson}
```

### 3.4 Parsing chain

**`/api/gemini-video-content` path (primary analysis flow):**
1. Server: `result.response.text().trim()` (`vite.config.js:521`/`:576`).
2. Strip markdown fences: inline regex replace (`:522-524`/`:577-579`).
3. `sanitizeJsonGershayim(cleaned)` (`:745-772`) — protected two-pass repair (Pass 1 regex `([ְ-׿\w])"([ְ-׿\w])` → escape; Pass 2 up to 20 iterative `JSON.parse`-and-escape). Server-only, per this project's own architectural rule.
4. `JSON.parse(cleaned)` (`:525`/`:580`).
5. `applyTimedNarrativeEvidenceGateToAnalysis(parsed, [])` (`src/lib/timedNarrativeEvidenceGate.js:138-147`) — invoked with a deliberately empty segment list (`:529`/`:586`), strips unverifiable time claims by construction.
6. `isResultSufficient()` gate, Stage 1 only (`:359-367`).
7. HTTP JSON response (`:535`/`:593`).
8. Client: `fetchGeminiVideoContent()` (`src/services/geminiVideoContent.js:23-79`) — native `res.json()`, no additional client-side repair.
9. `handleGeminiContent()` (`VideoDetailPanel.jsx:8641-8770`, only caller) — `validateAiAnalysisQuality(result)` → `normalizeAiAnalysisResult(result)` (`src/services/videoAnalytics.js:1368-1369`).
10. Chapter normalization: `normalizeTranscriptBackedChapters`/inline fallback (`:8698-8707`); `validateChaptersForSave` (`:8709-8715`).
11. Persistence: `persistAnalysisState(patch)` (`:8756`), `saveSavedAnalysis(video.id, snapshot)` (`:8761`), `setSavedAnalysisMeta(...)` (`:8762`), `onVideoPatch?.(nextVideo)`/`onAnalyzeDone?.(nextVideo)` (`:8765-8766`).
12. Render: `setVideoState(nextVideo)` (`:8758`) drives the tabbed UI — downstream tab renderers not individually traced beyond §1/§2.

**GEMS paste-recovery path (client-only unless AI repair is explicitly clicked):**
1. `parseAndValidateGemsJson(raw)` (`src/lib/gemsJsonRepair.js:334`).
2. On failure: `repairGemsJsonDeterministically(raw)` (`:506`) — deterministic only, no network call.
3. If deterministic repair fails and the user clicks the AI-repair button: `handleAiRepairGemsJson()` (`VideoDetailPanel.jsx:6858`) → `requestGemsJsonRepair()` (`src/services/gemsJsonRepair.js:12-56`) → either `base44.functions.RepairGemsJson(payload)` (prod) or `fetch('/api/gemini-repair-json')` (dev) → `runGemsJsonRepair()` → `callGeminiGemsJsonRepair()` (`:57-119`) → `parseGeminiEnvelope(payload)` (`:42-55`) → `parseAndValidateGemsJson(repairedJson)` (`:103`, final gate).
4. Applying the repaired JSON requires a **second, separate** explicit click (`onClick={handleApplyAiRepairedJson}`, `VideoDetailPanel.jsx:13917`) — never auto-applied.
5. On successful persistence, `canonicalizeGemsPayloadForPersistence()` (`gemsJsonRepair.js:183`) is the canonical-shape normalizer — existence/export location confirmed, full internal merge logic not traced in depth (`UNVERIFIED` beyond "it exists and is the canonical-persistence-shape function").

### 3.5 Error handling, retries, timeouts, cost controls — and the automatic-paid-call audit

**Retries:** zero matches for `retry`/`backoff`/`maxRetries` anywhere in `vite.config.js`. No Gemini or Claude call site has automatic retry/backoff. Every call fires once; failures surface directly as an HTTP error.

**Timeouts:** `/api/gemini-video-content`, `/api/analyze-video`, `/api/political-summary`, `/api/gemini-hebrew-titles` have no explicit per-request timeout wrapper around the SDK `generateContent()` calls (SDK's own internal default, if any, is `UNVERIFIED`). `/api/gemini-repair-json` and its Base44 twin have an explicit 150,000ms `AbortController` timeout. The client-side `requestGemsJsonRepair()` wrapper adds its own 180,000ms `AbortController` timeout (`src/services/gemsJsonRepair.js:3,27-33`).

**Error codes:** `/api/gemini-video-content` maps `429`+`"limit: 0"` → `QUOTA_ZERO`, `429` → `RATE_LIMIT`, `401` → `INVALID_KEY`, else `GEMINI_ERROR` (`:596-599`). `/api/analyze-video` additionally maps `403` → `QUOTA_EXCEEDED` (`:699-704`).

**Cost controls found:** (a) deterministic-repair-first gating before any GEMS-repair Gemini call; (b) client-side `parseAndValidateGemsJson` pre-flight before even attempting deterministic repair, so an already-valid paste never reaches the network (`VideoDetailPanel.jsx:6863-6870`); (c) `GEMINI_MOCK` short-circuit for `/api/analyze-video` only; (d) `getAiAnalysis(selectedVideo.id)` cache check before calling `analyzeVideoWithAI` in `TopicLearningPage.jsx:616-618`.

**Exhaustive automatic-paid-call audit.** Every function performing a Gemini network call was traced back to *every* call site in the React tree, specifically searching for any `useEffect` that could invoke them. **Result: every Gemini-paid-call path in this repository requires an explicit user click; zero automatic-on-mount, on-timer, or on-dependency-change paid Gemini calls were found.**

1. **`handleGeminiContent()`** (`VideoDetailPanel.jsx:8641`) → `/api/gemini-video-content`. Three call sites, all real `<button onClick={...}>` elements (`:10300,10933,12176`), `disabled={geminiStatus==='loading'}`. No `useEffect` in the file calls it.
2. **`handleAnalyzeVideo()`** (`TopicLearningPage.jsx:612`) → `analyzeVideoWithAI()` (`src/api/functions.js:19`) → in dev (or Base44-fallback) reaches `/api/analyze-video`. Four `onClick` call sites (`TopicLearningPage.jsx:1267,1521,1601,1941`). `legacyHandleAnalyze()` (`VideoDetailPanel.jsx:7521`), which also calls `analyzeVideoWithAI`, has **zero other references anywhere** — confirmed dead/unreferenced, cannot fire.
3. **`handleGeneratePoliticalSummary()`** (`VideoDetailPanel.jsx:4413-4451`) → `/api/political-summary`. Bound to three `onClick` sites (`:10510,10543,10704`). A sibling `useEffect` (`:4465-4513`, deps `[video?.id, video?.youtubeId, effectiveGemInfo?.gemKey, resolvedVideoMode.mode]`) was read in full: it **never** calls `fetch('/api/political-summary')` or the handler — it only builds a free local fallback object from already-persisted fields when transcript is absent, deferring to the button when a transcript *is* present. Corroborated by an in-code comment (`:4460-4463`) citing a prior-incident tag `YMD-POLITICAL-AUTOFIRE-STOP` stating this effect does NOT auto-fire the paid request — verified by reading the actual effect body, not just trusting the comment. This is a real prior-bug marker, flagged for regression-focused review in §5.4.
4. **`handleGenerateHebrewTitles()`** (`:4181-4230`) → `/api/gemini-hebrew-titles`. Single `onClick` site (`:11303`). 45,000ms `AbortController` timeout, not an auto-trigger.
5. **`handleRunAiDiagnosis()`** (`AiMappingModal.jsx:1120-1165`) → `/api/gemini-ai-mapping-diagnosis`. Single `onClick` site (`AiMappingModal.jsx:1230`). `AiMappingModal.jsx` has **zero `useEffect` hooks** — fully click-driven, and the modal itself only opens via `onClick={() => setShowAiMapping(true)}` (`VideoDetailPanel.jsx:10120`), so two explicit clicks are required end-to-end.
6. **`handleAiRepairGemsJson()`** → `requestGemsJsonRepair()` → `/api/gemini-repair-json`/Base44 `RepairGemsJson`. Single `onClick` site (`VideoDetailPanel.jsx:13996`). Pre-checks client-side before any network call, proceeds only on explicit invocation.
7. **`fetchGeminiBasicSummary()`** (`src/services/geminiVideoContent.js:1-21`) and **`analyzeVideoWithGemini()`** (`src/ai/gemini/analyzeVideoWithGemini.js:46-89`) — both **confirmed dead code**, zero call sites anywhere outside their own definitions. `/api/gemini-basic-summary` is **not a registered route** in `vite.config.js` — calling it would 404. Neither can fire, automatically or otherwise.
8. The "GEM" quick-copy flow (`handleGemButtonClick`, `VideoDetailPanel.jsx:1418-1447`) is **not a Gemini API call at all** — it copies the transcript+prompt to the clipboard and opens `gemini.google.com` in a new tab via `openGeminiGemUrl()` (`src/lib/gemsConfig.js:130`, `window.open(..., "_blank", "noopener,noreferrer")`). No request goes through this app's own `GEMINI_API_KEY`.

No `useEffect` anywhere in `VideoDetailPanel.jsx`, `TopicLearningPage.jsx`, or `AiMappingModal.jsx` calls any of the seven live Gemini-call functions. **The project's "no automatic paid AI call" rule is verified as currently upheld**, with item 3 flagged as worth periodic re-verification given it previously had an auto-fire bug per its own cited incident tag.

### 3.6 Environment variables (names only; values `[REDACTED]`)

| Var name | Read at (file:line) | Client-bundle exposed? |
|---|---|---|
| `GEMINI_API_KEY` | `vite.config.js:464,619,1129,2003,2085`; `src/server/gemsJsonRepairProvider.js:64`; `backend/repair-gems-json.function.js:232` | **No** — never `VITE_`-prefixed, never referenced via `import.meta.env` anywhere in `src/`. |
| `GEMINI_REPAIR_MODEL` | `vite.config.js:727`; `backend/repair-gems-json.function.js:234` | No — server-side only. |
| `GEMINI_MOCK` | `vite.config.js:643` | No — server-side only; referenced only inside client-facing error-message *text* (not an env read) at `VideoDetailPanel.jsx:7590,8094`. |
| `VITE_GEMINI_POLITICAL_GEM_URL`, `VITE_GEMINI_FUNDAMENTAL_GEM_URL` | `src/config/geminiGems.js:14,19` | **Yes, by design** — public Gemini Gem *web-UI URLs* (not API keys), intentionally client-visible for the paste-flow buttons; see §5.3 for the PII/privacy caveat on these specific values. |
| `ANTHROPIC_API_KEY` / `VITE_ANTHROPIC_API_KEY` (fallback pair) | `vite.config.js:821,972` (`env.ANTHROPIC_API_KEY \|\| env.VITE_ANTHROPIC_API_KEY`); `backend/generate-row-timestamps.function.js:211`; `backend/analyze-video.function.js:298` | No confirmed client exposure — zero matches for `import.meta.env.VITE_ANTHROPIC_API_KEY`/`import.meta.env.ANTHROPIC_API_KEY` anywhere in `src/`. **Naming risk flagged in §5.2/§5.3**: `.env.example`/`.env.local.example` document only the `VITE_`-prefixed form, contradicting this project's own stated intent that the unprefixed variable is the deliberate, safe choice. |
| `ANTHROPIC_MODEL` | `vite.config.js:829,973`; both `backend/*.function.js` files — default `'claude-sonnet-4-6'` if unset | No — server-side only. |

This project also calls a Claude/Anthropic API server-side, exactly as its own docs claim: `vite.config.js:832` and `:1042` both `fetch('https://api.anthropic.com/v1/messages', ...)` from `makeRowTimestampsPlugin`/`makeClaudeVideoAnalyzePlugin` respectively, mirrored in `backend/analyze-video.function.js`/`backend/generate-row-timestamps.function.js`. This is outside this section's Gemini scope beyond this confirmation — it is directly relevant to §3.6's env-var table and to §5.2's CLAUDE.md-drift finding.

**No hardcoded secret values were found anywhere in the Gemini/Claude integration layer** — every API key is read from an environment variable name, never a literal string, in every file inspected.

---

## 4. State & component mapping

**תקציר (עברית):** קיימות שתי גישות state לא-עקביות (React Query לוידאו/מנטורים/נושאים, מול useState+reload ל-Workspace). ה-store המרכזי של רשומות-וידאו (`yt_mentor_videos_v2`) עוקף לגמרי את שכבת ה-IndexedDB/generation — נכתב/נקרא ישירות מ-localStorage בשני מצבי האחסון. ה-store הקנוני של תמלולים ב-IndexedDB קיים בקוד אך יתום לגמרי (אפס צרכנים חיים).

### 4.1 Global state inventory

| Store/hook/context | Owns | Defined at | Pattern |
|---|---|---|---|
| `useVideos()` (+ `useSaveVideo`, `useUpdateVideo`, `useDeleteVideo`, `useAssignTopics`, `useUpdateLearningStatus`) | video records | `src/hooks/useVideos.js:1-14,41-67` | TanStack React Query, `queryKey:['videos']` (`:43-44`), backed by `@/lib/localVideoStore` + optional Base44 `Video` entity gated by `isBase44Enabled` (`:2-3,11`) + `@/data/mockData` fallback |
| `useMentors()` | mentor/channel records | `src/hooks/useMentors.js:65-81` | React Query, `queryKey:['mentors']`/`['mentors','active']` |
| `useTopics()`, `useCategories()` | topic/category taxonomy | `src/hooks/useTopics.js`, `src/hooks/useCategories.js` | React Query pattern (consistent import style in `App.jsx:8-9`; not fully re-read line-by-line — `UNVERIFIED` beyond that) |
| `useWorkspaceItems()`/`useWorkspaceTopics()` | Workspace Library items + topics | `src/hooks/useWorkspaceLibrary.js:14-40+` | **Not** React Query — plain `useState`+manual `reload()` wrapping `@/lib/workspaceLibraryStore` and `@/lib/persistence/workspacePersistence` — a second, inconsistent state-management pattern alongside the React-Query one |
| `useWorkspaceDays()` | Workspace "day" grouping | `src/hooks/useWorkspaceDays.js` | not traced in depth |
| `useTheme()` | dark/light mode | `src/hooks/useTheme.js:11-30` | `useState` + `localStorage` key `"youtubeMentor.theme"` (`:3,7,17`), instantiated once (`App.jsx:156`), then **prop-drilled** through `AppLayout` → `AppSidebar`/`PageComponent` (`App.jsx:115-143`) rather than via context |
| `useFilters()` | — | `src/hooks/useFilters.js` | **Dead code** — zero importers anywhere in `src/`. `App.jsx` reimplements equivalent filter state manually (`DEFAULT_FILTERS`, `useState`, `updateFilters`, `App.jsx:17-29,79-86`) instead of using this hook |
| `queryClientInstance` | React Query cache root | `src/lib/query-client.js`, provided at `App.jsx:159` | shared client for `useVideos`/`useMentors`/`useTopics`/`useCategories` |
| `UniversalTabBulkContext` | cross-tab multi-select/bulk-save state inside the video panel | `src/context/UniversalTabBulkContext.jsx`, provided `VideoDetailPanel.jsx:10341-10348`, closed `:12879` | React Context, scoped to one open `VideoDetailPanel` instance |
| `WorkspaceRecordRevealContext` | "reveal newly saved record" highlight | `src/context/WorkspaceRecordRevealContext.jsx`, used `WorkspaceLibrary.jsx:62` | React Context, scoped to `WorkspaceLibrary` |
| `localKnowledgeItemStore` ("Brain") | personal-knowledge-item store | `src/lib/localKnowledgeItemStore.js` (`upsertKnowledgeItem`, `getKnowledgeItems`, `hasKnowledgeItem`, `updateKnowledgeItemsForVideo`) | called **directly from components** (`SaveToBrainModal.jsx:10-14,144`; `VideoDetailPanel.jsx:100,4567,4619,4684,5207,5963,6246`) — no hook/facade wraps it |
| `AppSidebar`'s topic-order state | drag-reorder persistence for the sidebar topic list | `AppSidebar.jsx:32-37` (`ORDER_KEY="ym_topic_order"`) | component-local `localStorage.setItem`, with **no store facade at all** — the only persistence in the reviewed code not routed through a `lib/*Store.js` module |

### 4.2 Persistence

**The core data model — where video/analysis records actually live:** the authoritative key is **`yt_mentor_videos_v2`**, a plain `localStorage` key holding a JSON array of video objects.
- `const STORAGE_KEY = "yt_mentor_videos_v2";` — `src/services/videoStorage.js:17`.
- Written via `localStorage.setItem(STORAGE_KEY, serialized)` with an explicit read-back check (throws if `localStorage.getItem(STORAGE_KEY) !== serialized`) — `videoStorage.js:161-190` (`saveVideos`).
- Read via `localStorage.getItem(STORAGE_KEY)` — `:42-49` (`loadVideosRaw`).
- `src/hooks/usePersistedVideo.js:5` **duplicates the same key as a local constant** and reads/writes it directly, independent of `videoStorage.js` (read `:7-16`, write via `updateStoredVideo` imported from `videoStorage.js`, `:3,46`).

**Record shape** (inferred from fields read/written/deleted — no separate JSON schema file exists; `**/entities/Video*.json` glob returns nothing): identity/dedup (`id`, `url`, `videoId`, `youtubeId`); lifecycle/TTL (`fetchedAt`, `addedAt`, `addedManually`, `isPermanent`, `unpinnedAt`, `deleted`, `isDeleted`, `deletedAt`, `restoredAt`, `updatedAt`, `videoStorage.js:194-207,473-510`); analysis state (`analysisStatus`, `analyzedAt`, `aiChapters`, `chapters`, `descriptionChapters`, `chapterSource`, `chapterStatus`, `shortSummary`, `fullSummary`, `aiSummary`, `aiSummaryShort`, `aiSummaryLong`, `:88-135,254-343`); heavy/auto-stripped fields (`transcript`, `manualTranscript`, `whisperTranscript`, `transcriptSegments`, `description` — listed as `LARGE_VIDEO_FIELDS`, auto-deleted once `analysisStatus==='analyzed'`, `:307-340,720-767`; transcript text itself is deliberately kept unless the user explicitly deletes it, comment `:305`).

**Critical finding — the core video store never goes through the app's IndexedDB/generation machinery.** `videoStorage.js`/`usePersistedVideo.js` call the global `localStorage` object directly; neither imports `storageMode.js`, `storageFacade.js`, or `appDataDb.js`. Proven by grep: `storageFacade` is imported only by `src/lib/persistence/storageFacade.js` (self), `marketBriefCanonicalStore.js`, `fearGreedStore.js`, `aaiiWeeklySentimentStore.js` — never by `videoStorage.js`/`usePersistedVideo.js`. `APP_DATA_STORES.VIDEOS` (the IndexedDB `videos` object store) is referenced only in `storageMigration.js`/`appDataDb.js` (schema creation) — nothing in `src/` reads records back out of it at runtime. **`yt_mentor_videos_v2` in raw `localStorage` is the sole runtime-authoritative store for video/analysis records, in both `localStorage` and `indexedDB` app-storage modes.** The one-time migration copies this key into the IndexedDB `videos` store as a write-only archival projection — nothing reads it back; it is dead data once written.

A second, independent localStorage cache exists for AI analysis on a different screen: `ai_analysis_${videoId}` (`src/lib/aiAnalysisStore.js:5`), shape `{shortSummary, fullSummary, keyPoints, tags, savedAt}` (`:1-3`), write `:22-33` (generic `try/catch`, **no read-after-write verification, no quota classification** — unlike every other store below). Consumers: `src/pages/TopicLearningPage.jsx:475,617,660`; cleared on fresh re-import by `src/lib/videoFreshImport.js:146`. A third cache-key family, `analysis:${id}`, follows the same pattern (`src/pages/Dashboard.jsx:895-896`, `src/lib/gemsAnalyzedStatus.js:89`, `src/lib/videoFreshImport.js:186-189`).

**Full localStorage key inventory (manifest-declared):** `src/lib/persistence/storageManifest.js` is the declared source of truth. `LOCAL_STORAGE_FIXED_KEYS` (`:17-85`) is a frozen array — the file enforces its own length: `if (LOCAL_STORAGE_FIXED_KEYS.length !== 67) throw ...` (`:194-196`) — **exactly 67 entries as of HEAD, not 66** (a stale figure that circulated in some project documentation; flagged, not corrected here). `LOCAL_STORAGE_DYNAMIC_PREFIXES` (`:87-101`) covers 12 per-video/per-topic prefixes (`analysis:`, `ai_analysis_`, `app_builder_gem_paste_`, `market_brief_`, `gems-paste-`, `gems-applied-`, etc.). `isSensitiveStorageKey` rejects `token`/`base44_access_token`/`base44_*`/`*access_token*`/`oauth`/`api_key`/`password`/`secret`/`private_key` (`:145-155`) — these sensitive key **names** appear as literal strings in `LOCAL_STORAGE_FIXED_KEYS` but are excluded from both `listOwnedStorageKeys` and `isApplicationOwnedStorageKey` (`:159,182`), so never captured by the migration snapshot. Direct `localStorage.setItem/getItem/removeItem` calls exist in **48 files** under `src/`; only the ones central to this audit's scope were read in depth — the rest (`localNoteStore.js`, `knowledgeLibrary.js`, `localCustomMentorsStore.js`, `mentorTopicOverrides.js`, `localChunkStore.js`, `youtubeChapterCache.js`, `manualFinvizMappings.js`, etc.) are `UNVERIFIED` beyond what the manifest declares.

**IndexedDB `yt_mentor_app_data_v1`:** `APP_DATA_DB_NAME='yt_mentor_app_data_v1'`, `APP_DATA_DB_VERSION=2` (`storageManifest.js:1-2`). Object stores (`:4-15`, schema in `appDataDb.js:31-91`): `meta`, `sourceEntries` (keyPath `[generationId, storageKey]`), `videos`/`analyses`/`transcripts`/`workspaceItems`/`snapshots`/`mediaBlobs` (keyPath `[generationId, id]`), `migrationJournal`, `workspaceChangeJournal`. Gated by `getApplicationStorageMode()`, reading `import.meta.env.VITE_YTMDB_STORAGE_MODE`, **defaulting to `localStorage` when unset** (`storageMode.js:6-14`). This dev machine's actual configured mode is `indexedDB` (via `.env.development.local`, machine-local, git-ignored, confirmed present) — a fresh checkout without that file runs in `localStorage` mode by default. What a deployed Base44 production build's env var is set to is `UNVERIFIED` — out of reach from this repo.

**Origin-allowlist / dual-write facade.** `storageFacade.js`'s `createStorageFacade({repository, localStorageArea, allowLocalStorageWriteFallback=false})` (`:22-127`): `getRaw` tries IndexedDB `sourceEntries` first when a generation is active, falls back to `localStorage` on IDB miss/failure ("Read compatibility is deliberately localStorage-first after an IDB failure", `:49`); `setRaw` rejects sensitive/unowned keys outright (`:66-71`), writes straight to `localStorage` with no active generation (`fallbackUsed:true`, `:74-82`), or writes to `sourceEntries` with a SHA-256 read-after-write check when a generation is active, returning `{ok:false, code:'indexeddb-...'}` on failure rather than silently falling back (all three real consumers set `allowLocalStorageWriteFallback:false`, e.g. `marketBriefCanonicalStore.js:40-45`). **Used by exactly three canonical stores** — `marketBriefCanonicalStore.js`, `fearGreedStore.js`, `aaiiWeeklySentimentStore.js` — never by `videoStorage.js`.

`AUTHORIZED_TRANSCRIPT_LOCAL_STORAGE_ORIGINS` and `transcriptLocalStorageStore.js` exist as this project's own docs describe, verified line-by-line: `Object.freeze(['http://127.0.0.1:5184', 'http://localhost:5184'])` (`transcriptLocalStorageStore.js:4-7`). `getTranscriptPersistenceDecision()` **forces** `backend:'localStorage'` when `location.origin` is in that allowlist, regardless of requested backend (`:13-29`). This is an enforced guard, not merely computed and ignored: `src/services/youtubeTranscript.js:31-40`'s `assertLocalStorageTranscriptBackend()` **throws** `TranscriptLocalStoragePersistenceError` if the resolved backend isn't `localStorage`, called at `:273` immediately before the cache read/fetch/write sequence (`:279-336`). **Consequence, proven:** on this dev machine, even though app-wide storage mode is `indexedDB`, transcript persistence is *forced* to `localStorage` because the dev origin is on the transcript allowlist. Quota handling: `isQuotaExceeded(error)` checks `error.name==='QuotaExceededError' || error.code===22 || error.code===1014` (`:39-43`); strict read-before-write (throws `localstorage-cache-invalid` rather than silently overwrite an unreadable cache, `:79-86,151`) and read-after-write mismatch check (`:156-160`); on quota failure throws with Hebrew message `'הורדת התמלול הצליחה, אך localStorage מלא ולכן התמלול לא נשמר. לא דווחה הצלחה.'`, `code:'localstorage-quota-exceeded'` (`:163-172`).

**Critical finding — the canonical IndexedDB transcript store is orphaned code.** `src/lib/persistence/transcriptCanonicalStore.js` fully implements `readCanonicalTranscript`/`writeCanonicalTranscript`/`deleteCanonicalTranscript` against IndexedDB (`:80-142`), but a repo-wide grep for calls to these three exports finds **only the function definitions themselves** plus assertions inside `scripts/youtube-transcript-persistence-qa.mjs:129,135-136` that expect `VideoDetailPanel.jsx` to call them. Direct inspection of `VideoDetailPanel.jsx`'s imports confirms it imports only `readTranscriptLocalCache` from `transcriptLocalStorageStore` (`:187`) — zero occurrences of any canonical-store function anywhere in the file. The live transcript write path is entirely `writeTranscriptLocalCache`, called from `youtubeTranscript.js:328`, guarded by the origin-forced-localStorage check above — not the canonical IndexedDB path the QA script's assertions describe. This QA script (`scripts/youtube-transcript-persistence-qa.mjs:129-136`) is very likely failing against current source, or asserting a drifted integration point — not executed in this audit (out of read-only scope), so only the call-site absence is confirmed, not a live red/green result (§5.4).

**Generation-based migration/versioning** (`src/lib/persistence/storageMigration.js`): states `copying → verifying → ready → active` (+`failed`, `:17-23`). Step 1: `captureStableLocalStorage` requires an identical hash across two reads or throws (`:71-81`). Step 2: `buildMigrationProjectionRecords` classifies each entry by `classifyStorageKey` and projects into the matching IndexedDB shape (`:103-127`). Step 3: batched (default 25, range 1-100, `:226-228`), idempotent, journaled, resumable copy with SHA-256 read-back verification (`:258-279`). Step 4: full-generation verification — actual record count and canonical hash must match the expected projection per store, else the migration is marked `failed` (`:293-345`). Activation (`:369-512`) requires a verified backup, verified preflight (`stableReadCount>=2`, `storageMode==='localStorage'`, `activeGenerationAbsent===true`), and a verified integrity snapshot, all cross-referencing matching hashes for the exact ready generation — `appDataDb.js`'s `activateGeneration` (`:308-403`) additionally refuses if an active-generation pointer already exists. **What triggers it:** only an explicit DEV action via `src/dev/ytmdbOriginMigrationController.js` (governance-gated per this project's protected-settings scope) — nothing in `src/main.jsx`/app bootstrap calls `migrateLocalStorageToIndexedDb` (confirmed by grep, only callers are its own definition file and the DEV controller).

**Market-brief dual-write, actually exercised (contrast with the core-video-store finding above):** `writeCanonicalMarketBrief(videoId, next)` (call sites `VideoDetailPanel.jsx:2828,6553,6640`) → `getRuntimeStore()` resolves storage mode and writes via `facade.setRaw` under key `market_brief_${videoId}` (`marketBriefCanonicalStore.js:8-31,124-128`) — **the sidecar and the canonical value share one literal key name**, differentiated only by which storage engine currently holds it. Read back via `readCanonicalMarketBrief(videoId)` (`:130-155`), called from `VideoDetailPanel.jsx:2585` and `src/lib/canonicalVideoAnalysisHydration.js:3,14`. A one-time sidecar-retirement migration (`marketBriefSidecarMigration.js:37-117`, DEV-triggered, not on startup) scans leftover localStorage sidecars, writes them into the canonical store, verifies a canonical read-back, and only then removes the sidecar (`:105-113`) — a failed verify leaves the sidecar in place.

**Quota-exceeded handling, summary across stores:** `videoStorage.js:174-188` sets `lastVideoStorageWriteError.classification='quota-exceeded'`, returns `false`, does not throw. `transcriptLocalStorageStore.js:39-43,161-173` throws with explicit Hebrew "success was not reported" wording. `workspaceLibraryStore.js:45-46,167-179` classifies via `WORKSPACE_PERSISTENCE_ERROR_CODES.QUOTA_EXCEEDED`, attempts a verified rollback to the previous raw value. `storageFacade.js:104-118` returns `{ok:false, code:'indexeddb-quota-exceeded'}` (or the matching classified code) without silent degradation. **The one exception:** `src/lib/aiAnalysisStore.js:22-33` (`ai_analysis_${videoId}`) — generic `try/catch`, only `console.warn(e.message)`, no quota classification, no returned status code, no read-after-write check — a caller cannot distinguish success from silent quota failure.

**BroadcastChannel cross-tab sync** (`storageEvents.js`, `APP_DATA_EVENT_CHANNEL`) is scoped to Workspace only — imported only by `workspacePersistence.js`/`workspaceDayPersistence.js` — video, transcript, and market-brief writes in one tab do **not** broadcast to other open tabs.

### 4.3 Data-flow diagrams

**App-state layer (Gemini response → screen), architect-reviewer's segment:**
```
Gemini response received
  → src/services/geminiVideoContent.js :: fetchGeminiVideoContent()   [§3.2 item 1 — handoff]
  → normalizer(s): validateAiAnalysisQuality(), normalizeTranscriptBackedChapters(),
    validateChaptersForSave()                                         [VideoDetailPanel.jsx:8696-8717]
  → patch object                                                      [VideoDetailPanel.jsx:8720+]
  → persisted record: yt_mentor_videos_v2 in localStorage (§4.2)
       (facade: src/hooks/useVideos.js, queryKey:['videos'])
  → hook: useVideos() (React Query cache)                             [useVideos.js:41-67]
  → screen: Dashboard.jsx (videos list + VideoDetailPanel selectedVideo state)
       also: WorkspaceLibrary.jsx, SavedVideos.jsx, LearningQueue.jsx,
             KnowledgeSearch.jsx, KnowledgeLibrary.jsx — all independently
             import & mount VideoDetailPanel (§4.5)
  → panel: VideoDetailPanel.jsx (activeTab state, UNIVERSAL_TABS, §1.3)
  → tab: extractVideoTabItems(video, activeTab, marketBriefData)      [videoTabsConfig.js:653+]
  → row component: e.g. summary-card blocks (VideoDetailPanel.jsx:10645-10684),
       SpecializedContentRenderer for 'specialized' tab                [SpecializedContentRenderer.jsx:77+]

Parallel branch — GEM JSON paste (§2.8 chain B):
  user paste → gemsPasteInput (local state)
  → parseAndValidateGemsJson() [gemsJsonRepair.js]
  → _applyParsedGems() (VideoDetailPanel.jsx:6533) → same patch/persist path as above

Parallel branch — "save to X" per-card dropdown (§1.10 flows d/e/f):
  handleSavePsSectionTo(dest) (VideoDetailPanel.jsx:4573)
    dest='brain'     → handleSavePsSection() → upsertKnowledgeItem()      [localKnowledgeItemStore.js]
    dest='workspace' → upsertKnowledgeItem() directly (VideoDetailPanel.jsx:4619)   ⚠ same store as 'brain', NOT workspaceLibraryStore
    dest='obsidian'  → downloadMarkdown() [obsidianExport.js]
  → WorkspaceLibrary.jsx reads only via useWorkspaceItems()/workspaceLibraryStore — never localKnowledgeItemStore
    (grep for localKnowledgeItemStore/getKnowledgeItems in useWorkspaceLibrary.js and WorkspaceLibrary.jsx: 0 matches)
```

**Persistence-layer segment (persistence-storage-engineer, three concrete paths):**

*Path A — core video/analysis record (dominant, always-localStorage):*
1. Normalized video object → `updateStoredVideo(id, updates)` (`videoStorage.js:256-343`).
2. Merges patch into in-memory array from `loadVideosRaw()` (`:42-49`), calls `saveVideos(videos, {...})` (`:302,338`).
3. `saveVideos` → `localStorage.setItem('yt_mentor_videos_v2', serialized)` + read-back check; on failure sets `lastVideoStorageWriteError` and returns `false`, no throw (`:161-190`).
4. Read back by `usePersistedVideo(videoId)` (independent `getItem`+`find`, `:7-16,28,41`), `loadVideos()` for lists (`:80-142`), and React Query's `['videos']` cache (invalidated after every write, `usePersistedVideo.js:53`).
5. IndexedDB is touched only if the DEV-gated migration runs; its `videos` store copy is never read back (§4.2).

*Path B — market brief (dual-write-capable, actually exercised):*
1. Parsed market-brief payload → `writeCanonicalMarketBrief(videoId, next)` (`VideoDetailPanel.jsx:2828,6553,6640`).
2. → `getRuntimeStore()` resolves mode, opens/reuses a lazily-cached IndexedDB repository if `indexedDB` mode (`marketBriefCanonicalStore.js:14-31,124-128`).
3. `store.write` under key `market_brief_${videoId}` — IndexedDB `sourceEntries` with SHA-256 verification, or direct `localStorage.setItem` under the same key string if no active generation (`storageFacade.js:76-82,94-103`).
4. Read back by `readCanonicalMarketBrief(videoId)` (`:130-155`, called `VideoDetailPanel.jsx:2585` and `canonicalVideoAnalysisHydration.js:3,14`).
5. Sidecar-retirement migration (§4.2) reconciles leftover localStorage sidecars into the canonical store, DEV-triggered.

*Path C — transcript (origin-forced localStorage-only in the actual dev/e2e environment):*
1. Fetched payload built in `fetchTranscriptPayload` (`youtubeTranscript.js:301-328`), after `assertLocalStorageTranscriptBackend()` (`:273`) confirms/forces `localStorage`.
2. `writeTranscriptLocalCache(videoId, payload)` (`:328`) → strict read-before-write, merge, write, read-after-write check, quota classification (`transcriptLocalStorageStore.js:147-183`).
3. Read back by `readTranscriptLocalCache(videoId, {maxAgeMs})` (`youtubeTranscript.js:100,279`) and directly by `VideoDetailPanel.jsx:2337` for bulk existence checks.
4. The parallel canonical `transcriptCanonicalStore.js` IndexedDB path exists in code but has no live producer/consumer wiring it into this flow (§4.2).

### 4.4 Screen → reads/writes/owns table

| Screen | Reads | Writes | Components it owns (not shared) |
|---|---|---|---|
| `Dashboard.jsx` | `useVideos()`, `useMentors()`, `useTopics()`, `useWorkspaceItems()` (Workspace KPI count, `:53,510`), channel-scan state (`getChannelScanState`, `:44-47,504`), storage-meter state (`:48-52,507-521`) | video saves/deletes/learning-status/topic-assign (React Query mutations, `:582-586`), localStorage cleanup (`cleanStorageCaches`, `stripEmbeddedTranscripts`, `:532-555`) | `SmartDashboard`, `DashboardStorageMeter`, `DashboardSkeleton` (all defined in-file, `:132-487`) |
| `WorkspaceLibrary.jsx` | `useWorkspaceItems()`, `useWorkspaceTopics()`, `useVideos()`, `useMentors()`, `useTopics()` (`:95-99`) | workspace item CRUD/bulk ops (`updateItem`, `deleteItems`, `archiveItems`, `reassignVideoGroupTopic`, all from `useWorkspaceItems()`), workspace topic CRUD (`useWorkspaceTopics()`) | `WorkspaceCollectionTiles`, `WorkspaceScopeTiles`, `WorkspaceDay`, `WorkspaceVideoGroupCard`, `WorkspaceFocusedVideoCard`, `WorkspaceBulkActionBar`, `WorkspaceTopicManager`, `WorkspaceSemanticFilters`, `WorkspaceBriefRoutingPreview`, `WorkspaceDuplicatePreview` (`:19-47`) — **but also mounts a shared `VideoDetailPanel`** (§4.5) |
| `VideoDetailPanel` (not a screen, a shared overlay) | the `video` prop from its host page; `marketBriefData` from localStorage-backed `gems-paste-{id}` and related keys (§4.2); `localKnowledgeItemStore.getKnowledgeItems()` (`:100`) | `saveVideoFields` (patch propagated back via `onVideoPatch`/`onAnalyzeDone` props, e.g. `Dashboard.jsx:1405-1406`), `upsertKnowledgeItem` (brain + mislabeled quick-workspace items), `workspaceLibraryStore` (via `SaveToWorkspaceDialog`), `/api/vault/write` (Obsidian) | dozens of tab-local sub-components (not exhaustively enumerated — file is ~12,900 lines) |

### 4.5 Cross-component coupling

- **`VideoDetailPanel.jsx` is imported independently by 6 different pages**: `Dashboard.jsx:28`, `WorkspaceLibrary.jsx:32`, `SavedVideos.jsx:4`, `LearningQueue.jsx:4`, `KnowledgeSearch.jsx:7`, `KnowledgeLibrary.jsx:6`. Each host page owns its own `selectedVideo`/`panelOpen` state and passes a different combination of props/callbacks (not diffed in full here). Since it's one ~12,900-line component with a single shared `UNIVERSAL_TABS` bar and dozens of internal handlers, a change made to satisfy one host screen's needs risks regressing the other five — the single largest coupling point in the codebase by import fan-in.
- **`extractVideoTabItems()` (`videoTabsConfig.js:653+`) is imported by 10 different modules**: `AiMappingModal.jsx:5`, `MacroGemDashboard.jsx:11`, `MorningBriefDashboard.jsx:1`, `MorningBriefPanels.jsx:109`, `SpecializedContentRenderer.jsx:8`, `VideoDetailPanel.jsx:139`, `morningBriefBulkSections.js:5`, `rowExtraction.js:11`, `runtimeTabsAudit.js:5`, `universalTabSections.js:5`. Every field-name or fallback-priority change inside its `switch` (`:659-1259`) is a single choke point shared by the video panel, the Morning/Evening/Macro brief dashboards, and multiple export/audit utilities simultaneously.
- **`workspaceHeadingRegistry.js`'s `DEFINITIONS`/`VIDEO_ANALYSIS_HEADINGS`** drive both the video-panel tab bar (`UNIVERSAL_TABS`, §1.3) *and* the Workspace-Library collection tiles (`WORKSPACE_COLLECTION_HEADINGS`, §1.8). Renaming a `sourceTabId`/`label` here simultaneously changes the video-detail tab bar and the Workspace Library taxonomy — one edit, two independent UI surfaces as blast radius.

### 4.6 Known architectural defects

Each with citation and status as of HEAD `be1a70d`:

1. **Two different persistence stores both labeled "Workspace" in the UI, one of which never reaches the actual Workspace Library screen.** `SaveToWorkspaceDialog` writes to `@/lib/workspaceLibraryStore` (`:18`), read by `WorkspaceLibrary.jsx` via `useWorkspaceItems()`. But the per-card "⭐ שמור ל-Workspace" quick-save (`VideoDetailPanel.jsx:10666`, handler `:4573-4619`) writes via `upsertKnowledgeItem()` into `@/lib/localKnowledgeItemStore` instead (`:4619`). Confirmed by grep: neither `WorkspaceLibrary.jsx` nor `useWorkspaceLibrary.js` reference `localKnowledgeItemStore`/`getKnowledgeItems` at all. **Status: present as of HEAD.**
2. **Non-political videos' per-card "save to brain" action mislabels content as political.** `handleSavePsSectionTo`'s `'brain'` branch calls `handleSavePsSection(sectionKey, sectionLabel, content)` without the optional `sectionTypeOverride` (`:4581`), so the default `sectionTypeOverride || 'politicalSummary'` (`:4521`) always resolves to `'politicalSummary'`, filed under `"פוליטיקה/…"` (`:4536-4549`) regardless of video category. Present on every summary card for every video type (the surrounding `TabsContent` is the generic `summary` tab, `:10401-11272`; only the extra `'opponent'` option is gated on `isPoliticalVideo`, `:10667`). **Status: present as of HEAD.**
3. **Undefined `POLITICAL_TAB_VALUES` reference**, likely runtime `ReferenceError` when `resolvedVideoMode.mode === "politics"` — `VideoDetailPanel.jsx:3068` (§1.5). **Status: present as of HEAD** (static evidence only — see §5.4).
4. **Dead tab-configuration subsystem**: 13 exported constants/functions in `videoTabsConfig.js` (§1.4) with zero importers outside their own file — a whole "per-video-type tab set" mechanism the actual rendered UI (fixed 7-tab `UNIVERSAL_TABS`) has superseded but was never removed. **Status: present as of HEAD.**
5. **Unreachable `brain-select` tab** (`VideoDetailPanel.jsx:12237-12333`, §1.5) — no `TabsTrigger`, no `setActiveTab("brain-select")` call anywhere in `src/`. **Status: present as of HEAD** (high-confidence, not 100% exhaustive per §5.4).
6. **Duplicated Obsidian-vault-write implementation**: `handleSaveAllConfirmed` (`:4740`) contains its own inline `fetch('/api/vault/write', …)` (`:4743`) instead of calling the shared `executeObsidianVaultWrite` helper (`:4973`, used correctly by 4 other call sites: `5523,5537,5561,13467`). Two independent implementations of the same vault-write/fallback logic, ~230 lines apart in the same file. **Status: present as of HEAD.**
7. **`useFilters()` hook is dead code** (`src/hooks/useFilters.js`, zero importers) — `App.jsx` reimplements equivalent filter state inline instead. **Status: present as of HEAD.**
8. **Two inconsistent state-management patterns for conceptually similar "collections of local records"**: `useVideos`/`useMentors`/`useTopics`/`useCategories` use TanStack React Query with `invalidateQueries` cache-busting, while `useWorkspaceItems`/`useWorkspaceTopics` use plain `useState`+manual `reload()`. Not necessarily a bug, but a real maintenance-cost inconsistency. **Status: present as of HEAD.**
9. **`AppSidebar`'s topic-order persistence bypasses every store facade in the app**, writing `localStorage` directly (`:32-37`) rather than through a `lib/*Store.js` module like every other persisted concern in this audit. **Status: present as of HEAD.**
10. **The core video/analysis store bypasses the entire IndexedDB/generation architecture** (§4.2) — the elaborate generation/activation/backup-evidence machinery protects a copy of video data that is never read back at runtime; it is a one-way, DEV-triggered archival snapshot, not an active dual-write target.
11. **The canonical IndexedDB transcript store (`transcriptCanonicalStore.js`) is orphaned relative to the live UI** (§4.2) — its own project QA script (`scripts/youtube-transcript-persistence-qa.mjs:129-136`) still asserts call sites that are textually absent from current `VideoDetailPanel.jsx` source.
12. **`ai_analysis_${videoId}` does not follow the write→verify→report contract used everywhere else in this persistence layer** (§4.2) — no read-after-write check, no quota classification, silent `console.warn`-only failure.
13. **Key-name collision between sidecar and canonical storage for market brief** (§4.2, Path B) — `market_brief_${videoId}` is the identical string whether the value lives in `localStorage` or IndexedDB `sourceEntries`; correctness depends entirely on consistent storage-mode/active-generation checks everywhere the key is read. No direct-`localStorage` reader under this prefix was found in `src/`, but not all 48 localStorage-touching files were individually verified (§5.4).

---

## 5. Risks, gaps and open questions

**תקציר (עברית):** סעיף זה מרכז: (א) סתירות וממצאים ארכיטקטוניים מאומתים מסעיפים 1-4, (ב) פערי תיעוד-מול-קוד, (ג) ממצאי אבטחה ייעודיים כולל אימות git שביצעתי בעצמי, (ד) נתיבים שלא נבדקו-רץ, (ה) שורות open-items-ledger.md שחופפות לנושאי הביקורת — לא טופלו, רק דווחו כנדרש, (ו) שאלות פתוחות הדורשות החלטת בעלים.

### 5.1 Architectural defects and contradictions (consolidated)

Numbered items 1-13 in §4.6 cover the state/persistence-layer defects in full; the GEM-layer and screen-layer contradictions are in §2 and §1 respectively. Consolidated list, most-actionable first:

1. Two parallel, disconnected GEM classification engines — `gemContentRouter.js` (dead, zero call sites) vs. `gemRecommender.js` (live) — §2.2. A future engineer reading `gemContentRouter.js`'s header comment alone (as this audit's own original task brief initially assumed, before verification) would be misled into thinking it's the live router.
2. `GEM-FUNDAMENTAL-INSTRUCTIONS.md`'s pasteable text is stale on two points, both already fixed in code: it bans `warnings` as unsupported (the field is displayed today, merged into "טעויות נפוצות") and tells the GEM tab 5/APP has no field (it does — `appBuilding.suggestedFeatures[]` is fully wired, §2.9). Docs are stale here; code is authoritative.
3. Likely runtime bug: undefined `POLITICAL_TAB_VALUES` reference in a reachable `useEffect` path (§1.5, §4.6 item 3) — static evidence only, not runtime-confirmed (§5.4).
4. Two different persistence stores both labeled "Workspace" in the UI (§4.6 item 1) — a per-card quick-save writes to the brain store, not the Workspace store, and never surfaces on the Workspace Library screen.
5. Non-political videos' "save to brain" action silently mislabels content as `politicalSummary` (§4.6 item 2).
6. The core video/analysis store (`yt_mentor_videos_v2`) entirely bypasses the app's own IndexedDB/generation architecture (§4.2, §4.6 item 10) — the elaborate migration/activation machinery protects data that is never read back.
7. The canonical IndexedDB transcript store is orphaned, with a project QA script asserting call sites that no longer exist in `VideoDetailPanel.jsx` (§4.2, §4.6 item 11).
8. A dead 13-constant/2-function "per-video-type tab set" subsystem in `videoTabsConfig.js`, fully superseded by the fixed 7-tab `UNIVERSAL_TABS` bar but never removed (§1.4, §4.6 item 4).
9. An apparently-unreachable `brain-select` tab with built UI (`VideoDetailPanel.jsx:12237-12333`) and no way to open it (§1.5, §4.6 item 5).
10. Duplicated Obsidian-vault-write implementation, ~230 lines apart in the same file (§1.10 flow f, §4.6 item 6).
11. No `DirectionProvider` at the app root for RTL — 491 manual `dir="rtl"` re-assertions across 134 files, with no structural safety net for a missed one on a new component (§1.9).
12. No nikud/Hebrew-final-letter-form normalization exists anywhere as a reusable pattern, should a future feature need Hebrew substring/equality matching beyond the one narrow, already-solved case (`hebrewSentimentTokenGuard.js`, §1.9).

### 5.2 Documentation/code drift

1. **CLAUDE.md's "approved AI settings" table does not match current `vite.config.js`.** This project's own `CLAUDE.md` and multiple `.claude/agents/*.md` files state `vite.config.js` contains Claude `max_tokens=8192`, `ANTHROPIC_MESSAGE_MS=600_000`, `server.httpServer.timeout=620_000`, `CHUNK_THRESHOLD=15_000`. A repo-wide grep for all four literals at HEAD `be1a70d` found **none of them present**. The actual Claude call (`makeClaudeVideoAnalyzePlugin`) uses `CLAUDE_ANALYZE_MAX_TOKENS=6_000` (`vite.config.js:909,1051`), has no chunking logic, and the `server:` config block only sets `port`/`strictPort`/`warmup` — no `httpServer.timeout`. Stated as a factual documentation/code discrepancy for the record; nothing was changed by this audit. **This is a live discrepancy the project's own protected-settings table should be reconciled against**, since agents and future sessions are instructed to treat that table as ground truth.
2. **The "transcript threshold 300 chars in `VideoDetailPanel.jsx`" claim** (repeated in this audit's own task brief and multiple `.claude/agents/*.md` files) has no matching literal in `VideoDetailPanel.jsx` (targeted grep for `\.length\s*[<>]=?\s*300\b` — zero matches). The 300-char gate that **does** exist is server-side, in `vite.config.js:554` (`/api/gemini-video-content` Stage-2 fallback). Likely a stale/imprecise doc pointer rather than a missing feature — not confirmed either way (§5.4).
3. **`VITE_ANTHROPIC_API_KEY` naming risk** (§3.6) — `.env.example`/`.env.local.example` document only the `VITE_`-prefixed fallback form, contradicting this project's own `CLAUDE.md` statement that the unprefixed `ANTHROPIC_API_KEY` is the deliberate, safe choice ("`ANTHROPIC_API_KEY` ללא prefix של `VITE_` — זה בכוונה"). No client-side code currently reads the `VITE_`-prefixed variable, so there is no active leak — but the template actively invites setting up the riskier variant.
4. **`LOCAL_STORAGE_FIXED_KEYS` count drift** — the code enforces exactly 67 keys (`storageManifest.js:194-196`, directly counted), while some project documentation quotes 66. Documentation is stale here, not the code.
5. **`GEM-FUNDAMENTAL-SCHEMA.md`'s internal line-number citations have drifted** by roughly 2-55 lines against live `videoAnalytics.js`/`videoTabsConfig.js` at HEAD `be1a70d` (§2.4's closing note) — the underlying logic was independently re-verified as correct; only line numbers moved, consistent with the doc's own repeated warnings that the tree was uncommitted/modified while it was written.
6. **`docs/gems/GEM-TECHNICAL-PREP-NOTES.md`'s claim about `indicators`/`setups`/`patterns` tab-4 section line numbers in `VideoDetailPanel.jsx`** (`~12560-12577`) was not independently re-opened and confirmed by this audit — the underlying `normalizeAiAnalysisResult` field mapping was verified directly (`videoAnalytics.js:1272-1274`), but the specific `VideoDetailPanel.jsx` render-site line numbers are relayed from that doc's own `git diff`-sourced claim, not independently re-derived (§2.10, §5.4).

### 5.3 Security findings

**Scope covered by this audit's redaction/security pass:** `.env*` files, `.env.example`/`.env.local.example`, `vite.config.js` (full), `backend/*.function.js`, `src/**` (env-var consumption via grep), `scripts/**`, `.github/workflows/e2e.yml`, `docs/gems/**`, a prior committed security audit (`docs/security-audits/2026-08-28-secrets-audit.md`, used as a dated corroboration baseline), `.gitignore`, `debug.log`, `.playwright-mcp/**`, `.codex-dev*.log`.

**Resolved during assembly of this document** (the security-scanning sub-agent had no git tool access and flagged the two items below as "critical, pending confirmation"; the orchestrating session ran the missing checks directly): `git ls-files .env .env.local .env.development.local` returns only `debug.log` — **`.env`, `.env.local`, and `.env.development.local` are not tracked by git**, and `git log --all --oneline -- .env` returns **no history at all** — this file was never committed to any branch, ever. This downgrades the two live-key findings below from "possibly leaked via git" to "real local-hygiene risk, never leaked via git." Separately confirmed via `git ls-files`: **`.playwright-mcp/` (247 files) and `.codex-dev*.log` (12 files) ARE still tracked in git**, despite being covered by `.gitignore` today (gitignore doesn't retroactively untrack already-tracked files) — the findings below about those directories are confirmed real, not hypothetical.

1. **[No longer git-exposed, but real local risk] `.env:3`, `.env:8`** — live-format Anthropic and Gemini API keys present in a plaintext, git-ignored, never-committed local file. Values: `[REDACTED]` (both). A plaintext key on disk is still a risk vector independent of git (backups, screen shares, other local tools indexing the folder) — recommend rotation as routine hygiene, not as an emergency, since git exposure is now ruled out.
2. **[Documentation drift, not a live leak] `.env.example:47`, `.env.local.example:25`** — template a `VITE_ANTHROPIC_API_KEY` entry that contradicts this project's own no-`VITE_`-prefix rule for the Anthropic key (see §5.2 item 3). `vite.config.js:821,972` and both `backend/*.function.js` files implement `env.ANTHROPIC_API_KEY || env.VITE_ANTHROPIC_API_KEY` fallback logic, actively supporting the discouraged variant. This exact issue is already recorded in a prior committed audit (`docs/security-audits/2026-08-28-secrets-audit.md:30`) and remains unresolved.
3. **[Confirmed real, low severity] `debug.log` (repo root)** — tracked in git, contains only benign Chromium/Electron GPU and DNS diagnostic lines (reviewed in full) — no secrets or PII. Repeats a prior audit's finding #8; `.gitignore` still has no entry for it.
4. **[Confirmed real, low severity] `.playwright-mcp/console-*.log`/`page-*.yml` (247 tracked files)** — `.gitignore` excludes this path going forward, but it was already tracked before that exclusion was added, so those 247 files remain in git history/index today. A prior audit found only non-sensitive content in this directory (a low-value Google front-end key, a localhost-only Vite HMR token) — content itself not re-read in full by this pass. This is the largest unbounded, automatically-generated capture surface in the repo and the standing highest-risk leak *channel* even though no current leak was found in it.
5. **[Confirmed real, low severity] `.codex-dev*.log` (12 tracked files, repo root)** — same pattern as above; a prior audit found the content clean (Vite startup errors, local paths, no keys/PII).
6. **[Definite, medium] Personal Gemini "Gem" URLs hardcoded as default fallback values directly in client-bundled source** — `src/lib/gemsConfig.js:4,20,21,22,26,27` (`MARKET_BRIEF_GEM_URL` and `defaultGems.fundamental/appBuilder/political/macro/news`), and the *same* values duplicated in `.env.example:40,43`/`.env.local.example:19,22` as non-placeholder template defaults (contradicting this project's own "`.env.example` holds only placeholders" rule), and referenced again in `docs/workspace-session-handoff.md:89,159` and `docs/plan/AUDIT-TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA.md:356`. All instances: `[REDACTED — private GEM URL]`. Whether a bare Gemini Gem link discloses anything sensitive is itself uncertain (Gemini Gems are typically access-controlled to the creator's account by default) — flagged per this audit's explicit redaction mandate regardless.
7. **[Definite, low] Developer's personal local Windows filesystem path (including Windows username) hardcoded in client-bundled source**, both as a default constant and as UI placeholder/instructional text — `src/lib/obsidianVaultDefaults.js:4,7`, `src/components/dashboard/ObsidianSettingsDialog.jsx:170`, `src/components/dashboard/ObsidianTechnicalGuide.jsx:15,127`. Not a credential, but a personal-machine identifier shipped in the client bundle and shown in user-facing UI text.
8. **[Definite, medium — dead config, not a live risk] `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_DRIVE_FOLDER_NAME`** declared in `.env.example:59-62` (with a corresponding `.gitignore` entry for `.gdrive-tokens.json`, `:12-13`) but **no consuming code found anywhere** in `backend/`, `vite.config.js`, or `src/` (full-repo grep, zero matches beyond the declaration). Not a leak, but unused/aspirational config a future contributor could populate with real OAuth credentials with no code path actually protecting or using them.
9. **No hardcoded secrets found** in application source — scanned via provider-format regexes (`sk-ant-api03-`, `AIza...`, `AKIA...`, `ghp_...`, `github_pat_...`, PEM private-key headers) across the full repo excluding `node_modules`/`.git`. The only match, `scripts/test-gemini-json-debug-report.mjs`, contains intentional fake fixtures used to test the project's own secret-redaction logic — confirmed a non-finding.
10. **No secrets/PII found in console/logger calls, CI config (`.github/workflows/e2e.yml`), or `.env.development.local`/`.env.local`** (the latter reviewed in full — one non-sensitive storage-mode flag, and empty, respectively) — each explicitly checked, not merely unmentioned.

**Env-var exposure summary (full table in §3.6):** the project's core rule — `ANTHROPIC_API_KEY`/`GEMINI_API_KEY` never reach the client bundle — **holds in practice today**, verified by grep for every `import.meta.env.<name>` reference across `src/`. The only client-exposed secrets-adjacent values are the two Gemini Gem URLs (§5.3 item 6, intentional by design) and the Obsidian vault path/name (intentional, low sensitivity) and YouTube API key (intentional by design, documented as needing HTTP-referrer restriction in Google Cloud Console — restriction status itself `UNVERIFIED`, no key currently present in `.env`).

### 5.4 Untested / unverified paths

This audit was static/read-only throughout — no build, dev server, or test run. The following are explicitly flagged as not runtime-confirmed:

1. The `POLITICAL_TAB_VALUES` `ReferenceError` (§1.5, §4.6 item 3, §5.1 item 3) — strong static evidence, needs a live repro (open/force a political-mode video) to confirm whether it actually throws, is silently swallowed by an error boundary, or is masked by something not found in this pass.
2. The unreachable `brain-select` tab (§1.5, §4.6 item 5) — confirmed via full-text grep for the literal string only; a programmatic tab-value construction (string concatenation building `"brain-select"` at runtime) would not be caught by that method.
3. Whether `src/ai/gemini/prompts/marketPrompt.js`/`schemas/marketSchema.js` are ever actually invoked from the `vite.config.js:490-600` automatic-analysis handler — not traced to closure (§2.8 chain A1). This matters because `marketSchema.js`'s example includes `riskRules`/`stocksMentioned` fields the normalizer never maps — if that schema does drive the automatic pipeline's expected output shape, that pipeline may be generating fields the app can't display.
4. Exact `VideoDetailPanel.jsx` line numbers for the technical-GEM-readiness `indicators`/`setups`/`patterns` tab-4 section array (§2.10, §5.2 item 6) — relayed from `GEM-TECHNICAL-PREP-NOTES.md`'s own claim, not independently re-opened.
5. Whether `scripts/youtube-transcript-persistence-qa.mjs` (§4.2, §4.6 item 11) currently passes or fails — the call-site absence in `VideoDetailPanel.jsx` is confirmed by direct source reading, but the script itself was not executed (out of this audit's read-only scope).
6. The SDK-level default `temperature`/`maxOutputTokens`/request-timeout for the 5 of 7 live Gemini call sites that omit an explicit `generationConfig` (§3.2, §3.5) — `@google/generative-ai` SDK v0.24.1 internals were not read.
7. Whether any of the remaining ~40 of the 48 `localStorage`-touching files under `src/` (beyond the core stores documented in §4.2) follow the same write→verify→report contract, or share `ai_analysis_${videoId}`'s weaker pattern — not individually audited.
8. `canonicalizeGemsPayloadForPersistence()`'s (`gemsJsonRepair.js:183`) full internal merge logic — existence and export location confirmed; internals not traced line-by-line (§3.4).
9. Whether `WorkspaceLibrary.jsx`'s two "open a video" mechanisms (its own local `VideoDetailPanel` instance vs. `handleSourceVideoClick` navigating away to `Dashboard` with `openVideoId`, both wired and both confirmed present) are two deliberate UX affordances or an unintentional duplication — not resolved either way.
10. `hebrewSentimentTokenGuard.js`'s reuse by `morningBriefVisuals.js`/`marketRowVisuals.js` (§1.9) — relayed from the guard module's own doc comment, not independently re-confirmed at those two call sites.
11. Restriction status of the `VITE_YOUTUBE_API_KEY` in Google Cloud Console (§5.3) — no key is currently present in `.env` to check against.

### 5.5 Open items ledger — overlapping rows (not acted on)

Per this task's pre-flight instructions, `docs/open-items-ledger.md` was read for rows overlapping this audit's subject areas before any code was read; those rows were not investigated further or acted on — listed here for cross-reference only. The ledger itself (323 lines as of this audit) documents a long history of concurrent-session collisions on this shared worktree and repeated `Write`-tool file-size failures on this exact file — treat any single row's "last-checked" date as a point-in-time claim, not current truth, per the ledger's own stated convention.

- `TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN` — `needs-user-decision`, last checked 2026-09-01: a 4-GEM tabs-mapping planning doc with 2 of 4 original questions still explicitly open.
- `TRADINGBRAIN-WORKSPACE-COLLECTION-COUNTERS` — `open`, 2026-09-02: reported bug, collection cards showing "0 ייחודיים · 0 שמירות" despite real underlying data; not investigated by anyone per the ledger's own note.
- `TRADINGBRAIN-WORKSPACE-SUBTOPIC-TABS` — multiple `open` rows, 2026-09-03: a duplicate "מסקנות" tab-label collision (two separate tabs, same label, different item counts) and an unverified claim about whether the "תוכן ייעודי" collection's `type`/`tabKey` field varies across real data. **Note:** an earlier row in this same WORK-ID (also 2026-09-03) described 5 files with uncommitted tab-related changes at that time — this audit's own pre-flight `git status --porcelain` at HEAD `be1a70d` shows the working tree clean except `docs/open-items-ledger.md` itself, so that specific uncommitted-files claim is now stale (superseded by an intervening commit/push not itself investigated by this audit).
- `TRADINGBRAIN-GEMPICKER-COMPACT-SCORING` — `open`, last re-confirmed 2026-09-06: 5 files (`gemRecommender.js`, `GemSelectionModal.jsx`, `GemRecommendationCard.jsx`, `gemContentRouter.js`, `scripts/brief-gem-selector-qa.mjs`) still marked modified/untested-by-user as of that check — directly overlaps this audit's §2.2 classification-engine findings; not re-verified here.
- `TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA` — `open`, 2026-09-11: per the ledger's own note, the content-loss risk this WORK-ID originally tracked was closed by an ancestor commit, but a separate interleaving concern against `TRADINGBRAIN-LEARNING-TAB-FIXED-SECTIONS` was left explicitly unclosed at that time. This audit's own pre-flight found the working tree clean (beyond the ledger file itself) at HEAD `be1a70d`, consistent with that interleaving having since been resolved by a later commit — not independently re-confirmed.
- `TRADINGBRAIN-PINNED-CARD-QA-BROKEN-BY-CONCURRENT-EDIT` — `blocked`, last re-run 2026-09-07: a pre-existing QA script (`scripts/pinned-recent-video-card-qa.mjs`) failing on a `showClearFocus={false}` assertion against `WorkspaceLibrary.jsx` — unrelated to this audit's own findings but touches the same file family (§1.8).
- `TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS` — `needs-user-decision`, 2026-09-07: `scripts/publish-date-header-coverage-qa.mjs` failing on a stale assertion against `WorkspaceVideoGroupCard.jsx`.
- `YMD-SETTINGS-UNCOMMITTED` — `open` as of the ledger's last note (2026-09-12, recorded as committed+pushed in that same note) — unrelated to this audit's scope, noted only because it was surfaced by the same overlap grep.

### 5.6 Open questions requiring a product/owner decision

1. Should `src/ai/gemini/gemContentRouter.js` be wired into the live classification path, or deleted? It is more elaborately documented than the live `gemRecommender.js` (§2.2), which may indicate it was meant to *replace* rather than duplicate it — no commit message, TODO, or ledger row confirms either intent.
2. Should `GEM-FUNDAMENTAL-INSTRUCTIONS.md`'s pasteable text be corrected to stop banning `warnings` and the APP tab, now that both are live-supported (§2.3, §2.9)?
3. Is the per-card "save to Workspace" writing into the brain store instead of the Workspace store (§4.6 item 1) a bug to fix, or was it always meant as a lightweight "save this section" shortcut distinct from the full "save video to Workspace Library" flow? The UI label ("⭐ שמור ל-Workspace") suggests the former.
4. Should the non-political "save to brain" mislabeling as `politicalSummary` (§4.6 item 2) be fixed by passing an explicit `sectionTypeOverride`, or does the current filing convention serve some purpose not visible from the code alone?
5. Is the `brain-select` tab (§1.5, §4.6 item 5) meant to be finished and wired to a trigger, or removed as abandoned work?
6. Should the dead 13-constant/2-function tab-configuration subsystem in `videoTabsConfig.js` (§1.4, §4.6 item 4) be deleted now that `UNIVERSAL_TABS` has fully superseded it?
7. Is `.env.example`/`.env.local.example` documenting `VITE_ANTHROPIC_API_KEY` (§5.2 item 3, §5.3 item 2) an intentional legacy fallback that should stay for compatibility, or should it be removed to stop inviting the riskier variant?
8. Should the core video/analysis store (`yt_mentor_videos_v2`) be migrated onto the same IndexedDB/generation architecture the market-brief/Fear-Greed/AAII stores already use (§4.2, §4.6 item 10), or is `localStorage`-only intentional for this specific store given its size/access patterns?
9. Is `transcriptCanonicalStore.js` (§4.2, §4.6 item 11) meant to be wired up (matching what `scripts/youtube-transcript-persistence-qa.mjs` already asserts), or should that QA script and the orphaned store both be retired together?
10. What should happen to `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_DRIVE_FOLDER_NAME` (§5.3 item 8) — remove the unused declarations from `.env.example`, or is Google Drive export a planned feature these are staged for?
11. Should the personal Gemini Gem URLs and the personal Windows filesystem path currently hardcoded as defaults in client-bundled source (§5.3 items 6-7) be moved to a private, non-committed local config?

