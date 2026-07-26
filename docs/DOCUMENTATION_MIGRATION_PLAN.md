# Documentation Migration Plan

Tracks the six-phase Markdown cleanup proposed in the repo-wide documentation audit. Each phase
requires **separate, explicit approval** before it begins — completing one phase is not
authorization to start the next.

**Source audit:** full file-by-file findings (69 files, duplication map, per-file risk ratings)
were produced before this plan and are not duplicated here. This document tracks phase status,
approvals, and rollback notes only.

---

## Phase status

| Phase | Description | Status | Approved on |
|---|---|---|---|
| 0 | Verification — confirm which "closed" bugs/reports are actually resolved in the live app before archiving them | Not started | — |
| **1** | **Additive only: `docs/INDEX.md`, `docs/STATUS.md`, `docs/archive/README.md`, this file, one-line addition to `START_HERE.md`. No deletions, moves, merges, or edits to existing rule content.** | **In progress** | 2026-07-26 |
| 2 | Status consolidation — merge `PROJECT_STATUS.md` + `docs/governance/CURRENT_STATE_JUNE_2026.md` into `docs/STATUS.md`; archive the two originals | Proposed, not approved | — |
| 3 | Governance de-duplication — consolidate the 3-way invariants overlap across `MASTER_PROJECT_BIBLE.md` / `PROJECT_DECISIONS_HISTORY.md` / `USER_PRODUCT_INTENT_AND_FUTURE_VISION.md`; decide fate of `CLAUDE_CODE_GOVERNANCE_MODE.md` | Proposed, not approved | — |
| 4 | `AI_DEVELOPMENT_GUIDE.md` condensation — remove self-declared-obsolete §24/§26/§29 fragments, template repeated per-category boilerplate | Proposed, not approved | — |
| 5 | Small-rule consolidation — merge remaining overlapping pairs (Chapters-priority, Sector-Finviz, Perplexity-routing, Morning-Brief sub-rules, 3-way "title override" restatement) into `.claude/rules/` | Proposed, not approved | — |

---

## Phase 1 — what this phase does and does not do

**Does:**
- Adds `docs/INDEX.md` (new canonical index, informational only — flags known duplicates without resolving them).
- Adds `docs/STATUS.md` (verified git/repo state as of 2026-07-26 — see file for exact verification method).
- Adds `docs/archive/README.md` (policy for a currently-empty directory).
- Adds this file.
- Adds one line to `docs/START_HERE.md` linking to `docs/INDEX.md`.

**Does not:**
- Delete, move, rename, merge, condense, or archive any existing Markdown file.
- Modify `CLAUDE.md`, `AGENTS.md`, `SKILL.md`, or any file under `docs/governance/`.
- Touch any application source, config, or package file.
- Resolve the "title override" rule triple-duplication.
- Create any `@import` or new `.claude/rules/*` file.

**Pre-flight check performed before this phase:** working tree contained unrelated, uncommitted
application-code changes (7 `src/` files) belonging to concurrent sessions documented in
`docs/workspace-session-handoff.md`, plus 12 unpushed local commits. Per explicit user instruction,
this was flagged and confirmed before proceeding — see `docs/STATUS.md` for the full inventory.
This phase's branch and commit touch only the 5 files listed above; the pending `src/` changes are
untouched and remain uncommitted exactly as found.

**Risk:** Low. All changes are new files or a single-line addition to an existing file; nothing
that other code or sessions currently depend on is altered.

**Rollback:** `git revert` the Phase 1 commit, or `git branch -D docs/markdown-governance-cleanup`
before merge — no other branch or file depends on this branch's existence.

---

## Phase 2 preview — status consolidation

**Risk:** Medium. `docs/governance/CURRENT_STATE_JUNE_2026.md` contains a 4-gate release-blocker
table that may still reflect real open bugs (chapters timestamps, DirectionChip error, etc.) —
these must be confirmed via Phase 0 and copied into `docs/STATUS.md` before the source files are
archived, not lost in the process.

**Rollback:** `git mv` based archiving preserves history; `git revert` restores original paths.

## Phase 3 preview — governance de-duplication

**Risk:** Medium-High. `MASTER_PROJECT_BIBLE.md` is the most cross-referenced governance file;
consolidating its overlap with `PROJECT_DECISIONS_HISTORY.md` and `USER_PRODUCT_INTENT_AND_FUTURE_VISION.md`
ripples into multiple files and should be done as one reviewed diff, not incremental silent edits.
Also decides whether `CLAUDE_CODE_GOVERNANCE_MODE.md`'s behavioral rules get folded into `CLAUDE.md`
(changes what loads in every session — needs explicit sign-off).

**Rollback:** single squashed commit per consolidated file pair, reviewed before merge, revertable
as a unit.

## Phase 4 preview — `AI_DEVELOPMENT_GUIDE.md` condensation

**Risk:** High. This is the most-read rules file in the repo (README.md mandates reading it before
UI/save/topic changes). Removing §24/§26/§29 must only happen after confirming §30 is genuinely the
sole current architecture in the live app — do as its own dedicated, reviewed task, not folded into
a general docs pass.

**Rollback:** single commit, full diff review required before merge; revert restores the full
pre-condensation text.

## Phase 5 preview — small-rule consolidation

**Risk:** Medium, concentrated in the three files that restate the "title override" hard rule
(`GEM_CONTENT_CLASSIFICATION_RULES.md`, `GEMS_TAB_MAPPING_REGRESSION_RULES.md`,
`MORNING_BRIEF_GEMS_ROUTING.md`) — must verify all three copies are worded identically before
picking one as canonical and cross-referencing the others, to avoid silently narrowing the rule.

**Rollback:** one commit per merged pair, independently revertable.

---

## Changelog

- **2026-07-26** — Phase 1 started on branch `docs/markdown-governance-cleanup`.
