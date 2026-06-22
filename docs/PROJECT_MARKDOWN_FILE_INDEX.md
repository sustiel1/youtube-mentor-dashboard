# PROJECT MARKDOWN FILE INDEX

**Project:** YouTube Mentor Dashboard
**Generated:** 2026-06-22
**Total files indexed:** 25
**Files excluded:** ~190 (node_modules READMEs, e2e test vaults, `.tmp-qa-vault`)
**Purpose:** Practical reference for every AI session — what to open, what to trust, what to skip.

---

## Exclusion Log

| Excluded Path | Reason | Count |
|--------------|--------|-------|
| `node_modules/**/*.md` | Third-party library READMEs | ~150 |
| `e2e/.tmp-*/**/*.md` | Auto-generated E2E test vault fixtures | ~100 |
| `.tmp-qa-vault/**/*.md` | Auto-generated Obsidian sync QA vault | ~90 |
| `dist/`, `build/`, `coverage/` | Not present in repo | 0 |

---

## Full Markdown File Index

### Root-Level Files

| Path | Title / Main Heading | Short Description | Status | Best Used For | Can Be Used As Inspiration For |
|------|---------------------|-------------------|--------|--------------|-------------------------------|
| `README.md` | YouTube Mentor Dashboard | Standard project overview: tech stack (React, Vite, Tailwind, Base44, Playwright), setup instructions, quick-start, CI/CD pipeline, and an empty roadmap section | Active | Onboarding a new developer or AI session; understanding basic project setup | Writing a CONTRIBUTING.md or deployment guide |
| `PROJECT_STATUS.md` | Project Status — YouTube Mentor Dashboard | Live session tracker (last: 2026-06-17): build status, 4 open release gates (chapters timestamps, DirectionChip, Summary reload, 3-video MB test), open risks, recommended next tasks | Active | Starting a new dev session — read this first to understand current bugs and blockers | Session-end reports; structured bug tracking templates |
| `AI_DEVELOPMENT_GUIDE.md` | AI Development Guide — YouTube Mentor Knowledge Brain | Master architecture constitution §1–§34 (2055 lines): topic hierarchy rules, save system, GEM rules, Obsidian paths, Universal Tabs, bulk selection, political/market/educational content structures, all category structures §24–§34. Mandatory pre-read. | Governance | Before any feature, tab, save-flow, or topic change. The highest-priority doc in the project. | Generating architecture docs for new features; defining new category structures §35+ |
| `CLAUDE.md` | Base44 + Claude Code Workflow | Claude Code working instructions + locked AI settings: `max_tokens=8192`, `ANTHROPIC_MESSAGE_MS=600_000`, `CHUNK_THRESHOLD=15_000`, `GEMINI_MOCK=false`. Also contains Base44 workflow rules. Do not change locked settings without explicit approval. | Governance | Machine-read by Claude Code at session start. Also read before touching `vite.config.js` AI settings. | Defining per-project CLAUDE.md files for other Base44 projects |
| `AGENTS.md` | Base44 + Claude Code Workflow | Base44 + GitHub workflow: 8 working principles, code/console/secrets/git rules, workflow phases (start/during/end). ⚠️ **Exact duplicate** of `docs/workflow.md` — identical 117 lines. | Workflow | Reviewing Base44 workflow rules when you can't find docs/workflow.md. Prefer CLAUDE.md as canonical. | Creating a workflow guide for a new Base44 project |
| `SKILL.md` | SKILL.md — YouTube Mentor Dashboard | Full project reference: data models (Mentor, Video, AdvancedAnalysis, Settings, FetchLog), localStorage keys, complete file structure by service/hook/component/page, all flows (Fetch/Analysis/Advanced), 10 system rules, constraints. | Architecture | When you need data model definitions, localStorage key names, file structure map, or service names. Essential for any backend/service work. | Creating a project spec or data model document for a similar system |
| `PROMPTS.md` | PROMPTS.md | 8 ready-to-use Hebrew AI prompts: basic session, new feature, bug fix, code review, refactor, env vars, Base44 sync, change documentation. Includes a formatted message template for Base44 Git Pull. | Workflow | Copy-paste a prompt to start a focused AI session. Use when beginning a specific task type (bug, feature, refactor). | Building a prompt library for other projects; creating session-start templates |
| `MARKET_DASHBOARD_UI_GUIDE.md` | MARKET_DASHBOARD_UI_GUIDE.md | Blueprint for the Macro/Market Intelligence Specialized Tab UI: 11 sections (ExecutiveSnapshot, MacroEventCards, MacroOverview, Highlights, Opportunities, Risks, Warnings, Sectors, Stocks, Indices, Fed Policy), component names, hierarchy, rendering order. | Architecture | Before any work on Macro GEM dashboard, MacroGemDashboard.jsx, or Market Specialized tab sections. | Designing UI blueprints for other specialized tab types (Political, Health, etc.) |
| `ROUTES_AUDIT_REPORT.md` | ROUTES AUDIT REPORT — YouTube Mentor Dashboard | Snapshot (2026-06-01): 14 routes all verified, 12 sidebar entries, 7 admin tabs, 1 orphaned component (LearningHub — no sidebar link). All routes have valid component files at time of generation. | Audit | Understanding existing page/route structure when no source code browsing is possible. ⚠️ May be stale — verify against `pages.config.js` for current state. | Template for writing a routes audit report for any React/Base44 project |
| `CHAPTER_ENGINE_ROOT_CAUSE_REPORT.md` | Chapter Engine — Root Cause Analysis Report | Root-cause analysis (2026-06-22): 7 chapter sources identified, display priority chain, normalizer functions, boundary detection algorithms, title generation, quality gates. Analysis only — no code was changed. Untracked in git. | Audit | Debugging CH-1 (chapters missing timestamps). Read before touching chapter-related code in VideoDetailPanel, ChapterItem, or normalizeGemChapters. | Writing a root-cause analysis report for other subsystems |

---

### docs/ Root Files

| Path | Title / Main Heading | Short Description | Status | Best Used For | Can Be Used As Inspiration For |
|------|---------------------|-------------------|--------|--------------|-------------------------------|
| `docs/workflow.md` | Base44 + Claude Code Workflow | Base44 + GitHub workflow rules. ⚠️ **Exact duplicate** of `AGENTS.md` — identical content, 117 lines. The two files diverged only in location. | Workflow | No unique value over `AGENTS.md`. Prefer `AGENTS.md` or `CLAUDE.md`. | — |
| `docs/OBSIDIAN_PERSONAL_BRAIN_PHASE.md` | Obsidian-first Personal Brain — Phase Checkpoint | Describes the ZIP export architecture: topic-rooted ZIP structure (`<Topic>/Learnings/`, `<Topic>/Atomic/Insights/`, etc.), export stats, toast wiring, `brainHighlights` selection flow. ⚠️ Partially stale — direct vault API (`/api/vault/write`) replaced ZIP export; structure descriptions may not reflect current implementation. | Deprecated | Background reading on how Obsidian export was designed before vault API. Useful for understanding the atomic note types (Insights, Rules, Actions, Mistakes, Concepts). | Writing a new Obsidian integration architecture doc; documenting current vault API flow |
| `docs/base44-checklist.md` | צ'קליסט חיבור Base44 עם GitHub | Hebrew checklist for Base44 ↔ GitHub setup: Git source-of-truth rules, project structure, secrets management, Environment Variables in Base44, environment variable naming conventions with VITE_ prefix distinctions. | Workflow | Setting up a new Base44 project or reconnecting Base44 to GitHub after a disconnect. | Creating a Base44 onboarding guide for new projects |
| `docs/PROJECT_DOCUMENTATION_AUDIT.md` | PROJECT DOCUMENTATION AUDIT | Full documentation audit (2026-06-22): 24 files catalogued across 8 categories, 8 detected issues (duplicates, clutter, stale docs, missing docs), recommended docs/ folder structure, risky moves list, 7-step implementation plan. | Audit | Planning docs reorganization; understanding which files are duplicates or stale; deciding what to archive. | Creating documentation audits for other projects |
| `docs/PROJECT_DOCUMENTATION_INDEX.md` | PROJECT_DOCUMENTATION_INDEX | Central documentation registry: documentation hierarchy (priority order), project overview, active governance docs, architecture docs, functional areas (Transcript/GEMS/Brain/Obsidian/Workspace/Universal Tabs), audit reports, milestones, documentation rules, missing backlog. | Governance | Quick orientation for any new AI session — what exists, where to find it, what the priority order is. | Creating a documentation index for any other project |

---

### docs/governance/ Files

| Path | Title / Main Heading | Short Description | Status | Best Used For | Can Be Used As Inspiration For |
|------|---------------------|-------------------|--------|--------------|-------------------------------|
| `docs/governance/MASTER_PROJECT_BIBLE.md` | MASTER PROJECT BIBLE | Project vision (7-step knowledge flow: ingest → analyze → present → save → vault → APP Builder → Claude/Cursor), governance document index (which doc to read when), external references, document hierarchy (governance > AI_DEVELOPMENT_GUIDE sections). Source of truth. | Governance | First read for any new contributor or AI session. Answers: "what is this project and which docs matter?" | Writing a master project bible for any complex project |
| `docs/governance/CURRENT_STATE_JUNE_2026.md` | CURRENT STATE — JUNE 2026 | Feature status snapshot (June 11, 2026): Universal Tabs ✅, Obsidian Merge Engine ✅, Brain Save ✅, Morning Brief ✅, E2E specs ✅. Release gates: 4 open (CH-1 chapters, MB-2 DirectionChip, MB-3 reload fallback, MB-4 3-video persistence). Open risks, roadmap context. | Governance | Start of each dev session — shows what is working and what 4 bugs block production. Update at end of each session. | Template for session-end state snapshots; structured "what works / what doesn't" reporting |
| `docs/governance/DESIGN_SYSTEM_AND_UX_RULES.md` | DESIGN SYSTEM AND UX RULES | RTL rules (`dir="rtl"` per component), 7-tab sizing (min-h-[52px], h-11), fixed tab order (סיכום→פרקים→תובנות→ידע שימושי→APP→מיפוי→תוכן ייעודי), color palette (dark theme), component-level design rules for cards, badges, accordions, indicators, save status UI. Source of truth. | Governance | Before any UI, layout, or styling change. Check here before adding new components or changing tab behavior. | Building a design system doc for a new project; defining RTL guidelines |
| `docs/governance/SAVE_SYSTEM_ARCHITECTURE.md` | SAVE SYSTEM ARCHITECTURE | Save flow architecture with Mermaid diagram: 4 storage destinations (Brain, Obsidian, Workspace, Knowledge Library), orchestrator (`VideoDetailPanel.jsx`), client persistence layers, API endpoints (`/api/vault/write`, `/api/vault/append`), dedupe strategy (3-layer: marker + store + hash), important ambiguity (Brain = per-item localStorage OR full-video vault write). Source of truth. | Governance | Before any change to save flows, BulkSelectionBar, Brain save, Obsidian write, or Workspace storage. | Designing a multi-destination save system for any knowledge management app |
| `docs/governance/STOCK_ANALYSIS_SCREEN_BIBLE.md` | STOCK ANALYSIS SCREEN BIBLE | Permanent reference for all stock-market screens: brief type → tab mapping (Morning Brief, Evening, Weekly, Fundamental, Technical, Macro), Universal Tabs mapping, Brain hierarchy for market content, Obsidian vault paths, APP Builder consumption. Canonical code paths: `VideoDetailPanel.jsx`, `SpecializedContentRenderer.jsx`, `videoTabsConfig.js`, `morningBriefDisplay.js`. | Governance | Before any שוק ההון feature work, Morning Brief changes, or Specialized tab modifications. | Writing a "Screen Bible" for other content domains (Political, Health, etc.) |
| `docs/governance/USER_PRODUCT_INTENT_AND_FUTURE_VISION.md` | USER PRODUCT INTENT AND FUTURE VISION | Strategic vision document: why the project exists (ephemeral → non-compounding knowledge problem), what success looks like at 3 horizons (short/medium/long-term), user priorities, non-negotiables, what the system must never do, how knowledge should compound over time. Not implementation — intent only. | Governance | Before proposing architectural changes, new features, or refactors. Answers: "does this serve the actual goal?" | Writing a product vision doc; defining non-negotiables for any knowledge system |
| `docs/governance/PROJECT_DECISIONS_HISTORY.md` | PROJECT DECISIONS HISTORY | Log of major architectural decisions with full rationale: why Universal Tabs replaced per-video tab arrays, why GEM paste-back (no API), why Hebrew topic names, why localStorage-first with vault as durable archive, and all other significant choices. Each entry shows problem → solution → why that solution. | Governance | Before proposing any architectural change or reverting a past decision. Prevents re-litigating settled choices. | Creating a decision log (Architecture Decision Records) for any project |
| `docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md` | Claude Code Governance Mode | Active policy (adopted 2026-06-17): 9 mandatory governance rules — Critical Feedback rule (Claude must challenge bad decisions), Architecture Protection rule, Minimal Change rule, Secrets rule, Documentation rule, Commit rule, Testing rule, Regression rule, and Communication rule. | Governance | Always active — Claude Code reads this implicitly. Explicitly read before large sessions to remind yourself of required behavior. | Defining AI governance policies for other projects using Claude Code |
| `docs/governance/NEXT_SESSION_QA.md` | Next Session QA Checklist | Manual QA checklist tied to `cleanup-baseline-2026-06-17`: 8 test scenarios — MD export (no `[object Object]`), Brain saved indicator, brain-picker guards (allSaved path), keyboard close behavior, bulk save dedup. Each test has steps, expected results, and pass/fail fields. | Workflow | Before any QA session or before closing release gates. Update results after each QA run. Archive when all tests pass. | Creating a manual QA checklist for any feature release |
| `docs/governance/MILESTONE_MORNING_BRIEF_DASHBOARD_CLUSTER.md` | Milestone: Morning Brief Dashboard Cluster Cleanup | Closed milestone record (2026-06-16): 5 commits documented (`7e69661` → `344ae27`), what was broken (MorningBriefVisualPrimitives + VideoDetailPanel had 35 untracked imports), what was fixed, 53 new tracked files added (Universal Tabs bulk selection, Obsidian merge engine, Morning Brief dashboard, App Builder workspace panels). | Milestone | Historical reference only — useful for understanding what the cleanup baseline commit included. Not active governance. | Template for writing a structured milestone/release record |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Root-level files | 10 |
| docs/ root files | 5 |
| docs/governance/ files | 10 |
| **Total indexed** | **25** |
| Excluded (node_modules) | ~150 |
| Excluded (e2e test vaults) | ~100 |
| Excluded (qa vaults) | ~90 |
| **Total excluded** | **~340** |

---

## Duplicate and Suspicious Documents

| Issue | Files Involved | Risk |
|-------|---------------|------|
| **Exact duplicate** | `AGENTS.md` (root) = `docs/workflow.md` | Medium — future edits may diverge. Consolidate to one file. |
| **Partially stale** | `docs/OBSIDIAN_PERSONAL_BRAIN_PHASE.md` | Low — describes ZIP export era; vault API is current architecture. Confusing for new sessions. |
| **Stale snapshot** | `ROUTES_AUDIT_REPORT.md` (2026-06-01) | Low — routes may have changed since. Re-audit before using. |
| **Closed milestone in active governance** | `docs/governance/MILESTONE_MORNING_BRIEF_DASHBOARD_CLUSTER.md` | Low — status is "Complete" but stored alongside active governance docs. Move to archive. |
| **Self-referential overlap** | `AI_DEVELOPMENT_GUIDE.md` §24–§29 vs `STOCK_ANALYSIS_SCREEN_BIBLE.md` | Medium — Obsidian paths in AI_DEVELOPMENT_GUIDE §24/§29 are superseded by §30, which itself is inside the same file. Easy to miss. |

---

## Top 3 Documents to Read Before Development

| Priority | Document | Why |
|----------|---------|-----|
| 1 | `docs/governance/MASTER_PROJECT_BIBLE.md` | Understand project vision, what each doc is for, and the governance hierarchy |
| 2 | `AI_DEVELOPMENT_GUIDE.md` | Master rules for every feature: save system, tab architecture, topic hierarchy, Obsidian paths, category structures |
| 3 | `docs/governance/CURRENT_STATE_JUNE_2026.md` | Understand what works, what 4 bugs block production, and what was recently built |

---

## Navigation Assessment

| Before This Index | After This Index |
|------------------|-----------------|
| 25 docs with no master map | Every doc has purpose, status, and use-case defined |
| Unclear which docs are authoritative | Priority hierarchy explicit (AI_DEVELOPMENT_GUIDE > INDEX > Architecture > Workflow > Audit) |
| Duplicate docs not flagged | 2 exact duplicates identified, 3 stale/suspicious docs marked |
| Missing docs unknown | 3 missing docs identified (GEM_ARCHITECTURE, UNIVERSAL_TABS_ARCHITECTURE, OBSIDIAN_VAULT_API) |
| New session orientation: manual | New session: open this index → follow Top 3 → work |

**Verdict:** Project documentation is now significantly easier to navigate.

---

*Generated by Claude Code — 2026-06-22. No files were moved, renamed, or deleted.*
