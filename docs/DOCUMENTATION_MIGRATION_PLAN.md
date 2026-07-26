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
| 0 | Verification — confirm which "closed" bugs/reports are actually resolved in the live app before archiving them | Partially covered by Phase 2's code-level (non-live) checks; live-app QA still not started | — |
| 1 | Additive only: `docs/INDEX.md`, `docs/STATUS.md`, `docs/archive/README.md`, this file, one-line addition to `START_HERE.md`. No deletions, moves, merges, or edits to existing rule content. | **Completed** — commit `6481db3` on `docs/markdown-governance-cleanup`, pushed to `origin/docs/markdown-governance-cleanup` | 2026-07-26 |
| **2** | **Verify & refresh status docs: cross-check `docs/STATUS.md` / `PROJECT_STATUS.md` / `docs/governance/CURRENT_STATE_JUNE_2026.md` / `docs/workspace-session-handoff.md` against the actual codebase; refresh `docs/STATUS.md` with verified findings; add deprecation notices (not archiving) to the two stale status files, content otherwise preserved.** | **Completed** (this scope only — archiving the two stale files is deferred to a future phase/decision, not done here) | 2026-07-26 |
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

## Phase 2 — what this phase did and did not do

Executed in an isolated worktree (`docs/phase2-status-refresh`, branched from the pushed
`origin/docs/markdown-governance-cleanup`), never touching the original repo's dirty working
directory.

**Did:**
- Cross-checked `docs/STATUS.md`, `PROJECT_STATUS.md`, `docs/governance/CURRENT_STATE_JUNE_2026.md`,
  and `docs/workspace-session-handoff.md` against `package.json`, `src/pages.config.js`, and a
  targeted grep of the source tree (see `docs/STATUS.md` "Phase 2 findings" section for the full
  settings-drift table and the 4-gate code-level check).
- Refreshed `docs/STATUS.md` with those verified findings, clearly separating "verified", "code
  evidence but not live-QA'd", and "not verified — needs live app testing."
- Added a short deprecation notice (pointer to `docs/STATUS.md`) to the top of `PROJECT_STATUS.md`
  and `docs/governance/CURRENT_STATE_JUNE_2026.md`. All original content in both files is preserved
  unchanged below the notice.
- Read `docs/workspace-session-handoff.md` in full (both the 323-line committed version in this
  worktree and the fuller 633-line uncommitted version from the original directory) without
  modifying, moving, condensing, or archiving it.

**Did not:**
- Archive, move, delete, or merge `PROJECT_STATUS.md` or `CURRENT_STATE_JUNE_2026.md` — only a
  notice was added; the original "archive the two originals" idea from this plan's first draft is
  deferred to a later, separately-approved step.
- Run the app or a browser — the 4 old release gates (CH-1/MB-2/MB-3/MB-4) are only checked at the
  static-code level; live behavior remains unverified (see `docs/STATUS.md`).
- Modify `CLAUDE.md`, `AGENTS.md`, source code, config, or package files, even though a concrete
  settings discrepancy was found in `backend/analyze-video.function.js` (see `docs/STATUS.md`) —
  reported only, not fixed.
- Touch any file belonging to the concurrent sessions' uncommitted work in the original directory —
  this phase ran entirely in a separate worktree that never had that working tree state.

**Risk:** Low. Two files gained a short notice at the top with all other content byte-for-byte
preserved below it; `docs/STATUS.md` gained new sections, no deletions.

**Rollback:** `git revert` the Phase 2 commit — fully restores `PROJECT_STATUS.md` and
`CURRENT_STATE_JUNE_2026.md` to their pre-notice state and `docs/STATUS.md` to its Phase-1 content.

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

- **2026-07-26** — Phase 1 completed: commit `6481db3` on `docs/markdown-governance-cleanup`,
  pushed to `origin/docs/markdown-governance-cleanup`.
- **2026-07-26** — Phase 2 completed (this scope): status verification + `docs/STATUS.md` refresh +
  deprecation notices, on branch `docs/phase2-status-refresh` (worktree, based on
  `origin/docs/markdown-governance-cleanup`). Commit proposed, pending approval.
