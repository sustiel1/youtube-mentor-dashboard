# MASTER PROJECT BIBLE

```
SOURCE OF TRUTH

Future development must follow this document.

If implementation and documentation differ,
report the contradiction before modifying code.
```

**Project:** YouTube Mentor Dashboard  
**Platform:** Base44 + React + Vite  
**UI:** Hebrew RTL, dark theme  
**Last updated:** June 2026

---

## Project Vision

**YouTube Mentor Knowledge Brain** — a system that:

1. Ingests YouTube mentor videos (RSS, manual add, transcript)
2. Analyzes content via external GEM paste-back (no GEM API)
3. Presents structured knowledge through 7 Universal Tabs
4. Enables selective saving to Brain, Obsidian, and Workspace
5. Builds a permanent Knowledge Base in Obsidian vault
6. Consumes accumulated knowledge in APP Builder to generate product specs
7. Feeds PRDs back into Claude / Cursor / Base44 for application development

**UX Goal:** Fast review, selective saving, consistent topic organization.

**Long-term vision:** Every mentor video becomes structured, searchable, linkable knowledge that compounds over time — ultimately powering AI-assisted product development from real domain expertise.

---

## Governance Document Index

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [STOCK_ANALYSIS_SCREEN_BIBLE.md](./STOCK_ANALYSIS_SCREEN_BIBLE.md) | Permanent reference for all stock-market screens | Before any שוק ההון feature work |
| [CURRENT_STATE_JUNE_2026.md](./CURRENT_STATE_JUNE_2026.md) | What works, what's partial, open bugs, roadmap | At start of every dev session |
| [PROJECT_DECISIONS_HISTORY.md](./PROJECT_DECISIONS_HISTORY.md) | WHY decisions were made | Before proposing architectural changes |
| [DESIGN_SYSTEM_AND_UX_RULES.md](./DESIGN_SYSTEM_AND_UX_RULES.md) | RTL, tabs, cards, colors, indicators | Before any UI work |
| [SAVE_SYSTEM_ARCHITECTURE.md](./SAVE_SYSTEM_ARCHITECTURE.md) | Brain/Obsidian/Workspace save flows | Before any save-flow changes |
| [USER_PRODUCT_INTENT_AND_FUTURE_VISION.md](./USER_PRODUCT_INTENT_AND_FUTURE_VISION.md) | Strategic intent, North Star, non-negotiables | Before proposing features or refactors |
| **This document** | Vision, knowledge flow, index | First read for any new contributor |

### External References (Root Level)

| Document | Role |
|----------|------|
| `AI_DEVELOPMENT_GUIDE.md` | Original UX/architecture constitution (§1–§34) |
| `PROJECT_STATUS.md` | Live status tracker (updated per session) |
| `CLAUDE.md` / `AGENTS.md` | Workflow + approved AI settings |
| `docs/workflow.md` | Base44 + Git workflow |
| `docs/OBSIDIAN_PERSONAL_BRAIN_PHASE.md` | Obsidian-first brain checkpoint |

**Hierarchy:** Governance docs in `/docs/governance/` supersede scattered sections in `AI_DEVELOPMENT_GUIDE.md` where contradictions exist. Report contradictions before modifying code.

---

## Complete Knowledge Flow

```
YouTube Video
      │
      ▼
Transcript + Metadata
(RSS ingestion, manual upload, Whisper — planned)
      │
      ▼
GEM External Analysis
(paste-back flow — no API)
      │
      ▼
GEM JSON → DB
(universalTabs.* + specialized fields)
      │
      ▼
┌─────────────────────────────────────────┐
│         7 UNIVERSAL TABS                │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┐ │
│  │סיכום│פרקים│תובנות│ידע │ APP │מיפוי│ │
│  └─────┴─────┴─────┴─────┴─────┴─────┘ │
│              + תוכן ייעודי (Tab 7)      │
└─────────────────────────────────────────┘
      │
      ▼
User Review + Selection
(per-row 🧠🔮⭐ or bulk footer bar)
      │
      ├──────────────────┬──────────────────┐
      ▼                  ▼                  ▼
   BRAIN              OBSIDIAN           WORKSPACE
(localStorage)      (vault merge)     (snippets + library)
      │                  │                  │
      └──────────────────┼──────────────────┘
                         ▼
              KNOWLEDGE BASE (Obsidian Vault)
              Knowledge-Base/
              ├── שוק ההון/
              ├── פוליטיקה/
              ├── טכנולוגיה ו-AI/
              └── בריאות ותזונה/
                         │
                         ▼
                   APP BUILDER
              (consumes knowledge → product spec)
              App Ideas/{topic}/
                         │
                         ▼
                        PRD
              (requirements, screens, logic, tasks)
                         │
                         ▼
              Claude / Cursor / Base44
                         │
                         ▼
                   APPLICATION
```

---

## System Layers

### Layer 1: Ingestion

| Component | File | Status |
|-----------|------|--------|
| RSS feeds | `rssIngestion.js` | Working (TODO: contentDetails) |
| Video storage | `videoStorage.js` | Working |
| Channel/mentor management | Admin panel | Working |
| Auto Whisper | — | Planned |

### Layer 2: Analysis

| Component | File | Status |
|-----------|------|--------|
| GEM paste-back | `VideoDetailPanel.jsx` | Working |
| GEM schema mapping | `universalTabSections.js` | Working |
| AI mapping modal | `AiMappingModal.jsx` | Working |
| Base44 functions | `base44/functions/` | Stubs (TODO) |

### Layer 3: Presentation

| Component | File | Status |
|-----------|------|--------|
| Video modal shell | `VideoDetailPanel.jsx` | Working |
| 7 Universal Tabs | `videoTabsConfig.js` | Working |
| Specialized renderer | `SpecializedContentRenderer.jsx` | Working |
| Morning Brief dashboard | `MorningBriefDashboard.jsx` | Working (QA pending) |
| Obsidian Mapping tab | `ObsidianMappingTab.jsx` | Working (draft persistence partial) |
| APP Builder tab | `AppBuilderTab.jsx` | Partial |

### Layer 4: Persistence

| Component | File | Status |
|-----------|------|--------|
| Brain (per-item) | `localKnowledgeItemStore.js` | Working |
| Obsidian merge | `obsidianNoteMerge.js` | Working |
| Workspace library | `workspaceLibraryStore.js` | Working |
| Knowledge Library | `knowledgeLibrary.js` | Working |
| DB (Base44) | Entities | Authoritative for video metadata |

### Layer 5: Productization

| Component | File | Status |
|-----------|------|--------|
| APP Builder | `appBuilderStore.js` | Partial |
| App ideas extraction | `extractAppIdeas.js` | Working |
| PRD sections | `APP_BUILDER_SECTIONS` | Working |

---

## Topic Hierarchy

```
Level 1: Main Topic (from Mentor/Channel Management)
  ├── שוק ההון
  ├── פוליטיקה
  ├── טכנולוגיה ו-AI
  └── בריאות ותזונה

Level 2: Sub-Topic (from video subCategory)
  ├── מבזק בוקר, מבזק ערב, ניתוח טכני, ... (שוק ההון)
  ├── פוליטיקה פנימית, גיאופוליטיקה, ... (פוליטיקה)
  └── ...

Level 3: Optional Title / Sub-Sub-Topic
  └── Video title or user-defined tag

MAXIMUM 3 LEVELS — never a fourth.
```

**Sync rule:** Any topic change must propagate to Brain paths, Obsidian paths, Workspace mapping, and GEM key resolution.

---

## Key Architectural Invariants

These must never be violated without updating governance docs:

1. **7 Universal Tabs** — fixed order, every video, no exceptions.
2. **GEM paste-back only** — no GEM API integration.
3. **Merge, not overwrite** — for Obsidian per-item saves.
4. **Draft-first** — Obsidian Mapping applies to local draft, not DB.
5. **DB authoritative** — localStorage is temporary UI state.
6. **Hebrew UI** — RTL, no English labels.
7. **APP Builder consumes** — does not generate analysis.
8. **Opponent View** — politics only.
9. **3-level hierarchy** — no fourth level.
10. **GitHub = code truth** — Base44 Pull for deploy.

---

## Content Domains

### שוק ההון (Stock Market)

Primary domain. See [STOCK_ANALYSIS_SCREEN_BIBLE.md](./STOCK_ANALYSIS_SCREEN_BIBLE.md).

Sub-types: Morning Brief, Evening Brief, Weekly Brief, Earnings Brief, Macro, Technical Analysis, Fundamental Analysis, Watchlists (cross-cutting).

### פוליטיקה (Politics)

Opponent View (⚔️) gated here only. Separate Obsidian path: `פוליטיקה/דעת הצד השני`.

### טכנולוגיה ו-AI (Technology & AI)

APP Builder enabled. Obsidian: `App Ideas/AI & Technology/`.

### בריאות ותזונה (Health & Nutrition)

APP Builder enabled. Brain SubBrains: קיטו, סכרת, תזונה, etc.

---

## Development Workflow

```
1. Read CURRENT_STATE_JUNE_2026.md
2. Read relevant governance doc for your task
3. Make changes in project files (not Console, not Base44 UI)
4. npm run build — must pass
5. Manual QA per checklist in DESIGN_SYSTEM_AND_UX_RULES.md
6. Git commit + push (when ready)
7. Base44 → Git → Pull
8. Publish (only when release gates pass)
```

### Approved AI Settings (Do Not Change Without Approval)

| Setting | Value | File |
|---------|-------|------|
| `max_tokens` | 8192 | `vite.config.js` |
| `ANTHROPIC_MESSAGE_MS` | 600,000 | `vite.config.js` |
| `server.httpServer.timeout` | 620,000 | `vite.config.js` |
| `CHUNK_THRESHOLD` | 15,000 | `vite.config.js` |
| Transcript threshold | 300 chars | `VideoDetailPanel.jsx` |
| `GEMINI_MOCK` | false | env |

See `CLAUDE.md` for full table.

---

## Release Gates (June 2026)

**Do NOT publish until all pass:**

| Gate | Status |
|------|--------|
| Chapters timestamps working | ❌ Open |
| DirectionChip error fixed | ⚠️ Partial |
| Summary/Specialized verified after refresh | ❌ Open |
| Morning Brief tested on ≥ 3 videos | ❌ Open |

See [CURRENT_STATE_JUNE_2026.md](./CURRENT_STATE_JUNE_2026.md) for details.

---

## Onboarding Checklist for New Contributors

### Day 1 — Understand the Vision

- [ ] Read this document (MASTER_PROJECT_BIBLE.md)
- [ ] Read USER_PRODUCT_INTENT_AND_FUTURE_VISION.md — strategic intent and North Star
- [ ] Read PROJECT_DECISIONS_HISTORY.md
- [ ] Skim AI_DEVELOPMENT_GUIDE.md §1–§10

### Day 2 — Understand the Codebase

- [ ] Open `VideoDetailPanel.jsx` — find 7-tab bar (~line 8414)
- [ ] Open `videoTabsConfig.js` — find `UNIVERSAL_TABS`
- [ ] Open `SpecializedContentRenderer.jsx` — find sub-category switch
- [ ] Run `npm run dev` and open a analyzed video

### Day 3 — Understand Save Flows

- [ ] Read SAVE_SYSTEM_ARCHITECTURE.md
- [ ] Test per-row save (🧠🔮⭐) on one item
- [ ] Test bulk save via footer bar
- [ ] Inspect `localStorage` keys: `yt_knowledge_items_v1`, `yt_obsidian_item_saves_v1`

### Before First PR

- [ ] Read CURRENT_STATE_JUNE_2026.md — check open bugs
- [ ] Read DESIGN_SYSTEM_AND_UX_RULES.md — verify RTL/Hebrew
- [ ] `npm run build` passes
- [ ] No secrets in code
- [ ] Update governance doc if you change an architectural invariant

---

## File Structure (Key Paths)

```
youtube-mentor-dashboard/
├── docs/
│   ├── governance/          ← THIS FOLDER (source of truth)
│   │   ├── MASTER_PROJECT_BIBLE.md
│   │   ├── STOCK_ANALYSIS_SCREEN_BIBLE.md
│   │   ├── CURRENT_STATE_JUNE_2026.md
│   │   ├── PROJECT_DECISIONS_HISTORY.md
│   │   ├── DESIGN_SYSTEM_AND_UX_RULES.md
│   │   ├── SAVE_SYSTEM_ARCHITECTURE.md
│   │   └── USER_PRODUCT_INTENT_AND_FUTURE_VISION.md
│   ├── workflow.md
│   └── OBSIDIAN_PERSONAL_BRAIN_PHASE.md
├── src/
│   ├── components/dashboard/
│   │   ├── VideoDetailPanel.jsx      ← main shell
│   │   ├── SpecializedContentRenderer.jsx
│   │   ├── MorningBriefDashboard.jsx
│   │   ├── ObsidianMappingTab.jsx
│   │   └── AppBuilderTab.jsx
│   ├── config/
│   │   ├── videoTabsConfig.js        ← 7 tabs + slugs
│   │   └── brainStructure.js         ← Brain hierarchy
│   └── lib/
│       ├── universalTabSections.js   ← GEM extraction
│       ├── morningBriefDisplay.js    ← Morning Brief merge
│       ├── obsidianNoteMerge.js      ← Merge engine
│       ├── localKnowledgeItemStore.js
│       └── knowledgeLibrary.js       ← Fixed vault tree
├── AI_DEVELOPMENT_GUIDE.md           ← Original constitution
├── PROJECT_STATUS.md                 ← Live status
└── CLAUDE.md                         ← Approved AI settings
```

---

## Contradiction Reporting Protocol

When you find implementation differs from governance docs:

1. **Do not modify code** until contradiction is resolved.
2. Document: governance says X, code does Y, file paths for both.
3. Determine which is correct (usually governance reflects intended state; code may have drifted).
4. Update the incorrect source.
5. Note the resolution in `CURRENT_STATE_JUNE_2026.md` open issues or a new decision in `PROJECT_DECISIONS_HISTORY.md`.

Known contradictions as of June 2026:

| Topic | Governance | Code | See |
|-------|------------|------|-----|
| Morning Brief tabs | §6 lists 9 tabs | 10 dashboard sections | STOCK_ANALYSIS_SCREEN_BIBLE.md |
| Obsidian morning path | `מבזקי בוקר/{date}` | `מבזק בוקר/V-{slug}.md` | STOCK_ANALYSIS_SCREEN_BIBLE.md |
| Bulk bar component | `BulkSelectionBar` (§22) | `UniversalTabSelectionBar` (runtime) | DESIGN_SYSTEM_AND_UX_RULES.md |

---

## Contact & Continuity

This governance folder was created **June 11, 2026** before a development break.

**To resume development:**

1. Start with `CURRENT_STATE_JUNE_2026.md`
2. Run `npm run build` and `npm run dev`
3. Address P0 release gates
4. Update `CURRENT_STATE_JUNE_2026.md` with new status
5. Commit governance docs to Git for permanent preservation

---

*The project's knowledge compounds. These documents ensure no architectural intent is lost between sessions.*
