# PROJECT_DOCUMENTATION_INDEX

**Project:** YouTube Mentor Dashboard
**Purpose:** Central documentation registry and source-of-truth index for all future development sessions.

---

# Documentation Hierarchy (Source of Truth)

When documentation conflicts, use the following priority order:

1. AI_DEVELOPMENT_GUIDE.md
2. PROJECT_DOCUMENTATION_INDEX.md
3. Architecture Documentation
4. Workflow Documentation
5. Audit Reports
6. Historical Milestones and Archived Documents

---

# Project Overview

YouTube Mentor Dashboard is a knowledge extraction, transcript analysis, GEMS integration, Brain storage, Obsidian synchronization, and Workspace management platform.

The system supports:

* YouTube transcript analysis
* GEMS processing
* Knowledge extraction
* Brain storage
* Obsidian Vault integration
* Workspace management
* Universal Tabs architecture
* Morning Brief workflows
* Political analysis modules
* Market analysis modules
* AI-assisted learning workflows

---

# Active Governance Documents

## Primary Governance

| Document                | Purpose                                            | Status |
| ----------------------- | -------------------------------------------------- | ------ |
| AI_DEVELOPMENT_GUIDE.md | Master project governance and implementation rules | Active |
| AGENTS.md               | AI agent behavior and execution rules              | Active |
| workflow.md             | Development workflow reference                     | Active |

---

# Architecture Documents

## Current

| Document                       | Purpose                                 | Status  |
| ------------------------------ | --------------------------------------- | ------- |
| GEM_ARCHITECTURE.md            | GEMS processing architecture            | Planned |
| UNIVERSAL_TABS_ARCHITECTURE.md | Universal Tabs system architecture      | Planned |
| OBSIDIAN_VAULT_API.md          | Obsidian Vault integration architecture | Planned |
| YOUTUBE_MENTOR_ARCHITECTURE.md | Overall application architecture        | Active  |

---

# Functional Areas

## Transcript System

Responsible for:

* Transcript ingestion
* Transcript persistence
* Chapter generation
* Chapter validation
* Transcript source resolution
* Manual transcript handling

---

## GEMS System

Responsible for:

* GEM execution
* GEM result storage
* GEM summary generation
* Topic mapping
* Knowledge extraction

---

## Brain System

Responsible for:

* Knowledge storage
* Item persistence
* Saved state tracking
* Brain synchronization

---

## Obsidian Integration

Responsible for:

* Vault communication
* Note creation
* Folder mapping
* File synchronization
* Knowledge export

---

## Workspace System

Responsible for:

* Workspace organization
* Project storage
* Content categorization
* User workflows

---

## Universal Tabs

Responsible for:

* Shared tab architecture
* Content rendering
* Knowledge presentation
* Cross-module consistency

---

# Audit Reports

## Active References

| Document                            | Purpose                       |
| ----------------------------------- | ----------------------------- |
| PROJECT_DOCUMENTATION_AUDIT.md      | Documentation audit results   |
| ROUTES_AUDIT_REPORT.md              | Route structure audit         |
| CHAPTER_ENGINE_ROOT_CAUSE_REPORT.md | Chapters engine investigation |

## UI and Behavior Rules

| Document                                  | Purpose                                              |
| ----------------------------------------- | ---------------------------------------------------- |
| MORNING_BRIEF_DEDICATED_CONTENT_UI_STANDARD.md | Morning Brief layout and component rules        |
| AI_BADGE_RENDERING_RULE.md                | When and how to render AI/GEM source badges          |
| CHAPTER_SOURCE_PRIORITY_RULE.md           | Which chapter source takes precedence                |
| GEM_CHAPTER_TIMESTAMP_RELIABILITY.md      | Timestamp reliability metadata for GEM chapters      |
| FINVIZ_LINK_BEHAVIOR_RULE.md              | Clickable symbol link behavior and fallback URLs     |
| OPPORTUNITIES_RISKS_DESIGN_RULE.md        | Opportunities/Risks section layout rules             |
| SECTORS_DESIGN_RULE.md                    | Sectors section design rules                         |
| SECTION_HEADER_COUNT_RULE.md             | Section header count display rules                   |

Audit reports provide historical analysis and should not override governance documents.

---

# Milestones

Completed milestones should be stored under:

docs/milestones/completed/

Historical milestone documents are retained for reference only and do not define current behavior.

---

# Documentation Rules

1. Do not duplicate architecture definitions across multiple documents.
2. Every major system should have a single source-of-truth document.
3. Governance documents override implementation notes.
4. Audit documents describe findings but do not define behavior.
5. Historical milestone documents must not be treated as active specifications.
6. New architecture decisions should be documented before implementation when possible.
7. Deprecated documentation should be marked clearly rather than deleted immediately.

---

# Missing Documentation Backlog

Priority documents to create:

1. GEM_ARCHITECTURE.md
2. UNIVERSAL_TABS_ARCHITECTURE.md
3. OBSIDIAN_VAULT_API.md

These documents are required to reduce future architectural ambiguity.

---

# Maintenance

Whenever a new major feature, architecture decision, workflow, or integration is introduced:

* Update this index.
* Update the relevant architecture document.
* Update governance documentation if behavior changes.
* Archive obsolete documents when replaced.

---

Last Updated: 2026-06-28
Status: Active
