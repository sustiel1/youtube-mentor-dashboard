# Documentation Index

**Status:** Canonical entry point for all project documentation.
**Created:** 2026-07-26, Phase 1 of `docs/DOCUMENTATION_MIGRATION_PLAN.md`.
**Note:** this copy is built for the `integration/docs-governance-cleanup` branch (documentation +
governance + Claude permissions only) — it intentionally omits references to files that belong
only to the separately-tracked feature work (see `docs/DOCUMENTATION_MIGRATION_PLAN.md`'s selective
integration note).

This index replaces the *purpose* served by five earlier, mutually-unaware indexing attempts:
`docs/PROJECT_DOCUMENTATION_AUDIT.md`, `docs/PROJECT_DOCUMENTATION_INDEX.md`,
`docs/PROJECT_MARKDOWN_FILE_INDEX.md`, `docs/PROJECT_MD_INDEX.md`, and
`docs/HEBREW_DOCUMENTATION_CATALOG.md`. **None of those five files has been moved, edited, or
deleted** — they still exist at their original paths and are listed below under "Prior audit
attempts" for historical reference. A future migration phase will archive them once this index is
confirmed to be a complete replacement.

Nothing in this index changes which file is authoritative. Where the underlying documentation
audit (see `docs/DOCUMENTATION_MIGRATION_PLAN.md`) found duplicates or contradictions, both files
are still listed as-is — resolving them is scoped to a later phase, not this one.

---

## Start here

| Doc | Purpose |
|---|---|
| [docs/STATUS.md](STATUS.md) | Verified current repo/build state — commits, working-tree status, known open items |
| [AI_DEVELOPMENT_GUIDE.md](../AI_DEVELOPMENT_GUIDE.md) | Mandatory reading before UI, save-flow, topic, Workspace, Obsidian, Brain, GEM, or analysis changes |
| [README.md](../README.md) | Setup, tech stack, scripts |
| [CLAUDE.md](../CLAUDE.md) | Base44/Git workflow rules + locked AI settings (auto-loaded by Claude Code every session) |
| [docs/DOCUMENTATION_MIGRATION_PLAN.md](DOCUMENTATION_MIGRATION_PLAN.md) | The six-phase documentation cleanup plan, approval status per phase |

## Governance & architecture (`docs/governance/`)

| Doc | Purpose |
|---|---|
| [adr/ADR_TITLE_OVERRIDE_SOURCE_OF_TRUTH.md](adr/ADR_TITLE_OVERRIDE_SOURCE_OF_TRUTH.md) | Decision record: `gemRecommender.js` is the active title-override source of truth; `gemContentRouter.js` is dormant |
| [MASTER_PROJECT_BIBLE.md](governance/MASTER_PROJECT_BIBLE.md) | Architectural invariants, knowledge-flow diagram |
| [PROJECT_DECISIONS_HISTORY.md](governance/PROJECT_DECISIONS_HISTORY.md) | Why/evidence log of past decisions |
| [USER_PRODUCT_INTENT_AND_FUTURE_VISION.md](governance/USER_PRODUCT_INTENT_AND_FUTURE_VISION.md) | Product vision and long-term direction |
| [SAVE_SYSTEM_ARCHITECTURE.md](governance/SAVE_SYSTEM_ARCHITECTURE.md) | Save/dedupe pipeline architecture |
| [STOCK_ANALYSIS_SCREEN_BIBLE.md](governance/STOCK_ANALYSIS_SCREEN_BIBLE.md) | Stock analysis screen architecture (self-documents its own drift) |
| [DESIGN_SYSTEM_AND_UX_RULES.md](governance/DESIGN_SYSTEM_AND_UX_RULES.md) | Project-wide UI/UX rules |
| [CLAUDE_CODE_GOVERNANCE_MODE.md](governance/CLAUDE_CODE_GOVERNANCE_MODE.md) | Behavioral rules for Claude Code sessions — **not auto-loaded**; open explicitly |
| [CURRENT_STATE_JUNE_2026.md](governance/CURRENT_STATE_JUNE_2026.md) | ⚠️ Dated snapshot (June 11, 2026) — superseded by `docs/STATUS.md` for current state |
| [MILESTONE_MORNING_BRIEF_DASHBOARD_CLUSTER.md](governance/MILESTONE_MORNING_BRIEF_DASHBOARD_CLUSTER.md) | Closed milestone record (2026-06-16) |
| [NEXT_SESSION_QA.md](governance/NEXT_SESSION_QA.md) | QA checklist template (never executed) |

## App-specific rule files (`docs/`)

Grouped by subsystem. Where the audit flagged near-duplicate files, both are listed with a note —
neither has been changed.

**Chapters engine**
- [CHAPTERS_SOURCE_HIERARCHY_AND_AI_TITLE_STRATEGY.md](CHAPTERS_SOURCE_HIERARCHY_AND_AI_TITLE_STRATEGY.md) — "Final project rule"
- [CHAPTER_SOURCE_PRIORITY_RULE.md](CHAPTER_SOURCE_PRIORITY_RULE.md) — ⚠️ shorter draft, largely subsumed by the above
- [GEM_CHAPTER_TIMESTAMP_RELIABILITY.md](GEM_CHAPTER_TIMESTAMP_RELIABILITY.md)
- [AI_BADGE_RENDERING_RULE.md](AI_BADGE_RENDERING_RULE.md)
- [CHAPTER_ENGINE_ROOT_CAUSE_REPORT.md](../CHAPTER_ENGINE_ROOT_CAUSE_REPORT.md) — root-cause report, treat as open until confirmed fixed

**GEM classification & routing**
- [GEM_CONTENT_CLASSIFICATION_RULES.md](GEM_CONTENT_CLASSIFICATION_RULES.md) — source of truth for classification
- [GEMS_OUTPUT_LANGUAGE_RULES.md](GEMS_OUTPUT_LANGUAGE_RULES.md)
- [GEMS_TAB_MAPPING_REGRESSION_RULES.md](GEMS_TAB_MAPPING_REGRESSION_RULES.md)
- [MORNING_BRIEF_GEMS_ROUTING.md](MORNING_BRIEF_GEMS_ROUTING.md)
- ⚠️ The "title override" hard rule is currently stated in all three of the files above — not yet consolidated (planned for a later phase)

**Market entity / Perplexity / TradingView routing**
- [MARKET_ENTITY_ANALYSIS_ROUTING.md](MARKET_ENTITY_ANALYSIS_ROUTING.md) — Active spec
- [PERPLEXITY_AI_ANALYSIS_WORKFLOW.md](PERPLEXITY_AI_ANALYSIS_WORKFLOW.md) — Active spec, ⚠️ overlaps heavily with the file above
- [PERPLEXITY_AI_RESEARCH_PATTERN.md](PERPLEXITY_AI_RESEARCH_PATTERN.md) — ⚠️ earlier, pre-implementation design pattern
- [AI_ANALYSIS_LINK_ROUTING_PLAN.md](AI_ANALYSIS_LINK_ROUTING_PLAN.md) — ⚠️ "Planning only" doc, appears superseded
- [AI_ANALYZE_OPPORTUNITY_RISK_PROMPT_RULE.md](AI_ANALYZE_OPPORTUNITY_RISK_PROMPT_RULE.md)
- [TRADINGVIEW_STOCK_SYMBOL_RESOLVER.md](TRADINGVIEW_STOCK_SYMBOL_RESOLVER.md)
- [SELECTION_TOOLBAR_WORKFLOW.md](SELECTION_TOOLBAR_WORKFLOW.md) — core rule, cited by 3+ other docs

**Finviz / sector linking**
- [SECTOR_FINVIZ_LINKS.md](SECTOR_FINVIZ_LINKS.md) — fuller/current version
- [SECTOR_FINVIZ_LINK_MAPPING.md](SECTOR_FINVIZ_LINK_MAPPING.md) — ⚠️ near-duplicate/earlier draft of the above
- [FINVIZ_LINK_BEHAVIOR_RULE.md](FINVIZ_LINK_BEHAVIOR_RULE.md)
- [WATCH_TODAY_FINVIZ_LINKS.md](WATCH_TODAY_FINVIZ_LINKS.md)
- [MACRO_INDICATOR_INVESTING_LINKS.md](MACRO_INDICATOR_INVESTING_LINKS.md)

**Morning Brief / Specialized tab UI**
- [MORNING_BRIEF_DEDICATED_CONTENT_UI_STANDARD.md](MORNING_BRIEF_DEDICATED_CONTENT_UI_STANDARD.md) — parent/canonical doc for this surface
- [SECTORS_DESIGN_RULE.md](SECTORS_DESIGN_RULE.md)
- [SYMBOL_ARROW_PLACEMENT_RULE.md](SYMBOL_ARROW_PLACEMENT_RULE.md)
- [SECTION_HEADER_COUNT_RULE.md](SECTION_HEADER_COUNT_RULE.md)
- [OPPORTUNITIES_RISKS_DESIGN_RULE.md](OPPORTUNITIES_RISKS_DESIGN_RULE.md)
- [UNIVERSAL_SECTION_SELECT_ALL_AND_EXPORT_RULE.md](UNIVERSAL_SECTION_SELECT_ALL_AND_EXPORT_RULE.md)
- [SPECIALIZED_SELECT_ALL_DEDUP_RULE.md](SPECIALIZED_SELECT_ALL_DEDUP_RULE.md)
- [SPECIALIZED_OPPORTUNITY_SAVE_RULE.md](SPECIALIZED_OPPORTUNITY_SAVE_RULE.md) — closed bug-fix log
- [MORNING_BRIEF_SPECIALIZED_OUTPUT_AUDIT.md](MORNING_BRIEF_SPECIALIZED_OUTPUT_AUDIT.md) — closed audit, verify P7/P8/P10 aren't still open
- [MORNING_BRIEF_SPECIALIZED_OUTPUT_FIXES.md](MORNING_BRIEF_SPECIALIZED_OUTPUT_FIXES.md) — closed fix log, pair with the above

**Hebrew / labeling**
- [HEBREW_FIRST_UI_LABELS_RULE.md](HEBREW_FIRST_UI_LABELS_RULE.md)
- [HEBREW_FIRST_MARKET_STATUS_LABELS.md](HEBREW_FIRST_MARKET_STATUS_LABELS.md)

**Obsidian / Brain**
- [OBSIDIAN_PERSONAL_BRAIN_PHASE.md](OBSIDIAN_PERSONAL_BRAIN_PHASE.md) — ⚠️ possibly superseded (flagged elsewhere as "vault API replaced ZIP export" — not independently verified this phase)

**Workflow / setup**
- [base44-checklist.md](base44-checklist.md)
- [../AGENTS.md](../AGENTS.md) — **canonical cross-agent workflow document** (Phase 3B)
- [workflow.md](workflow.md) — ⚠️ deprecated (Phase 3B); superseded by `AGENTS.md` above, retained here for historical reference

## Session history (chronological, historical record)

- [docs/session-closures/](session-closures/) — closed session write-ups (2026-07-01, 2026-07-02)

## Root-level reports

- [ROUTES_AUDIT_REPORT.md](../ROUTES_AUDIT_REPORT.md) — point-in-time navigation audit (2026-06-01)
- [PROJECT_STATUS.md](../PROJECT_STATUS.md) — ⚠️ dated 2026-06-17; see `docs/STATUS.md` for verified current state
- [MARKET_DASHBOARD_UI_GUIDE.md](../MARKET_DASHBOARD_UI_GUIDE.md)
- [PROMPTS.md](../PROMPTS.md) — ready-made prompt templates
- [SKILL.md](../SKILL.md) — app data-model/structure reference (not a functioning Claude Code skill — not located under `.claude/skills/`)
- [AGENTS.md](../AGENTS.md) — canonical cross-agent workflow document (see "Workflow / setup" above); mirrors `CLAUDE.md`'s Base44/Git rules for non-Claude-Code tools

## Prior audit attempts (superseded in purpose by this file, not yet archived)

- [PROJECT_DOCUMENTATION_AUDIT.md](PROJECT_DOCUMENTATION_AUDIT.md) (2026-06-22)
- [PROJECT_DOCUMENTATION_INDEX.md](PROJECT_DOCUMENTATION_INDEX.md) (2026-06-28)
- [PROJECT_MARKDOWN_FILE_INDEX.md](PROJECT_MARKDOWN_FILE_INDEX.md) (2026-06-22)
- [PROJECT_MD_INDEX.md](PROJECT_MD_INDEX.md) (2026-07-01)
- [HEBREW_DOCUMENTATION_CATALOG.md](HEBREW_DOCUMENTATION_CATALOG.md) (2026-06-22)
