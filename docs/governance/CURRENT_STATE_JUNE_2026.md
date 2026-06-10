# CURRENT STATE — JUNE 2026

```
SOURCE OF TRUTH

Future development must follow this document.

If implementation and documentation differ,
report the contradiction before modifying code.
```

**Project:** YouTube Mentor Dashboard  
**Snapshot date:** June 11, 2026  
**Branch state:** Uncommitted local changes (per `PROJECT_STATUS.md` 2026-06-09)  
**Build:** ✅ `npm run build` passes  
**Release:** ❌ Not release-ready

---

## Executive Summary

The project is a **functional development build** with major features landed locally but not fully QA-validated. The 7 Universal Tabs architecture, Morning Brief dashboard, Obsidian merge engine, and bulk save system are implemented. Four release gates block production publish.

---

## Working ✅

### Universal Tabs

| Feature | Status | Evidence |
|---------|--------|----------|
| 7-tab bar for every video | ✅ Implemented | `UNIVERSAL_TABS` in `videoTabsConfig.js`, wired in `VideoDetailPanel.jsx` |
| Centralized GEM extraction | ✅ Implemented | `extractUniversalTabContent()` in `universalTabSections.js` |
| Object-schema mapping (P0/P1 fixes) | ✅ Landed | Commits `02ffdb3`, `892204f`, `b7a6247` |
| JSON repair (gershayim ordering) | ✅ Fixed | `universalTabSections.js` |
| `UniversalTabSectionBlocks` rendering | ✅ Implemented | Consistent section UI across tabs |
| `GemRawModal` inspector | ✅ Available | Raw GEM payload debugging |
| Runtime tab audit utilities | ✅ Available | `runtimeTabsAudit.js` + dev scripts |

### Obsidian Merge Engine

| Feature | Status | Evidence |
|---------|--------|----------|
| Per-item merge with HTML markers | ✅ Implemented | `obsidianNoteMerge.js` |
| Vault read/write API (dev server) | ✅ Implemented | `vite.config.js` vault plugins |
| Client merge orchestration | ✅ Implemented | `obsidianVaultMergeWrite.js` |
| Per-item save tracking | ✅ Implemented | `obsidianItemSaveStore.js` |
| Dedupe by identity key | ✅ Implemented | 3-layer dedupe (marker + store + hash) |
| E2E specs for merge | ✅ Exist | `e2e/obsidian-merge-vault.qa.spec.js`, `obsidian-bulk-save.qa.spec.js` |
| QA scripts | ✅ Available | `scripts/obsidian-merge-vault-qa.mjs`, `obsidian-bulk-save-qa.mjs` |

### Brain Save

| Feature | Status | Evidence |
|---------|--------|----------|
| Per-row quick save (🧠) | ✅ Wired | `UniversalTabQuickSaveActions.jsx` |
| Bulk brain save | ✅ Wired | `handleSaveSelectedToBrain` in `VideoDetailPanel.jsx` |
| Dedupe by text key | ✅ Implemented | `brain-item:{videoId}:{tab}:{textKey}` |
| SubBrain destination picker | ✅ Implemented | `BrainDestinationPicker.jsx` + `brainStructure.js` |
| Open saved brain item | ✅ Implemented | Navigate to `TopicKnowledgePage` |
| Full-video brain save | ✅ Implemented | Overwrite vault write (legacy fields only) |

### Workspace Save

| Feature | Status | Evidence |
|---------|--------|----------|
| Per-row workspace save (⭐) | ✅ Wired | `saveSingleItemToWorkspace` |
| Full video workspace library | ✅ Implemented | `SaveToWorkspaceDialog.jsx` + `workspaceLibraryStore.js` |
| Workspace library hook | ✅ Implemented | `useWorkspaceLibrary.js` |
| Video dedupe in library | ✅ By videoId | Update existing entry on re-save |

### APP Builder

| Feature | Status | Evidence |
|---------|--------|----------|
| Tab UI | ✅ Implemented | `AppBuilderTab.jsx` |
| Topic gating (4 topics) | ✅ Implemented | `APP_BUILDER_TOPICS` in `VideoDetailPanel.jsx` |
| Draft localStorage persistence | ✅ Implemented | `appBuilderStore.js` |
| GEM → sections mapping | ✅ Implemented | `mapUniversalAppBuilderToSections()` |
| App ideas extraction | ✅ Implemented | `extractAppIdeas.js` |
| App Ideas Brain panel | ✅ Implemented | `AppIdeasBrainPanel.jsx` |
| Obsidian append for market ideas | ✅ Implemented | `appIdeasBrainObsidian.js` |

### Obsidian Mapping Tab

| Feature | Status | Evidence |
|---------|--------|----------|
| Apply AI Recommendations | ✅ Implemented | `ObsidianMappingTab.jsx` |
| Undo Last Apply | ✅ Implemented | Snapshot restore |
| Confidence badges (🟢🟡🔴) | ✅ Implemented | Threshold display only |
| Live path preview | ✅ Implemented | `buildPathSegments()` + `resolveVideoObsidianRoute()` |
| Draft-first (no silent save) | ✅ Enforced | Local state only until explicit save |
| Confirm on manual edits | ✅ Implemented | Dialog before apply |

### Bulk Selection

| Feature | Status | Evidence |
|---------|--------|----------|
| Tab-scoped selection | ✅ Implemented | `useTabBulkSelection.js` |
| Select all / clear | ✅ Implemented | `UniversalTabBulkToolbar.jsx` |
| Per-row checkboxes | ✅ Implemented | `UniversalTabBulkProvider` |
| Bulk save bar (footer) | ✅ Implemented | `UniversalTabSelectionBar.jsx` |
| Morning Brief bulk sections | ✅ Implemented | `morningBriefBulkSections.js` |
| QA validation script | ✅ Available | `scripts/universal-tab-bulk-validate.mjs` |

### Morning Brief Dashboard

| Feature | Status | Evidence |
|---------|--------|----------|
| 10-section fixed layout | ✅ Implemented | `MorningBriefDashboard.jsx` |
| Visual system (tone, direction) | ✅ Implemented | `morningBriefVisuals.js`, `MorningBriefVisualPrimitives.jsx` |
| Unified stocks pipeline | ✅ Implemented | `extractUnifiedStocks()` |
| Data merge (raw→legacy→spec) | ✅ Implemented | `morningBriefDisplay.js` |
| Markets table with ▲/▼ | ✅ Implemented | `MorningBriefMarketsTable.jsx` |
| Empty states for all sections | ✅ Implemented | `EmptyState` component |

### Other Working Areas

| Area | Status |
|------|--------|
| Hebrew RTL throughout | ✅ `dir="rtl"` on App + panels |
| Topic hierarchy (3 levels) | ✅ Enforced in `topicRules.js` |
| Political opponent view gating | ✅ Politics only |
| Playwright smoke config | ✅ `playwright.config.js` |
| Base44 Git workflow docs | ✅ `docs/workflow.md` |
| Knowledge Library vault tree | ✅ `knowledgeLibrary.js` (~90 fixed paths) |

---

## Partially Working ⚠️

### Obsidian Mapping Persistence (OBS-1)

**Status:** Draft fields (`tags`, `obsidianTopics`, `relatedTopics`) stay in local tab state only.  
Only `subCategory` propagates to parent via `onDraftChange`.  
Full draft not wired to `saveVideoFields` / DB commit.

**Impact:** User must re-apply AI recommendations after reload unless they run existing save flow.

### App Builder Full Integration

**Status:** Tab UI and draft persistence work. Full GEM integration QA per `APP_BUILDER_TOPICS` gating not completed.

**Impact:** Some app-builder sections may be empty for videos without complete GEM `universalTabs.app` data.

### Workspace Bulk Save

**Status:** Per-row works. Bulk creates new IDs each time (`ws-sel:...:{Date.now()}`) — **no dedupe**.

**Impact:** Duplicate workspace snippets on repeated bulk saves.

### Brain Full-Video Save Scope

**Status:** `buildSaveAllContent()` collects legacy fields only — not universal tabs / GEM.

**Impact:** "שמור למוח" full save ≠ Obsidian mapping full save in content scope.

### Chapters Timestamps (CH-1)

**Status:** Titles render; timestamps missing when `startSeconds` invalid upstream.  
`ChapterItem` correctly hides timestamp when data absent — root cause is GEM/transcript normalization.

### Morning Brief Persistence (MB-3, MB-4)

**Status:** Dual-key load (`market_brief_${id}` / `market_brief_${youtubeId}`) implemented.  
End-to-end reload QA not documented.

### DirectionChip Regression (MB-2)

**Status:** Code fix applied (`DirectionBadge` in `MorningBriefMarketsTable.jsx`).  
Browser regression QA pending on Specialized tab.

### Auto Whisper Transcript

**Status:** Modal shows "יתווסף בהמשך" — not implemented.

### Base44 Backend Functions

**Status:** Stubs with TODO in `base44/functions/processVideo/entry.ts`, `generateSummary/entry.ts`.

### KnowledgeItem / Brain Phase

**Status:** localStorage-first per `docs/OBSIDIAN_PERSONAL_BRAIN_PHASE.md`. No backend sync.

### E2E in CI

**Status:** Playwright configured but not run in recent development session.

### BulkSelectionBar Component

**Status:** Defined per `AI_DEVELOPMENT_GUIDE.md` §22 but **not imported anywhere**.  
Runtime uses `UniversalTabSelectionBar` + `UniversalTabBulkToolbar` instead.

---

## Open Issues 🐛

### Release Blockers (4 Gates)

| ID | Issue | Severity | Location |
|----|-------|----------|----------|
| CH-1 | Chapters show titles, no timestamps | **High** | `ChapterItem.jsx`, `VideoDetailPanel.jsx` |
| MB-2 | `DirectionChip is not defined` — fix unverified | **High** | `MorningBriefMarketsTable.jsx` |
| MB-3 | Summary/Specialized empty after refresh — unverified | **High** | `VideoDetailPanel.jsx`, `morningBriefDisplay.js` |
| MB-4 | Morning Brief persistence after reload unvalidated | **High** | `VideoDetailPanel.jsx`, `videoStorage.js` |

**Verdict:** Do not publish to Base44 until all four gates pass.

### Non-Blocking Bugs

| ID | Issue | Severity |
|----|-------|----------|
| OBS-1 | Obsidian draft fields not persisted to DB | Medium |
| OBS-2 | No inline pill editing in Obsidian Mapping tab | Low |
| OBS-3 | `skipPropSyncRef` rapid prop update desync risk | Low |
| MB-1 | `marketBriefData` null for never-analyzed videos (by design) | Low |
| GIT-1 | Large untracked dev artifacts | Info |

### Known Architecture Risks

| Risk | Description |
|------|-------------|
| "Brain" dual meaning | Per-item → localStorage; full save → Obsidian vault |
| Text hash collision | Dedupe on first 60 chars — different texts may share ID |
| Marker fragility | Manual Obsidian edits can break HTML comment dedupe |
| Download fallback | Some political/text saves still use `downloadMarkdown` not vault merge |
| App Builder Obsidian | Overwrite on re-save — not merge |
| Dev-only vault API | `/api/vault/*` needs production backend equivalent for Base44 publish |

### Code TODOs

| Item | File |
|------|------|
| RSS: fetch contentDetails + statistics | `src/services/rssIngestion.js:139` |
| AI integration in generateSummary | `base44/functions/generateSummary/entry.ts:27` |
| processVideo pipeline | `base44/functions/processVideo/entry.ts:32` |

---

## Recommended Next Steps (Prioritized Roadmap)

### P0 — Release Blockers (Before Any Publish)

1. **Fix chapters timestamps** — ensure `normalizeGemChapters` / transcript-backed chapters populate `startSeconds` + formatted `timestamp`.
2. **Verify DirectionChip fix** — open Specialized tab on morning-brief video; confirm no console errors.
3. **QA Summary/Specialized after refresh** — analyze video → reload → confirm both tabs populate.
4. **QA Morning Brief persistence** — test 3+ morning-brief videos; reload; confirm `market_brief_*` data survives.

### P1 — Post-Gate Critical

5. **Wire Obsidian Mapping full draft to save flow** — propagate `tags`, `obsidianTopics`, `relatedTopics` to DB without breaking existing save UX.
6. **Browser QA pass** — Apply / Undo / confirm dialog / path preview / badge states on live analyzed video.
7. **Align Obsidian path naming** — resolve drift between docs (`מבזקי בוקר/{date}`) and runtime (`מבזק בוקר/V-{slug}.md`).
8. **Add `דוחות ורווחים` to `SUB_CATEGORY_SLUG_MAP`** — earnings brief slug consistency.

### P2 — UX Polish

9. Green/Red directional indicators (extend beyond current tone styles)
10. Up/Down arrows on market change values
11. High / Medium / Low badges (extend to stocks/opportunities)
12. Confidence indicators on Morning Brief sections
13. AI recommendation CTA polish
14. Better visual hierarchy for stocks and opportunities

### P3 — Engineering

15. Inline edit pills in Obsidian Mapping tab
16. Sync Obsidian draft when `effectiveSubCategory` changes externally
17. E2E test for Morning Brief 10-section render + Obsidian Apply workflow
18. Clean up / gitignore dev artifacts (`.playwright-mcp/`, `build-*.txt`, audit screenshots)
19. Wire or remove unused `BulkSelectionBar.jsx` — align spec with runtime
20. Workspace bulk dedupe — fix `Date.now()` ID generation
21. Production vault API for Base44 publish

### P4 — Backlog

22. RSS ingestion contentDetails + statistics
23. Runtime tabs audit in CI
24. Workspace Library page polish
25. Auto Whisper transcript
26. Base44 backend function implementation
27. Brain backend sync (move beyond localStorage)

---

## Build & Environment

| Item | Status |
|------|--------|
| `npm run build` | ✅ Passes |
| `npm run dev` | Vite + Base44 proxy |
| Node | 20+ recommended |
| Key env vars | `VITE_BASE44_*`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (server-side) |
| E2E | Playwright configured — not run recently |

---

## Recent Commits (main branch)

```
d2a3e0e fix missing learning sub tab import and verify build
892204f fix: universal tabs object schema mapping + JSON repair gershayim ordering
b7a6247 feat: expand ai mapping safe tab fixes to all 7 universal tabs
06b6924 fix: strip embedded root JSON injection from GEM string values
23688d0 feat: clean market brief display with structured table
a37eb59 stabilize universal tabs mapping
02ffdb3 fix: universal tabs content-mapping audit fixes (P0/P1)
```

> Morning Brief dashboard, Obsidian Apply workflow, and related files are **local uncommitted changes** beyond `d2a3e0e`.

---

## Success Criteria (Obsidian Mapping Feature)

| Criterion | Status |
|-----------|--------|
| User sees what AI recommended | ✅ |
| User sees what was applied | ✅ |
| User sees manual edits | ⚠️ Partial (external only) |
| User sees Obsidian destination | ✅ |
| User can undo AI actions | ✅ |
| No silent save | ✅ |
| No overwrite without confirm | ✅ |
| Existing save flow unchanged | ✅ |

---

*Update this document at the start of each development session. Cross-reference `PROJECT_STATUS.md` for detailed bug tables and `PROJECT_DECISIONS_HISTORY.md` for architectural rationale.*
