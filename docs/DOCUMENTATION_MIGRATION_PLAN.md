# Documentation Migration Plan

Tracks the six-phase Markdown cleanup proposed in the repo-wide documentation audit. Each phase
requires **separate, explicit approval** before it begins — completing one phase is not
authorization to start the next.

**Source audit:** full file-by-file findings (69 files, duplication map, per-file risk ratings)
were produced before this plan and are not duplicated here. This document tracks phase status,
approvals, and rollback notes only.

**Selective integration note (this branch, `integration/docs-governance-cleanup`):** the phases
below were originally produced and verified on a longer-lived audit branch
(`docs/phase5a-single-safe-archive`, HEAD `bea78b7`) that also carried 12 earlier, unrelated
feature commits (`bd11421`…`9af9a6f` — Workspace redesign, macro-mapping fixes, tests) and the file
`docs/workspace-session-handoff.md` those commits introduced. A dedicated selective-integration
audit determined those 12 commits, and any documentation content that depends on them, must not be
part of this integration — they remain pending a separate, QA-gated feature pull request (4
release gates — CH-1/MB-2/MB-3/MB-4 — are still unverified live). This branch is rebuilt directly
from `origin/main` and cherry-picks only the 7 commits confirmed independent of that feature work
(`112f723`, `6cf8857`, `a31aba3`, `fb8d579`, `0986739`, `d526b1e`, `bea78b7`). The original Phase 1
and Phase 2 commits (`6481db3`, `19e74fa`) were **not** cherry-picked — their safe documentation
intent is recreated manually below, adapted to `main`'s actual state, without the feature-commit
dependencies. Phase 4-CC-C (`.claude/rules/` pilot) remains deferred. The 13 archive candidates
identified by the separate Phase 5-ARCH audit remain deferred pending their listed verification
steps. Phase 6 is closed for this integration cycle with zero approved deletions. The optional
Phase 3C-2 source-comment cleanup in `gemContentRouter.js` remains deferred.

---

## Phase status

| Phase | Description | Status | Approved on |
|---|---|---|---|
| 0 | Verification — confirm which "closed" bugs/reports are actually resolved in the live app before archiving them | Partially covered by Phase 2's code-level (non-live) checks; live-app QA still not started | — |
| 1 | Additive only: `docs/INDEX.md`, `docs/STATUS.md`, `docs/archive/README.md`, this file, one-line addition to `START_HERE.md`. No deletions, moves, merges, or edits to existing rule content. | **Completed (adapted for `main`)** — original audit-trail commit `6481db3` recreated directly on `origin/main` for this selective integration; the 12 earlier feature commits are intentionally excluded | 2026-07-26 |
| **2** | **Verify & refresh status docs: describe `docs/STATUS.md` accurately for `main`'s actual current state; add deprecation notices (not archiving) to the two stale status files, content otherwise preserved.** | **Completed (adapted for `main`)** — original audit-trail commit `19e74fa` cross-checked against `docs/workspace-session-handoff.md` and the 12 then-relevant feature commits; those are out of scope here, so `docs/STATUS.md` in this integration describes only what is verifiably true on `main` without them | 2026-07-26 |
| **3** | **Duplicated active documentation & governance rules** — broader in scope than originally previewed below: covers `AGENTS.md`/`docs/workflow.md` duplication, the GEM "title override" rule (restated in 2 files, plus a non-identical code-level duplication), the 5 legacy documentation indexes, and `CLAUDE_CODE_GOVERNANCE_MODE.md`'s enforcement gap. | **Audit completed** 2026-07-26 (read-only, no files changed). Split into sub-phases below for implementation. | — |
| 3A | Consolidate documentation entry points — deprecation notices on the 5 legacy indexes + `START_HERE.md` rewrite | **Completed** | 2026-07-26 |
| 3B | `AGENTS.md` / `docs/workflow.md` consolidation | Not started | — |
| 3C | GEM "title override" rule consolidation | **Deferred — pending an architecture decision** (see Phase 3 audit §6: two non-identical code copies of `TITLE_OVERRIDE_RULES` exist, one dead; must be resolved in source code before the docs are safely consolidated) | — |
| 4 | `AI_DEVELOPMENT_GUIDE.md` condensation — remove self-declared-obsolete §24/§26/§29 fragments, template repeated per-category boilerplate | Proposed, not approved | — |
| 5 | Small-rule consolidation — merge remaining overlapping pairs (Chapters-priority, Sector-Finviz, Perplexity-routing, Morning-Brief sub-rules, 3-way "title override" restatement) into `.claude/rules/` | Proposed, not approved | — |

---

## Phase 1 — what this phase does and does not do

**Does:**
- Adds `docs/INDEX.md` (new canonical index, informational only — flags known duplicates without resolving them).
- Adds `docs/STATUS.md` (describes `main`'s actual current state as of this integration — see file for exact scope).
- Adds `docs/archive/README.md` (policy for a currently-empty directory).
- Adds this file.
- Adds one line to `docs/START_HERE.md` linking to `docs/INDEX.md`.

**Does not:**
- Delete, move, rename, merge, condense, or archive any existing Markdown file.
- Modify `CLAUDE.md`, `AGENTS.md`, `SKILL.md`, or any file under `docs/governance/`.
- Touch any application source, config, or package file.
- Resolve the "title override" rule triple-duplication.
- Create any `@import` or new `.claude/rules/*` file.
- Include any of the 12 feature commits (`bd11421`…`9af9a6f`) present on the original audit branch.

**Pre-flight check performed before this integration:** this branch (`integration/docs-governance-cleanup`)
was built directly from `origin/main` in a clean worktree. A dedicated selective-integration
dependency audit confirmed the 12 feature commits, and `docs/workspace-session-handoff.md` (which
one of them introduces), are unrelated to this documentation/governance/permissions cleanup and
must not be included here. This phase's adapted commit touches only the 5 files listed above,
matching the original audit trail's Phase 1 scope.

**Risk:** Low. All changes are new files or a single-line addition to an existing file; nothing
that other code or sessions currently depend on is altered.

**Rollback:** `git revert` the adaptation commit, or delete the `integration/docs-governance-cleanup`
branch before merge — no other branch or file depends on this branch's existence.

---

## Phase 2 — what this phase did and did not do

**Adapted for this integration** — the original audit-trail commit (`19e74fa`) cross-checked
`docs/STATUS.md` against the 12 feature commits and `docs/workspace-session-handoff.md`; that
verification does not apply to this branch, since those commits are intentionally excluded here.

**Did:**
- Wrote `docs/STATUS.md` describing only what is verifiably true on `origin/main` at integration
  time — no claims about the excluded feature commits' code, and no live-QA claims about behavior
  that isn't part of this tree.
- Added a short deprecation notice (pointer to `docs/STATUS.md`) to the top of `PROJECT_STATUS.md`
  and `docs/governance/CURRENT_STATE_JUNE_2026.md`. All original content in both files is preserved
  unchanged below the notice.

**Did not:**
- Archive, move, delete, or merge `PROJECT_STATUS.md` or `CURRENT_STATE_JUNE_2026.md` — only a
  notice was added; archiving remains a separately-approved future step.
- Verify or make claims about the 4 old release gates (CH-1/MB-2/MB-3/MB-4) or any other
  feature-commit-specific code — that verification belongs to the excluded feature work and its own
  future QA-gated integration, not this branch.
- Modify `CLAUDE.md`, `AGENTS.md`, source code, config, or package files.
- Reference or depend on `docs/workspace-session-handoff.md` — it is not part of this integration's
  tree.

**Risk:** Low. Two files gained a short notice at the top with all other content byte-for-byte
preserved below it; `docs/STATUS.md` is a new, narrowly-scoped file.

**Rollback:** `git revert` the adaptation commit — fully restores `PROJECT_STATUS.md` and
`CURRENT_STATE_JUNE_2026.md` to their pre-notice state and removes `docs/STATUS.md`.

## Phase 3 — audit findings and sub-phase breakdown

Full duplication matrix, exact file:line quotes, and per-topic risk ratings live in the Phase 3
audit report (produced 2026-07-26, read-only, in worktree `docs/phase3-duplication-audit`). Summary:

1. **`AGENTS.md` ≡ `docs/workflow.md`** — confirmed byte-identical (117 lines, zero `diff` output).
   Both are stale subsets of `CLAUDE.md` (missing its Ollama-processing and locked-AI-settings
   sections). Recommendation is asymmetric: `AGENTS.md` is kept as a distinct file because its
   filename is a recognized convention for non-Claude-Code tools; `docs/workflow.md` has no such
   justification. → **Phase 3B**, not started.
2. **GEM "title override" rule** — fully restated (not just referenced) in exactly 2 files:
   `docs/GEM_CONTENT_CLASSIFICATION_RULES.md` (canonical candidate) and
   `docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md`. A **code-level** duplication was also found:
   `TITLE_OVERRIDE_RULES` is independently defined (non-identically) in `src/lib/gemRecommender.js`
   (active) and `src/ai/gemini/gemContentRouter.js` (exported, confirmed unimported anywhere). The
   documentation asserts the two must stay "aligned," which has no runtime effect while one copy is
   dead code. → **Phase 3C, deferred** until an engineering decision is made on the code duplication
   — consolidating the docs first risks asserting an alignment guarantee the code doesn't back up.
3. **5 legacy documentation indexes** (`PROJECT_DOCUMENTATION_AUDIT.md`, `PROJECT_DOCUMENTATION_INDEX.md`,
   `PROJECT_MARKDOWN_FILE_INDEX.md`, `PROJECT_MD_INDEX.md`, `HEBREW_DOCUMENTATION_CATALOG.md`) plus
   `docs/START_HERE.md` presenting two competing entry points. → **Phase 3A**, this pass.
4. **`docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md`** — declares itself "active at all times" with
   no actual loading mechanism (no `@import`, not in `.claude/rules/`, absent from
   `MASTER_PROJECT_BIBLE.md`'s own governance index). Three resolution options identified (fold into
   `CLAUDE.md`, reframe as opt-in, or build real enforcement) — **no sub-phase started**; needs your
   decision first, since folding it into `CLAUDE.md` changes what loads every session.

### Phase 3A — consolidate documentation entry points (this commit)

**Does:** adds a short, non-destructive deprecation notice (pointing to `docs/INDEX.md`) to the top
of each of the 5 legacy index files, with all original content preserved unchanged below; rewrites
`docs/START_HERE.md`'s top section so `docs/INDEX.md` is the sole stated entry point instead of two
competing ones, correcting the links inside that rewritten section to resolve correctly from
`docs/START_HERE.md`'s actual location.

**Does not:** touch `AGENTS.md`, `docs/workflow.md`, any title-override documentation,
`docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md`, `CLAUDE.md`, or any file outside the 7 listed above.
Does not delete, archive, rename, or move any file. `docs/START_HERE.md`'s topic-shortcut sections
(Morning Brief / Chapters / Obsidian / Brain / UI / Architecture) were left untouched — their
pre-existing broken relative links predate this phase and fixing them was out of this phase's scope.

**Risk:** Low. Every legacy-index change is a short prepended notice; `START_HERE.md`'s change
replaces one small block (the old "חובה לקרוא" list) rather than the whole file.

**Rollback:** `git restore` the exact 6 changed files listed in the commit before commit; `git revert`
the Phase 3A commit after.

## Phase 4 preview — `AI_DEVELOPMENT_GUIDE.md` condensation

**Risk:** High. This is the most-read rules file in the repo (README.md mandates reading it before
UI/save/topic changes). Removing §24/§26/§29 must only happen after confirming §30 is genuinely the
sole current architecture in the live app — do as its own dedicated, reviewed task, not folded into
a general docs pass.

**Rollback:** single commit, full diff review required before merge; revert restores the full
pre-condensation text.

## Phase 5 preview — small-rule consolidation

**Risk:** Medium. Superseded in part by the Phase 3 audit: the "title override" rule is now
tracked as **Phase 3C** (see above), confirmed as a full restatement in exactly 2 files
(`GEM_CONTENT_CLASSIFICATION_RULES.md`, `GEMS_TAB_MAPPING_REGRESSION_RULES.md` — not 3;
`MORNING_BRIEF_GEMS_ROUTING.md` contains only a brief implementation-log mention, not a
restatement) and deferred pending a code-level architecture decision, not just a docs merge.
Remaining Phase 5 scope: Chapters-priority, Sector-Finviz, and Perplexity-routing consolidation.

**Rollback:** one commit per merged pair, independently revertable.

---

## Changelog

- **2026-07-26** — Phase 1 completed: commit `6481db3` on `docs/markdown-governance-cleanup`,
  pushed to `origin/docs/markdown-governance-cleanup`.
- **2026-07-26** — Phase 2 completed: commit `19e74fa` on `docs/phase2-status-refresh`, pushed to
  `origin/docs/phase2-status-refresh`.
- **2026-07-26** — Phase 3 audit completed (read-only): duplication matrix covering `AGENTS.md`/
  `docs/workflow.md`, the GEM title-override rule (docs + a code-level finding), the 5 legacy
  indexes, and `CLAUDE_CODE_GOVERNANCE_MODE.md`'s enforcement gap. Split into Phase 3A/3B/3C above.
- **2026-07-26** — Phase 3A in progress: entry-point consolidation on branch
  `docs/phase3-duplication-audit` (worktree, based on `origin/docs/phase2-status-refresh`). Commit
  proposed, pending approval.
